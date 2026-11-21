// FLETES — física del camión (tracto + semirremolque), tráfico de decorado y piloto automático.
// Sin DOM: la usan el juego y medir.js. Unidades: metros, segundos, radianes. +x este, +y sur.
(function (G) {
  'use strict';
  const N = {};
  N.DT = 1 / 120;
  // tracto: distancia entre ejes, quinta rueda (adelante del eje trasero), voladizos
  N.CAMION = { L1: 3.9, quinta: 0.45, frente: 5.0, cola: 1.1, ancho: 2.5, L2: 9.6, remFrente: 1.4, remCola: 3.0,
    masaTracto: 8200, masaRemolque: 7000, potencia: 330000, fuerzaMax: 52000, vmax: 25, vmaxAtras: 3.6,
    freno: 5.5, cdA: 5.4, rodado: 0.0075, rodadoFuera: 0.06, vmaxFuera: 8, giroMax: 0.62, latMax: 5.0, volante: 1.6, volanteVuelta: 2.4 }; // latMax: aceleración lateral permitida (arcade: más que un camión real)

  N.CAMION.remolque = true; N.CAMION.masa = N.CAMION.masaTracto; N.CAMION.largo = N.CAMION.frente + N.CAMION.cola; N.CAMION.alto = 3.8;
  N.CAMION.marchas = 12; N.CAMION.consumo = 0.24; N.CAMION.motor = { base: 22, esc: 62, vol: 1 };
  // fichas de cada vehículo (el origen es el eje trasero; frente y cola, desde ahí). Arcade: giran más que los de verdad
  const ficha = (o) => Object.assign({ vmaxAtras: 3, rodado: 0.012, rodadoFuera: 0.05, giroMax: 0.62, volante: 1.8, volanteVuelta: 2.6, cdA: 0.8, remolque: false }, o);
  N.VEH = {
    bici: ficha({ L1: 1.05, frente: 1.35, cola: 0.4, ancho: 0.6, alto: 1.75, masa: 85, potencia: 420, fuerzaMax: 230, vmax: 6.6, vmaxAtras: 1.2, freno: 4.5, cdA: 0.5, rodado: 0.006, rodadoFuera: 0.02, vmaxFuera: 5.5, giroMax: 0.75, latMax: 4.5, volante: 2.6, volanteVuelta: 3.4, marchas: 1, consumo: 0, motor: null }),
    moto: ficha({ L1: 1.35, frente: 1.65, cola: 0.45, ancho: 0.8, alto: 1.6, masa: 230, potencia: 9000, fuerzaMax: 1150, vmax: 22, vmaxAtras: 1.5, freno: 6.5, cdA: 0.55, vmaxFuera: 6, giroMax: 0.7, latMax: 6, volante: 2.4, volanteVuelta: 3.2, marchas: 5, consumo: 0.035, motor: { base: 55, esc: 140, vol: 0.7 } }),
    auto: ficha({ L1: 2.4, frente: 3.1, cola: 0.65, ancho: 1.7, alto: 1.5, masa: 1050, potencia: 52000, fuerzaMax: 5200, vmax: 28, freno: 7, cdA: 0.7, vmaxFuera: 7, giroMax: 0.65, latMax: 6, volante: 2.2, volanteVuelta: 3, marchas: 5, consumo: 0.065, motor: { base: 38, esc: 95, vol: 0.8 } }),
    furgon: ficha({ L1: 3.0, frente: 3.9, cola: 1.05, ancho: 1.95, alto: 2.3, masa: 2100, potencia: 80000, fuerzaMax: 8500, vmax: 27, freno: 6.5, cdA: 1.6, vmaxFuera: 7, giroMax: 0.63, latMax: 5.5, volante: 2, volanteVuelta: 2.8, marchas: 5, consumo: 0.09, motor: { base: 30, esc: 80, vol: 0.9 } }),
    camioneta: ficha({ L1: 3.1, frente: 4.1, cola: 1.2, ancho: 1.85, alto: 1.85, masa: 1950, potencia: 110000, fuerzaMax: 9500, vmax: 29, freno: 6.5, cdA: 1.3, rodadoFuera: 0.025, vmaxFuera: 12, giroMax: 0.63, latMax: 5.5, volante: 2, volanteVuelta: 2.8, marchas: 6, consumo: 0.1, motor: { base: 28, esc: 78, vol: 0.9 } }),
    tres4: ficha({ L1: 3.4, frente: 4.6, cola: 1.8, ancho: 2.1, alto: 3.0, masa: 4300, potencia: 115000, fuerzaMax: 17000, vmax: 25, freno: 6.2, cdA: 3.2, vmaxFuera: 7, giroMax: 0.63, latMax: 5.2, volante: 1.8, volanteVuelta: 2.6, marchas: 6, consumo: 0.15, motor: { base: 26, esc: 72, vol: 1 } }),
    rigido: ficha({ L1: 4.8, frente: 6.3, cola: 2.5, ancho: 2.5, alto: 3.6, masa: 8800, potencia: 220000, fuerzaMax: 34000, vmax: 25, freno: 5.8, cdA: 4.8, vmaxFuera: 7, giroMax: 0.62, latMax: 5, volante: 1.7, volanteVuelta: 2.5, marchas: 8, consumo: 0.22, motor: { base: 24, esc: 66, vol: 1 } }),
    tracto: N.CAMION,
  };
  for (const v of Object.values(N.VEH)) if (v.largo == null) v.largo = v.frente + v.cola;
  N.ficha = c => (c && N.VEH[c.tipo]) || N.CAMION;

  N.nuevoVehiculo = function (tipo, x, y, a) {
    const c = { tipo: N.VEH[tipo] ? tipo : 'tracto', x, y, a, v: 0, delta: 0, a2: a, remolque: false, carga: 0, rpm: 0.2, marcha: 1, gas: 0, freno: 0, atras: false, tAtras: 0,
      fuera: false, golpe: 0, km: 0, kmReal: 0, combustible: 0, tq: 0 };
    N.ponerRemolque(c, false);
    return c;
  };
  N.nuevoCamion = (x, y, a) => N.nuevoVehiculo('tracto', x, y, a);
  // carga o descarga. El tracto engancha o suelta el semirremolque, alineado; los demás solo suman el peso
  N.ponerRemolque = function (c, si, carga) {
    const C = N.ficha(c);
    c.remolque = !!si && C.remolque; c.cargado = !!si; c.carga = si ? (carga || 0) : 0; c.a2 = c.a;
    const q = C.quinta || 0, L2 = C.L2 || 0;
    const hx = c.x + Math.cos(c.a) * q, hy = c.y + Math.sin(c.a) * q;
    c.rx = hx - Math.cos(c.a) * L2; c.ry = hy - Math.sin(c.a) * L2;
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
  N.masa = c => { const C = N.ficha(c); return C.masa + (c.remolque ? C.masaRemolque : 0) + (c.carga || 0); };

  // puntos del contorno para choques: [x, y, radio, esRemolque]
  N.circulos = function (c, out) {
    const C = N.ficha(c); out = out || [];
    out.length = 0;
    const ca = Math.cos(c.a), sa = Math.sin(c.a);
    // cuerpo: círculos del ancho del vehículo, separados a lo más 2,4 m
    const r = Math.min(1.25, C.ancho / 2 + 0.05), d0 = -C.cola + r, d1 = C.frente - r, n = Math.max(1, Math.ceil((d1 - d0) / 2.4));
    for (let k = 0; k <= n; k++) { const d = d1 - (d1 - d0) * k / n; out.push([c.x + ca * d, c.y + sa * d, r, 0]); }
    if (c.remolque) {
      const cb = Math.cos(c.a2), sb = Math.sin(c.a2);
      const hx = c.rx + cb * C.L2, hy = c.ry + sb * C.L2; // pivote
      for (let k = 0; k <= 4; k++) { const d = C.remFrente - 1.2 - k * (C.L2 + C.remFrente + C.remCola - 2.4) / 4; out.push([hx + cb * (d), hy + sb * (d), 1.25, 1]); }
    }
    return out;
  };

  const tmpC = [], tmpA = [];
  const cacheMarchas = new Map();
  function marchas(C) { let m = cacheMarchas.get(C); if (!m) { m = [0]; for (let g = 1; g <= C.marchas; g++) m.push(C.vmax * 1.06 * Math.pow(g / C.marchas, 1.25)); cacheMarchas.set(C, m); } return m; }
  // paso de física. ent: {up, down, left, right, mano}. mundo: el de mundo.js (o null)
  N.paso = function (c, ent, dt, mundo, obst) {
    const C = N.ficha(c), m = N.masa(c);
    const v = c.v, av = Math.abs(v);
    // ---- dirección: el máximo baja con la velocidad (aceleración lateral acotada)
    const dmax = Math.min(C.giroMax, Math.atan(C.latMax * C.L1 / Math.max(1, v * v)));
    const objetivo = (ent.left ? -1 : 0) + (ent.right ? 1 : 0);
    const tgt = objetivo * dmax, vel = objetivo ? C.volante : C.volanteVuelta;
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
    const res = (fuera ? C.rodadoFuera : C.rodado) * m * 9.8 + 0.6 * C.cdA * v * v + (gas ? 0 : m * 0.06); // freno motor suave
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
    const antes = (obst && obst.length) || mundo ? N.circulos(c, tmpA).map(q => q.slice()) : null;
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
      let golpeAuto = false;
      for (let ci = 0; ci < cs.length; ci++) {
        const [x, y, r] = cs[ci];
        let hit = false;
        // si quedó metido en un edificio al enganchar o aparecer, se le deja salir (solo de edificios y agua)
        if (mundo && !c.atrapado && (mundo.chocaEdif(x, y, r) || mundo.agua(x, y))) {
          const q = antes && antes[ci];
          if (!q || !(mundo.chocaEdif(q[0], q[1], r) || mundo.agua(q[0], q[1]))) hit = true;
        }
        // contra un auto solo cuenta al entrar en contacto (así puede alejarse si quedó pegado)
        if (!hit && obst) for (const o of obst) {
          const d2 = (x - o.x) ** 2 + (y - o.y) ** 2;
          if (d2 < (r + o.r) ** 2) {
            // si ya estaban superpuestos antes del paso, no bloquea: el camión puede irse en cualquier dirección
            const q = antes && antes[ci];
            // postes y árboles: se quiebran al pasarles encima, no traban al camión
            if (o.fragil) { if (!o.roto) { o.roto = 1; o.vRoto = Math.abs(c.v); } continue; }
            // maniobrando despacio, el camión tiene prioridad: empuja al auto (que retrocede) en vez de trabarse
            if (o.a && Math.abs(c.v) < N.VEL_EMPUJE) { o.a.empujado = 0.4; continue; }
            if (!q || (q[0] - o.x) ** 2 + (q[1] - o.y) ** 2 >= (r + o.r) ** 2) { hit = true; golpeAuto = true; o.tocado = 1; break; }
          }
        }
        if (hit) { golpe = Math.max(golpe, Math.abs(c.v), golpeAuto ? 0.01 : 0); break; }
      }
      if (golpe) {
        c.x = px; c.y = py; c.a = pa; c.rx = prx; c.ry = pry;
        if (c.remolque) c.a2 = Math.atan2(py + Math.sin(pa) * C.quinta - pry, px + Math.cos(pa) * C.quinta - prx);
        c.v = -c.v * 0.15;
      }
    }
    c.golpe = golpe;
    if (c.atrapado && mundo) { c.atrapadoT = (c.atrapadoT || 0) + dt; if (c.atrapadoT > 0.25) { c.atrapadoT = 0; c.atrapado = N.tocaAlgo(c, mundo, null); } }
    // ---- marcha y revoluciones (caja automática; el tracto tiene 12 marchas, una moto 5, la bici una sola)
    const MARCHAS = C === N.CAMION ? [0, 2.2, 3.4, 4.8, 6.4, 8.2, 10.2, 12.4, 14.8, 17.4, 20.2, 23.2, 26.4] : marchas(C);
    const nm = MARCHAS.length - 1;
    if (c.atras) { c.marcha = -1; c.rpm = 0.25 + av / C.vmaxAtras * 0.5; }
    else {
      let g = 1; while (g < nm && av > MARCHAS[g] * 0.92) g++;
      c.marcha = g;
      const lo = MARCHAS[g - 1], hi = MARCHAS[g];
      c.rpm = 0.25 + Math.max(0, Math.min(1, (av - lo * 0.92) / (hi - lo * 0.92))) * 0.6 + gas * 0.1;
    }
    // ---- distancias y combustible (litros por km según el vehículo; más con carga y acelerando)
    const ds = Math.abs(c.v) * dt;
    c.km += ds / 1000;
    const real = mundo && mundo.factorReal ? mundo.factorReal(c.x, c.y) : 1;
    c.kmReal += ds * real / 1000;
    c.combustible += ds * real / 1000 * (C === N.CAMION ? 0.24 + 0.12 * (m - 15200) / 25000 + 0.1 * gas : C.consumo * (1 + (c.carga || 0) / C.masa * 0.6 + 0.3 * gas));
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
  // cuerpo de un vehículo como círculos de radio ~1 cada 3 m o menos (un bus de 11 m lleva 5)
  N.cuerpo = function (x, y, ang, largo) {
    const fx = Math.cos(ang), fy = Math.sin(ang), h = largo / 2 - 1, n = Math.max(2, Math.ceil((2 * h) / 3) + 1), out = [];
    for (let k = 0; k < n; k++) { const d = -h + 2 * h * k / (n - 1); out.push([x + fx * d, y + fy * d]); }
    return out;
  };
  N.FRENO_AUTO = 8; // m/s²: los autos frenan fuerte si se les cruza el camión
  N.VEL_EMPUJE = 2; // m/s: bajo esta velocidad el camión empuja a los autos en vez de chocar
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
    let libre = 99;
    for (const o of obst) {
      if (o === a) continue;
      const dx = o.x - a.x, dy = o.y - a.y, d = dx * fx + dy * fy;
      if (d <= 0 || d > 30) continue;
      const lat = Math.abs(-dx * fy + dy * fx);
      if (lat < (o.ancho || 1.8)) libre = Math.min(libre, d - (o.largo || 5) * 0.5 - a.largo * 0.5);
    }
    // seguir la calle, no la línea recta: el auto de adelante en el mismo tramo, y en cruces e incorporaciones
    // cede el paso al que llega primero o al que todavía está saliendo del cruce
    const finV = a.dir > 0 ? a.e.b : a.e.a, aFin = a.dir > 0 ? a.e.len - a.s : a.s;
    const grado = mundo.vert[finV].ej.length;
    for (const o of obst) {
      if (o === a || o.fijo || !o.e) continue;
      if (o.e === a.e && o.dir === a.dir && (!(a.e.ow && a.e.hw > 4.2) || (o.carril || 1) === (a.carril || 1))) {
        const ds = (o.s - a.s) * a.dir;
        if (ds > 0 && ds < 40) libre = Math.min(libre, ds - (o.largo + a.largo) / 2);
        continue;
      }
      // no ceder ante un auto que lleva rato detenido: así no se forman esperas en cadena (la mirada hacia adelante igual evita el choque)
      // en los cruces con semáforo mandan las luces, no el que llega primero
      if (grado < 3 || aFin > 24 || (o.v < 0.5 && (o.espera || 0) > 1.2) || (mundo.sem && mundo.sem.porVert.has(finV))) continue;
      const oFinV = o.dir > 0 ? o.e.b : o.e.a, oFin = o.dir > 0 ? o.e.len - o.s : o.s;
      const espera = (mundo.vert[finV].r || 4) + 4 + a.largo / 2; // detenerse antes de la esquina, no encima
      if (oFinV === finV && o.e !== a.e && (oFin < aFin - 0.5 || (Math.abs(oFin - aFin) <= 0.5 && o.id < a.id)) && aFin > espera - 2) {
        libre = Math.min(libre, aFin - espera); // otro llega antes al cruce: esperar
        continue;
      }
      const oIniV = o.dir > 0 ? o.e.a : o.e.b, oSalio = o.dir > 0 ? o.s : o.e.len - o.s;
      if (oIniV === finV && oSalio < o.largo + 4 && aFin > espera - 2) libre = Math.min(libre, aFin - espera); // todavía está en el cruce
    }
    // semáforo: con rojo se detiene en la línea; con amarillo, solo si alcanza a frenar
    if (mundo.sem && N.SEM) {
      const acc = mundo.sem.porAcceso.get(a.e.id + ':' + a.dir);
      if (acc) {
        const est = N.SEM.estado(acc.cruce, acc.fase, mundo.semT || 0);
        const dLinea = aFin - acc.retiro - a.largo / 2; // de la trompa a la línea
        const alcanza = dLinea > a.v * a.v / (2 * 5) + 0.5;
        if (dLinea > -0.5 && (est === 'rojo' || (est === 'amarillo' && alcanza))) libre = Math.min(libre, dLinea + 1.5);
      }
    }
    // el camión (tracto y remolque) es sólido: se revisa la pista hasta la distancia de frenado
    const alcance = a.v * a.v / (2 * N.FRENO_AUTO) + 4;
    a.pegado = 0;
    for (const o of obst) {
      if (!o.fijo) continue;
      if (Math.abs(o.x - a.x) > alcance + 8 || Math.abs(o.y - a.y) > alcance + 8) continue;
      for (let k = 0; k * 1.0 <= alcance; k++) {
        const px = a.x + fx * (a.largo / 2 + k), py = a.y + fy * (a.largo / 2 + k);
        if ((px - o.x) ** 2 + (py - o.y) ** 2 < (o.r + 1.15) ** 2) { libre = Math.min(libre, Math.max(0, k - 1)); break; }
      }
      // ¿ya quedó encima del camión? (el camión se le cruzó encima): retrocede por su pista
      for (const [px, py] of N.cuerpo(a.x, a.y, a.ang, a.largo)) if ((px - o.x) ** 2 + (py - o.y) ** 2 < (o.r + 1.0) ** 2) a.pegado = 1;
    }
    a.espera = libre < 4 ? (a.espera || 0) + dt : 0;
    // velocidad que permite detenerse antes del obstáculo
    const vObj = Math.min(a.vmax, Math.sqrt(2 * N.FRENO_AUTO * Math.max(0, libre - 1.5)), Math.max(0, (libre - 1.5) * 1.2) + (libre > 6 ? 99 : 0));
    a.v += Math.max(-N.FRENO_AUTO * dt, Math.min(1.8 * dt, vObj - a.v));
    const prev = { e: a.e, dir: a.dir, s: a.s, x: a.x, y: a.y, ang: a.ang, vmax: a.vmax };
    if (a.empujado > 0) { a.empujado -= dt; a.pegado = 1; }
    if (a.pegado) { a.v = 0; a.tPegado = (a.tPegado || 0) + dt; a.s -= a.dir * 2.5 * dt; } else a.tPegado = 0;
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
    // nunca meterse en otro auto (tampoco al retroceder empujado por el camión): si el paso lo deja encima de uno, se deshace
    {
      const cuerpo = (x, y, ang, l) => N.cuerpo(x, y, ang, l);
      const yo = cuerpo(a.x, a.y, a.ang, a.largo), yoAntes = cuerpo(prev.x, prev.y, prev.ang, a.largo);
      for (const o of obst) {
        if (o === a || o.fijo || !o.e || Math.abs(o.x - a.x) > 14 || Math.abs(o.y - a.y) > 14) continue;
        const ot = cuerpo(o.x, o.y, o.ang, o.largo);
        let dAhora = 1e9, dAntes = 1e9;
        for (const p of yo) for (const q of ot) dAhora = Math.min(dAhora, Math.hypot(p[0] - q[0], p[1] - q[1]));
        for (const p of yoAntes) for (const q of ot) dAntes = Math.min(dAntes, Math.hypot(p[0] - q[0], p[1] - q[1]));
        // cede el que tiene al otro adelante; si van parejos, pasa el de número menor
        const rel = (o.x - prev.x) * Math.cos(prev.ang) + (o.y - prev.y) * Math.sin(prev.ang);
        const cedo = a.pegado ? rel < -0.5 : rel > 0.5 || (Math.abs(rel) <= 0.5 && o.id < a.id); // retrocediendo, cede ante el de atrás
        if (dAhora < dAntes && (dAhora < 1.4 || (dAhora < 2.0 && cedo))) { Object.assign(a, prev); a.v = 0; a.trabado = (a.trabado || 0) + dt; return; }
      }
    }
    a.trabado = 0;
  };

  // ---------- piloto automático (para medir): sigue la polilínea de la ruta ----------
  const resto0 = (ruta, s) => ruta.len - s;
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
    // por su pista: en calles de doble sentido apunta a la derecha de la línea del GPS (st.mundo opcional)
    if (st.mundo && j < P.length - 1 && resto0(ruta, sNow) > 25) {
      const q = st.mundo.enCalzada(tx, ty);
      if (q && !q.e.ow) { const dx = P[j + 1][0] - P[j][0], dy = P[j + 1][1] - P[j][1], L = Math.hypot(dx, dy) || 1, off = Math.min(2.2, q.e.hw * 0.5); tx += -dy / L * off; ty += dx / L * off; }
    }
    let ang = Math.atan2(ty - c.y, tx - c.x) - c.a; while (ang > Math.PI) ang -= 2 * Math.PI; while (ang < -Math.PI) ang += 2 * Math.PI;
    // velocidad: según la curvatura de los próximos 60 m
    let vlim = N.ficha(c).vmax;
    for (let k = i + 1; k < P.length - 1 && cum[k] - sNow < 70; k++) {
      const a1 = Math.atan2(P[k][1] - P[k - 1][1], P[k][0] - P[k - 1][0]), a2 = Math.atan2(P[k + 1][1] - P[k][1], P[k + 1][0] - P[k][0]);
      let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      const seg = Math.max(2, Math.min(10, (cum[k + 1] - cum[k - 1]) / 2)), R = seg / Math.max(1e-3, Math.abs(d));
      const vc = Math.sqrt(1.6 * Math.max(6, R)), dist = cum[k] - sNow;
      vlim = Math.min(vlim, Math.sqrt(vc * vc + 2 * 2.2 * Math.max(0, dist - 6)));
    }
    if (st.vmax != null) vlim = Math.min(vlim, st.vmax);
    const resto = ruta.len - sNow;
    vlim = Math.min(vlim, Math.sqrt(2 * 2.0 * Math.max(0, resto - 3)) + 0.3);
    const ent = { up: c.v < vlim - 0.5, down: c.v > vlim + 1.2 || (vlim < 0.3 && c.v > 0.05), left: false, right: false };
    // dirección proporcional, con banda muerta (teclado: todo o nada, con pulsos)
    const want = Math.atan(2 * N.ficha(c).L1 * Math.sin(ang) / Math.max(4, Math.hypot(tx - c.x, ty - c.y)));
    st.acc = (st.acc || 0) + (want - c.delta) * 0.5;
    if (want - c.delta > 0.01) ent.right = true; else if (want - c.delta < -0.01) ent.left = true;
    return { ent, resto };
  };

  N.SEM = typeof module !== 'undefined' && module.exports ? require('./semaforos.js') : G.SEMAFOROS;
  if (typeof module !== 'undefined' && module.exports) module.exports = N; else G.NUCLEO = N;
})(typeof window !== 'undefined' ? window : globalThis);
