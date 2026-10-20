// Programa Reunión — app para tablet, celular y PC (funciona sin internet).
// Pantallas: #/mes/AAAA-MM, #/cargar, #/hermanos, #/config, #/respaldo.
// Cada cambio se guarda solo en el dispositivo (datos.js).

import * as D from './datos.js';
import * as P from './programa.js';
import { leerGuia, problemas } from './lector.js';
import { corregirDatos } from './correcciones.js';

const VERSION = '1.0';
let estado = null;
let ultimoRespaldo = null;

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
const contenido = $('#contenido');
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ── Utilidades ───────────────────────────────────────────────────────────

let _toastTimer = null;
function toast(texto, tipo = 'ok') {
  const t = $('#toast');
  t.textContent = texto;
  t.className = 'toast visible ' + tipo;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.className = 'toast'; }, tipo === 'error' ? 5000 : 1600);
}

// Aplica un cambio al estado y lo guarda. Si falla, avisa y no guarda.
async function cambiar(fn, mensaje = 'Guardado') {
  try {
    fn(estado);
  } catch (err) {
    toast(err.message, 'error');
    estado = await D.cargarEstado(); // descarta el cambio a medias
    return false;
  }
  try {
    await D.guardarEstado(estado);
  } catch (err) {
    toast('No se pudo guardar en este dispositivo: ' + err.message, 'error');
    return false;
  }
  if (mensaje) toast(mensaje);
  pintarMenu();
  return true;
}

function descargar(blob, nombre) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

const fechaCorta = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
};

const ICONOS = {
  mes: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  cargar: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  hermanos: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  config: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  respaldo: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7v10c0 2 3.6 4 8 4s8-2 8-4V7"/><ellipse cx="12" cy="7" rx="8" ry="4"/><path d="M4 12c0 2 3.6 4 8 4s8-2 8-4"/></svg>',
  lapiz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  bajar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
};

// ── Menú lateral ─────────────────────────────────────────────────────────

const hayCambiosSinRespaldo = () => !!estado.actualizado && (!ultimoRespaldo || estado.actualizado > ultimoRespaldo);

