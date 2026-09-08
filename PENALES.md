# Salas de Penales

Cada tanda es **un documento** de Firestore, en el mismo proyecto de Firebase
que usan los otros juegos (`gen-lang-client-0964124310`), en la base de datos
con nombre
`ai-studio-simuladordeagent-0792efbc-5156-4ebe-b931-3945e1f65db4`,
colección `salas_penal`. El id del documento es el código de cuatro letras
que se dictan por WhatsApp.

Igual que en Chao Pescao, **no hay plan B**: sin Firestore no arranca. Si la
regla no está publicada, el juego lo dice en pantalla.

## La regla que hay que publicar

Va **dentro** de `match /databases/{database}/documents`, junto a las reglas
que ya están (`users`, `global_game_defaults`, `ranking_presidente`,
`salas_chao`), sin reemplazarlas:

```
match /salas_penal/{codigo} {
  allow read: if true;

  allow create: if codigo.size() == 4
                && request.resource.data.codigo == codigo
                && request.resource.data.estado is string
                && request.resource.data.penal is int
                && request.resource.data.jugadores is map
                && request.resource.data.jugadores.size() <= 2;

  allow update: if request.resource.data.codigo == resource.data.codigo
                && request.resource.data.estado is string
                && request.resource.data.estado.size() <= 12
                && request.resource.data.penal is int
                && request.resource.data.penal >= 0
                && request.resource.data.penal <= 200
                && request.resource.data.jugadores is map
                && request.resource.data.jugadores.size() <= 2;

  allow delete: if false;
}
```

Las mismas dos mañas de siempre al pegarla en la consola: elegir la base de
datos **con nombre** (no la `(default)`), y revisar el final del archivo por
las `}` de sobra que deja el editor.

### El archivo completo, como tiene que quedar

