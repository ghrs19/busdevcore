// Commercial pricing per category. Margin and base price are set per category; discount and PPN
// stay a single value applied to the total. Pure functions so the form, API and print share one source.

export const CATEGORY_ORDER = ['DEVELOPMENT', 'MAINTENANCE', 'OPERATION', 'INFRASTRUCTURE'] as const;
export type PricingCategory = (typeof CATEGORY_ORDER)[number];

export const CATEGORY_LABELS: Record<PricingCategory, string> = {
  DEVELOPMENT: 'Development',
  MAINTENANCE: 'Maintenance',
  OPERATION: 'Operasional',
  INFRASTRUCTURE: 'Infrastruktur',
};

export const TAX_RATE = 0.11;
export const MAX_AMOUNT = 100_000_000_000;

export interface CategoryLine {
  cogs: number;
  margin_percent: number;
  base_price: number;
}
export type CategoryPricing = Partial<Record<PricingCategory, CategoryLine>>;

export interface DiscountOptions {
  discountType: 'PERCENTAGE' | 'NOMINAL';
  discountValue: number;
  taxEnabled: boolean;
  marketingFeePercent?: number;
  marketingFeeCategories?: PricingCategory[];
  marketingFeeMode?: 'ALL_PROPORTIONAL' | 'SELECTED_ONLY';
}

export interface Totals {
  cogs: number;
  base_price: number;
  marketing_fee: number;
  discount: number;
  subtotal: number;
  tax: number;
  grand_total: number;
  margin_percent: number;
}

interface BillingLike {
  one_time_dev?: number;
  one_time_infra?: number;
  total_maintenance?: number;
  recurring_infra?: number;
}

// Estimate cost per category. Infrastructure = one-time setup + recurring; zero-cost lines are omitted.
export function buildCategoryCogs(params: {
  billing: BillingLike;
  operationalTotal: number;
  categories: string[];
}): Partial<Record<PricingCategory, number>> {
  const has = new Set(params.categories.map((c) => c.toUpperCase()));
  const raw: Record<PricingCategory, number> = {
    DEVELOPMENT: Number(params.billing.one_time_dev) || 0,
    MAINTENANCE: Number(params.billing.total_maintenance) || 0,
    OPERATION: Number(params.operationalTotal) || 0,
    INFRASTRUCTURE: (Number(params.billing.one_time_infra) || 0) + (Number(params.billing.recurring_infra) || 0),
  };
  const out: Partial<Record<PricingCategory, number>> = {};
  for (const cat of CATEGORY_ORDER) {
    if (has.has(cat) && raw[cat] > 0) out[cat] = raw[cat];
  }
  return out;
}

const clampMargin = (m: number) => Math.min(Math.max(Number.isFinite(m) ? m : 0, 0), 99.99);

export function priceFromMargin(cogs: number, marginPercent: number): number {
  const m = clampMargin(marginPercent) / 100;
  return Math.round(cogs / (1 - m));
}

export function marginFromPrice(cogs: number, basePrice: number): number {
  return basePrice > 0 ? Number((((basePrice - cogs) / basePrice) * 100).toFixed(2)) : 0;
}

export function discountAmount(base: number, type: 'PERCENTAGE' | 'NOMINAL', value: number): number {
  if (type === 'PERCENTAGE') return Math.round(base * (Math.min(Math.max(value, 0), 100) / 100));
  return Math.min(Math.max(value, 0), base);
}

export function marketingFeeAllocations(lines: CategoryPricing, percent: number, selected: PricingCategory[]): Partial<Record<PricingCategory, number>> {
  const cats = CATEGORY_ORDER.filter((c) => lines[c] && selected.includes(c));
  const fee = Math.round(CATEGORY_ORDER.reduce((sum, c) => sum + (lines[c]?.base_price || 0), 0) * (Math.min(Math.max(percent, 0), 100) / 100));
  const weightTotal = cats.reduce((sum, c) => sum + (lines[c]?.base_price || 0), 0);
  const allocation: Partial<Record<PricingCategory, number>> = {};
  if (!cats.length) return allocation;
  const exact = cats.map((c) => fee * (weightTotal > 0 ? (lines[c]?.base_price || 0) / weightTotal : 1 / cats.length));
  const rounded = exact.map(Math.floor);
  let rem = fee - rounded.reduce((a, b) => a + b, 0);
  exact.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac).forEach(({ i }) => { if (rem > 0) { rounded[i]++; rem--; } });
  cats.forEach((c, i) => { allocation[c] = rounded[i]; });
  return allocation;
}

