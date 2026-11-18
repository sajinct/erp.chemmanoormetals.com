-- Only signed-in staff may draw reference numbers. Without this, an anonymous
-- visitor could call next_number() through the API and leave gaps in the
-- lead / project / quote numbering.
revoke execute on function public.next_number(text) from public, anon;
grant execute on function public.next_number(text) to authenticated;
