// v10.11: незаконченная партия из прошлой версии (в ней карта, которой больше нет) не ломает игру — сохранение сбрасывается,
// на главном экране сообщение. Карту ищем во всех стопках: у игрока, на рынке, в колоде двора; v10.14 — и по виду карты. node save.js [file]
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
const FILE = process.argv[2] || (SP + 'test-embed.html');
const SAVE_KEY = 'velikie-doma-save-v1';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); p.setDefaultTimeout(4000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const res = []; const ok = (name, cond, info) => res.push(`${cond ? 'OK ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`);
  // испорченное сохранение подкладываем при загрузке страницы, до запуска игры: запись из старой страницы прямо перед
  // перезагрузкой браузер иногда не успевает сохранить — новая страница её не видит, и тест ложно падает
  await p.addInitScript((k) => { const m = location.hash.match(/^#inject=(.*)$/); if (m) { try { localStorage.setItem(k, decodeURIComponent(m[1])); } catch (e) {} history.replaceState(null, '', location.pathname + location.search); } }, SAVE_KEY);
  // v10.22: соперник — любой Дом, кроме Розы: её Тайная канцелярия шпионит в начале её хода, и окно откупа открылось бы ещё до вашего хода
  const OPP = ['deer', 'owl', 'wolf', 'serpent', 'bear', 'lion', 'sun'].filter(h => h !== 'deer')[Math.floor(Math.random() * 6)];
  await p.addInitScript((opp) => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: 'deer', seats: [{ type: 'bot', house: opp }], opps: 1, speed: 'turbo', mods: ['lords', 'faith', 'plots', 'seats', 'sieges', 'spy'], coins: true })); } catch (e) {} }, OPP);
  const home = async () => { await p.waitForSelector('#splash', { state: 'detached', timeout: 6000 }).catch(() => {}); await p.waitForTimeout(400); };
  const hasCont = () => p.evaluate(() => !!document.querySelector('[data-act="continue"]'));
  const toastSeen = async () => { for (let i = 0; i < 30; i++) { const t = await p.evaluate(() => [...document.querySelectorAll('.toast')].map(x => x.innerText).join(' | ')); if (/прошлой версии/.test(t)) return t; await p.waitForTimeout(150); } return ''; };
  const saved = () => p.evaluate((k) => localStorage.getItem(k), SAVE_KEY);
  // испортить сохранение: вписать карту, которой нет в игре, в нужную стопку
  const spoil = (save, where, id = 'debt') => { const g = JSON.parse(save); const S = JSON.parse(g.S); if (where === 'hand') S.players[0].hand.push(id); else S[where].unshift(id); g.S = JSON.stringify(S); return JSON.stringify(g); };
  const openWith = async (save) => { await p.goto('about:blank'); await p.goto('file://' + FILE + '#inject=' + encodeURIComponent(save)); await home(); };

  await p.goto('file://' + FILE); await home();
  await p.click('[data-act="setup"]'); await p.waitForTimeout(300); await p.click('[data-act="start"]');
  for (let i = 0; i < 40 && !(await saved()); i++) await p.waitForTimeout(150);
  const s0 = await saved();
  ok('партия началась и сохранилась', !!s0);
  // 1. обычное сохранение открывается как раньше
  await openWith(s0);
  ok('обычное сохранение: на главном экране «Продолжить партию»', await hasCont());
  ok('обычное сохранение: сообщения о прошлой версии нет', !(await toastSeen()));
  // 2–4. карта из прошлой версии в разных стопках — сохранение сбрасывается, игра говорит почему
  // v10.14: и карта, которая сменила вид — беда двора «Сглаз» стала проклятием-владением
  for (const [where, name, id] of [['hand', 'в руке игрока'], ['courtRow', 'на рынке'], ['courtDeck', 'в колоде двора'], ['hand', 'в руке игрока («Сглаз» — теперь проклятие)', 'evileye']]) {
    await openWith(spoil(s0, where, id));
    const t = await toastSeen();
    ok(`карта из прошлой версии ${name}: «Продолжить» нет, сохранение убрано`, !(await hasCont()) && !(await saved()));
    ok(`карта из прошлой версии ${name}: сообщение на главном экране`, !!t, t);
  }
  // 5. после сброса новая партия начинается как обычно
  await p.click('[data-act="setup"]'); await p.waitForTimeout(300); await p.click('[data-act="start"]'); await p.waitForTimeout(900);
  ok('после сброса новая партия начинается', await p.evaluate(() => !!(window.__VD && window.__VD.S)));
  console.log(res.join('\n')); console.log('ошибки', errs.slice(0, 5));
  await b.close();
})();
