// проверка отдельной сборки index.html: шрифты и картинки внутри файла, из сети ничего не просит
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }); const p = await ctx.newPage(); p.setDefaultTimeout(3000);
  const errs = [], reqs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
  p.on('request', r => { const u = r.url(); if (!/^(file|blob|data):/.test(u)) reqs.push(u.slice(0, 90)); });
  await p.goto('file://' + require('path').join(__dirname, '..', 'index.html'));
  await p.waitForSelector('#splash', { state: 'detached', timeout: 5000 }).catch(() => {});
  await p.screenshot({ path: SP + 'v10/sa-home.png' });
  await p.click('[data-act="setup"]'); await p.waitForTimeout(300); await p.click('[data-act="start"]'); await p.waitForTimeout(1500);
  await p.screenshot({ path: SP + 'v10/sa-game.png' });
  const info = await p.evaluate(async () => { await document.fonts.ready; const fams = [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight); const el = document.querySelector('.goldbig'), t = document.querySelector('.turnrow .hint') || document.querySelector('.turnrow'); const imgs = [...document.querySelectorAll('.board img')]; return { fonts: [...new Set(fams)], name: getComputedStyle(el).fontFamily.slice(0, 30), hint: getComputedStyle(t).fontFamily.slice(0, 30), imgs: imgs.length, broken: imgs.filter(i => !i.naturalWidth).length, view: window.__VD.view, meta: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').content, vp: document.querySelector('meta[name="viewport"]').content }; });
  console.log(JSON.stringify(info, null, 1)); console.log('запросы в сеть:', reqs); console.log('ошибки:', errs);
  await b.close();
})();
