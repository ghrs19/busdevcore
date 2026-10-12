import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { uploadFile } from '@/lib/storage';
import { logAudit } from '@/lib/audit';
import { readBoundedRequest } from '@/lib/bounded-request.mjs';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_REQUEST_SIZE = MAX_FILE_SIZE + 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

function matchesFileSignature(type: string, bytes: Buffer) {
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
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
    const proposalId = /^\d+$/.test(id) ? Number(id) : NaN;
    if (!Number.isSafeInteger(proposalId) || proposalId <= 0) {
      return NextResponse.json({ success: false, error: 'ID proposal tidak valid' }, { status: 400 });
    }

    const boundedRequest = await readBoundedRequest(req, MAX_REQUEST_SIZE);
    if (!boundedRequest) return NextResponse.json({ success: false, error: 'Request too large' }, { status: 413 });
    const formData = await boundedRequest.formData();
    const documentId = formData.get('document_id');
    const file = formData.get('file') as File | null;

    if (!documentId || !file) {
      return NextResponse.json({ success: false, error: 'Document ID dan File wajib disertakan' }, { status: 400 });
    }

    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'File size must be 1 byte to 10 MB' }, { status: 413 });
    }

    const documentIdText = String(documentId);
    const docId = /^\d+$/.test(documentIdText) ? Number(documentIdText) : NaN;
    if (!Number.isSafeInteger(docId) || docId <= 0) {
      return NextResponse.json({ success: false, error: 'Document ID tidak valid' }, { status: 400 });
    }
    const documentRes = await pool.query(
      'SELECT id FROM contract_documents WHERE id = $1 AND proposal_id = $2',
      [docId, proposalId],
    );
    if (documentRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Dokumen kontrak tidak ditemukan' }, { status: 404 });
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ success: false, error: 'Tipe file tidak didukung' }, { status: 415 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!matchesFileSignature(file.type, buffer)) {
      return NextResponse.json({ success: false, error: 'File content does not match type' }, { status: 415 });
    }
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const objectKey = `contracts/prop_${proposalId}_doc_${docId}_${Date.now()}_${sanitizedName}`;

    const fileUrl = await uploadFile(objectKey, buffer, file.size, file.type || 'application/octet-stream');

    // Update contract_documents
    const updateRes = await pool.query(`
      UPDATE contract_documents
      SET 
        file_url = $1,
        file_name = $2,
        file_size = $3,
        mime_type = $4,
        uploaded_at = NOW(),
        updated_at = NOW()
      WHERE id = $5 AND proposal_id = $6
      RETURNING *
    `, [fileUrl, file.name, file.size, file.type || 'application/pdf', docId, proposalId]);

    if (updateRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Dokumen kontrak tidak ditemukan' }, { status: 404 });
    }

    const updated = updateRes.rows[0];

    await logAudit({
      userId: user.id,
      entityType: 'commercial_proposal',
      entityId: proposalId,
      action: 'CONTRACT_FILE_UPLOADED',
      details: {
        document_type: updated.doc_type,
        document_number: updated.doc_number,
        file_name: file.name,
        file_size: file.size,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'File fisik dokumen berhasil diunggah ke MinIO Storage',
      document: updated,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}
