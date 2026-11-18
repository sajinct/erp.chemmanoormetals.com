import { Component, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Auth } from '../../core/auth';
import {
  Balance,
  MEASUREMENT_STATUSES,
  MEASURE_UNITS,
  Measurement,
  PAYMENT_KINDS,
  PAYMENT_MODES,
  PROJECT_STATUSES,
  Payment,
  Product,
  Project,
  QUOTE_STATUSES,
  Quote,
  SEGMENTS,
  Settings,
  labelOf,
} from '../../core/models';
import { Supabase } from '../../core/supabase';
import { Attachments } from '../../shared/attachments';
import { addDays, fillTemplate, mailLink, money, today, waLink } from '../../shared/messaging';
import { billingQty, quoteTotals, round2 } from '../../shared/quote-calc';
import { UI } from '../../shared/ui';
import { PaymentDialog, PaymentDialogData } from '../payments/payment-dialog';

@Component({
  selector: 'app-project-detail',
  imports: [UI, Attachments],
  template: `
    @if (project(); as p) {
      <div class="page">
        <div class="page-head">
          <h1>
            {{ p.ref_no }} <span class="sub">{{ p.customers?.name }}</span>
            <span class="chip {{ p.status }}">{{ p.status | label: statuses }}</span>
          </h1>
          <a mat-stroked-button [href]="hello(p)" target="_blank" rel="noopener">
            <mat-icon>chat</mat-icon> WhatsApp
          </a>
          @if (p.map_url) {
            <a mat-stroked-button [href]="p.map_url" target="_blank" rel="noopener">
              <mat-icon>map</mat-icon> Open map
            </a>
          }
        </div>

        <!-- Site -->
        <div class="card">
          <h2>Customer and site</h2>
          <p>
            <a [routerLink]="['/customers', p.customer_id]">{{ p.customers?.name }}</a>
            · +{{ p.customers?.phone }} · {{ p.segment | label: segments }}
            @if (p.lead_id) {
              · <a [routerLink]="['/leads', p.lead_id]">Lead history</a>
            }
          </p>
          <div class="form-grid">
            <mat-form-field>
              <mat-label>Site address</mat-label>
              <input matInput [(ngModel)]="p.site_address" [disabled]="!canEdit" />
            </mat-form-field>
            <mat-form-field>
              <mat-label>Google Maps link</mat-label>
              <input matInput [(ngModel)]="p.map_url" [disabled]="!canEdit" />
            </mat-form-field>
          </div>
          @if (canEdit) {
            <div class="row">
              <button mat-stroked-button (click)="saveSite(p)">Save site details</button>
              <span class="spacer"></span>
              @if (p.status !== 'cancelled') {
                <button mat-button (click)="setStatus(p, 'cancelled')">Cancel project</button>
              } @else {
                <button mat-button (click)="setStatus(p, 'measurement')">Reopen project</button>
              }
            </div>
          }
        </div>

        <!-- Measurements -->
        <div class="card">
          <div class="row">
            <h2 class="spacer">1. Measurements</h2>
            @if (canEdit && !finalM()) {
              <button mat-flat-button (click)="newRevision()" [disabled]="busy()">
                <mat-icon>add</mat-icon>
                {{ measurements().length ? 'New revision (copy latest)' : 'Add measurement' }}
              </button>
            }
          </div>
          <div class="table-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Revision</th>
                  <th>Date</th>
                  <th>Measured by</th>
                  <th class="num">Openings</th>
                  <th>Status</th>
                  <th>Approved</th>
                </tr>
              </thead>
              <tbody>
                @for (m of measurements(); track m.id) {
                  <tr class="link" (click)="router.navigate(['/projects', p.id, 'measurements', m.id])">
                    <td>R{{ m.revision_no }}</td>
                    <td>{{ m.measured_on | date: 'd MMM y' }}</td>
                    <td>{{ m.measurer?.full_name }}</td>
                    <td class="num">{{ m.measurement_items?.length }}</td>
                    <td><span class="chip {{ m.status }}">{{ m.status | label: mStatuses }}</span></td>
                    <td>
                      @if (m.approved_at) {
                        {{ m.approver?.full_name }}, {{ m.approved_at | date: 'd MMM' }}
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" class="empty">No measurement recorded yet.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (finalM(); as m) {
            <div class="row confirm">
              <a mat-flat-button [href]="confirmLink()" target="_blank" rel="noopener">
                <mat-icon>chat</mat-icon> Send final measurement on WhatsApp
              </a>
              @if (p.customer_confirmed_at) {
                <span>
                  <mat-icon inline>check_circle</mat-icon>
                  Customer confirmed on {{ p.customer_confirmed_at | date: 'd MMM y' }}
                </span>
                @if (canEdit) {
                  <button mat-button (click)="setConfirmed(p, false)">Undo</button>
                }
              } @else if (canEdit) {
                <button mat-stroked-button (click)="setConfirmed(p, true)">
                  Customer has confirmed
                </button>
              }
            </div>
          } @else if (measurements().length) {
            <p class="sub">
              A quote can be made once the approver marks a revision as final.
            </p>
          }
        </div>

        <!-- Quotes -->
        <div class="card">
          <div class="row">
            <h2 class="spacer">2. Quotations</h2>
            @if (canQuote && finalM()) {
              <button mat-flat-button (click)="newQuote(p)" [disabled]="busy()">
                <mat-icon>add</mat-icon> New quote from final measurement
              </button>
            }
          </div>
          <div class="table-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Quote no</th>
                  <th>Date</th>
                  <th>Valid until</th>
                  <th class="num">Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @for (q of quotes(); track q.id) {
                  <tr class="link" (click)="router.navigate(['/projects', p.id, 'quotes', q.id])">
                    <td>{{ q.quote_no }}</td>
                    <td>{{ q.created_at | date: 'd MMM y' }}</td>
                    <td>{{ q.valid_until | date: 'd MMM y' }}</td>
                    <td class="num">{{ q.total | inr }}</td>
                    <td><span class="chip {{ q.status }}">{{ q.status | label: qStatuses }}</span></td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="empty">No quotation yet.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Payments -->
        <div class="card">
          <div class="row">
            <h2 class="spacer">3. Payments</h2>
            @if (canPay) {
              <button mat-flat-button (click)="addPayment()">
                <mat-icon>add</mat-icon> Record payment
              </button>
            }
          </div>
          @if (balance(); as b) {
            <div class="row totals">
              <div><span class="sub">Quote total</span><br />Rs. {{ b.quote_total | inr }}</div>
              <div><span class="sub">Received</span><br />Rs. {{ b.paid | inr }}</div>
              <div><span class="sub">Balance</span><br /><strong>Rs. {{ b.balance | inr }}</strong></div>
            </div>
          }
          <div class="table-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Mode</th>
                  <th>Reference</th>
                  <th class="num">Amount</th>
                  <th>Confirmation to customer</th>
                </tr>
              </thead>
              <tbody>
                @for (pay of payments(); track pay.id) {
                  <tr>
                    <td>{{ pay.received_on | date: 'd MMM y' }}</td>
                    <td>{{ pay.kind | label: kinds }}</td>
                    <td>{{ pay.mode | label: modes }}</td>
                    <td>{{ pay.reference }}</td>
                    <td class="num">{{ pay.amount | inr }}</td>
                    <td>
                      <a [href]="receiptWa(pay)" target="_blank" rel="noopener" (click)="markSent(pay)">WhatsApp</a>
                      @if (p.customers?.email) {
                        · <a [href]="receiptMail(pay)" (click)="markSent(pay)">Email</a>
                      }
                      @if (pay.confirmation_sent_at) {
                        <span class="sub"> · sent {{ pay.confirmation_sent_at | date: 'd MMM' }}</span>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" class="empty">No payment received yet.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <h2>Files</h2>
          <app-attachments [projectId]="p.id" [readonly]="!canEdit" />
        </div>
      </div>
    }
  `,
  styles: `
    .confirm {
      margin-top: 16px;
    }
    .totals {
      gap: 32px;
      margin-bottom: 12px;
    }
    h1 .chip {
      vertical-align: middle;
    }
  `,
})
export class ProjectDetail {
  private readonly sb = inject(Supabase);
  private readonly auth = inject(Auth);
  private readonly dialog = inject(MatDialog);
  protected readonly router = inject(Router);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;

