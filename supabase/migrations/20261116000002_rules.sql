-- Business rules (triggers, functions) and row level security.

-- ---------------------------------------------------------------------------
-- Measurements: revision numbering, approver-only finalise, final is locked
-- ---------------------------------------------------------------------------
create function public.measurements_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'final' then
      raise exception 'A new revision cannot be created as final';
    end if;
    select coalesce(max(revision_no), 0) + 1 into new.revision_no
    from measurements where project_id = new.project_id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status = 'final' then
      raise exception 'A final measurement cannot be deleted';
    end if;
    return old;
  end if;

  new.revision_no := old.revision_no;
  new.project_id := old.project_id;

  if old.status = 'final' then
    if new.status = 'final' then
      raise exception 'This measurement is final and cannot be changed. Reopen it or add a new revision.';
    end if;
    if not has_role('approver', 'admin') then
      raise exception 'Only the approver can reopen a final measurement';
    end if;
    if exists (select 1 from quotes where measurement_id = old.id and status = 'accepted') then
      raise exception 'An accepted quote is based on this measurement; it cannot be reopened';
    end if;
    new.approved_by := null;
    new.approved_at := null;
  elsif new.status = 'final' then
    if not has_role('approver', 'admin') then
      raise exception 'Only the approver can finalise a measurement';
    end if;
    new.approved_by := auth.uid();
    new.approved_at := now();
  end if;
  return new;
end $$;

create trigger measurements_guard
  before insert or update or delete on public.measurements
  for each row execute function public.measurements_guard();

create function public.measurement_items_guard() returns trigger
language plpgsql set search_path = public as $$
declare
  mid uuid;
begin
  if tg_op = 'DELETE' then mid := old.measurement_id; else mid := new.measurement_id; end if;
  if exists (select 1 from measurements where id = mid and status = 'final') then
    raise exception 'This measurement is final; its items cannot be changed';
  end if;
  if tg_op = 'UPDATE' and new.measurement_id <> old.measurement_id then
    raise exception 'An item cannot be moved to another measurement';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger measurement_items_guard
  before insert or update or delete on public.measurement_items
  for each row execute function public.measurement_items_guard();

-- Copy an existing revision (or start empty) as the next revision.
create function public.new_revision(p_project uuid, p_from uuid default null) returns uuid
language plpgsql set search_path = public as $$
declare
  new_id uuid;
begin
  insert into measurements (project_id, unit, notes)
  select p_project, coalesce(m.unit, 'ft'), m.notes
  from (select 1) one
  left join measurements m on m.id = p_from and m.project_id = p_project
  returning id into new_id;

  if p_from is not null then
    insert into measurement_items
      (measurement_id, product_id, position, width, height, qty, operation, material, finish, remarks, sort)
    select new_id, product_id, position, width, height, qty, operation, material, finish, remarks, sort
    from measurement_items i
    join measurements m on m.id = i.measurement_id
    where i.measurement_id = p_from and m.project_id = p_project;
  end if;
  return new_id;
end $$;

-- ---------------------------------------------------------------------------
-- Quotes must be based on the project's final measurement
-- ---------------------------------------------------------------------------
create function public.quotes_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.measurement_id <> old.measurement_id then
    if not exists (
      select 1 from measurements
      where id = new.measurement_id and project_id = new.project_id and status = 'final'
    ) then
      raise exception 'A quote can only be made from the final measurement of this project';
    end if;
  end if;
  return new;
end $$;

create trigger quotes_guard
  before insert or update on public.quotes
  for each row execute function public.quotes_guard();

-- ---------------------------------------------------------------------------
-- Status follows the work: quote sent -> quoted, advance received -> confirmed
-- ---------------------------------------------------------------------------
create function public.quotes_status_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('sent', 'accepted') then
    update projects set status = 'quoted'
    where id = new.project_id and status = 'measurement';
    update leads set status = 'quoted'
    where id = (select lead_id from projects where id = new.project_id)
      and status in ('new', 'contacted', 'measurement_scheduled');
  end if;
  return new;
end $$;

create trigger quotes_status_sync
  after insert or update of status on public.quotes
  for each row execute function public.quotes_status_sync();

