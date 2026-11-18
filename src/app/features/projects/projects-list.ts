import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Balance, PROJECT_STATUSES, Project, SEGMENTS } from '../../core/models';
import { Supabase } from '../../core/supabase';
import { UI } from '../../shared/ui';
import { paginate } from '../../shared/pagination';

@Component({
  selector: 'app-projects-list',
  imports: [UI],
  template: `
    <div class="page" [attr.aria-busy]="loading()">
      <div class="page-head">
        <div class="page-title">
          <h1>
            Projects <span class="count-badge">{{ projects().length }}</span>
          </h1>
          <p>From site measurements to quotations and payments, all in one place.</p>
        </div>
        <a mat-stroked-button routerLink="/leads"><mat-icon>filter_alt</mat-icon>Open leads</a>
      </div>
      @if (failed()) {
        <div class="feedback" role="alert">
          <mat-icon>cloud_off</mat-icon><span>Projects couldn’t be loaded. Please try again.</span
          ><button mat-stroked-button (click)="load()">Retry</button>
        </div>
      }
      <div class="row filters">
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>Search ref, customer, site</mat-label>
          <mat-icon matPrefix>search</mat-icon
          ><input matInput [ngModel]="search()" (ngModelChange)="search.set($event)" />
        </mat-form-field>
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>Status</mat-label>
          <mat-select [ngModel]="status()" (ngModelChange)="status.set($event)">
            <mat-option value="">All</mat-option>
            <mat-option value="active">All active projects</mat-option>
            @for (o of statuses; track o.value) {
              <mat-option [value]="o.value">{{ o.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (search() || status()) {
          <button mat-button (click)="clearFilters()">
            <mat-icon>close</mat-icon>Clear filters
          </button>
        }
      </div>
      <div class="card table-wrap">
        @if (loading()) {
          <div class="loading-line" role="status" aria-label="Loading projects"></div>
        }
        <table class="tbl" aria-label="Projects">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Customer</th>
              <th>Site</th>
              <th>Segment</th>
              <th>Started</th>
              <th class="num">Quote</th>
              <th class="num">Received</th>
              <th class="num">Balance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            @for (p of pager.rows(); track p.id) {
              <tr class="link" (click)="router.navigate(['/projects', p.id])">
                <td>
                  <a [routerLink]="['/projects', p.id]" (click)="$event.stopPropagation()">{{
                    p.ref_no
                  }}</a>
                </td>
                <td>{{ p.customers?.name }}</td>
                <td class="wrap">{{ p.site_address }}</td>
                <td>{{ p.segment | label: segments }}</td>
                <td>{{ p.created_at | date: 'd MMM y' }}</td>
                <td class="num">{{ balances()[p.id]?.quote_total | inr }}</td>
                <td class="num">{{ balances()[p.id]?.paid | inr }}</td>
                <td class="num">{{ balances()[p.id]?.balance | inr }}</td>
                <td>
                  <span class="chip {{ p.status }}">{{ p.status | label: statuses }}</span>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="9" class="empty">
                  <mat-icon>{{
                    failed() ? 'cloud_off' : loading() ? 'hourglass_empty' : 'work_outline'
                  }}</mat-icon><strong>{{
                    failed()
                      ? 'Projects unavailable'
                      : loading()
                        ? 'Loading projects…'
                        : 'No projects to show'
                  }}</strong>
                  <p>
                    {{
                      failed()
                        ? 'Use Retry above to load your projects.'
                        : projects().length
                          ? 'Try another search or clear your filters.'
                          : 'Open a lead and choose Create project to get started.'
                    }}
                  </p>
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
export class ProjectsList {
  private readonly sb = inject(Supabase);
  protected readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly statuses = PROJECT_STATUSES;
  protected readonly segments = SEGMENTS;

  protected readonly projects = signal<Project[]>([]);
  protected readonly balances = signal<Record<string, Balance>>({});
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly search = signal('');
  protected readonly status = signal('');
  protected readonly shown = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.projects().filter(
      (p) =>
        (!this.status() ||
          (this.status() === 'active' ? p.status !== 'cancelled' : p.status === this.status())) &&
        (!q ||
          `${p.ref_no} ${p.customers?.name ?? ''} ${p.site_address ?? ''}`
            .toLowerCase()
            .includes(q)),
    );
  });
  protected readonly pager = paginate(this.shown);

  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) =>
        this.status.set(
          params.get('active') === '1'
            ? 'active'
            : PROJECT_STATUSES.some((s) => s.value === params.get('status'))
              ? params.get('status')!
              : '',
        ),
      );
    void this.load();
  }

  protected clearFilters(): void {
    this.search.set('');
    this.status.set('');
    void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    const db = this.sb.client;
    try {
      const [projects, balances] = await Promise.all([
        this.sb.all<Project>(() =>
          db
            .from('projects')
            .select('*, customers(*)')
            .order('created_at', { ascending: false })
            .order('id'),
        ),
        this.sb.all<Balance>(() => db.from('project_balances').select('*').order('project_id')),
      ]);
      this.projects.set(projects);
      this.balances.set(Object.fromEntries(balances.map((b) => [b.project_id, b])));
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
