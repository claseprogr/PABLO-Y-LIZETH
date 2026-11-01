'use strict';
// Comunicación con Supabase usando solo fetch (sin librerías externas).
(function () {
  const C = window.APP_CONFIG || {};
  const configured = !!C.SUPABASE_URL && !!C.SUPABASE_KEY && !/XXXX|PEGA_AQUI/.test(C.SUPABASE_URL + C.SUPABASE_KEY);
  const base = String(C.SUPABASE_URL || '').replace(/\/+$/, '');

  function headers(token) {
    const h = { apikey: C.SUPABASE_KEY, 'Content-Type': 'application/json' };
    // Con clave anónima clásica (eyJ...) también va como Authorization; las claves nuevas (sb_publishable_...) solo como apikey.
    const bearer = token || (/^eyJ/.test(C.SUPABASE_KEY || '') ? C.SUPABASE_KEY : null);
    if (bearer) h.Authorization = 'Bearer ' + bearer;
    return h;
  }

  async function call(path, opts) {
    const r = await fetch(base + path, opts);
    let body = null;
    try { body = await r.json(); } catch { /* respuesta vacía */ }
    if (!r.ok) {
      const err = new Error((body && (body.message || body.msg || body.error_description)) || ('Error ' + r.status));
      err.status = r.status; err.code = body && body.code;
      throw err;
    }
    return body;
  }

  window.Api = {
    configured,
    rpc: (name, args, token) => call('/rest/v1/rpc/' + name, { method: 'POST', headers: headers(token), body: JSON.stringify(args || {}), cache: 'no-store' }),
    select: (table, query, token) => call('/rest/v1/' + table + (query ? '?' + query : ''), { method: 'GET', headers: headers(token), cache: 'no-store' }),
    login: (email, password) => call('/auth/v1/token?grant_type=password', { method: 'POST', headers: headers(), body: JSON.stringify({ email, password }) }),
    refresh: (refresh_token) => call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: headers(), body: JSON.stringify({ refresh_token }) }),
  };
})();
