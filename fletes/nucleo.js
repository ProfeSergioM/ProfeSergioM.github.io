// FLETES — física del camión (tracto + semirremolque), tráfico de decorado y piloto automático.
// Sin DOM: la usan el juego y medir.js. Unidades: metros, segundos, radianes. +x este, +y sur.
(function (G) {
  'use strict';
  const N = {};
  N.DT = 1 / 120;
  // tracto: distancia entre ejes, quinta rueda (adelante del eje trasero), voladizos
  N.CAMION = { L1: 3.9, quinta: 0.45, frente: 5.0, cola: 1.1, ancho: 2.5, L2: 9.6, remFrente: 1.4, remCola: 3.0,
    masaTracto: 8200, masaRemolque: 7000, potencia: 330000, fuerzaMax: 52000, vmax: 25, vmaxAtras: 3.6,
    freno: 5.5, cdA: 5.4, rodado: 0.0075, rodadoFuera: 0.06, vmaxFuera: 8, giroMax: 0.62, latMax: 2.6 };

  N.nuevoCamion = function (x, y, a) {
    const C = N.CAMION;
    const c = { x, y, a, v: 0, delta: 0, a2: a, remolque: false, carga: 0, rpm: 0.2, marcha: 1, gas: 0, freno: 0, atras: false, tAtras: 0,
      fuera: false, golpe: 0, km: 0, kmReal: 0, combustible: 0, tq: 0 };
    N.ponerRemolque(c, false);
    return c;
  };
  // engancha o suelta el semirremolque, alineado con el tracto
  N.ponerRemolque = function (c, si, carga) {
    const C = N.CAMION;
    c.remolque = !!si; c.carga = si ? (carga || 0) : 0; c.a2 = c.a;
    const hx = c.x + Math.cos(c.a) * C.quinta, hy = c.y + Math.sin(c.a) * C.quinta;
    c.rx = hx - Math.cos(c.a) * C.L2; c.ry = hy - Math.sin(c.a) * C.L2;
    c.atrapado = true; c.atrapadoT = 0;
  };
  // ¿alguna parte del camión está dentro de un edificio, del agua o de un obstáculo?
  N.tocaAlgo = function (c, mundo, obst) {
    for (const [x, y, r] of N.circulos(c, [])) {
      if (mundo && (mundo.chocaEdif(x, y, r) || mundo.agua(x, y))) return true;
      if (obst) for (const o of obst) if ((x - o.x) ** 2 + (y - o.y) ** 2 < (r + o.r) ** 2) return true;
    }
    return false;
  };
  N.masa = c => N.CAMION.masaTracto + (c.remolque ? N.CAMION.masaRemolque + c.carga : 0);

  // puntos del contorno para choques: [x, y, radio, esRemolque]
  N.circulos = function (c, out) {
    const C = N.CAMION; out = out || [];
    out.length = 0;
    const ca = Math.cos(c.a), sa = Math.sin(c.a);
    for (const d of [C.frente - 1.2, 1.2]) out.push([c.x + ca * d, c.y + sa * d, 1.25, 0]);
    if (c.remolque) {
      const cb = Math.cos(c.a2), sb = Math.sin(c.a2);
      const hx = c.rx + cb * C.L2, hy = c.ry + sb * C.L2; // pivote
      for (let k = 0; k <= 4; k++) { const d = C.remFrente - 1.2 - k * (C.L2 + C.remFrente + C.remCola - 2.4) / 4; out.push([hx + cb * (d), hy + sb * (d), 1.25, 1]); }
    }
    return out;
  };

  const tmpC = [];
  // paso de física. ent: {up, down, left, right, mano}. mundo: el de mundo.js (o null)
  N.paso = function (c, ent, dt, mundo, obst) {
    const C = N.CAMION, m = N.masa(c);
    const v = c.v, av = Math.abs(v);
    // ---- dirección: el máximo baja con la velocidad (aceleración lateral acotada)
    const dmax = Math.min(C.giroMax, Math.atan(C.latMax * C.L1 / Math.max(1, v * v)));
    const objetivo = (ent.left ? -1 : 0) + (ent.right ? 1 : 0);
    const tgt = objetivo * dmax, vel = objetivo ? 0.9 : 1.6;
    c.delta += Math.max(-vel * dt, Math.min(vel * dt, tgt - c.delta));
    if (Math.abs(c.delta) > dmax && objetivo === 0) c.delta = Math.sign(c.delta) * dmax;
    // ---- terreno
    let fuera = false;
    if (mundo) { const q = mundo.enCalzada(c.x + Math.cos(c.a) * 2, c.y + Math.sin(c.a) * 2); fuera = !q || q.m > 1.6; }
    c.fuera = fuera;
    // ---- marcha atrás: detenido y manteniendo "abajo"
    if (ent.down && av < 0.3 && !c.atras) { c.tAtras += dt; if (c.tAtras > 0.35) { c.atras = true; } }
    else if (!ent.down) c.tAtras = 0;
    if (ent.up && c.atras && av < 0.3) c.atras = false;
    let gas = 0, freno = 0;
    if (!c.atras) { gas = ent.up ? 1 : 0; freno = ent.down ? 1 : 0; }
    else { gas = ent.down ? 1 : 0; freno = ent.up ? 1 : 0; }
    if (ent.mano) freno = 1;
    c.gas = gas; c.freno = freno;
    // ---- fuerzas
    const dir = c.atras ? -1 : 1;
    const vmax = Math.min(c.atras ? C.vmaxAtras : C.vmax, fuera ? C.vmaxFuera : 99);
    let F = 0;
    if (gas) {
      const tope = av < vmax ? 1 : 0;
      F = dir * tope * Math.min(C.fuerzaMax, C.potencia / Math.max(av, 2.5));
      if (av > vmax - 1.5) F *= Math.max(0, (vmax - av) / 1.5); // limitador
    }
    const res = (fuera ? C.rodadoFuera : C.rodado) * m * 9.8 + 0.6 * C.cdA * v * v + (gas ? 0 : 900); // freno motor suave
    let acc = F / m;
    let dec = res / m + freno * C.freno;
    if (av > vmax + 0.5) dec += (av - vmax) * 0.8; // al salir de la calzada se frena solo
    // aplicar: la desaceleración nunca invierte el sentido
    let nv = v + acc * dt;
    const sgn = Math.sign(nv) || 0;
    nv -= sgn * Math.min(Math.abs(nv), dec * dt);
    c.v = nv;
    // ---- cinemática: bicicleta + remolque arrastrado
    const px = c.x, py = c.y, pa = c.a, prx = c.rx, pry = c.ry;
    c.a += c.v * Math.tan(c.delta) / C.L1 * dt;
    c.x += Math.cos(c.a) * c.v * dt; c.y += Math.sin(c.a) * c.v * dt;
    if (c.remolque) {
      const hx = c.x + Math.cos(c.a) * C.quinta, hy = c.y + Math.sin(c.a) * C.quinta;
      let dx = hx - c.rx, dy = hy - c.ry; const L = Math.hypot(dx, dy) || 1;
      c.rx = hx - dx / L * C.L2; c.ry = hy - dy / L * C.L2;
      c.a2 = Math.atan2(hy - c.ry, hx - c.rx);
      // tijera: el ángulo entre tracto y remolque tiene tope
      let d = c.a - c.a2; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      const lim = 1.45;
      if (Math.abs(d) > lim) { c.a2 = c.a - Math.sign(d) * lim; c.rx = hx - Math.cos(c.a2) * C.L2; c.ry = hy - Math.sin(c.a2) * C.L2; c.v *= 0.9; }
    } else { c.a2 = c.a; }
    // ---- choques con edificios, agua y obstáculos (autos): se deshace el paso
    let golpe = 0;
    if (mundo || obst) {
      const cs = N.circulos(c, tmpC);
      for (const [x, y, r, rem] of cs) {
        let hit = false;
        if (mundo) { if (mundo.chocaEdif(x, y, r)) hit = true; else if (mundo.agua(x, y)) hit = true; }
        if (!hit && obst) for (const o of obst) { if ((x - o.x) ** 2 + (y - o.y) ** 2 < (r + o.r) ** 2) { hit = true; o.tocado = 1; break; } }
        if (hit) { golpe = Math.max(golpe, Math.abs(c.v)); break; }
      }
      // si ya estaba metido en algo (al enganchar o aparecer), se le deja salir
      if (golpe && c.atrapado) { golpe = 0; }
      else if (golpe) {
        c.x = px; c.y = py; c.a = pa; c.rx = prx; c.ry = pry;
        if (c.remolque) c.a2 = Math.atan2(py + Math.sin(pa) * C.quinta - pry, px + Math.cos(pa) * C.quinta - prx);
        c.v = -c.v * 0.15;
      }
    }
    c.golpe = golpe;
    if (c.atrapado && mundo) { c.atrapadoT = (c.atrapadoT || 0) + dt; if (c.atrapadoT > 0.25) { c.atrapadoT = 0; c.atrapado = N.tocaAlgo(c, mundo, obst); } }
    // ---- marcha y revoluciones (caja automática de 12 velocidades)
    const MARCHAS = [0, 2.2, 3.4, 4.8, 6.4, 8.2, 10.2, 12.4, 14.8, 17.4, 20.2, 23.2, 26.4];
    if (c.atras) { c.marcha = -1; c.rpm = 0.25 + av / C.vmaxAtras * 0.5; }
    else {
      let g = 1; while (g < 12 && av > MARCHAS[g] * 0.92) g++;
      c.marcha = g;
      const lo = MARCHAS[g - 1], hi = MARCHAS[g];
      c.rpm = 0.25 + Math.max(0, Math.min(1, (av - lo * 0.92) / (hi - lo * 0.92))) * 0.6 + gas * 0.1;
    }
    // ---- distancias y combustible (35 L/100 km cargado, menos vacío)
    const ds = Math.abs(c.v) * dt;
    c.km += ds / 1000;
    const real = mundo && mundo.factorReal ? mundo.factorReal(c.x, c.y) : 1;
    c.kmReal += ds * real / 1000;
    c.combustible += ds * real / 1000 * (0.24 + 0.12 * (m - 15200) / 25000 + 0.1 * gas) ;
    return golpe;
  };

  // ---------- tráfico de decorado: autos que siguen las calles por su pista ----------
  // cada auto: {e, dir, s, v, vmax, tipo, col, x, y, ang, espera}
  N.TIPOS_AUTO = [{ tipo: 'sedan', largo: 4.5, r: 1.5 }, { tipo: 'sedan', largo: 4.5, r: 1.5 }, { tipo: 'sedan', largo: 4.5, r: 1.5 }, { tipo: 'furgon', largo: 5.2, r: 1.7 }, { tipo: 'camion', largo: 8.5, r: 2.0 }, { tipo: 'bus', largo: 11, r: 2.2 }];
  function posEje(e, s, lat, out) {
    let j = 0; const cum = e.cum;
    let lo = 0, hi = cum.length - 2;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid - 1; }
    j = lo;
    const [x0, y0] = e.pts[j], [x1, y1] = e.pts[j + 1];
    const L = (cum[j + 1] - cum[j]) || 1, t = Math.max(0, Math.min(1, (s - cum[j]) / L));
    const tx = (x1 - x0) / L, ty = (y1 - y0) / L;
    out.x = x0 + (x1 - x0) * t - ty * lat; out.y = y0 + (y1 - y0) * t + tx * lat; out.tx = tx; out.ty = ty;
    return out;
  }
  N.posEje = posEje;
  const _p = {};
  N.ubicarAuto = function (a) {
    // pista a la derecha del sentido de avance (en Chile se maneja por la derecha)
    const e = a.e, lat = e.ow ? (e.hw > 4.2 ? e.hw * 0.42 * (a.carril || 1) : 0) : e.hw * 0.5;
    // con dir=-1 se recorre de b a a: la derecha del auto es la izquierda del eje
    posEje(e, a.s, a.dir > 0 ? lat : -lat, _p);
    const nx = _p.x, ny = _p.y, ang = Math.atan2(_p.ty * a.dir, _p.tx * a.dir);
    if (a.x == null) { a.x = nx; a.y = ny; a.ang = ang; return; }
    // suavizar los quiebres de las esquinas
    a.x += (nx - a.x) * 0.35; a.y += (ny - a.y) * 0.35;
    let d = ang - a.ang; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    a.ang += d * 0.25;
  };
  N.siguienteEje = function (mundo, e, dir, rnd) {
    const v = dir > 0 ? e.b : e.a, op = [];
    for (const ei of mundo.vert[v].ej) {
      const f = mundo.ejes[ei];
      if (f === e) continue;
      if (f.c === 'living_street') continue;
      if (f.a === v) op.push([f, 1]);
      else if (f.b === v && !f.ow) op.push([f, -1]);
    }
    if (!op.length) return e.ow ? null : [e, -dir]; // calle sin salida: dar la vuelta
    // preferir seguir por vías de la misma clase o mayores
    const peso = ([f]) => (f.c === e.c ? 3 : 1) * (f.c === 'residential' ? 0.6 : 1);
    let tot = 0; for (const o of op) tot += peso(o);
    let r = rnd() * tot;
    for (const o of op) { r -= peso(o); if (r <= 0) return o; }
    return op[0];
  };
  // avanza un auto; obst: lista de cosas que lo hacen frenar ({x,y})
  N.pasoAuto = function (mundo, a, dt, obst, rnd) {
    // ¿algo adelante en la pista?
    const fx = Math.cos(a.ang), fy = Math.sin(a.ang);
    let libre = 99, libreFijo = 99;
    for (const o of obst) {
      if (o === a) continue;
      const dx = o.x - a.x, dy = o.y - a.y, d = dx * fx + dy * fy;
      if (d <= 0 || d > 30) continue;
      const lat = Math.abs(-dx * fy + dy * fx);
      if (lat < (o.ancho || 1.8)) { const l = d - (o.largo || 5) * 0.5 - a.largo * 0.5; libre = Math.min(libre, l); if (o.fijo) libreFijo = Math.min(libreFijo, l); }
    }
    a.espera = libre < 4 ? (a.espera || 0) + dt : 0;
    if (a.espera > 6) libre = libreFijo; // destrabar cruces entre autos, pero nunca pasar a través del camión
    const vObj = Math.min(a.vmax, Math.max(0, (libre - 2.5) * 0.9));
    a.v += Math.max(-6 * dt, Math.min(1.8 * dt, vObj - a.v));
    a.s += a.v * dt * a.dir;
    let guard = 0;
    while ((a.dir > 0 && a.s > a.e.len) || (a.dir < 0 && a.s < 0)) {
      const sobra = a.dir > 0 ? a.s - a.e.len : -a.s;
      const sig = N.siguienteEje(mundo, a.e, a.dir, rnd);
      if (!sig || ++guard > 5) { a.muerto = true; return; }
      a.e = sig[0]; a.dir = sig[1]; a.vmax = Math.min(a.vmaxBase, a.e.vmax * (0.8 + 0.2 * a.temple));
      a.s = a.dir > 0 ? sobra : a.e.len - sobra;
    }
    N.ubicarAuto(a);
  };

  // ---------- piloto automático (para medir): sigue la polilínea de la ruta ----------
  N.piloto = function (c, ruta, st) {
    // st: {i} índice del punto de la ruta más cercano ya alcanzado
    const P = ruta.pts, cum = ruta.cum;
    const i = st.i || 0;
    // posición sobre la ruta: proyección del camión sobre el tramo actual
    const k2 = Math.min(P.length - 1, i + 1), dx0 = P[k2][0] - P[i][0], dy0 = P[k2][1] - P[i][1], L0 = Math.hypot(dx0, dy0) || 1;
    const sNow = cum[i] + Math.max(0, Math.min(L0, ((c.x - P[i][0]) * dx0 + (c.y - P[i][1]) * dy0) / L0));
    // punto de mira a 7–16 m según la velocidad
    const look = 6 + Math.abs(c.v) * 0.45;
    // punto de mira interpolado sobre la polilínea
    let j = i; while (j < P.length - 1 && cum[j + 1] - sNow < look) j++;
    let tx = P[j][0], ty = P[j][1];
    if (j < P.length - 1) { const f = Math.max(0, Math.min(1, (sNow + look - cum[j]) / ((cum[j + 1] - cum[j]) || 1))); tx += (P[j + 1][0] - tx) * f; ty += (P[j + 1][1] - ty) * f; }
    let ang = Math.atan2(ty - c.y, tx - c.x) - c.a; while (ang > Math.PI) ang -= 2 * Math.PI; while (ang < -Math.PI) ang += 2 * Math.PI;
    // velocidad: según la curvatura de los próximos 60 m
    let vlim = 25;
    for (let k = i + 1; k < P.length - 1 && cum[k] - sNow < 70; k++) {
      const a1 = Math.atan2(P[k][1] - P[k - 1][1], P[k][0] - P[k - 1][0]), a2 = Math.atan2(P[k + 1][1] - P[k][1], P[k + 1][0] - P[k][0]);
      let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      const seg = Math.max(2, Math.min(10, (cum[k + 1] - cum[k - 1]) / 2)), R = seg / Math.max(1e-3, Math.abs(d));
      const vc = Math.sqrt(1.6 * Math.max(6, R)), dist = cum[k] - sNow;
      vlim = Math.min(vlim, Math.sqrt(vc * vc + 2 * 2.2 * Math.max(0, dist - 6)));
    }
    if (st.vmax) vlim = Math.min(vlim, st.vmax);
    const resto = ruta.len - sNow;
    vlim = Math.min(vlim, Math.sqrt(2 * 2.0 * Math.max(0, resto - 3)) + 0.3);
    const ent = { up: c.v < vlim - 0.5, down: c.v > vlim + 1.2, left: false, right: false };
    // dirección proporcional, con banda muerta (teclado: todo o nada, con pulsos)
    const want = Math.atan(2 * N.CAMION.L1 * Math.sin(ang) / Math.max(4, Math.hypot(tx - c.x, ty - c.y)));
    st.acc = (st.acc || 0) + (want - c.delta) * 0.5;
    if (want - c.delta > 0.01) ent.right = true; else if (want - c.delta < -0.01) ent.left = true;
    return { ent, resto };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = N; else G.NUCLEO = N;
})(typeof window !== 'undefined' ? window : globalThis);
