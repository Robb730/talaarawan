-- TalaArawan — let users ignore API holidays they do not observe.
-- Run once in the Supabase SQL Editor for an existing database.

create table if not exists public.ignored_holidays (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  date      date not null,
  name      text not null,
  kind      text not null default 'regular',
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists ignored_holidays_user_date_idx
  on public.ignored_holidays (user_id, date);

alter table public.ignored_holidays enable row level security;

drop policy if exists "ignored holidays: owner full access" on public.ignored_holidays;
create policy "ignored holidays: owner full access"
  on public.ignored_holidays for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant all on public.ignored_holidays to authenticated;
