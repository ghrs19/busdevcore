'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Banknote,
  Building2,
  Clock3,
  CreditCard,
  Gauge,
  Handshake,
  ShieldCheck,
  TrendingUp,
  Plus,
} from 'lucide-react';
import { Page, PageHeader } from '@/components/ui/Page';
import { Card, ChartCard, LegendDot, MeterRow, StatCard, type Tone } from '@/components/ui/Cards';
import DataGrid from '@/components/ui/DataGrid';

const formatIDR = (val: number | string) => `Rp ${(Number(val) || 0).toLocaleString('id-ID')}`;

interface DashboardStats {
  crm: Record<string, number>;
  cashflow: Record<string, number>;
  costing: Record<string, number>;
}

interface TopRole {
  role_name: string;
  role_code: string;
  default_hourly_rate: number | string;
  total_allocated_hours: number;
}

interface TopClient {
  id: number;
  company_name: string;
  total_deals: number;
  total_contract_value: number | string;
  won_value: number | string;
}

interface RecentActivity {
  id: number;
  user_name: string | null;
  action: string;
  created_at: string;
}

function DetailRow({ label, value, tone = 'neutral', strong = false }: { label: string; value: React.ReactNode; tone?: Tone; strong?: boolean }) {
  const color: Record<Tone, string> = {
    neutral: 'text-fg',
    ok: 'text-ok',
    warn: 'text-warn',
    bad: 'text-bad',
    note: 'text-note',
    brand: 'text-brand-fg',
    plum: 'text-plum',
  };
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <span className="text-[12.5px] text-fg-3">{label}</span>
      <span className={`font-mono-numbers text-[13px] ${strong ? 'font-semibold' : 'font-medium'} ${color[tone]}`}>{value}</span>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topRoles, setTopRoles] = useState<TopRole[]>([]);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('all');

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const res = await fetch(`/api/dashboard/analytics?range=${range}`);
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
  }, [range]);

  if (loading) {
    return (
      <Page>
        <div className="mb-6 h-14 w-72 animate-pulse rounded-lg bg-surface-2" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[132px] animate-pulse rounded-xl border border-line bg-surface" />
          ))}
        </div>
      </Page>
    );
  }

  const crm = stats?.crm || {};
  const cashflow = stats?.cashflow || {};
  const costing = stats?.costing || {};
  const openProposals = (crm.draft_count || 0) + (crm.sent_count || 0) + (crm.negotiation_count || 0);
  const pipelineTotal = (crm.won_count || 0) + (crm.negotiation_count || 0) + (crm.sent_count || 0) + (crm.draft_count || 0) + (crm.lost_count || 0);

  return (
    <Page wide>
      <PageHeader
        eyebrow="Ringkasan eksekutif"
        title="Business & Financial Dashboard"
        description="PT Penta Code Digital: deal won, realisasi kas masuk, piutang, dan utilisasi tim."
        actions={
          <>
            <label className="flex items-center gap-2 text-[12px] text-fg-3">
              <span className="hidden sm:inline">Periode pipeline</span>
              <select aria-label="Periode proposal" value={range} onChange={(event) => setRange(event.target.value)} className="linear-select" style={{ width: 'auto', minHeight: 34, paddingTop: 5, paddingBottom: 5 }}>
                <option value="all">Semua waktu</option>
                <option value="30">30 hari terakhir</option>
                <option value="90">90 hari terakhir</option>
              </select>
            </label>
            <Link href="/commercial/new" className="btn-secondary">
              <Plus className="size-4" aria-hidden /> Proposal
            </Link>
            <Link href="/estimates/new" className="btn-primary">
              <Plus className="size-4" aria-hidden /> Costing baru
            </Link>
          </>
        }
      />

      {/* Hero: contract collection progress */}
      {(() => {
        const committed = Number(cashflow.total_contract_committed) || 0;
        const segs = [
          { key: 'collected', label: 'Terkumpul', value: Number(cashflow.total_cash_collected) || 0, bar: 'bg-ok', text: 'text-ok' },
          { key: 'pending', label: 'Menunggu bayar', value: Number(cashflow.total_invoiced_pending) || 0, bar: 'bg-note', text: 'text-note' },
          { key: 'overdue', label: 'Jatuh tempo', value: Number(cashflow.total_overdue_amount) || 0, bar: 'bg-bad', text: 'text-bad' },
          { key: 'unbilled', label: 'Belum ditagih', value: Number(cashflow.total_unbilled_schedule) || 0, bar: 'bg-fg-3', text: 'text-fg-2' },
        ];
        const base = Math.max(committed, segs.reduce((a, s) => a + s.value, 0));
        const pct = (v: number) => (base > 0 ? (v / base) * 100 : 0);
        const collectedPct = Math.round(pct(segs[0].value));
        return (
          <section aria-label="Progres penagihan kontrak" className="hero-card mb-5 p-5 sm:p-6">
            <div className="relative flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-3">Komitmen kontrak aktif</div>
                <div className="font-mono-numbers mt-2 text-[32px] font-semibold leading-none tracking-[-0.03em] text-fg sm:text-[38px]">
                  {formatIDR(committed)}
                </div>
                <p className="mt-2 text-[13px] text-fg-3">
                  <span className="font-semibold text-ok">{collectedPct}%</span> sudah terkumpul dari {crm.won_count || 0} kontrak yang disepakati.
                </p>
              </div>
              <div className="flex flex-wrap gap-x-7 gap-y-3">
                {segs.map((s) => (
                  <div key={s.key} className="min-w-[120px]">
                    <div className="flex items-center gap-1.5 text-[11.5px] text-fg-3">
                      <span className={`size-2 rounded-full ${s.bar}`} aria-hidden /> {s.label}
                    </div>
                    <div className={`font-mono-numbers mt-1 text-[15px] font-semibold ${s.text}`}>{formatIDR(s.value)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative mt-5 flex h-2.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`Terkumpul ${collectedPct}% dari komitmen kontrak`}>
              {segs.map((s) =>
                s.value > 0 ? <div key={s.key} className={`${s.bar} h-full`} style={{ width: `${pct(s.value)}%` }} title={`${s.label}: ${formatIDR(s.value)}`} /> : null,
              )}
            </div>
          </section>
        );
      })()}

      {/* KPI row */}
      <section aria-label="Metrik utama" className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Nilai deal won"
          icon={Handshake}
          tone="ok"
          value={formatIDR(crm.total_won_value)}
          hint={`${crm.won_count || 0} proposal disepakati · win rate ${crm.win_rate || 0}%`}
        />
        <StatCard label="Kas masuk diterima" icon={Banknote} tone="note" value={formatIDR(cashflow.total_cash_collected)} hint={`Dari ${cashflow.count_paid || 0} invoice terbayar`} />
        <StatCard
          label="Piutang berjalan"
          icon={Clock3}
          tone={Number(cashflow.total_overdue_amount) > 0 ? 'bad' : 'warn'}
          value={formatIDR(cashflow.total_invoiced_pending)}
          hint={`${cashflow.count_invoiced || 0} invoice menunggu · ${cashflow.count_overdue || 0} jatuh tempo`}
        />
        <StatCard label="Pipeline aktif" icon={TrendingUp} tone="plum" value={formatIDR(crm.active_pipeline_value)} hint={`${openProposals} proposal di penawaran & negosiasi`} />
      </section>

      {/* Analytics row */}
      <section className="mb-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard
          title="Status pipeline penawaran"
          description="Jumlah proposal per tahap"
          icon={Handshake}
          empty={pipelineTotal === 0}
          legend={
            <>
              <LegendDot tone="ok">Won</LegendDot>
              <LegendDot tone="plum">Negosiasi</LegendDot>
              <LegendDot tone="note">Terkirim</LegendDot>
              <LegendDot tone="neutral">Draft</LegendDot>
              <LegendDot tone="bad">Lost</LegendDot>
            </>
          }
        >
          <div className="grid gap-4">
            <MeterRow label="Won (deal disepakati)" value={crm.won_count || 0} total={pipelineTotal} tone="ok" right={`${crm.won_count || 0} proposal`} />
            <MeterRow label="Negosiasi komersial" value={crm.negotiation_count || 0} total={pipelineTotal} tone="plum" right={`${crm.negotiation_count || 0} proposal`} />
            <MeterRow label="Terkirim ke klien" value={crm.sent_count || 0} total={pipelineTotal} tone="note" right={`${crm.sent_count || 0} proposal`} />
            <MeterRow label="Draft internal" value={crm.draft_count || 0} total={pipelineTotal} tone="neutral" right={`${crm.draft_count || 0} proposal`} />
            <MeterRow label="Lost / batal" value={crm.lost_count || 0} total={pipelineTotal} tone="bad" right={`${crm.lost_count || 0} proposal`} />
          </div>
          <div className="mt-5 flex items-baseline justify-between border-t border-line pt-4 text-[12.5px]">
            <span className="text-fg-3">Estimasi gross profit won</span>
            <strong className="font-mono-numbers font-semibold text-ok">{formatIDR(crm.estimated_gross_profit)}</strong>
          </div>
        </ChartCard>

        <ChartCard title="Arus kas recurring & jadwal termin" description="Pendapatan rutin dan posisi penagihan" icon={CreditCard}>
          <div className="mb-4 rounded-xl border border-line bg-surface-2 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-3">Monthly recurring revenue</div>
            <div className="font-mono-numbers mt-1.5 text-[22px] font-semibold tracking-[-0.02em] text-fg">
              {formatIDR(cashflow.current_mrr)}
              <span className="ml-1 text-[12px] font-medium text-fg-3">/ bulan</span>
            </div>
            <div className="mt-1 text-[12px] text-fg-3">Pemeliharaan & cloud hosting aktif</div>
          </div>
          <DetailRow label="Jadwal belum ditagih" value={formatIDR(cashflow.total_unbilled_schedule)} />
          <DetailRow label="Lewat jatuh tempo" value={formatIDR(cashflow.total_overdue_amount)} tone={cashflow.total_overdue_amount > 0 ? 'bad' : 'ok'} strong />
          <DetailRow label="Total komitmen kontrak" value={formatIDR(cashflow.total_contract_committed)} strong />
        </ChartCard>

        <ChartCard title="Kapasitas estimasi & manhours" description="Dokumen costing dan alokasi jam per role" icon={Gauge} className="lg:col-span-2 xl:col-span-1" empty={!costing.total_estimates && topRoles.length === 0}>
          <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line bg-surface-2 p-3.5">
              <div className="text-[11.5px] text-fg-3">Dokumen costing</div>
              <div className="font-mono-numbers mt-1.5 text-[20px] font-semibold text-fg">{costing.total_estimates}</div>
            </div>
            <div className="rounded-xl border border-line bg-surface-2 p-3.5">
              <div className="text-[11.5px] text-fg-3">Manhours terkuotasi</div>
              <div className="font-mono-numbers mt-1.5 text-[20px] font-semibold text-fg">
                {costing.total_manhours_quoted}
                <span className="ml-1 text-[12px] font-medium text-fg-3">jam</span>
              </div>
            </div>
          </div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-3">Alokasi jam per role (top 4)</div>
          <div>
            {topRoles.slice(0, 4).map((role, idx) => (
              <div key={idx} className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-[12.5px] last:border-b-0">
                <span className="min-w-0 truncate text-fg-2">
                  {role.role_name} <span className="text-fg-3">({role.role_code})</span>
                </span>
                <span className="font-mono-numbers shrink-0 font-medium text-fg">
                  {role.total_allocated_hours} jam <span className="text-fg-3">· @{formatIDR(role.default_hourly_rate)}</span>
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
      </section>

      {/* Tables row */}
      <section className="grid gap-5 lg:grid-cols-2">
        <DataGrid
          title={
            <span className="inline-flex items-center gap-2">
              <Building2 className="size-4 text-fg-3" aria-hidden /> Klien dengan kontrak terbesar
            </span>
          }
          densityToggle={false}
          actions={
            <Link href="/master" className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-fg no-underline hover:underline">
              Kelola klien <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          }
        >
          <table className="pro-table">
            <thead>
              <tr>
                <th>Perusahaan</th>
                <th style={{ textAlign: 'center' }}>Deal</th>
                <th style={{ textAlign: 'right' }}>Nilai deal won</th>
              </tr>
            </thead>
            <tbody>
              {topClients.length === 0 ? (
                <tr>
                  <td colSpan={3} className="dg-empty">
                    Belum ada data klien.
                  </td>
                </tr>
              ) : (
                topClients.map((client) => (
                  <tr key={client.id}>
                    <td className="cell-strong cell-trunc" style={{ maxWidth: '36ch' }} title={client.company_name}>
                      <Link href="/master" className="no-underline hover:underline" aria-label={`Lihat master data klien ${client.company_name}`}>
                        {client.company_name}
                      </Link>
                    </td>
                    <td className="font-mono-numbers" style={{ textAlign: 'center' }}>
                      {client.total_deals}
                    </td>
                    <td className="cell-num font-mono-numbers cell-strong">{formatIDR(client.won_value || client.total_contract_value)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </DataGrid>

        <Card padded={false}>
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <div className="inline-flex items-center gap-2 text-[13px] font-semibold text-fg">
              <ShieldCheck className="size-4 text-fg-3" aria-hidden /> Aktivitas & audit terkini
            </div>
            <Link href="/audit" className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-fg no-underline hover:underline">
              Semua log <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          {recentActivities.length === 0 ? (
            <div className="dg-empty">Belum ada aktivitas.</div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {recentActivities.slice(0, 6).map((log) => (
                <li key={log.id} className="flex items-center justify-between gap-4 px-5 py-3 text-[12.5px]">
                  <div className="min-w-0 truncate">
                    <span className="font-semibold text-fg">{log.user_name || 'System'}</span>
                    <span className="ml-2 text-fg-3">{log.action}</span>
                  </div>
                  <time dateTime={log.created_at} className="font-mono-numbers shrink-0 text-[11.5px] text-fg-3">
                    {new Date(log.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </Page>
  );
}
