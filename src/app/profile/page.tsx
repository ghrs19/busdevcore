'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState('');
  
  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status & loading
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/profile');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      if (data.success && data.user) {
        setProfile(data.user);
        setName(data.user.name || '');
      } else {
        setErrorMsg(data.error || 'Gagal memuat profil');
      }
    } catch {
      setErrorMsg('Gagal terhubung ke server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Nama lengkap tidak boleh kosong.');
      return;
    }

    setSavingProfile(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setProfile(data.user);
        setSuccessMsg('Nama profil berhasil disimpan.');
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(data.error || 'Gagal memperbarui nama profil.');
      }
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!oldPassword) {
      setErrorMsg('Password saat ini wajib diisi.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('Password baru minimal harus 6 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Konfirmasi password baru tidak cocok.');
      return;
    }

    setSavingPassword(true);

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('Password berhasil diperbarui.');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(data.error || 'Gagal memperbarui password.');
      }
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan saat mengubah password.');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px', color: 'var(--text-secondary)' }}>
        Memuat data profil...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '32px auto', padding: '0 24px' }}>
      {/* Breadcrumb & Navigation */}
      <div style={{ marginBottom: '24px' }}>
        <Link
          href="/"
          className="btn-ghost"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            textDecoration: 'none',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            marginBottom: '12px',
          }}
        >
          ← Kembali ke Historical Estimates
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Pengaturan Akun & Profil
          </h1>
          {profile?.role && (
            <span
              className="linear-badge"
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                textTransform: 'uppercase',
                background: profile.role === 'admin' ? 'rgba(94, 106, 210, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                color: profile.role === 'admin' ? '#a5b4fc' : 'var(--text-secondary)',
                border: `1px solid ${profile.role === 'admin' ? 'rgba(94, 106, 210, 0.4)' : 'var(--border-subtle)'}`,
              }}
            >
              {profile.role}
            </span>
          )}
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
          Kelola informasi identitas akun Anda dan perbarui kata sandi secara mandiri.
        </p>
      </div>

      {/* Global Notifications */}
      {successMsg && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#10b981',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>✓</span>
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>⚠</span>
          <span>{errorMsg}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Card 1: Informasi Profil */}
        <div
          style={{
            backgroundColor: 'rgba(18, 19, 22, 0.7)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '24px',
          }}
        >
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
            Informasi Profil
          </h2>

          <form onSubmit={handleUpdateName}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Email Akun (Login)
              </label>
              <input
                type="email"
                value={profile?.email || ''}
                disabled
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  color: 'var(--text-tertiary)',
                  fontSize: '13px',
                  cursor: 'not-allowed',
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', display: 'block' }}>
                Email digunakan sebagai identifier login utama dan tidak dapat diubah mandiri.
              </span>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Nama Lengkap
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masukkan nama lengkap Anda"
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'rgba(0, 0, 0, 0.25)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="btn-primary"
              style={{
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: savingProfile ? 'not-allowed' : 'pointer',
              }}
            >
              {savingProfile ? 'Menyimpan...' : 'Simpan Nama Profil'}
            </button>
          </form>
        </div>

        {/* Card 2: Ubah Password */}
        <div
          style={{
            backgroundColor: 'rgba(18, 19, 22, 0.7)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '24px',
          }}
        >
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Ubah Kata Sandi (Password)
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
            Pastikan menggunakan password yang kuat dan aman dengan kombinasi karakter dan angka.
          </p>

          <form onSubmit={handleUpdatePassword}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Password Saat Ini (Lama)
              </label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'rgba(0, 0, 0, 0.25)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Password Baru
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 karakter"
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'rgba(0, 0, 0, 0.25)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Konfirmasi Password Baru
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password baru"
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'rgba(0, 0, 0, 0.25)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingPassword}
              className="btn-primary"
              style={{
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: savingPassword ? 'not-allowed' : 'pointer',
              }}
            >
              {savingPassword ? 'Memperbarui...' : 'Perbarui Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