Lo que ya estaba (`users`, `global_game_defaults`, `ranking_presidente`,
`salas_chao`) tal cual, más el bloque nuevo al final:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }

    match /global_game_defaults/{document=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == "Ykn696N9wIZBfnHX1LwMJXcMG562";
    }

    match /ranking_presidente/{doc} {
      allow read: if true;
      allow create: if request.resource.data.name is string && request.resource.data.name.size() > 0 && request.resource.data.name.size() <= 20 && request.resource.data.time is number && request.resource.data.time >= 0 && request.resource.data.time <= 86400 && request.resource.data.score is int && request.resource.data.score >= 0 && request.resource.data.score <= 1000000;
      allow update, delete: if false;
    }

    match /salas_chao/{codigo} {
      allow read: if true;

      allow create: if codigo.size() == 4
                    && request.resource.data.codigo == codigo
                    && request.resource.data.estado is string
                    && request.resource.data.ronda is int
                    && request.resource.data.jugadores is map
                    && request.resource.data.jugadores.size() <= 20;

      allow update: if request.resource.data.codigo == resource.data.codigo
                    && request.resource.data.estado is string
                    && request.resource.data.estado.size() <= 12
                    && request.resource.data.ronda is int
                    && request.resource.data.ronda >= 0
                    && request.resource.data.ronda <= 200
                    && request.resource.data.jugadores is map
                    && request.resource.data.jugadores.size() <= 20;

      allow delete: if false;
    }

    match /salas_penal/{codigo} {
      allow read: if true;

      allow create: if codigo.size() == 4
                    && request.resource.data.codigo == codigo
                    && request.resource.data.estado is string
                    && request.resource.data.penal is int
                    && request.resource.data.jugadores is map
                    && request.resource.data.jugadores.size() <= 2;

      allow update: if request.resource.data.codigo == resource.data.codigo
                    && request.resource.data.estado is string
                    && request.resource.data.estado.size() <= 12
                    && request.resource.data.penal is int
                    && request.resource.data.penal >= 0
                    && request.resource.data.penal <= 200
                    && request.resource.data.jugadores is map
                    && request.resource.data.jugadores.size() <= 2;

      allow delete: if false;
    }

  }
}
```

## Por qué está escrita así

Cualquiera lee y escribe sin identificarse, como en los otros juegos: es la
única forma de que el rival entre desde el link sin crear cuenta. La regla
cuida la forma del documento (el código no cambia, el número de penal es
sensato, no hay más de dos jugadores) y nada más.

Lo que en Chao Pescao era un detalle acá sería fatal: con `allow read` abierto,
el arquero podría leer la celda del tiro antes de elegir y atajar el cien por
ciento. Eso **no** se arregla con reglas, se arregla en el protocolo del juego
(ver "compromiso y revelación" abajo).

## Cómo se juega la tanda por dentro

- `estado`: `sala` (esperando al segundo) → `tanda` → `fin`.
- `penal`: el número del penal en curso, desde 1. Impar patea el primero de la
  lista, par el segundo. Del 11 en adelante es muerte súbita.
- `vuelta`: cuántas tandas se jugaron en esta sala. Sube con cada revancha.
- `jugadores`: mapa `id → {nombre, orden}`. Exactamente dos, sin espectadores.
- `goles`: mapa `id → total`. Se escribe el **total**, no un incremento, para
  que escribirlo dos veces dé lo mismo.
- `compromiso`: mapa `pN → {id → hash}`. `revelado`: mapa `pN → {id → {celda, sal}}`.
  Van por penal y se escriben por ruta (`compromiso.p3.abc123`); Firestore
  mezcla campo por campo, así que los dos pueden escribir a la vez. La `p`
  adelante es porque una ruta que empieza con número no es válida.
- `historial`: una entrada por penal: quién pateó, quién atajó, celda del tiro,
  celda del arquero, resultado (`gol`, `atajada`, `afuera`).
- `ganador`: el id del que ganó, cuando `estado` es `fin`.

### La grilla

Nueve celdas, 0..8. La fila es `floor(i/3)` (0 abajo, 1 media, 2 arriba) y la
columna `i%3` (0 izquierda, 1 centro, 2 derecha). **Izquierda y derecha son
las del que patea**, siempre; es como los dos ven el arco en pantalla.

Los dos eligen en la misma grilla: el pateador dónde la pone, el arquero para
dónde se tira. El arquero no cubre solo su celda: llega a las vecinas con menos
eficacia (vertical 0.45, horizontal 0.30, diagonal 0.12, más lejos nada).

Cada celda tiene una **precisión** (qué tan seguido el tiro va donde se apuntó;
al ángulo 0.74, abajo a los palos 0.92) y una **atajabilidad** (qué tan seguido
la saca el arquero si llega; al ángulo 0.42, abajo 0.75). Adivinar no es
atajar. Con estos números, contra un arquero que elige al azar entra el 73%
de los penales, un poco por debajo del 75-80% real. Para subirlo, bajar un par
de puntos `ATAJABLE`; para bajarlo, bajar `PRECISION`. Están arriba de todo en
el script, con comentarios.

### Compromiso y revelación

Cada penal va en dos pasos. Primero cada uno publica **solo el hash SHA-256**
de `penal|celda|sal`, con una sal aleatoria que guarda en su propio
`localStorage`. Cuando los dos hashes están en el documento, cada uno publica la
celda y la sal en claro, y cada navegador comprueba que el hash del rival
cuadre. Si no cuadra, el penal se cobra en contra del que mintió.

La sal se guarda en `localStorage` y no en memoria para que una recarga entre
el compromiso y la revelación no deje el penal trabado para los dos.

SHA-256 solo existe en contexto seguro (https o localhost). Abierto como
archivo suelto, el juego avisa y no deja jugar.

### El azar, pero igual en los dos teléfonos

Un `Math.random()` daría gol en una pantalla y atajada en la otra. La semilla
sale de `código|penal|celdaTiro|celdaArquero`, que los dos tienen idéntico, y
de ahí un xorshift saca dos números: uno decide si el tiro va al arco, el otro
si el arquero la saca. Mismo dato, mismo resultado, sin árbitro.

### Quién escribe el resultado

El primero que ve las dos revelaciones. Como el cálculo es determinista, si los
dos escriben a la vez escriben lo mismo. Antes de escribir se mira si ya hay
una entrada de ese penal en `historial`, para no duplicarla.

### Cuándo se corta

Durante los primeros cinco de cada uno, apenas la diferencia es mayor que los
tiros que le quedan al que va perdiendo (los penales que en la cancha no se
patean). Después de los diez, en muerte súbita, se compara por pares completos.

### El reloj

Diez segundos por penal, contados por cada navegador desde que ve el penal en
pantalla (el reloj del penal siguiente arranca cuando termina la animación del
anterior, que dura tres segundos y medio). Al llegar a cero, si no elegiste va
la de siempre: abajo al medio, para los dos roles. Son defaults fijos, sin
azar. Si el rival no revela nunca, doce segundos después aparece el botón
**cobrar el penal**: es una persona la que decide, no un automatismo.

### Contra la máquina

Desde la portada se puede jugar una tanda contra el navegador, sin sala ni
Firestore. Es la misma partida con el mismo protocolo: la sala es un objeto
en memoria, `escribir()` aplica los cambios por ruta igual que lo haría
Firestore, y el rival (id `maquina`) publica sus compromisos y revelaciones
desde el mismo navegador, con medio segundo de "pensar". Patea más a los palos
que al medio y, al atajar, una de cada tres veces se tira a donde más pateaste.
Sirve para probar sin publicar la regla y para practicar.

## Cómo comprobar que funciona

Abrí <https://profesergiom.github.io/penales/> y creá una sala:

- Aparece el código de cuatro letras → la regla anda.
- Aviso rojo *"Firestore no deja crear la sala"* → falta publicarla.

También se puede mirar desde la terminal, sin abrir nada. A diferencia de lo
que dice SALAS.md, `curl` **sí** sirve si se apunta a la base de datos con
nombre (con la `(default)` da `PERMISSION_DENIED` siempre, porque no existe):

```bash
curl -s "https://firestore.googleapis.com/v1/projects/gen-lang-client-0964124310/databases/ai-studio-simuladordeagent-0792efbc-5156-4ebe-b931-3945e1f65db4/documents/salas_penal/ZZZZ?key=AIzaSyCfIYgZhaRUyYdgAyJqGTNYJMNW_iUtsQs"
```

- `NOT_FOUND` → la regla está publicada (deja leer, y ese documento no existe).
- `PERMISSION_DENIED` → falta la regla.

Lo mismo con `salas_chao` en vez de `salas_penal` da `NOT_FOUND`: sirve de
control para ver que no es la red ni la clave.

## Por qué Formula 600 no necesitó nada de esto

Porque no usa Firestore. Su multijugador va por **WebRTC con PeerJS**: el
servidor público de PeerJS solo presenta a los jugadores y después los datos
viajan directo entre navegadores. No hay base de datos, así que no hay reglas.
Chao Pescao sí las necesitó (está en SALAS.md), y Penales igual: cada colección
nueva de Firestore es un `match` nuevo que hay que publicar.

Para jugar hacen falta dos ventanas **en modo incógnito distinto** (o dos
navegadores): la identidad está en `localStorage`, dos pestañas normales son
el mismo jugador.
