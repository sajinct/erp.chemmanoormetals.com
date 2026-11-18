import { Component, inject, signal } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { Auth } from '../../core/auth';
import { PASSWORD_MAX, PASSWORD_MIN, newPasswordProblem } from '../../core/password';
import { UI } from '../../shared/ui';

/** Lets the signed-in person change their own password. Closes with true once changed. */
@Component({
  selector: 'app-change-password-dialog',
  imports: [UI],
  template: `
    <h2 mat-dialog-title>Change password</h2>
    <form #passwordForm="ngForm" (ngSubmit)="save()">
      <mat-dialog-content>
        <p class="dialog-intro">
          Signed in as {{ email }}. Changing your password signs you out on your other devices.
        </p>
        <!-- Lets password managers file the new password under the right account. -->
        <input
          class="username"
          type="email"
          name="username"
          autocomplete="username"
          [value]="email"
          readonly
          tabindex="-1"
          aria-hidden="true"
        />
        <div class="fields">
          <mat-form-field subscriptSizing="dynamic">
            <mat-label>Current password</mat-label>
            <input
              matInput
              name="current"
              [(ngModel)]="current"
              [type]="show() ? 'text' : 'password'"
              required
              autocomplete="current-password"
            />
          </mat-form-field>
          <mat-form-field subscriptSizing="dynamic">
            <mat-label>New password</mat-label>
            <input
              matInput
              name="next"
              [(ngModel)]="next"
              [type]="show() ? 'text' : 'password'"
              required
              [minlength]="min"
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
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" (click)="close()" [disabled]="busy()">Cancel</button>
        <button mat-flat-button type="submit" [disabled]="busy()">
          {{ busy() ? 'Changing…' : 'Change password' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-dialog-content {
      width: min(440px, 85vw);
    }
    .dialog-intro {
      margin: 0 0 20px;
      color: var(--text-muted);
      font-size: 12px;
    }
    .fields {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .toggle {
      align-self: flex-start;
    }
    .error-text {
      margin: 0;
    }
    /* Present for password managers, not for people. */
    .username {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    }
    @media (max-width: 600px) {
      mat-dialog-content {
        width: auto;
      }
    }
  `,
})
export class ChangePasswordDialog {
  private readonly ref = inject(MatDialogRef<ChangePasswordDialog, boolean>);
  private readonly auth = inject(Auth);

  protected readonly email = this.auth.profile()?.email ?? '';
  protected readonly min = PASSWORD_MIN;
  protected readonly max = PASSWORD_MAX;
  protected readonly busy = signal(false);
  protected readonly show = signal(false);
  protected readonly message = signal('');
  protected current = '';
  protected next = '';
  protected confirm = '';

  protected close(): void {
    this.ref.close(false);
  }

  protected async save(): Promise<void> {
    if (this.busy()) return;
    const problem = newPasswordProblem(this.current, this.next, this.confirm);
    if (problem) {
      this.message.set(problem);
      return;
    }
    this.busy.set(true);
    this.message.set('');
    this.ref.disableClose = true;
    try {
      const error = await this.auth.changePassword(this.current, this.next);
      if (error) {
        this.message.set(error);
        return;
      }
      this.current = this.next = this.confirm = '';
      this.ref.close(true);
    } catch {
      this.message.set('Could not reach the server. Check the connection and try again.');
    } finally {
      this.busy.set(false);
      this.ref.disableClose = false;
    }
  }
}
