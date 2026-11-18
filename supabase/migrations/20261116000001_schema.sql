-- Chemmanoor Metals ERP, phase 1: CRM, measurements, quotes, payments.

-- ---------------------------------------------------------------------------
-- Users and roles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  role text not null default 'sales'
    check (role in ('admin', 'approver', 'sales', 'measurement', 'accounts')),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

-- Role of the signed-in user, or null when there is no active profile.
create function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and active
$$;

create function public.has_role(variadic roles text[]) returns boolean
language sql stable set search_path = public as $$
  select coalesce(app_role() = any (roles), false)
$$;

-- The first person to sign up becomes the active admin; everyone after that
-- waits for an admin to activate them and set a role.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  is_first boolean;
begin
  select not exists (select 1 from profiles) into is_first;
  insert into profiles (id, full_name, email, role, active)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    case when is_first then 'admin' else 'sales' end,
    is_first
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Numbering: L-2026-0001, CM-2026-0001, Q-2026-0001
-- ---------------------------------------------------------------------------
create table public.counters (
  key text primary key,
  value integer not null
);

create function public.next_number(prefix text) returns text
language plpgsql security definer set search_path = public as $$
declare
  k text := prefix || '-' || to_char(now(), 'YYYY');
  v integer;
begin
  insert into counters (key, value) values (k, 1)
  on conflict (key) do update set value = counters.value + 1
  returning value into v;
  return k || '-' || lpad(v::text, 4, '0');
end $$;

-- ---------------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  ref_no text not null unique default public.next_number('L'),
  name text not null,
  phone text not null,
  email text,
  location text,
  source text not null default 'other'
    check (source in ('social_media', 'google_sheet', 'referral', 'website', 'walk_in', 'other')),
  referred_by text,
  segment text not null default 'residential'
    check (segment in ('residential', 'commercial', 'industrial')),
  interest text not null default 'shutter'
    check (interest in ('shutter', 'gate', 'pergola', 'perforated', 'service', 'material', 'other')),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'measurement_scheduled', 'quoted', 'confirmed', 'lost')),
  assigned_to uuid references public.profiles,
  next_follow_up date,
  notes text,
  created_by uuid default auth.uid() references public.profiles,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_phone_idx on public.leads (phone);
create index leads_status_idx on public.leads (status);

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger leads_touch before update on public.leads
  for each row execute function public.touch_updated_at();

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads on delete cascade,
  type text not null default 'note'
    check (type in ('note', 'call', 'status_change', 'message')),
  text text not null,
  created_by uuid default auth.uid() references public.profiles,
  created_at timestamptz not null default now()
);
create index lead_activities_lead_idx on public.lead_activities (lead_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Customers and projects
-- ---------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  address text,
  gstin text,
  created_at timestamptz not null default now()
);
create index customers_phone_idx on public.customers (phone);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  ref_no text not null unique default public.next_number('CM'),
  customer_id uuid not null references public.customers,
  lead_id uuid references public.leads on delete set null,
  segment text not null default 'residential'
    check (segment in ('residential', 'commercial', 'industrial')),
  interest text not null default 'shutter',
  site_address text,
  map_url text,
  status text not null default 'measurement'
    check (status in ('measurement', 'quoted', 'confirmed', 'cancelled')),
  customer_confirmed_at timestamptz,
  created_by uuid default auth.uid() references public.profiles,
  created_at timestamptz not null default now()
);
create index projects_customer_idx on public.projects (customer_id);

-- ---------------------------------------------------------------------------
-- Product and rate list
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'shutter'
    check (category in ('shutter', 'gate', 'pergola', 'perforated', 'accessory', 'service')),
  name text not null unique,
  unit text not null default 'sqft' check (unit in ('sqft', 'rft', 'nos', 'lot')),
  rate numeric(12, 2) not null default 0 check (rate >= 0),
  gst_percent numeric(5, 2) not null default 18 check (gst_percent >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Measurements (numbered revisions; one final per project)
-- ---------------------------------------------------------------------------
create table public.measurements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  revision_no integer not null default 0,
  unit text not null default 'ft' check (unit in ('ft', 'in', 'cm', 'mm')),
  measured_by uuid default auth.uid() references public.profiles,
  measured_on date not null default current_date,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'final')),
  approved_by uuid references public.profiles,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (project_id, revision_no)
);
create unique index measurements_one_final on public.measurements (project_id)
  where status = 'final';

