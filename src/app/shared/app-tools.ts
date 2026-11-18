import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Pwa } from '../core/pwa';
import { Theme } from '../core/theme';

@Component({
  selector: 'app-tools',
  imports: [MatButtonModule, MatIconModule, MatMenuModule],
  template: `
    <button
      mat-icon-button
      [matMenuTriggerFor]="appearance"
      aria-label="Choose theme"
      title="Appearance"
    >
      <mat-icon>{{ theme.dark() ? 'dark_mode' : 'light_mode' }}</mat-icon>
    </button>
    <mat-menu #appearance="matMenu">
      <button
        mat-menu-item
        role="menuitemradio"
        [attr.aria-checked]="theme.preference() === 'system'"
        (click)="theme.set('system')"
      >
        <mat-icon>brightness_auto</mat-icon><span>Device theme</span>
      </button>
      <button
        mat-menu-item
        role="menuitemradio"
        [attr.aria-checked]="theme.preference() === 'light'"
        (click)="theme.set('light')"
      >
        <mat-icon>light_mode</mat-icon><span>Light</span>
      </button>
      <button
        mat-menu-item
        role="menuitemradio"
        [attr.aria-checked]="theme.preference() === 'dark'"
        (click)="theme.set('dark')"
      >
        <mat-icon>dark_mode</mat-icon><span>Dark</span>
      </button>
    </mat-menu>
    <button
      mat-icon-button
      [matMenuTriggerFor]="application"
      aria-label="Install and app updates"
      title="Install & updates"
    >
      <mat-icon>{{ pwa.readyVersion() ? 'system_update' : 'more_vert' }}</mat-icon>
    </button>
    <mat-menu #application="matMenu">
      <div class="app-menu-title">
        Chemmanoor ERP <span>v{{ pwa.version }}</span>
      </div>
      <button
        mat-menu-item
        (click)="pwa.install()"
        [disabled]="pwa.installed() || pwa.installing()"
      >
        <mat-icon>{{ pwa.installed() ? 'check_circle' : 'install_mobile' }}</mat-icon
        ><span>{{ pwa.installed() ? 'App installed' : 'Install app' }}</span>
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
    </mat-menu>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
    }
    button {
      color: var(--text-muted);
    }
  `,
})
export class AppTools {
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
