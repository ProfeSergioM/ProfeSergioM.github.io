// TURBO 40 — RALLY TOUR: bucle principal, pantallas del roguelike, HUD y efectos noventeros.
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
  let carSpr, palms, tiresSpr, decoSpr, pickSpr, crossSpr, colSpr;
  const titleCache = new Map();
  const standCache = new Map();
  let rec = { best: 0, wins: 0, runs: 0, owned: ['rojo'], livery: 'rojo' };
  try { rec = Object.assign(rec, JSON.parse(localStorage.getItem('turbo40tour') || '{}')); } catch (e) { }
  const saveRec = () => { try { localStorage.setItem('turbo40tour', JSON.stringify(rec)); } catch (e) { } };
  function buildAll() {
    carSpr = GR.buildCars(T.COLORS);
    palms = GR.buildPalms(); tiresSpr = GR.buildTires(); decoSpr = GR.buildDecor(); pickSpr = GR.buildPickups();
    crossSpr = GR.buildCrossers(); colSpr = GR.buildColeccion();
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
  let banner = null, secIdx = -1, lastHurt = 0, alarmT = 0, finT = 0;
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
    parts = []; conf = []; msgs = []; pops = []; banner = null; secIdx = -1; lastHurt = 0; finT = 0;
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
    sc.tires.forEach(o => add(o, 'tire')); sc.rocks.forEach(o => add(o, 'rock'));
    sc.boards.forEach(o => add(o, 'board')); sc.stands.forEach(o => add(o, 'stand', -30));
    sc.pickups.forEach(o => add(o, 'pick'));
    sc.marshals.forEach(o => add(o, 'marshal')); sc.broken.forEach(o => add(o, 'averiado'));
    if (sc.coleccion) add(sc.coleccion, 'coleccion');
  }

  function msg(text, dur, style, sub) { msgs.push({ text, dur, t: 0, style: style || 'big', sub }); }
  function pop(x, y, text, col) { pops.push({ x, y, z: 14, text, col, t: 0 }); }
  function addP(o) { if (parts.length < 700) parts.push(o); }
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
      ground.work(14);
      if (!ground.queue.length && P('up')) { go('countdown'); cd = 4.2; lights = 0; msg('PREPARADOS', 1.6, 'big'); AU.music(false); AU.music(true, 'race'); }
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

  function updRace(dt) {
    acc += dt;
    while (acc >= DT) { acc -= DT; T.step(race, DT, keys); handleEvents(); }
    const p = race.player;
    perCarFx(dt); brokenSmoke();
    // daño recibido: avisos
    const h = race.hurt.chasis + race.hurt.motor;
    if (h - lastHurt > 1.5) { pop(p.x, p.y, '-' + Math.round(h - lastHurt), '#ff4040'); hurtFlash = Math.min(1, (h - lastHurt) / 10); lastHurt = h; }
    else if (h > lastHurt) lastHurt = h;
    alarmT -= dt;
    if (p.dmg.chasis < 25 && !p.dead && alarmT <= 0 && state === 'race') { AU.alarm(); alarmT = 1.4; }
    // sección actual
    const k = race.trk.marks.findIndex(m => p.s >= m.s0 && p.s < m.s1);
    if (k >= 0 && k !== secIdx) { secIdx = k; const m = race.trk.marks[k]; banner = { n: m.n, ref: m.ref, dirt: m.dirt, rocks: m.rocks, t: 0 }; }
    if (banner) { banner.t += dt; if (banner.t > 2.6) banner = null; }
    // sonido
    const v = Math.abs(p.vf || 0), GE = [0, 48, 86, 120, 150, 178, 215];
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
          else if (e.kind === 'ciervo') { pop(e.x, e.y, '¡CIERVO!', '#ff4040'); AU.thud(90); shake = 3; }
          else if (e.kind === 'perro' || e.kind === 'gallina') { pop(e.x, e.y, '¡UPS!', '#ff8040'); AU.thud(50); }
          else { pop(e.x, e.y, '¡PAF!', '#f9f871'); AU.blip(); }
        }
        for (let i = 0; i < 6; i++) addP({ x: e.x, y: e.y, z: 3, vx: rnd(-40, 40), vy: rnd(-40, 40), vz: rnd(20, 60), life: 0, max: 0.4, type: 'dirt', col: e.kind === 'rodadora' ? '#a08048' : e.kind === 'gallina' ? '#ffffff' : '#c0b0a0' });
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

  function perCarFx(dt) {
    for (const c of race.cars) {
      const sp = Math.hypot(c.vx, c.vy), fx = Math.cos(c.a), fy = Math.sin(c.a);
      const skid = (c.slip > 30 && sp > 40) || (c.brk > 0 && sp > 60 && c.vf > 0);
      if (skid && (c.surf === 0 || c.surf === 1 || c.surf === 4)) {
        const col = c.surf === 4 ? 'rgba(70,40,15,0.35)' : 'rgba(22,22,28,0.35)';
        [[-8, -5], [-8, 5]].forEach(([a, b], w) => {
          const x = c.x + fx * a - fy * b, y = c.y + fy * a + fx * b, last = c['sk' + w];
          if (last) {
            const n = Math.ceil(Math.hypot(x - last[0], y - last[1]) / 1.5);
            if (n < 12) for (let i = 1; i <= n; i++) { const X = last[0] + (x - last[0]) * i / n, Y = last[1] + (y - last[1]) * i / n; ground.mark(X - Y, (X + Y) / 2, col); }
          }
          c['sk' + w] = [x, y];
        });
        if (Math.random() < dt * (c.slip > 45 ? 30 : 10)) smoke(c.x - fx * 9, c.y - fy * 9, 1, c.surf === 4 ? '#c8a070' : null);
      } else { c.sk0 = c.sk1 = null; }
      if ((c.surf >= 2 && c.surf !== 4 && sp > 30) || (c.surf === 4 && sp > 80)) if (Math.random() < dt * 25) {
        const col = { 2: '#3c8a2a', 3: '#d8b860', 4: '#b88850', 5: '#e0c080' }[c.surf];
        addP({ x: c.x - fx * 10 + rnd(-4, 4), y: c.y - fy * 10 + rnd(-4, 4), z: 1, vx: -c.vx * 0.2 + rnd(-15, 15), vy: -c.vy * 0.2 + rnd(-15, 15), vz: rnd(20, 50), life: 0, max: 0.45, type: c.surf === 4 || c.surf === 5 ? 'smoke' : 'dirt', col });
      }
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
    else { mapSel = 0; go('map'); }
  }
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
    if (P('up')) { mapSel = (mapSel - 1 + opts.length) % opts.length; AU.move(); }
    if (P('down')) { mapSel = (mapSel + 1) % opts.length; AU.move(); }
    if (P('right')) enterNode(opts[mapSel]);
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
  function shopRows() {
    const rows = [];
    const PN = { chasis: 'CHASIS', motor: 'MOTOR', gomas: 'GOMAS' };
    for (const p of ['chasis', 'motor', 'gomas']) {
      const c = TOUR.repairCost(run, p);
      rows.push({ t: 'REPARAR ' + PN[p], d: c ? 'DEJA EL ' + PN[p] + ' AL 100%' : 'YA ESTÁ PERFECTO', price: c, ok: c > 0 && run.money >= c, act: () => TOUR.repair(run, p) });
    }
    for (const u of TOUR.UPGRADES) {
      const c = TOUR.upCost(run, u.id), lv = run.up[u.id];
      rows.push({ t: 'MEJORAR ' + u.n, d: c == null ? 'NIVEL MÁXIMO' : u.d, price: c, lv, ok: c != null && run.money >= c, act: () => TOUR.buyUp(run, u.id), up: true });
    }
    stock.forEach((id, i) => {
      const it = TOUR.ITEMS[id];
      rows.push({ t: it.n, d: it.d + ' · A LA MOCHILA', price: it.precio, ok: run.money >= it.precio && run.items.length < run.maxItems, act: () => { const r = TOUR.buyItem(run, id); if (r) stock.splice(i, 1); return r; } });
    });
    rows.push({ t: 'SALIR', d: 'VOLVER AL MAPA', exit: true, ok: true });
    return rows;
  }
  function updShop() {
    const rows = shopRows();
    listNav(rows.length);
    if (P('right')) {
      const r = rows[sel];
      if (r.exit) leaveShop();
      else if (r.ok && r.act()) { AU.buy(); sel = Math.min(sel, shopRows().length - 1); }
      else AU.error();
    }
    if (P('left')) leaveShop();
  }
  function leaveShop() {
    if (node && node.type === 'jefe') { if (!TOUR.nextRegion(run)) { finishRun(); return; } }
    mapSel = 0; go('map');
  }
  function updEvent() {
    if (evResult) { if (P('right') || P('up')) { mapSel = 0; go('map'); } return; }
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
  const BOARD_TXT = ['TURBO', 'RAD!', 'NEON', '1990', 'MAX', 'HYPER', 'DAKAR', 'RALLY'];
  const TALL = { pino: 1, arbol: 1, cerezo: 1, palmera: 1 };

  function decoSprite(o) {
    const sah = race.trk.tema === 'sahara';
    switch (o.kind) {
      case 'palmera': return palms[o.v];
      case 'pino': return decoSpr.pino[o.v];
      case 'arbol': return decoSpr.arbol[o.v];
      case 'cerezo': return decoSpr.cerezo[o.v];
      case 'arbusto': return sah ? decoSpr.seco[o.v] : decoSpr.arbusto[o.v];
      case 'roca': return sah ? decoSpr.rocaArena[o.v] : decoSpr.roca[o.v];
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
    for (const c of race.cars) { const [X, Y] = proj(c.x, c.y); if (inView(X, Y, 40)) list.push({ d: c.x + c.y, k: 'car', o: c, X, Y }); }
    for (const o of race.crossers) { const [X, Y] = proj(o.x, o.y, o.z); if (inView(X, Y, 30)) list.push({ d: o.x + o.y, k: 'cross', o, X, Y }); }
    list.sort((a, b) => a.d - b.d);
    for (const e of list) {
      const { X, Y, o } = e;
      if (e.k === 'deco') {
        const s = decoSprite(o); if (!s) continue;
        const x0 = X - s.ox, y0 = Y - s.oy;
        const occl = TALL[o.kind] && e.d > pd && PX > x0 && PX < x0 + s.cv.width && PY > y0 && PY < y0 + s.cv.height;
        if (occl) ctx.globalAlpha = 0.4;
        ctx.drawImage(s.cv, x0, y0); ctx.globalAlpha = 1;
      } else if (e.k === 'tire') { const s = tiresSpr[o.c]; ctx.drawImage(s.cv, X - s.ox, Y - s.oy); }
      else if (e.k === 'rock') { const s = decoSpr.peligro[o.v]; ctx.drawImage(s.cv, X - s.ox, Y - s.oy); }
      else if (e.k === 'board') drawBoard(X, Y, o.k, e.d > pd && Math.abs(PX - X) < 22 && PY < Y && PY > Y - 34);
      else if (e.k === 'stand') {
        const fr = standSpr(o), s = fr[(Math.floor(stT * (state !== 'race' ? 8 : 2.5)) + (o.x | 0)) % 2];
        ctx.drawImage(s.cv, X - s.ox, Y - s.oy);
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
        if (c.brk > 0 && c.vf > 5) { const fx = Math.cos(c.a), fy = Math.sin(c.a), [bx, by] = proj(c.x - fx * 13, c.y - fy * 13, 2); ctx.fillStyle = '#ff2020'; ctx.fillRect(bx - 2, by - 1, 4, 2); }
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
    if (race.rain) {
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
    if ((v > 165 || p.nitroT > 0) && state === 'race') {
      const dx = p.vx - p.vy, dy = (p.vx + p.vy) / 2, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
      ctx.strokeStyle = p.nitroT > 0 ? 'rgba(120,220,255,0.7)' : 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1; ctx.beginPath();
      const n = p.nitroT > 0 ? 14 : Math.floor((v - 160) / 8);
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2, rr = rnd(120, 200), x = W / 2 + Math.cos(ang) * rr, y = H / 2 + Math.sin(ang) * rr * 0.6, L = rnd(10, 26);
        ctx.moveTo(x | 0, y | 0); ctx.lineTo((x - ux * L) | 0, (y - uy * L) | 0);
      }
      ctx.stroke();
    }
    cam.x = rx; cam.y = ry;
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
  function bar(x, y, w, v, label) {
    const col = v > 60 ? '#30e050' : v > 30 ? '#f9f871' : '#ff2a2a';
    GR.text(ctx, label, x, y, { color: v <= 25 && frame % 20 < 10 ? '#ff2a2a' : '#a0a0c0' });
    const bx = x + 24, bw = w - 24;
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
      const f = banner.t, x = f < 0.25 ? W + 10 - (f / 0.25) * (W / 2 + 10) : f > 2.3 ? W / 2 - ((f - 2.3) / 0.3) * (W / 2 + 140) : W / 2;
      ctx.fillStyle = 'rgba(8,4,24,0.8)'; ctx.fillRect(Math.round(x - 92), 44, 184, 27);
      ctx.fillStyle = '#ff2a6d'; ctx.fillRect(Math.round(x - 92), 44, 184, 1); ctx.fillRect(Math.round(x - 92), 70, 184, 1);
      GR.text(ctx, banner.n, x, 47, { align: 'center', scale: 2, rows: banner.rocks ? gradY('#ffe0a0', '#ffa040', '#ff5020') : COOL });
      GR.text(ctx, 'ESTILO ' + banner.ref + (banner.rocks ? ' · ¡OBSTÁCULOS!' : ''), x, 62, { align: 'center', color: banner.rocks ? '#ff8040' : '#a0a0c0' });
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
  function status(x, y) {
    panel(x, y, 120, 92);
    GR.text(ctx, 'TU AUTO', x + 6, y + 5, { color: '#05d9e8' });
    dmgBars(x + 6, y + 16, 108, run.dmg);
    GR.text(ctx, 'MOCHILA ' + run.items.length + '/' + run.maxItems, x + 6, y + 46, { color: '#a0a0c0' });
    run.items.slice(0, 8).forEach((id, i) => { ctx.fillStyle = itemColor(id); ctx.fillRect(x + 6 + i * 13, y + 56, 10, 8); ctx.fillStyle = '#000'; ctx.fillRect(x + 6 + i * 13, y + 63, 10, 1); });
    const up = TOUR.UPGRADES.map(u => u.n.slice(0, 3) + run.up[u.id]).join(' ');
    GR.wrap(up, 18).forEach((l, i) => GR.text(ctx, l, x + 6, y + 70 + i * 9, { color: '#d0d0e0' }));
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
  function drawMap() {
    bg();
    const reg = TOUR.region(run), map = run.map[run.region];
    header('REGIÓN ' + (run.region + 1) + '/4 · ' + reg.nombre, 'GENERAL ' + (run.stage ? TOUR.gcPos(run) + '°' : '-'));
    const opts = TOUR.options(run);
    const colX = r => 70 + r * 82, rowY = (r, i) => { const n = map.rows[r].length; return 92 + (i - (n - 1) / 2) * 40; };
    // conexiones
    ctx.strokeStyle = '#504070'; ctx.lineWidth = 1; ctx.beginPath();
    map.rows.forEach((row, r) => row.forEach((n, i) => (n.next || []).forEach(j => { ctx.moveTo(colX(r) + 0.5, rowY(r, i) + 0.5); ctx.lineTo(colX(r + 1) + 0.5, rowY(r + 1, j) + 0.5); })));
    ctx.stroke();
    // posición actual
    GR.text(ctx, 'SALIDA', 22, 88, { align: 'center', color: '#a0a0c0' });
    map.rows.forEach((row, r) => row.forEach((n, i) => {
      const reach = r === run.row + 1 && opts.includes(i), hi = reach && opts[mapSel] === i;
      const past = r <= run.row, cur = r === run.row && i === run.col;
      nodeIcon(colX(r), rowY(r, i), n, hi, past && !cur || (!reach && r === run.row + 1));
      if (cur) GR.text(ctx, '↓', colX(r), rowY(r, i) - 22, { align: 'center', color: '#fff' });
    }));
    if (run.row < 0) { ctx.fillStyle = frame % 20 < 12 ? '#fff' : '#f9f871'; ctx.fillRect(18, 98, 9, 9); }
    // descripción
    const n = map.rows[run.row + 1] && map.rows[run.row + 1][opts[mapSel]];
    panel(8, 158, 252, 52);
    if (n) {
      const info = TOUR.NODOS[n.type];
      GR.text(ctx, info.n, 14, 163, { scale: 2, color: NODE_COL[n.type] });
      GR.text(ctx, info.d, 14, 181, { color: '#fff' });
      if (n.type === 'carrera' || n.type === 'rally' || n.type === 'jefe') {
        const secs = E.SECCIONES[reg.id].map(s => s.ref).filter((v, i, a) => a.indexOf(v) === i).slice(0, 4).join(', ');
        GR.text(ctx, 'ESTILO ' + secs, 14, 192, { color: '#a0a0c0' });
      }
    }
    status(270, 112);
    hints('↑↓ ELEGIR RUTA   → IR   ← MOCHILA');
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
    header(node && node.type === 'jefe' ? 'TALLER DE FIN DE REGIÓN' : 'TALLER', null);
    const rows = shopRows();
    panel(8, 30, 262, rows.length * 11 + 8);
    drawList(10, 35, 258, rows, 11);
    const r = rows[sel];
    panel(8, 186, 262, 24); GR.text(ctx, r.d, 14, 194, { color: '#fff' });
    status(274, 30);
    hints('↑↓ ELEGIR   → COMPRAR   ← SALIR');
  }
  function drawBag() {
    bg(); header('MOCHILA', null);
    const rows = run.items.map(id => ({ t: TOUR.ITEMS[id].n, d: TOUR.ITEMS[id].d })).concat([{ t: 'VOLVER', d: '' }]);
    panel(8, 30, 200, rows.length * 12 + 8);
    drawList(10, 35, 196, rows, 12);
    if (rows[sel] && rows[sel].d) { panel(8, 186, 200, 24); GR.text(ctx, rows[sel].d, 14, 194, { color: '#fff' }); }
    if (!run.items.length) GR.text(ctx, 'NO TIENES REPUESTOS', 14, 60, { color: '#a0a0c0' });
    status(274, 30);
    if (run.perks.length) { panel(274, 126, 120, 12 + run.perks.length * 9); run.perks.forEach((id, i) => GR.text(ctx, TOUR.PERKS.find(p => p.id === id).n, 280, 131 + i * 9, { color: '#f9f871' })); }
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
    GR.text(ctx, 'SECCIONES', 224, 35, { color: '#05d9e8' });
    race.trk.marks.slice(0, 11).forEach((m, i) => {
      GR.text(ctx, m.n, 224, 46 + i * 10, { color: m.rocks ? '#ff8040' : '#fff' });
      GR.text(ctx, m.ref.slice(0, 11), 390, 46 + i * 10, { align: 'right', color: '#606080' });
    });
    const km = (race.trk.finishS - race.trk.startS) * 0.45 / 1000;
    GR.text(ctx, km.toFixed(1).replace('.', ',') + ' KM · LARGAS ' + ((race.cars.indexOf(race.player)) + 1) + '°', 14, 168, { color: '#f9f871' });
    dmgBars(14, 180, 120, run.dmg);
    GR.text(ctx, race.rain ? 'CLIMA: LLUVIA (MENOS AGARRE)' : 'CLIMA: DESPEJADO', 150, 168, { color: race.rain ? '#80b0ff' : '#a0a0c0' });
    const left = ground.queue.length, tot = ground.chunks.size + left;
    if (left) GR.text(ctx, 'PREPARANDO PISTA ' + Math.round(100 * (1 - left / tot)) + '%', 300, 186, { align: 'center', color: '#a0a0c0' });
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
    if (stT > 0.8 && frame % 40 < 28) GR.text(ctx, 'PULSA → PARA SEGUIR', 300, 186, { align: 'center', rows: HOT });
  }
  function drawPerk() {
    bg(); header('¡REGIÓN SUPERADA!', TOUR.region(run).nombre);
    GR.text(ctx, 'ELIGE UNA VENTAJA PARA EL RESTO DEL TOUR', W / 2, 36, { align: 'center', color: '#fff' });
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
      ['REGIÓN ALCANZADA', TOUR.region(run).nombre],
      ['ETAPAS CORRIDAS', String(run.stage)],
      ['POSICIÓN EN LA GENERAL', (run.finalPos || TOUR.gcPos(run)) + '°'],
      ['DINERO', '$' + run.money],
      ['VENTAJAS', run.perks.length ? run.perks.map(id => TOUR.PERKS.find(p => p.id === id).n).join(', ').slice(0, 22) : '-'],
      ['TOURS GANADOS', String(rec.wins)],
    ];
    lines.forEach(([a, b], i) => { GR.text(ctx, a, 70, 72 + i * 15, { color: '#a0a0c0' }); GR.text(ctx, b, 330, 72 + i * 15, { align: 'right', color: '#fff' }); });
    if (!won) GR.text(ctx, 'TU AUTO QUEDÓ DESTRUIDO EN LA RUTA', W / 2, 190, { align: 'center', color: '#ff8080' });
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
    GR.text(ctx, '* RALLY TOUR *', W / 2, 66, { align: 'center', scale: 2, rows: r => NEON[(r + (frame >> 3)) % 6], outline: '#000' });
    if (frame % 50 < 34) GR.text(ctx, 'PULSA ↑ PARA EMPEZAR', W / 2, 92, { align: 'center', scale: 2, rows: HOT, outline: '#200' });
    const own = rec.owned.length;
    GR.text(ctx, (own > 1 ? '← ' : '') + liv().n + (own > 1 ? ' →' : ''), W / 2, 112, { align: 'center', color: '#fff', outline: '#000' });
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
    get state() { return state; }, get race() { return race; }, get run() { return run; }, keys, pressed,
    ff(sec) { for (let i = 0; i < sec * 60; i++) update(1 / 60); draw(); },
    press(k) { pressed.add(k); update(1 / 60); },
  };
})();
