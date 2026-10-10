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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', paddingBottom: '90px' }}>
      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 20px' }}>
        {/* Top Breadcrumb & Action Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Link
              href="/commercial"
              style={{
                fontSize: '12px',
                color: 'var(--text-tertiary)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'color 0.15s ease',
              }}
            >
              <span>←</span>
              <span>Daftar Proposal Penawaran</span>
            </Link>
            <span style={{ color: 'var(--border-hover)', fontSize: '12px' }}>/</span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {proposal.proposal_number}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
              paddingBottom: '20px',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                  {proposal.proposal_number}
                </h1>
                <span
                  className="linear-badge font-mono-numbers"
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    background: (proposal.version || 1) > 1 ? 'rgba(94, 106, 210, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                    color: (proposal.version || 1) > 1 ? '#a5b4fc' : 'var(--text-secondary)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                  }}
                >
                  Versi v{proposal.version || 1}
                </span>
                <span
                  className="linear-badge"
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                  }}
                >
                  Active Deal
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                Klien: <strong style={{ color: 'var(--text-secondary)' }}>{proposal.company_name}</strong> • Proyek: <strong style={{ color: 'var(--text-secondary)' }}>{proposal.project_name}</strong>
              </p>
            </div>

            {/* Action Bar */}
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
                  padding: '7px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
                title="Download Dokumen Format Word (.docx)"
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
                  padding: '7px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
                title="Buka Lembar Cetak / Export PDF A4 Klien"
              >
                <span>📄</span>
                <span>Cetak / PDF</span>
              </Link>

              <Link
                href={`/commercial/new?edit_id=${proposal.id}`}
                className="btn-primary"
                style={{
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 16px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
                title="Edit proposal ini dan simpan sebagai versi terbaru"
              >
                <span>✏️</span>
                <span>Edit & Buat Revisi (v{(proposal.version || 1) + 1})</span>
              </Link>
            </div>
          </div>
        </div>

        {/* 1. Executive Summary & Financial Highlights Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '14px',
            marginBottom: '24px',
          }}
        >
          {/* Card: Total Penawaran */}
          <div
            className="linear-card"
            style={{
              padding: '18px',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%)',
            }}
          >
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#10b981', fontWeight: 700 }}>
              Total Penawaran Klien (Quotation)
            </div>
            <div className="font-mono-numbers" style={{ fontSize: '22px', fontWeight: 800, color: '#10b981', marginTop: '6px' }}>
              {formatIDR(proposal.grand_total)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              Nett penawaran resmi ({proposal.is_tax_enabled ? 'Inc. PPN 11%' : 'Tanpa PPN'})
            </div>
          </div>

          {/* Card: Modal COGS */}
          <div className="linear-card" style={{ padding: '18px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', fontWeight: 600 }}>
              Total Biaya Modal (COGS)
            </div>
            <div className="font-mono-numbers" style={{ fontSize: '18px', fontWeight: 700, color: '#38bdf8', marginTop: '6px' }}>
              {formatIDR(proposal.cogs_amount)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              Baseline: {proposal.estimate_title}
            </div>
          </div>

          {/* Card: Profit Margin & Gross Profit */}
          <div className="linear-card" style={{ padding: '18px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', fontWeight: 600 }}>
              Target Margin & Gross Profit
            </div>
            <div className="font-mono-numbers" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-hover)', marginTop: '6px' }}>
              +{proposal.margin_percent}% <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>({formatIDR(grossProfit)})</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              Margin riil: +{grossProfitPercent}% dari subtotal
            </div>
          </div>

          {/* Card: Harga Dasar & Diskon */}
          <div className="linear-card" style={{ padding: '18px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', fontWeight: 600 }}>
              Base Price & Diskon
            </div>
            <div className="font-mono-numbers" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px' }}>
              {formatIDR(proposal.base_price)}
            </div>
            <div style={{ fontSize: '11px', color: discountAmount > 0 ? '#f59e0b' : 'var(--text-tertiary)', marginTop: '4px' }}>
              {discountAmount > 0 ? `Diskon: -${formatIDR(discountAmount)}` : 'Tanpa potongan diskon'}
            </div>
          </div>
        </div>

        {/* 2. Metadata & Client Info Two-Column Panel */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          {/* Client & Project Overview */}
          <section className="linear-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
              <span style={{ fontSize: '15px' }}>🏢</span>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Informasi Klien & Entitas
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', rowGap: '10px', fontSize: '12px' }}>
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

          {/* Document & Administrative Meta */}
          <section className="linear-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
              <span style={{ fontSize: '15px' }}>📋</span>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Administrasi Dokumen Penawaran
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', rowGap: '10px', fontSize: '12px' }}>
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

        {/* 3. Riwayat Seluruh Versi Dokumen (Version Chain Timeline) */}
        <section className="linear-card" style={{ padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px' }}>📚</span>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Riwayat Versi Dokumen ({proposal.proposal_number})
              </h3>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
              {versionHistory.length} versi tersimpan di rantai revisi
            </span>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
            <table className="excel-table">
              <thead>
                <tr>
                  <th style={{ width: '80px', textAlign: 'center' }}>Versi</th>
                  <th style={{ width: '150px', textAlign: 'left' }}>Tanggal Terbit</th>
                  <th style={{ width: '160px', textAlign: 'right' }}>Total Penawaran</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Margin</th>
                  <th style={{ minWidth: '260px', textAlign: 'left' }}>Catatan Perubahan Revisi</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Dibuat Oleh</th>
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
                          {vh.revision_notes || '(Inisialisasi proposal penawaran v1)'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        {vh.creator_name || '-'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isCurrent ? (
                          <span style={{ fontSize: '11px', color: 'var(--accent-hover)', fontWeight: 600 }}>Versi Aktif</span>
                        ) : (
                          <Link
                            href={`/commercial/${vh.id}`}
                            className="btn-secondary"
                            style={{ padding: '3px 8px', fontSize: '11px', textDecoration: 'none' }}
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

        {/* 4. Ruang Lingkup Deliverables, Timeline & Termin Pembayaran Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          {/* Section: Delivery Timeline */}
          <section className="linear-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px' }}>📅</span>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Delivery Timeline Setup
                </h3>
              </div>
              <span className="linear-badge font-mono-numbers" style={{ fontSize: '11px', fontWeight: 600 }}>
                Total: {proposal.timeline_config?.total_weeks || 4} Minggu
              </span>
            </div>

            {proposal.timeline_config && Array.isArray(proposal.timeline_config.milestones) ? (
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
                <table className="excel-table">
                  <thead>
                    <tr>
                      <th style={{ width: '35px', textAlign: 'center' }}>No</th>
                      <th style={{ minWidth: '150px', textAlign: 'left' }}>Tahapan Kerja</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>Durasi</th>
                      <th style={{ minWidth: '180px', textAlign: 'left' }}>Deliverables</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposal.timeline_config.milestones.map((m, idx) => (
                      <tr key={idx}>
                        <td style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '11px' }}>{idx + 1}</td>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{m.phase}</td>
                        <td style={{ textAlign: 'center', color: '#38bdf8', fontWeight: 600 }}>{m.duration_weeks} Mgg</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{m.deliverable}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>Tidak ada konfigurasi timeline.</div>
            )}
          </section>

          {/* Section: Payment Terms */}
          <section className="linear-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px' }}>💳</span>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Termin Pembayaran (Term of Payment)
                </h3>
              </div>
              <span className="linear-badge font-mono-numbers" style={{ fontSize: '11px', fontWeight: 600, color: '#10b981' }}>
                Total: {formatIDR(proposal.grand_total)}
              </span>
            </div>

            {Array.isArray(proposal.payment_terms) && proposal.payment_terms.length > 0 ? (
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
                <table className="excel-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: '140px', textAlign: 'left' }}>Termin</th>
                      <th style={{ width: '65px', textAlign: 'center' }}>Bobot</th>
                      <th style={{ width: '130px', textAlign: 'right' }}>Nominal</th>
                      <th style={{ minWidth: '160px', textAlign: 'left' }}>Kondisi Penagihan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposal.payment_terms.map((t, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{t.milestone_name}</td>
                        <td style={{ textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.percent}%</td>
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

        {/* 5. Scope of Work (Deliverables dari Baseline) */}
        <section className="linear-card" style={{ padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px' }}>📦</span>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Ruang Lingkup Fitur & Modul (Scope of Work Baseline)
              </h3>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
              {modules.length} modul fungsional terdaftar
            </span>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
            <table className="excel-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                  <th style={{ width: '260px', textAlign: 'left' }}>Modul / Fungsionalitas</th>
                  <th style={{ minWidth: '320px', textAlign: 'left' }}>Rincian Fitur & Deliverables</th>
                </tr>
              </thead>
              <tbody>
                {modules.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-tertiary)' }}>
                      Tidak ada rincian modul dalam baseline estimasi.
                    </td>
                  </tr>
                ) : (
                  modules.map((m, idx) => (
                    <tr key={m.id}>
                      <td style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '11px' }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</td>
                      <td>
                        {Array.isArray(m.tasks) && m.tasks.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {m.tasks.map((t) => (
                              <span
                                key={t.id}
                                className="linear-badge"
                                style={{
                                  fontSize: '11px',
                                  padding: '2px 8px',
                                  color: 'var(--text-secondary)',
                                  background: 'rgba(255, 255, 255, 0.04)',
                                }}
                              >
                                {t.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>Penyelesaian modul {m.name}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 6. Catatan Khusus & Ketentuan */}
        {proposal.notes && (
          <section className="linear-card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              📝 Syarat & Ketentuan Khusus Penawaran
            </h3>
            <div
              style={{
                fontSize: '12px',
                lineHeight: '1.6',
                color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap',
                background: 'rgba(255, 255, 255, 0.02)',
                padding: '12px 16px',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {proposal.notes}
            </div>
          </section>
        )}
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
