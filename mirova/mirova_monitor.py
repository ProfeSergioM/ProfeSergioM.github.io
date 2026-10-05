#!/usr/bin/env python3
"""
mirova_monitor.py: seguimiento temporal de anomalías térmicas publicadas por
MIROVA (Middle InfraRed Observation of Volcanic Activity, Universidad de Turín),
https://www.mirovaweb.it

Qué hace
--------
1. `actualizar`: lee la tabla de últimas detecciones (NRT/latest.php), filtra los
   volcanes en seguimiento y agrega las filas nuevas a un CSV por volcán
   (datos/<volcan>.csv). Cada fila queda identificada por fecha de adquisición
   del satélite y sensor, de modo que repetir la ejecución nunca duplica datos.
   También descarga las figuras oficiales de MIROVA (serie temporal VRP,
   log VRP, distancia y últimas 10 detecciones) sólo cuando cambiaron.
2. `graficar`: construye nuestras propias series temporales (30 días y 1 año)
   a partir del CSV acumulado, con un panel por ventana y leyenda compartida.
3. `resumen`: imprime y guarda un resumen por volcán (última detección, máximo
   de los últimos días, tendencia) en datos/estado.json y datos/resumen.md.
4. `todo`: los tres pasos anteriores en orden. Es lo que corre GitHub Actions.
5. `importar`: carga un histórico sin pisar lo que ya existe, desde el CSV
   "Raw data" del archivo oficial MIROVA Dataset
   (https://www.mirovaweb.it/ARCHIVE/Explore_Archive.php) o desde un CSV de
   NASA FIRMS (píxeles activos MODIS y VIIRS con su FRP). El formato se
   reconoce por el encabezado.
6. `firms`: descarga por la API de FIRMS los píxeles activos alrededor de cada
   volcán para un rango de fechas (clave gratuita en FIRMS_MAP_KEY) y los
   agrega por pasada. En `todo` se ejecuta para los últimos días si la clave
   está definida.

FIRMS entrega FRP (potencia radiativa del píxel, algoritmo de incendios) y
MIROVA entrega VRP (método MIR sobre el conjunto de píxeles anómalos). Miden
lo mismo físicamente pero no son intercambiables número a número; por eso los
datos de FIRMS se guardan con origen "firms", se dibujan con otro marcador y
no entran en las tendencias de MIROVA.

Sólo depende de la biblioteca estándar; matplotlib es opcional y se usa
únicamente en `graficar`.

Uso
---
    python mirova/mirova_monitor.py todo
    python mirova/mirova_monitor.py --volcanes Villarrica,Lascar actualizar
    python mirova/mirova_monitor.py graficar --dias 30 365
    python mirova/mirova_monitor.py resumen --dias 30
    python mirova/mirova_monitor.py --volcanes Villarrica importar Villarrica_MIROVA_Raw_data.csv
    python mirova/mirova_monitor.py importar fire_archive_SV-C2_123456.csv          # CSV de FIRMS, todos los volcanes
    FIRMS_MAP_KEY=... python mirova/mirova_monitor.py firms --desde 2025-03-07 --hasta 2026-10-05 --historico
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import os
import re
import shutil
import sys
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

# ---------------------------------------------------------------------------
# Constantes

BASE_URL = "https://www.mirovaweb.it"
LATEST_URL = f"{BASE_URL}/NRT/latest.php"
OUTPUT_URL = f"{BASE_URL}/OUTPUTweb/MIROVA"
DETALLE_URL = f"{BASE_URL}/NRT/volcanoDetails_MIR.php?volcano_id={{volcano_id}}"

FIRMS_API = "https://firms.modaps.eosdis.nasa.gov/api/area/csv/{clave}/{fuente}/{area}/{dias}/{fecha}"
FIRMS_DISPONIBILIDAD = "https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/{clave}/ALL"
FIRMS_FUENTES_NRT = ["MODIS_NRT", "VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"]
FIRMS_FUENTES_SP = ["MODIS_SP", "VIIRS_SNPP_SP", "VIIRS_NOAA20_SP"]
FIRMS_RADIO_KM = 25.0   # radio alrededor del volcán dentro del cual se consideran los píxeles
FIRMS_TRAMO_DIAS = 5    # máximo que admite la API por consulta (respuesta "Expects [1..5]")

USER_AGENT = (
    "mirova-monitor/1.0 (seguimiento academico de anomalias termicas; "
    "+https://profesergiom.github.io/mirova/)"
)
TIMEOUT_S = 40
PAUSA_S = 0.4  # pausa entre descargas, por cortesía con el servidor

AQUI = Path(__file__).resolve().parent

# Nombres de sensor tal como aparecen en latest.php -> nombre usado en rutas
# OUTPUTweb y en nuestros CSV.
SENSORES = {
    "MODIS": "MODIS",
    "VIIRS": "VIIRS750",
    "VIIRS750": "VIIRS750",
    "VIIRS375": "VIIRS375",
}

# Figuras oficiales que se descargan por volcán.
FIGURAS_COMB = ["VRP", "logVRP", "Dist"]
FIGURAS_SENSOR = ["Latest10NTI"]

COLUMNAS = [
    "fecha_utc",        # adquisición del satélite, UTC, ISO 8601
    "volcano_id",
    "volcan",
    "sensor",           # MODIS / VIIRS750 / VIIRS375
    "vrp_mw",           # potencia radiativa volcánica en MW (0 = sin anomalía)
    "distancia_km",     # distancia del píxel más caliente al cráter
    "dentro_radio",     # 1 si distancia_km <= limite_km del volcán
    "clasificacion",    # escala logarítmica de Coppola et al. (2016)
    "capturado_utc",    # cuándo lo leyó este monitor
    "origen",           # latest.php | mirova-archivo | firms (FRP, no VRP)
    "clase_mirova",     # etiqueta class del archivo MIROVA: 1 volcánica, 0 no volcánica, vacío si no aplica
]

FORMATOS_FECHA = (
    "%d-%b-%Y %H:%M:%S",
    "%d-%b-%Y %H:%M",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
    "%d/%m/%Y %H:%M:%S",
    "%d/%m/%Y %H:%M",
)

log = logging.getLogger("mirova")


# ---------------------------------------------------------------------------
# Configuración


@dataclass(frozen=True)
class Volcan:
    volcano_id: str
    mirova_name: str
    nombre: str
    limite_km: float
    lat: float = float("nan")   # coordenadas del Global Volcanism Program
    lon: float = float("nan")

    @property
    def archivo(self) -> str:
        """Nombre base para archivos: sin espacios ni guiones."""
        return re.sub(r"[^A-Za-z0-9]+", "_", self.nombre).strip("_")

    @property
    def url_detalle(self) -> str:
        return DETALLE_URL.format(volcano_id=self.volcano_id)


def cargar_config(ruta: Path) -> tuple[list[Volcan], list[str]]:
    with ruta.open(encoding="utf-8") as f:
        cfg = json.load(f)
    volcanes = [
        Volcan(str(v["volcano_id"]), v["mirova_name"], v["nombre"], float(v["limite_km"]),
               float(v.get("lat", "nan")), float(v.get("lon", "nan")))
        for v in cfg["volcanes"]
    ]
    return volcanes, list(cfg.get("seguimiento", []))


def elegir_volcanes(todos: list[Volcan], seguimiento: list[str], pedidos: list[str] | None) -> list[Volcan]:
    """Resuelve nombres o IDs (de la línea de comandos, de la variable
    MIROVA_VOLCANES o del campo 'seguimiento') a objetos Volcan."""
    claves = pedidos or [s for s in os.environ.get("MIROVA_VOLCANES", "").split(",") if s.strip()] or seguimiento
    if not claves or claves == ["todos"]:
        return todos
    elegidos: list[Volcan] = []
    for clave in claves:
        k = clave.strip().lower()
        hit = next(
            (v for v in todos if k in (v.volcano_id, v.mirova_name.lower(), v.nombre.lower(), v.archivo.lower())),
            None,
        )
        if hit is None:
            raise SystemExit(f"Volcán desconocido: {clave!r}. Agrégalo a volcanes.json.")
        if hit not in elegidos:
            elegidos.append(hit)
    return elegidos


# ---------------------------------------------------------------------------
# HTTP


def descargar(url: str, *, binario: bool = False, cabeceras: dict | None = None):
    """Devuelve (contenido, cabeceras_respuesta). Lanza HTTPError/URLError."""
    req = Request(url, headers={"User-Agent": USER_AGENT, **(cabeceras or {})})
    with urlopen(req, timeout=TIMEOUT_S) as resp:
        datos = resp.read()
        info = dict(resp.headers.items())
    if binario:
        return datos, info
    return datos.decode("utf-8", errors="replace"), info


# ---------------------------------------------------------------------------
# Parser de latest.php


class _Tabla(HTMLParser):
    """Extrae todas las filas (listas de celdas de texto) de las tablas HTML."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.filas: list[list[str]] = []
        self._fila: list[str] | None = None
        self._celda: list[str] | None = None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self._fila = []
        elif tag in ("td", "th") and self._fila is not None:
            self._celda = []

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._celda is not None and self._fila is not None:
            self._fila.append(" ".join("".join(self._celda).split()))
            self._celda = None
        elif tag == "tr" and self._fila is not None:
            if self._fila:
                self.filas.append(self._fila)
            self._fila = None

    def handle_data(self, data):
        if self._celda is not None:
            self._celda.append(data)


