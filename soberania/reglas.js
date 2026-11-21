// SOBERANÍA — reglas: tipos de gobierno, instituciones, ministerios, facciones, leyes, tratados.
// Solo datos y funciones puras. Corre igual en el navegador (global REGLAS) y en Node (require).
var REGLAS = (function () {

  // ---------------- Continentes y subregiones ----------------
  const CONTINENTES = {
    america_sur:   { nombre: 'América del Sur', subs: { andina: 'Andes', cono_sur: 'Cono Sur', atlantica: 'Brasil y las Guayanas' } },
    america_norte: { nombre: 'América del Norte, Central y Caribe', subs: { norte: 'Norteamérica', central: 'Centroamérica', caribe: 'Caribe' } },
    europa:        { nombre: 'Europa', subs: { occidental: 'Europa occidental', nordica: 'Nórdicos y Bálticos', mediterranea: 'Mediterráneo', oriental: 'Europa oriental', balcanes: 'Balcanes' } },
    africa:        { nombre: 'África', subs: { norte: 'Norte de África', occidental: 'África occidental', central: 'África central', oriental: 'África oriental', austral: 'África austral' } },
    asia:          { nombre: 'Asia', subs: { medio_oriente: 'Medio Oriente', central: 'Asia central y Cáucaso', sur: 'Asia del sur', este: 'Asia oriental', sudeste: 'Sudeste asiático' } },
    oceania:       { nombre: 'Oceanía', subs: { australasia: 'Australasia', pacifico: 'Islas del Pacífico' } },
  };

  // ---------------- Tipos de gobierno ----------------
  // demo: hay elecciones competitivas. pc: capital político base por trimestre.
  // poder: multiplicadores del poder de cada facción. leg: legitimidad base (autocracias).
  const TIPOS = {
    presidencial: {
      nombre: 'República presidencial', jefe: 'Presidente/a', demo: true, pc: 5, leg: 60, corr: 42,
      desc: 'Un presidente elegido por voto directo encabeza el Estado y el gobierno. Mandato fijo, Congreso separado.',
      pros: ['Mandato fijo: no te pueden censurar', 'Puedes gobernar por decreto (con riesgo)'],
      contras: ['Sin mayoría, el Congreso bloquea tus leyes', 'Juicio político si la aprobación se hunde'],
      poder: { clase_media: 1.3 }, legislativo: ['unicameral', 'bicameral'],
    },
    parlamentaria: {
      nombre: 'República parlamentaria', jefe: 'Primer/a ministro/a', demo: true, pc: 5, leg: 62, corr: 38,
      desc: 'El gobierno nace de la mayoría del Parlamento y depende de su confianza. Un presidente ceremonial.',
      pros: ['Con mayoría, las leyes pasan con facilidad', 'Puedes adelantar elecciones en buen momento'],
      contras: ['Moción de censura si pierdes apoyo', 'Las coaliciones cobran su precio'],
      poder: { sindicatos: 1.2, clase_media: 1.2 }, legislativo: ['unicameral', 'bicameral'],
    },
    monarquia_const: {
      nombre: 'Monarquía parlamentaria', jefe: 'Primer/a ministro/a', demo: true, pc: 5, leg: 66, corr: 36,
      desc: 'Una Corona símbolo de unidad y un gobierno que responde al Parlamento.',
      pros: ['La Corona amortigua las crisis (+estabilidad)', 'Prestigio internacional'],
      contras: ['La Casa Real cuesta dinero', 'Moción de censura como en toda democracia parlamentaria'],
      poder: { religiosos: 1.1 }, legislativo: ['unicameral', 'bicameral'], corona: true,
    },
    federal: {
      nombre: 'República federal', jefe: 'Presidente/a', demo: true, pc: 4, leg: 60, corr: 42,
      desc: 'Estados federados con gobierno, presupuesto y leyes propias, unidos por una Constitución.',
      pros: ['Regiones contentas, país más estable', 'Errores locales no tumban al gobierno central'],
      contras: ['Menos capital político', 'Las élites regionales tienen mucho poder'],
      poder: { regiones: 2.0 }, legislativo: ['bicameral'], territorial: 'federal',
    },
    monarquia_abs: {
      nombre: 'Monarquía absoluta', jefe: 'Rey/Reina', demo: false, pc: 8, leg: 55, corr: 52,
      desc: 'El monarca reúne todos los poderes. La tradición y la religión sostienen el trono.',
      pros: ['Mucho capital político, sin elecciones', 'Leyes por decreto real'],
      contras: ['Occidente desconfía', 'Jóvenes y sindicatos sin voz acumulan rabia'],
      poder: { religiosos: 1.5, empresarios: 1.2, militares: 1.3, sindicatos: 0.5, estudiantes: 0.6 }, legislativo: ['consultivo', 'ninguno'], corona: true,
    },
    partido_unico: {
      nombre: 'Estado de partido único', jefe: 'Secretario/a General', demo: false, pc: 9, leg: 55, corr: 50,
      desc: 'Un solo partido dirige el Estado, la economía y la sociedad. El Congreso del Partido decide.',
      pros: ['El capital político más alto', 'Puede planificar la economía'],
      contras: ['La legitimidad depende de los resultados', 'Congreso del Partido cada 5 años: purgas'],
      poder: { militares: 1.3, sindicatos: 0.6, empresarios: 0.6, estudiantes: 0.7 }, legislativo: ['consultivo'],
    },
    junta: {
      nombre: 'Junta militar', jefe: 'Presidente/a de la Junta', demo: false, pc: 8, leg: 40, corr: 55,
      desc: 'Las Fuerzas Armadas toman el control "hasta que se restablezca el orden".',
      pros: ['Orden y seguridad rápidos', 'Los militares están de tu lado… por ahora'],
      contras: ['Legitimidad baja, sanciones probables', 'Otros generales sueñan con tu silla'],
      poder: { militares: 2.5, empresarios: 1.1, sindicatos: 0.5, estudiantes: 0.8 }, legislativo: ['ninguno', 'consultivo'],
    },
    teocracia: {
      nombre: 'Teocracia', jefe: 'Guía Supremo', demo: false, pc: 7, leg: 52, corr: 48,
      desc: 'Un consejo religioso es la autoridad suprema; las leyes emanan de la fe.',
      pros: ['Religiosos muy leales', 'Legitimidad espiritual'],
      contras: ['Juventud inquieta', 'Aislamiento internacional'],
      poder: { religiosos: 2.5, militares: 1.2, estudiantes: 0.9 }, legislativo: ['consultivo', 'unicameral'],
    },
    tecnocracia: {
      nombre: 'Tecnocracia', jefe: 'Presidente/a del Consejo', demo: false, pc: 6, leg: 46, corr: 34,
      desc: 'Un consejo de expertos designados gobierna con criterios técnicos. Sin partidos.',
      pros: ['Ministerios más eficientes (+15%)', 'Inversión extranjera confía'],
      contras: ['Poca legitimidad popular', 'La calle no se siente representada'],
      poder: { empresarios: 1.4, clase_media: 1.2 }, legislativo: ['consultivo', 'unicameral'], eficiencia: 0.15,
    },
  };
  const ORDEN_TIPOS = ['presidencial', 'parlamentaria', 'monarquia_const', 'federal', 'monarquia_abs', 'partido_unico', 'junta', 'teocracia', 'tecnocracia'];

  // ---------------- Facciones ----------------
  const FACCIONES = {
    militares:   { nombre: 'Fuerzas Armadas',     corto: 'Militares',  poder: 1.0, peso: 0.02 },
    empresarios: { nombre: 'Empresariado',        corto: 'Empresarios', poder: 1.0, peso: 0.03 },
    sindicatos:  { nombre: 'Sindicatos',          corto: 'Sindicatos', poder: 0.8, peso: 0.22 },
    campesinos:  { nombre: 'Mundo rural',         corto: 'Campesinos', poder: 0.5, peso: 0.18 },
    clase_media: { nombre: 'Clase media urbana',  corto: 'Clase media', poder: 1.0, peso: 0.30 },
    religiosos:  { nombre: 'Comunidades religiosas', corto: 'Religiosos', poder: 0.6, peso: 0.10 },
    estudiantes: { nombre: 'Estudiantes y jóvenes', corto: 'Jóvenes',  poder: 0.5, peso: 0.10 },
    regiones:    { nombre: 'Élites regionales',   corto: 'Regiones',   poder: 0.6, peso: 0.05 },
  };
  const ORDEN_FAC = Object.keys(FACCIONES);

  // ---------------- Instituciones (la Constitución) ----------------
  // cada opción: costo (% del PIB al año), efectos estáticos que lee el núcleo.
  const INSTITUCIONES = {
    legislativo: {
      nombre: 'Poder Legislativo', ayuda: 'Quién vota las leyes.',
      op: {
        unicameral: { nombre: 'Asamblea unicameral', costo: 0.08, desc: 'Una sola cámara: leyes más rápidas.', lib: 4 },
        bicameral:  { nombre: 'Congreso bicameral', costo: 0.15, desc: 'Diputados y Senado: más freno, más estabilidad.', lib: 5, umbral: 3, est: 3 },
        consultivo: { nombre: 'Consejo consultivo designado', costo: 0.03, desc: 'Lo nombras tú. Aprueba lo que mandes.', lib: -4, legit: -2 },
        ninguno:    { nombre: 'Sin parlamento', costo: 0, desc: 'Gobiernas por decreto.', lib: -10, legit: -5 },
      },
    },
    judicial: {
      nombre: 'Poder Judicial', ayuda: 'Árbitro de la ley y freno al poder.',
      op: {
        independiente: { nombre: 'Corte Suprema independiente', costo: 0.12, desc: 'Menos corrupción y más inversión. Puede anular tus decretos.', corr: -12, lib: 10, g: 0.3, fac: { empresarios: 5, clase_media: 4 } },
        supervisado:   { nombre: 'Jueces nombrados por el gobierno', costo: 0.09, desc: 'Un término medio.', corr: 0, lib: 0 },
        subordinado:   { nombre: 'Tribunales subordinados', costo: 0.07, desc: 'Nadie te frena… ni a los corruptos.', corr: 10, lib: -10, g: -0.3, fac: { empresarios: -4 } },
      },
    },
    banco: {
      nombre: 'Banco Central', ayuda: 'Controla la moneda y la inflación.',
      op: {
        autonomo:    { nombre: 'Banco Central autónomo', costo: 0.02, desc: 'Inflación baja y crédito barato. No puedes imprimir dinero.', meta: 3, riesgo: -0.8, fac: { empresarios: 4 } },
        dependiente: { nombre: 'Bajo control de Hacienda', costo: 0.02, desc: 'Puedes emitir para financiar el gasto. Los mercados desconfían.', meta: 5.5, riesgo: 1, emitir: true },
      },
    },
    fuerzas: {
      nombre: 'Fuerzas Armadas', ayuda: 'A quién obedecen los cuarteles.',
      op: {
        civil:    { nombre: 'Profesionales, bajo mando civil', costo: 0, desc: 'Menos riesgo de golpe en democracia.', golpe: 0.6, fac: { militares: -4 } },
        fuero:    { nombre: 'Autónomas, con fuero propio', costo: 0, desc: 'Contentas y poderosas. Muy poderosas.', golpe: 1.2, fac: { militares: 10 }, poder: { militares: 1.4 } },
        milicia:  { nombre: 'Milicia leal al régimen', costo: 0.15, desc: 'Una guardia paralela que protege al poder.', golpe: 0.5, lib: -6, fac: { militares: -8 }, poder: { militares: 0.75 }, represion: 15 },
      },
    },
    prensa: {
      nombre: 'Prensa', ayuda: 'Cuánto se sabe de lo que haces.',
      op: {
        libre:    { nombre: 'Prensa libre', costo: 0, desc: 'Destapa escándalos, reduce corrupción, da prestigio.', corr: -8, lib: 14, prest: 6, fac: { clase_media: 4, estudiantes: 5 }, escandalos: 1.5 },
        regulada: { nombre: 'Medios regulados', costo: 0.02, desc: 'Licencias y "responsabilidad informativa".', corr: 0, lib: -2, escandalos: 0.8 },
        estatal:  { nombre: 'Medios estatales', costo: 0.08, desc: 'Solo se publica lo que conviene. Las encuestas mienten.', corr: 8, lib: -14, prest: -6, fac: { estudiantes: -6 }, escandalos: 0.3, propaganda: 5 },
      },
    },
    territorio: {
      nombre: 'Organización territorial', ayuda: 'Cuánto deciden las regiones.',
      op: {
        centralizado:    { nombre: 'Estado centralizado', costo: 0, desc: 'Todo se decide en la capital. Eficiente y resentido.', fac: { regiones: -8 }, ef: 0.03 },
        descentralizado: { nombre: 'Regiones con autonomía', costo: 0.2, desc: 'Gobiernos regionales electos.', fac: { regiones: 6 }, est: 2 },
        federal:         { nombre: 'Estados federados', costo: 0.4, desc: 'Cada estado con su parlamento.', fac: { regiones: 14 }, est: 4, ef: -0.03, poder: { regiones: 1.5 } },
      },
    },
    control: {
      nombre: 'Control de la corrupción', ayuda: 'Quién vigila a los que gastan.',
      op: {
        ninguno:   { nombre: 'Sin órgano de control', costo: 0, desc: 'Ahorro… aparente.', corr: 6 },
        contraloria: { nombre: 'Contraloría General', costo: 0.05, desc: 'Audita el gasto. Revela la honestidad de los ministros.', corr: -5, revela: true },
        fiscalia:  { nombre: 'Fiscalía anticorrupción independiente', costo: 0.09, desc: 'Persigue a cualquiera. Incluido tu gabinete.', corr: -11, revela: true, fac: { clase_media: 5, empresarios: -2 }, purga: true },
      },
    },
    inteligencia: {
      nombre: 'Servicios de inteligencia', ayuda: 'Ojos y oídos del Estado.',
      op: {
        ninguno:  { nombre: 'Sin servicio propio', costo: 0, desc: 'Te enteras de los complots tarde.', golpe: 1.15 },
        civil:    { nombre: 'Agencia civil supervisada', costo: 0.1, desc: 'Detecta conspiraciones con control parlamentario.', golpe: 0.85, aviso: true },
        secreta:  { nombre: 'Policía secreta', costo: 0.2, desc: 'Nada se mueve sin que lo sepas. El miedo también gobierna.', golpe: 0.6, aviso: true, lib: -12, represion: 25, fac: { estudiantes: -6, clase_media: -3 } },
      },
    },
    electoral: {
      nombre: 'Sistema electoral', ayuda: 'Cómo se convierten votos en escaños.', soloDemo: true,
      op: {
        mayoritario:  { nombre: 'Mayoritario', costo: 0, desc: 'El ganador se lleva mucho. Mayorías fuertes, vuelcos bruscos.', amplif: 2.0 },
        proporcional: { nombre: 'Proporcional', costo: 0, desc: 'Escaños según votos. Más legitimidad, más coaliciones.', amplif: 1.0, legit: 3 },
        mixto:        { nombre: 'Mixto', costo: 0, desc: 'Mitad distritos, mitad lista.', amplif: 1.4, legit: 1 },
      },
    },
    mandato: {
      nombre: 'Duración del mandato', ayuda: 'Cada cuántos años se vota.', soloDemo: true,
      op: { m4: { nombre: '4 años', costo: 0, anios: 4 }, m5: { nombre: '5 años', costo: 0, anios: 5 }, m6: { nombre: '6 años', costo: 0, anios: 6, legit: -2 } },
    },
  };
  const ORDEN_INST = ['legislativo', 'judicial', 'banco', 'fuerzas', 'prensa', 'territorio', 'control', 'inteligencia', 'electoral', 'mandato'];

  // ---------------- Ministerios ----------------
  // area: gasto cuya eficiencia mejora. fac: facción que se alegra de que exista.
  const MINISTERIOS = {
    interior:   { nombre: 'Interior', obligatorio: true, area: 'seguridad', desc: 'Orden público, policía, elecciones.' },
    exteriores: { nombre: 'Relaciones Exteriores', obligatorio: true, desc: 'Diplomacia: tratados y visitas son más efectivos.' },
    hacienda:   { nombre: 'Hacienda', obligatorio: true, desc: 'Recauda impuestos y maneja la deuda.' },
    defensa:    { nombre: 'Defensa', obligatorio: true, area: 'defensa', desc: 'Fuerzas Armadas.' },
    presidencia:{ nombre: 'Secretaría General de Gobierno', desc: '+1 capital político por trimestre.' },
    salud:      { nombre: 'Salud', area: 'salud', desc: 'Sin él, el gasto en salud rinde mucho menos.', fac: { clase_media: 2 } },
    educacion:  { nombre: 'Educación', area: 'educacion', desc: 'Sin él, el gasto en educación rinde mucho menos.', fac: { estudiantes: 4 } },
    economia:   { nombre: 'Economía y Comercio', desc: 'Más crecimiento y tratados comerciales más rentables.', fac: { empresarios: 4 } },
    trabajo:    { nombre: 'Trabajo', desc: 'Menos desempleo estructural.', fac: { sindicatos: 6 } },
    agricultura:{ nombre: 'Agricultura', desc: 'Apoyo técnico al campo.', fac: { campesinos: 7 } },
    energia:    { nombre: 'Energía y Minería', desc: 'Más regalías de los recursos naturales.', fac: { regiones: 3 } },
    obras:      { nombre: 'Obras Públicas', area: 'infra', desc: 'Sin él, la infraestructura rinde menos.', fac: { regiones: 3 } },
    social:     { nombre: 'Desarrollo Social', area: 'social', desc: 'El gasto social reduce más la desigualdad.', fac: { sindicatos: 2, campesinos: 2 } },
    seguridad:  { nombre: 'Seguridad Pública', area: 'seguridad', desc: 'Policía profesional: el gasto en seguridad rinde más.', fac: { clase_media: 3 } },
    ciencia:    { nombre: 'Ciencia y Tecnología', desc: 'Más crecimiento a largo plazo si la educación es buena.', fac: { estudiantes: 3 } },
    ambiente:   { nombre: 'Medio Ambiente', desc: 'Prestigio y jóvenes contentos. Mitiga desastres.', fac: { estudiantes: 4 } },
    cultura:    { nombre: 'Cultura', desc: 'Identidad nacional: +legitimidad.', fac: { religiosos: 1 } },
    turismo:    { nombre: 'Turismo', desc: 'El turismo rinde un 25% más.' },
  };
  const ORDEN_MIN = Object.keys(MINISTERIOS);
  const COSTO_MIN = 0.12; // % PIB por ministerio
  const MAX_MIN_SIN_BUROCRACIA = 13;

  // ---------------- Gasto público por área (% del PIB al año) ----------------
  const AREAS = {
    salud:     { nombre: 'Salud', def: 5, min: 0, max: 14 },
    educacion: { nombre: 'Educación', def: 4.5, min: 0, max: 12 },
    social:    { nombre: 'Protección social', def: 6, min: 0, max: 22 },
    infra:     { nombre: 'Infraestructura', def: 2.5, min: 0, max: 10 },
    seguridad: { nombre: 'Policía y justicia', def: 1.5, min: 0, max: 6 },
    defensa:   { nombre: 'Defensa', def: 1.8, min: 0, max: 10 },
  };
  const ORDEN_AREAS = Object.keys(AREAS);

  // ---------------- Recursos y desarrollo ----------------
  const RECURSOS = {
    petroleo: { nombre: 'Petróleo', precio: 'energia', share: 0.14 },
    gas:      { nombre: 'Gas natural', precio: 'energia', share: 0.09 },
    mineria:  { nombre: 'Minería', precio: 'metales', share: 0.12 },
    agro:     { nombre: 'Agricultura fértil', precio: 'alimentos', share: 0.12 },
    pesca:    { nombre: 'Pesca', precio: 'alimentos', share: 0.05, costa: true },
    turismo:  { nombre: 'Turismo', precio: 'turismo', share: 0.08 },
    industria:{ nombre: 'Industria', precio: null, share: 0.14 },
  };
  const DESARROLLO = {
    bajo:  { nombre: 'Bajo', pibpc: 2800, salud: 42, educacion: 36, infra: 30, corr: 12, desig: 47, pesos: { campesinos: 0.34, clase_media: 0.16 } },
    medio: { nombre: 'Medio', pibpc: 9500, salud: 60, educacion: 56, infra: 50, corr: 4, desig: 44, pesos: {} },
    alto:  { nombre: 'Alto', pibpc: 32000, salud: 78, educacion: 74, infra: 72, corr: -8, desig: 33, pesos: { campesinos: 0.06, clase_media: 0.40 } },
  };
  const TAMANOS = { pequeno: { nombre: 'Pequeño', pob: 3.5 }, mediano: { nombre: 'Mediano', pob: 14 }, grande: { nombre: 'Grande', pob: 42 } };

  // ---------------- Leyes ----------------
  // pc: costo en capital político. apoyo: cuánto le gusta al Congreso (-15..+15).
  // efectos estáticos mientras está vigente (los lee el núcleo): fac, desemp, desig, corr, lib, gasto (% PIB), ingreso (% PIB), g, infl...
  const LEYES = {
    salario_minimo: { nombre: 'Salario mínimo alto', cat: 'Trabajo', pc: 5, apoyo: 0,
      desc: 'Sube el piso salarial un 25%.', fac: { sindicatos: 12, empresarios: -9, campesinos: 3 }, desemp: 1.0, desig: -2, choca: ['flexibilidad'] },
    flexibilidad: { nombre: 'Flexibilidad laboral', cat: 'Trabajo', pc: 6, apoyo: -4,
      desc: 'Despidos más baratos y contratos temporales.', fac: { empresarios: 10, sindicatos: -16 }, desemp: -1.2, desig: 2, g: 0.25, choca: ['salario_minimo'] },
    pensiones: { nombre: 'Pensión universal', cat: 'Social', pc: 6, apoyo: 6,
      desc: 'Pensión básica para todos los mayores.', fac: { sindicatos: 6, campesinos: 6, clase_media: 4 }, gasto: 1.6, desig: -3 },
    renta_basica: { nombre: 'Ingreso básico familiar', cat: 'Social', pc: 7, apoyo: 0,
      desc: 'Transferencia mensual a hogares pobres.', fac: { sindicatos: 5, campesinos: 8, empresarios: -4 }, gasto: 2.2, desig: -5 },
    vivienda: { nombre: 'Plan nacional de vivienda', cat: 'Social', pc: 4, apoyo: 8,
      desc: 'Viviendas sociales en todo el país.', fac: { clase_media: 3, sindicatos: 4, regiones: 2 }, gasto: 0.8, g: 0.2, desig: -1 },
    salud_universal: { nombre: 'Salud universal', cat: 'Social', pc: 7, apoyo: 4, req: { ministerio: 'salud' },
      desc: 'Cobertura médica pública para todos.', fac: { clase_media: 5, sindicatos: 5, campesinos: 5, empresarios: -3 }, gasto: 1.5, salud: 8 },
    educacion_gratuita: { nombre: 'Educación superior gratuita', cat: 'Social', pc: 6, apoyo: 4, req: { ministerio: 'educacion' },
      desc: 'Universidades públicas sin aranceles.', fac: { estudiantes: 16, clase_media: 4 }, gasto: 0.9, educacion: 6 },
    impuesto_fortunas: { nombre: 'Impuesto a las grandes fortunas', cat: 'Impuestos', pc: 6, apoyo: -2,
      desc: 'Grava patrimonios sobre 5 millones.', fac: { empresarios: -14, sindicatos: 6, estudiantes: 3 }, ingreso: 0.6, desig: -2, g: -0.15 },
    reforma_tributaria: { nombre: 'Reforma tributaria pro-inversión', cat: 'Impuestos', pc: 5, apoyo: -2,
      desc: 'Rebaja el impuesto corporativo y sube el IVA.', fac: { empresarios: 10, sindicatos: -6, clase_media: -3 }, g: 0.3, desig: 1.5 },
    zonas_francas: { nombre: 'Zonas económicas especiales', cat: 'Economía', pc: 4, apoyo: 4,
      desc: 'Puertos libres de impuestos para atraer fábricas.', fac: { empresarios: 6, regiones: 4 }, g: 0.35, ingreso: -0.2 },
    inversion_extranjera: { nombre: 'Ley de inversión extranjera', cat: 'Economía', pc: 4, apoyo: 2,
      desc: 'Garantías y estabilidad para capitales foráneos.', fac: { empresarios: 5, sindicatos: -3 }, g: 0.3, rel: { occ: 4 }, choca: ['nacionalizacion'] },
    proteccionismo: { nombre: 'Aranceles proteccionistas', cat: 'Economía', pc: 4, apoyo: 6,
      desc: 'Protege la industria nacional de la competencia.', fac: { sindicatos: 5, empresarios: -2, clase_media: -3 }, g: -0.3, ingreso: 0.3, infl: 0.8, comercio: -0.4 },
    privatizacion: { nombre: 'Privatización de empresas públicas', cat: 'Economía', pc: 7, apoyo: -4, unica: true,
      desc: 'Vende telefónica, aerolínea y eléctrica. Ingreso único.', fac: { empresarios: 12, sindicatos: -18, clase_media: -2 }, dinero: 4, g: 0.2, choca: ['nacionalizacion'] },
    nacionalizacion: { nombre: 'Nacionalización de los recursos', cat: 'Economía', pc: 8, apoyo: 2,
      desc: 'El Estado toma el control de minas e hidrocarburos.', fac: { empresarios: -20, sindicatos: 8, regiones: 4, estudiantes: 4 }, regalias: 12, g: -0.4, rel: { occ: -12 }, choca: ['privatizacion', 'inversion_extranjera'] },
    control_precios: { nombre: 'Control de precios', cat: 'Economía', pc: 4, apoyo: 6,
      desc: 'Congela precios de la canasta básica.', fac: { sindicatos: 4, clase_media: 3, empresarios: -12, campesinos: -6 }, infl: -3, g: -0.5, escasez: true },
    subsidio_combustible: { nombre: 'Subsidio a los combustibles', cat: 'Economía', pc: 3, apoyo: 10,
      desc: 'Bencina barata. El costo sube con el petróleo.', fac: { clase_media: 5, campesinos: 4, regiones: 3, estudiantes: -3 }, subsidioEnergia: 1.2 },
    subsidio_agricola: { nombre: 'Subsidios agrícolas', cat: 'Campo', pc: 4, apoyo: 6,
      desc: 'Créditos y precios garantizados al agricultor.', fac: { campesinos: 13, empresarios: -2 }, gasto: 0.6, sector: { agro: 0.15 } },
    reforma_agraria: { nombre: 'Reforma agraria', cat: 'Campo', pc: 9, apoyo: -6, unica: true,
      desc: 'Expropia latifundios y reparte la tierra.', fac: { campesinos: 20, empresarios: -14, regiones: -8, militares: -4 }, desig: -5, g: -0.3 },
    renovables: { nombre: 'Transición a energías renovables', cat: 'Ambiente', pc: 5, apoyo: 4, req: { ministerio: 'energia' },
      desc: 'Subsidia solar y eólica. Menos dependencia del petróleo.', fac: { estudiantes: 9, empresarios: -2, regiones: 2 }, gasto: 0.5, prest: 6, energia: -0.5 },
    proteccion_ambiental: { nombre: 'Ley de protección ambiental', cat: 'Ambiente', pc: 4, apoyo: 2,
      desc: 'Reservas naturales y evaluación ambiental estricta.', fac: { estudiantes: 8, empresarios: -6, campesinos: -2 }, g: -0.15, prest: 5, sector: { mineria: -0.1, petroleo: -0.08 } },
    transparencia: { nombre: 'Ley de transparencia', cat: 'Instituciones', pc: 5, apoyo: 2, req: { control: ['contraloria', 'fiscalia'] },
      desc: 'Toda compra pública en línea. Declaraciones de patrimonio.', fac: { clase_media: 6, estudiantes: 3 }, corr: -7 },
    servicio_militar: { nombre: 'Servicio militar obligatorio', cat: 'Defensa', pc: 4, apoyo: 0,
      desc: 'Un año en los cuarteles para todos los jóvenes.', fac: { militares: 8, estudiantes: -12, religiosos: 2 }, mil: 0.25, desemp: -0.5 },
    estado_emergencia: { nombre: 'Estado de emergencia', cat: 'Seguridad', pc: 3, apoyo: -8,
      desc: 'Suspende garantías. Militares en las calles.', fac: { militares: 6, estudiantes: -10, clase_media: -2 }, seg: 12, lib: -18, protestas: -20, legit: -4, temporal: 8 },
    ley_medios: { nombre: 'Ley de "responsabilidad" en medios', cat: 'Instituciones', pc: 5, apoyo: -6,
      desc: 'Multas y cierres a medios que "desinformen".', fac: { estudiantes: -8, clase_media: -5 }, lib: -10, escandalos: 0.5, prest: -6 },
    educacion_religiosa: { nombre: 'Educación religiosa en escuelas', cat: 'Valores', pc: 4, apoyo: 2,
      desc: 'Clases de religión obligatorias.', fac: { religiosos: 12, estudiantes: -8 }, choca: ['laicidad'] },
    laicidad: { nombre: 'Estado laico', cat: 'Valores', pc: 5, apoyo: 0,
      desc: 'Separa religión y Estado. Fin de privilegios.', fac: { religiosos: -14, estudiantes: 7, clase_media: 2 }, lib: 3, choca: ['educacion_religiosa'] },
    matrimonio_igualitario: { nombre: 'Matrimonio igualitario', cat: 'Valores', pc: 5, apoyo: 0,
      desc: 'Igualdad de derechos para todas las parejas.', fac: { estudiantes: 10, religiosos: -12, clase_media: 2 }, lib: 4, prest: 3 },
    amnistia: { nombre: 'Amnistía a presos políticos', cat: 'Instituciones', pc: 5, apoyo: 2, unica: true,
      desc: 'Libera a opositores y periodistas detenidos.', fac: { estudiantes: 10, militares: -6 }, lib: 6, legit: 5, prest: 6, protestas: -10 },
    plan_infraestructura: { nombre: 'Gran plan de infraestructura', cat: 'Economía', pc: 6, apoyo: 10,
      desc: 'Carreteras, puertos y trenes por 4 años.', fac: { empresarios: 5, regiones: 8, sindicatos: 4 }, gasto: 1.8, g: 0.5, infra: 6, temporal: 16 },
    ciberseguridad: { nombre: 'Agenda digital nacional', cat: 'Economía', pc: 4, apoyo: 8, req: { ministerio: 'ciencia' },
      desc: 'Fibra óptica, gobierno digital y startups.', fac: { estudiantes: 6, empresarios: 4 }, gasto: 0.3, g: 0.25, corr: -2 },
  };
  const ORDEN_LEYES = Object.keys(LEYES);

  // ---------------- Tratados ----------------
  const TRATADOS = {
    tlc:          { nombre: 'Tratado de libre comercio', corto: 'TLC', req: 15, pc: 4, desc: 'Más comercio y crecimiento. A los sindicatos o al campo puede no gustarles.' },
    inversion:    { nombre: 'Acuerdo de inversiones', corto: 'Inversión', req: 5, pc: 3, desc: 'Capitales del socio llegan al país.', minPot: 1 },
    cooperacion:  { nombre: 'Cooperación militar', corto: 'Coop. militar', req: 30, pc: 3, desc: 'Entrenamiento y equipos: más poder militar.' },
    alianza:      { nombre: 'Alianza defensiva', corto: 'Alianza', req: 50, pc: 6, desc: 'Si te atacan, el socio te defiende. Sus rivales te mirarán mal.' },
    no_agresion:  { nombre: 'Pacto de no agresión', corto: 'No agresión', req: -25, pc: 3, desc: 'Reduce mucho el riesgo de guerra.', soloVecino: true },
    limites:      { nombre: 'Acuerdo de límites', corto: 'Límites', req: 0, pc: 5, desc: 'Cierra la disputa fronteriza para siempre.', soloDisputa: true },
    ayuda:        { nombre: 'Programa de ayuda al desarrollo', corto: 'Ayuda', req: 25, pc: 3, desc: 'Fondos anuales a cambio de cercanía política.', minPot: 1, ricos: true },
  };

  // ---------------- Organizaciones ----------------
  // req: función (E, helpers) -> null si cumple, o texto con lo que falta.
  const ORGANIZACIONES = {
    UE:       { nombre: 'Unión Europea', cont: ['europa'], comercio: 1.0, demo: true, libMin: 65, corrMax: 40, deudaMax: 90, inflMax: 6, relCon: ['DEU', 'FRA'], relMin: 25, negocia: 8, desc: 'El mercado común más rico del mundo. Exige mucho.' },
    OTAN:     { nombre: 'OTAN', cont: ['europa', 'america_norte'], militar: true, demo: true, defMin: 2, relCon: ['USA'], relMin: 40, negocia: 4, desc: 'Alianza militar atlántica.', alinea: 'occ' },
    MERCOSUR: { nombre: 'Mercosur', cont: ['america_sur'], comercio: 0.6, demo: true, relCon: ['BRA', 'ARG'], relMin: 15, negocia: 4, desc: 'Mercado común sudamericano.' },
    CAN:      { nombre: 'Comunidad Andina', cont: ['america_sur'], subs: ['andina'], comercio: 0.35, negocia: 2, desc: 'Integración de los países andinos.' },
    OEA:      { nombre: 'Organización de Estados Americanos', cont: ['america_sur', 'america_norte'], comercio: 0, prest: 4, negocia: 1, desc: 'Foro político del hemisferio.' },
    CARICOM:  { nombre: 'CARICOM', cont: ['america_norte'], subs: ['caribe'], comercio: 0.35, negocia: 2, desc: 'Comunidad del Caribe.' },
    SICA:     { nombre: 'SICA', cont: ['america_norte'], subs: ['central'], comercio: 0.35, negocia: 2, desc: 'Integración centroamericana.' },
    UA:       { nombre: 'Unión Africana', cont: ['africa'], comercio: 0.1, prest: 4, noJunta: true, negocia: 1, desc: 'Suspende a los gobiernos golpistas.' },
    CEDEAO:   { nombre: 'CEDEAO', cont: ['africa'], subs: ['occidental'], comercio: 0.4, noJunta: true, negocia: 2, desc: 'Comunidad económica de África occidental.' },
    SADC:     { nombre: 'SADC', cont: ['africa'], subs: ['austral'], comercio: 0.4, negocia: 2, desc: 'Comunidad de desarrollo de África austral.' },
    EAC:      { nombre: 'Comunidad de África Oriental', cont: ['africa'], subs: ['oriental', 'central'], comercio: 0.4, negocia: 2, desc: 'Mercado común del este africano.' },
    LIGA:     { nombre: 'Liga Árabe', cont: ['asia', 'africa'], subs: ['medio_oriente', 'norte'], comercio: 0.15, prest: 3, negocia: 2, desc: 'Foro de los Estados árabes.' },
    CCG:      { nombre: 'Consejo de Cooperación del Golfo', cont: ['asia'], subs: ['medio_oriente'], comercio: 0.5, soloMonarquia: true, negocia: 4, desc: 'Club de las monarquías del Golfo.' },
    ASEAN:    { nombre: 'ASEAN', cont: ['asia'], subs: ['sudeste'], comercio: 0.6, negocia: 3, desc: 'Asociación de Naciones del Sudeste Asiático.' },
    OCS:      { nombre: 'Organización de Cooperación de Shanghái', cont: ['asia', 'europa'], subs: ['central', 'sur', 'este', 'medio_oriente', 'oriental'], militar: true, relCon: ['CHN', 'RUS'], relMin: 30, negocia: 3, desc: 'Bloque de seguridad liderado por China y Rusia.', alinea: 'eje' },
    UEE:      { nombre: 'Unión Económica Euroasiática', cont: ['asia', 'europa'], subs: ['central', 'oriental'], comercio: 0.4, relCon: ['RUS'], relMin: 40, negocia: 3, desc: 'Mercado común con Rusia.', alinea: 'eje' },
    APEC:     { nombre: 'APEC', cont: ['america_sur', 'america_norte', 'asia', 'oceania'], costa: true, comercio: 0.3, relCon: ['USA', 'CHN'], relMin: 0, negocia: 3, desc: 'Foro económico del Pacífico.' },
    BRICS:    { nombre: 'BRICS', cont: null, comercio: 0.3, pibMin: 120, relCon: ['CHN', 'IND', 'BRA'], relMin: 30, negocia: 6, desc: 'Las economías emergentes que desafían a Occidente.', alinea: 'eje' },
  };

  // ---------------- Nombres ----------------
  const NOMBRES = {
    pila: ['Ana', 'Lucía', 'Marta', 'Elena', 'Irene', 'Sofía', 'Valeria', 'Carmen', 'Rosa', 'Inés', 'Paula', 'Julia', 'Olga', 'Nadia', 'Amira', 'Leila', 'Mei', 'Yara', 'Zoe', 'Noor',
      'Tomás', 'Mateo', 'Andrés', 'Diego', 'Pablo', 'Iván', 'Óscar', 'Raúl', 'Samuel', 'Víctor', 'Jorge', 'Hugo', 'Elías', 'Omar', 'Karim', 'Luka', 'Kenji', 'Adrián', 'Rafael', 'Joaquín'],
    apellido: ['Arriaga', 'Belmonte', 'Cifuentes', 'Durán', 'Echeverri', 'Fonseca', 'Garrido', 'Herrera', 'Ibarra', 'Jaramillo', 'Kovač', 'Lindqvist', 'Montero', 'Navarro', 'Ortúzar',
      'Pizarro', 'Quintana', 'Rivas', 'Salinas', 'Tellería', 'Urrutia', 'Valdés', 'Weber', 'Yáñez', 'Zamora', 'Abiodun', 'Benali', 'Castellanos', 'Delacroix', 'Estévez', 'Farías',
      'Haddad', 'Ilunga', 'Mendoza', 'Nakamura', 'Okafor', 'Petrov', 'Rahman', 'Sandoval', 'Toledo', 'Vargas', 'Wójcik', 'Aguirre', 'Bravo', 'Ceballos', 'Lagos', 'Moreira', 'Silva'],
  };
  const PAIS_SILABAS = {
    ini: ['Val', 'Mar', 'Cor', 'Ast', 'Bel', 'Tar', 'Lu', 'Ser', 'Al', 'Ny', 'Kar', 'Os', 'Ve', 'Da', 'Is', 'Mo', 'Ru', 'Pa', 'Zan', 'Eri', 'Tir', 'Gal', 'Sol', 'Nor'],
    med: ['da', 'ra', 've', 'li', 'na', 'ta', 'mo', 'rí', 'sa', 'lo', 'ne', 'ga', 'ce', 'du', ''],
    fin: ['nia', 'ria', 'via', 'land', 'stán', 'ria', 'mar', 'dor', 'ena', 'onia', 'ura', 'bia', 'ica', 'esia'],
  };
  const CAPITALES = ['Puerto Alba', 'San Telmo', 'Nueva Esperanza', 'Valcárcel', 'Ciudad Libertad', 'Altamira', 'Monteverde', 'Villa Real', 'Port Ostra', 'Aurora', 'Belmira', 'Santa Inés', 'Kaldera', 'Lumen', 'Rocaverde', 'Marisol'];

  return { CONTINENTES, TIPOS, ORDEN_TIPOS, FACCIONES, ORDEN_FAC, INSTITUCIONES, ORDEN_INST, MINISTERIOS, ORDEN_MIN, COSTO_MIN, MAX_MIN_SIN_BUROCRACIA,
    AREAS, ORDEN_AREAS, RECURSOS, DESARROLLO, TAMANOS, LEYES, ORDEN_LEYES, TRATADOS, ORGANIZACIONES, NOMBRES, PAIS_SILABAS, CAPITALES };
})();
if (typeof module !== 'undefined') module.exports = REGLAS;