export function computeTotals(lines: CategoryPricing, opts: DiscountOptions): Totals {
  let cogs = 0;
  let base = 0;
  for (const cat of CATEGORY_ORDER) {
    const l = lines[cat];
    if (!l) continue;
    cogs += l.cogs;
    base += l.base_price;
  }
  const marketingFee = Math.round(base * (Math.min(Math.max(opts.marketingFeePercent ?? 0, 0), 100) / 100));

  const priceBeforeDiscount = base + marketingFee;
  const discount = discountAmount(priceBeforeDiscount, opts.discountType, opts.discountValue);
  const subtotal = Math.max(0, priceBeforeDiscount - discount);
  const tax = opts.taxEnabled ? Math.round(subtotal * TAX_RATE) : 0;
  return {
    cogs,
    base_price: base,
    marketing_fee: marketingFee,
    discount,
    subtotal,
    tax,
    grand_total: subtotal + tax,
    margin_percent: marginFromPrice(cogs, base),
  };
}

// Editing the grand total scales every category price proportionally (largest remainder keeps the sum exact).
export function distributeGrandTotal(lines: CategoryPricing, grandTotal: number, opts: DiscountOptions): CategoryPricing {
  const cats = CATEGORY_ORDER.filter((c) => lines[c]);
  if (cats.length === 0) return lines;

  let subtotal = opts.taxEnabled ? Math.round(grandTotal / (1 + TAX_RATE)) : grandTotal;
  subtotal = Math.max(0, subtotal);
  let targetBase = subtotal;
  if (opts.discountType === 'PERCENTAGE' && opts.discountValue > 0 && opts.discountValue < 100) {
    targetBase = Math.round(subtotal / (1 - opts.discountValue / 100));
  } else if (opts.discountType === 'NOMINAL') {
    targetBase = subtotal + Math.max(opts.discountValue, 0);
  }
  targetBase = Math.round(targetBase / (1 + Math.min(Math.max(opts.marketingFeePercent ?? 0, 0), 100) / 100));

  const currentSum = cats.reduce((acc, c) => acc + (lines[c] as CategoryLine).base_price, 0);
  const weights = cats.map((c) => (currentSum > 0 ? (lines[c] as CategoryLine).base_price / currentSum : c === cats[0] ? 1 : 0));
  const exact = weights.map((w) => w * targetBase);
  const floors = exact.map((v) => Math.floor(v));
  let remainder = targetBase - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i] += 1;
    remainder -= 1;
  }

  const out: CategoryPricing = {};
  cats.forEach((c, idx) => {
    const l = lines[c] as CategoryLine;
    out[c] = { cogs: l.cogs, base_price: floors[idx], margin_percent: marginFromPrice(l.cogs, floors[idx]) };
  });
  return out;
}

export type ParseResult = { ok: true; pricing: CategoryPricing } | { ok: false; error: string };

export function parseCategoryPricing(input: unknown): ParseResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Harga per kategori tidak valid.' };
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length === 0) return { ok: false, error: 'Minimal 1 kategori harga.' };
  const allowed = new Set<string>(CATEGORY_ORDER);
  const out: CategoryPricing = {};
  for (const [key, raw] of entries) {
    if (!allowed.has(key)) return { ok: false, error: `Kategori tidak dikenal: ${key}.` };
    if (!raw || typeof raw !== 'object') return { ok: false, error: `Data kategori ${key} tidak valid.` };
    const r = raw as Record<string, unknown>;
    const cogs = typeof r.cogs === 'number' ? r.cogs : Number.NaN;
    const margin = typeof r.margin_percent === 'number' ? r.margin_percent : Number.NaN;
    const base = typeof r.base_price === 'number' ? r.base_price : Number.NaN;
    if (![cogs, base].every((v) => Number.isFinite(v) && v >= 0 && v <= MAX_AMOUNT)) return { ok: false, error: `Nominal kategori ${key} tidak valid.` };
    if (!Number.isFinite(margin) || margin < 0 || margin > 100) return { ok: false, error: `Margin kategori ${key} harus 0 sampai 100.` };
    out[key as PricingCategory] = { cogs: Math.round(cogs), margin_percent: Number(margin.toFixed(2)), base_price: Math.round(base) };
  }
  return { ok: true, pricing: out };
}

// What the client may see: category name and price only. No COGS, no margin.
export function publicPriceLines(lines: CategoryPricing | null | undefined, marketingFeePercent = 0, marketingFeeCategories: PricingCategory[] = []): Array<{ category: PricingCategory; label: string; price: number }> {
  if (!lines) return [];
  const allocations = marketingFeeAllocations(lines, marketingFeePercent, marketingFeeCategories);
  return CATEGORY_ORDER.filter((c) => lines[c]).map((c) => ({
    category: c,
    label: CATEGORY_LABELS[c],
    price: (lines[c] as CategoryLine).base_price + (allocations[c] || 0),
  }));
}
