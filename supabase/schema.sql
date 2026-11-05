-- Run once in Supabase Dashboard → SQL Editor.
create extension if not exists "pgcrypto";
create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, display_name text, role text not null default 'user' check (role in ('user', 'trainer', 'admin')), created_at timestamptz not null default now());
alter table public.profiles add column if not exists sex text check (sex in ('female', 'male'));
alter table public.profiles add column if not exists age smallint check (age between 14 and 100);
alter table public.profiles add column if not exists weight numeric(5,1) check (weight between 35 and 250);
alter table public.profiles add column if not exists height smallint check (height between 120 and 230);
alter table public.profiles add column if not exists activity numeric(4,3) check (activity in (1.2, 1.375, 1.55, 1.725));
alter table public.profiles add column if not exists goal text check (goal in ('lose', 'maintain', 'gain'));
create table if not exists public.products (id uuid primary key default gen_random_uuid(), owner_id uuid references auth.users(id) on delete cascade, name text not null check (char_length(name) between 2 and 160), calories numeric(7,1) not null check (calories >= 0), protein numeric(7,1) not null default 0 check (protein >= 0), fat numeric(7,1) not null default 0 check (fat >= 0), carbs numeric(7,1) not null default 0 check (carbs >= 0), is_public boolean not null default false, created_at timestamptz not null default now());
create table if not exists public.diary_entries (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, product_id uuid references public.products(id) on delete set null, meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')), entry_date date not null default current_date, name text not null, calories numeric(7,1) not null check (calories >= 0), protein numeric(7,1) not null default 0 check (protein >= 0), fat numeric(7,1) not null default 0 check (fat >= 0), carbs numeric(7,1) not null default 0 check (carbs >= 0), created_at timestamptz not null default now());
alter table public.profiles enable row level security; alter table public.products enable row level security; alter table public.diary_entries enable row level security;
create policy "Users read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id); create policy "Users update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id); create policy "Users create own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "Read public and own products" on public.products for select to authenticated using (is_public or owner_id = (select auth.uid())); create policy "Create own products" on public.products for insert to authenticated with check (owner_id = (select auth.uid()) and is_public = false); create policy "Manage own products" on public.products for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()) and is_public = false); create policy "Delete own products" on public.products for delete to authenticated using (owner_id = (select auth.uid()));
create policy "Manage own diary" on public.diary_entries for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create or replace function public.create_profile_for_new_user() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')); return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users; create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.create_profile_for_new_user();

-- Backfill profiles for Google/email users that existed before the trigger was created.
insert into public.profiles (id, display_name)
select id, coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name')
from auth.users
on conflict (id) do nothing;