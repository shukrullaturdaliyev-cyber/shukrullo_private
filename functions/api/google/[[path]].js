// Cloudflare Pages Function: Google Calendar OAuth bridge + API proxy.
//
//   GET  /api/google/auth        -> { url } consent screen to open
//   GET  /api/google/callback    -> exchanges ?code, stores refresh token, redirects home
//   GET  /api/google/status      -> { configured, connected, email }
//   POST /api/google/disconnect  -> forgets the refresh token
//   GET  /api/google/calendars   -> calendarList proxy
//   GET  /api/google/events?cal= -> events list proxy (singleEvents, ordered)
//   POST /api/google/events?cal= -> insert
//   PATCH|DELETE /api/google/events/:id?cal=
//
// Everything except `callback` requires the x-passphrase header.

const TOKEN_KEY = 'google:refresh_token';
const ACCESS_KEY = 'google:access_token';
const EMAIL_KEY = 'google:email';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

function authed(request, env) {
  const secret = env.SITE_PASSPHRASE;
  if (!secret) return true;
  const given = request.headers.get('x-passphrase') || '';
  if (given.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= given.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

const redirectUri = (url) => new URL('/api/google/callback', url.origin).toString();

function randomState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function accessToken(env) {
  const cached = await env.DESK.get(ACCESS_KEY, { type: 'json' });
  if (cached && cached.token && cached.expires > Date.now() + 60_000) return cached.token;

  const refresh = await env.DESK.get(TOKEN_KEY);
  if (!refresh) throw new Error('not connected to Google');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refresh,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(data.error_description || data.error || 'token refresh failed');

  const expires = Date.now() + (data.expires_in || 3600) * 1000;
  await env.DESK.put(ACCESS_KEY, JSON.stringify({ token: data.access_token, expires }), {
    expirationTtl: Math.max(60, (data.expires_in || 3600) - 30),
  });
  return data.access_token;
}

async function gfetch(env, url, init = {}) {
  const token = await accessToken(env);
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), authorization: 'Bearer ' + token, 'content-type': 'application/json' },
  });
  const text = await res.text();
  return new Response(text || (res.ok ? '{}' : '{}'), {
    status: res.status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const parts = Array.isArray(params.path) ? params.path : (params.path ? [params.path] : []);
  const route = parts[0] || '';
  const configured = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

  if (route === 'callback') {
    if (!env.DESK) return new Response('KV namespace DESK is not bound.', { status: 503 });
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || !state) return new Response('Missing code/state.', { status: 400 });
    const known = await env.DESK.get('google:state:' + state);
    if (!known) return new Response('State expired or unknown — start the connection again.', { status: 400 });
    await env.DESK.delete('google:state:' + state);

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri(url),
        grant_type: 'authorization_code',
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.refresh_token) {
      return new Response('Google did not return a refresh token: ' + JSON.stringify(data), { status: 400 });
    }
    await env.DESK.put(TOKEN_KEY, data.refresh_token);
    if (data.access_token) {
      await env.DESK.put(ACCESS_KEY, JSON.stringify({ token: data.access_token, expires: Date.now() + (data.expires_in || 3600) * 1000 }), {
        expirationTtl: Math.max(60, (data.expires_in || 3600) - 30),
      });
      try {
        const me = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
          headers: { authorization: 'Bearer ' + data.access_token },
        }).then((r) => r.json());
        if (me && me.id) await env.DESK.put(EMAIL_KEY, String(me.id));
      } catch { /* non-fatal */ }
    }
    return Response.redirect(new URL('/#shared/calendar', url.origin).toString(), 302);
  }

  if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
  if (!env.DESK) return json({ error: 'KV namespace DESK is not bound to this project' }, 503);

  try {
    if (route === 'status') {
      const connected = !!(await env.DESK.get(TOKEN_KEY));
      const email = connected ? await env.DESK.get(EMAIL_KEY) : null;
      return json({ configured, connected, email });
    }

    if (route === 'auth') {
      if (!configured) return json({ error: 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set' }, 503);
      const state = randomState();
      await env.DESK.put('google:state:' + state, '1', { expirationTtl: 600 });
      const consent = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      consent.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
      consent.searchParams.set('redirect_uri', redirectUri(url));
      consent.searchParams.set('response_type', 'code');
      consent.searchParams.set('scope', SCOPES);
      consent.searchParams.set('access_type', 'offline');
      consent.searchParams.set('prompt', 'consent');
      consent.searchParams.set('include_granted_scopes', 'true');
      consent.searchParams.set('state', state);
      return json({ url: consent.toString() });
    }

    if (route === 'disconnect') {
      await env.DESK.delete(TOKEN_KEY);
      await env.DESK.delete(ACCESS_KEY);
      await env.DESK.delete(EMAIL_KEY);
      return json({ ok: true });
    }

    if (route === 'calendars') {
      return gfetch(env, 'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250');
    }

    if (route === 'events') {
      const cal = encodeURIComponent(url.searchParams.get('cal') || 'primary');
      const base = `https://www.googleapis.com/calendar/v3/calendars/${cal}/events`;
      const id = parts[1];

      if (!id && request.method === 'GET') {
        const q = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', maxResults: '2500' });
        for (const k of ['timeMin', 'timeMax', 'q']) {
          const v = url.searchParams.get(k);
          if (v) q.set(k, v);
        }
        return gfetch(env, base + '?' + q.toString());
      }
      if (!id && request.method === 'POST') {
        return gfetch(env, base, { method: 'POST', body: await request.text() });
      }
      if (id && request.method === 'PATCH') {
        return gfetch(env, `${base}/${encodeURIComponent(id)}`, { method: 'PATCH', body: await request.text() });
      }
      if (id && request.method === 'DELETE') {
        return gfetch(env, `${base}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      }
      return json({ error: 'method not allowed' }, 405);
    }
  } catch (err) {
    return json({ error: String((err && err.message) || err) }, 502);
  }

  return json({ error: 'unknown route' }, 404);
}
