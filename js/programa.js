// Lógica del programa: guardar las semanas de la guía y armar cada semana
// lista para mostrar (horas calculadas, puestos, nombres, avisos).
// Es la versión JavaScript de core/programa.py (mismas reglas).
//
// Cálculo de horas (igual que el Excel original):
//     inicio            canción + oración ........ 5 min
//                       palabras de introducción . 1 min
//     Tesoros           partes; la lectura de la Biblia suma 1 min de consejo
//     Seamos mejores    cada parte suma 1 min de consejo, salvo las de
//     maestros          "Análisis con el auditorio" (p. ej. ¿Qué diría?)
//     Vida cristiana    canción ................... 5 min, luego las partes
//                       palabras de conclusión .... 3 min, canción final
// Con inicio 19:30 la canción final queda a las 21:09 (99 minutos).
//
// El estado completo (config, personas, semanas con sus partes y asignaciones)
// es un objeto simple; datos.js lo guarda en el dispositivo.

import { MAESTROS, NOMBRE_MES, TESOROS, VIDA } from './lector.js';

export { MAESTROS, TESOROS, VIDA };
export const DURACION_NORMAL = 99; // minutos entre el inicio y la canción final
export const SECCIONES = [
  [TESOROS, 'TESOROS DE LA BIBLIA'],
  [MAESTROS, 'SEAMOS MEJORES MAESTROS'],
  [VIDA, 'NUESTRA VIDA CRISTIANA'],
];
export const TIPOS = { normal: 'Normal', visita: 'Visita del superintendente', sin_reunion: 'Sin reunión' };
export const MOTIVOS_SIN_REUNION = [
  'Asamblea regional',
  'Asamblea de circuito',
  'Conmemoración de la muerte de Jesús',
];
export const CONFIG_INICIAL = { congregacion: '', hora_inicio: '19:30' }; // la congregación se escribe en Configuración

export function estadoVacio() {
  return { formato: 1, actualizado: null, sig: 1, config: { ...CONFIG_INICIAL }, personas: [], semanas: [] };
}

const nuevoId = (e) => e.sig++;

// ── Orden alfabético en castellano ("Ángela" junto a "Ana") ─────────────

