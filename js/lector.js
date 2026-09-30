// Lee la «Guía de actividades para la reunión Vida y Ministerio Cristianos»
// (mwb_S_AAAAMM.pdf) y devuelve las semanas con sus partes.
// Es la versión JavaScript de core/lector_pdf.py (misma lógica y mismas reglas).
//
// La guía está compuesta letra por letra y las tildes son glifos aparte
// («Canci´on»). pdf.js entrega esos pedazos con su posición; aquí se rearman
// líneas y bloques como los de PyMuPDF:
//   - una palabra termina donde hay un hueco real entre letras (> 0,2 × tamaño);
//   - cada tilde se pega a la letra que tiene debajo;
//   - cada página se lee a dos columnas: primero la izquierda, después la derecha.
// El worker de pdf.js va con los umbrales de espacio subidos a 0,2 (ver
// vendor/LEEME.txt): con los de fábrica metía espacios en los títulos
// espaciados («SEP T I EMB R E»).

export const MESES = {
  ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6, JULIO: 7, AGOSTO: 8,
  SEPTIEMBRE: 9, SETIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12,
};
export const NOMBRE_MES = Object.fromEntries(
  Object.entries(MESES).filter(([k]) => k !== 'SETIEMBRE').map(([k, v]) => [v, k]));

export const TESOROS = 'tesoros', MAESTROS = 'maestros', VIDA = 'vida';

const MES_RE = Object.keys(MESES).join('|');
// Encabezado ya sin espacios: "7-13DESEPTIEMBREJEREMÍAS32,33"
const RE_ENCABEZADO = new RegExp(
  `^(\\d{1,2})(?:DE(${MES_RE}))?(?:-|–|A)(\\d{1,2})DE(${MES_RE})(.*)$`);
const RE_PARTE = /^(\d{1,2})\.\s+(.+?)\s*\((\d{1,2})\s*mins?\.\)(.*)$/;
const RE_CANCION = /Canción\s+(\d{1,3})/;
// Portada ya sin espacios: "SEPTIEMBREYOCTUBREDE2026"
const RE_TITULO_PDF = new RegExp(`(${MES_RE})Y(${MES_RE})DE(\\d{4})`);

// Tildes sueltas -> marca combinable.
const ACENTOS = { '´': '́', '`': '̀', '˜': '̃', '¨': '̈', 'ˆ': '̂', '^': '̂' };

const sinControl = (t) => t.normalize('NFC').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, ' ');

