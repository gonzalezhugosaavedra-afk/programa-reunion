// Service worker: guarda la app en el dispositivo para que funcione sin internet.
// La lista y la versión las escribe tools/preparar_publicacion.py (no editar a mano):
// cada vez que cambia un archivo cambia la versión y los equipos bajan la nueva.

const VERSION = '3e3744d094c1';
const ARCHIVOS = [
  './',
  './css/cajaapp.css',
  './css/programa.css',
  './fonts/caladea-latin-700-normal.woff2',
  './fonts/carlito-latin-400-normal.woff2',
  './fonts/carlito-latin-700-normal.woff2',
  './fonts/fonts.css',
  './fonts/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPx3cwhsk.woff2',
  './fonts/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPx7cwhsk.woff2',
  './fonts/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPx_cwhsk.woff2',
  './fonts/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxDcwg.woff2',
  './fonts/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxPcwhsk.woff2',
  './fonts/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxTcwhsk.woff2',
  './fonts/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa0ZL7SUc.woff2',
  './fonts/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1pL7SUc.woff2',
  './fonts/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2',
  './fonts/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa25L7SUc.woff2',
  './fonts/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa2JL7SUc.woff2',
  './fonts/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa2pL7SUc.woff2',
  './fonts/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa2ZL7SUc.woff2',
  './icons/icono-192.png',
  './icons/icono-512.png',
  './icons/icono-maskable-512.png',
  './icons/icono.svg',
  './imprimir.html',
  './js/app.js',
  './js/datos.js',
  './js/excel.js',
  './js/imprimir.js',
  './js/lector.js',
  './js/programa.js',
  './js/vendor/exceljs.min.js',
  './js/vendor/pdf.min.mjs',
  './js/vendor/pdf.worker.min.mjs',
  './manifest.webmanifest',
  './tests/probar_lector.mjs',
];

const CACHE = `programa-reunion-${VERSION}`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('programa-reunion-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // imprimir.html?mes=… y ./#/… usan la misma página guardada.
    const guardada = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (guardada) return guardada;
    try {
      return await fetch(req);
    } catch (err) {
      if (req.mode === 'navigate') return (await cache.match('./')) || Response.error();
      throw err;
    }
  })());
});
