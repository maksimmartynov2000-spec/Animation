// v10.3: обучение — короткие шаги с подсветкой. node tut.js [dev]
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
const DEV = { i15: [393, 852, 59, 34], mini: [744, 1133, 24, 20], minil: [1133, 744, 24, 20], mac: [1512, 900, 0, 0] };
const dev = process.argv[2] || 'i15';
(async () => {
  const [w, h, st, sb] = DEV[dev];
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: dev !== 'mac', isMobile: dev !== 'mac', reducedMotion: 'reduce' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.addInitScript(() => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: 'wolf', opps: 1, speed: 'fast', mods: [], coins: true, sound: false, music: false })); } catch (e) {} });
  await p.goto('file://' + SP + 'test-embed.html');
  await p.addStyleTag({ content: `:root{--sat:${st}px!important;--sab:${sb}px!important}` });
  await p.waitForSelector('#splash', { state: 'detached', timeout: 5000 }).catch(() => {});
  const res = []; const ok = (n, v, x) => res.push((v ? 'OK  ' : 'FAIL ') + n + (x ? ' — ' + x : ''));
  const info = () => p.evaluate(() => { const c = document.querySelector('#coachw .coach'), s = document.querySelector('.board > .spot'); const r = s && !s.hidden ? s.getBoundingClientRect() : null; return { title: c ? c.querySelector('.ch-h b').textContent : '', text: c ? c.querySelector('p').textContent : '', len: c ? c.querySelector('p').textContent.length : 0, dots: c ? c.querySelectorAll('.ch-d i.on').length + '/' + c.querySelectorAll('.ch-d i').length : '', spot: r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null, h: c ? Math.round(c.getBoundingClientRect().height) : 0 }; });
  const shot = async (k) => { await p.waitForTimeout(450); await p.screenshot({ path: SP + `v10/tut-${dev}-${k}.png` }); };
  const seen = [];
  const note = async (k) => { const i = await info(); seen.push(i); console.log(k, JSON.stringify(i)); await shot(k); return i; };
  await p.click('[data-act="tutorial"]'); await p.waitForTimeout(1200);
  let i = await note('1'); ok('шаг 1: цель, подсветка флажков', /Цель/.test(i.title) && !!i.spot);
  await p.click('[data-act="tut-ok"]'); await p.waitForTimeout(500);
  i = await note('2'); ok('шаг 2: карта из руки, подсвечена рука', /карт/i.test(i.title) && !!i.spot && i.spot[1] > h * 0.5);
  await p.click('.handz .hcard[data-act="sel"]'); await p.waitForTimeout(300); await p.click('.abar [data-act="play"]'); await p.waitForTimeout(900);
  i = await note('3'); ok('шаг 3: бросок, подсвечены кубики', /куб/i.test(i.title) && !!i.spot);
  await p.evaluate(() => { const r = [...document.querySelectorAll('.abar [data-act="roll"]')].pop(); r.click(); }); await p.waitForTimeout(2400);
  i = await info();
  if (/доход|Набег/i.test(i.title)) { await note("4"); ok("шаг 4: доход или набег, подсвечены плитки", !!i.spot); await p.evaluate(() => { const b = document.querySelector('[data-act="coin-all"]'); if (b) b.click(); }); await p.waitForTimeout(900); }
  else console.log('доход на этом броске не выпал — шаг 4 пропущен');
  i = await note('5'); ok('шаг 5: одно действие', /действ/i.test(i.title));
  // потратить действие, если есть на что; иначе шаг «завершите ход» придёт сам
  const big = await p.evaluate(() => window.__VD.layout.big);
  const bought = await p.evaluate((big) => { const vis = (e) => e && e.offsetParent !== null && !e.disabled; if (!big) return false; const bb = [...document.querySelectorAll('.shopcol .buyb.ok')].filter(vis); if (bb.length) { bb[0].click(); return true; } return false; }, big);
  if (!big) { await p.evaluate(() => { const d = document.querySelector('.abar [data-act="drawer"][data-d="market"]'); if (d) d.click(); }); await p.waitForTimeout(500); await shot('5d'); await p.evaluate(() => { const vis = (e) => e && e.offsetParent !== null && !e.disabled; const bb = [...document.querySelectorAll('.drawer .buyb.ok')].filter(vis); if (bb.length) bb[0].click(); else { const c = document.querySelector('.drawer [data-act="drawer-close"]'); if (c) c.click(); } }); }
  await p.waitForTimeout(1100);
  i = await note('6'); ok('шаг 6: завершите ход или действие', /Заверш|действ/i.test(i.title));
  for (let k = 0; k < 3; k++) { if (!(await p.evaluate(() => window.__VD.isMyTurn()))) break; await p.evaluate(() => { const e = document.querySelector('.abar [data-act="end"]'); if (e) e.click(); }); await p.waitForTimeout(350); await p.evaluate(() => { const e = document.querySelector('[data-act="step-ok"]'); if (e && e.offsetParent !== null) e.click(); }); await p.waitForTimeout(350); }
  await p.waitForTimeout(900);
  i = await note('7'); ok('шаг 7: ход соперника', /соперник/i.test(i.title));
  ok('все подсказки короткие (до 190 знаков)', seen.every(x => x.len <= 190), seen.map(x => x.len).join(', '));
  console.log(res.join('\n')); console.log('ошибки', errs.slice(0, 5));
  await b.close();
})();
