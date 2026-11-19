import type { Measurement, QuoteItem } from '../core/models';
import { PERFORATED_INPUTS, workbookCosts } from './perforated-workbook';
import { round2 } from './quote-calc';

export { PERFORATED_INPUTS };
export interface CostOpening {
  position: string;
  width: number;
  height: number;
  qty: number;
}
export interface ManualCost {
  description: string;
  cost: number;
}
export interface QuoteCosting {
  version: 1;
  model: 'perforated' | 'manual';
  openings: CostOpening[];
  inputs: Record<string, number>;
  costs: ManualCost[];
  markup: number;
}
export interface CostResult {
  items: QuoteItem[];
  breakdown: { label: string; amount: number }[];
  area: number;
}

export function newCosting(measurement?: Measurement, perforated = false): QuoteCosting {
  const metres = (value: number) =>
    Number(value) *
    ({ m: 1, cm: 0.01, mm: 0.001, ft: 0.3048, in: 0.0254 }[measurement?.unit || 'ft'] ?? NaN);
  return {
    version: 1,
    model: perforated ? 'perforated' : 'manual',
    openings: (measurement?.measurement_items ?? [])
      .slice()
      .sort((a, b) => a.sort - b.sort)
      .map((i) => ({
        position: i.position || 'Opening',
        width: metres(i.width),
        height: metres(i.height),
        qty: Number(i.qty),
      })),
    inputs: Object.fromEntries(PERFORATED_INPUTS.map((p) => [p.key, p.value])),
    costs: [
      'Materials',
      'Production labour',
      'Installation labour',
      'Transport and site expenses',
      'Office and overheads',
    ].map((description) => ({ description, cost: 0 })),
    markup: 20,
  };
}

function nonnegative(n: number): boolean {
  return Number.isFinite(n) && n >= 0;
}
export function costingError(c: QuoteCosting): string {
  if (c.version !== 1) return 'This costing version is not supported.';
  if (c.model === 'manual') {
    if (c.costs.some((i) => !Number.isFinite(round2(i.cost * (1 + c.markup / 100)))))
      return 'The calculated amounts are too large. Review the costs and markup.';
    if (
      !nonnegative(c.markup) ||
      !c.costs.length ||
      c.costs.some((i) => !i.description.trim() || !nonnegative(i.cost))
    )
      return 'Enter a description and a non-negative amount for each cost, and a valid markup.';
    if (!c.costs.some((i) => i.cost > 0))
      return 'Enter the material, labour and other costs before saving or issuing.';
  } else if (c.model === 'perforated') {
    if (
      !c.openings.length ||
      c.openings.some(
        (i) =>
          !Number.isFinite(i.width) ||
          i.width <= 0.07 ||
          !Number.isFinite(i.height) ||
          i.height <= 0.3 ||
          !Number.isInteger(i.qty) ||
          i.qty < 1,
      )
    )
      return 'Perforated shutters need approved openings wider than 0.07 m, higher than 0.3 m and a positive whole quantity.';
    if (PERFORATED_INPUTS.some((p) => !nonnegative(c.inputs[p.key])))
      return 'Enter a valid non-negative value for every cost assumption.';
    if (c.inputs['J24'] > c.inputs['J26']) return 'The daily cost must include the stated bonus.';
  } else return 'Choose a costing model.';
  return '';
}

const line = (description: string, amount: number, sort: number): QuoteItem => ({
  product_id: null,
  description,
  qty: 1,
  unit: 'lot',
  rate: round2(amount),
  amount: round2(amount),
  sort,
});

export function calculateCosting(c: QuoteCosting): CostResult {
  const error = costingError(c);
  if (error) throw new Error(error);
  if (c.model === 'manual') {
    return {
      area: 0,
      items: c.costs
        .filter((i) => i.cost > 0)
        .map((i, n) => line(i.description, i.cost * (1 + c.markup / 100), n)),
      breakdown: [
        { label: 'Total input cost', amount: c.costs.reduce((s, i) => s + i.cost, 0) },
        {
          label: 'Profit markup',
          amount: (c.costs.reduce((s, i) => s + i.cost, 0) * c.markup) / 100,
        },
      ],
    };
  }
  const g: Record<string, number> = Object.fromEntries(
    ['B14', 'C96', 'D96', 'E96', 'F96', 'G96', 'H96', 'I96', 'J96', 'K96'].map((k) => [k, 0]),
  );
  for (const i of c.openings) {
    const w = i.width,
      h = i.height,
      n = i.qty,
      slats = (h - 0.3) / 0.076 + 2.6;
    g['B14'] += n;
    g['C96'] += w * n;
    g['D96'] += h * n;
    g['E96'] += (w - 0.03) * n;
    g['F96'] += (h - 0.3) * n;
    g['G96'] += slats * n;
    g['H96'] += (w - 0.03) * slats * n;
    g['I96'] += (w - 0.07) * n;
    g['J96'] += w * h * 10.76 * n;
    g['K96'] += ((w - 0.6) / 0.8 + 1.8) * n;
  }
  const v = workbookCosts(c.inputs, g);
  const components: [string, string][] = [
    ['I137', 'Perforated Aluzinc shutter, guide channels and bottom plates'],
    ['I147', 'Automatic shutter motor, shaft and brackets'],
    ['I152', 'Premium powder coating'],
    ['I158', 'Nylon strips and fitting'],
    ['I163', 'End caps, rivets and name plates'],
    ['I166', 'Rubber seals for bottom and side tracks'],
  ];
  if (components.some(([key]) => !nonnegative(v[key])))
    throw new Error('The costing produced an invalid amount. Review the assumptions.');
  const items = components.map(([key, label], i) => line(label, v[key], i));
  // Excel totals unrounded components. Keep its final total while exposing any
  // paise difference rather than changing a component's displayed amount.
  const rounding = round2(round2(v['I65']) - round2(items.reduce((sum, i) => sum + i.amount, 0)));
  if (rounding) items.push(line('Rounding adjustment', rounding, items.length));
  return {
    area: g['J96'],
    items,
    breakdown: [
      ['I116', 'Materials and site inspection'],
      ['I121', 'Office and incentives'],
      ['I124', 'Production'],
      ['I131', 'Installation, overtime and travel'],
      ['I132', 'Input handling tax cost'],
      ['I134', 'Profit markup'],
      ['I136', 'Internal charge (60% × 2%)'],
    ].map(([key, label]) => ({ label, amount: v[key] })),
  };
}
