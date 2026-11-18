import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSelectHarness } from '@angular/material/select/testing';
import { vi } from 'vitest';
import { AdminUsers } from '../../core/admin-users';
import { Auth, roleGuard } from '../../core/auth';
import { Profile, Role } from '../../core/models';
import { Supabase } from '../../core/supabase';
import { UsersPage } from './users';

@Component({ template: 'Workspace home' })
class Home {}

describe('Admin users screen', () => {
  let users: Profile[];
  let profile: ReturnType<typeof signal<Profile>>;
  let all: ReturnType<typeof vi.fn>;
  let create: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    users = [
      {
        id: 'admin',
        full_name: 'Demo Admin',
        email: 'admin@example.com',
        phone: null,
        role: 'admin',
        active: true,
      },
      {
        id: 'sales',
        full_name: 'Demo Sales',
        email: 'sales@example.com',
        phone: '9000000000',
        role: 'sales',
        active: true,
      },
      {
        id: 'pending',
        full_name: 'Pending Staff',
        email: 'pending@example.com',
        phone: null,
        role: 'measurement',
        active: false,
      },
    ];
    profile = signal(users[0]);
    all = vi.fn(async () => [...users]);
    create = vi.fn(async (details) => {
      const user = { id: 'new-user', ...details };
      delete user.password;
      users.push(user);
      return user;
    });
    update = vi.fn(async (id, details) => ({ ...users.find((u) => u.id === id), ...details }));
    const auth = {
      profile,
      init: async () => {},
      can: (...roles: Role[]) => profile().active && roles.includes(profile().role),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'users', component: UsersPage, canActivate: [roleGuard('admin')] },
          { path: '', component: Home },
        ]),
        { provide: Auth, useValue: auth },
        { provide: AdminUsers, useValue: { create, update } },
        {
          provide: Supabase,
          useValue: {
            all,
            info: vi.fn(),
            client: {
              from: () => ({
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

  it('lists staff, filters inactive accounts and searches by email', async () => {
    const harness = await RouterTestingHarness.create('/users');
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.querySelectorAll('tbody tr')).toHaveLength(3);
    harness
      .routeNativeElement!.querySelectorAll<HTMLButtonElement>('.user-summary button')[2]
      .click();
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(harness.routeNativeElement!.textContent).toContain('Pending Staff');
    const input = harness.routeNativeElement!.querySelector<HTMLInputElement>('input')!;
    input.value = 'pending@example.com';
    input.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.querySelector('tbody')?.textContent).toContain(
      'pending@example.com',
    );
  });

  it('creates a staff account with the selected role without changing the admin session', async () => {
    const harness = await RouterTestingHarness.create('/users');
    await harness.fixture.whenStable();
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('.page-head button')!.click();
    await harness.fixture.whenStable();
    const container = document.querySelector('mat-dialog-container')!;
    for (const [name, value] of Object.entries({
      name: 'New Accounts',
      email: 'new@example.com',
      password: 'InitialPassword7!',
    })) {
      const input = container.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    await harness.fixture.whenStable();
    const loader = TestbedHarnessEnvironment.documentRootLoader(harness.fixture);
    const role = await loader.getHarness(
      MatSelectHarness.with({ selector: 'mat-select[name="role"]' }),
    );
    await role.open();
    await role.clickOptions({ text: 'Accounts' });
    container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await harness.fixture.whenStable();
    expect(create).toHaveBeenCalledWith({
      full_name: 'New Accounts',
      email: 'new@example.com',
      phone: null,
      password: 'InitialPassword7!',
      role: 'accounts',
      active: true,
    });
    expect(profile().id).toBe('admin');
    await vi.waitFor(() => expect(document.querySelector('mat-dialog-container')).toBeNull());
  });

  it('keeps the form open with an actionable error when creation fails', async () => {
    create.mockRejectedValueOnce(new Error('A user with this email already exists.'));
    const harness = await RouterTestingHarness.create('/users');
    await harness.fixture.whenStable();
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('.page-head button')!.click();
    await harness.fixture.whenStable();
    const container = document.querySelector('mat-dialog-container')!;
    for (const [name, value] of Object.entries({
      name: 'Existing Staff',
      email: 'sales@example.com',
      password: 'InitialPassword7!',
    })) {
      const input = container.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    await harness.fixture.whenStable();
    container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await harness.fixture.whenStable();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('already exists');
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(
      false,
    );
  });

  it('protects your own role and status in the edit form', async () => {
    const harness = await RouterTestingHarness.create('/users');
    await harness.fixture.whenStable();
    harness
      .routeNativeElement!.querySelector<HTMLButtonElement>('[aria-label="Edit Demo Admin"]')!
      .click();
    await harness.fixture.whenStable();
    const container = document.querySelector('mat-dialog-container')!;
    expect(container.querySelector('mat-select[name="role"]')?.getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(
      container.querySelector('mat-select[name="active"]')?.getAttribute('aria-disabled'),
    ).toBe('true');
    expect(container.querySelector('input[name="password"]')).toBeNull();
  });

  it('rejects navigation to user management for non-admin staff', async () => {
    profile.set(users[1]);
    const harness = await RouterTestingHarness.create('/users');
    expect(harness.routeNativeElement!.textContent).toContain('Workspace home');
    expect(all).not.toHaveBeenCalled();
  });
});
