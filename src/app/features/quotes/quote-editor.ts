import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Auth } from '../../core/auth';
import { Product, Project, QUOTE_STATUSES, Quote, QuoteItem, Settings, UNITS } from '../../core/models';
import { BUCKET, Supabase } from '../../core/supabase';
import { downloadBlob } from '../../shared/excel';
import { environment } from '../../../environments/environment';
import { fillTemplate, mailLink, money, quoteShareLink, shareCode, waLink } from '../../shared/messaging';
import { bankLines, pdfBlob, quoteDocument } from '../../shared/pdf';
import { Totals, quoteTotals, round2 } from '../../shared/quote-calc';
import { UI } from '../../shared/ui';

const DAY_MS = 24 * 60 * 60 * 1000;
/** How long a link sent to a customer keeps working. */
const SHARE_DAYS = 30;

/**
 * A quotation. While it is a draft the lines can be edited; issuing it stores
 * the PDF and unlocks the WhatsApp and email send links.
 */
@Component({
  selector: 'app-quote-editor',
  imports: [UI],
  template: `
    @if (quote(); as q) {
      <div class="page">
        <div class="page-head">
          <h1>
            <a [routerLink]="['/projects', projectId]">{{ project()?.ref_no }}</a>
            · Quotation {{ q.quote_no }}
            <span class="chip {{ q.status }}">{{ q.status | label: statuses }}</span>
          </h1>
          <button mat-stroked-button (click)="download()" [disabled]="busy()">
            <mat-icon>picture_as_pdf</mat-icon> PDF
          </button>
          @if (canEdit) {
            @if (q.status === 'draft') {
              <button mat-stroked-button (click)="save()" [disabled]="busy()">Save draft</button>
              <button mat-flat-button (click)="issue()" [disabled]="busy()">
                <mat-icon>task_alt</mat-icon> Save and issue
              </button>
            } @else {
              @if (q.status === 'sent') {
                <button mat-flat-button (click)="setStatus('accepted')" [disabled]="busy()">
                  Customer accepted
                </button>
                <button mat-stroked-button (click)="setStatus('rejected')" [disabled]="busy()">
                  Rejected
                </button>
              }
              <button mat-button (click)="setStatus('draft')" [disabled]="busy()">Revise (back to draft)</button>
            }
          }
        </div>

        @if (q.status !== 'draft') {
          <div class="card">
            <h2>Send to customer</h2>
            <div class="row">
              <a mat-flat-button [href]="waHref()" target="_blank" rel="noopener">
                <mat-icon>chat</mat-icon> WhatsApp
              </a>
              @if (project()?.customers?.email) {
                <a mat-stroked-button [href]="mailHref()"><mat-icon>mail</mat-icon> Email</a>
              }
              <span class="sub">
                The message carries a short link to the PDF (it works for 30 days) and the bank details for the advance.
              </span>
            </div>
          </div>
        }

        <div class="card">
          <h2>Items</h2>
          <div class="table-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Rate</th>
                  <th class="num">Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (i of items(); track $index) {
                  <tr>
                    <td>{{ $index + 1 }}</td>
                    <td class="wrap"><input [(ngModel)]="i.description" [disabled]="!editable()" /></td>
                    <td><input class="narrow" type="number" min="0" step="0.01" [(ngModel)]="i.qty" [disabled]="!editable()" /></td>
                    <td>
                      <select [(ngModel)]="i.unit" [disabled]="!editable()">
                        @for (u of units; track u.value) {
                          <option [ngValue]="u.value">{{ u.label }}</option>
                        }
                      </select>
                    </td>
                    <td><input class="narrow" type="number" min="0" step="0.01" [(ngModel)]="i.rate" [disabled]="!editable()" /></td>
                    <td class="num">{{ amount(i) | inr }}</td>
                    <td>
                      @if (editable()) {
                        <button mat-icon-button (click)="removeItem($index)" aria-label="Remove line">
                          <mat-icon>delete</mat-icon>
                        </button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" class="empty">No lines yet.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (editable()) {
            <div class="row add">
              <select #pick class="picker" (change)="addItem(pick.value); pick.value = ''">
                <option value="">+ Add line from rate list…</option>
                <option value="blank">Blank line</option>
                @for (p of products(); track p.id) {
                  <option [value]="p.id">{{ p.name }} ({{ p.rate | inr }} / {{ p.unit | label: units }})</option>
                }
              </select>
            </div>
          }

          @let t = totals();
          <div class="sums">
            <div><span>Subtotal</span><span>{{ t.subtotal | inr }}</span></div>
            <div>
              <span>Discount (Rs.)</span>
              <input class="narrow" type="number" min="0" step="0.01" [(ngModel)]="q.discount" [disabled]="!editable()" />
            </div>
            <div><span>Taxable value</span><span>{{ t.taxable | inr }}</span></div>
            <div>
              <span>GST %</span>
              <input class="narrow" type="number" min="0" step="0.01" [(ngModel)]="q.gst_percent" [disabled]="!editable()" />
            </div>
            <div><span>GST</span><span>{{ t.gst_amount | inr }}</span></div>
            <div class="grand"><span>Total (Rs.)</span><span>{{ t.total | inr }}</span></div>
          </div>
        </div>

        <div class="card">
          <div class="form-grid">
            <mat-form-field>
              <mat-label>Valid until</mat-label>
              <input matInput type="date" [(ngModel)]="q.valid_until" [disabled]="!editable()" />
            </mat-form-field>
            <mat-form-field class="wide">
              <mat-label>Terms and conditions</mat-label>
              <textarea matInput rows="5" [(ngModel)]="q.terms" [disabled]="!editable()"></textarea>
            </mat-form-field>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .add {
      margin-top: 12px;
    }
    .picker {
      font: inherit;
      padding: 8px;
      border-radius: 8px;
      border: 1px solid var(--mat-sys-outline);
      background: var(--mat-sys-surface);
      color: inherit;
      max-width: 100%;
    }
    .sums {
      margin: 16px 0 0 auto;
      width: min(320px, 100%);
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-variant-numeric: tabular-nums;
    }
    .sums div {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .sums input {
      width: 110px;
      text-align: right;
      font: inherit;
      padding: 6px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 6px;
    }
    .grand {
      font-size: 18px;
      font-weight: 500;
      border-top: 1px solid var(--mat-sys-outline);
      padding-top: 8px;
    }
    h1 .chip {
      vertical-align: middle;
    }
  `,
})
export class QuoteEditor {
  private readonly sb = inject(Supabase);
  private readonly route = inject(ActivatedRoute).snapshot;
  protected readonly projectId = this.route.paramMap.get('id')!;
  private readonly id = this.route.paramMap.get('qid')!;

