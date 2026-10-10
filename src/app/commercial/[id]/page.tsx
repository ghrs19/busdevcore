'use client';

import { Suspense } from 'react';
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

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
  discount_type: string;
  discount_value: string | number;
  subtotal_after_discount: string | number;
  is_tax_enabled: boolean;
  tax_amount: string | number;
  grand_total: string | number;
  validity_days: number;
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

const formatIDR = (val: number | string) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return `Rp ${(num || 0).toLocaleString('id-ID')}`;
};

function CommercialProposalDetailContent() {
  const params = useParams();
  const id = params?.id as string;

  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [versionHistory, setVersionHistory] = useState<VersionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    async function loadProposal() {
      try {
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
      } catch {
        setErrorMsg('Gagal terhubung ke database');
      } finally {
        setLoading(false);
      }
    }
    loadProposal();
  }, [id]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
        Memuat detail proposal komersial...
      </div>
    );
  }

  if (errorMsg || !proposal) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', padding: '60px 20px', textAlign: 'center', color: 'var(--color-danger)' }}>
        {errorMsg || 'Proposal tidak ditemukan.'}
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

  const grossProfit = Number(proposal.grand_total) - Number(proposal.cogs_amount);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', paddingBottom: '80px' }}>
      <main style={{ maxWidth: '1240px', margin: '0 auto', padding: '24px' }}>
        {/* Top Header & Breadcrumb */}
        <div style={{ marginBottom: '24px' }}>
          <Link
            href="/commercial"
            style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '8px',
            }}
          >
            ← Kembali ke Daftar Proposal Penawaran
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                  {proposal.proposal_number}
                </h1>
                <span
                  className="linear-badge font-mono-numbers"
                  style={{
                    fontSize: '12px',
                    padding: '3px 8px',
                    background: (proposal.version || 1) > 1 ? 'rgba(94, 106, 210, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                    color: (proposal.version || 1) > 1 ? '#a5b4fc' : 'var(--text-primary)',
                    fontWeight: 700,
                  }}
                >
                  Versi v{proposal.version || 1}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                {proposal.project_name} • Klien: {proposal.company_name} • Diterbitkan: {dateFormatted}
              </p>
            </div>

            {/* Main Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <a
                href={`/api/commercial/${proposal.id}/export/docx`}
                download
                className="btn-secondary"
                style={{
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#38bdf8',
                  borderColor: 'rgba(56, 189, 248, 0.35)',
                }}
                title="Download Proposal Resmi Format Word (.docx)"
              >
                <span>📥</span>
                <span>Download Word (.docx)</span>
              </a>

              <Link
                href={`/commercial/${proposal.id}/print`}
                target="_blank"
                className="btn-secondary"
                style={{
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                title="Buka Lembar Cetak Proposal PDF A4 Klien"
              >
                <span>📄</span>
                <span>Lihat Lembar Cetak / PDF</span>
              </Link>

              <Link
                href={`/commercial/new?edit_id=${proposal.id}`}
                className="btn-primary"
                style={{
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                title="Revisi proposal ini dan simpan sebagai versi baru"
              >
                <span>✏️</span>
                <span>Revisi (v{(proposal.version || 1) + 1})</span>
              </Link>
            </div>
          </div>
        </div>

        {/* 1. Riwayat Semua Versi Proposal (Version Chain) */}
        <section className="linear-card" style={{ padding: '22px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>📚</span>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Riwayat Versi Dokumen Penawaran ({proposal.proposal_number})
              </h2>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
              Total {versionHistory.length} versi tersimpan
            </span>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
            <table className="excel-table">
              <thead>
                <tr>
                  <th style={{ width: '80px', textAlign: 'center' }}>Versi</th>
                  <th style={{ width: '160px', textAlign: 'left' }}>Tanggal Terbit</th>
                  <th style={{ width: '150px', textAlign: 'right' }}>Total Penawaran</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Margin</th>
                  <th style={{ minWidth: '260px', textAlign: 'left' }}>Catatan Perubahan Revisi</th>
                  <th style={{ width: '130px', textAlign: 'center' }}>Pembuat</th>
                  <th style={{ width: '130px', textAlign: 'center' }}>Aksi</th>
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
                    <tr key={vh.id} style={{ background: isCurrent ? 'rgba(94, 106, 210, 0.08)' : undefined }}>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className="linear-badge font-mono-numbers"
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            background: isCurrent ? 'rgba(94, 106, 210, 0.3)' : undefined,
                            color: isCurrent ? '#a5b4fc' : undefined,
                          }}
                        >
                          v{vh.version} {isCurrent && '●'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{vhDate}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                        {formatIDR(vh.grand_total)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="linear-badge" style={{ fontSize: '10px', color: '#10b981' }}>
                          +{vh.margin_percent}%
                        </span>
                      </td>
                      <td>
                        <div style={{ color: vh.revision_notes ? 'var(--text-secondary)' : 'var(--text-tertiary)', fontSize: '12px' }}>
                          {vh.revision_notes || '(Inisialisasi dokumen v1)'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        {vh.creator_name || '-'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isCurrent ? (
                          <span style={{ fontSize: '11px', color: 'var(--accent-hover)', fontWeight: 600 }}>Sedang Dilihat</span>
                        ) : (
                          <Link
                            href={`/commercial/${vh.id}`}
                            className="btn-secondary"
                            style={{ padding: '2px 8px', fontSize: '11px', textDecoration: 'none' }}
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
        </section>

        {/* 2. Ringkasan Finansial Komersial */}
        <section className="linear-card" style={{ padding: '22px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
            Ringkasan Finansial Penawaran (Versi v{proposal.version || 1})
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px',
              padding: '16px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>
                COGS Internal (Modal)
              </div>
              <div className="font-mono-numbers" style={{ fontSize: '16px', fontWeight: 600, color: '#38bdf8', marginTop: '2px' }}>
                {formatIDR(proposal.cogs_amount)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>
                Harga Dasar (Base Price)
              </div>
              <div className="font-mono-numbers" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                {formatIDR(proposal.base_price)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>
                Target Profit Margin
              </div>
              <div className="font-mono-numbers" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--accent-hover)', marginTop: '2px' }}>
                +{proposal.margin_percent}%
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>
                Diskon Penawaran
              </div>
              <div className="font-mono-numbers" style={{ fontSize: '16px', fontWeight: 600, color: '#f59e0b', marginTop: '2px' }}>
                -{formatIDR(Number(proposal.base_price) - Number(proposal.subtotal_after_discount))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#10b981', fontWeight: 700 }}>
                Total Penawaran Klien
              </div>
              <div className="font-mono-numbers" style={{ fontSize: '18px', fontWeight: 700, color: '#10b981', marginTop: '2px' }}>
                {formatIDR(proposal.grand_total)}
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-tertiary)' }}>
                Gross Profit: +{formatIDR(grossProfit)}
              </div>
            </div>
          </div>
        </section>

        {/* 3. Delivery Timeline & Payment Terms Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '20px' }}>
          {/* Delivery Timeline Card */}
          <section className="linear-card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
              📅 Delivery Timeline ({proposal.timeline_config?.total_weeks || 4} Minggu)
            </h3>

            {proposal.timeline_config && Array.isArray(proposal.timeline_config.milestones) ? (
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
                <table className="excel-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                      <th style={{ minWidth: '160px', textAlign: 'left' }}>Fase</th>
                      <th style={{ width: '90px', textAlign: 'center' }}>Durasi</th>
                      <th style={{ minWidth: '180px', textAlign: 'left' }}>Deliverable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposal.timeline_config.milestones.map((m, idx) => (
                      <tr key={idx}>
                        <td style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>{idx + 1}</td>
                        <td style={{ fontWeight: 500 }}>{m.phase}</td>
                        <td style={{ textAlign: 'center' }}>{m.duration_weeks} Mgg</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{m.deliverable}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>Tidak ada konfigurasi timeline.</div>
            )}
          </section>

          {/* Payment Terms Card */}
          <section className="linear-card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
              💳 Termin Pembayaran (Term of Payment)
            </h3>

            {Array.isArray(proposal.payment_terms) && proposal.payment_terms.length > 0 ? (
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
                <table className="excel-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: '150px', textAlign: 'left' }}>Termin</th>
                      <th style={{ width: '70px', textAlign: 'center' }}>Bobot</th>
                      <th style={{ width: '130px', textAlign: 'right' }}>Nominal</th>
                      <th style={{ minWidth: '160px', textAlign: 'left' }}>Syarat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposal.payment_terms.map((t, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500 }}>{t.milestone_name}</td>
                        <td style={{ textAlign: 'center' }}>{t.percent}%</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                          {formatIDR(t.amount)}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{t.trigger_condition}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>Tidak ada termin pembayaran.</div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default function CommercialProposalDetailPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>Memuat detail proposal...</div>}>
      <CommercialProposalDetailContent />
    </Suspense>
  );
}
