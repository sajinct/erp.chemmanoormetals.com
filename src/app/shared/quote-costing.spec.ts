import { calculateCosting, costingError, newCosting } from './quote-costing';
import { workbookCosts } from './perforated-workbook';
import fixture from './perforated-workbook.fixture.json';
import { quoteTotals } from './quote-calc';
import { Measurement } from '../core/models';

function shutter(w = 3, h = 3, qty = 1) {
  return newCosting(
    { unit: 'm', measurement_items: [{ width: w, height: h, qty, sort: 0 }] } as Measurement,
    true,
  );
}
describe('cost build-up pricing', () => {
  it('matches every numeric dependency against saved Excel values', () => {
    const actual = workbookCosts({}, fixture.geometry);
    for (const [cell, value] of Object.entries(fixture.expected))
      expect(actual[cell], cell).toBeCloseTo(value, 7);
  });
  it('reconciles the workbook saved 3 × 3 m example', () => {
    const r = calculateCosting(shutter());
    expect(r.area).toBeCloseTo(96.84, 8);
    expect(r.items.map((i) => i.amount)).toEqual([
      55072.71, 23172.23, 7590.43, 1717.11, 168.3, 1956.5,
    ]);
    expect(quoteTotals(r.items, 0, 18).subtotal).toBe(89677.28);
  });
  it('reconciles the PDF dimensions with the supplied Excel rates, retaining the internal charge', () => {
    const r = calculateCosting(shutter(3.63, 2.85));
    expect(r.items.map((i) => i.amount)).toEqual([
      57654.36, 23782.7, 8719.68, 1680.05, 168.3, 2027.45,
    ]);
    expect(quoteTotals(r.items, 0, 18)).toMatchObject({
      subtotal: 94032.54,
      gst_amount: 16925.86,
      total: 110958.4,
    });
    expect(r.breakdown.find((i) => i.label.startsWith('Internal charge'))?.amount).toBeCloseTo(
      1106.41286576,
      7,
    );
  });
  it('expands every approved opening and counts quantities while keeping job-level travel shared', () => {
    const a = shutter(3, 3, 2),
      b = shutter();
    b.openings.push({ ...b.openings[0] });
    expect(calculateCosting(a)).toEqual(calculateCosting(b));
    expect(calculateCosting(a).area).toBeCloseTo(193.68, 8);
    expect(calculateCosting(a).items[1].amount).toBe(46344.46);
  });
  it('keeps each quote independent of later assumption changes', () => {
    const a = shutter(),
      b = shutter();
    a.inputs['P146'] += 1000;
    expect(calculateCosting(a).items[1].amount).toBeGreaterThan(
      calculateCosting(b).items[1].amount,
    );
    expect(b.inputs['P146']).toBe(14667.392533787235);
  });
  it('updates both inspection travel and installation transport from distance', () => {
    const c = shutter(3.63, 2.85);
    c.inputs['C14'] = 25;
    expect(quoteTotals(calculateCosting(c).items, 0, 0).total).toBe(96552.42);
  });
  it('keeps the original Excel grand total when displayed components differ by one paise', () => {
    const r = calculateCosting(shutter(2, 2));
    expect(r.items.at(-1)).toMatchObject({ description: 'Rounding adjustment', amount: -0.01 });
    expect(quoteTotals(r.items, 0, 0).total).toBe(73999.93);
  });
  it('uses cost and profit markup for other products instead of sale rates', () => {
    const c = newCosting();
    c.costs = [
      { description: 'Gate materials', cost: 1200 },
      { description: 'Labour', cost: 500 },
    ];
    expect(quoteTotals(calculateCosting(c).items, 0, 18).total).toBe(2407.2);
    c.markup = 0;
    expect(quoteTotals(calculateCosting(c).items, 0, 0).total).toBe(1700);
  });
  it('blocks missing, negative, fractional-count and non-finite inputs', () => {
    expect(costingError(newCosting())).toContain('Enter');
    const c = shutter();
    c.openings[0].qty = 1.5;
    expect(() => calculateCosting(c)).toThrow();
    c.openings[0].qty = 1;
    c.inputs['P146'] = NaN;
    expect(() => calculateCosting(c)).toThrow();
    c.inputs['P146'] = -1;
    expect(() => calculateCosting(c)).toThrow();
  });
});
