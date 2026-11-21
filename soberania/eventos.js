// SOBERANÍA — mazo de eventos (decisiones del despacho) y sucesos globales.
// Cada evento: { id, cat, titulo, texto, peso(E,H), ctx(E,H), op:[{ t, ef, req }] }.
// ef es un objeto declarativo (lo aplica NUCLEO.aplicar) o una función (E, c, H) que lo devuelve.
// critico: lo dispara el núcleo (golpes, elecciones…); manual: lo dispara un suceso global.
var EVENTOS_SOB = (function () {
  const pct = x => Math.round(x * 100);
  const f1 = x => (Math.round(x * 10) / 10).toLocaleString('es-ES');
  const deudaPIB = E => E.eco.deuda / E.eco.pib * 100;
  const tieneRec = (E, r) => !!E.eco.sec[r];
  const sat = (E, f) => E.pol.fac[f].sat;
  const N = (H, iso) => H.nom(iso);
  const vecinoAl = (E, H, filtro) => { const l = H.vecinos().filter(v => !filtro || filtro(H.est(v), v)); return l.length ? H.pick(l) : null; };
  const autocracia = H => !H.demo;

  const EVENTOS = [
    // =============== CRÍTICOS (los dispara el núcleo) ===============
    { id: 'conspiracion', cat: 'crisis', critico: true, titulo: 'Informe reservado: conspiración',
      texto: (E, c, H) => `La inteligencia intercepta reuniones entre generales. Preparan un golpe contra ${H.lider}. Los militares están ${sat(E, 'militares') < 30 ? 'furiosos' : 'inquietos'}.`,
      op: [
        { t: 'Purgar el alto mando', ef: { fac: { militares: -8 }, mil: -8, purga: true, est: -3, texto: 'Pasan a retiro catorce generales.' } },
        { t: 'Comprar lealtades con ascensos y bonos', ef: { dinero: -0.5, fac: { militares: 18 }, corr: 2 } },
        { t: 'Ignorar el informe', ef: { prob: { p: 0.45, si: {}, no: { cola: { id: 'golpe', en: 1 } }, ts: 'Era humo: nada ocurrió.', tn: 'Los conspiradores siguen adelante…' } } },
      ] },
    { id: 'golpe', cat: 'crisis', critico: true, titulo: '¡Golpe de Estado!',
      texto: (E, c, H) => `Madrugada en ${H.cap}. Tanques rodean el palacio de gobierno y la radio transmite marchas militares. Un comunicado anuncia que las Fuerzas Armadas "asumen la conducción de la nación".`,
      op: [
        { t: 'Resistir y llamar al pueblo a las calles', ef: (E, c, H) => {
          const desl = Object.values(E.gob.min).filter(m => m && m.leal <= 2).length;
          const p = H.clamp(0.3 + (E.pol.legit - 50) * 0.008 + (E.pol.aprob - 50) * 0.006 + (E.gob.inst.fuerzas === 'milicia' ? 0.2 : 0) + (sat(E, 'militares') - 30) * 0.004 - desl * 0.04, 0.08, 0.9);
          return { prob: { p, si: { leg: 10, fac: { militares: -5 }, purga: true, prest: 4, mil: -10, todos: 3 }, no: { fin: { tipo: 'golpe', titulo: 'Derrocado', texto: 'Los militares toman el palacio. Tu gobierno termina con un golpe de Estado.' } }, ts: 'La multitud llena las plazas y una parte del Ejército se niega a disparar. El golpe fracasa.', tn: '' } };
        } },
        { t: 'Negociar con los golpistas', ef: (E, c, H) => {
          const p = H.clamp(0.5 + (sat(E, 'militares') - 30) * 0.006, 0.15, 0.85);
          return { prob: { p, si: { fac: { militares: 18 }, inst: { fuerzas: 'fuero' }, lib: -10, leg: -12, gastoArea: { defensa: 1 } }, no: { fin: { tipo: 'golpe', titulo: 'Derrocado', texto: 'Las conversaciones eran una trampa. Te detienen en tu propio despacho.' } }, ts: 'Conservas el cargo, pero los cuarteles mandan más que nunca.', tn: '' } };
        } },
        { t: 'Huir al exilio', ef: { fin: { tipo: 'exilio', titulo: 'Exilio', texto: 'Un avión te espera en la pista. Gobernarás tus memorias desde el extranjero.' } } },
      ] },
    { id: 'estallido', cat: 'crisis', critico: true,
      titulo: (E, c, H) => (H.demo ? 'Estallido social' : 'Levantamiento popular'),
      texto: (E, c, H) => `Las protestas desbordan ${H.cap}: barricadas, saqueos y cientos de miles en las calles exigen la caída del gobierno. ${H.demo ? 'La oposición pide tu renuncia.' : 'Hay soldados que se niegan a disparar.'}`,
      op: [
        { t: 'Concesiones: gabinete nuevo y paquete social', req: E => E.pol.pc >= 5 || 'Necesitas 5 de capital político', ef: (E, c, H) => ({ dinero: -1.2, pc: -5, prob: { p: H.clamp(0.55 + (E.pol.legit - 30) * 0.01 + (H.demo ? 0.2 : 0), 0.3, 0.95), si: { todos: 7, prot: -25, est: 4 }, no: { fin: { tipo: 'revolucion', titulo: H.demo ? 'Renuncia forzada' : 'Revolución', texto: 'Las concesiones llegan tarde: la calle ya no negocia.' } }, ts: 'Las concesiones calman las calles.', tn: '' } }) },
        { t: 'Estado de emergencia y toque de queda', ef: (E, c, H) => {
          const s = NUCLEO_REF().estaticos(E);
          const p = H.clamp(0.35 + s.represion / 100 + (sat(E, 'militares') - 50) * 0.01 + (H.demo ? -0.1 : 0), 0.1, 0.9);
          return { prob: { p, si: { ley: 'estado_emergencia', prot: -30, lib: -10, prest: -6, fac: { estudiantes: -10 } }, no: { fin: { tipo: 'revolucion', titulo: H.demo ? 'Renuncia forzada' : 'Revolución', texto: H.demo ? 'Las Fuerzas Armadas te retiran su apoyo. Renuncias por televisión y el Congreso nombra un sucesor.' : 'La multitud asalta el palacio. Huyes por los techos; el régimen cae.' } }, ts: 'Las calles se vacían bajo el toque de queda.', tn: '' } };
        } },
        { t: 'Renunciar para pacificar el país', ef: { fin: { tipo: 'renuncia', titulo: 'Renuncia', texto: 'Anuncias tu renuncia para evitar más violencia. El país respira, pero tu proyecto termina aquí.' } } },
      ] },
    { id: 'juicio_politico', cat: 'crisis', critico: true, titulo: 'Juicio político',
      texto: (E, c, H) => `La oposición logra iniciar un juicio político en tu contra por "notable abandono de deberes". Tienes ${Math.round(E.pol.escanos)}% de los escaños y ${Math.round(E.pol.aprob)}% de aprobación.`,
      op: [
        { t: 'Negociar votos uno a uno', req: E => E.pol.pc >= 6 || 'Necesitas 6 de capital político', ef: (E, c, H) => { const p = H.clamp((E.pol.escanos - 28) / 30 + (E.pol.aprob - 20) * 0.01 + 0.2, 0.1, 0.95); return { pc: -6, corr: 3, prob: { p, si: { leg: -3 }, no: { fin: { tipo: 'destitucion', titulo: 'Destituido', texto: 'El Senado aprueba la destitución. Abandonas el palacio por la puerta de atrás.' } }, ts: 'El juicio no alcanza los votos. Sobrevives, herido.', tn: '' } }; } },
        { t: 'Defenderte ante el Senado', ef: (E, c, H) => { const p = H.clamp((E.pol.escanos - 28) / 30 + (E.pol.aprob - 20) * 0.01, 0.1, 0.9); return { prob: { p, si: { leg: 2, todos: 2 }, no: { fin: { tipo: 'destitucion', titulo: 'Destituido', texto: 'El Senado aprueba la destitución.' } }, ts: 'Tu defensa convence a los indecisos.', tn: '' } }; } },
        { t: 'Renunciar antes de la votación', ef: { fin: { tipo: 'renuncia', titulo: 'Renuncia', texto: 'Renuncias para ahorrarle al país el espectáculo.' } } },
      ] },
    { id: 'mocion_censura', cat: 'crisis', critico: true, titulo: 'Moción de censura',
      texto: (E, c, H) => `La oposición presenta una moción de censura. Tu coalición controla ${Math.round(E.pol.escanos)}% del Parlamento y la aprobación es de ${Math.round(E.pol.aprob)}%.`,
      op: [
        { t: 'Ofrecer ministerios a un partido bisagra', req: E => E.pol.pc >= 5 || 'Necesitas 5 de capital político', ef: (E, c, H) => { const p = H.clamp((E.pol.escanos - 38) / 15 + (E.pol.aprob - 25) * 0.01 + 0.2, 0.1, 0.95); return { pc: -5, escanos: 4, prob: { p, si: {}, no: { fin: { tipo: 'censura', titulo: 'Censurado', texto: 'La moción prospera. Un nuevo gobierno jura mañana.' } }, ts: 'La bisagra vota contigo. La moción fracasa.', tn: '' } }; } },
        { t: 'Ir a la votación', ef: (E, c, H) => { const p = H.clamp((E.pol.escanos - 38) / 15 + (E.pol.aprob - 25) * 0.01, 0.1, 0.9); return { prob: { p, si: { leg: 2 }, no: { fin: { tipo: 'censura', titulo: 'Censurado', texto: 'La moción prospera. Un nuevo gobierno jura mañana.' } }, ts: 'La moción fracasa por pocos votos.', tn: '' } }; } },
        { t: 'Disolver el Parlamento y convocar elecciones', ef: { adelantar: true, leg: -2 } },
      ] },
    { id: 'elecciones', cat: 'politica', critico: true, titulo: 'Elecciones generales',
      texto: (E, c, H) => { const p = NUCLEO_REF().pronostico(E); const presid = H.tipo === 'presidencial' || H.tipo === 'federal'; return `Llega el día de votar. Las encuestas dan a tu proyecto ${f1(p)}% de los votos. ${presid ? 'Necesitas más del 50% en segunda vuelta.' : 'Necesitas al menos 42% de los escaños para formar gobierno, con o sin coalición.'} ¿Cómo encaras la campaña?`; },
      op: [
        { t: 'Campaña sobria: que hablen los resultados', ef: { eleccion: 0 } },
        { t: 'Campaña millonaria en medios y redes', ef: { dinero: -0.3, corr: 1, eleccion: 2.5 } },
        { t: 'Promesas populistas', ef: { eleccion: 3.5, mod: { nombre: 'Promesas de campaña', t: 8, ef: { gasto: 0.9 } } } },
        { t: 'Campaña sucia contra el rival', ef: { prob: { p: 0.65, si: { eleccion: 3 }, no: { eleccion: -3, leg: -6 }, ts: 'La campaña de desprestigio funciona.', tn: 'Se descubre la operación sucia.' } } },
        { t: 'Postergar las elecciones "por la situación"', ef: { postergar: 4, leg: -18, prest: -10, rel: { occ: -15 }, fac: { estudiantes: -14, clase_media: -10 }, prot: 20 } },
      ] },
    { id: 'congreso_partido', cat: 'politica', critico: true, titulo: 'Congreso del Partido',
      texto: (E, c, H) => `Se reúne el Congreso del Partido. Dos mil delegados evaluarán tu gestión a puertas cerradas. Hay una facción que quiere tu cabeza.`,
      op: [
        { t: 'Reafirmar la línea oficial', ef: (E, c, H) => { const p = H.clamp(0.8 + (E.pol.legit - 40) * 0.008 + (E.pol.aprob - 45) * 0.004 + (sat(E, 'militares') - 50) * 0.003, 0.15, 0.96); return { prob: { p, si: { leg: 5, pc: 5 }, no: { fin: { tipo: 'purga', titulo: 'Destituido por el Partido', texto: 'El Comité Central vota tu relevo "por razones de salud".' } }, ts: 'Te reeligen por aclamación.', tn: '' } }; } },
        { t: 'Purgar a la facción rival', req: E => E.pol.pc >= 5 || 'Necesitas 5 de capital político', ef: (E, c, H) => { const p = H.clamp(0.8 + (E.pol.legit - 45) * 0.01, 0.2, 0.97); return { pc: -5, lib: -6, prob: { p, si: { leg: 3, pc: 8, fac: { militares: -3 } }, no: { fin: { tipo: 'purga', titulo: 'Destituido por el Partido', texto: 'La purga se vuelve contra ti.' } }, ts: 'Los rivales desaparecen de las fotos oficiales.', tn: '' } }; } },
        { t: 'Anunciar una apertura económica', ef: (E, c, H) => { const p = H.clamp(0.68 + (E.pol.legit - 45) * 0.01 + (E.eco.crec - 2) * 0.03, 0.15, 0.95); return { fac: { empresarios: 10, sindicatos: -6 }, prob: { p, si: { ley: 'inversion_extranjera', leg: 3 }, no: { fin: { tipo: 'purga', titulo: 'Destituido por el Partido', texto: 'Los ortodoxos te acusan de revisionismo.' } }, ts: 'El Congreso aprueba la "nueva etapa".', tn: '' } }; } },
      ] },
    { id: 'crisis_deuda', cat: 'crisis', critico: true, titulo: 'Crisis de deuda',
      texto: (E, c, H) => `Hacienda no logra colocar bonos: los mercados están cerrados (riesgo país ${f1(E.eco.riesgo)} pts, deuda ${Math.round(deudaPIB(E))}% del PIB). ${E.eco.atrasos > 0 ? 'Ya hay sueldos públicos impagos.' : 'Sin financiamiento, pronto no alcanzará para sueldos.'}`,
      op: [
        { t: 'Pedir un rescate al FMI', req: (E, c, H) => H.est('USA').rel >= -30 || 'Washington bloquea la solicitud', ef: { liquidez: 5, riesgo: -2.5, rel: { occ: 6 }, alin: 6, mod: { nombre: 'Programa de ajuste del FMI', t: 8, ef: { gasto: -2.2, fac: { sindicatos: -12, clase_media: -4, empresarios: 4 }, riesgo: -1.5 } } } },
        { t: 'Declarar la cesación de pagos', req: E => deudaPIB(E) >= 55 || 'La deuda no lo justifica', ef: { impago: true, riesgo: 7, choque: { g: -4, t: 4 }, rel: { occ: -18 }, fac: { empresarios: -15, clase_media: -8, sindicatos: 4 }, prest: -10 } },
        { t: 'Recorte brutal del gasto', ef: { mod: { nombre: 'Recorte de emergencia', t: 6, ef: { gasto: -4, fac: { sindicatos: -10, clase_media: -6, estudiantes: -6 } } }, prot: 15, riesgo: -1.5 } },
        { t: 'Imprimir dinero', req: E => E.gob.inst.banco === 'dependiente' || 'El Banco Central es autónomo', ef: { emision: 8, dinero: 3 } },
      ] },
    { id: 'invasion', cat: 'crisis', critico: true, titulo: (E, c, H) => `¡${N(H, c.v)} nos invade!`,
      texto: (E, c, H) => `Columnas blindadas de ${N(H, c.v)} cruzan la frontera hacia las tierras en disputa. Su ejército ${H.milDe(c.v) > H.mil() ? 'es más poderoso que el nuestro' : 'no es superior al nuestro'}.`,
      op: [
        { t: 'Resistir: movilización general', ef: { guerra: true } },
        { t: 'Pedir mediación urgente a la ONU', ef: (E, c, H) => ({ prob: { p: H.clamp(0.3 + E.soc.prestigio / 200, 0.2, 0.75), si: { rel: { v: 5 }, prest: 2 }, no: { guerra: true }, ts: 'La ONU logra un alto el fuego antes de que empiece la guerra.', tn: 'La mediación fracasa: hay guerra.' } }) },
        { t: 'Ceder el territorio en disputa', ef: { disputa: false, pib: -2.5, fac: { militares: -15, regiones: -12 }, todos: -5, leg: -10, rel: { v: 10 } } },
      ] },
    { id: 'armisticio', cat: 'crisis', critico: true, titulo: 'Propuesta de armisticio',
      texto: (E, c, H) => `Tras meses de combates, ${N(H, c.v)} propone un alto el fuego en las líneas actuales.`,
      op: [{ t: 'Aceptar el armisticio', ef: { paz: true } }, { t: 'Seguir luchando hasta la victoria', ef: { fac: { militares: 3 }, todos: -1 } }] },

    // =============== ECONOMÍA ===============
    { id: 'huelga_general', cat: 'economia', titulo: 'Huelga general',
      peso: E => (sat(E, 'sindicatos') < 40 ? 3 : 0.25), texto: 'Las centrales sindicales paralizan el país: puertos, minas y transporte se detienen. Exigen aumentos salariales.',
      op: [
        { t: 'Negociar un reajuste salarial', ef: { dinero: -0.4, fac: { sindicatos: 12, empresarios: -4 }, infl: 0.6 } },
        { t: 'Resistir y descontar los días', ef: { choque: { g: -1.5, t: 1 }, fac: { sindicatos: -8 }, prot: 10 } },
        { t: 'Declararla ilegal y detener a los dirigentes', req: (E, c, H) => autocracia(H) || H.ley('estado_emergencia') || 'Solo en un régimen autoritario o bajo estado de emergencia', ef: { fac: { sindicatos: -14, militares: 3, empresarios: 3 }, lib: -6, prot: -6, prest: -4 } },
      ] },
    { id: 'inversion_potencia', cat: 'economia', titulo: (E, c, H) => `${N(H, c.x)} ofrece construir un megapuerto`,
      peso: E => 0.8, ctx: (E, H) => ({ x: H.est('CHN').rel > H.est('USA').rel - 10 ? 'CHN' : H.pick(['USA', 'JPN', 'DEU']) }),
      texto: (E, c, H) => `Un consorcio respaldado por ${N(H, c.x)} propone financiar y construir un puerto de aguas profundas, una autopista y un parque logístico. Lo pagarías en 25 años.`,
      op: [
        { t: 'Aceptar el proyecto completo', ef: (E, c) => ({ infra: 4, deuda: 1.5, choque: { g: 0.8, t: 8 }, rel: { x: 10, [c.x === 'CHN' ? 'USA' : 'CHN']: -6 }, alin: c.x === 'CHN' ? -8 : 6, fac: { regiones: 5, empresarios: 3 } }) },
        { t: 'Licitarlo abiertamente', ef: { pc: -2, infra: 2, choque: { g: 0.4, t: 6 }, deuda: 1, rel: { x: -2 } } },
        { t: 'Rechazar con cortesía', ef: { rel: { x: -6 } } },
      ] },
    { id: 'yacimiento', cat: 'economia', titulo: (E, c) => `Descubrimiento de ${c.n}`, unico: true,
      peso: E => 0.35, ctx: (E, H) => { const r = H.pick(['petroleo', 'gas', 'mineria']); return { r, n: { petroleo: 'un gran yacimiento de petróleo', gas: 'una enorme reserva de gas', mineria: 'un yacimiento de litio y cobre' }[r] }; },
      texto: (E, c, H) => `Geólogos confirman ${c.n} en el interior del país. Puede cambiar la economía nacional por décadas… o traer la "maldición de los recursos".`,
      op: [
        { t: 'Explotarlo con una empresa estatal', ef: (E, c) => ({ sector: { [c.r]: 0.05 }, fac: { regiones: 5, sindicatos: 4, empresarios: -3 }, dinero: -0.8, todos: 2 }) },
        { t: 'Licitarlo a multinacionales', ef: (E, c) => ({ sector: { [c.r]: 0.06 }, dinero: 1.5, rel: { occ: 4 }, fac: { empresarios: 6, sindicatos: -4, estudiantes: -3 }, corr: 2 }) },
        { t: 'Declararlo reserva natural', ef: { prest: 5, fac: { estudiantes: 8, regiones: -6, empresarios: -4 } } },
      ] },
    { id: 'burbuja', cat: 'economia', titulo: 'Burbuja inmobiliaria',
      peso: E => (E.eco.crec > 4 ? 1.5 : 0), texto: 'Los precios de la vivienda subieron 40% en dos años. Los bancos prestan sin mirar. El Banco Central advierte de una burbuja.',
      op: [
        { t: 'Endurecer el crédito ahora', ef: { choque: { g: -1, t: 3 }, infl: -0.5, fac: { empresarios: -4, clase_media: -2 } } },
        { t: 'Dejar correr la fiesta', ef: { prob: { p: 0.45, si: { choque: { g: 0.5, t: 2 } }, no: { choque: { g: -4, t: 4 }, fac: { clase_media: -8 } }, ts: 'El aterrizaje es suave.', tn: 'La burbuja estalla: miles de familias quedan endeudadas.' } } },
      ] },
    { id: 'quiebra_banco', cat: 'economia', titulo: 'Quiebra un banco grande',
      peso: E => 0.3 + (E.soc.corr > 55 ? 0.5 : 0) + (E.eco.crec < 0 ? 0.6 : 0), ctx: (E, H) => ({ n: H.pick(['Banco del Progreso', 'Banco Andino de Fomento', 'Banco Mercantil del Sur', 'Banco Nacional de Ahorro']) }),
      texto: (E, c) => `El ${c.n}, con un millón de ahorristas, no puede devolver depósitos. Hay filas frente a las sucursales.`,
      op: [
        { t: 'Rescatarlo con dinero público', ef: { dinero: -2.5, fac: { empresarios: 5, clase_media: -4, sindicatos: -4 }, est: 3 } },
        { t: 'Dejarlo caer', ef: { choque: { g: -2.5, t: 3 }, fac: { clase_media: -9 }, prot: 8 } },
        { t: 'Nacionalizarlo', ef: { dinero: -1.2, fac: { empresarios: -8, sindicatos: 4 }, est: 1 } },
      ] },
    { id: 'alza_combustibles', cat: 'economia', titulo: 'Furia por el precio de la bencina',
      peso: (E, H) => (E.mundo.precios.energia > 1.25 && !H.ley('subsidio_combustible') ? 2.5 : 0), texto: 'El petróleo mundial está por las nubes. Camioneros y taxistas bloquean las carreteras contra el alza de los combustibles.',
      op: [
        { t: 'Subsidiar los combustibles', ef: { ley: 'subsidio_combustible', fac: { clase_media: 3, campesinos: 3 } } },
        { t: 'Bono temporal al transporte', ef: { dinero: -0.3, todos: 2, prot: -4 } },
        { t: 'Mantener los precios de mercado', ef: { prot: 12, fac: { clase_media: -6, campesinos: -5, regiones: -4 } } },
      ] },
    { id: 'sequia', cat: 'economia', titulo: 'Sequía histórica',
      peso: (E, H) => (tieneRec(E, 'agro') ? 0.9 : 0.4), texto: 'El peor año sin lluvias en medio siglo. Se pierden cosechas y el ganado muere en los campos.',
      op: [
        { t: 'Ayuda de emergencia al campo', ef: { dinero: -0.4, fac: { campesinos: 10 }, choque: { g: -0.6, t: 2 } } },
        { t: 'Importar alimentos para contener precios', ef: { dinero: -0.2, infl: 0.8, fac: { campesinos: -4 }, choque: { g: -0.8, t: 2 } } },
        { t: 'Que el mercado se ajuste', ef: { fac: { campesinos: -12 }, infl: 1.5, prot: 6, choque: { g: -1, t: 2 } } },
      ] },
    { id: 'unicornio', cat: 'economia', titulo: 'Nace un unicornio tecnológico',
      peso: E => (E.soc.educacion > 55 ? 0.7 : 0.1), ctx: (E, H) => ({ n: H.pick(['Pagalo', 'Nubra', 'Kiwo', 'Andes AI', 'Tukan', 'Rutas']) }),
      texto: (E, c) => `${c.n}, una startup fundada por tres universitarios, vale mil millones de dólares. Quieren mudarse a un país con mejores incentivos.`,
      op: [
        { t: 'Régimen especial para startups', ef: { mod: { nombre: 'Ley de startups', t: 16, ef: { g: 0.3, ingreso: -0.1 } }, fac: { estudiantes: 5, empresarios: 4 } } },
        { t: 'Que paguen impuestos como todos', ef: { dinero: 0.1, prob: { p: 0.5, si: {}, no: { fac: { estudiantes: -4 } }, ts: 'Se quedan igual.', tn: 'Se mudan al extranjero.' } } },
      ] },
    { id: 'resort', cat: 'economia', titulo: 'Megaproyecto turístico en la costa',
      peso: E => (E.pais.costa ? 0.7 : 0), texto: 'Una cadena hotelera internacional quiere levantar diez resorts en la costa virgen. Promete veinte mil empleos.',
      op: [
        { t: 'Aprobarlo', ef: { sector: { turismo: 0.03 }, choque: { g: 0.5, t: 6 }, fac: { empresarios: 5, regiones: 4, estudiantes: -5 }, prest: -1 } },
        { t: 'Aprobarlo con estándares ambientales', ef: { pc: -2, sector: { turismo: 0.02 }, choque: { g: 0.3, t: 6 }, fac: { regiones: 3 } } },
        { t: 'Rechazarlo', ef: { fac: { estudiantes: 4, regiones: -4, empresarios: -3 } } },
      ] },
    { id: 'calificadora', cat: 'economia', titulo: 'Te bajan la calificación',
      peso: E => (deudaPIB(E) > 60 || E.eco.deficit > 5 ? 1.6 : 0), texto: (E) => `Una agencia calificadora rebaja tu deuda por "deterioro fiscal" (déficit de ${f1(E.eco.deficit)}% del PIB). Los intereses suben.`,
      op: [
        { t: 'Anunciar un plan de austeridad', ef: { mod: { nombre: 'Plan de austeridad', t: 8, ef: { gasto: -1.5, fac: { sindicatos: -6, clase_media: -2 }, riesgo: -0.8 } }, fac: { empresarios: 4 } } },
        { t: 'Ignorarla', ef: { riesgo: 1.5 } },
        { t: 'Acusarla de "terrorismo financiero"', ef: { riesgo: 2.2, todos: 2, rel: { USA: -3 } } },
      ] },
    { id: 'hiperinflacion', cat: 'crisis', titulo: 'Hiperinflación',
      peso: E => (E.eco.infl > 35 ? 4 : 0), enfriar: 6, texto: (E) => `Los precios suben ${Math.round(E.eco.infl)}% al año. La gente cobra el sueldo y corre al supermercado. El dinero quema en las manos.`,
      op: [
        { t: 'Nueva moneda y Banco Central autónomo', ef: { inst: { banco: 'autonomo' }, inflMult: 0.35, choque: { g: -3, t: 3 }, fac: { empresarios: 6, sindicatos: -6 }, pc: -4 } },
        { t: 'Control de precios', ef: { ley: 'control_precios' } },
        { t: 'Aguantar: es transitorio', ef: { todos: -3 } },
      ] },
    { id: 'fuga_capitales', cat: 'economia', titulo: 'Fuga de capitales',
      peso: (E, H) => (H.ley('nacionalizacion') || E.pol.est < 35 ? 1.4 : 0), texto: 'Los grandes capitales sacan su dinero del país. El dólar se dispara.',
      op: [
        { t: 'Control de capitales', ef: { mod: { nombre: 'Control de capitales', t: 10, ef: { g: -0.3, infl: 1, fac: { empresarios: -6, clase_media: -3 } } } } },
        { t: 'Subir las tasas para retenerlos', ef: { choque: { g: -1.5, t: 3 }, infl: -1 } },
        { t: 'Dejar que el dólar suba', ef: { infl: 3, choque: { g: -0.5, t: 2 } } },
      ] },
    { id: 'empresa_cierra', cat: 'economia', titulo: 'Cierra la mayor fábrica del país',
      peso: E => (E.eco.crec < 1.5 ? 1 : 0.2), texto: 'Una automotriz extranjera anuncia que cierra su planta: seis mil despidos directos.',
      op: [
        { t: 'Subsidios para que se quede', ef: { dinero: -0.4, fac: { sindicatos: 6, empresarios: 2 } } },
        { t: 'Expropiar la planta y que la gestionen los trabajadores', ef: { dinero: -0.2, fac: { sindicatos: 10, empresarios: -10 }, rel: { occ: -5 } } },
        { t: 'Programa de recapacitación', ef: { dinero: -0.15, fac: { sindicatos: -3 }, choque: { g: -0.3, t: 2 } } },
      ] },

    // =============== POLÍTICA ===============
    { id: 'escandalo', cat: 'politica', titulo: (E, c, H) => `Escándalo en ${H.MIN[c.min].nombre}`,
      peso: (E, H) => { const m = H.corrupto(); return m ? 1.5 * NUCLEO_REF().estaticos(E).escandalos : 0; }, ctx: (E, H) => { const m = H.corrupto(); return m ? { min: m, n: E.gob.min[m].nombre } : null; }, enfriar: 5,
      texto: (E, c) => `${E.gob.inst.prensa === 'libre' ? 'Un diario revela' : 'Se filtra en redes'} que ${c.n} desvió fondos públicos a empresas de su familia.`,
      op: [
        { t: (E, c) => `Destituir a ${c.n}`, ef: (E, c) => { const m = E.gob.min[c.min]; return { destituir: true, todos: 2, corr: -2, fac: m && m.fac ? { [m.fac]: -5 } : {} }; } },
        { t: 'Defenderlo públicamente', ef: { todos: -4, corr: 2, leg: -3, est: -2 } },
        { t: 'Abrir una investigación independiente', ef: { pc: -2, prob: { p: 0.4, si: { todos: 1 }, no: { destituir: true, todos: 1, corr: -2 }, ts: 'La investigación lo absuelve.', tn: 'La investigación lo condena: queda fuera del gabinete.' } } },
      ] },
    { id: 'renuncia_ministro', cat: 'politica', titulo: 'Portazo en el gabinete',
      peso: (E, H) => (H.desleal() && E.pol.aprob < 45 ? 1.2 : 0), ctx: (E, H) => { const m = H.desleal(); return m ? { min: m, n: E.gob.min[m].nombre } : null; },
      texto: (E, c, H) => `${c.n}, ministro/a de ${H.MIN[c.min].nombre}, renuncia y critica duramente al gobierno en una entrevista. Dicen que prepara su propio partido.`,
      op: [
        { t: 'Aceptar la renuncia en silencio', ef: { destituir: true, todos: -2 } },
        { t: 'Contraatacar en los medios', ef: { destituir: true, todos: -1, escanos: -2, prob: { p: 0.5, si: { todos: 2 }, no: { todos: -3 }, ts: 'Ganas la guerra de declaraciones.', tn: 'El portazo te sale caro.' } } },
      ] },
    { id: 'lider_opositor', cat: 'politica', titulo: 'Surge un líder opositor',
      peso: E => (E.pol.aprob < 50 ? 1 : 0.3), ctx: (E, H) => ({ n: H.persona() }),
      texto: (E, c, H) => `${c.n}, ${H.pick(['un exalcalde carismático', 'una economista televisiva', 'un pastor evangélico', 'una líder estudiantil', 'un empresario millonario'])}, llena estadios con discursos contra tu gobierno.`,
      op: [
        { t: 'Ignorarlo', ef: (E, c, H) => (H.demo ? { escanos: -3, todos: -1 } : { prot: 5 }) },
        { t: 'Desafiarlo a un debate televisado', ef: (E) => ({ prob: { p: Math.max(0.15, Math.min(0.85, E.pol.aprob / 90)), si: { todos: 4, escanos: 2 }, no: { todos: -4, escanos: -3 }, ts: 'Lo dejas sin argumentos.', tn: 'Te arrasa en el debate.' } }) },
        { t: 'Investigar sus finanzas… o detenerlo', ef: (E, c, H) => (H.demo ? { leg: -5, lib: -4, prob: { p: 0.4, si: { escanos: 2 }, no: { todos: -3 }, ts: 'Aparecen cuentas en paraísos fiscales.', tn: 'No encuentran nada y queda como mártir.' } } : { lib: -8, prest: -5, fac: { estudiantes: -8 }, prot: 8, leg: -3 }) },
      ] },
    { id: 'filtracion', cat: 'politica', titulo: 'Audios filtrados',
      peso: E => (E.gob.inst.prensa === 'libre' ? 0.8 : 0.2), texto: (E, c, H) => `Se filtran audios de una reunión de gabinete donde ${H.lider} se burla de ${H.pick(['los jubilados', 'los agricultores', 'la oposición', 'los estudiantes'])}.`,
      op: [
        { t: 'Pedir disculpas en cadena nacional', ef: { todos: -2, leg: 2 } },
        { t: 'Demandar al medio que los publicó', ef: { lib: -4, fac: { estudiantes: -4, clase_media: -2 }, prest: -2 } },
        { t: 'Decir que es inteligencia artificial', ef: { prob: { p: 0.5, si: {}, no: { todos: -5, leg: -3 }, ts: 'La duda alcanza.', tn: 'Los peritos confirman que son auténticos.' } } },
      ] },
    { id: 'cumbre_regional', cat: 'mundo', titulo: (E, c, H) => `Cumbre regional en ${N(H, c.x)}`,
      peso: E => 0.8, ctx: (E, H) => ({ x: H.pick(H.region().filter(i => i !== undefined)) }),
      texto: (E, c, H) => `Los jefes de Estado de la región se reúnen en ${N(H, c.x)} para discutir comercio, migración y seguridad.`,
      op: [
        { t: 'Liderar una declaración conjunta', ef: { pc: -3, prest: 4, rel: { region: 5 } } },
        { t: 'Ir con perfil bajo', ef: { rel: { x: 2 } } },
        { t: 'No asistir', ef: { pc: 1, rel: { region: -3 } } },
      ] },
    { id: 'religiosos_exigen', cat: 'politica', titulo: 'Los obispos y pastores alzan la voz',
      peso: (E, H) => (sat(E, 'religiosos') < 45 ? 1.4 : 0.3), texto: 'Los líderes religiosos exigen "respeto a los valores de la familia" y clases de religión en las escuelas.',
      op: [
        { t: 'Aprobar educación religiosa', req: (E, c, H) => !H.ley('laicidad') || 'Choca con el Estado laico', ef: { ley: 'educacion_religiosa' } },
        { t: 'Reunirse y escuchar', ef: { fac: { religiosos: 5 }, pc: -1 } },
        { t: 'Recordar que el Estado es de todos', ef: { fac: { religiosos: -6, estudiantes: 3 } } },
      ] },
    { id: 'marcha_estudiantil', cat: 'social', titulo: 'Marcha estudiantil',
      peso: E => (sat(E, 'estudiantes') < 40 ? 2.2 : 0.3), texto: 'Cien mil estudiantes marchan por educación gratuita y de calidad. Toman la universidad central.',
      op: [
        { t: 'Abrir una mesa de diálogo', ef: { pc: -2, fac: { estudiantes: 8 }, est: 2 } },
        { t: 'Prometer educación gratuita', req: E => ('educacion' in E.gob.min) || 'Requiere Ministerio de Educación', ef: { ley: 'educacion_gratuita' } },
        { t: 'Desalojar la universidad', ef: { fac: { estudiantes: -12, militares: 2 }, lib: -5, prest: -3, prot: 6, leg: -3 } },
      ] },
    { id: 'paro_camionero', cat: 'social', titulo: 'Paro de camioneros',
      peso: E => (sat(E, 'regiones') < 45 || E.mundo.precios.energia > 1.2 ? 1 : 0.2), texto: 'Los camioneros bloquean las rutas. Faltan alimentos y combustible en el sur del país.',
      op: [
        { t: 'Ceder a sus demandas', ef: { dinero: -0.25, fac: { regiones: 6, empresarios: -2 } } },
        { t: 'Desalojar las carreteras con la policía', ef: { fac: { regiones: -8, clase_media: 2 }, prot: 4, seg: -2 } },
        { t: 'Esperar a que se cansen', ef: { choque: { g: -1, t: 1 }, todos: -2 } },
      ] },
    { id: 'separatismo', cat: 'politica', titulo: 'Referéndum separatista',
      peso: E => (sat(E, 'regiones') < 35 ? 2 : E.gob.inst.territorio === 'centralizado' ? 0.25 : 0), ctx: (E, H) => ({ n: H.pick(['del Norte', 'Austral', 'de la Costa', 'del Valle', 'de las Montañas']) }),
      texto: (E, c) => `El gobierno de la Región ${c.n} convoca un referéndum de independencia "para decidir su futuro".`,
      op: [
        { t: 'Conceder amplia autonomía', req: E => E.gob.inst.territorio !== 'federal' || 'Ya es un Estado federal', ef: { inst: { territorio: 'descentralizado' }, fac: { regiones: 12, militares: -4 }, pc: -4 } },
        { t: 'Negociar un pacto fiscal', ef: { dinero: -0.4, fac: { regiones: 7 } } },
        { t: 'Prohibirlo y enviar a la policía', ef: { fac: { regiones: -14, militares: 4 }, prot: 10, lib: -4, est: -4 } },
      ] },
    { id: 'presion_elecciones', cat: 'politica', titulo: 'El mundo exige elecciones',
      peso: (E, H) => (!H.demo && E.turno > 10 && E.pol.legit < 50 ? 1.2 : 0), enfriar: 20,
      texto: 'Los gobiernos democráticos y la ONU exigen un calendario electoral. Amenazan con sanciones.',
      op: [
        { t: 'Prometer una transición "gradual"', ef: { leg: 4, rel: { occ: 4 } } },
        { t: 'Rechazar la injerencia extranjera', ef: { rel: { occ: -15 }, todos: 1, mod: { nombre: 'Sanciones occidentales', t: 8, ef: { g: -0.7, comercio: -0.4 } } } },
        { t: 'Convocar elecciones libres (transición a república presidencial)', ef: { cambioRegimen: 'presidencial', leg: 12, prest: 10, rel: { occ: 15 }, fac: { militares: -10, estudiantes: 10, clase_media: 8 } } },
      ] },
    { id: 'heredero', cat: 'politica', titulo: 'Escándalo en la Casa Real',
      peso: (E, H) => (H.R.TIPOS[H.tipo].corona ? 0.8 : 0), unico: true, texto: 'El príncipe heredero aparece en fotos de una cacería de elefantes pagada por un contratista del Estado.',
      op: [
        { t: 'Forzar una disculpa pública', ef: { leg: -2, todos: 1 } },
        { t: 'Que el rey abdique en su hija', ef: { leg: 4, est: -3, prest: 3 } },
        { t: 'Ocultarlo', ef: { prob: { p: 0.5, si: {}, no: { leg: -8, todos: -3 }, ts: 'La noticia muere.', tn: 'Todo sale a la luz.' } } },
      ] },
    { id: 'policia_moral', cat: 'social', titulo: 'Protestas contra la policía moral',
      peso: (E, H) => (H.tipo === 'teocracia' && sat(E, 'estudiantes') < 50 ? 1.5 : 0), texto: 'Una joven muere bajo custodia de la policía de la moral. Miles de jóvenes queman velos y retratos del Guía Supremo.',
      op: [
        { t: 'Disolver la policía de la moral', ef: { fac: { estudiantes: 10, religiosos: -12 }, lib: 5, prest: 4 } },
        { t: 'Reprimir sin piedad', ef: { fac: { estudiantes: -12, religiosos: 4 }, lib: -10, prest: -8, prot: -8, rel: { occ: -8 } } },
      ] },
    { id: 'reeleccion', cat: 'politica', titulo: 'Tus partidarios piden "un período más"',
      peso: (E, H) => (H.demo && E.pol.aprob > 58 && E.pol.mandatos >= 1 ? 0.6 : 0), unico: true,
      texto: 'Diputados oficialistas proponen eliminar el límite de mandatos y extender el actual período dos años "para terminar la obra".',
      op: [
        { t: 'Rechazarlo: la alternancia es sagrada', ef: { leg: 6, prest: 3, fac: { estudiantes: 3 } } },
        { t: 'Extender el período dos años', ef: { postergar: 8, leg: -12, prest: -8, rel: { occ: -10 }, fac: { estudiantes: -10, clase_media: -8 }, prot: 10 } },
      ] },

    // =============== SOCIAL Y SEGURIDAD ===============
    { id: 'crimen', cat: 'social', titulo: 'Ola de violencia narco',
      peso: E => (E.soc.seguridad < 45 ? 2 : 0.3), texto: 'Dos carteles se disputan los puertos. Cada noche hay tiroteos y el miedo se apodera de los barrios.',
      op: [
        { t: 'Mano dura: militares a las calles', ef: { dinero: -0.4, seg: 8, lib: -5, fac: { militares: 4, clase_media: 4, estudiantes: -4 } } },
        { t: 'Plan de prevención en los barrios', ef: { dinero: -0.3, seg: 3, fac: { sindicatos: 2 }, mod: { nombre: 'Plan de prevención', t: 12, ef: { seg: 4 } } } },
        { t: 'Una tregua secreta con los carteles', ef: { prob: { p: 0.6, si: { seg: 7, corr: 5 }, no: { corr: 6, todos: -6, leg: -6 }, ts: 'Los homicidios caen a la mitad.', tn: 'La prensa descubre la tregua.' } } },
      ] },
    { id: 'terremoto', cat: 'social', titulo: 'Terremoto',
      peso: E => 0.25, ctx: (E, H) => ({ m: H.pick(['7,4', '7,8', '8,1', '6,9']) }),
      texto: (E, c, H) => `Un terremoto de magnitud ${c.m} sacude el país. Cientos de muertos, puentes caídos y barrios enteros sin agua.`,
      op: [
        { t: 'Reconstrucción masiva', ef: { pib: -0.8, dinero: -1.5, infra: -2, todos: 3, fac: { regiones: 4 } } },
        { t: 'Pedir ayuda internacional', ef: { pib: -0.8, dinero: -0.5, infra: -4, prest: -1, rel: { todos: 2 } } },
        { t: 'Reconstrucción austera', ef: { pib: -0.8, infra: -6, todos: -5, fac: { regiones: -8 } } },
      ] },
    { id: 'huelga_medicos', cat: 'social', titulo: 'Huelga en los hospitales',
      peso: E => (E.soc.salud < 52 || E.eco.gasto.salud < 4 ? 1.4 : 0.2), texto: 'Médicos y enfermeras paralizan los hospitales públicos: faltan insumos y los sueldos no alcanzan.',
      op: [
        { t: 'Subir el presupuesto de salud', ef: { gastoArea: { salud: 0.8 }, fac: { clase_media: 4 } } },
        { t: 'Bono de una vez', ef: { dinero: -0.15, salud: -1 } },
        { t: 'Rechazar las demandas', ef: { salud: -3, fac: { clase_media: -5 }, prot: 4 } },
      ] },
    { id: 'profesores', cat: 'social', titulo: 'Paro docente',
      peso: E => (E.soc.educacion < 50 || E.eco.gasto.educacion < 3.5 ? 1.3 : 0.2), texto: 'Los profesores llevan tres semanas en paro. Dos millones de niños sin clases.',
      op: [
        { t: 'Aumentar el gasto en educación', ef: { gastoArea: { educacion: 0.7 }, fac: { estudiantes: 4 } } },
        { t: 'Descontar los días no trabajados', ef: { educacion: -2, fac: { sindicatos: -5, estudiantes: -3 } } },
      ] },
    { id: 'incendios', cat: 'social', titulo: 'Incendios forestales',
      peso: E => 0.4, texto: 'Un verano extremo desata incendios en el centro del país. El humo cubre la capital.',
      op: [
        { t: 'Brigadas y aviones cisterna', ef: { dinero: -0.2, fac: { campesinos: 3 } } },
        { t: 'Desplegar a las Fuerzas Armadas', ef: { dinero: -0.1, fac: { militares: 3, campesinos: 2 } } },
        { t: 'Pedir aviones a un vecino', ef: (E, c, H) => ({ rel: { vecinos: 3 }, prest: -1 }) },
      ] },
    { id: 'acusacion_narco', cat: 'mundo', titulo: 'Washington te acusa',
      peso: E => (E.soc.corr > 62 ? 1 : 0), texto: 'El Departamento de Estado acusa a altos funcionarios de tu gobierno de proteger el narcotráfico.',
      op: [
        { t: 'Entregar a los acusados', ef: { rel: { USA: 10 }, fac: { militares: -6 }, corr: -3 } },
        { t: 'Denunciar injerencia imperialista', ef: { rel: { USA: -15 }, alin: -6, todos: 2 } },
      ] },
    { id: 'mundial', cat: 'oportunidad', titulo: 'Sede de los Juegos Regionales', unico: true,
      peso: E => 0.4, texto: 'Te ofrecen organizar los Juegos Deportivos Regionales. Estadios nuevos, turismo y orgullo nacional.',
      op: [
        { t: 'Aceptar la sede', ef: { dinero: -1, prest: 5, todos: 3, infra: 2, prob: { p: 0.65, si: {}, no: { corr: 4, todos: -4 }, ts: 'Los juegos son un éxito.', tn: 'Sobrecostos y estadios a medio terminar.' } } },
        { t: 'Rechazarla: hay otras prioridades', ef: { fac: { clase_media: 1 } } },
      ] },
    { id: 'remesas', cat: 'oportunidad', titulo: 'La diáspora quiere volver',
      peso: E => 0.35, unico: true, texto: 'Miles de profesionales que emigraron en los años malos preguntan si vale la pena regresar.',
      op: [
        { t: 'Programa de retorno con incentivos', ef: { dinero: -0.2, educacion: 2, choque: { g: 0.3, t: 8 } } },
        { t: 'No hacer nada especial', ef: {} },
      ] },

    // =============== VECINOS ===============
    { id: 'incidente_frontera', cat: 'vecinos', titulo: (E, c, H) => `Incidente en la frontera con ${N(H, c.v)}`,
      peso: (E, H) => (H.disputa() ? 1.5 : 0), ctx: (E, H) => ({ v: H.disputa() }),
      texto: (E, c, H) => `Una patrulla de ${N(H, c.v)} entra en territorio en disputa y planta su bandera. Los medios piden una respuesta.`,
      op: [
        { t: 'Protesta diplomática formal', ef: { rel: { v: -4 } } },
        { t: 'Movilizar tropas a la frontera', ef: { dinero: -0.2, fac: { militares: 6 }, todos: 2, rel: { v: -15 }, tension: 3 } },
        { t: 'Proponer una comisión binacional', ef: { pc: -2, rel: { v: 8 }, fac: { militares: -2 } } },
      ] },
    { id: 'vecino_tlc', cat: 'vecinos', titulo: (E, c, H) => `${N(H, c.v)} propone un TLC`,
      peso: (E, H) => (vecinoAl(E, H, q => !q.tr.tlc && q.rel > 10) ? 0.9 : 0), ctx: (E, H) => { const v = vecinoAl(E, H, q => !q.tr.tlc && q.rel > 10); return v ? { v } : null; },
      texto: (E, c, H) => `El gobierno de ${N(H, c.v)} ofrece eliminar aranceles entre ambos países. Su principal exportación es ${{ petroleo: 'el petróleo', gas: 'el gas', mineria: 'la minería', agro: 'la agricultura', manufactura: 'la industria', servicios: 'los servicios', turismo: 'el turismo', tecnologia: 'la tecnología', pesca: 'la pesca' }[H.meta(c.v).exp]}.`,
      op: [
        { t: 'Firmar', ef: (E, c, H) => ({ tratado: { tipo: 'tlc' }, rel: { v: 6 }, fac: Object.assign({ empresarios: 4 }, H.meta(c.v).exp === 'agro' ? { campesinos: -5 } : {}, H.meta(c.v).exp === 'manufactura' ? { sindicatos: -4 } : {}) }) },
        { t: 'Rechazar', ef: { rel: { v: -4 } } },
      ] },
    { id: 'vecino_crisis', cat: 'vecinos', titulo: (E, c, H) => `Colapso económico en ${N(H, c.v)}`,
      peso: E => 0.5, ctx: (E, H) => ({ v: H.pick(H.vecinos()) }),
      texto: (E, c, H) => `La moneda de ${N(H, c.v)} pierde la mitad de su valor en una semana. Tus exportadores pierden su principal mercado.`,
      op: [
        { t: 'Ofrecer un crédito de apoyo', ef: { dinero: -0.3, rel: { v: 12 }, choque: { g: -0.4, t: 2 } } },
        { t: 'Cerrar la frontera al contrabando', ef: { rel: { v: -6 }, fac: { regiones: 3 }, choque: { g: -0.8, t: 2 } } },
        { t: 'Mirar desde lejos', ef: { choque: { g: -0.8, t: 2 } } },
      ] },
    { id: 'rio', cat: 'vecinos', titulo: (E, c, H) => `Represa en el río compartido con ${N(H, c.v)}`,
      peso: E => 0.4, unico: true, ctx: (E, H) => ({ v: H.pick(H.vecinos()) }),
      texto: (E, c, H) => `${N(H, c.v)} construirá una gran represa aguas arriba del río que riega tus valles.`,
      op: [
        { t: 'Exigir un tratado de aguas', ef: { pc: -2, rel: { v: -3 }, fac: { campesinos: 4 } } },
        { t: 'Proponer construirla juntos', ef: { dinero: -0.5, rel: { v: 12 }, infra: 2 } },
        { t: 'Amenazar con represalias', ef: { rel: { v: -18 }, fac: { militares: 4, campesinos: 3 }, tension: 2 } },
      ] },
    { id: 'contrabando', cat: 'vecinos', titulo: 'Contrabando en la frontera',
      peso: E => 0.5, ctx: (E, H) => ({ v: H.pick(H.vecinos()) }),
      texto: (E, c, H) => `Mafias de ambos lados pasan mercancías, armas y personas por la frontera con ${N(H, c.v)}.`,
      op: [
        { t: 'Operación conjunta', ef: { pc: -2, rel: { v: 6 }, seg: 2 } },
        { t: 'Militarizar la frontera', ef: { dinero: -0.2, seg: 3, rel: { v: -5 }, fac: { militares: 3 } } },
        { t: 'Tolerarlo: da de comer a la región', ef: { corr: 2, fac: { regiones: 3 } } },
      ] },
    { id: 'extradicion', cat: 'vecinos', titulo: (E, c, H) => `${N(H, c.v)} pide una extradición`,
      peso: E => 0.4, ctx: (E, H) => ({ v: H.pick(H.vecinos()), n: H.persona() }),
      texto: (E, c, H) => `${c.n}, opositor/a al gobierno de ${N(H, c.v)}, pidió asilo en tu embajada. Su gobierno exige que lo entregues por "terrorismo".`,
      op: [
        { t: 'Conceder el asilo', ef: (E, c, H) => ({ rel: { v: -12 }, prest: DEMO_REG_L(H.est(c.v).reg) ? -1 : 4 }) },
        { t: 'Entregarlo', ef: (E, c, H) => ({ rel: { v: 10 }, prest: -3, fac: { estudiantes: -4 } }) },
      ] },
    { id: 'guerra_regional', cat: 'mundo', titulo: (E, c, H) => `Guerra entre ${N(H, c.x)} y ${N(H, c.y)}`,
      peso: E => 0.25, enfriar: 30, ctx: (E, H) => { const r = H.continente().filter(i => !H.vecinos().includes(i)); if (r.length < 2) return null; const x = H.pick(r); const y = H.pick(r.filter(i => i !== x)); return { x, y }; },
      texto: (E, c, H) => `Estalla la guerra entre ${N(H, c.x)} y ${N(H, c.y)}. Ambos piden tu apoyo diplomático.`,
      op: [
        { t: (E, c, H) => `Apoyar a ${N(H, c.x)}`, ef: { rel: { x: 15, y: -20 } } },
        { t: (E, c, H) => `Apoyar a ${N(H, c.y)}`, ef: { rel: { y: 15, x: -20 } } },
        { t: 'Ofrecer mediación', ef: { pc: -4, prob: { p: 0.35, si: { prest: 10, rel: { x: 6, y: 6 } }, no: { prest: -1 }, ts: 'Tu mediación logra la paz. Eres noticia en el mundo.', tn: 'Nadie te hace caso.' } } },
        { t: 'Neutralidad estricta', ef: { prest: 1 } },
      ] },

    // =============== POTENCIAS ===============
    { id: 'red_5g', cat: 'mundo', titulo: 'La batalla del 5G', unico: true,
      peso: E => 0.6, texto: 'Estados Unidos pide que excluyas a empresas chinas de tu red 5G. China ofrece instalarla a mitad de precio.',
      op: [
        { t: 'Excluir a las empresas chinas', ef: { rel: { USA: 10, CHN: -15 }, alin: 8, dinero: -0.2 } },
        { t: 'Aceptar la oferta china', ef: { rel: { CHN: 12, USA: -12 }, alin: -8, dinero: 0.1, infra: 2 } },
        { t: 'Licitación abierta a todos', ef: { pc: -2, rel: { USA: -3, CHN: -3 } } },
      ] },
    { id: 'base_militar', cat: 'mundo', titulo: (E, c, H) => `${N(H, c.x)} quiere una base militar`,
      peso: E => 0.35, unico: true, ctx: (E, H) => ({ x: E.pol.alin >= 0 ? 'USA' : H.pick(['CHN', 'RUS']) }),
      texto: (E, c, H) => `${N(H, c.x)} ofrece pagar un generoso arriendo por instalar una base militar en tu territorio.`,
      op: [
        { t: 'Aceptar la base', ef: (E, c) => ({ mod: { nombre: 'Arriendo de la base', t: 40, ef: { ingreso: 0.3, mil: 0.1 } }, rel: { x: 18, [c.x === 'USA' ? 'CHN' : 'USA']: -20 }, alin: c.x === 'USA' ? 25 : -25, fac: { militares: 5, estudiantes: -8 }, prest: -2 }) },
        { t: 'Rechazarla: somos soberanos', ef: { rel: { x: -8 }, todos: 2 } },
      ] },
    { id: 'inversion_rusa', cat: 'mundo', titulo: 'Rusia ofrece una central nuclear', unico: true,
      peso: E => (E.mundo.p.RUS.rel > -10 ? 0.35 : 0), texto: 'La agencia nuclear rusa ofrece construir y financiar una central nuclear. Energía barata por 60 años.',
      op: [
        { t: 'Aceptar', ef: { infra: 3, deuda: 2, rel: { RUS: 15, USA: -10 }, alin: -10, mod: { nombre: 'Energía nuclear', t: 80, ef: { energia: -0.6, g: 0.1 } } } },
        { t: 'Rechazar', ef: { rel: { RUS: -5 } } },
      ] },
    { id: 'ayuda_ofrecida', cat: 'oportunidad', titulo: (E, c, H) => `${N(H, c.x)} ofrece cooperación`,
      peso: E => 0.5, ctx: (E, H) => ({ x: H.pick(['JPN', 'DEU', 'KOR', 'CHN', 'FRA', 'GBR', 'USA', 'SAU', 'ARE'].filter(i => H.meta(i))) }),
      texto: (E, c, H) => `La agencia de cooperación de ${N(H, c.x)} ofrece financiar hospitales y escuelas rurales.`,
      op: [
        { t: 'Aceptar con gratitud', ef: (E, c, H) => ({ salud: 1.5, educacion: 1.5, rel: { x: 6 }, alin: H.est(c.x).ali === 'occ' ? 3 : H.est(c.x).ali === 'eje' ? -3 : 0 }) },
        { t: 'Aceptar solo si no hay condiciones', ef: { prob: { p: 0.5, si: { salud: 1.5, educacion: 1.5 }, no: { rel: { x: -3 } }, ts: 'Aceptan sin condiciones.', tn: 'Retiran la oferta.' } } },
      ] },

    // =============== MANUALES (los dispara un suceso global) ===============
    { id: 'pandemia_decision', cat: 'crisis', manual: true, titulo: 'Pandemia: ¿cuarentena?',
      texto: 'El virus llega al país. Los hospitales se preparan. Los expertos piden confinamiento; el comercio pide no cerrar.',
      op: [
        { t: 'Cuarentena estricta', ef: { choque: { g: -3, t: 2 }, salud: -1, fac: { empresarios: -6, clase_media: -2 }, todos: 1 } },
        { t: 'Medidas suaves', ef: { prob: { p: 0.45, si: { choque: { g: -1, t: 2 }, salud: -2 }, no: { choque: { g: -2, t: 2 }, salud: -7, todos: -5 }, ts: 'La ola es moderada.', tn: 'Los hospitales colapsan.' } } },
        { t: 'Comprar vacunas occidentales a precio premium', ef: { dinero: -0.4, salud: 1, rel: { occ: 3 }, choque: { g: -1.2, t: 2 } } },
        { t: 'Aceptar vacunas chinas y rusas', ef: { dinero: -0.1, rel: { CHN: 6, RUS: 6 }, alin: -4, choque: { g: -1.4, t: 2 } } },
      ] },
    { id: 'cumbre_clima_dec', cat: 'mundo', manual: true, titulo: 'Cumbre climática mundial',
      texto: 'Los países se comprometen a reducir emisiones. Tu delegación debe fijar una meta.',
      op: [
        { t: 'Meta ambiciosa: carbono neutral en 2050', ef: (E, c, H) => (('energia' in E.gob.min) ? { ley: 'renovables', prest: 4 } : { prest: 6, fac: { estudiantes: 6, empresarios: -3 }, mod: { nombre: 'Compromiso climático', t: 20, ef: { gasto: 0.3 } } }) },
        { t: 'Meta modesta', ef: { prest: 1 } },
        { t: 'No firmar: primero el desarrollo', ef: { prest: -4, fac: { estudiantes: -5, empresarios: 2 }, rel: { occ: -3 } } },
      ] },
    { id: 'elegir_bando', cat: 'mundo', manual: true, titulo: 'Guerra comercial: elige bando',
      texto: 'Washington y Pekín se imponen aranceles. Ambos presionan a los países medianos para que tomen partido.',
      op: [
        { t: 'Alinearte con Estados Unidos', ef: { rel: { USA: 12, CHN: -15 }, alin: 12 } },
        { t: 'Alinearte con China', ef: { rel: { CHN: 12, USA: -15 }, alin: -12 } },
        { t: 'Neutralidad: vender a los dos', ef: { pc: -2, prob: { p: 0.6, si: { choque: { g: 0.6, t: 6 } }, no: { rel: { USA: -5, CHN: -5 } }, ts: 'Te conviertes en puente comercial.', tn: 'Ambos desconfían de ti.' } } },
      ] },
    { id: 'voto_onu', cat: 'mundo', manual: true, titulo: (E, c, H) => `Votación en la ONU sobre ${N(H, c.x)}`,
      texto: (E, c, H) => `La Asamblea General vota una resolución que condena a ${N(H, c.x)} por ${c.motivo}. Tu voto importa.`,
      op: [
        { t: 'Votar a favor de la condena', ef: (E, c, H) => ({ rel: { x: -15, [c.y]: 8 }, alin: H.est(c.x).ali === 'eje' ? 6 : -6, prest: 2 }) },
        { t: 'Votar en contra', ef: (E, c, H) => ({ rel: { x: 12, [c.y]: -10 }, alin: H.est(c.x).ali === 'eje' ? -6 : 6 }) },
        { t: 'Abstenerse', ef: { rel: { x: -2 } } },
      ] },
    { id: 'crisis_alimentos_dec', cat: 'economia', manual: true, titulo: 'El pan se encarece',
      texto: 'El precio mundial del trigo y el maíz se dispara. En los mercados populares hay rabia.',
      op: [
        { t: 'Subsidiar el pan y el aceite', ef: { dinero: -0.5, fac: { sindicatos: 4, campesinos: 2 }, prot: -5 } },
        { t: 'Prohibir exportar alimentos', ef: (E) => ({ infl: -0.8, fac: { campesinos: E.eco.sec.agro ? -10 : -3 }, rel: { region: -3 } }) },
        { t: 'No intervenir', ef: { infl: 1.5, prot: 8 } },
      ] },
    { id: 'vecino_golpe', cat: 'vecinos', manual: true, titulo: (E, c, H) => `Golpe de Estado en ${N(H, c.v)}`,
      texto: (E, c, H) => `Militares de ${N(H, c.v)} derrocan al gobierno y suspenden la Constitución. Piden tu reconocimiento.`,
      op: [
        { t: 'Condenar el golpe', ef: { rel: { v: -20, occ: 3 }, prest: 3 } },
        { t: 'Reconocer a la Junta', ef: { rel: { v: 15 }, prest: -4 } },
        { t: 'Silencio diplomático', ef: {} },
      ] },
    { id: 'ayuda_humanitaria', cat: 'mundo', manual: true, titulo: (E, c, H) => `Tragedia en ${N(H, c.x)}`,
      texto: (E, c, H) => `${c.desastre} en ${N(H, c.x)} deja miles de víctimas. El mundo envía ayuda.`,
      op: [
        { t: 'Enviar ayuda y rescatistas', ef: { dinero: -0.1, rel: { x: 14 }, prest: 3 } },
        { t: 'Enviar un mensaje de condolencias', ef: { rel: { x: 2 } } },
      ] },
    { id: 'refugiados', cat: 'vecinos', manual: true, titulo: (E, c, H) => `Refugiados desde ${N(H, c.v)}`,
      texto: (E, c, H) => `La crisis en ${N(H, c.v)} empuja a cientos de miles de personas hacia tu frontera.`,
      op: [
        { t: 'Acoger y regularizar', ef: { dinero: -0.4, prest: 6, rel: { v: 5 }, fac: { clase_media: -3, sindicatos: -3 }, pob: 1.5 } },
        { t: 'Cerrar la frontera', ef: { fac: { militares: 3, clase_media: 2 }, prest: -4, rel: { v: -6 } } },
        { t: 'Pedir fondos a la ONU para campamentos', ef: { prob: { p: 0.55, si: { prest: 3 }, no: { dinero: -0.3 }, ts: 'La ONU financia los campamentos.', tn: 'La ayuda no llega: pagas tú.' } } },
      ] },
  ];

  function DEMO_REG_L(r) { return r === 'pres' || r === 'parl' || r === 'monc'; }
  function NUCLEO_REF() { return typeof module !== 'undefined' && module.exports ? require('./nucleo.js') : NUCLEO; }

  // ---------------- sucesos globales ----------------
  // ef: desviaciones de las variables mundiales mientras dura. evento: decisión que dispara.
  const SUCESOS = {
    recesion_global: { nombre: 'Recesión mundial', dur: [4, 7], peso: () => 1, ef: { crec: -3.2, metales: -0.25, energia: -0.3, alimentos: -0.1, turismo: -0.25, tasa: -1 },
      texto: 'Recesión mundial: Wall Street se desploma y el comercio internacional cae. Se avecinan tiempos duros.', finTexto: 'La economía mundial vuelve a crecer tras la recesión.' },
    boom_materias: { nombre: 'Superciclo de materias primas', dur: [6, 10], peso: () => 1, ef: { metales: 0.45, energia: 0.3, alimentos: 0.2, crec: 0.6 },
      texto: 'Superciclo de materias primas: la demanda asiática dispara los precios del cobre, el petróleo y la soja.', finTexto: 'Se acaba el boom de las materias primas.' },
    crisis_petroleo: { nombre: 'Crisis del petróleo', dur: [3, 6], peso: () => 0.8, ef: { energia: 0.75, crec: -1, alimentos: 0.1 }, tension: 15,
      ctx: (E, H) => ({ x: H.pick(['IRN', 'SAU', 'IRQ', 'ARE']) }), texto: (E, c, H) => `Crisis del petróleo: ataques a refinerías en ${H.nom(c.x)} cierran el estrecho de Ormuz. El barril supera los 140 dólares.`, finTexto: 'Se reabre el estrecho de Ormuz: el petróleo baja.' },
    pandemia: { nombre: 'Pandemia global', dur: [3, 5], peso: () => 0.35, enfriar: 60, ef: { crec: -5.5, turismo: -0.8, energia: -0.3 }, evento: 'pandemia_decision',
      texto: 'Pandemia: un nuevo virus respiratorio se propaga por todos los continentes. La OMS declara emergencia global.', finTexto: 'La OMS da por terminada la emergencia sanitaria.' },
    fed_tasas: { nombre: 'La Reserva Federal sube las tasas', dur: [6, 10], peso: () => 1, ef: { tasa: 2.2, crec: -0.5, metales: -0.1 },
      texto: 'La Reserva Federal sube las tasas de interés al nivel más alto en dos décadas. El crédito se encarece para todos.', finTexto: 'La Reserva Federal vuelve a bajar las tasas.' },
    revolucion_ia: { nombre: 'Revolución de la inteligencia artificial', dur: [12, 16], peso: E => (E.turno > 8 ? 0.6 : 0), enfriar: 80, ef: { crec: 0.6 },
      texto: 'La inteligencia artificial transforma el trabajo en todo el mundo. Los países con buena educación despegan; los demás pierden empleos.', finTexto: 'La ola de la inteligencia artificial se asienta.' },
    crisis_alimentaria: { nombre: 'Crisis alimentaria', dur: [3, 6], peso: () => 0.7, ef: { alimentos: 0.6, crec: -0.3 }, evento: 'crisis_alimentos_dec',
      texto: 'Crisis alimentaria: sequías en los graneros del mundo disparan el precio del trigo y el maíz.', finTexto: 'Los precios de los alimentos se normalizan.' },
    guerra_comercial: { nombre: 'Guerra comercial EE.UU.–China', dur: [6, 12], peso: () => 0.7, enfriar: 40, ef: { crec: -0.9, metales: -0.1 }, tension: 20, evento: 'elegir_bando',
      texto: 'Guerra comercial: Estados Unidos y China se imponen aranceles del 60%. Las cadenas de suministro se rompen.', finTexto: 'Washington y Pekín firman una tregua comercial.' },
    cumbre_clima: { nombre: 'Cumbre climática', dur: [1, 1], peso: () => 0.6, enfriar: 20, evento: 'cumbre_clima_dec',
      texto: 'Cumbre climática de la ONU: los líderes del mundo se reúnen para fijar nuevas metas de emisiones.' },
    conflicto_potencias: { nombre: 'Conflicto entre potencias', dur: [6, 12], peso: () => 0.5, enfriar: 40, ef: { energia: 0.3, alimentos: 0.25, crec: -1 }, tension: 25, evento: 'voto_onu',
      ctx: (E, H) => H.pick([{ x: 'RUS', y: 'UKR', motivo: 'una nueva ofensiva militar', t: 'Rusia lanza una nueva ofensiva en Ucrania' }, { x: 'CHN', y: 'TWN', motivo: 'el bloqueo naval a Taiwán', t: 'China bloquea Taiwán con su armada' }, { x: 'IRN', y: 'ISR', motivo: 'sus ataques con misiles', t: 'Irán e Israel intercambian ataques con misiles' }, { x: 'PRK', y: 'KOR', motivo: 'sus ensayos nucleares', t: 'Corea del Norte realiza un ensayo nuclear' }]),
      texto: (E, c) => `${c.t}. Los mercados tiemblan y las potencias exigen definiciones.`, finTexto: 'La tensión entre las potencias disminuye.' },
    crisis_financiera: { nombre: 'Crisis financiera', dur: [3, 5], peso: () => 0.6, ef: { crec: -2, tasa: 0.6, metales: -0.15 },
      ctx: (E, H) => ({ x: H.pick(['CHN', 'USA', 'GBR', 'JPN', 'DEU']) }), texto: (E, c, H) => `Crisis financiera: quiebra un gigante bancario en ${H.nom(c.x)}. El pánico se contagia a los mercados emergentes.`, finTexto: 'Los mercados financieros se calman.' },
    boom_turismo: { nombre: 'Auge del turismo', dur: [6, 10], peso: () => 0.6, ef: { turismo: 0.3, crec: 0.2 },
      texto: 'Auge del turismo mundial: vuelos baratos y nómadas digitales llenan hoteles en todo el mundo.', finTexto: 'El auge turístico se modera.' },
    golpe_region: { nombre: 'Golpe en la región', dur: [1, 1], peso: (E, H) => (H.vecinos().some(v => DEMO_REG_L(H.est(v).reg)) ? 0.5 : 0), enfriar: 30, evento: 'vecino_golpe',
      ctx: (E, H) => { const l = H.vecinos().filter(v => DEMO_REG_L(H.est(v).reg)); return l.length ? { v: H.pick(l) } : null; },
      alInicio: (E, c) => { E.mundo.p[c.v].reg = 'militar'; },
      texto: (E, c, H) => `Golpe de Estado en ${H.nom(c.v)}: los militares toman el poder.` },
    desastre_mundo: { nombre: 'Gran desastre natural', dur: [1, 1], peso: () => 0.7, enfriar: 12, evento: 'ayuda_humanitaria',
      ctx: (E, H) => ({ x: H.pick(['TUR', 'JPN', 'PHL', 'IDN', 'MEX', 'CHL', 'PER', 'HTI', 'BGD', 'PAK', 'NPL', 'MAR', 'ITA', 'GRC', 'MOZ']), desastre: H.pick(['Un terremoto devastador', 'Un tsunami', 'Un huracán de categoría 5', 'Inundaciones históricas']) }),
      texto: (E, c, H) => `${c.desastre} golpea ${H.nom(c.x)}.` },
    crisis_migratoria: { nombre: 'Crisis migratoria', dur: [4, 6], peso: () => 0.5, enfriar: 30, evento: 'refugiados',
      ctx: (E, H) => ({ v: H.pick(H.vecinos()) }), texto: (E, c, H) => `Crisis humanitaria en ${H.nom(c.v)}: el hambre y la violencia empujan a millones fuera del país.`, finTexto: 'La crisis migratoria regional se estabiliza.' },
    cambio_gobierno: { nombre: 'Cambio de gobierno', dur: [1, 1], peso: () => 1, enfriar: 8,
      ctx: (E, H) => { const x = H.pick(H.vecinos().concat(['USA', 'CHN', 'BRA', 'DEU', 'IND', 'FRA', 'GBR'])); return { x, d: H.rnd() < 0.5 ? 1 : -1 }; },
      alInicio: (E, c) => { E.mundo.p[c.x].mod += 18 * c.d; },
      texto: (E, c, H) => `Elecciones en ${H.nom(c.x)}: gana ${c.d > 0 ? 'un gobierno que simpatiza con tu país' : 'un candidato que desconfía de tu gobierno'}.` },
  };

  return { EVENTOS, SUCESOS };
})();
if (typeof module !== 'undefined') module.exports = EVENTOS_SOB;
