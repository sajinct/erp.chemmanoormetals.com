import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
try {
  await db.exec(
    `create role authenticated; create schema auth; create function auth.uid() returns uuid language sql stable as $$select '00000000-0000-0000-0000-000000000001'::uuid$$; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');`,
  );
  await db.exec(await readFile('supabase/migrations/20261116000001_schema.sql', 'utf8'));
  await db.exec(`insert into settings(id,quote_terms) values(1,'1. 50% advance with the order; balance before delivery.')`);
  await db.exec(
    await readFile('supabase/migrations/20261119000001_quote_costing_proposals.sql', 'utf8'),
  );
  const defaults=(await db.query('select quote_validity_days,quote_terms from settings')).rows[0];
  assert.equal(defaults.quote_validity_days,3);
  assert.match(defaults.quote_terms,/payment schedule/);
  await db.exec(
    `insert into auth.users values ('00000000-0000-0000-0000-000000000001','admin@example.test','{}'); insert into customers(id,name,phone) values ('00000000-0000-0000-0000-000000000002','Test customer','919000000000'); insert into projects(id,customer_id) values ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002'); insert into measurements(id,project_id,revision_no,status) values ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003',1,'final'); insert into quotes(id,project_id,measurement_id) values ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004');`,
  );
  const id = '00000000-0000-0000-0000-000000000005';
  const header = {
    costing: { version: 1, model: 'manual' },
    proposal: { title: 'Proposal', advance_percent: 60 },
    discount: 100,
    gst_percent: 18,
    total: 1,
    terms: 'Test',
    valid_until: '2026-12-01',
  };
  const items = [
    { description: 'Materials and labour', qty: 1, unit: 'lot', rate: 2000, amount: 1 },
  ];
  const save = async (h = header, i = items) =>
    db.query('select * from public.save_quote_costing($1,$2,$3)', [
      id,
      JSON.stringify(h),
      JSON.stringify(i),
    ]);
  const q = (await save()).rows[0];
  assert.equal(Number(q.total), 2242);
  assert.equal(Number(q.subtotal), 2000);
  await assert.rejects(save());
  header.costing_revision = q.costing_revision;
  assert.equal(Number((await db.query('select amount from quote_items')).rows[0].amount), 2000);
  await assert.rejects(save({ ...header, proposal: { title: 'Bad', advance_percent: 101 } }));
  await assert.rejects(save(header, [{ ...items[0], qty: -1 }]));
  // Failure in the line insert must roll back the preceding header update and deletion.
  await assert.rejects(
    save({ ...header, terms: 'Must roll back' }, [{ ...items[0], unit: 'lot', qty: 1e15 }]),
  );
  assert.equal((await db.query('select terms from quotes')).rows[0].terms, 'Test');
  assert.equal((await db.query('select count(*) as count from quote_items')).rows[0].count, 1);
  const rounded=(await save(header,[...items,{description:'Rounding adjustment',qty:1,unit:'lot',rate:-.01,amount:-.01}])).rows[0];
  assert.equal(Number(rounded.total),2241.99);
  header.costing_revision=rounded.costing_revision;
  await db.exec(`update quotes set status='sent'`);
  await assert.rejects(save());
  await db.exec(`update quotes set status='draft';update profiles set role='accounts'`);
  await assert.rejects(save());
  console.log(
    'Passed quotation database checks: server totals, atomic rollback, proposal validation, issued-quote lock and role access.',
  );
} finally {
  await db.close();
}
