# Salas de Mánager Relámpago

Cada partida es **un documento** de Firestore, en el mismo proyecto de Firebase
que usan los otros juegos (`gen-lang-client-0964124310`), en la base de datos
con nombre
`ai-studio-simuladordeagent-0792efbc-5156-4ebe-b931-3945e1f65db4`,
colección `salas_manager`. El id del documento es el código de cuatro letras
que se pasa por WhatsApp.

Igual que en Chao Pescao y Penales, **no hay plan B**: sin Firestore no
arranca. Si la regla no está publicada, el juego lo dice en pantalla.

## La regla que hay que publicar

Va **dentro** de `match /databases/{database}/documents`, junto a las reglas
que ya están (`users`, `global_game_defaults`, `ranking_presidente`,
`salas_chao`, `salas_penal`), sin reemplazarlas:

```
match /salas_manager/{codigo} {
  allow read: if true;

  allow create: if codigo.size() == 4
                && request.resource.data.codigo == codigo
                && request.resource.data.estado is string
                && request.resource.data.ronda is int
                && request.resource.data.jugadores is map
                && request.resource.data.jugadores.size() <= 16;

  allow update: if request.resource.data.codigo == resource.data.codigo
                && request.resource.data.estado is string
                && request.resource.data.estado.size() <= 12
                && request.resource.data.ronda is int
                && request.resource.data.ronda >= 0
                && request.resource.data.ronda <= 200
                && request.resource.data.jugadores is map
                && request.resource.data.jugadores.size() <= 16
                && request.resource.data.pozo is list
                && request.resource.data.pozo.size() <= 400;

  allow delete: if false;
}
```

Las mismas dos mañas de siempre al pegarla en la consola: elegir la base de
datos **con nombre** (no la `(default)`), y revisar el final del archivo por
las `}` de sobra que deja el editor.

## Por qué está escrita así

Cualquiera lee y escribe sin identificarse, como en los otros juegos. La regla
cuida la forma del documento: el código no cambia, la ronda es un número
sensato (el pick más alto posible es 8 equipos × 16 picks = 128) y la sala no
crece sin límite. El tope de `pozo` evita que alguien meta una base entera en
el documento: el juego nunca pasa de 160 jugadores en el pozo.

Firestore limita cada documento a 1 MB. Un pozo de 160 jugadores escrito como
texto corto (`nombre|POS|media|club|país`) pesa unos 8 KB, así que sobra lugar.

Lo que la regla **no** puede evitar es que alguien con la consola del
navegador abierta lea la táctica del rival antes de que se juegue la fecha, o
se escriba un pick fuera de turno. Para eso haría falta un servidor. Es un
juego entre amigos: el que hace trampa así se está haciendo trampa solo.

## Cómo se juega la partida por dentro

- `estado`: `sala` → `draft` → `tactica` → `partido` → `tactica` → … → `fin`.
- `ronda`: durante el draft, el número de pick en curso (desde 0). Desde la
  primera fecha, el número de fecha (desde 0).
- `config`: `{picks, seg}`. Picks por equipo (12, 14 o 16; por defecto 16) y
  segundos por pick (12, 20 o 35; por defecto 20).
- `fuente`: nombre y tamaño de la base de jugadores, para mostrarlo en la sala.
- `pozo`: la lista de jugadores del draft, como textos `nombre|POS|media|club|país`.
  Se arma al empezar, desde la base por defecto (figuras históricas del fútbol
  chileno, en `manager-relampago/base-chilena.js`) o desde la que subió el anfitrión.
  Tiene 100 jugadores, o más si los picks de todos no entran en 100. Por eso
  solo el anfitrión necesita el archivo: los demás leen el pozo de la sala.
- `orden`: el orden del draft, sorteado al empezar. El draft es en serpiente.
- `picks`: mapa `número de pick → índice en el pozo`. Se escribe con una
  transacción que comprueba que `ronda` sea ese pick, así dos teléfonos no
  pueden elegir en el mismo turno.
- `tacticas`: mapa `id → {f: formación, e: estilo}`. Es la táctica de la
  fecha en curso.
- `listos`: quién apretó "Listo" en la fecha o "Seguir" después del partido.
- `historial`: una entrada por fecha jugada, con las tácticas congeladas
  (`{t: {id: {f, e}}}`).

**Los partidos no se escriben nunca.** Cada teléfono los simula a partir del
pozo, los picks y las tácticas del historial, con un azar de semilla fija
(código de sala, fecha y los dos equipos). Mismos datos, mismo resultado en
todos lados. El motor está en `manager-relampago/motor.js`, sin nada de
pantalla ni de red, para poder probarlo solo.

**La base por defecto** es un CSV dentro de `base-chilena.js`, con el mismo
formato que se sube a mano: nombre, posición, OVR y el club chileno con el que
más se asocia a cada jugador. El OVR es una valoración de juego, no un dato
oficial, y se corrige editando esa fila. Tiene que haber al menos 128 jugadores
y 8 arqueros para que entren 8 DT con 16 picks. Si al final del draft a alguien
ya no le queda ningún jugador que respete los mínimos por puesto (por ejemplo,
se acabaron los arqueros), el juego lo deja elegir a cualquiera antes que
trabar el turno.

**La consola de administración** está en `manager-relampago/admin.html`
(<https://profesergiom.github.io/manager-relampago/admin.html>). Sirve para
editar, agregar y quitar jugadores de la base por defecto sin tocar código.
Guarda en Firestore, en `global_game_defaults/manager_base`, con los campos
`csv` (la base entera, mismo formato que el archivo), `nombre`, `n`,
`actualizado` y `por`. **No necesita regla nueva**: usa la de
`global_game_defaults` que ya está publicada, que deja leer a cualquiera y
escribir solo a la cuenta de administrador (la misma de Agente Agente). Hay que
entrar con esa cuenta de Google para poder guardar; sin sesión se puede mirar y
exportar.

El juego lee ese documento al arrancar. Si existe, esa base reemplaza a la de
`base-chilena.js`; si no existe o no se puede leer, se usa la del código. Las
salas que ya empezaron no cambian, porque su pozo quedó copiado en la sala.

**El formato del campeonato sale de cuántos DT hay**: 2 juegan una serie al
mejor de tres, 3 o 4 una liga ida y vuelta, y de 5 a 8 una liga a una rueda
con final entre los dos primeros (con penales si empatan).

**Cada fase tiene reloj.** Cada navegador cuenta su propio tiempo desde que ve
la fase. En el draft, al llegar a cero elige el piloto automático (el mejor
disponible del puesto que más le falta a ese plantel); los demás teléfonos
esperan tres segundos más antes de elegir por un dormido. En la charla técnica
son 45 segundos, y al que no tocó nada le queda un 4-4-2 equilibrado. Después
del partido se espera treinta segundos a los que no apretan "Seguir".

## Cómo comprobar que funciona

Abrí <https://profesergiom.github.io/manager-relampago/> y creá una sala:

- Aparece el código de cuatro letras → la regla anda.
- Sale el aviso rojo *"Firestore no deja crear la sala"* → falta publicarla.

Para probar la partida completa hacen falta dos DT. Sirven dos ventanas **en
modo incógnito distinto** (o dos navegadores): la identidad se guarda en
`localStorage`, así que dos pestañas normales comparten DT.
