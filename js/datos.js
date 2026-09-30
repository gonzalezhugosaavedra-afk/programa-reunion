// Guardado en el dispositivo (IndexedDB) y respaldo en archivo.
//
// Todo queda en el navegador de este aparato: nada se sube a internet.
// Para pasar los datos entre el PC y la tablet se usa el archivo de respaldo
// (Respaldo → Guardar / Cargar). El mismo formato lo genera
// tools/exportar_respaldo.py desde la app de escritorio.

import { estadoVacio } from './programa.js';

const BD = 'programa-reunion';
const CLAVE = 'principal';

let _bd = null;
function abrir() {
  if (_bd) return _bd;
  _bd = new Promise((ok, mal) => {
    const req = indexedDB.open(BD, 1);
    req.onupgradeneeded = () => {
      const bd = req.result;
      if (!bd.objectStoreNames.contains('estado')) bd.createObjectStore('estado');
      if (!bd.objectStoreNames.contains('imagenes')) bd.createObjectStore('imagenes');
      if (!bd.objectStoreNames.contains('meta')) bd.createObjectStore('meta');
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => mal(req.error);
  });
  return _bd;
}

function tx(almacen, modo, fn) {
  return abrir().then((bd) => new Promise((ok, mal) => {
    const t = bd.transaction(almacen, modo);
    const r = fn(t.objectStore(almacen));
    t.oncomplete = () => ok(r && 'result' in r ? r.result : undefined);
    t.onerror = () => mal(t.error);
    t.onabort = () => mal(t.error || new Error('Transacción cancelada'));
  }));
}

export async function cargarEstado() {
  const e = await tx('estado', 'readonly', (s) => s.get(CLAVE));
  return e || estadoVacio();
}

export async function guardarEstado(e) {
  e.actualizado = new Date().toISOString();
  await tx('estado', 'readwrite', (s) => s.put(e, CLAVE));
}

export const leerMeta = (k) => tx('meta', 'readonly', (s) => s.get(k));
export const guardarMeta = (k, v) => tx('meta', 'readwrite', (s) => s.put(v, k));

// ── Imágenes (semanas sin reunión) ───────────────────────────────────────

export const leerImagen = (id) => tx('imagenes', 'readonly', (s) => s.get(id)); // Blob
export const guardarImagen = (id, blob) => tx('imagenes', 'readwrite', (s) => s.put(blob, id));
export const borrarImagen = (id) => tx('imagenes', 'readwrite', (s) => s.delete(id));

async function todasLasImagenes() {
  const bd = await abrir();
  return new Promise((ok, mal) => {
    const salida = {};
    const req = bd.transaction('imagenes').objectStore('imagenes').openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return ok(salida);
      salida[c.key] = c.value;
      c.continue();
    };
    req.onerror = () => mal(req.error);
  });
}

// Achica fotos grandes para que el respaldo no pese de más (máx. 1800 px).
export async function prepararImagen(archivo) {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(archivo.type)) throw new Error('La imagen debe ser PNG, JPG, WEBP o GIF.');
  const bmp = await createImageBitmap(archivo).catch(() => null);
  if (!bmp) return archivo;
  const lado = Math.max(bmp.width, bmp.height);
  if (lado <= 1800 && archivo.size <= 1.5e6) { bmp.close?.(); return archivo; }
  const k = Math.min(1, 1800 / lado);
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return new Promise((ok) => c.toBlob((b) => ok(b || archivo), 'image/jpeg', 0.88));
}

// ── Respaldo ─────────────────────────────────────────────────────────────

const aBase64 = (blob) => new Promise((ok, mal) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',', 2)[1]);
  r.onerror = () => mal(r.error);
  r.readAsDataURL(blob);
});

function deBase64(b64, tipo) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}

export async function armarRespaldo(e) {
  const imgs = await todasLasImagenes();
  const usadas = new Set(e.semanas.map((s) => s.imagen).filter(Boolean));
  const imagenes = {};
  for (const [id, blob] of Object.entries(imgs)) {
    if (usadas.has(id)) imagenes[id] = { tipo: blob.type || 'image/png', datos: await aBase64(blob) };
  }
  return {
    app: 'programa-reunion',
    formato: 1,
    creado: new Date().toISOString(),
    origen: navigator.userAgent.includes('Android') ? 'Android' : 'computador',
    estado: e,
    imagenes,
  };
}

// Revisa un respaldo antes de cargarlo. Devuelve el objeto o lanza un error claro.
export function validarRespaldo(texto) {
  let r;
  try { r = JSON.parse(texto); } catch { throw new Error('El archivo no es un respaldo válido (no se pudo leer).'); }
  const e = r?.estado;
  if (r?.app !== 'programa-reunion' || !e || !Array.isArray(e.semanas) || !Array.isArray(e.personas)) {
    throw new Error('Ese archivo no es un respaldo de Programa Reunión.');
  }
  if (r.formato > 1) throw new Error('El respaldo es de una versión más nueva de la app. Actualiza la app primero.');
  return r;
}

export async function aplicarRespaldo(r) {
  const bd = await abrir();
  await new Promise((ok, mal) => {
    const t = bd.transaction(['estado', 'imagenes'], 'readwrite');
    t.objectStore('imagenes').clear();
    for (const [id, img] of Object.entries(r.imagenes || {})) {
      t.objectStore('imagenes').put(deBase64(img.datos, img.tipo), id);
    }
    t.objectStore('estado').put(r.estado, CLAVE);
    t.oncomplete = ok;
    t.onerror = () => mal(t.error);
  });
}

// Pide al navegador que no borre los datos si falta espacio.
export async function pedirPersistencia() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch { return null; }
}
