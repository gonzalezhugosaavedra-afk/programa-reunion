// Prueba las reglas de asignación (quién puede hacer cada puesto, oración final
// del presidente, semanas seguidas, sugerencia hermano/hermana). Datos inventados.
//   node tests/probar_reglas.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const P = await import(pathToFileURL(path.join(aqui, '../js/programa.js')).href);
let fallas = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + m); if (!c) fallas++; };

// Sugerencia por nombre
const casos = {
  'Alejandra de Rojas': 'M', 'Pedro Soto': 'H', 'Katherine Díaz': 'M', 'Hassiel Muñoz': 'H', 'Axel León': 'H',
  'Ramón Pérez': 'H', 'Haydee Vera': 'M', 'Pilar Gómez': 'M', 'Jorge Castro': 'H', 'Zunilda Mora': 'M',
  'Felipe Rivas': 'H', 'Sebastián Lagos': 'H', 'Noemi Ruiz': 'M', 'Darcy Ríos': null,
};
for (const [n, esperado] of Object.entries(casos)) ok(P.sugerirSexo(n) === esperado, `sugerirSexo(${n}) = ${P.sugerirSexo(n)}`);

// Estado de prueba con la guía nov-dic 2026
const esperado = JSON.parse(fs.readFileSync(path.join(aqui, '../../docs/referencia/mwb_S_202611.esperado.json'), 'utf8'));
const e = P.estadoVacio();
for (const s of esperado) {
  P.guardarSemana(e, {
    fecha_inicio: s.fecha_inicio, fechas: s.fechas, lectura: s.lectura,
    cancion_inicio: s.canciones[0], cancion_medio: s.canciones[1], cancion_final: s.canciones[2],
    partes: s.partes.map(([seccion, numero, titulo, minutos, auditorio]) => ({ seccion, numero, titulo, minutos, auditorio })),
  }, 'mwb_S_202611.pdf');
}
const gente = [
  ['Anciano Uno', 'H', 'anciano', false], ['Anciano Dos', 'H', 'anciano', true], ['Siervo Uno', 'H', 'ministerial', false],
  ['Hermano Uno', 'H', null, true], ['Hermano Dos', 'H', null, false], ['Hermana Una', 'M', null, false], ['Hermana Dos', 'M', null, false],
  ['Sin Marcar', null, null, false],
];
for (const [nombre, sexo, cargo, lector] of gente) {
  P.agregarPersona(e, nombre);
  const p = e.personas.find((x) => x.nombre === nombre);
  P.editarDatosPersona(e, p.id, { sexo, cargo, lector });
}
const per = (n) => e.personas.find((p) => p.nombre === n);

// Requisitos por puesto
const s1 = e.semanas[0];
const parte = (num) => s1.partes.find((p) => p.numero === num);
const req = (num, k = 1) => P.requisito(`p${parte(num).id}_${k}`, parte(num));
ok(P.requisito('presidente') === 'anciano', 'presidente: solo ancianos');
ok(P.requisito('oracion_inicio') === 'varon', 'oración inicial: varones');
ok(P.requisito('oracion_final') === 'cargo', 'oración final: ancianos y ministeriales');
ok(req(1) === 'cargo' && req(2) === 'cargo', 'Tesoros 1-2: ancianos y ministeriales');
ok(req(3) === 'varon', 'Lectura de la Biblia: varones');
ok(req(4) === 'todos' && req(4, 2) === 'todos', 'Maestros: estudiante y ayudante cualquiera');
ok(req(7) === 'cargo', 'Vida cristiana: ancianos y ministeriales');
ok(req(8) === 'cargo' && req(8, 2) === 'lector', 'Estudio: conductor con cargo, lector marcado');
const discurso = e.semanas[1].partes.find((p) => p.titulo === 'Discurso');
ok(P.requisito(`p${discurso.id}_1`, discurso) === 'varon', 'Discurso de Maestros: solo varones');

