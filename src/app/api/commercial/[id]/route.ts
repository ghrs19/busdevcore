import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const proposalId = parseInt(id, 10);
    if (isNaN(proposalId)) {
      return NextResponse.json({ success: false, error: 'ID proposal tidak valid' }, { status: 400 });
    }

    // Query proposal with details
    const propRes = await pool.query(`
      SELECT 
        cp.*,
        c.name as company_name,
        c.email as company_email,
        c.phone as company_phone,
        c.address as company_address,
        p.name as project_name,
        p.description as project_description,
        pe.title as estimate_title,
        pe.version as estimate_version,
        pe.total_hours as estimate_total_hours,
        pe.maintenance_config as estimate_maintenance_config,
        pe.infrastructure_items as estimate_infrastructure_items,
        pe.operational_items as estimate_operational_items,
        pe.billing_summary as estimate_billing_summary,
        u.name as creator_name,
        u.email as creator_email
      FROM commercial_proposals cp
      JOIN companies c ON cp.company_id = c.id
      JOIN projects p ON cp.project_id = p.id
      JOIN project_estimates pe ON cp.estimate_id = pe.id
      LEFT JOIN users u ON cp.created_by_user_id = u.id
      WHERE cp.id = $1
    `, [proposalId]);

    if (propRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Proposal tidak ditemukan' }, { status: 404 });
    }

    const proposal = propRes.rows[0];

    // Fetch modules & tasks from linked estimate (only names, no role hours or rates, client-ready)
    const modulesRes = await pool.query(`
      SELECT 
        m.id,
        m.name,
        m.order_index,
        json_agg(
          json_build_object(
            'id', t.id,
            'name', t.name,
            'order_index', t.order_index
          ) ORDER BY t.order_index ASC, t.id ASC
        ) as tasks
      FROM estimate_modules m
      LEFT JOIN estimate_tasks t ON t.module_id = m.id
      WHERE m.estimate_id = $1
      GROUP BY m.id, m.name, m.order_index
      ORDER BY m.order_index ASC, m.id ASC
    `, [proposal.estimate_id]);

    return NextResponse.json({
      success: true,
      proposal,
      modules: modulesRes.rows,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const proposalId = parseInt(id, 10);
    if (isNaN(proposalId)) {
      return NextResponse.json({ success: false, error: 'ID proposal tidak valid' }, { status: 400 });
    }

    const delRes = await pool.query('DELETE FROM commercial_proposals WHERE id = $1', [proposalId]);
    if (delRes.rowCount === 0) {
      return NextResponse.json({ success: false, error: 'Proposal tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Proposal berhasil dihapus' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
