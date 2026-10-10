'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function NavLinks() {
  const pathname = usePathname();
  const isDashboard = pathname === '/';
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
          backgroundColor: isDashboard ? 'rgba(94, 106, 210, 0.15)' : 'transparent',
          color: isDashboard ? '#a5b4fc' : 'var(--text-secondary)',
          border: isDashboard ? '1px solid rgba(94, 106, 210, 0.35)' : '1px solid transparent',
          transition: 'all 0.15s ease',
        }}
      >
        <span>Estimates / Dashboard</span>
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
          transition: 'all 0.15s ease',
        }}
      >
        <span>+ Buat Costing</span>
      </Link>

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
          transition: 'all 0.15s ease',
        }}
      >
        <span>⚙️ Master Data</span>
      </Link>
    </nav>
  );
}
function NavbarContent() {
  const pathname = usePathname();
  if (pathname?.includes('/print')) {
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
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #5e6ad2 0%, #7170ff 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px var(--accent-glow)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '15px',
              fontFamily: 'var(--font-sans)',
            }}
          >
            B
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-primary)',
                }}
              >
                busdevcore
              </span>
              <span
                style={{
                  fontSize: '10px',
                  color: 'var(--text-tertiary)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-subtle)',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                }}
              >
                ERP
              </span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: 1.2 }}>
              Project Costing ERP
            </p>
          </div>
        </Link>

        {/* Global Navigation Links */}
        <Suspense fallback={<nav style={{ height: '32px' }} />}>
          <NavLinks />
        </Suspense>

        {/* Status Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-connected">
            <span className="badge-dot" />
            PostgreSQL Connected
          </span>
          <span className="badge badge-port">
            <span className="badge-dot" />
            Port 3001
          </span>
        </div>
      </div>
    </header>
  );
}

export default function Navbar() {
  return <Suspense fallback={null}><NavbarContent /></Suspense>;
}
