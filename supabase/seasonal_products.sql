insert into public.categories (name)
values ('Remeras')
on conflict (name) do nothing;

insert into public.products (id, name, category, price, image, description)
values
  ('d97fb116-198d-43e3-bb75-12e156972007', 'Remera navideña con reno', 'Remeras', null, '/images/remera-navidad-reno.webp', 'Remera blanca con una ilustración festiva de reno y el texto “Merry Christmas”.'),
  ('d97fb116-198d-43e3-bb75-12e156972008', 'Remera navideña con árbol', 'Remeras', null, '/images/remera-navidad-arbol.webp', 'Diseño navideño con árbol, regalos y muñeco de nieve, mostrado sobre una remera negra.')
on conflict (id) do nothing;
