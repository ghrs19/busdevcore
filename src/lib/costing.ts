export type RoleCode = 'PM' | 'WEB_DEV' | 'UI_UX' | 'QC_DOC' | 'DEV_OPS';

export interface RoleRateMap {
  PM: number;
  WEB_DEV: number;
  UI_UX: number;
  QC_DOC: number;
  DEV_OPS: number;
}

export const DEFAULT_ROLE_RATES: RoleRateMap = {
  PM: 39602,
  WEB_DEV: 39602,
  UI_UX: 33113,
  QC_DOC: 33101,
  DEV_OPS: 43760,
};

export interface TaskInput {
  name: string;
  hours_pm: number;
  hours_web_dev: number;
  hours_ui_ux: number;
  hours_qc_doc: number;
  hours_dev_ops: number;
}

export interface CalculatedTask extends TaskInput {
  total_hours: number;
  total_cost: number;
  cost_breakdown: {
    pm: number;
    web_dev: number;
    ui_ux: number;
    qc_doc: number;
    dev_ops: number;
  };
}

export interface ModuleInput {
  name: string;
  tasks: TaskInput[];
}

export interface CalculatedModule {
  name: string;
  tasks: CalculatedTask[];
  total_hours: number;
  total_cost: number;
  hours_breakdown: {
    pm: number;
    web_dev: number;
    ui_ux: number;
    qc_doc: number;
    dev_ops: number;
  };
  cost_breakdown: {
    pm: number;
    web_dev: number;
    ui_ux: number;
    qc_doc: number;
    dev_ops: number;
  };
}