def _parsear_fecha(texto: str) -> datetime | None:
    t = texto.strip()
    for fmt in FORMATOS_FECHA:
        try:
            return datetime.strptime(t, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def _numero(texto: str) -> float | None:
    m = re.search(r"[-+]?\d+(?:[.,]\d+)?(?:[eE][-+]?\d+)?", texto)
    return float(m.group(0).replace(",", ".")) if m else None


def _mapa_columnas(cabecera: list[str]) -> dict[str, int] | None:
    """Reconoce columnas por su encabezado. Devuelve None si no parece cabecera."""
    mapa: dict[str, int] = {}
    for i, h in enumerate(cabecera):
        h = h.lower()
        if "vrp" in h or "power" in h:
            mapa.setdefault("vrp", i)
        elif "dist" in h:
            mapa.setdefault("dist", i)
        elif "sensor" in h or "sat" in h:
            mapa.setdefault("sensor", i)
        elif "date" in h or "time" in h or "fecha" in h or "acq" in h:
            mapa.setdefault("fecha", i)
        elif h in ("id", "volcano id", "volcano_id", "vnum") or h.endswith(" id"):
            mapa.setdefault("id", i)
        elif "volcano" in h or "name" in h or "nombre" in h:
            mapa.setdefault("nombre", i)
    return mapa if {"vrp", "fecha"} <= mapa.keys() else None


POSICIONAL = {"fecha": 0, "id": 1, "nombre": 2, "vrp": 3, "dist": 4, "sensor": 5}


def parsear_latest(html: str) -> list[dict]:
    """Convierte la tabla de latest.php en registros normalizados.

    Orden observado de columnas: fecha de adquisición (dd-Mmm-yyyy HH:MM:SS),
    volcano_id, nombre, VRP (MW), distancia (km), sensor. Si la página trae
    encabezados se usan éstos; si no, se asume el orden anterior.
    """
    p = _Tabla()
    p.feed(html)
    registros: list[dict] = []
    mapa = POSICIONAL
    for fila in p.filas:
        if len(fila) < 4:
            continue
        m = _mapa_columnas(fila)
        if m is not None:
            mapa = {**POSICIONAL, **m}
            continue
        if _parsear_fecha(fila[mapa["fecha"]]) is None:
            continue
        fecha = _parsear_fecha(fila[mapa["fecha"]])
        vrp = _numero(fila[mapa["vrp"]])
        dist = _numero(fila[mapa["dist"]]) if mapa["dist"] < len(fila) else None
        sensor_txt = fila[mapa["sensor"]].strip() if mapa["sensor"] < len(fila) else ""
        sensor = SENSORES.get(sensor_txt.upper().replace(" ", ""), sensor_txt or "DESCONOCIDO")
        if vrp is None:
            continue
        registros.append(
            {
                "fecha": fecha,
                "volcano_id": re.sub(r"\D", "", fila[mapa["id"]]) if mapa["id"] < len(fila) else "",
                "nombre": fila[mapa["nombre"]] if mapa["nombre"] < len(fila) else "",
                "vrp_mw": vrp,
                "distancia_km": dist if dist is not None else float("nan"),
                "sensor": sensor,
            }
        )
    return registros


def clasificar(vrp_mw: float) -> str:
    """Escala de intensidad de MIROVA (Coppola et al., 2016), en MW."""
    if vrp_mw <= 0:
        return "sin anomalia"
    if vrp_mw < 1:
        return "muy baja"
    if vrp_mw < 10:
        return "baja"
    if vrp_mw < 100:
        return "moderada"
    if vrp_mw < 1000:
        return "alta"
    return "muy alta"


# ---------------------------------------------------------------------------
# Almacenamiento CSV


def ruta_csv(raiz: Path, v: Volcan) -> Path:
    return raiz / "datos" / f"{v.archivo}.csv"


def leer_csv(ruta: Path) -> list[dict]:
    if not ruta.exists():
        return []
    with ruta.open(encoding="utf-8", newline="") as f:
        filas = list(csv.DictReader(f))
    for r in filas:
        r["fecha"] = datetime.fromisoformat(r["fecha_utc"]).replace(tzinfo=timezone.utc)
        r["vrp_mw"] = float(r["vrp_mw"])
        try:
            r["distancia_km"] = float(r["distancia_km"])
        except ValueError:
            r["distancia_km"] = float("nan")
        r["dentro_radio"] = r["dentro_radio"] == "1"
        r.setdefault("origen", "latest.php")
        r.setdefault("clase_mirova", "")
    return filas


def escribir_csv(ruta: Path, filas: list[dict]) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    filas = sorted(filas, key=lambda r: (r["fecha_utc"], r["sensor"]))
    with ruta.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNAS, extrasaction="ignore")
        w.writeheader()
        w.writerows(filas)


