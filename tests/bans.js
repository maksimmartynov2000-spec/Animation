// v10.21: новые знамёна в интерфейсе — Клара (долг), Евстафий (сбросить и взять), Ортензия (обмен с рынком), Гертруда (два ритуала),
// Климент (проклятие снять бесплатно), окна Вольфрады (бесплатное нападение) и Мирона (верхняя карта колоды). iPhone 15.
// node bans.js [file]
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
const FILE = process.argv[2] || (SP + 'test-embed.html');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); p.setDefaultTimeout(5000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const res = []; const ok = (name, cond, info) => res.push(`${cond ? 'OK ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`);
  await p.addInitScript(() => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: 'deer', opps: 1, speed: 'turbo', mods: ['lords', 'great', 'faith', 'sieges', 'spy'], tut: 0, coins: false, sound: false, music: false })); } catch (e) {} });
  await p.goto('file://' + FILE); await p.waitForSelector('#splash', { state: 'detached', timeout: 6000 }).catch(() => {});
  await p.click('[data-act="setup"]'); await p.waitForTimeout(300); await p.click('[data-act="start"]');
  const myTurn = async () => { for (let i = 0; i < 300; i++) { if (await p.evaluate(() => window.__VD.isMyTurn() && !window.__VD.busy && !document.body.classList.contains('dealing'))) return true; await p.waitForTimeout(100); } return false; };
  const closeAll = async () => { await p.evaluate(() => { for (const s of document.querySelectorAll('.page, .scrim')) if (s.close) s.close(); }); await p.waitForTimeout(350); };
  const sheet = () => p.evaluate(() => { const s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); return s ? s.innerText.replace(/\s+/g, ' ') : ''; });
  const pick = (re) => p.evaluate((src) => { const s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); const b = s && [...s.querySelectorAll('.optlist [data-v]')].find(x => new RegExp(src).test(x.innerText)); if (b) b.click(); return !!b; }, re.source);
  const me = (fn, arg) => p.evaluate(fn, arg);
  ok('мой ход', await myTurn());
  await p.waitForTimeout(400);
  // Клара, Евстафий, Ортензия у меня; в руке Подать и Писарь, в ряду двора Сборщик податей
  await me(() => { const V = window.__VD, S = V.S, a = S.players[V.ME];
    a.vassals = ['klara']; a.lords = ['eustace']; a.greats = ['ortensia']; a.gold = 30; a.hand = ['tax', 'scribe', 'tax']; a.deck = ['collector', 'tax', 'tax'];
    a.estates = a.estates.filter(e => !DATA.ESTATES[e.id].bad); S.courtRow[0] = 'spicer'; V.redraw(); });
  await p.waitForTimeout(500);
  const ex = await me(() => [...document.querySelectorAll('.exline [data-act="ex"], .turnrow [data-act="ex"]')].map(x => x.dataset.k).join(','));
  ok('«Ещё можно»: обмен, сбросить, в долг', /swap/.test(ex) && /cycle/.test(ex) && /loan/.test(ex), ex);
  // 1. Клара: долг из строки «Ещё можно»
  await p.click('[data-act="ex"][data-k="loan"]'); await p.waitForTimeout(400);
  ok('Клара: окно «взять в долг?»', /Клара Меняла: взять в долг/.test(await sheet()), (await sheet()).slice(0, 80));
  await pick(/Взять 3/); await p.waitForTimeout(600); await myTurn();
  const s1 = await me(() => { const V = window.__VD, a = V.S.players[V.ME]; return { gold: a.gold, loan: a.loan }; });
  ok('Клара: +3🪙, долг 4🪙', s1.gold === 33 && s1.loan === 4, JSON.stringify(s1));
  // 2. «Двор»: кнопки под знамёнами, долг
  await p.click('.myb'); await p.waitForTimeout(700);
  const s2 = await me(() => { const s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); const t = (a) => { const b = s && s.querySelector(`[data-act="${a}"]`); return b ? `${b.innerText}:${b.disabled}` : null; }; return { loan: t('loan'), cycle: t('cycle'), swap: t('swap'), note: /Долг Кларе Меняле: 4/.test(s ? s.innerText : '') }; });
  ok('«Двор»: долг взят — кнопка выключена, видно «Долг Кларе Меняле»', /уже взят/.test(s2.loan || '') && /true$/.test(s2.loan || '') && s2.note, JSON.stringify(s2));
  ok('«Двор»: «Сбросить карту, взять новую» и «Обмен с рынком»', /false$/.test(s2.cycle || '') && /false$/.test(s2.swap || ''), JSON.stringify(s2));
  // 3. Евстафий: сбросить Подать — взять новую (сверху колоды — Подать: последняя в массиве)
  await p.click('.scrim:not(.out) [data-act="cycle"]'); await p.waitForTimeout(500);
  ok('Евстафий: окно выбора карты', /какую карту сбросить/.test(await sheet()), (await sheet()).slice(0, 80));
  await pick(/Подать/); await p.waitForTimeout(600); await myTurn();
  const s3 = await me(() => { const V = window.__VD, a = V.S.players[V.ME]; return { hand: a.hand.length, disc: a.discard.filter(x => x === 'tax').length, cycled: !!a.turn.cycled }; });
  ok('Евстафий: карта в сброс, рука та же', s3.hand === 3 && s3.disc >= 1 && s3.cycled, JSON.stringify(s3));
  // 4. Ортензия: Писарь в ряд, Торговец пряностями в руку
  await p.click('[data-act="ex"][data-k="swap"]'); await p.waitForTimeout(400);
  const t4 = await sheet();
  ok('Ортензия: окно «какую карту отдать», Подати в списке нет', /какую карту отдать/.test(t4) && !/Подать/.test(t4.split('Подать и фамильные')[1] || ''), t4.slice(0, 120));
  await pick(/Писарь/); await p.waitForTimeout(400);
  ok('Ортензия: окно «какую карту взять»', /какую карту взять/.test(await sheet()));
  await pick(/Торговец пряностями/); await p.waitForTimeout(600); await myTurn();
  const s4 = await me(() => { const V = window.__VD, S = V.S, a = S.players[V.ME]; return { hand: a.hand.includes('spicer'), row: S.courtRow[0] }; });
  ok('Ортензия: обмен сделан', s4.hand && s4.row === 'scribe', JSON.stringify(s4));
  await closeAll();
  // 5. Гертруда: два ритуала; кнопка «Начать второй ритуал»
  await me(() => { const V = window.__VD, S = V.S, a = S.players[V.ME]; S.faithRow[0] = 'grain'; a.faiths = ['grain']; a.lords = ['gertrude']; a.sins = []; a.ritual = null; a.ritual2 = null; a.miracles = []; V.redraw(); });
  await p.waitForTimeout(400);
  await p.click('.myb'); await p.waitForTimeout(700);
  await me(() => { const s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); const b = s && s.querySelector('[data-act="ritstart"][data-id="grain_a"]'); if (b) b.click(); }); await p.waitForTimeout(700); await myTurn();
  await p.click('.myb'); await p.waitForTimeout(700);
  const s5 = await me(() => { const s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); const b = s && s.querySelector('[data-act="ritstart"][data-id="grain_b"]'); return b ? b.innerText : null; });
  ok('Гертруда: «Начать второй ритуал»', /второй ритуал/.test(s5 || ''), s5);
  await me(() => { const s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); const b = s && s.querySelector('[data-act="ritstart"][data-id="grain_b"]'); if (b) b.click(); }); await p.waitForTimeout(700); await myTurn();
  await p.click('.myb'); await p.waitForTimeout(700);
  const s6 = await me(() => { const V = window.__VD, a = V.S.players[V.ME], s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); return { r1: a.ritual && a.ritual.id, r2: a.ritual2 && a.ritual2.id, blocks: s ? s.querySelectorAll('.ritw').length : 0, acts: s ? [...s.querySelectorAll('[data-act="ritact"]')].map(x => x.dataset.s).join(',') : '', badge: (document.querySelector('.myb') || {}).innerText || '' }; });
  ok('Гертруда: два ритуала идут, на «Дворе» оба', s6.r1 === 'grain_a' && s6.r2 === 'grain_b' && s6.blocks === 2 && /ritual2/.test(s6.acts), JSON.stringify(s6));
  ok('кнопка «Двор»: отметки обоих ритуалов', (s6.badge.match(/✨/g) || []).length === 2, s6.badge);
  await closeAll();
  // 6. Климент: после броска — снять проклятие бесплатно
  await me(() => { const V = window.__VD, S = V.S, a = S.players[V.ME]; a.lords = ['clement']; a.estates.push({ uid: S.uid++, id: 'evileye', by: 1 }); V.redraw(); });
  await p.evaluate(() => { const r = document.querySelector('.abar [data-act="roll"][data-n="2"]') || document.querySelector('.abar [data-act="roll"]'); if (r) r.click(); }); await p.waitForTimeout(2600);
  await p.evaluate(() => { const b = document.querySelector('.abar [data-act="adj-ok"]'); if (b) b.click(); }); await p.waitForTimeout(900); await myTurn();
  const b0 = await me(() => window.__VD.S.players[window.__VD.ME].turn.buysUsed);
  await p.click('.myb'); await p.waitForTimeout(700);
  const s7 = await me(() => { const s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); const b = s && s.querySelector('[data-act="purge"]'); return b ? `${b.innerText}:${b.disabled}` : null; });
  ok('Климент: «Снять · бесплатно»', /бесплатно:false/.test(s7 || ''), s7);
  await p.click('.scrim:not(.out) [data-act="purge"]'); await p.waitForTimeout(700); await myTurn();
  const s8 = await me(() => { const V = window.__VD, a = V.S.players[V.ME]; return { bad: a.estates.some(e => DATA.ESTATES[e.id].bad), used: a.turn.buysUsed }; });
  ok('Климент: проклятие снято, действие не потрачено', !s8.bad && s8.used === b0, JSON.stringify(s8));
  await closeAll();
  // 7. окна вопросов: Вольфрада и Мирон
  await me(() => { const V = window.__VD, a = V.S.players[V.ME]; a.greats = ['wolfrada']; a.vassals = ['miron']; window.__q7 = V.ask({ type: 'freeSiege', bonus: 4, fee: 3, options: [{ i: 1 - V.ME, p: 0.42, A: 9, D: 10, loot: 2, gold: 5 }] }); });
  await p.waitForTimeout(500);
  const t7 = await sheet();
  ok('Вольфрада: окно — напасть или не нападать', /бесплатное нападение \+4/.test(t7) && /Не нападать/.test(t7) && /42%/.test(t7), t7.slice(0, 160));
  await pick(/Не нападать/); await p.waitForTimeout(300);
  ok('Вольфрада: «Не нападать» → -1', (await p.evaluate(() => window.__q7)) === -1);
  await me(() => { window.__q8 = window.__VD.ask({ type: 'dream', cards: ['collector'] }); }); await p.waitForTimeout(500);
  const t8 = await sheet();
  ok('Мирон: окно «Верхняя карта колоды»', /Верхняя карта колоды/.test(t8) && /Мирон Звездочёт/.test(t8) && /колоды двора/.test(t8), t8.slice(0, 160));
  await me(() => { const s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); const b = s && s.querySelector('[data-ok]'); if (b) b.click(); }); await p.waitForTimeout(300);
  ok('ошибок на странице нет', !errs.length, errs.join(' | '));
  console.log(res.join('\n'));
  await b.close();
})();
