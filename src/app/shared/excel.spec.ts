import {
  LEAD_COLUMNS,
  PRODUCT_COLUMNS,
  checkLeadRows,
  checkProductRows,
  createXlsx,
  parseCsv,
  readFile,
  tableToRows,
} from './excel';

describe('excel import', () => {
  it('writes and reads a real lead XLSX with the installed ExcelJS module', async () => {
    const bytes = await createXlsx(LEAD_COLUMNS, [
      {
        name: 'Anu, K',
        phone: '919747070066',
        email: 'anu@example.test',
        source: 'Social media',
        segment: 'Commercial',
        interest: 'Gate automation',
        notes: 'Line 1\nകേരളം',
      },
    ]);
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x50, 0x4b]);
    const rows = await readFile({
      name: 'leads.xlsx',
      arrayBuffer: async () => bytes.buffer,
    } as File);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: 'Anu, K',
      phone: '919747070066',
      notes: 'Line 1\nകേരളം',
    });
    const checked = checkLeadRows(rows, []);
    expect(checked[0].errors).toEqual([]);
    expect(checked[0].value).toMatchObject({
      source: 'social_media',
      segment: 'commercial',
      interest: 'gate',
    });
  });
  it('writes a usable empty template and preserves numeric product rates on round-trip', async () => {
    const empty = await createXlsx(LEAD_COLUMNS, []);
    expect(
      await readFile({ name: 'template.xlsx', arrayBuffer: async () => empty.buffer } as File),
    ).toEqual([]);
    const bytes = await createXlsx(PRODUCT_COLUMNS, [
      {
        category: 'Shutter',
        name: 'Sample shutter',
        unit: 'Sq ft',
        rate: 1250.75,
        gst_percent: 18,
      },
    ]);
    const rows = checkProductRows(
      await readFile({ name: 'rates.xlsx', arrayBuffer: async () => bytes.buffer } as File),
    );
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].value).toMatchObject({ rate: 1250.75, gst_percent: 18, unit: 'sqft' });
  });
  it('parses CSV with quotes, commas and line breaks in fields', () => {
    expect(parseCsv('Name,Notes\r\n"Anu, K","said ""ok""\nline 2"\n')).toEqual([
      ['Name', 'Notes'],
      ['Anu, K', 'said "ok"\nline 2'],
    ]);
  });

  it('keys rows by normalised header and drops blank lines', () => {
    expect(
      tableToRows([
        ['Name', 'Referred By', 'GST %'],
        ['Anu', 'Lijo', '18'],
        ['', '', ''],
      ]),
    ).toEqual([{ name: 'Anu', referredby: 'Lijo', gst: '18' }]);
  });

  it('validates lead rows and flags duplicates', () => {
    const rows = tableToRows([
      ['Name', 'Mobile', 'Source', 'Segment', 'Interest', 'Referred By'],
      ['Anu', '97470 70066', 'Social Media', 'Commercial', 'Gate automation', ''],
      ['', '9000000001', '', '', '', ''],
      ['Biju', '12345', '', '', '', ''],
      ['Anu again', '+91 9747070066', '', '', '', ''],
      ['Old', '9000000002', '', '', '', ''],
      ['Ravi', '9000000003', '', '', '', 'Lijo'],
    ]);
    const checked = checkLeadRows(rows, ['919000000002']);

    expect(checked[0].errors).toEqual([]);
    expect(checked[0].line).toBe(2);
    expect(checked[0].value).toMatchObject({
      phone: '919747070066',
      source: 'social_media',
      segment: 'commercial',
      interest: 'gate',
    });
    expect(checked[1].errors).toEqual(['Name is missing']);
    expect(checked[2].errors).toEqual(['Phone number is missing or too short']);
    expect(checked[3].errors).toEqual(['Duplicate phone number']);
    expect(checked[4].errors).toEqual(['Duplicate phone number']);
    expect(checked[5].value).toMatchObject({ source: 'referral', referred_by: 'Lijo' });
  });

  it('validates product rows', () => {
    const rows = tableToRows([
      ['Category', 'Name', 'Unit', 'Rate', 'GST %'],
      ['Shutter', 'Aluminium shutter', 'Sq ft', '1,250', '18%'],
      ['Gate', 'Sliding motor', 'Nos', 'abc', ''],
      ['Shutter', 'aluminium shutter', 'sqft', '10', ''],
    ]);
    const checked = checkProductRows(rows);
    expect(checked[0].errors).toEqual([]);
    expect(checked[0].value).toEqual({
      category: 'shutter',
      name: 'Aluminium shutter',
      unit: 'sqft',
      rate: 1250,
      gst_percent: 18,
    });
    expect(checked[1].errors).toEqual(['Rate is not a valid number']);
    expect(checked[2].errors).toEqual(['Name repeats an earlier row']);
  });
});
