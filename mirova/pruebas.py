"""Pruebas sin red del monitor MIROVA: python -m unittest mirova/pruebas.py"""
import csv
import json
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mirova_monitor as mm  # noqa: E402

FILAS = """
<tr><td>05-Oct-2026 07:50:00</td><td>357120</td><td>Villarrica</td><td>12.5</td><td>0.8</td><td>VIIRS375</td></tr>
<tr><td>05-Oct-2026 06:12:30</td><td>357120</td><td>Villarrica</td><td>0</td><td>0</td><td>MODIS</td></tr>
<tr><td>05-Oct-2026 05:42:02</td><td>355100</td><td>Lascar</td><td>3.2</td><td>7.9</td><td>VIIRS</td></tr>
<tr><td>04-Oct-2026 18:00:00</td><td>355100</td><td>Lascar</td><td>0.45</td><td>1.1</td><td>VIIRS</td></tr>
<tr><td>04-Oct-2026 02:30:00</td><td>211060</td><td>Etna</td><td>850</td><td>0.3</td><td>MODIS</td></tr>
"""
CON_CABECERA = f"""<html><body><h1>Latest</h1><table><thead>
<tr><th>Date (UTC)</th><th>ID</th><th>Volcano</th><th>VRP (MW)</th><th>Dist (km)</th><th>Sensor</th></tr>
</thead><tbody>{FILAS}</tbody></table></body></html>"""
SIN_CABECERA = f"<table><tbody>{FILAS}</tbody></table>"
CABECERA_DESORDENADA = f"""<table><tr><th>Volcano</th><th>Sensor</th><th>Acquisition time</th><th>Dist (km)</th><th>VRP (MW)</th><th>ID</th></tr>
<tr><td>Villarrica</td><td>VIIRS375</td><td>05-Oct-2026 07:50:00</td><td>0.8</td><td>12.5</td><td>357120</td></tr></table>"""


class Parser(unittest.TestCase):
    def test_con_y_sin_cabecera_dan_lo_mismo(self):
        a, b = mm.parsear_latest(CON_CABECERA), mm.parsear_latest(SIN_CABECERA)
        self.assertEqual(len(a), 5)
        self.assertEqual(a, b)
        r = a[0]
        self.assertEqual(r["fecha"], datetime(2026, 10, 5, 7, 50, tzinfo=timezone.utc))
        self.assertEqual((r["volcano_id"], r["vrp_mw"], r["distancia_km"], r["sensor"]), ("357120", 12.5, 0.8, "VIIRS375"))
        self.assertEqual(a[2]["sensor"], "VIIRS750", "VIIRS a secas es el producto de 750 m")

    def test_cabecera_en_otro_orden(self):
        r = mm.parsear_latest(CABECERA_DESORDENADA)[0]
        self.assertEqual((r["volcano_id"], r["vrp_mw"], r["distancia_km"], r["sensor"]), ("357120", 12.5, 0.8, "VIIRS375"))

    def test_html_sin_tabla_da_vacio(self):
        self.assertEqual(mm.parsear_latest("<html><body>mantenimiento</body></html>"), [])


class Clasificacion(unittest.TestCase):
    def test_escala(self):
        self.assertEqual([mm.clasificar(x) for x in (0, 0.5, 5, 50, 500, 5000)],
                         ["sin anomalia", "muy baja", "baja", "moderada", "alta", "muy alta"])


class Tendencia(unittest.TestCase):
    def test_mediana_movil_corta_sin_datos_y_resiste_picos(self):
        from datetime import timedelta
        fin = datetime(2026, 10, 5, tzinfo=timezone.utc)
        ini = fin - timedelta(days=60)
        # 30 días con fondo de 1 MW y un pico aislado de 1000 MW; luego 30 días sin detecciones.
        pts = [(ini + timedelta(days=i), 1.0) for i in range(30)] + [(ini + timedelta(days=15, hours=1), 1000.0)]
        linea = mm.tendencia(pts, 7, ini, fin, n=61)
        con_valor = [v for _, v in linea if v is not None]
        self.assertTrue(con_valor, "hay tendencia donde hay datos")
        self.assertTrue(all(0.9 < v < 1.1 for v in con_valor), f"la mediana ignora el pico: {max(con_valor):.2f}")
        self.assertIsNone(linea[-1][1], "sin datos al final, la línea se corta en vez de extrapolar")
        self.assertEqual(mm.tendencia([], 7, ini, fin), [])
        self.assertEqual((mm.ventana_mediana(30), mm.ventana_mediana(365), mm.ventana_mediana(7000)), (7, 30, 180))


