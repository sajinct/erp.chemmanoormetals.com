import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from './core/auth';
import { ROLES } from './core/models';
import { Supabase } from './core/supabase';
import { ChangePasswordDialog } from './features/auth/change-password-dialog';
import { LabelPipe } from './shared/ui';
import { AppTools } from './shared/app-tools';
import { APP_VERSION } from './core/version';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    LabelPipe,
    FormsModule,
    AppTools,
  ],
  template: `
    <mat-sidenav-container class="container">
      <mat-sidenav #nav [mode]="narrow() ? 'over' : 'side'" [opened]="!narrow()" class="nav">
        <div class="nav-inner">
          <a class="brand" routerLink="/" aria-label="Chemmanoor Metals ERP home">
            <img
              src="logo.jpg"
              width="382"
              height="70"
              alt="Chemmanoor Metals — trusted protection"
            />
          </a>
          <div class="workspace">
            <mat-icon>business</mat-icon>
            <div><strong>Team workspace</strong><span>Chemmanoor Metals ERP</span></div>
          </div>
          <div class="eyebrow section">Workspace</div>
          <nav aria-label="Main navigation">
            @for (item of items; track item.path) {
              @if (!item.admin || auth.can('admin')) {
                <a
                  class="item"
                  [routerLink]="item.path"
                  routerLinkActive="active"
                  ariaCurrentWhenActive="page"
                  [routerLinkActiveOptions]="{ exact: item.path === '/' }"
                  (click)="narrow() && nav.close()"
                >
                  <mat-icon>{{ item.icon }}</mat-icon>
                  <span>{{ item.label }}</span>
                  <mat-icon class="nav-arrow">chevron_right</mat-icon>
                </a>
              }
            }
          </nav>
          <div class="foot">
            <strong>CM <span>/</span> 1975</strong>
            <p>Built on trust.<br />Made for what’s next.</p>
            <span>Chemmanoor Metals</span>
            <span class="app-version">ERP v{{ version }}</span>
          </div>
        </div>
      </mat-sidenav>
      <mat-sidenav-content>
        <a class="skip-link" href="#main-content">Skip to content</a>
        <header class="bar">
          @if (narrow()) {
            <button mat-icon-button (click)="nav.toggle()" aria-label="Menu">
              <mat-icon>menu</mat-icon>
            </button>
          }
          <div class="breadcrumb">
            <span>Workspace</span><mat-icon>chevron_right</mat-icon><strong>{{ section() }}</strong>
          </div>
          <span class="spacer"></span>
          <form class="quick-search" (ngSubmit)="findLead()" role="search">
            <mat-icon>search</mat-icon
            ><input
              name="search"
              [(ngModel)]="search"
              aria-label="Find a lead"
              placeholder="Find a lead…"
            />
            <button type="submit" aria-label="Search leads">
              <mat-icon>arrow_forward</mat-icon>
            </button>
          </form>
          <app-tools />
          <button
            type="button"
            class="account"
            [matMenuTriggerFor]="account"
            aria-label="Your account"
            title="Your account"
          >
            <span class="avatar" aria-hidden="true">{{ initials() }}</span>
            <span class="who">
              <strong>{{ auth.profile()?.full_name }}</strong>
              <span>{{ auth.role() | label: roles }}</span>
            </span>
            <mat-icon class="account-caret" aria-hidden="true">expand_more</mat-icon>
          </button>
          <mat-menu #account="matMenu" xPosition="before">
            <div class="app-menu-title">{{ auth.profile()?.email }}</div>
            <button mat-menu-item (click)="changePassword()">
              <mat-icon>key</mat-icon><span>Change password</span>
            </button>
            <button mat-menu-item (click)="signOut()">
              <mat-icon>logout</mat-icon><span>Sign out</span>
            </button>
          </mat-menu>
          <button mat-icon-button (click)="signOut()" aria-label="Sign out" title="Sign out">
            <mat-icon>logout</mat-icon>
          </button>
        </header>
        <main id="main-content" tabindex="-1"><router-outlet /></main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    .container {
      height: 100dvh;
      background: var(--brand-soft);
    }
    .nav {
      width: 250px;
      background: var(--surface);
      border-right: 1px solid var(--brand-line);
      border-radius: 0;
    }
    .nav-inner {
      min-height: 100%;
      display: flex;
      flex-direction: column;
    }
    .brand {
      display: block;
      padding: 28px 23px 25px;
    }
    .brand img {
      display: block;
      width: 100%;
      height: auto;
    }
    .section {
      padding: 20px 26px 12px;
      color: var(--text-soft);
    }
    .item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      margin: 0 12px 5px;
      border-radius: 8px;
      color: var(--text-muted);
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
    }
    .item mat-icon {
      color: inherit;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .item:hover {
      background: var(--brand-soft);
      text-decoration: none;
    }
    .item.active {
      background: var(--accent-soft);
      color: var(--accent-ink);
    }
    .item.active mat-icon {
      color: inherit;
    }
    .foot {
      margin-top: auto;
      padding: 42px 28px 24px;
      font-size: 12px;
      color: var(--text-muted);
    }
    .bar {
      position: sticky;
      top: 0;
      z-index: 5;
      display: flex;
      align-items: center;
      gap: 14px;
      height: 72px;
      padding: 0 28px;
      background: var(--surface);
      color: var(--brand-ink);
      border-bottom: 1px solid var(--brand-line);
      font-size: 12px;
    }
    .bar button {
      color: var(--text-muted);
    }
    .bar-logo {
      height: 30px;
      width: auto;
      background: var(--surface);
      padding: 4px 8px;
      border-radius: 2px;
    }
    .account {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 4px 6px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .bar .account {
      color: var(--brand-ink);
    }
    .account:hover,
    .account[aria-expanded='true'] {
      background: var(--surface-subtle);
    }
    .account:focus-visible {
      outline: 2px solid #149cc2;
      outline-offset: 2px;
    }
    .account-caret {
      width: 18px;
      height: 18px;
      font-size: 18px;
      color: var(--text-soft);
    }
    .who {
      display: flex;
      flex-direction: column;
      line-height: 1.6;
      margin-right: 4px;
    }
    .who strong {
      font-weight: 600;
    }
    .who span {
      font-size: 10px;
      color: var(--text-muted);
    }
    .who strong {
      max-width: 150px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .workspace {
      display: flex;
      gap: 10px;
      align-items: center;
      background: var(--surface-subtle);
      border: 1px solid var(--brand-line);
      border-radius: 10px;
      padding: 12px;
      margin: 0 16px 8px;
    }
    .workspace > mat-icon {
      background: var(--surface);
      padding: 6px;
      box-sizing: content-box;
      border: 1px solid var(--brand-line);
      border-radius: 7px;
      color: var(--text-muted);
      font-size: 19px;
      width: 19px;
      height: 19px;
    }
    .workspace strong,
    .workspace span {
      display: block;
      font-size: 12px;
      line-height: 1.8;
    }
    .workspace span {
      font-size: 10px;
      color: var(--text-muted);
    }
    .item .nav-arrow {
      margin-left: auto;
      opacity: 0;
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .item.active .nav-arrow {
      opacity: 1;
    }
    .foot strong {
      color: var(--brand-ink);
      font-size: 16px;
      font-weight: 800;
    }
    .foot strong span {
      color: var(--brand-orange);
    }
    .foot p {
      margin: 10px 0;
      line-height: 1.8;
    }
    .foot > span {
      font-size: 10px;
    }
    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 12px;
      white-space: nowrap;
      min-width: 0;
    }
    .breadcrumb strong {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .breadcrumb span {
      color: var(--text-muted);
    }
    .breadcrumb mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
      color: var(--text-faint);
    }
    .quick-search {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 210px;
      padding: 5px 8px 5px 12px;
      border: 1px solid var(--brand-line);
      border-radius: 8px;
    }
    .quick-search > mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
      color: var(--text-soft);
    }
    .quick-search input {
      width: 100%;
      min-width: 0;
      border: 0;
      background: transparent;
      font: inherit;
      color: inherit;
      outline: 0;
    }
    .quick-search:focus-within {
      outline: 2px solid #149cc2;
      outline-offset: 2px;
    }
    .quick-search button {
      display: grid;
      place-items: center;
      background: var(--surface-subtle);
      border: 0;
      padding: 3px;
      border-radius: 4px;
      cursor: pointer;
    }
    .quick-search button mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
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
    main:focus {
      outline: none;
    }
    @media (max-width: 1150px) {
      .bar {
        padding: 0 20px;
        gap: 10px;
      }
      .breadcrumb span,
      .breadcrumb > mat-icon {
        display: none;
      }
      .quick-search {
        width: 170px;
      }
    }
    @media (max-width: 600px) {
      .bar {
        height: 64px;
        padding: 0 8px;
        gap: 5px;
      }
      .quick-search,
      .who,
      .account-caret {
        display: none;
      }
      .account {
        padding: 2px;
      }
      .avatar {
        width: 30px;
        height: 30px;
      }
    }
  `,
})
export class Shell {
  protected readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly sb = inject(Supabase);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly roles = ROLES;
  protected readonly version = APP_VERSION;
  protected search = '';
  protected readonly section = signal('Dashboard');
  protected readonly initials = computed(() =>
    (this.auth.profile()?.full_name || 'Team')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase(),
  );

