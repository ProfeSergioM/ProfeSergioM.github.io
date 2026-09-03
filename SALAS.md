# Salas de Chao Pescao

Cada sala es **un documento** de Firestore, en el mismo proyecto de Firebase
que usan Presidente.pe y Agente Agente (`gen-lang-client-0964124310`), en la
base de datos con nombre
`ai-studio-simuladordeagent-0792efbc-5156-4ebe-b931-3945e1f65db4`,
colección `salas_chao`. El id del documento es el código de cuatro letras
que se dictan por WhatsApp.

A diferencia del ranking de Presidente.pe, acá **no hay plan B**: el juego es
multijugador y sin Firestore no arranca. Si la regla no está publicada, el
juego lo dice con todas sus letras en pantalla.

## La regla que hay que publicar

Va **dentro** de `match /databases/{database}/documents`, junto a las reglas
de `users`, `global_game_defaults` y `ranking_presidente`, sin reemplazarlas:

```
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
```

### El archivo completo, como quedo publicado

Por si alguna vez hay que reponer todo de una (es lo de `users`,
`global_game_defaults` y `ranking_presidente` tal cual estaba, mas el bloque
nuevo al final):

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

  }
}
```

Al pegarla en el editor de la consola, las mismas dos mañas de siempre:
elegir la base de datos **con nombre** (no la `(default)`, que en este
proyecto ni existe), y revisar el final del archivo, porque el editor
autocompleta llaves y deja `}` de sobra que hay que borrar a mano.

## Por qué está escrita así

Cualquiera puede leer y escribir sin identificarse, igual que en el ranking.
Es la única forma de que un amigo entre desde el link de WhatsApp sin crear
cuenta. Lo que la regla sí hace es cuidar la forma del documento: que el
código no cambie, que la ronda sea un número sensato y que la sala no crezca
sin límite.

En `update`, `request.resource.data` es el documento **después** del cambio,
así que las validaciones valen también para las escrituras por campo
(`jugadores.abc123.fuera`), que es como escribe el juego casi siempre.

`delete` está cerrado: las salas viejas quedan ahí. Son documentos chicos
(veinte jugadores y un puñado de rondas), pero si algún día molestan, se
borran desde la consola.

Lo que la regla **no** puede evitar es que alguien con la consola del
navegador abierta escriba votos ajenos o se saque a sí mismo de la lista de
eliminados. Para eso haría falta un servidor, que en un sitio estático no
existe. Es un juego para el grupo de WhatsApp: el que hace trampa así se
está haciendo trampa solo.

## Cómo se juega la partida por dentro

- `estado`: `sala` (esperando) → `votando` → `reparto` → `votando` → … → `fin`.
- `jugadores`: mapa `id → {nombre, fuera, tarde, orden}`. `fuera` es el que ya
  salió; **igual vota** todas las rondas. `tarde` es el que llegó con la
  partida empezada: entra como espectador (vota, pero no se lo puede votar).
- `votos`: mapa `id del que vota → id del votado`. Se vacía en cada ronda.
- `historial`: una entrada por ronda, con la pregunta (siempre la misma), el conteo, quién votó a
  quién y quién salió. Durante la partida el reparto solo muestra cuántos
  votos sacó cada uno; quién votó a quién aparece recién al terminar, todo
  junto, ronda por ronda.
- `chat`: mapa `id del mensaje → {n: nombre, t: texto}`. Va en el mismo
  documento y se escribe por ruta (`chat.mXXXX`), no como lista: Firestore
  mezcla campo por campo, así que dos que escriben al mismo tiempo no se
  pisan. Un array sí se pisaría. Se podan los más viejos pasando los 50
  mensajes, para que el documento no crezca sin freno. Al terminar la partida
  se borra entero (`chat: {}`), o sea del servidor y de todas las pantallas;
  también al empezar otra.

**Nadie arbitra.** Cuando llegan todos los votos, el primer navegador que se
da cuenta calcula el resultado y lo escribe. El cálculo es determinista: con
los mismos votos da lo mismo, así que si dos navegadores escriben al mismo
tiempo escriben exactamente lo mismo y no se pisan. Por eso los empates **no**
se sortean: un sorteo daría un resultado distinto en cada navegador y partiría
la sala al medio. Si hay empate no sale nadie y va otra ronda.

**La ronda dura un minuto.** Cada navegador cuenta su propio minuto desde que
ve la ronda, así no importa que los relojes de los teléfonos estén desfasados;
el primero que llega a cero cierra la votación con los votos que haya. Si a
alguien se le durmió la pestaña, la cierra otro. Al que no votó simplemente no
se le cuenta.

El anfitrión solo controla el ritmo (empezar, siguiente ronda, cerrar una
votación que no llega nunca, sacar a alguien). Si se va o se queda pegado,
cualquiera puede apretar **Tomar el mando** y seguir.

## Cómo comprobar que funciona

Igual que con el ranking, `curl` contra la API REST no prueba nada: devuelve
`PERMISSION_DENIED` esté la regla publicada o no. La comprobación válida es el
cliente real.

Abrí <https://profesergiom.github.io/chao-pescao/> y creá una sala:

- Aparece el código de cuatro letras → la regla anda.
- Sale el aviso rojo *"Firestore no deja crear la sala"* → falta publicarla.

Para probar la partida completa hacen falta tres jugadores. Sirve el mismo
computador con tres ventanas **en modo incógnito distinto** (o tres
navegadores): la identidad se guarda en `localStorage`, así que dos pestañas
normales comparten jugador y el juego las ve como uno solo.
