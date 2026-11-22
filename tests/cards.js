// все листы карт: ищем undefined/NaN; снимаем примеры. node cards.js
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
const PICK = JSON.parse(process.env.PICK || '[]');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: 'serpent', opps: 1, speed: 'slow', mods: ['lords', 'great', 'faith', 'plots', 'seats', 'balance', 'sieges', 'spy'], tut: 0, coins: false, sound: false, music: false })); } catch (e) {} });
  await p.goto('file://' + SP + 'test-embed.html');
  await p.waitForSelector('#splash', { state: 'detached', timeout: 5000 }).catch(() => {});
  await p.click('[data-act="setup"]'); await p.waitForTimeout(400); await p.click('[data-act="start"]');
  for (let i = 0; i < 400; i++) { if (await p.evaluate(() => window.__VD.isMyTurn() && !window.__VD.busy && !document.body.classList.contains('dealing'))) break; await p.waitForTimeout(100); }
  await p.waitForTimeout(500);
  const res = await p.evaluate(async () => {
    const V = window.__VD, D = (typeof DATA !== 'undefined') ? DATA : null; if (!D) return { err: 'no DATA' };
    const out = { bad: [], n: 0 };
    const jobs = [];
    for (const id of Object.keys(D.ESTATES)) jobs.push({ act: 'info-estate', id });
    for (const id of Object.keys(D.COURT)) jobs.push({ act: 'info-court', id });
    for (const key of Object.keys(D.BAN)) jobs.push({ act: 'info-ban', key });
    // и свои владения со стола — там строка «Сейчас»
    for (const pl of V.S.players) for (const e of pl.estates) jobs.push({ act: 'info-estate', id: e.id, o: String(pl.i) });
    for (const d of jobs) {
      let parts; try { parts = V.infoParts(d); } catch (e) { out.bad.push([d, 'ОШИБКА ' + e.message]); continue; }
      if (!parts) continue; out.n++;
      const t = (parts.title + ' ' + parts.body).replace(/<[^>]+>/g, ' ');
      if (/undefined|NaN|\bnull\b|\[object/.test(t)) out.bad.push([d, t.replace(/\s+/g, ' ').match(/.{0,60}(undefined|NaN|null|\[object).{0,30}/)[0]]);
    }
    return out;
  });
  console.log('листов', res.n, 'плохих', res.bad && res.bad.length, res.err || '');
  for (const x of (res.bad || []).slice(0, 40)) console.log(JSON.stringify(x));
  console.log('ошибки', errs.slice(0, 3));
  await b.close();
})();
