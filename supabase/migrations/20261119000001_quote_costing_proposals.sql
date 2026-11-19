-- Snapshots contain structured inputs and proposal text only; PDFs remain in Storage.
alter table public.settings alter column quote_validity_days set default 3;
-- Update the original starter default; preserve other configured validity periods.
update public.settings set quote_validity_days=3 where quote_validity_days=15;
update public.settings set quote_terms=replace(quote_terms,
  '1. 50% advance with the order; balance before delivery.',
  '1. Advance and balance payments are as specified in the payment schedule.');

alter table public.quotes
  add column costing jsonb,
  add column proposal jsonb,
  add column costing_revision integer not null default 0,
  add constraint quotes_costing_object check (costing is null or jsonb_typeof(costing) = 'object'),
  add constraint quotes_proposal_object check (proposal is null or jsonb_typeof(proposal) = 'object');

comment on column public.quotes.costing is 'Versioned cost model and input snapshot. No workbook or binary files.';
comment on column public.quotes.proposal is 'Customer-facing proposal sections and payment schedule.';

-- Keep the header and generated customer lines in one transaction.
create function public.save_quote_costing(p_quote_id uuid, p_header jsonb, p_items jsonb)
returns public.quotes language plpgsql security invoker set search_path = public as $$
declare
  q public.quotes;
  base numeric;
  reduction numeric;
  gst numeric;
  tax numeric;
begin
  if not public.has_role('admin','approver','sales') then
    raise exception 'Quotation editing is not allowed' using errcode = '42501';
  end if;
  select * into q from quotes where id = p_quote_id for update;
  if not found then raise exception 'Quotation not found'; end if;
  if q.status <> 'draft' then raise exception 'Only draft quotations can be costed'; end if;
  if coalesce((p_header->>'costing_revision')::integer,0) <> q.costing_revision then
    raise exception 'This quotation was changed by another user. Reload before saving.';
  end if;
  if jsonb_typeof(p_header->'costing') is distinct from 'object'
    or coalesce(p_header->'costing'->>'version','') <> '1'
    or coalesce(p_header->'costing'->>'model','') not in ('perforated','manual')
    or jsonb_typeof(p_header->'proposal') is distinct from 'object'
    or nullif(trim(p_header->'proposal'->>'title'),'') is null
    or coalesce((p_header->'proposal'->>'advance_percent')::numeric,-1) not between 0 and 100
  then raise exception 'Valid costing and proposal snapshots are required'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one calculated line is required';
  end if;
  if exists(select 1 from jsonb_array_elements(p_items) i where
    jsonb_typeof(i->'qty') is distinct from 'number' or (i->>'qty')::numeric <= 0
    or jsonb_typeof(i->'rate') is distinct from 'number'
    or ((i->>'rate')::numeric < 0 and not
      (i->>'description' = 'Rounding adjustment' and (i->>'qty')::numeric = 1 and (i->>'rate')::numeric >= -0.05))
    or nullif(trim(i->>'description'),'') is null)
  then raise exception 'Invalid calculated line'; end if;
  select sum(round((i->>'qty')::numeric * (i->>'rate')::numeric,2)) into base from jsonb_array_elements(p_items) i;
  reduction := (p_header->>'discount')::numeric;
  gst := (p_header->>'gst_percent')::numeric;
  if reduction is null or reduction < 0 or gst is null or gst < 0 then raise exception 'Invalid discount or GST'; end if;
  reduction := least(reduction,base);
  tax := round((base-reduction)*gst/100,2);
  update quotes set costing=p_header->'costing', proposal=p_header->'proposal',costing_revision=costing_revision+1,
    subtotal=base,discount=reduction,gst_percent=gst,gst_amount=tax,total=base-reduction+tax,
    terms=nullif(p_header->>'terms',''),valid_until=nullif(p_header->>'valid_until','')::date
    where id=q.id returning * into q;
  delete from quote_items where quote_id=q.id;
  insert into quote_items(quote_id,product_id,description,qty,unit,rate,amount,sort)
    select q.id,null,i->>'description',(i->>'qty')::numeric,coalesce(i->>'unit','lot'),
      (i->>'rate')::numeric,round((i->>'qty')::numeric*(i->>'rate')::numeric,2),n-1
    from jsonb_array_elements(p_items) with ordinality as lines(i,n);
  return q;
end $$;
revoke all on function public.save_quote_costing(uuid,jsonb,jsonb) from public;
grant execute on function public.save_quote_costing(uuid,jsonb,jsonb) to authenticated;
