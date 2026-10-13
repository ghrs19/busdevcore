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
  marketing_fee_type?: 'PERCENTAGE' | 'NOMINAL';
  marketing_fee_value?: number;
}
export type CategoryPricing = Partial<Record<PricingCategory, CategoryLine>>;

export interface DiscountOptions {
  discountType: 'PERCENTAGE' | 'NOMINAL';
  discountValue: number;
  taxEnabled: boolean;
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

export function marketingFeeForCategory(line: CategoryLine): number {
  const value = Math.max(0, Number(line.marketing_fee_value) || 0);
  return line.marketing_fee_type === 'NOMINAL'
    ? Math.round(value)
    : Math.round(line.base_price * (Math.min(value, 100) / 100));
}

export function marketingFeeAllocations(lines: CategoryPricing): Partial<Record<PricingCategory, number>> {
  const out: Partial<Record<PricingCategory, number>> = {};
  for (const cat of CATEGORY_ORDER) {
    const line = lines[cat];
    if (line) out[cat] = marketingFeeForCategory(line);
  }
  return out;
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
  const allocations = marketingFeeAllocations(lines);
  const marketingFee = Object.values(allocations).reduce((sum, value) => sum + (value || 0), 0);

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
  const weightSum = cats.reduce((sum, c) => sum + (lines[c]?.base_price || 0), 0);
  const fixedFee = cats.reduce((sum, c) => sum + (lines[c]?.marketing_fee_type === 'NOMINAL' ? Math.max(0, lines[c]?.marketing_fee_value || 0) : 0), 0);
  const weightedRate = weightSum > 0
    ? cats.reduce((sum, c) => sum + (lines[c]?.marketing_fee_type !== 'NOMINAL' ? ((lines[c]?.marketing_fee_value || 0) / 100) * ((lines[c]?.base_price || 0) / weightSum) : 0), 0)
    : 0;
  targetBase = Math.max(0, Math.round((targetBase - fixedFee) / (1 + weightedRate)));

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
    out[c] = { ...l, cogs: l.cogs, base_price: floors[idx], margin_percent: marginFromPrice(l.cogs, floors[idx]) };
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
    if (r.marketing_fee_type !== undefined && r.marketing_fee_type !== 'NOMINAL' && r.marketing_fee_type !== 'PERCENTAGE') return { ok: false, error: `Tipe fee marketing kategori ${key} tidak valid.` };
    const feeType = r.marketing_fee_type === 'NOMINAL' ? 'NOMINAL' : 'PERCENTAGE';
    const feeValue = r.marketing_fee_value === undefined ? 0 : Number(r.marketing_fee_value);
    if (![cogs, base, feeValue].every((v) => Number.isFinite(v) && v >= 0 && v <= MAX_AMOUNT)) return { ok: false, error: `Nominal kategori ${key} tidak valid.` };
    if (feeType === 'PERCENTAGE' && feeValue > 100) return { ok: false, error: `Fee marketing kategori ${key} harus 0 sampai 100%.` };
    if (!Number.isFinite(margin) || margin < 0 || margin > 100) return { ok: false, error: `Margin kategori ${key} harus 0 sampai 100.` };
    out[key as PricingCategory] = { cogs: Math.round(cogs), margin_percent: Number(margin.toFixed(2)), base_price: Math.round(base), marketing_fee_type: feeType, marketing_fee_value: feeType === 'PERCENTAGE' ? Number(feeValue.toFixed(2)) : Math.round(feeValue) };
  }
  return { ok: true, pricing: out };
}

// What the client may see: category name and price only. No COGS, no margin.
export function publicPriceLines(lines: CategoryPricing | null | undefined, showMarketingFeeSeparately = false): Array<{ category: PricingCategory; label: string; price: number }> {
  if (!lines) return [];
  const allocations = marketingFeeAllocations(lines);
  return CATEGORY_ORDER.filter((c) => lines[c]).map((c) => ({
    category: c,
    label: CATEGORY_LABELS[c],
    price: (lines[c] as CategoryLine).base_price + (showMarketingFeeSeparately ? 0 : (allocations[c] || 0)),
  }));
}

export function publicMarketingFeeLines(lines: CategoryPricing | null | undefined, showMarketingFeeSeparately = false): Array<{ category: PricingCategory; label: string; amount: number }> {
  if (!lines || !showMarketingFeeSeparately) return [];
  const allocations = marketingFeeAllocations(lines);
  return CATEGORY_ORDER.filter((c) => (allocations[c] || 0) > 0).map((c) => ({ category: c, label: `Fee Marketing - ${CATEGORY_LABELS[c]}`, amount: allocations[c] || 0 }));
}
