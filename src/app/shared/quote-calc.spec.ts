import { areaSqft, billingQty, quoteTotals, round2 } from './quote-calc';

describe('quote-calc', () => {
  it('rounds to two decimals', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(10.004)).toBe(10);
  });

  it('computes area in square feet from any unit', () => {
    expect(areaSqft(10, 8, 'ft')).toBe(80);
    expect(areaSqft(120, 96, 'in')).toBe(80);
    expect(areaSqft(304.8, 243.84, 'cm')).toBe(80);
    expect(areaSqft(3048, 2438.4, 'mm')).toBe(80);
  });

  it('picks the billing quantity by product unit', () => {
    const item = { width: 10, height: 8, qty: 2 };
    expect(billingQty(item, 'ft', 'sqft')).toBe(160);
    expect(billingQty(item, 'ft', 'rft')).toBe(20);
    expect(billingQty(item, 'ft', 'nos')).toBe(2);
  });

  it('totals with discount before GST', () => {
    const t = quoteTotals(
      [
        { qty: 80, rate: 450 },
        { qty: 1, rate: 12000 },
      ],
      3000,
      18,
    );
    expect(t.subtotal).toBe(48000);
    expect(t.taxable).toBe(45000);
    expect(t.gst_amount).toBe(8100);
    expect(t.total).toBe(53100);
  });

  it('never lets the discount exceed the subtotal', () => {
    const t = quoteTotals([{ qty: 1, rate: 100 }], 500, 18);
    expect(t.discount).toBe(100);
    expect(t.total).toBe(0);
  });
});
