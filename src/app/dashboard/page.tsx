'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BanknotesIcon,
  ArrowTrendingUpIcon,
  BriefcaseIcon,
  ClockIcon,
  SparklesIcon,
  UserGroupIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  BuildingOfficeIcon,
  CreditCardIcon,
  ShieldCheckIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

const formatIDR = (val: number | string) => `Rp ${(Number(val) || 0).toLocaleString('id-ID')}`;

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [topRoles, setTopRoles] = useState<any[]>([]);
  const [topClients, setTopClients] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const res = await fetch('/api/dashboard/analytics');
        const data = await res.json();
        if (data.success) {
          setStats(data.stats);
          setTopRoles(data.top_roles || []);
          setTopClients(data.top_clients || []);
          setRecentActivities(data.recent_activities || []);
        }
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
        Memuat data dashboard eksekutif...
      </div>
    );
  }

  const crm = stats?.crm || {};
  const cashflow = stats?.cashflow || {};
  const costing = stats?.costing || {};

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', paddingBottom: '80px' }}>
      <main style={{ maxWidth: '1360px', margin: '0 auto', padding: '28px 24px' }}>
        {/* Top Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '28px',
            paddingBottom: '20px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              Business & Financial Dashboard
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              Ringkasan metrik eksekutif PT Penta Code Digital: Deal Won, Realisasi Kas Masuk, Piutang, dan Utilisasi Tim.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Link
              href="/commercial/new"
              className="btn-secondary"
              style={{ padding: '8px 16px', fontSize: '12.5px', textDecoration: 'none' }}
            >
              + Buat Proposal Quote
            </Link>
            <Link
              href="/estimates/new"
              className="btn-primary"
              style={{ padding: '8px 18px', fontSize: '12.5px', textDecoration: 'none' }}
            >
              + Buat Costing Baru
            </Link>
          </div>
        </div>

        {/* SECTION 1: 4 KARTU METRIK EKSEKUTIF UTAMA */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '16px',
            marginBottom: '28px',
          }}
        >
          {/* Card 1: Deal Won */}
          <div className="linear-card" style={{ padding: '22px', border: '1px solid rgba(16, 185, 129, 0.35)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#10b981', fontWeight: 700 }}>
                Nilai Deal Won (Revenue)
              </span>
              <span className="linear-badge" style={{ fontSize: '10.5px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                Win Rate {crm.win_rate}%
              </span>
            </div>
            <div className="font-mono-numbers" style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', marginTop: '10px' }}>
              {formatIDR(crm.total_won_value)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
              <span>{crm.won_count} Proposal Disepakati</span>
              <span style={{ color: 'var(--text-secondary)' }}>Avg Margin: {crm.avg_won_margin}%</span>
            </div>
          </div>

          {/* Card 2: Realisasi Kas Masuk (Paid) */}
          <div className="linear-card" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', fontWeight: 700 }}>
                Kas Masuk Diterima (Paid)
              </span>
              <BanknotesIcon style={{ width: '18px', height: '18px', color: '#38bdf8' }} />
            </div>
            <div className="font-mono-numbers" style={{ fontSize: '24px', fontWeight: 800, color: '#38bdf8', marginTop: '10px' }}>
              {formatIDR(cashflow.total_cash_collected)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
              Realisasi dari {cashflow.count_paid} invoice yang telah terbayar lunas
            </div>
          </div>

          {/* Card 3: Piutang Ditagihkan (Invoiced) */}
          <div className="linear-card" style={{ padding: '22px', border: cashflow.total_invoiced_pending > 0 ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#f59e0b', fontWeight: 700 }}>
                Piutang Pending (Invoiced)
              </span>
              <ClockIcon style={{ width: '18px', height: '18px', color: '#f59e0b' }} />
            </div>
            <div className="font-mono-numbers" style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b', marginTop: '10px' }}>
              {formatIDR(cashflow.total_invoiced_pending)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
              {cashflow.count_invoiced} invoice terbit menunggu pembayaran klien
            </div>
          </div>

          {/* Card 4: Active Pipeline */}
          <div className="linear-card" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', fontWeight: 700 }}>
                Active Proposal Pipeline
              </span>
              <ArrowTrendingUpIcon style={{ width: '18px', height: '18px', color: '#c084fc' }} />
            </div>
            <div className="font-mono-numbers" style={{ fontSize: '24px', fontWeight: 800, color: '#c084fc', marginTop: '10px' }}>
              {formatIDR(crm.active_pipeline_value)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
              {crm.draft_count + crm.sent_count + crm.negotiation_count} proposal dalam tahap penawaran & negosiasi
            </div>
          </div>
        </div>

        {/* SECTION 2: 3 WIDGET ANALITIK BISNIS (GRID 3 KOLOM) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '28px' }}>
          {/* Widget 1: Pipeline Breakdown Status */}
          <div className="linear-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <BriefcaseIcon style={{ width: '18px', height: '18px', color: 'var(--accent-hover)' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Status Pipeline Penawaran (CRM)
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'Won (Deal Disepakati)', count: crm.won_count, color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
                { label: 'Negosiasi Komersial', count: crm.negotiation_count, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
                { label: 'Terkirim ke Klien (Sent)', count: crm.sent_count, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' },
                { label: 'Draft Internal', count: crm.draft_count, color: 'var(--text-secondary)', bg: 'rgba(255, 255, 255, 0.05)' },
                { label: 'Lost / Batal', count: crm.lost_count, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: item.bg,
                    border: `1px solid ${item.color}33`,
                  }}
                >
                  <span style={{ fontSize: '12.5px', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {item.label}
                  </span>
                  <span className="font-mono-numbers" style={{ fontSize: '13px', fontWeight: 700, color: item.color }}>
                    {item.count} Proposal
                  </span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-tertiary)' }}>Estimasi Gross Profit Won:</span>
              <strong style={{ color: '#10b981', fontFamily: 'var(--font-mono)' }}>{formatIDR(crm.estimated_gross_profit)}</strong>
            </div>
          </div>

          {/* Widget 2: Recurring Retainer & Unbilled Schedule */}
          <div className="linear-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <CreditCardIcon style={{ width: '18px', height: '18px', color: '#c084fc' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Arus Kas Recurring & Jadwal Termin
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.25)' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#c084fc', fontWeight: 600 }}>
                  Monthly Recurring Revenue (MRR)
                </div>
                <div className="font-mono-numbers" style={{ fontSize: '20px', fontWeight: 800, color: '#c084fc', marginTop: '4px' }}>
                  {formatIDR(cashflow.current_mrr)}/bulan
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  Pendapatan rutin aktif pemeliharaan & cloud hosting
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Jadwal Belum Ditagih (Unbilled):</span>
                <span className="font-mono-numbers" style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {formatIDR(cashflow.total_unbilled_schedule)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Tagihan Lewat Jatuh Tempo (Overdue):</span>
                <span className="font-mono-numbers" style={{ fontSize: '12.5px', fontWeight: 700, color: cashflow.total_overdue_amount > 0 ? '#ef4444' : '#10b981' }}>
                  {formatIDR(cashflow.total_overdue_amount)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Total Komitmen Kontrak Keseluruhan:</span>
                <span className="font-mono-numbers" style={{ fontSize: '13px', fontWeight: 800, color: '#10b981' }}>
                  {formatIDR(cashflow.total_contract_committed)}
                </span>
              </div>
            </div>
          </div>

          {/* Widget 3: Costing & Manhours Production Capacity */}
          <div className="linear-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <SparklesIcon style={{ width: '18px', height: '18px', color: 'var(--accent-hover)' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Kapasitas Estimasi & Manhours
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.025)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Total Dokumen Costing</div>
                <div className="font-mono-numbers" style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {costing.total_estimates}
                </div>
              </div>

              <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.025)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Total Manhours Terkuotasi</div>
                <div className="font-mono-numbers" style={{ fontSize: '20px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
                  {costing.total_manhours_quoted} jam
                </div>
              </div>
            </div>

            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Alokasi Jam Kerja per Role (Top 4 Role):
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {topRoles.slice(0, 4).map((role, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>{role.role_name} ({role.role_code}):</span>
                  <span className="font-mono-numbers" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    {role.total_allocated_hours} Jam • @{formatIDR(role.default_hourly_rate)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 3: 2 TABEL DETAIL (KLIEN KONTRAK TERBESAR & AUDIT LOG TERKINI) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
          {/* Tabel Top Klien */}
          <div className="linear-card" style={{ padding: '22px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BuildingOfficeIcon style={{ width: '18px', height: '18px', color: 'var(--accent-hover)' }} />
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Perusahaan Klien Kontrak Terbesar
                </h3>
              </div>
              <Link href="/master" style={{ fontSize: '11.5px', color: 'var(--accent-hover)', textDecoration: 'none' }}>
                Kelola Klien →
              </Link>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="pro-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Nama Perusahaan</th>
                    <th style={{ width: '70px', textAlign: 'center' }}>Deal</th>
                    <th style={{ width: '150px', textAlign: 'right' }}>Nilai Deal Won</th>
                  </tr>
                </thead>
                <tbody>
                  {topClients.length === 0 ? (
                    <tr><td colSpan={3} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)' }}>Belum ada data klien.</td></tr>
                  ) : (
                    topClients.map((client) => (
                      <tr key={client.id}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                          {client.company_name}
                        </td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                          {client.total_deals}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#10b981' }}>
                          {formatIDR(client.won_value || client.total_contract_value)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabel Aktivitas & Audit Terkini */}
          <div className="linear-card" style={{ padding: '22px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheckIcon style={{ width: '18px', height: '18px', color: '#38bdf8' }} />
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Activity Trail & Audit Terkini
                </h3>
              </div>
              <Link href="/audit" style={{ fontSize: '11.5px', color: 'var(--accent-hover)', textDecoration: 'none' }}>
                Semua Log →
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentActivities.slice(0, 6).map((log) => (
                <div
                  key={log.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '12px',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {log.user_name || 'System'}
                    </span>
                    <span style={{ color: 'var(--text-tertiary)', marginLeft: '6px' }}>
                      {log.action}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    {new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
