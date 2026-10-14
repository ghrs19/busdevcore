'use client';

import { ArrowLeft, ArrowRight, Building2, CalendarDays, Check, Layers, Paperclip, Printer, Repeat, SquarePen, Upload } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Page } from '@/components/ui/Page';
import DataGrid from '@/components/ui/DataGrid';
import { cn } from '@/lib/cn';

interface InvoiceDetail {
  id: number;
  proposal_id: number;
  term_index: number;
  milestone_name: string;
  percent: number;
  amount: number | string;
  trigger_condition: string;
  billing_status: string;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  paid_date?: string;
  paid_amount?: number | string;
  proof_reference?: string;
  proof_file_url?: string;
  proof_file_name?: string;
  notes?: string;
  billing_type: 'milestone' | 'recurring_monthly';
  phase: string;
  period_month?: number;
  coverage_period?: string;
  proposal_number: string;
  proposal_version: number;
  is_tax_enabled: boolean;
  proposal_grand_total: number | string;
  company_name: string;
  company_email?: string;
  company_phone?: string;
  company_address?: string;
  project_name: string;
  updated_by_name?: string;
}

const formatIDR = (val: number | string) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return `Rp ${(num || 0).toLocaleString('id-ID')}`;
};

const STATUS_BADGE: Record<string, { label: string; cls: string; bar: string }> = {
  paid: { label: 'Lunas', cls: 'badge-connected', bar: 'var(--color-success)' },
  invoiced: { label: 'Ditagihkan', cls: 'badge-info', bar: 'var(--color-info)' },
  overdue: { label: 'Jatuh tempo', cls: 'badge-danger', bar: 'var(--color-danger)' },
  unbilled: { label: 'Belum ditagih', cls: 'badge-neutral', bar: 'var(--text-tertiary)' },
};
const getStatusBadge = (status: string) => STATUS_BADGE[status?.toLowerCase()] || STATUS_BADGE.unbilled;

const fmtDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <dt className="shrink-0 text-[12.5px] text-fg-3">{label}</dt>
      <dd className="min-w-0 text-right text-[13px] text-fg-2">{children}</dd>
    </div>
  );
}

