-- Short links for quotation PDFs.
--
-- The storage link to a quote PDF is several hundred characters long. Each
-- issued quote now gets a short random code; the customer opens
-- https://erp.chemmanoormetals.com/?q=<code>, and that page asks quote_link()
-- for the real (time-limited) storage link and forwards to it.
alter table public.quotes
  add column share_code text unique,
  add column share_url text,
  add column share_expires_at timestamptz;

-- Callable without signing in, because customers have no account. It reveals
-- one thing only: the PDF link for a code that exists, is issued (not a draft)
-- and has not expired. Codes are random and long enough not to be guessable.
create function public.quote_link(p_code text) returns text
language sql stable security definer set search_path = public as $$
  select share_url from quotes
  where share_code = p_code
    and length(p_code) >= 10
    and status <> 'draft'
    and share_expires_at > now()
$$;

revoke execute on function public.quote_link(text) from public;
grant execute on function public.quote_link(text) to anon, authenticated;
