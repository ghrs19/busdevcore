import test from 'node:test';
import assert from 'node:assert/strict';
import { persistCommercialSchedule } from './commercial-schedule.ts';

function scheduleDb(seed = [], failAt = Infinity) {
  let rows = structuredClone(seed);
  let snapshot;
  let calls = 0;
  const client = {
    async query(sql, values = []) {
      calls++;
      if (calls === failAt) throw new Error('query failed');
      if (sql.includes('FOR UPDATE')) return { rows: structuredClone(rows) };
      if (sql.includes('COALESCE(MAX(term_index)')) {
        return { rows: Object.entries(Object.groupBy(rows, row => row.billing_type)).map(([billing_type, group]) => ({ billing_type, max_index: Math.max(...group.map(row => row.term_index)) })) };
      }
      if (sql.includes('DELETE FROM payment_milestone_invoices')) {
        const [proposal_id, billing_type, keep_ids = []] = values;
        rows = rows.filter(row => !(row.proposal_id === proposal_id && row.billing_type === billing_type && !keep_ids.includes(row.id) && !['invoiced', 'paid', 'overdue'].includes(row.billing_status) && !row.proof_file_url));
      }
      if (sql.includes('UPDATE payment_milestone_invoices')) {
        const [milestone_name, percent, amount, trigger_condition, phase, period_month, coverage_period, updated_by_user_id, due_date, id] = values;
        rows = rows.map(row => row.id === id && !['invoiced', 'paid'].includes(row.billing_status)
          ? { ...row, milestone_name, percent, amount, trigger_condition, phase, period_month, coverage_period, updated_by_user_id, due_date: due_date || row.due_date }
          : row);
      }
      if (sql.includes('INSERT INTO payment_milestone_invoices')) {
        const [proposal_id, billing_type, term_index, milestone_name, percent, amount, trigger_condition, phase, period_month, coverage_period, updated_by_user_id] = values;
        if (!rows.some(row => row.proposal_id === proposal_id && row.billing_type === billing_type && row.term_index === term_index)) {
          const due_date = values[11] || null;
          rows.push({ id: Math.max(0, ...rows.map(row => row.id)) + 1, proposal_id, billing_type, term_index, milestone_name, percent, amount, trigger_condition, phase, period_month, coverage_period, updated_by_user_id, due_date, billing_status: 'draft' });
        }
      }
      return { rows: [] };
    },
  };
  return {
    client,
    rows: () => structuredClone(rows),
    async transaction(work) {
      snapshot = structuredClone(rows);
      try { await work(client); } catch (error) { rows = snapshot; throw error; }
    },
  };
}

const baseProposal = { payment_terms: [{ name: 'Updated draft', percent: 60, amount: 600 }, { name: 'Additional term', percent: 40, amount: 400 }] };

test('reconciliation leaves invoiced and paid rows unchanged', async () => {
  const protectedRows = [
    { id: 1, proposal_id: 7, billing_type: 'milestone', term_index: 1, billing_status: 'invoiced', milestone_name: 'Sent', amount: 10 },
    { id: 2, proposal_id: 7, billing_type: 'milestone', term_index: 2, billing_status: 'paid', milestone_name: 'Settled', amount: 20 },
  ];
  const db = scheduleDb(protectedRows);
  await persistCommercialSchedule(db.client, 7, baseProposal, {}, 9);
  assert.deepEqual(db.rows().slice(0, 2), protectedRows);
});

test('reconciliation updates drafts and assigns added terms after protected indexes', async () => {
  const db = scheduleDb([
    { id: 1, proposal_id: 7, billing_type: 'milestone', term_index: 1, billing_status: 'invoiced', milestone_name: 'Sent', amount: 10 },
    { id: 2, proposal_id: 7, billing_type: 'milestone', term_index: 2, billing_status: 'draft', milestone_name: 'Old draft', amount: 20 },
    { id: 3, proposal_id: 7, billing_type: 'milestone', term_index: 3, billing_status: 'paid', milestone_name: 'Settled', amount: 30 },
  ]);
  await persistCommercialSchedule(db.client, 7, baseProposal, {}, 9);
  const rows = db.rows();
  assert.equal(rows.find(row => row.id === 1).milestone_name, 'Sent');
  assert.equal(rows.find(row => row.id === 2).milestone_name, 'Updated draft');
  assert.equal(rows.find(row => row.id === 2).amount, 600);
  assert.equal(rows.find(row => row.id === 3).milestone_name, 'Settled');
  assert.deepEqual(rows.filter(row => row.billing_type === 'milestone' && row.id > 3).map(row => [row.term_index, row.milestone_name]), [[4, 'Additional term']]);
});

