import { Component, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Auth } from '../../core/auth';
import { INTERESTS, LEAD_STATUSES, Lead, SEGMENTS, SOURCES, labelOf } from '../../core/models';
import { Supabase } from '../../core/supabase';
import { LEAD_COLUMNS, exportXlsx } from '../../shared/excel';
import { today } from '../../shared/messaging';
import { UI } from '../../shared/ui';
import { LeadFormDialog } from './lead-form-dialog';
import { LeadImportDialog } from './lead-import-dialog';

@Component({
  selector: 'app-leads-list',
  imports: [UI],
  template: `
    <div class="page">
      <div class="page-head">
        <h1>Leads</h1>
        <button mat-stroked-button (click)="export()"><mat-icon>download</mat-icon> Export</button>
        @if (canEdit) {
          <button mat-stroked-button (click)="import()"><mat-icon>upload</mat-icon> Import</button>
          <button mat-flat-button (click)="add()"><mat-icon>add</mat-icon> New lead</button>
        }
      </div>

      <div class="row filters">
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>Search name, phone, place</mat-label>
          <input matInput [ngModel]="search()" (ngModelChange)="search.set($event)" />
        </mat-form-field>
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>Status</mat-label>
          <mat-select [ngModel]="status()" (ngModelChange)="status.set($event)">
            <mat-option value="">All</mat-option>
            @for (o of statuses; track o.value) {
              <mat-option [value]="o.value">{{ o.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>Source</mat-label>
          <mat-select [ngModel]="source()" (ngModelChange)="source.set($event)">
            <mat-option value="">All</mat-option>
            @for (o of sources; track o.value) {
              <mat-option [value]="o.value">{{ o.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>Segment</mat-label>
          <mat-select [ngModel]="segment()" (ngModelChange)="segment.set($event)">
            <mat-option value="">All</mat-option>
            @for (o of segments; track o.value) {
              <mat-option [value]="o.value">{{ o.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <span class="sub">{{ shown().length }} of {{ leads().length }}</span>
      </div>

      <div class="card table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Location</th>
              <th>Interest</th>
              <th>Segment</th>
              <th>Source</th>
              <th>Follow-up</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            @for (l of shown(); track l.id) {
              <tr class="link" (click)="open(l)">
                <td>{{ l.ref_no }}</td>
                <td>{{ l.name }}</td>
                <td>+{{ l.phone }}</td>
                <td>{{ l.location }}</td>
                <td>{{ l.interest | label: interests }}</td>
                <td>{{ l.segment | label: segments }}</td>
                <td>{{ l.source | label: sources }}</td>
                <td [class.error-text]="overdue(l)">{{ l.next_follow_up | date: 'd MMM' }}</td>
                <td><span class="chip {{ l.status }}">{{ l.status | label: statuses }}</span></td>
              </tr>
            } @empty {
              <tr>
                <td colspan="9" class="empty">
                  {{ loading() ? 'Loading…' : 'No leads match. Add one or import a sheet.' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class LeadsList {
  private readonly sb = inject(Supabase);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  protected readonly canEdit = inject(Auth).can('admin', 'approver', 'sales', 'measurement');

  protected readonly statuses = LEAD_STATUSES;
  protected readonly sources = SOURCES;
  protected readonly segments = SEGMENTS;
  protected readonly interests = INTERESTS;

  protected readonly leads = signal<Lead[]>([]);
  protected readonly loading = signal(true);
  protected readonly search = signal('');
  protected readonly status = signal('');
  protected readonly source = signal('');
  protected readonly segment = signal('');

  protected readonly shown = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.leads().filter(
      (l) =>
        (!this.status() || l.status === this.status()) &&
        (!this.source() || l.source === this.source()) &&
        (!this.segment() || l.segment === this.segment()) &&
        (!q || `${l.name} ${l.phone} ${l.location ?? ''} ${l.ref_no}`.toLowerCase().includes(q)),
    );
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.leads.set(
        await this.sb.all<Lead>(() =>
          this.sb.client
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false })
            .order('id'),
        ),
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected overdue(l: Lead): boolean {
    return !!l.next_follow_up && l.next_follow_up < today() && !['confirmed', 'lost'].includes(l.status);
  }

  protected open(l: Lead): void {
    void this.router.navigate(['/leads', l.id]);
  }

  protected add(): void {
    this.dialog
      .open(LeadFormDialog, { data: null })
      .afterClosed()
      .subscribe((saved) => saved && this.load());
  }

  protected import(): void {
    this.dialog
      .open(LeadImportDialog, { maxWidth: '95vw' })
      .afterClosed()
      .subscribe((saved) => saved && this.load());
  }

  protected export(): void {
    void exportXlsx(
      `leads-${today()}.xlsx`,
      [
        { header: 'Ref', key: 'ref_no' },
        ...LEAD_COLUMNS,
        { header: 'Status', key: 'status' },
        { header: 'Next Follow-up', key: 'next_follow_up' },
        { header: 'Created', key: 'created' },
      ],
      this.shown().map((l) => ({
        ...l,
        source: labelOf(SOURCES, l.source),
        segment: labelOf(SEGMENTS, l.segment),
        interest: labelOf(INTERESTS, l.interest),
        status: labelOf(LEAD_STATUSES, l.status),
        created: l.created_at.slice(0, 10),
      })),
    );
  }
}
