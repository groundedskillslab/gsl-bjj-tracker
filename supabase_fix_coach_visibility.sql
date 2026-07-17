-- ============================================================
-- GSL BJJ TRACKER — Fix Coach/Admin Visibility
-- Paste into Supabase → SQL Editor → Run
-- ============================================================

-- ── Drop ALL existing athlete policies and start clean ───────
drop policy if exists "Athletes manage own profile"          on athletes;
drop policy if exists "Coaches see academy athletes"         on athletes;
drop policy if exists "Coach can read all athletes"          on athletes;
drop policy if exists "Service role full access to athletes" on athletes;
drop policy if exists "Admins manage all athletes"           on athletes;

-- ── Recreate cleanly ─────────────────────────────────────────

-- Athletes can manage their own row
create policy "athlete_own"
  on athletes for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Admins can do everything to every row
create policy "admin_select"
  on athletes for select
  using ((select role from user_roles where user_id = auth.uid()) = 'admin');

create policy "admin_insert"
  on athletes for insert
  with check ((select role from user_roles where user_id = auth.uid()) = 'admin');

create policy "admin_update"
  on athletes for update
  using  ((select role from user_roles where user_id = auth.uid()) = 'admin')
  with check ((select role from user_roles where user_id = auth.uid()) = 'admin');

create policy "admin_delete"
  on athletes for delete
  using ((select role from user_roles where user_id = auth.uid()) = 'admin');

-- Coaches can read athletes in their academy
create policy "coach_read_academy"
  on athletes for select
  using (
    (select role from user_roles where user_id = auth.uid()) = 'coach'
    and academy_id = (select academy_id from user_roles where user_id = auth.uid() limit 1)
  );

-- Service role (for triggers) — unrestricted
create policy "service_role_all"
  on athletes for all
  to service_role
  using (true)
  with check (true);

-- ── Fix user_roles visibility ────────────────────────────────
drop policy if exists "Users can read own role"                on user_roles;
drop policy if exists "Only service role can manage roles"     on user_roles;
drop policy if exists "Service role full access to user_roles" on user_roles;

-- Users can read their own role
create policy "user_read_own_role"
  on user_roles for select
  using (auth.uid() = user_id);

-- Admins can read ALL roles (needed to manage coaches)
create policy "admin_read_all_roles"
  on user_roles for select
  using ((select role from user_roles where user_id = auth.uid()) = 'admin');

-- Admins can update roles (to assign coach/athlete)
create policy "admin_manage_roles"
  on user_roles for update
  using  ((select role from user_roles where user_id = auth.uid()) = 'admin')
  with check ((select role from user_roles where user_id = auth.uid()) = 'admin');

create policy "admin_insert_roles"
  on user_roles for insert
  with check ((select role from user_roles where user_id = auth.uid()) = 'admin');

create policy "admin_delete_roles"
  on user_roles for delete
  using ((select role from user_roles where user_id = auth.uid()) = 'admin');

-- Service role unrestricted
create policy "service_role_roles"
  on user_roles for all
  to service_role
  using (true)
  with check (true);

-- ── Fix academies visibility ─────────────────────────────────
drop policy if exists "Admins manage all academies"  on academies;
drop policy if exists "Coaches read own academy"     on academies;
drop policy if exists "Athletes read own academy"    on academies;

-- Everyone can read academies (needed for assignment dropdowns)
create policy "all_read_academies"
  on academies for select
  using (true);

-- Only admins can create/update/delete academies
create policy "admin_manage_academies"
  on academies for insert
  with check ((select role from user_roles where user_id = auth.uid()) = 'admin');

create policy "admin_update_academies"
  on academies for update
  using  ((select role from user_roles where user_id = auth.uid()) = 'admin')
  with check ((select role from user_roles where user_id = auth.uid()) = 'admin');

-- ── Grant anon/authenticated roles access to sequences ───────
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to authenticated;

-- ── Verify your admin role is still set ──────────────────────
-- Run this to confirm (replace with your email):
-- select role from user_roles where user_id = (select id from auth.users where email = 'YOUR_EMAIL');
