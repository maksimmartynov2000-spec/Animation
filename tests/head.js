// v10.4: шапка листа «Рынок»/«Знамёна» на телефоне — подсказка не обрезается, высота шапки не скачет. node head.js
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
(async () => {
  const b = await chromium.launch(); let bad = 0; const errs = [];
  for (const [w, h] of [[393, 852], [430, 932], [375, 667], [320, 568], [852, 393]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: 'deer', opps: 1, speed: 'slow', mods: ['lords', 'faith'], tut: 0, coins: false, sound: false, music: false })); } catch (e) {} });
    await p.goto('file://' + (process.env.FILE || SP + 'test-embed.html'));
    await p.waitForSelector('#splash', { state: 'detached', timeout: 5000 }).catch(() => {});
    await p.click('[data-act="setup"]'); await p.waitForTimeout(400); await p.click('[data-act="start"]');
    for (let i = 0; i < 400; i++) { if (await p.evaluate(() => window.__VD.isMyTurn() && !window.__VD.busy && !document.body.classList.contains('dealing'))) break; await p.waitForTimeout(100); }
    await p.waitForTimeout(700);
    const m = () => p.evaluate(() => { const dh = [...document.querySelectorAll('.drawer .dh')].filter(e => e.offsetParent)[0]; if (!dh) return null; const s = dh.querySelector('.dsub'), g = dh.querySelector('.dgold'); return { h: Math.round(dh.getBoundingClientRect().height), sub: s.innerText.replace(/\s+/g, ' '), sw: Math.round(s.getBoundingClientRect().width), sh: Math.round(s.getBoundingClientRect().height), clip: s.scrollHeight > s.clientHeight + 1 || s.scrollWidth > s.clientWidth + 1, gold: g ? g.innerText.replace(/\s+/g, ' ') : '' }; });
    const open = async (d) => { await p.evaluate((d) => { if (window.__VD.drawer !== d) document.querySelector(`.abar [data-act="drawer"][data-d="${d}"]`).click(); }, d); await p.waitForTimeout(450); };
    const hs = []; const chk = async (name) => { for (const d of ['market', 'regalia']) { await open(d); const x = await m(); const ok = x && !x.clip; if (!ok) bad++; if (x) hs.push(x.h); console.log(`${ok ? 'OK  ' : 'FAIL '}${w}px ${name} ${d}: «${x && x.sub}» ${x && x.sw}×${x && x.sh}, шапка ${x && x.h}, ${x && x.gold}`); } };
    await chk('до броска');
    await p.evaluate(() => { const V = window.__VD; V.S.players[V.ME].gold = 88; V.redraw(); }); await p.waitForTimeout(300);
    await chk('до броска, золота 88');
    if (w === 393) await p.screenshot({ path: SP + 'v10/head-1.png' });
    await p.evaluate(() => { const c = document.querySelector('.drawer [data-act="drawer-close"]'); if (c) c.click(); }); await p.waitForTimeout(350);
    await p.evaluate(() => { const r = [...document.querySelectorAll('.abar [data-act="roll"]')].pop(); if (r) r.click(); });
    for (let i = 0; i < 80; i++) { if (await p.evaluate(() => { const V = window.__VD; return V.S.players[V.ME].turn.rolled && !V.busy && !!document.querySelector('.abar [data-act="end"]'); })) break; await p.evaluate(() => { for (const a of ['coin-all', 'adj-ok', 'step-ok', 'next']) { const x = document.querySelector(`.abar [data-act="${a}"]`); if (x && !x.disabled) { x.click(); break; } } }); await p.waitForTimeout(150); }
    await chk('после броска');
    if (w === 393) await p.screenshot({ path: SP + 'v10/head-2.png' });
    // догоняющий наём — самая длинная подсказка: действий нет, но можно нанять вассала
    await p.evaluate(() => { const V = window.__VD, S = V.S, me = S.players[V.ME]; me.turn.buysUsed = 9; me.turn.catchupHire = 1; S.catchup = S.catchup || []; S.catchup[V.ME] = 1; V.redraw(); }); await p.waitForTimeout(300);
    await chk('догоняющий наём');
    await p.evaluate(() => { const V = window.__VD, me = V.S.players[V.ME]; me.turn.catchupHire = 0; V.redraw(); }); await p.waitForTimeout(250);
    await chk('действий нет');
    await p.evaluate(() => { const c = document.querySelector('.drawer [data-act="drawer-close"]'); if (c) c.click(); }); await p.waitForTimeout(350);
    for (let i = 0; i < 6; i++) { const done = await p.evaluate(() => { const V = window.__VD; if (!V.isMyTurn()) return true; const x = document.querySelector('.abar [data-act="end"]'); if (x && !x.disabled) x.click(); return false; }); if (done) break; await p.waitForTimeout(350); }
    await p.waitForTimeout(500);
    if (await p.evaluate(() => !window.__VD.isMyTurn())) { await chk('чужой ход'); if (w === 393) await p.screenshot({ path: SP + 'v10/head-3.png' }); } else { bad++; console.log('FAIL ход не завершился'); }
    const uniq = [...new Set(hs)];
    if (uniq.length > 1) { bad++; console.log(`FAIL ${w}px высота шапки скачет: ${uniq.join(', ')}`); } else console.log(`OK  ${w}px высота шапки одна: ${uniq[0]}`);
    await ctx.close();
  }
  console.log(bad ? `ПРОВАЛОВ ${bad}` : 'всё в порядке'); console.log('ошибки', errs.slice(0, 4));
  await b.close();
})();
