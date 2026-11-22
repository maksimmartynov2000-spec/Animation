// v10: ход соперника на столе и сбор монет. node opp.js [dev]
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
const DEV = { i15: [393, 852, 59, 34, 0, 0], i12: [428, 926, 47, 34, 0, 0], i15s: [393, 659, 0, 0, 0, 0], i15l: [852, 393, 0, 21, 59, 59] };
const dev = process.argv[2] || 'i15', mods = (process.env.MODS || 'lords').split(',').filter(Boolean), house = process.env.HOUSE || 'deer';
(async () => {
  const [w, h, st, sb, sl, sr] = DEV[dev];
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }); const p = await ctx.newPage(); p.setDefaultTimeout(3000);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.addInitScript(([h, mods]) => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: h, opps: 1, speed: 'normal', mods, tut: 0, coins: true })); } catch (e) {} }, [house, mods]);
  await p.goto('file://' + SP + 'test-embed.html');
  await p.addStyleTag({ content: `:root{--sat:${st}px!important;--sab:${sb}px!important;--sal:${sl}px!important;--sar:${sr}px!important}` });
  await p.waitForSelector('#splash', { state: 'detached', timeout: 5000 }).catch(() => {});
  await p.click('[data-act="setup"]'); await p.waitForTimeout(300);
  await p.click('[data-act="start"]'); await p.waitForTimeout(400);
  await p.evaluate(() => {
    const V = window.__VD, S = V.S, me = S.players[V.ME], o = S.players.find(q => q.i !== V.ME);
    let u = 9000; const add = (q, id) => q.estates.push({ uid: u++, id });
    for (const id of ['field', 'field', 'pasture', 'runestone', 'shrine', 'mine', 'orchard', 'barracks', 'smithy', 'bakery']) add(me, id);
    for (const id of ['field', 'field', 'pasture', 'meadery', 'runestone', 'shrine', 'mine', 'orchard', 'bakery', 'caravan', 'den', 'privateer']) add(o, id);
    me.gold = 17; o.gold = 12; o.vassals.push('cornelia');
  });
  const shots = {}; const shot = async (k) => { if (shots[k]) return; shots[k] = 1; await p.screenshot({ path: SP + `v10/${dev}-o-${k}.png` }); console.log('кадр', k); };
  const st8 = () => p.evaluate(() => { const V = window.__VD; return { my: V.isMyTurn(), rolled: V.isMyTurn() && V.S.players[V.ME].turn.rolled, coins: V.coins, step: V.step, adj: !!V.adjust, pop: !!document.querySelector('.cardpops .cpop'), air: !!document.querySelector('.dstage'), take: document.querySelectorAll('.tile.take,.tile.give,.barcoin').length, fire: document.querySelectorAll('.tiles.foe .tile.fire').length, fly: document.querySelectorAll('.flycoin').length, cur: V.S.cur, me: V.ME }; });
  let myTurns = 0;
  for (let it = 0; it < 420 && myTurns < 2; it++) {
    const s = await st8();
    if (s.pop) await shot('pop');
    if (s.air && s.cur !== s.me) await shot('oppdice');
    if (s.fire && s.fly) await shot('oppfire');
    if (s.take && s.cur !== s.me) await shot('mytake-oppturn');
    if (s.take && s.cur === s.me) await shot('mytake-myturn');
    if (s.coins) { await p.waitForTimeout(500); await shot('coins'); const el = await p.$('.tile.take, .tile.give, .barcoin'); if (el) { await el.click().catch(() => {}); await p.waitForTimeout(120); await shot('coin-fly'); } else await p.click('[data-act="coin-all"]').catch(() => {}); continue; }
    if (s.step) { await shot('step'); await p.click('[data-act="step-ok"]').catch(() => {}); continue; }
    if (s.adj) { await p.click('[data-act="adj-ok"]').catch(() => {}); continue; }
    if (s.my && !s.rolled && !s.air) { await p.click('[data-act="play-all"]').catch(() => {}); await p.waitForTimeout(700); await p.click('[data-act="roll"][data-n="2"]').catch(() => p.click('[data-act="roll"]').catch(() => {})); await p.waitForTimeout(1500); continue; }
    if (s.my && s.rolled && !s.air && !s.coins) { myTurns++; await shot('myend'); await p.click('[data-act="end"]').catch(() => {}); await p.waitForTimeout(150); await p.click('[data-act="end"]').catch(() => {}); continue; }
    await p.waitForTimeout(100);
  }
  console.log('кадры', Object.keys(shots).join(' ')); console.log('ошибки', errs.slice(0, 6));
  await b.close();
})();
