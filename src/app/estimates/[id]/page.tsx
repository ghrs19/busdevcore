'use client';


import { ArrowLeft, Clock3, FileDown, History, Layers, Printer, SquarePen, Timer, Trash2, Wallet, type LucideIcon } from 'lucide-react';
import React, { useState, useEffect, use, Suspense } from 'react';
import Link from 'next/link';
import { Page } from '@/components/ui/Page';
import { StatCard } from '@/components/ui/Cards';
import { cn } from '@/lib/cn';
import { useRouter } from 'next/navigation';
import { compareVersions } from '@/lib/version-diff';
import { snapshotLabels } from '@/lib/rate-snapshot';

type RoleSnapshotEntry = { code: string; name: string; rate: number };

interface EstimateDetailTask {
  id: number;
  name: string;
  order_index: number;
  hours_pm: number;
  hours_web_dev: number;
  hours_ui_ux: number;
  hours_qc_doc: number;
  hours_dev_ops: number;
  role_hours?: Record<string, number>;
  total_hours: number | string;
  total_cost: number | string;
}

interface EstimateDetailModule {
  id: number;
  name: string;
  order_index: number;
  total_hours: number | string;
  total_cost: number | string;
  tasks: EstimateDetailTask[];
}

interface VersionHistoryItem {
  id: number;
  version: number;
  title: string;
  total_hours: number | string;
  total_cost: number | string;
  revision_notes: string | null;
  created_at: string;
  creator_name?: string | null;
  creator_email?: string | null;
}

interface EstimateDetail {
  id: number;
  title: string;
  company_id: number;
  company_name: string;
  company_email?: string | null;
  project_id?: number | null;
  project_name?: string | null;
  service_type_name: string;
  category_name: string;
  tag_name: string | null;
  version: number;
  parent_id?: number | null;
  revision_notes?: string | null;
  created_at: string;
  updated_at?: string;
  creator_name?: string | null;
  creator_email?: string | null;
  updater_name?: string | null;
  updater_email?: string | null;
  total_hours: number | string;
  total_cost: number | string;
  notes?: string | null;
  rate_snapshots: Record<string, RoleSnapshotEntry | number>;
  categories?: { id: number; code: string; name: string }[];
  modules: EstimateDetailModule[];
  maintenance_config?: {
    duration_months: number;
    monthly_cost: number;
    total_cost: number;
    tasks: {
      name: string;
      total_hours: number;
      monthly_cost: number;
      role_hours?: Record<string, number>;
    }[];
  };
  infrastructure_items?: {
    name: string;
    billing_type: 'ONE_TIME' | 'MONTHLY' | 'YEARLY';
    quantity: number;
    unit_cost: number;
    period_count: number;
    total_cost: number;
    notes?: string | null;
  }[];
  operational_items?: {
    name: string;
    people_count: number;
    days_count: number;
    unit_cost_per_day: number;
    total_cost: number;
    notes?: string | null;
  }[];
  billing_summary?: {
    one_time_dev: number;
    one_time_infra: number;
    total_one_time: number;
    monthly_maintenance: number;
    monthly_infra: number;
    total_monthly_recurring: number;
    grand_total: number;
  };
  version_history?: VersionHistoryItem[];
}

const formatIDR = (val: number | string) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return `Rp ${(num || 0).toLocaleString('id-ID')}`;
};

function EstimateDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const estimateId = parseInt(resolvedParams.id, 10);

  const [estimate, setEstimate] = useState<EstimateDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<number | null>(null);
  const [comparison, setComparison] = useState<EstimateDetail | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | 'DEV' | 'MAINTENANCE' | 'INFRASTRUCTURE' | 'OPERATION' | 'HISTORY'>('ALL');

  // Delete state
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (isNaN(estimateId)) {
      setErrorMsg('ID estimasi tidak valid.');
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    fetch(`/api/estimates/${estimateId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (!data.success || !data.estimate) {
          setErrorMsg(data.error || 'Estimasi tidak ditemukan.');
        } else {
          setEstimate(data.estimate);
        }
      })
      .catch((err) => {
        if (isMounted) setErrorMsg(err.message || 'Gagal memuat data estimasi.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [estimateId]);

  useEffect(() => {
    if (compareId === null) return;
    const controller = new AbortController();
    fetch(`/api/estimates/${compareId}`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.success || !data.estimate) throw new Error(data.error || 'Gagal memuat versi pembanding');
        return data.estimate as EstimateDetail;
      })
      .then((data) => {
        if (data.id !== compareId || !data.version_history?.some((v) => v.id === estimateId)) {
          throw new Error('Versi pembanding tidak berada dalam riwayat yang sama');
        }
        setComparison(data);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setComparisonError(error instanceof Error ? error.message : 'Gagal memuat versi pembanding');
      });
    return () => controller.abort();
  }, [compareId, estimateId]);

  const handleDelete = async () => {
    if (!estimate) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/estimates/${estimate.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Gagal menghapus estimasi');
        return;
      }
      router.push('/');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Network error');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <Page>
        <div className="grid min-h-[50vh] place-items-center text-[13px] text-fg-3" aria-busy="true">Memuat detail estimasi #{estimateId}…</div>
      </Page>
    );
  }

  if (errorMsg || !estimate) {
    return (
      <Page>
        <div className="linear-card mx-auto mt-10 max-w-[480px] p-8 text-center">
          <h2 className="mb-3 text-[18px] font-semibold text-bad">Terjadi kesalahan</h2>
          <p className="mb-6 text-[14px] text-fg-2">{errorMsg || 'Data tidak ditemukan.'}</p>
          <Link href="/" className="btn-secondary">Kembali ke beranda</Link>
        </div>
      </Page>
    );
  }

  const modalRoles = estimate.rate_snapshots ? Object.keys(estimate.rate_snapshots) : [];
  const personLabels = snapshotLabels(
    Object.fromEntries(
      Object.entries(estimate.rate_snapshots || {}).filter(([, v]) => typeof v === 'object' && v !== null) as [string, RoleSnapshotEntry][]
    )
  );

  return (
    <Page wide className="pb-[80px]">
        
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-2 text-[12px] text-fg-3">
          <Link href="/" className="inline-flex items-center gap-1.5 no-underline hover:text-fg">
            <ArrowLeft className="size-3.5" aria-hidden /> Costing
          </Link>
          <span aria-hidden>/</span>
          <span className="font-mono text-fg-2">#{estimate.id}</span>
        </nav>

        {/* Header */}
        <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-line pb-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-fg">{estimate.project_name || estimate.title}</h1>
              {estimate.version_history && estimate.version_history.length > 1 ? (
                <select
                  aria-label="Pilih versi dokumen"
                  value={estimate.id}
                  onChange={(e) => {
                    const selectedId = Number(e.target.value);
                    if (selectedId) router.push(`/estimates/${selectedId}`);
                  }}
                  className="linear-select font-mono-numbers"
                  style={{ width: 'auto', minHeight: 28, padding: '2px 28px 2px 10px', fontSize: 12, fontWeight: 600 }}
                  title="Ganti ke versi lain dari dokumen ini"
                >
                  {estimate.version_history.map((vh) => (
                    <option key={vh.id} value={vh.id}>
                      v{vh.version} {vh.id === estimate.id ? '(aktif)' : `(#${vh.id})`} — {formatIDR(vh.total_cost)}
                    </option>
                  ))}
                </select>
              ) : (
                <span className={cn('badge font-mono-numbers', (estimate.version || 1) > 1 ? 'badge-accent' : 'badge-neutral')}>v{estimate.version || 1}</span>
              )}
            </div>
            <p className="mt-2 text-[13px] text-fg-3">
              <span className="text-fg-2">{estimate.company_name}</span> · Dokumen costing #{estimate.id}
              {estimate.parent_id && <> · asal #{estimate.parent_id}</>}
              {estimate.revision_notes && <span className="ml-1 italic text-note">“{estimate.revision_notes}”</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href={`/api/estimates/${estimate.id}/export/excel`} download className="btn-secondary" title="Unduh data costing internal (.xlsx)">
              <FileDown className="size-4" aria-hidden /> Excel
            </a>
            <Link href={`/estimates/${estimate.id}/print`} target="_blank" className="btn-secondary" title="Buka lembar costing internal untuk cetak / PDF">
              <Printer className="size-4" aria-hidden /> Cetak PDF
            </Link>
            <Link href={`/estimates/new?edit_id=${estimate.id}`} className="btn-primary" title="Edit / buat revisi estimasi ini">
              <SquarePen className="size-4" aria-hidden /> Revisi
            </Link>
            <button type="button" onClick={() => setIsDeleteModalOpen(true)} className="btn-secondary" style={{ width: 34, padding: 0, color: 'var(--color-danger)' }} title="Hapus estimasi" aria-label="Hapus estimasi">
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
        </header>

        {/* KPI row */}
        <section aria-label="Ringkasan costing" className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Grand total estimasi kontrak" icon={Wallet} tone="ok" value={formatIDR(estimate.total_cost)} hint="Total biaya modal dokumen ini" />
          <StatCard label="Total jam kerja teknis" icon={Timer} tone="note" value={<>{Number(estimate.total_hours)}<span className="ml-1 text-[13px] font-medium text-fg-3">jam</span></>} hint={`${estimate.modules?.length || 0} modul development`} />
          <StatCard
            label="Kategori & tag"
            icon={Layers}
            tone="plum"
            value={<span className="text-[15px] font-semibold">{(Array.isArray(estimate.categories) && estimate.categories.length > 0 ? estimate.categories.map((c) => c.name) : [estimate.category_name]).filter(Boolean).join(' · ') || '—'}</span>}
            hint={estimate.tag_name ? `Tag: ${estimate.tag_name}` : 'Tanpa tag'}
          />
          <StatCard
            label="Dibuat oleh"
            icon={Clock3}
            value={<span className="text-[15px] font-semibold">{estimate.creator_name || '—'}</span>}
            hint={`Terakhir direvisi: ${estimate.updater_name || '—'}`}
          />
        </section>

        {/* Notes + rate snapshot */}
        {(estimate.notes || (estimate.rate_snapshots && Object.keys(estimate.rate_snapshots).length > 0)) && (
          <section className="linear-card mb-6 divide-y divide-[var(--border-subtle)]">
            {estimate.notes && (
              <div className="px-5 py-4 text-[13px] leading-relaxed text-fg-2">
                <strong className="text-fg">Catatan lingkup kerja & asumsi:</strong> {estimate.notes}
              </div>
            )}
            {estimate.rate_snapshots && Object.keys(estimate.rate_snapshots).length > 0 && (
              <div className="px-5 py-4">
                <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-3">Rate snapshot per jam · tersimpan permanen pada dokumen ini</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(estimate.rate_snapshots).map(([rk, val]) => {
                    const name = typeof val === 'object' && val ? `${val.code} · ${val.name}` : rk;
                    const rVal = typeof val === 'object' && val ? val.rate : val;
                    return (
                      <span key={rk} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 py-1 text-[12px] text-fg-2">
                        <span className="font-medium text-fg">{name}</span>
                        <span className="font-mono-numbers text-ok">{formatIDR(rVal)}/jam</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Tabs */}
        {(() => {
          const tabs: { id: typeof activeTab; label: string; count?: number; icon?: LucideIcon }[] = [
            { id: 'ALL', label: 'Semua rincian' },
            ...(estimate.modules && estimate.modules.length > 0 ? [{ id: 'DEV' as const, label: 'A. Development', count: estimate.modules.length }] : []),
            ...(estimate.maintenance_config ? [{ id: 'MAINTENANCE' as const, label: 'B. Maintenance', count: estimate.maintenance_config.duration_months }] : []),
            ...(estimate.infrastructure_items && estimate.infrastructure_items.length > 0 ? [{ id: 'INFRASTRUCTURE' as const, label: 'C. Infrastructure', count: estimate.infrastructure_items.length }] : []),
            ...(estimate.operational_items && estimate.operational_items.length > 0 ? [{ id: 'OPERATION' as const, label: 'D. Operational', count: estimate.operational_items.length }] : []),
            ...(estimate.version_history && estimate.version_history.length > 1 ? [{ id: 'HISTORY' as const, label: 'Riwayat versi', count: estimate.version_history.length, icon: History }] : []),
          ];
          return (
            <div className="no-scrollbar -mx-1 mb-6 overflow-x-auto px-1">
              <div role="tablist" aria-label="Bagian costing" className="flex w-max min-w-full gap-1 border-b border-line">
                {tabs.map((tab) => {
                  const active = activeTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        '-mb-px inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-3.5 text-[13px] font-medium transition-colors',
                        active ? 'border-[var(--accent-primary)] text-fg' : 'border-transparent text-fg-3 hover:text-fg',
                      )}
                    >
                      {Icon && <Icon className={cn('size-4', active ? 'text-brand-fg' : 'text-fg-3')} aria-hidden />}
                      {tab.label}
                      {tab.count !== undefined && (
                        <span className={cn('font-mono-numbers rounded-full px-1.5 text-[11px]', active ? 'bg-[var(--accent-light)] text-brand-fg' : 'bg-surface-2 text-fg-3')}>{tab.count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Section A: Development WBS Breakdown */}
        {(activeTab === 'ALL' || activeTab === 'DEV') && estimate.modules && estimate.modules.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                A. WBS Development Breakdown ({estimate.modules.length} Modul)
              </div>
              {estimate.billing_summary && (
                <span className="font-mono-numbers" style={{ fontSize: '14px', color: 'var(--color-success)', fontWeight: 600 }}>
                  Total One-Time Dev: {formatIDR(estimate.billing_summary.one_time_dev)}
                </span>
              )}
            </div>

            {estimate.modules.map((mod, mIdx) => (
              <div
                key={mod.id || mIdx}
                className="linear-card-elevated"
                style={{ marginBottom: '16px', overflow: 'hidden' }}
              >
                <div
                  style={{
                    padding: '12px 16px',
                    background: 'rgb(var(--ink-rgb) / 0.03)',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {mod.name}
                  </span>
                  <div style={{ fontSize: '12px' }}>
                    <span className="font-mono-numbers" style={{ color: 'var(--text-secondary)' }}>
                      {Number(mod.total_hours)} Jam
                    </span>
                    <span style={{ color: 'var(--text-tertiary)', margin: '0 6px' }}>•</span>
                    <span className="font-mono-numbers" style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                      {formatIDR(mod.total_cost)}
                    </span>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="linear-table">
                    <thead>
                      <tr>
                        <th style={{ minWidth: '220px' }}>Task</th>
                        {modalRoles.map((rk) => {
                          const rItem = estimate.rate_snapshots?.[rk];
                          const rName = personLabels[rk] || rk;
                          const rFull = typeof rItem === 'object' && rItem ? rItem.name : rk;
                          return (
                            <th key={rk} style={{ textAlign: 'center', minWidth: '65px' }} title={rFull}>
                              {rName}
                            </th>
                          );
                        })}
                        <th style={{ width: '10%', textAlign: 'right', minWidth: '70px' }}>Total Jam</th>
                        <th style={{ width: '15%', textAlign: 'right', minWidth: '100px' }}>Biaya</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mod.tasks.map((task, tIdx) => (
                        <tr key={task.id || tIdx}>
                          <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{task.name}</td>
                          {modalRoles.map((rk) => {
                            const hours: number = Number(task.role_hours?.[rk]) || 0;
                            return (
                              <td key={rk} style={{ textAlign: 'center' }}>
                                {Number(hours) > 0 ? `${hours}h` : '-'}
                              </td>
                            );
                          })}
                          <td style={{ textAlign: 'right' }}>
                            <span className="font-mono-numbers">
                              {Number(task.total_hours)}h
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span className="font-mono-numbers" style={{ color: 'var(--text-primary)' }}>
                              {formatIDR(task.total_cost)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Section B: Maintenance WBS Breakdown */}
        {(activeTab === 'ALL' || activeTab === 'MAINTENANCE') && estimate.maintenance_config && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  B. WBS Maintenance (Monthly Recurring Charge)
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  Durasi Kontrak: {estimate.maintenance_config.duration_months} Bulan • {formatIDR(estimate.maintenance_config.monthly_cost)}/bln
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Total Biaya Kontrak</div>
                <span className="font-mono-numbers" style={{ fontSize: '15px', color: 'var(--color-success)', fontWeight: 700 }}>
                  {formatIDR(estimate.maintenance_config.total_cost)}
                </span>
              </div>
            </div>

            <div className="linear-card-elevated" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="linear-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: '220px' }}>Task Rutin Bulanan</th>
                      {modalRoles.map((rk) => {
                        const rItem = estimate.rate_snapshots?.[rk];
                        const rName = personLabels[rk] || rk;
                          const rFull = typeof rItem === 'object' && rItem ? rItem.name : rk;
                        return (
                          <th key={rk} style={{ textAlign: 'center', minWidth: '65px' }} title={rFull}>
                            {rName}
                          </th>
                        );
                      })}
                      <th style={{ width: '10%', textAlign: 'right' }}>Jam/Bln</th>
                      <th style={{ width: '15%', textAlign: 'right' }}>Biaya/Bln</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimate.maintenance_config.tasks.map((task, mtIdx) => (
                      <tr key={mtIdx}>
                        <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{task.name}</td>
                        {modalRoles.map((rk) => {
                          const hours = task.role_hours && task.role_hours[rk] !== undefined ? Number(task.role_hours[rk]) : 0;
                          return (
                            <td key={rk} style={{ textAlign: 'center' }}>
                              {Number(hours) > 0 ? `${hours}h` : '-'}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'right' }}>
                          <span className="font-mono-numbers">{Number(task.total_hours)}h</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="font-mono-numbers" style={{ color: 'var(--color-info)', fontWeight: 600 }}>
                            {formatIDR(task.monthly_cost)}/bln
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Section C: Infrastructure Items */}
        {(activeTab === 'ALL' || activeTab === 'INFRASTRUCTURE') && estimate.infrastructure_items && estimate.infrastructure_items.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  C. WBS Infrastructure Items ({estimate.infrastructure_items.length} Item)
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  One-Time Hardware/Setup & Recurring Cloud Hosting/Domain
                </div>
              </div>
              {estimate.billing_summary && (
                <div style={{ textAlign: 'right', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>One-Time: </span>
                  <strong style={{ color: 'var(--text-primary)' }}>{formatIDR(estimate.billing_summary.one_time_infra)}</strong>
                  <span style={{ color: 'var(--text-tertiary)', margin: '0 6px' }}>•</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>Recurring: </span>
                  <strong style={{ color: 'var(--color-info)' }}>{formatIDR(estimate.billing_summary.monthly_infra)}</strong>
                </div>
              )}
            </div>

            <div className="linear-card-elevated" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="linear-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>NO</th>
                      <th>ITEM INFRASTRUKTUR</th>
                      <th style={{ width: '130px', textAlign: 'center' }}>TIPE BIAYA</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>QTY</th>
                      <th style={{ width: '140px', textAlign: 'right' }}>UNIT COST</th>
                      <th style={{ width: '90px', textAlign: 'center' }}>PERIODE</th>
                      <th style={{ width: '150px', textAlign: 'right' }}>TOTAL BIAYA</th>
                      <th style={{ width: '200px' }}>CATATAN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimate.infrastructure_items.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>{idx + 1}</td>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.name}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className={
                              item.billing_type === 'ONE_TIME'
                                ? 'badge badge-accent'
                                : item.billing_type === 'MONTHLY'
                                ? 'badge badge-draft'
                                : 'badge badge-warning'
                            }
                            style={{ fontSize: '10px' }}
                          >
                            {item.billing_type}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }} className="font-mono-numbers">{item.quantity}</td>
                        <td style={{ textAlign: 'right' }} className="font-mono-numbers">{formatIDR(item.unit_cost)}</td>
                        <td style={{ textAlign: 'center' }} className="font-mono-numbers">
                          {item.billing_type === 'ONE_TIME' ? '1x' : `${item.period_count} ${item.billing_type === 'MONTHLY' ? 'Bln' : 'Thn'}`}
                        </td>
                        <td className="font-mono-numbers" style={{ textAlign: 'right', color: 'var(--color-success)', fontWeight: 600 }}>
                          {formatIDR(item.total_cost)}
                        </td>
                        <td style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>{item.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Section D: Operational Items */}
        {(activeTab === 'ALL' || activeTab === 'OPERATION') && estimate.operational_items && estimate.operational_items.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  D. Biaya Operasional / Operation Items ({estimate.operational_items.length} Item)
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  Transportasi, hotel, uang harian, dan akomodasi lapangan
                </div>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Subtotal Operational: <strong style={{ color: 'var(--color-success)' }}>{formatIDR(estimate.operational_items.reduce((acc, it) => acc + (Number(it.total_cost) || 0), 0))}</strong>
              </div>
            </div>

            <div style={{ overflowX: 'auto', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <table className="excel-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>NO</th>
                    <th>NAMA ITEM OPERASIONAL</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>ORANG (PAX)</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>HARI</th>
                    <th style={{ width: '140px', textAlign: 'right' }}>RATE/HARI/PAX</th>
                    <th style={{ width: '150px', textAlign: 'right' }}>TOTAL BIAYA</th>
                    <th style={{ width: '200px' }}>CATATAN</th>
                  </tr>
                </thead>
                <tbody>
                  {estimate.operational_items.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>{idx + 1}</td>
                      <td style={{ fontWeight: 500 }}>{item.name}</td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{item.people_count} org</td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{item.days_count} hari</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatIDR(item.unit_cost_per_day)}</td>
                      <td className="font-mono-numbers" style={{ textAlign: 'right', color: 'var(--color-success)', fontWeight: 600, padding: '0 12px' }}>
                        {formatIDR(item.total_cost)}
                      </td>
                      <td style={{ color: 'var(--text-tertiary)', fontSize: '12px', padding: '6px 12px' }}>{item.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: Riwayat Versi / Version History */}
        {(activeTab === 'HISTORY' || activeTab === 'ALL') && estimate.version_history && estimate.version_history.length > 1 && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Riwayat Seluruh Versi & Revisi Estimasi
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  Klik &quot;Buka Versi Ini&quot; untuk beralih ke halaman detail snapshot versi tersebut.
                </div>
              </div>
              <span className="badge badge-accent">
                {estimate.version_history.length} Versi Tersimpan
              </span>
            </div>

            <div className="linear-card-elevated" style={{ overflow: 'hidden' }}>
              <table className="linear-table">
                <thead>
                  <tr>
                    <th style={{ width: '80px', textAlign: 'center' }}>VERSI</th>
                    <th>DOKUMEN & CATATAN PERUBAHAN</th>
                    <th>Dibuat/Direvisi Oleh</th>
                    <th style={{ width: '130px', textAlign: 'center' }}>TANGGAL</th>
                    <th style={{ width: '110px', textAlign: 'right' }}>JAM KERJA</th>
                    <th style={{ width: '160px', textAlign: 'right' }}>TOTAL BIAYA</th>
                    <th style={{ width: '130px', textAlign: 'center' }}>AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {estimate.version_history.map((verItem) => {
                    const isCurrent = verItem.id === estimate.id;
                    return (
                      <tr
                        key={verItem.id}
                        style={{
                          background: isCurrent ? 'rgb(var(--info-rgb) / 0.04)' : undefined,
                        }}
                      >
                        <td style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: isCurrent ? 'rgb(var(--info-rgb) / 0.25)' : 'rgb(var(--ink-rgb) / 0.06)',
                              color: isCurrent ? 'var(--color-info)' : 'var(--text-secondary)',
                              border: isCurrent ? '1px solid rgb(var(--info-rgb) / 0.5)' : '1px solid rgb(var(--ink-rgb) / 0.1)',
                            }}
                          >
                            v{verItem.version}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: isCurrent ? 600 : 400, color: 'var(--text-primary)' }}>
                            #{verItem.id} • {verItem.title}
                            {isCurrent && (
                              <span style={{ fontSize: '10px', color: 'var(--color-info)', marginLeft: '6px', fontWeight: 600 }}>
                                (Halaman Saat Ini)
                              </span>
                            )}
                          </div>
                          {verItem.revision_notes && (
                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px', fontStyle: 'italic' }}>
                              &quot;{verItem.revision_notes}&quot;
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: '11px' }}>{verItem.creator_name || '-'}{verItem.creator_email ? ` (${verItem.creator_email})` : ''}</td>
                        <td style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {new Date(verItem.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                          {Number(verItem.total_hours)}h
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-success)' }}>
                          {formatIDR(verItem.total_cost)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isCurrent ? (
                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Aktif</span>
                          ) : (
                            <Link
                              href={`/estimates/${verItem.id}`}
                              className="btn-secondary"
                              style={{ fontSize: '11px', padding: '3px 8px', textDecoration: 'none', color: 'var(--color-info)', borderColor: 'rgb(var(--info-rgb) / 0.3)' }}
                            >
                              Buka Versi Ini
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'HISTORY' && estimate.version_history && estimate.version_history.length > 1 && (
          <section className="linear-card-elevated" style={{ padding: '20px', marginBottom: '28px' }} aria-label="Perbandingan versi">
            <h2 style={{ fontSize: '16px', marginBottom: '12px' }}>Bandingkan rincian task antar versi</h2>
            <label htmlFor="compare-version" style={{ display: 'block', marginBottom: '8px' }}>Bandingkan v{estimate.version} dengan:</label>
            <select id="compare-version" className="linear-select" style={{ maxWidth: '240px' }} value={compareId ?? ''}
              onChange={(event) => { setComparison(null); setComparisonError(null); setCompareId(event.target.value ? Number(event.target.value) : null); }}>
              <option value="">Pilih versi</option>
              {estimate.version_history.filter((version) => version.id !== estimate.id).map((version) => (
                <option value={version.id} key={version.id}>v{version.version} — #{version.id}</option>
              ))}
            </select>
            {comparisonError && <p role="alert" style={{ color: 'var(--color-danger)', marginTop: '12px' }}>{comparisonError}</p>}
            {compareId !== null && !comparison && !comparisonError && <p role="status" style={{ marginTop: '12px' }}>Memuat perbandingan...</p>}
            {comparison && compareId === comparison.id && (() => {
              const changes = compareVersions(comparison, estimate);
              return <div style={{ overflowX: 'auto', marginTop: '16px' }}>
                <p style={{ marginBottom: '12px' }}>v{comparison.version} → v{estimate.version}. Hanya task dengan perubahan jam atau biaya ditampilkan.</p>
                {changes.length === 0 ? <p>Tidak ada perubahan task atau jam kerja.</p> : (
                  <table className="linear-table" style={{ minWidth: '700px' }}>
                    <thead><tr><th scope="col">MODUL</th><th scope="col">TASK</th><th scope="col">JAM v{comparison.version}</th><th scope="col">JAM v{estimate.version}</th><th scope="col">BIAYA v{comparison.version}</th><th scope="col">BIAYA v{estimate.version}</th></tr></thead>
                    <tbody>{changes.map((row, index) => <tr key={`${row.module}-${row.task}-${index}`}>
                      <td>{row.module}</td><td>{row.task}</td>
                      <td>{row.beforeHours === null ? '—' : `${row.beforeHours}h`}</td>
                      <td>{row.afterHours === null ? '—' : `${row.afterHours}h`}</td>
                      <td>{row.beforeCost === null ? '—' : formatIDR(row.beforeCost)}</td>
                      <td>{row.afterCost === null ? '—' : formatIDR(row.afterCost)}</td>
                    </tr>)}</tbody>
                  </table>
                )}
              </div>;
            })()}
          </section>
        )}

        {/* Delete Confirmation Modal */}
        {isDeleteModalOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgb(8 10 14 / 0.62)',
              backdropFilter: 'blur(6px)',
              zIndex: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
            onClick={() => {
              if (!isDeleting) setIsDeleteModalOpen(false);
            }}
          >
            <div
              className="linear-card"
              style={{
                width: '100%',
                maxWidth: '440px',
                padding: '24px',
                backgroundColor: 'var(--bg-panel)',
                border: '1px solid rgb(var(--danger-rgb) / 0.3)',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Hapus Estimasi #{estimate.id}?
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Apakah Anda yakin ingin menghapus estimasi &quot;{estimate.project_name || estimate.title}&quot;? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isDeleting}
                  onClick={() => setIsDeleteModalOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  style={{
                    background: 'var(--color-danger)',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isDeleting ? 'Menghapus...' : 'Hapus Estimasi'}
                </button>
              </div>
            </div>
          </div>
        )}
    </Page>
  );
}


export default function EstimateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
        Memuat detail estimasi...
      </div>
    }>
      <EstimateDetailContent params={params} />
    </Suspense>
  );
}
