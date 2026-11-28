// v10: партии кликами на новом экране. Человек (игрок 0) жмёт случайные доступные кнопки, отвечает на окна выбора; ловим ошибки и зависания
// node monkey.js games=2 turns=200 [house=owl] [opps=1] [mods=...] [w=393 h=852] [rm=0]
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
const ARGS = Object.fromEntries(process.argv.slice(2).map(a => a.split('=')));
const GAMES = +(ARGS.games || 1), OPPS = +(ARGS.opps || 1), LIMIT = +(ARGS.turns || 400), W = +(ARGS.w || 393), Hh = +(ARGS.h || 852);
const MODS = (ARGS.mods || 'lords,great,faith,plots,seats,unions,balance,sieges,spy').split(',').filter(Boolean);
(async () => {
  const b = await chromium.launch();
  const report = { games: 0, finished: 0, errors: [], stalls: [], clicks: {}, sheets: {}, overflow: [] };
  for (let g = 0; g < GAMES; g++) {
    const ctx = await b.newContext({ viewport: { width: W, height: Hh }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, reducedMotion: ARGS.rm === '0' ? 'no-preference' : 'reduce' });
    const p = await ctx.newPage(); p.setDefaultTimeout(2500);
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/fonts|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
    await p.addInitScript(([house, opps, mods]) => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house, opps, speed: 'turbo', mods, tut: 0 })); } catch (e) {} }, [ARGS.house || ['owl', 'wolf', 'rose', 'deer', 'moon', 'bear', 'serpent', 'lion'][g % 8], OPPS, MODS]);
    await p.goto('file://' + (ARGS.file || SP + 'test-embed.html'));
    await p.waitForSelector('#splash', { state: 'detached', timeout: 5000 }).catch(() => {});
    await p.click('[data-act="setup"]').catch(() => {}); await p.waitForTimeout(300);
    for (let k = 0; k < 4 && !(await p.evaluate(() => !!window.__VD.S)); k++) { await p.click('[data-act="start"]').catch(() => {}); await p.waitForTimeout(400); }
    if (!(await p.evaluate(() => !!window.__VD.S))) { report.errors.push('партия не началась'); await ctx.close(); continue; }
    report.games++;
    let lastProg = '', lastT = Date.now(), myActs = 0, lastTurn = -1, checks = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 240000) {
      const st = await p.evaluate(() => { const V = window.__VD, S = V.S; return S ? { w: S.winner, turn: S.turnNo, log: S.log.length, my: V.isMyTurn(), busy: V.busy, rolled: S.players[S.cur].turn.rolled, cur: S.cur, coins: V.coins } : null; });
      if (!st) break;
      if (st.w !== null && st.w !== undefined) { report.finished++; break; }
      if (st.turn > LIMIT) break;
      const prog = `${st.turn}|${st.log}|${st.coins}`;
      if (prog !== lastProg) { lastProg = prog; lastT = Date.now(); }
      else if (Date.now() - lastT > 20000) {
        const html = await p.evaluate(() => { const s = document.querySelector('.scrim:not(.out) .sheet'); return (s ? 'ОКНО: ' + s.innerText : 'ПЛАНКА: ' + (document.querySelector('.abar') || document.body).innerText + ' | ' + (document.querySelector('.turnrow') || {}).innerText).slice(0, 400); });
        report.stalls.push(`партия ${g}: ход ${st.turn}, игрок ${st.cur}, ${html.replace(/\s+/g, ' ')}`);
        await p.screenshot({ path: SP + `v10/stall-${g}.png` });
        break;
      }
      if (st.turn !== lastTurn) { lastTurn = st.turn; myActs = 0; }
      // страница не должна прокручиваться, зоны — не вылезать за экран
      if (checks++ % 25 === 0) {
        const o = await p.evaluate(() => { const d = document.documentElement, b = document.querySelector('.board'); if (!b) return null; const bad = []; if (d.scrollHeight > innerHeight + 1 || d.scrollWidth > innerWidth + 1 || scrollY || scrollX) bad.push(`страница ${d.scrollWidth}x${d.scrollHeight} scroll ${scrollX},${scrollY}`); for (const z of b.children) { const r = z.getBoundingClientRect(); if (z.classList.contains('drawer') && !b.classList.contains('d-open')) continue; if (r.bottom > innerHeight + 1 || r.top < -1 || r.right > innerWidth + 1) bad.push(`${z.className}: ${Math.round(r.top)}..${Math.round(r.bottom)}`); } const a = b.querySelector('.abar'); if (a && a.scrollWidth > a.clientWidth + 1) bad.push(`планка шире экрана: ${a.scrollWidth} > ${a.clientWidth} — ${a.innerText.replace(/\s+/g, ' ').slice(0, 80)}`); const m = b.querySelector('.pbar.own'); if (m && m.scrollWidth > m.clientWidth + 1) bad.push(`моя планка шире: ${m.scrollWidth}`); const f = b.querySelector('.pbar.foe'); if (f && f.scrollWidth > f.clientWidth + 1) bad.push(`планка соперника шире: ${f.scrollWidth}`); return bad; });
        if (o && o.length) for (const x of o) if (!report.overflow.includes(x) && report.overflow.length < 12) report.overflow.push(x);
      }
      // 1) окна выбора и то, что нужно сделать прямо сейчас
      const clicked = await p.evaluate(() => {
        const vis = (el) => el && el.offsetParent !== null && !el.disabled;
        const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
        const sh = [...document.querySelectorAll('.scrim:not(.out)')].pop();
        if (sh) {
          const title = (sh.querySelector('h2') || {}).innerText || '';
          // свёрнутое окно («Свернуть ▾»): вернуться к выбору — иначе его варианты скрыты и робот застревает (так было с окном «Обряд: уберите 1 карту»)
          // плашка «Вернуться» закреплена на экране (position: fixed), а у таких offsetParent всегда null — видимость смотрим по её прямоугольникам;
          // шторку закрываем, только если она открыта (иначе робот жал невидимую «закрыть» по кругу и застревал)
          if (sh.classList.contains('mini')) { const rb = sh.querySelector('[data-ret]'), shown = !!rb && rb.getClientRects().length > 0; if (shown && Math.random() < 0.7) { rb.click(); return 'sheet-return'; } const dc = document.querySelector('.board.d-open .drawer [data-act="drawer-close"]'); if (vis(dc)) { dc.click(); return 'drawer-close'; } if (shown) { rb.click(); return 'sheet-return'; } }
          const opts = [...sh.querySelectorAll('[data-v]')].filter(vis);
          if (opts.length) { pick(opts).click(); return 'sheet:' + title.slice(0, 40); }
          const acts = [...sh.querySelectorAll('[data-act="purge"], [data-act="fetch"], [data-act="discard-seat"]')].filter(vis);
          if (acts.length && Math.random() < 0.5) { const el = pick(acts); el.click(); return 'sheetact:' + el.dataset.act; }
          const tog = [...sh.querySelectorAll('[data-i], [data-id].opt')].filter(vis);
          if (tog.length && Math.random() < 0.6) { pick(tog).click(); return 'toggle:' + title.slice(0, 40); }
          const btns = [...sh.querySelectorAll('button')].filter(b => vis(b) && !b.hasAttribute('data-close') && !b.dataset.act);
          const prim = btns.filter(b => b.classList.contains('primary'));
          if (prim.length) { pick(prim).click(); return 'sheetbtn:' + title.slice(0, 40); }
          { const cl0 = sh.querySelector('[data-close]'); if (vis(cl0) && Math.random() < 0.45) { cl0.click(); return 'close:' + title.slice(0, 40); } }
          if (btns.length) { pick(btns).click(); return 'sheetany:' + title.slice(0, 40); }
          const cl = sh.querySelector('[data-close]'); if (vis(cl)) { cl.click(); return 'close:' + title.slice(0, 40); }
          return 'sheet-stuck:' + title.slice(0, 40);
        }
        const page = [...document.querySelectorAll('.page:not(.out)')].pop();
        if (page) { const c = page.querySelector('[data-close]'); if (c) { c.click(); return 'page-close'; } }
        { const cc = [...document.querySelectorAll('.board [data-act="coin-card"]')].filter(vis); if (cc.length && Math.random() < 0.7) { pick(cc).click(); return 'coin-card'; } }
        for (const a of ['cover-ok', 'tut-off', 'coin-all', 'adj-ok', 'next', 'step-ok']) {
          const el = document.querySelector(`[data-act="${a}"]`);
          if (!vis(el)) continue;
          if (a === 'adj-ok' && Math.random() < 0.3) { const r = pick([...document.querySelectorAll('[data-act="adj-reroll"], [data-act="adj-one"], [data-act="adj-shift"]')].filter(vis)); if (r) { r.click(); return 'adj:' + r.dataset.act; } }
          if (a === 'step-ok' && Math.random() < 0.3) { const r = document.querySelector('[data-act="refresh-tap"], [data-act="refresh-all"]'); if (vis(r)) { r.click(); return 'step:' + r.dataset.act; } }
          el.click(); return 'do:' + a;
        }
        return null;
      });
      if (clicked) { const key = clicked.split(':')[0] + ':' + (clicked.split(':')[1] || '').replace(/\d+/g, 'N').slice(0, 30); report.sheets[key] = (report.sheets[key] || 0) + 1; await p.waitForTimeout(50); continue; }
      if (!st.my || st.busy) { await p.waitForTimeout(100); continue; }
      // 2) мой ход: карта руки, рынок, знамёна, двор, бросок, конец хода
      const did = await p.evaluate(([rolled, myActs]) => {
        const vis = (el) => el && el.offsetParent !== null && !el.disabled;
        const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
        const q = (s) => [...document.querySelectorAll(s)].filter(vis);
        const r = Math.random();
        const V = window.__VD;
        // выбрана карта — что-нибудь с ней сделать
        if (V.sel) { const xs = q('.abar [data-act="play"], .abar [data-act="plot"], .abar [data-act="court-seat"], .abar [data-act="retire"], .abar [data-act="desel"]'); if (xs.length) { const el = pick(xs); el.click(); return 'card:' + el.dataset.act; } }
        if (V.drawer) {
          const xs = q('.drawer .buyb.ok, .drawer [data-act="renounce"]');
          if (xs.length && r < 0.75) { const el = pick(xs); el.click(); return 'drawer:' + el.dataset.act; }
          if (r < 0.9) { const c = pick(q('.drawer .mcard')); if (c && Math.random() < 0.15) { c.click(); return 'drawer:info'; } }
          const x = q('.drawer [data-act="drawer-close"]')[0]; if (x) { x.click(); return 'drawer:close'; }
        }
        if (!rolled) {
          const cards = q('.handz .hcard[data-act="sel"]');
          if (cards.length && r < 0.35) { pick(cards).click(); return 'sel'; }
          if (r < 0.5) { const a = q('.abar [data-act="play-all"]')[0]; if (a) { a.click(); return 'play-all'; } }
          if (r < 0.58) { const d = pick(q('.abar [data-act="drawer"]')); if (d) { d.click(); return 'drawer:open'; } }
          const rb = pick(q('.abar [data-act="roll"]')); if (rb) { rb.click(); return 'roll'; }
          return null;
        }
        if (myActs > 12 || r < 0.1) { const e = q('.abar [data-act="end"]')[0]; if (e) { e.click(); return 'end'; } }
        if (r < 0.3) { const cards = q('.handz .hcard[data-act="sel"]'); if (cards.length) { pick(cards).click(); return 'sel'; } }
        if (r < 0.65) { const d = pick(q('.abar [data-act="drawer"]')); if (d) { d.click(); return 'drawer:open'; } }
        if (r < 0.72) { const m = q('.pbar.own [data-act="my"]')[0]; if (m) { m.click(); return 'my'; } }
        if (r < 0.78) { const m = pick(q('.board .tile[data-act="info-estate"], .pbar.foe [data-act="opp"], .board [data-act="res"], .board [data-act="rollsum"], .board [data-act="xaction"]')); if (m) { m.click(); return 'tap:' + m.dataset.act; } }
        const e = q('.abar [data-act="end"]')[0]; if (e) { e.click(); return 'end'; }
        return null;
      }, [st.rolled, myActs]);
      if (did) { report.clicks[did] = (report.clicks[did] || 0) + 1; myActs++; }
      await p.waitForTimeout(did === 'roll' ? 200 : 70);
    }
    for (const e of errs) if (!report.errors.includes(e)) report.errors.push(e);
    await ctx.close();
  }
  console.log(JSON.stringify(report, null, 1));
  await b.close();
})();
