// v10.14: проклятия и козни на экране партии. Купить проклятие на рынке — выбрать, кому подбросить (шпионаж), — оно у соперника;
// своё проклятие снять на странице «Двор» (действие и 2🪙); сыграть козни из руки — шпионаж, после карта уходит в колоду двора.
// node curses.js [file]
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
  const idle = async () => { for (let i = 0; i < 80; i++) { if (await p.evaluate(() => !window.__VD.busy && !document.querySelector('.cpop.duel'))) return; await p.waitForTimeout(100); } };
  ok('мой ход', await myTurn());
  await p.waitForTimeout(400);

  // 1. купить проклятие «Заговор» и подбросить сопернику
  await p.evaluate(() => { const V = window.__VD, S = V.S, me = S.players[V.ME]; me.gold = 40; S.estateRow[0] = 'schemer'; V.redraw(); });
  await p.evaluate(() => { const r = [...document.querySelectorAll('.abar [data-act="roll"]')].pop(); if (r) r.click(); }); await p.waitForTimeout(2500); await idle();
  await p.evaluate(() => { const V = window.__VD; V.S.players[V.ME].temp.int = 60; V.redraw(); });
  await p.click('.abar [data-act="drawer"][data-d="market"]'); await p.waitForTimeout(450);
  const card = await p.evaluate(() => { const c = document.querySelector('.drawer .mcard[data-id="schemer"]'); if (!c) return false; c.click(); return true; });
  await p.waitForTimeout(500);
  const bar = await p.evaluate(() => { const x = document.querySelector('.scrim:not(.out) .buybar [data-buyproxy]'); return x ? { text: x.innerText.replace(/\s+/g, ' '), off: x.disabled } : null; });
  ok('проклятие на рынке: лист с кнопкой покупки', card && bar && !bar.off, JSON.stringify(bar));
  if (bar && !bar.off) await p.click('.scrim:not(.out) .buybar [data-buyproxy]');
  const ask = await waitSheet(/Кому подбросить|Шпионаж|шпион/);
  ok('выбор цели: шпионаж, что сделает проклятие', /Кому подбросить «Заговор»/.test(ask) && /Шпионаж/.test(ask) && /не нанимает знамёна/.test(ask), ask.slice(0, 160));
  await p.evaluate(() => { const o = document.querySelector('.scrim:not(.out) .optlist [data-v]'); if (o) o.click(); });
  await p.waitForTimeout(1800); await idle();
  const st1 = await p.evaluate(() => { const V = window.__VD, S = V.S, me = S.players[V.ME], op = S.players[1 - V.ME]; return { op: op.estates.filter(e => e.id === 'schemer').map(e => e.by), me: me.estates.some(e => e.id === 'schemer'), log: S.log.slice(-8).map(x => x.t || x.text || '').join(' | ') }; });
  ok('«Заговор» у соперника, подбросили мы', st1.op.length === 1 && st1.op[0] === await p.evaluate(() => window.__VD.ME) && !st1.me, JSON.stringify(st1).slice(0, 200));

  // 2. снять своё проклятие на странице «Двор»
  await p.evaluate(() => { const V = window.__VD, S = V.S, me = S.players[V.ME]; me.estates.push({ uid: S.uid++, id: 'blight', by: 1 - V.ME }); me.turn.buysUsed = 0; me.gold = 30; V.redraw(); });
  await p.waitForTimeout(300);
  await p.click('.myb[data-act="my"]'); await p.waitForTimeout(600);
  const pb = await p.evaluate(() => { const x = document.querySelector('[data-act="purge"]'); const h = [...document.querySelectorAll('.sec-h h3')].map(e => e.innerText).join('|'); return x ? { text: x.innerText, off: x.disabled, h } : { h }; });
  ok('«Двор»: раздел «Проклятия» и кнопка «Снять · 2🪙»', pb.text && /Снять/.test(pb.text) && !pb.off && /Проклятия/.test(pb.h), JSON.stringify(pb));
  const g0 = await p.evaluate(() => window.__VD.S.players[window.__VD.ME].gold);
  if (pb.text) await p.click('[data-act="purge"]');
  await p.waitForTimeout(800);
  const st2 = await p.evaluate(() => { const V = window.__VD, me = V.S.players[V.ME]; return { blight: me.estates.some(e => e.id === 'blight'), gold: me.gold, deck: V.S.estateDeck.includes('blight') }; });
  ok('проклятие снято: −2🪙, оно в колоде владений', !st2.blight && st2.gold === g0 - 2 && st2.deck, JSON.stringify(st2));
  await p.evaluate(() => { for (const s of document.querySelectorAll('.page, .scrim')) if (s.close) s.close(); });
  await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(400);

  // 3. сыграть козни «Поджог»: шпионаж, соперник теряет 4🪙, карта уходит в колоду двора
  await p.evaluate(() => { const V = window.__VD, S = V.S, me = S.players[V.ME], op = S.players[1 - V.ME]; me.hand.push('arson'); me.temp.int = 60; op.gold = 10; window.__arson0 = S.courtDeck.filter(x => x === 'arson').length; V.redraw(); });
  await p.waitForTimeout(500);
  await p.evaluate(() => { const c = [...document.querySelectorAll('.handz .hcard[data-act="sel"]')].find(x => x.dataset.id === 'arson'); if (c) c.click(); });
  await p.waitForTimeout(400);
  const playTxt = await p.evaluate(() => { const x = document.querySelector('.abar [data-act="play"]'); return x ? x.innerText.replace(/\s+/g, ' ') : ''; });
  ok('рука: «Поджог» — кнопка «Сыграть» со шпионажем', /удача — соперник теряет 4/.test(playTxt) || /Сыграть|Подослать|шпион/i.test(playTxt), playTxt);
  await p.evaluate(() => { const x = document.querySelector('.abar [data-act="play"]'); if (x) x.click(); });
  const ask2 = await waitSheet(/Шпионаж|поджог/i);
  ok('выбор цели козней: «поджог: −4🪙»', /поджог/i.test(ask2) && /теряют 4/.test(ask2), ask2.slice(0, 160));
  await p.evaluate(() => { const o = document.querySelector('.scrim:not(.out) .optlist [data-v]'); if (o) o.click(); });
  await p.waitForTimeout(1800); await idle();
  const st3 = await p.evaluate(() => { const V = window.__VD, S = V.S, me = S.players[V.ME], op = S.players[1 - V.ME]; return { opGold: op.gold, mine: [...me.hand, ...me.inPlay, ...me.discard].includes('arson'), deck: S.courtDeck.filter(x => x === 'arson').length - window.__arson0 }; });
  ok('Поджог: соперник −4🪙, карта ушла в колоду двора', st3.opGold === 6 && !st3.mine && st3.deck === 1, JSON.stringify(st3));

  // 4. листы карт: у проклятия — как снять, у козней — что карта уходит в колоду двора
  const sheetOf = (d) => p.evaluate((d) => { const x = document.createElement('div'); const parts = window.__VD.infoParts(d); x.innerHTML = parts.body; return x.innerText.replace(/\s+/g, ' '); }, d);
  const ic = await sheetOf({ act: 'info-estate', id: 'falsetax' }), ik = await sheetOf({ act: 'info-court', id: 'denounce' });
  ok('лист проклятия: «Проклятие», «действует всегда», «Снять», «Как снять»', /Проклятие/i.test(ic) && /действует всегда/.test(ic) && /Снять/.test(ic) && /Как снять/.test(ic), ic.slice(0, 120));
  ok('лист козней: «Козни», шпионаж, «уходит в колоду двора»', /Козни/i.test(ik) && /шпионаж/i.test(ik) && /колоду двора/.test(ik), ik.slice(0, 120));
  await p.screenshot({ path: SP + 'v10/curses-end.png' });
  console.log(res.join('\n')); console.log('ошибки', errs.slice(0, 5));
  await b.close();
})();
