// v10.17: подсказки хода. Карта веры на столе (светится, нажатие — лист веры с кнопкой обряда), строка «Ещё можно» и пузырь «Не сделано» у «Завершить?»,
// окно броска: доход всех и «Свернуть» (рука видна, вернуть — «Изменить»), «Начать ритуал» с карты ритуала, лёжа — кнопки в строке хода.
// node hints.js [file]
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
  const closeAll = async () => { await p.evaluate(() => { for (const s of document.querySelectorAll('.page, .scrim')) if (s.close) s.close(); }); await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(350); };
  const sheet = () => p.evaluate(() => { const s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); return s ? s.innerText.replace(/\s+/g, ' ') : ''; });
  ok('мой ход', await myTurn());
  await p.waitForTimeout(400);
  // вера Провидца, чудо «Перст судьбы» (первый ритуал пройден), второй ритуал можно начать; у соперника — Земли и Набег
  await p.evaluate(() => { const V = window.__VD, me = V.S.players[V.ME], op = V.S.players[1 - V.ME];
    me.faiths = ['seer']; me.miracles = ['seer_a']; me.sins = []; me.gold = 20; me.forceDice = null;
    me.estates = me.estates.filter(e => !DATA.ESTATES[e.id].bad); // проклятие от соперника в первый ход (Проклятая реликвия глушит веру, Сглаз — второй кубик) сбило бы проверку
    for (const id of ['field', 'pasture', 'meadery', 'runestone', 'shrine', 'mine', 'orchard', 'barracks']) op.estates.push({ uid: V.S.uid++, id });
    V.redraw(); });
  await p.waitForTimeout(400);
  // 1. стол: карта веры светится, строка «Ещё можно», «Двор» светится
  const s1 = await p.evaluate(() => { const t = document.querySelector('.tiles.own .tile.t-faith'); return { tile: t ? t.className : null, lab: t ? t.innerText.replace(/\s+/g, ' ') : '', ex: [...document.querySelectorAll('.exline [data-act="ex"]')].map(x => x.dataset.k).join(','), myb: (document.querySelector('.myb') || {}).className || '' }; });
  ok('карта веры на столе светится: обряд доступен', /glow/.test(s1.tile || '') && /обряд/.test(s1.lab), JSON.stringify(s1));
  ok('«Ещё можно»: обряд и начать ритуал; «Двор» светится', s1.ex === 'rite,ritstart' && /glow/.test(s1.myb), JSON.stringify(s1));
  // 2. кнопка «начать ритуал» в строке — открывает «Двор» на ритуалах
  if (!(await p.$('.exline [data-act="ex"][data-k="ritstart"]'))) { ok('кнопка «начать ритуал» в строке', false, await p.evaluate(() => { const V = window.__VD, me = V.S.players[V.ME]; return JSON.stringify({ est: me.estates.map(e => e.id), sins: me.sins, faiths: me.faiths }); })); console.log(res.join('\n')); await b.close(); return; }
  await p.click('.exline [data-act="ex"][data-k="ritstart"]'); await p.waitForTimeout(700);
  const s2 = await p.evaluate(() => ({ starts: document.querySelectorAll('.scrim:not(.out) [data-act="ritstart"]').length, h: [...document.querySelectorAll('.scrim:not(.out) .sec-h h3')].some(x => /Ритуал/.test(x.innerText)) }));
  ok('«начать ритуал» в строке → «Двор», раздел ритуалов', s2.h && s2.starts >= 1, JSON.stringify(s2));
  await closeAll();
  // 3. окно броска: доход, «Свернуть» — рука видна, «Изменить» внизу возвращает окно
  await p.evaluate(() => { const r = document.querySelector('.abar [data-act="roll"][data-n="2"]'); if (r) r.click(); }); await p.waitForTimeout(2600);
  const s3 = await p.evaluate(() => ({ adj: !!document.querySelector('.handz .adjp'), min: !!document.querySelector('.adjp [data-act="adj-min"]'), set: !!document.querySelector('[data-act="adj-setsheet"]') }));
  ok('окно броска: «Свернуть» и «Перст судьбы»', s3.adj && s3.min && s3.set, JSON.stringify(s3));
  if (s3.adj) {
    await p.click('[data-act="adj-min"]'); await p.waitForTimeout(500);
    const s4 = await p.evaluate(() => ({ adj: !!document.querySelector('.handz .adjp'), cards: document.querySelectorAll('.handz .hcard').length, back: [...document.querySelectorAll('.abar button')].map(x => x.dataset.act).join(',') }));
    ok('свёрнуто: рука видна, внизу «Изменить» и «Оставить»', !s4.adj && s4.cards > 0 && /adj-max,adj-ok/.test(s4.back), JSON.stringify(s4));
    await p.click('.abar [data-act="adj-max"]'); await p.waitForTimeout(500);
    ok('«Изменить» вернуло окно броска', await p.evaluate(() => !!document.querySelector('.handz .adjp')));
    // «Перст судьбы»: в листе — доход всех по каждому варианту; «Свернуть» закрывает лист, окно броска остаётся
    await p.click('[data-act="adj-setsheet"]'); await p.waitForTimeout(500);
    const sh = await sheet();
    ok('«Перст судьбы»: варианты с доходом («вам …»)', /Перст судьбы/.test(sh) && /вам [+−0]/.test(sh) && /Свернуть/.test(sh), sh.slice(0, 120));
    await p.evaluate(() => { const o = [...document.querySelectorAll('.scrim:not(.out) .optlist [data-v]')].pop(); if (o) o.click(); }); await p.waitForTimeout(600);
    const s5 = await p.evaluate(() => ({ adj: !!document.querySelector('.handz .adjp'), open: document.querySelectorAll('.scrim:not(.out)').length }));
    ok('«Свернуть — посмотреть стол»: лист закрыт, бросок не изменён', s5.adj && !s5.open, JSON.stringify(s5));
    await p.click('.abar [data-act="adj-ok"]'); await p.waitForTimeout(1500);
  }
  ok('бросок завершён', await myTurn());
  // 4. «Завершить ход»: первое нажатие — «Завершить?» и пузырь «Не сделано: … ещё можно: обряд»
  await p.evaluate(() => { const e = document.querySelector('.abar [data-act="end"]'); if (e) e.click(); }); await p.waitForTimeout(400);
  const s6 = await p.evaluate(() => { const w = document.querySelector('.abar .primary.warn'); const n = w && w.querySelector('.armnote'); const sp = w && w.querySelector('span'); return { w: !!w, note: n ? n.innerText : '', fits: sp ? sp.scrollWidth <= sp.clientWidth + 1 : false, turn: window.__VD.isMyTurn() }; });
  ok('«Завершить?»: ход не кончился, пузырь «Не сделано … ещё можно: обряд»', s6.w && s6.turn && /Не сделано/.test(s6.note) && /ещё можно: обряд/.test(s6.note), JSON.stringify(s6));
  ok('«Завершить?» влезает в кнопку на iPhone', s6.fits, JSON.stringify(s6));
  await p.waitForTimeout(4300);
  // 5. нажатие на карту веры — лист веры с кнопкой «Провести обряд» (ответ владельца 2.3); кнопка — обряд без подтверждения
  const g0 = await p.evaluate(() => window.__VD.S.players[window.__VD.ME].gold);
  await p.click('.tiles.own .tile.t-faith'); await p.waitForTimeout(700);
  const s6b = await p.evaluate(() => { const V = window.__VD, me = V.S.players[V.ME], s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); const b = s && s.querySelector('[data-act="rite-go"]'); return { open: !!s, btn: b ? b.innerText + ':' + b.disabled : null, rite: !!(me.turn.rites && me.turn.rites.seer) }; });
  ok('карта веры: нажатие — лист веры с кнопкой «Провести обряд», обряда ещё нет', s6b.open && /Провести обряд/.test(s6b.btn || '') && /false$/.test(s6b.btn || '') && !s6b.rite, JSON.stringify(s6b));
  await p.click('.scrim:not(.out) [data-act="rite-go"]'); await p.waitForTimeout(1200); await myTurn();
  const s7 = await p.evaluate(() => { const V = window.__VD, me = V.S.players[V.ME], t = document.querySelector('.tiles.own .tile.t-faith'); return { rite: !!(me.turn.rites && me.turn.rites.seer), gold: me.gold, open: document.querySelectorAll('.scrim:not(.out)').length, tile: t ? t.className : '', lab: t ? t.innerText.replace(/\s+/g, ' ') : '', ex: [...document.querySelectorAll('.exline [data-act="ex"]')].map(x => x.dataset.k).join(',') }; });
  ok('«Провести обряд»: обряд (−1🪙), лист закрыт, подсветка погасла', s7.rite && s7.gold === g0 - 1 && !s7.open && !/glow/.test(s7.tile) && /обряд ✓/.test(s7.lab) && s7.ex === 'ritstart', JSON.stringify(s7));
  await p.click('.tiles.own .tile.t-faith'); await p.waitForTimeout(700);
  const s8 = await p.evaluate(() => { const s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); const rg = s && s.querySelector('[data-act="rite-go"]'); return s ? { t: /Око Провидца/.test(s.innerText), btn: [...s.querySelectorAll('[data-act="ritstart"]')].map(x => x.dataset.id + ':' + x.disabled).join(','), done: /чудо ваше/.test(s.innerText), rite: rg ? rg.innerText + ':' + rg.disabled : null } : null; });
  ok('обряд уже был — в листе веры кнопка обряда выключена, «Начать ритуал» под вторым ритуалом', s8 && s8.t && s8.btn === 'seer_b:false' && s8.done && /уже был/.test(s8.rite || '') && /true$/.test(s8.rite || ''), JSON.stringify(s8));
  // 6. карта ритуала крупно — там тоже «Начать ритуал»; начинаем
  await p.evaluate(() => { const s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); const c = s && s.querySelector('[data-act="zoom"][data-kind="ritual"][data-id="seer_b"]'); if (c) c.click(); }); await p.waitForTimeout(700);
  const s9 = await sheet();
  ok('лист ритуала: кнопка «Начать ритуал»', /Вещие сны/.test(s9) && /Начать ритуал/.test(s9), s9.slice(0, 100));
  await p.evaluate(() => { const s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); const b2 = s && s.querySelector('[data-act="ritstart"][data-id="seer_b"]'); if (b2) b2.click(); }); await p.waitForTimeout(900);
  const s10 = await p.evaluate(() => { const V = window.__VD, me = V.S.players[V.ME]; return { r: me.ritual && me.ritual.id, open: document.querySelectorAll('.scrim:not(.out)').length, badge: (document.querySelector('.myb') || {}).innerText || '' }; });
  ok('ритуал начат с его карты, листы закрыты, на «Дворе» ✨0/5', s10.r === 'seer_b' && !s10.open && /✨0\/5/.test(s10.badge), JSON.stringify(s10));
  const s11 = await p.evaluate(() => { const x = document.createElement('div'); x.innerHTML = window.__VD.infoParts({ act: 'zoom', kind: 'ritual', id: 'seer_b' }).body; return x.innerText.replace(/\s+/g, ' '); });
  ok('лист идущего ритуала: «Ритуал идёт: отметок 0 из 5»', /Ритуал идёт: отметок 0 из 5/.test(s11), s11.slice(0, 80));
  // 7. «взять из сброса» (Летописец при дворе): сброс светится, кнопка в строке открывает сброс с «В руку»
  await p.evaluate(() => { const V = window.__VD, me = V.S.players[V.ME]; me.seats = ['chronicler']; if (!me.discard.length) me.discard.push('tax'); V.redraw(); });
  await p.waitForTimeout(500);
  const s13 = await p.evaluate(() => ({ ex: [...document.querySelectorAll('.exline [data-act="ex"]')].map(x => x.dataset.k).join(','), disc: (document.querySelector('.handz .pile.disc') || {}).className || '' }));
  ok('Летописец: «взять из сброса» в строке, сброс светится', /fetch/.test(s13.ex) && /glow/.test(s13.disc), JSON.stringify(s13));
  if (/fetch/.test(s13.ex)) {
    await p.click('.exline [data-act="ex"][data-k="fetch"]'); await p.waitForTimeout(700);
    const s14 = await p.evaluate(() => { const s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); return s ? { t: /Сброс двора/.test(s.innerText), take: s.querySelectorAll('[data-act="fetch"]').length } : null; });
    ok('«взять из сброса» → лист сброса с кнопками «В руку»', !!s14 && s14.t && s14.take > 0, JSON.stringify(s14));
    await closeAll();
  }
  // 8. колода и сброс соперника (v10.18): лист соперника → «Сброс» (открыт) и «Колода и рука» (рука не выдаётся)
  await closeAll();
  const oc = await p.evaluate(() => { const V = window.__VD, op = V.S.players[1 - V.ME]; op.discard = ['spicer', 'collector', 'tax']; op.inPlay = []; V.redraw(); return { dh: op.deck.length + op.hand.length }; });
  await p.waitForTimeout(300); await p.click('.pbar.foe [data-act="opp"]'); await p.waitForTimeout(700);
  const ob = await p.evaluate(() => { const s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); return s ? [...s.querySelectorAll('[data-act="pile"]')].map(x => x.dataset.w).join(',') : ''; });
  ok('лист соперника: стопки «Сброс» и «Колода и рука»', /discard/.test(ob) && /deckhand/.test(ob), ob);
  await p.click('.scrim:not(.out) [data-act="pile"][data-w="discard"]'); await p.waitForTimeout(600);
  const od = await p.evaluate(() => { const s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); return s ? s.innerText.replace(/\s+/g, ' ') : ''; });
  ok('сброс соперника: его карты', /Сброс двора/.test(od) && /Торговец пряностями/.test(od) && /Сборщик податей/.test(od), od.slice(0, 80));
  await p.evaluate(() => { const s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); if (s && s.close) s.close(); }); await p.waitForTimeout(500);
  await p.click('.scrim:not(.out) [data-act="pile"][data-w="deckhand"]'); await p.waitForTimeout(600);
  const odh = await p.evaluate(() => { const s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); return s ? { t: s.innerText.replace(/\s+/g, ' ').slice(0, 120), n: [...s.querySelectorAll('.pmeta')].reduce((t, x) => t + (+(x.innerText.match(/×(\d+)/) || [0, 0])[1]), 0) } : null; });
  ok('«Колода и рука» соперника: колода и рука вместе, рука не выдаётся', !!odh && /Колода и рука/.test(odh.t) && /не видно/.test(odh.t) && odh.n === oc.dh, JSON.stringify(odh) + ' ждали ' + oc.dh);
  await closeAll();
  // 9. лёжа: «Ещё можно» — в строке хода, внизу центра места не держим
  await p.setViewportSize({ width: 852, height: 393 }); await p.waitForTimeout(900);
  const s12 = await p.evaluate(() => { const r = document.querySelector('.turnrow .exr'); return { row: r ? [...r.querySelectorAll('[data-act="ex"]')].map(x => x.innerText.trim()).join('|') : null, foot: !!document.querySelector('.cfoot .exline'), clip: r ? r.scrollWidth > r.clientWidth + 1 : null }; });
  ok('лёжа: кнопки в строке хода, коротко и без обрезки', s12.row && /ритуал/.test(s12.row) && !s12.foot && s12.clip === false, JSON.stringify(s12));
  console.log(res.join('\n')); console.log('ошибки', errs.slice(0, 5));
  await b.close();
})();
