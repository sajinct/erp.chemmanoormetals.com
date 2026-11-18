import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { paginate } from './pagination';

describe('ERP table pagination', () => {
  it('keeps the last partial page reachable and prevents moving beyond it', () => {
    TestBed.configureTestingModule({});
    const records = signal(Array.from({ length: 26 }, (_, i) => i + 1));
    const pager = TestBed.runInInjectionContext(() => paginate(records));
    TestBed.tick();
    expect(pager.rows()).toHaveLength(25);
    pager.next();
    expect(pager.rows()).toEqual([26]);
    expect([pager.start(), pager.end()]).toEqual([26, 26]);
    pager.next();
    expect(pager.page()).toBe(2);
    pager.previous();
    pager.previous();
    expect(pager.page()).toBe(1);
  });

  it('returns to the first page after a filter changes and handles no matches', () => {
    TestBed.configureTestingModule({});
    const records = signal(Array.from({ length: 80 }, (_, i) => i));
    const pager = TestBed.runInInjectionContext(() => paginate(records));
    TestBed.tick();
    pager.next();
    pager.next();
    records.set([42, 43]);
    TestBed.tick();
    expect(pager.rows()).toEqual([42, 43]);
    expect(pager.page()).toBe(1);
    records.set([]);
    TestBed.tick();
    expect([pager.start(), pager.end(), pager.page(), pager.pages()]).toEqual([0, 0, 1, 1]);
    expect(pager.rows()).toEqual([]);
  });
});
