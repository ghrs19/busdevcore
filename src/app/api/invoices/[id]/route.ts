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
    const invoiceId = parseInt(id, 10);
    if (isNaN(invoiceId)) {
      return NextResponse.json({ success: false, error: 'ID invoice tidak valid' }, { status: 400 });
    }

    const query = `
      SELECT 
        pmi.*,
        cp.proposal_number,
        cp.version as proposal_version,
        cp.is_tax_enabled,
        cp.tax_amount as proposal_tax_amount,
        cp.grand_total as proposal_grand_total,
        cp.maintenance_billing_mode,
        c.name as company_name,
        c.email as company_email,
        c.phone as company_phone,
        c.address as company_address,
        p.name as project_name,
        pe.title as estimate_title,
        u.name as updated_by_name
      FROM payment_milestone_invoices pmi
      JOIN commercial_proposals cp ON pmi.proposal_id = cp.id
      JOIN companies c ON cp.company_id = c.id
      JOIN projects p ON cp.project_id = p.id
      JOIN project_estimates pe ON cp.estimate_id = pe.id
      LEFT JOIN users u ON pmi.updated_by_user_id = u.id
      WHERE pmi.id = $1
    `;

    const res = await pool.query(query, [invoiceId]);
    if (res.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Invoice tidak ditemukan' }, { status: 404 });
    }

    // Ambil sibling milestones dari proposal yang sama untuk konteks progress pembayaran
    const siblingsRes = await pool.query(`
      SELECT id, term_index, billing_type, milestone_name, percent, amount, billing_status, invoice_number, due_date, paid_date
      FROM payment_milestone_invoices
      WHERE proposal_id = $1
      ORDER BY 
        CASE WHEN billing_type = 'milestone' THEN 1 ELSE 2 END ASC,
        term_index ASC
    `, [res.rows[0].proposal_id]);

    return NextResponse.json({
      success: true,
      invoice: res.rows[0],
      sibling_milestones: siblingsRes.rows,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