create table public.measurement_items (
  id uuid primary key default gen_random_uuid(),
  measurement_id uuid not null references public.measurements on delete cascade,
  product_id uuid references public.products,
  position text,
  width numeric(10, 2) not null default 0 check (width >= 0),
  height numeric(10, 2) not null default 0 check (height >= 0),
  qty integer not null default 1 check (qty > 0),
  operation text,
  material text,
  finish text,
  remarks text,
  sort integer not null default 0
);
create index measurement_items_m_idx on public.measurement_items (measurement_id, sort);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  measurement_id uuid references public.measurements on delete set null,
  path text not null,
  name text not null,
  kind text not null default 'photo' check (kind in ('photo', 'sketch', 'document')),
  created_by uuid default auth.uid() references public.profiles,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Quotes
-- ---------------------------------------------------------------------------
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_no text not null unique default public.next_number('Q'),
  project_id uuid not null references public.projects on delete cascade,
  measurement_id uuid not null references public.measurements,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'rejected')),
  subtotal numeric(14, 2) not null default 0,
  discount numeric(14, 2) not null default 0 check (discount >= 0),
  gst_percent numeric(5, 2) not null default 18 check (gst_percent >= 0),
  gst_amount numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  terms text,
  valid_until date,
  pdf_path text,
  created_by uuid default auth.uid() references public.profiles,
  created_at timestamptz not null default now()
);
create unique index quotes_one_accepted on public.quotes (project_id)
  where status = 'accepted';

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes on delete cascade,
  product_id uuid references public.products,
  description text not null default '',
  qty numeric(12, 2) not null default 1,
  unit text not null default 'sqft',
  rate numeric(12, 2) not null default 0,
  amount numeric(14, 2) not null default 0,
  sort integer not null default 0
);
create index quote_items_q_idx on public.quote_items (quote_id, sort);

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  kind text not null default 'advance' check (kind in ('advance', 'part', 'final')),
  amount numeric(14, 2) not null check (amount > 0),
  mode text not null default 'bank' check (mode in ('cash', 'bank', 'upi', 'cheque')),
  reference text,
  received_on date not null default current_date,
  received_by uuid default auth.uid() references public.profiles,
  confirmation_sent_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index payments_project_idx on public.payments (project_id);

-- ---------------------------------------------------------------------------
-- Settings (single row)
-- ---------------------------------------------------------------------------
create table public.settings (
  id integer primary key default 1 check (id = 1),
  company_name text not null default 'Chemmanoor Metals',
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  gstin text not null default '',
  bank_name text not null default '',
  bank_account_name text not null default '',
  bank_account_no text not null default '',
  bank_ifsc text not null default '',
  upi_id text not null default '',
  quote_terms text not null default '',
  quote_validity_days integer not null default 15,
  msg_measurement text not null default '',
  msg_quote text not null default '',
  msg_receipt text not null default ''
);

-- ---------------------------------------------------------------------------
-- Balance per project: accepted quote (or else the latest sent quote) minus
-- payments received.
-- ---------------------------------------------------------------------------
create view public.project_balances with (security_invoker = true) as
select
  p.id as project_id,
  coalesce(q.total, 0) as quote_total,
  coalesce(pay.paid, 0) as paid,
  coalesce(q.total, 0) - coalesce(pay.paid, 0) as balance
from public.projects p
left join lateral (
  select total from public.quotes
  where project_id = p.id and status in ('accepted', 'sent')
  order by (status = 'accepted') desc, created_at desc
  limit 1
) q on true
left join lateral (
  select sum(amount) as paid from public.payments where project_id = p.id
) pay on true;
