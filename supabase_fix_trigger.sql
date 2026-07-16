-- ============================================================
-- GSL BJJ TRACKER — Bulletproof Signup Trigger Fix
-- Paste into Supabase → SQL Editor → Run
-- This replaces the previous trigger with a version that
-- can NEVER block a signup, no matter what fails inside it.
-- ============================================================

-- Drop the old trigger first
drop trigger if exists on_auth_user_created on auth.users;

-- Recreate the function with maximum error tolerance
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  -- Safely extract name from email
  begin
    v_name := split_part(new.email, '@', 1);
  exception when others then
    v_name := 'Athlete';
  end;

  -- Insert role — never fail
  begin
    insert into public.user_roles (user_id, role)
    values (new.id, 'athlete')
    on conflict (user_id) do nothing;
  exception when others then
    null; -- silently ignore
  end;

  -- Insert athlete profile — never fail
  begin
    insert into public.athletes (user_id, name, belt, stripes, gym)
    values (new.id, v_name, 'white', 0, '')
    on conflict do nothing;
  exception when others then
    null; -- silently ignore
  end;

  -- Always return new — never block signup
  return new;
end;
$$;

-- Recreate trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Grant execute permission so trigger can run
grant execute on function handle_new_user() to supabase_auth_admin;
grant execute on function handle_new_user() to postgres;

-- Make sure inserts work from the trigger context
grant insert on public.user_roles to postgres;
grant insert on public.athletes   to postgres;
grant insert on public.user_roles to supabase_auth_admin;
grant insert on public.athletes   to supabase_auth_admin;
