-- ════════════════════════════════════════════════════════════════
-- Money Record — setup script for new features
-- Run this once in Supabase Dashboard → SQL Editor → New query → Run
--
-- This matches how your app already works: it uses the public "anon"
-- key directly in the browser with no login system, so these policies
-- are intentionally permissive ("anyone with my anon key can read/
-- write"), exactly like your existing `transactions` table already
-- behaves. Don't share your deployed URL/anon key publicly.
-- ════════════════════════════════════════════════════════════════

-- 1) Receipt photos on transactions ---------------------------------
alter table public.transactions add column if not exists photo_url text;

-- 2) Homework ---------------------------------------------------------
create table if not exists public.homework (
  id         bigint generated always as identity primary key,
  title      text not null,
  subject    text,
  due_date   date not null default current_date,
  done       boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.homework enable row level security;
drop policy if exists "Public access homework" on public.homework;
create policy "Public access homework" on public.homework for all using (true) with check (true);

-- 3) Food log (AI calorie tracker) ------------------------------------
create table if not exists public.food_logs (
  id         bigint generated always as identity primary key,
  date       date not null default current_date,
  photo_url  text,
  food_name  text,
  calories   integer,
  created_at timestamptz not null default now()
);
alter table public.food_logs enable row level security;
drop policy if exists "Public access food_logs" on public.food_logs;
create policy "Public access food_logs" on public.food_logs for all using (true) with check (true);

-- 4) Calories burned — one row per day, manual Mi Band entry ----------
create table if not exists public.calorie_burn (
  burn_date  date primary key,
  calories   integer not null,
  updated_at timestamptz not null default now()
);
alter table public.calorie_burn enable row level security;
drop policy if exists "Public access calorie_burn" on public.calorie_burn;
create policy "Public access calorie_burn" on public.calorie_burn for all using (true) with check (true);

-- 5) Storage bucket for receipt + food photos --------------------------
insert into storage.buckets (id, name, public)
values ('app-photos', 'app-photos', true)
on conflict (id) do nothing;

drop policy if exists "Public read app-photos" on storage.objects;
create policy "Public read app-photos" on storage.objects
  for select using (bucket_id = 'app-photos');

drop policy if exists "Public upload app-photos" on storage.objects;
create policy "Public upload app-photos" on storage.objects
  for insert with check (bucket_id = 'app-photos');

drop policy if exists "Public delete app-photos" on storage.objects;
create policy "Public delete app-photos" on storage.objects
  for delete using (bucket_id = 'app-photos');

-- Done! Next: deploy the Edge Function (see supabase/functions/estimate-calories)
-- and set your free Gemini API key as a secret — instructions are in the chat reply.
