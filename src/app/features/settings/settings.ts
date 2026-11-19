import { Component, inject, signal } from '@angular/core';
import { Settings } from '../../core/models';
import { Supabase } from '../../core/supabase';
import { UI } from '../../shared/ui';

/** Admin only: company and bank details, quotation preferences and message wording. */
@Component({
  selector: 'app-settings',
  imports: [UI],
  template: `
    <div class="page">
      <div class="page-head">
        <div class="page-title">
          <h1>Settings</h1>
          <p>Manage your company details and quotation preferences.</p>
        </div>
      </div>

      <div class="card row">
        <div class="spacer">
          <h2>Users & roles</h2>
          <span class="sub">Create staff accounts, assign roles and manage workspace access.</span>
        </div>
        <a mat-stroked-button routerLink="/users"
          ><mat-icon>manage_accounts</mat-icon>Manage users</a
        >
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
    h2:not(:first-child) {
      margin-top: 16px;
    }
  `,
})
export class SettingsPage {
  private readonly sb = inject(Supabase);
  protected readonly s = signal<Settings | null>(null);

  constructor() {
    void this.sb.settings().then((s) => this.s.set(s));
  }

  protected async save(s: Settings): Promise<void> {
    const { id, ...fields } = s;
    await this.sb.run(
      this.sb.client
        .from('settings')
        .update({
          ...fields,
          quote_validity_days: Math.max(1, Number(s.quote_validity_days) || 3),
        })
        .eq('id', id),
    );
    this.sb.info('Settings saved');
  }
}
