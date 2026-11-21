// FLETES — semáforos de los cruces reales. Los nodos highway=traffic_signals de OpenStreetMap marcan qué cruces
// tienen semáforo; cada cruce (que en las avenidas con bandejón son varios vértices juntos) reparte sus accesos en
// dos fases según su orientación, que se turnan el verde. Sin DOM: lo usan el juego, el tráfico y medir.js.
(function (G) {
  'use strict';
  const S = {};
  S.VERDE = 12; S.AMARILLO = 3; S.TODO_ROJO = 2;   // segundos reales
  S.CICLO = 2 * (S.VERDE + S.AMARILLO + S.TODO_ROJO);
  S.MULTA = 25000;

  S.crear = function (M, puntos) {
    const sem = { cruces: [], accesos: [], porAcceso: new Map(), porVert: new Map(), lineas: [] };
    if (!puntos || !puntos.length) return sem;
    // señales en metros, en una grilla para buscar rápido
    const GS = 40, grid = new Map();
    for (let i = 0; i < puntos.length; i += 2) { const x = puntos[i] / 10, y = puntos[i + 1] / 10, k = Math.floor(x / GS) + ',' + Math.floor(y / GS); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push([x, y]); }
    const senalCerca = (x, y, r) => { for (let gx = Math.floor((x - r) / GS); gx <= Math.floor((x + r) / GS); gx++) for (let gy = Math.floor((y - r) / GS); gy <= Math.floor((y + r) / GS); gy++) for (const [sx, sy] of grid.get(gx + ',' + gy) || []) if (Math.hypot(sx - x, sy - y) < r) return true; return false; };
    const urbana = e => e.c !== 'motorway' && e.c !== 'link';
    // vértices candidatos: cruces de 3 o más tramos, de calles urbanas, con una señal a menos de 25 m
    const cand = new Set();
    M.vert.forEach((v, i) => { if (v.ej.length >= 3 && v.ej.filter(ei => urbana(M.ejes[ei])).length >= 3 && senalCerca(v.x, v.y, 25)) cand.add(i); });
    // agrupar los vértices de un mismo cruce (unidos por tramos cortos)
    const par = new Map(); for (const v of cand) par.set(v, v);
    const raiz = v => { while (par.get(v) !== v) { par.set(v, par.get(par.get(v))); v = par.get(v); } return v; };
    for (const v of cand) for (const ei of M.vert[v].ej) { const e = M.ejes[ei], w = e.a === v ? e.b : e.a; if (cand.has(w) && e.len < 32) par.set(raiz(v), raiz(w)); }
    const grupos = new Map(); for (const v of cand) { const r = raiz(v); if (!grupos.has(r)) grupos.set(r, []); grupos.get(r).push(v); }
    for (const vs of grupos.values()) {
      const dentro = new Set(vs), acc = [];
      let cx = 0, cy = 0; for (const v of vs) { cx += M.vert[v].x; cy += M.vert[v].y; } cx /= vs.length; cy /= vs.length;
      for (const v of vs) {
        let r = 0; for (const ei of M.vert[v].ej) r = Math.max(r, M.ejes[ei].hw);
        for (const ei of M.vert[v].ej) {
          const e = M.ejes[ei], w = e.a === v ? e.b : e.a;
          if (dentro.has(w) || !urbana(e)) continue;
          const dir = e.b === v ? 1 : -1;
          if (dir < 0 && e.ow) continue; // sentido único que sale del cruce
          const retiro = r + 3.5; // la línea, bien antes del cruce: deja espacio para que doblen los camiones
          if (e.len < retiro + 6) continue;
          // dirección de llegada y punto de la línea de detención
          const n = e.pts.length, p1 = dir > 0 ? e.pts[n - 2] : e.pts[1], p2 = dir > 0 ? e.pts[n - 1] : e.pts[0];
          const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1, tx = (p2[0] - p1[0]) / L, ty = (p2[1] - p1[1]) / L;
          const s = dir > 0 ? e.len - retiro : retiro;
          const q = posEje(e, s);
          // la línea cubre las pistas que llegan: media calzada (doble sentido) o la calzada entera (sentido único)
          const nx = -ty, ny = tx; // a la derecha del sentido de avance
          const l0 = e.ow ? -e.hw + 0.3 : 0.2, l1 = e.hw - 0.3;
          const a = { e, dir, v, retiro, x: q[0], y: q[1], tx, ty, hw: e.hw, linea: [q[0] + nx * l0, q[1] + ny * l0, q[0] + nx * l1, q[1] + ny * l1],
            poste: [q[0] + nx * (e.hw + 1.1) - tx * 0.5, q[1] + ny * (e.hw + 1.1) - ty * 0.5] };
          acc.push(a);
        }
      }
      if (acc.length < 2) continue;
      // fases por orientación (el sentido no importa: norte-sur contra este-oeste)
      const t0 = Math.atan2(acc[0].ty, acc[0].tx);
      for (const a of acc) a.fase = Math.abs(Math.sin(Math.atan2(a.ty, a.tx) - t0)) < 0.6 ? 0 : 1;
      if (!acc.some(a => a.fase === 1)) continue; // todo en un mismo eje: es un semáforo peatonal, no se usa
      const cr = { id: sem.cruces.length, x: cx, y: cy, vs, accesos: acc, off: (Math.abs(Math.sin(cx * 12.9898 + cy * 78.233)) * 43758.5453 % 1) * S.CICLO };
      for (const a of acc) { a.cruce = cr; sem.accesos.push(a); sem.porAcceso.set(a.e.id + ':' + a.dir, a); sem.lineas.push(a.linea); }
      for (const v of vs) sem.porVert.set(v, cr);
      sem.cruces.push(cr);
    }
    // grilla de accesos para buscar el próximo semáforo
    sem.grid = new Map();
    for (const a of sem.accesos) { const k = Math.floor(a.x / GS) + ',' + Math.floor(a.y / GS); let l = sem.grid.get(k); if (!l) sem.grid.set(k, l = []); l.push(a); }
    sem.GS = GS;
    return sem;
  };
  function posEje(e, s) {
    let j = 0; while (j < e.cum.length - 2 && e.cum[j + 1] < s) j++;
    const t = Math.max(0, Math.min(1, (s - e.cum[j]) / ((e.cum[j + 1] - e.cum[j]) || 1)));
    return [e.pts[j][0] + (e.pts[j + 1][0] - e.pts[j][0]) * t, e.pts[j][1] + (e.pts[j + 1][1] - e.pts[j][1]) * t];
  }

  // estado de una fase en el instante t (segundos reales): 'verde' | 'amarillo' | 'rojo'
  S.estado = function (cr, fase, t) {
    const mitad = S.VERDE + S.AMARILLO + S.TODO_ROJO;
    let u = ((t + cr.off) % S.CICLO + S.CICLO) % S.CICLO;
    if (fase === 1) u = (u + mitad) % S.CICLO;
    return u < S.VERDE ? 'verde' : u < S.VERDE + S.AMARILLO ? 'amarillo' : 'rojo';
  };
  // segundos que faltan para el próximo cambio de luz
  S.faltan = function (cr, fase, t) {
    const mitad = S.VERDE + S.AMARILLO + S.TODO_ROJO;
    let u = ((t + cr.off) % S.CICLO + S.CICLO) % S.CICLO;
    if (fase === 1) u = (u + mitad) % S.CICLO;
    return u < S.VERDE ? S.VERDE - u : u < S.VERDE + S.AMARILLO ? S.VERDE + S.AMARILLO - u : S.CICLO - u;
  };
  // distancia (positiva antes de la línea) de un punto a la línea de detención de un acceso
  S.distancia = (a, x, y) => -((x - a.x) * a.tx + (y - a.y) * a.ty);
  // el próximo semáforo delante de un vehículo en (x,y) que mira hacia ang: {a, dist}
  S.proximo = function (sem, x, y, ang, maxd) {
    if (!sem || !sem.grid) return null;
    const ca = Math.cos(ang), sa = Math.sin(ang), GS = sem.GS;
    let mejor = null, md = maxd;
    for (let gx = Math.floor((x - maxd) / GS); gx <= Math.floor((x + maxd) / GS); gx++) for (let gy = Math.floor((y - maxd) / GS); gy <= Math.floor((y + maxd) / GS); gy++)
      for (const a of sem.grid.get(gx + ',' + gy) || []) {
        if (ca * a.tx + sa * a.ty < 0.6) continue;
        const d = S.distancia(a, x, y);
        if (d < -1 || d > md) continue;
        const lat = Math.abs(-(x - a.x) * a.ty + (y - a.y) * a.tx);
        if (lat > a.hw + 2.5) continue;
        md = d; mejor = a;
      }
    return mejor ? { a: mejor, dist: md } : null;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = S; else G.SEMAFOROS = S;
})(typeof window !== 'undefined' ? window : globalThis);
