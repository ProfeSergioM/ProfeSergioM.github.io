// TURBO 40 — ROAD TRIP DE ALASKA A TIERRA DEL FUEGO: bucle principal, pantallas del roguelike, HUD y efectos noventeros.
(function () {
  'use strict';
  const T = window.T40, GR = window.GR, AU = window.AU, TOUR = window.TOUR, E = window.ETAPAS;
  const W = 400, H = 225;
  const cv = document.getElementById('pantalla'), ctx = cv.getContext('2d');
  const gcv = document.getElementById('brillo'), gctx = gcv.getContext('2d');
  cv.width = gcv.width = W; cv.height = gcv.height = H;
  ctx.imageSmoothingEnabled = false;

  // ---------- entrada: flechas del teclado o controles táctiles (M silencia) ----------
  const keys = { up: false, down: false, left: false, right: false };
  const pressed = new Set();
  const KM = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  let musicStarted = false;
  function press(k) {
    if (!keys[k]) pressed.add(k);
    keys[k] = true; AU.init();
    if (!musicStarted) { musicStarted = true; AU.music(true, 'title'); }
  }
  const release = k => { keys[k] = false; };
  addEventListener('keydown', e => {
    const k = KM[e.key];
    if (k) { e.preventDefault(); press(k); }
    if (e.key === 'm' || e.key === 'M') AU.toggleMute();
  });
  addEventListener('keyup', e => { const k = KM[e.key]; if (k) { release(k); e.preventDefault(); } });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  const P = k => pressed.has(k);

  // ---------- controles táctiles ----------
  const TACTIL = /[?&]tactil\b/.test(location.search) || (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
  const vibrar = ms => { if (TACTIL && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { } };
  let mandos = null;
  // zona con dos mitades: cada dedo activa la tecla de la mitad donde está (se puede deslizar)
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
      return eje === 'x' ? (f < 0.5 ? teclas[0] : teclas[1]) : (f < 0.38 ? teclas[0] : teclas[1]);
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
    mandos.appendChild(zona('volante', 'x', ['left', 'right'],
      '<div class="tecla" data-k="left">◀</div><div class="tecla" data-k="right">▶</div>'));
    mandos.appendChild(zona('pedales', 'y', ['down', 'up'],
      '<div class="tecla freno" data-k="down">▼<small>FRENO</small></div><div class="tecla gas" data-k="up">▲<small>GAS</small></div>'));
    const gira = document.createElement('div'); gira.id = 'girar'; gira.textContent = '↻ GIRA EL CELULAR PARA VERLO MÁS GRANDE';
    mandos.appendChild(gira);
    const son = document.createElement('button'); son.id = 'sonido'; son.type = 'button'; son.textContent = '♪';
    son.addEventListener('pointerdown', e => { e.preventDefault(); AU.init(); AU.toggleMute(); son.classList.toggle('mudo', AU.muted); });
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
    } else if (vw > vh) { // celular horizontal: controles a los costados
      const banda = Math.max(104, Math.min(170, vw * 0.17));
      s = Math.min((vw - 2 * banda) / W, vh / H);
      x = (vw - W * s) / 2; y = (vh - H * s) / 2;
      mandos.className = 'horizontal';
      mandos.style.setProperty('--banda', banda + 'px');
    } else { // celular vertical: juego arriba, controles abajo (con altura acotada)
      s = Math.min(vw / W, (vh * 0.56) / H);
      const ctrl = Math.max(vh - 330, 56 + H * s + 40);
      x = (vw - W * s) / 2; y = Math.max(56, (ctrl - H * s) / 2);
      mandos.className = 'vertical';
      mandos.style.setProperty('--arriba', Math.round(ctrl) + 'px');
    }
    box.style.width = Math.floor(W * s) + 'px'; box.style.height = Math.floor(H * s) + 'px';
    box.style.left = Math.round(x) + 'px'; box.style.top = Math.round(y) + 'px';
  }
  addEventListener('resize', fit); fit();

  // ---------- recursos ----------
  let carSpr, palms, tiresSpr, decoSpr, pickSpr, crossSpr, colSpr, rutaSpr, trafSpr, trafico = [], trafT = 0;
  const titleCache = new Map();
  const standCache = new Map();
  let rec = { best: 0, wins: 0, runs: 0, owned: ['rojo'], livery: 'rojo' };
  try { rec = Object.assign(rec, JSON.parse(localStorage.getItem('turbo40tour') || '{}')); } catch (e) { }
  const saveRec = () => { try { localStorage.setItem('turbo40tour', JSON.stringify(rec)); } catch (e) { } };
  function buildAll() {
    carSpr = GR.buildCars(T.COLORS);
    palms = GR.buildPalms(); tiresSpr = GR.buildTires(); decoSpr = GR.buildDecor(); pickSpr = GR.buildPickups();
    crossSpr = GR.buildCrossers(); colSpr = GR.buildColeccion(); rutaSpr = GR.buildRuta(); trafSpr = GR.buildTrafico();
    applyLivery();
  }
  const liv = () => TOUR.COLECCION.find(c => c.id === rec.livery) || TOUR.COLECCION[0];
  function applyLivery() { const l = liv(); carSpr.sprites[0] = GR.livery(l.body, l.stripe); }
  function titleCar(k) {
    const l = liv(); let m = titleCache.get(l.id); if (!m) titleCache.set(l.id, m = []);
    if (!m[k]) m[k] = GR.carBig(l.body, k / 32 * Math.PI * 2, l.stripe);
    return m[k];
  }
  function standSpr(o) {
    const k = Math.round(o.a * 8) + ',' + o.side;
    if (!standCache.has(k)) standCache.set(k, GR.buildStand(Math.round(o.a * 8) / 8, o.side));
    return standCache.get(k);
  }

  // ---------- estado ----------
  let state = 'loading', stT = 0, frame = 0;
  let run = null, race = null, ground = null, mini = null, bigMini = null, statics = null, node = null;
  let cam = { x: 0, y: 0 }, cd = 0, lights = 0;
  let parts = [], conf = [], msgs = [], pops = [], shake = 0, flash = 0, hurtFlash = 0;
  let menu = null, sel = 0, mapSel = 0, ev = null, evResult = null, perks = null, stock = null, out = null, bagFrom = null;
  let banner = null, secIdx = -1, lastHurt = 0, alarmT = 0, finT = 0, bannerT = -99, vistos = new Set(), prepS = 0, prepTot = 1;
  const NEON = ['#ff2a6d', '#05d9e8', '#f9f871', '#d1f7ff', '#ff6ec7', '#7cff4f'];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const go = (s) => { state = s; stT = 0; sel = 0; };

  function newRun() {
    run = TOUR.newRun((Math.random() * 1e9) | 0, rec.owned);
    applyLivery();
    rec.runs++; saveRec();
    mapSel = 0; go('map');
    AU.music(false); AU.music(true, 'title');
  }

  function enterNode(col) {
    node = TOUR.go(run, col);
    const t = node.type;
    if (t === 'carrera' || t === 'rally' || t === 'jefe') startStage();
    else if (t === 'taller') { stock = TOUR.stock(run); go('shop'); }
    else if (t === 'evento') { ev = TOUR.randomEvent(run); evResult = null; go('event'); }
    else if (t === 'campamento') { evResult = null; go('camp'); }
    AU.blip();
  }

  function startStage() {
    race = TOUR.buildRace(run, node);
    const trk = race.trk;
    ground = GR.Ground(trk);
    mini = GR.buildMinimap(trk, 92, 58);
    bigMini = GR.buildMinimap(trk, 200, 124);
    buildStatics(trk);
    BOARD_TXT = BOARDS[trk.tema] || BOARDS.bosque;
    trafico = []; trafT = 0;
    parts = []; conf = []; msgs = []; pops = []; banner = null; secIdx = -1; lastHurt = 0; finT = 0; bannerT = -99; vistos = new Set();
    prepS = trk.startS + 1800; prepTot = Math.max(1, ground.queue.filter(q => q[2] <= prepS).length);
    const p = race.player, [ix, iy] = GR.iso(p.x, p.y); cam.x = ix; cam.y = iy;
    go('prep');
  }

  function buildStatics(trk) {
    statics = new Map();
    const add = (o, k, d) => {
      const [u, v] = GR.iso(o.x, o.y), key = Math.floor(u / 128) + ',' + Math.floor(v / 128);
      let l = statics.get(key); if (!l) statics.set(key, l = []); l.push({ o, k, d: d || 0 });
    };
    const sc = trk.scen;
    sc.decor.forEach(o => { if (o.kind !== 'duna') add(o, 'deco'); });
    sc.tires.forEach(o => { if (o.kind === 'tire') add(o, 'tire'); }); sc.rocks.forEach(o => add(o, 'rock'));
    (sc.lines || []).forEach(o => add({ x: (o.x + o.x2) / 2, y: (o.y + o.y2) / 2, l: o }, 'line'));
    // bocas de túnel en los extremos de cada tramo de autopista
    if (sc.autopista) for (const r of sc.autopista.runs) for (const [q, dir] of [[r[0], -1], [r[r.length - 1], 1]]) add({ x: q.x, y: q.y, q, dir }, 'tunel');
    sc.boards.forEach(o => add(o, 'board')); sc.stands.forEach(o => add(o, 'stand', -30));
    sc.pickups.forEach(o => add(o, 'pick'));
    sc.marshals.forEach(o => add(o, 'marshal')); sc.broken.forEach(o => add(o, 'averiado'));
    if (sc.coleccion) add(sc.coleccion, 'coleccion');
  }

  function msg(text, dur, style, sub) { msgs.push({ text, dur, t: 0, style: style || 'big', sub }); }
  function pop(x, y, text, col) { pops.push({ x, y, z: 14, text, col, t: 0 }); }
  function addP(o) { if (parts.length < 1100) parts.push(o); }
  function smoke(x, y, n, col, z) { for (let i = 0; i < n; i++) addP({ x: x + rnd(-3, 3), y: y + rnd(-3, 3), z: z || 1, vx: rnd(-8, 8), vy: rnd(-8, 8), vz: rnd(6, 14), life: 0, max: rnd(0.5, 0.9), type: 'smoke', col: col || '#d8d8e0' }); }
  function sparks(x, y, n) { for (let i = 0; i < n; i++) addP({ x, y, z: 3, vx: rnd(-90, 90), vy: rnd(-90, 90), vz: rnd(20, 70), life: 0, max: rnd(0.25, 0.5), type: 'spark' }); }

  // ---------- actualización ----------
  const DT = 1 / 120; let acc = 0;
  function update(dt) {
    stT += dt; frame++;
    for (const m of msgs) m.t += dt;
    msgs = msgs.filter(m => m.t < m.dur);
    shake = Math.max(0, shake - dt * 12); flash = Math.max(0, flash - dt * 1.6); hurtFlash = Math.max(0, hurtFlash - dt * 2);
    for (const c of conf) { c.y += c.vy * dt; c.x += Math.sin(c.ph + stT * 4) * 0.5; }
    conf = conf.filter(c => c.y < H + 5);
    const S = state;
    if (S === 'loading') return;
    if (S === 'title') {
      if (P('up')) newRun();
      if (P('left') || P('right')) {
        const own = TOUR.COLECCION.filter(c => rec.owned.includes(c.id)), k = own.findIndex(c => c.id === rec.livery);
        rec.livery = own[(k + (P('right') ? 1 : -1) + own.length) % own.length].id; saveRec(); AU.move();
      }
    }
    else if (S === 'map') updMap();
    else if (S === 'bag') updBag();
    else if (S === 'shop') updShop();
    else if (S === 'event') updEvent();
    else if (S === 'camp') updCamp();
    else if (S === 'perk') updPerk();
    else if (S === 'prep') {
      ground.work(14, prepS);
      if (!ground.pendiente(prepS) && P('up')) { go('countdown'); cd = 4.2; lights = 0; msg('PREPARADOS', 1.6, 'big'); AU.music(false); AU.music(true, 'race'); }
      if (P('left')) { bagFrom = 'prep'; go('bag'); }
    } else if (S === 'stageres') {
      if (P('right') || P('up')) afterStage();
    } else if (S === 'gameover' || S === 'victory') {
      if (stT > 1.5 && P('up')) { go('title'); AU.music(false); AU.music(true, 'title'); }
    }
    if (S === 'countdown') {
      const prev = cd; cd -= dt;
      for (const n of [3, 2, 1]) if (prev > n && cd <= n) { lights = 4 - n; AU.beep(false); msg(String(n), 0.9, 'count'); }
      if (cd <= 0) { race.phase = 'run'; state = 'race'; lights = 4; AU.beep(true); msg('¡YA!', 1.0, 'go'); flash = 0.6; }
    }
    if ((S === 'countdown' || S === 'race' || S === 'finish') && race) updRace(dt);
    else { AU.car(false, 0, 0, 0, false); AU.others([]); AU.rain(false); }
    if (S === 'victory' && frame % 3 === 0 && conf.length < 160) conf.push({ x: Math.random() * W, y: -4, vy: rnd(30, 70), ph: Math.random() * 6, col: NEON[Math.floor(Math.random() * 6)] });
    pressed.clear();
  }

  // ---------- tráfico en contra por la autopista (decorado: no choca con nadie) ----------
  function trafPos(t) {
    const r = t.r, k = Math.max(0, Math.min(r.length - 2, t.k)), a = r[k], b = r[k + 1];
    const f = Math.max(0, Math.min(1, (t.d - a.d) / ((b.d - a.d) || 1)));
    const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
    return { x: x + a.nx * t.lane, y: y + a.ny * t.lane, ts: a.ts + (b.ts - a.ts) * f, ang: Math.atan2(-a.ty, -a.tx) };
  }
  function sumarTrafico(ts) {
    const AU2 = race.trk.scen.autopista;
    for (const r of AU2.runs) {
      if (ts < r[0].ts || ts > r[r.length - 1].ts) continue;
      let lo = 0, hi = r.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (r[m].ts < ts) lo = m; else hi = m; }
      const rapido = Math.random() < 0.6, camion = !rapido && Math.random() < 0.6;
      const lane = (rapido ? -9 : 9) * AU2.lado;
      if (r[lo].d < 30 || r[lo].d > r.len - 10) return;
      const t = { r, k: lo, d: r[lo].d, lane, v: rapido ? rnd(125, 150) : camion ? rnd(80, 95) : rnd(100, 115), tipo: camion ? 'camion' : 'sedan' };
      t.col = Math.floor(Math.random() * trafSpr[t.tipo].length);
      if (trafico.some(o => o.r === r && o.lane === lane && Math.abs(o.d - t.d) < 50)) return;
      trafico.push(t); return;
    }
  }
  function updTrafico(dt) {
    const AU2 = race.trk.scen.autopista;
    if (!AU2 || !AU2.runs.length) return;
    const p = race.player;
    if (!trafico.length && race.t < 1) for (let k = 0; k < 9; k++) sumarTrafico(p.s - 150 + k * 120);
    trafT -= dt;
    if (trafT <= 0 && trafico.length < 11) { trafT = rnd(0.25, 0.8); sumarTrafico(p.s + rnd(500, 950)); }
    for (const t of trafico) {
      // no atravesar al de adelante en el mismo carril
      let v = t.v;
      for (const o of trafico) if (o !== t && o.r === t.r && o.lane === t.lane && o.d < t.d && t.d - o.d < 36) v = Math.min(v, o.v);
      t.v = v; t.d -= v * dt;
      while (t.k > 0 && t.r[t.k].d > t.d) t.k--;
      const q = trafPos(t); t.x = q.x; t.y = q.y; t.ts = q.ts; t.ang = q.ang;
    }
    trafico = trafico.filter(t => t.d > 4 && t.ts > p.s - 500);
  }

  // la mochila se usa sola en carrera: cuando una pieza baja de su umbral se aplica el mejor repuesto
  let autoT = 0;
  const UMBRAL = { chasis: 45, motor: 50, gomas: 45 };
  function usoAuto(dt) {
    const p = race.player;
    autoT -= dt;
    if (autoT > 0 || p.dead || p.finished || !run.items.length || race.phase !== 'run') return;
    const d = run.dmg;
    const partes = ['chasis', 'motor', 'gomas'].filter(k => d[k] < UMBRAL[k]).sort((a, b) => d[a] - d[b]);
    for (const k of partes) {
      let best = -1, val = 0;
      run.items.forEach((id, i) => {
        const fx = TOUR.ITEMS[id].fx; if (!fx[k]) return;
        // cuánto repara de verdad (lo que pasa de 100 se pierde); el kit suma todo
        let v = 0; for (const q in fx) v += Math.min(fx[q], 100 - d[q]) * (q === k ? 1 : 0.5);
        if (v > val) { val = v; best = i; }
      });
      if (best < 0) continue;
      const id = run.items[best], it = TOUR.ITEMS[id];
      TOUR.useItem(run, best);
      pop(p.x, p.y, it.n + ' ' + it.d, '#7cff4f'); AU.pickup('llave');
      autoT = 1.2; return;
    }
  }

  function updRace(dt) {
    acc += dt;
    while (acc >= DT) { acc -= DT; T.step(race, DT, keys); handleEvents(); }
    const p = race.player;
    perCarFx(dt); brokenSmoke(); updTrafico(dt); usoAuto(dt);
    // daño recibido: avisos
    const h = race.hurt.chasis + race.hurt.motor;
    if (h - lastHurt > 1.5) { pop(p.x, p.y, '-' + Math.round(h - lastHurt), '#ff4040'); hurtFlash = Math.min(1, (h - lastHurt) / 10); lastHurt = h; }
    else if (h > lastHurt) lastHurt = h;
    alarmT -= dt;
    if (p.dmg.chasis < 25 && !p.dead && alarmT <= 0 && state === 'race') { AU.alarm(); alarmT = 1.4; }
    // sección actual
    const k = race.trk.marks.findIndex(m => p.s >= m.s0 && p.s < m.s1);
    if (k >= 0 && k !== secIdx) {
      secIdx = k; const m = race.trk.marks[k], dt2 = race.t - bannerT;
      if (m.rocks && dt2 > 8) { bannerT = race.t; banner = { rocks: true, t: 0 }; }
    }
    if (banner) { banner.t += dt; if (banner.t > 2.2) banner = null; }
    // suelo: generar lo que viene y liberar lo que quedó atrás
    ground.work(2, p.s + 2600);
    if (frame % 60 === 0) ground.evict(p.s);
    // sonido
    const v = Math.abs(p.vf || 0), GE = T.GEARS;
    const g = p.gear, rpm = state === 'countdown' ? 0.25 + (keys.up ? 0.6 + Math.random() * 0.1 : 0) : Math.min(1.05, 0.22 + 0.78 * (v - GE[g - 1]) / (GE[g] - GE[g - 1]));
    AU.car(!p.dead, rpm, (p.thr || (state === 'countdown' && keys.up)) ? 1 : 0, p.slip, (p.surf === 2 || p.surf === 5) && v > 20);
    const near = [];
    for (const c of race.cars) { if (c === p) continue; const dx = c.x - p.x, dy = c.y - p.y, d = Math.hypot(dx, dy); if (d < 320) near.push({ c, d, dx, dy }); }
    near.sort((a, b) => a.d - b.d);
    AU.others(near.slice(0, 4).map(({ c, d, dx, dy }) => {
      const vc = Math.abs(c.vf || 0), gc = c.gear;
      const rc = state === 'countdown' ? 0.25 + (Math.sin(stT * (5 + c.id) + c.id * 2) > 0.2 ? 0.45 : 0) : Math.min(1.05, 0.22 + 0.78 * (vc - GE[gc - 1]) / (GE[gc] - GE[gc - 1]));
      const ux = dx / (d || 1), uy = dy / (d || 1), vr = (c.vx - p.vx) * ux + (c.vy - p.vy) * uy, f = 1 - d / 320;
      return { car: c, rpm: rc, vol: 0.05 * f * f * (0.55 + 0.45 * (c.thr || (state === 'countdown' ? 1 : 0))), pan: T.clamp((dx - dy) / 160, -0.9, 0.9), dop: T.clamp(1 - vr / 450, 0.8, 1.25) };
    }));
    AU.rain(race.rain && state !== 'finish');
    if (race.rain && state === 'race') { race.lightT = (race.lightT == null ? 8 : race.lightT) - dt; if (race.lightT <= 0) { race.lightT = 9 + Math.random() * 14; flash = 0.55; AU.thunder(); } }
    // cámara
    const [tx, ty] = GR.iso(p.x + p.vx * 0.4, p.y + p.vy * 0.4), kk = Math.min(1, dt * 4.5);
    cam.x += (tx - cam.x) * kk; cam.y += (ty - cam.y) * kk;
    for (const q of parts) {
      q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.type === 'spark' || q.type === 'dirt') { q.vz -= 260 * dt; if (q.z < 0) { q.z = 0; q.vz *= -0.4; } }
      if (q.type === 'smoke') { q.vx *= 0.96; q.vy *= 0.96; }
    }
    parts = parts.filter(q => q.life < q.max);
    for (const q of pops) { q.t += dt; q.z += dt * 18; }
    pops = pops.filter(q => q.t < 1.1);
    if (state === 'finish') { finT += dt; if (finT > 4.2) endStage(); }
    else if (state === 'race' && race.timeout) { state = 'finish'; finT = 0; msg('FUERA DE TIEMPO', 4, 'bad'); AU.jingle('lose'); }
  }

  function handleEvents() {
    const p = race.player;
    for (const e of race.events) {
      if (e.type === 'shift') {
        const c = e.car, fx = Math.cos(c.a), fy = Math.sin(c.a);
        for (let i = 0; i < 5; i++) addP({ x: c.x - fx * 14, y: c.y - fy * 14, z: 2, vx: -fx * rnd(20, 60) + rnd(-10, 10), vy: -fy * rnd(20, 60) + rnd(-10, 10), vz: rnd(0, 10), life: 0, max: rnd(0.08, 0.2), type: 'flame' });
        if (c === p) AU.backfire();
      } else if (e.type === 'hit') {
        sparks(e.x, e.y, 10);
        if (e.car === p || e.other === p) { AU.crash(e.v); shake = Math.min(3, e.v / 30); vibrar(35); }
      } else if (e.type === 'tire' || e.type === 'rock') {
        const col = e.type === 'rock' ? '#d03030' : '#202024';
        for (let i = 0; i < 7; i++) addP({ x: e.x, y: e.y, z: 4, vx: rnd(-50, 50), vy: rnd(-50, 50), vz: rnd(30, 80), life: 0, max: 0.6, type: 'dirt', col });
        if (e.type === 'rock') { sparks(e.x, e.y, 6); smoke(e.x, e.y, 3, '#909098', 3); }
        if (e.car === p) { AU.thud(e.v); shake = Math.min(3.5, e.v / 25); vibrar(60); }
      } else if (e.type === 'crosser') {
        if (e.car === p) {
          if (e.kind === 'persona') { pop(e.x, e.y, '¡MULTA -$40!', '#ff8040'); AU.honk(); }
          else if (e.kind === 'alce' || e.kind === 'oso') { pop(e.x, e.y, e.kind === 'alce' ? '¡ALCE!' : '¡OSO!', '#ff4040'); AU.thud(110); shake = 4; vibrar(120); }
          else if (e.kind === 'ciervo' || e.kind === 'llama' || e.kind === 'guanaco') { pop(e.x, e.y, '¡' + e.kind.toUpperCase() + '!', '#ff4040'); AU.thud(90); shake = 3; }
          else if (e.kind === 'perro' || e.kind === 'gallina' || e.kind === 'oveja') { pop(e.x, e.y, '¡UPS!', '#ff8040'); AU.thud(50); }
          else { pop(e.x, e.y, '¡PAF!', '#f9f871'); AU.blip(); }
        }
        // estalla: nube de humo y pedacitos de su color, y desaparece
        const cols = ESTALLA[e.kind] || ['#c0b0a0', '#ffffff'];
        smoke(e.x, e.y, 9, '#f4f4f8', 5);
        for (let i = 0; i < 22; i++) addP({ x: e.x + rnd(-3, 3), y: e.y + rnd(-3, 3), z: 5, vx: rnd(-80, 80) + e.car.vx * 0.3, vy: rnd(-80, 80) + e.car.vy * 0.3, vz: rnd(30, 110), life: 0, max: rnd(0.4, 0.8), type: 'dirt', col: cols[i % cols.length] });
        for (let i = 0; i < 6; i++) addP({ x: e.x, y: e.y, z: 6, vx: rnd(-30, 30), vy: rnd(-30, 30), vz: rnd(10, 40), life: 0, max: 0.25, type: 'spark' });
      } else if (e.type === 'rompe') {
        // poste o cartel partido: astillas o chapa, y una sacudida corta
        const madera = e.kind === 'poste', fx = Math.cos(e.ang), fy = Math.sin(e.ang);
        for (let i = 0; i < 16; i++) addP({ x: e.x, y: e.y, z: rnd(3, 16), vx: fx * rnd(30, 110) + rnd(-35, 35), vy: fy * rnd(30, 110) + rnd(-35, 35), vz: rnd(20, 80), life: 0, max: rnd(0.4, 0.9), type: 'dirt', col: madera ? (i % 3 ? '#7a5430' : '#4a321c') : (i % 3 ? '#f8c818' : '#a0a0a8') });
        if (!madera) sparks(e.x, e.y, 6);
        smoke(e.x, e.y, 3, '#c8c0b0', 3);
        if (e.car === p) { AU.thud(e.v * 0.45); shake = Math.min(2.5, e.v / 60); vibrar(40); }
      } else if (e.type === 'aterriza') {
        if (e.v > 25) {
          smoke(e.x, e.y, Math.min(6, 1 + e.v / 25), '#d0ccc4', 1);
          if (e.v > 70) sparks(e.x, e.y, 5);
          if (e.car === p) { AU.thud(Math.min(90, e.v * 0.6)); shake = Math.min(3, e.v / 40); vibrar(Math.min(80, e.v)); }
        }
      } else if (e.type === 'yellowIn') { AU.whistle(); }
      else if (e.type === 'yellowOut') { pop(p.x, p.y, 'PISTA LIBRE', '#7cff4f'); }
      else if (e.type === 'penalty') { pop(e.x, e.y, '¡+5 S!', '#ff2a2a'); AU.error(); msg('ADELANTASTE CON AMARILLA', 1.8, 'pen', '+5 S DE PENALIZACIÓN'); }
      else if (e.type === 'coleccion') {
        const c = TOUR.COLECCION.find(k => k.id === e.id);
        if (!rec.owned.includes(e.id)) { rec.owned.push(e.id); saveRec(); }
        AU.jingle('record'); flash = 0.3;
        msg('¡AUTO COLECCIONABLE!', 3, 'col', c.n);
        for (let i = 0; i < 20; i++) addP({ x: e.x, y: e.y, z: 8, vx: rnd(-60, 60), vy: rnd(-60, 60), vz: rnd(30, 90), life: 0, max: 0.6, type: 'spark' });
      } else if (e.type === 'oil') {
        if (e.car === p) { pop(e.x, e.y, '¡ACEITE!', '#ff40c0'); AU.thud(40); }
      } else if (e.type === 'pickup') {
        AU.pickup(e.kind);
        const txt = { cash: '+$' + e.val, llave: 'CHASIS +' + Math.round(e.val), goma: 'GOMAS +' + Math.round(e.val), aceite: 'MOTOR +' + Math.round(e.val), nitro: '¡NITRO!', caja: '¡REPUESTO!' }[e.kind];
        pop(e.x, e.y, txt, { cash: '#7cff4f', nitro: '#20e0ff', caja: '#ff6ec7' }[e.kind] || '#f9f871');
        for (let i = 0; i < 8; i++) addP({ x: e.x, y: e.y, z: 6, vx: rnd(-40, 40), vy: rnd(-40, 40), vz: rnd(20, 60), life: 0, max: 0.4, type: 'spark' });
      } else if (e.type === 'dead' && e.car === p) {
        AU.boom(); shake = 5; flash = 0.7; vibrar([90, 50, 250]);
        for (let i = 0; i < 40; i++) addP({ x: p.x, y: p.y, z: 5, vx: rnd(-80, 80), vy: rnd(-80, 80), vz: rnd(30, 120), life: 0, max: rnd(0.4, 1), type: i % 2 ? 'flame' : 'spark' });
        smoke(p.x, p.y, 12, '#303034', 4);
        msg('¡DESTRUIDO!', 4, 'bad'); state = 'finish'; finT = 0; AU.music(false);
      } else if (e.type === 'finish' && e.car === p) {
        state = 'finish'; finT = 0; flash = 0.5; AU.music(false);
        AU.jingle(e.pos <= 3 ? 'win' : 'lose');
        msg('¡META!', 4, 'meta', ORD(e.pos) + ' · ' + T.fmt(p.finishTime));
      }
    }
    race.events.length = 0;
  }
  const ORD = n => n + '°';

  // colores de huellas y polvo por paisaje
  const POLVO = {
    nieve: { huella: 'rgba(120,140,170,0.45)', salta: '#ffffff', nube: '#f0f4fa', ruta: '#e8eef6' },
    bosque: { huella: 'rgba(30,60,20,0.4)', salta: '#2c6a24', nube: '#8a7a5a', ruta: null },
    california: { huella: 'rgba(120,90,40,0.4)', salta: '#c8a050', nube: '#d8c08a', ruta: '#d8c8a0' },
    desierto: { huella: 'rgba(150,90,40,0.4)', salta: '#d8a060', nube: '#e8c090', ruta: '#e8cca0' },
    selva: { huella: 'rgba(60,40,20,0.45)', salta: '#5a3a1a', nube: '#7a6040', ruta: null },
    andes: { huella: 'rgba(110,90,50,0.4)', salta: '#a08850', nube: '#c8b080', ruta: '#d0bc90' },
    atacama: { huella: 'rgba(150,80,40,0.4)', salta: '#d08858', nube: '#e8b088', ruta: '#ecc0a0' },
    estepa: { huella: 'rgba(120,100,50,0.4)', salta: '#b8a060', nube: '#d0c08a', ruta: '#dccca0' },
  };
  // colores de lo que vuela al atropellar a alguien
  const ESTALLA = {
    persona: ['#e83040', '#2a70e0', '#f0b890', '#2a3050'], perro: ['#a8692c', '#6a3e14'], ciervo: ['#a0602c', '#d8c090'], gallina: ['#ffffff', '#f8f8f0', '#e02020'],
    alce: ['#5a3a20', '#d8c8a0', '#3a2414'], oso: ['#26221e', '#6a4a2a'], llama: ['#f0ece0', '#9a6a3a'], guanaco: ['#c88a4a', '#f0e8d8'], oveja: ['#f0f0e8', '#ffffff', '#202020'],
    rodadora: ['#a08048', '#c8a868'], pelota: ['#ff3030', '#ffffff', '#3060ff', '#ffd020'],
  };
  function perCarFx(dt) {
    for (const c of race.cars) {
      const sp = Math.hypot(c.vx, c.vy), fx = Math.cos(c.a), fy = Math.sin(c.a);
      // las ruedas en el suelo: marcas, humo, goma y polvo
      const tema = race.trk.tema, PV = POLVO[tema] || POLVO.bosque;
      const asf = (c.surf === 0 || c.surf === 1) && !c.air, fuera = !asf && c.surf !== 4 && !c.air;
      const derrape = c.slip > 16 && sp > 30 ? Math.min(1, (c.slip - 16) / 28) : 0;
      const frenada = c.brk > 0.4 && c.vf > 40 ? c.brk : 0;
      const patina = c.thr > 0.9 && c.vf > 2 && c.vf < 42 && !c.dead ? 0.7 : 0; // arranque patinando
      const k = Math.max(derrape, frenada, patina);
      const ruedas = frenada ? [[-8, -5], [-8, 5], [8, -5], [8, 5]] : [[-8, -5], [-8, 5]];
      if ((k > 0 && asf) || (fuera && sp > 15)) {
        const col = asf ? 'rgba(16,16,20,' + (0.25 + 0.4 * k).toFixed(2) + ')' : PV.huella;
        ruedas.forEach(([a, b], w) => {
          const x = c.x + fx * a - fy * b, y = c.y + fy * a + fx * b, last = c['sk' + w];
          if (last) {
            const n = Math.ceil(Math.hypot(x - last[0], y - last[1]) / 1.5);
            if (n < 14) for (let i = 1; i <= n; i++) { const X = last[0] + (x - last[0]) * i / n, Y = last[1] + (y - last[1]) * i / n; ground.mark(X - Y, (X + Y) / 2, col); }
          }
          c['sk' + w] = [x, y];
        });
        if (ruedas.length === 2) c.sk2 = c.sk3 = null;
      } else { c.sk0 = c.sk1 = c.sk2 = c.sk3 = null; }
      if (k > 0 && asf) {
        // humo de goma quemada desde las ruedas traseras
        if (Math.random() < dt * (6 + 40 * k)) for (const b of [-5, 5]) addP({ x: c.x - fx * 9 - fy * b + rnd(-2, 2), y: c.y - fy * 9 + fx * b + rnd(-2, 2), z: 1, vx: -c.vx * 0.1 + rnd(-12, 12), vy: -c.vy * 0.1 + rnd(-12, 12), vz: rnd(4, 14), life: 0, max: rnd(0.5, 1.0) + k * 0.6, type: 'smoke', col: k > 0.6 ? '#f0f0f4' : '#c8c8d0' });
        // pedacitos de goma
        if (k > 0.5 && Math.random() < dt * 20 * k) addP({ x: c.x - fx * 9 + rnd(-5, 5), y: c.y - fy * 9 + rnd(-5, 5), z: 1, vx: rnd(-30, 30), vy: rnd(-30, 30), vz: rnd(15, 35), life: 0, max: 0.4, type: 'dirt', col: '#141416' });
      }
      // tierra, nieve o pasto que salta fuera del camino
      if (fuera && sp > 25 && Math.random() < dt * (14 + sp * 0.12)) {
        for (const b of [-5, 5]) addP({ x: c.x - fx * 10 - fy * b + rnd(-2, 2), y: c.y - fy * 10 + fx * b + rnd(-2, 2), z: 1, vx: -c.vx * 0.25 + rnd(-15, 15), vy: -c.vy * 0.25 + rnd(-15, 15), vz: rnd(20, 55), life: 0, max: 0.5, type: 'dirt', col: PV.salta });
        if (Math.random() < 0.5) smoke(c.x - fx * 12, c.y - fy * 12, 1, PV.nube);
      }
      // polvo del camino en los paisajes secos; agua levantada en la nieve
      if (asf && sp > 70 && PV.ruta && Math.random() < dt * (sp / 40)) addP({ x: c.x - fx * 13 + rnd(-5, 5), y: c.y - fy * 13 + rnd(-5, 5), z: 1, vx: -c.vx * 0.12 + rnd(-8, 8), vy: -c.vy * 0.12 + rnd(-8, 8), vz: rnd(3, 9), life: 0, max: rnd(0.4, 0.8), type: 'smoke', col: PV.ruta });
      if (race.rain && sp > 60 && Math.random() < dt * 20) addP({ x: c.x - fx * 12 + rnd(-5, 5), y: c.y - fy * 12 + rnd(-5, 5), z: 1, vx: -c.vx * 0.15 + rnd(-10, 10), vy: -c.vy * 0.15 + rnd(-10, 10), vz: rnd(10, 25), life: 0, max: 0.35, type: 'smoke', col: '#c8d8f0' });
      if (c.isPlayer) {
        if (c.nitroT > 0) for (let i = 0; i < 2; i++) addP({ x: c.x - fx * 14, y: c.y - fy * 14, z: 2, vx: -fx * rnd(40, 90), vy: -fy * rnd(40, 90), vz: rnd(-5, 5), life: 0, max: rnd(0.1, 0.25), type: 'flame', blue: true });
        if ((c.dmg.motor < 50 || c.dead) && Math.random() < dt * (c.dead ? 14 : c.dmg.motor < 25 ? 10 : 4)) smoke(c.x - fx * 8, c.y - fy * 8, 1, c.dmg.motor < 25 || c.dead ? '#404044' : '#a0a0a8', 6);
        if ((c.dmg.chasis < 30 || c.dead) && Math.random() < dt * 8) addP({ x: c.x + rnd(-6, 6), y: c.y + rnd(-6, 6), z: 6, vx: rnd(-10, 10), vy: rnd(-10, 10), vz: rnd(10, 30), life: 0, max: 0.3, type: 'flame' });
      }
    }
  }

  function brokenSmoke() {
    for (const o of race.trk.scen.broken) if (Math.random() < 0.15) smoke(o.x, o.y, 1, '#505058', 8);
  }
  function endStage() {
    out = TOUR.finishStage(run, race);
    AU.car(false, 0, 0, 0, false); AU.others([]);
    if (run.over && !run.won) { finishRun(); return; }
    go('stageres'); AU.music(true, 'title');
  }
  function afterStage() {
    if (node.type === 'jefe' && run.region >= E.REGIONES.length - 1) { TOUR.nextRegion(run); finishRun(); return; }
    if (node.type === 'jefe') { perks = TOUR.perkChoices(run); go(perks.length ? 'perk' : 'shop'); if (!perks.length) stock = TOUR.stock(run); }
    else if (run.R() < 0.35) { ev = TOUR.randomEvent(run); evResult = null; go('event'); } // algo pasa al llegar al pueblo
    else llegarTaller();
  }
  function llegarTaller() { stock = TOUR.stock(run); go('shop'); }
  function finishRun() {
    const gp = TOUR.gcPos(run);
    if (run.won) { rec.wins++; go('victory'); AU.jingle('win'); }
    else { go('gameover'); AU.jingle('lose'); }
    rec.best = Math.max(rec.best, run.region + (run.won ? 1 : 0));
    saveRec(); run.finalPos = gp;
  }

  // ---------- menús ----------
  function updMap() {
    const opts = TOUR.options(run);
    mapSel = 0;
    if (P('right') || P('up')) enterNode(opts[0]);
    if (P('left')) { bagFrom = 'map'; go('bag'); }
  }
  function listNav(n) {
    if (P('up')) { sel = (sel - 1 + n) % n; AU.move(); }
    if (P('down')) { sel = (sel + 1) % n; AU.move(); }
  }
  function updBag() {
    const n = run.items.length + 1;
    listNav(n);
    if (P('right')) {
      if (sel < run.items.length) { TOUR.useItem(run, sel); AU.buy(); if (race && state === 'bag' && bagFrom === 'prep') syncDmg(); sel = Math.min(sel, run.items.length); }
      else back();
    }
    if (P('left')) back();
    function back() { state = bagFrom; stT = 0; }
  }
  function syncDmg() { /* race.player.dmg comparte objeto con run.dmg */ }
  // ---------- taller: tres secciones claras (reparar, mejoras, repuestos) ----------
  const PIEZA = {
    chasis: { n: 'CHASIS', d: 'ES LA VIDA DEL AUTO. BAJA CON LOS CHOQUES. SI LLEGA A 0 QUEDAS FUERA DEL TOUR.', ef: d => ['VIDA', d, 100] },
    motor: { n: 'MOTOR', d: 'DA LA VELOCIDAD Y LA ACELERACIÓN. SE GASTA CON GOLPES Y YENDO SIEMPRE A FONDO.', ef: d => ['VELOCIDAD', Math.round(80 + 0.2 * d), 100] },
    gomas: { n: 'GOMAS', d: 'DAN EL AGARRE EN LAS CURVAS. SE GASTAN DERRAPANDO Y SALIENDO DE LA PISTA.', ef: d => ['AGARRE', Math.round(60 + 0.4 * d), 100] },
  };
  let shopMsg = null;
  function shopRows() {
    const rows = [];
    rows.push({ head: 'REPARAR', sub: 'DEJA LA PIEZA AL 100%' });
    for (const p of ['chasis', 'motor', 'gomas']) {
      const c = TOUR.repairCost(run, p), d = Math.round(run.dmg[p]), P0 = PIEZA[p], ef = P0.ef(d);
      rows.push({ kind: 'rep', t: P0.n, val: d, price: c || null, done: !c, ok: c > 0 && run.money >= c, act: () => TOUR.repair(run, p),
        title: 'REPARAR ' + P0.n, d: P0.d, cambio: c ? ef[0] + ' ' + ef[1] + '% → ' + ef[2] + '%' : P0.n + ' AL 100%', falta: c ? null : 'YA ESTÁ AL 100%' });
    }
    const all = TOUR.repairAllCost(run), rotas = ['chasis', 'motor', 'gomas'].filter(p => run.dmg[p] < 100).length;
    if (rotas > 1) rows.push({ kind: 'todo', t: 'REPARAR TODO', price: all, ok: run.money >= all, act: () => TOUR.repairAll(run),
      title: 'REPARAR TODO', d: 'DEJA CHASIS, MOTOR Y GOMAS AL 100% DE UNA VEZ. CUESTA LO MISMO QUE POR SEPARADO.', cambio: 'TODO AL 100%' });
    rows.push({ head: 'MEJORAS', sub: 'PARA TODO EL TOUR' });
    for (const u of TOUR.UPGRADES) {
      const c = TOUR.upCost(run, u.id), lv = run.up[u.id], cur = 100 + u.paso * lv;
      rows.push({ kind: 'up', t: u.n, lv, price: c, ok: c != null && run.money >= c, act: () => TOUR.buyUp(run, u.id),
        title: 'MEJORAR ' + u.n, d: 'MEJORA PERMANENTE: SE QUEDA EN EL AUTO HASTA EL FINAL DEL TOUR. NIVEL ' + lv + ' DE 3.',
        cambio: c == null ? u.ef + ' ' + cur + '%' : u.ef + ' ' + cur + '% → ' + (cur + u.paso) + '%', falta: c == null ? 'NIVEL MÁXIMO' : null });
    }
    rows.push({ head: 'REPUESTOS', sub: 'VAN A TU MOCHILA' });
    stock.forEach((id, i) => {
      const it = TOUR.ITEMS[id], llena = run.items.length >= run.maxItems;
      rows.push({ kind: 'item', t: it.n, ef: it.d, price: it.precio, ok: run.money >= it.precio && !llena, act: () => { const r = TOUR.buyItem(run, id); if (r) stock.splice(i, 1); return r; },
        title: it.n, d: 'VA A LA MOCHILA. EN CARRERA SE USA SOLO CUANDO LA PIEZA SE DAÑA; TAMBIÉN PUEDES USARLO A MANO EN EL MAPA (TECLA ←).', cambio: it.d, falta: llena ? 'MOCHILA LLENA' : null });
    });
    if (!stock.length) rows.push({ kind: 'nada', t: 'SIN STOCK', ok: false, title: 'SIN REPUESTOS', d: 'YA COMPRASTE TODO LO QUE HABÍA.' });
    const fin = node && node.type === 'jefe';
    rows.push({ kind: 'exit', t: fin ? 'SEGUIR AL PRÓXIMO TRAMO' : 'SALIR AL MAPA', exit: true, ok: true, title: 'SALIR', d: fin ? 'TERMINAR EN EL TALLER Y SEGUIR AL PRÓXIMO TRAMO DEL VIAJE.' : 'VOLVER AL MAPA DE RUTAS.' });
    return rows;
  }
  function updShop() {
    const rows = shopRows(), n = rows.length;
    const ok = i => !rows[i].head && rows[i].kind !== 'nada';
    if (sel >= n) sel = n - 1;
    if (!ok(sel)) { let k = sel; while (k < n - 1 && !ok(k)) k++; sel = k; }
    const mover = d => { let k = sel; do { k = (k + d + n) % n; } while (!ok(k)); sel = k; AU.move(); };
    if (P('up')) mover(-1);
    if (P('down')) mover(1);
    if (P('right')) {
      const r = rows[sel];
      if (r.exit) leaveShop();
      else if (r.ok && r.act()) { AU.buy(); shopMsg = { t: '¡LISTO! ' + r.title, c: '#7cff4f', t0: frame }; }
      else { AU.error(); shopMsg = { t: r.falta || (r.price != null && run.money < r.price ? 'TE FALTAN $' + (r.price - run.money) : 'NO SE PUEDE'), c: '#ff4040', t0: frame }; }
    }
    if (P('left')) leaveShop();
  }
  function leaveShop() {
    if (node && node.type === 'jefe') { if (!TOUR.nextRegion(run)) { finishRun(); return; } }
    mapSel = 0; go('map');
  }
  function updEvent() {
    if (evResult) { if (P('right') || P('up')) llegarTaller(); return; }
    listNav(ev.ops.length);
    if (P('right')) {
      const o = ev.ops[sel];
      if (o.ok && !o.ok(run)) { AU.error(); return; }
      evResult = o.fx(run); AU.buy();
    }
  }
  function updCamp() {
    if (evResult) { if (P('right') || P('up')) { mapSel = 0; go('map'); } return; }
    listNav(TOUR.camp.length);
    if (P('right')) { evResult = TOUR.camp[sel].fx(run); AU.buy(); }
  }
  function updPerk() {
    listNav(perks.length);
    if (P('right')) { TOUR.takePerk(run, perks[sel].id); AU.jingle('record'); stock = TOUR.stock(run); go('shop'); }
  }

  // ---------- dibujo del mundo ----------
  const proj = (x, y, z) => [Math.round(x - y - cam.x + W / 2), Math.round((x + y) / 2 - (z || 0) * 1.15 - cam.y + H / 2)];
  const BOARDS = {
    nieve: ['MOTEL', 'GAS', 'CAFÉ', 'YUKON', 'ALCES', 'TURBO'], bosque: ['LODGE', 'GAS', 'CAFÉ', 'PESCA', 'TURBO', 'ARCE'],
    california: ['MOTEL', 'DINER', 'GAS', 'SURF', 'RUTA1', 'TURBO'], desierto: ['TACOS', 'GAS', 'MOTEL', 'HOTEL', 'AGUA', 'TURBO'],
    selva: ['CAFÉ', 'FRUTA', 'GAS', 'HOTEL', 'COCO', 'TURBO'], andes: ['HOTEL', 'CAFÉ', 'PISCO', 'GAS', 'MATE', 'TURBO'],
    atacama: ['GAS', 'AGUA', 'HOTEL', 'SAL', 'COBRE', 'TURBO'], estepa: ['ASADO', 'MATE', 'GAS', 'HOTEL', 'LANA', 'TURBO'],
  };
  let BOARD_TXT = BOARDS.bosque;
  const TALL = { pino: 1, arbol: 1, cerezo: 1, palmera: 1, pinoNieve: 1, roble: 1, ceiba: 1, saguaro: 1, cardon: 1, poste: 1, banano: 1, ventoso: 1, cabana: 1, motel: 1, adobe: 1, casaColor: 1, galpon: 1 };

  function decoSprite(o) {
    const sah = !!T.ARENOSO[race.trk.tema];
    const rs = rutaSpr[o.kind];
    if (rs) return rs[o.v % rs.length];
    switch (o.kind) {
      case 'seco': return decoSpr.seco[o.v];
      case 'rocaArena': return decoSpr.rocaArena[o.v];
      case 'palmera': return palms[o.v];
      case 'pino': return decoSpr.pino[o.v];
      case 'arbol': return decoSpr.arbol[o.v];
      case 'cerezo': return decoSpr.cerezo[o.v];
      case 'arbusto': return sah ? decoSpr.seco[o.v] : decoSpr.arbusto[o.v];
      case 'roca': return sah ? decoSpr.rocaArena[o.v] : decoSpr.roca[o.v];
      case 'senal': return decoSpr.senal[0];
    }
    return null;
  }

  function drawWorld() {
    let sx = 0, sy = 0;
    if (shake > 0) { sx = Math.round(rnd(-shake, shake)); sy = Math.round(rnd(-shake, shake)); }
    const rx = cam.x, ry = cam.y;
    cam.x = Math.round(cam.x) - sx; cam.y = Math.round(cam.y) - sy;
    ground.draw(ctx, cam.x, cam.y, W, H);
    const inView = (X, Y, m) => X > -m && X < W + m && Y > -m && Y < H + m * 1.5;
    const ai = c => ((Math.round(c.a / (Math.PI * 2) * 32) % 32) + 32) % 32;
    ctx.globalAlpha = 0.38;
    for (const c of race.cars) { const [X, Y] = proj(c.x, c.y); if (!inView(X, Y, 40)) continue; const s = carSpr.shadows[ai(c)]; ctx.drawImage(s.cv, X - s.ox + 3, Y - s.oy + 2); }
    ctx.globalAlpha = 1;
    const list = [], p = race.player, [PX, PY] = proj(p.x, p.y), pd = p.x + p.y;
    const ul = cam.x - W / 2, vt = cam.y - H / 2;
    for (let cu = Math.floor((ul - 60) / 128); cu <= Math.floor((ul + W + 60) / 128); cu++)
      for (let cv2 = Math.floor((vt - 30) / 128); cv2 <= Math.floor((vt + H + 90) / 128); cv2++) {
        const l = statics.get(cu + ',' + cv2); if (!l) continue;
        for (const e of l) {
          if ((e.k === 'pick' || e.k === 'coleccion') && e.o.taken) continue;
          if (e.k === 'rock' && e.o.hidden) continue;
          const [X, Y] = proj(e.o.x, e.o.y);
          if (inView(X, Y, 70)) list.push({ d: e.o.x + e.o.y + e.d, k: e.k, o: e.o, X, Y });
        }
      }
    for (const c of race.cars) { const [X, Y] = proj(c.x, c.y, c.z || 0); if (inView(X, Y, 40)) list.push({ d: c.x + c.y, k: 'car', o: c, X, Y }); }
    for (const o of race.crossers) { const [X, Y] = proj(o.x, o.y, o.z); if (inView(X, Y, 30)) list.push({ d: o.x + o.y, k: 'cross', o, X, Y }); }
    for (const o of trafico) { if (o.x == null) continue; const [X, Y] = proj(o.x, o.y); if (inView(X, Y, 50)) list.push({ d: o.x + o.y, k: 'traf', o, X, Y }); }
    list.sort((a, b) => a.d - b.d);
    for (const e of list) {
      const { X, Y, o } = e;
      if (e.k === 'deco') {
        if (o.roto) { ctx.fillStyle = o.kind === 'poste' ? '#4a321c' : '#606068'; ctx.fillRect(X - 1, Y - 3, 2, 3); continue; }
        const s = decoSprite(o); if (!s) continue;
        const x0 = X - s.ox, y0 = Y - s.oy;
        const occl = TALL[o.kind] && e.d > pd && PX > x0 && PX < x0 + s.cv.width && PY > y0 && PY < y0 + s.cv.height;
        if (occl) ctx.globalAlpha = 0.4;
        ctx.drawImage(s.cv, x0, y0); ctx.globalAlpha = 1;
      } else if (e.k === 'tire') { const s = tiresSpr[o.c]; ctx.drawImage(s.cv, X - s.ox, Y - s.oy); }
      else if (e.k === 'line') drawLinea(o.l);
      else if (e.k === 'rock') { const s = decoSpr.peligro[o.v]; ctx.drawImage(s.cv, X - s.ox, Y - s.oy); }
      else if (e.k === 'board') { if (o.roto) { ctx.fillStyle = '#202028'; ctx.fillRect(X - 15, Y - 4, 2, 4); ctx.fillRect(X + 13, Y - 4, 2, 4); } else drawBoard(X, Y, o.k, e.d > pd && Math.abs(PX - X) < 22 && PY < Y && PY > Y - 34); }
      else if (e.k === 'stand') {
        const fr = standSpr(o), s = fr[(Math.floor(stT * (state !== 'race' ? 8 : 2.5)) + (o.x | 0)) % 2];
        ctx.drawImage(s.cv, X - s.ox, Y - s.oy);
      } else if (e.k === 'tunel') drawTunel(o);
      else if (e.k === 'traf') {
        const s = trafSpr[o.tipo][o.col][((Math.round(o.ang / (Math.PI * 2) * 32) % 32) + 32) % 32];
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(X - 9, Y - 2, 18, 5);
        ctx.drawImage(s.cv, X - s.ox, Y - s.oy);
        if (frame & 8) { const fx = Math.cos(o.ang), fy = Math.sin(o.ang), [hx, hy] = proj(o.x + fx * (o.tipo === 'camion' ? 16 : 10), o.y + fy * (o.tipo === 'camion' ? 16 : 10), 3); ctx.fillStyle = '#fff8c0'; ctx.fillRect(hx - 1, hy, 2, 1); }
      } else if (e.k === 'cross') {
        const fr = o.hit ? 0 : Math.floor(o.t * 8) % 2, s = crossSpr[o.type][o.v][fr];
        const flip = (o.vx - o.vy) < 0;
        ctx.save(); ctx.translate(X, Y); if (flip) ctx.scale(-1, 1);
        ctx.drawImage(s.cv, -s.ox, -s.oy); ctx.restore();
        if (o.z === 0) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(X - 3, Y, 6, 1); }
      } else if (e.k === 'marshal') {
        const s = crossSpr.marshal[Math.floor(stT * 6 + o.ph) % 2];
        ctx.save(); ctx.translate(X, Y); if (o.side < 0) ctx.scale(-1, 1); ctx.drawImage(s.cv, -s.ox, -s.oy); ctx.restore();
      } else if (e.k === 'averiado') {
        const s = carSpr.sprites[9][((Math.round(o.a / (Math.PI * 2) * 32) % 32) + 32) % 32];
        ctx.drawImage(s.cv, X - s.ox, Y - s.oy);
        if (frame % 20 < 10) { ctx.fillStyle = '#ffd020'; ctx.fillRect(X - 1, Y - 18, 3, 3); }
      } else if (e.k === 'coleccion') {
        const bob = Math.round(Math.sin(stT * 4) * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(X - 5, Y - 1, 10, 2);
        ctx.drawImage(colSpr.cv, X - colSpr.ox, Y - 16 - colSpr.oy + bob);
        const a = stT * 4; ctx.fillStyle = '#fff';
        for (let k = 0; k < 3; k++) { const b = a + k * 2.1; ctx.fillRect(Math.round(X + Math.cos(b) * 13), Math.round(Y - 16 + bob + Math.sin(b) * 13), 1, 1); }
      } else if (e.k === 'pick') {
        const s = pickSpr[o.type], bob = Math.round(Math.sin(stT * 5 + o.s) * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(X - 4, Y - 1, 8, 2);
        ctx.drawImage(s.cv, X - s.ox, Y - 14 - s.oy + bob);
      } else {
        const c = o, s = carSpr.sprites[c.color][ai(c)];
        const bump = ((c.surf >= 2 && c.surf !== 4) || (c.surf === 4 && frame % 5 === 0)) && Math.hypot(c.vx, c.vy) > 20 && (frame & 2) ? -1 : 0;
        if (c.finished && !c.isPlayer) ctx.globalAlpha = 0.55;
        if (c.dead) { ctx.globalAlpha = 0.75; ctx.filter = 'brightness(0.35)'; }
        ctx.drawImage(s.cv, X - s.ox, Y - s.oy + bump);
        ctx.filter = 'none'; ctx.globalAlpha = 1;
        if (c.brk > 0 && c.vf > 5) { const fx = Math.cos(c.a), fy = Math.sin(c.a), [bx, by] = proj(c.x - fx * 13, c.y - fy * 13, 2 + (c.z || 0)); ctx.fillStyle = '#ff2020'; ctx.fillRect(bx - 2, by - 1, 4, 2); }
      }
    }
    for (const q of parts) {
      const [X, Y] = proj(q.x, q.y, q.z), f = q.life / q.max;
      if (q.type === 'smoke') { const r = 2 + f * 5; ctx.fillStyle = q.col; ctx.globalAlpha = 0.55 * (1 - f); ctx.fillRect(X - r / 2 | 0, Y - r / 2 | 0, r | 0, r | 0); ctx.globalAlpha = 1; }
      else if (q.type === 'spark') { ctx.fillStyle = f < 0.4 ? '#ffffa0' : '#ff9020'; ctx.fillRect(X, Y, 1, 1); }
      else if (q.type === 'flame') { ctx.fillStyle = q.blue ? (f < 0.4 ? '#ffffff' : '#40b0ff') : (f < 0.3 ? '#ffffff' : f < 0.6 ? '#ffe040' : '#ff5010'); ctx.fillRect(X - 1, Y - 1, 2, 2); }
      else if (q.type === 'dirt') { ctx.fillStyle = q.col; ctx.fillRect(X, Y, 2, 2); }
    }
    drawGantry(race.trk.startS, true); drawGantry(race.trk.finishS, false);
    if (race.rain && race.trk.tema === 'nieve') {
      ctx.fillStyle = 'rgba(200,215,240,0.16)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 140; i++) {
        const x = (GR.hash(i, 3) * W + frame * (0.6 + GR.hash(i, 4)) + Math.sin(frame * 0.03 + i) * 6) % W, y = (GR.hash(i, 9) * H + frame * (1 + GR.hash(i, 5) * 1.5)) % H;
        ctx.fillRect(x | 0, y | 0, i % 5 ? 1 : 2, i % 5 ? 1 : 2);
      }
    } else if (race.rain) {
      ctx.fillStyle = 'rgba(20,30,70,0.28)'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(180,200,255,0.55)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i < 110; i++) {
        const sx2 = (GR.hash(i, 3) * W + frame * 3 + i * 7) % (W + 40) - 20, sy2 = (GR.hash(i, 9) * H + frame * 9 * (0.8 + GR.hash(i, 5) * 0.5)) % (H + 20) - 10;
        ctx.moveTo(sx2 | 0, sy2 | 0); ctx.lineTo((sx2 - 3) | 0, (sy2 + 8) | 0);
      }
      ctx.stroke();
      for (let i = 0; i < 8; i++) { const x = GR.hash(i, frame >> 2) * W | 0, y = GR.hash(frame >> 2, i) * H | 0; ctx.fillStyle = 'rgba(200,220,255,0.6)'; ctx.fillRect(x - 1, y, 3, 1); }
    }
    for (const q of pops) {
      const [X, Y] = proj(q.x, q.y, q.z);
      if (q.t < 0.8 || frame & 2) GR.text(ctx, q.text, X, Y, { align: 'center', color: q.col, outline: '#000' });
    }
    if (state === 'countdown' || (state === 'race' && race.t < 2.5)) {
      if (frame & 8) { GR.text(ctx, '↓', PX, PY - 30, { align: 'center', color: '#f9f871', outline: '#000' }); GR.text(ctx, 'TÚ', PX, PY - 39, { align: 'center', color: '#fff', outline: '#000' }); }
    }
    const v = Math.hypot(p.vx, p.vy);
    if (p.nitroT > 0 && state === 'race') {
      const dx = p.vx - p.vy, dy = (p.vx + p.vy) / 2, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
      ctx.strokeStyle = p.nitroT > 0 ? 'rgba(120,220,255,0.7)' : 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1; ctx.beginPath();
      const n = 12;
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2, rr = rnd(120, 200), x = W / 2 + Math.cos(ang) * rr, y = H / 2 + Math.sin(ang) * rr * 0.6, L = rnd(10, 26);
        ctx.moveTo(x | 0, y | 0); ctx.lineTo((x - ux * L) | 0, (y - uy * L) | 0);
      }
      ctx.stroke();
    }
    cam.x = rx; cam.y = ry;
  }

  // barandas, cables de teléfono, alambrados y oleoducto (segmentos entre postes)
  const LINEA = { baranda: { z: 4, w: 2, c: '#9aa0ae', h: '#eef0f4', post: '#3a3a44', pz: 4 }, cable: { z: 26, w: 1, c: '#18181c' },
    alambre: { z: 5, w: 1, c: '#7a7a70', post: '#6a4a2a', pz: 6 }, roca: { z: 9, w: 6, c: '#7a7266', h: '#a89e8c' }, muro: { z: 5, w: 4, c: '#b8b8b0', h: '#f0f0e8' }, tubo: { z: 7, w: 3, c: '#a8acb6', h: '#e8eaf0', post: '#50505a', pz: 7 } };
  function drawLinea(l) {
    const st = LINEA[l.e] || LINEA.baranda;
    const [ax, ay] = proj(l.x, l.y, st.z), [bx, by] = proj(l.x2, l.y2, st.z);
    if (st.post) { const [px0, py0] = proj(l.x, l.y, 0); ctx.fillStyle = st.post; ctx.fillRect(px0, py0 - Math.round(st.pz * 1.15), l.e === 'tubo' ? 2 : 1, Math.round(st.pz * 1.15) + 1); }
    if (l.e === 'cable' && ((l.a && l.a.roto) || (l.b && l.b.roto))) return;
    if (l.e === 'baranda' || l.e === 'tubo' || l.e === 'muro' || l.e === 'roca') { ctx.strokeStyle = '#26282e'; ctx.lineWidth = st.w + 2; ctx.beginPath(); ctx.moveTo(ax + 0.5, ay + 0.5); ctx.lineTo(bx + 0.5, by + 0.5); ctx.stroke(); }
    ctx.strokeStyle = st.c; ctx.lineWidth = st.w; ctx.beginPath();
    if (l.e === 'cable') { const mx = (ax + bx) / 2, my = (ay + by) / 2 + 3; ctx.moveTo(ax + 0.5, ay + 0.5); ctx.quadraticCurveTo(mx, my, bx + 0.5, by + 0.5); }
    else { ctx.moveTo(ax + 0.5, ay + 0.5); ctx.lineTo(bx + 0.5, by + 0.5); }
    ctx.stroke();
    if (st.h) { ctx.strokeStyle = st.h; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax + 0.5, ay - 0.5 - (st.w > 2 ? 1 : 0)); ctx.lineTo(bx + 0.5, by - 0.5 - (st.w > 2 ? 1 : 0)); ctx.stroke(); }
  }

  // boca de túnel: la autopista pasa por debajo del camino
  function drawTunel(o) {
    const q = o.q, w = T.HW2 + 3, Z = 15, th = 10 * o.dir;
    const P = (lat, z, al) => proj(q.x + q.nx * lat + q.tx * (al || 0), q.y + q.ny * lat + q.ty * (al || 0), z);
    const poly = (pts, col) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); };
    poly([P(-w, 0), P(-w, Z), P(w, Z), P(w, 0)], '#a8a8a0');
    poly([P(-w + 3, 0), P(-w + 3, Z - 4), P(w - 3, Z - 4), P(w - 3, 0)], '#0a0a0e');
    poly([P(-w, Z), P(-w, Z, th), P(w, Z, th), P(w, Z)], '#d0d0c8');
    ctx.fillStyle = '#f0c020'; const [lx, ly] = P(0, Z - 2); ctx.fillRect(lx - 1, ly, 3, 1);
  }

  function drawBoard(X, Y, k, fade) {
    if (fade) ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#202028'; ctx.fillRect(X - 15, Y - 22, 2, 22); ctx.fillRect(X + 13, Y - 22, 2, 22);
    ctx.fillStyle = '#0c0c14'; ctx.fillRect(X - 21, Y - 36, 42, 16);
    const col = NEON[(Math.floor(frame / 10) + k) % NEON.length];
    ctx.fillStyle = col; ctx.fillRect(X - 20, Y - 35, 40, 1); ctx.fillRect(X - 20, Y - 22, 40, 1); ctx.fillRect(X - 20, Y - 35, 1, 14); ctx.fillRect(X + 19, Y - 35, 1, 14);
    if ((frame + k * 17) % 90 > 6) GR.text(ctx, BOARD_TXT[k % BOARD_TXT.length], X, Y - 32, { align: 'center', color: NEON[(k + 2) % NEON.length] });
    ctx.globalAlpha = 1;
  }

  function drawGantry(s, isStart) {
    const trk = race.trk, p0 = trk.pts[Math.round(s / trk.DS)], o = T.HW + 8, Z = 30;
    const A = [p0.x + p0.nx * o, p0.y + p0.ny * o], B = [p0.x - p0.nx * o, p0.y - p0.ny * o];
    const [ax, ay] = proj(A[0], A[1]), [bx, by] = proj(B[0], B[1]);
    if (Math.max(ax, bx) < -20 || Math.min(ax, bx) > W + 20 || Math.max(ay, by) < -20 || Math.min(ay, by) > H + 60) return;
    const [atx, aty] = proj(A[0], A[1], Z), [btx, bty] = proj(B[0], B[1], Z);
    ctx.fillStyle = '#0c0c10'; ctx.fillRect(ax - 2, aty, 4, ay - aty); ctx.fillRect(bx - 2, bty, 4, by - bty);
    ctx.fillStyle = '#9090a0'; ctx.fillRect(ax - 1, aty, 2, ay - aty); ctx.fillRect(bx - 1, bty, 2, by - bty);
    const n = Math.max(Math.abs(btx - atx), Math.abs(bty - aty));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(atx + (btx - atx) * i / n), y = Math.round(aty + (bty - aty) * i / n);
      ctx.fillStyle = '#0c0c10'; ctx.fillRect(x - 1, y - 4, 3, isStart ? 9 : 12);
      ctx.fillStyle = ((i >> 2) & 1) ? '#f0f0f0' : (isStart ? '#202020' : '#ff2a6d'); ctx.fillRect(x, y - 3, 1, isStart ? 3 : 7);
      ctx.fillStyle = '#505060'; ctx.fillRect(x, y + (isStart ? 0 : 4), 1, 4);
    }
    if (!isStart) { const mx = Math.round((atx + btx) / 2), my = Math.round((aty + bty) / 2); GR.text(ctx, 'META', mx, my - 14, { align: 'center', color: '#fff', outline: '#000' }); return; }
    for (let j = 0; j < 3; j++) {
      const f = 0.3 + j * 0.2, x = Math.round(atx + (btx - atx) * f), y = Math.round(aty + (bty - aty) * f) + 6;
      let col = '#401010'; if (lights >= 4) col = '#30ff50'; else if (lights > j) col = '#ff2020';
      ctx.fillStyle = '#000'; ctx.fillRect(x - 2, y - 2, 5, 5); ctx.fillStyle = col; ctx.fillRect(x - 1, y - 1, 3, 3);
    }
  }

  // ---------- HUD ----------
  const gradY = (a, b, c) => r => r < 2 ? a : r < 5 ? b : c;
  const HOT = gradY('#fff8a0', '#ffc020', '#ff5010'), COOL = gradY('#e0ffff', '#40e0ff', '#2060ff');
  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(8,4,24,0.78)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#ff2a6d'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillStyle = '#05d9e8'; ctx.fillRect(x, y + 1, 1, h - 2); ctx.fillRect(x + w - 1, y + 1, 1, h - 2);
  }
  function bar(x, y, w, v, label, lw) {
    const col = v > 60 ? '#30e050' : v > 30 ? '#f9f871' : '#ff2a2a';
    GR.text(ctx, label, x, y, { color: v <= 25 && frame % 20 < 10 ? '#ff2a2a' : '#a0a0c0' });
    const bx = x + (lw || 24), bw = w - (lw || 24);
    ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, y, bw + 2, 7);
    ctx.fillStyle = '#202030'; ctx.fillRect(bx, y + 1, bw, 5);
    ctx.fillStyle = col; ctx.fillRect(bx, y + 1, Math.round(bw * Math.max(0, v) / 100), 5);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(bx, y + 1, Math.round(bw * Math.max(0, v) / 100), 1);
  }
  function dmgBars(x, y, w, d) { bar(x, y, w, d.chasis, 'CHA'); bar(x, y + 9, w, d.motor, 'MOT'); bar(x, y + 18, w, d.gomas, 'GOM'); }

  function drawHUD() {
    const p = race.player, st = T.standings(race), pos = st.indexOf(p) + 1, trk = race.trk;
    const dist = trk.finishS - trk.startS, prog = T.clamp(p.p / dist, 0, 1);
    panel(4, 4, 96, 34);
    GR.text(ctx, 'ETAPA ' + (run.stage + 1), 8, 8, { color: '#05d9e8' });
    GR.text(ctx, T.fmt(state === 'countdown' ? 0 : (p.finished ? p.finishTime : race.t)), 8, 17, { color: '#fff' });
    const km = Math.max(0, (dist - p.p) * 0.45 / 1000);
    GR.text(ctx, km.toFixed(1).replace('.', ',') + ' KM', 96, 17, { color: '#f9f871', align: 'right' });
    ctx.fillStyle = '#202030'; ctx.fillRect(8, 28, 88, 5);
    for (const m of trk.marks) { ctx.fillStyle = m.rocks ? '#a05a30' : '#404058'; ctx.fillRect(8 + Math.round((m.s0 - trk.startS) / dist * 88), 28, Math.max(1, Math.round((m.s1 - m.s0) / dist * 88)), 5); }
    for (const c of race.cars) { if (c === p) continue; ctx.fillStyle = T.COLORS[c.color]; ctx.fillRect(8 + Math.round(T.clamp(c.p / dist, 0, 1) * 87), 29, 1, 3); }
    ctx.fillStyle = '#fff'; ctx.fillRect(7 + Math.round(prog * 87), 26, 3, 9);
    // dinero de la etapa
    if (race.cash) GR.text(ctx, '+$' + race.cash, 104, 8, { color: '#7cff4f', outline: '#000' });
    // posición
    panel(W - 74, 4, 70, 38);
    GR.text(ctx, 'POS', W - 70, 8, { color: '#05d9e8' });
    GR.text(ctx, String(pos), W - 28, pos >= 10 ? 10 : 8, { scale: pos >= 10 ? 3 : 4, rows: HOT, shadow: '#400', align: 'right' });
    GR.text(ctx, '°', W - 25, 9, { color: '#fff' });
    GR.text(ctx, '/' + T.NCARS, W - 25, 30, { color: '#a0a0c0' });
    // pendiente y altura (en montaña siempre; en el resto, solo si la cuesta se nota)
    {
      const q = trk.pts[p.i], qa = trk.pts[Math.max(0, p.i - 25)], qb = trk.pts[Math.min(trk.N - 1, p.i + 25)];
      const pct = Math.round(((qb.h || 0) - (qa.h || 0)) / ((qb.s - qa.s) || 1) * 100);
      if (trk.perfil || Math.abs(pct) >= 4) {
        if (pct) GR.text(ctx, (pct > 0 ? '↑ ' : '↓ ') + Math.abs(pct) + '%', W - 6, 46, { align: 'right', color: pct > 0 ? '#ffb040' : '#60c0ff', outline: '#000' });
        if (trk.perfil) { const alt = Math.round(((q.h || 0) - (trk.pts[Math.round(trk.startS / trk.DS)].h || 0)) * 0.45); GR.text(ctx, (alt >= 0 ? '+' : '') + alt + ' M', W - 6, 56, { align: 'right', color: '#d0d0e0', outline: '#000' }); }
      }
    }
    // tabla
    panel(4, 42, 56, 84);
    st.forEach((c, i) => {
      const y = 46 + i * 8;
      ctx.fillStyle = T.COLORS[c.color]; ctx.fillRect(18, y + 1, 5, 5);
      GR.text(ctx, String(i + 1), 8, y, { color: '#a0a0c0' });
      const me = c === p;
      if (!me || frame % 30 < 22) GR.text(ctx, c.name.slice(0, 4), 26, y, { color: c.dead ? '#ff4040' : me ? '#f9f871' : (c.finished ? '#7cff4f' : '#fff') });
    });
    // daño
    panel(4, 129, 96, 31);
    if (hurtFlash > 0) { ctx.fillStyle = 'rgba(255,40,40,' + hurtFlash * 0.5 + ')'; ctx.fillRect(5, 130, 94, 29); }
    dmgBars(8, 132, 88, p.dmg);
    // velocímetro
    const kmh = Math.round(Math.abs(p.vf || 0) * T.KMH);
    panel(W - 102, H - 38, 98, 34);
    GR.text(ctx, String(kmh).padStart(3, ' '), W - 98, H - 34, { scale: 3, rows: p.nitroT > 0 ? COOL : HOT, shadow: '#400' });
    GR.text(ctx, 'KM/H', W - 42, H - 34, { color: '#05d9e8' });
    GR.text(ctx, p.lim ? 'LIM' : p.nitroT > 0 ? 'NITRO' : 'G' + p.gear, W - 42, H - 25, { color: p.lim ? (frame % 20 < 12 ? '#ffe020' : '#806000') : p.nitroT > 0 ? NEON[frame >> 2 & 3] : '#fff' });
    const seg = Math.round(Math.min(1, Math.abs(p.vf || 0) / T.PH.VMAX) * 16);
    for (let i = 0; i < 16; i++) { ctx.fillStyle = i < seg ? (i < 9 ? '#30e050' : i < 13 ? '#f9f871' : '#ff2a2a') : '#202030'; ctx.fillRect(W - 98 + i * 6, H - 11, 5, 4); }
    // minimapa
    panel(4, H - 62, 98, 58);
    ctx.drawImage(mini.cv, 7, H - 62);
    if (run.perks.includes('radar')) for (const o of trk.scen.pickups) if (!o.taken) { const [mx, my] = mini.map(o.x, o.y); ctx.fillStyle = '#7cff4f'; ctx.fillRect(7 + mx, H - 62 + my, 1, 1); }
    for (const c of race.cars.slice().reverse()) {
      const [mx, my] = mini.map(c.x, c.y);
      if (c === p && frame % 20 < 6) continue;
      ctx.fillStyle = '#000'; ctx.fillRect(7 + mx - 2, H - 62 + my - 2, c === p ? 5 : 4, c === p ? 5 : 4);
      ctx.fillStyle = T.COLORS[c.color]; ctx.fillRect(7 + mx - 1, H - 62 + my - 1, c === p ? 3 : 2, c === p ? 3 : 2);
    }
    if (p.wrongT > 1 && state === 'race' && frame % 30 < 18) GR.text(ctx, '¡CONTRAMANO!', W / 2, 60, { align: 'center', scale: 2, color: '#ff2020', outline: '#000' });
    if (p.draft > 0 && state === 'race' && Math.abs(p.vf) > 120) GR.text(ctx, 'REBUFO', W / 2, H - 22, { align: 'center', color: NEON[(frame >> 2) % 6], outline: '#000' });
    if (race.yIn && state === 'race') {
      const on = frame % 24 < 16;
      const bx = 222;
      ctx.fillStyle = '#000'; ctx.fillRect(bx - 56, 3, 112, 31);
      ctx.fillStyle = on ? '#ffe020' : '#a08000'; ctx.fillRect(bx - 55, 4, 110, 29);
      GR.text(ctx, 'BANDERA AMARILLA', bx, 6, { align: 'center', color: '#000' });
      GR.text(ctx, 'LIMITADOR ' + Math.round(T.YLIM * T.KMH) + ' KM/H', bx, 15, { align: 'center', color: '#603000' });
      GR.text(ctx, 'NO ADELANTAR', bx, 24, { align: 'center', color: '#603000' });
      ctx.fillStyle = on ? 'rgba(255,224,32,0.5)' : 'rgba(255,224,32,0.2)'; ctx.fillRect(0, 0, 3, H); ctx.fillRect(W - 3, 0, 3, H);
    }
    if (race.rain) GR.text(ctx, 'LLUVIA', 104, 17, { color: '#80b0ff', outline: '#000' });
    if (race.penalty) GR.text(ctx, '+' + race.penalty + ' S', 104, 26, { color: '#ff4040', outline: '#000' });
    // cartel de sección
    if (banner) {
      const txt = '¡OBSTÁCULOS ADELANTE!';
      const w = GR.textW(txt) + 12, f = banner.t, y = f < 0.2 ? 30 + f / 0.2 * 14 : f > 1.9 ? 44 - (f - 1.9) / 0.3 * 14 : 44;
      ctx.globalAlpha = f > 1.9 ? Math.max(0, 1 - (f - 1.9) / 0.3) : 1;
      ctx.fillStyle = 'rgba(8,4,24,0.8)'; ctx.fillRect(Math.round(W / 2 - w / 2), Math.round(y), w, 11);
      ctx.fillStyle = banner.rocks ? '#ff8040' : '#ff2a6d'; ctx.fillRect(Math.round(W / 2 - w / 2), Math.round(y) + 10, w, 1);
      GR.text(ctx, txt, W / 2, Math.round(y) + 2, { align: 'center', color: banner.rocks ? '#ffb070' : '#d0f8ff' });
      ctx.globalAlpha = 1;
    }
  }

  function drawMsgs() {
    for (const m of msgs) {
      if (m.t < 0) continue;
      if (m.style === 'count') { const s = Math.max(4, Math.round(10 - m.t * 8)); GR.text(ctx, m.text, W / 2, H / 2 - 30 - s * 3, { align: 'center', scale: s, rows: HOT, outline: '#200' }); }
      else if (m.style === 'go') GR.text(ctx, m.text, W / 2, H / 2 - 40, { align: 'center', scale: 7, rows: r => NEON[(r + (frame >> 1)) % 6], outline: '#000', wave: stT * 10, amp: 3 });
      else if (m.style === 'meta') {
        GR.text(ctx, m.text, W / 2, 70, { align: 'center', scale: 5, rows: r => NEON[(r + (frame >> 1)) % 6], outline: '#000', wave: stT * 8, amp: 2 });
        if (m.sub) GR.text(ctx, m.sub, W / 2, 112, { align: 'center', scale: 2, rows: HOT, outline: '#000' });
      } else if (m.style === 'col') {
        GR.text(ctx, m.text, W / 2, 84, { align: 'center', scale: 2, rows: r => ['#ffffff', '#fff4a0', '#ffd020', '#f0b000', '#d09000', '#b07000', '#905000'][r], outline: '#000', wave: stT * 8 });
        GR.text(ctx, m.sub, W / 2, 104, { align: 'center', color: '#fff', outline: '#000' });
      } else if (m.style === 'pen') {
        if (frame % 16 < 11) GR.text(ctx, m.text, W / 2, 84, { align: 'center', scale: 2, color: '#ff2a2a', outline: '#000' });
        GR.text(ctx, m.sub, W / 2, 104, { align: 'center', color: '#fff', outline: '#000' });
      } else if (m.style === 'bad') GR.text(ctx, m.text, W / 2, 80, { align: 'center', scale: 4, color: frame % 16 < 10 ? '#ff2a2a' : '#ffffff', outline: '#000' });
      else GR.text(ctx, m.text, W / 2, 62, { align: 'center', scale: 3, rows: COOL, outline: '#000', wave: stT * 6 });
    }
  }

  // ---------- pantallas ----------
  function bg(theme) {
    const sky = ['#12002a', '#1c0038', '#2a0048', '#3c0858', '#561060'];
    for (let i = 0; i < 5; i++) { ctx.fillStyle = sky[i]; ctx.fillRect(0, i * 45, W, 45); }
    ctx.strokeStyle = 'rgba(255,42,109,0.25)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i < 12; i++) { const y = Math.round(140 + Math.pow(((i + (stT * 0.6) % 1) / 12), 2) * 85) + 0.5; ctx.moveTo(0, y); ctx.lineTo(W, y); }
    for (let i = -10; i <= 10; i++) { ctx.moveTo(W / 2 + i * 8 + 0.5, 140); ctx.lineTo(W / 2 + i * 50 + 0.5, H); }
    ctx.stroke();
  }
  function header(t1, t2) {
    GR.text(ctx, t1, 8, 6, { scale: 2, rows: HOT, outline: '#200' });
    if (t2) GR.text(ctx, t2, W - 8, 10, { align: 'right', color: '#05d9e8' });
    GR.text(ctx, '$' + run.money, W - 8, 20, { align: 'right', color: '#7cff4f' });
  }
  function hints(t) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, H - 11, W, 11); GR.text(ctx, t, W / 2, H - 9, { align: 'center', color: '#a0a0c0' }); }
  function status(x, y, corto, ancho) {
    const pw = ancho || 120;
    panel(x, y, pw, corto ? 70 : 136);
    GR.text(ctx, 'TU AUTO', x + 6, y + 5, { color: '#05d9e8' });
    bar(x + 6, y + 16, pw - 12, run.dmg.chasis, 'CHASIS', 38); bar(x + 6, y + 25, pw - 12, run.dmg.motor, 'MOTOR', 38); bar(x + 6, y + 34, pw - 12, run.dmg.gomas, 'GOMAS', 38);
    GR.text(ctx, 'MOCHILA ' + run.items.length + '/' + run.maxItems, x + 6, y + 46, { color: '#a0a0c0' });
    run.items.slice(0, 8).forEach((id, i) => { ctx.fillStyle = itemColor(id); ctx.fillRect(x + 6 + i * 13, y + 56, 10, 8); ctx.fillStyle = '#000'; ctx.fillRect(x + 6 + i * 13, y + 63, 10, 1); });
    if (corto) return;
    GR.text(ctx, 'MEJORAS', x + 6, y + 70, { color: '#05d9e8' });
    TOUR.UPGRADES.forEach((u, i) => {
      const yy = y + 80 + i * 9, lv = run.up[u.id];
      GR.text(ctx, u.n, x + 6, yy, { color: lv ? '#fff' : '#707088' });
      for (let k = 0; k < 3; k++) { ctx.fillStyle = k < lv ? '#f9f871' : '#303040'; ctx.fillRect(x + 84 + k * 9, yy + 1, 7, 5); }
    });
  }
  function itemColor(id) { return { cinta: '#c0c0c8', soldadora: '#ff9020', bujias: '#f0d020', motorrec: '#ff4040', parche: '#808088', gomasnuevas: '#303038', kit: '#30e050' }[id] || '#fff'; }
  const NODE_COL = { carrera: '#ff2a6d', rally: '#d08040', taller: '#40a0ff', evento: '#b060ff', campamento: '#30c060', jefe: '#ffd020' };
  const NODE_GLY = { carrera: '>', rally: '*', taller: '$', evento: '?', campamento: '^', jefe: '!' };
  function nodeIcon(x, y, n, hi, dim) {
    const r = n.type === 'jefe' ? 10 : 8;
    ctx.fillStyle = '#000'; ctx.fillRect(x - r - 1, y - r - 1, r * 2 + 2, r * 2 + 2);
    ctx.fillStyle = dim ? '#303040' : NODE_COL[n.type]; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    if (n.type === 'carrera' && !dim) {
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) & 1) { ctx.fillStyle = '#fff'; ctx.fillRect(x - 4 + i * 2, y - 4 + j * 2, 2, 2); }
    } else GR.text(ctx, NODE_GLY[n.type], x + 1, y - 3, { align: 'center', color: dim ? '#606070' : '#000' });
    if (hi) { ctx.strokeStyle = frame % 20 < 12 ? '#fff' : '#f9f871'; ctx.lineWidth = 1; ctx.strokeRect(x - r - 3.5, y - r - 3.5, r * 2 + 7, r * 2 + 7); }
  }
  // ---------- mapa del road trip: las Américas con la ruta ----------
  const AMERICAS = [[-166, 68.5], [-163, 70.5], [-156, 71.3], [-148, 70.4], [-141, 69.7], [-130, 70], [-120, 69], [-110, 68], [-100, 68], [-94, 70], [-90, 68], [-82, 67], [-80, 63], [-94, 61], [-93, 58], [-88, 56], [-82, 55], [-79, 52], [-78, 56], [-77, 60], [-72, 62], [-65, 60], [-61, 56], [-57, 52], [-55, 50], [-53, 47], [-60, 47], [-61, 45.5], [-66, 44.5], [-70, 43.5], [-70, 41.7], [-74, 40.5], [-76, 38], [-76, 35], [-79, 33.5], [-81, 31.5], [-80.5, 28], [-80, 25.5], [-81.5, 25.5], [-82.7, 28], [-84, 30], [-87, 30.3], [-89.5, 30], [-91, 29.3], [-94, 29.6], [-97, 27.8], [-97.3, 25], [-97.8, 22], [-96.5, 19.5], [-94.5, 18.2], [-91.5, 18.5], [-90.4, 21], [-87, 21.5], [-87.6, 18.5], [-88.2, 16], [-86, 15.9], [-83.3, 15], [-83.6, 11], [-82, 9.2], [-79.5, 9.6], [-77.5, 8.6],
    [-76, 9.5], [-75.5, 10.8], [-73, 11.3], [-71.5, 12.4], [-70, 11.5], [-68, 10.5], [-64, 10.6], [-61, 10.6], [-60, 8.5], [-57, 6], [-53, 5.5], [-51, 4], [-50, 1.5], [-49.5, 0], [-48, -1], [-44, -2.5], [-40, -2.8], [-37, -4.8], [-35, -6], [-35, -9], [-37, -11.5], [-39, -13.5], [-39, -17.5], [-40.5, -21], [-42, -23], [-45, -23.8], [-48.5, -26], [-48.7, -28.5], [-50.5, -31], [-53, -34], [-55, -34.8], [-58.5, -34.2], [-57, -36.5], [-57.5, -38.2], [-62, -38.8], [-62.3, -40.5], [-65, -41], [-65, -42.5], [-64.5, -43], [-65.5, -45], [-67.5, -46.3], [-66, -47.8], [-67.8, -49.5], [-69, -51.5], [-68.4, -52.4], [-66.5, -54.5], [-65, -55], [-67, -55.2], [-69.5, -55.5], [-71.5, -54.6], [-74, -52.5], [-75.3, -50], [-75.5, -47], [-74, -44], [-73.5, -41.5], [-73.6, -38], [-72.6, -35], [-71.5, -32], [-71.4, -28], [-70.4, -24], [-70.2, -20], [-70.3, -18.4], [-72, -17], [-75.2, -15.3], [-76.3, -13.5], [-77.2, -12], [-79, -8.5], [-80.5, -6.5], [-81.2, -4.5], [-80.2, -3.3], [-80.9, -2], [-80, 0], [-80, 1], [-79, 1.5], [-78, 2.8], [-77.3, 4], [-77.4, 6.8], [-78, 7.5],
    [-80, 7.4], [-81.6, 8], [-83, 8.3], [-85.7, 10], [-85.7, 11], [-87.5, 13], [-89.5, 13.5], [-91.5, 14], [-93, 15.5], [-94.8, 16.2], [-96.5, 15.7], [-98.5, 16.3], [-101, 17.2], [-103.5, 18.3], [-105.5, 20.3], [-105.4, 22.5], [-106.5, 23.5], [-108.5, 25.3], [-109.5, 27], [-111, 28.5], [-112.5, 30], [-113.8, 31.4],
    [-114.8, 31.8], [-114.5, 30], [-112.5, 27.5], [-110, 24], [-110.3, 23], [-112, 24.8], [-114, 28], [-115.6, 30.3], [-117.1, 32.5],
    [-118.4, 34], [-120.6, 34.6], [-121.9, 36.6], [-122.5, 37.8], [-123.8, 39.5], [-124.2, 42], [-124, 46.2], [-124.7, 48.4], [-125, 50], [-127.5, 51], [-130, 54], [-133, 57], [-136, 58.5], [-139.5, 59.6], [-143, 60], [-146.5, 61], [-150, 61], [-151.5, 59.5], [-154, 58.5], [-157, 57.2], [-160, 55.8], [-163, 54.8], [-164.7, 54.6], [-161, 56.2], [-158, 58.6], [-161.8, 59.2], [-164.5, 60.5], [-165.4, 62.5], [-164, 63.5], [-161, 64.3], [-166, 64.6], [-168, 65.6], [-164, 66.5]];
  const MAPX = 6, MAPY = 30;
  const geo = (lon, lat) => [MAPX + 2 + (lon + 170) * 0.8, MAPY + 2 + (72 - lat) * 1.36];
  let mapaCv = null;
  function landCol(lon, lat, h) {
    let c;
    if (lat > 60 || lat < -52) c = ['#dfe8f2', '#c8d6e6'];
    else if (lat > 47) c = ['#2e7a3a', '#26682f'];
    else if (lat > 29) c = lon < -104 ? ['#c8a050', '#b89044'] : ['#5a9a3a', '#4c8a32'];
    else if (lat > 15) c = lon < -97 ? ['#d8a060', '#c89050'] : ['#2a8a34', '#227a2c'];
    else if (lat > -24) c = lon < -76 + (lat < -5 ? 6 : 0) && lat < 8 ? ['#a8845a', '#98744c'] : ['#2a8a34', '#227a2c'];
    else if (lat > -40) c = lon < -68.5 ? ['#a89a5a', '#988a4c'] : ['#9aaa50', '#8a9a44'];
    else c = ['#c8b060', '#b8a052'];
    return c[h < 0.5 ? 0 : 1];
  }
  function mapaAmericas() {
    if (mapaCv) return mapaCv;
    const w = 118, h = 182, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d'), P = AMERICAS.map(([lo, la]) => geo(lo, la));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const X = x + MAPX + 0.5, Y = y + MAPY + 0.5;
      let inside = false;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
        const [xi, yi] = P[i], [xj, yj] = P[j];
        if ((yi > Y) !== (yj > Y) && X < (xj - xi) * (Y - yi) / (yj - yi) + xi) inside = !inside;
      }
      const lon = (X - MAPX - 2) / 0.8 - 170, lat = 72 - (Y - MAPY - 2) / 1.36;
      c.fillStyle = inside ? landCol(lon, lat, GR.hash(x >> 1, y >> 1)) : ((x + y) % 4 === 0 ? '#14306a' : '#102458');
      c.fillRect(x, y, 1, 1);
    }
    // costa
    const img = c.getImageData(0, 0, w, h), d = img.data, agua = (x, y) => d[(y * w + x) * 4 + 2] > d[(y * w + x) * 4] + 30;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (!agua(x, y) && (agua(x - 1, y) || agua(x + 1, y) || agua(x, y - 1) || agua(x, y + 1))) { c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x, y, 1, 1); }
    mapaCv = cv; return cv;
  }
  // recorrido completo: [pueblo, tramo, fila] (fila -1 = punto de partida del tramo)
  function recorrido() {
    const L = [[E.SALIDA, 0, -1]];
    E.REGIONES.forEach((reg, ri) => { if (reg.desde) L.push([reg.desde, ri, -1]); reg.pueblos.forEach((p, k) => L.push([p, ri, k])); });
    return L;
  }
  function drawAmericas() {
    panel(MAPX - 2, MAPY - 2, 122, 186);
    ctx.drawImage(mapaAmericas(), MAPX, MAPY);
    const L = recorrido();
    let aqui = L.findIndex(([, ri, k]) => ri === run.region && k === run.row);
    if (aqui < 0) aqui = L.findIndex(([, ri, k]) => ri === run.region - 1 && k === E.REGIONES[ri].pueblos.length - 1);
    if (aqui < 0 || (run.row < 0 && E.REGIONES[run.region].desde)) aqui = L.findIndex(([, ri, k]) => ri === run.region && k === -1);
    if (aqui < 0) aqui = 0;
    for (let i = 1; i < L.length; i++) {
      const [a] = L[i - 1], [b] = L[i], [ax, ay] = geo(a.lon, a.lat), [bx, by] = geo(b.lon, b.lat);
      const mar = L[i][2] === -1 && i > 1; // el barco por el Darién
      ctx.strokeStyle = i <= aqui ? '#f9f871' : mar ? '#60a0ff' : '#ff2a6d'; ctx.lineWidth = 1;
      if (mar || i > aqui) ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.moveTo(Math.round(ax) + 0.5, Math.round(ay) + 0.5); ctx.lineTo(Math.round(bx) + 0.5, Math.round(by) + 0.5); ctx.stroke();
      ctx.setLineDash([]);
    }
    L.forEach(([p, ri], i) => { const [x, y] = geo(p.lon, p.lat); ctx.fillStyle = ri === run.region ? '#ffffff' : i <= aqui ? '#f9f871' : '#ff6ec7'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2); });
    const [cx, cy] = geo(L[aqui][0].lon, L[aqui][0].lat);
    if (frame % 24 < 16) { ctx.fillStyle = '#000'; ctx.fillRect(Math.round(cx) - 3, Math.round(cy) - 3, 6, 6); ctx.fillStyle = '#ff2020'; ctx.fillRect(Math.round(cx) - 2, Math.round(cy) - 2, 4, 4); }
    GR.text(ctx, 'ALASKA', MAPX + 4, MAPY + 4, { color: '#ffffff', outline: '#102458' });
    GR.text(ctx, 'USHUAIA', MAPX + 116, MAPY + 172, { align: 'right', color: '#ffffff', outline: '#102458' });
  }
  function drawMap() {
    bg();
    const reg = TOUR.region(run), map = run.map[run.region];
    header('TRAMO ' + (run.region + 1) + '/' + E.REGIONES.length + ' · ' + reg.nombre, 'GENERAL ' + (run.stage ? TOUR.gcPos(run) + '°' : '-'));
    drawAmericas();
    const opts = TOUR.options(run);
    const step = 222 / map.rows.length, colX = r => Math.round(152 + (r + 1) * step), rowY = (r, i) => { const n = map.rows[r].length; return 98 + (i - (n - 1) / 2) * 32; };
    // pueblos de cada columna
    const ini = TOUR.tramo(run, null, 0).inicio;
    GR.text(ctx, ini.n.split(' ')[0], 152, 46, { align: 'center', color: '#a0a0c0' });
    map.rows.forEach((row, r) => {
      const pu = reg.pueblos[Math.min(r, reg.pueblos.length - 1)], prox = r === run.row + 1;
      const tx = Math.min(colX(r), 396 - GR.textW(pu.n) / 2);
      GR.text(ctx, pu.n, tx, r % 2 ? 46 : 36, { align: 'center', color: prox ? '#f9f871' : r <= run.row ? '#706890' : '#d0d0e0', outline: '#000' });
    });
    // conexiones
    ctx.strokeStyle = '#504070'; ctx.lineWidth = 1; ctx.beginPath();
    map.rows.forEach((row, r) => row.forEach((n, i) => (n.next || []).forEach(j => { ctx.moveTo(colX(r) + 0.5, rowY(r, i) + 0.5); ctx.lineTo(colX(r + 1) + 0.5, rowY(r + 1, j) + 0.5); })));
    ctx.stroke();
    // posición actual
    ctx.strokeStyle = '#504070'; ctx.beginPath(); map.rows[0].forEach((n, i) => { ctx.moveTo(152.5, 98.5); ctx.lineTo(colX(0) + 0.5, rowY(0, i) + 0.5); }); ctx.stroke();
    map.rows.forEach((row, r) => row.forEach((n, i) => {
      const reach = r === run.row + 1 && opts.includes(i), hi = reach && opts[mapSel] === i;
      const past = r <= run.row, cur = r === run.row && i === run.col;
      nodeIcon(colX(r), rowY(r, i), n, hi, past && !cur || (!reach && r === run.row + 1));
      if (cur) GR.text(ctx, '↓', colX(r), rowY(r, i) - 22, { align: 'center', color: '#fff' });
    }));
    ctx.fillStyle = '#000'; ctx.fillRect(148, 94, 9, 9);
    ctx.fillStyle = run.row < 0 ? (frame % 20 < 12 ? '#fff' : '#f9f871') : '#504070'; ctx.fillRect(149, 95, 7, 7);
    // descripción
    const n = map.rows[run.row + 1] && map.rows[run.row + 1][opts[mapSel]];
    panel(130, 140, 170, 70);
    if (n) {
      const info = TOUR.NODOS[n.type], tr = TOUR.tramo(run, n, run.row + 1);
      GR.text(ctx, info.n, 136, 145, { scale: 2, color: NODE_COL[n.type] });
      GR.text(ctx, 'A ' + tr.destino.n, 136, 162, { color: '#f9f871' });
      GR.wrap(info.d, 26).slice(0, 2).forEach((l, k) => GR.text(ctx, l, 136, 172 + k * 9, { color: '#fff' }));
      if (n.type === 'carrera' || n.type === 'rally' || n.type === 'jefe') GR.text(ctx, tr.destino.perfil === 'subida' ? 'SUBIDA DE MONTAÑA' : tr.destino.perfil === 'bajada' ? 'BAJADA DE MONTAÑA' : tr.destino.costa ? 'CAMINO COSTERO' : ((GR.TEMAS[tr.destino.tema] || {}).n || ''), 136, 199, { color: tr.destino.perfil ? '#ffb040' : '#a0a0c0' });
    }
    status(302, 140, true, 94);
    hints('→ SEGUIR VIAJE   ← MOCHILA');
  }
  function drawList(x, y, w, rows, rowH) {
    rows.forEach((r, i) => {
      const yy = y + i * rowH, me = i === sel;
      if (me) { ctx.fillStyle = frame % 30 < 20 ? 'rgba(255,42,109,0.45)' : 'rgba(255,42,109,0.3)'; ctx.fillRect(x, yy - 2, w, rowH); }
      GR.text(ctx, (me ? '> ' : '  ') + r.t, x + 3, yy, { color: r.ok === false ? '#606070' : me ? '#fff' : '#d0d0e0' });
      if (r.price != null) GR.text(ctx, r.price ? '$' + r.price : 'OK', x + w - 4, yy, { align: 'right', color: r.ok ? '#7cff4f' : r.price ? '#a04040' : '#606070' });
      if (r.lv != null) for (let k = 0; k < 3; k++) { ctx.fillStyle = k < r.lv ? '#f9f871' : '#303040'; ctx.fillRect(x + w - 60 + k * 6, yy + 1, 4, 5); }
    });
  }
  function drawShop() {
    bg();
    header(node && node.type === 'jefe' ? 'TALLER DE FIN DE TRAMO' : 'TALLER', node ? TOUR.tramo(run, node).destino.n : null);
    const rows = shopRows(), x = 8, w = 232, rh = 10;
    panel(x, 28, w, rows.length * rh + 6);
    rows.forEach((r, i) => {
      const y = 32 + i * rh, me = i === sel;
      if (r.head) {
        ctx.fillStyle = '#1c1440'; ctx.fillRect(x + 2, y - 1, w - 4, rh - 1);
        GR.text(ctx, r.head, x + 6, y, { color: '#05d9e8' });
        GR.text(ctx, r.sub, x + w - 6, y, { align: 'right', color: '#8078a8' });
        return;
      }
      if (me) { ctx.fillStyle = frame % 30 < 20 ? 'rgba(255,42,109,0.45)' : 'rgba(255,42,109,0.3)'; ctx.fillRect(x + 2, y - 2, w - 4, rh); }
      const gris = r.ok === false && !r.exit;
      GR.text(ctx, (me ? '>' : ' ') + r.t, x + 6, y, { color: r.exit ? '#f9f871' : gris ? '#8080a0' : me ? '#fff' : '#d0d0e0' });
      const mx = x + 104;
      if (r.kind === 'rep') {
        const col = r.val > 60 ? '#30e050' : r.val > 30 ? '#f9f871' : '#ff2a2a';
        ctx.fillStyle = '#000'; ctx.fillRect(mx - 1, y, 52, 7); ctx.fillStyle = '#202030'; ctx.fillRect(mx, y + 1, 50, 5);
        ctx.fillStyle = col; ctx.fillRect(mx, y + 1, Math.round(50 * r.val / 100), 5);
        GR.text(ctx, r.val + '%', mx + 56, y, { color: col });
      }
      if (r.kind === 'up') for (let k = 0; k < 3; k++) { ctx.fillStyle = '#000'; ctx.fillRect(mx + k * 10 - 1, y, 9, 7); ctx.fillStyle = k < r.lv ? '#f9f871' : '#303040'; ctx.fillRect(mx + k * 10, y + 1, 7, 5); }
      if (r.kind === 'item') GR.text(ctx, r.ef, mx, y, { color: '#a0a0c0' });
      if (!r.exit && r.kind !== 'nada') {
        const txt = r.price ? '$' + r.price : r.done ? 'OK' : r.lv >= 3 ? 'MÁX' : '';
        GR.text(ctx, txt, x + w - 6, y, { align: 'right', color: r.price ? (r.ok ? '#7cff4f' : '#a04040') : '#606070' });
      }
    });
    // detalle de lo elegido
    const r = rows[sel] || rows[0], dx = 244, dw = 150;
    panel(dx, 28, dw, 182);
    let y = 34;
    GR.wrap(r.title || r.t || '', 23).forEach(l => { GR.text(ctx, l, dx + 6, y, { rows: HOT }); y += 10; });
    y += 2;
    GR.wrap(r.d || '', 23).forEach(l => { GR.text(ctx, l, dx + 6, y, { color: '#d0d0e0' }); y += 9; });
    if (r.cambio) {
      y += 4; ctx.fillStyle = '#3a2a70'; ctx.fillRect(dx + 4, y - 2, dw - 8, 1);
      GR.wrap(r.cambio, 23).forEach(l => { GR.text(ctx, l, dx + 6, y + 2, { color: '#f9f871' }); y += 9; });
      y += 2;
    }
    if (r.kind === 'item') GR.text(ctx, 'MOCHILA ' + run.items.length + '/' + run.maxItems, dx + 6, y + 4, { color: '#a0a0c0' });
    // precio / qué falta
    let pie = null, pc = '#a0a0c0';
    if (r.exit) { pie = '→ SALIR'; pc = '#f9f871'; }
    else if (r.falta) pie = r.falta;
    else if (r.price != null && run.money < r.price) { pie = 'TE FALTAN $' + (r.price - run.money); pc = '#ff4040'; }
    else if (r.price != null) { pie = '→ COMPRAR: $' + r.price; pc = '#7cff4f'; }
    ctx.fillStyle = '#3a2a70'; ctx.fillRect(dx + 4, 181, dw - 8, 1);
    if (pie) GR.text(ctx, pie, dx + 6, 186, { color: pc });
    GR.text(ctx, 'TIENES $' + run.money, dx + 6, 197, { color: '#7cff4f' });
    if (shopMsg && frame - shopMsg.t0 < 100) {
      ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(dx + 3, 166, dw - 6, 13);
      GR.text(ctx, GR.wrap(shopMsg.t, 23)[0], dx + dw / 2, 169, { align: 'center', color: frame % 16 < 11 ? shopMsg.c : '#fff' });
    }
    hints('↑↓ ELEGIR   → COMPRAR   ← SALIR');
  }
  function drawBag() {
    bg(); header('MOCHILA', null);
    const rows = run.items.map(id => ({ t: TOUR.ITEMS[id].n, d: '→ USAR AHORA: ' + TOUR.ITEMS[id].d })).concat([{ t: 'VOLVER', d: '' }]);
    panel(8, 30, 200, rows.length * 12 + 8);
    drawList(10, 35, 196, rows, 12);
    if (rows[sel] && rows[sel].d) { panel(8, 186, 200, 24); GR.text(ctx, rows[sel].d, 14, 194, { color: '#fff' }); }
    if (!run.items.length) GR.text(ctx, 'NO TIENES REPUESTOS', 14, 60, { color: '#a0a0c0' });
    GR.wrap('EN CARRERA SE USAN SOLOS CUANDO UNA PIEZA BAJA DE 45-50%.', 33).forEach((l, i) => GR.text(ctx, l, 14, 150 + i * 9, { color: '#05d9e8' }));
    status(274, 30);
    if (run.perks.length) { panel(274, 170, 120, 12 + run.perks.length * 9); run.perks.forEach((id, i) => GR.text(ctx, TOUR.PERKS.find(p => p.id === id).n, 280, 175 + i * 9, { color: '#f9f871' })); }
    hints('↑↓ ELEGIR   → USAR   ← VOLVER');
  }
  function drawEventLike(title, desc, rows, result) {
    bg(); header(title, null);
    panel(8, 30, 262, 150);
    GR.wrap(desc, 41).forEach((l, i) => GR.text(ctx, l, 14, 38 + i * 10, { color: '#fff' }));
    if (result) {
      GR.wrap(result, 41).forEach((l, i) => GR.text(ctx, l, 14, 100 + i * 10, { rows: HOT }));
      hints('→ CONTINUAR');
    } else {
      drawList(12, 100, 254, rows, 13);
      hints('↑↓ ELEGIR   → ACEPTAR');
    }
    status(274, 30);
  }
  function drawPrep() {
    bg();
    const sp = race.params, reg = TOUR.region(run);
    header('ETAPA ' + (run.stage + 1) + ' · ' + TOUR.NODOS[sp.tipo].n, reg.nombre);
    panel(8, 30, 206, 132); ctx.drawImage(bigMini.cv, 11, 34);
    panel(218, 30, 176, 132);
    GR.text(ctx, 'RUTA', 224, 35, { color: '#05d9e8' });
    GR.text(ctx, 'DE ' + sp.origen, 224, 46, { color: '#d0d0e0' });
    GR.text(ctx, 'A  ' + sp.destino, 224, 56, { color: '#f9f871' });
    GR.text(ctx, ((GR.TEMAS[sp.tema] || {}).n || '') + (sp.costa ? ' · COSTA' : ''), 224, 68, { color: '#a0a0c0' });
    if (sp.perfil) GR.text(ctx, sp.perfil === 'subida' ? 'SUBIDA DE MONTAÑA' : 'BAJADA DE MONTAÑA', 388, 35, { align: 'right', color: sp.perfil === 'subida' ? '#ffb040' : '#60c0ff' });
    GR.text(ctx, 'EN EL CAMINO', 224, 82, { color: '#05d9e8' });
    const cuenta = {};
    race.trk.marks.forEach(m => { cuenta[m.n] = (cuenta[m.n] || 0) + 1; });
    Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a]).slice(0, 7).forEach((k, i) => {
      GR.text(ctx, k, 224, 93 + i * 9, { color: '#fff' });
      GR.text(ctx, '×' + cuenta[k], 388, 93 + i * 9, { align: 'right', color: '#a0a0c0' });
    });
    const km = (race.trk.finishS - race.trk.startS) * 0.45 / 1000;
    GR.text(ctx, km.toFixed(1).replace('.', ',') + ' KM · LARGAS ' + ((race.cars.indexOf(race.player)) + 1) + '°', 14, 168, { color: '#f9f871' });
    dmgBars(14, 180, 120, run.dmg);
    GR.text(ctx, race.rain ? 'CLIMA: LLUVIA (MENOS AGARRE)' : 'CLIMA: DESPEJADO', 150, 168, { color: race.rain ? '#80b0ff' : '#a0a0c0' });
    if (run.ritmo) GR.text(ctx, 'RITMO RIVAL ' + (run.ritmo > 0 ? '+' : '') + Math.round(run.ritmo * 100) + '%', 150, 178, { color: run.ritmo > 0 ? '#ff6040' : '#80b0ff' });
    const left = ground.queue.filter(q => q[2] <= prepS).length;
    if (left) GR.text(ctx, 'PREPARANDO PISTA ' + Math.round(100 * (1 - left / prepTot)) + '%', 300, 186, { align: 'center', color: '#a0a0c0' });
    else if (frame % 40 < 28) GR.text(ctx, 'PULSA ↑ PARA LARGAR', 300, 180, { align: 'center', rows: HOT, outline: '#200' });
    hints('↑ LARGAR   ← MOCHILA (USAR REPUESTOS)');
  }
  function drawStageRes() {
    bg(); header('ETAPA ' + run.stage + ' TERMINADA', null);
    const res = T.results(race);
    panel(8, 30, 186, 128);
    GR.text(ctx, 'ETAPA', 14, 35, { color: '#05d9e8' });
    res.forEach((r, i) => {
      const y = 46 + i * 11, me = r.car.isPlayer;
      if (me) { ctx.fillStyle = 'rgba(255,42,109,0.4)'; ctx.fillRect(10, y - 2, 182, 10); }
      GR.text(ctx, (i + 1) + '°', 14, y, { color: '#a0a0c0' });
      ctx.fillStyle = T.COLORS[r.car.color]; ctx.fillRect(34, y, 6, 6);
      GR.text(ctx, r.car.name, 44, y, { color: me ? '#f9f871' : '#fff' });
      GR.text(ctx, i === 0 ? T.fmt(r.time) : '+' + (r.time - res[0].time).toFixed(1), 188, y, { align: 'right', color: r.est ? '#806080' : '#7cff4f' });
    });
    panel(198, 30, 196, 72);
    GR.text(ctx, 'DINERO', 204, 35, { color: '#05d9e8' });
    out.lines.forEach((l, i) => { GR.text(ctx, l[0], 204, 46 + i * 9, { color: '#fff' }); GR.text(ctx, (l[1] >= 0 ? '+$' : '-$') + Math.abs(l[1]), 388, 46 + i * 9, { align: 'right', color: l[1] >= 0 ? '#7cff4f' : '#ff4040' }); });
    GR.text(ctx, 'TOTAL $' + run.money, 388, 92, { align: 'right', rows: HOT });
    panel(198, 106, 196, 56);
    GR.text(ctx, 'GENERAL', 204, 111, { color: '#05d9e8' });
    const gc = TOUR.gcTable(run), me = gc.findIndex(r => r.key === 'p');
    const show = [0, 1, 2].concat(me > 2 ? [me] : []);
    show.forEach((k, i) => { const r = gc[k]; GR.text(ctx, (k + 1) + '° ' + r.name, 204, 122 + i * 9, { color: r.key === 'p' ? '#f9f871' : '#fff' }); GR.text(ctx, k === 0 ? T.fmt(r.time) : '+' + (r.time - gc[0].time).toFixed(1), 388, 122 + i * 9, { align: 'right', color: '#a0a0c0' }); });
    if (out.collected) GR.text(ctx, '¡NUEVO AUTO EN TU COLECCIÓN: ' + TOUR.COLECCION.find(c => c.id === out.collected).n + '!', 200, 194, { align: 'center', color: '#ffd020' });
    if (out.items.length) GR.text(ctx, 'REPUESTOS: ' + out.items.map(id => TOUR.ITEMS[id].n).join(', '), 8, 164, { color: '#ff6ec7' });
    dmgBars(8, 176, 140, run.dmg);
    if (out.ritmoD) GR.text(ctx, out.ritmoD > 0 ? 'LOS RIVALES SUBEN EL RITMO +' + out.ritmoD + '%' : 'LOS RIVALES AFLOJAN ' + out.ritmoD + '%', 300, 168, { align: 'center', color: out.ritmoD > 0 ? '#ff6040' : '#80b0ff' });
    if (stT > 0.8 && frame % 40 < 28) GR.text(ctx, 'PULSA → PARA SEGUIR', 300, 186, { align: 'center', rows: HOT });
  }
  function drawPerk() {
    bg(); header('¡TRAMO SUPERADO!', TOUR.region(run).nombre);
    const sig = E.REGIONES[run.region + 1];
    GR.text(ctx, sig && sig.nota ? sig.nota : 'ELIGE UNA VENTAJA PARA EL RESTO DEL VIAJE', W / 2, 36, { align: 'center', color: sig && sig.nota ? '#60c0ff' : '#fff' });
    if (sig && sig.nota) GR.text(ctx, 'ELIGE UNA VENTAJA PARA EL RESTO DEL VIAJE', W / 2, 172, { align: 'center', color: '#fff' });
    perks.forEach((pk, i) => {
      const x = 14 + i * 128, me = i === sel;
      panel(x, 52, 118, 110);
      if (me) { ctx.strokeStyle = frame % 20 < 12 ? '#fff' : '#f9f871'; ctx.strokeRect(x - 2.5, 49.5, 123, 116); }
      GR.text(ctx, pk.n, x + 59, 62, { align: 'center', rows: me ? HOT : COOL });
      GR.wrap(pk.d, 18).forEach((l, k) => GR.text(ctx, l, x + 6, 82 + k * 10, { color: '#fff' }));
    });
    hints('↑↓ ELEGIR   → TOMAR');
  }
  function drawEnd(won) {
    bg();
    const t = won ? (run.finalPos === 1 ? '¡CAMPEÓN DEL TOUR!' : 'TOUR COMPLETADO') : '¡FIN DEL TOUR!';
    GR.text(ctx, t, W / 2, 26, { align: 'center', scale: 3, rows: won ? HOT : r => r < 3 ? '#ff8080' : '#ff2a2a', outline: '#000', wave: stT * 6 });
    panel(60, 62, 280, 120);
    const lines = [
      ['LLEGASTE HASTA', run.won ? 'USHUAIA' : (TOUR.region(run).pueblos[Math.max(0, run.row)] || {}).n || TOUR.region(run).nombre],
      ['ETAPAS CORRIDAS', String(run.stage)],
      ['POSICIÓN EN LA GENERAL', (run.finalPos || TOUR.gcPos(run)) + '°'],
      ['DINERO', '$' + run.money],
      ['VENTAJAS', run.perks.length ? run.perks.map(id => TOUR.PERKS.find(p => p.id === id).n).join(', ').slice(0, 22) : '-'],
      ['TOURS GANADOS', String(rec.wins)],
    ];
    lines.forEach(([a, b], i) => { GR.text(ctx, a, 70, 72 + i * 15, { color: '#a0a0c0' }); GR.text(ctx, b, 330, 72 + i * 15, { align: 'right', color: '#fff' }); });
    if (!won) GR.text(ctx, 'TU AUTO QUEDÓ DESTRUIDO EN LA RUTA', W / 2, 190, { align: 'center', color: '#ff8080' });
    else GR.text(ctx, '¡DE ALASKA AL FIN DEL MUNDO!', W / 2, 190, { align: 'center', rows: HOT });
    if (stT > 1.5 && frame % 40 < 28) GR.text(ctx, 'PULSA ↑ PARA VOLVER', W / 2, 204, { align: 'center', rows: HOT });
  }

  function drawTitle() {
    const hz = 128;
    const sky = ['#12002a', '#1c0038', '#2a0048', '#3c0858', '#561060', '#7a1868', '#a02468', '#c83a60', '#e85a50', '#f88040'];
    for (let i = 0; i < sky.length; i++) { const y0 = Math.round(i * hz / sky.length), y1 = Math.round((i + 1) * hz / sky.length); ctx.fillStyle = sky[i]; ctx.fillRect(0, y0, W, y1 - y0); }
    for (let i = 0; i < 50; i++) { const x = GR.hash(i, 1) * W | 0, y = GR.hash(i, 2) * 60 | 0; if ((frame + i * 7) % 60 > 4) { ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 1, 1); } }
    const sx = W / 2, sy = hz - 6, R = 46;
    for (let y = -R; y <= 0; y++) {
      const w = Math.floor(Math.sqrt(R * R - y * y));
      if ((-y) < 26 && ((Math.floor((-y + stT * 6) / 4) % 3) === 0)) continue;
      const t = (y + R) / R; ctx.fillStyle = t < 0.35 ? '#fff060' : t < 0.6 ? '#ffb030' : t < 0.8 ? '#ff6a40' : '#ff2a80'; ctx.fillRect(sx - w, sy + y, w * 2, 1);
    }
    for (let x = 0; x < W; x++) {
      const h = 10 + Math.abs(Math.sin(x * 0.03) * 10 + Math.sin(x * 0.07 + 1) * 5) * (Math.abs(x - W / 2) > 60 ? 1 : 0.35);
      ctx.fillStyle = '#3a1030'; ctx.fillRect(x, hz - h, 1, h); ctx.fillStyle = '#ff9a40'; ctx.fillRect(x, hz - h, 1, 1);
    }
    ctx.fillStyle = '#0a0018'; ctx.fillRect(0, hz, W, H - hz);
    ctx.fillStyle = '#ff2a6d'; ctx.fillRect(0, hz, W, 1);
    for (let i = 0; i < 14; i++) { const z = ((i + (stT * 2.2) % 1) / 14); ctx.fillStyle = z > 0.5 ? '#ff2a6d' : '#a01870'; ctx.fillRect(0, Math.round(hz + Math.pow(z, 2.2) * (H - hz)), W, 1); }
    ctx.strokeStyle = '#c01c78'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = -14; i <= 14; i++) { ctx.moveTo(W / 2 + i * 6 + 0.5, hz); ctx.lineTo(W / 2 + i * 60 + 0.5, H); }
    ctx.stroke();
    const s = titleCar(Math.floor(stT * 7) % 32);
    ctx.globalAlpha = 0.45; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(W / 2, 182, 56, 15, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.drawImage(s.cv, Math.round(W / 2 - s.ox), Math.round(178 - s.oy));
    const chrome = r => ['#ffffff', '#d0f8ff', '#80e8ff', '#30a0ff', '#ff60c0', '#ff9040', '#ffe060'][r];
    GR.text(ctx, 'TURBO 40', W / 2 + 3, 18 + 3, { align: 'center', scale: 6, color: '#2a0040' });
    GR.text(ctx, 'TURBO 40', W / 2, 18, { align: 'center', scale: 6, rows: chrome, outline: '#12002a' });
    GR.text(ctx, '* ROAD TRIP *', W / 2, 62, { align: 'center', scale: 2, rows: r => NEON[(r + (frame >> 3)) % 6], outline: '#000' });
    GR.text(ctx, 'DE ALASKA A TIERRA DEL FUEGO', W / 2, 79, { align: 'center', color: '#ffffff', outline: '#000' });
    if (frame % 50 < 34) GR.text(ctx, 'PULSA ↑ PARA EMPEZAR', W / 2, 95, { align: 'center', scale: 2, rows: HOT, outline: '#200' });
    const own = rec.owned.length;
    GR.text(ctx, (own > 1 ? '← ' : '') + liv().n + (own > 1 ? ' →' : ''), W / 2, 115, { align: 'center', color: '#fff', outline: '#000' });
    GR.text(ctx, 'COLECCIÓN ' + own + '/' + TOUR.COLECCION.length + ' · BUSCA AUTOS DORADOS EN LA PISTA', W / 2, 202, { align: 'center', color: '#05d9e8', outline: '#000' });
    GR.text(ctx, 'TOURS: ' + rec.runs + '   GANADOS: ' + rec.wins + '   M: SONIDO', W / 2, 213, { align: 'center', color: '#a080c0', outline: '#000' });
  }

  function draw() {
    const S = state;
    if (S === 'loading') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); GR.text(ctx, 'CARGANDO...', W / 2, H / 2 - 4, { align: 'center', color: '#05d9e8' }); }
    else if (S === 'title') drawTitle();
    else if (S === 'map') drawMap();
    else if (S === 'shop') drawShop();
    else if (S === 'bag') drawBag();
    else if (S === 'event') drawEventLike(ev.t, ev.d, ev.ops.map(o => ({ t: o.t, ok: !o.ok || o.ok(run) })), evResult);
    else if (S === 'camp') drawEventLike('CAMPAMENTO', 'LA CARAVANA ACAMPA BAJO LAS ESTRELLAS. TIENES TIEMPO PARA UNA SOLA TAREA ANTES DE SEGUIR.', TOUR.camp.map(o => ({ t: o.t })), evResult);
    else if (S === 'perk') drawPerk();
    else if (S === 'prep') drawPrep();
    else if (S === 'stageres') drawStageRes();
    else if (S === 'gameover') drawEnd(false);
    else if (S === 'victory') drawEnd(true);
    else { drawWorld(); drawHUD(); drawMsgs(); }
    for (const c of conf) { ctx.fillStyle = c.col; ctx.fillRect(c.x | 0, c.y | 0, 2, (frame + c.ph * 10) % 8 < 4 ? 2 : 1); }
    if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(1, flash) + ')'; ctx.fillRect(0, 0, W, H); }
    gctx.clearRect(0, 0, W, H); gctx.drawImage(cv, 0, 0);
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); draw();
    requestAnimationFrame(loop);
  }
  draw();
  setTimeout(() => { buildAll(); go('title'); requestAnimationFrame(t => { last = t; loop(t); }); }, 30);

  // ganchos de depuración
  window.__t40 = {
    get state() { return state; }, get race() { return race; }, get run() { return run; }, get ground() { return ground; }, keys, pressed,
    ff(sec) { for (let i = 0; i < sec * 60; i++) update(1 / 60); draw(); },
    press(k) { pressed.add(k); update(1 / 60); },
    taller() { stock = TOUR.stock(run); go('shop'); },
  };
})();
