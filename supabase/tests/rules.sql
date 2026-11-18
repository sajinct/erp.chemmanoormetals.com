-- Checks the database rules end to end as different staff roles.
-- Everything runs in one transaction that is rolled back, so no data is left.
-- Run: docker exec -i supabase_db_erp.chemmanoormetals.com psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/rules.sql
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'sales@test.local'),
  ('00000000-0000-0000-0000-0000000000a3', 'approver@test.local'),
  ('00000000-0000-0000-0000-0000000000a4', 'accounts@test.local'),
  ('00000000-0000-0000-0000-0000000000a5', 'pending@test.local');

do $$
declare
  admin_id    uuid := '00000000-0000-0000-0000-0000000000a1';
  sales_id    uuid := '00000000-0000-0000-0000-0000000000a2';
  approver_id uuid := '00000000-0000-0000-0000-0000000000a3';
  accounts_id uuid := '00000000-0000-0000-0000-0000000000a4';
  pending_id  uuid := '00000000-0000-0000-0000-0000000000a5';
  had_users boolean;
  lead1 uuid; lead2 uuid; ref1 text; ref2 text;
  proj uuid; m1 uuid; m2 uuid; q1 uuid;
  prod uuid;
  n integer;
  failed boolean;
  msg text;
begin
  -- First ever sign-up becomes the active admin (only checkable on an empty database).
  select count(*) > 5 into had_users from profiles;
  if not had_users then
    assert (select role = 'admin' and active from profiles where id = admin_id), 'first user should be active admin';
  end if;
  assert (select role = 'sales' and not active from profiles where id = pending_id), 'later users start inactive';
  update profiles set role = 'admin', active = true where id = admin_id;
  update profiles set role = 'sales', active = true where id = sales_id;
  update profiles set role = 'approver', active = true where id = approver_id;
  update profiles set role = 'accounts', active = true where id = accounts_id;
  select id into prod from products where name = 'Aluminium shutter';

  -- ---- Sales: lead, project, measurement ----
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', sales_id, 'role', 'authenticated')::text, true);

  insert into leads (name, phone) values ('Test One', '919000000001') returning id, ref_no into lead1, ref1;
  insert into leads (name, phone) values ('Test Two', '919000000002') returning id, ref_no into lead2, ref2;
  assert ref1 like 'L-%' and ref1 <> ref2, 'lead numbers are generated and unique';

  proj := convert_lead(lead1, 'Site road, Thrissur', 'https://maps.example/x');
  assert (select ref_no like 'CM-%' from projects where id = proj), 'project ref generated';
  assert (select status = 'measurement_scheduled' from leads where id = lead1), 'lead moves to measurement';
  assert (select count(*) = 1 from customers where phone = '919000000001'), 'customer created';

  m1 := new_revision(proj, null);
  assert (select revision_no = 1 from measurements where id = m1), 'first revision is R1';
  insert into measurement_items (measurement_id, product_id, position, width, height, qty)
  values (m1, prod, 'Front', 10, 8, 1);
  update measurements set status = 'submitted' where id = m1;

  failed := false;
  begin
    update measurements set status = 'final' where id = m1;
  exception when others then
    failed := true; get stacked diagnostics msg = message_text;
  end;
  assert failed and msg like 'Only the approver%', 'sales cannot finalise: ' || coalesce(msg, 'no error');

  failed := false;
  begin
    insert into quotes (project_id, measurement_id) values (proj, m1);
  exception when others then failed := true;
  end;
  assert failed, 'no quote before a final measurement';

  -- ---- Approver: finalise, lock ----
  perform set_config('request.jwt.claims', json_build_object('sub', approver_id, 'role', 'authenticated')::text, true);
  update measurements set status = 'final' where id = m1;
  assert (select approved_by = approver_id and approved_at is not null from measurements where id = m1), 'approval recorded';

  failed := false;
  begin
    update measurements set notes = 'changed' where id = m1;
  exception when others then failed := true;
  end;
  assert failed, 'final measurement is locked';

  failed := false;
  begin
    insert into measurement_items (measurement_id, width, height) values (m1, 1, 1);
  exception when others then failed := true;
  end;
  assert failed, 'items of a final measurement are locked';

  m2 := new_revision(proj, m1);
  assert (select revision_no = 2 from measurements where id = m2), 'copy becomes R2';
  assert (select count(*) = 1 from measurement_items where measurement_id = m2), 'items copied';
  failed := false;
  begin
    update measurements set status = 'final' where id = m2;
  exception when others then failed := true;
  end;
  assert failed, 'only one final revision per project';

  -- ---- Sales: quote ----
  perform set_config('request.jwt.claims', json_build_object('sub', sales_id, 'role', 'authenticated')::text, true);
  failed := false;
  begin
    insert into quotes (project_id, measurement_id) values (proj, m2);
  exception when others then failed := true;
  end;
  assert failed, 'quote must use the final revision';

  insert into quotes (project_id, measurement_id, subtotal, gst_amount, total)
  values (proj, m1, 36000, 6480, 42480) returning id into q1;
  assert (select quote_no like 'Q-%' from quotes where id = q1), 'quote number generated';
  update quotes set status = 'sent' where id = q1;
  assert (select status = 'quoted' from projects where id = proj), 'project becomes quoted';
  assert (select status = 'quoted' from leads where id = lead1), 'lead becomes quoted';

  failed := false;
  begin
    insert into payments (project_id, kind, amount) values (proj, 'advance', 100);
  exception when others then failed := true;
  end;
  assert failed, 'sales cannot record payments';

  -- ---- Accounts: advance ----
  perform set_config('request.jwt.claims', json_build_object('sub', accounts_id, 'role', 'authenticated')::text, true);
  insert into payments (project_id, kind, amount, mode) values (proj, 'advance', 20000, 'upi');
  assert (select status = 'confirmed' from projects where id = proj), 'advance confirms the project';
  assert (select status = 'confirmed' from leads where id = lead1), 'advance confirms the lead';
  assert (select quote_total = 42480 and paid = 20000 and balance = 22480 from project_balances where project_id = proj),
    'balance is quote minus payments';

  failed := false;
  begin
    update settings set company_name = 'x' where id = 1;
    get diagnostics n = row_count;
    failed := n = 0;
  exception when others then failed := true;
  end;
  assert failed, 'only admin changes settings';

  -- ---- Approver: cannot reopen once a quote is accepted ----
  perform set_config('request.jwt.claims', json_build_object('sub', sales_id, 'role', 'authenticated')::text, true);
  update quotes set status = 'accepted' where id = q1;
  perform set_config('request.jwt.claims', json_build_object('sub', approver_id, 'role', 'authenticated')::text, true);
  failed := false;
  begin
    update measurements set status = 'submitted' where id = m1;
  exception when others then failed := true;
  end;
  assert failed, 'measurement behind an accepted quote stays final';

  -- ---- Not yet activated: sees nothing, changes nothing ----
  perform set_config('request.jwt.claims', json_build_object('sub', pending_id, 'role', 'authenticated')::text, true);
  assert (select count(*) = 0 from leads), 'inactive user reads no leads';
  assert (select count(*) = 1 from profiles), 'inactive user sees only their own profile';
  failed := false;
  begin
    insert into leads (name, phone) values ('Nope', '919000000009');
  exception when others then failed := true;
  end;
  assert failed, 'inactive user cannot add leads';
  update profiles set active = true, role = 'admin' where id = pending_id;
  get diagnostics n = row_count;
  assert n = 0, 'inactive user cannot activate themselves';

  perform set_config('role', 'postgres', true);
  raise notice 'ALL RULE CHECKS PASSED';
end $$;

rollback;
