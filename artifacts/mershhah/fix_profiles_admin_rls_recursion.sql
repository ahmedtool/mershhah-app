-- The "profiles: admin full" policy checked admin status via a subquery on
-- profiles itself (self-referencing). Under RLS, that self-reference makes
-- Postgres unable to correctly grant visibility into OTHER rows of the same
-- table - confirmed live: an admin session could only ever see its own row,
-- never other users' profiles, even though the standalone exists() check
-- reported true. Standard fix: move the admin check into a SECURITY DEFINER
-- function so it runs with elevated privileges and bypasses RLS internally,
-- breaking the self-referential recursion.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

drop policy if exists "profiles: admin full" on public.profiles;
create policy "profiles: admin full" on public.profiles for all using (public.is_admin());
