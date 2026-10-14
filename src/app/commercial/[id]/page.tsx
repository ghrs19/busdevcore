'use client';



import { Box, Building2, CalendarDays, ClipboardCheck, Clock3, CreditCard, Download, FileText, Paperclip, Printer, SquarePen, Upload, Zap } from 'lucide-react';
import { Suspense } from 'react';
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CATEGORY_ORDER, CATEGORY_LABELS } from '@/lib/commercial-pricing';
import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';
import { Page } from '@/components/ui/Page';
import { StatCard } from '@/components/ui/Cards';
import { cn } from '@/lib/cn';

interface ProposalDetail {
  id: number;
  proposal_number: string;
  version: number;
  parent_id: number | null;
  revision_notes?: string;
  company_id: number;
  company_name: string;
  company_email?: string;
  company_phone?: string;
  company_address?: string;
  project_id: number;
  project_name: string;
  project_description?: string;
  estimate_id: number;
  estimate_title: string;
  estimate_version: number;
  cogs_amount: string | number;
  margin_percent: string | number;
  base_price: string | number;
  category_pricing?: Partial<Record<string, { cogs: number; margin_percent: number; base_price: number }>> | null;
  discount_type: string;
  discount_value: string | number;
  subtotal_after_discount: string | number;
  is_tax_enabled: boolean;
  tax_amount: string | number;
  grand_total: string | number;
  validity_days: number;
  deal_status: string;
  lost_reason?: string;
  maintenance_billing_mode?: string;
  notes?: string;
  creator_name?: string;
  created_at: string;
  timeline_config?: {
    total_weeks: number;
    start_date?: string;
    milestones: Array<{
      phase: string;
      duration_weeks: number;
      deliverable: string;
    }>;
  };
  payment_terms?: Array<{
    milestone_name: string;
    percent: number;
    amount: number;
    trigger_condition: string;
  }>;
}

interface VersionHistoryItem {
  id: number;
  proposal_number: string;
  version: number;
  parent_id: number | null;
  grand_total: string | number;
  margin_percent: string | number;
  revision_notes: string | null;
  created_at: string;
  creator_name?: string;
}

interface ModuleItem {
  id: number;
  name: string;
  tasks: Array<{ id: number; name: string }>;
}

interface ContractDocument {
  id: number;
  doc_type: string;
  doc_number: string;
  title: string;
  term_index?: number;
  sign_date: string;
  amount: number | string;
  status: string;
  notes?: string;
  creator_name?: string;
  created_at: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
}

interface AuditLogItem {
  id: number;
  user_name?: string;
  action: string;
  details?: Record<string, unknown>;
  created_at: string;
}

const formatIDR = (val: number | string) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return `Rp ${(num || 0).toLocaleString('id-ID')}`;
};

const getStatusBadge = (status: string) => {
  const s = status ? status.toLowerCase() : 'draft';
  switch (s) {
    case 'won':
      return { label: 'Won (Deal)', bg: 'rgb(var(--success-rgb) / 0.15)', text: 'var(--color-success)', border: 'rgb(var(--success-rgb) / 0.3)' };
    case 'negotiation':
      return { label: 'Negotiation', bg: 'rgb(var(--warning-rgb) / 0.15)', text: 'var(--color-warning)', border: 'rgb(var(--warning-rgb) / 0.3)' };
    case 'sent':
      return { label: 'Sent to Client', bg: 'rgb(var(--info-rgb) / 0.15)', text: 'var(--color-info)', border: 'rgb(var(--info-rgb) / 0.3)' };
    case 'lost':
      return { label: 'Lost', bg: 'rgb(var(--danger-rgb) / 0.15)', text: 'var(--color-danger)', border: 'rgb(var(--danger-rgb) / 0.3)' };
    case 'draft':
    default:
      return { label: 'Draft', bg: 'rgb(var(--ink-rgb) / 0.06)', text: 'var(--text-secondary)', border: 'rgb(var(--ink-rgb) / 0.12)' };
  }
};

