// v10.3: «тот же стол» на троих — хозяин и гость в двух страницах, брокер MQTT — здесь же. node net.js [turns]
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
  const host = await mk('хозяин', { v2: 1, v3: 1, v10: 1, house: 'deer', seats: [{ type: 'remote', house: 'random' }, { type: 'remote', house: 'random' }], speed: 'turbo', mods: [], coins: false }, { width: 393, height: 852 });
  const g1 = await mk('гость1', { v2: 1, v3: 1, v10: 1, house: 'owl', opps: 1, speed: 'turbo', mods: [], coins: false }, { width: 393, height: 852 });
  const g2 = await mk('гость2', { v2: 1, v3: 1, v10: 1, house: 'owl', opps: 1, speed: 'turbo', mods: [], coins: false }, { width: 744, height: 1133 });
  const tbl = (p) => p.evaluate(() => { try { return JSON.parse(localStorage.getItem('pretendenty-table-v1') || 'null'); } catch (e) { return null; } });
  const join = async (p, code, name) => { await p.click('[data-act="friends"]'); await p.waitForTimeout(300); await p.click('[data-f="join"]'); await p.waitForTimeout(300); await p.fill('#jcode', code); await p.fill('#jname', name); await p.click('[data-act="join-go"]'); await p.waitForTimeout(1500); };
  await host.click('[data-act="setup"]'); await host.waitForTimeout(300); await host.click('[data-act="start"]'); await host.waitForTimeout(1200);
  const code = await host.evaluate(() => window.__VD.net && window.__VD.net.code);
  await join(g1, code, 'Аня'); await join(g2, code, 'Олег');
  await host.click('[data-act="lobby-start"]'); await host.waitForTimeout(2000);
  const th = await tbl(host), t1 = await tbl(g1), t2 = await tbl(g2);
  ok('стол на троих запомнен у хозяина', th && th.role === 'host' && th.code === code && th.n === 3 && th.remote === 2, JSON.stringify(th).slice(0, 160));
  ok('стол запомнен у обоих гостей', t1 && t2 && t1.role === 'guest' && t2.role === 'guest' && t1.code === code && t2.code === code && t1.cid !== t2.cid, JSON.stringify([t1 && t1.n, t2 && t2.n]));
  ok('партия на троих идёт у всех', await host.evaluate(() => window.__VD.S.players.length === 3) && await g1.evaluate(() => !!window.__VD.S && window.__VD.view === 'game') && await g2.evaluate(() => !!window.__VD.S));
  await g2.screenshot({ path: SP + 'v10/table3-g2.png' });
  // все выходят в меню; потом «Тот же стол»
  for (const p of [host, g1, g2]) { await p.evaluate(() => { const b = document.querySelector('.pbar.foe [data-act="menu"]'); if (b) b.click(); }); await p.waitForTimeout(350); await p.evaluate(() => { const b = [...document.querySelectorAll('.scrim:not(.out) button, .scrim:not(.out) [data-act]')].find(x => /Главное меню|В меню|Выйти/.test(x.textContent)); if (b) b.click(); }); await p.waitForTimeout(500); await p.evaluate(() => { const b = [...document.querySelectorAll('.scrim:not(.out) button')].find(x => /Выйти|Да|меню/i.test(x.textContent)); if (b) b.click(); }); await p.waitForTimeout(500); }
  const views = [await host.evaluate(() => window.__VD.view), await g1.evaluate(() => window.__VD.view), await g2.evaluate(() => window.__VD.view)];
  ok('все в главном меню', views.every(v => v === 'home'), views.join(','));
  await g1.click('[data-act="friends"]'); await g1.waitForTimeout(350);
  ok('в листе «Друзья» есть «Тот же стол»', await g1.locator('[data-f="table"]').count() === 1, (await g1.locator('[data-f="table"]').innerText().catch(() => '')).replace(/\s+/g, ' '));
  await g1.screenshot({ path: SP + 'v10/table3-sheet.png' });
  await g1.click('[data-f="table"]'); await g1.waitForTimeout(800);
  await host.click('[data-act="friends"]'); await host.waitForTimeout(350); await host.click('[data-f="table"]'); await host.waitForTimeout(1200);
  await g2.click('[data-act="friends"]'); await g2.waitForTimeout(350); await g2.click('[data-f="table"]'); await g2.waitForTimeout(3800);
  const lob = await host.evaluate(() => ({ view: window.__VD.view, code: window.__VD.net && window.__VD.net.code, btn: (document.querySelector('[data-act="lobby-start"]') || {}).disabled, seats: document.querySelectorAll('.lseat').length }));
  ok('хозяин открыл ту же комнату, оба гостя вошли без кода', lob.view === 'lobby' && lob.code === code && lob.btn === false && lob.seats === 3, JSON.stringify(lob));
  await host.click('[data-act="lobby-start"]'); await host.waitForTimeout(2000);
  ok('вторая партия тем же столом началась', await g1.evaluate(() => !!window.__VD.S && window.__VD.S.players.length === 3) && await g2.evaluate(() => !!window.__VD.S && window.__VD.S.players.length === 3));
  console.log(res.join('\n')); console.log('ошибки', [...host.errs, ...g1.errs, ...g2.errs].slice(0, 8));
  await b.close(); br.close();
})();
