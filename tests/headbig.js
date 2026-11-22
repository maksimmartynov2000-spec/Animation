// v10.4: шапки колонок «Рынок»/«Знамёна» на больших экранах — подсказка не обрезается, высота не скачет. node headbig.js [dev ...]
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
const DEV = { mini: [744, 1133], minil: [1133, 744], minis: [744, 1010], ipad: [834, 1194], ipadl: [1194, 834], macs: [1280, 720], mac: [1512, 900], pro: [1024, 1366] };
(async () => {
  const b = await chromium.launch(); let bad = 0; const errs = [];
  for (const dev of (process.argv.length > 2 ? process.argv.slice(2) : Object.keys(DEV))) {
    const [w, h] = DEV[dev];
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: !/mac/.test(dev), isMobile: !/mac/.test(dev) }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: 'deer', opps: 1, speed: 'slow', mods: ['lords', 'faith'], tut: 0, coins: false, sound: false, music: false })); } catch (e) {} });
    await p.goto('file://' + (process.env.FILE || SP + 'test-embed.html'));
    await p.waitForSelector('#splash', { state: 'detached', timeout: 5000 }).catch(() => {});
    await p.click('[data-act="setup"]'); await p.waitForTimeout(400); await p.click('[data-act="start"]');
    for (let i = 0; i < 400; i++) { if (await p.evaluate(() => window.__VD.isMyTurn() && !window.__VD.busy && !document.body.classList.contains('dealing'))) break; await p.waitForTimeout(100); }
    await p.waitForTimeout(700);
    const m = () => p.evaluate(() => ['mk', 'rg'].map(k => { const dh = document.querySelector(`.shop.${k} .dh`); if (!dh) return null; const s = dh.querySelector('.dsub'), g = dh.querySelector('.dgold'); return { k, h: Math.round(dh.getBoundingClientRect().height), sub: s.innerText.replace(/\s+/g, ' '), sw: Math.round(s.getBoundingClientRect().width), need: s.scrollWidth, clip: s.scrollHeight > s.clientHeight + 1 || s.scrollWidth > s.clientWidth + 1, gold: g ? g.innerText.replace(/\s+/g, ' ') : '' }; }));
    const hs = []; const chk = async (name) => { const xs = await m(); for (const x of xs) { const ok = x && !x.clip; if (!ok) bad++; if (x) hs.push(x.h); console.log(`${ok ? 'OK  ' : 'FAIL '}${dev} ${name} ${x && x.k}: «${x && x.sub}» нужно ${x && x.need} из ${x && x.sw}, шапка ${x && x.h}, ${x && x.gold}`); } };
    const pw = await p.evaluate(() => Math.round(window.__VD.layout.panelW) + ' ' + window.__VD.layout.mode); console.log(`— ${dev} ${w}×${h}: колонка ${pw}`);
    await chk('до броска');
    await p.evaluate(() => { const V = window.__VD; V.S.players[V.ME].gold = 188; V.redraw(); }); await p.waitForTimeout(300);
    await chk('до броска, золота 188');
    await p.evaluate(() => { const r = [...document.querySelectorAll('.abar [data-act="roll"]')].pop(); if (r) r.click(); });
    for (let i = 0; i < 80; i++) { if (await p.evaluate(() => { const V = window.__VD; return V.S.players[V.ME].turn.rolled && !V.busy && !!document.querySelector('.abar [data-act="end"]'); })) break; await p.evaluate(() => { for (const a of ['coin-all', 'adj-ok', 'step-ok', 'next']) { const x = document.querySelector(`.abar [data-act="${a}"]`); if (x && !x.disabled) { x.click(); break; } } }); await p.waitForTimeout(150); }
    await p.evaluate(() => { const V = window.__VD; V.S.players[V.ME].gold = 188; V.redraw(); }); await p.waitForTimeout(250);
    await chk('после броска');
    await p.evaluate(() => { const V = window.__VD, S = V.S, me = S.players[V.ME]; me.turn.buysUsed = 9; me.turn.catchupHire = 1; S.catchup = S.catchup || []; S.catchup[V.ME] = 1; V.redraw(); }); await p.waitForTimeout(300);
    await chk('догоняющий наём');
    if (dev === 'mini' || dev === 'mac') await p.screenshot({ path: SP + `v10/headbig-${dev}.png` });
    await p.evaluate(() => { const V = window.__VD, me = V.S.players[V.ME]; me.turn.catchupHire = 0; V.redraw(); }); await p.waitForTimeout(250);
    await chk('действий нет');
    for (let i = 0; i < 6; i++) { const done = await p.evaluate(() => { const V = window.__VD; if (!V.isMyTurn()) return true; const x = document.querySelector('.abar [data-act="end"]'); if (x && !x.disabled) x.click(); return false; }); if (done) break; await p.waitForTimeout(350); }
    await p.waitForTimeout(500);
    if (await p.evaluate(() => !window.__VD.isMyTurn())) await chk('чужой ход'); else { bad++; console.log('FAIL ход не завершился'); }
    const uniq = [...new Set(hs)];
    if (uniq.length > 1) { bad++; console.log(`FAIL ${dev} высота шапки скачет: ${uniq.join(', ')}`); } else console.log(`OK  ${dev} высота шапки одна: ${uniq[0]}`);
    await ctx.close();
  }
  console.log(bad ? `ПРОВАЛОВ ${bad}` : 'всё в порядке'); console.log('ошибки', errs.slice(0, 4));
  await b.close();
})();
