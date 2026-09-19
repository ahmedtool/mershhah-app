-- Optional cap on how many applications a job posting accepts. NULL = no cap
-- (previous behavior). Enforced by a trigger (the real boundary - the public
-- jobs page inserts straight from the browser) and mirrored by a boolean-only
-- RPC so the public page can show a posting as closed instead of letting a
-- visitor fill the whole form only to be rejected on submit.
alter table public.job_postings
  add column if not exists max_applications integer check (max_applications is null or max_applications > 0);

create or replace function public.enforce_job_application_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max integer;
  v_count integer;
begin
  if new.service_type <> 'jobs' or new.job_posting_id is null then
    return new;
  end if;

  select max_applications into v_max from public.job_postings where id = new.job_posting_id;
  if v_max is null then
    return new;
  end if;

  select count(*) into v_count from public.business_requests where job_posting_id = new.job_posting_id;
  if v_count >= v_max then
    raise exception 'job_posting_full' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_job_application_limit_trigger on public.business_requests;
create trigger enforce_job_application_limit_trigger
  before insert on public.business_requests
  for each row execute function public.enforce_job_application_limit();

-- Public, anon-callable: only says which of a restaurant's active postings can
-- still take applications - never exposes counts or applicant data.
create or replace function public.job_posting_open_status(p_restaurant_id text)
returns table (posting_id uuid, is_open boolean)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    (p.max_applications is null or
      (select count(*) from public.business_requests r where r.job_posting_id = p.id) < p.max_applications)
  from public.job_postings p
  where p.restaurant_id = p_restaurant_id and p.is_active = true;
$$;

grant execute on function public.job_posting_open_status(text) to anon, authenticated;
