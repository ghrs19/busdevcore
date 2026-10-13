type ScheduleRow = {
  id: number;
  billing_type: string;
  term_index: number;
  billing_status: string;
  proof_file_url?: string | null;
};
type ScheduleItem = {
  milestone_name?: string;
  name?: string;
  percent?: number;
  amount?: number;
  trigger_condition?: string | null;
  phase?: string | null;
  period_month?: number | null;
  coverage_period?: string | null;
};
type ScheduleClient = { query: (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };
type ProposalSchedule = {
  payment_terms?: ScheduleItem[];
  margin_percent?: number;
  maintenance_margin_percent?: number;
  infrastructure_margin_percent?: number;
  maintenance_billing_mode?: string;
  created_at?: string | Date;
};
type EstimateSchedule = {
  maintenance_config?: { duration_months?: number; monthly_cost?: number };
  infrastructure_items?: Array<{ billing_type?: string; unit_cost?: number; quantity?: number }>;
};

export async function persistCommercialSchedule(
  client: ScheduleClient,
  proposalId: number,
  proposal: ProposalSchedule,
  estimate: EstimateSchedule,
  userId: number,
): Promise<void> {
  const existingResult = await client.query(`
    SELECT * FROM payment_milestone_invoices
    WHERE proposal_id = $1
    ORDER BY billing_type, term_index, id
    FOR UPDATE
  `, [proposalId]);
  const existing = existingResult.rows as unknown as ScheduleRow[];
  const isProtected = (row: ScheduleRow) => ['invoiced', 'paid', 'overdue'].includes(row.billing_status) || Boolean(row.proof_file_url);
  const protectedKeys = new Set(existing
    .filter(isProtected)
    .map(row => `${row.billing_type}:${row.term_index}`));
  const occupiedByType = new Map<string, Set<number>>();
  for (const row of existing) {
    const occupied = occupiedByType.get(row.billing_type) || new Set<number>();
    occupied.add(row.term_index);
    occupiedByType.set(row.billing_type, occupied);
  }
  const insert = async (schedule: ScheduleItem[], billingType: string, dueDateFor?: (index: number) => string) => {
    const drafts = existing.filter(row => row.billing_type === billingType && !isProtected(row));
    for (let i = 0; i < schedule.length; i++) {
      const item = schedule[i];
      const values = [item.milestone_name || item.name || `${billingType} ${i + 1}`, Number(item.percent) || 0,
        Number(item.amount) || 0, item.trigger_condition || null, item.phase || null, item.period_month || null,
        item.coverage_period || null, userId, dueDateFor?.(i) || null];
      const draft = drafts[i];
      if (draft) {
        await client.query(`
          UPDATE payment_milestone_invoices SET milestone_name = $1, percent = $2, amount = $3,
            trigger_condition = $4, phase = $5, period_month = $6, coverage_period = $7,
            updated_by_user_id = $8, due_date = COALESCE($9, due_date), updated_at = NOW()
          WHERE id = $10 AND proof_file_url IS NULL AND billing_status NOT IN ('invoiced', 'paid', 'overdue')
        `, [...values, draft.id]);
        continue;
      }
      const occupied = occupiedByType.get(billingType) || new Set<number>();
      let nextTermIndex = 1;
      while (occupied.has(nextTermIndex) || protectedKeys.has(`${billingType}:${nextTermIndex}`)) nextTermIndex++;
      occupied.add(nextTermIndex);
      occupiedByType.set(billingType, occupied);
      await client.query(`
        INSERT INTO payment_milestone_invoices
          (proposal_id, billing_type, term_index, milestone_name, percent, amount, trigger_condition,
           phase, period_month, coverage_period, updated_by_user_id, due_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (proposal_id, billing_type, term_index) DO NOTHING
      `, [proposalId, billingType, nextTermIndex, ...values]);
    }
  };

  const milestoneDrafts = existing.filter(row => row.billing_type === 'milestone' && !isProtected(row));
  const keptMilestoneIds = existing.filter(row => row.billing_type === 'milestone' && isProtected(row)).map(row => row.id);
  // Remove surplus drafts before adding newly required schedule rows.
  const milestoneKeepIds = [...keptMilestoneIds, ...milestoneDrafts.slice(0, Array.isArray(proposal.payment_terms) ? proposal.payment_terms.length : 0).map(row => row.id)];
  await client.query("DELETE FROM payment_milestone_invoices WHERE proposal_id = $1 AND billing_type = $2 AND id <> ALL($3) AND proof_file_url IS NULL AND billing_status NOT IN ('invoiced', 'paid', 'overdue')", [proposalId, 'milestone', milestoneKeepIds]);
  await insert(Array.isArray(proposal.payment_terms) ? proposal.payment_terms : [], 'milestone');
  const config = estimate.maintenance_config || {};
  const duration = Number(config.duration_months) || 0;
  const monthlyMnt = Number(config.monthly_cost) || 0;
  const monthlyInfra = (estimate.infrastructure_items || []).reduce((sum, item) =>
    sum + (item.billing_type === 'MONTHLY' ? 1 : item.billing_type === 'YEARLY' ? 1 / 12 : 0) * (Number(item.unit_cost) || 0) * (Number(item.quantity) || 1), 0);
  const months = duration || (monthlyInfra > 0 ? 12 : 0);
  const fallbackMargin = Number(proposal.margin_percent || 0);
  const mntMargin = Number(proposal.maintenance_margin_percent ?? fallbackMargin);
  const infraMargin = Number(proposal.infrastructure_margin_percent ?? fallbackMargin);
  const rate = Math.round(monthlyMnt * (1 + mntMargin / 100) + monthlyInfra * (1 + infraMargin / 100));
  const recurringEnabled = proposal.maintenance_billing_mode === 'MONTHLY_RETAINER' && months > 0 && rate > 0;
  const recurringDrafts = existing.filter(row => row.billing_type === 'recurring_monthly' && !isProtected(row));
  const recurringProtectedIds = existing.filter(row => row.billing_type === 'recurring_monthly' && isProtected(row)).map(row => row.id);
  const recurringKeepIds = [...recurringProtectedIds, ...(recurringEnabled ? recurringDrafts.slice(0, months).map(row => row.id) : [])];
  await client.query("DELETE FROM payment_milestone_invoices WHERE proposal_id = $1 AND billing_type = $2 AND id <> ALL($3) AND proof_file_url IS NULL AND billing_status NOT IN ('invoiced', 'paid', 'overdue')", [proposalId, 'recurring_monthly', recurringKeepIds]);
  if (recurringEnabled) {
    const created = new Date(proposal.created_at || new Date());
    const localDate = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(created).map(part => [part.type, part.value]));
    const firstDue = new Date(Date.UTC(Number(localDate.year), Number(localDate.month) - 1 + 2, 5));
    await insert(Array.from({ length: months }, (_, i) => ({
      milestone_name: `Retainer - Bulan ${i + 1}`, percent: 0, amount: rate,
      phase: 'MAINTENANCE', period_month: i + 1,
    })), 'recurring_monthly', i => new Date(Date.UTC(firstDue.getUTCFullYear(), firstDue.getUTCMonth() + i, 5)).toISOString().slice(0, 10));
  }
}
