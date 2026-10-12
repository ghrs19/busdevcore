import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getFileStream, getFileStat } from '@/lib/storage';
import { currentUser } from '@/lib/auth';
import { Readable } from 'stream';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string }> }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { path: objectName } = await params;
    const decodedName = decodeURIComponent(objectName);
    const fileUrl = `/api/files/${encodeURIComponent(decodedName)}`;
    const authorized = await pool.query(`
      SELECT 1 FROM payment_milestone_invoices WHERE proof_file_url = $1
      UNION ALL
      SELECT 1 FROM contract_documents WHERE file_url = $1
      LIMIT 1
    `, [fileUrl]);
    if (!authorized.rows.length) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const stat = await getFileStat(decodedName);
    const stream = await getFileStream(decodedName);

    // Convert Node Readable stream to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err) => controller.error(err));
      },
    });

    const headers = new Headers();
    headers.set('Content-Type', stat.metaData['content-type'] || 'application/octet-stream');
    headers.set('Content-Length', String(stat.size));
    headers.set('Cache-Control', 'private, max-age=3600');
    headers.set('X-Content-Type-Options', 'nosniff');

    return new Response(webStream, { headers });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'File not found';
    return NextResponse.json({ success: false, error: msg }, { status: 404 });
  }
}
