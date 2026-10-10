'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Proposal {
  id: number;
  proposal_number: string;
  company_id: number;
  company_name: string;
  project_id: number;
  project_name: string;
  estimate_id: number;
  estimate_title: string;
  estimate_version: number;
  cogs_amount: string | number;
  margin_percent: string | number;
  base_price: string | number;
  discount_value: string | number;
  grand_total: string | number;
  validity_days: number;
  creator_name: string | null;
  created_at: string;
}

const formatIDR = (val: number | string) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return `Rp ${(num || 0).toLocaleString('id-ID')}`;
};

export default function CommercialProposalsListPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchProposals = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/commercial');
      const data = await res.json();
      if (data.success && Array.isArray(data.proposals)) {
        setProposals(data.proposals);
      } else {
        setErrorMsg(data.error || 'Gagal memuat proposal penawaran');
      }
    } catch {
      setErrorMsg('Gagal terhubung ke database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const handleDelete = async (id: number, number: string) => {
    if (!confirm(`Hapus proposal penawaran ${number}?`)) return;
    try {
      const res = await fetch(`/api/commercial/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setProposals((prev) => prev.filter((p) => p.id !== id));
      } else {
        alert(data.error || 'Gagal menghapus proposal');
      }
    } catch {
      alert('Terjadi kesalahan jaringan');
    }
  };

  const filteredProposals = proposals.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.proposal_number.toLowerCase().includes(q) ||
      p.company_name.toLowerCase().includes(q) ||
      p.project_name.toLowerCase().includes(q) ||
      p.estimate_title.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', paddingBottom: '60px' }}>
      <main style={{ maxWidth: '1360px', margin: '0 auto', padding: '24px' }}>
        {/* Header */}
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
                margin: 0,
              }}
            >
              Proposal & Penawaran Klien
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              Manajemen kalkulasi komersial resmi (Quotation), margin keuntungan, diskon, dan proposal siap cetak
            </p>
          </div>

          <Link
            href="/commercial/new"
            className="btn-primary"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <span>+ Buat Penawaran Baru</span>
          </Link>
        </div>

        {/* Search Bar */}
        <div
          className="linear-card"
          style={{
            padding: '14px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span style={{ color: 'var(--text-tertiary)' }}>🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari berdasarkan nomor penawaran, nama klien, proyek, atau estimasi..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '13px',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="btn-ghost"
              style={{ padding: '2px 8px', fontSize: '11px' }}
            >
              Reset
            </button>
          )}
        </div>

        {errorMsg && (
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
            {errorMsg}
          </div>
        )}

        {/* Proposals Table */}
        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <table className="excel-table">
            <thead>
              <tr>
                <th style={{ width: '150px', textAlign: 'left' }}>No. Penawaran</th>
                <th style={{ minWidth: '180px', textAlign: 'left' }}>Klien & Proyek</th>
                <th style={{ minWidth: '180px', textAlign: 'left' }}>Baseline Estimate</th>
                <th style={{ width: '130px', textAlign: 'right' }}>COGS Internal</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Margin</th>
                <th style={{ width: '150px', textAlign: 'right' }}>Total Penawaran</th>
                <th style={{ width: '110px', textAlign: 'center' }}>Dibuat Oleh</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-tertiary)' }}>
                    Memuat daftar proposal komersial...
                  </td>
                </tr>
              ) : filteredProposals.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
                    {search ? 'Tidak ada penawaran yang cocok dengan pencarian.' : 'Belum ada proposal penawaran komersial.'}
                    <div style={{ marginTop: '10px' }}>
                      <Link href="/commercial/new" className="btn-secondary" style={{ textDecoration: 'none', fontSize: '12px' }}>
                        + Buat Proposal Penawaran Sekarang
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProposals.map((p) => {
                  const grossProfit = Number(p.grand_total) - Number(p.cogs_amount);
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, color: 'var(--accent-hover)' }}>
                        {p.proposal_number}
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{p.project_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{p.company_name}</div>
                      </td>
                      <td>
                        <div style={{ color: 'var(--text-secondary)' }}>
                          {p.estimate_title} <span className="linear-badge" style={{ fontSize: '10px' }}>v{p.estimate_version}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {formatIDR(p.cogs_amount)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className="linear-badge"
                          style={{
                            fontSize: '11px',
                            color: '#10b981',
                            background: 'rgba(16, 185, 129, 0.1)',
                          }}
                        >
                          +{p.margin_percent}%
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                        {formatIDR(p.grand_total)}
                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 400 }}>
                          Laba: +{formatIDR(grossProfit)}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {p.creator_name || '-'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Link
                            href={`/commercial/${p.id}/print`}
                            target="_blank"
                            className="btn-secondary"
                            style={{
                              padding: '3px 8px',
                              fontSize: '11px',
                              textDecoration: 'none',
                              color: '#38bdf8',
                              borderColor: 'rgba(56, 189, 248, 0.3)',
                            }}
                            title="Buka Lembar Cetak Proposal Klien"
                          >
                            📄 Proposal
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id, p.proposal_number)}
                            className="btn-ghost"
                            style={{
                              padding: '3px 6px',
                              fontSize: '12px',
                              color: 'var(--color-danger)',
                            }}
                            title="Hapus Proposal"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
