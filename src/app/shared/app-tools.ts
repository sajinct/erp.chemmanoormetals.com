import { Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Pwa } from '../core/pwa';
import { Theme } from '../core/theme';
import { Auth } from '../core/auth';
import { ROLES, labelOf } from '../core/models';

@Component({
  selector: 'app-tools',
  imports: [MatButtonModule, MatIconModule, MatMenuModule],
  template: `
    <button
      type="button"
      class="menu-trigger"
      [class.account-trigger]="account()"
      [matMenuTriggerFor]="appMenu"
      [attr.aria-label]="account() ? 'Account and app menu' : 'App menu'"
    >
      @if (account()) {
        <span class="avatar" aria-hidden="true">{{ initials() }}</span>
        <span class="who">
          <strong>{{ auth.profile()?.full_name }}</strong>
          <span>{{ roleLabel() }}</span>
        </span>
      } @else {
        <mat-icon>more_horiz</mat-icon>
      }
      @if (pwa.readyVersion() || pwa.unrecoverable()) {
        <span class="update-dot" role="img" aria-label="Update available"></span>
      }
      @if (account()) {
        <mat-icon class="caret" aria-hidden="true">expand_more</mat-icon>
      }
    </button>
    <mat-menu #appMenu="matMenu" xPosition="before">
      @if (account()) {
        <div class="menu-identity">
          <strong>{{ auth.profile()?.full_name }}</strong>
          <span>{{ roleLabel() }}</span>
          <span>{{ auth.profile()?.email }}</span>
        </div>
      }
      <div class="menu-heading">Appearance</div>
      <button
        mat-menu-item
        role="menuitemradio"
        [attr.aria-checked]="theme.preference() === 'system'"
        (click)="theme.set('system')"
      >
        <mat-icon>brightness_auto</mat-icon><span>Use device theme</span>
      </button>
      <button
        mat-menu-item
        role="menuitemradio"
        [attr.aria-checked]="theme.preference() === 'light'"
        (click)="theme.set('light')"
      >
        <mat-icon>light_mode</mat-icon><span>Light theme</span>
      </button>
      <button
        mat-menu-item
        role="menuitemradio"
        [attr.aria-checked]="theme.preference() === 'dark'"
        (click)="theme.set('dark')"
      >
        <mat-icon>dark_mode</mat-icon><span>Dark theme</span>
      </button>
      <div class="app-menu-title menu-section">
        Chemmanoor ERP <span>v{{ pwa.version }}</span>
      </div>
      <button
        mat-menu-item
        (click)="pwa.install()"
        [disabled]="pwa.installed() || pwa.installing()"
      >
        <mat-icon>{{ pwa.installed() ? 'check_circle' : 'install_mobile' }}</mat-icon><span>{{
          pwa.installed() ? 'App installed' : 'Install app'
        }}</span>
      </button>
      @if (pwa.readyVersion() || pwa.unrecoverable()) {
        <button mat-menu-item (click)="pwa.updateDismissed.set(false)">
          <mat-icon>system_update</mat-icon><span>Update available</span>
        </button>
      }
      <button mat-menu-item (click)="pwa.check()" [disabled]="pwa.checking()">
        <mat-icon>refresh</mat-icon
        ><span>{{ pwa.checking() ? 'Checking for updates…' : 'Check for updates' }}</span>
      </button>
      @if (account()) {
        <div class="menu-heading menu-section">Account</div>
        <button mat-menu-item (click)="passwordChange.emit()">
          <mat-icon>key</mat-icon><span>Change password</span>
        </button>
        <button mat-menu-item (click)="signOut.emit()">
          <mat-icon>logout</mat-icon><span>Sign out</span>
        </button>
      }
    </mat-menu>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
    }
    .menu-trigger {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      min-height: 44px;
      min-width: 44px;
      padding: 4px 8px;
      border: 0;
      border-radius: 10px;
      background: transparent;
      font: inherit;
      text-align: left;
      cursor: pointer;
      color: var(--text-muted);
    }
    .account-trigger {
      color: var(--brand-ink);
    }
    .menu-trigger:hover,
    .menu-trigger[aria-expanded='true'] {
      background: var(--surface-subtle);
    }
    .menu-trigger:focus-visible {
      outline: 2px solid #149cc2;
      outline-offset: 2px;
    }
    .avatar {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      flex-shrink: 0;
      border-radius: 50%;
      background: var(--accent-soft);
      color: var(--accent-ink);
      font-size: 12px;
      font-weight: 800;
    }
    .who {
      display: flex;
      flex-direction: column;
      line-height: 1.6;
    }
    .who strong {
      font-weight: 600;
      max-width: 150px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .who span {
      font-size: 10px;
      color: var(--text-muted);
    }
    .caret {
      width: 18px;
      height: 18px;
      font-size: 18px;
      color: var(--text-soft);
    }
    .update-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--brand-orange);
    }
    .menu-identity {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--brand-line);
      overflow-wrap: anywhere;
    }
    .menu-identity strong {
      font-size: 14px;
      color: var(--brand-ink);
    }
    .menu-identity span,
    .menu-heading {
      font-size: 12px;
      color: var(--text-muted);
    }
    .menu-heading {
      padding: 12px 16px 6px;
      font-weight: 600;
    }
    .menu-section {
      margin-top: 8px;
      border-top: 1px solid var(--brand-line);
    }
    .app-menu-title.menu-section {
      border-bottom: 0;
    }
    @media (max-width: 600px) {
      .who {
        display: none;
      }
      .menu-trigger {
        gap: 4px;
        padding: 4px;
      }
      .avatar {
        width: 30px;
        height: 30px;
      }
    }
  `,
})
export class AppTools {
  readonly account = input(false);
  readonly passwordChange = output<void>();
  readonly signOut = output<void>();
  protected readonly auth = inject(Auth);
  protected readonly roleLabel = computed(() => labelOf(ROLES, this.auth.role()));
  protected readonly initials = computed(() =>
    (this.auth.profile()?.full_name || 'Team')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase(),
  );
  protected readonly theme = inject(Theme);
  protected readonly pwa = inject(Pwa);
}

