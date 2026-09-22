/* ══════════════════════════════════════════════════════════
   MÁNAGER RELÁMPAGO · el motor
   Todo lo que tiene que dar EXACTAMENTE lo mismo en todos los
   teléfonos de la sala vive acá, sin tocar la pantalla ni la red:
   la base de jugadores, el draft, el fixture y la simulación.

   Nadie arbitra la partida desde un servidor. Cada navegador
   calcula los partidos por su cuenta a partir de lo que está
   escrito en la sala (los planteles y las tácticas de cada
   jornada), con un azar de semilla fija. Mismos datos, mismo
   resultado, en todos lados.
   ══════════════════════════════════════════════════════════ */

import CSV_DEFECTO, { NOMBRE_BASE } from "./base-chilena.js";

export const POSICIONES = ["POR", "DEF", "MED", "DEL"];

/* Lo mínimo que tiene que tener cada plantel para poder armar cualquier
   formación sin poner a nadie fuera de lugar en el arco. */
export const MINIMOS = { POR: 1, DEF: 3, MED: 3, DEL: 1 };
/* Hasta dónde tiene sentido apilar en cada puesto. Más de dos arqueros
   es tirar un pick; el draft no lo permite. */
export const MAXIMOS = { POR: 2, DEF: 7, MED: 7, DEL: 5 };
/* Lo que busca el piloto automático cuando se te acaba el tiempo. */
const IDEAL = { POR: 1, DEF: 4, MED: 4, DEL: 2 };

export const FORMACIONES = {
  "4-4-2": { DEF: 4, MED: 4, DEL: 2 },
  "4-3-3": { DEF: 4, MED: 3, DEL: 3 },
  "3-5-2": { DEF: 3, MED: 5, DEL: 2 },
  "5-3-2": { DEF: 5, MED: 3, DEL: 2 },
  "4-5-1": { DEF: 4, MED: 5, DEL: 1 },
  "3-4-3": { DEF: 3, MED: 4, DEL: 3 }
};

export const ESTILOS = {
  def: { nombre: "Defensivo",  ata: 0.92, def: 1.08 },
  eq:  { nombre: "Equilibrado", ata: 1.00, def: 1.00 },
  of:  { nombre: "Ofensivo",   ata: 1.08, def: 0.92 }
};
/* Piedra, papel o tijera: el defensivo castiga al que se va arriba
   (contragolpe), el ofensivo le gana al equilibrado (lo encierra) y el
   equilibrado desarma al defensivo (tiene paciencia). */
const LE_GANA = { def: "of", of: "eq", eq: "def" };
const BONO_ESTILO = 1.10;

