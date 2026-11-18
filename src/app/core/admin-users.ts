import { Injectable, inject } from '@angular/core';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Profile, Role } from './models';
import { Supabase } from './supabase';

export interface StaffDetails {
  full_name: string;
  phone: string | null;
  role: Role;
  active: boolean;
}
export interface NewStaff extends StaffDetails {
  email: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class AdminUsers {
  private readonly sb = inject(Supabase);
  create(details: NewStaff): Promise<Profile> {
    return this.request({ action: 'create', ...details });
  }
  update(id: string, details: StaffDetails): Promise<Profile> {
    return this.request({ action: 'update', id, ...details });
  }

  private async request(body: object): Promise<Profile> {
    const { data, error } = await this.sb.client.functions.invoke<{ user: Profile }>(
      'manage-users',
      { body },
    );
    if (error) {
      let message = 'Could not save the user. Check your connection and try again.';
      if (error instanceof FunctionsHttpError) {
        try {
          const response = await error.context.json();
          if (typeof response.error === 'string') message = response.error;
        } catch {
          /* Keep the actionable fallback. */
        }
      }
      throw new Error(message);
    }
    if (!data?.user) throw new Error('The user could not be saved. Reload the list and try again.');
    return data.user;
  }
}
