// v10.2: клавиатура и наведение на MacBook. node kb.js
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1512, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.addInitScript(() => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: 'wolf', opps: 1, speed: 'turbo', mods: ['lords', 'faith', 'plots', 'seats'], tut: 0, coins: true })); } catch (e) {} });
  await p.goto('file://' + SP + 'test-embed.html');
  await p.waitForSelector('#splash', { state: 'detached', timeout: 5000 }).catch(() => {});
  await p.click('[data-act="setup"]'); await p.waitForTimeout(300); await p.click('[data-act="start"]'); await p.waitForTimeout(700);
  const res = []; const ok = (n, v, x) => { res.push((v ? 'OK  ' : 'FAIL ') + n + (x ? ' — ' + x : '')); };
  const st = () => p.evaluate(() => { const V = window.__VD, S = V.S, me = S.players[V.ME]; return { my: V.isMyTurn(), rolled: me.turn.rolled, hand: me.hand.length, sel: V.sel ? V.sel.i : null, coins: V.coins, round: S.round, cur: S.cur, inPlay: me.inPlay.length, gold: me.gold }; });
  const waitMy = async () => { for (let i = 0; i < 400; i++) { const s = await st(); if (s.my && !s.coins) return s; if (s.coins) await p.keyboard.press('Enter'); await p.waitForTimeout(60); } return st(); };
  let s = await waitMy();
  ok('kbd-метки на кнопках кубиков', await p.locator('.abar .tdie-w .kbd').count() === 2);
  // стрелка вправо выбирает первую карту
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(250); let s1 = await st();
  ok('→ выбирает карту', s1.sel === 0, JSON.stringify(s1.sel));
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(250); let s2 = await st();
  ok('→ ещё раз — следующая', s2.sel === 1, JSON.stringify(s2.sel));
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(250); s2 = await st(); ok('← назад', s2.sel === 0);
  await p.keyboard.press('Escape'); await p.waitForTimeout(250); s2 = await st(); ok('Esc снимает выбор', s2.sel === null);
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(200);
  ok('↵ на главной кнопке при выбранной карте', await p.locator('.abar .primary .kbd').count() === 1);
  await p.keyboard.press('ArrowUp'); await p.waitForTimeout(500); let s3 = await st();
  ok('↑ играет карту', s3.hand === s.hand - 1 || s3.inPlay > s.inPlay, `${s.hand}→${s3.hand}`);
  // наведение
  await p.mouse.move(5, 5); await p.waitForTimeout(100);
  const mc = p.locator('.shopcol .mcard').first(); const bb = await mc.boundingBox();
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(650);
  const hv = await p.evaluate(() => { const h = document.getElementById('hovcard'); const r = h.getBoundingClientRect(); return { vis: !h.hidden && !!h.querySelector('.pcw'), w: r.width, h: r.height, x: r.left, y: r.top, in: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; });
  ok('наведение на карту рынка — крупная карта', hv.vis && hv.in && hv.h > 250, JSON.stringify(hv));
  await p.screenshot({ path: SP + 'v10/kb-hover.png' });
  const tl = p.locator('.tiles.own .tile').first(); const tb = await tl.boundingBox();
  await p.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2); await p.waitForTimeout(650);
  ok('наведение на своё владение', await p.evaluate(() => { const h = document.getElementById('hovcard'); return !h.hidden && !!h.querySelector('.pcw'); }));
  await p.screenshot({ path: SP + 'v10/kb-hover2.png' });
  const hc = p.locator('.handz .hcard').first(); const hb = await hc.boundingBox();
  await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await p.waitForTimeout(650);
  ok('наведение на карту руки', await p.evaluate(() => { const h = document.getElementById('hovcard'); return !h.hidden && !!h.querySelector('.pcw'); }));
  await p.screenshot({ path: SP + 'v10/kb-hover3.png' });
  await p.mouse.move(700, 5); await p.waitForTimeout(200);
  ok('увели мышь — карта скрыта', await p.evaluate(() => document.getElementById('hovcard').hidden));
  // бросок клавишей 2
  await p.keyboard.press('2'); await p.waitForTimeout(900); let s4 = await st();
  ok('2 — бросок двух кубиков', s4.rolled, JSON.stringify(s4));
  for (let i = 0; i < 20; i++) { const x = await st(); if (!x.coins) break; await p.keyboard.press('Enter'); await p.waitForTimeout(200); }
  let s5 = await st(); ok('Enter забирает монеты', !s5.coins);
  await p.screenshot({ path: SP + 'v10/kb-after.png' });
  // Enter — завершить ход (может спросить подтверждение)
  for (let i = 0; i < 6; i++) { const x = await st(); if (!x.my) break; await p.keyboard.press('Enter'); await p.waitForTimeout(300); }
  let s6 = await st(); ok('Enter завершает ход', !s6.my || s6.round > s5.round, JSON.stringify(s6));
  s = await waitMy();
  await p.keyboard.press('1'); await p.waitForTimeout(900); const s7 = await st(); ok('1 — бросок одного кубика', s7.rolled);
  // меню: Enter не должен ничего ломать, Esc закрывает
  await p.click('.pbar.foe [data-act="menu"]').catch(() => {}); await p.waitForTimeout(300);
  const shOpen = await p.evaluate(() => !!document.querySelector('.scrim:not(.out)'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(350);
  ok('Esc закрывает лист', shOpen && await p.evaluate(() => !document.querySelector('.scrim:not(.out)')));
  console.log(res.join('\n')); console.log('ошибки', errs.slice(0, 5));
  await b.close();
})();
