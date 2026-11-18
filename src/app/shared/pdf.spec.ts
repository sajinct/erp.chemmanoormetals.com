import { Customer, Project, Quote, QuoteItem, Settings } from '../core/models';
import { bankLines, pdfBlob, quoteDocument } from './pdf';

const settings = {
  company_name: 'Chemmanoor Metals',
  address: 'Perakam P.O, Thrissur',
  phone: '+91 97470 70066',
  email: '',
  gstin: '',
  bank_name: 'Test Bank, Chavakkad',
  bank_account_name: 'Chemmanoor Metals',
  bank_account_no: '1234567890',
  bank_ifsc: 'TEST0001234',
  upi_id: '',
} as Settings;

const customer = { name: 'Anu', phone: '919000000001', address: 'Guruvayur', gstin: null } as Customer;
const project = { ref_no: 'CM-2026-0001', site_address: 'East Nada' } as Project;
const quote = {
  quote_no: 'Q-2026-0001',
  created_at: '2026-11-16T10:00:00Z',
  valid_until: '2026-12-01',
  subtotal: 43200,
  discount: 1200,
  gst_percent: 18,
  gst_amount: 7560,
  total: 49560,
  terms: '50% advance.',
} as Quote;
const items: QuoteItem[] = [
  { product_id: null, description: 'Aluminium shutter, Front shop', qty: 96, unit: 'sqft', rate: 450, amount: 43200, sort: 0 },
];

describe('quote PDF', () => {
  it('lists only the bank details that are filled in', () => {
    expect(bankLines(settings)).toEqual([
      'Account name: Chemmanoor Metals',
      'Bank: Test Bank, Chavakkad',
      'Account no: 1234567890',
      'IFSC: TEST0001234',
    ]);
  });

  it('puts the quote number, lines and total in the document', () => {
    const text = JSON.stringify(quoteDocument(settings, project, customer, quote, items));
    for (const expected of ['Q-2026-0001', 'CM-2026-0001', 'Aluminium shutter, Front shop', '49,560.00', '- 1,200.00', 'IFSC: TEST0001234']) {
      expect(text).toContain(expected);
    }
  });

  it('renders to a real PDF file', async () => {
    const blob = await pdfBlob(quoteDocument(settings, project, customer, quote, items));
    const head = new TextDecoder().decode((await blob.arrayBuffer()).slice(0, 5));
    expect(head).toBe('%PDF-');
    expect(blob.size).toBeGreaterThan(5000);
  }, 30000);
});
