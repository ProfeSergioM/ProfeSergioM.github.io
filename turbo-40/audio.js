// TURBO 40 — audio chiptune con WebAudio (todo sintetizado).
(function (G) {
  'use strict';
  const AU = { ctx: null, muted: false, musicOn: false };
  let master, music, sfx, noiseBuf, pulse;
  let eng = null, screech = null, rumble = null;
  const voices = [];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  AU.init = function () {
    if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
    const AC = G.AudioContext || G.webkitAudioContext; if (!AC) return;
    const c = AU.ctx = new AC();
    master = c.createGain(); master.gain.value = 0.55; master.connect(c.destination);
    music = c.createGain(); music.gain.value = 0.32; music.connect(master);
    sfx = c.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // onda de pulso 25% estilo consola
    const N = 32, re = new Float32Array(N), im = new Float32Array(N);
    for (let n = 1; n < N; n++) im[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * 0.25);
    pulse = c.createPeriodicWave(re, im);
    // motor
    const o1 = c.createOscillator(), o2 = c.createOscillator(), o3 = c.createOscillator();
    o1.type = 'sawtooth'; o2.setPeriodicWave(pulse); o3.type = 'square';
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 4;
    const g = c.createGain(); g.gain.value = 0;
    o1.connect(lp); o2.connect(lp); o3.connect(lp); lp.connect(g); g.connect(sfx);
    o1.start(); o2.start(); o3.start();
    eng = { o1, o2, o3, lp, g };
    // motores de los rivales: 4 voces con paneo estéreo
    for (let v = 0; v < 4; v++) {
      const a = c.createOscillator(), b = c.createOscillator();
      a.type = 'sawtooth'; b.setPeriodicWave(pulse);
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 3;
      const gg = c.createGain(); gg.gain.value = 0;
      const pan = c.createStereoPanner ? c.createStereoPanner() : null;
      a.connect(f); b.connect(f); f.connect(gg);
      if (pan) { gg.connect(pan); pan.connect(sfx); } else gg.connect(sfx);
      a.start(); b.start();
      voices.push({ a, b, f, g: gg, pan, car: null });
    }
    screech = loopNoise('bandpass', 2300, 6);
    rumble = loopNoise('lowpass', 260, 1);
  };
  function loopNoise(type, f, q) {
    const c = AU.ctx, s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = c.createGain(); g.gain.value = 0;
    s.connect(fl); fl.connect(g); g.connect(sfx); s.start();
    return { g, fl };
  }
  AU.toggleMute = function () { AU.muted = !AU.muted; if (master) master.gain.value = AU.muted ? 0 : 0.55; };

  // estado continuo del auto del jugador
  AU.car = function (on, rpm, thr, slip, grass) {
    if (!AU.ctx) return;
    const t = AU.ctx.currentTime;
    const f = 38 + rpm * 120;
    eng.o1.frequency.setTargetAtTime(f, t, 0.03);
    eng.o2.frequency.setTargetAtTime(f * 1.005, t, 0.03);
    eng.o3.frequency.setTargetAtTime(f / 2, t, 0.03);
    eng.lp.frequency.setTargetAtTime(500 + rpm * 1400 + thr * 500, t, 0.05);
    eng.g.gain.setTargetAtTime(on ? 0.05 + thr * 0.05 : 0, t, 0.05);
    screech.g.gain.setTargetAtTime(on ? Math.min(0.14, Math.max(0, slip - 28) / 140) : 0, t, 0.04);
    rumble.g.gain.setTargetAtTime(on && grass ? 0.35 : 0, t, 0.05);
  };

  // list: [{car, rpm, vol, pan, dop}] de los rivales más cercanos (máx. 4)
  AU.others = function (list) {
    if (!AU.ctx) return;
    const t = AU.ctx.currentTime;
    const want = new Map(list.map(o => [o.car, o]));
    // mantener la voz asignada a cada auto para que no salte el tono
    for (const v of voices) if (v.car && !want.has(v.car)) v.car = null;
    for (const o of list) if (!voices.some(v => v.car === o.car)) { const v = voices.find(v => !v.car); if (v) v.car = o.car; }
    for (const v of voices) {
      const o = v.car && want.get(v.car);
      if (!o) { v.g.gain.setTargetAtTime(0, t, 0.08); continue; }
      const det = 1 + ((o.car.id * 37) % 11 - 5) * 0.012; // cada auto suena un poco distinto
      const f = (36 + o.rpm * 115) * det * o.dop;
      v.a.frequency.setTargetAtTime(f, t, 0.04);
      v.b.frequency.setTargetAtTime(f * 0.5 * 1.01, t, 0.04);
      v.f.frequency.setTargetAtTime(400 + o.rpm * 1100, t, 0.05);
      v.g.gain.setTargetAtTime(o.vol, t, 0.06);
      if (v.pan) v.pan.pan.setTargetAtTime(o.pan, t, 0.05);
    }
  };

  function tone(freq, t0, dur, type, vol, dest, slide) {
    const c = AU.ctx, o = c.createOscillator(), g = c.createGain();
    if (type === 'pulse') o.setPeriodicWave(pulse); else o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g); g.connect(dest || sfx); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(t0, dur, vol, f, type, dest) {
    const c = AU.ctx, s = c.createBufferSource(); s.buffer = noiseBuf;
    const fl = c.createBiquadFilter(); fl.type = type || 'highpass'; fl.frequency.value = f || 5000;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    s.connect(fl); fl.connect(g); g.connect(dest || sfx); s.start(t0, Math.random()); s.stop(t0 + dur + 0.02);
  }

  AU.beep = function (hi) { if (!AU.ctx) return; const t = AU.ctx.currentTime; tone(hi ? 880 : 440, t, hi ? 0.6 : 0.25, 'square', 0.18); };
  AU.backfire = function () { if (!AU.ctx) return; const t = AU.ctx.currentTime; noise(t, 0.09, 0.5, 600, 'lowpass'); tone(90, t, 0.08, 'square', 0.15, sfx, 40); };
  AU.crash = function (v) { if (!AU.ctx) return; const t = AU.ctx.currentTime; const vol = Math.min(0.7, 0.15 + v / 200); noise(t, 0.25, vol, 900, 'lowpass'); tone(120, t, 0.15, 'square', vol * 0.4, sfx, 50); };
  AU.thud = function (v) { if (!AU.ctx) return; const t = AU.ctx.currentTime; tone(70, t, 0.2, 'triangle', Math.min(0.6, v / 150), sfx, 35); noise(t, 0.12, 0.2, 400, 'lowpass'); };
  AU.pickup = function (kind) {
    if (!AU.ctx) return; const t = AU.ctx.currentTime;
    const seq = { cash: [84, 91], llave: [72, 79, 84], goma: [67, 74], aceite: [70, 77], nitro: [60, 72, 84, 96], caja: [76, 80, 83, 88] }[kind] || [84];
    seq.forEach((m, i) => tone(mtof(m), t + i * 0.05, 0.12, 'pulse', 0.14));
    if (kind === 'nitro') noise(t, 0.6, 0.25, 1200, 'bandpass');
  };
  let rainN = null;
  AU.rain = function (on) {
    if (!AU.ctx) return;
    if (!rainN) rainN = loopNoise('highpass', 3500, 0.5);
    rainN.g.gain.setTargetAtTime(on ? 0.05 : 0, AU.ctx.currentTime, 0.3);
  };
  AU.thunder = function () { if (!AU.ctx) return; const t = AU.ctx.currentTime + 0.25; noise(t, 2.2, 0.7, 260, 'lowpass'); noise(t + 0.3, 1.5, 0.4, 140, 'lowpass'); };
  AU.whistle = function () { if (!AU.ctx) return; const t = AU.ctx.currentTime; [0, 0.18].forEach(d => tone(2700, t + d, 0.12, 'square', 0.06)); };
  AU.honk = function () { if (!AU.ctx) return; const t = AU.ctx.currentTime; tone(420, t, 0.18, 'square', 0.1); tone(530, t, 0.18, 'square', 0.08); };
  AU.alarm = function () { if (!AU.ctx) return; const t = AU.ctx.currentTime; tone(988, t, 0.09, 'square', 0.08); tone(740, t + 0.11, 0.09, 'square', 0.08); };
  AU.boom = function () {
    if (!AU.ctx) return; const t = AU.ctx.currentTime;
    noise(t, 1.2, 0.8, 500, 'lowpass'); tone(110, t, 0.8, 'square', 0.4, sfx, 30); tone(60, t + 0.1, 1.0, 'triangle', 0.5, sfx, 25);
  };
  AU.buy = function () { if (!AU.ctx) return; const t = AU.ctx.currentTime; tone(1568, t, 0.07, 'square', 0.12); tone(2093, t + 0.07, 0.18, 'square', 0.12); };
  AU.error = function () { if (!AU.ctx) return; const t = AU.ctx.currentTime; tone(140, t, 0.18, 'square', 0.14); };
  AU.move = function () { if (!AU.ctx) return; const t = AU.ctx.currentTime; tone(660, t, 0.035, 'pulse', 0.08); };
  AU.blip = function () { if (!AU.ctx) return; const t = AU.ctx.currentTime; tone(1320, t, 0.06, 'pulse', 0.1); };
  AU.jingle = function (kind) {
    if (!AU.ctx) return; const t = AU.ctx.currentTime;
    const seqs = {
      lap: [[72, 0], [76, 0.08], [79, 0.16], [84, 0.24]],
      final: [[81, 0], [84, 0.12], [81, 0.24], [84, 0.36], [81, 0.48], [88, 0.6]],
      record: [[84, 0], [88, 0.07], [91, 0.14], [96, 0.21], [91, 0.28], [96, 0.35]],
      win: [[72, 0], [72, 0.15], [72, 0.3], [76, 0.45], [79, 0.75], [76, 0.95], [79, 1.1], [84, 1.3]],
      lose: [[72, 0], [71, 0.2], [70, 0.4], [69, 0.6]],
    };
    (seqs[kind] || []).forEach(([m, dt], i, a) => tone(mtof(m), t + dt, i === a.length - 1 ? 0.6 : 0.16, 'pulse', 0.16));
  };

  // ---------- música eurobeat 8 bits ----------
  const BPM = 150, STEP = 60 / BPM / 4;
  const ROOTS = [45, 41, 43, 40, 45, 41, 43, 40];
  const CH = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 3, 7], [0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]];
  const MEL = [
    [[0, 69, 2], [2, 72, 2], [4, 76, 4], [8, 74, 2], [10, 72, 2], [12, 71, 2], [14, 69, 2]],
    [[0, 69, 2], [2, 72, 2], [4, 77, 4], [8, 76, 2], [10, 72, 2], [12, 69, 4]],
    [[0, 71, 2], [2, 74, 2], [4, 79, 4], [8, 77, 2], [10, 74, 2], [12, 71, 2], [14, 74, 2]],
    [[0, 76, 6], [6, 79, 2], [8, 83, 4], [12, 81, 2], [14, 79, 2]],
    [[0, 81, 4], [4, 76, 2], [6, 81, 2], [8, 84, 4], [12, 83, 2], [14, 81, 2]],
    [[0, 81, 2], [2, 79, 2], [4, 77, 4], [8, 72, 2], [10, 77, 2], [12, 81, 4]],
    [[0, 79, 2], [2, 77, 2], [4, 74, 2], [6, 79, 2], [8, 83, 4], [12, 86, 4]],
    [[0, 83, 4], [4, 80, 4], [8, 76, 6]],
  ];
  let step = 0, nextT = 0, timer = null, mode = 'race';
  function schedule() {
    const c = AU.ctx;
    while (nextT < c.currentTime + 0.15) {
      const bar = Math.floor(step / 16) % 8, s = step % 16;
      const root = ROOTS[bar];
      // bajo en octavas
      if (s % 2 === 0) tone(mtof(root + (s % 4 === 2 ? 12 : 0)), nextT, STEP * 1.6, 'pulse', 0.22, music);
      // arpegio
      const ch = CH[bar], n = root + 24 + ch[s % 3] + (s % 6 >= 3 ? 12 : 0);
      tone(mtof(n), nextT, STEP * 0.9, 'square', 0.035, music);
      // batería
      if (s % 4 === 0) tone(150, nextT, 0.12, 'sine', 0.7, music, 40);
      if (mode === 'race' && (s === 4 || s === 12)) noise(nextT, 0.12, 0.35, 1800, 'highpass', music);
      if (s % 2 === 1) noise(nextT, 0.03, 0.12, 7000, 'highpass', music);
      if (s % 4 === 2) noise(nextT, 0.08, 0.1, 6000, 'highpass', music);
      // melodía
      if (mode === 'race') for (const [ms, m, l] of MEL[bar]) if (ms === s) {
        tone(mtof(m), nextT, STEP * l * 0.95, 'pulse', 0.13, music);
        tone(mtof(m) * 1.004, nextT + 0.02, STEP * l * 0.9, 'square', 0.03, music);
      }
      nextT += STEP; step++;
    }
  }
  AU.music = function (on, m) {
    if (!AU.ctx) return;
    if (m) mode = m;
    if (on && !timer) { step = 0; nextT = AU.ctx.currentTime + 0.05; timer = setInterval(schedule, 25); }
    if (!on && timer) { clearInterval(timer); timer = null; }
  };
  G.AU = AU;
})(window);
