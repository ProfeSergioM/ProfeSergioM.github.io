/* Banner compartido: botón para volver a la portada.
   Se incluye en cada proyecto con  <script defer src="../volver.js"></script>

   La esquina se elige con data-pos, porque cada juego tiene su interfaz ocupada
   en un lado distinto:  data-pos="top-left" (por defecto) | "top-right"
                         "bottom-left" | "bottom-right"

   Es autocontenido a propósito: no hereda ni pisa los estilos de cada juego. */
(function () {
  "use strict";

  if (window.__volverListo) return;
  window.__volverListo = true;

  var propio = document.currentScript ||
               document.querySelector('script[src$="volver.js"]');
  var pos = (propio && propio.getAttribute("data-pos")) || "top-left";

  var ESQUINAS = {
    "top-left":     ["top:calc(env(safe-area-inset-top,0px) + 10px);",
                     "left:calc(env(safe-area-inset-left,0px) + 10px);"],
    "top-right":    ["top:calc(env(safe-area-inset-top,0px) + 10px);",
                     "right:calc(env(safe-area-inset-right,0px) + 10px);"],
    "bottom-left":  ["bottom:calc(env(safe-area-inset-bottom,0px) + 10px);",
                     "left:calc(env(safe-area-inset-left,0px) + 10px);"],
    "bottom-right": ["bottom:calc(env(safe-area-inset-bottom,0px) + 10px);",
                     "right:calc(env(safe-area-inset-right,0px) + 10px);"]
  };
  var coords = (ESQUINAS[pos] || ESQUINAS["top-left"]).join("\n  ");

  var CSS = [
    "#volver-portada{",
    "  position:fixed;",
    "  " + coords,
    "  z-index:2147483647;",
    "  display:inline-flex;align-items:center;gap:6px;",
    "  padding:7px 12px 7px 10px;",
    "  font:600 12px/1 Helvetica,Arial,sans-serif;",
    "  letter-spacing:.04em;text-transform:uppercase;text-decoration:none;",
    "  color:#F3ECE6;background:rgba(10,7,16,.72);",
    "  border:1px solid rgba(243,236,230,.28);border-radius:999px;",
    "  -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);",
    "  box-shadow:0 4px 14px rgba(0,0,0,.45);",
    "  opacity:.62;cursor:pointer;",
    "  transition:opacity .18s ease,transform .18s ease,border-color .18s ease;",
    "  -webkit-tap-highlight-color:transparent;",
    "}",
    "#volver-portada:hover,#volver-portada:focus-visible{",
    "  opacity:1;transform:translateY(-1px);",
    "  border-color:rgba(0,229,255,.55);outline:none;",
    "}",
    "#volver-portada .vp-flecha{font-size:14px;line-height:1;color:#FF2350;}",
    /* en pantallas chicas achicamos para no tapar la interfaz del juego */
    "@media (max-width:520px){",
    "  #volver-portada{padding:6px 10px 6px 8px;font-size:10.5px;opacity:.5;}",
    "}",
    "@media (prefers-reduced-motion:reduce){",
    "  #volver-portada{transition:none;}",
    "}"
  ].join("\n");

  function montar() {
    if (document.getElementById("volver-portada")) return;

    var estilo = document.createElement("style");
    estilo.textContent = CSS;
    document.head.appendChild(estilo);

    var a = document.createElement("a");
    a.id = "volver-portada";
    a.href = "../";
    a.setAttribute("aria-label", "Volver a la portada de proyectos");
    a.innerHTML = '<span class="vp-flecha" aria-hidden="true">&larr;</span><span>Proyectos</span>';

    /* Los juegos de canvas escuchan toques en toda la ventana. Sin esto, tocar
       el botón también cuenta como jugada. */
    ["pointerdown", "mousedown", "touchstart", "click"].forEach(function (ev) {
      a.addEventListener(ev, function (e) { e.stopPropagation(); }, true);
    });

    document.body.appendChild(a);
  }

  if (document.body) montar();
  else document.addEventListener("DOMContentLoaded", montar);
})();