function pintarMenu() {
  const ruta = location.hash;
  const meses = P.mesesDisponibles(estado);
  $('#nav-meses').innerHTML = meses.length
    ? meses.map((m) => `<a class="nav-item ${ruta === `#/mes/${m.ym}` ? 'active' : ''}" href="#/mes/${m.ym}">${ICONOS.mes}${esc(m.nombre)}<span class="badge">${m.semanas}</span></a>`).join('')
    : '<div class="nav-vacio">Todavía no hay programas. Carga la guía del mes.</div>';
  const activos = estado.personas.filter((p) => p.activo).length;
  const item = (href, icono, texto, extra = '') =>
    `<a class="nav-item ${ruta.startsWith(href) ? 'active' : ''}" href="${href}">${ICONOS[icono]}${texto}${extra}</a>`;
  $('#nav-preparar').innerHTML =
    item('#/cargar', 'cargar', 'Cargar guía (PDF)') +
    item('#/hermanos', 'hermanos', 'Hermanos', `<span class="badge">${activos}</span>`) +
    item('#/respaldo', 'respaldo', 'Respaldo', hayCambiosSinRespaldo() ? '<span class="punto" title="Hay cambios sin respaldar"></span>' : '') +
    item('#/config', 'config', 'Configuración');
  $('#pie-app').textContent = `v${VERSION} · datos en este dispositivo`;
}

function cerrarMenu() { document.body.classList.remove('menu-abierto'); }
$('#btn-menu').addEventListener('click', () => document.body.classList.add('menu-abierto'));
$('#velo').addEventListener('click', cerrarMenu);
$('#menu').addEventListener('click', (e) => { if (e.target.closest('a')) cerrarMenu(); });

// ── Rutas ────────────────────────────────────────────────────────────────

const PANTALLAS = { mes: pantallaMes, cargar: pantallaCargar, hermanos: pantallaHermanos, config: pantallaConfig, respaldo: pantallaRespaldo };

function navegar() {
  const [, nombre, arg] = location.hash.match(/^#\/(\w+)(?:\/(.+))?/) || [];
  if (!PANTALLAS[nombre]) {
    const ym = P.mesActualOProximo(estado);
    location.replace(ym ? `#/mes/${ym}` : (estado.semanas.length || estado.personas.length ? '#/cargar' : '#/respaldo'));
    return;
  }
  cerrarMenu();
  pintarMenu();
  window.scrollTo(0, 0);
  PANTALLAS[nombre](arg);
}
window.addEventListener('hashchange', navegar);

function crumb(seccion, titulo) {
  $('#crumb').innerHTML = `${esc(seccion)} / <strong>${esc(titulo)}</strong>`;
  document.title = `${titulo} · Programa Reunión`;
}

// ── Pantalla del mes ─────────────────────────────────────────────────────

// Hermanos activos como objetos {nombre, sexo, cargo, lector}, en orden alfabético.
const personasMenu = () => estado.personas.filter((p) => p.activo).sort((a, b) => P.compararNombres(a.nombre, b.nombre));

// Menú de un puesto: primero quienes pueden hacerlo; para presidente, los
// ministeriales aparte (excepción); al final los que aún no se clasifican.
// Quien participa la semana anterior/siguiente (lectura o Maestros) va marcado ⚠.
function opcionesNombres(nombre, pu, personas, vecinos) {
  const opcion = (p, extra = '') => {
    const marca = pu.estudiante && vecinos[p.nombre] ? ` ⚠ ${vecinos[p.nombre] === 'ambas' ? 'semanas vecinas' : 'semana ' + vecinos[p.nombre]}` : '';
    return `<option value="${esc(p.nombre)}"${p.nombre === nombre ? ' selected' : ''}>${esc(p.nombre)}${marca}${extra}</option>`;
  };
  const pueden = [], excepcion = [], sinClasificar = [];
  for (const p of personas) {
    const c = P.cumple(p, pu.req);
    if (c === true) pueden.push(p);
    else if (c === null) sinClasificar.push(p);
    else if (pu.req === 'anciano' && p.cargo === 'ministerial') excepcion.push(p);
  }
  let h = '<option value="">—</option>';
  const visibles = new Set([...pueden, ...excepcion, ...sinClasificar].map((p) => p.nombre));
  if (nombre && !visibles.has(nombre)) {
    const conocido = personas.some((p) => p.nombre === nombre);
    h += `<option value="${esc(nombre)}" selected>${esc(nombre)} (${conocido ? 'no corresponde' : 'no está en la lista'})</option>`;
  }
  h += pueden.map((p) => opcion(p)).join('');
  if (excepcion.length) h += `<optgroup label="Siervos ministeriales (solo excepcional)">${excepcion.map((p) => opcion(p)).join('')}</optgroup>`;
  if (sinClasificar.length) h += `<optgroup label="Sin clasificar (márcalos en Hermanos)">${sinClasificar.map((p) => opcion(p)).join('')}</optgroup>`;
  return h;
}

function selector(s, pu, personas) {
  const clases = ['select', 'sm', 'nombre'];
  if (pu.nombre && s.repetidos.includes(pu.nombre)) clases.push('repetido');
  if (pu.noCumple) clases.push('no-cumple');
  if (pu.semanaSeguida) clases.push('semana-seguida');
  const titulo = P.REQUISITOS[pu.req] ? ` title="${esc(P.REQUISITOS[pu.req][0].toUpperCase() + P.REQUISITOS[pu.req].slice(1))}"` : '';
  return `<select class="${clases.join(' ')}" data-semana="${s.id}" data-clave="${pu.clave}" translate="no" aria-label="Nombre"${titulo}>${opcionesNombres(pu.nombre, pu, personas, s.vecinos || {})}</select>`;
}

function htmlSemana(s, personas, urlsImagen) {
  const cfg = estado.config;
  const tipos = Object.entries(P.TIPOS).map(([k, v]) => `<option value="${k}"${s.tipo === k ? ' selected' : ''}>${v}</option>`).join('');
  let h = `<section class="card semana tipo-${s.tipo}" id="s${s.id}" data-id="${s.id}">
  <header class="semana-cab">
    <div class="semana-titulo">
      <h2 translate="no">${esc(s.titulo)}</h2>
      <div class="semana-estado">`;
  if (s.tipo === 'sin_reunion') {
    h += '<span class="badge-pill neutral">Sin reunión</span>';
  } else {
    h += `<span class="badge-pill ${s.pendientes === 0 ? 'success' : 'warning'} pendientes">${s.pendientes === 0 ? 'Completa' : `${s.pendientes} por asignar`}</span>
        <span class="badge-pill neutral">${esc(s.hora_inicio)} – ${esc(s.hora_fin)}</span>`;
    if (s.tipo === 'visita') h += '<span class="badge-pill accent">Visita del superintendente</span>';
  }
  h += `<span class="badge-pill danger repetidos"${s.repetidos.length ? '' : ' hidden'}>Repetido: <span class="lista-repetidos">${esc(s.repetidos.join(', '))}</span></span>
      </div>
    </div>
    <div class="semana-tipo">
      <label class="label" for="tipo${s.id}">Semana</label>
      <select class="select sm campo-semana" id="tipo${s.id}" data-semana="${s.id}" data-campo="tipo" data-repintar="1">${tipos}</select>
    </div>
  </header>`;
  h += s.avisos.map((a) => `<div class="aviso">${esc(a)}</div>`).join('');

  if (s.tipo === 'sin_reunion') {
    const motivos = P.MOTIVOS_SIN_REUNION.map((m) => `<option${s.motivo === m ? ' selected' : ''}>${esc(m)}</option>`).join('');
    const url = urlsImagen[s.id];
    h += `<div class="especial">
    <div class="field">
      <label class="label" for="motivo${s.id}">Motivo</label>
      <select class="select campo-semana" id="motivo${s.id}" data-semana="${s.id}" data-campo="motivo">
        <option value="">— elige el motivo —</option>${motivos}
      </select>
    </div>
    <div class="field">
      <span class="label">Imagen del evento (reemplaza el bloque de la semana en el programa)</span>
      <label class="btn ghost subir">${s.imagen ? 'Cambiar imagen' : 'Elegir imagen…'}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="imagen-semana" data-semana="${s.id}" hidden>
      </label>
    </div>
    <div class="especial-vista">${url ? `<img src="${url}" alt="Imagen de la semana">` : '<div class="vacio">Sin imagen todavía</div>'}</div>
  </div>`;
  } else {
    if (s.tipo === 'visita') {
      h += `<div class="visita-campos">
    <div class="field">
      <label class="label" for="sot${s.id}">Título del discurso del superintendente</label>
      <input class="input campo-semana" id="sot${s.id}" data-semana="${s.id}" data-campo="so_titulo" value="${esc(s.so_titulo)}" placeholder="Escribe el título del discurso" data-repintar="1">
    </div>
    <div class="field">
      <label class="label" for="son${s.id}">Superintendente de circuito</label>
      <input class="input campo-semana" id="son${s.id}" data-semana="${s.id}" data-campo="so_nombre" value="${esc(s.so_nombre)}" placeholder="Nombre" translate="no" data-repintar="1">
    </div>
    <div class="field corto">
      <label class="label" for="soc${s.id}">Canción final</label>
      <input class="input campo-semana" id="soc${s.id}" data-semana="${s.id}" data-campo="so_cancion" data-repintar="1" inputmode="numeric" value="${esc(s.so_cancion ?? '')}" placeholder="${esc(s.cancion_final_guia ?? '')}">
    </div>
  </div>`;
    }
    h += `<table class="table programa"><tbody>
      <tr class="fila-presidente">
        <td class="hora"></td>
        <td class="texto"><strong>Presidente</strong></td>
        <td class="puestos"><div class="puesto"><span class="rol"></span>${selector(s, { clave: 'presidente', nombre: s.presidente, req: 'anciano', noCumple: s.avisos.some((a) => a.includes('«Presidente»')) }, personas)}</div></td>
      </tr>`;
    for (const f of s.filas) {
      if (f.tipo === 'seccion') {
        h += `<tr class="fila-seccion ${f.seccion}"><td colspan="3"><span class="barra">${esc(f.texto)}</span>
          <button class="btn subtle sm agregar-parte" type="button" data-semana="${s.id}" data-seccion="${f.seccion}">+ parte</button></td></tr>`;
        continue;
      }
      let editar = '';
      if (f.parte_id && !f.visita) {
        editar = `<button class="icon-btn editar-parte" type="button" title="Editar parte" aria-label="Editar parte" data-semana="${s.id}" data-parte="${f.parte_id}">${ICONOS.lapiz}</button>`;
      }
      const puestos = f.puestos.map((pu) => `<div class="puesto"><span class="rol">${esc(pu.rol)}</span>${pu.clave === 'so_nombre'
        ? `<span class="so-nombre" translate="no">${esc(pu.nombre || '(nombre arriba)')}</span>`
        : selector(s, pu, personas)}</div>`).join('');
      h += `<tr class="fila-${f.tipo}${f.visita ? ' es-visita' : ''}">
        <td class="hora mono">${esc(f.hora)}</td>
        <td class="texto"><span>${esc(f.texto)}${f.minutos ? ` <span class="min">(${f.minutos} min)</span>` : ''}</span>${editar}</td>
        <td class="puestos">${puestos}</td>
      </tr>`;
    }
    h += '</tbody></table>';
  }

  const num = (campo, etiqueta, valor, ph = '') => `<div class="field">
        <label class="label" for="${campo}${s.id}">${etiqueta}</label>
        <input class="input sm campo-semana" id="${campo}${s.id}" data-semana="${s.id}" data-campo="${campo}" data-repintar="1" value="${esc(valor ?? '')}" placeholder="${esc(ph)}"${campo === 'hora_inicio' ? '' : ' inputmode="numeric"'}>
      </div>`;
  h += `<details class="ajustes">
    <summary>Ajustes de la semana</summary>
    <div class="ajustes-grid">
      ${num('hora_inicio', 'Hora de inicio (solo esta semana)', s.hora_inicio_propia, cfg.hora_inicio)}
      ${num('cancion_inicio', 'Canción de inicio', s.cancion_inicio)}
      ${num('cancion_medio', 'Canción del medio', s.cancion_medio)}
      ${num('cancion_final', 'Canción final (de la guía)', s.cancion_final_guia)}
      <div class="field fin">
        <button class="btn danger-ghost sm borrar-semana" type="button" data-semana="${s.id}">Quitar esta semana</button>
      </div>
    </div>
  </details>
</section>`;
  return h;
}

const _urlsImagen = {};
async function urlImagen(id) {
  if (!id) return null;
  if (!_urlsImagen[id]) {
    const blob = await D.leerImagen(id);
    if (!blob) return null;
    _urlsImagen[id] = URL.createObjectURL(blob);
  }
  return _urlsImagen[id];
}

async function urlsDe(semanas) {
  const urls = {};
  for (const s of semanas) if (s.tipo === 'sin_reunion' && s.imagen) urls[s.id] = await urlImagen(s.imagen);
  return urls;
}

let mesActual = null;

async function pantallaMes(ym) {
  if (!/^\d{4}-\d{2}$/.test(ym)) { location.replace('#/'); return; }
  const semanas = P.semanasDelMes(estado, ym);
  if (!semanas.length) { location.replace('#/'); return; }
  mesActual = ym;
  const mes = P.nombreMes(ym);
  crumb('Programas', mes);
  const personas = personasMenu();
  const urls = await urlsDe(semanas);
  contenido.innerHTML = `
  <div class="page-header">
    <div>
      <h1 class="page-title">${esc(mes)}</h1>
      <div class="page-sub">Elige los nombres; cada cambio se guarda solo. Las horas se calculan desde las ${esc(estado.config.hora_inicio)}.</div>
    </div>
    <div class="acciones-mes">
      <button class="btn ghost" type="button" id="btn-excel">Excel</button>
      <a class="btn primary" href="imprimir.html?mes=${ym}">${ICONOS.bajar} PDF / Imprimir</a>
    </div>
  </div>
  ${semanas.map((s) => htmlSemana(s, personas, urls)).join('')}`;
  $('#btn-excel').addEventListener('click', () => exportarExcel(ym));
}

// Vuelve a dibujar una sola semana (tras cambiar tipo, horas, partes…).
async function repintarSemana(id) {
  const sem = P.buscarSemana(estado, id);
  const viejo = $(`#s${id}`);
  if (!sem || !viejo) return;
  const s = P.armarSemana(sem, estado.config, estado);
  const abierto = viejo.querySelector('details.ajustes')?.open;
  const tmp = document.createElement('div');
  tmp.innerHTML = htmlSemana(s, personasMenu(), await urlsDe([s]));
  const nuevo = tmp.firstElementChild;
  if (abierto) nuevo.querySelector('details.ajustes').open = true;
  viejo.replaceWith(nuevo);
}

// Tras elegir un nombre se redibuja la semana y sus vecinas (la regla de semanas
// seguidas mira la anterior y la siguiente, aunque sean de otro mes).
async function repintarConVecinas(id) {
  const sem = P.buscarSemana(estado, id);
  if (!sem) return;
  const ids = [id];
  for (const otra of estado.semanas) {
    const dias = Math.round((new Date(otra.fecha_inicio) - new Date(sem.fecha_inicio)) / 86400000);
    if (dias === 7 || dias === -7) ids.push(otra.id);
  }
  for (const x of ids) await repintarSemana(x);
}

contenido.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.matches('select.nombre')) {
    const id = Number(el.dataset.semana);
    if (await cambiar((e) => P.asignar(e, id, el.dataset.clave, el.value), el.value ? 'Guardado' : 'Quitado')) await repintarConVecinas(id);
    return;
  }
  if (el.matches('.campo-semana')) {
    const id = Number(el.dataset.semana);
    if (await cambiar((e) => P.editarSemana(e, id, el.dataset.campo, el.value))) {
      if (el.dataset.repintar) repintarSemana(id);
    } else {
      repintarSemana(id);
    }
    return;
  }
  if (el.matches('.imagen-semana') && el.files.length) {
    const id = Number(el.dataset.semana);
    try {
      const blob = await D.prepararImagen(el.files[0]);
      const sem = P.buscarSemana(estado, id);
      const clave = `${sem.fecha_inicio}_${Date.now().toString(36)}`;
      await D.guardarImagen(clave, blob);
      const anterior = sem.imagen;
      if (await cambiar(() => { sem.imagen = clave; }, 'Imagen guardada')) {
        if (anterior) { await D.borrarImagen(anterior); URL.revokeObjectURL(_urlsImagen[anterior]); delete _urlsImagen[anterior]; }
        repintarSemana(id);
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  }
});

contenido.addEventListener('click', async (ev) => {
  const b = ev.target.closest('button');
  if (!b) return;
  if (b.classList.contains('borrar-semana')) {
    const sem = P.buscarSemana(estado, b.dataset.semana);
    if (!confirm(`¿Quitar la semana «${sem.fechas} | ${sem.lectura}» y todas sus asignaciones?\n\nSe puede volver a cargar desde el PDF, pero los nombres se pierden.`)) return;
    let quitada = null;
    if (await cambiar((e) => { quitada = P.quitarSemana(e, sem.id); }, 'Semana quitada')) {
      if (quitada?.imagen) await D.borrarImagen(quitada.imagen);
      navegar();
    }
  } else if (b.classList.contains('editar-parte')) {
    abrirParte({ modo: 'editar', semana: Number(b.dataset.semana), parte: Number(b.dataset.parte) });
  } else if (b.classList.contains('agregar-parte')) {
    abrirParte({ modo: 'agregar', semana: Number(b.dataset.semana), seccion: b.dataset.seccion });
  }
});

// ── Diálogo de partes ────────────────────────────────────────────────────

const dlg = $('#dlg-parte');
const campos = { titulo: $('#dp-titulo'), minutos: $('#dp-minutos'), ayudante: $('#dp-ayudante'), consejo: $('#dp-consejo') };
let editando = null;

function abrirParte(datos) {
  editando = datos;
  if (datos.modo === 'editar') {
    const p = P.buscarSemana(estado, datos.semana).partes.find((x) => x.id === datos.parte);
    $('#dlg-titulo').textContent = 'Editar parte';
    campos.titulo.value = p.titulo;
    campos.minutos.value = p.minutos;
    campos.ayudante.checked = p.rol2 === 'Ayudante';
    campos.ayudante.disabled = p.rol2 === 'Lector';
    campos.consejo.checked = !!p.consejo;
    $('#dp-borrar').hidden = false;
  } else {
    $('#dlg-titulo').textContent = 'Agregar parte';
    campos.titulo.value = '';
    campos.minutos.value = '';
    campos.ayudante.checked = datos.seccion === P.MAESTROS;
    campos.ayudante.disabled = false;
    campos.consejo.checked = datos.seccion === P.MAESTROS;
    $('#dp-borrar').hidden = true;
  }
  dlg.showModal();
  if (datos.modo === 'agregar') campos.titulo.focus();
}

$('#form-parte').addEventListener('submit', async (ev) => {
  if (ev.submitter?.value !== 'guardar') return;
  ev.preventDefault();
  const datos = { titulo: campos.titulo.value, minutos: campos.minutos.value, ayudante: campos.ayudante.checked, consejo: campos.consejo.checked };
  const { modo, semana } = editando;
  const ok = modo === 'editar'
    ? await cambiar((e) => P.editarParte(e, semana, editando.parte, datos))
    : await cambiar((e) => {
      P.agregarParte(e, semana, { ...datos, seccion: editando.seccion });
      // El consejo marcado en el diálogo manda sobre el de por defecto.
      const nueva = P.buscarSemana(e, semana).partes.reduce((a, p) => (p.id > a.id ? p : a));
      nueva.consejo = datos.consejo;
    }, 'Parte agregada');
  if (ok) { dlg.close(); repintarSemana(semana); }
});

$('#dp-borrar').addEventListener('click', async () => {
  if (!confirm('¿Quitar esta parte y sus nombres asignados?')) return;
  const { semana, parte } = editando;
  if (await cambiar((e) => P.quitarParte(e, semana, parte), 'Parte quitada')) { dlg.close(); repintarSemana(semana); }
});

// ── Exportar Excel ───────────────────────────────────────────────────────

async function exportarExcel(ym) {
  const b = $('#btn-excel');
  b.disabled = true;
  b.textContent = 'Generando…';
  try {
    const { excelMes } = await import('./excel.js');
    const blob = await excelMes(P.semanasDelMes(estado, ym), estado.config.congregacion || '', P.personasActivas(estado));
    descargar(blob, `Programa ${P.nombreMes(ym)}.xlsx`);
    toast('Excel descargado');
  } catch (err) {
    toast('No se pudo generar el Excel: ' + err.message, 'error');
  } finally {
    b.disabled = false;
    b.textContent = 'Excel';
  }
}

// ── Cargar guía ──────────────────────────────────────────────────────────

let _pdfjs = null;
async function pdfjs() {
  if (!_pdfjs) {
    _pdfjs = await import('./vendor/pdf.min.mjs');
    _pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;
  }
  return _pdfjs;
}

const NOMBRE_SECCION = { tesoros: 'Tesoros', maestros: 'Maestros', vida: 'Vida cristiana' };

function pantallaCargar() {
  crumb('Preparar', 'Cargar guía');
  contenido.innerHTML = `
  <div class="page-header">
    <div>
      <h1 class="page-title">Cargar la guía de actividades</h1>
      <div class="page-sub">Elige el PDF (por ejemplo <span class="mono">mwb_S_202609.pdf</span>). Trae dos meses; cada semana queda en el mes en que empieza.</div>
    </div>
  </div>
  <label class="card soltar" id="soltar" tabindex="0">
    ${ICONOS.cargar.replace('nav-icon', '')}
    <div class="soltar-titulo">Elegir el PDF de la guía</div>
    <div class="soltar-ayuda">Toca aquí para buscarlo (en el celular suele estar en «Descargas»), o arrástralo en el computador</div>
    <input type="file" id="archivo" accept="application/pdf,.pdf" hidden>
  </label>
  <div id="estado" class="estado" hidden></div>
  <section id="vista" hidden>
    <div class="page-header vista-cab">
      <div>
        <h2 class="page-title chico">Revisa lo que leí</h2>
        <div class="page-sub" id="vista-sub"></div>
      </div>
      <button class="btn primary lg" id="btn-guardar" type="button">Guardar semanas</button>
    </div>
    <div id="lista-semanas" class="vista-semanas"></div>
  </section>`;

  const soltar = $('#soltar'), archivo = $('#archivo'), est = $('#estado');
  let leidas = null, nombreArchivo = '';
  const mostrar = (t, error = false) => { est.hidden = false; est.textContent = t; est.classList.toggle('error', error); };

  async function leer(f) {
    $('#vista').hidden = true;
    mostrar(`Leyendo ${f.name}…`);
    try {
      const semanas = await leerGuia(await pdfjs(), new Uint8Array(await f.arrayBuffer()));
      if (!semanas.length) throw new Error('El PDF no parece una guía de actividades: no encontré semanas.');
      leidas = semanas;
      nombreArchivo = f.name;
    } catch (err) {
      mostrar(err.message.startsWith('No ') || err.message.startsWith('El PDF') ? err.message : `No pude leer el PDF: ${err.message}`, true);
      return;
    }
    est.hidden = true;
    const existentes = new Set(estado.semanas.map((s) => s.fecha_inicio));
    const nExist = leidas.filter((s) => existentes.has(s.fecha_inicio)).length;
    $('#vista-sub').textContent = `${nombreArchivo}: ${leidas.length} semanas.` + (nExist
      ? ` ${nExist} ya estaban cargadas (marca «Reemplazar» solo si quieres volver a leerlas; se pierden los nombres de sus partes).` : '');
    $('#lista-semanas').innerHTML = leidas.map((s) => {
      const existe = existentes.has(s.fecha_inicio);
      return `<div class="card vista-semana ${existe ? 'existe' : ''}">
        <div class="vista-cabeza">
          <strong translate="no">${esc(`${s.fechas} | ${s.lectura}`)}</strong>
          <span class="mono canciones">Canciones ${[s.cancion_inicio, s.cancion_medio, s.cancion_final].map((c) => c ?? '¿?').join(' · ')}</span>
          ${existe ? `<label class="check"><input type="checkbox" class="reemplazar" value="${s.fecha_inicio}"> Reemplazar (ya estaba)</label>` : '<span class="badge-pill success">Nueva</span>'}
        </div>
        ${problemas(s).map((a) => `<div class="aviso">${esc(a)}</div>`).join('')}
        <ol class="vista-partes">
          ${s.partes.map((p) => `<li><span class="sec ${p.seccion}">${NOMBRE_SECCION[p.seccion]}</span> ${esc(p.titulo)} <span class="min">(${p.minutos} min${p.auditorio ? ' · auditorio' : ''})</span></li>`).join('')}
        </ol>
      </div>`;
    }).join('');
    $('#vista').hidden = false;
    $('#vista').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  archivo.addEventListener('change', () => archivo.files.length && leer(archivo.files[0]));
  ['dragenter', 'dragover'].forEach((t) => soltar.addEventListener(t, (e) => { e.preventDefault(); soltar.classList.add('encima'); }));
  ['dragleave', 'drop'].forEach((t) => soltar.addEventListener(t, (e) => { e.preventDefault(); soltar.classList.remove('encima'); }));
  soltar.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) leer(f); });
  soltar.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); archivo.click(); } });

  $('#btn-guardar').addEventListener('click', async () => {
    if (!leidas) return;
    const reemplazar = new Set($$('.reemplazar:checked').map((c) => c.value));
    const resumen = { nueva: 0, reemplazada: 0, omitida: 0 };
    const ok = await cambiar((e) => {
      for (const s of leidas) resumen[P.guardarSemana(e, s, nombreArchivo, reemplazar.has(s.fecha_inicio))]++;
    }, null);
    if (!ok) return;
    toast(`${resumen.nueva} nuevas, ${resumen.reemplazada} reemplazadas, ${resumen.omitida} sin cambios`);
    location.hash = `#/mes/${leidas[0].fecha_inicio.slice(0, 7)}`;
  });
}

