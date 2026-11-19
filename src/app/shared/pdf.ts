import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { Customer, Project, Quote, QuoteItem, Settings, UNITS, labelOf } from '../core/models';
import { money } from './messaging';
import { round2 } from './quote-calc';

let logoPromise: Promise<string | undefined> | undefined;
export function proposalLogo(): Promise<string | undefined> {
  return (logoPromise ??= fetch(new URL('logo.jpg', document.baseURI))
    .then(async (response) => {
      if (!response.ok) return undefined;
      const blob = await response.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    })
    .catch(() => undefined));
}

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

function compactQuoteDocument(
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
      {
        canvas: [
          { type: 'line', x1: 0, y1: 8, x2: 515, y2: 8, lineWidth: 1, lineColor: '#999999' },
        ],
      },
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
            [
              '#',
              'Description',
              { text: 'Qty', ...right },
              'Unit',
              { text: 'Rate', ...right },
              { text: 'Amount', ...right },
            ].map((cell) =>
              typeof cell === 'string' ? { text: cell, bold: true } : { ...cell, bold: true },
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
                ...(quote.discount > 0
                  ? [['Discount', { text: '- ' + money(quote.discount), ...right }]]
                  : []),
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
        ? {
            margin: [0, 16, 0, 0],
            stack: [{ text: 'Bank details', bold: true }, ...bank.map((text) => ({ text }))],
          }
        : '',
      quote.terms
        ? {
            margin: [0, 16, 0, 0],
            stack: [
              { text: 'Terms and conditions', bold: true },
              { text: quote.terms, color: '#333333' },
            ],
          }
        : '',
      { text: `For ${s.company_name}`, margin: [0, 40, 0, 0], ...right },
    ],
  };
}

