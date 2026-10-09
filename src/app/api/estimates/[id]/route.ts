import { NextResponse } from 'next/server';
import pool from '@/lib/db';

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

    const estRes = await pool.query(`
      SELECT 
        e.*,
        p.name as project_name,
        c.name as company_name,
        c.email as company_email,
        st.code as service_type_code,
        st.name as service_type_name,
        COALESCE(cat.code, (SELECT c_sub.code FROM estimate_categories ec JOIN categories c_sub ON ec.category_id = c_sub.id WHERE ec.estimate_id = e.id LIMIT 1)) as category_code,
        COALESCE(cat.name, (SELECT c_sub.name FROM estimate_categories ec JOIN categories c_sub ON ec.category_id = c_sub.id WHERE ec.estimate_id = e.id LIMIT 1)) as category_name,
        t.code as tag_code,
        t.name as tag_name,
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
      WHERE e.id = $1
    `, [estimateId]);

    if (estRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Estimate tidak ditemukan' }, { status: 404 });
    }

    const estimate = estRes.rows[0];
    const categories = Array.isArray(estimate.categories) ? estimate.categories : [];
    const category_codes = categories.map((c: { code: string }) => c.code);

    // Fetch modules and tasks
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

      modules.push({
        ...mod,
        tasks: taskRes.rows,
      });
    }

    return NextResponse.json({
      success: true,
      estimate: {
        ...estimate,
        categories,
        category_codes,
        modules,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const estimateId = parseInt(id, 10);
    if (isNaN(estimateId)) {
      return NextResponse.json({ success: false, error: 'ID estimate tidak valid' }, { status: 400 });
    }

    const checkRes = await pool.query(
      'SELECT id, title FROM project_estimates WHERE id = $1',
      [estimateId]
    );

    if (checkRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Estimate tidak ditemukan' }, { status: 404 });
    }

    await pool.query('DELETE FROM project_estimates WHERE id = $1', [estimateId]);

    return NextResponse.json({
      success: true,
      message: `Estimate #${estimateId} berhasil dihapus`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