  protected readonly canEdit = this.auth.can('admin', 'approver', 'sales', 'measurement');
  protected readonly canQuote = this.auth.can('admin', 'approver', 'sales');
  protected readonly canPay = this.auth.can('admin', 'accounts');

  protected readonly statuses = PROJECT_STATUSES;
  protected readonly segments = SEGMENTS;
  protected readonly mStatuses = MEASUREMENT_STATUSES;
  protected readonly qStatuses = QUOTE_STATUSES;
  protected readonly kinds = PAYMENT_KINDS;
  protected readonly modes = PAYMENT_MODES;

  protected readonly project = signal<Project | null>(null);
  protected readonly measurements = signal<Measurement[]>([]);
  protected readonly quotes = signal<Quote[]>([]);
  protected readonly payments = signal<Payment[]>([]);
  protected readonly balance = signal<Balance | null>(null);
  protected readonly busy = signal(false);
  private readonly settings = signal<Settings | null>(null);
  private readonly products = signal<Product[]>([]);

  protected readonly finalM = computed(() => this.measurements().find((m) => m.status === 'final') ?? null);

  /** WhatsApp link carrying the final measurement for the customer to confirm. */
  protected readonly confirmLink = computed(() => {
    const p = this.project();
    const m = this.finalM();
    const s = this.settings();
    if (!p || !m || !s || !p.customers) return '';
    const unit = labelOf(MEASURE_UNITS, m.unit).toLowerCase();
    const items = (m.measurement_items ?? [])
      .slice()
      .sort((a, b) => a.sort - b.sort)
      .map((i, n) => {
        const product = this.products().find((x) => x.id === i.product_id)?.name;
        const parts = [
          [i.position, product].filter(Boolean).join(' - '),
          `${i.width} x ${i.height} ${unit} (W x H)`,
          `Qty ${i.qty}`,
          i.operation,
          i.finish,
        ].filter(Boolean);
        return `${n + 1}. ${parts.join(', ')}`;
      })
      .join('\n');
    return waLink(
      p.customers.phone,
      fillTemplate(s.msg_measurement, {
        name: p.customers.name,
        ref: p.ref_no,
        revision: m.revision_no,
        items,
        company: s.company_name,
      }),
    );
  });

