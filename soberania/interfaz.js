// SOBERANÍA — interfaz. Lee y modifica el estado solo a través de NUCLEO.
(function () {
  const N = NUCLEO, R = N.R;
  const CLAVE = 'soberania-partida';
  const app = document.getElementById('app');
  const U = { E: null, vista: 'inicio', paso: 0, cfg: null, cands: {}, tab: 'despacho', sel: null, filtro: '', zoom: 'region', resultado: null, minAbierto: null, antes: null, resumen: null, verFinal: true };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (x, d) => N.fmt(x, d || 0);
  const sg = (x, d) => (x > 0 ? '+' : x < 0 ? '−' : '') + fmt(Math.abs(x), d);
  const PALETA = ['#c8102e', '#8a1538', '#ff8200', '#f4c430', '#007a3d', '#00a3e0', '#0072ce', '#1d3c78', '#5b2c6f', '#7b3f00', '#f2f2f2', '#111111'];
  const BANDERAS = ['h3', 'v3', 'disco', 'cruz', 'diag', 'tri', 'estrella', 'h2'];
  const DESEOS = { militares: 'Gasto en defensa, orden y estabilidad', empresarios: 'Impuestos bajos, crecimiento, poca inflación', sindicatos: 'Empleo, gasto social, buenos salarios', campesinos: 'Buenos precios agrícolas, caminos, subsidios', clase_media: 'Seguridad, precios estables, salud y educación, honestidad', religiosos: 'Valores tradicionales y orden', estudiantes: 'Educación, libertades y empleo joven', regiones: 'Infraestructura y autonomía' };

  // ---------------- utilidades ----------------
  let avisoT = null;
  function aviso(t) { const el = document.getElementById('aviso'); el.textContent = t; el.hidden = false; clearTimeout(avisoT); avisoT = setTimeout(() => (el.hidden = true), 3600); }
  function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(U.E)); } catch (e) { /* sin almacenamiento */ } }
  function cargar() { try { const s = localStorage.getItem(CLAVE); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function borrar() { try { localStorage.removeItem(CLAVE); } catch (e) { } }
  function fechaTxt(E, t) { const f = N.fecha(E, t); return `T${f.trim} · ${f.anio}`; }
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function pips(n, max) { max = max || 5; let s = ''; for (let i = 1; i <= max; i++) s += i <= n ? '●' : '<span class="v">●</span>'; return `<span class="pips">${s}</span>`; }
  function chipsHTML(ch) {
    return `<div class="efs">${ch.map(c => { const cls = c.t === 'Probabilidad' ? 'prob' : c.bueno == null ? 'neutro' : c.bueno ? 'bien' : 'mal'; const val = c.txt != null ? c.txt : (c.v ? sg(c.v, Math.abs(c.v) < 1 ? 1 : 0) : ''); return `<span class="ef ${cls}">${esc(c.t)}${val ? ' ' + esc(val) : ''}</span>`; }).join('')}</div>`;
  }
  function colorRel(r) {
    const t = Math.max(-1, Math.min(1, r / 70));
    const a = [180, 71, 58], z = [190, 184, 172], b = [43, 111, 143];
    const m = t < 0 ? a : b, k = Math.abs(t);
    return `rgb(${Math.round(z[0] + (m[0] - z[0]) * k)},${Math.round(z[1] + (m[1] - z[1]) * k)},${Math.round(z[2] + (m[2] - z[2]) * k)})`;
  }
  function relBar(r) { const w = Math.abs(r) / 2; return `<div class="relbar"><i style="${r >= 0 ? 'left:50%' : `left:${50 - w}%`};width:${w}%;background:${colorRel(r)}"></i></div>`; }

  // ---------------- bandera ----------------
  function estrella(cx, cy, r) { let p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; p.push((cx + rr * Math.cos(a)).toFixed(2) + ',' + (cy + rr * Math.sin(a)).toFixed(2)); } return `<polygon points="${p.join(' ')}"/>`; }
  function bandera(pat, col, w, h) {
    const [a, b, c] = col; let s;
    switch (pat) {
      case 'v3': s = `<rect width="60" height="40" fill="${a}"/><rect x="20" width="20" height="40" fill="${b}"/><rect x="40" width="20" height="40" fill="${c}"/>`; break;
      case 'disco': s = `<rect width="60" height="40" fill="${a}"/><circle cx="30" cy="20" r="10" fill="${c}"/>`; break;
      case 'cruz': s = `<rect width="60" height="40" fill="${a}"/><rect x="16" width="10" height="40" fill="${b}"/><rect y="15" width="60" height="10" fill="${b}"/><rect x="19" width="4" height="40" fill="${c}"/><rect y="18" width="60" height="4" fill="${c}"/>`; break;
      case 'diag': s = `<rect width="60" height="40" fill="${a}"/><polygon points="60,0 60,40 0,40" fill="${c}"/><polygon points="48,0 60,0 12,40 0,40" fill="${b}"/>`; break;
      case 'tri': s = `<rect width="60" height="20" fill="${b}"/><rect y="20" width="60" height="20" fill="${c}"/><polygon points="0,0 26,20 0,40" fill="${a}"/>`; break;
      case 'estrella': s = `<rect width="60" height="40" fill="${a}"/><rect width="26" height="20" fill="${b}"/><g fill="${c}">${estrella(13, 10, 6.5)}</g>`; break;
      case 'h2': s = `<rect width="60" height="20" fill="${a}"/><rect y="20" width="60" height="20" fill="${b}"/><g fill="${c}">${estrella(30, 20, 9)}</g>`; break;
      default: s = `<rect width="60" height="40" fill="${a}"/><rect y="13.33" width="60" height="13.34" fill="${b}"/><rect y="26.67" width="60" height="13.33" fill="${c}"/>`;
    }
    return `<svg class="bandera" viewBox="0 0 60 40" width="${w || 60}" height="${h || 40}" aria-hidden="true">${s}</svg>`;
  }

  // ---------------- mapa ----------------
  const MW = 1000, LAT0 = 84, LAT1 = -58, MH = MW * (LAT0 - LAT1) / 360;
  function proy(lat, lon, shift) { if (shift && lon < -25) lon += 360; return [(lon + 180) / 360 * MW, (LAT0 - lat) / (LAT0 - LAT1) * MH]; }
  // territorio del país ficticio: una mancha irregular, estable para cada partida
  function territorio(c, yo) {
    const grados = { pequeno: 1.7, mediano: 3, grande: 5 }[yo.tamano] || 3;
    const Ry = (yo.km ? yo.km / 111.32 : grados * 0.9) * MW / 360, Rx = (yo.km ? yo.km / (111.32 * Math.cos(yo.lat * Math.PI / 180)) : grados) * MW / 360;
    const o2 = { rng: (yo.semilla || 7) >>> 0 }, fases = [0, 1, 2, 3].map(() => N.rnd(o2) * 6.283), amps = [0.18, 0.12, 0.08, 0.05];
    const pts = [];
    for (let i = 0; i < 48; i++) { const a = i / 48 * 6.283; let r = 1; amps.forEach((am, j) => (r += am * Math.sin((j + 2) * a + fases[j]))); pts.push((c[0] + Math.cos(a) * Rx * r).toFixed(2) + ',' + (c[1] + Math.sin(a) * Ry * r).toFixed(2)); }
    const col = colorVivo(yo.colores);
    return `<polygon class="territorio" points="${pts.join(' ')}" fill="${col}"/>`;
  }
  // el color más saturado de la bandera (el blanco o el negro no se leen sobre el relieve)
  function colorVivo(cols) {
    let mejor = cols[0], mv = -1;
    for (const c of cols) { const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const sat = mx ? (mx - mn) / mx : 0; const v = sat * (0.4 + mx / 425); if (v > mv) { mv = v; mejor = c; } }
    return mv > 0.15 ? mejor : '#a3302a';
  }
  function mapa(o) {
    // o: { cont, sub, vecinos, yo:{lat,lon,colores,nombre}, rel:(iso)=>n, sel, zoom, clic }
    const shift = o.cont === 'oceania';
    let vb = [0, 0, MW, MH];
    const enCont = N.PAISES.filter(p => p.cont === o.cont);
    if (o.zoom !== 'mundo') {
      const base = o.zoom === 'sub' ? enCont.filter(p => p.sub === o.sub || (o.vecinos || []).includes(p.iso)) : enCont;
      const pts = base.map(p => proy(p.lat, p.lon, shift)); if (o.yo) { const g = (o.yo.km || 300) / 111.32 * 1.3; for (const [a, b] of [[g, 0], [-g, 0], [0, g * 1.6], [0, -g * 1.6]]) pts.push(proy(o.yo.lat + a, o.yo.lon + b, shift)); }
      let x0 = Math.min(...pts.map(p => p[0])), x1 = Math.max(...pts.map(p => p[0])), y0 = Math.min(...pts.map(p => p[1])), y1 = Math.max(...pts.map(p => p[1]));
      let w = x1 - x0, h = y1 - y0; const pad = Math.max(w, h) * 0.12 + 14; x0 -= pad; y0 -= pad; w += pad * 2; h += pad * 2;
      const asp = 1.45; if (w / h < asp) { const nw = h * asp; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / asp; y0 -= (nh - h) / 2; h = nh; }
      vb = [x0, y0, w, h];
    }
    const k = vb[2] / (o.px || 600); // unidades del viewBox por píxel en pantalla (aprox.)
    // relieve hipsométrico (Natural Earth, equirectangular 360×180°) y fronteras
    const yTop = (LAT0 - 90) / (LAT0 - LAT1) * MH, copias = shift ? [0, MW] : [0];
    let g = copias.map(dx => `<image href="datos/relieve.jpg" x="${dx}" y="${yTop}" width="${MW}" height="${MW / 2}" preserveAspectRatio="none"/>`).join('');
    if (window.FRONTERAS) g += copias.map(dx => `<path class="fronteras" d="${FRONTERAS}"${dx ? ` transform="translate(${dx} 0)"` : ''}/>`).join('');
    for (let lon = -180; lon <= 360; lon += 30) { const x = (lon + 180) / 360 * MW; g += `<line class="grat" x1="${x}" y1="${-50}" x2="${x}" y2="${MH + 50}"/>`; }
    for (let lat = -60; lat <= 90; lat += 30) { const y = (LAT0 - lat) / (LAT0 - LAT1) * MH; g += `<line class="grat" x1="-200" y1="${y}" x2="${MW + 400}" y2="${y}"/>`; }
    let pts = '', lab = '', lazos = '';
    const yo = o.yo ? proy(o.yo.lat, o.yo.lon, shift) : null;
    for (const p of N.PAISES) {
      const [x, y] = proy(p.lat, p.lon, shift && p.cont === 'oceania' || (shift && p.lon < -25));
      const r = (o.zoom === 'mundo' ? 1.6 + Math.sqrt(p.pob) * 0.2 : 3 + Math.sqrt(p.pob) * 0.3) * k;
      const color = o.rel ? colorRel(o.rel(p.iso)) : (p.cont === o.cont ? (p.sub === o.sub ? '#8a7d64' : '#b9ad93') : '#cdd6da');
      const vec = (o.vecinos || []).includes(p.iso);
      pts += `<circle class="p${o.sel === p.iso ? ' sel' : ''}" data-a="${o.clic || 'selpais'}" data-iso="${p.iso}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="${color}"><title>${esc(p.nombre)}</title></circle>`;
      if (vec && yo) lazos += `<line class="lazo" x1="${yo[0]}" y1="${yo[1]}" x2="${x}" y2="${y}"/>`;
      const etiqueta = o.zoom === 'mundo' ? (['USA', 'CHN', 'RUS', 'IND', 'BRA', 'JPN'].includes(p.iso) || vec) : (vec || p.pot >= 1 || (o.zoom === 'sub' && p.sub === o.sub));
      if (etiqueta) lab += `<text x="${x + r + 2 * k}" y="${y + 3.5 * k}" style="font-size:${10.5 * k}px;stroke-width:${3 * k}px">${esc(p.nombre)}</text>`;
    }
    let yoS = '';
    if (yo) { const r = 9 * k; const c = o.yo.colores; yoS = `<g class="yo">${territorio(yo, o.yo)}<circle cx="${yo[0]}" cy="${yo[1]}" r="${r * 1.25}" fill="#fff" stroke="${'#1d2939'}" stroke-width="1.5"/><g fill="${colorVivo(c)}" stroke="#1d2939">${estrella(yo[0], yo[1], r)}</g><text x="${yo[0] + r * 1.4}" y="${yo[1] - r * 0.6}" style="font-size:${13 * k}px;stroke-width:${3.4 * k}px;font-weight:800">${esc(o.yo.nombre)}</text></g>`; }
    return `<svg class="mapa" viewBox="${vb.map(v => v.toFixed(1)).join(' ')}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mapa">${g}${lazos}${pts}${lab}${yoS}</svg>`;
  }

  // ---------------- gráficos de línea (una serie cada uno) ----------------
  function grafico(id, titulo, serie, unidad, d, ref) {
    const W = 300, H = 100, pl = 30, pr = 6, pt = 8, pb = 16;
    if (serie.length < 2) return `<div class="grafico"><h4>${esc(titulo)}</h4><div class="vacio">Faltan datos: avanza algunos trimestres.</div></div>`;
    const vs = serie.map(p => p.v); let lo = Math.min(...vs), hi = Math.max(...vs); if (ref != null) { lo = Math.min(lo, ref); hi = Math.max(hi, ref); }
    if (hi - lo < 1e-6) { hi += 1; lo -= 1; } const padv = (hi - lo) * 0.1; lo -= padv; hi += padv;
    const X = i => pl + i / (serie.length - 1) * (W - pl - pr), Y = v => pt + (hi - v) / (hi - lo) * (H - pt - pb);
    const path = serie.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(p.v).toFixed(1)).join('');
    const ticks = [lo + padv, (lo + hi) / 2, hi - padv];
    let ax = ticks.map(t => `<line x1="${pl}" x2="${W - pr}" y1="${Y(t)}" y2="${Y(t)}" stroke="#e6dcc8" stroke-width="1"/><text x="${pl - 4}" y="${Y(t) + 3}" text-anchor="end" font-size="9" fill="#7c8492">${fmt(t, Math.abs(hi - lo) < 10 ? 1 : 0)}</text>`).join('');
    if (ref != null) ax += `<line x1="${pl}" x2="${W - pr}" y1="${Y(ref)}" y2="${Y(ref)}" stroke="#7c8492" stroke-width="1" stroke-dasharray="3 3"/>`;
    const f0 = U.E ? fechaTxt(U.E, serie[0].t) : '', f1 = U.E ? fechaTxt(U.E, serie[serie.length - 1].t) : '';
    ax += `<text x="${pl}" y="${H - 3}" font-size="9" fill="#7c8492">${f0}</text><text x="${W - pr}" y="${H - 3}" font-size="9" fill="#7c8492" text-anchor="end">${f1}</text>`;
    const ult = serie[serie.length - 1].v;
    const datos = esc(JSON.stringify(serie.map(p => [p.t, +p.v.toFixed(2)])));
    return `<div class="grafico" data-serie="${datos}" data-u="${esc(unidad)}" data-d="${d}" data-lo="${lo}" data-hi="${hi}"><h4><span>${esc(titulo)}</span><span class="num">${fmt(ult, d)}${esc(unidad)}</span></h4>
      <svg viewBox="0 0 ${W} ${H}">${ax}<path d="${path}" fill="none" stroke="#1f4e79" stroke-width="2" stroke-linejoin="round"/><circle cx="${X(serie.length - 1)}" cy="${Y(ult)}" r="3" fill="#1f4e79"/><g class="hov" style="display:none"><line y1="${pt}" y2="${H - pb}" stroke="#4a5568" stroke-width="1"/><circle r="4" fill="#fff" stroke="#1f4e79" stroke-width="2"/></g><rect class="zona" x="${pl}" y="0" width="${W - pl - pr}" height="${H}" fill="transparent"/></svg><div class="tip" style="display:none"></div></div>`;
  }
  function activarGraficos() {
    document.querySelectorAll('.grafico[data-serie]').forEach(g => {
      const svg = g.querySelector('svg'), zona = g.querySelector('.zona'), hov = g.querySelector('.hov'), tip = g.querySelector('.tip');
      const s = JSON.parse(g.dataset.serie), lo = +g.dataset.lo, hi = +g.dataset.hi, d = +g.dataset.d, u = g.dataset.u;
      const W = 300, H = 100, pl = 30, pr = 6, pt = 8, pb = 16;
      const mover = ev => {
        const r = svg.getBoundingClientRect(); const px = (ev.clientX - r.left) / r.width * W;
        const i = Math.max(0, Math.min(s.length - 1, Math.round((px - pl) / (W - pl - pr) * (s.length - 1))));
        const x = pl + i / (s.length - 1) * (W - pl - pr), y = pt + (hi - s[i][1]) / (hi - lo) * (H - pt - pb);
        hov.style.display = ''; hov.querySelector('line').setAttribute('x1', x); hov.querySelector('line').setAttribute('x2', x); const c = hov.querySelector('circle'); c.setAttribute('cx', x); c.setAttribute('cy', y);
        tip.style.display = ''; tip.style.left = (x / W * r.width) + 'px'; tip.style.top = (y / H * r.height + 22) + 'px'; tip.textContent = `${fechaTxt(U.E, s[i][0])}: ${fmt(s[i][1], d)}${u}`;
      };
      zona.addEventListener('pointermove', mover); zona.addEventListener('pointerleave', () => { hov.style.display = 'none'; tip.style.display = 'none'; });
    });
  }

  // =====================================================================
  //                               INICIO
  // =====================================================================
  function vistaInicio() {
    const hay = cargar();
    const esc0 = `<svg class="escudo" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 4 L88 18 V48 C88 72 70 88 50 96 C30 88 12 72 12 48 V18 Z" fill="#1d2939"/><path d="M50 14 L79 25 V48 C79 66 66 79 50 86 C34 79 21 66 21 48 V25 Z" fill="none" stroke="#a8833a" stroke-width="2"/><g fill="#a8833a">${estrella(50, 46, 16)}</g></svg>`;
    let cont = '';
    if (hay && hay.pais) cont = `<button class="btn grande" data-a="continuar">Continuar: ${esc(hay.pais.nombre)} · ${esc(fechaTxt(hay))}${hay.fin ? ' (terminada)' : ''}</button>`;
    return `<div class="inicio"><div class="caja">${esc0}<h1>SOBERANÍA</h1><p class="lema">Funda una nación. Organiza el poder. Sobrevive al mundo.</p>
      <div class="acciones"><button class="btn sello grande" data-a="nueva">Fundar una nación</button>${cont}</div>
      <p class="pie">Un país ficticio entre ${N.PAISES.length} países reales · cada turno es un trimestre</p></div></div>`;
  }

  // =====================================================================
  //                             CREACIÓN
  // =====================================================================
  function cfgNuevo() {
    const sem = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, o = { rng: sem };
    const cols = []; while (cols.length < 3) { const c = PALETA[Math.floor(N.rnd(o) * PALETA.length)]; if (!cols.includes(c)) cols.push(c); }
    const cfg = { semilla: sem, reroll: 0, nombre: N.nombrePais(o), capital: N.capitalAleatoria(o), lider: N.persona(o), colores: cols, bandera: BANDERAS[Math.floor(N.rnd(o) * BANDERAS.length)],
      continente: 'america_sur', subregion: 'cono_sur', recursos: ['agro', 'mineria'], costa: true, tamano: 'mediano', desarrollo: 'medio', duracion: 20, tipo: 'presidencial',
      ministerios: ['salud', 'educacion', 'economia', 'obras', 'social'], selMin: {} };
    cfg.inst = N.instPorDefecto(cfg.tipo); ubicar(cfg); return cfg;
  }
  function ubicar(cfg) {
    const l = N.ubicacionesDe(cfg.continente);
    if (!l.some(x => x.id === cfg.ubic)) cfg.ubic = l.length ? l[0].id : null;
    if (cfg.ubic) N.aplicarUbicacion(cfg);
    else { const x = N.sugerirUbicacion({ rng: cfg.semilla }, cfg.continente, Object.keys(R.CONTINENTES[cfg.continente].subs)[0]); cfg.vecinos = x.vecinos; cfg.lat = x.lat; cfg.lon = x.lon; }
  }
  const TIPO_UBIC = { costa_pocas: 'Costa · pocas fronteras', costa_muchas: 'Costa · muchas fronteras', interior_muchas: 'Interior · muchas fronteras', interior_pocas: 'Interior · pocas fronteras', isla: 'Isla' };
  function listaNombres(isos) { const n = isos.map(i => N.PX[i].nombre); return n.length <= 1 ? n.join('') : n.slice(0, -1).join(', ') + ' y ' + n[n.length - 1]; }
  function tituloUbic(u, tam) { const t = u.tam[tam || 'mediano']; return u.isla ? 'Isla cerca de ' + listaNombres(t.vecinos) : t.vecinos.length === 1 ? 'En la región de ' + listaNombres(t.vecinos) : 'Entre ' + listaNombres(t.vecinos); }
  function candsDe(m) { const k = U.cfg.semilla + ':' + m; if (!U.cands[k]) U.cands[k] = N.candidatos({ rng: (U.cfg.semilla ^ hash(m)) >>> 0 }, m, 3); return U.cands[k]; }
  function cfgFinal() {
    const c = Object.assign({}, U.cfg); c.ministros = {};
    const mins = R.ORDEN_MIN.filter(m => R.MINISTERIOS[m].obligatorio || c.ministerios.includes(m));
    for (const m of mins) c.ministros[m] = candsDe(m)[c.selMin[m] || 0];
    c.inst = N.sanearInst(c.tipo, c.inst); return c;
  }
  const PASOS = ['El territorio', 'El régimen', 'La Constitución', 'El gabinete'];
  function vistaCrear() {
    const c = U.cfg;
    const pasos = `<div class="pasos">${PASOS.map((p, i) => `<div class="paso ${i < U.paso ? 'hecho' : i === U.paso ? 'actual' : ''}">${i + 1}. ${p}</div>`).join('')}</div>`;
    let cuerpo = [pasoTerritorio, pasoRegimen, pasoConstitucion, pasoGabinete][U.paso]();
    const sig = U.paso < 3 ? `<button class="btn prim" data-a="paso" data-d="1">Siguiente: ${PASOS[U.paso + 1]} ▸</button>` : `<button class="btn sello grande" data-a="fundar">Jurar el gobierno y comenzar</button>`;
    const ant = U.paso > 0 ? `<button class="btn" data-a="paso" data-d="-1">◂ Volver</button>` : `<button class="btn" data-a="inicio">◂ Salir</button>`;
    return `<div class="crear">${pasos}${cuerpo}</div><div class="navcrear"><div class="dentro">${ant}<span class="nota">${esc(c.nombre)}${c.tipo ? ' · ' + esc(R.TIPOS[c.tipo].nombre) : ''}</span>${sig}</div></div>`;
  }
  function pasoTerritorio() {
    const c = U.cfg, C = R.CONTINENTES[c.continente];
    const opc = (grupo, val, actual, txt, dis) => `<button class="opc ${val === actual ? 'sel' : ''}" data-a="cfg" data-k="${grupo}" data-v="${val}" ${dis ? 'disabled' : ''}>${esc(txt)}</button>`;
    const conts = Object.keys(R.CONTINENTES).map(k => opc('continente', k, c.continente, R.CONTINENTES[k].nombre)).join('');
    const ubics = N.ubicacionesDe(c.continente).map(x => {
      const t = x.tam[c.tamano], fr = x.isla ? 'Sin fronteras terrestres' : t.vecinos.length + (t.vecinos.length === 1 ? ' frontera' : ' fronteras'), co = t.costa ? (x.isla ? 'todo costa' : 'con costa') : 'sin salida al mar';
      return '<button class="instop ' + (c.ubic === x.id ? 'sel' : '') + '" data-a="ubic" data-v="' + x.id + '"><b>' + esc(tituloUbic(x, c.tamano)) + '</b>' + esc(TIPO_UBIC[x.tipo] || '') + ' · ' + esc(C.subs[x.sub] || '') + '<span class="costo">' + fr + ' · ' + co + '</span></button>';
    }).join('');
    const recs = Object.keys(R.RECURSOS).map(k => { const sel = c.recursos.includes(k); const dis = (R.RECURSOS[k].costa && !c.costa) || (!sel && c.recursos.length >= 2); return `<button class="opc ${sel ? 'sel' : ''}" data-a="recurso" data-v="${k}" ${dis ? 'disabled' : ''}>${esc(R.RECURSOS[k].nombre)}</button>`; }).join('');
    const colores = [0, 1, 2].map(i => `<div class="colores" style="margin-bottom:4px">${PALETA.map(p => `<button class="color ${c.colores[i] === p ? 'sel' : ''}" style="background:${p}" data-a="color" data-i="${i}" data-v="${p}" aria-label="color ${i + 1}"></button>`).join('')}</div>`).join('');
    const pats = BANDERAS.map(b => `<button class="opc ${c.bandera === b ? 'sel' : ''}" data-a="cfg" data-k="bandera" data-v="${b}" style="padding:4px 6px">${bandera(b, c.colores, 30, 20)}</button>`).join('');
    return `<h2>El territorio</h2><p class="sub">Dónde nace tu país y con qué cuenta.</p>
    <div class="rejilla2"><div>
      <div class="bloque"><h3>Nombre y símbolos</h3>
        <div class="campo"><label>País</label><input data-in="nombre" value="${esc(c.nombre)}" maxlength="28"><button class="btn-dado" data-a="dado" data-k="nombre" title="Otro nombre">🎲</button></div>
        <div class="campo"><label>Capital</label><input data-in="capital" value="${esc(c.capital)}" maxlength="28"><button class="btn-dado" data-a="dado" data-k="capital" title="Otra capital">🎲</button></div>
        <div class="campo"><label>Líder</label><input data-in="lider" value="${esc(c.lider)}" maxlength="32"><button class="btn-dado" data-a="dado" data-k="lider" title="Otro nombre">🎲</button></div>
        <div class="vista-bandera">${bandera(c.bandera, c.colores, 96, 64)}<div class="chips">${pats}</div></div>
        ${colores}
      </div>
      <div class="bloque"><h3>Ubicación</h3>
        <div class="chips" style="margin-bottom:8px">${conts}</div>
        <div class="instops">${ubics}</div>
        <p class="nota" style="margin-top:8px">Calculadas sobre el mapa real: ninguna tapa una capital ni le quita más del 30% de su territorio a un país.</p>
      </div>
      <div class="bloque"><h3>Geografía y economía</h3>
        <p class="nota" style="margin:6px 0">Riquezas naturales (elige hasta dos):</p><div class="chips" style="margin-bottom:10px">${recs}</div>
        <div class="campo"><label>Tamaño</label><div class="chips">${Object.keys(R.TAMANOS).map(k => { const x = N.ubicacion(c.ubic); return opc('tamano', k, c.tamano, R.TAMANOS[k].nombre + ' · ' + (x ? fmt(x.tam[k].area / 1000) + ' mil km² · ' : '') + '~' + R.TAMANOS[k].pob + ' M hab.'); }).join('')}</div></div>
        <div class="campo"><label>Desarrollo</label><div class="chips">${Object.keys(R.DESARROLLO).map(k => opc('desarrollo', k, c.desarrollo, `${R.DESARROLLO[k].nombre} (~US$ ${fmt(R.DESARROLLO[k].pibpc)} por hab.)`)).join('')}</div></div>
        <div class="campo"><label>Partida</label><div class="chips">${[10, 20, 30].map(a => opc('duracion', String(a), String(c.duracion), `${a} años`)).join('')}</div></div>
      </div>
    </div><div class="pegajoso"><div class="bloque"><h3>${esc(C.nombre)} <small class="nota">· ${esc(C.subs[c.subregion])}</small></h3>
      ${mapa({ cont: c.continente, sub: c.subregion, vecinos: c.vecinos, yo: { lat: c.lat, lon: c.lon, colores: c.colores, nombre: c.nombre, tamano: c.tamano, semilla: c.forma || c.semilla, km: c.km }, zoom: 'sub', clic: 'nada', px: 330 })}
      <p class="nota" style="margin-top:8px">Los demás países son los reales, con su régimen, economía y alianzas de hoy.</p></div></div></div>`;
  }
  function pasoRegimen() {
    const c = U.cfg;
    const cards = R.ORDEN_TIPOS.map(k => { const T = R.TIPOS[k]; return `<button class="tarjeta ${c.tipo === k ? 'sel' : ''}" data-a="tipo" data-v="${k}"><span class="demo">${T.demo ? 'Democracia' : 'Autocracia'}</span><div class="jefe">${esc(T.jefe)}</div><h4>${esc(T.nombre)}</h4><p>${esc(T.desc)}</p><ul>${T.pros.map(p => `<li class="pro">${esc(p)}</li>`).join('')}${T.contras.map(p => `<li class="con">${esc(p)}</li>`).join('')}</ul></button>`; }).join('');
    return `<h2>El régimen</h2><p class="sub">¿Quién manda en ${esc(c.nombre)} y cómo se legitima ese poder?</p><div class="tarjetas">${cards}</div>`;
  }
  function pasoConstitucion() {
    const c = U.cfg; c.inst = N.sanearInst(c.tipo, c.inst);
    const secc = R.ORDEN_INST.map(k => {
      const ops = N.opcionesInst(c.tipo, k); if (!ops.length) return '';
      const I = R.INSTITUCIONES[k];
      return `<div class="inst"><h4>${esc(I.nombre)}</h4><div class="ayuda">${esc(I.ayuda)}${ops.length === 1 ? ' · fijado por el régimen' : ''}</div><div class="instops">${ops.map(o => { const O = I.op[o]; return `<button class="instop ${c.inst[k] === o ? 'sel' : ''}" data-a="inst" data-k="${k}" data-v="${o}"><b>${esc(O.nombre)}</b>${esc(O.desc || '')}${O.costo ? `<span class="costo">Cuesta ${fmt(O.costo, 2)}% del PIB al año</span>` : ''}</button>`; }).join('')}</div></div>`;
    }).join('');
    const mins = R.ORDEN_MIN.map(m => { const M = R.MINISTERIOS[m]; const fijo = M.obligatorio; const on = fijo || c.ministerios.includes(m); return `<label class="${fijo ? 'fijo' : ''}"><input type="checkbox" data-a="min" data-v="${m}" ${on ? 'checked' : ''} ${fijo ? 'disabled' : ''}><span><b>${esc(M.nombre)}</b>${esc(M.desc)}</span></label>`; }).join('');
    const nMin = 4 + c.ministerios.length;
    const E = N.crearPartida(cfgFinal()), s = N.estaticos(E), pod = N.poderRel(E, s);
    const golpe = s.golpe * (c.tipo === 'junta' ? 1.3 : R.TIPOS[c.tipo].demo ? 0.8 : 1);
    const fila = (n, v, cls) => `<div class="efecto"><span>${n}</span><b class="${cls || ''}">${v}</b></div>`;
    const facs = R.ORDEN_FAC.map(f => `<div class="fac"><span>${esc(R.FACCIONES[f].corto)}</span><div class="barra pod"><i style="width:${Math.min(100, pod[f] * 300)}%;background:var(--oro)"></i></div><div class="barra sat"><i class="${E.pol.fac[f].sat < 40 ? 'bajo' : E.pol.fac[f].sat > 62 ? 'alto' : ''}" style="width:${E.pol.fac[f].sat}%"></i></div><span class="num">${fmt(E.pol.fac[f].sat)}</span></div>`).join('');
    return `<h2>La Constitución</h2><p class="sub">Diseña las instituciones: quién vigila a quién, cuánto cuesta y cuánto poder tiene cada sector.</p>
    <div class="rejilla2"><div><div class="bloque">${secc}</div>
      <div class="bloque"><h3>Ministerios <small class="nota">· ${nMin} ministerios${nMin > R.MAX_MIN_SIN_BUROCRACIA ? ' — ¡demasiados: burocracia y corrupción!' : ''}</small></h3><p class="ayuda">Cada uno cuesta ${fmt(R.COSTO_MIN, 2)}% del PIB al año. Sin ministerio, el gasto de su área rinde mucho menos.</p><div class="minchk">${mins}</div></div>
    </div><div class="pegajoso"><div class="bloque"><h3>Organigrama</h3>${organigrama(E, true)}</div>
      <div class="bloque"><h3>Cómo nacería el país</h3>
        ${fila('Libertades', fmt(E.soc.libertad))}${fila('Corrupción esperada', fmt(E.soc.corr), E.soc.corr > 55 ? 'mal' : '')}${fila('Legitimidad inicial', fmt(E.pol.legit))}
        ${fila('Riesgo de golpe (multiplicador)', '×' + fmt(golpe, 2), golpe > 1 ? 'mal' : '')}${fila('Costo del aparato estatal', fmt(s.costo, 2) + '% del PIB')}${fila('Capital político por trimestre', '≈ ' + fmt(R.TIPOS[c.tipo].pc + (c.ministerios.includes('presidencia') ? 1 : 0)))}
        <h4 style="margin:12px 0 4px;font-size:13px">Facciones <small class="nota">· poder (dorado) y satisfacción</small></h4>${facs}</div></div></div>`;
  }
  function pasoGabinete() {
    const c = U.cfg, revela = ['contraloria', 'fiscalia'].includes(c.inst.control);
    const mins = R.ORDEN_MIN.filter(m => R.MINISTERIOS[m].obligatorio || c.ministerios.includes(m));
    const filas = mins.map(m => {
      const cs = candsDe(m), sel = c.selMin[m] || 0;
      return `<div class="bloque"><h3>${esc(R.MINISTERIOS[m].nombre)}</h3><div class="cands">${cs.map((x, i) => candHTML(x, i === sel, revela, `data-a="cand" data-m="${m}" data-i="${i}"`)).join('')}</div></div>`;
    }).join('');
    return `<h2>El gabinete</h2><p class="sub">Elige a quién juras como ministro. La competencia hace rendir el ministerio; la lealtad te protege en una crisis; la honestidad evita escándalos.${revela ? '' : ' <b>Sin órgano de control no sabes quién es honesto.</b>'}</p>${filas}`;
  }
  function candHTML(x, sel, revela, attrs) {
    return `<button class="cand ${sel ? 'sel' : ''}" ${attrs}><div class="nom">${esc(x.nombre)}</div><div class="perf">${esc(N.PERFILES[x.perfil] || '')}${x.fac ? ' · ' + esc(R.FACCIONES[x.fac].corto) : ''}</div>
      <div class="stat"><span>Competencia</span>${pips(x.comp)}</div><div class="stat"><span>Lealtad</span>${pips(x.leal)}</div><div class="stat"><span>Honestidad</span>${revela ? pips(x.hon) : '<span class="nota">?</span>'}</div></button>`;
  }

  // ---------------- organigrama ----------------
  function organigrama(E, previa) {
    const T = R.TIPOS[E.gob.tipo], I = R.INSTITUCIONES, inst = E.gob.inst;
    const W = 720, bw = 132, bh = 36;
    const mins = Object.keys(E.gob.min);
    const porFila = 5, filas = Math.ceil(mins.length / porFila);
    const H = 210 + filas * (bh + 10);
    const caja = (x, y, w, t1, t2, cls, attrs) => `<g ${attrs || ''}><rect class="caja ${cls || ''}" x="${x}" y="${y}" width="${w}" height="${bh}" rx="4"/><text x="${x + w / 2}" y="${y + 15}" text-anchor="middle" font-weight="600" class="${cls === 'jefe' ? 'claro' : ''}">${esc(t1)}</text><text x="${x + w / 2}" y="${y + 28}" text-anchor="middle" font-size="10" fill="${cls === 'jefe' ? '#d9d2c3' : '#4a5568'}" class="${cls === 'jefe' ? 'claro' : ''}">${esc(t2)}</text></g>`;
    let s = '';
    const jw = 220; s += caja(W / 2 - jw / 2, 6, jw, T.jefe, E.pais.lider, 'jefe');
    const poderes = [['legislativo', 'Legislativo'], ['judicial', 'Judicial'], ['banco', 'Banco Central'], ['fuerzas', 'Fuerzas Armadas'], ['prensa', 'Prensa']].filter(([k]) => inst[k]);
    const pw = (W - 20) / poderes.length;
    s += `<line x1="${W / 2}" y1="${6 + bh}" x2="${W / 2}" y2="62"/><line x1="${10 + pw / 2}" y1="62" x2="${W - 10 - pw / 2}" y2="62"/>`;
    poderes.forEach(([k, n], i) => { const x = 10 + i * pw; s += `<line x1="${x + pw / 2}" y1="62" x2="${x + pw / 2}" y2="72"/>`; s += caja(x + 3, 72, pw - 6, n, cortar(I[k].op[inst[k]].nombre, 24)); });
    s += `<line x1="${W / 2}" y1="62" x2="${W / 2}" y2="140" stroke-dasharray="2 2"/>`;
    s += `<text x="${W / 2}" y="${154}" text-anchor="middle" font-weight="700" font-size="12">Consejo de Ministros</text>`;
    const mw = (W - 20) / porFila;
    mins.forEach((m, i) => {
      const fx = i % porFila, fy = Math.floor(i / porFila); const x = 10 + fx * mw, y = 166 + fy * (bh + 10);
      const mi = E.gob.min[m]; const ap = mi ? mi.nombre.split(' ').slice(-1)[0] : 'VACANTE';
      s += caja(x + 3, y, mw - 6, cortar(R.MINISTERIOS[m].nombre, 22), ap, mi ? '' : 'vac', previa ? '' : `class="min" data-a="vermin" data-m="${m}"`);
    });
    return `<svg class="organi" viewBox="0 0 ${W} ${H}" role="img" aria-label="Organigrama del Estado">${s}</svg>`;
  }
  function cortar(t, n) { return t.length > n ? t.slice(0, n - 1) + '…' : t; }

  // =====================================================================
  //                               JUEGO
  // =====================================================================
  function snapshot(E) { return { pib: E.eco.pib, pibpc: E.eco.pib / E.eco.pob * 1000, crec: E.eco.crec, infl: E.eco.infl, desemp: E.eco.desemp, deuda: E.eco.deuda / E.eco.pib * 100, deficit: E.eco.deficit, riesgo: E.eco.riesgo, salud: E.soc.salud, educacion: E.soc.educacion, seguridad: E.soc.seguridad, infra: E.soc.infra, desig: E.soc.desig, corr: E.soc.corr, libertad: E.soc.libertad, aprob: E.pol.aprobVista, legit: E.pol.legit, est: E.pol.est, prot: E.pol.prot, golpe: E.pol.riesgoGolpe * 100, prestigio: E.soc.prestigio, escanos: E.pol.escanos, pc: E.pol.pc }; }
  function vistaJuego() {
    const E = U.E, T = R.TIPOS[E.gob.tipo];
    const pend = E.pend.length;
    const cab = `<header class="cabecera"><div class="pais">${bandera(E.pais.bandera, E.pais.colores, 42, 28)}<div><h1>${esc(E.pais.nombre)}</h1><div class="regimen">${esc(T.nombre)} · ${esc(E.pais.lider)}</div></div></div>
      <div class="fecha"><b>${fechaTxt(E)}</b><span>Turno ${E.turno + 1} de ${E.durTurnos}</span></div>
      <div class="pc" title="Capital político: se gasta en leyes, reformas y diplomacia"><span class="ico"></span><span class="num">${fmt(E.pol.pc)}</span> <span style="font-weight:400;font-size:12px;color:#c9c0ad">capital político</span></div>
      <button class="btn-turno" data-a="turno" ${pend || E.fin ? 'disabled' : ''} title="${pend ? 'Resuelve los asuntos pendientes' : ''}">${E.fin ? 'Partida terminada' : pend ? `${pend} asunto${pend > 1 ? 's' : ''} pendiente${pend > 1 ? 's' : ''}` : 'Cerrar el trimestre ▸'}</button>
      <button class="btn chico" data-a="menu" style="background:transparent;color:#c9c0ad;border-color:#4a5568">Menú</button></header>`;
    const tabs = [['despacho', 'Despacho', pend], ['economia', 'Economía'], ['poder', 'Poder'], ['leyes', 'Leyes'], ['mundo', 'Mundo'], ['cronica', 'Crónica']];
    const pest = `<nav class="pestanas">${tabs.map(([k, n, b]) => `<button class="pestana ${U.tab === k ? 'sel' : ''}" data-a="tab" data-v="${k}">${n}${b ? `<span class="badge">${b}</span>` : ''}</button>`).join('')}</nav>`;
    const cont = { despacho: tabDespacho, economia: tabEconomia, poder: tabPoder, leyes: tabLeyes, mundo: tabMundo, cronica: tabCronica }[U.tab]();
    return `<div class="juego">${cab}<div class="cuerpo"><aside class="lateral" id="lateral">${lateral()}</aside><main class="principal">${pest}<div class="contenido">${cont}</div></main></div></div>${E.fin && U.verFinal ? vistaFinal() : ''}`;
  }

  function lateral() {
    const E = U.E, a = snapshot(E), b = U.antes || a, T = R.TIPOS[E.gob.tipo];
    const ind = (n, k, txt, mejor, alarma, alerta, title) => {
      const d = a[k] - b[k]; let dc = '', ds = '';
      if (Math.abs(d) > 0.05) { ds = d > 0 ? '▲' : '▼'; dc = (d > 0) === (mejor > 0) ? 'bien' : 'mal'; }
      const cls = alarma && alarma(a[k]) ? 'alarma' : alerta && alerta(a[k]) ? 'alerta' : '';
      return `<div class="ind ${cls}" title="${esc(title || '')}"><span>${n}</span><span class="v">${txt}</span><span class="d ${dc}">${ds}</span></div>`;
    };
    let s = '<h3>Economía</h3>';
    s += ind('PIB', 'pib', `US$ ${fmt(a.pib, a.pib < 100 ? 1 : 0)} mil M`, 1);
    s += ind('Por habitante', 'pibpc', `US$ ${fmt(a.pibpc)}`, 1);
    s += ind('Crecimiento', 'crec', `${fmt(a.crec, 1)}%`, 1, v => v < -1, v => v < 1);
    s += ind('Inflación', 'infl', `${fmt(a.infl, 1)}%`, -1, v => v > 15, v => v > 7);
    s += ind('Desempleo', 'desemp', `${fmt(a.desemp, 1)}%`, -1, v => v > 13, v => v > 9);
    s += ind('Deuda pública', 'deuda', `${fmt(a.deuda)}% PIB`, -1, v => v > 95, v => v > 65);
    s += ind('Déficit fiscal', 'deficit', `${fmt(a.deficit, 1)}% PIB`, -1, v => v > 6, v => v > 3);
    s += ind('Riesgo país', 'riesgo', `${fmt(a.riesgo, 1)} pts`, -1, v => v > 9, v => v > 5, 'Prima sobre la tasa mundial que te cobran los acreedores');
    s += '<h3>Sociedad</h3>';
    s += ind('Salud', 'salud', fmt(a.salud), 1, v => v < 35, v => v < 50);
    s += ind('Educación', 'educacion', fmt(a.educacion), 1, v => v < 35, v => v < 50);
    s += ind('Seguridad', 'seguridad', fmt(a.seguridad), 1, v => v < 30, v => v < 45);
    s += ind('Infraestructura', 'infra', fmt(a.infra), 1, v => v < 30, v => v < 45);
    s += ind('Desigualdad (Gini)', 'desig', fmt(a.desig), -1, v => v > 55, v => v > 47);
    s += ind('Corrupción', 'corr', fmt(a.corr), -1, v => v > 65, v => v > 50);
    s += ind('Libertades', 'libertad', fmt(a.libertad), 1, v => v < 25, v => v < 45);
    s += '<h3>Poder</h3>';
    s += ind(E.gob.inst.prensa === 'estatal' ? 'Aprobación (oficial)' : 'Aprobación', 'aprob', `${fmt(a.aprob)}%`, 1, v => v < 28, v => v < 40, E.gob.inst.prensa === 'estatal' ? 'Con medios estatales, las encuestas no son de fiar' : '');
    s += ind('Legitimidad', 'legit', fmt(a.legit), 1, v => v < 30, v => v < 42, 'Cuánto aceptan los ciudadanos tu derecho a gobernar');
    s += ind('Estabilidad', 'est', fmt(a.est), 1, v => v < 30, v => v < 45);
    s += ind('Protestas', 'prot', fmt(a.prot), -1, v => v > 45, v => v > 22);
    s += ind('Riesgo de golpe', 'golpe', `${fmt(a.golpe, 1)}%`, -1, v => v > 5, v => v > 1.5, 'Probabilidad de un intento de golpe este trimestre');
    s += ind('Prestigio mundial', 'prestigio', fmt(a.prestigio), 1);
    if (T.demo && E.pol.escanos != null) {
      s += ind('Escaños propios', 'escanos', `${fmt(a.escanos)}%`, 1, v => v < 40, v => v < 50);
      s += `<div class="nota" style="margin-top:6px">Elecciones: <b>${fechaTxt(E, E.pol.proxElec)}</b> · intención de voto ${fmt(N.pronostico(E), 1)}%</div>`;
    }
    if (E.pol.proxCongreso != null) s += `<div class="nota" style="margin-top:6px">Congreso del Partido: <b>${fechaTxt(E, E.pol.proxCongreso)}</b></div>`;
    if (E.guerra) s += `<div class="riesgo alto" style="margin-top:8px">⚔ En guerra con ${esc(N.PX[E.guerra.con].nombre)}</div>`;
    return s;
  }

  // ---------------- DESPACHO ----------------
  function tabDespacho() {
    const E = U.E; let s = '';
    if (U.resultado) s += `<div class="resultado"><b>${esc(U.resultado.titulo)}</b> — ${esc(U.resultado.opcion)}.${U.resultado.texto ? ' ' + esc(U.resultado.texto) : ''}${U.resultado.chips && U.resultado.chips.length ? chipsHTML(U.resultado.chips.filter(c => c.t !== 'Probabilidad')) : ''}</div>`;
    if (E.pend.length) {
      s += E.pend.map((p, i) => {
        const v = N.verEvento(E, p);
        return `<article class="memo ${v.critico || v.cat === 'crisis' ? 'crisis' : ''}"><div class="cab"><span>Memorándum · ${esc(etiquetaCat(v.cat))}</span><span class="timbre">${v.critico ? 'URGENTE' : 'RESERVADO'}</span></div><h2>${esc(v.titulo)}</h2><div class="texto">${esc(v.texto)}</div>
          <div class="opciones">${v.opciones.map((o, j) => `<button class="opcion" data-a="decidir" data-i="${i}" data-o="${j}" ${o.bloqueada ? 'disabled' : ''}><span class="t">${esc(o.t)}</span>${o.bloqueada ? `<span class="nota">${esc(o.motivo)}</span>` : chipsHTML(o.chips)}</button>`).join('')}</div></article>`;
      }).join('');
    } else if (!E.fin) {
      s += `<div class="panel"><h3>Escritorio despejado <small>${fechaTxt(E)}</small></h3>${U.resumen ? `<p>${U.resumen}</p>` : `<p>Bienvenido al despacho. Revisa el presupuesto, aprueba leyes, cultiva a tus vecinos y, cuando estés listo, <b>cierra el trimestre</b>.</p>`}</div>`;
    }
    s += `<div class="fila"><div class="panel"><h3>Acciones de gobierno <small>cuestan capital político</small></h3>${listaAcciones('gobierno')}</div>
      <div class="panel"><h3>Últimas noticias</h3>${noticias(E.noticias.slice(0, 9))}<button class="btn chico" data-a="tab" data-v="cronica" style="margin-top:8px">Ver la crónica completa</button></div></div>`;
    return s;
  }
  function etiquetaCat(c) { return { economia: 'Economía', politica: 'Política', social: 'Sociedad', vecinos: 'Vecinos', mundo: 'Mundo', crisis: 'Crisis', oportunidad: 'Oportunidad' }[c] || 'Gobierno'; }
  function listaAcciones(grupo) {
    const E = U.E;
    return `<div class="acciones-lista">${Object.keys(N.ACCIONES).filter(k => N.ACCIONES[k].grupo === grupo).map(k => { const A = N.ACCIONES[k], st = N.estadoAccion(E, k); return `<div class="accion"><div><div class="n">${esc(A.nombre)} <span class="costo-pc">${A.pc}</span></div><div class="dsc">${esc(st.ok ? A.desc : st.motivo)}</div></div><button class="btn chico" data-a="accion" data-v="${k}" ${st.ok && !E.fin ? '' : 'disabled'}>Ejecutar</button></div>`; }).join('')}</div>`;
  }
  function noticias(l) {
    if (!l.length) return '<div class="vacio">Sin noticias.</div>';
    return `<ul class="noticias">${l.map(n => `<li class="${n.tipo}"><span class="f">${fechaTxt(U.E, n.t)}</span><span class="txt">${n.titulo ? `<b>${esc(n.titulo)}.</b> ` : ''}${esc(n.titulo ? n.texto.replace(/^[^:]*:\s*/, '') : n.texto)}</span></li>`).join('')}</ul>`;
  }

  // ---------------- ECONOMÍA ----------------
  function tabEconomia() {
    const E = U.E, eco = E.eco, b = eco.presBase || { tasaImp: eco.tasaImp, gasto: eco.gasto };
    const desl = (k, n, v, min, max, paso, base) => `<div class="desliz"><span>${n}${Math.abs(v - base) > 0.001 ? `<span class="cambio">antes ${fmt(base, 1)}%</span>` : ''}</span><input type="range" data-pres="${k}" min="${min}" max="${max}" step="${paso}" value="${v}"><span class="v" data-vpres="${k}">${fmt(v, 1)}%</span></div>`;
    let pres = desl('tasaImp', 'Carga tributaria', eco.tasaImp, 8, 55, 0.5, b.tasaImp);
    pres += '<div class="nota" style="margin:8px 0 2px">Gasto por área (% del PIB al año)</div>';
    for (const a of R.ORDEN_AREAS) pres += desl(a, R.AREAS[a].nombre, eco.gasto[a], R.AREAS[a].min, R.AREAS[a].max, 0.1, b.gasto[a]);
    const d = eco.desglose || {};
    const dg = [['potencial', 'Potencial (instituciones, capital humano)'], ['mundo', 'Economía mundial'], ['materias', 'Materias primas'], ['comercio', 'Tratados y bloques'], ['fiscal', 'Impulso fiscal'], ['deuda', 'Peso de la deuda'], ['inflacion', 'Inflación y escasez'], ['choques', 'Shocks y sucesos']];
    const maxd = Math.max(2, ...dg.map(([k]) => Math.abs(d[k] || 0)));
    const desg = dg.map(([k, n]) => { const v = d[k] || 0, w = Math.abs(v) / maxd * 50; return `<div class="dg"><span>${n}</span><div class="eje"><i style="${v >= 0 ? 'left:50%' : `left:${50 - w}%`};width:${w}%;background:${v >= 0 ? 'var(--rel-pos)' : 'var(--rel-neg)'}"></i></div><span class="v">${sg(v, 1)}</span></div>`; }).join('');
    const M = E.mundo;
    const prec = [['energia', 'Petróleo y gas'], ['metales', 'Metales'], ['alimentos', 'Alimentos'], ['turismo', 'Turismo mundial']].map(([k, n]) => `<div class="efecto"><span>${n}</span><b class="num">${fmt(M.precios[k] * 100)}</b></div>`).join('');
    const secs = Object.keys(eco.sec).map(k => `<div class="efecto"><span>${esc(R.RECURSOS[k].nombre)}</span><b class="num">${fmt(eco.sec[k] * 100, 1)}% del PIB</b></div>`).join('') || '<div class="vacio">Sin sectores exportadores destacados.</div>';
    const H = E.hist;
    const ser = k => H.map(h => ({ t: h.t, v: h[k] }));
    return `<div class="fila"><div class="panel"><h3>Presupuesto nacional <small>rige desde este trimestre</small></h3>${pres}<div class="balance" id="balance">${balance()}</div></div>
      <div><div class="panel"><h3>De dónde viene el crecimiento <small>${sg(eco.crec, 1)}% anual</small></h3><div class="desglose">${desg}</div><p class="nota" style="margin-top:8px">Potencial de largo plazo: ${fmt(eco.crecPot, 1)}% · desempleo natural sube con leyes laborales rígidas y baja educación.</p></div>
      <div class="panel"><h3>Mercados mundiales <small>índice, 100 = normal</small></h3>${prec}<div class="efecto"><span>Crecimiento mundial</span><b class="num">${fmt(M.crec, 1)}%</b></div><div class="efecto"><span>Tasa de interés mundial</span><b class="num">${fmt(M.tasa, 1)}%</b></div>
        <h4 style="margin:10px 0 2px;font-size:13px">Tus sectores exportadores</h4>${secs}</div></div></div>
      <div class="panel"><h3>Evolución</h3><div class="graficos">${grafico('g1', 'Crecimiento anual', ser('crec'), '%', 1, 0)}${grafico('g2', 'Inflación anual', ser('infl'), '%', 1)}${grafico('g3', 'Desempleo', ser('desemp'), '%', 1)}${grafico('g4', 'Deuda pública', ser('deuda'), '% PIB', 0)}${grafico('g5', 'Déficit fiscal', ser('def'), '% PIB', 1, 0)}${grafico('g6', 'Aprobación', ser('aprob'), '%', 0, 50)}</div></div>
      <div class="panel"><h3>Medidas económicas</h3>${listaAcciones('economia')}</div>`;
  }
  function balance() {
    const E = U.E, eco = E.eco, reac = N.reaccionPrevista(E);
    let areas = 0; for (const a of R.ORDEN_AREAS) areas += eco.gasto[a];
    const otros = eco.gastos - areas - eco.admin - eco.subsidio;
    const fila = (n, v, cls) => `<div class="efecto"><span>${n}</span><b class="${cls || ''}">${v}</b></div>`;
    let s = fila('Ingresos del Estado', fmt(eco.ingresos, 1) + '% PIB');
    s += fila('Gasto por áreas', fmt(areas, 1) + '% PIB');
    s += fila('Aparato estatal (instituciones y ministerios)', fmt(eco.admin, 2) + '% PIB');
    if (eco.subsidio > 0.01) s += fila('Subsidio a combustibles', fmt(eco.subsidio, 1) + '% PIB');
    if (Math.abs(otros) > 0.05) s += fila('Programas por ley y otros', fmt(otros, 1) + '% PIB');
    s += fila('Intereses de la deuda', fmt(eco.intereses, 1) + '% PIB');
    s += fila(eco.deficit >= 0 ? '<b>Déficit</b>' : '<b>Superávit</b>', fmt(Math.abs(eco.deficit), 1) + '% PIB', eco.deficit > 4 ? 'mal' : '');
    s += fila('Tasa media de la deuda', fmt(eco.tasaMedia, 1) + '%');
    if (eco.cerrados) s += `<div class="riesgo alto">Los mercados están cerrados para ${esc(E.pais.nombre)}${eco.liquidez > 0 ? ` · liquidez disponible: ${fmt(eco.liquidez / eco.pib * 100, 1)}% PIB` : ''}</div>`;
    const ks = Object.keys(reac).filter(f => Math.abs(reac[f]) >= 0.5);
    if (ks.length) s += `<div class="nota" style="margin-top:8px">Reacción al cerrar el trimestre:</div>${chipsHTML(ks.map(f => ({ t: R.FACCIONES[f].corto, v: reac[f], bueno: reac[f] > 0 })))}`;
    return s;
  }

  // ---------------- PODER ----------------
  function tabPoder() {
    const E = U.E, T = R.TIPOS[E.gob.tipo], s0 = N.estaticos(E), revela = s0.revela;
    let gab = Object.keys(E.gob.min).map(m => {
      const mi = E.gob.min[m], M = R.MINISTERIOS[m], abierto = U.minAbierto === m;
      let det = '';
      if (abierto) {
        const cs = N.candidatosJuego(E, m), costo = mi ? 2 : 1;
        det = `<div class="reemplazo"><div class="nota" style="margin:4px 0">Candidatos (${costo} de capital político):</div><div class="cands">${cs.map((x, i) => candHTML(x, false, revela, `data-a="nombrar" data-m="${m}" data-i="${i}" ${E.pol.pc < costo ? 'disabled' : ''}`)).join('')}</div>${M.obligatorio ? '' : `<button class="btn chico peligro" data-a="suprimir" data-m="${m}" style="margin-top:6px">Suprimir el ministerio (2)</button>`}</div>`;
      }
      return `<div class="ministro"><div><div class="cargo">${esc(M.nombre)}</div>${mi ? `<div class="nom">${esc(mi.nombre)}</div><div class="stats"><span>Competencia ${pips(mi.comp)}</span><span>Lealtad ${pips(mi.leal)}</span><span>Honestidad ${revela ? pips(mi.hon) : '?'}</span>${mi.fac ? `<span>${esc(R.FACCIONES[mi.fac].corto)}</span>` : ''}</div>` : '<div class="vac">Cargo vacante: el ministerio rinde como si no existiera</div>'}</div><button class="btn chico" data-a="vermin" data-m="${m}">${abierto ? 'Cerrar' : mi ? 'Reemplazar' : 'Nombrar'}</button>${det}</div>`;
    }).join('');
    const libres = R.ORDEN_MIN.filter(m => !(m in E.gob.min));
    if (libres.length) gab += `<div style="margin-top:10px;display:flex;gap:6px;align-items:center;flex-wrap:wrap"><select id="nuevoMin" class="buscador" style="width:auto;margin:0">${libres.map(m => `<option value="${m}">${esc(R.MINISTERIOS[m].nombre)}</option>`).join('')}</select><button class="btn chico" data-a="crearmin">Crear ministerio (3)</button></div>`;
    const pod = E.pol.poder || N.poderRel(E, s0), obj = E.pol.objFac || {};
    const facs = `<div class="fac cab"><span>Facción</span><span>Poder</span><span>Satisfacción</span><span></span></div>` + R.ORDEN_FAC.map(f => { const F = E.pol.fac[f]; const o = obj[f]; const fl = o == null ? '' : o > F.sat + 2 ? ' ↗' : o < F.sat - 2 ? ' ↘' : ''; return `<div class="fac" title="${esc(DESEOS[f])}"><span>${esc(R.FACCIONES[f].corto)}</span><div class="barra pod"><i style="width:${Math.min(100, pod[f] * 300)}%"></i></div><div class="barra sat"><i class="${F.sat < 35 ? 'bajo' : F.sat > 62 ? 'alto' : ''}" style="width:${F.sat}%"></i></div><span class="num">${fmt(F.sat)}${fl}</span></div>`; }).join('');
    const inst = R.ORDEN_INST.map(k => {
      const ops = N.opcionesInst(E.gob.tipo, k); if (!ops.length) return ''; const I = R.INSTITUCIONES[k];
      return `<div class="instfila"><span><b>${esc(I.nombre)}</b><br><span class="nota">${esc(I.op[E.gob.inst[k]].nombre)}</span></span><div class="ops">${ops.filter(o => o !== E.gob.inst[k]).map(o => `<button class="btn chico" data-a="reforma" data-k="${k}" data-v="${o}" title="${esc(I.op[o].desc || '')}" ${E.fin ? 'disabled' : ''}>→ ${esc(I.op[o].nombre)} <span class="costo-pc">${N.costoReforma(E, k, o)}</span></button>`).join('') || '<span class="nota">Fijado por el régimen</span>'}</div></div>`;
    }).join('');
    const reg = R.ORDEN_TIPOS.filter(t => t !== E.gob.tipo).map(t => `<option value="${t}">${esc(R.TIPOS[t].nombre)} (${N.costoCambio(E, t)} PC)</option>`).join('');
    let legis = '';
    if (T.demo && E.pol.escanos != null) legis = `<div class="panel"><h3>Legislatura <small>${fmt(E.pol.escanos)}% oficialista</small></h3>${hemiciclo(E.pol.escanos)}<p class="nota" style="text-align:center">Próximas elecciones: ${fechaTxt(E, E.pol.proxElec)} · intención de voto ${fmt(N.pronostico(E), 1)}%. Desgaste por años en el poder: −${fmt(N.desgasteDe(E), 1)} en todas las facciones.</p></div>`;
    const rg = E.pol.riesgoGolpe * 100, rv = (E.pol.riesgoRevuelta || 0) * 100;
    const riesgos = `<div class="riesgo ${rg > 3 ? 'alto' : ''}">Riesgo de golpe este trimestre: <b>${fmt(rg, 1)}%</b></div>${!T.demo ? `<div class="riesgo ${rv > 3 ? 'alto' : ''}">Riesgo de levantamiento: <b>${fmt(rv, 1)}%</b></div>` : ''}<div class="riesgo ${E.pol.prot > 45 ? 'alto' : ''}">Protestas: <b>${fmt(E.pol.prot)}</b> / 100</div>`;
    return `<div class="fila"><div class="panel"><h3>Organigrama del Estado</h3>${organigrama(E)}<p class="nota">Toca un ministerio para cambiar a su titular.</p></div>
      <div><div class="panel"><h3>Facciones <small>poder (dorado) · satisfacción</small></h3>${facs}<p class="nota" style="margin-top:6px">Pasa el cursor por una facción para ver qué quiere. Las flechas indican hacia dónde va su humor.</p></div>
      <div class="panel"><h3>Riesgos</h3>${riesgos}</div>${legis}</div></div>
      <div class="fila"><div class="panel"><h3>Gabinete</h3>${gab}</div>
      <div><div class="panel"><h3>Reformas institucionales <small>capital político</small></h3>${inst}</div>
      <div class="panel"><h3>Nueva Constitución</h3><p class="nota">Cambiar el régimen es la reforma más profunda. Pasar de democracia a autocracia es un autogolpe y puede fracasar.</p><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><select id="nuevoReg" class="buscador" style="width:auto;margin:0">${reg}</select><button class="btn chico peligro" data-a="regimen" ${E.fin ? 'disabled' : ''}>Proclamar</button></div></div></div></div>`;
  }
  function hemiciclo(pct) {
    const n = 101, own = Math.round(n * pct / 100); let s = '', i = 0; const filas = [13, 17, 21, 24, 26];
    const pts = [];
    filas.forEach((c, f) => { const r = 40 + f * 13; for (let j = 0; j < c; j++) { const a = Math.PI - j / (c - 1) * Math.PI; pts.push([a, 110 + r * Math.cos(a), 108 - r * Math.sin(a)]); } });
    pts.sort((p, q) => q[0] - p[0]);
    pts.slice(0, n).forEach(([a, x, y]) => { s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.2" fill="${i < own ? '#a3302a' : '#b9b3a6'}"/>`; i++; });
    return `<svg class="hemiciclo" viewBox="0 0 220 116" width="260" role="img" aria-label="Escaños">${s}<text x="110" y="104" text-anchor="middle" font-size="16" font-family="Fraunces, serif" font-weight="700" fill="#1d2939">${fmt(pct)}%</text></svg>`;
  }

  // ---------------- LEYES ----------------
  function leyChips(L) {
    const c = [];
    for (const f in L.fac || {}) c.push({ t: R.FACCIONES[f].corto, v: L.fac[f], bueno: L.fac[f] > 0 });
    const add = (k, n, bueno, u, d) => { if (L[k]) c.push({ t: n, v: L[k], bueno: bueno(L[k]), txt: (L[k] > 0 ? '+' : '−') + fmt(Math.abs(L[k]), d == null ? 1 : d) + (u || '') }); };
    add('gasto', 'Gasto', v => v < 0, '% PIB'); add('ingreso', 'Ingresos', v => v > 0, '% PIB'); add('g', 'Crecimiento', v => v > 0, ' pts', 2);
    add('desemp', 'Desempleo', v => v < 0, ' pts'); add('desig', 'Desigualdad', v => v < 0, '', 0); add('corr', 'Corrupción', v => v < 0, '', 0); add('lib', 'Libertades', v => v > 0, '', 0);
    add('prest', 'Prestigio', v => v > 0, '', 0); add('infl', 'Inflación', v => v < 0, ' pts'); add('seg', 'Seguridad', v => v > 0, '', 0); add('salud', 'Salud', v => v > 0, '', 0); add('educacion', 'Educación', v => v > 0, '', 0);
    add('infra', 'Infraestructura', v => v > 0, '', 0); add('protestas', 'Protestas', v => v < 0, '', 0); add('legit', 'Legitimidad', v => v > 0, '', 0);
    if (L.regalias) c.push({ t: 'Regalías', v: 1, bueno: true, txt: 'más que el doble' });
    if (L.dinero) c.push({ t: 'Ingreso único', v: 1, bueno: true, txt: `+${fmt(L.dinero, 1)}% PIB` });
    if (L.subsidioEnergia) c.push({ t: 'Costo', v: -1, bueno: false, txt: 'según el precio del petróleo' });
    if (L.temporal) c.push({ t: 'Temporal', v: 0, bueno: null, txt: `${L.temporal} trimestres` });
    if (L.rel) for (const k in L.rel) c.push({ t: 'Relación: ' + ({ occ: 'Occidente', eje: 'Eje' }[k] || k), v: L.rel[k], bueno: L.rel[k] > 0 });
    return c;
  }
  function tabLeyes() {
    const E = U.E, cats = {};
    for (const id of R.ORDEN_LEYES) { const L = R.LEYES[id]; (cats[L.cat] = cats[L.cat] || []).push(id); }
    const T = R.TIPOS[E.gob.tipo];
    let intro = T.demo && E.pol.escanos != null ? `Tienes ${fmt(E.pol.escanos)}% de los escaños. Una ley pasa sola si su apoyo supera ${50 + (E.gob.inst.legislativo === 'bicameral' ? 3 : 0)}; si no, hay que negociar (más caro e incierto)${E.gob.tipo === 'presidencial' || E.gob.tipo === 'federal' ? ' o decretarla, con riesgo de que la Corte la anule' : ''}.` : 'Gobiernas por decreto: las leyes se promulgan pagando su costo en capital político.';
    let s = `<div class="panel"><h3>Leyes <small>${Object.keys(E.gob.leyes).length} vigentes</small></h3><p class="nota">${intro}</p></div><div class="cat-leyes">`;
    for (const c in cats) {
      s += `<h4>${esc(c)}</h4>`;
      for (const id of cats[c]) {
        const L = R.LEYES[id], st = N.estadoLey(E, id);
        let lado;
        if (st.vigente) { const v = E.gob.leyes[id]; lado = `<span class="ok" style="color:var(--bien);font-weight:600">Vigente${v.hasta ? ` hasta ${fechaTxt(E, v.hasta)}` : ''}</span><button class="btn chico" data-a="derogar" data-v="${id}" ${E.fin ? 'disabled' : ''}>Derogar (${Math.ceil(L.pc / 2)})</button>`; }
        else if (st.ok === false && !st.costo) lado = `<span class="motivo">${esc(st.motivo)}</span>`;
        else {
          const ap = st.apoyo != null ? `<span class="nota">Apoyo ${fmt(st.apoyo)} / ${st.umbral}</span>` : '';
          const ch = st.choque && st.choque.length ? `<span class="motivo">Deroga: ${esc(st.choque.join(', '))}</span>` : '';
          if (st.modo === 'negociar') lado = `${ap}<button class="btn chico prim" data-a="ley" data-v="${id}" data-m="votar" ${st.ok && !E.fin ? '' : 'disabled'}>Negociar · ${Math.round(st.prob * 100)}% <span class="costo-pc" style="color:#fff">${st.costo}</span></button>${st.decreto ? `<button class="btn chico" data-a="ley" data-v="${id}" data-m="decreto" ${E.pol.pc >= st.decreto.costo && !E.fin ? '' : 'disabled'}>Decreto${st.decreto.anula ? ` · ${Math.round(st.decreto.anula * 100)}% anulación` : ''} <span class="costo-pc">${st.decreto.costo}</span></button>` : ''}${ch}`;
          else lado = `${ap}<button class="btn chico prim" data-a="ley" data-v="${id}" data-m="votar" ${st.ok && !E.fin ? '' : 'disabled'}>${st.modo === 'decreto' ? 'Promulgar' : 'Aprobar'} <span class="costo-pc" style="color:#fff">${st.costo}</span></button>${ch}`;
          if (!st.ok && st.motivo) lado += `<span class="motivo">${esc(st.motivo)}</span>`;
        }
        s += `<div class="ley ${st.vigente ? 'vigente' : ''}"><div><div class="n">${esc(L.nombre)}</div><div class="dsc">${esc(L.desc)}</div>${chipsHTML(leyChips(L))}</div><div class="lado">${lado}</div></div>`;
      }
    }
    return s + '</div>';
  }

  // ---------------- MUNDO ----------------
  function tabMundo() {
    const E = U.E;
    if (!U.sel) U.sel = E.pais.vecinos[0];
    const relDe = iso => E.mundo.p[iso].rel;
    const zooms = [['sub', 'Vecindario'], ['region', 'Continente'], ['mundo', 'Mundo']].map(([k, n]) => `<button class="opc ${U.zoom === k ? 'sel' : ''}" data-a="zoom" data-v="${k}">${n}</button>`).join('');
    const map = mapa({ cont: E.pais.cont, sub: E.pais.sub, vecinos: E.pais.vecinos, yo: { lat: E.pais.lat, lon: E.pais.lon, colores: E.pais.colores, nombre: E.pais.nombre, tamano: E.pais.tamano, semilla: E.pais.forma || E.semilla, km: E.pais.km }, rel: relDe, sel: U.sel, zoom: U.zoom, px: 480 });
    const al = E.pol.alin;
    const alin = `<div class="alinea"><i style="left:${50 + al / 2}%"></i></div><div class="alinea-et"><span>China / Rusia</span><span>${al > 25 ? 'Pro-occidental' : al < -25 ? 'Cercano al eje' : 'No alineado'}</span><span>Occidente</span></div>`;
    // lista de países
    const f = U.filtro.trim().toLowerCase();
    let lista = N.PAISES.filter(p => !f || p.nombre.toLowerCase().includes(f));
    const peso = p => (E.mundo.p[p.iso].vec ? 0 : N.POTENCIAS.includes(p.iso) ? 1 : p.cont === E.pais.cont ? 2 : 3);
    lista.sort((a, b) => peso(a) - peso(b) || E.mundo.p[b.iso].rel - E.mundo.p[a.iso].rel);
    if (!f) lista = lista.slice(0, 40);
    const filas = lista.map(p => { const q = E.mundo.p[p.iso]; const tags = [q.vec ? 'vecino' : '', q.disp ? 'disputa' : '', Object.keys(q.tr).map(t => R.TRATADOS[t].corto).join(', ')].filter(Boolean).join(' · '); return `<div class="pfila ${U.sel === p.iso ? 'sel' : ''}" data-a="selpais" data-iso="${p.iso}"><span>${esc(p.nombre)}<br><span class="tags">${esc(tags)}</span></span>${relBar(q.rel)}<span class="num" style="text-align:right">${fmt(q.rel)}</span></div>`; }).join('');
    // organizaciones
    const orgs = N.orgsDisponibles(E).map(id => {
      const O = R.ORGANIZACIONES[id], st = E.orgs[id];
      let lado, det = '';
      if (st && st.estado === 'miembro') { lado = `<button class="btn chico" data-a="salirorg" data-v="${id}">Salir</button>`; det = '<div class="ok">Miembro</div>'; }
      else if (st) { lado = ''; det = `<div class="nota">Negociando ingreso: faltan ${st.t - E.turno} trimestre(s)</div>`; }
      else { const r = N.reqOrg(E, id); lado = `<button class="btn chico" data-a="org" data-v="${id}" ${r.ok && !E.fin ? '' : 'disabled'}>Solicitar <span class="costo-pc">${2 + O.negocia}</span></button>`; det = r.ok ? '<div class="ok">Cumples los requisitos</div>' : `<div class="falta">${esc(r.faltan.join(' · '))}</div>`; }
      return `<div class="org"><div><b>${esc(O.nombre)}</b> <span class="nota">${esc(O.desc)}</span>${det}</div>${lado}</div>`;
    }).join('');
    const suc = E.mundo.sucesos.map(x => { const S = EVENTOS_SOB.SUCESOS[x.id]; return `<div class="efecto"><span>${esc(S.nombre)}</span><b class="nota">${x.t} trim.</b></div>`; }).join('') || '<div class="vacio">El mundo está tranquilo… por ahora.</div>';
    let guerra = '';
    if (E.guerra) { const G = E.guerra; guerra = `<div class="panel guerra"><h3>Guerra con ${esc(N.PX[G.con].nombre)} <small>${G.turnos} trimestres</small></h3><div class="frente"><i style="left:${50 + G.frente / 2}%"></i></div><div class="alinea-et"><span>Derrota</span><span>Frente: ${sg(G.frente)}</span><span>Victoria</span></div><p class="nota">Fuerza relativa: ${fmt((G.ratio || 0.5) * 100)}%. La guerra cuesta 3% del PIB por año, frena el crecimiento y desgasta al gobierno.</p></div>`; }
    return `${guerra}<div class="fila-mapa"><div class="panel"><h3>Mapa <small>color = relación contigo</small></h3><div class="chips" style="margin-bottom:8px">${zooms}</div>${map}<div class="leyenda-rel"><span>Hostil</span><span class="grad"></span><span>Amigo</span></div></div>
      <div class="panel ficha">${ficha(U.sel)}</div></div>
      <div class="fila"><div class="panel"><h3>Países <small>${N.PAISES.length}</small></h3><input class="buscador" data-in="filtro" placeholder="Buscar país…" value="${esc(U.filtro)}"><div class="lista-paises">${filas}</div></div>
      <div><div class="panel"><h3>Alineamiento</h3>${alin}<p class="nota" style="margin-top:6px">Tratados, alianzas y votos te acercan a un bloque. Las potencias rivales castigan a quien elige.</p></div>
      <div class="panel"><h3>Sucesos globales</h3>${suc}<div class="efecto"><span>Tensión internacional</span><b class="num">${fmt(E.mundo.tension)}</b></div></div>
      <div class="panel"><h3>Organizaciones</h3>${orgs || '<div class="vacio">Ninguna disponible en tu región.</div>'}</div></div></div>`;
  }
  function ficha(iso) {
    const E = U.E, P = N.PX[iso], q = E.mundo.p[iso];
    const potN = ['', 'Potencia regional', 'Gran potencia', 'Superpotencia'][P.pot];
    const ali = { occ: 'Occidental', eje: 'Eje China-Rusia', neu: 'No alineado' }[q.ali];
    const dato = (n, v) => `<div class="dato"><span>${n}</span><b>${v}</b></div>`;
    let s = `<h3>${esc(P.nombre)} <small>${esc(potN)}</small></h3>`;
    s += `<div style="margin-bottom:8px">${relBar(q.rel)}<div class="alinea-et"><span>Hostil</span><span>Relación ${sg(q.rel)}</span><span>Amigo</span></div></div>`;
    s += dato('Régimen', esc(N.NOMBRE_REG[q.reg])) + dato('Bloque', ali) + dato('Población', fmt(P.pob, P.pob < 10 ? 1 : 0) + ' M') + dato('PIB', 'US$ ' + fmt(q.pib) + ' mil M') + dato('Por habitante', 'US$ ' + fmt(q.pib / P.pob * 1000));
    if (P.bloques.length) s += dato('Organizaciones', esc(P.bloques.join(', ')));
    if (q.vec) s += dato('Vecino', q.disp ? '<span style="color:var(--mal)">con disputa territorial</span>' : 'sí');
    const trs = Object.keys(q.tr);
    if (trs.length) s += dato('Tratados', trs.map(t => esc(R.TRATADOS[t].corto)).join(', '));
    s += dato('Su ejército vs el tuyo', `${fmt(N.milDe(E, iso) / Math.max(0.01, E.eco.mil) * 100)}%`);
    // acciones
    const acc = (id) => { const A = N.ACCIONES[id], st = N.estadoAccion(E, id, iso); return `<div class="acc"><div><b>${esc(A.nombre)}</b> <span class="costo-pc">${A.pc}</span><div class="dsc">${esc(st.ok ? A.desc : st.motivo)}</div></div><button class="btn chico" data-a="accionp" data-v="${id}" data-iso="${iso}" ${st.ok && !E.fin ? '' : 'disabled'}>Ir</button></div>`; };
    s += `<h4 style="margin:12px 0 2px;font-size:14px">Diplomacia</h4>`;
    s += acc('visita');
    for (const t in R.TRATADOS) {
      const T = R.TRATADOS[t], st = N.estadoTratado(E, iso, t);
      if (st.vigente) { s += `<div class="acc"><div><b>${esc(T.nombre)}</b> <span style="color:var(--bien);font-size:12px">vigente</span></div><button class="btn chico" data-a="romper" data-iso="${iso}" data-v="${t}" ${E.fin ? 'disabled' : ''}>Romper</button></div>`; continue; }
      if (!st.ok && !st.prob) { if (['soloVecino', 'soloDisputa'].some(k => T[k]) && !(T.soloVecino && q.vec) && !(T.soloDisputa && q.disp)) continue; }
      s += `<div class="acc"><div><b>${esc(T.nombre)}</b> <span class="costo-pc">${T.pc}</span><div class="dsc">${esc(T.desc)}</div>${st.prob ? `<div class="p">Probabilidad de que acepte: <b>${Math.round(st.prob * 100)}%</b></div>` : ''}${!st.ok && st.motivo ? `<div class="dsc" style="color:var(--mal)">${esc(st.motivo)}</div>` : ''}</div><button class="btn chico prim" data-a="tratado" data-iso="${iso}" data-v="${t}" ${st.ok && !E.fin ? '' : 'disabled'}>Proponer</button></div>`;
    }
    s += acc('prestamo') + acc('condenar') + acc('expulsar');
    if (q.vec) s += E.guerra && E.guerra.con === iso ? acc('paz') : acc('guerra');
    return s;
  }

  // ---------------- CRÓNICA ----------------
  function tabCronica() { return `<div class="panel"><h3>Crónica de ${esc(U.E.pais.nombre)}</h3>${noticias(U.E.noticias)}</div>`; }

  // ---------------- FINAL ----------------
  function vistaFinal() {
    const E = U.E, F = E.fin, L = F.legado || N.legado(E);
    const dato = (n, v) => `<div class="efecto"><span>${n}</span><b>${v}</b></div>`;
    return `<div class="velo"><div class="final"><div class="nota" style="text-transform:uppercase;letter-spacing:.1em">${fechaTxt(E, F.turno)}</div><h2>${esc(F.titulo)}</h2><p>${esc(F.texto)}</p>
      <div class="rango">${esc(L.rango)}</div><div class="pts">${L.puntos}<span style="font-size:20px;color:var(--tenue)"> / 100</span></div>
      <div style="margin:14px 0">${dato('Años en el poder', fmt(L.anios, 1))}${dato('Desarrollo humano', L.idh0 != null ? `${L.idh0} → ${L.idh}` : L.idh)}${dato('PIB por habitante', (L.pibpc0 ? 'US$ ' + fmt(L.pibpc0) + ' → ' : '') + 'US$ ' + fmt(E.eco.pib / E.eco.pob * 1000))}${dato('Puesto mundial por ingreso', `${L.puestoPibpc}° de ${L.totalPaises}`)}${dato('Libertades', fmt(E.soc.libertad))}${dato('Corrupción', fmt(E.soc.corr))}${dato('Deuda pública', fmt(E.eco.deuda / E.eco.pib * 100) + '% PIB')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><button class="btn" data-a="cerrarfinal">Ver el país</button><button class="btn sello" data-a="nueva">Fundar otra nación</button></div></div></div>`;
  }

  // =====================================================================
  //                          RENDER Y ACCIONES
  // =====================================================================
  function render() {
    const y = window.scrollY;
    app.innerHTML = U.vista === 'inicio' ? vistaInicio() : U.vista === 'crear' ? vistaCrear() : vistaJuego();
    if (U.vista === 'juego') activarGraficos();
    window.scrollTo(0, y);
  }
  function tras(r) { if (r && r.texto) aviso(r.texto); guardar(); render(); }

  const ACC = {
    nueva: () => { U.cfg = cfgNuevo(); U.cands = {}; U.paso = 0; U.vista = 'crear'; U.verFinal = true; render(); window.scrollTo(0, 0); },
    continuar: () => { const E = cargar(); if (!E) return; U.E = E; U.vista = 'juego'; U.tab = E.pend.length ? 'despacho' : 'despacho'; U.antes = null; U.verFinal = true; render(); },
    inicio: () => { U.vista = 'inicio'; render(); },
    paso: d => { U.paso = Math.max(0, Math.min(3, U.paso + +d.d)); render(); window.scrollTo(0, 0); },
    cfg: d => { const c = U.cfg; let v = d.v; if (d.k === 'costa') { c.costa = v === 'si'; if (!c.costa) c.recursos = c.recursos.filter(r => !R.RECURSOS[r].costa); } else if (d.k === 'duracion') c.duracion = +v; else c[d.k] = v;
      if (d.k === 'continente') { c.ubic = null; ubicar(c); }
      if (d.k === 'tamano') ubicar(c);
      render(); },
    dado: d => { const o = { rng: (Date.now() ^ Math.random() * 1e9) >>> 0 }; U.cfg[d.k] = d.k === 'nombre' ? N.nombrePais(o) : d.k === 'capital' ? N.capitalAleatoria(o) : N.persona(o); render(); },
    ubic: d => { U.cfg.ubic = d.v; ubicar(U.cfg); render(); },
    recurso: d => { const c = U.cfg, i = c.recursos.indexOf(d.v); if (i >= 0) c.recursos.splice(i, 1); else if (c.recursos.length < 2) c.recursos.push(d.v); render(); },
    color: d => { U.cfg.colores[+d.i] = d.v; render(); },
    tipo: d => { U.cfg.tipo = d.v; U.cfg.inst = N.instPorDefecto(d.v); render(); },
    inst: d => { U.cfg.inst[d.k] = d.v; render(); },
    min: d => { const c = U.cfg, i = c.ministerios.indexOf(d.v); if (i >= 0) c.ministerios.splice(i, 1); else c.ministerios.push(d.v); render(); },
    cand: d => { U.cfg.selMin[d.m] = +d.i; render(); },
    fundar: () => { const E = N.crearPartida(cfgFinal()); U.E = E; U.vista = 'juego'; U.tab = 'despacho'; U.antes = null; U.resultado = null; U.resumen = null; U.sel = null; guardar(); render(); window.scrollTo(0, 0); },
    tab: d => { U.tab = d.v; U.minAbierto = null; render(); window.scrollTo(0, 0); },
    turno: () => {
      const E = U.E; const antes = snapshot(E);
      const r = N.avanzar(E); if (!r.ok) { aviso(r.motivo); return; }
      U.antes = antes; U.resultado = null;
      const a = snapshot(E);
      U.resumen = `Nuevo trimestre. La economía crece a ${fmt(a.crec, 1)}% anual con inflación de ${fmt(a.infl, 1)}%. Aprobación ${fmt(a.aprob)}% (${sg(a.aprob - antes.aprob)}). Recibes ${fmt(Math.max(0, a.pc - antes.pc))} de capital político.`;
      if (E.pend.length) U.tab = 'despacho';
      guardar(); render();
    },
    decidir: d => { const r = N.resolver(U.E, +d.i, +d.o); if (r) U.resultado = r; guardar(); render(); },
    accion: d => tras(N.ejecutar(U.E, d.v)),
    accionp: d => tras(N.ejecutar(U.E, d.v, d.iso)),
    tratado: d => tras(N.proponerTratado(U.E, d.iso, d.v)),
    romper: d => { if (!confirm(`¿Romper el ${R.TRATADOS[d.v].nombre.toLowerCase()} con ${N.PX[d.iso].nombre}?`)) return; tras(N.romperTratado(U.E, d.iso, d.v)); },
    org: d => tras(N.solicitarOrg(U.E, d.v)),
    salirorg: d => { if (!confirm(`¿Abandonar ${R.ORGANIZACIONES[d.v].nombre}?`)) return; tras(N.salirOrg(U.E, d.v)); },
    selpais: d => { U.sel = d.iso; if (U.tab !== 'mundo') U.tab = 'mundo'; render(); },
    nada: () => { },
    zoom: d => { U.zoom = d.v; render(); },
    ley: d => tras(N.aprobarLey(U.E, d.v, d.m === 'decreto' ? 'decreto' : null)),
    derogar: d => tras(N.derogarLey(U.E, d.v)),
    vermin: d => { U.minAbierto = U.minAbierto === d.m ? null : d.m; if (U.tab !== 'poder') U.tab = 'poder'; render(); },
    nombrar: d => { const r = N.nombrarMinistro(U.E, d.m, +d.i); U.minAbierto = null; tras(r); },
    suprimir: d => { if (!confirm(`¿Suprimir el Ministerio de ${R.MINISTERIOS[d.m].nombre}?`)) return; U.minAbierto = null; tras(N.eliminarMinisterio(U.E, d.m)); },
    crearmin: () => { const m = document.getElementById('nuevoMin').value; const r = N.crearMinisterio(U.E, m); if (r.ok) U.minAbierto = m; tras(r); },
    reforma: d => tras(N.reformarInst(U.E, d.k, d.v)),
    regimen: () => { const t = document.getElementById('nuevoReg').value; if (!confirm(`¿Proclamar una nueva Constitución: ${R.TIPOS[t].nombre}? Cuesta ${N.costoCambio(U.E, t)} de capital político.`)) return; tras(N.cambiarRegimen(U.E, t)); },
    cerrarfinal: () => { U.verFinal = false; render(); },
    menu: () => { if (confirm('¿Volver a la pantalla de inicio? La partida queda guardada.')) { U.vista = 'inicio'; render(); } },
  };
  app.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const f = ACC[b.dataset.a]; if (f) { if (b.tagName === 'INPUT') { f(b.dataset, b); return; } e.preventDefault(); f(b.dataset, b); } });
  app.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.in) {
      if (t.dataset.in === 'filtro') { U.filtro = t.value; const pos = t.selectionStart; render(); const n = app.querySelector('[data-in="filtro"]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } return; }
      U.cfg[t.dataset.in] = t.value.slice(0, 32) || '—';
      const nota = app.querySelector('.navcrear .nota'); if (nota && t.dataset.in === 'nombre') nota.textContent = U.cfg.nombre;
      return;
    }
    if (t.dataset.pres) {
      const k = t.dataset.pres, v = +t.value;
      if (k === 'tasaImp') N.fijarPresupuesto(U.E, { tasaImp: v }); else N.fijarPresupuesto(U.E, { gasto: { [k]: v } });
      const lab = app.querySelector(`[data-vpres="${k}"]`); if (lab) lab.textContent = fmt(v, 1) + '%';
      const bal = document.getElementById('balance'); if (bal) bal.innerHTML = balance();
      const lat = document.getElementById('lateral'); if (lat) lat.innerHTML = lateral();
    }
  });
  app.addEventListener('change', e => { if (e.target.dataset.pres) { guardar(); render(); } if (e.target.dataset.in && U.vista === 'crear') render(); });

  // gancho de pruebas
  window.__sob = {
    E: () => U.E, U,
    ff(n) { for (let i = 0; i < (n || 1) && U.E && !U.E.fin; i++) { while (U.E.pend.length && !U.E.fin) { const v = N.verEvento(U.E, U.E.pend[0]); let k = v.opciones.findIndex(o => !o.bloqueada && !o.ef.fin); if (k < 0) k = 0; N.resolver(U.E, 0, k); } if (!U.E.fin) { U.antes = snapshot(U.E); N.avanzar(U.E); } } guardar(); render(); return U.E.turno; },
    rapida(tipo) { U.cfg = cfgNuevo(); if (tipo) { U.cfg.tipo = tipo; U.cfg.inst = N.instPorDefecto(tipo); } ACC.fundar(); return U.E.pais.nombre; },
  };
  render();
})();
