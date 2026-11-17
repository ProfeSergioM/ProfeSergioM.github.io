// TURBO 40 — núcleo de simulación (sin DOM): pista abierta de punto a punto, física, daño, IA.
// Corre en el navegador y en Node (medir.js).
(function (G) {
  'use strict';
  const T = {};
  const HW = 34;          // medio ancho de pista
  const DS = 4;           // separación de muestras de la línea central
  T.HW = HW; T.DS = DS; T.CURB = 6; T.SAND = 34;
  T.NCARS = 10;
  T.PH = {
    VMAX: 172, ACC: 150, BRAKE: 430, DRAG: 32, REV: 70,
    TURN: 2.3, TURNHI: 0.5, GRIP: 7.5,
    GRASSV: 100, GRASSDRAG: 300, SANDV: 70, SANDDRAG: 520, DESV: 95, DESDRAG: 320,
    R: 6.5, OFF: 6.5,
  };
  T.KMH = 1.62; // unidades/s -> km/h (200 u/s ~ 324 km/h)
  T.YLIM = 210 / T.KMH; // límite en bandera amarilla: 210 km/h
  // superficies
  const ASF = 0, CURB = 1, PASTO = 2, TRAMPA = 3, TIERRA = 4, ARENA = 5;
  T.SURF = { ASF, CURB, PASTO, TRAMPA, TIERRA, ARENA };

  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0; let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  T.rng = rng;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const wrapA = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  T.clamp = clamp; T.wrapA = wrapA;

  function smoothOpen(arr, w, passes) {
    const N = arr.length; let a = arr.slice();
    for (let p = 0; p < passes; p++) {
      const b = new Array(N);
      for (let i = 0; i < N; i++) {
        let s = 0, n = 0;
        for (let j = -w; j <= w; j++) { const k = i + j; if (k < 0 || k >= N) continue; s += a[k]; n++; }
        b[i] = s / n;
      }
      a = b;
    }
    return a;
  }

  // ---------- construcción de la etapa ----------
  // gen: salida de ETAPAS.generar; opts: {tema, tipo, seed}
  T.buildStage = function (gen, opts) {
    const poly = gen.poly, flags = gen.flags;
    const cum = [0];
    for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
    const total = cum[cum.length - 1];
    const N = Math.floor(total / DS) + 1;
    const pts = [];
    let seg = 0;
    for (let k = 0; k < N; k++) {
      const s = k * DS;
      while (seg < poly.length - 2 && cum[seg + 1] < s) seg++;
      const a = poly[seg], b = poly[seg + 1];
      const u = clamp((s - cum[seg]) / (cum[seg + 1] - cum[seg] || 1), 0, 1);
      const f = flags[seg + 1] || flags[seg];
      pts.push({ x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, s, dirt: f.dirt, rocky: f.rocks });
    }
    // desplazar a coordenadas positivas
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    pts.forEach(p => { minx = Math.min(minx, p.x); miny = Math.min(miny, p.y); maxx = Math.max(maxx, p.x); maxy = Math.max(maxy, p.y); });
    const M = 600;
    pts.forEach(p => { p.x += M - minx; p.y += M - miny; });
    for (let i = 0; i < N; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)];
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const p = pts[i]; p.tx = (b.x - a.x) / l; p.ty = (b.y - a.y) / l; p.nx = -p.ty; p.ny = p.tx;
      p.ang = Math.atan2(p.ty, p.tx);
    }
    const kr = [];
    for (let i = 0; i < N; i++) kr.push(i < N - 1 ? wrapA(pts[i + 1].ang - pts[i].ang) / DS : 0);
    const ks = smoothOpen(kr, 3, 2), kb = smoothOpen(kr, 14, 3);
    const rl = smoothOpen(kb.map(k => clamp(k * 2600, -22, 22)), 6, 2);
    // suavizar transiciones de tierra (evita parches de un punto)
    for (let i = 0; i < N; i++) {
      const p = pts[i]; p.k = ks[i]; p.rl = rl[i];
      p.curb = !p.dirt && Math.abs(kb[i]) > 1 / 200;
      p.sand = !p.dirt && Math.abs(kb[i]) > 1 / 140 ? -Math.sign(kb[i]) : 0;
    }
    // grilla espacial de muestras (cubetas de 64)
    const grid = new Map();
    pts.forEach((p, i) => {
      const key = Math.floor(p.x / 64) + ',' + Math.floor(p.y / 64);
      let l = grid.get(key); if (!l) grid.set(key, l = []); l.push(i);
    });
    const trk = {
      pts, N, DS, L: (N - 1) * DS, grid, startS: gen.startS, finishS: gen.finishS, marks: gen.marks,
      tema: opts.tema, tipo: opts.tipo, W: maxx - minx + 2 * M, H: maxy - miny + 2 * M,
    };
    trk.extra = { lluvia: !!opts.lluvia, amarilla: !!opts.amarilla, coleccion: opts.coleccion || null };
    trk.scen = buildScenery(trk, opts.seed || 1);
    return trk;
  };

  // muestra más cercana usando la grilla espacial
  function nearestGrid(trk, x, y, rad) {
    const gx = Math.floor(x / 64), gy = Math.floor(y / 64), r = Math.ceil((rad || 64) / 64);
    let best = -1, bd = 1e18;
    for (let ox = -r; ox <= r; ox++) for (let oy = -r; oy <= r; oy++) {
      const l = trk.grid.get((gx + ox) + ',' + (gy + oy)); if (!l) continue;
      for (const i of l) { const p = trk.pts[i], d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = i; } }
    }
    return [best, Math.sqrt(bd)];
  }
  T.nearestGrid = nearestGrid;
  T.distTrack = (trk, x, y, rad) => { const r = nearestGrid(trk, x, y, rad || 128); return r[0] < 0 ? 1e9 : r[1]; };

  T.locate = function (trk, x, y, hint) {
    const N = trk.N, pts = trk.pts;
    let best = -1, bd = 1e18;
    if (hint != null) {
      for (let j = Math.max(0, hint - 30); j <= Math.min(N - 1, hint + 30); j++) {
        const p = pts[j], d = (x - p.x) ** 2 + (y - p.y) ** 2; if (d < bd) { bd = d; best = j; }
      }
    }
    if (best < 0 || bd > 150 * 150) {
      const [i, d] = nearestGrid(trk, x, y, 320);
      if (i >= 0 && d * d < bd) { best = i; bd = d * d; }
    }
    if (best < 0) best = hint || 0;
    const p = pts[best], dx = x - p.x, dy = y - p.y;
    const along = dx * p.tx + dy * p.ty, lat = dx * p.nx + dy * p.ny;
    return { i: best, s: clamp(p.s + along, 0, trk.L), lat, d: Math.sqrt(bd) };
  };

  T.surface = function (trk, i, lat) {
    const p = trk.pts[i], a = Math.abs(lat);
    if (a < HW) return p.dirt ? TIERRA : ASF;
    if (a < HW + T.CURB && p.curb) return CURB;
    if (p.sand && Math.sign(lat) === p.sand && a < HW + T.SAND) return TRAMPA;
    return trk.tema === 'sahara' ? ARENA : PASTO;
  };

  // ---------- escenario (determinista) ----------
  const DECOR = {
    europa: ['pino', 'arbol', 'pino', 'arbol', 'arbusto'],
    japon: ['cerezo', 'pino', 'cerezo', 'arbol'],
    america: ['palmera', 'palmera', 'arbol', 'arbusto'],
    sahara: ['roca', 'arbusto', 'roca', 'duna', 'palmera', 'palmera'],
  };
  function buildScenery(trk, seed) {
    const R = rng(seed * 31 + 7);
    const tires = [], rocks = [], decor = [], boards = [], stands = [], pickups = [];
    const dist = (x, y) => T.distTrack(trk, x, y, 200);
    // barreras de neumáticos al exterior de curvas fuertes de asfalto
    for (let i = 0; i < trk.N; i += 2) {
      const p = trk.pts[i];
      if (!p.sand) continue;
      const off = (HW + T.SAND + 4) * p.sand;
      const x = p.x + p.nx * off, y = p.y + p.ny * off;
      if (dist(x, y) < HW + T.SAND) continue;
      const last = tires[tires.length - 1];
      if (last && (last.x - x) ** 2 + (last.y - y) ** 2 < 64) continue;
      tires.push({ x, y, r: 4.5, c: (tires.length >> 1) & 1, kind: 'tire' });
    }
    // rocas sobre secciones rocosas
    let nextRock = trk.startS + 500;
    for (let i = 0; i < trk.N; i++) {
      const p = trk.pts[i];
      if (p.s < nextRock || p.s > trk.finishS - 100) continue;
      if (!p.rocky) continue;
      nextRock = p.s + 340 + R() * 460;
      const lat = (R() * 2 - 1) * (HW - 8);
      rocks.push({ x: p.x + p.nx * lat, y: p.y + p.ny * lat, r: 5 + R() * 2.5, kind: 'rock', v: Math.floor(R() * 3) });
    }
    // manchas de aceite en secciones con obstáculos
    const oil = [];
    let nextOil = trk.startS + 600;
    for (let i = 0; i < trk.N; i++) {
      const p = trk.pts[i];
      if (!p.rocky || p.s < nextOil || p.s > trk.finishS - 100) continue;
      nextOil = p.s + 450 + R() * 520;
      if (R() < 0.45) continue;
      const lat = (R() * 2 - 1) * (HW - 12);
      oil.push({ x: p.x + p.nx * lat, y: p.y + p.ny * lat, r: 10 + R() * 5, kind: 'aceite' });
    }
    // tribunas en la largada y en la meta
    const iAt = s => clamp(Math.round(s / trk.DS), 0, trk.N - 1);
    for (const base of [trk.startS, trk.finishS]) {
      const side = trk.pts[iAt(base)].k >= 0 ? -1 : 1;
      for (let s = base - 150; s <= base + 150; s += 30) {
        const p = trk.pts[iAt(s)], off = (HW + 62) * side;
        stands.push({ x: p.x + p.nx * off, y: p.y + p.ny * off, a: p.ang, side });
      }
    }
    // carteles de neón cada tanto
    for (let s = trk.startS + 600, k = 0; s < trk.finishS - 200; s += 900 + R() * 600, k++) {
      const p = trk.pts[iAt(s)], sd = R() < 0.5 ? 1 : -1, off = (HW + 30) * sd;
      const x = p.x + p.nx * off, y = p.y + p.ny * off;
      if (dist(x, y) < HW + 22) continue;
      boards.push({ x, y, k: Math.floor(R() * 8) });
    }
    // decoración por tema
    const kinds = DECOR[trk.tema] || DECOR.europa;
    const dgrid = new Map(), dkey = (x, y) => Math.floor(x / 40) + ',' + Math.floor(y / 40);
    const free = (x, y, r) => {
      const gx = Math.floor(x / 40), gy = Math.floor(y / 40);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const l = dgrid.get((gx + ox) + ',' + (gy + oy)); if (!l) continue;
        for (const o of l) if ((o.x - x) ** 2 + (o.y - y) ** 2 < r * r) return false;
      }
      for (const s of stands) if ((s.x - x) ** 2 + (s.y - y) ** 2 < 55 * 55) return false;
      return true;
    };
    for (let i = 0; i < trk.N; i += 5) {
      const p = trk.pts[i];
      for (const sd of [-1, 1]) {
        if (R() < 0.35) continue;
        const off = (HW + 48 + Math.pow(R(), 1.5) * 260) * sd;
        const x = p.x + p.nx * off + (R() - 0.5) * 30, y = p.y + p.ny * off + (R() - 0.5) * 30;
        const kind = kinds[Math.floor(R() * kinds.length)];
        if (dist(x, y) < HW + (kind === 'duna' ? 90 : 44)) continue;
        if (!free(x, y, kind === 'duna' ? 50 : 20)) continue;
        const o = { x, y, kind, v: Math.floor(R() * 3) };
        decor.push(o);
        const kk = dkey(x, y); let l = dgrid.get(kk); if (!l) dgrid.set(kk, l = []); l.push(o);
      }
    }
    // objetos recogibles
    const rally = trk.tipo === 'rally';
    const TYPES = [['cash', 44], ['llave', 14], ['goma', 12], ['aceite', 10], ['nitro', 13], ['caja', 7]];
    const tw = TYPES.reduce((a, t) => a + t[1], 0);
    for (let s = trk.startS + 400; s < trk.finishS - 150; s += (rally ? 110 : 150) + R() * 110) {
      const p = trk.pts[iAt(s)], lat = (R() * 2 - 1) * (HW - 12);
      let r = R() * tw, type = 'cash';
      for (const [t, w] of TYPES) { if ((r -= w) < 0) { type = t; break; } }
      pickups.push({ x: p.x + p.nx * lat, y: p.y + p.ny * lat, type, taken: false, s });
    }
    // bandera amarilla: auto averiado y comisarios
    const marshals = [], broken = [];
    const yellows = [];
    if (trk.extra.amarilla) {
      const largo = trk.finishS - trk.startS, n = largo > 15000 && R() < 0.55 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const s = trk.startS + 2500 + (largo - 4500) * (k + 0.2 + R() * 0.6) / n;
        const i = iAt(s), p = trk.pts[i], sd = R() < 0.5 ? 1 : -1, lat = sd * (HW - 11);
        const bx = p.x + p.nx * lat, by = p.y + p.ny * lat;
        broken.push({ x: bx, y: by, a: p.ang + sd * 0.5, kind: 'averiado' });
        for (const o of [-7, 7]) rocks.push({ x: bx + p.tx * o, y: by + p.ty * o, r: 7, kind: 'rock', hidden: true });
        const s0 = s - 1250, s1 = s + 260;
        for (let ds = s0 + 40; ds < s1; ds += 260) for (const side of [-1, 1]) {
          const q = trk.pts[iAt(ds)], off = (HW + 13) * side;
          marshals.push({ x: q.x + q.nx * off, y: q.y + q.ny * off, side, ph: R() * 6 });
        }
        yellows.push({ s0, s1, s });
      }
    }
    // auto coleccionable
    let coleccion = null;
    if (trk.extra.coleccion) {
      const p = trk.pts[iAt(trk.startS + 900 + R() * (trk.finishS - trk.startS - 1400))], lat = (R() * 2 - 1) * (HW - 12);
      coleccion = { x: p.x + p.nx * lat, y: p.y + p.ny * lat, id: trk.extra.coleccion, taken: false, s: p.s };
    }
    // colisionadores estáticos
    const cgrid = new Map();
    tires.concat(rocks).forEach(t => {
      const key = Math.floor(t.x / 64) + ',' + Math.floor(t.y / 64);
      let l = cgrid.get(key); if (!l) cgrid.set(key, l = []); l.push(t);
    });
    return { tires, rocks, oil, decor, boards, stands, pickups, cgrid, marshals, broken, yellows, coleccion };
  }

  // ---------- autos ----------
  T.COLORS = ['#e8202a', '#f8d020', '#2860f0', '#f0f0f0', '#30c040', '#ff8818', '#9040e0', '#20d0e0', '#ff60b0', '#383848'];
  T.STATS0 = { vmax: 1, acc: 1, grip: 1, brake: 1, off: 0, armor: 0, magnet: 0, nitroStart: 0, fragil: 0 };

  // opts: {rivals:[{name,color,skill}], order:[índices de rivales o -1 = jugador], stats, dmg, aiBase, autopilot}
  T.newRace = function (trk, opts) {
    const cars = [];
    const order = opts.order || opts.rivals.map((r, i) => i).concat([-1]);
    let player = null;
    order.forEach((who, k) => {
      const row = Math.floor(k / 2), col = k % 2;
      const s = trk.startS - 26 - row * 44 - col * 22;
      const i = clamp(Math.round(s / trk.DS), 0, trk.N - 1), p = trk.pts[i];
      const lat = col ? -14 : 14;
      const isPlayer = who === -1;
      const rv = isPlayer ? null : opts.rivals[who];
      const c = {
        id: k, isPlayer, rival: who, name: isPlayer ? 'TÚ' : rv.name, color: isPlayer ? 0 : rv.color,
        x: p.x + p.nx * lat, y: p.y + p.ny * lat, a: p.ang, vx: 0, vy: 0,
        steer: 0, thr: 0, brk: 0, i, s, lat, p: s - trk.startS,
        finished: false, finishTime: 0, skill: isPlayer ? 1 : rv.skill, skillEff: isPlayer ? 1 : rv.skill,
        laneOff: isPlayer ? 0 : (R0(k + (opts.seed || 0)) - 0.5) * 16, lineUse: 0.8 + R0(k + 9) * 0.2,
        avoid: 0, avoidT: 0, stuckT: 0, revT: 0, react: isPlayer ? 0 : 0.05 + R0(k + 3) * 0.3,
        slip: 0, surf: 0, gear: 1, shiftT: 0, wrongT: 0, vf: 0, hitT: 0, draft: 0, nitroT: 0, dead: false,
      };
      if (isPlayer) {
        c.stats = Object.assign({}, T.STATS0, opts.stats || {});
        c.dmg = opts.dmg || { motor: 100, gomas: 100, chasis: 100 };
        c.nitroT = c.stats.nitroStart || 0;
        player = c;
      }
      cars.push(c);
    });
    return {
      trk, cars, t: 0, phase: 'grid', events: [], finishOrder: [], player, aiBase: opts.aiBase || 0.68,
      autopilotAll: !!opts.autopilot, cash: 0, got: [], hurt: { motor: 0, gomas: 0, chasis: 0 }, timeout: false,
      rain: trk.extra.lluvia, crossers: [], crossT: 5, R: rng((opts.seed || 1) * 977 + 3), penalty: 0, fines: 0, collected: null,
      yIn: false, yAhead: null,
    };
  };
  function R0(k) { const r = rng(777 + k * 131); r(); return r(); }

  // daño al jugador
  function hurt(race, c, part, amt) {
    if (!c.dmg || amt <= 0 || c.dead) return;
    const st = c.stats;
    if (part !== 'gomas') amt *= (1 - st.armor) * (1 + st.fragil);
    const v = Math.min(c.dmg[part], amt);
    c.dmg[part] -= v; race.hurt[part] += v;
    if (c.dmg.chasis <= 0 && !c.dead) {
      c.dead = true; c.thr = 0;
      race.events.push({ type: 'dead', car: c });
    }
  }
  T.hurt = hurt;

  const GEARS = [0, 41, 74, 103, 129, 153];
  T.GEARS = GEARS.concat([185]);

  function physics(race, c, dt) {
    const PH = T.PH;
    const fx = Math.cos(c.a), fy = Math.sin(c.a);
    let vf = c.vx * fx + c.vy * fy;
    const sp = Math.abs(vf);
    const surf = c.surf;
    let vmaxEff, acc = PH.ACC, grip = PH.GRIP, turn = PH.TURN, brake = PH.BRAKE, offK = 1;
    if (c.isPlayer) {
      const st = c.stats, d = c.dmg;
      vmaxEff = PH.VMAX * st.vmax * (0.8 + 0.2 * d.motor / 100) * (1 + c.draft);
      acc *= st.acc * (0.7 + 0.3 * d.motor / 100);
      grip *= st.grip * (0.6 + 0.4 * d.gomas / 100);
      turn *= (0.97 + 0.03 * st.grip) * (0.85 + 0.15 * d.gomas / 100);
      brake *= st.brake;
      offK = 1 - st.off;
      if (c.nitroT > 0) { vmaxEff *= 1.22; acc *= 1.8; }
      // limitador automático en zona de bandera amarilla
      c.lim = race.yIn && !c.finished;
      if (c.lim) vmaxEff = Math.min(vmaxEff, T.YLIM);
    } else {
      vmaxEff = PH.VMAX * (race.aiBase + 0.24 * c.skillEff + c.draft);
      if (c.finished) vmaxEff = c.p > race.trk.finishS - race.trk.startS + 90 ? 0 : Math.min(vmaxEff, 70);
    }
    if (c.dead) { vmaxEff = 0; }
    if (c.nitroT > 0) c.nitroT -= dt;
    // dirección
    const turnF = Math.min(1, sp / 45) * (1 - PH.TURNHI * Math.min(1, sp / PH.VMAX));
    c.a = wrapA(c.a + c.steer * turn * turnF * Math.sign(vf || 1) * dt);
    const nx = Math.cos(c.a), ny = Math.sin(c.a);
    vf = c.vx * nx + c.vy * ny;
    let vl = -c.vx * ny + c.vy * nx;
    if (surf === TIERRA) vmaxEff *= 1 - 0.07 * offK;
    if (c.shiftT > 0) c.shiftT -= dt;
    if (c.thr > 0 && !c.dead) {
      if (vf < -2) vf += brake * c.thr * dt;
      else {
        const f = Math.max(0, 1 - (vf / vmaxEff) ** 2);
        vf += acc * c.thr * f * (c.shiftT > 0 ? 0.4 : 1) * dt;
      }
    }
    if (c.brk > 0) {
      if (vf > 3) vf = Math.max(0, vf - brake * c.brk * dt);
      else vf = Math.max(-PH.REV, vf - 140 * c.brk * dt);
    }
    if (!(c.thr > 0) && !(c.brk > 0)) vf -= Math.sign(vf) * Math.min(Math.abs(vf), PH.DRAG * (c.dead ? 4 : 1) * dt);
    if (vf > vmaxEff + (c.lim ? 0.3 : 5)) vf -= Math.min(vf - vmaxEff, (c.lim ? 260 : 120) * dt); // tras el nitro o con limitador
    if (c.dead) { vf *= Math.exp(-2.5 * dt); vl *= Math.exp(-2.5 * dt); }
    const off = (v, d) => { if (Math.abs(vf) > v) vf -= Math.sign(vf) * d * offK * dt; };
    if (surf === PASTO) off(PH.GRASSV + 30 * (1 - offK), PH.GRASSDRAG);
    if (surf === TRAMPA) off(PH.SANDV, PH.SANDDRAG);
    if (surf === ARENA) off(PH.DESV + 30 * (1 - offK), PH.DESDRAG);
    // agarre lateral
    if (surf === PASTO || surf === ARENA || surf === TRAMPA) grip *= 0.55 + 0.2 * (1 - offK);
    if (surf === TIERRA) grip *= 0.72 + 0.15 * (1 - offK);
    if (c.brk > 0 && sp > 110 && Math.abs(c.steer) > 0.5) grip *= 0.5;
    if (c.oilT > 0) { c.oilT -= dt; grip *= 0.22; }
    if (race.rain) grip *= 0.8;
    vl *= Math.exp(-grip * dt);
    c.slip = Math.abs(vl);
    c.vx = nx * vf - ny * vl; c.vy = ny * vf + nx * vl;
    c.x += c.vx * dt; c.y += c.vy * dt;
    c.vf = vf;
    // desgaste del jugador
    if (c.dmg && !c.dead) {
      let w = 0;
      if ((surf === PASTO || surf === ARENA || surf === TRAMPA) && sp > 40) w += 1.1 * offK;
      if (surf === TIERRA) w += 0.25 * offK;
      if (c.slip > 40) w += (c.slip - 40) / 50;
      if (w > 0) hurt(race, c, 'gomas', w * dt);
    }
    let g = 1; for (let k = 1; k < GEARS.length; k++) if (vf > GEARS[k]) g = k + 1;
    if (g > c.gear) { c.shiftT = 0.12; race.events.push({ type: 'shift', car: c }); }
    c.gear = g;
    // muro blando lejos de la pista
    if (Math.abs(c.lat) > HW + 230) {
      const p = race.trk.pts[c.i], sg = Math.sign(c.lat);
      const vn = c.vx * p.nx * sg + c.vy * p.ny * sg;
      if (vn > 0) { c.vx -= p.nx * sg * vn * 1.3; c.vy -= p.ny * sg * vn * 1.3; }
    }
  }

  function circles(c) {
    const fx = Math.cos(c.a) * T.PH.OFF, fy = Math.sin(c.a) * T.PH.OFF;
    return [[c.x + fx, c.y + fy], [c.x - fx, c.y - fy]];
  }

  function collide(race, dt) {
    const cars = race.cars, R = T.PH.R, e = 0.25;
    for (let i = 0; i < cars.length; i++) {
      const a = cars[i];
      for (let j = i + 1; j < cars.length; j++) {
        const b = cars[j];
        if (a.finished || b.finished) continue; // los que llegaron ya no chocan
        if (Math.abs(a.x - b.x) > 30 || Math.abs(a.y - b.y) > 30) continue;
        const ca = circles(a), cb = circles(b);
        for (const pa of ca) for (const pb of cb) {
          let dx = pb[0] - pa[0], dy = pb[1] - pa[1], d = Math.hypot(dx, dy);
          if (d >= 2 * R || d < 1e-6) continue;
          dx /= d; dy /= d;
          const ov = (2 * R - d) / 2;
          a.x -= dx * ov; a.y -= dy * ov; b.x += dx * ov; b.y += dy * ov;
          const vr = (b.vx - a.vx) * dx + (b.vy - a.vy) * dy;
          if (vr < 0) {
            const jimp = -(1 + e) * vr / 2;
            a.vx -= jimp * dx; a.vy -= jimp * dy; b.vx += jimp * dx; b.vy += jimp * dy;
            if (-vr > 25 && a.hitT <= 0 && b.hitT <= 0) {
              a.hitT = b.hitT = 0.25;
              race.events.push({ type: 'hit', car: a, other: b, x: (pa[0] + pb[0]) / 2, y: (pa[1] + pb[1]) / 2, v: -vr });
              for (const c of [a, b]) if (c.dmg) { hurt(race, c, 'chasis', (-vr - 25) * 0.09); hurt(race, c, 'motor', (-vr - 25) * 0.02); }
            }
          }
        }
      }
    }
    // neumáticos y rocas
    const grid = race.trk.scen.cgrid;
    for (const c of cars) {
      if (c.hitT > 0) c.hitT -= dt;
      const gx = Math.floor(c.x / 64), gy = Math.floor(c.y / 64);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const list = grid.get((gx + ox) + ',' + (gy + oy));
        if (!list) continue;
        for (const t of list) for (const pc of circles(c)) {
          let dx = pc[0] - t.x, dy = pc[1] - t.y, d = Math.hypot(dx, dy);
          const rr = R + t.r;
          if (d >= rr || d < 1e-6) continue;
          dx /= d; dy /= d;
          c.x += dx * (rr - d); c.y += dy * (rr - d);
          const vn = c.vx * dx + c.vy * dy;
          if (vn < 0) {
            const rock = t.kind === 'rock';
            c.vx -= (rock ? 1.2 : 1.35) * vn * dx; c.vy -= (rock ? 1.2 : 1.35) * vn * dy;
            c.vx *= rock ? 0.6 : 0.8; c.vy *= rock ? 0.6 : 0.8;
            if (-vn > 25 && c.hitT <= 0) {
              c.hitT = 0.3;
              race.events.push({ type: rock ? 'rock' : 'tire', car: c, x: t.x, y: t.y, v: -vn });
              if (c.dmg) {
                if (rock) { hurt(race, c, 'chasis', 2 + -vn * 0.04); hurt(race, c, 'gomas', 1 + -vn * 0.02); hurt(race, c, 'motor', -vn * 0.02); }
                else hurt(race, c, 'chasis', (-vn - 20) * 0.16);
              }
            }
          }
        }
      }
    }
  }

  // velocidad máxima sostenible para una curvatura
  function vCurve(k, m) { const PH = T.PH; return m * PH.TURN / (Math.abs(k) + PH.TURN * PH.TURNHI / PH.VMAX); }
  T.vCurve = vCurve;

  function aiControl(race, c, dt) {
    const trk = race.trk, PH = T.PH, N = trk.N, pts = trk.pts;
    const sp = Math.hypot(c.vx, c.vy);
    const sk = c.skillEff;
    if (race.t < c.react) { c.thr = 0; c.brk = 0; c.steer = 0; return; }
    const look = 24 + sp * 0.3;
    const li = Math.min(N - 1, c.i + Math.round(look / trk.DS));
    const pt = pts[li];
    const fx = Math.cos(c.a), fy = Math.sin(c.a);
    if (c.avoidT > 0) c.avoidT -= dt; else c.avoid = 0;
    let slow = false;
    const obstacle = (dx, dy, osp, wide) => {
      const al = dx * fx + dy * fy;
      if (al <= 0 || al > 60 + sp * 0.25) return;
      const lt = -dx * fy + dy * fx;
      if (Math.abs(lt) < wide && osp < sp - 4) {
        if (c.avoidT <= 0) { c.avoid = (lt > 0 ? -1 : 1) * (wide + 6); c.avoidT = 0.7; }
        if (al < 26 && Math.abs(lt) < 11) slow = true;
      }
    };
    for (const o of race.cars) if (o !== c) obstacle(o.x - c.x, o.y - c.y, Math.hypot(o.vx, o.vy), 15);
    const gx = Math.floor(c.x / 64), gy = Math.floor(c.y / 64);
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      const l = trk.scen.cgrid.get((gx + ox) + ',' + (gy + oy));
      if (l) for (const t of l) if (t.kind === 'rock') obstacle(t.x - c.x, t.y - c.y, 0, 15);
    }
    for (const o of trk.scen.oil) if (Math.abs(o.x - c.x) < 120 && Math.abs(o.y - c.y) < 120) obstacle(o.x - c.x, o.y - c.y, 0, o.r + 6);
    for (const o of race.crossers) if (!o.hit) obstacle(o.x + o.vx * 0.4 - c.x, o.y + o.vy * 0.4 - c.y, 0, 16);
    let lane = pt.rl * c.lineUse + c.laneOff + c.avoid;
    if (Math.abs(c.lat) > HW + 4) lane = 0;
    lane = clamp(lane, -HW + 9, HW - 9);
    const tx = pt.x + pt.nx * lane, ty = pt.y + pt.ny * lane;
    const want = Math.atan2(ty - c.y, tx - c.x);
    const diff = wrapA(want - c.a);
    c.steer = clamp(diff * 2.8, -1, 1);
    // velocidad objetivo
    let m = (0.66 + 0.32 * sk);
    if (race.rain) m *= 0.9;
    if (pts[c.i].dirt) m *= 0.9;
    let vt = PH.VMAX * 1.3;
    const bd = PH.BRAKE * 0.75;
    const n = Math.ceil((sp * sp / (2 * bd) + 40) / trk.DS);
    for (let k = 0; k <= n; k++) {
      const q = pts[Math.min(N - 1, c.i + k)];
      const va = vCurve(q.k, q.dirt ? m * 0.9 : m);
      const vr = Math.sqrt(va * va + 2 * bd * k * trk.DS);
      if (vr < vt) vt = vr;
    }
    if (c.finished) vt = c.p > trk.finishS - trk.startS + 90 ? 0 : Math.min(vt, 60);
    if (trk.scen.yellows.some(yz => c.s > yz.s0 && c.s < yz.s1)) vt = Math.min(vt, T.YLIM);
    if (slow) vt = Math.min(vt, sp - 10);
    if (sp > vt + 4) { c.thr = 0; c.brk = clamp((sp - vt) / 25, 0.2, 1); }
    else if (sp > vt) { c.thr = 0.25; c.brk = 0; }
    else { c.thr = 1; c.brk = 0; }
    if (race.t > 3 && sp < 6 && c.revT <= 0) { c.stuckT += dt; if (c.stuckT > 1.2) { c.revT = 0.9; c.stuckT = 0; } }
    else if (sp >= 6) c.stuckT = 0;
    if (c.revT > 0) { c.revT -= dt; c.thr = 0; c.brk = 1; c.steer = -c.steer; }
  }

  function playerControl(c, pin, dt) {
    const tgt = (pin.left ? -1 : 0) + (pin.right ? 1 : 0);
    const rate = 7;
    if (c.steer < tgt) c.steer = Math.min(tgt, c.steer + rate * dt);
    else if (c.steer > tgt) c.steer = Math.max(tgt, c.steer - rate * dt);
    c.thr = pin.up ? 1 : 0;
    c.brk = pin.down ? 1 : 0;
  }

  T.step = function (race, dt, pin) {
    const trk = race.trk, cars = race.cars, pl = race.player;
    const run = race.phase === 'run';
    if (run) race.t += dt;
    for (const c of cars) {
      if (!run) { c.vx = c.vy = 0; c.thr = c.brk = 0; continue; }
      c.draft = 0;
      const fx = Math.cos(c.a), fy = Math.sin(c.a);
      for (const o of cars) {
        if (o === c) continue;
        const dx = o.x - c.x, dy = o.y - c.y, al = dx * fx + dy * fy;
        if (al > 20 && al < 80 && Math.abs(-dx * fy + dy * fx) < 10) { c.draft = 0.04; break; }
      }
      if (!c.isPlayer) {
        let mod = 0;
        if (!pl.finished && !pl.dead) {
          const gap = c.p - pl.p;
          if (gap > 400) mod = -Math.min(0.03, (gap - 400) / 6000);
          else if (gap < -200) mod = Math.min(0.15, (-gap - 200) / 2000);
        }
        c.skillEff = c.skill + mod;
      }
      if (c.dead) { c.thr = 0; c.brk = 0; c.steer = 0; }
      else if (c.isPlayer && !c.finished && !race.autopilotAll && pin) playerControl(c, pin, dt);
      else aiControl(race, c, dt);
      c.surf = T.surface(trk, c.i, c.lat);
      physics(race, c, dt);
    }
    if (run) collide(race, dt);
    for (const c of cars) {
      const loc = T.locate(trk, c.x, c.y, c.i);
      const ds = clamp(loc.s - c.s, -60, 60);
      c.i = loc.i; c.s = loc.s; c.lat = loc.lat;
      if (!run) continue;
      c.p += ds;
      const p = trk.pts[c.i];
      const dot = Math.cos(c.a) * p.tx + Math.sin(c.a) * p.ty;
      const sp = Math.hypot(c.vx, c.vy);
      if (dot < -0.4 && sp > 20) c.wrongT += dt; else c.wrongT = Math.max(0, c.wrongT - dt * 2);
      if (!c.finished && !c.dead && c.p >= trk.finishS - trk.startS) {
        c.finished = true; c.finishTime = race.t; race.finishOrder.push(c);
        race.events.push({ type: 'finish', car: c, pos: race.finishOrder.length });
      }
    }
    // aceite
    if (run) for (const c of cars) for (const o of trk.scen.oil) {
      if (Math.abs(c.x - o.x) > o.r || Math.abs(c.y - o.y) > o.r) continue;
      if ((c.x - o.x) ** 2 + (c.y - o.y) ** 2 < o.r * o.r) {
        if (!(c.oilT > 0) && Math.hypot(c.vx, c.vy) > 40) race.events.push({ type: 'oil', car: c, x: c.x, y: c.y });
        c.oilT = 0.7;
      }
    }
    if (run) updCrossers(race, dt);
    // bandera amarilla: no adelantar
    if (run && trk.scen.yellows.length && !pl.finished && !pl.dead) {
      const inZ = trk.scen.yellows.some(yz => pl.s >= yz.s0 && pl.s <= yz.s1);
      if (inZ && !race.yIn) { race.yIn = true; race.yAhead = new Set(cars.filter(c => c !== pl && c.p > pl.p).map(c => c.id)); race.events.push({ type: 'yellowIn' }); }
      if (inZ) for (const c of cars) if (race.yAhead.has(c.id) && pl.p > c.p + 4) {
        race.yAhead.delete(c.id); race.penalty += 5; race.events.push({ type: 'penalty', car: c, x: pl.x, y: pl.y });
      }
      if (!inZ && race.yIn) { race.yIn = false; race.events.push({ type: 'yellowOut' }); }
    }
    // auto coleccionable
    const col = trk.scen.coleccion;
    if (run && col && !col.taken && !pl.dead && (pl.x - col.x) ** 2 + (pl.y - col.y) ** 2 < 17 * 17) {
      col.taken = true; race.collected = col.id; race.events.push({ type: 'coleccion', id: col.id, x: col.x, y: col.y });
    }
    // objetos (solo el jugador)
    if (run && !pl.dead && !pl.finished) {
      const mag = pl.stats.magnet ? 46 : 0;
      for (const o of trk.scen.pickups) {
        if (o.taken) continue;
        const dx = pl.x - o.x, dy = pl.y - o.y, d2 = dx * dx + dy * dy;
        if (mag && d2 < mag * mag) { const d = Math.sqrt(d2) || 1; o.x += dx / d * 160 * dt; o.y += dy / d * 160 * dt; }
        if (d2 < 15 * 15) {
          o.taken = true;
          applyPickup(race, pl, o);
        }
      }
    }
    // fuera de tiempo: 40 s después del ganador
    if (run && !pl.finished && !pl.dead && race.finishOrder.length && race.t > race.finishOrder[0].finishTime + 40 && !race.timeout) {
      race.timeout = true; race.events.push({ type: 'timeout' });
    }
  };

  // gente, animales y objetos que cruzan la pista
  const CRUZAN = {
    europa: ['persona', 'perro', 'ciervo', 'persona'], japon: ['persona', 'perro', 'ciervo', 'persona'],
    america: ['persona', 'perro', 'gallina', 'pelota'], sahara: ['persona', 'perro', 'rodadora', 'rodadora'],
  };
  const VEL = { persona: 30, perro: 48, ciervo: 58, gallina: 34, rodadora: 44, pelota: 50 };
  T.CRUZAN = CRUZAN;
  function updCrossers(race, dt) {
    const trk = race.trk, pl = race.player, R = race.R;
    race.crossT -= dt;
    if (race.crossT <= 0 && !pl.finished) {
      race.crossT = 5 + R() * 8;
      const s = pl.s + 230 + R() * 140;
      if (s < trk.finishS - 60 && !trk.scen.yellows.some(yz => s > yz.s0 - 100 && s < yz.s1 + 50)) {
        const p = trk.pts[clamp(Math.round(s / trk.DS), 0, trk.N - 1)], side = R() < 0.5 ? 1 : -1;
        const pool = CRUZAN[trk.tema] || CRUZAN.europa, type = pool[Math.floor(R() * pool.length)];
        const v = VEL[type] * (0.8 + R() * 0.4), lat = side * (HW + 24);
        race.crossers.push({ type, x: p.x + p.nx * lat, y: p.y + p.ny * lat, vx: -p.nx * side * v, vy: -p.ny * side * v, z: 0, vz: 0, t: 0, hit: false, v: Math.floor(R() * 3) });
      }
    }
    for (const o of race.crossers) {
      o.t += dt; o.x += o.vx * dt; o.y += o.vy * dt;
      if (o.hit) { o.z += o.vz * dt; o.vz -= 260 * dt; if (o.z < 0) { o.z = 0; o.vz = 0; o.vx *= 0.8; o.vy *= 0.8; } continue; }
      let done = false;
      for (const c of race.cars) {
        if (done) break;
        for (const pc of circles(c)) {
          const dx = o.x - pc[0], dy = o.y - pc[1];
          if (dx * dx + dy * dy > (T.PH.R + 5) ** 2) continue;
          o.hit = true; done = true;
          const sp = Math.hypot(c.vx, c.vy);
          if (o.type === 'persona') { // la persona salta a tiempo; multa por el susto
            const d = Math.hypot(dx, dy) || 1; o.vx = dx / d * 140; o.vy = dy / d * 140; o.vz = 90;
            if (c.dmg) race.fines += 40;
          } else { o.vx = c.vx * 0.7 + dx * 4; o.vy = c.vy * 0.7 + dy * 4; o.vz = 60 + sp * 0.3; }
          const slow = o.type === 'ciervo' ? 0.7 : o.type === 'rodadora' || o.type === 'pelota' ? 0.97 : 0.88;
          c.vx *= slow; c.vy *= slow;
          if (c.dmg) {
            if (o.type === 'ciervo') hurt(race, c, 'chasis', 8 + sp * 0.04);
            else if (o.type === 'perro' || o.type === 'gallina') hurt(race, c, 'chasis', 3);
          }
          race.events.push({ type: 'crosser', kind: o.type, car: c, x: o.x, y: o.y });
          break;
        }
      }
    }
    race.crossers = race.crossers.filter(o => o.t < 14 && Math.hypot(o.x - pl.x, o.y - pl.y) < 900);
  }

  function applyPickup(race, c, o) {
    const ev = { type: 'pickup', kind: o.type, x: o.x, y: o.y };
    if (o.type === 'cash') { const v = 10 + Math.floor(Math.random() * 3) * 5; race.cash += v; ev.val = v; }
    else if (o.type === 'llave') { const v = Math.min(12, 100 - c.dmg.chasis); c.dmg.chasis += v; ev.val = v; }
    else if (o.type === 'goma') { const v = Math.min(15, 100 - c.dmg.gomas); c.dmg.gomas += v; ev.val = v; }
    else if (o.type === 'aceite') { const v = Math.min(12, 100 - c.dmg.motor); c.dmg.motor += v; ev.val = v; }
    else if (o.type === 'nitro') { c.nitroT = Math.max(c.nitroT, 0) + 3; }
    else if (o.type === 'caja') race.got.push('caja');
    race.events.push(ev);
  }

  T.standings = function (race) {
    return race.cars.slice().sort((a, b) => {
      if (a.dead !== b.dead) return a.dead ? 1 : -1;
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1; if (b.finished) return 1;
      return b.p - a.p;
    });
  };

  // tiempos finales (estima los que no llegaron todavía)
  T.results = function (race) {
    const trk = race.trk, dist = trk.finishS - trk.startS;
    return T.standings(race).map(c => {
      let t = c.finishTime;
      if (!c.finished) {
        const v = Math.max(60, c.p / Math.max(1, race.t));
        t = race.t + Math.max(0, dist - c.p) / v;
        if (c.isPlayer) t += 30; // penalización por no terminar
      }
      if (c.isPlayer) t += race.penalty;
      return { car: c, time: t, est: !c.finished };
    }).sort((a, b) => (a.car.dead - b.car.dead) || (a.time - b.time));
  };

  T.fmt = function (t) {
    if (!(t >= 0)) return "-'--\"--";
    const m = Math.floor(t / 60), s = Math.floor(t % 60), c = Math.floor((t * 100) % 100);
    return m + "'" + String(s).padStart(2, '0') + '"' + String(c).padStart(2, '0');
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = T;
  else G.T40 = T;
})(typeof window !== 'undefined' ? window : globalThis);
