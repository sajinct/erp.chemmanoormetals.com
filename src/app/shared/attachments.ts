import { Component, effect, inject, input, signal } from '@angular/core';
import { BUCKET, Supabase } from '../core/supabase';
import { UI } from './ui';

interface Attachment {
  id: string;
  path: string;
  name: string;
  kind: string;
  created_at: string;
}

/** Photos, sketches and documents stored against a project (optionally one measurement). */
@Component({
  selector: 'app-attachments',
  imports: [UI],
  template: `
    <div class="row">
      @for (f of files(); track f.id) {
        <span class="file">
          <a href="" (click)="open($event, f)">
            <mat-icon inline>{{ f.kind === 'photo' ? 'image' : 'description' }}</mat-icon>
            {{ f.name }}
          </a>
          @if (!readonly()) {
            <button mat-icon-button (click)="remove(f)" aria-label="Remove file" title="Remove">
              <mat-icon>close</mat-icon>
            </button>
          }
        </span>
      } @empty {
        <span class="sub">No files yet.</span>
      }
    </div>
    @if (!readonly()) {
      <label class="upload">
        <input type="file" multiple accept="image/*,.pdf,.dwg,.xlsx" (change)="upload($event)" [disabled]="busy()" />
        <span class="sub">{{ busy() ? 'Uploading…' : 'Add site photos, sketches or documents (max 10 MB each)' }}</span>
      </label>
    }
  `,
  styles: `
    .file {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 8px;
      padding: 2px 4px 2px 10px;
      min-height: 36px;
    }
    .upload {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-top: 12px;
    }
  `,
})
export class Attachments {
  readonly projectId = input.required<string>();
  readonly measurementId = input<string | null>(null);
  readonly readonly = input(false);

  private readonly sb = inject(Supabase);
  protected readonly files = signal<Attachment[]>([]);
  protected readonly busy = signal(false);

  constructor() {
    effect(() => {
      this.projectId();
      this.measurementId();
      void this.load();
    });
  }

  private async load(): Promise<void> {
    let query = this.sb.client
      .from('attachments')
      .select('*')
      .eq('project_id', this.projectId())
      .order('created_at');
    const mid = this.measurementId();
    if (mid) query = query.eq('measurement_id', mid);
    this.files.set(await this.sb.run<Attachment[]>(query));
  }

  protected async upload(event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const picked = Array.from(inputEl.files ?? []);
    if (!picked.length) return;
    this.busy.set(true);
    try {
      for (const file of picked) {
        if (file.size > 10 * 1024 * 1024) {
          this.sb.error(`${file.name} is larger than 10 MB and was skipped`);
          continue;
        }
        const safe = file.name.replace(/[^\w.\-]+/g, '_');
        const path = `${this.projectId()}/${crypto.randomUUID()}-${safe}`;
        const { error } = await this.sb.client.storage.from(BUCKET).upload(path, file);
        if (error) {
          this.sb.error(`${file.name}: ${error.message}`);
          continue;
        }
        await this.sb.run(
          this.sb.client.from('attachments').insert({
            project_id: this.projectId(),
            measurement_id: this.measurementId(),
            path,
            name: file.name,
            kind: file.type.startsWith('image/') ? 'photo' : 'document',
          }),
        );
      }
      await this.load();
    } finally {
      this.busy.set(false);
      inputEl.value = '';
    }
  }

  protected async open(event: Event, f: Attachment): Promise<void> {
    event.preventDefault();
    // Open the tab first so the browser treats it as a direct result of the click.
    const tab = window.open('', '_blank');
    try {
      const url = await this.sb.signedUrl(f.path, 600);
      if (tab) tab.location.href = url;
    } catch {
      tab?.close();
    }
  }

  protected async remove(f: Attachment): Promise<void> {
    if (!confirm(`Remove ${f.name}?`)) return;
    await this.sb.run(this.sb.client.from('attachments').delete().eq('id', f.id));
    await this.sb.client.storage.from(BUCKET).remove([f.path]);
    await this.load();
  }
}
