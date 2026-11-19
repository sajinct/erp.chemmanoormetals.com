import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { BUCKET, Supabase } from '../core/supabase';
import { UI } from './ui';
import { PhotoViewer } from './photo-viewer';

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
    <div class="files">
      @for (f of files(); track f.id) {
        @if (f.kind === 'photo') {
          <div class="photo-file">
            <button
              class="thumbnail"
              type="button"
              (click)="viewPhoto(f)"
              [attr.aria-label]="'View photo ' + f.name"
              [title]="'View ' + f.name"
            >
              @if (thumbnails()[f.id]; as url) {
                <img
                  [src]="url"
                  alt=""
                  [loading]="f.id === firstPhotoId() ? 'eager' : 'lazy'"
                  decoding="async"
                  (error)="thumbnailFailed(f.id)"
                />
              } @else {
                <mat-icon aria-hidden="true">image</mat-icon>
              }
            </button>
            <div class="caption">
              <span [title]="f.name">{{ f.name }}</span>
              @if (!readonly()) {
                <button
                  mat-icon-button
                  type="button"
                  (click)="remove(f)"
                  [attr.aria-label]="'Remove ' + f.name"
                  title="Remove"
                >
                  <mat-icon>close</mat-icon>
                </button>
              }
            </div>
          </div>
        } @else {
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
        }
      } @empty {
        <span class="sub">No files yet.</span>
      }
    </div>
    @if (!readonly()) {
      <label class="upload">
        <input
          type="file"
          multiple
          accept="image/*,.pdf,.dwg,.xlsx"
          (change)="upload($event)"
          [disabled]="busy()"
        />
        <span class="sub">{{
          busy() ? 'Uploading…' : 'Add site photos, sketches or documents (max 10 MB each)'
        }}</span>
      </label>
    }
  `,
  styles: `
    .files {
      display: flex;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 12px;
    }
    .photo-file {
      width: 144px;
      min-width: 0;
      padding: 4px;
      border: 1px solid var(--brand-line);
      border-radius: 10px;
      background: var(--surface);
    }
    .thumbnail {
      display: grid;
      place-items: center;
      width: 100%;
      aspect-ratio: 4/3;
      padding: 0;
      border: 0;
      border-radius: 6px;
      overflow: hidden;
      background: var(--surface-subtle);
      color: var(--text-muted);
      cursor: zoom-in;
    }
    .thumbnail img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .thumbnail:focus-visible {
      outline: 2px solid var(--brand-orange);
      outline-offset: 2px;
    }
    .caption {
      display: flex;
      align-items: center;
      min-height: 40px;
      padding-left: 6px;
      gap: 2px;
    }
    .caption span {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 12px;
      color: var(--text-muted);
    }
    .caption button {
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      padding: 8px;
    }
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
  private readonly dialog = inject(MatDialog);
  private generation = 0;
  protected readonly files = signal<Attachment[]>([]);
  protected readonly firstPhotoId = computed(
    () => this.files().find((f) => f.kind === 'photo')?.id,
  );
  protected readonly thumbnails = signal<Record<string, string>>({});
  protected readonly busy = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.generation++;
    });
    effect(() => {
      this.projectId();
      this.measurementId();
      void this.load().catch(() => {});
    });
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    let query = this.sb.client
      .from('attachments')
      .select('*')
      .eq('project_id', this.projectId())
      .order('created_at');
    const mid = this.measurementId();
    if (mid) query = query.eq('measurement_id', mid);
    const files = await this.sb.run<Attachment[]>(query);
    if (generation !== this.generation) return;
    this.files.set(files);
    this.thumbnails.set({});
    await Promise.allSettled(
      files
        .filter((f) => f.kind === 'photo')
        .map(async (f) => {
          const url = await this.sb.signedUrl(f.path, 3600);
          if (generation === this.generation)
            this.thumbnails.update((urls) => ({ ...urls, [f.id]: url }));
        }),
    );
  }

  protected thumbnailFailed(id: string) {
    this.thumbnails.update((urls) => {
      const next = { ...urls };
      delete next[id];
      return next;
    });
  }
  protected viewPhoto(file: Attachment) {
    const photos = this.files().filter((f) => f.kind === 'photo');
    const index = photos.findIndex((f) => f.id === file.id);
    if (index < 0) return;
    this.dialog.open(PhotoViewer, {
      data: { photos, index },
      width: '1100px',
      maxWidth: '96vw',
      maxHeight: '95dvh',
      autoFocus: 'first-tabbable',
      ariaLabel: 'Photo viewer',
    });
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
