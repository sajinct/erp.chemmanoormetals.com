import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Balance, PROJECT_STATUSES, Project, SEGMENTS } from '../../core/models';
import { Supabase } from '../../core/supabase';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-projects-list',
  imports: [UI],
  template: `
    <div class="page">
      <div class="page-head">
        <h1>Projects</h1>
      </div>
      <div class="row filters">
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>Search ref, customer, site</mat-label>
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
      </div>
      <div class="card table-wrap">
        <table class="tbl">
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
            @for (p of shown(); track p.id) {
              <tr class="link" (click)="router.navigate(['/projects', p.id])">
                <td>{{ p.ref_no }}</td>
                <td>{{ p.customers?.name }}</td>
                <td class="wrap">{{ p.site_address }}</td>
                <td>{{ p.segment | label: segments }}</td>
                <td>{{ p.created_at | date: 'd MMM y' }}</td>
                <td class="num">{{ balances()[p.id]?.quote_total | inr }}</td>
                <td class="num">{{ balances()[p.id]?.paid | inr }}</td>
                <td class="num">{{ balances()[p.id]?.balance | inr }}</td>
                <td><span class="chip {{ p.status }}">{{ p.status | label: statuses }}</span></td>
              </tr>
            } @empty {
              <tr>
                <td colspan="9" class="empty">
                  {{ loading() ? 'Loading…' : 'No projects yet. Open a lead and choose Create project.' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class ProjectsList {
  private readonly sb = inject(Supabase);
  protected readonly router = inject(Router);
  protected readonly statuses = PROJECT_STATUSES;
  protected readonly segments = SEGMENTS;

  protected readonly projects = signal<Project[]>([]);
  protected readonly balances = signal<Record<string, Balance>>({});
  protected readonly loading = signal(true);
  protected readonly search = signal('');
  protected readonly status = signal('');
  protected readonly shown = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.projects().filter(
      (p) =>
        (!this.status() || p.status === this.status()) &&
        (!q || `${p.ref_no} ${p.customers?.name ?? ''} ${p.site_address ?? ''}`.toLowerCase().includes(q)),
    );
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
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
    } finally {
      this.loading.set(false);
    }
  }
}
