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
        e.project_id,
        p.name as project_name,
        c.id as company_id,
        c.name as company_name,
        st.id as service_type_id,
        st.code as service_type_code,
        st.name as service_type_name,
        COALESCE(cat.id, (SELECT ec.category_id FROM estimate_categories ec WHERE ec.estimate_id = e.id LIMIT 1)) as category_id,
        COALESCE(cat.code, (SELECT c_sub.code FROM estimate_categories ec JOIN categories c_sub ON ec.category_id = c_sub.id WHERE ec.estimate_id = e.id LIMIT 1)) as category_code,
        COALESCE(cat.name, (SELECT c_sub.name FROM estimate_categories ec JOIN categories c_sub ON ec.category_id = c_sub.id WHERE ec.estimate_id = e.id LIMIT 1)) as category_name,
        t.id as tag_id,
        t.code as tag_code,
        t.name as tag_name,
        (SELECT COUNT(*)::int FROM estimate_modules m WHERE m.estimate_id = e.id) as module_count,
        (SELECT COUNT(*)::int FROM estimate_tasks tk JOIN estimate_modules m ON tk.module_id = m.id WHERE m.estimate_id = e.id) as task_count,
        COALESCE(
          (
            SELECT json_agg(json_build_object('id', c_sub.id, 'code', c_sub.code, 'name', c_sub.name) ORDER BY c_sub.id)
            FROM estimate_categories ec
            JOIN categories c_sub ON ec.category_id = c_sub.id
            WHERE ec.estimate_id = e.id
          ),
          CASE WHEN cat.id IS NOT NULL 
            THEN json_build_array(json_build_object('id', cat.id, 'code', cat.code, 'name', cat.name))
            ELSE '[]'::json
          END
        ) as categories
      FROM project_estimates e
      JOIN companies c ON e.company_id = c.id
      JOIN service_types st ON e.service_type_id = st.id
      LEFT JOIN projects p ON e.project_id = p.id
      LEFT JOIN categories cat ON e.category_id = cat.id
      LEFT JOIN tags t ON e.tag_id = t.id
      ORDER BY e.id DESC
    `);

    const estimates = res.rows.map((row) => {
      const cats = Array.isArray(row.categories) ? row.categories : [];
      return {
        ...row,
        categories: cats,
        category_codes: cats.map((c: { code: string }) => c.code),
      };
    });

    return NextResponse.json({ success: true, estimates });
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
      project_id,
      new_project_name,
      project_name,
      service_type_id,
      category_id,
      category_ids,
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

    // Resolve or create project
    let resolvedProjectId: number | null = null;
    let resolvedProjectName: string | null = null;

    if (project_id && project_id !== 'new') {
      const pId = parseInt(String(project_id), 10);
      if (!isNaN(pId)) {
        const pCheck = await client.query('SELECT id, name, company_id FROM projects WHERE id = $1', [pId]);
        if (pCheck.rows.length > 0) {
          resolvedProjectId = pCheck.rows[0].id;
          resolvedProjectName = pCheck.rows[0].name;
        }
      }
    }

    const onTheFlyName = new_project_name || (!resolvedProjectId && project_name ? project_name : null);
    if (!resolvedProjectId && onTheFlyName && typeof onTheFlyName === 'string' && onTheFlyName.trim()) {
      const pInsert = await client.query(
        'INSERT INTO projects (company_id, name) VALUES ($1, $2) RETURNING id, name',
        [company_id, onTheFlyName.trim()]
      );
      resolvedProjectId = pInsert.rows[0].id;
      resolvedProjectName = pInsert.rows[0].name;
    }

    if (!resolvedProjectId) {
      const pDef = await client.query(
        'SELECT id, name FROM projects WHERE company_id = $1 ORDER BY id ASC LIMIT 1',
        [company_id]
      );
      if (pDef.rows.length > 0) {
        resolvedProjectId = pDef.rows[0].id;
        resolvedProjectName = pDef.rows[0].name;
      } else {
        const pNew = await client.query(
          'INSERT INTO projects (company_id, name, description) VALUES ($1, $2, $3) RETURNING id, name',
          [company_id, 'General Project', 'Auto-created default project']
        );
        resolvedProjectId = pNew.rows[0].id;
        resolvedProjectName = pNew.rows[0].name;
      }
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

    // Resolve category_ids (support multi-category array or legacy single category_id)
    const rawCategoryIds: number[] = Array.isArray(category_ids)
      ? category_ids.map((id: unknown) => parseInt(String(id), 10)).filter((n: number) => !isNaN(n))
      : (category_id ? [parseInt(String(category_id), 10)].filter((n: number) => !isNaN(n)) : []);

    if (rawCategoryIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Minimal 1 kategori proyek wajib dipilih (Development, Maintenance, Infrastructure).',
      }, { status: 400 });
    }

    const catCheck = await client.query(
      'SELECT id, code, name FROM categories WHERE id = ANY($1::int[])',
      [rawCategoryIds]
    );

    if (catCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Kategori tidak valid.' }, { status: 400 });
    }

    const selectedCategories = catCheck.rows;
    const selectedCodes = selectedCategories.map((c) => c.code.toUpperCase());
    const hasDevelopment = selectedCodes.includes('DEVELOPMENT');

    // Verify Tag rules
    let tag = null;
    if (hasDevelopment) {
      if (!tag_id) {
        return NextResponse.json({
          success: false,
          error: "Untuk kategori yang menyertakan 'Development', Tag (Initial / Change Request) wajib dipilih.",
        }, { status: 400 });
      }
      const tagCheck = await client.query('SELECT id, code, name FROM tags WHERE id = $1', [tag_id]);
      if (tagCheck.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Tag tidak valid.' }, { status: 400 });
      }
      tag = tagCheck.rows[0];
    } else {
      if (tag_id) {
        return NextResponse.json({
          success: false,
          error: 'Tag HANYA berlaku jika kategori menyertakan Development. Untuk Maintenance/Infrastructure tanpa Development, Tag tidak boleh diisi.',
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
      categoryCodes: selectedCodes,
      tagCode: tag ? tag.code : null,
      rates: effectiveRates,
      modules: parsedModules,
    });

    // Save in transaction
    await client.query('BEGIN');

    const estInsert = await client.query(
      `INSERT INTO project_estimates 
        (title, company_id, project_id, service_type_id, category_id, tag_id, status, rate_snapshots, total_hours, total_cost, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, title, total_hours, total_cost, status, created_at`,
      [
        calculated.title,
        company_id,
        resolvedProjectId,
        service_type_id,
        rawCategoryIds[0],
        tag ? tag.id : null,
        'DRAFT',
        JSON.stringify(effectiveRates),
        calculated.total_hours,
        calculated.total_cost,
        notes?.trim() || null,
      ]
    );

    const estimateId = estInsert.rows[0].id;

    for (const catId of rawCategoryIds) {
      await client.query(
        'INSERT INTO estimate_categories (estimate_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [estimateId, catId]
      );
    }

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
        project_id: resolvedProjectId,
        project_name: resolvedProjectName,
        categories: selectedCategories,
        category_codes: selectedCodes,
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