  constructor() {
    void this.load();
    void this.sb.settings().then((s) => this.settings.set(s));
    void this.sb
      .run<Product[]>(this.sb.client.from('products').select('*'))
      .then((rows) => this.products.set(rows));
  }

  private async load(): Promise<void> {
    const db = this.sb.client;
    const [project, measurements, quotes, payments, balance] = await Promise.all([
      this.sb.run<Project>(db.from('projects').select('*, customers(*)').eq('id', this.id).single()),
      this.sb.run<Measurement[]>(
        db
          .from('measurements')
          .select('*, measurement_items(*), measurer:profiles!measured_by(full_name), approver:profiles!approved_by(full_name)')
          .eq('project_id', this.id)
          .order('revision_no', { ascending: false }),
      ),
      this.sb.run<Quote[]>(
        db.from('quotes').select('*').eq('project_id', this.id).order('created_at', { ascending: false }),
      ),
      this.sb.run<Payment[]>(db.from('payments').select('*').eq('project_id', this.id).order('received_on')),
      this.sb.run<Balance | null>(db.from('project_balances').select('*').eq('project_id', this.id).maybeSingle()),
    ]);
    this.project.set(project);
    this.measurements.set(measurements);
    this.quotes.set(quotes);
    this.payments.set(payments);
    this.balance.set(balance);
  }

  protected hello(p: Project): string {
    return waLink(p.customers?.phone ?? '', `Hello ${p.customers?.name ?? ''}, regarding your order ${p.ref_no}: `);
  }

  private async update(patch: Partial<Project>, done: string): Promise<void> {
    await this.sb.run(this.sb.client.from('projects').update(patch).eq('id', this.id));
    this.sb.info(done);
    await this.load();
  }

  protected saveSite(p: Project): Promise<void> {
    return this.update({ site_address: p.site_address || null, map_url: p.map_url || null }, 'Site details saved');
  }

  protected setStatus(p: Project, status: string): Promise<void> {
    if (status === 'cancelled' && !confirm(`Cancel project ${p.ref_no}?`)) return Promise.resolve();
    return this.update({ status }, status === 'cancelled' ? 'Project cancelled' : 'Project reopened');
  }

