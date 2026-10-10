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

    // Fetch modules & tasks from linked estimate
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

    // Fetch Version History for this proposal chain
    const rootId = proposal.parent_id || proposal.id;
    const historyRes = await pool.query(`
      SELECT 
        cp.id,
        cp.proposal_number,
        cp.version,
        cp.parent_id,
        cp.grand_total,
        cp.margin_percent,
        cp.revision_notes,
        cp.created_at,
        u.name as creator_name
      FROM commercial_proposals cp
      LEFT JOIN users u ON cp.created_by_user_id = u.id
      WHERE cp.id = $1 OR cp.parent_id = $1
      ORDER BY cp.version DESC, cp.id DESC
    `, [rootId]);

    return NextResponse.json({
      success: true,
      proposal,
      modules: modulesRes.rows,
      version_history: historyRes.rows,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PUT(
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

    // 1. Fetch current proposal to determine root parent and proposal number
    const currentRes = await pool.query(
      `SELECT * FROM commercial_proposals WHERE id = $1`,
      [proposalId]
    );

    if (currentRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Proposal tidak ditemukan' }, { status: 404 });
    }

    const currentProposal = currentRes.rows[0];
    const rootId = currentProposal.parent_id || currentProposal.id;

    // 2. Determine highest version in this chain
    const maxVerRes = await pool.query(
      `SELECT COALESCE(MAX(version), 1) as max_version FROM commercial_proposals WHERE id = $1 OR parent_id = $1`,
      [rootId]
    );
    const nextVersion = (parseInt(maxVerRes.rows[0]?.max_version, 10) || 1) + 1;

    // 3. Parse updated payload
    const body = await req.json();
    const {
      company_id,
      project_id,
      estimate_id,
      cogs_amount,
      margin_percent,
      base_price,
      discount_type,
      discount_value,
      subtotal_after_discount,
      is_tax_enabled,
      tax_amount,
      grand_total,
      timeline_config,
      payment_terms,
      validity_days,
      notes,
      revision_notes,
    } = body;

    // 4. Insert NEW record with incremented version and parent_id
    const insertRes = await pool.query(
      `INSERT INTO commercial_proposals (
        proposal_number, version, parent_id, revision_notes,
        company_id, project_id, estimate_id,
        cogs_amount, margin_percent, base_price,
        discount_type, discount_value, subtotal_after_discount,
        is_tax_enabled, tax_amount, grand_total,
        timeline_config, payment_terms, validity_days, notes,
        created_by_user_id, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16,
        $17::jsonb, $18::jsonb, $19, $20,
        $21, NOW(), NOW()
      ) RETURNING id, proposal_number, version, grand_total, created_at`,
      [
        currentProposal.proposal_number,
        nextVersion,
        rootId,
        revision_notes?.trim() || `Revisi versi v${nextVersion}`,
        company_id || currentProposal.company_id,
        project_id || currentProposal.project_id,
        estimate_id || currentProposal.estimate_id,
        Number(cogs_amount) || 0,
        Number(margin_percent) || 0,
        Number(base_price) || 0,
        discount_type || 'PERCENTAGE',
        Number(discount_value) || 0,
        Number(subtotal_after_discount) || 0,
        Boolean(is_tax_enabled),
        Number(tax_amount) || 0,
        Number(grand_total) || 0,
        timeline_config ? JSON.stringify(timeline_config) : null,
        payment_terms ? JSON.stringify(payment_terms) : null,
        Number(validity_days) || 30,
        notes?.trim() || null,
        user.id,
      ]
    );

    return NextResponse.json({
      success: true,
      message: `Berhasil membuat revisi versi v${nextVersion}`,
      proposal: insertRes.rows[0],
    }, { status: 201 });
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