def integrar(v: Volcan, nuevos: list[dict], existentes: list[dict], ahora: datetime,
             origen: str = "latest.php") -> tuple[list[dict], int]:
    """Une registros nuevos con los existentes sin duplicar (fecha, sensor).
    Lo ya guardado nunca se pisa: una importación sólo rellena huecos."""
    claves = {(r["fecha_utc"], r["sensor"]) for r in existentes}
    agregados = 0
    salida = list(existentes)
    for n in nuevos:
        fecha_utc = n["fecha"].strftime("%Y-%m-%dT%H:%M:%S")
        clave = (fecha_utc, n["sensor"])
        if clave in claves:
            continue
        claves.add(clave)
        dist = n["distancia_km"]
        clase = n.get("clase", "")
        no_volcanica = clase == "0"
        # dentro_radio = 1 significa "anomalía atribuida al volcán": a menos de
        # limite_km del cráter y no marcada como no volcánica por MIROVA.
        dentro = (dist == dist) and dist <= v.limite_km and not no_volcanica  # dist == dist descarta NaN
        salida.append(
            {
                "fecha_utc": fecha_utc,
                "volcano_id": v.volcano_id,
                "volcan": v.nombre,
                "sensor": n["sensor"],
                "vrp_mw": f"{n['vrp_mw']:.4g}",
                "distancia_km": "" if dist != dist else f"{dist:.2f}",
                "dentro_radio": "1" if dentro else "0",
                "clasificacion": ("no volcanica" if no_volcanica and n["vrp_mw"] > 0 else
                                  clasificar(n["vrp_mw"]) if dentro or n["vrp_mw"] <= 0 else "fuera de radio"),
                "capturado_utc": ahora.strftime("%Y-%m-%dT%H:%M:%S"),
                "origen": origen,
                "clase_mirova": clase,
            }
        )
        agregados += 1
    return salida, agregados


# ---------------------------------------------------------------------------
# Figuras oficiales de MIROVA


def objetivos_figuras(v: Volcan) -> list[tuple[str, str, str]]:
    """(sensor, tipo, url) de cada figura oficial a descargar."""
    objetivos = []
    for tipo in FIGURAS_COMB:
        objetivos.append(("COMB", tipo, f"{OUTPUT_URL}/COMB/VOLCANOES/{v.mirova_name}/{v.mirova_name}_COMB_{tipo}.png"))
    for sensor in ("MODIS", "VIIRS750", "VIIRS375"):
        for tipo in FIGURAS_SENSOR:
            objetivos.append((sensor, tipo, f"{OUTPUT_URL}/{sensor}/VOLCANOES/{v.mirova_name}/{v.mirova_name}_{sensor}_{tipo}.png"))
    return objetivos


def descargar_figuras(raiz: Path, v: Volcan, archivar: bool) -> int:
    """Descarga las figuras oficiales si cambiaron (If-Modified-Since). Devuelve cuántas se actualizaron."""
    carpeta = raiz / "imagenes" / v.archivo
    carpeta.mkdir(parents=True, exist_ok=True)
    manifiesto_ruta = carpeta / "manifiesto.json"
    manifiesto = json.loads(manifiesto_ruta.read_text(encoding="utf-8")) if manifiesto_ruta.exists() else {}
    actualizadas = 0
    for sensor, tipo, url in objetivos_figuras(v):
        nombre = f"{v.archivo}_{sensor}_{tipo}.png"
        destino = carpeta / nombre
        previo = manifiesto.get(nombre, {})
        cab = {"If-Modified-Since": previo["last_modified"]} if previo.get("last_modified") and destino.exists() else {}
        try:
            datos, info = descargar(url, binario=True, cabeceras=cab)
        except HTTPError as e:
            if e.code == 304:
                continue
            log.info("Figura no disponible (%s): %s", e.code, url)
            continue
        except URLError as e:
            log.warning("No se pudo descargar %s: %s", url, e)
            continue
        finally:
            time.sleep(PAUSA_S)
        if not datos.startswith(b"\x89PNG"):
            log.info("Respuesta no es PNG, se ignora: %s", url)
            continue
        destino.write_bytes(datos)
        lm = info.get("Last-Modified", "")
        manifiesto[nombre] = {"url": url, "last_modified": lm, "bytes": len(datos),
                              "capturado_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")}
        if archivar:
            try:
                marca = parsedate_to_datetime(lm).astimezone(timezone.utc).strftime("%Y%m%d_%H%M%S") if lm else datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            except (TypeError, ValueError):
                marca = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            archivo = carpeta / "archivo" / f"{marca}_{sensor}_{tipo}.png"
            archivo.parent.mkdir(exist_ok=True)
            if not archivo.exists():
                shutil.copyfile(destino, archivo)
        actualizadas += 1
    manifiesto_ruta.write_text(json.dumps(manifiesto, indent=1, ensure_ascii=False), encoding="utf-8")
    return actualizadas


# ---------------------------------------------------------------------------
# Comandos


def cmd_actualizar(raiz: Path, volcanes: list[Volcan], *, con_imagenes: bool, archivar: bool, html_local: Path | None = None) -> dict:
    ahora = datetime.now(timezone.utc)
    if html_local is not None:
        html = html_local.read_text(encoding="utf-8")
    else:
        try:
            html, _ = descargar(LATEST_URL)
        except (HTTPError, URLError) as e:
            log.error("No se pudo leer %s: %s", LATEST_URL, e)
            raise SystemExit(2)
    registros = parsear_latest(html)
    log.info("latest.php: %d filas leídas", len(registros))
    if not registros:
        log.error("La tabla de latest.php no se pudo interpretar; revisa si cambió el formato de la página.")
        raise SystemExit(3)

    resultado = {}
    for v in volcanes:
        propios = [r for r in registros if r["volcano_id"] == v.volcano_id
                   or (not r["volcano_id"] and r["nombre"].replace(" ", "").lower() == v.mirova_name.lower())]
        ruta = ruta_csv(raiz, v)
        existentes = leer_csv(ruta)
        for r in existentes:  # volver a texto para reescribir
            r.pop("fecha", None)
            r["vrp_mw"] = f"{r['vrp_mw']:.4g}"
            r["distancia_km"] = "" if r["distancia_km"] != r["distancia_km"] else f"{r['distancia_km']:.2f}"
            r["dentro_radio"] = "1" if r["dentro_radio"] else "0"
        unidos, agregados = integrar(v, propios, existentes, ahora)
        if agregados or not ruta.exists():
            escribir_csv(ruta, unidos)
        figuras = descargar_figuras(raiz, v, archivar) if con_imagenes else 0
        log.info("%-22s filas en latest.php: %2d | nuevas: %2d | figuras actualizadas: %d",
                 v.nombre, len(propios), agregados, figuras)
        resultado[v.nombre] = {"en_latest": len(propios), "nuevas": agregados, "figuras": figuras}
    return resultado


# ---------------------------------------------------------------------------
# Importación de históricos


# Códigos de sensor del archivo MIROVA (ReadMe v1): 1 Terra, 2 Aqua, 3 SNPP, 4 NOAA-20.
SENSOR_ARCHIVO = {"1": "MODIS", "2": "MODIS", "3": "VIIRS750", "4": "VIIRS750", "5": "VIIRS750"}


