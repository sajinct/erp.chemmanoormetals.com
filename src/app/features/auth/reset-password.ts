import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../core/auth';
import { PASSWORD_MAX, PASSWORD_MIN, passwordChoiceProblem } from '../../core/password';
import { Supabase } from '../../core/supabase';
import { UI } from '../../shared/ui';

/**
 * Where a "reset your password" email link lands. The link signs the person
 * in; this page makes them choose a new password before using the workspace.
 */
@Component({
  selector: 'app-reset-password',
  imports: [UI],
  template: `
    <div class="wrap">
      <form class="card box" (ngSubmit)="save()">
        <img
          class="logo"
          src="logo.jpg"
          width="382"
          height="70"
          alt="Chemmanoor Metals — trusted protection"
        />
        @switch (state()) {
          @case ('loading') {
            <h1>Checking your link…</h1>
          }
          @case ('expired') {
            <h1>This reset link can’t be used.</h1>
            <p>It has expired or was already used. Request a new one from the sign-in page.</p>
            <a mat-flat-button routerLink="/login">Go to sign in</a>
          }
          @case ('ready') {
            <h1>Choose a new password.</h1>
            <p>For {{ auth.profile()?.email || 'your account' }}.</p>
            <input
              class="username"
              type="email"
              name="username"
              autocomplete="username"
              [value]="auth.profile()?.email || ''"
              readonly
              tabindex="-1"
              aria-hidden="true"
            />
            <mat-form-field subscriptSizing="dynamic">
              <mat-label>New password</mat-label>
              <input
                matInput
                name="next"
                [(ngModel)]="next"
                [type]="show() ? 'text' : 'password'"
                required
                [maxlength]="max"
                autocomplete="new-password"
              />
              <mat-hint>At least {{ min }} characters. A few unrelated words work well.</mat-hint>
            </mat-form-field>
            <mat-form-field subscriptSizing="dynamic">
              <mat-label>Repeat new password</mat-label>
              <input
                matInput
                name="confirm"
                [(ngModel)]="confirm"
                [type]="show() ? 'text' : 'password'"
                required
                [maxlength]="max"
                autocomplete="new-password"
              />
            </mat-form-field>
            <button
              mat-button
              type="button"
              class="toggle"
              (click)="show.set(!show())"
              [attr.aria-pressed]="show()"
            >
              <mat-icon>{{ show() ? 'visibility_off' : 'visibility' }}</mat-icon>
              {{ show() ? 'Hide passwords' : 'Show passwords' }}
            </button>
            @if (message()) {
              <p class="error-text" role="alert">{{ message() }}</p>
            }
            <button mat-flat-button type="submit" [disabled]="busy()">
              {{ busy() ? 'Saving…' : 'Save password and continue' }}
            </button>
            <button mat-button type="button" (click)="cancel()" [disabled]="busy()">
              Cancel and sign out
            </button>
          }
        }
      </form>
    </div>
  `,
  styles: `
    .wrap {
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      box-sizing: border-box;
      background: var(--brand-soft);
    }
    .box {
      width: min(440px, 100%);
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 32px;
      margin: 0;
    }
    .logo {
      width: 225px;
      max-width: 100%;
      height: auto;
      margin-bottom: 8px;
    }
    h1 {
      margin: 0;
      font-size: 26px;
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.04em;
    }
    p {
      margin: 0;
      color: var(--text-muted);
    }
    .toggle {
      align-self: flex-start;
    }
    .box button[type='submit'] {
      min-height: 48px;
    }
    /* Present for password managers, not for people. */
    .username {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    }
  `,
})
export class ResetPassword {
  protected readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly sb = inject(Supabase);

  protected readonly state = signal<'loading' | 'expired' | 'ready'>('loading');
  protected readonly min = PASSWORD_MIN;
  protected readonly max = PASSWORD_MAX;
  protected readonly busy = signal(false);
  protected readonly show = signal(false);
  protected readonly message = signal('');
  protected next = '';
  protected confirm = '';

  constructor() {
    // The link signs the person in; without that there is nothing to reset.
    void this.auth
      .init()
      .then(() =>
        this.state.set(this.auth.signedIn() && this.auth.recovering() ? 'ready' : 'expired'),
      );
  }

  protected async save(): Promise<void> {
    if (this.busy() || this.state() !== 'ready') return;
    const problem = passwordChoiceProblem(this.next, this.confirm);
    if (problem) {
      this.message.set(problem);
      return;
    }
    this.busy.set(true);
    this.message.set('');
    try {
      const error = await this.auth.completeRecovery(this.next);
      if (error) {
        this.message.set(error);
        return;
      }
      this.next = this.confirm = '';
      this.sb.info('Password saved.');
      // An account that is not activated yet lands on the sign-in page, which explains why.
      await this.router.navigateByUrl('/');
    } catch {
      this.message.set('Could not reach the server. Check the connection and try again.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async cancel(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
