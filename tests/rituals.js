// v10.16: ритуалы на экране партии. «Двор» → раздел «Ритуалы»: начать ритуал своей веры, подать милостыню и принести жертву
// кнопкой, отметки и значок ✨ на кнопке «Двор»; чудо «Перст судьбы» в окне броска; ритуалы в каталоге и на листе веры.
// node rituals.js [file]
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
const FILE = process.argv[2] || (SP + 'test-embed.html');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); p.setDefaultTimeout(5000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const res = []; const ok = (name, cond, info) => res.push(`${cond ? 'OK ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`);
  // v10.22: соперник — любой Дом, кроме Розы: её Тайная канцелярия шпионит в начале её хода, и окно откупа открылось бы ещё до вашего хода
  const OPP = ['deer', 'owl', 'wolf', 'serpent', 'bear', 'lion', 'sun'].filter(h => h !== 'deer')[Math.floor(Math.random() * 6)];
  await p.addInitScript((opp) => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: 'deer', seats: [{ type: 'bot', house: opp }], opps: 1, speed: 'turbo', mods: ['lords', 'faith', 'plots', 'seats', 'sieges', 'spy'], tut: 0, coins: false, sound: false, music: false })); } catch (e) {} }, OPP);
  await p.goto('file://' + FILE); await p.waitForSelector('#splash', { state: 'detached', timeout: 6000 }).catch(() => {});
  // каталог: у каждой веры — два ритуала
  await p.click('[data-act="catalog"]'); await p.waitForTimeout(600);
  await p.click('[data-seg="table"]'); await p.waitForTimeout(400);
  const cat = await p.evaluate(() => document.querySelectorAll('.catbody [data-kind="ritual"]').length);
  ok('каталог «Стол»: 16 ритуалов у вер', cat === 16, `${cat}`);
  await p.evaluate(() => { for (const s of document.querySelectorAll('.page, .scrim')) if (s.close) s.close(); }); await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(400);
  await p.click('[data-act="setup"]'); await p.waitForTimeout(300); await p.click('[data-act="start"]');
  const myTurn = async () => { for (let i = 0; i < 300; i++) { if (await p.evaluate(() => window.__VD.isMyTurn() && !window.__VD.busy && !document.body.classList.contains('dealing'))) return true; await p.waitForTimeout(100); } return false; };
  const closeAll = async () => { await p.evaluate(() => { for (const s of document.querySelectorAll('.page, .scrim')) if (s.close) s.close(); }); await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(350); };
  const openMy = async () => { await closeAll(); await p.click('.myb[data-act="my"]'); await p.waitForTimeout(600); };
  ok('мой ход', await myTurn());
  await p.waitForTimeout(400);
  // 1. вера Колоса: на «Дворе» — раздел «Ритуалы» с двумя картами и кнопками «Начать»
  await p.evaluate(() => { const V = window.__VD, me = V.S.players[V.ME]; me.faiths = ['grain']; me.gold = 30; me.hand = ['tax', 'tax', 'tax']; me.estates = me.estates.filter(e => DATA.ESTATES[e.id].t !== 'land'); V.redraw(); });
  await openMy();
  const s1 = await p.evaluate(() => { const h = [...document.querySelectorAll('.sec-h h3')].map(e => e.innerText).join('|'); return { h, start: [...document.querySelectorAll('[data-act="ritstart"]')].map(x => ({ id: x.dataset.id, off: x.disabled, t: x.innerText })) }; });
  ok('«Двор»: раздел «Ритуалы», две кнопки «Начать ритуал»', /Ритуалы/.test(s1.h) && s1.start.length === 2 && s1.start.every(x => !x.off && /Начать ритуал/.test(x.t)), JSON.stringify(s1.start));
  // 2. начать «Великую жатву»
  await p.click('[data-act="ritstart"][data-id="grain_a"]'); await p.waitForTimeout(700);
  const s2 = await p.evaluate(() => { const V = window.__VD, me = V.S.players[V.ME]; return { r: me.ritual && me.ritual.id, badge: (document.querySelector('.myb') || {}).innerText || '' }; });
  ok('ритуал начат, на кнопке «Двор» — ✨0/5', s2.r === 'grain_a' && /✨0\/5/.test(s2.badge), JSON.stringify(s2));
  await openMy();
  const s3 = await p.evaluate(() => ({ rows: document.querySelectorAll('.ritl li').length, acts: [...document.querySelectorAll('[data-act="ritact"]')].map(x => ({ i: x.dataset.i, off: x.disabled, t: x.innerText })) }));
  ok('«Двор»: пять условий, кнопки «Принести» и «Подать»', s3.rows === 5 && s3.acts.length === 2 && s3.acts.every(x => !x.off), JSON.stringify(s3));
  // 3. милостыня кнопкой: 5🪙 сопернику
  const op0 = await p.evaluate(() => window.__VD.S.players[1 - window.__VD.ME].gold);
  await p.click('[data-act="ritact"][data-i="4"]'); await p.waitForTimeout(700);
  const s4 = await p.evaluate(() => { const V = window.__VD, me = V.S.players[V.ME], op = V.S.players[1 - V.ME]; return { m: me.ritual.marks, gold: me.gold, op: op.gold }; });
  ok('милостыня: 5🪙 сопернику, отметка', s4.m[4] && s4.gold === 25 && s4.op === op0 + 5, JSON.stringify(s4));
  // 4. жертва кнопкой: выбрать 2 карты в листе очищения
  await openMy();
  await p.click('[data-act="ritact"][data-i="0"]'); await p.waitForTimeout(600);
  const sheet = await p.evaluate(() => { const s = document.querySelector('.scrim:not(.out)'); return s ? s.innerText.replace(/\s+/g, ' ') : ''; });
  ok('жертва: лист выбора карт', /Великая жатва/.test(sheet) && /жертва/.test(sheet), sheet.slice(0, 90));
  await p.evaluate(() => { const bs = document.querySelectorAll('.scrim:not(.out) .optlist [data-i]'); bs[0].click(); }); await p.waitForTimeout(150);
  await p.evaluate(() => { const bs = document.querySelectorAll('.scrim:not(.out) .optlist [data-i]'); bs[1].click(); }); await p.waitForTimeout(150);
  await p.evaluate(() => { const okb = document.querySelector('.scrim:not(.out) [data-ok]'); if (okb) okb.click(); }); await p.waitForTimeout(700);
  const s5 = await p.evaluate(() => { const V = window.__VD, me = V.S.players[V.ME]; return { m: me.ritual.marks, hand: me.hand.length, badge: (document.querySelector('.myb') || {}).innerText || '' }; });
  ok('жертва: 2 карты из игры, отметок 2 из 5', s5.m[0] && s5.hand === 1 && /✨2\/5/.test(s5.badge), JSON.stringify(s5));
  await closeAll();
  // 5. лист ритуала: правила под картой
  const ls = await p.evaluate(() => { const x = document.createElement('div'); x.innerHTML = window.__VD.infoParts({ act: 'zoom', kind: 'ritual', id: 'grain_a' }).body; return x.innerText.replace(/\s+/g, ' '); });
  ok('лист ритуала: карта, «Начать», «Грех»', /Великая жатва/.test(ls) && /Начать/.test(ls) && /Грех/.test(ls), ls.slice(0, 120));
  const lf = await p.evaluate(() => { const x = document.createElement('div'); x.innerHTML = window.__VD.infoParts({ act: 'zoom', kind: 'faith', id: 'grain' }).body; return x.innerText.replace(/\s+/g, ' '); });
  ok('лист веры: её два ритуала', /Ритуалы/.test(lf) && /Хлебный дар/.test(lf) && /Великая жатва/.test(lf), lf.slice(-140));
  // 6. чудо «Перст судьбы»: в окне броска — кнопка, лист вариантов, кубик повёрнут
  await p.evaluate(() => { const V = window.__VD, me = V.S.players[V.ME]; me.faiths = ['seer']; me.ritual = null; me.miracles = ['seer_a']; me.turn.rolled = false; V.redraw(); });
  await p.waitForTimeout(400);
  await p.evaluate(() => { const r = document.querySelector('.abar [data-act="roll"][data-n="2"]'); if (r) r.click(); }); await p.waitForTimeout(2400);
  const hasSet = await p.evaluate(() => !!document.querySelector('[data-act="adj-setsheet"]'));
  ok('Перст судьбы: кнопка в окне броска', hasSet);
  if (hasSet) {
    await p.click('[data-act="adj-setsheet"]'); await p.waitForTimeout(500);
    const sh = await p.evaluate(() => { const s = document.querySelector('.scrim:not(.out)'); return s ? s.innerText.replace(/\s+/g, ' ') : ''; });
    await p.evaluate(() => { const o = document.querySelector('.scrim:not(.out) .optlist [data-v="0"]'); if (o) o.click(); }); await p.waitForTimeout(1600);
    const st = await p.evaluate(() => { const V = window.__VD, me = V.S.players[V.ME]; return { used: !!me.turn.setUsed, rolled: me.turn.rolled }; });
    ok('Перст судьбы: лист вариантов, кубик повёрнут', /Перст судьбы/.test(sh) && st.used, JSON.stringify(st) + ' ' + sh.slice(0, 80));
  }
  console.log(res.join('\n')); console.log('ошибки', errs.slice(0, 5));
  await b.close();
})();
