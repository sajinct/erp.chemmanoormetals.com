import { Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { INTERESTS, Lead, Profile, SEGMENTS, SOURCES } from '../../core/models';
import { Supabase } from '../../core/supabase';
import { normalizePhone } from '../../shared/messaging';
import { UI } from '../../shared/ui';

/** Add or edit a lead. Closes with true when something was saved. */
@Component({
  selector: 'app-lead-form-dialog',
  imports: [UI],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit lead' : 'New lead' }}</h2>
    <mat-dialog-content class="form-grid">
      <mat-form-field>
        <mat-label>Name</mat-label>
        <input matInput [(ngModel)]="form.name" required />
      </mat-form-field>
      <mat-form-field>
        <mat-label>Phone / WhatsApp</mat-label>
        <input matInput type="tel" [(ngModel)]="form.phone" required />
      </mat-form-field>
      <mat-form-field>
        <mat-label>Email</mat-label>
        <input matInput type="email" [(ngModel)]="form.email" />
      </mat-form-field>
      <mat-form-field>
        <mat-label>Location</mat-label>
        <input matInput [(ngModel)]="form.location" />
      </mat-form-field>
      <mat-form-field>
        <mat-label>Source</mat-label>
        <mat-select [(ngModel)]="form.source">
          @for (o of sources; track o.value) {
            <mat-option [value]="o.value">{{ o.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      @if (form.source === 'referral') {
        <mat-form-field>
          <mat-label>Referred by</mat-label>
          <input matInput [(ngModel)]="form.referred_by" />
        </mat-form-field>
      }
      <mat-form-field>
        <mat-label>Segment</mat-label>
        <mat-select [(ngModel)]="form.segment">
          @for (o of segments; track o.value) {
            <mat-option [value]="o.value">{{ o.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field>
        <mat-label>Interested in</mat-label>
        <mat-select [(ngModel)]="form.interest">
          @for (o of interests; track o.value) {
            <mat-option [value]="o.value">{{ o.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field>
        <mat-label>Assigned to</mat-label>
        <mat-select [(ngModel)]="form.assigned_to">
          <mat-option [value]="null">Nobody</mat-option>
          @for (p of staff(); track p.id) {
            <mat-option [value]="p.id">{{ p.full_name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field>
        <mat-label>Next follow-up</mat-label>
        <input matInput type="date" [(ngModel)]="form.next_follow_up" />
      </mat-form-field>
      <mat-form-field class="wide">
        <mat-label>Notes</mat-label>
        <textarea matInput rows="3" [(ngModel)]="form.notes"></textarea>
      </mat-form-field>
      @if (error()) {
        <p class="error-text wide">{{ error() }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button (click)="save()" [disabled]="busy()">Save</button>
    </mat-dialog-actions>
  `,
})
export class LeadFormDialog {
  private readonly sb = inject(Supabase);
  private readonly ref = inject(MatDialogRef<LeadFormDialog, boolean>);
  protected readonly data = inject<Lead | null>(MAT_DIALOG_DATA);

  protected readonly sources = SOURCES;
  protected readonly segments = SEGMENTS;
  protected readonly interests = INTERESTS;
  protected readonly staff = signal<Profile[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected form = {
    name: this.data?.name ?? '',
    phone: this.data?.phone ?? '',
    email: this.data?.email ?? '',
    location: this.data?.location ?? '',
    source: this.data?.source ?? 'social_media',
    referred_by: this.data?.referred_by ?? '',
    segment: this.data?.segment ?? 'residential',
    interest: this.data?.interest ?? 'shutter',
    assigned_to: this.data?.assigned_to ?? null,
    next_follow_up: this.data?.next_follow_up ?? '',
    notes: this.data?.notes ?? '',
  };

  constructor() {
    void this.sb
      .run<Profile[]>(this.sb.client.from('profiles').select('*').eq('active', true).order('full_name'))
      .then((rows) => this.staff.set(rows));
  }

  protected async save(): Promise<void> {
    const phone = normalizePhone(this.form.phone);
    if (!this.form.name.trim() || phone.length < 10) {
      this.error.set('Name and a valid phone number are required.');
      return;
    }
    this.busy.set(true);
    const row = {
      ...this.form,
      name: this.form.name.trim(),
      phone,
      email: this.form.email || null,
      location: this.form.location || null,
      referred_by: this.form.source === 'referral' ? this.form.referred_by || null : null,
      next_follow_up: this.form.next_follow_up || null,
      notes: this.form.notes || null,
    };
    try {
      const leads = this.sb.client.from('leads');
      await this.sb.run(this.data ? leads.update(row).eq('id', this.data.id) : leads.insert(row));
      this.ref.close(true);
    } catch {
      this.busy.set(false);
    }
  }
}