// ── Hermanos ─────────────────────────────────────────────────────────────

const FILTROS_HERMANOS = {
  todos: ['Todos', () => true],
  sin: ['Sin clasificar', (p) => !p.sexo],
  anciano: ['Ancianos', (p) => p.cargo === 'anciano'],
  ministerial: ['Siervos ministeriales', (p) => p.cargo === 'ministerial'],
  lector: ['Lectores del estudio', (p) => p.lector],
  H: ['Hermanos', (p) => p.sexo === 'H'],
  M: ['Hermanas', (p) => p.sexo === 'M'],
  inactivos: ['Inactivos', (p) => !p.activo],
};
let filtroHermanos = 'todos';

function pantallaHermanos() {
  crumb('Preparar', 'Hermanos');
  const hist = P.historial(estado);
  const sinClasificar = estado.personas.filter((p) => p.activo && !p.sexo).length;
  if (!FILTROS_HERMANOS[filtroHermanos]) filtroHermanos = 'todos';
  const personas = [...estado.personas]
    .filter(FILTROS_HERMANOS[filtroHermanos][1])
    .sort((a, b) => (b.activo - a.activo) || P.compararNombres(a.nombre, b.nombre));
  const cuenta = (k) => estado.personas.filter((p) => (k === 'inactivos' || p.activo) && FILTROS_HERMANOS[k][1](p)).length;
  const opcSexo = (p) => [['', '¿?'], ['H', 'Hermano'], ['M', 'Hermana']]
    .map(([v, txt]) => `<option value="${v}"${(p.sexo || '') === v ? ' selected' : ''}>${txt}</option>`).join('');
  const opcCargo = (p) => [['', '—'], ['ministerial', 'Siervo ministerial'], ['anciano', 'Anciano']]
    .map(([v, txt]) => `<option value="${v}"${(p.cargo || '') === v ? ' selected' : ''}>${txt}</option>`).join('');
  contenido.innerHTML = `
  <div class="page-header">
    <div>
      <h1 class="page-title">Hermanos</h1>
      <div class="page-sub">La lista de los menús de asignación. Marca quién es hermano o hermana, los ancianos, los siervos
        ministeriales y los lectores del estudio: así cada menú muestra solo a quienes pueden hacer esa parte.</div>
    </div>
  </div>
  ${sinClasificar ? `<div class="card tarjeta-form aviso-clasificar">
    <div><strong>${sinClasificar} sin clasificar.</strong> Mientras no se marquen aparecen al final de todos los menús.</div>
    <button class="btn primary" type="button" id="btn-sugerir">Sugerir hermano/hermana por el nombre</button>
  </div>` : ''}
  <div class="card tarjeta-form">
    <form id="form-nuevo" class="fila-form">
      <input class="input" id="nuevo-nombre" placeholder="Nombre y apellido, como quieres que salga en el programa" autocomplete="off" autocapitalize="words" translate="no">
      <button class="btn primary" type="submit">Agregar</button>
    </form>
  </div>
  <div class="filtros" role="group" aria-label="Filtrar">
    ${Object.entries(FILTROS_HERMANOS).map(([k, [txt]]) => `<button type="button" class="chip${k === filtroHermanos ? ' activo' : ''}" data-filtro="${k}">${txt} <span>${cuenta(k)}</span></button>`).join('')}
  </div>
  <div class="card">
    <table class="table hermanos">
      <thead><tr><th>Nombre</th><th>Hermano/a</th><th>Cargo</th><th class="center">Lector</th><th class="center">Asignaciones</th><th>Última semana</th><th class="center">Activo</th></tr></thead>
      <tbody>${personas.map((p) => `
        <tr class="${p.activo ? '' : 'inactivo'}${p.sexo ? '' : ' sin-clasificar'}" data-id="${p.id}">
          <td class="nombre-td"><input class="input sm nombre-persona" value="${esc(p.nombre)}" data-original="${esc(p.nombre)}" translate="no" aria-label="Nombre"></td>
          <td class="sexo-td"><select class="select sm dato-persona" data-campo="sexo" aria-label="Hermano o hermana">${opcSexo(p)}</select></td>
          <td class="cargo-td"><select class="select sm dato-persona" data-campo="cargo" aria-label="Cargo"${p.sexo === 'H' ? '' : ' disabled'}>${opcCargo(p)}</select></td>
          <td class="center lector-td"><label><input type="checkbox" class="dato-persona" data-campo="lector"${p.lector ? ' checked' : ''}${p.sexo === 'H' ? '' : ' disabled'}> <span>Lector</span></label></td>
          <td class="center mono dato" data-label="Asignaciones:">${hist[p.nombre]?.veces || 0}</td>
          <td class="mono dato" data-label="Última:">${hist[p.nombre]?.ultima || '—'}</td>
          <td class="center activo-td"><label><input type="checkbox" class="activo-persona"${p.activo ? ' checked' : ''}> <span>Activo</span></label></td>
        </tr>`).join('') || `<tr><td colspan="7" class="vacio-grande">${estado.personas.length ? 'Nadie en este filtro.' : 'Todavía no hay nombres. Agrégalos arriba o carga un respaldo.'}</td></tr>`}
      </tbody>
    </table>
  </div>`;

  $('#form-nuevo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const inp = $('#nuevo-nombre');
    if (!inp.value.trim()) return;
    if (await cambiar((x) => {
      P.agregarPersona(x, inp.value);
      // El nuevo queda con la sugerencia por nombre; se corrige en la misma fila.
      P.sugerirSexos(x);
    }, 'Agregado')) pantallaHermanos();
  });

  $$('.filtros .chip', contenido).forEach((b) => b.addEventListener('click', () => { filtroHermanos = b.dataset.filtro; pantallaHermanos(); }));

  $('#btn-sugerir')?.addEventListener('click', async () => {
    let n = 0;
    if (await cambiar((x) => { n = P.sugerirSexos(x); }, null)) {
      toast(n ? `Se sugirieron ${n}. Revisa la lista y corrige lo que no corresponda.` : 'No reconocí ningún nombre más: márcalos a mano.');
      pantallaHermanos();
    }
  });

  $$('tr[data-id]', contenido).forEach((tr) => {
    const nombre = $('.nombre-persona', tr), activo = $('.activo-persona', tr);
    const guardar = async () => {
      const nuevo = nombre.value.trim();
      if (!nuevo) { nombre.value = nombre.dataset.original; return; }
      if (nuevo !== nombre.dataset.original &&
          !confirm(`¿Cambiar «${nombre.dataset.original}» por «${nuevo}»?\nTambién se corrige en los programas ya armados.`)) {
        nombre.value = nombre.dataset.original;
        return;
      }
      if (!await cambiar((x) => P.editarPersona(x, tr.dataset.id, { nombre: nuevo, activo: activo.checked }))) {
        nombre.value = nombre.dataset.original;
        return;
      }
      nombre.dataset.original = nuevo;
      tr.classList.toggle('inactivo', !activo.checked);
    };
    nombre.addEventListener('change', guardar);
    activo.addEventListener('change', guardar);

    $$('.dato-persona', tr).forEach((el) => el.addEventListener('change', async () => {
      const valor = el.type === 'checkbox' ? el.checked : (el.value || null);
      if (!await cambiar((x) => P.editarDatosPersona(x, tr.dataset.id, { [el.dataset.campo]: valor }))) return;
      // Hermana: sin cargo ni lector. Se ajusta la fila sin redibujar la lista.
      const p = estado.personas.find((x) => x.id === Number(tr.dataset.id));
      const cargo = $('[data-campo="cargo"]', tr), lector = $('[data-campo="lector"]', tr);
      cargo.disabled = lector.disabled = p.sexo !== 'H';
      cargo.value = p.cargo || '';
      lector.checked = !!p.lector;
      tr.classList.toggle('sin-clasificar', !p.sexo);
    }));
  });
}

