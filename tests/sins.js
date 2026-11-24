// v10.15: грехи и покаяние на экране партии. Купить грех на рынке двора (0🪙, действие) — он перед игроком на странице «Двор»,
// Гордыня спрашивает, кого нанять; покаяние начинается кнопкой на «Дворе» (только в вере, до броска); каталог «😈 Грехи»; правила «Веры».
// node sins.js [file]
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
const FILE = process.argv[2] || (SP + 'test-embed.html');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); p.setDefaultTimeout(5000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const res = []; const ok = (name, cond, info) => res.push(`${cond ? 'OK ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`);
  await p.addInitScript(() => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: 'deer', opps: 1, speed: 'turbo', mods: ['lords', 'faith', 'plots', 'seats', 'sieges', 'spy'], tut: 0, coins: false, sound: false, music: false })); } catch (e) {} });
  await p.goto('file://' + FILE); await p.waitForSelector('#splash', { state: 'detached', timeout: 6000 }).catch(() => {});
  await p.click('[data-act="setup"]'); await p.waitForTimeout(300); await p.click('[data-act="start"]');
  const myTurn = async () => { for (let i = 0; i < 300; i++) { if (await p.evaluate(() => window.__VD.isMyTurn() && !window.__VD.busy && !document.body.classList.contains('dealing'))) return true; await p.waitForTimeout(100); } return false; };
  const sheet = () => p.evaluate(() => { const s = document.querySelector('.scrim:not(.out)'); return s ? s.innerText.replace(/\s+/g, ' ') : ''; });
  const waitSheet = async (re) => { for (let i = 0; i < 60; i++) { const t = await sheet(); if (re.test(t)) return t; await p.waitForTimeout(100); } return await sheet(); };
  const closeAll = async () => { await p.evaluate(() => { for (const s of document.querySelectorAll('.page, .scrim')) if (s.close) s.close(); }); await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(350); };
  const buySin = async (id) => {
    await p.click('.abar [data-act="drawer"][data-d="market"]'); await p.waitForTimeout(450);
    await p.evaluate((id) => { const c = document.querySelector(`.drawer .mcard[data-id="${id}"]`); if (c) c.click(); }, id); await p.waitForTimeout(450);
    const bar = await p.evaluate(() => { const x = document.querySelector('.scrim:not(.out) .buybar [data-buyproxy]'); return x ? { text: x.innerText.replace(/\s+/g, ' '), off: x.disabled } : null; });
    if (bar && !bar.off) await p.click('.scrim:not(.out) .buybar [data-buyproxy]');
    return bar;
  };
  ok('мой ход', await myTurn());
  await p.waitForTimeout(400);
  // 1. Алчность: 0🪙, действие; золото удвоено, грех перед игроком
  await p.evaluate(() => { const V = window.__VD, S = V.S, me = S.players[V.ME]; me.gold = 10; S.courtRow[0] = 'sin_greed'; V.redraw(); });
  await p.evaluate(() => { const r = [...document.querySelectorAll('.abar [data-act="roll"]')].pop(); if (r) r.click(); }); await p.waitForTimeout(2600);
  const g0 = await p.evaluate(() => window.__VD.S.players[window.__VD.ME].gold);
  const bar = await buySin('sin_greed'); await p.waitForTimeout(900);
  const st1 = await p.evaluate(() => { const V = window.__VD, me = V.S.players[V.ME]; return { sins: me.sins, gold: me.gold, discard: me.discard.includes('sin_greed') }; });
  ok('грех на рынке: «Купить за 0»', bar && /Купить за 0/.test(bar.text) && !bar.off, JSON.stringify(bar));
  ok('Алчность: грех перед игроком, золото удвоено', st1.sins.includes('sin_greed') && st1.gold === g0 * 2 && !st1.discard, `${g0} → ${st1.gold}`);
  // 2. «Двор»: раздел «Грехи», карта покаяния; без веры — кнопка с объяснением
  await closeAll(); await p.click('.myb[data-act="my"]'); await p.waitForTimeout(600);
  const my1 = await p.evaluate(() => { const h = [...document.querySelectorAll('.sec-h h3')].map(e => e.innerText).join('|'); const x = document.querySelector('[data-act="penance"]'); return { h, btn: x ? x.innerText : null, off: x ? x.disabled : null, badge: (document.querySelector('.myb') || {}).innerText || '' }; });
  ok('«Двор»: раздел «Грехи» и кнопка покаяния с причиной', /Грехи/.test(my1.h) && my1.btn && my1.off && /вер/.test(my1.btn), JSON.stringify(my1));
  ok('на кнопке «Двор» — 😈1', /😈1/.test(my1.badge), my1.badge);
  await closeAll();
  // 3. покаяние: вера есть, до броска — кнопка работает, шаг 1: 5🪙 самому бедному
  await p.evaluate(() => { const V = window.__VD, S = V.S, me = S.players[V.ME]; me.faiths = [S.faithRow[0]]; me.turn.rolled = false; me.gold = 30; V.redraw(); });
  await p.waitForTimeout(300); await p.click('.myb[data-act="my"]'); await p.waitForTimeout(600);
  const opGold0 = await p.evaluate(() => window.__VD.S.players[1 - window.__VD.ME].gold);
  const pb = await p.evaluate(() => { const x = document.querySelector('[data-act="penance"]'); return x ? { text: x.innerText, off: x.disabled } : null; });
  ok('с верой до броска — «Начать покаяние»', pb && !pb.off && /Начать покаяние/.test(pb.text), JSON.stringify(pb));
  if (pb && !pb.off) await p.click('[data-act="penance"]');
  await p.waitForTimeout(900);
  const st3 = await p.evaluate(() => { const V = window.__VD, me = V.S.players[V.ME], op = V.S.players[1 - V.ME]; return { pen: me.penance, gold: me.gold, op: op.gold, badge: (document.querySelector('.myb') || {}).innerText || '' }; });
  ok('покаяние, шаг 1: 5🪙 сопернику, на кнопке «Двор» — свеча и 1/4', st3.pen && st3.pen.step === 1 && st3.gold === 25 && st3.op === opGold0 + 5 && /1\/4/.test(st3.badge), JSON.stringify(st3));
  await closeAll();
  // 4. Гордыня: окно «кого нанять» — вассал бесплатно
  await p.evaluate(() => { const V = window.__VD, S = V.S, me = S.players[V.ME]; me.turn.rolled = true; me.turn.buysUsed = 0; me.penance = null; S.courtRow[0] = 'sin_pride'; V.redraw(); });
  await p.waitForTimeout(300);
  const v0 = await p.evaluate(() => window.__VD.S.players[window.__VD.ME].vassals.length), gp = await p.evaluate(() => window.__VD.S.players[window.__VD.ME].gold);
  await buySin('sin_pride');
  const ask = await waitSheet(/Гордыня: кого нанять/);
  ok('Гордыня: окно «кого нанять»', /Гордыня: кого нанять/.test(ask) && /бесплатно/.test(ask), ask.slice(0, 120));
  await p.evaluate(() => { const o = document.querySelector('.scrim:not(.out) .optlist [data-v]'); if (o) o.click(); }); await p.waitForTimeout(900);
  const st4 = await p.evaluate(() => { const V = window.__VD, me = V.S.players[V.ME]; return { v: me.vassals.length, gold: me.gold, sins: me.sins.length }; });
  ok('Гордыня: вассал нанят бесплатно, грехов два', st4.v === v0 + 1 && st4.gold === gp && st4.sins === 2, JSON.stringify(st4));
  await closeAll();
  // 5. каталог: кнопка «😈 Грехи» — 7 грехов и покаяние; лист карты греха
  const sheetOf = (d) => p.evaluate((d) => { const x = document.createElement('div'); x.innerHTML = window.__VD.infoParts(d).body; return x.innerText.replace(/\s+/g, ' '); }, d);
  const ls = await sheetOf({ act: 'info-court', id: 'sin_sloth' });
  ok('лист Лени: «Сейчас», «До конца игры», «снять — только покаянием»', /Сейчас/.test(ls) && /До конца/.test(ls) && /покаянием/.test(ls) && /Дубль/.test(ls), ls.slice(0, 140));
  console.log(res.join('\n')); console.log('ошибки', errs.slice(0, 5));
  await b.close();
})();
