// v10: полная игра — стол в середине партии. node full.js [dev] [opps] [turns]
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
const DEV = { minils: [1133, 660, 0, 0, 0, 0], minis: [744, 1010, 0, 0, 0, 0], i15: [393, 852, 59, 34, 0, 0], i12: [428, 926, 47, 34, 0, 0], i15s: [393, 659, 0, 0, 0, 0], i15l: [852, 393, 0, 21, 59, 59], mini: [744, 1133, 24, 20, 0, 0], minil: [1133, 744, 24, 20, 0, 0], ipad: [834, 1194, 24, 20, 0, 0], ipadl: [1194, 834, 24, 20, 0, 0], mac: [1512, 900, 0, 0, 0, 0], macs: [1280, 720, 0, 0, 0, 0] };
const dev = process.argv[2] || 'i15', OPPS = +(process.argv[3] || 1), TURNS = +(process.argv[4] || 24);
const mods = (process.env.MODS || 'lords,great,faith,plots,seats,unions,balance,sieges,spy').split(',').filter(Boolean), house = process.env.HOUSE || 'wolf';
(async () => {
  const [w, h, st, sb, sl, sr] = DEV[dev];
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: !/mac/.test(dev), isMobile: !/mac/.test(dev), reducedMotion: 'reduce' }); const p = await ctx.newPage(); p.setDefaultTimeout(2500);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.addInitScript(([h, mods, opps]) => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: h, opps, speed: 'turbo', mods, tut: 0, coins: true })); } catch (e) {} }, [house, mods, OPPS]);
  await p.goto('file://' + SP + 'test-embed.html');
  await p.addStyleTag({ content: `:root{--sat:${st}px!important;--sab:${sb}px!important;--sal:${sl}px!important;--sar:${sr}px!important}` });
  await p.waitForSelector('#splash', { state: 'detached', timeout: 5000 }).catch(() => {});
  await p.click('[data-act="setup"]'); await p.waitForTimeout(300);
  await p.click('[data-act="start"]'); await p.waitForTimeout(400);
  const shot = async (k) => { await p.waitForTimeout(350); await p.screenshot({ path: SP + `v10/${dev}-f${OPPS}-${k}.png` }); console.log('кадр', k); };
  // играем просто: всё сыграть, бросить, купить самое дорогое доступное, завершить
  const step = () => p.evaluate(() => {
    const vis = (el) => el && el.offsetParent !== null && !el.disabled, q = (s) => [...document.querySelectorAll(s)].filter(vis);
    const V = window.__VD, S = V.S; if (!S || S.winner !== null) return 'over';
    const sh = [...document.querySelectorAll('.scrim:not(.out)')].pop();
    if (sh) { const o = [...sh.querySelectorAll('[data-v]')].filter(vis); if (o.length) { o[0].click(); return 'sheet'; } const bt = [...sh.querySelectorAll('button.primary')].filter(vis)[0] || [...sh.querySelectorAll('[data-close]')].filter(vis)[0] || [...sh.querySelectorAll('button')].filter(vis)[0]; if (bt) bt.click(); return 'sheet'; }
    for (const a of ['coin-all', 'step-ok', 'adj-ok', 'next']) { const el = q(`[data-act="${a}"]`)[0]; if (el) { el.click(); return a; } }
    if (!V.isMyTurn() || V.busy) return 'wait';
    const me = S.players[V.ME];
    if (!me.turn.rolled) { const a = q('.abar [data-act="play-all"]')[0]; if (a && Math.random() < 0.9) { a.click(); return 'all'; } const r = q('.abar [data-act="roll"]'); if (r.length) { r[r.length - 1].click(); return 'roll'; } return 'wait'; }
    if (V.drawer) { const b = q('.drawer .buyb.ok'); if (b.length) { b[b.length - 1].click(); return 'buy'; } q('.drawer [data-act="drawer-close"]')[0].click(); window.__tried = (window.__tried || 0) + 1; return 'close'; }
    { const sb = q('.shopcol .buyb.ok'); if (sb.length && !window.__tried) { window.__tried = 1; sb[Math.floor(Math.random() * sb.length)].click(); return 'buy'; } }
    if ((window.__tried || 0) < 2) { const d = q('.abar [data-act="drawer"]'); const k = (window.__tried || 0) === 0 ? 1 : 0; if (d[k]) { d[k].click(); return 'open'; } }
    window.__tried = 0; const e = q('.abar [data-act="end"]')[0]; if (e) { e.click(); return 'end'; } return 'wait';
  });
  let ends = 0;
  for (let it = 0; it < 6000; it++) { const rd = await p.evaluate(() => window.__VD.S ? window.__VD.S.round : 99); if (rd >= TURNS) break; const r = await step(); if (r === 'over') break; await p.waitForTimeout(r === 'wait' ? 60 : 35); }
  // дождаться своего хода до броска
  for (let it = 0; it < 600; it++) { const r = await p.evaluate(() => { const V = window.__VD; return V.S.winner !== null ? 'over' : V.isMyTurn() && !V.S.players[V.ME].turn.rolled && !V.coins ? 'ok' : ''; }); if (r) break; await step(); await p.waitForTimeout(50); }
  console.log(JSON.stringify(await p.evaluate(() => { const V = window.__VD, S = V.S, me = S.players[V.ME]; return { round: S.round, est: S.players.map(q => q.estates.length), bans: S.players.map(q => q.vassals.length + q.lords.length + q.greats.length), hand: me.hand, seats: me.seats, plots: me.plots.length, faiths: me.faiths, winner: S.winner }; })));
  await shot('1-board');
  await p.click('.handz .hcard[data-act="sel"]').catch(() => {}); await shot('2-sel'); await p.click('[data-act="desel"]').catch(() => {});
  await p.click('.abar [data-act="drawer"][data-d="market"]', { timeout: 1200 }).catch(() => {}); await shot('3-market');
  await p.click('.abar [data-act="drawer"][data-d="regalia"]', { timeout: 1200 }).catch(() => {}); await shot('4-regalia');
  await p.evaluate(() => { const d = document.querySelector('.drawer .dbody'); if (d) d.scrollTop = 9999; }); await shot('5-regalia2');
  await p.click('[data-act="drawer-close"]', { timeout: 1200 }).catch(() => {});
  await p.click('.pbar.own [data-act="my"]').catch(() => {}); await shot('6-my');
  await p.evaluate(() => { const s = document.querySelector('.scrim .sheet'); if (s) s.scrollTop = 520; }); await shot('7-my2');
  await p.evaluate(() => { const s = document.querySelector('.scrim'); if (s && s.close) s.close(); }); await p.waitForTimeout(300);
  await p.click('.pbar.foe [data-act="opp"], .pbar.foe .ochip.on').catch(() => {}); await shot('8-opp');
  console.log('ошибки', errs.slice(0, 6));
  await b.close();
})();
