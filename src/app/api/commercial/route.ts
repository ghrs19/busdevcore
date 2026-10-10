import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const query = `
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
    } = body;

    if (!company_id || !project_id || !estimate_id) {
      return NextResponse.json(
        { success: false, error: 'Perusahaan, Proyek, dan Estimasi wajib dipilih.' },
        { status: 400 }
      );
    }

    // Generate Proposal Number: QUO/YYYY/MM/XXXX
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    const countRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM commercial_proposals 
       WHERE proposal_number LIKE $1`,
      [`QUO/${year}/${month}/%`]
    );
    const nextSeq = String((countRes.rows[0]?.count || 0) + 1).padStart(4, '0');
    const proposal_number = `QUO/${year}/${month}/${nextSeq}`;

    const insertRes = await pool.query(
      `INSERT INTO commercial_proposals (
        proposal_number, company_id, project_id, estimate_id,
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
        $14::jsonb, $15::jsonb, $16, $17,
        $18, NOW(), NOW()
      ) RETURNING id, proposal_number, grand_total, created_at`,
      [
        proposal_number,
        company_id,
        project_id,
        estimate_id,
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
      proposal: insertRes.rows[0],
    }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
