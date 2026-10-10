import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import pool from './db';

const COOKIE = 'busdev_session';
const secret = process.env.AUTH_SECRET || process.env.DATABASE_URL || 'busdevcore-local-session-secret-change-me';

type User = { id: number; name: string; email: string; role: string; is_active: boolean };
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password: string, hash: string) {
  const [salt, key] = hash.split(':');
  if (!salt || !key) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(key, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function signSession(id: number) {
  const payload = Buffer.from(JSON.stringify({ id, exp: Date.now() + 7 * 86400000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}
export function readSession(token?: string) {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = createHmac('sha256', secret).update(payload).digest();
  let provided: Buffer;
  try { provided = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  try { const data = JSON.parse(Buffer.from(payload, 'base64url').toString()); return data.exp > Date.now() ? Number(data.id) : null; } catch { return null; }
}
export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const id = readSession(jar.get(COOKIE)?.value);
  if (!id) return null;
  const { rows } = await pool.query('SELECT id,name,email,role,is_active FROM users WHERE id=$1 AND is_active=TRUE', [id]);
  return rows[0] || null;
}
export const sessionCookie = COOKIE;
