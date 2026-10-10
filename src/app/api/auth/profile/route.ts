import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser, verifyPassword, hashPassword } from '@/lib/auth';

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { rows } = await pool.query(
      'SELECT id, name, email, role, is_active, created_at, updated_at FROM users WHERE id = $1',
      [user.id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: rows[0] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, old_password, new_password } = body;

    // Fetch user current record including password_hash
    const { rows } = await pool.query(
      'SELECT id, name, email, role, password_hash FROM users WHERE id = $1',
      [user.id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    const currentUserRecord = rows[0];
    const newName = typeof name === 'string' && name.trim() ? name.trim() : currentUserRecord.name;

    // Handle password change if requested
    let updatedPasswordHash = currentUserRecord.password_hash;
    if (new_password) {
      if (typeof new_password !== 'string' || new_password.length < 6) {
        return NextResponse.json(
          { error: 'Password baru minimal harus 6 karakter.' },
          { status: 400 }
        );
      }

      if (!old_password || typeof old_password !== 'string') {
        return NextResponse.json(
          { error: 'Password lama wajib diisi untuk mengubah password.' },
          { status: 400 }
        );
      }

      const isOldPasswordValid = verifyPassword(old_password, currentUserRecord.password_hash);
      if (!isOldPasswordValid) {
        return NextResponse.json(
          { error: 'Password lama yang Anda masukkan salah.' },
          { status: 400 }
        );
      }

      updatedPasswordHash = hashPassword(new_password);
    }

    // Execute update
    const updateRes = await pool.query(
      `UPDATE users
       SET name = $1, password_hash = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, name, email, role, is_active, updated_at`,
      [newName, updatedPasswordHash, user.id]
    );

    return NextResponse.json({
      success: true,
      message: 'Profil dan kata sandi berhasil diperbarui.',
      user: updateRes.rows[0],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
