// Prueba el lector JS con una guía y lo compara con el lector Python (core/lector_pdf.py).
// Uso (desde la carpeta pwa, con Node 20+):
//   node tests/probar_lector.mjs ../docs/referencia/mwb_S_202609.pdf            -> muestra lo leído
//   node tests/probar_lector.mjs guia.pdf referencia.json                        -> compara
// referencia.json se saca con la app de escritorio (ver CLAUDE.md, «Probar el lector»).
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const pdfjs = await import(pathToFileURL(path.join(aqui, '../js/vendor/pdf.min.mjs')).href);
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(path.join(aqui, '../js/vendor/pdf.worker.min.mjs')).href;
const { leerGuia, problemas } = await import(pathToFileURL(path.join(aqui, '../js/lector.js')).href);

const [pdf, ref] = process.argv.slice(2);
const semanas = await leerGuia(pdfjs, new Uint8Array(fs.readFileSync(pdf)));
const mio = semanas.map((s) => ({
  fecha_inicio: s.fecha_inicio, fechas: s.fechas, lectura: s.lectura,
  canciones: [s.cancion_inicio, s.cancion_medio, s.cancion_final],
  partes: s.partes.map((p) => [p.seccion, p.numero, p.titulo, p.minutos, p.auditorio]),
  avisos: problemas(s),
}));
if (!ref) {
  for (const s of mio) {
    console.log(`\n${s.fecha_inicio}  ${s.fechas} | ${s.lectura}  canciones ${s.canciones.join('/')}`);
    for (const p of s.partes) console.log(`   ${p[0].padEnd(9)} ${String(p[1]).padStart(2)}. ${p[2]} (${p[3]})${p[4] ? ' [auditorio]' : ''}`);
    for (const a of s.avisos) console.log('   AVISO:', a);
  }
} else {
  const a = JSON.stringify(mio, null, 1).split('\n');
  const b = JSON.stringify(JSON.parse(fs.readFileSync(ref, 'utf8')), null, 1).split('\n');
  let dif = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i] && dif++ < 20) console.log(`JS: ${a[i]}\nPY: ${b[i]}`);
  }
  console.log(dif ? `${dif} diferencias` : `IGUAL a Python (${mio.length} semanas)`);
  process.exitCode = dif ? 1 : 0;
}
