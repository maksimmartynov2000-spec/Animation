// v10.3: связь — обрыв и возврат, значок и лист «Связь», проверка устройства — хозяин и гость в двух страницах, брокер MQTT — здесь же. node net.js [turns]
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
  const host = await mk('хозяин', { v2: 1, v3: 1, v10: 1, house: 'deer', seats: [{ type: 'remote', house: 'random' }], speed: 'turbo', mods: ['lords'], coins: false }, { width: 393, height: 852 });
  const guest = await mk('гость', { v2: 1, v3: 1, v10: 1, house: 'owl', opps: 1, speed: 'turbo', mods: ['lords'], coins: false }, { width: 744, height: 1133 });
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
  await host.click('[data-act="setup"]'); await host.waitForTimeout(300); await host.click('[data-act="start"]'); await host.waitForTimeout(1200);
  const code = await host.evaluate(() => window.__VD.net && window.__VD.net.code);
  await guest.click('[data-act="duo"]'); await guest.waitForTimeout(300); await guest.click('[data-f="join"]'); await guest.waitForTimeout(300);
  await guest.fill('#jcode', code); await guest.fill('#jname', 'Аня'); await guest.click('[data-act="join-go"]'); await guest.waitForTimeout(1600);
  await host.click('[data-act="lobby-start"]'); await host.waitForTimeout(1500);
  await both(async (s) => s && s.round >= 2);
  const dot = (p) => p.evaluate(() => { const b = document.querySelector('.board .netb'); return b ? b.className : null; });
  ok('значок связи есть у обоих и зелёный', /\bon\b/.test(await dot(host) || '') && /\bon\b/.test(await dot(guest) || ''), `${await dot(host)} / ${await dot(guest)}`);
  // отклик
  await guest.waitForTimeout(6500);
  const rtt = await guest.evaluate(() => window.__VD.net && window.__VD.net.rtt);
  ok('гость знает отклик до хозяина', typeof rtt === 'number' && rtt >= 0 && rtt < 3000, String(rtt));
  // лист «Связь»
  await guest.click('.board .netb'); await guest.waitForTimeout(500);
  const sheetTxt = await guest.evaluate(() => (document.querySelector('.netsheet') || {}).innerText || '');
  ok('лист «Связь» у гостя', sheetTxt.includes('Комната') && sheetTxt.includes('Хозяин') && sheetTxt.includes('на связи'), sheetTxt.replace(/\s+/g, ' ').slice(0, 140));
  await guest.screenshot({ path: SP + 'v10/net2-sheet-guest.png' });
  await guest.evaluate(() => { const s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); if (s && s.close) s.close(); }); await guest.waitForTimeout(400);
  // обрыв связи у гостя на несколько секунд: хозяин играет дальше, потом гость догоняет
  await guest.context().setOffline(true);
  // у страницы file:// setOffline не рвёт уже открытые сокеты локального брокера — рвём сами
  await guest.evaluate(() => { const r = window.__VD.netRoom && window.__VD.netRoom(); if (r) for (const c of r.hub.conns) { try { c.ws && c.ws.close(); } catch (e) {} } });
  const g0 = await st(guest);
  for (let i = 0; i < 60; i++) { await play(host); await host.waitForTimeout(40); }
  await guest.waitForTimeout(600);
  const dOff = await dot(guest);
  await host.waitForTimeout(13500);
  const dHostWarn = await dot(host);
  ok('хозяин видит, что гость не отвечает', /warn|off/.test(dHostWarn || ''), dHostWarn);
  await host.click('.board .netb'); await host.waitForTimeout(400); await host.screenshot({ path: SP + 'v10/net2-sheet-host.png' });
  await host.evaluate(() => { const s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); if (s && s.close) s.close(); }); await host.waitForTimeout(300);
  await guest.context().setOffline(false);
  await guest.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('online')); });
  let synced = false, tSync = 0; const t0 = Date.now();
  for (let i = 0; i < 80; i++) { const a = await st(host), b = await st(guest); if (a && b && JSON.stringify(a.gold) === JSON.stringify(b.gold) && a.round === b.round && a.cur === b.cur) { synced = true; tSync = Date.now() - t0; break; } await guest.waitForTimeout(150); }
  ok('после возврата связи стол гостя догнал хозяина', synced, `за ${tSync} мс; значок при обрыве: ${dOff}`);
  await guest.waitForTimeout(2500);
  ok('значки снова зелёные', /\bon\b/.test(await dot(host) || '') && /\bon\b/.test(await dot(guest) || ''), `${await dot(host)} / ${await dot(guest)}`);
  await both(async (s) => s && s.round >= 4);
  const a = await st(host), b2 = await st(guest);
  ok('партия идёт дальше, стол сходится', a && b2 && JSON.stringify(a.gold) === JSON.stringify(b2.gold), JSON.stringify([a && a.gold, b2 && b2.gold]));
  // проверка устройства во время партии
  await guest.click('.pbar.foe [data-act="menu"]'); await guest.waitForTimeout(400);
  const opened = await guest.evaluate(() => { const b = [...document.querySelectorAll('.scrim:not(.out) button, .scrim:not(.out) [data-act], .scrim:not(.out) [data-m]')].find(x => /Настройки/.test(x.textContent)); if (b) { b.click(); return true; } return false; });
  await guest.waitForTimeout(600);
  await guest.evaluate(() => { const b = document.querySelector('.page.settings [data-set="check"]'); if (b) b.click(); }); await guest.waitForTimeout(2600);
  const rep = await guest.evaluate(() => (document.querySelector('#chk-txt') || {}).value || '');
  ok('проверка устройства открылась из партии', opened && rep.includes('Претенденты 10.') && rep.includes('Стол: раскладка') && rep.includes('Зоны:'), rep.split('\n').slice(0, 2).join(' | '));
  ok('в отчёте есть связь и серверы', /Сеть в партии: гость/.test(rep) && /Сервер 127\.0\.0\.1:\d+: ответил за \d+ мс/.test(rep), (rep.match(/Сервер[^\n]*/) || [''])[0]);
  ok('за края ничего не выходит', rep.includes('За края экрана ничего не выходит'), (rep.match(/ЗА КРАЕМ[^\n]*/) || [''])[0]);
  ok('плавность измерена', /Плавность: \d+ кадров/.test(rep), (rep.match(/Плавность[^\n]*/) || [''])[0]);
  await guest.screenshot({ path: SP + 'v10/net2-check.png' });
  console.log(res.join('\n')); console.log('--- отчёт ---\n' + rep.slice(0, 2600)); console.log('ошибки', [...host.errs, ...guest.errs].slice(0, 8));
  await b.close(); br.close();
})();
