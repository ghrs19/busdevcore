'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DEFAULT_ROLE_RATES,
  calculateModule,
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

const formatIDR = (val: number | string) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return `Rp ${(num || 0).toLocaleString('id-ID')}`;
};

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

  // Rate config collapse state
  const [isRateExpanded, setIsRateExpanded] = useState(false);

  // Register company modal/expander
  const [isRegisteringCompany, setIsRegisteringCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyEmail, setNewCompanyEmail] = useState('');
  const [newCompanyPhone, setNewCompanyPhone] = useState('');
  const [newCompanyAddress, setNewCompanyAddress] = useState('');

  // Selected estimate modal
  const [inspectEstimate, setInspectEstimate] = useState<SavedEstimate | null>(null);

  // Modules & tasks
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

  // Loading & feedback
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load initial data
  const loadMetadata = useCallback(async () => {
    try {
      const res = await fetch('/api/metadata');
      const data = await res.json();
      if (data.success) {
        setServiceTypes(data.serviceTypes);
        setCategories(data.categories);
        setTags(data.tags);

        const it = data.serviceTypes.find((s: ServiceType) => s.code === 'IT');
        if (it) setSelectedServiceTypeId(it.id);

        const dev = data.categories.find((c: Category) => c.code === 'DEVELOPMENT');
        if (dev) setSelectedCategoryId(dev.id);

        const initialTag = data.tags.find((t: Tag) => t.code === 'INITIAL');
        if (initialTag) setSelectedTagId(initialTag.id);
      }
    } catch {
      setErrorMsg('Failed to load metadata');
    }
  }, []);

  const loadCompanies = useCallback(async () => {
    try {
      const res = await fetch('/api/companies');
      const data = await res.json();
      if (data.success) {
        setCompanies(data.companies);
        if (data.companies.length > 0) {
          setSelectedCompanyId((prev) => (prev === '' ? data.companies[0].id : prev));
        }
      }
    } catch {
      setErrorMsg('Failed to load companies');
    }
  }, []);

  const loadEstimates = useCallback(async () => {
    try {
      const res = await fetch('/api/estimates');
      const data = await res.json();
      if (data.success) {
        setSavedEstimates(data.estimates);
      }
    } catch {
      setErrorMsg('Failed to load estimates');
    }
  }, []);

  useEffect(() => {
    loadMetadata();
    loadCompanies();
    loadEstimates();
  }, [loadMetadata, loadCompanies, loadEstimates]);

  const selectedCategory = categories.find((c) => c.id === Number(selectedCategoryId));
  const isDevelopment = selectedCategory?.code === 'DEVELOPMENT';
  const isMaintenance = selectedCategory?.code === 'MAINTENANCE';

  useEffect(() => {
    if (isMaintenance) {
      setSelectedTagId('');
    } else if (isDevelopment && selectedTagId === '' && tags.length > 0) {
      const init = tags.find((t) => t.code === 'INITIAL');
      if (init) setSelectedTagId(init.id);
    }
  }, [selectedCategoryId, isMaintenance, isDevelopment, tags, selectedTagId]);

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
      };
    } catch {
      return {
        calcModules: [],
        hours_by_role: { pm: 0, web_dev: 0, ui_ux: 0, qc_doc: 0, dev_ops: 0 },
        cost_by_role: { pm: 0, web_dev: 0, ui_ux: 0, qc_doc: 0, dev_ops: 0 },
        total_hours: 0,
        total_cost: 0,
      };
    }
  }, [modules, rates]);

  const totalModuleCount = modules.length;
  const totalTaskCount = useMemo(
    () => modules.reduce((acc, m) => acc + m.tasks.length, 0),
    [modules]
  );

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
        alert(data.error || 'Failed to save company');
      }
    } catch {
      alert('Error registering company');
    }
  };

  // Module & Task handlers
  const addModule = () => {
    const nextIdx = modules.length + 1;
    setModules([
      ...modules,
      {
        name: `${nextIdx}.0 Module Baru`,
        tasks: [
          { name: 'Task 1', hours_pm: 0, hours_web_dev: 0, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
        ],
      },
    ]);
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
    next[mIdx].tasks.push({
      name: 'Task Baru',
      hours_pm: 0,
      hours_web_dev: 0,
      hours_ui_ux: 0,
      hours_qc_doc: 0,
      hours_dev_ops: 0,
    });
    setModules(next);
  };

  const removeTask = (mIdx: number, tIdx: number) => {
    const next = [...modules];
    next[mIdx].tasks = next[mIdx].tasks.filter((_, idx) => idx !== tIdx);
    setModules(next);
  };

  const updateTaskField = (
    mIdx: number,
    tIdx: number,
    field: keyof TaskInput,
    val: string | number
  ) => {
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

  // Spreadsheet template loader
  const loadSpreadsheetExample = () => {
    setTitle('Djarum Urban - Microsite MVP');
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
        setSuccessMsg(
          `Berhasil menyimpan estimate ID #${data.estimate.id} (${data.estimate.total_hours} Jam, ${formatIDR(
            data.estimate.total_cost
          )})`
        );
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
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)' }}>
      {/* Sticky Top Navigation / Header */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'rgba(8, 9, 10, 0.85)',
          backdropFilter: 'blur(12px)',
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
          }}
        >
          {/* Logo & Subtitle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
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
                color: '#fff',
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
                    fontSize: '11px',
                    color: 'var(--text-tertiary)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  ERP
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.2 }}>
                Project Costing ERP
              </p>
            </div>
          </div>

          {/* Live Badges & Quick Demos */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
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

            <div
              style={{
                height: '16px',
                width: '1px',
                background: 'var(--border-subtle)',
                margin: '0 4px',
              }}
            />

            <button
              type="button"
              onClick={loadSpreadsheetExample}
              className="btn-secondary"
              title="204 Manhours, Rp 7.717.782"
            >
              Load Djarum Demo
            </button>
            <button
              type="button"
              onClick={loadMaintenanceExample}
              className="btn-secondary"
              title="12 Manhours, Rp 491.856"
            >
              Load Maintenance Demo
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main style={{ maxWidth: '1360px', margin: '0 auto', padding: '24px 24px 64px' }}>
        {/* Notifications */}
        {errorMsg && (
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#fca5a5',
              fontSize: '13px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>
              <strong style={{ color: '#ef4444' }}>Error:</strong> {errorMsg}
            </span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="btn-ghost"
              style={{ color: '#fca5a5' }}
            >
              ✕
            </button>
          </div>
        )}
        {successMsg && (
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              color: '#6ee7b7',
              fontSize: '13px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>
              <strong style={{ color: '#10b981' }}>Sukses:</strong> {successMsg}
            </span>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
              className="btn-ghost"
              style={{ color: '#6ee7b7' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Top Summary Metric Cards */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
            marginBottom: '28px',
          }}
        >
          {/* Card 1: Estimated Cost */}
          <div className="linear-card" style={{ padding: '20px 24px' }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '8px',
              }}
            >
              Total Estimated Cost
            </div>
            <div
              className="font-mono-numbers"
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: '#7170ff',
                letterSpacing: '-0.02em',
              }}
            >
              {formatIDR(preview.total_cost)}
            </div>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-tertiary)',
                marginTop: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>Snapshot rates applied</span>
            </div>
          </div>

          {/* Card 2: Total Manhours */}
          <div className="linear-card" style={{ padding: '20px 24px' }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '8px',
              }}
            >
              Total Manhours
            </div>
            <div
              className="font-mono-numbers"
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
              }}
            >
              {preview.total_hours}{' '}
              <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-tertiary)' }}>
                hrs
              </span>
            </div>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-tertiary)',
                marginTop: '6px',
              }}
            >
              Dev: {preview.hours_by_role.web_dev}h • PM: {preview.hours_by_role.pm}h • UI: {preview.hours_by_role.ui_ux}h
            </div>
          </div>

          {/* Card 3: Module Count */}
          <div className="linear-card" style={{ padding: '20px 24px' }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '8px',
              }}
            >
              Module Count
            </div>
            <div
              className="font-mono-numbers"
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
              }}
            >
              {totalModuleCount}{' '}
              <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-tertiary)' }}>
                Modules
              </span>
            </div>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-tertiary)',
                marginTop: '6px',
              }}
            >
              Breakdown struktur WBS
            </div>
          </div>

          {/* Card 4: Task Count */}
          <div className="linear-card" style={{ padding: '20px 24px' }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '8px',
              }}
            >
              Task Count
            </div>
            <div
              className="font-mono-numbers"
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
              }}
            >
              {totalTaskCount}{' '}
              <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-tertiary)' }}>
                Tasks
              </span>
            </div>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-tertiary)',
                marginTop: '6px',
              }}
            >
              Estimasi rata-rata{' '}
              {totalTaskCount > 0 ? (preview.total_hours / totalTaskCount).toFixed(1) : 0} h/task
            </div>
          </div>
        </section>

        {/* 2-Column Working Layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 340px',
            gap: '24px',
            alignItems: 'start',
          }}
        >
          {/* Main Form (Left) */}
          <form onSubmit={handleSaveEstimate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Section 1: Company & Project Info */}
            <section className="linear-card" style={{ padding: '20px 24px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    1. Company & Project Info
                  </h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    Identitas project dan nama klien sasaran
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                      marginBottom: '6px',
                    }}
                  >
                    Project Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="Contoh: Djarum Urban - Microsite"
                    className="linear-input"
                  />
                </div>

                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '6px',
                    }}
                  >
                    <label
                      style={{
                        fontSize: '12px',
                        fontWeight: 500,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Company
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsRegisteringCompany(!isRegisteringCompany)}
                      className="btn-ghost"
                      style={{
                        fontSize: '11px',
                        color: 'var(--accent-hover)',
                        padding: '2px 6px',
                      }}
                    >
                      {isRegisteringCompany ? '← Existing Company' : '+ New Company'}
                    </button>
                  </div>

                  {!isRegisteringCompany ? (
                    <select
                      value={selectedCompanyId}
                      onChange={(e) =>
                        setSelectedCompanyId(e.target.value ? Number(e.target.value) : '')
                      }
                      required
                      className="linear-select"
                    >
                      <option value="">-- Pilih Perusahaan --</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div
                      className="linear-card-elevated"
                      style={{
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--accent-hover)',
                          textTransform: 'uppercase',
                        }}
                      >
                        Register New Company
                      </div>
                      <input
                        type="text"
                        placeholder="Nama Perusahaan *"
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        className="linear-input"
                        style={{ fontSize: '12px', padding: '6px 10px' }}
                      />
                      <input
                        type="email"
                        placeholder="Email (Opsional)"
                        value={newCompanyEmail}
                        onChange={(e) => setNewCompanyEmail(e.target.value)}
                        className="linear-input"
                        style={{ fontSize: '12px', padding: '6px 10px' }}
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="Phone (Opsional)"
                          value={newCompanyPhone}
                          onChange={(e) => setNewCompanyPhone(e.target.value)}
                          className="linear-input"
                          style={{ fontSize: '12px', padding: '6px 10px' }}
                        />
                        <input
                          type="text"
                          placeholder="Address (Opsional)"
                          value={newCompanyAddress}
                          onChange={(e) => setNewCompanyAddress(e.target.value)}
                          className="linear-input"
                          style={{ fontSize: '12px', padding: '6px 10px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                        <button
                          type="button"
                          onClick={() => setIsRegisteringCompany(false)}
                          className="btn-ghost"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={handleRegisterCompany}
                          className="btn-primary"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          Simpan Company
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Section 2: Service & Classification */}
            <section className="linear-card" style={{ padding: '20px 24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <h2
                  style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  2. Service & Classification
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  Klasifikasi jasa dan aturan tagging business rules
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '20px',
                }}
              >
                {/* Service Type Pills */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                      marginBottom: '8px',
                    }}
                  >
                    Service Type
                  </label>
                  <div className="pill-group" style={{ width: '100%' }}>
                    {serviceTypes.map((st) => {
                      const isSelected = selectedServiceTypeId === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          disabled={!st.is_active}
                          onClick={() => setSelectedServiceTypeId(st.id)}
                          className={`pill-item ${isSelected ? 'active' : ''}`}
                          style={{ flex: 1 }}
                        >
                          {st.name}
                          {!st.is_active && (
                            <span
                              style={{
                                fontSize: '10px',
                                opacity: 0.6,
                                background: 'rgba(255, 255, 255, 0.1)',
                                padding: '1px 5px',
                                borderRadius: '4px',
                              }}
                            >
                              Reserved
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Category Pills */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                      marginBottom: '8px',
                    }}
                  >
                    Category
                  </label>
                  <div className="pill-group" style={{ width: '100%' }}>
                    {categories.map((c) => {
                      const isSelected = selectedCategoryId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedCategoryId(c.id)}
                          className={`pill-item ${isSelected ? 'active' : ''}`}
                          style={{ flex: 1 }}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tag Pills (Conditional for Development) */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                      marginBottom: '8px',
                    }}
                  >
                    Tag{' '}
                    {isDevelopment ? (
                      <span style={{ color: 'var(--accent-hover)', fontSize: '11px' }}>
                        (Wajib untuk Development)
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>
                        (N/A Maintenance)
                      </span>
                    )}
                  </label>

                  {isDevelopment ? (
                    <div className="pill-group" style={{ width: '100%' }}>
                      {tags.map((t) => {
                        const isSelected = selectedTagId === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSelectedTagId(t.id)}
                            className={`pill-item ${isSelected ? 'active' : ''}`}
                            style={{ flex: 1 }}
                          >
                            {t.name} ({t.code})
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '7px 12px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px dashed var(--border-subtle)',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: 'var(--text-tertiary)',
                        textAlign: 'center',
                      }}
                    >
                      Kategori Maintenance tidak menggunakan Tag
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Section 3: Hourly Rate Configuration (Collapsible) */}
            <section className="linear-card" style={{ padding: 0, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setIsRateExpanded(!isRateExpanded)}
                style={{
                  width: '100%',
                  padding: '16px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span
                    style={{
                      transform: isRateExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.15s ease',
                      fontSize: '12px',
                      color: 'var(--text-tertiary)',
                      display: 'inline-block',
                    }}
                  >
                    ▶
                  </span>
                  <div>
                    <h2
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    >
                      3. Hourly Rate Configuration
                    </h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      Snapshot tarif per jam standar internal
                    </p>
                  </div>
                </div>

                {/* Inline Rate Badges Preview */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="badge badge-accent">PM: {formatIDR(rates.PM)}/h</span>
                  <span className="badge badge-accent">DEV: {formatIDR(rates.WEB_DEV)}/h</span>
                  <span className="badge badge-accent">UI/UX: {formatIDR(rates.UI_UX)}/h</span>
                  <span className="badge badge-accent">QC: {formatIDR(rates.QC_DOC)}/h</span>
                  <span className="badge badge-accent">DEVOPS: {formatIDR(rates.DEV_OPS)}/h</span>
                </div>
              </button>

              {isRateExpanded && (
                <div
                  style={{
                    padding: '0 24px 20px',
                    borderTop: '1px solid var(--border-subtle)',
                    marginTop: '4px',
                    paddingTop: '16px',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '12px',
                    }}
                  >
                    <div className="linear-card-elevated" style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Project Manager</div>
                      <div className="font-mono-numbers" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                        {formatIDR(rates.PM)} <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>/ jam</span>
                      </div>
                    </div>
                    <div className="linear-card-elevated" style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Web Developer</div>
                      <div className="font-mono-numbers" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                        {formatIDR(rates.WEB_DEV)} <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>/ jam</span>
                      </div>
                    </div>
                    <div className="linear-card-elevated" style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>UI/UX Designer</div>
                      <div className="font-mono-numbers" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                        {formatIDR(rates.UI_UX)} <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>/ jam</span>
                      </div>
                    </div>
                    <div className="linear-card-elevated" style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>QC & Documentation</div>
                      <div className="font-mono-numbers" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                        {formatIDR(rates.QC_DOC)} <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>/ jam</span>
                      </div>
                    </div>
                    <div className="linear-card-elevated" style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>DevOps Engineer</div>
                      <div className="font-mono-numbers" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                        {formatIDR(rates.DEV_OPS)} <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>/ jam</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Section 4: Module & Task Breakdown */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 0',
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    4. Module & Task Breakdown
                  </h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    Alokasi jam kerja per modul dan role spesifik
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addModule}
                  className="btn-secondary"
                  style={{ gap: '6px' }}
                >
                  <span>+</span> Tambah Module
                </button>
              </div>

              {modules.map((mod, mIdx) => {
                const calcMod = preview.calcModules[mIdx];
                return (
                  <div
                    key={mIdx}
                    className="linear-card"
                    style={{
                      overflow: 'hidden',
                      background: 'var(--bg-panel)',
                    }}
                  >
                    {/* Module Header Bar */}
                    <div
                      style={{
                        padding: '12px 20px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        borderBottom: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--accent-hover)',
                            background: 'var(--accent-light)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          M{mIdx + 1}
                        </span>
                        <input
                          type="text"
                          value={mod.name}
                          onChange={(e) => updateModuleName(mIdx, e.target.value)}
                          placeholder="Nama Modul..."
                          style={{
                            fontWeight: 600,
                            fontSize: '14px',
                            color: 'var(--text-primary)',
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            width: '100%',
                            maxWidth: '420px',
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {calcMod && (
                          <div
                            className="font-mono-numbers"
                            style={{
                              fontSize: '12px',
                              color: 'var(--text-secondary)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <span style={{ color: 'var(--text-tertiary)' }}>Subtotal:</span>
                            <span style={{ color: '#7170ff', fontWeight: 600 }}>
                              {calcMod.total_hours}h
                            </span>
                            <span style={{ color: 'var(--border-hover)' }}>•</span>
                            <span style={{ color: '#10b981', fontWeight: 600 }}>
                              {formatIDR(calcMod.total_cost)}
                            </span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => addTask(mIdx)}
                          className="btn-ghost"
                          style={{
                            color: 'var(--accent-hover)',
                            fontSize: '12px',
                            padding: '4px 8px',
                          }}
                        >
                          + Task
                        </button>
                        {modules.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeModule(mIdx)}
                            className="btn-ghost"
                            style={{
                              color: '#ef4444',
                              fontSize: '12px',
                              padding: '4px 8px',
                            }}
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Tasks Table */}
                    <div style={{ overflowX: 'auto' }}>
                      <table className="linear-table">
                        <thead>
                          <tr>
                            <th style={{ width: '30%' }}>Feature / Task Description</th>
                            <th style={{ width: '9%', textAlign: 'center' }}>PM (h)</th>
                            <th style={{ width: '9%', textAlign: 'center' }}>Web Dev (h)</th>
                            <th style={{ width: '9%', textAlign: 'center' }}>UI/UX (h)</th>
                            <th style={{ width: '9%', textAlign: 'center' }}>QC (h)</th>
                            <th style={{ width: '9%', textAlign: 'center' }}>DevOps (h)</th>
                            <th style={{ width: '18%', textAlign: 'right' }}>Calculated Cost</th>
                            <th style={{ width: '7%', textAlign: 'center' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {mod.tasks.map((task, tIdx) => {
                            const calcTask = calcMod?.tasks[tIdx];
                            return (
                              <tr key={tIdx}>
                                <td>
                                  <input
                                    type="text"
                                    value={task.name}
                                    onChange={(e) =>
                                      updateTaskField(mIdx, tIdx, 'name', e.target.value)
                                    }
                                    placeholder="Nama fitur atau aktivitas..."
                                    className="linear-input"
                                    style={{
                                      fontSize: '12px',
                                      padding: '5px 8px',
                                    }}
                                  />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={task.hours_pm || ''}
                                    onChange={(e) =>
                                      updateTaskField(mIdx, tIdx, 'hours_pm', e.target.value)
                                    }
                                    className="linear-input font-mono-numbers"
                                    style={{
                                      width: '56px',
                                      textAlign: 'center',
                                      padding: '5px 2px',
                                      margin: '0 auto',
                                      fontSize: '12px',
                                    }}
                                  />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={task.hours_web_dev || ''}
                                    onChange={(e) =>
                                      updateTaskField(mIdx, tIdx, 'hours_web_dev', e.target.value)
                                    }
                                    className="linear-input font-mono-numbers"
                                    style={{
                                      width: '56px',
                                      textAlign: 'center',
                                      padding: '5px 2px',
                                      margin: '0 auto',
                                      fontSize: '12px',
                                    }}
                                  />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={task.hours_ui_ux || ''}
                                    onChange={(e) =>
                                      updateTaskField(mIdx, tIdx, 'hours_ui_ux', e.target.value)
                                    }
                                    className="linear-input font-mono-numbers"
                                    style={{
                                      width: '56px',
                                      textAlign: 'center',
                                      padding: '5px 2px',
                                      margin: '0 auto',
                                      fontSize: '12px',
                                    }}
                                  />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={task.hours_qc_doc || ''}
                                    onChange={(e) =>
                                      updateTaskField(mIdx, tIdx, 'hours_qc_doc', e.target.value)
                                    }
                                    className="linear-input font-mono-numbers"
                                    style={{
                                      width: '56px',
                                      textAlign: 'center',
                                      padding: '5px 2px',
                                      margin: '0 auto',
                                      fontSize: '12px',
                                    }}
                                  />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={task.hours_dev_ops || ''}
                                    onChange={(e) =>
                                      updateTaskField(mIdx, tIdx, 'hours_dev_ops', e.target.value)
                                    }
                                    className="linear-input font-mono-numbers"
                                    style={{
                                      width: '56px',
                                      textAlign: 'center',
                                      padding: '5px 2px',
                                      margin: '0 auto',
                                      fontSize: '12px',
                                    }}
                                  />
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <span
                                    className="font-mono-numbers"
                                    style={{
                                      fontWeight: 500,
                                      color: 'var(--text-primary)',
                                      fontSize: '12px',
                                    }}
                                  >
                                    {formatIDR(calcTask?.total_cost || 0)}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {mod.tasks.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => removeTask(mIdx, tIdx)}
                                      className="btn-ghost"
                                      style={{
                                        color: 'var(--text-tertiary)',
                                        fontSize: '14px',
                                        padding: '2px 6px',
                                      }}
                                      title="Hapus task"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={addModule}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px dashed var(--border-subtle)',
                  background: 'rgba(255, 255, 255, 0.01)',
                  color: 'var(--text-tertiary)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.color = 'var(--text-tertiary)';
                }}
              >
                + Tambah Modul Baru
              </button>
            </section>

            {/* Scope of Work / Notes */}
            <section className="linear-card" style={{ padding: '20px 24px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  marginBottom: '8px',
                }}
              >
                Catatan / Scope of Work (SOW)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Rincian scope of work, asumsi sprint, timeline, atau deliverables spesifik..."
                rows={3}
                className="linear-textarea"
              />
            </section>

            {/* Submit Action Button */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                {isLoading ? 'Menyimpan ke Database...' : 'Simpan Project Estimate'}
              </button>
            </div>
          </form>

          {/* Sticky Calculation Preview Panel (Right) */}
          <aside style={{ position: 'sticky', top: '76px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="linear-card" style={{ padding: '20px', background: 'var(--bg-panel)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: '12px',
                  borderBottom: '1px solid var(--border-subtle)',
                  marginBottom: '16px',
                }}
              >
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Live Calculation
                </span>
                <span className="badge badge-port">Real-time</span>
              </div>

              {/* Total Cost Display */}
              <div style={{ marginBottom: '16px' }}>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '4px',
                  }}
                >
                  Grand Total Cost
                </div>
                <div
                  className="font-mono-numbers"
                  style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    color: '#7170ff',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {formatIDR(preview.total_cost)}
                </div>
              </div>

              {/* Total Hours Display */}
              <div style={{ marginBottom: '16px' }}>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '4px',
                  }}
                >
                  Grand Total Manhours
                </div>
                <div
                  className="font-mono-numbers"
                  style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  {preview.total_hours} <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>jam</span>
                </div>
              </div>

              {/* Breakdown per Role */}
              <div
                style={{
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '4px',
                  }}
                >
                  Role Hours & Cost
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>PM ({preview.hours_by_role.pm}h)</span>
                  <span className="font-mono-numbers" style={{ color: 'var(--text-secondary)' }}>
                    {formatIDR(preview.cost_by_role.pm)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Web Dev ({preview.hours_by_role.web_dev}h)</span>
                  <span className="font-mono-numbers" style={{ color: 'var(--text-secondary)' }}>
                    {formatIDR(preview.cost_by_role.web_dev)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>UI/UX ({preview.hours_by_role.ui_ux}h)</span>
                  <span className="font-mono-numbers" style={{ color: 'var(--text-secondary)' }}>
                    {formatIDR(preview.cost_by_role.ui_ux)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>QC & Doc ({preview.hours_by_role.qc_doc}h)</span>
                  <span className="font-mono-numbers" style={{ color: 'var(--text-secondary)' }}>
                    {formatIDR(preview.cost_by_role.qc_doc)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>DevOps ({preview.hours_by_role.dev_ops}h)</span>
                  <span className="font-mono-numbers" style={{ color: 'var(--text-secondary)' }}>
                    {formatIDR(preview.cost_by_role.dev_ops)}
                  </span>
                </div>
              </div>

              {/* Classification Summary */}
              <div
                style={{
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '12px',
                  marginTop: '12px',
                  fontSize: '11px',
                  color: 'var(--text-tertiary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div>
                  Kategori:{' '}
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                    {selectedCategory?.name || '-'}
                  </span>
                </div>
                <div>
                  Tag:{' '}
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                    {isDevelopment
                      ? tags.find((t) => t.id === Number(selectedTagId))?.name || '-'
                      : 'None (Maintenance)'}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Section 5: Historical Estimates */}
        <section style={{ marginTop: '48px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                }}
              >
                5. Historical Estimates
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                Riwayat arsip kalkulasi costing yang tersimpan di PostgreSQL
              </p>
            </div>
            <span
              style={{
                fontSize: '12px',
                color: 'var(--text-tertiary)',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '3px 10px',
                borderRadius: '9999px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {savedEstimates.length} Estimates
            </span>
          </div>

          {savedEstimates.length === 0 ? (
            <div
              className="linear-card"
              style={{
                padding: '32px',
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontSize: '13px',
              }}
            >
              Belum ada data project estimate yang tersimpan.
            </div>
          ) : (
            <div className="linear-card" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="linear-table">
                  <thead>
                    <tr>
                      <th style={{ width: '6%' }}>ID</th>
                      <th style={{ width: '22%' }}>Project Title</th>
                      <th style={{ width: '16%' }}>Company</th>
                      <th style={{ width: '12%' }}>Category</th>
                      <th style={{ width: '10%' }}>Tag</th>
                      <th style={{ width: '10%', textAlign: 'right' }}>Total Hours</th>
                      <th style={{ width: '14%', textAlign: 'right' }}>Total Cost</th>
                      <th style={{ width: '10%', textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedEstimates.map((est) => (
                      <tr
                        key={est.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setInspectEstimate(est)}
                      >
                        <td>
                          <span
                            className="font-mono-numbers"
                            style={{
                              fontSize: '11px',
                              color: 'var(--text-tertiary)',
                            }}
                          >
                            #{est.id}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {est.title}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                            {new Date(est.created_at).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        </td>
                        <td>
                          <span style={{ color: 'var(--text-secondary)' }}>{est.company_name}</span>
                        </td>
                        <td>
                          <span style={{ color: 'var(--text-secondary)' }}>{est.category_name}</span>
                        </td>
                        <td>
                          {est.tag_name ? (
                            <span className="badge badge-accent">{est.tag_name}</span>
                          ) : (
                            <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>-</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="font-mono-numbers" style={{ color: 'var(--text-secondary)' }}>
                            {Number(est.total_hours)}h
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span
                            className="font-mono-numbers"
                            style={{
                              fontWeight: 600,
                              color: '#10b981',
                            }}
                          >
                            {formatIDR(est.total_cost)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge badge-draft">{est.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Modal Inspector for Saved Estimate */}
        {inspectEstimate && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(4px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
            onClick={() => setInspectEstimate(null)}
          >
            <div
              className="linear-card"
              style={{
                width: '100%',
                maxWidth: '540px',
                padding: '24px',
                background: 'var(--bg-panel)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--accent-hover)', fontWeight: 600 }}>
                    ESTIMATE #{inspectEstimate.id}
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {inspectEstimate.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectEstimate(null)}
                  className="btn-ghost"
                >
                  ✕
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  marginBottom: '16px',
                  fontSize: '12px',
                }}
              >
                <div className="linear-card-elevated" style={{ padding: '10px 12px' }}>
                  <div style={{ color: 'var(--text-tertiary)' }}>Perusahaan</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {inspectEstimate.company_name}
                  </div>
                </div>
                <div className="linear-card-elevated" style={{ padding: '10px 12px' }}>
                  <div style={{ color: 'var(--text-tertiary)' }}>Klasifikasi</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {inspectEstimate.category_name}{' '}
                    {inspectEstimate.tag_name ? `(${inspectEstimate.tag_name})` : ''}
                  </div>
                </div>
                <div className="linear-card-elevated" style={{ padding: '10px 12px' }}>
                  <div style={{ color: 'var(--text-tertiary)' }}>Total Manhour</div>
                  <div
                    className="font-mono-numbers"
                    style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}
                  >
                    {Number(inspectEstimate.total_hours)} Jam
                  </div>
                </div>
                <div className="linear-card-elevated" style={{ padding: '10px 12px' }}>
                  <div style={{ color: 'var(--text-tertiary)' }}>Total Biaya</div>
                  <div
                    className="font-mono-numbers"
                    style={{ fontWeight: 700, color: '#10b981', marginTop: '2px' }}
                  >
                    {formatIDR(inspectEstimate.total_cost)}
                  </div>
                </div>
              </div>

              <div
                style={{
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '12px',
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  type="button"
                  onClick={() => setInspectEstimate(null)}
                  className="btn-secondary"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
