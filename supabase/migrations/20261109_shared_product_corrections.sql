-- Temporary moderation rule: every signed-in user may correct a public product card.
-- Deleting a product remains restricted to its owner.

drop policy if exists "Owners update shared products" on public.products;

create policy "Authenticated users correct shared products"
on public.products for update to authenticated
using (is_public = true)
with check (is_public = true);