function CommercialProposalDetailContent() {
  const params = useParams();
  const id = params?.id as string;

  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [versionHistory, setVersionHistory] = useState<VersionHistoryItem[]>([]);
  const [contractDocs, setContractDocs] = useState<ContractDocument[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Status Change State
  const [changingStatus, setChangingStatus] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [lostReasonInput, setLostReasonInput] = useState('');
  const [generatingDocs, setGeneratingDocs] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'history' | 'audit'>('overview');

  useEffect(() => {
    if (!id) return;
    loadAllData();
  }, [id]);

  async function loadAllData() {
    try {
      // 1. Load Proposal
      const res = await fetch(`/api/commercial/${id}`);
      const data = await res.json();
      if (data.success && data.proposal) {
        setProposal(data.proposal);
        setModules(data.modules || []);
        if (Array.isArray(data.version_history)) {
          setVersionHistory(data.version_history);
        }
      } else {
        setErrorMsg(data.error || 'Gagal memuat proposal');
      }

      // 2. Load Contract Documents
      const docRes = await fetch(`/api/commercial/${id}/documents`);
      const docData = await docRes.json();
      if (docData.success && Array.isArray(docData.documents)) {
        setContractDocs(docData.documents);
      }

      // 3. Load Audit Logs
      const auditRes = await fetch(`/api/audit?entity_type=commercial_proposal&entity_id=${id}`);
      const auditData = await auditRes.json();
      if (auditData.success && Array.isArray(auditData.logs)) {
        setAuditLogs(auditData.logs);
      }
    } catch {
      setErrorMsg('Gagal terhubung ke database');
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(targetStatus: string, lostReasonText?: string) {
    if (!proposal) return;
    if (targetStatus === 'lost' && !lostReasonText) {
      setShowLostModal(true);
      return;
    }

    setChangingStatus(true);
    try {
      const res = await fetch(`/api/commercial/${proposal.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: targetStatus,
          lost_reason: lostReasonText || '',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowLostModal(false);
        setLostReasonInput('');
        loadAllData();
      } else {
        alert(data.error || 'Gagal memperbarui status');
      }
    } catch {
      alert('Terjadi kesalahan koneksi');
    } finally {
      setChangingStatus(false);
    }
  }

  const [uploadingDocId, setUploadingDocId] = useState<number | null>(null);

  async function handleUploadContractFile(docId: number, file: File) {
    if (!proposal) return;
    setUploadingDocId(docId);
    try {
      const formData = new FormData();
      formData.append('document_id', String(docId));
      formData.append('file', file);

      const res = await fetch(`/api/commercial/${proposal.id}/documents/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        alert('File dokumen berhasil diunggah ke penyimpanan file!');
        loadAllData();
      } else {
        alert(data.error || 'Gagal mengunggah file');
      }
    } catch {
      alert('Gagal terhubung ke server');
    } finally {
      setUploadingDocId(null);
    }
  }

  async function handleGenerateDocuments(type: 'GENERATE_ALL' | 'GENERATE_SPK' | 'GENERATE_BAST') {
    if (!proposal) return;
    setGeneratingDocs(true);
    try {
      const res = await fetch(`/api/commercial/${proposal.id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_type: type }),
      });
      const data = await res.json();
      if (data.success) {
        loadAllData();
        setActiveTab('documents');
      } else {
        alert(data.error || 'Gagal membuat dokumen turunan');
      }
    } catch {
      alert('Gagal generate dokumen');
    } finally {
      setGeneratingDocs(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-hover)' }} />
          <span>Memuat detail proposal penawaran...</span>
        </div>
      </div>
    );
  }

  if (errorMsg || !proposal) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', padding: '60px 20px', textAlign: 'center', color: 'var(--color-danger)' }}>
        <div style={{ fontSize: '15px', fontWeight: 600 }}>{errorMsg || 'Proposal tidak ditemukan.'}</div>
        <div style={{ marginTop: '16px' }}>
          <Link href="/commercial" className="btn-secondary" style={{ textDecoration: 'none' }}>
            ← Kembali ke Daftar Penawaran
          </Link>
        </div>
      </div>
    );
  }

  const createdDate = new Date(proposal.created_at);
  const dateFormatted = createdDate.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const validUntilDate = new Date(createdDate.getTime() + (proposal.validity_days || 30) * 86400000);
  const validUntilFormatted = validUntilDate.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const discountAmount = Number(proposal.base_price) - Number(proposal.subtotal_after_discount);
  const grossProfit = Number(proposal.grand_total) - Number(proposal.cogs_amount);
  const grossProfitPercent = Number(proposal.subtotal_after_discount) > 0
    ? (((Number(proposal.subtotal_after_discount) - Number(proposal.cogs_amount)) / Number(proposal.subtotal_after_discount)) * 100).toFixed(1)
    : '0';

  const statusBadge = getStatusBadge(proposal.deal_status);
  const isWon = proposal.deal_status === 'won';

  return (
    <Page wide className="pb-24">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-2 text-[12px] text-fg-3">
          <Link href="/commercial" className="inline-flex items-center gap-1.5 no-underline hover:text-fg">
            <ArrowLeft className="size-3.5" aria-hidden /> Proposal
          </Link>
          <span aria-hidden>/</span>
          <span className="font-mono text-fg-2">{proposal.proposal_number}</span>
        </nav>

        {/* Header */}
        <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-line pb-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-mono text-[22px] font-semibold tracking-[-0.02em] text-fg">{proposal.proposal_number}</h1>
              <span className={cn('badge font-mono-numbers', (proposal.version || 1) > 1 ? 'badge-accent' : 'badge-neutral')}>v{proposal.version || 1}</span>
              <span className="badge" style={{ background: statusBadge.bg, color: statusBadge.text, borderColor: statusBadge.border }}>
                <span className="badge-dot" /> {statusBadge.label}
              </span>
            </div>
            <p className="mt-2 text-[13px] text-fg-3">
              <span className="text-fg-2">{proposal.company_name}</span> · {proposal.project_name}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href={`/api/commercial/${proposal.id}/export/docx`} download className="btn-secondary" title="Unduh dokumen Word (.docx)">
              <Download className="size-4" aria-hidden /> Word
            </a>
            <Link href={`/commercial/${proposal.id}/print`} target="_blank" className="btn-secondary" title="Buka lembar cetak / PDF A4 klien">
              <Printer className="size-4" aria-hidden /> Cetak PDF
            </Link>
            <Link href={`/commercial/new?edit_id=${proposal.id}`} className="btn-primary" title="Edit proposal ini dan simpan sebagai versi terbaru">
              <SquarePen className="size-4" aria-hidden /> Revisi (v{(proposal.version || 1) + 1})
            </Link>
          </div>
        </header>

        {/* Pipeline stepper */}
        <section aria-label="Tahap pipeline" className="linear-card mb-5 p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-3">Tahap pipeline</div>
            {proposal.deal_status === 'lost' && proposal.lost_reason && (
              <div className="text-[12px] text-bad">
                Alasan kalah: <strong>{proposal.lost_reason}</strong>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Ubah status deal">
            {[
              { id: 'draft', label: 'Draft' },
              { id: 'sent', label: 'Terkirim' },
              { id: 'negotiation', label: 'Negosiasi' },
              { id: 'won', label: 'Won' },
              { id: 'lost', label: 'Lost' },
            ].map((st, idx) => {
              const isCurrent = (proposal.deal_status || 'draft') === st.id;
              const tone = st.id === 'won' ? 'ok' : st.id === 'lost' ? 'bad' : 'brand';
              return (
                <button
                  key={st.id}
                  type="button"
                  disabled={changingStatus}
                  aria-pressed={isCurrent}
                  onClick={() => handleStatusChange(st.id)}
                  className={cn('status-chip', isCurrent && 'is-current', isCurrent && tone === 'ok' && 'is-ok', isCurrent && tone === 'bad' && 'is-bad')}
                >
                  {isCurrent ? <Check className="size-3.5" aria-hidden /> : <span className="font-mono-numbers text-[11px] opacity-60">{idx + 1}</span>}
                  {st.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Financial highlights */}
        <section aria-label="Ringkasan finansial" className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total penawaran klien"
            icon={CreditCard}
            tone="ok"
            value={formatIDR(proposal.grand_total)}
            hint={`Nett resmi · ${proposal.is_tax_enabled ? 'inc. PPN 11%' : 'tanpa PPN'}`}
          />
          <StatCard label="Biaya modal (COGS)" icon={Box} tone="note" value={formatIDR(proposal.cogs_amount)} hint={`Baseline: ${proposal.estimate_title}`} />
          <StatCard
            label="Target margin & gross profit"
            icon={Zap}
            tone="brand"
            value={<>+{proposal.margin_percent}%</>}
            hint={`${formatIDR(grossProfit)} · riil +${grossProfitPercent}% dari subtotal`}
          />
          <StatCard
            label="Base price & diskon"
            icon={FileText}
            value={formatIDR(proposal.base_price)}
            hint={<span className={discountAmount > 0 ? 'text-warn' : ''}>{discountAmount > 0 ? `Diskon -${formatIDR(discountAmount)}` : 'Tanpa potongan diskon'}</span>}
          />
        </section>


        {/* Harga per Kategori (internal: COGS, margin, harga dasar) */}
        {proposal.category_pricing && Object.keys(proposal.category_pricing).length > 0 && (
          <div className="linear-card" style={{ padding: '18px', marginBottom: '24px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '10px' }}>
              Harga per Kategori (Internal)
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="linear-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Kategori</th>
                    <th style={{ textAlign: 'right' }}>COGS</th>
                    <th style={{ textAlign: 'right' }}>Margin</th>
                    <th style={{ textAlign: 'right' }}>Harga Dasar</th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORY_ORDER.filter((c) => proposal.category_pricing?.[c]).map((c) => {
                    const l = proposal.category_pricing?.[c];
                    if (!l) return null;
                    return (
                      <tr key={c}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{CATEGORY_LABELS[c]}</td>
                        <td className="font-mono-numbers" style={{ textAlign: 'right', color: 'var(--color-info)' }}>{formatIDR(l.cogs)}</td>
                        <td className="font-mono-numbers" style={{ textAlign: 'right', color: 'var(--accent-hover)' }}>+{l.margin_percent}%</td>
                        <td className="font-mono-numbers" style={{ textAlign: 'right', fontWeight: 600 }}>{formatIDR(l.base_price)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="tab-bar" role="tablist" style={{ marginBottom: 24 }}>
          {[
            { id: 'overview', label: 'Rincian & Deliverables' },
            { id: 'documents', label: `Dokumen Kontrak (SPK & BAST) (${contractDocs.length})` },
            { id: 'history', label: `Riwayat Versi (${versionHistory.length})` },
            { id: 'audit', label: `Activity Trail (${auditLogs.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={activeTab === tab.id ? 'tab active' : 'tab'}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <>
            {/* Metadata & Client Info Two-Column Panel */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '24px' }}>
              <section className="linear-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
                  <Building2 style={{ width: "18px", height: "18px", color: "var(--accent-hover)" }} />
                  <h3 className="heading-sm" style={{ margin: 0 }}>
                    Informasi Klien & Entitas
                  </h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', rowGap: '12px', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Nama Klien:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{proposal.company_name}</strong>

                  <span style={{ color: 'var(--text-tertiary)' }}>Nama Proyek:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{proposal.project_name}</span>

                  <span style={{ color: 'var(--text-tertiary)' }}>Alamat:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{proposal.company_address || '-'}</span>

                  <span style={{ color: 'var(--text-tertiary)' }}>Kontak:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {proposal.company_email || '-'} {proposal.company_phone ? `• ${proposal.company_phone}` : ''}
                  </span>
                </div>
              </section>

              <section className="linear-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
                  <FileText style={{ width: "18px", height: "18px", color: "var(--accent-hover)" }} />
                  <h3 className="heading-sm" style={{ margin: 0 }}>
                    Administrasi Dokumen Penawaran
                  </h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', rowGap: '12px', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Nomor Dokumen:</span>
                  <span className="font-mono-numbers" style={{ color: 'var(--accent-hover)', fontWeight: 600 }}>{proposal.proposal_number}</span>

                  <span style={{ color: 'var(--text-tertiary)' }}>Tanggal Terbit:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{dateFormatted}</span>

                  <span style={{ color: 'var(--text-tertiary)' }}>Masa Berlaku:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{validUntilFormatted} ({proposal.validity_days || 30} Hari)</span>

                  <span style={{ color: 'var(--text-tertiary)' }}>Disusun Oleh:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{proposal.creator_name || 'Admin'}</span>

                  <span style={{ color: 'var(--text-tertiary)' }}>Baseline Costing:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {proposal.estimate_title} <span className="linear-badge font-mono-numbers" style={{ fontSize: '10px' }}>v{proposal.estimate_version}</span>
                  </span>
                </div>
              </section>
            </div>

            {/* Delivery Timeline & Payment Terms */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px', marginBottom: '24px' }}>
              <section className="linear-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CalendarDays style={{ width: "18px", height: "18px", color: "var(--accent-hover)" }} />
                    <h3 className="heading-sm" style={{ margin: 0 }}>
                      Delivery Timeline Setup
                    </h3>
                  </div>
                  <span className="linear-badge font-mono-numbers" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-info)' }}>
                    Durasi: {proposal.timeline_config?.total_weeks || 4} Minggu
                  </span>
                </div>

                {proposal.timeline_config && Array.isArray(proposal.timeline_config.milestones) ? (
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                    <table className="pro-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                          <th style={{ minWidth: '160px', textAlign: 'left' }}>Tahapan Kerja</th>
                          <th style={{ width: '90px', textAlign: 'center' }}>Durasi</th>
                          <th style={{ minWidth: '200px', textAlign: 'left' }}>Hasil Luaran (Deliverables)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {proposal.timeline_config.milestones.map((m, idx) => (
                          <tr key={idx}>
                            <td style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>{idx + 1}</td>
                            <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.phase}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="linear-badge font-mono-numbers" style={{ fontSize: '11px', color: 'var(--color-info)' }}>
                                {m.duration_weeks} Mgg
                              </span>
                            </td>
                            <td style={{ color: 'var(--text-secondary)', fontSize: '12.5px' }}>{m.deliverable}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', padding: '16px', textAlign: 'center' }}>Tidak ada konfigurasi timeline.</div>
                )}
              </section>

              <section className="linear-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CreditCard style={{ width: "18px", height: "18px", color: "var(--accent-hover)" }} />
                    <h3 className="heading-sm" style={{ margin: 0 }}>
                      Termin Pembayaran (Term of Payment)
                    </h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      className="linear-badge"
                      style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        background: proposal.maintenance_billing_mode === 'MONTHLY_RETAINER' ? 'rgb(var(--violet-rgb) / 0.15)' : 'rgb(var(--info-rgb) / 0.15)',
                        color: proposal.maintenance_billing_mode === 'MONTHLY_RETAINER' ? 'var(--color-violet)' : 'var(--color-info)',
                        border: `1px solid ${proposal.maintenance_billing_mode === 'MONTHLY_RETAINER' ? 'rgb(var(--violet-rgb) / 0.3)' : 'rgb(var(--info-rgb) / 0.3)'}`,
                      }}
                    >
                      {proposal.maintenance_billing_mode === 'MONTHLY_RETAINER' ? 'Mnt: Ditagih Bulanan' : 'Mnt: All-in Proyek'}
                    </span>
                    <Link
                      href="/invoices"
                      className="btn-secondary btn-sm"
                      style={{ textDecoration: 'none', color: 'var(--color-info)' }}
                      title="Buka Invoice & Payment Tracker"
                    >
                      Buka Tracker Invoice →
                    </Link>
                    <span className="linear-badge font-mono-numbers" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-success)' }}>
                      Total: {formatIDR(proposal.grand_total)}
                    </span>
                  </div>
                </div>

                {Array.isArray(proposal.payment_terms) && proposal.payment_terms.length > 0 ? (
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                    <table className="pro-table">
                      <thead>
                        <tr>
                          <th style={{ minWidth: '150px', textAlign: 'left' }}>Tahap Tagihan</th>
                          <th style={{ width: '70px', textAlign: 'center' }}>Bobot</th>
                          <th style={{ width: '140px', textAlign: 'right' }}>Nominal</th>
                          <th style={{ minWidth: '180px', textAlign: 'left' }}>Kondisi Penagihan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {proposal.payment_terms.map((t, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.milestone_name}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="linear-badge font-mono-numbers" style={{ fontSize: '11px' }}>
                                {t.percent}%
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-success)', fontFamily: 'var(--font-mono)' }}>
                              {formatIDR(t.amount)}
                            </td>
                            <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{t.trigger_condition}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', padding: '16px', textAlign: 'center' }}>Tidak ada termin pembayaran.</div>
                )}
              </section>
            </div>

            {/* Scope of Work */}
            <section className="linear-card" style={{ padding: '24px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Box style={{ width: "18px", height: "18px", color: "var(--accent-hover)" }} />
                  <div>
                    <h3 className="heading-md" style={{ margin: 0 }}>
                      Ruang Lingkup Fitur & Modul (Scope of Work Baseline)
                    </h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      Deliverables resmi yang termuat di dalam proposal dokumen klien
                    </div>
                  </div>
                </div>
                <span className="linear-badge font-mono-numbers" style={{ fontSize: '11px', fontWeight: 600 }}>
                  {modules.length} Modul Terdaftar
                </span>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                <table className="pro-table">
                  <thead>
                    <tr>
                      <th style={{ width: '45px', textAlign: 'center' }}>No</th>
                      <th style={{ width: '280px', textAlign: 'left' }}>Modul / Fungsionalitas</th>
                      <th style={{ minWidth: '360px', textAlign: 'left' }}>Rincian Fitur & Deliverables</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modules.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)' }}>
                          Tidak ada rincian modul dalam baseline estimasi.
                        </td>
                      </tr>
                    ) : (
                      modules.map((m, idx) => (
                        <tr key={m.id}>
                          <td style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>{idx + 1}</td>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13.5px' }}>{m.name}</td>
                          <td>
                            {Array.isArray(m.tasks) && m.tasks.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {m.tasks.map((t) => (
                                  <span
                                    key={t.id}
                                    className="linear-badge"
                                    style={{
                                      fontSize: '11.5px',
                                      padding: '4px 10px',
                                      color: 'var(--text-primary)',
                                      background: 'rgb(var(--ink-rgb) / 0.04)',
                                      border: '1px solid rgb(var(--ink-rgb) / 0.08)',
                                    }}
                                  >
                                    {t.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>Penyelesaian modul {m.name}</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {/* TAB 2: DOKUMEN TURUNAN (SPK & BAST TERMIN) */}
        {activeTab === 'documents' && (
          <section className="linear-card" style={{ padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 className="heading-md" style={{ margin: 0 }}>
                  Konversi Dokumen Kontrak & Penagihan
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  Otomatisasi pembuatan Surat Perintah Kerja (SPK) dan Berita Acara Serah Terima (BAST) per termin.
                </p>
              </div>

              {/* Tombol Generate Dokumen */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  disabled={generatingDocs}
                  onClick={() => handleGenerateDocuments('GENERATE_ALL')}
                  className="btn-primary btn-sm"
                >
                  {generatingDocs ? 'Memproses...' : 'Generate SPK & Seluruh BAST Termin'}
                </button>
              </div>
            </div>

            {contractDocs.length === 0 ? (
              <div
                style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  background: 'rgb(var(--ink-rgb) / 0.02)',
                  borderRadius: '8px',
                  border: '1px dashed var(--border-subtle)',
                }}
              >
                <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}><FileText style={{ width: '36px', height: '36px', color: 'var(--accent-hover)' }} /></div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Belum ada dokumen turunan kontrak
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', maxWidth: '400px', margin: '6px auto 16px' }}>
                  {isWon
                    ? 'Proposal ini sudah berstatus WON. Klik tombol di atas untuk membuat draf SPK dan BAST secara instan.'
                    : 'Ubah status proposal menjadi "Won (Deal)" atau klik tombol generate untuk mengonversi proposal ini menjadi SPK & BAST.'}
                </div>
                <button
                  disabled={generatingDocs}
                  onClick={() => handleGenerateDocuments('GENERATE_ALL')}
                  className="btn-secondary btn-sm"
                >
                  Generate Sekarang
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                <table className="pro-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px', textAlign: 'center' }}>Tipe</th>
                      <th style={{ width: '180px', textAlign: 'left' }}>No. Dokumen</th>
                      <th style={{ minWidth: '220px', textAlign: 'left' }}>Judul Dokumen</th>
                      <th style={{ width: '150px', textAlign: 'right' }}>Nilai Dokumen</th>
                      <th style={{ width: '120px', textAlign: 'center' }}>Status</th>
                      <th style={{ width: '120px', textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contractDocs.map((doc) => {
                      const isSPK = doc.doc_type === 'SPK';

                      return (
                        <tr key={doc.id}>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              className="linear-badge"
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 700,
                                background: isSPK ? 'rgb(var(--accent-rgb) / 0.25)' : 'rgb(var(--success-rgb) / 0.2)',
                                color: isSPK ? 'var(--accent-text)' : 'var(--color-success)',
                              }}
                            >
                              {doc.doc_type}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {doc.doc_number}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                              {doc.title}
                            </div>
                            {doc.notes && (
                              <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                {doc.notes}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-success)', fontFamily: 'var(--font-mono)' }}>
                            {formatIDR(doc.amount)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="linear-badge" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                              {doc.status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <a
                                href={`/api/contract-documents/${doc.id}/docx`}
                                download
                                className="btn-secondary btn-sm"
                                style={{ textDecoration: 'none', color: 'var(--color-info)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                title="Download Draf Word Resmi"
                              >
                                <Download style={{ width: "14px", height: "14px" }} />
                                <span>Draf .docx</span>
                              </a>

                              {/* Upload / View Signed File */}
                              {doc.file_url ? (
                                <a
                                  href={doc.file_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn-secondary btn-sm"
                                  style={{ textDecoration: 'none', color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid rgb(var(--success-rgb) / 0.4)', background: 'rgb(var(--success-rgb) / 0.08)' }}
                                  title={`Buka file tersimpan: ${doc.file_name || 'Dokumen Bertanda Tangan'}`}
                                >
                                  <Paperclip style={{ width: '13px', height: '13px' }} />
                                  <span>Lihat Scan TTD</span>
                                </a>
                              ) : (
                                <label
                                  className="btn-secondary"
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    color: 'var(--text-primary)',
                                  }}
                                  title="Upload file hasil scan bertanda tangan / bermeterai"
                                >
                                  <Upload style={{ width: '13px', height: '13px' }} />
                                  <span>{uploadingDocId === doc.id ? 'Mengunggah...' : 'Upload Scan TTD'}</span>
                                  <input
                                    type="file"
                                    accept=".pdf,.png,.jpg,.jpeg,.docx"
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleUploadContractFile(doc.id, file);
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* TAB 3: RIWAYAT VERSI */}
        {activeTab === 'history' && (
          <section className="linear-card" style={{ padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 className="heading-md" style={{ margin: 0 }}>
                  Riwayat Seluruh Versi Dokumen ({proposal.proposal_number})
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  Audit perubahan skema harga dan catatan revisi antar-versi
                </div>
              </div>
              <span className="linear-badge font-mono-numbers" style={{ fontSize: '11px', fontWeight: 600 }}>
                {versionHistory.length} Versi Tersimpan
              </span>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
              <table className="pro-table">
                <thead>
                  <tr>
                    <th style={{ width: '90px', textAlign: 'center' }}>Versi</th>
                    <th style={{ width: '150px', textAlign: 'left' }}>Tanggal Terbit</th>
                    <th style={{ width: '170px', textAlign: 'right' }}>Total Penawaran</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Margin</th>
                    <th style={{ minWidth: '280px', textAlign: 'left' }}>Catatan Perubahan Revisi</th>
                    <th style={{ width: '130px', textAlign: 'center' }}>Dibuat Oleh</th>
                    <th style={{ width: '140px', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {versionHistory.map((vh) => {
                    const isCurrent = vh.id === proposal.id;
                    const vhDate = new Date(vh.created_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    });

                    return (
                      <tr key={vh.id} style={{ background: isCurrent ? 'rgb(var(--accent-rgb) / 0.08)' : undefined }}>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className="linear-badge font-mono-numbers"
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              background: isCurrent ? 'rgb(var(--accent-rgb) / 0.3)' : 'rgb(var(--ink-rgb) / 0.04)',
                              color: isCurrent ? 'var(--accent-text)' : 'var(--text-secondary)',
                            }}
                          >
                            v{vh.version} {isCurrent && '●'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{vhDate}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-success)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                          {formatIDR(vh.grand_total)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="linear-badge font-mono-numbers" style={{ fontSize: '11px', color: 'var(--color-success)' }}>
                            +{vh.margin_percent}%
                          </span>
                        </td>
                        <td>
                          <div style={{ color: vh.revision_notes ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: '13px' }}>
                            {vh.revision_notes || '(Inisialisasi proposal penawaran v1)'}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {vh.creator_name || '-'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isCurrent ? (
                            <span style={{ fontSize: '11px', color: 'var(--accent-hover)', fontWeight: 600 }}>
                              Sedang Dilihat
                            </span>
                          ) : (
                            <Link
                              href={`/commercial/${vh.id}`}
                              className="btn-secondary btn-sm"
                              style={{ textDecoration: 'none' }}
                            >
                              Buka Versi
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 4: AUDIT TRAIL LOGS */}
        {activeTab === 'audit' && (
          <section className="linear-card" style={{ padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div>
                <h3 className="heading-md" style={{ margin: 0 }}>
                  Activity Trail & Audit Log Dokumen
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  Rekam jejak setiap aksi status change, revisi, dan generate dokumen secara akuntabel
                </div>
              </div>
            </div>

            {auditLogs.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                Belum ada rekaman audit log untuk proposal ini.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                <table className="pro-table">
                  <thead>
                    <tr>
                      <th style={{ width: '160px', textAlign: 'left' }}>Waktu Kejadian</th>
                      <th style={{ width: '140px', textAlign: 'left' }}>Aktor (User)</th>
                      <th style={{ width: '150px', textAlign: 'center' }}>Aksi</th>
                      <th style={{ minWidth: '300px', textAlign: 'left' }}>Rincian Log Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => {
                      const logDate = new Date(log.created_at).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <tr key={log.id}>
                          <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{logDate}</td>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '12.5px' }}>
                            {log.user_name || 'System'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              className="linear-badge font-mono-numbers"
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 700,
                                background:
                                  log.action === 'STATUS_CHANGE'
                                    ? 'rgb(var(--warning-rgb) / 0.15)'
                                    : log.action === 'DOCUMENT_GENERATE'
                                    ? 'rgb(var(--info-rgb) / 0.15)'
                                    : 'rgb(var(--ink-rgb) / 0.05)',
                                color:
                                  log.action === 'STATUS_CHANGE'
                                    ? 'var(--color-warning)'
                                    : log.action === 'DOCUMENT_GENERATE'
                                    ? 'var(--color-info)'
                                    : 'var(--text-primary)',
                              }}
                            >
                              {log.action}
                            </span>
                          </td>
                          <td>
                            <code
                              style={{
                                fontSize: '11.5px',
                                color: 'var(--text-secondary)',
                                background: 'var(--bg-card)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              {JSON.stringify(log.details)}
                            </code>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Modal Alasan Lost */}
        {showLostModal && (
          <div className="modal-overlay"
          >
            <div className="modal-panel modal-panel-danger"
            >
              <h3 className="heading-md" style={{ color: 'var(--color-danger)', margin: '0 0 8px 0' }}>
                Tandai Proposal Sebagai LOST (Kalah)
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Masukkan alasan kegagalan deal (contoh: harga kalah kompetitor, budget klien dipangkas, project ditunda):
              </p>

              <textarea
                className="linear-textarea"
                rows={4}
                value={lostReasonInput}
                onChange={(e) => setLostReasonInput(e.target.value)}
                placeholder="Tuliskan evaluasi penyebab lost..."
                style={{ width: '100%', marginBottom: '16px', fontSize: '13px' }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowLostModal(false)}
                  className="btn-secondary btn-sm"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={!lostReasonInput.trim() || changingStatus}
                  onClick={() => handleStatusChange('lost', lostReasonInput)}
                  className="btn-danger btn-sm"
                >
                  Konfirmasi Status Lost
                </button>
              </div>
            </div>
          </div>
        )}
    </Page>
  );
}

export default function CommercialProposalDetailPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>Memuat detail proposal...</div>}>
      <CommercialProposalDetailContent />
    </Suspense>
  );
}