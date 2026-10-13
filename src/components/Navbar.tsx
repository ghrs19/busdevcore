'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Calculator,
  ChevronDown,
  ClipboardList,
  FileSignature,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings2,
  UserCircle2,
  type LucideIcon,
} from 'lucide-react';
import ThemeSwitcher from './ThemeSwitcher';
import { cn } from '@/lib/cn';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, match: (p) => p === '/dashboard' },
  { href: '/', label: 'Costing', icon: Calculator, match: (p) => p === '/' || p === '/costing' || p.startsWith('/estimates') },
  { href: '/commercial', label: 'Commercial', icon: FileSignature, match: (p) => p.startsWith('/commercial') },
  { href: '/invoices', label: 'Invoices', icon: Receipt, match: (p) => p.startsWith('/invoices') },
  { href: '/audit', label: 'Logs', icon: ClipboardList, match: (p) => p.startsWith('/audit') },
  { href: '/master', label: 'Master Data', icon: Settings2, match: (p) => p.startsWith('/master'), adminOnly: true },
];

function NavLinks({ role }: { role: string }) {
  const pathname = usePathname() ?? '';
  return (
    <nav aria-label="Navigasi utama" className="no-scrollbar -mx-1 flex h-full min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-1">
      {NAV_ITEMS.filter((item) => !item.adminOnly || role === 'admin').map((item) => {
        const active = item.match(pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-[13px] font-medium no-underline transition-colors',
              active ? 'bg-[var(--accent-light)] text-fg' : 'text-fg-3 hover:bg-[var(--row-hover)] hover:text-fg',
            )}
          >
            <Icon className={cn('size-4', active ? 'text-brand-fg' : 'text-fg-3')} aria-hidden />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function UserMenu({ email, role }: { email: string; role: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initial = (email || '?').charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-2 rounded-full border-0 bg-surface-2 pl-1.5 pr-2.5 text-[12.5px] text-fg-3 transition-colors hover:bg-[var(--row-hover)] hover:text-fg"
      >
        <span className="grid size-6 place-items-center rounded-full bg-[var(--accent-light)] text-[11px] font-semibold text-brand-fg">{initial}</span>
        <span className="hidden max-w-[160px] truncate md:inline">{email}</span>
        <ChevronDown className={cn('size-3.5 text-fg-3 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 overflow-hidden rounded-xl border border-line bg-surface-3 p-1.5"
        >
          <div className="border-b border-line px-2.5 pb-2.5 pt-1.5">
            <div className="truncate text-[13px] font-medium text-fg">{email}</div>
            <div className="mt-0.5 text-[11px] capitalize text-fg-3">{role || 'user'}</div>
          </div>
          <div className="pt-1.5">
            <Link
              href="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-fg-2 no-underline transition-colors hover:bg-[var(--row-hover)] hover:text-fg"
            >
              <UserCircle2 className="size-4 text-fg-3" aria-hidden /> Profil &amp; akun
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                router.replace('/login');
                router.refresh();
              }}
              className="group mt-1 flex h-9 w-full items-center gap-2.5 rounded-lg border-0 bg-transparent px-2.5 text-left text-[13px] text-fg-3 shadow-none transition-colors hover:bg-[var(--row-hover)] hover:text-fg active:bg-[var(--accent-light)] active:text-fg active:transform-none"
            >
              <LogOut className="size-4 text-fg-3 group-hover:text-fg" aria-hidden /> Keluar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NavbarContent() {
  const pathname = usePathname();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) {
          setEmail(d.user.email);
          setRole(d.user.role);
        }
      })
      .catch(() => {});
  }, []);

  if (pathname === '/login' || pathname?.includes('/print')) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line backdrop-blur-md" style={{ backgroundColor: 'var(--bg-header)', height: 'var(--nav-h)' }}>
      <div className="mx-auto flex h-full items-center gap-4 px-4 sm:px-6" style={{ maxWidth: 'var(--page-max)' }}>
        <Link href="/" aria-label="PT Penta Code Digital" className="flex shrink-0 items-center no-underline">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-pentacode.png" alt="PT Penta Code Digital" className="brand-logo-dark h-[26px] w-auto object-contain" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-pentacode-light.jpg" alt="PT Penta Code Digital" className="brand-logo-light h-[26px] w-auto object-contain" />
        </Link>

        <span className="hidden h-5 w-px shrink-0 bg-[var(--border-subtle)] sm:block" aria-hidden />

        <Suspense fallback={<nav className="flex-1" />}>
          <NavLinks role={role} />
        </Suspense>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeSwitcher />
          {email && <UserMenu email={email} role={role} />}
        </div>
      </div>
    </header>
  );
}

export default function Navbar() {
  return (
    <Suspense fallback={null}>
      <NavbarContent />
    </Suspense>
  );
}