create function public.payments_status_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'advance' then
    update projects set status = 'confirmed'
    where id = new.project_id and status in ('measurement', 'quoted');
    update leads set status = 'confirmed'
    where id = (select lead_id from projects where id = new.project_id)
      and status <> 'confirmed';
  end if;
  return new;
end $$;

create trigger payments_status_sync
  after insert on public.payments
  for each row execute function public.payments_status_sync();

-- ---------------------------------------------------------------------------
-- Lead -> customer + project, in one transaction
-- ---------------------------------------------------------------------------
create function public.convert_lead(p_lead uuid, p_site_address text, p_map_url text) returns uuid
language plpgsql set search_path = public as $$
declare
  l leads;
  c uuid;
  p uuid;
begin
  select * into l from leads where id = p_lead for update;
  if not found then
    raise exception 'Lead not found';
  end if;

  select id into c from customers where phone = l.phone order by created_at limit 1;
  if c is null then
    insert into customers (name, phone, email, address)
    values (l.name, l.phone, l.email, coalesce(nullif(p_site_address, ''), l.location))
    returning id into c;
  end if;

  insert into projects (customer_id, lead_id, segment, interest, site_address, map_url)
  values (c, l.id, l.segment, l.interest, coalesce(nullif(p_site_address, ''), l.location), nullif(p_map_url, ''))
  returning id into p;

  update leads set status = 'measurement_scheduled'
  where id = p_lead and status in ('new', 'contacted');

  insert into lead_activities (lead_id, type, text)
  values (p_lead, 'status_change', 'Converted to project');
  return p;
end $$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
revoke all on public.counters from authenticated, anon;

alter table public.counters enable row level security; -- reached only through next_number()

do $$
declare
  t text;
  spec record;
begin
  -- Everyone with an active profile can read everything.
  foreach t in array array[
    'leads', 'lead_activities', 'customers', 'projects', 'products', 'measurements',
    'measurement_items', 'attachments', 'quotes', 'quote_items', 'payments', 'settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.app_role() is not null)',
      t || '_read', t);
  end loop;

  -- Who may insert/update, and who may delete, per table.
  for spec in
    select * from (values
      ('leads',             '{admin,approver,sales,measurement}', '{admin}'),
      ('lead_activities',   '{admin,approver,sales,measurement}', '{admin}'),
      ('customers',         '{admin,approver,sales,measurement}', '{admin}'),
      ('projects',          '{admin,approver,sales,measurement}', '{admin}'),
      ('measurements',      '{admin,approver,sales,measurement}', '{admin,approver,sales,measurement}'),
      ('measurement_items', '{admin,approver,sales,measurement}', '{admin,approver,sales,measurement}'),
      ('attachments',       '{admin,approver,sales,measurement}', '{admin,approver,sales,measurement}'),
      ('products',          '{admin,approver}',                   '{admin}'),
      ('quotes',            '{admin,approver,sales}',             '{admin,approver,sales}'),
      ('quote_items',       '{admin,approver,sales}',             '{admin,approver,sales}'),
      ('payments',          '{admin,accounts}',                   '{admin}'),
      ('settings',          '{admin}',                            '{}')
    ) as s (tbl, writers, deleters)
  loop
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.app_role() = any (%L::text[]))',
      spec.tbl || '_insert', spec.tbl, spec.writers);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.app_role() = any (%L::text[])) with check (public.app_role() = any (%L::text[]))',
      spec.tbl || '_update', spec.tbl, spec.writers, spec.writers);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.app_role() = any (%L::text[]))',
      spec.tbl || '_delete', spec.tbl, spec.deleters);
  end loop;
end $$;

-- Profiles: you can always see your own row (to learn you are waiting for
-- activation); active users see everyone; only admins change roles.
alter table public.profiles enable row level security;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.app_role() is not null);
create policy profiles_update on public.profiles for update to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

-- ---------------------------------------------------------------------------
-- File storage: measurement photos, sketches and quote PDFs
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do nothing;

create policy project_files_read on storage.objects for select to authenticated
  using (bucket_id = 'project-files' and public.app_role() is not null);
create policy project_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files' and public.app_role() is not null);
create policy project_files_update on storage.objects for update to authenticated
  using (bucket_id = 'project-files' and public.app_role() is not null);
create policy project_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'project-files' and public.app_role() is not null);
