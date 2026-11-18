// TURBO 40 — road trip de Alaska a Tierra del Fuego: generador de etapas punto a punto.
// Cada sección es una lista de pasos: ['S', largo] recta, ['C', grados, radio] curva (+ = derecha).
(function (G) {
  'use strict';
  const E = {};

  // road trip por la Panamericana: de Alaska a Tierra del Fuego.
  // Cada tramo tiene pueblos de destino (filas del mapa; el último es la gran etapa) y cada pueblo su paisaje.
  E.SALIDA = { n: 'DEADHORSE', lon: -148.4, lat: 70.2 };
  E.REGIONES = [
    { id: 'alaska', nombre: 'ALASKA', tema: 'nieve', pool: { rectaLarga: 1, recta: 1, curva90: 3, curvaLarga: 2, eses: 2, curvaCiega: 2, chicana: 1 },
      pueblos: [{ n: 'FAIRBANKS', lon: -147.7, lat: 64.8, tema: 'nieve' }, { n: 'TOK', lon: -143, lat: 63.3, tema: 'nieve' }, { n: 'WHITEHORSE', lon: -135, lat: 60.7, tema: 'nieve', jefe: 'AUTOPISTA DE ALASKA' }] },
    { id: 'canada', nombre: 'CANADÁ', tema: 'bosque', pool: { eses: 3, horquilla: 2, zigzag: 2, curvaCiega: 3, curvaLarga: 2, recta: 1 },
      pueblos: [{ n: 'FORT NELSON', lon: -122.7, lat: 58.8, tema: 'bosque' }, { n: 'PRINCE GEORGE', lon: -122.7, lat: 53.9, tema: 'bosque' }, { n: 'VANCOUVER', lon: -123.1, lat: 49.3, tema: 'bosque', jefe: 'CAÑÓN DEL FRASER' }] },
    { id: 'eeuu', nombre: 'ESTADOS UNIDOS', tema: 'california', pool: { costa: 3, rectaLarga: 2, curva90: 2, eses: 2, chicana: 2, horquilla: 1 },
      pueblos: [{ n: 'SAN FRANCISCO', urbano: true, lon: -122.4, lat: 37.8, tema: 'california' }, { n: 'LOS ÁNGELES', urbano: true, lon: -118.2, lat: 34, tema: 'california' }, { n: 'NOGALES', lon: -111, lat: 31.3, tema: 'desierto', jefe: 'DESIERTO DE SONORA' }] },
    { id: 'centro', nombre: 'MÉXICO Y CENTROAMÉRICA', tema: 'desierto', pool: { esquina: 3, curva90: 2, eses: 2, horquilla: 2, zigzag: 1, costa: 2 },
      pueblos: [{ n: 'CIUDAD DE MÉXICO', urbano: true, lon: -99.1, lat: 19.4, tema: 'desierto' }, { n: 'GUATEMALA', lon: -90.5, lat: 14.6, tema: 'selva' }, { n: 'PANAMÁ', lon: -79.5, lat: 9, tema: 'selva', jefe: 'RUTA DE LOS VOLCANES' }],
      nota: 'EN EL TAPÓN DEL DARIÉN NO HAY CAMINO: EMBARCAS EL AUTO DE PANAMÁ A CARTAGENA.' },
    { id: 'andes', nombre: 'LOS ANDES', tema: 'andes', pool: { horquilla: 3, zigzag: 3, curvaCiega: 2, eses: 2, curva90: 1, rectaLarga: 1 },
      pueblos: [{ n: 'QUITO', lon: -78.5, lat: -0.2, tema: 'andes' }, { n: 'LIMA', urbano: true, lon: -77, lat: -12, tema: 'atacama' }, { n: 'ARICA', lon: -70.3, lat: -18.5, tema: 'atacama', jefe: 'PAMPA DE NAZCA' }],
      desde: { n: 'CARTAGENA', lon: -75.5, lat: 10.4 } },
    { id: 'patagonia', nombre: 'PATAGONIA', tema: 'estepa', pool: { rectaLarga: 2, curva90: 2, curvaCiega: 2, eses: 2, horquilla: 1, curvaLarga: 2 },
      pueblos: [{ n: 'SANTIAGO', urbano: true, lon: -70.7, lat: -33.4, tema: 'andes' }, { n: 'BARILOCHE', lon: -71.3, lat: -41.1, tema: 'bosque' }, { n: 'EL CALAFATE', lon: -72.3, lat: -50.3, tema: 'estepa' }, { n: 'USHUAIA', lon: -68.3, lat: -54.8, tema: 'nieve', jefe: 'FIN DEL MUNDO' }] },
  ];

  // piezas de camino (todas con curvas que obligan a frenar; + = derecha)
  E.PIEZAS = {
    recta: { n: 'RECTA', p: [['S', 520]] },
    rectaLarga: { n: 'RECTA LARGA', p: [['S', 950]] },
    curva90: { n: 'CURVA DE 90', p: [['S', 140], ['C', 90, 44], ['S', 150]] },
    curvaCiega: { n: 'CURVA CIEGA', p: [['C', 80, 36], ['S', 170]] },
    horquilla: { n: 'HORQUILLA', p: [['S', 90], ['C', 155, 38], ['S', 110]] },
    zigzag: { n: 'ZIGZAG', p: [['C', 75, 40], ['S', 40], ['C', -150, 36], ['S', 40], ['C', 75, 40], ['S', 80]] },
    eses: { n: 'ESES', p: [['C', 55, 52], ['C', -75, 46], ['C', 75, 46], ['C', -55, 52], ['S', 120]] },
    chicana: { n: 'CHICANA', p: [['S', 220], ['C', -55, 32], ['C', 55, 32], ['S', 200]] },
    curvaLarga: { n: 'CURVA LARGA', p: [['C', 125, 78], ['S', 200]] },
    esquina: { n: 'PUEBLO', p: [['S', 150], ['C', 90, 26], ['S', 110], ['C', -90, 26], ['S', 150]] },
    costa: { n: 'CAMINO COSTERO', p: [['C', 45, 62], ['C', -70, 50], ['C', 55, 58], ['C', -50, 66], ['S', 110]] },
  };
  E.SECCIONES = {};
  for (const reg of E.REGIONES) {
    E.SECCIONES[reg.id] = [];
    for (const k in reg.pool) for (let w = 0; w < reg.pool[k]; w++) E.SECCIONES[reg.id].push(Object.assign({ id: k, ref: reg.nombre }, E.PIEZAS[k]));
  }

  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0; let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const D2R = Math.PI / 180, STEP = 8, LIMIT = 105 * D2R;

  // devuelve los rumbos que tomaría una sección (para respetar el límite de giro)
  function heads(p, h, sign) {
    const out = [];
    for (const st of p) if (st[0] === 'C') { h += st[1] * D2R * sign; out.push(h); }
    return out;
  }

  // opts: {region, tipo: 'carrera'|'rally'|'jefe', largo}
  E.generar = function (seed, opts) {
    for (let intento = 0; intento < 40; intento++) {
      const r = intentar(seed * 7919 + intento * 104729, opts);
      if (r) return r;
    }
    throw new Error('no se pudo generar la etapa');
  };

  function intentar(seed, opts) {
    const R = rng(seed);
    const pool = E.SECCIONES[opts.region];
    const h0 = R() * Math.PI * 2;
    let h = h0, x = 0, y = 0;
    const poly = [[x, y]], marks = []; // marks: {s0,s1,n,ref,dirt,rocks}
    let s = 0;
    const flags = []; // por punto: {dirt, rocks}
    let cur = { dirt: false, rocks: false };
    const emit = () => { poly.push([x, y]); flags.push(cur); };
    flags.push(cur);
    const straight = L => { const n = Math.max(1, Math.ceil(L / STEP)); for (let i = 0; i < n; i++) { x += Math.cos(h) * L / n; y += Math.sin(h) * L / n; s += L / n; emit(); } };
    const curve = (deg, r) => {
      const a = deg * D2R, len = r * Math.abs(a), n = Math.max(2, Math.ceil(len / STEP)), dh = a / n;
      for (let i = 0; i < n; i++) { h += dh / 2; x += Math.cos(h) * len / n; y += Math.sin(h) * len / n; h += dh / 2; s += len / n; emit(); }
    };
    const runSteps = (p, sign) => { for (const st of p) st[0] === 'S' ? straight(st[1]) : curve(st[1] * sign, st[2]); };
    // largada: recta para la grilla
    straight(420);
    const startS = 300;
    const target = opts.largo;
    let prev = -1;

    while (s < target - 500) {
      // elegir sección que respete el límite de rumbo
      let pick = null;
      for (let k = 0; k < 12 && !pick; k++) {
        const j = Math.floor(R() * pool.length);
        if (j === prev && pool.length > 1) continue;
        const sec = pool[j];
        const signs = R() < 0.5 ? [1, -1] : [-1, 1];
        for (const sg of signs) {
          const hs = heads(sec.p, h, sg);
          if (hs.every(v => Math.abs(v - h0) < LIMIT)) { pick = { sec, sg, j }; break; }
        }
      }
      if (!pick) { // enderezar hacia el rumbo inicial
        const d = h0 - h;
        cur = { dirt: cur.dirt, rocks: false };
        curve(d / D2R, 70); straight(150);
        continue;
      }
      prev = pick.j;
      const sec = pick.sec;
      const dirt = false; // todo asfalto
      const rocks = opts.tipo === 'rally' && R() < 0.5; // obstáculos en la pista
      // conector
      cur = { dirt: false, rocks: false };
      straight(60 + R() * 150);
      cur = { dirt, rocks };
      const s0 = s;
      runSteps(sec.p, pick.sg);
      marks.push({ s0, s1: s, n: sec.n, ref: sec.ref, dirt, rocks });
    }
    cur = { dirt: false, rocks: false };
    straight(560);
    const finishS = s - 360;
    // comprobar que el trazado no se cruce consigo mismo
    const n = poly.length, gap = Math.ceil(320 / STEP);
    for (let i = 0; i < n; i += 3) for (let j = i + gap; j < n; j += 3) {
      const dx = poly[i][0] - poly[j][0], dy = poly[i][1] - poly[j][1];
      const need = (j - i) * STEP < 700 ? 84 : 190; // zigzags cercanos permitidos
      if (dx * dx + dy * dy < need * need) return null;
    }
    return { poly, flags, marks, startS, finishS, length: s, h0 };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = E;
  else G.ETAPAS = E;
})(typeof window !== 'undefined' ? window : globalThis);
