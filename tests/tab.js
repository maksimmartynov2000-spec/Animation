// v10.3: настольность — раздача, стопки, полёты. node tab.js [dev]
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
const DEV = { i15: [393, 852, 59, 34, 0, 0], mini: [744, 1133, 24, 20, 0, 0], minil: [1133, 744, 24, 20, 0, 0], mac: [1512, 900, 0, 0, 0, 0], i15l: [852, 393, 0, 21, 59, 59] };
const dev = process.argv[2] || 'i15';
(async () => {
  const [w, h, st, sb, sl, sr] = DEV[dev];
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: dev !== 'mac', isMobile: dev !== 'mac' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.addInitScript(() => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: 'wolf', opps: 1, speed: 'normal', mods: ['lords', 'faith', 'plots', 'seats'], tut: 0, coins: false, sound: false, music: false })); } catch (e) {} });
  await p.goto('file://' + SP + 'test-embed.html');
  await p.addStyleTag({ content: `:root{--sat:${st}px!important;--sab:${sb}px!important;--sal:${sl}px!important;--sar:${sr}px!important}` });
  await p.waitForSelector('#splash', { state: 'detached', timeout: 5000 }).catch(() => {});
  const res = []; const ok = (n, v, x) => res.push((v ? 'OK  ' : 'FAIL ') + n + (x ? ' — ' + x : ''));
  const shot = (k) => p.screenshot({ path: SP + `v10/tab-${dev}-${k}.png` });
  await p.click('[data-act="setup"]'); await p.waitForTimeout(400);
  await p.click('[data-act="start"]');
  await p.waitForTimeout(420); await shot('i1'); const d1 = await p.evaluate(() => document.body.classList.contains('dealing'));
  await p.waitForTimeout(800); await shot('i2');
  await p.waitForTimeout(700); await shot('i3');
  ok('раздача идёт в начале партии', d1);
  await p.waitForTimeout(1200);
  ok('раздача закончилась сама', await p.evaluate(() => !document.body.classList.contains('dealing')));
  const stt = () => p.evaluate(() => { const V = window.__VD, S = V.S, me = S.players[V.ME]; return { my: V.isMyTurn(), rolled: me.turn.rolled, hand: me.hand.length, deck: me.deck.length, disc: me.discard.length + me.inPlay.length, coins: V.coins, busy: V.busy, cur: S.cur, round: S.round }; });
  for (let i = 0; i < 300; i++) { const s = await stt(); if (s.my && !s.busy) break; await p.waitForTimeout(100); }
  const piles = await p.evaluate(() => { const d = document.querySelector('.handz .pile.deck'), c = document.querySelector('.handz .pile.disc'), f = document.querySelector('.pbar.foe .ofan'), t = document.querySelector('.board > .ttoken'); const r = (e) => e ? e.getBoundingClientRect() : null; const hc = [...document.querySelectorAll('.handz .hcard')].map(e => e.getBoundingClientRect()); return { deck: !!d && d.querySelector('b').textContent, disc: !!c && c.querySelector('b').textContent, fan: f ? f.querySelectorAll('i').length : -1, token: t && !t.hidden, dr: r(d), cr: r(c), minL: Math.min(...hc.map(x => x.left)), maxR: Math.max(...hc.map(x => x.right)), W: innerWidth }; });
  ok('стопки, веер соперника и жетон на месте', piles.deck !== false && piles.disc !== false && piles.fan >= 1 && piles.token, JSON.stringify({ deck: piles.deck, disc: piles.disc, fan: piles.fan, token: piles.token }));
  ok('стопки внутри экрана', piles.dr && piles.dr.left >= 0 && piles.cr.right <= piles.W + 0.5, `колода ${Math.round(piles.dr.left)}…${Math.round(piles.dr.right)}, сброс ${Math.round(piles.cr.left)}…${Math.round(piles.cr.right)}, рука ${Math.round(piles.minL)}…${Math.round(piles.maxR)}`);
  await shot('b1');
  // сыграть карту: летит на стол и в сброс
  const s0 = await stt();
  // берём карту без «возьмите карту»: иначе рука не уменьшится и проверка ложно упадёт (раздача случайная)
  const pk = await p.evaluate(() => { const hs = [...document.querySelectorAll('.handz .hcard[data-act="sel"]')]; const dr = (h) => ((DATA.COURT[h.dataset.id] || {}).fx || []).filter(o => o[0] === 'draw').reduce((t, o) => t + (o[1] || 1), 0); const quiet = (h) => !dr(h) && !((DATA.COURT[h.dataset.id] || {}).sig); /* v10.22: фамильные карты бывают с окном выбора (Меняла, Соты, Астролябия) или без броска (Спячка) — берём Подать/Сборщика */ const qi = hs.findIndex(h => quiet(h) && /^(tax|collector)$/.test(h.dataset.id)); const i = qi >= 0 ? qi : Math.max(0, hs.findIndex(quiet)); return { i, draw: hs[i] ? dr(hs[i]) : 0, id: hs[i] ? hs[i].dataset.id : '' }; });
  await p.click(`.handz .hcard[data-act="sel"] >> nth=${pk.i}`); await p.waitForTimeout(250);
  await p.evaluate(() => { window.__maxPlay = 0; window.__ivP = setInterval(() => { window.__maxPlay = Math.max(window.__maxPlay, document.querySelectorAll('.board > .hcard').length); }, 16); });
  await p.click('.abar [data-act="play"]');
  await p.waitForTimeout(260); await shot('p1'); const fl1 = await p.evaluate(() => window.__maxPlay);
  await p.waitForTimeout(330); await shot('p2');
  await p.waitForTimeout(900); const fl2 = await p.evaluate(() => { clearInterval(window.__ivP); return document.querySelectorAll('.board > .hcard').length; });
  const s1 = await stt();
  ok('карта летит из руки и долетает', fl1 === 1 && fl2 === 0 && s1.hand === s0.hand - 1 + pk.draw && s1.disc === s0.disc + 1, `«${pk.id}»: в полёте ${fl1}, после ${fl2}; рука ${s0.hand}→${s1.hand}; сброс ${s0.disc}→${s1.disc}`);
  // бросок, конец хода: остаток руки — в сброс, новые карты — из колоды
  await p.click('.abar [data-act="roll"]'); await p.waitForTimeout(2600);
  for (let i = 0; i < 12; i++) { const s = await stt(); if (!s.coins) break; await p.evaluate(() => { const b = document.querySelector('[data-act="coin-all"]'); if (b) b.click(); }); await p.waitForTimeout(250); }
  const s2 = await stt();
  await p.evaluate(() => { window.__maxFly = 0; setInterval(() => { window.__maxFly = Math.max(window.__maxFly, document.querySelectorAll('.board > .hcard').length); }, 16); });
  await p.evaluate(() => { const b = document.querySelector('.abar [data-act="end"]'); if (b) b.click(); }); await p.waitForTimeout(140);
  if ((await stt()).my) { await p.evaluate(() => { const b = document.querySelector('.abar [data-act="end"]'); if (b) b.click(); }); await p.waitForTimeout(140); }
  await shot('e1'); await p.waitForTimeout(200); const rest = await p.evaluate(() => window.__maxFly);
  await p.waitForTimeout(260); await shot('e2');
  await p.waitForTimeout(900); const s3 = await stt();
  ok('в конце хода остаток руки уходит в сброс, рука берётся заново', rest === s2.hand && s3.hand >= 1, `летело ${rest} из ${s2.hand}; рука ${s2.hand}→${s3.hand}, колода ${s2.deck}→${s3.deck}, сброс ${s2.disc}→${s3.disc}`);
  // ход соперника: его рука рубашками и жетон хода
  await p.waitForTimeout(600); await shot('o1');
  const tok = await p.evaluate(() => { const t = document.querySelector('.board > .ttoken'), f = document.querySelector('.pbar.foe'); const a = t.getBoundingClientRect(), z = f.getBoundingClientRect(); return { onFoe: a.top < z.bottom, cur: window.__VD.S.cur, me: window.__VD.ME }; });
  ok('жетон хода переехал к сопернику', tok.cur === tok.me || tok.onFoe, JSON.stringify(tok));
  console.log(res.join('\n')); console.log('ошибки', errs.slice(0, 5));
  await b.close();
})();
