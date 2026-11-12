alter table public.orders
  add column if not exists reference_image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-references',
  'order-references',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Visitors can upload order references" on storage.objects;
create policy "Visitors can upload order references"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'order-references');

drop policy if exists "Admins can read order references" on storage.objects;
create policy "Admins can read order references"
  on storage.objects for select to authenticated
  using (bucket_id = 'order-references' and (select public.is_admin()));
