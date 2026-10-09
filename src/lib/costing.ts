export type RoleCode = string;

export type RoleRateMap = Record<string, number>;

export const DEFAULT_ROLE_RATES: Record<string, number> = {
  PM: 39602,
  WEB_DEV: 39602,
  UI_UX: 33113,
  QC_DOC: 33101,
  DEV_OPS: 43760,
};

export interface TaskInput {
  name: string;
  hours_pm?: number;
  hours_web_dev?: number;
  hours_ui_ux?: number;
  hours_qc_doc?: number;
  hours_dev_ops?: number;
  role_hours?: Record<string, number>;
}

export interface CalculatedTask {
  name: string;
  hours_pm: number;
  hours_web_dev: number;
  hours_ui_ux: number;
  hours_qc_doc: number;
  hours_dev_ops: number;
  role_hours: Record<string, number>;
  total_hours: number;
  total_cost: number;
  cost_breakdown: Record<string, number> & {
    pm?: number;
    web_dev?: number;
    ui_ux?: number;
    qc_doc?: number;
    dev_ops?: number;
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
  hours_breakdown: Record<string, number> & {
    pm?: number;
    web_dev?: number;
    ui_ux?: number;
    qc_doc?: number;
    dev_ops?: number;
  };
  cost_breakdown: Record<string, number> & {
    pm?: number;
    web_dev?: number;
    ui_ux?: number;
    qc_doc?: number;
    dev_ops?: number;
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
  const roleHours: Record<string, number> = {};

  const roleKeys = Array.from(new Set<string>([
    'PM', 'WEB_DEV', 'UI_UX', 'QC_DOC', 'DEV_OPS',
    ...Object.keys(rates),
    ...Object.keys(task.role_hours || {}),
  ]));

  let total_hours = 0;
  let total_cost = 0;
  const cost_breakdown: Record<string, number> = {};

  for (const role of roleKeys) {
    let hours = 0;
    if (task.role_hours && task.role_hours[role] !== undefined) {
      hours = Number(task.role_hours[role]) || 0;
    } else if (role === 'PM' && task.hours_pm !== undefined) {
      hours = Number(task.hours_pm) || 0;
    } else if (role === 'WEB_DEV' && task.hours_web_dev !== undefined) {
      hours = Number(task.hours_web_dev) || 0;
    } else if (role === 'UI_UX' && task.hours_ui_ux !== undefined) {
      hours = Number(task.hours_ui_ux) || 0;
    } else if (role === 'QC_DOC' && task.hours_qc_doc !== undefined) {
      hours = Number(task.hours_qc_doc) || 0;
    } else if (role === 'DEV_OPS' && task.hours_dev_ops !== undefined) {
      hours = Number(task.hours_dev_ops) || 0;
    }

    roleHours[role] = hours;
    total_hours += hours;

    const rate = rates[role] !== undefined ? rates[role] : (DEFAULT_ROLE_RATES[role] || 0);
    const cost = Math.round(hours * rate);
    total_cost += cost;
    cost_breakdown[role] = cost;
    cost_breakdown[role.toLowerCase()] = cost;
  }

  return {
    ...task,
    name: task.name,
    role_hours: roleHours,
    hours_pm: roleHours.PM || 0,
    hours_web_dev: roleHours.WEB_DEV || 0,
    hours_ui_ux: roleHours.UI_UX || 0,
    hours_qc_doc: roleHours.QC_DOC || 0,
    hours_dev_ops: roleHours.DEV_OPS || 0,
    total_hours,
    total_cost,
    cost_breakdown,
  };
}

export function calculateModule(mod: ModuleInput, rates: RoleRateMap = DEFAULT_ROLE_RATES): CalculatedModule {
  const calculatedTasks = (mod.tasks || []).map(t => calculateTask(t, rates));

  const roleKeys = Array.from(new Set<string>([
    'PM', 'WEB_DEV', 'UI_UX', 'QC_DOC', 'DEV_OPS',
    ...Object.keys(rates),
    ...calculatedTasks.flatMap(t => Object.keys(t.role_hours || {})),
  ]));

  const hours_breakdown: Record<string, number> = {};
  const cost_breakdown: Record<string, number> = {};

  for (const role of roleKeys) {
    const totalRoleHours = calculatedTasks.reduce((acc, t) => acc + (t.role_hours[role] || 0), 0);
    hours_breakdown[role] = totalRoleHours;
    hours_breakdown[role.toLowerCase()] = totalRoleHours;

    const totalRoleCost = calculatedTasks.reduce((acc, t) => acc + (t.cost_breakdown[role] || 0), 0);
    cost_breakdown[role] = totalRoleCost;
    cost_breakdown[role.toLowerCase()] = totalRoleCost;
  }

  const total_hours = calculatedTasks.reduce((acc, t) => acc + t.total_hours, 0);
  const total_cost = calculatedTasks.reduce((acc, t) => acc + t.total_cost, 0);

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
  hours_by_role: Record<string, number> & {
    pm?: number;
    web_dev?: number;
    ui_ux?: number;
    qc_doc?: number;
    dev_ops?: number;
  };
  cost_by_role: Record<string, number> & {
    pm?: number;
    web_dev?: number;
    ui_ux?: number;
    qc_doc?: number;
    dev_ops?: number;
  };
}

export function calculateEstimate(params: {
  title: string;
  serviceTypeCode: string;
  categoryCode: string;
  tagCode?: string | null;
  rates?: RoleRateMap;
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

  const roleKeys = Array.from(new Set<string>([
    'PM', 'WEB_DEV', 'UI_UX', 'QC_DOC', 'DEV_OPS',
    ...Object.keys(effectiveRates),
    ...calculatedModules.flatMap(m => Object.keys(m.hours_breakdown)),
  ]));

  const hours_by_role: Record<string, number> = {};
  const cost_by_role: Record<string, number> = {};

  for (const role of roleKeys) {
    const totalRoleHours = calculatedModules.reduce((acc, m) => acc + (m.hours_breakdown[role] || 0), 0);
    hours_by_role[role] = totalRoleHours;
    hours_by_role[role.toLowerCase()] = totalRoleHours;

    const totalRoleCost = calculatedModules.reduce((acc, m) => acc + (m.cost_breakdown[role] || 0), 0);
    cost_by_role[role] = totalRoleCost;
    cost_by_role[role.toLowerCase()] = totalRoleCost;
  }

  const total_hours = calculatedModules.reduce((acc, m) => acc + m.total_hours, 0);
  const total_cost = calculatedModules.reduce((acc, m) => acc + m.total_cost, 0);

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