function InvoiceDetailPageInner() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params?.id as string;

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [siblings, setSiblings] = useState<InvoiceDetail[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [isEditing, setIsEditing] = useState(false);
  const [modalForm, setModalForm] = useState({
    billing_status: 'unbilled',
    invoice_number: '',
    invoice_date: '',
    due_date: '',
    paid_date: '',
    paid_amount: 0,
    proof_reference: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (invoiceId) {
      loadDetail();
    }
  }, [invoiceId]);

  async function loadDetail() {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`);
      const data = await res.json();
      if (data.success && data.invoice) {
        setInvoice(data.invoice);
        setSiblings(data.sibling_milestones || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const openEditModal = () => {
    if (!invoice) return;
    setModalForm({
      billing_status: invoice.billing_status || 'unbilled',
      invoice_number: invoice.invoice_number || '',
      invoice_date: invoice.invoice_date ? invoice.invoice_date.split('T')[0] : '',
      due_date: invoice.due_date ? invoice.due_date.split('T')[0] : '',
      paid_date: invoice.paid_date ? invoice.paid_date.split('T')[0] : '',
      paid_amount: Number(invoice.paid_amount) || 0,
      proof_reference: invoice.proof_reference || '',
      notes: invoice.notes || '',
    });
    setIsEditing(true);
  };

  const [uploadingProof, setUploadingProof] = useState(false);

  const handleUploadProofFile = async (file: File) => {
    if (!invoice) return;
    setUploadingProof(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/invoices/${invoice.id}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        alert('Bukti pembayaran berhasil diunggah ke penyimpanan file!');
        loadDetail();
      } else {
        alert(data.error || 'Gagal mengunggah file bukti');
      }
    } catch {
      alert('Gagal terhubung ke server');
    } finally {
      setUploadingProof(false);
    }
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/commercial/${invoice.proposal_id}/milestones`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          milestone_id: invoice.id,
          ...modalForm,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsEditing(false);
        loadDetail();
      } else {
        alert(data.error || 'Gagal menyimpan status');
      }
    } catch {
      alert('Gagal terhubung ke server');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
        Memuat detail invoice...
      </div>
    );
  }

  if (!invoice) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>Invoice tidak ditemukan</div>
        <Link href="/invoices" className="btn-secondary" style={{ textDecoration: 'none' }}>
          ← Kembali ke Tracker Invoices
        </Link>
      </div>
    );
  }

  const badge = getStatusBadge(invoice.billing_status);
  const isPaid = invoice.billing_status === 'paid';
  const isRecurring = invoice.billing_type === 'recurring_monthly';

  return (
    <Page wide className="pb-[80px]">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-2 text-[12px] text-fg-3">
          <Link href="/invoices" className="inline-flex items-center gap-1.5 no-underline hover:text-fg">
            <ArrowLeft className="size-3.5" aria-hidden /> Invoices
          </Link>
          <span aria-hidden>/</span>
          <span className="font-mono text-fg-2">{invoice.invoice_number || `Draft #${invoice.id}`}</span>
        </nav>

        {/* Header */}
        <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-line pb-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-mono text-[22px] font-semibold tracking-[-0.02em] text-fg">{invoice.invoice_number || `Draft Invoice #${invoice.id}`}</h1>
              <span className={cn('badge', badge.cls)}>
                <span className="badge-dot" /> {badge.label}
              </span>
              <span className={cn('badge', isRecurring ? 'badge-accent' : 'badge-neutral')}>
                {isRecurring ? <Repeat className="size-3" aria-hidden /> : <Layers className="size-3" aria-hidden />}
                {isRecurring ? 'Retainer bulanan' : 'Termin milestone'}
              </span>
            </div>
            <p className="mt-2 text-[13px] text-fg-3">
              {invoice.milestone_name} · <span className="text-fg-2">{invoice.company_name}</span> ({invoice.project_name})
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={openEditModal} className="btn-secondary">
              <SquarePen className="size-4" aria-hidden /> Update status
            </button>
            <Link href={`/invoices/${invoice.id}/print`} target="_blank" className="btn-primary">
              <Printer className="size-4" aria-hidden /> Cetak PDF
            </Link>
          </div>
        </header>

        {/* Amount hero */}
        <section aria-label="Nominal penagihan" className="hero-card mb-5 p-5 sm:p-6">
          <div className="relative flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-3">Nominal penagihan</div>
              <div className={cn('font-mono-numbers mt-2 text-[34px] font-semibold leading-none tracking-[-0.03em] sm:text-[40px]', isPaid ? 'text-ok' : 'text-fg')}>
                {formatIDR(invoice.amount)}
              </div>
              {invoice.percent > 0 && <p className="mt-2 text-[13px] text-fg-3">Bobot termin {invoice.percent}% dari grand total proyek</p>}
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <div>
                <div className="text-[11.5px] text-fg-3">Diterima</div>
                <div className="font-mono-numbers mt-1 text-[15px] font-semibold text-ok">{formatIDR(isPaid ? Number(invoice.paid_amount) || Number(invoice.amount) : Number(invoice.paid_amount) || 0)}</div>
              </div>
              <div>
                <div className="text-[11.5px] text-fg-3">Sisa tagihan</div>
                <div className={cn('font-mono-numbers mt-1 text-[15px] font-semibold', isPaid ? 'text-fg-2' : 'text-warn')}>
                  {formatIDR(isPaid ? 0 : Math.max(0, Number(invoice.amount) - (Number(invoice.paid_amount) || 0)))}
                </div>
              </div>
              <div>
                <div className="text-[11.5px] text-fg-3">Jatuh tempo</div>
                <div className="mt-1 text-[15px] font-semibold text-fg">{fmtDate(invoice.due_date)}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Detail panels */}
        <div className="mb-5 grid gap-5 lg:grid-cols-2">
          <section className="linear-card p-5">
            <h2 className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-fg">
              <CalendarDays className="size-4 text-fg-3" aria-hidden /> Tanggal & penagihan
            </h2>
            <dl>
              <InfoRow label="Nomor invoice"><span className="font-mono font-semibold text-fg">{invoice.invoice_number || 'Belum diterbitkan'}</span></InfoRow>
              <InfoRow label="Tanggal terbit">{fmtDate(invoice.invoice_date)}</InfoRow>
              <InfoRow label="Jatuh tempo"><span className={invoice.due_date ? 'font-semibold text-warn' : ''}>{fmtDate(invoice.due_date)}</span></InfoRow>
              <InfoRow label="Status pembayaran">
                <span className={cn('font-semibold', isPaid ? 'text-ok' : '')}>
                  {isPaid
                    ? `Lunas (${formatIDR(invoice.paid_amount || invoice.amount)})`
                    : Number(invoice.paid_amount) > 0
                      ? `Diterima ${formatIDR(Number(invoice.paid_amount) || 0)} · sisa ${formatIDR(Math.max(0, Number(invoice.amount) - Number(invoice.paid_amount)))}`
                      : 'Belum diterima'}
                </span>
              </InfoRow>
              {invoice.paid_date && <InfoRow label="Tanggal pelunasan"><span className="text-ok">{fmtDate(invoice.paid_date)}</span></InfoRow>}
              {invoice.proof_reference && <InfoRow label="Ref. transfer bank"><span className="font-mono text-fg">{invoice.proof_reference}</span></InfoRow>}
              <InfoRow label="Bukti bayar">
                {invoice.proof_file_url ? (
                  <a href={invoice.proof_file_url} target="_blank" rel="noreferrer" className="btn-secondary btn-sm"  title={`Lihat file: ${invoice.proof_file_name || 'Bukti transfer'}`}>
                    <Paperclip className="size-3.5" aria-hidden /> Lihat bukti
                  </a>
                ) : (
                  <label className="btn-secondary cursor-pointer" style={{ minHeight: 30, padding: '0 10px' }} title="Unggah slip transfer / bukti setor">
                    <Upload className="size-3.5" aria-hidden /> {uploadingProof ? 'Mengunggah…' : 'Unggah slip'}
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadProofFile(file);
                      }}
                    />
                  </label>
                )}
              </InfoRow>
            </dl>
          </section>

          <section className="linear-card p-5">
            <h2 className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-fg">
              <Building2 className="size-4 text-fg-3" aria-hidden /> Klien & proposal asal
            </h2>
            <dl>
              <InfoRow label="Perusahaan">
                <span className="font-semibold text-fg">{invoice.company_name}</span>
                {invoice.company_address && <span className="mt-0.5 block text-[12px] text-fg-3">{invoice.company_address}</span>}
              </InfoRow>
              <InfoRow label="Proyek"><span className="font-semibold text-fg">{invoice.project_name}</span></InfoRow>
              <InfoRow label="Dokumen proposal">
                <Link href={`/commercial/${invoice.proposal_id}`} className="inline-flex items-center gap-1 font-semibold text-brand-fg no-underline hover:underline">
                  {invoice.proposal_number} v{invoice.proposal_version} <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </InfoRow>
              {invoice.coverage_period && <InfoRow label="Periode layanan"><span className="font-semibold text-plum">{invoice.coverage_period}</span></InfoRow>}
            </dl>
          </section>
        </div>

        {/* Sibling milestones */}
        {siblings.length > 1 && (
          <DataGrid
            densityToggle={false}
            title={
              <div>
                <div className="text-[14px] font-semibold text-fg">Rangkaian termin & jadwal penagihan</div>
                <div className="mt-0.5 text-[12px] font-normal text-fg-3">Kontrak {invoice.proposal_number} · invoice yang sedang dibuka ditandai.</div>
              </div>
            }
            actions={<span className="badge badge-neutral font-mono-numbers">{siblings.length} tahap</span>}
          >
            <table className="pro-table" style={{ minWidth: 880 }}>
              <thead>
                <tr>
                  <th style={{ width: 64, textAlign: 'center' }}>No</th>
                  <th style={{ minWidth: 280 }}>Termin / milestone</th>
                  <th style={{ width: 170, textAlign: 'right' }}>Nominal</th>
                  <th style={{ width: 160 }}>Status</th>
                  <th style={{ width: 180 }}>No. invoice</th>
                  <th style={{ width: 110, textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {siblings.map((sib, idx) => {
                  const isCurrent = sib.id === invoice.id;
                  const sb = getStatusBadge(sib.billing_status);
                  return (
                    <tr key={sib.id} style={isCurrent ? { background: 'var(--accent-light)' } : undefined} aria-current={isCurrent ? 'true' : undefined}>
                      <td className="font-mono-numbers" style={{ textAlign: 'center', color: isCurrent ? 'var(--accent-text)' : undefined, fontWeight: isCurrent ? 700 : 500 }}>{idx + 1}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="cell-strong">{sib.milestone_name}</span>
                          {isCurrent && <span className="badge badge-accent">Sedang dibuka</span>}
                        </div>
                        {sib.percent > 0 && <div className="mt-0.5 text-[12px] text-fg-3">Bobot {sib.percent}% dari grand total</div>}
                      </td>
                      <td className={cn('cell-num font-mono-numbers cell-strong', sib.billing_status === 'paid' && 'text-ok')}>{formatIDR(sib.amount)}</td>
                      <td>
                        <span className={cn('badge', sb.cls)}>
                          <span className="badge-dot" /> {sb.label}
                        </span>
                      </td>
                      <td className="font-mono text-[12.5px]">{sib.invoice_number ? <span className="cell-strong">{sib.invoice_number}</span> : <span className="text-fg-3">Belum terbit</span>}</td>
                      <td style={{ textAlign: 'right' }}>
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-fg">
                            <Check className="size-3.5" aria-hidden /> Aktif
                          </span>
                        ) : (
                          <Link href={`/invoices/${sib.id}`} className="btn-secondary btn-sm"  title="Buka invoice termin ini">
                            Buka <ArrowRight className="size-3.5" aria-hidden />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataGrid>
        )}

        {/* Modal Update Status */}
        {isEditing && (
          <div className="modal-overlay"
          >
            <div className="modal-panel modal-panel-lg"
            >
              <h3 className="heading-md" style={{ margin: '0 0 4px 0' }}>
                Update Status Invoice & Pembayaran
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
                {invoice.milestone_name} • Nilai: <strong style={{ color: 'var(--color-success)' }}>{formatIDR(invoice.amount)}</strong>
              </p>

              <form onSubmit={handleSaveModal}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="field-label">
                      Status Penagihan (Billing Stage)
                    </label>
                    <select
                      className="linear-select"
                      value={modalForm.billing_status}
                      onChange={(e) => setModalForm({ ...modalForm, billing_status: e.target.value })}
                      style={{ width: '100%' }}
                    >
                      <option value="unbilled">Unbilled (Belum Ditagihkan)</option>
                      <option value="invoiced">Invoiced (Invoice Diterbitkan)</option>
                      <option value="paid">Paid (Telah Diterima Lunas)</option>
                      <option value="overdue">Overdue (Lewat Jatuh Tempo)</option>
                    </select>
                  </div>

                  <div>
                    <label className="field-label">
                      Nomor Invoice Resmi
                    </label>
                    <input
                      type="text"
                      className="linear-input"
                      placeholder="INV/2026/10/001"
                      value={modalForm.invoice_number}
                      onChange={(e) => setModalForm({ ...modalForm, invoice_number: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label className="field-label">
                      Tanggal Terbit Invoice
                    </label>
                    <input
                      type="date"
                      className="linear-input"
                      value={modalForm.invoice_date}
                      onChange={(e) => setModalForm({ ...modalForm, invoice_date: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label className="field-label">
                      Tanggal Jatuh Tempo (Due Date)
                    </label>
                    <input
                      type="date"
                      className="linear-input"
                      value={modalForm.due_date}
                      onChange={(e) => setModalForm({ ...modalForm, due_date: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label className="field-label">
                      Tanggal Pelunasan (Paid Date)
                    </label>
                    <input
                      type="date"
                      className="linear-input"
                      value={modalForm.paid_date}
                      onChange={(e) => setModalForm({ ...modalForm, paid_date: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="field-label">
                      Nominal Pembayaran Diterima (Rp)
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="linear-input font-mono-numbers"
                      value={modalForm.paid_amount}
                      onChange={(e) => setModalForm({ ...modalForm, paid_amount: parseFloat(e.target.value) || 0 })}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="field-label">
                      Referensi Bukti Transfer / Catatan
                    </label>
                    <input
                      type="text"
                      className="linear-input"
                      placeholder="BCA Trf #982137 - PT Klien"
                      value={modalForm.proof_reference}
                      onChange={(e) => setModalForm({ ...modalForm, proof_reference: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="btn-secondary btn-sm"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary btn-sm"
                  >
                    {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </Page>
  );
}

export default function InvoiceDetailPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Memuat...</div>}>
      <InvoiceDetailPageInner />
    </Suspense>
  );
}
