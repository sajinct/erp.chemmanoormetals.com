import { Component, computed, inject, signal } from '@angular/core';
import { Balance, LEAD_STATUSES, Lead, Project } from '../../core/models';
import { Supabase } from '../../core/supabase';
import { today } from '../../shared/messaging';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-dashboard',
  imports: [UI],
  template: `
    <div class="page">
      <div class="page-head"><h1>Dashboard</h1></div>

      <div class="tiles">
        @for (t of funnel(); track t.value) {
          <a class="card tile" routerLink="/leads">
            <span class="sub">{{ t.label }}</span>
            <strong>{{ t.count }}</strong>
          </a>
        }
      </div>

      <div class="card table-wrap">
        <h2>Follow-ups due ({{ due().length }})</h2>
        <table class="tbl">
          <tbody>
            @for (l of due(); track l.id) {
              <tr>
                <td [class.error-text]="l.next_follow_up! < day">{{ l.next_follow_up | date: 'd MMM' }}</td>
                <td><a [routerLink]="['/leads', l.id]">{{ l.name }}</a></td>
                <td>+{{ l.phone }}</td>
                <td>{{ l.location }}</td>
                <td><span class="chip {{ l.status }}">{{ l.status | label: statuses }}</span></td>
              </tr>
            } @empty {
              <tr><td class="empty">Nothing due today.</td></tr>
            }
          </tbody>
        </table>
      </div>

      <div class="card table-wrap">
        <h2>Balance to collect: Rs. {{ outstandingTotal() | inr }}</h2>
        <table class="tbl">
          <thead>
            <tr>
              <th>Project</th>
              <th>Customer</th>
              <th class="num">Quote</th>
              <th class="num">Received</th>
              <th class="num">Balance</th>
            </tr>
          </thead>
          <tbody>
            @for (o of outstanding(); track o.project.id) {
              <tr>
                <td><a [routerLink]="['/projects', o.project.id]">{{ o.project.ref_no }}</a></td>
                <td>{{ o.project.customers?.name }}</td>
                <td class="num">{{ o.balance.quote_total | inr }}</td>
                <td class="num">{{ o.balance.paid | inr }}</td>
                <td class="num">{{ o.balance.balance | inr }}</td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="empty">No confirmed project has a balance due.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: `
    .tiles {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .tile {
      display: flex;
      flex-direction: column;
      margin: 0;
      color: inherit;
      text-decoration: none;
    }
    .tile strong {
      font-size: 28px;
      font-weight: 500;
    }
  `,
})
export class Dashboard {
  private readonly sb = inject(Supabase);
  protected readonly statuses = LEAD_STATUSES;
  protected readonly day = today();

  private readonly leads = signal<Lead[]>([]);
  private readonly projects = signal<Project[]>([]);
  private readonly balances = signal<Balance[]>([]);

  protected readonly funnel = computed(() =>
    LEAD_STATUSES.map((s) => ({
      ...s,
      count: this.leads().filter((l) => l.status === s.value).length,
    })),
  );

  protected readonly due = computed(() =>
    this.leads()
      .filter(
        (l) => l.next_follow_up && l.next_follow_up <= this.day && !['confirmed', 'lost'].includes(l.status),
      )
      .sort((a, b) => a.next_follow_up!.localeCompare(b.next_follow_up!)),
  );

  /** Confirmed projects (advance received) that still owe money. */
  protected readonly outstanding = computed(() => {
    const byId = new Map(this.balances().map((b) => [b.project_id, b]));
    return this.projects()
      .filter((p) => p.status === 'confirmed')
      .map((project) => ({ project, balance: byId.get(project.id)! }))
      .filter((o) => o.balance && o.balance.balance > 0)
      .sort((a, b) => b.balance.balance - a.balance.balance);
  });

  protected readonly outstandingTotal = computed(() =>
    this.outstanding().reduce((sum, o) => sum + o.balance.balance, 0),
  );

  constructor() {
    const db = this.sb.client;
    void this.sb
      .all<Lead>(() => db.from('leads').select('*').order('id'))
      .then((r) => this.leads.set(r));
    void this.sb
      .all<Project>(() => db.from('projects').select('*, customers(*)').order('id'))
      .then((r) => this.projects.set(r));
    void this.sb
      .all<Balance>(() => db.from('project_balances').select('*').order('project_id'))
      .then((r) => this.balances.set(r));
  }
}
