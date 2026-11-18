import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Profile, Role } from './models';
import { Supabase } from './supabase';

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly sb = inject(Supabase);

  readonly profile = signal<Profile | null>(null);
  readonly signedIn = signal(false);
  readonly active = computed(() => !!this.profile()?.active);
  readonly role = computed<Role | null>(() => (this.active() ? this.profile()!.role : null));

  private ready: Promise<void> | null = null;

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

  async signOut(): Promise<void> {
    await this.sb.client.auth.signOut();
    await this.setUser(null);
  }
}

/** Signed in with an activated profile, otherwise back to the login page. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.init();
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
