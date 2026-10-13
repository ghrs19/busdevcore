'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Eye, EyeOff, FileSignature, Loader2, LockKeyhole, Mail, Receipt, ShieldCheck, Calculator } from 'lucide-react';
import ThemeSwitcher from '@/components/ThemeSwitcher';

const FEATURES = [
  { icon: Calculator, title: 'Costing per orang', text: 'Estimasi jam dan biaya berbasis tarif tiap anggota tim.' },
  { icon: FileSignature, title: 'Proposal & kontrak', text: 'Penawaran, revisi, SPK, dan BAST dalam satu alur.' },
  { icon: Receipt, title: 'Penagihan terpantau', text: 'Termin, retainer, jatuh tempo, dan bukti bayar terlacak.' },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login gagal.');
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative grid min-h-screen bg-canvas lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Brand panel */}
      <aside className="auth-panel relative hidden overflow-hidden border-r border-line lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="auth-grid" aria-hidden />
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-pentacode.png" alt="PT Penta Code Digital" className="brand-logo-dark h-8 w-auto object-contain" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-pentacode-pdf.png" alt="PT Penta Code Digital" className="brand-logo-light h-8 w-auto object-contain" />
        </div>

        <div className="relative max-w-[460px]">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[11.5px] font-medium text-fg-2">
            <ShieldCheck className="size-3.5 text-brand-fg" aria-hidden /> Akses internal terautentikasi
          </div>
          <h1 className="text-[34px] font-semibold leading-[1.15] tracking-[-0.03em] text-fg xl:text-[40px]">
            Dari estimasi biaya sampai kas masuk, <span className="text-brand-fg">dalam satu tempat.</span>
          </h1>
          <p className="mt-4 text-[14.5px] leading-relaxed text-fg-3">
            Project Costing ERP untuk menyusun penawaran yang akurat, mengunci kontrak, dan memantau penagihan tanpa spreadsheet berserakan.
          </p>

          <ul className="mt-9 grid gap-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface text-brand-fg">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span>
                  <span className="block text-[13.5px] font-semibold text-fg">{title}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-fg-3">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[12px] text-fg-3">© 2026 PT Penta Code Digital</p>
      </aside>

      {/* Form */}
      <section className="relative flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between lg:justify-end">
          <div className="lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-pentacode.png" alt="PT Penta Code Digital" className="brand-logo-dark h-7 w-auto object-contain" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-pentacode-pdf.png" alt="PT Penta Code Digital" className="brand-logo-light h-7 w-auto object-contain" />
          </div>
          <ThemeSwitcher />
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <form onSubmit={submit} className="w-full max-w-[400px]" noValidate={false}>
            <div className="mb-8">
              <h2 className="text-[26px] font-semibold tracking-[-0.025em] text-fg">Selamat datang kembali</h2>
              <p className="mt-2 text-[13.5px] text-fg-3">Masuk dengan akun busdevcore Anda untuk melanjutkan.</p>
            </div>

            {error && (
              <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-lg border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] bg-[var(--color-danger-bg)] px-3.5 py-3 text-[13px] text-bad">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            )}

            <label htmlFor="login-email" className="mb-1.5 block text-[12.5px] font-medium text-fg-2">
              Email
            </label>
            <div className="relative mb-4">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
              <input
                id="login-email"
                type="email"
                required
                autoComplete="username"
                placeholder="nama@perusahaan.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="linear-input"
                style={{ paddingLeft: 38, minHeight: 42 }}
              />
            </div>

            <label htmlFor="login-password" className="mb-1.5 block text-[12.5px] font-medium text-fg-2">
              Password
            </label>
            <div className="relative mb-6">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
              <input
                id="login-password"
                type={show ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="linear-input"
                style={{ paddingLeft: 38, paddingRight: 42, minHeight: 42 }}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
                aria-pressed={show}
                className="btn-ghost btn-icon btn-sm absolute right-1.5 inset-y-0 my-auto"
              >
                {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
            </div>

            <button type="submit" disabled={loading} className="btn-primary btn-lg w-full" >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Memeriksa…
                </>
              ) : (
                <>
                  Masuk <ArrowRight className="size-4" aria-hidden />
                </>
              )}
            </button>

            <p className="mt-6 text-center text-[12px] text-fg-3">Lupa akses? Hubungi administrator untuk mengatur ulang akun.</p>
          </form>
        </div>
      </section>
    </main>
  );
}
