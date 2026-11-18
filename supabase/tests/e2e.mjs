// End-to-end check against the LOCAL Supabase stack, through the same API and
// the same queries the screens use: sign-up, roles, lead -> project ->
// measurement -> approval -> quote (with stored PDF) -> advance -> balance.
// Run: node supabase/tests/e2e.mjs   (after `npx supabase start`)
// It creates test users (*@e2e.local) and one test lead; safe to run repeatedly.
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';

const URL = 'http://127.0.0.1:54321';
const KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const PASSWORD = 'e2e-password-1';

const ok = (what) => console.log('  ok  ' + what);
const must = async (query) => {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
};
const mustFail = async (query, what) => {
  const { data, error } = await query;
  assert.ok(error || (Array.isArray(data) && data.length === 0), `expected refusal: ${what}`);
  ok(`refused: ${what}` + (error ? ` ("${error.message}")` : ''));
};

/** Signs in, creating the account on first run. Returns a client for that user. */
async function user(name) {
  const client = createClient(URL, KEY, { auth: { persistSession: false } });
  const email = `${name}@e2e.local`;
  let { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) {
    ({ data, error } = await client.auth.signUp({
      email,
      password: PASSWORD,
      options: { data: { full_name: `E2E ${name}` } },
    }));
    if (error) throw new Error(`${email}: ${error.message}`);
  }
  assert.ok(data.session, `${email} should get a session`);
  return { client, id: data.user.id };
}

const admin = await user('admin');
const adminProfile = await must(admin.client.from('profiles').select('*').eq('id', admin.id).single());
assert.equal(adminProfile.role, 'admin', 'first account must be admin (run on a fresh database)');
assert.equal(adminProfile.active, true);
ok('first sign-up is the active admin');

const staff = {};
for (const role of ['sales', 'approver', 'accounts']) {
  staff[role] = await user(role);
  await must(admin.client.from('profiles').update({ role, active: true }).eq('id', staff[role].id));
}
const pending = await user('pending');
await must(admin.client.from('profiles').update({ active: false }).eq('id', pending.id));
ok('admin activated sales, approver and accounts');

assert.equal((await must(pending.client.from('leads').select('id'))).length, 0);
await mustFail(pending.client.from('leads').insert({ name: 'x', phone: '919999999999' }), 'inactive user adds a lead');

// ---- Sales: lead -> project -> measurement ----
const sales = staff.sales.client;
const phone = '91' + String(Date.now()).slice(-10);
const lead = await must(
  sales.from('leads').insert({ name: 'E2E Customer', phone, location: 'Guruvayur', source: 'referral', referred_by: 'Lijo' }).select().single(),
);
assert.match(lead.ref_no, /^L-\d{4}-\d{4}$/);
ok(`lead created ${lead.ref_no}`);

await must(sales.from('lead_activities').insert({ lead_id: lead.id, type: 'call', text: 'Wants a shop shutter' }));
const activities = await must(
  sales.from('lead_activities').select('*, profiles(full_name)').eq('lead_id', lead.id).order('created_at', { ascending: false }),
);
assert.equal(activities[0].profiles.full_name, 'E2E sales');
ok('follow-up logged with author name');

const projectId = await must(
  sales.rpc('convert_lead', { p_lead: lead.id, p_site_address: 'East Nada, Guruvayur', p_map_url: 'https://maps.app.goo.gl/test' }),
);
const project = await must(sales.from('projects').select('*, customers(*)').eq('id', projectId).single());
assert.match(project.ref_no, /^CM-\d{4}-\d{4}$/);
assert.equal(project.customers.phone, phone);
ok(`project created ${project.ref_no} with customer`);

const products = await must(sales.from('products').select('*').eq('active', true).order('category').order('name'));
const shutter = products.find((p) => p.name === 'Aluminium shutter');
await must(staff.approver.client.from('products').upsert([{ category: 'shutter', name: shutter.name, unit: 'sqft', rate: 450, gst_percent: 18 }], { onConflict: 'name' }));
assert.equal(Number((await must(sales.from('products').select('rate').eq('id', shutter.id).single())).rate), 450);
ok('approver updated a rate by name (Excel import path)');
await mustFail(sales.from('products').update({ rate: 1 }).eq('id', shutter.id).select(), 'sales edits a rate');

const m1 = await must(sales.rpc('new_revision', { p_project: projectId, p_from: null }));
await must(
  sales.from('measurement_items').insert([
    { measurement_id: m1, product_id: shutter.id, position: 'Front shop', width: 10, height: 8, qty: 1, operation: 'Side motor', sort: 0 },
  ]),
);
await must(sales.from('measurements').update({ status: 'submitted' }).eq('id', m1));
await mustFail(sales.from('measurements').update({ status: 'final' }).eq('id', m1), 'sales finalises a measurement');

