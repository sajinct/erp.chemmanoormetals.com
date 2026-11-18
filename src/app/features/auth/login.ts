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
        <h1>Chemmanoor Metals</h1>
        <p class="sub">{{ mode() === 'in' ? 'Sign in to the ERP' : 'Request access' }}</p>

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
    </div>
  `,
  styles: `
    .wrap {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 16px;
    }
    .box {
      width: min(380px, 100%);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 500;
    }
    p {
      margin: 0 0 12px;
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
