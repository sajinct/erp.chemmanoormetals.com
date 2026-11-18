import { Component, inject, signal } from '@angular/core';
import { Auth } from '../../core/auth';
import { Profile, ROLES, Settings } from '../../core/models';
import { Supabase } from '../../core/supabase';
import { UI } from '../../shared/ui';

/** Admin only: company and bank details, message wording, and who can use the ERP. */
@Component({
  selector: 'app-settings',
  imports: [UI],
  template: `
    <div class="page">
      <div class="page-head">
        <div class="page-title">
          <h1>Settings</h1>
          <p>Manage your team, company details and quotation preferences.</p>
        </div>
      </div>

      <div class="card table-wrap">
        <h2>Users</h2>
        <p class="sub">
          New staff use "Request access" on the sign-in page; activate them here and choose a role.
          Approver is the person who finalises measurements.
        </p>
        <table class="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            @for (u of users(); track u.id) {
              <tr>
                <td>{{ u.full_name }}</td>
                <td>{{ u.email }}</td>
                <td>
                  <select
                    [attr.aria-label]="'Role for ' + u.full_name"
                    [ngModel]="u.role"
                    (ngModelChange)="setUser(u, { role: $event })"
                    [disabled]="u.id === me"
                  >
                    @for (o of roles; track o.value) {
                      <option [ngValue]="o.value">{{ o.label }}</option>
                    }
                  </select>
                </td>
                <td>
                  <input
                    type="checkbox"
                    [attr.aria-label]="'Active account: ' + u.full_name"
                    class="check"
                    [ngModel]="u.active"
                    (ngModelChange)="setUser(u, { active: $event })"
                    [disabled]="u.id === me"
                  />
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (s(); as s) {
        <div class="card">
          <h2>Company (shown on quotations)</h2>
          <div class="form-grid">
            <mat-form-field
              ><mat-label>Company name</mat-label><input matInput [(ngModel)]="s.company_name"
            /></mat-form-field>
            <mat-form-field
              ><mat-label>Phone</mat-label><input matInput [(ngModel)]="s.phone"
            /></mat-form-field>
            <mat-form-field
              ><mat-label>Email</mat-label><input matInput [(ngModel)]="s.email"
            /></mat-form-field>
            <mat-form-field
              ><mat-label>GSTIN</mat-label><input matInput [(ngModel)]="s.gstin"
            /></mat-form-field>
            <mat-form-field class="wide"
              ><mat-label>Address</mat-label><input matInput [(ngModel)]="s.address"
            /></mat-form-field>
          </div>
          <h2>Bank details (for advance payments)</h2>
          <div class="form-grid">
            <mat-form-field
              ><mat-label>Account name</mat-label><input matInput [(ngModel)]="s.bank_account_name"
            /></mat-form-field>
            <mat-form-field
              ><mat-label>Bank and branch</mat-label><input matInput [(ngModel)]="s.bank_name"
            /></mat-form-field>
            <mat-form-field
              ><mat-label>Account number</mat-label><input matInput [(ngModel)]="s.bank_account_no"
            /></mat-form-field>
            <mat-form-field
              ><mat-label>IFSC</mat-label><input matInput [(ngModel)]="s.bank_ifsc"
            /></mat-form-field>
            <mat-form-field
              ><mat-label>UPI ID</mat-label><input matInput [(ngModel)]="s.upi_id"
            /></mat-form-field>
          </div>
          <h2>Quotations</h2>
          <div class="form-grid">
            <mat-form-field>
              <mat-label>Quote valid for (days)</mat-label>
              <input matInput type="number" min="1" [(ngModel)]="s.quote_validity_days" />
            </mat-form-field>
            <mat-form-field class="wide">
              <mat-label>Default terms and conditions</mat-label>
              <textarea matInput rows="5" [(ngModel)]="s.quote_terms"></textarea>
            </mat-form-field>
          </div>
          <h2>Message wording</h2>
          <p class="sub">
            Words in curly brackets are filled in automatically, for example {{ '{name}' }},
            {{ '{ref}' }}, {{ '{company}' }}.
          </p>
          <div class="form-grid">
            <mat-form-field class="wide">
              <mat-label>Measurement confirmation ({{ '{revision}, {items}' }})</mat-label>
              <textarea matInput rows="6" [(ngModel)]="s.msg_measurement"></textarea>
            </mat-form-field>
            <mat-form-field class="wide">
              <mat-label
                >Quotation ({{ '{quote_no}, {total}, {valid_until}, {link}, {bank}' }})</mat-label
              >
              <textarea matInput rows="7" [(ngModel)]="s.msg_quote"></textarea>
            </mat-form-field>
            <mat-form-field class="wide">
              <mat-label>Payment receipt ({{ '{amount}, {mode}, {date}, {balance}' }})</mat-label>
              <textarea matInput rows="5" [(ngModel)]="s.msg_receipt"></textarea>
            </mat-form-field>
          </div>
          <button mat-flat-button (click)="save(s)">Save settings</button>
        </div>
      }
    </div>
  `,
  styles: `
    .check {
      width: auto !important;
      min-width: 0 !important;
    }
    h2:not(:first-child) {
      margin-top: 16px;
    }
  `,
})
export class SettingsPage {
  private readonly sb = inject(Supabase);
  protected readonly me = inject(Auth).profile()?.id;
  protected readonly roles = ROLES;
  protected readonly s = signal<Settings | null>(null);
  protected readonly users = signal<Profile[]>([]);

  constructor() {
    void this.sb.settings().then((s) => this.s.set(s));
    void this.loadUsers();
  }

  private async loadUsers(): Promise<void> {
    this.users.set(
      await this.sb.run<Profile[]>(this.sb.client.from('profiles').select('*').order('created_at')),
    );
  }

  protected async setUser(u: Profile, patch: Partial<Profile>): Promise<void> {
    try {
      await this.sb.run(this.sb.client.from('profiles').update(patch).eq('id', u.id));
      this.sb.info(`${u.full_name} updated`);
    } finally {
      await this.loadUsers();
    }
  }

  protected async save(s: Settings): Promise<void> {
    const { id, ...fields } = s;
    await this.sb.run(
      this.sb.client
        .from('settings')
        .update({
          ...fields,
          quote_validity_days: Math.max(1, Number(s.quote_validity_days) || 15),
        })
        .eq('id', id),
    );
    this.sb.info('Settings saved');
  }
}
