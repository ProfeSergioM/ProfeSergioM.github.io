// FLETES — radio de la cabina. Emisoras públicas por internet desde el catálogo abierto de Radio Browser
// (https://www.radio-browser.info), más "FLETE FM", la música chiptune del juego, que suena sin conexión.
// El juego solo reproduce la transmisión pública con el elemento de audio del navegador; no la guarda.
(function (G) {
  'use strict';
  const SERVIDORES = ['https://de1.api.radio-browser.info', 'https://de2.api.radio-browser.info', 'https://all.api.radio-browser.info'];
  // qué se pide: radios chilenas más escuchadas y algo tranquilo para la ruta
  const PEDIDOS = [
    { q: 'countrycode=CL&order=clickcount&reverse=true&limit=60', max: 16, g: 'CHILE' },
    { q: 'tag=lofi&order=votes&reverse=true&limit=40', max: 3, g: 'LO-FI' },
    { q: 'tag=smooth jazz&order=votes&reverse=true&limit=40', max: 3, g: 'JAZZ' },
    { q: 'tag=folklore&order=votes&reverse=true&limit=40', max: 2, g: 'FOLCLOR' },
    { q: 'tag=classical&order=votes&reverse=true&limit=40', max: 2, g: 'CLÁSICA' },
  ];
  const R = { lista: [], i: -1, estado: 'apagada', error: '', cargada: false, cargando: false, volumen: 0.8, audio: null, onCambio: null, servidor: null };
  const INTERNA = { nombre: 'FLETE FM', genero: 'SIN INTERNET', interna: true };

  async function pedir(ruta) {
    const orden = R.servidor ? [R.servidor].concat(SERVIDORES.filter(s => s !== R.servidor)) : SERVIDORES.slice().sort(() => Math.random() - 0.5);
    for (const s of orden) {
      try {
        const r = await fetch(s + ruta.replace(/ /g, '%20'), { signal: AbortSignal.timeout ? AbortSignal.timeout(7000) : undefined });
        if (r.ok) { R.servidor = s; return await r.json(); }
      } catch (e) { /* probar el siguiente */ }
    }
    throw new Error('sin respuesta');
  }
  // texto limpio para la fuente del juego (mayúsculas con acentos castellanos)
  const limpio = s => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, m => (m === '́' || m === '̃' || m === '̈') ? m : '').normalize('NFC')
    .replace(/[^A-Z0-9ÁÉÍÓÚÑÜ .,:!?'"()+\-/#&*=]/g, '').replace(/&/g, 'Y').replace(/\s+/g, ' ').trim().slice(0, 34);
  R.limpio = limpio;

  R.cargar = async function () {
    if (R.cargando || R.cargada) return;
    R.cargando = true; avisar();
    const vistas = new Set(), lista = [];
    for (const p of PEDIDOS) {
      try {
        const j = await pedir('/json/stations/search?hidebroken=true&' + p.q);
        let n = 0;
        for (const s of j) {
          const url = s.url_resolved || s.url;
          if (!/^https:/i.test(url)) continue;            // la página es https: solo transmisiones seguras
          if (s.hls === 1 || /m3u8/i.test(url)) continue;  // el elemento de audio no siempre entiende HLS
          if (!/^(MP3|AAC|AAC\+|OGG)$/i.test(s.codec || '')) continue;
          const nom = limpio(s.name); if (!nom || vistas.has(nom) || /CHRISTMAS|NAVIDAD|XMAS/.test(nom)) continue;
          vistas.add(nom);
          lista.push({ nombre: nom, genero: p.g, url, uuid: s.stationuuid, pais: s.countrycode });
          if (++n >= p.max) break;
        }
      } catch (e) { /* sin esa categoría */ }
    }
    R.lista = lista; R.cargada = true; R.cargando = false;
    if (!lista.length) R.error = 'SIN CATÁLOGO DE RADIOS';
    avisar();
  };

  function avisar() { if (R.onCambio) R.onCambio(R); }
  function estado(e, err) { R.estado = e; R.error = err || ''; avisar(); }
  function asegurar() {
    if (R.audio || typeof Audio === 'undefined') return R.audio;
    const a = R.audio = new Audio();
    a.preload = 'none'; a.volume = R.volumen;
    a.addEventListener('playing', () => estado('sonando'));
    a.addEventListener('waiting', () => { if (R.estado === 'sonando') estado('conectando'); });
    a.addEventListener('error', () => { if (R.actual() && !R.actual().interna) estado('error', 'LA EMISORA NO RESPONDE'); });
    return a;
  }
  R.actual = () => R.i === 0 ? INTERNA : R.i > 0 ? R.lista[R.i - 1] : null;
  R.total = () => R.lista.length + 1;
  function tocar() {
    const st = R.actual();
    const a = asegurar();
    if (a) { a.pause(); a.removeAttribute('src'); try { a.load(); } catch (e) { /* nada */ } }
    if (G.AU) G.AU.music(false);
    if (!st) { estado('apagada'); return; }
    if (st.interna) { if (G.AU) { G.AU.init(); G.AU.music(true, 'race'); } estado('sonando'); return; }
    if (!a) return;
    a.src = st.url; estado('conectando');
    const p = a.play();
    if (p && p.catch) p.catch(e => { if (R.actual() === st) estado('error', e && e.name === 'NotSupportedError' ? 'FORMATO NO SOPORTADO' : 'NO SE PUDO CONECTAR'); });
    // Radio Browser cuenta los "clics" para ordenar su catálogo
    if (st.uuid && R.servidor) fetch(R.servidor + '/json/url/' + st.uuid).catch(() => {});
  }
  // la siguiente emisora; después de la última, apagada
  R.siguiente = function () {
    if (!R.cargada) R.cargar().then(() => { if (R.i > 0) return; });
    R.i = R.i + 1 >= R.total() ? -1 : R.i + 1;
    tocar(); return R.actual();
  };
  R.anterior = function () {
    R.i = R.i - 1 < -1 ? R.total() - 1 : R.i - 1;
    tocar(); return R.actual();
  };
  R.apagar = function () { R.i = -1; tocar(); };
  R.silenciar = function (m) { if (R.audio) R.audio.muted = m; };
  R.texto = function () {
    const st = R.actual();
    if (!st) return 'RADIO APAGADA';
    const n = `${R.i + 1}/${R.total()}`;
    if (R.estado === 'conectando') return `${n} ${st.nombre} · CONECTANDO`;
    if (R.estado === 'error') return `${n} ${st.nombre} · ${R.error}`;
    return `${n} ${st.nombre} · ${st.genero}`;
  };
  G.RADIO = R;
})(window);
