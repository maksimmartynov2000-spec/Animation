// v10.25: «Вражда» разделена на четыре модуля — Осады, Шпионаж, Беды, Твердыни (решение владельца).
// Экран «Новая партия»: шесть переключателей; старые настройки («Вражда» = осады + шпионаж) — все четыре включены;
// партия с одними Бедами: проклятия и козни есть, карт шпионажа и твердынь нет, Розы и Волков нет; фильтр «Все карты»;
// правила модулей; сохранение до 10.25 — беды и твердыни как были. iPhone 15. node split.js [file]
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
const FILE = process.argv[2] || (SP + 'test-embed.html');
const SAVE_KEY = 'velikie-doma-save-v1', PREF_KEY = 'velikie-doma-prefs-v1';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); p.setDefaultTimeout(5000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const res = []; const ok = (name, cond, info) => res.push(`${cond ? 'OK ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`);
  // настройки и сохранение подкладываем до запуска страницы (#prefs= / #inject=)
  await p.addInitScript(([pk, sk]) => {
    const h = location.hash;
    const m1 = h.match(/#prefs=([^#]*)/), m2 = h.match(/#inject=([^#]*)/);
    try { if (m1) localStorage.setItem(pk, decodeURIComponent(m1[1])); if (m2) localStorage.setItem(sk, decodeURIComponent(m2[1])); } catch (e) {}
    if (m1 || m2) history.replaceState(null, '', location.pathname + location.search);
  }, [PREF_KEY, SAVE_KEY]);
  const home = async () => { await p.waitForSelector('#splash', { state: 'detached', timeout: 6000 }).catch(() => {}); await p.waitForTimeout(400); };
  const open = async (hash) => { await p.goto('about:blank'); await p.goto('file://' + FILE + (hash || '')); await home(); };
  const prefs = (o) => '#prefs=' + encodeURIComponent(JSON.stringify(Object.assign({ v2: 1, v3: 1, v10: 1, house: 'deer', opps: 1, seats: [{ type: 'bot', house: 'lion' }], speed: 'turbo', tut: 0, coins: false, sound: false, music: false }, o)));
  const modsOn = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.modlist .mod')].map(x => [x.dataset.k, x.classList.contains('on')])));

  // 1. старые настройки: «Вражда» (осады + шпионаж) без отметки v25 — включены все четыре модуля
  await open(prefs({ mods: ['lords', 'great', 'faith', 'sieges', 'spy'] }));
  await p.click('[data-act="setup"]'); await p.waitForTimeout(500);
  let m = await modsOn();
  ok('на экране шесть модулей: Вера, Осады, Шпионаж, Беды, Твердыни, Двор', Object.keys(m).join(',') === 'faith,sieges,spy,bad,holds,court', Object.keys(m).join(','));
  ok('старые настройки с «Враждой» — Осады, Шпионаж, Беды и Твердыни включены', m.sieges && m.spy && m.bad && m.holds && m.faith && !m.court, JSON.stringify(m));

  // 2. оставить только Беды (и Веру): выключаем Осады, Шпионаж, Твердыни
  for (const k of ['sieges', 'spy', 'holds']) { await p.click(`.modlist .mod[data-k="${k}"]`); await p.waitForTimeout(150); }
  m = await modsOn();
  ok('переключатели работают по одному: остались Вера и Беды', m.bad && m.faith && !m.sieges && !m.spy && !m.holds, JSON.stringify(m));
  // недоступные Дома остаются в списке, но серые и не нажимаются
  const hs = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.houses .house')].map(x => [x.dataset.h, x.classList.contains('off') && x.disabled])));
  ok('без Шпионажа Дом Розы недоступен, без Осад — Дом Волка; Олени доступны', hs.rose && hs.wolf && !hs.deer, JSON.stringify(hs));
  await p.click('[data-act="start"]'); await p.waitForTimeout(1500);
  const g = await p.evaluate(() => { const S = window.__VD.S; const est = [...S.estateDeck, ...S.estateRow], court = [...S.courtDeck, ...S.courtRow]; return { mod: S.mod, curses: est.filter(x => DATA.ESTATES[x].t === 'bad').length, wall: est.includes('wall'), schemes: court.filter(x => DATA.COURT[x].scheme).length, spyCards: court.filter(x => ['blackmailer', 'courtesan', 'agitator', 'recruiter'].includes(x)).length, holds: S.holdDeck.length + S.holdRow.length }; });
  ok('партия с Бедами (и Верой): 7 проклятий с Проклятой реликвией, козни, Каменная стена; шпионов и твердынь нет', g.mod.bad && !g.mod.spy && g.curses === 7 && g.wall && g.schemes > 0 && g.spyCards === 0 && g.holds === 0, JSON.stringify(Object.assign({}, g, { mod: undefined })));
  // 3. «Все карты»: в фильтре по наборам — четыре бывшие части «Вражды»
  await p.evaluate(() => { const m = [...document.querySelectorAll('[data-act="menu"]')].find(x => x.offsetParent !== null); if (m) m.click(); }); await p.waitForTimeout(400);
  await p.evaluate(() => { const c = [...document.querySelectorAll('[data-m="catalog"]')].find(x => x.offsetParent !== null); if (c) c.click(); }); await p.waitForTimeout(700);
  const sets = await p.evaluate(() => { const pg = [...document.querySelectorAll('.page')].pop(); return pg ? pg.innerText.replace(/\s+/g, ' ') : ''; });
  ok('«Все карты»: кнопки «Осады», «Шпионаж», «Беды», «Твердыни»', /Осады/.test(sets) && /Шпионаж/.test(sets) && /Беды/.test(sets) && /Твердыни/.test(sets), sets.slice(0, 160));
  await p.evaluate(() => { for (const s of document.querySelectorAll('.page, .scrim')) if (s.close) s.close(); }); await p.waitForTimeout(300);
  // 4. правила: у Бед и Твердынь свои страницы
  const pages = await p.evaluate(() => [...document.querySelectorAll('[data-mr]')].map(x => x.dataset.mr).join(','));
  await p.evaluate(() => { const m = [...document.querySelectorAll('[data-act="menu"]')].find(x => x.offsetParent !== null); if (m) m.click(); }); await p.waitForTimeout(400);
  await p.evaluate(() => { const r = [...document.querySelectorAll('[data-m="rules"]')].find(x => x.offsetParent !== null); if (r) r.click(); }); await p.waitForTimeout(700);
  const mr = await p.evaluate(() => [...document.querySelectorAll('.page [data-mr]')].map(x => x.dataset.mr).join(','));
  ok('правила: страницы модулей Осады, Шпионаж, Беды, Твердыни', ['sieges', 'spy', 'bad', 'holds'].every(k => mr.split(',').includes(k)), mr || pages);
  await p.evaluate(() => { const x = document.querySelector('.page [data-mr="bad"]'); if (x) x.click(); }); await p.waitForTimeout(700);
  const badPage = await p.evaluate(() => { const pg = [...document.querySelectorAll('.page')].pop(); return pg ? pg.innerText.replace(/\s+/g, ' ') : ''; });
  ok('страница «Беды»: проклятия, козни, бросок «против стражи»', /Беды/.test(badPage) && /Проклятие/.test(badPage) && /Козни/.test(badPage) && /против стражи/.test(badPage), badPage.slice(0, 140));

  // 5. сохранение до 10.25: в S.mod нет «bad» и «holds» — беды шли со шпионажем, твердыни — с осадами или шпионажем
  await open(prefs({ mods: ['lords', 'great', 'faith', 'sieges', 'spy'], v25: 1 }));
  await p.click('[data-act="setup"]'); await p.waitForTimeout(300); await p.click('[data-act="start"]');
  let s0 = null; for (let i = 0; i < 40 && !s0; i++) { s0 = await p.evaluate((k) => localStorage.getItem(k), SAVE_KEY); if (!s0) await p.waitForTimeout(150); }
  const old = (spy, sieges) => { const x = JSON.parse(s0), S = JSON.parse(x.S); S.mod.spy = spy; S.mod.sieges = sieges; delete S.mod.bad; delete S.mod.holds; x.S = JSON.stringify(S); return JSON.stringify(x); };
  for (const [spy, sieges, want] of [[true, true, { bad: true, holds: true }], [false, false, { bad: false, holds: false }], [false, true, { bad: false, holds: true }]]) {
    await open('#inject=' + encodeURIComponent(old(spy, sieges)));
    const cont = await p.evaluate(() => { const c = document.querySelector('[data-act="continue"]'); if (c) c.click(); return !!c; }); await p.waitForTimeout(900);
    const md = await p.evaluate(() => (window.__VD.S ? { bad: window.__VD.S.mod.bad, holds: window.__VD.S.mod.holds } : null));
    ok(`старое сохранение (шпионаж ${spy ? 'да' : 'нет'}, осады ${sieges ? 'да' : 'нет'}): Беды ${want.bad ? 'да' : 'нет'}, Твердыни ${want.holds ? 'да' : 'нет'}`, cont && md && md.bad === want.bad && md.holds === want.holds, JSON.stringify(md));
  }
  ok('ошибок страницы нет', !errs.length, errs.join(' | '));
  console.log(res.join('\n'));
  await b.close();
})();
