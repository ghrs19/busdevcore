import {
  computeTotals,
  CATEGORY_ORDER,
  parseCategoryPricing,
  type CategoryPricing,
  type Totals,
} from './commercial-pricing.ts';

// Validates the per-category payload and recomputes the combined figures on the server, so
// the stored cogs / margin / base price / tax / grand total always agree with the categories.
export function resolveCommercialPricing(body: {
  category_pricing?: unknown;
  discount_type?: unknown;
  discount_value?: unknown;
  is_tax_enabled?: unknown;
  marketing_fee_percent?: unknown;
  marketing_fee_categories?: unknown;
  marketing_fee_mode?: unknown;
}): { ok: true; pricing: CategoryPricing; totals: Totals; discountType: 'PERCENTAGE' | 'NOMINAL'; discountValue: number; taxEnabled: boolean; marketingFeePercent: number; marketingFeeCategories: import('./commercial-pricing').PricingCategory[]; marketingFeeMode: 'ALL_PROPORTIONAL' | 'SELECTED_ONLY' } | { ok: false; error: string } {
  const parsed = parseCategoryPricing(body.category_pricing);
  if (!parsed.ok) return parsed;
  const discountType = body.discount_type === 'NOMINAL' ? 'NOMINAL' : 'PERCENTAGE';
  const rawValue = typeof body.discount_value === 'number' ? body.discount_value : Number(body.discount_value);
  const discountValue = Number.isFinite(rawValue) && rawValue >= 0 ? rawValue : 0;
  if (discountType === 'PERCENTAGE' && discountValue > 100) return { ok: false, error: 'Diskon persen maksimal 100.' };
  const taxEnabled = Boolean(body.is_tax_enabled);
  const rawMarketing = body.marketing_fee_percent == null ? 0 : Number(body.marketing_fee_percent);
  const marketingFeePercent = Number.isFinite(rawMarketing) ? rawMarketing : 0;
  if (marketingFeePercent < 0 || marketingFeePercent > 100) return { ok: false, error: 'Fee marketing harus 0 sampai 100%.' };
  const rawCats = body.marketing_fee_categories ?? [];
  if (!Array.isArray(rawCats) || rawCats.some((c) => typeof c !== 'string' || !CATEGORY_ORDER.includes(c as never))) return { ok: false, error: 'Kategori fee marketing tidak valid.' };
  const marketingFeeMode = body.marketing_fee_mode === 'SELECTED_ONLY' ? 'SELECTED_ONLY' : 'ALL_PROPORTIONAL';
  const requestedCats = rawCats as import('./commercial-pricing').PricingCategory[];
  const marketingFeeCategories = marketingFeeMode === 'ALL_PROPORTIONAL'
    ? CATEGORY_ORDER.filter((c) => parsed.pricing[c])
    : requestedCats.filter((c) => parsed.pricing[c]);
  if (marketingFeePercent > 0 && marketingFeeCategories.length === 0) return { ok: false, error: 'Pilih minimal satu kategori untuk fee marketing.' };
  const totals = computeTotals(parsed.pricing, { discountType, discountValue, taxEnabled, marketingFeePercent, marketingFeeCategories });
  return { ok: true, pricing: parsed.pricing, totals, discountType, discountValue, taxEnabled, marketingFeePercent, marketingFeeCategories, marketingFeeMode };
}
