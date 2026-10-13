import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCommercialPricing } from './commercial-pricing-server.ts';
import {
  CATEGORY_ORDER,
  buildCategoryCogs,
  priceFromMargin,
  marginFromPrice,
  computeTotals,
  distributeGrandTotal,
  parseCategoryPricing,
  publicPriceLines,
  publicMarketingFeeLines,
  type CategoryPricing,
} from './commercial-pricing.ts';

const billing = {
  one_time_dev: 10_000_000, one_time_infra: 2_000_000, total_one_time: 12_000_000,
  monthly_maintenance: 500_000, total_maintenance: 6_000_000,
  recurring_infra: 1_200_000, monthly_infra: 100_000, total_monthly_recurring: 600_000, grand_total: 19_200_000,
};

describe('commercial pricing per category', () => {
  it('orders categories Development, Maintenance, Operational, Infrastructure', () => {
    assert.deepEqual([...CATEGORY_ORDER], ['DEVELOPMENT', 'MAINTENANCE', 'OPERATION', 'INFRASTRUCTURE']);
  });

  it('splits estimate cost into category COGS; infra = one-time + recurring', () => {
    const cogs = buildCategoryCogs({ billing, operationalTotal: 750_000, categories: ['DEVELOPMENT', 'MAINTENANCE', 'OPERATION', 'INFRASTRUCTURE'] });
    assert.deepEqual(cogs, { DEVELOPMENT: 10_000_000, MAINTENANCE: 6_000_000, OPERATION: 750_000, INFRASTRUCTURE: 3_200_000 });
  });
  it('omits categories the estimate does not include and zero-cost lines', () => {
    const cogs = buildCategoryCogs({ billing, operationalTotal: 0, categories: ['DEVELOPMENT', 'MAINTENANCE'] });
    assert.deepEqual(Object.keys(cogs), ['DEVELOPMENT', 'MAINTENANCE']);
  });

  it('price from margin and back are consistent (margin on price)', () => {
    assert.equal(priceFromMargin(7_000_000, 30), 10_000_000);
    assert.equal(marginFromPrice(7_000_000, 10_000_000), 30);
    assert.equal(priceFromMargin(5, 100), 50000); // margin clamps to 99.99%, never divides by zero
    assert.equal(priceFromMargin(5, -10), 5); // negative margin clamps to 0%
    assert.equal(marginFromPrice(5, 0), 0);
  });

  it('totals: sum of base prices, one discount on the total, one PPN on the net', () => {
    const lines: CategoryPricing = {
      DEVELOPMENT: { cogs: 7_000_000, margin_percent: 30, base_price: 10_000_000 },
      MAINTENANCE: { cogs: 3_000_000, margin_percent: 40, base_price: 5_000_000 },
    };
    const t = computeTotals(lines, { discountType: 'PERCENTAGE', discountValue: 10, taxEnabled: true });
    assert.equal(t.cogs, 10_000_000);
    assert.equal(t.base_price, 15_000_000);
    assert.equal(t.discount, 1_500_000);
    assert.equal(t.subtotal, 13_500_000);
    assert.equal(t.tax, 1_485_000);
    assert.equal(t.grand_total, 14_985_000);
    assert.equal(t.margin_percent, Number(((15_000_000 - 10_000_000) / 15_000_000 * 100).toFixed(2)));
  });
  it('nominal discount is capped at the base price; tax can be off', () => {
    const lines: CategoryPricing = { DEVELOPMENT: { cogs: 1, margin_percent: 0, base_price: 1000 } };
    const t = computeTotals(lines, { discountType: 'NOMINAL', discountValue: 5000, taxEnabled: false });
    assert.equal(t.discount, 1000);
    assert.equal(t.grand_total, 0);
  });

  it('editing the grand total rescales every category price proportionally and keeps the sum exact', () => {
    const lines: CategoryPricing = {
      DEVELOPMENT: { cogs: 7_000_000, margin_percent: 30, base_price: 10_000_000 },
      MAINTENANCE: { cogs: 3_000_000, margin_percent: 40, base_price: 5_000_000 },
    };
    const opts = { discountType: 'PERCENTAGE' as const, discountValue: 10, taxEnabled: true };
    const out = distributeGrandTotal(lines, 20_000_000, opts) as Required<Pick<CategoryPricing, 'DEVELOPMENT' | 'MAINTENANCE'>>;
    const t = computeTotals(out, opts);
    assert.ok(Math.abs(t.grand_total - 20_000_000) <= 2, `got ${t.grand_total}`);
    const sum = out.DEVELOPMENT.base_price + out.MAINTENANCE.base_price;
    assert.equal(sum, t.base_price);
    assert.ok(out.DEVELOPMENT.base_price > out.MAINTENANCE.base_price);
    assert.equal(out.DEVELOPMENT.margin_percent, marginFromPrice(7_000_000, out.DEVELOPMENT.base_price));
  });
  it('grand total edit with all-zero prices puts the whole amount on the first category', () => {
    const lines: CategoryPricing = {
      DEVELOPMENT: { cogs: 100, margin_percent: 0, base_price: 0 },
      MAINTENANCE: { cogs: 100, margin_percent: 0, base_price: 0 },
    };
    const out = distributeGrandTotal(lines, 1_110_000, { discountType: 'PERCENTAGE', discountValue: 0, taxEnabled: true }) as Required<Pick<CategoryPricing, 'DEVELOPMENT' | 'MAINTENANCE'>>;
    assert.equal(out.DEVELOPMENT.base_price + out.MAINTENANCE.base_price, 1_000_000);
  });

  it('parse rejects bad shapes, unknown categories, negatives and oversized input', () => {
    assert.equal(parseCategoryPricing(null).ok, false);
    assert.equal(parseCategoryPricing([]).ok, false);
    assert.equal(parseCategoryPricing({}).ok, false);
    assert.equal(parseCategoryPricing({ HACK: { cogs: 1, margin_percent: 1, base_price: 1 } }).ok, false);
    assert.equal(parseCategoryPricing({ DEVELOPMENT: { cogs: -1, margin_percent: 1, base_price: 1 } }).ok, false);
    assert.equal(parseCategoryPricing({ DEVELOPMENT: { cogs: 1, margin_percent: 150, base_price: 1 } }).ok, false);
    assert.equal(parseCategoryPricing({ DEVELOPMENT: { cogs: 1, margin_percent: 1, base_price: 'x' } }).ok, false);
    assert.equal(parseCategoryPricing({ DEVELOPMENT: { cogs: 1, margin_percent: 1, base_price: 1e12 } }).ok, false);
    const ok = parseCategoryPricing({ DEVELOPMENT: { cogs: 1, margin_percent: 10, base_price: 2 }, MAINTENANCE: { cogs: 0, margin_percent: 0, base_price: 0 } });
    assert.equal(ok.ok, true);
  });

  it('public price lines hide cogs and margin and keep category order', () => {
    const lines: CategoryPricing = {
      MAINTENANCE: { cogs: 3_000_000, margin_percent: 40, base_price: 5_000_000 },
      DEVELOPMENT: { cogs: 7_000_000, margin_percent: 30, base_price: 10_000_000 },
    };
    const pub = publicPriceLines(lines);
    assert.deepEqual(pub.map((l) => l.category), ['DEVELOPMENT', 'MAINTENANCE']);
    assert.deepEqual(Object.keys(pub[0]).sort(), ['category', 'label', 'price']);
    assert.equal(pub[0].label, 'Development');
    assert.equal(JSON.stringify(pub).includes('cogs'), false);
    assert.equal(JSON.stringify(pub).includes('margin'), false);
  });


  it('server recomputes independent percentage and nominal fees from category pricing', () => {
    const result = resolveCommercialPricing({
      category_pricing: {
        DEVELOPMENT: { cogs: 50, margin_percent: 50, base_price: 100, marketing_fee_type: 'PERCENTAGE', marketing_fee_value: 10 },
        MAINTENANCE: { cogs: 50, margin_percent: 50, base_price: 100, marketing_fee_type: 'NOMINAL', marketing_fee_value: 25 },
      },
      discount_type: 'PERCENTAGE', discount_value: 0, is_tax_enabled: false,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.totals.marketing_fee, 35);
    assert.equal(result.totals.subtotal, 235);
    assert.deepEqual(publicPriceLines(result.pricing).map(x => x.price), [110, 125]);
    assert.deepEqual(publicPriceLines(result.pricing, true).map(x => x.price), [100, 100]);
    assert.deepEqual(publicMarketingFeeLines(result.pricing, true).map(x => x.amount), [10, 25]);
    assert.deepEqual(publicMarketingFeeLines(result.pricing), []);
  });

  it('rejects invalid category fee values', () => {
    assert.equal(parseCategoryPricing({ DEVELOPMENT: { cogs: 1, margin_percent: 1, base_price: 2, marketing_fee_type: 'PERCENTAGE', marketing_fee_value: 100.01 } }).ok, false);
    assert.equal(parseCategoryPricing({ DEVELOPMENT: { cogs: 1, margin_percent: 1, base_price: 2, marketing_fee_type: 'NOMINAL', marketing_fee_value: -1 } }).ok, false);
  });

  it('calculates independent percentage and nominal marketing fees per category', () => {
    const lines: CategoryPricing = {
      DEVELOPMENT: { cogs: 50, margin_percent: 50, base_price: 100, marketing_fee_type: 'PERCENTAGE', marketing_fee_value: 10 },
      MAINTENANCE: { cogs: 50, margin_percent: 50, base_price: 100, marketing_fee_type: 'NOMINAL', marketing_fee_value: 25 },
    };
    const totals = computeTotals(lines, { discountType: 'PERCENTAGE', discountValue: 0, taxEnabled: false });
    assert.equal(totals.marketing_fee, 35);
    assert.equal(totals.subtotal, 235);
    assert.deepEqual(publicPriceLines(lines).map(x => x.price), [110, 125]);
  });

  it('grand-total edit preserves distinct category marketing fees', () => {
    const lines: CategoryPricing = {
      DEVELOPMENT: { cogs: 50, margin_percent: 50, base_price: 100, marketing_fee_type: 'PERCENTAGE', marketing_fee_value: 10 },
      MAINTENANCE: { cogs: 50, margin_percent: 50, base_price: 100, marketing_fee_type: 'NOMINAL', marketing_fee_value: 25 },
    };
    const opts = { discountType: 'PERCENTAGE' as const, discountValue: 0, taxEnabled: true };
    const adjusted = distributeGrandTotal(lines, 261, opts);
    const totals = computeTotals(adjusted, opts);
    assert.equal(totals.grand_total, 261);
    assert.equal(totals.marketing_fee, 35);
    assert.equal(adjusted.DEVELOPMENT?.marketing_fee_value, 10);
    assert.equal(adjusted.MAINTENANCE?.marketing_fee_value, 25);
  });
});