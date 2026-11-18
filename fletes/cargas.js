// FLETES — encargos de carga, pagos, combustible y reloj del juego. Sin DOM (lo usa medir.js).
(function (G) {
  'use strict';
  const C = {};
  // reloj: un segundo real son ESCALA segundos del juego
  C.ESCALA = 4;
  C.DIESEL = 1050;          // pesos por litro
  C.BASE = 15000;           // pago fijo por encargo
  C.POR_KM = 3600;          // pago por km real (se multiplica por la tarifa de la carga)
  C.BONO_A_TIEMPO = 0.15;
  C.HOLGURA = 1.8;          // el plazo da 1,8 veces el tiempo estimado de la ruta

  // remolques: lona, frigo (refrigerado), cisterna, plataforma, contenedor
  C.TIPOS = {
    salmon: { n: 'SALMÓN CONGELADO', rem: 'frigo', peso: [14, 22], tarifa: 1.35, de: ['pesquera', 'puerto', 'industria'], a: ['puerto', 'supermercado', 'bodega'] },
    mariscos: { n: 'MARISCOS', rem: 'frigo', peso: [6, 12], tarifa: 1.3, de: ['puerto', 'pesquera', 'feria'], a: ['supermercado', 'feria', 'bodega'] },
    alimento: { n: 'ALIMENTO PARA SALMONES', rem: 'lona', peso: [18, 25], tarifa: 1.0, de: ['industria', 'bodega', 'puerto'], a: ['pesquera', 'puerto', 'industria'] },
    madera: { n: 'MADERA ASERRADA', rem: 'plataforma', peso: [16, 24], tarifa: 1.0, de: ['industria', 'bodega'], a: ['ferreteria', 'puerto', 'muebles', 'bodega'] },
    cemento: { n: 'CEMENTO EN SACOS', rem: 'lona', peso: [20, 26], tarifa: 0.95, de: ['industria', 'puerto', 'bodega'], a: ['ferreteria', 'bodega', 'industria'] },
    abarrotes: { n: 'ABARROTES', rem: 'lona', peso: [8, 16], tarifa: 1.1, de: ['bodega', 'puerto', 'industria'], a: ['supermercado', 'feria', 'combustible'] },
    bebidas: { n: 'BEBIDAS', rem: 'lona', peso: [14, 20], tarifa: 1.05, de: ['bodega', 'industria'], a: ['supermercado', 'combustible', 'feria'] },
    papas: { n: 'PAPAS', rem: 'lona', peso: [10, 18], tarifa: 0.95, de: ['feria', 'bodega', 'industria'], a: ['supermercado', 'feria'] },
    leche: { n: 'LECHE FRESCA', rem: 'cisterna', peso: [18, 24], tarifa: 1.25, de: ['industria', 'bodega'], a: ['industria', 'supermercado'] },
    diesel: { n: 'DIÉSEL', rem: 'cisterna', peso: [20, 26], tarifa: 1.4, de: ['puerto', 'industria'], a: ['combustible'] },
    contenedor: { n: 'CONTENEDOR', rem: 'contenedor', peso: [10, 24], tarifa: 1.15, de: ['puerto'], a: ['bodega', 'industria', 'supermercado'] },
    muebles: { n: 'MUEBLES', rem: 'lona', peso: [5, 10], tarifa: 1.2, de: ['muebles', 'bodega', 'puerto'], a: ['muebles', 'supermercado', 'bodega'] },
    repuestos: { n: 'REPUESTOS', rem: 'lona', peso: [4, 9], tarifa: 1.25, de: ['repuestos', 'puerto', 'bodega'], a: ['repuestos', 'bodega', 'combustible'] },
    medicos: { n: 'INSUMOS MÉDICOS', rem: 'frigo', peso: [3, 8], tarifa: 1.5, de: ['bodega', 'puerto'], a: ['hospital'] },
    fierro: { n: 'FIERRO DE CONSTRUCCIÓN', rem: 'plataforma', peso: [20, 26], tarifa: 1.0, de: ['puerto', 'industria'], a: ['ferreteria', 'industria', 'bodega'] },
  };
  C.CATS = {
    puerto: 'PUERTO', pesquera: 'PLANTA PESQUERA', combustible: 'ESTACIÓN DE SERVICIO', supermercado: 'SUPERMERCADO', ferreteria: 'FERRETERÍA',
    muebles: 'MUEBLERÍA', repuestos: 'REPUESTOS', feria: 'FERIA', hospital: 'HOSPITAL', bodega: 'BODEGA', industria: 'ZONA INDUSTRIAL',
  };

  // generador pseudoaleatorio reproducible
  C.rng = function (seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };

  C.nombreDep = function (d, mundo) {
    const ciudad = mundo.ciudades[d.ciudad] ? mundo.ciudades[d.ciudad].nombre : '';
    return { tipo: C.CATS[d.cat] || d.cat.toUpperCase(), calle: (d.nomCalle || '').toUpperCase(), ciudad: ciudad.toUpperCase() };
  };

  C.nuevaPartida = function (seed) {
    return { dinero: 150000, entregas: 0, km: 0, t: 15 * 3600, dia: 1, seed: seed || 1, rnd: C.rng(seed || 1), encargo: null, historial: [] };
  };
  C.hora = function (t) { const h = Math.floor(t / 3600) % 24, m = Math.floor(t / 60) % 60; return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); };

  // ofertas en un depósito: algunas a la otra ciudad, otras dentro de la misma
  C.ofertas = function (P, mundo, dep, n) {
    n = n || 4;
    const out = [], usados = new Set();
    const tipos = Object.entries(C.TIPOS);
    const propios = tipos.filter(([, t]) => t.de.includes(dep.cat));
    for (let k = 0; k < n * 6 && out.length < n; k++) {
      const pool = propios.length && P.rnd() < 0.85 ? propios : tipos;
      const [id, t] = pool[Math.floor(P.rnd() * pool.length)];
      const otraCiudad = out.length % 2 === 0;
      let dest = mundo.depositos.filter(d => d !== dep && t.a.includes(d.cat) && (d.ciudad !== dep.ciudad) === otraCiudad && Math.hypot(d.x - dep.x, d.y - dep.y) > 600);
      if (!dest.length) dest = mundo.depositos.filter(d => d !== dep && t.a.includes(d.cat) && Math.hypot(d.x - dep.x, d.y - dep.y) > 600);
      if (!dest.length) continue;
      const d = dest[Math.floor(P.rnd() * dest.length)];
      const clave = id + '>' + d.id; if (usados.has(clave)) continue; usados.add(clave);
      const ruta = mundo.ruta(Object.assign({}, dep.calle, { dir: 0 }), d.calle);
      if (!ruta) continue;
      const peso = Math.round(t.peso[0] + P.rnd() * (t.peso[1] - t.peso[0]));
      out.push(C.encargo(P, dep, d, id, peso, ruta));
    }
    return out;
  };
  C.encargo = function (P, de, a, tipo, peso, ruta) {
    const t = C.TIPOS[tipo], km = ruta.real / 1000;
    const pago = Math.round((C.BASE + km * C.POR_KM * t.tarifa * (0.75 + peso / 40)) / 500) * 500;
    // ruta.seg: segundos a la velocidad máxima de cada calle; un camión va más lento y dobla despacio
    const est = ruta.seg * 1.5 + 25 * (ruta.indic ? ruta.indic.length : 0);
    const plazo = Math.round((est * C.HOLGURA * C.ESCALA + 900) / 300) * 300;
    return { tipo, n: t.n, rem: t.rem, peso, de: de.id, a: a.id, km, pago, plazo, limite: P.t + plazo, dano: 0 };
  };
  C.aceptar = function (P, enc) { P.encargo = Object.assign({}, enc, { limite: P.t + enc.plazo, inicio: P.t, litros0: null }); return P.encargo; };
  // daño a la carga por un golpe a velocidad v [m/s]
  C.golpe = function (P, v) { if (!P.encargo || v < 0.8) return 0; const d = Math.min(20, v * v * 0.35 + v * 0.8); P.encargo.dano = Math.min(100, P.encargo.dano + d); return d; };
  // entrega: devuelve el detalle del pago
  C.entregar = function (P, litros) {
    const e = P.encargo; if (!e) return null;
    const aTiempo = P.t <= e.limite;
    const bono = aTiempo ? Math.round(e.pago * C.BONO_A_TIEMPO / 100) * 100 : 0;
    const desc = Math.round(e.pago * e.dano / 100 / 100) * 100;
    const diesel = Math.round(litros * C.DIESEL / 100) * 100;
    const neto = e.pago + bono - desc - diesel;
    P.dinero += neto; P.entregas++;
    const r = { n: e.n, pago: e.pago, bono, desc, diesel, neto, aTiempo, km: e.km, dano: e.dano, duracion: P.t - e.inicio };
    P.historial.push(r); P.encargo = null;
    return r;
  };
  C.fmt = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (typeof module !== 'undefined' && module.exports) module.exports = C; else G.CARGAS = C;
})(typeof window !== 'undefined' ? window : globalThis);
