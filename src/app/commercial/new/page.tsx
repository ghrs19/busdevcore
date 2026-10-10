'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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

export default function NewCommercialProposalPage() {
  const router = useRouter();

  // Cascade states
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);

  const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>('');
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [selectedEstimateId, setSelectedEstimateId] = useState<number | ''>('');

  const [activeEstimate, setActiveEstimate] = useState<Estimate | null>(null);
  const [isLoadingEstimate, setIsLoadingEstimate] = useState(false);

  // Commercial Pricing States
  const [cogsAmount, setCogsAmount] = useState<number>(0);
  const [marginPercent, setMarginPercent] = useState<number>(30); // Target Margin %
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'NOMINAL'>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [isTaxEnabled, setIsTaxEnabled] = useState<boolean>(true); // PPN 11%

  // Delivery Timeline States (Prefilled & editable)
  const [totalWeeks, setTotalWeeks] = useState<number>(4);
  const [startDate, setStartDate] = useState<string>('');
  const [milestones, setMilestones] = useState<Milestone[]>([
    { phase: 'Requirement & UI/UX Design', duration_weeks: 1, deliverable: 'Design Prototype & SRS' },
    { phase: 'Core Development & API Integration', duration_weeks: 2, deliverable: 'Staging Application Live' },
    { phase: 'UAT, Deployment & Go-Live', duration_weeks: 1, deliverable: 'Production Deployment & Sign-off' },
  ]);

  // Payment Terms (Milestones)
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([
    { milestone_name: 'Termin 1 (Down Payment / Kickoff)', percent: 30, amount: 0, trigger_condition: 'Penandatanganan Kontrak / SPK' },
    { milestone_name: 'Termin 2 (User Acceptance Test)', percent: 50, amount: 0, trigger_condition: 'Penyelesaian Fitur & Persetujuan Berita Acara UAT' },
    { milestone_name: 'Termin 3 (Serah Terima / Go-Live)', percent: 20, amount: 0, trigger_condition: 'Aplikasi Live di Production & BAST' },
  ]);

  const [validityDays, setValidityDays] = useState<number>(30);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  // 2. Cascade Company Change -> Reset Project & Estimate
  const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cid = e.target.value ? Number(e.target.value) : '';
    setSelectedCompanyId(cid);
    setSelectedProjectId('');
    setSelectedEstimateId('');
    setActiveEstimate(null);
  };

  // 3. Cascade Project Change -> Fetch Estimates for Project
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

  // 4. Cascade Estimate Change -> Load Estimate Detail & Prefill
  const handleEstimateChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const eid = e.target.value ? Number(e.target.value) : '';
    setSelectedEstimateId(eid);

    if (!eid) {
      setActiveEstimate(null);
      setCogsAmount(0);
      return;
    }

    setIsLoadingEstimate(true);
    try {
      const res = await fetch(`/api/estimates/${eid}`);
      const data = await res.json();
      if (data.success && data.estimate) {
        const est: Estimate = data.estimate;
        setActiveEstimate(est);

        // Set baseline COGS from grand total or total_cost
        const baseCogs = est.billing_summary?.grand_total || est.total_cost || 0;
        setCogsAmount(baseCogs);

        // Prefill Timeline if exists in estimate
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

  // 5. Calculations
  // Base Price with Margin: COGS / (1 - Margin/100)
  const marginFrac = Math.min(Math.max(marginPercent, 0), 99) / 100;
  const basePrice = marginFrac < 1 ? Math.round(cogsAmount / (1 - marginFrac)) : cogsAmount;

  // Discount calculation
  let discountAmount = 0;
  if (discountType === 'PERCENTAGE') {
    discountAmount = Math.round(basePrice * (Math.min(Math.max(discountValue, 0), 100) / 100));
  } else {
    discountAmount = Math.min(Math.max(discountValue, 0), basePrice);
  }

  const subtotalAfterDiscount = Math.max(0, basePrice - discountAmount);
  const taxAmount = isTaxEnabled ? Math.round(subtotalAfterDiscount * 0.11) : 0;
  const grandTotal = subtotalAfterDiscount + taxAmount;
  const grossProfit = subtotalAfterDiscount - cogsAmount;
  const grossProfitPercent = subtotalAfterDiscount > 0 ? ((grossProfit / subtotalAfterDiscount) * 100).toFixed(1) : '0';

  // Update payment terms nominal amounts based on current Grand Total
  useEffect(() => {
    setPaymentTerms((prev) =>
      prev.map((term) => ({
        ...term,
        amount: Math.round((grandTotal * term.percent) / 100),
      }))
    );
  }, [grandTotal]);

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
      { phase: `Fase ${prev.length + 1}`, duration_weeks: 1, deliverable: 'Deliverable' },
    ]);
  };

  const removeMilestone = (idx: number) => {
    if (milestones.length <= 1) return;
    setMilestones((prev) => prev.filter((_, i) => i !== idx));
  };

  // Payment Term actions
  const handleTermChange = (idx: number, field: keyof PaymentTerm, val: any) => {
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

  // Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId || !selectedProjectId || !selectedEstimateId) {
      setErrorMessage('Pilih Perusahaan, Proyek, dan Estimasi terlebih dahulu.');
      return;
    }

    // Verify payment term percentages sum up to 100%
    const totalTermPercent = paymentTerms.reduce((sum, t) => sum + Number(t.percent || 0), 0);
    if (totalTermPercent !== 100) {
      if (!confirm(`Total persentase termin saat ini adalah ${totalTermPercent}%. Lanjutkan simpan?`)) {
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
      subtotal_after_discount: subtotalAfterDiscount,
      is_tax_enabled: isTaxEnabled,
      tax_amount: taxAmount,
      grand_total: grandTotal,
      timeline_config: {
        total_weeks: totalWeeks,
        start_date: startDate || null,
        milestones,
      },
      payment_terms: paymentTerms,
      validity_days: validityDays,
      notes,
    };

    try {
      const res = await fetch('/api/commercial', {
        method: 'POST',
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

  // Filter projects by selected company
  const availableProjects = projects.filter((p) =>
    selectedCompanyId ? p.company_id === selectedCompanyId : true
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', paddingBottom: '90px' }}>
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
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
              gap: '4px',
              marginBottom: '8px',
            }}
          >
            ← Kembali ke Daftar Proposal Penawaran
          </Link>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Buat Kalkulasi Komersial & Proposal Klien
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            Hubungkan baseline estimasi teknis dengan formula komersial, margin laba, diskon, timeline, dan termin pembayaran
          </p>
        </div>

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
          <section className="linear-card" style={{ padding: '22px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
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
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Pemilihan Dokumen Baseline (Perusahaan, Proyek, & Estimasi)
              </h2>
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
                  className="input-field"
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
                  className="input-field"
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
                  className="input-field"
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
                    Baseline Estimasi Terpilih
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {activeEstimate.title} <span className="linear-badge">v{activeEstimate.version}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    Total WBS: {activeEstimate.total_hours} Jam Kerja
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Total Biaya Modal (COGS)</div>
                    <div className="font-mono-numbers" style={{ fontSize: '18px', fontWeight: 700, color: '#38bdf8' }}>
                      {formatIDR(cogsAmount)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* STEP 2: Formula Komersial & Target Margin */}
          <section className="linear-card" style={{ padding: '22px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
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
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Kalkulasi Komersial (Target Margin, Diskon, & PPN)
              </h2>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '18px',
                marginBottom: '20px',
              }}
            >
              {/* Target Margin */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Target Profit Margin (%)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min="0"
                    max="90"
                    step="0.5"
                    value={marginPercent}
                    onChange={(e) => setMarginPercent(parseFloat(e.target.value) || 0)}
                    className="input-field"
                    style={{ textAlign: 'right' }}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>%</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  Formula: COGS ÷ (1 - Margin%)
                </div>
              </div>

              {/* Tipe Diskon */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Tipe Diskon Penawaran
                </label>
                <select
                  className="input-field"
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as any)}
                >
                  <option value="PERCENTAGE">Persentase (%)</option>
                  <option value="NOMINAL">Nominal Tetap (Rp)</option>
                </select>
              </div>

              {/* Nilai Diskon */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Nilai Diskon {discountType === 'PERCENTAGE' ? '(%)' : '(Rp)'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                  className="input-field"
                  style={{ textAlign: 'right' }}
                />
              </div>

              {/* Toggle PPN 11% */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Pajak Pertambahan Nilai (PPN)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={isTaxEnabled}
                    onChange={(e) => setIsTaxEnabled(e.target.checked)}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <span>Kenakan PPN 11%</span>
                </label>
              </div>
            </div>

            {/* Comparison Cards: Modal COGS vs Penawaran Final */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                padding: '16px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Harga Dasar (Base Price)</div>
                <div className="font-mono-numbers" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {formatIDR(basePrice)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Potongan Diskon</div>
                <div className="font-mono-numbers" style={{ fontSize: '16px', fontWeight: 600, color: '#f59e0b', marginTop: '2px' }}>
                  -{formatIDR(discountAmount)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>PPN 11%</div>
                <div className="font-mono-numbers" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '2px' }}>
                  +{formatIDR(taxAmount)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>Total Penawaran Klien (Quotation)</div>
                <div className="font-mono-numbers" style={{ fontSize: '20px', fontWeight: 700, color: '#10b981', marginTop: '2px' }}>
                  {formatIDR(grandTotal)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--accent-hover)', fontWeight: 600 }}>Proyeksi Gross Profit</div>
                <div className="font-mono-numbers" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-hover)', marginTop: '2px' }}>
                  +{formatIDR(grossProfit)} ({grossProfitPercent}%)
                </div>
              </div>
            </div>
          </section>

          {/* STEP 3: Delivery Timeline Setup (Editable) */}
          <section className="linear-card" style={{ padding: '22px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Delivery Timeline Setup (Jadwal & Milestone Kerja)
                </h2>
              </div>

              <button
                type="button"
                onClick={addMilestone}
                className="btn-secondary"
                style={{ fontSize: '11px', padding: '4px 10px' }}
              >
                + Tambah Milestone
              </button>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <div style={{ width: '180px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Total Durasi Kalender
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min="1"
                    value={totalWeeks}
                    onChange={(e) => setTotalWeeks(parseInt(e.target.value) || 1)}
                    className="input-field"
                    style={{ textAlign: 'right' }}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Minggu</span>
                </div>
              </div>

              <div style={{ width: '220px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Target Mulai (Opsional)
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>

            {/* Milestones Table */}
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
              <table className="excel-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                    <th style={{ minWidth: '220px', textAlign: 'left' }}>Tahapan / Fase Kerja</th>
                    <th style={{ width: '130px', textAlign: 'center' }}>Durasi (Minggu)</th>
                    <th style={{ minWidth: '280px', textAlign: 'left' }}>Deliverable / Hasil Luaran</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {milestones.map((m, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>{idx + 1}</td>
                      <td>
                        <input
                          type="text"
                          value={m.phase}
                          onChange={(e) => handleMilestoneChange(idx, 'phase', e.target.value)}
                          className="input-field"
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number"
                          min="1"
                          value={m.duration_weeks}
                          onChange={(e) => handleMilestoneChange(idx, 'duration_weeks', parseInt(e.target.value) || 1)}
                          className="input-field"
                          style={{ width: '80px', textAlign: 'center', margin: '0 auto' }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={m.deliverable}
                          onChange={(e) => handleMilestoneChange(idx, 'deliverable', e.target.value)}
                          className="input-field"
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => removeMilestone(idx)}
                          className="btn-ghost"
                          style={{ color: 'var(--color-danger)', padding: '2px 6px', fontSize: '11px' }}
                          disabled={milestones.length <= 1}
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

          {/* STEP 4: Skema Termin Pembayaran (Term of Payment) */}
          <section className="linear-card" style={{ padding: '22px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Skema Termin Pembayaran (Payment Milestones)
                </h2>
              </div>

              <button
                type="button"
                onClick={addTerm}
                className="btn-secondary"
                style={{ fontSize: '11px', padding: '4px 10px' }}
              >
                + Tambah Termin
              </button>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
              <table className="excel-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                    <th style={{ minWidth: '220px', textAlign: 'left' }}>Nama Termin / Tahap Tagihan</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>Bobot (%)</th>
                    <th style={{ width: '160px', textAlign: 'right' }}>Nominal (Rp)</th>
                    <th style={{ minWidth: '280px', textAlign: 'left' }}>Kondisi / Syarat Penagihan</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentTerms.map((t, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>{idx + 1}</td>
                      <td>
                        <input
                          type="text"
                          value={t.milestone_name}
                          onChange={(e) => handleTermChange(idx, 'milestone_name', e.target.value)}
                          className="input-field"
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={t.percent}
                            onChange={(e) => handleTermChange(idx, 'percent', parseFloat(e.target.value) || 0)}
                            className="input-field"
                            style={{ width: '70px', textAlign: 'center' }}
                          />
                          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>%</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {formatIDR(t.amount)}
                      </td>
                      <td>
                        <input
                          type="text"
                          value={t.trigger_condition}
                          onChange={(e) => handleTermChange(idx, 'trigger_condition', e.target.value)}
                          className="input-field"
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => removeTerm(idx)}
                          className="btn-ghost"
                          style={{ color: 'var(--color-danger)', padding: '2px 6px', fontSize: '11px' }}
                          disabled={paymentTerms.length <= 1}
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
          <section className="linear-card" style={{ padding: '22px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>
              Pengaturan Tambahan Penawaran
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Masa Berlaku Penawaran (Hari)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={validityDays}
                    onChange={(e) => setValidityDays(parseInt(e.target.value) || 30)}
                    className="input-field"
                    style={{ width: '120px', textAlign: 'right' }}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Hari sejak diterbitkan</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Catatan / Syarat & Ketentuan Khusus Penawaran
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input-field"
                  placeholder="Contoh: Harga belum termasuk domain pihak ketiga, garansi bug 3 bulan setelah UAT..."
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
            </div>
          </section>

          {/* Action Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
            <Link href="/commercial" className="btn-secondary" style={{ textDecoration: 'none' }}>
              Batal
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || !selectedEstimateId}
              className="btn-primary"
              style={{ minWidth: '220px', padding: '10px 24px', fontSize: '14px' }}
            >
              {isSubmitting ? 'Menyimpan Proposal...' : '💾 Simpan & Buka Proposal Cetak'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
