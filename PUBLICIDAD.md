# Poner publicidad de Google en el sitio

Guía para encender AdSense en profesergiom.github.io. Todo lo que hay que
tocar del lado del código ya está preparado: falta tu número de editor.

---

## 1. Crear la cuenta y pedir el sitio

En <https://adsense.google.com> creás la cuenta con tu cuenta de Google y
agregás el sitio **profesergiom.github.io**.

AdSense te va a dar un **número de editor** con esta forma:

```
ca-pub-1234567890123456
```

Ese número aparece en todos los pasos siguientes. Anotalo.

## 2. Verificar que el sitio es tuyo

AdSense pide poner un script en el `<head>` de la página. Hay que ponerlo en
**todas** las páginas del sitio, no solo en la portada: `index.html` de la
raíz y el de cada juego.

```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456" crossorigin="anonymous"></script>
```

En Ruta al Podio ese script ya está escrito y comentado en
`ruta-al-podio/index.html`: hay que descomentarlo y cambiar las X por tu
número. Ojo: ese archivo se regenera al exportar el juego, así que el cambio
va también en el original, `ruta-al-podio/web/portada.html` del proyecto de
Godot.

## 3. El archivo ads.txt

En la **raíz** del sitio (al lado de `index.html`) tiene que existir un
archivo llamado `ads.txt` con una sola línea, con tu número sin el `ca-`:

```
google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0
```

Queda accesible en `https://profesergiom.github.io/ads.txt`. Sin esto,
AdSense marca el sitio como "no autorizado" y no paga.

## 4. Crear el bloque y pegarlo

En AdSense, **Anuncios → Por bloque de anuncios → Display**. Elegí tamaño
fijo 320×50 (el hueco que ya tiene el juego). Te da un `data-ad-slot`.

En `ruta-al-podio/index.html`, dentro de `<div id="banner">`, borrá el
`<div class="aviso">` y descomentá el bloque:

```html
<ins class="adsbygoogle"
     style="display:inline-block;width:320px;height:50px"
     data-ad-client="ca-pub-1234567890123456"
     data-ad-slot="0000000000"></ins>
<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
```

## 5. Esperar la revisión

Google revisa el sitio antes de mostrar anuncios. Suele tardar de unos días
a dos semanas. Hasta que aprueben, el hueco queda en blanco.

---

## Lo que conviene saber antes

- **El sitio necesita contenido propio y tráfico real.** Google rechaza
  sitios vacíos o con poco contenido. Siete juegos jugables ayudan; un sitio
  recién creado y sin visitas suele ser rechazado la primera vez. Se puede
  volver a pedir.
- **Hacen falta páginas de privacidad y de cookies.** AdSense usa cookies, y
  para visitantes de Europa hay que pedir consentimiento. Google ofrece un
  "mensaje de privacidad y consentimiento" que se activa desde el panel de
  AdSense y se muestra solo. Conviene activarlo.
- **Nunca hagas clic en tus propios anuncios**, ni le pidas a nadie que lo
  haga. Es la causa más común de cuentas cerradas.
- **Cuánto paga**: con un banner de 320×50 en un sitio de juegos chico, el
  orden de magnitud es de centavos de dólar por cada mil impresiones. Para
  cobrar hay que llegar a 70 dólares acumulados. Con pocas visitas, esto es
  un experimento, no un ingreso.
- **El anuncio está fuera del juego a propósito**: el lienzo de Godot ocupa
  toda la ventana en la que vive, así que el juego va en un marco y el
  banner debajo. Así el anuncio nunca tapa el juego ni se mezcla con los
  controles, que además es lo que exige la política de AdSense (no confundir
  anuncios con la interfaz).

## Alternativas si AdSense rechaza el sitio

- **Ko-fi o Cafecito**: un botón de donación, sin revisión ni mínimos.
- **itch.io**: publicar los juegos ahí también, con propinas opcionales.
- Redes de anuncios para juegos web como **CrazyGames** o **GameDistribution**,
  que piden juego terminado pero suelen ser más accesibles que AdSense.
