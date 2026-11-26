-- TalaArawan — remove hardcoded curated local holidays.
-- Run once in the Supabase SQL Editor for an existing database.
-- Holidays now come only from Nager.Date plus each user's own entries in
-- public.user_holidays (which is left untouched).

drop table if exists public.local_holidays;
