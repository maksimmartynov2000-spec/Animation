// v10.2: полёт купленной карты. node fly.js [dev]
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
const DEV = { i15: [393, 852, 59, 34], mini: [744, 1133, 24, 20], mac: [1512, 900, 0, 0] };
const dev = process.argv[2] || 'i15';
(async () => {
  const [w, h, st, sb] = DEV[dev];
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: dev !== 'mac', isMobile: dev !== 'mac' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.addInitScript(() => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: 'wolf', opps: 1, speed: 'normal', mods: ['lords', 'faith', 'plots', 'seats'], tut: 0, coins: false, sound: false, music: false })); } catch (e) {} });
  await p.goto('file://' + SP + 'test-embed.html');
  await p.addStyleTag({ content: `:root{--sat:${st}px!important;--sab:${sb}px!important}` });
  await p.waitForSelector('#splash', { state: 'detached', timeout: 5000 }).catch(() => {});
  await p.click('[data-act="setup"]'); await p.waitForTimeout(400); await p.click('[data-act="start"]'); await p.waitForTimeout(900);
  const res = []; const ok = (n, v, x) => res.push((v ? 'OK  ' : 'FAIL ') + n + (x ? ' — ' + x : ''));
  const stt = () => p.evaluate(() => { const V = window.__VD, S = V.S, me = S.players[V.ME]; return { my: V.isMyTurn(), rolled: me.turn.rolled, coins: V.coins, gold: me.gold, est: me.estates.length, bans: me.vassals.length, busy: V.busy, round: S.round, w: S.winner }; });
  const vis = (sel) => p.evaluate((s) => [...document.querySelectorAll(s)].filter(e => e.offsetParent !== null && !e.disabled).length, sel);
  const clickIf = async (sel) => { if (await vis(sel)) { await p.evaluate((s) => { const e = [...document.querySelectorAll(s)].filter(e => e.offsetParent !== null && !e.disabled)[0]; if (e) e.click(); }, sel); return true; } return false; };
  let shots = 0, sawFly = 0, sawOppFly = 0;
  for (let it = 0; it < 900 && shots < 3; it++) {
    const s = await stt(); if (s.w !== null) break;
    if (await p.evaluate(() => !!document.querySelector('.flyc'))) sawOppFly++;
    const sh = await p.evaluate(() => { const x = [...document.querySelectorAll('.scrim:not(.out)')].pop(); if (!x) return false; const o = x.querySelector('[data-v]') || x.querySelector('button.primary') || x.querySelector('button'); if (o) o.click(); return true; });
    if (sh) { await p.waitForTimeout(200); continue; }
    if (await clickIf('[data-act="coin-all"]') || await clickIf('[data-act="step-ok"]') || await clickIf('[data-act="adj-ok"]') || await clickIf('[data-act="next"]')) { await p.waitForTimeout(250); continue; }
    if (!s.my || s.busy) { await p.waitForTimeout(120); continue; }
    if (!s.rolled) { if (!(await clickIf('.abar [data-act="play-all"]'))) await clickIf('.abar [data-act="roll"][data-n="2"]') || await clickIf('.abar [data-act="roll"]'); await p.waitForTimeout(500); if (!(await stt()).rolled) { await clickIf('.abar [data-act="roll"][data-n="2"]') || await clickIf('.abar [data-act="roll"]'); await p.waitForTimeout(900); } continue; }
    // после броска: открыть рынок (телефон) и купить
    const big = await p.evaluate(() => window.__VD.layout && window.__VD.layout.big);
    const want = shots === 1 ? 'regalia' : 'market';
    if (!big && !(await p.evaluate(() => window.__VD.drawer))) { await clickIf(`.abar [data-act="drawer"][data-d="${want}"]`); await p.waitForTimeout(450); }
    const sel = big ? (want === 'regalia' ? '.shop.rg .buyb.ok' : '.shop.mk .buyb.ok') : '.drawer .buyb.ok';
    const n = await vis(sel);
    if (n) {
      const before = await stt();
      await p.evaluate((s) => { const e = [...document.querySelectorAll(s)].filter(e => e.offsetParent !== null && !e.disabled); e[e.length - 1].click(); }, sel);
      await p.waitForTimeout(140);
      const f1 = await p.evaluate(() => document.querySelectorAll('.flyc').length);
      await p.screenshot({ path: SP + `v10/fly-${dev}-${shots}a.png` });
      await p.waitForTimeout(160);
      await p.screenshot({ path: SP + `v10/fly-${dev}-${shots}b.png` });
      await p.waitForTimeout(900);
      const f2 = await p.evaluate(() => document.querySelectorAll('.flyc').length);
      const after = await stt();
      ok(`покупка ${shots} (${want}): карта летит и исчезает`, f1 >= 1 && f2 === 0, `в полёте ${f1}, после ${f2}; владений ${before.est}→${after.est}, вассалов ${before.bans}→${after.bans}`);
      if (f1) sawFly++;
      await p.screenshot({ path: SP + `v10/fly-${dev}-${shots}c.png` });
      shots++;
    }
    await clickIf('[data-act="drawer-close"]'); await p.waitForTimeout(150);
    await clickIf('.abar [data-act="end"]'); await p.waitForTimeout(250); await clickIf('.abar [data-act="end"]'); await p.waitForTimeout(300);
  }
  ok('мои покупки с полётом', sawFly >= 2, String(sawFly)); ok('полёт карт соперника замечен', sawOppFly > 0, String(sawOppFly));
  console.log(res.join('\n')); console.log('ошибки', errs.slice(0, 5));
  await b.close();
})();
