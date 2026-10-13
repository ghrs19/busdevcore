'use client';
import {
  TrashIcon,

  SparklesIcon,
  ArrowPathIcon,
  PaperClipIcon,
  BoltIcon,

} from '@heroicons/react/24/outline';


import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  calculateModule,
  calculateMaintenance,
  calculateInfrastructure,
  calculateOperational,
  calculateBillingSummary,
  type RoleRateMap,
  type ModuleInput,
  type TaskInput,
  type MaintenanceTaskInput,
  type InfrastructureItemInput,
  type InfraBillingType,
  type OperationalItemInput,

} from '@/lib/costing';
import { nextPersonKey, personInitials, snapshotLabels, assignRoleHoursToPeople, type PersonRateSnapshot } from '@/lib/rate-snapshot';

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

interface Project {
  id: number;
  company_id: number;
  name: string;
  description: string | null;
}

const formatIDR = (val: number | string) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return `Rp ${(num || 0).toLocaleString('id-ID')}`;
};

function NewEstimateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editIdParam = searchParams.get('edit_id');
  const editId = editIdParam ? parseInt(editIdParam, 10) : null;
  const [editingEstimateMeta, setEditingEstimateMeta] = useState<{ version?: number; parent_id?: number | null; revision_notes?: string | null; max_version?: number } | null>(null);
  const [isEditLoading, setIsEditLoading] = useState(false);

  // Edit Revision Reason Dialog state
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [revisionReason, setRevisionReason] = useState('');

  const [companies, setCompanies] = useState<Company[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [roles, setRoles] = useState<RoleMaster[]>([]);
  const [people, setPeople] = useState<PersonRateSnapshot>({});
  const rates = useMemo<RoleRateMap>(() => Object.fromEntries(Object.entries(people).map(([k, v]) => [k, v.rate])), [people]);

  // Project states
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

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
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  // Rate config collapse state (expanded by default to display active/excluded roles)
  const [isRateExpanded, setIsRateExpanded] = useState(true);

  // Kolom costing = orang di Rate Snapshot. Label tampil sebagai "KODE · INISIAL".
  const personLabels = useMemo(() => snapshotLabels(people), [people]);
  const activeCostingRoles = useMemo(
    () => Object.keys(people).map((key) => ({ code: key, name: personLabels[key] || key })),
    [people, personLabels]
  );
  const excludedRoles: Array<{ code: string; name: string }> = [];

  // Register company modal/expander
  const [isRegisteringCompany, setIsRegisteringCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyEmail, setNewCompanyEmail] = useState('');
  const [newCompanyPhone, setNewCompanyPhone] = useState('');
  const [newCompanyAddress, setNewCompanyAddress] = useState('');

  // Modules & tasks
  const [modules, setModules] = useState<ModuleInput[]>([
    { name: '1.0 Coordination', tasks: [{ name: 'Kickoff Project Meeting (1x)', role_hours: {} }, { name: 'Client Meeting (2x)', role_hours: {} }] },
    { name: '2.0 Scrum', tasks: [{ name: 'Scrum Definition', role_hours: {} }, { name: 'Scrum Monitoring', role_hours: {} }] },
  ]);

  // Dynamic WBS Templates loaded from Master
  const [dbTemplates, setDbTemplates] = useState<Array<{ id: number; name: string; category: string; description: string | null; payload: unknown }>>([]);

  useEffect(() => {
    fetch('/api/templates?active_only=true')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.templates)) {
          setDbTemplates(data.templates);
        }
      })
      .catch(() => {});
  }, []);

  // Maintenance WBS state (Maintenance Website Company Profile 2026)
  const [maintenanceDurationMonths, setMaintenanceDurationMonths] = useState<number>(12);
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTaskInput[]>([
    { name: 'Dev Ops (Manhour)', role_hours: {} },
    { name: 'Web Programmer (Manhour)', role_hours: {} },
  ]);

  // Operational WBS state (Section D)
  const [operationalItems, setOperationalItems] = useState<OperationalItemInput[]>([
    {
      name: 'Tiket Pesawat PP & Transportasi',
      people_count: 2,
      days_count: 1,
      unit_cost_per_day: 750000,
      notes: 'Kickoff meeting client',
    },
    {
      name: 'Hotel & Penginapan',
      people_count: 2,
      days_count: 2,
      unit_cost_per_day: 650000,
      notes: 'Akomodasi 2 malam',
    },
  ]);

  const addOperationalItem = () => {
    setOperationalItems((prev) => [
      ...prev,
      {
        name: 'Item Operasional Baru',
        people_count: 1,
        days_count: 1,
        unit_cost_per_day: 0,
        notes: '',
      },
    ]);
  };

  const removeOperationalItem = (idx: number) => {
    setOperationalItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateOperationalItem = (idx: number, patch: Partial<OperationalItemInput>) => {
    setOperationalItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
  };

  // Delivery Timeline Setup state
  const [timelineConfig, setTimelineConfig] = useState<{
    total_weeks: number;
    start_date?: string;
    milestones: Array<{ phase: string; duration_weeks: number; deliverable: string }>;
  }>({
    total_weeks: 4,
    start_date: '',
    milestones: [
      { phase: 'Requirement & UI/UX Design', duration_weeks: 1, deliverable: 'Design Prototype & SRS' },
      { phase: 'Core Development & Integration', duration_weeks: 2, deliverable: 'Staging Application & API' },
      { phase: 'UAT, Deployment & Go-Live', duration_weeks: 1, deliverable: 'Production Deployment' },
    ],
  });

  // Infrastructure WBS state
  const [infraItems, setInfraItems] = useState<InfrastructureItemInput[]>([
    {
      name: 'Beli Router Mikrotik RB750Gr3',
      billing_type: 'ONE_TIME',
      quantity: 1,
      unit_cost: 2500000,
      period_count: 1,
      notes: 'Hardware Utama',
    },
    {
      name: 'Jasa Pasang Jaringan & Kabel',
      billing_type: 'ONE_TIME',
      quantity: 1,
      unit_cost: 1500000,
      period_count: 1,
      notes: 'Setup & Terminasi Kabel',
    },
    {
      name: 'Cloud VPS Hosting High Memory',
      billing_type: 'MONTHLY',
      quantity: 1,
      unit_cost: 450000,
      period_count: 12,
      notes: 'Hosting Server Aplikasi',
    },
    {
      name: 'Domain .com / .id',
      billing_type: 'YEARLY',
      quantity: 1,
      unit_cost: 250000,
      period_count: 1,
      notes: 'Registrasi Domain',
    },
  ]);

  // Tab state for Section 4
  const [wbsTab, setWbsTab] = useState<'ALL' | 'DEV' | 'MAINTENANCE' | 'INFRASTRUCTURE' | 'OPERATION'>('ALL');

  // Loading & feedback
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiFiles, setAiFiles] = useState<File[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [aiChatHistory, setAiChatHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string; time: string }>>([]);

  const generateAIDraft = async () => {
    if (!aiPrompt.trim() && !aiFiles.length) {
      setErrorMsg('Masukkan prompt atau lampirkan file.');
      return;
    }
    setAiLoading(true);
    setErrorMsg(null);
    try {
      const currentSnapshot = {
        company_id: selectedCompanyId,
        project_id: selectedProjectId,
        categories: selectedCategories.map(c => c.code),
        tag_id: selectedTagId,
        development_modules: modules,
        maintenance_config: isMaintenance ? {
          duration_months: maintenanceDurationMonths,
          tasks: maintenanceTasks,
        } : null,
        infrastructure_items: isInfrastructure ? infraItems : [],
        operational_items: isOperational ? operationalItems : [],
        notes: notes,
      };

      const body = new FormData();
      body.set('prompt', aiPrompt.trim());
      body.set('current_state', JSON.stringify(currentSnapshot));
      body.set('chat_history', JSON.stringify(aiChatHistory.map(m => ({ role: m.role, content: m.text }))));
      aiFiles.forEach((file) => body.append('files', file));

      const submittedPrompt = aiPrompt.trim();
      const res = await fetch('/api/ai/draft-costing', { method: 'POST', body });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Gagal membuat draft costing.');
      const draft = result.draft || result.data || result;
      const usedFallback = result.source === 'fallback';
      const fallbackNotice = 'Layanan AI gagal. Draft otomatis non-AI; periksa angka sebelum menyimpan.';
      if (draft.title) setTitle(draft.title);
      if (draft.notes || draft.summary_notes) setNotes(draft.notes || draft.summary_notes);

      const companyName = String(draft.company_name || draft.company || '').trim();
      let company = companies.find((c) => c.id === Number(draft.company_id) || c.name.toLowerCase() === companyName.toLowerCase());
      if (!company && draft.is_new_company && companyName) {
        const companyRes = await fetch('/api/companies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: companyName }) });
        const companyData = await companyRes.json();
        if (!companyRes.ok || !companyData.success) throw new Error(companyData.error || 'Gagal membuat perusahaan dari draft.');
        company = companyData.company;
        setCompanies((prev) => prev.some((item) => item.id === company!.id) ? prev : [...prev, company!]);
      }
      if (company) setSelectedCompanyId(company.id);

      const projectName = String(draft.project_name || draft.project || '').trim();
      let project = projects.find((p) => p.id === Number(draft.project_id) || (p.company_id === company?.id && p.name.toLowerCase() === projectName.toLowerCase()));
      if (!project && draft.is_new_project && projectName && company) {
        const projectRes = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: company.id, name: projectName, description: null }) });
        const projectData = await projectRes.json();
        if (!projectRes.ok || !projectData.success) throw new Error(projectData.error || 'Gagal membuat project dari draft.');
        project = projectData.project;
      }
      if (project) {
        setProjects((prev) => prev.some((item) => item.id === project!.id) ? prev : [...prev, project!]);
        setSelectedProjectId(project.id);
      }

      const serviceCode = String(draft.service_code || '').toLowerCase();
      const service = serviceTypes.find((item) => item.code.toLowerCase() === serviceCode);
      if (service) setSelectedServiceTypeId(service.id);
      const categoryCodes: string[] = Array.isArray(draft.categories) ? draft.categories : draft.category_codes || [];
      const matchedCategories = categories.filter((c) => (!service || c.service_type_id === service.id) && categoryCodes.some((code: string) => c.code.toLowerCase() === String(code).toLowerCase() || c.name.toLowerCase() === String(code).toLowerCase()));
      if (matchedCategories.length) setSelectedCategoryIds(matchedCategories.map((c) => c.id));
      const tagCode = String(draft.tag_code || draft.tag || '').toLowerCase();
      const hasDevelopment = matchedCategories.some((c) => ['DEV', 'DEVELOPMENT'].includes(c.code.toUpperCase()));
      const tag = hasDevelopment && tagCode ? tags.find((t) => t.id === Number(draft.tag_id) || t.code.toLowerCase() === tagCode || t.name.toLowerCase() === tagCode) : undefined;
      setSelectedTagId(tag?.id || '');
      // Draft AI memakai jam per KODE ROLE; dipetakan ke orang pertama pemegang kode itu di Rate Snapshot.
      const aiDropped = new Set<string>();
      const toPeople = (tasks: Array<{ name?: string; task_name?: string; role_hours?: Record<string, number | undefined> }>) =>
        (tasks || []).map((task) => {
          const r = assignRoleHoursToPeople(task.role_hours, people);
          r.dropped.forEach((c) => aiDropped.add(c));
          return { name: task.name || task.task_name || '', role_hours: r.hours };
        });
      const aiModules = draft.modules || draft.development_modules;
      if (Array.isArray(aiModules)) {
        setModules(aiModules.map((module: { name: string; tasks?: Array<{ name?: string; task_name?: string; role_hours?: Record<string, number | undefined> }> }) => ({
          name: module.name,
          tasks: toPeople(module.tasks || []),
        })));
      }
      const maintenance = draft.maintenance_config || draft.maintenance;
      if (maintenance) {
        if (maintenance.duration_months != null) setMaintenanceDurationMonths(Number(maintenance.duration_months));
        if (Array.isArray(maintenance.tasks)) {
          setMaintenanceTasks(toPeople(maintenance.tasks));
        } else if (Array.isArray(maintenance.roles)) {
          const roleHours: Record<string, number> = {};
          for (const role of maintenance.roles as Array<{ role_code?: string; code?: string; monthly_hours?: number; hours?: number }>) {
            const code = role.role_code || role.code || '';
            const value = Number(role.monthly_hours ?? role.hours ?? 0);
            if (code && value > 0) roleHours[code] = value;
          }
          setMaintenanceTasks(toPeople([{ name: 'Maintenance bulanan', role_hours: roleHours }]));
        }
      }
      if (aiDropped.size > 0) {
        setErrorMsg(`Jam untuk role ${Array.from(aiDropped).join(', ')} tidak dimasukkan karena belum ada orang dengan kode role itu di Rate Snapshot. Tambahkan orangnya lalu jalankan ulang draft.`);
      }
      const infrastructure = draft.infrastructure_items || draft.infrastructure;
      if (Array.isArray(infrastructure)) setInfraItems(infrastructure.map((item: InfrastructureItemInput) => ({ ...item, billing_type: item.billing_type || 'MONTHLY', quantity: Number(item.quantity) || 1, unit_cost: Number(item.unit_cost) || 0, period_count: Number(item.period_count) || 1, notes: item.notes || '' })));
      const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      setAiChatHistory(prev => [
        ...prev,
        { role: 'user', text: submittedPrompt || (aiFiles.length > 0 ? `Lampirkan ${aiFiles.length} file brief` : 'Generate costing'), time: nowTime },
        { role: 'assistant', text: usedFallback ? fallbackNotice : (draft.summary_notes || draft.summary || 'Draft costing telah diperbarui sesuai instruksi.'), time: nowTime }
      ]);
      setAiSummary(usedFallback ? fallbackNotice : (draft.summary_notes || draft.summary || 'Draft costing berhasil diperbarui.'));
      setSuccessMsg(usedFallback ? 'Layanan AI gagal. Draft otomatis non-AI diterapkan; periksa angka sebelum menyimpan.' : aiChatHistory.length > 0 ? 'Draft costing berhasil disesuaikan oleh AI!' : 'Draft costing AI berhasil diterapkan ke form.');
      setTimeout(() => setSuccessMsg(null), 4000);
      setAiPrompt('');
      setAiFiles([]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membuat draft costing.');
    } finally {
      setAiLoading(false);
    }
  };

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

      if (data.success) {
        setCompanies(data.companies || []);
        setServiceTypes(data.serviceTypes || []);
        setCategories(data.categories || []);
        setTags(data.tags || []);

        // Default to IT & Development only if NOT in edit mode
        if (!editId) {
          const itType = (data.serviceTypes || []).find((st: ServiceType) => st.code === 'IT');
          if (itType) setSelectedServiceTypeId(itType.id);

          const devCat = (data.categories || []).find((c: Category) => c.code === 'DEV' || c.code === 'DEVELOPMENT');
          if (devCat) {
            setSelectedCategoryIds([devCat.id]);
          } else if ((data.categories || []).length > 0) {
            setSelectedCategoryIds([data.categories[0].id]);
          }

          const initTag = (data.tags || []).find((t: Tag) => t.code === 'INITIAL');
          if (initTag) setSelectedTagId(initTag.id);

          if ((data.companies || []).length > 0) {
            setSelectedCompanyId(data.companies[0].id);
          }
        }
      }
    } catch {
      setErrorMsg('Gagal memuat metadata database.');
    }
  }, [editId]);

  // Load projects whenever selected company changes
  const loadProjectsForCompany = useCallback(async (companyId: number) => {
    setIsLoadingProjects(true);
    try {
      const res = await fetch(`/api/projects?company_id=${companyId}`);
      const data = await res.json();
      if (data.success) {
        const projs: Project[] = data.projects || [];
        setProjects(projs);
        setSelectedProjectId((current) => projs.some((project) => project.id === Number(current)) ? current : (projs[0]?.id || ''));
      }
    } catch (err) {
      console.error('Failed to load projects', err);
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCompanyId) {
      loadProjectsForCompany(Number(selectedCompanyId));
    } else {
      setProjects([]);
      setSelectedProjectId('');
    }
  }, [selectedCompanyId, loadProjectsForCompany]);

  // Handle create new project inline
  const handleCreateProject = async () => {
    if (!selectedCompanyId) {
      alert('Pilih perusahaan terlebih dahulu.');
      return;
    }
    if (!newProjectName.trim()) {
      setProjectError('Nama project wajib diisi.');
      return;
    }
    setIsSavingProject(true);
    setProjectError(null);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: Number(selectedCompanyId),
          name: newProjectName.trim(),
          description: newProjectDesc.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success && data.project) {
        const created: Project = data.project;
        setProjects((prev) => [...prev, created]);
        setSelectedProjectId(created.id);
        setNewProjectName('');
        setNewProjectDesc('');
        setIsCreatingProject(false);
        setSuccessMsg(`Project '${created.name}' berhasil dibuat!`);
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setProjectError(data.error || 'Gagal membuat project.');
      }
    } catch {
      setProjectError('Terjadi kesalahan jaringan.');
    } finally {
      setIsSavingProject(false);
    }
  };

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  // Prefill Form when edit_id is provided
  useEffect(() => {
    if (!editId) return;

    let isMounted = true;
    setIsEditLoading(true);

    fetch(`/api/estimates/${editId}`)
      .then((res) => res.json())
      .then(async (data) => {
        if (!isMounted || !data.success || !data.estimate) {
          setIsEditLoading(false);
          return;
        }

        const est = data.estimate;

        // 1. Versioning meta
        const hist = Array.isArray(est.version_history) ? est.version_history : [];
        const maxV = hist.reduce((max: number, item: { version?: number }) => Math.max(max, Number(item.version) || 1), Number(est.version) || 1);

        setEditingEstimateMeta({
          version: est.version,
          parent_id: est.parent_id,
          revision_notes: est.revision_notes,
          max_version: maxV,
        });

        // 2. Basic fields
        if (est.title) setTitle(est.title);
        if (est.notes) setNotes(est.notes);
        if (est.service_type_id) setSelectedServiceTypeId(est.service_type_id);
        if (est.tag_id) setSelectedTagId(est.tag_id);

        // 3. Company & Project
        if (est.company_id) {
          setSelectedCompanyId(est.company_id);
          try {
            const pRes = await fetch(`/api/projects?company_id=${est.company_id}`);
            const pData = await pRes.json();
            if (pData.success && Array.isArray(pData.projects)) {
              setProjects(pData.projects);
              if (est.project_id) {
                setSelectedProjectId(est.project_id);
              }
            }
          } catch (pErr) {
            console.error('Failed loading projects for edit prefill', pErr);
          }
        }

        // 4. Categories (supports multi-select)
        if (Array.isArray(est.categories) && est.categories.length > 0) {
          setSelectedCategoryIds(est.categories.map((c: Category) => c.id));
        } else if (est.category_id) {
          setSelectedCategoryIds([est.category_id]);
        }

        // 5. Rate snapshot = orang (role - nama - rate)
        const loadedPeople: PersonRateSnapshot = {};
        if (est.rate_snapshots && typeof est.rate_snapshots === 'object') {
          Object.entries(est.rate_snapshots as Record<string, { code?: string; name?: string; rate?: number }>).forEach(([key, item]) => {
            if (item && typeof item === 'object') {
              loadedPeople[key] = { code: String(item.code || ''), name: String(item.name || ''), rate: Number(item.rate) || 0 };
            }
          });
        }
        setPeople(loadedPeople);

        // 6. Development Modules & Tasks
        if (Array.isArray(est.modules) && est.modules.length > 0) {
          setModules(
            est.modules.map((m: ModuleInput) => ({
              name: m.name,
              tasks: Array.isArray(m.tasks)
                ? m.tasks.map((t) => ({ name: t.name, role_hours: t.role_hours || {} }))
                : [],
            }))
          );
        }

        // 7. Maintenance Config & Tasks
        if (est.maintenance_config) {
          const mConf = est.maintenance_config;
          if (mConf.duration_months) {
            setMaintenanceDurationMonths(Number(mConf.duration_months));
          }
          if (Array.isArray(mConf.tasks) && mConf.tasks.length > 0) {
            setMaintenanceTasks(
              mConf.tasks.map((t: MaintenanceTaskInput) => ({
                name: t.name || 'Maintenance Task',
                role_hours: t.role_hours || {},
              }))
            );
          }
        }

        // 8. Infrastructure Items
        if (Array.isArray(est.infrastructure_items)) {
          setInfraItems(est.infrastructure_items);
        }
        if (est.timeline_config && Array.isArray(est.timeline_config.milestones)) {
          setTimelineConfig(est.timeline_config);
        }

        // 9. Operational Items
        if (Array.isArray(est.operational_items)) {
          setOperationalItems(est.operational_items);
        }

        setIsEditLoading(false);
      })
      .catch((err) => {
        console.error('Failed to prefill estimate edit', err);
        if (isMounted) {
          setErrorMsg('Gagal memuat data estimasi untuk diedit.');
          setIsEditLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [editId]);

  // Derived multi-classification
  const selectedCategories = categories.filter((c) => selectedCategoryIds.includes(c.id));
  const isDevelopment = selectedCategories.some((c) => c.code === 'DEV' || c.code === 'DEVELOPMENT');
  const isMaintenance = selectedCategories.some((c) => c.code === 'MAINTENANCE');
  const isOperational = selectedCategories.some((c) => (c.code || '').toUpperCase() === 'OPERATION');
  const isInfrastructure = selectedCategories.some((c) => c.code === 'INFRASTRUCTURE');

  // Synchronize WBS Tab with selected categories
  useEffect(() => {
    if (wbsTab === 'DEV' && !isDevelopment) {
      if (isMaintenance) setWbsTab('MAINTENANCE');
      else if (isInfrastructure) setWbsTab('INFRASTRUCTURE');
    } else if (wbsTab === 'MAINTENANCE' && !isMaintenance) {
      if (isDevelopment) setWbsTab('DEV');
      else if (isInfrastructure) setWbsTab('INFRASTRUCTURE');
    } else if (wbsTab === 'INFRASTRUCTURE' && !isInfrastructure) {
      if (isDevelopment) setWbsTab('DEV');
      else if (isMaintenance) setWbsTab('MAINTENANCE');
    }
  }, [isDevelopment, isMaintenance, isInfrastructure, wbsTab]);

  // Filtered categories & tags
  const availableCategories = useMemo(() => {
    if (!selectedServiceTypeId) return [];
    return categories.filter((c) => c.service_type_id === Number(selectedServiceTypeId));
  }, [categories, selectedServiceTypeId]);

  const availableTags = useMemo(() => {
    return tags.filter((t) => t.applies_to_category_code === 'DEVELOPMENT' || t.applies_to_category_code === 'DEV');
  }, [tags]);

  const handleToggleCategory = (catId: number) => {
    setSelectedCategoryIds((prev) => {
      let next: number[];
      if (prev.includes(catId)) {
        if (prev.length === 1) return prev; // Keep at least 1 category selected
        next = prev.filter((id) => id !== catId);
      } else {
        next = [...prev, catId];
      }

      const hasDev = next.some((id) => {
        const cat = categories.find((c) => c.id === id);
        return cat?.code === 'DEV' || cat?.code === 'DEVELOPMENT';
      });

      if (hasDev) {
        if (!selectedTagId) {
          const initialTag = tags.find((t) => t.code === 'INITIAL');
          if (initialTag) setSelectedTagId(initialTag.id);
        }
      } else {
        setSelectedTagId('');
      }

      return next;
    });
  };

  // Live real-time calculations
  const calculation = useMemo(() => {
    if (!isDevelopment) {
      return {
        calcModules: [],
        hours_by_role: {},
        cost_by_role: {},
        total_hours: 0,
        total_cost: 0,
      };
    }
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
  }, [modules, rates, activeCostingRoles, isDevelopment]);

  // Maintenance calculation
  const maintCalculation = useMemo(() => {
    if (!isMaintenance) return null;
    try {
      return calculateMaintenance(
        { duration_months: maintenanceDurationMonths, tasks: maintenanceTasks },
        rates
      );
    } catch {
      return null;
    }
  }, [maintenanceDurationMonths, maintenanceTasks, rates, isMaintenance]);

  // Infrastructure calculation
  const infraCalculation = useMemo(() => {
    if (!isInfrastructure) return null;
    try {
      return calculateInfrastructure(infraItems);
    } catch {
      return null;
    }
  }, [infraItems, isInfrastructure]);

  // Operational Calculation
  const opCalculation = useMemo(() => {
    if (!isOperational) return null;
    try {
      return calculateOperational(operationalItems);
    } catch {
      return null;
    }
  }, [operationalItems, isOperational]);

  // Multi-Billing Summary
  const billingSummary = useMemo(() => {
    return calculateBillingSummary({
      hasDevelopment: isDevelopment,
      hasMaintenance: isMaintenance,
      hasInfrastructure: isInfrastructure,
      hasOperational: isOperational,
      devCost: calculation.total_cost,
      maintenanceConfig: maintCalculation,
      infrastructure: infraCalculation,
      operational: opCalculation,
    });
  }, [isDevelopment, isMaintenance, isInfrastructure, isOperational, calculation.total_cost, maintCalculation, infraCalculation, opCalculation]);

  // Maintenance Handlers
  const addMaintenanceTask = () => {
    setMaintenanceTasks((prev) => [
      ...prev,
      { name: 'Task Maintenance Rutin', role_hours: {} },
    ]);
  };

  const removeMaintenanceTask = (index: number) => {
    setMaintenanceTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const updateMaintenanceTaskField = (index: number, field: string, val: string) => {
    setMaintenanceTasks((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const updateMaintenanceTaskRoleHours = (index: number, roleCode: string, hours: number) => {
    setMaintenanceTasks((prev) => {
      const copy = [...prev];
      const cur = copy[index];
      const rh = { ...(cur.role_hours || {}) };
      if (hours > 0) {
        rh[roleCode] = hours;
      } else {
        delete rh[roleCode];
      }
      copy[index] = { ...cur, role_hours: rh };
      return copy;
    });
  };

  // Infrastructure Handlers
  const addInfraItem = () => {
    setInfraItems((prev) => [
      ...prev,
      {
        name: 'Item Infrastruktur Baru',
        billing_type: 'ONE_TIME',
        quantity: 1,
        unit_cost: 0,
        period_count: 1,
        notes: '',
      },
    ]);
  };

  // Template/AI menyimpan jam per KODE ROLE. Jam dialokasikan ke orang pertama yang memegang kode itu;
  // kode yang tidak dimiliki siapa pun dilaporkan agar user menambah orangnya.
  const mapTasksToPeople = <T extends { name: string; role_hours?: Record<string, number | undefined> }>(tasks: T[]) => {
    const dropped = new Set<string>();
    const mapped = tasks.map((t) => {
      const r = assignRoleHoursToPeople(t.role_hours, people);
      r.dropped.forEach((c) => dropped.add(c));
      return { name: t.name, role_hours: r.hours };
    });
    return { mapped, dropped: Array.from(dropped) };
  };

  const applyDevelopmentTemplate = (name: string, payload: unknown) => {
    if (!Array.isArray(payload)) { setErrorMsg('Template Development kosong atau formatnya tidak valid.'); return; }
    const isTask = (item: unknown): item is TaskInput => {
      if (!item || typeof item !== 'object' || typeof (item as TaskInput).name !== 'string' || !(item as TaskInput).name.trim()) return false;
      const hours = (item as TaskInput).role_hours;
      return hours === undefined || (!!hours && typeof hours === 'object' && !Array.isArray(hours)
        && Object.values(hours).every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0));
    };
    if (!payload.length || !payload.every(isTask)) { setErrorMsg('Template Development kosong atau formatnya tidak valid.'); return; }
    if (Object.keys(people).length === 0) { setErrorMsg('Tambahkan minimal 1 orang di Rate Snapshot sebelum memakai template.'); return; }
    const { mapped, dropped } = mapTasksToPeople(payload as TaskInput[]);
    if (!mapped.length) { setErrorMsg('Template Development kosong atau formatnya tidak valid.'); return; }
    if (modules.some(module => module.tasks.length > 0) && !window.confirm('Template akan mengganti seluruh modul Development saat ini. Lanjutkan?')) return;
    setModules([{ name, tasks: mapped }]);
    setErrorMsg(dropped.length ? `Jam untuk role ${dropped.join(', ')} tidak dimasukkan karena belum ada orang dengan kode role itu di Rate Snapshot.` : null);
  };

  const applyOperationalTemplate = (payload: unknown) => {
    if (!Array.isArray(payload)) return;
    const isItem = (item: unknown): item is OperationalItemInput => {
      if (!item || typeof item !== 'object') return false;
      const x = item as OperationalItemInput;
      const cost = x.unit_cost_per_day ?? x.unit_cost;
      return typeof x.name === 'string' && !!x.name.trim()
        && typeof x.people_count === 'number' && Number.isFinite(x.people_count) && x.people_count > 0
        && typeof x.days_count === 'number' && Number.isFinite(x.days_count) && x.days_count > 0
        && typeof cost === 'number' && Number.isFinite(cost) && cost >= 0
        && (x.notes === undefined || typeof x.notes === 'string');
    };
    if (!payload.length || !payload.every(isItem)) { setErrorMsg('Template Operation kosong atau formatnya tidak valid.'); return; }
    const items = (payload as OperationalItemInput[]).map(item => ({
      name: item.name, people_count: item.people_count, days_count: item.days_count,
      unit_cost_per_day: item.unit_cost_per_day ?? item.unit_cost ?? 0, notes: item.notes || '',
    }));
    if (!items.length) { setErrorMsg('Template Operation kosong atau formatnya tidak valid.'); return; }
    if (operationalItems.length > 0 && !window.confirm('Template akan mengganti seluruh item Operation saat ini. Lanjutkan?')) return;
    setOperationalItems(items);
    setErrorMsg(null);
  };

  const applyInfrastructureTemplate = (payload: unknown) => {
    if (!Array.isArray(payload)) return;
    const billingTypes = new Set<InfraBillingType>(['ONE_TIME', 'MONTHLY', 'YEARLY']);
    const isItem = (item: unknown): item is InfrastructureItemInput => {
      if (!item || typeof item !== 'object') return false;
      const x = item as InfrastructureItemInput;
      return typeof x.name === 'string' && !!x.name.trim() && billingTypes.has(x.billing_type)
        && typeof x.quantity === 'number' && Number.isFinite(x.quantity) && x.quantity > 0
        && typeof x.unit_cost === 'number' && Number.isFinite(x.unit_cost) && x.unit_cost >= 0
        && (x.period_count === undefined || (typeof x.period_count === 'number' && Number.isInteger(x.period_count) && x.period_count > 0))
        && (x.notes === undefined || typeof x.notes === 'string');
    };
    if (!payload.length || !payload.every(isItem)) { setErrorMsg('Template Infrastructure kosong atau formatnya tidak valid.'); return; }
    const items = (payload as InfrastructureItemInput[]).map(item => ({ ...item, period_count: item.period_count ?? 1, notes: item.notes || '' }));
    if (!items.length) { setErrorMsg('Template Infrastructure kosong atau formatnya tidak valid.'); return; }
    if (infraItems.length > 0 && !window.confirm('Template akan mengganti seluruh item Infrastructure saat ini. Lanjutkan?')) return;
    setInfraItems(items);
    setErrorMsg(null);
  };

  const removeInfraItem = (index: number) => {
    setInfraItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateInfraItemField = (
    index: number,
    field: keyof InfrastructureItemInput,
    val: string | number
  ) => {
    setInfraItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const totalModuleCount = modules.length;
  const totalTaskCount = useMemo(
    () => modules.reduce((acc, m) => acc + m.tasks.length, 0),
    [modules]
  );

  // Quick Demo Loaders

  // Reset all form inputs to default clean state
  const handleResetForm = () => {
    if (typeof window !== 'undefined' && !window.confirm('Reset seluruh isi form ke kondisi bersih/awal?')) {
      return;
    }
    setPeople({});
    setTitle('');
    if (companies.length > 0) setSelectedCompanyId(companies[0].id);
    else setSelectedCompanyId('');
    setSelectedProjectId('');
    const itType = serviceTypes.find((st) => st.code === 'IT');
    if (itType) setSelectedServiceTypeId(itType.id);
    const devCat = categories.find((c) => c.code === 'DEV' || c.code === 'DEVELOPMENT');
    if (devCat) setSelectedCategoryIds([devCat.id]);
    const initTag = tags.find((t) => t.code === 'INITIAL');
    if (initTag) setSelectedTagId(initTag.id);
    setWbsTab('ALL');
    setMaintenanceDurationMonths(1);
    setModules([
      {
        name: '1.0 Core Features',
        tasks: [
          { name: 'Feature Implementation', role_hours: {} },
        ],
      },
    ]);
    setMaintenanceTasks([
      { name: 'Server Monitoring & Bug Fixes', role_hours: {} },
    ]);
    setInfraItems([]);
    setOperationalItems([]);
    setAiPrompt('');
    setAiFiles([]);
    setAiSummary('');
    setAiChatHistory([]);
    setNotes('');
    setErrorMsg(null);
    setSuccessMsg('Form berhasil di-reset.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const applyMaintenanceTemplate = (tplPayload: unknown) => {
    if (!Array.isArray(tplPayload) || tplPayload.length === 0) return;
    if (Object.keys(people).length === 0) { setErrorMsg('Tambahkan minimal 1 orang di Rate Snapshot sebelum memakai template.'); return; }
    const { mapped, dropped } = mapTasksToPeople(
      tplPayload.map((t: MaintenanceTaskInput) => ({ name: t.name || 'Maintenance Task', role_hours: t.role_hours || {} }))
    );
    setMaintenanceTasks(mapped);
    setErrorMsg(dropped.length ? `Jam untuk role ${dropped.join(', ')} tidak dimasukkan karena belum ada orang dengan kode role itu di Rate Snapshot.` : null);
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
          { name: 'Task 1', role_hours: {} },
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
    next[mIdx].tasks.push({ name: `Task ${next[mIdx].tasks.length + 1}`, role_hours: {} });
    setModules(next);
  };

  const removeTask = (mIdx: number, tIdx: number) => {
    const next = [...modules];
    next[mIdx].tasks = next[mIdx].tasks.filter((_, idx) => idx !== tIdx);
    setModules(next);
  };

  const updateTaskField = (mIdx: number, tIdx: number, _field: 'name', val: string | number) => {
    const next = [...modules];
    next[mIdx].tasks[tIdx] = { ...next[mIdx].tasks[tIdx], name: String(val) };
    setModules(next);
  };

  const updateTaskRoleHours = (mIdx: number, tIdx: number, personKey: string, val: string) => {
    const next = [...modules];
    const task = { ...next[mIdx].tasks[tIdx] };
    task.role_hours = { ...(task.role_hours || {}), [personKey]: Math.max(0, Number(val) || 0) };
    next[mIdx].tasks[tIdx] = task;
    setModules(next);
  };

  // ---- Rate Snapshot (orang): tambah / ubah / hapus ----
  const addPerson = () => {
    setPeople((prev) => ({
      ...prev,
      [nextPersonKey(Object.keys(prev))]: { code: roles[0]?.code || '', name: '', rate: 0 },
    }));
  };

  const updatePerson = (key: string, patch: Partial<{ code: string; name: string; rate: number }>) => {
    setPeople((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const removePerson = (key: string) => {
    setPeople((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    const strip = (rh?: Record<string, number | undefined>) => {
      const copy = { ...(rh || {}) };
      delete copy[key];
      return copy;
    };
    setModules((prev) => prev.map((m) => ({ ...m, tasks: m.tasks.map((t) => ({ ...t, role_hours: strip(t.role_hours) })) })));
    setMaintenanceTasks((prev) => prev.map((t) => ({ ...t, role_hours: strip(t.role_hours) })));
  };

  const executeSubmit = async (reasonText?: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);
    setIsRevisionModalOpen(false);

    const isEditMode = editId !== null && !isNaN(editId);
    const endpoint = isEditMode ? `/api/estimates/${editId}` : '/api/estimates';
    const method = isEditMode ? 'PUT' : 'POST';

    try {
      const payload = {
        title: (projects.find(p => p.id === Number(selectedProjectId))?.name || title || 'Project Estimate').trim(),
        company_id: Number(selectedCompanyId),
        project_id: Number(selectedProjectId),
        service_type_id: Number(selectedServiceTypeId),
        category_ids: selectedCategoryIds,
        category_id: selectedCategoryIds[0],
        tag_id: isDevelopment && selectedTagId ? Number(selectedTagId) : null,
        notes: notes.trim() || null,
        rate_snapshots: people,
        modules: isDevelopment ? modules : [],
        maintenance_config: isMaintenance ? {
          duration_months: maintenanceDurationMonths,
          tasks: maintenanceTasks,
        } : null,
        infrastructure_items: isInfrastructure ? infraItems : null,
        operational_items: isOperational ? operationalItems : null,
        timeline_config: timelineConfig,
        revision_notes: reasonText || revisionReason || null,
      };

      const res = await fetch(endpoint, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Gagal menyimpan estimate.');
      } else {
        const resultId = data.estimate_id || (isEditMode ? editId : data.estimate?.id);
        const nextVer = data.version || (editingEstimateMeta?.version || 1) + 1;
        setSuccessMsg(
          isEditMode
            ? `Berhasil menyimpan revisi v${nextVer} #${resultId} (${formatIDR(data.total_cost || billingSummary.grand_total)}). Mengalihkan ke dashboard...`
            : `Berhasil menyimpan estimate ID #${resultId} (${data.estimate?.total_hours || calculation.total_hours} Jam, ${formatIDR(data.estimate?.total_cost || billingSummary.grand_total)}). Mengalihkan ke halaman utama...`
        );
        setTimeout(() => {
          if (data.estimate_id) {
            router.push(`/estimates/${data.estimate_id}`);
          } else {
            router.push('/');
          }
        }, 1000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit and save estimate
  const handleSaveEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const isEditMode = editId !== null && !isNaN(editId);

    if (!selectedCompanyId) {
      setErrorMsg('Perusahaan wajib dipilih.');
      return;
    }
    if (!selectedProjectId) {
      setErrorMsg('Project wajib dipilih atau dibuat.');
      return;
    }
    if (!selectedServiceTypeId) {
      setErrorMsg('Service Type wajib dipilih.');
      return;
    }
    if (selectedCategoryIds.length === 0) {
      setErrorMsg('Minimal 1 Kategori proyek wajib dipilih.');
      return;
    }

    if (isDevelopment && !selectedTagId) {
      setErrorMsg("Kategori menyertakan 'Development' wajib memilih Tag: Initial atau CR.");
      return;
    }

    if (!isDevelopment && selectedTagId) {
      setErrorMsg("Tag HANYA berlaku jika kategori menyertakan Development.");
      return;
    }

    // In Edit mode, prompt for revision reason before submitting!
    if (isEditMode) {
      const targetV = ((editingEstimateMeta?.max_version ?? editingEstimateMeta?.version) || 1) + 1;
      setRevisionReason(`Revisi penyesuaian scope v${targetV} (dari v${editingEstimateMeta?.version || 1})`);
      setIsRevisionModalOpen(true);
      return;
    }

    await executeSubmit();
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', paddingBottom: '120px' }}>
      <main style={{ maxWidth: '1360px', margin: '0 auto', padding: '24px' }}>
        {/* Navigation & Header */}
        <div style={{ marginBottom: '24px' }}>


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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                {editId ? `Edit / Revisi Estimasi #${editId}` : 'Buat Costing Baru'}
                {editId && editingEstimateMeta?.version && (
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: 'var(--accent-hover)',
                    }}
                  >
                    Snapshot v{editingEstimateMeta.version}
                  </span>
                )}
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                {editId 
                  ? `Mengedit dari snapshot v${editingEstimateMeta?.version || 1}. Saat disimpan akan tercatat sebagai versi terbaru v${((editingEstimateMeta?.max_version ?? editingEstimateMeta?.version) || 1) + 1}.`
                  : 'Formulir pembuatan kalkulasi WBS, modul, dan manhours costing proyek IT Development & Maintenance'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleResetForm}
                className="btn-secondary"
                style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                title="Kosongkan seluruh isian form dan mulai dari awal"
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><TrashIcon style={{ width: "15px", height: "15px" }} /><span>Reset Form</span></span>
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

        <section className="linear-card" style={{ padding: '20px', marginBottom: '24px', border: '1px solid var(--accent-hover)', background: 'rgba(94, 106, 210, 0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><SparklesIcon style={{ width: "16px", height: "16px", color: "var(--accent-hover)" }} /><span>AI Costing Assistant (Hermes)</span></span>
                {aiChatHistory.length > 0 && (
                  <span className="badge badge-accent" style={{ fontSize: '10px' }}>
                    {aiChatHistory.filter(m => m.role === 'user').length} Iterasi Penyesuaian
                  </span>
                )}
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                Input brief awal atau ketik instruksi penyesuaian lanjutan untuk menyempurnakan draft costing secara reaktif.
              </p>
            </div>
            {aiChatHistory.length > 0 && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => { setAiChatHistory([]); setAiSummary(''); }}
                style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}
                title="Bersihkan riwayat percakapan AI"
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><ArrowPathIcon style={{ width: "14px", height: "14px" }} /><span>Reset Chat AI</span></span>
              </button>
            )}
          </div>

          {/* Interactive Chat History Box */}
          {aiChatHistory.length > 0 && (
            <div
              style={{
                marginBottom: '16px',
                padding: '12px',
                background: 'rgba(0, 0, 0, 0.25)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                maxHeight: '260px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              {aiChatHistory.map((msg, mIdx) => (
                <div
                  key={mIdx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-tertiary)',
                      marginBottom: '2px',
                      textAlign: msg.role === 'user' ? 'right' : 'left',
                    }}
                  >
                    {msg.role === 'user' ? 'Anda' : 'Hermes AI'} • {msg.time}
                  </div>
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      lineHeight: '1.45',
                      background: msg.role === 'user' ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
                      color: msg.role === 'user' ? '#ffffff' : 'var(--text-primary)',
                      border: msg.role === 'user' ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Prompt / Adjustment Textarea */}
          <textarea
            className="linear-textarea"
            rows={aiChatHistory.length > 0 ? 2 : 3}
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder={
              aiChatHistory.length > 0
                ? "Ketik instruksi penyesuaian (Contoh: 'Tambahkan modul Payment Gateway 20 jam Web Dev', 'Ubah maintenance jadi 6 bulan', atau 'Hapus modul Scrum')..."
                : "Jelaskan kebutuhan costing proyek, atau lampirkan dokumen/gambar brief..."
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                generateAIDraft();
              }
            }}
          />

          {/* Attachment Dropzone */}
          <div
            style={{
              marginTop: '10px',
              padding: '12px',
              border: '1px dashed var(--border-hover)',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.01)',
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              setAiFiles((prev) => [
                ...prev,
                ...Array.from(e.dataTransfer.files).filter((f) =>
                  /\.(xlsx|xls|csv|pdf|docx|txt|png|jpe?g|webp)$/i.test(f.name)
                ),
              ]);
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <label style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><PaperClipIcon style={{ width: "15px", height: "15px", verticalAlign: "middle" }} /><strong>Tambah Lampiran File</strong></span> (xlsx, csv, pdf, docx, gambar mockup/arsitektur)
                <input
                  type="file"
                  multiple
                  accept=".xlsx,.xls,.csv,.pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
                  style={{ display: 'none' }}
                  onChange={(e) =>
                    setAiFiles((prev) => [
                      ...prev,
                      ...Array.from(e.target.files || []).filter((f) =>
                        /\.(xlsx|xls|csv|pdf|docx|txt|png|jpe?g|webp)$/i.test(f.name)
                      ),
                    ])
                  }
                />
              </label>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                Tekan <strong>Ctrl+Enter</strong> untuk kirim prompt
              </span>
            </div>

            {aiFiles.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                {aiFiles.map((file, i) => (
                  <span
                    key={`${file.name}-${i}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 8px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      fontSize: '11px',
                    }}
                  >
                    {file.type.startsWith('image/') && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={URL.createObjectURL(file)} alt="" style={{ width: 20, height: 20, objectFit: 'cover', borderRadius: '3px' }} />
                    )}
                    <b>{file.name.split('.').pop()?.toUpperCase()}</b> {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    <button
                      type="button"
                      aria-label={`Hapus ${file.name}`}
                      onClick={() => setAiFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '0 2px' }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Action Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={generateAIDraft}
              disabled={aiLoading}
              style={{ fontSize: '13px' }}
            >
              {aiLoading ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <ArrowPathIcon className="animate-spin" style={{ width: '15px', height: '15px' }} />
                  <span>Menganalisis & Mengatur Ulang Draft...</span>
                </span>
              ) : aiChatHistory.length > 0 ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <SparklesIcon style={{ width: '15px', height: '15px' }} />
                  <span>Terapkan Penyesuaian ke Form</span>
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <BoltIcon style={{ width: '15px', height: '15px' }} />
                  <span>Generate Draft Costing</span>
                </span>
              )}
            </button>
            {aiLoading && (
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                Hermes busdev sedang memperbarui modul dan kalkulasi...
              </span>
            )}
          </div>
        </section>
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

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label
                    style={{
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    Project Perusahaan *
                  </label>
                  {selectedCompanyId && (
                    <button
                      type="button"
                      onClick={() => setIsCreatingProject(!isCreatingProject)}
                      className="btn-ghost"
                      style={{ fontSize: '11px', color: 'var(--accent-hover)', padding: '0 4px' }}
                    >
                      {isCreatingProject ? 'Tutup Form' : '+ Buat Project Baru'}
                    </button>
                  )}
                </div>
                <select
                  className="linear-select"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : '')}
                  disabled={!selectedCompanyId || isLoadingProjects}
                  required
                >
                  <option value="">
                    {!selectedCompanyId
                      ? '-- Pilih Perusahaan Terlebih Dahulu --'
                      : isLoadingProjects
                      ? 'Memuat daftar project...'
                      : projects.length === 0
                      ? '-- Belum ada project (Klik + Buat Project Baru) --'
                      : '-- Pilih Project --'}
                  </option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Inline Create Project Form */}
            {isCreatingProject && (
              <div
                className="linear-card-elevated"
                style={{
                  marginTop: '16px',
                  padding: '16px',
                  border: '1px dashed var(--border-hover)',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Buat Project Baru untuk Perusahaan Terpilih
                </div>
                {projectError && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '8px' }}>
                    {projectError}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>
                      Nama Project *
                    </label>
                    <input
                      type="text"
                      className="linear-input"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="Misal: Redesign Portal Web 2026"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>
                      Deskripsi Project (Opsional)
                    </label>
                    <input
                      type="text"
                      className="linear-input"
                      value={newProjectDesc}
                      onChange={(e) => setNewProjectDesc(e.target.value)}
                      placeholder="Keterangan singkat scope atau tujuan project"
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingProject(false);
                      setProjectError(null);
                    }}
                    className="btn-secondary"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateProject}
                    className="btn-primary"
                    disabled={isSavingProject || !newProjectName.trim()}
                  >
                    {isSavingProject ? 'Menyimpan...' : 'Simpan Project'}
                  </button>
                </div>
              </div>
            )}

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

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1.2fr) minmax(460px, 2.1fr) minmax(220px, 0.9fr)', gap: '20px', alignItems: 'start' }}>
              {/* Col 1: Service Type */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                  Service Type
                </label>
                <div className="pill-group" style={{ height: '43px' }}>
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
                        <span>{st.code === 'IT' ? 'IT (Information Technology)' : 'Digital Marketing'}</span>
                        {isReserved && (
                          <span style={{ fontSize: '10px', opacity: 0.6, marginLeft: '4px' }}>(Reserved)</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Col 2: Kategori Proyek (Wider Column in 1 Row) */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-tertiary)' }}>
                    Kategori Proyek (Multi-Select) *
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--accent-hover)' }}>
                    {selectedCategoryIds.length} Terpilih
                  </span>
                </div>
                <div className="pill-group" style={{ display: 'flex', gap: '6px', height: '43px', padding: '4px' }}>
                  {availableCategories.map((c) => {
                    const isSelected = selectedCategoryIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleToggleCategory(c.id)}
                        className={`pill-item ${isSelected ? 'active' : ''}`}
                        style={{ flex: 1, minWidth: '0', padding: '0 8px', fontSize: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  Pilih kombinasi: Development, Maintenance, Infrastructure, Operation
                </div>
              </div>

              {/* Col 3: Tag Klasifikasi */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                  Tag Klasifikasi {isDevelopment ? (
                    <span style={{ color: 'var(--accent-hover)' }}>(Wajib untuk Dev)</span>
                  ) : (
                    <span style={{ color: 'var(--text-tertiary)' }}>(Tidak berlaku tanpa Dev)</span>
                  )}
                </label>
                {isDevelopment ? (
                  <div className="pill-group" style={{ height: '43px' }}>
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
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', padding: '12px 0', fontStyle: 'italic' }}>
                    Tag hanya aktif jika kategori menyertakan Development.
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
                      {activeCostingRoles.length} Orang
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    Daftar orang untuk costing: kode role, nama, dan rate per jam. Disimpan independen pada tiap estimate.
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    addPerson();
                  }}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  + Tambah Orang
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
              <div
                style={{
                  marginTop: '20px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {Object.keys(people).length === 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', padding: '8px 0' }}>
                    Belum ada orang. Klik &quot;+ Tambah Orang&quot; lalu pilih kode role, isi nama, dan rate per jam.
                  </div>
                )}
                {Object.entries(people).map(([key, person]) => (
                  <div
                    key={key}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(150px, 1fr) minmax(200px, 2fr) minmax(150px, 1fr) auto',
                      gap: '10px',
                      alignItems: 'center',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                    }}
                  >
                    <select
                      className="linear-input"
                      value={person.code}
                      onChange={(e) => updatePerson(key, { code: e.target.value })}
                      aria-label="Kode role"
                      style={{ fontSize: '12px', padding: '6px 8px' }}
                    >
                      {!roles.some((r) => r.code === person.code) && <option value={person.code}>{person.code || '— pilih role —'}</option>}
                      {roles.map((r) => (
                        <option key={r.code} value={r.code}>{r.code}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className="linear-input"
                      value={person.name}
                      maxLength={100}
                      placeholder="Nama orang"
                      aria-label="Nama orang"
                      onChange={(e) => updatePerson(key, { name: e.target.value })}
                      style={{ fontSize: '12px', padding: '6px 8px' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Rp</span>
                      <input
                        type="number"
                        min="0"
                        className="linear-input font-mono-numbers"
                        value={person.rate || ''}
                        placeholder="0"
                        aria-label="Rate per jam"
                        onChange={(e) => updatePerson(key, { rate: Math.max(0, Number(e.target.value) || 0) })}
                        style={{ textAlign: 'right', fontSize: '12px', padding: '6px 8px' }}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => removePerson(key)}
                      title="Hapus orang dari costing"
                      style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--text-tertiary)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                    >
                      <TrashIcon style={{ width: '14px', height: '14px' }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 4: Separated WBS Categories Breakdown */}
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
                    WBS Breakdown Berdasarkan Kategori Proyek
                  </h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    Alokasi WBS terpisah independen: Development (One-Time), Maintenance (Bulanan), dan Infrastructure (Setup & Recurring)
                  </p>
                </div>
              </div>
            </div>

            {/* Tab Selector if multiple categories selected */}
            {(isDevelopment ? 1 : 0) + (isMaintenance ? 1 : 0) + (isInfrastructure ? 1 : 0) > 1 && (
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  marginBottom: '20px',
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: '10px',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  onClick={() => setWbsTab('ALL')}
                  className={wbsTab === 'ALL' ? 'btn-primary' : 'btn-secondary'}
                  style={{ fontSize: '12px', padding: '6px 14px' }}
                >
                  Tampilkan Semua WBS
                </button>
                {isDevelopment && (
                  <button
                    type="button"
                    onClick={() => setWbsTab('DEV')}
                    className={wbsTab === 'DEV' ? 'btn-primary' : 'btn-secondary'}
                    style={{ fontSize: '12px', padding: '6px 14px' }}
                  >
                    Development WBS ({formatIDR(calculation.total_cost)})
                  </button>
                )}
                {isMaintenance && (
                  <button
                    type="button"
                    onClick={() => setWbsTab('MAINTENANCE')}
                    className={wbsTab === 'MAINTENANCE' ? 'btn-primary' : 'btn-secondary'}
                    style={{ fontSize: '12px', padding: '6px 14px' }}
                  >
                    Maintenance WBS ({formatIDR(maintCalculation ? maintCalculation.monthly_cost : 0)}/bln)
                  </button>
                )}
                {isInfrastructure && (
                  <button
                    type="button"
                    onClick={() => setWbsTab('INFRASTRUCTURE')}
                    className={wbsTab === 'INFRASTRUCTURE' ? 'btn-primary' : 'btn-secondary'}
                    style={{ fontSize: '12px', padding: '6px 14px' }}
                  >
                    Infrastructure Items ({formatIDR(infraCalculation ? infraCalculation.grand_total : 0)})
                  </button>
                )}
                {isOperational && (
                  <button
                    type="button"
                    onClick={() => setWbsTab('OPERATION')}
                    className={wbsTab === 'OPERATION' ? 'btn-primary' : 'btn-secondary'}
                    style={{ fontSize: '12px', padding: '6px 14px' }}
                  >
                    Operation Items ({formatIDR(opCalculation ? opCalculation.grand_total : 0)})
                  </button>
                )}
              </div>
            )}

            {/* TAB / BOX A: DEVELOPMENT WBS (Only if Development chosen) */}
            {isDevelopment && (wbsTab === 'ALL' || wbsTab === 'DEV') && (
              <div
                className="linear-card-elevated"
                style={{
                  padding: '20px',
                  marginBottom: '24px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(255, 255, 255, 0.01)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                    flexWrap: 'wrap',
                    gap: '12px',
                    borderBottom: '1px solid var(--border-subtle)',
                    paddingBottom: '12px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge badge-accent" style={{ fontSize: '11px' }}>
                        ONE-TIME PAYMENT
                      </span>
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        A. WBS Development (Modul & Tasks Manhours)
                      </h3>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                      Subtotal Development: <strong style={{ color: '#10b981' }}>{formatIDR(calculation.total_cost)}</strong> ({calculation.total_hours} Jam)
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {dbTemplates.filter(t => t.category === 'DEVELOPMENT').map(t => (
                      <button key={t.id} type="button" onClick={() => applyDevelopmentTemplate(t.name, t.payload)} className="btn-secondary" style={{ fontSize: '11px' }} title={t.description || t.name}>
                        {t.name}
                      </button>
                    ))}
                    <button type="button" onClick={addModule} className="btn-secondary" style={{ fontSize: '12px' }}>
                      + Tambah Modul Dev
                    </button>
                  </div>
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
                        value={mod.name}
                        onChange={(e) => updateModuleName(mIdx, e.target.value)}
                        placeholder="Nama Modul"
                        style={{
                          maxWidth: '380px',
                          fontWeight: 600,
                          fontSize: '13px',
                          background: 'transparent',
                          border: 'none',
                          borderBottom: '1px dashed var(--border-subtle)',
                          borderRadius: 0,
                          padding: '3px 4px',
                          color: 'var(--text-primary)',
                          outline: 'none',
                          transition: 'border-color 0.15s ease',
                        }}
                        onFocus={(e) => (e.currentTarget.style.borderBottomColor = 'var(--accent-hover)')}
                        onBlur={(e) => (e.currentTarget.style.borderBottomColor = 'var(--border-subtle)')}
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
                  <div style={{ overflowX: 'auto', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                    <table className="excel-table">
                      <thead>
                        <tr>
                          <th style={{ minWidth: '220px', textAlign: 'left' }}>Nama Task</th>
                          {activeCostingRoles.map((r) => (
                            <th key={r.code} style={{ textAlign: 'center', minWidth: '70px' }} title={people[r.code]?.name || r.name}>
                              {r.name}
                            </th>
                          ))}
                          <th style={{ width: '9%', textAlign: 'right', minWidth: '70px' }}>Total Jam</th>
                          <th style={{ width: '12%', textAlign: 'right', minWidth: '95px' }}>Biaya</th>
                          <th style={{ width: '36px', textAlign: 'center' }}></th>
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
                                  className="excel-cell-input"
                                  value={task.name}
                                  onChange={(e) => updateTaskField(mIdx, tIdx, 'name', e.target.value)}
                                  placeholder="Nama task..."
                                />
                              </td>
                              {activeCostingRoles.map((r) => {
                                const val = task.role_hours?.[r.code] ?? 0;
                                return (
                                  <td key={r.code}>
                                    <input
                                      type="number"
                                      min="0"
                                      className="excel-cell-input font-mono-numbers"
                                      value={val || ''}
                                      onChange={(e) => updateTaskRoleHours(mIdx, tIdx, r.code, e.target.value)}
                                      style={{ textAlign: 'center' }}
                                      placeholder="-"
                                    />
                                  </td>
                                );
                              })}
                              <td style={{ textAlign: 'right' }}>
                                <div className="excel-cell-static font-mono-numbers" style={{ color: 'var(--text-secondary)' }}>
                                  {calcTask ? calcTask.total_hours : 0}h
                                </div>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div className="excel-cell-static font-mono-numbers" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {calcTask ? formatIDR(calcTask.total_cost) : 'Rp 0'}
                                </div>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => removeTask(mIdx, tIdx)}
                                  className="btn-ghost"
                                  style={{ color: 'var(--text-tertiary)', fontSize: '12px', padding: '4px', width: '100%', height: '100%' }}
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
          </div>
        )}

            {/* TAB / BOX B: MAINTENANCE WBS (Only if Maintenance chosen) */}
            {isMaintenance && (wbsTab === 'ALL' || wbsTab === 'MAINTENANCE') && (
              <div
                className="linear-card-elevated"
                style={{
                  padding: '20px',
                  marginBottom: '24px',
                  border: '1px solid rgba(56, 189, 248, 0.15)',
                  background: 'rgba(56, 189, 248, 0.01)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                    flexWrap: 'wrap',
                    gap: '12px',
                    borderBottom: '1px solid var(--border-subtle)',
                    paddingBottom: '12px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge badge-info" style={{ fontSize: '11px' }}>
                        MONTHLY RECURRING
                      </span>
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        B. WBS Maintenance (Alokasi Jam Kerja Rutin Bulanan)
                      </h3>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                      Rate/Bulan: <strong style={{ color: '#38bdf8' }}>{formatIDR(maintCalculation ? maintCalculation.monthly_cost : 0)}/bln</strong>
                      <span style={{ margin: '0 8px' }}>•</span>
                      Total Kontrak ({maintenanceDurationMonths} Bulan):{' '}
                      <strong style={{ color: '#10b981' }}>{formatIDR(maintCalculation ? maintCalculation.total_cost : 0)}</strong>
                    </div>
                  </div>

                  {/* Multiplier Durasi Kontrak & Template Selector WBS */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Durasi:</span>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={maintenanceDurationMonths}
                        onChange={(e) => setMaintenanceDurationMonths(Math.max(1, Number(e.target.value) || 1))}
                        className="linear-input font-mono-numbers"
                        style={{ width: '56px', textAlign: 'center', padding: '4px 6px', fontSize: '12px' }}
                      />
                      <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Bln</span>
                      <div style={{ display: 'flex', gap: '4px', marginLeft: '2px' }}>
                        {[1, 3, 6, 12].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setMaintenanceDurationMonths(m)}
                            className={maintenanceDurationMonths === m ? 'btn-primary' : 'btn-secondary'}
                            style={{ fontSize: '11px', padding: '2px 6px' }}
                          >
                            {m}bln
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderLeft: '1px solid var(--border-color)', paddingLeft: '12px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Template WBS:</span>
                      {dbTemplates
                        .filter((t) => t.category === 'MAINTENANCE')
                        .map((t) => {
                          const isMobile = t.name.toLowerCase().includes('mobile');
                          const isEcom = t.name.toLowerCase().includes('e-commerce') || t.name.toLowerCase().includes('ecommerce');
                          const isBasic = t.name.toLowerCase().includes('basic');
                          const label = isMobile
                            ? (isBasic ? 'Mobile Basic' : 'Mobile Expert')
                            : isEcom 
                              ? (isBasic ? 'E-Com Basic' : 'E-Com Expert')
                              : (isBasic ? 'Web Basic' : 'Web Expert');
                          const color = isMobile
                            ? (isBasic ? '#10b981' : '#06b6d4')
                            : isEcom 
                              ? (isBasic ? '#f59e0b' : '#ec4899') 
                              : (isBasic ? '#38bdf8' : '#c084fc');

                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => applyMaintenanceTemplate(t.payload)}
                              className="btn-secondary"
                              style={{
                                padding: '3px 8px',
                                fontSize: '11px',
                                minHeight: 'auto',
                                borderColor: `${color}66`,
                                color: color,
                              }}
                              title={t.description || t.name}
                            >
                              {label}
                            </button>
                          );
                        })}
                      <Link
                        href="/master"
                        target="_blank"
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-tertiary)',
                          textDecoration: 'none',
                          marginLeft: '4px',
                        }}
                        title="Buka menu Master Data untuk tambah/edit template"
                      >
                        Kelola
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Maintenance Tasks Table */}
                <div style={{ overflowX: 'auto', marginBottom: '12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <table className="excel-table">
                    <thead>
                      <tr>
                        <th style={{ minWidth: '220px', textAlign: 'left' }}>Task Maintenance Bulanan</th>
                        {activeCostingRoles.map((r) => (
                          <th key={r.code} style={{ textAlign: 'center', minWidth: '70px' }} title={people[r.code]?.name || r.name}>
                            {r.name}
                          </th>
                        ))}
                        <th style={{ width: '10%', textAlign: 'right', minWidth: '80px' }}>Jam/Bulan</th>
                        <th style={{ width: '15%', textAlign: 'right', minWidth: '105px' }}>Biaya/Bulan</th>
                        <th style={{ width: '36px', textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {maintenanceTasks.map((task, tIdx) => {
                        const calcTask = maintCalculation?.tasks[tIdx];
                        return (
                          <tr key={tIdx}>
                            <td>
                              <input
                                type="text"
                                className="excel-cell-input"
                                value={task.name}
                                onChange={(e) => updateMaintenanceTaskField(tIdx, 'name', e.target.value)}
                                placeholder="Nama task rutin..."
                              />
                            </td>
                            {activeCostingRoles.map((r) => {
                              const hours = task.role_hours?.[r.code] || 0;
                              return (
                                <td key={r.code}>
                                  <input
                                    type="number"
                                    min="0"
                                    className="excel-cell-input font-mono-numbers"
                                    value={hours === 0 ? '' : hours}
                                    onChange={(e) => updateMaintenanceTaskRoleHours(tIdx, r.code, Math.max(0, Number(e.target.value) || 0))}
                                    placeholder="-"
                                    style={{ textAlign: 'center' }}
                                  />
                                </td>
                              );
                            })}
                            <td style={{ textAlign: 'right' }}>
                              <div className="excel-cell-static font-mono-numbers" style={{ fontSize: '12px', fontWeight: 600 }}>
                                {calcTask ? calcTask.total_hours : 0}h
                              </div>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div className="excel-cell-static font-mono-numbers" style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8' }}>
                                {calcTask ? formatIDR(calcTask.monthly_cost) : 'Rp 0'}/bln
                              </div>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => removeMaintenanceTask(tIdx)}
                                className="btn-ghost"
                                style={{ color: 'var(--color-danger)', padding: '4px', fontSize: '12px', width: '100%', height: '100%' }}
                                title="Hapus Task Maintenance"
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

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px' }}>
                  <button
                    type="button"
                    onClick={addMaintenanceTask}
                    className="btn-secondary"
                    style={{ fontSize: '12px' }}
                  >
                    + Tambah Task Maintenance
                  </button>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Total Manhours Rutin: <strong className="font-mono-numbers">{maintCalculation ? maintCalculation.total_monthly_hours : 0} Jam/Bulan</strong>
                  </div>
                </div>
              </div>
            )}

            {/* TAB / BOX D: OPERATIONAL ITEMS (Only if Operation chosen) */}
            {isOperational && (wbsTab === 'ALL' || wbsTab === 'OPERATION') && (
              <div
                className="linear-card-elevated"
                style={{
                  padding: '20px',
                  marginBottom: '24px',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  background: 'rgba(245, 158, 11, 0.015)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                    flexWrap: 'wrap',
                    gap: '12px',
                    borderBottom: '1px solid var(--border-subtle)',
                    paddingBottom: '12px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge badge-warning" style={{ fontSize: '11px' }}>
                        EXPENSES & TRAVEL
                      </span>
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        D. WBS Operation & Travel Expenses (Transport, Hotel, dll.)
                      </h3>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                      Biaya operasional lapangan per orang per hari • Subtotal Operasional:{' '}
                      <strong style={{ color: '#f59e0b' }}>
                        {formatIDR(opCalculation ? opCalculation.grand_total : 0)}
                      </strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {dbTemplates.filter(t => t.category === 'OPERATION').map(t => (
                      <button key={t.id} type="button" onClick={() => applyOperationalTemplate(t.payload)} className="btn-secondary" style={{ fontSize: '11px' }} title={t.description || t.name}>
                        {t.name}
                      </button>
                    ))}
                    <button type="button" onClick={addOperationalItem} className="btn-secondary" style={{ fontSize: '12px' }}>
                      + Tambah Item Operasional
                    </button>
                  </div>
                </div>

                {/* Operational Items Excel Table */}
                <div style={{ overflowX: 'auto', marginBottom: '12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <table className="excel-table">
                    <thead>
                      <tr>
                        <th style={{ width: '28%', minWidth: '220px', textAlign: 'left' }}>Nama Item Operasional</th>
                        <th style={{ width: '9%', minWidth: '85px', textAlign: 'center' }}>Orang (Pax)</th>
                        <th style={{ width: '8%', minWidth: '75px', textAlign: 'center' }}>Hari</th>
                        <th style={{ width: '16%', minWidth: '130px', textAlign: 'right' }}>Rate / Hari / Pax (Rp)</th>
                        <th style={{ width: '16%', minWidth: '130px', textAlign: 'right' }}>Subtotal Biaya</th>
                        <th style={{ width: '20%', minWidth: '160px' }}>Catatan / Keterangan</th>
                        <th style={{ width: '40px', minWidth: '40px', textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {operationalItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)' }}>
                            Belum ada item operasional. Klik tombol &quot;+ Tambah Item Operasional&quot; di atas.
                          </td>
                        </tr>
                      ) : (
                        operationalItems.map((item, oIdx) => {
                          const people = Math.max(1, Number(item.people_count) || 1);
                          const days = Math.max(1, Number(item.days_count) || 1);
                          const rate = Math.max(0, Number(item.unit_cost_per_day ?? item.unit_cost) || 0);
                          const lineTotal = people * days * rate;

                          return (
                            <tr key={oIdx}>
                              <td>
                                <input
                                  type="text"
                                  className="excel-cell-input"
                                  value={item.name}
                                  onChange={(e) => updateOperationalItem(oIdx, { name: e.target.value })}
                                  placeholder="Contoh: Tiket Pesawat PP, Hotel 2 Malam, Uang Harian..."
                                />
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <input
                                  type="number"
                                  min={1}
                                  className="excel-cell-input font-mono-numbers"
                                  style={{ textAlign: 'center' }}
                                  value={item.people_count}
                                  onChange={(e) => updateOperationalItem(oIdx, { people_count: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                                />
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <input
                                  type="number"
                                  min={1}
                                  className="excel-cell-input font-mono-numbers"
                                  style={{ textAlign: 'center' }}
                                  value={item.days_count}
                                  onChange={(e) => updateOperationalItem(oIdx, { days_count: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                                />
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <input
                                  type="number"
                                  min={0}
                                  step={1000}
                                  className="excel-cell-input font-mono-numbers"
                                  style={{ textAlign: 'right' }}
                                  value={item.unit_cost_per_day ?? item.unit_cost ?? 0}
                                  onChange={(e) => updateOperationalItem(oIdx, { unit_cost_per_day: Math.max(0, parseFloat(e.target.value) || 0) })}
                                />
                              </td>
                              <td className="font-mono-numbers" style={{ textAlign: 'right', color: '#10b981', fontWeight: 600, padding: '0 12px' }}>
                                {formatIDR(lineTotal)}
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="excel-cell-input"
                                  style={{ padding: '6px 12px' }}
                                  value={item.notes || ''}
                                  onChange={(e) => updateOperationalItem(oIdx, { notes: e.target.value })}
                                  placeholder="Catatan / lokasi tujuan..."
                                />
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => removeOperationalItem(oIdx)}
                                  className="btn-ghost"
                                  style={{ color: 'var(--color-danger)', padding: '4px', fontSize: '12px', width: '100%', height: '100%' }}
                                  title="Hapus Item Operasional"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB / BOX C: INFRASTRUCTURE ITEMS (Only if Infrastructure chosen) */}
            {isInfrastructure && (wbsTab === 'ALL' || wbsTab === 'INFRASTRUCTURE') && (
              <div
                className="linear-card-elevated"
                style={{
                  padding: '20px',
                  marginBottom: '24px',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  background: 'rgba(245, 158, 11, 0.01)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                    flexWrap: 'wrap',
                    gap: '12px',
                    borderBottom: '1px solid var(--border-subtle)',
                    paddingBottom: '12px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge badge-warning" style={{ fontSize: '11px' }}>
                        HARDWARE & CLOUD
                      </span>
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        C. WBS Infrastructure Items (One-Time Setup & Recurring Cloud)
                      </h3>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                      Subtotal One-Time:{' '}
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {formatIDR(infraCalculation ? infraCalculation.one_time_subtotal : 0)}
                      </strong>
                      <span style={{ margin: '0 8px' }}>•</span>
                      Subtotal Recurring:{' '}
                      <strong style={{ color: '#38bdf8' }}>
                        {formatIDR(infraCalculation ? infraCalculation.recurring_subtotal : 0)}
                      </strong>
                      <span style={{ margin: '0 8px' }}>•</span>
                      Total Infra:{' '}
                      <strong style={{ color: '#10b981' }}>
                        {formatIDR(infraCalculation ? infraCalculation.grand_total : 0)}
                      </strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {dbTemplates.filter(t => t.category === 'INFRASTRUCTURE').map(t => (
                      <button key={t.id} type="button" onClick={() => applyInfrastructureTemplate(t.payload)} className="btn-secondary" style={{ fontSize: '11px' }} title={t.description || t.name}>
                        {t.name}
                      </button>
                    ))}
                    <button type="button" onClick={addInfraItem} className="btn-secondary" style={{ fontSize: '12px' }}>
                      + Tambah Item Infra
                    </button>
                  </div>
                </div>

                {/* Infrastructure Items Table */}
                <div style={{ overflowX: 'auto', marginBottom: '12px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <table className="excel-table">
                    <thead>
                      <tr>
                        <th style={{ minWidth: '220px', textAlign: 'left' }}>Nama Item Infrastruktur</th>
                        <th style={{ width: '16%', textAlign: 'center' }}>Billing Type</th>
                        <th style={{ width: '7%', textAlign: 'center' }}>Qty</th>
                        <th style={{ width: '15%', textAlign: 'right' }}>Unit Cost (Rp)</th>
                        <th style={{ width: '13%', textAlign: 'center' }}>Durasi/Periode</th>
                        <th style={{ width: '16%', textAlign: 'right' }}>Subtotal Biaya</th>
                        <th style={{ width: '15%' }}>Catatan</th>
                        <th style={{ width: '36px', textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {infraItems.map((item, iIdx) => {
                        const calcItem = infraCalculation?.items[iIdx];
                        return (
                          <tr key={iIdx}>
                            <td>
                              <input
                                type="text"
                                className="excel-cell-input"
                                value={item.name}
                                onChange={(e) => updateInfraItemField(iIdx, 'name', e.target.value)}
                                placeholder="Contoh: Cloud VPS Hosting, Domain .com..."
                              />
                            </td>
                            <td>
                              <select
                                className="excel-cell-select"
                                value={item.billing_type}
                                onChange={(e) => updateInfraItemField(iIdx, 'billing_type', e.target.value as InfraBillingType)}
                              >
                                <option value="ONE_TIME">ONE_TIME (Setup/Hardware)</option>
                                <option value="MONTHLY">MONTHLY (Bulanan)</option>
                                <option value="YEARLY">YEARLY (Tahunan)</option>
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                min="1"
                                className="excel-cell-input font-mono-numbers"
                                value={item.quantity}
                                onChange={(e) => updateInfraItemField(iIdx, 'quantity', Math.max(1, Number(e.target.value) || 1))}
                                style={{ textAlign: 'center' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                className="excel-cell-input font-mono-numbers"
                                value={item.unit_cost === 0 ? '' : item.unit_cost}
                                onChange={(e) => updateInfraItemField(iIdx, 'unit_cost', Math.max(0, Number(e.target.value) || 0))}
                                placeholder="-"
                                style={{ textAlign: 'right' }}
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {item.billing_type === 'ONE_TIME' ? (
                                <div className="excel-cell-static" style={{ color: 'var(--text-tertiary)', textAlign: 'center' }}>1x Setup</div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
                                  <input
                                    type="number"
                                    min="1"
                                    className="excel-cell-input font-mono-numbers"
                                    value={item.period_count || 1}
                                    onChange={(e) => updateInfraItemField(iIdx, 'period_count', Math.max(1, Number(e.target.value) || 1))}
                                    style={{ textAlign: 'center', width: '50px' }}
                                  />
                                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', paddingRight: '6px' }}>
                                    {item.billing_type === 'MONTHLY' ? 'Bln' : 'Thn'}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div className="excel-cell-static font-mono-numbers" style={{ fontWeight: 600, color: '#10b981' }}>
                                {calcItem ? formatIDR(calcItem.total_cost) : 'Rp 0'}
                              </div>
                            </td>
                            <td>
                              <input
                                type="text"
                                className="excel-cell-input"
                                value={item.notes || ''}
                                onChange={(e) => updateInfraItemField(iIdx, 'notes', e.target.value)}
                                placeholder="Catatan..."
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => removeInfraItem(iIdx)}
                                className="btn-ghost"
                                style={{ color: 'var(--color-danger)', padding: '4px', fontSize: '12px', width: '100%', height: '100%' }}
                                title="Hapus Item Infra"
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
              </div>
            )}
          </section>

          {/* Delivery Timeline Setup Section */}
          <section className="linear-card" style={{ padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="linear-badge" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Section E • Delivery Timeline
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Baseline Kalender & Jadwal</span>
                </div>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px', margin: 0 }}>
                  Delivery Timeline Setup
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
                  Estimasi durasi kalender dan tahapan pengerjaan untuk diselaraskan ke modul proposal komersial
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setTimelineConfig(prev => ({
                    ...prev,
                    milestones: [
                      ...prev.milestones,
                      { phase: `Fase ${prev.milestones.length + 1}`, duration_weeks: 1, deliverable: 'Deliverable baru' }
                    ]
                  }));
                }}
                className="btn-secondary"
                style={{ fontSize: '12px', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span>+</span>
                <span>Tambah Tahapan</span>
              </button>
            </div>

            {/* Config Controls Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                padding: '16px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                marginBottom: '18px',
              }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '6px' }}>
                  Total Durasi Kalender
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min="1"
                    value={timelineConfig.total_weeks}
                    onChange={(e) => setTimelineConfig(prev => ({ ...prev, total_weeks: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="linear-input font-mono-numbers"
                    style={{ width: '100px', textAlign: 'center', fontWeight: 600 }}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Minggu Kalender</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '6px' }}>
                  Target Mulai (Opsional)
                </label>
                <input
                  type="date"
                  value={timelineConfig.start_date || ''}
                  onChange={(e) => setTimelineConfig(prev => ({ ...prev, start_date: e.target.value }))}
                  className="linear-input"
                  style={{ maxWidth: '200px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '4px' }}>
                  Akumulasi Durasi Milestone
                </div>
                <div className="font-mono-numbers" style={{ fontSize: '15px', fontWeight: 600, color: '#38bdf8' }}>
                  {timelineConfig.milestones.reduce((acc, m) => acc + (Number(m.duration_weeks) || 0), 0)} Minggu
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: '6px' }}>
                    ({timelineConfig.milestones.length} Tahapan)
                  </span>
                </div>
              </div>
            </div>

            {/* Milestones Excel Table */}
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
              <table className="excel-table">
                <thead>
                  <tr>
                    <th style={{ width: '45px', textAlign: 'center' }}>No</th>
                    <th style={{ minWidth: '240px', textAlign: 'left' }}>Tahapan / Fase Pengerjaan</th>
                    <th style={{ width: '140px', textAlign: 'center' }}>Durasi (Minggu)</th>
                    <th style={{ minWidth: '320px', textAlign: 'left' }}>Hasil Luaran (Deliverables)</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {timelineConfig.milestones.map((m, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>
                        {idx + 1}
                      </td>
                      <td>
                        <input
                          type="text"
                          value={m.phase}
                          placeholder="Nama fase pengerjaan..."
                          onChange={(e) => {
                            const val = e.target.value;
                            setTimelineConfig(prev => {
                              const copy = [...prev.milestones];
                              copy[idx] = { ...copy[idx], phase: val };
                              return { ...prev, milestones: copy };
                            });
                          }}
                          className="excel-cell-input"
                          style={{ fontWeight: 500 }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number"
                          min="1"
                          value={m.duration_weeks}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value) || 1);
                            setTimelineConfig(prev => {
                              const copy = [...prev.milestones];
                              copy[idx] = { ...copy[idx], duration_weeks: val };
                              return { ...prev, milestones: copy };
                            });
                          }}
                          className="excel-cell-input font-mono-numbers"
                          style={{ textAlign: 'center', fontWeight: 600 }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={m.deliverable}
                          placeholder="Deskripsi hasil luaran / dokumen serah terima..."
                          onChange={(e) => {
                            const val = e.target.value;
                            setTimelineConfig(prev => {
                              const copy = [...prev.milestones];
                              copy[idx] = { ...copy[idx], deliverable: val };
                              return { ...prev, milestones: copy };
                            });
                          }}
                          className="excel-cell-input"
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (timelineConfig.milestones.length <= 1) return;
                            setTimelineConfig(prev => ({
                              ...prev,
                              milestones: prev.milestones.filter((_, i) => i !== idx)
                            }));
                          }}
                          className="btn-ghost"
                          style={{
                            color: 'var(--color-danger)',
                            padding: '4px 8px',
                            fontSize: '12px',
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          disabled={timelineConfig.milestones.length <= 1}
                          title="Hapus Tahapan"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Sticky Bottom Summary & Multi-Billing Action Bar */}
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 40,
              background: 'var(--bg-panel)',
              backdropFilter: 'blur(16px)',
              borderTop: '1px solid var(--border-subtle)',
              padding: '14px 24px',
              boxShadow: '0 -10px 30px rgba(0, 0, 0, 0.12)',
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
                {/* Total Cakupan */}
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Total Cakupan</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {isDevelopment ? `${totalModuleCount} Modul • ${totalTaskCount} Tasks` : `${selectedCategories.length} Kategori`}
                  </div>
                </div>

                <div style={{ height: '30px', width: '1px', background: 'var(--border-subtle)' }} />

                {/* One-Time Charge (Dev + Infra Setup) */}
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Total One-Time Charge</div>
                  <div className="font-mono-numbers" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {formatIDR(billingSummary.total_one_time)}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                    Dev: {formatIDR(billingSummary.one_time_dev)} • Infra Setup: {formatIDR(billingSummary.one_time_infra)}
                  </div>
                </div>

                <div style={{ height: '30px', width: '1px', background: 'var(--border-subtle)' }} />

                {/* Monthly / Recurring Charge (Maintenance/bln + Infra/bln) */}
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Total Monthly / Recurring Charge</div>
                  <div className="font-mono-numbers" style={{ fontSize: '15px', fontWeight: 700, color: '#38bdf8' }}>
                    {formatIDR(billingSummary.total_monthly_recurring)}/bln
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                    Maint: {formatIDR(billingSummary.monthly_maintenance)}/bln • Infra: {formatIDR(billingSummary.monthly_infra)}/bln
                  </div>
                </div>

                <div style={{ height: '30px', width: '1px', background: 'var(--border-subtle)' }} />

                {/* Grand Total Estimasi Kontrak */}
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Grand Total Estimasi Kontrak</div>
                  <div
                    className="font-mono-numbers"
                    style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      color: '#10b981',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {formatIDR(billingSummary.grand_total)}
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

        {/* Revision Reason Modal on Edit Save */}
        {isRevisionModalOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 300,
              padding: '16px',
            }}
            onClick={() => {
              if (!isLoading) setIsRevisionModalOpen(false);
            }}
          >
            <div
              className="linear-card-elevated"
              style={{
                width: '100%',
                maxWidth: '520px',
                padding: '24px',
                background: '#121417',
                border: '1px solid rgba(94, 106, 210, 0.35)',
                borderRadius: '12px',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 20px rgba(94, 106, 210, 0.15)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'rgba(94, 106, 210, 0.15)',
                      border: '1px solid rgba(94, 106, 210, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#a5b4fc',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                      Simpan Perubahan Revisi
                    </h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
                      Baseline snapshot <strong>v{editingEstimateMeta?.version || 1}</strong> → Versi baru <strong>v{((editingEstimateMeta?.max_version ?? editingEstimateMeta?.version) || 1) + 1}</strong>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => !isLoading && setIsRevisionModalOpen(false)}
                  className="btn-ghost"
                  style={{ color: 'var(--text-tertiary)', padding: '4px 8px', fontSize: '14px' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Alasan Edit / Catatan Perubahan <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <textarea
                  className="linear-textarea"
                  rows={3}
                  autoFocus
                  style={{
                    width: '100%',
                    fontSize: '13px',
                    padding: '10px 14px',
                    lineHeight: '1.5',
                    resize: 'none',
                    background: '#0b0c0e',
                    borderColor: 'rgba(255, 255, 255, 0.12)',
                  }}
                  value={revisionReason}
                  onChange={(e) => setRevisionReason(e.target.value)}
                  placeholder="Tuliskan catatan revisi (contoh: Penyesuaian scope manhour modul, update tarif, negosiasi klien)..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      executeSubmit(revisionReason);
                    }
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    Versi sebelumnya tetap tersimpan di riwayat versi.
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    Tekan <strong>Ctrl+Enter</strong> untuk simpan
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isLoading}
                  onClick={() => setIsRevisionModalOpen(false)}
                  style={{ fontSize: '13px', padding: '8px 16px' }}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => executeSubmit(revisionReason)}
                  disabled={isLoading || !revisionReason.trim()}
                  className="btn-primary"
                  style={{
                    fontSize: '13px',
                    padding: '8px 20px',
                    fontWeight: 600,
                  }}
                >
                  {isLoading ? 'Menyimpan Revisi...' : `Simpan Revisi v${((editingEstimateMeta?.max_version ?? editingEstimateMeta?.version) || 1) + 1}`}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}


export default function NewEstimatePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
        Memuat editor estimasi...
      </div>
    }>
      <NewEstimateForm />
    </Suspense>
  );
}