export interface EstimateValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateEstimateRules(params: {
  serviceTypeCode: string;
  categoryCode: string;
  tagCode?: string | null;
}): EstimateValidationResult {
  const errors: string[] = [];

  const st = params.serviceTypeCode?.trim().toUpperCase();
  const cat = params.categoryCode?.trim().toUpperCase();
  const tag = params.tagCode ? params.tagCode.trim().toUpperCase() : null;

  if (st !== 'IT') {
    errors.push(`Service type '${params.serviceTypeCode}' tidak diizinkan. Hanya 'IT' yang aktif (Digital masih reserved).`);
  }

  if (cat !== 'DEVELOPMENT' && cat !== 'MAINTENANCE') {
    errors.push(`Kategori '${params.categoryCode}' tidak valid untuk IT. Harus 'DEVELOPMENT' atau 'MAINTENANCE'.`);
  }

  if (cat === 'DEVELOPMENT') {
    if (!tag || (tag !== 'INITIAL' && tag !== 'CR')) {
      errors.push("Kategori 'Development' wajib memilih Tag: 'Initial' atau 'CR'.");
    }
  }

  if (cat === 'MAINTENANCE') {
    if (tag) {
      errors.push("Kategori 'Maintenance' tidak boleh memiliki Tag (Tag HANYA berlaku untuk Development).");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function calculateTask(task: TaskInput, rates: RoleRateMap = DEFAULT_ROLE_RATES): CalculatedTask {
  const h_pm = Number(task.hours_pm) || 0;
  const h_web = Number(task.hours_web_dev) || 0;
  const h_ui = Number(task.hours_ui_ux) || 0;
  const h_qc = Number(task.hours_qc_doc) || 0;
  const h_devops = Number(task.hours_dev_ops) || 0;

  const total_hours = h_pm + h_web + h_ui + h_qc + h_devops;

  const cost_pm = Math.round(h_pm * rates.PM);
  const cost_web = Math.round(h_web * rates.WEB_DEV);
  const cost_ui = Math.round(h_ui * rates.UI_UX);
  const cost_qc = Math.round(h_qc * rates.QC_DOC);
  const cost_devops = Math.round(h_devops * rates.DEV_OPS);

  const total_cost = cost_pm + cost_web + cost_ui + cost_qc + cost_devops;

  return {
    ...task,
    hours_pm: h_pm,
    hours_web_dev: h_web,
    hours_ui_ux: h_ui,
    hours_qc_doc: h_qc,
    hours_dev_ops: h_devops,
    total_hours,
    total_cost,
    cost_breakdown: {
      pm: cost_pm,
      web_dev: cost_web,
      ui_ux: cost_ui,
      qc_doc: cost_qc,
      dev_ops: cost_devops,
    },
  };
}

export function calculateModule(mod: ModuleInput, rates: RoleRateMap = DEFAULT_ROLE_RATES): CalculatedModule {
  const calculatedTasks = (mod.tasks || []).map(t => calculateTask(t, rates));

  const hours_breakdown = {
    pm: calculatedTasks.reduce((acc, t) => acc + t.hours_pm, 0),
    web_dev: calculatedTasks.reduce((acc, t) => acc + t.hours_web_dev, 0),
    ui_ux: calculatedTasks.reduce((acc, t) => acc + t.hours_ui_ux, 0),
    qc_doc: calculatedTasks.reduce((acc, t) => acc + t.hours_qc_doc, 0),
    dev_ops: calculatedTasks.reduce((acc, t) => acc + t.hours_dev_ops, 0),
  };

  const cost_breakdown = {
    pm: calculatedTasks.reduce((acc, t) => acc + t.cost_breakdown.pm, 0),
    web_dev: calculatedTasks.reduce((acc, t) => acc + t.cost_breakdown.web_dev, 0),
    ui_ux: calculatedTasks.reduce((acc, t) => acc + t.cost_breakdown.ui_ux, 0),
    qc_doc: calculatedTasks.reduce((acc, t) => acc + t.cost_breakdown.qc_doc, 0),
    dev_ops: calculatedTasks.reduce((acc, t) => acc + t.cost_breakdown.dev_ops, 0),
  };

  const total_hours = Object.values(hours_breakdown).reduce((a, b) => a + b, 0);
  const total_cost = Object.values(cost_breakdown).reduce((a, b) => a + b, 0);

  return {
    name: mod.name,
    tasks: calculatedTasks,
    total_hours,
    total_cost,
    hours_breakdown,
    cost_breakdown,
  };
}

export interface CalculatedEstimate {
  title: string;
  serviceTypeCode: string;
  categoryCode: string;
  tagCode?: string | null;
  rates: RoleRateMap;
  modules: CalculatedModule[];
  total_hours: number;
  total_cost: number;
  hours_by_role: {
    pm: number;
    web_dev: number;
    ui_ux: number;
    qc_doc: number;
    dev_ops: number;
  };
  cost_by_role: {
    pm: number;
    web_dev: number;
    ui_ux: number;
    qc_doc: number;
    dev_ops: number;
  };
}

export function calculateEstimate(params: {
  title: string;
  serviceTypeCode: string;
  categoryCode: string;
  tagCode?: string | null;
  rates?: Partial<RoleRateMap>;
  modules: ModuleInput[];
}): CalculatedEstimate {
  const validation = validateEstimateRules({
    serviceTypeCode: params.serviceTypeCode,
    categoryCode: params.categoryCode,
    tagCode: params.tagCode,
  });

  if (!validation.valid) {
    throw new Error(validation.errors.join('; '));
  }

  const effectiveRates: RoleRateMap = {
    ...DEFAULT_ROLE_RATES,
    ...(params.rates || {}),
  };

  const calculatedModules = (params.modules || []).map(m => calculateModule(m, effectiveRates));

  const hours_by_role = {
    pm: calculatedModules.reduce((acc, m) => acc + m.hours_breakdown.pm, 0),
    web_dev: calculatedModules.reduce((acc, m) => acc + m.hours_breakdown.web_dev, 0),
    ui_ux: calculatedModules.reduce((acc, m) => acc + m.hours_breakdown.ui_ux, 0),
    qc_doc: calculatedModules.reduce((acc, m) => acc + m.hours_breakdown.qc_doc, 0),
    dev_ops: calculatedModules.reduce((acc, m) => acc + m.hours_breakdown.dev_ops, 0),
  };

  const cost_by_role = {
    pm: calculatedModules.reduce((acc, m) => acc + m.cost_breakdown.pm, 0),
    web_dev: calculatedModules.reduce((acc, m) => acc + m.cost_breakdown.web_dev, 0),
    ui_ux: calculatedModules.reduce((acc, m) => acc + m.cost_breakdown.ui_ux, 0),
    qc_doc: calculatedModules.reduce((acc, m) => acc + m.cost_breakdown.qc_doc, 0),
    dev_ops: calculatedModules.reduce((acc, m) => acc + m.cost_breakdown.dev_ops, 0),
  };

  const total_hours = Object.values(hours_by_role).reduce((a, b) => a + b, 0);
  const total_cost = Object.values(cost_by_role).reduce((a, b) => a + b, 0);

  return {
    title: params.title,
    serviceTypeCode: params.serviceTypeCode.toUpperCase(),
    categoryCode: params.categoryCode.toUpperCase(),
    tagCode: params.tagCode ? params.tagCode.toUpperCase() : null,
    rates: effectiveRates,
    modules: calculatedModules,
    total_hours,
    total_cost,
    hours_by_role,
    cost_by_role,
  };
}
