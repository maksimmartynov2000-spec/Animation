// v10: обучение, «передаём устройство», партия ботов, меню и настройки — по кадру на каждое. node modes.js [dev]
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
const DEV = { i15: [393, 852, 59, 34, 0, 0], i12: [428, 926, 47, 34, 0, 0], mini: [744, 1133, 24, 20, 0, 0], minil: [1133, 744, 24, 20, 0, 0], mac: [1512, 900, 0, 0, 0, 0], i15l: [852, 393, 0, 21, 59, 59] };
const dev = process.argv[2] || 'i15', only = process.argv[3] || '';
(async () => {
  const [w, h, st, sb] = DEV[dev];
  const b = await chromium.launch();
  const open = async (prefs) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }); const p = await ctx.newPage(); p.setDefaultTimeout(2500);
    p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) p.errs.push('console: ' + m.text()); });
    await p.addInitScript((prefs) => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify(prefs)); } catch (e) {} }, prefs);
    await p.goto('file://' + SP + 'test-embed.html');
    await p.addStyleTag({ content: `:root{--sat:${st}px!important;--sab:${sb}px!important}` });
    await p.waitForSelector('#splash', { state: 'detached', timeout: 5000 }).catch(() => {});
    return p;
  };
  const shot = async (p, k) => { await p.waitForTimeout(400); await p.screenshot({ path: SP + `v10/${dev}-m-${k}.png` }); console.log('кадр', k); };
  const base = { v2: 1, v3: 1, v10: 1, house: 'deer', opps: 1, speed: 'normal', mods: ['lords'], coins: true };
  if (!only || only === 'home') {
    const p = await open(base); await shot(p, 'home');
    await p.click('[data-act="setup"]'); await shot(p, 'setup');
    await p.evaluate(() => window.scrollTo(0, 600)); await shot(p, 'setup2');
    await p.click('[data-act="home"]'); await p.waitForTimeout(300);
    await p.click('[data-act="settings"]'); await shot(p, 'settings');
    console.log('ошибки', p.errs); await p.close();
  }
  if (!only || only === 'tut') {
    const p = await open(base);
    await p.click('[data-act="tutorial"]'); await p.waitForTimeout(900); await shot(p, 'tut1');
    await p.click('[data-act="tut-ok"]').catch(e => console.log('нет tut-ok')); await shot(p, 'tut2');
    await p.click('[data-act="coach-min"]').catch(e => console.log('нет coach-min')); await shot(p, 'tut3');
    await p.click('[data-act="play-all"]').catch(() => {}); await p.waitForTimeout(900); await shot(p, 'tut4');
    await p.click('[data-act="coach-min"]').catch(() => {});
    await p.click('[data-act="roll"]').catch(() => {}); await p.waitForTimeout(2600); await shot(p, 'tut5');
    await p.click('[data-act="coin-all"]').catch(() => {}); await p.waitForTimeout(800); await shot(p, 'tut6');
    console.log('подсказка', await p.evaluate(() => (document.querySelector('.coachw .coach') || {}).innerText || '').then(x => x.slice(0, 160)));
    console.log('ошибки', p.errs); await p.close();
  }
  if (!only || only === 'hot') {
    const p = await open(Object.assign({}, base, { seats: [{ type: 'local', house: 'owl' }] }));
    await p.click('[data-act="setup"]'); await p.waitForTimeout(300); await shot(p, 'hot-setup');
    await p.click('[data-act="start"]'); await p.waitForTimeout(900); await shot(p, 'hot1');
    await p.click('[data-act="cover-ok"]').catch(() => console.log('нет cover')); await shot(p, 'hot2');
    await p.click('[data-act="play-all"]').catch(() => {}); await p.waitForTimeout(600);
    await p.click('[data-act="roll"]').catch(() => {}); await p.waitForTimeout(2600); await shot(p, 'hot3');
    for (let k = 0; k < 6; k++) { await p.click('[data-act="coin-all"]', { timeout: 300 }).catch(() => {}); await p.click('[data-act="adj-ok"]', { timeout: 200 }).catch(() => {}); await p.waitForTimeout(200); }
    await p.click('[data-act="end"]').catch(() => {}); await p.waitForTimeout(200); await p.click('[data-act="end"]', { timeout: 400 }).catch(() => {}); await p.waitForTimeout(300);
    await p.click('[data-act="step-ok"]', { timeout: 600 }).catch(() => {}); await shot(p, 'hot4');
    console.log('ошибки', p.errs); await p.close();
  }
  if (!only || only === 'watch') {
    const p = await open(Object.assign({}, base, { speed: 'fast' }));
    await p.click('[data-act="setup"]'); await p.waitForTimeout(300);
    await p.evaluate(() => window.scrollTo(0, 99999)); await p.click('[data-act="watch"]'); await p.waitForTimeout(2500); await shot(p, 'watch');
    console.log('ошибки', p.errs); await p.close();
  }
  if (!only || only === 'pause') {
    const p = await open(Object.assign({}, base, { pause: true, speed: 'fast' }));
    await p.click('[data-act="setup"]'); await p.waitForTimeout(300); await p.click('[data-act="start"]');
    for (let k = 0; k < 80; k++) { const s = await p.evaluate(() => ({ nx: window.__VD.waitNext, my: window.__VD.isMyTurn(), rolled: window.__VD.isMyTurn() && window.__VD.S.players[window.__VD.ME].turn.rolled })); if (s.nx) break; if (s.my && !s.rolled) { await p.click('[data-act="roll"]', { timeout: 300 }).catch(() => {}); await p.waitForTimeout(1800); } for (const a of ['coin-all', 'adj-ok', 'step-ok']) await p.click(`[data-act="${a}"]`, { timeout: 150 }).catch(() => {}); if (s.my && s.rolled) { await p.click('[data-act="end"]', { timeout: 300 }).catch(() => {}); await p.click('[data-act="end"]', { timeout: 300 }).catch(() => {}); } await p.waitForTimeout(150); }
    await shot(p, 'pause');
    console.log('ошибки', p.errs); await p.close();
  }
  await b.close();
})();
