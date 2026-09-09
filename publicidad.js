/* Publicidad del sitio (Google AdSense).

   Un solo archivo para todas las páginas. Cada una lo incluye con
     <script defer src="publicidad.js"></script>       (la portada)
     <script defer src="../publicidad.js"></script>    (cada juego)

   PARA ENCENDERLA HAY UN SOLO LUGAR QUE TOCAR: las dos constantes de acá
   abajo. Con EDITOR vacío este archivo NO HACE NADA: no carga nada de
   Google, no pone cookies y el hueco del banner queda con su cartelito.
   Así el sitio funciona igual mientras AdSense revisa la cuenta.

   El script de poner-publicidad.py escribe estas dos líneas solo; también
   se pueden editar a mano.

   Dónde sale el anuncio: en cualquier elemento con data-anuncio="banner".
   Hoy lo tiene el hueco de abajo de Ruta al Podio. Para poner uno en otra
   página alcanza con agregarle ese atributo a un div. */
(function () {
    "use strict";

    // ===================== LO UNICO QUE SE CAMBIA =====================
    var EDITOR = "ca-pub-6113562135089306";            // "ca-pub-1234567890123456"
    var BLOQUE_BANNER = "";     // "1234567890"  (el data-ad-slot del bloque 320x50)
    // ==================================================================

    if (!EDITOR || EDITOR.indexOf("ca-pub-") !== 0) return;
    if (window.__publicidadLista) return;
    window.__publicidadLista = true;

    // 1. El cargador de AdSense, una sola vez por página.
    var cargador = document.createElement("script");
    cargador.async = true;
    cargador.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" +
                   encodeURIComponent(EDITOR);
    cargador.crossOrigin = "anonymous";
    document.head.appendChild(cargador);

    // 2. Los huecos. Sin número de bloque no se toca nada: queda el cartelito.
    if (!BLOQUE_BANNER) return;

    function llenar() {
        var huecos = document.querySelectorAll('[data-anuncio="banner"]');
        for (var i = 0; i < huecos.length; i++) {
            var hueco = huecos[i];
            if (hueco.getAttribute("data-anuncio-puesto")) continue;
            hueco.setAttribute("data-anuncio-puesto", "1");
            hueco.innerHTML = "";
            var ins = document.createElement("ins");
            ins.className = "adsbygoogle";
            ins.style.display = "inline-block";
            ins.style.width = "320px";
            ins.style.height = "50px";
            ins.setAttribute("data-ad-client", EDITOR);
            ins.setAttribute("data-ad-slot", BLOQUE_BANNER);
            hueco.appendChild(ins);
            try {
                (window.adsbygoogle = window.adsbygoogle || []).push({});
            } catch (e) {
                /* si el bloqueador de anuncios lo corta, el hueco queda vacío
                   y la página sigue andando igual */
            }
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", llenar);
    } else {
        llenar();
    }
})();
