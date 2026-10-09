'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DEFAULT_ROLE_RATES,
  calculateModule,
  type RoleRateMap,
  type ModuleInput,
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

interface RoleMaster {
  id: number;
  code: string;
  name: string;
  default_hourly_rate: number;
  is_active?: boolean;
}

const formatIDR = (val: number | string) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return `Rp ${(num || 0).toLocaleString('id-ID')}`;
};

export default function NewEstimatePage() {
  const router = useRouter();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [roles, setRoles] = useState<RoleMaster[]>([]);
  const [rates, setRates] = useState<RoleRateMap>(DEFAULT_ROLE_RATES);

  // New Role Modal state
  const [isNewRoleModalOpen, setIsNewRoleModalOpen] = useState(false);
  const [newRoleCode, setNewRoleCode] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleRate, setNewRoleRate] = useState<number | ''>('');
  const [newRoleLoading, setNewRoleLoading] = useState(false);
  const [newRoleError, setNewRoleError] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('Djarum Urban - Microsite');
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>('');
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState<number | ''>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('');
  const [selectedTagId, setSelectedTagId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  // Rate config collapse state (expanded by default to display active/excluded roles)
  const [isRateExpanded, setIsRateExpanded] = useState(true);

  // Excluded roles from costing state
  const [excludedRoleCodes, setExcludedRoleCodes] = useState<string[]>([]);

  // Delete Role confirmation modal state
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<RoleMaster | null>(null);
  const [deleteRoleLoading, setDeleteRoleLoading] = useState(false);
  const [deleteRoleError, setDeleteRoleError] = useState<string | null>(null);

  // Derived active vs excluded roles in costing
  const activeCostingRoles = useMemo(
    () => roles.filter((r) => !excludedRoleCodes.includes(r.code)),
    [roles, excludedRoleCodes]
  );

  const excludedRoles = useMemo(
    () => roles.filter((r) => excludedRoleCodes.includes(r.code)),
    [roles, excludedRoleCodes]
  );

  // Register company modal/expander
  const [isRegisteringCompany, setIsRegisteringCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyEmail, setNewCompanyEmail] = useState('');
  const [newCompanyPhone, setNewCompanyPhone] = useState('');
  const [newCompanyAddress, setNewCompanyAddress] = useState('');

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

  // Load initial metadata
  const loadMetadata = useCallback(async () => {
    try {
      const [res, rolesRes] = await Promise.all([
        fetch('/api/metadata'),
        fetch('/api/roles?active_only=true'),
      ]);
      const data = await res.json();
      const rolesData = await rolesRes.json();

      let activeRoles: RoleMaster[] = [];
      if (rolesData.success && Array.isArray(rolesData.roles)) {
        activeRoles = rolesData.roles;
      } else if (data.roles && Array.isArray(data.roles)) {
        activeRoles = data.roles;
      }
      setRoles(activeRoles);

      // Populate default rates map from active roles
      const initialRates: RoleRateMap = { ...DEFAULT_ROLE_RATES };
      for (const r of activeRoles) {
        initialRates[r.code] = r.default_hourly_rate;
      }
      setRates(initialRates);

      if (data.success) {
        setCompanies(data.companies || []);
        setServiceTypes(data.serviceTypes || []);
        setCategories(data.categories || []);
        setTags(data.tags || []);

        // Default to IT & Development
        const itType = (data.serviceTypes || []).find((st: ServiceType) => st.code === 'IT');
        if (itType) setSelectedServiceTypeId(itType.id);

        const devCat = (data.categories || []).find((c: Category) => c.code === 'DEV' || c.code === 'DEVELOPMENT');
        if (devCat) setSelectedCategoryId(devCat.id);

        const initTag = (data.tags || []).find((t: Tag) => t.code === 'INITIAL');
        if (initTag) setSelectedTagId(initTag.id);

        if ((data.companies || []).length > 0) {
          setSelectedCompanyId(data.companies[0].id);
        }
      }
    } catch {
      setErrorMsg('Gagal memuat metadata database.');
    }
  }, []);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  // Derived classification
  const currentCategory = categories.find((c) => c.id === Number(selectedCategoryId));

  const isDevelopment = currentCategory?.code === 'DEV' || currentCategory?.code === 'DEVELOPMENT';
  const isMaintenance = currentCategory?.code === 'MAINTENANCE';

  // Filtered categories & tags
  const availableCategories = useMemo(() => {
    if (!selectedServiceTypeId) return [];
    return categories.filter((c) => c.service_type_id === Number(selectedServiceTypeId));
  }, [categories, selectedServiceTypeId]);

  const availableTags = useMemo(() => {
    if (!currentCategory) return [];
    return tags.filter((t) => t.applies_to_category_code === currentCategory.code);
  }, [tags, currentCategory]);

  const handleCategoryChange = (catId: number) => {
    setSelectedCategoryId(catId);
    const cat = categories.find((c) => c.id === catId);
    if (cat?.code === 'DEV' || cat?.code === 'DEVELOPMENT') {
      const initialTag = tags.find((t) => t.code === 'INITIAL');
      if (initialTag) setSelectedTagId(initialTag.id);
    } else {
      setSelectedTagId('');
    }
  };

  // Live real-time calculations
  const calculation = useMemo(() => {
    try {
      const calcModules = modules.map((m) => calculateModule(m, rates));
      const hours_by_role: Record<string, number> = {};
      const cost_by_role: Record<string, number> = {};

      for (const r of activeCostingRoles) {
        hours_by_role[r.code] = calcModules.reduce((acc, m) => acc + (m.hours_breakdown[r.code] || 0), 0);
        cost_by_role[r.code] = calcModules.reduce((acc, m) => acc + (m.cost_breakdown[r.code] || 0), 0);
      }

      const total_hours = calcModules.reduce((acc, m) => acc + m.total_hours, 0);
      const total_cost = calcModules.reduce((acc, m) => acc + m.total_cost, 0);

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
        hours_by_role: {},
        cost_by_role: {},
        total_hours: 0,
        total_cost: 0,
      };
    }
  }, [modules, rates, activeCostingRoles]);

  const totalModuleCount = modules.length;
  const totalTaskCount = useMemo(
    () => modules.reduce((acc, m) => acc + m.tasks.length, 0),
    [modules]
  );

  // Quick Demo Loaders
  const loadSpreadsheetExample = () => {
    setExcludedRoleCodes([]);
    setTitle('Djarum Urban - Microsite');
    const it = serviceTypes.find((s) => s.code === 'IT');
    if (it) setSelectedServiceTypeId(it.id);
    const dev = categories.find((c) => c.code === 'DEV' || c.code === 'DEVELOPMENT');
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
        name: '3.0 Design & Prototyping',
        tasks: [
          { name: 'Design System - Style Guide', hours_pm: 0, hours_web_dev: 0, hours_ui_ux: 8, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Design Exploration UI & Responsive', hours_pm: 0, hours_web_dev: 0, hours_ui_ux: 32, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Asset Management', hours_pm: 0, hours_web_dev: 0, hours_ui_ux: 6, hours_qc_doc: 0, hours_dev_ops: 0 },
        ],
      },
      {
        name: '4.0 Development Frontend & Backend',
        tasks: [
          { name: 'Architecture Database & Development Engine', hours_pm: 0, hours_web_dev: 8, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Slicing & Integration Homepage Desktop & Mobile', hours_pm: 0, hours_web_dev: 16, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Slicing & Integration Article / Content Desktop & Mobile', hours_pm: 0, hours_web_dev: 16, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Slicing & Integration Gallery Desktop & Mobile', hours_pm: 0, hours_web_dev: 8, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Slicing & Integration Custom Form Desktop & Mobile', hours_pm: 0, hours_web_dev: 8, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Slicing & Integration Hubungi Kami Desktop & Mobile', hours_pm: 0, hours_web_dev: 8, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Development CMS Admin (Dynamic Page, Content, Form, Media)', hours_pm: 0, hours_web_dev: 40, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
        ],
      },
      {
        name: '5.0 SEO Onpage Basic',
        tasks: [
          { name: 'Metadata Open Graph & Twitter Card', hours_pm: 0, hours_web_dev: 2, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Google Analytics & Tag Manager Setup', hours_pm: 0, hours_web_dev: 1, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
          { name: 'Google Search Console & Sitemap XML', hours_pm: 0, hours_web_dev: 1, hours_ui_ux: 0, hours_qc_doc: 0, hours_dev_ops: 0 },
        ],
      },
      {
        name: '6.0 Third Party Services',
        tasks: [
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
    setExcludedRoleCodes([]);
    setTitle('Website Maintenance 2026');
    const it = serviceTypes.find((s) => s.code === 'IT');
    if (it) setSelectedServiceTypeId(it.id);
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
    const initialRoleHours: Record<string, number> = {};
    for (const r of roles) {
      initialRoleHours[r.code] = 0;
    }
    next[mIdx].tasks.push({
      name: `Task ${next[mIdx].tasks.length + 1}`,
      role_hours: initialRoleHours,
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
    field: 'name' | 'hours_pm' | 'hours_web_dev' | 'hours_ui_ux' | 'hours_qc_doc' | 'hours_dev_ops',
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

  const updateTaskRoleHours = (
    mIdx: number,
    tIdx: number,
    roleCode: string,
    val: string
  ) => {
    const next = [...modules];
    const task = { ...next[mIdx].tasks[tIdx] };
    const num = Number(val) || 0;
    task.role_hours = {
      ...(task.role_hours || {}),
      [roleCode]: num,
    };
    if (roleCode === 'PM') task.hours_pm = num;
    if (roleCode === 'WEB_DEV') task.hours_web_dev = num;
    if (roleCode === 'UI_UX') task.hours_ui_ux = num;
    if (roleCode === 'QC_DOC') task.hours_qc_doc = num;
    if (roleCode === 'DEV_OPS') task.hours_dev_ops = num;

    next[mIdx].tasks[tIdx] = task;
    setModules(next);
  };

  const updateRate = (role: string, val: number) => {
    setRates((prev) => ({
      ...prev,
      [role]: val,
    }));
  };

  const handleExcludeRole = (code: string) => {
    if (activeCostingRoles.length <= 1) {
      setErrorMsg('Setidaknya minimal 1 role harus tetap aktif di costing form.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }
    setExcludedRoleCodes((prev) => [...prev, code]);
    // Zero out hours for this role across all tasks so excluded role doesn't inflate project totals
    setModules((prevMods) =>
      prevMods.map((m) => ({
        ...m,
        tasks: m.tasks.map((t) => {
          const nextRoleHours = { ...(t.role_hours || {}) };
          nextRoleHours[code] = 0;
          return {
            ...t,
            role_hours: nextRoleHours,
            hours_pm: code === 'PM' ? 0 : t.hours_pm,
            hours_web_dev: code === 'WEB_DEV' ? 0 : t.hours_web_dev,
            hours_ui_ux: code === 'UI_UX' ? 0 : t.hours_ui_ux,
            hours_qc_doc: code === 'QC_DOC' ? 0 : t.hours_qc_doc,
            hours_dev_ops: code === 'DEV_OPS' ? 0 : t.hours_dev_ops,
          };
        }),
      }))
    );
  };

  const handleIncludeRole = (code: string) => {
    setExcludedRoleCodes((prev) => prev.filter((c) => c !== code));
  };

  const handleDeleteRoleConfirm = async () => {
    if (!deleteRoleTarget) return;
    setDeleteRoleLoading(true);
    setDeleteRoleError(null);
    try {
      const res = await fetch(`/api/roles?id=${deleteRoleTarget.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setDeleteRoleError(data.error || 'Gagal menghapus role dari master database.');
      } else {
        const deletedId = deleteRoleTarget.id;
        const deletedCode = deleteRoleTarget.code;
        const deletedName = deleteRoleTarget.name;

        // Cleanup local state
        setRoles((prev) => prev.filter((r) => r.id !== deletedId));
        setExcludedRoleCodes((prev) => prev.filter((c) => c !== deletedCode));
        setRates((prev) => {
          const next = { ...prev };
          delete next[deletedCode];
          return next;
        });
        setModules((prevMods) =>
          prevMods.map((m) => ({
            ...m,
            tasks: m.tasks.map((t) => {
              const nextRoleHours = { ...(t.role_hours || {}) };
              delete nextRoleHours[deletedCode];
              return {
                ...t,
                role_hours: nextRoleHours,
              };
            }),
          }))
        );

        setDeleteRoleTarget(null);
        setSuccessMsg(data.message || `Role '${deletedName}' berhasil dihapus dari master database.`);
        setTimeout(() => setSuccessMsg(null), 4000);
        await loadMetadata();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setDeleteRoleError(msg);
    } finally {
      setDeleteRoleLoading(false);
    }
  };

  const handleCreateNewRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewRoleError(null);

    const cleanCode = newRoleCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!cleanCode) {
      setNewRoleError('Kode role wajib diisi.');
      return;
    }
    if (!newRoleName.trim()) {
      setNewRoleError('Nama role wajib diisi.');
      return;
    }
    const parsedRate = Number(newRoleRate);
    if (isNaN(parsedRate) || parsedRate < 0) {
      setNewRoleError('Hourly rate harus berupa angka >= 0.');
      return;
    }

    setNewRoleLoading(true);
    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          name: newRoleName.trim(),
          default_hourly_rate: parsedRate,
          is_active: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setNewRoleError(data.error || 'Gagal menambahkan role baru.');
      } else {
        const addedRole: RoleMaster = data.role;
        setRoles((prev) => [...prev, addedRole]);
        setRates((prev) => ({
          ...prev,
          [addedRole.code]: addedRole.default_hourly_rate,
        }));
        setExcludedRoleCodes((prev) => prev.filter((c) => c !== addedRole.code));
        setNewRoleCode('');
        setNewRoleName('');
        setNewRoleRate('');
        setIsNewRoleModalOpen(false);
        setSuccessMsg(`Role '${addedRole.name}' (${addedRole.code}) berhasil ditambahkan ke database!`);
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setNewRoleError(msg);
    } finally {
      setNewRoleLoading(false);
    }
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
          )}). Mengalihkan ke halaman utama...`
        );
        setTimeout(() => {
          router.push('/');
        }, 1200);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', paddingBottom: '120px' }}>
      <main style={{ maxWidth: '1360px', margin: '0 auto', padding: '24px' }}>
        {/* Navigation & Header */}
        <div style={{ marginBottom: '24px' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-tertiary)',
              textDecoration: 'none',
              fontSize: '13px',
              marginBottom: '16px',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
          >
            ← Kembali ke Daftar Estimasi
          </Link>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: '24px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                }}
              >
                Buat Costing Baru
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                Formulir pembuatan kalkulasi WBS, modul, dan manhours costing proyek IT Development & Maintenance
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
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
                title="12 Manhours Maintenance"
              >
                Load Maintenance Demo
              </button>
            </div>
          </div>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div
            style={{
              marginBottom: '20px',
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-danger-bg)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--color-danger)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="btn-ghost"
              style={{ color: 'var(--color-danger)', padding: 0 }}
            >
              ✕
            </button>
          </div>
        )}

        {successMsg && (
          <div
            style={{
              marginBottom: '20px',
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-success-bg)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: 'var(--color-success)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{successMsg}</span>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
              className="btn-ghost"
              style={{ color: 'var(--color-success)', padding: 0 }}
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSaveEstimate}>
          {/* Section 1: Project & Client */}
          <section className="linear-card" style={{ padding: '24px', marginBottom: '24px' }}>
            <h2
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: 'var(--accent-light)',
                  color: 'var(--accent-hover)',
                  fontSize: '11px',
                }}
              >
                1
              </span>
              Informasi Proyek & Klien
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--text-tertiary)',
                    marginBottom: '6px',
                  }}
                >
                  Judul Proyek *
                </label>
                <input
                  type="text"
                  className="linear-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Misal: Djarum Urban - Microsite"
                  required
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label
                    style={{
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    Perusahaan (Klien) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsRegisteringCompany(!isRegisteringCompany)}
                    className="btn-ghost"
                    style={{ fontSize: '11px', color: 'var(--accent-hover)', padding: '0 4px' }}
                  >
                    {isRegisteringCompany ? 'Tutup Form' : '+ Daftarkan Perusahaan'}
                  </button>
                </div>
                <select
                  className="linear-select"
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value ? Number(e.target.value) : '')}
                  required
                >
                  <option value="">-- Pilih Perusahaan --</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Inline Register Company Form */}
            {isRegisteringCompany && (
              <div
                className="linear-card-elevated"
                style={{
                  marginTop: '16px',
                  padding: '16px',
                  border: '1px dashed var(--border-hover)',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
                  Daftarkan Perusahaan Baru
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>
                      Nama Perusahaan *
                    </label>
                    <input
                      type="text"
                      className="linear-input"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      placeholder="PT. Inovasi Digital"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>
                      Email
                    </label>
                    <input
                      type="email"
                      className="linear-input"
                      value={newCompanyEmail}
                      onChange={(e) => setNewCompanyEmail(e.target.value)}
                      placeholder="contact@company.com"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>
                      Telepon
                    </label>
                    <input
                      type="text"
                      className="linear-input"
                      value={newCompanyPhone}
                      onChange={(e) => setNewCompanyPhone(e.target.value)}
                      placeholder="08123456789"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>
                      Alamat
                    </label>
                    <input
                      type="text"
                      className="linear-input"
                      value={newCompanyAddress}
                      onChange={(e) => setNewCompanyAddress(e.target.value)}
                      placeholder="Jakarta, Indonesia"
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setIsRegisteringCompany(false)}
                    className="btn-secondary"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleRegisterCompany}
                    className="btn-primary"
                    disabled={!newCompanyName.trim()}
                  >
                    Simpan Perusahaan
                  </button>
                </div>
              </div>
            )}

            <div style={{ marginTop: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--text-tertiary)',
                  marginBottom: '6px',
                }}
              >
                Catatan / Keterangan (Opsional)
              </label>
              <textarea
                className="linear-textarea"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan tambahan spesifikasi, scope, atau asumsi project..."
              />
            </div>
          </section>

          {/* Section 2: Klasifikasi Layanan (Tactile Pills) */}
          <section className="linear-card" style={{ padding: '24px', marginBottom: '24px' }}>
            <h2
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: 'var(--accent-light)',
                  color: 'var(--accent-hover)',
                  fontSize: '11px',
                }}
              >
                2
              </span>
              Klasifikasi Layanan & Aturan Bisnis
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
              {/* Service Type Pills */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                  Service Type
                </label>
                <div className="pill-group">
                  {serviceTypes.map((st) => {
                    const isSelected = selectedServiceTypeId === st.id;
                    const isReserved = !st.is_active || st.code === 'DIGITAL';
                    return (
                      <button
                        key={st.id}
                        type="button"
                        disabled={isReserved}
                        onClick={() => setSelectedServiceTypeId(st.id)}
                        className={`pill-item ${isSelected ? 'active' : ''}`}
                        title={isReserved ? 'Digital reserved for future phase' : st.name}
                      >
                        {st.name}
                        {isReserved && (
                          <span style={{ fontSize: '10px', opacity: 0.6 }}>(Reserved)</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category Pills */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                  Kategori Proyek
                </label>
                <div className="pill-group">
                  {availableCategories.map((c) => {
                    const isSelected = selectedCategoryId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleCategoryChange(c.id)}
                        className={`pill-item ${isSelected ? 'active' : ''}`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tag Pills (Conditional) */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                  Tag Klasifikasi {isDevelopment && <span style={{ color: 'var(--accent-hover)' }}>(Wajib untuk Dev)</span>}
                  {isMaintenance && <span style={{ color: 'var(--text-tertiary)' }}>(Disabled untuk Maint)</span>}
                </label>
                {isDevelopment ? (
                  <div className="pill-group">
                    {availableTags.map((t) => {
                      const isSelected = selectedTagId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTagId(t.id)}
                          className={`pill-item ${isSelected ? 'active' : ''}`}
                        >
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', padding: '6px 0' }}>
                    Kategori Maintenance tidak memiliki tag.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Section 3: Master Rate Config (Collapsible) */}
          <section className="linear-card" style={{ padding: '24px', marginBottom: '24px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
              onClick={() => setIsRateExpanded(!isRateExpanded)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'var(--accent-light)',
                    color: 'var(--accent-hover)',
                    fontSize: '11px',
                  }}
                >
                  3
                </span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Master Rate Per Jam (Rate Snapshot)
                    </h2>
                    <span className="linear-badge" style={{ fontSize: '11px' }}>
                      {activeCostingRoles.length} Aktif
                    </span>
                    {excludedRoles.length > 0 && (
                      <span className="linear-badge" style={{ fontSize: '11px', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)' }}>
                        {excludedRoles.length} Dikeluarkan
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    Standard hourly rate per role. Snapshot ini disimpan independen pada tiap estimate.
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsNewRoleModalOpen(true);
                  }}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  + Tambah Role Baru
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: '12px', color: 'var(--accent-hover)' }}
                >
                  {isRateExpanded ? 'Sembunyikan ▲' : 'Buka & Sesuaikan ▼'}
                </button>
              </div>
            </div>

            {isRateExpanded && (
              <>
                <div
                  style={{
                    marginTop: '20px',
                    paddingTop: '16px',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '14px',
                  }}
                >
                  {activeCostingRoles.map((r) => (
                    <div
                      key={r.code}
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {r.name}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                            {r.code}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteRoleTarget(r);
                              setDeleteRoleError(null);
                            }}
                            title="Hapus dari Master Database"
                            style={{
                              padding: '2px 6px',
                              fontSize: '12px',
                              color: 'var(--text-tertiary)',
                              borderRadius: '4px',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                          >
                            🗑
                          </button>
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExcludeRole(r.code);
                            }}
                            disabled={activeCostingRoles.length <= 1}
                            title={activeCostingRoles.length <= 1 ? 'Minimal 1 role harus tetap aktif di costing' : 'Keluarkan dari Costing (✕)'}
                            style={{
                              padding: '2px 6px',
                              fontSize: '12px',
                              color: activeCostingRoles.length <= 1 ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                              cursor: activeCostingRoles.length <= 1 ? 'not-allowed' : 'pointer',
                              opacity: activeCostingRoles.length <= 1 ? 0.35 : 1,
                              borderRadius: '4px',
                            }}
                            onMouseEnter={(e) => {
                              if (activeCostingRoles.length > 1) e.currentTarget.style.color = '#ef4444';
                            }}
                            onMouseLeave={(e) => {
                              if (activeCostingRoles.length > 1) e.currentTarget.style.color = 'var(--text-secondary)';
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Rp</span>
                        <input
                          type="number"
                          className="linear-input font-mono-numbers"
                          value={rates[r.code] ?? r.default_hourly_rate}
                          onChange={(e) => updateRate(r.code, Number(e.target.value) || 0)}
                          style={{ textAlign: 'right', fontSize: '12px', padding: '4px 6px' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {excludedRoles.length > 0 && (
                  <div
                    style={{
                      marginTop: '20px',
                      paddingTop: '16px',
                      borderTop: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                        Role Dikeluarkan dari Costing ({excludedRoles.length}):
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        (Tidak muncul di kolom tabel WBS Modul & Task)
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {excludedRoles.map((r) => (
                        <div
                          key={r.code}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 12px',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px dashed var(--border-subtle)',
                            borderRadius: '6px',
                          }}
                        >
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {r.name} <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>({r.code})</span>
                          </span>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleIncludeRole(r.code)}
                            style={{ fontSize: '11px', padding: '3px 8px', color: 'var(--accent-hover)' }}
                            title="Gunakan kembali role ini di costing"
                          >
                            + Gunakan di Costing
                          </button>
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => {
                              setDeleteRoleTarget(r);
                              setDeleteRoleError(null);
                            }}
                            title="Hapus dari Master Database"
                            style={{
                              fontSize: '11px',
                              padding: '2px 5px',
                              color: 'var(--text-tertiary)',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                          >
                            🗑
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Section 4: Modules & Tasks WBS Matrix */}
          <section className="linear-card" style={{ padding: '24px', marginBottom: '24px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'var(--accent-light)',
                    color: 'var(--accent-hover)',
                    fontSize: '11px',
                  }}
                >
                  4
                </span>
                <div>
                  <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    WBS Matrix: Modul & Task Breakdown
                  </h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    Alokasikan jam per role secara detail untuk tiap task dan modul
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={addModule}
                className="btn-secondary"
              >
                + Tambah Modul
              </button>
            </div>

            {modules.map((mod, mIdx) => {
              const calcMod = calculation.calcModules[mIdx];
              return (
                <div
                  key={mIdx}
                  className="linear-card-elevated"
                  style={{
                    marginBottom: '20px',
                    overflow: 'hidden',
                  }}
                >
                  {/* Module Header Bar */}
                  <div
                    style={{
                      padding: '12px 16px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-hover)' }}>
                        MODUL #{mIdx + 1}
                      </span>
                      <input
                        type="text"
                        className="linear-input"
                        value={mod.name}
                        onChange={(e) => updateModuleName(mIdx, e.target.value)}
                        style={{ maxWidth: '360px', padding: '4px 8px', fontSize: '13px' }}
                        placeholder="Nama Modul"
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ fontSize: '12px' }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>Subtotal: </span>
                        <span className="font-mono-numbers" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {calcMod ? calcMod.total_hours : 0} Jam
                        </span>
                        <span style={{ color: 'var(--text-tertiary)', margin: '0 6px' }}>•</span>
                        <span className="font-mono-numbers" style={{ fontWeight: 600, color: '#10b981' }}>
                          {calcMod ? formatIDR(calcMod.total_cost) : 'Rp 0'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeModule(mIdx)}
                        className="btn-ghost"
                        style={{ color: 'var(--color-danger)', fontSize: '12px' }}
                        title="Hapus Modul"
                      >
                        Hapus Modul
                      </button>
                    </div>
                  </div>

                  {/* Tasks Table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table className="linear-table">
                      <thead>
                        <tr>
                          <th style={{ minWidth: '180px' }}>Nama Task</th>
                          {activeCostingRoles.map((r) => (
                            <th key={r.code} style={{ textAlign: 'center', minWidth: '70px' }}>
                              {r.name}
                            </th>
                          ))}
                          <th style={{ width: '9%', textAlign: 'right', minWidth: '70px' }}>Total Jam</th>
                          <th style={{ width: '12%', textAlign: 'right', minWidth: '95px' }}>Biaya</th>
                          <th style={{ width: '4%', textAlign: 'center' }}></th>
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
                                  className="linear-input"
                                  value={task.name}
                                  onChange={(e) => updateTaskField(mIdx, tIdx, 'name', e.target.value)}
                                  placeholder="Nama task..."
                                  style={{ padding: '4px 8px', fontSize: '12px' }}
                                />
                              </td>
                              {activeCostingRoles.map((r) => {
                                const val = task.role_hours?.[r.code] ?? (
                                  r.code === 'PM' ? task.hours_pm :
                                  r.code === 'WEB_DEV' ? task.hours_web_dev :
                                  r.code === 'UI_UX' ? task.hours_ui_ux :
                                  r.code === 'QC_DOC' ? task.hours_qc_doc :
                                  r.code === 'DEV_OPS' ? task.hours_dev_ops : 0
                                );
                                return (
                                  <td key={r.code}>
                                    <input
                                      type="number"
                                      min="0"
                                      className="linear-input font-mono-numbers"
                                      value={val || ''}
                                      onChange={(e) => updateTaskRoleHours(mIdx, tIdx, r.code, e.target.value)}
                                      style={{ padding: '4px 6px', textAlign: 'center', fontSize: '12px' }}
                                    />
                                  </td>
                                );
                              })}
                              <td style={{ textAlign: 'right' }}>
                                <span className="font-mono-numbers" style={{ color: 'var(--text-secondary)' }}>
                                  {calcTask ? calcTask.total_hours : 0}h
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <span className="font-mono-numbers" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {calcTask ? formatIDR(calcTask.total_cost) : 'Rp 0'}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => removeTask(mIdx, tIdx)}
                                  className="btn-ghost"
                                  style={{ color: 'var(--text-tertiary)', fontSize: '12px', padding: '2px 6px' }}
                                  title="Hapus Task"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ padding: '8px 16px', background: 'rgba(255, 255, 255, 0.01)' }}>
                    <button
                      type="button"
                      onClick={() => addTask(mIdx)}
                      className="btn-ghost"
                      style={{ fontSize: '12px', color: 'var(--accent-hover)' }}
                    >
                      + Tambah Task di Modul Ini
                    </button>
                  </div>
                </div>
              );
            })}
          </section>

          {/* Sticky Bottom Summary & Action Bar */}
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 40,
              background: 'rgba(15, 16, 17, 0.95)',
              backdropFilter: 'blur(16px)',
              borderTop: '1px solid var(--border-subtle)',
              padding: '14px 24px',
              boxShadow: '0 -10px 30px rgba(0, 0, 0, 0.6)',
            }}
          >
            <div
              style={{
                maxWidth: '1360px',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Total Cakupan</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {totalModuleCount} Modul • {totalTaskCount} Tasks
                  </div>
                </div>

                <div style={{ height: '24px', width: '1px', background: 'var(--border-subtle)' }} />

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Total Manhours</div>
                  <div className="font-mono-numbers" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {calculation.total_hours} Jam
                  </div>
                </div>

                <div style={{ height: '24px', width: '1px', background: 'var(--border-subtle)' }} />

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Total Estimasi Biaya</div>
                  <div
                    className="font-mono-numbers"
                    style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      color: '#10b981',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {formatIDR(calculation.total_cost)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Link
                  href="/"
                  className="btn-secondary"
                  style={{ textDecoration: 'none' }}
                >
                  Batal
                </Link>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary"
                  style={{ minWidth: '160px' }}
                >
                  {isLoading ? 'Menyimpan...' : 'Simpan Estimasi'}
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Modal Tambah Role Baru */}
        {isNewRoleModalOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(6px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
            onClick={() => setIsNewRoleModalOpen(false)}
          >
            <div
              className="linear-card"
              style={{
                width: '100%',
                maxWidth: '460px',
                padding: '24px',
                background: '#121417',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Tambah Role Baru
                </h3>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setIsNewRoleModalOpen(false)}
                  style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}
                >
                  ✕
                </button>
              </div>

              {newRoleError && (
                <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', borderRadius: '6px', fontSize: '12px', marginBottom: '16px' }}>
                  {newRoleError}
                </div>
              )}

              <form onSubmit={handleCreateNewRole}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Kode Role (contoh: MOBILE_DEV, QA_ENG) *
                  </label>
                  <input
                    type="text"
                    className="linear-input"
                    value={newRoleCode}
                    onChange={(e) => setNewRoleCode(e.target.value.toUpperCase())}
                    placeholder="KODE_ROLE"
                    required
                  />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Nama Role (contoh: Mobile App Developer) *
                  </label>
                  <input
                    type="text"
                    className="linear-input"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="Nama Lengkap Role"
                    required
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Standard Hourly Rate (Rp) *
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Rp</span>
                    <input
                      type="number"
                      min="0"
                      className="linear-input font-mono-numbers"
                      value={newRoleRate}
                      onChange={(e) => setNewRoleRate(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="35000"
                      required
                      style={{ textAlign: 'right' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setIsNewRoleModalOpen(false)}
                    disabled={newRoleLoading}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={newRoleLoading}
                  >
                    {newRoleLoading ? 'Menyimpan...' : 'Simpan Role'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Modal Konfirmasi Hapus Role Master */}
        {deleteRoleTarget && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(6px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
            onClick={() => {
              if (!deleteRoleLoading) {
                setDeleteRoleTarget(null);
                setDeleteRoleError(null);
              }
            }}
          >
            <div
              className="linear-card"
              style={{
                width: '100%',
                maxWidth: '460px',
                padding: '24px',
                background: '#121417',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Hapus Role dari Master Database
                </h3>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setDeleteRoleTarget(null);
                    setDeleteRoleError(null);
                  }}
                  disabled={deleteRoleLoading}
                  style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}
                >
                  ✕
                </button>
              </div>

              {deleteRoleError ? (
                <div
                  style={{
                    padding: '10px 14px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    borderRadius: '6px',
                    fontSize: '12px',
                    marginBottom: '16px',
                    lineHeight: 1.5,
                  }}
                >
                  ⚠️ {deleteRoleError}
                </div>
              ) : (
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
                  Apakah Anda yakin ingin menghapus role <strong style={{ color: 'var(--text-primary)' }}>{deleteRoleTarget.name}</strong> ({deleteRoleTarget.code}) dari database master? Tindakan ini tidak dapat dibatalkan jika role belum pernah digunakan.
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setDeleteRoleTarget(null);
                    setDeleteRoleError(null);
                  }}
                  disabled={deleteRoleLoading}
                >
                  {deleteRoleError ? 'Tutup' : 'Batal'}
                </button>
                {!deleteRoleError && (
                  <button
                    type="button"
                    onClick={handleDeleteRoleConfirm}
                    disabled={deleteRoleLoading}
                    style={{
                      background: '#ef4444',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: deleteRoleLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {deleteRoleLoading ? 'Menghapus...' : 'Hapus dari Master'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