const m2 = await must(sales.rpc('new_revision', { p_project: projectId, p_from: m1 }));
await must(sales.from('measurement_items').update({ width: 12 }).eq('measurement_id', m2));
await must(sales.from('measurements').update({ status: 'submitted' }).eq('id', m2));
ok('revision R2 copied from R1 and edited');

// ---- Approver: finalise R2 ----
await must(staff.approver.client.from('measurements').update({ status: 'final' }).eq('id', m2));
const revisions = await must(
  sales
    .from('measurements')
    .select('*, measurement_items(*), measurer:profiles!measured_by(full_name), approver:profiles!approved_by(full_name)')
    .eq('project_id', projectId)
    .order('revision_no', { ascending: false }),
);
assert.equal(revisions.length, 2);
assert.equal(revisions[0].status, 'final');
assert.equal(revisions[0].approver.full_name, 'E2E approver');
assert.equal(revisions[0].measurer.full_name, 'E2E sales');
assert.equal(Number(revisions[0].measurement_items[0].width), 12);
ok('approver finalised R2; approver and measurer names load');
await mustFail(sales.from('measurement_items').update({ width: 99 }).eq('measurement_id', m2), 'editing a final measurement');

// ---- Sales: quote, stored PDF, share link ----
await mustFail(sales.from('quotes').insert({ project_id: projectId, measurement_id: m1 }), 'quote from a non-final revision');
const quote = await must(
  sales
    .from('quotes')
    .insert({ project_id: projectId, measurement_id: m2, subtotal: 43200, gst_percent: 18, gst_amount: 7776, total: 50976, valid_until: '2026-12-01' })
    .select()
    .single(),
);
await must(sales.from('quote_items').insert([{ quote_id: quote.id, product_id: shutter.id, description: 'Aluminium shutter, Front shop', qty: 96, unit: 'sqft', rate: 450, amount: 43200, sort: 0 }]));
const path = `${projectId}/quotes/${quote.quote_no}-${Date.now()}.pdf`;
const upload = await sales.storage.from('project-files').upload(path, new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }), { contentType: 'application/pdf' });
assert.equal(upload.error, null, upload.error?.message);
await must(sales.from('quotes').update({ status: 'sent', pdf_path: path }).eq('id', quote.id));
const signed = await sales.storage.from('project-files').createSignedUrl(path, 600);
assert.equal(signed.error, null, signed.error?.message);
const fetched = await fetch(signed.data.signedUrl);
assert.equal(fetched.status, 200);
ok(`quote ${quote.quote_no} issued; PDF stored and share link opens`);
const anon = createClient(URL, KEY, { auth: { persistSession: false } });
assert.ok((await anon.storage.from('project-files').download(path)).error, 'file must not be public');
ok('stored PDF is not readable without the signed link');

const loaded = await must(sales.from('quotes').select('*, quote_items(*)').eq('id', quote.id).single());
assert.equal(loaded.quote_items.length, 1);
assert.equal((await must(sales.from('projects').select('status').eq('id', projectId).single())).status, 'quoted');
ok('project moved to quoted');

// ---- Attachments ----
const photo = `${projectId}/${crypto.randomUUID()}-site.jpg`;
assert.equal((await sales.storage.from('project-files').upload(photo, new Blob(['jpg']), { contentType: 'image/jpeg' })).error, null);
await must(sales.from('attachments').insert({ project_id: projectId, measurement_id: m2, path: photo, name: 'site.jpg', kind: 'photo' }));
assert.equal((await must(sales.from('attachments').select('*').eq('project_id', projectId).eq('measurement_id', m2))).length, 1);
ok('site photo attached to the measurement');

// ---- Accounts: advance and balance ----
await mustFail(sales.from('payments').insert({ project_id: projectId, kind: 'advance', amount: 1 }), 'sales records a payment');
await must(staff.accounts.client.from('payments').insert({ project_id: projectId, kind: 'advance', amount: 25000, mode: 'upi', reference: 'UTR123' }));
const balance = await must(sales.from('project_balances').select('*').eq('project_id', projectId).maybeSingle());
assert.deepEqual([Number(balance.quote_total), Number(balance.paid), Number(balance.balance)], [50976, 25000, 25976]);
assert.equal((await must(sales.from('projects').select('status').eq('id', projectId).single())).status, 'confirmed');
assert.equal((await must(sales.from('leads').select('status').eq('id', lead.id).single())).status, 'confirmed');
ok('advance recorded; project and lead confirmed; balance 25,976.00');

// ---- Settings ----
const settings = await must(sales.from('settings').select('*').eq('id', 1).single());
assert.ok(settings.msg_quote.includes('{quote_no}'));
await mustFail(sales.from('settings').update({ upi_id: 'x@upi' }).eq('id', 1).select(), 'sales edits settings');
await must(admin.client.from('settings').update({ quote_validity_days: 15 }).eq('id', 1));
ok('settings readable by staff, editable by admin only');

console.log('\nEND-TO-END CHECK PASSED');
