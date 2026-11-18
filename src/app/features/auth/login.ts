import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../core/auth';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-login',
  imports: [UI],
  template: `
    <div class="wrap">
      <aside class="intro">
        <a class="intro-brand" href="https://chemmanoormetals.com" target="_blank" rel="noopener"
          ><img src="logo.jpg" width="382" height="70" alt="Chemmanoor Metals"
        /></a>
        <div class="intro-content">
          <div class="eyebrow">Chemmanoor Metals ERP</div>
          <h2>Good work starts<br />with a clear view.</h2>
          <p>One workspace for every enquiry, every project and every customer.</p>
          <div class="workflow" aria-label="Your sales workflow">
            <div>
              <span>01</span><mat-icon>filter_alt</mat-icon><strong>Connect</strong
              ><small>Capture every opportunity</small>
            </div>
            <div>
              <span>02</span><mat-icon>straighten</mat-icon><strong>Plan</strong
              ><small>Measure and quote with clarity</small>
            </div>
            <div>
              <span>03</span><mat-icon>task_alt</mat-icon><strong>Deliver</strong
              ><small>Keep projects moving forward</small>
            </div>
          </div>
        </div>
        <div class="intro-footer">
          <span class="heritage">Since 1975</span
          ><span>Trusted protection. Lasting relationships.</span>
        </div>
      </aside>
      <section class="login-panel">
        <form class="box" #form="ngForm" (ngSubmit)="form.valid && submit()">
          <img
            class="logo"
            src="logo.jpg"
            width="382"
            height="70"
            alt="Chemmanoor Metals — trusted protection"
          />
          <div class="eyebrow">
            <span class="line"></span>{{ mode() === 'in' ? 'Staff sign in' : 'Request access' }}
          </div>
          <h1>{{ mode() === 'in' ? 'Welcome back.' : 'Join the workspace.' }}</h1>
          <p class="description">
            {{
              mode() === 'in'
                ? 'Sign in to keep your business moving.'
                : 'Request an account to work with your team.'
            }}
          </p>

          @if (auth.signedIn() && !auth.active()) {
            <p>
              Your account is waiting for approval. Ask an admin to activate it in Settings, then
              sign in again.
            </p>
            <button mat-stroked-button type="button" (click)="auth.signOut()">
              Use another account
            </button>
          } @else {
            @if (mode() === 'up') {
              <mat-form-field>
                <mat-label>Full name</mat-label>
                <input matInput name="name" [(ngModel)]="name" required autocomplete="name" />
              </mat-form-field>
            }
            <mat-form-field>
              <mat-label>Email</mat-label>
              <input
                matInput
                type="email"
                name="email"
                [(ngModel)]="email"
                required
                autocomplete="username"
              />
            </mat-form-field>
            <mat-form-field>
              <mat-label>Password</mat-label>
              <input
                matInput
                [type]="showPassword() ? 'text' : 'password'"
                name="password"
                [(ngModel)]="password"
                required
                minlength="6"
                [autocomplete]="mode() === 'in' ? 'current-password' : 'new-password'"
              />
              <button
                mat-icon-button
                matSuffix
                type="button"
                (click)="showPassword.set(!showPassword())"
                [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                [attr.aria-pressed]="showPassword()"
              >
                <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              @if (mode() === 'up') {
                <mat-hint>Use at least 6 characters.</mat-hint>
              }
            </mat-form-field>
            @if (message()) {
              <p
                class="message"
                [class.error-text]="!confirmation()"
                [class.success]="confirmation()"
                role="status"
              >
                {{ message() }}
              </p>
            }
            <button mat-flat-button type="submit" [disabled]="busy() || form.invalid">
              {{
                busy()
                  ? 'Please wait…'
                  : mode() === 'in'
                    ? 'Sign in to workspace'
                    : 'Request access'
              }}<mat-icon iconPositionEnd>arrow_forward</mat-icon>
            </button>
            <button mat-button type="button" (click)="toggle()">
              {{ mode() === 'in' ? 'New here? Request access' : 'Have an account? Sign in' }}
            </button>
          }
          <div class="access-note">
            <mat-icon>lock_outline</mat-icon
            ><span
              >For authorised Chemmanoor Metals team members.<br />New accounts require
              administrator approval.</span
            >
          </div>
        </form>
        <p class="tagline">Chemmanoor Metals · Team workspace</p>
      </section>
    </div>
  `,
  styles: `
    .wrap {
      min-height: 100dvh;
      display: grid;
      grid-template-columns: 1fr 1fr;
      background: #fff;
    }
    .box {
      width: min(400px, 100%);
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 0;
      margin: 0;
    }
    .logo {
      width: 225px;
      max-width: 100%;
      height: auto;
      display: none;
    }
    .eyebrow {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .line {
      width: 30px;
      height: 2px;
      background: var(--brand-orange);
    }
    h1 {
      margin: 14px 0 10px;
      font-size: 34px;
      font-weight: 800;
      line-height: 1.12;
      letter-spacing: -0.045em;
    }
    p {
      margin: 0 0 12px;
    }
    .box button[type='submit'] {
      min-height: 48px;
      margin: 8px 0;
    }
    .tagline {
      margin: 0;
      font-size: 12px;
      letter-spacing: 0.025em;
      color: #686c63;
    }
    .intro {
      background: #f2f4f7;
      padding: 40px 48px;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
      border-right: 1px solid var(--brand-line);
    }
    .intro::after {
      content: '';
      width: 420px;
      height: 420px;
      position: absolute;
      right: -280px;
      top: 20%;
      border: 70px solid #ff783c0b;
      border-radius: 50%;
      pointer-events: none;
    }
    .intro-brand {
      align-self: flex-start;
      background: #fff;
      border-radius: 8px;
      padding: 12px 16px;
    }
    .intro-brand img {
      display: block;
      width: 220px;
      height: auto;
    }
    .intro-content {
      margin: auto 0;
      padding: 70px 0;
      max-width: 530px;
      z-index: 1;
    }
    .intro-content .eyebrow {
      color: #a84415;
    }
    .intro h2 {
      font-size: clamp(30px, 3.2vw, 54px);
      font-weight: 800;
      letter-spacing: -0.055em;
      line-height: 1.2;
      margin: 20px 0;
    }
    .intro-content > p {
      max-width: 340px;
      color: #667085;
      font-size: 14px;
      line-height: 1.9;
    }
    .workflow {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin-top: 40px;
    }
    .workflow > div {
      position: relative;
      padding: 22px 14px 18px;
      border: 1px solid #e2e6ed;
      background: #ffffffb3;
      border-radius: 12px;
    }
    .workflow div > span {
      position: absolute;
      right: 10px;
      top: 10px;
      font-size: 10px;
      color: #667085;
    }
    .workflow mat-icon {
      color: #b55322;
      background: #fff0e7;
      padding: 8px;
      width: 20px;
      height: 20px;
      box-sizing: content-box;
      border-radius: 8px;
      font-size: 20px;
      margin-bottom: 20px;
    }
    .workflow strong,
    .workflow small {
      display: block;
    }
    .workflow strong {
      font-size: 12px;
      margin-bottom: 5px;
    }
    .workflow small {
      font-size: 10px;
      color: #667085;
      line-height: 1.7;
    }
    .intro-footer {
      display: flex;
      align-items: center;
      gap: 18px;
      font-size: 10px;
      color: #667085;
    }
    .heritage {
      font-weight: 800;
      color: #344054;
      padding-right: 18px;
      border-right: 1px solid #cdd4de;
    }
    .login-panel {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 50px 40px;
      gap: 48px;
    }
    .description {
      color: #667085;
      font-size: 12px;
      margin-bottom: 30px;
    }
    .access-note {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      padding-top: 25px;
      margin-top: 20px;
      border-top: 1px solid var(--brand-line);
      font-size: 10px;
      color: #667085;
      line-height: 1.8;
    }
    .access-note mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
      margin-top: 3px;
      flex-shrink: 0;
    }
    .message {
      padding: 12px;
      border-radius: 8px;
      background: #fff4ef;
      font-size: 12px;
    }
    .message.success {
      color: #286346;
      background: #edf8f1;
    }
    @media (max-width: 1100px) {
      .intro {
        padding: 32px;
      }
      .workflow {
        gap: 8px;
      }
      .workflow > div {
        padding: 18px 10px;
      }
    }
    @media (max-width: 800px) {
      .wrap {
        grid-template-columns: 1fr;
      }
      .intro {
        display: none;
      }
      .login-panel {
        min-height: 100dvh;
        padding: 40px 24px;
        gap: 36px;
      }
      .logo {
        display: block;
        margin-bottom: 40px;
      }
    }
  `,
})
export class Login {
  protected readonly auth = inject(Auth);
  private readonly router = inject(Router);

