// FLETES — camiones tranquilos por el sur de Chile: bucle principal, cámara, mundo, GPS, cargas, radio y HUD.
// Motor gráfico tomado de TURBO 40 (lienzo 400x225 pixelado, vista isométrica, vóxeles, CRT).
(function () {
  'use strict';
  const GR = window.GR, AU = window.AU, MU = window.MUNDO, N = window.NUCLEO, C = window.CARGAS, RADIO = window.RADIO;
  const W = 400, H = 225, S = GR.S;
  const cv = document.getElementById('pantalla'), ctx = cv.getContext('2d');
  cv.width = W; cv.height = H;
  const gcv = document.getElementById('brillo'), gctx = gcv.getContext('2d');
  gcv.width = W; gcv.height = H;
  ctx.imageSmoothingEnabled = false;

  // ---------- entrada ----------
  const keys = { up: false, down: false, left: false, right: false };
  const pressed = new Set();
  const KM = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  const ACC = { ' ': 'accion', Enter: 'accion', r: 'radio', R: 'radioAtras', m: 'mapa', M: 'mapa', s: 'mudo', S: 'mudo', h: 'bocina', H: 'bocina', Escape: 'pausa', p: 'pausa', P: 'pausa', Tab: 'mapa' };
  let audioListo = false;
  function despertarAudio() { AU.init(); if (!audioListo) { audioListo = true; } }
  function press(k) { if (!keys[k]) pressed.add(k); keys[k] = true; despertarAudio(); }
  const release = k => { keys[k] = false; };
  addEventListener('keydown', e => {
    const k = KM[e.key];
    if (k) { e.preventDefault(); press(k); return; }
    const a = ACC[e.key];
    if (a) { e.preventDefault(); if (!e.repeat) { pressed.add(a); despertarAudio(); } }
  });
  addEventListener('keyup', e => { const k = KM[e.key]; if (k) { release(k); e.preventDefault(); } });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  const P = k => pressed.has(k);

  // ---------- controles táctiles (como en TURBO 40, más botones de radio, carga y mapa) ----------
  const TACTIL = /[?&]tactil\b/.test(location.search) || (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
  let mandos = null;
  function zona(cls, eje, teclas, html) {
    const el = document.createElement('div');
    el.className = 'zona ' + cls; el.innerHTML = html;
    const dedos = new Map();
    const sync = () => {
      const on = new Set(dedos.values());
      for (const k of teclas) { if (on.has(k)) { if (!keys[k]) press(k); } else if (keys[k]) release(k); }
      el.querySelectorAll('[data-k]').forEach(b => b.classList.toggle('activo', on.has(b.dataset.k)));
    };
    const cual = e => {
      const r = el.getBoundingClientRect();
      const f = eje === 'x' ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height;
      return eje === 'x' ? (f < 0.5 ? teclas[0] : teclas[1]) : (f < 0.42 ? teclas[0] : teclas[1]);
    };
    el.addEventListener('pointerdown', e => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (_) { } dedos.set(e.pointerId, cual(e)); sync(); });
    el.addEventListener('pointermove', e => { if (dedos.has(e.pointerId)) { dedos.set(e.pointerId, cual(e)); sync(); } });
    const fin = e => { if (dedos.delete(e.pointerId)) sync(); };
    el.addEventListener('pointerup', fin); el.addEventListener('pointercancel', fin); el.addEventListener('lostpointercapture', fin);
    el.addEventListener('contextmenu', e => e.preventDefault());
    return el;
  }
  if (TACTIL) {
    document.body.classList.add('tactil');
    mandos = document.createElement('div'); mandos.id = 'mandos';
    mandos.appendChild(zona('volante', 'x', ['left', 'right'], '<div class="tecla" data-k="left">◀</div><div class="tecla" data-k="right">▶</div>'));
    mandos.appendChild(zona('pedales', 'y', ['up', 'down'], '<div class="tecla gas" data-k="up">▲<small>ACELERAR</small></div><div class="tecla freno" data-k="down">▼<small>FRENO</small></div>'));
    const botones = document.createElement('div'); botones.className = 'botones';
    for (const [k, txt] of [['accion', 'CARGA'], ['radio', 'RADIO'], ['mapa', 'MAPA'], ['bocina', 'BOCINA']]) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.dataset.a = k;
      b.addEventListener('pointerdown', e => { e.preventDefault(); despertarAudio(); pressed.add(k); });
      botones.appendChild(b);
    }
    mandos.appendChild(botones);
    const gira = document.createElement('div'); gira.id = 'girar'; gira.textContent = '↻ GIRA EL CELULAR PARA VERLO MÁS GRANDE';
    mandos.appendChild(gira);
    const son = document.createElement('button'); son.id = 'sonido'; son.type = 'button'; son.textContent = '♪';
    son.addEventListener('pointerdown', e => { e.preventDefault(); despertarAudio(); pressed.add('mudo'); });
    mandos.appendChild(son);
    document.body.appendChild(mandos);
    document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  }
  function fit() {
    const box = document.getElementById('marco');
    const vw = innerWidth, vh = innerHeight;
    let s, x, y;
    if (!TACTIL) {
      s = Math.min(vw / W, vh / H);
      if (s >= 3) s = Math.floor(s);
      x = (vw - W * s) / 2; y = (vh - H * s) / 2;
    } else if (vw > vh) {
      const banda = Math.max(104, Math.min(170, vw * 0.17));
      s = Math.min((vw - 2 * banda) / W, (vh - 44) / H);
      x = (vw - W * s) / 2; y = Math.max(0, (vh - 44 - H * s) / 2);
      mandos.className = 'horizontal';
      mandos.style.setProperty('--banda', banda + 'px');
    } else {
      s = Math.min(vw / W, (vh * 0.5) / H);
      const ctrl = Math.max(vh - 300, 56 + H * s + 60);
      x = (vw - W * s) / 2; y = Math.max(50, (ctrl - 50 - H * s) / 2);
      mandos.className = 'vertical';
      mandos.style.setProperty('--arriba', Math.round(ctrl) + 'px');
    }
    box.style.width = Math.floor(W * s) + 'px'; box.style.height = Math.floor(H * s) + 'px';
    box.style.left = Math.round(x) + 'px'; box.style.top = Math.round(y) + 'px';
  }
  addEventListener('resize', fit); fit();

  // ---------- mundo y recursos ----------
  let M = null, suelo = null, camSpr = null, autoSpr = null, deco = null, ruta = null, decoGen = null;
  const edifCache = new Map();
  let estado = 'cargando', stT = 0, frame = 0;
  let partida = null, cam = null, camPos = { x: 0, y: 0 }, autos = [], ofertas = [], selOf = 0, depAqui = null, resumen = null;
  let gps = null, gpsSt = { i: 0 }, gpsT = 0, msgs = [], parts = [], lluvia = 0, lluviaT = 0, radioMsgT = -9, mapaZoom = 0, pausaSel = 0;
  let tractoCol = 'rojo';
  const rnd = (a, b) => a + Math.random() * (b - a);

  function guardar() {
    if (!partida || !cam) return;
    try { localStorage.setItem('fletes', JSON.stringify({ dinero: partida.dinero, entregas: partida.entregas, t: partida.t, km: partida.km + cam.kmReal, dep: depAqui ? depAqui.id : null, col: tractoCol, hist: partida.historial.slice(-20) })); } catch (e) { /* sin almacenamiento */ }
  }
  function leerGuardado() { try { return JSON.parse(localStorage.getItem('fletes') || 'null'); } catch (e) { return null; } }

  function iniciar() {
    M = MU.crear(window.MAPA);
    suelo = GR.Suelo(M);
    camSpr = GR.buildCamion();
    autoSpr = GR.buildAutos();
    deco = Object.assign(GR.buildDecor(), GR.buildRuta());
    window.__fletes.M = M;
    estado = 'titulo'; stT = 0;
    // la cámara del título recorre la costanera de Puerto Montt
    camPos = { x: 0, y: 0 };
  }

  // ---------- decorado generado: árboles, casas, postes (determinista por celda) ----------
  const DC = 48, decoCache = new Map();
  function decoCelda(gx, gy) {
    const k = gx + ',' + gy; let l = decoCache.get(k); if (l) return l;
    l = [];
    const ocupado = (x, y, r) => {
      const q = M.enCalzada(x, y);
      if (q) { const cl = q.e.cl; if (q.m < (cl.vereda ? cl.vereda + 0.6 : cl.berma ? cl.berma + 1.2 : 1.6) + r) return true; }
      if (M.agua(x, y) || M.chocaEdif(x, y, r + 0.8)) return true;
      for (const d of M.depositos) if (Math.hypot(d.x - x, d.y - y) < 18 + r) return true;
      for (const o of l) if (Math.hypot(o.x - x, o.y - y) < o.r + r + 1.2) return true;
      return false;
    };
    const x0 = gx * DC, y0 = gy * DC;
    for (let i = 0; i < 22; i++) {
      const h1 = GR.hash(gx * 31 + i, gy * 17 - i), h2 = GR.hash(gy * 13 + i * 7, gx * 29 + i), h3 = GR.hash(gx + i * 101, gy - i * 53);
      const x = x0 + h1 * DC, y = y0 + h2 * DC, t = M.terreno(x, y);
      let o = null;
      if (t === -1) { // campo
        const bos = vn(x / 160 + 7, y / 160) < 0.3;
        if (bos ? h3 < 0.9 : h3 < 0.12) o = { k: h3 < (bos ? 0.5 : 0.06) ? 'pino' : 'arbol', r: 0.6 };
        else if (!bos && h3 > 0.985) o = { k: h3 > 0.993 ? 'galpon' : 'cabana', r: 4.2 };
      } else if (t === MU.TER.BOSQUE) { if (h3 < 0.85) o = { k: h3 < 0.35 ? 'pino' : 'arbol', r: 0.6 }; }
      else if (t === MU.TER.PASTO) { if (h3 < 0.2) o = { k: h3 < 0.05 ? 'cerezo' : 'arbol', r: 0.6 }; }
      else if (t === MU.TER.URBANO) { if (h3 < 0.32) o = { k: 'casaColor', r: 3.6 }; else if (h3 < 0.36) o = { k: 'arbol', r: 0.6 }; }
      else if (t === MU.TER.INDUSTRIA) { if (h3 < 0.12) o = { k: 'galpon', r: 4.4 }; }
      else if (t === MU.TER.CAMPO) { if (h3 < 0.1) o = { k: 'arbol', r: 0.6 }; else if (h3 > 0.97) o = { k: 'cabana', r: 4.2 }; }
      if (!o) continue;
      o.x = x; o.y = y; o.v = Math.floor(GR.hash(i, gx + gy) * 3);
      if (o.k === 'casaColor' && M.edifEn(x, y) && M.edifEn(x, y).some(bi => { const b = M.edif[bi]; return Math.hypot(b.cx - x, b.cy - y) < 16; })) continue;
      if (ocupado(x, y, o.r)) continue;
      o.casa = o.r > 2; l.push(o);
    }
    // postes de madera con cables a lo largo de avenidas y caminos (uno cada ~30 m, por la derecha)
    const segs = M.segsRect(x0, y0, x0 + DC, y0 + DC);
    for (let i = 0; i < segs.length; i += 2) {
      const e = M.ejes[segs[i]], j = segs[i + 1];
      if (!(e.c === 'primary' || e.c === 'secondary' || e.c === 'tertiary' || (e.c === 'trunk' && !e.ow))) continue;
      const s0 = e.cum[j], s1 = e.cum[j + 1];
      for (let s = Math.ceil(s0 / 30) * 30; s < s1; s += 30) {
        const off = e.hw + (e.cl.vereda ? e.cl.vereda - 0.5 : 2.5);
        const p = N.posEje(e, s, off, {});
        if (Math.floor(p.x / DC) !== gx || Math.floor(p.y / DC) !== gy) continue;
        if (M.chocaEdif(p.x, p.y, 0.4) || M.agua(p.x, p.y)) continue;
        const q = M.enCalzada(p.x, p.y); if (q && q.m < 0.5) continue;
        l.push({ k: 'poste', x: p.x, y: p.y, r: 0.3, v: 0, eje: e.id, s });
      }
    }
    decoCache.set(k, l);
    if (decoCache.size > 3000) { const it = decoCache.keys(); for (let n = 0; n < 500; n++) decoCache.delete(it.next().value); }
    return l;
  }
  function vn(x, y) { // ruido suave (igual que el del suelo)
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = GR.hash(xi, yi), b = GR.hash(xi + 1, yi), c = GR.hash(xi, yi + 1), d = GR.hash(xi + 1, yi + 1);
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  // el suelo hornea las sombras del decorado de su bloque
  GR.decoEnBloque = function (cu, cv2) {
    const u0 = cu * 128, v0 = cv2 * 128, out = [];
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const u of [u0 - 30, u0 + 158]) for (const v of [v0 - 20, v0 + 148]) { const X = (v + u / 2) / S, Y = (v - u / 2) / S; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
    for (let gx = Math.floor(x0 / DC); gx <= Math.floor(x1 / DC); gx++) for (let gy = Math.floor(y0 / DC); gy <= Math.floor(y1 / DC); gy++) for (const o of decoCelda(gx, gy)) out.push(o);
    return out;
  };
  function decoSprite(o) {
    const l = deco[o.k]; if (!l) return null;
    return l[o.v % l.length];
  }

  // ---------- partida ----------
  function nuevaPartida(cont) {
    partida = C.nuevaPartida((Math.random() * 1e9) | 0);
    const g = cont ? leerGuardado() : null;
    let dep = M.depositos.find(d => d.cat === 'puerto' && d.ciudad === 0) || M.depositos.find(d => d.ciudad === 0) || M.depositos[0];
    if (g) { partida.dinero = g.dinero; partida.entregas = g.entregas; partida.t = g.t; partida.historial = g.hist || []; tractoCol = g.col || 'rojo'; if (g.dep != null && M.depositos[g.dep]) dep = M.depositos[g.dep]; partida.kmPrevios = g.km || 0; }
    estacionar(dep);
    autos = []; parts = []; msgs = [];
    estado = 'manejo'; stT = 0;
    abrirBolsa(dep);
  }
  function estacionar(dep) {
    // el camión queda en la calle frente al depósito, mirando a lo largo de ella
    const c = dep.calle;
    let a = Math.atan2(c.ty, c.tx);
    if (c.e.ow) { /* sentido obligado */ } else if (GR.hash(dep.id, 3) < 0.5) a += Math.PI;
    const lat = c.e.ow ? 0 : c.e.hw * 0.5;
    const x = c.qx - Math.sin(a) * lat, y = c.qy + Math.cos(a) * lat; // a la derecha
    cam = N.nuevoCamion(x, y, a);
    cam.kmReal = 0;
    depAqui = dep;
    camPos = { x: cam.x, y: cam.y };
    gps = null;
  }
  function abrirBolsa(dep) {
    depAqui = dep;
    ofertas = C.ofertas(partida, M, dep, 4);
    selOf = 0; estado = 'bolsa'; stT = 0; AU.blip();
  }
  function aceptar(of) {
    const enc = C.aceptar(partida, of);
    enc.litros0 = cam.combustible;
    const cols = GR.REMOLQUES[enc.rem];
    enc.col = Math.floor(Math.random() * cols.length);
    // el tracto sale del patio con el remolque enganchado, mirando hacia donde parte la ruta
    const sal = M.salida(M.depositos[enc.de], M.depositos[enc.a]);
    if (sal) { cam.x = sal.x; cam.y = sal.y; cam.a = sal.a; cam.v = 0; cam.delta = 0; camPos = { x: cam.x, y: cam.y }; }
    N.ponerRemolque(cam, true, enc.peso * 1000);
    // si quedó un remolque metido en un edificio, alinear con la calle
    AU.caja(); AU.aire();
    const d = M.depositos[enc.a];
    msg('CARGA ENGANCHADA: ' + enc.n, 3.5, 'big', 'DESTINO: ' + C.nombreDep(d, M).tipo + ' · ' + C.nombreDep(d, M).ciudad);
    if (sal) { gps = sal.ruta; gpsSt = { i: 0 }; } else calcularGPS(true);
    estado = 'manejo';
  }
  function destino() { return partida && partida.encargo ? M.depositos[partida.encargo.a] : null; }
  function calcularGPS(forzar) {
    const d = destino();
    if (!d) { gps = null; return; }
    // desde el frente del camión, en el sentido en que va
    const r = M.rutaA(cam.x + Math.cos(cam.a) * 3, cam.y + Math.sin(cam.a) * 3, cam.a, d);
    if (r) { gps = r; gpsSt = { i: 0 }; }
    else if (forzar) gps = null;
  }
  function msg(text, dur, style, sub) { msgs.push({ text, dur, t: 0, style: style || 'big', sub }); if (msgs.length > 3) msgs.shift(); }

  // ---------- tráfico de decorado ----------
  const TIPOS = ['sedan', 'sedan', 'sedan', 'sedan', 'furgon', 'camion', 'bus'];
  const LARGO = { sedan: 4.6, furgon: 5.3, camion: 8.6, bus: 11.2 };
  function sumarAutos(dt) {
    const max = TACTIL ? 18 : 26;
    // quitar los lejanos
    for (let i = autos.length - 1; i >= 0; i--) {
      const a = autos[i], d = Math.hypot(a.x - cam.x, a.y - cam.y);
      // tráfico de decorado: un auto trabado mucho rato se retira (fuera de la vista, antes)
      const trabado = (a.espera || 0) > (d > 70 ? 4 : 10);
      if (a.muerto || d > 330 || trabado) autos.splice(i, 1);
    }
    if (autos.length >= max) return;
    for (let intento = 0; intento < 3 && autos.length < max; intento++) {
      const ang = Math.random() * Math.PI * 2, dist = rnd(110, 280);
      const x = cam.x + Math.cos(ang) * dist, y = cam.y + Math.sin(ang) * dist;
      const q = M.cercano(x, y, 40, null, e => e.c !== 'living_street' && e.len > 20);
      if (!q) continue;
      const e = q.e;
      if (e.c === 'residential' && Math.random() < 0.7) continue;
      const tipo = e.c === 'motorway' && Math.random() < 0.35 ? (Math.random() < 0.5 ? 'camion' : 'bus') : TIPOS[Math.floor(Math.random() * TIPOS.length)];
      const dir = e.ow ? 1 : (Math.random() < 0.5 ? 1 : -1);
      const temple = Math.random();
      const a = { e, dir, s: q.s, v: e.vmax * 0.7, vmaxBase: 26, tipo, largo: LARGO[tipo], ancho: 2, col: Math.floor(Math.random() * autoSpr[tipo].length), temple, carril: 1 };
      a.vmax = Math.min(a.vmaxBase, e.vmax * (0.8 + 0.2 * temple));
      if (e.ow && e.hw > 4.2) a.carril = (tipo === 'camion' || tipo === 'bus' || Math.random() < 0.6) ? 1 : -1;
      N.ubicarAuto(a);
      // que no aparezca encima de otro
      if (autos.some(b => Math.hypot(b.x - a.x, b.y - a.y) < 12) || Math.hypot(a.x - cam.x, a.y - cam.y) < 60) continue;
      autos.push(a);
    }
  }
  const obstAutos = [];
  function pasoAutos(dt) {
    // el camión es un obstáculo para el tráfico (tracto y tres puntos del remolque)
    const cs = N.circulos(cam, []);
    const obs = autos.slice();
    for (const [x, y, r] of cs) obs.push({ x, y, r, largo: 3, ancho: 2.8, fijo: true });
    const rr = Math.random;
    for (const a of autos) N.pasoAuto(M, a, dt, obs, rr);
  }

  // ---------- actualización ----------
  const DT = N.DT; let acc = 0;
  let ultGolpe = 0, ultAtras = 0, frenoAire = 0, buscarT = 0;
  function actualizar(dt) {
    stT += dt; frame++;
    if (P('mudo')) { AU.toggleMute(); RADIO.silenciar(AU.muted); msg(AU.muted ? 'SONIDO APAGADO' : 'SONIDO ENCENDIDO', 1.5, 'small'); }
    if (P('radio') && estado !== 'titulo' && estado !== 'cargando') { RADIO.siguiente(); radioMsgT = stT; }
    if (P('radioAtras') && estado !== 'titulo') { RADIO.anterior(); radioMsgT = stT; }
    if (estado === 'titulo') actTitulo(dt);
    else if (estado === 'manejo') actManejo(dt);
    else if (estado === 'bolsa') actBolsa();
    else if (estado === 'entrega') { if (P('accion') || P('up') || P('right')) abrirBolsa(depAqui); }
    else if (estado === 'mapa') { if (P('mapa') || P('pausa') || P('accion')) estado = 'manejo'; if (P('up')) mapaZoom = Math.min(2, mapaZoom + 1); if (P('down')) mapaZoom = Math.max(0, mapaZoom - 1); }
    else if (estado === 'pausa') actPausa();
    for (const m of msgs) m.t += dt;
    msgs = msgs.filter(m => m.t < m.dur);
    for (const q of parts) { q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; }
    parts = parts.filter(q => q.life < q.max);
    pressed.clear();
  }
  function actTitulo(dt) {
    camPos.x += dt * 4; camPos.y -= dt * 2;
    if (P('accion') || P('up')) { despertarAudio(); nuevaPartida(!!leerGuardado()); }
    if (P('down') && leerGuardado()) { try { localStorage.removeItem('fletes'); } catch (e) { /* nada */ } nuevaPartida(false); }
  }
  function actBolsa() {
    if (P('up')) { selOf = (selOf + ofertas.length) % (ofertas.length + 1); AU.move(); }
    if (P('down')) { selOf = (selOf + 1) % (ofertas.length + 1); AU.move(); }
    if (P('accion') || P('right')) {
      if (selOf < ofertas.length && !partida.encargo) aceptar(ofertas[selOf]);
      else { estado = 'manejo'; }
    }
    if (P('pausa') || P('left')) estado = 'manejo';
  }
  function actPausa() {
    const ops = 3;
    if (P('up')) pausaSel = (pausaSel + ops - 1) % ops;
    if (P('down')) pausaSel = (pausaSel + 1) % ops;
    if (P('pausa')) estado = 'manejo';
    if (P('accion') || P('right')) {
      if (pausaSel === 0) estado = 'manejo';
      else if (pausaSel === 1) { const cols = Object.keys(camSpr.tractos); tractoCol = cols[(cols.indexOf(tractoCol) + 1) % cols.length]; }
      else if (pausaSel === 2) { estado = 'titulo'; guardar(); RADIO.apagar(); }
    }
  }
  function actManejo(dt) {
    if (P('pausa')) { estado = 'pausa'; pausaSel = 0; return; }
    if (P('mapa')) { estado = 'mapa'; return; }
    if (P('bocina')) AU.bocina();
    // reloj del juego y clima
    partida.t += dt * C.ESCALA;
    lluviaT -= dt;
    if (lluviaT <= 0) { lluviaT = rnd(60, 180); lluvia = Math.random() < 0.35 ? 1 : 0; AU.rain(lluvia > 0); }
    // física a 120 Hz
    acc += dt;
    while (acc >= DT) {
      acc -= DT;
      const obst = [];
      for (const a of autos) if (Math.abs(a.x - cam.x) < 30 && Math.abs(a.y - cam.y) < 30) { const fx = Math.cos(a.ang), fy = Math.sin(a.ang), h = a.largo / 2 - 1; obst.push({ x: a.x + fx * h, y: a.y + fy * h, r: 1.05, a }, { x: a.x - fx * h, y: a.y - fy * h, r: 1.05, a }); }
      // árboles, postes y casas generadas también chocan
      const gx = Math.floor(cam.x / DC), gy = Math.floor(cam.y / DC);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) for (const o of decoCelda(gx + ox, gy + oy)) if (Math.abs(o.x - cam.x) < 25 && Math.abs(o.y - cam.y) < 25) obst.push({ x: o.x, y: o.y, r: o.casa ? o.r * 0.8 : o.r });
      const golpe = N.paso(cam, keys, DT, M, obst);
      if (golpe > 0.6 && stT - ultGolpe > 0.5) {
        ultGolpe = stT;
        const d = C.golpe(partida, golpe);
        AU.thud(golpe * 12); if (golpe > 3) AU.crash(golpe * 10);
        if (d > 0.5) msg('CARGA DAÑADA ' + Math.round(partida.encargo.dano) + '%', 2, 'small');
        for (const o of obst) if (o.tocado && o.a) { o.a.espera = -3; o.a.v = 0; }
      }
      pasoAutos(DT);
    }
    // sonidos de cabina
    const vel = Math.abs(cam.v);
    AU.car(true, cam.rpm, cam.gas, 0, cam.fuera && vel > 1);
    AU.motorVol = RADIO.estado === 'sonando' && RADIO.actual() && !RADIO.actual().interna ? 0.55 : 1;
    if (cam.freno && vel > 4) frenoAire = 1; else if (frenoAire && vel < 0.5) { frenoAire = 0; AU.aire(); }
    if (cam.atras && vel > 0.2 && stT - ultAtras > 0.9) { ultAtras = stT; AU.retroceso(); }
    // humo del escape al acelerar
    if (cam.gas && frame % (vel < 5 ? 3 : 6) === 0) {
      const ca = Math.cos(cam.a), sa = Math.sin(cam.a);
      parts.push({ x: cam.x + ca * 2.4 - sa * 1, y: cam.y + sa * 2.4 + ca * 1, z: 4.2, vx: rnd(-0.5, 0.5) - ca * vel * 0.3, vy: rnd(-0.5, 0.5) - sa * vel * 0.3, vz: rnd(0.8, 1.6), life: 0, max: rnd(0.6, 1.1) });
    }
    // tráfico
    sumarAutos(dt);
    // GPS: volver a calcular si el camión se aparta de la ruta
    gpsT -= dt;
    if (partida.encargo && gpsT <= 0) {
      gpsT = 0.4;
      if (!gps) calcularGPS();
      else {
        let bd = 1e9, bi = gpsSt.i;
        for (let k = Math.max(0, gpsSt.i - 3); k < Math.min(gps.pts.length, gpsSt.i + 40); k++) { const d = Math.hypot(gps.pts[k][0] - cam.x, gps.pts[k][1] - cam.y); if (d < bd) { bd = d; bi = k; } }
        // distancia a la polilínea (no solo a los vértices)
        let dl = 1e9;
        for (let k = Math.max(0, bi - 2); k < Math.min(gps.pts.length - 1, bi + 2); k++) {
          const [ax, ay] = gps.pts[k], [bx, by] = gps.pts[k + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
          let t = ((cam.x - ax) * dx + (cam.y - ay) * dy) / L2; t = Math.max(0, Math.min(1, t)); dl = Math.min(dl, Math.hypot(cam.x - ax - dx * t, cam.y - ay - dy * t));
        }
        gpsSt.i = bi;
        if (dl > 22) calcularGPS();
      }
    }
    // llegar al destino
    const d = destino();
    if (d && Math.abs(cam.v) < 0.6) {
      const cx2 = cam.remolque ? (cam.rx + cam.x) / 2 : cam.x, cy2 = cam.remolque ? (cam.ry + cam.y) / 2 : cam.y;
      if (Math.hypot(cam.x - d.x, cam.y - d.y) < 22 || Math.hypot(cx2 - d.x, cy2 - d.y) < 22) entregar(d);
    }
    // ¿en un depósito? (para pedir cargas)
    buscarT -= dt;
    if (buscarT <= 0) { buscarT = 0.3; depAqui = null; for (const dp of M.depositos) if (Math.hypot(cam.x - dp.x, cam.y - dp.y) < 24) { depAqui = dp; break; } }
    if (P('accion')) {
      if (depAqui && !partida.encargo) { if (Math.abs(cam.v) < 1) abrirBolsa(depAqui); else msg('DETENTE PARA VER LAS CARGAS', 1.5, 'small'); }
      else if (partida.encargo) msg('LLEVAS ' + partida.encargo.n + ' · SIGUE LA LÍNEA DEL GPS', 2, 'small');
      else msg('BUSCA UN DEPÓSITO: LOS ROMBOS DEL MAPA', 2, 'small');
    }
    // cámara: un poco adelante en la dirección de avance
    const mx = cam.remolque ? cam.x * 0.7 + cam.rx * 0.3 : cam.x, my = cam.remolque ? cam.y * 0.7 + cam.ry * 0.3 : cam.y;
    const ade = Math.max(-6, Math.min(cam.v * 1.1, 26));
    const tx = mx + Math.cos(cam.a) * ade, ty = my + Math.sin(cam.a) * ade;
    camPos.x += (tx - camPos.x) * Math.min(1, dt * 3); camPos.y += (ty - camPos.y) * Math.min(1, dt * 3);
  }
  function entregar(d) {
    const litros = cam.combustible - (partida.encargo.litros0 || 0);
    const enc = partida.encargo;
    resumen = Object.assign(C.entregar(partida, litros), { dep: d, rem: enc.rem });
    N.ponerRemolque(cam, false);
    gps = null; depAqui = d;
    AU.jingle('win'); AU.aire();
    estado = 'entrega'; stT = 0;
    guardar();
  }

  // ---------- dibujo ----------
  const proj = (x, y, z) => [Math.round((x - y) * S - camU + W / 2), Math.round((x + y) / 2 * S - (z || 0) * S * 1.15 - camV + H / 2)];
  let camU = 0, camV = 0;
  const inView = (X, Y, m) => X > -m && X < W + m && Y > -m && Y < H + m * 1.6;
  function dibujarMundo() {
    camU = Math.round((camPos.x - camPos.y) * S); camV = Math.round((camPos.x + camPos.y) / 2 * S);
    suelo.draw(ctx, camU, camV, W, H);
    suelo.precargar(camU + (cam ? Math.cos(cam.a) * 120 : 0), camV, W, H, 2);
    suelo.podar(camU, camV);
    // límites del mundo visible, en metros
    const xs = [], ys = [];
    for (const [u, v] of [[camU - W / 2 - 60, camV - H / 2 - 40], [camU + W / 2 + 60, camV - H / 2 - 40], [camU - W / 2 - 60, camV + H / 2 + 120], [camU + W / 2 + 60, camV + H / 2 + 120]]) { xs.push((v + u / 2) / S); ys.push((v - u / 2) / S); }
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    // patios: marca del lugar de entrega
    const dest = destino();
    for (const d of M.depositos) {
      if (d.x < x0 - 20 || d.x > x1 + 20 || d.y < y0 - 20 || d.y > y1 + 20) continue;
      const esDest = d === dest;
      const col = esDest ? ((frame >> 4) & 1 ? '#f9f871' : '#ff9a20') : '#e8e0c0';
      const r = 9;
      ctx.fillStyle = col;
      for (let k = 0; k < 32; k++) { if ((k & 1) && !esDest) continue; const a = k / 32 * Math.PI * 2, [X, Y] = proj(d.x + Math.cos(a) * r, d.y + Math.sin(a) * r); ctx.fillRect(X, Y, 2, 1); }
    }
    // línea del GPS sobre el asfalto
    if (gps && estado !== 'titulo') {
      ctx.strokeStyle = 'rgba(80,220,255,0.55)'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.beginPath();
      let n = 0;
      for (let k = Math.max(0, gpsSt.i - 1); k < gps.pts.length && gps.cum[k] - gps.cum[gpsSt.i] < 700; k++) { const [X, Y] = proj(gps.pts[k][0], gps.pts[k][1]); n++ ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(220,250,255,0.8)'; ctx.lineWidth = 1; ctx.setLineDash([3, 5]); ctx.lineDashOffset = -frame * 0.4; ctx.stroke(); ctx.setLineDash([]);
    }
    // sombras de vehículos
    ctx.globalAlpha = 0.32;
    for (const a of autos) { const [X, Y] = proj(a.x, a.y); if (!inView(X, Y, 40)) continue; ctx.fillStyle = '#000'; ctx.fillRect(X - 6, Y - 1, 12, 4); }
    if (cam) {
      const [X, Y] = proj(cam.x, cam.y), s1 = camSpr.sombra[GR.ang(cam.a)]; ctx.drawImage(s1.cv, X - s1.ox + 2, Y - s1.oy + 2);
      if (cam.remolque) { const [hx, hy] = pivote(), [X2, Y2] = proj(hx, hy), s2 = camSpr.remSombra[GR.ang(cam.a2)]; ctx.drawImage(s2.cv, X2 - s2.ox + 2, Y2 - s2.oy + 2); }
    }
    ctx.globalAlpha = 1;
    // lista ordenada por profundidad
    const list = [];
    for (let gx = Math.floor(x0 / DC); gx <= Math.floor(x1 / DC); gx++) for (let gy = Math.floor(y0 / DC); gy <= Math.floor(y1 / DC); gy++)
      for (const o of decoCelda(gx, gy)) { const [X, Y] = proj(o.x, o.y); if (inView(X, Y, 50)) list.push({ d: o.x + o.y, k: 'deco', o, X, Y }); }
    const vistos = new Set();
    for (let gx = Math.floor(x0 / 32); gx <= Math.floor(x1 / 32); gx++) for (let gy = Math.floor(y0 / 32); gy <= Math.floor(y1 / 32); gy++) {
      const l = M.edifEn(gx * 32 + 1, gy * 32 + 1); if (!l) continue;
      for (const i of l) { if (vistos.has(i)) continue; vistos.add(i); const b = M.edif[i]; if (b.x1 < x0 || b.x0 > x1 || b.y1 < y0 || b.y0 > y1) continue; list.push({ d: b.cx + b.cy, k: 'edif', o: b, i }); }
    }
    for (const a of autos) { const [X, Y] = proj(a.x, a.y); if (inView(X, Y, 50)) list.push({ d: a.x + a.y, k: 'auto', o: a, X, Y }); }
    for (const d of M.depositos) { const [X, Y] = proj(d.x, d.y); if (inView(X, Y, 40)) list.push({ d: d.x + d.y + 6, k: 'letrero', o: d, X, Y }); }
    let pd = 0, PX = 0, PY = 0;
    if (cam && estado !== 'titulo') {
      // tracto y remolque van juntos, con la profundidad del pivote
      const [X, Y] = proj(cam.x, cam.y), [hx, hy] = pivote();
      list.push({ d: hx + hy, k: 'camion', X, Y });
      pd = cam.x + cam.y; PX = X; PY = Y - 12;
      // un auto se dibuja delante o detrás del camión según el punto del camión que le queda más cerca
      const C = N.CAMION, ca = Math.cos(cam.a), sa = Math.sin(cam.a), cb = Math.cos(cam.a2), sb = Math.sin(cam.a2);
      const tramos = [[cam.x - ca * C.cola, cam.y - sa * C.cola, cam.x + ca * C.frente, cam.y + sa * C.frente]];
      if (cam.remolque) tramos.push([cam.rx - cb * C.remCola, cam.ry - sb * C.remCola, hx + cb * C.remFrente, hy + sb * C.remFrente]);
      for (const e of list) {
        if (e.k !== 'auto') continue;
        const o = e.o; if (Math.abs(o.x - cam.x) > 30 || Math.abs(o.y - cam.y) > 30) continue;
        let bd = 1e9, bq = 0;
        for (const [ax, ay, bx, by] of tramos) {
          const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1; let t = ((o.x - ax) * dx + (o.y - ay) * dy) / L2; t = Math.max(0, Math.min(1, t));
          const qx = ax + dx * t, qy = ay + dy * t, d = Math.hypot(o.x - qx, o.y - qy); if (d < bd) { bd = d; bq = qx + qy; }
        }
        if (bd < 9) e.d = (o.x + o.y) > bq ? Math.max(e.d, hx + hy + 0.01) : Math.min(e.d, hx + hy - 0.01);
      }
    }
    list.sort((a, b) => a.d - b.d);
    // preparar los edificios que vienen (hacia donde va el camión), pocos por cuadro
    let nuevos = 0;
    if (cam && estado === 'manejo') {
      const ax = cam.x + Math.cos(cam.a) * 70, ay = cam.y + Math.sin(cam.a) * 70, l = M.edifEn(ax, ay);
      if (l) for (const i of l) { if (nuevos >= 2) break; if (!edifCache.has(i)) { hacerEdif(i); nuevos++; } }
    }
    const postes = [];
    for (const e of list) {
      const { X, Y, o } = e;
      if (e.k === 'deco') {
        const s = decoSprite(o); if (!s) continue;
        const x0s = X - s.ox, y0s = Y - s.oy;
        const tapa = e.d > pd && PX > x0s && PX < x0s + s.cv.width && PY > y0s && PY < y0s + s.cv.height && o.k !== 'poste';
        if (tapa) ctx.globalAlpha = 0.45;
        ctx.drawImage(s.cv, x0s, y0s); ctx.globalAlpha = 1;
        if (o.k === 'poste') postes.push(o);
      } else if (e.k === 'edif') {
        let s = edifCache.get(e.i);
        if (!s) { if (nuevos >= 4) continue; nuevos++; s = hacerEdif(e.i); }
        const [X0, Y0] = proj(0, 0);
        const x0s = X0 - s.ox, y0s = Y0 - s.oy;
        const tapa = e.d > pd && PX > x0s && PX < x0s + s.cv.width && PY > y0s && PY < y0s + s.cv.height;
        if (tapa) ctx.globalAlpha = 0.4;
        ctx.drawImage(s.cv, x0s, y0s); ctx.globalAlpha = 1;
      } else if (e.k === 'auto') {
        const l = autoSpr[o.tipo][o.col], s = l[GR.ang(o.ang)];
        ctx.drawImage(s.cv, X - s.ox, Y - s.oy);
        if (noche() > 0.3) { const fx = Math.cos(o.ang), fy = Math.sin(o.ang), [hx, hy] = proj(o.x + fx * o.largo / 2, o.y + fy * o.largo / 2, 0.7); ctx.fillStyle = '#fff8c0'; ctx.fillRect(hx - 1, hy, 2, 1); }
      } else if (e.k === 'letrero') dibujarLetrero(o, X, Y);
      else if (e.k === 'camion') dibujarCamion(X, Y);
    }
    // cables entre postes de la misma calle
    ctx.strokeStyle = 'rgba(20,20,24,0.8)'; ctx.lineWidth = 1; ctx.beginPath();
    postes.sort((a, b) => a.eje - b.eje || a.s - b.s);
    for (let i = 1; i < postes.length; i++) { const a = postes[i - 1], b = postes[i]; if (a.eje !== b.eje || b.s - a.s > 31) continue; const [ax, ay] = proj(a.x, a.y, 9.6), [bx, by] = proj(b.x, b.y, 9.6); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 3, bx, by); }
    ctx.stroke();
    // humo
    for (const q of parts) { const [X, Y] = proj(q.x, q.y, q.z), f = q.life / q.max, r = 2 + f * 4; ctx.fillStyle = 'rgba(60,60,64,' + (0.5 * (1 - f)).toFixed(2) + ')'; ctx.fillRect(X - r / 2 | 0, Y - r / 2 | 0, r | 0, r | 0); }
    // noche y lluvia
    const n = noche();
    if (n > 0) {
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(${Math.round(255 - n * 190)},${Math.round(255 - n * 175)},${Math.round(255 - n * 110)},1)`; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      if (cam && estado !== 'titulo') { // focos del camión
        const [X, Y] = proj(cam.x + Math.cos(cam.a) * 14, cam.y + Math.sin(cam.a) * 14);
        const g = ctx.createRadialGradient(X, Y, 2, X, Y, 46); g.addColorStop(0, `rgba(255,240,180,${0.5 * n})`); g.addColorStop(1, 'rgba(255,240,180,0)');
        ctx.fillStyle = g; ctx.fillRect(X - 50, Y - 50, 100, 100);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (lluvia && estado !== 'titulo') {
      ctx.fillStyle = 'rgba(30,40,70,0.18)'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(180,200,255,0.5)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i < 90; i++) { const sx = (GR.hash(i, 3) * W + frame * 3 + i * 7) % (W + 40) - 20, sy = (GR.hash(i, 9) * H + frame * 8 * (0.8 + GR.hash(i, 5) * 0.5)) % (H + 20) - 10; ctx.moveTo(sx | 0, sy | 0); ctx.lineTo((sx - 3) | 0, (sy + 7) | 0); }
      ctx.stroke();
    }
  }
  function hacerEdif(i) {
    const s = GR.edificio(M.edif[i], i); edifCache.set(i, s);
    if (edifCache.size > 900) { const it = edifCache.keys(); for (let n = 0; n < 200; n++) edifCache.delete(it.next().value); }
    return s;
  }
  // quinta rueda del tracto: ahí se ancla el sprite del remolque
  function pivote() { return [cam.x + Math.cos(cam.a) * N.CAMION.quinta, cam.y + Math.sin(cam.a) * N.CAMION.quinta]; }
  function dibujarCamion(X, Y) {
    const st = camSpr.tractos[tractoCol][GR.ang(cam.a)];
    const tracto = () => { ctx.drawImage(st.cv, X - st.ox, Y - st.oy); if (cam.freno && Math.abs(cam.v) > 0.3 || cam.atras) luzFreno(); };
    if (!cam.remolque) { tracto(); return; }
    const enc = partida.encargo, tipo = enc ? enc.rem : 'lona', col = enc ? enc.col : 0;
    const sr = camSpr.rem[tipo][col % camSpr.rem[tipo].length][GR.ang(cam.a2)];
    const [hx, hy] = pivote(), [HX, HY] = proj(hx, hy);
    const remolque = () => ctx.drawImage(sr.cv, HX - sr.ox, HY - sr.oy);
    // el que queda más cerca de la cámara (más al sur-este) se dibuja encima
    // el tracto va adelante del pivote: si mira hacia la cámara (+x+y), tapa al remolque
    if (Math.cos(cam.a) + Math.sin(cam.a) > 0) { remolque(); tracto(); } else { tracto(); remolque(); }
  }
  function luzFreno() {
    const ca = Math.cos(cam.remolque ? cam.a2 : cam.a), sa = Math.sin(cam.remolque ? cam.a2 : cam.a);
    const bx = cam.remolque ? cam.rx - ca * 3 : cam.x - ca * 1.1, by = cam.remolque ? cam.ry - sa * 3 : cam.y - sa * 1.1;
    for (const lado of [-1, 1]) { const [X, Y] = proj(bx - sa * lado * 1.1, by + ca * lado * 1.1, 1.2); ctx.fillStyle = cam.atras ? '#ffffff' : '#ff2020'; ctx.fillRect(X - 1, Y - 1, 2, 2); }
  }
  // hora del día → oscuridad 0..1 (amanece 7:00, oscurece 20:30)
  function noche() {
    if (!partida) return 0;
    const h = (partida.t / 3600) % 24;
    if (h >= 8 && h <= 19.5) return 0;
    if (h > 19.5 && h < 21) return (h - 19.5) / 1.5 * 0.7;
    if (h >= 6.5 && h < 8) return (8 - h) / 1.5 * 0.7;
    return 0.7;
  }
  const ICONO = { puerto: '#3aa0e0', pesquera: '#f08080', combustible: '#e8c020', supermercado: '#40c060', ferreteria: '#e07030', muebles: '#a07050', repuestos: '#8080a0', feria: '#f0a040', hospital: '#f0f0f0', bodega: '#c0a070', industria: '#a0a0b0' };
  function dibujarLetrero(d, X, Y) {
    // poste con un cartel de color según el rubro; el destino lleva una flecha que salta
    ctx.fillStyle = '#505058'; ctx.fillRect(X, Y - 14, 1, 14);
    ctx.fillStyle = '#101014'; ctx.fillRect(X - 6, Y - 22, 13, 9);
    ctx.fillStyle = ICONO[d.cat] || '#fff'; ctx.fillRect(X - 5, Y - 21, 11, 7);
    GR.text(ctx, d.cat[0].toUpperCase(), X - 2, Y - 21, { color: '#101014' });
    if (d === destino() && estado !== 'titulo') {
      const b = Math.round(Math.sin(stT * 5) * 3);
      GR.text(ctx, '↓', X - 2, Y - 34 + b, { color: '#f9f871', outline: '#000' });
    }
  }

  // ---------- HUD ----------
  function panel(x, y, w, h, a) { ctx.fillStyle = `rgba(8,10,24,${a || 0.72})`; ctx.fillRect(x, y, w, h); ctx.strokeStyle = 'rgba(5,217,232,0.45)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
  const T = (s, x, y, o) => GR.text(ctx, s, x, y, o || {});
  let miniCv = null, miniT = -9;
  function minimapa(x, y, w, h) {
    // se redibuja cuatro veces por segundo en un lienzo propio
    if (!miniCv) { miniCv = GR.mk(w, h); }
    const sc = 0.32;
    if (stT - miniT > 0.25) {
      miniT = stT;
      const c = miniCv.getContext('2d');
      c.fillStyle = '#1c2c1c'; c.fillRect(0, 0, w, h);
      const cx = camPos.x, cy = camPos.y;
      const map = (px, py) => [w / 2 + ((px - cx) - (py - cy)) * sc, h / 2 + ((px - cx) + (py - cy)) / 2 * sc];
      const R = 300;
      // agua
      for (let gy = -R; gy < R; gy += 12) for (let gx = -R; gx < R; gx += 12) if (M.agua(cx + gx, cy + gy)) { const [u, v] = map(cx + gx, cy + gy); c.fillStyle = '#24508a'; c.fillRect(u | 0, v | 0, 6, 4); }
      const segs = M.segsRect(cx - R, cy - R, cx + R, cy + R);
      const capas = [['#5a5a62', 1, e => e.c === 'residential' || e.c === 'living_street' || e.c === 'unclassified'], ['#b8b8c0', 1.5, e => e.c === 'secondary' || e.c === 'tertiary'], ['#f0d070', 2, e => e.c === 'primary' || e.c === 'trunk' || e.c === 'link'], ['#f09030', 2.5, e => e.c === 'motorway']];
      for (const [col, lw, f] of capas) {
        c.strokeStyle = col; c.lineWidth = lw; c.beginPath();
        for (let i = 0; i < segs.length; i += 2) { const e = M.ejes[segs[i]]; if (!f(e)) continue; const j = segs[i + 1]; const [a1, b1] = map(e.pts[j][0], e.pts[j][1]), [a2, b2] = map(e.pts[j + 1][0], e.pts[j + 1][1]); c.moveTo(a1, b1); c.lineTo(a2, b2); }
        c.stroke();
      }
      if (gps) { c.strokeStyle = '#50e0ff'; c.lineWidth = 2; c.beginPath(); for (let k = gpsSt.i; k < gps.pts.length; k++) { const [u, v] = map(gps.pts[k][0], gps.pts[k][1]); k === gpsSt.i ? c.moveTo(u, v) : c.lineTo(u, v); if (Math.abs(u - w / 2) > w && Math.abs(v - h / 2) > h) break; } c.stroke(); }
      for (const d of M.depositos) { const [u, v] = map(d.x, d.y); if (u < -3 || v < -3 || u > w + 3 || v > h + 3) continue; c.fillStyle = d === destino() ? '#f9f871' : ICONO[d.cat]; c.fillRect(u - 2, v - 1, 4, 3); c.fillRect(u - 1, v - 2, 2, 5); }
    }
    ctx.drawImage(miniCv, x, y);
    ctx.strokeStyle = 'rgba(5,217,232,0.6)'; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    // el camión al centro (con la cámara adelantada, se corre un poco)
    const u = x + w / 2 + ((cam.x - camPos.x) - (cam.y - camPos.y)) * 0.32, v = y + h / 2 + ((cam.x - camPos.x) + (cam.y - camPos.y)) / 2 * 0.32;
    const du = Math.cos(cam.a) - Math.sin(cam.a), dv = (Math.cos(cam.a) + Math.sin(cam.a)) / 2, l = Math.hypot(du, dv) || 1;
    ctx.fillStyle = '#ff2a6d'; ctx.fillRect(Math.round(u) - 1, Math.round(v) - 1, 3, 3);
    ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(u + du / l * 3), Math.round(v + dv / l * 3), 1, 1);
    // flecha hacia el destino si quedó fuera del recuadro
    const d = destino();
    if (d) {
      const du2 = ((d.x - camPos.x) - (d.y - camPos.y)) * 0.32, dv2 = ((d.x - camPos.x) + (d.y - camPos.y)) / 2 * 0.32;
      if (Math.abs(du2) > w / 2 - 3 || Math.abs(dv2) > h / 2 - 3) {
        const k = Math.min((w / 2 - 4) / Math.abs(du2 || 1e-9), (h / 2 - 4) / Math.abs(dv2 || 1e-9));
        ctx.fillStyle = (frame >> 3) & 1 ? '#f9f871' : '#ff9a20'; ctx.fillRect(Math.round(x + w / 2 + du2 * k) - 1, Math.round(y + h / 2 + dv2 * k) - 1, 3, 3);
      }
    }
  }
  const FLECHA = { DERECHA: '→', IZQUIERDA: '←', AUTOPISTA: '↑' };
  function hud() {
    const enc = partida.encargo;
    // arriba a la izquierda: dinero, hora, ciudad
    panel(4, 4, 132, 30);
    T(C.fmt(partida.dinero), 9, 9, { color: '#7cff4f' });
    T(C.hora(partida.t) + ' · DÍA ' + (1 + Math.floor(partida.t / 86400)), 9, 19, { color: '#d1f7ff' });
    const ciu = M.ciudadEn(cam.x, cam.y);
    T(ciu ? ciu.nombre.toUpperCase() : 'RUTA 5 SUR', 136 - 5 - GR.textW(ciu ? ciu.nombre.toUpperCase() : 'RUTA 5 SUR'), 9, { color: '#f9f871' });
    if (lluvia) T('LLUVIA', 136 - 5 - GR.textW('LLUVIA'), 19, { color: '#80b0ff' });
    // minimapa
    minimapa(W - 100, 4, 96, 64);
    // velocímetro
    panel(4, H - 34, 78, 30);
    const kmh = Math.round(Math.abs(cam.v) * 3.6);
    T(String(kmh).padStart(3, ' '), 9, H - 29, { color: '#fff', scale: 2 });
    T('KM/H', 47, H - 28, { color: '#a0a0c0' });
    T(cam.atras ? 'R' : 'D' + cam.marcha, 47, H - 19, { color: cam.atras ? '#ff6ec7' : '#05d9e8' });
    // límite de velocidad de la vía
    const q = M.enCalzada(cam.x, cam.y);
    if (q && q.m < 2) {
      const lim = Math.round(q.e.vmax * 3.6 / 10) * 10;
      const x = 88, y = H - 30;
      ctx.fillStyle = '#f4f4f4'; ctx.beginPath(); ctx.arc(x + 11, y + 11, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d82020'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + 11, y + 11, 9.5, 0, Math.PI * 2); ctx.stroke();
      T(String(lim), x + 11, y + 8, { color: '#101014', align: 'center' });
      if (kmh > lim + 8 && (frame >> 4) & 1) T('!', x + 24, y + 6, { color: '#ff2a6d' });
    }
    // calle actual
    if (q && q.m < 2 && q.e.nombre) { const n = q.e.nombre.toUpperCase().slice(0, 30); panel(116, H - 15, GR.textW(n) + 10, 12, 0.6); T(n, 121, H - 12, { color: '#d1f7ff' }); }
    // indicaciones del GPS y encargo
    if (enc && gps) {
      const sNow = gps.cum[gpsSt.i] || 0;
      const sig = gps.indic.find(t => t.s > sNow + 2);
      const resto = Math.max(0, gps.len - sNow);
      panel(116, H - 44, W - 120, 28);
      const kmR = resto * (gps.real / Math.max(1, gps.len)) / 1000;
      T('→ ' + C.nombreDep(M.depositos[enc.a], M).tipo + ' · ' + C.nombreDep(M.depositos[enc.a], M).ciudad, 121, H - 40, { color: '#f9f871' });
      T((kmR < 1 ? Math.round(kmR * 1000) + ' M' : kmR.toFixed(1).replace('.', ',') + ' KM'), W - 9 - GR.textW(kmR < 1 ? Math.round(kmR * 1000) + ' M' : kmR.toFixed(1).replace('.', ',') + ' KM'), H - 40, { color: '#fff' });
      if (sig && sig.s - sNow < 400) {
        const dd = Math.round((sig.s - sNow) / 10) * 10;
        const txt = (FLECHA[sig.giro] || '') + ' ' + (dd < 15 ? 'AHORA' : 'EN ' + dd + ' M') + ' ' + (sig.giro === 'AUTOPISTA' ? 'TOMA LA ' + sig.nombre.toUpperCase() : 'A LA ' + sig.giro + (sig.nombre ? ' · ' + sig.nombre.toUpperCase() : ''));
        T(txt.slice(0, 44), 121, H - 30, { color: dd < 60 && (frame >> 3) & 1 ? '#ffffff' : '#50e0ff' });
      } else if (resto < 60) T('LLEGANDO: DETENTE EN EL PATIO', 121, H - 30, { color: '#7cff4f' });
      else T('SIGUE LA LÍNEA AZUL', 121, H - 30, { color: '#50e0ff' });
      // datos de la carga
      panel(4, 38, 132, 40);
      T(enc.n.slice(0, 21), 9, 43, { color: '#ffd080' });
      const tarde = partida.t > enc.limite;
      T(enc.peso + ' T · DAÑO ' + Math.round(enc.dano) + '%', 9, 53, { color: enc.dano > 20 ? '#ff6060' : '#c0c0d0' });
      T((tarde ? 'ATRASADO, ERA ' : 'ENTREGA HASTA ') + C.hora(enc.limite), 9, 63, { color: tarde ? '#ff9a20' : '#7cff4f' });
    } else if (!enc) {
      const t = depAqui ? (TACTIL ? 'TOCA CARGA PARA VER LAS CARGAS DE AQUÍ' : 'ESPACIO: VER LAS CARGAS DE AQUÍ') : 'SIN CARGA · VE A UN DEPÓSITO (◆ EN EL MAPA)';
      const tt = t.replace('◆', '*');
      panel(116, H - 31, Math.min(W - 120, GR.textW(tt) + 10), 13); T(tt.slice(0, 46), 121, H - 28, { color: depAqui ? '#7cff4f' : '#d1f7ff' });
    }
    // radio
    if (stT - radioMsgT < 4 || RADIO.estado === 'conectando') {
      const t = '♪ ' + RADIO.texto();
      const tt = t.replace('♪', '>');
      panel(W / 2 - GR.textW(tt) / 2 - 6, 82, GR.textW(tt) + 12, 13); T(tt, W / 2, 85, { color: '#ff6ec7', align: 'center' });
    } else if (RADIO.actual()) { T('> ' + RADIO.actual().nombre.slice(0, 20), W - 100, 72, { color: 'rgba(255,110,199,0.8)' }); }
    if (cam.fuera && Math.abs(cam.v) > 1) T('FUERA DEL CAMINO', W / 2, 60, { color: '#ffb040', align: 'center', outline: '#000' });
  }
  function dibujarMsgs() {
    let y = estado === 'mapa' ? 24 : 136; // debajo del camión, sobre el panel del GPS
    for (const m of msgs) {
      const a = Math.min(1, (m.dur - m.t) * 3);
      ctx.globalAlpha = a;
      if (m.style === 'big') {
        const w = Math.max(GR.textW(m.text), m.sub ? GR.textW(m.sub) : 0) + 16;
        panel(W / 2 - w / 2, y, w, m.sub ? 24 : 14, 0.8);
        T(m.text, W / 2, y + 4, { color: '#f9f871', align: 'center' });
        if (m.sub) T(m.sub, W / 2, y + 14, { color: '#d1f7ff', align: 'center' });
        y += m.sub ? 28 : 18;
      } else { const w = GR.textW(m.text) + 12; panel(W / 2 - w / 2, y, w, 13, 0.7); T(m.text, W / 2, y + 3, { color: '#fff', align: 'center' }); y += 16; }
      ctx.globalAlpha = 1;
    }
  }
  function dibujarBolsa() {
    ctx.fillStyle = 'rgba(4,6,18,0.82)'; ctx.fillRect(14, 14, W - 28, H - 28);
    ctx.strokeStyle = '#05d9e8'; ctx.strokeRect(14.5, 14.5, W - 29, H - 29);
    const n = C.nombreDep(depAqui, M);
    T('BOLSA DE CARGAS', W / 2, 20, { color: '#f9f871', align: 'center', scale: 1 });
    T(n.tipo + ' · ' + (n.calle || 'S/N').slice(0, 26) + ' · ' + n.ciudad, W / 2, 31, { color: '#a0e0ff', align: 'center' });
    if (!ofertas.length) T('NO HAY CARGAS AQUÍ AHORA', W / 2, 80, { color: '#fff', align: 'center' });
    ofertas.forEach((o, i) => {
      const y = 44 + i * 32, sel = i === selOf;
      ctx.fillStyle = sel ? 'rgba(5,217,232,0.22)' : 'rgba(255,255,255,0.04)'; ctx.fillRect(20, y, W - 40, 29);
      if (sel) { ctx.strokeStyle = '#05d9e8'; ctx.strokeRect(20.5, y + 0.5, W - 41, 28); }
      const d = M.depositos[o.a], nd = C.nombreDep(d, M);
      T(o.n, 26, y + 4, { color: sel ? '#fff' : '#d0d0e0' });
      T(C.fmt(o.pago), W - 26, y + 4, { color: '#7cff4f', align: 'right' });
      T('→ ' + nd.tipo + ' · ' + nd.ciudad, 26, y + 13, { color: d.ciudad !== depAqui.ciudad ? '#ffd080' : '#a0a0c0' });
      T(o.km.toFixed(1).replace('.', ',') + ' KM', W - 26, y + 13, { color: '#d1f7ff', align: 'right' });
      T(o.peso + ' T · REMOLQUE ' + o.rem.toUpperCase() + ' · PLAZO ' + Math.round(o.plazo / 60) + ' MIN', 26, y + 21, { color: '#8080a0' });
    });
    const yS = 44 + ofertas.length * 32;
    const sel = selOf === ofertas.length;
    T(sel ? '> SEGUIR SIN CARGA <' : 'SEGUIR SIN CARGA', W / 2, yS + 4, { color: sel ? '#fff' : '#8080a0', align: 'center' });
    T(TACTIL ? '↑↓ ELEGIR · CARGA: ACEPTAR' : '↑↓ ELEGIR · ESPACIO: ACEPTAR · ESC: CERRAR', W / 2, H - 24, { color: '#a080c0', align: 'center' });
  }
  function dibujarEntrega() {
    const r = resumen;
    ctx.fillStyle = 'rgba(4,6,18,0.85)'; ctx.fillRect(60, 30, W - 120, H - 60); ctx.strokeStyle = '#7cff4f'; ctx.strokeRect(60.5, 30.5, W - 121, H - 61);
    T('ENTREGA COMPLETA', W / 2, 38, { color: '#7cff4f', align: 'center' });
    T(r.n, W / 2, 50, { color: '#ffd080', align: 'center' });
    const filas = [['PAGO', C.fmt(r.pago), '#fff'], [r.aTiempo ? 'BONO A TIEMPO' : 'LLEGASTE TARDE', r.aTiempo ? '+' + C.fmt(r.bono) : '$0', r.aTiempo ? '#7cff4f' : '#ff9a20'],
      ['DAÑO A LA CARGA ' + Math.round(r.dano) + '%', '-' + C.fmt(r.desc), r.desc ? '#ff6060' : '#a0a0c0'], ['DIÉSEL', '-' + C.fmt(r.diesel), '#ff9a20']];
    filas.forEach(([a, b, c], i) => { T(a, 72, 66 + i * 11, { color: '#c0c0d0' }); T(b, W - 72, 66 + i * 11, { color: c, align: 'right' }); });
    ctx.fillStyle = '#05d9e8'; ctx.fillRect(72, 112, W - 144, 1);
    T('GANANCIA', 72, 117, { color: '#fff' }); T(C.fmt(r.neto), W - 72, 117, { color: r.neto >= 0 ? '#7cff4f' : '#ff6060', align: 'right' });
    T(r.km.toFixed(1).replace('.', ',') + ' KM EN ' + Math.round(r.duracion / 60) + ' MIN DEL JUEGO', W / 2, 134, { color: '#a0a0c0', align: 'center' });
    T('EN CAJA: ' + C.fmt(partida.dinero) + ' · ' + partida.entregas + ' ENTREGAS', W / 2, 146, { color: '#d1f7ff', align: 'center' });
    if ((frame >> 4) & 1) T(TACTIL ? 'CARGA: VER NUEVAS CARGAS' : 'ESPACIO: VER NUEVAS CARGAS', W / 2, H - 44, { color: '#f9f871', align: 'center' });
  }
  let mapaCache = {};
  function dibujarMapa() {
    // zoom 0: todo el mapa centrado; 1: la ciudad alrededor del camión; 2: el barrio
    const L = M.lim, wu = (L.x1 - L.y0) - (L.x0 - L.y1), wv = ((L.x1 + L.y1) - (L.x0 + L.y0)) / 2;
    const SCS = [Math.min((W - 20) / wu, (H - 50) / wv), 0.06, 0.16];
    const sc = SCS[mapaZoom];
    ctx.fillStyle = '#0c1410'; ctx.fillRect(0, 0, W, H);
    let mm = mapaCache[mapaZoom];
    if (!mm && mapaZoom < 2) mm = mapaCache[mapaZoom] = GR.buildMinimapa(M, sc);
    const cx = mapaZoom ? cam.x : (L.x0 + L.x1) / 2 + 0, cy = mapaZoom ? cam.y : (L.y0 + L.y1) / 2;
    if (mm) {
      const [u, v] = mm.map(cx, cy);
      ctx.drawImage(mm.cv, Math.round(W / 2 - u), Math.round(H / 2 - v));
      var map = (x, y) => { const [a, b] = mm.map(x, y); return [Math.round(W / 2 - u + a), Math.round(H / 2 - v + b)]; };
    } else { // zoom cercano: se dibuja al vuelo
      var map = (x, y) => [Math.round(W / 2 + ((x - cx) - (y - cy)) * sc), Math.round(H / 2 + ((x - cx) + (y - cy)) / 2 * sc)];
      const R = 1500, segs = M.segsRect(cx - R, cy - R, cx + R, cy + R);
      ctx.strokeStyle = '#8a8a90'; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i < segs.length; i += 2) { const e = M.ejes[segs[i]], j = segs[i + 1]; const [a1, b1] = map(...e.pts[j]), [a2, b2] = map(...e.pts[j + 1]); ctx.moveTo(a1, b1); ctx.lineTo(a2, b2); }
      ctx.stroke();
    }
    if (gps) { ctx.strokeStyle = '#50e0ff'; ctx.lineWidth = 2; ctx.beginPath(); gps.pts.forEach((p, k) => { const [a, b] = map(p[0], p[1]); k ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.stroke(); }
    for (const d of M.depositos) { const [a, b] = map(d.x, d.y); ctx.fillStyle = '#000'; ctx.fillRect(a - 3, b - 3, 7, 7); ctx.fillStyle = d === destino() ? ((frame >> 3) & 1 ? '#f9f871' : '#ff9a20') : ICONO[d.cat]; ctx.fillRect(a - 2, b - 2, 5, 5); }
    for (const ci of M.ciudades) { const [a, b] = map((ci.x0 + ci.x1) / 2, ci.y0 + 200); T(ci.nombre.toUpperCase(), a, b, { color: '#ffffff', align: 'center', outline: '#000' }); }
    const [a, b] = map(cam.x, cam.y);
    ctx.fillStyle = '#ff2a6d'; ctx.fillRect(a - 2, b - 2, 5, 5); if ((frame >> 3) & 1) { ctx.fillStyle = '#fff'; ctx.fillRect(a - 1, b - 1, 3, 3); }
    panel(4, 4, W - 8, 13, 0.75);
    T('MAPA · ' + ['TODO', 'CIUDAD', 'BARRIO'][mapaZoom] + ' · NORTE ARRIBA A LA DERECHA' + (TACTIL ? ' · ↑↓ ZOOM' : ' · ↑↓ ZOOM · M: VOLVER'), 9, 7, { color: '#d1f7ff' });
    // leyenda
    const cats = ['puerto', 'pesquera', 'supermercado', 'industria', 'bodega', 'combustible', 'ferreteria', 'feria', 'hospital'];
    panel(4, H - 24, W - 8, 20, 0.75);
    let x = 9;
    for (const c of cats) { ctx.fillStyle = ICONO[c]; ctx.fillRect(x, H - 19, 5, 5); const t = (C.CATS[c] || c).split(' ')[0].slice(0, 7); T(t, x + 7, H - 20, { color: '#c0c0d0' }); x += 9 + GR.textW(t) + 4; if (x > W - 40) break; }
    T('(C) OPENSTREETMAP', W - 9, H - 11, { color: '#707080', align: 'right' });
  }
  function dibujarPausa() {
    ctx.fillStyle = 'rgba(4,6,18,0.8)'; ctx.fillRect(0, 0, W, H);
    T('PAUSA', W / 2, 40, { color: '#f9f871', align: 'center', scale: 2 });
    ['SEGUIR MANEJANDO', 'COLOR DEL CAMIÓN: ' + tractoCol.toUpperCase(), 'GUARDAR Y SALIR AL TÍTULO'].forEach((t, i) => T((i === pausaSel ? '> ' : '  ') + t, W / 2, 80 + i * 14, { color: i === pausaSel ? '#fff' : '#8080a0', align: 'center' }));
    const ayuda = ['FLECHAS: MANEJAR (ABAJO DETENIDO: REVERSA)', 'ESPACIO: CARGAS · R: RADIO (MAYÚS+R: ANTERIOR)', 'M: MAPA · H: BOCINA · S: SILENCIO · ESC: PAUSA'];
    ayuda.forEach((t, i) => T(t, W / 2, 140 + i * 11, { color: '#a080c0', align: 'center' }));
    T('CALLES: © COLABORADORES DE OPENSTREETMAP · RADIOS: RADIO-BROWSER.INFO', W / 2, H - 16, { color: '#606070', align: 'center' });
  }
  function dibujarTitulo() {
    ctx.fillStyle = 'rgba(4,6,18,0.45)'; ctx.fillRect(0, 0, W, H);
    // camión grande de adorno
    const s = camSpr.tractos.rojo[Math.floor(stT * 2) % 32], r = camSpr.rem.frigo[0][Math.floor(stT * 2) % 32];
    const ang = Math.floor(stT * 2) % 32 / 32 * Math.PI * 2, bx = W / 2, by = 150;
    const q = N.CAMION.quinta * S, rx = bx + (Math.cos(ang) - Math.sin(ang)) * q, ry = by + (Math.cos(ang) + Math.sin(ang)) / 2 * q;
    const orden = (Math.cos(ang) + Math.sin(ang)) > 0;
    if (orden) { ctx.drawImage(r.cv, Math.round(rx - r.ox), Math.round(ry - r.oy)); ctx.drawImage(s.cv, bx - s.ox, by - s.oy); }
    else { ctx.drawImage(s.cv, bx - s.ox, by - s.oy); ctx.drawImage(r.cv, Math.round(rx - r.ox), Math.round(ry - r.oy)); }
    T('FLETES', W / 2, 26, { color: '#f9f871', align: 'center', scale: 4, shadow: '#ff2a6d' });
    T('CAMIONES TRANQUILOS POR EL SUR', W / 2, 62, { color: '#d1f7ff', align: 'center' });
    T('PUERTO MONTT · RUTA 5 · PUERTO VARAS', W / 2, 73, { color: '#05d9e8', align: 'center' });
    const g = leerGuardado();
    if ((frame >> 4) & 1) T(TACTIL ? '↑ ACELERAR PARA ' + (g ? 'SEGUIR' : 'EMPEZAR') : 'ESPACIO PARA ' + (g ? 'SEGUIR' : 'EMPEZAR'), W / 2, 178, { color: '#fff', align: 'center' });
    if (g) T('EN CAJA ' + C.fmt(g.dinero) + ' · ' + g.entregas + ' ENTREGAS · ' + '↓' + ' PARTIDA NUEVA', W / 2, 190, { color: '#a0a0c0', align: 'center' });
    ctx.fillStyle = 'rgba(4,6,18,0.75)'; ctx.fillRect(0, H - 16, W, 16);
    T('CALLES REALES DE OPENSTREETMAP · RADIOS EN VIVO', W / 2, H - 12, { color: '#9090b0', align: 'center' });
  }

  function dibujar() {
    if (estado === 'cargando') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); T('CARGANDO MAPA…'.replace('…', '...'), W / 2, H / 2, { color: '#05d9e8', align: 'center' }); return; }
    if (estado === 'mapa') { dibujarMapa(); dibujarMsgs(); }
    else {
      dibujarMundo();
      if (estado === 'titulo') { dibujarTitulo(); }
      else {
        hud();
        if (estado === 'bolsa') dibujarBolsa();
        else if (estado === 'entrega') dibujarEntrega();
        else if (estado === 'pausa') dibujarPausa();
        dibujarMsgs();
      }
    }
    gctx.clearRect(0, 0, W, H); gctx.drawImage(cv, 0, 0);
  }

  // ---------- bucle ----------
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (estado === 'cargando') { dibujar(); iniciar(); }
    else { actualizar(dt); dibujar(); }
    requestAnimationFrame(loop);
  }
  RADIO.onCambio = () => { radioMsgT = stT; };
  // ganchos para probar desde la consola o el navegador automatizado
  window.__fletes = {
    get estado() { return estado; }, get cam() { return cam; }, get partida() { return partida; }, get gps() { return gps; }, get autos() { return autos; },
    press(k) { if (KM[k]) { press(KM[k]); setTimeout(() => release(KM[k]), 120); } else pressed.add(ACC[k] || k); },
    teclas: keys,
    ff(seg) { for (let t = 0; t < seg; t += 1 / 60) actualizar(1 / 60); },
    ir(x, y, a) { cam.x = x; cam.y = y; cam.a = a || 0; N.ponerRemolque(cam, cam.remolque, cam.carga); camPos = { x, y }; },
  };
  requestAnimationFrame(loop);
})();
