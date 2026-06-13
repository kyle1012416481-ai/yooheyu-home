import ALBUM_HTML from './src/album.html';

const HOME_HTML = `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>yhy</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    h1 {
      font-size: clamp(6rem, 20vw, 16rem);
      font-weight: 900;
      letter-spacing: 0.05em;
      background: linear-gradient(90deg, #a78bfa, #f472b6, #60a5fa, #a78bfa);
      background-size: 300% 100%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: shimmer 4s linear infinite;
      user-select: none;
    }
    @keyframes shimmer {
      0%   { background-position: 0% 50%; }
      100% { background-position: 300% 50%; }
    }
    .glow {
      position: absolute;
      width: 600px;
      height: 600px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(167,139,250,0.15), transparent 70%);
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div class="glow"></div>
  <div><h1>yhy</h1></div>
</body>
</html>`;

// ── Crypto helpers ──

async function getSigningKey(env) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode('yooheyu-session-v1:' + env.ALBUM_PASSWORD),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function createToken(env) {
  const expiry = String(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const key = await getSigningKey(env);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(expiry));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return expiry + '.' + b64;
}

async function verifyToken(token, env) {
  const dot = token.indexOf('.');
  if (dot < 0) return false;
  const expiry = token.substring(0, dot);
  if (Date.now() > parseInt(expiry, 10)) return false;
  const sig = token.substring(dot + 1);
  const key = await getSigningKey(env);
  const expected = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(expiry));
  const expectedB64 = btoa(String.fromCharCode(...new Uint8Array(expected)));
  return sig === expectedB64;
}

// ── Cookie helpers ──

function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return match ? match[1] : null;
}

function sessionCookie(token, maxAge) {
  return `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

// ── Response helpers ──

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function html(body) {
  return new Response(body, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
  });
}

// ── Auth check ──

async function requireAuth(request, env) {
  const token = getCookie(request, 'session');
  if (!token) return false;
  return verifyToken(token, env);
}

// ── Unique ID generation ──

function generateId(dateStr, originalName) {
  const dateKey = (dateStr || '00000000').replace(/-/g, '');
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  const ext = (originalName || 'jpg').split('.').pop().toLowerCase();
  return `${dateKey}_${hex}.${ext}`;
}

// ── API handlers ──

async function handleLogin(request, env) {
  if (!env.ALBUM_PASSWORD) {
    return json({ error: 'Album password not configured' }, 500);
  }
  try {
    const body = await request.json();
    if (body.password !== env.ALBUM_PASSWORD) {
      return json({ error: '密码错误' }, 401);
    }
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }
  const token = await createToken(env);
  return json({ ok: true }, 200, {
    'Set-Cookie': sessionCookie(token, 7 * 24 * 60 * 60),
  });
}

function handleLogout() {
  return json({ ok: true }, 200, {
    'Set-Cookie': sessionCookie('', 0),
  });
}

async function handleListPhotos(env) {
  const allPhotos = [];
  let cursor;
  do {
    const listed = await env.PHOTOS_BUCKET.list({
      prefix: 'photos/',
      cursor,
      limit: 1000,
      include: ['customMetadata', 'httpMetadata'],
    });
    for (const obj of listed.objects) {
      allPhotos.push({
        id: obj.key.replace('photos/', ''),
        date: obj.customMetadata?.date || '',
        originalName: obj.customMetadata?.originalName || '',
        size: obj.size,
        uploaded: obj.uploaded.toISOString(),
      });
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  allPhotos.sort((a, b) => b.date.localeCompare(a.date) || b.uploaded.localeCompare(a.uploaded));
  return json({ photos: allPhotos });
}

async function handleGetPhoto(request, env) {
  const url = new URL(request.url);
  const id = decodeURIComponent(url.pathname.replace('/api/photo/', ''));
  const obj = await env.PHOTOS_BUCKET.get('photos/' + id);
  if (!obj) return new Response('Not Found', { status: 404 });

  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg',
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}

async function handleGetThumb(request, env) {
  const url = new URL(request.url);
  const id = decodeURIComponent(url.pathname.replace('/api/thumb/', ''));
  const obj = await env.PHOTOS_BUCKET.get('thumbs/' + id);

  if (!obj) {
    return handleGetPhoto(request, env);
  }

  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg',
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}

async function handleUpload(request, env) {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: 'Invalid form data' }, 400);
  }

  const file = formData.get('file');
  if (!file || !file.size) return json({ error: 'No file provided' }, 400);

  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) return json({ error: 'File too large (max 50MB)' }, 413);

  const date = formData.get('date') || '';
  const id = generateId(date, file.name);

  await env.PHOTOS_BUCKET.put('photos/' + id, file.stream(), {
    httpMetadata: { contentType: file.type || 'image/jpeg' },
    customMetadata: {
      date,
      originalName: file.name || '',
    },
  });

  const thumbnail = formData.get('thumbnail');
  if (thumbnail && thumbnail.size) {
    await env.PHOTOS_BUCKET.put('thumbs/' + id, thumbnail.stream(), {
      httpMetadata: { contentType: 'image/jpeg' },
    });
  }

  return json({
    id,
    date,
    originalName: file.name || '',
    size: file.size,
    uploaded: new Date().toISOString(),
  });
}

async function handleDelete(request, env) {
  const url = new URL(request.url);
  const id = decodeURIComponent(url.pathname.replace('/api/photo/', ''));
  await env.PHOTOS_BUCKET.delete('photos/' + id);
  await env.PHOTOS_BUCKET.delete('thumbs/' + id);
  return json({ ok: true });
}

// ── Main router ──

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'GET' && path === '/') return html(HOME_HTML);
    if (method === 'GET' && path === '/album') return html(ALBUM_HTML);

    if (method === 'POST' && path === '/api/login') return handleLogin(request, env);
    if (method === 'POST' && path === '/api/logout') return handleLogout();

    if (path.startsWith('/api/')) {
      if (!await requireAuth(request, env)) {
        return json({ error: 'Unauthorized' }, 401);
      }

      if (method === 'GET' && path === '/api/photos') return handleListPhotos(env);
      if (method === 'GET' && path.startsWith('/api/photo/')) return handleGetPhoto(request, env);
      if (method === 'GET' && path.startsWith('/api/thumb/')) return handleGetThumb(request, env);
      if (method === 'POST' && path === '/api/upload') return handleUpload(request, env);
      if (method === 'DELETE' && path.startsWith('/api/photo/')) return handleDelete(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },
};
