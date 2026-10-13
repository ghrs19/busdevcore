// Rate snapshot entry = role code (user-chosen) + person name + hourly rate.
export interface PersonRateEntry {
  code: string;
  name: string;
  rate: number;
  worker_id?: number;
}
export type PersonRateSnapshot = Record<string, PersonRateEntry>;

export const MAX_SNAPSHOT_ENTRIES = 60;
const KEY_RE = /^P\d{1,3}$/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export type ParseResult =
  | { ok: true; snapshot: PersonRateSnapshot }
  | { ok: false; error: string };

// `workers` (id -> master name): when given, every entry must reference a registered worker and the
// stored name is taken from the master, not from the client.
export function parseRateSnapshotInput(
  input: unknown,
  validRoleCodes: string[],
  workers?: Map<number, string>
): ParseResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Rate snapshot wajib berupa daftar orang.' };
  }
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length === 0) return { ok: false, error: 'Minimal 1 orang di Rate Snapshot.' };
  if (entries.length > MAX_SNAPSHOT_ENTRIES) {
    return { ok: false, error: `Maksimal ${MAX_SNAPSHOT_ENTRIES} orang di Rate Snapshot.` };
  }
  const roles = new Set(validRoleCodes.map((c) => c.toUpperCase()));
  const snapshot: PersonRateSnapshot = Object.create(null);
  for (const [key, raw] of entries) {
    if (FORBIDDEN_KEYS.has(key) || !KEY_RE.test(key)) return { ok: false, error: `ID orang tidak valid: ${key}` };
    if (!raw || typeof raw !== 'object') return { ok: false, error: `Data ${key} tidak valid.` };
    const item = raw as Record<string, unknown>;
    const code = typeof item.code === 'string' ? item.code.trim().toUpperCase() : '';
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    const rate = typeof item.rate === 'number' ? item.rate : Number.NaN;
    if (!roles.has(code)) return { ok: false, error: `Kode role tidak dikenal untuk ${key}.` };
    let finalName = name;
    let workerId: number | undefined;
    if (workers) {
      const wid = typeof item.worker_id === 'number' ? item.worker_id : Number.NaN;
      if (!Number.isInteger(wid) || !workers.has(wid)) return { ok: false, error: `Worker belum dipilih atau tidak terdaftar untuk ${key}.` };
      workerId = wid;
      finalName = workers.get(wid) as string;
    }
    if (!finalName || finalName.length > 100) return { ok: false, error: `Nama orang wajib diisi (maks 100 karakter) untuk ${key}.` };
    if (!Number.isFinite(rate) || rate < 0 || rate > 100_000_000) return { ok: false, error: `Rate tidak valid untuk ${key}.` };
    snapshot[key] = workerId === undefined ? { code, name: finalName, rate } : { code, name: finalName, rate, worker_id: workerId };
  }
  return { ok: true, snapshot: { ...snapshot } };
}

export function personInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join('').toUpperCase();
}

// "CODE · INITIALS" label per entry; duplicates get "(2)", "(3)" so columns stay distinguishable.
export function snapshotLabels(snapshot: Record<string, PersonRateEntry>): Record<string, string> {
  const seen = new Map<string, number>();
  const labels: Record<string, string> = {};
  for (const [key, entry] of Object.entries(snapshot)) {
    const base = `${entry.code} · ${personInitials(entry.name)}`;
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    labels[key] = n === 1 ? base : `${base} (${n})`;
  }
  return labels;
}

export function nextPersonKey(existing: string[]): string {
  let n = 1;
  const used = new Set(existing);
  while (used.has(`P${n}`)) n += 1;
  return `P${n}`;
}

// Template/AI hours are keyed by role code. Assign each role's hours to the first
// person holding that role; hours for roles nobody holds are reported as dropped.
export function assignRoleHoursToPeople(
  roleHours: Record<string, number | undefined> | undefined,
  snapshot: Record<string, PersonRateEntry>
): { hours: Record<string, number>; dropped: string[] } {
  const hours: Record<string, number> = {};
  const dropped: string[] = [];
  for (const [rawCode, value] of Object.entries(roleHours || {})) {
    const h = Number(value) || 0;
    if (h <= 0) continue;
    const code = rawCode.toUpperCase();
    const key = Object.keys(snapshot).find((k) => snapshot[k].code === code);
    if (!key) { dropped.push(code); continue; }
    hours[key] = (hours[key] || 0) + h;
  }
  return { hours, dropped };
}

// Strip everything from tasks except name + hours keyed by people present in the snapshot.
// Legacy hours_pm/hours_web_dev/... and unknown keys are dropped so they can never be costed.
export function sanitizeTaskHours<T extends { name?: unknown; tasks?: unknown }>(
  groups: unknown,
  snapshot: Record<string, PersonRateEntry>
): Array<{ name: string; tasks: Array<{ name: string; role_hours: Record<string, number> }> }> {
  if (!Array.isArray(groups)) return [];
  return (groups as T[]).map((g) => ({
    name: String(g?.name ?? ''),
    tasks: sanitizeTasks(g?.tasks, snapshot),
  }));
}

export function sanitizeTasks(
  tasks: unknown,
  snapshot: Record<string, PersonRateEntry>
): Array<{ name: string; role_hours: Record<string, number> }> {
  if (!Array.isArray(tasks)) return [];
  return tasks.map((t) => {
    const rh: Record<string, number> = {};
    const src = (t && typeof t === 'object' ? (t as { role_hours?: unknown }).role_hours : undefined) as Record<string, unknown> | undefined;
    for (const [k, v] of Object.entries(src && typeof src === 'object' ? src : {})) {
      const h = typeof v === 'number' ? v : Number(v);
      if (Object.prototype.hasOwnProperty.call(snapshot, k) && Number.isFinite(h) && h >= 0) rh[k] = h;
    }
    return { name: String((t as { name?: unknown })?.name ?? ''), role_hours: rh };
  });
}

// Default for a fresh/reset costing form: one empty row per master role, so the user only has to pick workers.
export function seedPeopleFromRoles(roleCodes: string[]): PersonRateSnapshot {
  const seeded: PersonRateSnapshot = {};
  for (const code of roleCodes) seeded[nextPersonKey(Object.keys(seeded))] = { code, name: '', rate: 0 };
  return seeded;
}

// A row only counts once a worker is chosen. Unfilled role rows are neither costed nor saved.
export function filledPeople(snapshot: PersonRateSnapshot): PersonRateSnapshot {
  const out: PersonRateSnapshot = {};
  for (const [key, entry] of Object.entries(snapshot)) {
    if (entry && entry.worker_id !== undefined && entry.name.trim()) out[key] = entry;
  }
  return out;
}
