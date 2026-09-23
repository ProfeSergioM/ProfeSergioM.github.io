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

/* El estilo es un trueque simple: lo que se gana arriba se pierde atrás. El
   defensivo además hace más faltas, así que se llena de tarjetas. */
export const ESTILOS = {
  def: { nombre: "Defensivo",   ata: 0.90, def: 1.10, tarjetas: 1.25, detalle: "+defensa, −ataque, más tarjetas" },
  eq:  { nombre: "Equilibrado", ata: 1.00, def: 1.00, tarjetas: 1.00, detalle: "sin ajustes" },
  of:  { nombre: "Ofensivo",    ata: 1.10, def: 0.90, tarjetas: 0.90, detalle: "+ataque, −defensa" }
};

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
export function rindeEn(j, pos) {
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
export function fuerza(plantel, formacion, estilo, descansan, titulares) {
  return fuerzaDeOnce(elegirOnce(plantel, formacion, descansan, titulares), formacion, estilo);
}

/* El once del partido. Si el DT eligió titulares, juegan esos (los que estén
   disponibles) y, si faltan, se completa con los mejores del resto. Si no,
   se arma solo con los mejores, sin los que mandó a descansar (salvo que sin
   ellos no se llegue a once). */
export function elegirOnce(plantel, formacion, descansan, titulares) {
  if (titulares && titulares.length) {
    const elegidos = plantel.filter(j => titulares.includes(j.idx)).slice(0, 11);
    if (elegidos.length < 11) {
      const resto = plantel.filter(j => !titulares.includes(j.idx) && !(descansan || []).includes(j.idx))
        .sort((a, b) => b.media - a.media || a.idx - b.idx);
      elegidos.push(...resto.slice(0, 11 - elegidos.length));
    }
    return armarOnce(elegidos, formacion).once;
  }
  let lista = plantel;
  if (descansan && descansan.length) {
    const sin = plantel.filter(j => !descansan.includes(j.idx));
    if (sin.length >= 11) lista = sin;
  }
  return armarOnce(lista, formacion).once;
}

export function fuerzaDeOnce(once, formacion, estilo) {
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

/* ── el cansancio ─────────────────────────────────────────────
   Cada fecha, todos se recuperan un 35 % de lo que arrastran. Encima de eso,
   el que jugó suma 30 por partido completo (15 por medio) y el que no jugó
   descansa 25 más. Hasta 20 no se nota; de ahí en más cada punto baja el
   rendimiento un 0,4 %. Un titular fijo se estanca cerca de 86 (juega un 26 %
   peor); uno que rota cada tanto anda por la mitad. Con 16 hay que rotar. */
export const CANSANCIO = { porPartido: 30, conserva: 0.65, descanso: 25, umbral: 20, porPunto: 0.004, tope: 100 };
export function mermaCansancio(fat) {
  return Math.max(0, (fat || 0) - CANSANCIO.umbral) * CANSANCIO.porPunto;
}
export const MAX_CAMBIOS = 3;

/* ── el partido ─────────────────────────────────────────────
   Se juega minuto a minuto. Además de los goles pueden pasar cosas que
   cambian el partido y las fechas siguientes:
     tarjetas     la segunda amarilla es roja; la roja deja al equipo con diez
                  (ataca menos y le llegan más) y suspende una fecha. Tres
                  amarillas acumuladas en el campeonato también suspenden una.
     lesiones     el jugador sale, y las próximas fechas rinde menos.
     penales      a favor, que se pueden errar.
     goles en contra y goles anulados por el VAR.
     antes del partido: lluvia (menos goles), un jugador inspirado (su equipo
     ataca más y él patea más) o un arquero en su noche (le llegan menos).
   Todo sale de la semilla del partido: mismos datos, mismos eventos en
   todos los teléfonos. */
const PROB = {
  amarillas: 1.7,      // por equipo y partido, en promedio
  rojaDirecta: 0.025,
  lesion: 0.13,
  penal: 0.10,
  penalConvertido: 0.76,
  enContra: 0.03,      // de cada gol
  anulado: 0.04,       // de cada gol
  lluvia: 0.10,
  figura: 0.08,
  arquero: 0.07
};

function elegir(lista, peso, r) {
  const total = lista.reduce((s, x) => s + peso(x), 0);
  if (!total) return lista[0] || null;
  let x = r() * total;
  for (const o of lista) { x -= peso(o); if (x <= 0) return o; }
  return lista[lista.length - 1];
}
const PESO_TARJETA = { POR: 0.15, DEF: 1.4, MED: 1.1, DEL: 0.6 };
const PESO_GOL = { POR: 0.01, DEF: 0.35, MED: 1.2, DEL: 3.2 };

/* Se juega en dos tiempos. En el entretiempo entran los cambios de cada DT
   (A.cambios, B.cambios: hasta tres "sale-entra" por índice del pozo) y la
   fuerza de cada equipo se recalcula con el once nuevo. El primer tiempo no
   depende de los cambios, así que se puede mostrar antes de que se hagan. */
export function jugarPartido(A, B, semilla) {
  const r = azar(semilla);
  const ta = A.tactica || {}, tb = B.tactica || {};
  const plantel = [A.plantel, B.plantel];
  const tac = [ta, tb];
  const fa = fuerza(A.plantel, ta.f, ta.e, ta.d, ta.x), fb = fuerza(B.plantel, tb.f, tb.e, tb.d, tb.x);
  const estilo = [ESTILOS[ta.e] || ESTILOS.eq, ESTILOS[tb.e] || ESTILOS.eq];
  /* La posesión sale del medio campo, y exagerada: dos puntos de media en el
     medio ya se notan en la pelota. */
  let pa = 0.5, x = [1, 1];
  const tasas = (Fa, Fb) => {
    pa = Math.pow(Fa.med, 5) / (Math.pow(Fa.med, 5) + Math.pow(Fb.med, 5));
    x = [
      Math.min(5, 1.08 * Math.pow(Fa.ata / Fb.def, 3.2) * Math.sqrt(pa / 0.5)),
      Math.min(5, 1.08 * Math.pow(Fb.ata / Fa.def, 3.2) * Math.sqrt((1 - pa) / 0.5))
    ];
  };
  tasas(fa, fb);
  const posesion1 = pa, x1 = x.slice();

  const once = [fa.once.slice(), fb.once.slice()];      // los once puestos, con los cambios
  const activos = [fa.once.slice(), fb.once.slice()];   // los que están en la cancha
  const mod = [1, 1];
  const eventos = [];
  const amonestados = [new Set(), new Set()];
  const expulsados = [new Set(), new Set()];
  const lesionados = [new Set(), new Set()];
  const inspirado = [null, null];
  const jugo = {};                                      // idx → [entra, sale]
  for (const t of [0, 1]) for (const o of once[t]) jugo[o.j.idx] = [0, 90];
  const ev = (min, lado, tipo, o, extra) => eventos.push(Object.assign(
    { min, lado, tipo, autor: o ? o.j.nombre : "", idx: o ? o.j.idx : null }, extra || {}));

  /* Antes de empezar. */
  let clima = 1;
  if (r() < PROB.lluvia) { clima = 0.8; ev(0, -1, "lluvia", null); }
  for (const t of [0, 1]) {
    if (r() < PROB.figura) {
      const o = elegir(activos[t].filter(o => o.en === "DEL" || o.en === "MED"), o => o.j.media, r);
      if (o) { inspirado[t] = o; mod[t] *= 1.12; ev(0, t, "figura", o); }
    }
    if (r() < PROB.arquero) {
      const o = activos[t].find(o => o.en === "POR");
      if (o) { mod[1 - t] *= 0.8; ev(0, t, "arquero", o); }
    }
  }

  const sacar = (t, o, min) => {
    activos[t] = activos[t].filter(x => x !== o);
    if (jugo[o.j.idx]) jugo[o.j.idx][1] = min;
  };
  const expulsar = (t, o, min) => {
    sacar(t, o, min); expulsados[t].add(o.j.idx);
    mod[t] *= 0.72; mod[1 - t] *= 1.22;
  };
  const gol = (t, min, o, extra) => {
    if (r() < PROB.anulado) { ev(min, t, "anulado", o); return; }
    ev(min, t, "gol", o, extra);
  };
  const goleador = t => elegir(activos[t], o => o.j.media * PESO_GOL[o.en] * (o === inspirado[t] ? 3 : 1), r);

  const minuto = min => {
    for (const t of [0, 1]) {
      if (!activos[t].length) continue;
      if (r() < PROB.amarillas * estilo[t].tarjetas / 90) {
        const o = elegir(activos[t], o => PESO_TARJETA[o.en], r);
        /* El que ya tiene amarilla se cuida: no siempre llega la segunda. */
        if (amonestados[t].has(o.j.idx)) { if (r() < 0.4) { ev(min, t, "roja", o, { doble: true }); expulsar(t, o, min); } }
        else { amonestados[t].add(o.j.idx); ev(min, t, "amarilla", o); }
      }
      if (r() < PROB.rojaDirecta / 90) {
        const o = elegir(activos[t], o => PESO_TARJETA[o.en], r);
        if (o) { ev(min, t, "roja", o); expulsar(t, o, min); }
      }
      if (r() < PROB.lesion / 90) {
        const o = elegir(activos[t], o => o.en === "POR" ? 0.3 : 1, r);
        if (o) {
          const grave = r() < 0.3;
          const fechas = grave ? 2 + Math.floor(r() * 2) : 1 + Math.floor(r() * 2);
          ev(min, t, "lesion", o, { grave, fechas, merma: grave ? 0.25 : 0.12 });
          /* Sale. Si todavía hay cambios, en el entretiempo se lo puede
             reemplazar; mientras tanto el equipo se resiente. */
          sacar(t, o, min); lesionados[t].add(o.j.idx);
          mod[t] *= 0.97;
        }
      }
      if (r() < PROB.penal / 90) {
        const o = activos[t].filter(o => o.en !== "POR").sort((p, q) => q.j.media - p.j.media)[0];
        if (o) {
          if (r() < PROB.penalConvertido) gol(t, min, o, { penal: true });
          else ev(min, t, "penalErrado", o);
        }
      }
      if (r() < x[t] * mod[t] * clima / 90) {
        if (r() < PROB.enContra) {
          const o = elegir(activos[1 - t].filter(o => o.en === "DEF"), () => 1, r) || activos[1 - t][0];
          if (o) { gol(t, min, o, { enContra: true }); continue; }
        }
        const o = goleador(t);
        if (o) gol(t, min, o);
      }
    }
  };

  /* Cómo está un equipo en un corte (el entretiempo o una lesión), para que
     el DT decida los cambios. La fatiga que se muestra es la de ese minuto. */
  const foto = (t, min) => {
    const enCancha = new Set(once[t].map(o => o.j.idx));
    const fatiga = {};
    for (const j of plantel[t]) fatiga[j.idx] = Math.round(j.fat || 0);
    for (const o of once[t]) if (activos[t].includes(o) && jugo[o.j.idx]) {
      const jugados = min - jugo[o.j.idx][0];
      fatiga[o.j.idx] = Math.round(Math.min(CANSANCIO.tope, (o.j.fat || 0) + CANSANCIO.porPartido * jugados / 90));
    }
    return {
      min, usados: usados[t],
      once: once[t].map(o => ({ idx: o.j.idx, en: o.en, rinde: Math.round(o.rinde) })),
      lesionados: [...lesionados[t]], expulsados: [...expulsados[t]], amonestados: [...amonestados[t]],
      banco: plantel[t].filter(j => !enCancha.has(j.idx) && !entraron[t].has(j.idx)).map(j => j.idx),
      fatiga
    };
  };

  /* Los cambios vienen como "minuto:sale-entra" (sin minuto, es el entretiempo).
     Se aplican al final de ese minuto, hasta tres por equipo en total. */
  const lista = [A.cambios, B.cambios].map(l => (l || []).map(c => {
    const m = String(c).match(/^(?:(\d+):)?(\d+)-(\d+)$/);
    return m ? { min: m[1] ? Number(m[1]) : 45, sale: Number(m[2]), entra: Number(m[3]) } : null;
  }).filter(Boolean));
  const usados = [0, 0];
  const entraron = [new Set(), new Set()];
  const aplicar = min => {
    let hubo = false;
    for (const t of [0, 1]) for (const c of lista[t]) {
      if (c.min !== min || usados[t] >= MAX_CAMBIOS) continue;
      const slot = once[t].findIndex(o => o.j.idx === c.sale);
      const nuevo = plantel[t].find(j => j.idx === c.entra);
      if (slot < 0 || !nuevo || entraron[t].has(c.entra) || expulsados[t].has(c.sale)) continue;
      if (once[t].some(o => o.j.idx === c.entra)) continue;
      usados[t]++; entraron[t].add(c.entra);
      const viejo = once[t][slot];
      const o = { j: nuevo, en: viejo.en, rinde: rindeEn(nuevo, viejo.en) };
      if (lesionados[t].has(c.sale)) mod[t] /= 0.97;       // vuelven a ser once
      else sacar(t, viejo, min);
      once[t][slot] = o;
      activos[t].push(o);
      jugo[c.entra] = [min, 90];
      ev(min === 45 ? 46 : min, t, "cambio", o, { sale: viejo.j.nombre, desde: nuevo.pos, en: viejo.en });
      hubo = true;
    }
    return hubo;
  };

  const cortes = {};
  for (let min = 1; min <= 90; min++) {
    const antes = eventos.length;
    minuto(min);
    if (min === 45) {
      /* Entretiempo. Los que jugaron el primer tiempo llegan con más
         cansancio y rinden menos en el segundo: el motivo principal para
         cambiar. */
      for (const t of [0, 1]) {
        once[t] = once[t].map(o => {
          if (!activos[t].includes(o)) return o;
          const previa = o.j.fat || 0;
          const ahora = Math.min(CANSANCIO.tope, previa + CANSANCIO.porPartido / 2);
          const factor = (1 - mermaCansancio(ahora)) / (1 - mermaCansancio(previa));
          const nuevo = Object.assign({}, o, { rinde: o.rinde * factor });
          activos[t] = activos[t].map(x => x === o ? nuevo : x);
          if (inspirado[t] === o) inspirado[t] = nuevo;
          return nuevo;
        });
      }
      cortes[45] = [foto(0, 45), foto(1, 45)];
      aplicar(45);
      /* El segundo tiempo se juega con la fuerza recalculada. */
      tasas(fuerzaDeOnce(once[0], ta.f, ta.e), fuerzaDeOnce(once[1], tb.f, tb.e));
    } else if (min < 90 && eventos.slice(antes).some(e => e.tipo === "lesion")) {
      /* Una lesión: el DT puede hacer el cambio en ese mismo minuto. */
      cortes[min] = [foto(0, min), foto(1, min)];
      if (aplicar(min)) tasas(fuerzaDeOnce(once[0], ta.f, ta.e), fuerzaDeOnce(once[1], tb.f, tb.e));
    }
  }
  const medio = cortes[45];

  const minutos = {};
  for (const [idx, [e, s]] of Object.entries(jugo)) minutos[idx] = Math.max(0, s - e);
  const goles = eventos.filter(e => e.tipo === "gol");
  return {
    ga: goles.filter(g => g.lado === 0).length, gb: goles.filter(g => g.lado === 1).length,
    goles, eventos, medio, cortes, minutos,
    posesion: Math.round(((posesion1 + pa) / 2) * 100),
    xa: Math.round(x1[0] * 100) / 100, xb: Math.round(x1[1] * 100) / 100
  };
}

/* Los cambios que hace la máquina en el entretiempo: primero reemplaza a los
   lesionados, después saca a los más cansados o a los defensores amonestados
   si en el banco hay alguien que rinda parecido en ese puesto. */
export function cambiosCPU(medio, disponibles) {
  const porIdx = new Map(disponibles.map(j => [j.idx, j]));
  const banco = medio.banco.map(i => porIdx.get(i)).filter(Boolean);
  const usados = new Set(), out = [];
  const tope = MAX_CAMBIOS - (medio.usados || 0);
  const mejorPara = en => banco.filter(j => !usados.has(j.idx))
    .sort((a, b) => rindeEn(b, en) - rindeEn(a, en) || a.idx - b.idx)[0];
  for (const o of medio.once) {
    if (out.length >= tope || !medio.lesionados.includes(o.idx)) continue;
    const j = mejorPara(o.en);
    if (j) { usados.add(j.idx); out.push(o.idx + "-" + j.idx); }
  }
  const candidatos = medio.once
    .filter(o => !medio.lesionados.includes(o.idx) && !medio.expulsados.includes(o.idx) && o.en !== "POR")
    .map(o => ({ o, j: porIdx.get(o.idx) })).filter(x => x.j)
    .sort((a, b) => (medio.fatiga[b.o.idx] || 0) - (medio.fatiga[a.o.idx] || 0));
  for (const { o, j } of candidatos) {
    if (out.length >= tope) break;
    const amonestado = medio.amonestados.includes(o.idx) && o.en === "DEF";
    if ((medio.fatiga[o.idx] || 0) < 50 && !amonestado) continue;
    const r = mejorPara(o.en);
    const actual = o.rinde != null ? o.rinde : rindeEn(j, o.en);
    if (r && rindeEn(r, o.en) >= actual - 3) { usados.add(r.idx); out.push(o.idx + "-" + r.idx); }
  }
  return out;
}

/* El cambio inmediato que hace la máquina cuando se le lesiona alguien: entra
   el que mejor rinde en ese puesto, si le quedan cambios. */
export function cambioLesionCPU(corte, disponibles, lesionado) {
  if (corte.usados >= MAX_CAMBIOS) return [];
  const o = corte.once.find(x => x.idx === lesionado);
  if (!o) return [];
  const porIdx = new Map(disponibles.map(j => [j.idx, j]));
  const j = corte.banco.map(i => porIdx.get(i)).filter(Boolean)
    .sort((a, b) => rindeEn(b, o.en) - rindeEn(a, o.en) || a.idx - b.idx)[0];
  return j ? [lesionado + "-" + j.idx] : [];
}

/* Modo con tope: solo entran al draft los jugadores con OVR hasta ese número. */
export const TOPES = [0, 85, 80, 75, 70];
export function conTope(base, tope) {
  return tope ? base.filter(j => j.media <= tope) : base;
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
   apenas termina la liga, con los dos primeros.

   Las fechas se juegan en orden porque lo que pasa en una pesa en la
   siguiente: el suspendido no juega y el lesionado rinde menos. Ese estado
   se arrastra jugador por jugador (por su índice en el pozo). */
export function temporada(codigo, orden, pozo, picks, historial) {
  const eq = planteles(orden, picks, pozo);
  const fmt = formato(orden.length);
  const fechas = fixture(orden, fmt.vueltas);
  const liga = fechas.length;
  const tabla = {};
  for (const id of orden) tabla[id] = { id, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0, forma: [] };
  const goleadores = {};
  const tarjetas = {};
  const jornadas = [];
  const est = {};   // idx → { am, susp, motivo, les, merma, fat }
  const de = idx => est[idx] || (est[idx] = { am: 0, susp: 0, motivo: "", les: 0, merma: 0, fat: 0 });

  /* Los que pueden jugar, con la media ya rebajada por lesión y cansancio. */
  const disponibles = id => eq[id]
    .filter(j => !(est[j.idx] && est[j.idx].susp > 0))
    .map(j => {
      const e = est[j.idx];
      if (!e || (!e.les && !e.fat)) return j;
      const merma = e.les > 0 ? e.merma : 0;
      const cansancio = mermaCansancio(e.fat);
      return Object.assign({}, j, {
        media: Math.max(1, Math.round(j.media * (1 - merma) * (1 - cansancio))),
        base: j.media, merma, les: e.les, fat: Math.round(e.fat), cansancio
      });
    });

  const tacticaEn = (h, id) => (h && h.t && h.t[id]) || { f: "4-4-2", e: "eq" };
  const cambiosEn = (h, id) => (h && h.c && h.c[id]) || [];
  const jugar = (h, j, a, b) => {
    const disp = [disponibles(a), disponibles(b)];
    const res = jugarPartido(
      { plantel: disp[0], tactica: tacticaEn(h, a), cambios: cambiosEn(h, a) },
      { plantel: disp[1], tactica: tacticaEn(h, b), cambios: cambiosEn(h, b) },
      codigo + "·" + j + "·" + a + "·" + b);
    return Object.assign(res, { disp });
  };

  /* Después de cada fecha: los suspendidos que no jugaron ya cumplieron, las
     lesiones avanzan una fecha, y se anotan las tarjetas y lesiones nuevas. */
  const cerrarFecha = (partidos) => {
    const jugaron = new Set(partidos.flatMap(p => [p.a, p.b]));
    for (const id of jugaron) for (const j of eq[id]) {
      const e = est[j.idx];
      if (e && e.susp > 0) { e.susp--; if (!e.susp) e.motivo = ""; }
    }
    /* Cansancio: suma por los minutos jugados, y el que no jugó (o su equipo
       descansó) recupera. */
    const minutos = {};
    for (const p of partidos) Object.assign(minutos, p.minutos);
    for (const id of orden) for (const j of eq[id]) {
      const m = minutos[j.idx] || 0;
      const x = de(j.idx);
      x.fat = Math.max(0, Math.min(CANSANCIO.tope, x.fat * CANSANCIO.conserva +
        (m > 0 ? CANSANCIO.porPartido * m / 90 : -CANSANCIO.descanso)));
    }
    for (const e of Object.values(est)) if (e.les > 0) { e.les--; if (!e.les) e.merma = 0; }
    for (const p of partidos) for (const e of p.eventos) {
      if (e.idx == null) continue;
      const dueño = e.lado === 0 ? p.a : p.b;
      if (e.tipo === "amarilla") {
        const x = de(e.idx);
        x.am++;
        tarjetas[e.idx] = tarjetas[e.idx] || { nombre: e.autor, de: dueño, am: 0, ro: 0 };
        tarjetas[e.idx].am++;
        if (x.am >= 3) { x.am = 0; x.susp = 1; x.motivo = "3 amarillas"; }
      } else if (e.tipo === "roja") {
        const x = de(e.idx);
        x.susp = 1; x.motivo = e.doble ? "doble amarilla" : "roja directa";
        tarjetas[e.idx] = tarjetas[e.idx] || { nombre: e.autor, de: dueño, am: 0, ro: 0 };
        tarjetas[e.idx].ro++;
      } else if (e.tipo === "lesion") {
        const x = de(e.idx);
        x.les = Math.max(x.les, e.fechas); x.merma = Math.max(x.merma, e.merma);
      } else if (e.tipo === "gol" && !e.enContra) {
        const k = e.autor + "|" + dueño;
        goleadores[k] = (goleadores[k] || 0) + 1;
      }
    }
  };

  const hist = historial || [];
  for (let j = 0; j < Math.min(liga, hist.length); j++) {
    const partidos = fechas[j].map(function ([a, b]) {
      const res = jugar(hist[j], j, a, b);
      anotar(tabla[a], res.ga, res.gb);
      anotar(tabla[b], res.gb, res.ga);
      return Object.assign({ a, b }, res);
    });
    cerrarFecha(partidos);
    jornadas.push({ partidos, descansa: descansa(orden, fechas[j]) });
  }
  const posiciones = Object.values(tabla).sort(ordenTabla);

  let final = null;
  if (fmt.final && hist.length >= liga) {
    const a = posiciones[0].id, b = posiciones[1].id;
    fechas.push([[a, b]]);
    if (hist[liga]) {
      const res = jugar(hist[liga], liga, a, b);
      /* Empate: penales. Pesa un poco quién tiene mejor arquero. */
      if (res.ga === res.gb) {
        const r = azar(codigo + "·penales·" + a + "·" + b);
        const arq = id => Math.max(0, ...disponibles(id).filter(x => x.pos === "POR").map(x => x.media));
        const pa = 0.5 + (arq(a) - arq(b)) / 200;
        let pa5 = 0, pb5 = 0;
        for (let k = 0; k < 5; k++) { if (r() < 0.75 - (arq(b) - 70) / 200) pa5++; if (r() < 0.75 - (arq(a) - 70) / 200) pb5++; }
        if (pa5 === pb5) { if (r() < pa) pa5++; else pb5++; }
        res.penales = [pa5, pb5];
      }
      const ganaA = res.ga > res.gb || (res.penales && res.penales[0] > res.penales[1]);
      final = Object.assign({ a, b, gana: ganaA ? a : b }, res);
      const partido = Object.assign({ a, b }, res);
      cerrarFecha([partido]);
      jornadas.push({ partidos: [partido], descansa: orden.filter(id => id !== a && id !== b), final: true });
    }
  }

  /* Cómo llega cada equipo a la próxima fecha: quién puede jugar, quién no y
     quién está a una amarilla de la suspensión. */
  const proximo = {};
  for (const id of orden) {
    const bajas = [], alLimite = [];
    for (const j of eq[id]) {
      const e = est[j.idx];
      if (!e) continue;
      if (e.susp > 0) bajas.push({ nombre: j.nombre, pos: j.pos, tipo: "susp", motivo: e.motivo });
      else if (e.les > 0) bajas.push({ nombre: j.nombre, pos: j.pos, tipo: "lesion", fechas: e.les, merma: e.merma });
      if (e.am === 2 && !(e.susp > 0)) alLimite.push({ nombre: j.nombre, pos: j.pos });
    }
    proximo[id] = { disponibles: disponibles(id), bajas, alLimite };
  }

  const terminada = hist.length >= liga + (fmt.final ? 1 : 0);
  const campeon = !terminada ? null : final ? final.gana : posiciones[0].id;
  const artilleros = Object.entries(goleadores)
    .map(([k, n]) => ({ nombre: k.split("|")[0], de: k.split("|")[1], goles: n }))
    .sort((a, b) => b.goles - a.goles || (a.nombre < b.nombre ? -1 : 1));
  const amonestados = Object.values(tarjetas)
    .sort((a, b) => (b.ro * 3 + b.am) - (a.ro * 3 + a.am) || (a.nombre < b.nombre ? -1 : 1));
  return { tabla: posiciones, jornadas, fechas, artilleros, amonestados, proximo, formato: fmt, liga, final, campeon };
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
   Eligen la formación que mejor le calza a lo que tienen disponible, y el
   estilo según cómo se ven contra el rival: si son más fuertes salen a
   atacar, si son más débiles se cierran. Con algo de azar, para que no sean
   del todo previsibles. */
export function tacticaCPU(plantel, plantelRival, r) {
  let mejor = "4-4-2", mejorSuma = -Infinity, mia = null;
  for (const f of Object.keys(FORMACIONES)) {
    const x = fuerza(plantel, f, "eq");
    const suma = x.def + x.med + x.ata + r() * 3;
    if (suma > mejorSuma) { mejorSuma = suma; mejor = f; mia = x; }
  }
  let e = "eq";
  if (plantelRival && plantelRival.length) {
    const rv = fuerza(plantelRival, "4-4-2", "eq");
    const d = (mia.def + mia.med + mia.ata) - (rv.def + rv.med + rv.ata);
    const x = r();
    e = d > 5 ? (x < 0.6 ? "of" : "eq") : d < -5 ? (x < 0.6 ? "def" : "eq") : (x < 0.6 ? "eq" : x < 0.8 ? "of" : "def");
  } else {
    const x = r(); e = x < 0.5 ? "eq" : x < 0.75 ? "of" : "def";
  }
  /* Descansa a los que están muy cansados, si quedan al menos 13 para elegir. */
  const d = [];
  const cansados = plantel.filter(j => (j.fat || 0) >= 70).sort((a, b) => b.fat - a.fat);
  for (const j of cansados) if (plantel.length - d.length > 13) d.push(j.idx);
  return { f: mejor, e, d };
}
