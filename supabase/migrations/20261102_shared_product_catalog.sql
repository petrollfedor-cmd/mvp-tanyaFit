-- Run this migration once in Supabase Dashboard → SQL Editor.
-- User-created products are public: every authenticated app user can find and add them.

alter table public.products add column if not exists barcode text;
alter table public.products add column if not exists brand text;
alter table public.products add column if not exists description text;
alter table public.products add column if not exists image_urls text[] not null default '{}';
create index if not exists products_barcode_idx on public.products (barcode) where barcode is not null;
create index if not exists products_name_idx on public.products (name);

drop policy if exists "Create own products" on public.products;
drop policy if exists "Manage own products" on public.products;
create policy "Users publish shared products" on public.products for insert to authenticated with check (owner_id = (select auth.uid()) and is_public = true);
create policy "Owners update shared products" on public.products for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-photos', 'product-photos', true, 6291456, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 6291456, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Users upload shared product photos" on storage.objects;
drop policy if exists "Users delete own shared product photos" on storage.objects;
create policy "Users upload shared product photos" on storage.objects for insert to authenticated with check (bucket_id = 'product-photos' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "Users delete own shared product photos" on storage.objects for delete to authenticated using (bucket_id = 'product-photos' and (storage.foldername(name))[1] = (select auth.uid()::text));