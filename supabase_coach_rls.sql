-- ============================================================
-- GSL BJJ TRACKER — Coach Access & Role-Based Security
-- Paste this entire file into Supabase → SQL Editor → Run
-- ============================================================

-- ── Step 1: Create a roles table ────────────────────────────
create table if not exists user_roles (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references auth.users(id) on delete cascade not null unique,
  role       text not null default 'athlete', -- 'athlete' | 'coach'
  created_at timestamptz default now()
);

-- Enable RLS on roles table
alter table user_roles enable row level security;

-- Users can read their own role
create policy "Users can read own role"
  on user_roles for select
  using (auth.uid() = user_id);

-- Only service role can insert/update roles (done via Supabase dashboard)
create policy "Only service role can manage roles"
  on user_roles for all
  using (auth.uid() = user_id);

-- ── Step 2: Helper function — checks if current user is coach ─
create or replace function is_coach()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid()
    and role = 'coach'
  );
$$;

-- ── Step 3: Drop old policies and replace with role-aware ones ─

-- ATHLETES TABLE
drop policy if exists "Users manage own athlete profile" on athletes;

create policy "Athletes manage own profile"
  on athletes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Coach can read all athletes"
  on athletes for select
  using (is_coach());

-- ROLLS TABLE
drop policy if exists "Athletes manage own rolls" on rolls;

create policy "Athletes manage own rolls"
  on rolls for all
  using (athlete_id in (select id from athletes where user_id = auth.uid()))
  with check (athlete_id in (select id from athletes where user_id = auth.uid()));

create policy "Coach can read all rolls"
  on rolls for select
  using (is_coach());

-- TRAINING DAYS TABLE
drop policy if exists "Athletes manage own training days" on training_days;

create policy "Athletes manage own training days"
  on training_days for all
  using (athlete_id in (select id from athletes where user_id = auth.uid()))
  with check (athlete_id in (select id from athletes where user_id = auth.uid()));

create policy "Coach can read all training days"
  on training_days for select
  using (is_coach());

-- COMPETITIONS TABLE
drop policy if exists "Athletes manage own competitions" on competitions;

create policy "Athletes manage own competitions"
  on competitions for all
  using (athlete_id in (select id from athletes where user_id = auth.uid()))
  with check (athlete_id in (select id from athletes where user_id = auth.uid()));

create policy "Coach can read all competitions"
  on competitions for select
  using (is_coach());

-- COMPETITION ROUNDS TABLE
drop policy if exists "Athletes manage own competition rounds" on competition_rounds;

create policy "Athletes manage own competition rounds"
  on competition_rounds for all
  using (athlete_id in (select id from athletes where user_id = auth.uid()))
  with check (athlete_id in (select id from athletes where user_id = auth.uid()));

create policy "Coach can read all competition rounds"
  on competition_rounds for select
  using (is_coach());

-- TECHNIQUE LISTS TABLE
drop policy if exists "Athletes manage own technique lists" on technique_lists;

create policy "Athletes manage own technique lists"
  on technique_lists for all
  using (athlete_id in (select id from athletes where user_id = auth.uid()))
  with check (athlete_id in (select id from athletes where user_id = auth.uid()));

create policy "Coach can read all technique lists"
  on technique_lists for select
  using (is_coach());

-- ── Step 4: Auto-assign 'athlete' role on signup ─────────────
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into user_roles (user_id, role)
  values (new.id, 'athlete')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Trigger fires whenever a new user signs up
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── Step 5: Assign YOU as coach ──────────────────────────────
-- This inserts your coach role. Run this AFTER the above.
-- Replace the email below with YOUR email address.
insert into user_roles (user_id, role)
select id, 'coach'
from auth.users
where email = 'YOUR_EMAIL_HERE'
on conflict (user_id) do update set role = 'coach';
