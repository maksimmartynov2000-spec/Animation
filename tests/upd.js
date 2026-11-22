// v10.7: игра сама обновляется с сайта (вне партии) + предупреждение о разных версиях в сетевой комнате. node upd.js
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs');
const { wsServer: WSS } = require(require.resolve('playwright-core/lib/utilsBundle', { paths: [require.resolve('playwright')] }));
const SP = require('path').join(__dirname, '..', '.work') + '/';
const BASE = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const B0 = BASE.match(/name="pretendenty-build" content="([^"]+)"/)[1];
const withBuild = (b) => BASE.replace(`content="${B0}"`, `content="${b}"`);
let html = BASE, mode = 'normal', hits = { upd: 0, page: 0 };
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  if (u.pathname !== '/' && u.pathname !== '/index.html') { r.writeHead(404); return r.end(); }
  if (u.searchParams.has('upd')) hits.upd++; else hits.page++;
  let body = html;
  if (mode === 'stale' && !u.searchParams.has('upd')) body = BASE; // сайт отдаёт страницу старой — защита от вечной перезагрузки
  r.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'max-age=600' }); r.end(body);
});
function broker() {
  const wss = new WSS({ port: 0, handleProtocols: () => 'mqtt' }); const subs = new Map();
  wss.on('connection', (ws) => { let buf = Buffer.alloc(0); ws.on('message', (data) => { buf = Buffer.concat([buf, Buffer.from(data)]); for (;;) { if (buf.length < 2) return; let len = 0, mul = 1, i = 1, b; do { if (i >= buf.length) return; b = buf[i++]; len += (b & 127) * mul; mul *= 128; } while (b & 128); if (buf.length < i + len) return; const first = buf[0], body = buf.subarray(i, i + len), pkt = Buffer.from(buf.subarray(0, i + len)); buf = buf.subarray(i + len); const type = first >> 4; if (type === 1) ws.send(Buffer.from([0x20, 2, 0, 0])); else if (type === 8) { const tl = body.readUInt16BE(2), topic = body.subarray(4, 4 + tl).toString(); if (!subs.has(topic)) subs.set(topic, new Set()); subs.get(topic).add(ws); ws.send(Buffer.from([0x90, 3, body[0], body[1], 0])); } else if (type === 3) { const tl = body.readUInt16BE(0), topic = body.subarray(2, 2 + tl).toString(); for (const c of subs.get(topic) || []) if (c.readyState === 1) c.send(pkt); } else if (type === 12) ws.send(Buffer.from([0xD0, 0])); } }); ws.on('close', () => { for (const s of subs.values()) s.delete(ws); }); });
  return new Promise(res => wss.on('listening', () => res({ port: wss.address().port, close: () => wss.close() })));
}
(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); const URLS = `http://127.0.0.1:${srv.address().port}/`;
  const res = []; const ok = (n, v, x) => res.push((v ? 'OK  ' : 'FAIL ') + n + (x ? ' — ' + x : ''));
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__toasts = []; document.addEventListener('DOMContentLoaded', () => new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList && n.classList.contains('toast')) window.__toasts.push(n.innerText); }).observe(document.body, { childList: true, subtree: true })); });
  await p.addInitScript(() => { try { if (!localStorage.getItem('velikie-doma-prefs-v1')) localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: 'deer', opps: 1, speed: 'fast', mods: ['lords'], tut: 0, coins: false, sound: false, music: false })); } catch (e) {} });
  let navs = 0; p.on('load', () => { navs++; });
  await p.goto(URLS); await p.waitForSelector('#splash', { state: 'detached', timeout: 6000 }).catch(() => {});
  const upd = () => p.evaluate(() => ({ build: window.__VD.upd.build, on: window.__VD.upd.on, found: window.__VD.upd.found, last: window.__VD.upd.last, url: location.href, bar: (document.getElementById('updbar') || {}).innerText || '' }));
  await p.waitForTimeout(3200);
  let u = await upd();
  ok('на сайте проверка включена, своя сборка известна', u.on && u.build === B0 && /новее нет/.test(u.last), JSON.stringify(u));
  // 1. главный экран: вышла новая сборка → игра обновляется сама
  html = withBuild('10.9·aaaa1111'); navs = 0;
  await p.evaluate(() => window.__VD.upd.check());
  await p.waitForTimeout(5000); await p.waitForSelector('#splash', { state: 'detached', timeout: 6000 }).catch(() => {});
  u = await upd();
  const toastT = await p.evaluate(() => (window.__toasts || []).join(' | '));
  ok('главный экран: новая сборка — страница перезагрузилась и стала новой', navs >= 1 && u.build === '10.9·aaaa1111', `переходов ${navs}, ${u.build}`);
  ok('адрес после обновления чистый, показано «обновлена»', !/[?&]v=/.test(u.url) && /обновлена/.test(toastT), `${u.url} | ${toastT}`);
  // 2. в партии: молчит
  await p.click('[data-act="setup"]'); await p.waitForTimeout(400); await p.click('[data-act="start"]');
  for (let i = 0; i < 300; i++) { if (await p.evaluate(() => window.__VD.isMyTurn() && !window.__VD.busy && !document.body.classList.contains('dealing'))) break; await p.waitForTimeout(100); }
  html = withBuild('10.9·bbbb2222'); navs = 0;
  await p.evaluate(() => window.__VD.upd.check()); await p.waitForTimeout(3500);
  u = await upd();
  ok('в партии: новую сборку нашли, но ничего не делаем', navs === 0 && u.found === '10.9·bbbb2222' && !u.bar && await p.evaluate(() => !!window.__VD.S), `переходов ${navs}, плашка «${u.bar}»`);
  // 3. партия окончена (итоги) — плашка с кнопкой; нажали — обновилась, партии больше нет
  await p.evaluate(() => { const V = window.__VD; V.S.winner = V.ME; V.redraw(); }); await p.waitForTimeout(800);
  u = await upd();
  ok('итоги: плашка «Вышла версия … · Обновить»', /Вышла версия 10\.9/.test(u.bar) && /Обновить/.test(u.bar), u.bar.replace(/\s+/g, ' '));
  await p.screenshot({ path: SP + 'v10/upd-bar.png' });
  navs = 0; await p.click('#updbar [data-upd="go"]'); await p.waitForTimeout(4500); await p.waitForSelector('#splash', { state: 'detached', timeout: 6000 }).catch(() => {});
  u = await upd(); ok('кнопка «Обновить» — новая сборка', navs >= 1 && u.build === '10.9·bbbb2222', `${navs} ${u.build}`);
  // 4. сайт упорно отдаёт старую страницу — не больше двух перезагрузок, потом плашка
  html = withBuild('10.9·cccc3333'); mode = 'stale'; navs = 0;
  // наша страница сейчас «новая» 10.9·bbbb2222 — после перезагрузки сайт отдаст BASE; это тоже «другая» сборка, проверяем, что цикл останавливается
  await p.evaluate(() => window.__VD.upd.check());
  for (let i = 0; i < 12; i++) { await p.waitForTimeout(1500); try { await p.evaluate(() => window.__VD.upd.check()); } catch (e) { /* идёт переход */ } }
  await p.waitForTimeout(2500);
  u = await upd();
  ok('сайт отдаёт старое — не больше двух перезагрузок, дальше плашка', navs <= 2 && /Вышла версия/.test(u.bar), `переходов ${navs}, плашка «${u.bar.replace(/\s+/g, ' ')}»`);
  mode = 'normal';
  // 5. сетевая комната: версии разные — предупреждение у обоих
  const br = await broker();
  const fileNew = SP + 'test-embed.html', fileOld = SP + 'test-embed-old.html';
  // версию берём из собранной страницы: тест не должен ломаться при каждом выпуске (раньше здесь было зашито 10.7)
  const CUR = (fs.readFileSync(fileNew, 'utf8').match(/const VERSION = '([^']+)'/) || [])[1], OLD = '9.9', rx = (v) => String(v).replace(/\./g, '\\.');
  if (!CUR) throw new Error('не нашёл const VERSION в ' + fileNew);
  fs.writeFileSync(fileOld, fs.readFileSync(fileNew, 'utf8').replace(`const VERSION = '${CUR}'`, `const VERSION = '${OLD}'`));
  const mk = async (file, prefs, vp) => { const c = await b.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: true, isMobile: true, reducedMotion: 'reduce' }); const q = await c.newPage(); q.errs = []; q.on('pageerror', e => errs.push(e.message)); await q.addInitScript(([prefs, port]) => { window.PRETENDENTY_NET = { brokers: ['ws://127.0.0.1:' + port] }; try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify(prefs)); } catch (e) {} }, [prefs, br.port]); await q.goto('file://' + file); await q.waitForSelector('#splash', { state: 'detached', timeout: 5000 }).catch(() => {}); return q; };
  const host = await mk(fileNew, { v2: 1, v3: 1, v10: 1, house: 'deer', speed: 'turbo', mods: ['lords'], coins: false }, { width: 393, height: 852 });
  const guest = await mk(fileOld, { v2: 1, v3: 1, v10: 1, house: 'owl', opps: 1, speed: 'turbo', mods: ['lords'], coins: false }, { width: 393, height: 852 });
  await host.click('[data-act="duo"]'); await host.waitForTimeout(300); await host.click('[data-f="host"]'); await host.waitForTimeout(300);
  await host.click('[data-act="start"]'); await host.waitForTimeout(1200);
  const code = await host.evaluate(() => window.__VD.net && window.__VD.net.code);
  await guest.click('[data-act="duo"]'); await guest.waitForTimeout(300); await guest.click('[data-f="join"]'); await guest.waitForTimeout(300);
  await guest.fill('#jcode', code); await guest.fill('#jname', 'Аня'); await guest.click('[data-act="join-go"]'); await guest.waitForTimeout(2200);
  const noteOf = (q) => q.evaluate(() => ({ note: (document.querySelector('.verdiff') || {}).innerText || '', toast: [...document.querySelectorAll('.toast')].map(t => t.innerText).join(' | ') }));
  const nh = await noteOf(host), ng = await noteOf(guest);
  ok(`хозяин видит: у второго устройства ${OLD}`, new RegExp(`у второго устройства версия ${rx(OLD)}`).test(nh.note) && new RegExp(rx(OLD)).test(nh.toast), JSON.stringify(nh));
  ok(`гость видит: у второго устройства ${CUR}`, new RegExp(`у вас ${rx(OLD)}, у второго устройства версия ${rx(CUR)}`).test(ng.note), JSON.stringify(ng));
  await host.screenshot({ path: SP + 'v10/upd-room.png' });
  // те же версии — предупреждения нет
  const g2 = await mk(fileNew, { v2: 1, v3: 1, v10: 1, house: 'owl', opps: 1, speed: 'turbo', mods: ['lords'], coins: false }, { width: 393, height: 852 });
  const h2 = await mk(fileNew, { v2: 1, v3: 1, v10: 1, house: 'deer', speed: 'turbo', mods: ['lords'], coins: false }, { width: 393, height: 852 });
  await h2.click('[data-act="duo"]'); await h2.waitForTimeout(300); await h2.click('[data-f="host"]'); await h2.waitForTimeout(300); await h2.click('[data-act="start"]'); await h2.waitForTimeout(1200);
  const code2 = await h2.evaluate(() => window.__VD.net && window.__VD.net.code);
  await g2.click('[data-act="duo"]'); await g2.waitForTimeout(300); await g2.click('[data-f="join"]'); await g2.waitForTimeout(300);
  await g2.fill('#jcode', code2); await g2.fill('#jname', 'Аня'); await g2.click('[data-act="join-go"]'); await g2.waitForTimeout(2200);
  const n2 = await noteOf(h2), n3 = await noteOf(g2);
  ok('одинаковые версии — без предупреждения', !n2.note && !n3.note && !/обновитесь/.test(n2.toast + n3.toast), JSON.stringify([n2, n3]));
  ok('сеть: гость вошёл в комнату', await g2.evaluate(() => !!(window.__VD.net && window.__VD.net.joined)));
  console.log(res.join('\n')); console.log('ошибки', errs.slice(0, 5));
  await b.close(); br.close(); srv.close();
})();
