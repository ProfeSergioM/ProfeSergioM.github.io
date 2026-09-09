#!/usr/bin/env python3
"""Enciende (o apaga) la publicidad de Google en todo el sitio.

    python poner-publicidad.py ca-pub-1234567890123456 1234567890
    python poner-publicidad.py ca-pub-1234567890123456      (sin bloque todavia)
    python poner-publicidad.py --apagar

El primer numero es el EDITOR, el que da AdSense al crear la cuenta.
El segundo es el data-ad-slot del bloque de 320x50, que recien existe
despues de crear el bloque. Se puede correr dos veces: primero con el
editor solo, para que AdSense pueda verificar el sitio, y despues con el
bloque, cuando ya este aprobado.

Que toca, todo en este mismo repositorio:

  publicidad.js     escribe EDITOR y BLOQUE_BANNER
  *.html            mete <meta name="google-adsense-account"> en el <head>
                    y <script defer src=".../publicidad.js"> antes de </body>
  ads.txt           lo crea en la raiz con la linea que pide AdSense

Es idempotente: correrlo de nuevo actualiza en vez de duplicar.

Ojo: ruta-al-podio/index.html se regenera al exportar el juego desde Godot.
Por eso el script tambien parchea el original, ../ruta-al-podio/web/portada.html,
si esta a mano.
"""

import os
import re
import sys

RAIZ = os.path.dirname(os.path.abspath(__file__))
PORTADA_GODOT = os.path.join(RAIZ, "..", "ruta-al-podio", "web", "portada.html")

META = 'google-adsense-account'
# juego.html es la cascara de Godot y vive dentro de un marco: ahi no va nada.
SALTAR = {"ruta-al-podio/juego.html"}


def paginas():
    salida = []
    for base, dirs, archivos in os.walk(RAIZ):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for a in archivos:
            if not a.endswith(".html"):
                continue
            ruta = os.path.join(base, a)
            rel = os.path.relpath(ruta, RAIZ).replace("\\", "/")
            if rel in SALTAR:
                continue
            salida.append((rel, ruta))
    return sorted(salida)


def leer(ruta):
    with open(ruta, encoding="utf8") as f:
        return f.read()


def escribir(ruta, texto):
    with open(ruta, "w", encoding="utf8", newline="\n") as f:
        f.write(texto)


def poner_meta(html, editor):
    """La etiqueta con la que AdSense verifica que el sitio es tuyo."""
    linea = '<meta name="%s" content="%s">' % (META, editor)
    viejo = re.search(r'[ \t]*<meta name="%s"[^>]*>\n?' % META, html)
    if viejo:
        if not editor:
            return html.replace(viejo.group(0), "")
        return html.replace(viejo.group(0), viejo.group(0)[:len(viejo.group(0)) - len(viejo.group(0).lstrip())] + linea + "\n")
    if not editor:
        return html
    m = re.search(r'([ \t]*)<title>.*?</title>\n', html, re.S)
    if not m:
        m = re.search(r'([ \t]*)<meta charset[^>]*>\n', html)
    if not m:
        print("   (sin <head> reconocible, se salta la etiqueta)")
        return html
    return html[:m.end()] + m.group(1) + linea + "\n" + html[m.end():]


def poner_script(html, rel):
    """El <script> compartido, con la ruta relativa que corresponda."""
    hacia = "publicidad.js" if "/" not in rel else "../publicidad.js"
    linea = '<script defer src="%s"></script>' % hacia
    if re.search(r'<script[^>]*publicidad\.js', html):
        return re.sub(r'<script[^>]*publicidad\.js[^>]*>\s*</script>', linea, html)
    m = re.search(r'([ \t]*)</body>', html)
    if not m:
        print("   (sin </body>, se salta el script)")
        return html
    return html[:m.start()] + m.group(1) + linea + "\n" + html[m.start():]


def main():
    args = [a for a in sys.argv[1:] if a]
    apagar = "--apagar" in args
    args = [a for a in args if a != "--apagar"]
    editor = "" if apagar else (args[0] if args else "")
    bloque = "" if apagar else (args[1] if len(args) > 1 else "")

    if editor and not re.fullmatch(r"ca-pub-\d{16}", editor):
        print("El numero de editor se ve raro: %r" % editor)
        print("Tiene que ser ca-pub- y dieciseis digitos, tal cual lo da AdSense.")
        return 1
    if bloque and not re.fullmatch(r"\d{6,20}", bloque):
        print("El numero del bloque se ve raro: %r (van solo digitos)" % bloque)
        return 1

    # 1. publicidad.js
    ruta = os.path.join(RAIZ, "publicidad.js")
    js = leer(ruta)
    js = re.sub(r'var EDITOR = "[^"]*";', 'var EDITOR = "%s";' % editor, js, count=1)
    js = re.sub(r'var BLOQUE_BANNER = "[^"]*";', 'var BLOQUE_BANNER = "%s";' % bloque, js, count=1)
    escribir(ruta, js)
    print("publicidad.js  editor=%s  bloque=%s" % (editor or "(vacio)", bloque or "(vacio)"))

    # 2. las paginas
    for rel, ruta in paginas():
        html = leer(ruta)
        nuevo = poner_script(poner_meta(html, editor), rel)
        if nuevo != html:
            escribir(ruta, nuevo)
            print("  %s  al dia" % rel)
        else:
            print("  %s  ya estaba" % rel)

    # 3. el original del juego, que se copia al exportar
    if os.path.exists(PORTADA_GODOT):
        html = leer(PORTADA_GODOT)
        nuevo = poner_script(poner_meta(html, editor), "ruta-al-podio/index.html")
        if nuevo != html:
            escribir(PORTADA_GODOT, nuevo)
            print("  portada.html del proyecto de Godot  al dia")

    # 4. ads.txt
    ads = os.path.join(RAIZ, "ads.txt")
    if editor:
        escribir(ads, "google.com, %s, DIRECT, f08c47fec0942fa0\n" % editor.replace("ca-pub-", "pub-"))
        print("ads.txt  escrito")
    elif os.path.exists(ads):
        os.remove(ads)
        print("ads.txt  borrado")

    print("")
    if editor and bloque:
        print("Listo. Falta: git add -A && git commit && git push.")
    elif editor:
        print("Listo para que AdSense verifique el sitio.")
        print("Cuando aprueben, crea el bloque de 320x50 y corre esto de nuevo")
        print("con el numero del bloque como segundo argumento.")
        print("Falta: git add -A && git commit && git push.")
    else:
        print("Publicidad apagada. El sitio no carga nada de Google.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
