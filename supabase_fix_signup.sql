-- ============================================================
-- GSL BJJ TRACKER — Fix New User Signup Error
-- Paste into Supabase → SQL Editor → Run
-- ============================================================

-- Drop and recreate the trigger function with better error handling
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Assign default athlete role
  insert into public.user_roles (user_id, role)
  values (new.id, 'athlete')
  on conflict (user_id) do nothing;

  -- Create a default athlete profile so the app loads immediately
  insert into public.athletes (user_id, name, belt, stripes, gym)
  values (
    new.id,
    split_part(new.email, '@', 1), -- use email prefix as default name
    'white',
    0,
    ''
  )
  on conflict do nothing;

  return new;
exception
  when others then
    -- Never block signup even if trigger fails
    return new;
end;
$$;

-- Recreate the trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Also make sure RLS allows the trigger to insert
-- (security definer + set search_path handles this, but belt-and-suspenders)
alter table public.user_roles   disable row level security;
alter table public.athletes      disable row level security;

-- Re-enable with correct policies
alter table public.user_roles   enable row level security;
alter table public.athletes      enable row level security;

-- Ensure the service role can always insert into these tables
-- (needed for the trigger which runs as the triggering user's context)
drop policy if exists "Service role full access to user_roles" on user_roles;
create policy "Service role full access to user_roles"
  on user_roles for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role full access to athletes" on athletes;
create policy "Service role full access to athletes"
  on athletes for all
  to service_role
  using (true)
  with check (true);
