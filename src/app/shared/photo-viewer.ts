import { Component, computed, effect, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Supabase } from '../core/supabase';

export interface PhotoFile {
  id: string;
  path: string;
  name: string;
}
export interface PhotoViewerData {
  photos: PhotoFile[];
  index: number;
}

/** Uses fresh signed Storage links; photos stay inside the current workspace. */
@Component({
  selector: 'app-photo-viewer',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  host: { '(keydown.arrowleft)': 'move(-1, $event)', '(keydown.arrowright)': 'move(1, $event)' },
  template: `
    <div class="viewer-header">
      <h2 mat-dialog-title>{{ photo().name }}</h2>
      <button mat-icon-button mat-dialog-close type="button" aria-label="Close photo viewer">
        <mat-icon>close</mat-icon>
      </button>
    </div>
    <mat-dialog-content class="image-content" [attr.aria-busy]="loading()">
      @if (loading()) {
        <p class="status" role="status">Loading photo…</p>
      }
      @if (error()) {
        <div class="status" role="alert">
          <mat-icon>broken_image</mat-icon>
          <p>{{ error() }}</p>
          <button mat-stroked-button type="button" (click)="reload()">Try again</button>
        </div>
      }
      @if (url() && !error()) {
        <img
          [src]="url()"
          [alt]="photo().name"
          [class.loading]="loading()"
          (load)="loaded()"
          (error)="failed()"
        />
      }
    </mat-dialog-content>
    <mat-dialog-actions class="viewer-actions">
      @if (data.photos.length > 1) {
        <button mat-icon-button type="button" (click)="move(-1)" aria-label="Previous photo">
          <mat-icon>chevron_left</mat-icon>
        </button>
        <span class="counter" aria-live="polite">{{ index() + 1 }} / {{ data.photos.length }}</span>
        <button mat-icon-button type="button" (click)="move(1)" aria-label="Next photo">
          <mat-icon>chevron_right</mat-icon>
        </button>
      }
      <span class="spacer"></span>
      @if (url()) {
        <a mat-button [href]="url()" target="_blank" rel="noopener"
          >Open original<mat-icon>open_in_new</mat-icon></a
        >
      }
      <button mat-button mat-dialog-close type="button">Close</button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .viewer-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-right: 12px;
    }
    h2 {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
      padding-right: 0;
    }
    .image-content {
      position: relative;
      display: grid;
      place-items: center;
      background: var(--surface-subtle);
      padding: 12px;
      min-height: min(320px, 40dvh);
      max-height: none;
      overflow: hidden;
    }
    img {
      display: block;
      width: 100%;
      height: calc(100dvh - 230px);
      max-width: 100%;
      max-height: calc(100dvh - 230px);
      object-fit: contain;
    }
    img.loading {
      opacity: 0;
    }
    .status {
      position: absolute;
      text-align: center;
      padding: 20px;
      color: var(--text-muted);
    }
    .status mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }
    .viewer-actions {
      gap: 4px;
      padding: 8px 12px;
      flex-wrap: wrap;
    }
    .counter {
      font-size: 12px;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }
    @media (max-width: 600px) {
      h2 {
        font-size: 16px;
      }
      .viewer-actions {
        padding: 8px 4px;
        gap: 0;
      }
      .image-content {
        padding: 4px;
      }
    }
  `,
})
export class PhotoViewer {
  protected readonly data = inject<PhotoViewerData>(MAT_DIALOG_DATA);
  protected readonly index = signal(this.data.index);
  protected readonly photo = computed(() => this.data.photos[this.index()]);
  protected readonly url = signal('');
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  private readonly retry = signal(0);
  private readonly sb = inject(Supabase);

  constructor() {
    effect((onCleanup) => {
      const photo = this.photo();
      this.retry();
      let active = true;
      onCleanup(() => {
        active = false;
      });
      this.url.set('');
      this.error.set('');
      this.loading.set(true);
      void this.sb
        .signedUrl(photo.path, 3600)
        .then((url) => {
          if (active) this.url.set(url);
        })
        .catch(() => {
          if (active) {
            this.loading.set(false);
            this.error.set('This photo could not be loaded.');
          }
        });
    });
  }
  protected move(direction: number, event?: Event) {
    if (this.data.photos.length < 2) return;
    event?.preventDefault();
    this.index.update((i) => (i + direction + this.data.photos.length) % this.data.photos.length);
  }
  protected reload() {
    this.retry.update((n) => n + 1);
  }
  protected loaded() {
    this.loading.set(false);
  }
  protected failed() {
    this.loading.set(false);
    this.error.set(
      'This format cannot be previewed, or the photo is unavailable. You can try again or open the original.',
    );
  }
}
