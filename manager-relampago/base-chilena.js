/* ══════════════════════════════════════════════════════════
   BASE POR DEFECTO · figuras históricas de la liga chilena
   Es un CSV igual al que se sube a mano, así se corrige sin
   tocar código: una fila por jugador, separado por punto y coma.

   club  = el club chileno con el que más se lo asocia (cuenta
           para la química: dos del mismo club rinden un poco más).
   pais  = solo en los nacidos fuera de Chile que jugaron en la liga
           chilena (el país de nacimiento, también en los nacionalizados
           que jugaron por la Selección); los chilenos lo dejan vacío. Los extranjeros se verificaron
           con búsquedas web (club, posición y nacionalidad).
   media = un único número de 1 a 99, el OVR. Es una valoración
           de juego para comparar épocas, no un dato oficial: se
           puede ajustar libremente. La escala va de unos 58 a 93,
           abierta a propósito para que los modos con OVR máximo
           (85, 80, 75, 70) tengan jugadores de sobra.

   Para que entren 8 DT con 16 picks cada uno hacen falta al
   menos 128 jugadores, con 8 arqueros como mínimo.
   ══════════════════════════════════════════════════════════ */
export const NOMBRE_BASE = "Leyendas del fútbol chileno";

export default `nombre;posicion;media;club;pais
Sergio Livingstone;POR;82;Universidad Católica
Misael Escuti;POR;76;Colo-Colo
Manuel Astorga;POR;70;Universidad de Chile
Adolfo Nef;POR;76;Colo-Colo
Óscar Wirth;POR;73;Cobreloa
Roberto Rojas;POR;79;Colo-Colo
Daniel Morón;POR;72;Colo-Colo;Argentina
Marcelo Ramírez;POR;70;Colo-Colo
Patricio Toledo;POR;70;Universidad Católica
Nelson Tapia;POR;75;Universidad Católica
Sergio Vargas;POR;72;Universidad de Chile
Johnny Herrera;POR;75;Universidad de Chile
Miguel Pinto;POR;67;Universidad de Chile
Claudio Bravo;POR;87;Colo-Colo
Cristopher Toselli;POR;67;Universidad Católica
Brayan Cortés;POR;67;Colo-Colo
Elías Figueroa;DEF;93;Palestino
Raúl Sánchez;DEF;73;Santiago Wanderers
Luis Eyzaguirre;DEF;75;Universidad de Chile
Sergio Navarro;DEF;72;Universidad de Chile
Carlos Contreras;DEF;70;Universidad de Chile
Alberto Quintano;DEF;79;Universidad de Chile
Mario Galindo;DEF;72;Colo-Colo
Leonel Herrera;DEF;73;Colo-Colo
Mario Soto;DEF;75;Cobreloa
Héctor Puebla;DEF;69;Cobreloa
Lizardo Garrido;DEF;76;Colo-Colo
Javier Margas;DEF;76;Colo-Colo
Miguel Ramírez;DEF;75;Colo-Colo
Gabriel Mendoza;DEF;70;Colo-Colo
Eduardo Vilches;DEF;67;Colo-Colo
Ronald Fuentes;DEF;72;Universidad de Chile
Cristián Castañeda;DEF;69;Universidad de Chile
Dante Poli;DEF;70;Universidad Católica
Pablo Contreras;DEF;70;Colo-Colo
Mauricio Isla;DEF;78;Universidad Católica
Gonzalo Jara;DEF;76;Huachipato
Gary Medel;DEF;82;Universidad Católica
Eugenio Mena;DEF;72;Universidad de Chile
José Rojas;DEF;70;Universidad de Chile
Osvaldo González;DEF;69;Universidad de Chile
Guillermo Maripán;DEF;72;Universidad Católica
Enzo Roco;DEF;67;Universidad Católica
Stefano Magnasco;DEF;64;Universidad Católica
Cristián Álvarez;DEF;64;Universidad Católica
Gabriel Suazo;DEF;67;Colo-Colo
Igor Lichnovsky;DEF;64;Universidad de Chile
Óscar Opazo;DEF;64;Colo-Colo
Hans Martínez;DEF;64;Universidad Católica
Benjamín Kuscevic;DEF;63;Universidad Católica
Jorge Toro;MED;79;Colo-Colo
Eladio Rojas;MED;75;Everton
Francisco Valdés;MED;81;Colo-Colo
Rubén Marcos;MED;73;Universidad de Chile
Alberto Fouillioux;MED;76;Universidad Católica
Ignacio Prieto;MED;75;Universidad Católica
Carlos Reinoso;MED;81;Audax Italiano
Alfonso Lara;MED;70;Colo-Colo
Guillermo Páez;MED;69;Colo-Colo
Rodolfo Dubó;MED;70;Palestino
Manuel Rojas;MED;72;Palestino
Víctor Merello;MED;73;Cobreloa
Armando Alarcón;MED;69;Cobreloa
Jaime Pizarro;MED;78;Colo-Colo
Jorge Aravena;MED;76;Universidad Católica
Rubén Espinoza;MED;73;Universidad Católica
José Luis Sierra;MED;78;Colo-Colo
Nelson Parraguez;MED;70;Universidad Católica
Mario Lepe;MED;69;Universidad Católica
Clarence Acuña;MED;72;Universidad de Chile
Luis Musrri;MED;69;Universidad de Chile
Esteban Valencia;MED;70;Universidad de Chile
Rodrigo Tello;MED;69;Universidad de Chile
Moisés Villarroel;MED;67;Santiago Wanderers
David Pizarro;MED;81;Santiago Wanderers
Luis Jiménez;MED;76;Palestino
Claudio Maldonado;MED;72;Colo-Colo
Arturo Sanhueza;MED;64;Colo-Colo
Milovan Mirosevic;MED;70;Universidad Católica
Arturo Vidal;MED;88;Colo-Colo
Matías Fernández;MED;81;Colo-Colo
Jorge Valdivia;MED;82;Colo-Colo
Gonzalo Fierro;MED;69;Colo-Colo
Carlos Villanueva;MED;69;Audax Italiano
Charles Aránguiz;MED;82;Universidad de Chile
Marcelo Díaz;MED;78;Universidad de Chile
Felipe Gutiérrez;MED;73;Universidad Católica
José Pedro Fuenzalida;MED;70;Universidad Católica
Jaime Valdés;MED;70;Colo-Colo
Esteban Pavez;MED;67;Colo-Colo
Claudio Baeza;MED;66;Colo-Colo
Erick Pulgar;MED;73;Universidad Católica
Diego Valdés;MED;72;Audax Italiano
Tomás Alarcón;MED;66;O'Higgins
Marcelino Núñez;MED;67;Universidad Católica
Rodrigo Echeverría;MED;63;Universidad de Chile
Enrique Hormazábal;DEL;79;Colo-Colo
Jorge Robledo;DEL;81;Colo-Colo
Manuel Muñoz;DEL;73;Colo-Colo
Leonel Sánchez;DEL;87;Universidad de Chile
Carlos Campos;DEL;78;Universidad de Chile
Pedro Araya;DEL;73;Universidad de Chile
Braulio Musso;DEL;70;Universidad de Chile
Carlos Caszely;DEL;87;Colo-Colo
Julio Crisosto;DEL;73;Colo-Colo
Leonardo Véliz;DEL;75;Colo-Colo
Sergio Ahumada;DEL;72;Colo-Colo
Juan Carlos Letelier;DEL;72;Cobreloa
Rubén Martínez;DEL;72;Colo-Colo
Aníbal González;DEL;70;Colo-Colo
Iván Zamorano;DEL;90;Cobresal
Marcelo Salas;DEL;90;Universidad de Chile
Rodrigo Barrera;DEL;70;Universidad de Chile
Rodrigo Goldberg;DEL;69;Universidad de Chile
Pedro González;DEL;72;Universidad de Chile
Sebastián Rozental;DEL;70;Universidad Católica
Luka Tudor;DEL;67;Universidad Católica
Reinaldo Navia;DEL;72;Santiago Wanderers
Héctor Tapia;DEL;70;Colo-Colo
Sebastián González;DEL;70;Colo-Colo
Humberto Suazo;DEL;81;Colo-Colo
Alexis Sánchez;DEL;88;Cobreloa
Eduardo Vargas;DEL;79;Universidad de Chile
Mauricio Pinilla;DEL;73;Universidad de Chile
Esteban Paredes;DEL;76;Colo-Colo
Fabián Orellana;DEL;72;Audax Italiano
Ángelo Henríquez;DEL;66;Universidad de Chile
Nicolás Castillo;DEL;70;Universidad Católica
Lucas Assadi;DEL;64;Universidad de Chile
Darío Osorio;DEL;67;Universidad de Chile
Alexander Aravena;DEL;66;Universidad Católica
Justo Villar;POR;76;Colo-Colo;Paraguay
Claudio Arbiza;POR;67;Colo-Colo;Uruguay
Matías Dituro;POR;69;Universidad Católica;Argentina
Gustavo Dalsasso;POR;64;Everton;Argentina
Ladislao Mazurkiewicz;POR;82;Cobreloa;Uruguay
Leandro Requena;POR;61;Cobresal;Argentina
Cristián Muñoz;POR;66;Colo-Colo;Argentina
José María Buljubasich;POR;67;Universidad Católica;Argentina
Franco Torgnascioli;POR;60;Everton;Uruguay
Julio Barroso;DEF;70;Colo-Colo;Argentina
Germán Lanaro;DEF;67;Universidad Católica;Argentina
Matías Zaldivia;DEF;66;Colo-Colo;Argentina
Emiliano Amor;DEF;64;Colo-Colo;Argentina
Maximiliano Falcón;DEF;67;Colo-Colo;Uruguay
Omar Merlo;DEF;61;Huachipato;Argentina
Sergio Vázquez;DEF;73;Universidad Católica;Argentina
Óscar Blanco;DEF;67;Santiago Wanderers;Argentina
Franco Calderón;DEF;61;Universidad de Chile;Argentina
Matías Rodríguez;DEF;69;Universidad de Chile;Argentina
Mauricio Victorino;DEF;67;Universidad de Chile;Uruguay
Facundo Imboden;DEF;61;Universidad Católica;Argentina
Andrés Scotti;DEF;67;Colo-Colo;Uruguay
Javier Menghini;DEF;60;Everton;Argentina
Ramón Arias;DEF;63;Universidad de Chile;Uruguay
Mariano Uglessich;DEF;58;O'Higgins;Argentina
Luis Del Pino Mago;DEF;61;Palestino;Venezuela
Cristian Grabinski;DEF;58;Deportes Iquique;Argentina
Mathías Corujo;DEF;63;Universidad de Chile;Uruguay
Cristian Traverso;DEF;67;Universidad de Chile;Argentina
Rogelio Delgado;DEF;70;Universidad de Chile;Paraguay
Mario Lucca;DEF;61;Unión Española;Argentina
Marcelo Espina;MED;78;Colo-Colo;Argentina
Néstor Gorosito;MED;79;Universidad Católica;Argentina
Darío Conca;MED;76;Universidad Católica;Argentina
Macnelly Torres;MED;73;Colo-Colo;Colombia
Diego Buonanotte;MED;73;Universidad Católica;Argentina
Luciano Aued;MED;72;Universidad Católica;Argentina
Emiliano Vecchio;MED;72;Colo-Colo;Argentina
Walter Montillo;MED;78;Universidad de Chile;Argentina
Severino Vasconcelos;MED;78;Colo-Colo;Brasil
Ricardo Lunari;MED;70;Universidad Católica;Argentina
Gustavo Lorenzetti;MED;69;Universidad de Chile;Argentina
Guillermo Marino;MED;69;Universidad de Chile;Argentina
Leonardo Gil;MED;70;Colo-Colo;Argentina
Marco Etcheverry;MED;82;Colo-Colo;Bolivia
Roberto Coll;MED;73;Palestino;Argentina
Leonardo Rodríguez;MED;75;Universidad de Chile;Argentina
Enzo Kalinski;MED;66;Universidad Católica;Argentina
Tomás Costa;MED;64;Universidad Católica;Argentina
Damián Díaz;MED;64;Universidad Católica;Argentina
Giovanni Hernández;MED;70;Colo-Colo;Colombia
Fernando Zuqui;MED;66;Universidad Católica;Argentina
Agustín Farías;MED;64;Palestino;Argentina
Ramón Fernández;MED;67;O'Higgins;Argentina
Gonzalo Montes;MED;64;Huachipato;Uruguay
Gonzalo Castellani;MED;63;Unión La Calera;Argentina
Marcelo Barticciotto;DEL;79;Colo-Colo;Argentina
Ricardo Dabrowski;DEL;73;Colo-Colo;Argentina
Diego Rivarola;DEL;76;Universidad de Chile;Argentina
Fernando Zampedri;DEL;79;Universidad Católica;Argentina
Lucas Barrios;DEL;79;Colo-Colo;Paraguay
Elson Beyruth;DEL;75;Colo-Colo;Brasil
Jorge Luis Siviero;DEL;73;Cobreloa;Uruguay
Washington Olivera;DEL;72;Cobreloa;Uruguay
Octavio Rivero;DEL;67;Colo-Colo;Uruguay
Alberto Acosta;DEL;78;Universidad Católica;Argentina
Ever Cantero;DEL;63;Cobresal;Paraguay
Eladio Zárate;DEL;73;Unión Española;Paraguay
Juan Manuel Olivera;DEL;69;Universidad de Chile;Uruguay
Ezequiel Miralles;DEL;67;Everton;Argentina
Pablo Calandria;DEL;64;O'Higgins;Argentina
Sebastián Jaime;DEL;64;Unión Española;Argentina
Cecilio Waterman;DEL;63;Coquimbo Unido;Panamá
Javier Correa;DEL;67;Colo-Colo;Argentina
Pablo Solari;DEL;67;Colo-Colo;Argentina
José Manuel Moreno;DEL;85;Universidad Católica;Argentina
Walter Jiménez;DEL;67;Colo-Colo;Argentina
Cristian Bogado;DEL;63;Deportes Iquique;Paraguay
Darío Lezcano;DEL;61;Colo-Colo;Paraguay
Leandro Fernández;DEL;67;Universidad de Chile;Argentina
Juan Carlos Almada;DEL;69;Universidad Católica;Argentina
José Saturnino Cardozo;DEL;78;Universidad Católica;Paraguay
Juan Martín Lucero;DEL;66;Colo-Colo;Argentina
Jorge Quinteros;DEL;66;Universidad Católica;Argentina
Lucas Pratto;DEL;69;Universidad Católica;Argentina
Esteban Fuertes;DEL;67;Universidad Católica;Argentina
Cris Martínez;DEL;61;Huachipato;Paraguay
Lionel Altamirano;DEL;60;Huachipato;Argentina
Hugo Giorgi;DEL;67;Audax Italiano;Argentina
Joaquín Larrivey;DEL;67;Universidad de Chile;Argentina
Gustavo Biscayzacú;DEL;64;Unión Española;Uruguay
Diego Churín;DEL;61;Unión Española;Argentina
Silvio Fernández;DEL;61;Santiago Wanderers;Uruguay
Jonathan Benítez;DEL;60;Palestino;Argentina
Hugo Brizuela;DEL;61;O'Higgins;Paraguay
Gustavo Canales;DEL;72;Universidad de Chile;Argentina
Óscar Fabbiani;DEL;78;Palestino;Argentina
Ernesto Álvarez;DEL;73;Universidad de Chile;Argentina
Luciano Cabral;MED;69;Coquimbo Unido;Argentina
Paulo Magalhães;DEF;64;Universidad de Chile;Brasil
Rodolfo Almeyda;MED;70;Universidad Católica;Argentina
Franco Bechtholdt;MED;61;Curicó Unido;Argentina
Nicolás Peranic;POR;63;Deportes Melipilla;Argentina
Arnaldo Castillo;DEL;64;O'Higgins;Paraguay
Pedro Pablo Hernández;MED;70;O'Higgins;Argentina
Marcos González;DEF;67;Universidad de Chile;Brasil
Gabriel Arias;POR;67;Unión La Calera;Argentina
Jorge Spedaletti;DEL;72;Universidad de Chile;Argentina
Fernando de Paul;POR;64;Universidad de Chile;Argentina
Miiko Albornoz;DEF;61;Colo-Colo;Suecia
`;