// ── Configuración ────────────────────────────────────────────────────────

async function pantallaConfig() {
  crumb('Preparar', 'Configuración');
  const persistente = await D.pedirPersistencia();
  contenido.innerHTML = `
  <div class="page-header">
    <div>
      <h1 class="page-title">Configuración</h1>
      <div class="page-sub">La hora se aplica a todas las semanas que no tengan una hora propia.</div>
    </div>
  </div>
  <div class="card tarjeta-form">
    <form id="form-config" class="config-grid">
      <div class="field">
        <label class="label" for="congregacion">Congregación (sale en el encabezado)</label>
        <input class="input" id="congregacion" value="${esc(estado.config.congregacion)}" translate="no">
      </div>
      <div class="field corto">
        <label class="label" for="hora_inicio">Hora de inicio</label>
        <input class="input" id="hora_inicio" value="${esc(estado.config.hora_inicio)}" placeholder="19:30" inputmode="numeric">
      </div>
      <div class="field fin"><button class="btn primary" type="submit">Guardar</button></div>
    </form>
  </div>
  <div class="card tarjeta-form info">
    <div><span class="label">Datos</span><br>Quedan guardados en este dispositivo (navegador), no en internet.
      ${persistente === true ? '<br><span class="texto-ok">Protegidos: el navegador no los borrará para liberar espacio.</span>'
    : '<br><span class="texto-aviso">El navegador podría borrarlos si falta espacio: instala la app y guarda respaldos seguido.</span>'}</div>
    <div><span class="label">PDF</span><br>«PDF / Imprimir» abre la hoja lista; en la ventana de impresión elige «Guardar como PDF».</div>
  </div>`;
  $('#form-config').addEventListener('submit', async (e) => {
    e.preventDefault();
    await cambiar((x) => P.guardarConfig(x, { congregacion: $('#congregacion').value, hora_inicio: $('#hora_inicio').value }), 'Configuración guardada');
  });
}