  protected setConfirmed(p: Project, yes: boolean): Promise<void> {
    return this.update(
      { customer_confirmed_at: yes ? new Date().toISOString() : null },
      yes ? 'Marked as confirmed by the customer' : 'Confirmation removed',
    );
  }

  protected async newRevision(): Promise<void> {
    this.busy.set(true);
    try {
      const latest = this.measurements()[0];
      const id = await this.sb.run<string>(
        this.sb.client.rpc('new_revision', { p_project: this.id, p_from: latest?.id ?? null }),
      );
      await this.router.navigate(['/projects', this.id, 'measurements', id]);
    } finally {
      this.busy.set(false);
    }
  }

  /** Starts a draft quote with one line per measured opening, priced from the rate list. */
  protected async newQuote(p: Project): Promise<void> {
    const m = this.finalM();
    const s = this.settings();
    if (!m || !s) return;
    this.busy.set(true);
    try {
      const unit = labelOf(MEASURE_UNITS, m.unit).toLowerCase();
      const lines = (m.measurement_items ?? [])
        .slice()
        .sort((a, b) => a.sort - b.sort)
        .map((i, sort) => {
          const product = this.products().find((x) => x.id === i.product_id);
          const productUnit = product?.unit ?? 'nos';
          const qty = billingQty(i, m.unit, productUnit);
          const rate = product?.rate ?? 0;
          const size = `${i.width} x ${i.height} ${unit}` + (i.qty > 1 ? ` x ${i.qty} nos` : '');
          const description = [product?.name, i.position, size, i.operation, i.material, i.finish]
            .filter(Boolean)
            .join(', ');
          return {
            product_id: i.product_id,
            description,
            qty,
            unit: productUnit,
            rate,
            amount: round2(qty * rate),
            sort,
          };
        });
      const gst = 18;
      const totals = quoteTotals(lines, 0, gst);
      const quote = await this.sb.run<Quote>(
        this.sb.client
          .from('quotes')
          .insert({
            project_id: p.id,
            measurement_id: m.id,
            subtotal: totals.subtotal,
            gst_percent: gst,
            gst_amount: totals.gst_amount,
            total: totals.total,
            terms: s.quote_terms,
            valid_until: addDays(today(), s.quote_validity_days),
          })
          .select()
          .single(),
      );
      if (lines.length) {
        await this.sb.run(
          this.sb.client.from('quote_items').insert(lines.map((l) => ({ ...l, quote_id: quote.id }))),
        );
      }
      await this.router.navigate(['/projects', p.id, 'quotes', quote.id]);
    } finally {
      this.busy.set(false);
    }
  }

  protected addPayment(): void {
    const data: PaymentDialogData = {
      projectId: this.id,
      firstPayment: !this.payments().some((x) => x.kind === 'advance'),
      balance: this.balance()?.balance ?? 0,
    };
    this.dialog
      .open(PaymentDialog, { data })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.sb.info('Payment recorded. Send the confirmation to the customer from the list.');
          void this.load();
        }
      });
  }

  private receiptText(pay: Payment): string {
    const p = this.project();
    const s = this.settings();
    if (!p || !s) return '';
    return fillTemplate(s.msg_receipt, {
      name: p.customers?.name ?? '',
      amount: money(pay.amount),
      mode: labelOf(PAYMENT_MODES, pay.mode).toLowerCase(),
      date: pay.received_on,
      ref: p.ref_no,
      balance: money(this.balance()?.balance ?? 0),
      company: s.company_name,
    });
  }

  protected receiptWa(pay: Payment): string {
    return waLink(this.project()?.customers?.phone ?? '', this.receiptText(pay));
  }

  protected receiptMail(pay: Payment): string {
    const p = this.project();
    return mailLink(p?.customers?.email ?? '', `Payment received - ${p?.ref_no ?? ''}`, this.receiptText(pay));
  }

  /** Runs alongside the link opening; it only records when the confirmation went out. */
  protected markSent(pay: Payment): void {
    if (pay.confirmation_sent_at || !this.canPay) return;
    const at = new Date().toISOString();
    void this.sb
      .run(this.sb.client.from('payments').update({ confirmation_sent_at: at }).eq('id', pay.id))
      .then(() =>
        this.payments.update((list) =>
          list.map((x) => (x.id === pay.id ? { ...x, confirmation_sent_at: at } : x)),
        ),
      );
  }
}
