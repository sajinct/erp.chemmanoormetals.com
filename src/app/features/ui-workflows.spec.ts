import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { Auth } from '../core/auth';
import { Supabase } from '../core/supabase';
import { today } from '../shared/messaging';
import { Dashboard } from './dashboard/dashboard';
import { LeadsList } from './leads/leads-list';
import { ProjectsList } from './projects/projects-list';
import { CustomersList } from './customers/customers-list';

const lead = (id: number, extra = {}) => ({
  id: String(id),
  ref_no: `L-${id}`,
  name: `Enquiry ${id}`,
  phone: '919876543210',
  location: 'Thrissur',
  status: 'new',
  source: 'website',
  segment: 'residential',
  interest: 'shutter',
  next_follow_up: today(),
  ...extra,
});

describe('ERP work overview and record lists', () => {
  let data: Record<string, unknown[]>;
  let all: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    data = { leads: [], projects: [], project_balances: [], customers: [] };
    all = vi.fn(async (build: () => { table: string }) => data[build().table] || []);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: Dashboard },
          { path: 'leads', component: LeadsList },
          { path: 'projects', component: ProjectsList },
          { path: 'customers', component: CustomersList },
        ]),
        {
          provide: Auth,
          useValue: { profile: signal({ full_name: 'Demo User' }), can: () => false },
        },
        {
          provide: Supabase,
          useValue: {
            all,
            client: {
              from: (table: string) => ({
                table,
                select() {
                  return this;
                },
                order() {
                  return this;
                },
              }),
            },
          },
        },
      ],
    });
  });

  it('shows due open leads, confirmed balances and stage-specific navigation', async () => {
    data['leads'] = [
      lead(1),
      lead(2, { status: 'confirmed' }),
      lead(3, { status: 'lost' }),
      lead(4, { next_follow_up: '2999-01-01' }),
    ];
    data['projects'] = [
      { id: 'p1', ref_no: 'P-001', status: 'confirmed', customers: { name: 'Demo customer' } },
      { id: 'p2', status: 'quoted' },
    ];
    data['project_balances'] = [
      { project_id: 'p1', quote_total: 1000, paid: 250, balance: 750 },
      { project_id: 'p2', quote_total: 9000, paid: 0, balance: 9000 },
    ];
    const harness = await RouterTestingHarness.create('/');
    await harness.fixture.whenStable();
    const el = harness.routeNativeElement!;
    expect(el.querySelector('#followup-title')?.textContent).toContain('1');
    expect(el.querySelector('.collection-total')?.textContent).toContain('750.00');
    expect(el.querySelector('a.stage[href="/leads?status=quoted"]')).toBeTruthy();
    expect(el.textContent).toContain('Enquiry 1');
    expect(el.textContent).not.toContain('Enquiry 2');
  });

  it('shows a recoverable load error instead of an all-caught-up message', async () => {
    all.mockRejectedValueOnce(new Error('Offline'));
    const harness = await RouterTestingHarness.create('/');
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')).toBeTruthy();
    expect(harness.routeNativeElement!.textContent).not.toContain('You’re all caught up');
    const retry = harness.routeNativeElement!.querySelector<HTMLButtonElement>('.feedback button')!;
    retry.click();
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')).toBeNull();
    expect(harness.routeNativeElement!.textContent).toContain('You’re all caught up');
  });

  it('honours dashboard follow-up filters and updates filters on the same route', async () => {
    data['leads'] = [
      lead(1),
      lead(2, { status: 'lost' }),
      lead(3, { status: 'quoted', next_follow_up: null }),
    ];
    const harness = await RouterTestingHarness.create('/leads?followUp=due');
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(harness.routeNativeElement!.textContent).toContain('Enquiry 1');
    await harness.navigateByUrl('/leads?status=quoted');
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.textContent).toContain('Enquiry 3');
    expect(harness.routeNativeElement!.textContent).not.toContain('Enquiry 1');
  });

  it('paginates long lists and resets the page when the search changes', async () => {
    data['leads'] = Array.from({ length: 26 }, (_, i) => lead(i + 1));
    const harness = await RouterTestingHarness.create('/leads');
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.querySelectorAll('tbody tr')).toHaveLength(25);
    harness
      .routeNativeElement!.querySelector<HTMLButtonElement>('[aria-label="Next page"]')!
      .click();
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(harness.routeNativeElement!.textContent).toContain('Enquiry 26');
    await harness.navigateByUrl('/leads?search=Enquiry%201');
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.textContent).toContain('Page 1 of 1');
    expect(harness.routeNativeElement!.querySelectorAll('tbody tr')).toHaveLength(11);
  });

  it('filters active projects without including cancelled work', async () => {
    data['projects'] = [
      { id: 'p1', ref_no: 'P-active', status: 'confirmed' },
      { id: 'p2', ref_no: 'P-cancelled', status: 'cancelled' },
    ];
    const harness = await RouterTestingHarness.create('/projects?active=1');
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.textContent).toContain('P-active');
    expect(harness.routeNativeElement!.textContent).not.toContain('P-cancelled');
  });

  it('searches customers by email and exposes a keyboard-accessible record link', async () => {
    data['customers'] = [
      { id: 'c1', name: 'Demo customer', phone: '919876543210', email: 'demo@example.com' },
      { id: 'c2', name: 'Other customer', phone: '911234567890' },
    ];
    const harness = await RouterTestingHarness.create('/customers');
    await harness.fixture.whenStable();
    const input = harness.routeNativeElement!.querySelector<HTMLInputElement>('input')!;
    input.value = 'demo@example.com';
    input.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(
      harness.routeNativeElement!.querySelector('a[href="/customers/c1"]')?.textContent,
    ).toContain('Demo customer');
  });
});
