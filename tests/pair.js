// v10.2: запомненная пара, «Сыграть ещё», статистика — хозяин и гость в двух страницах, брокер MQTT — здесь же. node net.js [turns]
const { chromium } = require('playwright');
const { wsServer: WSS } = require(require.resolve('playwright-core/lib/utilsBundle', { paths: [require.resolve('playwright')] }));
const SP = require('path').join(__dirname, '..', '.work') + '/';
const TURNS = +(process.argv[2] || 6);
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
  const host = await mk('хозяин', { v2: 1, v3: 1, v10: 1, house: 'deer', seats: [{ type: 'bot', house: 'random' }, { type: 'bot', house: 'random' }], speed: 'turbo', mods: ['lords'], coins: false }, { width: 393, height: 852 });
  const guest = await mk('гость', { v2: 1, v3: 1, v10: 1, house: 'owl', opps: 1, speed: 'turbo', mods: ['lords'], coins: false }, { width: 744, height: 1133 });
  const pairOf = (p) => p.evaluate(() => { try { return JSON.parse(localStorage.getItem('pretendenty-pair-v1') || 'null'); } catch (e) { return null; } });
  const st = (p) => p.evaluate(() => { const V = window.__VD, S = V.S; if (!S) return null; return { view: V.view, me: V.ME, cur: S.cur, round: S.round, my: V.isMyTurn(), rolled: S.players[S.cur].turn.rolled, coins: V.coins, step: V.step, adj: !!V.adjust, busy: V.busy, w: S.winner, gold: S.players.map(q => q.gold), est: S.players.map(q => q.estates.length), pend: V.net && V.net.pending }; });
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
  // ---- 1. первая партия: «Играть вдвоём» → комната по коду ----
  ok('главная кнопка — «Играть вдвоём»', (await host.locator('.home-acts .btn.primary').innerText()).includes('Играть вдвоём'));
  await host.click('[data-act="duo"]'); await host.waitForTimeout(300); await host.click('[data-f="host"]'); await host.waitForTimeout(300);
  ok('хозяин: стол на двоих, соперник по сети', await host.evaluate(() => document.querySelectorAll('.seats .seat').length === 1 && !!document.querySelector('.seats .seat [data-v="remote"].on')));
  await host.click('[data-act="start"]'); await host.waitForTimeout(1200);
  const code = await host.evaluate(() => window.__VD.net && window.__VD.net.code);
  await guest.click('[data-act="duo"]'); await guest.waitForTimeout(300); await guest.click('[data-f="join"]'); await guest.waitForTimeout(300);
  await guest.fill('#jcode', code); await guest.fill('#jname', 'Аня'); await guest.click('[data-act="join-go"]'); await guest.waitForTimeout(1600);
  await host.screenshot({ path: SP + 'v10/pair-lobby-host.png' });
  await host.click('[data-act="lobby-start"]'); await host.waitForTimeout(1500);
  const ph = await pairOf(host), pg = await pairOf(guest);
  ok('пара запомнена у хозяина', ph && ph.role === 'host' && ph.code === code && ph.peer === 'Аня', JSON.stringify(ph));
  ok('пара запомнена у гостя', pg && pg.role === 'guest' && pg.code === code && !!pg.cid, JSON.stringify(pg));
  const gid1 = await host.evaluate(() => window.__VD.S.gid);
  // ---- 2. играем круг и заканчиваем партию по времени ----
  await both(async (s) => s && s.round >= 3);
  await host.evaluate(() => { window.__VD.S.round = 999; });
  await both(async (s) => s && s.w !== null);
  await host.waitForTimeout(1800);
  const sg = await st(guest), sh = await st(host);
  ok('партия закончилась у обоих', sh.w !== null && sg && sg.w === sh.w, `хозяин ${sh.w}, гость ${sg && sg.w}`);
  ok('итоги открылись у обоих', await host.locator('.page.results').count() === 1 && await guest.locator('.page.results').count() === 1);
  ok('статистика в итогах (гость видит её тоже)', await guest.locator('.page.results .stt .sr').count() >= 8 && await host.locator('.page.results .stt .sr').count() >= 8);
  const xsG = await guest.evaluate(() => { const x = window.__VD.S.xs; return x ? [x.spentM, x.spentB, x.best.map(b => b && b.amt)] : null; });
  ok('числа статистики у гостя', !!xsG, JSON.stringify(xsG));
  const sc1 = [await pairOf(host), await pairOf(guest)].map(x => [x.w, x.l]);
  ok('счёт серии записан у обоих и сходится', sc1[0][0] + sc1[0][1] === 1 && sc1[1][0] + sc1[1][1] === 1 && sc1[0][0] === sc1[1][1], JSON.stringify(sc1));
  await host.screenshot({ path: SP + 'v10/pair-res-host.png' }); await guest.screenshot({ path: SP + 'v10/pair-res-guest.png' });
  // ---- 3. «Сыграть ещё»: гость предлагает, хозяин начинает ----
  await guest.click('.page.results [data-act="again"]'); await guest.waitForTimeout(900);
  ok('гость: «ждём хозяина»', (await guest.locator('.page.results [data-act="again"] small').innerText()).includes('ждём'));
  ok('хозяин видит предложение', (await host.locator('.page.results [data-act="again"] small').innerText()).includes('ждёт'), await host.locator('.page.results [data-act="again"] small').innerText());
  await host.screenshot({ path: SP + 'v10/pair-again-host.png' });
  await host.click('.page.results [data-act="again"]'); await host.waitForTimeout(2200);
  const h2 = await host.evaluate(() => { const V = window.__VD; return { gid: V.S.gid, w: V.S.winner, view: V.view, round: V.S.round, res: document.querySelectorAll('.page.results:not(.out)').length, houses: V.S.players.map(q => q.house) }; });
  const g2 = await guest.evaluate(() => { const V = window.__VD; return { gid: V.S.gid, w: V.S.winner, view: V.view, round: V.S.round, res: document.querySelectorAll('.page.results:not(.out)').length, houses: V.S.players.map(q => q.house), me: V.ME }; });
  ok('новая партия началась у обоих', h2.gid !== gid1 && g2.gid === h2.gid && h2.w === null && g2.w === null && h2.res === 0 && g2.res === 0, JSON.stringify([h2, g2]));
  await both(async (s) => s && s.round >= 2);
  // стол сверяем, когда последнее обновление дошло до гостя: до 4 с ждём, пока золото у обоих совпадёт (настоящий рассинхрон не сойдётся)
  let s3h = await st(host), s3g = await st(guest);
  for (let k = 0; k < 20 && !(s3h && s3g && JSON.stringify(s3h.gold) === JSON.stringify(s3g.gold)); k++) { await host.waitForTimeout(200); s3h = await st(host); s3g = await st(guest); }
  ok('вторая партия идёт: стол сходится', s3h && s3g && JSON.stringify(s3h.gold) === JSON.stringify(s3g.gold), JSON.stringify([s3h && s3h.gold, s3g && s3g.gold]));
  await guest.screenshot({ path: SP + 'v10/pair-game2-guest.png' });
  // ---- 4. закончить, выйти в меню, снова «Играть вдвоём» — без кода ----
  await host.evaluate(() => { window.__VD.S.round = 999; });
  await both(async (s) => s && s.w !== null);
  await host.waitForTimeout(1500);
  await guest.click('.page.results [data-act="home"]'); await host.click('.page.results [data-act="home"]'); await host.waitForTimeout(600);
  const sub = await host.locator('[data-act="duo"] small').innerText();
  ok('на главном экране хозяина — пара и счёт', sub.includes(code) && sub.includes('Аня') && sub.includes('счёт'), sub);
  const subg = await guest.locator('[data-act="duo"] small').innerText();
  ok('на главном экране гостя — комната без кода', subg.includes(code) && subg.includes('без кода'), subg);
  await host.screenshot({ path: SP + 'v10/pair-home-host.png' }); await guest.screenshot({ path: SP + 'v10/pair-home-guest.png' });
  // гость нажимает первым: ждёт хозяина; хозяин открывает ту же комнату
  await guest.click('[data-act="duo"]'); await guest.waitForTimeout(900);
  ok('гость ждёт в комнате пары', await guest.evaluate((c) => window.__VD.view === 'lobby' && window.__VD.net && window.__VD.net.code === c, code));
  await host.click('[data-act="duo"]'); await host.waitForTimeout(3600);
  const lob = await host.evaluate(() => ({ view: window.__VD.view, code: window.__VD.net && window.__VD.net.code, btn: (document.querySelector('[data-act="lobby-start"]') || {}).disabled }));
  ok('хозяин: та же комната, гость уже в ней', lob.view === 'lobby' && lob.code === code && lob.btn === false, JSON.stringify(lob));
  await host.screenshot({ path: SP + 'v10/pair-lobby2-host.png' });
  await host.click('[data-act="lobby-start"]'); await host.waitForTimeout(1800);
  const s4h = await st(host), s4g = await st(guest);
  ok('третья партия началась без кода', s4h && s4g && s4h.w === null && s4g.w === null && s4g.view === 'game', JSON.stringify([s4h && s4h.round, s4g && s4g.view]));
  console.log(res.join('\n')); console.log('ошибки', [...host.errs, ...guest.errs].slice(0, 8));
  await b.close(); br.close();
})();
