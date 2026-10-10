'use client';

import { Suspense } from 'react';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

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
  billing_summary?: {
    total_one_time?: number;
    one_time_dev?: number;
    one_time_infra?: number;
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
  const [cogsAmount, setCogsAmount] = useState<number>(0);
  const [marginPercent, setMarginPercent] = useState<number>(30);
  const [basePrice, setBasePrice] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'NOMINAL'>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [isTaxEnabled, setIsTaxEnabled] = useState<boolean>(true);
  const [grandTotal, setGrandTotal] = useState<number>(0);

  // Delivery Timeline States (Prefilled & editable)
  const [totalWeeks, setTotalWeeks] = useState<number>(4);
  const [startDate, setStartDate] = useState<string>('');
  const [milestones, setMilestones] = useState<Milestone[]>([
    { phase: 'Requirement & UI/UX Design', duration_weeks: 1, deliverable: 'Design Prototype & SRS Sign-off' },
    { phase: 'Core Development & Integration', duration_weeks: 2, deliverable: 'Staging Application & API Ready' },
    { phase: 'UAT, Deployment & Go-Live', duration_weeks: 1, deliverable: 'Production Deployment & BAST' },
  ]);

  // Payment Terms (Milestones)
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

  // Helper: calculate discount amount from basePrice
  const calcDiscount = (base: number, type: 'PERCENTAGE' | 'NOMINAL', val: number) => {
    if (type === 'PERCENTAGE') {
      return Math.round(base * (Math.min(Math.max(val, 0), 100) / 100));
    }
    return Math.min(Math.max(val, 0), base);
  };

  // 1. When Margin % changes (Forward Calculation)
  const handleMarginChange = (newMargin: number) => {
    setMarginPercent(newMargin);
    const mFrac = Math.min(Math.max(newMargin, 0), 99.99) / 100;
    const newBase = mFrac < 1 ? Math.round(cogsAmount / (1 - mFrac)) : cogsAmount;
    setBasePrice(newBase);

    const disc = calcDiscount(newBase, discountType, discountValue);
    const subtotal = Math.max(0, newBase - disc);
    const tax = isTaxEnabled ? Math.round(subtotal * 0.11) : 0;
    const newGT = subtotal + tax;
    setGrandTotal(newGT);
    syncTermsFromGrandTotal(newGT);
  };

  // 2. When Base Price changes directly (Forward Calculation with reverse Margin)
  const handleBasePriceChange = (newBase: number) => {
    setBasePrice(newBase);
    const calculatedMargin = newBase > 0
      ? Number((((newBase - cogsAmount) / newBase) * 100).toFixed(2))
      : 0;
    setMarginPercent(calculatedMargin);

    const disc = calcDiscount(newBase, discountType, discountValue);
    const subtotal = Math.max(0, newBase - disc);
    const tax = isTaxEnabled ? Math.round(subtotal * 0.11) : 0;
    const newGT = subtotal + tax;
    setGrandTotal(newGT);
    syncTermsFromGrandTotal(newGT);
  };

  // 3. When Grand Total changes directly (Reverse Calculation back to Subtotal, BasePrice & Margin)
  const handleGrandTotalChange = (newGT: number) => {
    setGrandTotal(newGT);

    let subtotal = newGT;
    if (isTaxEnabled) {
      subtotal = Math.round(newGT / 1.11);
    }

    let calculatedBase = subtotal;
    if (discountType === 'PERCENTAGE' && discountValue > 0 && discountValue < 100) {
      calculatedBase = Math.round(subtotal / (1 - discountValue / 100));
    } else if (discountType === 'NOMINAL') {
      calculatedBase = subtotal + discountValue;
    }
    setBasePrice(calculatedBase);

    const calculatedMargin = calculatedBase > 0
      ? Number((((calculatedBase - cogsAmount) / calculatedBase) * 100).toFixed(2))
      : 0;
    setMarginPercent(calculatedMargin);
    syncTermsFromGrandTotal(newGT);
  };

  // 4. When Discount or Tax toggles change
  const handleDiscountTypeChange = (newType: 'PERCENTAGE' | 'NOMINAL') => {
    setDiscountType(newType);
    const disc = calcDiscount(basePrice, newType, discountValue);
    const subtotal = Math.max(0, basePrice - disc);
    const tax = isTaxEnabled ? Math.round(subtotal * 0.11) : 0;
    const newGT = subtotal + tax;
    setGrandTotal(newGT);
    syncTermsFromGrandTotal(newGT);
  };

  const handleDiscountValueChange = (newVal: number) => {
    setDiscountValue(newVal);
    const disc = calcDiscount(basePrice, discountType, newVal);
    const subtotal = Math.max(0, basePrice - disc);
    const tax = isTaxEnabled ? Math.round(subtotal * 0.11) : 0;
    const newGT = subtotal + tax;
    setGrandTotal(newGT);
    syncTermsFromGrandTotal(newGT);
  };

  const handleTaxToggle = (checked: boolean) => {
    setIsTaxEnabled(checked);
    const disc = calcDiscount(basePrice, discountType, discountValue);
    const subtotal = Math.max(0, basePrice - disc);
    const tax = checked ? Math.round(subtotal * 0.11) : 0;
    const newGT = subtotal + tax;
    setGrandTotal(newGT);
    syncTermsFromGrandTotal(newGT);
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
  const currentDiscountAmount = calcDiscount(basePrice, discountType, discountValue);
  const currentSubtotal = Math.max(0, basePrice - currentDiscountAmount);
  const currentTaxAmount = isTaxEnabled ? grandTotal - currentSubtotal : 0;
  const grossProfit = currentSubtotal - cogsAmount;
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

          const cogs = Number(p.cogs_amount) || 0;
          const base = Number(p.base_price) || 0;
          const gt = Number(p.grand_total) || 0;
          const mPercent = Number(p.margin_percent) || 30;

          setCogsAmount(cogs);
          setBasePrice(base);
          setGrandTotal(gt);
          setMarginPercent(mPercent);
          setDiscountType(p.discount_type || 'PERCENTAGE');
          setDiscountValue(Number(p.discount_value) || 0);
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
      setCogsAmount(0);
      setBasePrice(0);
      setGrandTotal(0);
      return;
    }

    setIsLoadingEstimate(true);
    try {
      const res = await fetch(`/api/estimates/${eid}`);
      const data = await res.json();
      if (data.success && data.estimate) {
        const est: Estimate = data.estimate;
        setActiveEstimate(est);

        const baseCogs = est.billing_summary?.grand_total || est.total_cost || 0;
        setCogsAmount(baseCogs);

        // Calculate initial base and grand total using marginPercent
        const mFrac = Math.min(Math.max(marginPercent, 0), 99.99) / 100;
        const newBase = mFrac < 1 ? Math.round(baseCogs / (1 - mFrac)) : baseCogs;
        setBasePrice(newBase);

        const disc = calcDiscount(newBase, discountType, discountValue);
        const subtotal = Math.max(0, newBase - disc);
        const tax = isTaxEnabled ? Math.round(subtotal * 0.11) : 0;
        const newGT = subtotal + tax;
        setGrandTotal(newGT);
        syncTermsFromGrandTotal(newGT);

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
  const handleMilestoneChange = (idx: number, field: keyof Milestone, val: any) => {
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
      cogs_amount: cogsAmount,
      margin_percent: marginPercent,
      base_price: basePrice,
      discount_type: discountType,
      discount_value: discountValue,
      subtotal_after_discount: currentSubtotal,
      is_tax_enabled: isTaxEnabled,
      tax_amount: currentTaxAmount,
      grand_total: grandTotal,
      timeline_config: {
        total_weeks: totalWeeks,
        start_date: startDate || null,
        milestones,
      },
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
      <main style={{ maxWidth: '1240px', margin: '0 auto', padding: '24px' }}>
        {/* Header Breadcrumb */}
        <div style={{ marginBottom: '24px' }}>
          <Link
            href="/commercial"
            style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '8px',
            }}
          >
            ← Kembali ke Daftar Proposal Penawaran
          </Link>
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
                      {formatIDR(cogsAmount)}
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
                  Edit nilai nominal Rupiah secara langsung atau atur target persentase margin; semua komponen saling tersinkronisasi otomatis
                </div>
              </div>
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
              {/* Target Margin % */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Target Profit Margin (%)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min="0"
                    max="99.99"
                    step="any"
                    value={marginPercent}
                    onChange={(e) => handleMarginChange(parseFloat(e.target.value) || 0)}
                    className="linear-input font-mono-numbers"
                    style={{ textAlign: 'right', fontWeight: 600 }}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>%</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  Terkait dengan Harga Dasar
                </div>
              </div>

              {/* Harga Dasar (Base Price) - Directly Editable */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Harga Dasar / Base Price (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={basePrice}
                  onChange={(e) => handleBasePriceChange(parseFloat(e.target.value) || 0)}
                  className="linear-input font-mono-numbers"
                  style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}
                />
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  Sebelum diskon & pajak
                </div>
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
                    onChange={(e) => handleDiscountTypeChange(e.target.value as any)}
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
                  Ketik nominal harga penawaran deal/negosiasi di sini; persentase margin & harga dasar akan terhitung mundur otomatis
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
                  {formatIDR(basePrice)}
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
                          ✕
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
                          ✕
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
              background: 'rgba(15, 16, 17, 0.95)',
              backdropFilter: 'blur(16px)',
              borderTop: '1px solid var(--border-subtle)',
              padding: '14px 24px',
              boxShadow: '0 -10px 30px rgba(0, 0, 0, 0.6)',
            }}
          >
            <div
              style={{
                maxWidth: '1240px',
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
                    {formatIDR(cogsAmount)}
                  </div>
                </div>

                <div style={{ height: '24px', width: '1px', background: 'var(--border-subtle)' }} />

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Margin Efektif</div>
                  <div className="font-mono-numbers" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent-hover)' }}>
                    +{marginPercent}%
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
                    ? `💾 Simpan Revisi Versi (v${existingVersion + 1})`
                    : '💾 Simpan & Buka Proposal Cetak'}
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