// ── Respaldo ─────────────────────────────────────────────────────────────

function nombreRespaldo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `ProgramaReunion_respaldo_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.json`;
}

async function marcarRespaldado() {
  ultimoRespaldo = new Date().toISOString();
  await D.guardarMeta('ultimo_respaldo', ultimoRespaldo);
  pintarMenu();
}

function pantallaRespaldo() {
  crumb('Preparar', 'Respaldo');
  const puedeCompartir = !!navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.json', { type: 'application/json' })] });
  const vacio = !estado.semanas.length && !estado.personas.length;
  contenido.innerHTML = `
  <div class="page-header">
    <div>
      <h1 class="page-title">Respaldo y traspaso</h1>
      <div class="page-sub">Tus datos viven en este dispositivo. El respaldo es un archivo con todo (hermanos, programas e imágenes) para guardarlo o pasarlo al otro equipo.</div>
    </div>
  </div>
  ${vacio ? `<div class="card tarjeta-form"><strong>¿Primera vez aquí?</strong>
     <p class="page-sub">Si ya tienes datos en el computador, carga su respaldo abajo. Si partes de cero, ve a <a class="texto-ok" href="#/cargar">Cargar guía</a> y <a class="texto-ok" href="#/hermanos">Hermanos</a>.</p></div>` : ''}
  <div class="respaldo-grid">
    <div class="card">
      <h2>Guardar respaldo</h2>
      <p>Último respaldo desde este dispositivo: <strong>${ultimoRespaldo ? fechaCorta(ultimoRespaldo) : 'nunca'}</strong>.
        ${hayCambiosSinRespaldo() ? '<br><span class="texto-aviso">Hay cambios desde entonces.</span>' : ''}</p>
      <div class="botones">
        <button class="btn primary" type="button" id="btn-descargar"${vacio ? ' disabled' : ''}>${ICONOS.bajar} Descargar respaldo</button>
        ${puedeCompartir ? `<button class="btn ghost" type="button" id="btn-compartir"${vacio ? ' disabled' : ''}>Compartir…</button>` : ''}
      </div>
      <p>«Compartir» sirve para mandarlo directo a Drive, WhatsApp o correo desde la tablet o el celular.</p>
    </div>
    <div class="card">
      <h2>Cargar respaldo</h2>
      <p>Reemplaza <strong>todo</strong> lo de este dispositivo por lo del archivo.</p>
      <label class="btn ghost subir">Elegir archivo de respaldo…<input type="file" id="archivo-respaldo" accept=".json,application/json" hidden></label>
      <div id="resumen-respaldo" hidden></div>
    </div>
  </div>
  <div class="card tarjeta-form" style="margin-top:16px">
    <span class="label">Para trabajar en el PC y en la tablet</span>
    <ol class="pasos">
      <li>Al terminar en un equipo: <strong>Guardar respaldo</strong> (o Compartir).</li>
      <li>En el otro equipo: <strong>Cargar respaldo</strong> con ese archivo antes de seguir.</li>
      <li>Trabaja en un equipo a la vez: al cargar un respaldo se reemplaza lo que había.</li>
    </ol>
  </div>`;

  $('#btn-descargar')?.addEventListener('click', async () => {
    const r = await D.armarRespaldo(estado);
    descargar(new Blob([JSON.stringify(r)], { type: 'application/json' }), nombreRespaldo());
    await marcarRespaldado();
    toast('Respaldo descargado');
    pantallaRespaldo();
  });

  $('#btn-compartir')?.addEventListener('click', async () => {
    const r = await D.armarRespaldo(estado);
    const archivo = new File([JSON.stringify(r)], nombreRespaldo(), { type: 'application/json' });
    try {
      await navigator.share({ files: [archivo], title: 'Respaldo Programa Reunión' });
      await marcarRespaldado();
      pantallaRespaldo();
    } catch (err) {
      if (err.name !== 'AbortError') toast('No se pudo compartir: ' + err.message, 'error');
    }
  });

  $('#archivo-respaldo').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    const caja = $('#resumen-respaldo');
    let r;
    try {
      r = D.validarRespaldo(await f.text());
    } catch (err) {
      caja.hidden = false;
      caja.innerHTML = `<div class="estado error">${esc(err.message)}</div>`;
      return;
    }
    const e = r.estado;
    const meses = P.mesesDisponibles(e).map((m) => m.nombre).join(', ') || 'ninguno';
    const localMasNuevo = estado.actualizado && e.actualizado && estado.actualizado > e.actualizado && !vacio;
    caja.hidden = false;
    caja.innerHTML = `<div class="resumen-respaldo">
        <strong>${esc(f.name)}</strong><br>
        Creado: ${fechaCorta(r.creado)} (${esc(r.origen || '—')})<br>
        ${e.personas.length} hermanos · ${e.semanas.length} semanas · meses: ${esc(meses)}
      </div>
      ${localMasNuevo ? `<div class="aviso" style="margin:0">Ojo: lo que hay en este dispositivo se modificó el ${fechaCorta(estado.actualizado)}, después de este respaldo. Si lo cargas, esos cambios se pierden.</div>` : ''}
      <div class="botones"><button class="btn primary" type="button" id="btn-aplicar">Reemplazar datos de este dispositivo</button></div>`;
    $('#btn-aplicar').addEventListener('click', async () => {
      if (!vacio && !confirm('¿Reemplazar todos los datos de este dispositivo por los del respaldo?')) return;
      try {
        await D.aplicarRespaldo(r);
        estado = await D.cargarEstado();
        for (const k of Object.keys(_urlsImagen)) { URL.revokeObjectURL(_urlsImagen[k]); delete _urlsImagen[k]; }
        ultimoRespaldo = estado.actualizado; // recién cargado = sin cambios pendientes
        await D.guardarMeta('ultimo_respaldo', ultimoRespaldo);
        toast('Respaldo cargado');
        location.hash = '#/';
        navegar();
      } catch (err) {
        toast('No se pudo cargar: ' + err.message, 'error');
      }
    });
  });
}

