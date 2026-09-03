# Ranking de Presidente.pe

El ranking está en **Firestore**, en el mismo proyecto de Firebase que usa
Agente Agente (`gen-lang-client-0964124310`), en la base de datos con nombre
`ai-studio-simuladordeagent-0792efbc-5156-4ebe-b931-3945e1f65db4`,
colección `ranking_presidente`.

Antes estaba en Supabase. Ese proyecto se eliminó (el subdominio dejó de
resolver), así que el ranking arrancó de cero. No había nada que migrar.

## Estado: la regla ya está publicada

Se publicó el 1 de septiembre de 2026. Queda acá por si hay que reponerla o
migrar a otro proyecto. Va **dentro** de `match /databases/{database}/documents`,
junto a las reglas de `users` y `global_game_defaults`, sin reemplazarlas:

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

Al pegarla en el editor de la consola, ojo con dos cosas: elegir la base de
datos con nombre (no la `(default)`, que ni siquiera existe en este proyecto),
y revisar el final del archivo. El editor autocompleta llaves y deja `}` de
sobra que hay que borrar a mano.

## Por qué está escrita así

Cualquiera puede escribir sin identificarse, igual que antes con Supabase
(`WITH CHECK (true)`). Es la única forma de tener un ranking sin obligar a
crear cuenta. Pero acá al menos se valida la forma de los datos: sin esas
condiciones se puede escribir basura arbitraria en la colección.

`update` y `delete` están cerrados, así que un puntaje ya publicado no se
puede alterar ni borrar desde el navegador. La contracara es que para borrar
algo hay que entrar a la consola de Firebase.

Lo que la regla **no** puede evitar es que alguien invente un puntaje
plausible. Para eso haría falta validar del lado del servidor, que en un sitio
estático no existe. Para un juego de este tipo es un costo razonable.

## Cómo comprobar que funciona

**No sirve `curl` contra la API REST de Firestore.** Esa API no autentica con
una API key sola: devuelve `PERMISSION_DENIED` esté la regla publicada o no.
Da 403 en los dos casos, así que no prueba nada.

La comprobación válida es el cliente real. Abrí
<https://profesergiom.github.io/presidente-pe/> y mirá el menú:

- **`★ RANKING GLOBAL ★`** en dorado → Firestore respondió, la regla anda.
- `★ RANKING LOCAL ★` en gris → no hubo respuesta; está usando `localStorage`.

Para verificar también la escritura, en la consola del navegador:

```js
await pushLB('PRUEBA', 12.3, 45);
({ RANKING_NUBE, rankingCaido, lbCache })
```

Si `RANKING_NUBE` es `true` y `lbCache` trae lo que acabás de escribir, el
circuito completo funciona. Después conviene borrar esa entrada de prueba
desde la consola de Firebase, porque la regla no permite borrar desde el
navegador.

## Si Firestore no responde

El juego no se cuelga. Cada llamada de red corre contra un reloj de
`RANKING_ESPERA` (6 s) y después usa el ranking de `localStorage`. El menú
pasa a decir `RANKING LOCAL`, y el respaldo local se escribe siempre, haya
nube o no.

Al primer fallo se marca `rankingCaido` y el resto de la sesión va directo a
local, para no pagar la espera en cada partida. Medido con la red caída:
primera partida 6,4 s, las siguientes 1 ms.

Esto importa más de lo que parece: `addDoc` de Firestore resuelve su promesa
solo cuando el servidor confirma. Sin el reloj, una escritura sin conexión
queda encolada y la pantalla de fin de partida se queda clavada en
"Guardando…" para siempre.
