create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  name text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  category text not null references public.categories (name) on update cascade,
  price numeric(12, 2) check (price is null or price >= 0),
  image text not null check (char_length(btrim(image)) between 1 and 2048),
  description text not null check (char_length(btrim(description)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  phone text not null check (char_length(btrim(phone)) between 8 and 40),
  service text not null check (char_length(btrim(service)) between 1 and 120),
  details text not null check (char_length(btrim(details)) between 1 and 2000),
  reference_image_path text,
  status text not null default 'pending' check (status in ('pending', 'delivered')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.delete_category(p_category text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  replacement_category text;
begin
  replacement_category := case
    when p_category = 'Sin categoría' and exists (
      select 1
      from public.products
      where category = p_category
    ) then 'Sin categoría (restaurada)'
    else 'Sin categoría'
  end;

  if exists (
    select 1
    from public.products
    where category = p_category
  ) and not exists (
    select 1
    from public.categories
    where name = replacement_category
  ) then
    insert into public.categories (name) values (replacement_category);
  end if;

  update public.products
  set category = replacement_category
  where category = p_category;

  delete from public.categories
  where name = p_category;

  if not exists (select 1 from public.categories) then
    insert into public.categories (name) values ('Sin categoría');
  end if;
end;
$$;

grant execute on function public.delete_category(text) to authenticated;

alter table public.admin_users enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;

drop policy if exists "Admins can read their own admin record" on public.admin_users;
create policy "Admins can read their own admin record"
  on public.admin_users for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Categories are public to read" on public.categories;
create policy "Categories are public to read"
  on public.categories for select to anon, authenticated
  using (true);

drop policy if exists "Admins can manage categories" on public.categories;
create policy "Admins can manage categories"
  on public.categories for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Products are public to read" on public.products;
create policy "Products are public to read"
  on public.products for select to anon, authenticated
  using (true);

drop policy if exists "Admins can manage products" on public.products;
create policy "Admins can manage products"
  on public.products for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admins can read orders" on public.orders;
create policy "Admins can read orders"
  on public.orders for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Visitors can submit orders" on public.orders;
drop policy if exists "Visitors can submit pending orders" on public.orders;
create policy "Visitors can submit pending orders"
  on public.orders for insert to anon, authenticated
  with check (
    status = 'pending'
    and char_length(btrim(name)) between 1 and 120
    and char_length(btrim(phone)) between 8 and 40
    and char_length(btrim(service)) between 1 and 120
    and char_length(btrim(details)) between 1 and 2000
  );

drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders"
  on public.orders for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

grant select on public.categories, public.products to anon, authenticated;
grant insert, update, delete on public.categories, public.products to authenticated;
grant select on public.admin_users to authenticated;
grant select, insert, update on public.orders to authenticated;
grant insert on public.orders to anon;

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

insert into public.categories (name)
values ('Bordado'), ('Parches'), ('Uniformes'), ('Accesorios'), ('Remeras')
on conflict (name) do nothing;

insert into public.products (id, name, category, price, image, description)
values
  ('d97fb116-198d-43e3-bb75-12e156972001', 'Bordado Criadero Montana', 'Bordado', null, '/images/bordado-criadero.jpg', 'Logo ecuestre bordado en una prenda.'),
  ('d97fb116-198d-43e3-bb75-12e156972002', 'Parches bordados corporativos', 'Parches', null, '/images/parches-corporativos.jpg', 'Diseños bordados personalizados para marcas y equipos.'),
  ('d97fb116-198d-43e3-bb75-12e156972003', 'Bordado floral en prenda', 'Bordado', null, '/images/bordado-floral.jpg', 'Bordado floral de colores sobre una prenda azul.'),
  ('d97fb116-198d-43e3-bb75-12e156972004', 'Bordado Blessed', 'Bordado', null, '/images/bordado-blessed.jpg', 'Frase bordada en una sudadera.'),
  ('d97fb116-198d-43e3-bb75-12e156972005', 'Bordado para uniforme', 'Uniformes', null, '/images/bordado-uniforme.jpg', 'Logos bordados para personalizar prendas de trabajo.'),
  ('d97fb116-198d-43e3-bb75-12e156972006', 'Parche bordado circular', 'Parches', null, '/images/parche-circular.jpg', 'Parche circular con diseño bordado personalizado.'),
  ('d97fb116-198d-43e3-bb75-12e156972007', 'Remera navideña con reno', 'Remeras', null, '/images/remera-navidad-reno.webp', 'Remera blanca con una ilustración festiva de reno y el texto “Merry Christmas”.'),
  ('d97fb116-198d-43e3-bb75-12e156972008', 'Remera navideña con árbol', 'Remeras', null, '/images/remera-navidad-arbol.webp', 'Diseño navideño con árbol, regalos y muñeco de nieve, mostrado sobre una remera negra.')
on conflict (id) do nothing;
