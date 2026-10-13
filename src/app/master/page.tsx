'use client';


import { Bot, Building2, Briefcase, CircleCheck, Copy, FileStack, HardHat, SquarePen, Trash2, TriangleAlert, UserCog, Users, X, Contact, type LucideIcon } from 'lucide-react';
import { Page, PageHeader } from '@/components/ui/Page';
import { cn } from '@/lib/cn';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';

type TemplateCategory = 'DEVELOPMENT' | 'MAINTENANCE' | 'INFRASTRUCTURE' | 'OPERATION';

interface ClientCompany { id: number; name: string; email: string | null; phone: string | null; address: string | null; }
interface AppUser { id: number; name: string; email: string; role: string; is_active: boolean; created_at: string; }
interface UserForm extends Partial<AppUser> { password: string; }
interface IssuerSettings { [key: string]: string | null | undefined; company_name?: string | null; tagline?: string | null; address?: string | null; email?: string | null; phone?: string | null; }

interface RoleMaster {
  id: number;
  code: string;
  name: string;
  default_hourly_rate: number;
  is_active: boolean;
  created_at: string;
}

interface WBSTemplate {
  id: number;
  name: string;
  category: TemplateCategory;
  description: string | null;
  payload: unknown;
  is_active: boolean;
  updated_at: string;
}

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<'ROLES' | 'WORKERS' | 'TEMPLATES' | 'USERS' | 'COMPANIES_CLIENT' | 'COMPANY_ISSUER' | 'AI_PROMPT'>('ROLES');
  // Company Issuer Settings State
  const [issuerSettings, setIssuerSettings] = useState<IssuerSettings | null>(null);
  const [loadingIssuer, setLoadingIssuer] = useState(false);
  const [savingIssuer, setSavingIssuer] = useState(false);

  // Client Companies State
  const [clientCompanies, setClientCompanies] = useState<ClientCompany[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientCompany | null>(null);
  const [clientForm, setClientForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [savingClient, setSavingClient] = useState(false);

  const fetchIssuerSettings = async () => {
    setLoadingIssuer(true);
    try {
      const res = await fetch('/api/settings/company');
      const data = await res.json();
      if (data.success) setIssuerSettings(data.settings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingIssuer(false);
    }
  };

  const handleSaveIssuer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issuerSettings) return;
    setSavingIssuer(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/settings/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(issuerSettings),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Profil & pengaturan kop/tanda tangan perusahaan berhasil disimpan!');
      } else {
        setErrorMsg(data.error || 'Gagal menyimpan profil');
      }
    } catch {
      setErrorMsg('Gagal terhubung ke server');
    } finally {
      setSavingIssuer(false);
    }
  };

  const fetchClientCompanies = async () => {
    setLoadingClients(true);
    try {
      const res = await fetch('/api/companies');
      const data = await res.json();
      if (data.success) setClientCompanies(data.companies || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingClients(false);
    }
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingClient(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const method = editingClient ? 'PUT' : 'POST';
      const body = editingClient ? { id: editingClient.id, ...clientForm } : clientForm;
      const res = await fetch('/api/companies', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(editingClient ? 'Data perusahaan klien berhasil diperbarui!' : 'Perusahaan klien berhasil ditambahkan!');
        setEditingClient(null);
        setClientForm({ name: '', email: '', phone: '', address: '' });
        fetchClientCompanies();
      } else {
        setErrorMsg(data.error || 'Gagal menyimpan perusahaan klien');
      }
    } catch {
      setErrorMsg('Gagal terhubung ke server');
    } finally {
      setSavingClient(false);
    }
  };

  const [users, setUsers] = useState<AppUser[]>([]);
  const [userForm, setUserForm] = useState<UserForm | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const fetchUsers = async () => { const [list, me] = await Promise.all([fetch('/api/users'), fetch('/api/auth/me')]); const data = await list.json(); const who = await me.json(); if (list.ok) setUsers(data.users); if (me.ok) setCurrentUserId(who.user.id); };

  // Workers state (Master Worker: nama + rate per jam, tidak terhubung ke role)
  interface WorkerItem { id: number; name: string; hourly_rate: number; is_active: boolean }
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
  const [workerForm, setWorkerForm] = useState<{ id?: number; name: string; hourly_rate: string; is_active: boolean } | null>(null);
  const [savingWorker, setSavingWorker] = useState(false);
  const fetchWorkers = async () => {
    const res = await fetch('/api/workers');
    const data = await res.json();
    if (res.ok && data.success) setWorkers(data.workers);
    else setErrorMsg(data.error || 'Gagal memuat Master Worker.');
  };
  const handleSaveWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerForm) return;
    setSavingWorker(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/workers', {
        method: workerForm.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...workerForm, hourly_rate: Number(workerForm.hourly_rate) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setErrorMsg(data.error || 'Gagal menyimpan worker.'); return; }
      setWorkerForm(null);
      setSuccessMsg(`Worker '${data.worker.name}' berhasil disimpan.`);
      fetchWorkers();
    } finally {
      setSavingWorker(false);
    }
  };

  // Roles state
  const [roles, setRoles] = useState<RoleMaster[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleMaster | null>(null);
  const [newRoleCode, setNewRoleCode] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleRate, setNewRoleRate] = useState<number | string>('');
  const [isAddingRole, setIsAddingRole] = useState(false);

  // Templates state
  const [templates, setTemplates] = useState<WBSTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WBSTemplate | null>(null);
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);

  // New Template form state
  const [tplName, setTplName] = useState('');
  const [tplCategory, setTplCategory] = useState<'DEVELOPMENT' | 'MAINTENANCE' | 'INFRASTRUCTURE' | 'OPERATION'>('MAINTENANCE');
  const [tplDesc, setTplDesc] = useState('');
  const [tplPayloadStr, setTplPayloadStr] = useState('');

  // General feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchRoles = async () => {
    setLoadingRoles(true);
    try {
      const res = await fetch('/api/roles');
      const data = await res.json();
      if (data.success) {
        setRoles(data.roles);
      }
    } catch {
      setErrorMsg('Gagal memuat master role.');
    } finally {
      setLoadingRoles(false);
    }
  };

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates);
      }
    } catch {
      setErrorMsg('Gagal memuat master template.');
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    fetchRoles();
    fetchTemplates();
    fetchUsers();
  }, []);

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Handle Save Role (Create or Update)
  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (editingRole) {
      try {
        const res = await fetch('/api/roles', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingRole.id,
            name: newRoleName,
            default_hourly_rate: Number(newRoleRate) || 0,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setSuccessMsg(`Role ${editingRole.code} berhasil diperbarui.`);
          setEditingRole(null);
          fetchRoles();
        } else {
          setErrorMsg(data.error || 'Gagal update role.');
        }
      } catch {
        setErrorMsg('Terjadi kesalahan jaringan.');
      }
    } else {
      if (!newRoleCode.trim() || !newRoleName.trim()) {
        setErrorMsg('Kode dan Nama role wajib diisi.');
        return;
      }
      try {
        const res = await fetch('/api/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: newRoleCode.trim().toUpperCase(),
            name: newRoleName.trim(),
            default_hourly_rate: Number(newRoleRate) || 0,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setSuccessMsg(`Role ${data.role.code} berhasil ditambahkan.`);
          setIsAddingRole(false);
          setNewRoleCode('');
          setNewRoleName('');
          setNewRoleRate('');
          fetchRoles();
        } else {
          setErrorMsg(data.error || 'Gagal menambahkan role.');
        }
      } catch {
        setErrorMsg('Terjadi kesalahan jaringan.');
      }
    }
  };

  const handleDeleteRole = async (role: RoleMaster) => {
    if (!confirm(`Hapus role '${role.name}' (${role.code})? Data historis estimasi lama tetap aman.`)) return;
    try {
      const res = await fetch(`/api/roles?id=${role.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Role ${role.code} dihapus.`);
        fetchRoles();
      } else {
        setErrorMsg(data.error || 'Gagal menghapus role.');
      }
    } catch {
      setErrorMsg('Terjadi kesalahan saat menghapus role.');
    }
  };

  // Handle Save Template (Create or Update)
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(tplPayloadStr);
    } catch {
      setErrorMsg('Payload data template harus berupa format JSON valid.');
      return;
    }

    if (editingTemplate) {
      try {
        const res = await fetch('/api/templates', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingTemplate.id,
            name: tplName.trim(),
            category: tplCategory,
            description: tplDesc.trim() || null,
            payload: parsedPayload,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setSuccessMsg(`Template '${tplName}' berhasil diperbarui.`);
          setEditingTemplate(null);
          setIsAddingTemplate(false);
          fetchTemplates();
        } else {
          setErrorMsg(data.error || 'Gagal memperbarui template.');
        }
      } catch {
        setErrorMsg('Terjadi kesalahan jaringan.');
      }
    } else {
      try {
        const res = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: tplName.trim(),
            category: tplCategory,
            description: tplDesc.trim() || null,
            payload: parsedPayload,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setSuccessMsg(`Template '${data.template.name}' berhasil ditambahkan.`);
          setIsAddingTemplate(false);
          setTplName('');
          setTplDesc('');
          setTplPayloadStr('');
          fetchTemplates();
        } else {
          setErrorMsg(data.error || 'Gagal membuat template.');
        }
      } catch {
        setErrorMsg('Terjadi kesalahan jaringan.');
      }
    }
  };

  const handleDeleteTemplate = async (tpl: WBSTemplate) => {
    if (!confirm(`Hapus template '${tpl.name}'?`)) return;
    try {
      const res = await fetch(`/api/templates?id=${tpl.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Template '${tpl.name}' berhasil dihapus.`);
        fetchTemplates();
      } else {
        setErrorMsg(data.error || 'Gagal menghapus template.');
      }
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan.');
    }
  };

  const startEditTemplate = (tpl: WBSTemplate) => {
    setEditingTemplate(tpl);
    setTplName(tpl.name);
    setTplCategory(tpl.category);
    setTplDesc(tpl.description || '');
    setTplPayloadStr(JSON.stringify(tpl.payload, null, 2));
    setIsAddingTemplate(true);
  };

  return (
    <Page>
        <PageHeader
          eyebrow="Pengaturan"
          title="Master Data ERP"
          description="Kelola tarif role, worker, template WBS, klien, pengguna, profil penerbit dokumen, dan prompt AI Copilot."
        />

        {/* Tabs */}
        <div className="no-scrollbar -mx-1 mb-6 overflow-x-auto px-1">
          <div role="tablist" aria-label="Bagian master data" className="flex w-max min-w-full gap-1">
            {([
              { id: 'ROLES', label: 'Roles & Rates', icon: Briefcase, count: roles.length, on: () => {} },
              { id: 'WORKERS', label: 'Worker', icon: HardHat, count: workers.length, on: () => fetchWorkers() },
              { id: 'USERS', label: 'User', icon: UserCog, count: users.length, on: () => fetchUsers() },
              { id: 'TEMPLATES', label: 'Template WBS', icon: FileStack, count: templates.length, on: () => {} },
              { id: 'COMPANIES_CLIENT', label: 'Perusahaan klien', icon: Building2, count: clientCompanies.length, on: () => fetchClientCompanies() },
              { id: 'COMPANY_ISSUER', label: 'Profil & tanda tangan PDF', icon: Contact, count: undefined, on: () => fetchIssuerSettings() },
              { id: 'AI_PROMPT', label: 'AI Copilot prompt', icon: Bot, count: undefined, on: () => fetchIssuerSettings() },
            ] as { id: typeof activeTab; label: string; icon: LucideIcon; count?: number; on: () => void }[]).map((tab) => {
              const active = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => { setActiveTab(tab.id); tab.on(); setErrorMsg(null); setSuccessMsg(null); }}
                  className={cn(
                    'inline-flex h-10 shrink-0 items-center gap-2 border-0 rounded-none px-3.5 text-[13px] font-medium shadow-none transition-colors',
                    active ? 'bg-brand text-white shadow-none' : 'text-fg-3 hover:text-fg',
                  )}
                >
                  <Icon className={cn('size-4', active ? 'text-white' : 'text-fg-3')} aria-hidden />
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={cn('font-mono-numbers text-[11px]', active ? 'text-white' : 'text-fg-3')}>{tab.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div role="alert" className="mb-5 flex items-start justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] bg-[var(--color-danger-bg)] px-4 py-3 text-[13px] text-bad">
            <span className="flex items-start gap-2.5"><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{errorMsg}</span>
            <button type="button" onClick={() => setErrorMsg(null)} aria-label="Tutup pesan" className="btn-icon shrink-0 rounded-full hover:bg-[var(--row-hover)]"><X className="size-3.5" aria-hidden /></button>
          </div>
        )}
        {successMsg && (
          <div role="status" className="mb-5 flex items-start justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--color-success)_30%,transparent)] bg-[var(--color-success-bg)] px-4 py-3 text-[13px] text-ok">
            <span className="flex items-start gap-2.5"><CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />{successMsg}</span>
            <button type="button" onClick={() => setSuccessMsg(null)} aria-label="Tutup pesan" className="btn-icon shrink-0 rounded-full hover:bg-[var(--row-hover)]"><X className="size-3.5" aria-hidden /></button>
          </div>
        )}

        {activeTab === 'USERS' && <section className="linear-card" style={{ padding: 24 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}><h3>Manajemen User</h3><button className="btn-primary" onClick={() => setUserForm({ name: '', email: '', password: '', role: 'admin', is_active: true })}>+ Tambah User</button></div>{userForm && <form onSubmit={async e => { e.preventDefault(); const response = await fetch('/api/users', { method: userForm.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userForm) }); const result = await response.json(); if (!response.ok) { setErrorMsg(result.error); return; } setUserForm(null); fetchUsers(); }} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}><input className="linear-input" placeholder="Nama" required value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })}/><input className="linear-input" type="email" placeholder="Email" required value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })}/><input className="linear-input" type="password" placeholder={userForm.id ? 'Password baru (opsional)' : 'Password'} required={!userForm.id} value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })}/><select className="linear-input" value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}><option value="admin">admin</option><option value="staff">staff</option><option value="user">user</option></select>{userForm.id && <label><input type="checkbox" checked={userForm.is_active} onChange={e => setUserForm({ ...userForm, is_active: e.target.checked })}/> Aktif</label>}<button className="btn-primary">Simpan</button><button type="button" className="btn-secondary" onClick={() => setUserForm(null)}>Batal</button></form>}<div style={{ overflowX: 'auto' }}><table className="linear-table" style={{ width: '100%' }}><thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Status</th><th>Dibuat</th><th>Aksi</th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td>{user.role}</td><td>{user.is_active ? 'Aktif' : 'Nonaktif'}</td><td>{new Date(user.created_at).toLocaleDateString('id-ID')}</td><td><button className="btn-secondary" onClick={() => setUserForm({ ...user, password: '' })}>Edit</button> <button className="btn-secondary" disabled={user.id === currentUserId} onClick={async () => { if (!confirm(`Hapus user ${user.email}?`)) return; const r = await fetch(`/api/users?id=${user.id}`, { method: 'DELETE' }); const d = await r.json(); if (!r.ok) setErrorMsg(d.error); else fetchUsers(); }}>Hapus</button></td></tr>)}</tbody></table></div></section>}

        {/* TAB: MASTER WORKER */}
        {activeTab === 'WORKERS' && (
          <section className="linear-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Master Worker</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  Daftar orang beserta rate per jam. Tidak terhubung ke role: kode role dipilih saat costing. Estimasi lama tidak berubah karena menyimpan snapshot sendiri.
                </p>
              </div>
              {!workerForm && (
                <button type="button" className="btn-primary" style={{ fontSize: 12 }} onClick={() => setWorkerForm({ name: '', hourly_rate: '', is_active: true })}>+ Tambah Worker</button>
              )}
            </div>
            {workerForm && (
              <form onSubmit={handleSaveWorker} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18, alignItems: 'center' }}>
                <input className="linear-input" placeholder="Nama worker" required maxLength={100} value={workerForm.name} onChange={(e) => setWorkerForm({ ...workerForm, name: e.target.value })} style={{ minWidth: 240 }} />
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Rp</span>
                <input className="linear-input font-mono-numbers" type="number" min="0" required placeholder="Rate per jam" value={workerForm.hourly_rate} onChange={(e) => setWorkerForm({ ...workerForm, hourly_rate: e.target.value })} style={{ width: 160, textAlign: 'right' }} />
                {workerForm.id && (
                  <label style={{ fontSize: 12 }}><input type="checkbox" checked={workerForm.is_active} onChange={(e) => setWorkerForm({ ...workerForm, is_active: e.target.checked })} /> Aktif</label>
                )}
                <button className="btn-primary" disabled={savingWorker}>{savingWorker ? 'Menyimpan...' : 'Simpan'}</button>
                <button type="button" className="btn-secondary" onClick={() => setWorkerForm(null)}>Batal</button>
              </form>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table className="linear-table" style={{ width: '100%' }}>
                <thead><tr><th>Nama</th><th style={{ textAlign: 'right' }}>Rate / Jam</th><th>Status</th><th>Aksi</th></tr></thead>
                <tbody>
                  {workers.length === 0 && <tr><td colSpan={4} style={{ color: 'var(--text-tertiary)' }}>Belum ada worker.</td></tr>}
                  {workers.map((w) => (
                    <tr key={w.id}>
                      <td>{w.name}</td>
                      <td className="font-mono-numbers" style={{ textAlign: 'right' }}>{formatIDR(w.hourly_rate)}</td>
                      <td>{w.is_active ? 'Aktif' : 'Nonaktif'}</td>
                      <td>
                        <button type="button" className="btn-secondary" onClick={() => setWorkerForm({ id: w.id, name: w.name, hourly_rate: String(w.hourly_rate), is_active: w.is_active })}>Edit</button>{' '}
                        <button type="button" className="btn-secondary" onClick={async () => {
                          if (!confirm(`Hapus worker ${w.name}? Estimasi yang sudah ada tidak berubah.`)) return;
                          const r = await fetch(`/api/workers?id=${w.id}`, { method: 'DELETE' });
                          const d = await r.json();
                          if (!r.ok || !d.success) setErrorMsg(d.error || 'Gagal menghapus worker.'); else fetchWorkers();
                        }}>Hapus</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 1: MASTER ROLES */}
        {activeTab === 'ROLES' && (
          <div className="linear-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Daftar Master Role & Tarif Jam Kerja (Hourly Rate)
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  Perubahan tarif di sini otomatis menjadi default untuk estimasi baru tanpa merusak snapshot estimasi historis.
                </p>
              </div>
              {!isAddingRole && !editingRole && (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingRole(true);
                    setNewRoleCode('');
                    setNewRoleName('');
                    setNewRoleRate('');
                  }}
                  className="btn-primary"
                  style={{ fontSize: '12px' }}
                >
                  + Tambah Role Baru
                </button>
              )}
            </div>

            {/* Inline Add / Edit Role Form */}
            {(isAddingRole || editingRole) && (
              <form onSubmit={handleSaveRole} style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
                  {editingRole ? `Edit Role: ${editingRole.code}` : 'Tambah Master Role Baru'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>KODE ROLE (UNIK)</label>
                    <input
                      type="text"
                      disabled={!!editingRole}
                      value={editingRole ? editingRole.code : newRoleCode}
                      onChange={(e) => setNewRoleCode(e.target.value)}
                      placeholder="CONTOH: QA_ENG"
                      className="linear-input"
                      style={{ width: '100%', textTransform: 'uppercase' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>NAMA ROLE</label>
                    <input
                      type="text"
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      placeholder="Contoh: Quality Assurance"
                      className="linear-input"
                      style={{ width: '100%' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>HOURLY RATE (RP/JAM)</label>
                    <input
                      type="number"
                      value={newRoleRate}
                      onChange={(e) => setNewRoleRate(e.target.value)}
                      placeholder="45000"
                      className="linear-input font-mono-numbers"
                      style={{ width: '100%' }}
                      required
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => { setIsAddingRole(false); setEditingRole(null); }}
                    className="btn-secondary"
                    style={{ fontSize: '12px' }}
                  >
                    Batal
                  </button>
                  <button type="submit" className="btn-primary" style={{ fontSize: '12px' }}>
                    {editingRole ? 'Simpan Perubahan' : 'Tambahkan Role'}
                  </button>
                </div>
              </form>
            )}

            {/* Table of Roles */}
            <div style={{ overflowX: 'auto' }}>
              <table className="linear-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>ID</th>
                    <th style={{ width: '160px' }}>KODE ROLE</th>
                    <th>NAMA ROLE</th>
                    <th style={{ width: '200px', textAlign: 'right' }}>HOURLY RATE (2026)</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>STATUS</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingRoles ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)' }}>
                        Memuat data master role...
                      </td>
                    </tr>
                  ) : roles.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)' }}>
                        Belum ada role master.
                      </td>
                    </tr>
                  ) : (
                    roles.map((r) => (
                      <tr key={r.id}>
                        <td style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>#{r.id}</td>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent-hover)', background: 'rgb(var(--info-rgb) / 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                            {r.code}
                          </span>
                        </td>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{r.name}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-success)' }} className="font-mono-numbers">
                          {formatIDR(r.default_hourly_rate)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: r.is_active ? 'rgb(var(--success-rgb) / 0.15)' : 'var(--bg-card)', color: r.is_active ? 'var(--color-success)' : '#94a3b8' }}>
                            {r.is_active ? 'Aktif' : 'Non-Aktif'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRole(r);
                                setNewRoleName(r.name);
                                setNewRoleRate(r.default_hourly_rate);
                                setIsAddingRole(false);
                              }}
                              className="btn-secondary btn-icon"
                              title="Edit Role & Tarif"
                            >
                              <SquarePen style={{ width: "15px", height: "15px" }} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRole(r)}
                              className="btn-secondary btn-icon"
                              title="Hapus Role"
                            >
                              <Trash2 style={{ width: "15px", height: "15px", color: "var(--color-danger)" }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: MASTER TEMPLATES */}
        {activeTab === 'TEMPLATES' && (
          <div className="linear-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Katalog Master Template WBS Costing
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  Template per modul atau seksi WBS yang dapat di-inject langsung ke form kalkulasi costing.
                </p>
              </div>
              {!isAddingTemplate && (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingTemplate(true);
                    setEditingTemplate(null);
                    setTplName('');
                    setTplCategory('MAINTENANCE');
                    setTplDesc('');
                    setTplPayloadStr('[\n  {\n    "name": "Dev Ops (Manhour)",\n    "role_hours": {\n      "DEV_OPS": 1\n    }\n  }\n]');
                  }}
                  className="btn-primary"
                  style={{ fontSize: '12px' }}
                >
                  + Tambah Template WBS
                </button>
              )}
            </div>

            {/* Template Add / Edit Drawer / Form */}
            {isAddingTemplate && (
              <form onSubmit={handleSaveTemplate} style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>
                  {editingTemplate ? `Edit Template: ${editingTemplate.name}` : 'Buat Template WBS Baru'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>NAMA TEMPLATE *</label>
                    <input
                      type="text"
                      value={tplName}
                      onChange={(e) => setTplName(e.target.value)}
                      placeholder="Contoh: Website Retainer Standard"
                      className="linear-input"
                      style={{ width: '100%' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>KATEGORI WBS TARGET *</label>
                    <select
                      value={tplCategory}
                      onChange={(e) => setTplCategory(e.target.value as TemplateCategory)}
                      className="linear-input"
                      style={{ width: '100%' }}
                    >
                      <option value="MAINTENANCE">MAINTENANCE (Rutin Bulanan)</option>
                      <option value="DEVELOPMENT">DEVELOPMENT (Modul & Tasks)</option>
                      <option value="INFRASTRUCTURE">INFRASTRUCTURE (Hosting / Hardware)</option>
                      <option value="OPERATION">OPERATION (Akomodasi / Transport)</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>DESKRIPSI / CATATAN SKEMA</label>
                  <input
                    type="text"
                    value={tplDesc}
                    onChange={(e) => setTplDesc(e.target.value)}
                    placeholder="Contoh: Alokasi 4 jam devops dan 8 jam programmer per bulan..."
                    className="linear-input"
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>PAYLOAD STRUKTUR DATA (JSON) *</label>
                  <textarea
                    rows={8}
                    value={tplPayloadStr}
                    onChange={(e) => setTplPayloadStr(e.target.value)}
                    className="linear-input font-mono-numbers"
                    style={{ width: '100%', fontFamily: 'monospace', fontSize: '12px' }}
                    required
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', display: 'block' }}>
                    Format JSON array task/item yang akan otomatis disuntikkan ke tabel WBS target saat dipilih.
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => { setIsAddingTemplate(false); setEditingTemplate(null); }}
                    className="btn-secondary"
                    style={{ fontSize: '12px' }}
                  >
                    Batal
                  </button>
                  <button type="submit" className="btn-primary" style={{ fontSize: '12px' }}>
                    {editingTemplate ? 'Simpan Perubahan' : 'Simpan Template'}
                  </button>
                </div>
              </form>
            )}

            {/* Template List */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {loadingTemplates ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)', gridColumn: '1 / -1' }}>
                  Memuat master template...
                </div>
              ) : templates.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)', gridColumn: '1 / -1' }}>
                  Belum ada template WBS.
                </div>
              ) : (
                templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: tpl.category === 'MAINTENANCE' ? 'rgb(var(--info-rgb) / 0.15)' : 'rgb(var(--violet-rgb) / 0.15)', color: tpl.category === 'MAINTENANCE' ? 'var(--color-info)' : 'var(--color-violet)' }}>
                          {tpl.category}
                        </span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => startEditTemplate(tpl)}
                            className="btn-secondary btn-icon"
                            title="Edit Template"
                          >
                            <SquarePen style={{ width: "15px", height: "15px" }} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTemplate(tpl)}
                            className="btn-secondary btn-icon"
                            title="Hapus Template"
                          >
                            <Trash2 style={{ width: "15px", height: "15px", color: "var(--color-danger)" }} />
                          </button>
                        </div>
                      </div>
                      <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        {tpl.name}
                      </h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '10px' }}>
                        {tpl.description || 'Tidak ada deskripsi.'}
                      </p>
                    </div>

                    <div style={{ background: 'var(--bg-card)', padding: '8px 12px', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-tertiary)', overflowX: 'auto', maxHeight: '80px' }}>
                      {JSON.stringify(tpl.payload)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: PERUSAHAAN KLIEN */}
        {activeTab === 'COMPANIES_CLIENT' && (
          <div className="linear-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Master Perusahaan Klien
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  Kelola nama, kontak, dan alamat resmi perusahaan klien untuk invoice & proposal penawaran.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingClient(null);
                  setClientForm({ name: '', email: '', phone: '', address: '' });
                }}
                className="btn-primary"
                style={{ fontSize: '12.5px', padding: '6px 14px' }}
              >
                + Tambah Klien Baru
              </button>
            </div>

            {/* Form Tambah / Edit Klien */}
            <form onSubmit={handleSaveClient} style={{ background: 'var(--bg-surface)', padding: '18px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
                {editingClient ? `Edit Klien: ${editingClient.name}` : 'Tambah Perusahaan Klien Baru'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Nama Perusahaan Klien *</label>
                  <input
                    type="text"
                    required
                    className="linear-input"
                    placeholder="PT Klien Maju Bersama"
                    value={clientForm.name}
                    onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Email Kontak</label>
                  <input
                    type="email"
                    className="linear-input"
                    placeholder="procurement@klien.com"
                    value={clientForm.email}
                    onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Nomor Telepon</label>
                  <input
                    type="text"
                    className="linear-input"
                    placeholder="+62 21 555-1234"
                    value={clientForm.phone}
                    onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Alamat Resmi (Ditampilkan pada PDF Invoice & Proposal)</label>
                  <input
                    type="text"
                    className="linear-input"
                    placeholder="Gedung Cyber 2 Lantai 10, Jl. HR Rasuna Said, Jakarta Selatan"
                    value={clientForm.address}
                    onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                {editingClient && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingClient(null);
                      setClientForm({ name: '', email: '', phone: '', address: '' });
                    }}
                    className="btn-secondary"
                    style={{ fontSize: '12px', padding: '6px 14px' }}
                  >
                    Batal
                  </button>
                )}
                <button
                  type="submit"
                  disabled={savingClient}
                  className="btn-primary"
                  style={{ fontSize: '12px', padding: '6px 16px' }}
                >
                  {savingClient ? 'Menyimpan...' : (editingClient ? 'Perbarui Klien' : 'Simpan Klien')}
                </button>
              </div>
            </form>

            {/* Tabel Daftar Perusahaan Klien */}
            <div style={{ overflowX: 'auto' }}>
              <table className="pro-table">
                <thead>
                  <tr>
                    <th style={{ width: '220px', textAlign: 'left' }}>Nama Perusahaan</th>
                    <th style={{ textAlign: 'left' }}>Alamat Kantor</th>
                    <th style={{ width: '160px', textAlign: 'left' }}>Email Kontak</th>
                    <th style={{ width: '130px', textAlign: 'left' }}>Telepon</th>
                    <th style={{ width: '90px', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingClients ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-tertiary)' }}>Memuat data klien...</td></tr>
                  ) : clientCompanies.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-tertiary)' }}>Belum ada perusahaan klien terdaftar.</td></tr>
                  ) : (
                    clientCompanies.map((c) => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</td>
                        <td style={{ fontSize: '12px', color: c.address ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                          {c.address || '(Belum diset - gunakan tombol Edit)'}
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{c.email || '-'}</td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{c.phone || '-'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingClient(c);
                              setClientForm({
                                name: c.name || '',
                                email: c.email || '',
                                phone: c.phone || '',
                                address: c.address || '',
                              });
                            }}
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <SquarePen style={{ width: '13px', height: '13px' }} />
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: AI COPILOT SYSTEM PROMPT */}
        {activeTab === 'AI_PROMPT' && (
          <div className="linear-card" style={{ padding: '26px' }}>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>🤖</span>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Konfigurasi Initial Prompt Busdev AI Copilot
                </h3>
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-tertiary)', marginTop: '6px', lineHeight: 1.5 }}>
                Atur persona, instruksi dasar, dan arahan respons awal untuk AI Copilot Hermes di sistem Busdevcore.
                Perubahan prompt ini langsung berlaku secara dinamis pada sesi chat Copilot seluruh pengguna.
              </p>
            </div>

            {loadingIssuer || !issuerSettings ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                Memuat konfigurasi AI Prompt...
              </div>
            ) : (
              <form onSubmit={handleSaveIssuer}>
                <div style={{ marginBottom: '20px', background: 'var(--bg-surface)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      System Prompt & Instruksi Perilaku AI Copilot:
                    </label>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ fontSize: '11.5px', padding: '2px 8px' }}
                      onClick={() => {
                        setIssuerSettings({
                          ...issuerSettings,
                          ai_system_prompt: `Anda adalah Hermes AI Copilot terintegrasi untuk busdevcore (Sistem ERP Project Costing, Komersial & Penagihan PT Penta Code Digital).
Tugas Anda:
1. Membantu tim Business Development menyusun draft WBS, estimasi manhours, dan perhitungan biaya proyek.
2. Memberikan rekomendasi role tim teknis (PM, WEB_DEV, UI_UX, QC_DOCS, DEVOPS, FULL_DEV, MOB_DEV) dan alokasi jam yang realistis.
3. Menjelaskan status proposal penawaran, termin pembayaran, dan data invoice klien jika ditanyakan.
4. Memberikan insight analitik bisnis dan komersial secara profesional, ringkas, dan akurat.

ATURAN KEAMANAN MUTLAK:
- Anda TIDAK DIPERKENANKAN mengubah, menambah, atau menghapus Master Data (Role Master, Rate Card, User Master, Template WBS).
- Anda TIDAK DIPERKENANKAN memodifikasi atau menghapus catatan Audit Trail (Audit Logs).
- Seluruh tindakan berisiko tinggi wajib diarahkan ke pengguna untuk dilakukan secara manual melalui menu antarmuka sistem.`
                        });
                      }}
                    >
                      Reset ke Template Default
                    </button>
                  </div>

                  <textarea
                    rows={16}
                    className="linear-textarea"
                    placeholder="Ketik initial prompt atau panduan untuk AI Copilot..."
                    value={issuerSettings.ai_system_prompt || ''}
                    onChange={(e) => setIssuerSettings({ ...issuerSettings, ai_system_prompt: e.target.value })}
                    style={{
                      width: '100%',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12.5px',
                      lineHeight: '1.6',
                      padding: '14px',
                    }}
                  />

                  <div style={{ marginTop: '12px', padding: '12px 14px', borderRadius: '6px', background: 'rgb(var(--accent-rgb) / 0.08)', border: '1px solid rgb(var(--accent-rgb) / 0.25)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--accent-text)' }}>Catatan Keamanan:</strong> Meskipun prompt dapat disesuaikan, sistem tetap memproteksi database dengan <em>PostgreSQL Trigger Append-Only</em> pada Audit Log dan pembatasan level API controller untuk mencegah manipulasi data sensitif oleh instruksi chat AI.
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="submit"
                    disabled={savingIssuer}
                    className="btn-primary"
                    style={{ fontSize: '13px', padding: '9px 26px' }}
                  >
                    {savingIssuer ? 'Menyimpan Prompt...' : 'Simpan Perubahan AI System Prompt'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* TAB 5: PROFIL PERUSAHAAN & TANDA TANGAN (ISSUER SETTINGS) */}
        {activeTab === 'COMPANY_ISSUER' && (
          <div className="linear-card" style={{ padding: '24px' }}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Pengaturan Profil Perusahaan, Kop Surat, & Tanda Tangan PDF
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                Konfigurasi informasi resmi pengirim yang otomatis dicetak pada lembar Invoice, Surat Penawaran (Proposal), dan Dokumen Kontrak PDF.
              </p>
            </div>

            {loadingIssuer || !issuerSettings ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Memuat pengaturan profil...</div>
            ) : (
              <form onSubmit={handleSaveIssuer}>
                {/* Bagian 1: Identitas & Alamat Resmi */}
                <div style={{ marginBottom: '24px', background: 'var(--bg-surface)', padding: '18px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>
                    1. Identitas Badan Usaha & Alamat Pengirim Invoice
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Nama Resmi Perusahaan (Badan Usaha)</label>
                      <input
                        type="text"
                        required
                        className="linear-input"
                        value={issuerSettings.company_name || ''}
                        onChange={(e) => setIssuerSettings({ ...issuerSettings, company_name: e.target.value })}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Tagline / Bidang Layanan</label>
                      <input
                        type="text"
                        className="linear-input"
                        value={issuerSettings.tagline || ''}
                        onChange={(e) => setIssuerSettings({ ...issuerSettings, tagline: e.target.value })}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Alamat Kantor Resmi (Dicetak di Bagian Ditagihkan Oleh)</label>
                      <textarea
                        rows={2}
                        className="linear-textarea"
                        value={issuerSettings.address || ''}
                        onChange={(e) => setIssuerSettings({ ...issuerSettings, address: e.target.value })}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Email Finance / Kontak</label>
                      <input
                        type="email"
                        className="linear-input"
                        value={issuerSettings.email || ''}
                        onChange={(e) => setIssuerSettings({ ...issuerSettings, email: e.target.value })}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Website Resmi</label>
                      <input
                        type="text"
                        className="linear-input"
                        value={issuerSettings.website || ''}
                        onChange={(e) => setIssuerSettings({ ...issuerSettings, website: e.target.value })}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Bagian 2: Akun Rekening Bank Tujuan Transfer */}
                <div style={{ marginBottom: '24px', background: 'var(--bg-surface)', padding: '18px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>
                    2. Rekening Bank Penerima Pembayaran (Dicetak pada Instruksi Transfer)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Nama Bank</label>
                      <input
                        type="text"
                        className="linear-input"
                        value={issuerSettings.bank_name || ''}
                        onChange={(e) => setIssuerSettings({ ...issuerSettings, bank_name: e.target.value })}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Nomor Rekening</label>
                      <input
                        type="text"
                        className="linear-input font-mono"
                        value={issuerSettings.bank_account_number || ''}
                        onChange={(e) => setIssuerSettings({ ...issuerSettings, bank_account_number: e.target.value })}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Atas Nama Pemilik Rekening</label>
                      <input
                        type="text"
                        className="linear-input"
                        value={issuerSettings.bank_account_name || ''}
                        onChange={(e) => setIssuerSettings({ ...issuerSettings, bank_account_name: e.target.value })}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Bagian 3: Pejabat Penandatangan Dokumen (Signer) */}
                <div style={{ marginBottom: '24px', background: 'var(--bg-surface)', padding: '18px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>
                    3. Nama & Jabatan Pejabat Penandatangan Dokumen (Signature Block)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Nama Lengkap Penandatangan</label>
                      <input
                        type="text"
                        className="linear-input"
                        placeholder="Contoh: Muhammad Siddiq / Authorized Finance"
                        value={issuerSettings.signer_name || ''}
                        onChange={(e) => setIssuerSettings({ ...issuerSettings, signer_name: e.target.value })}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Jabatan / Role Penandatangan</label>
                      <input
                        type="text"
                        className="linear-input"
                        placeholder="Contoh: Direktur Utama / Finance & Accounting Lead"
                        value={issuerSettings.signer_role || ''}
                        onChange={(e) => setIssuerSettings({ ...issuerSettings, signer_role: e.target.value })}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="submit"
                    disabled={savingIssuer}
                    className="btn-primary"
                    style={{ fontSize: '13px', padding: '8px 24px' }}
                  >
                    {savingIssuer ? 'Menyimpan...' : 'Simpan Seluruh Pengaturan Profil'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
    </Page>
  );
}
