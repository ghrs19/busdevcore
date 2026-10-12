export function getDashboardRange(value) {
  return value === '30' || value === '90' ? { days: Number(value) } : null;
}
