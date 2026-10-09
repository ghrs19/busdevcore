export type RoleCode = string;

export type RoleRateMap = Record<string, number>;

export interface RoleSnapshotItem {
  code: string;
  name: string;
  rate: number;
}

export type RoleRateSnapshot = Record<string, RoleSnapshotItem | number>;

export const DEFAULT_ROLE_RATES: Record<string, number> = {
  PM: 39602,
  WEB_DEV: 39602,
  UI_UX: 33113,
  QC_DOC: 33101,
  DEV_OPS: 43760,
};

export const DEFAULT_ROLE_NAMES: Record<string, string> = {
  PM: 'Project Manager',
  WEB_DEV: 'Web Developer',
  UI_UX: 'UI/UX Designer',
  QC_DOC: 'Quality Control & Documentation',
  DEV_OPS: 'DevOps Engineer',
};

export function normalizeRoleSnapshot(
  snapshot: RoleRateSnapshot | undefined | null
): Record<string, RoleSnapshotItem> {
  if (!snapshot || typeof snapshot !== 'object') return {};
  const normalized: Record<string, RoleSnapshotItem> = {};
  for (const [key, val] of Object.entries(snapshot)) {
    if (typeof val === 'number') {
      normalized[key] = {
        code: key,
        name: DEFAULT_ROLE_NAMES[key] || key,
        rate: val,
      };
    } else if (val && typeof val === 'object') {
      normalized[key] = {
        code: val.code || key,
        name: val.name || DEFAULT_ROLE_NAMES[key] || key,
        rate: Number(val.rate) || 0,
      };
    }
  }
  return normalized;
}

export function snapshotToRateMap(
  snapshot: RoleRateSnapshot | undefined | null
): Record<string, number> {
  const normalized = normalizeRoleSnapshot(snapshot);
  const rates: Record<string, number> = {};
  for (const [code, item] of Object.entries(normalized)) {
    rates[code] = item.rate;
  }
  return rates;
}

