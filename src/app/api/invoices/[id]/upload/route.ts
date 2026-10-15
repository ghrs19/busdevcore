import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { uploadFile } from '@/lib/storage';
import { logAudit } from '@/lib/audit';
import { readBoundedRequest } from '@/lib/bounded-request.mjs';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_REQUEST_SIZE = MAX_FILE_SIZE + 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

function matchesFileSignature(type: string, bytes: Buffer): boolean {
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === 'image/webp') return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (type === 'application/pdf') return bytes.subarray(0, 5).toString('ascii') === '%PDF-';
  return false;
}

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

    const invoiceCheck = await pool.query(`
      SELECT i.id, i.billing_type, i.invoice_date, c.name AS company_name
      FROM payment_milestone_invoices i
      LEFT JOIN commercial_proposals cp ON cp.id = i.proposal_id
      LEFT JOIN companies c ON c.id = cp.company_id
      WHERE i.id = $1
    `, [invoiceId]);
    if (!invoiceCheck.rows.length) {
      return NextResponse.json({ success: false, error: 'Invoice tidak ditemukan' }, { status: 404 });
    }

    const boundedRequest = await readBoundedRequest(req, MAX_REQUEST_SIZE);
    if (!boundedRequest) return NextResponse.json({ success: false, error: 'Request too large' }, { status: 413 });
    const formData = await boundedRequest.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'File bukti transfer wajib disertakan' }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'Ukuran file harus 1 byte hingga 10 MB' }, { status: 413 });
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ success: false, error: 'Tipe file tidak didukung' }, { status: 415 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!matchesFileSignature(file.type, buffer)) {
      return NextResponse.json({ success: false, error: 'File content does not match type' }, { status: 415 });
    }
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    // Payment proofs are grouped per client company:
    // payments/<Company Name>/<file>. With the Google Drive storage
    // driver each segment becomes a real folder; the name is therefore
    // stripped of path separators and length-capped here.
    const rawCompanyName = (invoiceCheck.rows[0].company_name as string | null)?.trim();
    const companySegment = (rawCompanyName || 'Tanpa Perusahaan')
      .replace(/[/\\]+/g, '-')
      .replace(/\s+/g, ' ')
      .slice(0, 80);
    // File name format: yyyy_mm_dd_<termin|retainer>_<original name>.
    // The date is the invoice date, falling back to today (Asia/Jakarta)
    // when the invoice has not been issued yet; "termin" covers the
    // milestone billing type, "retainer" the recurring monthly one.
    const invoiceDate = invoiceCheck.rows[0].invoice_date as Date | string | null;
    const isoDate = invoiceDate
      ? (invoiceDate instanceof Date ? invoiceDate.toISOString().slice(0, 10) : String(invoiceDate).slice(0, 10))
      : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const dateSegment = isoDate.replace(/-/g, '_');
    const kindSegment = invoiceCheck.rows[0].billing_type === 'recurring_monthly' ? 'retainer' : 'termin';
    let fileSegment = `${dateSegment}_${kindSegment}_${sanitizedName}`;
    let objectKey = `payments/${companySegment}/${fileSegment}`;
    // Collision guard: another invoice of the same company could produce
    // the identical key (same date, kind and original file name). Only in
    // that case is the invoice id folded into the name, so one invoice's
    // proof can never silently replace another invoice's proof.
    const expectedUrl = `/api/files/${encodeURIComponent(objectKey)}`;
    const clash = await pool.query(
      'SELECT id FROM payment_milestone_invoices WHERE proof_file_url = $1 AND id <> $2 LIMIT 1',
      [expectedUrl, invoiceId]
    );
    if (clash.rows.length) {
      fileSegment = `${dateSegment}_${kindSegment}_inv${invoiceId}_${sanitizedName}`;
      objectKey = `payments/${companySegment}/${fileSegment}`;
    }

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
      message: 'Bukti transfer berhasil diunggah ke penyimpanan file',
      invoice: updated,
      file_url: fileUrl,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}
