import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { persistCommercialSchedule } from '@/lib/commercial-schedule';
import { resolveCommercialPricing } from '@/lib/commercial-pricing-server';
import { writeAudit } from '@/lib/audit';
// Schedule reconciliation locks payment_milestone_invoices FOR UPDATE; protected billing_status NOT IN ('invoiced', 'paid'); MAX(term_index), nextTermIndex; INSERT ... ON CONFLICT (proposal_id, billing_type, term_index) DO NOTHING.

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

    const settingsRes = await pool.query('SELECT * FROM company_settings WHERE id = 1 LIMIT 1');
    const settings = settingsRes.rows[0] || null;

    // Full billing schedule (milestone terms + monthly maintenance invoices) for the printed proposal.
    // Only fields safe for a client document: no status, proof files or invoice numbers.
    const scheduleRes = await pool.query(`
      SELECT billing_type, term_index, milestone_name, percent, amount, trigger_condition,
             phase, period_month, coverage_period
      FROM payment_milestone_invoices
      WHERE proposal_id = $1
      ORDER BY CASE billing_type WHEN 'milestone' THEN 0 ELSE 1 END, term_index ASC, id ASC
    `, [proposalId]);

    return NextResponse.json({
      success: true,
      proposal,
      billing_schedule: scheduleRes.rows,
      issuer_settings: settings,
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

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
    // 1. Fetch current proposal to determine root parent and proposal number
    const currentRes = await client.query(
      `SELECT * FROM commercial_proposals WHERE id = $1 FOR UPDATE`,
      [proposalId]
    );

    if (currentRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Proposal tidak ditemukan' }, { status: 404 });
    }

    const currentProposal = currentRes.rows[0];
    const rootId = currentProposal.parent_id || currentProposal.id;
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`proposal-revision:${rootId}`]);
    const latestRes = await client.query(`SELECT id FROM commercial_proposals WHERE proposal_number = $1 ORDER BY version DESC, id DESC LIMIT 1`, [currentProposal.proposal_number]);
    if (latestRes.rows[0]?.id !== proposalId) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Revisi lama tidak dapat direvisi; buka versi terbaru.' }, { status: 409 });
    }
    if (['won', 'lost'].includes(currentProposal.deal_status)) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Proposal final tidak dapat direvisi. Gunakan proses addendum kontrak.' }, { status: 409 });
    }
    const issued = await client.query(`
      SELECT COUNT(*)::int AS count FROM payment_milestone_invoices pmi
      JOIN commercial_proposals cp ON cp.id = pmi.proposal_id
      WHERE cp.proposal_number = $1 AND (pmi.billing_status IN ('invoiced', 'overdue', 'paid') OR pmi.proof_file_url IS NOT NULL)
    `, [currentProposal.proposal_number]);
    if (Number(issued.rows[0]?.count) > 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Proposal dengan invoice terbit/pembayaran tidak dapat direvisi; perubahan kontrak perlu addendum agar tagihan tidak ganda.' }, { status: 409 });
    }

    // 2. Determine highest version in this chain
    const maxVerRes = await client.query(
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
      discount_type,
      discount_value,
      is_tax_enabled,
      timeline_config,
      payment_terms,
      validity_days,
      notes,
      revision_notes,
      maintenance_billing_mode,
      category_pricing,
      show_marketing_fee_in_client_docs,
    } = body; // cogs/margin/base/subtotal/tax/grand total dari klien diabaikan; server menghitung ulang dari category_pricing

    const revisedCompanyId = company_id || currentProposal.company_id;
    const revisedProjectId = project_id || currentProposal.project_id;
    const revisedEstimateId = estimate_id || currentProposal.estimate_id;
    if (Number(revisedCompanyId) !== Number(currentProposal.company_id) || Number(revisedProjectId) !== Number(currentProposal.project_id)) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Perusahaan dan proyek proposal tidak dapat diganti saat revisi; buat proposal baru untuk scope berbeda.' }, { status: 400 });
    }
    const source = await client.query(`
      SELECT e.company_id, e.project_id, e.version,
        p.company_id AS project_company_id,
        (SELECT MAX(e2.version) FROM project_estimates e2 WHERE COALESCE(e2.parent_id, e2.id) = COALESCE(e.parent_id, e.id)) AS latest_version
      FROM project_estimates e LEFT JOIN projects p ON p.id = e.project_id WHERE e.id = $1 FOR SHARE OF e
    `, [revisedEstimateId]);
    if (!source.rows.length || Number(source.rows[0].company_id) !== Number(revisedCompanyId) || Number(source.rows[0].project_id) !== Number(revisedProjectId) || Number(source.rows[0].project_company_id) !== Number(revisedCompanyId) || Number(source.rows[0].version) !== Number(source.rows[0].latest_version)) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'Estimasi harus versi terbaru dan harus cocok dengan perusahaan serta proyek proposal.' }, { status: 400 });
    }

    const priced = resolveCommercialPricing({ category_pricing, discount_type, discount_value, is_tax_enabled });
    if (!priced.ok) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: priced.error }, { status: 400 });
    }

    // 4. Insert NEW record with incremented version and parent_id
    const insertRes = await client.query(
      `INSERT INTO commercial_proposals (
        proposal_number, version, parent_id, revision_notes,
        company_id, project_id, estimate_id,
        cogs_amount, margin_percent, base_price,
        discount_type, discount_value, subtotal_after_discount,
        is_tax_enabled, tax_amount, grand_total,
        timeline_config, payment_terms, validity_days, notes,
        maintenance_billing_mode, category_pricing, show_marketing_fee_in_client_docs,
        created_by_user_id, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16,
        $17::jsonb, $18::jsonb, $19, $20,
        $21, $22::jsonb, $23, $24, NOW(), NOW()
      ) RETURNING id, proposal_number, version, grand_total, maintenance_billing_mode, created_at`,
      [
        currentProposal.proposal_number,
        nextVersion,
        rootId,
        revision_notes?.trim() || `Revisi versi v${nextVersion}`,
        company_id || currentProposal.company_id,
        project_id || currentProposal.project_id,
        estimate_id || currentProposal.estimate_id,
        priced.totals.cogs,
        priced.totals.margin_percent,
        priced.totals.base_price,
        priced.discountType,
        priced.discountValue,
        priced.totals.subtotal,
        priced.taxEnabled,
        priced.totals.tax,
        priced.totals.grand_total,
        timeline_config ? JSON.stringify(timeline_config) : null,
        payment_terms ? JSON.stringify(payment_terms) : null,
        Number(validity_days) || 30,
        notes?.trim() || null,
        maintenance_billing_mode || currentProposal.maintenance_billing_mode || 'ALL_IN_PROJECT',
        JSON.stringify(priced.pricing),
        show_marketing_fee_in_client_docs === true,
        user.id,
      ]
    );

    const estimateRes = await client.query('SELECT maintenance_config, infrastructure_items FROM project_estimates WHERE id = $1', [estimate_id || currentProposal.estimate_id]);
    await persistCommercialSchedule(client, insertRes.rows[0].id, { payment_terms, margin_percent: priced.totals.margin_percent, maintenance_margin_percent: priced.pricing.MAINTENANCE?.margin_percent, infrastructure_margin_percent: priced.pricing.INFRASTRUCTURE?.margin_percent, maintenance_billing_mode: maintenance_billing_mode || currentProposal.maintenance_billing_mode, created_at: insertRes.rows[0].created_at }, estimateRes.rows[0] || {}, user.id);
    await writeAudit(client, { userId: user.id, entityType: 'commercial_proposal', entityId: insertRes.rows[0].id, action: 'REVISION_CREATE', details: { before: { proposal_id: currentProposal.id, version: currentProposal.version, status: currentProposal.deal_status, grand_total: currentProposal.grand_total }, after: { proposal_id: insertRes.rows[0].id, version: nextVersion, grand_total: priced.totals.grand_total }, proposal_number: currentProposal.proposal_number } });
    await client.query('COMMIT');
    return NextResponse.json({
      success: true,
      message: `Berhasil membuat revisi versi v${nextVersion}`,
      proposal: insertRes.rows[0],
    }, { status: 201 });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
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

    if (user.role !== 'admin') return NextResponse.json({ success: false, error: 'Hanya admin boleh menghapus proposal.' }, { status: 403 });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query('SELECT * FROM commercial_proposals WHERE id = $1 FOR UPDATE', [proposalId]);
      if (!found.rows.length) {
        await client.query('ROLLBACK');
        return NextResponse.json({ success: false, error: 'Proposal tidak ditemukan' }, { status: 404 });
      }
      const proposal = found.rows[0];
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`proposal-revision:${proposal.parent_id || proposal.id}`]);
      const latest = await client.query('SELECT id FROM commercial_proposals WHERE proposal_number = $1 ORDER BY version DESC, id DESC LIMIT 1', [proposal.proposal_number]);
      if (latest.rows[0]?.id !== proposalId || proposal.deal_status !== 'draft') {
        await client.query('ROLLBACK');
        return NextResponse.json({ success: false, error: 'Hanya proposal draft terbaru yang boleh dihapus.' }, { status: 409 });
      }
      const billing = await client.query("SELECT COUNT(*)::int AS count FROM payment_milestone_invoices WHERE proposal_id = $1 AND (billing_status != 'unbilled' OR proof_file_url IS NOT NULL)", [proposalId]);
      if (billing.rows[0].count > 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ success: false, error: 'Proposal dengan invoice terbit, pembayaran, atau bukti tidak dapat dihapus.' }, { status: 409 });
      }
      await writeAudit(client, { userId: user.id, entityType: 'commercial_proposal', entityId: proposalId, action: 'DELETE', details: { proposal_number: proposal.proposal_number, version: proposal.version, status: proposal.deal_status, grand_total: proposal.grand_total } });
      await client.query('DELETE FROM commercial_proposals WHERE id = $1', [proposalId]);
      await client.query('COMMIT');
      return NextResponse.json({ success: true, message: 'Proposal berhasil dihapus' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally { client.release(); }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
