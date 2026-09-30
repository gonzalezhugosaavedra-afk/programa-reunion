// Excel del mes con el mismo formato del libro original (versión JS de
// core/exportar.py → excel_mes): Hoja1 = programa, Hoja2 = lista de nombres,
// y cada celda de nombre trae el desplegable. Usa ExcelJS (vendor/exceljs.min.js),
// que se carga recién cuando se pide un Excel.

import { leerImagen } from './datos.js';

const GRIS = 'FF575A5D', DORADO = 'FFBE8900', BURDEO = 'FF7E0024';
const COLOR_SECCION = { tesoros: GRIS, maestros: DORADO, vida: BURDEO };

let _carga = null;
function cargarExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  _carga ||= new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = 'js/vendor/exceljs.min.js';
    s.onload = () => ok(window.ExcelJS);
    s.onerror = () => { _carga = null; mal(new Error('No se pudo cargar el generador de Excel.')); };
    document.head.appendChild(s);
  });
  return _carga;
}

const tamanoImagen = (blob) => createImageBitmap(blob).then((b) => {
  const r = { w: b.width, h: b.height };
  b.close?.();
  return r;
});

export async function excelMes(semanas, congregacion, personas) {
  const ExcelJS = await cargarExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Hoja1', { views: [{ showGridLines: false }] });
  const lista = wb.addWorksheet('Hoja2');
  lista.getCell('B3').value = 'Nombres';
  lista.getCell('B3').font = { name: 'Calibri', bold: true };
  personas.forEach((n, i) => { lista.getCell(i + 4, 2).value = n; });
  lista.getColumn(2).width = 28;
  const finLista = Math.max(4, 3 + personas.length);
  const validacion = {
    type: 'list', allowBlank: true, showErrorMessage: false, formulae: [`Hoja2!$B$4:$B$${finLista}`],
  };

  [6.3, 9, 9, 9, 11.4, 9, 11.7, 11.4, 9, 9, 9].forEach((ancho, i) => { ws.getColumn(i + 1).width = ancho; });

  const gris = { name: 'Calibri', size: 9, bold: true, color: { argb: GRIS } };
  const rolF = { name: 'Calibri', size: 8, bold: true, color: { argb: GRIS } };
  const normal = { name: 'Calibri', size: 11 };
  const nombreF = { name: 'Calibri', size: 12 };
  const doble = { style: 'double', color: { argb: GRIS } };
  const linea = { style: 'thin', color: { argb: 'FFE0B040' } };
  const centro = { horizontal: 'center', vertical: 'middle' };
  const derecha = { horizontal: 'right', vertical: 'middle' };
  const izq = { horizontal: 'left', vertical: 'middle' };
  // Si el título es largo, Excel achica la letra en vez de cortarlo.
  const izqAjuste = { horizontal: 'left', vertical: 'middle', shrinkToFit: true };

  const filaDoble = (r) => { for (let c = 1; c <= 11; c++) ws.getCell(r, c).border = { bottom: doble }; };
  const nombre = (r, valor) => {
    ws.mergeCells(r, 8, r, 11);
    const cel = ws.getCell(r, 8);
    cel.value = valor || null;
    cel.font = nombreF;
    cel.alignment = centro;
    cel.dataValidation = validacion;
  };
  const rol = (r, texto) => {
    if (!texto) return;
    const cel = ws.getCell(r, 7);
    cel.value = `${texto}:`;
    cel.font = rolF;
    cel.alignment = derecha;
  };

  ws.getCell('A1').value = `CONGREGACIÓN ${congregacion.toUpperCase()}`;
  ws.getCell('A1').font = { name: 'Calibri', size: 11, bold: true };
  ws.mergeCells('E1:K1');
  ws.getCell('E1').value = 'Programa para la reunión de entre semana';
  ws.getCell('E1').font = { name: 'Cambria', size: 16.5, bold: true };
  ws.getCell('E1').alignment = centro;
  filaDoble(1);
  let r = 2;
  const paginas = [[1, 1]]; // [fila inicial, fila final] de cada hoja

  for (const [idx, s] of semanas.entries()) {
    if (idx && idx % 2 === 0) {
      ws.getRow(r - 1).addPageBreak();
      paginas[paginas.length - 1][1] = r - 1;
      paginas.push([r, r]);
    } else if (idx) {
      filaDoble(r - 1);
    }
    ws.getCell(r, 1).value = s.titulo;
    ws.getCell(r, 1).font = { name: 'Calibri', size: 11, bold: true };
    if (s.tipo !== 'sin_reunion') {
      rol(r, 'Presidente');
      nombre(r, s.presidente);
    }
    r += 2;

    if (s.tipo === 'sin_reunion') {
      ws.getCell(r, 1).value = s.motivo || 'Sin reunión';
      ws.getCell(r, 1).font = { name: 'Cambria', size: 15, bold: true };
      r += 2;
      const blob = s.imagen ? await leerImagen(s.imagen) : null;
      if (blob) {
        const ext = (blob.type.split('/')[1] || 'png').replace('jpg', 'jpeg');
        const { w, h } = await tamanoImagen(blob);
        const escala = Math.min(380 / h, 560 / w, 1); // px aprox. medio Oficio
        const id = wb.addImage({ buffer: await blob.arrayBuffer(), extension: ext === 'jpeg' ? 'jpeg' : ext === 'gif' ? 'gif' : 'png' });
        ws.addImage(id, { tl: { col: 1, row: r - 1 }, ext: { width: Math.round(w * escala), height: Math.round(h * escala) } });
      }
      r += 20;
      continue;
    }

    for (const f of s.filas) {
      if (f.tipo === 'seccion') {
        for (let c = 1; c <= 6; c++) {
          ws.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_SECCION[f.seccion] } };
        }
        ws.getCell(r, 1).value = f.texto;
        ws.getCell(r, 1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        r += 1;
        continue;
      }
      const texto = f.texto + (f.minutos ? ` (${f.minutos} ${f.minutos === 1 ? 'min.' : 'mins.'})` : '');
      const h = ws.getCell(r, 1);
      h.value = f.hora;
      h.font = gris;
      h.alignment = izq;
      const puestos = f.puestos || [];
      const alto = puestos.length > 1 ? 2 : 1;
      if (alto > 1) ws.mergeCells(r, 1, r + 1, 1);
      ws.mergeCells(r, 2, r + alto - 1, 6);
      const t = ws.getCell(r, 2);
      t.value = texto;
      t.font = normal;
      t.alignment = izqAjuste;
      puestos.forEach((pu, k) => {
        rol(r + k, pu.rol);
        nombre(r + k, pu.nombre);
        if (puestos.length > 1 && k === 1 && f.seccion === 'maestros') {
          for (let c = 8; c <= 11; c++) ws.getCell(r + k, c).border = { bottom: linea };
        }
      });
      r += Math.max(1, puestos.length);
    }
    r += 1;
  }

  // Dos semanas por hoja Oficio: si no caben con la altura del original (21,2),
  // se achican las filas de esa hoja para que no se pase a una hoja en blanco.
  paginas[paginas.length - 1][1] = r;
  const util = 936 - 2 * 0.5 * 72 - 12; // alto Oficio menos márgenes, en puntos
  for (const [inicio, fin] of paginas) {
    const altoFila = Math.min(21.2, util / Math.max(1, fin - inicio + 1));
    for (let fila = inicio; fila <= fin; fila++) ws.getRow(fila).height = Math.round(altoFila * 10) / 10;
  }
  ws.pageSetup = {
    paperSize: 14, // Folio 8,5 x 13 pulg. = Oficio 21,59 x 33,02 cm
    orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
  };

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