  protected readonly items = [
    { path: '/', label: 'Dashboard', icon: 'space_dashboard', admin: false },
    { path: '/leads', label: 'Leads', icon: 'filter_alt', admin: false },
    { path: '/projects', label: 'Projects', icon: 'work_outline', admin: false },
    { path: '/customers', label: 'Customers', icon: 'people_outline', admin: false },
    { path: '/catalogue', label: 'Products & rates', icon: 'inventory_2', admin: false },
    { path: '/users', label: 'Users & roles', icon: 'manage_accounts', admin: true },
    { path: '/settings', label: 'Settings', icon: 'settings', admin: true },
  ];

  private readonly media = window.matchMedia('(max-width: 900px)');
  protected readonly narrow = signal(this.media.matches);

  constructor() {
    const updateMedia = (e: MediaQueryListEvent) => this.narrow.set(e.matches);
    this.media.addEventListener('change', updateMedia);
    this.destroyRef.onDestroy(() => this.media.removeEventListener('change', updateMedia));
    const updateSection = () => {
      const path = '/' + this.router.url.split('?')[0].split('/')[1];
      this.section.set(this.items.find((item) => item.path === path)?.label || 'Dashboard');
    };
    updateSection();
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd) updateSection();
    });
  }

  protected findLead(): void {
    void this.router.navigate(['/leads'], { queryParams: { search: this.search.trim() || null } });
  }

  protected changePassword(): void {
    this.dialog
      .open(ChangePasswordDialog, { autoFocus: 'first-tabbable' })
      .afterClosed()
      .subscribe((changed) => {
        if (changed) this.sb.info('Password changed. Your other devices have been signed out.');
      });
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
