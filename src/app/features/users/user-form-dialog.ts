import { Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AdminUsers } from '../../core/admin-users';
import { Auth } from '../../core/auth';
import { Profile, Role, ROLES } from '../../core/models';
import { generatePassword } from '../../core/password';
import { UI } from '../../shared/ui';

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Full access, including company settings and user management.',
  approver: 'Sales workflows, measurement approval and product pricing.',
  sales: 'Manage leads, customers, projects, measurements and quotations.',
  measurement: 'Manage leads, customers, projects and measurements.',
  accounts: 'View business records and record customer payments.',
};

@Component({
  selector: 'app-user-form-dialog',
  imports: [UI],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit user' : 'Create user' }}</h2>
    <form #userForm="ngForm" (ngSubmit)="userForm.valid && save()">
      <mat-dialog-content>
        <p class="dialog-intro">
          {{
            data
              ? 'Update staff details and access to the workspace.'
              : 'Create a staff account and choose what they can access.'
          }}
        </p>
        <div class="form-grid">
          <mat-form-field subscriptSizing="dynamic"
            ><mat-label>Full name</mat-label
            ><input
              matInput
              name="name"
              [(ngModel)]="form.full_name"
              required
              maxlength="120"
              autocomplete="name"
          /></mat-form-field>
          <mat-form-field subscriptSizing="dynamic"
            ><mat-label>Email address</mat-label
            ><input
              matInput
              name="email"
              type="email"
              [(ngModel)]="form.email"
              required
              maxlength="254"
              [disabled]="!!data"
              autocomplete="off"
            />
            @if (data) {
              <mat-hint>Used to sign in. Email cannot be changed here.</mat-hint>
            }
          </mat-form-field>
          <mat-form-field subscriptSizing="dynamic"
            ><mat-label>Phone (optional)</mat-label
            ><input
              matInput
              name="phone"
              type="tel"
              [(ngModel)]="form.phone"
              maxlength="30"
              autocomplete="tel"
          /></mat-form-field>
          <mat-form-field subscriptSizing="dynamic"
            ><mat-label>Account status</mat-label
            ><mat-select name="active" [(ngModel)]="form.active" [disabled]="self"
              ><mat-option [value]="true">Active</mat-option
              ><mat-option [value]="false">Inactive</mat-option></mat-select
            ></mat-form-field
          >
          <mat-form-field subscriptSizing="dynamic" class="wide"
            ><mat-label>Role</mat-label
            ><mat-select name="role" [(ngModel)]="form.role" [disabled]="self">
              @for (role of roles; track role.value) {
                <mat-option [value]="role.value">{{ role.label }}</mat-option>
              }</mat-select
            ><mat-hint>{{ descriptions[form.role] }}</mat-hint></mat-form-field
          >
          @if (!data) {
            <mat-form-field subscriptSizing="dynamic" class="wide"
              ><mat-label>Initial password</mat-label
              ><input
                matInput
                name="password"
                [(ngModel)]="form.password"
                [type]="showPassword() ? 'text' : 'password'"
                required
                minlength="12"
                maxlength="128"
                autocomplete="new-password"
              /><button
                mat-icon-button
                matSuffix
                type="button"
                (click)="showPassword.set(!showPassword())"
                [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
              >
                <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon></button
              ><mat-hint
                >At least 12 characters. Share securely with the staff member.</mat-hint
              ></mat-form-field
            >
            <div class="wide">
              <button mat-stroked-button type="button" (click)="generatePassword()">
                <mat-icon>password</mat-icon>Generate password
              </button>
              <p class="sub">The account is created directly. No invitation email is sent.</p>
            </div>
          }
          @if (self) {
            <p class="sub wide">
              Your own role and account status are protected. Another administrator can manage your
              access.
            </p>
          }
          @if (message()) {
            <p class="error-text wide" role="alert">{{ message() }}</p>
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end"
        ><button mat-button type="button" (click)="close()" [disabled]="busy()">Cancel</button
        ><button
          mat-flat-button
          type="submit"
          [disabled]="busy() || userForm.invalid || !form.full_name.trim()"
        >
          {{ busy() ? 'Saving…' : data ? 'Save changes' : 'Create user' }}
        </button></mat-dialog-actions
      >
    </form>
  `,
  styles: `
    mat-dialog-content {
      width: min(620px, 85vw);
    }
    .dialog-intro {
      margin: 0 0 20px;
      color: var(--text-muted);
      font-size: 12px;
    }
    .form-grid {
      row-gap: 18px;
    }
    .sub {
      font-size: 11px;
      margin: 10px 0 0;
    }
    @media (max-width: 600px) {
      mat-dialog-content {
        width: auto;
      }
    }
  `,
})
export class UserFormDialog {
  protected readonly data = inject<Profile | null>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<UserFormDialog>);
  private readonly api = inject(AdminUsers);
  protected readonly self = this.data?.id === inject(Auth).profile()?.id;
  protected readonly roles = ROLES;
  protected readonly descriptions = ROLE_DESCRIPTIONS;
  protected readonly busy = signal(false);
  protected readonly message = signal('');
  protected readonly showPassword = signal(false);
  protected readonly form = {
    full_name: this.data?.full_name || '',
    email: this.data?.email || '',
    phone: this.data?.phone || '',
    role: this.data?.role || ('sales' as Role),
    active: this.data?.active ?? true,
    password: '',
  };

  protected close(): void {
    this.ref.close();
  }
  protected generatePassword(): void {
    this.form.password = generatePassword();
    this.showPassword.set(true);
  }
  protected async save(): Promise<void> {
    if (this.busy() || !this.form.full_name.trim()) return;
    this.busy.set(true);
    this.message.set('');
    this.ref.disableClose = true;
    const details = {
      full_name: this.form.full_name.trim(),
      phone: this.form.phone.trim() || null,
      role: this.form.role,
      active: this.form.active,
    };
    try {
      const user = this.data
        ? await this.api.update(this.data.id, details)
        : await this.api.create({
            ...details,
            email: this.form.email.trim(),
            password: this.form.password,
          });
      this.form.password = '';
      this.ref.close(user);
    } catch (error) {
      this.message.set(
        error instanceof Error ? error.message : 'The user could not be saved. Please try again.',
      );
    } finally {
      this.busy.set(false);
      this.ref.disableClose = false;
    }
  }
}
