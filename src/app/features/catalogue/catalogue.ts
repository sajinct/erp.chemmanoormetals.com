import { Component, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Auth } from '../../core/auth';
import { CATEGORIES, Product, UNITS, labelOf } from '../../core/models';
import { Supabase } from '../../core/supabase';
import {
  Checked,
  ImportedProduct,
  PRODUCT_COLUMNS,
  checkProductRows,
  exportXlsx,
  readFile,
} from '../../shared/excel';
import { today } from '../../shared/messaging';
import { UI } from '../../shared/ui';
import { ProductDialog } from './product-dialog';

/** Products and rates used to price quotes. Editable in place, or in bulk through Excel. */
@Component({
  selector: 'app-catalogue',
  imports: [UI],
  template: `
    <div class="page">
      <div class="page-head">
        <div class="page-title">
          <h1>Products &amp; rates</h1>
          <p>Your product catalogue and pricing, ready for every quotation.</p>
        </div>
        <button mat-stroked-button (click)="export()">
          <mat-icon>download</mat-icon> Export Excel
        </button>
        @if (canEdit) {
          <label class="import">
            <input type="file" accept=".xlsx,.csv" (change)="pick($event)" hidden #file />
            <button mat-stroked-button type="button" (click)="file.click()">
              <mat-icon>upload</mat-icon> Import Excel
            </button>
          </label>
          <button mat-flat-button (click)="add()"><mat-icon>add</mat-icon> Add product</button>
        }
      </div>
      <p class="sub">
        To change many rates at once: export, edit the Rate column in Excel, and import the file
        back. Rows are matched by product name; new names are added.
      </p>

      @if (preview().length) {
        <div class="card">
          <h2>Import preview</h2>
          <p>
            <strong>{{ validRows().length }}</strong> rows will be added or updated,
            <strong>{{ preview().length - validRows().length }}</strong> skipped.
          </p>
          <div class="table-wrap preview">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Category</th>
                  <th>Name</th>
                  <th>Unit</th>
                  <th class="num">Rate</th>
                  <th class="num">GST %</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                @for (r of preview(); track r.line) {
                  <tr>
                    <td>{{ r.line }}</td>
                    <td>{{ r.value.category | label: categories }}</td>
                    <td>{{ r.value.name }}</td>
                    <td>{{ r.value.unit | label: units }}</td>
                    <td class="num">{{ r.value.rate | inr }}</td>
                    <td class="num">{{ r.value.gst_percent }}</td>
                    <td>
                      @if (r.errors.length) {
                        <span class="error-text">{{ r.errors.join('; ') }}</span>
                      } @else {
                        {{ known().has(r.value.name.toLowerCase()) ? 'Update' : 'New' }}
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="row actions">
            <button
              mat-flat-button
              (click)="applyImport()"
              [disabled]="busy() || !validRows().length"
            >
              Import {{ validRows().length }} rows
            </button>
            <button mat-button (click)="preview.set([])">Discard</button>
          </div>
        </div>
      }

      <div class="row filters">
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>Search</mat-label>
          <mat-icon matPrefix>search</mat-icon
          ><input matInput [ngModel]="search()" (ngModelChange)="search.set($event)" />
        </mat-form-field>
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>Category</mat-label>
          <mat-select [ngModel]="category()" (ngModelChange)="category.set($event)">
            <mat-option value="">All</mat-option>
            @for (o of categories; track o.value) {
              <mat-option [value]="o.value">{{ o.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (search() || category()) {
          <button mat-button (click)="search.set(''); category.set('')">
            <mat-icon>close</mat-icon>Clear filters
          </button>
        }
      </div>

      <div class="card table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Category</th>
              <th>Name</th>
              <th>Unit</th>
              <th>Rate (Rs.)</th>
              <th>GST %</th>
              <th>In use</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (p of shown(); track p.id) {
              <tr>
                <td>
                  <select
                    [(ngModel)]="p.category"
                    [attr.aria-label]="'Category for ' + p.name"
                    [disabled]="!canEdit"
                    (change)="touch(p)"
                  >
                    @for (o of categories; track o.value) {
                      <option [ngValue]="o.value">{{ o.label }}</option>
                    }
                  </select>
                </td>
                <td class="wrap">
                  <input
                    [(ngModel)]="p.name"
                    aria-label="Product name"
                    [disabled]="!canEdit"
                    (input)="touch(p)"
                  />
                </td>
                <td>
                  <select
                    [(ngModel)]="p.unit"
                    [attr.aria-label]="'Unit for ' + p.name"
                    [disabled]="!canEdit"
                    (change)="touch(p)"
                  >
                    @for (o of units; track o.value) {
                      <option [ngValue]="o.value">{{ o.label }}</option>
                    }
                  </select>
                </td>
                <td>
                  <input
                    class="narrow"
                    type="number"
                    min="0"
                    step="0.01"
                    [attr.aria-label]="'Rate for ' + p.name"
                    [(ngModel)]="p.rate"
                    [disabled]="!canEdit"
                    (input)="touch(p)"
                  />
                </td>
                <td>
                  <input
                    class="narrow"
                    type="number"
                    min="0"
                    step="0.01"
                    [attr.aria-label]="'GST percentage for ' + p.name"
                    [(ngModel)]="p.gst_percent"
                    [disabled]="!canEdit"
                    (input)="touch(p)"
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    class="check"
                    [attr.aria-label]="'In use: ' + p.name"
                    [(ngModel)]="p.active"
                    [disabled]="!canEdit"
                    (change)="touch(p)"
                  />
                </td>
                <td>
                  @if (dirty().has(p.id)) {
                    <button mat-flat-button (click)="save(p)">Save</button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="empty">No products match.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: `
    .preview {
      max-height: 300px;
      overflow-y: auto;
    }
    .actions {
      margin-top: 12px;
    }
    .check {
      width: auto !important;
      min-width: 0 !important;
    }
  `,
})
export class Catalogue {
  private readonly sb = inject(Supabase);
  private readonly dialog = inject(MatDialog);
  protected readonly canEdit = inject(Auth).can('admin', 'approver');
  protected readonly categories = CATEGORIES;
  protected readonly units = UNITS;

  protected readonly products = signal<Product[]>([]);
  protected readonly dirty = signal(new Set<string>());
  protected readonly search = signal('');
  protected readonly category = signal('');
  protected readonly preview = signal<Checked<ImportedProduct>[]>([]);
  protected readonly busy = signal(false);

  protected readonly validRows = computed(() => this.preview().filter((r) => !r.errors.length));
  protected readonly known = computed(
    () => new Set(this.products().map((p) => p.name.toLowerCase())),
  );
  protected readonly shown = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.products().filter(
      (p) =>
        (!this.category() || p.category === this.category()) &&
        (!q || p.name.toLowerCase().includes(q)),
    );
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.products.set(
      await this.sb.run<Product[]>(
        this.sb.client.from('products').select('*').order('category').order('name'),
      ),
    );
    this.dirty.set(new Set());
  }

  protected touch(p: Product): void {
    this.dirty.update((set) => new Set(set).add(p.id));
  }

  protected async save(p: Product): Promise<void> {
    if (!p.name.trim()) {
      this.sb.error('The product needs a name.');
      return;
    }
    await this.sb.run(
      this.sb.client
        .from('products')
        .update({
          category: p.category,
          name: p.name.trim(),
          unit: p.unit,
          rate: Number(p.rate) || 0,
          gst_percent: Number(p.gst_percent) || 0,
          active: p.active,
        })
        .eq('id', p.id),
    );
    this.dirty.update((set) => {
      const next = new Set(set);
      next.delete(p.id);
      return next;
    });
    this.sb.info('Saved');
  }

  protected add(): void {
    this.dialog
      .open(ProductDialog, { maxWidth: '95vw' })
      .afterClosed()
      .subscribe((name: string | undefined) => {
        if (name) {
          this.search.set(name);
          this.category.set('');
          void this.load();
        }
      });
  }

  protected async export(): Promise<void> {
    try {
      await exportXlsx(
        `rate-list-${today()}.xlsx`,
        PRODUCT_COLUMNS,
        this.products().map((p) => ({
          ...p,
          category: labelOf(CATEGORIES, p.category),
          unit: labelOf(UNITS, p.unit),
        })),
      );
    } catch {
      this.sb.error('The Excel export could not be created. Please try again.');
    }
  }

  protected async pick(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const rows = checkProductRows(await readFile(file));
      if (!rows.length) this.sb.error('No rows found below the header row.');
      this.preview.set(rows);
    } catch {
      this.sb.error('This file could not be read. Save it as .xlsx or .csv and try again.');
    }
  }

  protected async applyImport(): Promise<void> {
    this.busy.set(true);
    try {
      await this.sb.run(
        this.sb.client.from('products').upsert(
          this.validRows().map((r) => r.value),
          { onConflict: 'name' },
        ),
      );
      this.sb.info(`${this.validRows().length} products imported`);
      this.preview.set([]);
      await this.load();
    } finally {
      this.busy.set(false);
    }
  }
}
