import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Auth } from '../../core/auth';
import { Customer, PROJECT_STATUSES, Project } from '../../core/models';
import { Supabase } from '../../core/supabase';
import { normalizePhone } from '../../shared/messaging';
import { UI } from '../../shared/ui';

@Component({
  selector: 'app-customer-detail',
  imports: [UI],
  template: `
    @if (customer(); as c) {
      <div class="page">
        <div class="page-head">
          <h1>{{ c.name }}</h1>
        </div>
        <div class="card">
          <h2>Details</h2>
          <div class="form-grid">
            <mat-form-field>
              <mat-label>Name</mat-label>
              <input matInput [(ngModel)]="c.name" [disabled]="!canEdit" />
            </mat-form-field>
            <mat-form-field>
              <mat-label>Phone</mat-label>
              <input matInput [(ngModel)]="c.phone" [disabled]="!canEdit" />
            </mat-form-field>
            <mat-form-field>
              <mat-label>Email</mat-label>
              <input matInput [(ngModel)]="c.email" [disabled]="!canEdit" />
            </mat-form-field>
            <mat-form-field>
              <mat-label>GSTIN (for commercial invoices)</mat-label>
              <input matInput [(ngModel)]="c.gstin" [disabled]="!canEdit" />
            </mat-form-field>
            <mat-form-field class="wide">
              <mat-label>Address</mat-label>
              <textarea matInput rows="2" [(ngModel)]="c.address" [disabled]="!canEdit"></textarea>
            </mat-form-field>
          </div>
          @if (canEdit) {
            <button mat-flat-button (click)="save(c)">Save</button>
          }
        </div>
        <div class="card table-wrap">
          <h2>Projects</h2>
          <table class="tbl">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Site</th>
                <th>Started</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              @for (p of projects(); track p.id) {
                <tr>
                  <td><a [routerLink]="['/projects', p.id]">{{ p.ref_no }}</a></td>
                  <td class="wrap">{{ p.site_address }}</td>
                  <td>{{ p.created_at | date: 'd MMM y' }}</td>
                  <td><span class="chip {{ p.status }}">{{ p.status | label: statuses }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }
  `,
})
export class CustomerDetail {
  private readonly sb = inject(Supabase);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  protected readonly canEdit = inject(Auth).can('admin', 'approver', 'sales', 'measurement');
  protected readonly statuses = PROJECT_STATUSES;
  protected readonly customer = signal<Customer | null>(null);
  protected readonly projects = signal<Project[]>([]);

  constructor() {
    const db = this.sb.client;
    void this.sb
      .run<Customer>(db.from('customers').select('*').eq('id', this.id).single())
      .then((c) => this.customer.set(c));
    void this.sb
      .run<Project[]>(
        db.from('projects').select('*').eq('customer_id', this.id).order('created_at', { ascending: false }),
      )
      .then((p) => this.projects.set(p));
  }

  protected async save(c: Customer): Promise<void> {
    const phone = normalizePhone(c.phone);
    if (!c.name.trim() || phone.length < 10) {
      this.sb.error('Name and a valid phone number are required.');
      return;
    }
    await this.sb.run(
      this.sb.client
        .from('customers')
        .update({
          name: c.name.trim(),
          phone,
          email: c.email || null,
          address: c.address || null,
          gstin: c.gstin || null,
        })
        .eq('id', c.id),
    );
    this.customer.set({ ...c, phone });
    this.sb.info('Customer saved');
  }
}
