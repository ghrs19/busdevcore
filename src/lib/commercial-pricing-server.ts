import {
  computeTotals,
  parseCategoryPricing,
  type CategoryPricing,
  type Totals,
} from './commercial-pricing';

// Validates the per-category payload and recomputes the combined figures on the server, so
// the stored cogs / margin / base price / tax / grand total always agree with the categories.
export function resolveCommercialPricing(body: {
  category_pricing?: unknown;
  discount_type?: unknown;
  discount_value?: unknown;
  is_tax_enabled?: unknown;
}): { ok: true; pricing: CategoryPricing; totals: Totals; discountType: 'PERCENTAGE' | 'NOMINAL'; discountValue: number; taxEnabled: boolean } | { ok: false; error: string } {
  const parsed = parseCategoryPricing(body.category_pricing);
  if (!parsed.ok) return parsed;
  const discountType = body.discount_type === 'NOMINAL' ? 'NOMINAL' : 'PERCENTAGE';
  const rawValue = typeof body.discount_value === 'number' ? body.discount_value : Number(body.discount_value);
  const discountValue = Number.isFinite(rawValue) && rawValue >= 0 ? rawValue : 0;
  if (discountType === 'PERCENTAGE' && discountValue > 100) return { ok: false, error: 'Diskon persen maksimal 100.' };
  const taxEnabled = Boolean(body.is_tax_enabled);
  const totals = computeTotals(parsed.pricing, { discountType, discountValue, taxEnabled });
  return { ok: true, pricing: parsed.pricing, totals, discountType, discountValue, taxEnabled };
}
