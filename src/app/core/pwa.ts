import { ApplicationRef, DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';
import { filter, first, switchMap, timer } from 'rxjs';
import { APP_VERSION } from './version';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Injectable({ providedIn: 'root' })
export class Pwa {
  private readonly updates = inject(SwUpdate);
  private readonly destroyRef = inject(DestroyRef);
  private prompt: InstallPrompt | null = null;
  private lastCheck = 0;
  readonly version = APP_VERSION;
  readonly online = signal(navigator.onLine);
  readonly installed = signal(
    window.matchMedia('(display-mode: standalone)').matches ||
      !!(navigator as Navigator & { standalone?: boolean }).standalone,
  );
  readonly installing = signal(false);
  readonly checking = signal(false);
  readonly readyVersion = signal<string | null>(null);
  readonly updateDismissed = signal(false);
  readonly unrecoverable = signal(false);
  readonly message = signal('');
  readonly installHelp = signal(false);

  constructor() {
    const install = (event: Event) => {
      event.preventDefault();
      this.prompt = event as InstallPrompt;
    };
    const installed = () => {
      this.installed.set(true);
      this.prompt = null;
      this.installHelp.set(false);
    };
    const online = () => {
      this.online.set(true);
      void this.check(false);
    };
    const offline = () => this.online.set(false);
    const visible = () => {
      if (document.visibilityState === 'visible') void this.check(false);
    };
    window.addEventListener('beforeinstallprompt', install);
    window.addEventListener('appinstalled', installed);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', visible);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('beforeinstallprompt', install);
      window.removeEventListener('appinstalled', installed);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      document.removeEventListener('visibilitychange', visible);
    });
    if (!this.updates.isEnabled) return;
    this.updates.versionUpdates.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event.type === 'VERSION_READY') {
        const data = event.latestVersion.appData as { version?: string } | undefined;
        this.readyVersion.set(data?.version || 'latest');
        this.updateDismissed.set(false);
        this.message.set('');
      } else if (event.type === 'VERSION_INSTALLATION_FAILED') {
        this.message.set(
          'The update couldn’t be downloaded. You can keep using this version and try again.',
        );
      }
    });
    this.updates.unrecoverable
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.unrecoverable.set(true));
    // Start polling only after stability so registration isn't delayed by the timer.
    inject(ApplicationRef)
      .isStable.pipe(
        filter(Boolean),
        first(),
        switchMap(() => timer(0, 60 * 60 * 1000)),
        takeUntilDestroyed(),
      )
      .subscribe(() => void this.check(false));
  }

  async install(): Promise<void> {
    if (this.installed() || this.installing()) return;
    if (!this.prompt) {
      this.installHelp.set(true);
      return;
    }
    const prompt = this.prompt;
    this.prompt = null;
    this.installing.set(true);
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      this.installHelp.set(true);
    } finally {
      this.installing.set(false);
    }
  }

  async check(manual = true): Promise<void> {
    if (this.checking()) return;
    if (!this.online()) {
      if (manual) this.message.set('Connect to the internet to check for updates.');
      return;
    }
    if (!this.updates.isEnabled) {
      if (manual) this.message.set('Update checks are available in the production app.');
      return;
    }
    if (!manual && Date.now() - this.lastCheck < 60_000) return;
    this.lastCheck = Date.now();
    this.checking.set(true);
    if (manual) this.message.set('');
    try {
      const found = await this.updates.checkForUpdate();
      if (manual && !found && !this.readyVersion())
        this.message.set(`You’re using the latest version, v${this.version}.`);
    } catch {
      if (manual) this.message.set('Couldn’t check for updates. Please try again when connected.');
    } finally {
      this.checking.set(false);
    }
  }

  update(): void {
    window.location.reload();
  }
}
