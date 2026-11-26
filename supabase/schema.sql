-- =====================================================================
-- TalaArawan — Supabase schema
-- Run this whole file in the Supabase SQL Editor (SQL -> New query).
-- It is safe to re-run: tables/policies/triggers are created if missing.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  full_name      text,
  school         text,
  program        text,
  company        text,
  supervisor     text,
  required_hours numeric(7, 2) not null default 0 check (required_hours >= 0),
  start_date     date,
  end_date       date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Added by the holidays feature (safe on existing databases).
alter table public.profiles add column if not exists company_location text;
alter table public.profiles add column if not exists company_location_code text;

-- One row per weekday per user. 0 = Sunday, 1 = Monday, ... 6 = Saturday.
create table if not exists public.schedules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  is_working  boolean not null default true,
  time_in     time,
  time_out    time,
  created_at  timestamptz not null default now(),
  unique (user_id, day_of_week)
);

-- Breaks are attached to a weekday and are fully dynamic:
-- give a start/end time OR just a duration in minutes, and choose whether
-- they are deducted from rendered hours.
create table if not exists public.breaks (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  schedule_id           uuid not null references public.schedules(id) on delete cascade,
  label                 text not null default 'Break',
  start_time            time,
  end_time              time,
  duration_minutes      integer not null default 0 check (duration_minutes >= 0),
  excluded_from_rendered boolean not null default true,
  created_at            timestamptz not null default now()
);

-- Exactly one journal entry per user per day (enforced by the unique index).
create table if not exists public.journal_entries (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  entry_date           date not null,
  status               text not null default 'worked'
                       check (status in ('worked', 'absent', 'leave', 'half_day')),
  time_in              time,
  time_out             time,
  break_minutes        numeric(6, 2) not null default 0 check (break_minutes >= 0),
  exclude_breaks       boolean not null default true,
  manual_hours         numeric(6, 2) check (manual_hours >= 0),
  rendered_hours       numeric(6, 2) not null default 0 check (rendered_hours >= 0),
  -- Reflection fields
  tasks                text not null default '',
  skills_used          text,
  learnings            text,
  challenges           text,
  supervisor_feedback  text,
  next_steps           text,
  mood                 text,
  tags                 jsonb not null default '[]'::jsonb,
  is_favorite          boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (user_id, entry_date)
);

-- Per-user holidays added from Settings.
create table if not exists public.user_holidays (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  date      date not null,
  name      text not null,
  kind      text not null default 'local',
  locality  text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- API holidays a user does not observe: treated as normal working days.
create table if not exists public.ignored_holidays (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  date      date not null,
  name      text not null,
  kind      text not null default 'regular',
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists journal_entries_user_date_idx
  on public.journal_entries (user_id, entry_date desc);
create index if not exists schedules_user_day_idx
  on public.schedules (user_id, day_of_week);
create index if not exists breaks_schedule_idx
  on public.breaks (schedule_id);
create index if not exists ignored_holidays_user_date_idx
  on public.ignored_holidays (user_id, date);

-- ---------------------------------------------------------------------
-- 2. Row Level Security — a user can ONLY see and change their own data
-- ---------------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.schedules      enable row level security;
alter table public.breaks         enable row level security;
alter table public.journal_entries enable row level security;
alter table public.user_holidays enable row level security;
alter table public.ignored_holidays enable row level security;

drop policy if exists "profiles: owner full access" on public.profiles;
create policy "profiles: owner full access"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "schedules: owner full access" on public.schedules;
create policy "schedules: owner full access"
  on public.schedules for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "breaks: owner full access" on public.breaks;
create policy "breaks: owner full access"
  on public.breaks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "entries: owner full access" on public.journal_entries;
create policy "entries: owner full access"
  on public.journal_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user holidays: owner full access" on public.user_holidays;
create policy "user holidays: owner full access"
  on public.user_holidays for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "ignored holidays: owner full access" on public.ignored_holidays;
create policy "ignored holidays: owner full access"
  on public.ignored_holidays for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 3. Triggers
-- ---------------------------------------------------------------------

-- Create a profile automatically when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at in sync.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists entries_touch_updated_at on public.journal_entries;
create trigger entries_touch_updated_at
  before update on public.journal_entries
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 4. Grants (Supabase usually provides these already; harmless to repeat)
-- ---------------------------------------------------------------------

grant usage on schema public to authenticated;
grant all on public.profiles, public.schedules, public.breaks, public.journal_entries, public.user_holidays, public.ignored_holidays to authenticated;

-- Done. In Supabase Authentication -> Providers, make sure Email is enabled.
-- If email confirmation is on, new users must confirm before they can sign in.
