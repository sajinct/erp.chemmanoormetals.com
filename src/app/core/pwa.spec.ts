import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { Pwa } from './pwa';
import { APP_VERSION } from './version';

describe('PWA installation and release updates', () => {
  let events: Subject<VersionEvent>;
  let stable: Subject<boolean>;
  let updates: {
    isEnabled: boolean;
    versionUpdates: Subject<VersionEvent>;
    unrecoverable: Subject<unknown>;
    checkForUpdate: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    events = new Subject();
    stable = new Subject();
    updates = {
      isEnabled: true,
      versionUpdates: events,
      unrecoverable: new Subject(),
      checkForUpdate: vi.fn().mockResolvedValue(false),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: SwUpdate, useValue: updates },
        { provide: ApplicationRef, useValue: { isStable: stable } },
      ],
    });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('offers a downloaded release without replacing the current running version', () => {
    const pwa = TestBed.inject(Pwa);
    events.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new', appData: { version: '1.1.0' } },
    });
    expect(pwa.readyVersion()).toBe('1.1.0');
    expect(pwa.version).toBe(APP_VERSION);
    pwa.updateDismissed.set(true);
    expect(pwa.readyVersion()).toBe('1.1.0');
    events.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'newer', appData: { version: '1.2.0' } },
    });
    expect(pwa.updateDismissed()).toBe(false);
  });

  it('checks at startup after stability and hourly thereafter', async () => {
    TestBed.inject(Pwa);
    await vi.advanceTimersByTimeAsync(1000);
    expect(updates.checkForUpdate).not.toHaveBeenCalled();
    stable.next(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(updates.checkForUpdate).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(updates.checkForUpdate).toHaveBeenCalledTimes(2);
  });

  it('reports current, offline and failed update checks accurately', async () => {
    const pwa = TestBed.inject(Pwa);
    await pwa.check();
    expect(pwa.message()).toContain(`v${APP_VERSION}`);
    window.dispatchEvent(new Event('offline'));
    await pwa.check();
    expect(pwa.message()).toContain('Connect to the internet');
    pwa.online.set(true);
    updates.checkForUpdate.mockRejectedValueOnce(new Error('Network failure'));
    await pwa.check();
    expect(pwa.message()).toContain('Couldn’t check');
    expect(pwa.checking()).toBe(false);
  });

  it('prevents duplicate checks while a download is in progress', async () => {
    let finish!: (found: boolean) => void;
    updates.checkForUpdate.mockImplementation(
      () => new Promise<boolean>((resolve) => (finish = resolve)),
    );
    const pwa = TestBed.inject(Pwa);
    const first = pwa.check();
    await pwa.check();
    expect(updates.checkForUpdate).toHaveBeenCalledTimes(1);
    finish(false);
    await first;
    expect(pwa.checking()).toBe(false);
  });

  it('uses the browser install prompt once and recognises installation', async () => {
    const pwa = TestBed.inject(Pwa);
    const prompt = vi.fn().mockResolvedValue(undefined);
    window.dispatchEvent(
      Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
        prompt,
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      }),
    );
    await pwa.install();
    expect(prompt).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('appinstalled'));
    expect(pwa.installed()).toBe(true);
    await pwa.install();
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('provides manual installation help when the browser has no prompt', async () => {
    const pwa = TestBed.inject(Pwa);
    await pwa.install();
    expect(pwa.installHelp()).toBe(true);
    events.next({
      type: 'VERSION_INSTALLATION_FAILED',
      version: { hash: 'new' },
      error: 'Offline',
    });
    expect(pwa.message()).toContain('couldn’t be downloaded');
    updates.unrecoverable.next({ reason: 'Missing cached asset' });
    expect(pwa.unrecoverable()).toBe(true);
  });
});
