import React from 'react';
import pool from '@/lib/db';
import { normalizeRoleSnapshot } from '@/lib/costing';

export const instant = false;

async function getEstimate(id: number) {
  const estRes = await pool.query(`
    SELECT
      e.*,
      p.name as project_name,
      c.name as company_name,
      c.email as company_email,
      st.code as service_type_code,
      st.name as service_type_name,
      t.code as tag_code,
      t.name as tag_name
    FROM project_estimates e
    JOIN companies c ON e.company_id = c.id
    JOIN service_types st ON e.service_type_id = st.id
    LEFT JOIN projects p ON e.project_id = p.id
    LEFT JOIN tags t ON e.tag_id = t.id
    WHERE e.id = $1
  `, [id]);

  if (estRes.rows.length === 0) return null;
  const est = estRes.rows[0];

  const catRes = await pool.query(`
    SELECT c.id, c.code, c.name
    FROM estimate_categories ec
    JOIN categories c ON ec.category_id = c.id
    WHERE ec.estimate_id = $1
  `, [id]);
  est.categories = catRes.rows;

  const modRes = await pool.query(`
    SELECT id, name, order_index, total_hours, total_cost
    FROM estimate_modules
    WHERE estimate_id = $1
    ORDER BY order_index ASC
  `, [id]);

  const modules = [];
  for (const mod of modRes.rows) {
    const taskRes = await pool.query(`
      SELECT id, name, order_index, hours_pm, hours_web_dev, hours_ui_ux, hours_qc_doc, hours_dev_ops, total_hours, total_cost, role_hours
      FROM estimate_tasks
      WHERE module_id = $1
      ORDER BY order_index ASC
    `, [mod.id]);
    modules.push({ ...mod, tasks: taskRes.rows });
  }
  est.modules = modules;

  return est;
}

