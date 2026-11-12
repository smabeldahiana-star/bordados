import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';
import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'node:url';

const imageLimit = 5 * 1024 * 1024;
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const inspirationCache = new Map();
const inspirationCacheTtl = 24 * 60 * 60 * 1000;
const inspirationCacheLimit = 100;

function getCachedInspiration(query) {
  const cached = inspirationCache.get(query);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    inspirationCache.delete(query);
    return null;
  }
  return cached.photos;
}

function cacheInspiration(query, photos) {
  if (inspirationCache.size >= inspirationCacheLimit) {
    const oldestQuery = inspirationCache.keys().next().value;
    if (oldestQuery !== undefined) inspirationCache.delete(oldestQuery);
  }
  inspirationCache.set(query, { photos, expiresAt: Date.now() + inspirationCacheTtl });
}

function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME
    && process.env.CLOUDINARY_API_KEY
    && process.env.CLOUDINARY_API_SECRET
  );
}

function getCloudinaryPublicId(imageUrl) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName || typeof imageUrl !== 'string') return null;

  let url;
  try {
    url = new URL(imageUrl);
  } catch {
    return null;
  }

  if (url.hostname !== 'res.cloudinary.com') return null;
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[0] !== cloudName || segments[1] !== 'image' || segments[2] !== 'upload') return null;

  const assetSegments = segments.slice(3);
  if (assetSegments[0]?.match(/^v\d+$/)) assetSegments.shift();
  if (!assetSegments.join('/').startsWith('punto-a-punto/productos/')) return null;

  const lastSegment = assetSegments.pop();
  const extensionIndex = lastSegment.lastIndexOf('.');
  assetSegments.push(extensionIndex > 0 ? lastSegment.slice(0, extensionIndex) : lastSegment);
  return assetSegments.join('/');
}

function uploadToCloudinary(file) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'punto-a-punto/productos', resource_type: 'image' },
      (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary no pudo guardar la imagen: ${error.message}`));
          return;
        }
        if (!result?.secure_url || !result.public_id) {
          reject(new Error('Cloudinary no devolvió los datos de la imagen guardada.'));
          return;
        }
        resolve({ image: result.secure_url });
      }
    );
    stream.end(file.buffer);
  });
}

function deleteFromCloudinary(publicId) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  return cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
}

function requireAdministrator() {
  return async (request, response, next) => {
    const token = request.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!token) {
      response.status(401).json({ error: 'Inicia sesión para continuar.' });
      return;
    }
    if (!supabaseUrl || !supabaseKey) {
      response.status(503).json({ error: 'El backend no está conectado a Supabase.' });
      return;
    }

    try {
      const authClient = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      const { data: { user }, error: authError } = await authClient.auth.getUser(token);
      if (authError || !user) {
        response.status(401).json({ error: 'La sesión no es válida. Inicia sesión nuevamente.' });
        return;
      }

      const userClient = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } }
      });
      const { data: administrator, error: permissionError } = await userClient
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (permissionError) {
        response.status(500).json({ error: `No se pudo verificar el permiso de administrador: ${permissionError.message}` });
        return;
      }
      if (!administrator) {
        response.status(403).json({ error: 'Esta cuenta no tiene permisos de administrador.' });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: imageLimit, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (!allowedImageTypes.has(file.mimetype)) {
      callback(new Error('Adjunta una imagen JPG, PNG o WebP.'));
      return;
    }
    callback(null, true);
  }
});

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.get('/api/inspiration', async (request, response, next) => {
    const searchTerm = typeof request.query.query === 'string' ? request.query.query.trim() : '';
    if (searchTerm.length < 2 || searchTerm.length > 80) {
      response.status(400).json({ error: 'Escribe una búsqueda de entre 2 y 80 caracteres.' });
      return;
    }
    if (!process.env.PIXABAY_API_KEY) {
      response.status(503).json({ error: 'La búsqueda de inspiración aún no está configurada. Agrega PIXABAY_API_KEY en .env.local.' });
      return;
    }

    const query = `embroidered patch ${searchTerm}`;
    const cachedPhotos = getCachedInspiration(query);
    if (cachedPhotos) {
      response.json({ photos: cachedPhotos });
      return;
    }

    try {
      const parameters = new URLSearchParams({
        key: process.env.PIXABAY_API_KEY,
        q: query,
        lang: 'es',
        image_type: 'photo',
        safesearch: 'true',
        per_page: '12'
      });
      const pixabayResponse = await fetch(`https://pixabay.com/api/?${parameters}`);
      if (!pixabayResponse.ok) {
        response.status(502).json({ error: `Pixabay respondió con el estado ${pixabayResponse.status}. Verifica la clave de API.` });
        return;
      }

      const results = await pixabayResponse.json();
      const photos = (results.hits ?? []).map((photo) => ({
          id: photo.id,
          alt: photo.tags || 'Fotografía de inspiración',
          image: photo.webformatURL,
          photographer: photo.user || 'Comunidad de Pixabay',
          photoUrl: photo.pageURL
        })).filter((photo) => (
          photo.image
          && photo.photoUrl
          && /\b(?:patch(?:es)?|parche(?:s)?)\b/i.test(photo.alt)
        ));
      cacheInspiration(query, photos);
      response.json({ photos });
    } catch (error) {
      next(error);
    }
  });

  app.post(
    '/api/admin/images',
    requireAdministrator(),
    imageUpload.single('image'),
    async (request, response, next) => {
      if (!isCloudinaryConfigured()) {
        response.status(503).json({ error: 'Cloudinary aún no está configurado. Agrega sus credenciales en .env.local.' });
        return;
      }
      if (!request.file) {
        response.status(400).json({ error: 'Selecciona una imagen JPG, PNG o WebP.' });
        return;
      }

      try {
        response.status(201).json(await uploadToCloudinary(request.file));
      } catch (error) {
        next(error);
      }
    }
  );

  app.post('/api/admin/images/delete', requireAdministrator(), async (request, response, next) => {
    const publicId = getCloudinaryPublicId(request.body?.image);
    if (!publicId) {
      response.json({ deleted: false, skipped: true });
      return;
    }
    if (!isCloudinaryConfigured()) {
      response.status(503).json({ error: 'Cloudinary no está configurado para eliminar esta imagen.' });
      return;
    }

    try {
      const result = await deleteFromCloudinary(publicId);
      if (!['ok', 'not found'].includes(result.result)) {
        response.status(502).json({ error: `Cloudinary no pudo eliminar la imagen: ${result.result}.` });
        return;
      }
      response.json({ deleted: true });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api', (_request, response) => {
    response.status(404).json({ error: 'Ruta de API no encontrada.' });
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = fileURLToPath(new URL('../dist/', import.meta.url));
    app.use(express.static(distPath));
    app.get('*path', (_request, response) => {
      response.sendFile(fileURLToPath(new URL('../dist/index.html', import.meta.url)));
    });
  }

  app.use((error, _request, response, _next) => {
    if (response.headersSent) return;
    if (error instanceof multer.MulterError) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      response.status(status).json({
        error: status === 413 ? 'La imagen debe pesar 5 MB o menos.' : `No se pudo procesar la imagen: ${error.message}`
      });
      return;
    }
    if (error.message === 'Adjunta una imagen JPG, PNG o WebP.') {
      response.status(400).json({ error: error.message });
      return;
    }
    console.error('Error de API:', error);
    response.status(500).json({ error: error.message || 'Ocurrió un error inesperado en el servidor.' });
  });

  return app;
}
