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
        setErrorMsg('Gagal terhubung ke server');
      } finally {
        setLoading(false);
      }
    }
    loadProposal();
  }, [id]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#090a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1' }} />
          <span>Memuat dokumen proposal penawaran resmi...</span>
        </div>
      </div>
    );
  }

  if (errorMsg || !proposal) {
    return (
      <div style={{ minHeight: '100vh', background: '#090a0f', padding: '60px 20px', textAlign: 'center', color: '#ef4444', fontFamily: 'sans-serif' }}>
        <div style={{ fontSize: '15px', fontWeight: 600 }}>{errorMsg || 'Proposal tidak ditemukan.'}</div>
        <div style={{ marginTop: '16px' }}>
          <Link href="/commercial" style={{ color: '#818cf8', textDecoration: 'none', fontSize: '13px' }}>
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
    <div className="proposal-view-wrapper">
      {/* Top Floating Action Bar (Hidden on Print) */}
      <nav className="no-print floating-bar">
        <Link href="/commercial" className="bar-btn bar-btn-back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>Daftar Penawaran</span>
        </Link>

        {/* Center: Version switcher if multiple versions */}
        {versionHistory.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.05)', padding: '3px 8px', borderRadius: '6px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', marginRight: '2px' }}>Riwayat Versi:</span>
            {versionHistory.map((vh) => {
              const isActive = vh.id === proposal.id;
              return (
                <Link
                  key={vh.id}
                  href={`/commercial/${vh.id}/print`}
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    background: isActive ? '#6366f1' : 'transparent',
                    color: isActive ? '#ffffff' : '#94a3b8',
                    border: isActive ? '1px solid #818cf8' : '1px solid transparent',
                  }}
                  title={vh.revision_notes ? `${vh.revision_notes} (${formatIDR(vh.grand_total)})` : undefined}
                >
                  v{vh.version}
                </Link>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link
            href={`/commercial/new?edit_id=${proposal.id}`}
            className="bar-btn bar-btn-back"
            style={{ borderColor: 'rgba(94, 106, 210, 0.4)', color: '#a5b4fc' }}
            title="Edit proposal ini dan simpan sebagai versi baru"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            <span>Edit & Buat Revisi (v{(proposal.version || 1) + 1})</span>
          </Link>

          <button onClick={() => window.print()} className="bar-btn bar-btn-print">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            <span>Cetak / Simpan PDF</span>
          </button>
        </div>
      </nav>

      {/* Modern Minimalist Proposal Sheet */}
      <article className="sheet-paper">
        {/* Brand & Document Meta */}
        <header className="sheet-header">
          <div className="brand-group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-pentacode-pdf.png"
              alt="PT Penta Code Digital"
              style={{
                height: '32px',
                width: 'auto',
                objectFit: 'contain',
                display: 'block',
              }}
            />
            <div style={{ borderLeft: '2px solid #e2e8f0', paddingLeft: '12px' }}>
              <div className="brand-title" style={{ fontSize: '13px', letterSpacing: '0.04em', color: '#0f172a' }}>PT PENTA CODE DIGITAL</div>
              <div className="brand-tagline" style={{ fontSize: '10px', color: '#64748b' }}>Software Development & Digital Solutions • pentacode.id</div>
            </div>
          </div>

          <div className="doc-meta-table">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '8px' }}>
              <div className="meta-badge">COMMERCIAL PROPOSAL</div>
            </div>
            <div className="meta-row">
              <span className="meta-label">No. Dokumen</span>
              <span className="meta-value font-mono">{proposal.proposal_number}</span>
            </div>

            <div className="meta-row">
              <span className="meta-label">Tanggal Terbit</span>
              <span className="meta-value">{dateFormatted}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Masa Berlaku</span>
              <span className="meta-value">{validUntilFormatted}</span>
            </div>
          </div>
        </header>

        <div className="hairline-divider" />

        {/* Client & Project Overview */}
        <section className="client-project-grid">
          <div className="info-col">
            <div className="caption-label">Ditujukan Kepada:</div>
            <div className="party-name">{proposal.company_name}</div>
            {proposal.company_address && <div className="party-detail">{proposal.company_address}</div>}
            <div className="party-subinfo">
              {proposal.company_email && <span>Email: {proposal.company_email}</span>}
              {proposal.company_email && proposal.company_phone && <span> • </span>}
              {proposal.company_phone && <span>Telp: {proposal.company_phone}</span>}
            </div>
          </div>

          <div className="info-col">
            <div className="caption-label">Informasi Proyek:</div>
            <div className="party-name">{proposal.project_name}</div>
            {proposal.project_description && (
              <div className="party-detail">{proposal.project_description}</div>
            )}
            {proposal.creator_name && (
              <div className="party-subinfo">Disiapkan oleh: {proposal.creator_name}</div>
            )}
          </div>
        </section>

        {/* Opening Letter Paragraph */}
        <p className="intro-text">
          Terima kasih atas kepercayaan dan kesempatan yang diberikan. Bersama dokumen ini, kami menyampaikan penawaran resmi untuk pengembangan solusi teknologi <strong>{proposal.project_name}</strong>. Rincian ruang lingkup pekerjaan, jadwal delivery, skema investasi, dan ketentuan penagihan terangkum di bawah ini.
        </p>

        {/* Section 1: Scope of Work & Deliverables */}
        <section className="doc-section">
          <div className="section-title-wrap">
            <span className="section-num">01</span>
            <h2 className="section-title">Ruang Lingkup Pekerjaan & Deliverables (Scope of Work)</h2>
          </div>

          <div className="table-responsive">
            <table className="clean-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                  <th style={{ width: '240px' }}>Modul / Fungsionalitas</th>
                  <th>Spesifikasi & Rincian Deliverables</th>
                </tr>
              </thead>
              <tbody>
                {modules.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>
                      Sesuai dengan kesepakatan spesifikasi fungsional pada dokumen rujukan teknis.
                    </td>
                  </tr>
                ) : (
                  modules.map((m, idx) => (
                    <tr key={m.id}>
                      <td style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 500 }}>
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>
                        {m.name}
                      </td>
                      <td>
                        {Array.isArray(m.tasks) && m.tasks.length > 0 ? (
                          <div className="deliverable-tags">
                            {m.tasks.map((t) => (
                              <div key={t.id} className="deliverable-item">
                                <span className="bullet-dot" />
                                <span>{t.name}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="deliverable-item">
                            <span className="bullet-dot" />
                            <span>Penyelesaian dan pengujian fungsional modul {m.name}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Delivery Timeline */}
        {proposal.timeline_config && proposal.timeline_config.milestones && (
          <section className="doc-section">
            <div className="section-title-wrap">
              <span className="section-num">02</span>
              <h2 className="section-title">
                Estimasi Jadwal Pengerjaan (Durasi: {proposal.timeline_config.total_weeks} Minggu)
              </h2>
            </div>

            <div className="table-responsive">
              <table className="clean-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                    <th style={{ width: '240px' }}>Tahapan Pengerjaan</th>
                    <th style={{ width: '130px', textAlign: 'center' }}>Durasi Kalender</th>
                    <th>Hasil Luaran / Serah Terima</th>
                  </tr>
                </thead>
                <tbody>
                  {proposal.timeline_config.milestones.map((m, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 500 }}>
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{m.phase}</td>
                      <td style={{ textAlign: 'center', color: '#334155', fontWeight: 500 }}>
                        <span className="duration-pill">{m.duration_weeks} Minggu</span>
                      </td>
                      <td style={{ color: '#334155' }}>{m.deliverable}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Section 3: Commercial Investment */}
        <section className="doc-section">
          <div className="section-title-wrap">
            <span className="section-num">03</span>
            <h2 className="section-title">Rincian Nilai Investasi (Commercial Investment)</h2>
          </div>

          <div className="table-responsive">
            <table className="clean-table invoice-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                  <th>Uraian Komponen Investasi</th>
                  <th style={{ width: '220px', textAlign: 'right' }}>Nilai (IDR)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 500 }}>01</td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>
                      Pengembangan Aplikasi & Solusi Digital ({proposal.project_name})
                    </div>
                    <div className="item-note">
                      Mencakup desain UI/UX, implementasi source code, integrasi sistem, dan deployment.
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#0f172a' }} className="font-mono">
                    {formatIDR(proposal.base_price)}
                  </td>
                </tr>

                {Number(proposal.discount_value) > 0 && (
                  <tr className="discount-row">
                    <td style={{ textAlign: 'center', color: '#94a3b8' }}>-</td>
                    <td>
                      <div style={{ fontWeight: 500, color: '#b45309' }}>
                        Potongan Diskon Khusus ({proposal.discount_type === 'PERCENTAGE' ? `${proposal.discount_value}%` : 'Diskon Tetap'})
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#b45309' }} className="font-mono">
                      -{formatIDR(Number(proposal.base_price) - Number(proposal.subtotal_after_discount))}
                    </td>
                  </tr>
                )}

                <tr className="subtotal-row">
                  <td colSpan={2} style={{ textAlign: 'right', color: '#475569', fontWeight: 500 }}>
                    Subtotal Investasi
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#0f172a' }} className="font-mono">
                    {formatIDR(proposal.subtotal_after_discount)}
                  </td>
                </tr>

                {proposal.is_tax_enabled && (
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'right', color: '#64748b' }}>
                      Pajak Pertambahan Nilai (PPN 11%)
                    </td>
                    <td style={{ textAlign: 'right', color: '#475569' }} className="font-mono">
                      +{formatIDR(proposal.tax_amount)}
                    </td>
                  </tr>
                )}

                <tr className="grand-total-row">
                  <td colSpan={2} style={{ textAlign: 'right', fontWeight: 700, letterSpacing: '-0.01em', color: '#0f172a', fontSize: '13px' }}>
                    TOTAL NILAI INVESTASI PENAWARAN (NETT)
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a', fontSize: '15px' }} className="font-mono">
                    {formatIDR(proposal.grand_total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4: Term of Payment */}
        {Array.isArray(proposal.payment_terms) && proposal.payment_terms.length > 0 && (
          <section className="doc-section">
            <div className="section-title-wrap">
              <span className="section-num">04</span>
              <h2 className="section-title">Skema Termin Pembayaran (Term of Payment)</h2>
            </div>

            <div className="table-responsive">
              <table className="clean-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                    <th style={{ width: '220px' }}>Tahap Penagihan</th>
                    <th style={{ width: '90px', textAlign: 'center' }}>Bobot (%)</th>
                    <th style={{ width: '180px', textAlign: 'right' }}>Nominal (IDR)</th>
                    <th>Kondisi / Syarat Penerbitan Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {proposal.payment_terms.map((t, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 500 }}>
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{t.milestone_name}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: '#475569' }}>
                        {t.percent}%
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#0f172a' }} className="font-mono">
                        {formatIDR(t.amount)}
                      </td>
                      <td style={{ color: '#475569' }}>{t.trigger_condition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Section 5: Terms & Conditions */}
        {proposal.notes && (
          <section className="doc-section">
            <div className="section-title-wrap">
              <span className="section-num">05</span>
              <h2 className="section-title">Ketentuan & Syarat Tambahan</h2>
            </div>
            <div className="terms-card">
              {proposal.notes}
            </div>
          </section>
        )}

        {/* Signatures Block */}
        <footer className="signature-section">
          <div className="sig-column">
            <div className="sig-role-caption">Diajukan Oleh:</div>
            <div className="sig-entity">PT PENTA CODE DIGITAL</div>
            <div className="sig-space" />
            <div className="sig-person">{proposal.creator_name || 'Business Development'}</div>
            <div className="sig-title">Authorized Representative</div>
          </div>

          <div className="sig-column">
            <div className="sig-role-caption">Disetujui Oleh:</div>
            <div className="sig-entity">{proposal.company_name}</div>
            <div className="sig-space" />
            <div className="sig-person">( _________________________ )</div>
            <div className="sig-title">Pejabat Berwenang / Klien</div>
          </div>
        </footer>
      </article>

      {/* Modern Minimalist PDF Stylesheet */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

        .proposal-view-wrapper {
          min-height: 100vh;
          background: #090a0f;
          padding: 36px 16px 80px 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #0f172a;
        }

        .font-mono {
          font-family: 'JetBrains Mono', Menlo, Consolas, monospace !important;
          font-variant-numeric: tabular-nums;
        }

        /* Floating Top Bar */
        .floating-bar {
          width: 210mm;
          max-width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          background: rgba(18, 20, 24, 0.85);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 10px 16px;
          border-radius: 10px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          flex-wrap: wrap;
          gap: 12px;
        }

        .bar-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.15s ease;
        }

        .bar-btn-back {
          background: transparent;
          color: #94a3b8;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .bar-btn-back:hover {
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.25);
        }

        .bar-btn-print {
          background: #ffffff;
          color: #090a0f;
          border: none;
          font-weight: 600;
        }

        .bar-btn-print:hover {
          background: #f1f5f9;
        }

        /* Modern A4 Paper Sheet */
        .sheet-paper {
          background: #ffffff;
          width: 210mm;
          min-height: 297mm;
          padding: 22mm 20mm;
          box-sizing: border-box;
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.4);
          position: relative;
        }

        /* Header */
        .sheet-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }

        .brand-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-symbol {
          width: 32px;
          height: 32px;
          border-radius: 7px;
          background: #0f172a;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .symbol-inner {
          width: 14px;
          height: 14px;
          border: 2px solid #ffffff;
          border-radius: 3px;
        }

        .brand-title {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #0f172a;
          line-height: 1.1;
        }

        .brand-tagline {
          font-size: 11px;
          color: #64748b;
          letter-spacing: -0.01em;
          margin-top: 2px;
        }

        .doc-meta-table {
          text-align: right;
        }

        .meta-badge {
          display: inline-block;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: #475569;
          background: #f1f5f9;
          padding: 2px 7px;
          border-radius: 4px;
        }

        .meta-row {
          display: flex;
          justify-content: flex-end;
          gap: 14px;
          font-size: 11px;
          line-height: 1.6;
        }

        .meta-label {
          color: #64748b;
        }

        .meta-value {
          color: #0f172a;
          font-weight: 600;
        }

        .hairline-divider {
          height: 1px;
          background: #e2e8f0;
          margin-bottom: 24px;
        }

        /* Client & Project Overview */
        .client-project-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
          margin-bottom: 24px;
          background: #f8fafc;
          border: 1px solid #edf2f7;
          border-radius: 8px;
          padding: 16px 20px;
        }

        .caption-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #64748b;
          margin-bottom: 4px;
        }

        .party-name {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.01em;
        }

        .party-detail {
          font-size: 11px;
          color: #475569;
          margin-top: 3px;
          line-height: 1.4;
        }

        .party-subinfo {
          font-size: 11px;
          color: #64748b;
          margin-top: 4px;
        }

        .intro-text {
          font-size: 11.5px;
          line-height: 1.7;
          color: #334155;
          margin-bottom: 28px;
        }

        /* Section Styling */
        .doc-section {
          margin-bottom: 28px;
          page-break-inside: avoid;
        }

        .section-title-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          padding-bottom: 6px;
          border-bottom: 1px solid #e2e8f0;
        }

        .section-num {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          font-weight: 700;
          color: #6366f1;
          background: #e0e7ff;
          padding: 1px 6px;
          border-radius: 3px;
        }

        .section-title {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: #0f172a;
          margin: 0;
          text-transform: uppercase;
        }

        /* Minimalist Clean Table */
        .clean-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }

        .clean-table th {
          text-align: left;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #64748b;
          padding: 8px 10px;
          border-bottom: 1.5px solid #cbd5e1;
          background: transparent;
        }

        .clean-table td {
          padding: 9px 10px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: top;
          color: #334155;
          line-height: 1.5;
        }

        .clean-table tbody tr:hover td {
          background: #f8fafc;
        }

        .deliverable-tags {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .deliverable-item {
          display: flex;
          align-items: baseline;
          gap: 6px;
          font-size: 11px;
          color: #334155;
        }

        .bullet-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #94a3b8;
          display: inline-block;
          flex-shrink: 0;
          transform: translateY(-2px);
        }

        .duration-pill {
          display: inline-block;
          font-size: 10.5px;
          font-weight: 600;
          color: #0f172a;
          background: #f1f5f9;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .item-note {
          font-size: 10px;
          color: #64748b;
          margin-top: 2px;
          line-height: 1.4;
        }

        /* Invoice Table Specifics */
        .invoice-table .discount-row td {
          background: #fffbeb;
        }

        .invoice-table .subtotal-row td {
          border-top: 1.5px solid #e2e8f0;
          padding-top: 10px;
        }

        .invoice-table .grand-total-row td {
          background: #f8fafc;
          border-top: 2px solid #0f172a;
          border-bottom: 2px solid #0f172a;
          padding: 12px 10px;
        }

        /* Terms & Notes */
        .terms-card {
          font-size: 11px;
          line-height: 1.6;
          color: #475569;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 12px 16px;
          white-space: pre-wrap;
        }

        /* Signatures */
        .signature-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #f1f5f9;
          page-break-inside: avoid;
        }

        .sig-column {
          text-align: center;
        }

        .sig-role-caption {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
          font-weight: 600;
        }

        .sig-entity {
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
          margin-top: 3px;
        }

        .sig-space {
          height: 55px;
        }

        .sig-person {
          font-size: 12px;
          font-weight: 700;
          color: #0f172a;
        }

        .sig-title {
          font-size: 10px;
          color: #64748b;
          margin-top: 2px;
        }

        /* Print Media Perfection */
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }

          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .proposal-view-wrapper {
            background: #ffffff !important;
            padding: 0 !important;
          }

          .sheet-paper {
            box-shadow: none !important;
            padding: 0 !important;
            width: 100% !important;
            min-height: auto !important;
          }

          .no-print {
            display: none !important;
          }

          .clean-table tbody tr:hover td {
            background: transparent !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function CommercialProposalPrintView() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#090a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Memuat dokumen proposal penawaran...</div>}>
      <CommercialProposalPrintViewContent />
    </Suspense>
  );
}
