import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { UserManagementError, userManagementHandler } from './handler.ts';

// Supabase supplies these secrets to Edge Functions. They never enter the Angular bundle.
const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
const fields = 'id,full_name,email,phone,role,active';
function fail(error: { code?: string; message: string }): never {
  if (['email_exists', 'user_already_exists'].includes(error.code || ''))
    throw new UserManagementError(409, 'A user with this email already exists.');
  if (error.code === 'user_not_found')
    throw new UserManagementError(404, 'This user no longer exists.');
  if (
    ['weak_password', 'same_password', 'validation_failed', 'email_address_invalid'].includes(
      error.code || '',
    )
  )
    throw new UserManagementError(400, error.message);
  if (error.code === 'P0001') throw new UserManagementError(409, error.message);
  throw new UserManagementError(500, 'The user could not be saved. Please try again.');
}

Deno.serve(
  userManagementHandler(
    {
      async authenticate(token) {
        const { data, error } = await admin.auth.getUser(token);
        return error ? null : data.user;
      },
      async getProfile(id) {
        const { data, error } = await admin
          .from('profiles')
          .select(fields)
          .eq('id', id)
          .maybeSingle();
        if (error) fail(error);
        return data;
      },
      async create(input) {
        const { data, error } = await admin.auth.admin.createUser({
          email: input.email,
          password: input.password,
          email_confirm: true,
          user_metadata: { full_name: input.full_name },
          // Only Auth admin APIs can write app_metadata. The database trigger creates the
          // profile with these trusted initial values in the same transaction as the account.
          app_metadata: {
            erp_initial_profile: { role: input.role, active: input.active, phone: input.phone },
          },
        });
        if (error) fail(error);
        const { data: user, error: profileError } = await admin
          .from('profiles')
          .select(fields)
          .eq('id', data.user!.id)
          .single();
        if (profileError)
          throw new UserManagementError(
            500,
            'The account was created. Reload the user list before trying again.',
          );
        return user;
      },
      async resetPassword(id, password) {
        const { error } = await admin.auth.admin.updateUserById(id, { password });
        if (error) fail(error);
        const { error: sessionError } = await admin.rpc('revoke_user_sessions', { p_user: id });
        if (sessionError)
          throw new UserManagementError(
            500,
            'The password was changed, but existing sign-ins could not be ended. Try again.',
          );
      },
      async update(id, changes) {
        const { data, error } = await admin
          .from('profiles')
          .update(changes)
          .eq('id', id)
          .select(fields)
          .single();
        if (error) fail(error);
        return data;
      },
    },
    Deno.env.get('APP_ORIGIN') || 'https://erp.chemmanoormetals.com',
  ),
);
