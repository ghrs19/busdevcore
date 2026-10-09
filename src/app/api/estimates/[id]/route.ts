import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { normalizeRoleSnapshot } from '@/lib/costing';

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
        rate_snapshots: normalizeRoleSnapshot(estimate.rate_snapshots),
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

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await pool.connect();
  try {
    const { id } = await params;
    const estimateId = parseInt(id, 10);
    if (isNaN(estimateId)) {
      return NextResponse.json({ success: false, error: 'ID estimate tidak valid' }, { status: 400 });
    }

    const body = await req.json();
    const {
      title,
      notes,
      revision_notes,
      status,
      modules = [],
      maintenance_tasks = [],
      maintenance_duration_months = 12,
      infrastructure_items = [],
      operational_items = [],
      categories: rawCategoryIds,
      category_ids,
      category_id,
      tag_id,
      custom_rates,
    } = body;

    await client.query('BEGIN');

    // 1. Verify estimate exists
    const checkRes = await client.query('SELECT * FROM project_estimates WHERE id = $1 FOR UPDATE', [estimateId]);
    if (checkRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Estimate tidak ditemukan' }, { status: 404 });
    }
    const currentEst = checkRes.rows[0];

    // Use current rates or normalize custom_rates
    let effectiveRates = currentEst.rate_snapshots;
    if (typeof effectiveRates === 'string') {
      try { effectiveRates = JSON.parse(effectiveRates); } catch { /* ignore */ }
    }
    const calcRates: Record<string, number> = {};
    if (effectiveRates && typeof effectiveRates === 'object') {
      for (const [k, v] of Object.entries(effectiveRates)) {
        if (typeof v === 'object' && v !== null && 'rate' in v) {
          calcRates[k] = Number((v as { rate: number }).rate) || 0;
        } else {
          calcRates[k] = Number(v) || 0;
        }
      }
    }
    if (custom_rates && typeof custom_rates === 'object') {
      for (const [k, v] of Object.entries(custom_rates)) {
        calcRates[k] = Number(v) || 0;
      }
    }

    // Dynamic import costing logic
    const {
      calculateModule,
      calculateMaintenance,
      calculateInfrastructure,
      calculateOperational,
      calculateBillingSummary,
    } = await import('@/lib/costing');

    // 2. Recalculate modules
    let calculatedDevModules: any[] = [];
    let totalDevHours = 0;
    let totalDevCost = 0;
    if (Array.isArray(modules) && modules.length > 0) {
      calculatedDevModules = modules.map((m: any, idx: number) => calculateModule(m, calcRates));
      totalDevHours = calculatedDevModules.reduce((acc, m) => acc + m.total_hours, 0);
      totalDevCost = calculatedDevModules.reduce((acc, m) => acc + m.total_cost, 0);
    }

    // 3. Recalculate maintenance
    let maintenanceConfigData = null;
    let totalMaintenanceCost = 0;
    let totalMaintenanceHours = 0;
    if (Array.isArray(maintenance_tasks) && maintenance_tasks.length > 0) {
      const maintResult = calculateMaintenance({
        duration_months: Number(maintenance_duration_months) || 12,
        tasks: maintenance_tasks,
      }, calcRates);
      maintenanceConfigData = maintResult;
      totalMaintenanceCost = maintResult.total_cost;
      totalMaintenanceHours = maintResult.total_monthly_hours * maintResult.duration_months;
    }

    // 4. Recalculate infrastructure
    let infraItemsData = null;
    if (Array.isArray(infrastructure_items) && infrastructure_items.length > 0) {
      infraItemsData = calculateInfrastructure(infrastructure_items);
    }

    // 5. Recalculate operational
    let opItemsData = null;
    if (Array.isArray(operational_items) && operational_items.length > 0) {
      opItemsData = calculateOperational(operational_items);
    }

    // 6. Billing summary
    const billingSummary = calculateBillingSummary({
      hasDevelopment: calculatedDevModules.length > 0,
      hasMaintenance: maintenanceConfigData !== null,
      hasInfrastructure: infraItemsData !== null,
      hasOperational: opItemsData !== null,
      devCost: totalDevCost,
      maintenanceConfig: maintenanceConfigData,
      infrastructure: infraItemsData,
      operational: opItemsData,
    });

    const grandTotalHours = totalDevHours + totalMaintenanceHours;
    const grandTotalCost = billingSummary.grand_total;

    // 7. Check if this save creates a new revision version or updates current
    // Determine root parent & increment version
    const rootParentId = currentEst.parent_id ? currentEst.parent_id : currentEst.id;
    const currentVersion = Number(currentEst.version) || 1;
    const nextVersion = currentVersion + 1;

    let targetEstimateId = estimateId;

    if (body.create_revision_on_save !== false) {
      // Create a NEW record for the new version so baseline remains intact in history
      const baseTitle = (currentEst.title || 'Project Estimate').replace(/\s*\(Rev v\d+\)+/gi, '').trim();
      const newTitle = `${baseTitle} (Rev v${nextVersion})`;

      const insertRes = await client.query(`
        INSERT INTO project_estimates (
          title, company_id, project_id, service_type_id, category_id, tag_id,
          status, rate_snapshots, total_hours, total_cost, notes,
          maintenance_config, infrastructure_items, operational_items, billing_summary,
          parent_id, version, revision_notes, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          'DRAFT', $7::jsonb, $8, $9, $10,
          $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb,
          $15, $16, $17, NOW(), NOW()
        ) RETURNING id
      `, [
        title || newTitle,
        currentEst.company_id,
        currentEst.project_id,
        currentEst.service_type_id,
        currentEst.category_id,
        tag_id || currentEst.tag_id,
        JSON.stringify(currentEst.rate_snapshots),
        grandTotalHours,
        grandTotalCost,
        notes || currentEst.notes,
        maintenanceConfigData ? JSON.stringify(maintenanceConfigData) : null,
        infraItemsData ? JSON.stringify(infraItemsData.items) : null,
        opItemsData ? JSON.stringify(opItemsData.items) : null,
        JSON.stringify(billingSummary),
        rootParentId,
        nextVersion,
        revision_notes || `Revisi versi v${nextVersion}`
      ]);

      targetEstimateId = insertRes.rows[0].id;
    } else {
      // Overwrite current record
      await client.query(`
        UPDATE project_estimates
        SET 
          title = COALESCE($1, title),
          notes = $2,
          revision_notes = COALESCE($3, revision_notes),
          status = COALESCE($4, status),
          total_hours = $5,
          total_cost = $6,
          maintenance_config = $7::jsonb,
          infrastructure_items = $8::jsonb,
          operational_items = $9::jsonb,
          billing_summary = $10::jsonb,
          tag_id = $11,
          updated_at = NOW()
        WHERE id = $12
      `, [
        title || null,
        notes || null,
        revision_notes || null,
        status || null,
        grandTotalHours,
        grandTotalCost,
        maintenanceConfigData ? JSON.stringify(maintenanceConfigData) : null,
        infraItemsData ? JSON.stringify(infraItemsData.items) : null,
        opItemsData ? JSON.stringify(opItemsData.items) : null,
        JSON.stringify(billingSummary),
        tag_id || null,
        estimateId,
      ]);
    }

    // 8. Update categories if provided
    const catList = rawCategoryIds || category_ids || (category_id ? [category_id] : null);
    if (Array.isArray(catList) && catList.length > 0) {
      await client.query('DELETE FROM estimate_categories WHERE estimate_id = $1', [targetEstimateId]);
      for (const cId of catList) {
        const parsedCId = parseInt(String(cId), 10);
        if (!isNaN(parsedCId)) {
          await client.query(
            'INSERT INTO estimate_categories (estimate_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [targetEstimateId, parsedCId]
          );
        }
      }
    }

    // 9. Re-insert modules & tasks if modules provided
    if (Array.isArray(modules)) {
      await client.query('DELETE FROM estimate_modules WHERE estimate_id = $1', [targetEstimateId]);
      for (const mod of calculatedDevModules) {
        const modRes = await client.query(`
          INSERT INTO estimate_modules (estimate_id, name, order_index, total_hours, total_cost)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, [targetEstimateId, mod.name, mod.order_index, mod.total_hours, mod.total_cost]);

        const modId = modRes.rows[0].id;
        for (const task of mod.tasks) {
          await client.query(`
            INSERT INTO estimate_tasks (
              module_id, name, order_index,
              hours_pm, hours_web_dev, hours_ui_ux, hours_qc_doc, hours_dev_ops,
              total_hours, total_cost, role_hours
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [
            modId,
            task.name,
            task.order_index,
            task.hours_pm || 0,
            task.hours_web_dev || 0,
            task.hours_ui_ux || 0,
            task.hours_qc_doc || 0,
            task.hours_dev_ops || 0,
            task.total_hours || 0,
            task.total_cost || 0,
            JSON.stringify(task.role_hours || {}),
          ]);
        }
      }
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: `Estimasi revisi v${nextVersion} (#${targetEstimateId}) berhasil disimpan`,
      estimate_id: targetEstimateId,
      version: nextVersion,
      parent_id: rootParentId,
      total_cost: grandTotalCost,
      total_hours: grandTotalHours,
    });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    const msg = err instanceof Error ? err.message : 'Unknown database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  } finally {
    client.release();
  }
}
