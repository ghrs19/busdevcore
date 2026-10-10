'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface AuditLogItem {
  id: number;
  user_id?: number;
  user_name?: string;
  user_email?: string;
  entity_type: string;
  entity_id: number;
  action: string;
  details?: Record<string, unknown>;
  created_at: string;
}

export default function AuditDashboardPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('ALL');

  useEffect(() => {
    async function loadLogs() {
      try {
        const res = await fetch('/api/audit?limit=100');
        const data = await res.json();
        if (data.success && Array.isArray(data.logs)) {
          setLogs(data.logs);
        }
      } catch (err) {
        console.error('Failed to load audit logs:', err);
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, []);

  const filtered = logs.filter((log) => {
    if (filterAction === 'ALL') return true;
    return log.action === filterAction;
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', paddingBottom: '80px' }}>
      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 20px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '24px',
            paddingBottom: '20px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Link
                href="/commercial"
                style={{
                  fontSize: '12px',
                  color: 'var(--text-tertiary)',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>←</span>
                <span>Daftar Proposal</span>
              </Link>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              Global Activity Log & Audit Trail
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              Rekam jejak setiap perubahan status deal, revisi harga, dan konversi dokumen kontrak oleh pengguna.
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <div
          className="linear-card"
          style={{
            padding: '14px 20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginRight: '6px' }}>Filter Aksi:</span>
          {['ALL', 'STATUS_CHANGE', 'DOCUMENT_GENERATE'].map((act) => (
            <button
              key={act}
              onClick={() => setFilterAction(act)}
              className={filterAction === act ? 'btn-primary' : 'btn-secondary'}
              style={{
                padding: '4px 12px',
                fontSize: '12px',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              {act === 'ALL' ? 'Semua Log' : act}
            </button>
          ))}
        </div>

        {/* Logs Table */}
        <div className="linear-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="pro-table">
              <thead>
                <tr>
                  <th style={{ width: '180px', textAlign: 'left' }}>Waktu Kejadian</th>
                  <th style={{ width: '160px', textAlign: 'left' }}>Pengguna</th>
                  <th style={{ width: '150px', textAlign: 'center' }}>Entitas</th>
                  <th style={{ width: '160px', textAlign: 'center' }}>Aksi</th>
                  <th style={{ minWidth: '320px', textAlign: 'left' }}>Detail Perubahan</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
                      Memuat rekaman audit trail...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
                      Belum ada rekaman audit log.
                    </td>
                  </tr>
                ) : (
                  filtered.map((log) => {
                    const logDate = new Date(log.created_at).toLocaleString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    });

                    return (
                      <tr key={log.id}>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{logDate}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '12.5px' }}>
                            {log.user_name || 'System / Guest'}
                          </div>
                          {log.user_email && (
                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{log.user_email}</div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="linear-badge font-mono-numbers" style={{ fontSize: '11px' }}>
                            {log.entity_type} #{log.entity_id}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className="linear-badge font-mono-numbers"
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              background:
                                log.action === 'STATUS_CHANGE'
                                  ? 'rgba(245, 158, 11, 0.15)'
                                  : log.action === 'DOCUMENT_GENERATE'
                                  ? 'rgba(56, 189, 248, 0.15)'
                                  : 'rgba(255, 255, 255, 0.05)',
                              color:
                                log.action === 'STATUS_CHANGE'
                                  ? '#f59e0b'
                                  : log.action === 'DOCUMENT_GENERATE'
                                  ? '#38bdf8'
                                  : 'var(--text-primary)',
                            }}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td>
                          <code
                            style={{
                              fontSize: '11.5px',
                              color: 'var(--text-secondary)',
                              background: 'rgba(0,0,0,0.2)',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              display: 'inline-block',
                            }}
                          >
                            {JSON.stringify(log.details)}
                          </code>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
