// TURBO 40 — gráficos 2D pixel art: fuente, sprites isométricos (F40, palmeras, tribunas) y mapa.
(function (G) {
  'use strict';
  const T = G.T40;
  const GR = {};

  // ---------- color ----------
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const pack = (r, g, b) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
  const packH = h => { const c = hex(h); return pack(c[0], c[1], c[2]); };
  GR.hex = hex;
  function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  GR.hash = hash;

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

  // ---------- modelo F40 (vóxeles 1 unidad) ----------
  // materiales: 0 carrocería, 1 neumático, 2 llanta, 3 negro, 4 vidrio, 5 faro, 6 luz trasera, 7 carrocería oscura
  function carGet0(x, y, z) {
    const wx = (x >= 3 && x <= 7) || (x >= 18 && x <= 22);
    if (wx && (y <= 1 || y >= 10) && z <= 3) {
      const c = x <= 7 ? 5 : 20, dx = Math.abs(x - c);
      if (dx === 2 && (z === 0 || z === 3)) return null;
      if ((y === 0 || y === 11) && dx <= 1 && z >= 1 && z <= 2) return 2;
      return 1;
    }
    if (y < 1 || y > 10) {
      if (x <= 2 && z === 6 && y >= 0 && y <= 11) return 0; // ala trasera ancha
      return null;
    }
    if (z === 0) return null;
    // ala trasera
    if (x <= 2 && z === 6) return 0;
    if (x === 1 && (y === 2 || y === 9) && (z === 4 || z === 5)) return 3;
    // cabina
    if (x >= 9 && x <= 15 && y >= 3 && y <= 8 && (z === 5 || z === 6)) {
      if (x === 9) return 4;
      if (z === 6) return x >= 14 ? 4 : 0;
      if (x === 15) return 4;
      if (y === 3 || y === 8) return 4;
      return 0;
    }
    if (x === 15 && (y === 2 || y === 9) && z === 5) return 0; // espejos
    let top;
    if (x <= 1) top = 3; else if (x <= 17) top = 4; else if (x <= 21) top = 3; else top = 2;
    if (z > top) return null;
    if (z === 4 && x >= 3 && x <= 8 && y >= 3 && y <= 8 && (x % 2)) return 3; // rejillas motor
    if (x >= 22 && x <= 23 && z === 2 && (y === 2 || y === 3 || y === 8 || y === 9)) return 5;
    if (x === 25 && z === 1 && y >= 3 && y <= 8) return 3;
    if (x === 0 && z === 2 && (y === 2 || y === 3 || y === 8 || y === 9)) return 6;
    if (x === 0 && z === 1 && (y === 5 || y === 6)) return 2;
    if ((y === 1 || y === 10) && x >= 8 && x <= 10 && z === 3) return 3;
    if ((y === 1 || y === 10) && z === 1) return 7; // zócalo
    return 0;
  }
  function carGet(x, y, z) {
    const m = carGet0(x, y, z);
    if (m === 0 && (y === 5 || y === 6) && carGet0(x, y, z + 1) == null) return 8;
    return m;
  }
  const CAR_MODEL = { nx: 26, ny: 12, nz: 7, cx: 13, cy: 6, get: carGet, sub: 3 };
  GR.NANG = 32;

  function darker(h, f) { const c = hex(h); return '#' + c.map(v => Math.round(v * f).toString(16).padStart(2, '0')).join(''); }

  GR.buildCars = function (colors) {
    const bufs = [], shadows = [];
    for (let k = 0; k < GR.NANG; k++) {
      const a = k / GR.NANG * Math.PI * 2;
      const ex = [Math.cos(a), Math.sin(a)], ey = [-Math.sin(a), Math.cos(a)];
      bufs.push(voxRender(CAR_MODEL, ex, ey));
      // sombra: huella del auto
      const sb = voxRender({ nx: 26, ny: 12, nz: 1, cx: 13, cy: 6, get: () => 0, sub: 2 }, ex, ey);
      shadows.push(paint(sb, palette(['#000000']), null));
    }
    GR._bufs = bufs;
    const sprites = colors.map(col => GR.livery(col, col));
    return { sprites, shadows };
  };
  function carPal(col, stripe) { return palette([col, '#1c1c22', '#b8b8c4', '#141418', '#3a5a88', '#fff4b0', col === '#e8202a' ? '#ffb030' : '#ff3820', darker(col, 0.7), stripe || col]); }
  // 32 sprites de una pintura (cuerpo + franja)
  GR.livery = function (col, stripe) { const pal = carPal(col, stripe); return GR._bufs.map(b => paint(b, pal, '#0c0c10')); };
  // auto grande para el título
  GR.carBig = function (col, a, stripe) {
    const ex = [Math.cos(a), Math.sin(a)], ey = [-Math.sin(a), Math.cos(a)];
    const pal = carPal(col, stripe);
    return paint(voxRender({ ...CAR_MODEL, vs: 3, sub: 4 }, ex, ey), pal, '#0c0c10');
  };

  // ---------- tribuna (vóxeles de 2 unidades) ----------
  GR.buildStand = function (ang, side) {
    const R = T.rng(99);
    const crowd = [];
    for (let i = 0; i < 15 * 18; i++) crowd.push(R() < 0.6 ? 1 + Math.floor(R() * 6) : 0);
    const frames = [];
    for (let fr = 0; fr < 2; fr++) {
      const get = (x, y, z) => {
        const tier = Math.floor(y / 6), h = (tier + 1) * 3;
        if (y >= 17) return z <= 11 ? (z === 11 ? 9 : 8) : null; // muro trasero
        if (z < h) return (z === h - 1) ? 0 : ((x + z) % 4 < 2 ? 7 : 8);
        // público
        const cc = crowd[x * 18 + y];
        const jump = fr && ((x * 7 + y * 3) % 3 === 0);
        if (cc && y % 6 >= 2 && y % 6 <= 4 && z === h + (jump ? 1 : 0)) return cc;
        return null;
      };
      const t = [Math.cos(ang), Math.sin(ang)], n = [-Math.sin(ang) * side, Math.cos(ang) * side];
      const buf = voxRender({ nx: 15, ny: 18, nz: 13, cx: 7.5, cy: 9, vs: 2, get, sub: 3 }, t, n);
      const pal = palette(['#c8c8d0', '#ff4040', '#ffe040', '#40a0ff', '#ffffff', '#40e070', '#ff80c0', '#2848c8', '#8888a0', '#e8e8f0']);
      frames.push(paint(buf, pal, '#101018'));
    }
    return frames;
  };

  // ---------- palmeras y neumáticos (pixel art directo) ----------
  GR.buildPalms = function () {
    const out = [];
    for (let v = 0; v < 3; v++) {
      const w = 40, h = 52, cv = mk(w, h), c = cv.getContext('2d');
      const px = (x, y, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), 1, 1); };
      const bend = [3, -4, 6][v], th = [30, 34, 27][v];
      const cx = 20, base = h - 2;
      for (let i = 0; i <= th; i++) {
        const t = i / th, x = cx + bend * t * t, y = base - i;
        const ring = (i % 4) < 1;
        px(x - 1, y, ring ? '#5a3410' : '#9a6428'); px(x, y, ring ? '#6a4018' : '#7a4c1c'); px(x + 1, y, ring ? '#4a2a0c' : '#5e3a14');
      }
      const tx = cx + bend, ty = base - th;
      const leaves = [[-1, 0.2], [1, 0.2], [-0.7, -0.9], [0.7, -0.9], [-0.35, 0.7], [0.4, 0.75], [0, -1]];
      leaves.forEach(([dx, dy], li) => {
        const L = 13 + (li % 3);
        for (let s = 0; s <= L; s++) {
          const t = s / L;
          const x = tx + dx * s, y = ty + dy * s * 0.6 + t * t * 7 * (Math.abs(dy) < 0.8 ? 1 : 0.4);
          const wdt = Math.max(1, Math.round(2.5 * Math.sin(Math.PI * t)));
          for (let k = -wdt; k <= wdt; k++) {
            const col = k === -wdt ? '#7ad84a' : (k === wdt ? '#1a7a28' : '#38b038');
            px(x, y + k * 0.7, col);
          }
        }
      });
      px(tx - 1, ty + 1, '#4a2a08'); px(tx + 1, ty + 1, '#4a2a08'); px(tx, ty + 2, '#3a2006');
      outlineCanvas(cv, '#0c2410');
      out.push({ cv, ox: cx, oy: base });
    }
    return out;
  };
  function outlineCanvas(cv, col) {
    const c = cv.getContext('2d'), w = cv.width, h = cv.height;
    const img = c.getImageData(0, 0, w, h), d = new Uint32Array(img.data.buffer), src = d.slice(), oc = packH(col);
    for (let k = 0; k < d.length; k++) {
      if (src[k]) continue; const x = k % w;
      if ((x > 0 && src[k - 1]) || (x < w - 1 && src[k + 1]) || (k >= w && src[k - w]) || (k + w < d.length && src[k + w])) d[k] = oc;
    }
    c.putImageData(img, 0, 0);
  }
  GR.buildTires = function () {
    return [0, 1].map(v => {
      const cv = mk(13, 13), c = cv.getContext('2d');
      for (let l = 0; l < 2; l++) {
        const y0 = 8 - l * 4;
        c.fillStyle = '#18181c'; c.fillRect(2, y0, 9, 4); c.fillRect(3, y0 - 1, 7, 6);
        c.fillStyle = v ? '#e8e8e8' : '#e02828'; c.fillRect(2, y0 + 1, 9, 2);
        c.fillStyle = '#3a3a44'; c.fillRect(4, y0 - 1, 5, 1);
        c.fillStyle = '#060608'; c.fillRect(5, y0, 3, 1);
      }
      outlineCanvas(cv, '#060608');
      return { cv, ox: 6, oy: 11 };
    });
  };

  // ---------- temas de paisaje ----------
  GR.TEMAS = {
    europa: { g1: '#58a838', g2: '#4c9a30', gedge: '#2f6a22', flor: '#c8e868', out: '#2e6a26', dirt: ['#9a7048', '#8a6038', '#ae845a'], rut: '#6e4c2c', trap: ['#e0c070', '#cfae5c', '#f0d890'] },
    japon: { g1: '#64ac4c', g2: '#58a040', gedge: '#33702a', flor: '#ffb8d8', out: '#356e2c', dirt: ['#94704c', '#84603e', '#a8845c'], rut: '#664828', trap: ['#e0c878', '#cfb464', '#f0dc98'] },
    america: { g1: '#48a040', g2: '#3c9034', gedge: '#2a6a24', flor: '#ffe060', out: '#24601e', dirt: ['#b0603a', '#9c5230', '#c4744a'], rut: '#7a3a20', trap: ['#e0c070', '#cfae5c', '#f0d890'] },
    sahara: { g1: '#e2bc78', g2: '#d8b06a', gedge: '#c49a58', flor: '#f0d49a', out: '#d0a460', dirt: ['#a8703e', '#986234', '#b8824e'], rut: '#74481e', trap: ['#ecd090', '#e0c07c', '#f6e2aa'], arena: true },
  };
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  // ---------- suelo por bloques (chunks) ----------
  GR.iso = (x, y) => [x - y, (x + y) / 2];
  const CS = 128;
  GR.Ground = function (trk) {
    const HW = T.HW, th = GR.TEMAS[trk.tema] || GR.TEMAS.europa;
    const P = {};
    for (const k of ['g1', 'g2', 'gedge', 'flor', 'out', 'rut']) P[k] = packH(th[k]);
    P.d = th.dirt.map(packH); P.t = th.trap.map(packH);
    P.a1 = packH('#5c5c68'); P.a2 = packH('#50505c'); P.a3 = packH('#686874'); P.line = packH('#e8e8ec');
    P.cr = packH('#d82818'); P.cw = packH('#f0f0f0'); P.blk = packH('#18181c'); P.wht = packH('#f4f4f4');
    const sh = th.arena ? [packH('#c89a5a'), packH('#f0d090')] : null;
    const chunks = new Map();
    const RM = HW + T.SAND + 14;
    // grilla de largada
    const slots = [];
    for (let k = 0; k < T.NCARS; k++) { const row = Math.floor(k / 2), col = k % 2; slots.push([-26 - row * 44 - col * 22, col ? -14 : 14]); }
    // decoración indexada por bloque iso (para hornear sombras y dunas)
    const decoByChunk = new Map();
    for (const o of trk.scen.decor.concat(trk.scen.stands, trk.scen.oil || [])) {
      const [u, v] = GR.iso(o.x, o.y), key = Math.floor(u / CS) + ',' + Math.floor(v / CS);
      let l = decoByChunk.get(key); if (!l) decoByChunk.set(key, l = []); l.push(o);
    }
    function gen(cu, cv) {
      const u0 = cu * CS, v0 = cv * CS;
      const cvs = mk(CS, CS), cx = cvs.getContext('2d');
      const img = cx.createImageData(CS, CS), D = new Uint32Array(img.data.buffer);
      const xmin = v0 + u0 / 2 - RM, xmax = v0 + CS + (u0 + CS) / 2 + RM;
      const ymin = v0 - (u0 + CS) / 2 - RM, ymax = v0 + CS - u0 / 2 + RM;
      // muestras candidatas
      const cand = [];
      for (let gx = Math.floor(xmin / 64); gx <= Math.floor(xmax / 64); gx++)
        for (let gy = Math.floor(ymin / 64); gy <= Math.floor(ymax / 64); gy++) {
          const l = trk.grid.get(gx + ',' + gy); if (l) for (const i of l) cand.push(i);
        }
      const G2 = 2, gw = Math.ceil((xmax - xmin) / G2), gh = Math.ceil((ymax - ymin) / G2);
      let fi = null;
      if (cand.length) {
        fi = new Int32Array(gw * gh).fill(-1); const fd = new Float32Array(gw * gh).fill(1e12);
        const rc = Math.ceil(RM / G2);
        for (const i of cand) {
          const p = trk.pts[i];
          const gx0 = Math.floor((p.x - xmin) / G2), gy0 = Math.floor((p.y - ymin) / G2);
          for (let gy = Math.max(0, gy0 - rc); gy <= Math.min(gh - 1, gy0 + rc); gy++)
            for (let gx = Math.max(0, gx0 - rc); gx <= Math.min(gw - 1, gx0 + rc); gx++) {
              const dx = xmin + (gx + 0.5) * G2 - p.x, dy = ymin + (gy + 0.5) * G2 - p.y, d2 = dx * dx + dy * dy, k = gy * gw + gx;
              if (d2 < fd[k] && d2 < RM * RM) { fd[k] = d2; fi[k] = i; }
            }
        }
      }
      const sS = trk.startS, fS = trk.finishS;
      for (let py = 0; py < CS; py++) for (let px = 0; px < CS; px++) {
        const u = u0 + px, v = v0 + py, x = v + u / 2, y = v - u / 2;
        const ix = x | 0, iy = y | 0, hz = hash(ix, iy);
        let col;
        if (sh) { // dunas
          const n = vnoise(x / 110, y / 110), rip = ((x * 0.7 + y * 0.3 + n * 60) % 13 + 13) % 13;
          col = n > 0.68 ? sh[1] : n < 0.3 ? sh[0] : (((Math.floor(x / 48) + Math.floor(y / 48)) & 1) ? P.g1 : P.g2);
          if (rip < 1.1 && n > 0.3) col = sh[0];
        } else {
          col = ((Math.floor(x / 48) + Math.floor(y / 48)) & 1) ? P.g1 : P.g2;
          if (vnoise(x / 70, y / 70) < 0.22) col = P.out;
        }
        if (hz > 0.994) col = P.flor;
        if (fi) {
          const k = Math.floor((y - ymin) / G2) * gw + Math.floor((x - xmin) / G2), i = fi[k];
          if (i >= 0) {
            const p = trk.pts[i], dx = x - p.x, dy = y - p.y;
            const lat = dx * p.nx + dy * p.ny, s = p.s + dx * p.tx + dy * p.ty, a = Math.abs(lat);
            const edge = p.dirt ? (hash(ix >> 2, iy >> 2) - 0.5) * 6 : 0;
            if (a < HW + edge) {
              if (p.dirt) {
                const h2 = hash(ix >> 1, iy >> 1);
                col = h2 < 0.18 ? P.d[1] : (h2 > 0.9 ? P.d[2] : P.d[0]);
                const r = Math.abs(a - 13);
                if (r < 2.2 && hash(ix, iy >> 1) < 0.75) col = P.rut;
                if (a > HW + edge - 2.5) col = P.rut;
              } else {
                const h2 = hash(ix >> 1, iy >> 1);
                col = h2 < 0.13 ? P.a2 : (h2 > 0.95 ? P.a3 : P.a1);
                if (a > HW - 3.2 && a < HW - 1.6) col = P.line;
              }
              const ds = s - sS;
              if (ds >= 0 && ds < 7) col = ((Math.floor((lat + HW) / 3.5) + Math.floor(ds / 3.5)) & 1) ? P.blk : P.wht;
              const df = s - fS;
              if (df >= 0 && df < 10.5) col = ((Math.floor((lat + HW) / 3.5) + Math.floor(df / 3.5)) & 1) ? P.blk : P.wht;
              if (ds < 0 && ds > -260) for (const [ss, sl] of slots) {
                const q = ds - ss, dl = lat - sl;
                if ((q > 11 && q < 12.8 && Math.abs(dl) < 9) || (Math.abs(Math.abs(dl) - 9) < 0.9 && q > 3 && q < 12.8)) col = P.wht;
              }
            } else if (a < HW + T.CURB && p.curb) {
              col = (Math.floor(s / 9) & 1) ? P.cr : P.cw;
              if (a > HW + T.CURB - 1) col = P.gedge;
            } else if (p.sand && Math.sign(lat) === p.sand && a < HW + T.SAND) {
              col = hz < 0.15 ? P.t[1] : (hz > 0.93 ? P.t[2] : P.t[0]);
            } else if (a < HW + 1.6 && !p.dirt) col = P.gedge;
          }
        }
        D[py * CS + px] = col;
      }
      cx.putImageData(img, 0, 0);
      // sombras y dunas horneadas
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const l = decoByChunk.get((cu + ox) + ',' + (cv + oy)); if (!l) continue;
        for (const o of l) {
          const [u, v] = GR.iso(o.x, o.y), X = u - u0, Y = v - v0;
          if (o.kind === 'aceite') { // mancha de aceite con reflejo tornasolado
            const rx = o.r * 1.4, ry = o.r * 0.7;
            for (let yy = -Math.ceil(ry); yy <= ry; yy++) for (let xx = -Math.ceil(rx); xx <= rx; xx++) {
              const d = (xx * xx) / (rx * rx) + (yy * yy) / (ry * ry);
              if (d > 1 + (hash(xx + 3, yy + 7) - 0.5) * 0.5) continue;
              const k = hash(Math.round(X + xx), Math.round(Y + yy));
              cx.fillStyle = d < 0.5 && k > 0.9 ? ['#ff40c0', '#40e0ff', '#f0f040'][Math.floor(k * 30) % 3] : (k > 0.7 ? '#26262e' : '#121216');
              cx.fillRect(Math.round(X + xx), Math.round(Y + yy), 1, 1);
            }
            continue;
          }
          if (o.kind === 'duna') {
            cx.fillStyle = 'rgba(255,240,200,0.35)'; ditherEllipse(cx, X - 6, Y - 4, 40, 16);
            cx.fillStyle = 'rgba(150,100,40,0.35)'; ditherEllipse(cx, X + 14, Y + 8, 34, 12);
          } else if (o.side !== undefined) { cx.fillStyle = 'rgba(10,30,10,0.4)'; ditherEllipse(cx, X + 8, Y + 6, 30, 14); }
          else if (o.kind !== 'arbusto') { cx.fillStyle = th.arena ? 'rgba(90,60,20,0.4)' : 'rgba(10,40,10,0.45)'; ditherEllipse(cx, X + 6, Y + 2, o.kind === 'roca' ? 8 : 10, 4); }
        }
      }
      return cvs;
    }
    const G = {
      chunks, CS,
      get(cu, cv) { const k = cu + ',' + cv; let c = chunks.get(k); if (!c) { c = gen(cu, cv); chunks.set(k, c); } return c; },
      // cola en orden de pista: [cu, cv, s]; ultS guarda hasta qué punto de la pista hace falta cada bloque
      queue: [], ultS: new Map(),
      plan() {
        const seen = new Set();
        for (let i = 0; i < trk.N; i += 6) {
          const p = trk.pts[i], [u, v] = GR.iso(p.x, p.y);
          for (let cu = Math.floor((u - 260) / CS); cu <= Math.floor((u + 260) / CS); cu++)
            for (let cv = Math.floor((v - 170) / CS); cv <= Math.floor((v + 170) / CS); cv++) {
              const k = cu + ',' + cv;
              G.ultS.set(k, p.s);
              if (!seen.has(k)) { seen.add(k); G.queue.push([cu, cv, p.s]); }
            }
        }
      },
      // genera hasta n bloques, solo los que hacen falta antes de sHasta
      work(n, sHasta) {
        while (n-- > 0 && G.queue.length && (sHasta == null || G.queue[0][2] <= sHasta)) { const [cu, cv] = G.queue.shift(); G.get(cu, cv); }
        return G.queue.length;
      },
      pendiente: sHasta => G.queue.length > 0 && G.queue[0][2] <= sHasta,
      // libera los bloques que quedaron atrás (vuelven a generarse si hicieran falta)
      evict(sAhora) {
        for (const k of chunks.keys()) { const u = G.ultS.get(k); if (u != null && u < sAhora - 700) chunks.delete(k); }
      },
      draw(ctx, camX, camY, W, H) {
        const ul = camX - W / 2, vt = camY - H / 2;
        for (let cu = Math.floor(ul / CS); cu <= Math.floor((ul + W) / CS); cu++)
          for (let cv = Math.floor(vt / CS); cv <= Math.floor((vt + H) / CS); cv++)
            ctx.drawImage(G.get(cu, cv), cu * CS - ul, cv * CS - vt);
      },
      mark(u, v, col) {
        const cu = Math.floor(u / CS), cv = Math.floor(v / CS), c = chunks.get(cu + ',' + cv);
        if (!c) return;
        const x = c.getContext('2d'); x.fillStyle = col; x.fillRect(Math.round(u) - cu * CS, Math.round(v) - cv * CS, 2, 1);
      },
    };
    G.plan();
    return G;
  };
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
    return S;
  };
  // ---------- gente y animales que cruzan, comisarios, coleccionable ----------
  function sprite(w, h, rows, cols) {
    const { cv, px } = canvasPx(w + 2, h + 2);
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (cols[ch]) px(1 + x, 1 + y, cols[ch]); }));
    outlineCanvas(cv, '#0c0c10');
    return { cv, ox: Math.floor((w + 2) / 2), oy: h + 1 };
  }
  GR.buildCrossers = function () {
    const S = {};
    const shirts = ['#e83040', '#2a70e0', '#f0c020'];
    S.persona = shirts.map(sh => [
      ['.hh.', '.ff.', '.ff.', 'ssss', 'ssss', 'fssf', '.ss.', '.pp.', '.pp.', 'p..p', 'p..p', 'b..b'],
      ['.hh.', '.ff.', '.ff.', 'ssss', 'ssss', 'fssf', '.ss.', '.pp.', '.pp.', '.pp.', '.pp.', '.bb.'],
    ].map(r => sprite(4, 12, r, { h: '#3a2414', f: '#f0b890', s: sh, p: '#2a3050', b: '#101010' })));
    const dog = { c: '#a8692c', d: '#6a3e14', n: '#101010' };
    S.perro = [0, 1, 2].map(() => [
      ['......dd', 'cccccccd', 'cccccccc', 'cc....c.', 'c.....c.'],
      ['......dd', 'cccccccd', 'cccccccc', '.c...c..', '.c...c..'],
    ].map(r => sprite(8, 5, r, dog)));
    S.ciervo = [0, 1, 2].map(() => [
      ['a.a.....', '.a......', '.hh.....', '.hcccccc', '..cccccc', '..cccccc', '..c....c', '..c....c'],
      ['a.a.....', '.a......', '.hh.....', '.hcccccc', '..cccccc', '..cccccc', '...c..c.', '...c..c.'],
    ].map(r => sprite(8, 8, r, { a: '#d8c090', h: '#8a5228', c: '#a0602c' })));
    S.gallina = [0, 1, 2].map(() => [
      ['.r..', 'ww..', 'wwww', 'wwww', '.y.y'], ['.r..', 'ww..', 'wwww', 'wwww', 'y..y'],
    ].map(r => sprite(4, 5, r, { r: '#e02020', w: '#f8f8f0', y: '#f0a020' })));
    S.rodadora = [0, 1, 2].map(() => [
      ['.tttt.', 't.t..t', 'tt.t.t', 't.tt.t', 't..t.t', '.tttt.'], ['.tttt.', 't..t.t', 't.tt.t', 'tt.t.t', 't.t..t', '.tttt.'],
    ].map(r => sprite(6, 6, r, { t: '#a08048' })));
    S.pelota = [0, 1, 2].map(() => [
      ['.rrww.', 'rrwwbb', 'rrwwbb', 'yywwbb', 'yywwgg', '.ywwg.'], ['.wwbb.', 'wwbbgg', 'wwbbgg', 'rrwwgg', 'rrwwyy', '.rwwy.'],
    ].map(r => sprite(6, 6, r, { r: '#ff3030', w: '#ffffff', b: '#3060ff', y: '#ffd020', g: '#30c040' })));
    // comisario con bandera amarilla (2 cuadros)
    const mk2 = flag => sprite(10, 14, flag.concat(['....oo....', '...oooo...', '...oooo...', '....oo....', '....kk....', '...k..k...']), { y: '#ffe020', l: '#c0c0c0', o: '#ff7010', k: '#202020', f: '#f0b890' });
    S.marshal = [
      mk2(['yyyyl.....', 'yyyyl.....', 'yyyyl.....', '....l.....', '....lff...', '....oo....', '...oooo...', '...oooo...']),
      mk2(['..yyyyl...', '.yyyy.l...', 'yyyy..l...', '......l...', '.....lff..', '....oo....', '...oooo...', '...oooo...']),
    ];
    return S;
  };
  // ícono del auto coleccionable: disco dorado con un autito
  GR.buildColeccion = function () {
    const { cv, c } = canvasPx(20, 20);
    c.fillStyle = '#0c0c14'; c.beginPath(); c.arc(10, 10, 9.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffd020'; c.beginPath(); c.arc(10, 10, 8.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#7a5208'; c.beginPath(); c.arc(10, 10, 7, 0, Math.PI * 2); c.fill();
    const car = ['....###...', '..#######.', '##########', '#oo####oo#', '.oo....oo.'];
    car.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') { c.fillStyle = ch === 'o' ? '#202020' : '#fff4a0'; c.fillRect(5 + x, 7 + y, 1, 1); } }));
    return { cv, ox: 10, oy: 10 };
  };

  // íconos de objetos recogibles (12x12 sobre un disco)
  GR.buildPickups = function () {
    const out = {};
    const ring = { cash: '#30e050', llave: '#40a0ff', goma: '#ff9020', aceite: '#ffe040', nitro: '#20e0ff', caja: '#ff40c0' };
    for (const k in ring) {
      const { cv, c, px } = canvasPx(16, 16);
      c.fillStyle = '#0c0c14'; c.beginPath(); c.arc(8, 8, 7.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = ring[k]; c.beginPath(); c.arc(8, 8, 6.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#0c0c14'; c.beginPath(); c.arc(8, 8, 5, 0, Math.PI * 2); c.fill();
      const P = (s, cols) => s.forEach((row, y) => [...row].forEach((ch, x) => { if (cols[ch]) px(3 + x, 3 + y, cols[ch]); }));
      if (k === 'cash') P(['....##....', '...#yy#...', '..#yyyy#..', '.#yy$yyy#.', '.#yy$$yy#.', '.#yyy$yy#.', '.#yy$$yy#.', '..######..'], { '#': '#1a6a20', y: '#40d040', $: '#f8f080' });
      if (k === 'llave') P(['.##.......', '#..#......', '#..##.....', '.##.##....', '....##....', '.....##...', '......##..', '.......##.'], { '#': '#d0d8e8' });
      if (k === 'goma') P(['..####....', '.#gggg#...', '#gg##gg#..', '#g#..#g#..', '#g#..#g#..', '#gg##gg#..', '.#gggg#...', '..####....'], { '#': '#101010', g: '#505058' });
      if (k === 'aceite') P(['....#.....', '...###....', '..#####...', '.#yyyyy#..', '.#y#y#y#..', '.#yyyyy#..', '.#yyyyy#..', '.#######..'], { '#': '#202020', y: '#f0d020' });
      if (k === 'nitro') P(['...##.....', '..####....', '..#bb#....', '..#bb#....', '..#bb#....', '..#bb#....', '..####....', '..o.o.....'], { '#': '#e0e8ff', b: '#2080ff', o: '#ff8020' });
      if (k === 'caja') P(['########..', '#oooooo#..', '#oo??oo#..', '#ooo?oo#..', '#oo?ooo#..', '#oooooo#..', '#oo?ooo#..', '########..'], { '#': '#5a3410', o: '#b07030', '?': '#fff060' });
      out[k] = { cv, ox: 8, oy: 8 };
    }
    return out;
  };

  // ---------- minimapa (etapa abierta) ----------
  GR.buildMinimap = function (trk, bw, bh) {
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    const P = trk.pts.filter((p, i) => i % 3 === 0).map(p => { const u = p.x - p.y, v = (p.x + p.y) / 2; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); return [u, v, p]; });
    const sc = Math.min((bw - 8) / (u1 - u0), (bh - 8) / (v1 - v0));
    const ox = (bw - (u1 - u0) * sc) / 2 - u0 * sc, oy = (bh - (v1 - v0) * sc) / 2 - v0 * sc;
    const cv = mk(bw, bh), c = cv.getContext('2d');
    const map = (x, y) => [Math.round((x - y) * sc + ox), Math.round((x + y) / 2 * sc + oy)];
    c.fillStyle = '#000'; P.forEach(([u, v]) => c.fillRect(Math.round(u * sc + ox) - 1, Math.round(v * sc + oy) - 1, 3, 3));
    P.forEach(([u, v, p]) => { c.fillStyle = p.dirt ? '#d09050' : '#c8c8d8'; c.fillRect(Math.round(u * sc + ox), Math.round(v * sc + oy), 1, 1); });
    const flag = (s, col) => { const p = trk.pts[Math.round(s / trk.DS)], [x, y] = map(p.x, p.y); c.fillStyle = '#000'; c.fillRect(x - 2, y - 2, 5, 5); c.fillStyle = col; c.fillRect(x - 1, y - 1, 3, 3); };
    flag(trk.startS, '#fff'); flag(trk.finishS, '#ff2a6d');
    return { cv, map };
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