test('shrink and recurring-off deactivate obsolete drafts without changing invoices', async () => {
  const seed = [
    { id: 1, proposal_id: 7, billing_type: 'milestone', term_index: 1, billing_status: 'draft', milestone_name: 'Old 1' },
    { id: 2, proposal_id: 7, billing_type: 'milestone', term_index: 2, billing_status: 'draft', milestone_name: 'Old 2' },
    { id: 3, proposal_id: 7, billing_type: 'milestone', term_index: 3, billing_status: 'paid', milestone_name: 'Paid' },
    { id: 4, proposal_id: 7, billing_type: 'recurring_monthly', term_index: 1, billing_status: 'draft', milestone_name: 'Retainer' },
    { id: 5, proposal_id: 7, billing_type: 'recurring_monthly', term_index: 2, billing_status: 'invoiced', milestone_name: 'Issued' },
  ];
  const db = scheduleDb(seed);
  await persistCommercialSchedule(db.client, 7, { payment_terms: [{ name: 'One' }] }, {}, 9);
  const rows = db.rows();
  assert.equal(rows.some(row => row.id === 2), false);
  assert.equal(rows.some(row => row.id === 4), false);
  assert.equal(rows.find(row => row.id === 3).billing_status, 'paid');
  assert.equal(rows.find(row => row.id === 5).billing_status, 'invoiced');
});

test('does not modify or delete draft rows with uploaded proof files', async () => {
  const db = scheduleDb([{ id: 1, proposal_id: 7, billing_type: 'milestone', term_index: 1, billing_status: 'unbilled', proof_file_url: '/api/files/proof.pdf', milestone_name: 'Proof attached' }]);
  await persistCommercialSchedule(db.client, 7, { payment_terms: [] }, {}, 9);
  assert.equal(db.rows()[0].proof_file_url, '/api/files/proof.pdf');
});

test('new recurring row reuses lowest free term index before protected historical rows', async () => {
  const db = scheduleDb([
    { id: 1, proposal_id: 7, billing_type: 'recurring_monthly', term_index: 1, billing_status: 'unbilled', milestone_name: 'old draft' },
    { id: 2, proposal_id: 7, billing_type: 'recurring_monthly', term_index: 3, billing_status: 'paid', period_month: 3, milestone_name: 'paid historical' },
  ]);
  await persistCommercialSchedule(db.client, 7, { created_at: '2025-01-20T12:00:00Z', maintenance_billing_mode: 'MONTHLY_RETAINER' }, { maintenance_config: { duration_months: 2, monthly_cost: 100 } }, 9);
  const newRow = db.rows().find(row => row.id > 2);
  assert.equal(newRow.term_index, 2);
  assert.equal(newRow.period_month, 2);
  assert.equal(newRow.due_date, '2025-04-05');
});

test('recurring due dates use Asia/Jakarta calendar even near UTC month boundary', async () => {
  const db = scheduleDb();
  await persistCommercialSchedule(db.client, 7, {
    created_at: '2025-01-31T18:00:00Z', maintenance_billing_mode: 'MONTHLY_RETAINER',
  }, { maintenance_config: { duration_months: 1, monthly_cost: 100 } }, 9);
  assert.equal(db.rows()[0].due_date, '2025-04-05');
});

test('recurring due dates stay calendar-correct outside UTC', async () => {
  const previousTz = process.env.TZ;
  process.env.TZ = 'Pacific/Kiritimati';
  try {
    const db = scheduleDb();
    await persistCommercialSchedule(db.client, 7, {
      created_at: '2025-01-20T12:00:00Z', maintenance_billing_mode: 'MONTHLY_RETAINER',
    }, { maintenance_config: { duration_months: 2, monthly_cost: 100 } }, 9);
    assert.deepEqual(db.rows().map(row => row.due_date), ['2025-03-05', '2025-04-05']);
  } finally {
    if (previousTz === undefined) delete process.env.TZ;
    else process.env.TZ = previousTz;
  }
});

test('transaction rolls back all schedule changes when reconciliation fails', async () => {
  const original = [{ id: 1, proposal_id: 7, billing_type: 'milestone', term_index: 1, billing_status: 'draft', milestone_name: 'Old', amount: 10 }];
  const db = scheduleDb(original, 4);
  await assert.rejects(db.transaction(client => persistCommercialSchedule(client, 7, baseProposal, {}, 9)), /query failed/);
  assert.deepEqual(db.rows(), original);
});

test('retainer rate uses the Maintenance and Infrastructure category margins', async () => {
  const db = scheduleDb();
  await persistCommercialSchedule(db.client, 7, {
    created_at: '2025-01-20T12:00:00Z', maintenance_billing_mode: 'MONTHLY_RETAINER',
    margin_percent: 10, maintenance_margin_percent: 50, infrastructure_margin_percent: 20,
  }, {
    maintenance_config: { duration_months: 1, monthly_cost: 1000 },
    infrastructure_items: [{ billing_type: 'MONTHLY', unit_cost: 500, quantity: 1 }],
  }, 9);
  // 1000 * 1.50 + 500 * 1.20 = 2100 (not the combined 10% margin)
  assert.equal(db.rows()[0].amount, 2100);
});

test('retainer rate falls back to the combined margin for proposals without category pricing', async () => {
  const db = scheduleDb();
  await persistCommercialSchedule(db.client, 7, {
    created_at: '2025-01-20T12:00:00Z', maintenance_billing_mode: 'MONTHLY_RETAINER', margin_percent: 30,
  }, { maintenance_config: { duration_months: 1, monthly_cost: 1000 } }, 9);
  assert.equal(db.rows()[0].amount, 1300);
});
