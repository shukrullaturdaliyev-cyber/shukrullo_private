// Cloudflare Pages Function: JSON blob store on KV.
//   GET    /api/data/<key>   -> stored JSON (or null)
//   PUT    /api/data/<key>   -> store request body (JSON)
//   DELETE /api/data/<key>   -> remove
// Auth: header `x-passphrase` must equal the SITE_PASSPHRASE secret.
// Special key `_auth` answers { ok, protected } for login checks.

const KEY_RE = /^[a-z_][a-z0-9_-]{0,60}$/;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

function authed(request, env) {
  const secret = env.SITE_PASSPHRASE;
  if (!secret) return true; // unconfigured project: open, but the UI warns
  const given = request.headers.get('x-passphrase') || '';
  if (given.length !== secret.length) return false;
  // constant-time-ish compare
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= given.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const key = String(params.collection || '');

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { 'access-control-allow-methods': 'GET,PUT,DELETE,OPTIONS', 'access-control-allow-headers': 'content-type,x-passphrase' },
    });
  }

  if (!KEY_RE.test(key)) return json({ error: 'bad key' }, 400);

  const ok = authed(request, env);
  if (key === '_auth') {
    if (!ok) return json({ ok: false, protected: true }, 401);
    return json({ ok: true, protected: !!env.SITE_PASSPHRASE, kv: !!env.DESK });
  }
  if (!ok) return json({ error: 'unauthorized' }, 401);
  if (!env.DESK) return json({ error: 'KV namespace DESK is not bound to this project' }, 503);

  try {
    if (request.method === 'GET') {
      const raw = await env.DESK.get('desk:' + key);
      return new Response(raw == null ? 'null' : raw, {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
    if (request.method === 'PUT') {
      const body = await request.text();
      if (body.length > 20 * 1024 * 1024) return json({ error: 'too large' }, 413);
      try { JSON.parse(body); } catch { return json({ error: 'body must be JSON' }, 400); }
      await env.DESK.put('desk:' + key, body);
      return json({ ok: true, bytes: body.length });
    }
    if (request.method === 'DELETE') {
      await env.DESK.delete('desk:' + key);
      return json({ ok: true });
    }
  } catch (err) {
    return json({ error: String(err && err.message || err) }, 500);
  }
  return json({ error: 'method not allowed' }, 405);
}
