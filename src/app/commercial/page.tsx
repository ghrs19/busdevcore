'use client';

import {
  ClipboardDocumentListIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';


import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Proposal {
  id: number;
  proposal_number: string;
  version: number;
  parent_id: number | null;
  company_name: string;
  project_name: string;
  estimate_title: string;
  estimate_version: number;
  grand_total: string | number;
  margin_percent: string | number;
  is_tax_enabled: boolean;
  validity_days: number;
  deal_status: string;
  lost_reason?: string;
  created_at: string;
  creator_name?: string;
}

const formatIDR = (val: number | string) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return `Rp ${(num || 0).toLocaleString('id-ID')}`;
};

const getStatusBadge = (status: string) => {
  const s = status ? status.toLowerCase() : 'draft';
  switch (s) {
    case 'won':
      return { label: 'Won (Deal)', bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
    case 'negotiation':
      return { label: 'Negotiation', bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
    case 'sent':
      return { label: 'Sent to Client', bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.3)' };
    case 'lost':
      return { label: 'Lost', bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' };
    case 'draft':
    default:
      return { label: 'Draft', bg: 'rgba(255, 255, 255, 0.06)', text: 'var(--text-secondary)', border: 'rgba(255, 255, 255, 0.12)' };
  }
};

export default function CommercialProposalsListPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/commercial');
        const data = await res.json();
        if (data.success && Array.isArray(data.proposals)) {
          setProposals(data.proposals);
        }
      } catch (err) {
        console.error('Failed to load proposals:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filtered = proposals.filter((p) => {
    const currentStatus = p.deal_status || 'draft';
    if (statusFilter !== 'all' && currentStatus !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchNum = p.proposal_number.toLowerCase().includes(q);
      const matchComp = p.company_name.toLowerCase().includes(q);
      const matchProj = p.project_name.toLowerCase().includes(q);
      return matchNum || matchComp || matchProj;
    }
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', paddingBottom: '80px' }}>
      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 20px' }}>
        {/* Top Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '24px',
            paddingBottom: '20px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              Proposal & Komersial Klien
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              CRM Pipeline status deal, penawaran harga final (Quotation), dokumen kontrak SPK & BAST termin.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Link
              href="/audit"
              className="btn-secondary"
              style={{
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              <ClipboardDocumentListIcon style={{ width: "15px", height: "15px" }} />
              <span>Activity Log Global</span>
            </Link>

            <Link
              href="/commercial/new"
              className="btn-primary"
              style={{
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              <span>+</span>
              <span>Buat Penawaran Baru</span>
            </Link>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div
          className="linear-card"
          style={{
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          {/* Status Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'Semua' },
              { id: 'draft', label: 'Draft' },
              { id: 'sent', label: 'Sent' },
              { id: 'negotiation', label: 'Negotiation' },
              { id: 'won', label: 'Won 🎉' },
              { id: 'lost', label: 'Lost' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={statusFilter === tab.id ? 'btn-primary' : 'btn-secondary'}
                style={{
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div style={{ minWidth: '240px', flex: '1', maxWidth: '320px' }}>
            <input
              type="text"
              className="linear-input"
              placeholder="Cari nomor, klien, proyek..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', fontSize: '12px', padding: '6px 12px' }}
            />
          </div>
        </div>

        {/* Table List of Proposals */}
        <div className="linear-card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="pro-table">
              <thead>
                <tr>
                  <th style={{ width: '160px', textAlign: 'left' }}>No. Dokumen</th>
                  <th style={{ minWidth: '200px', textAlign: 'left' }}>Klien & Proyek</th>
                  <th style={{ width: '140px', textAlign: 'center' }}>Pipeline Status</th>
                  <th style={{ width: '160px', textAlign: 'right' }}>Total Penawaran</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Margin</th>
                  <th style={{ width: '120px', textAlign: 'left' }}>Tanggal Terbit</th>
                  <th style={{ width: '190px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
                      Memuat daftar proposal...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
                      Belum ada proposal penawaran untuk kriteria ini.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => {
                    const sb = getStatusBadge(p.deal_status);
                    const dateFormatted = new Date(p.created_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    });

                    return (
                      <tr key={p.id}>
                        {/* No Dokumen & Versi */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Link
                              href={`/commercial/${p.id}`}
                              style={{
                                color: 'var(--accent-hover)',
                                fontWeight: 700,
                                textDecoration: 'none',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '13px',
                              }}
                            >
                              {p.proposal_number}
                            </Link>
                            <span
                              className="linear-badge font-mono-numbers"
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '1px 5px',
                                background: p.version > 1 ? 'rgba(94, 106, 210, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                                color: p.version > 1 ? '#a5b4fc' : 'var(--text-tertiary)',
                              }}
                            >
                              v{p.version}
                            </span>
                          </div>
                        </td>

                        {/* Klien & Proyek */}
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                            {p.company_name}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                            {p.project_name}
                          </div>
                        </td>

                        {/* Status Pipeline Badge */}
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className="linear-badge"
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              background: sb.bg,
                              color: sb.text,
                              border: `1px solid ${sb.border}`,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {sb.label}
                          </span>
                        </td>

                        {/* Total Penawaran */}
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                          {formatIDR(p.grand_total)}
                        </td>

                        {/* Margin */}
                        <td style={{ textAlign: 'center' }}>
                          <span className="linear-badge font-mono-numbers" style={{ fontSize: '11px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }}>
                            +{p.margin_percent}%
                          </span>
                        </td>

                        {/* Tanggal */}
                        <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                          {dateFormatted}
                        </td>

                        {/* Aksi */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <Link
                              href={`/commercial/${p.id}`}
                              className="btn-secondary"
                              style={{ padding: '4px 9px', fontSize: '11px', textDecoration: 'none' }}
                              title="Buka Halaman Detail Proposal"
                            >
                              Detail
                            </Link>
                            <Link
                              href={`/commercial/${p.id}/print`}
                              target="_blank"
                              className="btn-secondary"
                              style={{ padding: '4px 9px', fontSize: '11px', textDecoration: 'none' }}
                              title="Cetak Dokumen PDF A4 Klien"
                            >
                              PDF
                            </Link>
                            <a
                              href={`/api/commercial/${p.id}/export/docx`}
                              download
                              className="btn-secondary"
                              style={{ padding: '4px 9px', fontSize: '11px', textDecoration: 'none', color: '#38bdf8' }}
                              title="Download Format Word (.docx)"
                            >
                              DOCX
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}