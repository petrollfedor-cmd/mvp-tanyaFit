-- Saved meal templates for the menu builder.
-- Run once in Supabase Dashboard → SQL Editor after 20261109_nutrition_diary_modes.sql.

create table if not exists public.meal_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 100),
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  created_at timestamptz not null default now()
);

create table if not exists public.meal_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.meal_templates(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  serving_grams numeric(7,1) not null check (serving_grams > 0 and serving_grams <= 5000),
  calories numeric(7,1) not null check (calories >= 0),
  protein numeric(7,1) not null default 0 check (protein >= 0),
  fat numeric(7,1) not null default 0 check (fat >= 0),
  carbs numeric(7,1) not null default 0 check (carbs >= 0),
  created_at timestamptz not null default now()
);

create index if not exists meal_templates_user_meal_idx on public.meal_templates (user_id, meal_type, created_at desc);
create index if not exists meal_template_items_template_idx on public.meal_template_items (template_id);

alter table public.meal_templates enable row level security;
alter table public.meal_template_items enable row level security;

create policy "Users manage own meal templates"
on public.meal_templates for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users manage items in own meal templates"
on public.meal_template_items for all to authenticated
using (exists (select 1 from public.meal_templates where id = template_id and user_id = (select auth.uid())))
with check (exists (select 1 from public.meal_templates where id = template_id and user_id = (select auth.uid())));