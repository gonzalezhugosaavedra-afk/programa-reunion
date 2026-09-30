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
  if (nombre) sem.asignaciones[clave] = nombre;
  else delete sem.asignaciones[clave];
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
export function armarSemana(sem, cfg) {
  const asign = sem.asignaciones;
  const partes = [...sem.partes].sort((a, b) => a.numero - b.numero);
  const puesto = (clave, rol) => ({ clave, rol, nombre: asign[clave] || '' });

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
      let puestos = [puesto(`p${p.id}_1`, p.rol1)];
      if (p.rol2) puestos.push(puesto(`p${p.id}_2`, p.rol2));
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
    .map((s) => armarSemana(s, e.config));
}

export function mesActualOProximo(e, hoy = new Date()) {
  const meses = mesesDisponibles(e).map((m) => m.ym);
  if (!meses.length) return null;
  const actual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  return meses.find((ym) => ym >= actual) || meses[meses.length - 1];
}
