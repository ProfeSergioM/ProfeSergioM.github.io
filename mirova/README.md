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
| `datos/<Volcan>.csv` | Una fila por adquisición y sensor: fecha UTC, VRP en MW, distancia al cráter, si está dentro del radio del volcán, la clase de intensidad y el origen del dato. Nunca se duplican filas. |
| `datos/estado.json`, `datos/resumen.md` | Resumen por volcán: última anomalía, máximo de la ventana, tendencia y conteos. |
| `graficos/<Volcan>_serie.png` | Serie temporal propia, tres paneles (30 días, 1 año y serie completa), escala logarítmica, un marcador por sensor, con líneas de tendencia por sensor y general. |
| `fuentes/` | Exportaciones originales del MIROVA Dataset cargadas con `importar` (licencia CC BY 4.0, Universidad de Turín). |
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
añadir su entrada en `volcanes.json`: el `volcano_id` es el número que MIROVA
usa en `?volcano_id=` y coincide con el número del Global Volcanism Program del
Smithsonian; el `mirova_name` es el texto exacto que aparece en las rutas de
`OUTPUTweb` (por ejemplo `ChillanNevadosde`).

## Datos históricos

El monitor sólo ve lo que MIROVA publica desde que empezó a correr. Para
extender la serie hacia atrás hay tres vías, de mejor a peor:

1. **MIROVA Dataset (oficial, licencia CC BY 4.0).** Cubre 2000 a 2025 para
   170 volcanes con MODIS y VIIRS. Se exporta un CSV por volcán desde
   [Explore_Archive.php](https://www.mirovaweb.it/ARCHIVE/Explore_Archive.php)
   o se descarga completo desde [OSF, DOI 10.17605/OSF.IO/ZM62W](https://osf.io/zm62w/).
   Se carga con:

   ```bash
   python mirova/mirova_monitor.py --volcanes Villarrica importar --formato mirova Villarrica.csv
   ```

   El importador reconoce las columnas de la exportación "Raw data"
   (`timeUTC`, `Satellite` 1 Terra, 2 Aqua, 3 SNPP, 4 NOAA-20; `Resolution`
   1000, 750 o 375; `VRP` en W; `Max_Dist` en m; `Dayflag`) y convierte a MW y
   km. Ese archivo contiene sólo detecciones, no observaciones sin anomalía,
   incluye pasadas diurnas (`Dayflag` 1) y en la versión actual termina en
   marzo de 2025. Para Nevados de Chillán ya está cargado: 4 531 detecciones
   de enero de 2008 a marzo de 2025, con el CSV original guardado en
   `fuentes/` para reproducibilidad. Queda un hueco sin datos entre marzo de
   2025 y el 10 de enero de 2026, que ninguna de las fuentes públicas cubre.
2. **Registro público del proyecto MendozaVolcanic/Mirova-v1.** Lecturas de
   `latest.php` para los 11 volcanes chilenos desde el 10 de enero de 2026,
   con el mismo significado que las nuestras. Ya está cargado en este
   repositorio (filas con `origen = mendoza`). Para repetirlo o extenderlo a
   otros volcanes (ya aplicado a los once):

   ```bash
   curl -L -o consolidado.csv https://raw.githubusercontent.com/MendozaVolcanic/Mirova-v1/main/monitoreo_satelital/registro_vrp_consolidado.csv
   python mirova/mirova_monitor.py --volcanes todos importar --formato mendoza consolidado.csv
   ```
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
