import { Component, computed, inject, signal } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { INTERESTS, SEGMENTS, SOURCES } from '../../core/models';
import { Supabase } from '../../core/supabase';
import {
  Checked,
  ImportedLead,
  LEAD_COLUMNS,
  checkLeadRows,
  exportXlsx,
  readFile,
} from '../../shared/excel';
import { UI } from '../../shared/ui';

/** Upload an Excel/CSV sheet of leads, review each row, then save the valid ones. */
@Component({
  selector: 'app-lead-import-dialog',
  imports: [UI],
  template: `
    <h2 mat-dialog-title>Import leads from Excel</h2>
    <mat-dialog-content>
      <p class="sub">
        Use an .xlsx or .csv file with a header row. From Google Sheets: File &gt; Download &gt;
        Microsoft Excel. Columns: Name, Phone, Email, Location, Source, Referred By, Segment,
        Interest, Notes.
        <button mat-button type="button" (click)="template()" [disabled]="templateBusy()">
          {{ templateBusy() ? 'Creating template…' : 'Download a blank template' }}
        </button>
      </p>
      <input
        type="file"
        accept=".xlsx,.csv"
        aria-label="Choose leads spreadsheet"
        (change)="pick($event)"
        [disabled]="busy() || reading()"
      />
      @if (reading()) {
        <p role="status">Reading spreadsheet and checking existing leads…</p>
      }

      @if (rows().length) {
        <p>
          <strong>{{ valid().length }}</strong> rows ready to import,
          <strong>{{ rows().length - valid().length }}</strong> skipped.
        </p>
        <div class="table-wrap preview">
          <table class="tbl">
            <thead>
              <tr>
                <th>Line</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Source</th>
                <th>Segment</th>
                <th>Interest</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              @for (r of rows(); track r.line) {
                <tr>
                  <td>{{ r.line }}</td>
                  <td>{{ r.value.name }}</td>
                  <td>{{ r.value.phone }}</td>
                  <td>{{ r.value.source | label: sources }}</td>
                  <td>{{ r.value.segment | label: segments }}</td>
                  <td>{{ r.value.interest | label: interests }}</td>
                  <td>
                    @if (r.errors.length) {
                      <span class="error-text">{{ r.errors.join('; ') }}</span>
                    } @else {
                      OK
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      @if (message()) {
        <p class="error-text" role="alert">{{ message() }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button (click)="save()" [disabled]="busy() || reading() || !valid().length">
        Import {{ valid().length || '' }} leads
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .preview {
      max-height: 320px;
      overflow-y: auto;
    }
  `,
})
export class LeadImportDialog {
  private readonly sb = inject(Supabase);
  private readonly ref = inject(MatDialogRef<LeadImportDialog, boolean>);

  protected readonly sources = SOURCES;
  protected readonly segments = SEGMENTS;
  protected readonly interests = INTERESTS;
  protected readonly rows = signal<Checked<ImportedLead>[]>([]);
  protected readonly valid = computed(() => this.rows().filter((r) => !r.errors.length));
  protected readonly busy = signal(false);
  protected readonly reading = signal(false);
  protected readonly templateBusy = signal(false);
  protected readonly message = signal('');

  protected async template(): Promise<void> {
    if (this.templateBusy()) return;
    this.templateBusy.set(true);
    this.message.set('');
    try {
      await exportXlsx('leads-template.xlsx', LEAD_COLUMNS, []);
    } catch {
      this.message.set('The Excel template could not be created. Please try again.');
    } finally {
      this.templateBusy.set(false);
    }
  }

  protected async pick(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.reading.set(true);
    this.rows.set([]);
    this.message.set('');
    let parsed = false;
    try {
      const sheet = await readFile(file);
      parsed = true;
      if (!sheet.length) {
        this.message.set('No rows found below the header row.');
        return;
      }
      const existing = await this.sb.all<{ phone: string }>(() =>
        this.sb.client.from('leads').select('phone').order('id'),
      );
      this.rows.set(
        checkLeadRows(
          sheet,
          existing.map((l) => l.phone),
        ),
      );
    } catch {
      this.message.set(
        parsed
          ? 'Existing leads could not be checked. Please try again.'
          : 'This file could not be read. Save it as .xlsx or .csv and try again.',
      );
    } finally {
      this.reading.set(false);
    }
  }

  protected async save(): Promise<void> {
    this.busy.set(true);
    try {
      await this.sb.run(this.sb.client.from('leads').insert(this.valid().map((r) => r.value)));
      this.sb.info(`${this.valid().length} leads imported`);
      this.ref.close(true);
    } catch {
      this.busy.set(false);
    }
  }
}
