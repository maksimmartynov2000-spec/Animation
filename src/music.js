// Музыка стола без файлов: тихая тема у каждого Дома на время его хода и короткие мотивы событий.
// Всё синтезируется Web Audio: лютня, арфа, флейта, колокольчики, рог, барабан — средневековые лады.
const Music = (() => {
  let ctx = null, out = null, bus = null, on = true, vol = 0.5;
  let cur = null;          // { h, gain, timer, step, t }
  const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // лады: ступени от тоники
  const MODE = { ion: [0, 2, 4, 5, 7, 9, 11], dor: [0, 2, 3, 5, 7, 9, 10], phr: [0, 1, 3, 5, 7, 8, 10], lyd: [0, 2, 4, 6, 7, 9, 11], mix: [0, 2, 4, 5, 7, 9, 10], aeo: [0, 2, 3, 5, 7, 8, 10] };
  // у каждого Дома свой лад, тоника, темп и инструмент — тема узнаётся с первых нот
  const HOUSE = {
    deer: { mode: 'ion', root: 62, bpm: 84, lead: 'lute', bass: 'drone' },
    owl: { mode: 'dor', root: 64, bpm: 70, lead: 'harp', bass: 'drone' },
    wolf: { mode: 'phr', root: 57, bpm: 96, lead: 'horn', bass: 'drum' },
    rose: { mode: 'aeo', root: 66, bpm: 68, lead: 'flute', bass: 'drone' },
    serpent: { mode: 'mix', root: 67, bpm: 88, lead: 'lute', bass: 'drum' },
    moon: { mode: 'lyd', root: 60, bpm: 58, lead: 'bell', bass: 'drone' },
    bear: { mode: 'dor', root: 50, bpm: 74, lead: 'horn', bass: 'drone' },
    lion: { mode: 'ion', root: 65, bpm: 92, lead: 'horn', bass: 'drum' },
    eagle: { mode: 'mix', root: 69, bpm: 100, lead: 'flute', bass: 'drone' },
    sun: { mode: 'ion', root: 64, bpm: 80, lead: 'bell', bass: 'drone' },
  };
  function ac() {
    if (!on) return null;
    if (!ctx) {
      const C = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!C) return null;
      try {
        ctx = new C();
        out = ctx.createGain(); out.gain.value = vol; out.connect(ctx.destination);
        // мягкое «эхо зала»: задержка с затуханием
        bus = ctx.createGain(); bus.connect(out);
        const dl = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain(), lp = ctx.createBiquadFilter();
        dl.delayTime.value = 0.23; fb.gain.value = 0.32; wet.gain.value = 0.28; lp.type = 'lowpass'; lp.frequency.value = 2400;
        bus.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(out);
      } catch (e) { ctx = null; return null; }
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* ignore */ } }
    return ctx;
  }
  let nb = null;
  const noise = () => { if (nb) return nb; nb = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return nb; };
  // инструменты: нота в момент t, высота m (MIDI), длительность d, громкость g, выход dst
  function voice(kind, t, m, d, g, dst) {
    const f = NOTE(m), env = ctx.createGain(); env.connect(dst);
    const osc = (type, fr, gg = 1) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(fr, t); og.gain.value = gg; o.connect(og); og.connect(env); o.start(t); o.stop(t + d + 2); return o; };
    if (kind === 'lute' || kind === 'harp') {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = kind === 'harp' ? 0.5 : 2;
      lp.frequency.setValueAtTime(kind === 'harp' ? 3200 : 2600, t); lp.frequency.exponentialRampToValueAtTime(500, t + (kind === 'harp' ? 1.4 : 0.6));
      lp.connect(env);
      const o = ctx.createOscillator(); o.type = kind === 'harp' ? 'triangle' : 'sawtooth'; o.frequency.setValueAtTime(f, t); o.connect(lp); o.start(t); o.stop(t + 2.2);
      env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(g, t + 0.005); env.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'harp' ? 1.8 : 0.9));
    } else if (kind === 'bell') {
      osc('sine', f); osc('sine', f * 2.76, 0.28); osc('sine', f * 5.4, 0.08);
      env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(g, t + 0.004); env.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
    } else if (kind === 'flute') {
      const o = osc('sine', f); osc('triangle', f * 2, 0.08);
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.2; lg.gain.value = f * 0.006; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + d + 1);
      env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(g, t + 0.09); env.gain.setValueAtTime(g, t + d * 0.7); env.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.3);
    } else if (kind === 'horn') {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(1300, t + 0.12); lp.connect(env);
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.connect(lp); o.start(t); o.stop(t + d + 1);
      env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(g * 0.8, t + 0.06); env.gain.setValueAtTime(g * 0.7, t + d * 0.8); env.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.35);
    } else if (kind === 'drone') {
      osc('triangle', f); osc('sine', f * 1.5, 0.5);
      env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(g, t + d * 0.3); env.gain.linearRampToValueAtTime(0.0001, t + d);
    } else if (kind === 'drum') {
      const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(); s.buffer = noise(); bp.type = 'lowpass'; bp.frequency.value = 260; s.connect(bp); bp.connect(env); s.start(t); s.stop(t + 0.4);
      osc('sine', 70, 0.9);
      env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(g, t + 0.004); env.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    }
  }
  // детерминированный случай: у одной карты — всегда один и тот же мотив
  const rngOf = (str) => { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; }; };
  const deg = (H, k) => { const sc = MODE[H.mode], o = Math.floor(k / 7), i = ((k % 7) + 7) % 7; return H.root + sc[i] + 12 * o; };

  // ---------- тема Дома: бурдон и неспешная мелодия, пока Дом ходит ----------
  function house(h) {
    if (!ac()) return;
    if (cur && cur.h === h) return;
    stopTheme(1.2);
    const H = HOUSE[h] || HOUSE.deer, g = ctx.createGain(); g.gain.value = 0; g.connect(bus);
    g.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1.5);
    const rnd = rngOf('theme' + h);
    // четыре такта мелодии — от темы к теме они повторяются, но каждый раз с лёгкой вариацией
    const prog = [0, 5, 3, 4].map(x => (x + Math.floor(rnd() * 2)) % 7);
    const motif = Array.from({ length: 8 }, () => Math.floor(rnd() * 5) - 1);
    const beat = 60 / H.bpm;
    const th = { h, g, step: 0, t: ctx.currentTime + 0.3 };
    th.timer = setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      while (th.t < ctx.currentTime + 0.6) {
        const bar = Math.floor(th.step / 8) % 4, st = th.step % 8, ch = prog[bar];
        if (st === 0 && H.bass === 'drone') voice('drone', th.t, deg(H, ch) - 24, beat * 8, 0.05, g);
        if (H.bass === 'drum' && (st === 0 || st === 5)) voice('drum', th.t, 40, 0.3, st ? 0.05 : 0.08, g);
        // мелодия: не на каждую долю, чтобы оставался воздух
        const play = st === 0 || st === 3 || (st === 6 && rnd() < 0.7) || (st === 4 && rnd() < 0.3);
        if (play) voice(H.lead, th.t, deg(H, ch + motif[st] + (rnd() < 0.15 ? 2 : 0)), beat * 1.6, H.lead === 'horn' ? 0.05 : 0.07, g);
        if ((st === 2 || st === 6) && H.lead !== 'harp') voice('harp', th.t, deg(H, ch + 4) - 12, beat, 0.035, g);
        th.step++; th.t += beat / 2;
      }
    }, 120);
    cur = th;
  }
  function stopTheme(fade = 0.8) {
    if (!cur) return;
    const th = cur; cur = null;
    clearInterval(th.timer);
    if (ctx) { try { th.g.gain.cancelScheduledValues(ctx.currentTime); th.g.gain.setValueAtTime(th.g.gain.value, ctx.currentTime); th.g.gain.linearRampToValueAtTime(0, ctx.currentTime + fade); } catch (e) { /* ignore */ } }
    setTimeout(() => { try { th.g.disconnect(); } catch (e) { /* ignore */ } }, fade * 1000 + 2000);
  }
  // приглушить тему на время мотива события
  function duck(sec) { if (!cur || !ctx) return; const g = cur.g.gain, t = ctx.currentTime; try { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.15, t + 0.15); g.linearRampToValueAtTime(0.5, t + sec + 0.8); } catch (e) { /* ignore */ } }
  // мотив: ноты [ступень, доля, длительность], инструмент, лад
  function phrase(H, notes, inst, g = 0.16, beat = 0.18, extra) {
    if (!ac()) return; const t0 = ctx.currentTime + 0.05;
    let len = 0;
    for (const [k, at, d, kind] of notes) { voice(kind || inst, t0 + at * beat, deg(H, k), d * beat, g, bus); len = Math.max(len, (at + d) * beat); }
    if (extra) extra(t0);
    duck(len);
  }
  const F = (root, mode) => ({ root, mode });
  return {
    set(v) { on = !!v; if (!on) { stopTheme(0.3); if (ctx && ctx.state === 'running') { try { ctx.suspend(); } catch (e) { /* ignore */ } } } },
    get on() { return on; },
    unlock() { ac(); },
    // громкость музыки: 0…1
    vol(v) { vol = Math.max(0, Math.min(1, +v || 0)); if (out) out.gain.value = vol; },
    house, stop: () => stopTheme(1),
    // вассал, лорд, великий лорд — у каждого свой мотив; вассал звучит в ладу своего Дома
    jingle(_, kind, id, h) {
      const r = rngOf(kind + id);
      const H = kind === 'vassal' && h && HOUSE[h] ? HOUSE[h] : kind === 'lord' ? F(62 + Math.floor(r() * 5), 'ion') : F(55 + Math.floor(r() * 5), 'mix');
      const n = kind === 'vassal' ? 4 : 5, notes = [];
      let k = 0, at = 0;
      for (let i = 0; i < n; i++) { k += [0, 1, 2, 2, 3, 4, -1][Math.floor(r() * 7)]; const d = i === n - 1 ? 3 : [1, 1, 2][Math.floor(r() * 3)]; notes.push([k, at, d]); at += d; }
      notes.push([0, at, 4]); // в конце — тоника
      if (kind === 'vassal') phrase(H, notes, (HOUSE[h] || HOUSE.deer).lead === 'horn' ? 'horn' : 'lute', 0.17, 0.17);
      else if (kind === 'lord') phrase(H, notes, 'horn', 0.15, 0.2, (t) => voice('bell', t, H.root + 12, 1, 0.08, bus));
      else phrase(H, notes, 'horn', 0.16, 0.24, (t) => { voice('drum', t, 40, 0.3, 0.12, bus); voice('drum', t + 0.24 * 2, 40, 0.3, 0.1, bus); voice('bell', t, H.root + 24, 1, 0.08, bus); voice('drone', t, H.root - 12, 2.4, 0.08, bus); });
    },
    // сезоны: весна — флейта вверх, лето — колокольчики, осень — лютня вниз, зима — медленные колокола
    season(i) {
      const S4 = [
        [F(72, 'ion'), [[0, 0, 1], [2, 1, 1], [4, 2, 1], [5, 3, 1], [7, 4, 3]], 'flute'],
        [F(76, 'lyd'), [[4, 0, 1], [3, 1, 1], [4, 2, 1], [6, 3, 1], [7, 4, 3]], 'bell'],
        [F(64, 'aeo'), [[7, 0, 1], [5, 1, 1], [4, 2, 1], [2, 3, 1], [0, 4, 3]], 'lute'],
        [F(60, 'dor'), [[4, 0, 2], [2, 2, 2], [0, 4, 4]], 'bell'],
      ][i % 4];
      phrase(S4[0], S4[1], S4[2], 0.15, 0.22);
    },
    title() { phrase(F(72, 'ion'), [[0, 0, 1], [2, 1, 1], [4, 2, 1], [7, 3, 4]], 'bell', 0.13, 0.15); },
    spy(ok) { phrase(F(57, 'phr'), ok ? [[4, 0, 1], [3, 1, 1], [1, 2, 1], [0, 3, 1], [4, 4, 3]] : [[4, 0, 1], [3, 1, 1], [1, 2, 1], [0, 3, 1], [-3, 4, 3]], 'harp', 0.16, 0.16); },
    siege(win) {
      phrase(F(55, 'phr'), win ? [[0, 2, 1], [4, 3, 1], [7, 4, 3]] : [[4, 2, 1], [1, 3, 1], [0, 4, 3]], 'horn', 0.15, 0.2, (t) => { for (let k = 0; k < 4; k++) voice('drum', t + k * 0.12, 40, 0.3, 0.11, bus); });
    },
    victory() { phrase(F(67, 'ion'), [[0, 0, 1], [0, 1, 1], [4, 2, 2], [2, 4, 1], [4, 5, 1], [7, 6, 5]], 'horn', 0.18, 0.2, (t) => { voice('bell', t + 1.2, 79, 2, 0.1, bus); voice('drum', t, 40, 0.3, 0.12, bus); }); },
  };
})();
if (typeof module !== 'undefined') module.exports = Music;
