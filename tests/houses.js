// v10.22 (Блок 5 «Дома»): 8 Домов в выборе, стол Розы (дубль, шпионаж с Дома шёпота), фамильные карты с окнами —
// Спячка (до броска / после броска), Меняла (два шага), Медовые соты (метка на Земле), Подмена, Астролябия (бросок только для вас),
// понятное окно шпионажа (что потеряете, что будет при провале, шанс), долг Клары — после содержания. iPhone 15.
// node houses.js [file]
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
const FILE = process.argv[2] || (SP + 'test-embed.html');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); p.setDefaultTimeout(5000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const res = []; const ok = (name, cond, info) => res.push(`${cond ? 'OK ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`);
  await p.addInitScript(() => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: 'rose', opps: 1, speed: 'turbo', mods: ['lords', 'great', 'faith', 'sieges', 'spy'], tut: 0, coins: false, sound: false, music: false })); } catch (e) {} });
  await p.goto('file://' + FILE); await p.waitForSelector('#splash', { state: 'detached', timeout: 6000 }).catch(() => {});
  await p.click('[data-act="setup"]'); await p.waitForTimeout(400);
  const hs = await p.evaluate(() => [...document.querySelectorAll('.houses .house')].map(x => x.innerText.split('\n')[0].trim()));
  ok('выбор Дома: 8 Домов, есть Роза и Солнце', hs.length === 8 && hs.some(x => /Розы/.test(x)) && hs.some(x => /Солнца/.test(x)), hs.join(', '));
  await p.click('[data-act="start"]');
  const myTurn = async () => { for (let i = 0; i < 300; i++) { if (await p.evaluate(() => window.__VD.isMyTurn() && !window.__VD.busy && !document.body.classList.contains('dealing'))) return true; await p.waitForTimeout(100); } return false; };
  const sheet = () => p.evaluate(() => { const s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); return s ? s.innerText.replace(/\s+/g, ' ') : ''; });
  const pick = (re) => p.evaluate((src) => { const s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); const b = s && [...s.querySelectorAll('.optlist [data-v]')].find(x => new RegExp(src).test(x.innerText)); if (b) b.click(); return !!b; }, re.source);
  const me = (fn, arg) => p.evaluate(fn, arg);
  // 1. Тайная канцелярия Розы: в начале хода — окно шпионажа без карты (ход ждёт ответа — поэтому сначала окно)
  let t1 = ''; for (let i = 0; i < 200 && !/Шпионаж: украсть/.test(t1); i++) { await p.waitForTimeout(100); t1 = await sheet(); }
  ok('Роза: в начале хода шпионаж без карты — окно выбора цели', /Шпионаж: украсть 2/.test(t1), t1.slice(0, 90));
  await pick(/Отказаться/); await p.waitForTimeout(500);
  ok('мой ход', await myTurn());
  // 2. стол: Сад ядов — «дубль», Дом шёпота — значок шпиона, а не «+0»
  const tiles = await me(() => [...document.querySelectorAll('.tile')].filter(t => t.closest('.myzone, .me, .mine') || true).map(t => t.innerText.replace(/\s+/g, ' ').trim()));
  ok('плитки: Сад ядов на дубле +5, Дом шёпота без «+0»', tiles.some(x => /дубль/.test(x) && /\+5/.test(x)) && !tiles.some(x => /6–7/.test(x) && /\+0/.test(x)), tiles.join(' | '));
  // 3. Спячка: до броска — без броска, +2🪙 за Землю
  await me(() => { const V = window.__VD, S = V.S, a = S.players[V.ME]; a.estates = [{ uid: 9001, id: 'apiary' }, { uid: 9002, id: 'meadery' }, { uid: 9003, id: 'poisongarden' }]; a.gold = 10; a.hand = ['bear_sleep', 'tax', 'tax']; V.redraw(); });
  await p.waitForTimeout(400);
  await p.click('.handz .hcard[data-i="0"]'); await p.waitForTimeout(300);
  await p.click('[data-act="play"]'); await p.waitForTimeout(700); await myTurn();
  const s3 = await me(() => { const V = window.__VD, a = V.S.players[V.ME]; return { gold: a.gold, rolled: a.turn.rolled, slept: !!a.turn.slept }; });
  ok('Спячка: без броска, +2🪙 × 3 Земли', s3.gold === 16 && s3.rolled && s3.slept, JSON.stringify(s3));
  // 4. Спячка после броска — кнопка «Только до броска»
  await me(() => { const V = window.__VD, a = V.S.players[V.ME]; a.hand = ['bear_sleep', 'tax']; V.redraw(); });
  await p.waitForTimeout(400); await p.click('.handz .hcard[data-i="0"]'); await p.waitForTimeout(300);
  const late = await me(() => { const b = document.querySelector('[data-act="play"]'); return b ? `${b.innerText.replace(/\s+/g, ' ')}:${b.disabled}` : ''; });
  ok('Спячка после броска: «Только до броска», кнопка выключена', /Только до броска/.test(late) && /true$/.test(late), late);
  await p.evaluate(() => { const x = document.querySelector('[data-act="desel"]'); if (x) x.click(); }); await p.waitForTimeout(300);
  // 5. Меняла: два шага — что отдаём, что берём; доплата за дорогое
  await me(() => { const V = window.__VD, S = V.S, a = S.players[V.ME]; a.gold = 10; a.estates = [{ uid: 9011, id: 'vineyard' }]; S.estateRow = ['field', 'mine', 'bakery', 'pasture']; a.hand = ['deer_swap']; V.redraw(); });
  await p.waitForTimeout(400); await p.click('.handz .hcard[data-i="0"]'); await p.waitForTimeout(300); await p.click('[data-act="play"]'); await p.waitForTimeout(600);
  ok('Меняла: шаг 1 — какое владение отдаёте', /Меняла: какое владение отдаёте/.test(await sheet()));
  await pick(/Виноградник/); await p.waitForTimeout(500);
  const t5 = await sheet();
  ok('Меняла: шаг 2 — что берёте, доплата справа', /что берёте вместо «Виноградник»/.test(t5) && /Рудник/.test(t5), t5.slice(0, 120));
  await pick(/Рудник/); await p.waitForTimeout(700); await myTurn();
  const s5 = await me(() => { const V = window.__VD, S = V.S, a = S.players[V.ME]; return { mine: a.estates.some(e => e.id === 'mine'), row: S.estateRow.includes('vineyard'), gold: a.gold, cost: DATA.ESTATES.mine.cost - DATA.ESTATES.vineyard.cost }; });
  ok('Меняла: Рудник ваш, Виноградник в ряду, доплатили разницу', s5.mine && s5.row && s5.gold === 10 - Math.max(0, s5.cost), JSON.stringify(s5));
  // 6. Медовые соты: метка «+1» на Земле, плитка показывает доход с меткой
  await me(() => { const V = window.__VD, a = V.S.players[V.ME]; a.estates = [{ uid: 9021, id: 'apiary' }]; a.hand = ['bear_honey']; V.redraw(); });
  await p.waitForTimeout(400); await p.click('.handz .hcard[data-i="0"]'); await p.waitForTimeout(300); await p.click('[data-act="play"]'); await p.waitForTimeout(600);
  ok('Медовые соты: окно «какой Земле метку»', /Медовые соты: какой Земле/.test(await sheet()));
  await pick(/Пасека/); await p.waitForTimeout(700); await myTurn();
  const s6 = await me(() => { const V = window.__VD, a = V.S.players[V.ME]; const t = [...document.querySelectorAll('.tile')].find(x => /Пасека/.test(x.getAttribute('aria-label') || '')); return { up: a.estates[0].up, tile: t ? t.innerText.replace(/\s+/g, ' ') : '' }; });
  ok('Медовые соты: метка лежит, плитка Пасеки +2', s6.up === 1 && /\+2/.test(s6.tile), JSON.stringify(s6));
  // 7. Подмена: отдать карту — взять случайную из руки соперника
  await me(() => { const V = window.__VD, S = V.S, a = S.players[V.ME], o = S.players[1 - V.ME]; a.hand = ['rose_swap', 'tax']; o.hand = ['spicer']; V.redraw(); });
  await p.waitForTimeout(400); await p.click('.handz .hcard[data-i="0"]'); await p.waitForTimeout(300); await p.click('[data-act="play"]'); await p.waitForTimeout(600);
  ok('Подмена: окно «какую карту отдаёте»', /Подмена: какую карту отдаёте/.test(await sheet()));
  await pick(/Подать/); await p.waitForTimeout(700); await myTurn();
  const s7 = await me(() => { const V = window.__VD, S = V.S, a = S.players[V.ME], o = S.players[1 - V.ME]; return { mine: a.hand.join(','), theirs: o.hand.join(',') }; });
  ok('Подмена: Подать — у соперника, его карта — у вас', s7.mine === 'spicer' && s7.theirs === 'tax', JSON.stringify(s7));
  // 8. Астролябия: окно «сколько кубиков», бросок только для вас
  await me(() => { const V = window.__VD, a = V.S.players[V.ME]; a.hand = ['owl_astro']; V.redraw(); });
  await p.waitForTimeout(400); await p.click('.handz .hcard[data-i="0"]'); await p.waitForTimeout(300); await p.click('[data-act="play"]'); await p.waitForTimeout(600);
  ok('Астролябия: окно «бросок только для вас», 1 или 2 кубика', /Астролябия: бросок только для вас/.test(await sheet()) && /Два кубика/.test(await sheet()));
  await pick(/Два кубика/); await p.waitForTimeout(1500); await myTurn();
  ok('Астролябия: бросок в журнале', await me(() => window.__VD.S.log.some(x => /Астролябия/.test(x.t))));
  // 9. окно шпионажа: кто, что потеряете, что при провале, шанс
  await me(() => { window.__q = window.__VD.ask({ type: 'buyoff', cost: 3, from: 1 - window.__VD.ME, A: 4, G: 5, odds: 0.28, effect: 'lock', param: 1, card: 'courtesan' }); });
  await p.waitForTimeout(500);
  const t9 = await sheet();
  ok('окно шпионажа: карта, «Если шпион победит» — не наймёте знамён, «Если стража отобьёт», шанс 28% / 72%',
    /Куртизанка/.test(t9) && /Если шпион победит/.test(t9) && /не сможете нанимать знамёна/.test(t9) && /Если стража отобьёт/.test(t9) && /28%/.test(t9) && /72%/.test(t9), t9.slice(0, 160));
  await pick(/Пусть бросают/); await p.waitForTimeout(400);
  // 10. Клара: долг — после содержания
  await me(() => { const V = window.__VD, a = V.S.players[V.ME]; a.vassals = ['klara']; a.gold = 10; delete a.loan; a.turn.loaned = false; V.redraw(); });
  await p.waitForTimeout(400);
  const has = await me(() => !!document.querySelector('[data-act="ex"][data-k="loan"]'));
  if (has) { await p.click('[data-act="ex"][data-k="loan"]'); await p.waitForTimeout(400); }
  ok('Клара: «после содержания знамён» в окне долга', /после содержания знамён/.test(await sheet()), (await sheet()).slice(0, 120));
  ok('ошибок страницы нет', !errs.length, errs.join(' | '));
  console.log(res.join('\n'));
  await b.close();
})();
