/* Idioma del portal: inglés por defecto, español a un clic. El diccionario está indexado por el texto en
   español (que es el que está escrito en index.html), así que la página se sigue editando en castellano.
   Se guarda la elección en el navegador y se cambia sin recargar. */
(function () {
  var EN = {
    'Proyectos': 'Projects',
    'Juegos y experimentos personales, uno por archivo.': 'Personal games and experiments, one per file.',
    'Juegos y experimentos personales.': 'Personal games and experiments.',
    'Cosas que hice para probar ideas. Todo corre en el navegador, sin instalar nada y sin cuentas. Andan igual en el teléfono que en la computadora.':
      'Things I built to try out ideas. Everything runs in the browser, nothing to install and no accounts. They work the same on a phone as on a computer. Most are in Spanish; Formula 600 has an English option.',
    'Juego · 2026': 'Game · 2026',
    'Jugar': 'Play',
    'En construcción': 'Under construction',
    'Lo que venga': 'Whatever comes next',
    'Hecho a mano, sin frameworks ni rastreadores.': 'Handmade, no frameworks and no trackers.',
    'El código de cada proyecto está en': 'The code for each project is on',

    // ---- True o Poser
    'Simulador de banda de rock. Dieciséis semestres de decisiones para llegar a cerrar la noche en Rock in Rio, sin venderse en el camino. Ciento un situaciones, veinticinco hitos y quince finales distintos.':
      'Rock band simulator. Sixteen semesters of decisions to end up headlining Rock in Rio without selling out along the way. A hundred and one situations, twenty-five milestones and fifteen different endings.',
    '6 minutos': '6 minutes',
    'Un jugador': 'Single player',
    'Con sonido': 'With sound',

    // ---- Presidente.pe
    'Arcade de supervivencia en píxeles. Aguanta en el poder esquivando protestas, tomatazos, escándalos y tuits virales, y sobrevive a las elecciones que caen cada cinco niveles. Hay ranking global.':
      'Pixel survival arcade. Cling to power dodging protests, flying tomatoes, scandals and viral tweets, and survive the elections that land every five levels. There is a global leaderboard.',
    '3 minutos': '3 minutes',
    'Ranking global': 'Global leaderboard',
    'Para el teléfono': 'Made for phones',

    // ---- Agente Agente
    'Simulador de representante de futbolistas. Abre tu agencia en el país que elijas, ficha promesas antes que nadie, negocia traspasos y comisiones, y sube de oficina hasta dominar el mercado. Temporada tras temporada.':
      'Football agent simulator. Open your agency in the country you pick, sign prospects before anyone else, negotiate transfers and commissions, and climb from office to office until you own the market. Season after season.',
    'Partidas largas': 'Long games',
    'Guarda tu progreso': 'Saves your progress',

    // ---- Chao Pescao
    'Votaciones para el grupo de WhatsApp. Uno arma la sala y pasa el link; cada ronda votan todos y el más votado se va. Los eliminados siguen votando en todas las rondas, así que nadie mira desde afuera. Gana el que queda de pie.':
      'Voting rounds for your group chat. One person opens the room and shares the link; every round everyone votes and whoever gets the most votes is out. Eliminated players keep voting in every round, so nobody just watches. Last one standing wins.',
    'De 3 a 20': '3 to 20 players',
    'Multijugador': 'Multiplayer',
    'Sin instalar nada': 'Nothing to install',

    // ---- Formula 600
    'Campeonato de Fiat 600 en pistas de ripio y barro, en 3D caricaturesco. Siete fechas con lluvia, niebla y nocturna, taller para reparar y preparar el auto, un rival que te provoca, y salas multijugador para correr contra tus amigos.':
      'Fiat 600 championship on gravel and mud, in cartoon 3D. Seven rounds with rain, fog and a night race, a workshop to repair and tune the car, a rival who taunts you, and multiplayer rooms to race your friends.',
    'Carreras de 3 minutos': '3-minute races',

    // ---- Ruta al Podio
    'Empezás con una vulcanizadora de chapa y cuatrocientos pesos. Atendés los autos que entran, comprás máquinas, contratás gente, abrís negocios y sedes en otros barrios, fabricás tu propio modelo y terminás peleando los cuatro campeonatos mundiales.':
      'You start with a tin-roofed tyre shop and four hundred pesos. You serve the cars that come in, buy machines, hire people, open branches in other neighbourhoods, build your own model and end up fighting for the four world championships.',
    'Partidas muy largas': 'Very long games',

    // ---- El Desafío
    'Coge un club de Tercera y llévalo hasta reunir mil millones para retirarte a una isla privada. Contrata personal que automatiza cada área, arma el once, ficha en las ventanas de mercado y aguanta a una directiva que no perdona. Ligas con clubes reales de diez países, semana a semana.':
      'Take a third-division club and grow it until you have a billion and can retire to a private island. Hire staff that automate each area, pick the eleven, sign players in the transfer windows and put up with a board that forgives nothing. Leagues with real clubs from ten countries, week by week.',
    'Meta: mil millones': 'Goal: one billion',

    // ---- Penales
    'Tanda de penales uno contra uno. Uno patea y el otro ataja, eligiendo a la vez en la misma grilla de nueve sin ver lo del otro. Cinco cada uno y después muerte súbita. Al ángulo es donde menos atajan... y donde más seguido se va afuera.':
      'One-on-one penalty shootout. One shoots and the other saves, both picking at the same time on the same grid of nine without seeing the other. Five each and then sudden death. The top corners are saved least often... and missed most often.',
    'De a 2': 'Two players',
    '2 minutos': '2 minutes',
  };

  var GUARDADO = 'sitio.idioma';
  var actual = 'en';
  try { var g = localStorage.getItem(GUARDADO); if (g === 'es' || g === 'en') actual = g; } catch (e) { /* sin almacenamiento */ }

  function t(txt) {
    if (actual === 'es' || txt == null) return txt;
    var limpio = String(txt).replace(/\s+/g, ' ').trim();
    return EN[limpio] != null ? EN[limpio] : txt;
  }
  // Traduce respetando los espacios de alrededor (el HTML viene con sangría y saltos de línea)
  function traducirNodo(original) {
    var m = original.match(/^(\s*)([\s\S]*?)(\s*)$/);
    var nucleo = m[2].replace(/\s+/g, ' ').trim();
    if (!nucleo) return original;
    var trad = t(nucleo);
    return trad === nucleo ? original : m[1] + trad + m[3];
  }

  function traducir() {
    var it = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var nodos = [], n;
    while ((n = it.nextNode())) nodos.push(n);
    for (var i = 0; i < nodos.length; i++) {
      var nodo = nodos[i];
      var padre = nodo.parentNode;
      if (!padre || padre.tagName === 'SCRIPT' || padre.tagName === 'STYLE') continue;
      if (nodo.__es === undefined) { if (!nodo.nodeValue.trim()) continue; nodo.__es = nodo.nodeValue; }
      nodo.nodeValue = traducirNodo(nodo.__es);
    }
    if (traducir.__titulo === undefined) traducir.__titulo = document.title;
    document.title = t(traducir.__titulo);
    var meta = document.querySelector('meta[name="description"]');
    if (meta) { if (!meta.__es) meta.__es = meta.content; meta.content = t(meta.__es); }
    var og = document.querySelector('meta[property="og:description"]');
    if (og) { if (!og.__es) og.__es = og.content; og.content = t(og.__es); }
    document.documentElement.lang = actual;
    var btn = document.getElementById('cambiar-idioma');
    if (btn) { btn.textContent = actual === 'en' ? 'Español' : 'English'; btn.setAttribute('aria-label', actual === 'en' ? 'Ver en español' : 'View in English'); }
  }

  function alternar() {
    actual = actual === 'en' ? 'es' : 'en';
    try { localStorage.setItem(GUARDADO, actual); } catch (e) { /* nada */ }
    traducir();
  }

  function arrancar() {
    var btn = document.getElementById('cambiar-idioma');
    if (btn) btn.addEventListener('click', alternar);
    traducir();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