  protected readonly mode = signal<'in' | 'up'>('in');
  protected readonly busy = signal(false);
  protected readonly message = signal('');
  protected readonly confirmation = signal(false);
  protected readonly showPassword = signal(false);
  protected name = '';
  protected email = '';
  protected password = '';

  constructor() {
    void this.auth.init().then(() => {
      if (this.auth.active()) void this.router.navigateByUrl('/');
    });
  }

  protected toggle(): void {
    this.mode.update((m) => (m === 'in' ? 'up' : 'in'));
    this.message.set('');
    this.confirmation.set(false);
  }

  protected async submit(): Promise<void> {
    if (this.busy()) return;
    if (!this.email || !this.password || (this.mode() === 'up' && !this.name)) {
      this.message.set('Please fill in every field.');
      return;
    }
    this.busy.set(true);
    this.message.set('');
    this.confirmation.set(false);
    try {
      const error =
        this.mode() === 'in'
          ? await this.auth.signIn(this.email, this.password)
          : await this.auth.signUp(this.email, this.password, this.name);
      if (error) {
        this.message.set(error);
      } else if (this.auth.active()) {
        await this.router.navigateByUrl('/');
      } else if (!this.auth.signedIn()) {
        this.confirmation.set(true);
        this.message.set('Check your email to confirm the address, then sign in.');
        this.mode.set('in');
      }
    } catch {
      this.message.set('Could not reach the server. Check the connection and try again.');
    } finally {
      this.busy.set(false);
    }
  }
}
