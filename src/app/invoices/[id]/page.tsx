'use client';

import { Suspense, useEffect, useState } from 'react';
import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PrinterIcon,
  PaperClipIcon,
  ArrowUpTrayIcon,
  ArrowLeftIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  BuildingOfficeIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  DocumentTextIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';

interface InvoiceDetail {
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
  proof_file_url?: string;
  proof_file_name?: string;
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
  updated_by_name?: string;
}

const formatIDR = (val: number | string) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return `Rp ${(num || 0).toLocaleString('id-ID')}`;
};

const getStatusBadge = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'paid':
      return { label: 'Paid / Lunas', bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
    case 'invoiced':
      return { label: 'Invoiced (Pending Tagihan)', bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.3)' };
    case 'overdue':
      return { label: 'Overdue (Lewat Jatuh Tempo)', bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' };
    case 'unbilled':
    default:
      return { label: 'Unbilled (Draft / Belum Ditagih)', bg: 'rgba(255, 255, 255, 0.05)', text: 'var(--text-secondary)', border: 'rgba(255, 255, 255, 0.12)' };
  }
};

function InvoiceDetailPageInner() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params?.id as string;

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [siblings, setSiblings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [isEditing, setIsEditing] = useState(false);
  const [modalForm, setModalForm] = useState({
    billing_status: 'unbilled',
    invoice_number: '',
    invoice_date: '',
    due_date: '',
    paid_date: '',
    paid_amount: 0,
    proof_reference: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (invoiceId) {
      loadDetail();
    }
  }, [invoiceId]);

  async function loadDetail() {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`);
      const data = await res.json();
      if (data.success && data.invoice) {
        setInvoice(data.invoice);
        setSiblings(data.sibling_milestones || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const openEditModal = () => {
    if (!invoice) return;
    setModalForm({
      billing_status: invoice.billing_status || 'unbilled',
      invoice_number: invoice.invoice_number || '',
      invoice_date: invoice.invoice_date ? invoice.invoice_date.split('T')[0] : '',
      due_date: invoice.due_date ? invoice.due_date.split('T')[0] : '',
      paid_date: invoice.paid_date ? invoice.paid_date.split('T')[0] : '',
      paid_amount: Number(invoice.paid_amount) || Number(invoice.amount) || 0,
      proof_reference: invoice.proof_reference || '',
      notes: invoice.notes || '',
    });
    setIsEditing(true);
  };

  const [uploadingProof, setUploadingProof] = useState(false);

  const handleUploadProofFile = async (file: File) => {
    if (!invoice) return;
    setUploadingProof(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/invoices/${invoice.id}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        alert('Bukti pembayaran berhasil diunggah ke MinIO Storage!');
        loadDetail();
      } else {
        alert(data.error || 'Gagal mengunggah file bukti');
      }
    } catch {
      alert('Gagal terhubung ke server');
    } finally {
      setUploadingProof(false);
    }
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/commercial/${invoice.proposal_id}/milestones`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          milestone_id: invoice.id,
          ...modalForm,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsEditing(false);
        loadDetail();
      } else {
        alert(data.error || 'Gagal menyimpan status');
      }
    } catch {
      alert('Gagal terhubung ke server');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
        Memuat detail invoice...
      </div>
    );
  }

  if (!invoice) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>Invoice tidak ditemukan</div>
        <Link href="/invoices" className="btn-secondary" style={{ textDecoration: 'none' }}>
          ← Kembali ke Tracker Invoices
        </Link>
      </div>
    );
  }

  const badge = getStatusBadge(invoice.billing_status);
  const isPaid = invoice.billing_status === 'paid';
  const isRecurring = invoice.billing_type === 'recurring_monthly';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', paddingBottom: '80px' }}>
      <main style={{ maxWidth: '1360px', margin: '0 auto', padding: '24px 20px' }}>
        {/* Navigation Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <Link
            href="/invoices"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              color: 'var(--text-tertiary)',
              textDecoration: 'none',
              transition: 'color 0.15s ease',
            }}
          >
            <ArrowLeftIcon style={{ width: '14px', height: '14px' }} />
            <span>Kembali ke Invoices Tracker</span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={openEditModal}
              className="btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', padding: '6px 14px' }}
            >
              <PencilSquareIcon style={{ width: '15px', height: '15px' }} />
              <span>Update Status</span>
            </button>

            <Link
              href={`/invoices/${invoice.id}/print`}
              target="_blank"
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12.5px',
                padding: '6px 16px',
                textDecoration: 'none',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                borderColor: '#10b981',
              }}
            >
              <PrinterIcon style={{ width: '15px', height: '15px' }} />
              <span>Cetak PDF Invoice</span>
            </Link>
          </div>
        </div>

        {/* Header Invoice Card */}
        <div
          className="linear-card"
          style={{
            padding: '24px 28px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            borderLeft: `4px solid ${isPaid ? '#10b981' : '#38bdf8'}`,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '20px',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                }}
              >
                {invoice.invoice_number || `Draft Invoice #${invoice.id}`}
              </span>
              <span
                className="linear-badge"
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  background: badge.bg,
                  color: badge.text,
                  border: `1px solid ${badge.border}`,
                }}
              >
                {badge.label}
              </span>
              <span
                className="linear-badge"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 8px',
                  background: isRecurring ? 'rgba(168, 85, 247, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                  color: isRecurring ? '#c084fc' : '#38bdf8',
                  border: `1px solid ${isRecurring ? 'rgba(168, 85, 247, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`,
                }}
              >
                {isRecurring ? 'Retainer Bulanan' : 'Termin Milestone'}
              </span>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {invoice.milestone_name} • Klien: <strong style={{ color: 'var(--text-primary)' }}>{invoice.company_name}</strong> ({invoice.project_name})
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>
              Nominal Penagihan
            </div>
            <div
              className="font-mono-numbers"
              style={{
                fontSize: '26px',
                fontWeight: 800,
                color: isPaid ? '#10b981' : 'var(--text-primary)',
                marginTop: '4px',
              }}
            >
              {formatIDR(invoice.amount)}
            </div>
            {invoice.percent > 0 && (
              <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                Bobot Termin: {invoice.percent}% dari Grand Total Proyek
              </div>
            )}
          </div>
        </div>

        {/* 2-Columns Grid Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          {/* Panel Administrasi Penagihan */}
          <div className="linear-card" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <CalendarDaysIcon style={{ width: '18px', height: '18px', color: 'var(--accent-hover)' }} />
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Informasi Tanggal & Penagihan
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Nomor Invoice Resmi</span>
                <span style={{ fontSize: '12.5px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {invoice.invoice_number || '(Belum Diterbitkan)'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Tanggal Terbit Invoice</span>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  {invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Jatuh Tempo (Due Date)</span>
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: invoice.due_date ? '#f59e0b' : 'var(--text-secondary)' }}>
                  {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Status Realisasi Bayar</span>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: isPaid ? '#10b981' : 'var(--text-tertiary)' }}>
                  {isPaid ? `Lunas (${formatIDR(invoice.paid_amount || invoice.amount)})` : 'Belum Diterima'}
                </span>
              </div>

              {invoice.paid_date && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Tanggal Pelunasan</span>
                  <span style={{ fontSize: '12.5px', color: '#10b981' }}>
                    {new Date(invoice.paid_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              )}

              {invoice.proof_reference && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Ref. Transfer Bank</span>
                  <span style={{ fontSize: '12.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {invoice.proof_reference}
                  </span>
                </div>
              )}

              {/* Bukti Fisik / Scan Bukti Bayar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Bukti Struk / Slip Transfer</span>
                {invoice.proof_file_url ? (
                  <a
                    href={invoice.proof_file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary"
                    style={{
                      padding: '4px 10px',
                      fontSize: '11.5px',
                      textDecoration: 'none',
                      color: '#10b981',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                    }}
                    title={`Lihat file: ${invoice.proof_file_name || 'Bukti Transfer'}`}
                  >
                    <PaperClipIcon style={{ width: '13px', height: '13px' }} />
                    <span>Lihat Bukti Bayar</span>
                  </a>
                ) : (
                  <label
                    className="btn-secondary"
                    style={{
                      padding: '4px 10px',
                      fontSize: '11.5px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    title="Upload slip transfer / bukti setor ke MinIO Storage"
                  >
                    <ArrowUpTrayIcon style={{ width: '13px', height: '13px' }} />
                    <span>{uploadingProof ? 'Mengunggah...' : 'Upload Slip Bank'}</span>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadProofFile(file);
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Panel Identitas Klien & Kontrak */}
          <div className="linear-card" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <BuildingOfficeIcon style={{ width: '18px', height: '18px', color: 'var(--accent-hover)' }} />
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Data Klien & Proposal Asal
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Nama Perusahaan</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {invoice.company_name}
                </div>
                {invoice.company_address && (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {invoice.company_address}
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Proyek & Dokumen</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {invoice.project_name}
                </div>
                <div style={{ marginTop: '4px' }}>
                  <Link
                    href={`/commercial/${invoice.proposal_id}`}
                    style={{ fontSize: '12px', color: 'var(--accent-hover)', textDecoration: 'none', fontWeight: 600 }}
                  >
                    Buka Dokumen Proposal: {invoice.proposal_number} v{invoice.proposal_version} →
                  </Link>
                </div>
              </div>

              {invoice.coverage_period && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Periode Layanan Retainer</div>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#c084fc', marginTop: '2px' }}>
                    {invoice.coverage_period}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sibling Milestones (Rangkaian Termin Proposal) */}
        {siblings.length > 1 && (
          <div className="linear-card" style={{ padding: '26px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
                  Rangkaian Termin & Jadwal Penagihan Kontrak
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  Alur jadwal penagihan kontrak proposal #{invoice.proposal_number}. Invoice yang sedang aktif ditandai secara khusus.
                </p>
              </div>
              <span className="linear-badge" style={{ fontSize: '11.5px', fontWeight: 600 }}>
                {siblings.length} Tahap Penagihan
              </span>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '10px' }}>
              <table className="pro-table" style={{ width: '100%', minWidth: '880px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '70px', textAlign: 'center', padding: '14px 16px' }}>No</th>
                    <th style={{ textAlign: 'left', padding: '14px 20px' }}>Tahapan Termin / Milestone</th>
                    <th style={{ width: '170px', textAlign: 'right', padding: '14px 20px' }}>Nominal (IDR)</th>
                    <th style={{ width: '180px', textAlign: 'center', padding: '14px 16px' }}>Status Penagihan</th>
                    <th style={{ width: '170px', textAlign: 'left', padding: '14px 18px' }}>No. Invoice</th>
                    <th style={{ width: '110px', textAlign: 'center', padding: '14px 16px' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {siblings.map((sib, idx) => {
                    const isCurrent = sib.id === invoice.id;
                    const sb = getStatusBadge(sib.billing_status);

                    return (
                      <tr
                        key={sib.id}
                        style={{
                          background: isCurrent ? 'rgba(94, 106, 210, 0.1)' : 'transparent',
                          borderLeft: isCurrent ? '3px solid var(--accent-hover)' : '3px solid transparent',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <td style={{ textAlign: 'center', padding: '16px', fontWeight: isCurrent ? 800 : 500, color: isCurrent ? 'var(--accent-hover)' : 'var(--text-tertiary)' }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: isCurrent ? 700 : 600, color: isCurrent ? 'var(--text-primary)' : 'var(--text-primary)', fontSize: '13.5px' }}>
                              {sib.milestone_name}
                            </span>
                            {isCurrent && (
                              <span
                                className="linear-badge"
                                style={{
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  background: 'rgba(94, 106, 210, 0.25)',
                                  color: '#a5b4fc',
                                  border: '1px solid rgba(94, 106, 210, 0.4)',
                                  padding: '1px 7px',
                                }}
                              >
                                Sedang Dibuka
                              </span>
                            )}
                          </div>
                          {sib.percent > 0 && (
                            <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
                              Bobot: {sib.percent}% dari Grand Total Proyek
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', padding: '16px 20px', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '13.5px', color: sib.billing_status === 'paid' ? '#10b981' : 'var(--text-primary)' }}>
                          {formatIDR(sib.amount)}
                        </td>
                        <td style={{ textAlign: 'center', padding: '16px' }}>
                          <span
                            className="linear-badge"
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 10px',
                              borderRadius: '6px',
                              background: sb.bg,
                              color: sb.text,
                              border: `1px solid ${sb.border}`,
                              display: 'inline-block',
                            }}
                          >
                            {sb.label}
                          </span>
                        </td>
                        <td style={{ padding: '16px 18px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                          {sib.invoice_number ? (
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {sib.invoice_number}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                              (Belum Terbit)
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', padding: '16px' }}>
                          {!isCurrent ? (
                            <Link
                              href={`/invoices/${sib.id}`}
                              className="btn-secondary"
                              style={{
                                padding: '5px 12px',
                                fontSize: '11.5px',
                                textDecoration: 'none',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                color: 'var(--text-primary)',
                              }}
                              title="Buka Halaman Invoice Termin Ini"
                            >
                              <span>Buka</span>
                              <span>→</span>
                            </Link>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--accent-hover)', fontWeight: 700, padding: '4px 8px' }}>
                              ✓ Aktif
                            </span>
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

        {/* Modal Update Status */}
        {isEditing && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              backdropFilter: 'blur(4px)',
            }}
          >
            <div
              className="linear-card-elevated"
              style={{
                width: '100%',
                maxWidth: '520px',
                padding: '24px',
                background: '#0d1117',
                border: '1px solid var(--border-hover)',
                borderRadius: '12px',
              }}
            >
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                Update Status Invoice & Pembayaran
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
                {invoice.milestone_name} • Nilai: <strong style={{ color: '#10b981' }}>{formatIDR(invoice.amount)}</strong>
              </p>

              <form onSubmit={handleSaveModal}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Status Penagihan (Billing Stage)
                    </label>
                    <select
                      className="linear-select"
                      value={modalForm.billing_status}
                      onChange={(e) => setModalForm({ ...modalForm, billing_status: e.target.value })}
                      style={{ width: '100%' }}
                    >
                      <option value="unbilled">Unbilled (Belum Ditagihkan)</option>
                      <option value="invoiced">Invoiced (Invoice Diterbitkan)</option>
                      <option value="paid">Paid (Telah Diterima Lunas)</option>
                      <option value="overdue">Overdue (Lewat Jatuh Tempo)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Nomor Invoice Resmi
                    </label>
                    <input
                      type="text"
                      className="linear-input"
                      placeholder="INV/2026/10/001"
                      value={modalForm.invoice_number}
                      onChange={(e) => setModalForm({ ...modalForm, invoice_number: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Tanggal Terbit Invoice
                    </label>
                    <input
                      type="date"
                      className="linear-input"
                      value={modalForm.invoice_date}
                      onChange={(e) => setModalForm({ ...modalForm, invoice_date: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Tanggal Jatuh Tempo (Due Date)
                    </label>
                    <input
                      type="date"
                      className="linear-input"
                      value={modalForm.due_date}
                      onChange={(e) => setModalForm({ ...modalForm, due_date: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Tanggal Pelunasan (Paid Date)
                    </label>
                    <input
                      type="date"
                      className="linear-input"
                      value={modalForm.paid_date}
                      onChange={(e) => setModalForm({ ...modalForm, paid_date: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Nominal Pembayaran Diterima (Rp)
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="linear-input font-mono-numbers"
                      value={modalForm.paid_amount}
                      onChange={(e) => setModalForm({ ...modalForm, paid_amount: parseFloat(e.target.value) || 0 })}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Referensi Bukti Transfer / Catatan
                    </label>
                    <input
                      type="text"
                      className="linear-input"
                      placeholder="BCA Trf #982137 - PT Klien"
                      value={modalForm.proof_reference}
                      onChange={(e) => setModalForm({ ...modalForm, proof_reference: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="btn-secondary"
                    style={{ padding: '6px 14px' }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary"
                    style={{ padding: '6px 16px' }}
                  >
                    {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function InvoiceDetailPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Memuat...</div>}>
      <InvoiceDetailPageInner />
    </Suspense>
  );
}
