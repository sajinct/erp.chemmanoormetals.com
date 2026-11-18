-- When an administrator resets someone's password, that person's existing
-- sign-ins must stop working: the usual reason for a reset is that the old
-- password is lost or known to someone else. Supabase's admin API can change
-- a password but cannot end another user's sessions, so this does it.
--
-- Deleting a session also deletes its refresh tokens. A browser that is
-- already open keeps working only until its current access token expires
-- (at most one hour), then has to sign in again.
create function public.revoke_user_sessions(p_user uuid) returns void
language sql security definer set search_path = '' as $$
  delete from auth.sessions where user_id = p_user
$$;

-- Callable only with the service key, which only the manage-users function holds.
revoke execute on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
