'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const LABEL = { pending: 'PENDIENTE', attending: 'ASISTENCIA CONFIRMADA', declined: 'NO ASISTIRÁN' };
  const ACTION = { respuesta: 'Respuesta', agregar: 'Agregada', editar: 'Editada', eliminar: 'Eliminada', 'corrección': 'Corrección', confirmaciones: 'Confirmaciones' };
  const COLS = 'id,code,token,name,seats,status,confirmed,responded_at,is_test';
  const SESSION_KEY = 'boda_admin_session';

  let session = null;     // { access_token, refresh_token, email }
  let fams = [];
  let log = [];
  let isOpen = true;
  let editing = null;
  let timer = null;

  // ---------- sesión ----------
  function saveSession(s) { session = s; try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* sin almacenamiento */ } }
  function clearSession() { session = null; try { sessionStorage.removeItem(SESSION_KEY); } catch { /* nada */ } }
  function fromAuth(r) { return { access_token: r.access_token, refresh_token: r.refresh_token, email: (r.user && r.user.email) || (session && session.email) || '' }; }

  async function authed(fn) {
    try { return await fn(session.access_token); }
    catch (e) {
      if (e.status !== 401 || !session) throw e;
      try { saveSession(fromAuth(await Api.refresh(session.refresh_token))); }
      catch { logout(); throw e; }
      return fn(session.access_token);
    }
  }
  const rpc = (name, args) => authed((t) => Api.rpc(name, args, t));
  const select = (table, q) => authed((t) => Api.select(table, q, t));

  function show(which) {
    for (const id of ['login', 'panel', 'noadmin', 'noconfig']) $(id).hidden = id !== which;
    $('who').hidden = which !== 'panel' && which !== 'noadmin';
    $('who-email').textContent = session ? session.email : '';
  }
  function logout() { clearSession(); clearInterval(timer); fams = []; log = []; show('login'); }

  // ---------- utilidades ----------
  function toast(msg, bad) {
    const t = $('toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3500);
  }
  const fmt = (iso) => iso ? new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' }) : '';
  const nice = (e) => (e && e.message) || 'Ocurrió un error';
  const linkFor = (f) => new URL('./', location.href).href + '?i=' + encodeURIComponent(f.token);
  function setErr(id, msg) { const p = $(id); p.textContent = msg || ''; p.hidden = !msg; }
  function cell(txt, cls, label) { const td = document.createElement('td'); if (cls) td.className = cls; if (label) td.dataset.label = label; td.textContent = txt == null ? '' : String(txt); return td; }

  // ---------- carga ----------
  async function loadAll() {
    const [f, l, open] = await Promise.all([
      select('families', 'select=' + COLS + '&order=id.asc'),
      select('audit_log', 'select=id,at,actor,action,family_name,description&order=id.desc&limit=300'),
      rpc('rsvp_is_open'),
    ]);
    fams = f || []; log = l || []; isOpen = open !== false;
    render();
  }

  async function start() {
    if (!Api.configured) return show('noconfig');
    try {
      const ok = await rpc('am_i_admin');
      if (!ok) { show('noadmin'); return; }
      show('panel');
      await loadAll();
      clearInterval(timer);
      timer = setInterval(() => { if (!document.hidden && session && !$('dlg-edit').open && !$('dlg-add').open) loadAll().catch(() => {}); }, 15000);
    } catch (e) {
      if (!session) return;
      toast(nice(e), true);
    }
  }

  // ---------- pintar ----------
  function stats() {
    const real = fams.filter((f) => !f.is_test);
    const att = real.filter((f) => f.status === 'attending');
    const dec = real.filter((f) => f.status === 'declined');
    const seats = real.reduce((a, f) => a + f.seats, 0);
    const people = att.reduce((a, f) => a + f.confirmed, 0);
    const answered = [...att, ...dec].reduce((a, f) => a + f.seats, 0);
    return [
      [real.length, 'Familias invitadas'], [seats, 'Cupos asignados'], [att.length, 'Confirmaron asistencia'],
      [dec.length, 'No asistirán'], [real.length - att.length - dec.length, 'Pendientes'],
      [people, 'Personas confirmadas'], [answered - people, 'Cupos que no se usarán'],
    ];
  }

  function render() {
    $('state-text').textContent = isOpen ? 'ABIERTAS' : 'CERRADAS';
    $('toggle').textContent = isOpen ? 'CERRAR CONFIRMACIONES' : 'ABRIR CONFIRMACIONES';
    $('stats').replaceChildren(...stats().map(([n, l]) => {
      const d = document.createElement('div'); d.className = 'stat';
      const b = document.createElement('b'); b.textContent = n;
      const s = document.createElement('span'); s.textContent = l;
      d.append(b, s); return d;
    }));

    const term = $('search').value.trim().toLowerCase(), st = $('filter').value;
    const rows = fams.filter((f) => (!st || f.status === st) && (!term || f.name.toLowerCase().includes(term) || (f.code || '').toLowerCase().includes(term)));
    $('count').textContent = rows.length === fams.length ? fams.length + ' invitaciones' : rows.length + ' de ' + fams.length + ' invitaciones';
    $('rows').replaceChildren(...rows.map((f) => {
      const tr = document.createElement('tr');
      const name = cell(f.name, '', 'Familia');
      if (f.is_test) { const s = document.createElement('span'); s.className = 'test'; s.textContent = 'PRUEBA'; name.append(s); }
      const stTd = document.createElement('td'); stTd.dataset.label = 'Estado';
      const tag = document.createElement('span'); tag.className = 'tag ' + f.status; tag.textContent = LABEL[f.status]; stTd.append(tag);
      const act = document.createElement('td'); act.className = 'acts';
      act.append(
        button('COPIAR ENLACE', async (b) => {
          try { await navigator.clipboard.writeText(linkFor(f)); b.textContent = 'COPIADO'; } catch { prompt('Copia este enlace:', linkFor(f)); }
          setTimeout(() => { b.textContent = 'COPIAR ENLACE'; }, 1500);
        }),
        button('WHATSAPP', () => {
          const tpl = (window.APP_CONFIG && APP_CONFIG.WHATSAPP_MESSAGE) || 'Tu invitación: {enlace}';
          const text = tpl.replace('{nombre}', f.name).replace('{enlace}', linkFor(f));
          window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
        }),
        button('EDITAR', () => openEdit(f)),
      );
      tr.append(cell(f.code || '', '', 'Código'), name, cell(f.seats, 'n', 'Cupos'), stTd, cell(f.confirmed == null ? '' : f.confirmed, 'n', 'Personas'), cell(fmt(f.responded_at), '', 'Respuesta'), act);
      return tr;
    }));

    $('log').replaceChildren(...log.map((x) => {
      const tr = document.createElement('tr');
      tr.append(cell(fmt(x.at), '', 'Fecha'), cell(x.actor, '', 'Quién'), cell(ACTION[x.action] || x.action, '', 'Acción'), cell(x.family_name || '', '', 'Familia'), cell(x.description, 'wrap', 'Detalle'));
      return tr;
    }));
  }

  function button(label, onclick) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'copy'; b.textContent = label;
    b.addEventListener('click', () => onclick(b)); return b;
  }

  // ---------- acciones ----------
  $('toggle').addEventListener('click', async () => {
    const closing = isOpen;
    if (!confirm(closing ? '¿Cerrar las confirmaciones? Nadie podrá registrar una respuesta nueva.' : '¿Volver a abrir las confirmaciones?')) return;
    try { await rpc('admin_set_rsvp_open', { p_open: !closing }); await loadAll(); toast(closing ? 'Confirmaciones cerradas' : 'Confirmaciones abiertas'); }
    catch (e) { toast(nice(e), true); }
  });
  $('search').addEventListener('input', render);
  $('filter').addEventListener('change', render);
  $('logout').addEventListener('click', logout);
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

  // Agregar
  $('add').addEventListener('click', () => {
    $('form-add').reset(); $('add-seats').value = 2; setErr('add-err'); $('dlg-add').showModal(); $('add-name').focus();
  });
  $('form-add').addEventListener('submit', async (e) => {
    e.preventDefault(); setErr('add-err');
    try {
      await rpc('admin_add_family', { p_name: $('add-name').value, p_seats: Number($('add-seats').value), p_code: $('add-code').value || null, p_test: $('add-test').checked });
      $('dlg-add').close(); await loadAll(); toast('Familia agregada');
    } catch (err) { setErr('add-err', nice(err)); }
  });

  // Editar
  function fillCount(max, selected) {
    const sel = $('cor-count'); sel.replaceChildren();
    for (let i = 1; i <= max; i++) { const o = document.createElement('option'); o.value = i; o.textContent = i; sel.append(o); }
    if (selected) sel.value = selected;
  }
  function syncCorrect() { $('cor-count-wrap').hidden = $('cor-status').value !== 'attending'; }
  $('cor-status').addEventListener('change', syncCorrect);

  function openEdit(f) {
    editing = f;
    $('edit-title').textContent = (f.code ? f.code + ' · ' : '') + f.name;
    $('edit-status').textContent = LABEL[f.status] + (f.status === 'attending' ? ' · ' + f.confirmed + ' persona(s)' : '') + (f.responded_at ? ' · ' + fmt(f.responded_at) : '');
    $('edit-name').value = f.name; $('edit-seats').value = f.seats;
    fillCount(f.seats, f.confirmed || 1);
    $('cor-status').value = f.status; $('cor-reason').value = ''; syncCorrect();
    setErr('edit-err'); setErr('cor-err'); setErr('del-err');
    const pending = f.status === 'pending';
    $('btn-del').disabled = !pending;
    $('del-hint').textContent = pending ? 'Solo se pueden eliminar invitaciones que todavía no han respondido. Queda en el historial.' : 'Esta invitación ya respondió, por eso no se puede eliminar. Si fue de prueba, primero corrígela a PENDIENTE.';
    $('dlg-edit').showModal();
  }
  $('form-edit').addEventListener('submit', async (e) => {
    e.preventDefault(); setErr('edit-err');
    try {
      await rpc('admin_update_family', { p_id: editing.id, p_name: $('edit-name').value, p_seats: Number($('edit-seats').value) });
      $('dlg-edit').close(); await loadAll(); toast('Cambios guardados');
    } catch (err) { setErr('edit-err', nice(err)); }
  });
  $('form-correct').addEventListener('submit', async (e) => {
    e.preventDefault(); setErr('cor-err');
    const status = $('cor-status').value;
    try {
      await rpc('admin_correct_answer', { p_id: editing.id, p_status: status, p_confirmed: status === 'attending' ? Number($('cor-count').value) : null, p_reason: $('cor-reason').value });
      $('dlg-edit').close(); await loadAll(); toast('Corrección aplicada y registrada en el historial');
    } catch (err) { setErr('cor-err', nice(err)); }
  });
  $('btn-del').addEventListener('click', async () => {
    if (!confirm('¿Eliminar la invitación de "' + editing.name + '"? El enlace dejará de funcionar.')) return;
    setErr('del-err');
    try { await rpc('admin_delete_family', { p_id: editing.id }); $('dlg-edit').close(); await loadAll(); toast('Invitación eliminada'); }
    catch (err) { setErr('del-err', nice(err)); }
  });

  // ---------- exportación ----------
  const exportRows = () => fams.filter((f) => !f.is_test).map((f) => [f.code || '', f.name, f.seats, LABEL[f.status], f.confirmed == null ? '' : f.confirmed, fmt(f.responded_at)]);
  const HEAD = ['Código', 'Familia', 'Cupos asignados', 'Estado', 'Personas confirmadas', 'Fecha de respuesta'];

  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  $('csv').addEventListener('click', () => {
    const esc = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const text = '﻿' + [HEAD, ...exportRows()].map((r) => r.map(esc).join(',')).join('\r\n');
    download(new Blob([text], { type: 'text/csv;charset=utf-8' }), 'confirmaciones.csv');
  });

  // .xlsx sin librerías: archivo ZIP (sin compresión) con XML mínimo de hoja de cálculo
  function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) { crc ^= buf[i]; for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1)); }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function zip(files) {
    const enc = new TextEncoder(), parts = [], central = []; let offset = 0;
    const u16 = (n) => [n & 255, (n >>> 8) & 255];
    const u32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
    for (const f of files) {
      const name = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data), size = data.length;
      const local = new Uint8Array([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0)]);
      parts.push(local, name, data);
      central.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]), name);
      offset += local.length + name.length + size;
    }
    const cdSize = central.reduce((a, c) => a + c.length, 0);
    const end = new Uint8Array([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), ...u16(0)]);
    return new Blob([...parts, ...central, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const colName = (i) => String.fromCharCode(65 + i);
  function xlsx() {
    const data = [HEAD, ...exportRows()];
    const rows = data.map((r, ri) => '<row r="' + (ri + 1) + '">' + r.map((v, ci) => {
      const ref = colName(ci) + (ri + 1);
      if (typeof v === 'number') return '<c r="' + ref + '"><v>' + v + '</v></c>';
      return '<c r="' + ref + '" t="inlineStr"' + (ri === 0 ? ' s="1"' : '') + '><is><t>' + xml(v) + '</t></is></c>';
    }).join('') + '</row>').join('');
    const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
    const H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    return zip([
      { name: '[Content_Types].xml', text: H + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { name: '_rels/.rels', text: H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', text: H + '<workbook ' + NS + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Confirmaciones" sheetId="1" r:id="rId1"/></sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', text: H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', text: H + '<styleSheet ' + NS + '><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' },
      { name: 'xl/worksheets/sheet1.xml', text: H + '<worksheet ' + NS + '><cols><col min="1" max="1" width="10" customWidth="1"/><col min="2" max="2" width="38" customWidth="1"/><col min="3" max="3" width="16" customWidth="1"/><col min="4" max="4" width="26" customWidth="1"/><col min="5" max="5" width="22" customWidth="1"/><col min="6" max="6" width="24" customWidth="1"/></cols><sheetData>' + rows + '</sheetData></worksheet>' },
    ]);
  }
  $('xlsx').addEventListener('click', () => download(xlsx(), 'confirmaciones.xlsx'));

  // ---------- inicio de sesión ----------
  $('login').addEventListener('submit', async (e) => {
    e.preventDefault(); setErr('login-err');
    try {
      const r = await Api.login($('em').value.trim(), $('pw').value);
      $('pw').value = '';
      saveSession(fromAuth(r));
      await start();
    } catch (err) { setErr('login-err', /invalid|credentials/i.test(nice(err)) ? 'Correo o contraseña incorrectos' : nice(err)); }
  });

  // ---------- arranque ----------
  if (!Api.configured) show('noconfig');
  else {
    try { session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { session = null; }
    if (session && session.access_token) start(); else show('login');
  }
})();
