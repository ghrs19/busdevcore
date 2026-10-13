'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { Page, PageHeader } from '@/components/ui/Page';
import DataGrid from '@/components/ui/DataGrid';

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

const ACTION_BADGE: Record<string, string> = {
  CREATE: 'badge-connected',
  REVISION: 'badge-accent',
  STATUS_CHANGE: 'badge-warning',
  PAYMENT_UPDATE: 'badge-info',
  DOCUMENT_GENERATE: 'badge-info',
  DELETE: 'badge-danger',
};

export default function AuditDashboardPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('ALL');
  const [open, setOpen] = useState<Set<number>>(new Set());

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

  const actions = useMemo(() => ['ALL', ...Array.from(new Set(logs.map((l) => l.action)))], [logs]);
  const filtered = logs.filter((log) => filterAction === 'ALL' || log.action === filterAction);

  const toggle = (id: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Page wide>
      <PageHeader
        eyebrow="Keamanan & kepatuhan"
        title="Activity log & audit trail"
        description="Rekam jejak perubahan status deal, revisi harga, pembayaran, dan konversi dokumen kontrak oleh pengguna."
      />

      <DataGrid
        title={
          <div className="pill-group" role="tablist" aria-label="Filter aksi">
            {actions.map((act) => (
              <button key={act} type="button" role="tab" aria-selected={filterAction === act} onClick={() => setFilterAction(act)} className={`pill-item${filterAction === act ? ' active' : ''}`}>
                {act === 'ALL' ? 'Semua log' : act.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
              </button>
            ))}
          </div>
        }
        actions={<span className="font-mono-numbers text-[12px] text-fg-3">{filtered.length} entri</span>}
      >
        <table className="pro-table" style={{ minWidth: 960 }}>
          <thead>
            <tr>
              <th style={{ width: 190 }}>Waktu</th>
              <th style={{ width: 220 }}>Pengguna</th>
              <th style={{ width: 190 }}>Entitas</th>
              <th style={{ width: 170 }}>Aksi</th>
              <th style={{ minWidth: 360 }}>Detail perubahan</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="dg-empty">Memuat rekaman audit trail…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="dg-empty">Belum ada rekaman audit log.</td>
              </tr>
            ) : (
              filtered.map((log) => {
                const d = new Date(log.created_at);
                const date = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const isOpen = open.has(log.id);
                const json = JSON.stringify(log.details ?? {}, null, isOpen ? 2 : 0);
                return (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap align-top">
                      <div className="text-[12.5px] text-fg">{date}</div>
                      <div className="font-mono-numbers text-[11.5px] text-fg-3">{time}</div>
                    </td>
                    <td className="align-top">
                      <div className="cell-strong cell-trunc text-[12.5px]" style={{ maxWidth: '26ch' }}>{log.user_name || 'System / Guest'}</div>
                      {log.user_email && <div className="cell-trunc text-[11.5px] text-fg-3" style={{ maxWidth: '26ch' }} title={log.user_email}>{log.user_email}</div>}
                    </td>
                    <td className="align-top">
                      <span className="badge badge-neutral font-mono-numbers">
                        {log.entity_type} #{log.entity_id}
                      </span>
                    </td>
                    <td className="align-top">
                      <span className={`badge ${ACTION_BADGE[log.action] || 'badge-neutral'}`}>{log.action}</span>
                    </td>
                    <td className="align-top">
                      <button
                        type="button"
                        onClick={() => toggle(log.id)}
                        aria-expanded={isOpen}
                        className="group flex w-full items-start gap-1.5 rounded-md p-2 text-left transition-colors hover:bg-[var(--row-hover)]"
                        title={isOpen ? 'Ciutkan detail' : 'Lihat detail lengkap'}
                      >
                        <ChevronRight className={`mt-[3px] size-3.5 shrink-0 text-fg-3 transition-transform ${isOpen ? 'rotate-90' : ''}`} aria-hidden />
                        <code
                          className="font-mono text-[11.5px] leading-relaxed text-fg-2"
                          style={isOpen ? { whiteSpace: 'pre-wrap', wordBreak: 'break-word' } : { display: 'block', maxWidth: '56ch', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {json}
                        </code>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </DataGrid>
    </Page>
  );
}
