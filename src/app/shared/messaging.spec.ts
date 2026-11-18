import {
  addDays,
  fillTemplate,
  mailLink,
  money,
  normalizePhone,
  quoteShareLink,
  shareCode,
  waLink,
} from './messaging';

describe('messaging', () => {
  it('normalises Indian phone numbers', () => {
    expect(normalizePhone('97470 70066')).toBe('919747070066');
    expect(normalizePhone('+91 97470-70066')).toBe('919747070066');
    expect(normalizePhone('09747070066')).toBe('919747070066');
    expect(normalizePhone('+971 50 123 4567')).toBe('971501234567');
    expect(normalizePhone(null)).toBe('');
  });

  it('builds a WhatsApp link with encoded text', () => {
    expect(waLink('9747070066', 'Hi & welcome\nLine 2')).toBe(
      'https://wa.me/919747070066?text=Hi%20%26%20welcome%0ALine%202',
    );
  });

  it('builds a mailto link', () => {
    expect(mailLink('a@b.com', 'Quote Q-1', 'Total: 100')).toBe(
      'mailto:a%40b.com?subject=Quote%20Q-1&body=Total%3A%20100',
    );
  });

  it('fills placeholders and leaves unknown ones', () => {
    expect(fillTemplate('Dear {name}, ref {ref} {other}', { name: 'Anu', ref: 'CM-1' })).toBe(
      'Dear Anu, ref CM-1 {other}',
    );
  });

  it('formats money with Indian grouping', () => {
    expect(money(125000)).toBe('1,25,000.00');
    expect(money(null)).toBe('0.00');
  });

  it('makes unambiguous, different share codes', () => {
    const codes = new Set(Array.from({ length: 200 }, () => shareCode()));
    expect(codes.size).toBe(200);
    for (const code of codes) expect(code).toMatch(/^[A-HJ-NP-Za-km-z2-9]{10}$/);
  });

  it('builds the short quote link', () => {
    expect(quoteShareLink('https://erp.chemmanoormetals.com/', 'Ab3xK9pQw2')).toBe(
      'https://erp.chemmanoormetals.com/?q=Ab3xK9pQw2',
    );
  });

  it('adds days across a month end', () => {
    expect(addDays('2026-11-20', 15)).toBe('2026-12-05');
  });
});