def _leer_archivo_mirova(ruta: Path, volcano_id: str | None = None) -> list[dict]:
    """CSV de un solo volcán exportado del MIROVA Dataset (Explore_Archive.php,
    "Raw data"). Encabezado real (v2.5): id, timeUTC, IDvolc, Dayflag, Satellite
    (1 Terra, 2 Aqua, 3 SNPP, 4 NOAA-20), Resolution (1000/750/375), SatZen,
    SatAzi, Npix, Tot_Lmir_hot, Tot_Lmir_bk, VRP (W), LAT, LON, Max_Dist (m),
    Volc_Name, Volc_LAT, Volc_LON, class. Las columnas se reconocen por nombre
    para tolerar la versión 1 (UTC, Sensor, Dist) y variantes en MW o km.
    El archivo global de OSF (VRP_GLOBAL_ARCHIVE_2025.csv) trae todos los
    volcanes: si hay columna IDvolc y se indica `volcano_id`, se filtra por él.
    La etiqueta `class` (1 volcánica, 0 no volcánica) se conserva."""
    with ruta.open(encoding="utf-8", errors="replace", newline="") as f:
        muestra = f.read(4096)
        f.seek(0)
        try:
            dialecto = csv.Sniffer().sniff(muestra, delimiters=",;\t")
        except csv.Error:
            dialecto = csv.excel
        lector = csv.DictReader(f, dialect=dialecto)
        cab = {c: c.strip().lower() for c in (lector.fieldnames or [])}

        def col(*claves, excluir=()):
            for c, l in cab.items():
                if any(k in l for k in claves) and not any(x in l for x in excluir):
                    return c
            return None

        c_fecha = col("utc", "date", "fecha", "time")
        c_vrp = col("vrp")
        c_sensor = col("sensor", "sat")
        c_dist = col("dist")
        c_res = col("resol", "pixel", "res_")
        c_dia = col("dayflag", "day")
        c_id = col("idvolc", "volcano_id", "vnum")
        c_clase = next((c for c, l in cab.items() if l == "class"), None)
        if c_fecha is None or c_vrp is None:
            raise SystemExit(f"No reconozco las columnas de {ruta.name}: {lector.fieldnames}")
        vrp_en_mw = "mw" in cab[c_vrp]
        dist_en_km = c_dist is not None and "km" in cab[c_dist]
        registros = []
        for r in lector:
            if volcano_id and c_id and (r.get(c_id) or "").split(".")[0].strip() != volcano_id:
                continue
            fecha = _parsear_fecha(r[c_fecha])
            vrp = _numero(r[c_vrp] or "")
            if fecha is None or vrp is None:
                continue
            if not vrp_en_mw:
                vrp /= 1e6
            sensor_txt = (r.get(c_sensor) or "").strip() if c_sensor else ""
            sensor = SENSOR_ARCHIVO.get(sensor_txt) or SENSORES.get(sensor_txt.upper().replace(" ", "")) or ("MODIS" if "MOD" in sensor_txt.upper() else "VIIRS750" if "VIIRS" in sensor_txt.upper() else "DESCONOCIDO")
            if sensor.startswith("VIIRS") and c_res and "375" in (r.get(c_res) or ""):
                sensor = "VIIRS375"
            dist = _numero(r.get(c_dist) or "") if c_dist else None
            if dist is not None and not dist_en_km:
                dist /= 1000.0
            registros.append({"fecha": fecha, "vrp_mw": vrp, "distancia_km": dist if dist is not None else float("nan"),
                              "sensor": sensor, "dayflag": (r.get(c_dia) or "").strip() if c_dia else "",
                              "clase": (r.get(c_clase) or "").strip().split(".")[0] if c_clase else ""})
    return registros


