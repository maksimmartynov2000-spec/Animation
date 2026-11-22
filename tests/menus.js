// v10.2: меню и листы. node menus.js [dev] [what…]
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
const DEV = { i15: [393, 852, 59, 34], mini: [744, 1133, 24, 20], minil: [1133, 744, 24, 20], mac: [1512, 900, 0, 0], i15l: [852, 393, 0, 21] };
const dev = process.argv[2] || 'i15'; const what = process.argv.slice(3);
const want = (k) => !what.length || what.includes(k);
(async () => {
  const [w, h, st, sb] = DEV[dev];
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: dev !== 'mac', isMobile: dev !== 'mac', reducedMotion: 'reduce' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.addInitScript(([pair]) => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: 'wolf', opps: 1, speed: 'turbo', mods: ['lords', 'faith', 'plots', 'seats'], tut: 0, coins: false })); if (pair) localStorage.setItem('pretendenty-pair-v1', JSON.stringify({ role: 'host', code: 'KVMTR', peer: 'Аня', w: 2, l: 1 })); } catch (e) {} }, [process.env.PAIR === '1']);
  await p.goto('file://' + (process.env.FILE || SP + 'test-embed.html'));
  await p.addStyleTag({ content: `:root{--sat:${st}px!important;--sab:${sb}px!important}` });
  await p.waitForSelector('#splash', { state: 'detached', timeout: 5000 }).catch(() => {});
  const shot = async (k) => { await p.waitForTimeout(400); await p.screenshot({ path: SP + `v10/m-${dev}-${k}.png` }); console.log('кадр', k); };
  const closeSheet = async () => { await p.evaluate(() => { const s = [...document.querySelectorAll('.scrim:not(.out)')].pop(); if (s && s.close) s.close(); }); await p.waitForTimeout(350); };
  if (want('home')) await shot('home');
  if (want('duo')) { await p.click('[data-act="duo-other"]').catch(() => p.click('[data-act="duo"]')); await shot('duo'); await closeSheet(); }
  if (want('settings')) { await p.click('[data-act="settings"]'); await shot('settings'); await p.evaluate(() => { const s = document.querySelector('.scrim .sheet, .page .pbody'); if (s) s.scrollTop = 600; }); await shot('settings2'); await closeSheet(); await p.evaluate(() => { const pg = [...document.querySelectorAll('.page:not(.out)')].pop(); if (pg && pg.close) pg.close(); }); await p.waitForTimeout(300); }
  if (want('rules')) { await p.click('[data-act="rules"]'); await shot('rules'); await p.evaluate(() => { const pg = [...document.querySelectorAll('.page:not(.out)')].pop(); if (pg && pg.close) pg.close(); }); await p.waitForTimeout(300); }
  if (want('aid')) { await p.click('[data-act="aid"]'); await shot('aid'); await p.evaluate(() => { const b = document.querySelector('.page:not(.out) .page-body'); if (b) b.scrollTop = 900; }); await shot('aid2'); await p.evaluate(() => { const pg = [...document.querySelectorAll('.page:not(.out)')].pop(); if (pg && pg.close) pg.close(); }); await p.waitForTimeout(300); }
  if (want('rules2')) { await p.click('[data-act="rules"]'); await p.waitForTimeout(300); await p.evaluate(() => { const d = document.querySelectorAll('.page:not(.out) details.rsec')[2]; if (d) d.open = true; const b = document.querySelector('.page:not(.out) .page-body'); if (b) b.scrollTop = 640; }); await shot('rules2'); await p.evaluate(() => { const pg = [...document.querySelectorAll('.page:not(.out)')].pop(); if (pg && pg.close) pg.close(); }); await p.waitForTimeout(300); }
  if (want('catalog')) { await p.click('[data-act="catalog"]'); await shot('catalog'); await p.evaluate(() => { const pg = [...document.querySelectorAll('.page:not(.out)')].pop(); if (pg && pg.close) pg.close(); }); await p.waitForTimeout(300); }
  if (want('setup')) { await p.click('[data-act="setup"]'); await shot('setup'); await p.evaluate(() => window.scrollTo(0, 700)); await shot('setup2'); await p.evaluate(() => window.scrollTo(0, 0)); await p.click('[data-act="home"]', { timeout: 1500 }).catch(() => {}); await p.waitForTimeout(300); }
  if (want('join')) { await p.click('[data-act="duo-other"]').catch(() => p.click('[data-act="duo"]')); await p.waitForTimeout(300); await p.click('[data-f="join"]').catch(() => {}); await shot('join'); await p.click('[data-act="home"]', { timeout: 1500 }).catch(() => {}); await p.waitForTimeout(300); }
  if (want('results')) {
    await p.click('[data-act="setup"]'); await p.waitForTimeout(300); await p.click('[data-act="start"]'); await p.waitForTimeout(500);
    // доиграть быстро: человек делает минимум
    for (let it = 0; it < 4000; it++) {
      const r = await p.evaluate(() => {
        const vis = (el) => el && el.offsetParent !== null && !el.disabled, q = (s) => [...document.querySelectorAll(s)].filter(vis);
        const V = window.__VD, S = V.S; if (!S) return 'none'; if (S.winner !== null) return 'over';
        const sh = [...document.querySelectorAll('.scrim:not(.out)')].pop();
        if (sh) { const o = [...sh.querySelectorAll('[data-v]')].filter(vis); if (o.length) { o[0].click(); return 'sheet'; } const bt = [...sh.querySelectorAll('button.primary')].filter(vis)[0] || [...sh.querySelectorAll('[data-close]')].filter(vis)[0]; if (bt) { bt.click(); return 'sheet'; } }
        for (const a of ['coin-all', 'step-ok', 'adj-ok', 'next']) { const el = q(`[data-act="${a}"]`)[0]; if (el) { el.click(); return a; } }
        if (!V.isMyTurn() || V.busy) return 'wait';
        const me = S.players[V.ME];
        if (!me.turn.rolled) { const a = q('.abar [data-act="play-all"]')[0]; if (a) { a.click(); return 'all'; } const r = q('.abar [data-act="roll"]'); if (r.length) { r[r.length - 1].click(); return 'roll'; } return 'wait'; }
        const sbn = q('.shopcol .buyb.ok'); if (sbn.length && !window.__t) { window.__t = 1; sbn[sbn.length - 1].click(); return 'buy'; }
        if (!V.layout.big && !window.__t) { if (!V.drawer) { window.__o = (window.__o || 0) + 1; const d = q('.abar [data-act="drawer"]'); if (d[window.__o % 2]) { d[window.__o % 2].click(); return 'open'; } } else { const bb = q('.drawer .buyb.ok'); window.__t = 1; if (bb.length) { bb[bb.length - 1].click(); return 'buy'; } q('.drawer [data-act="drawer-close"]')[0].click(); return 'close'; } }
        window.__t = 0; const e = q('.abar [data-act="end"]')[0]; if (e) { e.click(); return 'end'; } return 'wait';
      });
      if (r === 'over') break; await p.waitForTimeout(r === 'wait' ? 40 : 25);
    }
    await p.waitForTimeout(1500); await shot('results');
    await p.evaluate(() => { const s = document.querySelector('.page.results .pbody, .page.results'); const sc = [...document.querySelectorAll('.page.results *')].find(e => e.scrollHeight > e.clientHeight + 40 && getComputedStyle(e).overflowY !== 'visible'); if (sc) sc.scrollTop = 9999; }); await shot('results2');
    await p.evaluate(() => { const pg = [...document.querySelectorAll('.page:not(.out)')].pop(); if (pg && pg.close) pg.close(); }); await shot('ended');
    console.log(JSON.stringify(await p.evaluate(() => { const S = window.__VD.S; return { round: S.round, xs: S.xs, stats: S.players.map(q => q.stats) }; })).slice(0, 900));
  }
  console.log('ошибки', errs.slice(0, 6));
  await b.close();
})();
