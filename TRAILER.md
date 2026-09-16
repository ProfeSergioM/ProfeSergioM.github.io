# Load Up (carpeta `load-up`)

El juego está en inglés y vive en `/load-up/`. La dirección vieja,
`/sube-al-trailer/`, quedó como una página que redirige, para no romper los
enlaces que ya andan dando vueltas. Este documento queda en castellano
porque es para el que toca el código.

La prueba existe de verdad en los óvalos de Estados Unidos: una camioneta
arrastra un acoplado abierto con una rampa atrás y da vueltas sin parar,
mientras varios autos intentan subirse en movimiento. Gana el primero que
mete el auto adentro y lo deja quieto. El juego es eso, visto desde arriba,
en un solo archivo (`load-up/index.html`) y sin dependencias.

## Cómo está armado

**La pista.** El óvalo se describe con dos números en vez de con una lista de
puntos: `s` es cuánto se avanzó sobre el eje y `n` cuánto se está corrido
hacia afuera. `puntoPista(s, n)` pasa de esos dos números al mundo y
`proyectar(x, y)` hace el camino inverso. Todo lo demás (la camioneta, los
muros, el trazado que siguen los rivales) se apoya en ese par de funciones,
así que cambiar el tamaño del óvalo es cambiar `A`, `R` y `HW`.

**La camioneta.** No se maneja: recorre el eje sola, acelera en las rectas,
levanta el pie en las curvas y se mueve de lado con un vaivén que depende de
la dificultad. Ese vaivén es lo que arruina los intentos prolijos y lo que
hace que subir en curva sea otra cosa que subir en recta.

**Los autos.** Cada uno se resuelve con velocidad de avance y velocidad
lateral, que es la forma más corta de que un auto cenital se sienta como un
auto. La misma función de dinámica corre en dos marcos distintos: el piso y
la cama del acoplado. Arriba de la cama se agregan las fuerzas que se sienten
adentro de un acoplado que acelera y dobla, y contra eso juegan las ruedas
quietas, que agarran hasta cierto punto (`roceLat`) y bastante más con el
freno de mano. La cama no tiene barandas ni pared adelante: pasarse de
cualquier borde es caerse, con la velocidad que se traía. De ahí sale la
regla del juego: en la recta uno se queda quieto sin esfuerzo, y en la curva
hace falta el freno de mano.

**Subir.** Lo único que se puede pisar del conjunto es el canal que va de la
punta de la rampa hasta el final de la cama; el resto es chapa y se choca
rueda por rueda, así que un auto cruzado raspa con la parte que quedó afuera
en vez de colarse por debajo del acoplado. El que va subiendo se dibuja
después del acoplado, porque si no el gráfico de la rampa le pasa por encima
y parece que se metiera debajo. Al cruzar la boca se mira el ángulo
y la diferencia de velocidad: derecho y por debajo de `V_SUBIDA` el auto sube;
torcido o disparado se lleva puesta la baranda.

**Los golpes.** Cada choque abolla según la velocidad con que se dio, y la
chapa rota se paga manejando: el auto pierde punta y el volante se pone vago
(`castigoPorDano`). Al llegar a cien queda afuera.

**Los rivales.** Van por turnos: encara el que está mejor parado y los demás
esperan corridos a un costado. Cada intento se sortea antes de empezar y
puede salir limpio, torcido o pasado de velocidad. Como el que sube torcido
igual se acomoda y termina ganando, lo que más mueve el largo de la carrera
no es cuántos intentos salen limpios sino `demora`, cuánto esperan antes de
volver a encarar. Medido con el jugador quieto, el primer rival gana cerca
de los ochenta segundos en Novato, de los treinta en Pro y de los veinte en
Leyenda, con bastante dispersión entre carreras.

## Los números que conviene tocar

Están todos juntos arriba del archivo:

| Qué | Dónde | Para qué |
| --- | --- | --- |
| `RAPIDEZ` | arriba de todo | multiplica velocidades, aceleraciones y giro a la vez, así el auto se sigue sintiendo igual pero todo pasa más rápido |
| `A`, `R`, `HW` | la pista | tamaño del óvalo y ancho de la tierra |
| `AGARRE` | arriba de todo | cuánto agarra la tierra: bajarlo saca la cola en las curvas, subirlo la pega al piso |
| `CAMA_L`, `CAMA_W` | las medidas | qué tan holgado entra el auto |
| `V_SUBIDA` | las medidas | diferencia máxima de velocidad para subir |
| `QUIETO` | las medidas | qué tan quieto hay que quedarse |
| `NIVELES` | dificultades | velocidad de la camioneta, vaivén, cantidad de rivales, `exito` (cuántos intentos de los rivales salen limpios), `demora` (cuánto esperan antes de volver a encarar) y `aguante` (segundos que hay que aguantar arriba) |

Con `?depurar=1` en la dirección queda `window.__juego` a mano, con los autos,
la camioneta y las funciones de la pista. Sirve para probar el juego desde
afuera sin tocar la física.
