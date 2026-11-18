import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Customer } from '../../core/models';
import { Supabase } from '../../core/supabase';
import { UI } from '../../shared/ui';
import { paginate } from '../../shared/pagination';

@Component({
  selector: 'app-customers-list',
  imports: [UI],
  template: `
    <div class="page" [attr.aria-busy]="loading()">
      <div class="page-head">
        <div class="page-title">
          <h1>
            Customers <span class="count-badge">{{ customers().length }}</span>
          </h1>
          <p>Your customer relationships, contact details and project history.</p>
        </div>
        <a mat-stroked-button routerLink="/leads"><mat-icon>filter_alt</mat-icon>Open leads</a>
      </div>
      @if (failed()) {
        <div class="feedback" role="alert">
          <mat-icon>cloud_off</mat-icon><span>Customers couldn’t be loaded. Please try again.</span
          ><button mat-stroked-button (click)="load()">Retry</button>
        </div>
      }
      <div class="row filters">
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>Search name, phone, email or address</mat-label>
          <mat-icon matPrefix>search</mat-icon
          ><input matInput [ngModel]="search()" (ngModelChange)="search.set($event)" />
        </mat-form-field>
        @if (search()) {
          <button mat-button (click)="search.set('')">
            <mat-icon>close</mat-icon>Clear search
          </button>
        }
      </div>
      <div class="card table-wrap">
        @if (loading()) {
          <div class="loading-line" role="status" aria-label="Loading customers"></div>
        }
        <table class="tbl" aria-label="Customers">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Address</th>
              <th>GSTIN</th>
            </tr>
          </thead>
          <tbody>
            @for (c of pager.rows(); track c.id) {
              <tr class="link" (click)="router.navigate(['/customers', c.id])">
                <td>
                  <a [routerLink]="['/customers', c.id]" (click)="$event.stopPropagation()">{{
                    c.name
                  }}</a>
                </td>
                <td>+{{ c.phone }}</td>
                <td>{{ c.email }}</td>
                <td class="wrap">{{ c.address }}</td>
                <td>{{ c.gstin }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="empty">
                  <mat-icon>{{
                    failed() ? 'cloud_off' : loading() ? 'hourglass_empty' : 'people_outline'
                  }}</mat-icon
                  ><strong>{{
                    failed()
                      ? 'Customers unavailable'
                      : loading()
                        ? 'Loading customers…'
                        : 'No customers to show'
                  }}</strong>
                  <p>
                    {{
                      failed()
                        ? 'Use Retry above to load your customers.'
                        : customers().length
                          ? 'Try a different name, phone or email.'
                          : 'Customers are added automatically when you create a project from a lead.'
                    }}
                  </p>
                </td>
              </tr>
            }
          </tbody>
        </table>
        <app-table-pager [pager]="pager" [total]="shown().length" />
      </div>
    </div>
  `,
})
export class CustomersList {
  private readonly sb = inject(Supabase);
  protected readonly router = inject(Router);
  protected readonly customers = signal<Customer[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly search = signal('');
  protected readonly shown = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.customers().filter(
      (c) =>
        !q || `${c.name} ${c.phone} ${c.email ?? ''} ${c.address ?? ''}`.toLowerCase().includes(q),
    );
  });
  protected readonly pager = paginate(this.shown);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      this.customers.set(
        await this.sb.all<Customer>(() =>
          this.sb.client.from('customers').select('*').order('name').order('id'),
        ),
      );
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
