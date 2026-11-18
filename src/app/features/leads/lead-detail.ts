import { Component, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Auth } from '../../core/auth';
import {
  INTERESTS,
  LEAD_STATUSES,
  Lead,
  LeadActivity,
  Project,
  SEGMENTS,
  SOURCES,
  labelOf,
} from '../../core/models';
import { Supabase } from '../../core/supabase';
import { waLink } from '../../shared/messaging';
import { UI } from '../../shared/ui';
import { LeadFormDialog } from './lead-form-dialog';

@Component({
  selector: 'app-lead-detail',
  imports: [UI],
  template: `
    @if (lead(); as l) {
      <div class="page">
        <a class="back-link" routerLink="/leads"><mat-icon>arrow_back</mat-icon>All leads</a>
        <div class="page-head">
          <h1>
            {{ l.name }} <span class="sub">{{ l.ref_no }}</span>
            <span class="chip {{ l.status }}">{{ l.status | label: statuses }}</span>
          </h1>
          <a mat-stroked-button [href]="wa(l)" target="_blank" rel="noopener">
            <mat-icon>chat</mat-icon> WhatsApp
          </a>
          <a mat-stroked-button href="tel:+{{ l.phone }}"><mat-icon>call</mat-icon> Call</a>
          @if (canEdit) {
            <button mat-stroked-button (click)="edit(l)"><mat-icon>edit</mat-icon> Edit</button>
          }
        </div>

        <div class="card">
          <div class="form-grid facts">
            <div><span class="sub">Phone</span><br />+{{ l.phone }}</div>
            <div><span class="sub">Email</span><br />{{ l.email || '—' }}</div>
            <div><span class="sub">Location</span><br />{{ l.location || '—' }}</div>
            <div>
              <span class="sub">Interested in</span><br />{{ l.interest | label: interests }}
            </div>
            <div><span class="sub">Segment</span><br />{{ l.segment | label: segments }}</div>
            <div>
              <span class="sub">Source</span><br />{{ l.source | label: sources }}
              @if (l.referred_by) {
                (by {{ l.referred_by }})
              }
            </div>
            <div>
              <span class="sub">Next follow-up</span><br />{{
                (l.next_follow_up | date: 'd MMM y') || '—'
              }}
            </div>
            <div class="wide"><span class="sub">Notes</span><br />{{ l.notes || '—' }}</div>
          </div>
        </div>

        @if (canEdit) {
          <div class="card">
            <h2>Move this lead forward</h2>
            <div class="row">
              <mat-form-field subscriptSizing="dynamic">
                <mat-label>Status</mat-label>
                <mat-select [ngModel]="l.status" (ngModelChange)="setStatus(l, $event)">
                  @for (o of statuses; track o.value) {
                    <mat-option [value]="o.value">{{ o.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <span class="spacer"></span>
              @for (p of projects(); track p.id) {
                <a mat-stroked-button [routerLink]="['/projects', p.id]"
                  >Open project {{ p.ref_no }}</a
                >
              }
            </div>
            <h2 class="convert">
              {{
                projects().length
                  ? 'Start another project for this lead'
                  : 'Customer wants a measurement? Start the project'
              }}
            </h2>
            <div class="form-grid">
              <mat-form-field>
                <mat-label>Site address</mat-label>
                <input matInput [(ngModel)]="siteAddress" />
              </mat-form-field>
              <mat-form-field>
                <mat-label>Google Maps link</mat-label>
                <input matInput [(ngModel)]="mapUrl" placeholder="https://maps.app.goo.gl/…" />
              </mat-form-field>
            </div>
            <button mat-flat-button (click)="convert(l)" [disabled]="busy()">
              <mat-icon>assignment_add</mat-icon> Create project
            </button>
          </div>
        }

        <div class="card">
          <h2>Follow-up history</h2>
          @if (canEdit) {
            <div class="row">
              <mat-form-field class="spacer" subscriptSizing="dynamic">
                <mat-label>Add a note (call summary, what the customer said…)</mat-label>
                <input matInput [(ngModel)]="note" (keyup.enter)="addNote(l, 'note')" />
              </mat-form-field>
              <button mat-stroked-button (click)="addNote(l, 'call')">Log call</button>
              <button mat-flat-button (click)="addNote(l, 'note')">Add note</button>
            </div>
          }
          @for (a of activities(); track a.id) {
            <div class="activity">
              <span class="sub">
                {{ a.created_at | date: 'd MMM y, h:mm a' }} ·
                {{ a.profiles?.full_name || 'System' }} · {{ a.type }}
              </span>
              <div>{{ a.text }}</div>
            </div>
          } @empty {
            <div class="empty">Nothing logged yet.</div>
          }
        </div>
      </div>
    }
  `,
  styles: `
    .facts > div {
      margin-bottom: 12px;
    }
    .convert {
      margin-top: 20px !important;
    }
    .activity {
      padding: 10px 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    h1 .chip {
      vertical-align: middle;
    }
  `,
})
export class LeadDetail {
  private readonly sb = inject(Supabase);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  protected readonly canEdit = inject(Auth).can('admin', 'approver', 'sales', 'measurement');