// ── Instalación y actualizaciones ────────────────────────────────────────

let _instalar = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _instalar = e;
  $('#btn-instalar').hidden = false;
});
$('#btn-instalar').addEventListener('click', async () => {
  if (!_instalar) return;
  _instalar.prompt();
  await _instalar.userChoice;
  _instalar = null;
  $('#btn-instalar').hidden = true;
});
window.addEventListener('appinstalled', () => { $('#btn-instalar').hidden = true; D.pedirPersistencia(); });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const nuevo = reg.installing;
      nuevo?.addEventListener('statechange', () => {
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
          toast('Hay una versión nueva de la app: se aplica al volver a abrirla.');
        }
      });
    });
  }).catch(() => { /* sin modo sin conexión, la app funciona igual */ });
}

// ── Inicio ───────────────────────────────────────────────────────────────

(async function iniciar() {
  try {
    estado = await D.cargarEstado();
    ultimoRespaldo = (await D.leerMeta('ultimo_respaldo')) || null;
  } catch (err) {
    contenido.innerHTML = `<div class="estado error">No se pudo abrir el almacenamiento del navegador: ${esc(err.message)}.
      Si estás en una ventana privada/incógnito, abre la app en una ventana normal.</div>`;
    return;
  }
  D.pedirPersistencia();
  // Arregla datos guardados con un lector anterior (p. ej. guía nov-dic 2026), sin tocar los nombres.
  try {
    const corregidas = corregirDatos(estado);
    if (corregidas.length) {
      await D.guardarEstado(estado);
      toast(`Se completaron ${corregidas.length} semanas de la guía de noviembre-diciembre (los nombres se mantienen).`);
    }
  } catch (err) {
    console.error('No se pudieron aplicar las correcciones', err);
  }
  navegar();
})();
