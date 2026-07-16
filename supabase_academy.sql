-- ============================================================
-- GSL BJJ TRACKER — Academy & Multi-Coach Schema
-- Paste into Supabase → SQL Editor → Run
-- ============================================================

-- ── Step 1: Create academies table ──────────────────────────
create table if not exists academies (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  location    text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz default now()
);

-- ── Step 2: Add academy_id to athletes ──────────────────────
alter table athletes
  add column if not exists academy_id uuid references academies(id) on delete set null;

-- ── Step 3: Update user_roles to include academy ────────────
-- role: 'athlete' | 'coach' | 'admin'
alter table user_roles
  add column if not exists academy_id uuid references academies(id) on delete set null;

-- ── Step 4: Enable RLS on academies ─────────────────────────
alter table academies enable row level security;

-- Admins can do everything
create policy "Admins manage all academies"
  on academies for all
  using (exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin'));

-- Coaches can read their own academy
create policy "Coaches read own academy"
  on academies for select
  using (
    id in (select academy_id from user_roles where user_id = auth.uid())
  );

-- Athletes can read their own academy
create policy "Athletes read own academy"
  on academies for select
  using (
    id in (select academy_id from athletes where user_id = auth.uid())
  );

-- ── Step 5: Helper functions ─────────────────────────────────
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function is_coach()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from user_roles where user_id = auth.uid() and role in ('coach', 'admin')
  );
$$;

create or replace function my_academy_id()
returns uuid language sql security definer stable as $$
  select academy_id from user_roles where user_id = auth.uid() limit 1;
$$;

-- ── Step 6: Update athletes RLS ──────────────────────────────
drop policy if exists "Athletes manage own profile"     on athletes;
drop policy if exists "Coach can read all athletes"     on athletes;
drop policy if exists "Service role full access to athletes" on athletes;

-- Athletes manage their own profile
create policy "Athletes manage own profile"
  on athletes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Coaches see athletes in their academy
create policy "Coaches see academy athletes"
  on athletes for select
  using (
    is_admin()
    or (
      is_coach()
      and academy_id = my_academy_id()
    )
  );

-- Service role (for triggers)
create policy "Service role full access to athletes"
  on athletes for all to service_role
  using (true) with check (true);

-- ── Step 7: Update rolls RLS ─────────────────────────────────
drop policy if exists "Athletes manage own rolls"   on rolls;
drop policy if exists "Coach can read all rolls"    on rolls;

create policy "Athletes manage own rolls"
  on rolls for all
  using (athlete_id in (select id from athletes where user_id = auth.uid()))
  with check (athlete_id in (select id from athletes where user_id = auth.uid()));

create policy "Coaches see academy rolls"
  on rolls for select
  using (
    is_admin()
    or (
      is_coach()
      and athlete_id in (select id from athletes where academy_id = my_academy_id())
    )
  );

-- ── Step 8: Update training_days RLS ────────────────────────
drop policy if exists "Athletes manage own training days" on training_days;
drop policy if exists "Coach can read all training days"  on training_days;

create policy "Athletes manage own training days"
  on training_days for all
  using (athlete_id in (select id from athletes where user_id = auth.uid()))
  with check (athlete_id in (select id from athletes where user_id = auth.uid()));

create policy "Coaches see academy training days"
  on training_days for select
  using (
    is_admin()
    or (
      is_coach()
      and athlete_id in (select id from athletes where academy_id = my_academy_id())
    )
  );

-- ── Step 9: Update competitions RLS ─────────────────────────
drop policy if exists "Athletes manage own competitions"       on competitions;
drop policy if exists "Coach can read all competitions"        on competitions;

create policy "Athletes manage own competitions"
  on competitions for all
  using (athlete_id in (select id from athletes where user_id = auth.uid()))
  with check (athlete_id in (select id from athletes where user_id = auth.uid()));

create policy "Coaches see academy competitions"
  on competitions for select
  using (
    is_admin()
    or (
      is_coach()
      and athlete_id in (select id from athletes where academy_id = my_academy_id())
    )
  );

-- ── Step 10: Update competition_rounds RLS ───────────────────
drop policy if exists "Athletes manage own competition rounds"  on competition_rounds;
drop policy if exists "Coach can read all competition rounds"   on competition_rounds;

create policy "Athletes manage own competition rounds"
  on competition_rounds for all
  using (athlete_id in (select id from athletes where user_id = auth.uid()))
  with check (athlete_id in (select id from athletes where user_id = auth.uid()));

create policy "Coaches see academy competition rounds"
  on competition_rounds for select
  using (
    is_admin()
    or (
      is_coach()
      and athlete_id in (select id from athletes where academy_id = my_academy_id())
    )
  );

-- ── Step 11: Upgrade YOU to admin ────────────────────────────
-- Replace with your actual email
update user_roles set role = 'admin'
where user_id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');

-- ── Step 12: Seed your first academy ─────────────────────────
-- Creates your academy and assigns it to you
with new_academy as (
  insert into academies (name, location, created_by)
  values ('Grounded Skills Lab', '', (select id from auth.users where email = 'gregarious1@gmail.com'))
  returning id
)
update user_roles
set academy_id = (select id from new_academy)
where user_id = (select id from auth.users where email = 'gregarious1@gmail.com');
