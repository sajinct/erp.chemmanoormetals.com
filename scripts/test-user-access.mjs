import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// A disposable, in-memory PostgreSQL instance. No production database or credentials.
const db = new PGlite();
const root = new URL('../', import.meta.url);
const sql = async (path) => readFile(new URL(path, root), 'utf8');
const admin = '00000000-0000-0000-0000-000000000001';
const staff = '00000000-0000-0000-0000-000000000002';
const secondAdmin = '00000000-0000-0000-0000-000000000003';
const accounts = '00000000-0000-0000-0000-000000000004';
try {
  await db.exec(`
    create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
    $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
  `);
  await db.exec(await sql('supabase/migrations/20261116000001_schema.sql'));
  await db.exec(`
    grant usage on schema public to authenticated;
    grant select, update on public.profiles to authenticated;
    alter table public.profiles enable row level security;
    create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.app_role() is not null);
    create policy profiles_update on public.profiles for update to authenticated using (public.app_role() = 'admin') with check (public.app_role() = 'admin');
  `);
  await db.exec(await sql('supabase/migrations/20261118000003_admin_user_management.sql'));
  await db.exec(`
    create role anon;
    create role service_role;
    create table auth.sessions (id serial primary key, user_id uuid not null);
  `);
  await db.exec(await sql('supabase/migrations/20261118000004_revoke_user_sessions.sql'));
  const row = async (id) =>
    (
      await db.query('select full_name, phone, role, active from public.profiles where id = $1', [
        id,
      ])
    ).rows[0];
  await db.query('insert into auth.users (id, email) values ($1, $2)', [
    admin,
    'admin@example.test',
  ]);
  assert.deepEqual(await row(admin), {
    full_name: 'admin',
    phone: null,
    role: 'admin',
    active: true,
  });
  await db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [
    staff,
    'staff@example.test',
    {
      full_name: 'Staff',
      role: 'admin',
      active: true,
      erp_initial_profile: { role: 'admin', active: true },
    },
  ]);
  assert.equal((await row(staff)).role, 'sales');
  assert.equal((await row(staff)).active, false, 'Public sign-up metadata must not grant access');
  await db.query('insert into auth.users (id, email, raw_app_meta_data) values ($1, $2, $3)', [
    accounts,
    'accounts@example.test',
    { erp_initial_profile: { role: 'accounts', active: true, phone: '9000000000' } },
  ]);
  assert.deepEqual(await row(accounts), {
    full_name: 'accounts',
    phone: '9000000000',
    role: 'accounts',
    active: true,
  });
  await assert.rejects(
    () =>
      db.query('insert into auth.users (id, email, raw_app_meta_data) values ($1, $2, $3)', [
        '00000000-0000-0000-0000-000000000099',
        'invalid@example.test',
        { erp_initial_profile: { role: 'owner', active: true } },
      ]),
    /Invalid initial staff role/,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as count from auth.users where email = 'invalid@example.test'",
      )
    ).rows[0].count,
    0,
    'Account/profile creation must be atomic',
  );

  await assert.rejects(
    () => db.query('update public.profiles set active = false where id = $1', [admin]),
    /At least one active administrator/,
  );
  await assert.rejects(
    () => db.query('delete from auth.users where id = $1', [admin]),
    /At least one active administrator/,
  );
  await db.query('insert into auth.users (id, email, raw_app_meta_data) values ($1, $2, $3)', [
    secondAdmin,
    'other-admin@example.test',
    { erp_initial_profile: { role: 'admin', active: true } },
  ]);

  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: admin }),
  ]);
  await assert.rejects(
    () => db.query("update public.profiles set role = 'sales' where id = $1", [admin]),
    /cannot change your own role/,
  );
  await assert.rejects(
    () => db.query('update public.profiles set active = false where id = $1', [admin]),
    /cannot change your own role/,
  );
  await assert.rejects(
    () =>
      db.query("update public.profiles set email = 'changed@example.test' where id = $1", [staff]),
    /permission denied/,
  );
  await db.query('update public.profiles set full_name = $1, phone = $2 where id = $3', [
    'Renamed Admin',
    '12345',
    admin,
  ]);
  assert.equal((await row(admin)).full_name, 'Renamed Admin');
  await db.query("update public.profiles set role = 'measurement', active = true where id = $1", [
    staff,
  ]);
  assert.equal((await row(staff)).role, 'measurement');

  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: staff }),
  ]);
  await db.query("update public.profiles set role = 'admin' where id = $1", [staff]);
  assert.equal((await row(staff)).role, 'measurement', 'Non-admins must not change roles');
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims', '', false)");
  await db.query("update public.profiles set role = 'sales' where id = $1", [secondAdmin]);
  await assert.rejects(
    () => db.query('update public.profiles set active = false where id = $1', [admin]),
    /At least one active administrator/,
  );

  // Admin password reset: the target's sign-ins end, nobody else's, and only
  // the service key (held by the manage-users function) may do it.
  await db.query('insert into auth.sessions (user_id) values ($1), ($1), ($2)', [staff, admin]);
  const sessions = async (id) =>
    (await db.query('select count(*)::int as n from auth.sessions where user_id = $1', [id]))
      .rows[0].n;
  await db.exec('grant usage on schema public to anon, service_role');
  for (const role of ['authenticated', 'anon']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(
      () => db.query('select public.revoke_user_sessions($1)', [staff]),
      /permission denied/,
      `${role} must not be able to end sessions`,
    );
    await db.exec('reset role');
  }
  assert.equal(await sessions(staff), 2);
  await db.exec('set role service_role');
  await db.query('select public.revoke_user_sessions($1)', [staff]);
  await db.exec('reset role');
  assert.equal(await sessions(staff), 0, 'The reset user is signed out everywhere');
  assert.equal(await sessions(admin), 1, 'Other users stay signed in');

  console.log(
    'Passed PostgreSQL user-access checks: atomic creation, metadata isolation, role permissions, self-lockout, last-admin protection and session revocation on password reset.',
  );
} finally {
  await db.close();
}
