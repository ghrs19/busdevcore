'use client';

import Link from 'next/link';
import { BanknotesIcon, ClockIcon, BriefcaseIcon, BuildingOfficeIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

const money = (value: number | string | undefined) => `Rp ${(Number(value) || 0).toLocaleString('id-ID')}`;

type Props = {
  crm: Record<string, number>;
  cashflow: Record<string, number>;
  topClients: Array<{ id: number; company_name: string; total_deals: number; total_contract_value: number | string; won_value: number | string }>;
  recentActivities: Array<{ id: number; user_name: string | null; action: string; created_at: string }>;
  range: string;
  onRangeChange: (range: string) => void;
};

const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e4e8ee', borderRadius: 12, padding: 22 };
const valueStyle: React.CSSProperties = { color: '#14253d', fontSize: 25, fontWeight: 700, letterSpacing: '-.035em', marginTop: 10, fontVariantNumeric: 'tabular-nums' };

export default function CorporateDashboardTemplate({ crm, cashflow, topClients, recentActivities, range, onRangeChange }: Props) {
  const stages = [
    { label: 'Draft', value: crm.draft_count || 0 },
    { label: 'Terkirim', value: crm.sent_count || 0 },
    { label: 'Negosiasi', value: crm.negotiation_count || 0 },
    { label: 'Won', value: crm.won_count || 0 },
  ];
  const maxStage = Math.max(1, ...stages.map((stage) => stage.value));
  return (
    <div className="corp-dashboard-shell">
    <main className="corp-dashboard">
      <header className="corp-header">
        <div>
          <div className="corp-eyebrow">BUSDEVCORE / OVERVIEW</div>
          <h1>Business overview</h1>
          <p>Ringkasan kinerja komersial dan arus kas.</p>
        </div>
        <div className="corp-actions">
          <label>Periode
            <select aria-label="Periode proposal" value={range} onChange={(event) => onRangeChange(event.target.value)}>
              <option value="all">Semua waktu</option><option value="30">30 hari</option><option value="90">90 hari</option>
            </select>
          </label>
          <Link href="/commercial/new" className="corp-primary">Buat proposal</Link>
          <Link href="/estimates/new" className="corp-secondary">Buat estimasi</Link>
        </div>
      </header>

      <section className="corp-kpis" aria-label="Metrik utama">
        <article style={cardStyle}><div className="corp-kpi-label"><BriefcaseIcon />Nilai kontrak dimenangkan</div><div style={valueStyle}>{money(crm.total_won_value)}</div><div className="corp-note">{crm.won_count || 0} proposal berstatus Won</div></article>
        <article style={cardStyle}><div className="corp-kpi-label"><BanknotesIcon />Kas diterima</div><div style={valueStyle}>{money(cashflow.total_cash_collected)}</div><div className="corp-note">Realisasi pembayaran tercatat</div></article>
        <article style={cardStyle}><div className="corp-kpi-label"><ClockIcon />Piutang berjalan</div><div style={valueStyle}>{money(cashflow.total_invoiced_pending)}</div><div className="corp-note">Tagihan terbit yang belum lunas</div></article>
        <article style={cardStyle}><div className="corp-kpi-label corp-danger"><ClockIcon />Lewat jatuh tempo</div><div style={valueStyle}>{money(cashflow.total_overdue_amount)}</div><div className="corp-note">Saldo overdue setelah pembayaran parsial</div></article>
      </section>

      <section className="corp-main-grid">
        <article style={cardStyle}>
          <div className="corp-section-heading"><div><h2>Pipeline proposal</h2><p>Distribusi proposal berdasarkan tahap</p></div><Link href="/commercial">Buka komersial</Link></div>
          <div className="corp-stages">{stages.map((stage, index) => <div className="corp-stage" key={stage.label}>
            <div className="corp-stage-top"><span>{stage.label}</span><strong>{stage.value}</strong></div>
            <div className="corp-track"><span style={{ width: `${Math.max(stage.value ? 8 : 0, stage.value / maxStage * 100)}%`, background: index === 3 ? '#16856b' : '#315d82' }} /></div>
          </div>)}</div>
          <div className="corp-total-row"><span>Nilai komitmen kontrak</span><strong>{money(cashflow.total_contract_committed)}</strong></div>
          <div className="corp-total-row"><span>Jadwal belum ditagih</span><strong>{money(cashflow.total_unbilled_schedule)}</strong></div>
        </article>
        <article style={cardStyle}>
          <div className="corp-section-heading"><div><h2>Ringkasan penagihan</h2><p>Posisi invoice dan penerimaan</p></div><Link href="/invoices">Lihat invoice</Link></div>
          <div className="corp-cash-summary"><div><span>Nilai overdue</span><strong>{money(cashflow.total_overdue_amount)}</strong></div><div><span>Piutang belum lunas</span><strong>{money(cashflow.total_invoiced_pending)}</strong></div><div><span>Kas diterima</span><strong>{money(cashflow.total_cash_collected)}</strong></div><div><span>Recurring bulanan</span><strong>{money(cashflow.current_mrr)}</strong></div></div>
        </article>
      </section>

      <section className="corp-bottom-grid">
        <article style={cardStyle}>
          <div className="corp-section-heading"><div className="corp-title-with-icon"><BuildingOfficeIcon /><div><h2>Klien utama</h2><p>Nilai kontrak Won tertinggi</p></div></div><Link href="/master">Kelola master</Link></div>
          {topClients.length ? <div className="corp-table-wrap"><table className="corp-table"><thead><tr><th>Perusahaan</th><th>Deal</th><th>Nilai Won</th></tr></thead><tbody>{topClients.slice(0, 5).map((client) => <tr key={client.id}><td>{client.company_name}</td><td>{client.total_deals}</td><td>{money(client.won_value || client.total_contract_value)}</td></tr>)}</tbody></table></div> : <p className="corp-empty">Data klien belum tersedia.</p>}
        </article>
        <article style={cardStyle}>
          <div className="corp-section-heading"><div className="corp-title-with-icon"><ShieldCheckIcon /><div><h2>Aktivitas terbaru</h2><p>Catatan perubahan sistem</p></div></div><Link href="/audit">Buka audit</Link></div>
          {recentActivities.length ? <ul className="corp-activity">{recentActivities.slice(0, 5).map((activity) => <li key={activity.id}><span className="corp-dot" /><div><strong>{activity.user_name || 'System'}</strong><span>{activity.action}</span></div><time dateTime={activity.created_at}>{new Date(activity.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</time></li>)}</ul> : <p className="corp-empty">Belum ada aktivitas untuk ditampilkan.</p>}
        </article>
      </section>

      <style jsx>{`
        .corp-dashboard-shell{background:#f4f6f8;min-height:100vh}.corp-dashboard{--ink:#14253d;--muted:#697586;--line:#e4e8ee;--navy:#193653;max-width:1360px;margin:0 auto;padding:34px 28px 64px;color:var(--ink);font-family:Arial, sans-serif}
        .corp-header{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;flex-wrap:wrap;margin-bottom:26px;padding-bottom:22px;border-bottom:1px solid var(--line)}
        .corp-eyebrow{font-size:10px;font-weight:700;letter-spacing:.16em;color:#54718e;margin-bottom:8px}.corp-header h1{font-size:28px;letter-spacing:-.04em;line-height:1.2}.corp-header p,.corp-section-heading p{color:var(--muted);font-size:13px;margin-top:6px}
        .corp-actions{display:flex;align-items:flex-end;gap:9px;flex-wrap:wrap}.corp-actions label{display:grid;gap:4px;color:var(--muted);font-size:11px;font-weight:600}.corp-actions select{height:38px;padding:0 12px;border:1px solid var(--line);border-radius:7px;background:#fff;color:var(--ink);font-size:12px}.corp-primary,.corp-secondary{height:38px;padding:0 14px;border-radius:7px;display:inline-flex;align-items:center;text-decoration:none;font-size:12px;font-weight:600}.corp-primary{background:#193653;color:#fff}.corp-secondary{border:1px solid var(--line);color:var(--ink);background:#fff}
        .corp-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:16px}.corp-kpi-label{display:flex;align-items:center;gap:8px;color:#697586;font-size:11px;font-weight:600}.corp-kpi-label :global(svg){width:16px;height:16px;color:#54718e}.corp-kpi-label.corp-danger :global(svg){color:#b44b4b}.corp-note{margin-top:7px;color:#7a8593;font-size:11px}
        .corp-main-grid,.corp-bottom-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:16px;margin-bottom:16px}.corp-section-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:20px}.corp-section-heading h2{font-size:15px;letter-spacing:-.02em}.corp-section-heading>a{font-size:11px;color:#315d82;text-decoration:none;font-weight:600;white-space:nowrap}.corp-stages{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:10px 0 24px}.corp-stage-top{display:flex;justify-content:space-between;color:var(--muted);font-size:11px;margin-bottom:8px}.corp-stage-top strong{color:var(--ink)}.corp-track{height:5px;border-radius:8px;background:#edf0f4;overflow:hidden}.corp-track span{display:block;height:100%;border-radius:8px}.corp-total-row{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-top:1px solid #edf0f4;color:var(--muted);font-size:12px}.corp-total-row strong{color:var(--ink);font-variant-numeric:tabular-nums}
        .corp-cash-summary{display:grid;grid-template-columns:1fr 1fr;gap:10px}.corp-cash-summary>div{padding:14px;border:1px solid #edf0f4;border-radius:8px;min-width:0}.corp-cash-summary span,.corp-cash-summary strong{display:block}.corp-cash-summary span{font-size:11px;color:var(--muted)}.corp-cash-summary strong{margin-top:7px;font-size:15px;color:var(--ink);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
        .corp-title-with-icon{display:flex;align-items:flex-start;gap:9px}.corp-title-with-icon :global(svg){width:17px;height:17px;color:#54718e;margin-top:1px}.corp-table-wrap{overflow-x:auto}.corp-table{width:100%;border-collapse:collapse;text-align:left}.corp-table th{font-size:10px;color:#7b8795;font-weight:600;padding:0 8px 10px;border-bottom:1px solid var(--line)}.corp-table td{padding:12px 8px;border-bottom:1px solid #edf0f4;font-size:12px}.corp-table td:nth-child(2),.corp-table th:nth-child(2){text-align:center}.corp-table td:last-child,.corp-table th:last-child{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.corp-empty{padding:18px 0;color:var(--muted);font-size:12px}.corp-activity{list-style:none}.corp-activity li{display:flex;align-items:flex-start;gap:10px;padding:11px 0;border-bottom:1px solid #edf0f4}.corp-dot{width:7px;height:7px;background:#315d82;border-radius:50%;margin-top:6px;flex:none}.corp-activity li div{display:grid;gap:2px;min-width:0;flex:1}.corp-activity li strong{font-size:11px}.corp-activity li div span{font-size:11px;color:var(--muted);overflow-wrap:anywhere}.corp-activity time{color:#85909d;font-size:10px;white-space:nowrap}
        @media(max-width:900px){.corp-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.corp-main-grid,.corp-bottom-grid{grid-template-columns:1fr}}
        @media(max-width:560px){.corp-dashboard{padding:24px 14px 42px}.corp-header{align-items:flex-start}.corp-header h1{font-size:24px}.corp-actions{width:100%}.corp-actions label{flex:1}.corp-actions select{width:100%}.corp-kpis{grid-template-columns:1fr 1fr;gap:9px}.corp-kpis article{padding:15px!important}.corp-kpis article>div:nth-child(2){font-size:18px!important}.corp-main-grid article,.corp-bottom-grid article{padding:17px!important}.corp-stages{grid-template-columns:1fr 1fr;row-gap:14px}.corp-cash-summary{grid-template-columns:1fr 1fr}}
        @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
      `}</style>
    </main>
    </div>
  );
}
