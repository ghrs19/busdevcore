import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import pool from '@/lib/db';
import { readBoundedRequest } from '@/lib/bounded-request.mjs';

const ID = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_MESSAGES = 500;
const MAX_BYTES = 2_000_000;

async function admin() {
  const user = await currentUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user };
}

export async function GET(request: Request) {
  const auth = await admin();
  if (auth.error) return auth.error;
  const threadId = new URL(request.url).searchParams.get('threadId');
  if (threadId && !ID.test(threadId)) return NextResponse.json({ error: 'Invalid threadId' }, { status: 400 });
  if (threadId) {
    const { rows } = await pool.query(
      'SELECT thread_id,title,messages,created_at,updated_at FROM copilot_conversations WHERE user_id=$1 AND thread_id=$2',
      [auth.user.id, threadId],
    );
    return rows[0] ? NextResponse.json({ conversation: rows[0] }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const { rows } = await pool.query(
    'SELECT thread_id,title,created_at,updated_at FROM copilot_conversations WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 50',
    [auth.user.id],
  );
  return NextResponse.json({ conversations: rows });
}

export async function PUT(request: Request) {
  const auth = await admin();
  if (auth.error) return auth.error;
  const bounded = await readBoundedRequest(request, MAX_BYTES);
  if (!bounded) return NextResponse.json({ error: 'Conversation exceeds size limit' }, { status: 413 });
  let body: unknown;
  try { body = await bounded.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const value = body as { threadId?: unknown; messages?: unknown };
  if (typeof value.threadId !== 'string' || !ID.test(value.threadId)) return NextResponse.json({ error: 'Invalid threadId' }, { status: 400 });
  if (!Array.isArray(value.messages) || value.messages.length > MAX_MESSAGES) return NextResponse.json({ error: 'Invalid messages' }, { status: 400 });
  let encoded: string;
  try { encoded = JSON.stringify(value.messages); } catch { return NextResponse.json({ error: 'Invalid messages' }, { status: 400 }); }
  if (Buffer.byteLength(encoded) > MAX_BYTES || value.messages.some((m) => !m || typeof m !== 'object' || Array.isArray(m))) {
    return NextResponse.json({ error: 'Conversation exceeds limits or contains invalid message' }, { status: 413 });
  }
  const firstUser = value.messages.find((m) => (m as { role?: string }).role === 'user') as { content?: unknown } | undefined;
  const rawTitle = typeof firstUser?.content === 'string' ? firstUser.content : 'Percakapan baru';
  const title = rawTitle.replace(/\s+/g, ' ').trim().slice(0, 120) || 'Percakapan baru';
  const { rows } = await pool.query(
    `INSERT INTO copilot_conversations(user_id,thread_id,title,messages)
     VALUES($1,$2,$3,$4::jsonb)
     ON CONFLICT(user_id,thread_id) DO UPDATE SET title=EXCLUDED.title,messages=EXCLUDED.messages,updated_at=CURRENT_TIMESTAMP
     RETURNING thread_id,title,updated_at`,
    [auth.user.id, value.threadId, title, encoded],
  );
  return NextResponse.json({ conversation: rows[0] });
}

export async function DELETE(request: Request) {
  const auth = await admin();
  if (auth.error) return auth.error;
  const threadId = new URL(request.url).searchParams.get('threadId');
  if (!threadId || !ID.test(threadId)) return NextResponse.json({ error: 'Invalid threadId' }, { status: 400 });
  const result = await pool.query('DELETE FROM copilot_conversations WHERE user_id=$1 AND thread_id=$2', [auth.user.id, threadId]);
  return NextResponse.json({ deleted: result.rowCount === 1 });
}
