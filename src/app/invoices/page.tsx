'use client';

import { Banknote, CalendarClock, ChevronDown, FileText, Layers, Repeat, Search, SquarePen, TrendingUp, Wallet, X } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Page, PageHeader } from '@/components/ui/Page';
import { StatCard } from '@/components/ui/Cards';
import DataGrid from '@/components/ui/DataGrid';

interface InvoiceItem {
  id: number;
  proposal_id: number;
  billing_type: 'milestone' | 'recurring_monthly';
  phase: string;
  term_index: number;
  period_month?: number;
  coverage_period?: string;
  milestone_name: string;
  percent: number;
  amount: number | string;
  trigger_condition: string;
  billing_status: string;
  effective_status?: string;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  paid_date?: string;
  paid_amount?: number | string;
  proof_reference?: string;
  notes?: string;
  proposal_number: string;
  proposal_version: number;
  company_name: string;
  project_name: string;
}

interface ProjectInvoiceGroup {
  company_id: number;
  company_name: string;
  project_id: number;
  project_name: string;
  invoice_count: number;
  paid_count: number;
  paid_amount: number | string;
  invoiced_count: number;
  invoiced_amount: number | string;
  overdue_count: number;
  overdue_amount: number | string;
  unbilled_count: number;
  unbilled_amount: number | string;
  milestone_count: number;
  milestone_amount: number | string;
  recurring_count: number;
  recurring_amount: number | string;
  invoices: InvoiceItem[];
}

interface SummaryData {
  total_contract_value: number | string;
  total_paid: number | string;
  total_invoiced: number | string;
  total_unbilled: number | string;
  total_recurring_pipeline: number | string;
  mrr_rate: number | string;
}

const formatIDR = (val: number | string) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return `Rp ${(num || 0).toLocaleString('id-ID')}`;
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  paid: { label: 'Lunas', cls: 'badge-connected' },
  invoiced: { label: 'Ditagihkan', cls: 'badge-info' },
  overdue: { label: 'Jatuh tempo', cls: 'badge-danger' },
  unbilled: { label: 'Belum ditagih', cls: 'badge-neutral' },
};
const getStatusBadge = (status: string) => STATUS_BADGE[status?.toLowerCase()] || STATUS_BADGE.unbilled;

