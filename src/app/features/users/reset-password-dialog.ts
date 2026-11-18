import { Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AdminUsers } from '../../core/admin-users';
import { Profile } from '../../core/models';
import { PASSWORD_MAX, PASSWORD_MIN, generatePassword } from '../../core/password';
import { UI } from '../../shared/ui';

/**
 * Admin only: give another staff member a new password, for when they cannot
 * sign in or their password may be known to someone else. Closes with true once done.
 */
@Component({
  selector: 'app-reset-password-dialog',
  imports: [UI],
  template: `
    <h2 mat-dialog-title>Reset password</h2>
    <form #resetForm="ngForm" (ngSubmit)="save()">
      <mat-dialog-content>
        <p class="dialog-intro">
          Set a new password for <strong>{{ user.full_name }}</strong> ({{ user.email }}). They are
          signed out on every device and must use the new password to sign in.
        </p>
        <mat-form-field subscriptSizing="dynamic" class="field">
          <mat-label>New password</mat-label>
          <input
            matInput
            name="password"
            [(ngModel)]="password"
            [type]="show() ? 'text' : 'password'"
            required
            [maxlength]="max"
            autocomplete="new-password"
          />
          <button
            mat-icon-button
            matSuffix
            type="button"
            (click)="show.set(!show())"
            [attr.aria-label]="show() ? 'Hide password' : 'Show password'"
            [attr.aria-pressed]="show()"
          >
            <mat-icon>{{ show() ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
          <mat-hint>At least {{ min }} characters.</mat-hint>
        </mat-form-field>
        <div class="row tools">
          <button mat-stroked-button type="button" (click)="generate()">
            <mat-icon>password</mat-icon>Generate password
          </button>
          <button mat-button type="button" (click)="copy()" [disabled]="!password">
            <mat-icon>content_copy</mat-icon>{{ copied() ? 'Copied' : 'Copy' }}
          </button>
        </div>
        <p class="sub">
          No email is sent. Give {{ user.full_name }} the password yourself, and ask them to choose
          their own under their name, then Change password, after signing in.
        </p>
        @if (message()) {
          <p class="error-text" role="alert">{{ message() }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" (click)="close()" [disabled]="busy()">Cancel</button>
        <button mat-flat-button type="submit" [disabled]="busy()">
          {{ busy() ? 'Resetting…' : 'Reset password' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-dialog-content {
      width: min(480px, 85vw);
    }
    .dialog-intro {
      margin: 0 0 20px;
      color: var(--text-muted);
      font-size: 12px;
    }
    .dialog-intro strong {
      color: var(--brand-ink);
    }
    .field {
      width: 100%;
    }
    .tools {
      margin-top: 14px;
    }
    .sub {
      font-size: 11px;
      margin: 14px 0 0;
    }
    .error-text {
      margin: 14px 0 0;
    }
    @media (max-width: 600px) {
      mat-dialog-content {
        width: auto;
      }
    }
  `,
})
export class ResetPasswordDialog {
  protected readonly user = inject<Profile>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ResetPasswordDialog, boolean>);
  private readonly api = inject(AdminUsers);

  protected readonly min = PASSWORD_MIN;
  protected readonly max = PASSWORD_MAX;
  protected readonly busy = signal(false);
  protected readonly show = signal(false);
  protected readonly copied = signal(false);
  protected readonly message = signal('');
  protected password = '';

  protected close(): void {
    this.ref.close(false);
  }

  protected generate(): void {
    this.password = generatePassword();
    this.show.set(true);
    this.copied.set(false);
  }

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.password);
      this.copied.set(true);
    } catch {
      // Clipboard access can be refused; the password is still visible to copy by hand.
      this.show.set(true);
      this.message.set('Copying was blocked by the browser. Select the password and copy it.');
    }
  }

  protected async save(): Promise<void> {
    if (this.busy()) return;
    if (this.password.length < this.min) {
      this.message.set(`Use at least ${this.min} characters for the new password.`);
      return;
    }
    this.busy.set(true);
    this.message.set('');
    this.ref.disableClose = true;
    try {
      await this.api.resetPassword(this.user.id, this.password);
      this.password = '';
      this.ref.close(true);
    } catch (error) {
      this.message.set(
        error instanceof Error
          ? error.message
          : 'The password could not be reset. Please try again.',
      );
    } finally {
      this.busy.set(false);
      this.ref.disableClose = false;
    }
  }
}
