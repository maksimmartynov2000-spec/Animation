// v10: партия по сети на новом экране — хозяин и гость в двух страницах, брокер MQTT — здесь же. node net.js [turns]
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
  const host = await mk('хозяин', { v2: 1, v3: 1, v10: 1, house: 'deer', seats: [{ type: 'remote', house: 'random' }], speed: 'fast', mods: ['lords'], coins: true }, { width: 393, height: 852 });
  const guest = await mk('гость', { v2: 1, v3: 1, v10: 1, house: 'owl', opps: 1, speed: 'fast', mods: ['lords'], coins: true }, { width: 428, height: 926 });
  await host.click('[data-act="setup"]'); await host.waitForTimeout(300); await host.click('[data-act="start"]'); await host.waitForTimeout(1200);
  const code = await host.evaluate(() => window.__VD.net && window.__VD.net.code);
  console.log('комната', code, JSON.stringify(await host.evaluate(() => window.__VD.net)));
  await guest.click('[data-act="friends"]'); await guest.waitForTimeout(300); await guest.click('[data-f="join"]'); await guest.waitForTimeout(300);
  await guest.fill('#jcode', code); await guest.fill('#jname', 'Жена'); await guest.click('[data-act="join-go"]'); await guest.waitForTimeout(1500);
  console.log('гость', JSON.stringify(await guest.evaluate(() => window.__VD.net)));
  await host.screenshot({ path: SP + 'v10/net-lobby-host.png' }); await guest.screenshot({ path: SP + 'v10/net-lobby-guest.png' });
  await host.click('[data-act="lobby-start"]'); await host.waitForTimeout(1500);
  const st = (p) => p.evaluate(() => { const V = window.__VD, S = V.S; if (!S) return null; return { view: V.view, me: V.ME, cur: S.cur, round: S.round, my: V.isMyTurn(), rolled: S.players[S.cur].turn.rolled, coins: V.coins, step: V.step, adj: !!V.adjust, busy: V.busy, w: S.winner, gold: S.players.map(q => q.gold), est: S.players.map(q => q.estates.length), pend: V.net && V.net.pending }; });
  console.log('старт: хозяин', JSON.stringify(await st(host)), 'гость', JSON.stringify(await st(guest)));
  await host.screenshot({ path: SP + 'v10/net-1-host.png' }); await guest.screenshot({ path: SP + 'v10/net-1-guest.png' });
  // оба играют просто: сыграть всё, бросить, забрать, купить, завершить
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
  const acts = { host: {}, guest: {} };
  let shots = 0;
  for (let it = 0; it < 1500; it++) {
    const a = await play(host), g = await play(guest);
    acts.host[a] = (acts.host[a] || 0) + 1; acts.guest[g] = (acts.guest[g] || 0) + 1;
    if (g === 'coin' && shots < 1) { shots++; await guest.screenshot({ path: SP + 'v10/net-2-guest-coins.png' }); }
    const s = await st(host); if (!s || s.w !== null || s.round > TURNS) break;
    await host.waitForTimeout(60);
  }
  await host.waitForTimeout(2500);
  const hs = await st(host), gs = await st(guest);
  console.log('конец: хозяин', JSON.stringify(hs)); console.log('       гость ', JSON.stringify(gs));
  console.log('действия', JSON.stringify(acts));
  console.log('совпадает', JSON.stringify(hs.gold) === JSON.stringify(gs.gold) && JSON.stringify(hs.est) === JSON.stringify(gs.est) ? 'да' : 'НЕТ');
  await host.screenshot({ path: SP + 'v10/net-3-host.png' }); await guest.screenshot({ path: SP + 'v10/net-3-guest.png' });
  console.log('ошибки', [...host.errs, ...guest.errs].slice(0, 8));
  await b.close(); br.close();
})();
