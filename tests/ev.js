// v10.3: события на столе — схватка (осада, шпион) и сцена победы. node ev.js [dev]
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
const DEV = { i15: [393, 852, 59, 34], mini: [744, 1133, 24, 20], mac: [1512, 900, 0, 0] };
const dev = process.argv[2] || 'i15';
(async () => {
  const [w, h, st, sb] = DEV[dev];
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: dev !== 'mac', isMobile: dev !== 'mac' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.addInitScript(() => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: 'wolf', opps: 1, speed: 'normal', mods: ['lords', 'faith', 'plots', 'seats', 'sieges', 'spy'], tut: 0, coins: false, sound: false, music: false })); } catch (e) {} });
  await p.goto('file://' + SP + 'test-embed.html');
  await p.addStyleTag({ content: `:root{--sat:${st}px!important;--sab:${sb}px!important}` });
  await p.waitForSelector('#splash', { state: 'detached', timeout: 5000 }).catch(() => {});
  await p.click('[data-act="setup"]'); await p.waitForTimeout(400);
  await p.click('[data-act="start"]'); await p.waitForTimeout(600);
  const res = []; const ok = (n, v, x) => res.push((v ? 'OK  ' : 'FAIL ') + n + (x ? ' — ' + x : ''));
  for (let i = 0; i < 200; i++) { if (await p.evaluate(() => window.__VD.isMyTurn() && !window.__VD.busy && !document.body.classList.contains('dealing'))) break; await p.waitForTimeout(100); }
  await p.waitForTimeout(900);
  // 1) у меня захватывают владение: сцена, потом плитка переезжает к сопернику
  const id1 = await p.evaluate(() => { const S = window.__VD.S, me = S.players[window.__VD.ME], op = S.players[1 - window.__VD.ME]; const e = me.estates.shift(); e.ruined = true; op.estates.push(e); window.__VD.ev('siege', { a: op.i, t: me.i, A: 9, D: 6, ar: 4, dr: 2, win: true, got: e.id }); window.__VD.redraw(); return e.id; });
  await p.waitForTimeout(650);
  const s1 = await p.evaluate((id) => ({ duel: (document.querySelector('.cpop.duel') || {}).innerText || '', mineStill: document.querySelectorAll(`.tiles.own .tile[data-id="${id}"]`).length, hidden: document.querySelectorAll('.tiles.foe .tile.hold').length }), id1);
  await p.screenshot({ path: SP + `v10/ev-${dev}-1.png` });
  ok('осада: числа посреди стола', /9/.test(s1.duel) && /6/.test(s1.duel) && /атака/i.test(s1.duel), s1.duel.replace(/\s+/g, ' '));
  ok('пока идёт сцена, владение ещё лежит у меня, у соперника место пустое', s1.mineStill === 1 && s1.hidden === 1, JSON.stringify(s1).slice(0, 120));
  let fly = 0; for (let i = 0; i < 40; i++) { fly = await p.evaluate(() => document.querySelectorAll('.flyc .tile').length); if (fly) break; await p.waitForTimeout(60); }
  await p.screenshot({ path: SP + `v10/ev-${dev}-1m.png` });
  await p.waitForTimeout(1100);
  const s1b = await p.evaluate((id) => ({ mine: document.querySelectorAll(`.tiles.own .tile[data-id="${id}"]`).length, foe: [...document.querySelectorAll(`.tiles.foe .tile[data-id="${id}"]`)].filter(e => getComputedStyle(e).visibility !== 'hidden').length, hold: document.querySelectorAll('.tile.hold').length }), id1);
  ok('после сцены плитка переехала к сопернику', fly === 1 && s1b.mine === 0 && s1b.foe === 1 && s1b.hold === 0, `в полёте ${fly}; ${JSON.stringify(s1b)}`);
  // 2) мой шпион пойман
  await p.evaluate(() => { const V = window.__VD; V.ev('spy', { a: V.ME, t: 1 - V.ME, ok: false, A: 5, G: 8, ar: 2, gr: 4 }); V.redraw(); });
  await p.waitForTimeout(700); await p.screenshot({ path: SP + `v10/ev-${dev}-2.png` });
  const s2 = await p.evaluate(() => (document.querySelector('.cpop.duel') || {}).innerText || '');
  ok('шпион: сцена «шпион против стражи»', /5/.test(s2) && /8/.test(s2) && /поймали/i.test(s2), s2.replace(/\s+/g, ' '));
  await p.waitForTimeout(1500);
  // 3) обстрел: владение соперника разрушено
  const id3 = await p.evaluate(() => { const S = window.__VD.S, op = S.players[1 - window.__VD.ME]; const e = op.estates.shift(); window.__VD.ev('siege', { a: window.__VD.ME, t: op.i, A: 10, D: 7, win: true, raze: true, gone: e.id }); window.__VD.redraw(); return e.id; });
  await p.waitForTimeout(700); await p.screenshot({ path: SP + `v10/ev-${dev}-3.png` });
  const s3 = await p.evaluate(() => (document.querySelector('.cpop.duel') || {}).innerText || '');
  ok('обстрел: сцена и «разрушено»', /10/.test(s3) && /разрушено/i.test(s3), s3.replace(/\s+/g, ' '));
  let cr = 0; for (let i = 0; i < 40; i++) { cr = await p.evaluate(() => document.querySelectorAll('.flyl .flyc .tile').length); if (cr) break; await p.waitForTimeout(60); }
  await p.screenshot({ path: SP + `v10/ev-${dev}-3m.png` });
  ok('разрушенная плитка рассыпается на месте', cr === 1, String(cr));
  await p.waitForTimeout(1200);
  ok('после сцен на столе нет «зависших» скрытых плиток', (await p.evaluate(() => document.querySelectorAll('.tile.hold, .flyc').length)) === 0);
  // закончить партию: сцена победы
  await p.evaluate(() => { window.__VD.S.round = 999; });
  for (let i = 0; i < 40; i++) { const r = await p.evaluate(() => { const vis = (e) => e && e.offsetParent !== null && !e.disabled; const V = window.__VD; if (V.S.winner !== null) return 'over'; for (const a of ['coin-all', 'step-ok', 'adj-ok']) { const e = document.querySelector(`[data-act="${a}"]`); if (vis(e)) { e.click(); return a; } } if (!V.isMyTurn()) return 'wait'; const r = [...document.querySelectorAll('.abar [data-act="roll"]')].filter(vis)[0]; if (r) { r.click(); return 'roll'; } const e = [...document.querySelectorAll('.abar [data-act="end"]')].filter(vis)[0]; if (e) { e.click(); return 'end'; } return 'wait'; }); if (r === 'over') break; await p.waitForTimeout(r === 'roll' ? 2600 : 300); }
  let vic = false; for (let i = 0; i < 200; i++) { if (await p.evaluate(() => !!document.querySelector('.victory'))) { vic = true; break; } await p.waitForTimeout(100); }
  await p.waitForTimeout(1300); await p.screenshot({ path: SP + `v10/ev-${dev}-vic.png` });
  ok('сцена победы показана', vic);
  await p.waitForTimeout(3200);
  ok('после неё — итоги', await p.evaluate(() => !document.querySelector('.victory') && !!document.querySelector('.page.results')));
  console.log(res.join('\n')); console.log('ошибки', errs.slice(0, 5));
  await b.close();
})();
