# Seguimiento automático de anomalías térmicas con MIROVA

Esta carpeta automatiza el seguimiento temporal de la potencia radiativa
volcánica (VRP) que publica [MIROVA](https://www.mirovaweb.it) (Middle InfraRed
Observation of Volcanic Activity, Universidad de Turín) para uno o más volcanes.
La idea central es sencilla: MIROVA sobrescribe sus productos en cada pasada
satelital y su tabla de últimas detecciones sólo conserva las filas recientes,
de modo que para ver la evolución de las anomalías hay que ir guardando cada
lectura a medida que aparece. Un flujo de GitHub Actions hace eso cada tres
horas y deja el resultado publicado en
[profesergiom.github.io/mirova](https://profesergiom.github.io/mirova/).

## Qué produce

| Salida | Contenido |
| --- | --- |
| `datos/<Volcan>.csv` | Una fila por adquisición y sensor: fecha UTC, VRP en MW, distancia al cráter, si está dentro del radio del volcán y la clase de intensidad. Nunca se duplican filas. |
| `datos/estado.json`, `datos/resumen.md` | Resumen por volcán: última anomalía, máximo de la ventana, tendencia y conteos. |
| `graficos/<Volcan>_serie.png` | Serie temporal propia, dos paneles (30 días y 1 año), escala logarítmica, un marcador por sensor. |
| `imagenes/<Volcan>/*.png` | Copias locales de las figuras oficiales de MIROVA (VRP, log VRP, distancia, últimas 10 detecciones). Se descargan sólo cuando cambian. |
| `index.html` | Panel web interactivo que lee los CSV y muestra la serie, las últimas lecturas y las figuras oficiales. |

## Cómo funciona

1. `NRT/latest.php` en mirovaweb.it lista las últimas detecciones de todos los
   volcanes con fecha de adquisición, ID, nombre, VRP (MW), distancia (km) y
   sensor. El script la lee, se queda con los volcanes en seguimiento y agrega
   al CSV las filas que todavía no tenía. La clave de cada fila es la pareja
   fecha de adquisición y sensor.
2. Cada fila se clasifica con la escala logarítmica de MIROVA (Coppola et al.,
   2016): muy baja (< 1 MW), baja (< 10), moderada (< 100), alta (< 1000) y
   muy alta. Una detección a más distancia del cráter que el radio configurado
   en `volcanes.json` se marca como "fuera de radio", porque suele corresponder
   a incendios u otras fuentes no volcánicas.
3. Las figuras oficiales se descargan desde
   `OUTPUTweb/MIROVA/<SENSOR>/VOLCANOES/<Nombre>/<Nombre>_<SENSOR>_<tipo>.png`
   con `If-Modified-Since`, de modo que sólo se transfieren cuando MIROVA las
   regenera.
4. Con el CSV acumulado se dibuja la serie propia y se escribe el resumen.

## Uso local

```bash
pip install -r mirova/requirements.txt      # sólo matplotlib; el resto es biblioteca estándar
python mirova/mirova_monitor.py todo        # actualizar + graficar + resumen
python mirova/mirova_monitor.py --volcanes Villarrica,355100 actualizar
python mirova/mirova_monitor.py graficar --dias 30 365
python mirova/mirova_monitor.py resumen --dias 30
python -m unittest mirova/pruebas.py        # pruebas sin red
```

Los volcanes se eligen con `--volcanes`, con la variable de entorno
`MIROVA_VOLCANES` o con el campo `seguimiento` de `volcanes.json`. El valor
`todos` sigue los once volcanes de la lista. Para agregar otro volcán basta con
añadir su entrada en `volcanes.json`: el `volcano_id` es el número que MIROVA
usa en `?volcano_id=` y coincide con el número del Global Volcanism Program del
Smithsonian; el `mirova_name` es el texto exacto que aparece en las rutas de
`OUTPUTweb` (por ejemplo `ChillanNevadosde`).

## Automatización en GitHub

El flujo `.github/workflows/mirova.yml` corre cada tres horas y también a mano
desde la pestaña Actions (con un campo opcional para indicar los volcanes).
Instala matplotlib, corre las pruebas, ejecuta `todo` y hace commit de los
cambios en `datos/`, `imagenes/` y `graficos/`. Necesita que el repositorio
permita a Actions escribir: Settings, Actions, General, "Workflow permissions",
"Read and write permissions".

## Limitaciones que conviene conocer

- La tabla `latest.php` sólo muestra detecciones recientes. El histórico previo
  a la primera ejecución no se recupera desde ahí. Para series largas
  (2000 a 2019) existe la base de datos MIROVA v1 publicada en
  [OSF](https://osf.io/zm62w/), que se puede cargar al CSV con el mismo formato.
- Un VRP de 0 significa que hubo una observación sin anomalía, no ausencia de
  datos. En los gráficos esas observaciones se dibujan como marcas sobre la
  línea inferior, porque la escala logarítmica no admite el cero.
- Si MIROVA cambia el formato de la tabla, el parser lo detecta y el flujo
  falla con un mensaje claro en vez de guardar datos erróneos. En ese caso hay
  que ajustar `parsear_latest` en `mirova_monitor.py`.
- MIROVA pide citar la fuente. Referencia: Coppola, D., Laiolo, M., Cigolini,
  C., Delle Donne, D., Ripepe, M. (2016). Enhanced volcanic hot-spot detection
  using MODIS IR data: results from the MIROVA system. Geological Society,
  London, Special Publications, 426, 181 a 205.
