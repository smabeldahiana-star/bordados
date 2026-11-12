insert into public.site_settings (id, business_name, contact_email, whatsapp_number)
values (1, 'Punto a Punto', 'sanchezariasmabeldahiana@gmail.com', '573233120676')
on conflict (id) do update
set contact_email = excluded.contact_email,
    whatsapp_number = excluded.whatsapp_number;
