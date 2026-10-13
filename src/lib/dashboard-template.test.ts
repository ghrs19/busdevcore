import test from 'node:test';
import assert from 'node:assert/strict';
import { DASHBOARD_TEMPLATES, resolveDashboardTemplate } from './dashboard-template.mjs';

test('dashboard templates include corporate default and preserve classic option', () => {
  assert.equal(DASHBOARD_TEMPLATES.find((template) => template.id === 'corporate')?.name, 'Corporate Executive');
  assert.equal(DASHBOARD_TEMPLATES.some((template) => template.id === 'classic'), true);
});

test('unknown or missing dashboard template selects corporate default', () => {
  assert.equal(resolveDashboardTemplate(null), 'corporate');
  assert.equal(resolveDashboardTemplate('unknown'), 'corporate');
  assert.equal(resolveDashboardTemplate('corporate'), 'corporate');
});
