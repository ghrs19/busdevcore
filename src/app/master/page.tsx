'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

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
  category: string;
  description: string | null;
  payload: any;
  is_active: boolean;
  updated_at: string;
}

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<'ROLES' | 'TEMPLATES' | 'USERS'>('ROLES');
  const [users, setUsers] = useState<any[]>([]);
  const [userForm, setUserForm] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const fetchUsers = async () => { const [list, me] = await Promise.all([fetch('/api/users'), fetch('/api/auth/me')]); const data = await list.json(); const who = await me.json(); if (list.ok) setUsers(data.users); if (me.ok) setCurrentUserId(who.user.id); };

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

    let parsedPayload: any;
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
    setTplCategory(tpl.category as any);
    setTplDesc(tpl.description || '');
    setTplPayloadStr(JSON.stringify(tpl.payload, null, 2));
    setIsAddingTemplate(true);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)' }}>
      
      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 24px 80px 24px' }}>
        {/* Header Breadcrumb */}
        <div style={{ marginBottom: '24px' }}>
          <Link
            href="/"
            style={{
              fontSize: '13px',
              color: 'var(--text-tertiary)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '12px',
            }}
          >
            ← Kembali ke Dashboard
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Master Data ERP
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                Kelola master rate manhour tim IT dan katalog template WBS costing siap pakai
              </p>
            </div>

            {/* Segmented Tab */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(255, 255, 255, 0.04)',
                padding: '4px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                gap: '4px',
              }}
            >
              <button
                type="button"
                onClick={() => { setActiveTab('ROLES'); setErrorMsg(null); setSuccessMsg(null); }}
                className={activeTab === 'ROLES' ? 'btn-primary' : 'btn-ghost'}
                style={{ padding: '6px 16px', fontSize: '13px', borderRadius: '6px' }}
              >
                👥 Master Roles & Rates ({roles.length})
              </button>
              <button type="button" onClick={() => { setActiveTab('USERS'); fetchUsers(); }} className={activeTab === 'USERS' ? 'btn-primary' : 'btn-ghost'} style={{ padding: '6px 16px', fontSize: '13px', borderRadius: '6px' }}>👤 Manajemen User ({users.length})</button>
              <button
                type="button"
                onClick={() => { setActiveTab('TEMPLATES'); setErrorMsg(null); setSuccessMsg(null); }}
                className={activeTab === 'TEMPLATES' ? 'btn-primary' : 'btn-ghost'}
                style={{ padding: '6px 16px', fontSize: '13px', borderRadius: '6px' }}
              >
                📑 Master Template WBS ({templates.length})
              </button>
            </div>
          </div>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div style={{ padding: '12px 16px', marginBottom: '20px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>
          </div>
        )}
        {successMsg && (
          <div style={{ padding: '12px 16px', marginBottom: '20px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {activeTab === 'USERS' && <section className="linear-card" style={{ padding: 24 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}><h3>Manajemen User</h3><button className="btn-primary" onClick={() => setUserForm({ name: '', email: '', password: '', role: 'admin', is_active: true })}>+ Tambah User</button></div>{userForm && <form onSubmit={async e => { e.preventDefault(); const response = await fetch('/api/users', { method: userForm.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userForm) }); const result = await response.json(); if (!response.ok) { setErrorMsg(result.error); return; } setUserForm(null); fetchUsers(); }} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}><input className="linear-input" placeholder="Nama" required value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })}/><input className="linear-input" type="email" placeholder="Email" required value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })}/><input className="linear-input" type="password" placeholder={userForm.id ? 'Password baru (opsional)' : 'Password'} required={!userForm.id} value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })}/><select className="linear-input" value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}><option value="admin">admin</option><option value="user">user</option></select>{userForm.id && <label><input type="checkbox" checked={userForm.is_active} onChange={e => setUserForm({ ...userForm, is_active: e.target.checked })}/> Aktif</label>}<button className="btn-primary">Simpan</button><button type="button" className="btn-secondary" onClick={() => setUserForm(null)}>Batal</button></form>}<div style={{ overflowX: 'auto' }}><table className="linear-table" style={{ width: '100%' }}><thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Status</th><th>Dibuat</th><th>Aksi</th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td>{user.role}</td><td>{user.is_active ? 'Aktif' : 'Nonaktif'}</td><td>{new Date(user.created_at).toLocaleDateString('id-ID')}</td><td><button className="btn-secondary" onClick={() => setUserForm({ ...user, password: '' })}>Edit</button> <button className="btn-secondary" disabled={user.id === currentUserId} onClick={async () => { if (!confirm(`Hapus user ${user.email}?`)) return; const r = await fetch(`/api/users?id=${user.id}`, { method: 'DELETE' }); const d = await r.json(); if (!r.ok) setErrorMsg(d.error); else fetchUsers(); }}>Hapus</button></td></tr>)}</tbody></table></div></section>}

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
                          <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent-hover)', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                            {r.code}
                          </span>
                        </td>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{r.name}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#10b981' }} className="font-mono-numbers">
                          {formatIDR(r.default_hourly_rate)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: r.is_active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.2)', color: r.is_active ? '#10b981' : '#94a3b8' }}>
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
                              className="btn-secondary"
                              style={{ width: '30px', height: '30px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Edit Role & Tarif"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRole(r)}
                              className="btn-secondary"
                              style={{ width: '30px', height: '30px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}
                              title="Hapus Role"
                            >
                              🗑️
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
                      onChange={(e) => setTplCategory(e.target.value as any)}
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
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: tpl.category === 'MAINTENANCE' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(168, 85, 247, 0.15)', color: tpl.category === 'MAINTENANCE' ? '#38bdf8' : '#c084fc' }}>
                          {tpl.category}
                        </span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => startEditTemplate(tpl)}
                            className="btn-secondary"
                            style={{ width: '28px', height: '28px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Edit Template"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTemplate(tpl)}
                            className="btn-secondary"
                            style={{ width: '28px', height: '28px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}
                            title="Hapus Template"
                          >
                            🗑️
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

                    <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '8px 12px', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-tertiary)', overflowX: 'auto', maxHeight: '80px' }}>
                      {JSON.stringify(tpl.payload)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
