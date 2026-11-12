create table if not exists public.site_settings (
  id smallint primary key default 1 check (id = 1),
  business_name text not null check (char_length(business_name) between 1 and 120),
  contact_email text not null check (char_length(contact_email) between 3 and 254),
  whatsapp_number text not null check (char_length(whatsapp_number) between 8 and 20),
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop policy if exists "Business information is public to read" on public.site_settings;
create policy "Business information is public to read"
  on public.site_settings for select to anon, authenticated
  using (true);

drop policy if exists "Admins can update business information" on public.site_settings;
create policy "Admins can update business information"
  on public.site_settings for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

grant select on public.site_settings to anon, authenticated;
grant update on public.site_settings to authenticated;

insert into public.site_settings (id, business_name, contact_email, whatsapp_number)
values (1, 'Punto a Punto', 'sanchezariasmabeldahiana@gmail.com', '573233120676')
on conflict (id) do nothing;
