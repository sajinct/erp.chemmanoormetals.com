import { Component, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Auth } from '../../core/auth';
import { Profile, ROLES } from '../../core/models';
import { Supabase } from '../../core/supabase';
import { paginate } from '../../shared/pagination';
import { UI } from '../../shared/ui';
import { ResetPasswordDialog } from './reset-password-dialog';
import { ROLE_DESCRIPTIONS, UserFormDialog } from './user-form-dialog';

@Component({
  selector: 'app-users',
  imports: [UI],
  template: `
    <div class="page" [attr.aria-busy]="loading()">
      <div class="page-head">
        <div class="page-title">
          <h1>Users & roles</h1>
          <p>Manage your team and give every person the right access.</p>
        </div>
        <button mat-flat-button (click)="edit()"><mat-icon>person_add</mat-icon>Create user</button>
      </div>
      <div class="user-summary" aria-label="Staff overview">
        <button class="card" (click)="status.set('')" [class.selected]="!status()">
          <mat-icon>people_outline</mat-icon
          ><span
            >All staff<strong>{{ loading() ? '—' : users().length }}</strong></span
          >
        </button>
        <button
          class="card"
          (click)="status.set('active')"
          [class.selected]="status() === 'active'"
        >
          <mat-icon>verified_user</mat-icon
          ><span
            >Active<strong>{{ loading() ? '—' : activeCount() }}</strong></span
          >
        </button>
        <button
          class="card"
          (click)="status.set('inactive')"
          [class.selected]="status() === 'inactive'"
        >
          <mat-icon>person_off</mat-icon
          ><span
            >Inactive / awaiting access<strong>{{
              loading() ? '—' : users().length - activeCount()
            }}</strong></span
          >
        </button>
      </div>
      @if (failed()) {
        <div class="feedback" role="alert">
          <mat-icon>cloud_off</mat-icon><span>Users couldn’t be loaded. Please try again.</span
          ><button mat-stroked-button (click)="load()">Retry</button>
        </div>
      }
      <div class="row filters">
        <mat-form-field subscriptSizing="dynamic"
          ><mat-label>Search name, email or phone</mat-label><mat-icon matPrefix>search</mat-icon
          ><input matInput [ngModel]="search()" (ngModelChange)="search.set($event)"
        /></mat-form-field>
        <mat-form-field subscriptSizing="dynamic"
          ><mat-label>Role</mat-label
          ><mat-select [ngModel]="role()" (ngModelChange)="role.set($event)"
            ><mat-option value="">All roles</mat-option>
            @for (role of roles; track role.value) {
              <mat-option [value]="role.value">{{ role.label }}</mat-option>
            }
          </mat-select></mat-form-field
        >
        <mat-form-field subscriptSizing="dynamic"
          ><mat-label>Status</mat-label
          ><mat-select [ngModel]="status()" (ngModelChange)="status.set($event)"
            ><mat-option value="">All staff</mat-option
            ><mat-option value="active">Active</mat-option
            ><mat-option value="inactive">Inactive</mat-option></mat-select
          ></mat-form-field
        >
        @if (search() || role() || status()) {
          <button mat-button (click)="clear()"><mat-icon>close</mat-icon>Clear filters</button>
        }
      </div>
      <div class="card table-wrap">
        @if (loading()) {
          <div class="loading-line" role="status" aria-label="Loading users"></div>
        }
        <table class="tbl" aria-label="Workspace users">
          <thead>
            <tr>
              <th scope="col">Staff member</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              <th scope="col">Phone</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (user of pager.rows(); track user.id) {
              <tr>
                <td>
                  <div class="person">
                    <span class="staff-avatar" aria-hidden="true">{{
                      initials(user.full_name)
                    }}</span>
                    <div>
                      <strong>{{ user.full_name }}</strong>
                      @if (user.id === me) {
                        <span class="you">You</span>
                      }
                      <span class="staff-email">{{ user.email || 'No email address' }}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="chip" [class.quoted]="user.role === 'admin'">{{
                    user.role | label: roles
                  }}</span>
                </td>
                <td>
                  <span
                    class="chip"
                    [class.confirmed]="user.active"
                    [class.cancelled]="!user.active"
                    >{{ user.active ? 'Active' : 'Inactive' }}</span
                  >
                </td>
                <td>{{ user.phone || '—' }}</td>
                <td>
                  <button
                    mat-stroked-button
                    (click)="edit(user)"
                    [attr.aria-label]="'Edit ' + user.full_name"
                  >
                    <mat-icon>edit</mat-icon>Edit
                  </button>
                  @if (user.id !== me) {
                    <button
                      mat-button
                      (click)="resetPassword(user)"
                      [attr.aria-label]="'Reset password for ' + user.full_name"
                    >
                      <mat-icon>lock_reset</mat-icon>Reset password
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="empty">
                  <mat-icon>manage_accounts</mat-icon
                  ><strong>{{
                    failed()
                      ? 'Users unavailable'
                      : loading()
                        ? 'Loading your team…'
                        : 'No users to show'
                  }}</strong>
                  <p>
                    {{
                      failed()
                        ? 'Use Retry above to load your team.'
                        : 'Try a different search or clear the filters.'
                    }}
                  </p>
                </td>
              </tr>
            }
          </tbody>
        </table>
        <app-table-pager [pager]="pager" [total]="shown().length" />
      </div>
      <details class="card role-guide">
        <summary><mat-icon>admin_panel_settings</mat-icon>What can each role do?</summary>
        <div class="role-grid">
          @for (role of roles; track role.value) {
            <div>
              <strong>{{ role.label }}</strong>
              <p>{{ descriptions[role.value] }}</p>
            </div>
          }
        </div>
      </details>
      <p class="sub access-note">
        Deactivate an account to remove workspace access while keeping its project history. New
        self-registered accounts appear as inactive until an admin activates them.
      </p>
    </div>
  `,
  styles: `
    .user-summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
      margin-bottom: 24px;
    }
    .user-summary button {
      display: flex;
      align-items: center;
      gap: 16px;
      margin: 0;
      text-align: left;
      cursor: pointer;
      color: var(--brand-ink);
      font: inherit;
    }
    .user-summary button.selected {
      border-color: var(--accent-ink);
    }
    .user-summary mat-icon {
      color: var(--accent-ink);
      background: var(--accent-soft);
      box-sizing: content-box;
      padding: 12px;
      border-radius: 10px;
    }
    .user-summary span {
      font-size: 11px;
      color: var(--text-muted);
    }
    .user-summary strong {
      display: block;
      color: var(--brand-ink);
      font-size: 25px;
      font-weight: 800;
    }
    .person {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .staff-avatar {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--blue-soft);
      color: var(--blue-ink);
      font-weight: 800;
      font-size: 11px;
      flex-shrink: 0;
    }
    .staff-email {
      display: block;
      color: var(--text-muted);
      font-size: 11px;
      margin-top: 3px;
    }
    .you {
      color: var(--text-muted);
      font-size: 10px;
      margin-left: 8px;
    }
    .role-guide summary {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      font-weight: 700;
      font-size: 13px;
    }
    .role-guide summary mat-icon {
      color: var(--text-muted);
    }
    .role-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 22px;
      margin-top: 22px;
      padding-top: 20px;
      border-top: 1px solid var(--brand-line);
    }
    .role-grid strong {
      font-size: 12px;
    }
    .role-grid p,
    .access-note {
      color: var(--text-muted);
      font-size: 11px;
      margin: 6px 0 0;
    }
    @media (max-width: 700px) {
      .user-summary {
        gap: 8px;
      }
      .user-summary button {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        padding: 14px;
      }
      .user-summary mat-icon {
        padding: 8px;
      }
      .user-summary span {
        font-size: 10px;
      }
    }
  `,
})
export class UsersPage {
  private readonly sb = inject(Supabase);
  private readonly auth = inject(Auth);
  private readonly dialog = inject(MatDialog);
  protected readonly me = this.auth.profile()?.id;
  protected readonly roles = ROLES;
  protected readonly descriptions: Record<string, string> = ROLE_DESCRIPTIONS;
  protected readonly users = signal<Profile[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly search = signal('');
  protected readonly role = signal('');
  protected readonly status = signal('');
  protected readonly activeCount = computed(
    () => this.users().filter((user) => user.active).length,
  );
  protected readonly shown = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.users().filter(
      (user) =>
        (!query ||
          `${user.full_name} ${user.email || ''} ${user.phone || ''}`
            .toLowerCase()
            .includes(query)) &&
        (!this.role() || user.role === this.role()) &&
        (!this.status() || user.active === (this.status() === 'active')),
    );
  });
  protected readonly pager = paginate(this.shown);
  constructor() {
    void this.load();
  }
  protected initials(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }
  protected clear(): void {
    this.search.set('');
    this.role.set('');
    this.status.set('');
  }
  protected async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      this.users.set(
        await this.sb.all<Profile>(() =>
          this.sb.client.from('profiles').select('*').order('full_name').order('id'),
        ),
      );
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }
  protected resetPassword(user: Profile): void {
    this.dialog
      .open(ResetPasswordDialog, { data: user, maxWidth: '95vw' })
      .afterClosed()
      .subscribe((done: boolean | undefined) => {
        if (done)
          this.sb.info(`Password reset for ${user.full_name}. Share the new password securely.`);
      });
  }
  protected edit(user: Profile | null = null): void {
    this.dialog
      .open(UserFormDialog, { data: user, maxWidth: '95vw' })
      .afterClosed()
      .subscribe((saved: Profile | undefined) => {
        if (!saved) return;
        if (saved.id === this.me) this.auth.profile.set(saved);
        this.sb.info(user ? 'User updated' : 'User created. Share the initial password securely.');
        void this.load();
      });
  }
}
