-- Admin-created accounts receive their profile atomically through trusted Auth app metadata.
-- Public sign-up still creates inactive sales staff (except the initial bootstrap admin).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  is_first boolean;
  initial jsonb := new.raw_app_meta_data -> 'erp_initial_profile';
begin
  perform pg_advisory_xact_lock(hashtext('erp_profile_bootstrap'));
  select not exists (select 1 from profiles) into is_first;
  if initial is not null then
    if coalesce(initial ->> 'role', '') not in ('admin', 'approver', 'sales', 'measurement', 'accounts')
       or jsonb_typeof(initial -> 'active') is distinct from 'boolean' then
      raise exception 'Invalid initial staff role or status';
    end if;
  end if;
  insert into profiles (id, full_name, email, phone, role, active)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(initial ->> 'phone', ''),
    case when initial is not null then initial ->> 'role' when is_first then 'admin' else 'sales' end,
    case when initial is not null then (initial ->> 'active')::boolean else is_first end
  );
  return new;
end $$;

-- Protect these rules even when an administrator calls the database directly.
create function public.guard_profile_access() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  removing_admin boolean;
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then raise exception 'A user ID cannot be changed'; end if;
    if auth.uid() = old.id and (new.role is distinct from old.role or new.active is distinct from old.active) then
      raise exception 'You cannot change your own role or disable your own account';
    end if;
    removing_admin := old.role = 'admin' and old.active and (new.role <> 'admin' or not new.active);
  else
    if auth.uid() = old.id then raise exception 'You cannot delete your own account'; end if;
    removing_admin := old.role = 'admin' and old.active;
  end if;
  if removing_admin then
    perform pg_advisory_xact_lock(hashtext('erp_active_admins'));
    if not exists (select 1 from profiles where id <> old.id and role = 'admin' and active) then
      raise exception 'At least one active administrator is required';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger profiles_guard_access before update or delete on public.profiles
  for each row execute function public.guard_profile_access();

-- Email belongs to Auth. Keep the profile email consistent and immutable from the browser.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, role, active) on public.profiles to authenticated;
