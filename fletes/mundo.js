// FLETES — el mundo: calles de OpenStreetMap convertidas en un grafo, rutas del GPS, terreno, edificios y depósitos.
// No toca el DOM: corre igual en el navegador y en Node (medir.js).
// Ejes en metros: +x al este, +y al sur (así el norte queda arriba a la derecha en la vista isométrica).
(function (G) {
  'use strict';
  const MU = {};

  // ---------- clases de vía: semiancho de calzada [m], velocidad máxima [m/s], si lleva vereda ----------
  MU.CLASES = {
    motorway: { hw: 4.6, vmax: 25, berma: 2.2, n: 'AUTOPISTA' },
    trunk: { hw: 4.8, vmax: 22, berma: 1.6, n: 'AVENIDA' },
    primary: { hw: 4.8, vmax: 16.7, vereda: 2.6, n: 'AVENIDA' },
    secondary: { hw: 4.6, vmax: 13.9, vereda: 2.4 },
    tertiary: { hw: 4.4, vmax: 13.9, vereda: 2.2 },
    unclassified: { hw: 4.0, vmax: 11.1, vereda: 1.6 },
    residential: { hw: 4.0, vmax: 11.1, vereda: 2.0 },
    living_street: { hw: 3.4, vmax: 5.6, vereda: 1.6 },
    link: { hw: 3.8, vmax: 13.9, berma: 1.2 },
  };
  MU.ORDEN_CLASES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'link'];

  // ---------- terreno (grilla gruesa de cada ciudad) ----------
  MU.TER = { CAMPO: 0, URBANO: 1, INDUSTRIA: 2, PASTO: 3, BOSQUE: 4, ARENA: 5, AGUA: 6, PLAZA: 7, HUMEDAL: 8 };

  function decodeRLE(s, n) {
    const out = new Uint8Array(n); let k = 0;
    for (let i = 0; i < s.length;) {
      const c = s.charCodeAt(i++) - 48; let num = 0;
      while (i < s.length) { const d = s.charCodeAt(i); if (d < 97 || d > 122) break; num = num * 26 + (d - 97); i++; }
      const run = num + 1;
      out.fill(c, k, k + run); k += run;
    }
    return out;
  }
  MU.decodeRLE = decodeRLE;

  MU.crear = function (MAPA) {
    const M = { mapa: MAPA };
    const P = MAPA.pts; // [x,y] en decímetros, plano
    const px = i => P[i * 2] / 10, py = i => P[i * 2 + 1] / 10;
    M.nombres = MAPA.nombres;

    // ---------- grafo: vértices en cruces y extremos ----------
    const uso = new Map();
    for (const w of MAPA.vias) { const pts = w.p; for (let k = 0; k < pts.length; k++) { const i = pts[k]; const end = k === 0 || k === pts.length - 1; uso.set(i, (uso.get(i) || 0) + (end ? 2 : 1)); } }
    const vid = new Map(); M.vert = [];
    const vert = i => { let v = vid.get(i); if (v == null) { v = M.vert.length; vid.set(i, v); M.vert.push({ x: px(i), y: py(i), ej: [] }); } return v; };
    M.ejes = [];
    for (let wi = 0; wi < MAPA.vias.length; wi++) {
      const w = MAPA.vias[wi], cl = MU.CLASES[w.c] || MU.CLASES.residential;
      let start = 0;
      for (let k = 1; k < w.p.length; k++) {
        if (k === w.p.length - 1 || uso.get(w.p[k]) > 1) {
          const idx = w.p.slice(start, k + 1);
          const pts = idx.map(i => [px(i), py(i)]);
          const cum = [0];
          for (let j = 1; j < pts.length; j++) cum.push(cum[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]));
          const e = { id: M.ejes.length, a: vert(idx[0]), b: vert(idx[idx.length - 1]), pts, cum, len: cum[cum.length - 1], c: w.c, cl,
            hw: cl.hw * (w.ow ? 0.92 : 1), vmax: cl.vmax, ow: w.ow, nombre: w.n >= 0 ? M.nombres[w.n] : '', ref: w.r || '', via: wi, real: w.f || 1, ciudad: w.z };
          if (e.len > 0.5) { M.ejes.push(e); M.vert[e.a].ej.push(e.id); M.vert[e.b].ej.push(e.id); }
          start = k;
        }
      }
    }

    // ---------- grilla de segmentos para consultas espaciales ----------
    const GC = 24; M.GC = GC;
    const grid = new Map(); M.gridSeg = grid;
    const key = (gx, gy) => gx * 100003 + gy;
    for (const e of M.ejes) {
      const r = e.hw + 6;
      for (let j = 0; j < e.pts.length - 1; j++) {
        const [x0, y0] = e.pts[j], [x1, y1] = e.pts[j + 1];
        const gx0 = Math.floor((Math.min(x0, x1) - r) / GC), gx1 = Math.floor((Math.max(x0, x1) + r) / GC);
        const gy0 = Math.floor((Math.min(y0, y1) - r) / GC), gy1 = Math.floor((Math.max(y0, y1) + r) / GC);
        for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) {
          const k = key(gx, gy); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(e.id, j);
        }
      }
    }
    M.segsEn = (x, y) => grid.get(key(Math.floor(x / GC), Math.floor(y / GC)));
    // segmentos (sin repetir) que tocan un rectángulo
    M.segsRect = function (x0, y0, x1, y1) {
      const out = [], seen = new Set();
      for (let gx = Math.floor(x0 / GC); gx <= Math.floor(x1 / GC); gx++) for (let gy = Math.floor(y0 / GC); gy <= Math.floor(y1 / GC); gy++) {
        const l = grid.get(key(gx, gy)); if (!l) continue;
        for (let i = 0; i < l.length; i += 2) { const h = l[i] * 4096 + l[i + 1]; if (!seen.has(h)) { seen.add(h); out.push(l[i], l[i + 1]); } }
      }
      return out;
    };

    // punto más cercano sobre un segmento
    function proy(e, j, x, y, out) {
      const [x0, y0] = e.pts[j], [x1, y1] = e.pts[j + 1];
      const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-9;
      let t = ((x - x0) * dx + (y - y0) * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = x0 + dx * t, qy = y0 + dy * t, L = Math.sqrt(L2);
      out.d = Math.hypot(x - qx, y - qy); out.qx = qx; out.qy = qy;
      out.lat = ((y - y0) * dx - (x - x0) * dy) / L; // + = a la derecha del sentido a→b
      out.s = e.cum[j] + t * L; out.tx = dx / L; out.ty = dy / L; out.e = e; out.j = j;
      return out;
    }
    M.proy = proy;
    const tmp = {};
    // calle más cercana (dentro de maxd); ang opcional prefiere las que van en ese sentido
    M.cercano = function (x, y, maxd, ang, filtro) {
      let best = null, bd = 1e9;
      const r = maxd || 30, segs = M.segsRect(x - r, y - r, x + r, y + r);
      for (let i = 0; i < segs.length; i += 2) {
        const e = M.ejes[segs[i]];
        if (filtro && !filtro(e)) continue;
        proy(e, segs[i + 1], x, y, tmp);
        let score = tmp.d;
        if (ang != null) {
          const al = Math.cos(ang) * tmp.tx + Math.sin(ang) * tmp.ty;
          score += (1 - Math.abs(al)) * 6;
          if (e.ow && al < -0.3) score += 12;
        }
        if (tmp.d <= r && score < bd) { bd = score; best = Object.assign({}, tmp); }
      }
      return best;
    };
    // ¿sobre una calzada? devuelve el margen (negativo = adentro) y el eje
    M.enCalzada = function (x, y) {
      const l = M.segsEn(x, y); if (!l) return null;
      let best = null, bm = 1e9;
      for (let i = 0; i < l.length; i += 2) {
        const e = M.ejes[l[i]]; proy(e, l[i + 1], x, y, tmp);
        const m = tmp.d - e.hw;
        if (m < bm) { bm = m; best = e; }
      }
      return best ? { m: bm, e: best } : null;
    };

    // ---------- terreno ----------
    M.ciudades = MAPA.ciudades.map(c => Object.assign({}, c, { cel: decodeRLE(c.grid.rle, c.grid.w * c.grid.h) }));
    M.terreno = function (x, y) {
      for (const c of M.ciudades) {
        const g = c.grid, gx = Math.floor((x - g.x0) / g.cell), gy = Math.floor((y - g.y0) / g.cell);
        if (gx >= 0 && gy >= 0 && gx < g.w && gy < g.h) return c.cel[gy * g.w + gx];
      }
      return -1; // fuera de las ciudades: campo procedural
    };
    M.ciudadEn = function (x, y) {
      for (const c of M.ciudades) if (x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1) return c;
      return null;
    };
    M.agua = (x, y) => M.terreno(x, y) === MU.TER.AGUA;
    // cuántos metros reales vale un metro del juego (la ruta entre ciudades está comprimida)
    M.factorReal = (x, y) => { const l = M.segsEn(x, y); return l ? M.ejes[l[0]].real : 1; };

    // ---------- edificios: polígonos en metros con su altura ----------
    M.edif = (MAPA.edificios || []).map(b => {
      const pts = []; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 1; i < b.length; i += 2) { const x = b[i] / 10, y = b[i + 1] / 10; pts.push([x, y]); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      return { h: b[0] / 10, pts, x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    });
    const BG = 32, gridB = new Map();
    M.edif.forEach((b, i) => {
      for (let gx = Math.floor(b.x0 / BG); gx <= Math.floor(b.x1 / BG); gx++) for (let gy = Math.floor(b.y0 / BG); gy <= Math.floor(b.y1 / BG); gy++) {
        const k = key(gx, gy); let l = gridB.get(k); if (!l) gridB.set(k, l = []); l.push(i);
      }
    });
    M.edifEn = (x, y) => gridB.get(key(Math.floor(x / BG), Math.floor(y / BG)));
    // ¿un círculo choca con algún edificio? devuelve la normal de empuje
    M.chocaEdif = function (x, y, r) {
      const l = M.edifEn(x, y); if (!l) return null;
      for (const i of l) {
        const b = M.edif[i];
        if (x + r < b.x0 || x - r > b.x1 || y + r < b.y0 || y - r > b.y1) continue;
        let dentro = false, bd = 1e9, nx = 0, ny = 0;
        const p = b.pts;
        for (let k = 0, m = p.length - 1; k < p.length; m = k++) {
          const [ax, ay] = p[m], [bx, by] = p[k];
          if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) dentro = !dentro;
          const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
          let t = ((x - ax) * dx + (y - ay) * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const qx = ax + dx * t, qy = ay + dy * t, d = Math.hypot(x - qx, y - qy);
          if (d < bd) { bd = d; nx = x - qx; ny = y - qy; }
        }
        if (dentro || bd < r) {
          const l2 = Math.hypot(nx, ny) || 1;
          return dentro ? { nx: -nx / l2, ny: -ny / l2, pen: bd + r } : { nx: nx / l2, ny: ny / l2, pen: r - bd };
        }
      }
      return null;
    };

    // ---------- depósitos ----------
    M.depositos = MAPA.depositos.map((d, i) => {
      const dep = Object.assign({ id: i }, d);
      // punto de la calle frente al depósito, para el GPS
      const c = M.cercano(d.x, d.y, 80, null, e => e.c !== 'motorway' && e.c !== 'link');
      dep.nomCalle = d.calle || ''; dep.calle = c;
      return dep;
    });

    // ---------- rutas (A* sobre el grafo, respetando sentido único) ----------
    const VMAXG = 25;
    function vecinos(v) {
      const out = [];
      for (const ei of M.vert[v].ej) {
        const e = M.ejes[ei];
        if (e.a === v) out.push([e.b, e, 1]);
        if (e.b === v && !e.ow) out.push([e.a, e, -1]);
      }
      return out;
    }
    // costo en segundos con preferencia por vías rápidas (los camiones van por la autopista)
    const costo = e => e.len / e.vmax * (e.c === 'residential' || e.c === 'living_street' ? 1.6 : e.c === 'unclassified' ? 1.3 : 1);
    // desde: {e, s, dir} posición en un eje y sentido de avance (dir=1 hacia b). hasta: igual (dir libre)
    M.ruta = function (desde, hasta) {
      const N = M.vert.length;
      const g = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), prevE = new Int32Array(N).fill(-1);
      const open = []; // montículo binario simple [f, v]
      const push = (f, v) => { open.push([f, v]); let i = open.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (open[p][0] <= open[i][0]) break; [open[p], open[i]] = [open[i], open[p]]; i = p; } };
      const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === i) break; [open[m], open[i]] = [open[i], open[m]]; i = m; } } return top; };
      const tx = hasta.qx, ty = hasta.qy;
      const h = v => Math.hypot(M.vert[v].x - tx, M.vert[v].y - ty) / VMAXG;
      const e0 = desde.e, f0 = e0.len ? costo(e0) / e0.len : 0;
      // salidas desde la posición inicial
      const sal = [];
      if (desde.dir >= 0 || !e0.ow) sal.push([e0.b, (e0.len - desde.s) * f0 + (desde.dir < 0 ? 240 : 0), 1]);
      if (!e0.ow) sal.push([e0.a, desde.s * f0 + (desde.dir > 0 ? 240 : 0), -1]);
      for (const [v, c] of sal) if (c < g[v]) { g[v] = c; prev[v] = -2; prevE[v] = -1; push(c + h(v), v); }
      // caso: el destino está más adelante en el mismo eje
      let directo = null;
      if (hasta.e === e0) {
        const ds = hasta.s - desde.s;
        if (ds >= 0 && desde.dir >= 0) directo = ds * f0;
        else if (ds <= 0 && !e0.ow && desde.dir <= 0) directo = -ds * f0;
      }
      const eD = hasta.e, fD = eD.len ? costo(eD) / eD.len : 0;
      const llegar = v => { // costo de ir del vértice v al punto destino
        let c = Infinity;
        if (v === eD.a) c = Math.min(c, hasta.s * fD);
        if (v === eD.b && !eD.ow) c = Math.min(c, (eD.len - hasta.s) * fD);
        return c;
      };
      let mejor = directo != null ? directo : Infinity, fin = -1;
      const cerrado = new Uint8Array(N);
      while (open.length) {
        const [f, v] = pop();
        if (cerrado[v]) continue; cerrado[v] = 1;
        if (f >= mejor) break;
        const cl = g[v] + llegar(v);
        if (cl < mejor) { mejor = cl; fin = v; }
        for (const [w, e] of vecinos(v)) {
          if (e === eD && (w === eD.b || w === eD.a) && e === e0) { /* eje inicial y final iguales: lo cubre "directo" */ }
          const c = g[v] + costo(e);
          if (c < g[w]) { g[w] = c; prev[w] = v; prevE[w] = e.id; push(c + h(w), w); }
        }
      }
      if (mejor === Infinity) return null;
      // reconstruir la polilínea
      const pts = [];
      const tramo = (e, s0, s1) => { // puntos de e entre los parámetros s0 y s1 (cualquier sentido)
        const add = (x, y) => { const l = pts[pts.length - 1]; if (!l || Math.hypot(l[0] - x, l[1] - y) > 0.3) pts.push([x, y]); };
        const at = s => { let j = 0; while (j < e.cum.length - 2 && e.cum[j + 1] < s) j++; const t = (s - e.cum[j]) / ((e.cum[j + 1] - e.cum[j]) || 1); return [e.pts[j][0] + (e.pts[j + 1][0] - e.pts[j][0]) * t, e.pts[j][1] + (e.pts[j + 1][1] - e.pts[j][1]) * t]; };
        add(...at(s0));
        if (s1 >= s0) { for (let j = 0; j < e.cum.length; j++) if (e.cum[j] > s0 && e.cum[j] < s1) add(...e.pts[j]); }
        else { for (let j = e.cum.length - 1; j >= 0; j--) if (e.cum[j] < s0 && e.cum[j] > s1) add(...e.pts[j]); }
        add(...at(s1));
      };
      const pasos = []; // [ejeId, sentido]
      if (fin < 0) tramo(e0, desde.s, hasta.s);
      else {
        const cad = []; let v = fin;
        while (prev[v] !== -2) { cad.push([prevE[v], v]); v = prev[v]; }
        cad.reverse();
        tramo(e0, desde.s, v === e0.b ? e0.len : 0); pasos.push([e0.id, v === e0.b ? 1 : -1]);
        for (const [ei, w] of cad) { const e = M.ejes[ei]; tramo(e, w === e.b ? 0 : e.len, w === e.b ? e.len : 0); pasos.push([ei, w === e.b ? 1 : -1]); }
        tramo(eD, fin === eD.a ? 0 : eD.len, hasta.s); pasos.push([eD.id, fin === eD.a ? 1 : -1]);
      }
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      // distancia "real" (la ruta comprimida pesa su factor)
      let real = 0;
      for (const [ei] of pasos) real += M.ejes[ei].len * M.ejes[ei].real;
      if (!pasos.length) real = cum[cum.length - 1] * e0.real;
      else real -= 0; // aproximación: ejes completos en los extremos
      return { pts, cum, len: cum[cum.length - 1], seg: mejor, pasos, real: Math.max(real * 0.98, cum[cum.length - 1]), indic: indicaciones(pts, cum, pasos) };
    };
    // giros: dónde cambia el rumbo y el nombre de la calle que sigue
    function indicaciones(pts, cum, pasos) {
      const out = [];
      const nom = pasos.map(([ei]) => M.ejes[ei]);
      // ubicar en la polilínea el comienzo de cada eje
      let s = 0; const ini = [];
      for (const [ei] of pasos) { ini.push(s); s += M.ejes[ei].len; }
      const rumbo = (i, d) => { // rumbo medio en d metros desde el punto i
        let j = i; while (j < pts.length - 1 && cum[j] - cum[i] < d) j++;
        return Math.atan2(pts[j][1] - pts[i][1], pts[j][0] - pts[i][0]);
      };
      const rumboAtras = (i, d) => { let j = i; while (j > 0 && cum[i] - cum[j] < d) j--; return Math.atan2(pts[i][1] - pts[j][1], pts[i][0] - pts[j][0]); };
      for (let k = 1; k < pasos.length; k++) {
        const e = nom[k], ep = nom[k - 1];
        // punto de la polilínea más cercano al comienzo del eje k
        let i = 0; while (i < cum.length - 1 && cum[i] < ini[k]) i++;
        let d = rumbo(i, 25) - rumboAtras(i, 25); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        const cambiaNombre = e.nombre && e.nombre !== ep.nombre;
        if (Math.abs(d) > 0.6 || (cambiaNombre && Math.abs(d) > 0.3)) {
          const ult = out[out.length - 1];
          if (ult && cum[i] - ult.s < 15) continue;
          out.push({ s: cum[i], giro: d > 0 ? 'DERECHA' : 'IZQUIERDA', fuerte: Math.abs(d) > 2.2, nombre: e.nombre || (e.c === 'motorway' ? 'RUTA ' + (e.ref || '5') : e.c === 'link' ? 'SALIDA' : ''), x: pts[i][0], y: pts[i][1] });
        } else if (e.c === 'motorway' && ep.c !== 'motorway' && ep.c !== 'link') out.push({ s: cum[i], giro: 'AUTOPISTA', nombre: 'RUTA ' + (e.ref || '5'), x: pts[i][0], y: pts[i][1] });
      }
      return out;
    }
    // posición sobre la calle para un punto y rumbo
    M.posicion = function (x, y, ang) {
      const c = M.cercano(x, y, 60, ang); if (!c) return null;
      const al = Math.cos(ang) * c.tx + Math.sin(ang) * c.ty;
      c.dir = al >= 0 ? 1 : -1;
      return c;
    };
    // avance sobre la ruta: actualiza st.i (punto más cercano) y devuelve la distancia a la polilínea
    M.seguir = function (ruta, x, y, st) {
      const P = ruta.pts; let bd = 1e9, bi = st.i || 0;
      for (let k = Math.max(0, (st.i || 0) - 2); k < Math.min(P.length - 1, (st.i || 0) + 60); k++) {
        const [ax, ay] = P[k], [bx, by] = P[k + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
        let t = ((x - ax) * dx + (y - ay) * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const d = Math.hypot(x - ax - dx * t, y - ay - dy * t);
        if (d < bd - 0.01) { bd = d; bi = t > 0.999 ? k + 1 : k; }
      }
      st.i = bi; st.s = ruta.cum[bi];
      return bd;
    };
    // salida de un depósito hacia otro: el camión sale del patio ya mirando hacia donde parte la ruta
    M.salida = function (dep, dest) {
      const r = M.ruta(Object.assign({}, dep.calle, { dir: 0 }), dest.calle);
      if (!r || r.pts.length < 2) return null;
      let k = 1; while (k < r.pts.length - 1 && r.cum[k] < 4) k++;
      const [x0, y0] = r.pts[0], a = Math.atan2(r.pts[k][1] - y0, r.pts[k][0] - x0);
      const e = dep.calle.e, lat = e.ow ? 0 : e.hw * 0.5;
      return { x: x0 - Math.sin(a) * lat, y: y0 + Math.cos(a) * lat, a, ruta: r };
    };
    M.rutaA = function (x, y, ang, dep) {
      const d = M.posicion(x, y, ang);
      if (!d || !dep.calle) return null;
      return M.ruta(d, dep.calle);
    };

    // límites del mundo
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const v of M.vert) { x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    M.lim = { x0, y0, x1, y1 };
    return M;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = MU; else G.MUNDO = MU;
})(typeof window !== 'undefined' ? window : globalThis);
