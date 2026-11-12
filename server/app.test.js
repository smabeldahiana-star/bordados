import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from './app.js';

const server = createApp().listen(0, '127.0.0.1');
let baseUrl;

before(async () => {
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => {
  server.close();
});

test('GET /api/health returns a healthy response', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('GET /api/inspiration rejects invalid search terms', async () => {
  const response = await fetch(`${baseUrl}/api/inspiration?query=x`);
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /entre 2 y 80 caracteres/);
});

test('GET /api/inspiration reports missing Pixabay credentials', async () => {
  const originalKey = process.env.PIXABAY_API_KEY;
  delete process.env.PIXABAY_API_KEY;
  try {
    const response = await fetch(`${baseUrl}/api/inspiration?query=parches%20bordados`);
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /PIXABAY_API_KEY/);
  } finally {
    if (originalKey === undefined) delete process.env.PIXABAY_API_KEY;
    else process.env.PIXABAY_API_KEY = originalKey;
  }
});

test('GET /api/inspiration searches Pixabay and returns normalized photos', async () => {
  const originalKey = process.env.PIXABAY_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.PIXABAY_API_KEY = 'test-pixabay-key';
  let providerUrl;
  let providerCalls = 0;
  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    if (url.hostname === 'pixabay.com') {
      providerUrl = url;
      providerCalls += 1;
      return new Response(JSON.stringify({
        hits: [{
          id: 123,
          tags: 'embroidered patch, flowers',
          webformatURL: 'https://pixabay.com/get/test-image.jpg',
          user: 'artista',
          pageURL: 'https://pixabay.com/photos/test-image-123/'
        }, {
          id: 456,
          tags: 'bordado, flores',
          webformatURL: 'https://pixabay.com/get/unrelated-image.jpg',
          user: 'artista',
          pageURL: 'https://pixabay.com/photos/unrelated-image-456/'
        }]
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return originalFetch(input, options);
  };

  try {
    const searchUrl = `${baseUrl}/api/inspiration?query=bordado%20flores`;
    const response = await originalFetch(searchUrl);
    assert.equal(response.status, 200);
    const expected = {
      photos: [{
        id: 123,
        alt: 'embroidered patch, flowers',
        image: 'https://pixabay.com/get/test-image.jpg',
        photographer: 'artista',
        photoUrl: 'https://pixabay.com/photos/test-image-123/'
      }]
    };
    assert.deepEqual(await response.json(), expected);
    const cachedResponse = await originalFetch(searchUrl);
    assert.equal(cachedResponse.status, 200);
    assert.deepEqual(await cachedResponse.json(), expected);
    assert.equal(providerCalls, 1);
    assert.equal(providerUrl.origin, 'https://pixabay.com');
    assert.equal(providerUrl.pathname, '/api/');
    assert.equal(providerUrl.searchParams.get('key'), 'test-pixabay-key');
    assert.equal(providerUrl.searchParams.get('q'), 'embroidered patch bordado flores');
    assert.equal(providerUrl.searchParams.get('image_type'), 'photo');
    assert.equal(providerUrl.searchParams.get('safesearch'), 'true');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.PIXABAY_API_KEY;
    else process.env.PIXABAY_API_KEY = originalKey;
  }
});

test('POST /api/admin/images requires an authenticated administrator', async () => {
  const response = await fetch(`${baseUrl}/api/admin/images`, { method: 'POST' });
  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /Inicia sesión/);
});
