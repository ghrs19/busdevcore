import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { signSession, verifyPassword, sessionCookie } from '@/lib/auth';
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) return NextResponse.json({ error: 'Email dan password wajib diisi.' }, { status: 400 });
    const { rows } = await pool.query('SELECT id,role,password_hash FROM users WHERE lower(email)=$1 AND is_active=TRUE', [email]);
    if (!rows[0] || !verifyPassword(password, rows[0].password_hash)) return NextResponse.json({ error: 'Email atau password salah.' }, { status: 401 });
    const response = NextResponse.json({ success: true });
    response.cookies.set(sessionCookie, signSession(rows[0].id, rows[0].role || 'staff'), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 604800 });
    return response;
  } catch { return NextResponse.json({ error: 'Layanan autentikasi belum tersedia.' }, { status: 503 }); }
}
