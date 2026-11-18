import { Component, inject, signal } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { CATEGORIES, UNITS } from '../../core/models';
import { Supabase } from '../../core/supabase';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-product-dialog',
  imports: [UI],
  template: `
    <h2 mat-dialog-title>Add product</h2>
    <form #form="ngForm" (ngSubmit)="form.valid && save()">
      <mat-dialog-content class="form-grid">
        <mat-form-field class="wide"
          ><mat-label>Product name</mat-label
          ><input matInput name="name" [(ngModel)]="product.name" required
        /></mat-form-field>
        <mat-form-field
          ><mat-label>Category</mat-label
          ><mat-select name="category" [(ngModel)]="product.category">
            @for (o of categories; track o.value) {
              <mat-option [value]="o.value">{{ o.label }}</mat-option>
            }
          </mat-select></mat-form-field
        >
        <mat-form-field
          ><mat-label>Unit</mat-label
          ><mat-select name="unit" [(ngModel)]="product.unit">
            @for (o of units; track o.value) {
              <mat-option [value]="o.value">{{ o.label }}</mat-option>
            }
          </mat-select></mat-form-field
        >
        <mat-form-field
          ><mat-label>Rate (₹)</mat-label
          ><input
            matInput
            type="number"
            name="rate"
            [(ngModel)]="product.rate"
            required
            min="0"
            step="0.01"
        /></mat-form-field>
        <mat-form-field
          ><mat-label>GST (%)</mat-label
          ><input
            matInput
            type="number"
            name="gst"
            [(ngModel)]="product.gst_percent"
            required
            min="0"
            max="100"
            step="0.01"
        /></mat-form-field>
        @if (failed()) {
          <p class="error-text wide" role="alert">
            The product couldn’t be saved. Check the details and try again.
          </p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end"
        ><button mat-button type="button" (click)="close()" [disabled]="busy()">Cancel</button
        ><button
          mat-flat-button
          type="submit"
          [disabled]="busy() || form.invalid || !product.name.trim()"
        >
          {{ busy() ? 'Saving…' : 'Add product' }}
        </button></mat-dialog-actions
      >
    </form>
  `,
})
export class ProductDialog {
  private readonly sb = inject(Supabase);
  private readonly ref = inject(MatDialogRef<ProductDialog>);
  protected readonly categories = CATEGORIES;
  protected readonly units = UNITS;
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly product = {
    name: '',
    category: 'shutter',
    unit: 'sqft',
    rate: 0,
    gst_percent: 18,
    active: true,
  };

  protected close(): void {
    this.ref.close();
  }
  protected async save(): Promise<void> {
    if (this.busy() || !this.product.name.trim()) return;
    this.busy.set(true);
    this.failed.set(false);
    this.ref.disableClose = true;
    try {
      await this.sb.run(
        this.sb.client.from('products').insert({ ...this.product, name: this.product.name.trim() }),
      );
      this.ref.close(this.product.name.trim());
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
      this.ref.disableClose = false;
    }
  }
}
