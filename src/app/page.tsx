'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  DEFAULT_ROLE_RATES,
  calculateTask,
  calculateModule,
  calculateEstimate,
  type RoleRateMap,
  type ModuleInput,
  type TaskInput,
} from '@/lib/costing';

interface Company {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

interface ServiceType {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
}

interface Category {
  id: number;
  service_type_id: number;
  code: string;
  name: string;
}

interface Tag {
  id: number;
  code: string;
  name: string;
  applies_to_category_code: string;
}

interface SavedEstimate {
  id: number;
  title: string;
  status: string;
  total_hours: string | number;
  total_cost: string | number;
  rate_snapshots: RoleRateMap;
  created_at: string;
  company_name: string;
  service_type_code: string;
  category_code: string;
  category_name: string;
  tag_code: string | null;
  tag_name: string | null;
  module_count: number;
  task_count: number;
}

export default function CostingDashboard() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [rates] = useState<RoleRateMap>(DEFAULT_ROLE_RATES);
  const [savedEstimates, setSavedEstimates] = useState<SavedEstimate[]>([]);

  // Form states
  const [title, setTitle] = useState('Djarum Urban - Microsite');
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>('');
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState<number | ''>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('');
  const [selectedTagId, setSelectedTagId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  // Register company modal/inline form
  const [isRegisteringCompany, setIsRegisteringCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyEmail, setNewCompanyEmail] = useState('');
  const [newCompanyPhone, setNewCompanyPhone] = useState('');
  const [newCompanyAddress, setNewCompanyAddress] = useState('');

  // Modules and tasks state
  const [modules, setModules] = useState<ModuleInput[]>([
    {
      name: '1.0 Coordination',
      tasks: [
        { name: 'Kickoff Project Meeting (1x)', hours_pm: 2, hours_web_dev: 2, hours_ui_ux: 2, hours_qc_doc: 0, hours_dev_ops: 0 },
        { name: 'Client Meeting (2x)', hours_pm: 4, hours_web_dev: 4, hours_ui_ux: 4, hours_qc_doc: 0, hours_dev_ops: 0 },
      ],
    },
    {
      name: '2.0 Scrum',
      tasks: [
        { name: 'Scrum Definition', hours_pm: 2, hours_web_dev: 0, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
        { name: 'Scrum Monitoring', hours_pm: 2, hours_web_dev: 0, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
      ],
    },
  ]);

  // Loading & error feedback
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [inspectEstimate, setInspectEstimate] = useState<SavedEstimate | null>(null);

  // Load initial data
  const loadMetadata = async () => {
    try {
      const res = await fetch('/api/metadata');
      const data = await res.json();
      if (data.success) {
        setServiceTypes(data.serviceTypes);
        setCategories(data.categories);
        setTags(data.tags);

        // Pre-select IT & Development
        const it = data.serviceTypes.find((s: ServiceType) => s.code === 'IT');
        if (it) setSelectedServiceTypeId(it.id);

        const dev = data.categories.find((c: Category) => c.code === 'DEVELOPMENT');
        if (dev) setSelectedCategoryId(dev.id);

        const initialTag = data.tags.find((t: Tag) => t.code === 'INITIAL');
        if (initialTag) setSelectedTagId(initialTag.id);
      }
    } catch (e) {
      console.error('Failed to load metadata', e);
    }
  };

  const loadCompanies = async () => {
    try {
      const res = await fetch('/api/companies');
      const data = await res.json();
      if (data.success) {
        setCompanies(data.companies);
        if (data.companies.length > 0 && selectedCompanyId === '') {
          setSelectedCompanyId(data.companies[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load companies', e);
    }
  };

  const loadEstimates = async () => {
    try {
      const res = await fetch('/api/estimates');
      const data = await res.json();
      if (data.success) {
        setSavedEstimates(data.estimates);
      }
    } catch (e) {
      console.error('Failed to load estimates', e);
    }
  };

  useEffect(() => {
    loadMetadata();
    loadCompanies();
    loadEstimates();
  }, []);

  const selectedCategory = categories.find((c) => c.id === Number(selectedCategoryId));
  const isDevelopment = selectedCategory?.code === 'DEVELOPMENT';
  const isMaintenance = selectedCategory?.code === 'MAINTENANCE';

  // Enforce rule: If Maintenance, clear tag
  useEffect(() => {
    if (isMaintenance) {
      setSelectedTagId('');
    } else if (isDevelopment && selectedTagId === '' && tags.length > 0) {
      const init = tags.find((t) => t.code === 'INITIAL');
      if (init) setSelectedTagId(init.id);
    }
  }, [selectedCategoryId, isMaintenance, isDevelopment, tags]);

  // Live calculation preview
  const preview = useMemo(() => {
    try {
      const calcModules = modules.map((m) => calculateModule(m, rates));
      const hours_by_role = {
        pm: calcModules.reduce((acc, m) => acc + m.hours_breakdown.pm, 0),
        web_dev: calcModules.reduce((acc, m) => acc + m.hours_breakdown.web_dev, 0),
        ui_ux: calcModules.reduce((acc, m) => acc + m.hours_breakdown.ui_ux, 0),
        qc_doc: calcModules.reduce((acc, m) => acc + m.hours_breakdown.qc_doc, 0),
        dev_ops: calcModules.reduce((acc, m) => acc + m.hours_breakdown.dev_ops, 0),
      };
      const cost_by_role = {
        pm: calcModules.reduce((acc, m) => acc + m.cost_breakdown.pm, 0),
        web_dev: calcModules.reduce((acc, m) => acc + m.cost_breakdown.web_dev, 0),
        ui_ux: calcModules.reduce((acc, m) => acc + m.cost_breakdown.ui_ux, 0),
        qc_doc: calcModules.reduce((acc, m) => acc + m.cost_breakdown.qc_doc, 0),
        dev_ops: calcModules.reduce((acc, m) => acc + m.cost_breakdown.dev_ops, 0),
      };
      const total_hours = Object.values(hours_by_role).reduce((a, b) => a + b, 0);
      const total_cost = Object.values(cost_by_role).reduce((a, b) => a + b, 0);

      return {
        calcModules,
        hours_by_role,
        cost_by_role,
        total_hours,
        total_cost,
        error: null,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Calculation error';
      return {
        calcModules: [],
        hours_by_role: { pm: 0, web_dev: 0, ui_ux: 0, qc_doc: 0, dev_ops: 0 },
        cost_by_role: { pm: 0, web_dev: 0, ui_ux: 0, qc_doc: 0, dev_ops: 0 },
        total_hours: 0,
        total_cost: 0,
        error: msg,
      };
    }
  }, [modules, rates]);

  // Handle register company
  const handleRegisterCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCompanyName.trim(),
          email: newCompanyEmail.trim() || null,
          phone: newCompanyPhone.trim() || null,
          address: newCompanyAddress.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCompanies((prev) => [...prev, data.company]);
        setSelectedCompanyId(data.company.id);
        setIsRegisteringCompany(false);
        setNewCompanyName('');
        setNewCompanyEmail('');
        setNewCompanyPhone('');
        setNewCompanyAddress('');
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Gagal mendaftarkan perusahaan');
    }
  };

  // Module & Task handlers
  const addModule = () => {
    const nextIdx = modules.length + 1;
    setModules([...modules, { name: `${nextIdx}.0 Module Baru`, tasks: [{ name: 'Task 1', hours_pm: 0, hours_web_dev: 0, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 }] }]);
  };

  const removeModule = (mIdx: number) => {
    setModules(modules.filter((_, idx) => idx !== mIdx));
  };

  const updateModuleName = (mIdx: number, val: string) => {
    const next = [...modules];
    next[mIdx].name = val;
    setModules(next);
  };

  const addTask = (mIdx: number) => {
    const next = [...modules];
    next[mIdx].tasks.push({ name: 'Task Baru', hours_pm: 0, hours_web_dev: 0, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 });
    setModules(next);
  };

  const removeTask = (mIdx: number, tIdx: number) => {
    const next = [...modules];
    next[mIdx].tasks = next[mIdx].tasks.filter((_, idx) => idx !== tIdx);
    setModules(next);
  };

  const updateTaskField = (mIdx: number, tIdx: number, field: keyof TaskInput, val: string | number) => {
    const next = [...modules];
    const task = { ...next[mIdx].tasks[tIdx] };
    if (field === 'name') {
      task.name = String(val);
    } else {
      task[field] = Number(val) || 0;
    }
    next[mIdx].tasks[tIdx] = task;
    setModules(next);
  };

  // Load exact spreadsheet template
  const loadSpreadsheetExample = () => {
    setTitle('Djarum Urban - Microsite MVP');
    // Find Djarum company or first
    const djarum = companies.find((c) => c.name.toLowerCase().includes('djarum'));
    if (djarum) setSelectedCompanyId(djarum.id);

    const dev = categories.find((c) => c.code === 'DEVELOPMENT');
    if (dev) setSelectedCategoryId(dev.id);

    const init = tags.find((t) => t.code === 'INITIAL');
    if (init) setSelectedTagId(init.id);

    setModules([
      {
        name: '1.0 Coordination',
        tasks: [
          { name: 'Kickoff Project Meeting (1x)', hours_pm: 2, hours_web_dev: 2, hours_ui_ux: 2, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Client Meeting (2x)', hours_pm: 4, hours_web_dev: 4, hours_ui_ux: 4, hours_qc_doc: 0, hours_dev_ops: 0 },
        ],
      },
      {
        name: '2.0 Scrum',
        tasks: [
          { name: 'Scrum Definition', hours_pm: 2, hours_web_dev: 0, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Scrum Monitoring', hours_pm: 2, hours_web_dev: 0, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
        ],
      },
      {
        name: '3.0 Backend',
        tasks: [
          { name: 'Project Setup & Model Definition', hours_pm: 0, hours_web_dev: 4, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
        ],
      },
      {
        name: '4.0 Frontend',
        tasks: [
          { name: 'Registration Flow', hours_pm: 4, hours_web_dev: 4, hours_ui_ux: 4, hours_qc_doc: 8, hours_dev_ops: 0 },
          { name: 'Mini Games Activation', hours_pm: 0, hours_web_dev: 24, hours_ui_ux: 16, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Voucher/Coupon Flow', hours_pm: 0, hours_web_dev: 8, hours_ui_ux: 4, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Redeem Flow', hours_pm: 0, hours_web_dev: 8, hours_ui_ux: 4, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Profile', hours_pm: 0, hours_web_dev: 4, hours_ui_ux: 4, hours_qc_doc: 0, hours_dev_ops: 0 },
        ],
      },
      {
        name: '5.0 Backend',
        tasks: [
          { name: 'User Management', hours_pm: 4, hours_web_dev: 4, hours_ui_ux: 0, hours_qc_doc: 8, hours_dev_ops: 0 },
          { name: 'Outlet Management', hours_pm: 0, hours_web_dev: 4, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Voucher/Coupon Management', hours_pm: 0, hours_web_dev: 8, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Redeem Management', hours_pm: 0, hours_web_dev: 8, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Dashboard & Reporting', hours_pm: 0, hours_web_dev: 4, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
        ],
      },
      {
        name: '6.0 Configuration',
        tasks: [
          { name: 'Domain Setup', hours_pm: 0, hours_web_dev: 0, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 2 },
          { name: 'Facebook Pixel Setup', hours_pm: 0, hours_web_dev: 2, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Mail SMTP Setup', hours_pm: 0, hours_web_dev: 0, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 2 },
          { name: 'Installation Security Module', hours_pm: 0, hours_web_dev: 2, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
        ],
      },
      {
        name: '7.0 Coordination',
        tasks: [
          { name: 'Preview Project Meeting', hours_pm: 2, hours_web_dev: 2, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 2 },
          { name: 'Feedback Meeting', hours_pm: 4, hours_web_dev: 2, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 4 },
        ],
      },
      {
        name: '8.0 Content',
        tasks: [
          { name: 'Upload Content', hours_pm: 0, hours_web_dev: 8, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
        ],
      },
      {
        name: '9.0 Testing & Production',
        tasks: [
          { name: 'Final Testing & Training', hours_pm: 0, hours_web_dev: 0, hours_ui_ux: 0, hours_qc_doc: 8, hours_dev_ops: 0 },
          { name: 'Deployment', hours_pm: 0, hours_web_dev: 4, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Scrum Monitoring', hours_pm: 2, hours_web_dev: 0, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
        ],
      },
    ]);
  };

  // Load Maintenance example
  const loadMaintenanceExample = () => {
    setTitle('Website Maintenance 2026');
    const maint = categories.find((c) => c.code === 'MAINTENANCE');
    if (maint) setSelectedCategoryId(maint.id);
    setSelectedTagId('');

    setModules([
      {
        name: 'Monthly Maintenance',
        tasks: [
          { name: 'Dev Ops (Manhour)', hours_pm: 0, hours_web_dev: 0, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 4 },
          { name: 'Web Programmer (Manhour)', hours_pm: 0, hours_web_dev: 8, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
        ],
      },
    ]);
  };

  // Submit and save estimate
  const handleSaveEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedCompanyId) {
      setErrorMsg('Perusahaan wajib dipilih.');
      return;
    }
    if (!selectedServiceTypeId) {
      setErrorMsg('Service Type wajib dipilih.');
      return;
    }
    if (!selectedCategoryId) {
      setErrorMsg('Kategori wajib dipilih.');
      return;
    }

    if (isDevelopment && !selectedTagId) {
      setErrorMsg("Kategori 'Development' wajib memilih Tag: Initial atau CR.");
      return;
    }

    if (isMaintenance && selectedTagId) {
      setErrorMsg("Kategori 'Maintenance' tidak boleh memiliki Tag.");
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        title: title.trim(),
        company_id: Number(selectedCompanyId),
        service_type_id: Number(selectedServiceTypeId),
        category_id: Number(selectedCategoryId),
        tag_id: selectedTagId ? Number(selectedTagId) : null,
        notes: notes.trim() || null,
        custom_rates: rates,
        modules,
      };

      const res = await fetch('/api/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Gagal menyimpan estimate.');
      } else {
        setSuccessMsg(`Berhasil menyimpan estimate ID #${data.estimate.id} (${data.estimate.total_hours} Jam, Rp ${Number(data.estimate.total_cost).toLocaleString('id-ID')})`);
        loadEstimates();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{ marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a' }}>
          ERP Project Costing MVP
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>
          Busdevcore IT Development & Maintenance Project Costing Calculator
        </p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button
            type="button"
            onClick={loadSpreadsheetExample}
            style={{ padding: '6px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
          >
            Load Spreadsheet Djarum Example (204 Jam, Rp 7.717.782)
          </button>
          <button
            type="button"
            onClick={loadMaintenanceExample}
            style={{ padding: '6px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
          >
            Load Maintenance Example (12 Jam, Rp 491.856)
          </button>
        </div>
      </header>

      {/* Notifications */}
      {errorMsg && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #f87171', color: '#991b1b', borderRadius: '6px', marginBottom: '16px' }}>
          <strong>Error:</strong> {errorMsg}
        </div>
      )}
      {successMsg && (
        <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #4ade80', color: '#166534', borderRadius: '6px', marginBottom: '16px' }}>
          <strong>Sukses:</strong> {successMsg}
        </div>
      )}

      {/* Main Grid: Form Left, Preview Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
        {/* Left: Input Form */}
        <div>
          <form onSubmit={handleSaveEstimate}>
            {/* Step 1: Project & Company Info */}
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1e293b' }}>
                1. Project & Perusahaan
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Judul Project</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '13px', fontWeight: '500' }}>Perusahaan</label>
                    <button
                      type="button"
                      onClick={() => setIsRegisteringCompany(!isRegisteringCompany)}
                      style={{ fontSize: '12px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      {isRegisteringCompany ? 'Pilih Existing' : '+ Register Baru'}
                    </button>
                  </div>
                  {!isRegisteringCompany ? (
                    <select
                      value={selectedCompanyId}
                      onChange={(e) => setSelectedCompanyId(e.target.value ? Number(e.target.value) : '')}
                      required
                      style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                    >
                      <option value="">-- Pilih Perusahaan --</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ background: '#ffffff', padding: '8px', border: '1px solid #93c5fd', borderRadius: '4px' }}>
                      <input
                        type="text"
                        placeholder="Nama Perusahaan Baru *"
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        style={{ width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px', marginBottom: '6px', fontSize: '13px' }}
                      />
                      <input
                        type="email"
                        placeholder="Email (Opsional)"
                        value={newCompanyEmail}
                        onChange={(e) => setNewCompanyEmail(e.target.value)}
                        style={{ width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px', marginBottom: '6px', fontSize: '13px' }}
                      />
                      <button
                        type="button"
                        onClick={handleRegisterCompany}
                        style={{ padding: '4px 8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        Simpan Perusahaan
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Step 2, 3, 4: Classification (ServiceType, Category, Tag) */}
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1e293b' }}>
                2. Klasifikasi Jasa & Rules
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                {/* Service Type */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Service Type</label>
                  <select
                    value={selectedServiceTypeId}
                    onChange={(e) => setSelectedServiceTypeId(e.target.value ? Number(e.target.value) : '')}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  >
                    {serviceTypes.map((st) => (
                      <option key={st.id} value={st.id} disabled={!st.is_active}>
                        {st.name} {st.code === 'DIGITAL' ? '(Reserved)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Kategori (IT)</label>
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : '')}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Tag (Conditional) */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>
                    Tag {isDevelopment ? <span style={{ color: '#dc2626' }}>* (Wajib)</span> : <span style={{ color: '#64748b' }}>(N/A)</span>}
                  </label>
                  {isDevelopment ? (
                    <select
                      value={selectedTagId}
                      onChange={(e) => setSelectedTagId(e.target.value ? Number(e.target.value) : '')}
                      required
                      style={{ width: '100%', padding: '8px', border: '1px solid #3b82f6', borderRadius: '4px', background: '#eff6ff' }}
                    >
                      <option value="">-- Pilih Tag --</option>
                      {tags.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ padding: '8px', background: '#e2e8f0', borderRadius: '4px', fontSize: '13px', color: '#64748b' }}>
                      Tidak berlaku untuk Maintenance
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Step 5: Master Rates Snapshot Info */}
            <div style={{ background: '#f1f5f9', padding: '12px 16px', borderRadius: '6px', marginBottom: '20px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ color: '#334155' }}>Hourly Rate Snapshot Default: </strong>
                PM: Rp {rates.PM.toLocaleString('id-ID')} | WEB DEV: Rp {rates.WEB_DEV.toLocaleString('id-ID')} | UI-UX: Rp {rates.UI_UX.toLocaleString('id-ID')} | QC: Rp {rates.QC_DOC.toLocaleString('id-ID')} | DEV OPS: Rp {rates.DEV_OPS.toLocaleString('id-ID')}
              </div>
            </div>

            {/* Step 6: Modules & Tasks */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                  3. Input Modules & Manhour per Role
                </h2>
                <button
                  type="button"
                  onClick={addModule}
                  style={{ padding: '6px 12px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '13px', cursor: 'pointer' }}
                >
                  + Tambah Module
                </button>
              </div>

              {modules.map((mod, mIdx) => {
                const calcMod = preview.calcModules[mIdx];
                return (
                  <div key={mIdx} style={{ border: '1px solid #cbd5e1', borderRadius: '8px', marginBottom: '16px', overflow: 'hidden', background: '#fff' }}>
                    {/* Module Header */}
                    <div style={{ background: '#f8fafc', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
                      <input
                        type="text"
                        value={mod.name}
                        onChange={(e) => updateModuleName(mIdx, e.target.value)}
                        style={{ fontWeight: '600', fontSize: '14px', border: 'none', background: 'transparent', outline: 'none', width: '350px' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {calcMod && (
                          <span style={{ fontSize: '13px', color: '#0f766e', fontWeight: '500' }}>
                            Subtotal: {calcMod.total_hours} Jam (Rp {calcMod.total_cost.toLocaleString('id-ID')})
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => addTask(mIdx)}
                          style={{ padding: '4px 8px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                        >
                          + Task
                        </button>
                        {modules.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeModule(mIdx)}
                            style={{ padding: '4px 8px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                          >
                            Hapus Module
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Tasks Table */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                          <th style={{ padding: '8px 12px', width: '25%' }}>Feature / Task</th>
                          <th style={{ padding: '8px 4px', width: '10%', textAlign: 'center' }}>PM (h)</th>
                          <th style={{ padding: '8px 4px', width: '10%', textAlign: 'center' }}>WEB DEV (h)</th>
                          <th style={{ padding: '8px 4px', width: '10%', textAlign: 'center' }}>UI-UX (h)</th>
                          <th style={{ padding: '8px 4px', width: '10%', textAlign: 'center' }}>QC (h)</th>
                          <th style={{ padding: '8px 4px', width: '10%', textAlign: 'center' }}>DEV OPS (h)</th>
                          <th style={{ padding: '8px 8px', width: '15%', textAlign: 'right' }}>Cost</th>
                          <th style={{ padding: '8px 4px', width: '5%', textAlign: 'center' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {mod.tasks.map((task, tIdx) => {
                          const calcTask = calcMod?.tasks[tIdx];
                          return (
                            <tr key={tIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '6px 12px' }}>
                                <input
                                  type="text"
                                  value={task.name}
                                  onChange={(e) => updateTaskField(mIdx, tIdx, 'name', e.target.value)}
                                  placeholder="Nama task / fitur..."
                                  style={{ width: '100%', padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                                />
                              </td>
                              <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={task.hours_pm || ''}
                                  onChange={(e) => updateTaskField(mIdx, tIdx, 'hours_pm', e.target.value)}
                                  style={{ width: '55px', padding: '4px', textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                                />
                              </td>
                              <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={task.hours_web_dev || ''}
                                  onChange={(e) => updateTaskField(mIdx, tIdx, 'hours_web_dev', e.target.value)}
                                  style={{ width: '55px', padding: '4px', textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                                />
                              </td>
                              <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={task.hours_ui_ux || ''}
                                  onChange={(e) => updateTaskField(mIdx, tIdx, 'hours_ui_ux', e.target.value)}
                                  style={{ width: '55px', padding: '4px', textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                                />
                              </td>
                              <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={task.hours_qc_doc || ''}
                                  onChange={(e) => updateTaskField(mIdx, tIdx, 'hours_qc_doc', e.target.value)}
                                  style={{ width: '55px', padding: '4px', textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                                />
                              </td>
                              <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={task.hours_dev_ops || ''}
                                  onChange={(e) => updateTaskField(mIdx, tIdx, 'hours_dev_ops', e.target.value)}
                                  style={{ width: '55px', padding: '4px', textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                                />
                              </td>
                              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '500' }}>
                                Rp {(calcTask?.total_cost || 0).toLocaleString('id-ID')}
                              </td>
                              <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                                {mod.tasks.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeTask(mIdx, tIdx)}
                                    style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                                  >
                                    ×
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Catatan / Scope of Work</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan tambahan estimasi..."
                rows={2}
                style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                background: isLoading ? '#94a3b8' : '#1d4ed8',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '600',
                fontSize: '15px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading ? 'Menyimpan...' : 'Simpan Project Estimate'}
            </button>
          </form>
        </div>

        {/* Right: Live Preview Panel */}
        <div style={{ position: 'sticky', top: '20px' }}>
          <div style={{ background: '#0f172a', color: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
              Preview Kalkulasi
            </h3>

            {/* Grand Total */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Biaya</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#38bdf8' }}>
                Rp {preview.total_cost.toLocaleString('id-ID')}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Manhour</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f8fafc' }}>
                {preview.total_hours} Jam
              </div>
            </div>

            {/* Role Hours & Cost Breakdown */}
            <div style={{ borderTop: '1px solid #334155', paddingTop: '12px', marginTop: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#cbd5e1' }}>Breakdown per Role:</div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span>PM ({preview.hours_by_role.pm}h)</span>
                <span>Rp {preview.cost_by_role.pm.toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span>WEB DEV ({preview.hours_by_role.web_dev}h)</span>
                <span>Rp {preview.cost_by_role.web_dev.toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span>UI-UX ({preview.hours_by_role.ui_ux}h)</span>
                <span>Rp {preview.cost_by_role.ui_ux.toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span>QC & DOC ({preview.hours_by_role.qc_doc}h)</span>
                <span>Rp {preview.cost_by_role.qc_doc.toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span>DEV OPS ({preview.hours_by_role.dev_ops}h)</span>
                <span>Rp {preview.cost_by_role.dev_ops.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #334155', paddingTop: '12px', marginTop: '12px', fontSize: '12px', color: '#94a3b8' }}>
              <div>Kategori: {selectedCategory?.name || '-'}</div>
              <div>Tag: {isDevelopment ? (tags.find(t => t.id === Number(selectedTagId))?.name || '-') : 'None (Maintenance)'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Saved Estimates List */}
      <section style={{ marginTop: '48px', borderTop: '2px solid #e2e8f0', paddingTop: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#0f172a' }}>
          Daftar Project Estimate Tersimpan
        </h2>
        {savedEstimates.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '14px' }}>Belum ada estimate tersimpan.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '10px 12px' }}>ID</th>
                  <th style={{ padding: '10px 12px' }}>Judul</th>
                  <th style={{ padding: '10px 12px' }}>Perusahaan</th>
                  <th style={{ padding: '10px 12px' }}>Kategori</th>
                  <th style={{ padding: '10px 12px' }}>Tag</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Jam</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Biaya</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Snapshot Rates</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {savedEstimates.map((est) => (
                  <tr key={est.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '500' }}>#{est.id}</td>
                    <td style={{ padding: '10px 12px', fontWeight: '600' }}>{est.title}</td>
                    <td style={{ padding: '10px 12px' }}>{est.company_name}</td>
                    <td style={{ padding: '10px 12px' }}>{est.category_name}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {est.tag_name ? (
                        <span style={{ padding: '2px 6px', background: '#dbeafe', color: '#1e40af', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }}>
                          {est.tag_name}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '11px' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{Number(est.total_hours)}h</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: '#0f766e' }}>
                      Rp {Number(est.total_cost).toLocaleString('id-ID')}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
                      PM: {est.rate_snapshots?.PM} | DEV: {est.rate_snapshots?.WEB_DEV}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ padding: '2px 8px', background: '#fef3c7', color: '#92400e', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>
                        {est.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
