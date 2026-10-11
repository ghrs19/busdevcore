import { NextResponse } from 'next/server';
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

    return new Response(webStream, { headers });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'File not found';
    return NextResponse.json({ success: false, error: msg }, { status: 404 });
  }
}
