// FLETES — la empresa: vehículos que se compran, encargos con retiro y entrega, empleados y la meta.
// Empiezas repartiendo en bicicleta y terminas con una flota que reparte sola. Sin DOM (lo usa medir-empresa.js).
// Los precios y tarifas son del juego: están equilibrados para el ritmo de la partida, no copian los reales.
(function (G) {
  'use strict';
  const C = (typeof module !== 'undefined' && module.exports) ? require('./cargas.js') : G.CARGAS;
  const E = {};
  E.VERSION = 2;
  E.META = 70000000;        // valor de la empresa para ser "la empresa de repartos del sur"
  E.REVENTA = 0.7;           // un vehículo usado vale el 70% de lo que costó
  E.CAPITAL = 100000;        // los ahorros con que empiezas, además de la bicicleta
  E.BENCINA = 1300; E.DIESEL = 1050;

  // ---------- vehículos, en el orden en que se desbloquean ----------
  // pago = (base + porKm × km reales) × factor de la carga. prod: lo que factura con un empleado, en $ por hora de juego;
  // gasto: sueldo + combustible + mantención por hora de juego. mercado: cuántos rinden al 100% antes de saturar.
  E.VEH = [
    { id: 'bici', n: 'BICICLETA', precio: 40000, cap: 12, base: 6500, porKm: 5800, comb: 0, prod: 56000, gasto: 28000, mercado: 6,
      autopista: false, interurbano: 0, dist: [300, 1500], radioRetiro: 900, color: '#2a9ad0' },
    { id: 'moto', n: 'MOTO', precio: 150000, cap: 30, base: 9000, porKm: 5300, comb: E.BENCINA, prod: 102000, gasto: 51000, mercado: 6,
      autopista: true, interurbano: 0.12, dist: [600, 3500], radioRetiro: 1500, color: '#d43a2a' },
    { id: 'auto', n: 'AUTO PEQUEÑO', precio: 300000, cap: 300, base: 22000, porKm: 6700, comb: E.BENCINA, prod: 158000, gasto: 79000, mercado: 6,
      autopista: true, interurbano: 0.3, dist: [1000, 9000], radioRetiro: 3000, color: '#e8c020' },
    { id: 'furgon', n: 'FURGÓN', precio: 700000, cap: 1200, base: 32000, porKm: 6000, comb: E.DIESEL, prod: 222000, gasto: 111000, mercado: 6,
      autopista: true, interurbano: 0.35, dist: [1200, 12000], radioRetiro: 3500, color: '#eceef2' },
    { id: 'camioneta', n: 'CAMIONETA', precio: 1100000, cap: 1500, base: 40000, porKm: 7000, comb: E.DIESEL, prod: 302000, gasto: 151000, mercado: 6,
      autopista: true, interurbano: 0.4, dist: [1500, 14000], radioRetiro: 4000, color: '#3a8a4a' },
    { id: 'tres4', n: 'CAMIÓN 3/4', precio: 1900000, cap: 4000, base: 70000, porKm: 10000, comb: E.DIESEL, prod: 396000, gasto: 198000, mercado: 5,
      autopista: true, interurbano: 0.45, dist: [1500, 20000], radioRetiro: 6000, color: '#2a58c0' },
    { id: 'rigido', n: 'CAMIÓN RÍGIDO', precio: 3400000, cap: 10000, base: 108000, porKm: 13500, comb: E.DIESEL, prod: 640000, gasto: 320000, mercado: 5,
      autopista: true, interurbano: 0.5, dist: [2000, 25000], radioRetiro: 8000, color: '#c05020' },
    { id: 'tracto', n: 'TRACTO CON SEMIRREMOLQUE', precio: 6000000, cap: 26000, base: 190000, porKm: 24000, comb: E.DIESEL, prod: 934000, gasto: 467000, mercado: 5,
      autopista: true, interurbano: 0.5, dist: [2000, 30000], radioRetiro: 9000, color: '#d42a2a' },
  ];
  E.porId = {}; E.VEH.forEach((v, i) => { v.tier = i; E.porId[v.id] = v; });
  // género, para los textos ("tu nueva moto", "tu nuevo furgón")
  for (const id of ['bici', 'moto', 'camioneta']) E.porId[id].fem = true;
  E.art = (v, f, m) => v.fem ? f : m;
  // calles que cada vehículo no puede usar: la bici no entra a la autopista; el 3/4 no entra a los pasajes;
  // el camión rígido y el tracto van solo por vías anchas (avenidas, calles principales y carreteras)
  const ESTRECHAS = { residential: 1, living_street: 1, unclassified: 1 };
  E.porId.bici.evitar = e => e.c === 'motorway' || e.c === 'link';
  E.porId.tres4.evitar = e => e.c === 'living_street';
  E.porId.rigido.evitar = E.porId.tracto.evitar = e => !!ESTRECHAS[e.c];
  E.puedeUsar = (veh, e) => !veh.evitar || !veh.evitar(e);

  // ---------- qué lleva cada uno ----------
  const PAQ = ['SOBRE', 'DOCUMENTOS', 'COMIDA', 'REMEDIOS', 'FLORES', 'ENCOMIENDA', 'TORTA', 'LIBROS', 'ROPA', 'CELULAR'];
  const MOTO = ['ENCOMIENDA', 'REPUESTOS', 'COMIDA PARA 10', 'CAJA DE VINOS', 'COMPUTADOR', 'REMEDIOS', 'NEUMÁTICOS DE MOTO'];
  const AUTO = ['COMPRAS DEL SUPERMERCADO', 'CAJAS DE ARCHIVO', 'IMPRESORA', 'TELEVISOR', 'BALONES DE GAS', 'PEDIDO DE FERRETERÍA', 'MUESTRAS DE LABORATORIO'];
  const FURGON = ['REFRIGERADOR', 'LAVADORA', 'MUDANZA PEQUEÑA', 'CAJAS DE MERCADERÍA', 'MUEBLES ARMADOS', 'BIDONES DE AGUA', 'COLCHONES'];
  const CAMIONETA = ['LEÑA', 'MATERIALES DE CONSTRUCCIÓN', 'PLANCHAS DE ZINC', 'SACOS DE PAPAS', 'BOMBAS DE AGUA', 'FARDOS DE PASTO', 'CERCOS'];
  const CAMION = ['ABARROTES', 'BEBIDAS', 'MUEBLES', 'MADERA', 'CEMENTO', 'MUDANZA COMPLETA', 'ELECTRODOMÉSTICOS', 'MARISCOS', 'PAPAS'];
  const ITEMS = { bici: PAQ, moto: MOTO, auto: AUTO, furgon: FURGON, camioneta: CAMIONETA, tres4: CAMION, rigido: CAMION };
  // de dónde salen los encargos: tiendas para los chicos, depósitos para los grandes, y casas (encomiendas, mudanzas)
  const TIENDAS = ['supermercado', 'feria', 'ferreteria', 'repuestos', 'combustible', 'hospital', 'muebles'];

  // ---------- domicilios: puntos frente a las casas de calles reales ----------
  E.domicilios = function (M) {
    const out = [], usar = { residential: 1, living_street: 1, unclassified: 1, tertiary: 1, secondary: 1 };
    let semilla = 7;
    const rnd = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
    for (const e of M.ejes) {
      if (!usar[e.c] || !e.nombre || e.len < 30) continue;
      if (e.ciudad == null || e.ciudad < 0) continue;
      for (let s = 15; s < e.len - 10; s += 55 + rnd() * 30) {
        let j = 0; while (j < e.cum.length - 2 && e.cum[j + 1] < s) j++;
        const t = (s - e.cum[j]) / ((e.cum[j + 1] - e.cum[j]) || 1);
        const [x0, y0] = e.pts[j], [x1, y1] = e.pts[j + 1], L = (e.cum[j + 1] - e.cum[j]) || 1;
        const tx = (x1 - x0) / L, ty = (y1 - y0) / L, qx = x0 + (x1 - x0) * t, qy = y0 + (y1 - y0) * t;
        const lado = rnd() < 0.5 ? 1 : -1, off = e.hw + 2.5;
        const x = qx - ty * off * lado, y = qy + tx * off * lado;
        if (M.agua(x, y)) continue;
        const num = 100 + Math.round((s / e.len) * 30) * 20 + (lado > 0 ? 0 : 1) + Math.floor(e.id % 7) * 300;
        out.push({ id: 'd' + out.length, cat: 'domicilio', x, y, ciudad: e.ciudad, nomCalle: e.nombre, numero: num, ang: Math.atan2(ty, tx),
          calle: { e, j, s, qx, qy, tx, ty, d: off, lat: 0 } });
      }
    }
    // grilla para buscar cerca
    const GS = 200, grid = new Map();
    out.forEach(d => { const k = Math.floor(d.x / GS) + ',' + Math.floor(d.y / GS); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(d); });
    out.cerca = (x, y, r) => { const res = []; for (let gx = Math.floor((x - r) / GS); gx <= Math.floor((x + r) / GS); gx++) for (let gy = Math.floor((y - r) / GS); gy <= Math.floor((y + r) / GS); gy++) for (const d of grid.get(gx + ',' + gy) || []) if (Math.hypot(d.x - x, d.y - y) <= r) res.push(d); return res; };
    return out;
  };

  E.nombreLugar = function (l, M) {
    const ciudad = M.ciudades[l.ciudad] ? M.ciudades[l.ciudad].nombre.toUpperCase() : '';
    if (l.cat === 'domicilio') return { tipo: 'DOMICILIO', calle: (l.nomCalle + ' ' + l.numero).toUpperCase(), ciudad };
    return { tipo: C.CATS[l.cat] || l.cat.toUpperCase(), calle: (l.nomCalle || '').toUpperCase(), ciudad };
  };

  // ---------- partida ----------
  E.nuevaPartida = function (seed) {
    const P = C.nuevaPartida(seed);
    P.version = E.VERSION; P.dinero = E.CAPITAL; P.vehiculo = 'bici'; P.maxTier = 0; P.flota = {}; P.tReal = 0; P.meta = null; P.hitos = {};
    P.t = 9 * 3600; // las 9 de la mañana del primer día
    return P;
  };
  E.veh = P => E.porId[P.vehiculo];
  // ruta para un vehículo (la bici no entra a la autopista)
  E.opts = veh => veh.evitar ? { evitar: veh.evitar } : null;
  E.ruta = (M, veh, desde, hasta) => M.ruta(desde, hasta, E.opts(veh));
  // la calle donde el vehículo retira o entrega: la del lugar, o la vía apta más cercana (a 250 m o menos)
  E.calleDe = function (M, l, veh) {
    if (l.calle && E.puedeUsar(veh, l.calle.e)) return { calle: l.calle, x: l.x, y: l.y };
    const c = M.cercano(l.x, l.y, 250, null, e => E.puedeUsar(veh, e) && e.c !== 'motorway' && e.c !== 'link');
    if (!c) return null;
    // el punto de parada queda a la orilla de esa vía, del lado del lugar
    const lado = Math.sign((l.x - c.qx) * -c.ty + (l.y - c.qy) * c.tx) || 1, off = c.e.hw + 1.5;
    return { calle: c, x: c.qx - c.ty * off * lado, y: c.qy + c.tx * off * lado, lejos: true };
  };

  // ofertas de encargos cerca de (x, y) para el vehículo actual: retirar en un lugar y entregar en otro
  E.ofertas = function (P, M, doms, x, y, n) {
    const veh = E.veh(P), out = [], usados = new Set();
    const lugarCerca = (cx, cy, r, tipos) => {
      const tiendas = M.depositos.filter(d => tipos.includes(d.cat) && Math.hypot(d.x - cx, d.y - cy) < r);
      const casas = doms.cerca(cx, cy, Math.min(r, 1500));
      return { tiendas, casas };
    };
    for (let k = 0; k < (n || 4) * 8 && out.length < (n || 4); k++) {
      // origen
      let de, a;
      const grande = veh.tier >= 5;
      if (grande) {
        const ds = M.depositos.filter(d => Math.hypot(d.x - x, d.y - y) < veh.radioRetiro);
        if (!ds.length) continue;
        de = ds[Math.floor(P.rnd() * ds.length)];
      } else {
        const { tiendas, casas } = lugarCerca(x, y, veh.radioRetiro, veh.tier <= 1 ? TIENDAS : TIENDAS.concat(['bodega', 'industria', 'puerto']));
        const deCasa = (veh.tier <= 1 ? 0.45 : 0.35) > P.rnd();
        const pool = deCasa && casas.length ? casas : tiendas.length ? tiendas : casas;
        if (!pool.length) continue;
        de = pool[Math.floor(P.rnd() * pool.length)];
      }
      // destino: a otra ciudad (si el vehículo puede) o dentro de la misma, a la distancia de su rango
      const otra = P.rnd() < veh.interurbano;
      const [dmin, dmax] = veh.dist;
      if (grande) {
        const ds = M.depositos.filter(d => d !== de && (d.ciudad !== de.ciudad) === otra && Math.hypot(d.x - de.x, d.y - de.y) > dmin);
        if (!ds.length) continue;
        a = ds[Math.floor(P.rnd() * ds.length)];
      } else {
        let cand;
        if (otra) cand = doms.filter ? doms.filter(d => d.ciudad !== de.ciudad && P.rnd() < 0.02) : [];
        else { cand = doms.cerca(de.x, de.y, dmax).filter(d => d.ciudad === de.ciudad && Math.hypot(d.x - de.x, d.y - de.y) > dmin); }
        if (veh.tier >= 2 && P.rnd() < 0.3) cand = cand.concat(M.depositos.filter(d => (d.ciudad !== de.ciudad) === otra && Math.hypot(d.x - de.x, d.y - de.y) > dmin && (otra || Math.hypot(d.x - de.x, d.y - de.y) < dmax)));
        if (!cand.length) continue;
        a = cand[Math.floor(P.rnd() * cand.length)];
      }
      if (!de.calle || !a.calle || de === a) continue;
      const clave = de.id + '>' + a.id; if (usados.has(clave)) continue; usados.add(clave);
      const pDe = E.calleDe(M, de, veh), pA = E.calleDe(M, a, veh);
      if (!pDe || !pA) continue;
      const ruta = E.ruta(M, veh, Object.assign({}, pDe.calle, { dir: 0 }), pA.calle);
      if (!ruta) continue;
      const enc = E.encargo(P, M, veh, de, a, ruta, x, y);
      enc.pDe = pDe; enc.pA = pA;
      out.push(enc);
    }
    out.sort((p, q) => p.aRetiro - q.aRetiro);
    return out;
  };
  E.encargo = function (P, M, veh, de, a, ruta, x, y) {
    const km = ruta.real / 1000;
    let n, peso, rem = null;
    if (veh.id === 'tracto') {
      const tipos = Object.entries(C.TIPOS), [, t] = tipos[Math.floor(P.rnd() * tipos.length)];
      n = t.n; rem = t.rem; peso = Math.round((t.peso[0] + P.rnd() * (t.peso[1] - t.peso[0])) * 1000);
    } else {
      const items = ITEMS[veh.id];
      n = items[Math.floor(P.rnd() * items.length)];
      const prev = veh.tier > 0 ? E.VEH[veh.tier - 1].cap : 0;
      peso = Math.max(1, Math.round(prev * 0.6 + P.rnd() * (veh.cap - prev * 0.6)));
    }
    const factor = 0.9 + P.rnd() * 0.25;
    const pago = Math.round((veh.base + veh.porKm * km) * factor / 500) * 500;
    const aRetiro = Math.hypot(de.x - x, de.y - y);
    // plazo: el tiempo estimado (con el retiro) holgado, en tiempo del juego
    const est = (ruta.seg * 1.6 + 20 * (ruta.indic ? ruta.indic.length : 0) + aRetiro / Math.min(10, E.velRef(veh)) * 1.4) * C.ESCALA;
    const plazo = Math.round((est * 1.7 + 600) / 300) * 300;
    return { veh: veh.id, n, peso, rem, de, a, km, pago, plazo, aRetiro, dano: 0, fase: 'retiro' };
  };
  E.velRef = veh => ({ bici: 5.5, moto: 11, auto: 12, furgon: 11, camioneta: 11, tres4: 10, rigido: 9, tracto: 9 })[veh.id];
  E.aceptar = function (P, enc) { P.encargo = Object.assign({}, enc, { limite: P.t + enc.plazo, inicio: P.t, litros0: null }); return P.encargo; };
  // la entrega: pago, bono a tiempo, descuentos por daño y combustible
  E.entregar = function (P, litros) {
    const e = P.encargo; if (!e) return null;
    const veh = E.porId[e.veh];
    const aTiempo = P.t <= e.limite;
    const bono = aTiempo ? Math.round(e.pago * C.BONO_A_TIEMPO / 100) * 100 : 0;
    const desc = Math.round(e.pago * e.dano / 100 / 100) * 100;
    const comb = Math.round(litros * (veh.comb || 0) / 100) * 100;
    const neto = e.pago + bono - desc - comb;
    P.dinero += neto; P.entregas++;
    const r = { n: e.n, pago: e.pago, bono, desc, diesel: comb, neto, aTiempo, km: e.km, dano: e.dano, duracion: P.t - e.inicio };
    P.historial.push(r); if (P.historial.length > 30) P.historial.shift();
    P.encargo = null;
    return r;
  };

  // ---------- empresa: compra, flota y empleados ----------
  E.disponible = (P, veh) => veh.tier <= P.maxTier + 1;
  E.valorVeh = veh => Math.round(veh.precio * E.REVENTA);
  E.valor = function (P) {
    let v = P.dinero + E.valorVeh(E.veh(P));
    for (const [id, n] of Object.entries(P.flota)) v += n * E.valorVeh(E.porId[id]);
    return v;
  };
  // comprar para manejarlo uno mismo: el vehículo anterior pasa a la flota con un empleado
  E.comprarPropio = function (P, id) {
    const veh = E.porId[id];
    if (!veh || !E.disponible(P, veh) || P.dinero < veh.precio || P.encargo) return false;
    P.dinero -= veh.precio;
    P.flota[P.vehiculo] = (P.flota[P.vehiculo] || 0) + 1;
    P.vehiculo = id; P.maxTier = Math.max(P.maxTier, veh.tier);
    return true;
  };
  // comprar uno para un empleado
  E.comprarFlota = function (P, id) {
    const veh = E.porId[id];
    if (!veh || veh.tier > P.maxTier || P.dinero < veh.precio) return false;
    P.dinero -= veh.precio; P.flota[id] = (P.flota[id] || 0) + 1;
    return true;
  };
  E.vender = function (P, id) {
    if (!P.flota[id]) return false;
    P.flota[id]--; if (!P.flota[id]) delete P.flota[id];
    P.dinero += E.valorVeh(E.porId[id]);
    return true;
  };
  // usar uno de la flota (el actual pasa a la flota)
  E.cambiar = function (P, id) {
    if (!P.flota[id] || P.encargo || id === P.vehiculo) return false;
    P.flota[id]--; if (!P.flota[id]) delete P.flota[id];
    P.flota[P.vehiculo] = (P.flota[P.vehiculo] || 0) + 1;
    P.vehiculo = id; return true;
  };
  // rendimiento de la flota: el k-ésimo vehículo de un tipo rinde menos cuando el mercado se satura
  E.rinde = (veh, k) => k < veh.mercado ? 1 : Math.pow(0.8, k - veh.mercado + 1);
  E.flotaPorHora = function (P) { // neto en $ por hora de juego
    let neto = 0, bruto = 0, gasto = 0;
    for (const [id, n] of Object.entries(P.flota)) {
      const veh = E.porId[id];
      for (let k = 0; k < n; k++) { const b = veh.prod * E.rinde(veh, k); bruto += b; gasto += veh.gasto; }
    }
    neto = bruto - gasto;
    return { neto, bruto, gasto, vehiculos: Object.values(P.flota).reduce((a, b) => a + b, 0) };
  };
  // avanza el tiempo del juego dt segundos: la flota trabaja
  E.avanzar = function (P, dtJuego) {
    const f = E.flotaPorHora(P);
    P.dinero += f.neto * dtJuego / 3600;
    P.ganadoFlota = (P.ganadoFlota || 0) + f.neto * dtJuego / 3600;
  };
  E.hitos = [
    { id: 'moto', t: 'PRIMERA MOTO', f: P => P.maxTier >= 1 },
    { id: 'empleado', t: 'PRIMER EMPLEADO', f: P => E.flotaPorHora(P).vehiculos >= 1 },
    { id: 'auto', t: 'PRIMER AUTO', f: P => P.maxTier >= 2 },
    { id: 'flota5', t: 'CINCO VEHÍCULOS EN LA FLOTA', f: P => E.flotaPorHora(P).vehiculos >= 5 },
    { id: 'furgon', t: 'PRIMER FURGÓN', f: P => P.maxTier >= 3 },
    { id: 'millon', t: 'UN MILLÓN EN CAJA', f: P => P.dinero >= 1e6 },
    { id: 'tres4', t: 'PRIMER CAMIÓN', f: P => P.maxTier >= 5 },
    { id: 'flota20', t: 'VEINTE VEHÍCULOS', f: P => E.flotaPorHora(P).vehiculos >= 20 },
    { id: 'tracto', t: 'PRIMER TRACTO CON SEMIRREMOLQUE', f: P => P.maxTier >= 7 },
    { id: 'meta', t: 'LA EMPRESA DE REPARTOS DEL SUR', f: P => E.valor(P) >= E.META },
  ];
  // revisa hitos nuevos; devuelve la lista de los que se acaban de lograr
  E.revisarHitos = function (P) {
    const nuevos = [];
    for (const h of E.hitos) if (!P.hitos[h.id] && h.f(P)) { P.hitos[h.id] = { t: P.t, real: P.tReal }; nuevos.push(h); }
    if (P.hitos.meta && !P.meta) P.meta = P.hitos.meta;
    return nuevos;
  };
  E.fmtTiempo = s => { const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return h ? h + ' H ' + String(m).padStart(2, '0') + ' MIN' : m + ' MIN'; };

  if (typeof module !== 'undefined' && module.exports) module.exports = E; else G.EMPRESA = E;
})(typeof window !== 'undefined' ? window : globalThis);
