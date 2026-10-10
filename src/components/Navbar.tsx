'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BanknotesIcon,
  DocumentTextIcon,
  PlusCircleIcon,
  BriefcaseIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';

function NavLinks({ role }: { role: string }) {
  const pathname = usePathname();
  const isHistorical = pathname === '/';
  const isNewEstimate = pathname === '/estimates/new';
  const isMaster = pathname?.startsWith('/master');

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Link
        href="/"
        className="pill-item"
        style={{
          textDecoration: 'none',
          padding: '6px 14px',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: 500,
          backgroundColor: isHistorical ? 'rgba(94, 106, 210, 0.15)' : 'transparent',
          color: isHistorical ? '#a5b4fc' : 'var(--text-secondary)',
          border: isHistorical ? '1px solid rgba(94, 106, 210, 0.35)' : '1px solid transparent',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'all 0.15s ease',
        }}
      >
        <DocumentTextIcon className="w-4 h-4" style={{ width: '15px', height: '15px' }} />
        <span>Historical Estimates</span>
      </Link>

      <Link
        href="/estimates/new"
        className="pill-item"
        style={{
          textDecoration: 'none',
          padding: '6px 14px',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: 500,
          backgroundColor: isNewEstimate ? 'rgba(94, 106, 210, 0.15)' : 'transparent',
          color: isNewEstimate ? '#a5b4fc' : 'var(--text-secondary)',
          border: isNewEstimate ? '1px solid rgba(94, 106, 210, 0.35)' : '1px solid transparent',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'all 0.15s ease',
        }}
      >
        <PlusCircleIcon className="w-4 h-4" style={{ width: '15px', height: '15px' }} />
        <span>Buat Costing</span>
      </Link>

      <Link
        href="/invoices"
        className="pill-item"
        style={{
          textDecoration: 'none',
          padding: '6px 14px',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: 500,
          backgroundColor: pathname.startsWith('/invoices') ? 'rgba(94, 106, 210, 0.15)' : 'transparent',
          color: pathname.startsWith('/invoices') ? '#a5b4fc' : 'var(--text-secondary)',
          border: pathname.startsWith('/invoices') ? '1px solid rgba(94, 106, 210, 0.35)' : '1px solid transparent',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'all 0.15s ease',
        }}
      >
        <BanknotesIcon className="w-4 h-4" style={{ width: '15px', height: '15px' }} />
        <span>Invoices</span>
      </Link>

      <Link
        href="/commercial"
        className="pill-item"
        style={{
          textDecoration: 'none',
          padding: '6px 14px',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: 500,
          backgroundColor: pathname.startsWith('/commercial') ? 'rgba(94, 106, 210, 0.15)' : 'transparent',
          color: pathname.startsWith('/commercial') ? '#a5b4fc' : 'var(--text-secondary)',
          border: pathname.startsWith('/commercial') ? '1px solid rgba(94, 106, 210, 0.35)' : '1px solid transparent',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'all 0.15s ease',
        }}
      >
        <BriefcaseIcon className="w-4 h-4" style={{ width: '15px', height: '15px' }} />
        <span>Proposal & Komersial</span>
      </Link>

      <Link
        href="/audit"
        className="pill-item"
        style={{
          textDecoration: 'none',
          padding: '6px 14px',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: 500,
          backgroundColor: pathname.startsWith('/audit') ? 'rgba(94, 106, 210, 0.15)' : 'transparent',
          color: pathname.startsWith('/audit') ? '#a5b4fc' : 'var(--text-secondary)',
          border: pathname.startsWith('/audit') ? '1px solid rgba(94, 106, 210, 0.35)' : '1px solid transparent',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'all 0.15s ease',
        }}
      >
        <ClipboardDocumentListIcon className="w-4 h-4" style={{ width: '15px', height: '15px' }} />
        <span>Audit Log</span>
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
              height: '28px',
              width: 'auto',
              objectFit: 'contain',
              display: 'block',
            }}
          />
          <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-primary)',
                }}
              >
                busdevcore
              </span>
              <span
                style={{
                  fontSize: '9.5px',
                  color: '#a5b4fc',
                  background: 'rgba(94, 106, 210, 0.15)',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  border: '1px solid rgba(94, 106, 210, 0.3)',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}
              >
                ERP
              </span>
            </div>
            <p style={{ fontSize: '10.5px', color: 'var(--text-tertiary)', lineHeight: 1.1, margin: 0 }}>
              PT Penta Code Digital
            </p>
          </div>
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
