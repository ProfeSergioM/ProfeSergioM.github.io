# Poner publicidad de Google en el sitio

Todo lo del lado del código ya está hecho. Falta tu número de editor, que
solo te lo puede dar Google. Estos son los pasos, en orden.

---

## Paso 1. Crear la cuenta de AdSense

Entrá a <https://adsense.google.com> con tu cuenta de Google y creá la
cuenta. Cuando te pregunte el sitio, poné:

```
profesergiom.github.io
```

Al terminar, AdSense te muestra tu **número de editor**, con esta forma:

```
ca-pub-1234567890123456
```

Son `ca-pub-` y dieciséis dígitos. **Anotalo**: es lo único que hace falta
para todo lo que sigue.

## Paso 2. Escribirlo en el sitio

Una sola orden, desde la carpeta del sitio, con tu número en lugar del del
ejemplo:

```bash
python poner-publicidad.py ca-pub-1234567890123456
```

Eso hace, solo, las cuatro cosas que pide AdSense:

| qué | dónde |
|---|---|
| la etiqueta de verificación | en el `<head>` de las ocho páginas |
| el cargador de anuncios | `publicidad.js`, que ya incluyen todas |
| el archivo `ads.txt` | en la raíz, con tu número |
| el original del juego | `ruta-al-podio/web/portada.html`, para que no se pierda al exportar |

Se puede correr las veces que haga falta: actualiza en vez de duplicar.
Para apagar todo y dejar el sitio sin nada de Google:

```bash
python poner-publicidad.py --apagar
```

## Paso 3. Subirlo

```bash
git add -A && git commit -m "publicidad: numero de editor" && git push
```

GitHub Pages tarda un par de minutos. Después comprobá que estas dos cosas
se ven en el navegador:

- <https://profesergiom.github.io/ads.txt> muestra una línea con tu número.
- En cualquier página, con "ver código fuente", aparece la etiqueta
  `google-adsense-account` con tu número.

## Paso 4. Pedir la revisión

Volvé a AdSense y dale a **Verificar** o **Solicitar revisión**. Google
mira el sitio a mano. Suele tardar de unos días a dos semanas. Hasta que
aprueben, el hueco del banner queda con su cartelito y el sitio funciona
igual que siempre.

## Paso 5. Crear el bloque y encenderlo

Ya aprobado, en AdSense: **Anuncios → Por bloque de anuncios → Display**.
Elegí tamaño fijo **320 × 50**, que es el hueco que ya tiene el juego.
Te da un número de bloque (`data-ad-slot`), de solo dígitos.

Ese número va como **segundo argumento**:

```bash
python poner-publicidad.py ca-pub-1234567890123456 9876543210
git add -A && git commit -m "publicidad: bloque del banner" && git push
```

Desde ahí, el banner de abajo de Ruta al Podio muestra anuncios de verdad.

---

## Cómo está armado

`publicidad.js` es uno solo para todo el sitio y tiene **dos constantes
arriba de todo**: el editor y el número del bloque. Con el editor vacío el
archivo no hace nada: no carga nada de Google, no pone cookies, y el hueco
del banner queda con su cartelito. Por eso se puede tener el archivo
publicado desde antes de que exista la cuenta.

El anuncio sale en cualquier elemento con `data-anuncio="banner"`. Hoy lo
tiene el hueco de abajo de Ruta al Podio. Para poner uno en otra página
alcanza con agregarle ese atributo a un `div`.

**El anuncio está fuera del juego a propósito.** El lienzo de Godot ocupa
toda la ventana en la que vive, así que el juego va en un marco y el banner
queda debajo. Así el anuncio nunca tapa el juego ni se confunde con los
controles, que además es lo que exige la política de AdSense.

`ruta-al-podio/index.html` se regenera cada vez que exportás el juego desde
Godot, así que el script parchea también el original,
`ruta-al-podio/web/portada.html`. Si alguna vez el banner deja de aparecer
después de exportar, volvé a correr `poner-publicidad.py`.

## Lo que conviene saber antes

- **El sitio necesita contenido propio y tráfico real.** Google rechaza
  sitios vacíos o con pocas visitas. Siete juegos jugables ayudan, pero un
  sitio recién creado y sin visitas suele ser rechazado la primera vez. Se
  puede volver a pedir.
- **Hacen falta privacidad y consentimiento de cookies.** AdSense usa
  cookies, y para visitantes de Europa hay que pedir permiso. Google ofrece
  un "mensaje de privacidad y consentimiento" que se activa desde el panel
  de AdSense y se muestra solo. Conviene activarlo.
- **Nunca hagas clic en tus propios anuncios**, ni le pidas a nadie que lo
  haga. Es la causa más común de cuentas cerradas.
- **Cuánto paga**: con un banner de 320×50 en un sitio de juegos chico, el
  orden de magnitud es de centavos de dólar por cada mil impresiones, y
  para cobrar hay que llegar a 70 dólares acumulados. Con pocas visitas
  esto es un experimento, no un ingreso.

## Alternativas si AdSense rechaza el sitio

- **Ko-fi o Cafecito**: un botón de donación, sin revisión ni mínimos.
- **itch.io**: publicar los juegos ahí también, con propinas opcionales.
- Redes de anuncios para juegos web como **CrazyGames** o
  **GameDistribution**, que piden el juego terminado pero suelen ser más
  accesibles que AdSense.
