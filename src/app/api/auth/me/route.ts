import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
export async function GET() {
  try { const user = await currentUser(); return user ? NextResponse.json({ user }) : NextResponse.json({ user: null }, { status: 401 }); }
  catch { return NextResponse.json({ error: 'Layanan autentikasi belum tersedia.' }, { status: 503 }); }
}