// Development WBS interfaces
export interface TaskInput {
  name: string;
  hours_pm?: number;
  hours_web_dev?: number;
  hours_ui_ux?: number;
  hours_qc_doc?: number;
  hours_dev_ops?: number;
  role_hours?: Record<string, number | undefined>;
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

// Maintenance WBS interfaces
export interface MaintenanceTaskInput {
  name: string;
  hours_pm?: number;
  hours_web_dev?: number;
  hours_ui_ux?: number;
  hours_qc_doc?: number;
  hours_dev_ops?: number;
  role_hours?: Record<string, number | undefined>;
}

export interface MaintenanceTaskCalculated {
  name: string;
  role_hours: Record<string, number>;
  total_hours: number;
  monthly_cost: number;
  cost_breakdown: Record<string, number>;
}

export interface MaintenanceConfigInput {
  duration_months: number;
  tasks: MaintenanceTaskInput[];
}

export interface CalculatedMaintenance {
  duration_months: number;
  tasks: MaintenanceTaskCalculated[];
  total_monthly_hours: number;
  monthly_cost: number;
  total_cost: number;
  hours_by_role: Record<string, number>;
  monthly_cost_by_role: Record<string, number>;
}

// Infrastructure WBS interfaces
export type InfraBillingType = 'ONE_TIME' | 'MONTHLY' | 'YEARLY';

export interface InfrastructureItemInput {
  name: string;
  billing_type: InfraBillingType;
  quantity: number;
  unit_cost: number;
  period_count?: number;
  notes?: string;
}

export interface CalculatedInfrastructureItem {
  name: string;
  billing_type: InfraBillingType;
  quantity: number;
  unit_cost: number;
  period_count: number;
  total_cost: number;
  notes?: string;
}

export interface CalculatedInfrastructure {
  items: CalculatedInfrastructureItem[];
  one_time_subtotal: number;
  recurring_subtotal: number;
  monthly_recurring_subtotal: number;
  grand_total: number;
}

// Billing summary
export interface BillingSummary {
  one_time_dev: number;
  one_time_infra: number;
  total_one_time: number;
  monthly_maintenance: number;
  total_maintenance: number;
  recurring_infra: number;
  monthly_infra: number;
  total_monthly_recurring: number;
  grand_total: number;
}

export interface EstimateValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateEstimateRules(params: {
  serviceTypeCode: string;
  categoryCode?: string;
  categoryCodes?: string | string[];
  tagCode?: string | null;
}): EstimateValidationResult {
  const errors: string[] = [];

  const st = params.serviceTypeCode?.trim().toUpperCase();
  const rawCodes = params.categoryCodes 
    ? (Array.isArray(params.categoryCodes) ? params.categoryCodes : [params.categoryCodes])
    : (params.categoryCode ? [params.categoryCode] : []);

  const cats = rawCodes.map((c) => c.trim().toUpperCase()).filter(Boolean);
  const tag = params.tagCode ? params.tagCode.trim().toUpperCase() : null;

  if (st !== 'IT') {
    errors.push(`Service type '${params.serviceTypeCode}' tidak diizinkan. Hanya 'IT' yang aktif (Digital masih reserved).`);
  }

  if (cats.length === 0) {
    errors.push('Minimal 1 kategori proyek wajib dipilih (DEVELOPMENT, MAINTENANCE, atau INFRASTRUCTURE).');
  }

  const validCategories = ['DEVELOPMENT', 'MAINTENANCE', 'INFRASTRUCTURE'];
  for (const c of cats) {
    if (!validCategories.includes(c)) {
      errors.push(`Kategori '${c}' tidak valid untuk IT. Harus salah satu dari: ${validCategories.join(', ')}.`);
    }
  }

  const hasDev = cats.includes('DEVELOPMENT');
  if (hasDev) {
    if (!tag || (tag !== 'INITIAL' && tag !== 'CR')) {
      errors.push("Kategori 'Development' wajib memilih Tag: 'Initial' atau 'CR'.");
    }
  } else {
    if (tag) {
      errors.push("Tag HANYA berlaku untuk kategori Development (tidak boleh memiliki Tag jika tidak menyertakan Development).");
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

export function calculateMaintenance(
  input: MaintenanceConfigInput,
  rates: RoleRateMap = DEFAULT_ROLE_RATES
): CalculatedMaintenance {
  const duration_months = Math.max(1, Number(input?.duration_months) || 1);
  const tasks = input?.tasks || [];
  const calculatedTasks: MaintenanceTaskCalculated[] = [];

  const roleKeys = Array.from(new Set<string>([
    'PM', 'WEB_DEV', 'UI_UX', 'QC_DOC', 'DEV_OPS',
    ...Object.keys(rates),
    ...tasks.flatMap(t => Object.keys(t.role_hours || {})),
  ]));

  const hours_by_role: Record<string, number> = {};
  const monthly_cost_by_role: Record<string, number> = {};
  for (const r of roleKeys) {
    hours_by_role[r] = 0;
    monthly_cost_by_role[r] = 0;
  }

  let total_monthly_hours = 0;
  let monthly_cost = 0;

  for (const t of tasks) {
    const roleHours: Record<string, number> = {};
    const costBreakdown: Record<string, number> = {};
    let taskHours = 0;
    let taskMonthlyCost = 0;

    for (const r of roleKeys) {
      let h = 0;
      if (t.role_hours && t.role_hours[r] !== undefined) {
        h = Number(t.role_hours[r]) || 0;
      } else if (r === 'PM' && t.hours_pm !== undefined) {
        h = Number(t.hours_pm) || 0;
      } else if (r === 'WEB_DEV' && t.hours_web_dev !== undefined) {
        h = Number(t.hours_web_dev) || 0;
      } else if (r === 'UI_UX' && t.hours_ui_ux !== undefined) {
        h = Number(t.hours_ui_ux) || 0;
      } else if (r === 'QC_DOC' && t.hours_qc_doc !== undefined) {
        h = Number(t.hours_qc_doc) || 0;
      } else if (r === 'DEV_OPS' && t.hours_dev_ops !== undefined) {
        h = Number(t.hours_dev_ops) || 0;
      }

      roleHours[r] = h;
      taskHours += h;
      const rate = rates[r] !== undefined ? rates[r] : (DEFAULT_ROLE_RATES[r] || 0);
      const c = Math.round(h * rate);
      costBreakdown[r] = c;
      taskMonthlyCost += c;

      hours_by_role[r] += h;
      monthly_cost_by_role[r] += c;
    }

    total_monthly_hours += taskHours;
    monthly_cost += taskMonthlyCost;

    calculatedTasks.push({
      name: t.name,
      role_hours: roleHours,
      total_hours: taskHours,
      monthly_cost: taskMonthlyCost,
      cost_breakdown: costBreakdown,
    });
  }

  const total_cost = monthly_cost * duration_months;

  return {
    duration_months,
    tasks: calculatedTasks,
    total_monthly_hours,
    monthly_cost,
    total_cost,
    hours_by_role,
    monthly_cost_by_role,
  };
}

export function calculateInfrastructure(
  items: InfrastructureItemInput[]
): CalculatedInfrastructure {
  let one_time_subtotal = 0;
  let recurring_subtotal = 0;
  let monthly_recurring_subtotal = 0;
  const calculatedItems: CalculatedInfrastructureItem[] = [];

  for (const item of (items || [])) {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const unitCost = Math.max(0, Number(item.unit_cost) || 0);
    const billingType = ((item.billing_type || 'ONE_TIME').toUpperCase()) as InfraBillingType;
    let period = Number(item.period_count);
    if (isNaN(period) || period <= 0) {
      period = 1;
    }

    let totalCost = 0;
    if (billingType === 'ONE_TIME') {
      period = 1;
      totalCost = Math.round(qty * unitCost);
      one_time_subtotal += totalCost;
    } else if (billingType === 'MONTHLY') {
      totalCost = Math.round(qty * unitCost * period);
      recurring_subtotal += totalCost;
      monthly_recurring_subtotal += Math.round(qty * unitCost);
    } else if (billingType === 'YEARLY') {
      totalCost = Math.round(qty * unitCost * period);
      recurring_subtotal += totalCost;
      monthly_recurring_subtotal += Math.round((qty * unitCost * period) / (12 * period));
    }

    calculatedItems.push({
      name: item.name,
      billing_type: billingType,
      quantity: qty,
      unit_cost: unitCost,
      period_count: period,
      total_cost: totalCost,
      notes: item.notes || '',
    });
  }

  const grand_total = one_time_subtotal + recurring_subtotal;

  return {
    items: calculatedItems,
    one_time_subtotal,
    recurring_subtotal,
    monthly_recurring_subtotal,
    grand_total,
  };
}

export function calculateBillingSummary(params: {
  hasDevelopment: boolean;
  hasMaintenance: boolean;
  hasInfrastructure: boolean;
  devCost?: number;
  maintenanceConfig?: CalculatedMaintenance | null;
  infrastructure?: CalculatedInfrastructure | null;
}): BillingSummary {
  const one_time_dev = params.hasDevelopment ? (params.devCost || 0) : 0;
  
  const one_time_infra = (params.hasInfrastructure && params.infrastructure)
    ? params.infrastructure.one_time_subtotal
    : 0;

  const recurring_infra = (params.hasInfrastructure && params.infrastructure)
    ? params.infrastructure.recurring_subtotal
    : 0;

  const monthly_infra = (params.hasInfrastructure && params.infrastructure)
    ? params.infrastructure.monthly_recurring_subtotal
    : 0;

  const monthly_maintenance = (params.hasMaintenance && params.maintenanceConfig)
    ? params.maintenanceConfig.monthly_cost
    : 0;

  const total_maintenance = (params.hasMaintenance && params.maintenanceConfig)
    ? params.maintenanceConfig.total_cost
    : 0;

  const total_one_time = one_time_dev + one_time_infra;
  const total_monthly_recurring = monthly_maintenance + monthly_infra;
  const grand_total = total_one_time + total_maintenance + recurring_infra;

  return {
    one_time_dev,
    one_time_infra,
    total_one_time,
    monthly_maintenance,
    total_maintenance,
    recurring_infra,
    monthly_infra,
    total_monthly_recurring,
    grand_total,
  };
}

export interface CalculatedEstimate {
  title: string;
  serviceTypeCode: string;
  categoryCode: string;
  categoryCodes: string[];
  tagCode?: string | null;
  rates: RoleRateMap;
  rateSnapshots?: Record<string, RoleSnapshotItem>;
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
  maintenance?: CalculatedMaintenance;
  infrastructure?: CalculatedInfrastructure;
  billing_summary: BillingSummary;
}

export function calculateEstimate(params: {
  title: string;
  serviceTypeCode: string;
  categoryCode?: string;
  categoryCodes?: string | string[];
  tagCode?: string | null;
  rates?: RoleRateMap | RoleRateSnapshot;
  modules?: ModuleInput[];
  maintenance?: MaintenanceConfigInput;
  infrastructure?: InfrastructureItemInput[];
}): CalculatedEstimate {
  const rawCodes = params.categoryCodes 
    ? (Array.isArray(params.categoryCodes) ? params.categoryCodes : [params.categoryCodes])
    : (params.categoryCode ? [params.categoryCode] : []);

  const cats = rawCodes.map((c) => c.trim().toUpperCase()).filter(Boolean);

  const validation = validateEstimateRules({
    serviceTypeCode: params.serviceTypeCode,
    categoryCodes: cats,
    tagCode: params.tagCode,
  });

  if (!validation.valid) {
    throw new Error(validation.errors.join('; '));
  }

  const normalizedSnapshot = normalizeRoleSnapshot(params.rates);
  const flatRates = snapshotToRateMap(params.rates);

  const effectiveRates: RoleRateMap = {
    ...DEFAULT_ROLE_RATES,
    ...flatRates,
  };

  const hasDev = cats.includes('DEVELOPMENT');
  const hasMaint = cats.includes('MAINTENANCE');
  const hasInfra = cats.includes('INFRASTRUCTURE');

  // Development calculation
  let calculatedModules: CalculatedModule[] = [];
  if (hasDev || (!hasMaint && !hasInfra)) {
    calculatedModules = (params.modules || []).map(m => calculateModule(m, effectiveRates));
  }

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

  const dev_hours = calculatedModules.reduce((acc, m) => acc + m.total_hours, 0);
  const dev_cost = calculatedModules.reduce((acc, m) => acc + m.total_cost, 0);

  // Maintenance calculation
  let calculatedMaintenance: CalculatedMaintenance | undefined = undefined;
  if (hasMaint && params.maintenance) {
    calculatedMaintenance = calculateMaintenance(params.maintenance, effectiveRates);
  }

  // Infrastructure calculation
  let calculatedInfrastructure: CalculatedInfrastructure | undefined = undefined;
  if (hasInfra && params.infrastructure) {
    calculatedInfrastructure = calculateInfrastructure(params.infrastructure);
  }

  const billing_summary = calculateBillingSummary({
    hasDevelopment: hasDev,
    hasMaintenance: hasMaint,
    hasInfrastructure: hasInfra,
    devCost: dev_cost,
    maintenanceConfig: calculatedMaintenance || null,
    infrastructure: calculatedInfrastructure || null,
  });

  const total_hours = dev_hours + (calculatedMaintenance ? calculatedMaintenance.total_monthly_hours * calculatedMaintenance.duration_months : 0);
  const total_cost = billing_summary.grand_total;

  return {
    title: params.title,
    serviceTypeCode: params.serviceTypeCode.toUpperCase(),
    categoryCode: cats[0] || '',
    categoryCodes: cats,
    tagCode: params.tagCode ? params.tagCode.toUpperCase() : null,
    rates: effectiveRates,
    rateSnapshots: normalizedSnapshot,
    modules: calculatedModules,
    total_hours,
    total_cost,
    hours_by_role,
    cost_by_role,
    maintenance: calculatedMaintenance,
    infrastructure: calculatedInfrastructure,
    billing_summary,
  };
}
