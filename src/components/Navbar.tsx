'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ChartBarIcon,
  CalculatorIcon,
  BriefcaseIcon,
  BanknotesIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';

function NavLinks({ role }: { role: string }) {
  const pathname = usePathname();
  const isDashboard = pathname === '/dashboard';
  const isCosting = pathname === '/' || pathname === '/costing' || pathname?.startsWith('/estimates');
  const isCommercial = pathname?.startsWith('/commercial');
  const isInvoices = pathname?.startsWith('/invoices');
  const isLogs = pathname?.startsWith('/audit');
  const isMaster = pathname?.startsWith('/master');

  const navItemStyle = (isActive: boolean) => ({
    textDecoration: 'none',
    padding: '6px 13px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    backgroundColor: isActive ? 'rgba(94, 106, 210, 0.15)' : 'transparent',
    color: isActive ? '#a5b4fc' : 'var(--text-secondary)',
    border: isActive ? '1px solid rgba(94, 106, 210, 0.35)' : '1px solid transparent',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.15s ease',
  });

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {/* 1. Dashboard */}
      <Link href="/dashboard" className="pill-item" style={navItemStyle(isDashboard)}>
        <ChartBarIcon className="w-4 h-4" style={{ width: '15px', height: '15px' }} />
        <span>Dashboard</span>
      </Link>

      {/* 2. Costing */}
      <Link href="/" className="pill-item" style={navItemStyle(isCosting)}>
        <CalculatorIcon className="w-4 h-4" style={{ width: '15px', height: '15px' }} />
        <span>Costing</span>
      </Link>

      {/* 3. Commercials/Quote */}
      <Link href="/commercial" className="pill-item" style={navItemStyle(isCommercial)}>
        <BriefcaseIcon className="w-4 h-4" style={{ width: '15px', height: '15px' }} />
        <span>Commercials/Quote</span>
      </Link>

      {/* 4. Invoices */}
      <Link href="/invoices" className="pill-item" style={navItemStyle(isInvoices)}>
        <BanknotesIcon className="w-4 h-4" style={{ width: '15px', height: '15px' }} />
        <span>Invoices</span>
      </Link>

      {/* 5. Logs */}
      <Link href="/audit" className="pill-item" style={navItemStyle(isLogs)}>
        <ClipboardDocumentListIcon className="w-4 h-4" style={{ width: '15px', height: '15px' }} />
        <span>Logs</span>
      </Link>

      {role === 'admin' && (
        <Link
          href="/master"
          className="pill-item"
          style={{
            textDecoration: 'none',
            padding: '6px 14px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            backgroundColor: isMaster ? 'rgba(94, 106, 210, 0.15)' : 'transparent',
            color: isMaster ? '#a5b4fc' : 'var(--text-secondary)',
            border: isMaster ? '1px solid rgba(94, 106, 210, 0.35)' : '1px solid transparent',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          <Cog6ToothIcon className="w-4 h-4" style={{ width: '15px', height: '15px' }} />
          <span>Master Data</span>
        </Link>
      )}
    </nav>
  );
}

function NavbarContent() {
  const pathname = usePathname();
  const router = useRouter();
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
    <header
      style={{
        position: 'relative',
        backgroundColor: 'rgba(8, 9, 10, 0.85)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div
        style={{
          maxWidth: '1360px',
          margin: '0 auto',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        {/* Brand Logo & Subtitle */}
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-pentacode.png"
            alt="PT Penta Code Digital"
            style={{
              height: '30px',
              width: 'auto',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </Link>

        {/* Global Navigation Links */}
        <Suspense fallback={<nav style={{ height: '32px' }} />}>
          <NavLinks role={role} />
        </Suspense>

        {/* User Profile & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link
                href="/profile"
                className="btn-secondary"
                style={{
                  textDecoration: 'none',
                  fontSize: '12px',
                  padding: '5px 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                title="Buka Pengaturan Akun & Profil"
              >
                <UserCircleIcon className="w-4 h-4" style={{ width: '16px', height: '16px', color: 'var(--accent-hover)' }} />
                <span>{email}</span>
              </Link>
              <button
                className="btn-ghost"
                style={{ fontSize: '12px', padding: '5px 10px' }}
                onClick={async () => {
                  await fetch('/api/auth/logout', { method: 'POST' });
                  router.replace('/login');
                  router.refresh();
                }}
              >
                Logout
              </button>
            </div>
          )}
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