  protected readonly canEdit = inject(Auth).can('admin', 'approver', 'sales');
  protected readonly statuses = QUOTE_STATUSES;
  protected readonly units = UNITS;

  protected readonly quote = signal<Quote | null>(null);
  protected readonly items = signal<QuoteItem[]>([]);
  protected readonly project = signal<Project | null>(null);
  protected readonly products = signal<Product[]>([]);
  protected readonly busy = signal(false);
  /** Short link to the stored PDF; empty until the quote has been issued. */
  protected readonly pdfUrl = signal('');
  private readonly settings = signal<Settings | null>(null);

  constructor() {
    const db = this.sb.client;
    void this.load();
    void this.sb.settings().then((s) => this.settings.set(s));
    void this.sb
      .run<Project>(db.from('projects').select('*, customers(*)').eq('id', this.projectId).single())
      .then((p) => this.project.set(p));
    void this.sb
      .run<Product[]>(db.from('products').select('*').eq('active', true).order('category').order('name'))
      .then((rows) => this.products.set(rows));
  }

  private async load(): Promise<void> {
    const q = await this.sb.run<Quote>(
      this.sb.client.from('quotes').select('*, quote_items(*)').eq('id', this.id).single(),
    );
    this.items.set((q.quote_items ?? []).slice().sort((a, b) => a.sort - b.sort));
    this.quote.set(q);
    this.pdfUrl.set(q.pdf_path && q.status !== 'draft' ? await this.shareLink(q) : '');
  }

  /**
   * The short link for an issued quote. The storage link behind it lasts 30
   * days, so it is renewed here whenever it is missing or within a week of
   * expiring; the code, and so the link already sent, stays the same.
   */
  private async shareLink(q: Quote): Promise<string> {
    const weekAhead = Date.now() + 7 * DAY_MS;
    const fresh = q.share_code && q.share_expires_at && Date.parse(q.share_expires_at) > weekAhead;
    if (fresh) return quoteShareLink(environment.appUrl, q.share_code!);
    // Staff who cannot edit quotes cannot renew the link; fall back to what exists.
    if (!this.canEdit) {
      return q.share_code ? quoteShareLink(environment.appUrl, q.share_code) : this.sb.signedUrl(q.pdf_path!);
    }
    const share = await this.newShare(q.pdf_path!, q.share_code);
    await this.sb.run(this.sb.client.from('quotes').update(share).eq('id', q.id));
    return quoteShareLink(environment.appUrl, share.share_code);
  }

  private async newShare(path: string, existingCode: string | null) {
    return {
      share_code: existingCode ?? shareCode(),
      share_url: await this.sb.signedUrl(path, (SHARE_DAYS * DAY_MS) / 1000),
      share_expires_at: new Date(Date.now() + SHARE_DAYS * DAY_MS).toISOString(),
    };
  }

  protected editable(): boolean {
    return this.canEdit && this.quote()?.status === 'draft';
  }

