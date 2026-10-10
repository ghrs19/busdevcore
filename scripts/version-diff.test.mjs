import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions } from '../src/lib/version-diff.ts';

test('perubahan task, jam, biaya; tambah/hapus dan modul dengan nama sama', () => {
  const older = { modules: [
    { name: 'A', tasks: [{ name: 'Build', total_hours: '2', total_cost: '100' }, { name: 'Delete', total_hours: 3, total_cost: 90 }] },
    { name: 'B', tasks: [{ name: 'Build', total_hours: 1, total_cost: 40 }] },
  ] };
  const newer = { modules: [
    { name: 'A', tasks: [{ name: 'Build', total_hours: 4, total_cost: 180 }, { name: 'Add', total_hours: 1, total_cost: 30 }] },
    { name: 'B', tasks: [{ name: 'Build', total_hours: 1, total_cost: 40 }] },
  ] };
  const rows = compareVersions(older, newer);
  assert.deepEqual(rows.map(({ module, task, beforeHours, afterHours, beforeCost, afterCost }) => [module, task, beforeHours, afterHours, beforeCost, afterCost]), [
    ['A', 'Build', 2, 4, 100, 180], ['A', 'Delete', 3, null, 90, null], ['A', 'Add', null, 1, null, 30],
  ]);
  assert.deepEqual(compareVersions(newer, newer), []);
});
