import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AUTH_LINK } from './auth-link';
import { Profile, Role } from './models';
import { Supabase } from './supabase';

/** Remembers, for this browser tab only, that a password reset is in progress. */
const RECOVERY_KEY = 'chemmanoor-password-recovery';
const stored = {
  get: (): boolean => {
    try {
      return sessionStorage.getItem(RECOVERY_KEY) === '1';
    } catch {
      return false;
    }
  },
  set: (on: boolean): void => {
    try {
      if (on) sessionStorage.setItem(RECOVERY_KEY, '1');
      else sessionStorage.removeItem(RECOVERY_KEY);
    } catch {
      /* Private browsing can refuse storage; the flag then lasts until a reload. */
    }
  },
};

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly sb = inject(Supabase);
  private readonly router = inject(Router);

  /**
   * True from the moment a "reset your password" email link is followed until
   * the new password is saved. While it is set, the app only shows that page.
   */
  readonly recovering = signal(AUTH_LINK.recovery || stored.get());
  private linkError = AUTH_LINK.error;

  readonly profile = signal<Profile | null>(null);
  readonly signedIn = signal(false);
  readonly active = computed(() => !!this.profile()?.active);
  readonly role = computed<Role | null>(() => (this.active() ? this.profile()!.role : null));

  private ready: Promise<void> | null = null;

  constructor() {
    stored.set(this.recovering());
    // Supabase announces a followed reset link here too. That covers the case
    // where the address had already been cleaned up before this code looked.
    this.sb.client.auth.onAuthStateChange((event) => {
      if (event !== 'PASSWORD_RECOVERY' || this.recovering()) return;
      this.recovering.set(true);
      stored.set(true);
      void this.router.navigateByUrl('/reset-password');
    });
  }

  /** The reason an emailed link was refused, reported once so the sign-in page can explain. */
  takeLinkError(): string | null {
    const error = this.linkError;
    this.linkError = null;
    return error;
  }

  private endRecovery(): void {
    this.recovering.set(false);
    stored.set(false);
  }

  /** Loads the session once; later calls reuse the result. */
  init(): Promise<void> {
    this.ready ??= this.load();
    return this.ready;
  }

  private async load(): Promise<void> {
    const { data } = await this.sb.client.auth.getSession();
    await this.setUser(data.session?.user.id ?? null);
  }

  private async setUser(id: string | null): Promise<void> {
    this.signedIn.set(!!id);
    if (!id) {
      this.profile.set(null);
      return;
    }
    const { data } = await this.sb.client.from('profiles').select('*').eq('id', id).maybeSingle();
    this.profile.set(data as Profile | null);
  }

  can(...roles: Role[]): boolean {
    const role = this.role();
    return !!role && roles.includes(role);
  }

  /** Returns an error message, or null on success. */
  async signIn(email: string, password: string): Promise<string | null> {
    const { data, error } = await this.sb.client.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    // Signing in with a password shows it is known; any half-finished reset no longer applies.
    this.endRecovery();
    await this.setUser(data.user.id);
    return null;
  }

  /** Returns an error message, or null. Not signed in afterwards means email confirmation is pending. */
  async signUp(email: string, password: string, fullName: string): Promise<string | null> {
    const { data, error } = await this.sb.client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return error.message;
    await this.setUser(data.session?.user.id ?? null);
    return null;
  }

  /**
   * Changes the signed-in person's own password. Returns an error message, or
   * null on success. Every other device signed in to the account is signed out.
   */
  async changePassword(current: string, next: string): Promise<string | null> {
    const auth = this.sb.client.auth;
    const { data } = await auth.getSession();
    const email = data.session?.user.email;
    if (!email) return 'Your session has ended. Sign in again, then change your password.';

    // Proving the current password stops someone at an unlocked screen from
    // taking over the account. It also gives the server the fresh sign-in it
    // may require before it accepts a new password.
    const check = await auth.signInWithPassword({ email, password: current });
    if (check.error) {
      return check.error.status === 400
        ? 'Your current password is not correct.'
        : check.error.message;
    }

    const { error } = await auth.updateUser({ password: next });
    if (error) return error.message;

    // The password is already changed; failing to end other sessions must not
    // be reported as a failed change.
    await auth.signOut({ scope: 'others' }).catch(() => undefined);
    return null;
  }

  /**
   * Emails a link for choosing a new password. Returns an error message, or
   * null. Succeeds whether or not the address has an account, so the form
   * cannot be used to find out who works here.
   */
  async requestPasswordReset(email: string): Promise<string | null> {
    const { error } = await this.sb.client.auth.resetPasswordForEmail(email, {
      redirectTo: environment.appUrl,
    });
    return error ? error.message : null;
  }

  /**
   * Saves the new password chosen after following a reset link. Returns an
   * error message, or null on success. Other devices are signed out.
   */
  async completeRecovery(next: string): Promise<string | null> {
    const auth = this.sb.client.auth;
    const { data } = await auth.getSession();
    if (!data.session)
      return 'This reset link has expired. Request a new one from the sign-in page.';
    const { error } = await auth.updateUser({ password: next });
    if (error) return error.message;
    await auth.signOut({ scope: 'others' }).catch(() => undefined);
    this.endRecovery();
    await this.setUser(data.session.user.id);
    return null;
  }

  async signOut(): Promise<void> {
    await this.sb.client.auth.signOut();
    this.endRecovery();
    await this.setUser(null);
  }
}

/** Signed in with an activated profile, otherwise back to the login page. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.init();
  // Someone who arrived by a reset link must choose a password before anything else.
  if (auth.recovering() && auth.signedIn()) return router.parseUrl('/reset-password');
  return auth.active() ? true : router.parseUrl('/login');
};

export const roleGuard =
  (...roles: Role[]): CanActivateFn =>
  async () => {
    const auth = inject(Auth);
    const router = inject(Router);
    await auth.init();
    return auth.can(...roles) ? true : router.parseUrl('/');
  };
