-- ============================================================
-- GSL BJJ TRACKER — Supabase Schema
-- Paste this entire file into Supabase → SQL Editor → Run
-- ============================================================

-- Enable UUID extension (already enabled by default on Supabase)
create extension if not exists "uuid-ossp";

-- ─── Athletes (one per user account) ────────────────────────
create table if not exists athletes (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  name          text not null default '',
  belt          text not null default 'white',
  stripes       int  not null default 0,
  gym           text not null default '',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ─── Training rolls ──────────────────────────────────────────
create table if not exists rolls (
  id            uuid primary key default uuid_generate_v4(),
  athlete_id    uuid references athletes(id) on delete cascade not null,
  partner       text,
  started_at    bigint,
  ended_at      bigint,
  end_type      text,          -- 'submission' | 'time'
  submission_name text,
  submission_winner text,      -- 'me' | 'opp'
  roll_result   text,          -- 'win' | 'loss' | 'draw'
  duration      text,
  is_active     boolean default false,
  event_log     jsonb default '[]',
  sub_counts    jsonb default '{}',
  sweep_counts  jsonb default '{}',
  pos_durations jsonb default '{}',
  trans_counts  jsonb default '{}',
  guard_pass_counts jsonb default '{}',
  opp_sub_counts    jsonb default '{}',
  opp_sweep_counts  jsonb default '{}',
  opp_pos_durations jsonb default '{}',
  opp_trans_counts  jsonb default '{}',
  opp_guard_pass_counts jsonb default '{}',
  paused        boolean default false,
  paused_at     bigint,
  total_paused_ms bigint default 0,
  created_at    timestamptz default now()
);

-- ─── Training days ───────────────────────────────────────────
create table if not exists training_days (
  id            uuid primary key default uuid_generate_v4(),
  athlete_id    uuid references athletes(id) on delete cascade not null,
  date          date not null,
  created_at    timestamptz default now(),
  unique(athlete_id, date)
);

-- ─── Competitions ────────────────────────────────────────────
create table if not exists competitions (
  id            uuid primary key default uuid_generate_v4(),
  athlete_id    uuid references athletes(id) on delete cascade not null,
  name          text not null default '',
  date          text,
  location      text,
  gi            text default 'Gi',  -- 'Gi' | 'No-Gi'
  notes         text,
  created_at    timestamptz default now()
);

-- ─── Competition rounds ──────────────────────────────────────
create table if not exists competition_rounds (
  id            uuid primary key default uuid_generate_v4(),
  competition_id uuid references competitions(id) on delete cascade not null,
  athlete_id    uuid references athletes(id) on delete cascade not null,
  opponent      text,
  opp_abbr      text,
  opp_belt      text default 'white',
  opp_stripes   int  default 0,
  result        text,          -- 'win' | 'loss' | 'draw'
  method        text,          -- 'submission' | 'points' | 'dq' | 'walkover'
  end_type      text,          -- 'submission' | 'time'
  submission_name text,
  submission_winner text,
  match_time    text,
  started_at    bigint,
  ended_at      bigint,
  is_active     boolean default false,
  event_log     jsonb default '[]',
  sub_counts    jsonb default '{}',
  sweep_counts  jsonb default '{}',
  pos_durations jsonb default '{}',
  trans_counts  jsonb default '{}',
  guard_pass_counts jsonb default '{}',
  opp_sub_counts    jsonb default '{}',
  opp_sweep_counts  jsonb default '{}',
  opp_pos_durations jsonb default '{}',
  opp_trans_counts  jsonb default '{}',
  opp_guard_pass_counts jsonb default '{}',
  paused        boolean default false,
  paused_at     bigint,
  total_paused_ms bigint default 0,
  created_at    timestamptz default now()
);

-- ─── Technique lists (per athlete customisation) ─────────────
create table if not exists technique_lists (
  id            uuid primary key default uuid_generate_v4(),
  athlete_id    uuid references athletes(id) on delete cascade not null unique,
  submissions   jsonb default '[]',
  sweeps        jsonb default '[]',
  positions     jsonb default '[]',
  transitions   jsonb default '[]',
  guard_pulls   jsonb default '[]',
  takedowns     jsonb default '[]',
  updated_at    timestamptz default now()
);

-- ============================================================
-- Row Level Security — athletes only see their own data
-- ============================================================

alter table athletes           enable row level security;
alter table rolls              enable row level security;
alter table training_days      enable row level security;
alter table competitions       enable row level security;
alter table competition_rounds enable row level security;
alter table technique_lists    enable row level security;

-- Athletes table
create policy "Users manage own athlete profile"
  on athletes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Rolls
create policy "Athletes manage own rolls"
  on rolls for all
  using (athlete_id in (select id from athletes where user_id = auth.uid()))
  with check (athlete_id in (select id from athletes where user_id = auth.uid()));

-- Training days
create policy "Athletes manage own training days"
  on training_days for all
  using (athlete_id in (select id from athletes where user_id = auth.uid()))
  with check (athlete_id in (select id from athletes where user_id = auth.uid()));

-- Competitions
create policy "Athletes manage own competitions"
  on competitions for all
  using (athlete_id in (select id from athletes where user_id = auth.uid()))
  with check (athlete_id in (select id from athletes where user_id = auth.uid()));

-- Competition rounds
create policy "Athletes manage own competition rounds"
  on competition_rounds for all
  using (athlete_id in (select id from athletes where user_id = auth.uid()))
  with check (athlete_id in (select id from athletes where user_id = auth.uid()));

-- Technique lists
create policy "Athletes manage own technique lists"
  on technique_lists for all
  using (athlete_id in (select id from athletes where user_id = auth.uid()))
  with check (athlete_id in (select id from athletes where user_id = auth.uid()));

-- ============================================================
-- Indexes for performance
-- ============================================================

create index if not exists rolls_athlete_id_idx          on rolls(athlete_id);
create index if not exists rolls_started_at_idx          on rolls(started_at desc);
create index if not exists training_days_athlete_idx     on training_days(athlete_id);
create index if not exists training_days_date_idx        on training_days(date);
create index if not exists competitions_athlete_idx      on competitions(athlete_id);
create index if not exists comp_rounds_competition_idx   on competition_rounds(competition_id);
create index if not exists comp_rounds_athlete_idx       on competition_rounds(athlete_id);
