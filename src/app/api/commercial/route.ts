import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { persistCommercialSchedule } from '@/lib/commercial-schedule';
import { resolveCommercialPricing } from '@/lib/commercial-pricing-server';
import { writeAudit } from '@/lib/audit';
// Schedule reconciliation in persistCommercialSchedule: payment_milestone_invoices, FOR UPDATE,
// billing_status NOT IN ('invoiced', 'paid'), MAX(term_index), nextTermIndex,
// INSERT ... ON CONFLICT (proposal_id, billing_type, term_index) DO NOTHING.

export async function GET(req: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const showAll = searchParams.get('all') === 'true';

    let query = '';
    if (showAll) {
      query = `
        SELECT 
          cp.*,
          c.name as company_name,
          p.name as project_name,
          pe.title as estimate_title,
          pe.version as estimate_version,
          u.name as creator_name,
          u.email as creator_email
        FROM commercial_proposals cp
        JOIN companies c ON cp.company_id = c.id
        JOIN projects p ON cp.project_id = p.id
        JOIN project_estimates pe ON cp.estimate_id = pe.id
        LEFT JOIN users u ON cp.created_by_user_id = u.id
        ORDER BY cp.id DESC
      `;
    } else {
      // Hanya menampilkan versi terakhir dari masing-masing proposal_number
      query = `
        SELECT 
          cp.*,
          c.name as company_name,
          p.name as project_name,
          pe.title as estimate_title,
          pe.version as estimate_version,
          u.name as creator_name,
          u.email as creator_email
        FROM commercial_proposals cp
        JOIN companies c ON cp.company_id = c.id
        JOIN projects p ON cp.project_id = p.id
        JOIN project_estimates pe ON cp.estimate_id = pe.id
        LEFT JOIN users u ON cp.created_by_user_id = u.id
        WHERE cp.version = (
          SELECT MAX(cp2.version)
          FROM commercial_proposals cp2
          WHERE cp2.proposal_number = cp.proposal_number
        )
        ORDER BY cp.id DESC
      `;
    }

    const res = await pool.query(query);
    return NextResponse.json({ success: true, proposals: res.rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      maintenance_billing_mode,
      category_pricing,
      show_marketing_fee_in_client_docs,
    } = body; // cogs/margin/base/subtotal/tax/grand total dari klien diabaikan; server menghitung ulang dari category_pricing

    if (!company_id || !project_id || !estimate_id) {
      return NextResponse.json(
        { success: false, error: 'Perusahaan, Proyek, dan Estimasi wajib dipilih.' },
        { status: 400 }
      );
    }

    const priced = resolveCommercialPricing({ category_pricing, discount_type, discount_value, is_tax_enabled });
    if (!priced.ok) {
      return NextResponse.json({ success: false, error: priced.error }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const source = await client.query(`
        SELECT e.id, e.company_id, e.project_id, e.parent_id, e.version,
          p.company_id AS project_company_id,
          (SELECT MAX(e2.version) FROM project_estimates e2 WHERE COALESCE(e2.parent_id, e2.id) = COALESCE(e.parent_id, e.id)) AS latest_version
        FROM project_estimates e LEFT JOIN projects p ON p.id = e.project_id
        WHERE e.id = $1 FOR SHARE OF e
      `, [estimate_id]);
      if (!source.rows.length || Number(source.rows[0].company_id) !== Number(company_id) || Number(source.rows[0].project_id) !== Number(project_id) || Number(source.rows[0].project_company_id) !== Number(company_id) || Number(source.rows[0].version) !== Number(source.rows[0].latest_version)) {
        await client.query('ROLLBACK');
        return NextResponse.json({ success: false, error: 'Estimasi harus versi terbaru dan harus cocok dengan perusahaan serta proyek yang dipilih.' }, { status: 400 });
      }
    // Generate Proposal Number: QUO/YYYY/MM/XXXX
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`proposal-number:${year}-${month}`]);

    const countRes = await client.query(
      `SELECT COUNT(DISTINCT proposal_number)::int as count FROM commercial_proposals 
       WHERE proposal_number LIKE $1`,
      [`QUO/${year}/${month}/%`]
    );
    const nextSeq = String((countRes.rows[0]?.count || 0) + 1).padStart(4, '0');
    const proposal_number = `QUO/${year}/${month}/${nextSeq}`;

    const insertRes = await client.query(
      `INSERT INTO commercial_proposals (
        proposal_number, version, company_id, project_id, estimate_id,
        cogs_amount, margin_percent, base_price,
        discount_type, discount_value, subtotal_after_discount,
        is_tax_enabled, tax_amount, grand_total,
        timeline_config, payment_terms, validity_days, notes,
        maintenance_billing_mode, category_pricing, show_marketing_fee_in_client_docs,
        created_by_user_id, created_at, updated_at
      ) VALUES (
        $1, 1, $2, $3, $4,
        $5, $6, $7,
        $8, $9, $10,
        $11, $12, $13,
        $14::jsonb, $15::jsonb, $16, $17,
        $18, $19::jsonb, $20, $21, NOW(), NOW()
      ) RETURNING id, proposal_number, version, grand_total, maintenance_billing_mode, created_at`,
      [
        proposal_number,
        company_id,
        project_id,
        estimate_id,
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
        maintenance_billing_mode || 'ALL_IN_PROJECT',
        JSON.stringify(priced.pricing),
        show_marketing_fee_in_client_docs === true,
        user.id,
      ]
    );

    const estimateRes = await client.query('SELECT maintenance_config, infrastructure_items FROM project_estimates WHERE id = $1', [estimate_id]);
    await persistCommercialSchedule(client, insertRes.rows[0].id, { payment_terms, margin_percent: priced.totals.margin_percent, maintenance_margin_percent: priced.pricing.MAINTENANCE?.margin_percent, infrastructure_margin_percent: priced.pricing.INFRASTRUCTURE?.margin_percent, maintenance_billing_mode, created_at: insertRes.rows[0].created_at }, estimateRes.rows[0] || {}, user.id);
    await writeAudit(client, { userId: user.id, entityType: 'commercial_proposal', entityId: insertRes.rows[0].id, action: 'CREATE', details: { proposal_number, version: 1, estimate_id, company_id, project_id, grand_total: priced.totals.grand_total } });
    await client.query('COMMIT');
    return NextResponse.json({
      success: true,
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
