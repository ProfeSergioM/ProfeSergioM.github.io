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

    def test_volcan_desconocido(self):
        with self.assertRaises(SystemExit):
            mm.elegir_volcanes(self.todos, self.seg, ["Vesubio"])


if __name__ == "__main__":
    unittest.main()
