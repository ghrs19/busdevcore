'use client';

import { Suspense } from 'react';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface ProposalDetail {
  id: number;
  proposal_number: string;
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

interface ModuleItem {
  id: number;
  name: string;
  tasks: Array<{ id: number; name: string }>;
}

const formatIDR = (val: number | string) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return `Rp ${(num || 0).toLocaleString('id-ID')}`;
};

function CommercialProposalPrintViewContent() {
  const params = useParams();
  const id = params?.id as string;

  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [modules, setModules] = useState<ModuleItem[]>([]);
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
        } else {
          setErrorMsg(data.error || 'Gagal memuat proposal');
        }
      } catch {
        setErrorMsg('Gagal terhubung ke server');
      } finally {
        setLoading(false);
      }
    }
    loadProposal();
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', fontFamily: 'sans-serif' }}>
        Memuat dokumen proposal penawaran resmi...
      </div>
    );
  }

  if (errorMsg || !proposal) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#ef4444', fontFamily: 'sans-serif' }}>
        {errorMsg || 'Proposal tidak ditemukan.'}
        <div style={{ marginTop: '16px' }}>
          <Link href="/commercial" style={{ color: '#38bdf8', textDecoration: 'none' }}>
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

  return (
    <div className="client-proposal-print-container">
      {/* Floating Action Controls (Hidden on Print) */}
      <div className="no-print floating-action-bar">
        <Link href="/commercial" className="action-btn action-btn-back">
          ← Kembali ke Daftar Penawaran
        </Link>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => window.print()} className="action-btn action-btn-print">
            🖨️ Cetak / Simpan PDF
          </button>
        </div>
      </div>

      {/* A4 Paper Document Page */}
      <div className="proposal-sheet">
        {/* Header Logo & Document Title */}
        <div className="doc-header">
          <div>
            <div className="company-brand">BUSDEVCORE</div>
            <div className="company-sub">Digital Solution & Engineering Partner</div>
          </div>
          <div className="doc-meta">
            <div className="doc-title">PROPOSAL PENAWARAN HARGA</div>
            <div className="doc-num">{proposal.proposal_number}</div>
            <div className="doc-date">Tanggal: {dateFormatted}</div>
            <div className="doc-validity">Berlaku Hingga: {validUntilFormatted}</div>
          </div>
        </div>

        <div className="divider-line" />

        {/* Client & Project Information */}
        <div className="client-info-grid">
          <div>
            <div className="section-label">KEPADA YTH:</div>
            <div className="client-name">{proposal.company_name}</div>
            {proposal.company_address && <div className="client-detail">{proposal.company_address}</div>}
            {proposal.company_email && <div className="client-detail">Email: {proposal.company_email}</div>}
            {proposal.company_phone && <div className="client-detail">Telp: {proposal.company_phone}</div>}
          </div>
          <div>
            <div className="section-label">INFORMASI PROYEK:</div>
            <div className="project-title">{proposal.project_name}</div>
            <div className="client-detail">Referensi Dokumen: {proposal.estimate_title} (v{proposal.estimate_version})</div>
            {proposal.creator_name && (
              <div className="client-detail">Account Exec / Lead: {proposal.creator_name}</div>
            )}
          </div>
        </div>

        {/* Opening Statement */}
        <div className="statement-box">
          Dengan hormat,<br />
          Bersama surat ini, kami mengajukan proposal penawaran jasa pengembangan dan solusi teknologi untuk kebutuhan <strong>{proposal.project_name}</strong>. Rincian ruang lingkup, jadwal delivery, skema investasi, dan termin pembayaran tertera di bawah ini.
        </div>

        {/* SECTION 1: Ruang Lingkup Pekerjaan & Deliverables */}
        <div className="doc-section">
          <div className="section-heading">1. Ruang Lingkup Pekerjaan & Deliverables (Scope of Work)</div>
          <table className="doc-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                <th style={{ width: '260px' }}>Modul / Area Fungsional</th>
                <th>Rincian Fitur & Deliverables</th>
              </tr>
            </thead>
            <tbody>
              {modules.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '16px' }}>
                    Sesuai dengan spesifikasi teknis pada dokumen rujukan.
                  </td>
                </tr>
              ) : (
                modules.map((m, idx) => (
                  <tr key={m.id}>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{m.name}</td>
                    <td>
                      <ul className="task-bullet-list">
                        {Array.isArray(m.tasks) && m.tasks.length > 0 ? (
                          m.tasks.map((t) => <li key={t.id}>{t.name}</li>)
                        ) : (
                          <li>Penyelesaian modul fungsional {m.name}</li>
                        )}
                      </ul>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* SECTION 2: Delivery Timeline & Jadwal */}
        {proposal.timeline_config && proposal.timeline_config.milestones && (
          <div className="doc-section">
            <div className="section-heading">
              2. Estimasi Waktu Pengerjaan (Delivery Timeline: {proposal.timeline_config.total_weeks} Minggu)
            </div>
            <table className="doc-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                  <th style={{ width: '260px' }}>Tahapan / Fase Pengerjaan</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Durasi</th>
                  <th>Hasil Luaran (Deliverables)</th>
                </tr>
              </thead>
              <tbody>
                {proposal.timeline_config.milestones.map((m, idx) => (
                  <tr key={idx}>
                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{m.phase}</td>
                    <td style={{ textAlign: 'center' }}>{m.duration_weeks} Minggu</td>
                    <td>{m.deliverable}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* SECTION 3: Nilai Investasi Komersial */}
        <div className="doc-section">
          <div className="section-heading">3. Rincian Nilai Investasi (Commercial Investment)</div>
          <table className="doc-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                <th>Deskripsi Komponen Investasi</th>
                <th style={{ width: '220px', textAlign: 'right' }}>Jumlah (IDR)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ textAlign: 'center' }}>1</td>
                <td>
                  <strong>Pengembangan Aplikasi & Solusi Teknologi ({proposal.project_name})</strong>
                  <div className="item-subdesc">
                    Mencakup seluruh scope pekerjaan, integrasi sistem, dan testing hingga serah terima.
                  </div>
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                  {formatIDR(proposal.base_price)}
                </td>
              </tr>
              {Number(proposal.discount_value) > 0 && (
                <tr>
                  <td style={{ textAlign: 'center' }}>-</td>
                  <td style={{ color: '#b45309' }}>
                    <strong>Potongan Diskon Khusus ({proposal.discount_type === 'PERCENTAGE' ? `${proposal.discount_value}%` : 'Diskon Tetap'})</strong>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#b45309' }}>
                    -{formatIDR(Number(proposal.base_price) - Number(proposal.subtotal_after_discount))}
                  </td>
                </tr>
              )}
              <tr>
                <td colSpan={2} style={{ textAlign: 'right', fontWeight: 600 }}>
                  Subtotal
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                  {formatIDR(proposal.subtotal_after_discount)}
                </td>
              </tr>
              {proposal.is_tax_enabled && (
                <tr>
                  <td colSpan={2} style={{ textAlign: 'right' }}>
                    Pajak Pertambahan Nilai (PPN 11%)
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {formatIDR(proposal.tax_amount)}
                  </td>
                </tr>
              )}
              <tr className="total-highlight-row">
                <td colSpan={2} style={{ textAlign: 'right', fontSize: '14px', fontWeight: 700 }}>
                  TOTAL NILAI INVESTASI PENAWARAN (NETT)
                </td>
                <td style={{ textAlign: 'right', fontSize: '15px', fontWeight: 700 }}>
                  {formatIDR(proposal.grand_total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* SECTION 4: Termin Pembayaran */}
        {Array.isArray(proposal.payment_terms) && proposal.payment_terms.length > 0 && (
          <div className="doc-section">
            <div className="section-heading">4. Skema Termin Pembayaran (Term of Payment)</div>
            <table className="doc-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                  <th style={{ width: '220px' }}>Termin / Tahapan</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Bobot (%)</th>
                  <th style={{ width: '180px', textAlign: 'right' }}>Nominal (IDR)</th>
                  <th>Syarat Penagihan (Condition)</th>
                </tr>
              </thead>
              <tbody>
                {proposal.payment_terms.map((t, idx) => (
                  <tr key={idx}>
                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{t.milestone_name}</td>
                    <td style={{ textAlign: 'center' }}>{t.percent}%</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatIDR(t.amount)}</td>
                    <td>{t.trigger_condition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Notes & Terms */}
        {proposal.notes && (
          <div className="doc-section">
            <div className="section-heading">5. Syarat & Ketentuan Tambahan</div>
            <div className="notes-box">{proposal.notes}</div>
          </div>
        )}

        {/* Signature Sheet */}
        <div className="signature-container">
          <div className="sig-block">
            <div className="sig-title">Diajukan Oleh,</div>
            <div className="sig-company">BUSDEVCORE</div>
            <div className="sig-space" />
            <div className="sig-name">{proposal.creator_name || 'Business Development'}</div>
            <div className="sig-role">Authorized Representative</div>
          </div>

          <div className="sig-block">
            <div className="sig-title">Disetujui Oleh,</div>
            <div className="sig-company">{proposal.company_name}</div>
            <div className="sig-space" />
            <div className="sig-name">( _________________________ )</div>
            <div className="sig-role">Pejabat Berwenang / Klien</div>
          </div>
        </div>
      </div>

      {/* Global CSS Styling for Clean Paper & Print */}
      <style jsx global>{`
        .client-proposal-print-container {
          min-height: 100vh;
          background: #334155;
          padding: 30px 15px;
          display: flex;
          flex-direction: column;
          align-items: center;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        .floating-action-bar {
          width: 210mm;
          max-width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .action-btn {
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .action-btn-back {
          background: #475569;
          color: #f8fafc;
          border: 1px solid #64748b;
        }

        .action-btn-print {
          background: #0284c7;
          color: #ffffff;
          border: none;
        }

        .proposal-sheet {
          background: #ffffff;
          color: #1e293b;
          width: 210mm;
          min-height: 297mm;
          padding: 20mm;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
          box-sizing: border-box;
        }

        .doc-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 15px;
        }

        .company-brand {
          font-size: 24px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
        }

        .company-sub {
          font-size: 11px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-top: 2px;
        }

        .doc-meta {
          text-align: right;
        }

        .doc-title {
          font-size: 15px;
          font-weight: 800;
          color: #0369a1;
          letter-spacing: 0.04em;
        }

        .doc-num {
          font-size: 13px;
          font-weight: 700;
          color: #1e293b;
          margin-top: 3px;
        }

        .doc-date, .doc-validity {
          font-size: 11px;
          color: #64748b;
          margin-top: 2px;
        }

        .divider-line {
          height: 2px;
          background: #0284c7;
          margin: 15px 0 20px 0;
        }

        .client-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
          padding: 12px 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
        }

        .section-label {
          font-size: 10px;
          font-weight: 700;
          color: #64748b;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }

        .client-name, .project-title {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
        }

        .client-detail {
          font-size: 11px;
          color: #475569;
          margin-top: 2px;
        }

        .statement-box {
          font-size: 12px;
          line-height: 1.6;
          color: #334155;
          margin-bottom: 24px;
        }

        .doc-section {
          margin-bottom: 22px;
        }

        .section-heading {
          font-size: 12px;
          font-weight: 700;
          color: #0369a1;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 8px;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 4px;
        }

        .doc-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }

        .doc-table th {
          background: #f1f5f9;
          color: #334155;
          font-weight: 700;
          text-align: left;
          padding: 8px 10px;
          border: 1px solid #cbd5e1;
        }

        .doc-table td {
          padding: 8px 10px;
          border: 1px solid #cbd5e1;
          color: #1e293b;
          vertical-align: top;
        }

        .task-bullet-list {
          margin: 0;
          padding-left: 18px;
        }

        .task-bullet-list li {
          margin-bottom: 2px;
        }

        .item-subdesc {
          font-size: 10px;
          color: #64748b;
          margin-top: 3px;
        }

        .total-highlight-row td {
          background: #f0fdf4;
          color: #15803d;
          border-top: 2px solid #16a34a;
        }

        .notes-box {
          font-size: 11px;
          line-height: 1.6;
          color: #475569;
          background: #f8fafc;
          padding: 10px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          white-space: pre-wrap;
        }

        .signature-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          margin-top: 36px;
          page-break-inside: avoid;
        }

        .sig-block {
          text-align: center;
        }

        .sig-title {
          font-size: 11px;
          color: #64748b;
        }

        .sig-company {
          font-size: 12px;
          font-weight: 700;
          color: #0f172a;
          margin-top: 2px;
        }

        .sig-space {
          height: 60px;
        }

        .sig-name {
          font-size: 12px;
          font-weight: 700;
          color: #0f172a;
        }

        .sig-role {
          font-size: 10px;
          color: #64748b;
        }

        @media print {
          body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .client-proposal-print-container {
            background: #ffffff !important;
            padding: 0 !important;
          }
          .proposal-sheet {
            box-shadow: none !important;
            padding: 10mm 15mm !important;
            width: 100% !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function CommercialProposalPrintView() {
  return (
    <Suspense fallback={<div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>Memuat dokumen proposal penawaran...</div>}>
      <CommercialProposalPrintViewContent />
    </Suspense>
  );
}
