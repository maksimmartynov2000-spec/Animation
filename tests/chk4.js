const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, reducedMotion: 'reduce' }); const p = await ctx.newPage(); p.setDefaultTimeout(2500);
  await p.addInitScript(() => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: 'deer', opps: 3, speed: 'fast', mods: ['lords'], coins: true })); } catch (e) {} });
  await p.goto('file://' + SP + 'test-embed.html');
  await p.waitForSelector('#splash', { state: 'detached', timeout: 5000 }).catch(() => {});
  await p.click('[data-act="setup"]'); await p.waitForTimeout(300); await p.click('[data-act="start"]'); await p.waitForTimeout(900);
  console.log(JSON.stringify(await p.evaluate(() => ({ iw: innerWidth, vv: visualViewport.width, sc: visualViewport.scale, doc: document.documentElement.clientWidth, dsw: document.documentElement.scrollWidth, body: document.body.getBoundingClientRect().width, app: document.getElementById('app').getBoundingClientRect().width, board: document.querySelector('.board').getBoundingClientRect().width, wide: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > 394).slice(0, 8).map(e => e.tagName + '.' + e.className + ':' + Math.round(e.getBoundingClientRect().right)) })))); console.log(JSON.stringify(await p.evaluate(() => { const f = document.querySelector('.pbar.foe'), r = f.getBoundingClientRect(); return { bar: [r.left, r.right, f.scrollWidth, f.clientWidth], chips: [...f.querySelectorAll('.ochip')].map(c => Math.round(c.getBoundingClientRect().width)), oc: (() => { const o = f.querySelector('.ochips'); return [o.clientWidth, o.scrollWidth]; })(), menu: Math.round(f.querySelector('.round').getBoundingClientRect().right) }; })));
  await p.screenshot({ path: SP + 'v10/chk4.png' });
  await b.close();
})();
