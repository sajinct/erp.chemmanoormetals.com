import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Settings } from './models';

export const BUCKET = 'project-files';

@Injectable({ providedIn: 'root' })
export class Supabase {
  readonly client: SupabaseClient = createClient(environment.supabaseUrl, environment.supabaseKey);
  private readonly snack = inject(MatSnackBar);

  /**
   * Awaits a Supabase query and returns its data. On failure it shows the
   * database's message (these are written for staff to read) and throws.
   */
  async run<T>(
    query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  ): Promise<T> {
    const { data, error } = await query;
    if (error) {
      this.error(error.message);
      throw new Error(error.message);
    }
    return data as T;
  }

  /**
   * Reads every row of a query. The API returns at most 1000 rows per request,
   * so this pages through until a short page comes back. `build` must return a
   * fresh query with a stable order on each call.
   */
  async all<T>(
    build: () => {
      range(
        from: number,
        to: number,
      ): PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
    },
  ): Promise<T[]> {
    const size = 1000;
    const rows: T[] = [];
    for (let from = 0; ; from += size) {
      const page = await this.run<T[]>(build().range(from, from + size - 1));
      rows.push(...page);
      if (page.length < size) return rows;
    }
  }

  info(message: string): void {
    this.snack.open(message, undefined, { duration: 3000 });
  }

  error(message: string): void {
    this.snack.open(message, 'Close', { duration: 8000 });
  }

  settings(): Promise<Settings> {
    return this.run<Settings>(this.client.from('settings').select('*').eq('id', 1).single());
  }

  /** A time-limited link to a stored file (default 30 days, for sharing quotes). */
  async signedUrl(path: string, seconds = 60 * 60 * 24 * 30): Promise<string> {
    const { data, error } = await this.client.storage.from(BUCKET).createSignedUrl(path, seconds);
    if (error) {
      this.error(error.message);
      throw error;
    }
    return data.signedUrl;
  }
}
