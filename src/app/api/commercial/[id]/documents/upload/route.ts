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
    const proposalId = parseInt(id, 10);
    if (isNaN(proposalId)) {
      return NextResponse.json({ success: false, error: 'ID proposal tidak valid' }, { status: 400 });
    }

    const formData = await req.formData();
    const documentId = formData.get('document_id');
    const file = formData.get('file') as File | null;

    if (!documentId || !file) {
      return NextResponse.json({ success: false, error: 'Document ID dan File wajib disertakan' }, { status: 400 });
    }

    const docId = parseInt(String(documentId), 10);
    const buffer = Buffer.from(await file.arrayBuffer());
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Upload error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
