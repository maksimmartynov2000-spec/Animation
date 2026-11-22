// v10.4: нанять знамя из открытой карты. node buy2.js
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: 'deer', opps: 1, speed: 'fast', mods: ['lords', 'faith'], tut: 0, coins: false, sound: false, music: false })); } catch (e) {} });
  await p.goto('file://' + SP + 'test-embed.html');
  await p.waitForSelector('#splash', { state: 'detached', timeout: 5000 }).catch(() => {});
  await p.click('[data-act="setup"]'); await p.waitForTimeout(400); await p.click('[data-act="start"]');
  for (let i = 0; i < 300; i++) { if (await p.evaluate(() => window.__VD.isMyTurn() && !window.__VD.busy && !document.body.classList.contains('dealing'))) break; await p.waitForTimeout(100); }
  await p.waitForTimeout(500);
  await p.evaluate(() => { window.__VD.S.players[window.__VD.ME].gold = 40; });
  await p.evaluate(() => { const r = [...document.querySelectorAll('.abar [data-act="roll"]')].pop(); if (r) r.click(); }); await p.waitForTimeout(2800);
  await p.click('.abar [data-act="drawer"][data-d="regalia"]'); await p.waitForTimeout(450);
  const before = await p.evaluate(() => { const me = window.__VD.S.players[window.__VD.ME]; return { v: me.vassals.length, gold: me.gold }; });
  await p.evaluate(() => { const sl = [...document.querySelectorAll('.drawer .mslot')].filter(x => { const b = x.querySelector('.buyb.ok[data-act="hire"]'); return b && !b.disabled; })[0]; sl.querySelector('.mcard').click(); });
  await p.waitForTimeout(550);
  const bar = await p.evaluate(() => { const b = document.querySelector('.scrim:not(.out) .buybar [data-buyproxy]'); return b ? { text: b.innerText.replace(/\s+/g, ' '), off: b.disabled } : null; });
  await p.screenshot({ path: SP + 'v10/buy2-1.png' });
  await p.click('.scrim:not(.out) .buybar [data-buyproxy]'); await p.waitForTimeout(1700);
  const after = await p.evaluate(() => { const me = window.__VD.S.players[window.__VD.ME]; return { v: me.vassals.length, gold: me.gold, sheet: !!document.querySelector('.scrim:not(.out)') }; });
  console.log((bar && !bar.off && /Нанять за/.test(bar.text) && after.v === before.v + 1 && !after.sheet ? 'OK  ' : 'FAIL ') + 'нанять знамя из открытой карты — ' + JSON.stringify([bar, before, after]));
  // вера: планка «Принять веру»
  await p.click('.abar [data-act="drawer"][data-d="regalia"]').catch(() => {}); await p.waitForTimeout(450);
  const f = await p.evaluate(() => { const c = document.querySelector('.drawer .mslot .mcard[data-kind="faith"]'); if (!c) return null; c.click(); return c.dataset.id; });
  await p.waitForTimeout(550);
  const fb = await p.evaluate(() => { const b = document.querySelector('.scrim:not(.out) .buybar [data-buyproxy]'); return b ? { text: b.innerText.replace(/\s+/g, ' '), off: b.disabled } : null; });
  await p.screenshot({ path: SP + 'v10/buy2-2.png' });
  console.log((f && fb ? 'OK  ' : 'FAIL ') + 'вера: планка в листе — ' + JSON.stringify([f, fb]));
  console.log('ошибки', errs.slice(0, 4));
  await b.close();
})();
