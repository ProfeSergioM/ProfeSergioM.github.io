// FLETES — gráficos 2D pixel art. Tomado del motor de TURBO 40 (fuente 5x7, vóxeles prerenderizados en 32 ángulos,
// árboles, casas, postes y tráfico) y adaptado: suelo por bloques para una red de calles real, camión con semirremolque.
(function (G) {
  'use strict';
  const GR = {};
  // ---------- color ----------
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const pack = (r, g, b) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
  const packH = h => { const c = hex(h); return pack(c[0], c[1], c[2]); };
  // aclara u oscurece un color empaquetado
  const shadeP = (c, f) => pack(Math.min(255, (c & 255) * f) | 0, Math.min(255, ((c >> 8) & 255) * f) | 0, Math.min(255, ((c >> 16) & 255) * f) | 0);
  const mixP = (c, d, t) => pack(((c & 255) * (1 - t) + (d & 255) * t) | 0, (((c >> 8) & 255) * (1 - t) + ((d >> 8) & 255) * t) | 0, (((c >> 16) & 255) * (1 - t) + ((d >> 16) & 255) * t) | 0);
  GR.hex = hex;
  function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  GR.hash = hash;
  GR.mixP = (c, d, t) => mixP(c, d, t); GR.packH = h => packH(h);

  // ---------- fuente 5x7 ----------
  const F = {
    A: '.###.#...##...#######...##...##...#', B: '####.#...##...#####.#...##...#####.', C: '.###.#...##....#....#....#...#.###.',
    D: '####.#...##...##...##...##...#####.', E: '######....#....####.#....#....#####', F: '######....#....####.#....#....#....',
    G: '.###.#...##....#.####...##...#.####', H: '#...##...##...#######...##...##...#', I: '.###...#....#....#....#....#...###.',
    J: '..###...#....#....#.#..#.#..#..##..', K: '#...##..#.#.#..##...#.#..#..#.#...#', L: '#....#....#....#....#....#....#####',
    M: '#...###.###.#.##.#.##...##...##...#', N: '#...###..##.#.##..###...##...##...#', O: '.###.#...##...##...##...##...#.###.',
    P: '####.#...##...#####.#....#....#....', Q: '.###.#...##...##...##.#.##..#..##.#', R: '####.#...##...#####.#.#..#..#.#...#',
    S: '.#####....#.....###.....#....#####.', T: '#####..#....#....#....#....#....#..', U: '#...##...##...##...##...##...#.###.',
    V: '#...##...##...##...##...#.#.#...#..', W: '#...##...##...##.#.##.#.##.#.#.#.#.', X: '#...##...#.#.#...#...#.#.#...##...#',
    Y: '#...##...#.#.#...#....#....#....#..', Z: '#####....#...#...#...#...#....#####',
    0: '.###.#...##..###.#.###..##...#.###.', 1: '..#...##....#....#....#....#...###.', 2: '.###.#...#....#...#...#...#...#####',
    3: '#####...#...#.....#.....##...#.###.', 4: '...#...##..#.#.#..#.#####...#....#.', 5: '######....####.....#....##...#.###.',
    6: '..##..#...#....####.#...##...#.###.', 7: '#####....#...#...#...#....#....#...', 8: '.###.#...##...#.###.#...##...#.###.',
    9: '.###.#...##...#.####....#...#..##..',
    '.': '..........................##...##..', ':': '......##...##........##...##.......', '!': '..#....#....#....#....#.........#..',
    '?': '.###.#...#....#...#...#.........#..', '-': '...............#####...............', '/': '....#....#...#...#...#...#....#....',
    "'": '..#....#...#.......................', ',': '....................##....#...#....', '+': '.......#....#..#####..#....#.......',
    '(': '...#...#...#....#....#.....#.....#.', ')': '.#.....#.....#....#....#...#...#...', '"': '.#.#..#.#..........................',
    '#': '.#.#..#.#.#####.#.#.#####.#.#..#.#.', '*': '.....#.#.#.###.#####.###.#.#.#.....', '=': '..........#####.....#####..........',
    '↑': '..#...###.#.#.#..#....#....#....#..', '↓': '..#....#....#....#..#.#.#.###...#..', '←': '.......#...#...#####.#.....#.......',
    '→': '.......#.....#.#####...#...#.......', ' ': '...................................',
    'Á': '...#..###.#...##...#######...##...#',
    'É': '...#.######....####.#....#....#####',
    'Í': '...#..###...#....#....#....#...###.',
    'Ó': '...#..###.#...##...##...##...#.###.',
    'Ú': '...#.#...##...##...##...##...#.###.',
    'Ü': '.#.#......#...##...##...##...#.###.',
    'Ñ': '.###......#...###..##.#.##..###...#',
    '¿': '..#.........#...#...#....#...#.###.',
    '¡': '..#.........#....#....#....#....#..',
    '$': '..#...#####.#...###...#.#####...#..',
    '%': '##...##..#...#...#...#...#..##...##',
    '°': '.##..#..#..##......................',
    '<': '...#...#...#...#.....#.....#.....#.',
    '>': '.#.....#.....#.....#...#...#...#...',
    '[': '.###..#....#....#....#....#....###.',
    ']': '.###....#....#....#....#....#..###.',
    '^': '..#...#.#.#...#...................',
    '·': '.................#.................',
    '×': '.....#...#.#.#...#...#.#.#...#.....',
  };
  const GLY = {};
  for (const k in F) { const s = F[k].padEnd(35, '.'); const rows = []; for (let r = 0; r < 7; r++) rows.push(s.slice(r * 5, r * 5 + 5)); GLY[k] = rows; }
  // acentos: letra base completa + marca 2 filas arriba
  const ACC = { 'Á': ['A', '...#.'], 'É': ['E', '...#.'], 'Í': ['I', '...#.'], 'Ó': ['O', '...#.'], 'Ú': ['U', '...#.'], 'Ñ': ['N', '.####'], 'Ü': ['U', '.#.#.'] };
  GR.textW = (str, sc) => str.length * 6 * (sc || 1) - (sc || 1);
  // opts: color | rows(fn r->color), scale, align, shadow, wave(t), outline
  GR.text = function (ctx, str, x, y, o) {
    o = o || {}; const sc = o.scale || 1; str = String(str).toUpperCase();
    const w = GR.textW(str, sc);
    if (o.align === 'center') x -= Math.floor(w / 2); else if (o.align === 'right') x -= w;
    x = Math.round(x); y = Math.round(y);
    const pass = (dx, dy, colFn) => {
      for (let i = 0; i < str.length; i++) {
        const ac = ACC[str[i]];
        const g = ac ? GLY[ac[0]] : (GLY[str[i]] || GLY['?']);
        const oy = o.wave ? Math.round(Math.sin(o.wave + i * 0.6) * (o.amp || 2)) : 0;
        if (ac) { ctx.fillStyle = colFn(0, i); const row = ac[1]; for (let c = 0; c < 5; c++) if (row[c] === '#') ctx.fillRect(x + (i * 6 + c) * sc + dx, y - 2 * sc + oy + dy, sc, sc); }
        for (let r = 0; r < 7; r++) {
          ctx.fillStyle = colFn(r, i);
          const row = g[r];
          for (let c = 0; c < 5; c++) if (row[c] === '#') ctx.fillRect(x + (i * 6 + c) * sc + dx, y + r * sc + oy + dy, sc, sc);
        }
      }
    };
    if (o.outline) { const oc = () => o.outline; for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) pass(dx, dy, oc); }
    if (o.shadow) pass(sc, sc, () => o.shadow);
    pass(0, 0, o.rows || (() => o.color || '#fff'));
    return w;
  };

  // ---------- render de vóxeles a sprite 2D isométrico ----------
  const ZS = 1.15;
  // model: {nx,ny,nz, get(x,y,z)->mat|null, cx,cy, vs}; ex,ey: ejes del modelo en el mundo
  function voxRender(model, ex, ey, mats) {
    const { nx, ny, nz, cx, cy } = model, vs = model.vs || 1;
    const sub = model.sub || 3;
    const pts = [];
    const at = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) ? null : model.get(x, y, z);
    const faces = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1]];
    for (let x = 0; x < nx; x++) for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) {
      const m = at(x, y, z); if (m == null) continue;
      for (const f of faces) {
        if (at(x + f[0], y + f[1], z + f[2]) != null) continue;
        let shade;
        if (f[2] === 1) shade = 0;
        else {
          const wx = f[0] * ex[0] + f[1] * ey[0], wy = f[0] * ex[1] + f[1] * ey[1];
          if (wx + wy <= 0.05) continue;
          const t = (wy - wx) * 0.5 + 0.5;
          shade = t > 0.5 ? 1 : 2;
        }
        for (let a = 0; a < sub; a++) for (let b = 0; b < sub; b++) {
          const u = (a + 0.5) / sub, v = (b + 0.5) / sub;
          let px, py, pz;
          if (f[2] === 1) { px = x + u; py = y + v; pz = z + 1; }
          else if (f[0]) { px = x + (f[0] > 0 ? 1 : 0); py = y + u; pz = z + v; }
          else { px = x + u; py = y + (f[1] > 0 ? 1 : 0); pz = z + v; }
          const lx = (px - cx) * vs, ly = (py - cy) * vs, lz = pz * vs;
          const wx = lx * ex[0] + ly * ey[0], wy = lx * ex[1] + ly * ey[1];
          pts.push(wx - wy, (wx + wy) / 2 - lz * ZS, wx + wy + lz * 0.9, m, shade);
        }
      }
    }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < pts.length; i += 5) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]); }
    const ox = Math.ceil(-x0) + 2, oy = Math.ceil(-y0) + 2;
    const w = Math.ceil(x1 - x0) + 5, h = Math.ceil(y1 - y0) + 5;
    const zb = new Float32Array(w * h).fill(-1e9), mb = new Int16Array(w * h).fill(-1);
    for (let i = 0; i < pts.length; i += 5) {
      const X = Math.round(pts[i] + ox), Y = Math.round(pts[i + 1] + oy), k = Y * w + X;
      if (pts[i + 2] > zb[k]) { zb[k] = pts[i + 2]; mb[k] = pts[i + 3] * 3 + pts[i + 4]; }
    }
    return { w, h, ox, oy, mb };
  }
  // pinta un buffer de materiales con una paleta -> canvas con contorno oscuro
  function paint(buf, pal, outline) {
    const cv = mk(buf.w, buf.h), cx = cv.getContext('2d');
    const img = cx.createImageData(buf.w, buf.h), d = new Uint32Array(img.data.buffer);
    for (let k = 0; k < buf.mb.length; k++) if (buf.mb[k] >= 0) d[k] = pal[buf.mb[k]];
    if (outline) {
      const oc = packH(outline), w = buf.w;
      for (let k = 0; k < d.length; k++) {
        if (d[k]) continue;
        const x = k % w;
        if ((x > 0 && buf.mb[k - 1] >= 0) || (x < w - 1 && buf.mb[k + 1] >= 0) || (k >= w && buf.mb[k - w] >= 0) || (k + w < d.length && buf.mb[k + w] >= 0)) d[k] = oc;
      }
    }
    cx.putImageData(img, 0, 0);
    return { cv, ox: buf.ox, oy: buf.oy };
  }
  // paleta: por material, 3 tonos (arriba, lateral claro, lateral oscuro)
  function palette(cols) {
    const pal = [];
    cols.forEach(h => {
      const c = hex(h);
      [1.0, 0.78, 0.58].forEach(f => pal.push(pack(Math.min(255, c[0] * f) | 0, Math.min(255, c[1] * f) | 0, Math.min(255, c[2] * f) | 0)));
    });
    return pal;
  }
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  GR.mk = mk;

  function outlineCanvas(cv, col) {
    const c = cv.getContext('2d'), w = cv.width, h = cv.height;
    const img = c.getImageData(0, 0, w, h), d = new Uint32Array(img.data.buffer), src = d.slice(), oc = packH(col);
    for (let k = 0; k < d.length; k++) {
      if (src[k]) continue; const x = k % w;
      if ((x > 0 && src[k - 1]) || (x < w - 1 && src[k + 1]) || (k >= w && src[k - w]) || (k + w < d.length && src[k + w])) d[k] = oc;
    }
    c.putImageData(img, 0, 0);
  }
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  function ditherEllipse(c, x0, y0, rx, ry) {
    for (let y = -Math.ceil(ry); y <= ry; y++) for (let x = -Math.ceil(rx); x <= rx; x++) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) > 1) continue;
      const X = Math.round(x0 + x), Y = Math.round(y0 + y);
      if ((X + Y) & 1) c.fillRect(X, Y, 1, 1);
    }
  }

  // ---------- más sprites: árboles, arbustos, rocas, objetos ----------
  function canvasPx(w, h) { const cv = mk(w, h), c = cv.getContext('2d'); return { cv, c, px: (x, y, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), 1, 1); } }; }
  function blob(px, cx, cy, rx, ry, cols, seed) {
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      if (d > 1 + (hash(x + seed, y) - 0.5) * 0.35) continue;
      const lit = (x + y * 1.3) / (rx + ry);
      const n = hash(x * 3 + seed, y * 5);
      px(cx + x, cy + y, lit < -0.35 ? cols[0] : lit > 0.35 ? cols[2] : (n < 0.2 ? cols[0] : n > 0.85 ? cols[2] : cols[1]));
    }
  }
  GR.buildDecor = function () {
    const S = {};
    S.pino = [0, 1, 2].map(v => {
      const h = 30 + v * 3, { cv, c, px } = canvasPx(24, h + 4);
      c.fillStyle = '#5a3a18'; c.fillRect(11, h - 6, 2, 7);
      for (let l = 0; l < 4; l++) {
        const top = 2 + l * (h / 5.2), w = 4 + l * 2.6, hh = h / 3.4;
        for (let y = 0; y < hh; y++) for (let x = -w * y / hh; x <= w * y / hh; x++) px(12 + x, top + y, x < -w * y / hh / 3 ? '#4c9a44' : x > w * y / hh / 3 ? '#1a5428' : '#2a7434');
      }
      outlineCanvas(cv, '#0a2010');
      return { cv, ox: 12, oy: h };
    });
    const tree = (cols, trunk) => [0, 1, 2].map(v => {
      const { cv, c, px } = canvasPx(28, 34);
      c.fillStyle = trunk; c.fillRect(13, 20, 3, 12); c.fillStyle = '#3a2410'; c.fillRect(15, 20, 1, 12);
      blob(px, 14, 13, 10 + v, 9, cols, v * 17);
      outlineCanvas(cv, '#102010');
      return { cv, ox: 14, oy: 31 };
    });
    S.arbol = tree(['#2a6a28', '#3c8e34', '#64b84a'], '#6a4420');
    S.cerezo = tree(['#c86090', '#f090b8', '#ffd0e4'], '#5a3424');
    S.arbusto = [0, 1, 2].map(v => { const { cv, px } = canvasPx(16, 12); blob(px, 8, 7, 6, 4, ['#2a6a28', '#3c8e34', '#64b84a'], v * 9); outlineCanvas(cv, '#102010'); return { cv, ox: 8, oy: 10 }; });
    S.seco = [0, 1, 2].map(v => {
      const { cv, px } = canvasPx(16, 12);
      for (let k = 0; k < 14; k++) { const a = -Math.PI * (0.1 + 0.8 * hash(k, v)), L = 3 + hash(v, k) * 4; for (let t = 0; t < L; t++) px(8 + Math.cos(a) * t, 10 + Math.sin(a) * t, t > L - 2 ? '#d0b070' : '#8a6a34'); }
      return { cv, ox: 8, oy: 10 };
    });
    const rock = (cols, rx, ry) => [0, 1, 2].map(v => { const { cv, px } = canvasPx(rx * 2 + 6, ry * 2 + 8); blob(px, rx + 3, ry + 4, rx, ry, cols, v * 31 + rx); outlineCanvas(cv, '#141010'); return { cv, ox: rx + 3, oy: ry * 2 + 4 }; });
    S.roca = rock(['#6a6058', '#8c8478', '#b8b0a2'], 7, 5);
    S.rocaArena = rock(['#8a6440', '#aa8256', '#d0a878'], 7, 5);
    // barriles de obstáculo (rojo, azul, amarillo)
    S.peligro = [['#c02020', '#e84040', '#ff8080'], ['#1c4ab0', '#3070e0', '#80b0ff'], ['#c09010', '#f0c020', '#fff080']].map(cols => {
      const { cv, c } = canvasPx(14, 18);
      for (let x = 0; x < 10; x++) { c.fillStyle = x < 3 ? cols[2] : x < 7 ? cols[1] : cols[0]; c.fillRect(2 + x, 4, 1, 11); }
      c.fillStyle = '#f0f0f0'; c.fillRect(2, 8, 10, 2);
      c.fillStyle = '#202024'; c.fillRect(2, 6, 10, 1); c.fillRect(2, 12, 10, 1);
      c.fillStyle = cols[2]; c.fillRect(3, 2, 8, 2); c.fillStyle = cols[0]; c.fillRect(3, 3, 8, 1);
      c.fillStyle = '#101010'; c.fillRect(8, 2, 2, 1);
      outlineCanvas(cv, '#0c0c10');
      return { cv, ox: 7, oy: 15 };
    });
    S.senal = [0, 1, 2].map(() => {
      const { cv, c, px } = canvasPx(12, 24);
      c.fillStyle = '#808088'; c.fillRect(5, 9, 2, 14);
      c.fillStyle = '#1c50c8'; c.fillRect(1, 0, 10, 10);
      c.fillStyle = '#ffffff'; c.fillRect(2, 1, 8, 8);
      c.fillStyle = '#1c50c8'; c.fillRect(3, 2, 6, 6);
      ['..#..', '.###.', '..#..', '.#.#.', '#...#'].forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') px(4 + x, 2 + y, '#ffffff'); }));
      outlineCanvas(cv, '#0c0c10');
      return { cv, ox: 6, oy: 23 };
    });
    return S;
  };
  // ---------- tráfico de la autopista: sedanes y camiones de vóxeles ----------
  GR.buildTrafico = function () {
    const sedan = { nx: 20, ny: 10, nz: 6, cx: 10, cy: 5, sub: 2, get: (x, y, z) => {
      const rueda = (x >= 3 && x <= 5 || x >= 14 && x <= 16) && (y === 0 || y === 9) && z <= 1;
      if (rueda) return 2;
      if (y === 0 || y === 9) { if (z >= 1 && z <= 2) return 0; }
      if (z <= 2 && y > 0 && y < 9) return 0;
      if (z >= 3 && z <= 4 && x >= 6 && x <= 14 && y >= 1 && y <= 8) return (x === 6 || x === 14 || y === 1 || y === 8) && z === 3 ? 1 : (z === 4 ? 0 : 1);
      return null;
    } };
    const camion = { nx: 32, ny: 11, nz: 11, cx: 16, cy: 5.5, sub: 2, get: (x, y, z) => {
      const rueda = (x >= 2 && x <= 4 || x >= 9 && x <= 11 || x >= 26 && x <= 28) && (y === 0 || y === 10) && z <= 1;
      if (rueda) return 2;
      if (z === 0 && y > 0 && y < 10) return 2;
      if (x <= 22 && z >= 1 && z <= 10 && y >= 0 && y <= 10) return 3;
      if (x >= 24 && z >= 1 && z <= 7 && y >= 1 && y <= 9) return z >= 4 && z <= 6 && x === 31 ? 1 : 0;
      return null;
    } };
    const bufs = m => { const out = []; for (let k = 0; k < GR.NANG; k++) { const a = k / GR.NANG * Math.PI * 2; out.push(voxRender(m, [Math.cos(a), Math.sin(a)], [-Math.sin(a), Math.cos(a)])); } return out; };
    const bs = bufs(sedan), bc = bufs(camion);
    const S = { sedan: [], camion: [] };
    for (const col of ['#d8d8e0', '#3060c0', '#c03030', '#e8c840', '#3a9a5a', '#34343c', '#e07020'])
      S.sedan.push(bs.map(b => paint(b, palette([col, '#1c2a40', '#141418', col]), '#0c0c10')));
    for (const [cab, caja] of [['#c03030', '#f0f0f0'], ['#3060c0', '#e8e0d0'], ['#f0c020', '#a0a8b0']])
      S.camion.push(bc.map(b => paint(b, palette([cab, '#1c2a40', '#141418', caja]), '#0c0c10')));
    return S;
  };
  // ---------- road trip: árboles, cactus, postes, carteles y casas ----------
  GR.buildRuta = function () {
    const S = {};
    const tree = (cols, trunk, rx, ry, w, h) => [0, 1, 2].map(v => {
      const { cv, c, px } = canvasPx(w, h);
      const cx = w >> 1, cy = ry + 2;
      c.fillStyle = trunk; c.fillRect(cx - 1, cy + ry - 3, 3, h - (cy + ry - 3) - 2); c.fillStyle = '#3a2410'; c.fillRect(cx + 1, cy + ry - 3, 1, h - (cy + ry - 3) - 2);
      blob(px, cx, cy, rx + v, ry, cols, v * 13 + rx);
      outlineCanvas(cv, '#102010');
      return { cv, ox: cx, oy: h - 3 };
    });
    S.roble = tree(['#4a6626', '#6a8a34', '#98b052'], '#5a3a1c', 12, 8, 32, 32);
    S.ceiba = tree(['#16561a', '#2a8030', '#5cb444'], '#8a6a4a', 14, 10, 36, 40);
    S.ventoso = [0, 1, 2].map(v => { // árbol doblado por el viento patagónico
      const { cv, c, px } = canvasPx(30, 30);
      for (let i = 0; i < 16; i++) { const x = 10 + i * 0.5, y = 27 - i; px(x, y, '#5a3a1c'); px(x + 1, y, '#3a2410'); }
      blob(px, 20, 9, 9, 4, ['#4a5a26', '#66783a', '#8a9a50'], v * 7);
      blob(px, 25, 11, 4, 3, ['#4a5a26', '#66783a', '#8a9a50'], v * 5 + 3);
      outlineCanvas(cv, '#141c08');
      return { cv, ox: 10, oy: 27 };
    });
    S.pinoNieve = [0, 1, 2].map(v => {
      const h = 30 + v * 3, { cv, c, px } = canvasPx(24, h + 4);
      c.fillStyle = '#5a3a18'; c.fillRect(11, h - 6, 2, 7);
      for (let l = 0; l < 4; l++) {
        const top = 2 + l * (h / 5.2), w = 4 + l * 2.6, hh = h / 3.4;
        for (let y = 0; y < hh; y++) for (let x = -w * y / hh; x <= w * y / hh; x++) {
          const nieve = y < hh * 0.35 || (y > hh - 2 && hash(x | 0, l * 7 + y) < 0.6);
          px(12 + x, top + y, nieve ? (x < 0 ? '#ffffff' : '#d4e0ee') : x < -w * y / hh / 3 ? '#3a7a50' : x > w * y / hh / 3 ? '#143e26' : '#225a36');
        }
      }
      outlineCanvas(cv, '#0a1a18');
      return { cv, ox: 12, oy: h };
    });
    S.nieve = [0, 1, 2].map(v => { const { cv, px } = canvasPx(22, 12); blob(px, 11, 7, 9 - v, 4, ['#b0c2da', '#dfe8f4', '#ffffff'], v * 11); outlineCanvas(cv, '#7a8aa4'); return { cv, ox: 11, oy: 10 }; });
    const cactus = (body, light, dark, brazos) => [0, 1, 2].map(v => {
      const H = 24 + v * 4, { cv, px } = canvasPx(18, H + 3);
      const col = x => x === 0 ? light : x === 2 ? dark : body;
      for (let y = 2; y <= H; y++) for (let x = 0; x < 3; x++) px(7 + x, y, col(x));
      px(8, 1, light);
      brazos.forEach(([lado, alto, largo], k) => {
        const y0 = H - alto - v * 2, x0 = lado < 0 ? 3 : 11;
        for (let x = 0; x < 4; x++) for (let t = 0; t < 2; t++) px(lado < 0 ? 7 - x : 10 + x, y0 + t, body);
        for (let y = y0 - largo; y <= y0 + 1; y++) for (let x = 0; x < 2; x++) px(x0 + x, y, x ? dark : light);
      });
      outlineCanvas(cv, '#10200c');
      return { cv, ox: 8, oy: H };
    });
    S.saguaro = cactus('#3e8a3e', '#6ab45a', '#24602a', [[-1, 12, 7], [1, 8, 9]]);
    S.cardon = cactus('#5a8a4a', '#86ae6a', '#3a6034', [[-1, 10, 5], [1, 13, 6], [1, 6, 4]]);
    S.nopal = [0, 1, 2].map(v => { // agave
      const { cv, px } = canvasPx(20, 14);
      for (let k = 0; k < 9; k++) {
        const a = -Math.PI * (0.05 + 0.9 * k / 8), L = 6 + hash(k, v) * 4;
        for (let t = 0; t < L; t++) { const x = 10 + Math.cos(a) * t, y = 12 + Math.sin(a) * t * 0.9; px(x, y, t > L - 2 ? '#a8d0a0' : k % 2 ? '#4a9070' : '#356a52'); px(x + 1, y, '#2a5442'); }
      }
      outlineCanvas(cv, '#0c1c14');
      return { cv, ox: 10, oy: 12 };
    });
    S.banano = [0, 1, 2].map(v => {
      const { cv, c, px } = canvasPx(30, 30);
      c.fillStyle = '#6a8a3a'; c.fillRect(14, 14, 3, 14);
      [[-1, -0.3], [1, -0.4], [-0.8, -0.9], [0.7, -1], [0, -1.2]].forEach(([dx, dy], li) => {
        const L = 11 + ((li + v) % 3);
        for (let s = 0; s <= L; s++) {
          const t = s / L, x = 15 + dx * s, y = 15 + dy * s * 0.8 + t * t * 5;
          for (let k = -2; k <= 2; k++) px(x, y + k * 0.6, k < 0 ? '#7ad050' : k > 0 ? '#2a7a2a' : '#4aa83a');
        }
      });
      outlineCanvas(cv, '#0c240c');
      return { cv, ox: 15, oy: 28 };
    });
    S.pirca = [0, 1, 2].map(v => { // pirca: muro bajo de piedras
      const { cv, px } = canvasPx(26, 12);
      for (let k = 0; k < 6; k++) blob(px, 4 + k * 3.6, 7 - (k % 2), 2 + (k + v) % 2, 2, ['#6a5e4c', '#8c806a', '#b0a48a'], k * 5 + v);
      outlineCanvas(cv, '#1c140c');
      return { cv, ox: 13, oy: 10 };
    });
    S.calafate = [0, 1, 2].map(v => {
      const { cv, px } = canvasPx(18, 12);
      blob(px, 9, 7, 7, 4, ['#2a4a2a', '#3e6a36', '#5a8a48'], v * 9);
      for (let k = 0; k < 6; k++) px(4 + hash(k, v) * 10, 4 + hash(v, k) * 6, '#6a3a9a');
      outlineCanvas(cv, '#0c180c');
      return { cv, ox: 9, oy: 10 };
    });
    // poste de teléfono (el cable sale de la punta, a ~26 de altura)
    S.poste = [(() => {
      const { cv, c, px } = canvasPx(12, 34);
      c.fillStyle = '#6a4a2a'; c.fillRect(5, 3, 2, 30); c.fillStyle = '#4a321c'; c.fillRect(6, 3, 1, 30);
      c.fillStyle = '#5a3a20'; c.fillRect(1, 5, 10, 1);
      px(1, 4, '#e8e8f0'); px(10, 4, '#e8e8f0'); px(5, 4, '#e8e8f0');
      outlineCanvas(cv, '#100c08');
      return { cv, ox: 6, oy: 32 };
    })()];
    // cartel amarillo de curva peligrosa
    const curva = der => {
      const { cv, c, px } = canvasPx(15, 26);
      c.fillStyle = '#808088'; c.fillRect(6, 12, 2, 13);
      for (let y = 0; y <= 12; y++) for (let x = 0; x <= 12; x++) {
        const d = Math.abs(x - 6) + Math.abs(y - 6);
        if (d <= 6) px(1 + x, y, d === 6 ? '#181818' : '#f8c818');
      }
      const ar = ['..#..', '...#.', '#####', '...#.', '..#..'];
      ar.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') px(der ? 5 + x : 9 - x, 4 + y, '#181818'); }));
      outlineCanvas(cv, '#0c0c10');
      return { cv, ox: 7, oy: 24 };
    };
    S.curvaD = [curva(true)]; S.curvaI = [curva(false)];
    S.lomo = [(() => { // cartel de lomo / desnivel
      const { cv, c, px } = canvasPx(15, 26);
      c.fillStyle = '#808088'; c.fillRect(6, 12, 2, 13);
      for (let y = 0; y <= 12; y++) for (let x = 0; x <= 12; x++) { const d = Math.abs(x - 6) + Math.abs(y - 6); if (d <= 6) px(1 + x, y, d === 6 ? '#181818' : '#f8c818'); }
      ['..###..', '.#...#.', '#######'].forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') px(4 + x, 5 + y, '#181818'); }));
      outlineCanvas(cv, '#0c0c10');
      return { cv, ox: 7, oy: 24 };
    })()];
    S.velero = ['#ffffff', '#ffe060', '#ff7060'].map(vela => {
      const { cv, c, px } = canvasPx(20, 24);
      for (let y = 0; y < 15; y++) for (let x = 0; x <= y * 0.55; x++) px(10 + x, 2 + y, x === 0 ? '#d0d0d8' : vela);
      for (let y = 4; y < 15; y++) for (let x = 0; x <= (y - 4) * 0.4; x++) px(8 - x, 2 + y, '#f0f0f0');
      c.fillStyle = '#5a3a20'; c.fillRect(9, 1, 1, 17);
      c.fillStyle = '#e8e8f0'; c.fillRect(3, 18, 14, 2); c.fillStyle = '#304060'; c.fillRect(4, 20, 12, 1);
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(1, 21, 18, 1);
      outlineCanvas(cv, '#0c1428');
      return { cv, ox: 10, oy: 21 };
    });
    // casas de vóxeles (una sola orientación)
    const casa = (nx, ny, nz, techo, ventanas) => (cols) => {
      const get = (x, y, z) => {
        const borde = x === 0 || y === 0 || x === nx - 1 || y === ny - 1;
        if (z < nz) {
          if (borde && z >= 3 && z <= 6 && ((x % 7 >= 3 && x % 7 <= 4 && (y === 0 || y === ny - 1)) || (y % 7 >= 3 && y % 7 <= 4 && (x === 0 || x === nx - 1)))) return ventanas ? 2 : 3;
          if (borde && z < 7 && x === nx - 1 && Math.abs(y - (ny >> 1)) <= 1) return 3; // puerta
          return 0;
        }
        if (!techo) return z === nz ? 1 : null;
        const alto = Math.round((ny / 2 - Math.abs(y - ny / 2 + 0.5)) * 0.7);
        return z - nz <= alto ? 1 : null;
      };
      const buf = voxRender({ nx, ny, nz: nz + (techo ? Math.ceil(ny * 0.4) : 1), cx: nx / 2, cy: ny / 2, get, sub: 2 }, [1, 0], [0, 1]);
      return paint(buf, palette(cols), '#100c08');
    };
    S.cabana = [['#8a5a30', '#f0f4fa', '#f0d070', '#4a2e18'], ['#7a4a26', '#3a5a34', '#f0d070', '#3a2414'], ['#946236', '#a03028', '#f0d070', '#4a2e18']].map(casa(20, 16, 9, true, true));
    S.motel = [['#f0e0c0', '#c04030', '#60c0e0', '#405070'], ['#f8c8d0', '#2a8ac0', '#60c0e0', '#405070'], ['#d0f0e0', '#e08030', '#60c0e0', '#405070']].map(casa(34, 14, 9, false, true));
    S.adobe = [['#c88a58', '#a86a40', '#3a2a20', '#5a3a20'], ['#d8a070', '#b8805a', '#3a2a20', '#2a4a8a'], ['#e0d0b8', '#b89a78', '#3a2a20', '#8a3a20']].map(casa(18, 16, 8, false, true));
    S.casaColor = [['#f080a0', '#9aa0a8', '#2a4a6a', '#5a3a20'], ['#40c0b0', '#9aa0a8', '#2a4a6a', '#5a3a20'], ['#f0d040', '#b05030', '#2a4a6a', '#5a3a20']].map(casa(18, 14, 8, true, true));
    S.galpon = [['#b0302a', '#a8acb4', '#2a2a30', '#5a3a20'], ['#e8e4dc', '#a8acb4', '#2a2a30', '#5a3a20'], ['#3a6a9a', '#a8acb4', '#2a2a30', '#5a3a20']].map(casa(26, 16, 9, true, false));
    return S;
  };
  function sprite(w, h, rows, cols) {
    const { cv, px } = canvasPx(w + 2, h + 2);
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (cols[ch]) px(1 + x, 1 + y, cols[ch]); }));
    outlineCanvas(cv, '#0c0c10');
    return { cv, ox: Math.floor((w + 2) / 2), oy: h + 1 };
  }
  // =====================================================================================
  // FLETES: escala, camión, autos, suelo de calles reales, edificios y minimapa
  // =====================================================================================
  // 1 metro = 3 píxeles del mundo (un vóxel mide 1/3 m)
  const S = GR.S = 3;
  GR.iso = (X, Y) => [X - Y, (X + Y) / 2];
  const rot32 = m => { const out = []; for (let k = 0; k < GR.NANG; k++) { const a = k / GR.NANG * Math.PI * 2; out.push(voxRender(m, [Math.cos(a), Math.sin(a)], [-Math.sin(a), Math.cos(a)])); } return out; };
  GR.NANG = 32;
  GR.ang = a => ((Math.round(a / (Math.PI * 2) * 32) % 32) + 32) % 32;

  // ---------- tracto camión (cabina sobre el motor, al estilo europeo) ----------
  // materiales: 0 carrocería, 1 neumático, 2 metal, 3 chasis, 4 vidrio, 5 faro, 6 luz trasera, 7 carrocería oscura, 8 franja
  const TRACTO = { nx: 19, ny: 8, nz: 12, cx: 3.3, cy: 4, sub: 2, get(x, y, z) {
    const rueda = (x >= 2 && x <= 5 || x >= 14 && x <= 16) && (y === 0 || y === 7) && z <= 2;
    if (rueda) return (z === 1 && (x === 3 || x === 15)) ? 2 : 1;
    if (z === 0) return null;
    if (x >= 12) { // cabina
      if (z > 10) return null;
      if (z === 10) return x === 12 ? 7 : 0;
      if (x === 18) { if (z >= 6 && z <= 8 && y >= 1 && y <= 6) return 4; if (z <= 3 && (y === 1 || y === 6) && z === 2) return 5; if (z <= 4 && y >= 2 && y <= 5) return 3; return 0; }
      if ((y === 0 || y === 7) && x >= 15 && x <= 17 && z >= 6 && z <= 8) return 4;
      if ((y === 0 || y === 7) && z === 4) return 8;
      if (z <= 2 && (y === 0 || y === 7)) return 7;
      return 0;
    }
    if (x === 11 && y === 6 && z >= 3) return 2; // escape
    if (z <= 2 && y >= 1 && y <= 6) return z === 2 && x >= 2 && x <= 6 ? 2 : 3; // chasis y quinta rueda
    if (x >= 7 && x <= 10 && (y === 0 || y === 7) && z <= 2) return 2; // estanques
    if (x <= 0 && z <= 2 && (y === 1 || y === 6)) return 6;
    return null;
  } };
  // ---------- semirremolques ----------
  GR.PIVOTE = 9 + 9.6 * 3; // en vóxeles desde la cola: eje trasero (x=9) + largo hasta el perno rey (N.CAMION.L2)
  function remolque(tipo) {
    const nx = 42, ny = 8;
    const ejes = x => (x >= 4 && x <= 6 || x >= 7 && x <= 9 || x >= 10 && x <= 12);
    // ancla en el pivote (perno rey): eje del remolque en x=9 más 9,6 m hacia adelante; así el remolque
    // queda pegado a la quinta rueda del tracto aunque los dos sprites redondeen su ángulo distinto
    return { nx, ny, nz: 13, cx: GR.PIVOTE, cy: 4, sub: 2, get(x, y, z) {
      if (ejes(x) && (y === 0 || y === 7) && z <= 2) return (z === 1 && (x === 5 || x === 8 || x === 11)) ? 2 : 1;
      if (z === 0) return null;
      if (z <= 2) { if (x <= 14 && y >= 1 && y <= 6 && z === 2) return 3; if (x >= 34 && x <= 36 && (y === 1 || y === 6) && z <= 2) return 2; if (x >= 15 && z === 2 && (y === 0 || y === 7)) return 7; return x >= 15 && y >= 2 && y <= 5 && z === 2 ? 3 : null; }
      if (x === 0 && z === 3 && (y === 1 || y === 6)) return 6;
      if (tipo === 'plataforma') {
        if (z === 3) return 7;
        // pilas de madera con huecos
        if (z <= 7 && x >= 2 && x <= 39 && (x % 10) !== 0 && y >= 0 && y <= 7) return (x % 10 === 1 || x % 10 === 9) ? 2 : (z === 7 ? 0 : 8);
        return null;
      }
      if (tipo === 'cisterna') {
        if (z === 3 && (x <= 3 || x >= 39)) return 3;
        const cy = 3.5, cz = 7.5, r = Math.hypot(y - cy, z - cz);
        if (r > 4.2 || x < 1 || x > 40) return null;
        if (z === 12 && x % 9 === 4) return 2;
        if (x === 1 || x === 40) return 2;
        return (x % 13 === 0) ? 2 : 0;
      }
      // caja: lona, frigo o contenedor
      if (z > 12) return null;
      if (tipo === 'frigo' && x >= 41 && z >= 8 && z <= 11 && y >= 1 && y <= 6) return 3; // equipo de frío
      if (x > 41) return null;
      if (tipo === 'contenedor') { if (z === 3) return 3; if (z === 12) return 7; return ((y === 0 || y === 7) && x % 2 === 0) || (x === 0 && y % 2) ? 7 : 0; }
      if (tipo === 'lona') { if (z === 12) return 7; if ((y === 0 || y === 7) && x % 6 === 0) return 7; if ((y === 0 || y === 7) && z >= 6 && z <= 8 && x > 6 && x < 36) return 8; return 0; }
      if (z === 12 || z === 3) return 7; // frigo
      if ((y === 0 || y === 7) && z >= 7 && z <= 9 && x > 8 && x < 34) return 8;
      return 0;
    } };
  }
  // ---------- vehículos de la empresa (1 vóxel = 1/3 m; el ancla cx es el eje trasero) ----------
  // materiales: 0 color de la empresa, 1 neumático, 2 metal, 3 oscuro, 4 vidrio, 5 blanco (caja), 6 piel, 7 polera, 8 luces
  const rueda = (x, z, x0, x1) => x >= x0 && x <= x1 && z <= 1;
  const MODELOS = {
    bici: { nx: 6, ny: 2, nz: 7, cx: 1.2, cy: 1, get(x, y, z) {
      if ((x <= 1 || x >= 4) && z <= 1) return (z === 1 && (x === 0 || x === 5)) || (z === 0 && (x === 1 || x === 4)) ? 1 : (z === 1 ? 2 : null);
      if (z === 2 && x >= 1 && x <= 4) return 2;                  // cuadro
      if (x === 2 && z === 3) return 3;                           // piernas
      if (x >= 2 && x <= 3 && z >= 4 && z <= 5) return 7;         // polera
      if (x === 4 && z === 4) return 7;                           // brazo al manubrio
      if (x === 3 && z === 6) return 6;                           // cabeza
      if (x === 1 && z >= 3 && z <= 5) return 0;                  // mochila de reparto
      return null; } },
    moto: { nx: 7, ny: 3, nz: 7, cx: 1.35, cy: 1.5, get(x, y, z) {
      if ((x <= 1 || x >= 5) && z <= 1 && y === 1) return 1;
      if (z === 2 && x >= 1 && x <= 5 && y === 1) return 2;
      if (z >= 2 && z <= 3 && x >= 3 && x <= 5) return 0;         // estanque y carenado
      if (x >= 2 && x <= 3 && z === 3 && y === 1) return 3;       // asiento
      if (x >= 2 && x <= 3 && z >= 4 && z <= 5 && y === 1) return 7;
      if (x === 3 && z === 6 && y === 1) return 0;                // casco
      if (x <= 1 && z >= 3 && z <= 5) return z === 4 ? 0 : 5;     // caja de reparto
      return null; } },
    auto: { nx: 12, ny: 6, nz: 5, cx: 2, cy: 3, get(x, y, z) {
      if ((rueda(x, z, 1, 2) || rueda(x, z, 9, 10)) && (y === 0 || y === 5)) return 1;
      if (z === 0) return null;
      if (z <= 2) return (x === 11 && z === 2 && (y === 1 || y === 4)) ? 8 : (x === 0 && z === 2 && (y === 1 || y === 4)) ? 8 : 0;
      if (z <= 4 && x >= 3 && x <= 8) return z === 4 ? 0 : (x === 3 || x === 8 || y === 0 || y === 5) ? 4 : 0;
      return null; } },
    furgon: { nx: 15, ny: 6, nz: 7, cx: 3, cy: 3, get(x, y, z) {
      if ((rueda(x, z, 2, 3) || rueda(x, z, 11, 12)) && (y === 0 || y === 5)) return 1;
      if (z === 0) return null;
      if (x >= 12) { if (z > 5) return null; if (x === 14 && z >= 3 && z <= 4 && y >= 1 && y <= 4) return 4; if ((y === 0 || y === 5) && z >= 3 && z <= 4 && x === 13) return 4; return 0; }
      if (z === 3 && (y === 0 || y === 5)) return 0;               // franja con el color de la empresa
      return 5; } },
    camioneta: { nx: 16, ny: 6, nz: 6, cx: 3.6, cy: 3, get(x, y, z) {
      if ((rueda(x, z, 2, 4) || rueda(x, z, 12, 14)) && (y === 0 || y === 5)) return 1;
      if (z === 0) return null;
      if (x <= 7) { if (z === 1) return 0; if (z === 2 && (y === 0 || y === 5 || x === 0)) return 0; return null; } // pick-up abierto
      if (x >= 13) return z <= 2 ? (x === 15 && z === 2 && (y === 1 || y === 4) ? 8 : 0) : null;
      if (z <= 2) return 0;
      if (z <= 4) return (x === 12 || y === 0 || y === 5) && z === 3 ? 4 : 0;
      return null; } },
    tres4: { nx: 19, ny: 7, nz: 9, cx: 5.4, cy: 3.5, get(x, y, z) {
      if ((rueda(x, z, 3, 5) || rueda(x, z, 14, 16)) && (y === 0 || y === 6)) return 1;
      if (z === 0) return null;
      if (z === 1) return y >= 1 && y <= 5 ? 3 : null;
      if (x >= 14) { if (z > 7) return null; if (x === 18 && z >= 4 && z <= 6 && y >= 1 && y <= 5) return 4; return 0; }
      if (x === 13) return null;
      if (z === 5 && (y === 0 || y === 6)) return 0;
      return z >= 2 ? 5 : null; } },
    rigido: { nx: 26, ny: 8, nz: 11, cx: 7.5, cy: 4, get(x, y, z) {
      if ((rueda(x, z, 4, 6) || rueda(x, z, 7, 9) || rueda(x, z, 20, 22)) && (y === 0 || y === 7)) return 1;
      if (z === 0) return null;
      if (z === 1) return y >= 1 && y <= 6 ? 3 : null;
      if (x >= 20) { if (z > 9) return null; if (x === 25 && z >= 5 && z <= 7 && y >= 1 && y <= 6) return 4; return 0; }
      if (x === 19) return null;
      if (z === 6 && (y === 0 || y === 7)) return 0;
      return z >= 2 ? 5 : null; } },
  };
  const bufsVeh = {};
  GR.buildVehiculo = function (tipo, color) {
    const m = MODELOS[tipo]; if (!m) return null;
    if (!bufsVeh[tipo]) bufsVeh[tipo] = rot32(m);
    const pal = palette([color, '#18181c', '#b8bcc8', '#2a2a30', '#3a5a88', '#eef0f4', '#e8b890', darker(color, 0.75), '#fff4b0']);
    return bufsVeh[tipo].map(b => paint(b, pal, '#0c0c10'));
  };
  GR.REMOLQUES = { lona: ['#2a6ad0', '#e0e4ec', '#f0c020'], frigo: ['#f2f4f8', '#2a8ad0', '#d02a2a'], cisterna: ['#c8ccd4', '#e8a020', '#3a8a4a'], plataforma: ['#3a3a44', '#c8a060', '#8a5a2a'], contenedor: ['#c03a28', '#2a6aa8', '#3a8a3a', '#d08a20'] };
  GR.buildCamion = function () {
    const bt = rot32(TRACTO);
    const sombra = rot32({ nx: 19, ny: 8, nz: 1, cx: 3.3, cy: 4, sub: 1, get: () => 0 }).map(b => paint(b, palette(['#000000']), null));
    const tractos = {};
    const pinta = (cab, franja) => bt.map(b => paint(b, palette([cab, '#18181c', '#c8ccd4', '#2a2a30', '#3a5a88', '#fff4b0', '#ff3820', darker(cab, 0.72), franja]), '#0c0c10'));
    tractos.rojo = pinta('#d42a2a', '#f0f0f0'); tractos.blanco = pinta('#eceef2', '#2a6ad0'); tractos.azul = pinta('#2a58c0', '#f0c020'); tractos.verde = pinta('#2a8a4a', '#f0f0f0');
    const rem = {}, remSombra = rot32({ nx: 42, ny: 8, nz: 1, cx: GR.PIVOTE, cy: 4, sub: 1, get: () => 0 }).map(b => paint(b, palette(['#000000']), null));
    for (const tipo of Object.keys(GR.REMOLQUES)) {
      const bufs = rot32(remolque(tipo));
      rem[tipo] = GR.REMOLQUES[tipo].map(col => bufs.map(b => paint(b, palette([col, '#18181c', '#c8ccd4', '#2a2a30', '#3a5a88', '#fff4b0', '#ff3820', darker(col, 0.62), tipo === 'plataforma' ? '#a8763a' : '#f0f0f0']), '#0c0c10')));
    }
    return { tractos, sombra, rem, remSombra };
  };
  function darker(h, f) { const c = hex(h); return '#' + c.map(v => Math.round(v * f).toString(16).padStart(2, '0')).join(''); }
  GR.darker = darker;
  // ---------- tráfico: sedanes, furgones, camiones rígidos y buses ----------
  GR.buildAutos = function () {
    const sedan = { nx: 14, ny: 6, nz: 5, cx: 7, cy: 3, sub: 2, get(x, y, z) {
      if ((x >= 2 && x <= 3 || x >= 10 && x <= 11) && (y === 0 || y === 5) && z <= 1) return 2;
      if (z === 0) return null;
      if (z <= 2) return (x === 13 && z === 2 && (y === 1 || y === 4)) ? 4 : (x === 0 && z === 2 && (y === 1 || y === 4)) ? 5 : 0;
      if (z <= 4 && x >= 4 && x <= 10 && y >= 1 && y <= 4) return z === 4 ? 0 : (x === 4 || x === 10 || y === 1 || y === 4) ? 1 : 0;
      return null;
    } };
    const furgon = { nx: 16, ny: 6, nz: 7, cx: 8, cy: 3, sub: 2, get(x, y, z) {
      if ((x >= 2 && x <= 3 || x >= 12 && x <= 13) && (y === 0 || y === 5) && z <= 1) return 2;
      if (z === 0) return null;
      if (x >= 14) return z <= 3 ? (x === 15 && z === 2 && (y === 1 || y === 4) ? 4 : 0) : (z <= 5 && x === 14 && y >= 1 && y <= 4 ? 1 : null);
      if (z <= 6) return (x >= 12 && z >= 4 && z <= 5 && (y === 0 || y === 5)) ? 1 : 0;
      return null;
    } };
    const camion = { nx: 26, ny: 8, nz: 11, cx: 13, cy: 4, sub: 2, get(x, y, z) {
      if ((x >= 3 && x <= 5 || x >= 20 && x <= 22) && (y === 0 || y === 7) && z <= 2) return 2;
      if (z === 0) return null;
      if (x >= 20) { if (z > 8) return null; if (x === 25 && z >= 5 && z <= 7 && y >= 1 && y <= 6) return 1; return z <= 2 && x < 25 && (y === 0 || y === 7) ? 2 : 0; }
      if (x === 19) return null;
      if (z <= 2) return y >= 1 && y <= 6 ? 2 : null;
      return 3;
    } };
    const bus = { nx: 34, ny: 8, nz: 10, cx: 17, cy: 4, sub: 2, get(x, y, z) {
      if ((x >= 4 && x <= 6 || x >= 25 && x <= 27) && (y === 0 || y === 7) && z <= 2) return 2;
      if (z === 0) return null;
      if (z > 9) return null;
      if (z >= 5 && z <= 7 && (y === 0 || y === 7) && x % 4 !== 0) return 1;
      if (x === 33 && z >= 4 && z <= 7) return 1;
      return 0;
    } };
    const out = {};
    const hacer = (m, cols, extra) => { const bs = rot32(m); return cols.map(col => bs.map(b => paint(b, palette([col, '#1c2a40', '#141418', extra || col]), '#0c0c10'))); };
    out.sedan = hacer(sedan, ['#d8d8e0', '#3060c0', '#c03030', '#e8c840', '#3a9a5a', '#34343c', '#e07020', '#8a2a6a']);
    out.furgon = hacer(furgon, ['#f0f0f0', '#d0d0d8', '#2a5aa8', '#c83a2a']);
    out.camion = [['#c03030', '#f0f0f0'], ['#3060c0', '#e8e0d0'], ['#f0c020', '#a0a8b0'], ['#2a8a4a', '#e8e0d0']].map(([cab, caja]) => rot32(camion).map(b => paint(b, palette([cab, '#1c2a40', '#141418', caja]), '#0c0c10')));
    out.bus = hacer(bus, ['#f0f0f0', '#3aa0d0', '#e0a020'], '#ffffff');
    return out;
  };

  // ---------- paleta del suelo ----------
  const TC = {
    campo: ['#5c9a3a', '#56923a', '#64a240'], urbano: ['#a8a490', '#9e9a86', '#b2ae9a'], industria: ['#8e8a8a', '#86827e', '#9a9690'],
    pasto: ['#4ea83a', '#48a034', '#5cb444'], bosque: ['#2a6a2c', '#245e26', '#347a34'], arena: ['#e2d29c', '#d6c48a', '#ecdeaa'],
    agua: ['#2c6ab0', '#245ea0', '#3a7ac0'], plaza: ['#b8b4a6', '#aeaa9c', '#c4c0b2'], humedal: ['#5a8a5a', '#4c7c50', '#3a6a8a'],
    asf: ['#4e4e58', '#46464f', '#5a5a64'], vereda: ['#c4c2ba', '#b6b4ac', '#d0cec6'], solera: '#8a8880', berma: ['#8c8270', '#7e7462', '#9a907c'],
    linea: '#e8e8ea', amarilla: '#e8c030', cebra: '#ececec', patio: ['#9c9a94', '#928f88', '#a8a69e'], parcela: ['#7a9a3a', '#8aa848', '#9a8a4a', '#4e8a34', '#6a9a3a'],
  };
  const TP = {}; for (const k in TC) TP[k] = Array.isArray(TC[k]) ? TC[k].map(packH) : packH(TC[k]);
  const TER = ['campo', 'urbano', 'industria', 'pasto', 'bosque', 'arena', 'agua', 'plaza', 'humedal'];

  // ---------- suelo por bloques de 128×128 píxeles isométricos ----------
  const CS = 128;
  GR.Suelo = function (M) {
    const chunks = new Map();
    // cruces: vértices con 3 o más ejes, con su radio
    const cruces = [], gridX = new Map(), XG = 40;
    M.vert.forEach((v, i) => {
      if (v.ej.length < 3) return;
      let r = 0; for (const ei of v.ej) r = Math.max(r, M.ejes[ei].hw);
      const c = { x: v.x, y: v.y, r: r + 0.8, i };
      cruces.push(c); v.cruce = c;
      const k = Math.floor(v.x / XG) + ',' + Math.floor(v.y / XG); let l = gridX.get(k); if (!l) gridX.set(k, l = []); l.push(c);
    });
    const crucesRect = (x0, y0, x1, y1) => { const out = []; for (let gx = Math.floor(x0 / XG); gx <= Math.floor(x1 / XG); gx++) for (let gy = Math.floor(y0 / XG); gy <= Math.floor(y1 / XG); gy++) { const l = gridX.get(gx + ',' + gy); if (l) for (const c of l) out.push(c); } return out; };
    // patios de los depósitos
    const patios = M.depositos.map(d => ({ x: d.x, y: d.y, ang: d.ang, r: 15 }));
    function terreno(x, y, ix, iy, hz) {
      // posición con un poco de ruido para que los bordes de la grilla no se vean en escalera
      const jx = x + (hash(ix >> 1, iy >> 1) - 0.5) * 3, jy = y + (hash(iy >> 1, ix >> 1) - 0.5) * 3;
      const t = M.terreno(jx, jy);
      let pal;
      if (t < 0) { // campo del sur: parcelas, setos y bosquetes
        const n = vnoise(x / 90, y / 70), b = vnoise(x / 160 + 7, y / 160);
        if (b < 0.3) pal = TP.bosque;
        else { const p = TP.parcela[Math.floor(vnoise(Math.floor(x / 60) * 1.3, Math.floor(y / 45) * 1.7) * 5) % 5]; const col = hz < 0.2 ? shadeP(p, 0.92) : hz > 0.9 ? shadeP(p, 1.07) : p; if (((x % 60) + 60) % 60 < 1.4 && n > 0.4) return TP.bosque[1]; return col; }
      } else pal = TP[TER[t]];
      if (t === 6) { // agua con oleaje suave
        const w = ((x * 0.31 + y * 0.69 + vnoise(x / 30, y / 30) * 20) % 11 + 11) % 11;
        if (w < 0.6) return pack(110, 160, 220);
      }
      if (t === 4 || (t < 0 && pal === TP.bosque)) return hz < 0.3 ? pal[1] : hz > 0.8 ? pal[2] : pal[0];
      return hz < 0.12 ? pal[1] : hz > 0.94 ? pal[2] : pal[0];
    }
    function gen(cu, cv) {
      const u0 = cu * CS, v0 = cv * CS;
      const cvs = mk(CS, CS), cx = cvs.getContext('2d');
      const img = cx.createImageData(CS, CS), D = new Uint32Array(img.data.buffer);
      for (let by = 0; by < CS; by += 16) for (let bx = 0; bx < CS; bx += 16) {
        // caja del sub-bloque en metros
        const us = [u0 + bx, u0 + bx + 16], vs = [v0 + by, v0 + by + 16];
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        for (const u of us) for (const v of vs) { const X = (v + u / 2) / S, Y = (v - u / 2) / S; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
        const R = 8;
        const segs = M.segsRect(x0 - R, y0 - R, x1 + R, y1 + R);
        const cr = crucesRect(x0 - 12, y0 - 12, x1 + 12, y1 + 12);
        const pa = patios.filter(p => p.x > x0 - 20 && p.x < x1 + 20 && p.y > y0 - 20 && p.y < y1 + 20);
        // líneas de detención de los semáforos
        const li = (M.sem ? M.sem.lineas : []).filter(l => Math.max(l[0], l[2]) > x0 - 2 && Math.min(l[0], l[2]) < x1 + 2 && Math.max(l[1], l[3]) > y0 - 2 && Math.min(l[1], l[3]) < y1 + 2);
        for (let py = by; py < by + 16; py++) for (let px = bx; px < bx + 16; px++) {
          const u = u0 + px, v = v0 + py, X = v + u / 2, Y = v - u / 2, x = X / S, y = Y / S;
          const ix = X | 0, iy = Y | 0, hz = hash(ix, iy);
          let col = terreno(x, y, ix, iy, hz);
          // patio del depósito: losa de hormigón
          for (const p of pa) { const d = Math.hypot(x - p.x, y - p.y); if (d < p.r) { col = hz < 0.15 ? TP.patio[1] : hz > 0.9 ? TP.patio[2] : TP.patio[0]; if (d > p.r - 0.5) col = TP.solera; } }
          let enAsfalto = false;
          if (segs.length) {
            let bm = 1e9, be = null, bj = 0, bt = 0, bl = 0, bs = 0, bL = 1;
            for (let i = 0; i < segs.length; i += 2) {
              const e = M.ejes[segs[i]], j = segs[i + 1];
              const [ax, ay] = e.pts[j], [qx, qy] = e.pts[j + 1];
              const dx = qx - ax, dy = qy - ay, L2 = dx * dx + dy * dy || 1e-9;
              let t = ((x - ax) * dx + (y - ay) * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
              const ex = x - ax - dx * t, ey = y - ay - dy * t, d = Math.sqrt(ex * ex + ey * ey), m = d - e.hw;
              if (m < bm) { bm = m; be = e; bj = j; bt = t; bL = Math.sqrt(L2); bl = ((y - ay) * dx - (x - ax) * dy) / bL; bs = e.cum[j] + t * bL; }
            }
            if (be) {
              const cl = be.cl;
              if (bm < 0) {
                enAsfalto = true;
                const h2 = hash(ix >> 1, iy >> 1);
                col = h2 < 0.13 ? TP.asf[1] : h2 > 0.95 ? TP.asf[2] : TP.asf[0];
                // ¿en un cruce?
                let enCruce = false, dCruce = 1e9, rC = 0;
                for (const c of cr) { const d = Math.hypot(x - c.x, y - c.y); if (d < c.r) enCruce = true; if (d < dCruce && (c.i === be.a || c.i === be.b)) { dCruce = d; rC = c.r; } }
                if (!enCruce) {
                  const a = Math.abs(bl), hw = be.hw;
                  if (be.ow) {
                    if (hw > 4.2) {
                      if (a < 0.17 && ((bs % 9) + 9) % 9 < 4) col = TP.linea;
                      if (cl.berma && Math.abs(a - (hw - 0.45)) < 0.15) col = bl < 0 ? TP.amarilla : TP.linea;
                    }
                  } else {
                    if (a < 0.17 && (cl.vereda ? ((bs % 9) + 9) % 9 < 4.5 : true)) col = cl.berma ? TP.amarilla : TP.linea;
                    if (cl.berma && Math.abs(a - (hw - 0.45)) < 0.15) col = TP.linea;
                  }
                  // paso de cebra junto a los cruces de la ciudad
                  if (cl.vereda && dCruce < rC + 3.4 && dCruce > rC + 0.6 && a < hw - 0.4 && (Math.floor((bl + 20) / 0.7) & 1)) col = TP.cebra;
                }
              } else if (cl.vereda && bm < cl.vereda && M.terreno(x, y) !== 6) {
                col = bm < 0.3 ? TP.solera : ((((ix >> 1) + (iy >> 1)) & 3) === 0 ? TP.vereda[1] : hz > 0.93 ? TP.vereda[2] : TP.vereda[0]);
              } else if (cl.berma && bm < cl.berma) {
                col = hz < 0.3 ? TP.berma[1] : hz > 0.85 ? TP.berma[2] : TP.berma[0];
              }
            }
          }
          if (enAsfalto) for (const l of li) {
            const dx = l[2] - l[0], dy = l[3] - l[1], L2 = dx * dx + dy * dy || 1e-9;
            let t = ((x - l[0]) * dx + (y - l[1]) * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
            if (Math.hypot(x - l[0] - dx * t, y - l[1] - dy * t) < 0.32) { col = TP.linea; break; }
          }
          D[py * CS + px] = col;
        }
      }
      cx.putImageData(img, 0, 0);
      cvs.px = D; // los píxeles del suelo, para la vista en perspectiva (sin las sombras horneadas)
      // sombras horneadas de árboles y casas
      if (GR.decoEnBloque) for (const o of GR.decoEnBloque(cu, cv)) {
        const [u, v] = GR.iso(o.x * S, o.y * S), X = u - u0, Y = v - v0;
        cx.fillStyle = 'rgba(10,30,10,0.35)';
        if (o.k === 'casa') ditherEllipse(cx, X + 8, Y + 3, 18, 8); else if (o.k === 'poste') ditherEllipse(cx, X + 2, Y + 1, 3, 1); else ditherEllipse(cx, X + 5, Y + 2, 9, 4);
      }
      return cvs;
    }
    const Gd = {
      chunks, CS, cruces,
      get(cu, cv) { const k = cu + ',' + cv; let c = chunks.get(k); if (!c) { c = gen(cu, cv); chunks.set(k, c); } return c; },
      has: (cu, cv) => chunks.has(cu + ',' + cv),
      // píxeles de un bloque ya generado (o null), para muestrear el suelo en perspectiva
      pixeles(cu, cv) { const c = chunks.get(cu + ',' + cv); return c ? c.px : null; },
      // precalcula hasta n bloques alrededor de un punto de la pantalla (u,v)
      precargar(u, v, W, H, n) {
        for (let cu = Math.floor((u - W) / CS); cu <= Math.floor((u + W) / CS) && n > 0; cu++)
          for (let cv = Math.floor((v - H) / CS); cv <= Math.floor((v + H) / CS) && n > 0; cv++)
            if (!chunks.has(cu + ',' + cv)) { Gd.get(cu, cv); n--; }
      },
      // libera los lejanos
      podar(u, v) { if (chunks.size < 160) return; for (const k of chunks.keys()) { const [a, b] = k.split(',').map(Number); if (Math.abs(a * CS - u) > 900 || Math.abs(b * CS - v) > 600) chunks.delete(k); } },
      draw(ctx, camX, camY, W, H) {
        const ul = camX - W / 2, vt = camY - H / 2;
        for (let cu = Math.floor(ul / CS); cu <= Math.floor((ul + W) / CS); cu++)
          for (let cv = Math.floor(vt / CS); cv <= Math.floor((vt + H) / CS); cv++)
            ctx.drawImage(Gd.get(cu, cv), cu * CS - ul, cv * CS - vt);
      },
      mark(u, v, col) {
        const cu = Math.floor(u / CS), cv = Math.floor(v / CS), c = chunks.get(cu + ',' + cv);
        if (!c) return;
        const x = c.getContext('2d'); x.fillStyle = col; x.fillRect(Math.round(u) - cu * CS, Math.round(v) - cv * CS, 1, 1);
      },
    };
    return Gd;
  };

  // ---------- edificios extruidos (sprite por edificio, con contorno de pixel art) ----------
  const FACHADAS = ['#e8dcc0', '#d8c8a8', '#f0e8d8', '#c8d8e0', '#e0c0a0', '#a8c0a0', '#d0a8a0', '#f0d8a0', '#b8b8c8', '#e8e0e8', '#c89870', '#90a8c8'];
  const TECHOS = ['#a83a2a', '#6a6a72', '#8a3a3a', '#3a4a6a', '#5a6a5a', '#9a8a7a', '#b8603a'];
  // colores de un edificio (los mismos en la vista isométrica y en la de atrás)
  GR.colorEdificio = function (b, idx) {
    const grande = (b.x1 - b.x0) * (b.y1 - b.y0) > 900 || b.h > 9;
    return { pared: hex(FACHADAS[Math.floor(hash(idx, 7) * FACHADAS.length)]), techo: hex(grande ? (b.h > 9 ? '#8a8a92' : '#9a9aa2') : TECHOS[Math.floor(hash(idx, 3) * TECHOS.length)]), grande };
  };
  GR.edificio = function (b, idx) {
    const { pared, techo, grande } = GR.colorEdificio(b, idx);
    const zh = Math.round(b.h * S * 1.15);
    const pts = b.pts.map(([x, y]) => { const [u, v] = GR.iso(x * S, y * S); return [u, v]; });
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    for (const [u, v] of pts) { u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const ox = Math.floor(u0) - 2, oy = Math.floor(v0 - zh) - 2;
    const w = Math.ceil(u1 - ox) + 3, hh = Math.ceil(v1 - oy) + 3;
    const cv = mk(w, hh), c = cv.getContext('2d', { willReadFrequently: true }); // se lee de vuelta: mejor en memoria
    const P = pts.map(([u, v]) => [u - ox, v - oy]);
    // orientación del polígono (para saber qué lado es afuera)
    let area = 0; for (let k = 0, m = b.pts.length - 1; k < b.pts.length; m = k++) area += b.pts[m][0] * b.pts[k][1] - b.pts[k][0] * b.pts[m][1];
    const sg = area > 0 ? 1 : -1;
    const paredes = [];
    for (let k = 0, m = b.pts.length - 1; k < b.pts.length; m = k++) {
      const [ax, ay] = b.pts[m], [bx, by] = b.pts[k];
      // normal hacia afuera
      let nx = (by - ay) * sg, ny = -(bx - ax) * sg; const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
      if (nx + ny <= 0.02) continue; // no se ve
      paredes.push({ m, k, nx, ny, L, d: (ax + bx + ay + by) / 2 });
    }
    paredes.sort((a, b2) => a.d - b2.d);
    const rgb = (cc, f) => `rgb(${Math.min(255, cc[0] * f) | 0},${Math.min(255, cc[1] * f) | 0},${Math.min(255, cc[2] * f) | 0})`;
    for (const p of paredes) {
      const A = P[p.m], B = P[p.k], f = (p.ny - p.nx) * 0.5 + 0.5 > 0.5 ? 0.8 : 0.62;
      c.fillStyle = rgb(pared, f);
      c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.lineTo(B[0], B[1] - zh); c.lineTo(A[0], A[1] - zh); c.closePath(); c.fill();
      // ventanas: una por cada 1,7 m de muro y 3 m de altura
      const n = Math.floor(p.L / 1.7), pisos = Math.max(1, Math.floor(b.h / 3));
      c.fillStyle = grande ? 'rgba(40,60,90,0.85)' : 'rgba(50,60,80,0.8)';
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n; if (!grande && (i % 3 === 1)) continue;
        const x = A[0] + (B[0] - A[0]) * t, y = A[1] + (B[1] - A[1]) * t;
        for (let q = 0; q < pisos; q++) { const z = Math.round((q * 3 + 1.4) * S * 1.15); c.fillRect(Math.round(x), Math.round(y - z - 2), 1, 2); }
      }
    }
    c.fillStyle = rgb(techo, 1);
    c.beginPath(); P.forEach(([u, v], i) => i ? c.lineTo(u, v - zh) : c.moveTo(u, v - zh)); c.closePath(); c.fill();
    // bordes nítidos: sin semitransparencias
    const img = c.getImageData(0, 0, w, hh), d = img.data;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 110 ? 255 : 0;
    c.putImageData(img, 0, 0);
    outlineCanvas(cv, '#141018');
    return { cv, ox: -ox, oy: -oy, zh };
  };

  // ---------- minimapa: la red completa dibujada una vez, en la misma orientación isométrica ----------
  GR.buildMinimapa = function (M, sc) {
    const L = M.lim, pad = 300;
    const corners = [[L.x0 - pad, L.y0 - pad], [L.x1 + pad, L.y0 - pad], [L.x0 - pad, L.y1 + pad], [L.x1 + pad, L.y1 + pad]].map(([x, y]) => [(x - y) * sc, (x + y) / 2 * sc]);
    const u0 = Math.min(...corners.map(c => c[0])), u1 = Math.max(...corners.map(c => c[0])), v0 = Math.min(...corners.map(c => c[1])), v1 = Math.max(...corners.map(c => c[1]));
    const w = Math.ceil(u1 - u0), h = Math.ceil(v1 - v0);
    const cv = mk(w, h), c = cv.getContext('2d');
    const map = (x, y) => [(x - y) * sc - u0, (x + y) / 2 * sc - v0];
    c.fillStyle = '#2e4a2a'; c.fillRect(0, 0, w, h);
    // agua y ciudad desde las grillas (muestreo grueso)
    for (const ci of M.ciudades) {
      const g = ci.grid, st = Math.max(1, Math.round(2 / (sc * g.cell)));
      for (let gy = 0; gy < g.h; gy += st) for (let gx = 0; gx < g.w; gx += st) {
        const t = ci.cel[gy * g.w + gx]; if (t === 0) continue;
        c.fillStyle = t === 6 ? '#24508a' : t === 1 || t === 2 || t === 7 ? '#4a5048' : t === 4 ? '#22401f' : '#355a2e';
        const [u, v] = map(g.x0 + gx * g.cell, g.y0 + gy * g.cell); c.fillRect(Math.floor(u), Math.floor(v), Math.ceil(st * g.cell * sc * 1.5), Math.ceil(st * g.cell * sc * 0.9));
      }
    }
    const capa = (filtro, col, ancho) => {
      c.strokeStyle = col; c.lineWidth = ancho; c.lineCap = 'round'; c.beginPath();
      for (const e of M.ejes) { if (!filtro(e)) continue; e.pts.forEach(([x, y], i) => { const [u, v] = map(x, y); i ? c.lineTo(u, v) : c.moveTo(u, v); }); }
      c.stroke();
    };
    capa(e => e.c === 'residential' || e.c === 'living_street' || e.c === 'unclassified', '#8a8a90', 1);
    capa(e => e.c === 'secondary' || e.c === 'tertiary', '#c8c8cc', 1.4);
    capa(e => e.c === 'primary' || e.c === 'trunk' || e.c === 'link', '#f0d070', 1.8);
    capa(e => e.c === 'motorway', '#f09030', 2.4);
    return { cv, map, sc };
  };
  GR.wrap = function (str, max) {
    const out = []; let line = '';
    for (const w of String(str).split(' ')) {
      if ((line + ' ' + w).trim().length > max) { out.push(line); line = w; } else line = (line + ' ' + w).trim();
    }
    if (line) out.push(line);
    return out;
  };

  G.GR = GR;
})(window);
