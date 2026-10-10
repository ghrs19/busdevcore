import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import * as XLSX from 'xlsx';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const estimateId = parseInt(id, 10);
    if (isNaN(estimateId)) {
      return NextResponse.json({ success: false, error: 'ID estimate tidak valid' }, { status: 400 });
    }

    // Fetch estimate data
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
    `, [estimateId]);

    if (estRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Estimate tidak ditemukan' }, { status: 404 });
    }

    const est = estRes.rows[0];

    // Fetch categories
    const catRes = await pool.query(`
      SELECT c.id, c.code, c.name
      FROM estimate_categories ec
      JOIN categories c ON ec.category_id = c.id
      WHERE ec.estimate_id = $1
    `, [estimateId]);
    const categories = catRes.rows;
    const catCodes = categories.map(c => c.code.toUpperCase());

    // Fetch modules & tasks
    const modRes = await pool.query(`
      SELECT id, name, order_index, total_hours, total_cost
      FROM estimate_modules
      WHERE estimate_id = $1
      ORDER BY order_index ASC
    `, [estimateId]);

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

    // Initialize Workbook
    const wb = XLSX.utils.book_new();

    // 1. SHEET: SUMMARY & RATES
    const ratesData: any[] = [
      ['INTERNAL PROJECT COSTING SHEET', ''],
      ['STATUS', 'CONFIDENTIAL - FOR INTERNAL TEAM USE ONLY'],
      ['GENERATED AT', new Date().toISOString().replace('T', ' ').slice(0, 19)],
      ['', ''],
      ['INFORMASI ESTIMASI', ''],
      ['ID Dokumen', `#${est.id}`],
      ['Versi Snapshot', `v${est.version || 1}`],
      ['Judul Estimasi', est.title],
      ['Klien / Perusahaan', est.company_name],
      ['Project', est.project_name || '-'],
      ['Tipe Layanan', est.service_type_name],
      ['Kategori Terpilih', categories.map(c => c.name).join(', ') || 'Development'],
      ['Tag Dev', est.tag_name || '-'],
      ['Catatan / Asumsi', est.notes || '-'],
      ['', ''],
      ['RINGKASAN BIAYA (COGS)', ''],
      ['Total Jam Kerja Riil', `${Number(est.total_hours || 0).toLocaleString('id-ID')} Jam`],
      ['Total Biaya / Kontrak', `Rp ${Number(est.total_cost || 0).toLocaleString('id-ID')}`],
      ['', ''],
      ['SNAPSHOT MASTER HOURLY RATE (RP/JAM)', ''],
      ['Role Code', 'Role Name', 'Hourly Rate (IDR)']
    ];

    if (est.rate_snapshots && typeof est.rate_snapshots === 'object') {
      Object.entries(est.rate_snapshots).forEach(([code, val]: [string, any]) => {
        const name = typeof val === 'object' && val !== null ? val.name || code : code;
        const rate = typeof val === 'object' && val !== null ? val.rate || 0 : Number(val || 0);
        ratesData.push([code, name, rate]);
      });
    }

    const wsSummary = XLSX.utils.aoa_to_sheet(ratesData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary & Rates');

    // 2. SHEET: WBS DEVELOPMENT (If has modules or DEV category)
    if (modules.length > 0 || catCodes.includes('DEV') || catCodes.includes('DEVELOPMENT')) {
      const devData: any[] = [
        ['WBS DEVELOPMENT - MODUL & MANHOURS BREAKDOWN'],
        ['Modul', 'Task', 'PM (Jam)', 'Web Dev (Jam)', 'UI-UX (Jam)', 'QC-Doc (Jam)', 'DevOps (Jam)', 'Total Jam', 'Subtotal Biaya (IDR)']
      ];

      modules.forEach(m => {
        m.tasks.forEach((t: any) => {
          devData.push([
            m.name,
            t.name,
            Number(t.hours_pm || 0),
            Number(t.hours_web_dev || 0),
            Number(t.hours_ui_ux || 0),
            Number(t.hours_qc_doc || 0),
            Number(t.hours_dev_ops || 0),
            Number(t.total_hours || 0),
            Number(t.total_cost || 0)
          ]);
        });
        devData.push([
          `SUBTOTAL ${m.name}`, '', '', '', '', '', '',
          Number(m.total_hours || 0),
          Number(m.total_cost || 0)
        ]);
        devData.push(['', '', '', '', '', '', '', '', '']);
      });

      const wsDev = XLSX.utils.aoa_to_sheet(devData);
      XLSX.utils.book_append_sheet(wb, wsDev, 'WBS Development');
    }

    // 3. SHEET: WBS MAINTENANCE (If has maintenance)
    if (est.maintenance_config || catCodes.includes('MAINTENANCE')) {
      const mConf = est.maintenance_config || {};
      const maintTasks = Array.isArray(mConf.tasks) ? mConf.tasks : [];
      const maintData: any[] = [
        ['WBS MAINTENANCE - RUTIN BULANAN'],
        ['Durasi Kontrak (Bulan)', Number(mConf.duration_months || 12)],
        ['Rate / Biaya Bulanan', Number(mConf.monthly_cost || 0)],
        ['Total Kontrak Maintenance', Number(mConf.total_cost || 0)],
        ['', ''],
        ['Nama Task Rutin', 'Detail Alokasi Jam Role', 'Total Jam/Bulan', 'Biaya/Bulan (IDR)']
      ];

      maintTasks.forEach((t: any) => {
        const rhStr = t.role_hours ? Object.entries(t.role_hours).map(([k, v]) => `${k}: ${v}h`).join(', ') : '-';
        maintData.push([
          t.name,
          rhStr,
          Number(t.total_hours || 0),
          Number(t.monthly_cost || 0)
        ]);
      });

      const wsMaint = XLSX.utils.aoa_to_sheet(maintData);
      XLSX.utils.book_append_sheet(wb, wsMaint, 'WBS Maintenance');
    }

    // 4. SHEET: WBS INFRASTRUCTURE (If has infrastructure)
    if (Array.isArray(est.infrastructure_items) && est.infrastructure_items.length > 0) {
      const infraData: any[] = [
        ['WBS INFRASTRUCTURE - HARDWARE & CLOUD ITEMS'],
        ['Nama Item / Komponen', 'Billing Type', 'Qty', 'Durasi (Bln/Thn)', 'Biaya Satuan (IDR)', 'Subtotal (IDR)', 'Catatan / Provider']
      ];

      est.infrastructure_items.forEach((item: any) => {
        const qty = Number(item.quantity || 1);
        const cost = Number(item.unit_cost || 0);
        const period = Number(item.period_count || 1);
        const subtotal = item.billing_type === 'ONE_TIME' ? qty * cost : qty * cost * period;
        infraData.push([
          item.name,
          item.billing_type,
          qty,
          period,
          cost,
          subtotal,
          item.notes || '-'
        ]);
      });

      const wsInfra = XLSX.utils.aoa_to_sheet(infraData);
      XLSX.utils.book_append_sheet(wb, wsInfra, 'WBS Infrastructure');
    }

    // 5. SHEET: WBS OPERATIONAL (If has operational)
    if (Array.isArray(est.operational_items) && est.operational_items.length > 0) {
      const opData: any[] = [
        ['WBS OPERATIONAL - BIAYA PERJALANAN & AKOMODASI'],
        ['Nama Item Operasional', 'Jumlah Orang (Pax)', 'Jumlah Hari', 'Rate/Hari/Pax (IDR)', 'Subtotal Biaya (IDR)', 'Catatan / Lokasi']
      ];

      est.operational_items.forEach((item: any) => {
        const pax = Number(item.people_count || 1);
        const days = Number(item.days_count || 1);
        const rate = Number(item.unit_cost_per_day || item.unit_cost || 0);
        const subtotal = pax * days * rate;
        opData.push([
          item.name,
          pax,
          days,
          rate,
          subtotal,
          item.notes || '-'
        ]);
      });

      const wsOp = XLSX.utils.aoa_to_sheet(opData);
      XLSX.utils.book_append_sheet(wb, wsOp, 'WBS Operational');
    }

    // Generate Buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `Internal_Costing_${est.id}_v${est.version || 1}_${est.company_name.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
