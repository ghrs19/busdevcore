/** @typedef {{ id: 'classic' | 'corporate', name: string, description: string }} DashboardTemplate */

/** @type {readonly DashboardTemplate[]} */
export const DASHBOARD_TEMPLATES = Object.freeze([
  { id: 'classic', name: 'Classic', description: 'Dashboard standar BusDevCore.' },
  { id: 'corporate', name: 'Corporate Executive', description: 'Tampilan eksekutif yang bersih, ringkas, dan berorientasi keputusan.' },
]);

/** @param {string | null} value */
export function resolveDashboardTemplate(value) {
  return DASHBOARD_TEMPLATES.some((template) => template.id === value) ? value : 'corporate';
}
