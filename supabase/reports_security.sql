alter table public.orders
  add column if not exists status text not null default 'pending';

alter table public.orders
  drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in ('pending', 'delivered'));

alter table public.orders
  drop constraint if exists orders_name_trimmed_check;
alter table public.orders
  add constraint orders_name_trimmed_check
  check (char_length(btrim(name)) between 1 and 120) not valid;

alter table public.orders
  drop constraint if exists orders_phone_trimmed_check;
alter table public.orders
  add constraint orders_phone_trimmed_check
  check (char_length(btrim(phone)) between 8 and 40) not valid;

alter table public.orders
  drop constraint if exists orders_service_trimmed_check;
alter table public.orders
  add constraint orders_service_trimmed_check
  check (char_length(btrim(service)) between 1 and 120) not valid;

alter table public.orders
  drop constraint if exists orders_details_trimmed_check;
alter table public.orders
  add constraint orders_details_trimmed_check
  check (char_length(btrim(details)) between 1 and 2000) not valid;

alter table public.products
  drop constraint if exists products_name_trimmed_check;
alter table public.products
  add constraint products_name_trimmed_check
  check (char_length(btrim(name)) between 1 and 120) not valid;

alter table public.products
  drop constraint if exists products_price_nonnegative_check;
alter table public.products
  add constraint products_price_nonnegative_check
  check (price is null or price >= 0) not valid;

alter table public.products
  drop constraint if exists products_image_trimmed_check;
alter table public.products
  add constraint products_image_trimmed_check
  check (char_length(btrim(image)) between 1 and 2048) not valid;

alter table public.products
  drop constraint if exists products_description_trimmed_check;
alter table public.products
  add constraint products_description_trimmed_check
  check (char_length(btrim(description)) between 1 and 2000) not valid;

drop policy if exists "Visitors can submit orders" on public.orders;
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

grant update on public.orders to authenticated;
