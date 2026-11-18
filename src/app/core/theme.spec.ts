import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Theme } from './theme';

describe('ERP appearance', () => {
  let media: EventTarget & { matches: boolean };
  let saved: Map<string, string>;

  beforeEach(() => {
    media = Object.assign(new EventTarget(), { matches: false });
    saved = new Map();
    vi.stubGlobal('matchMedia', () => media);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => saved.get(key) || null,
      setItem: (key: string, value: string) => saved.set(key, value),
    });
    TestBed.configureTestingModule({});
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute('data-theme');
  });

  it('follows the device theme until a user explicitly chooses a theme', () => {
    const theme = TestBed.inject(Theme);
    expect(theme.preference()).toBe('system');
    media.matches = true;
    media.dispatchEvent(Object.assign(new Event('change'), { matches: true }));
    TestBed.tick();
    expect(document.documentElement.dataset['theme']).toBe('dark');
    theme.set('light');
    TestBed.tick();
    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(saved.get('chemmanoor-theme')).toBe('light');
    theme.set('system');
    TestBed.tick();
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('restores a saved preference and tolerates unavailable browser storage', () => {
    saved.set('chemmanoor-theme', 'dark');
    const theme = TestBed.inject(Theme);
    TestBed.tick();
    expect(theme.dark()).toBe(true);
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => theme.set('light')).not.toThrow();
    TestBed.tick();
    expect(document.documentElement.dataset['theme']).toBe('light');
  });
});
