import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Customer } from '../../core/models';
import { Supabase } from '../../core/supabase';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-customers-list',
  imports: [UI],
  template: `
    <div class="page">
      <div class="page-head">
        <h1>Customers</h1>
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>Search name or phone</mat-label>
          <input matInput [ngModel]="search()" (ngModelChange)="search.set($event)" />
        </mat-form-field>
      </div>
      <p class="sub">A customer is created automatically when a lead is turned into a project.</p>
      <div class="card table-wrap">
        <table class="tbl">
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
            @for (c of shown(); track c.id) {
              <tr class="link" (click)="router.navigate(['/customers', c.id])">
                <td>{{ c.name }}</td>
                <td>+{{ c.phone }}</td>
                <td>{{ c.email }}</td>
                <td class="wrap">{{ c.address }}</td>
                <td>{{ c.gstin }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="empty">{{ loading() ? 'Loading…' : 'No customers yet.' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class CustomersList {
  private readonly sb = inject(Supabase);
  protected readonly router = inject(Router);
  protected readonly customers = signal<Customer[]>([]);
  protected readonly loading = signal(true);
  protected readonly search = signal('');
  protected readonly shown = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.customers().filter((c) => !q || `${c.name} ${c.phone}`.toLowerCase().includes(q));
  });

  constructor() {
    void this.sb
      .all<Customer>(() => this.sb.client.from('customers').select('*').order('name').order('id'))
      .then((rows) => this.customers.set(rows))
      .finally(() => this.loading.set(false));
  }
}
