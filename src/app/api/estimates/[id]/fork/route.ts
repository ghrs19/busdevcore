import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await pool.connect();
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const sourceId = parseInt(id, 10);
    if (isNaN(sourceId)) {
      return NextResponse.json({ success: false, error: 'ID estimate sumber tidak valid' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const revisionNotes = body.revision_notes || body.notes || 'Fork / revisi baru';

    await client.query('BEGIN');

    // 1. Fetch source estimate
    const sourceRes = await client.query(
      `SELECT * FROM project_estimates WHERE id = $1 FOR UPDATE`,
      [sourceId]
    );

    if (sourceRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Estimate sumber tidak ditemukan' }, { status: 404 });
    }

    const source = sourceRes.rows[0];
    const rootParentId = source.parent_id ? source.parent_id : source.id;

    const maxVerRes = await client.query(
      `SELECT COALESCE(MAX(version), 1) as max_v FROM project_estimates WHERE id = $1 OR parent_id = $1`,
      [rootParentId]
    );
    const nextVersion = Number(maxVerRes.rows[0].max_v) + 1;

    const newTitle = source.title ? `${source.title} (Rev v${nextVersion})` : `Revisi v${nextVersion}`;

    // Clean serialization helper
    const toPgJson = (val: any) => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'string') {
        try {
          JSON.parse(val);
          return val;
        } catch {
          return JSON.stringify(val);
        }
      }
      return JSON.stringify(val);
    };

    let newEstimateId: number;
    try {
      const insertEstRes = await client.query(`
        INSERT INTO project_estimates (
          title, company_id, project_id, service_type_id, category_id, tag_id,
          status, rate_snapshots, total_hours, total_cost, notes,
          maintenance_config, infrastructure_items, operational_items, billing_summary,
          parent_id, version, revision_notes, created_by_user_id, updated_by_user_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          'DRAFT', $7::jsonb, $8, $9, $10,
          $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb,
          $15, $16, $17, $18, $18
        ) RETURNING id, version
      `, [
        newTitle,
        source.company_id,
        source.project_id,
        source.service_type_id,
        source.category_id,
        source.tag_id,
        toPgJson(source.rate_snapshots),
        source.total_hours,
        source.total_cost,
        source.notes,
        toPgJson(source.maintenance_config),
        toPgJson(source.infrastructure_items),
        toPgJson(source.operational_items),
        toPgJson(source.billing_summary),
        rootParentId,
        nextVersion,
        revisionNotes,
        user.id
      ]);
      newEstimateId = insertEstRes.rows[0].id;
    } catch (e: any) {
      console.error('ERROR ON INSERT ESTIMATE:', e);
      throw new Error(`Insert estimate failed: ${e.message}`);
    }

    // 3. Clone categories
    await client.query(`
      INSERT INTO estimate_categories (estimate_id, category_id)
      SELECT $1, category_id
      FROM estimate_categories
      WHERE estimate_id = $2
    `, [newEstimateId, sourceId]);

    // 4. Clone modules & tasks
    const sourceModules = await client.query(`
      SELECT id, name, order_index, total_hours, total_cost
      FROM estimate_modules
      WHERE estimate_id = $1
      ORDER BY order_index ASC
    `, [sourceId]);

    for (const mod of sourceModules.rows) {
      const insModRes = await client.query(`
        INSERT INTO estimate_modules (estimate_id, name, order_index, total_hours, total_cost)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [newEstimateId, mod.name, mod.order_index, mod.total_hours, mod.total_cost]);

      const newModId = insModRes.rows[0].id;

      try {
        await client.query(`
          INSERT INTO estimate_tasks (
            module_id, name, order_index,
            hours_pm, hours_web_dev, hours_ui_ux, hours_qc_doc, hours_dev_ops,
            total_hours, total_cost, role_hours
          )
          SELECT 
            $1, name, order_index,
            hours_pm, hours_web_dev, hours_ui_ux, hours_qc_doc, hours_dev_ops,
            total_hours, total_cost, role_hours
          FROM estimate_tasks
          WHERE module_id = $2
          ORDER BY order_index ASC
        `, [newModId, mod.id]);
      } catch (te: any) {
        console.error('ERROR ON CLONE TASKS:', te);
        throw new Error(`Clone tasks failed: ${te.message}`);
      }
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: `Estimate v${nextVersion} berhasil di-fork/buat revisi`,
      new_estimate_id: newEstimateId,
      version: nextVersion,
      parent_id: rootParentId,
    });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    const msg = err instanceof Error ? err.message : 'Unknown database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  } finally {
    client.release();
  }
}