class Integracion(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.todos, self.seg = mm.cargar_config(Path(__file__).resolve().parent / "volcanes.json")
        self.html = self.tmp / "latest.html"
        self.html.write_text(CON_CABECERA, encoding="utf-8")

    def test_actualizar_es_idempotente_y_filtra_por_volcan(self):
        volcanes = mm.elegir_volcanes(self.todos, self.seg, ["Villarrica", "355100"])
        r1 = mm.cmd_actualizar(self.tmp, volcanes, con_imagenes=False, archivar=False, html_local=self.html)
        self.assertEqual(r1["Villarrica"]["nuevas"], 2)
        self.assertEqual(r1["Lascar"]["nuevas"], 2)
        r2 = mm.cmd_actualizar(self.tmp, volcanes, con_imagenes=False, archivar=False, html_local=self.html)
        self.assertEqual(r2["Villarrica"]["nuevas"], 0, "repetir no duplica")
        with (self.tmp / "datos" / "Lascar.csv").open(encoding="utf-8") as f:
            filas = list(csv.DictReader(f))
        self.assertEqual([r["fecha_utc"] for r in filas], ["2026-10-04T18:00:00", "2026-10-05T05:42:02"])
        self.assertEqual(filas[1]["dentro_radio"], "0", "7.9 km supera el radio de 5 km de Lascar")
        self.assertEqual(filas[1]["clasificacion"], "fuera de radio")
        self.assertEqual(filas[0]["clasificacion"], "muy baja")
        self.assertFalse((self.tmp / "datos" / "Chaiten.csv").exists())

    def test_resumen_y_grafico(self):
        volcanes = mm.elegir_volcanes(self.todos, self.seg, ["Villarrica"])
        mm.cmd_actualizar(self.tmp, volcanes, con_imagenes=False, archivar=False, html_local=self.html)
        estado = mm.cmd_resumen(self.tmp, volcanes, 30)
        info = estado["volcanes"]["Villarrica"]
        self.assertEqual(info["anomalias_ventana"], 1 if datetime.now(timezone.utc).year == 2026 else 0)
        self.assertTrue((self.tmp / "datos" / "estado.json").exists())
        salidas = mm.cmd_graficar(self.tmp, volcanes, [30, 365])
        self.assertTrue(salidas[0].exists() and salidas[0].stat().st_size > 10_000)

    def test_importar_archivo_mirova(self):
        volcanes = mm.elegir_volcanes(self.todos, self.seg, ["Lascar"])
        csv_ext = self.tmp / "Lascar_MIROVA_Database_v1.csv"
        csv_ext.write_text(
            "UTC,Dayflag,Sensor,Tot_Lmir_bk,VRP,Lat,Lon,Dist\n"
            "01/03/2000 03:15:00,0,1,0.5,12500000,-23.37,-67.73,1200\n"
            "15/06/2013 05:10:00,0,3,0.4,800000,-23.37,-67.73,9800\n"
            "16/06/2013 05:10:00,0,4,0.4,abc,-23.37,-67.73,100\n", encoding="utf-8")
        r = mm.cmd_importar(self.tmp, volcanes, csv_ext)
        self.assertEqual(r["Lascar"]["agregadas"], 2, "la fila con VRP no numérico se descarta")
        filas = mm.leer_csv(self.tmp / "datos" / "Lascar.csv")
        f0 = next(f for f in filas if f["fecha_utc"] == "2000-03-01T03:15:00")
        self.assertEqual((f0["sensor"], f0["vrp_mw"], f0["distancia_km"], f0["clasificacion"], f0["origen"]),
                         ("MODIS", 12.5, 1.2, "moderada", "mirova-archivo"))
        f1 = next(f for f in filas if f["fecha_utc"] == "2013-06-15T05:10:00")
        self.assertEqual((f1["sensor"], f1["vrp_mw"], f1["dentro_radio"]), ("VIIRS750", 0.8, False))
        with self.assertRaises(SystemExit):
            mm.cmd_importar(self.tmp, mm.elegir_volcanes(self.todos, self.seg, ["Lascar", "Isluga"]), csv_ext)

    def test_importar_archivo_mirova_v25(self):
        """Encabezado real de la exportación 'Raw data' de Explore_Archive.php."""
        volcanes = mm.elegir_volcanes(self.todos, self.seg, ["Nevados de Chillan"])
        csv_ext = self.tmp / "raw.csv"
        csv_ext.write_text(
            "id,timeUTC,IDvolc,Dayflag,Satellite,Resolution,SatZen,SatAzi,Npix,Tot_Lmir_hot,Tot_Lmir_bk,VRP,LAT,LON,Max_Dist,Volc_Name,Volc_LAT,Volc_LON,class\n"
            '64430,"2008-01-17 03:45:01",357070,0,1,1000,16.9,-100.8,1,0.287,0.251,673713.8,-36.863,-71.376,0,"Chillán, Nevados de",-36.863,-71.377,1\n'
            '69413,"2025-03-05 05:30:03",357070,0,3,375,19.5,102.6,4,1.678,0.765,2310759.3,-36.835,-71.521,13463.5,"Chillán, Nevados de",-36.863,-71.377,1\n'
            '69000,"2021-07-01 05:00:00",357070,1,4,750,10.0,100.0,2,0.5,0.3,15000000,-36.863,-71.377,1414.21,"Chillán, Nevados de",-36.863,-71.377,1\n', encoding="utf-8")
        r = mm.cmd_importar(self.tmp, volcanes, csv_ext)
        self.assertEqual(r["Nevados de Chillan"]["agregadas"], 3)
        filas = {f["fecha_utc"]: f for f in mm.leer_csv(self.tmp / "datos" / "Nevados_de_Chillan.csv")}
        f = filas["2008-01-17T03:45:01"]
        self.assertEqual((f["sensor"], round(f["vrp_mw"], 4), f["distancia_km"], f["clasificacion"]), ("MODIS", 0.6737, 0.0, "muy baja"))
        f = filas["2025-03-05T05:30:03"]
        self.assertEqual((f["sensor"], round(f["distancia_km"], 2), f["dentro_radio"], f["clasificacion"]), ("VIIRS375", 13.46, False, "fuera de radio"))
        f = filas["2021-07-01T05:00:00"]
        self.assertEqual((f["sensor"], f["vrp_mw"], f["clasificacion"], f["origen"]), ("VIIRS750", 15.0, "moderada", "mirova-archivo"))

    def test_distancia_haversine(self):
        # Villarrica (-39.42, -71.93) a Llaima (-38.692, -71.729): unos 83 km.
        self.assertAlmostEqual(mm.distancia_km(-39.42, -71.93, -38.692, -71.729), 82.7, delta=1.5)
        self.assertEqual(mm.distancia_km(-36.863, -71.377, -36.863, -71.377), 0.0)

    def test_importar_firms_agrupa_por_pasada(self):
        """CSV de FIRMS con píxeles de dos volcanes; se agrupan por pasada y se filtran por distancia."""
        volcanes = mm.elegir_volcanes(self.todos, self.seg, ["Villarrica", "Llaima"])
        csv_ext = self.tmp / "fire_archive_SV-C2_1.csv"
        csv_ext.write_text(
            "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight\n"
            "-39.421,-71.931,345.2,0.39,0.36,2025-06-10,0548,N,VIIRS,n,2.0NRT,290.1,3.5,N\n"   # Villarrica, misma pasada
            "-39.425,-71.936,331.0,0.39,0.36,2025-06-10,0548,N,VIIRS,n,2.0NRT,289.0,1.5,N\n"   # Villarrica, misma pasada
            "-39.421,-71.931,340.0,0.39,0.36,2025-06-10,0630,N20,VIIRS,n,2.0NRT,290.0,2.0,N\n"  # Villarrica, otra pasada (NOAA-20)
            "-39.27,-72.09,320.0,0.39,0.36,2025-06-10,0548,N,VIIRS,l,2.0NRT,285.0,0.8,N\n"     # lago Villarrica, 22 km: no se suma al cráter
            "-39.27,-72.09,320.0,0.39,0.36,2025-06-12,0548,N,VIIRS,l,2.0NRT,285.0,0.8,N\n"     # sólo lago: lectura fuera de radio
            "-38.692,-71.729,330.0,1.0,1.0,2025-06-11,0410,Terra,MODIS,80,6.1,295.0,12.0,N\n"  # Llaima, MODIS
            "-30.0,-71.0,330.0,1.0,1.0,2025-06-11,0410,Aqua,MODIS,80,6.1,295.0,50.0,D\n", encoding="utf-8")  # lejos de todo
        r = mm.cmd_importar(self.tmp, volcanes, csv_ext)
        self.assertEqual((r["Villarrica"]["agregadas"], r["Llaima"]["agregadas"]), (3, 1))
        vil = {(f["fecha_utc"], f["sensor"]): f for f in mm.leer_csv(self.tmp / "datos" / "Villarrica.csv") if f["origen"] == "firms"}
        f = vil[("2025-06-10T05:48:00", "VIIRS375")]
        self.assertAlmostEqual(f["vrp_mw"], 5.0, "FRP sumado sobre los píxeles de la pasada dentro de 25 km")
        self.assertLess(f["distancia_km"], 0.2, "distancia del píxel más cercano al cráter")
        self.assertTrue(f["dentro_radio"])
        self.assertEqual(vil[("2025-06-10T06:30:00", "VIIRS375")]["vrp_mw"], 2.0)
        lago = vil[("2025-06-12T05:48:00", "VIIRS375")]
        self.assertEqual((lago["vrp_mw"], lago["dentro_radio"], lago["clasificacion"]), (0.8, False, "fuera de radio"))
        lla = [f for f in mm.leer_csv(self.tmp / "datos" / "Llaima.csv") if f["origen"] == "firms"]
        self.assertEqual((lla[0]["sensor"], lla[0]["vrp_mw"]), ("MODIS", 12.0))
        # Un segundo volcán lejano al píxel de Aqua no recibe nada
        self.assertFalse((self.tmp / "datos" / "Isluga.csv").exists())
        # El resumen y el gráfico separan FIRMS de MIROVA
        estado = mm.cmd_resumen(self.tmp, volcanes, 10000)
        self.assertEqual(estado["volcanes"]["Villarrica"]["anomalias_ventana"], 0, "FIRMS no cuenta como anomalía MIROVA")
        self.assertEqual(estado["volcanes"]["Villarrica"]["firms_ventana"], 2, "sólo las pasadas dentro del radio")
        salidas = mm.cmd_graficar(self.tmp, volcanes, [30, 0])
        self.assertTrue(salidas[0].exists())

    def test_leer_firms_tolera_codigos_de_satelite(self):
        px = mm._leer_firms("latitude,longitude,acq_date,acq_time,satellite,instrument,frp\n"
                            "-39.42,-71.93,2025-01-01,130,T,MODIS,1.0\n"
                            "-39.42,-71.93,2025-01-01,0130,1,VIIRS,1.0\n"
                            "-39.42,-71.93,2025-01-01,0130,N21,VIIRS,x\n")
        self.assertEqual([(p["sensor"], p["fecha"].strftime("%H:%M")) for p in px], [("MODIS", "01:30"), ("VIIRS375", "01:30")])
        self.assertEqual(mm._leer_firms("UTC,VRP\n2025-01-01 00:00:00,1\n"), [], "no es FIRMS")

    def test_volcan_desconocido(self):
        with self.assertRaises(SystemExit):
            mm.elegir_volcanes(self.todos, self.seg, ["Vesubio"])


if __name__ == "__main__":
    unittest.main()
