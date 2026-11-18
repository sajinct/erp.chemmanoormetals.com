import { CATEGORIES, INTERESTS, Option, SEGMENTS, SOURCES, UNITS } from '../core/models';
import { normalizePhone } from './messaging';

export type Row = Record<string, string>;

/** "Referred By" -> "referredby", so headers match however they are typed. */
const keyOf = (header: string): string => header.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Minimal CSV reader: quoted fields, doubled quotes and line breaks inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** First line is the header; blank lines are dropped. */
export function tableToRows(table: string[][]): Row[] {
  const [header, ...body] = table;
  if (!header) return [];
  const keys = header.map((h) => keyOf(String(h ?? '')));
  return body
    .filter((line) => line.some((cell) => String(cell ?? '').trim() !== ''))
    .map((line) => {
      const row: Row = {};
      keys.forEach((k, i) => {
        if (k) row[k] = String(line[i] ?? '').trim();
      });
      return row;
    });
}

/** Reads the first sheet of an .xlsx file, or a .csv file. */
export async function readFile(file: File): Promise<Row[]> {
  if (file.name.toLowerCase().endsWith('.csv')) {
    return tableToRows(parseCsv(await file.text()));
  }
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  const table: string[][] = [];
  sheet?.eachRow({ includeEmpty: false }, (r) => {
    const line: string[] = [];
    for (let c = 1; c <= sheet.columnCount; c++) line.push(r.getCell(c).text ?? '');
    table.push(line);
  });
  return tableToRows(table);
}

export interface Column {
  header: string;
  key: string;
  width?: number;
}

export async function exportXlsx(
  filename: string,
  columns: Column[],
  rows: Record<string, unknown>[],
): Promise<void> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }));
  sheet.getRow(1).font = { bold: true };
  rows.forEach((r) => sheet.addRow(r));
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    filename,
  );
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Matches "Social Media", "social_media" or the label, else the fallback. */
function pick(list: Option[], raw: string | undefined, fallback: string): string {
  const wanted = keyOf(raw ?? '');
  if (!wanted) return fallback;
  const hit = list.find((o) => keyOf(o.value) === wanted || keyOf(o.label) === wanted);
  return hit?.value ?? fallback;
}

const first = (row: Row, ...keys: string[]): string => {
  for (const k of keys) if (row[k]) return row[k];
  return '';
};

export interface ImportedLead {
  name: string;
  phone: string;
  email: string | null;
  location: string | null;
  source: string;
  referred_by: string | null;
  segment: string;
  interest: string;
  notes: string | null;
}

export interface Checked<T> {
  line: number;
  value: T;
  errors: string[];
}

export const LEAD_COLUMNS: Column[] = [
  { header: 'Name', key: 'name', width: 24 },
  { header: 'Phone', key: 'phone' },
  { header: 'Email', key: 'email', width: 26 },
  { header: 'Location', key: 'location', width: 24 },
  { header: 'Source', key: 'source' },
  { header: 'Referred By', key: 'referred_by' },
  { header: 'Segment', key: 'segment' },
  { header: 'Interest', key: 'interest' },
  { header: 'Notes', key: 'notes', width: 40 },
];

/**
 * Validates lead rows from a sheet. A row is rejected when the name or phone is
 * missing, or when the phone repeats an existing lead or an earlier row.
 */
export function checkLeadRows(rows: Row[], existingPhones: Iterable<string>): Checked<ImportedLead>[] {
  const seen = new Set(existingPhones);
  return rows.map((row, i) => {
    const errors: string[] = [];
    const name = first(row, 'name', 'customername', 'fullname', 'customer');
    const phone = normalizePhone(first(row, 'phone', 'mobile', 'phonenumber', 'mobilenumber', 'contact', 'whatsapp'));
    if (!name) errors.push('Name is missing');
    if (phone.length < 10) errors.push('Phone number is missing or too short');
    else if (seen.has(phone)) errors.push('Duplicate phone number');
    else seen.add(phone);
    const referred = first(row, 'referredby', 'referral', 'reference');
    return {
      line: i + 2,
      errors,
      value: {
        name,
        phone,
        email: first(row, 'email', 'emailaddress') || null,
        location: first(row, 'location', 'place', 'address', 'projectlocation') || null,
        source: pick(SOURCES, row['source'], referred ? 'referral' : 'google_sheet'),
        referred_by: referred || null,
        segment: pick(SEGMENTS, first(row, 'segment', 'type'), 'residential'),
        interest: pick(INTERESTS, first(row, 'interest', 'product', 'interestedin'), 'shutter'),
        notes: first(row, 'notes', 'remarks', 'projectdetails', 'details') || null,
      },
    };
  });
}

export interface ImportedProduct {
  category: string;
  name: string;
  unit: string;
  rate: number;
  gst_percent: number;
}

export const PRODUCT_COLUMNS: Column[] = [
  { header: 'Category', key: 'category' },
  { header: 'Name', key: 'name', width: 40 },
  { header: 'Unit', key: 'unit' },
  { header: 'Rate', key: 'rate' },
  { header: 'GST %', key: 'gst_percent' },
];

export function checkProductRows(rows: Row[]): Checked<ImportedProduct>[] {
  const seen = new Set<string>();
  return rows.map((row, i) => {
    const errors: string[] = [];
    const name = first(row, 'name', 'product', 'item', 'description');
    const rate = Number(first(row, 'rate', 'price').replace(/,/g, ''));
    const gstRaw = first(row, 'gst', 'gstpercent', 'tax');
    const gst = gstRaw === '' ? 18 : Number(gstRaw.replace('%', ''));
    if (!name) errors.push('Name is missing');
    else if (seen.has(name.toLowerCase())) errors.push('Name repeats an earlier row');
    else seen.add(name.toLowerCase());
    if (!Number.isFinite(rate) || rate < 0) errors.push('Rate is not a valid number');
    if (!Number.isFinite(gst) || gst < 0) errors.push('GST % is not a valid number');
    return {
      line: i + 2,
      errors,
      value: {
        category: pick(CATEGORIES, row['category'], 'shutter'),
        name,
        unit: pick(UNITS, row['unit'], 'sqft'),
        rate: Number.isFinite(rate) ? rate : 0,
        gst_percent: Number.isFinite(gst) ? gst : 18,
      },
    };
  });
}
