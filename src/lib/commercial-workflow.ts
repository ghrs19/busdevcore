export type PaymentMutation = {
  billingStatus?: string | null;
  amount: number;
  paidAmount: number;
  paidDate?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
};

export function validatePaymentMutation(input: PaymentMutation): string | null {
  const status = input.billingStatus || 'unbilled';
  if (!['unbilled', 'invoiced', 'paid', 'overdue'].includes(status)) return 'Status billing tidak valid.';
  if (!Number.isFinite(input.amount) || input.amount < 0) return 'Nominal tagihan tidak valid.';
  if (!Number.isFinite(input.paidAmount) || input.paidAmount < 0 || input.paidAmount > input.amount) return 'Nominal pembayaran harus antara Rp0 dan nominal tagihan.';
  if (status === 'paid' && (input.paidAmount !== input.amount || !input.paidDate)) return 'Invoice berstatus paid wajib memiliki pembayaran penuh dan tanggal bayar.';
  if (['invoiced', 'overdue'].includes(status) && (!input.invoiceNumber?.trim() || !input.invoiceDate || !input.dueDate)) return 'Invoice terbit wajib memiliki nomor, tanggal terbit, dan jatuh tempo.';
  if (status === 'unbilled' && input.paidAmount > 0) return 'Pembayaran tidak dapat dicatat pada jadwal yang belum ditagih.';
  return null;
}

export function validateBillingTransition(current: string, next: string): string | null {
  const allowed: Record<string, string[]> = {
    unbilled: ['unbilled', 'invoiced'],
    invoiced: ['invoiced', 'overdue', 'paid'],
    overdue: ['overdue', 'invoiced', 'paid'],
    paid: ['paid'],
  };
  return (allowed[current] || []).includes(next) ? null : `Transisi billing ${current} ke ${next} tidak diizinkan.`;
}

const TRANSITIONS: Record<string, string[]> = {
  draft: ['sent', 'negotiation', 'lost'],
  sent: ['negotiation', 'won', 'lost'],
  negotiation: ['sent', 'won', 'lost'],
  won: [],
  lost: [],
};

export function validateProposalTransition(current: string, next: string): string | null {
  if (current === next) return null;
  if (!(TRANSITIONS[current] || []).includes(next)) return `Transisi status ${current} ke ${next} tidak diizinkan.`;
  return null;
}

export const latestEstimateFilter = `e.id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY COALESCE(parent_id, id) ORDER BY version DESC, id DESC) AS rn
    FROM project_estimates
  ) versions WHERE rn = 1
)`;

export const latestProposalFilter = `cp.version = (
  SELECT MAX(cp2.version) FROM commercial_proposals cp2 WHERE cp2.proposal_number = cp.proposal_number
)`;

export const currentFinancialRowsCte = `WITH latest_won AS (
  SELECT cp.id FROM commercial_proposals cp
  WHERE cp.deal_status = 'won' AND cp.version = (SELECT MAX(cp2.version) FROM commercial_proposals cp2 WHERE cp2.proposal_number = cp.proposal_number)
), current_financial_rows AS (
  SELECT pmi.*, cp.proposal_number, cp.version AS proposal_version,
    CASE WHEN pmi.billing_status = 'paid' THEN 'paid'
         WHEN pmi.billing_status = 'overdue' OR (pmi.billing_status = 'invoiced' AND pmi.due_date < CURRENT_DATE) THEN 'overdue'
         ELSE pmi.billing_status END AS effective_status,
    GREATEST(pmi.amount - COALESCE(pmi.paid_amount, 0), 0) AS outstanding_amount
  FROM payment_milestone_invoices pmi JOIN commercial_proposals cp ON cp.id = pmi.proposal_id
  LEFT JOIN latest_won lw ON lw.id = cp.id
  WHERE lw.id IS NOT NULL OR pmi.billing_status IN ('invoiced', 'paid', 'overdue')
)`;

export const effectiveBillingStatus = `CASE
  WHEN pmi.billing_status = 'paid' THEN 'paid'
  WHEN pmi.billing_status = 'overdue' OR (pmi.billing_status = 'invoiced' AND pmi.due_date < CURRENT_DATE) THEN 'overdue'
  WHEN pmi.billing_status = 'invoiced' THEN 'invoiced'
  ELSE 'unbilled'
END`;
