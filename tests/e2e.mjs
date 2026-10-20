// Prueba de punta a punta en Edge sin ventana (tablet 800×1280 y celular 390×844).
// No trae datos: se le pasa un respaldo (p. ej. el de tools/exportar_respaldo.py).
//
//   1) servir la app:   cd pwa && ..\python.exe -m http.server 8790 --bind 127.0.0.1
//   2) en una carpeta con `npm install playwright-core` (no baja navegadores: usa Edge):
//      node <ruta>/pwa/tests/e2e.mjs <respaldo.json> [carpeta-salida] [url]
//
// Usa las guías de ../docs/referencia (sep-oct y nov-dic 2026).

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(path.join(process.cwd(), 'x.js'));
const { chromium } = require('playwright-core');
const aqui = path.dirname(fileURLToPath(import.meta.url));
const REF = path.join(aqui, '../../docs/referencia');
const [RESPALDO, OUT = path.join(process.cwd(), 'e2e-salida'), URL0 = 'http://127.0.0.1:8790/'] = process.argv.slice(2);
if (!RESPALDO) { console.log('Falta el respaldo.json'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const ICONO = path.join(aqui, '../icons/icono-512.png');
const errores = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + m); if (!c) process.exitCode = 1; };
const vigilar = (p) => {
  p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  p.on('pageerror', (e) => errores.push('pageerror: ' + e.message));
  p.on('dialog', (d) => d.accept());
};

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({ viewport: { width: 800, height: 1280 }, hasTouch: true, isMobile: true, acceptDownloads: true });
const page = await ctx.newPage();
vigilar(page);

