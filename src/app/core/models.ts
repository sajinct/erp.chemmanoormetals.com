import type { QuoteCosting } from '../shared/quote-costing';
import type { QuoteProposal } from '../shared/proposal';

export type Role = 'admin' | 'approver' | 'sales' | 'measurement' | 'accounts';

export interface Option {
  value: string;
  label: string;
}

const opts = (pairs: Record<string, string>): Option[] =>
  Object.entries(pairs).map(([value, label]) => ({ value, label }));

export const ROLES = opts({
  admin: 'Admin',
  approver: 'Approver',
  sales: 'Sales',
  measurement: 'Measurement',
  accounts: 'Accounts',
});
export const SOURCES = opts({
  social_media: 'Social media',
  google_sheet: 'Google Sheet',
  referral: 'Referral',
  website: 'Website',
  walk_in: 'Walk-in',
  other: 'Other',
});
export const SEGMENTS = opts({
  residential: 'Residential',
  commercial: 'Commercial',
  industrial: 'Industrial',
});
export const INTERESTS = opts({
  shutter: 'Automatic shutter',
  gate: 'Gate automation',
  pergola: 'Moving pergola roof',
  perforated: 'Perforated shutter',
  service: 'Service & maintenance',
  material: 'Material sales',
  other: 'Other',
});
export const LEAD_STATUSES = opts({
  new: 'New',
  contacted: 'Contacted',
  measurement_scheduled: 'Measurement',
  quoted: 'Quoted',
  confirmed: 'Confirmed',
  lost: 'Lost',
});
export const PROJECT_STATUSES = opts({
  measurement: 'Measurement',
  quoted: 'Quoted',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
});
export const CATEGORIES = opts({
  shutter: 'Shutter',
  gate: 'Gate',
  pergola: 'Pergola',
  perforated: 'Perforated',
  accessory: 'Accessory',
  service: 'Service',
});
export const UNITS = opts({ sqft: 'Sq ft', rft: 'Running ft', nos: 'Nos', lot: 'Lot' });
export const MEASURE_UNITS = opts({ ft: 'Feet', in: 'Inches', cm: 'cm', mm: 'mm', m: 'Metres' });
export const OPERATIONS = ['Side motor', 'Centre motor', 'Tubular motor', 'Gear', 'Manual'];
export const PAYMENT_KINDS = opts({
  advance: 'Advance',
  part: 'Part payment',
  final: 'Final payment',
});
export const PAYMENT_MODES = opts({
  bank: 'Bank transfer',
  upi: 'UPI',
  cash: 'Cash',
  cheque: 'Cheque',
});
export const QUOTE_STATUSES = opts({
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
});
export const MEASUREMENT_STATUSES = opts({
  draft: 'Draft',
  submitted: 'Submitted',
  final: 'Final',
});

export const labelOf = (list: Option[], value: string | null | undefined): string =>
  list.find((o) => o.value === value)?.label ?? value ?? '';

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  active: boolean;
}

export interface Lead {
  id: string;
  ref_no: string;
  name: string;
  phone: string;
  email: string | null;
  location: string | null;
  source: string;
  referred_by: string | null;
  segment: string;
  interest: string;
  status: string;
  assigned_to: string | null;
  next_follow_up: string | null;
  notes: string | null;
  created_at: string;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  type: string;
  text: string;
  created_at: string;
  profiles?: { full_name: string } | null;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  gstin: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  ref_no: string;
  customer_id: string;
  lead_id: string | null;
  segment: string;
  interest: string;
  site_address: string | null;
  map_url: string | null;
  status: string;
  customer_confirmed_at: string | null;
  created_at: string;
  customers?: Customer;
}

export interface Product {
  id: string;
  category: string;
  name: string;
  unit: string;
  rate: number;
  gst_percent: number;
  active: boolean;
}

export interface Measurement {
  id: string;
  project_id: string;
  revision_no: number;
  unit: string;
  measured_on: string;
  status: 'draft' | 'submitted' | 'final';
  approved_at: string | null;
  notes: string | null;
  measurement_items?: MeasurementItem[];
  measurer?: { full_name: string } | null;
  approver?: { full_name: string } | null;
}

export interface MeasurementItem {
  id?: string;
  measurement_id?: string;
  product_id: string | null;
  position: string | null;
  width: number;
  height: number;
  qty: number;
  operation: string | null;
  material: string | null;
  finish: string | null;
  remarks: string | null;
  sort: number;
}

export interface Quote {
  costing_revision?: number;
  costing?: QuoteCosting | null;
  proposal?: QuoteProposal | null;
  id: string;
  quote_no: string;
  project_id: string;
  measurement_id: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  subtotal: number;
  discount: number;
  gst_percent: number;
  gst_amount: number;
  total: number;
  terms: string | null;
  valid_until: string | null;
  pdf_path: string | null;
  /** Random code in the short link sent to the customer. */
  share_code: string | null;
  /** Time-limited storage link the short link forwards to. */
  share_url: string | null;
  share_expires_at: string | null;
  created_at: string;
  quote_items?: QuoteItem[];
}

export interface QuoteItem {
  id?: string;
  quote_id?: string;
  product_id: string | null;
  description: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
  sort: number;
}

export interface Payment {
  id: string;
  project_id: string;
  kind: string;
  amount: number;
  mode: string;
  reference: string | null;
  received_on: string;
  confirmation_sent_at: string | null;
  notes: string | null;
}

export interface Balance {
  project_id: string;
  quote_total: number;
  paid: number;
  balance: number;
}

export interface Settings {
  id: number;
  company_name: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_no: string;
  bank_ifsc: string;
  upi_id: string;
  quote_terms: string;
  quote_validity_days: number;
  msg_measurement: string;
  msg_quote: string;
  msg_receipt: string;
}