export default function InvoicesTrackerPage() {
  const [invoices, setInvoices] = useState<ProjectInvoiceGroup[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<string[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'milestone' | 'recurring_monthly'>('all');
  const [search, setSearch] = useState('');

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<InvoiceItem | null>(null);
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
    loadInvoices();
  }, [statusFilter, typeFilter, search]);

  async function loadInvoices() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter, type: typeFilter, search });
      const res = await fetch(`/api/invoices?${params}`);
      const data = await res.json();
      if (data.success) {
        setInvoices(data.invoices || []);
        setSummary(data.summary || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const openEditModal = (item: InvoiceItem) => {
    setEditingItem(item);
    setModalForm({
      billing_status: item.billing_status || 'unbilled',
      invoice_number: item.invoice_number || '',
      invoice_date: item.invoice_date ? item.invoice_date.split('T')[0] : '',
      due_date: item.due_date ? item.due_date.split('T')[0] : '',
      paid_date: item.paid_date ? item.paid_date.split('T')[0] : '',
      paid_amount: Number(item.paid_amount) || Number(item.amount) || 0,
      proof_reference: item.proof_reference || '',
      notes: item.notes || '',
    });
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/commercial/${editingItem.proposal_id}/milestones`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          milestone_id: editingItem.id,
          ...modalForm,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setEditingItem(null);
        loadInvoices();
      } else {
        alert(data.error || 'Gagal menyimpan status');
      }
    } catch {
      alert('Gagal terhubung ke server');
    } finally {
      setSaving(false);
    }
  };

  const TYPE_TABS: { id: 'all' | 'milestone' | 'recurring_monthly'; label: string }[] = [
    { id: 'all', label: 'Semua model' },
    { id: 'milestone', label: 'Termin proyek' },
    { id: 'recurring_monthly', label: 'Retainer bulanan' },
  ];
  const STATUS_TABS = [
    { id: 'all', label: 'Semua' },
    { id: 'unbilled', label: 'Belum ditagih' },
    { id: 'invoiced', label: 'Ditagihkan' },
    { id: 'overdue', label: 'Jatuh tempo' },
    { id: 'paid', label: 'Lunas' },
  ];

  return (
    <Page wide>
      <PageHeader
        eyebrow="Penagihan"
        title="Payment milestone & invoice tracker"
        description="Monitoring arus kas hibrida: termin development dan retainer bulanan (maintenance & cloud infra)."
      />

      {summary && (
        <section aria-label="Ringkasan penagihan" className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Total komitmen kontrak" icon={FileText} value={formatIDR(summary.total_contract_value)} />
          <StatCard label="Realisasi masuk" icon={Banknote} tone="ok" value={formatIDR(summary.total_paid)} />
          <StatCard label="Piutang ditagihkan" icon={Wallet} tone="note" value={formatIDR(summary.total_invoiced)} />
          <StatCard label="Retainer bulanan (MRR)" icon={Repeat} tone="plum" value={<>{formatIDR(summary.mrr_rate)}<span className="ml-1 text-[12px] font-medium text-fg-3">/ bulan</span></>} />
          <StatCard label="Belum ditagih" icon={CalendarClock} tone="warn" value={formatIDR(summary.total_unbilled)} />
        </section>
      )}

      {/* Filters */}
      <div className="linear-card mb-5 flex flex-wrap items-center gap-x-6 gap-y-3 p-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-3">Model</span>
          <div className="pill-group" role="group" aria-label="Filter model billing">
            {TYPE_TABS.map((t) => (
              <button key={t.id} type="button" aria-pressed={typeFilter === t.id} onClick={() => setTypeFilter(t.id)} className={`pill-item${typeFilter === t.id ? ' active' : ''}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-3">Status</span>
          <div className="pill-group" role="group" aria-label="Filter status billing">
            {STATUS_TABS.map((t) => (
              <button key={t.id} type="button" aria-pressed={statusFilter === t.id} onClick={() => setStatusFilter(t.id)} className={`pill-item${statusFilter === t.id ? ' active' : ''}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="relative ml-auto w-full sm:w-[300px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
          <input
            type="search"
            aria-label="Cari klien atau proyek"
            placeholder="Cari klien atau proyek…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="linear-input"
            style={{ paddingLeft: 36, paddingRight: search ? 34 : 12 }}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Hapus pencarian" className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-fg-3 hover:bg-[var(--row-hover)] hover:text-fg">
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Project cards */}
      <section className="linear-card overflow-hidden" aria-label="Ringkasan per proyek">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-fg">Ringkasan per proyek</h2>
            <p className="mt-0.5 text-[12px] text-fg-3">Buka proyek untuk melihat rincian tagihan.</p>
          </div>
          <span className="font-mono-numbers text-[12px] text-fg-3">{invoices.length} proyek</span>
        </div>

        {loading ? (
          <div className="grid gap-3 p-4" aria-busy="true">
            {[0, 1].map((i) => <div key={i} className="h-[148px] animate-pulse rounded-xl border border-line bg-surface-2" />)}
          </div>
        ) : invoices.length === 0 ? (
          <div className="dg-empty">Tidak ada proyek dengan kriteria ini.</div>
        ) : (
          <div className="grid gap-3 p-4">
            {invoices.map((project) => {
              const projectRowId = `${project.company_id}-${project.project_id}`;
              const expanded = expandedProjects.includes(projectRowId);
              const statuses = [
                { key: 'paid', label: 'Lunas', count: project.paid_count, amount: project.paid_amount, text: 'text-ok', bar: 'bg-ok' },
                { key: 'invoiced', label: 'Ditagihkan', count: project.invoiced_count, amount: project.invoiced_amount, text: 'text-note', bar: 'bg-note' },
                { key: 'overdue', label: 'Jatuh tempo', count: project.overdue_count, amount: project.overdue_amount, text: 'text-bad', bar: 'bg-bad' },
                { key: 'unbilled', label: 'Belum ditagih', count: project.unbilled_count, amount: project.unbilled_amount, text: 'text-fg-2', bar: 'bg-fg-3' },
              ];
              return (
                <article key={projectRowId} className="overflow-hidden rounded-xl border border-line bg-surface-2/50">
                  <div className="flex flex-wrap items-start gap-x-6 gap-y-4 p-4 sm:p-5">
                    <div className="min-w-[220px] flex-1 basis-[260px]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-3">Klien</div>
                      <div className="mt-1 text-[14px] font-semibold leading-snug text-fg" title={project.company_name}>{project.company_name}</div>
                      <div className="mt-1 text-[13px] leading-snug text-fg-2" title={project.project_name}>{project.project_name}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="badge badge-neutral"><Layers className="size-3" aria-hidden /> Termin · {project.milestone_count}</span>
                        <span className="badge badge-neutral"><Repeat className="size-3" aria-hidden /> Retainer · {project.recurring_count}</span>
                      </div>
                    </div>

                    <div className="grid w-full flex-[3_1_640px] grid-cols-2 gap-2 lg:grid-cols-4">
                      {statuses.map((st) => (
                        <div key={st.key} className="min-w-0 rounded-lg border border-line bg-surface p-3">
                          <div className="flex items-center gap-2">
                            <span className={`size-2 rounded-full ${st.bar}`} aria-hidden />
                            <span className={`text-[11px] font-semibold uppercase tracking-[0.06em] ${st.text}`}>{st.label}</span>
                          </div>
                          <div className="mt-2 text-[11.5px] text-fg-3">{st.count} item</div>
                          <div className="font-mono-numbers mt-0.5 truncate text-[14px] font-semibold text-fg" title={formatIDR(st.amount)}>{formatIDR(st.amount)}</div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={`project-invoices-${projectRowId}`}
                      onClick={() => setExpandedProjects((prev) => (expanded ? prev.filter((id) => id !== projectRowId) : [...prev, projectRowId]))}
                      className="btn-secondary ml-auto"
                    >
                      {expanded ? 'Tutup rincian' : `Lihat ${project.invoice_count} item`}
                      <ChevronDown className={`size-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
                    </button>
                  </div>

                  {project.milestone_count + project.recurring_count > 0 && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-5 py-2.5 text-[12px] text-fg-3">
                      <TrendingUp className="size-3.5" aria-hidden />
                      <span>Termin <span className="font-mono-numbers text-fg-2">{formatIDR(project.milestone_amount)}</span></span>
                      <span aria-hidden>·</span>
                      <span>Retainer <span className="font-mono-numbers text-fg-2">{formatIDR(project.recurring_amount)}</span></span>
                    </div>
                  )}

                  <div id={`project-invoices-${projectRowId}`} hidden={!expanded} className="border-t border-line bg-surface p-3">
                    <DataGrid densityToggle={false} stickyLast maxHeight={460}>
                      <table className="pro-table" style={{ minWidth: 980 }}>
                        <thead>
                          <tr>
                            <th style={{ minWidth: 260 }}>Proposal / termin</th>
                            <th>Model</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Nominal</th>
                            <th>No. invoice</th>
                            <th>Jatuh tempo</th>
                            <th style={{ textAlign: 'right' }}>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {project.invoices.map((inv) => {
                            const badge = getStatusBadge(inv.effective_status || inv.billing_status);
                            return (
                              <tr key={inv.id}>
                                <td>
                                  <Link href={`/commercial/${inv.proposal_id}`} className="font-mono text-[12.5px] font-semibold text-brand-fg no-underline hover:underline">
                                    {inv.proposal_number} v{inv.proposal_version}
                                  </Link>
                                  <div className="cell-trunc mt-0.5 text-[12px] text-fg-3" style={{ maxWidth: '40ch' }} title={inv.milestone_name}>{inv.milestone_name}</div>
                                </td>
                                <td className="whitespace-nowrap">{inv.billing_type === 'recurring_monthly' ? 'Retainer' : 'Termin'}</td>
                                <td className="whitespace-nowrap"><span className={`badge ${badge.cls}`}><span className="badge-dot" />{badge.label}</span></td>
                                <td className="cell-num font-mono-numbers cell-strong">{formatIDR(inv.amount)}</td>
                                <td className="whitespace-nowrap">
                                  {inv.invoice_number ? <Link href={`/invoices/${inv.id}`} className="font-mono text-[12.5px] no-underline hover:underline">{inv.invoice_number}</Link> : <span className="text-fg-3">Belum terbit</span>}
                                </td>
                                <td className="whitespace-nowrap">{inv.due_date ? new Date(inv.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                                <td>
                                  <div className="flex items-center justify-end gap-1.5">
                                    <Link href={`/invoices/${inv.id}`} className="btn-secondary" style={{ minHeight: 30, padding: '0 10px' }}>Detail</Link>
                                    <button type="button" onClick={() => openEditModal(inv)} className="btn-secondary" title="Update status" aria-label={`Update status ${inv.milestone_name}`} style={{ minHeight: 30, width: 30, padding: 0 }}>
                                      <SquarePen className="size-3.5" aria-hidden />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </DataGrid>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

        {/* Modal Update Status Penagihan */}
        {editingItem && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgb(8 10 14 / 0.62)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              backdropFilter: 'blur(4px)',
            }}
          >
            <div
              className="linear-card-elevated"
              style={{
                width: '100%',
                maxWidth: '520px',
                padding: '24px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-hover)',
                borderRadius: '12px',
              }}
            >
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                Update Status Invoice & Pembayaran
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
                {editingItem.milestone_name} • Nilai: <strong style={{ color: 'var(--color-success)' }}>{formatIDR(editingItem.amount)}</strong>
              </p>

              <form onSubmit={handleSaveModal}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
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
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
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
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
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
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
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
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
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
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
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
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
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
                    onClick={() => setEditingItem(null)}
                    className="btn-secondary"
                    style={{ padding: '6px 14px' }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary"
                    style={{ padding: '6px 16px' }}
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
