// v10.19: новые окна по сети — хозяин и гость в двух страницах, брокер MQTT здесь же. Гость проходит окна ритуалов и грехов,
// «Перст судьбы» и покаяние: окно приходит на устройство гостя, ответ доходит до хозяина, стол у обоих сходится.
// v10.21: долг Клары, «сбросить и взять» Евстафия и обмен Ортензии — с устройства гостя.
// node netwin.js
const { chromium } = require('playwright');
const { wsServer: WSS } = require(require.resolve('playwright-core/lib/utilsBundle', { paths: [require.resolve('playwright')] }));
const SP = require('path').join(__dirname, '..', '.work') + '/';
function broker() {
  const wss = new WSS({ port: 0, handleProtocols: () => 'mqtt' });
  const subs = new Map();
  wss.on('connection', (ws) => {
    let buf = Buffer.alloc(0);
    ws.on('message', (data) => {
      buf = Buffer.concat([buf, Buffer.from(data)]);
      for (;;) {
        if (buf.length < 2) return;
        let len = 0, mul = 1, i = 1, b;
        do { if (i >= buf.length) return; b = buf[i++]; len += (b & 127) * mul; mul *= 128; } while (b & 128);
        if (buf.length < i + len) return;
        const first = buf[0], body = buf.subarray(i, i + len), pkt = Buffer.from(buf.subarray(0, i + len)); buf = buf.subarray(i + len);
        const type = first >> 4;
        if (type === 1) ws.send(Buffer.from([0x20, 2, 0, 0]));
        else if (type === 8) { const tl = body.readUInt16BE(2), topic = body.subarray(4, 4 + tl).toString(); if (!subs.has(topic)) subs.set(topic, new Set()); subs.get(topic).add(ws); ws.send(Buffer.from([0x90, 3, body[0], body[1], 0])); }
        else if (type === 3) { const tl = body.readUInt16BE(0), topic = body.subarray(2, 2 + tl).toString(); for (const c of subs.get(topic) || []) if (c.readyState === 1) c.send(pkt); }
        else if (type === 12) ws.send(Buffer.from([0xD0, 0]));
      }
    });
    ws.on('close', () => { for (const s of subs.values()) s.delete(ws); });
  });
  return new Promise(res => wss.on('listening', () => res({ port: wss.address().port, close: () => wss.close() })));
}
(async () => {
  const br = await broker();
  const b = await chromium.launch();
  const mk = async (name, prefs, vp) => {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: true, isMobile: true, reducedMotion: 'reduce' }); const p = await ctx.newPage(); p.setDefaultTimeout(3000);
    p.errs = []; p.on('pageerror', e => p.errs.push(name + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|WebSocket/.test(m.text())) p.errs.push(name + ' console: ' + m.text().slice(0, 200)); });
    await p.addInitScript(([prefs, port]) => { window.PRETENDENTY_NET = { brokers: ['ws://127.0.0.1:' + port] }; try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify(prefs)); } catch (e) {} }, [prefs, br.port]);
    await p.goto('file://' + SP + 'test-embed.html');
    await p.waitForSelector('#splash', { state: 'detached', timeout: 5000 }).catch(() => {});
    return p;
  };


  const res = []; const ok = (n, v, x) => { res.push((v ? 'OK  ' : 'FAIL ') + n + (x ? ' — ' + x : '')); };
  const MODS = ['lords', 'faith', 'plots', 'seats', 'sieges', 'spy'];
  const host = await mk('хозяин', { v2: 1, v3: 1, v10: 1, house: 'deer', seats: [{ type: 'remote', house: 'owl' }], speed: 'turbo', mods: MODS, coins: false, hint: false }, { width: 393, height: 852 });
  const guest = await mk('гость', { v2: 1, v3: 1, v10: 1, house: 'owl', opps: 1, speed: 'turbo', mods: MODS, coins: false, hint: false }, { width: 393, height: 852 });
  const st = (p) => p.evaluate(() => { const V = window.__VD, S = V.S; if (!S) return null; return { me: V.ME, cur: S.cur, round: S.round, my: V.isMyTurn(), rolled: S.players[S.cur].turn.rolled, gold: S.players.map(q => q.gold) }; });
  const play = (p) => p.evaluate(() => {
    const vis = (el) => el && el.offsetParent !== null && !el.disabled, q = (s) => [...document.querySelectorAll(s)].filter(vis);
    const V = window.__VD, S = V.S; if (!S || S.winner !== null) return 'over';
    const sh = [...document.querySelectorAll('.scrim:not(.out)')].pop();
    if (sh) { const o = [...sh.querySelectorAll('[data-v]')].filter(vis); if (o.length) { o[0].click(); return 'sheet'; } const bt = [...sh.querySelectorAll('button.primary')].filter(vis)[0] || [...sh.querySelectorAll('[data-close]')].filter(vis)[0]; if (bt) bt.click(); return 'sheet'; }
    const cc = q('.board [data-act="coin-card"]'); if (cc.length) { cc[0].click(); return 'coin'; }
    for (const a of ['coin-all', 'step-ok', 'adj-ok', 'next']) { const el = q(`[data-act="${a}"]`)[0]; if (el) { el.click(); return a; } }
    if (!V.isMyTurn() || V.busy) return 'wait';
    const me = S.players[V.ME];
    if (!me.turn.rolled) { const c = q('.handz .hcard[data-act="sel"]'); if (c.length && !V.sel) { c[0].click(); return 'sel'; } const pl = q('.abar [data-act="play"]')[0]; if (pl) { pl.click(); return 'play'; } const r = q('.abar [data-act="roll"]'); if (r.length) { r[r.length - 1].click(); return 'roll'; } return 'wait'; }
    if (V.drawer) { const bb = q('.drawer .buyb.ok'); if (bb.length) { bb[0].click(); return 'buy'; } q('.drawer [data-act="drawer-close"]')[0].click(); window.__tried = 1; return 'close'; }
    if (!window.__tried) { const d = q('.abar [data-act="drawer"]')[0]; if (d) { d.click(); return 'open'; } }
    window.__tried = 0; const e = q('.abar [data-act="end"]')[0]; if (e) { e.click(); return 'end'; } return 'wait';
  });


  const both = async (until, max = 2500) => { for (let it = 0; it < max; it++) { await play(host); await play(guest); const s = await st(host); if (await until(s)) return s; await host.waitForTimeout(25); } return st(host); };
  await host.click('[data-act="setup"]'); await host.waitForTimeout(300); await host.click('[data-act="start"]'); await host.waitForTimeout(1200);
  const code = await host.evaluate(() => window.__VD.net && window.__VD.net.code);
  await guest.click('[data-act="duo"]'); await guest.waitForTimeout(300); await guest.click('[data-f="join"]'); await guest.waitForTimeout(300);
  await guest.fill('#jcode', code); await guest.fill('#jname', 'Аня'); await guest.click('[data-act="join-go"]'); await guest.waitForTimeout(1600);
  await host.click('[data-act="lobby-start"]'); await host.waitForTimeout(1500);
  const GI = await host.evaluate(() => 1 - window.__VD.ME); // место гостя у хозяина
  // ход гостя, до броска, без открытых окон
  const guestTurn = async () => {
    for (let it = 0; it < 3000; it++) {
      const s = await st(host), g = await st(guest);
      if (s && g && s.cur === GI && g.my && !s.rolled && !(await guest.evaluate(() => window.__VD.busy || !!document.querySelector('.scrim:not(.out)') || !!window.__VD.adjust))) return true;
      await play(host); if (!(s && s.cur === GI)) await play(guest); await host.waitForTimeout(25);
    }
    return false;
  };
  // правка стола у хозяина (он ведёт партию) — и сразу гостю
  const hostSet = async (fn, arg) => { await host.evaluate(([f, gi, a]) => { const V = window.__VD; (0, eval)('(' + f + ')')(V.S, V.S.players[gi], V.S.players[V.ME], a); V.netSync(); V.redraw(); }, [fn.toString(), GI, arg]); await guest.waitForTimeout(700); };
  const hostQ = (fn, arg) => host.evaluate(([f, gi, a]) => { const V = window.__VD; return (0, eval)('(' + f + ')')(V.S, V.S.players[gi], V.S.players[V.ME], a); }, [fn.toString(), GI, arg]);
  const gSheet = async (re, ms = 6000) => { for (let t = 0; t < ms; t += 150) { const x = await guest.evaluate(() => { const s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); return s ? s.innerText.replace(/\s+/g, ' ') : ''; }); if (re.test(x)) return x; await guest.waitForTimeout(150); } return ''; };
  const gClick = (sel) => guest.evaluate((sel) => { const el = [...document.querySelectorAll(sel)].pop(); if (el) { el.click(); return true; } return false; }, sel);
  const gCloseAll = async () => { await guest.evaluate(() => { for (const s of document.querySelectorAll('.page, .scrim')) if (s.close) s.close(); }); await guest.waitForTimeout(400); };
  const until = async (fn, arg, ms = 6000) => { for (let t = 0; t < ms; t += 150) { if (await hostQ(fn, arg)) return true; await host.waitForTimeout(150); } return false; };
  // завершить ход гостя: жать «Завершить», пока ход правда не перейдёт (после броска на экране гостя ещё идут анимации)
  const gEnd = async () => { for (let k = 0; k < 60; k++) { const h = await st(host); if (!h || h.cur !== GI) return true; await gCloseAll(); await guest.evaluate(() => { const e = document.querySelector('.abar [data-act="end"]'); if (e && !e.disabled && !window.__VD.busy) e.click(); }); await guest.waitForTimeout(350); } return false; };
  const seedDie = (vals) => hostSet((S, g, h, vals) => { const step = (x) => { x = (x + 0x6D2B79F5) | 0; let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return [x, ((t ^ (t >>> 14)) >>> 0) / 4294967296]; };
    for (let k = 1; k < 400000; k++) { let x = (S.seed + k * 7919) | 0; let okk = true; for (const v of vals) { const [x2, r] = step(x); x = x2; if (1 + Math.floor(r * 6) !== v) { okk = false; break; } } if (okk) { S.seed = (S.seed + k * 7919) | 0; return; } } }, vals);

  // 1. ритуал: начать с «Двора», милостыня, жертва (окно выбора карт — у гостя)
  ok('ход гостя', await guestTurn());
  await hostSet((S, g) => { g.faiths = ['grain']; g.gold = 30; g.sins = []; g.ritual = null; g.hand = ['tax', 'tax', 'tax']; g.estates = g.estates.filter(e => !DATA.ESTATES[e.id].bad); });
  await gClick('.myb[data-act="my"]'); await guest.waitForTimeout(700);
  await gClick('.scrim:not(.out) [data-act="ritstart"][data-id="grain_a"]');
  ok('гость начал ритуал — у хозяина он идёт', await until((S, g) => g.ritual && g.ritual.id === 'grain_a'));
  await gCloseAll(); await gClick('.myb[data-act="my"]'); await guest.waitForTimeout(700);
  await gClick('.scrim:not(.out) [data-act="ritact"][data-i="4"]');
  ok('милостыня по сети: отметка у хозяина', await until((S, g) => g.ritual && g.ritual.marks[4]));
  await gCloseAll(); await gClick('.myb[data-act="my"]'); await guest.waitForTimeout(700);
  await gClick('.scrim:not(.out) [data-act="ritact"][data-i="0"]');
  const tr = await gSheet(/уберите|Убрать|Великая жатва/i);
  ok('жертва: окно выбора карт пришло гостю', !!tr, tr.slice(0, 80));
  for (const k of [0, 1]) { await guest.evaluate((k) => { const bs = document.querySelectorAll('.scrim:not(.out) .optlist [data-i]'); if (bs[k]) bs[k].click(); }, k); await guest.waitForTimeout(200); }
  await gClick('.scrim:not(.out) [data-ok]');
  ok('жертва по сети: 2 карты убраны, отметка у хозяина', await until((S, g) => g.ritual && g.ritual.marks[0] && g.hand.length === 1), JSON.stringify(await hostQ((S, g) => ({ m: g.ritual && g.ritual.marks, hand: g.hand.length }))));
  await gCloseAll();

  // 2. Гордыня: окно «кого нанять» у гостя; Похоть: «какие карты забрать»
  await hostSet((S, g) => { g.turn.rolled = true; g.turn.buysUsed = 0; g.gold = 30; S.courtRow[0] = 'sin_pride'; });
  const v0 = await hostQ((S, g) => g.vassals.length);
  await gClick('.abar [data-act="drawer"][data-d="market"]'); await guest.waitForTimeout(500);
  await guest.evaluate(() => { const c = document.querySelector('.drawer .mcard[data-id="sin_pride"]'); if (c) c.click(); }); await guest.waitForTimeout(500);
  await gClick('.scrim:not(.out) .buybar [data-buyproxy]');
  const pr = await gSheet(/Гордыня: кого нанять/);
  ok('Гордыня: окно «кого нанять» пришло гостю', !!pr, pr.slice(0, 70));
  await gClick('.scrim:not(.out) .optlist [data-v="0"]');
  ok('Гордыня по сети: вассал нанят у хозяина', await until((S, g, h, v0) => g.vassals.length === v0 + 1, v0), `было ${v0}`);
  await gCloseAll();
  await hostSet((S, g, h) => { g.turn.buysUsed = 0; S.courtRow[0] = 'sin_lust'; h.discard = ['spicer', 'collector', 'tax', 'arson']; });
  const h0 = await hostQ((S, g) => g.hand.length);
  await gClick('.abar [data-act="drawer"][data-d="market"]'); await guest.waitForTimeout(500);
  await guest.evaluate(() => { const c = document.querySelector('.drawer .mcard[data-id="sin_lust"]'); if (c) c.click(); }); await guest.waitForTimeout(500);
  await gClick('.scrim:not(.out) .buybar [data-buyproxy]');
  const lt = await gSheet(/Похоть: что забрать/);
  ok('Похоть: окно «какие карты забрать» пришло гостю, козней в нём нет', !!lt && !/Поджог/.test(lt), lt.slice(0, 80));
  for (const k of [0, 1, 2]) { await guest.evaluate((k) => { const bs = document.querySelectorAll('.scrim:not(.out) .optlist [data-i]'); if (bs[k]) bs[k].click(); }, k); await guest.waitForTimeout(200); }
  await gClick('.scrim:not(.out) [data-ok]');
  ok('Похоть по сети: 3 карты в руке гостя, Поджог остался у хозяина', await until((S, g, h, h0) => g.hand.length === h0 + 3 && h.discard.join() === 'arson' && g.sins.includes('sin_lust'), h0), JSON.stringify(await hostQ((S, g, h) => ({ hand: g.hand, hd: h.discard }))) + ' было ' + h0);
  await gCloseAll();
  // 3. Похоть: итог 2 на одном кубике — окно «откуда возьмут карту» у гостя
  ok('гость завершил ход', await gEnd());
  ok('следующий ход гостя', await guestTurn());
  await hostSet((S, g) => { g.discard = ['tax', 'tax']; g.inPlay = []; g.miracles = []; g.turn.setUsed = true; });
  await seedDie([2]);
  const b3 = await hostQ((S, g, h) => ({ hand: g.hand.length, disc: g.discard.length + g.inPlay.length, hd: h.discard.length }));
  await gClick('.abar [data-act="roll"][data-n="1"]');
  let lf = '';
  for (let t = 0; t < 40 && !lf; t++) { lf = await gSheet(/откуда/, 300); if (!lf) await gClick('[data-act="adj-ok"]'); }
  ok('Похоть: итог 2 — окно «откуда возьмут карту» пришло гостю', /Из руки/.test(lf) && /Из сброса/.test(lf), lf.slice(0, 80));
  await guest.evaluate(() => { const o = [...document.querySelectorAll('.scrim:not(.out) .optlist [data-v]')].find(x => /Из сброса/.test(x.innerText)); if (o) o.click(); });
  ok('выбрали «из сброса» — у хозяина ушла карта из сброса гостя, рука цела', await until((S, g, h, b) => g.discard.length + g.inPlay.length === b.disc - 1 && g.hand.length === b.hand && h.discard.length === b.hd + 1, b3), JSON.stringify([b3, await hostQ((S, g, h) => ({ hand: g.hand.length, disc: g.discard.length + g.inPlay.length, hd: h.discard.length }))]));
  await gCloseAll();
  // 4. «Перст судьбы»: в окне броска гостя — кнопка, лист вариантов, кубик повёрнут
  ok('гость завершил ход', await gEnd());
  ok('ещё ход гостя', await guestTurn());
  await hostSet((S, g) => { g.faiths = ['seer']; g.miracles = ['seer_a']; g.sins = []; g.ritual = null; g.turn.setUsed = false; });
  await seedDie([1, 3]);
  await gClick('.abar [data-act="roll"][data-n="2"]');
  let hasSet = false; for (let t = 0; t < 40 && !hasSet; t++) { hasSet = await guest.evaluate(() => !!document.querySelector('[data-act="adj-setsheet"]')); if (!hasSet) await guest.waitForTimeout(150); }
  ok('Перст судьбы: кнопка в окне броска гостя', hasSet);
  if (hasSet) {
    await gClick('[data-act="adj-setsheet"]');
    const ps = await gSheet(/Перст судьбы/);
    ok('Перст судьбы: лист вариантов с доходом у гостя', /вам [+−0]/.test(ps), ps.slice(0, 80));
    await guest.evaluate(() => { const o = document.querySelector('.scrim:not(.out) .optlist [data-v="0"]'); if (o) o.click(); });
    ok('Перст судьбы по сети: кубик повёрнут у хозяина', await until((S, g) => g.turn.setUsed));
    // после поворота окно броска открывается снова (можно ещё перебросить) — «Оставить»
    for (let k = 0; k < 40; k++) { if (await hostQ((S, g) => g.turn.rolled)) break; await gClick('[data-act="adj-ok"]'); await guest.waitForTimeout(200); }
    ok('бросок с повёрнутым кубиком принят', await until((S, g) => g.turn.rolled), JSON.stringify(await hostQ((S) => S.lastRoll)));
  }
  await gCloseAll();
  // 5. покаяние: гость с верой и грехом начинает с «Двора»; шаг 1 — 5🪙 сопернику
  ok('гость завершил ход', await gEnd());
  ok('ход гостя для покаяния', await guestTurn());
  await hostSet((S, g) => { g.faiths = ['grain']; g.miracles = []; g.ritual = null; g.sins = ['sin_greed']; g.penance = null; g.gold = 20; });
  const hg = await hostQ((S, g, h) => h.gold);
  await gClick('.myb[data-act="my"]'); await guest.waitForTimeout(700);
  await gClick('.scrim:not(.out) [data-act="penance"]');
  ok('покаяние по сети: шаг 1 у хозяина, 5🪙 ушли ему', await until((S, g, h, hg) => g.penance && g.penance.step === 1 && h.gold === hg + 5, hg), JSON.stringify(await hostQ((S, g, h) => ({ pen: g.penance, hg: h.gold }))) + ' было ' + hg);
  await gCloseAll();
  // 6. v10.21: новые знамёна у гостя — Клара (долг), Евстафий (сбросить и взять), Ортензия (обмен с рынком), Северин (печать регента)
  ok('ход гостя для знамён (тот же ход, до броска)', await guestTurn());
  await hostSet((S, g) => { g.vassals = ['klara']; g.lords = ['eustace']; g.greats = ['ortensia']; g.sins = []; g.penance = null; g.gold = 20; g.hand = ['tax', 'scribe', 'tax']; g.deck = ['collector', 'tax']; S.courtRow[0] = 'spicer'; });
  const pickG = (re) => guest.evaluate((src) => { const s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); const b = s && [...s.querySelectorAll('.optlist [data-v]')].find(x => new RegExp(src).test(x.innerText)); if (b) b.click(); return !!b; }, re.source);
  await gClick('[data-act="ex"][data-k="loan"]'); await gSheet(/взять в долг/); await pickG(/Взять 3/);
  ok('Клара по сети: +3🪙 и долг у хозяина', await until((S, g) => g.gold === 23 && g.loan === 4), JSON.stringify(await hostQ((S, g) => ({ gold: g.gold, loan: g.loan }))));
  await gClick('[data-act="ex"][data-k="cycle"]'); await gSheet(/какую карту сбросить/); await pickG(/Подать/);
  ok('Евстафий по сети: карта сброшена, новая взята', await until((S, g) => g.turn.cycled && g.hand.length === 3), JSON.stringify(await hostQ((S, g) => ({ hand: g.hand, c: g.turn.cycled }))));
  await gClick('[data-act="ex"][data-k="swap"]'); await gSheet(/какую карту отдать/); await pickG(/Писарь/); await gSheet(/какую карту взять/); await pickG(/Торговец пряностями/);
  ok('Ортензия по сети: обмен с рынком у хозяина', await until((S, g) => g.hand.includes('spicer') && S.courtRow[0] === 'scribe'), JSON.stringify(await hostQ((S, g) => ({ hand: g.hand, row: S.courtRow }))));
  // Северин: печать регента у гостя — свойство Гуго хозяина (+1 действие) до конца хода
  await hostSet((S, g, h) => { g.greats = ['ortensia', 'severin']; g.turn.regent = null; h.lords = ['hugo']; });
  await gClick('[data-act="ex"][data-k="regent"]'); await gSheet(/чьё свойство взять/); await pickG(/Гуго/);
  ok('Северин по сети: печать на Гуго у хозяина', await until((S, g) => g.turn.regent === 'hugo'), JSON.stringify(await hostQ((S, g) => ({ r: g.turn.regent }))));
  await gCloseAll();
  // стол у обоих сходится
  await guest.waitForTimeout(1200);
  const a1 = await st(host), a2 = await st(guest);
  ok('стол у хозяина и гостя сходится', a1 && a2 && JSON.stringify(a1.gold) === JSON.stringify(a2.gold) && a1.cur === a2.cur, JSON.stringify([a1 && a1.gold, a2 && a2.gold]));
  console.log(res.join('\n')); console.log('ошибки', [...host.errs, ...guest.errs].slice(0, 8));
  await b.close(); br.close();
})();
