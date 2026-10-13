'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ClipboardList, Download, FileText, Plus, Printer, Search, X } from 'lucide-react';
import { Page, PageHeader } from '@/components/ui/Page';
import DataGrid from '@/components/ui/DataGrid';

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

const STATUS: Record<string, { label: string; cls: string }> = {
  won: { label: 'Won', cls: 'badge-connected' },
  negotiation: { label: 'Negosiasi', cls: 'badge-warning' },
  sent: { label: 'Terkirim', cls: 'badge-info' },
  lost: { label: 'Lost', cls: 'badge-danger' },
  draft: { label: 'Draft', cls: 'badge-neutral' },
};

const TABS = [
  { id: 'all', label: 'Semua' },
  { id: 'draft', label: 'Draft' },
  { id: 'sent', label: 'Terkirim' },
  { id: 'negotiation', label: 'Negosiasi' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
];

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

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: proposals.length };
    for (const p of proposals) {
      const k = p.deal_status || 'draft';
      c[k] = (c[k] || 0) + 1;
    }
    return c;
  }, [proposals]);

  const filtered = proposals.filter((p) => {
    const currentStatus = p.deal_status || 'draft';
    if (statusFilter !== 'all' && currentStatus !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return p.proposal_number.toLowerCase().includes(q) || p.company_name.toLowerCase().includes(q) || p.project_name.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <Page wide>
      <PageHeader
        eyebrow="Komersial"
        title="Proposal & komersial klien"
        description="Pipeline status deal, penawaran harga final, serta dokumen kontrak SPK dan BAST termin."
        actions={
          <>
            <Link href="/audit" className="btn-secondary">
              <ClipboardList className="size-4" aria-hidden /> Activity log
            </Link>
            <Link href="/commercial/new" className="btn-primary">
              <Plus className="size-4" aria-hidden /> Penawaran baru
            </Link>
          </>
        }
      />

      <div className="linear-card overflow-hidden">
        <div className="commercial-toolbar">
          <div className="commercial-status-scroll no-scrollbar">
            <div className="pill-group commercial-status-pills" role="tablist" aria-label="Filter status proposal">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`pill-item${statusFilter === tab.id ? ' active' : ''}`}
                >
                  {tab.label}
                  <span className="font-mono-numbers text-[11px] text-fg-3">{counts[tab.id] || 0}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="commercial-search relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
            <input
              type="search"
              className="linear-input"
              style={{ paddingLeft: 36, paddingRight: searchTerm ? 34 : 12 }}
              placeholder="Cari nomor, klien, proyek…"
              aria-label="Cari proposal"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button type="button" onClick={() => setSearchTerm('')} aria-label="Hapus pencarian" className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-fg-3 hover:bg-[var(--row-hover)] hover:text-fg">
                <X className="size-3.5" aria-hidden />
              </button>
            )}
          </div>
        </div>
        <DataGrid densityToggle={false}>
          <table className="pro-table" style={{ minWidth: 980 }}>
          <thead>
            <tr>
              <th style={{ width: 190 }}>No. dokumen</th>
              <th style={{ minWidth: 260 }}>Klien & proyek</th>
              <th style={{ width: 130 }}>Status</th>
              <th className="cell-num" style={{ width: 170, textAlign: 'right' }}>Total penawaran</th>
              <th className="cell-num" style={{ width: 90, textAlign: 'right' }}>Margin</th>
              <th style={{ width: 130 }}>Tanggal terbit</th>
              <th style={{ width: 150, textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="dg-empty">Memuat daftar proposal…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="dg-empty">Belum ada proposal untuk kriteria ini.</td>
              </tr>
            ) : (
              filtered.map((p) => {
                const sb = STATUS[(p.deal_status || 'draft').toLowerCase()] || STATUS.draft;
                const dateFormatted = new Date(p.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Link href={`/commercial/${p.id}`} className="font-mono text-[12.5px] font-semibold text-brand-fg no-underline hover:underline">
                          {p.proposal_number}
                        </Link>
                        <span className={`badge font-mono-numbers ${p.version > 1 ? 'badge-accent' : 'badge-neutral'}`} style={{ padding: '0 6px', fontSize: 10.5 }}>
                          v{p.version}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="cell-strong cell-trunc" style={{ maxWidth: '44ch' }} title={p.company_name}>{p.company_name}</div>
                      <div className="cell-trunc mt-0.5 text-[12px] text-fg-3" style={{ maxWidth: '44ch' }} title={p.project_name}>{p.project_name}</div>
                    </td>
                    <td>
                      <span className={`badge ${sb.cls}`}>
                        <span className="badge-dot" /> {sb.label}
                      </span>
                    </td>
                    <td className="cell-num font-mono-numbers cell-strong">{formatIDR(p.grand_total)}</td>
                    <td className="cell-num font-mono-numbers">{p.margin_percent}%</td>
                    <td className="whitespace-nowrap text-[12.5px]">{dateFormatted}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/commercial/${p.id}`} className="btn-secondary" title="Buka halaman detail proposal" style={{ minHeight: 30, padding: '0 10px' }}>
                          <FileText className="size-3.5" aria-hidden /> Detail
                        </Link>
                        <Link href={`/commercial/${p.id}/print`} target="_blank" className="btn-secondary" title="Cetak dokumen PDF A4 klien" aria-label="Cetak PDF" style={{ minHeight: 30, width: 30, padding: 0 }}>
                          <Printer className="size-3.5" aria-hidden />
                        </Link>
                        <a href={`/api/commercial/${p.id}/export/docx`} download className="btn-secondary" title="Unduh format Word (.docx)" aria-label="Unduh DOCX" style={{ minHeight: 30, width: 30, padding: 0 }}>
                          <Download className="size-3.5" aria-hidden />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          </table>
        </DataGrid>
      </div>
    </Page>
  );
}
