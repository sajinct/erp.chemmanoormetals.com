import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemePreference = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'chemmanoor-theme';

@Injectable({ providedIn: 'root' })
export class Theme {
  private readonly document = inject(DOCUMENT);
  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly systemDark = signal(this.media.matches);
  readonly preference = signal<ThemePreference>(this.readPreference());
  readonly dark = computed(
    () => this.preference() === 'dark' || (this.preference() === 'system' && this.systemDark()),
  );

  constructor() {
    const change = (event: MediaQueryListEvent) => this.systemDark.set(event.matches);
    this.media.addEventListener('change', change);
    inject(DestroyRef).onDestroy(() => this.media.removeEventListener('change', change));
    effect(() => {
      this.document.documentElement.dataset['theme'] = this.dark() ? 'dark' : 'light';
      this.document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', this.dark() ? '#101722' : '#202b3b');
    });
  }

  set(preference: ThemePreference): void {
    this.preference.set(preference);
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      /* A blocked store still allows a session preference. */
    }
  }

  private readPreference(): ThemePreference {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === 'light' || value === 'dark' ? value : 'system';
    } catch {
      return 'system';
    }
  }
}