function limpiar(texto) {
  return sinControl(texto)
    .replace(/(\p{L})-\n(\p{L})/gu, '$1$2') // "misericordio-\nso"
    .replace(/[\u2009\u00a0]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Del PDF a bloques de texto ───────────────────────────────────────────

function glifos(items, altoPagina) {
  const letras = [], tildes = [];
  for (const it of items) {
    // Se descartan los íconos y las rayas del diseño (caracteres de control en el PDF).
    if (!it.str || !it.str.replace(/[\x00-\x1f\x7f]/g, '').trim()) continue;
    const [, , c, d, e, f] = it.transform;
    const g = { s: it.str, x: e, y: altoPagina - f, w: it.width, t: Math.hypot(c, d) || it.height || 10 };
    if (g.s.length === 1 && ACENTOS[g.s] && g.w < g.t * 0.5) tildes.push(g);
    else letras.push(g);
  }
  // Cada tilde se pega a la letra que tiene justo debajo.
  for (const a of tildes) {
    const cx = a.x + a.w / 2;
    let mejor = null;
    for (const g of letras) {
      if (cx < g.x - 0.5 || cx > g.x + g.w + 0.5) continue;
      const dy = g.y - a.y;
      if (dy < -g.t * 0.3 || dy > g.t * 1.2) continue;
      if (!mejor || Math.abs(dy) < Math.abs(mejor.y - a.y)) mejor = g;
    }
    if (!mejor) continue;
    const chars = [...mejor.s];
    const i = Math.max(0, Math.min(chars.length - 1, Math.floor((cx - mejor.x) / (mejor.w / chars.length))));
    const base = chars[i] === 'ı' ? 'i' : chars[i];
    chars[i] = (base + ACENTOS[a.s]).normalize('NFC');
    mejor.s = chars.join('');
  }
  return letras;
}

// Junta los glifos de una fila en texto, con espacio donde hay hueco real.
function unir(fila) {
  let txt = '';
  let fin = null;
  for (const g of fila) {
    if (fin !== null && g.x - fin > g.t * 0.2 && !txt.endsWith(' ') && !g.s.startsWith(' ')) txt += ' ';
    txt += g.s;
    fin = Math.max(fin ?? -Infinity, g.x + g.w);
  }
  return txt;
}

// Bloques de una página en orden de lectura: columna izquierda y luego derecha.
export function bloquesPagina(items, ancho, alto) {
  const letras = glifos(items, alto).sort((a, b) => a.y - b.y || a.x - b.x);
  const medio = ancho / 2;

  // Filas: glifos con la misma línea base.
  const filas = [];
  for (const g of letras) {
    // Tolerancia chica: las dos columnas tienen líneas a ~2 pt de distancia.
    const f = filas.find((r) => Math.abs(r.y - g.y) <= 1);
    if (f) f.gs.push(g); else filas.push({ y: g.y, gs: [g] });
  }

  // Segmentos: una fila se corta en dos si cruza el espacio entre columnas.
  const segs = [];
  for (const f of filas) {
    const gs = f.gs.sort((a, b) => a.x - b.x);
    // El encabezado de la semana es ancho y cruza el centro: no se corta por columna.
    const encabezado = RE_ENCABEZADO.test(unir(gs).replace(/\s+/g, '').toUpperCase());
    let actual = [gs[0]];
    for (let i = 1; i < gs.length; i++) {
      const prev = actual[actual.length - 1];
      const finPrev = prev.x + prev.w;
      const hueco = gs[i].x - finPrev;
      // También se corta ante un hueco muy grande (número de página al margen).
      if ((!encabezado && finPrev < medio && gs[i].x > medio && hueco > gs[i].t * 1.5) || hueco > gs[i].t * 6) {
        segs.push(actual);
        actual = [];
      }
      actual.push(gs[i]);
    }
    segs.push(actual);
  }

  const info = segs.map((gs) => ({
    col: gs[0].x < medio - 20 ? 0 : 1,
    y: Math.min(...gs.map((g) => g.y)),
    t: Math.max(...gs.map((g) => g.t)),
    texto: unir(gs),
  })).sort((a, b) => a.col - b.col || a.y - b.y);

  // Bloques: líneas seguidas de la misma columna, sin salto de párrafo.
  const bloques = [];
  let b = null;
  for (const s of info) {
    if (b && b.col === s.col && s.y - b.yUlt <= Math.max(b.tUlt, s.t) * 1.45) {
      b.lineas.push(s.texto);
    } else {
      b = { col: s.col, lineas: [s.texto] };
      bloques.push(b);
    }
    b.yUlt = s.y;
    b.tUlt = s.t;
  }
  return bloques.map((x) => x.lineas.join('\n'));
}

// ── Fechas ───────────────────────────────────────────────────────────────

function fechaInicio(m, anio, primerMes) {
  const d1 = Number(m[1]), d2 = Number(m[3]);
  const mes2 = MESES[m[4]];
  const mes1 = m[2] ? MESES[m[2]] : mes2;
  // Guía de enero-febrero que arranca con la última semana de diciembre.
  const anio1 = mes1 === 12 && primerMes === 1 ? anio - 1 : anio;
  const bonito = m[2] && mes1 !== mes2
    ? `${d1} DE ${NOMBRE_MES[mes1]} – ${d2} DE ${NOMBRE_MES[mes2]}`
    : `${d1} – ${d2} DE ${NOMBRE_MES[mes2]}`;
  const iso = `${anio1}-${String(mes1).padStart(2, '0')}-${String(d1).padStart(2, '0')}`;
  return [iso, bonito];
}

// "JEREMÍAS32,33" o "JEREMÍAS 32, 33" -> "JEREMÍAS 32, 33"
function arreglarLectura(t) {
  return t.replace(/\s+/g, ' ')
    .replace(/(\p{Lu})(\d)/gu, '$1 $2')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*,\s*/g, ', ')
    .trim();
}

// ── Lectura de la guía ───────────────────────────────────────────────────

// pdfjs: la librería pdf.js ya cargada. datos: Uint8Array/ArrayBuffer del PDF.
export async function leerGuia(pdfjs, datos) {
  const tarea = pdfjs.getDocument({ data: datos, isEvalSupported: false });
  const doc = await tarea.promise;
  try {
    const bloques = [];
    let anio = null, primerMes = null;
    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n);
      const vp = pagina.getViewport({ scale: 1 });
      const tc = await pagina.getTextContent();
      const bs = bloquesPagina(tc.items, vp.width, vp.height);
      if (anio === null && n <= 2) {
        const m = limpiar(bs.join('\n')).toUpperCase().replace(/\s+/g, '').match(RE_TITULO_PDF);
        if (m && MESES[m[1]]) { anio = Number(m[3]); primerMes = MESES[m[1]]; }
      }
      bloques.push(...bs);
    }
    if (anio === null) throw new Error('No encontré el título de la guía (p. ej. «SEPTIEMBRE Y OCTUBRE DE 2026»).');
    return armarSemanas(bloques, anio, primerMes);
  } finally {
    tarea.destroy();
  }
}

