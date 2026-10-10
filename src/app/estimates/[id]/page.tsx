'use client';

import React, { useState, useEffect, use, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { compareVersions } from '@/lib/version-diff';
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
      <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
        Memuat detail estimasi #{estimateId}...
      </div>
    );
  }

  if (errorMsg || !estimate) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', padding: '40px 24px', textAlign: 'center' }}>
        <div className="linear-card" style={{ maxWidth: '480px', margin: '0 auto', padding: '32px' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '12px', fontSize: '18px' }}>Terjadi Kesalahan</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>{errorMsg || 'Data tidak ditemukan.'}</p>
          <Link href="/" className="btn-secondary" style={{ textDecoration: 'none' }}>
            ← Kembali ke Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const modalRoles = estimate.rate_snapshots && Object.keys(estimate.rate_snapshots).length > 0
    ? Object.keys(estimate.rate_snapshots)
    : ['PM', 'WEB_DEV', 'UI_UX', 'QC_DOC', 'DEV_OPS'];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', paddingBottom: '80px' }}>
      <main style={{ maxWidth: '1360px', margin: '0 auto', padding: '24px' }}>
        
        {/* Top Breadcrumb & Actions Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--text-tertiary)',
                textDecoration: 'none',
                fontSize: '13px',
              }}
            >
              ← Dashboard Estimasi
            </Link>
            <span style={{ color: 'var(--text-tertiary)' }}>/</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              Dokumen #{estimate.id}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a
              href={`/api/estimates/${estimate.id}/export/excel`}
              download
              className="btn-secondary"
              style={{
                height: '32px',
                padding: '0 12px',
                textDecoration: 'none',
                color: '#10b981',
                borderColor: 'rgba(16, 185, 129, 0.4)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '6px',
              }}
              title="Download Data Costing Internal Format Excel (.xlsx)"
            >
              <span>📊 Export Excel</span>
            </a>

            <Link
              href={`/estimates/${estimate.id}/print`}
              target="_blank"
              className="btn-secondary"
              style={{
                height: '32px',
                padding: '0 12px',
                textDecoration: 'none',
                color: '#38bdf8',
                borderColor: 'rgba(56, 189, 248, 0.4)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '6px',
              }}
              title="Buka Lembar Costing Internal untuk Cetak atau Simpan ke PDF"
            >
              <span>📄 Cetak PDF</span>
            </Link>

            <Link
              href={`/estimates/new?edit_id=${estimate.id}`}
              className="btn-primary"
              style={{
                height: '32px',
                padding: '0 12px',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '6px',
              }}
              title="Edit / Buat Revisi Estimasi ini"
            >
              <span>✏️ Edit Revisi</span>
            </Link>
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              style={{
                width: '32px',
                height: '32px',
                minWidth: '32px',
                padding: 0,
                fontSize: '13px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Hapus Estimasi"
            >
              🗑️
            </button>
          </div>
        </div>

        {/* Header Document Banner */}
        <div
          className="linear-card"
          style={{
            padding: '24px',
            marginBottom: '20px',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: 'var(--accent-hover)', fontWeight: 700, letterSpacing: '0.04em' }}>
                  ESTIMATE #{estimate.id}
                </span>

                {/* Interactive Version Selector Dropdown */}
                {estimate.version_history && estimate.version_history.length > 1 ? (
                  <select
                    value={estimate.id}
                    onChange={(e) => {
                      const selectedId = Number(e.target.value);
                      if (selectedId) router.push(`/estimates/${selectedId}`);
                    }}
                    className="input-linear"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      height: '24px',
                      color: '#38bdf8',
                      backgroundColor: 'rgba(56, 189, 248, 0.12)',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                    title="Ganti ke versi lain dari dokumen ini"
                  >
                    {estimate.version_history.map((vh) => (
                      <option key={vh.id} value={vh.id} style={{ background: '#13161a', color: '#fff' }}>
                        Versi v{vh.version} {vh.id === estimate.id ? '(Aktif)' : `(#${vh.id})`} — {formatIDR(vh.total_cost)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: (estimate.version && estimate.version > 1) ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                      color: (estimate.version && estimate.version > 1) ? '#38bdf8' : 'var(--text-secondary)',
                      border: (estimate.version && estimate.version > 1) ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    v{estimate.version || 1}
                  </span>
                )}

                {estimate.parent_id && (
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    • Dokumen Asal: #{estimate.parent_id}
                  </span>
                )}
                {estimate.revision_notes && (
                  <span style={{ fontSize: '11px', color: '#38bdf8', fontStyle: 'italic' }}>
                    &quot;{estimate.revision_notes}&quot;
                  </span>
                )}
              </div>

              <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {estimate.project_name || estimate.title}
              </h1>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Grand Total Estimasi Kontrak</div>
              <div className="font-mono-numbers" style={{ fontSize: '28px', fontWeight: 800, color: '#10b981' }}>
                {formatIDR(estimate.total_cost)}
              </div>
            </div>
          </div>

          {/* Metadata Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <div className="linear-card-elevated" style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Perusahaan (Klien)</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '3px' }}>
                {estimate.company_name}
              </div>
            </div>

            <div className="linear-card-elevated" style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Project Perusahaan</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '3px' }}>
                {estimate.project_name || estimate.title}
              </div>
            </div>

            <div className="linear-card-elevated" style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Kategori & Tag</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                {Array.isArray(estimate.categories) && estimate.categories.length > 0 ? (
                  estimate.categories.map((c) => (
                    <span key={c.id} className="badge badge-accent" style={{ fontSize: '10px' }}>
                      {c.name}
                    </span>
                  ))
                ) : (
                  <span className="badge badge-accent" style={{ fontSize: '10px' }}>
                    {estimate.category_name}
                  </span>
                )}
                {estimate.tag_name && (
                  <span className="badge badge-draft" style={{ fontSize: '10px' }}>
                    {estimate.tag_name}
                  </span>
                )}
              </div>
            </div>

            <div className="linear-card-elevated" style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Total Jam Kerja Teknis</div>
              <div className="font-mono-numbers" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '3px' }}>
                {Number(estimate.total_hours)} Jam
              </div>
            </div>
          </div>

          {/* Project Notes Banner */}
          {estimate.notes && (
            <div
              style={{
                marginTop: '16px',
                padding: '12px 16px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: 'var(--text-primary)' }}>Catatan Lingkup Kerja & Asumsi:</strong> {estimate.notes}
            </div>
          )}

          {/* Rate Snapshot Banner */}
          <div
            style={{
              marginTop: '12px',
              padding: '12px 16px',
              background: 'rgba(255, 255, 255, 0.015)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '8px' }}>
              Master Rate Snapshot per Jam (Tersimpan Permanen pada Dokumen Ini):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {estimate.rate_snapshots && Object.entries(estimate.rate_snapshots).map(([rk, val]) => {
                const name = typeof val === 'object' && val ? (val.name || val.code) : rk;
                const rVal = typeof val === 'object' && val ? val.rate : val;
                return (
                  <span
                    key={rk}
                    style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <strong>{name}:</strong> <span style={{ color: '#10b981' }}>{formatIDR(rVal)}/jam</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={activeTab === 'ALL' ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            Semua Rincian Breakdown
          </button>
          {estimate.modules && estimate.modules.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('DEV')}
              className={activeTab === 'DEV' ? 'btn-primary' : 'btn-secondary'}
              style={{ fontSize: '12px', padding: '6px 14px' }}
            >
              A. Development WBS ({estimate.modules.length} Modul)
            </button>
          )}
          {estimate.maintenance_config && (
            <button
              type="button"
              onClick={() => setActiveTab('MAINTENANCE')}
              className={activeTab === 'MAINTENANCE' ? 'btn-primary' : 'btn-secondary'}
              style={{ fontSize: '12px', padding: '6px 14px' }}
            >
              B. Maintenance WBS ({estimate.maintenance_config.duration_months} Bln)
            </button>
          )}
          {estimate.infrastructure_items && estimate.infrastructure_items.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('INFRASTRUCTURE')}
              className={activeTab === 'INFRASTRUCTURE' ? 'btn-primary' : 'btn-secondary'}
              style={{ fontSize: '12px', padding: '6px 14px' }}
            >
              C. Infrastructure Items ({estimate.infrastructure_items.length})
            </button>
          )}
          {estimate.operational_items && estimate.operational_items.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('OPERATION')}
              className={activeTab === 'OPERATION' ? 'btn-primary' : 'btn-secondary'}
              style={{ fontSize: '12px', padding: '6px 14px' }}
            >
              D. Operational Items ({estimate.operational_items.length})
            </button>
          )}
          {estimate.version_history && estimate.version_history.length > 1 && (
            <button
              type="button"
              onClick={() => setActiveTab('HISTORY')}
              className={activeTab === 'HISTORY' ? 'btn-primary' : 'btn-secondary'}
              style={{ fontSize: '12px', padding: '6px 14px', borderColor: 'rgba(56, 189, 248, 0.4)', color: activeTab === 'HISTORY' ? '#fff' : '#38bdf8' }}
            >
              📜 Riwayat Versi Revisi ({estimate.version_history.length})
            </button>
          )}
        </div>

        {/* Section A: Development WBS Breakdown */}
        {(activeTab === 'ALL' || activeTab === 'DEV') && estimate.modules && estimate.modules.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                A. WBS Development Breakdown ({estimate.modules.length} Modul)
              </div>
              {estimate.billing_summary && (
                <span className="font-mono-numbers" style={{ fontSize: '14px', color: '#10b981', fontWeight: 600 }}>
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
                    background: 'rgba(255, 255, 255, 0.03)',
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
                    <span className="font-mono-numbers" style={{ color: '#10b981', fontWeight: 600 }}>
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
                          const rName = typeof rItem === 'object' && rItem ? (rItem.name || rItem.code) : rk;
                          return (
                            <th key={rk} style={{ textAlign: 'center', minWidth: '65px' }} title={rName}>
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
                            let hours: number | string = 0;
                            if (task.role_hours && task.role_hours[rk] !== undefined) {
                              hours = Number(task.role_hours[rk]) || 0;
                            } else if (rk === 'PM') {
                              hours = Number(task.hours_pm) || 0;
                            } else if (rk === 'WEB_DEV') {
                              hours = Number(task.hours_web_dev) || 0;
                            } else if (rk === 'UI_UX') {
                              hours = Number(task.hours_ui_ux) || 0;
                            } else if (rk === 'QC_DOC') {
                              hours = Number(task.hours_qc_doc) || 0;
                            } else if (rk === 'DEV_OPS') {
                              hours = Number(task.hours_dev_ops) || 0;
                            }
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
                <span className="font-mono-numbers" style={{ fontSize: '15px', color: '#10b981', fontWeight: 700 }}>
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
                        const rName = typeof rItem === 'object' && rItem ? (rItem.name || rItem.code) : rk;
                        return (
                          <th key={rk} style={{ textAlign: 'center', minWidth: '65px' }} title={rName}>
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
                          <span className="font-mono-numbers" style={{ color: '#38bdf8', fontWeight: 600 }}>
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
                  <strong style={{ color: '#38bdf8' }}>{formatIDR(estimate.billing_summary.monthly_infra)}</strong>
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
                        <td className="font-mono-numbers" style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
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
                Subtotal Operational: <strong style={{ color: '#10b981' }}>{formatIDR(estimate.operational_items.reduce((acc, it) => acc + (Number(it.total_cost) || 0), 0))}</strong>
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
                      <td className="font-mono-numbers" style={{ textAlign: 'right', color: '#10b981', fontWeight: 600, padding: '0 12px' }}>
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
                  📜 Riwayat Seluruh Versi & Revisi Estimasi
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
                          background: isCurrent ? 'rgba(56, 189, 248, 0.04)' : undefined,
                        }}
                      >
                        <td style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: isCurrent ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                              color: isCurrent ? '#38bdf8' : 'var(--text-secondary)',
                              border: isCurrent ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                            }}
                          >
                            v{verItem.version}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: isCurrent ? 600 : 400, color: isCurrent ? '#fff' : 'var(--text-primary)' }}>
                            #{verItem.id} • {verItem.title}
                            {isCurrent && (
                              <span style={{ fontSize: '10px', color: '#38bdf8', marginLeft: '6px', fontWeight: 600 }}>
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
                        <td style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {new Date(verItem.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                          {Number(verItem.total_hours)}h
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#10b981' }}>
                          {formatIDR(verItem.total_cost)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isCurrent ? (
                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Aktif</span>
                          ) : (
                            <Link
                              href={`/estimates/${verItem.id}`}
                              className="btn-secondary"
                              style={{ fontSize: '11px', padding: '3px 8px', textDecoration: 'none', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}
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
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
                border: '1px solid rgba(239, 68, 68, 0.3)',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
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
                    background: '#ef4444',
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
      </main>
    </div>
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