/** Customer proposal: cost assumptions and profit are deliberately excluded. */
export function quoteDocument(
  s: Settings,
  project: Project,
  customer: Customer,
  quote: Quote,
  items: QuoteItem[],
  logo?: string,
): TDocumentDefinitions {
  if (!quote.proposal) return compactQuoteDocument(s, project, customer, quote, items);
  const p = quote.proposal,
    ink = '#202b3b',
    blue = '#009fc4',
    muted = '#617086';
  const right = { alignment: 'right' as const };
  const heading = (text: string): Content => ({
    text,
    fontSize: 21,
    bold: true,
    color: ink,
    margin: [0, 0, 0, 18],
  });
  const section = (title: string, text: string): Content =>
    text.trim()
      ? {
          stack: [
            { text: title, bold: true, fontSize: 12, color: blue, margin: [0, 16, 0, 7] },
            { text, lineHeight: 1.35 },
          ],
        }
      : { text: '' };
  const details: Content = {
    stack: [
      { text: customer.name, bold: true, fontSize: 14 },
      { text: project.site_address || customer.address || '' },
      { text: 'Phone: +' + customer.phone },
      customer.email ? { text: customer.email } : { text: '' },
    ],
  };
  const letterhead: Content = logo
    ? { image: logo, width: 210, margin: [0, 0, 0, 34] }
    : { text: s.company_name, fontSize: 23, bold: true, color: ink, margin: [0, 0, 0, 34] };
  const pageHeader = (title: string): Content => ({
    stack: [
      { text: s.company_name, fontSize: 12, bold: true, color: blue, margin: [0, 0, 0, 22] },
      heading(title),
    ],
    pageBreak: 'before',
  });
  const advance = round2((quote.total * p.advance_percent) / 100);
  const openings = quote.costing?.openings ?? [];
  const bank = bankLines(s);
  const header = (text: string): Content => ({
    text,
    bold: true,
    color: '#ffffff',
    fillColor: ink,
    margin: [4, 5, 4, 5],
  });
  const costSubtotal = (end: number) =>
    money(round2(items.slice(0, end).reduce((sum, i) => sum + i.amount, 0)));
  const commercialBody: any[] = [[header('Particulars'), header('Amount (Rs.)')]];
  items.forEach((i, n) => {
    commercialBody.push([
      { text: i.description, margin: [4, 8, 4, 8] },
      { text: money(i.amount), ...right, margin: [4, 8, 4, 8] },
    ]);
    if (quote.costing?.model === 'perforated' && (n === 1 || n === 2))
      commercialBody.push([
        {
          text: n === 1 ? 'Subtotal - shutter with automation' : 'Subtotal - with powder coating',
          bold: true,
          fillColor: '#f0f5f8',
        },
        { text: costSubtotal(n + 1), bold: true, fillColor: '#f0f5f8', ...right },
      ]);
  });
  return {
    pageSize: 'A4',
    pageMargins: [42, 38, 42, 54],
    defaultStyle: { fontSize: 10, color: ink, lineHeight: 1.2 },
    footer: (page: number, pages: number) => ({
      columns: [{ text: quote.quote_no }, { text: `${page} / ${pages}`, alignment: 'right' }],
      fontSize: 8,
      color: muted,
      margin: [42, 20, 42, 0],
    }),
    content: [
      letterhead,
      {
        text: 'PROPOSAL',
        fontSize: 12,
        bold: true,
        characterSpacing: 3,
        color: blue,
        margin: [0, 28, 0, 16],
      },
      { text: p.title, fontSize: 34, bold: true, color: ink, margin: [0, 0, 0, 24] },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 80, y2: 0, lineWidth: 4, lineColor: blue }],
        margin: [0, 0, 0, 28],
      },
      details,
      {
        text: `${quote.quote_no}  |  ${quote.created_at.slice(0, 10)}`,
        fontSize: 10,
        color: muted,
        margin: [0, 18, 0, 0],
      },
      quote.valid_until
        ? { text: `Valid until ${quote.valid_until}`, color: muted, margin: [0, 4, 0, 0] }
        : '',
      { text: 'Dear Sir / Madam,', bold: true, margin: [0, 34, 0, 12] },
      { text: p.introduction, lineHeight: 1.4 },
      pageHeader('About ' + s.company_name),
      { text: p.company_profile, lineHeight: 1.5 },
      section(
        'Commercial scope',
        p.scope ||
          `Supply and installation at ${project.site_address || customer.address || 'the project site'}, as itemised in this proposal.`,
      ),
      section('Project reference', project.ref_no),
      section('Prepared for', customer.name),
      pageHeader('Commercial details'),
      {
        table: { headerRows: 1, widths: ['*', 105], body: commercialBody },
        layout: 'lightHorizontalLines',
      },
      {
        margin: [0, 16, 0, 20],
        table: {
          widths: ['*', 105],
          body: [
            ['Subtotal', { text: money(quote.subtotal), ...right }],
            ...(quote.discount > 0
              ? [['Discount', { text: '- ' + money(quote.discount), ...right }]]
              : []),
            ['Taxable value', { text: money(round2(quote.subtotal - quote.discount)), ...right }],
            [`GST ${quote.gst_percent}%`, { text: money(quote.gst_amount), ...right }],
            [
              { text: 'Total including GST', bold: true, fillColor: ink, color: '#ffffff' },
              { text: money(quote.total), bold: true, fillColor: ink, color: '#ffffff', ...right },
            ],
          ],
        },
        layout: 'lightHorizontalLines',
      },
      ...(openings.length
        ? [
            section('Approved measurements', 'Dimensions are in metres.'),
            {
              table: {
                headerRows: 1,
                widths: ['*', 65, 65, 50],
                body: [
                  ['Opening', 'Width', 'Height', 'Qty'].map(header),
                  ...openings.map((i) => [
                    i.position,
                    i.width.toFixed(3),
                    i.height.toFixed(3),
                    String(i.qty),
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            } as Content,
          ]
        : []),
      quote.costing?.model === 'perforated'
        ? {
            text: `Total shutter area: ${openings.reduce((sum, i) => sum + i.width * i.height * i.qty * 10.76, 0).toFixed(2)} sq ft`,
            color: muted,
            margin: [0, 12, 0, 0],
          }
        : '',
      pageHeader('Specifications and site requirements'),
      section('Technical specifications', p.specifications),
      section('Customer responsibilities and exclusions', p.site_requirements),
      section('Warranty and maintenance', p.warranty),
      section('Commercial terms', quote.terms || ''),
      pageHeader('Payment and delivery'),
      {
        table: {
          widths: ['*', 110],
          body: [
            [header('Payment stage'), header('Amount (Rs.)')],
            [`Advance with work order (${p.advance_percent}%)`, { text: money(advance), ...right }],
            ['Balance on installation', { text: money(round2(quote.total - advance)), ...right }],
          ],
        },
        layout: 'lightHorizontalLines',
      },
      section('Payment and delivery terms', p.payment_terms),
      section('Selected projects', p.reference_projects || ''),
      bank.length ? section('Bank details', bank.join('\n')) : '',
      { text: 'For ' + s.company_name, bold: true, margin: [0, 38, 0, 12] },
      { text: p.signatory || 'Authorised signatory', margin: [0, 12, 0, 24] },
      {
        text: [
          s.address,
          [s.phone, s.email].filter(Boolean).join(' | '),
          s.gstin ? 'GSTIN: ' + s.gstin : '',
        ]
          .filter(Boolean)
          .join('\n'),
        fontSize: 9,
        color: muted,
      },
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
