'use client';

import { Suspense, useEffect, useState } from 'react';
import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface InvoicePrintData {
  id: number;
  proposal_id: number;
  term_index: number;
  milestone_name: string;
  percent: number;
  amount: number | string;
  trigger_condition: string;
  billing_status: string;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  paid_date?: string;
  paid_amount?: number | string;
  proof_reference?: string;
  notes?: string;
  billing_type: 'milestone' | 'recurring_monthly';
  phase: string;
  period_month?: number;
  coverage_period?: string;
  proposal_number: string;
  proposal_version: number;
  is_tax_enabled: boolean;
  proposal_grand_total: number | string;
  company_name: string;
  company_email?: string;
  company_phone?: string;
  company_address?: string;
  project_name: string;
}

const formatIDR = (val: number | string) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return `Rp ${(num || 0).toLocaleString('id-ID')}`;
};

function InvoicePrintViewInner() {
  const params = useParams();
  const invoiceId = params?.id as string;
  const [data, setData] = useState<InvoicePrintData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (invoiceId) {
      fetch(`/api/invoices/${invoiceId}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.invoice) {
            setData(res.invoice);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [invoiceId]);

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Memuat invoice cetak...</div>;
  }

  if (!data) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Invoice tidak ditemukan.</div>;
  }

  const invoiceNumber = data.invoice_number || `INV/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(data.id).padStart(4, '0')}`;
  const invoiceDateStr = data.invoice_date
    ? new Date(data.invoice_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const dueDateStr = data.due_date
    ? new Date(data.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : '14 Hari sejak invoice diterima';

  const amountNum = Number(data.amount) || 0;
  const isPaid = data.billing_status === 'paid';

  return (
    <div className="invoice-print-wrapper">
      {/* Floating Toolbar (Hidden on print) */}
      <nav className="no-print floating-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link
            href={`/invoices/${data.id}`}
            className="bar-btn"
            style={{ textDecoration: 'none', color: '#94a3b8' }}
          >
            ← Kembali ke Detail
          </Link>
          <span style={{ color: '#475569' }}>|</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
            Invoice #{invoiceNumber}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => window.print()}
            className="bar-btn btn-print"
          >
            🖨️ Cetak / Download PDF
          </button>
        </div>
      </nav>

      {/* A4 Sheet Paper */}
      <article className="sheet-paper">
        {/* Header Sheet */}
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
              <div className="brand-title">PT PENTA CODE DIGITAL</div>
              <div className="brand-subtitle">Software Development & Digital Solutions • pentacode.id</div>
            </div>
          </div>

          <div className="doc-meta">
            <div className="doc-badge">COMMERCIAL INVOICE</div>
            <div className="doc-number">{invoiceNumber}</div>
            <div className="doc-dates">
              <div>Tanggal Terbit: <strong>{invoiceDateStr}</strong></div>
              <div>Jatuh Tempo: <strong>{dueDateStr}</strong></div>
            </div>
          </div>
        </header>

        {/* Status Stamp if Paid */}
        {isPaid && (
          <div className="paid-stamp">
            LUNAS / PAID
          </div>
        )}

        {/* 2-Columns Entity Block (From & Bill To) */}
        <section className="entity-grid">
          <div className="entity-box">
            <div className="entity-label">DITAGIHKAN OLEH (PENGIRIM):</div>
            <div className="entity-name">PT PENTA CODE DIGITAL</div>
            <div className="entity-details">
              Graha Pena Lantai 15, Jl. Ahmad Yani No. 88<br />
              Surabaya, Jawa Timur - Indonesia<br />
              Email: finance@pentacode.id • Web: pentacode.id
            </div>
          </div>

          <div className="entity-box">
            <div className="entity-label">DITAGIHKAN KEPADA (KLIEN):</div>
            <div className="entity-name">{data.company_name}</div>
            <div className="entity-details">
              {data.company_address || 'Alamat kantor terdaftar'}<br />
              {data.company_phone ? `Telp: ${data.company_phone}` : ''}
              {data.company_email ? ` • Email: ${data.company_email}` : ''}
            </div>
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748b' }}>
              Ref. Kontrak/Proposal: <strong>{data.proposal_number} v{data.proposal_version}</strong>
            </div>
          </div>
        </section>

        {/* Project Info Banner */}
        <section className="project-banner">
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b' }}>
            NAMA PROYEK / PEKERJAAN:
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
            {data.project_name}
          </div>
        </section>

        {/* Line Items Table */}
        <section className="table-wrapper">
          <table className="clean-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>NO</th>
                <th style={{ textAlign: 'left' }}>DESKRIPSI / RINCIAN TAGIHAN</th>
                <th style={{ width: '100px', textAlign: 'center' }}>PERSENTASE</th>
                <th style={{ width: '180px', textAlign: 'right' }}>JUMLAH (IDR)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ textAlign: 'center', fontWeight: 600 }}>1</td>
                <td>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>
                    {data.milestone_name}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '4px' }}>
                    {data.coverage_period
                      ? `Cakupan Periode: ${data.coverage_period}`
                      : `Syarat Penagihan: ${data.trigger_condition || 'Sesuai kesepakatan kontrak SPK'}`}
                  </div>
                </td>
                <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '12.5px' }}>
                  {data.percent > 0 ? `${data.percent}%` : '-'}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '13.5px' }}>
                  {formatIDR(data.amount)}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  TOTAL TAGIHAN (NETTO)
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '16px', color: '#0f172a' }}>
                  {formatIDR(amountNum)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* Payment Instructions & Bank Details */}
        <section className="payment-instructions-grid">
          <div className="bank-box">
            <div className="bank-title">INSTRUKSI PEMBAYARAN TRANSFER BANK</div>
            <div className="bank-row">
              <span className="bank-label">Bank Penerima:</span>
              <span className="bank-val">Bank Central Asia (BCA)</span>
            </div>
            <div className="bank-row">
              <span className="bank-label">Nomor Rekening:</span>
              <span className="bank-val font-mono" style={{ fontSize: '13.5px', letterSpacing: '0.04em' }}>
                088-726-1928
              </span>
            </div>
            <div className="bank-row">
              <span className="bank-label">Atas Nama:</span>
              <span className="bank-val">PT PENTA CODE DIGITAL</span>
            </div>
            <div className="bank-row">
              <span className="bank-label">Berita Transfer:</span>
              <span className="bank-val font-mono" style={{ color: '#0284c7' }}>
                {invoiceNumber}
              </span>
            </div>
          </div>

          <div className="signature-box">
            <div style={{ fontSize: '11.5px', color: '#64748b' }}>Hormat kami,</div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
              PT PENTA CODE DIGITAL
            </div>
            <div className="sig-space" />
            <div className="sig-name">Authorized Finance Department</div>
            <div className="sig-role">Finance & Accounting Lead</div>
          </div>
        </section>

        {/* Footer Note */}
        <footer className="sheet-footer">
          <div>Dokumen ini sah dan diterbitkan secara digital oleh sistem ERP PT Penta Code Digital.</div>
          <div>Harap mengirimkan bukti transfer pembayaran ke email: finance@pentacode.id</div>
        </footer>
      </article>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

        .invoice-print-wrapper {
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
          font-size: 12.5px;
          font-weight: 500;
          padding: 6px 14px;
          border-radius: 6px;
          cursor: pointer;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          transition: all 0.15s ease;
        }

        .btn-print {
          background: #10b981 !important;
          color: #ffffff !important;
          border-color: #10b981 !important;
          font-weight: 700 !important;
        }

        .sheet-paper {
          width: 210mm;
          min-height: 297mm;
          background: #ffffff;
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.5);
          padding: 40px 48px;
          box-sizing: border-box;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        .sheet-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: 20px;
          border-bottom: 2px solid #0f172a;
          margin-bottom: 24px;
        }

        .brand-group {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .brand-title {
          font-size: 13px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: 0.04em;
        }

        .brand-subtitle {
          font-size: 9.5px;
          color: #64748b;
          margin-top: 1px;
        }

        .doc-meta {
          text-align: right;
        }

        .doc-badge {
          display: inline-block;
          font-size: 9.5px;
          font-weight: 800;
          letter-spacing: 0.08em;
          padding: 2px 8px;
          border-radius: 4px;
          background: #0f172a;
          color: #ffffff;
          margin-bottom: 6px;
        }

        .doc-number {
          font-family: 'JetBrains Mono', monospace;
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
        }

        .doc-dates {
          font-size: 11px;
          color: #475569;
          margin-top: 4px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .paid-stamp {
          position: absolute;
          top: 120px;
          right: 60px;
          border: 3px solid #10b981;
          color: #10b981;
          font-size: 20px;
          font-weight: 900;
          padding: 6px 18px;
          border-radius: 8px;
          transform: rotate(-12deg);
          letter-spacing: 0.1em;
          opacity: 0.85;
          pointer-events: none;
        }

        .entity-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 20px;
        }

        .entity-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
        }

        .entity-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.06em;
          color: #64748b;
          margin-bottom: 4px;
        }

        .entity-name {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 4px;
        }

        .entity-details {
          font-size: 11.5px;
          line-height: 1.5;
          color: #334155;
        }

        .project-banner {
          background: #f1f5f9;
          border-left: 3px solid #0f172a;
          padding: 10px 14px;
          border-radius: 0 6px 6px 0;
          margin-bottom: 24px;
        }

        .table-wrapper {
          margin-bottom: 28px;
        }

        .clean-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
        }

        .clean-table thead th {
          background: #f8fafc;
          color: #475569;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          padding: 10px 14px;
          border-top: 1px solid #e2e8f0;
          border-bottom: 2px solid #cbd5e1;
        }

        .clean-table tbody td {
          padding: 14px;
          border-bottom: 1px solid #e2e8f0;
          color: #1e293b;
        }

        .clean-table tfoot td {
          padding: 14px;
          border-top: 2px solid #0f172a;
          border-bottom: 2px solid #0f172a;
          background: #fafafa;
        }

        .payment-instructions-grid {
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          gap: 24px;
          margin-bottom: 30px;
        }

        .bank-box {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 16px;
          background: #f8fafc;
        }

        .bank-title {
          font-size: 11px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: 0.04em;
          margin-bottom: 10px;
        }

        .bank-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          margin-bottom: 6px;
        }

        .bank-label {
          color: #64748b;
        }

        .bank-val {
          font-weight: 600;
          color: #0f172a;
        }

        .signature-box {
          text-align: center;
          padding: 8px;
        }

        .sig-space {
          height: 60px;
        }

        .sig-name {
          font-size: 12px;
          font-weight: 700;
          color: #0f172a;
          border-top: 1px solid #94a3b8;
          padding-top: 4px;
          display: inline-block;
          min-width: 180px;
        }

        .sig-role {
          font-size: 10.5px;
          color: #64748b;
        }

        .sheet-footer {
          margin-top: auto;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
          font-size: 10px;
          color: #94a3b8;
          text-align: center;
          line-height: 1.5;
        }

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

          .invoice-print-wrapper {
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
        }
      `}</style>
    </div>
  );
}

export default function InvoicePrintView() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center' }}>Memuat invoice...</div>}>
      <InvoicePrintViewInner />
    </Suspense>
  );
}