function armarSemanas(bloques, anio, primerMes) {
  const semanas = [];
  let actual = null, seccion = null, esperaFinal = false;

  for (const crudo0 of bloques) {
    const crudo = sinControl(crudo0);
    const lineas = crudo.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lineas.length) continue;
    const texto = limpiar(crudo);
    const cancion = texto.match(RE_CANCION);

    // Encabezado de semana: "7-13 DE SEPTIEMBRE  JEREMÍAS 32, 33"
    const junto = lineas[0].replace(/\s+/g, '').toUpperCase();
    const m = junto.match(RE_ENCABEZADO);
    if (m && m[5]) {
      const [iso, fechas] = fechaInicio(m, anio, primerMes);
      // La lectura se toma del texto con espacios (libros como «1 CORINTIOS»).
      const conEspacios = lineas[0].replace(/\s+/g, ' ');
      const mesFinal = m[4];
      const idx = conEspacios.toUpperCase().replace(/\s/g, '').indexOf(mesFinal) + mesFinal.length;
      let lectura = recortarPorLetras(conEspacios, idx);
      lectura = arreglarLectura(lectura || m[5]);
      actual = { fecha_inicio: iso, fechas, lectura, cancion_inicio: null, cancion_medio: null, cancion_final: null, partes: [] };
      semanas.push(actual);
      seccion = null;
      esperaFinal = false;
      if (cancion) actual.cancion_inicio = Number(cancion[1]);
      continue;
    }
    if (!actual) continue;

    const letras = texto.toUpperCase().replace(/[^A-ZÁÉÍÓÚÑ]/g, '');
    const corto = texto.length < 45;
    if (corto && letras.startsWith('TESOROS')) { seccion = TESOROS; continue; }
    if (corto && letras.startsWith('SEAMOS')) { seccion = MAESTROS; continue; }
    if (letras.startsWith('NUESTRAVIDA') || (corto && letras === 'NUESTRA')) {
      seccion = VIDA;
      if (cancion) actual.cancion_medio = Number(cancion[1]);
      continue;
    }

    if (texto.startsWith('Palabras de conclusión')) {
      // Puede aparecer antes que las partes de la columna derecha:
      // se asigna a la semana en curso igual.
      if (cancion) actual.cancion_final = Number(cancion[1]);
      else esperaFinal = true;
      continue;
    }

    // Canciones que quedaron en un bloque propio.
    if (cancion && texto.length < 60 && !RE_PARTE.test(texto)) {
      if (esperaFinal) { actual.cancion_final = Number(cancion[1]); esperaFinal = false; }
      else if (seccion === null && actual.cancion_inicio === null) actual.cancion_inicio = Number(cancion[1]);
      else if (seccion === VIDA && actual.cancion_medio === null && !actual.partes.some((p) => p.seccion === VIDA)) {
        actual.cancion_medio = Number(cancion[1]);
      }
    }

    const mp = texto.match(RE_PARTE);
    if (mp && seccion) {
      const numero = Number(mp[1]);
      if (actual.partes.some((p) => p.numero === numero)) continue;
      const titulo = mp[2].replace(/\s+/g, ' ').replace(/\s*\[\d+\]/g, '').trim(); // marcas de nota: "No se olviden [5] de…"
      actual.partes.push({
        seccion, numero, titulo, minutos: Number(mp[3]),
        auditorio: mp[4].toLowerCase().includes('auditorio'),
      });
    }
  }
  for (const s of semanas) s.partes.sort((a, b) => a.numero - b.numero);
  return semanas;
}

// Devuelve lo que sigue en `texto` después de las primeras `n` letras (sin contar espacios).
function recortarPorLetras(texto, n) {
  let vistos = 0;
  for (let i = 0; i < texto.length; i++) {
    if (vistos === n) return texto.slice(i).trim();
    if (!/\s/.test(texto[i])) vistos++;
  }
  return '';
}

// Avisos para revisar a mano antes de guardar.
export function problemas(s) {
  const avisos = [];
  if (s.cancion_inicio === null) avisos.push('falta la canción de inicio');
  if (s.cancion_medio === null) avisos.push('falta la canción del medio');
  if (s.cancion_final === null) avisos.push('falta la canción final');
  const nums = s.partes.map((p) => p.numero);
  if (nums.some((n, i) => n !== i + 1)) avisos.push(`la numeración de partes salta: ${nums.join(', ')}`);
  if (!s.partes.some((p) => p.seccion === VIDA && p.titulo.toLowerCase().includes('estudio bíblico'))) {
    avisos.push('no encontré el estudio bíblico de la congregación');
  }
  return avisos;
}
