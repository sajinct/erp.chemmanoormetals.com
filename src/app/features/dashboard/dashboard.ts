import { Component, computed, inject, signal } from '@angular/core';
import { Auth } from '../../core/auth';
import { Balance, LEAD_STATUSES, Lead, Project } from '../../core/models';
import { Supabase } from '../../core/supabase';
import { today } from '../../shared/messaging';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-dashboard',
  imports: [UI],
  template: `
    <div class="page" [attr.aria-busy]="loading()">
      <div class="page-head">
        <div class="page-title">
          <div class="eyebrow">Your business at a glance</div>
          <h1>Business overview</h1>
          <p>Welcome back, {{ firstName }}. Here’s what needs your attention.</p>
        </div>
        <span class="date-label"
          ><mat-icon>calendar_today</mat-icon>{{ day | date: 'EEE, d MMM y' }}</span
        >
        @if (canEdit) {
          <a mat-flat-button routerLink="/leads" [queryParams]="{ new: '1' }"
            ><mat-icon>add</mat-icon>New lead</a
          >
        }
      </div>
      @if (failed()) {
        <div class="feedback" role="alert">
          <mat-icon>cloud_off</mat-icon><span>We couldn’t load the overview. Please try again.</span
          ><button mat-stroked-button (click)="load()">Retry</button>
        </div>
      }
      @if (loading()) {
        <div class="loading-line" role="status" aria-label="Loading business overview"></div>
      }
      <div class="metrics">
        <a class="card metric" routerLink="/leads"
          ><div class="metric-label">
            Total leads<span class="metric-icon blue"><mat-icon>people_outline</mat-icon></span>
          </div>
          <strong>{{ loading() || failed() ? '—' : leads().length }}</strong><span
            class="metric-note"
            >All enquiries in your pipeline<mat-icon>north_east</mat-icon></span
          ></a
        >
        <a class="card metric" routerLink="/leads" [queryParams]="{ followUp: 'due' }"
          ><div class="metric-label">
            Follow-ups due<span class="metric-icon orange"><mat-icon>schedule</mat-icon></span>
          </div>
          <strong>{{ loading() || failed() ? '—' : due().length }}</strong><span class="metric-note"
            ><span [class.error-text]="overdueCount() > 0">{{ overdueCount() }} overdue</span> ·
            today and earlier<mat-icon>north_east</mat-icon></span
          ></a
        >
        <a class="card metric" routerLink="/projects" [queryParams]="{ active: '1' }"
          ><div class="metric-label">
            Active projects<span class="metric-icon purple"><mat-icon>work_outline</mat-icon></span>
          </div>
          <strong>{{ loading() || failed() ? '—' : activeProjects() }}</strong><span
            class="metric-note"
            >Measurement through confirmation<mat-icon>north_east</mat-icon></span
          ></a
        >
        <a class="card metric" href="#collections"
          ><div class="metric-label">
            To collect<span class="metric-icon green"
              ><mat-icon>account_balance_wallet</mat-icon></span
            >
          </div>
          <strong class="money">{{
            loading() || failed() ? '—' : '₹' + (outstandingTotal() | inr)
          }}</strong><span class="metric-note"
            >{{ outstanding().length }} confirmed projects<mat-icon>south</mat-icon></span
          ></a
        >
      </div>

      <section class="card pipeline" aria-labelledby="pipeline-title">
        <div class="section-head">
          <div>
            <h2 id="pipeline-title">Sales pipeline</h2>
            <p>Every enquiry, from first contact to confirmation.</p>
          </div>
          <a routerLink="/leads">View all leads<mat-icon>arrow_forward</mat-icon></a>
        </div>
        <div class="stages">
          @for (t of funnel(); track t.value) {
            <a class="stage" routerLink="/leads" [queryParams]="{ status: t.value }"
              ><span class="stage-label"
                ><span class="stage-dot {{ t.value }}"></span>{{ t.label }}</span
              ><strong>{{ loading() || failed() ? '—' : t.count }}</strong>
              <div class="stage-track">
                <span
                  class="stage-fill {{ t.value }}"
                  [style.width.%]="leads().length ? (t.count / leads().length) * 100 : 0"
                ></span></div
            ></a>
          }
        </div>
      </section>

      <div class="dashboard-grid">
        <section class="card table-wrap" aria-labelledby="followup-title">
          <div class="section-head">
            <div>
              <h2 id="followup-title">
                Follow-ups due <span class="count-badge">{{ due().length }}</span>
              </h2>
              <p>A timely conversation makes the difference.</p>
            </div>
            <a routerLink="/leads" [queryParams]="{ followUp: 'due' }"
              >View all<mat-icon>arrow_forward</mat-icon></a
            >
          </div>
          <table class="tbl">
            <thead>
              <tr>
                <th scope="col">Lead</th>
                <th scope="col">Follow-up</th>
                <th scope="col">Status</th>
                <th scope="col">Contact</th>
              </tr>
            </thead>
            <tbody>
              @for (l of due().slice(0, 5); track l.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/leads', l.id]">{{ l.name }}</a><span class="cell-sub">{{
                      l.location || l.ref_no
                    }}</span>
                  </td>
                  <td>
                    <span [class.error-text]="l.next_follow_up! < day">{{
                      l.next_follow_up | date: 'd MMM'
                    }}</span><span class="cell-sub" [class.error-text]="l.next_follow_up! < day">{{
                      l.next_follow_up! < day ? 'Overdue' : 'Today'
                    }}</span>
                  </td>
                  <td>
                    <span class="chip {{ l.status }}">{{ l.status | label: statuses }}</span>
                  </td>
                  <td>
                    <a
                      class="contact-link"
                      href="tel:+{{ l.phone }}"
                      [attr.aria-label]="'Call ' + l.name"
                      ><mat-icon>call</mat-icon></a
                    >
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="empty">
                    <mat-icon>{{
                      failed() ? 'cloud_off' : loading() ? 'hourglass_empty' : 'task_alt'
                    }}</mat-icon><strong>{{
                      failed()
                        ? 'Overview unavailable'
                        : loading()
                          ? 'Loading follow-ups…'
                          : 'You’re all caught up'
                    }}</strong>
                    <p>
                      {{
                        failed()
                          ? 'Retry loading the overview above.'
                          : 'Scheduled follow-ups due today will appear here.'
                      }}
                    </p>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </section>
        <aside class="card shortcuts">
          <div class="eyebrow">Keep things moving</div>
          <h2>Your next step</h2>
          <p>Everything you need to take an enquiry forward.</p>
          <a routerLink="/leads"
            ><span class="shortcut-icon orange"><mat-icon>filter_alt</mat-icon></span
            ><span
              ><strong>Manage enquiries</strong
              ><small>Follow up and build your pipeline</small></span
            ><mat-icon>chevron_right</mat-icon></a
          >
          <a routerLink="/projects"
            ><span class="shortcut-icon purple"><mat-icon>straighten</mat-icon></span
            ><span
              ><strong>Track projects</strong><small>Measurements, quotes and payments</small></span
            ><mat-icon>chevron_right</mat-icon></a
          >
          <a routerLink="/catalogue"
            ><span class="shortcut-icon blue"><mat-icon>inventory_2</mat-icon></span
            ><span
              ><strong>Browse products & rates</strong
              ><small>Your catalogue, ready to quote</small></span
            ><mat-icon>chevron_right</mat-icon></a
          >
        </aside>
      </div>

      <section id="collections" class="card table-wrap" aria-labelledby="collections-title">
        <div class="section-head">
          <div>
            <h2 id="collections-title">Outstanding collections</h2>
            <p>Balances on confirmed projects, highest first.</p>
          </div>
          <span class="collection-total">₹{{ outstandingTotal() | inr }}</span>
        </div>
        <table class="tbl">
          <thead>
            <tr>
              <th scope="col">Project</th>
              <th scope="col">Customer</th>
              <th scope="col" class="num">Quote value</th>
              <th scope="col" class="num">Received</th>
              <th scope="col" class="num">Balance due</th>
            </tr>
          </thead>
          <tbody>
            @for (o of outstanding().slice(0, 5); track o.project.id) {
              <tr>
                <td>
                  <a [routerLink]="['/projects', o.project.id]">{{ o.project.ref_no }}</a>
                </td>
                <td>{{ o.project.customers?.name }}</td>
                <td class="num">₹{{ o.balance.quote_total | inr }}</td>
                <td class="num received">₹{{ o.balance.paid | inr }}</td>
                <td class="num balance">₹{{ o.balance.balance | inr }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="empty">
                  <mat-icon>{{
                    failed() ? 'cloud_off' : 'account_balance_wallet'
                  }}</mat-icon><strong>{{
                    failed()
                      ? 'Collections unavailable'
                      : loading()
                        ? 'Loading collections…'
                        : 'No outstanding balances'
                  }}</strong>
                  <p>
                    {{
                      failed()
                        ? 'Retry loading the overview above.'
                        : 'Confirmed projects with a balance due will appear here.'
                    }}
                  </p>
                </td>
              </tr>
            }
          </tbody>
        </table>
        <div class="table-footer">
          <span>{{
            outstanding().length > 5
              ? 'Showing 5 of ' + outstanding().length + ' outstanding projects'
              : 'Collections across confirmed projects'
          }}</span><span class="spacer"></span
          ><a routerLink="/projects" [queryParams]="{ status: 'confirmed' }"
            >View confirmed projects →</a
          >
        </div>
      </section>
      <p class="overview-footer">
        Chemmanoor Metals <span>·</span> Trusted protection. Since 1975.
      </p>
    </div>
  `,
  styles: `
    .page-title .eyebrow {
      margin-bottom: 8px;
    }
    .date-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: #667085;
      margin-right: 6px;
    }
    .date-label mat-icon {
      width: 15px;
      height: 15px;
      font-size: 15px;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 18px;
      margin: 0 0 24px;
    }
    .metric {
      margin: 0;
      padding: 20px;
      color: inherit;
      text-decoration: none;
      transition:
        border-color 0.15s,
        box-shadow 0.15s;
    }
    .metric:hover {
      border-color: #d7b19b;
      box-shadow: 0 3px 12px #202b3b08;
    }
    .metric-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 600;
      color: #667085;
      gap: 5px;
    }
    .blue {
      background: #edf4ff;
      color: #4675ca;
    }
    .orange {
      background: #fff0e7;
      color: #b55322;
    }
    .purple {
      background: #f2edff;
      color: #8b62bf;
    }
    .green {
      background: #eaf6ef;
      color: #398263;
    }
    .metric > strong {
      display: block;
      font-size: 32px;
      letter-spacing: -0.05em;
      font-weight: 800;
      line-height: 1.4;
      margin: 7px 0 12px;
      font-variant-numeric: tabular-nums;
    }
    .metric > strong.money {
      font-size: clamp(18px, 1.8vw, 28px);
      min-height: 45px;
      display: flex;
      align-items: center;
      overflow-wrap: anywhere;
    }
    .metric-note {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: 10px;
      font-weight: 500;
      color: #667085;
    }
    .metric-note mat-icon {
      margin-left: auto;
      width: 14px;
      height: 14px;
      font-size: 14px;
      color: #98a2b3;
    }
    .pipeline {
      padding: 0;
      margin-bottom: 24px;
    }
    .stages {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      padding: 22px 24px;
    }
    .stage {
      padding: 0 20px;
      border-right: 1px solid var(--brand-line);
      color: inherit;
      text-decoration: none;
    }
    .stage:first-child {
      padding-left: 0;
    }
    .stage:last-child {
      padding-right: 0;
      border: 0;
    }
    .stage:hover strong {
      color: var(--brand-orange-text);
    }
    .stage-label {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 10px;
      color: #667085;
      white-space: nowrap;
    }
    .stage-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .stage strong {
      display: block;
      margin: 9px 0 12px;
      font-size: 24px;
      font-weight: 800;
      line-height: 1.2;
    }
    .stage-track {
      height: 4px;
      border-radius: 3px;
      overflow: hidden;
      background: #f0f2f6;
    }
    .stage-fill {
      display: block;
      height: 100%;
      border-radius: inherit;
    }
    .stage .new {
      background: #8e9cb5;
    }
    .stage .contacted {
      background: #69a6e4;
    }
    .stage .measurement_scheduled {
      background: #f4a067;
    }
    .stage .quoted {
      background: #a38ad4;
    }
    .stage .confirmed {
      background: #64aa86;
    }
    .stage .lost {
      background: #d78b8b;
    }
    .dashboard-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.8fr) minmax(280px, 1fr);
      gap: 24px;
    }
    .cell-sub {
      display: block;
      font-size: 10px;
      color: #7b8493;
      margin-top: 3px;
    }
    .contact-link {
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      border: 1px solid var(--brand-line);
      border-radius: 7px;
      color: #667085;
    }
    .contact-link mat-icon {
      width: 15px;
      height: 15px;
      font-size: 15px;
    }
    .shortcuts {
      padding: 24px;
    }
    .shortcuts h2 {
      margin: 8px 0 6px;
      font-size: 19px;
    }
    .shortcuts > p {
      font-size: 11px;
      color: #667085;
      margin: 0 0 18px;
    }
    .shortcuts > a {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 15px 0;
      border-top: 1px solid var(--brand-line);
      color: inherit;
      text-decoration: none;
    }
    .shortcuts > a:hover strong {
      color: var(--brand-orange-text);
    }
    .shortcuts strong {
      display: block;
      font-size: 11px;
    }
    .shortcuts small {
      display: block;
      font-size: 10px;
      color: #667085;
      margin-top: 3px;
    }
    .shortcuts a > mat-icon {
      margin-left: auto;
      width: 16px;
      height: 16px;
      font-size: 16px;
      color: #98a2b3;
    }
    #collections {
      scroll-margin-top: 90px;
    }
    .collection-total {
      font-size: 17px;
      font-weight: 800;
      letter-spacing: -0.04em;
    }
    .received {
      color: #398263;
    }
    .balance {
      font-weight: 800;
    }
    .overview-footer {
      text-align: center;
      color: #7b8493;
      font-size: 10px;
      padding: 8px;
    }
    .overview-footer span {
      margin: 0 8px;
    }
    @media (max-width: 1200px) {
      .metrics {
        gap: 12px;
      }
      .metric {
        padding: 16px;
      }
      .dashboard-grid {
        grid-template-columns: minmax(0, 1fr);
        gap: 0;
      }
      .shortcuts {
        display: none;
      }
      .stage {
        padding: 0 12px;
      }
    }
    @media (max-width: 700px) {
      .metrics {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .metric-note {
        font-size: 9px;
        flex-wrap: wrap;
      }
      .metric-note mat-icon {
        display: none;
      }
      .metric > strong.money {
        font-size: 20px;
      }
      .stages {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 24px 0;
        padding: 20px;
      }
      .stage:nth-child(3) {
        border: 0;
        padding-right: 0;
      }
      .stage:nth-child(4) {
        padding-left: 0;
      }
      .stage-label {
        font-size: 9px;
      }
      .date-label {
        margin-right: auto;
      }
      .collection-total {
        font-size: 14px;
      }
    }
  `,
})
export class Dashboard {
  private readonly sb = inject(Supabase);
  private readonly auth = inject(Auth);
  protected readonly firstName = this.auth.profile()?.full_name?.trim().split(/\s+/)[0] || 'team';
  protected readonly canEdit = this.auth.can('admin', 'approver', 'sales', 'measurement');
  protected readonly statuses = LEAD_STATUSES;
  protected readonly day = today();
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly leads = signal<Lead[]>([]);
  private readonly projects = signal<Project[]>([]);
  private readonly balances = signal<Balance[]>([]);
  protected readonly activeProjects = computed(
    () => this.projects().filter((p) => p.status !== 'cancelled').length,
  );
  protected readonly funnel = computed(() =>
    LEAD_STATUSES.map((s) => ({
      ...s,
      count: this.leads().filter((l) => l.status === s.value).length,
    })),
  );
  protected readonly due = computed(() =>
    this.leads()
      .filter(
        (l) =>
          l.next_follow_up &&
          l.next_follow_up <= this.day &&
          !['confirmed', 'lost'].includes(l.status),
      )
      .sort((a, b) => a.next_follow_up!.localeCompare(b.next_follow_up!)),
  );
  protected readonly overdueCount = computed(
    () => this.due().filter((l) => l.next_follow_up! < this.day).length,
  );
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
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    const db = this.sb.client;
    try {
      const [leads, projects, balances] = await Promise.all([
        this.sb.all<Lead>(() => db.from('leads').select('*').order('id')),
        this.sb.all<Project>(() => db.from('projects').select('*, customers(*)').order('id')),
        this.sb.all<Balance>(() => db.from('project_balances').select('*').order('project_id')),
      ]);
      this.leads.set(leads);
      this.projects.set(projects);
      this.balances.set(balances);
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
