import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from './core/auth';
import { ROLES } from './core/models';
import { LabelPipe } from './shared/ui';

/** Side navigation and top bar around every signed-in page. */
@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    LabelPipe,
  ],
  template: `
    <mat-sidenav-container class="container">
      <mat-sidenav
        #nav
        [mode]="narrow() ? 'over' : 'side'"
        [opened]="!narrow()"
        class="nav"
      >
        <div class="brand">
          <strong>Chemmanoor Metals</strong>
          <span class="sub">ERP</span>
        </div>
        <mat-nav-list>
          @for (item of items; track item.path) {
            @if (!item.admin || auth.can('admin')) {
              <a
                mat-list-item
                [routerLink]="item.path"
                routerLinkActive="active"
                [routerLinkActiveOptions]="{ exact: item.path === '/' }"
                (click)="narrow() && nav.close()"
              >
                <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
                <span matListItemTitle>{{ item.label }}</span>
              </a>
            }
          }
        </mat-nav-list>
      </mat-sidenav>
      <mat-sidenav-content>
        <mat-toolbar class="bar">
          @if (narrow()) {
            <button mat-icon-button (click)="nav.toggle()" aria-label="Menu">
              <mat-icon>menu</mat-icon>
            </button>
          }
          <span class="spacer"></span>
          <span class="who">
            {{ auth.profile()?.full_name }}
            <span class="sub">{{ auth.role() | label: roles }}</span>
          </span>
          <button mat-icon-button (click)="signOut()" aria-label="Sign out" title="Sign out">
            <mat-icon>logout</mat-icon>
          </button>
        </mat-toolbar>
        <router-outlet />
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    .container {
      height: 100vh;
    }
    .nav {
      width: 230px;
    }
    .brand {
      padding: 20px 16px 12px;
      display: flex;
      flex-direction: column;
    }
    .bar {
      position: sticky;
      top: 0;
      z-index: 2;
      background: var(--mat-sys-surface);
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      font-size: 14px;
    }
    .who {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      line-height: 1.2;
      margin-right: 8px;
    }
    .active {
      background: var(--mat-sys-secondary-container);
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