@Component({
  selector: 'app-status',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="app-notices">
      @if (!pwa.online()) {
        <div class="app-notice" role="status">
          <mat-icon>wifi_off</mat-icon>
          <div>
            <strong>You’re offline</strong>
            <p>Connect to load and save ERP records.</p>
          </div>
        </div>
      }
      @if ((pwa.readyVersion() && !pwa.updateDismissed()) || pwa.unrecoverable()) {
        <section class="app-notice" aria-label="App update" role="status">
          <mat-icon>system_update</mat-icon>
          <div>
            <strong>{{
              pwa.unrecoverable()
                ? 'Please reload the app'
                : 'Version ' + pwa.readyVersion() + ' is ready'
            }}</strong>
            <p>Save your work, then reload to use the latest version.</p>
            <div class="row">
              <button mat-flat-button (click)="pwa.update()">Update now</button>
              @if (!pwa.unrecoverable()) {
                <button mat-button (click)="pwa.updateDismissed.set(true)">Later</button>
              }
            </div>
          </div>
        </section>
      }
      @if (pwa.message()) {
        <div class="app-notice" role="status">
          <mat-icon>info_outline</mat-icon>
          <p>{{ pwa.message() }}</p>
          <button mat-icon-button aria-label="Dismiss message" (click)="pwa.message.set('')">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      }
      @if (pwa.installHelp()) {
        <section class="app-notice" aria-label="Install instructions">
          <mat-icon>install_mobile</mat-icon>
          <div>
            <strong>Install Chemmanoor ERP</strong>
            <p>On iPhone or iPad, open this page in Safari, tap Share, then Add to Home Screen.</p>
            <p>
              On Android or desktop, use your browser’s Install app or Add to Home Screen option. If
              it isn’t offered, use Chrome or Edge.
            </p>
            <button mat-button (click)="pwa.installHelp.set(false)">Got it</button>
          </div>
        </section>
      }
    </div>
  `,
})
export class AppStatus {
  protected readonly pwa = inject(Pwa);
}
