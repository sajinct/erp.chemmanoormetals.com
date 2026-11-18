export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const PER_FOOT: Record<string, number> = { ft: 1, in: 12, cm: 30.48, mm: 304.8 };

/** Converts a length in the measurement's unit to feet. */
export function toFeet(value: number, unit: string): number {
  return (Number(value) || 0) / (PER_FOOT[unit] ?? 1);
}

export function areaSqft(width: number, height: number, unit: string): number {
  return round2(toFeet(width, unit) * toFeet(height, unit));
}

/**
 * Billing quantity for a measured opening: area for products priced per sq ft,
 * width for products priced per running foot, otherwise the piece count.
 */
export function billingQty(
  item: { width: number; height: number; qty: number },
  measureUnit: string,
  productUnit: string,
): number {
  const count = Number(item.qty) || 0;
  if (productUnit === 'sqft') {
    return round2(toFeet(item.width, measureUnit) * toFeet(item.height, measureUnit) * count);
  }
  if (productUnit === 'rft') return round2(toFeet(item.width, measureUnit) * count);
  return count;
}

export interface Totals {
  subtotal: number;
  discount: number;
  taxable: number;
  gst_amount: number;
  total: number;
}

/** Discount is a flat amount taken off before GST; it cannot exceed the subtotal. */
export function quoteTotals(
  items: { qty: number; rate: number }[],
  discount: number,
  gstPercent: number,
): Totals {
  const subtotal = round2(
    items.reduce((sum, i) => sum + round2((Number(i.qty) || 0) * (Number(i.rate) || 0)), 0),
  );
  const applied = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const taxable = round2(subtotal - applied);
  const gst_amount = round2((taxable * (Number(gstPercent) || 0)) / 100);
  return { subtotal, discount: applied, taxable, gst_amount, total: round2(taxable + gst_amount) };
}
