// v10: снимок нового экрана партии. node shot.js [dev] [state]  dev: i15 | i12 | i15s (Safari) | i15l | mini | ipad | mac
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
const DEV = { i15: [393, 852, 59, 34, 0, 0], i12: [428, 926, 47, 34, 0, 0], i15s: [393, 659, 0, 0, 0, 0], i15l: [852, 393, 0, 21, 59, 59], i12l: [926, 428, 0, 21, 47, 47], mini: [744, 1133, 24, 20, 0, 0], minil: [1133, 744, 24, 20, 0, 0], ipad: [834, 1194, 24, 20, 0, 0], ipadl: [1194, 834, 24, 20, 0, 0], mac: [1512, 900, 0, 0, 0, 0] };
const dev = process.argv[2] || 'i15', mods = (process.env.MODS || 'lords').split(',').filter(Boolean), house = process.env.HOUSE || 'owl';
(async () => {
  const [w, h, st, sb, sl, sr] = DEV[dev];
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: !/mac/.test(dev), isMobile: !/mac/.test(dev) }); const p = await ctx.newPage(); p.setDefaultTimeout(4000);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.addInitScript(([h, mods]) => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: h, opps: 1, speed: 'fast', mods, tut: 0, coins: true })); } catch (e) {} }, [house, mods]);
  await p.goto('file://' + SP + 'test-embed.html');
  await p.addStyleTag({ content: `:root{--sat:${st}px!important;--sab:${sb}px!important;--sal:${sl}px!important;--sar:${sr}px!important}` });
  await p.waitForSelector('#splash', { state: 'detached', timeout: 5000 }).catch(() => {});
  await p.click('[data-act="setup"]'); await p.waitForTimeout(300);
  await p.click('[data-act="start"]'); await p.waitForTimeout(900);
  const shot = async (k) => { await p.screenshot({ path: SP + `v10/${dev}-${k}.png` }); console.log('кадр', k); };
  const info = () => p.evaluate(() => { const V = window.__VD; const b = document.querySelector('.board'); const z = {}; for (const el of b.children) z[el.className.split(' ').slice(0, 2).join('.')] = Math.round(el.getBoundingClientRect().height); return { L: V.layout, z, my: V.isMyTurn(), doc: [document.documentElement.scrollWidth, document.documentElement.scrollHeight, innerWidth, innerHeight] }; });
  // дождаться своего хода (первым может ходить соперник): забирать монеты, брать карты
  const myTurn = async () => { for (let k = 0; k < 200; k++) { const st = await p.evaluate(() => ({ my: __VD.isMyTurn(), rolled: __VD.isMyTurn() && __VD.S.players[__VD.ME].turn.rolled, coins: __VD.coins, step: __VD.step, next: __VD.waitNext, adj: !!__VD.adjust })); if (st.coins) { await p.click('[data-act="coin-all"]').catch(() => {}); } else if (st.step) await p.click('[data-act="step-ok"]').catch(() => {}); else if (st.next) await p.click('[data-act="next"]').catch(() => {}); else if (st.adj) await p.click('[data-act="adj-ok"]').catch(() => {}); else if (st.my && !st.rolled) return true; else if (st.my && st.rolled) { await p.click('[data-act="end"]').catch(() => {}); await p.waitForTimeout(120); await p.click('[data-act="end"]').catch(() => {}); } await p.waitForTimeout(150); } return false; };
  console.log('мой ход', await myTurn());
  console.log(JSON.stringify(await info()));
  await shot('1-start');
  if (process.argv[3] === 'rich') {
    await p.evaluate(() => {
      const V = window.__VD, S = V.S, me = S.players[V.ME], o = S.players.find(q => q.i !== V.ME);
      let u = 9000; const add = (q, id) => q.estates.push({ uid: u++, id });
      for (const id of ['field', 'field', 'pasture', 'runestone', 'shrine', 'mine', 'orchard', 'barracks', 'smithy', 'bakery', 'wall']) add(me, id);
      for (const id of ['field', 'pasture', 'meadery', 'runestone', 'mine', 'caravan', 'den', 'privateer']) add(o, id);
      me.gold = 17; o.gold = 12; me.vassals.push('fuller', 'cornelia'); o.vassals.push('rosalinda');
    });
    await p.evaluate(() => window.dispatchEvent(new Event('resize'))); await p.waitForTimeout(400);
    await shot('2-rich');
    // выбрать карту
    await p.click('.handz .hcard >> nth=1').catch(e => console.log('нет карты', e.message.slice(0, 80))); await p.waitForTimeout(350);
    await shot('3-sel');
    await p.click('[data-act="desel"]').catch(() => {}); await p.waitForTimeout(250);
    await p.click('[data-act="roll"][data-n="2"]').catch(() => {}); await p.waitForTimeout(450);
    await shot('4-air');
    await p.waitForTimeout(1100); await shot('5-land');
    await p.waitForTimeout(1500); await shot('6-coins');
    console.log(JSON.stringify(await p.evaluate(() => ({ coins: window.__VD.coins, adj: !!window.__VD.adjust }))));
    await p.click('[data-act="adj-ok"]').catch(() => {}); await p.waitForTimeout(300);
    await p.click('[data-act="coin-all"]').catch(() => {}); await p.waitForTimeout(900);
    await shot('7-after');
    await p.click('.abar [data-act="drawer"][data-d="market"]'); await p.waitForTimeout(500); await shot('8-market');
    await p.click('.abar [data-act="drawer"][data-d="regalia"]'); await p.waitForTimeout(500); await shot('9-regalia');
    await p.click('[data-act="drawer-close"]'); await p.waitForTimeout(400);
    await p.click('[data-act="my"]'); await p.waitForTimeout(500); await shot('10-my');
  }
  console.log('ошибки', errs.slice(0, 8));
  await b.close();
})();
