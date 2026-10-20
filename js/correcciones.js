// Correcciones automáticas de datos ya guardados en el dispositivo.
//
// Guía nov-dic 2026 (mwb_S_202611.pdf): el lector de la versión anterior leía
// mal las semanas que caben en una sola página con el encabezado a la derecha
// (ver lector.js → encabezadoPrimero) y el «7.“Te salvarás…”» sin espacio.
// Quien ya había cargado esa guía y asignado nombres no tiene que volver a
// subirla: al abrir la app se completan las partes y canciones que faltaban.
//
// Solo se cambia un dato si todavía tiene el valor erróneo que dejó el lector
// viejo (o está vacío): lo que se haya corregido a mano no se toca. Las partes
// existentes conservan su id, así que los nombres asignados no se pierden.
// Es idempotente: correrla dos veces no cambia nada la segunda.

import { consejoPorDefecto, renumerar, rolesPorDefecto, TESOROS, VIDA } from './programa.js';

const GUIA_2026_11 = [
  { fecha: '2026-11-02', canciones: { cancion_final: [150, 33] } },
  {
    fecha: '2026-11-09',
    canciones: { cancion_inicio: [null, 98], cancion_final: [null, 150] },
    tesoros: [
      ['No seamos como Sedequías', 10],
      ['Busquemos perlas escondidas', 10],
      ['Lectura de la Biblia', 4],
    ],
  },
  { fecha: '2026-11-30', canciones: { cancion_final: [7, 134] } },
  {
    fecha: '2026-12-07',
    canciones: { cancion_inicio: [null, 71], cancion_final: [null, 7] },
    tesoros: [
      ['Tenemos motivos para predicar sin miedo', 10],
      ['Busquemos perlas escondidas', 10],
      ['Lectura de la Biblia', 4],
    ],
  },
  {
    fecha: '2026-12-28',
    titulo: {
      seccion: VIDA,
      malo: 'Nuestras donaciones le dan gloria al gran nombre de Jehová',
      bueno: '“Te salvarás a ti mismo y también a los que te escuchan”',
    },
  },
];

// Devuelve las fechas de las semanas corregidas (vacío si no había nada que corregir).
export function corregirDatos(e) {
  const corregidas = [];
  for (const c of GUIA_2026_11) {
    const sem = e.semanas.find((s) => s.fecha_inicio === c.fecha);
    if (!sem) continue;
    let cambio = false;

    for (const [campo, [malo, bueno]] of Object.entries(c.canciones || {})) {
      if (sem[campo] === malo || sem[campo] == null) {
        if (sem[campo] !== bueno) { sem[campo] = bueno; cambio = true; }
      }
    }

    if (c.tesoros && !sem.partes.some((p) => p.seccion === TESOROS)) {
      c.tesoros.forEach(([titulo, minutos], i) => {
        const [rol1, rol2] = rolesPorDefecto(TESOROS, titulo, false);
        sem.partes.push({
          id: e.sig++, numero: i + 1 - 0.5, seccion: TESOROS, titulo, minutos,
          consejo: consejoPorDefecto(TESOROS, titulo, false), rol1, rol2,
        });
      });
      renumerar(sem);
      cambio = true;
    }

    if (c.titulo) {
      const p = sem.partes.find((x) => x.seccion === c.titulo.seccion && x.titulo === c.titulo.malo);
      if (p) { p.titulo = c.titulo.bueno; cambio = true; }
    }

    if (cambio) corregidas.push(c.fecha);
  }
  return corregidas;
}
