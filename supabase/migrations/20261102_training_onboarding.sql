-- Run once in Supabase Dashboard → SQL Editor.
create table if not exists public.training_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal text not null check (goal in ('lose', 'health', 'muscle')),
  experience text not null check (experience in ('new', 'returning', 'regular')),
  time_available text not null check (time_available in ('short', 'medium', 'long')),
  location text not null check (location in ('home', 'home_equipment', 'gym')),
  limitations text not null check (limitations in ('none', 'knees', 'back', 'other')),
  selected_program_id text,
  completed_sessions smallint not null default 0 check (completed_sessions >= 0),
  last_completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.training_profiles enable row level security;
create policy "Users manage own training profile" on public.training_profiles for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));