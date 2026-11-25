// v10.6: карты веры — в листе веры, на мини-карте в «Знамёнах», в каталоге. node faith.js [dev]
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
const DEV = { i15: [393, 852, true], mini: [744, 1133, true], mac: [1512, 900, false] };
const dev = process.argv[2] || 'i15';
(async () => {
  const [w, h, mob] = DEV[dev];
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: mob, isMobile: mob }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.addInitScript(() => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: 'serpent', opps: 1, speed: 'slow', mods: ['lords', 'faith'], tut: 0, coins: false, sound: false, music: false })); localStorage.setItem('pretendenty.cardnav', JSON.stringify({ learned: 1 })); } catch (e) {} });
  await p.goto('file://' + (process.env.FILE || SP + 'test-embed.html'));
  await p.waitForSelector('#splash', { state: 'detached', timeout: 5000 }).catch(() => {});
  const res = []; const ok = (n, v, x) => res.push((v ? 'OK  ' : 'FAIL ') + n + (x ? ' — ' + x : ''));
  await p.click('[data-act="setup"]'); await p.waitForTimeout(400); await p.click('[data-act="start"]');
  for (let i = 0; i < 400; i++) { if (await p.evaluate(() => window.__VD.isMyTurn() && !window.__VD.busy && !document.body.classList.contains('dealing'))) break; await p.waitForTimeout(100); }
  await p.waitForTimeout(600);
  const big = await p.evaluate(() => window.__VD.layout.big);
  const openDrawer = async () => { if (!big && await p.evaluate(() => window.__VD.drawer !== 'regalia')) { await p.click('.abar [data-act="drawer"][data-d="regalia"]'); await p.waitForTimeout(500); } };
  await openDrawer();
  const row = await p.evaluate(() => [...document.querySelectorAll('.board .mcard.k-faith')].filter(e => e.offsetParent).map(e => ({ id: e.dataset.id, th: e.querySelectorAll('.fcm img').length, off: e.querySelectorAll('.fcm img.off').length, al: e.getAttribute('aria-label') })));
  ok('в ряду «Знамёна» у каждой веры — 2 карточки её карт', row.length >= 3 && row.every(r => r.th === 2 && r.off === 0 && /Карты веры:/.test(r.al)), JSON.stringify(row.slice(0, 2)));
  const f = row[0].id;
  await p.click(`.board .mcard.k-faith[data-id="${f}"]`); await p.waitForTimeout(700);
  const sh = await p.evaluate((f) => { const s = [...document.querySelectorAll('.scrim:not(.out) .sheet')].pop(); const ids = [...s.querySelectorAll('.fcards .pcw')].map(x => x.dataset.id); const want = DATA.FAITHS[f].cards.concat(Object.keys(DATA.RITUALS || {}).filter(id => DATA.RITUALS[id].faith === f)); const ex = [...s.querySelectorAll('.ex-r')].map(r => r.querySelector('.ex-k').innerText.trim() + ': ' + r.querySelector('.ex-v').innerText.trim()); return { ids, want, ex, tags: s.querySelectorAll('.fcards .pmeta').length }; }, f);
  ok('в листе веры — её 2 карты и 2 ритуала (v10.16)', JSON.stringify(sh.ids) === JSON.stringify(sh.want), JSON.stringify(sh.ids));
  ok('подписи: кому достанутся и отречение; бирок «у веры» нет', sh.ex.some(x => /^Кому: Первому/.test(x)) && sh.ex.some(x => /^Отречение/.test(x)) && sh.tags === 0, JSON.stringify(sh.ex));
  await p.evaluate(() => { const s = [...document.querySelectorAll('.scrim:not(.out) .sheet')].pop(); const c = s.querySelector('.fcards'); s.scrollTop = c.offsetTop - 60; }); await p.waitForTimeout(300); await p.screenshot({ path: SP + `v10/faith-${dev}-1.png` });
  // нажать на карту веры — откроется крупно поверх; закрыть — снова лист веры
  await p.evaluate(() => { const s = [...document.querySelectorAll('.scrim:not(.out) .sheet')].pop(); s.querySelector('.fcards .pcw').scrollIntoView({ block: 'center' }); });
  await p.waitForTimeout(250);
  await p.click('.scrim:not(.out) .fcards .pcw >> nth=0'); await p.waitForTimeout(700);
  const top = await p.evaluate(() => { const ss = [...document.querySelectorAll('.scrim:not(.out)')]; return { n: ss.length, title: ss[ss.length - 1].querySelector('h2').innerText.trim(), nav: (ss[ss.length - 1].querySelector('.cnav-n') || {}).innerText || '' }; });
  const want0 = await p.evaluate((f) => DATA.COURT[DATA.FAITHS[f].cards[0]].name, f);
  ok('карта веры открылась крупно поверх листа веры', top.n === 2 && top.title === want0, JSON.stringify(top));
  ok('между двумя картами веры можно листать', /из 2/.test(top.nav), top.nav);
  await p.screenshot({ path: SP + `v10/faith-${dev}-2.png` });
  await p.evaluate(() => { const ss = [...document.querySelectorAll('.scrim:not(.out)')]; ss[ss.length - 1].close(); }); await p.waitForTimeout(400);
  const back = await p.evaluate(() => { const ss = [...document.querySelectorAll('.scrim:not(.out)')]; return ss.length ? ss[ss.length - 1].querySelector('h2').innerText.trim() : ''; });
  ok('после закрытия — снова лист веры', back.length > 0 && back !== want0, back);
  await p.evaluate(() => { for (const s of document.querySelectorAll('.scrim')) s.close ? s.close() : s.remove(); }); await p.waitForTimeout(400);
  // вера принята мной: карты ушли ко мне — бирки «у вас», в ряду карточки погасли
  await p.evaluate((f) => { const V = window.__VD, S = V.S, me = S.players[V.ME]; const got = S.faithPool[f].splice(0); me.faiths.push(f); me.discard.push(...got); V.redraw(); }, f);
  await p.waitForTimeout(500); await openDrawer();
  const r2 = await p.evaluate((f) => { const e = [...document.querySelectorAll(`.board .mcard.k-faith[data-id="${f}"]`)].filter(x => x.offsetParent)[0]; return e ? e.querySelectorAll('.fcm img.off').length : -1; }, f);
  ok('вера взята — карточки в ряду погасли', r2 === 2, String(r2));
  await p.click(`.board .mcard.k-faith[data-id="${f}"]`); await p.waitForTimeout(700);
  const sh2 = await p.evaluate(() => { const s = [...document.querySelectorAll('.scrim:not(.out) .sheet')].pop(); return { tags: [...s.querySelectorAll('.fcards .pmeta')].map(x => x.innerText.trim()), who: [...s.querySelectorAll('.ex-r')].map(r => r.innerText.replace(/\s+/g, ' ')).find(x => /Кому/.test(x)) }; });
  ok('после принятия: «у вас» под картами и «Уже у вас»', sh2.tags.length === 2 && sh2.tags.every(t => t === 'у вас') && /Уже у вас/.test(sh2.who), JSON.stringify(sh2));
  await p.evaluate(() => { const s = [...document.querySelectorAll('.scrim:not(.out) .sheet')].pop(); const c = s.querySelector('.fcards'); s.scrollTop = c.offsetTop - 60; }); await p.waitForTimeout(300); await p.screenshot({ path: SP + `v10/faith-${dev}-3.png` });
  await p.evaluate(() => { for (const s of document.querySelectorAll('.scrim')) s.close ? s.close() : s.remove(); }); await p.waitForTimeout(400);
  // каталог: вкладка «Стол» — каждая вера со своими картами
  if (!big) await p.evaluate(() => { const c = document.querySelector('.drawer [data-act="drawer-close"]'); if (c) c.click(); });
  await p.evaluate(() => { const m = document.querySelector('[data-act="menu"]'); if (m) m.click(); }); await p.waitForTimeout(500);
  const hasCat = await p.evaluate(() => !!document.querySelector('[data-m="catalog"]'));
  if (hasCat) {
    await p.click('[data-m="catalog"]'); await p.waitForTimeout(700);
    await p.click('.catalog [data-seg="table"]'); await p.waitForTimeout(600);
    const cat = await p.evaluate(() => [...document.querySelectorAll('.catalog .fgroup')].map(g => ({ h: g.querySelector('.fgh').innerText.replace(/\s+/g, ' '), n: g.querySelectorAll('.pcw').length, ids: [...g.querySelectorAll('.pcw')].map(x => x.dataset.id) })));
    const okCat = cat.length >= 4 && cat.every(g => g.n === 5) && await p.evaluate((cat) => cat.every(g => JSON.stringify(g.ids.slice(1)) === JSON.stringify(DATA.FAITHS[g.ids[0]].cards.concat(Object.keys(DATA.RITUALS).filter(id => DATA.RITUALS[id].faith === g.ids[0])))), cat);
    ok('каталог «Стол»: каждая вера с её 2 картами и 2 ритуалами', okCat, `${cat.length} групп; ${JSON.stringify(cat[0])}`);
    await p.evaluate(() => document.querySelector('.catalog .fgroup').scrollIntoView({ block: 'start' })); await p.waitForTimeout(300);
    await p.screenshot({ path: SP + `v10/faith-${dev}-4.png` });
  } else ok('каталог открывается из меню', false, 'нет кнопки');
  const sw = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  ok('нет горизонтальной прокрутки', sw);
  console.log(res.join('\n')); console.log('ошибки', errs.slice(0, 4));
  await b.close();
})();
