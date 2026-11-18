import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute } from '@angular/router';
import { Supabase } from '../../core/supabase';

/**
 * Public page behind the short link sent to customers (/?q=CODE). It looks up
 * the quotation PDF for the code and forwards the browser to it. No sign-in.
 */
@Component({
  selector: 'app-quote-link',
  imports: [MatButtonModule],
  template: `
    <div class="wrap">
      <div class="card box">
        <img class="logo" src="logo.jpg" width="382" height="70" alt="Chemmanoor Metals — trusted protection" />
        @switch (state()) {
          @case ('loading') {
            <h1>Opening your quotation…</h1>
          }
          @case ('ready') {
            <h1>Your quotation is ready.</h1>
            <p>If it did not open by itself, use the button below.</p>
            <a mat-flat-button [href]="url()">Open quotation (PDF)</a>
          }
          @case ('missing') {
            <h1>This link is no longer active.</h1>
            <p>
              The quotation may have been updated, or the link has expired. Please ask us for a
              fresh copy.
            </p>
            <a mat-flat-button href="https://wa.me/919747070066">Message us on WhatsApp</a>
            <a mat-button href="tel:+919747070066">Call +91 97470 70066</a>
          }
          @case ('error') {
            <h1>We could not open the quotation.</h1>
            <p>Please check your internet connection and try again.</p>
            <button mat-flat-button (click)="open()">Try again</button>
          }
        }
      </div>
      <p class="tagline">Trusted protection. Since 1975.</p>
    </div>
  `,
  styles: `
    .wrap {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 18px;
      padding: 16px;
      box-sizing: border-box;
      border-top: 35px solid var(--brand-ink);
      background: var(--brand-soft);
    }
    .box {
      width: min(440px, 100%);
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 32px;
      margin: 0;
    }
    .logo {
      width: 225px;
      max-width: 100%;
      height: auto;
      margin-bottom: 24px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 26px;
      font-weight: 600;
      line-height: 1.15;
      letter-spacing: -0.04em;
    }
    p {
      margin: 0 0 12px;
      color: #656a65;
    }
    .tagline {
      margin: 0;
      font-size: 12px;
      color: #686c63;
    }
  `,
})
export class QuoteLink {
  private readonly sb = inject(Supabase);
  private readonly code = inject(ActivatedRoute).snapshot.paramMap.get('code') ?? '';

  protected readonly state = signal<'loading' | 'ready' | 'missing' | 'error'>('loading');
  protected readonly url = signal('');

  constructor() {
    void this.open();
  }

  protected async open(): Promise<void> {
    this.state.set('loading');
    const { data, error } = await this.sb.client.rpc('quote_link', { p_code: this.code });
    if (error) {
      this.state.set('error');
    } else if (typeof data === 'string' && data) {
      this.url.set(data);
      this.state.set('ready');
      // replace() so the Back button does not return to this forwarding page.
      window.location.replace(data);
    } else {
      this.state.set('missing');
    }
  }
}
