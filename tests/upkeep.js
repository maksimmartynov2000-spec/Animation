// v10.24: содержание всех знамён (вассал 1🪙, лорд 2🪙, великий лорд 4🪙) — окно «Содержание знамён» с вассалами,
// подпись ряда вассалов «содержание 1🪙 в ход», правила игры и памятка о замешивании в колоду. iPhone 15.
// node upkeep.js [file]
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
const FILE = process.argv[2] || (SP + 'test-embed.html');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); p.setDefaultTimeout(5000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const res = []; const ok = (name, cond, info) => res.push(`${cond ? 'OK ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`);
  // соперник — Лев: без шпионажа в начале хода, окно откупа не помешает
  await p.addInitScript(() => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: 'deer', opps: 1, seats: [{ type: 'bot', house: 'lion' }], speed: 'turbo', mods: ['lords', 'great'], tut: 0, coins: false, sound: false, music: false })); } catch (e) {} });
  await p.goto('file://' + FILE); await p.waitForSelector('#splash', { state: 'detached', timeout: 6000 }).catch(() => {});
  await p.click('[data-act="setup"]'); await p.waitForTimeout(400); await p.click('[data-act="start"]');
  const myTurn = async () => { for (let i = 0; i < 300; i++) { if (await p.evaluate(() => window.__VD.isMyTurn() && !window.__VD.busy && !document.body.classList.contains('dealing'))) return true; await p.waitForTimeout(100); } return false; };
  const sheet = () => p.evaluate(() => { const s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); return s ? s.innerText.replace(/\s+/g, ' ') : ''; });
  ok('мой ход', await myTurn());
  // 1. правило в данных: вассал 1🪙, лорд 2🪙, великий 4🪙
  const ups = await p.evaluate(() => ({ v: DATA.BAN.ida.upkeep, l: DATA.BAN.anselm.upkeep, g: DATA.BAN.jacob.upkeep }));
  ok('содержание на картах: вассал 1, лорд 2, великий 4', ups.v === 1 && ups.l === 2 && ups.g === 4, JSON.stringify(ups));
  // 2. окно «Содержание знамён»: золота не хватает — в списке и вассалы, у каждого своя цена
  await p.evaluate(() => { window.__keep = null; window.__VD.ask({ type: 'upkeep', options: ['ida', 'gunnar', 'anselm'], gold: 3, extra: 0, costs: { ida: 1, gunnar: 1, anselm: 2 } }).then(k => { window.__keep = k; }); });
  await p.waitForTimeout(500);
  const t2 = await sheet();
  ok('окно «Содержание знамён»: вассал 1🪙, лорд 2🪙, великий 4🪙 — в пояснении', /Содержание знамён/.test(t2) && /вассал 1/.test(t2) && /лорд 2/.test(t2) && /великий лорд 4/.test(t2) && /замешают в свои колоды/.test(t2), t2.slice(0, 200));
  const opts = await p.evaluate(() => [...document.querySelectorAll('.scrim:not(.out) .optlist [data-id]')].map(x => `${x.dataset.id}:${((x.querySelector('.r') || {}).innerText || '').replace(/\D/g, '')}`)); // монета 🪙 — картинкой, в тексте только число
  ok('в списке два вассала по 1🪙 и лорд за 2🪙', opts.join(',') === 'ida:1,gunnar:1,anselm:2', opts.join(','));
  await p.click('.scrim:not(.out) .optlist [data-id="ida"]'); await p.click('.scrim:not(.out) .optlist [data-id="gunnar"]'); await p.waitForTimeout(200);
  const okTxt = await p.evaluate(() => ((document.querySelector('.scrim:not(.out) [data-ok]') || {}).innerText || '').replace(/\s+/g, ' '));
  ok('отметили двух вассалов — «Оставить · 2🪙»', /Оставить · 2/.test(okTxt), okTxt);
  await p.click('.scrim:not(.out) [data-ok]'); await p.waitForTimeout(400);
  ok('ответ окна — оставить двух вассалов, лорд уходит', JSON.stringify(await p.evaluate(() => window.__keep)) === '["ida","gunnar"]', JSON.stringify(await p.evaluate(() => window.__keep)));
  // 3. ряд вассалов: «содержание 1🪙 в ход»
  await p.click('.abar [data-act="drawer"][data-d="regalia"]'); await p.waitForTimeout(500);
  const rows = await p.evaluate(() => [...document.querySelectorAll('.drawer .drow .dlab')].map(x => x.innerText.replace(/\s+/g, ' ')));
  ok('ряд вассалов: «содержание 1🪙 в ход», лордов — 2🪙, великих — 4🪙', rows.some(x => /Вассал/.test(x) && /содержание 1/.test(x)) && rows.some(x => /Лорд/.test(x) && /содержание 2/.test(x)) && rows.some(x => /Велик/.test(x) && /содержание 4/.test(x)), rows.join(' | '));
  await p.evaluate(() => { const c = document.querySelector('.drawer [data-act="drawer-close"]'); if (c) c.click(); }); await p.waitForTimeout(300);
  // 4. правила игры: содержание всех знамён и замешивание при обновлении ряда
  await p.waitForTimeout(400);
  await p.evaluate(() => { const m = [...document.querySelectorAll('[data-act="menu"]')].find(x => x.offsetParent !== null); if (m) m.click(); }); await p.waitForTimeout(500);
  await p.evaluate(() => { const r = [...document.querySelectorAll('[data-m="rules"]')].find(x => x.offsetParent !== null); if (r) r.click(); }); await p.waitForTimeout(800);
  // подробности правил свёрнуты в <details> — раскрываем все, потом читаем
  const rules = await p.evaluate(() => { const pg = [...document.querySelectorAll('.page')].pop(); if (!pg) return ''; pg.querySelectorAll('details').forEach(d => { d.open = true; }); return pg.innerText.replace(/\s+/g, ' '); });
  ok('правила: «вассал 1🪙, лорд 2🪙, великий лорд 4🪙»', /Содержание: первым делом заплатите за знамёна — вассал 1/.test(rules) && /лорд 2/.test(rules) && /великий лорд 4/.test(rules), (rules.match(/Содержание:[^.]*\./) || [''])[0]);
  ok('правила: крайнюю карту ряда замешивают в колоду', /крайнюю карту замешивают в колоду/.test(rules), (rules.match(/обновляется:[^.]*\./) || [''])[0]);
  ok('ошибок страницы нет', !errs.length, errs.join(' | '));
  console.log(res.join('\n'));
  await b.close();
})();
