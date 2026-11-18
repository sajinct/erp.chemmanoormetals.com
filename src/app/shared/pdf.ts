import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { Customer, Project, Quote, QuoteItem, Settings, UNITS, labelOf } from '../core/models';
import { money } from './messaging';

/** Bank details block, shared by the quote PDF and the WhatsApp message. */
export function bankLines(s: Settings): string[] {
  return [
    s.bank_account_name && `Account name: ${s.bank_account_name}`,
    s.bank_name && `Bank: ${s.bank_name}`,
    s.bank_account_no && `Account no: ${s.bank_account_no}`,
    s.bank_ifsc && `IFSC: ${s.bank_ifsc}`,
    s.upi_id && `UPI: ${s.upi_id}`,
  ].filter((line): line is string => !!line);
}

export function quoteDocument(
  s: Settings,
  project: Project,
  customer: Customer,
  quote: Quote,
  items: QuoteItem[],
): TDocumentDefinitions {
  const right = { alignment: 'right' as const };
  const taxable = quote.subtotal - quote.discount;
  const bank = bankLines(s);

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 50],
    defaultStyle: { fontSize: 10 },
    footer: (page: number, pages: number) => ({
      text: `${s.company_name}  |  ${quote.quote_no}  |  Page ${page} of ${pages}`,
      alignment: 'center',
      fontSize: 8,
      color: '#666666',
      margin: [0, 16, 0, 0],
    }),
    content: [
      {
        columns: [
          [
            { text: s.company_name, fontSize: 18, bold: true },
            { text: s.address, color: '#444444' },
            { text: [s.phone, s.email].filter(Boolean).join('  |  '), color: '#444444' },
            s.gstin ? { text: `GSTIN: ${s.gstin}`, color: '#444444' } : '',
          ],
          {
            width: 'auto',
            stack: [
              { text: 'QUOTATION', fontSize: 14, bold: true, ...right },
              { text: quote.quote_no, ...right },
              { text: `Date: ${quote.created_at.slice(0, 10)}`, ...right },
              quote.valid_until ? { text: `Valid until: ${quote.valid_until}`, ...right } : '',
              { text: `Project ref: ${project.ref_no}`, ...right },
            ],
          },
        ],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 8, x2: 515, y2: 8, lineWidth: 1, lineColor: '#999999' }] },
      {
        margin: [0, 12, 0, 12],
        stack: [
          { text: 'To', bold: true },
          { text: customer.name },
          { text: project.site_address || customer.address || '' },
          { text: `Phone: +${customer.phone}` },
          customer.gstin ? { text: `GSTIN: ${customer.gstin}` } : '',
        ],
      },
      {
        table: {
          headerRows: 1,
          widths: [20, '*', 50, 40, 60, 70],
          body: [
            ['#', 'Description', { text: 'Qty', ...right }, 'Unit', { text: 'Rate', ...right }, { text: 'Amount', ...right }].map(
              (cell) => (typeof cell === 'string' ? { text: cell, bold: true } : { ...cell, bold: true }),
            ),
            ...items.map((item, i) => [
              String(i + 1),
              item.description,
              { text: String(item.qty), ...right },
              labelOf(UNITS, item.unit),
              { text: money(item.rate), ...right },
              { text: money(item.amount), ...right },
            ]),
          ],
        },
        layout: 'lightHorizontalLines',
      },
      {
        margin: [0, 10, 0, 0],
        columns: [
          { text: '' },
          {
            width: 220,
            table: {
              widths: ['*', 90],
              body: [
                ['Subtotal', { text: money(quote.subtotal), ...right }],
                ...(quote.discount > 0 ? [['Discount', { text: '- ' + money(quote.discount), ...right }]] : []),
                ['Taxable value', { text: money(taxable), ...right }],
                [`GST ${quote.gst_percent}%`, { text: money(quote.gst_amount), ...right }],
                [
                  { text: 'Total (Rs.)', bold: true, fontSize: 12 },
                  { text: money(quote.total), bold: true, fontSize: 12, ...right },
                ],
              ],
            },
            layout: 'noBorders',
          },
        ],
      },
      bank.length
        ? { margin: [0, 16, 0, 0], stack: [{ text: 'Bank details', bold: true }, ...bank.map((text) => ({ text }))] }
        : '',
      quote.terms
        ? {
            margin: [0, 16, 0, 0],
            stack: [{ text: 'Terms and conditions', bold: true }, { text: quote.terms, color: '#333333' }],
          }
        : '',
      { text: `For ${s.company_name}`, margin: [0, 40, 0, 0], ...right },
    ],
  };
}

/** Renders a document definition to a PDF blob. pdfmake is loaded on first use. */
export async function pdfBlob(doc: TDocumentDefinitions): Promise<Blob> {
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  const maker = pdfMake as unknown as {
    addVirtualFileSystem?: (vfs: unknown) => void;
    vfs?: unknown;
    createPdf: (d: TDocumentDefinitions) => { getBlob: (cb?: (b: Blob) => void) => unknown };
  };
  if (maker.addVirtualFileSystem) maker.addVirtualFileSystem(fonts);
  else maker.vfs = fonts;

  // pdfmake 0.3 returns a promise; 0.2 takes a callback. Support both.
  return new Promise<Blob>((resolve, reject) => {
    try {
      const result = maker.createPdf(doc).getBlob(resolve);
      if (result instanceof Promise) result.then(resolve, reject);
    } catch (e) {
      reject(e);
    }
  });
}
