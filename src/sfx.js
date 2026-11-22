// Звуки стола без файлов: кубик, монеты, карты — синтез через Web Audio.
// Sfx.unlock() — на первом касании (iOS не даёт играть звук без жеста), Sfx.set(false) — выключить.
const Sfx = (() => {
  let ctx = null, on = true, master = null, level = 0.6;
  function ac() {
    if (!on) return null;
    if (!ctx) {
      const C = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!C) return null;
      try { ctx = new C(); master = ctx.createGain(); master.gain.value = 0.92 * level; master.connect(ctx.destination); } catch (e) { ctx = null; return null; }
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* ignore */ } }
    return ctx;
  }
  let nbuf = null;
  function noiseBuf(c) {
    if (nbuf) return nbuf;
    nbuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
    const d = nbuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return nbuf;
  }
  // короткий щелчок шума через полосовой фильтр — удар кубика о стол, шорох карты
  function burst(t, dur, freq, q, gain) {
    const c = ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf(c); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
  }
  // глухой стук: синус с падающей высотой — дерево стола под сукном
  function thump(t, freq, dur, gain) {
    const c = ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function tone(t, freq, dur, gain, type = 'sine') {
    const c = ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  return {
    set(v) { on = !!v; if (!on && ctx && ctx.state === 'running') { try { ctx.suspend(); } catch (e) { /* ignore */ } } },
    get on() { return on; },
    unlock() { ac(); },
    // громкость звуков стола: 0…1
    vol(v) { level = Math.max(0, Math.min(1, +v || 0)); if (master) master.gain.value = 0.92 * level; },
    // кнопка: тихий деревянный щелчок
    tap() { if (!ac()) return; const t = ctx.currentTime + 0.005; burst(t, 0.022, 2100, 2, 0.07); thump(t, 250, 0.04, 0.05); },
    // карта поднята из руки: лёгкий шорох
    lift() { if (!ac()) return; const t = ctx.currentTime + 0.005; burst(t, 0.07, 3900, 0.6, 0.075); },
    // лист «Рынок» / «Знамёна» выехал или убрался
    slide() { if (!ac()) return; const t = ctx.currentTime + 0.005; burst(t, 0.12, 1250, 0.5, 0.055); },
    // нельзя: два глухих стука
    deny() { if (!ac()) return; const t = ctx.currentTime + 0.005; thump(t, 150, 0.07, 0.16); thump(t + 0.1, 122, 0.09, 0.13); },
    // кубик катится по сукну: несколько ударов, всё тише и чаще
    dice(n = 1) {
      if (!ac()) return; const t0 = ctx.currentTime + 0.01;
      const hits = [0, 0.16, 0.29, 0.39, 0.47, 0.53, 0.58];
      for (let k = 0; k < n; k++) hits.forEach((h, i) => burst(t0 + h + k * 0.035 + Math.random() * 0.02, 0.05, 1500 + Math.random() * 900, 2.2, 0.5 * Math.pow(0.72, i)));
    },
    // кубики в руке и в полёте: лёгкое постукивание друг о друга (at — через сколько секунд)
    shake(n = 1, at = 0) {
      if (!ac()) return; const t0 = ctx.currentTime + 0.01 + at;
      const k = n > 1 ? 4 : 2;
      for (let i = 0; i < k; i++) burst(t0 + i * 0.045 + Math.random() * 0.015, 0.025, 3200 + Math.random() * 1200, 3, 0.1 + Math.random() * 0.05);
    },
    // удар кубика о стол: щелчок кости, отзвук и глухой стук дерева; s — сила удара (0…1)
    hit(s = 1, at = 0) {
      if (!ac()) return; const t = ctx.currentTime + 0.005 + at;
      const j = 0.85 + Math.random() * 0.3;
      burst(t, 0.035, 2300 * j, 3, 0.6 * s);
      burst(t + 0.003, 0.07, 760 * j, 1.4, 0.32 * s);
      thump(t, 175 * j, 0.09, 0.26 * s);
    },
    // кубик лёг в итог броска: короткий мягкий щелчок
    tick(at = 0) { if (!ac()) return; const t = ctx.currentTime + 0.01 + at; burst(t, 0.03, 1800, 2, 0.12); thump(t, 320, 0.05, 0.06); },
    // монета: два металлических призвука
    coin(k = 0) {
      if (!ac()) return; const t = ctx.currentTime + 0.01 + k * 0.06;
      const f = 2400 + Math.random() * 300;
      tone(t, f, 0.16, 0.12, 'triangle'); tone(t, f * 1.5, 0.12, 0.06, 'sine'); burst(t, 0.03, 6000, 1, 0.08);
    },
    // карта легла на стол
    card() { if (!ac()) return; const t = ctx.currentTime + 0.01; burst(t, 0.12, 2600, 0.7, 0.18); burst(t + 0.05, 0.08, 900, 1, 0.12); },
    // купленная карта долетела и легла: мягкий шлепок по сукну
    place() { if (!ac()) return; const t = ctx.currentTime + 0.01; burst(t, 0.07, 1700, 0.9, 0.2); thump(t, 150, 0.1, 0.16); },
    // колода тасуется: частый шорох карт
    shuffle() { if (!ac()) return; const t = ctx.currentTime + 0.01; for (let i = 0; i < 9; i++) burst(t + i * 0.042 + Math.random() * 0.012, 0.035, 3000 + Math.random() * 1500, 1.2, 0.07 + Math.random() * 0.04); },
    // новый ход: мягкий колокольчик
    chime() { if (!ac()) return; const t = ctx.currentTime + 0.01; tone(t, 660, 0.5, 0.07); tone(t + 0.09, 990, 0.6, 0.05); },
    // осада, захват: глухой удар
    thud() { if (!ac()) return; const t = ctx.currentTime + 0.01; tone(t, 110, 0.35, 0.25); burst(t, 0.15, 300, 1, 0.2); },
  };
})();
if (typeof module !== 'undefined') module.exports = Sfx;
