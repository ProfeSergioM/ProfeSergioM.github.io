# Ranking de Presidente.pe

El ranking está en **Firestore**, en el mismo proyecto de Firebase que usa
Agente Agente (`gen-lang-client-0964124310`), en la base de datos con nombre
`ai-studio-simuladordeagent-0792efbc-5156-4ebe-b931-3945e1f65db4`.

Antes estaba en Supabase. Ese proyecto se eliminó (el subdominio dejó de
resolver), así que el ranking arrancó de cero. No había nada que migrar.

## La regla que hay que tener publicada

Sin esta regla el juego funciona igual, pero guardando el ranking solo en el
navegador de cada persona. Para que el ranking sea global hay que agregar el
bloque en la consola de Firebase:

**Firestore Database → Rules**, y pegar este `match` **dentro** de
`match /databases/{database}/documents { ... }`, junto a los que ya estén:

```
match /ranking_presidente/{doc} {
  allow read: if true;

  allow create: if request.resource.data.name is string
                && request.resource.data.name.size() > 0
                && request.resource.data.name.size() <= 20
                && request.resource.data.time is number
                && request.resource.data.time >= 0
                && request.resource.data.time <= 86400
                && request.resource.data.score is int
                && request.resource.data.score >= 0
                && request.resource.data.score <= 1000000;

  allow update, delete: if false;
}
```

Ojo: elegí la base de datos correcta en el selector de arriba de la pantalla
de Rules. Si publicás las reglas en la `(default)`, el juego no las va a ver.

## Por qué está escrita así

Cualquiera puede escribir sin identificarse, igual que antes con Supabase
(`WITH CHECK (true)`). Es la única forma de tener un ranking sin obligar a
crear cuenta. Pero acá al menos se valida la forma de los datos: sin esas
condiciones se puede escribir basura arbitraria en la colección.

`update` y `delete` están cerrados, así que un puntaje ya publicado no se
puede alterar ni borrar desde el navegador.

Lo que la regla **no** puede evitar es que alguien invente un puntaje
plausible. Para eso haría falta validar del lado del servidor, que en un sitio
estático no existe. Para un juego de este tipo es un costo razonable.

## Cómo comprobar que quedó bien

Con la regla publicada, esto tiene que devolver `200`:

```bash
curl -s -o /dev/null -w '%{http_code}\n' "https://firestore.googleapis.com/v1/projects/gen-lang-client-0964124310/databases/ai-studio-simuladordeagent-0792efbc-5156-4ebe-b931-3945e1f65db4/documents/ranking_presidente?key=AIzaSyCfIYgZhaRUyYdgAyJqGTNYJMNW_iUtsQs"
```

Un `403` significa que la regla no está publicada, o que se publicó en la base
de datos equivocada.

## Si Firestore no responde

El juego no se cuelga. Espera lo que diga `RANKING_ESPERA` (6 segundos) y
después usa el ranking guardado en `localStorage`. El menú muestra
`RANKING LOCAL` en vez de `RANKING GLOBAL`, y el respaldo local se escribe
siempre, haya nube o no.
