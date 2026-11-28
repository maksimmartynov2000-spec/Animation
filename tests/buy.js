// v10.4: покупка из открытой карты и заметное золото. node buy.js [dev]
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
const DEV = { i15: [393, 852, 59, 34], mini: [744, 1133, 24, 20], mac: [1512, 900, 0, 0] };
const dev = process.argv[2] || 'i15';
(async () => {
  const [w, h, st, sb] = DEV[dev];
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: dev !== 'mac', isMobile: dev !== 'mac' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.addInitScript(() => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: 'deer', opps: 1, speed: 'fast', mods: ['lords', 'faith'], tut: 0, coins: false, sound: false, music: false })); } catch (e) {} });
  await p.goto('file://' + (process.env.FILE || SP + 'test-embed.html'));
  await p.addStyleTag({ content: `:root{--sat:${st}px!important;--sab:${sb}px!important}` });
  await p.waitForSelector('#splash', { state: 'detached', timeout: 5000 }).catch(() => {});
  const res = []; const ok = (n, v, x) => res.push((v ? 'OK  ' : 'FAIL ') + n + (x ? ' — ' + x : ''));
  const shot = async (k) => { await p.waitForTimeout(300); await p.screenshot({ path: SP + `v10/buy-${dev}-${k}.png` }); };
  const stt = () => p.evaluate(() => { const V = window.__VD, S = V.S, me = S.players[V.ME]; return { my: V.isMyTurn(), rolled: me.turn.rolled, gold: me.gold, est: me.estates.length, disc: me.discard.length + me.inPlay.length, bans: me.vassals.length, busy: V.busy, big: V.layout.big, drawer: V.drawer, left: 1 }; });
  const waitMy = async () => { for (let i = 0; i < 400; i++) { const s = await stt(); if (s.my && !s.busy && !(await p.evaluate(() => document.body.classList.contains('dealing')))) return s; await p.waitForTimeout(100); } return stt(); };
  const bar = () => p.evaluate(() => { const b = document.querySelector('.scrim:not(.out) .buybar [data-buyproxy]'); if (!b) return null; const r = b.getBoundingClientRect(); return { text: b.innerText.replace(/\s+/g, ' '), off: b.disabled, inView: r.top >= 0 && r.bottom <= innerHeight + 1, y: Math.round(r.top) }; });
  const closeSheet = async () => { await p.evaluate(() => { const s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); if (s && s.close) s.close(); }); await p.waitForTimeout(350); };
  await p.click('[data-act="setup"]'); await p.waitForTimeout(400); await p.click('[data-act="start"]');
  let s = await waitMy(); await p.waitForTimeout(600);
  // золото на планке и в шапке рынка
  const g1 = await p.evaluate(() => { const g = document.querySelector('.pbar.own .goldbig'), r = g.getBoundingClientRect(), cs = getComputedStyle(g); return { w: Math.round(r.width), h: Math.round(r.height), fs: cs.fontSize, color: cs.color, text: g.innerText.trim() }; });
  ok('золото на планке — заметная «казна»', g1.h >= 34 && parseFloat(g1.fs) >= 23 && String(s.gold) === g1.text, JSON.stringify(g1));
  await shot('1-board');
  if (!s.big) { await p.click('.abar [data-act="drawer"][data-d="market"]'); await p.waitForTimeout(450); }
  const g2 = await p.evaluate(() => { const g = [...document.querySelectorAll('.dh .dgold')].filter(e => e.offsetParent !== null)[0]; return g ? g.innerText.replace(/\s+/g, ' ') : ''; });
  ok('в шапке рынка — «у вас N»', /у вас/.test(g2) && g2.includes(String(s.gold)), g2);
  await shot('2-market');
  // до броска: карта открыта, кнопка серая с причиной
  const scope = s.big ? '.shopcol .shop.mk' : '.drawer';
  await p.click(`${scope} .mslot .mcard[data-act="info-estate"]`); await p.waitForTimeout(500);
  let bb = await bar();
  ok('до броска: планка есть, серая, с причиной и ценой', !!bb && bb.off && /после броска/i.test(bb.text) && /цена/.test(bb.text) && /у вас/.test(bb.text) && bb.inView, JSON.stringify(bb));
  await shot('3-before');
  // листаем к соседней карте — планка обновляется
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(500);
  const bb2 = await bar(); ok('после листания планка на месте', !!bb2 && bb2.inView, JSON.stringify(bb2));
  await closeSheet();
  if (!s.big) { await p.evaluate(() => { const c = document.querySelector('.drawer [data-act="drawer-close"]'); if (c) c.click(); }); await p.waitForTimeout(300); }
  // сыграть всё, бросить
  await p.evaluate(() => { const a = document.querySelector('.abar [data-act="play-all"]'); if (a && !a.disabled) a.click(); }); await p.waitForTimeout(900);
  // v10.22: «Сыграть все» играет и фамильные карты с окном выбора (Меняла, Соты, Подмена) — отвечаем «не меняться» / первым вариантом
  for (let g = 0; g < 4; g++) { const any = await p.evaluate(() => { const sc = [...document.querySelectorAll('.scrim:not(.out)')].pop(); if (!sc) return false; const bs = [...sc.querySelectorAll('.optlist [data-v]')]; const b = bs.find(x => /Не меняться|Отказаться/.test(x.innerText)) || bs[0]; if (b) b.click(); return !!b; }); if (!any) break; await p.waitForTimeout(700); }
  await p.evaluate(() => { const r = [...document.querySelectorAll('.abar [data-act="roll"]')].pop(); if (r) r.click(); }); await p.waitForTimeout(2800);
  s = await stt();
  if (!s.big) { await p.click('.abar [data-act="drawer"][data-d="market"]'); await p.waitForTimeout(450); }
  // открыть карту, которую можно купить
  const pick = await p.evaluate((scope) => { const sl = [...document.querySelectorAll(`${scope} .mslot`)].filter(x => { const b = x.querySelector('.buyb.ok[data-act="buy"]'); return b && !b.disabled; })[0]; if (!sl) return null; const c = sl.querySelector('.mcard'); c.click(); return { act: c.dataset.act, id: c.dataset.id }; }, scope);
  await p.waitForTimeout(550);
  bb = await bar();
  ok('после броска: «Купить за …» активна', !!pick && !!bb && !bb.off && /Купить за/.test(bb.text) && /у вас/.test(bb.text) && bb.inView, JSON.stringify([pick, bb]));
  await shot('4-can');
  await p.evaluate(() => { const sh = document.querySelector('.scrim:not(.out) .sheet'); if (sh) sh.scrollTop = 260; }); await p.waitForTimeout(250);
  const bb3 = await bar(); ok('при прокрутке листа планка остаётся на виду', !!bb3 && bb3.inView, JSON.stringify(bb3));
  await shot('5-scrolled');
  await p.evaluate(() => { window.__fly = 0; window.__ivF = setInterval(() => { window.__fly = Math.max(window.__fly, document.querySelectorAll('.flyc').length); }, 16); });
  await p.click('.scrim:not(.out) .buybar [data-buyproxy]');
  await p.waitForTimeout(330); await shot('6-fly');
  await p.waitForTimeout(1300);
  const s2 = await stt(), fly = await p.evaluate(() => { clearInterval(window.__ivF); return window.__fly; });
  const bought = pick && pick.act === 'info-estate' ? s2.est === s.est + 1 : s2.disc === s.disc + 1;
  ok('покупка из листа прошла, лист закрылся, карта летела', bought && fly >= 1 && s2.gold < s.gold && !(await p.evaluate(() => !!document.querySelector('.scrim:not(.out)'))), `золото ${s.gold}→${s2.gold}, владений ${s.est}→${s2.est}, сброс ${s.disc}→${s2.disc}, в полёте ${fly}`);
  await shot('7-after');
  console.log(res.join('\n')); console.log('ошибки', errs.slice(0, 5));
  await b.close();
})();
