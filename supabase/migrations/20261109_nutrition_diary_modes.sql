-- Nutrition diary modes: a fixed daily plan or a dynamic plan based on actual activity.
-- Run once in Supabase Dashboard → SQL Editor.

alter table public.profiles add column if not exists body_fat_percent numeric(4,1) check (body_fat_percent between 3 and 70);
alter table public.profiles add column if not exists nutrition_diary_mode text not null default 'fixed' check (nutrition_diary_mode in ('fixed', 'dynamic'));

alter table public.diary_entries add column if not exists serving_grams numeric(7,1) not null default 100 check (serving_grams > 0 and serving_grams <= 5000);

create table if not exists public.nutrition_daily_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null default current_date,
  steps integer not null default 0 check (steps between 0 and 100000),
  cardio_minutes smallint not null default 0 check (cardio_minutes between 0 and 600),
  cardio_intensity text not null default 'medium' check (cardio_intensity in ('low', 'medium', 'high')),
  training_minutes smallint not null default 0 check (training_minutes between 0 and 600),
  training_intensity text not null default 'medium' check (training_intensity in ('low', 'medium', 'high')),
  updated_at timestamptz not null default now(),
  unique (user_id, activity_date)
);

create index if not exists nutrition_daily_activities_user_date_idx on public.nutrition_daily_activities (user_id, activity_date);

alter table public.nutrition_daily_activities enable row level security;

create policy "Users manage own nutrition daily activity"
on public.nutrition_daily_activities for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));