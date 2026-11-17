// TURBO 40 — tour roguelike: mapa de rutas, dinero, mejoras, objetos, eventos y clasificación general.
(function (G) {
  'use strict';
  const T = G.T40 || (typeof require !== 'undefined' ? require('./nucleo.js') : null);
  const E = G.ETAPAS || (typeof require !== 'undefined' ? require('./etapas.js') : null);
  const TOUR = {};

  TOUR.UPGRADES = [
    { id: 'motor', n: 'MOTOR', d: '+4% VELOCIDAD PUNTA', cost: [400, 700, 1100] },
    { id: 'turbo', n: 'TURBO', d: '+10% ACELERACIÓN', cost: [320, 560, 900] },
    { id: 'gomas', n: 'NEUMÁTICOS', d: '+6% AGARRE', cost: [300, 520, 840] },
    { id: 'blindaje', n: 'BLINDAJE', d: '-15% DAÑO RECIBIDO', cost: [260, 460, 740] },
    { id: 'susp', n: 'SUSPENSIÓN', d: '-25% CASTIGO FUERA DE PISTA', cost: [200, 360, 560] },
    { id: 'frenos', n: 'FRENOS', d: '+12% FRENADA', cost: [180, 320, 520] },
  ];
  TOUR.ITEMS = {
    cinta: { n: 'CINTA', d: 'CHASIS +12', fx: { chasis: 12 }, precio: 40, w: 22 },
    soldadora: { n: 'SOLDADORA', d: 'CHASIS +35', fx: { chasis: 35 }, precio: 110, w: 10 },
    bujias: { n: 'BUJÍAS', d: 'MOTOR +15', fx: { motor: 15 }, precio: 50, w: 18 },
    motorrec: { n: 'MOTOR REC.', d: 'MOTOR +50', fx: { motor: 50 }, precio: 160, w: 6 },
    parche: { n: 'PARCHES', d: 'GOMAS +20', fx: { gomas: 20 }, precio: 35, w: 22 },
    gomasnuevas: { n: 'GOMAS NUEVAS', d: 'GOMAS AL 100', fx: { gomas: 100 }, precio: 120, w: 8 },
    kit: { n: 'KIT COMPLETO', d: 'TODO +25', fx: { chasis: 25, motor: 25, gomas: 25 }, precio: 150, w: 6 },
  };
  TOUR.PERKS = [
    { id: 'iman', n: 'IMÁN', d: 'ATRAES LOS OBJETOS CERCANOS' },
    { id: 'seguro', n: 'SEGURO', d: 'SI TE DESTRUYES, SIGUES UNA VEZ CON 30 DE CHASIS' },
    { id: 'sponsor', n: 'PATROCINIO', d: '+25% DE DINERO POR ETAPA' },
    { id: 'nitro', n: 'NITRO DE SERIE', d: 'LARGAS CADA ETAPA CON 3 S DE NITRO' },
    { id: 'ligero', n: 'CHASIS LIGERO', d: '+6% VELOCIDAD, PERO +20% DE DAÑO' },
    { id: 'mecanico', n: 'MECÁNICO', d: '+8 A TODO AL TERMINAR CADA ETAPA' },
    { id: 'radar', n: 'RADAR', d: 'VES LOS OBJETOS EN EL MINIMAPA' },
    { id: 'mochila', n: 'MOCHILA', d: '+3 ESPACIOS Y UN OBJETO DE REGALO' },
  ];
  TOUR.NODOS = {
    carrera: { n: 'CARRERA', d: 'ETAPA DE VELOCIDAD' },
    rally: { n: 'ACCIDENTADA', d: 'BARRILES Y ACEITE EN LA PISTA: MÁS RIESGO, MÁS PREMIO' },
    taller: { n: 'TALLER', d: 'REPARACIONES, MEJORAS Y REPUESTOS' },
    evento: { n: 'EVENTO', d: '¿QUIÉN SABE?' },
    campamento: { n: 'CAMPAMENTO', d: 'DESCANSO: REPARA O BUSCA REPUESTOS' },
    jefe: { n: 'GRAN ETAPA', d: 'ETAPA LARGA CONTRA RIVALES MÁS RÁPIDOS' },
  };
  // pinturas del F40: la primera viene de serie, las demás se encuentran en la pista
  TOUR.COLECCION = [
    { id: 'rojo', n: 'ROJO CLÁSICO', body: '#e8202a', stripe: '#e8202a' },
    { id: 'amarillo', n: 'AMARILLO MÓDENA', body: '#f8d020', stripe: '#202020' },
    { id: 'celeste', n: 'CELESTE Y NARANJA', body: '#80c8f0', stripe: '#ff8020' },
    { id: 'verde', n: 'VERDE INGLÉS', body: '#1e6a3a', stripe: '#f0e0a0' },
    { id: 'negro', n: 'NEGRO MEDIANOCHE', body: '#26262e', stripe: '#d02020' },
    { id: 'blanco', n: 'BLANCO PERLA', body: '#f0f0f0', stripe: '#2050e0' },
    { id: 'plata', n: 'FLECHA DE PLATA', body: '#b8bcc8', stripe: '#383848' },
    { id: 'papaya', n: 'NARANJA PAPAYA', body: '#ff8818', stripe: '#2080ff' },
    { id: 'rosa', n: 'ROSA FLAMENCO', body: '#ff70b0', stripe: '#ffffff' },
    { id: 'neon', n: 'MORADO NEÓN', body: '#8030e0', stripe: '#20f0e0' },
    { id: 'patrulla', n: 'PATRULLA', body: '#f0f0f0', stripe: '#202028' },
    { id: 'oro', n: 'DORADO 24K', body: '#e8b830', stripe: '#fff0a0' },
  ];
  const RIVALS = [['BLAZE', 0.97], ['VIPER', 0.955], ['NOVA', 0.94], ['RICO', 0.93], ['AKIRA', 0.915], ['LUNA', 0.9], ['DUKE', 0.885], ['ZED', 0.87], ['MIKA', 0.85]];
  const PRIZE = [280, 220, 180, 150, 125, 105, 90, 75, 60, 50];
  const AIBASE = [0.77, 0.83, 0.89, 0.95];

  const R0 = T.rng;
  TOUR.newRun = function (seed, owned) {
    seed = seed >>> 0;
    const R = R0(seed);
    const run = {
      seed, R, money: 150, dmg: { motor: 100, gomas: 100, chasis: 100 },
      up: { motor: 0, turbo: 0, gomas: 0, blindaje: 0, susp: 0, frenos: 0 },
      items: ['cinta', 'parche'], maxItems: 5, perks: [], mods: { vmax: 0 },
      region: 0, row: -1, col: 0, rivals: RIVALS.map(([name, skill], i) => ({ name, skill, color: i + 1 })),
      gc: {}, stage: 0, bet: null, log: [], over: false, won: false, seguroUsado: false, owned: (owned || ['rojo']).slice(),
    };
    run.gc.p = 0; run.rivals.forEach((r, i) => run.gc[i] = 0);
    run.map = E.REGIONES.map((reg, ri) => genRegion(R, ri));
    return run;
  };

  function pickW(R, list) { const tot = list.reduce((a, b) => a + b[1], 0); let r = R() * tot; for (const [v, w] of list) if ((r -= w) < 0) return v; return list[0][0]; }

  function genRegion(R, ri) {
    const rows = [];
    for (let r = 0; r < 3; r++) {
      const n = 2 + (R() < 0.55 ? 1 : 0);
      const row = [];
      for (let i = 0; i < n; i++) {
        let type;
        if (r === 0) type = pickW(R, [['carrera', 5], ['rally', 3]]);
        else type = pickW(R, [['carrera', 4], ['rally', 3], ['taller', 2], ['evento', 2], ['campamento', 2]]);
        row.push({ type, seed: Math.floor(R() * 1e9) });
      }
      rows.push(row);
    }
    // al menos un taller en la región (filas 1 o 2), y al menos una etapa por fila
    if (!rows.slice(1).some(r => r.some(n => n.type === 'taller'))) rows[1 + Math.floor(R() * 2)][0].type = 'taller';
    rows.forEach(r => { if (!r.some(n => n.type === 'carrera' || n.type === 'rally')) r[r.length - 1].type = 'carrera'; });
    rows.push([{ type: 'jefe', seed: Math.floor(R() * 1e9) }]);
    // conexiones: cada nodo conecta con los de la fila siguiente cercanos
    for (let r = 0; r < rows.length - 1; r++) {
      const a = rows[r], b = rows[r + 1];
      a.forEach((nd, i) => {
        const fi = a.length > 1 ? i / (a.length - 1) : 0.5;
        nd.next = [];
        b.forEach((_, j) => { const fj = b.length > 1 ? j / (b.length - 1) : 0.5; if (Math.abs(fi - fj) <= 0.51) nd.next.push(j); });
      });
      // asegurar que todos los de la fila siguiente tengan entrada
      b.forEach((_, j) => { if (!a.some(nd => nd.next.includes(j))) a[Math.min(a.length - 1, Math.round(j / Math.max(1, b.length - 1) * (a.length - 1)))].next.push(j); });
    }
    // desde cada nodo de la fila 1 tiene que haber al menos una etapa alcanzable en la fila 2
    const isStage = n => n.type === 'carrera' || n.type === 'rally';
    rows[1].forEach(nd => { if (!nd.next.some(j => isStage(rows[2][j]))) rows[2][nd.next[0]].type = 'carrera'; });
    return { rows, ri };
  }

  TOUR.region = run => E.REGIONES[run.region];
  // nodos alcanzables desde la posición actual
  TOUR.options = function (run) {
    const reg = run.map[run.region];
    if (run.row < 0) return reg.rows[0].map((n, i) => i);
    const cur = reg.rows[run.row][run.col];
    return cur.next ? cur.next.slice() : [];
  };
  TOUR.go = function (run, col) {
    run.row++; run.col = col;
    const node = run.map[run.region].rows[run.row][col];
    node.visited = true;
    return node;
  };
  TOUR.node = run => run.row < 0 ? null : run.map[run.region].rows[run.row][run.col];

  TOUR.stats = function (run) {
    const u = run.up, has = id => run.perks.includes(id);
    return {
      vmax: 1 + 0.04 * u.motor + (has('ligero') ? 0.06 : 0) + run.mods.vmax,
      acc: 1 + 0.10 * u.turbo,
      grip: 1 + 0.06 * u.gomas,
      brake: 1 + 0.12 * u.frenos,
      off: 0.25 * u.susp,
      armor: 0.15 * u.blindaje,
      fragil: has('ligero') ? 0.2 : 0,
      magnet: has('iman') ? 1 : 0,
      nitroStart: has('nitro') ? 3 : 0,
    };
  };

  TOUR.stageParams = function (run, node) {
    const reg = E.REGIONES[run.region];
    const tipo = node.type === 'jefe' ? 'jefe' : node.type;
    const X = R0(node.seed ^ 0x5bd1e995), LL = [0.35, 0.35, 0.25, 0.08];
    const falta = TOUR.COLECCION.filter(c => !run.owned.includes(c.id));
    const lluvia = X() < LL[run.region], amarilla = X() < 0.5, colR = X();
    return {
      lluvia, amarilla, coleccion: falta.length && colR < 0.35 ? falta[Math.floor(X() * falta.length)].id : null,
      seed: node.seed, region: reg.id, tema: reg.tema, tipo,
      largo: tipo === 'jefe' ? 30000 : 24500,
      aiBase: AIBASE[run.region] + (tipo === 'jefe' ? 0.015 : 0),
    };
  };
  // construye la etapa y la carrera lista para largar
  TOUR.buildRace = function (run, node) {
    const sp = TOUR.stageParams(run, node);
    const gen = E.generar(sp.seed, { region: sp.region, tipo: sp.tipo === 'jefe' ? 'carrera' : sp.tipo, largo: sp.largo });
    const trk = T.buildStage(gen, { tema: sp.tema, tipo: sp.tipo, seed: sp.seed, lluvia: sp.lluvia, amarilla: sp.amarilla, coleccion: sp.coleccion });
    // orden de largada: según la general (el líder adelante); en la primera etapa, el jugador último
    let order;
    if (run.stage === 0) order = run.rivals.map((r, i) => i).concat([-1]);
    else order = ['p'].concat(run.rivals.map((r, i) => i)).sort((a, b) => run.gc[a] - run.gc[b]).map(k => k === 'p' ? -1 : k);
    const race = T.newRace(trk, { rivals: run.rivals, order, stats: TOUR.stats(run), dmg: run.dmg, aiBase: sp.aiBase, seed: sp.seed });
    race.params = sp;
    return race;
  };

  TOUR.randomItem = function (R) { return pickW(R, Object.keys(TOUR.ITEMS).map(k => [k, TOUR.ITEMS[k].w])); };
  TOUR.addItem = function (run, id) { if (run.items.length >= run.maxItems) return false; run.items.push(id); return true; };
  TOUR.useItem = function (run, idx) {
    const id = run.items[idx]; if (!id) return null;
    const fx = TOUR.ITEMS[id].fx;
    for (const k in fx) run.dmg[k] = Math.min(100, run.dmg[k] + fx[k]);
    run.items.splice(idx, 1);
    return id;
  };

  // al terminar una etapa: premios, general, apuesta
  TOUR.finishStage = function (run, race) {
    const res = T.results(race);
    const pl = race.player;
    const pos = res.findIndex(r => r.car === pl) + 1;
    const sp = race.params;
    const out = { pos, lines: [], money: 0, dead: pl.dead, items: [] };
    if (pl.dead && run.perks.includes('seguro') && !run.seguroUsado) {
      run.seguroUsado = true; pl.dead = false; run.dmg.chasis = 30; out.dead = false;
      out.lines.push(['¡EL SEGURO TE SALVÓ!', 0]);
    }
    if (out.dead) { run.over = true; return out; }
    for (const r of res) { const key = r.car.isPlayer ? 'p' : r.car.rival; run.gc[key] += r.time; }
    const mult = (sp.tipo === 'rally' ? 1.3 : sp.tipo === 'jefe' ? 1.7 : 1) * (1 + 0.1 * run.region) * (run.perks.includes('sponsor') ? 1.25 : 1);
    const prize = Math.round(PRIZE[pos - 1] * mult / 5) * 5;
    out.lines.push(['PREMIO ' + pos + '° PUESTO', prize]);
    if (race.cash) out.lines.push(['DINERO RECOGIDO', race.cash]);
    if (race.hurt.chasis < 2 && !race.timeout) out.lines.push(['SIN UN RASGUÑO', 80]);
    if (race.timeout) out.lines.push(['FUERA DE TIEMPO', 0]);
    if (race.fines) out.lines.push(['MULTAS POR SUSTOS', -race.fines]);
    if (race.penalty) out.lines.push(['PENALIZACIÓN +' + race.penalty + ' S', 0]);
    if (race.collected) { out.collected = race.collected; if (!run.owned.includes(race.collected)) run.owned.push(race.collected); }
    if (run.bet) {
      const rv = res.findIndex(r => r.car.rival === run.bet.rival) + 1;
      if (pos < rv) out.lines.push(['APUESTA GANADA A ' + run.rivals[run.bet.rival].name, run.bet.win]);
      else out.lines.push(['APUESTA PERDIDA CON ' + run.rivals[run.bet.rival].name, -run.bet.lose]);
      run.bet = null;
    }
    for (const g of race.got) { const id = TOUR.randomItem(run.R); if (TOUR.addItem(run, id)) out.items.push(id); }
    if (run.perks.includes('mecanico')) for (const k in run.dmg) run.dmg[k] = Math.min(100, run.dmg[k] + 8);
    out.money = out.lines.reduce((a, l) => a + l[1], 0);
    run.money = Math.max(0, run.money + out.money);
    run.stage++;
    run.log.push({ region: run.region, tipo: sp.tipo, pos, time: res.find(r => r.car === pl).time });
    return out;
  };

  TOUR.gcTable = function (run) {
    return ['p'].concat(run.rivals.map((r, i) => i)).map(k => ({
      key: k, name: k === 'p' ? 'TÚ' : run.rivals[k].name, color: k === 'p' ? 0 : run.rivals[k].color, time: run.gc[k],
    })).sort((a, b) => a.time - b.time);
  };
  TOUR.gcPos = run => TOUR.gcTable(run).findIndex(r => r.key === 'p') + 1;

  // terminar la región tras la gran etapa
  TOUR.nextRegion = function (run) {
    if (run.region >= E.REGIONES.length - 1) { run.won = true; run.over = true; return false; }
    run.region++; run.row = -1; run.col = 0;
    return true;
  };

  // ---------- taller ----------
  TOUR.repairCost = (run, part) => Math.ceil((100 - run.dmg[part]) * (part === 'gomas' ? 2 : 3));
  TOUR.repair = function (run, part) {
    const c = TOUR.repairCost(run, part); if (c <= 0 || run.money < c) return false;
    run.money -= c; run.dmg[part] = 100; return true;
  };
  TOUR.upCost = (run, id) => { const u = TOUR.UPGRADES.find(x => x.id === id), lv = run.up[id]; return lv >= 3 ? null : u.cost[lv]; };
  TOUR.buyUp = function (run, id) {
    const c = TOUR.upCost(run, id); if (c == null || run.money < c) return false;
    run.money -= c; run.up[id]++; return true;
  };
  TOUR.stock = function (run) { const R = run.R, s = []; while (s.length < 3) { const id = TOUR.randomItem(R); if (!s.includes(id)) s.push(id); } return s; };
  TOUR.buyItem = function (run, id) {
    const p = TOUR.ITEMS[id].precio; if (run.money < p || run.items.length >= run.maxItems) return false;
    run.money -= p; run.items.push(id); return true;
  };

  // ---------- ventajas tras la gran etapa ----------
  TOUR.perkChoices = function (run) {
    const pool = TOUR.PERKS.filter(p => !run.perks.includes(p.id));
    const R = run.R, out = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(R() * pool.length), 1)[0]);
    return out;
  };
  TOUR.takePerk = function (run, id) {
    run.perks.push(id);
    if (id === 'mochila') { run.maxItems += 3; TOUR.addItem(run, TOUR.randomItem(run.R)); }
  };

  // ---------- eventos ----------
  const it = id => TOUR.ITEMS[id].n;
  TOUR.EVENTOS = [
    {
      t: 'MECÁNICO DE RUTA', d: 'UN MECÁNICO AL COSTADO DEL CAMINO OFRECE REVISAR TU MOTOR.',
      ops: [
        { t: 'PAGAR $90 (MOTOR +40)', ok: r => r.money >= 90, fx: r => { r.money -= 90; r.dmg.motor = Math.min(100, r.dmg.motor + 40); return 'EL MOTOR RONRONEA COMO NUEVO.'; } },
        { t: 'SEGUIR DE LARGO', fx: () => 'LE TOCAS BOCINA Y SIGUES.' },
      ],
    },
    {
      t: 'AUTO ABANDONADO', d: 'HAY UN AUTO ABANDONADO EN LA BANQUINA. PODRÍAS SACARLE REPUESTOS.',
      ops: [
        { t: 'DESARMARLO (GOMAS -10)', fx: r => { r.dmg.gomas = Math.max(5, r.dmg.gomas - 10); const id = TOUR.randomItem(r.R); return TOUR.addItem(r, id) ? 'CONSIGUES: ' + it(id) + '.' : 'NO TE ENTRA NADA MÁS EN LA MOCHILA.'; } },
        { t: 'NO TOCARLO', fx: () => 'MEJOR NO METERSE EN LÍOS.' },
      ],
    },
    {
      t: 'LA APUESTA', d: 'UN RIVAL TE DESAFÍA: SI LE GANAS EN LA PRÓXIMA ETAPA COBRAS $250. SI PIERDES, PAGAS $120.',
      ops: [
        { t: 'ACEPTAR', fx: r => { const k = Math.floor(r.R() * 4); r.bet = { rival: k, win: 250, lose: 120 }; return 'TRATO HECHO CON ' + r.rivals[k].name + '.'; } },
        { t: 'RECHAZAR', fx: () => 'NO HAY APUESTA.' },
      ],
    },
    {
      t: 'TORMENTA DE ARENA', d: 'UNA TORMENTA TE SORPRENDE EN EL ENLACE ENTRE ETAPAS.',
      ops: [
        { t: 'ESPERAR (+10 S EN LA GENERAL)', fx: r => { r.gc.p += 10; return 'PIERDES TIEMPO, PERO EL AUTO ESTÁ ENTERO.'; } },
        { t: 'ATRAVESARLA (MOTOR -18)', fx: r => { r.dmg.motor = Math.max(5, r.dmg.motor - 18); return 'LA ARENA SE METE EN EL FILTRO DE AIRE.'; } },
      ],
    },
    {
      t: 'MERCADO NEGRO', d: 'UN VENDEDOR SOSPECHOSO OFRECE UNA CAJA CERRADA.',
      ops: [
        { t: 'COMPRAR $70 (2 OBJETOS)', ok: r => r.money >= 70, fx: r => { r.money -= 70; const a = [TOUR.randomItem(r.R), TOUR.randomItem(r.R)].filter(id => TOUR.addItem(r, id)); return a.length ? 'ADENTRO HAY: ' + a.map(it).join(' Y ') + '.' : 'NO TIENES LUGAR. LA CAJA SE QUEDA EN EL CAMINO.'; } },
        { t: 'NO GRACIAS', fx: () => 'EL VENDEDOR DESAPARECE EN LA NOCHE.' },
      ],
    },
    {
      t: 'PATROCINADOR', d: 'UNA MARCA DE GASEOSAS QUIERE PONER UN ALERÓN GIGANTE CON SU LOGO.',
      ops: [
        { t: 'ACEPTAR (+$200, -2% VEL.)', fx: r => { r.money += 200; r.mods.vmax -= 0.02; return 'COBRAS. EL ALERÓN FRENA UN POCO.'; } },
        { t: 'RECHAZAR', fx: () => 'TU AUTO SIGUE SIENDO TUYO.' },
      ],
    },
    {
      t: 'ATAJO', d: 'UN LUGAREÑO TE MUESTRA UN ATAJO POR UN CAUCE SECO.',
      ops: [
        { t: 'TOMARLO (-12 S, GOMAS -20)', fx: r => { r.gc.p -= 12; r.dmg.gomas = Math.max(5, r.dmg.gomas - 20); return 'GANAS TIEMPO EN LA GENERAL. LAS GOMAS SUFREN.'; } },
        { t: 'IR POR LA RUTA', fx: () => 'SIN SORPRESAS.' },
      ],
    },
    {
      t: 'FANÁTICOS', d: 'UN GRUPO DE FANÁTICOS RODEA TU AUTO EN EL PUEBLO.',
      ops: [
        { t: 'DEJAR QUE AYUDEN (CHASIS +15)', fx: r => { r.dmg.chasis = Math.min(100, r.dmg.chasis + 15); return 'ENDEREZAN LA CHAPA A MARTILLAZOS.'; } },
        { t: 'FIRMAR AUTÓGRAFOS (+$70)', fx: r => { r.money += 70; return 'VENDES FOTOS FIRMADAS.'; } },
      ],
    },
    {
      t: 'CHATARRERÍA', d: 'UNA CHATARRERÍA COMPRA REPUESTOS USADOS A BUEN PRECIO.',
      ops: [
        { t: 'VENDER UN OBJETO (+$80)', ok: r => r.items.length > 0, fx: r => { const id = r.items.shift(); r.money += 80; return 'VENDES ' + it(id) + '.'; } },
        { t: 'SEGUIR', fx: () => 'NADA PARA VENDER HOY.' },
      ],
    },
  ];
  TOUR.randomEvent = function (run) {
    const last = run.lastEv;
    let k; do { k = Math.floor(run.R() * TOUR.EVENTOS.length); } while (k === last && TOUR.EVENTOS.length > 1);
    run.lastEv = k;
    return TOUR.EVENTOS[k];
  };

  TOUR.camp = [
    { t: 'REPARAR CHASIS (+35)', fx: r => { r.dmg.chasis = Math.min(100, r.dmg.chasis + 35); return 'SOLDADURA DE CAMPAÑA.'; } },
    { t: 'AJUSTAR MOTOR (+35)', fx: r => { r.dmg.motor = Math.min(100, r.dmg.motor + 35); return 'LIMPIAS FILTROS Y BUJÍAS.'; } },
    { t: 'CAMBIAR GOMAS (+50)', fx: r => { r.dmg.gomas = Math.min(100, r.dmg.gomas + 50); return 'ROTAS LAS GOMAS Y PARCHAS.'; } },
    { t: 'BUSCAR REPUESTOS', fx: r => { const id = TOUR.randomItem(r.R); return TOUR.addItem(r, id) ? 'ENCUENTRAS: ' + it(id) + '.' : 'NO TE ENTRA NADA MÁS EN LA MOCHILA.'; } },
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = TOUR;
  else G.TOUR = TOUR;
})(typeof window !== 'undefined' ? window : globalThis);
