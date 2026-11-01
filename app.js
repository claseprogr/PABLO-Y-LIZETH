'use strict';
(function () {
  // ---------- utilidades ----------
  const $ = (id) => document.getElementById(id);
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v);
    }
    for (const c of kids) if (c != null) n.append(c);
    return n;
  }

  const MSG_YES = '¡Muchas gracias por responder! Tu confirmación ha sido registrada correctamente. Nos alegra saber que podremos compartir este día tan especial contigo.';
  const MSG_NO = '¡Muchas gracias por responder! Agradecemos que nos hayas informado. Esperamos compartir pronto otro momento especial.';

  const token = (new URLSearchParams(location.search).get('i') || '').trim();
  const box = $('rsvp-box');
  let inv = null;

  // ---------- invitación personalizada ----------
  function personalize() {
    $('family-name').textContent = inv.name;
    $('family-seats').textContent = String(inv.seats);
    document.title = 'Diario de Bodas | Pablo y Lizeth';
  }

  function head(extra) {
    return [
      el('h3', { text: 'Confirmación de asistencia' }),
      el('p', { class: 'family', text: inv.name }),
      ...(extra || []),
    ];
  }

  function renderDone() {
    const yes = inv.status === 'attending';
    box.replaceChildren(
      ...head(),
      el('div', { class: 'done' },
        el('p', { class: 'seal', text: 'RESPUESTA REGISTRADA' }),
        el('p', { class: 'big', text: yes ? 'SÍ, ASISTIREMOS' : 'NO PODREMOS ASISTIR' }),
        yes ? el('p', { class: 'seal', text: 'PERSONAS CONFIRMADAS: ' + inv.confirmed }) : null,
        el('p', { class: 'thanks', text: yes ? MSG_YES : MSG_NO }),
      ),
      el('p', { class: 'note', text: 'Tu respuesta es definitiva. Si necesitas hacer un cambio, comunícate con los novios.' }),
    );
  }

  function renderClosed() {
    box.replaceChildren(
      ...head(),
      el('p', { class: 'lead', text: 'Las confirmaciones de asistencia ya están cerradas. Si aún necesitas responder, comunícate con los novios.' }),
    );
  }

  function renderInvalid() {
    box.replaceChildren(
      el('h3', { text: 'Confirmación de asistencia' }),
      el('p', { class: 'lead', text: 'Este enlace no es válido. Abre el enlace personal que recibiste por mensaje.' }),
    );
  }

  function renderForm() {
    let attending = null, count = null, step = 'choose';
    const err = el('p', { class: 'error', role: 'alert', hidden: '' });
    const dynamic = el('div');

    const btnYes = el('button', { class: 'choice', type: 'button', 'aria-pressed': 'false', text: 'SÍ, ASISTIREMOS.' });
    const btnNo = el('button', { class: 'choice', type: 'button', 'aria-pressed': 'false', text: 'NO PODREMOS ASISTIR.' });

    function showError(t) { err.textContent = t || ''; err.hidden = !t; }

    function draw() {
      const parts = [];
      btnYes.setAttribute('aria-pressed', String(attending === true));
      btnNo.setAttribute('aria-pressed', String(attending === false));
      btnYes.disabled = btnNo.disabled = step === 'verify' || step === 'sending';

      if (attending === true) {
        const chips = el('div', { class: 'chips', role: 'group', 'aria-label': 'Cantidad de personas' });
        for (let i = 1; i <= inv.seats; i++) {
          const c = el('button', {
            class: 'chip', type: 'button', 'aria-pressed': String(count === i), text: String(i),
            onclick: () => { count = i; showError(''); draw(); },
          });
          if (step !== 'choose') c.disabled = true;
          chips.append(c);
        }
        parts.push(el('div', { class: 'count-box' },
          el('p', { class: 'label', text: inv.seats === 1 ? '¿Cuántas personas asistirán? (máximo 1)' : '¿Cuántas personas asistirán? (máximo ' + inv.seats + ')' }),
          chips));
      }

      const ready = attending === false || (attending === true && count);
      if (ready && step === 'choose') {
        parts.push(el('div', { class: 'actions' },
          el('button', { class: 'btn', type: 'button', text: 'CONFIRMAR ASISTENCIA', onclick: () => { step = 'verify'; showError(''); draw(); } })));
      }
      if (ready && (step === 'verify' || step === 'sending')) {
        const summary = attending
          ? 'Vas a registrar que asistirán ' + count + (count === 1 ? ' persona' : ' personas') + '.'
          : 'Vas a registrar que no podrán asistir.';
        parts.push(el('div', { class: 'verify' },
          el('p', { text: summary }),
          el('p', { class: 'note', text: 'Esta respuesta es definitiva y no podrá modificarse.' }),
          el('div', { class: 'row' },
            el('button', { class: 'btn btn-ghost', type: 'button', text: 'VOLVER', onclick: () => { step = 'choose'; draw(); }, ...(step === 'sending' ? { disabled: '' } : {}) }),
            el('button', { class: 'btn', type: 'button', text: step === 'sending' ? 'GUARDANDO...' : 'SÍ, CONFIRMAR', onclick: send, ...(step === 'sending' ? { disabled: '' } : {}) }),
          )));
      }
      dynamic.replaceChildren(...parts);
    }

    async function send() {
      if (step === 'sending') return;
      step = 'sending'; showError(''); draw();
      try {
        const data = await Api.rpc('submit_rsvp', { p_token: token, p_attending: attending, p_count: attending ? count : null });
        if (data && (data.result === 'ok' || data.result === 'already' || data.result === 'closed')) {
          inv = Object.assign(inv, data); return afterLoad();
        }
        step = 'choose';
        showError(data && data.result === 'invalid_count' ? 'Esa cantidad no está permitida para tu invitación.' : 'No se pudo guardar. Inténtalo de nuevo.');
        draw();
      } catch {
        step = 'choose'; showError('No hay conexión. Inténtalo de nuevo en unos segundos.'); draw();
      }
    }

    btnYes.addEventListener('click', () => { attending = true; showError(''); draw(); });
    btnNo.addEventListener('click', () => { attending = false; count = null; showError(''); draw(); });

    box.replaceChildren(
      ...head([
        el('p', { class: 'lead', text: '¡Nos encantaría contar con tu presencia! Por favor, confirma tu asistencia.' }),
        el('p', { class: 'question', text: '¿Nos acompañarán a celebrar este día tan especial?' }),
      ]),
      el('div', { class: 'choices' }, btnYes, btnNo),
      dynamic, err,
    );
    draw();
  }

  function afterLoad() {
    personalize();
    if (inv.status !== 'pending') return renderDone();
    if (!inv.open) return renderClosed();
    renderForm();
  }

  async function load() {
    if (!Api.configured) {
      box.replaceChildren(el('p', { class: 'lead', text: 'Falta conectar la base de datos (config.js).' }));
      return;
    }
    if (!token) return renderInvalid();
    try {
      const data = await Api.rpc('get_invitation', { p_token: token });
      if (!data) return renderInvalid();
      inv = data;
      afterLoad();
    } catch {
      box.replaceChildren(el('p', { class: 'lead', text: 'No se pudo cargar tu invitación. Revisa tu conexión y recarga la página.' }));
    }
  }

  // ---------- música de fondo ----------
  // El reproductor se activa solo si existe audio/musica.mp3 en el proyecto.
  async function initMusic() {
    const audio = $('bgm'), start = $('music-start'), toggle = $('music-toggle');
    try {
      const r = await fetch('audio/musica.mp3', { method: 'HEAD' });
      if (!r.ok || !/audio/.test(r.headers.get('content-type') || '')) return;
    } catch { return; }
    audio.src = 'audio/musica.mp3';
    audio.volume = 0.35;
    audio.preload = 'metadata';
    let userPaused = false;

    const sync = () => {
      toggle.hidden = false;
      toggle.setAttribute('aria-pressed', String(!audio.paused));
      toggle.setAttribute('aria-label', audio.paused ? 'Reproducir música' : 'Pausar música');
    };
    audio.addEventListener('play', sync);
    audio.addEventListener('pause', sync);

    async function tryPlay() {
      try { await audio.play(); start.hidden = true; return true; } catch { return false; }
    }
    toggle.addEventListener('click', () => {
      if (audio.paused) { userPaused = false; audio.play().catch(() => {}); } else { userPaused = true; audio.pause(); }
    });
    start.addEventListener('click', async () => { userPaused = false; await tryPlay(); });

    if (!(await tryPlay())) {
      start.hidden = false;
      // Primer toque, clic o tecla en cualquier parte de la página inicia la música.
      const kick = async () => {
        if (userPaused || !audio.paused) return cleanup();
        if (await tryPlay()) cleanup();
      };
      const evs = ['pointerup', 'touchend', 'click', 'keydown'];
      const cleanup = () => evs.forEach((e) => document.removeEventListener(e, kick, true));
      evs.forEach((e) => document.addEventListener(e, kick, true));
    }
    // Si la pestaña se oculta, pausa; al volver, retoma solo si el invitado no la pausó.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) audio.pause(); else if (!userPaused) audio.play().catch(() => {});
    });
  }

  load();
  initMusic();
})();
