// v10.11: незаконченная партия из прошлой версии (в ней карта, которой больше нет) не ломает игру — сохранение сбрасывается,
// на главном экране сообщение. Карту ищем во всех стопках: у игрока, на рынке, в колоде двора. node save.js [file]
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
const FILE = process.argv[2] || (SP + 'test-embed.html');
const SAVE_KEY = 'velikie-doma-save-v1';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); p.setDefaultTimeout(4000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const res = []; const ok = (name, cond, info) => res.push(`${cond ? 'OK ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`);
  await p.addInitScript(() => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: 'deer', opps: 1, speed: 'turbo', mods: ['lords', 'faith', 'plots', 'seats', 'sieges', 'spy'], coins: true })); } catch (e) {} });
  const home = async () => { await p.waitForSelector('#splash', { state: 'detached', timeout: 6000 }).catch(() => {}); await p.waitForTimeout(400); };
  const hasCont = () => p.evaluate(() => !!document.querySelector('[data-act="continue"]'));
  const toastSeen = async () => { for (let i = 0; i < 30; i++) { const t = await p.evaluate(() => [...document.querySelectorAll('.toast')].map(x => x.innerText).join(' | ')); if (/прошлой версии/.test(t)) return t; await p.waitForTimeout(150); } return ''; };
  const saved = () => p.evaluate((k) => localStorage.getItem(k), SAVE_KEY);
  // испортить сохранение: вписать карту, которой нет в игре, в нужную стопку
  const plant = (where) => p.evaluate(([k, where]) => { const g = JSON.parse(localStorage.getItem(k)); const S = JSON.parse(g.S); if (where === 'hand') S.players[0].hand.push('debt'); else S[where].unshift('debt'); g.S = JSON.stringify(S); localStorage.setItem(k, JSON.stringify(g)); }, [SAVE_KEY, where]);

  await p.goto('file://' + FILE); await home();
  await p.click('[data-act="setup"]'); await p.waitForTimeout(300); await p.click('[data-act="start"]');
  for (let i = 0; i < 40 && !(await saved()); i++) await p.waitForTimeout(150);
  const s0 = await saved();
  ok('партия началась и сохранилась', !!s0);
  // 1. обычное сохранение открывается как раньше
  await p.reload(); await home();
  ok('обычное сохранение: на главном экране «Продолжить партию»', await hasCont());
  ok('обычное сохранение: сообщения о прошлой версии нет', !(await toastSeen()));
  // 2–4. карта из прошлой версии в разных стопках — сохранение сбрасывается, игра говорит почему
  for (const [where, name] of [['hand', 'в руке игрока'], ['courtRow', 'на рынке'], ['courtDeck', 'в колоде двора']]) {
    await p.evaluate(([k, v]) => localStorage.setItem(k, v), [SAVE_KEY, s0]); await plant(where);
    await p.reload(); await home();
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
