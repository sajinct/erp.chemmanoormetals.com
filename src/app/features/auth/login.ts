import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../core/auth';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-login',
  imports: [UI],
  template: `
    <div class="wrap">
      <form class="card box" (ngSubmit)="submit()">
        <img class="logo" src="logo.jpg" width="382" height="70" alt="Chemmanoor Metals — trusted protection" />
        <div class="eyebrow"><span class="line"></span>{{ mode() === 'in' ? 'Staff sign in' : 'Request access' }}</div>
        <h1>{{ mode() === 'in' ? 'Welcome back.' : 'Join the team workspace.' }}</h1>

        @if (auth.signedIn() && !auth.active()) {
          <p>
            Your account is waiting for approval. Ask an admin to activate it in
            Settings, then sign in again.
          </p>
          <button mat-stroked-button type="button" (click)="auth.signOut()">Use another account</button>
        } @else {
          @if (mode() === 'up') {
            <mat-form-field>
              <mat-label>Full name</mat-label>
              <input matInput name="name" [(ngModel)]="name" required />
            </mat-form-field>
          }
          <mat-form-field>
            <mat-label>Email</mat-label>
            <input matInput type="email" name="email" [(ngModel)]="email" required autocomplete="username" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Password</mat-label>
            <input
              matInput
              type="password"
              name="password"
              [(ngModel)]="password"
              required
              minlength="6"
              [autocomplete]="mode() === 'in' ? 'current-password' : 'new-password'"
            />
          </mat-form-field>
          @if (message()) {
            <p class="error-text">{{ message() }}</p>
          }
          <button mat-flat-button type="submit" [disabled]="busy()">
            {{ mode() === 'in' ? 'Sign in' : 'Create account' }}
          </button>
          <button mat-button type="button" (click)="toggle()">
            {{ mode() === 'in' ? 'New here? Request access' : 'Have an account? Sign in' }}
          </button>
        }
      </form>
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
      width: min(420px, 100%);
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 32px;
      margin: 0;
    }
    .logo {
      width: 225px;
      max-width: 100%;
      height: auto;
      margin-bottom: 28px;
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
      margin: 10px 0 22px;
      font-size: 30px;
      font-weight: 600;
      line-height: 1.12;
      letter-spacing: -0.045em;
    }
    p {
      margin: 0 0 12px;
    }
    .box button[type='submit'] {
      min-height: 48px;
      margin-bottom: 4px;
    }
    .tagline {
      margin: 0;
      font-size: 12px;
      letter-spacing: 0.025em;
      color: #686c63;
    }
  `,
})
export class Login {
  protected readonly auth = inject(Auth);
  private readonly router = inject(Router);

  protected readonly mode = signal<'in' | 'up'>('in');
  protected readonly busy = signal(false);
  protected readonly message = signal('');
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
  }

  protected async submit(): Promise<void> {
    if (!this.email || !this.password || (this.mode() === 'up' && !this.name)) {
      this.message.set('Please fill in every field.');
      return;
    }
    this.busy.set(true);
    this.message.set('');
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
