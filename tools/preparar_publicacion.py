"""
Actualiza en sw.js la lista de archivos que se guardan para usar sin internet
y la versión (un resumen del contenido: si cambia cualquier archivo, cambia la
versión y los equipos descargan la app nueva la próxima vez que la abren).

Correr después de cualquier cambio en la app, antes de publicarla:
    ..\\python.exe tools\\preparar_publicacion.py      (desde la carpeta pwa)
"""

import hashlib
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
FUERA = {"sw.js"}
CARPETAS_FUERA = {"tools", "tests"}
EXT_FUERA = {".py", ".txt", ".md"}


def archivos() -> list[str]:
    salida = []
    for p in sorted(RAIZ.rglob("*")):
        rel = p.relative_to(RAIZ).as_posix()
        if (not p.is_file() or rel in FUERA or rel.split("/")[0] in CARPETAS_FUERA
                or p.suffix in EXT_FUERA or rel.startswith(".")):
            continue
        salida.append(rel)
    return salida


def main() -> None:
    lista = archivos()
    h = hashlib.sha256()
    for rel in lista:
        h.update(rel.encode())
        h.update((RAIZ / rel).read_bytes())
    version = h.hexdigest()[:12]
    sw = RAIZ / "sw.js"
    texto = sw.read_text(encoding="utf-8")
    entradas = "\n".join(f"  './{rel}'," for rel in ["", *[r for r in lista if r != "index.html"]])
    entradas = entradas.replace("  './',", "  './',", 1)
    texto = re.sub(r"const VERSION = '[^']*';", f"const VERSION = '{version}';", texto)
    texto = re.sub(r"const ARCHIVOS = \[\n.*?\n\];", f"const ARCHIVOS = [\n{entradas}\n];", texto, flags=re.S)
    sw.write_text(texto, encoding="utf-8")
    print(f"sw.js: versión {version}, {len(lista)} archivos")


if __name__ == "__main__":
    main()
