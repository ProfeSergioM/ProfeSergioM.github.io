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

    def test_importar_mendoza_rellena_sin_pisar(self):
        volcanes = mm.elegir_volcanes(self.todos, self.seg, ["Villarrica", "Nevados de Chillan"])
        mm.cmd_actualizar(self.tmp, volcanes, con_imagenes=False, archivar=False, html_local=self.html)
        csv_ext = self.tmp / "consolidado.csv"
        csv_ext.write_text(
            "timestamp,Fecha_Satelite_UTC,Fecha_Captura_Chile,Volcan,Sensor,VRP_MW,Distancia_km,Tipo_Registro\n"
            "1,2026-10-05 06:12:30,x,Villarrica,MODIS,99,0.0,RUTINA\n"        # ya existe: no debe pisar el 0
            "2,2026-03-01 04:00:00,x,Villarrica,VIIRS,7.5,0.9,ALERTA_TERMICA\n"
            "3,2026-03-02 05:00:00,x,Villarrica,VIIRS375,0.0,0.0,RUTINA\n"
            "4,2026-03-02 05:00:00,x,Nevados de Chillan,VIIRS375,21,9.5,FALSO_POSITIVO\n"
            "5,2026-03-03 05:00:00,x,Copahue,MODIS,1,0.5,ALERTA_TERMICA\n", encoding="utf-8")
        r = mm.cmd_importar(self.tmp, volcanes, "mendoza", csv_ext)
        self.assertEqual(r["Villarrica"]["agregadas"], 2)
        self.assertEqual(r["Nevados de Chillan"]["agregadas"], 1)
        filas = mm.leer_csv(self.tmp / "datos" / "Villarrica.csv")
        por_clave = {(f["fecha_utc"], f["sensor"]): f for f in filas}
        self.assertEqual(por_clave[("2026-10-05T06:12:30", "MODIS")]["vrp_mw"], 0.0, "lo existente se conserva")
        self.assertEqual(por_clave[("2026-10-05T06:12:30", "MODIS")]["origen"], "latest.php")
        self.assertEqual(por_clave[("2026-03-01T04:00:00", "VIIRS750")]["origen"], "mendoza")
        self.assertEqual(por_clave[("2026-03-01T04:00:00", "VIIRS750")]["clasificacion"], "baja")
        chillan = mm.leer_csv(self.tmp / "datos" / "Nevados_de_Chillan.csv")
        self.assertEqual([f["clasificacion"] for f in chillan if f["origen"] == "mendoza"], ["fuera de radio"])
        self.assertFalse((self.tmp / "datos" / "Copahue.csv").exists(), "sólo los volcanes pedidos")
        r2 = mm.cmd_importar(self.tmp, volcanes, "mendoza", csv_ext)
        self.assertEqual(r2["Villarrica"]["agregadas"], 0, "reimportar no duplica")

    def test_importar_archivo_mirova(self):
        volcanes = mm.elegir_volcanes(self.todos, self.seg, ["Lascar"])
        csv_ext = self.tmp / "Lascar_MIROVA_Database_v1.csv"
        csv_ext.write_text(
            "UTC,Dayflag,Sensor,Tot_Lmir_bk,VRP,Lat,Lon,Dist\n"
            "01/03/2000 03:15:00,0,1,0.5,12500000,-23.37,-67.73,1200\n"
            "15/06/2013 05:10:00,0,3,0.4,800000,-23.37,-67.73,9800\n"
            "16/06/2013 05:10:00,0,4,0.4,abc,-23.37,-67.73,100\n", encoding="utf-8")
        r = mm.cmd_importar(self.tmp, volcanes, "mirova", csv_ext)
        self.assertEqual(r["Lascar"]["agregadas"], 2, "la fila con VRP no numérico se descarta")
        filas = mm.leer_csv(self.tmp / "datos" / "Lascar.csv")
        f0 = next(f for f in filas if f["fecha_utc"] == "2000-03-01T03:15:00")
        self.assertEqual((f0["sensor"], f0["vrp_mw"], f0["distancia_km"], f0["clasificacion"], f0["origen"]),
                         ("MODIS", 12.5, 1.2, "moderada", "mirova-archivo"))
        f1 = next(f for f in filas if f["fecha_utc"] == "2013-06-15T05:10:00")
        self.assertEqual((f1["sensor"], f1["vrp_mw"], f1["dentro_radio"]), ("VIIRS750", 0.8, False))
        with self.assertRaises(SystemExit):
            mm.cmd_importar(self.tmp, mm.elegir_volcanes(self.todos, self.seg, ["Lascar", "Isluga"]), "mirova", csv_ext)

    def test_volcan_desconocido(self):
        with self.assertRaises(SystemExit):
            mm.elegir_volcanes(self.todos, self.seg, ["Vesubio"])


if __name__ == "__main__":
    unittest.main()
