// Vista para imprimir / guardar como PDF: imprimir.html?mes=AAAA-MM
// Arma las hojas (dos semanas por hoja) igual que templates/imprimir.html.

import { cargarEstado, leerImagen } from './datos.js';
import { nombreMes, semanasDelMes } from './programa.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function htmlSemana(s, urlImagen) {
  let h = `<div class="semana"><table><tr class="t-semana"><td class="c-texto" colspan="2">${esc(s.titulo)}</td>`;
  h += s.tipo !== 'sin_reunion'
    ? `<td class="c-rol">Presidente:</td><td class="c-nombre">${esc(s.presidente)}</td></tr></table>`
    : '<td></td><td></td></tr></table>';

  if (s.tipo === 'sin_reunion') {
    h += `<div class="especial"><div class="motivo">${esc(s.motivo || 'Sin reunión')}</div>`;
    h += urlImagen ? `<img src="${urlImagen}" alt="">` : '<div class="sin-imagen">(sin imagen)</div>';
    return h + '</div></div>';
  }

  h += '<table><tr class="espacio"><td class="c-hora"></td><td class="c-texto"></td><td class="c-rol"></td><td class="c-nombre"></td></tr>';
  for (const f of s.filas) {
    if (f.tipo === 'seccion') {
      h += `<tr class="seccion ${f.seccion}"><td class="barra" colspan="2">${esc(f.texto)}</td><td></td><td></td></tr>`;
      continue;
    }
    const dos = f.puestos.length > 1;
    const puestos = f.puestos.length ? f.puestos : [null];
    const largo = f.texto.length + 10;
    const claseTexto = largo > 82 ? 'muy-largo' : largo > 68 ? 'largo' : '';
    const min = f.minutos ? ` <span class="min">(${f.minutos} ${f.minutos === 1 ? 'min.' : 'mins.'})</span>` : '';
    puestos.forEach((pu, i) => {
      const clases = [dos && i === puestos.length - 1 && f.seccion === 'maestros' ? 'con-linea' : '', f.visita ? 'visita' : ''].join(' ');
      h += `<tr class="${clases}">`;
      if (i === 0) {
        const rs = dos ? ' rowspan="2"' : '';
        h += `<td class="c-hora"${rs}>${esc(f.hora)}</td><td class="c-texto ${claseTexto}"${rs}>${esc(f.texto)}${min}</td>`;
      }
      h += `<td class="c-rol">${pu && pu.rol ? esc(pu.rol) + ':' : ''}</td><td class="c-nombre">${esc(pu ? pu.nombre : '')}</td></tr>`;
    });
  }
  return h + '</table></div>';
}

function ajustarEscala() {
  // Las hojas miden 8,5 pulgadas (816 px): en pantallas chicas se achican para verlas enteras.
  // En el celular innerWidth puede crecer con el contenido: se usa el menor de los anchos.
  const ancho = Math.min(window.innerWidth, document.documentElement.clientWidth || Infinity, screen.width || Infinity);
  const escala = Math.min(1, (ancho - 16) / 816);
  document.documentElement.style.setProperty('--escala', escala.toFixed(3));
}

async function iniciar() {
  const ym = new URLSearchParams(location.search).get('mes') || '';
  const cont = document.getElementById('hojas');
  if (!/^\d{4}-\d{2}$/.test(ym)) {
    cont.innerHTML = '<div class="mensaje">Falta el mes. Vuelve a la app y usa «PDF».</div>';
    return;
  }
  document.getElementById('volver').href = `./#/mes/${ym}`;
  const e = await cargarEstado();
  const semanas = semanasDelMes(e, ym);
  if (!semanas.length) {
    cont.innerHTML = '<div class="mensaje">Ese mes no tiene semanas cargadas en este dispositivo.</div>';
    return;
  }
  const mes = nombreMes(ym);
  document.title = `Programa ${mes}`; // nombre sugerido del PDF
  document.getElementById('titulo-barra').textContent = `Programa ${mes}`;

  const urls = {};
  for (const s of semanas) {
    if (s.tipo === 'sin_reunion' && s.imagen) {
      const blob = await leerImagen(s.imagen);
      if (blob) urls[s.id] = URL.createObjectURL(blob);
    }
  }
  const cong = esc((e.config.congregacion || '').toUpperCase());
  let html = '';
  for (let i = 0; i < semanas.length; i += 2) {
    html += `<section class="hoja"><div class="cabecera"><span class="cong">CONGREGACIÓN ${cong}</span>` +
      '<span class="titulo">Programa para la reunión de entre semana</span></div>';
    for (const s of semanas.slice(i, i + 2)) html += htmlSemana(s, urls[s.id]);
    html += '</section>';
  }
  cont.innerHTML = html;
  ajustarEscala();
  window.addEventListener('resize', ajustarEscala);

  const imprimir = async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
    window.print();
  };
  document.getElementById('btn-imprimir').addEventListener('click', imprimir);
  if (new URLSearchParams(location.search).get('imprimir') === '1') setTimeout(imprimir, 300);
}

iniciar().catch((err) => {
  document.getElementById('hojas').innerHTML = `<div class="mensaje">No se pudo armar el programa: ${esc(err.message)}</div>`;
});
