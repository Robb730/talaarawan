-- TalaArawan — holidays feature migration
-- Run this once in the Supabase SQL Editor for an existing database.
-- Fresh installs get the same changes from supabase/schema.sql.

create extension if not exists pgcrypto;

alter table public.profiles add column if not exists company_location text;
alter table public.profiles add column if not exists company_location_code text;

create table if not exists public.local_holidays (
  id            uuid primary key default gen_random_uuid(),
  locality_code text,
  locality_name text not null,
  date          date not null,
  name          text not null,
  kind          text not null default 'local',
  reference     text,
  source_url    text,
  created_at    timestamptz not null default now(),
  unique (locality_name, date)
);

create table if not exists public.user_holidays (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  name       text not null,
  kind       text not null default 'local',
  locality   text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists user_holidays_user_date_idx
  on public.user_holidays (user_id, date);

alter table public.local_holidays enable row level security;
alter table public.user_holidays enable row level security;

drop policy if exists "local holidays: authenticated read" on public.local_holidays;
create policy "local holidays: authenticated read"
  on public.local_holidays for select
  using (auth.role() = 'authenticated');

drop policy if exists "user holidays: owner full access" on public.user_holidays;
create policy "user holidays: owner full access"
  on public.user_holidays for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant usage on schema public to authenticated;
grant select on public.local_holidays to authenticated;
grant all on public.user_holidays to authenticated;

insert into public.local_holidays (locality_code, locality_name, date, name, kind, reference, source_url)
values
  ('1381200000', 'City of Pasig', '2026-07-02', 'Araw ng Pasig', 'local', 'Republic Act No. 12062', 'https://lawphil.net/statutes/repacts/ra2024/ra_12062_2024.html'),
  ('1381200000', 'City of Pasig', '2027-07-02', 'Araw ng Pasig', 'local', 'Republic Act No. 12062', 'https://lawphil.net/statutes/repacts/ra2024/ra_12062_2024.html'),
  ('1381200000', 'City of Pasig', '2028-07-02', 'Araw ng Pasig', 'local', 'Republic Act No. 12062', 'https://lawphil.net/statutes/repacts/ra2024/ra_12062_2024.html'),
  ('1381200000', 'City of Pasig', '2029-07-02', 'Araw ng Pasig', 'local', 'Republic Act No. 12062', 'https://lawphil.net/statutes/repacts/ra2024/ra_12062_2024.html'),
  ('1381200000', 'City of Pasig', '2030-07-02', 'Araw ng Pasig', 'local', 'Republic Act No. 12062', 'https://lawphil.net/statutes/repacts/ra2024/ra_12062_2024.html'),
  ('0402106000', 'City of Dasmariñas', '2026-11-26', 'Dasmariñas Founding Anniversary', 'local', 'Proclamation No. 1507, s. 2026', 'https://lawphil.net/executive/proc/proc2026/proc_1507_2026.html')
on conflict (locality_name, date) do nothing;
