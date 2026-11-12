# Punto a Punto

## Conectar el backend de Supabase

1. En un proyecto nuevo de Supabase, abre **SQL Editor** y ejecuta estos archivos en este orden: [`supabase/schema.sql`](./supabase/schema.sql), [`supabase/site_settings.sql`](./supabase/site_settings.sql), [`supabase/business_contact.sql`](./supabase/business_contact.sql), [`supabase/commerce_features.sql`](./supabase/commerce_features.sql), [`supabase/reports_security.sql`](./supabase/reports_security.sql) y [`supabase/seasonal_products.sql`](./supabase/seasonal_products.sql). En un proyecto ya configurado, ejecuta [`supabase/business_contact.sql`](./supabase/business_contact.sql) una vez para actualizar el WhatsApp y correo públicos del negocio; para otros cambios ejecuta solo la migración que corresponda. La web no permite cambiar las políticas desde el panel.
2. En **Project Settings → API**, copia el **Project URL** y la clave **anon/public** o **publishable**. No uses ni compartas `service_role`, claves secretas ni la contraseña de tu cuenta.
3. En una terminal de VS Code abierta en la carpeta del proyecto, ejecuta:

   ```powershell
   Copy-Item .env.example .env.local
   ```

   Abre `.env.local` y reemplaza los valores de ejemplo por el Project URL y la clave pública. No subas ese archivo a Git ni lo compartas.
4. En **Authentication → Users**, crea tu propio usuario con tu correo y una contraseña fuerte que solo tú conozcas. No habilites un formulario de registro público para este sitio.
5. Copia el **UUID** de ese usuario y, desde **SQL Editor**, ejecuta el siguiente comando reemplazando el texto de ejemplo:

   ```sql
   insert into public.admin_users (user_id)
   values ('PEGA-AQUI-EL-UUID-DE-TU-USUARIO');
   ```

   Solo los usuarios incluidos en `admin_users` pueden administrar el catálogo y ver los pedidos. Conserva el acceso a tu cuenta de Supabase y a su SQL Editor.
6. Inicia el sitio en VS Code:

   ```bash
   npm run dev
   ```

   Este comando inicia el frontend y el backend Node. Pulsa **Admin** e inicia sesión con el correo y la contraseña que creaste en Supabase. Al entrar, puedes guardar el nombre, correo y WhatsApp del negocio, agregar productos, subir imágenes a Cloudinary, usar **Editar** en un producto existente y administrar categorías. El panel incluye reportes de productos y pedidos; cambia cada pedido a **Entregado** cuando corresponda para actualizar el resumen. Los clientes pueden buscar por nombre/categoría, armar un carrito y enviar pedidos o diseños personalizados con una imagen de referencia opcional (JPG, PNG o WebP de hasta 5 MB).

   Si el inicio de sesión muestra **Failed to fetch**, confirma que `VITE_SUPABASE_URL` sea el **Project URL** exacto del mismo proyecto activo que proporciona la clave configurada. Actualiza `.env.local` y reinicia `npm run dev`; no compartas la clave.

Supabase gestiona la base de datos y la autenticación; Express.js proporciona las rutas REST para las integraciones externas. RLS limita la administración y lectura de pedidos a las cuentas de `admin_users`; los visitantes solo pueden crear pedidos nuevos como pendientes. Los formularios y las restricciones de la base validan los datos. Al publicar la web, configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en el entorno privado del proveedor.

## Integraciones externas

Express.js ejecuta la API REST del proyecto. Expone `/api/health` para comprobar el servicio, `/api/inspiration` para buscar fotos en Pixabay y rutas protegidas de `/api/admin/images` para cargar o eliminar imágenes en Cloudinary. Antes de permitir operaciones de administración, verifica la sesión de Supabase y que la cuenta pertenezca a `admin_users`.

El backend Node usa las mismas variables de Supabase que el frontend para comprobar la sesión y el permiso de administrador antes de aceptar cargas o eliminar imágenes.

1. Crea una cuenta en Cloudinary y copia **Cloud name**, **API Key** y **API Secret** desde el Dashboard. Añade esos valores a `.env.local` en `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET`.
2. Solicita una clave de API en [Pixabay](https://pixabay.com/api/docs/) y añádela a `.env.local` como `PIXABAY_API_KEY`. La sección **Inspiración** busca imágenes desde el backend y enlaza cada resultado con Pixabay. Los resultados se guardan en caché durante 24 horas, según las condiciones de la API.
3. Las credenciales de Cloudinary y Pixabay son solo para el servidor. No les pongas el prefijo `VITE_`, no las pegues en el código ni las compartas. Reinicia `npm run dev` después de cambiarlas.
4. La sección **Ubicación** muestra el mapa de Google Maps compartido y ofrece un enlace para abrirlo. WhatsApp ya permite iniciar una conversación con los datos del pedido; el seguimiento de estados se administra desde el panel, no se envía automáticamente por WhatsApp.

Si todavía no tienes cuentas o claves de Cloudinary o Pixabay, puedes dejar esas variables vacías: el catálogo y el resto del sitio seguirán funcionando. La carga de archivos y la búsqueda mostrarán que falta configurar las credenciales.

Para publicar frontend y backend juntos en un hosting que admita Node, configura `NODE_ENV=production` y las variables del backend en el entorno privado del proveedor, ejecuta `npm run build` y usa `npm start` para servir la aplicación. No publiques `.env.local`.

### Publicar en Render

El archivo [`render.yaml`](./render.yaml) configura un servicio web de Node con compilación de Vite, comprobación de salud y plan gratuito. Para publicarlo:

1. Asegúrate de que `.env.local` no se suba al repositorio; está excluido por `.gitignore`.
2. Sube el proyecto a un repositorio **privado** de GitHub y conéctalo desde Render mediante **New → Blueprint**.
3. En Render, introduce `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` como variables privadas cuando el Blueprint las solicite. Para habilitar la búsqueda de inspiración, agrega también `PIXABAY_API_KEY`. No pongas estas claves en archivos versionados ni en mensajes.
4. En Supabase, ejecuta `supabase/business_contact.sql` para actualizar el WhatsApp y el correo públicos. En **Authentication → URL Configuration**, configura la URL pública de Render como **Site URL** y añade esa misma URL a **Redirect URLs**.
5. Espera a que termine el despliegue y verifica `/api/health`, el catálogo, el acceso de administrador y el envío de un pedido de prueba.

En el plan gratuito de Render el servicio puede tardar en despertar después de un período sin actividad. Cloudinary y Pixabay siguen siendo opcionales y solo funcionarán al configurar sus credenciales en las variables privadas del servicio.

## Herramientas MCP para desarrollo en VS Code

El archivo [`.vscode/mcp.json`](./.vscode/mcp.json) configura GitHub y Context7 como servicios remotos con inicio de sesión OAuth, y Filesystem y Playwright como servidores locales de Node. La primera vez, VS Code puede pedir autorización para GitHub y Context7 y descargar los dos servidores locales con `npx`. Abre la paleta de comandos con `Ctrl+Shift+P`, ejecuta **MCP: List Servers** y elige iniciar los servidores. Filesystem solo recibe acceso a la carpeta del proyecto.

Estas herramientas ayudan al agente durante el desarrollo; no se conectan automáticamente a los visitantes ni agregan funciones al sitio publicado. Se mantiene Supabase como base de datos. No se configura MySQL porque esta aplicación usa Supabase/PostgreSQL. La configuración recomendada tampoco incluye Figma; se puede agregar si luego trabajas con diseños en Figma.
