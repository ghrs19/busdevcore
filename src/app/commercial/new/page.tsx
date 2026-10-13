'use client';

import { Suspense } from 'react';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  buildCategoryCogs,
  priceFromMargin,
  marginFromPrice,
  computeTotals,
  distributeGrandTotal,
  type CategoryPricing,
  type PricingCategory,
} from '@/lib/commercial-pricing';

interface Company {
  id: number;
  name: string;
}

interface Project {
  id: number;
  name: string;
  company_id: number;
}

interface Estimate {
  id: number;
  title: string;
  version: number;
  project_id: number;
  total_hours: number;
  total_cost: number;
  category_codes?: string[];
  operational_items?: Array<{ total_cost?: number }>;
  billing_summary?: {
    total_one_time?: number;
    one_time_dev?: number;
    one_time_infra?: number;
    one_time_operational?: number;
    total_maintenance?: number;
    recurring_infra?: number;
    total_monthly_recurring?: number;
    monthly_maintenance?: number;
    monthly_infra?: number;
    grand_total?: number;
  };
  timeline_config?: {
    total_weeks: number;
    start_date?: string;
    milestones: Array<{
      phase: string;
      duration_weeks: number;
      deliverable: string;
    }>;
  };
}

interface Milestone {
  phase: string;
  duration_weeks: number;
  deliverable: string;
}

interface PaymentTerm {
  milestone_name: string;
  percent: number;
  amount: number;
  trigger_condition: string;
}

const formatIDR = (val: number | string) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return `Rp ${(num || 0).toLocaleString('id-ID')}`;
};

function NewCommercialProposalForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit_id');

  // Cascade states
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);

  const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>('');
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [selectedEstimateId, setSelectedEstimateId] = useState<number | ''>('');

  const [activeEstimate, setActiveEstimate] = useState<Estimate | null>(null);
  const [isLoadingEstimate, setIsLoadingEstimate] = useState(false);

  // Edit / Revision Mode metadata
  const [isRevisionMode, setIsRevisionMode] = useState(false);
  const [existingProposalNumber, setExistingProposalNumber] = useState<string>('');
  const [existingVersion, setExistingVersion] = useState<number>(1);
  const [revisionNotes, setRevisionNotes] = useState<string>('');

  // Commercial Pricing States (Two-way linked)
  // Harga per kategori (COGS, margin, harga dasar). Diskon & PPN tetap satu untuk total.
  const [categoryPricing, setCategoryPricing] = useState<CategoryPricing>({});
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'NOMINAL'>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [marketingFeePercent, setMarketingFeePercent] = useState<number>(0);
  const [marketingFeeMode, setMarketingFeeMode] = useState<'ALL_PROPORTIONAL' | 'SELECTED_ONLY'>('ALL_PROPORTIONAL');
  const [marketingFeeCategories, setMarketingFeeCategories] = useState<PricingCategory[]>([]);
  const [isTaxEnabled, setIsTaxEnabled] = useState<boolean>(true);

  // Delivery Timeline States (Prefilled & editable)
  const [totalWeeks, setTotalWeeks] = useState<number>(4);
  const [startDate, setStartDate] = useState<string>('');
  const [milestones, setMilestones] = useState<Milestone[]>([
    { phase: 'Requirement & UI/UX Design', duration_weeks: 1, deliverable: 'Design Prototype & SRS Sign-off' },
    { phase: 'Core Development & Integration', duration_weeks: 2, deliverable: 'Staging Application & API Ready' },
    { phase: 'UAT, Deployment & Go-Live', duration_weeks: 1, deliverable: 'Production Deployment & BAST' },
  ]);

  // Payment Terms (Milestones)
  const [maintenanceBillingMode, setMaintenanceBillingMode] = useState<'ALL_IN_PROJECT' | 'MONTHLY_RETAINER'>('ALL_IN_PROJECT');
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([

    { milestone_name: 'Termin 1 (Down Payment / Kickoff)', percent: 30, amount: 0, trigger_condition: 'Penandatanganan Kontrak / SPK' },
    { milestone_name: 'Termin 2 (User Acceptance Test)', percent: 50, amount: 0, trigger_condition: 'Penyelesaian Fitur & Persetujuan BAST UAT' },
    { milestone_name: 'Termin 3 (Serah Terima & Go-Live)', percent: 20, amount: 0, trigger_condition: 'Aplikasi Live di Production & BAST Final' },
  ]);

  const [validityDays, setValidityDays] = useState<number>(30);
  const [notes, setNotes] = useState<string>('• Penawaran harga sudah mencakup garansi bug fixing 3 bulan setelah UAT.\n• Pembayaran ditransfer ke rekening resmi perusahaan dalam waktu 14 hari kalender setelah invoice diterbitkan.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- TWO-WAY LINKED FINANCIAL CALCULATION ENGINE ---

  const presentCategories = CATEGORY_ORDER.filter((c) => categoryPricing[c]);
  const effectiveMarketingFeeCategories = marketingFeeMode === 'ALL_PROPORTIONAL' ? presentCategories : marketingFeeCategories.filter((c) => categoryPricing[c]);
  const discountOpts = { discountType, discountValue, taxEnabled: isTaxEnabled, marketingFeePercent, marketingFeeCategories: effectiveMarketingFeeCategories };
  const totals = computeTotals(categoryPricing, discountOpts);
  const grandTotal = totals.grand_total;

  // Satu pintu untuk semua perubahan harga: hitung ulang total lalu sinkronkan nominal termin.
  const applyPricing = (next: CategoryPricing, opts = discountOpts) => {
    setCategoryPricing(next);
    syncTermsFromGrandTotal(computeTotals(next, opts).grand_total);
  };

  // 1. Margin satu kategori berubah -> harga dasar kategori itu dihitung maju
  const handleCategoryMarginChange = (cat: PricingCategory, newMargin: number) => {
    const line = categoryPricing[cat];
    if (!line) return;
    applyPricing({ ...categoryPricing, [cat]: { ...line, margin_percent: newMargin, base_price: priceFromMargin(line.cogs, newMargin) } });
  };

  // 2. Harga dasar satu kategori berubah -> margin kategori itu dihitung mundur
  const handleCategoryPriceChange = (cat: PricingCategory, newBase: number) => {
    const line = categoryPricing[cat];
    if (!line) return;
    applyPricing({ ...categoryPricing, [cat]: { ...line, base_price: newBase, margin_percent: marginFromPrice(line.cogs, newBase) } });
  };

  // 3. Grand total diedit langsung -> semua harga kategori diskalakan proporsional
  const handleGrandTotalChange = (newGT: number) => {
    applyPricing(distributeGrandTotal(categoryPricing, newGT, discountOpts));
  };

  // 4. Diskon dan PPN: satu nilai untuk total
  const handleDiscountTypeChange = (newType: 'PERCENTAGE' | 'NOMINAL') => {
    setDiscountType(newType);
    syncTermsFromGrandTotal(computeTotals(categoryPricing, { ...discountOpts, discountType: newType }).grand_total);
  };

  const handleDiscountValueChange = (newVal: number) => {
    setDiscountValue(newVal);
    syncTermsFromGrandTotal(computeTotals(categoryPricing, { ...discountOpts, discountValue: newVal }).grand_total);
  };

  const handleTaxToggle = (checked: boolean) => {
    setIsTaxEnabled(checked);
    syncTermsFromGrandTotal(computeTotals(categoryPricing, { ...discountOpts, taxEnabled: checked }).grand_total);
  };

  // 5. Sync payment terms amounts when Grand Total changes
  const syncTermsFromGrandTotal = (targetGT: number) => {
    setPaymentTerms((prev) =>
      prev.map((term) => ({
        ...term,
        amount: Math.round((targetGT * term.percent) / 100),
      }))
    );
  };

  // 6. When a specific Payment Term Nominal (Rp) is edited directly
  const handleTermAmountChange = (idx: number, newAmount: number) => {
    setPaymentTerms((prev) => {
      const copy = [...prev];
      const newPercent = grandTotal > 0
        ? Number(((newAmount / grandTotal) * 100).toFixed(2))
        : 0;
      copy[idx] = { ...copy[idx], amount: newAmount, percent: newPercent };
      return copy;
    });
  };

  // 7. When a specific Payment Term Percent (%) is edited directly
  const handleTermPercentChange = (idx: number, newPercent: number) => {
    setPaymentTerms((prev) => {
      const copy = [...prev];
      const newAmount = Math.round((grandTotal * newPercent) / 100);
      copy[idx] = { ...copy[idx], percent: newPercent, amount: newAmount };
      return copy;
    });
  };

  // Derived display values
  const currentDiscountAmount = totals.discount;
  const currentSubtotal = totals.subtotal;
  const currentTaxAmount = totals.tax;
  const grossProfit = currentSubtotal - totals.cogs;
  const grossProfitPercent = currentSubtotal > 0
    ? ((grossProfit / currentSubtotal) * 100).toFixed(1)
    : '0';

  const totalTermPercent = paymentTerms.reduce((sum, t) => sum + Number(t.percent || 0), 0);
  const totalTermAmount = paymentTerms.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const termDiff = grandTotal - totalTermAmount;

  // 1. Initial Load Companies & Projects
  useEffect(() => {
    async function loadMasterData() {
      try {
        const [compRes, projRes] = await Promise.all([
          fetch('/api/companies'),
          fetch('/api/projects'),
        ]);
        const compData = await compRes.json();
        const projData = await projRes.json();

        if (compData.companies) setCompanies(compData.companies);
        if (projData.projects) setProjects(projData.projects);
      } catch (err) {
        console.error('Gagal memuat master data', err);
      }
    }
    loadMasterData();
  }, []);

  // 2. Load existing proposal if edit_id is present
  useEffect(() => {
    if (!editId) return;
    async function loadExistingProposal() {
      try {
        const res = await fetch(`/api/commercial/${editId}`);
        const data = await res.json();
        if (data.success && data.proposal) {
          const p = data.proposal;
          setIsRevisionMode(true);
          setExistingProposalNumber(p.proposal_number);
          setExistingVersion(p.version || 1);
          setRevisionNotes(`Penyesuaian revisi v${(p.version || 1) + 1}`);

          setSelectedCompanyId(p.company_id);
          setSelectedProjectId(p.project_id);
          setSelectedEstimateId(p.estimate_id);

          // Revisi: pakai harga per kategori yang tersimpan; proposal lama tanpa data itu jatuh ke satu baris gabungan.
          if (p.category_pricing && typeof p.category_pricing === 'object') {
            setCategoryPricing(p.category_pricing as CategoryPricing);
          } else {
            setCategoryPricing({
              DEVELOPMENT: {
                cogs: Number(p.cogs_amount) || 0,
                base_price: Number(p.base_price) || 0,
                margin_percent: Number(p.margin_percent) || 0,
              },
            });
          }
          setDiscountType(p.discount_type || 'PERCENTAGE');
          setDiscountValue(Number(p.discount_value) || 0);
          setMarketingFeePercent(Number(p.marketing_fee_percent) || 0);
          setMarketingFeeMode(p.marketing_fee_mode === 'SELECTED_ONLY' ? 'SELECTED_ONLY' : 'ALL_PROPORTIONAL');
          setMarketingFeeCategories(Array.isArray(p.marketing_fee_categories) ? p.marketing_fee_categories : []);
          setIsTaxEnabled(Boolean(p.is_tax_enabled));
          setValidityDays(Number(p.validity_days) || 30);
          if (p.notes) setNotes(p.notes);

          if (p.timeline_config && Array.isArray(p.timeline_config.milestones)) {
            setTotalWeeks(p.timeline_config.total_weeks || 4);
            if (p.timeline_config.start_date) setStartDate(p.timeline_config.start_date);
            setMilestones(p.timeline_config.milestones);
          }

          if (Array.isArray(p.payment_terms) && p.payment_terms.length > 0) {
            setPaymentTerms(p.payment_terms);
          }
          if (p.maintenance_billing_mode) {
            setMaintenanceBillingMode(p.maintenance_billing_mode);
          }

          if (p.project_id) {
            const estRes = await fetch(`/api/estimates?project_id=${p.project_id}`);
            const estData = await estRes.json();
            if (estData.success && Array.isArray(estData.estimates)) {
              setEstimates(estData.estimates);
            }
          }

          if (p.estimate_id) {
            const estDetailRes = await fetch(`/api/estimates/${p.estimate_id}`);
            const estDetailData = await estDetailRes.json();
            if (estDetailData.success && estDetailData.estimate) {
              setActiveEstimate(estDetailData.estimate);
            }
          }
        }
      } catch (err) {
        console.error('Gagal memuat proposal untuk revisi', err);
      }
    }
    loadExistingProposal();
  }, [editId]);

  // 3. Cascade Company Change
  const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cid = e.target.value ? Number(e.target.value) : '';
    setSelectedCompanyId(cid);
    setSelectedProjectId('');
    setSelectedEstimateId('');
    setActiveEstimate(null);
  };

  // 4. Cascade Project Change
  const handleProjectChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pid = e.target.value ? Number(e.target.value) : '';
    setSelectedProjectId(pid);
    setSelectedEstimateId('');
    setActiveEstimate(null);

    if (pid) {
      try {
        const res = await fetch(`/api/estimates?project_id=${pid}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.estimates)) {
          setEstimates(data.estimates);
        } else {
          setEstimates([]);
        }
      } catch (err) {
        console.error('Gagal memuat daftar estimasi', err);
      }
    } else {
      setEstimates([]);
    }
  };

  // 5. Cascade Estimate Change
  const handleEstimateChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const eid = e.target.value ? Number(e.target.value) : '';
    setSelectedEstimateId(eid);

    if (!eid) {
      setActiveEstimate(null);
      applyPricing({});
      return;
    }

    setIsLoadingEstimate(true);
    try {
      const res = await fetch(`/api/estimates/${eid}`);
      const data = await res.json();
      if (data.success && data.estimate) {
        const est: Estimate = data.estimate;
        setActiveEstimate(est);

        // COGS per kategori diambil dari estimasi; margin awal 30% per kategori.
        const operationalTotal = est.billing_summary?.one_time_operational
          ?? (est.operational_items || []).reduce((sum, it) => sum + (Number(it.total_cost) || 0), 0);
        const cogsByCategory = buildCategoryCogs({
          billing: est.billing_summary || {},
          operationalTotal,
          categories: est.category_codes || ['DEVELOPMENT'],
        });
        const initial: CategoryPricing = {};
        for (const cat of CATEGORY_ORDER) {
          const cogs = cogsByCategory[cat];
          if (cogs === undefined) continue;
          initial[cat] = { cogs, margin_percent: 30, base_price: priceFromMargin(cogs, 30) };
        }
        if (Object.keys(initial).length === 0) {
          const fallback = est.billing_summary?.grand_total || est.total_cost || 0;
          initial.DEVELOPMENT = { cogs: fallback, margin_percent: 30, base_price: priceFromMargin(fallback, 30) };
        }
        applyPricing(initial);

        if (est.timeline_config && est.timeline_config.milestones) {
          setTotalWeeks(est.timeline_config.total_weeks || 4);
          if (est.timeline_config.start_date) setStartDate(est.timeline_config.start_date);
          if (Array.isArray(est.timeline_config.milestones) && est.timeline_config.milestones.length > 0) {
            setMilestones(est.timeline_config.milestones);
          }
        }
      }
    } catch (err) {
      console.error('Gagal mengambil detail estimasi', err);
    } finally {
      setIsLoadingEstimate(false);
    }
  };

  // Milestone actions
  const handleMilestoneChange = (idx: number, field: keyof Milestone, val: string | number) => {
    setMilestones((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const addMilestone = () => {
    setMilestones((prev) => [
      ...prev,
      { phase: `Fase ${prev.length + 1}`, duration_weeks: 1, deliverable: 'Deliverable baru' },
    ]);
  };

  const removeMilestone = (idx: number) => {
    if (milestones.length <= 1) return;
    setMilestones((prev) => prev.filter((_, i) => i !== idx));
  };

  // Payment Term actions
  const handleTermFieldChange = (idx: number, field: 'milestone_name' | 'trigger_condition', val: string) => {
    setPaymentTerms((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const addTerm = () => {
    setPaymentTerms((prev) => [
      ...prev,
      { milestone_name: `Termin ${prev.length + 1}`, percent: 0, amount: 0, trigger_condition: 'Keterangan trigger' },
    ]);
  };

  const removeTerm = (idx: number) => {
    if (paymentTerms.length <= 1) return;
    setPaymentTerms((prev) => prev.filter((_, i) => i !== idx));
  };

  const applyPaymentPreset = (preset: '3_TERMS' | '2_TERMS' | 'FULL') => {
    let newPreset: PaymentTerm[] = [];
    if (preset === '3_TERMS') {
      newPreset = [
        { milestone_name: 'Termin 1 (Down Payment / Kickoff)', percent: 30, amount: Math.round((grandTotal * 30) / 100), trigger_condition: 'Penandatanganan Kontrak / SPK' },
        { milestone_name: 'Termin 2 (User Acceptance Test)', percent: 50, amount: Math.round((grandTotal * 50) / 100), trigger_condition: 'Penyelesaian Fitur & Persetujuan BAST UAT' },
        { milestone_name: 'Termin 3 (Serah Terima & Go-Live)', percent: 20, amount: Math.round((grandTotal * 20) / 100), trigger_condition: 'Aplikasi Live di Production & BAST Final' },
      ];
    } else if (preset === '2_TERMS') {
      newPreset = [
        { milestone_name: 'Termin 1 (Down Payment / Kickoff)', percent: 50, amount: Math.round((grandTotal * 50) / 100), trigger_condition: 'Penandatanganan Kontrak / SPK' },
        { milestone_name: 'Termin 2 (Pelunasan & Serah Terima)', percent: 50, amount: Math.round((grandTotal * 50) / 100), trigger_condition: 'Aplikasi Live & BAST Final' },
      ];
    } else if (preset === 'FULL') {
      newPreset = [
        { milestone_name: 'Pelunasan 100% di Awal', percent: 100, amount: grandTotal, trigger_condition: 'Penandatanganan Kontrak' },
      ];
    }
    setPaymentTerms(newPreset);
  };

  // Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId || !selectedProjectId || !selectedEstimateId) {
      setErrorMessage('Pilih Perusahaan, Proyek, dan Estimasi terlebih dahulu.');
      return;
    }

    if (presentCategories.length === 0) {
      setErrorMessage('Estimasi belum memiliki kategori biaya untuk dihitung.');
      return;
    }
    if (marketingFeePercent > 0 && effectiveMarketingFeeCategories.length === 0) {
      setErrorMessage('Pilih kategori untuk memasukkan fee marketing.');
      return;
    }

    if (Math.abs(termDiff) > 100) {
      if (!confirm(`Total akumulasi nominal termin (Rp ${totalTermAmount.toLocaleString('id-ID')}) berbeda dari Grand Total Penawaran (Rp ${grandTotal.toLocaleString('id-ID')}). Apakah yakin ingin melanjutkan?`)) {
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const payload = {
      company_id: selectedCompanyId,
      project_id: selectedProjectId,
      estimate_id: selectedEstimateId,
      category_pricing: categoryPricing,
      marketing_fee_percent: marketingFeePercent,
      marketing_fee_mode: marketingFeeMode,
      marketing_fee_categories: effectiveMarketingFeeCategories,
      discount_type: discountType,
      discount_value: discountValue,
      is_tax_enabled: isTaxEnabled,
      timeline_config: {
        total_weeks: totalWeeks,
        start_date: startDate || null,
        milestones,
      },
      maintenance_billing_mode: maintenanceBillingMode,
      payment_terms: paymentTerms,
      validity_days: validityDays,
      notes,
      revision_notes: isRevisionMode ? revisionNotes : undefined,
    };

    try {
      const url = isRevisionMode ? `/api/commercial/${editId}` : '/api/commercial';
      const method = isRevisionMode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.proposal) {
        router.push(`/commercial/${data.proposal.id}/print`);
      } else {
        setErrorMessage(data.error || 'Gagal menyimpan proposal komersial.');
      }
    } catch {
      setErrorMessage('Terjadi kesalahan jaringan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableProjects = projects.filter((p) =>
    selectedCompanyId ? p.company_id === selectedCompanyId : true
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', paddingBottom: '120px' }}>
      <main style={{ maxWidth: '1360px', margin: '0 auto', padding: '24px' }}>
        {/* Header Breadcrumb */}
        <div style={{ marginBottom: '24px' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1
                style={{
                  fontSize: '24px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                  margin: 0,
                }}
              >
                {isRevisionMode
                  ? `Revisi Proposal: ${existingProposalNumber} (v${existingVersion} → v${existingVersion + 1})`
                  : 'Buat Kalkulasi Komersial & Proposal Klien'}
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                Kalkulasi dua arah (Rupiah ↔ Persentase): nilai Grand Total dan nominal Termin dapat diedit bebas dan tersinkronisasi otomatis.
              </p>
            </div>
            <div
              className="linear-badge"
              style={{
                fontSize: '12px',
                padding: '6px 12px',
                background: isRevisionMode ? 'rgba(94, 106, 210, 0.2)' : undefined,
                color: isRevisionMode ? '#a5b4fc' : undefined,
              }}
            >
              {isRevisionMode ? `Mode Revisi v${existingVersion + 1}` : 'Dynamic Two-Way Pricing'}
            </div>
          </div>
        </div>

        {/* Revision Banner if in Edit Mode */}
        {isRevisionMode && (
          <div
            className="linear-card"
            style={{
              padding: '16px 20px',
              marginBottom: '24px',
              background: 'rgba(94, 106, 210, 0.08)',
              border: '1px solid rgba(94, 106, 210, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent-hover)', fontWeight: 600 }}>
                Catatan Revisi Versi Baru
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '2px' }}>
                Dokumen Induk: <strong>{existingProposalNumber}</strong> (Versi aktif saat ini: v{existingVersion})
              </div>
            </div>

            <div style={{ flex: 1, minWidth: '280px' }}>
              <input
                type="text"
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
                placeholder="Tuliskan alasan revisi (misal: Negosiasi nilai penawaran, revisi termin)..."
                className="linear-input"
                style={{ width: '100%' }}
                required
              />
            </div>
          </div>
        )}

        {errorMessage && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              fontSize: '13px',
              marginBottom: '20px',
            }}
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* STEP 1: Seleksi Berjenjang (Company -> Project -> Estimate) */}
          <section className="linear-card" style={{ padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'var(--accent-hover)',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                1
              </span>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Pemilihan Dokumen Baseline (Perusahaan, Proyek, & Estimasi)
                </h2>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  Pilih rujukan estimasi biaya teknis yang akan dihitung harga penawaran komersialnya
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '16px',
              }}
            >
              {/* 1. Perusahaan / Klien */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Perusahaan / Klien <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <select
                  className="linear-select"
                  value={selectedCompanyId}
                  onChange={handleCompanyChange}
                  required
                >
                  <option value="">-- Pilih Perusahaan --</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Proyek */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Proyek Terkait <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <select
                  className="linear-select"
                  value={selectedProjectId}
                  onChange={handleProjectChange}
                  disabled={!selectedCompanyId}
                  required
                >
                  <option value="">
                    {!selectedCompanyId ? '-- Pilih Perusahaan Terlebih Dahulu --' : '-- Pilih Proyek --'}
                  </option>
                  {availableProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Dokumen Estimasi */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Dokumen Estimasi Baseline <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <select
                  className="linear-select"
                  value={selectedEstimateId}
                  onChange={handleEstimateChange}
                  disabled={!selectedProjectId}
                  required
                >
                  <option value="">
                    {!selectedProjectId ? '-- Pilih Proyek Terlebih Dahulu --' : '-- Pilih Dokumen Estimasi --'}
                  </option>
                  {estimates.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title} (v{e.version}) - {formatIDR(e.total_cost)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Baseline COGS Summary Card */}
            {isLoadingEstimate ? (
              <div style={{ marginTop: '16px', padding: '16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                Memuat rincian baseline estimasi...
              </div>
            ) : activeEstimate && (
              <div
                style={{
                  marginTop: '18px',
                  padding: '16px 20px',
                  borderRadius: '8px',
                  background: 'rgba(94, 106, 210, 0.08)',
                  border: '1px solid rgba(94, 106, 210, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--accent-hover)', fontWeight: 600 }}>
                    Dokumen Baseline Terpilih
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {activeEstimate.title} <span className="linear-badge" style={{ marginLeft: '6px' }}>v{activeEstimate.version}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
                    Total WBS: {activeEstimate.total_hours} Jam Kerja Manhour
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Total Biaya Modal (COGS Internal)</div>
                    <div className="font-mono-numbers" style={{ fontSize: '18px', fontWeight: 700, color: '#38bdf8' }}>
                      {formatIDR(totals.cogs)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* STEP 2: Formula Komersial & Pricing Engine (Two-Way Reactive) */}
          <section className="linear-card" style={{ padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'var(--accent-hover)',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                2
              </span>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Kalkulasi Komersial (Dua Arah: Rupiah ↔ Persentase)
                </h2>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  Atur margin atau harga dasar per kategori (Development, Maintenance, Operasional, Infrastruktur). Diskon dan PPN berlaku satu kali untuk total.
                </div>
              </div>
            </div>

            {/* Harga per Kategori: margin & harga dasar diatur per kategori */}
            <div style={{ marginBottom: '20px', overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
              <table className="linear-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Kategori</th>
                    <th style={{ textAlign: 'right' }}>COGS Internal</th>
                    <th style={{ textAlign: 'right', width: '140px' }}>Margin (%)</th>
                    <th style={{ textAlign: 'right', width: '220px' }}>Harga Dasar (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  {presentCategories.length === 0 && (
                    <tr><td colSpan={4} style={{ color: 'var(--text-tertiary)' }}>Pilih estimasi untuk menampilkan kategori biaya.</td></tr>
                  )}
                  {presentCategories.map((cat) => {
                    const line = categoryPricing[cat];
                    if (!line) return null;
                    return (
                      <tr key={cat}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{CATEGORY_LABELS[cat]}</td>
                        <td className="font-mono-numbers" style={{ textAlign: 'right', color: '#38bdf8' }}>{formatIDR(line.cogs)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            min="0"
                            max="99.99"
                            step="any"
                            aria-label={`Margin ${CATEGORY_LABELS[cat]}`}
                            value={line.margin_percent}
                            onChange={(e) => handleCategoryMarginChange(cat, parseFloat(e.target.value) || 0)}
                            className="linear-input font-mono-numbers"
                            style={{ textAlign: 'right', fontWeight: 600, width: '110px' }}
                          />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            aria-label={`Harga dasar ${CATEGORY_LABELS[cat]}`}
                            value={line.base_price}
                            onChange={(e) => handleCategoryPriceChange(cat, parseFloat(e.target.value) || 0)}
                            className="linear-input font-mono-numbers"
                            style={{ textAlign: 'right', fontWeight: 600, width: '190px' }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {presentCategories.length > 0 && (
                  <tfoot>
                    <tr>
                      <td style={{ fontWeight: 700 }}>Total</td>
                      <td className="font-mono-numbers" style={{ textAlign: 'right', fontWeight: 700, color: '#38bdf8' }}>{formatIDR(totals.cogs)}</td>
                      <td className="font-mono-numbers" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-hover)' }}>{totals.margin_percent}%</td>
                      <td className="font-mono-numbers" style={{ textAlign: 'right', fontWeight: 700 }}>{formatIDR(totals.base_price)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Input Controls Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '18px',
                marginBottom: '20px',
              }}
            >
              {/* Configurable marketing fee, calculated on total category base price */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Fee Marketing (% dari total harga dasar)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  value={marketingFeePercent}
                  onChange={(e) => {
                    const value = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                    setMarketingFeePercent(value);
                    syncTermsFromGrandTotal(computeTotals(categoryPricing, { ...discountOpts, marketingFeePercent: value }).grand_total);
                  }}
                  className="linear-input font-mono-numbers"
                  aria-label="Fee marketing persentase"
                />
                <select
                  className="linear-select"
                  aria-label="Mode fee marketing"
                  value={marketingFeeMode}
                  onChange={(e) => {
                    const mode = e.target.value as 'ALL_PROPORTIONAL' | 'SELECTED_ONLY';
                    setMarketingFeeMode(mode);
                    const cats = mode === 'ALL_PROPORTIONAL' ? presentCategories : marketingFeeCategories;
                    syncTermsFromGrandTotal(computeTotals(categoryPricing, { ...discountOpts, marketingFeeCategories: cats }).grand_total);
                  }}
                  style={{ width: '100%', marginTop: '8px' }}
                >
                  <option value="ALL_PROPORTIONAL">Proporsional ke semua kategori</option>
                  <option value="SELECTED_ONLY">Pasang di kategori tertentu</option>
                </select>
                {marketingFeeMode === 'SELECTED_ONLY' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
                    {presentCategories.map((cat) => (
                      <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <input
                          type="checkbox"
                          checked={marketingFeeCategories.includes(cat)}
                          onChange={(e) => {
                            const cats = e.target.checked ? [...marketingFeeCategories, cat] : marketingFeeCategories.filter((c) => c !== cat);
                            setMarketingFeeCategories(cats);
                            syncTermsFromGrandTotal(computeTotals(categoryPricing, { ...discountOpts, marketingFeeCategories: cats }).grand_total);
                          }}
                        />
                        {CATEGORY_LABELS[cat]}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {/* Tipe & Nilai Diskon */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Diskon Penawaran
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    className="linear-select"
                    value={discountType}
                    onChange={(e) => handleDiscountTypeChange(e.target.value as 'PERCENTAGE' | 'NOMINAL')}
                    style={{ width: '110px' }}
                  >
                    <option value="PERCENTAGE">%</option>
                    <option value="NOMINAL">Rp</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    value={discountValue}
                    onChange={(e) => handleDiscountValueChange(parseFloat(e.target.value) || 0)}
                    className="linear-input font-mono-numbers"
                    style={{ textAlign: 'right', flex: 1 }}
                  />
                </div>
              </div>

              {/* Toggle PPN 11% */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Pajak Pertambahan Nilai (PPN)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)', marginTop: '4px' }}>
                  <input
                    type="checkbox"
                    checked={isTaxEnabled}
                    onChange={(e) => handleTaxToggle(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--accent-hover)' }}
                  />
                  <span>Kenakan PPN 11%</span>
                </label>
              </div>
            </div>

            {/* Direct Editable Grand Total (Total Penawaran Klien) */}
            <div
              style={{
                marginBottom: '20px',
                padding: '16px 20px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.06)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div>
                <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#10b981', fontWeight: 700 }}>
                  Total Penawaran Klien / Quotation Grand Total (Dapat Diedit Langsung)
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Ketik nominal harga deal/negosiasi di sini; harga dasar tiap kategori diskalakan proporsional dan margin dihitung mundur
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#10b981' }}>Rp</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={grandTotal}
                  onChange={(e) => handleGrandTotalChange(parseFloat(e.target.value) || 0)}
                  className="linear-input font-mono-numbers"
                  style={{
                    width: '240px',
                    fontSize: '18px',
                    fontWeight: 700,
                    textAlign: 'right',
                    color: '#10b981',
                    borderColor: 'rgba(16, 185, 129, 0.4)',
                    background: 'rgba(16, 185, 129, 0.05)',
                  }}
                />
              </div>
            </div>

            {/* Financial Summary Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                padding: '18px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                  Harga Dasar (Base Price)
                </div>
                <div className="font-mono-numbers" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {formatIDR(totals.base_price)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                  Potongan Diskon
                </div>
                <div className="font-mono-numbers" style={{ fontSize: '15px', fontWeight: 600, color: '#f59e0b', marginTop: '4px' }}>
                  -{formatIDR(currentDiscountAmount)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                  Subtotal Bersih
                </div>
                <div className="font-mono-numbers" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {formatIDR(currentSubtotal)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                  PPN 11%
                </div>
                <div className="font-mono-numbers" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '4px' }}>
                  +{formatIDR(currentTaxAmount)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent-hover)', fontWeight: 600 }}>
                  Proyeksi Gross Profit
                </div>
                <div className="font-mono-numbers" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-hover)', marginTop: '4px' }}>
                  +{formatIDR(grossProfit)} <span style={{ fontSize: '11px', fontWeight: 500 }}>({grossProfitPercent}%)</span>
                </div>
              </div>
            </div>
          </section>

          {/* STEP 3: Delivery Timeline Setup (Editable) */}
          <section className="linear-card" style={{ padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'var(--accent-hover)',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  3
                </span>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    Delivery Timeline Setup (Jadwal & Milestone Kerja)
                  </h2>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    Baseline durasi waktu kalender dan tahapan serah terima luaran fitur
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={addMilestone}
                className="btn-secondary"
                style={{ fontSize: '12px', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span>+</span>
                <span>Tambah Milestone</span>
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                padding: '16px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                marginBottom: '18px',
              }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '6px' }}>
                  Total Durasi Kalender
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min="1"
                    value={totalWeeks}
                    onChange={(e) => setTotalWeeks(Math.max(1, parseInt(e.target.value) || 1))}
                    className="linear-input font-mono-numbers"
                    style={{ width: '100px', textAlign: 'center', fontWeight: 600 }}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Minggu Kalender</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '6px' }}>
                  Target Mulai (Opsional)
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="linear-input"
                  style={{ maxWidth: '200px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '4px' }}>
                  Akumulasi Durasi Milestone
                </div>
                <div className="font-mono-numbers" style={{ fontSize: '15px', fontWeight: 600, color: '#38bdf8' }}>
                  {milestones.reduce((acc, m) => acc + (Number(m.duration_weeks) || 0), 0)} Minggu
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: '6px' }}>
                    ({milestones.length} Tahapan)
                  </span>
                </div>
              </div>
            </div>

            {/* Milestones Excel Table */}
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
              <table className="excel-table">
                <thead>
                  <tr>
                    <th style={{ width: '45px', textAlign: 'center' }}>No</th>
                    <th style={{ minWidth: '240px', textAlign: 'left' }}>Tahapan / Fase Kerja</th>
                    <th style={{ width: '140px', textAlign: 'center' }}>Durasi (Minggu)</th>
                    <th style={{ minWidth: '320px', textAlign: 'left' }}>Deliverable / Hasil Luaran</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {milestones.map((m, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>{idx + 1}</td>
                      <td>
                        <input
                          type="text"
                          value={m.phase}
                          placeholder="Nama fase pengerjaan..."
                          onChange={(e) => handleMilestoneChange(idx, 'phase', e.target.value)}
                          className="excel-cell-input"
                          style={{ fontWeight: 500 }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number"
                          min="1"
                          value={m.duration_weeks}
                          onChange={(e) => handleMilestoneChange(idx, 'duration_weeks', Math.max(1, parseInt(e.target.value) || 1))}
                          className="excel-cell-input font-mono-numbers"
                          style={{ textAlign: 'center', fontWeight: 600 }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={m.deliverable}
                          placeholder="Deskripsi luaran / deliverables..."
                          onChange={(e) => handleMilestoneChange(idx, 'deliverable', e.target.value)}
                          className="excel-cell-input"
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => removeMilestone(idx)}
                          className="btn-ghost"
                          style={{
                            color: 'var(--color-danger)',
                            padding: '4px 8px',
                            fontSize: '12px',
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          disabled={milestones.length <= 1}
                          title="Hapus Milestone"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* STEP 4: Skema Termin Pembayaran (Editable Rupiah ↔ Persentase) */}
          <section className="linear-card" style={{ padding: '24px', marginBottom: '24px' }}>
            {/* Toggle Billing Mode Maintenance & Cloud */}
            <div
              style={{
                marginBottom: '20px',
                padding: '14px 16px',
                borderRadius: '8px',
                background: 'rgba(94, 106, 210, 0.08)',
                border: '1px solid rgba(94, 106, 210, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Skema Penagihan Maintenance & Cloud Hosting
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  Pilih apakah biaya maintenance & infra disatukan di termin proyek atau ditagih bulanan setelah go-live.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setMaintenanceBillingMode('ALL_IN_PROJECT')}
                  className={maintenanceBillingMode === 'ALL_IN_PROJECT' ? 'btn-primary' : 'btn-secondary'}
                  style={{ fontSize: '11.5px', padding: '6px 12px', borderRadius: '6px' }}
                >
                  ✓ Dibayar Sekaligus (All-in di Termin Proyek)
                </button>
                <button
                  type="button"
                  onClick={() => setMaintenanceBillingMode('MONTHLY_RETAINER')}
                  className={maintenanceBillingMode === 'MONTHLY_RETAINER' ? 'btn-primary' : 'btn-secondary'}
                  style={{ fontSize: '11.5px', padding: '6px 12px', borderRadius: '6px' }}
                >
                  Ditagih Terpisah per Bulan (Post-Launch Retainer)
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'var(--accent-hover)',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  4
                </span>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    Skema Termin Pembayaran (Edit Bebas: Nominal Rp ↔ Persentase %)
                  </h2>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    Ketik nominal rupiah ataupun persentase pada masing-masing termin; kedua nilai saling menghitung otomatis
                  </div>
                </div>
              </div>

              {/* Preset Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Preset:</span>
                <button
                  type="button"
                  onClick={() => applyPaymentPreset('3_TERMS')}
                  className="btn-secondary"
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                >
                  30% / 50% / 20%
                </button>
                <button
                  type="button"
                  onClick={() => applyPaymentPreset('2_TERMS')}
                  className="btn-secondary"
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                >
                  50% / 50%
                </button>
                <button
                  type="button"
                  onClick={() => applyPaymentPreset('FULL')}
                  className="btn-secondary"
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                >
                  100% Full
                </button>
                <button
                  type="button"
                  onClick={addTerm}
                  className="btn-secondary"
                  style={{ fontSize: '11px', padding: '4px 10px', marginLeft: '6px' }}
                >
                  + Tambah Baris
                </button>
              </div>
            </div>

            {/* Validation & Balance Indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '14px',
                padding: '10px 14px',
                borderRadius: '6px',
                background: Math.abs(termDiff) <= 100 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                border: `1px solid ${Math.abs(termDiff) <= 100 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Akumulasi Termin: <strong>{formatIDR(totalTermAmount)}</strong> dari Target Penawaran <strong>{formatIDR(grandTotal)}</strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span
                  className="font-mono-numbers"
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: Math.abs(totalTermPercent - 100) <= 0.1 ? '#10b981' : '#f59e0b',
                  }}
                >
                  Total Bobot: {totalTermPercent.toFixed(1)}% {Math.abs(totalTermPercent - 100) <= 0.1 ? '✓' : ''}
                </span>

                <span
                  className="font-mono-numbers"
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: Math.abs(termDiff) <= 100 ? '#10b981' : '#f59e0b',
                  }}
                >
                  {Math.abs(termDiff) <= 100 ? 'Balance Pas ✓' : `Selisih: ${termDiff > 0 ? '-' : '+'}${formatIDR(Math.abs(termDiff))}`}
                </span>
              </div>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
              <table className="excel-table">
                <thead>
                  <tr>
                    <th style={{ width: '45px', textAlign: 'center' }}>No</th>
                    <th style={{ minWidth: '220px', textAlign: 'left' }}>Nama Termin / Tahap Tagihan</th>
                    <th style={{ width: '130px', textAlign: 'center' }}>Bobot (%)</th>
                    <th style={{ width: '200px', textAlign: 'right' }}>Nominal Rupiah (Rp)</th>
                    <th style={{ minWidth: '300px', textAlign: 'left' }}>Kondisi / Syarat Penagihan</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentTerms.map((t, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>{idx + 1}</td>
                      <td>
                        <input
                          type="text"
                          value={t.milestone_name}
                          placeholder="Nama termin..."
                          onChange={(e) => handleTermFieldChange(idx, 'milestone_name', e.target.value)}
                          className="excel-cell-input"
                          style={{ fontWeight: 500 }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="any"
                            value={t.percent}
                            onChange={(e) => handleTermPercentChange(idx, parseFloat(e.target.value) || 0)}
                            className="excel-cell-input font-mono-numbers"
                            style={{ textAlign: 'center', width: '65px', fontWeight: 600 }}
                          />
                          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', paddingRight: '6px' }}>%</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%', paddingRight: '8px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginRight: '4px' }}>Rp</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={t.amount}
                            onChange={(e) => handleTermAmountChange(idx, parseFloat(e.target.value) || 0)}
                            className="excel-cell-input font-mono-numbers"
                            style={{
                              textAlign: 'right',
                              fontWeight: 600,
                              color: '#10b981',
                              width: '140px',
                            }}
                          />
                        </div>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={t.trigger_condition}
                          placeholder="Syarat penagihan / dokumen BAST..."
                          onChange={(e) => handleTermFieldChange(idx, 'trigger_condition', e.target.value)}
                          className="excel-cell-input"
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => removeTerm(idx)}
                          className="btn-ghost"
                          style={{
                            color: 'var(--color-danger)',
                            padding: '4px 8px',
                            fontSize: '12px',
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          disabled={paymentTerms.length <= 1}
                          title="Hapus Termin"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* STEP 5: Validitas & Catatan Proposal */}
          <section className="linear-card" style={{ padding: '24px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>
              Pengaturan Tambahan & Syarat Penawaran
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Masa Berlaku Penawaran
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={validityDays}
                    onChange={(e) => setValidityDays(parseInt(e.target.value) || 30)}
                    className="linear-input font-mono-numbers"
                    style={{ width: '100px', textAlign: 'center', fontWeight: 600 }}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Hari sejak diterbitkan</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Catatan / Syarat & Ketentuan Khusus Penawaran
                </label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="linear-textarea"
                  placeholder="Contoh: Garansi bug 3 bulan setelah UAT, termin pembayaran 14 hari kerja..."
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
            </div>
          </section>

          {/* Sticky Bottom Summary Action Bar */}
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 40,
              background: 'var(--bg-panel)',
              backdropFilter: 'blur(16px)',
              borderTop: '1px solid var(--border-subtle)',
              padding: '14px 24px',
              boxShadow: '0 -10px 30px rgba(0, 0, 0, 0.12)',
            }}
          >
            <div
              style={{
                maxWidth: '1360px',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>COGS Internal</div>
                  <div className="font-mono-numbers" style={{ fontSize: '14px', fontWeight: 600, color: '#38bdf8' }}>
                    {formatIDR(totals.cogs)}
                  </div>
                </div>

                <div style={{ height: '24px', width: '1px', background: 'var(--border-subtle)' }} />

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Margin Efektif</div>
                  <div className="font-mono-numbers" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent-hover)' }}>
                    +{totals.margin_percent}%
                  </div>
                </div>

                <div style={{ height: '24px', width: '1px', background: 'var(--border-subtle)' }} />

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Grand Total Penawaran Deal</div>
                  <div className="font-mono-numbers" style={{ fontSize: '18px', fontWeight: 700, color: '#10b981' }}>
                    {formatIDR(grandTotal)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Link
                  href="/commercial"
                  className="btn-secondary"
                  style={{ textDecoration: 'none', padding: '8px 16px' }}
                >
                  Batal
                </Link>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedEstimateId}
                  className="btn-primary"
                  style={{ minWidth: '240px', padding: '10px 24px', fontSize: '13px' }}
                >
                  {isSubmitting
                    ? 'Menyimpan Revisi...'
                    : isRevisionMode
                    ? `Simpan Revisi Versi (v${existingVersion + 1})`
                    : 'Simpan & Buka Proposal Cetak'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}

export default function NewCommercialProposalPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>Memuat formulir proposal...</div>}>
      <NewCommercialProposalForm />
    </Suspense>
  );
}