  protected amount(i: QuoteItem): number {
    return round2((Number(i.qty) || 0) * (Number(i.rate) || 0));
  }

  protected totals(): Totals {
    const q = this.quote();
    return quoteTotals(this.items(), q?.discount ?? 0, q?.gst_percent ?? 0);
  }

  protected addItem(choice: string): void {
    if (!choice) return;
    const product = this.products().find((p) => p.id === choice);
    this.items.update((list) => [
      ...list,
      {
        product_id: product?.id ?? null,
        description: product?.name ?? '',
        qty: 1,
        unit: product?.unit ?? 'nos',
        rate: product?.rate ?? 0,
        amount: product?.rate ?? 0,
        sort: list.length,
      },
    ]);
  }

  protected removeItem(index: number): void {
    this.items.update((list) => list.filter((_, i) => i !== index));
  }

  /** Writes the header, totals and lines. Returns the saved quote as it should appear on the PDF. */
  private async persist(): Promise<{ quote: Quote; items: QuoteItem[] }> {
    const q = this.quote()!;
    const t = this.totals();
    const db = this.sb.client;
    const items = this.items().map((i, sort) => ({
      quote_id: q.id,
      product_id: i.product_id,
      description: i.description,
      qty: Number(i.qty) || 0,
      unit: i.unit,
      rate: Number(i.rate) || 0,
      amount: this.amount(i),
      sort,
    }));
    const header = {
      subtotal: t.subtotal,
      discount: t.discount,
      gst_percent: Number(q.gst_percent) || 0,
      gst_amount: t.gst_amount,
      total: t.total,
      terms: q.terms || null,
      valid_until: q.valid_until || null,
    };
    await this.sb.run(db.from('quotes').update(header).eq('id', q.id));
    await this.sb.run(db.from('quote_items').delete().eq('quote_id', q.id));
    if (items.length) await this.sb.run(db.from('quote_items').insert(items));
    return { quote: { ...q, ...header }, items };
  }

  protected async save(): Promise<void> {
    this.busy.set(true);
    try {
      await this.persist();
      this.sb.info('Draft saved');
      await this.load();
    } finally {
      this.busy.set(false);
    }
  }

  private async buildPdf(quote: Quote, items: QuoteItem[]): Promise<Blob> {
    const project = this.project();
    const settings = this.settings();
    if (!project?.customers || !settings) throw new Error('Still loading; try again in a moment.');
    return pdfBlob(quoteDocument(settings, project, project.customers, quote, items));
  }

  protected async download(): Promise<void> {
    const q = this.quote();
    if (!q) return;
    this.busy.set(true);
    try {
      const current = this.editable() ? await this.persist() : { quote: q, items: this.items() };
      downloadBlob(await this.buildPdf(current.quote, current.items), `${q.quote_no}.pdf`);
    } catch (e) {
      this.sb.error((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  /** Saves, stores the PDF and marks the quote as sent so it can be shared. */
  protected async issue(): Promise<void> {
    if (!this.items().length) {
      this.sb.error('Add at least one line before issuing the quote.');
      return;
    }
    this.busy.set(true);
    try {
      const { quote, items } = await this.persist();
      const blob = await this.buildPdf(quote, items);
      const path = `${this.projectId}/quotes/${quote.quote_no}-${Date.now()}.pdf`;
      const { error } = await this.sb.client.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: 'application/pdf' });
      if (error) throw new Error(error.message);
      const share = await this.newShare(path, quote.share_code);
      await this.sb.run(
        this.sb.client
          .from('quotes')
          .update({ status: 'sent', pdf_path: path, ...share })
          .eq('id', quote.id),
      );
      this.sb.info('Quote issued. Send it to the customer with the buttons above.');
      await this.load();
    } catch (e) {
      this.sb.error((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected async setStatus(status: Quote['status']): Promise<void> {
    this.busy.set(true);
    try {
      await this.sb.run(this.sb.client.from('quotes').update({ status }).eq('id', this.id));
      await this.load();
    } finally {
      this.busy.set(false);
    }
  }

  private messageText(): string {
    const q = this.quote();
    const p = this.project();
    const s = this.settings();
    if (!q || !p || !s) return '';
    return fillTemplate(s.msg_quote, {
      name: p.customers?.name ?? '',
      quote_no: q.quote_no,
      ref: p.ref_no,
      total: money(q.total),
      valid_until: q.valid_until ?? '',
      link: this.pdfUrl(),
      bank: bankLines(s).join('\n'),
      company: s.company_name,
    });
  }

  protected waHref(): string {
    return waLink(this.project()?.customers?.phone ?? '', this.messageText());
  }

  protected mailHref(): string {
    const q = this.quote();
    return mailLink(
      this.project()?.customers?.email ?? '',
      `Quotation ${q?.quote_no ?? ''} - Chemmanoor Metals`,
      this.messageText(),
    );
  }
}
