import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseRateSnapshotInput, personInitials, snapshotLabels, nextPersonKey, assignRoleHoursToPeople, sanitizeTaskHours, seedPeopleFromRoles, filledPeople } from './rate-snapshot.ts';
import { calculateModule, calculateMaintenance, calculateEstimate } from './costing.ts';

const ROLES = ['WEB_DEV', 'QC_DOCS', 'UI_UX'];

describe('rate snapshot (role - person - rate)', () => {
  it('accepts valid entries and normalizes them', () => {
    const r = parseRateSnapshotInput({ P1: { code: 'WEB_DEV', name: '  Ade Isman Aji ', rate: 42771 } }, ROLES);
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.snapshot.P1, { code: 'WEB_DEV', name: 'Ade Isman Aji', rate: 42771 });
  });
  it('rejects empty, array, and oversized input', () => {
    assert.equal(parseRateSnapshotInput({}, ROLES).ok, false);
    assert.equal(parseRateSnapshotInput([], ROLES).ok, false);
    assert.equal(parseRateSnapshotInput(null, ROLES).ok, false);
    const big = Object.fromEntries(Array.from({ length: 61 }, (_, i) => [`P${i}`, { code: 'WEB_DEV', name: 'A', rate: 1 }]));
    assert.equal(parseRateSnapshotInput(big, ROLES).ok, false);
  });
  it('rejects unknown role code, blank name, bad rate, bad key', () => {
    assert.equal(parseRateSnapshotInput({ P1: { code: 'NOPE', name: 'A', rate: 1 } }, ROLES).ok, false);
    assert.equal(parseRateSnapshotInput({ P1: { code: 'WEB_DEV', name: ' ', rate: 1 } }, ROLES).ok, false);
    assert.equal(parseRateSnapshotInput({ P1: { code: 'WEB_DEV', name: 'A', rate: -1 } }, ROLES).ok, false);
    assert.equal(parseRateSnapshotInput({ P1: { code: 'WEB_DEV', name: 'A', rate: 'x' } }, ROLES).ok, false);
    assert.equal(parseRateSnapshotInput({ 'bad key!': { code: 'WEB_DEV', name: 'A', rate: 1 } }, ROLES).ok, false);
    assert.equal(parseRateSnapshotInput({ __proto__x: 1 }, ROLES).ok, false);
  });
  it('builds initials: multi-word uses first letters, single word uses two letters', () => {
    assert.equal(personInitials('ADE ISMAN AJI'), 'AIA');
    assert.equal(personInitials('Muhammad Faisal Al Fauzi'), 'MFA');
    assert.equal(personInitials('BAIN'), 'BA');
    assert.equal(personInitials('  '), '?');
  });
  it('labels as CODE · INITIALS and disambiguates duplicates', () => {
    const labels = snapshotLabels({
      P1: { code: 'WEB_DEV', name: 'Ade Isman Aji', rate: 1 },
      P2: { code: 'WEB_DEV', name: 'Andi Ika Anggi', rate: 1 },
      P3: { code: 'QC_DOCS', name: 'Ai Sri Astuti', rate: 1 },
    });
    assert.equal(labels.P1, 'WEB_DEV · AIA');
    assert.equal(labels.P2, 'WEB_DEV · AIA (2)');
    assert.equal(labels.P3, 'QC_DOCS · ASA');
  });

  it('allocates next free person key', () => {
    assert.equal(nextPersonKey([]), 'P1');
    assert.equal(nextPersonKey(['P1', 'P3']), 'P2');
  });
  it('maps role-code hours to the first person with that role and reports dropped roles', () => {
    const snap = { P1: { code: 'WEB_DEV', name: 'A', rate: 1 }, P2: { code: 'WEB_DEV', name: 'B', rate: 2 }, P3: { code: 'UI_UX', name: 'C', rate: 3 } };
    const r = assignRoleHoursToPeople({ WEB_DEV: 4, UI_UX: 2, PM: 1, QC_DOCS: 0 }, snap);
    assert.deepEqual(r.hours, { P1: 4, P3: 2 });
    assert.deepEqual(r.dropped, ['PM']);
  });
  it('costs two people in the same role at their own rates', () => {
    const rates = { P1: 42771, P2: 29252 };
    const m = calculateModule({ name: 'M', tasks: [{ name: 'T', role_hours: { P1: 2, P2: 4 } }] }, rates);
    assert.equal(m.total_hours, 6);
    assert.equal(m.total_cost, 2 * 42771 + 4 * 29252);
    assert.equal(m.cost_breakdown.P1, 85542);
    assert.equal(m.cost_breakdown.P2, 117008);
  });

  it('sanitizes task hours: drops legacy hours_* and keys that are not people', () => {
    const snap = { P1: { code: 'WEB_DEV', name: 'A', rate: 1 } };
    const out = sanitizeTaskHours([{ name: 'M', tasks: [{ name: 'T', hours_pm: 9, role_hours: { P1: 3, P9: 5, PM: 7, P1x: 1 } }] }], snap);
    assert.deepEqual(out[0].tasks[0], { name: 'T', role_hours: { P1: 3 } });
  });
  it('sanitizeTaskHours rejects negative/NaN hours and non-array input', () => {
    const snap = { P1: { code: 'WEB_DEV', name: 'A', rate: 1 } };
    const out = sanitizeTaskHours([{ name: 'M', tasks: [{ name: 'T', role_hours: { P1: -2 } }, { name: 'U', role_hours: { P1: Number.NaN } }] }], snap);
    assert.deepEqual(out[0].tasks.map((t) => t.role_hours), [{}, {}]);
    assert.deepEqual(sanitizeTaskHours('x' as unknown as never[], snap), []);
  });

  it('maintenance costs two people of the same role at their own rates', () => {
    const m = calculateMaintenance(
      { duration_months: 2, tasks: [{ name: 'T', role_hours: { P1: 1, P2: 2 } }] },
      { P1: 42771, P2: 29252 }
    );
    assert.equal(m.monthly_cost, 42771 + 2 * 29252);
    assert.equal(m.total_cost, 2 * (42771 + 2 * 29252));
  });
  it('a person id absent from the snapshot costs 0, never a legacy default rate', () => {
    const m = calculateModule({ name: 'M', tasks: [{ name: 'T', role_hours: { PM: 10, P1: 1 } }] }, { P1: 1000 });
    assert.equal(m.total_cost, 1000);
  });
  it('estimate totals follow person-keyed snapshot and ignore legacy hours_* fields', () => {
    const est = calculateEstimate({
      title: 'x', serviceTypeCode: 'IT', categoryCodes: ['DEVELOPMENT'], tagCode: 'INITIAL',
      rates: { P1: { code: 'WEB_DEV', name: 'A', rate: 40000 }, P2: { code: 'WEB_DEV', name: 'B', rate: 30000 } },
      modules: [{ name: 'M', tasks: [{ name: 'T', hours_pm: 99, role_hours: { P1: 2, P2: 3 } }] }],
    });
    assert.equal(est.total_hours, 5);
    assert.equal(est.total_cost, 2 * 40000 + 3 * 30000);
    assert.equal(est.cost_by_role.P1, 80000);
    assert.equal(est.cost_by_role.P2, 90000);
  });

  it('with a worker registry: requires a registered worker and takes the name from the master', () => {
    const reg = new Map([[7, 'Ade Isman Aji']]);
    const ok = parseRateSnapshotInput({ P1: { code: 'WEB_DEV', name: 'spoofed', rate: 42771, worker_id: 7 } }, ROLES, reg);
    assert.equal(ok.ok, true);
    if (ok.ok) assert.deepEqual(ok.snapshot.P1, { code: 'WEB_DEV', name: 'Ade Isman Aji', rate: 42771, worker_id: 7 });
    assert.equal(parseRateSnapshotInput({ P1: { code: 'WEB_DEV', name: 'A', rate: 1 } }, ROLES, reg).ok, false);
    assert.equal(parseRateSnapshotInput({ P1: { code: 'WEB_DEV', name: 'A', rate: 1, worker_id: 99 } }, ROLES, reg).ok, false);
    assert.equal(parseRateSnapshotInput({ P1: { code: 'WEB_DEV', name: 'A', rate: 1, worker_id: '7' } }, ROLES, reg).ok, false);
  });
  it('the same worker may hold two roles in one snapshot and labels stay distinguishable', () => {
    const reg = new Map([[7, 'Ade Isman Aji']]);
    const r = parseRateSnapshotInput({
      P1: { code: 'WEB_DEV', name: 'x', rate: 1, worker_id: 7 },
      P2: { code: 'UI_UX', name: 'x', rate: 1, worker_id: 7 },
    }, ROLES, reg);
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(snapshotLabels(r.snapshot), { P1: 'WEB_DEV · AIA', P2: 'UI_UX · AIA' });
  });

  it('seeds one empty row per role, in role order, with sequential person keys', () => {
    const seeded = seedPeopleFromRoles(['PM', 'WEB_DEV', 'UI_UX']);
    assert.deepEqual(Object.keys(seeded), ['P1', 'P2', 'P3']);
    assert.deepEqual(seeded.P2, { code: 'WEB_DEV', name: '', rate: 0 });
    assert.deepEqual(seedPeopleFromRoles([]), {});
  });
  it('filledPeople keeps only rows with a chosen worker; unfilled role rows are ignored', () => {
    const snap = {
      P1: { code: 'PM', name: '', rate: 0 },
      P2: { code: 'WEB_DEV', name: 'Ade Isman Aji', rate: 42771, worker_id: 1 },
      P3: { code: 'UI_UX', name: '', rate: 0 },
    };
    assert.deepEqual(Object.keys(filledPeople(snap)), ['P2']);
    assert.deepEqual(filledPeople({}), {});
  });
  it('template hours only go to people whose worker is chosen', () => {
    const snap = {
      P1: { code: 'WEB_DEV', name: '', rate: 0 },
      P2: { code: 'WEB_DEV', name: 'Bain', rate: 35818, worker_id: 2 },
    };
    const r = assignRoleHoursToPeople({ WEB_DEV: 4 }, filledPeople(snap));
    assert.deepEqual(r.hours, { P2: 4 });
    assert.deepEqual(assignRoleHoursToPeople({ WEB_DEV: 4 }, filledPeople({ P1: snap.P1 })).dropped, ['WEB_DEV']);
  });
});