// 1. Primera vez -> Respaldo; cargar respaldo
await page.goto(URL0);
await page.waitForSelector('h1');
ok(page.url().endsWith('#/respaldo'), 'sin datos abre Respaldo');
await page.setInputFiles('#archivo-respaldo', RESPALDO);
await page.click('#btn-aplicar');
await page.waitForSelector('section.semana');
ok(/#\/mes\/\d{4}-\d\d$/.test(page.url()), 'tras cargar respaldo va a un mes: ' + page.url());
await page.screenshot({ path: OUT + '/01_tablet_mes.png' });

// 2. Guía nov-dic 2026: 9 semanas, sin avisos
await page.goto(URL0 + '#/cargar');
await page.setInputFiles('#archivo', path.join(REF, 'mwb_S_202611.pdf'));
await page.waitForSelector('#vista:not([hidden])', { timeout: 90000 });
ok(await page.locator('.vista-semana').count() === 9, 'guía nov-dic: 9 semanas');
ok(await page.locator('.vista-semana .aviso').count() === 0, 'guía nov-dic: sin avisos');
await page.click('#btn-guardar');
await page.waitForSelector('section.semana');
const nov = page.locator('section.semana').nth(1);
const txtNov = (await nov.textContent()).replace(/\s+/g, ' ');
ok(txtNov.includes('No seamos como Sedequías') && txtNov.includes('Canción 98') && txtNov.includes('Canción 150'), '9-15 nov con Tesoros y canciones 98 / 150');
ok(await nov.locator('.aviso').count() === 0, '9-15 nov sin aviso de horario');

// 3. Asignar, recargar, repetido
await page.goto(URL0 + '#/mes/2026-11');
await page.waitForSelector('section.semana');
const s1 = page.locator('section.semana').first();
const sel = s1.locator('select.nombre').first();
await sel.selectOption({ index: 3 });
const elegido = await sel.inputValue();
await page.waitForTimeout(300);
await page.goto(URL0 + '?r=1#/mes/2026-11');
await page.waitForSelector('section.semana');
ok(elegido && await page.locator('section.semana').first().locator('select.nombre').first().inputValue() === elegido, 'nombre guardado tras recargar');
const sels = page.locator('section.semana').first().locator('select.nombre');
await sels.nth(2).selectOption(elegido);
await page.waitForTimeout(300);
ok(await page.locator('section.semana').first().locator('.repetidos').isVisible(), 'avisa nombre repetido');

// 4. Visita, sin reunión con imagen, partes
const id2 = await page.locator('section.semana').nth(1).getAttribute('data-id');
await page.selectOption(`#s${id2} select[data-campo="tipo"]`, 'visita');
await page.fill(`#s${id2} [data-campo="so_titulo"]`, 'Un discurso de prueba');
await page.press(`#s${id2} [data-campo="so_titulo"]`, 'Tab');
await page.fill(`#s${id2} [data-campo="so_cancion"]`, '77');
await page.press(`#s${id2} [data-campo="so_cancion"]`, 'Tab');
await page.waitForTimeout(400);
const tv = await page.locator(`#s${id2}`).textContent();
ok(tv.includes('Un discurso de prueba') && tv.includes('Canción 77'), 'visita: discurso y canción final');
const id3 = await page.locator('section.semana').nth(2).getAttribute('data-id');
await page.selectOption(`#s${id3} select[data-campo="tipo"]`, 'sin_reunion');
await page.waitForSelector(`#s${id3} .imagen-semana`, { state: 'attached' });
await page.selectOption(`#s${id3} [data-campo="motivo"]`, 'Asamblea de circuito');
await page.setInputFiles(`#s${id3} .imagen-semana`, ICONO);
await page.waitForSelector(`#s${id3} .especial-vista img`);
ok(true, 'sin reunión: imagen visible');
const id4 = await page.locator('section.semana').nth(3).getAttribute('data-id');
await page.locator(`#s${id4} .editar-parte`).first().click();
await page.fill('#dp-minutos', '12');
await page.click('#dp-guardar');
await page.waitForTimeout(400);
ok(await page.locator(`#s${id4} .aviso`).count() > 0, 'cambiar minutos muestra aviso de horario');
await page.locator(`#s${id4} .editar-parte`).first().click();
await page.fill('#dp-minutos', '10');
await page.click('#dp-guardar');
await page.waitForTimeout(400);
ok(await page.locator(`#s${id4} .aviso`).count() === 0, 'volver a 10 min quita el aviso');
await page.locator(`#s${id4} .agregar-parte[data-seccion="maestros"]`).click();
await page.fill('#dp-titulo', 'Parte agregada de prueba');
await page.fill('#dp-minutos', '3');
await page.click('#dp-guardar');
await page.waitForTimeout(400);
ok((await page.locator(`#s${id4}`).textContent()).includes('Parte agregada de prueba'), 'agregar parte');

// 4b. Hermanos: sugerir hermano/hermana, marcar un anciano, menús filtrados
await page.goto(URL0 + '#/hermanos');
await page.waitForSelector('#btn-sugerir');
await page.click('#btn-sugerir');
await page.waitForSelector('#btn-sugerir', { state: 'detached', timeout: 5000 }).catch(() => {});
ok(await page.locator('#btn-sugerir').count() === 0, 'sugerir: no quedan sin clasificar');
await page.screenshot({ path: OUT + '/04_tablet_hermanos.png' });
const filaH = page.locator('tr[data-id]').filter({ has: page.locator('select[data-campo="sexo"] option[value="H"]:checked') }).first();
const nombreAnciano = await filaH.locator('.nombre-persona').inputValue();
await filaH.locator('select[data-campo="cargo"]').selectOption('anciano');
await page.waitForTimeout(300);
await page.goto(URL0 + '#/mes/2026-11');
await page.waitForSelector('section.semana');
const opcPres = await page.locator('section.semana').first().locator('select.nombre').first().locator('option').allTextContents();
ok(opcPres.includes(nombreAnciano) && opcPres.length <= 4, `presidente: solo ancianos en el menú (${opcPres.length - 1} opciones)`);
const opcLectura = await page.locator('section.semana').first().locator('tr', { hasText: 'Lectura de la Biblia' }).locator('select.nombre').locator('option').count();
ok(opcLectura > 5, `lectura: hermanos varones en el menú (${opcLectura - 1})`);
await page.locator('section.semana').first().locator('select.nombre').first().selectOption(nombreAnciano);
await page.waitForTimeout(400);
const oracionFinal = await page.locator('section.semana').first().locator('select.nombre[data-clave="oracion_final"]').inputValue();
ok(oracionFinal === nombreAnciano, 'oración final se pone sola con el presidente');
await page.screenshot({ path: OUT + '/05_tablet_reglas.png', fullPage: true });

// 5. Excel, respaldo, PDF
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-excel')]);
await dl.saveAs(OUT + '/noviembre.xlsx');
ok(fs.statSync(OUT + '/noviembre.xlsx').size > 5000, 'Excel: ' + dl.suggestedFilename());
await page.goto(URL0 + '#/respaldo');
const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#btn-descargar')]);
await dl2.saveAs(OUT + '/respaldo_prueba.json');
const r2 = JSON.parse(fs.readFileSync(OUT + '/respaldo_prueba.json', 'utf8'));
ok(Object.keys(r2.imagenes).length === 1, `respaldo: ${r2.estado.semanas.length} semanas, ${Object.keys(r2.imagenes).length} imagen`);
const imp = await ctx.newPage();
vigilar(imp);
await imp.goto(URL0 + 'imprimir.html?mes=2026-11');
await imp.waitForSelector('.hoja');
await imp.evaluate(() => document.fonts.ready);
await imp.pdf({ path: OUT + '/noviembre.pdf', preferCSSPageSize: true, printBackground: true });
ok(fs.statSync(OUT + '/noviembre.pdf').size > 10000, 'PDF generado');

// 6. Celular y tablet acostada
const tel = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const p2 = await tel.newPage();
vigilar(p2);
await p2.goto(URL0);
await p2.setInputFiles('#archivo-respaldo', OUT + '/respaldo_prueba.json');
await p2.click('#btn-aplicar');
await p2.waitForSelector('section.semana');
ok(await p2.evaluate(() => document.documentElement.scrollWidth) <= 390, 'celular sin scroll horizontal');
await p2.screenshot({ path: OUT + '/02_cel_mes.png' });
await p2.goto(URL0 + '#/hermanos');
await p2.waitForSelector('tr[data-id]');
ok(await p2.evaluate(() => document.documentElement.scrollWidth) <= 390, 'celular: Hermanos sin scroll horizontal');
await p2.screenshot({ path: OUT + '/02b_cel_hermanos.png' });
const hz = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
const p3 = await hz.newPage();
vigilar(p3);
await p3.goto(URL0);
await p3.setInputFiles('#archivo-respaldo', OUT + '/respaldo_prueba.json');
await p3.click('#btn-aplicar');
await p3.waitForSelector('section.semana');
const caja = await p3.locator('section.semana').first().boundingBox();
ok(caja && caja.y < 800, 'tablet acostada: el programa se ve en pantalla');
await p3.screenshot({ path: OUT + '/03_horizontal.png' });

// 7. Sin conexión
await page.goto(URL0 + '#/mes/2026-11');
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForTimeout(1500);
await ctx.setOffline(true);
await page.goto(URL0 + '?r=2#/mes/2026-11');
await page.waitForSelector('section.semana', { timeout: 10000 }).catch(() => {});
ok(await page.locator('section.semana').count() > 0, 'funciona sin conexión');
await ctx.setOffline(false);

console.log('Errores de consola:', errores.length ? errores : 'ninguno');
await browser.close();
