import type { MaintenanceConfigInput } from './costing';

export function maintenanceRevisionInput(body: {
  maintenance_config?: MaintenanceConfigInput | null;
  maintenance_tasks?: MaintenanceConfigInput['tasks'];
  maintenance_duration_months?: number;
}): MaintenanceConfigInput {
  if (body.maintenance_config) return body.maintenance_config;
  return { duration_months: body.maintenance_duration_months ?? 12, tasks: body.maintenance_tasks ?? [] };
}
