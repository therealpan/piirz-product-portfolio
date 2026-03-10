/**
 * PiirZ Portfolio API — Cloudflare Worker
 *
 * Storage:
 *   - PRODUCTS KV: stores products.json under key "data"
 *   - LOGS KV: stores analytics events with timestamp keys
 *   - ATTACHMENTS R2: stores file uploads (attachments/)
 *
 * Endpoints:
 *   POST /api/auth/login       — Login, returns HMAC token
 *   PUT  /api/auth/password    — Change admin password (auth required)
 *   GET  /api/products         — Read products.json (public)
 *   PUT  /api/products/:key    — Update a product (auth required)
 *   POST /api/log              — Log an event (public)
 *   GET  /api/logs             — Read logs (auth required)
 *   GET  /api/logs/stats       — Aggregated log stats (auth required)
 *   POST /api/upload           — Upload a file to R2 (auth required)
 *   DELETE /api/upload/:id     — Delete a file from R2 (auth required)
 *   GET  /api/file/*           — Serve a file from R2 (public, cached)
 *
 * Password override: stored in PRODUCTS KV under key "_admin_pass".
 *   If present, it overrides env.ADMIN_PASS at runtime (no redeploy needed).
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ─── Helpers ───────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function error(msg, status = 400) {
  return json({ error: msg }, status);
}

function unauthorized() {
  return error('Unauthorized', 401);
}

// Simple token: base64(user:timestamp:hmac)
async function createToken(user, secret) {
  const ts = Date.now().toString();
  const data = `${user}:${ts}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const hmac = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return btoa(`${data}:${hmac}`);
}

async function verifyToken(token, secret) {
  try {
    const decoded = atob(token);
    const parts = decoded.split(':');
    if (parts.length < 3) return null;
    const user = parts[0];
    const ts = parts[1];
    const hmac = parts.slice(2).join(':');

    // Check token age (24h)
    if (Date.now() - parseInt(ts) > 86400000) return null;

    const data = `${user}:${ts}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sigBytes = Uint8Array.from(atob(hmac), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data));
    return valid ? user : null;
  } catch {
    return null;
  }
}

// Returns the effective admin password: KV override takes precedence over env secret.
// This allows changing the password at runtime without redeploying the Worker.
async function getEffectivePassword(env) {
  const override = await env.PRODUCTS.get('_admin_pass');
  return override || env.ADMIN_PASS;
}

async function requireAuth(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const secret = await getEffectivePassword(env);
  return verifyToken(token, secret);
}

// ─── Route Handlers ────────────────────────────────────────

async function handleLogin(request, env) {
  const { username, password } = await request.json();
  const effectivePass = await getEffectivePassword(env);
  if (username === env.ADMIN_USER && password === effectivePass) {
    const token = await createToken(username, effectivePass);
    return json({ token, expires: Date.now() + 86400000 });
  }
  return error('Invalid credentials', 401);
}

async function handleChangePassword(request, env) {
  const { currentPassword, newPassword } = await request.json();

  if (!newPassword || newPassword.length < 8) {
    return error('La nuova password deve avere almeno 8 caratteri', 400);
  }

  const effectivePass = await getEffectivePassword(env);
  if (currentPassword !== effectivePass) {
    // 400 (not 401) so the client doesn't auto-logout on wrong current password
    return error('Password attuale non corretta', 400);
  }

  // Store the new password in KV — overrides env.ADMIN_PASS at runtime
  await env.PRODUCTS.put('_admin_pass', newPassword);

  // All existing tokens are now invalid (HMAC secret changed) — client must re-login
  return json({ ok: true });
}

async function handleGetProducts(env) {
  const data = await env.PRODUCTS.get('data');
  if (data) {
    return new Response(data, {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
  return error('Products not found', 404);
}

async function handleUpdateProduct(request, env, key) {
  const raw = await env.PRODUCTS.get('data');
  if (!raw) return error('Products DB not found', 404);

  const db = JSON.parse(raw);
  const idx = db.products.findIndex(p => p.key === key);
  if (idx === -1) return error('Product not found', 404);

  const updates = await request.json();

  // Merge updates into product (allow partial updates)
  const product = db.products[idx];
  if (updates.name) Object.assign(product.name, updates.name);
  if (updates.category) Object.assign(product.category, updates.category);
  if (updates.description) Object.assign(product.description, updates.description);
  if (updates.details) {
    for (const [lang, det] of Object.entries(updates.details)) {
      if (!product.details[lang]) product.details[lang] = { html: '', links: [], images: [] };
      Object.assign(product.details[lang], det);
    }
  }
  if (updates.attachments !== undefined) product.attachments = updates.attachments;
  if (updates.icon) product.icon = updates.icon;
  if (updates.iconColor) product.iconColor = updates.iconColor;
  if (updates.tags) product.tags = updates.tags;
  if (updates.techTags) product.techTags = updates.techTags;

  db.meta.lastModified = new Date().toISOString();

  // Write back to KV
  await env.PRODUCTS.put('data', JSON.stringify(db, null, 2));

  return json({ ok: true, product: db.products[idx] });
}

async function handleLog(request, env) {
  try {
    const body = await request.text();
    const event = JSON.parse(body);

    // Store in KV with timestamp key for ordering
    const key = `${new Date().toISOString()}_${Math.random().toString(36).slice(2, 8)}`;
    await env.LOGS.put(key, JSON.stringify({
      ...event,
      ip: request.headers.get('CF-Connecting-IP') || 'unknown',
      country: request.headers.get('CF-IPCountry') || 'unknown',
      userAgent: request.headers.get('User-Agent') || '',
      receivedAt: new Date().toISOString(),
    }), { expirationTtl: 7776000 }); // 90 days

    return json({ ok: true });
  } catch {
    return json({ ok: true }); // Don't fail on log errors
  }
}

async function handleGetLogs(env, url) {
  const params = new URL(url).searchParams;
  const limit = Math.min(parseInt(params.get('limit') || '100'), 1000);
  const prefix = params.get('prefix') || '';
  const from = params.get('from') || '';

  const list = await env.LOGS.list({ prefix: from || prefix, limit });
  const logs = [];

  for (const key of list.keys) {
    const val = await env.LOGS.get(key.name);
    if (val) {
      try { logs.push({ id: key.name, ...JSON.parse(val) }); } catch {}
    }
  }

  return json({ logs, cursor: list.cursor, complete: list.list_complete });
}

async function handleLogStats(env) {
  const list = await env.LOGS.list({ limit: 1000 });
  const stats = {
    total: 0,
    byType: {},
    byProduct: {},
    byCountry: {},
    byDay: {},
  };

  for (const key of list.keys) {
    const val = await env.LOGS.get(key.name);
    if (!val) continue;
    try {
      const log = JSON.parse(val);
      stats.total++;
      stats.byType[log.event] = (stats.byType[log.event] || 0) + 1;
      if (log.product) stats.byProduct[log.product] = (stats.byProduct[log.product] || 0) + 1;
      if (log.country) stats.byCountry[log.country] = (stats.byCountry[log.country] || 0) + 1;
      const day = (log.receivedAt || log.ts || '').split('T')[0];
      if (day) stats.byDay[day] = (stats.byDay[day] || 0) + 1;
    } catch {}
  }

  return json(stats);
}

// ─── R2 File Handlers ─────────────────────────────────────

async function handleUpload(request, env) {
  const contentType = request.headers.get('Content-Type') || '';

  if (!contentType.includes('multipart/form-data')) {
    return error('Expected multipart/form-data', 400);
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) return error('No file provided', 400);

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `attachments/${timestamp}_${safeName}`;

  await env.ATTACHMENTS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { originalName: file.name, uploadedAt: new Date().toISOString() },
  });

  return json({
    ok: true,
    file: {
      key,
      name: file.name,
      size: file.size,
      type: file.type,
      url: `/api/file/${key}`,
    },
  });
}

async function handleDeleteUpload(env, fileKey) {
  await env.ATTACHMENTS.delete(fileKey);
  return json({ ok: true });
}

async function handleServeFile(env, filePath) {
  const object = await env.ATTACHMENTS.get(filePath);
  if (!object) return error('File not found', 404);

  const headers = new Headers(CORS_HEADERS);
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
}

// ─── Router ────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // Public endpoints
      if (method === 'POST' && path === '/api/auth/login') {
        return handleLogin(request, env);
      }

      if (method === 'POST' && path === '/api/log') {
        return handleLog(request, env);
      }

      if (method === 'GET' && path === '/api/products') {
        return handleGetProducts(env);
      }

      // Public file serving from R2
      if (method === 'GET' && path.startsWith('/api/file/')) {
        const filePath = path.slice('/api/file/'.length);
        return handleServeFile(env, filePath);
      }

      // Auth-required endpoints
      if (path.startsWith('/api/')) {
        const user = await requireAuth(request, env);
        if (!user) return unauthorized();

        if (method === 'PUT' && path === '/api/auth/password') {
          return handleChangePassword(request, env);
        }

        if (method === 'PUT' && path.startsWith('/api/products/')) {
          const key = path.split('/api/products/')[1];
          return handleUpdateProduct(request, env, key);
        }

        if (method === 'GET' && path === '/api/logs') {
          return handleGetLogs(env, request.url);
        }

        if (method === 'GET' && path === '/api/logs/stats') {
          return handleLogStats(env);
        }

        if (method === 'POST' && path === '/api/upload') {
          return handleUpload(request, env);
        }

        if (method === 'DELETE' && path.startsWith('/api/upload/')) {
          const fileKey = decodeURIComponent(path.slice('/api/upload/'.length));
          return handleDeleteUpload(env, fileKey);
        }
      }

      return error('Not found', 404);

    } catch (err) {
      return error(`Server error: ${err.message}`, 500);
    }
  },
};
