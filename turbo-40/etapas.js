// TURBO 40 — generador de etapas punto a punto con secciones inspiradas en circuitos reales.
// Cada sección es una lista de pasos: ['S', largo] recta, ['C', grados, radio] curva (+ = derecha).
(function (G) {
  'use strict';
  const E = {};

  E.REGIONES = [
    { id: 'europa', nombre: 'EUROPA', tema: 'europa' },
    { id: 'japon', nombre: 'JAPÓN', tema: 'japon' },
    { id: 'america', nombre: 'AMÉRICAS', tema: 'america' },
    { id: 'oriente', nombre: 'MEDIO ORIENTE', tema: 'sahara' },
  ];

  E.SECCIONES = {
    europa: [
      { n: 'VARIANTE', ref: 'MONZA', p: [['S', 320], ['C', -70, 55], ['C', 70, 55], ['S', 220]] },
      { n: 'PARABÓLICA', ref: 'MONZA', p: [['S', 260], ['C', 105, 135], ['S', 320]] },
      { n: 'EAU ROUGE', ref: 'SPA', p: [['C', -35, 110], ['C', 70, 110], ['C', -40, 170], ['S', 520]] },
      { n: 'POUHON', ref: 'SPA', p: [['C', -95, 150], ['S', 180]] },
      { n: 'HORQUILLA', ref: 'MÓNACO', p: [['S', 140], ['C', 140, 52], ['S', 160]] },
      { n: 'PISCINA', ref: 'MÓNACO', p: [['C', -30, 70], ['C', 30, 70], ['S', 70], ['C', 30, 70], ['C', -30, 70], ['S', 140]] },
      { n: 'KARUSSELL', ref: 'NÜRBURGRING', p: [['C', 130, 75], ['S', 220]] },
      { n: 'INFIERNO VERDE', ref: 'NORDSCHLEIFE', p: [['C', 35, 140], ['C', -50, 120], ['C', 45, 130], ['C', -35, 170], ['S', 160]] },
    ],
    japon: [
      { n: 'LAS S', ref: 'SUZUKA', p: [['C', 45, 100], ['C', -60, 100], ['C', 60, 100], ['C', -45, 100], ['S', 160]] },
      { n: '130R', ref: 'SUZUKA', p: [['S', 360], ['C', -75, 230], ['S', 260]] },
      { n: 'SPOON', ref: 'SUZUKA', p: [['C', -60, 90], ['C', -50, 120], ['S', 380]] },
      { n: 'HORQUILLA', ref: 'SUZUKA', p: [['S', 120], ['C', 145, 55], ['S', 180]] },
      { n: 'TOUGE', ref: 'HAKONE', p: [['C', 100, 62], ['S', 60], ['C', -100, 62], ['S', 60], ['C', 80, 70], ['S', 120]] },
      { n: 'RECTA FUJI', ref: 'FUJI', p: [['S', 700], ['C', 90, 70], ['S', 120]] },
    ],
    america: [
      { n: 'S DE SENNA', ref: 'INTERLAGOS', p: [['C', -80, 70], ['C', 55, 90], ['S', 260]] },
      { n: 'CURVA DO LAGO', ref: 'INTERLAGOS', p: [['C', 100, 120], ['S', 240]] },
      { n: 'SACACORCHOS', ref: 'LAGUNA SECA', p: [['C', -60, 60], ['C', 85, 60], ['S', 200]] },
      { n: 'PERALTADA', ref: 'MÉXICO', p: [['S', 200], ['C', 120, 130], ['S', 260]] },
      { n: 'LAS S', ref: 'AUSTIN', p: [['C', -45, 100], ['C', 55, 100], ['C', -55, 100], ['C', 45, 100], ['S', 180]] },
      { n: 'HORQUILLA', ref: 'MONTREAL', p: [['S', 300], ['C', 150, 52], ['S', 280]] },
    ],
    oriente: [
      { n: 'CURVA 4', ref: 'BAHRÉIN', p: [['S', 600], ['C', 95, 60], ['S', 200]] },
      { n: 'CURVAS 9 Y 10', ref: 'BAHRÉIN', p: [['C', -80, 90], ['C', -60, 70], ['S', 240]] },
      { n: 'CHICANA', ref: 'ABU DABI', p: [['S', 300], ['C', -60, 55], ['C', 60, 55], ['S', 300]] },
      { n: 'RECTA LARGA', ref: 'ABU DABI', p: [['S', 750], ['C', 90, 75], ['S', 120]] },
      { n: 'CURVAS RÁPIDAS', ref: 'YEDA', p: [['C', 30, 220], ['C', -35, 200], ['C', 30, 220], ['C', -30, 220], ['S', 200]] },
      { n: 'HORQUILLA', ref: 'YEDA', p: [['S', 200], ['C', 140, 55], ['S', 200]] },
    ],
  };

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
        curve(d / D2R, 160); straight(150);
        continue;
      }
      prev = pick.j;
      const sec = pick.sec;
      const dirt = false; // todo asfalto
      const rocks = opts.tipo === 'rally' && R() < 0.5; // obstáculos en la pista
      // conector
      cur = { dirt: false, rocks: false };
      straight(80 + R() * 170);
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
      const need = (j - i) * STEP < 700 ? 118 : 230; // zigzags cercanos permitidos
      if (dx * dx + dy * dy < need * need) return null;
    }
    return { poly, flags, marks, startS, finishS, length: s, h0 };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = E;
  else G.ETAPAS = E;
})(typeof window !== 'undefined' ? window : globalThis);
