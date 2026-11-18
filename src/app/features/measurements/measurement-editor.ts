import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Auth } from '../../core/auth';
import {
  MEASUREMENT_STATUSES,
  MEASURE_UNITS,
  Measurement,
  MeasurementItem,
  OPERATIONS,
  Product,
  Project,
} from '../../core/models';
import { Supabase } from '../../core/supabase';
import { Attachments } from '../../shared/attachments';
import { areaSqft } from '../../shared/quote-calc';
import { UI } from '../../shared/ui';

/** One measurement revision: the openings measured at site, and its approval. */
@Component({
  selector: 'app-measurement-editor',
  imports: [UI, Attachments],
  template: `
    @if (m(); as m) {
      <div class="page">
        <div class="page-head">
          <h1>
            <a [routerLink]="['/projects', projectId]">{{ project()?.ref_no }}</a>
            · Measurement R{{ m.revision_no }}
            <span class="chip {{ m.status }}">{{ m.status | label: statuses }}</span>
          </h1>
          @if (editable()) {
            <button mat-stroked-button (click)="save()" [disabled]="busy()">Save</button>
            @if (m.status === 'draft') {
              <button mat-stroked-button (click)="save('submitted')" [disabled]="busy()">
                Save and submit for approval
              </button>
            }
            @if (canApprove) {
              <button mat-flat-button (click)="save('final')" [disabled]="busy()">
                <mat-icon>verified</mat-icon> Approve as final
              </button>
            }
          } @else if (m.status === 'final' && canApprove) {
            <button mat-stroked-button (click)="reopen()" [disabled]="busy()">Reopen for changes</button>
          }
        </div>

        @if (m.status === 'final') {
          <p class="sub">
            This revision is final and locked. To change it, the approver can reopen it.
          </p>
        } @else if (!canApprove && canEdit) {
          <p class="sub">Only the approver can mark a revision as final.</p>
        }

        <div class="card">
          <div class="form-grid">
            <mat-form-field>
              <mat-label>Measured on</mat-label>
              <input matInput type="date" [(ngModel)]="m.measured_on" [disabled]="!editable()" />
            </mat-form-field>
            <mat-form-field>
              <mat-label>Sizes are in</mat-label>
              <mat-select [(ngModel)]="m.unit" [disabled]="!editable()">
                @for (o of units; track o.value) {
                  <mat-option [value]="o.value">{{ o.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field class="wide">
              <mat-label>Site notes</mat-label>
              <textarea matInput rows="2" [(ngModel)]="m.notes" [disabled]="!editable()"></textarea>
            </mat-form-field>
          </div>
        </div>

        <div class="card">
          <h2>Openings</h2>
          <div class="table-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Position</th>
                  <th>Product</th>
                  <th>Width</th>
                  <th>Height</th>
                  <th>Qty</th>
                  <th class="num">Sq ft</th>
                  <th>Operation</th>
                  <th>Material</th>
                  <th>Finish / colour</th>
                  <th>Remarks</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (i of items(); track $index) {
                  <tr>
                    <td>{{ $index + 1 }}</td>
                    <td><input [(ngModel)]="i.position" [disabled]="!editable()" placeholder="Front shop" /></td>
                    <td>
                      <select [(ngModel)]="i.product_id" [disabled]="!editable()">
                        <option [ngValue]="null">—</option>
                        @for (p of products(); track p.id) {
                          <option [ngValue]="p.id">{{ p.name }}</option>
                        }
                      </select>
                    </td>
                    <td><input class="narrow" type="number" min="0" step="0.01" [(ngModel)]="i.width" [disabled]="!editable()" /></td>
                    <td><input class="narrow" type="number" min="0" step="0.01" [(ngModel)]="i.height" [disabled]="!editable()" /></td>
                    <td><input class="narrow" type="number" min="1" step="1" [(ngModel)]="i.qty" [disabled]="!editable()" /></td>
                    <td class="num">{{ area(i, m.unit) }}</td>
                    <td><input [(ngModel)]="i.operation" list="operations" [disabled]="!editable()" /></td>
                    <td><input [(ngModel)]="i.material" [disabled]="!editable()" /></td>
                    <td><input [(ngModel)]="i.finish" [disabled]="!editable()" /></td>
                    <td><input [(ngModel)]="i.remarks" [disabled]="!editable()" /></td>
                    <td>
                      @if (editable()) {
                        <button mat-icon-button (click)="removeItem($index)" aria-label="Remove opening">
                          <mat-icon>delete</mat-icon>
                        </button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="12" class="empty">No openings yet.</td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="6">
                    @if (editable()) {
                      <button mat-stroked-button (click)="addItem()"><mat-icon>add</mat-icon> Add opening</button>
                    }
                  </td>
                  <td class="num">
                    <strong>{{ totalArea(m.unit) }}</strong>
                  </td>
                  <td colspan="5"></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <datalist id="operations">
            @for (o of operations; track o) {
              <option [value]="o"></option>
            }
          </datalist>
        </div>

        <div class="card">
          <h2>Site photos and sketches</h2>
          <app-attachments [projectId]="projectId" [measurementId]="m.id" [readonly]="!canEdit" />
        </div>
      </div>
    }
  `,
})
export class MeasurementEditor {
  private readonly sb = inject(Supabase);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute).snapshot;
  protected readonly projectId = this.route.paramMap.get('id')!;
  private readonly id = this.route.paramMap.get('mid')!;

  protected readonly canEdit = this.auth.can('admin', 'approver', 'sales', 'measurement');
  protected readonly canApprove = this.auth.can('admin', 'approver');
  protected readonly statuses = MEASUREMENT_STATUSES;
  protected readonly units = MEASURE_UNITS;
  protected readonly operations = OPERATIONS;

  protected readonly m = signal<Measurement | null>(null);
  protected readonly items = signal<MeasurementItem[]>([]);
  protected readonly project = signal<Project | null>(null);
  protected readonly products = signal<Product[]>([]);
  protected readonly busy = signal(false);

  constructor() {
    const db = this.sb.client;
    void this.load();
    void this.sb
      .run<Project>(db.from('projects').select('*').eq('id', this.projectId).single())
      .then((p) => this.project.set(p));
    void this.sb
      .run<Product[]>(db.from('products').select('*').eq('active', true).order('category').order('name'))
      .then((rows) => this.products.set(rows));
  }

  private async load(): Promise<void> {
    const m = await this.sb.run<Measurement>(
      this.sb.client.from('measurements').select('*, measurement_items(*)').eq('id', this.id).single(),
    );
    this.items.set((m.measurement_items ?? []).slice().sort((a, b) => a.sort - b.sort));
    this.m.set(m);
  }

  protected editable(): boolean {
    return this.canEdit && this.m()?.status !== 'final';
  }

  protected area(i: MeasurementItem, unit: string): number {
    return areaSqft(i.width, i.height, unit) * (Number(i.qty) || 0);
  }

  protected totalArea(unit: string): string {
    return this.items()
      .reduce((sum, i) => sum + this.area(i, unit), 0)
      .toFixed(2);
  }

  protected addItem(): void {
    const last = this.items().at(-1);
    this.items.update((list) => [
      ...list,
      {
        product_id: last?.product_id ?? null,
        position: '',
        width: 0,
        height: 0,
        qty: 1,
        operation: last?.operation ?? null,
        material: last?.material ?? null,
        finish: last?.finish ?? null,
        remarks: null,
        sort: list.length,
      },
    ]);
  }

  protected removeItem(index: number): void {
    this.items.update((list) => list.filter((_, i) => i !== index));
  }

  /** Saves the header and openings; optionally moves the revision to a new status afterwards. */
  protected async save(next?: 'submitted' | 'final'): Promise<void> {
    const m = this.m();
    if (!m) return;
    const items = this.items();
    if (next && !items.length) {
      this.sb.error('Add at least one opening first.');
      return;
    }
    if (next && items.some((i) => !(Number(i.width) > 0) || !(Number(i.height) > 0))) {
      this.sb.error('Every opening needs a width and a height.');
      return;
    }
    if (next === 'final' && !confirm(`Approve R${m.revision_no} as the final measurement? It will be locked.`)) {
      return;
    }
    this.busy.set(true);
    const db = this.sb.client;
    try {
      await this.sb.run(
        db
          .from('measurements')
          .update({ measured_on: m.measured_on, unit: m.unit, notes: m.notes || null })
          .eq('id', m.id),
      );
      await this.sb.run(db.from('measurement_items').delete().eq('measurement_id', m.id));
      if (items.length) {
        await this.sb.run(
          db.from('measurement_items').insert(
            items.map((i, sort) => ({
              measurement_id: m.id,
              product_id: i.product_id,
              position: i.position || null,
              width: Number(i.width) || 0,
              height: Number(i.height) || 0,
              qty: Math.max(1, Math.round(Number(i.qty) || 1)),
              operation: i.operation || null,
              material: i.material || null,
              finish: i.finish || null,
              remarks: i.remarks || null,
              sort,
            })),
          ),
        );
      }
      if (next) {
        await this.sb.run(db.from('measurements').update({ status: next }).eq('id', m.id));
      }
      this.sb.info(next === 'final' ? 'Approved as final' : next ? 'Submitted for approval' : 'Saved');
      if (next === 'final') await this.router.navigate(['/projects', this.projectId]);
      else await this.load();
    } catch {
      // The message is already on screen; reload so the page matches what was saved.
      await this.load();
    } finally {
      this.busy.set(false);
    }
  }

  protected async reopen(): Promise<void> {
    if (!confirm('Reopen this final measurement for changes? It will need approval again.')) return;
    this.busy.set(true);
    try {
      await this.sb.run(
        this.sb.client.from('measurements').update({ status: 'submitted' }).eq('id', this.id),
      );
      await this.load();
    } finally {
      this.busy.set(false);
    }
  }
}
