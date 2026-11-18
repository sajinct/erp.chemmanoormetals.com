import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from './core/auth';
import { ROLES } from './core/models';
import { LabelPipe } from './shared/ui';

/**
 * Frame around every signed-in page, styled after chemmanoormetals.com:
 * dark strip on top, the logo on white, orange marker on the current section.
 */
@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatIconModule,
    MatButtonModule,
    LabelPipe,
  ],
  template: `
    <mat-sidenav-container class="container">
      <mat-sidenav #nav [mode]="narrow() ? 'over' : 'side'" [opened]="!narrow()" class="nav">
        <a class="brand" routerLink="/" aria-label="Chemmanoor Metals ERP home">
          <img src="logo.jpg" width="382" height="70" alt="Chemmanoor Metals — trusted protection" />
        </a>
        <div class="eyebrow section">ERP</div>
        <nav aria-label="Main navigation">
          @for (item of items; track item.path) {
            @if (!item.admin || auth.can('admin')) {
              <a
                class="item"
                [routerLink]="item.path"
                routerLinkActive="active"
                [routerLinkActiveOptions]="{ exact: item.path === '/' }"
                (click)="narrow() && nav.close()"
              >
                <mat-icon>{{ item.icon }}</mat-icon>
                <span>{{ item.label }}</span>
              </a>
            }
          }
        </nav>
        <div class="foot">Trusted protection. Since 1975.</div>
      </mat-sidenav>
      <mat-sidenav-content>
        <header class="bar">
          @if (narrow()) {
            <button mat-icon-button (click)="nav.toggle()" aria-label="Menu">
              <mat-icon>menu</mat-icon>
            </button>
            <img class="bar-logo" src="logo.jpg" width="382" height="70" alt="Chemmanoor Metals" />
          }
          <span class="spacer"></span>
          <span class="who">
            <strong>{{ auth.profile()?.full_name }}</strong>
            <span>{{ auth.role() | label: roles }}</span>
          </span>
          <button mat-icon-button (click)="signOut()" aria-label="Sign out" title="Sign out">
            <mat-icon>logout</mat-icon>
          </button>
        </header>
        <router-outlet />
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    .container {
      height: 100vh;
      background: var(--brand-soft);
    }
    .nav {
      width: 248px;
      background: #fff;
      border-right: 1px solid var(--brand-line);
      display: flex;
      flex-direction: column;
    }
    .brand {
      display: block;
      padding: 22px 22px 18px;
      border-bottom: 1px solid var(--brand-line);
    }
    .brand img {
      display: block;
      width: 100%;
      height: auto;
    }
    .section {
      padding: 18px 24px 8px;
      color: #686c63;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 24px;
      color: var(--brand-ink);
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      border-left: 3px solid transparent;
    }
    .item mat-icon {
      color: #686c63;
    }
    .item:hover {
      background: var(--brand-soft);
      text-decoration: none;
    }
    .item.active {
      background: var(--brand-soft);
      border-left-color: var(--brand-orange);
    }
    .item.active mat-icon {
      color: var(--brand-ink);
    }
    .foot {
      margin-top: auto;
      padding: 18px 24px;
      font-size: 12px;
      color: #686c63;
      border-top: 1px solid var(--brand-line);
    }
    .bar {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 52px;
      padding: 0 12px 0 20px;
      background: var(--brand-ink);
      color: #f1f2ed;
      font-size: 13px;
      --mat-icon-button-icon-color: #f1f2ed;
      --mat-icon-button-state-layer-color: #f1f2ed;
    }
    .bar button {
      color: #f1f2ed;
    }
    .bar-logo {
      height: 30px;
      width: auto;
      background: #fff;
      padding: 4px 8px;
      border-radius: 2px;
    }
    .who {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      line-height: 1.25;
      margin-right: 4px;
    }
    .who strong {
      font-weight: 600;
    }
    .who span {
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #b8beb3;
    }
  `,
})
export class Shell {
  protected readonly auth = inject(Auth);
  private readonly router = inject(Router);
  protected readonly roles = ROLES;

  protected readonly items = [
    { path: '/', label: 'Dashboard', icon: 'dashboard', admin: false },
    { path: '/leads', label: 'Leads', icon: 'contact_phone', admin: false },
    { path: '/projects', label: 'Projects', icon: 'assignment', admin: false },
    { path: '/customers', label: 'Customers', icon: 'people', admin: false },
    { path: '/catalogue', label: 'Products & rates', icon: 'sell', admin: false },
    { path: '/settings', label: 'Settings', icon: 'settings', admin: true },
  ];

  private readonly media = window.matchMedia('(max-width: 900px)');
  protected readonly narrow = signal(this.media.matches);

  constructor() {
    this.media.addEventListener('change', (e) => this.narrow.set(e.matches));
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