export default async function PrintCostingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const estimateId = parseInt(id, 10);
  if (isNaN(estimateId)) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'red' }}>ID Estimasi tidak valid</div>;
  }

  const estimate = await getEstimate(estimateId);
  if (!estimate) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'red' }}>Data estimasi tidak ditemukan</div>;
  }

  const formatIDR = (val: number | string) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return `Rp ${(num || 0).toLocaleString('id-ID')}`;
  };

  return (
    <div className="print-container" style={{ background: '#ffffff', color: '#111827', minHeight: '100vh', padding: '32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Internal Confidential Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #111827', paddingBottom: '16px', marginBottom: '20px' }}>
        <div>
          <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', backgroundColor: '#fee2e2', color: '#b91c1c', padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
            CONFIDENTIAL - INTERNAL COSTING SHEET
          </span>
          <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '8px 0 4px 0', color: '#111827' }}>
            {estimate.title}
          </h1>
          <div style={{ fontSize: '13px', color: '#4b5563' }}>
            Klien: <strong>{estimate.company_name}</strong> • Project: <strong>{estimate.project_name || '-'}</strong> • Layanan: <strong>{estimate.service_type_name}</strong>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#111827' }}>
            ESTIMATE #{estimate.id}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#2563eb' }}>
            Snapshot Versi: v{estimate.version || 1}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
            Cetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Financial Executive Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <div style={{ padding: '12px', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#f9fafb' }}>
          <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Total Real Manhours</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#111827', marginTop: '4px' }}>
            {Number(estimate.total_hours || 0).toLocaleString('id-ID')} Jam
          </div>
        </div>
        <div style={{ padding: '12px', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#f9fafb' }}>
          <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Total One-Time Charge</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#111827', marginTop: '4px' }}>
            {formatIDR(estimate.billing_summary?.total_one_time ?? estimate.total_cost ?? 0)}
          </div>
        </div>
        <div style={{ padding: '12px', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#f9fafb' }}>
          <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Monthly / Recurring</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>
            {formatIDR(estimate.billing_summary?.total_monthly_recurring ?? 0)}/bln
          </div>
        </div>
        <div style={{ padding: '12px', border: '1px solid #bbf7d0', borderRadius: '6px', background: '#f0fdf4' }}>
          <div style={{ fontSize: '11px', color: '#166534', textTransform: 'uppercase', fontWeight: 700 }}>Grand Total Biaya (COGS)</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>
            {formatIDR(estimate.total_cost || 0)}
          </div>
        </div>
      </div>

      {/* Snapshot Hourly Rate Master */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#374151', marginBottom: '8px' }}>
          Snapshot Master Hourly Rates (Basis Perhitungan Versi Ini)
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #e5e7eb' }}>
          <thead>
            <tr style={{ background: '#f3f4f6', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '8px 12px' }}>KODE ROLE</th>
              <th style={{ padding: '8px 12px' }}>NAMA ROLE</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>HOURLY RATE SNAPSHOT</th>
            </tr>
          </thead>
          <tbody>
            {estimate.rate_snapshots && Object.entries(normalizeRoleSnapshot(estimate.rate_snapshots)).map(([code, val]) => (
              <tr key={code} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '6px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{code}</td>
                <td style={{ padding: '6px 12px' }}>{val.name || code}</td>
                <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>
                  {formatIDR(val.rate || 0)}/jam
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* WBS Development */}
      {Array.isArray(estimate.modules) && estimate.modules.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#374151', marginBottom: '8px' }}>
            A. Rincian WBS Development (Modul & Tasks)
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #e5e7eb' }}>
            <thead>
              <tr style={{ background: '#f3f4f6', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '8px 12px' }}>MODUL / TASK</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', width: '60px' }}>PM</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', width: '60px' }}>DEV</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', width: '60px' }}>UI/UX</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', width: '60px' }}>QC</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', width: '60px' }}>OPS</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', width: '80px' }}>TOTAL JAM</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', width: '130px' }}>SUBTOTAL</th>
              </tr>
            </thead>
            <tbody>
              {estimate.modules.map((mod: { name: string; total_hours?: number; total_cost?: number ; tasks: { name: string; hours_pm?: number; hours_web_dev?: number; hours_ui_ux?: number; hours_qc_doc?: number; hours_dev_ops?: number; total_hours?: number; total_cost?: number }[] }, mIdx: number) => (
                <React.Fragment key={mIdx}>
                  <tr style={{ background: '#f9fafb', fontWeight: 700, borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '6px 12px' }}>{mod.name}</td>
                    <td colSpan={5}></td>
                    <td style={{ padding: '6px 12px', textAlign: 'center' }}>{mod.total_hours}h</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right' }}>{formatIDR(mod.total_cost || 0)}</td>
                  </tr>
                  {Array.isArray(mod.tasks) && mod.tasks.map((t, tIdx: number) => (
                    <tr key={tIdx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '4px 12px 4px 24px', color: '#4b5563' }}>• {t.name}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>{t.hours_pm || '-'}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>{t.hours_web_dev || '-'}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>{t.hours_ui_ux || '-'}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>{t.hours_qc_doc || '-'}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>{t.hours_dev_ops || '-'}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 600 }}>{t.total_hours}h</td>
                      <td style={{ padding: '4px 12px', textAlign: 'right', fontWeight: 500 }}>{formatIDR(t.total_cost || 0)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* WBS Maintenance */}
      {estimate.maintenance_config && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#374151', margin: 0 }}>
              B. Rincian WBS Maintenance (Rutin Bulanan)
            </h3>
            <span style={{ fontSize: '12px', color: '#4b5563' }}>
              Durasi: <strong>{estimate.maintenance_config.duration_months || 12} Bulan</strong> • Rate: <strong>{formatIDR(estimate.maintenance_config.monthly_cost || 0)}/bln</strong>
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #e5e7eb' }}>
            <thead>
              <tr style={{ background: '#f3f4f6', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '8px 12px' }}>NAMA TASK RUTIN</th>
                <th style={{ padding: '8px 12px' }}>DISTRIBUSI JAM ROLE</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', width: '100px' }}>JAM/BULAN</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', width: '140px' }}>BIAYA/BULAN</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(estimate.maintenance_config.tasks) && estimate.maintenance_config.tasks.map((t: { name: string; role_hours?: Record<string, number>; total_hours?: number; monthly_cost?: number }, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 12px', fontWeight: 500 }}>{t.name}</td>
                  <td style={{ padding: '6px 12px', color: '#4b5563' }}>
                    {t.role_hours ? Object.entries(t.role_hours).map(([k, v]) => `${k}: ${v}h`).join(', ') : '-'}
                  </td>
                  <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 600 }}>{t.total_hours}h</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>{formatIDR(t.monthly_cost || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* WBS Infrastructure */}
      {Array.isArray(estimate.infrastructure_items) && estimate.infrastructure_items.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#374151', marginBottom: '8px' }}>
            C. Rincian WBS Infrastructure Items
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #e5e7eb' }}>
            <thead>
              <tr style={{ background: '#f3f4f6', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '8px 12px' }}>KOMPONEN / SPESIFIKASI</th>
                <th style={{ padding: '8px 12px', width: '100px' }}>BILLING</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', width: '60px' }}>QTY</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', width: '120px' }}>BIAYA SATUAN</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', width: '130px' }}>SUBTOTAL</th>
              </tr>
            </thead>
            <tbody>
              {estimate.infrastructure_items.map((item: { name: string; billing_type: string; quantity?: number; unit_cost?: number; period_count?: number; notes?: string }, idx: number) => {
                const qty = Number(item.quantity || 1);
                const cost = Number(item.unit_cost || 0);
                const period = Number(item.period_count || 1);
                const lineSubtotal = item.billing_type === 'ONE_TIME' ? qty * cost : qty * cost * period;
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      {item.notes && <div style={{ fontSize: '11px', color: '#6b7280' }}>{item.notes}</div>}
                    </td>
                    <td style={{ padding: '6px 12px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: '#f3f4f6' }}>
                        {item.billing_type}
                      </span>
                    </td>
                    <td style={{ padding: '6px 12px', textAlign: 'center' }}>{qty}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right' }}>{formatIDR(cost)}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>{formatIDR(lineSubtotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* WBS Operational */}
      {Array.isArray(estimate.operational_items) && estimate.operational_items.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#374151', marginBottom: '8px' }}>
            D. Rincian WBS Biaya Operasional (Transport & Akomodasi)
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #e5e7eb' }}>
            <thead>
              <tr style={{ background: '#f3f4f6', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '8px 12px' }}>ITEM OPERASIONAL</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', width: '70px' }}>ORANG</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', width: '70px' }}>HARI</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', width: '130px' }}>RATE/HARI/PAX</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', width: '130px' }}>SUBTOTAL</th>
              </tr>
            </thead>
            <tbody>
              {estimate.operational_items.map((item: { name: string; people_count?: number; days_count?: number; unit_cost_per_day?: number; unit_cost?: number; notes?: string }, idx: number) => {
                const pax = Number(item.people_count || 1);
                const days = Number(item.days_count || 1);
                const rate = Number(item.unit_cost_per_day || item.unit_cost || 0);
                const lineSubtotal = pax * days * rate;
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      {item.notes && <div style={{ fontSize: '11px', color: '#6b7280' }}>{item.notes}</div>}
                    </td>
                    <td style={{ padding: '6px 12px', textAlign: 'center' }}>{pax}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'center' }}>{days}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right' }}>{formatIDR(rate)}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>{formatIDR(lineSubtotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Internal Approval & Sign-off Footer */}
      <div style={{ marginTop: '36px', borderTop: '1px dashed #9ca3af', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6b7280' }}>
        <div>
          Dokumen ini digenerate secara otomatis oleh <strong>busdevcore ERP</strong>.<br />
          Hak cipta dan kerahasiaan data internal tim IT & Business Development.
        </div>
        <div style={{ textAlign: 'right' }}>
          Halaman 1 dari 1 • Status: Verified
        </div>
      </div>

      {/* Client-side print trigger script */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.querySelector('.print-btn')?.addEventListener('click', function() {
              window.print();
            });
          `,
        }}
      />

      {/* CSS for print media */}
      <style>{`
        @media print {
          body > header { display: none !important; }
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          .no-print {
            display: none !important;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .print-container {
            padding: 0 !important;
            max-width: 100% !important;
          }
          table {
            page-break-inside: auto;
            width: 100% !important;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
        }
      `}</style>
    </div>
  );
}
