import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { uploadFile } from '@/lib/storage';
import { logAudit } from '@/lib/audit';

export async function POST(
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

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'File bukti transfer wajib disertakan' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const objectKey = `payments/inv_${invoiceId}_${Date.now()}_${sanitizedName}`;

    const fileUrl = await uploadFile(objectKey, buffer, file.size, file.type || 'image/jpeg');

    const updateRes = await pool.query(`
      UPDATE payment_milestone_invoices
      SET 
        proof_file_url = $1,
        proof_file_name = $2,
        proof_file_size = $3,
        proof_mime_type = $4,
        updated_by_user_id = $5,
        updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `, [fileUrl, file.name, file.size, file.type || 'image/jpeg', user.id, invoiceId]);

    if (updateRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Invoice tidak ditemukan' }, { status: 404 });
    }

    const updated = updateRes.rows[0];

    await logAudit({
      userId: user.id,
      entityType: 'commercial_proposal',
      entityId: updated.proposal_id,
      action: 'PAYMENT_PROOF_UPLOADED',
      details: {
        invoice_number: updated.invoice_number,
        milestone: updated.milestone_name,
        file_name: file.name,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Bukti transfer berhasil diunggah ke MinIO Object Storage',
      invoice: updated,
      file_url: fileUrl,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Upload error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
