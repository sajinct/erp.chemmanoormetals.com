import { Component, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Auth } from '../../core/auth';
import { INTERESTS, LEAD_STATUSES, Lead, SEGMENTS, SOURCES, labelOf } from '../../core/models';
import { Supabase } from '../../core/supabase';
import { LEAD_COLUMNS, exportXlsx } from '../../shared/excel';
import { today } from '../../shared/messaging';
import { UI } from '../../shared/ui';
import { paginate } from '../../shared/pagination';
import { LeadFormDialog } from './lead-form-dialog';
import { LeadImportDialog } from './lead-import-dialog';

@Component({
  selector: 'app-leads-list',
  imports: [UI],
  template: `
    <div class="page" [attr.aria-busy]="loading()">
      <div class="page-head">
        <div class="page-title">
          <h1>
            Leads <span class="count-badge">{{ leads().length }}</span>
          </h1>
          <p>Your enquiries, conversations and next opportunities.</p>
        </div>
        <button
          mat-stroked-button
          (click)="export()"
          [disabled]="loading() || failed() || exporting()"
        >
          <mat-icon>download</mat-icon>{{ exporting() ? 'Exporting�' : 'Export' }}
        </button>
        @if (canEdit) {
          <button mat-stroked-button (click)="import()"><mat-icon>upload</mat-icon> Import</button>
          <button mat-flat-button (click)="add()"><mat-icon>add</mat-icon> New lead</button>
        }
      </div>

      @if (failed()) {
        <div class="feedback" role="alert">
          <mat-icon>cloud_off</mat-icon><span>Leads couldn’t be loaded. Please try again.</span
          ><button mat-stroked-button (click)="load()">Retry</button>
        </div>
      }

      <div class="row filters">
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>Search name, phone, place</mat-label>
          <mat-icon matPrefix>search</mat-icon
          ><input matInput [ngModel]="search()" (ngModelChange)="search.set($event)" />
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
        <mat-form-field subscriptSizing="dynamic"
          ><mat-label>Follow-up</mat-label
          ><mat-select [ngModel]="followUp()" (ngModelChange)="followUp.set($event)"
            ><mat-option value="">Any date</mat-option
            ><mat-option value="due">Due today & overdue</mat-option
            ><mat-option value="overdue">Overdue only</mat-option></mat-select
          ></mat-form-field
        >
        @if (search() || status() || source() || segment() || followUp()) {
          <button mat-button (click)="clearFilters()">
            <mat-icon>close</mat-icon>Clear filters
          </button>
        }
      </div>

      <div class="card table-wrap">
        @if (loading()) {
          <div class="loading-line" role="status" aria-label="Loading leads"></div>
        }
        <table class="tbl" aria-label="Leads">
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
            @for (l of pager.rows(); track l.id) {
              <tr class="link" (click)="open(l)">
                <td>{{ l.ref_no }}</td>
                <td>
                  <a [routerLink]="['/leads', l.id]" (click)="$event.stopPropagation()">{{
                    l.name
                  }}</a>
                </td>
                <td>+{{ l.phone }}</td>
                <td>{{ l.location }}</td>
                <td>{{ l.interest | label: interests }}</td>
                <td>{{ l.segment | label: segments }}</td>
                <td>{{ l.source | label: sources }}</td>
                <td [class.error-text]="overdue(l)">{{ l.next_follow_up | date: 'd MMM' }}</td>
                <td>
                  <span class="chip {{ l.status }}">{{ l.status | label: statuses }}</span>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="9" class="empty">
                  <mat-icon>{{
                    failed() ? 'cloud_off' : loading() ? 'hourglass_empty' : 'filter_alt'
                  }}</mat-icon>
                  <strong>{{
                    failed()
                      ? 'Leads unavailable'
                      : loading()
                        ? 'Loading leads…'
                        : 'No leads to show'
                  }}</strong>
                  <p>
                    {{
                      failed()
                        ? 'Use Retry above to load your leads.'
                        : leads().length
                          ? 'Try another search or clear your filters.'
                          : 'Add your first enquiry or import an existing sheet.'
                    }}
                  </p>
                  @if (!loading() && !failed() && canEdit && !leads().length) {
                    <button mat-flat-button (click)="add()">
                      <mat-icon>add</mat-icon>New lead
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
        <app-table-pager [pager]="pager" [total]="shown().length" />
      </div>
    </div>
  `,
})
export class LeadsList {
  private readonly sb = inject(Supabase);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly canEdit = inject(Auth).can('admin', 'approver', 'sales', 'measurement');

  protected readonly statuses = LEAD_STATUSES;
  protected readonly sources = SOURCES;
  protected readonly segments = SEGMENTS;
  protected readonly interests = INTERESTS;

  protected readonly leads = signal<Lead[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly exporting = signal(false);
  protected readonly search = signal('');
  protected readonly status = signal('');
  protected readonly source = signal('');
  protected readonly segment = signal('');
  protected readonly followUp = signal('');

  protected readonly shown = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.leads().filter(
      (l) =>
        (!this.status() || l.status === this.status()) &&
        (!this.source() || l.source === this.source()) &&
        (!this.segment() || l.segment === this.segment()) &&
        (!this.followUp() ||
          (!!l.next_follow_up &&
            !['confirmed', 'lost'].includes(l.status) &&
            (this.followUp() === 'overdue'
              ? l.next_follow_up < today()
              : l.next_follow_up <= today()))) &&
        (!q || `${l.name} ${l.phone} ${l.location ?? ''} ${l.ref_no}`.toLowerCase().includes(q)),
    );
  });
  protected readonly pager = paginate(this.shown);

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.status.set(
        LEAD_STATUSES.some((s) => s.value === params.get('status')) ? params.get('status')! : '',
      );
      this.search.set(params.get('search') || '');
      this.followUp.set(
        ['due', 'overdue'].includes(params.get('followUp') || '') ? params.get('followUp')! : '',
      );
      if (params.get('new') === '1' && this.canEdit) {
        this.add();
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { new: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    });
    void this.load();
  }

  protected clearFilters(): void {
    this.search.set('');
    this.status.set('');
    this.source.set('');
    this.segment.set('');
    this.followUp.set('');
    void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
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
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  protected overdue(l: Lead): boolean {
    return (
      !!l.next_follow_up && l.next_follow_up < today() && !['confirmed', 'lost'].includes(l.status)
    );
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

  protected async export(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
      await exportXlsx(
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
    } catch {
      this.sb.error('The Excel export could not be created. Please try again.');
    } finally {
      this.exporting.set(false);
    }
  }
}
