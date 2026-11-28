// v10.13: фильтр «Все карты» — наборы включаются по отдельности (Основа, Вера, Осады, Шпионаж, Двор, Великие);
// у карт основы плашка «🏰 Основа». node catalog.js [file]
const { chromium } = require('playwright');
const SP = require('path').join(__dirname, '..', '.work') + '/';
const FILE = process.argv[2] || (SP + 'test-embed.html');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); p.setDefaultTimeout(4000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const res = []; const ok = (name, cond, info) => res.push(`${cond ? 'OK ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`);
  // v10.22: соперник — любой Дом, кроме Розы: её Тайная канцелярия шпионит в начале её хода, и окно откупа открылось бы ещё до вашего хода
  const OPP = ['deer', 'owl', 'wolf', 'serpent', 'bear', 'lion', 'sun'].filter(h => h !== 'deer')[Math.floor(Math.random() * 6)];
  await p.addInitScript((opp) => { try { localStorage.setItem('velikie-doma-prefs-v1', JSON.stringify({ v2: 1, v3: 1, v10: 1, house: 'deer', seats: [{ type: 'bot', house: opp }], opps: 1, speed: 'turbo', mods: ['lords', 'faith', 'plots', 'seats', 'sieges', 'spy'], coins: true })); } catch (e) {} }, OPP);
  await p.goto('file://' + FILE); await p.waitForSelector('#splash', { state: 'detached', timeout: 6000 }).catch(() => {});
  await p.click('[data-act="catalog"]'); await p.waitForTimeout(600);
  const chips = () => p.evaluate(() => [...document.querySelectorAll('.cathead [data-cm]')].map(c => c.dataset.cm + (c.classList.contains('on') ? '*' : '')));
  const note = () => p.evaluate(() => (document.querySelector('.cathead .note') || {}).innerText || '');
  // карты всех вкладок с учётом фильтра: [вид, id, что нужно карте]
  const visible = async () => {
    const out = [];
    for (const seg of ['estates', 'court', 'houses', 'bans']) {
      await p.click(`[data-seg="${seg}"]`); await p.waitForTimeout(150);
      out.push(...await p.evaluate(() => [...document.querySelectorAll('.catbody [data-act]')].map(x => {
        const a = x.dataset.act, id = x.dataset.id || x.dataset.key || '', N = DATA.NEEDS;
        const need = a === 'info-court' ? N.court[id] : a === 'info-estate' ? N.estate[id] : a === 'info-ban' ? N.ban[id] : a === 'zoom' && x.dataset.kind === 'house' ? N.house[id] : '';
        return [a, id, need || '', a === 'info-ban' && DATA.BAN[id] ? DATA.BAN[id].tier : ''];
      })));
    }
    return out;
  };

  ok('кнопки наборов: Основа, Вера, Осады, Шпионаж, Двор, Великие', (await chips()).join(',') === 'base,faith,sieges,spy,court,great', (await chips()).join(','));
  ok('сначала — весь набор', /^Все \d+ разных карт/.test(await note()), await note());
  await p.click('[data-cm="spy"]'); await p.waitForTimeout(300);
  const spy = await visible();
  ok('только «Шпионаж»: подпись', /^Показаны: Шпионаж — \d+ из \d+/.test(await note()), await note());
  ok('только «Шпионаж»: видны только карты шпионажа', spy.length > 0 && spy.every(([, , n]) => n.includes('spy')), `${spy.length} карт; лишние: ${spy.filter(([, , n]) => !n.includes('spy')).map(x => x[1]).join(', ') || 'нет'}`);
  await p.click('[data-cm="base"]'); await p.waitForTimeout(300);
  const both = await visible();
  ok('«Шпионаж» + «Основа»: добавились карты основы', both.some(([a, id]) => a === 'info-court' && id === 'scribe') && both.length > spy.length, `${spy.length} → ${both.length}`);
  await p.click('[data-cf="game"]'); await p.waitForTimeout(300);
  ok('«Выбранный набор» — наборы партии', (await chips()).filter(x => x.endsWith('*')).join(',') === 'base*,faith*,sieges*,spy*,court*', (await chips()).join(','));
  await p.click('[data-cm="great"]'); await p.waitForTimeout(300);
  const g = await visible();
  ok('кнопка «Великие» добавляет великих лордов', g.some(([a, , , t]) => a === 'info-ban' && t === 'g'), '');
  await p.click('[data-cf="all"]'); await p.waitForTimeout(300);
  ok('«Весь набор» возвращает всё', /^Все \d+ разных карт/.test(await note()) && !(await chips()).some(x => x.endsWith('*')), await note());
  // плашка «Основа» — у карты основы есть, у карты модуля нет
  await p.evaluate(() => { for (const s of document.querySelectorAll('.page, .scrim')) if (s.close) s.close(); });
  await p.reload(); await p.waitForSelector('#splash', { state: 'detached', timeout: 6000 }).catch(() => {});
  await p.click('[data-act="setup"]'); await p.waitForTimeout(300); await p.click('[data-act="start"]'); await p.waitForTimeout(1200);
  const face = (id) => p.evaluate((id) => { const d = document.createElement('div'); d.innerHTML = __VD.infoParts({ act: 'info-court', id }).body; return d.querySelector('.ex-pc').innerText; }, id);
  const fb = await face('scribe'), fm = await face('siegeband');
  ok('у карты основы плашка «Основа»', /Основа/i.test(fb), fb.replace(/\s+/g, ' ').slice(-40));
  ok('у карты модуля — модуль, без «Основы»', /Вражда/i.test(fm) && !/Основа/i.test(fm), fm.replace(/\s+/g, ' ').slice(-40));
  console.log(res.join('\n')); console.log('ошибки', errs.slice(0, 5));
  await b.close();
})();
