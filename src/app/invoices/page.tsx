'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BanknotesIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  PencilSquareIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';

interface InvoiceItem {
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
  proposal_number: string;
  proposal_version: number;
  company_name: string;
  project_name: string;
}

interface SummaryData {
  total_contract_value: number | string;
  total_paid: number | string;
  total_invoiced: number | string;
  total_unbilled: number | string;
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
      return { label: 'Invoiced (Pending)', bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.3)' };
    case 'overdue':
      return { label: 'Overdue (Jatuh Tempo)', bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' };
    case 'unbilled':
    default:
      return { label: 'Unbilled (Belum Ditagih)', bg: 'rgba(255, 255, 255, 0.05)', text: 'var(--text-secondary)', border: 'rgba(255, 255, 255, 0.12)' };
  }
};

export default function InvoicesTrackerPage() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<InvoiceItem | null>(null);
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
    loadInvoices();
  }, [statusFilter]);

  async function loadInvoices() {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices?status=${statusFilter}`);
      const data = await res.json();
      if (data.success) {
        setInvoices(data.invoices || []);
        setSummary(data.summary || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const openEditModal = (item: InvoiceItem) => {
    setEditingItem(item);
    setModalForm({
      billing_status: item.billing_status || 'unbilled',
      invoice_number: item.invoice_number || '',
      invoice_date: item.invoice_date ? item.invoice_date.split('T')[0] : '',
      due_date: item.due_date ? item.due_date.split('T')[0] : '',
      paid_date: item.paid_date ? item.paid_date.split('T')[0] : '',
      paid_amount: Number(item.paid_amount) || Number(item.amount) || 0,
      proof_reference: item.proof_reference || '',
      notes: item.notes || '',
    });
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/commercial/${editingItem.proposal_id}/milestones`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          milestone_id: editingItem.id,
          ...modalForm,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setEditingItem(null);
        loadInvoices();
      } else {
        alert(data.error || 'Gagal menyimpan status');
      }
    } catch {
      alert('Gagal terhubung ke server');
    } finally {
      setSaving(false);
    }
  };

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
              Payment Milestone & Invoice Tracker
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              Monitoring arus kas penagihan termin (Unbilled, Invoiced, Paid) dan status piutang dari deal proposal resmi.
            </p>
          </div>
        </div>

        {/* 4 Stat Metric Cards */}
        {summary && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '14px',
              marginBottom: '24px',
            }}
          >
            <div className="linear-card" style={{ padding: '18px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                Total Komitmen Termin
              </div>
              <div className="font-mono-numbers" style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '6px' }}>
                {formatIDR(summary.total_contract_value)}
              </div>
            </div>

            <div className="linear-card" style={{ padding: '18px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#10b981', fontWeight: 600 }}>
                Total Realisasi Masuk (Paid)
              </div>
              <div className="font-mono-numbers" style={{ fontSize: '20px', fontWeight: 800, color: '#10b981', marginTop: '6px' }}>
                {formatIDR(summary.total_paid)}
              </div>
            </div>

            <div className="linear-card" style={{ padding: '18px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#38bdf8', fontWeight: 600 }}>
                Piutang Ditagihkan (Invoiced)
              </div>
              <div className="font-mono-numbers" style={{ fontSize: '20px', fontWeight: 800, color: '#38bdf8', marginTop: '6px' }}>
                {formatIDR(summary.total_invoiced)}
              </div>
            </div>

            <div className="linear-card" style={{ padding: '18px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                Belum Ditagihkan (Unbilled)
              </div>
              <div className="font-mono-numbers" style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-secondary)', marginTop: '6px' }}>
                {formatIDR(summary.total_unbilled)}
              </div>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div
          className="linear-card"
          style={{
            padding: '12px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginRight: '6px' }}>Filter Status:</span>
          {[
            { id: 'all', label: 'Semua Termin' },
            { id: 'unbilled', label: 'Unbilled' },
            { id: 'invoiced', label: 'Invoiced' },
            { id: 'paid', label: 'Paid / Lunas' },
            { id: 'overdue', label: 'Overdue' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setStatusFilter(t.id)}
              className={statusFilter === t.id ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '6px', cursor: 'pointer' }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Invoices List Table */}
        <div className="linear-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="pro-table">
              <thead>
                <tr>
                  <th style={{ width: '130px', textAlign: 'left' }}>Proposal</th>
                  <th style={{ minWidth: '180px', textAlign: 'left' }}>Klien & Proyek</th>
                  <th style={{ width: '180px', textAlign: 'left' }}>Tahap Termin</th>
                  <th style={{ width: '140px', textAlign: 'right' }}>Nominal</th>
                  <th style={{ width: '150px', textAlign: 'center' }}>Status Penagihan</th>
                  <th style={{ width: '130px', textAlign: 'left' }}>No. Invoice</th>
                  <th style={{ width: '120px', textAlign: 'left' }}>Jatuh Tempo</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
                      Memuat data invoice tracker...
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
                      Tidak ada termin penagihan dengan kriteria ini.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const sb = getStatusBadge(inv.billing_status);
                    const dueDateStr = inv.due_date
                      ? new Date(inv.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '-';

                    return (
                      <tr key={inv.id}>
                        <td>
                          <Link
                            href={`/commercial/${inv.proposal_id}`}
                            style={{
                              color: 'var(--accent-hover)',
                              fontWeight: 700,
                              textDecoration: 'none',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '12.5px',
                            }}
                          >
                            {inv.proposal_number} v{inv.proposal_version}
                          </Link>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                            {inv.company_name}
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)' }}>
                            {inv.project_name}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '12.5px' }}>
                            {inv.milestone_name} ({inv.percent}%)
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                            {inv.trigger_condition || '-'}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                          {formatIDR(inv.amount)}
                        </td>
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
                            }}
                          >
                            {sb.label}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: inv.invoice_number ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                          {inv.invoice_number || '(Draft)'}
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {dueDateStr}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => openEditModal(inv)}
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <PencilSquareIcon style={{ width: '13px', height: '13px' }} />
                            <span>Update</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Update Status Penagihan */}
        {editingItem && (
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
                {editingItem.milestone_name} • Nilai: <strong style={{ color: '#10b981' }}>{formatIDR(editingItem.amount)}</strong>
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
                    onClick={() => setEditingItem(null)}
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