export function ordenAlfabetico(nombre) {
  return nombre.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
export const compararNombres = (a, b) => {
  const x = ordenAlfabetico(a), y = ordenAlfabetico(b);
  return x < y ? -1 : x > y ? 1 : 0;
};

export function personasActivas(e) {
  return e.personas.filter((p) => p.activo).map((p) => p.nombre).sort(compararNombres);
}

// ── Roles y consejo por defecto ──────────────────────────────────────────

export const esEstudio = (titulo) => titulo.toLowerCase().includes('estudio bíblico de la congregación');

export function rolesPorDefecto(seccion, titulo, auditorio) {
  const t = titulo.toLowerCase();
  if (seccion === TESOROS) return t.includes('lectura de la biblia') ? ['Estudiante', null] : ['', null];
  if (seccion === MAESTROS) {
    if (auditorio || t.startsWith('discurso')) return ['Estudiante', null];
    return ['Estudiante', 'Ayudante'];
  }
  if (esEstudio(titulo)) return ['Conductor', 'Lector'];
  return ['', null];
}

export function consejoPorDefecto(seccion, titulo, auditorio) {
  if (seccion === TESOROS) return titulo.toLowerCase().includes('lectura de la biblia');
  return seccion === MAESTROS && !auditorio;
}

// ── Guardar la guía ──────────────────────────────────────────────────────

// Guarda una semana leída del PDF. Devuelve 'nueva', 'reemplazada' u 'omitida'.
export function guardarSemana(e, s, guia, reemplazar = false) {
  let sem = e.semanas.find((x) => x.fecha_inicio === s.fecha_inicio);
  if (sem && !reemplazar) return 'omitida';
  let estado;
  if (sem) {
    // Se reemplazan las partes pero se conservan presidente y oraciones.
    Object.assign(sem, {
      fechas: s.fechas, lectura: s.lectura, cancion_inicio: s.cancion_inicio,
      cancion_medio: s.cancion_medio, cancion_final: s.cancion_final, guia,
    });
    for (const k of Object.keys(sem.asignaciones)) if (/^p\d+_[12]$/.test(k)) delete sem.asignaciones[k];
    sem.partes = [];
    estado = 'reemplazada';
  } else {
    sem = {
      id: nuevoId(e), fecha_inicio: s.fecha_inicio, fechas: s.fechas, lectura: s.lectura,
      cancion_inicio: s.cancion_inicio, cancion_medio: s.cancion_medio, cancion_final: s.cancion_final,
      hora_inicio: null, tipo: 'normal', motivo: null, imagen: null,
      so_titulo: null, so_nombre: null, so_cancion: null, guia, partes: [], asignaciones: {},
    };
    e.semanas.push(sem);
    e.semanas.sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
    estado = 'nueva';
  }
  for (const p of s.partes) {
    const [rol1, rol2] = rolesPorDefecto(p.seccion, p.titulo, p.auditorio);
    sem.partes.push({
      id: nuevoId(e), numero: p.numero, seccion: p.seccion, titulo: p.titulo, minutos: p.minutos,
      consejo: consejoPorDefecto(p.seccion, p.titulo, p.auditorio), rol1, rol2,
    });
  }
  return estado;
}

// Deja las partes numeradas 1..n en orden de sección y número.
export function renumerar(sem) {
  const orden = { [TESOROS]: 0, [MAESTROS]: 1, [VIDA]: 2 };
  sem.partes.sort((a, b) => orden[a.seccion] - orden[b.seccion] || a.numero - b.numero);
  sem.partes.forEach((p, i) => { p.numero = i + 1; });
}

// ── Cambios a mano ───────────────────────────────────────────────────────

export const buscarSemana = (e, id) => e.semanas.find((s) => s.id === Number(id));

export function asignar(e, semanaId, clave, nombre) {
  if (!/^(presidente|oracion_inicio|oracion_final|p\d+_[12])$/.test(clave)) throw new Error('Puesto inválido');
  const sem = buscarSemana(e, semanaId);
  if (!sem) throw new Error('Semana no encontrada');
  nombre = (nombre || '').trim();
  const a = sem.asignaciones;
  // La oración final la hace el presidente salvo excepción: sigue al presidente
  // mientras nadie la haya cambiado a mano.
  if (clave === 'presidente' && (!a.oracion_final || a.oracion_final === a.presidente)) {
    if (nombre) a.oracion_final = nombre;
    else delete a.oracion_final;
  }
  if (nombre) a[clave] = nombre;
  else delete a[clave];
}

const CAMPOS_NUMERO = new Set(['so_cancion', 'cancion_inicio', 'cancion_medio', 'cancion_final']);
const CAMPOS_SEMANA = new Set(['tipo', 'motivo', 'so_titulo', 'so_nombre', 'hora_inicio', ...CAMPOS_NUMERO]);

export function editarSemana(e, semanaId, campo, valor) {
  if (!CAMPOS_SEMANA.has(campo)) throw new Error('Campo inválido');
  const sem = buscarSemana(e, semanaId);
  if (!sem) throw new Error('Semana no encontrada');
  let v = typeof valor === 'string' ? valor.trim() : valor;
  if (CAMPOS_NUMERO.has(campo)) v = /^\d+$/.test(String(v ?? '').trim()) ? Number(v) : null;
  if (campo === 'hora_inicio' && v && !/^\d{1,2}:\d{2}$/.test(v)) throw new Error('La hora debe ser HH:MM, por ejemplo 19:30');
  if (campo === 'tipo' && !(v in TIPOS)) throw new Error('Tipo inválido');
  if (campo === 'tipo' && !v) v = 'normal';
  sem[campo] = v === '' || v === undefined ? null : v;
}

export function quitarSemana(e, semanaId) {
  const sem = buscarSemana(e, semanaId);
  e.semanas = e.semanas.filter((s) => s !== sem);
  return sem; // quien llama borra su imagen
}

export function editarParte(e, semanaId, parteId, { titulo, minutos, ayudante, consejo }) {
  titulo = (titulo || '').trim();
  minutos = Number(minutos);
  if (!titulo || !(minutos > 0 && minutos <= 60)) throw new Error('Revisa el título y los minutos (1 a 60).');
  const sem = buscarSemana(e, semanaId);
  const p = sem?.partes.find((x) => x.id === Number(parteId));
  if (!p) throw new Error('Parte no encontrada');
  if (p.seccion !== VIDA || !esEstudio(p.titulo)) {
    p.rol2 = ayudante ? 'Ayudante' : null;
    if (ayudante && !p.rol1) p.rol1 = 'Estudiante';
  }
  if (!p.rol2) delete sem.asignaciones[`p${p.id}_2`];
  Object.assign(p, { titulo, minutos, consejo: !!consejo });
}

export function quitarParte(e, semanaId, parteId) {
  const sem = buscarSemana(e, semanaId);
  if (!sem) throw new Error('Semana no encontrada');
  const id = Number(parteId);
  delete sem.asignaciones[`p${id}_1`];
  delete sem.asignaciones[`p${id}_2`];
  sem.partes = sem.partes.filter((p) => p.id !== id);
  renumerar(sem);
}

export function agregarParte(e, semanaId, { seccion, titulo, minutos, ayudante }) {
  if (![TESOROS, MAESTROS, VIDA].includes(seccion)) throw new Error('Sección inválida');
  titulo = (titulo || '').trim();
  minutos = Number(minutos);
  if (!titulo || !(minutos > 0 && minutos <= 60)) throw new Error('Revisa el título y los minutos (1 a 60).');
  const sem = buscarSemana(e, semanaId);
  if (!sem) throw new Error('Semana no encontrada');
  // Se agrega al final de su sección; en Vida cristiana, antes del estudio bíblico.
  const deSeccion = sem.partes.filter((p) => p.seccion === seccion);
  let numero;
  if (seccion === VIDA) {
    const estudio = deSeccion.filter((p) => esEstudio(p.titulo)).map((p) => p.numero);
    numero = estudio.length ? Math.min(...estudio) - 0.5 : 999;
  } else {
    numero = Math.max(0, ...deSeccion.map((p) => p.numero)) + 0.5;
  }
  sem.partes.push({
    id: nuevoId(e), numero, seccion, titulo, minutos, consejo: seccion === MAESTROS,
    rol1: seccion === MAESTROS ? 'Estudiante' : '', rol2: ayudante ? 'Ayudante' : null,
  });
  renumerar(sem);
}

// ── Hermanos ─────────────────────────────────────────────────────────────

const limpiarNombre = (n) => (n || '').replace(/\s+/g, ' ').trim();

export function agregarPersona(e, nombre) {
  nombre = limpiarNombre(nombre);
  if (!nombre) throw new Error('Escribe un nombre');
  const existe = e.personas.find((p) => p.nombre === nombre);
  if (existe) existe.activo = true;
  else e.personas.push({ id: nuevoId(e), nombre, activo: true });
}

export function editarPersona(e, id, { nombre, activo }) {
  nombre = limpiarNombre(nombre);
  if (!nombre) throw new Error('Escribe un nombre');
  const p = e.personas.find((x) => x.id === Number(id));
  if (!p) throw new Error('No encontré a esa persona');
  if (e.personas.some((x) => x.nombre === nombre && x !== p)) throw new Error('Ya existe alguien con ese nombre');
  if (p.nombre !== nombre) {
    // Corrección de nombre: se corrige también en lo ya asignado.
    for (const s of e.semanas) {
      for (const k of Object.keys(s.asignaciones)) if (s.asignaciones[k] === p.nombre) s.asignaciones[k] = nombre;
    }
  }
  p.nombre = nombre;
  p.activo = !!activo;
}

// Cuántas asignaciones tiene cada nombre y en qué semana fue la última.
export function historial(e) {
  const h = {};
  for (const s of e.semanas) {
    for (const n of Object.values(s.asignaciones)) {
      const x = (h[n] ||= { veces: 0, ultima: null });
      x.veces++;
      if (!x.ultima || s.fecha_inicio > x.ultima) x.ultima = s.fecha_inicio;
    }
  }
  return h;
}

// ── Quién puede hacer cada puesto ────────────────────────────────────────
// Cada hermano tiene: sexo 'H' (hermano) | 'M' (hermana) | null (sin clasificar),
// cargo 'anciano' | 'ministerial' | null, y lector (lector del estudio bíblico).

export const CARGOS = { anciano: 'Anciano', ministerial: 'Siervo ministerial' };

// Requisito de cada puesto:
//   anciano  presidente (los ministeriales quedan aparte, como excepción)
//   cargo    ancianos y ministeriales: Tesoros 1-2, Vida cristiana, conductor, oración final
//   varon    cualquier hermano: lectura de la Biblia, oración inicial, discursos de Maestros
//   lector   los marcados como lectores del estudio
//   todos    estudiante y ayudante de Seamos mejores maestros
export const REQUISITOS = {
  anciano: 'solo ancianos',
  cargo: 'solo ancianos y siervos ministeriales',
  varon: 'solo hermanos varones',
  lector: 'solo los lectores del estudio',
  todos: '',
};

export function requisito(clave, parte) {
  if (clave === 'presidente') return 'anciano';
  if (clave === 'oracion_inicio') return 'varon';
  if (clave === 'oracion_final') return 'cargo';
  if (!parte) return 'todos';
  const segundo = clave.endsWith('_2');
  if (parte.seccion === TESOROS) return parte.rol1 === 'Estudiante' ? 'varon' : 'cargo';
  if (parte.seccion === MAESTROS) {
    if (segundo) return 'todos';
    return parte.titulo.toLowerCase().startsWith('discurso') ? 'varon' : 'todos';
  }
  if (segundo) return parte.rol2 === 'Lector' ? 'lector' : 'cargo';
  return 'cargo';
}

// true / false, o null si la persona todavía no está clasificada.
export function cumple(persona, req) {
  if (!persona || req === 'todos') return true;
  if (!persona.sexo) return null;
  if (req === 'varon') return persona.sexo === 'H';
  if (req === 'anciano') return persona.cargo === 'anciano';
  if (req === 'cargo') return persona.cargo === 'anciano' || persona.cargo === 'ministerial';
  if (req === 'lector') return !!persona.lector && persona.sexo === 'H';
  return true;
}

export function editarDatosPersona(e, id, cambios) {
  const p = e.personas.find((x) => x.id === Number(id));
  if (!p) throw new Error('No encontré a esa persona');
  if ('sexo' in cambios) {
    if (![null, 'H', 'M'].includes(cambios.sexo)) throw new Error('Valor inválido');
    p.sexo = cambios.sexo;
  }
  if ('cargo' in cambios) {
    if (![null, 'anciano', 'ministerial'].includes(cambios.cargo)) throw new Error('Valor inválido');
    p.cargo = cambios.cargo;
  }
  if ('lector' in cambios) p.lector = !!cambios.lector;
  // Una hermana no tiene cargo ni lee en el estudio.
  if (p.sexo === 'M') { p.cargo = null; p.lector = false; }
}

// Sugerencia de hermano/hermana por el nombre. Es solo una ayuda: se revisa en Hermanos.
const NOMBRES_M = new Set(('anghely eillen emily haydee helibet hellen katherine marjorie pilar vivian isabel ' +
  'raquel ruth esther ester carmen mercedes dolores beatriz ines inés belen belén rocio rocío soledad ' +
  'luz paz noemi noemí abigail miriam sarai sarahi raquel jasmin jazmin yasmin evelyn jennifer karen ' +
  'nicole ingrid lilian lillian marisol maribel gisel giselle ivonne yvonne madeleine scarlett ' +
  'monserrat montserrat consuelo rosario amparo pilar elizabeth judith edith ximena jimena').split(' '));
const NOMBRES_H = new Set(('bautista joshua luca noe jorge felipe enrique jose vicente alexis ' +
  'josue dante simone andre rene jaime').split(' '));

// Hermana casada («Alejandra de Rojas») → hermana; nombres conocidos; si no,
// termina en «a» → hermana, en «o» o consonante → hermano; lo dudoso queda sin clasificar.
export function sugerirSexo(nombre) {
  if (/\sde\s+\p{Lu}/u.test(nombre)) return 'M';
  const primero = ordenAlfabetico(nombre.split(/\s+/)[0] || '');
  if (!primero) return null;
  if (NOMBRES_M.has(primero)) return 'M';
  if (NOMBRES_H.has(primero)) return 'H';
  if (primero.endsWith('a')) return 'M';
  if (/[obcdfghjklmnpqrstvwxz]$/.test(primero)) return 'H';
  return null; // termina en e, i, u, y: puede ser cualquiera
}

// Clasifica a quienes no tienen sexo marcado. Devuelve cuántos se sugirieron.
export function sugerirSexos(e) {
  let n = 0;
  for (const p of e.personas) {
    if (p.sexo) continue;
    const s = sugerirSexo(p.nombre);
    if (s) { p.sexo = s; n++; }
  }
  return n;
}

// Quienes leyeron la Biblia o fueron estudiante/ayudante en Maestros esa semana.
function estudiantesDe(sem) {
  if (!sem || sem.tipo === 'sin_reunion') return new Set();
  const nombres = new Set();
  for (const p of sem.partes) {
    const esLectura = p.seccion === TESOROS && p.rol1 === 'Estudiante';
    if (!esLectura && p.seccion !== MAESTROS) continue;
    for (const k of [`p${p.id}_1`, `p${p.id}_2`]) if (sem.asignaciones[k]) nombres.add(sem.asignaciones[k]);
  }
  return nombres;
}

function sumarDias(iso, dias) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Para la regla de semanas seguidas: nombre -> 'anterior' | 'siguiente' (o ambas).
export function vecinosDe(e, sem) {
  const salida = {};
  for (const [dias, cual] of [[-7, 'anterior'], [7, 'siguiente']]) {
    const otra = e.semanas.find((s) => s.fecha_inicio === sumarDias(sem.fecha_inicio, dias));
    if (!otra) continue;
    for (const n of estudiantesDe(otra)) salida[n] = salida[n] ? 'ambas' : cual;
  }
  return salida;
}

export function guardarConfig(e, { congregacion, hora_inicio }) {
  hora_inicio = (hora_inicio || '').trim();
  if (!/^\d{1,2}:\d{2}$/.test(hora_inicio)) throw new Error('La hora debe ser HH:MM, por ejemplo 19:30');
  e.config.congregacion = (congregacion || '').trim();
  e.config.hora_inicio = hora_inicio;
}

// ── Armar la semana para mostrar ─────────────────────────────────────────

const hhmm = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

function aMinutos(txt) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(txt || '');
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// Devuelve la semana con sus filas (hora, texto, puestos) y los avisos.
// Con `e` (el estado completo) revisa también quién puede hacer cada puesto y la
// regla de semanas seguidas.
export function armarSemana(sem, cfg, e = null) {
  const asign = sem.asignaciones;
  const partes = [...sem.partes].sort((a, b) => a.numero - b.numero);
  const puesto = (clave, rol, parte = null) => ({
    clave, rol, nombre: asign[clave] || '', req: requisito(clave, parte),
    // Lectura de la Biblia y Seamos mejores maestros: regla de semanas seguidas.
    estudiante: !!parte && (parte.seccion === MAESTROS || (parte.seccion === TESOROS && parte.rol1 === 'Estudiante')),
  });

  let horaTxt = sem.hora_inicio || cfg.hora_inicio || '19:30';
  let t = aMinutos(horaTxt);
  if (t === null) { horaTxt = '19:30'; t = aMinutos(horaTxt); }
  const inicio = t;
  const visita = sem.tipo === 'visita';

  const filas = [];
  const fila = (tipo, datos) => filas.push({ tipo, hora: '', texto: '', minutos: null, seccion: '', parte_id: null, puestos: [], visita: false, ...datos });

  fila('cancion', { hora: hhmm(t), texto: `Canción ${sem.cancion_inicio || '—'}`, puestos: [puesto('oracion_inicio', 'Oración')] });
  t += 5;
  fila('texto', { hora: hhmm(t), texto: 'Palabras de introducción', minutos: 1 });
  t += 1;

  for (const [seccion, titulo] of SECCIONES) {
    fila('seccion', { texto: titulo, seccion });
    if (seccion === VIDA) {
      fila('cancion', { hora: hhmm(t), texto: `Canción ${sem.cancion_medio || '—'}`, seccion });
      t += 5;
    }
    for (const p of partes.filter((x) => x.seccion === seccion)) {
      let tituloParte = p.titulo, minutos = p.minutos;
      let puestos = [puesto(`p${p.id}_1`, p.rol1, p)];
      if (p.rol2) puestos.push(puesto(`p${p.id}_2`, p.rol2, p));
      let esVisita = false;
      if (visita && esEstudio(p.titulo)) {
        tituloParte = sem.so_titulo || 'Discurso del superintendente de circuito';
        minutos = 30;
        puestos = [{ clave: 'so_nombre', rol: '', nombre: sem.so_nombre || '' }];
        esVisita = true;
      }
      fila('parte', { hora: hhmm(t), texto: `${p.numero}. ${tituloParte}`, minutos, seccion, parte_id: p.id, puestos, visita: esVisita });
      t += minutos + (p.consejo ? 1 : 0);
    }
  }

  fila('texto', { hora: hhmm(t), texto: 'Palabras de conclusión', minutos: 3 });
  t += 3;
  const cancionFinal = visita && sem.so_cancion ? sem.so_cancion : sem.cancion_final;
  fila('cancion', { hora: hhmm(t), texto: `Canción ${cancionFinal || '—'}`, puestos: [puesto('oracion_final', 'Oración')] });

  const duracion = t - inicio;
  const avisos = [];
  if (sem.tipo !== 'sin_reunion' && duracion !== DURACION_NORMAL) {
    avisos.push(`La canción final queda a las ${hhmm(t)}: la reunión dura ${duracion} min antes de la canción ` +
      `final (lo normal son ${DURACION_NORMAL}). Revisa los minutos de las partes.`);
  }

  // Nombres repetidos en la semana (presidente + oración final es lo habitual).
  const usados = {};
  const presidente = asign.presidente || '';
  for (const f of filas) {
    for (const pu of f.puestos) {
      const n = pu.nombre;
      if (!n || pu.clave === 'so_nombre') continue;
      if (pu.clave === 'oracion_final' && n === presidente) continue;
      (usados[n] ||= []).push(pu.clave);
    }
  }
  if (presidente) (usados[presidente] ||= []).push('presidente');
  const repetidos = Object.keys(usados).filter((n) => usados[n].length > 1).sort();

  // Quién puede hacer cada puesto y semanas seguidas (solo con el estado completo).
  let vecinos = {};
  if (e && sem.tipo !== 'sin_reunion') {
    const porNombre = Object.fromEntries(e.personas.map((p) => [p.nombre, p]));
    const revisar = (pu, donde) => {
      if (!pu.nombre || pu.clave === 'so_nombre') return;
      if (cumple(porNombre[pu.nombre], pu.req) === false) {
        pu.noCumple = true;
        avisos.push(`${pu.nombre} no corresponde a «${donde}»: ${REQUISITOS[pu.req]}.`);
      }
    };
    revisar({ clave: 'presidente', nombre: presidente, req: 'anciano' }, 'Presidente');
    for (const f of filas) {
      for (const pu of f.puestos) revisar(pu, pu.rol === 'Oración' ? `Oración (${f.texto})` : f.texto + (pu.rol ? ` · ${pu.rol}` : ''));
    }
    vecinos = vecinosDe(e, sem);
    const yaAvisados = new Set();
    for (const f of filas) {
      for (const pu of f.puestos) {
        const cual = pu.estudiante && pu.nombre && vecinos[pu.nombre];
        if (!cual) continue;
        pu.semanaSeguida = cual;
        if (yaAvisados.has(pu.nombre)) continue;
        yaAvisados.add(pu.nombre);
        const cuando = cual === 'ambas' ? 'la semana anterior y la siguiente' : `la semana ${cual}`;
        avisos.push(`${pu.nombre} también participa ${cuando} (lectura de la Biblia o Seamos mejores maestros).`);
      }
    }
  }

  const total = filas.reduce((a, f) => a + f.puestos.length, 0) + 1;
  const llenos = filas.reduce((a, f) => a + f.puestos.filter((p) => p.nombre).length, 0) + (presidente ? 1 : 0);

  return {
    ...sem,
    titulo: `${sem.fechas} | ${sem.lectura}`,
    cancion_final_guia: sem.cancion_final,
    hora_inicio: horaTxt,
    hora_inicio_propia: sem.hora_inicio,
    hora_fin: hhmm(t),
    presidente,
    filas,
    partes,
    avisos,
    repetidos,
    vecinos,
    pendientes: sem.tipo === 'sin_reunion' ? 0 : total - llenos,
  };
}

// ── Meses ────────────────────────────────────────────────────────────────

export function nombreMes(ym) {
  const [anio, mes] = ym.split('-').map(Number);
  const n = NOMBRE_MES[mes];
  return `${n[0]}${n.slice(1).toLowerCase()} ${anio}`;
}

// Meses con semanas cargadas. Una semana pertenece al mes en que empieza.
export function mesesDisponibles(e) {
  const cuenta = {};
  for (const s of e.semanas) cuenta[s.fecha_inicio.slice(0, 7)] = (cuenta[s.fecha_inicio.slice(0, 7)] || 0) + 1;
  return Object.keys(cuenta).sort().map((ym) => ({ ym, nombre: nombreMes(ym), semanas: cuenta[ym] }));
}

export function semanasDelMes(e, ym) {
  return e.semanas.filter((s) => s.fecha_inicio.startsWith(ym + '-'))
    .sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio))
    .map((s) => armarSemana(s, e.config, e));
}

export function mesActualOProximo(e, hoy = new Date()) {
  const meses = mesesDisponibles(e).map((m) => m.ym);
  if (!meses.length) return null;
  const actual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  return meses.find((ym) => ym >= actual) || meses[meses.length - 1];
}
