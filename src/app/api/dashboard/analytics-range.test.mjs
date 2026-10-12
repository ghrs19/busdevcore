import test from 'node:test';
import assert from 'node:assert/strict';
import { getDashboardRange } from './analytics-range.mjs';

test('accepts supported dashboard ranges and leaves all-time unbounded', () => {
  assert.deepEqual(getDashboardRange('all'), null);
  assert.deepEqual(getDashboardRange('30'), { days: 30 });
  assert.deepEqual(getDashboardRange('90'), { days: 90 });
});

test('falls back to all-time for invalid ranges', () => {
  assert.equal(getDashboardRange('0'), null);
  assert.equal(getDashboardRange('999'), null);
  assert.equal(getDashboardRange(null), null);
});
