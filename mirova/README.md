# Seguimiento automático de anomalías térmicas con MIROVA

Esta carpeta automatiza el seguimiento temporal de la potencia radiativa
volcánica (VRP) que publica [MIROVA](https://www.mirovaweb.it) (Middle InfraRed
Observation of Volcanic Activity, Universidad de Turín) para uno o más volcanes.
La idea central es sencilla: MIROVA sobrescribe sus productos en cada pasada
satelital y su tabla de últimas detecciones sólo conserva las filas recientes,
de modo que para ver la evolución de las anomalías hay que ir guardando cada
lectura a medida que aparece. Un flujo de GitHub Actions hace eso cada media
hora y deja el resultado publicado en
[profesergiom.github.io/mirova](https://profesergiom.github.io/mirova/).

## Qué produce

| Salida | Contenido |
| --- | --- |
| `datos/<Volcan>.csv` | Una fila por adquisición y sensor: fecha UTC, VRP en MW, distancia al cráter, si está dentro del radio del volcán, la clase de intensidad, el origen del dato (`latest.php`, `mirova-archivo` o `firms`) y la etiqueta `class` de MIROVA cuando existe. Nunca se duplican filas. |
| `datos/estado.json`, `datos/resumen.md` | Resumen por volcán: última anomalía, máximo de la ventana, tendencia y conteos. |
| `graficos/<Volcan>_serie.png` | Serie temporal propia, tres paneles (30 días, 1 año y serie completa), escala logarítmica, un marcador por sensor, con líneas de tendencia por sensor y general. |
| `fuentes/` | Subconjunto chileno del MIROVA Dataset v2.5 de OSF cargado con `importar` (licencia CC BY 4.0, Universidad de Turín; DOI 10.17605/OSF.IO/ZM62W). |
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
5. Las líneas de tendencia son una mediana móvil del logaritmo del VRP,
   calculada sólo con detecciones dentro del radio del cráter, por sensor y
   para el conjunto. La ventana es una doceava parte del panel, acotada entre
   7 días (panel mensual) y 180 días (serie completa). La mediana en escala
   logarítmica resiste los picos aislados y no se deja arrastrar por el fondo;
   donde hay menos de tres detecciones en la ventana la línea se corta en vez
   de extrapolar. Una regresión lineal sería engañosa con datos tan dispersos
   y de tantos órdenes de magnitud.

## Uso local

```bash
pip install -r mirova/requirements.txt      # sólo matplotlib; el resto es biblioteca estándar
python mirova/mirova_monitor.py todo        # actualizar + graficar + resumen
python mirova/mirova_monitor.py --volcanes Villarrica,355100 actualizar
python mirova/mirova_monitor.py graficar --dias 30 365 0   # 0 = toda la serie
python mirova/mirova_monitor.py resumen --dias 30
python -m unittest mirova/pruebas.py        # pruebas sin red
```

Los volcanes se eligen con `--volcanes`, con la variable de entorno
`MIROVA_VOLCANES` o con el campo `seguimiento` de `volcanes.json`. El valor
`todos` sigue los once volcanes de la lista y es el valor configurado. Para agregar otro volcán basta con
añadir su entrada en `volcanes.json`, con sus coordenadas del Global Volcanism Program para FIRMS: el `volcano_id` es el número que MIROVA
usa en `?volcano_id=` y coincide con el número del Global Volcanism Program del
Smithsonian; el `mirova_name` es el texto exacto que aparece en las rutas de
`OUTPUTweb` (por ejemplo `ChillanNevadosde`).

## Datos históricos

El monitor sólo ve lo que MIROVA publica desde que empezó a correr. Para
extender la serie hacia atrás hay tres vías:

1. **MIROVA Dataset (oficial, licencia CC BY 4.0).** Cubre 2000 a 2025 para
   170 volcanes con MODIS y VIIRS. Se exporta un CSV por volcán desde
   [Explore_Archive.php](https://www.mirovaweb.it/ARCHIVE/Explore_Archive.php)
   o se descarga completo desde [OSF, DOI 10.17605/OSF.IO/ZM62W](https://osf.io/zm62w/).
   Se carga con:

   ```bash
   python mirova/mirova_monitor.py --volcanes Villarrica importar Villarrica_MIROVA_Raw_data.csv
   ```

   El importador reconoce las columnas del archivo (`timeUTC`, `IDvolc`,
   `Satellite` 1 Terra, 2 Aqua, 3 SNPP, 4 NOAA-20; `Resolution` 1000, 750 o
   375; `VRP` en W; `Max_Dist` en m; `Dayflag`; `class`) y convierte a MW y
   km. Sirve tanto para la exportación de un volcán del panel web como para
   el archivo global `VRP_GLOBAL_ARCHIVE_2025.csv` de OSF, que trae los 170
   volcanes y se filtra por `IDvolc`. Ese archivo contiene sólo detecciones,
   no observaciones sin anomalía, e incluye pasadas diurnas (`Dayflag` 1).

   **Ya está cargado** el archivo OSF v2.5 (versión de febrero de 2026, que
   llega hasta diciembre de 2025) para los diez volcanes chilenos que
   contiene; Tupungatito no está entre los 170 del archivo. El subconjunto
   chileno (48 360 filas) queda en `fuentes/VRP_GLOBAL_ARCHIVE_2025_Chile.csv`
   para reproducibilidad. Entre diciembre de 2025 y el inicio de este monitor
   (5 de octubre de 2026) no hay datos de MIROVA; FIRMS cubre ese tramo.

   **Etiqueta `class`.** MIROVA clasifica automáticamente cada detección como
   volcánica (1) o no volcánica (0, por ejemplo incendios), y el panel web de
   MIROVA exporta por defecto sólo las de clase 1. Aquí se cargan ambas y la
   etiqueta se guarda en la columna `clase_mirova`. Una detección de clase 0
   nunca se atribuye al volcán aunque esté dentro del radio: queda con
   `dentro_radio = 0` y clasificación "no volcanica", se dibuja hueca y no
   entra en tendencias ni conteos. La columna `dentro_radio` significa, en
   rigor, "anomalía atribuida al volcán": a menos de `limite_km` del cráter y
   no descartada por MIROVA.
2. **NASA FIRMS, independiente de MIROVA.** Entrega cada píxel activo de
   MODIS (desde 2000) y VIIRS en S-NPP, NOAA-20 y NOAA-21 (375 m, desde 2012)
   con su potencia radiativa (FRP, en MW), para cualquier área y fecha, sin
   hueco en 2025 y 2026. Hay dos maneras de cargarlo:

   - **Por API**, con una clave gratuita de
     [firms.modaps.eosdis.nasa.gov/api/map_key](https://firms.modaps.eosdis.nasa.gov/api/map_key/):

     ```bash
     export FIRMS_MAP_KEY=...
     python mirova/mirova_monitor.py firms --desde 2025-03-07 --hasta 2026-10-05 --historico
     python mirova/mirova_monitor.py firms --dias 7          # últimos días, fuentes NRT
     ```

     `--historico` usa las fuentes de procesamiento estándar (`MODIS_SP`,
     `VIIRS_*_SP`), que son las definitivas, y para los últimos 90 días suma
     las de tiempo casi real (`*_NRT`), porque el procesamiento estándar
     llega con dos o tres meses de retraso; sin él usa sólo las NRT. La API admite tramos de
     10 días y 5 000 consultas cada 10 minutos; para un volcán y 19 meses son
     unas 230 consultas. Si la clave se guarda como secreto `FIRMS_MAP_KEY`
     del repositorio, el workflow trae además los últimos 7 días en cada
     corrida, y desde la pestaña Actions se puede lanzar una carga histórica
     indicando `firms_desde` y, opcionalmente, `firms_hasta`.
   - **Por archivo**, descargando el CSV desde la página "Archive Download"
     de FIRMS (cuenta gratuita, llega por correo) y cargándolo con
     `python mirova/mirova_monitor.py importar <archivo>.csv`; el formato se
     reconoce por el encabezado y un mismo archivo puede cubrir varios
     volcanes.

   Los píxeles se agrupan por pasada (fecha, satélite y sensor) sumando el
   FRP de los que están a menos de 25 km del volcán, con la distancia del
   píxel más cercano al cráter, imitando la lectura por pasada de MIROVA.
   Las filas quedan con origen `firms`.

   **Salvedad científica.** FIRMS reporta FRP, calculada con el algoritmo de
   incendios sobre cada píxel; MIROVA reporta VRP, calculada con el método
   MIR sobre el conjunto de píxeles anómalos y con un umbral propio. Son la
   misma magnitud física y suelen correlacionar bien en actividad sostenida,
   pero no son intercambiables número a número y FIRMS detecta menos
   anomalías débiles. Por eso los datos de FIRMS se dibujan con rombos y su
   propia tendencia gris, no entran en las tendencias ni en los conteos de
   MIROVA, y el panel los etiqueta como FRP. Sirven para evaluar el
   comportamiento a largo plazo y cubrir huecos, no para comparar valores
   exactos con MIROVA.
3. **Pedir la serie al equipo MIROVA** (diego.coppola@unito.it), que entrega
   series completas por volcán para fines de investigación.

Una importación nunca pisa filas existentes: sólo rellena fechas y sensores
que faltaban, y marca la procedencia en la columna `origen`.

## Automatización en GitHub

El flujo `.github/workflows/mirova.yml` corre cada media hora y también a mano
desde la pestaña Actions (con un campo opcional para indicar los volcanes).
Instala matplotlib, corre las pruebas, ejecuta `todo` y hace commit de los
cambios en `datos/`, `imagenes/` y `graficos/`. El permiso de escritura va
declarado en el propio workflow (`permissions: contents: write`), así que no
hace falta cambiar la configuración del repositorio.

## Limitaciones que conviene conocer

- La tabla `latest.php` muestra sólo la última pasada procesada de cada sensor
  por volcán. Si MIROVA procesa dos pasadas entre dos consultas, la primera no
  queda en el CSV; por eso el flujo corre cada media hora. Las figuras
  oficiales "últimas 10 detecciones" conservan las pasadas intermedias y
  sirven para contrastar. El histórico previo a la primera ejecución se
  carga con `importar` (ver "Datos históricos"). Para series largas
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
