'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { type RoleRateMap } from '@/lib/costing';

interface Company {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

interface ServiceType {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
}

interface Category {
  id: number;
  service_type_id: number;
  code: string;
  name: string;
}

interface Tag {
  id: number;
  code: string;
  name: string;
  applies_to_category_code: string;
}

interface SavedEstimate {
  id: number;
  title: string;
  status: string;
  total_hours: string | number;
  total_cost: string | number;
  rate_snapshots: RoleRateMap;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  company_id: number;
  company_name: string;
  service_type_id: number;
  service_type_code: string;
  service_type_name: string;
  category_id: number;
  category_code: string;
  category_name: string;
  tag_id: number | null;
  tag_code: string | null;
  tag_name: string | null;
  module_count: number;
  task_count: number;
}

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

interface EstimateDetail extends SavedEstimate {
  company_email?: string | null;
  modules: EstimateDetailModule[];
}

const formatIDR = (val: number | string) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return `Rp ${(num || 0).toLocaleString('id-ID')}`;
};

export default function HistoricalEstimatesDashboard() {
  const [estimates, setEstimates] = useState<SavedEstimate[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('ALL');
  const [selectedServiceType, setSelectedServiceType] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedTag, setSelectedTag] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('date_desc');

  // Inspect Modal states
  const [inspectId, setInspectId] = useState<number | null>(null);
  const [inspectDetail, setInspectDetail] = useState<EstimateDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Delete Confirmation Modal states
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Toast Notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  // Load initial estimates and metadata
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [estRes, metaRes] = await Promise.all([
        fetch('/api/estimates'),
        fetch('/api/metadata'),
      ]);

      const [estData, metaData] = await Promise.all([
        estRes.json(),
        metaRes.json(),
      ]);

      if (estData.success) {
        setEstimates(estData.estimates || []);
      }
      if (metaData.success) {
        setCompanies(metaData.companies || []);
        setServiceTypes(metaData.serviceTypes || []);
        setCategories(metaData.categories || []);
        setTags(metaData.tags || []);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load estimate detail when inspectId changes
  useEffect(() => {
    if (!inspectId) {
      setInspectDetail(null);
      return;
    }

    let isMounted = true;
    setIsDetailLoading(true);

    fetch(`/api/estimates/${inspectId}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.success && data.estimate) {
          setInspectDetail(data.estimate);
        }
      })
      .catch((err) => {
        console.error('Error fetching estimate detail:', err);
      })
      .finally(() => {
        if (isMounted) setIsDetailLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [inspectId]);

  const handleDeleteEstimate = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    const targetId = deleteTarget.id;
    const targetTitle = deleteTarget.title;

    try {
      const res = await fetch(`/api/estimates/${targetId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setDeleteError(data.error || 'Gagal menghapus estimasi');
        return;
      }

      // 1. Immediately remove from local estimates state -> triggers instant update in table & summary metrics
      setEstimates((prev) => prev.filter((e) => e.id !== targetId));

      // 2. Close inspect modal if it was open for this estimate
      if (inspectId === targetId) {
        setInspectId(null);
        setInspectDetail(null);
      }

      // 3. Close delete confirmation modal
      setDeleteTarget(null);

      // 4. Show success toast notification
      showToast(data.message || `Estimasi "${targetTitle}" (#${targetId}) berhasil dihapus.`);

      // 5. Background re-fetch to ensure sync
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setDeleteError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter & Sort logic
  const filteredEstimates = useMemo(() => {
    return estimates
      .filter((est) => {
        // Search text: project title or company name
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = est.title.toLowerCase().includes(q);
          const matchCompany = est.company_name.toLowerCase().includes(q);
          if (!matchTitle && !matchCompany) return false;
        }

        // Company filter
        if (selectedCompany !== 'ALL') {
          if (String(est.company_id) !== selectedCompany) return false;
        }

        // Service Type filter
        if (selectedServiceType !== 'ALL') {
          if (est.service_type_code !== selectedServiceType) return false;
        }

        // Category filter
        if (selectedCategory !== 'ALL') {
          if (est.category_code !== selectedCategory) return false;
        }

        // Tag filter
        if (selectedTag !== 'ALL') {
          if (selectedTag === 'NONE') {
            if (est.tag_code !== null) return false;
          } else {
            if (est.tag_code !== selectedTag) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const costA = parseFloat(String(a.total_cost)) || 0;
        const costB = parseFloat(String(b.total_cost)) || 0;
        const hoursA = parseFloat(String(a.total_hours)) || 0;
        const hoursB = parseFloat(String(b.total_hours)) || 0;
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();

        switch (sortBy) {
          case 'date_asc':
            return dateA - dateB;
          case 'cost_desc':
            return costB - costA;
          case 'cost_asc':
            return costA - costB;
          case 'hours_desc':
            return hoursB - hoursA;
          case 'hours_asc':
            return hoursA - hoursB;
          case 'date_desc':
          default:
            return dateB - dateA;
        }
      });
  }, [
    estimates,
    searchQuery,
    selectedCompany,
    selectedServiceType,
    selectedCategory,
    selectedTag,
    sortBy,
  ]);

  // Summary Metrics calculated from filtered data
  const metrics = useMemo(() => {
    const totalCount = filteredEstimates.length;
    const totalCost = filteredEstimates.reduce(
      (sum, est) => sum + (parseFloat(String(est.total_cost)) || 0),
      0
    );
    const totalHours = filteredEstimates.reduce(
      (sum, est) => sum + (parseFloat(String(est.total_hours)) || 0),
      0
    );
    const avgCost = totalCount > 0 ? totalCost / totalCount : 0;

    return {
      totalCount,
      totalCost,
      avgCost,
      totalHours,
    };
  }, [filteredEstimates]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedCompany !== 'ALL' ||
    selectedServiceType !== 'ALL' ||
    selectedCategory !== 'ALL' ||
    selectedTag !== 'ALL' ||
    sortBy !== 'date_desc';

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCompany('ALL');
    setSelectedServiceType('ALL');
    setSelectedCategory('ALL');
    setSelectedTag('ALL');
    setSortBy('date_desc');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', paddingBottom: '60px' }}>
      <main style={{ maxWidth: '1360px', margin: '0 auto', padding: '24px' }}>
        {/* Header with Title & Action */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '28px',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
              }}
            >
              Historical Estimates
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              Database arsip kalkulasi costing, monitoring manhours, dan detail breakdown WBS
            </p>
          </div>

          <Link
            href="/estimates/new"
            className="btn-primary"
            style={{ textDecoration: 'none' }}
          >
            + Buat Costing Baru
          </Link>
        </div>

        {/* Summary Metric Cards */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
            marginBottom: '28px',
          }}
        >
          <div className="linear-card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
              Total Estimasi
            </div>
            <div
              className="font-mono-numbers"
              style={{
                fontSize: '28px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginTop: '8px',
              }}
            >
              {metrics.totalCount}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              {estimates.length === metrics.totalCount
                ? 'Semua proyek tersimpan'
                : `Terfilter dari ${estimates.length} total`}
            </div>
          </div>

          <div className="linear-card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
              Total Nilai Biaya
            </div>
            <div
              className="font-mono-numbers"
              style={{
                fontSize: '28px',
                fontWeight: 700,
                color: '#10b981',
                marginTop: '8px',
                letterSpacing: '-0.02em',
              }}
            >
              {formatIDR(metrics.totalCost)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              Akumulasi nilai kontrak estimasi
            </div>
          </div>

          <div className="linear-card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
              Rata-rata Biaya / Project
            </div>
            <div
              className="font-mono-numbers"
              style={{
                fontSize: '28px',
                fontWeight: 700,
                color: 'var(--accent-hover)',
                marginTop: '8px',
                letterSpacing: '-0.02em',
              }}
            >
              {formatIDR(metrics.avgCost)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              Nilai per project estimate
            </div>
          </div>

          <div className="linear-card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
              Total Jam Kerja (Manhours)
            </div>
            <div
              className="font-mono-numbers"
              style={{
                fontSize: '28px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginTop: '8px',
              }}
            >
              {metrics.totalHours} <span style={{ fontSize: '16px', fontWeight: 500 }}>Jam</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              Total estimasi waktu teknis
            </div>
          </div>
        </section>

        {/* Search, Filter & Sort Controls */}
        <section
          className="linear-card"
          style={{
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {/* Top row: Search input & Sort */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: '1 1 300px' }}>
              <input
                type="text"
                className="linear-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari berdasarkan judul proyek atau nama perusahaan..."
                style={{ padding: '9px 14px' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                Urutkan:
              </span>
              <select
                className="linear-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ width: '180px' }}
              >
                <option value="date_desc">Tanggal Terbaru</option>
                <option value="date_asc">Tanggal Terlama</option>
                <option value="cost_desc">Biaya Tertinggi</option>
                <option value="cost_asc">Biaya Terendah</option>
                <option value="hours_desc">Jam Terbanyak</option>
                <option value="hours_asc">Jam Tersedikit</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="btn-secondary"
                style={{ fontSize: '11px', padding: '7px 12px' }}
              >
                Reset Filter
              </button>
            )}
          </div>

          {/* Bottom row: Filter Dropdowns */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            {/* Filter Perusahaan */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                Perusahaan
              </label>
              <select
                className="linear-select"
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
              >
                <option value="ALL">Semua Perusahaan</option>
                {companies.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Service Type */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                Service Type
              </label>
              <select
                className="linear-select"
                value={selectedServiceType}
                onChange={(e) => setSelectedServiceType(e.target.value)}
              >
                <option value="ALL">Semua Service Type</option>
                {serviceTypes.map((st) => (
                  <option key={st.id} value={st.code}>
                    {st.name} {st.code === 'DIGITAL' ? '(Reserved)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Kategori */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                Kategori
              </label>
              <select
                className="linear-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="ALL">Semua Kategori</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.code}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Tag */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                Tag
              </label>
              <select
                className="linear-select"
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
              >
                <option value="ALL">Semua Tag</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.code}>
                    {t.name}
                  </option>
                ))}
                <option value="NONE">Tanpa Tag (Maintenance)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Historical Estimates Table */}
        <section className="linear-card" style={{ overflow: 'hidden' }}>
          {isLoading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
              Memuat data estimates...
            </div>
          ) : filteredEstimates.length === 0 ? (
            <div
              style={{
                padding: '48px',
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontSize: '13px',
              }}
            >
              {estimates.length === 0 ? (
                <div>
                  <p style={{ marginBottom: '16px' }}>Belum ada data project estimate yang tersimpan.</p>
                  <Link href="/estimates/new" className="btn-primary" style={{ textDecoration: 'none' }}>
                    + Buat Costing Pertama
                  </Link>
                </div>
              ) : (
                <div>
                  <p style={{ marginBottom: '12px' }}>Tidak ada estimate yang cocok dengan filter / pencarian.</p>
                  <button type="button" onClick={resetFilters} className="btn-secondary">
                    Reset Filter
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="linear-table">
                <thead>
                  <tr>
                    <th style={{ width: '5%' }}>ID</th>
                    <th style={{ width: '20%' }}>Project Title</th>
                    <th style={{ width: '15%' }}>Company</th>
                    <th style={{ width: '13%' }}>Klasifikasi</th>
                    <th style={{ width: '9%' }}>Tag</th>
                    <th style={{ width: '10%', textAlign: 'right' }}>Total Hours</th>
                    <th style={{ width: '12%', textAlign: 'right' }}>Total Cost</th>
                    <th style={{ width: '6%', textAlign: 'center' }}>Status</th>
                    <th style={{ width: '10%', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEstimates.map((est) => (
                    <tr
                      key={est.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setInspectId(est.id)}
                    >
                      <td>
                        <span
                          className="font-mono-numbers"
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-tertiary)',
                          }}
                        >
                          #{est.id}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {est.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                          {new Date(est.created_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-secondary)' }}>{est.company_name}</span>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {est.category_name}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                          {est.service_type_name}
                        </div>
                      </td>
                      <td>
                        {est.tag_name ? (
                          <span className="badge badge-accent">{est.tag_name}</span>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>-</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="font-mono-numbers" style={{ color: 'var(--text-secondary)' }}>
                          {Number(est.total_hours)}h
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span
                          className="font-mono-numbers"
                          style={{
                            fontWeight: 600,
                            color: '#10b981',
                          }}
                        >
                          {formatIDR(est.total_cost)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-draft">{est.status}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectId(est.id);
                            }}
                            className="btn-secondary"
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                          >
                            Inspect
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(est);
                              setDeleteError(null);
                            }}
                            style={{
                              fontSize: '11px',
                              padding: '4px 8px',
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#ef4444',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title="Hapus Estimasi"
                          >
                            🗑️ Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Inspect Modal with Complete WBS Breakdown */}
        {inspectId !== null && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(6px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
            }}
            onClick={() => setInspectId(null)}
          >
            <div
              className="linear-card"
              style={{
                width: '100%',
                maxWidth: '840px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'var(--bg-panel)',
                boxShadow: '0 24px 48px rgba(0, 0, 0, 0.85)',
                border: '1px solid var(--border-hover)',
                overflow: 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: '18px 24px',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255, 255, 255, 0.02)',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--accent-hover)', fontWeight: 600 }}>
                    ESTIMATE #{inspectId}
                  </div>
                  <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {inspectDetail ? inspectDetail.title : 'Memuat data...'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectId(null)}
                  className="btn-ghost"
                  style={{ fontSize: '16px', padding: '4px 8px' }}
                >
                  ✕
                </button>
              </div>

              {/* Modal Body (Scrollable) */}
              <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                {isDetailLoading || !inspectDetail ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    Memuat rincian modul & task...
                  </div>
                ) : (
                  <>
                    {/* Meta overview cards */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '12px',
                        marginBottom: '20px',
                      }}
                    >
                      <div className="linear-card-elevated" style={{ padding: '12px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Perusahaan</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                          {inspectDetail.company_name}
                        </div>
                      </div>

                      <div className="linear-card-elevated" style={{ padding: '12px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Klasifikasi</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                          {inspectDetail.category_name}{' '}
                          {inspectDetail.tag_name ? `(${inspectDetail.tag_name})` : ''}
                        </div>
                      </div>

                      <div className="linear-card-elevated" style={{ padding: '12px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Total Jam Kerja</div>
                        <div
                          className="font-mono-numbers"
                          style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}
                        >
                          {Number(inspectDetail.total_hours)} Jam
                        </div>
                      </div>

                      <div className="linear-card-elevated" style={{ padding: '12px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Total Biaya</div>
                        <div
                          className="font-mono-numbers"
                          style={{ fontSize: '14px', fontWeight: 700, color: '#10b981', marginTop: '2px' }}
                        >
                          {formatIDR(inspectDetail.total_cost)}
                        </div>
                      </div>
                    </div>

                    {inspectDetail.notes && (
                      <div
                        className="linear-card-elevated"
                        style={{ padding: '12px 16px', marginBottom: '20px', fontSize: '12px', color: 'var(--text-secondary)' }}
                      >
                        <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>Catatan: </span>
                        {inspectDetail.notes}
                      </div>
                    )}

                    {inspectDetail.rate_snapshots && Object.keys(inspectDetail.rate_snapshots).length > 0 && (
                      <div
                        className="linear-card-elevated"
                        style={{ padding: '12px 16px', marginBottom: '16px' }}
                      >
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                          Master Rate Snapshot per Jam
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {Object.entries(inspectDetail.rate_snapshots).map(([rCode, rRate]) => (
                            <span
                              key={rCode}
                              className="linear-badge"
                              style={{ background: 'rgba(255, 255, 255, 0.04)', fontSize: '11px', padding: '4px 8px' }}
                            >
                              <strong style={{ color: 'var(--text-primary)', marginRight: '4px' }}>{rCode}:</strong>
                              {formatIDR(rRate)}/jam
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Breakdown Modules & Tasks Matrix */}
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
                        Rincian WBS Breakdown Modul & Tasks ({inspectDetail.modules.length} Modul)
                      </div>

                      {(() => {
                        const modalRoles = inspectDetail.rate_snapshots && Object.keys(inspectDetail.rate_snapshots).length > 0
                          ? Object.keys(inspectDetail.rate_snapshots)
                          : ['PM', 'WEB_DEV', 'UI_UX', 'QC_DOC', 'DEV_OPS'];

                        return inspectDetail.modules.map((mod, mIdx) => (
                          <div
                            key={mod.id || mIdx}
                            className="linear-card-elevated"
                            style={{ marginBottom: '16px', overflow: 'hidden' }}
                          >
                            <div
                              style={{
                                padding: '10px 14px',
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
                                    <th style={{ minWidth: '180px' }}>Task</th>
                                    {modalRoles.map((rk) => (
                                      <th key={rk} style={{ textAlign: 'center', minWidth: '60px' }}>
                                        {rk}
                                      </th>
                                    ))}
                                    <th style={{ width: '10%', textAlign: 'right', minWidth: '60px' }}>Jam</th>
                                    <th style={{ width: '15%', textAlign: 'right', minWidth: '90px' }}>Biaya</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {mod.tasks.map((task, tIdx) => (
                                    <tr key={task.id || tIdx}>
                                      <td style={{ color: 'var(--text-primary)' }}>{task.name}</td>
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
                                            {Number(hours) > 0 ? hours : '-'}
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
                        ));
                      })()}
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '14px 24px',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255, 255, 255, 0.02)',
                }}
              >
                {inspectDetail ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteTarget(inspectDetail);
                      setDeleteError(null);
                    }}
                    style={{
                      fontSize: '12px',
                      padding: '6px 14px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#ef4444',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: 500,
                    }}
                  >
                    🗑️ Hapus Estimasi
                  </button>
                ) : (
                  <div />
                )}
                <button
                  type="button"
                  onClick={() => setInspectId(null)}
                  className="btn-secondary"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteTarget && (
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
              if (!isDeleting) {
                setDeleteTarget(null);
                setDeleteError(null);
              }
            }}
          >
            <div
              className="linear-card"
              style={{
                width: '100%',
                maxWidth: '480px',
                padding: '24px',
                background: '#121417',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Konfirmasi Hapus Estimasi
                </h3>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeleteError(null);
                  }}
                  disabled={isDeleting}
                  style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}
                >
                  ✕
                </button>
              </div>

              {deleteError ? (
                <div
                  style={{
                    padding: '10px 14px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    borderRadius: '6px',
                    fontSize: '12px',
                    marginBottom: '16px',
                    lineHeight: 1.5,
                  }}
                >
                  ⚠️ {deleteError}
                </div>
              ) : (
                <div
                  style={{
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    marginBottom: '20px',
                    lineHeight: 1.6,
                  }}
                >
                  Apakah Anda yakin ingin menghapus estimasi{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget.title}</strong>{' '}
                  (#{deleteTarget.id})?
                  <div
                    style={{
                      marginTop: '8px',
                      fontSize: '12px',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    Seluruh modul dan task pada estimasi ini akan dihapus secara permanen dari database. Tindakan ini tidak dapat dibatalkan.
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeleteError(null);
                  }}
                  disabled={isDeleting}
                >
                  {deleteError ? 'Tutup' : 'Batal'}
                </button>
                {!deleteError && (
                  <button
                    type="button"
                    onClick={handleDeleteEstimate}
                    disabled={isDeleting}
                    style={{
                      background: '#ef4444',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: isDeleting ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {isDeleting ? 'Menghapus...' : 'Hapus Estimasi'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toastMessage && (
          <div
            style={{
              position: 'fixed',
              top: '24px',
              right: '24px',
              zIndex: 300,
              padding: '12px 20px',
              borderRadius: '8px',
              backgroundColor: '#10b981',
              color: '#ffffff',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            <span>✓ {toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '0 2px',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