ok(P.cumple(per('Siervo Uno'), 'anciano') === false && P.cumple(per('Anciano Uno'), 'anciano') === true, 'cumple: anciano');
ok(P.cumple(per('Hermana Una'), 'varon') === false && P.cumple(per('Hermano Dos'), 'varon') === true, 'cumple: varón');
ok(P.cumple(per('Sin Marcar'), 'varon') === null, 'cumple: sin clasificar = null');
ok(P.cumple(per('Hermano Uno'), 'lector') === true && P.cumple(per('Hermano Dos'), 'lector') === false, 'cumple: lector');
P.editarDatosPersona(e, per('Hermano Uno').id, { sexo: 'M' });
ok(per('Hermano Uno').lector === false && per('Hermano Uno').cargo === null, 'hermana pierde cargo y lector');
P.editarDatosPersona(e, per('Hermano Uno').id, { sexo: 'H', lector: true });

// Oración final sigue al presidente
P.asignar(e, s1.id, 'presidente', 'Anciano Uno');
ok(s1.asignaciones.oracion_final === 'Anciano Uno', 'oración final = presidente al elegirlo');
P.asignar(e, s1.id, 'presidente', 'Anciano Dos');
ok(s1.asignaciones.oracion_final === 'Anciano Dos', 'cambia junto con el presidente');
P.asignar(e, s1.id, 'oracion_final', 'Siervo Uno');
P.asignar(e, s1.id, 'presidente', 'Anciano Uno');
ok(s1.asignaciones.oracion_final === 'Siervo Uno', 'si se cambió a mano, no se pisa');
let a = P.armarSemana(s1, e.config, e);
ok(!a.repetidos.length, 'presidente + oración final no cuenta como repetido');

// Fuera de regla
P.asignar(e, s1.id, `p${parte(3).id}_1`, 'Hermana Una');
a = P.armarSemana(s1, e.config, e);
ok(a.avisos.some((x) => x.startsWith('Hermana Una no corresponde')), 'aviso: hermana en la lectura');
P.asignar(e, s1.id, `p${parte(3).id}_1`, 'Sin Marcar');
a = P.armarSemana(s1, e.config, e);
ok(!a.avisos.some((x) => x.includes('no corresponde')), 'sin clasificar: no avisa');

// Semanas seguidas (incluye ayudante y lectura; cruza de mes 30 nov -> 7 dic)
const s2 = e.semanas[1];
const est = (s, num, k = 1) => `p${s.partes.find((p) => p.numero === num).id}_${k}`;
P.asignar(e, s1.id, est(s1, 4, 2), 'Hermana Dos');
P.asignar(e, s2.id, est(s2, 3), 'Hermano Dos');
P.asignar(e, s2.id, est(s2, 5), 'Hermana Dos');
a = P.armarSemana(s2, e.config, e);
ok(a.avisos.some((x) => x.startsWith('Hermana Dos también participa la semana anterior')), 'aviso semana anterior (ayudante -> estudiante)');
ok(a.vecinos['Hermana Dos'] === 'anterior', 'marca en el menú: semana anterior');
const a1 = P.armarSemana(s1, e.config, e);
ok(a1.avisos.some((x) => x.startsWith('Hermana Dos también participa la semana siguiente')), 'aviso en la otra semana: siguiente');
const nov30 = e.semanas.find((s) => s.fecha_inicio === '2026-11-30'), dic7 = e.semanas.find((s) => s.fecha_inicio === '2026-12-07');
P.asignar(e, nov30.id, est(nov30, 3), 'Hermano Dos');
P.asignar(e, dic7.id, est(dic7, 3), 'Hermano Dos');
ok(P.armarSemana(dic7, e.config, e).avisos.some((x) => x.startsWith('Hermano Dos también participa la semana anterior')), 'regla cruza de noviembre a diciembre');
P.asignar(e, s2.id, est(s2, 7), 'Siervo Uno');
P.asignar(e, s1.id, est(s1, 7), 'Siervo Uno');
ok(!P.armarSemana(s2, e.config, e).avisos.some((x) => x.startsWith('Siervo Uno también')), 'Vida cristiana no cuenta para semanas seguidas');
nov30.tipo = 'sin_reunion';
ok(!P.armarSemana(dic7, e.config, e).avisos.some((x) => x.startsWith('Hermano Dos también')), 'semana sin reunión no cuenta');

console.log(fallas ? `${fallas} FALLAS` : 'Todas las reglas OK');
process.exitCode = fallas ? 1 : 0;
