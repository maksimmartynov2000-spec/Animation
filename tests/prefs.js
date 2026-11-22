// v10.10: выбранная длина партии запоминается после перезапуска (раньше «Длинная» сбрасывалась на «Среднюю»). node prefs.js [file]
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
const FILE = process.argv[2] || (SP + 'test-embed.html');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); p.setDefaultTimeout(4000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const res = []; const ok = (name, cond, info) => res.push(`${cond ? 'OK ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`);
  const open = async () => { await p.waitForSelector('#splash', { state: 'detached', timeout: 5000 }).catch(() => {}); await p.click('[data-act="setup"]'); await p.waitForTimeout(300); };
  const len = () => p.evaluate(() => { const x = document.querySelector('[data-act="length"].on'); return x ? x.dataset.k : ''; });
  await p.goto('file://' + FILE); await open();
  for (const k of ['long', 'short', 'medium', 'long']) {
    await p.click(`[data-act="length"][data-k="${k}"]`); await p.waitForTimeout(200);
    await p.reload(); await open();
    ok(`выбрали «${k}» — после перезапуска та же`, (await len()) === k, `сейчас «${await len()}»`);
  }
  await p.click('[data-act="start"]'); await p.waitForTimeout(1200);
  const goal = await p.evaluate(() => (document.querySelector('.pbar.own .pipsb small') || {}).innerText || '');
  ok('длинная партия после перезапуска: цель 12 знамён', /из 12/.test(goal), goal);
  console.log(res.join('\n')); console.log('ошибки', errs.slice(0, 5));
  await b.close();
})();
