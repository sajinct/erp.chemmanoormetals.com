import { Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { PAYMENT_KINDS, PAYMENT_MODES } from '../../core/models';
import { Supabase } from '../../core/supabase';
import { today } from '../../shared/messaging';
import { UI } from '../../shared/ui';

export interface PaymentDialogData {
  projectId: string;
  /** True when no advance has been recorded yet, so "Advance" is preselected. */
  firstPayment: boolean;
  balance: number;
}

/** Record money received against a project. Closes with true when saved. */
@Component({
  selector: 'app-payment-dialog',
  imports: [UI],
  template: `
    <h2 mat-dialog-title>Record payment</h2>
    <mat-dialog-content class="form-grid">
      <mat-form-field>
        <mat-label>Type</mat-label>
        <mat-select [(ngModel)]="form.kind">
          @for (o of kinds; track o.value) {
            <mat-option [value]="o.value">{{ o.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field>
        <mat-label>Amount (Rs.)</mat-label>
        <input matInput type="number" min="0" step="0.01" [(ngModel)]="form.amount" required />
        @if (data.balance > 0) {
          <mat-hint>Balance due: {{ data.balance | inr }}</mat-hint>
        }
      </mat-form-field>
      <mat-form-field>
        <mat-label>Received by</mat-label>
        <mat-select [(ngModel)]="form.mode">
          @for (o of modes; track o.value) {
            <mat-option [value]="o.value">{{ o.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field>
        <mat-label>Date received</mat-label>
        <input matInput type="date" [(ngModel)]="form.received_on" required />
      </mat-form-field>
      <mat-form-field class="wide">
        <mat-label>Reference (UTR, cheque no, receipt no)</mat-label>
        <input matInput [(ngModel)]="form.reference" />
      </mat-form-field>
      <mat-form-field class="wide">
        <mat-label>Notes</mat-label>
        <input matInput [(ngModel)]="form.notes" />
      </mat-form-field>
      @if (error()) {
        <p class="error-text wide">{{ error() }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button (click)="save()" [disabled]="busy()">Save payment</button>
    </mat-dialog-actions>
  `,
})
export class PaymentDialog {
  private readonly sb = inject(Supabase);
  private readonly ref = inject(MatDialogRef<PaymentDialog, boolean>);
  protected readonly data = inject<PaymentDialogData>(MAT_DIALOG_DATA);

  protected readonly kinds = PAYMENT_KINDS;
  protected readonly modes = PAYMENT_MODES;
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected form = {
    kind: this.data.firstPayment ? 'advance' : 'part',
    amount: null as number | null,
    mode: 'bank',
    received_on: today(),
    reference: '',
    notes: '',
  };

  protected async save(): Promise<void> {
    const amount = Number(this.form.amount);
    if (!(amount > 0) || !this.form.received_on) {
      this.error.set('Enter the amount received and the date.');
      return;
    }
    this.busy.set(true);
    try {
      await this.sb.run(
        this.sb.client.from('payments').insert({
          project_id: this.data.projectId,
          kind: this.form.kind,
          amount,
          mode: this.form.mode,
          received_on: this.form.received_on,
          reference: this.form.reference || null,
          notes: this.form.notes || null,
        }),
      );
      this.ref.close(true);
    } catch {
      this.busy.set(false);
    }
  }
}