def distancia_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distancia sobre la esfera (haversine), en km."""
    import math
    f1, f2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    a = math.sin((f2 - f1) / 2) ** 2 + math.cos(f1) * math.cos(f2) * math.sin(dl / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(a))


def _leer_firms(texto: str) -> list[dict]:
    """Píxeles activos de un CSV de FIRMS (descarga de archivo o respuesta de la
    API). Columnas usadas: latitude, longitude, acq_date, acq_time (HHMM UTC),
    satellite, instrument, frp (MW), daynight. Las demás se ignoran."""
    import io
    lector = csv.DictReader(io.StringIO(texto))
    campos = {c.strip().lower(): c for c in (lector.fieldnames or [])}
    if "frp" not in campos or "acq_date" not in campos:
        return []
    pixeles = []
    for r in lector:
        try:
            lat, lon, frp = float(r[campos["latitude"]]), float(r[campos["longitude"]]), float(r[campos["frp"]])
            hhmm = r[campos["acq_time"]].strip().zfill(4)
            fecha = datetime.strptime(f"{r[campos['acq_date']].strip()} {hhmm[:2]}:{hhmm[2:]}", "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
        except (KeyError, ValueError):
            continue
        instrumento = (r.get(campos.get("instrument", ""), "") or "").strip().upper()
        satelite = (r.get(campos.get("satellite", ""), "") or "").strip()
        pixeles.append({"fecha": fecha, "lat": lat, "lon": lon, "frp": frp, "satelite": satelite,
                        "sensor": "MODIS" if "MODIS" in instrumento or satelite in ("Terra", "Aqua", "T", "A") else "VIIRS375",
                        "dia": (r.get(campos.get("daynight", ""), "") or "").strip().upper() == "D"})
    return pixeles


def agrupar_firms(pixeles: list[dict], v: Volcan, radio_km: float = FIRMS_RADIO_KM) -> list[dict]:
    """Convierte píxeles en una lectura por pasada (fecha, satélite, sensor).

    Si en la pasada hay píxeles dentro del radio del cráter (`limite_km`), la
    lectura es la suma de su FRP y la distancia del más cercano: una anomalía
    del volcán. Si sólo hay píxeles entre `limite_km` y `radio_km`, la lectura
    es la suma de ésos con su distancia mínima, y quedará marcada fuera de
    radio, como hace MIROVA con incendios cercanos. Así un incendio a 20 km no
    infla la lectura del cráter de la misma pasada."""
    if v.lat != v.lat:
        raise SystemExit(f"{v.nombre} no tiene lat/lon en volcanes.json; hacen falta para FIRMS.")
    por_pasada: dict[tuple, list[tuple[float, float]]] = {}
    for px in pixeles:
        d = distancia_km(v.lat, v.lon, px["lat"], px["lon"])
        if d <= radio_km:
            por_pasada.setdefault((px["fecha"], px["satelite"], px["sensor"]), []).append((d, px["frp"]))
    pasadas = []
    for (fecha, _sat, sensor), pxs in por_pasada.items():
        cerca = [(d, f) for d, f in pxs if d <= v.limite_km]
        usados = cerca or pxs
        pasadas.append({"fecha": fecha, "sensor": sensor, "vrp_mw": sum(f for _, f in usados),
                        "distancia_km": min(d for d, _ in usados), "pixeles": len(usados)})
    return sorted(pasadas, key=lambda p: p["fecha"])


def _guardar_importados(raiz: Path, v: Volcan, nuevos: list[dict], origen: str, ahora: datetime) -> tuple[int, int]:
    ruta = ruta_csv(raiz, v)
    existentes = leer_csv(ruta)
    for r in existentes:
        r.pop("fecha", None)
        r["vrp_mw"] = f"{r['vrp_mw']:.4g}"
        r["distancia_km"] = "" if r["distancia_km"] != r["distancia_km"] else f"{r['distancia_km']:.2f}"
        r["dentro_radio"] = "1" if r["dentro_radio"] else "0"
    unidos, agregados = integrar(v, nuevos, existentes, ahora, origen=origen)
    if agregados:
        escribir_csv(ruta, unidos)
    return agregados, len(unidos)


def cmd_firms(raiz: Path, volcanes: list[Volcan], desde: datetime, hasta: datetime, fuentes: list[str], clave: str,
              nrt_recientes: bool = False) -> dict:
    """Descarga píxeles FIRMS alrededor de cada volcán, en tramos de hasta 10 días, y los agrega por pasada.

    Con `nrt_recientes`, se añaden las fuentes NRT a las indicadas. En cada
    tramo sólo se consultan las fuentes cuyo rango de fechas, según el endpoint
    de disponibilidad de FIRMS, cubre ese tramo: el procesamiento estándar (SP)
    termina meses antes de hoy y el NRT empieza donde aquél acaba. Una misma
    pasada presente en ambas se guarda una sola vez."""
    import math
    ahora_dt = datetime.now(timezone.utc)
    clave = (clave or "").strip().strip('"').strip("'")
    if not clave:
        raise SystemExit("Falta la clave de FIRMS: define FIRMS_MAP_KEY (gratuita en https://firms.modaps.eosdis.nasa.gov/api/map_key/).")
    if not re.fullmatch(r"[0-9a-fA-F]{32}", clave):
        log.warning("La clave FIRMS no tiene el formato esperado (32 caracteres hexadecimales); largo recibido: %d", len(clave))
    # Diagnóstico: el endpoint de disponibilidad valida la clave y lista las fuentes con sus fechas.
    disponibles: set[str] = set()
    rangos: dict[str, tuple[str, str]] = {}
    if nrt_recientes:
        fuentes = list(fuentes) + [x for x in FIRMS_FUENTES_NRT if x not in fuentes]
    try:
        disp, _ = descargar(FIRMS_DISPONIBILIDAD.format(clave=clave))
        lineas = [l for l in disp.strip().splitlines() if l.strip()]
        log.info("FIRMS disponibilidad (%d fuentes): %s", max(len(lineas) - 1, 0), " | ".join(lineas[1:12]))
        for l in lineas[1:]:
            partes = [x.strip() for x in l.split(",")]
            if len(partes) >= 3:
                rangos[partes[0]] = (partes[1], partes[2])
        disponibles = set(rangos)
        faltan = [f for f in fuentes if f not in disponibles]
        if disponibles and faltan:
            log.warning("Fuentes no listadas por FIRMS, se omiten: %s", ", ".join(faltan))
            fuentes = [f for f in fuentes if f in disponibles]
    except HTTPError as e:
        cuerpo = e.read().decode("utf-8", errors="replace")[:300] if hasattr(e, "read") else ""
        raise SystemExit(f"FIRMS rechazó la clave o la consulta de disponibilidad (HTTP {e.code}): {cuerpo}")
    except URLError as e:
        raise SystemExit(f"No se pudo contactar a FIRMS: {e}")
    ahora = datetime.now(timezone.utc)
    resultado = {}
    errores_mostrados = 0
    for v in volcanes:
        dlat = FIRMS_RADIO_KM / 111.0
        dlon = dlat / max(math.cos(math.radians(v.lat)), 0.1)
        area = f"{v.lon - dlon:.3f},{v.lat - dlat:.3f},{v.lon + dlon:.3f},{v.lat + dlat:.3f}"
        pixeles: list[dict] = []
        consultas = 0
        f = desde
        while f <= hasta:
            dias = min(FIRMS_TRAMO_DIAS, (hasta - f).days + 1)
            ini, fin = f.strftime("%Y-%m-%d"), (f + timedelta(days=dias - 1)).strftime("%Y-%m-%d")
            # Sólo las fuentes cuyo rango disponible se solapa con el tramo.
            fuentes_tramo = [x for x in fuentes if x not in rangos or (rangos[x][0] <= fin and rangos[x][1] >= ini)]
            for fuente in fuentes_tramo:
                url = FIRMS_API.format(clave=clave, fuente=fuente, area=area, dias=dias, fecha=f.strftime("%Y-%m-%d"))
                try:
                    texto, _ = descargar(url)
                    consultas += 1
                except HTTPError as e:
                    cuerpo = e.read().decode("utf-8", errors="replace").strip()[:200] if hasattr(e, "read") else ""
                    if errores_mostrados < 5:
                        log.warning("FIRMS %s %s %s: HTTP %s %s | URL sin clave: %s", v.nombre, fuente, f.date(), e.code, cuerpo,
                                    url.replace(clave, "<clave>"))
                        errores_mostrados += 1
                    elif errores_mostrados == 5:
                        log.warning("(más errores HTTP de FIRMS omitidos del registro)")
                        errores_mostrados += 1
                    continue
                except URLError as e:
                    log.warning("FIRMS %s %s %s: %s", v.nombre, fuente, f.date(), e)
                    continue
                finally:
                    time.sleep(0.15)
                if texto.lower().startswith("invalid") or "map_key" in texto.lower()[:200]:
                    raise SystemExit(f"FIRMS rechazó la consulta: {texto[:160]}")
                pixeles.extend(_leer_firms(texto))
            f += timedelta(days=dias)
        pasadas = agrupar_firms(pixeles, v)
        agregados, total = _guardar_importados(raiz, v, pasadas, "firms", ahora)
        log.info("%-22s FIRMS %s a %s: %d consultas, %d píxeles, %d pasadas, %d nuevas (total %d)",
                 v.nombre, desde.date(), hasta.date(), consultas, len(pixeles), len(pasadas), agregados, total)
        resultado[v.nombre] = {"pixeles": len(pixeles), "pasadas": len(pasadas), "nuevas": agregados, "total": total}
    return resultado


def cmd_importar(raiz: Path, volcanes: list[Volcan], archivo: Path) -> dict:
    """Carga un CSV externo en datos/. Si el encabezado trae `frp` y `acq_date`
    es un CSV de FIRMS (puede cubrir varios volcanes); si no, es el "Raw data"
    del MIROVA Dataset, que es de un solo volcán."""
    ahora = datetime.now(timezone.utc)
    resultado = {}
    with archivo.open(encoding="utf-8", errors="replace") as f:
        cabecera = f.readline().lower()
    es_firms = "frp" in cabecera and "acq_date" in cabecera
    multivolcan = "idvolc" in cabecera
    if es_firms:
        pixeles = _leer_firms(archivo.read_text(encoding="utf-8", errors="replace"))
        log.info("CSV de FIRMS: %d píxeles", len(pixeles))
    elif not multivolcan and len(volcanes) != 1:
        raise SystemExit("Este archivo MIROVA no trae IDvolc, así que es de un solo volcán: indica cuál con --volcanes.")
    for v in volcanes:
        nuevos = agrupar_firms(pixeles, v) if es_firms else _leer_archivo_mirova(archivo, v.volcano_id if multivolcan else None)
        origen = "firms" if es_firms else "mirova-archivo"
        agregados, total = _guardar_importados(raiz, v, nuevos, origen, ahora)
        rango = (min(n["fecha"] for n in nuevos).strftime("%Y-%m-%d"), max(n["fecha"] for n in nuevos).strftime("%Y-%m-%d")) if nuevos else ("", "")
        log.info("%-22s %s: %5d lecturas (%s a %s) | agregadas: %5d | total ahora: %5d", v.nombre, origen, len(nuevos), *rango, agregados, total)
        resultado[v.nombre] = {"en_archivo": len(nuevos), "agregadas": agregados, "total": total, "origen": origen}
    return resultado


def _ventana(filas: list[dict], dias: int, hasta: datetime) -> list[dict]:
    desde = hasta - timedelta(days=dias)
    return [r for r in filas if desde <= r["fecha"] <= hasta]


def cmd_resumen(raiz: Path, volcanes: list[Volcan], dias: int) -> dict:
    ahora = datetime.now(timezone.utc)
    estado = {"generado_utc": ahora.strftime("%Y-%m-%dT%H:%M:%S"), "dias_ventana": dias, "volcanes": {}}
    lineas = [f"# Resumen MIROVA ({ahora:%Y-%m-%d %H:%M} UTC)", "",
              f"Ventana de análisis: últimos {dias} días. VRP en MW. Fuente: MIROVA, Universidad de Turín.", ""]
    for v in volcanes:
        todas = leer_csv(ruta_csv(raiz, v))
        filas = [r for r in todas if r["origen"] != "firms"]
        firms = [r for r in _ventana([r for r in todas if r["origen"] == "firms"], dias, ahora) if r["vrp_mw"] > 0 and r["dentro_radio"]]
        ventana = _ventana(filas, dias, ahora)
        anomalias = [r for r in ventana if r["vrp_mw"] > 0 and r["dentro_radio"]]
        fuera = [r for r in ventana if r["vrp_mw"] > 0 and not r["dentro_radio"]]
        ultima = max(anomalias, key=lambda r: r["fecha"]) if anomalias else None
        maximo = max(anomalias, key=lambda r: r["vrp_mw"]) if anomalias else None
        mitad = ahora - timedelta(days=dias / 2)
        prim = [r["vrp_mw"] for r in anomalias if r["fecha"] < mitad]
        seg = [r["vrp_mw"] for r in anomalias if r["fecha"] >= mitad]
        if prim and seg:
            med1, med2 = sorted(prim)[len(prim) // 2], sorted(seg)[len(seg) // 2]
            texto_tend = "en aumento" if med2 > 1.5 * med1 else "en descenso" if med2 < med1 / 1.5 else "estable"
        elif seg:
            texto_tend = "anomalías recientes sin antecedente en la ventana"
        elif prim:
            texto_tend = "sin anomalías en la segunda mitad de la ventana"
        else:
            texto_tend = "sin anomalías"
        por_sensor = {}
        for r in filas:
            s = por_sensor.setdefault(r["sensor"], {"ultima_lectura_utc": None, "lecturas": 0})
            s["lecturas"] += 1
            if s["ultima_lectura_utc"] is None or r["fecha_utc"] > s["ultima_lectura_utc"]:
                s["ultima_lectura_utc"] = r["fecha_utc"]
        info = {
            "volcano_id": v.volcano_id,
            "archivo_csv": f"datos/{v.archivo}.csv",
            "url_mirova": v.url_detalle,
            "limite_km": v.limite_km,
            "lecturas_totales": len(todas),
            "lecturas_firms": sum(1 for r in todas if r["origen"] == "firms"),
            "lecturas_ventana": len(ventana),
            "anomalias_ventana": len(anomalias),
            "detecciones_fuera_radio_ventana": len(fuera),
            "ultima_anomalia": None if ultima is None else {"fecha_utc": ultima["fecha_utc"], "vrp_mw": ultima["vrp_mw"],
                                                            "sensor": ultima["sensor"], "distancia_km": ultima["distancia_km"]},
            "maximo_ventana": None if maximo is None else {"fecha_utc": maximo["fecha_utc"], "vrp_mw": maximo["vrp_mw"],
                                                           "sensor": maximo["sensor"], "clasificacion": maximo["clasificacion"]},
            "tendencia": texto_tend,
            "firms_ventana": len(firms),
            "firms_ultima": None if not firms else {"fecha_utc": max(firms, key=lambda r: r["fecha"])["fecha_utc"],
                                                     "frp_mw": max(firms, key=lambda r: r["fecha"])["vrp_mw"]},
            "firms_maximo_mw": max((r["vrp_mw"] for r in firms), default=None),
            "sensores": por_sensor,
            "figuras": sorted(p.name for p in (raiz / "imagenes" / v.archivo).glob("*.png")) if (raiz / "imagenes" / v.archivo).exists() else [],
            "grafico": f"graficos/{v.archivo}_serie.png" if (raiz / "graficos" / f"{v.archivo}_serie.png").exists() else None,
        }
        estado["volcanes"][v.nombre] = info
        lineas.append(f"## {v.nombre} (ID {v.volcano_id})")
        lineas.append(f"- Lecturas acumuladas: {len(filas)}; en la ventana: {len(ventana)}.")
        if ultima:
            lineas.append(f"- Última anomalía dentro de {v.limite_km:g} km: {ultima['fecha_utc']} UTC, {ultima['vrp_mw']:g} MW ({ultima['sensor']}).")
            lineas.append(f"- Máximo de la ventana: {maximo['vrp_mw']:g} MW el {maximo['fecha_utc']} UTC, intensidad {maximo['clasificacion']}.")
        else:
            lineas.append(f"- Sin anomalías dentro de {v.limite_km:g} km en la ventana.")
        if fuera:
            lineas.append(f"- Detecciones fuera del radio (probables fuentes no volcánicas): {len(fuera)}.")
        lineas.append(f"- Tendencia (mediana segunda mitad vs. primera mitad): {texto_tend}.")
        if firms:
            u = max(firms, key=lambda r: r["fecha"])
            lineas.append(f"- FIRMS (FRP, independiente de MIROVA): {len(firms)} pasadas con píxeles activos dentro del radio; "
                          f"última {u['fecha_utc']} UTC, {u['vrp_mw']:g} MW; máximo {max(r['vrp_mw'] for r in firms):g} MW.")
        lineas.append(f"- Página MIROVA: {v.url_detalle}")
        lineas.append("")
    (raiz / "datos").mkdir(parents=True, exist_ok=True)
    (raiz / "datos" / "estado.json").write_text(json.dumps(estado, indent=1, ensure_ascii=False), encoding="utf-8")
    (raiz / "datos" / "resumen.md").write_text("\n".join(lineas), encoding="utf-8")
    print("\n".join(lineas))
    return estado


def ventana_mediana(dias: int) -> int:
    """Ancho de la mediana móvil según la ventana del panel: una doceava parte,
    acotada entre 7 días (panel mensual) y 180 días (serie completa)."""
    return int(min(180, max(7, dias / 12)))


def tendencia(puntos: list[tuple[datetime, float]], ancho_dias: float, desde: datetime, hasta: datetime,
              n: int = 160, minimo: int = 3) -> list[tuple[datetime, float | None]]:
    """Mediana móvil de log10(VRP) evaluada en una grilla regular de `n` instantes.

    En cada instante se toman las detecciones a menos de medio ancho de ventana;
    con menos de `minimo` detecciones el valor es None y la línea se corta, de
    modo que la tendencia nunca se extrapola sobre tramos sin datos. La mediana
    en escala logarítmica es robusta a los picos aislados y a los valores de
    fondo, que en VRP difieren en varios órdenes de magnitud."""
    import math
    if not puntos or hasta <= desde:
        return []
    datos = sorted((t.timestamp(), math.log10(v)) for t, v in puntos if v > 0)
    medio = ancho_dias * 43200.0
    paso = (hasta - desde).total_seconds() / max(n - 1, 1)
    salida = []
    i0 = 0
    for k in range(n):
        tk = desde.timestamp() + k * paso
        while i0 < len(datos) and datos[i0][0] < tk - medio:
            i0 += 1
        vals = []
        j = i0
        while j < len(datos) and datos[j][0] <= tk + medio:
            vals.append(datos[j][1])
            j += 1
        if len(vals) >= minimo:
            vals.sort()
            m = len(vals)
            med = vals[m // 2] if m % 2 else 0.5 * (vals[m // 2 - 1] + vals[m // 2])
            salida.append((datetime.fromtimestamp(tk, tz=timezone.utc), 10 ** med))
        else:
            salida.append((datetime.fromtimestamp(tk, tz=timezone.utc), None))
    return salida


# Marcadores distinguibles en blanco y negro y colores seguros para daltonismo (Okabe-Ito).
ESTILO_SENSOR = {
    "MODIS":    {"marker": "^", "color": "#E69F00", "label": "MODIS (1 km)", "ls": "--"},
    "VIIRS750": {"marker": "o", "color": "#0072B2", "label": "VIIRS 750 m", "ls": "-"},
    "VIIRS375": {"marker": "s", "color": "#009E73", "label": "VIIRS 375 m", "ls": ":"},
}


def cmd_graficar(raiz: Path, volcanes: list[Volcan], dias: list[int]) -> list[Path]:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.dates as mdates
        import matplotlib.patheffects as pe
        import matplotlib.pyplot as plt
        from matplotlib.lines import Line2D
    except ImportError:
        log.error("matplotlib no está instalado: pip install matplotlib")
        raise SystemExit(4)

    plt.rcParams.update({
        "font.family": "sans-serif",
        "font.size": 14,
        "axes.labelsize": 16,
        "xtick.labelsize": 13,
        "ytick.labelsize": 13,
        "legend.fontsize": 13,
        "mathtext.fontset": "cm",   # unidades y símbolos con tipografía LaTeX
        "axes.linewidth": 1.2,
    })
    ahora = datetime.now(timezone.utc)
    salidas: list[Path] = []
    (raiz / "graficos").mkdir(parents=True, exist_ok=True)
    for v in volcanes:
        filas = leer_csv(ruta_csv(raiz, v))
        fig, ejes = plt.subplots(1, len(dias), figsize=(7.5 * len(dias), 5.9), squeeze=False)
        borde = [pe.Stroke(linewidth=4.2, foreground="white"), pe.Normal()]
        for eje, d in zip(ejes[0], dias):
            if d <= 0:  # 0 = toda la serie disponible
                ventana = filas
                d = max(1, (ahora - min(r["fecha"] for r in filas)).days + 1) if filas else 365
                etiqueta_x = "Fecha (UTC), serie completa"
            else:
                ventana = _ventana(filas, d, ahora)
                etiqueta_x = f"Fecha (UTC), últimos {d} días"
            piso = 0.01  # MW: donde se dibujan las observaciones sin anomalía
            firms = [r for r in ventana if r["origen"] == "firms"]
            ventana = [r for r in ventana if r["origen"] != "firms"]
            for sensor, est in ESTILO_SENSOR.items():
                pts = [r for r in ventana if r["sensor"] == sensor]
                nulos = [r for r in pts if r["vrp_mw"] <= 0]
                dentro = [r for r in pts if r["vrp_mw"] > 0 and r["dentro_radio"]]
                fuera = [r for r in pts if r["vrp_mw"] > 0 and not r["dentro_radio"]]
                if nulos:
                    eje.plot([r["fecha"] for r in nulos], [piso] * len(nulos), linestyle="none",
                             marker="|", color="0.55", markersize=9, markeredgewidth=1.2)
                if fuera:
                    eje.plot([r["fecha"] for r in fuera], [r["vrp_mw"] for r in fuera], linestyle="none",
                             marker=est["marker"], markerfacecolor="none", markeredgecolor=est["color"],
                             markersize=8, markeredgewidth=1.4)
                if dentro:
                    eje.plot([r["fecha"] for r in dentro], [r["vrp_mw"] for r in dentro], linestyle="none",
                             marker=est["marker"], color=est["color"], markersize=8,
                             markeredgecolor="black", markeredgewidth=0.6)
            # FIRMS (FRP): rombos con el color del sensor, llenos dentro del radio.
            for sensor, est in ESTILO_SENSOR.items():
                pts = [r for r in firms if r["sensor"] == sensor and r["vrp_mw"] > 0]
                for grupo, relleno in (([r for r in pts if r["dentro_radio"]], True), ([r for r in pts if not r["dentro_radio"]], False)):
                    if grupo:
                        eje.plot([r["fecha"] for r in grupo], [r["vrp_mw"] for r in grupo], linestyle="none", marker="D",
                                 markersize=6.5, markerfacecolor=est["color"] if relleno else "none",
                                 markeredgecolor="0.3" if relleno else est["color"], markeredgewidth=0.9, alpha=0.85)
            # Tendencias: mediana móvil del log de VRP, por sensor y general,
            # sólo con detecciones dentro del radio del cráter.
            desde, ancho = ahora - timedelta(days=d), ventana_mediana(d)
            validas = [r for r in ventana if r["vrp_mw"] > 0 and r["dentro_radio"]]
            for sensor, est in ESTILO_SENSOR.items():
                linea = tendencia([(r["fecha"], r["vrp_mw"]) for r in validas if r["sensor"] == sensor], ancho, desde, ahora)
                if linea:
                    eje.plot([t for t, _ in linea], [v if v is not None else float("nan") for _, v in linea],
                             linestyle=est["ls"], color=est["color"], linewidth=2.0, zorder=5, path_effects=borde)
            general = tendencia([(r["fecha"], r["vrp_mw"]) for r in validas], ancho, desde, ahora)
            if general:
                eje.plot([t for t, _ in general], [v if v is not None else float("nan") for _, v in general],
                         linestyle="-", color="black", linewidth=3.0, zorder=6, path_effects=borde)
            firms_dentro = [(r["fecha"], r["vrp_mw"]) for r in firms if r["vrp_mw"] > 0 and r["dentro_radio"]]
            lf = tendencia(firms_dentro, ancho, desde, ahora)
            if lf and any(v is not None for _, v in lf):
                eje.plot([t for t, _ in lf], [v if v is not None else float("nan") for _, v in lf],
                         linestyle=(0, (4, 2)), color="0.35", linewidth=2.2, zorder=5, path_effects=borde)
            eje.text(0.02, 0.97, f"mediana móvil: {ancho} días", transform=eje.transAxes, ha="left", va="top",
                     fontsize=12, color="0.25", bbox=dict(boxstyle="round,pad=0.25", facecolor="white", edgecolor="0.7", alpha=0.9))
            eje.set_yscale("log")
            eje.set_ylim(piso * 0.6, max([r["vrp_mw"] for r in ventana + firms if r["vrp_mw"] > 0] + [10]) * 3)
            eje.set_xlim(desde, ahora)
            eje.axhline(piso, color="0.55", linewidth=0.8, linestyle=":")
            eje.set_ylabel(r"$\mathrm{VRP}\ [\mathrm{MW}]$")
            eje.set_xlabel(etiqueta_x)
            eje.grid(True, which="major", alpha=0.3)
            eje.grid(True, which="minor", axis="y", alpha=0.12)
            loc = mdates.AutoDateLocator(minticks=4, maxticks=7)
            eje.xaxis.set_major_locator(loc)
            eje.xaxis.set_major_formatter(mdates.ConciseDateFormatter(loc))
            for lado in eje.spines.values():  # marco completo
                lado.set_visible(True)
        asas = [Line2D([], [], linestyle=e["ls"], linewidth=1.6, marker=e["marker"], color=e["color"], markersize=9,
                       markeredgecolor="black", markeredgewidth=0.6, label=f"{e['label']} y su tendencia") for e in ESTILO_SENSOR.values()]
        asas.append(Line2D([], [], linestyle="-", linewidth=2.8, color="black", label="Tendencia general"))
        if any(r["origen"] == "firms" for r in filas):
            asas.append(Line2D([], [], linestyle=(0, (4, 2)), linewidth=2.2, color="0.35", marker="D", markersize=7,
                               markerfacecolor="0.6", markeredgecolor="0.3", label="FIRMS (FRP, no VRP) y su tendencia"))
        asas.append(Line2D([], [], linestyle="none", marker="o", markerfacecolor="none", markeredgecolor="0.3",
                           markersize=9, label=f"No atribuida al volcán (a más de {v.limite_km:g} km o descartada por MIROVA)"))
        asas.append(Line2D([], [], linestyle="none", marker="|", color="0.55", markersize=10,
                           markeredgewidth=1.2, label="Observación sin anomalía"))
        fig.legend(handles=asas, loc="upper center", ncol=3, frameon=False, bbox_to_anchor=(0.5, 1.0),
                   handlelength=3.2, columnspacing=1.6)
        fig.tight_layout(rect=(0, 0, 1, 0.88))
        salida = raiz / "graficos" / f"{v.archivo}_serie.png"
        fig.savefig(salida, dpi=150)
        plt.close(fig)
        salidas.append(salida)
        log.info("Gráfico guardado: %s (%d lecturas)", salida, len(filas))
    return salidas


# ---------------------------------------------------------------------------
# CLI


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--raiz", type=Path, default=AQUI, help="carpeta donde viven datos/, imagenes/ y graficos/ (por defecto, la del script)")
    ap.add_argument("--config", type=Path, default=None, help="archivo volcanes.json (por defecto <raiz>/volcanes.json)")
    ap.add_argument("--volcanes", help="nombres o IDs separados por comas (ej. Villarrica,355100); 'todos' para toda la lista. También: variable MIROVA_VOLCANES")
    ap.add_argument("-v", "--verboso", action="store_true")
    sub = ap.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("actualizar", help="leer latest.php y guardar filas nuevas")
    a.add_argument("--sin-imagenes", action="store_true", help="no descargar las figuras oficiales")
    a.add_argument("--archivar-imagenes", action="store_true", help="guardar copia fechada de cada figura que cambie")
    a.add_argument("--html-local", type=Path, help="(pruebas) leer latest.php desde un archivo en vez de la red")

    g = sub.add_parser("graficar", help="generar series temporales propias")
    g.add_argument("--dias", nargs="+", type=int, default=[30, 365, 0], help="ventanas en días; 0 = toda la serie")

    r = sub.add_parser("resumen", help="resumen por volcán (estado.json y resumen.md)")
    r.add_argument("--dias", type=int, default=30)

    i = sub.add_parser("importar", help="cargar el histórico de un volcán desde el CSV Raw data del MIROVA Dataset (rellena huecos, no pisa)")
    i.add_argument("archivo", type=Path)

    fr = sub.add_parser("firms", help="descargar píxeles activos de NASA FIRMS por API (requiere FIRMS_MAP_KEY)")
    fr.add_argument("--desde", help="YYYY-MM-DD (por defecto, hace --dias días)")
    fr.add_argument("--hasta", help="YYYY-MM-DD (por defecto, hoy)")
    fr.add_argument("--dias", type=int, default=7, help="días hacia atrás si no se da --desde")
    fr.add_argument("--historico", action="store_true", help="usar las fuentes SP (procesamiento estándar) en vez de NRT")
    fr.add_argument("--fuentes", help="lista separada por comas; sobreescribe la elección NRT/SP")

    t = sub.add_parser("todo", help="actualizar + graficar + resumen (+ firms de los últimos días si hay FIRMS_MAP_KEY)")
    t.add_argument("--sin-imagenes", action="store_true")
    t.add_argument("--archivar-imagenes", action="store_true")
    t.add_argument("--dias", nargs="+", type=int, default=[30, 365, 0], help="ventanas en días; 0 = toda la serie")

    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verboso else logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
    raiz: Path = args.raiz
    config = args.config or (raiz / "volcanes.json")
    if not config.exists():
        config = AQUI / "volcanes.json"
    todos, seguimiento = cargar_config(config)
    pedidos = [x for x in args.volcanes.split(",") if x.strip()] if args.volcanes else None
    volcanes = elegir_volcanes(todos, seguimiento, pedidos)
    log.info("Volcanes en seguimiento: %s", ", ".join(v.nombre for v in volcanes))

    if args.cmd == "actualizar":
        cmd_actualizar(raiz, volcanes, con_imagenes=not args.sin_imagenes, archivar=args.archivar_imagenes, html_local=args.html_local)
    elif args.cmd == "graficar":
        cmd_graficar(raiz, volcanes, args.dias)
    elif args.cmd == "resumen":
        cmd_resumen(raiz, volcanes, args.dias)
    elif args.cmd == "importar":
        cmd_importar(raiz, volcanes, args.archivo)
    elif args.cmd == "firms":
        hoy = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        hasta = datetime.strptime(args.hasta, "%Y-%m-%d").replace(tzinfo=timezone.utc) if args.hasta else hoy
        desde = datetime.strptime(args.desde, "%Y-%m-%d").replace(tzinfo=timezone.utc) if args.desde else hasta - timedelta(days=args.dias - 1)
        fuentes = [f for f in args.fuentes.split(",") if f] if args.fuentes else (FIRMS_FUENTES_SP if args.historico else FIRMS_FUENTES_NRT)
        cmd_firms(raiz, volcanes, desde, hasta, fuentes, os.environ.get("FIRMS_MAP_KEY", ""), nrt_recientes=args.historico)
    elif args.cmd == "todo":
        cmd_actualizar(raiz, volcanes, con_imagenes=not args.sin_imagenes, archivar=args.archivar_imagenes)
        if os.environ.get("FIRMS_MAP_KEY"):
            hoy = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            cmd_firms(raiz, volcanes, hoy - timedelta(days=6), hoy, FIRMS_FUENTES_NRT, os.environ["FIRMS_MAP_KEY"])
        cmd_graficar(raiz, volcanes, args.dias)
        cmd_resumen(raiz, volcanes, min([d for d in args.dias if d > 0] or [30]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
