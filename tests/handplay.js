// v10.4: карта руки открыта крупно — «Сыграть» прямо из листа. node handplay.js
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: 'deer', opps: 1, speed: 'fast', mods: ['lords'], tut: 0, coins: false, sound: false, music: false })); } catch (e) {} });
  await p.goto('file://' + SP + 'test-embed.html');
  await p.waitForSelector('#splash', { state: 'detached', timeout: 5000 }).catch(() => {});
  await p.click('[data-act="setup"]'); await p.waitForTimeout(400); await p.click('[data-act="start"]');
  for (let i = 0; i < 300; i++) { if (await p.evaluate(() => window.__VD.isMyTurn() && !window.__VD.busy && !document.body.classList.contains('dealing'))) break; await p.waitForTimeout(100); }
  await p.waitForTimeout(1300);
  const h0 = await p.evaluate(() => window.__VD.S.players[window.__VD.ME].inPlay.length);
  // v10.22: фамильные карты бывают с окном выбора (Меняла, Соты, Подмена) — берём Подать или Сборщика
  const pk = await p.evaluate(() => Math.max(0, [...document.querySelectorAll('.handz .hcard[data-act="sel"]')].findIndex(h => !(DATA.COURT[h.dataset.id] || {}).sig)));
  await p.click(`.handz .hcard[data-act="sel"] >> nth=${pk}`); await p.waitForTimeout(350);
  await p.click('.handz .hcard.sel'); await p.waitForTimeout(600);
  const bar = await p.evaluate(() => { const x = document.querySelector('.scrim:not(.out) .buybar [data-buyproxy]'); return x ? { text: x.innerText.replace(/\s+/g, ' '), off: x.disabled } : null; });
  await p.screenshot({ path: SP + 'v10/handplay-1.png' });
  await p.click('.scrim:not(.out) .buybar [data-buyproxy]').catch(() => {}); await p.waitForTimeout(1500);
  const a = await p.evaluate(() => ({ hand: window.__VD.S.players[window.__VD.ME].inPlay.length, sheet: !!document.querySelector('.scrim:not(.out)') }));
  console.log((bar && !bar.off && /Сыграть|Захват|Шпион/.test(bar.text) && a.hand === h0 + 1 && !a.sheet ? 'OK  ' : 'FAIL ') + 'сыграть карту руки из листа — ' + JSON.stringify([bar, h0, a]));
  // карта со стола (своё владение): планки нет
  await p.click('.tiles.own .tile'); await p.waitForTimeout(500);
  const none = await p.evaluate(() => { const x = document.querySelector('.scrim:not(.out) .buybar'); return !x || x.hidden || !x.innerHTML; });
  console.log((none ? 'OK  ' : 'FAIL ') + 'у своего владения планки покупки нет');
  console.log('ошибки', errs.slice(0, 4));
  await b.close();
})();
