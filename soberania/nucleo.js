// SOBERANÍA — núcleo de la simulación. Sin DOM: corre igual en el navegador (global NUCLEO) y en Node.
// Un turno = un trimestre. Todas las cifras de flujo (crecimiento, inflación, gasto) son anuales en %.
var NUCLEO = (function () {
  const NODE = typeof module !== 'undefined' && module.exports;
  const R = NODE ? require('./reglas.js') : REGLAS;
  const DATOS = NODE ? require('./datos/paises.js').PAISES : window.PAISES;
  const EV = NODE ? require('./eventos.js') : EVENTOS_SOB;

  // ---------------- utilidades ----------------
  function rnd(o) { o.rng = (o.rng + 0x6D2B79F5) | 0; let t = o.rng; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  function gauss(o) { const u = rnd(o) || 1e-9, v = rnd(o); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function pick(o, a) { return a[Math.floor(rnd(o) * a.length)]; }
  function entre(o, a, b) { return a + rnd(o) * (b - a); }
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const DEMO_REG = { pres: 1, parl: 1, monc: 1 };
  const NOMBRE_REG = { pres: 'Democracia presidencial', parl: 'República parlamentaria', monc: 'Monarquía parlamentaria', mona: 'Monarquía absoluta', unico: 'Partido único', militar: 'Junta militar', teocracia: 'Teocracia', hibrido: 'Autoritarismo electoral' };
  const POTENCIAS = ['USA', 'CHN', 'RUS', 'IND', 'JPN', 'DEU', 'GBR', 'FRA', 'BRA'];

  const PAISES = DATOS.map(r => ({ iso: r[0], nombre: r[1], cont: r[2], sub: r[3], pob: r[4], pib: r[5], reg: r[6], ali: r[7], bloques: r[8], lat: r[9], lon: r[10], pot: r[11], exp: r[12] }));
  const PX = {}; PAISES.forEach(p => (PX[p.iso] = p));

  function persona(o) { return pick(o, R.NOMBRES.pila) + ' ' + pick(o, R.NOMBRES.apellido); }
  function nombrePais(o) {
    const S = R.PAIS_SILABAS; let n = pick(o, S.ini) + pick(o, S.med) + pick(o, S.fin);
    n = n.toLowerCase(); return n.charAt(0).toUpperCase() + n.slice(1);
  }
  function capitalAleatoria(o) { return pick(o, R.CAPITALES); }

  // ---------------- creación ----------------
  function paisesDe(cont, sub) { return PAISES.filter(p => p.cont === cont && (!sub || p.sub === sub)); }

  // Elige 3–4 vecinos reales de la subregión y ubica al país ficticio entre ellos.
  function sugerirUbicacion(o, cont, sub) {
    let pool = paisesDe(cont, sub);
    if (pool.length < 3) pool = paisesDe(cont);
    const ancla = pick(o, pool);
    const orden = pool.slice().sort((a, b) => dist(a, ancla) - dist(b, ancla));
    const n = Math.min(pool.length, rnd(o) < 0.5 ? 3 : 4);
    const vec = orden.slice(0, n);
    const lat = vec.reduce((s, p) => s + p.lat, 0) / n + entre(o, -1.5, 1.5);
    const lon = vec.reduce((s, p) => s + p.lon, 0) / n + entre(o, -1.5, 1.5);
    return { vecinos: vec.map(p => p.iso), lat, lon };
  }
  function dist(a, b) { const dl = (a.lon - b.lon) * Math.cos((a.lat + b.lat) / 2 * Math.PI / 180); return Math.hypot(a.lat - b.lat, dl); }

  const MIN_FAC = { interior: ['militares', 'clase_media'], defensa: ['militares'], hacienda: ['empresarios'], economia: ['empresarios'], trabajo: ['sindicatos'], agricultura: ['campesinos'],
    educacion: ['estudiantes'], salud: ['clase_media'], social: ['sindicatos', 'campesinos'], energia: ['regiones'], obras: ['regiones', 'empresarios'], cultura: ['religiosos'], ciencia: ['estudiantes'],
    ambiente: ['estudiantes'], turismo: ['empresarios'], seguridad: ['clase_media', 'militares'], exteriores: ['empresarios'], presidencia: ['clase_media', 'regiones'] };
  const PERFILES = { tecnico: 'Técnico/a independiente', leal: 'Leal al gobierno', faccion: 'Hombre/mujer de facción', politico: 'Político/a de carrera' };

  function candidatos(o, minId, n) {
    n = n || 3; const res = []; const perf = ['tecnico', 'leal', 'faccion', 'politico'];
    for (let i = perf.length - 1; i > 0; i--) { const j = Math.floor(rnd(o) * (i + 1)); [perf[i], perf[j]] = [perf[j], perf[i]]; }
    const r5 = () => 1 + Math.floor(rnd(o) * 5);
    for (let i = 0; i < n; i++) {
      const p = perf[i % perf.length];
      let comp = 1 + Math.floor(rnd(o) * 3), leal = 2 + Math.floor(rnd(o) * 3), hon = r5(), fac = null;
      if (p === 'tecnico') { comp = 4 + (rnd(o) < 0.45 ? 1 : 0); leal = 1 + Math.floor(rnd(o) * 3); hon = 2 + Math.floor(rnd(o) * 4); }
      if (p === 'leal') { leal = rnd(o) < 0.5 ? 5 : 4; comp = 1 + Math.floor(rnd(o) * 3); }
      if (p === 'faccion') { fac = pick(o, MIN_FAC[minId] || R.ORDEN_FAC); comp = 2 + Math.floor(rnd(o) * 3); leal = 2 + Math.floor(rnd(o) * 2); }
      if (p === 'politico') { comp = 2 + Math.floor(rnd(o) * 3); leal = 3 + Math.floor(rnd(o) * 2); hon = 1 + Math.floor(rnd(o) * 3); }
      res.push({ nombre: persona(o), comp: clamp(comp, 1, 5), leal: clamp(leal, 1, 5), hon: clamp(hon, 1, 5), fac, perfil: p, desde: 0 });
    }
    return res;
  }

  function instPorDefecto(tipo) {
    const T = R.TIPOS[tipo];
    const d = { legislativo: T.legislativo[0], judicial: 'independiente', banco: 'autonomo', fuerzas: 'civil', prensa: 'libre', territorio: T.territorial || 'centralizado', control: 'contraloria', inteligencia: 'civil', electoral: 'proporcional', mandato: 'm4' };
    if (!T.demo) Object.assign(d, { judicial: 'supervisado', banco: 'dependiente', prensa: 'regulada', control: 'ninguno', inteligencia: 'secreta' });
    if (tipo === 'junta') Object.assign(d, { fuerzas: 'fuero', prensa: 'estatal', judicial: 'subordinado' });
    if (tipo === 'partido_unico') Object.assign(d, { fuerzas: 'milicia', prensa: 'estatal' });
    if (tipo === 'tecnocracia') Object.assign(d, { banco: 'autonomo', control: 'contraloria', judicial: 'independiente', inteligencia: 'civil' });
    if (!T.demo) { delete d.electoral; delete d.mandato; }
    return d;
  }
  // Valida una constitución para un tipo de gobierno; corrige lo inválido.
  function sanearInst(tipo, inst) {
    const T = R.TIPOS[tipo], d = instPorDefecto(tipo), out = Object.assign({}, inst);
    if (!T.legislativo.includes(out.legislativo)) out.legislativo = T.legislativo[0];
    if (T.territorial) out.territorio = T.territorial;
    for (const k of R.ORDEN_INST) {
      const I = R.INSTITUCIONES[k];
      if (I.soloDemo && !T.demo) { delete out[k]; continue; }
      if (!out[k] || !I.op[out[k]]) out[k] = d[k];
    }
    return out;
  }
  function opcionesInst(tipo, k) {
    const T = R.TIPOS[tipo], I = R.INSTITUCIONES[k];
    if (I.soloDemo && !T.demo) return [];
    let ops = Object.keys(I.op);
    if (k === 'legislativo') ops = ops.filter(o => T.legislativo.includes(o));
    if (k === 'territorio' && T.territorial) ops = [T.territorial];
    return ops;
  }

  function crearPartida(cfg) {
    const E = { v: 1, rng: (cfg.semilla >>> 0) || 1, semilla: cfg.semilla >>> 0, turno: 0, anio0: 2027, durTurnos: (cfg.duracion || 20) * 4, fin: null,
      pend: [], cola: [], vistos: {}, flags: {}, noticias: [], hist: [], mods: [], cool: {}, orgs: {}, guerra: null, ultimo: null };
    const T = R.TIPOS[cfg.tipo], D = R.DESARROLLO[cfg.desarrollo || 'medio'], TM = R.TAMANOS[cfg.tamano || 'mediano'];
    const recursos = (cfg.recursos || []).filter(r => R.RECURSOS[r] && (!R.RECURSOS[r].costa || cfg.costa));
    E.pais = { nombre: cfg.nombre, capital: cfg.capital, colores: cfg.colores || ['#1d4e89', '#f2f2f2', '#c8102e'], bandera: cfg.bandera || 'h3', cont: cfg.continente, sub: cfg.subregion,
      costa: !!cfg.costa, recursos, desarrollo: cfg.desarrollo || 'medio', tamano: cfg.tamano || 'mediano', lat: cfg.lat, lon: cfg.lon, vecinos: cfg.vecinos.slice(), lider: cfg.lider || persona(E) };
    // gobierno
    const inst = sanearInst(cfg.tipo, cfg.inst || instPorDefecto(cfg.tipo));
    E.gob = { tipo: cfg.tipo, inst, min: {}, leyes: {} };
    const mins = new Set(R.ORDEN_MIN.filter(m => R.MINISTERIOS[m].obligatorio).concat(cfg.ministerios || []));
    for (const m of mins) E.gob.min[m] = (cfg.ministros && cfg.ministros[m]) ? Object.assign({}, cfg.ministros[m], { desde: 0 }) : candidatos(E, m, 1)[0];
    // economía
    let mult = 1; for (const r of recursos) mult *= ({ petroleo: 1.15, gas: 1.1, mineria: 1.08 })[r] || 1;
    const pob = TM.pob * entre(E, 0.85, 1.15);
    const pibpc = D.pibpc * entre(E, 0.9, 1.1) * mult;
    const k = cfg.desarrollo || 'medio';
    const gasto = k === 'bajo' ? { salud: 3, educacion: 3.5, social: 3, infra: 2.5, seguridad: 1.3, defensa: 1.6 }
      : k === 'alto' ? { salud: 7, educacion: 5, social: 12, infra: 2.5, seguridad: 1.6, defensa: 1.5 }
        : { salud: 5, educacion: 4.5, social: 6, infra: 2.5, seguridad: 1.5, defensa: 1.8 };
    const sec = {}; for (const r of recursos) sec[r] = R.RECURSOS[r].share;
    E.eco = { pob, pib: pob * pibpc / 1000, crec: 3, crecPot: 3, infl: k === 'bajo' ? 7 : k === 'alto' ? 2.2 : 4.5, desemp: k === 'bajo' ? 10 : k === 'alto' ? 6 : 8,
      deuda: 0, tasaMedia: 4, riesgo: 2, tasaImp: k === 'bajo' ? 16 : k === 'alto' ? 35 : 23, gasto, sec, choques: [], emision: 0, liquidez: 0, cerrados: false, atrasos: 0, defaultR: 0,
      ingresos: 0, gastos: 0, defPrim: 0, deficit: 0, intereses: 0, mil: 0, presBase: null, crecPob: k === 'bajo' ? 2.2 : k === 'alto' ? 0.3 : 1.0 };
    E.eco.deuda = E.eco.pib * entre(E, 0.3, 0.42);
    E.eco.mil = E.eco.pib * gasto.defensa / 100 * 10;
    E.soc = { salud: D.salud, educacion: D.educacion, infra: D.infra, seguridad: 55, desig: D.desig, corr: 40, libertad: 50, libMod: 0, prestigio: 45 };
    // facciones
    const fac = {}; R.ORDEN_FAC.forEach(f => (fac[f] = { sat: 55, humor: 0 }));
    E.pol = { pc: 10, aprob: 55, aprobVista: 55, legit: 60, legitMod: 0, est: 60, prot: 5, escanos: null, alin: 0, alinMod: 0, riesgoGolpe: 0, mandatos: 0, proxElec: null, proxCongreso: null, fac, poder: {}, votos: null, protAltas: 0 };
    if (T.demo) {
      const s = estaticos(E); const v0 = 51 + gauss(E) * 2.5;
      E.pol.escanos = clamp(50 + (v0 - 47) * s.amplif, 44, 68); E.pol.votos = v0;
      E.pol.proxElec = s.mandato * 4 - 1;
    }
    if (E.gob.tipo === 'partido_unico') E.pol.proxCongreso = 19;
    // mundo
    E.mundo = { crec: 3, tasa: 3.5, precios: { energia: 1, metales: 1, alimentos: 1, turismo: 1 }, lat: { crec: 0, tasa: 0, energia: 0, metales: 0, alimentos: 0, turismo: 0 }, tension: 35, sucesos: [], p: {} };
    for (const p of PAISES) E.mundo.p[p.iso] = { rel: 0, mod: gauss(E) * 6, reg: p.reg, ali: p.ali, tr: {}, disp: false, vec: E.pais.vecinos.includes(p.iso), ultVisita: -99, pib: p.pib, ultPrest: -99 };
    if (rnd(E) < 0.5) { const v = pick(E, E.pais.vecinos); E.mundo.p[v].disp = true; E.mundo.p[v].mod -= 10; }
    for (const v of E.pais.vecinos) E.mundo.p[v].mod += gauss(E) * 10;
    // organizaciones automáticas
    for (const id in R.ORGANIZACIONES) { const O = R.ORGANIZACIONES[id]; if (O.negocia <= 1 && (!O.cont || O.cont.includes(E.pais.cont)) && !(O.noJunta && E.gob.tipo === 'junta')) E.orgs[id] = { estado: 'miembro', t: 0 }; }
    // equilibrio inicial: estados sociales en su objetivo
    const s = estaticos(E);
    for (let i = 0; i < 12; i++) socialPaso(E, s, 1);
    for (let i = 0; i < 12; i++) { politicaPaso(E, s, true); }
    relacionesPaso(E, s); for (const iso in E.mundo.p) E.mundo.p[iso].rel = calcRel(E, iso);
    finanzas(E, s);
    E.eco.tasaMedia = E.mundo.tasa + E.eco.riesgo;
    E.pol.pc = 10;
    E.eco.presBase = { tasaImp: E.eco.tasaImp, gasto: Object.assign({}, E.eco.gasto) };
    E.inicio = { idh: idhDe(E), pibpc: E.eco.pib / E.eco.pob * 1000 };
    noticia(E, `Nace ${E.pais.nombre}. ${E.pais.lider} asume como ${R.TIPOS[E.gob.tipo].jefe.toLowerCase()} en ${E.pais.capital}.`, 'hito');
    historial(E);
    return E;
  }

  // ---------------- agregador de efectos estáticos ----------------
  function vacio() {
    const s = { g: 0, corr: 0, lib: 0, legit: 0, est: 0, prest: 0, fac: {}, poder: {}, desemp: 0, desig: 0, gasto: 0, ingreso: 0, infl: 0, regalias: 0, salud: 0, educacion: 0, infra: 0, seg: 0,
      protestas: 0, mil: 0, comercio: 0, escandalos: 1, subsidioEnergia: 0, sector: {}, energia: 0, costo: 0, golpe: 1, represion: 0, ef: 0, meta: 3, riesgo: 0, emitir: false, revela: false, aviso: false,
      amplif: 1, mandato: 4, umbral: 0, propaganda: 0, rel: {}, purga: false, escasez: false };
    R.ORDEN_FAC.forEach(f => { s.fac[f] = 0; s.poder[f] = 1; });
    return s;
  }
  function sumar(s, o, mult) {
    const m = mult == null ? 1 : mult;
    for (const k of ['g', 'corr', 'lib', 'legit', 'est', 'prest', 'desemp', 'desig', 'gasto', 'ingreso', 'infl', 'regalias', 'salud', 'educacion', 'infra', 'seg', 'protestas', 'mil', 'comercio', 'subsidioEnergia', 'energia', 'costo', 'represion', 'ef', 'riesgo', 'propaganda'])
      if (o[k]) s[k] += o[k] * m;
    if (o.fac) for (const f in o.fac) s.fac[f] += o.fac[f] * m;
    if (o.sector) for (const f in o.sector) s.sector[f] = (s.sector[f] || 0) + o.sector[f] * m;
    if (o.rel) for (const f in o.rel) s.rel[f] = (s.rel[f] || 0) + o.rel[f] * m;
    if (o.escandalos) s.escandalos *= o.escandalos;
    if (o.escasez) s.escasez = true;
  }
  function estaticos(E) {
    const g = E.gob, T = R.TIPOS[g.tipo], s = vacio();
    for (const f in T.poder) s.poder[f] *= T.poder[f];
    for (const k of R.ORDEN_INST) {
      const id = g.inst[k]; if (!id) continue; const o = R.INSTITUCIONES[k].op[id]; if (!o) continue;
      sumar(s, o); if (o.poder) for (const f in o.poder) s.poder[f] *= o.poder[f];
      if (o.golpe) s.golpe *= o.golpe; if (o.meta) s.meta = o.meta; if (o.emitir) s.emitir = true; if (o.revela) s.revela = true; if (o.aviso) s.aviso = true;
      if (o.amplif) s.amplif = o.amplif; if (o.anios) s.mandato = o.anios; if (o.umbral) s.umbral = o.umbral; if (o.purga) s.purga = true;
    }
    if (T.corona) { s.costo += 0.06; s.est += 4; s.prest += 3; }
    s.ef += T.eficiencia || 0;
    const mins = Object.keys(g.min);
    s.costo += mins.length * R.COSTO_MIN;
    const extra = Math.max(0, mins.length - R.MAX_MIN_SIN_BUROCRACIA); s.corr += extra * 1.5; s.ef -= extra * 0.02;
    let nHon = 0, sumHon = 0;
    for (const m of mins) {
      const M = R.MINISTERIOS[m]; if (M.fac) for (const f in M.fac) s.fac[f] += M.fac[f];
      const mi = g.min[m]; if (mi) { if (mi.fac) s.fac[mi.fac] += 4; sumHon += mi.hon; nHon++; }
    }
    if (nHon) s.corr += (3 - sumHon / nHon) * 5;
    if (g.min.cultura) s.legit += 2;
    if (g.min.ambiente) s.prest += 3;
    if (g.min.trabajo) s.desemp -= 0.4 + 0.1 * comp(E, 'trabajo');
    if (g.min.economia) s.g += 0.05 + 0.05 * comp(E, 'economia');
    if (g.min.ciencia) s.g += clamp((E.soc.educacion - 50) * 0.012, -0.1, 0.35) + 0.03 * comp(E, 'ciencia');
    for (const id in g.leyes) sumar(s, R.LEYES[id]);
    for (const md of E.mods) sumar(s, md.ef);
    if (E.guerra) { s.gasto += 3; s.g -= 2.2; s.seg -= 6; }
    if (activo(E, 'revolucion_ia')) { if (E.soc.educacion > 60) s.g += 0.5; else s.desemp += 0.6; }
    return s;
  }
  function comp(E, m) { const mi = E.gob.min[m]; return mi ? mi.comp : 0; }
  function activo(E, id) { return !!E.mundo && E.mundo.sucesos.some(x => x.id === id); }

  // eficiencia del gasto en un área
  function efArea(E, area, s) {
    let base;
    if (area === 'seguridad') base = E.gob.min.seguridad ? 0.72 + 0.08 * comp(E, 'seguridad') : 0.6 + 0.05 * comp(E, 'interior');
    else if (area === 'defensa') base = 0.7 + 0.07 * comp(E, 'defensa');
    else { const m = { salud: 'salud', educacion: 'educacion', infra: 'obras', social: 'social' }[area]; base = E.gob.min[m] ? 0.7 + 0.08 * comp(E, m) : 0.5; }
    return base * (1 - E.soc.corr / 300) * (1 + s.ef);
  }

  // ---------------- comercio e inversión ----------------
  function comercio(E, s) {
    let c = 0, inv = 0;
    for (const iso in E.mundo.p) {
      const q = E.mundo.p[iso]; if (!q.tr.tlc && !q.tr.inversion) continue;
      const peso = Math.min(1, Math.sqrt(q.pib / 3000));
      if (q.tr.tlc) c += 0.08 + 0.2 * peso;
      if (q.tr.inversion) inv += 0.06 + 0.16 * peso;
    }
    for (const id in E.orgs) if (E.orgs[id].estado === 'miembro') c += R.ORGANIZACIONES[id].comercio || 0;
    if (E.gob.min.economia) c *= 1.15 + 0.03 * comp(E, 'economia');
    if (!E.pais.costa) c *= 0.8;
    if (E.eco.sec.industria) c *= 1.2;
    c = 1.6 * (1 - Math.exp(-c / 1.6)) + s.comercio;
    inv = 0.9 * (1 - Math.exp(-inv / 0.9));
    return { comercio: c, inversion: inv };
  }

  // ---------------- finanzas públicas ----------------
  function regalias(E, s) {
    let r = 0;
    for (const k in E.eco.sec) {
      const RR = R.RECURSOS[k]; if (!RR.precio || RR.precio === 'turismo') continue;
      const share = E.eco.sec[k] * (1 + (s.sector[k] || 0));
      r += share * E.mundo.precios[RR.precio] * (10 + s.regalias) * (E.gob.min.energia ? 1.12 + 0.02 * comp(E, 'energia') : 1);
    }
    return r;
  }
  function finanzas(E, s) {
    const eco = E.eco, dPIB = eco.deuda / eco.pib * 100;
    const efRec = 0.78 + 0.22 * (1 - E.soc.corr / 100) + 0.012 * comp(E, 'hacienda');
    let ayuda = 0; for (const iso in E.mundo.p) if (E.mundo.p[iso].tr.ayuda) ayuda += 0.25;
    const ingresos = eco.tasaImp * efRec + s.ingreso + regalias(E, s) + Math.min(ayuda, 0.8);
    let gastos = 0; for (const a of R.ORDEN_AREAS) gastos += eco.gasto[a];
    const admin = s.costo;
    const subsidio = s.subsidioEnergia * Math.pow(E.mundo.precios.energia, 1.6);
    gastos += s.gasto + admin + subsidio;
    eco.riesgo = clamp(0.8 + Math.max(0, dPIB - 45) * 0.07 + Math.max(0, dPIB - 90) * 0.1 + Math.max(0, 50 - E.pol.est) * 0.04 + Math.max(0, eco.infl - 6) * 0.08
      + s.riesgo + eco.defaultR + (E.soc.corr - 40) * 0.02 - (E.soc.prestigio - 50) * 0.02 + (eco.atrasos > 0 ? 3 : 0), 0.3, 30);
    eco.intereses = eco.deuda * eco.tasaMedia / 100 / eco.pib * 100; // % PIB
    eco.ingresos = ingresos; eco.gastos = gastos; eco.admin = admin; eco.subsidio = subsidio;
    eco.defPrim = gastos - ingresos;
    eco.deficit = eco.defPrim + eco.intereses;
  }

  // ---------------- un trimestre ----------------
  function avanzar(E) {
    if (E.fin) return { ok: false, motivo: 'La partida terminó.' };
    if (E.pend.length) return { ok: false, motivo: 'Hay asuntos pendientes en tu escritorio.' };
    E.turno++;
    const s = estaticos(E);
    reaccionPresupuesto(E);
    mundoPaso(E);
    economiaPaso(E, s);
    socialPaso(E, s, 0);
    politicaPaso(E, s, false);
    relacionesPaso(E, s);
    if (E.guerra) guerraPaso(E, s);
    modsPaso(E);
    if (!E.fin) riesgosPaso(E, s);
    if (!E.fin) eventosPaso(E);
    historial(E);
    E.eco.presBase = { tasaImp: E.eco.tasaImp, gasto: Object.assign({}, E.eco.gasto) };
    if (!E.fin && E.turno >= E.durTurnos) terminar(E, 'tiempo', 'Fin del período', `Has gobernado ${E.pais.nombre} durante ${Math.round(E.durTurnos / 4)} años. La historia juzgará tu obra.`);
    return { ok: true };
  }
  function fecha(E, t) { t = t == null ? E.turno : t; return { anio: E.anio0 + Math.floor(t / 4), trim: (t % 4) + 1 }; }

  // reacción de las facciones a los cambios de presupuesto respecto del trimestre anterior
  function reaccionPrevista(E) {
    const b = E.eco.presBase, out = {}; if (!b) return out;
    const add = (f, v) => { if (v) out[f] = (out[f] || 0) + v; };
    const dt = E.eco.tasaImp - b.tasaImp;
    if (dt > 0) { add('empresarios', -1.6 * dt); add('clase_media', -1.2 * dt); }
    if (dt < 0) { add('empresarios', -0.8 * dt); add('clase_media', -0.6 * dt); }
    const quien = { salud: { clase_media: 1.5, sindicatos: 0.5 }, educacion: { estudiantes: 2, clase_media: 0.6 }, social: { sindicatos: 1.6, campesinos: 1.2 }, infra: { regiones: 2, empresarios: 0.6 }, seguridad: { clase_media: 1 }, defensa: { militares: 3 } };
    for (const a of R.ORDEN_AREAS) { const d = E.eco.gasto[a] - b.gasto[a]; if (!d) continue; for (const f in quien[a]) add(f, quien[a][f] * d * (d < 0 ? 1.4 : 1)); }
    return out;
  }
  function reaccionPresupuesto(E) {
    const r = reaccionPrevista(E), F = E.pol.fac;
    for (const f in r) F[f].sat = clamp(F[f].sat + r[f], 0, 100);
  }

  function mundoPaso(E) {
    const M = E.mundo, L = M.lat;
    L.crec = 0.75 * L.crec + gauss(E) * 0.35;
    L.tasa = 0.92 * L.tasa + gauss(E) * 0.12;
    for (const k of ['energia', 'metales', 'alimentos']) L[k] = 0.86 * L[k] + gauss(E) * 0.045;
    L.turismo = 0.8 * L.turismo + gauss(E) * 0.02;
    const sum = { crec: 0, tasa: 0, energia: 0, metales: 0, alimentos: 0, turismo: 0 };
    for (const x of M.sucesos) { const S = EV.SUCESOS[x.id]; const fade = Math.min(1, x.t / 2); for (const k in sum) if (S.ef && S.ef[k]) sum[k] += S.ef[k] * fade; }
    M.crec = 3 + L.crec + sum.crec;
    M.tasa = clamp(3.5 + L.tasa + sum.tasa, 0.25, 12);
    for (const k of ['energia', 'metales', 'alimentos']) M.precios[k] = clamp(1 + L[k] + sum[k], 0.35, 3);
    M.precios.turismo = clamp(1 + L.turismo + 0.04 * (M.crec - 3) + sum.turismo, 0.1, 1.6);
    M.tension = clamp(M.tension + (35 - M.tension) * 0.04, 0, 100);
    for (const x of M.sucesos) x.t--;
    for (const x of M.sucesos.filter(x => x.t <= 0)) { const S = EV.SUCESOS[x.id]; if (S.finTexto) noticia(E, S.finTexto, 'mundo'); }
    M.sucesos = M.sucesos.filter(x => x.t > 0);
    for (const iso in M.p) { const q = M.p[iso], P = PX[iso]; const pc = P.pib / P.pob; q.pib *= 1 + (M.crec - 3 + (pc < 5 ? 1.8 : pc < 20 ? 0.8 : -0.8)) / 400 + 0.0075; }
    // ¿nuevo suceso global?
    if (M.sucesos.length < 2 && E.turno > 1 && rnd(E) < 0.11) {
      const H = helpers(E); const ops = [];
      for (const id in EV.SUCESOS) { const S = EV.SUCESOS[id]; if (M.sucesos.some(x => x.id === id)) continue; if (E.vistos['S:' + id] != null && E.turno - E.vistos['S:' + id] < (S.enfriar || 24)) continue; const w = S.peso ? S.peso(E, H) : 1; if (w > 0) ops.push([id, w]); }
      const id = elegirPeso(E, ops);
      if (id) iniciarSuceso(E, id);
    }
  }
  function iniciarSuceso(E, id, ctx) {
    const S = EV.SUCESOS[id], H = helpers(E);
    const c = ctx || (S.ctx ? S.ctx(E, H) : {}); if (!c) return;
    const dur = S.dur ? Math.round(entre(E, S.dur[0], S.dur[1])) : 1;
    E.mundo.sucesos.push({ id, t: dur, c });
    E.vistos['S:' + id] = E.turno;
    if (S.tension) E.mundo.tension = clamp(E.mundo.tension + S.tension, 0, 100);
    if (S.alInicio) S.alInicio(E, c, H);
    noticia(E, typeof S.texto === 'function' ? S.texto(E, c, H) : S.texto, 'mundo', S.nombre);
    if (S.evento) { const ev = EV.EVENTOS.find(e => e.id === S.evento); if (ev && (!ev.peso || ev.peso(E, H, c) > 0)) E.pend.push({ id: S.evento, ctx: c }); }
  }
  function elegirPeso(E, ops) { const tot = ops.reduce((a, b) => a + b[1], 0); if (!tot) return null; let r = rnd(E) * tot; for (const [id, w] of ops) { r -= w; if (r <= 0) return id; } return ops[ops.length - 1][0]; }

  function economiaPaso(E, s) {
    const eco = E.eco, soc = E.soc, M = E.mundo;
    finanzas(E, s);
    // financiamiento del déficit (en miles de millones por trimestre)
    const F = eco.deficit * eco.pib / 100 / 4;
    const dPIB = eco.deuda / eco.pib * 100;
    eco.cerrados = eco.riesgo > 11 || dPIB > 125;
    if (F > 0 && eco.cerrados) {
      let falta = F; const usa = Math.min(eco.liquidez, falta); eco.liquidez -= usa; falta -= usa;
      if (falta > 0 && s.emitir) { eco.emision += falta / eco.pib * 100 * 4 * 0.9; eco.deuda += falta * 0.1; falta = 0; }
      if (falta > 0) { eco.atrasos += falta; eco.deuda += falta; }
      eco.deuda += usa;
    } else { eco.deuda += F; if (F < 0 && eco.atrasos > 0) eco.atrasos = Math.max(0, eco.atrasos + F); }
    if (!eco.cerrados && eco.atrasos > 0) eco.atrasos = Math.max(0, eco.atrasos - eco.pib * 0.01);
    eco.tasaMedia += (M.tasa + eco.riesgo - eco.tasaMedia) * 0.08;
    eco.defaultR *= 0.95;
    // crecimiento
    const pibpc = eco.pib / eco.pob * 1000;
    const conv = 3.4 - 1.4 * Math.log10(pibpc / 2000);
    const q = clamp((soc.educacion - 50) * 0.02, -1, 0.8) + clamp((soc.infra - 50) * 0.02, -1, 0.8) + clamp((40 - soc.corr) * 0.015, -1, 0.4)
      + clamp((E.pol.est - 50) * 0.022, -1.4, 0.3) + clamp((soc.seguridad - 50) * 0.012, -0.6, 0.2);
    const cm = comercio(E, s);
    const gPot = conv + q + s.g + cm.inversion;
    const gMundo = (M.crec - 3) * 0.55;
    let gCom = 0;
    for (const k in eco.sec) {
      const RR = R.RECURSOS[k]; if (!RR.precio) continue;
      let pr = M.precios[RR.precio];
      if (RR.precio === 'turismo') pr = pr * (0.6 + 0.8 * soc.seguridad / 100) * (E.gob.min.turismo ? 1.25 : 1);
      gCom += eco.sec[k] * (1 + (s.sector[k] || 0)) * (pr - 1) * 10;
    }
    if (!eco.sec.petroleo && !eco.sec.gas) gCom -= (M.precios.energia - 1) * 0.8 * (1 + s.energia * 0.6);
    const gFis = clamp(0.3 * (eco.defPrim - 1), -1.5, 1.5);
    const gDeuda = -Math.max(0, dPIB - 70) * 0.025;
    const gInf = -Math.max(0, eco.infl - 8) * 0.07 - Math.max(0, eco.infl - 40) * 0.04;
    eco.choques.forEach(c => c.t--); eco.choques = eco.choques.filter(c => c.t >= 0);
    const gChoq = eco.choques.reduce((a, c) => a + c.g, 0);
    const gAtr = eco.atrasos > 0 ? -2 : 0;
    const gEsc = s.escasez ? -0.6 - Math.max(0, eco.infl - 10) * 0.03 : 0;
    const g = gPot + gMundo + gCom + cm.comercio + gFis + gDeuda + gInf + gChoq + gAtr + gEsc + gauss(E) * 0.7;
    eco.crecPot = gPot + cm.comercio;
    eco.crec = 0.4 * eco.crec + 0.6 * g;
    eco.desglose = { potencial: gPot, mundo: gMundo, materias: gCom, comercio: cm.comercio, fiscal: gFis, deuda: gDeuda + gAtr, inflacion: gInf + gEsc, choques: gChoq };
    eco.pib *= 1 + eco.crec / 400;
    eco.pob *= 1 + eco.crecPob / 400;
    // inflación
    const brecha = eco.crec - eco.crecPot;
    let pres = 0.3 * brecha + s.infl + 1.4 * (M.precios.energia - 1) * (eco.sec.petroleo || eco.sec.gas ? 0.3 : 1) + 0.8 * (M.precios.alimentos - 1) + eco.emision;
    if (s.emitir && eco.defPrim > 4) pres += (eco.defPrim - 4) * 0.5;
    if (eco.atrasos > 0) pres += 1.5;
    const inercia = (eco.infl - s.meta) * (s.emitir ? 0.55 : 0.25);
    const obj = s.meta + pres + inercia;
    eco.infl = clamp(eco.infl + (obj - eco.infl) * 0.35 + gauss(E) * 0.3, -3, 3000);
    eco.emision *= 0.55;
    // la inflación licúa la parte de la deuda en moneda local
    if (eco.infl > 3) eco.deuda *= 1 - (eco.infl - 3) / 400 * 0.5;
    // desempleo
    const uNat = 7 + s.desemp + (soc.educacion < 40 ? 1.5 : 0) - clamp((soc.educacion - 60) * 0.04, 0, 1);
    eco.desemp = clamp(eco.desemp + 0.15 * (uNat - eco.desemp) - 0.25 * (eco.crec - eco.crecPot), 1.5, 45);
    // poder militar (stock)
    eco.mil = eco.mil * 0.975 + eco.pib * (eco.gasto.defensa / 100) / 4 * efArea(E, 'defensa', s) * (1 + s.mil + coopMil(E));
  }
  function coopMil(E) { let c = 0; for (const iso in E.mundo.p) if (E.mundo.p[iso].tr.cooperacion) c += 0.08 + 0.04 * PX[iso].pot; return Math.min(c, 0.4); }

  function objetivosSoc(E, s) {
    const eco = E.eco, soc = E.soc, g = eco.gasto, pibpc = eco.pib / eco.pob * 1000, lp = Math.log10(Math.max(300, pibpc) / 1000);
    const o = {};
    o.salud = clamp(24 + 6.2 * g.salud * efArea(E, 'salud', s) + 9 * lp + s.salud, 5, 98);
    o.educacion = clamp(24 + 6.0 * g.educacion * efArea(E, 'educacion', s) + 10 * lp + s.educacion, 5, 98);
    o.infra = clamp(15 + 7 * g.infra * efArea(E, 'infra', s) + 11 * lp + s.infra, 5, 98);
    o.seguridad = clamp(52 + 7 * (g.seguridad * efArea(E, 'seguridad', s) - 1.1) - 1.0 * (eco.desemp - 7) - 0.5 * (soc.desig - 40) - 0.15 * (soc.corr - 40) + 0.08 * (soc.educacion - 50) - 0.1 * E.pol.prot + s.seg, 3, 97);
    o.desig = clamp(46 - 0.9 * (g.social * efArea(E, 'social', s) - 3.5) - 0.08 * (soc.educacion - 50) + s.desig + (R.DESARROLLO[E.pais.desarrollo].desig - 44), 22, 66);
    o.corr = clamp(R.TIPOS[E.gob.tipo].corr + R.DESARROLLO[E.pais.desarrollo].corr + s.corr, 3, 97);
    o.prestigio = clamp(45 + s.prest + (soc.libertad - 50) * 0.15 + Math.log10(Math.max(300, pibpc) / 5000) * 8 + nOrgs(E) * 1.5 - (E.gob.tipo === 'junta' ? 8 : 0) - (E.eco.atrasos > 0 ? 8 : 0), 0, 100);
    return o;
  }
  function nOrgs(E) { let n = 0; for (const k in E.orgs) if (E.orgs[k].estado === 'miembro') n++; return n; }
  function libertad(E, s) { return clamp((R.TIPOS[E.gob.tipo].demo ? 58 : 34) + s.lib + E.soc.libMod, 0, 100); }

  function socialPaso(E, s, inicial) {
    const o = objetivosSoc(E, s), soc = E.soc;
    soc.salud += (o.salud - soc.salud) * (inicial ? 0.6 : 0.05);
    soc.educacion += (o.educacion - soc.educacion) * (inicial ? 0.6 : 0.045);
    soc.infra += (o.infra - soc.infra) * (inicial ? 0.6 : 0.04);
    soc.seguridad += (o.seguridad - soc.seguridad) * (inicial ? 0.6 : 0.15);
    soc.desig += (o.desig - soc.desig) * (inicial ? 0.6 : 0.04);
    soc.corr += (o.corr - soc.corr) * (inicial ? 0.6 : 0.06);
    soc.prestigio += (o.prestigio - soc.prestigio) * (inicial ? 0.6 : 0.1);
    soc.salud = clamp(soc.salud, 0, 100);
    soc.libMod *= 0.92;
    soc.libertad = libertad(E, s);
    soc.obj = o;
  }

  function poderRel(E, s) {
    const p = {}; let tot = 0;
    for (const f of R.ORDEN_FAC) { p[f] = R.FACCIONES[f].poder * s.poder[f]; tot += p[f]; }
    for (const f in p) p[f] /= tot; return p;
  }
  function pesos(E) {
    const w = {}, D = R.DESARROLLO[E.pais.desarrollo]; let tot = 0;
    for (const f of R.ORDEN_FAC) { w[f] = D.pesos[f] != null ? D.pesos[f] : R.FACCIONES[f].peso; tot += w[f]; }
    for (const f in w) w[f] /= tot; return w;
  }
  function objetivosFac(E, s) {
    const eco = E.eco, soc = E.soc, g = eco.gasto, tipo = E.gob.tipo, T = R.TIPOS[tipo];
    const econ = clamp((eco.crec - 2) * 2.2, -14, 10), inflP = -clamp((eco.infl - 4) * 0.7, -3, 30), desP = -clamp((eco.desemp - 7) * 1.3, -6, 25);
    const est = E.pol.est, lib = soc.libertad;
    const t = {
      militares: 50 + 4 * (g.defensa - 2) + 0.15 * (est - 50) + 0.15 * (soc.seguridad - 50) + (tipo === 'junta' ? 15 : T.demo ? 0 : 4) + econ * 0.3,
      empresarios: 50 + econ * 1.4 + (24 - eco.tasaImp) * 0.9 + inflP * 0.6 - 0.12 * (soc.corr - 40) + 0.1 * (est - 50),
      sindicatos: 50 + desP * 1.4 + 1.1 * (g.social - 6) + inflP * 0.7 + 0.08 * (lib - 50) + econ * 0.4,
      campesinos: 50 + 18 * (E.mundo.precios.alimentos - 1) * (eco.sec.agro ? 1 : 0.3) + 1.4 * (g.infra - 2.5) + desP * 0.4 + 0.1 * (soc.seguridad - 50) + inflP * 0.4 + econ * 0.4,
      clase_media: 50 + inflP * 1.0 + 0.3 * (soc.seguridad - 50) + 0.2 * (soc.salud - 55) + 0.2 * (soc.educacion - 55) - 0.25 * (soc.corr - 40) + econ * 0.8 + 0.12 * (lib - 50) - Math.max(0, eco.tasaImp - 28) * 0.8,
      religiosos: 50 + (tipo === 'teocracia' ? 18 : T.corona ? 5 : 0) - 0.05 * (lib - 50) + 0.1 * (soc.seguridad - 50) + 0.4 * (g.social - 6) + econ * 0.3,
      estudiantes: 50 + 0.35 * (soc.educacion - 55) + 0.35 * (lib - 50) + desP * 0.8 - 0.15 * (soc.corr - 40) + ({ junta: -10, teocracia: -8, monarquia_abs: -6 }[tipo] || 0),
      regiones: 50 + 0.25 * (soc.infra - 50) + econ * 0.5 + 0.05 * (est - 50),
    };
    if (E.guerra) { t.militares += clamp(E.guerra.frente * 0.15, -12, 10); }
    const desgaste = desgasteDe(E);
    for (const f in t) t[f] = clamp(t[f] - 4 - desgaste + s.fac[f] + E.pol.fac[f].humor, 0, 100);
    return t;
  }

  // desgaste del poder: la gente se cansa de quien gobierna (se alivia al ganar elecciones)
  function desgasteDe(E) { return Math.min(10, Math.max(0, (E.turno - (E.pol.renovado || 0)) / 4 * 0.9)); }
  function politicaPaso(E, s, inicial) {
    const P = E.pol, T = R.TIPOS[E.gob.tipo];
    const t = objetivosFac(E, s), pod = poderRel(E, s), w = pesos(E);
    P.poder = pod; P.objFac = t;
    let ap = 0, apPod = 0;
    for (const f of R.ORDEN_FAC) {
      const F = P.fac[f]; F.sat = clamp(F.sat + (t[f] - F.sat) * (inicial ? 0.6 : 0.3), 0, 100); F.humor *= 0.88;
      ap += w[f] * F.sat; apPod += pod[f] * F.sat;
    }
    P.aprob = clamp(ap, 0, 100); P.apPod = apPod;
    P.aprobVista = clamp(P.aprob + s.propaganda + (s.propaganda ? gauss(E) * 4 : 0), 0, 100);
    // legitimidad
    const econ = clamp((E.eco.crec - 2) * 2.2, -14, 10);
    let lt;
    if (T.demo) lt = 50 + 0.35 * (P.aprob - 50) + 0.25 * (E.soc.libertad - 50) - 0.2 * (E.soc.corr - 40);
    else lt = T.leg + 0.3 * (P.aprob - 50) + econ * 1.0 + 0.15 * (E.soc.seguridad - 50) - 0.2 * (E.soc.corr - 40);
    lt += s.legit + P.legitMod + (E.eco.atrasos > 0 ? -6 : 0);
    P.legitMod *= 0.95;
    P.legit = clamp(P.legit + (clamp(lt, 0, 100) - P.legit) * (inicial ? 0.6 : 0.12), 0, 100);
    // protestas
    let pt = 0;
    for (const f of R.ORDEN_FAC) { const F = P.fac[f]; if (F.sat < 45) pt += (0.5 * w[f] + 0.5 * pod[f]) * (45 - F.sat) * 2.4; }
    pt += Math.max(0, 45 - P.legit) * 0.5 + Math.max(0, E.eco.infl - 15) * 0.3 + Math.max(0, E.eco.desemp - 12) * 1.0;
    pt = pt * (0.6 + E.soc.libertad / 250) - s.represion * 0.3 + s.protestas;
    P.prot = clamp(P.prot + (clamp(pt, 0, 100) - P.prot) * (inicial ? 0.6 : 0.35), 0, 100);
    // estabilidad
    const et = 0.4 * apPod + 0.25 * P.legit + 0.15 * E.soc.seguridad + 0.2 * (100 - P.prot) + s.est - (E.guerra ? 5 : 0) - (E.eco.atrasos > 0 ? 6 : 0);
    P.est = clamp(P.est + (clamp(et, 0, 100) - P.est) * (inicial ? 0.6 : 0.25), 0, 100);
    // escaños: deriva lenta hacia lo que diría una encuesta
    if (T.demo && P.escanos != null && !inicial) {
      const obj = clamp(50 + (P.aprob - 50) * 0.5 * s.amplif, 10, 85);
      P.escanos = clamp(P.escanos + (obj - P.escanos) * 0.025, 5, 95);
    }
    // capital político
    if (!inicial) {
      let pc = T.pc + (P.aprob - 50) * 0.05 + (E.gob.min.presidencia ? 1 : 0);
      if (T.demo && P.escanos != null) pc += P.escanos >= 50 ? 1 : (T.nombre.includes('arlament') || E.gob.tipo === 'monarquia_const') ? -1 : 0;
      P.pc = clamp(P.pc + Math.max(1, pc), 0, 40);
    }
    // alineamiento
    P.alinMod *= 0.985;
    let al = P.alinMod;
    const peso = { tlc: 3, inversion: 4, cooperacion: 10, alianza: 22, ayuda: 8 };
    for (const iso in E.mundo.p) { const q = E.mundo.p[iso]; const sg = q.ali === 'occ' ? 1 : q.ali === 'eje' ? -1 : 0; if (!sg) continue; for (const tr in q.tr) al += sg * (peso[tr] || 0) * (1 + PX[iso].pot * 0.3); }
    for (const id in E.orgs) if (E.orgs[id].estado === 'miembro') { const O = R.ORGANIZACIONES[id]; if (O.alinea === 'occ') al += 30; if (O.alinea === 'eje') al -= 20; if (id === 'UE') al += 12; }
    P.alin = clamp(al, -100, 100);
  }

  // ---------------- relaciones ----------------
  function actitudBase(E, iso, s) {
    const q = E.mundo.p[iso], P = PX[iso], demoYo = R.TIPOS[E.gob.tipo].demo, demoEl = !!DEMO_REG[q.reg];
    let b = 5;
    if (demoYo && demoEl) b += 12; else if (!demoYo && !demoEl) b += 6; else if (demoEl && q.ali === 'occ') b -= 14; else b -= 4;
    const a = E.pol.alin / 100;
    if (q.ali === 'occ') b += 28 * a; else if (q.ali === 'eje') b -= 28 * a;
    for (const tr in q.tr) b += tr === 'alianza' ? 18 : tr === 'limites' ? 6 : 10;
    for (const id in E.orgs) if (E.orgs[id].estado === 'miembro' && P.bloques.includes(id)) b += 8;
    if (q.disp) b -= 25;
    b += (E.soc.prestigio - 50) * 0.25;
    if (demoEl && q.ali === 'occ') b += (E.soc.libertad - 50) * 0.2;
    if (s.rel.occ && q.ali === 'occ') b += s.rel.occ;
    if (s.rel.eje && q.ali === 'eje') b += s.rel.eje;
    // rivalidad entre potencias: tus aliados definen tus enemigos
    const aliados = []; for (const k in E.mundo.p) if (E.mundo.p[k].tr.alianza) aliados.push(k);
    if (aliados.length) {
      if ((iso === 'CHN' || iso === 'RUS') && aliados.includes('USA')) b -= 18;
      if (iso === 'USA' && (aliados.includes('CHN') || aliados.includes('RUS'))) b -= 22;
    }
    if (q.vec) b *= 1.25;
    return clamp(b, -85, 85);
  }
  function calcRel(E, iso) { const q = E.mundo.p[iso]; if (E.guerra && E.guerra.con === iso) return -100; return clamp(q.base + q.mod, -100, 100); }
  function relacionesPaso(E, s) {
    for (const iso in E.mundo.p) { const q = E.mundo.p[iso]; q.base = actitudBase(E, iso, s); q.mod *= 0.96; q.rel = calcRel(E, iso); }
  }

  // ---------------- guerra ----------------
  function milDe(E, iso) { return E.mundo.p[iso].pib * (PX[iso].reg === 'militar' ? 0.032 : 0.022) * 10; }
  function aliadosEnGuerra(E) { let a = 0; for (const iso in E.mundo.p) { const q = E.mundo.p[iso]; if (q.tr.alianza && iso !== E.guerra.con) a += milDe(E, iso) * (PX[iso].pot >= 2 ? 0.08 : 0.25); } return a; }
  function guerraPaso(E, s) {
    const G = E.guerra; G.turnos++;
    const P = E.eco.mil * (0.6 + 0.4 * E.pol.fac.militares.sat / 100) + aliadosEnGuerra(E);
    const Q = milDe(E, G.con) * entre(E, 0.9, 1.1);
    const ratio = P / (P + Q);
    G.frente = clamp(G.frente + (ratio - 0.5) * 50 + gauss(E) * 8, -100, 100);
    G.ratio = ratio;
    for (const f in E.pol.fac) E.pol.fac[f].sat -= G.turnos <= 2 ? -2 : 1.1;
    if (G.frente >= 60) { finGuerra(E, 'victoria'); return; }
    if (G.frente <= -60) { finGuerra(E, 'derrota'); return; }
    if (G.turnos >= 5 && Math.abs(G.frente) < 35 && rnd(E) < 0.2 && !E.pend.some(p => p.id === 'armisticio')) E.pend.push({ id: 'armisticio', ctx: { v: G.con } });
  }
  function iniciarGuerra(E, iso, agresor) {
    E.guerra = { con: iso, frente: 0, turnos: 0, agresor: !!agresor, inicio: E.turno };
    const q = E.mundo.p[iso]; for (const k in q.tr) delete q.tr[k];
    for (const f in E.pol.fac) E.pol.fac[f].sat = clamp(E.pol.fac[f].sat + (agresor ? 2 : 7), 0, 100);
    if (agresor) { E.soc.prestigio -= 12; for (const k in E.mundo.p) if (k !== iso) E.mundo.p[k].mod -= PX[k].sub === E.pais.sub ? 15 : 6; }
    noticia(E, agresor ? `${E.pais.nombre} declara la guerra a ${PX[iso].nombre}.` : `¡${PX[iso].nombre} invade ${E.pais.nombre}! Comienza la guerra.`, 'crisis');
  }
  function finGuerra(E, res) {
    const G = E.guerra, nom = PX[G.con].nombre, q = E.mundo.p[G.con]; E.guerra = null;
    const F = E.pol.fac;
    if (res === 'victoria') {
      q.disp = false; E.eco.pib *= 1.025; E.eco.pob *= 1.02; F.militares.sat += 15; for (const f in F) F[f].sat += 6; E.pol.legitMod += 10; q.mod = -40;
      noticia(E, `Victoria: ${nom} firma la rendición. Las tierras en disputa pasan a ${E.pais.nombre}.`, 'hito');
    } else if (res === 'derrota') {
      q.disp = false; E.eco.pib *= 0.94; E.eco.pob *= 0.97; F.militares.sat -= 15; for (const f in F) F[f].sat -= 8; E.pol.legitMod -= 18; q.mod = -30;
      E.eco.choques.push({ g: -3, t: 4 });
      noticia(E, `Derrota ante ${nom}. ${E.pais.nombre} pierde territorio y orgullo.`, 'crisis');
    } else {
      q.mod = -20; E.pol.legitMod += 2;
      noticia(E, `Armisticio con ${nom}. Las armas callan; la disputa sigue abierta.`, 'hito');
    }
    for (const f in F) F[f].sat = clamp(F[f].sat, 0, 100);
  }

  function modsPaso(E) {
    for (const m of E.mods) m.t--;
    for (const m of E.mods.filter(m => m.t <= 0)) noticia(E, `Termina: ${m.nombre}.`, 'info');
    E.mods = E.mods.filter(m => m.t > 0);
    for (const id in E.gob.leyes) { const L = E.gob.leyes[id]; if (L.hasta && E.turno >= L.hasta) { delete E.gob.leyes[id]; noticia(E, `Expira: ${R.LEYES[id].nombre}.`, 'info'); } }
    for (const id in E.orgs) { const o = E.orgs[id]; if (o.estado === 'negocia' && E.turno >= o.t) { const r = reqOrg(E, id); if (r.ok) { o.estado = 'miembro'; noticia(E, `${E.pais.nombre} ingresa a ${R.ORGANIZACIONES[id].nombre}.`, 'hito'); } else { delete E.orgs[id]; noticia(E, `Fracasa el ingreso a ${R.ORGANIZACIONES[id].nombre}: ${r.faltan[0]}.`, 'crisis'); } } }
  }

  // ---------------- riesgos: golpes, estallidos, elecciones ----------------
  function riesgoGolpe(E, s) {
    const P = E.pol, satM = P.fac.militares.sat, podM = P.poder.militares * 8;
    let r = 0;
    if (satM < 40) r += (40 - satM) * 0.0045 * podM;
    if (P.est < 40) r += (40 - P.est) * 0.002;
    if (P.legit < 35) r += (35 - P.legit) * 0.002;
    r *= s.golpe * (E.gob.tipo === 'junta' ? 1.3 : R.TIPOS[E.gob.tipo].demo ? 0.8 : 1);
    if (E.guerra && E.guerra.frente < -30) r += 0.03;
    if (E.flags.purga && E.turno - E.flags.purga < 8) r *= 0.4;
    return clamp(r, 0, 0.35);
  }
  function riesgosPaso(E, s) {
    const P = E.pol, T = R.TIPOS[E.gob.tipo];
    P.riesgoGolpe = riesgoGolpe(E, s);
    const yaHay = id => E.pend.some(p => p.id === id);
    if (rnd(E) < P.riesgoGolpe) {
      if (s.aviso && !(E.flags.aviso && E.turno - E.flags.aviso < 6)) { E.flags.aviso = E.turno; E.pend.push({ id: 'conspiracion', ctx: {} }); }
      else E.pend.push({ id: 'golpe', ctx: {} });
    }
    P.protAltas = P.prot > 62 ? P.protAltas + 1 : 0;
    const recienEst = E.flags.estallido != null && E.turno - E.flags.estallido < 6;
    if (!recienEst && P.protAltas >= 2 && P.est < 32 && rnd(E) < 0.35 && !yaHay('golpe')) { E.flags.estallido = E.turno; E.pend.push({ id: 'estallido', ctx: {} }); }
    else if (!recienEst && !T.demo && !yaHay('golpe')) {
      // en una autocracia el descontento no se ve en la calle, pero se acumula
      let ch = Math.max(0, (46 - P.apPod) * 0.006) + Math.max(0, (42 - P.legit) * 0.004) + Math.max(0, E.eco.infl - 25) * 0.001;
      ch *= 1 - Math.min(0.6, s.represion / 100);
      P.riesgoRevuelta = ch;
      if (rnd(E) < ch) { E.flags.estallido = E.turno; E.pend.push({ id: 'estallido', ctx: {} }); }
    }
    if (T.demo && P.escanos != null) {
      const presid = E.gob.tipo === 'presidencial' || E.gob.tipo === 'federal';
      if (presid && P.aprob < 22 && P.escanos < 42 && rnd(E) < 0.18 && !(E.flags.juicio && E.turno - E.flags.juicio < 8)) { E.flags.juicio = E.turno; E.pend.push({ id: 'juicio_politico', ctx: {} }); }
      if (!presid && P.escanos < 50 && P.aprob < 33 && rnd(E) < 0.22 && !(E.flags.censura && E.turno - E.flags.censura < 6)) { E.flags.censura = E.turno; E.pend.push({ id: 'mocion_censura', ctx: {} }); }
      if (P.proxElec != null && E.turno >= P.proxElec && E.turno < E.durTurnos - 1) E.pend.push({ id: 'elecciones', ctx: {} });
    }
    if (P.proxCongreso != null && E.turno >= P.proxCongreso) { P.proxCongreso += 20; E.pend.push({ id: 'congreso_partido', ctx: {} }); }
    // crisis de deuda
    if ((E.eco.cerrados || E.eco.atrasos > 0) && !(E.flags.crisisDeuda && E.turno - E.flags.crisisDeuda < 6)) { E.flags.crisisDeuda = E.turno; E.pend.push({ id: 'crisis_deuda', ctx: {} }); }
    // invasión de un vecino
    if (!E.guerra && E.turno > 6) {
      for (const v of E.pais.vecinos) {
        const q = E.mundo.p[v]; let ch = 0;
        const ratio = milDe(E, v) / Math.max(1e-6, E.eco.mil + aliadosEnGuerraPrev(E));
        if (q.disp && q.rel < -50 && ratio > 1.1) ch = Math.min(0.1, 0.03 * ratio);
        else if (q.rel < -75 && ratio > 1.4) ch = 0.012;
        if (q.tr.no_agresion) ch *= 0.15;
        for (const k in E.mundo.p) if (E.mundo.p[k].tr.alianza && PX[k].pot >= 2) { ch *= 0.25; break; }
        if (E.orgs.OTAN && E.orgs.OTAN.estado === 'miembro') ch *= 0.2;
        if (ch && rnd(E) < ch) { E.pend.push({ id: 'invasion', ctx: { v } }); break; }
      }
    }
  }
  function aliadosEnGuerraPrev(E) { let a = 0; for (const iso in E.mundo.p) { const q = E.mundo.p[iso]; if (q.tr.alianza) a += milDe(E, iso) * (PX[iso].pot >= 2 ? 0.08 : 0.25); } return a; }

  // ---------------- eventos ----------------
  function helpers(E) {
    return {
      rnd: () => rnd(E), gauss: () => gauss(E), pick: a => pick(E, a), entre: (a, b) => entre(E, a, b), clamp,
      nom: iso => (PX[iso] ? PX[iso].nombre : iso), meta: iso => PX[iso], est: iso => E.mundo.p[iso],
      P: E.pais.nombre, cap: E.pais.capital, jefe: R.TIPOS[E.gob.tipo].jefe, lider: E.pais.lider, demo: R.TIPOS[E.gob.tipo].demo, tipo: E.gob.tipo,
      vecinos: () => E.pais.vecinos.slice(), region: () => PAISES.filter(p => p.sub === E.pais.sub).map(p => p.iso), continente: () => PAISES.filter(p => p.cont === E.pais.cont).map(p => p.iso),
      disputa: () => E.pais.vecinos.find(v => E.mundo.p[v].disp) || null,
      potencia: ali => { const l = POTENCIAS.filter(i => !ali || PX[i].ali === ali); return pick(E, l); },
      min: id => E.gob.min[id], minNom: id => (E.gob.min[id] ? E.gob.min[id].nombre : 'el ministerio'), MIN: R.MINISTERIOS,
      corrupto: () => { const l = Object.keys(E.gob.min).filter(m => E.gob.min[m] && E.gob.min[m].hon <= 2); return l.length ? pick(E, l) : null; },
      desleal: () => { const l = Object.keys(E.gob.min).filter(m => E.gob.min[m] && E.gob.min[m].leal <= 2); return l.length ? pick(E, l) : null; },
      ley: id => !!E.gob.leyes[id], inst: k => E.gob.inst[k], org: id => !!(E.orgs[id] && E.orgs[id].estado === 'miembro'),
      persona: () => persona(E), fac: f => E.pol.fac[f].sat, mil: () => E.eco.mil, milDe: iso => milDe(E, iso),
      R,
    };
  }
  function eventosPaso(E) {
    const H = helpers(E);
    // cola de eventos encadenados
    const listos = E.cola.filter(x => x.turno <= E.turno); E.cola = E.cola.filter(x => x.turno > E.turno);
    for (const x of listos) E.pend.push({ id: x.id, ctx: x.ctx });
    if (E.pend.length >= 2) return;
    const n = rnd(E) < 0.62 ? 1 : rnd(E) < 0.35 ? 2 : 0;
    for (let i = 0; i < n; i++) {
      const ops = [];
      for (const ev of EV.EVENTOS) {
        if (ev.critico || ev.manual) continue;
        if (E.pend.some(p => p.id === ev.id)) continue;
        const v = E.vistos[ev.id]; if (v != null && (ev.unico || E.turno - v < (ev.enfriar || 16))) continue;
        let w = 0; try { w = ev.peso ? ev.peso(E, H) : 1; } catch (e) { w = 0; }
        if (w > 0) ops.push([ev.id, w]);
      }
      const id = elegirPeso(E, ops); if (!id) break;
      const ev = EV.EVENTOS.find(e => e.id === id);
      const c = ev.ctx ? ev.ctx(E, H) : {}; if (c === null) continue;
      E.vistos[id] = E.turno;
      E.pend.push({ id, ctx: c });
    }
  }
  function defEvento(id) { return EV.EVENTOS.find(e => e.id === id); }
  function verEvento(E, pend) {
    const ev = defEvento(pend.id), H = helpers(E), c = pend.ctx || {};
    const val = x => (typeof x === 'function' ? x(E, c, H) : x);
    return {
      id: ev.id, cat: ev.cat || 'politica', critico: !!ev.critico, titulo: val(ev.titulo), texto: val(ev.texto),
      opciones: ev.op.map(o => { let ef = val(o.ef) || {}; const req = o.req ? o.req(E, c, H) : true; return { t: val(o.t), ef, chips: chips(E, ef, c), bloqueada: req !== true, motivo: req === true ? '' : (req || 'No disponible') }; }),
    };
  }
  function resolver(E, idx, opcion) {
    const pend = E.pend[idx]; if (!pend) return null;
    const v = verEvento(E, pend), o = v.opciones[opcion];
    if (!o || o.bloqueada) return null;
    E.pend.splice(idx, 1);
    const res = aplicar(E, o.ef, pend.ctx || {});
    E.ultimo = { titulo: v.titulo, opcion: o.t, texto: res.texto, chips: res.chips };
    if (!res.silencio) noticia(E, `${v.titulo}: ${o.t}.${res.texto ? ' ' + res.texto : ''}`, v.critico ? 'crisis' : 'decision');
    return E.ultimo;
  }

  // Aplica un objeto de efectos declarativo. Devuelve {texto, chips}.
  function aplicar(E, ef, c) {
    c = c || {}; const F = E.pol.fac; let texto = ''; let ch = chips(E, ef, c);
    if (!ef) return { texto, chips: ch };
    if (ef.prob) {
      const pr = ef.prob, ok = rnd(E) < pr.p;
      const sub = aplicar(E, ok ? pr.si : pr.no, c);
      texto = (ok ? pr.ts : pr.tn) || ''; if (sub.texto) texto += (texto ? ' ' : '') + sub.texto;
      ch = ch.filter(x => x.t !== 'Probabilidad').concat(sub.chips);
    }
    if (ef.todos) for (const f in F) F[f].sat += ef.todos;
    if (ef.fac) for (const f in ef.fac) { F[f].sat += ef.fac[f]; F[f].humor += ef.fac[f] * 0.4; }
    for (const f in F) F[f].sat = clamp(F[f].sat, 0, 100);
    if (ef.leg) E.pol.legitMod += ef.leg;
    if (ef.est) E.pol.est = clamp(E.pol.est + ef.est, 0, 100);
    if (ef.pc) E.pol.pc = clamp(E.pol.pc + ef.pc, 0, 40);
    if (ef.dinero) E.eco.deuda -= ef.dinero / 100 * E.eco.pib;
    if (ef.deuda) E.eco.deuda += ef.deuda / 100 * E.eco.pib;
    if (ef.liquidez) E.eco.liquidez += ef.liquidez / 100 * E.eco.pib;
    if (ef.choque) E.eco.choques.push({ g: ef.choque.g, t: ef.choque.t || 2 });
    if (ef.infl) E.eco.infl = Math.max(-3, E.eco.infl + ef.infl);
    if (ef.inflMult) E.eco.infl *= ef.inflMult;
    if (ef.emision) E.eco.emision += ef.emision;
    if (ef.riesgo) E.eco.defaultR += ef.riesgo;
    for (const k of ['corr', 'salud', 'educacion', 'infra', 'seguridad', 'desig', 'prestigio']) if (ef[k]) E.soc[k] = clamp(E.soc[k] + ef[k], 0, 100);
    if (ef.seg) E.soc.seguridad = clamp(E.soc.seguridad + ef.seg, 0, 100);
    if (ef.prest) E.soc.prestigio = clamp(E.soc.prestigio + ef.prest, 0, 100);
    if (ef.lib) E.soc.libMod += ef.lib;
    if (ef.prot) E.pol.prot = clamp(E.pol.prot + ef.prot, 0, 100);
    if (ef.tension) E.mundo.tension = clamp(E.mundo.tension + ef.tension, 0, 100);
    if (ef.alin) E.pol.alinMod += ef.alin;
    if (ef.mil) E.eco.mil *= 1 + ef.mil / 100;
    if (ef.pib) E.eco.pib *= 1 + ef.pib / 100;
    if (ef.pob) E.eco.pob *= 1 + ef.pob / 100;
    if (ef.escanos && E.pol.escanos != null) E.pol.escanos = clamp(E.pol.escanos + ef.escanos, 5, 95);
    if (ef.rel) for (const k in ef.rel) relAplicar(E, k, ef.rel[k], c);
    if (ef.sector) for (const k in ef.sector) { E.eco.sec[k] = clamp((E.eco.sec[k] || 0) + ef.sector[k], 0, 0.4); if (!E.eco.sec[k]) delete E.eco.sec[k]; }
    if (ef.gastoArea) for (const k in ef.gastoArea) { E.eco.gasto[k] = clamp(E.eco.gasto[k] + ef.gastoArea[k], R.AREAS[k].min, R.AREAS[k].max); if (E.eco.presBase) E.eco.presBase.gasto[k] = E.eco.gasto[k]; }
    if (ef.ley) { const L = R.LEYES[ef.ley]; if (L) { quitarChocantes(E, ef.ley); E.gob.leyes[ef.ley] = { desde: E.turno, hasta: L.temporal ? E.turno + L.temporal : null }; aplicarUnica(E, ef.ley); } }
    if (ef.derogar && E.gob.leyes[ef.derogar]) delete E.gob.leyes[ef.derogar];
    if (ef.inst) for (const k in ef.inst) E.gob.inst[k] = ef.inst[k];
    if (ef.mod) E.mods.push({ nombre: ef.mod.nombre, t: ef.mod.t, ef: ef.mod.ef });
    if (ef.flag) E.flags[ef.flag] = E.turno;
    if (ef.cola) E.cola.push({ id: ef.cola.id, ctx: ef.cola.ctx || c, turno: E.turno + (ef.cola.en || 1) });
    if (ef.destituir) { const m = ef.destituir === true ? c.min : ef.destituir; if (E.gob.min[m] !== undefined) E.gob.min[m] = null; }
    if (ef.tratado) { const q = E.mundo.p[ef.tratado.iso || c.v || c.x]; if (q) q.tr[ef.tratado.tipo] = E.turno; }
    if (ef.romper) { const q = E.mundo.p[ef.romper.iso || c.v || c.x]; if (q) delete q.tr[ef.romper.tipo]; }
    if (ef.disputa != null) { const q = E.mundo.p[c.v]; if (q) q.disp = !!ef.disputa; }
    if (ef.regimen) { const q = E.mundo.p[ef.regimen.iso]; if (q) q.reg = ef.regimen.reg; }
    if (ef.guerra) iniciarGuerra(E, ef.guerra === true ? c.v : ef.guerra, !!ef.agresor);
    if (ef.paz && E.guerra) finGuerra(E, ef.paz === true ? 'armisticio' : ef.paz);
    if (ef.suceso) iniciarSuceso(E, ef.suceso);
    if (ef.cambioRegimen) cambiarRegimen(E, ef.cambioRegimen, true);
    if (ef.eleccion != null) texto += (texto ? ' ' : '') + elecciones(E, ef.eleccion);
    if (ef.adelantar && E.pol.proxElec != null) E.pol.proxElec = E.turno + 1;
    if (ef.postergar && E.pol.proxElec != null) E.pol.proxElec = Math.max(E.pol.proxElec, E.turno) + ef.postergar;
    if (ef.impago) { E.eco.deuda *= 0.55; E.eco.atrasos = 0; }
    if (ef.purga) E.flags.purga = E.turno;
    if (ef.noticia) noticia(E, ef.noticia, 'info');
    if (ef.texto) texto += (texto ? ' ' : '') + ef.texto;
    if (ef.fin) terminar(E, ef.fin.tipo, ef.fin.titulo, ef.fin.texto);
    E.soc.salud = clamp(E.soc.salud, 0, 100);
    return { texto, chips: ch };
  }
  function relAplicar(E, k, n, c) {
    const add = iso => { if (E.mundo.p[iso]) { E.mundo.p[iso].mod += n; E.mundo.p[iso].rel = calcRel(E, iso); } };
    if (k === 'v' || k === 'x' || k === 'y') return c[k] && add(c[k]);
    if (k === 'vecinos') return E.pais.vecinos.forEach(add);
    if (k === 'region') return PAISES.filter(p => p.sub === E.pais.sub).forEach(p => add(p.iso));
    if (k === 'occ' || k === 'eje' || k === 'neu') return PAISES.filter(p => E.mundo.p[p.iso].ali === k).forEach(p => add(p.iso));
    if (k === 'todos') return PAISES.forEach(p => add(p.iso));
    if (k === 'potencias') return POTENCIAS.forEach(add);
    add(k);
  }

  // Resumen legible de un objeto de efectos (para mostrar antes de decidir).
  function chips(E, ef, c) {
    const out = []; if (!ef) return out; c = c || {};
    const push = (t, v, bueno, txt) => out.push({ t, v, bueno: bueno === undefined ? v > 0 : bueno, txt });
    if (ef.prob) { out.push({ t: 'Probabilidad', v: 0, txt: `${Math.round(ef.prob.p * 100)}% de éxito`, bueno: null }); }
    if (ef.todos) push('Todas las facciones', ef.todos);
    if (ef.fac) for (const f in ef.fac) push(R.FACCIONES[f].corto, ef.fac[f]);
    if (ef.leg) push('Legitimidad', ef.leg);
    if (ef.est) push('Estabilidad', ef.est);
    if (ef.pc) push('Capital político', ef.pc);
    if (ef.dinero) push(ef.dinero > 0 ? 'Ingreso' : 'Costo', ef.dinero, ef.dinero > 0, `${ef.dinero > 0 ? '+' : '−'}${fmt(Math.abs(ef.dinero), 1)}% PIB`);
    if (ef.deuda) push('Deuda', ef.deuda, false, `+${fmt(ef.deuda, 1)}% PIB`);
    if (ef.liquidez) push('Liquidez', ef.liquidez, true, `+${fmt(ef.liquidez, 1)}% PIB`);
    if (ef.choque) push('Crecimiento', ef.choque.g, ef.choque.g > 0, `${ef.choque.g > 0 ? '+' : '−'}${fmt(Math.abs(ef.choque.g), 1)} pts × ${ef.choque.t || 2} trim.`);
    if (ef.infl) push('Inflación', ef.infl, ef.infl < 0);
    if (ef.corr) push('Corrupción', ef.corr, ef.corr < 0);
    if (ef.salud) push('Salud', ef.salud); if (ef.educacion) push('Educación', ef.educacion); if (ef.infra) push('Infraestructura', ef.infra);
    if (ef.seg) push('Seguridad', ef.seg); if (ef.seguridad) push('Seguridad', ef.seguridad); if (ef.desig) push('Desigualdad', ef.desig, ef.desig < 0);
    if (ef.prest) push('Prestigio', ef.prest); if (ef.lib) push('Libertades', ef.lib);
    if (ef.prot) push('Protestas', ef.prot, ef.prot < 0);
    if (ef.mil) push('Poder militar', ef.mil);
    if (ef.alin) push(ef.alin > 0 ? 'Acercamiento a Occidente' : 'Acercamiento a China/Rusia', ef.alin, null, '');
    if (ef.rel) for (const k in ef.rel) { const n = ef.rel[k]; const nom = { v: c.v && PX[c.v] ? PX[c.v].nombre : 'Vecino', x: c.x && PX[c.x] ? PX[c.x].nombre : 'Potencia', y: c.y && PX[c.y] ? PX[c.y].nombre : 'País', vecinos: 'Vecinos', region: 'Región', occ: 'Occidente', eje: 'Eje China-Rusia', neu: 'No alineados', todos: 'Todo el mundo', potencias: 'Potencias' }[k] || (PX[k] ? PX[k].nombre : k); push('Relación: ' + nom, n); }
    if (ef.ley) push('Ley: ' + R.LEYES[ef.ley].nombre, 0, null, 'se aprueba');
    if (ef.gastoArea) for (const k in ef.gastoArea) push('Gasto en ' + R.AREAS[k].nombre.toLowerCase(), ef.gastoArea[k], null, `${ef.gastoArea[k] > 0 ? '+' : ''}${fmt(ef.gastoArea[k], 1)}% PIB`);
    if (ef.mod) push(ef.mod.nombre, 0, null, `${ef.mod.t} trimestres`);
    if (ef.guerra) push('GUERRA', -1, false, '');
    if (ef.paz) push('Paz', 1, true, '');
    if (ef.destituir) push('Destitución', 0, null, 'queda el cargo vacante');
    if (ef.fin) push('FIN DEL GOBIERNO', -1, false, '');
    if (ef.sector) for (const k in ef.sector) push(R.RECURSOS[k].nombre, ef.sector[k], ef.sector[k] > 0, ef.sector[k] > 0 ? 'nuevo motor' : 'menos peso');
    return out;
  }
  function fmt(x, d) { return (Math.round(x * Math.pow(10, d || 0)) / Math.pow(10, d || 0)).toLocaleString('es-ES', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }

  // ---------------- elecciones ----------------
  function elecciones(E, bonus) {
    const P = E.pol, s = estaticos(E);
    const v = clamp(22 + 0.55 * P.aprob + 0.6 * clamp(E.eco.crec, -5, 6) - 0.15 * Math.max(0, E.eco.infl - 5) - 1.6 * P.mandatos + (bonus || 0) + gauss(E) * 3.5, 5, 85);
    const presid = E.gob.tipo === 'presidencial' || E.gob.tipo === 'federal';
    P.votos = v;
    const escanos = clamp(50 + (v - (presid ? 48 : 50)) * s.amplif, 5, 92);
    P.proxElec = E.turno + s.mandato * 4;
    const pct = fmt(v, 1);
    let coal = '';
    if (!presid && escanos < 50) { const pc = clamp(0.3 + (escanos - 44) / 6 * 0.6, 0, 0.9); if (escanos < 44 || rnd(E) > pc) { terminar(E, 'derrota', 'Derrota electoral', `Tu partido obtuvo ${pct}% de los votos y ${Math.round(escanos)}% de los escaños. La oposición logra armar una coalición y entregas el poder en una transición pacífica.`); return `Obtienes ${pct}%: no logras formar coalición.`; } coal = ' Tras semanas de negociación, armas una coalición.'; }
    if (presid && v < 50) {
      terminar(E, 'derrota', 'Derrota electoral', `Tu proyecto obtuvo ${pct}% de los votos. ${presid ? 'La oposición gana la segunda vuelta' : 'La oposición forma gobierno'} y entregas el poder en una transición pacífica.`);
      return `Obtienes ${pct}%: pierdes.`;
    }
    P.mandatos++; P.escanos = escanos; P.legitMod += 6; P.renovado = E.turno - Math.min(8, (E.turno - (P.renovado || 0)) / 2);
    for (const f in P.fac) P.fac[f].sat = clamp(P.fac[f].sat + 3, 0, 100);
    P.pc = clamp(P.pc + 6, 0, 40);
    return `¡Victoria con ${pct}%! ${escanos >= 50 ? 'Mayoría propia' : 'Gobernarás en coalición'} con ${Math.round(escanos)}% de los escaños.${coal}`;
  }
  function pronostico(E) { const P = E.pol; return clamp(22 + 0.55 * P.aprob + 0.6 * clamp(E.eco.crec, -5, 6) - 0.15 * Math.max(0, E.eco.infl - 5) - 1.6 * P.mandatos, 5, 85); }

  // ---------------- leyes ----------------
  function estadoLey(E, id) {
    const L = R.LEYES[id], T = R.TIPOS[E.gob.tipo], s = estaticos(E);
    if (E.gob.leyes[id]) return { vigente: true };
    if (L.unica && E.flags['ley_' + id]) return { ok: false, motivo: 'Ya se aplicó.' };
    if (L.req) {
      if (L.req.ministerio && !(L.req.ministerio in E.gob.min)) return { ok: false, motivo: `Requiere el Ministerio de ${R.MINISTERIOS[L.req.ministerio].nombre}.` };
      if (L.req.control && !L.req.control.includes(E.gob.inst.control)) return { ok: false, motivo: 'Requiere un órgano de control de la corrupción.' };
    }
    const choque = (L.choca || []).filter(x => E.gob.leyes[x]).map(x => R.LEYES[x].nombre);
    let costo = L.pc;
    if (!T.demo || E.gob.inst.legislativo === 'consultivo' || E.gob.inst.legislativo === 'ninguno' || E.pol.escanos == null)
      return { ok: E.pol.pc >= costo, costo, modo: 'decreto', prob: 1, apoyo: null, motivo: E.pol.pc >= costo ? '' : 'Falta capital político.', choque };
    const parl = !(E.gob.tipo === 'presidencial' || E.gob.tipo === 'federal');
    const umbral = 50 + s.umbral;
    const apoyo = E.pol.escanos + L.apoyo + (E.pol.aprob - 50) * 0.25 + (parl && E.pol.escanos >= 50 ? 6 : 0);
    if (apoyo >= umbral) return { ok: E.pol.pc >= costo, costo, modo: 'votacion', prob: 1, apoyo, umbral, motivo: E.pol.pc >= costo ? '' : 'Falta capital político.', choque };
    const cn = Math.ceil(costo * 1.5), prob = clamp((apoyo - umbral + 15) / 20, 0.05, 0.9);
    const decreto = !parl ? { costo: Math.ceil(costo * 1.2), anula: E.gob.inst.judicial === 'independiente' ? 0.45 : E.gob.inst.judicial === 'supervisado' ? 0.15 : 0 } : null;
    return { ok: E.pol.pc >= cn, costo: cn, modo: 'negociar', prob, apoyo, umbral, decreto, motivo: E.pol.pc >= cn ? '' : 'Falta capital político.', choque };
  }
  function quitarChocantes(E, id) { for (const x of (R.LEYES[id].choca || [])) if (E.gob.leyes[x]) { delete E.gob.leyes[x]; noticia(E, `Queda derogada: ${R.LEYES[x].nombre}.`, 'info'); } }
  function aplicarUnica(E, id) {
    const L = R.LEYES[id];
    if (L.dinero) E.eco.deuda -= L.dinero / 100 * E.eco.pib;
    if (L.unica) { E.flags['ley_' + id] = E.turno; }
    if (L.temporal == null && L.unica && id !== 'amnistia') {} // sigue vigente como política
    if (id === 'amnistia') E.soc.libMod += 4;
  }
  function aprobarLey(E, id, modo) {
    const st = estadoLey(E, id); if (st.vigente) return { ok: false, texto: 'Ya está vigente.' };
    const L = R.LEYES[id];
    const promulgar = () => { quitarChocantes(E, id); E.gob.leyes[id] = { desde: E.turno, hasta: L.temporal ? E.turno + L.temporal : null }; aplicarUnica(E, id); for (const f in L.fac || {}) E.pol.fac[f].sat = clamp(E.pol.fac[f].sat + L.fac[f] * 0.5, 0, 100); };
    if (modo === 'decreto' && st.decreto) {
      if (E.pol.pc < st.decreto.costo) return { ok: false, texto: 'Falta capital político.' };
      E.pol.pc -= st.decreto.costo; E.pol.legitMod -= 3;
      if (rnd(E) < st.decreto.anula) { E.pol.legitMod -= 2; noticia(E, `La Corte Suprema anula el decreto «${L.nombre}».`, 'crisis'); return { ok: false, texto: 'La Corte Suprema declaró inconstitucional el decreto.' }; }
      promulgar(); noticia(E, `Por decreto: ${L.nombre}.`, 'decision'); return { ok: true, texto: 'Decreto promulgado.' };
    }
    if (!st.ok) return { ok: false, texto: st.motivo };
    E.pol.pc -= st.costo;
    if (st.modo === 'negociar' && rnd(E) >= st.prob) { noticia(E, `El Congreso rechaza «${L.nombre}».`, 'crisis'); return { ok: false, texto: 'El Congreso rechazó la ley. El capital político gastado no vuelve.' }; }
    if (st.modo === 'negociar') E.soc.corr = clamp(E.soc.corr + 0.6, 0, 100);
    promulgar();
    noticia(E, `${st.modo === 'decreto' ? 'Se decreta' : 'Se aprueba'}: ${L.nombre}.`, 'decision');
    return { ok: true, texto: st.modo === 'decreto' ? 'Promulgada.' : 'Aprobada por el Congreso.' };
  }
  function derogarLey(E, id) {
    if (!E.gob.leyes[id]) return { ok: false };
    const L = R.LEYES[id], costo = Math.ceil(L.pc / 2);
    if (E.pol.pc < costo) return { ok: false, texto: 'Falta capital político.' };
    E.pol.pc -= costo; delete E.gob.leyes[id];
    for (const f in L.fac || {}) E.pol.fac[f].sat = clamp(E.pol.fac[f].sat - L.fac[f] * 0.4, 0, 100);
    noticia(E, `Se deroga: ${L.nombre}.`, 'decision'); return { ok: true, texto: 'Derogada.' };
  }

  // ---------------- presupuesto ----------------
  function fijarPresupuesto(E, p) {
    if (p.tasaImp != null) E.eco.tasaImp = clamp(p.tasaImp, 8, 55);
    if (p.gasto) for (const a in p.gasto) if (R.AREAS[a]) E.eco.gasto[a] = clamp(p.gasto[a], R.AREAS[a].min, R.AREAS[a].max);
    finanzas(E, estaticos(E));
  }

  // ---------------- organizaciones ----------------
  function reqOrg(E, id) {
    const O = R.ORGANIZACIONES[id], f = [], T = R.TIPOS[E.gob.tipo];
    if (O.cont && !O.cont.includes(E.pais.cont)) f.push('No corresponde a tu continente');
    if (O.subs && !O.subs.includes(E.pais.sub)) f.push('No corresponde a tu subregión');
    if (O.demo && !T.demo) f.push('Exige democracia');
    if (O.noJunta && E.gob.tipo === 'junta') f.push('No admite gobiernos golpistas');
    if (O.soloMonarquia && !T.corona) f.push('Solo para monarquías');
    if (O.costa && !E.pais.costa) f.push('Exige costa en el Pacífico');
    if (O.libMin && E.soc.libertad < O.libMin) f.push(`Libertades ≥ ${O.libMin} (tienes ${Math.round(E.soc.libertad)})`);
    if (O.corrMax && E.soc.corr > O.corrMax) f.push(`Corrupción ≤ ${O.corrMax} (tienes ${Math.round(E.soc.corr)})`);
    if (O.deudaMax && E.eco.deuda / E.eco.pib * 100 > O.deudaMax) f.push(`Deuda ≤ ${O.deudaMax}% del PIB`);
    if (O.inflMax && E.eco.infl > O.inflMax) f.push(`Inflación ≤ ${O.inflMax}%`);
    if (O.defMin && E.eco.gasto.defensa < O.defMin) f.push(`Gasto en defensa ≥ ${O.defMin}% del PIB`);
    if (O.pibMin && E.eco.pib < O.pibMin) f.push(`PIB ≥ US$ ${O.pibMin} mil millones`);
    if (O.relCon) for (const iso of O.relCon) if (E.mundo.p[iso].rel < O.relMin) f.push(`Relación con ${PX[iso].nombre} ≥ ${O.relMin} (tienes ${Math.round(E.mundo.p[iso].rel)})`);
    if (E.guerra) f.push('No admiten a un país en guerra');
    return { ok: f.length === 0, faltan: f };
  }
  function orgsDisponibles(E) {
    return Object.keys(R.ORGANIZACIONES).filter(id => { const O = R.ORGANIZACIONES[id]; if (O.cont && !O.cont.includes(E.pais.cont)) return false; if (O.subs && !O.subs.includes(E.pais.sub)) return false; return true; });
  }

  // ---------------- acciones ----------------
  const ACCIONES = {
    discurso: { nombre: 'Discurso a la nación', grupo: 'gobierno', pc: 3, enfriar: 2, desc: 'Cadena nacional. Sube un poco el ánimo de todos.',
      run: E => aplicar(E, { todos: 3 + (E.gob.min.presidencia ? 1 : 0), est: 1 }) },
    dialogo: { nombre: 'Gran diálogo nacional', grupo: 'gobierno', pc: 6, enfriar: 8, desc: 'Sienta a todas las facciones a la mesa. Baja las protestas.',
      run: E => aplicar(E, { todos: 2, prot: -15, est: 5 }) },
    reprimir: { nombre: 'Reprimir las protestas', grupo: 'gobierno', pc: 2, enfriar: 2, desc: 'Policía y fuerzas especiales a la calle.',
      cond: E => E.pol.prot < 15 ? 'No hay protestas que reprimir.' : null,
      run: E => { const s = estaticos(E); return aplicar(E, { prot: -(15 + s.represion * 0.6), lib: -8, fac: { estudiantes: -10, clase_media: -4, militares: 2 }, prest: -5, leg: R.TIPOS[E.gob.tipo].demo ? -6 : -2, rel: { occ: -5 } }); } },
    bono_militar: { nombre: 'Aumento de sueldo militar', grupo: 'gobierno', pc: 1, enfriar: 6, desc: 'Cuesta 0,3% del PIB. Los cuarteles lo agradecen.',
      run: E => aplicar(E, { dinero: -0.3, fac: { militares: 13 } }) },
    anticorrupcion: { nombre: 'Campaña anticorrupción', grupo: 'gobierno', pc: 5, enfriar: 8, desc: 'Auditorías y detenciones. Puede salpicar a tu gabinete.',
      run: E => { const r = aplicar(E, { corr: -5, fac: { clase_media: 6, empresarios: -4, militares: -3 } }); const c = Object.keys(E.gob.min).filter(m => E.gob.min[m] && E.gob.min[m].hon <= 2); if (c.length && rnd(E) < 0.5) { const m = pick(E, c); const nom = E.gob.min[m].nombre; E.gob.min[m] = null; r.texto = `Cae ${nom}, ministro/a de ${R.MINISTERIOS[m].nombre}. El cargo queda vacante.`; aplicar(E, { todos: 2 }); } return r; } },
    emitir: { nombre: 'Imprimir dinero', grupo: 'economia', pc: 2, enfriar: 1, desc: 'El Banco Central financia 2% del PIB de gasto. Alimenta la inflación.',
      cond: E => !estaticos(E).emitir ? 'El Banco Central es autónomo: no imprime para el gobierno.' : null,
      run: E => aplicar(E, { dinero: 2, emision: 5 }) },
    fmi: { nombre: 'Pedir un rescate al FMI', grupo: 'economia', pc: 4, enfriar: 12, desc: 'Liquidez del 5% del PIB y tasas más bajas, a cambio de 8 trimestres de ajuste.',
      cond: E => (E.eco.deuda / E.eco.pib < 0.7 && !E.eco.cerrados) ? 'Solo con deuda > 70% del PIB o mercados cerrados.' : (E.mundo.p.USA.rel < -30 ? 'Washington bloquea tu solicitud (relación con EE.UU. < −30).' : null),
      run: E => aplicar(E, { liquidez: 5, riesgo: -2.5, rel: { occ: 6 }, alin: 6, mod: { nombre: 'Programa de ajuste del FMI', t: 8, ef: { gasto: -2.2, fac: { sindicatos: -12, clase_media: -4, empresarios: 4 }, riesgo: -1.5 } } }) },
    default: { nombre: 'Declarar cesación de pagos', grupo: 'economia', pc: 6, enfriar: 40, desc: 'Dejas de pagar: la deuda baja 45%, pero quedas fuera de los mercados por años.',
      cond: E => (E.eco.deuda / E.eco.pib < 0.6) ? 'Con tu nivel de deuda, nadie lo entendería.' : null,
      run: E => { E.eco.deuda *= 0.55; E.eco.atrasos = 0; return aplicar(E, { riesgo: 7, choque: { g: -4, t: 4 }, rel: { occ: -18 }, fac: { empresarios: -15, clase_media: -8, sindicatos: 4 }, prest: -10, todos: 2 }); } },
    adelantar: { nombre: 'Adelantar las elecciones', grupo: 'gobierno', pc: 4, enfriar: 8, desc: 'Disuelves el Parlamento y vas a las urnas el próximo trimestre.',
      cond: E => !(E.gob.tipo === 'parlamentaria' || E.gob.tipo === 'monarquia_const') ? 'Solo en sistemas parlamentarios.' : (E.pol.proxElec - E.turno <= 2 ? 'Las elecciones ya están encima.' : null),
      run: E => aplicar(E, { adelantar: true, texto: `Elecciones convocadas para el próximo trimestre. Intención de voto actual: ${fmt(pronostico(E), 1)}%.` }) },
    obras: { nombre: 'Inaugurar obras emblemáticas', grupo: 'economia', pc: 2, enfriar: 4, desc: 'Cuesta 0,4% del PIB. Las regiones aplauden.',
      run: E => aplicar(E, { dinero: -0.4, infra: 1.5, fac: { regiones: 6, empresarios: 2 }, todos: 1 }) },
    bono_social: { nombre: 'Bono de emergencia a las familias', grupo: 'economia', pc: 2, enfriar: 4, desc: 'Cuesta 0,6% del PIB. Alivia a los más pobres por un tiempo.',
      run: E => aplicar(E, { dinero: -0.6, fac: { sindicatos: 6, campesinos: 7, clase_media: 2 }, prot: -6, infl: 0.3 }) },
    // diplomacia (arg = iso)
    visita: { nombre: 'Visita de Estado', grupo: 'diplomacia', pc: 2, desc: 'Mejora la relación.', conPais: true,
      cond: (E, iso) => E.mundo.p[iso].ultVisita > E.turno - 4 ? 'Visitaste ese país hace menos de un año.' : (E.guerra && E.guerra.con === iso ? 'Están en guerra.' : null),
      run: (E, iso) => { const q = E.mundo.p[iso]; q.ultVisita = E.turno; const n = 7 + comp(E, 'exteriores') * 1.5; return aplicar(E, { rel: { [iso]: n }, dinero: -0.02, prest: PX[iso].pot >= 2 ? 1 : 0, texto: `Relación con ${PX[iso].nombre} +${Math.round(n)}.` }); } },
    condenar: { nombre: 'Condena pública', grupo: 'diplomacia', pc: 1, desc: 'Denuncias a su gobierno ante el mundo.', conPais: true,
      run: (E, iso) => { const q = E.mundo.p[iso]; const ef = { rel: { [iso]: -20 }, todos: 0.5 }; if (q.ali === 'eje') { ef.alin = 5; } else if (q.ali === 'occ') ef.alin = -5; if (!DEMO_REG[q.reg]) ef.prest = 1; return aplicar(E, ef); } },
    expulsar: { nombre: 'Expulsar al embajador', grupo: 'diplomacia', pc: 2, desc: 'Ruptura casi total. Al nacionalismo le gusta.', conPais: true,
      run: (E, iso) => { const q = E.mundo.p[iso]; for (const k in q.tr) delete q.tr[k]; return aplicar(E, { rel: { [iso]: -35 }, todos: 1.5, fac: { militares: 2 } }); } },
    prestamo: { nombre: 'Pedir un préstamo bilateral', grupo: 'diplomacia', pc: 3, desc: 'Liquidez del 2,5% del PIB a tasa baja, a cambio de cercanía política.', conPais: true,
      cond: (E, iso) => { const q = E.mundo.p[iso], P = PX[iso]; if (P.pot < 1 || P.pib / P.pob < 8) return 'Solo países ricos y con peso internacional.'; if (q.rel < 35) return 'Requiere relación ≥ 35.'; if (E.turno - q.ultPrest < 12) return 'Ya te prestaron hace poco.'; return null; },
      run: (E, iso) => { const q = E.mundo.p[iso]; q.ultPrest = E.turno; const sg = q.ali === 'occ' ? 1 : q.ali === 'eje' ? -1 : 0; E.eco.tasaMedia -= (E.eco.tasaMedia - (E.mundo.tasa + 0.5)) * Math.min(0.5, 2.5 / Math.max(1, E.eco.deuda / E.eco.pib * 100)); return aplicar(E, { liquidez: 2.5, deuda: 2.5, alin: 8 * sg, rel: { [iso]: 4 } }); } },
    tratado: { nombre: 'Proponer tratado', grupo: 'diplomacia', conPais: true, pcVar: true, desc: 'Ver tratados disponibles.' },
    romper: { nombre: 'Romper tratado', grupo: 'diplomacia', conPais: true, pc: 2, desc: 'Denuncias un tratado vigente.' },
    guerra: { nombre: 'Declarar la guerra', grupo: 'diplomacia', pc: 10, conPais: true, desc: 'Solo contra un vecino con el que tengas una disputa.',
      cond: (E, iso) => !E.mundo.p[iso].vec ? 'Solo contra países vecinos.' : !E.mundo.p[iso].disp ? 'No hay disputa territorial que lo justifique.' : E.guerra ? 'Ya estás en guerra.' : null,
      run: (E, iso) => { iniciarGuerra(E, iso, true); return { texto: 'Las tropas cruzan la frontera.', chips: [] }; } },
    paz: { nombre: 'Proponer la paz', grupo: 'diplomacia', pc: 4, conPais: true, desc: 'Ofreces negociar el fin de la guerra.',
      cond: (E, iso) => !(E.guerra && E.guerra.con === iso) ? 'No están en guerra.' : null,
      run: (E, iso) => { const G = E.guerra, p = clamp(0.3 + G.frente / 100 + G.turnos / 40, 0.08, 0.9); if (rnd(E) < p) { const res = G.frente > 25 ? 'victoria' : G.frente < -25 ? 'derrota' : 'armisticio'; finGuerra(E, res); return { texto: res === 'armisticio' ? 'Aceptan un armisticio.' : res === 'victoria' ? 'Aceptan tus condiciones.' : 'La paz llega con condiciones duras.', chips: [] }; } return { texto: `${PX[iso].nombre} rechaza negociar (${Math.round(p * 100)}% de probabilidad).`, chips: [] }; } },
  };
  function estadoAccion(E, id, iso) {
    const A = ACCIONES[id]; if (!A) return { ok: false, motivo: '?' };
    if (A.conPais && !iso) return { ok: false, motivo: 'Elige un país.' };
    const k = id + (iso ? ':' + iso : '');
    if (A.enfriar && E.cool[k] != null && E.turno - E.cool[k] < A.enfriar) return { ok: false, motivo: `Disponible en ${A.enfriar - (E.turno - E.cool[k])} trimestre(s).`, pc: A.pc };
    const m = A.cond ? A.cond(E, iso) : null; if (m) return { ok: false, motivo: m, pc: A.pc };
    if (E.pol.pc < (A.pc || 0)) return { ok: false, motivo: 'Falta capital político.', pc: A.pc };
    return { ok: true, pc: A.pc };
  }
  function ejecutar(E, id, iso) {
    const st = estadoAccion(E, id, iso); if (!st.ok) return { ok: false, texto: st.motivo };
    const A = ACCIONES[id]; E.pol.pc -= A.pc || 0; E.cool[id + (iso ? ':' + iso : '')] = E.turno;
    const r = A.run(E, iso) || {};
    noticia(E, `${A.nombre}${iso ? ' — ' + PX[iso].nombre : ''}.${r.texto ? ' ' + r.texto : ''}`, 'decision');
    return { ok: true, texto: r.texto || 'Hecho.', chips: r.chips || [] };
  }

  // tratados
  function probTratado(E, iso, tipo) {
    const T = R.TRATADOS[tipo], q = E.mundo.p[iso], P = PX[iso];
    let req = T.req + P.pot * 6;
    if (q.ali === 'occ' && E.pol.alin < -30) req += 20; if (q.ali === 'eje' && E.pol.alin > 30) req += 20;
    if (tipo === 'alianza' && !DEMO_REG[q.reg] !== !R.TIPOS[E.gob.tipo].demo) req += 10;
    const ex = comp(E, 'exteriores') * 1.5;
    return clamp(1 / (1 + Math.exp(-(q.rel + ex - req) / 9)), 0.02, 0.97);
  }
  function estadoTratado(E, iso, tipo) {
    const T = R.TRATADOS[tipo], q = E.mundo.p[iso], P = PX[iso];
    if (q.tr[tipo] != null) return { ok: false, vigente: true };
    if (E.guerra && E.guerra.con === iso) return { ok: false, motivo: 'En guerra.' };
    if (T.soloVecino && !q.vec) return { ok: false, motivo: 'Solo con vecinos.' };
    if (T.soloDisputa && !q.disp) return { ok: false, motivo: 'No hay disputa de límites.' };
    if (T.minPot && P.pot < T.minPot) return { ok: false, motivo: 'Solo con potencias.' };
    if (T.ricos && P.pib / P.pob < 15) return { ok: false, motivo: 'Solo países ricos dan ayuda.' };
    if (tipo === 'alianza' && E.guerra) return { ok: false, motivo: 'Nadie se alía con un país en guerra.' };
    if (E.cool['tr:' + iso + ':' + tipo] != null && E.turno - E.cool['tr:' + iso + ':' + tipo] < 6) return { ok: false, motivo: 'Lo rechazaron hace poco.' };
    const pr = probTratado(E, iso, tipo);
    if (E.pol.pc < T.pc) return { ok: false, motivo: 'Falta capital político.', prob: pr, pc: T.pc };
    return { ok: true, prob: pr, pc: T.pc };
  }
  function proponerTratado(E, iso, tipo) {
    const st = estadoTratado(E, iso, tipo); if (!st.ok) return { ok: false, texto: st.motivo || 'Ya vigente.' };
    const T = R.TRATADOS[tipo], q = E.mundo.p[iso], P = PX[iso];
    E.pol.pc -= T.pc;
    if (rnd(E) >= st.prob) { E.cool['tr:' + iso + ':' + tipo] = E.turno; q.mod -= 3; noticia(E, `${P.nombre} rechaza el ${T.nombre.toLowerCase()}.`, 'decision'); return { ok: false, texto: `${P.nombre} rechazó la propuesta.` }; }
    q.tr[tipo] = E.turno;
    const F = E.pol.fac;
    if (tipo === 'tlc') { F.empresarios.sat += 4; if (P.exp === 'manufactura') F.sindicatos.sat -= 4; if (P.exp === 'agro') F.campesinos.sat -= 5; }
    if (tipo === 'cooperacion') F.militares.sat += 4;
    if (tipo === 'alianza') { F.militares.sat += 5; E.pol.alinMod += 0; }
    if (tipo === 'limites') { q.disp = false; F.regiones.sat -= 4; F.militares.sat -= 3; E.pol.legitMod += 2; q.mod += 10; }
    if (tipo === 'no_agresion') q.mod += 5;
    for (const f in F) F[f].sat = clamp(F[f].sat, 0, 100);
    noticia(E, `Firmado: ${T.nombre} con ${P.nombre}.`, 'hito');
    return { ok: true, texto: `¡${P.nombre} firma el ${T.nombre.toLowerCase()}!` };
  }
  function romperTratado(E, iso, tipo) {
    const q = E.mundo.p[iso]; if (q.tr[tipo] == null) return { ok: false };
    if (E.pol.pc < 2) return { ok: false, texto: 'Falta capital político.' };
    E.pol.pc -= 2; delete q.tr[tipo]; q.mod -= 20;
    noticia(E, `${E.pais.nombre} denuncia el ${R.TRATADOS[tipo].nombre.toLowerCase()} con ${PX[iso].nombre}.`, 'decision');
    return { ok: true, texto: 'Tratado roto.' };
  }
  function solicitarOrg(E, id) {
    const O = R.ORGANIZACIONES[id]; if (E.orgs[id]) return { ok: false, texto: 'Ya en curso.' };
    const r = reqOrg(E, id); if (!r.ok) return { ok: false, texto: r.faltan.join(' · ') };
    const pc = 2 + O.negocia; if (E.pol.pc < pc) return { ok: false, texto: `Falta capital político (${pc}).` };
    E.pol.pc -= pc; E.orgs[id] = { estado: 'negocia', t: E.turno + O.negocia };
    noticia(E, `${E.pais.nombre} solicita el ingreso a ${O.nombre}.`, 'decision');
    return { ok: true, texto: `Negociación de ingreso: ${O.negocia} trimestres. Debes seguir cumpliendo los requisitos.` };
  }
  function salirOrg(E, id) { if (!E.orgs[id]) return { ok: false }; delete E.orgs[id]; for (const iso in E.mundo.p) if (PX[iso].bloques.includes(id)) E.mundo.p[iso].mod -= 8; noticia(E, `${E.pais.nombre} abandona ${R.ORGANIZACIONES[id].nombre}.`, 'decision'); return { ok: true, texto: 'Has salido.' }; }

  // ---------------- reformas del Estado ----------------
  function costoReforma(E, k, op) {
    const T = R.TIPOS[E.gob.tipo]; let c = 8;
    if (k === 'mandato' || k === 'electoral') c = 10;
    if (k === 'judicial' && op === 'subordinado') c = 12;
    if (k === 'prensa' && op === 'estatal') c = 10;
    return c;
  }
  function reformarInst(E, k, op) {
    if (!opcionesInst(E.gob.tipo, k).includes(op)) return { ok: false, texto: 'No es posible en este régimen.' };
    if (E.gob.inst[k] === op) return { ok: false, texto: 'Ya es así.' };
    if (k === 'territorio' && R.TIPOS[E.gob.tipo].territorial) return { ok: false, texto: 'Fijado por el tipo de Estado.' };
    const c = costoReforma(E, k, op); if (E.pol.pc < c) return { ok: false, texto: `Falta capital político (${c}).` };
    const T = R.TIPOS[E.gob.tipo];
    const antes = R.INSTITUCIONES[k].op[E.gob.inst[k]], desp = R.INSTITUCIONES[k].op[op];
    // en democracia, recortar libertades exige el Congreso y cuesta legitimidad
    if (T.demo && (desp.lib || 0) < (antes.lib || 0)) {
      const ap = (E.pol.escanos || 0) + (E.pol.aprob - 50) * 0.25 - 8;
      if (ap < 50 && rnd(E) > clamp((ap - 35) / 20, 0.05, 0.85)) { E.pol.pc -= c; noticia(E, `El Congreso rechaza la reforma: ${R.INSTITUCIONES[k].nombre}.`, 'crisis'); return { ok: false, texto: 'El Congreso rechazó la reforma.' }; }
      E.pol.legitMod -= ((antes.lib || 0) - (desp.lib || 0)) * 0.5;
    }
    E.pol.pc -= c; E.gob.inst[k] = op;
    if (k === 'mandato' && E.pol.proxElec != null) { /* rige desde la próxima elección */ }
    noticia(E, `Reforma: ${R.INSTITUCIONES[k].nombre} → ${desp.nombre}.`, 'decision');
    return { ok: true, texto: 'Reforma aprobada.' };
  }
  function crearMinisterio(E, m) {
    if (m in E.gob.min) return { ok: false }; if (E.pol.pc < 3) return { ok: false, texto: 'Falta capital político (3).' };
    E.pol.pc -= 3; E.gob.min[m] = null; noticia(E, `Se crea el Ministerio de ${R.MINISTERIOS[m].nombre}.`, 'decision');
    return { ok: true, texto: 'Ministerio creado. Nombra a su titular.' };
  }
  function eliminarMinisterio(E, m) {
    if (!(m in E.gob.min) || R.MINISTERIOS[m].obligatorio) return { ok: false, texto: 'No se puede eliminar.' };
    if (E.pol.pc < 2) return { ok: false, texto: 'Falta capital político (2).' };
    E.pol.pc -= 2; const mi = E.gob.min[m]; delete E.gob.min[m];
    const M = R.MINISTERIOS[m]; if (M.fac) for (const f in M.fac) E.pol.fac[f].sat = clamp(E.pol.fac[f].sat - M.fac[f], 0, 100);
    if (mi && mi.fac) E.pol.fac[mi.fac].sat = clamp(E.pol.fac[mi.fac].sat - 4, 0, 100);
    noticia(E, `Se suprime el Ministerio de ${M.nombre}.`, 'decision'); return { ok: true, texto: 'Ministerio suprimido.' };
  }
  function candidatosJuego(E, m) { E.cand = E.cand || {}; if (!E.cand[m] || E.cand[m].t !== E.turno) E.cand[m] = { t: E.turno, l: candidatos(E, m, 3) }; return E.cand[m].l; }
  function nombrarMinistro(E, m, idx) {
    if (!(m in E.gob.min)) return { ok: false };
    const costo = E.gob.min[m] ? 2 : 1; if (E.pol.pc < costo) return { ok: false, texto: 'Falta capital político.' };
    const c = candidatosJuego(E, m)[idx]; if (!c) return { ok: false };
    const ant = E.gob.min[m];
    if (ant && ant.fac) E.pol.fac[ant.fac].sat = clamp(E.pol.fac[ant.fac].sat - 5, 0, 100);
    if (c.fac) E.pol.fac[c.fac].sat = clamp(E.pol.fac[c.fac].sat + 5, 0, 100);
    E.pol.pc -= costo; E.gob.min[m] = Object.assign({}, c, { desde: E.turno }); delete E.cand[m];
    noticia(E, `${c.nombre} asume en ${R.MINISTERIOS[m].nombre}.`, 'decision');
    return { ok: true, texto: `${c.nombre} jura como ministro/a.` };
  }

  // cambio de régimen (reforma constitucional profunda, o por evento)
  function costoCambio(E, tipo) {
    const de = R.TIPOS[E.gob.tipo], a = R.TIPOS[tipo];
    if (de.demo && !a.demo) return 25; if (!de.demo && a.demo) return 15; return 18;
  }
  function cambiarRegimen(E, tipo, forzado) {
    if (tipo === E.gob.tipo) return { ok: false };
    const de = R.TIPOS[E.gob.tipo], a = R.TIPOS[tipo];
    if (!forzado) {
      const c = costoCambio(E, tipo); if (E.pol.pc < c) return { ok: false, texto: `Falta capital político (${c}).` };
      E.pol.pc -= c;
      if (de.demo && !a.demo) { // autogolpe
        const p = clamp(0.25 + (E.pol.fac.militares.sat - 50) * 0.012 + (E.pol.aprob - 50) * 0.006, 0.05, 0.85);
        if (rnd(E) > p) { terminar(E, 'autogolpe', 'Autogolpe fallido', 'Intentaste disolver la democracia. Las Fuerzas Armadas se negaron a seguirte y el Congreso te destituyó.'); return { ok: false, texto: 'El autogolpe fracasó.' }; }
        E.pol.legitMod -= 15; E.soc.prestigio -= 15; relAplicar(E, 'occ', -25, {});
        for (const f of ['estudiantes', 'clase_media']) E.pol.fac[f].sat -= 12;
      }
      if (!de.demo && a.demo) { E.pol.legitMod += 12; E.soc.prestigio += 10; relAplicar(E, 'occ', 15, {}); E.pol.fac.militares.sat -= 8; }
    }
    E.gob.tipo = tipo; E.gob.inst = sanearInst(tipo, E.gob.inst);
    const s = estaticos(E);
    if (a.demo) { if (E.pol.escanos == null) E.pol.escanos = clamp(50 + (E.pol.aprob - 50) * 0.5 * s.amplif, 30, 70); if (E.pol.proxElec == null) E.pol.proxElec = E.turno + (de.demo ? s.mandato * 4 : 4); }
    else { E.pol.escanos = null; E.pol.proxElec = null; }
    E.pol.proxCongreso = tipo === 'partido_unico' ? E.turno + 20 : null;
    for (const f in E.pol.fac) E.pol.fac[f].sat = clamp(E.pol.fac[f].sat, 0, 100);
    noticia(E, `Nueva Constitución: ${E.pais.nombre} es ahora ${a.nombre.toLowerCase()}.`, 'hito');
    return { ok: true, texto: `${E.pais.nombre} es ahora ${a.nombre.toLowerCase()}.` };
  }

  // ---------------- final y legado ----------------
  function terminar(E, tipo, titulo, texto) { if (E.fin) return; E.fin = { tipo, titulo, texto, turno: E.turno, legado: null }; E.fin.legado = legado(E); noticia(E, titulo + '. ' + texto, 'crisis'); }
  function idhDe(E) { const pibpc = E.eco.pib / E.eco.pob * 1000; const ingreso = clamp(Math.log10(pibpc / 500) / Math.log10(150) * 100, 0, 100); return (E.soc.salud + E.soc.educacion + ingreso) / 3; }
  // El legado mide cuánto mejoró el país respecto de cómo lo recibiste, y cómo lo dejas.
  function legado(E) {
    const s = E.soc, pibpc = E.eco.pib / E.eco.pob * 1000, idh = idhDe(E);
    const ini = E.inicio || { idh, pibpc };
    const frac = clamp(E.turno / E.durTurnos, 0, 1), deuda = E.eco.deuda / E.eco.pib * 100;
    let pts = 30 + clamp((idh - ini.idh) * 1.4, -20, 25) + clamp(Math.log2(pibpc / ini.pibpc) * 12, -15, 20)
      + (s.libertad - 50) * 0.12 + (E.pol.est - 50) * 0.15 + (s.prestigio - 50) * 0.1 + (40 - s.corr) * 0.15 + (45 - s.desig) * 0.1
      + frac * 12 - Math.max(0, deuda - 80) * 0.12 - Math.max(0, E.eco.infl - 10) * 0.1;
    const tipo = E.fin ? E.fin.tipo : null;
    if (tipo === 'golpe' || tipo === 'exilio') pts -= 12; if (tipo === 'revolucion') pts -= 18; if (tipo === 'derrota') pts += 3; if (tipo === 'renuncia') pts -= 4; if (tipo === 'autogolpe') pts -= 15;
    pts = Math.round(clamp(pts, 0, 100));
    const rango = pts >= 75 ? 'Padre/Madre de la Patria' : pts >= 65 ? 'Gran estadista' : pts >= 55 ? 'Gobernante respetable' : pts >= 45 ? 'Gestión olvidable' : pts >= 32 ? 'Mal gobierno' : 'Desastre nacional';
    const pcs = PAISES.map(p => p.pib / p.pob * 1000).concat([pibpc]).sort((a, b) => b - a);
    return { puntos: Math.round(pts), rango, idh: Math.round(idh), idh0: Math.round(ini.idh), pibpc0: ini.pibpc, anios: Math.round(E.turno / 4 * 10) / 10, puestoPibpc: pcs.indexOf(pibpc) + 1, totalPaises: pcs.length };
  }

  // ---------------- registro ----------------
  function noticia(E, texto, tipo, titulo) { E.noticias.unshift({ t: E.turno, texto, tipo: tipo || 'info', titulo }); if (E.noticias.length > 120) E.noticias.length = 120; }
  function historial(E) {
    E.hist.push({ t: E.turno, pib: E.eco.pib, crec: E.eco.crec, infl: E.eco.infl, desemp: E.eco.desemp, deuda: E.eco.deuda / E.eco.pib * 100, def: E.eco.deficit, aprob: E.pol.aprobVista, est: E.pol.est, legit: E.pol.legit, prot: E.pol.prot, corr: E.soc.corr, salud: E.soc.salud, educ: E.soc.educacion });
    if (E.hist.length > 400) E.hist.shift();
  }

  function rel(E, iso) { return E.mundo.p[iso].rel; }

  return {
    R, PAISES, PX, POTENCIAS, NOMBRE_REG, DEMO_REG, ACCIONES, PERFILES,
    rnd, gauss, clamp, fmt, persona, nombrePais, capitalAleatoria, paisesDe, sugerirUbicacion, candidatos, instPorDefecto, sanearInst, opcionesInst,
    crearPartida, estaticos, avanzar, fecha, finanzas, comercio, efArea, objetivosSoc, objetivosFac, poderRel, pesos, riesgoGolpe, milDe, legado, pronostico,
    verEvento, resolver, aplicar, chips, helpers, iniciarSuceso,
    estadoLey, aprobarLey, derogarLey, fijarPresupuesto, reaccionPrevista, desgasteDe,
    reqOrg, orgsDisponibles, solicitarOrg, salirOrg,
    estadoAccion, ejecutar, estadoTratado, proponerTratado, romperTratado, probTratado,
    reformarInst, costoReforma, crearMinisterio, eliminarMinisterio, candidatosJuego, nombrarMinistro, cambiarRegimen, costoCambio, rel,
  };
})();
if (typeof module !== 'undefined') module.exports = NUCLEO;