  protected readonly statuses = LEAD_STATUSES;
  protected readonly sources = SOURCES;
  protected readonly segments = SEGMENTS;
  protected readonly interests = INTERESTS;

  protected readonly lead = signal<Lead | null>(null);
  protected readonly activities = signal<LeadActivity[]>([]);
  protected readonly projects = signal<Project[]>([]);
  protected readonly busy = signal(false);
  protected note = '';
  protected siteAddress = '';
  protected mapUrl = '';

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const db = this.sb.client;
    const [lead, activities, projects] = await Promise.all([
      this.sb.run<Lead>(db.from('leads').select('*').eq('id', this.id).single()),
      this.sb.run<LeadActivity[]>(
        db
          .from('lead_activities')
          .select('*, profiles(full_name)')
          .eq('lead_id', this.id)
          .order('created_at', { ascending: false }),
      ),
      this.sb.run<Project[]>(
        db.from('projects').select('*').eq('lead_id', this.id).order('created_at'),
      ),
    ]);
    this.lead.set(lead);
    this.activities.set(activities);
    this.projects.set(projects);
    this.siteAddress ||= lead.location ?? '';
  }

  protected wa(l: Lead): string {
    return waLink(l.phone, `Hello ${l.name}, this is Chemmanoor Metals.`);
  }

  protected edit(l: Lead): void {
    this.dialog
      .open(LeadFormDialog, { data: l })
      .afterClosed()
      .subscribe((saved) => saved && this.load());
  }

  private log(type: string, text: string): PromiseLike<unknown> {
    return this.sb.run(
      this.sb.client.from('lead_activities').insert({ lead_id: this.id, type, text }),
    );
  }

  protected async addNote(l: Lead, type: 'note' | 'call'): Promise<void> {
    const text = this.note.trim();
    if (!text) return;
    await this.log(type, text);
    if (type === 'call' && l.status === 'new') {
      await this.sb.run(
        this.sb.client.from('leads').update({ status: 'contacted' }).eq('id', l.id),
      );
    }
    this.note = '';
    await this.load();
  }

  protected async setStatus(l: Lead, status: string): Promise<void> {
    if (status === l.status) return;
    await this.sb.run(this.sb.client.from('leads').update({ status }).eq('id', l.id));
    await this.log(
      'status_change',
      `Status: ${labelOf(LEAD_STATUSES, l.status)} → ${labelOf(LEAD_STATUSES, status)}`,
    );
    await this.load();
  }

  protected async convert(l: Lead): Promise<void> {
    this.busy.set(true);
    try {
      const projectId = await this.sb.run<string>(
        this.sb.client.rpc('convert_lead', {
          p_lead: l.id,
          p_site_address: this.siteAddress,
          p_map_url: this.mapUrl,
        }),
      );
      await this.router.navigate(['/projects', projectId]);
    } finally {
      this.busy.set(false);
    }
  }
}
