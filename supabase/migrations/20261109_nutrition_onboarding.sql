-- Required nutrition onboarding: identity, measurements, private progress photos and menu-planning inputs.
-- Run once in Supabase Dashboard → SQL Editor after the earlier migrations.

alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists waist_cm numeric(5,1) check (waist_cm between 30 and 250);
alter table public.profiles add column if not exists hips_cm numeric(5,1) check (hips_cm between 30 and 300);
alter table public.profiles add column if not exists thigh_cm numeric(5,1) check (thigh_cm between 20 and 200);
alter table public.profiles add column if not exists planned_steps integer check (planned_steps between 0 and 100000);
alter table public.profiles add column if not exists planned_cardio_minutes smallint check (planned_cardio_minutes between 0 and 5000);
alter table public.profiles add column if not exists planned_cardio_intensity text check (planned_cardio_intensity in ('low', 'medium', 'high'));
alter table public.profiles add column if not exists training_experience text check (training_experience in ('under_1_year', 'one_to_three_years', 'over_3_years'));
alter table public.profiles add column if not exists planned_training_days smallint check (planned_training_days between 0 and 7);
alter table public.profiles add column if not exists onboarding_completed boolean not null default false;

alter table public.profiles drop constraint if exists profiles_goal_check;
update public.profiles set goal = 'recompose' where goal = 'maintain';
alter table public.profiles add constraint profiles_goal_check check (goal in ('lose', 'recompose', 'gain'));

create table if not exists public.progress_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_date date not null default current_date,
  weight numeric(5,1) not null check (weight between 30 and 350),
  waist_cm numeric(5,1) check (waist_cm between 30 and 250),
  hips_cm numeric(5,1) check (hips_cm between 30 and 300),
  thigh_cm numeric(5,1) check (thigh_cm between 20 and 200),
  front_photo_path text not null,
  side_photo_path text not null,
  back_photo_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists progress_reports_user_date_idx on public.progress_reports (user_id, report_date desc);
alter table public.progress_reports enable row level security;

create policy "Users manage own progress reports"
on public.progress_reports for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Users manage own profile media" on storage.objects;
create policy "Users manage own profile media"
on storage.objects for all to authenticated
using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = (select auth.uid()::text))
with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = (select auth.uid()::text));