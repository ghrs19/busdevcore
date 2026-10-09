import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import {
  calculateEstimate,
  DEFAULT_ROLE_RATES,
  type RoleRateMap,
  type ModuleInput,
} from '@/lib/costing';

export async function GET() {
  try {
    const res = await pool.query(`
      SELECT 
        e.id,
        e.title,
        e.status,
        e.total_hours,
        e.total_cost,
        e.rate_snapshots,
        e.notes,
        e.created_at,
        e.updated_at,
        c.id as company_id,
        c.name as company_name,
        st.id as service_type_id,
        st.code as service_type_code,
        st.name as service_type_name,
        cat.id as category_id,
        cat.code as category_code,
        cat.name as category_name,
        t.id as tag_id,
        t.code as tag_code,
        t.name as tag_name,
        (SELECT COUNT(*)::int FROM estimate_modules m WHERE m.estimate_id = e.id) as module_count,
        (SELECT COUNT(*)::int FROM estimate_tasks tk JOIN estimate_modules m ON tk.module_id = m.id WHERE m.estimate_id = e.id) as task_count
      FROM project_estimates e
      JOIN companies c ON e.company_id = c.id
      JOIN service_types st ON e.service_type_id = st.id
      JOIN categories cat ON e.category_id = cat.id
      LEFT JOIN tags t ON e.tag_id = t.id
      ORDER BY e.id DESC
    `);

    return NextResponse.json({ success: true, estimates: res.rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const client = await pool.connect();
  try {
    const body = await req.json();
    const {
      company_id,
      service_type_id,
      category_id,
      tag_id,
      title,
      notes,
      custom_rates,
      modules,
    } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ success: false, error: 'Judul project estimate wajib diisi.' }, { status: 400 });
    }

    if (!company_id) {
      return NextResponse.json({ success: false, error: 'Perusahaan wajib dipilih.' }, { status: 400 });
    }

    // Verify company
    const compCheck = await client.query('SELECT id, name FROM companies WHERE id = $1', [company_id]);
    if (compCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Perusahaan tidak ditemukan.' }, { status: 404 });
    }

    // Verify service type
    const stCheck = await client.query('SELECT id, code, is_active FROM service_types WHERE id = $1', [service_type_id]);
    if (stCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Service Type tidak valid.' }, { status: 400 });
    }
    const serviceType = stCheck.rows[0];
    if (serviceType.code !== 'IT' || !serviceType.is_active) {
      return NextResponse.json({
        success: false,
        error: `Service Type '${serviceType.code}' tidak dapat digunakan (Digital masih reserved). Pilih IT.`,
      }, { status: 400 });
    }

    // Verify category
    const catCheck = await client.query('SELECT id, code, name FROM categories WHERE id = $1', [category_id]);
    if (catCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Kategori tidak valid.' }, { status: 400 });
    }
    const category = catCheck.rows[0];

    // Verify Tag rules
    let tag = null;
    if (category.code === 'DEVELOPMENT') {
      if (!tag_id) {
        return NextResponse.json({
          success: false,
          error: "Untuk kategori 'Development', Tag (Initial / Change Request) wajib dipilih.",
        }, { status: 400 });
      }
      const tagCheck = await client.query('SELECT id, code, name FROM tags WHERE id = $1', [tag_id]);
      if (tagCheck.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Tag tidak valid.' }, { status: 400 });
      }
      tag = tagCheck.rows[0];
    } else if (category.code === 'MAINTENANCE') {
      if (tag_id) {
        return NextResponse.json({
          success: false,
          error: "Tag HANYA berlaku untuk kategori Development. Kategori Maintenance tidak boleh memiliki Tag.",
        }, { status: 400 });
      }
    }

    // Fetch master role rates for snapshot
    const roleRows = await client.query('SELECT code, default_hourly_rate FROM role_masters');
    const dbRates: Record<string, number> = {};
    for (const r of roleRows.rows) {
      dbRates[r.code] = Number(r.default_hourly_rate);
    }

    const effectiveRates: RoleRateMap = {
      ...DEFAULT_ROLE_RATES,
      ...dbRates,
      ...(custom_rates || {}),
    };

    // Calculate estimate breakdown
    const parsedModules: ModuleInput[] = Array.isArray(modules) ? modules : [];
    const calculated = calculateEstimate({
      title: title.trim(),
      serviceTypeCode: serviceType.code,
      categoryCode: category.code,
      tagCode: tag ? tag.code : null,
      rates: effectiveRates,
      modules: parsedModules,
    });

    // Save in transaction
    await client.query('BEGIN');

    const estInsert = await client.query(
      `INSERT INTO project_estimates 
        (title, company_id, service_type_id, category_id, tag_id, status, rate_snapshots, total_hours, total_cost, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, title, total_hours, total_cost, status, created_at`,
      [
        calculated.title,
        company_id,
        service_type_id,
        category_id,
        tag ? tag.id : null,
        'DRAFT',
        JSON.stringify(effectiveRates),
        calculated.total_hours,
        calculated.total_cost,
        notes?.trim() || null,
      ]
    );

    const estimateId = estInsert.rows[0].id;

    for (let mIdx = 0; mIdx < calculated.modules.length; mIdx++) {
      const mod = calculated.modules[mIdx];
      const modInsert = await client.query(
        `INSERT INTO estimate_modules (estimate_id, name, order_index, total_hours, total_cost)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [estimateId, mod.name, mIdx + 1, mod.total_hours, mod.total_cost]
      );
      const moduleId = modInsert.rows[0].id;

      for (let tIdx = 0; tIdx < mod.tasks.length; tIdx++) {
        const task = mod.tasks[tIdx];
        await client.query(
          `INSERT INTO estimate_tasks 
            (module_id, name, order_index, hours_pm, hours_web_dev, hours_ui_ux, hours_qc_doc, hours_dev_ops, total_hours, total_cost, role_hours)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            moduleId,
            task.name,
            tIdx + 1,
            task.hours_pm,
            task.hours_web_dev,
            task.hours_ui_ux,
            task.hours_qc_doc,
            task.hours_dev_ops,
            task.total_hours,
            task.total_cost,
            JSON.stringify(task.role_hours || {}),
          ]
        );
      }
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      estimate: {
        id: estimateId,
        ...estInsert.rows[0],
        breakdown: calculated,
      },
    }, { status: 201 });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  } finally {
    client.release();
  }
}
