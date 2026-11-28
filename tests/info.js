// v10.1: нажатие на карту в рынке, знамёнах, на плитку и карту руки открывает её крупно; листание между соседними. node info.js [file]
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
const FILE = process.argv[2] || (SP + 'test-embed.html');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, reducedMotion: 'reduce' }); const p = await ctx.newPage(); p.setDefaultTimeout(2500);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); });
  // v10.22: соперник — любой Дом, кроме Розы: её Тайная канцелярия шпионит в начале её хода, и окно откупа открылось бы ещё до вашего хода
  const OPP = ['deer', 'owl', 'wolf', 'serpent', 'bear', 'lion', 'sun'].filter(h => h !== 'deer')[Math.floor(Math.random() * 6)];
  await p.addInitScript((opp) => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: 'deer', seats: [{ type: 'bot', house: opp }], opps: 1, speed: 'turbo', mods: ['lords', 'great', 'faith', 'plots', 'seats', 'sieges', 'spy'], coins: true })); } catch (e) {} }, OPP);
  await p.goto('file://' + FILE);
  await p.waitForSelector('#splash', { state: 'detached', timeout: 5000 }).catch(() => {});
  await p.click('[data-act="setup"]'); await p.waitForTimeout(300); await p.click('[data-act="start"]'); await p.waitForTimeout(700);
  // дождаться своего хода
  for (let k = 0; k < 200; k++) { const s = await p.evaluate(() => ({ my: __VD.isMyTurn(), coins: __VD.coins, step: __VD.step, adj: !!__VD.adjust })); if (s.coins) await p.click('[data-act="coin-all"]').catch(() => {}); else if (s.step) await p.click('[data-act="step-ok"]').catch(() => {}); else if (s.adj) await p.click('[data-act="adj-ok"]').catch(() => {}); else if (s.my) break; await p.waitForTimeout(80); }
  let ok = 0, bad = 0;
  const sheet = () => p.evaluate(() => { const s = [...document.querySelectorAll('.scrim:not(.out) .sheet')].pop(); return s ? { t: s.querySelector('h2').innerText.trim(), nav: !!s.querySelector('.cnav, [class*="cn-"]'), big: !!s.querySelector('.ex-pc') } : null; });
  const closeAll = async () => { await p.evaluate(() => { for (const s of document.querySelectorAll('.scrim')) if (s.close) s.close(); }); await p.waitForTimeout(260); };
  const tap = async (name, sel, tapEl) => { const el = await p.$(sel); if (!el) { console.log('—', name, ': нет на экране'); return; } const want = await el.getAttribute('aria-label'); await (tapEl || el).tap().catch(() => el.click()); await p.waitForTimeout(260); const s = await sheet(); if (s && s.big) { ok++; console.log('✓', name, '→', s.t, s.nav ? '(листается)' : ''); } else { bad++; console.log('✗', name, 'не открылась:', want); } await closeAll(); };
  await p.click('.abar [data-act="drawer"][data-d="market"]'); await p.waitForTimeout(400);
  await tap('рынок: владение', '.drawer .mcard.k-estate');
  await tap('рынок: карта двора', '.drawer .mcard.k-court');
  await tap('рынок: твердыня', '.drawer .mcard.t-hold');
  await p.click('.abar [data-act="drawer"][data-d="regalia"]'); await p.waitForTimeout(400);
  await tap('знамёна: вассал', '.drawer .drow:nth-of-type(1) .mcard.k-ban, .drawer .mcard.k-ban');
  await tap('знамёна: лорд', '.drawer .mcard.k-ban >> nth=5');
  await p.evaluate(() => { const d = document.querySelector('.drawer .dbody'); d.scrollTop = 9999; }); await p.waitForTimeout(150);
  await tap('знамёна: вера', '.drawer .mcard.k-faith');
  await p.click('[data-act="drawer-close"]'); await p.waitForTimeout(350);
  await tap('моя плитка', '.tiles.own .tile');
  await tap('плитка соперника', '.tiles.foe .tile');
  // карта руки: первое нажатие — выбрана, второе — крупно
  await p.tap('.handz .hcard >> nth=0'); await p.waitForTimeout(250);
  console.log('выбор карты:', JSON.stringify(await p.evaluate(() => __VD.sel)));
  await tap('рука: второе нажатие', '.handz .hcard.sel');
  // листание: открыть карту рынка и перейти к следующей стрелкой
  await p.click('[data-act="desel"]').catch(() => {}); await p.waitForTimeout(200);
  await p.click('.abar [data-act="drawer"][data-d="market"]'); await p.waitForTimeout(400);
  await p.tap('.drawer .mcard.k-court'); await p.waitForTimeout(300);
  const t1 = (await sheet() || {}).t; await p.keyboard.press('ArrowRight'); await p.waitForTimeout(500); const t2 = (await sheet() || {}).t;
  console.log('листание →:', t1, '→', t2, t1 && t2 && t1 !== t2 ? '✓' : '✗');
  if (!(t1 && t2 && t1 !== t2)) bad++; else ok++;
  await p.screenshot({ path: SP + 'v10/info-nav.png' });
  console.log(`итог: открылось ${ok}, не открылось ${bad}`); console.log('ошибки', errs.slice(0, 5));
  await b.close();
})();