/* ── azar con semilla ─────────────────────────────────────── */
export function hash(txt) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < txt.length; i++) {
    h ^= txt.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
export function azar(semilla) {
  let a = (typeof semilla === "number" ? semilla : hash(String(semilla))) >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function barajar(lista, r) {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/* ── jugadores ────────────────────────────────────────────── */
/* En la sala cada jugador va como un texto corto "nombre|POS|media|club|país".
   Firestore no guarda listas dentro de listas, y un texto por jugador es lo
   que menos pesa en el documento. */
const limpiarCampo = s => String(s == null ? "" : s).replace(/[|\n\r\t]/g, " ").replace(/\s+/g, " ").trim();

export function empacar(j) {
  return [limpiarCampo(j.nombre).slice(0, 28), j.pos, j.media,
          limpiarCampo(j.club).slice(0, 24), limpiarCampo(j.pais).slice(0, 20)].join("|");
}
export function desempacar(txt) {
  const p = String(txt).split("|");
  return { nombre: p[0] || "?", pos: POSICIONES.includes(p[1]) ? p[1] : "MED",
           media: Math.max(1, Math.min(99, parseInt(p[2], 10) || 50)),
           club: p[3] || "", pais: p[4] || "" };
}

/* ── la base por defecto ──────────────────────────────────────
   Figuras históricas del fútbol chileno, en base-chilena.js. Es un CSV igual
   al que se sube a mano, leído con el mismo lector. Viene con el juego, así
   que es idéntica en todos los teléfonos sin bajar nada aparte. */
let defectoCache = null, nombreDefecto = NOMBRE_BASE;
export function baseDefecto() {
  if (!defectoCache) defectoCache = leerBase(CSV_DEFECTO).jugadores;
  return defectoCache;
}
export function nombreBaseDefecto() { return nombreDefecto; }
/* La consola de administración guarda una versión editada de la base en
   Firestore. Si el juego la encuentra al arrancar, pasa a ser la de por defecto. */
export function fijarBaseDefecto(jugadores, nombre) {
  if (!jugadores || !jugadores.length) return;
  defectoCache = jugadores;
  if (nombre) nombreDefecto = String(nombre).slice(0, 40);
}
export function baseOriginal() { return leerBase(CSV_DEFECTO).jugadores; }
export { NOMBRE_BASE };

/* De vuelta a CSV, con el mismo formato que lee leerBase. */
export function aCSV(jugadores) {
  const campo = v => {
    const t = String(v == null ? "" : v);
    return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  };
  const conPais = jugadores.some(j => j.pais);
  const cab = conPais ? "nombre;posicion;media;club;pais" : "nombre;posicion;media;club";
  return cab + "\n" + jugadores.map(j =>
    [j.nombre, j.pos, j.media, j.club].concat(conPais ? [j.pais] : []).map(campo).join(";")).join("\n") + "\n";
}

/* ── bases propias (CSV o JSON) ───────────────────────────────
   Se aceptan los nombres de columna más comunes, en castellano o en inglés,
   y las posiciones detalladas de cualquier juego de fútbol se agrupan en las
   cuatro líneas del mánager. */
const ALIAS = {
  nombre: ["nombre", "name", "jugador", "player", "short_name", "long_name", "full_name", "apellido"],
  pos: ["posicion", "posición", "pos", "position", "positions", "player_positions", "puesto", "linea", "línea"],
  media: ["media", "overall", "ovr", "rating", "valoracion", "valoración", "nota", "calidad", "rat", "general"],
  club: ["club", "equipo", "team", "club_name", "squad"],
  pais: ["pais", "país", "nacion", "nación", "nationality", "nation", "country", "nationality_name", "seleccion", "selección"]
};

export function posicionDe(txt) {
  const t = String(txt || "").toUpperCase().split(/[,/;\s]+/).filter(Boolean)[0] || "";
  if (!t) return null;
  if (/^(POR|GK|ARQ|ARQUERO|PORTERO|GOALKEEPER|G|PT|GOL|GOLEIRO)$/.test(t)) return "POR";
  if (/^(DEF|DF|D|CB|LB|RB|LWB|RWB|DFC|LI|LD|CAI|CAD|DEFENSA|DEFENSOR|DEFENDER|ZAG|LAT)$/.test(t)) return "DEF";
  if (/^(MED|MF|M|MC|CM|CDM|CAM|LM|RM|MCD|MCO|MI|MD|MV|VOL|VOLANTE|MEDIO|MEDIOCAMPISTA|MIDFIELDER|DM|AM)$/.test(t)) return "MED";
  if (/^(DEL|FW|F|ST|CF|LW|RW|LF|RF|DC|EI|ED|SD|DELANTERO|FORWARD|ATTACKER|ATA|PUNTA|EXTREMO|ATT)$/.test(t)) return "DEL";
  if (t.startsWith("POR") || t.startsWith("ARQ") || t.startsWith("GOAL")) return "POR";
  if (t.startsWith("DEF") || t.startsWith("LAT") || t.startsWith("CENTRAL")) return "DEF";
  if (t.startsWith("MED") || t.startsWith("MID") || t.startsWith("VOL") || t.startsWith("CEN")) return "MED";
  if (t.startsWith("DEL") || t.startsWith("FOR") || t.startsWith("ATA") || t.startsWith("EXT") || t.startsWith("STR")) return "DEL";
  return null;
}

function normalizarClave(k) {
  return String(k || "").trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s-]+/g, "_");
}
function buscarColumna(claves, campo) {
  const alias = ALIAS[campo].map(normalizarClave);
  for (const a of alias) {
    const i = claves.findIndex(k => normalizarClave(k) === a);
    if (i >= 0) return i;
  }
  return -1;
}

/* Parte una línea de CSV respetando comillas. El separador se adivina con la
   primera línea: Excel en castellano guarda con punto y coma. */
function partirCSV(txt) {
  const primera = txt.split(/\r?\n/)[0] || "";
  const cuenta = c => primera.split(c).length;
  const sep = [";", ",", "\t"].sort((a, b) => cuenta(b) - cuenta(a))[0];
  const filas = [];
  let fila = [], campo = "", comillas = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (comillas) {
      if (c === '"' && txt[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && txt[i + 1] === "\n") i++;
      fila.push(campo); campo = "";
      if (fila.some(x => x.trim() !== "")) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  fila.push(campo);
  if (fila.some(x => x.trim() !== "")) filas.push(fila);
  return filas;
}

/* Devuelve { jugadores, descartados, avisos }. Nunca tira error por una fila
   mala: la salta y la cuenta, así una planilla a medio llenar igual sirve. */
export function leerBase(texto, nombreArchivo) {
  const txt = String(texto || "").replace(/^﻿/, "").trim();
  let filas = [];
  const avisos = [];
  if (!txt) return { jugadores: [], descartados: 0, avisos: ["El archivo está vacío."] };

  if (txt[0] === "[" || txt[0] === "{") {
    let datos;
    try { datos = JSON.parse(txt); }
    catch (e) { return { jugadores: [], descartados: 0, avisos: ["El JSON no se puede leer: " + e.message] }; }
    if (!Array.isArray(datos)) datos = datos.jugadores || datos.players || datos.data || [];
    if (!Array.isArray(datos) || !datos.length)
      return { jugadores: [], descartados: 0, avisos: ["El JSON no trae una lista de jugadores."] };
    const claves = Array.from(new Set(datos.flatMap(o => (o && typeof o === "object") ? Object.keys(o) : [])));
    filas = [claves].concat(datos.map(o => claves.map(k => (o && o[k] != null) ? String(o[k]) : "")));
  } else {
    filas = partirCSV(txt);
  }
  if (filas.length < 2) return { jugadores: [], descartados: 0, avisos: ["Hace falta una fila de títulos y al menos un jugador."] };

  const cab = filas[0];
  const col = {};
  for (const campo of Object.keys(ALIAS)) col[campo] = buscarColumna(cab, campo);
  if (col.nombre < 0 || col.pos < 0 || col.media < 0) {
    const faltan = ["nombre", "pos", "media"].filter(c => col[c] < 0)
      .map(c => ({ nombre: "nombre", pos: "posicion", media: "media" })[c]);
    return { jugadores: [], descartados: 0,
             avisos: ["Falta la columna " + faltan.join(", ") + ". Mirá la plantilla de ejemplo."] };
  }
  if (col.club < 0 && col.pais < 0) avisos.push("Sin columnas de club ni país: no va a haber química.");

  const jugadores = [];
  let descartados = 0;
  const vistos = new Set();
  for (let i = 1; i < filas.length; i++) {
    const f = filas[i];
    const nombre = limpiarCampo(f[col.nombre]);
    const pos = posicionDe(f[col.pos]);
    const media = Math.round(parseFloat(String(f[col.media] || "").replace(",", ".")));
    if (!nombre || !pos || !(media >= 1 && media <= 99) || vistos.has(nombre + pos)) { descartados++; continue; }
    vistos.add(nombre + pos);
    jugadores.push({ nombre, pos, media,
                     club: col.club >= 0 ? limpiarCampo(f[col.club]) : "",
                     pais: col.pais >= 0 ? limpiarCampo(f[col.pais]) : "" });
  }
  if (descartados) avisos.push(descartados + (descartados === 1 ? " fila salteada" : " filas salteadas") +
    " (sin nombre, posición o media entre 1 y 99, o repetidas).");
  if (nombreArchivo && !jugadores.length) avisos.push("No quedó ningún jugador válido en " + nombreArchivo + ".");
  return { jugadores, descartados, avisos };
}

export const PLANTILLA_CSV =
  "nombre;posicion;media;club;pais\n" +
  "Pedro Arquero;POR;78;Club del Barrio;Chile\n" +
  "Juan Central;DEF;74;Club del Barrio;Chile\n" +
  "Diego Volante;MED;81;Otro Club;Argentina\n" +
  "Luis Goleador;DEL;85;Club del Barrio;Perú\n";

/* ¿Alcanzan los jugadores de la base para que todos llenen su plantel? */
export function alcanzaBase(jugadores, equipos, picks) {
  const hay = { POR: 0, DEF: 0, MED: 0, DEL: 0 };
  for (const j of jugadores) hay[j.pos]++;
  const faltan = [];
  for (const p of POSICIONES) {
    const necesita = Math.max(MINIMOS[p] * equipos, p === "POR" ? equipos : 0);
    if (hay[p] < necesita) faltan.push(p + " (" + hay[p] + " de " + necesita + ")");
  }
  if (jugadores.length < equipos * picks) faltan.push("total (" + jugadores.length + " de " + (equipos * picks) + ")");
  return faltan;
}

/* ── el pozo del draft ────────────────────────────────────────
   De la base completa se saca un pozo de 100 jugadores (más, solo si los
   picks de todos no entran en 100), repartido por puesto. No se elige al azar
   entre todos: de una base de miles, la mayoría serían suplentes de segunda.
   Se sortea entre los mejores de cada puesto, así cada draft es distinto y
   todos tienen de dónde elegir. */
export const TAM_POZO = 100;
export function armarPozo(base, equipos, picks, semilla) {
  const r = azar("pozo " + semilla);
  const total = Math.max(TAM_POZO, Math.ceil(equipos * picks * 1.25));
  const reparto = { POR: 0.12, DEF: 0.33, MED: 0.33, DEL: 0.22 };
  const pozo = [];
  for (const pos of POSICIONES) {
    const de = base.filter(j => j.pos === pos).sort((a, b) => b.media - a.media);
    const quiero = Math.max(Math.round(total * reparto[pos]),
                            MINIMOS[pos] * equipos + equipos, pos === "POR" ? equipos * 2 : 0);
    const cantera = de.slice(0, Math.ceil(quiero * 2.5));
    pozo.push(...barajar(cantera, r).slice(0, quiero));
  }
  pozo.sort((a, b) => b.media - a.media || (a.nombre < b.nombre ? -1 : 1));
  return pozo.map(empacar);
}

/* ── el draft ─────────────────────────────────────────────── */
/* Serpiente: 1-2-3-4, 4-3-2-1, 1-2-3-4... El que eligió último en una vuelta
   elige primero en la siguiente, así ser último no es un castigo. */
export function turnoDe(orden, n) {
  const e = orden.length;
  const vuelta = Math.floor(n / e);
  const i = n % e;
  return orden[vuelta % 2 === 0 ? i : e - 1 - i];
}

/* picks: { "0": índice en el pozo, "1": ... } → plantel de cada uno */
export function planteles(orden, picks, pozo) {
  const out = {};
  for (const id of orden) out[id] = [];
  const nums = Object.keys(picks || {}).map(Number).filter(n => n >= 0).sort((a, b) => a - b);
  for (const n of nums) {
    const id = turnoDe(orden, n);
    const idx = picks[n];
    if (out[id] && pozo[idx] != null) out[id].push(Object.assign({ idx }, desempacar(pozo[idx])));
  }
  return out;
}
export function tomados(picks) {
  return new Set(Object.values(picks || {}));
}
function contarPos(plantel) {
  const c = { POR: 0, DEF: 0, MED: 0, DEL: 0 };
  for (const j of plantel) c[j.pos]++;
  return c;
}

/* ¿Puede este plantel sumar un jugador de este puesto sin quedar trabado?
   Trabado es no tener picks suficientes para cubrir los mínimos que faltan. */
export function puedeElegir(plantel, pos, picksTotales) {
  const c = contarPos(plantel);
  if (c[pos] >= MAXIMOS[pos]) return false;
  c[pos]++;
  const quedan = picksTotales - plantel.length - 1;
  let faltan = 0;
  for (const p of POSICIONES) faltan += Math.max(0, MINIMOS[p] - c[p]);
  return faltan <= quedan;
}

/* ¿Queda en el pozo algún jugador que este plantel pueda sumar sin trabarse?
   Con una base chica, que se reparte casi entera, puede pasar que no: por
   ejemplo, que ya no queden arqueros para el último que no tiene. Ahí se
   levanta la restricción y se puede elegir a cualquiera, antes que dejar el
   draft trabado para siempre. */
export function hayOpcion(plantel, pozo, picks, picksTotales) {
  const ya = tomados(picks);
  for (let i = 0; i < pozo.length; i++) {
    if (!ya.has(i) && puedeElegir(plantel, desempacar(pozo[i]).pos, picksTotales)) return true;
  }
  return false;
}
export function pickValido(plantel, pos, pozo, picks, picksTotales) {
  return puedeElegir(plantel, pos, picksTotales) || !hayOpcion(plantel, pozo, picks, picksTotales);
}

/* El piloto automático: si se te acaba el reloj, elige por vos el mejor
   disponible del puesto que más te hace falta. Es determinista a propósito:
   si dos teléfonos lo corren a la vez, eligen al mismo. */
export function autoPick(plantel, pozo, picks, picksTotales, ruido) {
  const ya = tomados(picks);
  const c = contarPos(plantel);
  const libre = !hayOpcion(plantel, pozo, picks, picksTotales);
  let mejor = -1, mejorPuntos = -Infinity;
  for (let i = 0; i < pozo.length; i++) {
    if (ya.has(i)) continue;
    const j = desempacar(pozo[i]);
    if (libre ? false : !puedeElegir(plantel, j.pos, picksTotales)) continue;
    let puntos = j.media;
    if (c[j.pos] < IDEAL[j.pos]) puntos += 8;
    if (j.pos === "POR" && c.POR >= 1) puntos -= 25;
    /* Los rivales de la máquina no eligen siempre al mejor: un poco de ruido
       hace que cada draft contra ellos sea distinto y deja pasar alguna ganga. */
    if (ruido) puntos += ruido() * 7;
    if (puntos > mejorPuntos) { mejorPuntos = puntos; mejor = i; }
  }
  return mejor;
}

/* ── el once ──────────────────────────────────────────────── */
/* Fuera de su puesto rinde menos, y un jugador de campo en el arco es un
   desastre. */
function rindeEn(j, pos) {
  if (j.pos === pos) return j.media;
  if (pos === "POR" || j.pos === "POR") return j.media * 0.45;
  const vecinos = (j.pos === "MED") || (pos === "MED");
  return j.media * (vecinos ? 0.86 : 0.72);
}

export function armarOnce(plantel, formacion) {
  const f = FORMACIONES[formacion] || FORMACIONES["4-4-2"];
  const lugares = [["POR", 1], ["DEF", f.DEF], ["MED", f.MED], ["DEL", f.DEL]];
  const libres = plantel.slice().sort((a, b) => b.media - a.media || a.idx - b.idx);
  const once = [];
  /* Primero cada puesto con los suyos; después se rellenan los huecos con el
     que mejor rinda ahí aunque no sea de su puesto. */
  for (const [pos, n] of lugares) {
    let puestos = 0;
    for (let i = 0; i < libres.length && puestos < n; ) {
      if (libres[i].pos === pos) { once.push({ j: libres[i], en: pos, rinde: libres[i].media }); libres.splice(i, 1); puestos++; }
      else i++;
    }
  }
  for (const [pos, n] of lugares) {
    let faltan = n - once.filter(o => o.en === pos).length;
    while (faltan-- > 0 && libres.length) {
      let bi = 0;
      for (let i = 1; i < libres.length; i++) if (rindeEn(libres[i], pos) > rindeEn(libres[bi], pos)) bi = i;
      const j = libres.splice(bi, 1)[0];
      once.push({ j, en: pos, rinde: rindeEn(j, pos) });
    }
  }
  return { once, banco: libres };
}

/* Química: dos del mismo club se conocen de memoria, dos del mismo país algo.
   Se cuenta por pares dentro del once y se topa en +8 %. */
export function quimica(once) {
  let puntos = 0;
  for (let a = 0; a < once.length; a++) for (let b = a + 1; b < once.length; b++) {
    const x = once[a].j, y = once[b].j;
    if (x.club && x.club === y.club) puntos += 1;
    if (x.pais && x.pais === y.pais) puntos += 0.4;
  }
  return Math.min(8, puntos * 0.35);
}

const media = l => l.length ? l.reduce((s, x) => s + x, 0) / l.length : 40;

/* Tres números por equipo: cuánto defiende, cuánto maneja la pelota y cuánto
   ataca. Poner más gente en una línea la hace más fuerte, pero cada hombre
   de más en una es uno de menos en otra: ahí está la decisión. */
export function fuerza(plantel, formacion, estilo) {
  const { once } = armarOnce(plantel, formacion);
  const de = pos => once.filter(o => o.en === pos).map(o => o.rinde);
  const f = FORMACIONES[formacion] || FORMACIONES["4-4-2"];
  const q = 1 + quimica(once) / 100;
  const e = ESTILOS[estilo] || ESTILOS.eq;
  const por = media(de("POR")), def = media(de("DEF")), med = media(de("MED")), del = media(de("DEL"));
  const linea = n => 0.85 + 0.05 * n;
  return {
    def: (def * 0.72 + por * 0.28) * linea(f.DEF) * q * e.def,
    med: med * linea(f.MED) * q,
    ata: (del * 0.68 + med * 0.32) * linea(f.DEL + 0.5) * q * e.ata,
    quimica: Math.round(quimica(once) * 10) / 10,
    once
  };
}

/* ── el partido ───────────────────────────────────────────── */
export function jugarPartido(A, B, semilla) {
  const r = azar(semilla);
  const ta = A.tactica || {}, tb = B.tactica || {};
  const fa = fuerza(A.plantel, ta.f, ta.e), fb = fuerza(B.plantel, tb.f, tb.e);
  /* La posesión sale del medio campo, y exagerada: dos puntos de media en el
     medio ya se notan en la pelota. */
  const pa = Math.pow(fa.med, 5) / (Math.pow(fa.med, 5) + Math.pow(fb.med, 5));
  let xa = 1.3 * Math.pow(fa.ata / fb.def, 3.2) * Math.sqrt(pa / 0.5);
  let xb = 1.3 * Math.pow(fb.ata / fa.def, 3.2) * Math.sqrt((1 - pa) / 0.5);
  if (LE_GANA[ta.e] === tb.e) xa *= BONO_ESTILO;
  if (LE_GANA[tb.e] === ta.e) xb *= BONO_ESTILO;
  xa = Math.min(5, xa); xb = Math.min(5, xb);

  const goles = [];
  for (let min = 1; min <= 90; min++) {
    if (r() < xa / 90) goles.push({ min, lado: 0, autor: goleador(fa.once, r) });
    if (r() < xb / 90) goles.push({ min, lado: 1, autor: goleador(fb.once, r) });
  }
  const ga = goles.filter(g => g.lado === 0).length;
  const gb = goles.length - ga;
  return { ga, gb, goles, posesion: Math.round(pa * 100), xa: Math.round(xa * 100) / 100, xb: Math.round(xb * 100) / 100,
           bono: LE_GANA[ta.e] === tb.e ? 0 : LE_GANA[tb.e] === ta.e ? 1 : -1 };
}

function goleador(once, r) {
  const peso = o => o.j.media * ({ POR: 0.01, DEF: 0.35, MED: 1.2, DEL: 3.2 })[o.en];
  const total = once.reduce((s, o) => s + peso(o), 0);
  let x = r() * total;
  for (const o of once) { x -= peso(o); if (x <= 0) return o.j.nombre; }
  return once.length ? once[once.length - 1].j.nombre : "?";
}

/* ── el campeonato ───────────────────────────────────────────
   El formato sale solo de cuántos DT hay, para que la partida dure siempre
   más o menos lo mismo:
     2 DT      serie al mejor de tres
     3 o 4     liga ida y vuelta (seis fechas)
     5 a 8     liga a una rueda y final entre los dos primeros */
export function formato(n) {
  if (n <= 2) return { vueltas: 1, final: false, nombre: "Serie al mejor de tres",
                       detalle: "Tres partidos entre los dos. Gana el que suma más puntos." };
  if (n <= 4) return { vueltas: 2, final: false, nombre: "Liga ida y vuelta",
                       detalle: "Todos contra todos dos veces. Gana el primero de la tabla." };
  return { vueltas: 1, final: true, nombre: "Liga y final",
           detalle: "Todos contra todos una vez, y los dos primeros juegan la final. Si empatan, penales." };
}
export function totalFechas(orden) {
  const f = formato(orden.length);
  return fixture(orden, f.vueltas).length + (f.final ? 1 : 0);
}

/* Todos contra todos por el método del círculo. Con número impar, uno
   descansa cada fecha. De a dos, se juega al mejor de tres. */
export function fixture(orden, vueltas) {
  const ids = orden.slice();
  if (ids.length % 2) ids.push(null);
  const n = ids.length;
  const ida = [];
  let rueda = ids.slice();
  for (let f = 0; f < n - 1; f++) {
    const fecha = [];
    for (let i = 0; i < n / 2; i++) {
      const a = rueda[i], b = rueda[n - 1 - i];
      if (a != null && b != null) fecha.push(f % 2 ? [b, a] : [a, b]);
    }
    ida.push(fecha);
    rueda = [rueda[0], rueda[n - 1]].concat(rueda.slice(1, n - 1));
  }
  const repeticiones = Math.max(1, vueltas) * (orden.length === 2 ? 3 : 1);
  const todo = [];
  for (let v = 0; v < repeticiones; v++) {
    for (const fecha of ida) todo.push(v % 2 ? fecha.map(([a, b]) => [b, a]) : fecha);
  }
  return todo;
}

export function descansa(orden, fecha) {
  const juegan = new Set(fecha.flat());
  return orden.filter(id => !juegan.has(id));
}

/* Juega todas las jornadas que ya están cerradas en el historial y arma la
   tabla. historial[j].t = { id: {f, e} } son las tácticas con que se jugó.
   La final, si la hay, no suma a la tabla: se agrega como una fecha más
   apenas termina la liga, con los dos primeros. */
export function temporada(codigo, orden, pozo, picks, historial) {
  const eq = planteles(orden, picks, pozo);
  const fmt = formato(orden.length);
  const fechas = fixture(orden, fmt.vueltas);
  const liga = fechas.length;
  const tabla = {};
  for (const id of orden) tabla[id] = { id, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0, forma: [] };
  const goleadores = {};
  const jornadas = [];
  const tacticaEn = (h, id) => (h && h.t && h.t[id]) || { f: "4-4-2", e: "eq" };
  const jugar = (h, j, a, b) => jugarPartido(
    { plantel: eq[a], tactica: tacticaEn(h, a) },
    { plantel: eq[b], tactica: tacticaEn(h, b) },
    codigo + "·" + j + "·" + a + "·" + b);
  const contarGoles = (res, a, b) => {
    for (const g of res.goles) {
      const k = g.autor + "|" + (g.lado === 0 ? a : b);
      goleadores[k] = (goleadores[k] || 0) + 1;
    }
  };

  const hist = historial || [];
  for (let j = 0; j < Math.min(liga, hist.length); j++) {
    const partidos = fechas[j].map(function ([a, b]) {
      const res = jugar(hist[j], j, a, b);
      anotar(tabla[a], res.ga, res.gb);
      anotar(tabla[b], res.gb, res.ga);
      contarGoles(res, a, b);
      return Object.assign({ a, b }, res);
    });
    jornadas.push({ partidos, descansa: descansa(orden, fechas[j]) });
  }
  const posiciones = Object.values(tabla).sort(ordenTabla);

  let final = null;
  if (fmt.final && hist.length >= liga) {
    const a = posiciones[0].id, b = posiciones[1].id;
    fechas.push([[a, b]]);
    if (hist[liga]) {
      const res = jugar(hist[liga], liga, a, b);
      contarGoles(res, a, b);
      /* Empate: penales. Pesa un poco quién tiene mejor arquero. */
      if (res.ga === res.gb) {
        const r = azar(codigo + "·penales·" + a + "·" + b);
        const arq = id => Math.max(0, ...eq[id].filter(x => x.pos === "POR").map(x => x.media));
        const pa = 0.5 + (arq(a) - arq(b)) / 200;
        let pa5 = 0, pb5 = 0;
        for (let k = 0; k < 5; k++) { if (r() < 0.75 - (arq(b) - 70) / 200) pa5++; if (r() < 0.75 - (arq(a) - 70) / 200) pb5++; }
        if (pa5 === pb5) { if (r() < pa) pa5++; else pb5++; }
        res.penales = [pa5, pb5];
      }
      const ganaA = res.ga > res.gb || (res.penales && res.penales[0] > res.penales[1]);
      final = Object.assign({ a, b, gana: ganaA ? a : b }, res);
      jornadas.push({ partidos: [Object.assign({ a, b }, res)], descansa: orden.filter(id => id !== a && id !== b), final: true });
    }
  }

  const terminada = hist.length >= liga + (fmt.final ? 1 : 0);
  const campeon = !terminada ? null : final ? final.gana : posiciones[0].id;
  const artilleros = Object.entries(goleadores)
    .map(([k, n]) => ({ nombre: k.split("|")[0], de: k.split("|")[1], goles: n }))
    .sort((a, b) => b.goles - a.goles || (a.nombre < b.nombre ? -1 : 1));
  return { tabla: posiciones, jornadas, fechas, artilleros, formato: fmt, liga, final, campeon };
}

function anotar(fila, gf, gc) {
  fila.pj++; fila.gf += gf; fila.gc += gc;
  if (gf > gc) { fila.g++; fila.pts += 3; fila.forma.push("G"); }
  else if (gf === gc) { fila.e++; fila.pts += 1; fila.forma.push("E"); }
  else { fila.p++; fila.forma.push("P"); }
}
function ordenTabla(a, b) {
  return b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf || (a.id < b.id ? -1 : 1);
}

/* ── los rivales de la máquina ────────────────────────────────
   Eligen la formación que mejor le calza a su plantel y un estilo con algo de
   azar. Si ya vieron al rival, a veces juegan a ganarle el piedra, papel o
   tijera con lo que usó la fecha pasada. */
const CONTRA = { of: "def", eq: "of", def: "eq" };
export function tacticaCPU(plantel, estiloPrevioRival, r) {
  let mejor = "4-4-2", mejorSuma = -Infinity;
  for (const f of Object.keys(FORMACIONES)) {
    const x = fuerza(plantel, f, "eq");
    const suma = x.def + x.med + x.ata + r() * 3;
    if (suma > mejorSuma) { mejorSuma = suma; mejor = f; }
  }
  let e;
  if (estiloPrevioRival && r() < 0.45) e = CONTRA[estiloPrevioRival];
  else { const x = r(); e = x < 0.45 ? "eq" : x < 0.75 ? "of" : "def"; }
  return { f: mejor, e };
}
