# Programa Reunión

App web instalable (PWA) para armar el programa mensual de la reunión de entre semana
«Vida y Ministerio Cristianos»: lee la guía de actividades en PDF, asigna los puestos,
calcula las horas y exporta a PDF (tamaño Oficio) y Excel.

- Funciona sin internet una vez instalada.
- **Los datos quedan solo en el dispositivo** (IndexedDB del navegador). Este repositorio
  contiene únicamente el código; nada se envía a ningún servidor.
- Para pasar los datos entre equipos: menú Respaldo → Guardar / Cargar.

Tras cambiar cualquier archivo: `python tools/preparar_publicacion.py` (actualiza la lista y
la versión del modo sin conexión en `sw.js`).

Librerías incluidas: pdf.js (Apache-2.0) y ExcelJS (MIT), ver `js/vendor/LEEME.txt`.
Fuentes: Inter, JetBrains Mono, Carlito y Caladea (SIL OFL).
