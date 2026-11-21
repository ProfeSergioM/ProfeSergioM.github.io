// FLETES — vista en tercera persona desde atrás del camión, al estilo "Mode 7" de las consolas de 16 bits.
// El suelo es el mismo de la vista isométrica: como la proyección isométrica es lineal, cada pixel de la
// pantalla se proyecta al piso y se lee de los bloques ya generados. Encima van los edificios y el camión
// como volúmenes sombreados, y los sprites (árboles, postes, autos, semáforos) escalados según la distancia.
(function (G) {
  'use strict';
  const V = {};
  // volcanes en el horizonte: posición en metros del juego (desde su latitud y longitud, con la misma
  // proyección y compresión del mapa) y altura en metros
  V.VOLCANES = [
    { n: 'OSORNO', x: 37297, y: -33637, h: 2652, base: 9000 },     // -41.1035, -72.4931
    { n: 'CALBUCO', x: 27574, y: -8393, h: 2003, base: 9000 },     // -41.3308, -72.6095
    { n: 'PUNTIAGUDO', x: 56376, y: -48553, h: 2493, base: 4500 }, // -40.9692, -72.2647
  ];

  V.crear = function (d) {
    const { ctx, W, H, GR, M, N } = d;
    const S = GR.S, CS = 128;
    const img = ctx.createImageData(W, H), buf = new Uint32Array(img.data.buffer);
    const FOV = 1.2, F = (W / 2) / Math.tan(FOV / 2), cx = W / 2, cy = Math.round(H * 0.42);
    const LEJOS = 175, NIEBLA0 = 70;
    const ISO_VISTA = -3 * Math.PI / 4; // la cámara isométrica mira desde +x+y hacia -x-y
    const P = GR.packH;
    // cámara suavizada
    const c3 = { x: 0, y: 0, z: 9, ang: 0, ok: false };
    let Cx = 0, Cy = 0, Cz = 9, fx = 0, fy = 0, fz = 0, rx = 0, ry = 0, dx = 0, dy = 0, dz = 0, cT = 1, sT = 0;

    function camara(dt) {
      const cam = d.cam();
      const ha = cam.a;
      if (!c3.ok) { c3.ang = ha; c3.ok = true; }
      let da = ha - c3.ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      c3.ang += da * Math.min(1, dt * 2.6);
      const F = N.ficha(cam), largo = cam.remolque ? 16.5 : F.largo;
      // como en la primera vista (la del tracto: 30 m atrás y 12,5 de alto); los vehículos chicos, algo más cerca,
      // pero no tanto: de cerca el suelo y los sprites se agrandan demasiado y se ven pixelados
      const D = 16 + largo * 0.85, Hc = 7 + largo * 0.34;
      const ca = Math.cos(c3.ang), sa = Math.sin(c3.ang);
      const tx = cam.x + Math.cos(ha) * 2, ty = cam.y + Math.sin(ha) * 2;
      const nx = tx - ca * D, ny = ty - sa * D;
      c3.x += (nx - c3.x) * Math.min(1, dt * 6); c3.y += (ny - c3.y) * Math.min(1, dt * 6);
      if (Math.hypot(nx - c3.x, ny - c3.y) > 30) { c3.x = nx; c3.y = ny; } // salto (cambio de vista o reubicación)
      c3.z = Hc;
      const pitch = Math.atan2(Hc - 1, D + 16);
      Cx = c3.x; Cy = c3.y; Cz = c3.z; cT = Math.cos(pitch); sT = Math.sin(pitch);
      fx = ca * cT; fy = sa * cT; fz = -sT;            // adelante
      rx = -sa; ry = ca;                                // derecha (en el suelo)
      dx = -ca * sT; dy = -sa * sT; dz = -cT;           // abajo de la pantalla
    }
    // mundo → pantalla: [sx, sy, profundidad]
    function proy(x, y, z) {
      const X = x - Cx, Y = y - Cy, Z = z - Cz;
      const p = X * fx + Y * fy + Z * fz;
      if (p < 0.5) return null;
      return [cx + F * (X * rx + Y * ry) / p, cy + F * (X * dx + Y * dy + Z * dz) / p, p];
    }
    V.proy = proy;

    // ---------- cielo, cerros lejanos y suelo ----------
    const CIELO0 = [90, 140, 210], CIELO1 = [196, 214, 232], BRUMA = [188, 204, 220];
    const pk = (r, g, b) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
    const brumaP = pk(...BRUMA), campoP = P('#5c9a3a');
    function cerro(b) { // silueta de cerros bajos alrededor (ruido suave según el rumbo)
      return 3 + 4 * (Math.sin(b * 3) * 0.5 + 0.5) * (Math.sin(b * 7.3 + 1) * 0.3 + 0.7) + 2 * Math.sin(b * 17 + 2);
    }
    function suelo(faltan) {
      const filaH = cy - F * sT / cT; // fila del horizonte
      const cerroP = pk(120, 150, 150), cerroP2 = pk(140, 168, 168);
      for (let sy = 0; sy < H; sy++) {
        const k = (sy - cy) / F;
        const rz = fz + dz * k; // componente vertical del rayo (centro de la fila)
        const row = sy * W;
        if (rz > -1e-3 || Cz / -rz > LEJOS + 40) { // cielo
          const t = Math.max(0, Math.min(1, (sy - filaH + 70) / 70));
          const col = pk(CIELO0[0] + (CIELO1[0] - CIELO0[0]) * t | 0, CIELO0[1] + (CIELO1[1] - CIELO0[1]) * t | 0, CIELO0[2] + (CIELO1[2] - CIELO0[2]) * t | 0);
          for (let sx = 0; sx < W; sx++) {
            // cerros lejanos pegados al horizonte
            const b = c3.ang + Math.atan((sx - cx) / F), alto = filaH - sy;
            const hc = cerro(b);
            buf[row + sx] = alto >= 0 && alto < hc ? (alto < hc - 1.5 ? cerroP : cerroP2) : (alto < 0 ? brumaP : col);
          }
          continue;
        }
        const t = Cz / -rz; // distancia a lo largo del rayo central (la profundidad)
        const ax = fx + dx * k, ay = fy + dy * k;
        // punto del suelo para sx: (Cx + t*(ax + rx*(sx-cx)/F), Cy + t*(ay + ry*(sx-cx)/F))
        const gx0 = Cx + t * (ax - rx * cx / F), gy0 = Cy + t * (ay - ry * cx / F), gdx = t * rx / F, gdy = t * ry / F;
        let u = (gx0 - gy0) * S, v = (gx0 + gy0) / 2 * S;
        const du = (gdx - gdy) * S, dv = (gdx + gdy) / 2 * S;
        const niebla = Math.max(0, Math.min(1, (t - NIEBLA0) / (LEJOS - NIEBLA0)));
        let lcu = 1e9, lcv = 1e9, px = null;
        for (let sx = 0; sx < W; sx++, u += du, v += dv) {
          const cu = Math.floor(u / CS), cv = Math.floor(v / CS);
          if (cu !== lcu || cv !== lcv) { lcu = cu; lcv = cv; px = d.suelo.pixeles(cu, cv); if (!px) faltan.add(cu + ',' + cv); }
          let col = px ? px[((v - cv * CS) | 0) * CS + ((u - cu * CS) | 0)] : campoP;
          if (niebla > 0) col = GR.mixP(col, brumaP, niebla * niebla);
          buf[row + sx] = col;
        }
      }
      ctx.putImageData(img, 0, 0);
      return filaH;
    }
    function volcanes(filaH) {
      for (const vo of V.VOLCANES) {
        const ddx = vo.x - Cx, ddy = vo.y - Cy, dist = Math.hypot(ddx, ddy);
        let rel = Math.atan2(ddy, ddx) - c3.ang; while (rel > Math.PI) rel -= 2 * Math.PI; while (rel < -Math.PI) rel += 2 * Math.PI;
        if (Math.abs(rel) > FOV / 2 + 0.4) continue;
        const sx = cx + F * Math.tan(rel);
        const alto = Math.max(10, F * vo.h * 1.7 / dist), ancho = Math.max(26, F * vo.base / dist);
        ctx.fillStyle = '#7c8ea8';
        ctx.beginPath(); ctx.moveTo(sx - ancho, filaH + 1); ctx.lineTo(sx - ancho * 0.12, filaH - alto); ctx.lineTo(sx + ancho * 0.1, filaH - alto); ctx.lineTo(sx + ancho, filaH + 1); ctx.fill();
        ctx.fillStyle = '#f2f6fc'; // nieve en la cumbre
        ctx.beginPath(); ctx.moveTo(sx - ancho * 0.4, filaH - alto * 0.55); ctx.lineTo(sx - ancho * 0.12, filaH - alto); ctx.lineTo(sx + ancho * 0.1, filaH - alto);
        ctx.lineTo(sx + ancho * 0.38, filaH - alto * 0.55); ctx.lineTo(sx + ancho * 0.2, filaH - alto * 0.62); ctx.lineTo(sx, filaH - alto * 0.5); ctx.lineTo(sx - ancho * 0.22, filaH - alto * 0.62); ctx.fill();
        ctx.fillStyle = 'rgba(188,204,220,0.35)'; ctx.fillRect(Math.round(sx - ancho), Math.round(filaH - alto * 0.25), Math.round(ancho * 2), Math.round(alto * 0.25) + 1);
      }
    }

    // ---------- volúmenes sombreados ----------
    const LUZ = [-0.45, -0.6, 0.66];
    const rgb = (c, f) => `rgb(${Math.min(255, c[0] * f) | 0},${Math.min(255, c[1] * f) | 0},${Math.min(255, c[2] * f) | 0})`;
    function poligono(pts, fill, borde) {
      ctx.fillStyle = fill; ctx.beginPath();
      for (let i = 0; i < pts.length; i++) i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.closePath(); ctx.fill();
      if (borde) { ctx.strokeStyle = borde; ctx.lineWidth = 1; ctx.stroke(); }
    }
    // caja orientada: origen (ox,oy), rumbo a, largo [x0,x1] hacia adelante, ancho [y0,y1] a la derecha, alto [z0,z1]
    function caja(ox, oy, a, x0, x1, y0, y1, z0, z1, col, colFrente) {
      const ca = Math.cos(a), sa = Math.sin(a);
      const w = (lx, ly) => [ox + ca * lx - sa * ly, oy + sa * lx + ca * ly];
      const base = [w(x0, y0), w(x1, y0), w(x1, y1), w(x0, y1)];
      const pr = (p, z) => proy(p[0], p[1], z);
      const abajo = base.map(p => pr(p, z0)), arriba = base.map(p => pr(p, z1));
      if (abajo.some(q => !q) || arriba.some(q => !q)) return;
      const caras = [];
      // laterales: 0-1 (y0: izquierda), 1-2 (x1: frente), 2-3 (y1: derecha), 3-0 (x0: atrás)
      const nrm = [[sa, -ca], [ca, sa], [-sa, ca], [-ca, -sa]];
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4, mx = (base[i][0] + base[j][0]) / 2, my = (base[i][1] + base[j][1]) / 2;
        if ((Cx - mx) * nrm[i][0] + (Cy - my) * nrm[i][1] <= 0) continue;
        const f = 0.55 + 0.45 * Math.max(0, nrm[i][0] * LUZ[0] + nrm[i][1] * LUZ[1]);
        caras.push([[abajo[i], abajo[j], arriba[j], arriba[i]], rgb(i === 1 && colFrente ? colFrente : col, f)]);
      }
      if (Cz > z1) caras.push([arriba, rgb(col, 1.05)]);
      for (const [pts, c] of caras) poligono(pts, c, 'rgba(12,12,16,0.85)');
    }
    function edificio(b, idx) {
      const n = b.pts.length;
      const abajo = [], arriba = [];
      for (const p of b.pts) { const q0 = proy(p[0], p[1], 0), q1 = proy(p[0], p[1], b.h); if (!q0 || !q1 || q0[2] < 2) return; abajo.push(q0); arriba.push(q1); }
      const { pared, techo } = GR.colorEdificio(b, idx);
      let area = 0; for (let k = 0, m = n - 1; k < n; m = k++) area += b.pts[m][0] * b.pts[k][1] - b.pts[k][0] * b.pts[m][1];
      const sg = area > 0 ? 1 : -1;
      const muros = [];
      for (let k = 0, m = n - 1; k < n; m = k++) {
        const [ax, ay] = b.pts[m], [bx, by] = b.pts[k];
        let nx = (by - ay) * sg, ny = -(bx - ax) * sg; const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        if ((Cx - mx) * nx + (Cy - my) * ny <= 0) continue;
        muros.push({ m, k, nx, ny, L, d: Math.hypot(mx - Cx, my - Cy) });
      }
      muros.sort((p, q) => q.d - p.d);
      for (const w of muros) {
        const f = 0.55 + 0.45 * Math.max(0, w.nx * LUZ[0] + w.ny * LUZ[1]);
        poligono([abajo[w.m], abajo[w.k], arriba[w.k], arriba[w.m]], rgb(pared, f), 'rgba(16,12,20,0.7)');
        // pisos: una línea de ventanas por cada 3 m
        const pisos = Math.floor(b.h / 3);
        if (pisos > 0 && abajo[w.m][2] < 90) {
          ctx.strokeStyle = 'rgba(40,56,84,0.55)'; ctx.lineWidth = 1; ctx.beginPath();
          for (let q = 0; q < pisos; q++) {
            const z = q * 3 + 1.6, A = proy(b.pts[w.m][0], b.pts[w.m][1], z), B = proy(b.pts[w.k][0], b.pts[w.k][1], z);
            if (A && B) { ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); }
          }
          ctx.stroke();
        }
      }
      if (Cz > b.h) poligono(arriba, rgb(techo, 1), 'rgba(16,12,20,0.7)');
    }
    const LIBREA = { rojo: [212, 42, 42], blanco: [236, 238, 242], azul: [42, 88, 192], verde: [42, 138, 74] };
    // volúmenes de cada vehículo (x hacia adelante desde el eje trasero, y a la derecha, z arriba)
    const OSC = [40, 40, 46], NEU = [24, 24, 28], VID = [70, 110, 150], BLA = [232, 234, 240], PIEL = [232, 184, 144], MET = [150, 154, 164];
    function partes(tipo, col, cargado) {
      const rue = (x, r, w, y0) => [[x - r, x + r, y0, y0 + w], [x - r, x + r, -y0 - w, -y0]];
      const ruedas = (xs, r, y0, w) => { const o = []; for (const x of xs) for (const [a, b, c, e] of rue(x, r, w, y0)) o.push([a, b, c, e, 0, r * 2, NEU]); return o; };
      switch (tipo) {
        case 'bici': return [[-0.33, 0.33, -0.04, 0.04, 0, 0.66, NEU], [0.72, 1.38, -0.04, 0.04, 0, 0.66, NEU], [-0.1, 1.15, -0.05, 0.05, 0.35, 0.7, MET],
          [0.15, 0.55, -0.2, 0.2, 0.85, 1.45, col.map(v => v * 0.75)], [0.25, 0.5, -0.11, 0.11, 1.45, 1.72, PIEL], [-0.2, 0.15, -0.2, 0.2, 0.95, 1.45, col]];
        case 'moto': return [[-0.32, 0.32, -0.07, 0.07, 0, 0.62, NEU], [1.03, 1.67, -0.07, 0.07, 0, 0.62, NEU], [0.1, 1.3, -0.25, 0.25, 0.35, 0.85, col],
          [0.35, 0.8, -0.22, 0.22, 0.85, 1.4, OSC], [0.45, 0.78, -0.15, 0.15, 1.4, 1.72, col], [-0.45, 0.1, -0.27, 0.27, 0.7, 1.25, BLA]];
        case 'auto': return [...ruedas([0, 2.4], 0.3, 0.65, 0.2), [-0.65, 3.1, -0.85, 0.85, 0.3, 0.95, col], [0.3, 2.2, -0.75, 0.75, 0.95, 1.48, col, VID]];
        case 'furgon': return [...ruedas([0, 3.0], 0.34, 0.75, 0.22), [-1.05, 3.0, -0.97, 0.97, 0.4, 2.3, BLA], [3.0, 3.9, -0.97, 0.97, 0.4, 1.9, col, VID],
          [-1.06, 2.95, -0.99, -0.95, 1.0, 1.25, col], [-1.06, 2.95, 0.95, 0.99, 1.0, 1.25, col]];
        case 'camioneta': { const p = [...ruedas([0, 3.1], 0.36, 0.72, 0.22), [-1.2, 1.5, -0.92, 0.92, 0.45, 1.0, col], [1.5, 3.55, -0.92, 0.92, 0.45, 1.85, col, VID], [3.55, 4.1, -0.9, 0.9, 0.45, 1.1, col]];
          if (cargado) p.push([-1.05, 1.35, -0.75, 0.75, 1.0, 1.55, [150, 108, 60]]); return p; }
        case 'tres4': return [...ruedas([0, 3.4], 0.42, 0.8, 0.26), [-1.8, 4.6, -0.9, 0.9, 0.5, 0.9, OSC], [-1.8, 3.2, -1.05, 1.05, 0.9, 3.0, BLA], [3.3, 4.6, -1.02, 1.02, 0.6, 2.6, col, VID],
          [-1.81, 3.15, -1.07, -1.03, 1.6, 1.9, col], [-1.81, 3.15, 1.03, 1.07, 1.6, 1.9, col]];
        case 'rigido': return [...ruedas([0, -1.2, 4.8], 0.5, 0.95, 0.3), [-2.5, 6.3, -1.0, 1.0, 0.6, 1.0, OSC], [-2.5, 4.7, -1.25, 1.25, 1.0, 3.6, BLA], [4.8, 6.3, -1.25, 1.25, 0.6, 3.0, col, VID],
          [-2.51, 4.65, -1.27, -1.23, 1.9, 2.3, col], [-2.51, 4.65, 1.23, 1.27, 1.9, 2.3, col]];
      }
      return [];
    }
    function vehiculo() {
      const cam = d.cam(), F = N.ficha(cam), col = GR.hex(d.colorEmpresa());
      const ps = partes(cam.tipo, col, cam.cargado).map(p => [cam.x, cam.y, cam.a, ...p]);
      // sombra
      { const ca = Math.cos(cam.a), sa = Math.sin(cam.a), w = F.ancho / 2; const pts = [[-F.cola, -w], [F.frente, -w], [F.frente, w], [-F.cola, w]].map(([lx, ly]) => proy(cam.x + ca * lx - sa * ly + 0.4, cam.y + sa * lx + ca * ly + 0.3, 0)); if (pts.every(Boolean)) poligono(pts, 'rgba(0,0,0,0.28)'); }
      ps.sort((p, q) => { const cp = o => { const ca = Math.cos(o[2]), sa = Math.sin(o[2]), lx = (o[3] + o[4]) / 2, ly = (o[5] + o[6]) / 2; return Math.hypot(o[0] + ca * lx - sa * ly - Cx, o[1] + sa * lx + ca * ly - Cy); }; return cp(q) - cp(p); });
      for (const p of ps) caja(...p);
      if (cam.freno && Math.abs(cam.v) > 0.3 || cam.atras) {
        const ca = Math.cos(cam.a), sa = Math.sin(cam.a), w = Math.min(1.1, F.ancho / 2 - 0.15);
        for (const lado of (w < 0.4 ? [0] : [-1, 1])) { const q = proy(cam.x - ca * F.cola - sa * lado * w, cam.y - sa * F.cola + ca * lado * w, Math.min(1.2, F.alto * 0.45)); if (q) { const r = Math.max(1, 6 / q[2] * 3); ctx.fillStyle = cam.atras ? '#ffffff' : '#ff2020'; ctx.fillRect(q[0] - r / 2, q[1] - r / 2, r, r); } }
      }
    }
    function camion() {
      const cam = d.cam(), C = N.CAMION, enc = d.encargo();
      if (cam.tipo !== 'tracto') { vehiculo(); return; }
      const partes = [];
      const hx = cam.x + Math.cos(cam.a) * C.quinta, hy = cam.y + Math.sin(cam.a) * C.quinta;
      const col = GR.hex(d.colorEmpresa()), oscuro = [40, 40, 46], vidrio = [70, 110, 150];
      // tracto
      partes.push([cam.x, cam.y, cam.a, -C.cola, C.frente - 0.2, -1.15, 1.15, 0.45, 1.25, oscuro]);
      partes.push([cam.x, cam.y, cam.a, 2.9, C.frente, -1.25, 1.25, 1.25, 3.75, col, vidrio]);
      for (const ex of [0, C.L1]) for (const lado of [-1, 1]) partes.push([cam.x, cam.y, cam.a, ex - 0.5, ex + 0.5, lado > 0 ? 0.95 : -1.3, lado > 0 ? 1.3 : -0.95, 0, 1.0, [24, 24, 28]]);
      if (cam.remolque && enc) {
        const tipo = enc.rem, cols = GR.REMOLQUES[tipo], rc = GR.hex(cols[enc.col % cols.length]);
        const x0 = -(C.L2 + C.remCola), x1 = C.remFrente;
        if (tipo === 'plataforma') {
          partes.push([hx, hy, cam.a2, x0, x1, -1.27, 1.27, 1.15, 1.45, [58, 58, 68]]);
          partes.push([hx, hy, cam.a2, x0 + 0.6, x1 - 0.6, -1.15, 1.15, 1.45, 2.7, [168, 118, 58]]);
        } else partes.push([hx, hy, cam.a2, x0, x1, -1.27, 1.27, tipo === 'cisterna' ? 1.35 : 1.15, tipo === 'cisterna' ? 3.5 : 4.0, rc]);
        for (const ex of [-C.L2 - 1.2, -C.L2, -C.L2 + 1.2]) for (const lado of [-1, 1]) partes.push([hx, hy, cam.a2, ex - 0.45, ex + 0.45, lado > 0 ? 0.95 : -1.3, lado > 0 ? 1.3 : -0.95, 0, 1.0, [24, 24, 28]]);
      }
      // sombra
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      const sombra = (ox, oy, a, x0, x1, w) => { const ca = Math.cos(a), sa = Math.sin(a); const pts = [[x0, -w], [x1, -w], [x1, w], [x0, w]].map(([lx, ly]) => proy(ox + ca * lx - sa * ly + 0.6, oy + sa * lx + ca * ly + 0.4, 0)); if (pts.every(Boolean)) poligono(pts, 'rgba(0,0,0,0.28)'); };
      sombra(cam.x, cam.y, cam.a, -C.cola, C.frente, 1.3);
      if (cam.remolque) sombra(hx, hy, cam.a2, -(C.L2 + C.remCola), C.remFrente, 1.3);
      // de la más lejana a la más cercana
      partes.sort((p, q) => {
        const cp = (o) => { const ca = Math.cos(o[2]), sa = Math.sin(o[2]), lx = (o[3] + o[4]) / 2, ly = (o[5] + o[6]) / 2; return Math.hypot(o[0] + ca * lx - sa * ly - Cx, o[1] + sa * lx + ca * ly - Cy); };
        return cp(q) - cp(p);
      });
      for (const p of partes) caja(...p);
      // luces de freno
      if (cam.freno && Math.abs(cam.v) > 0.3 || cam.atras) {
        const a = cam.remolque ? cam.a2 : cam.a, ox = cam.remolque ? hx : cam.x, oy = cam.remolque ? hy : cam.y, x0 = cam.remolque ? -(C.L2 + C.remCola) : -C.cola;
        for (const lado of [-1, 1]) { const ca = Math.cos(a), sa = Math.sin(a), q = proy(ox + ca * x0 - sa * lado, oy + sa * x0 + ca * lado, 1.3); if (q) { const r = Math.max(1, 6 / q[2] * 4); ctx.fillStyle = cam.atras ? '#ffffff' : '#ff2020'; ctx.fillRect(q[0] - r / 2, q[1] - r / 2, r, r); } }
      }
    }
    // sprite de la vista isométrica, escalado según la profundidad
    const PX_M = Math.SQRT2 * S; // píxeles de sprite por metro (ancho, en la vista isométrica)
    function sprite(s, q, extra) {
      const k = Math.min(6, F / (q[2] * PX_M)) * (extra || 1);
      const w = s.cv.width * k, h = s.cv.height * k;
      if (h < 1.5) return;
      ctx.drawImage(s.cv, Math.round(q[0] - s.ox * k), Math.round(q[1] - s.oy * k), Math.round(w), Math.round(h));
    }
    V.anguloSprite = (h) => GR.ang(h - c3.ang + ISO_VISTA);

    // ---------- cuadro completo ----------
    V.dibujar = function (dt) {
      camara(dt);
      const faltan = new Set();
      const filaH = suelo(faltan);
      volcanes(filaH);
      // generar los bloques de suelo que faltan, de los más cercanos a los más lejanos
      if (faltan.size) {
        const lista = [...faltan].map(k => { const [cu, cv] = k.split(',').map(Number); const u = (cu + 0.5) * CS, v = (cv + 0.5) * CS; const x = (v + u / 2) / S, y = (v - u / 2) / S; return [cu, cv, Math.hypot(x - Cx, y - Cy)]; }).sort((a, b) => a[2] - b[2]);
        for (let i = 0; i < Math.min(4, lista.length); i++) d.suelo.get(lista[i][0], lista[i][1]);
      }
      // liberar los bloques lejanos (con centro 80 m adelante, donde mira la cámara)
      { const ax = Cx + fx / cT * 80, ay = Cy + fy / cT * 80; d.suelo.podar((ax - ay) * S, (ax + ay) / 2 * S); }
      const cam = d.cam();
      const items = [];
      const enVista = (q, m) => q && q[2] < LEJOS && q[0] > -m && q[0] < W + m && q[1] > -m * 2 && q[1] < H + m;
      // decorado
      const R = LEJOS, DC = d.DC;
      for (let gx = Math.floor((Cx - R) / DC); gx <= Math.floor((Cx + R) / DC); gx++) for (let gy = Math.floor((Cy - R) / DC); gy <= Math.floor((Cy + R) / DC); gy++) {
        const mx = (gx + 0.5) * DC - Cx, my = (gy + 0.5) * DC - Cy;
        if (mx * fx + my * fy < -DC) continue;
        for (const o of d.decoCelda(gx, gy)) { const q = proy(o.x, o.y, 0); if (enVista(q, 60)) items.push({ p: q[2], k: 'deco', o, q }); }
      }
      // edificios
      const vistos = new Set();
      for (let gx = Math.floor((Cx - R) / 32); gx <= Math.floor((Cx + R) / 32); gx++) for (let gy = Math.floor((Cy - R) / 32); gy <= Math.floor((Cy + R) / 32); gy++) {
        const mx = gx * 32 + 16 - Cx, my = gy * 32 + 16 - Cy;
        if (mx * fx + my * fy < -40) continue;
        const l = M.edifEn(gx * 32 + 1, gy * 32 + 1); if (!l) continue;
        for (const i of l) {
          if (vistos.has(i)) continue; vistos.add(i);
          const b = M.edif[i], q = proy(b.cx, b.cy, 0);
          if (!q || q[2] > LEJOS + 20 || q[0] < -W || q[0] > 2 * W) continue;
          items.push({ p: q[2], k: 'edif', o: b, i });
        }
      }
      for (const a of d.autos()) { if (a.saliendo != null && a.saliendo <= 0) continue; const q = proy(a.x, a.y, 0); if (enVista(q, 40)) items.push({ p: q[2], k: 'auto', o: a, q }); }
      for (const dep of M.depositos) { const q = proy(dep.x, dep.y, 0); if (enVista(q, 30)) items.push({ p: q[2], k: 'dep', o: dep, q }); }
      { const dd = d.destino(); if (dd && dd.lugar.cat === 'domicilio') { const q = proy(dd.lugar.x, dd.lugar.y, 0); if (enVista(q, 30)) items.push({ p: q[2], k: 'dep', o: dd.lugar, q }); } }
      for (const a of M.sem.accesos) { const q = proy(a.poste[0], a.poste[1], 0); if (enVista(q, 20)) items.push({ p: q[2], k: 'sem', o: a, q }); }
      const qc = proy(cam.x, cam.y, 0);
      const pVeh = qc ? qc[2] : 0.6;
      items.push({ p: pVeh, k: 'camion' });
      const tapa = (b) => { // ¿el segmento cámara→vehículo cruza algún muro del edificio?
        const ax = Cx, ay = Cy, bx = cam.x, by = cam.y, n = b.pts.length;
        for (let k = 0, m = n - 1; k < n; m = k++) {
          const [px, py] = b.pts[m], [qx, qy] = b.pts[k];
          const d1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax), d2 = (bx - ax) * (qy - ay) - (by - ay) * (qx - ax);
          const d3 = (qx - px) * (ay - py) - (qy - py) * (ax - px), d4 = (qx - px) * (by - py) - (qy - py) * (bx - px);
          if ((d1 > 0) !== (d2 > 0) && (d3 > 0) !== (d4 > 0)) return true;
        }
        return false;
      };
      items.sort((a, b) => b.p - a.p);
      // flecha del próximo giro pintada en el piso, y los patios (antes de los objetos)
      d.flecha((x, y) => { const q = proy(x, y, 0.06); return q && q[2] < LEJOS ? q : null; }, 4);
      const dest = d.destino();
      const anillo = (x, y, r, es) => { ctx.fillStyle = es ? ((d.frame() >> 4) & 1 ? '#f9f871' : '#ff9a20') : 'rgba(232,224,192,0.8)'; for (let k = 0; k < 40; k++) { if ((k & 1) && !es) continue; const a = k / 40 * Math.PI * 2, q = proy(x + Math.cos(a) * r, y + Math.sin(a) * r, 0.05); if (q && q[2] < LEJOS) ctx.fillRect(q[0] - 1, q[1], 2, 1); } };
      for (const dep of M.depositos) if (Math.abs(dep.x - Cx) < R && Math.abs(dep.y - Cy) < R) anillo(dep.x, dep.y, 9, false);
      if (dest) anillo(dest.x, dest.y, 7, true);
      for (const it of items) {
        const o = it.o, q = it.q;
        if (it.k === 'edif') {
          // un edificio entre la cámara y el vehículo (calles con curva) se vuelve transparente para no taparlo
          if (it.p < pVeh && tapa(o)) { ctx.globalAlpha = 0.35; edificio(o, it.i); ctx.globalAlpha = 1; } else edificio(o, it.i);
        }
        else if (it.k === 'deco') {
          if (o.roto) continue;
          // los que pasan pegados a la cámara se desvanecen: ampliados se verían como manchas gigantes
          const al = Math.min(1, (q[2] - 9) / 7); if (al <= 0.05) continue;
          const s = d.decoSprite(o); if (s) { ctx.globalAlpha = al; sprite(s, q); ctx.globalAlpha = 1; }
        } else if (it.k === 'auto') {
          const s = d.autoSpr[o.tipo][o.col][V.anguloSprite(o.ang)];
          const k = Math.min(6, F / (q[2] * PX_M));
          ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(Math.round(q[0] - 6 * k), Math.round(q[1] - 1 * k), Math.round(12 * k), Math.max(1, Math.round(3 * k)));
          if (o.saliendo) ctx.globalAlpha = Math.max(0, o.saliendo);
          sprite(s, q); ctx.globalAlpha = 1;
        } else if (it.k === 'dep' || it.k === 'sem') {
          const k = Math.min(5, F / (q[2] * PX_M));
          if (k < 0.25) continue;
          ctx.save(); ctx.translate(Math.round(q[0]), Math.round(q[1])); ctx.scale(k, k);
          if (it.k === 'dep') d.dibujarLetrero(o, 0, 0); else d.dibujarSemaforo(o, 0, 0);
          ctx.restore();
        } else if (it.k === 'camion') camion();
      }
      // humo del escape
      for (const p of d.parts()) { const q = proy(p.x, p.y, p.z); if (!q) continue; const f = p.life / p.max, r = Math.max(1, (2 + f * 4) * F / (q[2] * PX_M)); ctx.fillStyle = 'rgba(60,60,64,' + (0.5 * (1 - f)).toFixed(2) + ')'; ctx.fillRect(q[0] - r / 2 | 0, q[1] - r / 2 | 0, r | 0, r | 0); }
      // bruma sobre el horizonte
      const g = ctx.createLinearGradient(0, filaH - 4, 0, filaH + 22);
      g.addColorStop(0, 'rgba(188,204,220,0.0)'); g.addColorStop(0.3, 'rgba(188,204,220,0.55)'); g.addColorStop(1, 'rgba(188,204,220,0)');
      ctx.fillStyle = g; ctx.fillRect(0, filaH - 4, W, 26);
      return { proy };
    };
    // punto de pantalla de un lugar del mundo (para los focos de noche)
    V.pantalla = (x, y, z) => proy(x, y, z || 0);
    V.reiniciar = () => { c3.ok = false; c3.x = d.cam().x; c3.y = d.cam().y; };
    return V;
  };

  G.VISTA3P = V;
})(window);
