// ===================== ИНТЕРФЕЙС =====================
(() => {
  const D = DATA, E = Engine, R = D.RULES;
  const SAVE_KEY = 'velikie-doma-save-v1';
  const PREF_KEY = 'velikie-doma-prefs-v1';
  const NET_KEY = 'velikie-doma-net-v1'; // гость: в какой комнате и под каким номером устройства — чтобы вернуться
  const NETOK = typeof Net !== 'undefined' && Net.available();
  class Stale extends Error {}

  let S = null, ME = null, WATCH = false;
  let speed = 'normal';
  let paused = false;
  let runId = 0;
  let endTurnResolve = null;
  let adjustReq = null, adjMin = false; // adjMin — окно броска свёрнуто (v10.17)
  // защита от мискликов: «Завершить ход» и «Отставка» срабатывают со второго нажатия (первое — «Точно?» на 4 секунды)
  let armed = null;
  const armedOn = (k) => !!(armed && armed.k === k && performance.now() - armed.t < 4000);
  function arm(k) { armed = { k, t: performance.now() }; schedule(); setTimeout(() => { if (armed && armed.k === k) { armed = null; schedule(); } }, 4050); }
  let busy = false;
  let lastSafe = null;
  let diceView = null;
  let rolling = false;
  const goldSeen = {};
  const pops = {};      // всплывающие +N/−N у золота: игрок → { d, t }
  let rollView = null;  // итог последнего броска: кто бросил, что выпало, кто что получил
  let oppMoments = [];  // доход соперников для «Стола»: начало их хода и последний бросок — какие карты сработали
  let chipRoll = null, chipPulse = 0; // итог последнего броска в шапке: кубики после показа уезжают сюда
  const turnKey = () => (S ? S.round * 100 + S.cur : 0);
  let turnRec = null;   // что соперник делает в этот ход — для сводки
  let lastRec = null;   // сводка последнего хода соперника, показана до «Дальше»
  let nextReq = null;   // ждём «Дальше» после хода соперника
  let pauseBots = false; // пауза после хода соперника со сводкой (настройки)
  // соперники: тип места (бот / человек на этом устройстве / игрок по сети) и Дом ('random' — случайный)
  let setup = { house: 'deer', seats: [{ type: 'bot', house: 'random' }, { type: 'bot', house: 'random' }], mods: D.PRESETS.basic.modules.slice(), skill: 'normal', seating: 'pass' };
  let NETG = null;      // партия по сети: { role: 'host' | 'guest', … }
  let coverReq = null;  // игра на одном устройстве: «передайте устройство» { p, why, res }
  let evCur = null;     // у гостя: чей ход шёл, когда случилось событие (события приходят пачкой)
  let joinDraft = { code: '', name: '' };
  let rq = false;
  let savedGame = null;
  let saveGone = false; // сохранение было, но из прошлой версии (в нём карты, которых больше нет) — скажем об этом на главном экране
  let modsOpen = false; // раскрыт ли список модулей на экране новой партии
  let view = 'home';    // экран без партии: 'home' — главное меню, 'setup' — новая партия
  let lastView = null;  // для перехода между экранами
  let sound = true;       // звуки стола
  let music = true;       // музыка: тема Дома на время хода, мотивы событий
  let sfxVol = 60, musVol = 50; // громкость звуков стола и музыки, 0…100 — отдельно друг от друга
  let manualCoins = true; // монеты с карт забирают руками
  let rowTap = true;      // обновление рядов в начале круга — касанием по уходящей карте
  let shakeRoll = false;  // бросать кубик встряхиванием устройства
  let lastN = 1;          // сколько кубиков бросали прошлый раз
  // ссылки на учебник и каталог; отдельная сборка (index.html для GitHub) задаёт свои через window.PRETENDENTY_LINKS (пустые — кнопок нет)
  const LINKS = (typeof window !== 'undefined' && window.PRETENDENTY_LINKS) || { tutorial: 'https://claude.ai/artifact/WNWYKTBRrNXw52Xu4i5yim', catalog: 'https://claude.ai/artifact/CHiCATm6NWdmUw7e3e1rku' };
  // путь к картинке: в отдельной сборке картинки встроены в файл, ASSET_URL отдаёт их адрес
  const IMG = (p) => (typeof ASSET_URL === 'function' ? ASSET_URL(p) : p);
  const VERSION = '10.20'; // место в файле: рисунки сжаты (DEFLATE) и распаковываются при запуске, координаты — 1 знак, иконка — палитра: index.html 1,7 → 1,3 МБ
  const TUT_SEED = 140; // базовые правила, Дом Оленя против Дома Змея: первая рука — Подать, Подать, Сборщик податей; первый бросок 4

  const app = document.getElementById('app');
  const barEl = document.getElementById('bar');
  const sheetRoot = document.getElementById('sheet-root');
  const toastRoot = document.getElementById('toasts');
  const mk = (tag, id, cls) => { const el = document.createElement(tag); el.id = id; if (cls) el.className = cls; document.body.appendChild(el); return el; };
  const pageRoot = document.getElementById('page-root') || mk('div', 'page-root');
  const tabEl = document.getElementById('tabbar') || mk('nav', 'tabbar', 'tabbar');
  tabEl.hidden = true;
  tabEl.setAttribute('aria-label', 'Разделы');
  const coverEl = document.getElementById('cover') || mk('div', 'cover', 'cover');
  coverEl.hidden = true;
  const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // ---------- журнал ошибок: копится тихо, попадает в отчёт «Проверка устройства» ----------
  const ERR_KEY = 'pretendenty-errlog-v1';
  let errLog = []; try { const x = JSON.parse(localStorage.getItem(ERR_KEY) || '[]'); if (Array.isArray(x)) errLog = x.slice(-30); } catch (e) { errLog = []; }
  let errTold = false;
  function logErr(kind, msg, src) {
    const m = String(msg || '').slice(0, 300);
    if (errLog.length && errLog[errLog.length - 1].m === m && errLog[errLog.length - 1].k === kind) { errLog[errLog.length - 1].n = (errLog[errLog.length - 1].n || 1) + 1; }
    else errLog.push({ t: new Date().toISOString().slice(0, 19).replace('T', ' '), k: kind, m, s: String(src || '').slice(0, 220), v: VERSION, w: S ? `круг ${S.round}, ходит ${S.cur}${NETG ? ', сеть ' + NETG.role : ''}` : view });
    if (errLog.length > 30) errLog = errLog.slice(-30);
    try { localStorage.setItem(ERR_KEY, JSON.stringify(errLog)); } catch (e) { /* ignore */ }
    if (!errTold && kind !== 'layout') { errTold = true; setTimeout(() => { try { toast('⚠︎ В игре случилась ошибка. Отчёт для разработчика: Настройки → «Проверка устройства»', 5200); } catch (e) { /* ignore */ } }, 0); }
  }
  window.addEventListener('error', (e) => { if (e && e.message && !/ResizeObserver loop/.test(e.message)) logErr('ошибка', e.message, `${String(e.filename || '').split('/').pop()}:${e.lineno}:${e.colno}`); });
  window.addEventListener('unhandledrejection', (e) => { const r = e && e.reason; if (r instanceof Stale) return; logErr('обещание', r && (r.message || r), r && r.stack ? String(r.stack).split('\n').slice(1, 3).map(x => x.trim()).join(' | ') : ''); });
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', 'table'); // оформление одно: сукно, дерево, золото
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const H = (p) => D.HOUSES[p.house];
  const gico = (k) => `<img class="ic ic-${k}" src="${IMG(`icons/i_${k}.svg`)}" alt="">`;
  const FXc = (list) => CardFX.chips(list, gico);
  // ---------- кто за каким местом ----------
  // seat: 'bot' — бот, 'local' — человек на этом устройстве, 'remote' — игрок по сети (так видит хозяин)
  const seatOf = (q) => q.seat || (q.isBot ? 'bot' : 'local');
  const guest = () => !!(NETG && NETG.role === 'guest');
  const hostNet = () => !!(NETG && NETG.role === 'host' && NETG.started);
  // человек, который играет на этом устройстве
  const isLocal = (q) => (guest() ? q.i === ME : !q.isBot && seatOf(q) === 'local');
  // на одном устройстве играют несколько человек — передают его по очереди
  const hotseat = () => !!S && !guest() && S.players.filter(isLocal).length >= 2;
  const pname = (p) => `${H(p).sigil} ${esc(p.i === ME && !hotseat() ? 'Вы' : H(p).short)}`;
  // ---------- модули: что включено в этой партии (или в настройке, пока партии нет) ----------
  const MODK = D.MODULE_PICK || D.MODULE_KEYS; // лорды — в основе, «Баланс» убран
  // объединённый модуль («Вражда», «Двор») включён, когда включены все его части
  const setupOn = (k) => D.modMembers(k).every(x => setup.mods.includes(x));
  const modOn = (k) => D.modMembers(k).every(x => (S ? E.on(S, x) : setup.mods.includes(x)));
  const needOf = (kind, id) => D.NEEDS[kind] && D.NEEDS[kind][id];
  // нужен модуль: 'a|b' — любой из них, 'a&b' — оба; знамёна лордов и великих — только со своим модулем
  const needMet = (k) => !k || k.split('|').some(x => x.split('&').every(y => modOn(y)));
  const cardOk = (kind, id) => { if (!needMet(needOf(kind, id))) return false; if (kind === 'ban') { const t = D.BAN[id] && D.BAN[id].tier; if (t === 'l' && !modOn('lords')) return false; if (t === 'g' && !modOn('great')) return false; } return true; };
  const houseOk = (h) => { const k = needOf('house', h); return !k || setupOn(k); };
  const availHouses = () => Object.keys(D.HOUSES).filter(houseOk);
  // длина партии: по лордам и великим лордам
  const lengthOf = (mods) => (mods.includes('great') ? 'long' : mods.includes('lords') ? 'medium' : 'short');
  const presetOf = (mods) => Object.keys(D.PRESETS).find(k => { const a = D.PRESETS[k].modules; return a.length === mods.length && a.every(x => mods.includes(x)); }) || null;
  const needT = (t) => (t === 'v' ? R.needV : t === 'l' ? (modOn('lords') ? R.needL : 0) : (modOn('great') ? R.needG : 0));
  const needL = () => needT('l'), needF = () => needT('g');
  const goalNow = () => needT('v') + needT('l') + needT('g');
  const goalTxt = () => { const a = [`${R.needV} вассалов`]; if (needL()) a.push(`${needL()} лорда`); if (needF()) a.push(`${needF()} великих лорда`); return a.length > 2 ? `${a[0]}, ${a[1]} и ${a[2]}` : a.join(' и '); };
  const tierOf = (id) => (D.BAN[id] ? D.BAN[id].tier : null);
  const TIER_NAME = { v: 'вассал', l: 'лорд', g: 'великий лорд' };
  const tierList = (p, t) => (t === 'v' ? p.vassals : t === 'l' ? p.lords : p.greats);
  // «12 знамён: 6 вассалов, 4 лорда и 2 великих лорда»
  const goalLine = () => `${D.banners(goalNow())}: ${goalTxt()}`;
  // части объединённых модулей называем общим именем: «Осады» и «Шпионаж» — «Вражда», «Замыслы» и «Придворные» — «Двор»
  const modName = (k) => { const m = D.MODULES[k] || {}; return (D.MODULES[m.member] || m).name || k; };
  const modList = (ks) => [...new Set(ks.map(modName))].map(n => `«${n}»`).join(', ');
  const SYMS5 = D.SYMS;
  function fixSetup() {
    const av = availHouses();
    if (!av.includes(setup.house)) setup.house = av[0];
    if (!Array.isArray(setup.seats) || !setup.seats.length) setup.seats = [{ type: 'bot', house: 'random' }];
    setup.seats = setup.seats.slice(0, Math.max(1, Math.min(av.length - 1, R.maxPlayers - 1)));
    const used = new Set([setup.house]);
    for (const s of setup.seats) {
      if (!['bot', 'local', 'remote'].includes(s.type) || (s.type === 'remote' && !NETOK)) s.type = 'bot';
      if (s.house !== 'random' && (!av.includes(s.house) || used.has(s.house))) s.house = 'random';
      if (s.house !== 'random') used.add(s.house);
    }
  }
  const hasRemote = () => setup.seats.some(s => s.type === 'remote');
  const shuffleArr = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---------- настройки ----------
  function loadPrefs() {
    try { const x = JSON.parse(localStorage.getItem(PREF_KEY) || 'null'); if (x) { if (D.HOUSES[x.house]) setup.house = x.house; if (Array.isArray(x.seats) && x.seats.length) setup.seats = x.seats.filter(s => s && typeof s === 'object').map(s => ({ type: String(s.type), house: D.HOUSES[s.house] ? s.house : 'random' })); else if (x.opps >= 1) setup.seats = Array.from({ length: Math.min(x.opps, R.maxPlayers - 1) }, () => ({ type: 'bot', house: 'random' })); if (x.speed) speed = x.speed; if (Array.isArray(x.mods)) { if (!x.v3) { /* настройки v1: «Полная» → «Полная», остальное → «Базовая» */ setup.mods = (x.mods.includes('foreign') && x.mods.includes('sieges') ? D.PRESETS.full : D.PRESETS.basic).modules.slice(); } else setup.mods = x.mods.flatMap(k => D.modMembers(k)).filter(k => D.MODULE_KEYS.includes(k) && !(D.MODULES[k] || {}).hidden || ['lords', 'great', 'sieges', 'spy', 'plots', 'seats'].includes(k)); } pauseBots = x.v10 ? x.pause === true : false; if (x.hint === false) hintOn = false; if (E.SKILL_NAMES && E.SKILL_NAMES[x.skill]) setup.skill = x.skill; if (x.sound === false) sound = false; if (x.music === false) music = false; if (x.sfxVol >= 0 && x.sfxVol <= 100) sfxVol = +x.sfxVol; if (x.musVol >= 0 && x.musVol <= 100) musVol = +x.musVol; if (x.coins === false) manualCoins = false; if (x.rowTap === false) rowTap = false; } } catch (e) { /* хранилище недоступно */ }
    fixSetup();
    // сохранение старой версии правил (v1) с новым движком несовместимо — забываем его
    try { const g = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (g && g.S) { const x = JSON.parse(g.S); if (x.v === 2 && saveFits(x)) savedGame = g; else { saveGone = x.v === 2; localStorage.removeItem(SAVE_KEY); } } } catch (e) { try { localStorage.removeItem(SAVE_KEY); } catch (e2) { /* нет доступа */ } }
  }
  function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify({ v2: 1, v3: 1, house: setup.house, opps: setup.seats.length, seats: setup.seats, speed, mods: setup.mods, skill: setup.skill, v10: 1, pause: pauseBots, hint: hintOn, sound, music, sfxVol, musVol, coins: manualCoins, rowTap })); } catch (e) { /* ignore */ } }
  function saveSafe() {
    if (!S || guest()) return; // гость партию не хранит — она у хозяина
    lastSafe = JSON.stringify(S);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ S: lastSafe, ME, WATCH })); } catch (e) { /* ignore */ }
  }
  function clearSave() { lastSafe = null; savedGame = null; try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }

  // ---------- связь с движком ----------
  const BASE = { start: 420, play: 460, roll: 760, build: 820, buy: 520, siege: 1100 };
  const SPEED = { slow: 1.7, normal: 1, fast: 0.28, turbo: 0.04 }; // turbo — только для автоматических проверок (в настройках его нет)
  E.setHooks({
    event(s, type, data) { if (s !== S) return; if (hostNet()) netEvent(type, data); onEvent(type, data); },
    async delay(s, what) {
      if (s !== S) throw new Stale();
      const cur = s.players[s.cur];
      if (!cur.isBot && what !== 'siege') return;
      await wait((BASE[what] || 400) * SPEED[speed]);
      if (what !== 'play') await popsDone(); // карты соперник играет подряд — одинаковые ложатся на стол стопкой; перед броском и покупкой ждём, пока их покажут
      while ((paused || (tutOn() && !coachEl.hidden)) && s === S) await wait(200); // пока раскрыта подсказка обучения, соперник ждёт
      if (s !== S) throw new Stale();
    },
    async ask(s, p, q) {
      if (s !== S) throw new Stale();
      if (seatOf(p) === 'remote') return hostAsk(p, q);
      // одно устройство на несколько человек: вопрос не тому, у кого сейчас устройство, — сначала передать
      if (hotseat() && p.i !== ME) {
        const cur = S.players[S.cur];
        await handTo(p, p.i === S.cur ? 'turn' : 'ask', q);
        if (s !== S) throw new Stale();
        const v = await askHuman(p, q);
        if (s !== S) throw new Stale();
        if (cur.i !== p.i && isLocal(cur) && S.winner === null) await handTo(cur, 'back');
        return v;
      }
      return askHuman(p, q);
    },
    async collect(s, d) {
      if (s !== S) throw new Stale();
      if (d.kind === 'draw' || d.kind === 'refresh') { await manualStep(s, d); if (s !== S) throw new Stale(); return; }
      await throwDone();
      if (s !== S) throw new Stale();
      // одно устройство, «передаём»: доход начала хода забирает сам игрок — сначала отдать ему устройство
      if (d.kind === 'dawn' && hotseat() && d.p !== ME && myCoins().some(c => c.to === d.p)) { await handTo(S.players[d.p], 'turn'); if (s !== S) throw new Stale(); }
      await coinsSettled(s);
      if (s !== S) throw new Stale();
    },
    async humanTurn(s, p) {
      if (s !== S) throw new Stale();
      if (seatOf(p) === 'remote') return hostTurn(p);
      if (hotseat() && p.i !== ME) { await handTo(p, 'turn'); if (s !== S) throw new Stale(); }
      if (S.tut && p.i === ME) S.tut.turns++;
      return new Promise(res => { endTurnResolve = res; schedule(); });
    },
  });
  // «Передайте устройство»: экран закрывает стол, пока нужный игрок не нажмёт кнопку
  function handTo(p, why, q) {
    return new Promise(res => { coverReq = { p: p.i, why, q: q || null, res }; schedule(); });
  }
  const REC_NOTES = ['siege', 'win', 'fail', 'bribe', 'steal', 'trash', 'extra', 'seat', 'faith', 'upkeep', 'repair'];
  // ---------- статистика партии для итогов: лучшее владение, лучший бросок, траты ----------
  // копится на устройстве, которое ведёт партию, лежит в S — сохраняется и уезжает гостям вместе со столом
  function xsEvent(type, d) {
    if (type !== 'income' && type !== 'buy' && type !== 'regalia') return;
    const n = S.players.length;
    const xs = S.xs && S.xs.est && S.xs.est.length === n ? S.xs : (S.xs = { est: S.players.map(() => ({})), best: S.players.map(() => null), spentM: S.players.map(() => 0), spentB: S.players.map(() => 0) });
    if (type === 'buy') { if (xs.spentM[d.p] != null) xs.spentM[d.p] += d.price | 0; return; }
    if (type === 'regalia') { if (xs.spentB[d.p] != null) xs.spentB[d.p] += d.cost | 0; return; }
    const sum = {};
    for (const x of d.ev || []) if (x.amt > 0 && xs.est[x.to]) { if (x.id) xs.est[x.to][x.id] = (xs.est[x.to][x.id] || 0) + x.amt; sum[x.to] = (sum[x.to] || 0) + x.amt; }
    for (const k in sum) { const b = xs.best[k]; if (!b || sum[k] > b.amt) xs.best[k] = { r: d.r, amt: sum[k] }; }
  }
  function statsHtml(list, me) {
    const xs = S.xs || {}, g = gico('gold');
    const cols = list.map(q => {
      const st = q.stats || {}, inc = { roll: st.rollInc | 0, raid: (st.raidInc | 0) + (st.stolen | 0), card: st.cardGold | 0, start: st.startInc | 0 };
      const est = (xs.est && xs.est[q.i]) || {}, top = Object.keys(est).sort((a, b) => est[b] - est[a])[0], best = xs.best && xs.best[q.i];
      return { q, inc, tot: inc.roll + inc.raid + inc.card + inc.start, top: top && D.ESTATES[top] ? `${esc(D.ESTATES[top].name)}<small>+${est[top]}${g}</small>` : '—', best: best ? `выпало ${best.r}<small>+${best.amt}${g}</small>` : '—', m: (xs.spentM && xs.spentM[q.i]) | 0, b: (xs.spentB && xs.spentB[q.i]) | 0 };
    });
    const mx = Math.max(1, ...cols.map(c => Math.max(c.inc.roll, c.inc.raid, c.inc.card, c.inc.start)));
    const bar = (v, k) => `<span class="sv"><b>${v}</b><i class="sbar b-${k}" style="--w:${Math.round(v / mx * 100)}%"></i></span>`;
    const row = (lab, f, cls) => `<div class="sr${cls ? ' ' + cls : ''}"><span class="sl">${lab}</span>${cols.map(c => `<span class="sc">${f(c)}</span>`).join('')}</div>`;
    const cap = modOn('sieges') || modOn('spy');
    return `<h3 class="res-h">Статистика партии</h3><div class="stt" style="--n:${cols.length}">
      <div class="sr head"><span class="sl"></span>${cols.map(c => `<span class="sc"><img src="${crestOf(c.q)}" alt=""><b>${c.q.i === me ? 'Вы' : esc(H(c.q).short)}</b></span>`).join('')}</div>
      ${row(`Золото за партию`, c => `<b class="tot">${c.tot}${g}</b>`, 'sum')}
      ${row('с бросков', c => bar(c.inc.roll, 'roll'))}
      ${row('набегами', c => bar(c.inc.raid, 'raid'))}
      ${row('картами двора', c => bar(c.inc.card, 'card'))}
      ${row('в начале ходов', c => bar(c.inc.start, 'start'))}
      ${row('Траты: рынок', c => `<b>${c.m}</b>`, 'gap')}
      ${row('Траты: знамёна', c => `<b>${c.b}</b>`, 'txt')}
      ${row('Лучшее владение', c => c.top, 'gap txt')}
      ${row('Лучший бросок', c => c.best, 'txt')}
      ${cap ? row('Захвачено · потеряно', c => `<b>${(c.q.stats || {}).captured | 0} · ${(c.q.stats || {}).lost | 0}</b>`) : ''}
    </div>`;
  }
  function onEvent(type, d) {
    const cur = evCur != null ? evCur : S.cur;
    const rec = turnRec && S.players[turnRec.p] && cur === turnRec.p ? turnRec : null;
    if (!guest()) xsEvent(type, d);
    switch (type) {
      case 'turn':
        if (music && S.winner === null) Music.house(S.players[d.p].house);
        if (sound && d.p === ME && !WATCH && S.winner === null && S.round > 1) Sfx.chime(); // ваш ход — мягкий колокольчик
        turnRec = { p: d.p, gold0: d.gold0 != null ? d.gold0 : S.players[d.p].gold, dawn: null, plays: [], plotsSet: 0, roll: null, plots: [], buys: [], regs: [], notes: [] };
        // ход того, кто играет не здесь (бот, игрок по сети), видно вживую — прошлая сводка больше не нужна;
        // человеку на этом устройстве сводку прошлого хода оставляем
        if (!isLocal(S.players[d.p])) lastRec = null;
        if (d.p !== viewIdx()) oppFocus = d.p; // сверху — стол того, кто ходит
        selCard = null;
        dropPops(); // карты прошлого хода со стола убраны — на столе только то, что происходит сейчас
        break;
      case 'endturn':
        if (turnRec && turnRec.p === d.p) lastRec = turnRec; freshHand.add(d.p); // рука взята заново — откроем все её карты
        if (d.p === viewIdx() && !WATCH && S.players[d.p] && pileSeen.p === d.p && pileSeen.gid === (S.gid || '')) {
          const q = S.players[d.p];
          flyHandRest();
          // сброс стал меньше — значит, колода кончилась и его перемешали в новую колоду
          if (q.discard.length < pileSeen.disc) { dealHold = 460; setTimeout(pileShuffle, 240); }
        }
        break;
      case 'dawn': {
        if (rec) rec.dawn = d;
        const it = [];
        if (d.envy) it.push({ to: null, from: d.p, amt: d.envy, src: 'Зависть', id: null, kind: 'dawn', ico: 'econ' });
        if (d.support) it.push({ to: d.p, from: null, amt: d.support, src: 'Народная поддержка', id: null, kind: 'dawn', ico: 'econ' });
        for (const o of d.tribute || []) it.push({ to: d.p, from: o.i != null ? o.i : o, amt: o.v || 1, src: o.why || 'Дань', id: null, kind: 'dawn', ico: 'war' });
        // доход начала хода — монетой на каждой карте, которая его дала (Дом, знамя, вера, придворный, Подаяния за 🕯)
        const parts = (d.src || []).map(t => { const m = /^(.*?)\s*\+(\d+)$/.exec(t); return m ? { src: m[1], amt: +m[2] } : null; });
        if (d.gain > 0 && Array.isArray(d.parts) && d.parts.length && d.parts.reduce((a, x) => a + x.v, 0) === d.gain) {
          for (const x of d.parts) it.push({ to: d.p, from: null, amt: x.v, src: x.name, why: x.why, ck: x.k, id: null, kind: 'dawn', ico: x.k === 'rule:faith' ? 'faith' : 'dawn' });
        } else if (d.gain > 0) {
          if (parts.length && parts.every(Boolean) && parts.reduce((a, x) => a + x.amt, 0) === d.gain) for (const x of parts) it.push({ to: d.p, from: null, amt: x.amt, src: x.src.charAt(0).toUpperCase() + x.src.slice(1), id: null, kind: 'dawn', ico: 'dawn' });
          else it.push({ to: d.p, from: null, amt: d.gain, src: 'доход хода', id: null, kind: 'dawn', ico: 'dawn' });
        }
        addCoins(it); // монеты ложатся на плитки и планки — соперник забирает свои сам, на виду
        break;
      }
      case 'play':
        if (rec && d.p === rec.p) { if (d.plot) rec.plotsSet++; else rec.plays.push(d); } if (sound) Sfx.card();
        if (!seeOthers(d.p) && !d.plot) {
          if (flown && flown.id === d.id && performance.now() - flown.t < 4000) flown = null;
          else flyHandEl(app.querySelector(`.handz .hcard.sel[data-id="${d.id}"]`) || app.querySelector(`.handz .hcard[data-id="${d.id}"]`), 'table');
        }
        if (seeOthers(d.p)) {
          if (d.plot) cardPop({ p: d.p, back: 'court', title: 'Отложили замысел', sub: d.kind === 'dice' ? 'сработает на своём числе — каком, не видно' : 'сработает через ход' });
          else cardPop({ p: d.p, kind: 'court', id: d.id, gk: `play:${d.p}:${d.id}`, n: 1, gold: d.gold || 0, cards: d.cards || 0 });
        }
        break;
      case 'seat':
        if (sound) Sfx.card();
        if (seeOthers(d.p)) cardPop({ p: d.p, kind: 'court', id: d.id, title: `Ко двору${d.discard ? ' из сброса' : ''}: «${esc(D.COURT[d.id].name)}»`, sub: `${esc(D.COURT[d.id].stext)}${d.out ? ` «${esc(D.COURT[d.out].name)}» уходит в их сброс.` : ''}` });
        break;
      case 'sin': {
        const c = D.COURT[d.id];
        toast(`😈 ${d.p === ME ? 'Вы взяли' : `${esc(H(S.players[d.p]).short)} взяли`} грех «${esc(c.name)}». До конца игры: ${esc(c.pen)}`, 4200);
        break;
      }
      case 'penance':
        if (d.p === ME) toast(d.done ? `🕯 Покаяние окончено: грех «${esc(D.COURT[d.id].name)}» снят` : d.fail ? `🕯 Покаяние сорвано${d.step ? ` на шаге ${d.step}` : ''} — начать заново можно со следующего хода` : `🕯 Покаяние: шаг ${d.step} из 4`, 3800);
        else if (d.done) toast(`🕯 ${esc(H(S.players[d.p]).short)} сняли грех «${esc(D.COURT[d.id].name)}»`, 3200);
        break;
      case 'ritual': {
        const W = d.id ? D.RITUALS[d.id] : null, who = d.p === ME ? 'Вы' : esc(H(S.players[d.p]).short);
        if (d.start && W) toast(`✨ ${who} начали ритуал «${esc(W.name)}» — 5 условий, награда — чудо «${esc(W.miracle.name)}»`, 3600);
        else if (d.burn && W) toast(`✨ ${d.p === ME ? 'Ваш ритуал' : `Ритуал ${esc(E.shortG(S.players[d.p]))}`} «${esc(W.name)}» прерван — отметки сгорели`, 3600);
        else if (d.step != null && W && d.p === ME && d.n < W.steps.length) toast(`✨ «${esc(W.name)}»: ${esc(D.STEP_NAME[W.steps[d.step].k].toLowerCase())} — готово, отметок ${d.n} из ${W.steps.length}`, 2600);
        else if (d.borrow && d.from === ME) toast(`🌑 ${who} взяли на ход вашу карту «${esc(D.COURT[d.borrow].name)}» — в конце хода она вернётся`, 3800);
        else if (d.dictate === ME) toast(`🌑 ${who}: в ваш следующий ход — ${d.n === 2 ? 'два кубика' : 'один кубик'}`, 3800);
        break;
      }
      case 'miracle': { const W = D.RITUALS[d.id]; toast(`🌟 ${d.p === ME ? 'Ваше чудо' : `${esc(H(S.players[d.p]).short)}: чудо`} «${esc(W.miracle.name)}» — ${esc(W.miracle.text)}`, 5200); break; }
      case 'lust': { // Похоть (v10.18)
        const names = (d.ids || []).map(id => `«${esc(D.COURT[id].name)}»`).join(', ');
        if (d.lose) { if (d.t === ME) toast(`😈 Похоть: итог ${d.total} — ${names} уходит в сброс ${esc(H(S.players[d.a]).gen)}`, 4200); else if (d.a === ME) toast(`😈 Похоть ${esc(E.shortG(S.players[d.t]))}: итог ${d.total} — ${names} теперь в вашем сбросе`, 4200); }
        else if (d.t === ME) toast(`😈 Похоть: ${esc(H(S.players[d.a]).short)} забрали из вашего сброса ${names}`, 4800);
        break;
      }
      case 'summon': toast(`😈 ${d.p === ME ? 'Вы собрали' : `${esc(H(S.players[d.p]).short)} собрали`} все семь грехов — призыв знамён!`, 4500); break;
      case 'unseat': {
        const nm1 = esc(D.COURT[d.id].name);
        if (d.lust) { if (d.a == null) { if (d.t === ME) toast(`😈 Похоть: «${nm1}» уходит от вашего двора в сброс`, 3600); } else if (d.t === ME) toast(`😈 Похоть: ${esc(E.shortG(S.players[d.a]))} переманили вашего придворного «${nm1}»`, 3600); else if (d.a === ME) toast(`😈 Похоть: «${nm1}» теперь при вашем дворе`, 3600); break; }
        if (d.a == null) { if (d.t === ME) toast(`🪑 Мест при дворе стало меньше: «${nm1}» уходит в ваш сброс`, 3600); break; }
        const an = esc(E.shortG(S.players[d.a]));
        if (d.t === ME) toast(`🪑 Опала: ${an} прогнали вашего придворного «${nm1}» — он уходит в ваш сброс и со временем снова придёт в руку`, 4400);
        else if (d.a === ME) toast(`🪑 Опала: «${nm1}» ${esc(E.shortG(S.players[d.t]))} уходит в их сброс`, 3600);
        break;
      }
      case 'buy':
        if (rec && d.p === rec.p) rec.buys.push(d); if (sound) Sfx.card();
        { const est = d.estate; const def = est ? D.ESTATES[d.id] : D.COURT[d.id];
          const toHand = !est && !def.bad && S.players[d.p].hand[S.players[d.p].hand.length - 1] === d.id && !!E.mods(S, S.players[d.p]).courtToHand;
          if (seeOthers(d.p)) cardPop({ p: d.p, kind: est ? 'estate' : 'court', id: d.id, title: `Купили «${esc(def.name)}» за ${d.price}🪙`, sub: est ? `${D.ETYPE[def.t].mark} ${esc(D.estateText(def))}` : toHand ? 'карта двора — им в руку' : 'карта двора уходит в их сброс', to: def.bad ? null : () => flyTarget(d.p, est ? 'estate' : 'court', d.id) });
          else if (def.bad) flySrc = null; // проклятие уходит сопернику
          else if (def.sin) flyMine('sin', d.id); // грех ложится перед игроком — карта летит на кнопку «Двор»
          else if (flyMine(est ? 'estate' : toHand ? 'hand' : 'court', d.id)) { if (!est && !toHand) toast(`«${esc(def.name)}» — в ваш сброс: придёт в руку, когда колода перемешается`, 2600); }
          else if (!est) cardPop({ p: d.p, kind: 'court', id: d.id, title: `«${esc(def.name)}» — ${toHand ? 'вам в руку' : 'в ваш сброс'}`, sub: toHand ? 'можно сыграть в этот же ход' : 'придёт в руку, когда колода перемешается', mine: true });
          if (d.p === ME) drawer = null; } // покупка сделана — лист рынка закрывается: видно, что легло на стол
        break;
      case 'dice':
        diceSeq++;
        if (!d.final && !d.adj) {
          const key = `${S.round}:${d.p}`;
          // новый бросок (в том числе в дополнительном ходе того же игрока): кубики летят заново
          if (throwKey !== key || !stg || stg.final) { throwKey = key; startThrow(d.n || d.vals.length, oppEl(d.p), null, d); }
          else if (!stg.waiting) stageUpdate(d); // переброс и прочее: кубики снова в воздухе посреди экрана
        }
        diceView = Object.assign({ tk: turnKey() }, d);
        if (d.final) {
          rollPrev = rollView;
          rollView = { a: d.p, r: d.total, vals: d.vals, n: d.n, adj: d.adj || 0, ev: [], plots: [], tk: turnKey() };
          oppMoments = oppMoments.filter(m => m.kind === 'dawn' && m.tk === turnKey()); // на «Столе» — только этот ход и этот бросок
          stageFinal(d);
        }
        if (!d.final && !rolling) { rolling = true; setTimeout(() => { rolling = false; schedule(); }, 520); }
        break;
      case 'income': {
        if (!rollView || rollView.a !== d.a) rollView = { a: d.a, r: d.r, vals: [d.r], n: 1, adj: 0, ev: [], plots: [], tk: turnKey() };
        rollView.ev = d.ev;
        {
          const items = d.ev.filter(x => x.amt > 0).map(x => ({ to: x.to, from: x.from != null ? x.from : null, amt: x.amt, src: x.src, id: x.id || null, uid: x.uid != null ? x.uid : null, parts: x.parts || null, kind: 'roll' }));
          // кубики легли — плитки вспыхивают: свои монеты игрок забирает касанием, соперник берёт свои на виду
          const s0 = stg;
          if (s0) { const cs = addCoins(items, { hold: true }); s0.chain.then(() => wait(reduceMotion() ? 0 : 260)).then(() => releaseCoins(cs)); setTimeout(() => releaseCoins(cs), 6000); }
          else addCoins(items);
        }
        if (rec && rec.p === d.a) rec.roll = rollView;
        if (ME === null) break;
        const paidEv = d.ev.filter(x => x.amt > 0);
        if (S.tut) {
          if (d.a === ME) S.tut.lastInc = { r: d.r, gain: paidEv.filter(x => x.to === ME).map(x => [x.amt, x.src]), loss: paidEv.filter(x => x.from === ME).map(x => [x.amt, x.src]) };
          else { const lost = paidEv.filter(x => x.from === ME); if (lost.length) tutQueue('hold-hit', { amt: lost.reduce((a, x) => a + x.amt, 0), src: lost.map(x => x.src).join(', ') }); }
        }
        break;
      }
      case 'plot':
        if (d.active != null && rollView) rollView.plots.push(d);
        else if (rec && rec.p === d.p) rec.plots.push(d);
        if (d.p === ME) toast(`${d.kind === 'dice' ? '🎲' : '⏳'} Ваш замысел «${esc(D.COURT[d.id].name)}» сработал${d.gold > 0 ? `: +${d.gold}🪙` : ''}`, 3000);
        break;
      case 'siege': {
        const a = S.players[d.a], t = S.players[d.t];
        if (sound) Sfx.thud();
        if (music) Music.siege(!!d.win);
        if (d.t === ME) tutQueue('siege-me');
        const en = (id) => `«${esc(D.ESTATES[id].name)}»`;
        const what = d.plant ? 'подбрасывают вам беду' : d.raze ? 'обстреливают вас' : 'нападают на вас';
        const res = !d.win ? 'Вы отбились' : d.plant ? `У вас ${en(d.plant)}` : d.raze ? (d.gone ? `${en(d.gone)} разрушено навсегда` : 'Разрушать у вас нечего') : (d.got ? `Вы потеряли ${en(d.got)}` : 'Забрать у вас нечего');
        const mine = !d.win ? 'Не вышло' : d.plant ? `${en(d.plant)} теперь у них` : d.raze ? (d.gone ? `${en(d.gone)} разрушено` : 'Разрушать нечего') : (d.got ? `Вы забрали ${en(d.got)} — оно в руинах, отстроится при первом срабатывании` : 'Забрать нечего');
        {
          // числа сходятся посреди стола; владение переезжает к новому хозяину, когда сцена закончится
          const short = !d.win ? (d.t === ME ? 'Вы отбились' : d.a === ME ? 'Не вышло' : `${esc(H(t).short)} отбились`) : d.plant ? `Беда ${en(d.plant)} — у ${d.t === ME ? 'вас' : esc(E.shortG(t))}` : d.raze ? (d.gone ? `${en(d.gone)} разрушено` : 'Разрушать нечего') : d.got ? `${en(d.got)} — ${d.a === ME ? 'ваше' : `у ${esc(E.shortG(a))}`}` : 'Забрать нечего';
          const shown = d.A != null && duel(d.a, { t: d.t, A: d.A, D: d.D, la: 'атака', ld: 'оборона', icon: d.raze ? '💥' : '⚔️', res: short, win: !!d.win,
            move: d.win && d.got ? { from: d.t, to: d.a, id: d.got } : d.win && d.plant ? { from: null, to: d.t, id: d.plant } : null, gone: d.win && d.gone ? { pi: d.t, id: d.gone } : null });
          if (shown) { if (d.win && d.got && d.a === ME) toast(`${en(d.got)} — в руинах: отстроится при первом срабатывании`, 3200); break; }
        }
        if (d.t === ME) toast(`${d.raze ? '💥' : '⚔️'} ${pname(a)} ${what}: атака ${d.A} против обороны ${d.D}. ${res}`, 4600);
        else if (d.a === ME) toast(`${d.raze ? '💥' : d.plant ? '⬛' : '⚔️'} ${d.plant ? 'Подбросить' : d.raze ? 'Разрушение' : 'Захват'} — ${esc(E.shortG(t))}: атака ${d.A} против обороны ${d.D}. ${mine}`, 4000);
        break;
      }
      case 'spy':
        if (music) Music.spy(!!d.ok);
        if (d.t === ME) tutQueue('spy-me');
        {
          const an = esc(E.shortG(S.players[d.a])), tn = esc(H(S.players[d.t]).short), en = d.estate && D.ESTATES[d.estate] ? `«${esc(D.ESTATES[d.estate].name)}»` : '';
          const roll = d.A != null ? ` (шпион ${d.A} против стражи ${d.G})` : '';
          const cn = (id) => `«${esc((D.COURT[id] || D.BAN[id] || {}).name || id)}»`;
          const pe = d.plantEstate && D.ESTATES[d.plantEstate] ? `«${esc(D.ESTATES[d.plantEstate].name)}»` : '';
          const tossed = d.toss && d.toss.length ? d.toss.map(cn).join(', ') : '';
          const extra = pe ? `вам подбросили проклятие ${pe}` : d.arson ? `поджог: вы потеряли ${d.arson}🪙` : d.toss ? [tossed ? `в сброс ушли ${tossed}` : '', d.lose ? `−${d.lose}🪙` : ''].filter(Boolean).join(', ') : d.slander ? 'клевета: в свой ход вы не купите карты двора' : d.grab ? `забрали из вашего сброса ${cn(d.grab)}` : d.burn ? `сожгли ${D.cards(d.burn)} из вашего сброса` : d.poach ? `переманили вассала ${cn(d.poach)}` : d.distract ? `${cn(d.distract)} отвлечён до конца вашего хода` : d.riot ? `содержание в ваш ход +${d.riot}🪙` : null;
          const extra2 = pe ? `${pe} теперь у ${esc(E.shortG(S.players[d.t]))}` : d.arson ? `${tn} теряют ${d.arson}🪙` : d.toss ? `${tn}: ${[tossed ? `в сброс ${tossed}` : '', d.lose ? `−${d.lose}🪙` : ''].filter(Boolean).join(', ')}` : d.slander ? `${tn} не купят карты двора в свой ход` : d.grab ? `${cn(d.grab)} — в вашем сбросе` : d.burn ? `сожгли ${D.cards(d.burn)}` : d.poach ? `${cn(d.poach)} теперь ваш` : d.distract ? `${cn(d.distract)} отвлечён` : d.riot ? `смута: содержание у них +${d.riot}🪙` : null;
          if (d.buyoff) { if (d.t === ME) toast(`🗝 Вы откупились от шпиона ${an}: −${d.buyoff}🪙`, 3800); else if (d.a === ME) toast(`🗝 ${tn} откупились от вашего шпиона: +${d.buyoff}🪙`, 3800); break; }
          if (d.A != null && d.G != null && flyOn()) {
            // шпион против стражи — посреди стола, без окна; владение (вымогательство) переезжает после сцены
            const txt = d.none ? 'Удача, но взять нечего' : !d.ok ? (d.a === ME ? 'Вашего шпиона поймали' : d.t === ME ? 'Ваша стража поймала шпиона' : 'Шпиона поймали')
              : d.bribed ? `Откуп: ${d.cost}🪙` : d.estate ? `${en} — ${d.a === ME ? 'ваше' : `у ${an}`}` : d.t === ME && extra ? extra.charAt(0).toUpperCase() + extra.slice(1) : extra2 ? extra2.charAt(0).toUpperCase() + extra2.slice(1) : d.amt ? `${d.a === ME ? 'Вам' : d.t === ME ? 'У вас забрали' : 'Украдено'} ${d.amt}🪙` : 'Шпионаж удался';
            if (duel(d.a, { t: d.t, A: d.A, D: d.G, la: 'шпион', ld: 'стража', icon: '🗝', res: txt, win: !!d.ok, move: d.ok && d.estate && !d.bribed ? { from: d.t, to: d.a, id: d.estate } : d.ok && d.plantEstate ? { from: null, to: d.t, id: d.plantEstate } : null, gone: null })) break;
          }
          if (d.none) { if (d.t === ME) toast(`🗝 Шпион ${an} пробрался, но взять у вас нечего${roll}`, 3800); else if (d.a === ME) toast(`🗝 Удача, но взять нечего${roll}`, 3600); break; }
          if (d.t === ME) toast(!d.ok ? `🗝 Ваши стены остановили шпиона ${an}${roll}` : d.bribed ? `🗝 Вы откупились от вымогателей ${an}: −${d.cost}🪙, ${en} остаётся у вас` : d.estate ? `🗝 Вымогательство ${an} удалось: вы отдали ${en}` : extra ? `🗝 ${an}: ${extra}` : `🗝 Шпион ${an} у вас преуспел${d.amt ? `: −${d.amt}🪙` : ''}`, 4200);
          else if (d.a === ME) toast(!d.ok ? `🗝 Вашего шпиона поймали${roll}` : d.bribed ? `🗝 ${tn} откупились от вымогательства: +${d.cost}🪙` : d.estate ? `🗝 Вымогательство удалось: ${en} теперь ваше` : extra2 ? `🗝 Удача: ${extra2}` : `🗝 Шпионаж удался${d.amt ? `: +${d.amt}🪙` : ''}`, 3800);
        }
        break;
      case 'regalia':
        if (rec && rec.p === d.p) rec.regs.push(d);
        if (R.finishRound && E.meetsGoal(S, S.players[d.p]) && S.winner === null) { tutQueue('finish', { p: d.p }); toast(`🏁 ${d.p === ME ? 'Вы выполнили цель' : `${pname(S.players[d.p])} выполнили цель`}: ${D.banners(E.goal(S))}! Круг доигрывается до конца`, 4600); break; }
        {
          const p = S.players[d.p]; const def = D.BAN[d.id];
          const what = def.tier === 'v' ? 'вассала' : def.tier === 'l' ? (def.heir ? 'Наследника' : 'лорда') : 'великого лорда';
          if (seeOthers(d.p)) cardPop({ p: d.p, kind: 'ban', id: d.id, jingle: true, title: `Наняли ${what} «${esc(D.regName(def))}» · 🚩 ${E.regCount(p)}/${E.goal(S)}`, sub: `Даёт им: ${regText(def)}`, to: () => flyTarget(d.p, 'ban', d.id) });
          else { if (music) Music.jingle(true, def.tier === 'v' ? 'vassal' : 'lord', d.id, p.house); drawer = null; flyMine('ban', d.id); }
        }
        break;
      case 'upkeep':
        if (d.released && d.released.length) { const nmz = d.released.map(id => `«${esc(D.BAN[id].name)}»`).join(', '); toast(d.p === ME ? `🪙 Не хватило на содержание: ${nmz} уходит под колоду великих лордов` : `${pname(S.players[d.p])}: не хватило на содержание — ${nmz} уходит`, 4400); }
        break;
      case 'faith': {
        const F = D.FAITHS[d.id];
        if (d.p !== ME && seeOthers(d.p)) toast(`${F.icon} ${pname(S.players[d.p])} ${d.adopt ? 'приняли' : 'отреклись от'} веры «${esc(F.name)}»`, 3200);
        else if (d.adopt) flyMine('faith', d.id); else flySrc = null;
        break;
      }
      case 'rite': {
        const F = D.FAITHS[d.id];
        if (sound) Sfx.card();
        if (d.p !== ME && seeOthers(d.p)) toast(`${F.icon} ${pname(S.players[d.p])}: обряд «${esc(F.rite.name)}»`, 2600);
        break;
      }
      case 'retire': if (sound) Sfx.card(); break;
      case 'refresh': {
        if (rfTapped) { rfTapped = false; break; }
        if (WATCH || ME === null) break;
        const k = d.row, nmOf = (id) => (id == null ? '' : ['v', 'l', 'g'].includes(k) ? D.BAN[id].name : k === 'court' ? D.COURT[id].name : D.ESTATES[id].name);
        const L1 = (kk, out, inn) => ({ row: RF_NAME[kk] || '', one: `ряд ${RF_NAME[kk] || ''} — «${esc(out)}» ушла под колоду${inn ? `, открылась «${esc(inn)}»` : ''}` });
        // несколько рядов за раз — одной подсказкой
        rfBuf.push(L1(k, nmOf(d.out), d.in != null ? nmOf(d.in) : null));
        if (!rfTimer) rfTimer = setTimeout(() => { const Ls = rfBuf.splice(0); rfTimer = null; if (Ls.length) toast(Ls.length === 1 ? `<b>↻ Новый круг:</b> ${Ls[0].one}` : `<b>↻ Новый круг:</b> обновились ряды ${Ls.map(x => x.row).join(', ')}`, 3200); }, 60);
        break;
      }
      case 'union': if (d.p === ME) toast(`🏔 Новый союз провинций: +${d.gold}🪙`, 2600); break;
      case 'log':
        if (d.pi === ME && (d.kind === 'envy' || d.kind === 'support' || d.kind === 'catchup')) tutQueue(d.kind);
        if (d.pi === ME && d.kind === 'catchup') toast(`<b>🫱 Догоняющий наём</b>: ${cuWhy(S.players[ME], true)} — в этот ход можно нанять ещё одного вассала без действия`, 4200);
        if (rec && !d.edit && REC_NOTES.includes(d.kind)) rec.notes.push(d.text.trim());
        break;
    }
    schedule();
  }


  // ---------- стол: кубик рукой и монеты рукой ----------
  const pipsHtml = (v) => Array.from({ length: 9 }, (_, k) => `<i class="${PIPS[v].includes(k) ? 'on' : ''}"></i>`).join('');
  const oppEl = (i) => document.querySelector(`.board [data-gold="${i}"]`) || document.querySelector('.board .pbar.foe'); // золото игрока на его планке
  let diceSeq = 0, throwKey = null, throwP = null, flick = null, lastShake = 0;
  const throwDone = () => throwP || Promise.resolve();
  const ctr = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, top: r.top, bottom: r.bottom }; };
  const toPage = (pt) => pt;
  document.addEventListener('pointerdown', (e) => {
    if (sound) Sfx.unlock();
    if (music) { Music.unlock(); if (S && S.winner === null && !WATCH) Music.house(S.players[S.cur].house); }
    const d = e.target.closest && e.target.closest('.tdie-w');
    if (d) flick = { x: e.clientX, y: e.clientY, t: performance.now(), el: d, vx: 0, vy: 0 };
  }, { passive: true, capture: true });
  document.addEventListener('pointerup', (e) => {
    if (!flick) return;
    const dt = Math.max(16, performance.now() - flick.t);
    flick.vx = (e.clientX - flick.x) / dt; flick.vy = (e.clientY - flick.y) / dt;
  }, { passive: true, capture: true });
  // ---------- кубики посреди экрана: летят от того, кто бросает, кувыркаются и ложатся; переброс — снова в воздух ----------
  // кубик — объёмный: шесть граней; к зрителю поворачиваем нужную грань (rotateZ() rotateX() rotateY(); rotateZ — поворот лежащей грани)
  const FACE_ROT = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };
  const D3 = 60; // ребро кубика, px
  const stgK = () => (reduceMotion() ? 0 : speed === 'slow' ? 1.25 : speed === 'fast' ? 0.8 : 1);
  let stg = null; // сцена: { el, res, dice, p, chain, waiting, busy, hold, final, hideT, gone, goneRes }
  let rollPrev = null; // прошлый бросок
  // что показывать на столе: пока новые кубики в воздухе — прошлый бросок (итог не раскрываем раньше, чем лягут кубики)
  const rvShown = () => (stg && stg.hold ? rollPrev : rollView);
  const diceBusy = () => !!(stg && (stg.busy || stg.hold));
  const stageGone = () => (stg ? stg.gone : Promise.resolve());
  const rotOf = (x) => `rotateZ(${x.rz}deg) rotateX(${x.rx}deg) rotateY(${x.ry}deg)`;
  // анимация, которая по окончании оставляет конечное положение в стиле элемента (следующая начнётся с него)
  function anim(el, frames, opts) {
    if (!el.animate) { const f = frames[frames.length - 1]; if (f.transform) el.style.transform = f.transform; if (f.opacity != null) el.style.opacity = f.opacity; return Promise.resolve(); }
    const a = el.animate(frames, Object.assign({ fill: 'forwards' }, opts));
    return a.finished.then(() => { const f = frames[frames.length - 1]; if (f.transform) el.style.transform = f.transform; if (f.opacity != null) el.style.opacity = f.opacity; a.cancel(); }).catch(() => {});
  }
  function stgOpen(p) {
    if (stg) stgKill(); // прошлый бросок ещё на экране или уезжает — убрать сразу
    const el = document.createElement('div'); el.className = 'dstage'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="ds-res"></div>';
    document.body.appendChild(el);
    let goneRes; const gone = new Promise(r => { goneRes = r; });
    stg = { el, res: el.querySelector('.ds-res'), dice: [], p, chain: Promise.resolve(), waiting: false, hideT: 0, gone, goneRes };
    requestAnimationFrame(() => el.classList.add('on'));
    return stg;
  }
  function stgClose(delay) {
    const s = stg; if (!s) return;
    clearTimeout(s.hideT);
    s.hideT = setTimeout(() => stgLeave(s), delay);
  }
  // куда кладём кубики после показа: «Итог броска» на столе, если он виден, иначе — итог в шапке
  function rollTargets(n) {
    const ds = [...document.querySelectorAll('.board .center .well .sdie')];
    if (ds.length < n || !ds[0].getBoundingClientRect().width) return null;
    return ds.slice(0, n).map(el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; });
  }
  function stgLeave(s) {
    if (s.leaving) return;
    s.leaving = true; schedule(); // середина стола открывает итог: кубики уменьшаются и ложатся в лоток
    let ended = false;
    const done = () => {
      if (ended) return; ended = true;
      s.el.remove(); if (stg === s) stg = null; s.goneRes();
      if (s.final) { chipRoll = s.final; chipPulse = performance.now(); }
      schedule();
    };
    const K = stgK(), tg = s.dice.length ? rollTargets(s.dice.length) : null;
    if (!tg || !K) { s.el.classList.add('out'); setTimeout(done, K ? 260 : 0); return; }
    s.el.classList.add('leave');
    const ms = Math.round(560 * K);
    const ps = s.dice.map((x, k) => {
      const home = { x: parseFloat(x.w.style.left) + D3 / 2, y: parseFloat(x.w.style.top) + D3 / 2 };
      const T = toPage(tg[k]), dx = T.x - home.x, dy = T.y - home.y, sc = Math.max(0.2, tg[k].w / D3);
      const from = rotOf(x);
      x.rz = 360 * Math.round(x.rz / 360); // грань — ровно, как на маленьком кубике
      anim(x.sh, [{ opacity: 1 }, { opacity: 0 }], { duration: Math.round(ms * 0.4) });
      anim(x.w.querySelector('.d3-t'), [{ transform: 'rotateX(-20deg) rotateY(24deg)' }, { transform: 'rotateX(0deg) rotateY(0deg)' }], { duration: ms, delay: k * 70, easing: 'ease-in-out' });
      anim(x.c, [{ transform: from }, { transform: rotOf(x) }], { duration: ms, delay: k * 70, easing: 'ease-in-out' });
      return anim(x.w, [
        { transform: `translate(${x.sx}px, ${x.sy}px) scale(1)` },
        { transform: `translate(${(x.sx + dx) / 2}px, ${(x.sy + dy) / 2 - 40}px) scale(${(1 + sc) / 2})`, offset: 0.45 },
        { transform: `translate(${dx}px, ${dy}px) scale(${sc})` },
      ], { duration: ms, delay: k * 70, easing: 'cubic-bezier(.45,.05,.3,1)' });
    });
    Promise.all(ps).then(() => { if (sound && stg === s) Sfx.tick(); done(); });
    setTimeout(done, ms + 600); // страховка
  }
  function stgKill() { if (!stg) return; const s = stg; stg = null; clearTimeout(s.hideT); s.el.remove(); s.goneRes(); if (s.final) chipRoll = s.final; }
  // кто бросил и что выпало — под кубиками
  function stgLabel(p, vals, what, adj) {
    if (!stg) return;
    const raw = vals.reduce((a, b) => a + b, 0), tot = Math.max(1, Math.min(12, raw + (adj || 0)));
    const who = p === ME && !WATCH ? 'Вы' : S && S.players[p] ? esc(H(S.players[p]).short) : '';
    const how = [vals.length > 1 ? vals.join(' + ') : '', adj ? `${raw} ${adj > 0 ? '+' : '−'} ${Math.abs(adj)} — сдвиг` : ''].filter(Boolean).join(' · ');
    stg.res.innerHTML = `<b class="ds-n">${tot}</b><span>${what ? `${what} · ` : ''}${who}${how ? ` · ${how}` : ''}</span>`;
    stg.res.classList.remove('in'); void stg.res.offsetWidth; stg.res.classList.add('in');
  }
  // новый кубик: прилетает из точки F (координаты страницы) к своему месту на середине экрана
  function stgAdd(s, n, k, F) {
    const w = document.createElement('div'); w.className = 'd3';
    w.innerHTML = `<div class="d3-t"><div class="d3-c"><i class="d3-in x"></i><i class="d3-in y"></i><i class="d3-in z"></i>${[1, 2, 3, 4, 5, 6].map(v => `<div class="d3-f f${v}">${pipsHtml(v)}</div>`).join('')}</div></div>`;
    const sh = document.createElement('div'); sh.className = 'd3-sh';
    // кубики ложатся посреди стола — над лотком итога броска
    const cz = document.querySelector('.board > .center'), zr = cz ? cz.getBoundingClientRect() : null;
    const gap = zr && zr.height < 130 ? 74 : 88;
    const hx = (zr ? zr.left + zr.width / 2 : innerWidth / 2) + (k - (n - 1) / 2) * gap + (Math.random() - 0.5) * 12, hy = (zr ? zr.top + zr.height * 0.52 : innerHeight * 0.4) + (Math.random() - 0.5) * 8;
    for (const e of [sh, w]) { e.style.left = (hx - D3 / 2) + 'px'; e.style.top = (hy - D3 / 2) + 'px'; s.el.appendChild(e); }
    const x = { w, sh, c: w.querySelector('.d3-c'), rx: 0, ry: 0, rz: 0, sx: 0, sy: 0, v: 0 };
    const K = stgK(), ms = Math.round(640 * K), r = (a) => (Math.random() < 0.5 ? -1 : 1) * (a + Math.random() * 300);
    const dx = F.x - hx, dy = F.y - hy;
    x.rx = r(540); x.ry = r(540); x.rz = r(120);
    x.c.style.transform = `rotateZ(0deg) rotateX(${Math.round((Math.random() - 0.5) * 120)}deg) rotateY(${Math.round((Math.random() - 0.5) * 120)}deg)`;
    anim(x.w, [
      { transform: `translate(${dx}px, ${dy}px) scale(.55)`, opacity: 0.3 },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 110}px) scale(1.4)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx * 0.08}px, ${dy * 0.08 - 18}px) scale(1.08)`, opacity: 1, offset: 0.82 },
      { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
    ], { duration: ms, easing: 'cubic-bezier(.3,.55,.35,1)' });
    anim(x.sh, [{ transform: `translate(${dx * 0.6}px, ${dy * 0.6}px) scale(.3)`, opacity: 0 }, { transform: `translate(${dx * 0.2}px, ${dy * 0.2}px) scale(.55)`, opacity: 0.15, offset: 0.6 }, { transform: 'translate(0px, 0px) scale(1)', opacity: 1 }], { duration: ms, easing: 'ease-in' });
    x.fly = anim(x.c, [{ transform: x.c.style.transform }, { transform: rotOf(x) }], { duration: ms, easing: 'linear' });
    if (sound) Sfx.hit(0.85 + Math.random() * 0.15, ms / 1000 + k * 0.035 + Math.random() * 0.02); // удар о стол
    return x;
  }
  // кубик подпрыгивает (переброс): снова в воздух, кувыркается
  function stgHop(x) {
    const K = stgK(), ms = Math.round(520 * K), r = (a) => (Math.random() < 0.5 ? -1 : 1) * (a + Math.random() * 260);
    const nx = x.sx + (Math.random() - 0.5) * 34, ny = x.sy + (Math.random() - 0.5) * 18;
    const from = rotOf(x);
    x.rx += r(360); x.ry += r(360); x.rz += r(90);
    anim(x.w, [{ transform: `translate(${x.sx}px, ${x.sy}px) scale(1)` }, { transform: `translate(${(x.sx + nx) / 2}px, ${(x.sy + ny) / 2 - 120}px) scale(1.42)`, offset: 0.48 }, { transform: `translate(${nx}px, ${ny}px) scale(1)` }], { duration: ms, easing: 'cubic-bezier(.3,.6,.4,1)' });
    anim(x.sh, [{ transform: `translate(${x.sx}px, ${x.sy}px) scale(1)`, opacity: 1 }, { transform: `translate(${(x.sx + nx) / 2}px, ${(x.sy + ny) / 2}px) scale(.5)`, opacity: 0.25, offset: 0.48 }, { transform: `translate(${nx}px, ${ny}px) scale(1)`, opacity: 1 }], { duration: ms });
    x.sx = nx; x.sy = ny;
    if (sound) Sfx.hit(0.8 + Math.random() * 0.15, ms / 1000 + Math.random() * 0.03);
    return anim(x.c, [{ transform: from }, { transform: rotOf(x) }], { duration: ms, easing: 'linear' });
  }
  // кубик ложится нужной гранью: отскок, докатывается, замирает
  function stgSettle(x, v) {
    const K = stgK(), ms = Math.round(580 * K);
    const [fx, fy] = FACE_ROT[v] || FACE_ROT[1];
    const near = (cur, base) => { const dir = cur >= 0 ? 1 : -1; let t = base + 360 * Math.round((cur - base) / 360); if (dir > 0 && t < cur + 60) t += 360; if (dir < 0 && t > cur - 60) t -= 360; return t; };
    const from = rotOf(x);
    x.rx = near(x.rx, fx); x.ry = near(x.ry, fy); x.rz = 90 * Math.round((x.rz + (x.rz >= 0 ? 100 : -100)) / 90);
    const ex = x.sx + (Math.random() - 0.5) * 24, ey = x.sy + (Math.random() - 0.5) * 12;
    anim(x.w, [
      { transform: `translate(${x.sx}px, ${x.sy}px) scale(1)` },
      { transform: `translate(${(x.sx + ex) / 2}px, ${(x.sy + ey) / 2 - 30}px) scale(1.12)`, offset: 0.34 },
      { transform: `translate(${ex * 0.9 + x.sx * 0.1}px, ${ey * 0.9 + x.sy * 0.1}px) scale(1)`, offset: 0.6 },
      { transform: `translate(${ex}px, ${ey - 7}px) scale(1.03)`, offset: 0.78 },
      { transform: `translate(${ex}px, ${ey}px) scale(1)` },
    ], { duration: ms, easing: 'ease-out' });
    anim(x.sh, [{ transform: `translate(${x.sx}px, ${x.sy}px) scale(1)`, opacity: 1 }, { transform: `translate(${(x.sx + ex) / 2}px, ${(x.sy + ey) / 2}px) scale(.8)`, opacity: 0.7, offset: 0.34 }, { transform: `translate(${ex}px, ${ey}px) scale(1)`, opacity: 1 }], { duration: ms, easing: 'ease-out' });
    x.sx = ex; x.sy = ey; x.v = v;
    if (sound && ms) { const j = Math.random() * 0.02; Sfx.hit(0.45, ms * 0.6 / 1000 + j); Sfx.hit(0.16, ms / 1000 + j); } // отскок и последний стук
    return anim(x.c, [{ transform: from }, { transform: rotOf(x) }], { duration: ms, easing: 'cubic-bezier(.12,.75,.25,1)' });
  }
  // бросок: кубики летят от бросающего (fromEl — кнопка броска или герб соперника); числа — сразу (d) или когда их пришлёт движок
  function startThrow(n, fromEl, fl, d) {
    n = Math.max(1, Math.min(2, n || 1));
    if (sound) Sfx.shake(n);
    if (!S) return;
    const pi = d ? d.p : S.cur;
    const s = stgOpen(pi);
    s.prevChip = chipRoll; chipRoll = null; // итог в шапке пуст, пока новые кубики не лягут в него
    s.busy = true; s.logLen = S.log.length; // пока кубики в воздухе, стол и журнал итог не показывают
    const seq0 = diceSeq;
    let from0 = fromEl && fromEl.getBoundingClientRect().width ? ctr(fromEl) : null;
    if (!from0 || from0.y < 0 || from0.y > innerHeight) from0 = { x: from0 ? Math.max(30, Math.min(innerWidth - 30, from0.x)) : innerWidth / 2, y: pi === ME && !WATCH ? innerHeight + 50 : -50 };
    if (fl && (fl.vx || fl.vy)) from0 = { x: from0.x - fl.vx * 40, y: from0.y - fl.vy * 40 };
    const F = toPage(from0);
    for (let k = 0; k < n; k++) s.dice.push(stgAdd(s, n, k, F));
    s.waiting = !d;
    const run = (async () => {
      await Promise.all(s.dice.map(x => x.fly));
      let vals = d ? d.vals : null;
      if (!vals) {
        for (let w = 0; w < 50 && diceSeq === seq0; w++) await wait(60);
        if (diceSeq === seq0) { // бросок не состоялся (нет связи, ход уже не ваш): убрать кубики, чисел не показывать
          if (stg === s) { s.busy = false; s.waiting = false; s.el.classList.add('out'); await wait(260); if (stg === s) { stgKill(); chipRoll = s.prevChip; } }
          return;
        }
        vals = diceView && diceView.vals ? diceView.vals : [1];
      }
      s.waiting = false;
      if (stg !== s) return;
      // движок мог оставить один кубик (проклятие «Сглаз») — лишний убираем
      while (s.dice.length > vals.length) { const x = s.dice.pop(); anim(x.w, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).then(() => { x.w.remove(); x.sh.remove(); }); }
      await Promise.all(s.dice.map((x, k) => stgSettle(x, vals[k] || 1)));
      s.busy = false; s.settledAt = performance.now();
      stgLabel(pi, vals, '');
    })();
    s.chain = run;
    const runP = run.then(() => { if (throwP === runP) throwP = null; schedule(); });
    throwP = runP;
  }
  // следующий бросок того же хода: переброс, второй кубик (добросок), выбор из двух бросков
  function stageUpdate(d) {
    const s = stg; if (!s) return;
    const run = s.chain.then(async () => {
      if (stg !== s) return;
      const vals = d.vals, n = vals.length;
      const added = [];
      while (s.dice.length < n) { const k = s.dice.length; const fe = oppEl(d.p), fr = fe ? fe.getBoundingClientRect() : null; const from0 = fr && fr.width ? { x: fr.left + fr.width / 2, y: fr.top + fr.height / 2 } : { x: innerWidth / 2, y: d.p === ME && !WATCH ? innerHeight + 50 : -50 }; const x = stgAdd(s, n, k, toPage(from0)); s.dice.push(x); added.push(x); }
      const hop = s.dice.filter((x, k) => k < n && !added.includes(x) && (d.re === 'all' || d.re === k || x.v !== vals[k]));
      if (!hop.length && !added.length) return;
      s.busy = true; schedule();
      if (sound) Sfx.shake(Math.max(1, hop.length + added.length));
      s.res.classList.remove('in');
      await Promise.all(hop.map(x => stgHop(x)).concat(added.map(x => x.fly)));
      if (stg !== s) return;
      await Promise.all(s.dice.map((x, k) => (k < n && (hop.includes(x) || added.includes(x) || x.v !== vals[k]) ? stgSettle(x, vals[k]) : null)));
      s.busy = false; s.settledAt = performance.now();
      stgLabel(d.p, vals, d.re != null ? 'Переброс' : '');
    });
    s.chain = run;
    const runP = run.then(() => { if (throwP === runP) throwP = null; schedule(); });
    throwP = runP;
  }
  // окончательный бросок: показать итог (со сдвигом) и убрать кубики
  function stageFinal(d) {
    const s = stg;
    const fin = { vals: d.vals.slice(), total: d.total, p: d.p, adj: d.adj || 0 };
    if (!s) { chipRoll = fin; return; }
    s.final = fin; s.hold = true;
    s.chain.then(() => {
      if (stg !== s) return;
      s.hold = false; schedule(); // кубики легли — стол показывает, что сработало
      if (d.adj) stgLabel(d.p, d.vals, '', d.adj);
      const seen = performance.now() - (s.settledAt || performance.now());
      stgClose(Math.round((d.adj ? 1200 : seen > 600 ? 220 : 700) * (stgK() || 0.8)));
    });
  }
  // встряхнуть устройство — бросок (на iPhone и iPad нужно разрешение, его спрашивают в настройках)
  window.addEventListener('devicemotion', (e) => {
    if (!shakeRoll || !S || !isMyTurn() || busy || myCoins().length) return;
    const a = e.accelerationIncludingGravity || e.acceleration; if (!a) return;
    const m = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
    if (m < 24 || performance.now() - lastShake < 1500) return;
    lastShake = performance.now();
    const b = document.querySelector(`.tdie-w[data-n="${lastN}"]`) || document.querySelector('.tdie-w');
    if (b && !b.disabled) b.click();
  });

  // монеты: сработавшие карты кладут золото на стол — игрок забирает его касанием. На экране золото игрока
  // растёт, только когда монеты забраны; движок ждёт, пока игроки за этим устройством заберут свои
  let coinQ = [], coinSeq = 0, coinAllAt = 0;
  const coinWaiters = [];
  const manualFor = (i) => manualCoins && !!S && !!S.players[i] && !WATCH && !S.players[i].isBot && isLocal(S.players[i]);
  const pendIn = (i) => coinQ.reduce((a, c) => a + (!c.done && c.to === i ? c.amt : 0), 0);
  const pendOut = (i) => coinQ.reduce((a, c) => a + (!c.done && c.from === i ? c.amt : 0), 0);
  const shownGold = (q) => Math.max(0, q.gold - pendIn(q.i) + pendOut(q.i));
  const myCoins = () => coinQ.filter(c => !c.done && !c.auto && !c.held);
  // opt.hold — монеты пока не показывать (их выпустит releaseCoins): сначала всплывёт доход соперника, потом ваши карты
  function addCoins(items, opt = {}) {
    if (!items.length || !S) return [];
    const out = [];
    let na = 0;
    for (const x of items) {
      const by = manualFor(x.to) ? x.to : x.from != null && manualFor(x.from) ? x.from : null; // кто за этим устройством берёт или отдаёт
      const c = { k: ++coinSeq, ...x, by, auto: by == null, done: false, held: !!opt.hold };
      coinQ.push(c); out.push(c);
      if (c.auto && !c.held) autoTake(c, na++);
    }
    if (!opt.hold) coinsShown();
    else schedule();
    return out;
  }
  const autoTake = (c, i) => { const d = reduceMotion() ? 30 : Math.max(80, (520 + i * 240) * (S.players[S.cur] && S.players[S.cur].isBot ? SPEED[speed] : 0.7)); setTimeout(() => takeCoin(c.k), d); };
  // монеты появились на картах этого игрока: открыть «Стол» и показать подсвеченные карты
  function coinsShown() {
    if (myCoins().length) {
      dropPops();
      // плитка с монетой могла оказаться за краем ряда — подвинуть ряд (страница при этом не двигается)
      setTimeout(() => revealTile('.tiles .tile.take, .tiles .tile.give'), 90);
    }
    schedule();
  }
  function releaseCoins(list) {
    let na = 0;
    for (const c of list) { if (c.done || !c.held) continue; c.held = false; if (c.auto) autoTake(c, na++); }
    coinsShown();
  }
  // монета лежит на карте «Стола» этого игрока: его владение, чужой Набег, который берёт с него, или карта дохода начала хода
  function onCard(c) {
    if (c.done || c.auto || c.held || c.by !== ME || ME === null || !S) return false;
    const me = S.players[ME];
    if (c.kind === 'roll') return c.to === ME ? me.estates.some(e => e.uid === c.uid) : c.from === ME;
    return c.kind === 'dawn' && !!c.ck;
  }
  const cardCoins = (f) => coinQ.filter(c => onCard(c) && f(c));
  function takeCoin(k) {
    const c = coinQ.find(x => x.k === k);
    if (!c || c.done) return;
    const btn = [...document.querySelectorAll('.board [data-coins]')].find(el => el.dataset.coins.split(',').includes(String(k)));
    const bank = document.querySelector('.board .center .well');
    // монета летит с плитки, которая её дала: к золоту того, кто получает; платит игрок — от его золота к плитке
    const src = c.from != null ? (oppEl(c.from) || btn) : btn || bank;
    const dst = c.to != null ? oppEl(c.to) : bank;
    flyCoins(src, dst, c.amt);
    if (btn && btn.classList.contains('tile') && !reduceMotion()) { btn.classList.remove('go'); void btn.offsetWidth; btn.classList.add('go'); }
    c.done = true;
    if (sound) Sfx.coin();
    if (!coinQ.some(x => !x.done)) coinQ = [];
    for (const w of coinWaiters.splice(0)) w();
    schedule();
  }
  // ручные шаги, как за настоящим столом: добрать карты из колоды, обновить рынок в начале круга
  let stepReq = null;
  // догоняющий наём: у кого сколько знамён — чтобы было видно, почему можно нанять ещё вассала
  const cuOn = (p) => { const t = R.catchupTier || 'v'; return !!(p && p.turn && p.turn.catchupHire > 0 && E.rowOf(S, t).length > 0 && E.tierList(p, t).length < E.needOf(S, t)); };
  function cuWhy(p, short) {
    const ci = S.catchupInfo, you = p.i === ME;
    const lead = ci && ci.lead.length ? ci.lead.map(i => (i === ME ? 'вас' : esc(E.shortG(S.players[i])))).join(' и ') : 'лидера';
    const mine = ci ? ci.cs[p.i] : E.regCount(p);
    const nums = ci ? `у ${lead} ${D.banners(ci.mx)}, у ${you ? 'вас' : esc(E.shortG(p))} ${D.banners(mine)}` : 'у лидера больше знамён';
    if (short) return nums;
    return `${nums[0].toUpperCase() + nums.slice(1)}. Когда в начале круга у лидера ${D.banners(E.cuFrom(S))} или больше, все, кто отстаёт, в этом круге нанимают одного вассала сверх обычных действий. Действие не тратится — золото платите как обычно. Так отстающий догоняет, а партия не решается слишком рано.`;
  }
  const rowTapFor = (i) => rowTap && !!S && !!S.players[i] && !WATCH && !S.players[i].isBot && isLocal(S.players[i]);
  let rfAll = -1, rfTapped = false, rfBuf = [], rfTimer = null; // «все ряды сразу» — до конца этого круга; обновили касанием — без всплывашки
  function manualStep(s, d) {
    const q = S && S.players[d.p];
    if (!q || S.winner !== null) return Promise.resolve();
    if (d.kind === 'refresh') {
      // ряд обновляет первый игрок круга; на одном устройстве — тот, у кого оно сейчас в руках
      if (ME === null || WATCH || !(manualFor(d.p) || rowTapFor(d.p)) || rfAll === S.round) return Promise.resolve();
      // уходящая карта ряда ложится посреди стола — её убирают касанием
      dropPops();
      return new Promise(res => { stepReq = { s, d, res }; schedule(); });
    }
    if (!manualFor(d.p) || d.p !== ME) return Promise.resolve();
    return new Promise(res => { stepReq = { s, d, res }; schedule(); });
  }
  function stepDone() { const r = stepReq; stepReq = null; if (r) { if (r.d && r.d.kind === 'refresh') rfTapped = true; if (sound) Sfx.card(); r.res(); } schedule(); }
  // ↻ обновление рядов: в последний ход круга помечаем крайнюю карту ряда, из которого ещё ничего не взяли, — она уйдёт под колоду
  const RF_NAME = { estate: 'владений', court: 'двора', hold: 'твердынь', v: 'вассалов', l: 'лордов', g: 'великих лордов' };
  function rfSoon(k) {
    if (!S || S.winner !== null || (stepReq && stepReq.d.kind === 'refresh')) return false;
    if ((S.cur + 1) % S.players.length !== S.first) return false; // не последний ход круга
    if ((S.rowHired || {})[k]) return false;
    if (!R.rowRefresh && !['v', 'l', 'g'].includes(k)) return false;
    const row = k === 'estate' ? S.estateRow : k === 'court' ? S.courtRow : k === 'hold' ? S.holdRow : E.rowOf(S, k);
    const deck = k === 'estate' ? S.estateDeck : k === 'court' ? S.courtDeck : k === 'hold' ? S.holdDeck : k === 'v' ? S.vDeck : k === 'l' ? S.lDeck : S.gDeck;
    return !!(row && row.length && deck && deck.length);
  }
  const rfNow = (k) => !!(stepReq && stepReq.d.kind === 'refresh' && stepReq.d.row === k);
  // метка на крайней карте ряда: сейчас обновляется (нажать) или уйдёт в начале круга
  function rfMark(k, idx) {
    if (idx !== 0) return null;
    if (rfNow(k)) return { cls: 'rf-out', badge: '<span class="pcb rf now">↻ под колоду</span>', act: 'refresh-tap' };
    if (rfSoon(k)) return { cls: 'rf-soon', badge: '<span class="pcb rf">↻ уйдёт</span>' };
    return null;
  }
  const rfSub = (k) => (rfNow(k) ? '↻ обновляется — нажмите на крайнюю карту' : rfSoon(k) ? '↻ ничего не возьмёте — крайняя уйдёт под колоду' : '');
  function coinsSettled(s) {
    return new Promise(res => {
      const chk = () => { if (s !== S || !coinQ.some(c => !c.done)) res(); else coinWaiters.push(chk); };
      chk();
    });
  }
  function flyCoins(fromEl, toEl, n) {
    if (!fromEl || !toEl || reduceMotion() || !document.body.animate) return;
    const a0 = ctr(fromEl), b0 = ctr(toEl);
    if (!a0.w || !b0.w) return;
    const a = toPage(a0), b = toPage(b0);
    for (let i = 0; i < Math.min(n, 5); i++) {
      const el = document.createElement('div'); el.className = 'flycoin';
      el.style.left = (a.x - 12) + 'px'; el.style.top = (a.y - 12) + 'px';
      document.body.appendChild(el);
      const dx = b.x - a.x, dy = b.y - a.y;
      const an = el.animate([
        { transform: 'translate(0,0) scale(.9)', opacity: 1 },
        { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 46}px) scale(1.2)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px,${dy}px) scale(.7)`, opacity: 0.3 },
      ], { duration: 560, delay: i * 80, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'both' });
      an.onfinish = () => el.remove();
      if (i && sound) setTimeout(() => Sfx.coin(i), i * 80);
    }
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) Music.stop(); else if (music && S && S.winner === null) Music.house(S.players[S.cur].house); });
  // ---------- чужой ход крупно: всплывающие карты ----------
  const popRoot = document.getElementById('cardpops') || mk('div', 'cardpops', 'cardpops');
  const popQ = [];
  let popBusy = false;
  const seeOthers = (pi) => WATCH || pi !== ME;
  function cardPop(o) {
    if (!S) return;
    // одинаковые карты подряд («Подать», «Подать», «Подать») — одной стопкой «×3» с общей суммой
    const last = popQ[popQ.length - 1];
    if (o.gk && last && last.gk === o.gk) { last.n += 1; last.gold += o.gold; last.cards += o.cards; return; }
    popQ.push(o);
    if (popQ.length > 5) popDone(popQ.shift());
    if (!popBusy) nextPop();
  }
  const popDone = (o) => { if (o && o.done) { const f = o.done; o.done = null; try { f(); } catch (e) { console.error(e); } } };
  // убрать всплывашки, которые закрыли бы подсвеченные карты (доход соперника остаётся: монеты ждут его)
  function dropPops() {
    for (const o of popQ.splice(0)) popDone(o);
    for (const el of popRoot.querySelectorAll('.cpop')) el.classList.add('out');
  }
  async function nextPop() {
    const o = popQ.shift();
    if (!o || !S) { popDone(o); popBusy = false; for (const x of popQ.splice(0)) popDone(x); document.body.classList.remove('staging'); return; }
    popBusy = true;
    if (stg) await stageGone(); // сначала кубики уходят с середины стола
    const q = S && S.players[o.p];
    if (!q) { popDone(o); popBusy = false; for (const x of popQ.splice(0)) popDone(x); document.body.classList.remove('staging'); return; }
    // карта ложится посреди стола на секунду-две: кто, что сыграл или купил и что получил
    const card = o.duel ? '' : o.back ? `<img class="cp-back" src="${backSrc(o.back)}" alt="">` : mcard(o.kind === 'estate' ? 'estate' : o.kind === 'ban' ? 'ban' : 'court', o.id, { o: o.p });
    if (o.gk) { o.title = `«${esc(D.COURT[o.id].name)}»${o.n > 1 ? ` ×${o.n}` : ''}`; o.sub = [o.gold ? `+${o.gold}🪙` : '', o.cards ? `+${D.cards(o.cards)}` : ''].filter(Boolean).join(', '); }
    const el = document.createElement('div'); el.className = 'cpop' + (o.mine ? ' mine' : '') + (o.n > 1 ? ' many' : '');
    if (o.duel && S.players[o.duel.t]) {
      // схватка: числа нападающего и защитника сходятся посреди стола
      const u = o.duel, T = S.players[u.t];
      el.className = 'cpop duel ' + (u.win ? 'win' : 'lose');
      el.innerHTML = `<div class="du"><span class="du-s a"><img src="${crestOf(q)}" alt=""><b>${u.A}</b><small>${u.la}</small></span><span class="du-x" aria-hidden="true">${u.icon}</span><span class="du-s d"><b>${u.D}</b><img src="${crestOf(T)}" alt=""><small>${u.ld}</small></span></div><div class="du-r">${u.res}</div>`;
    } else
    el.innerHTML = `<div class="cp-c">${card}</div><div class="cp-t"><span class="cp-who"><img src="${crestOf(q)}" alt="">${o.mine ? 'Вы' : esc(H(q).short)}</span><b>${o.title}</b>${o.sub ? `<span class="cp-s">${o.sub}</span>` : ''}</div>`;
    el.addEventListener('click', () => { el.classList.add('out'); });
    popRoot.appendChild(el);
    document.body.classList.add('staging');
    if (music && o.jingle) Music.jingle(true, o.kind, o.id, q.house);
    const ms = speed === 'turbo' ? 100 : o.duel ? (speed === 'slow' ? 2000 : speed === 'fast' ? 900 : 1400) : o.mine ? 1000 : Math.max(600, 1500 * (speed === 'slow' ? 1.5 : speed === 'fast' ? 0.4 : 1));
    for (let t = 0; t < ms && !el.classList.contains('out'); t += 100) await wait(100);
    // купленная или нанятая карта улетает туда, где она теперь лежит
    const tgt = o.to && flyOn() && !el.classList.contains('out') ? o.to() : null, pc = tgt && el.querySelector('.cp-c > *');
    if (pc) {
      const r = pc.getBoundingClientRect(), node = pc.cloneNode(true); node.removeAttribute('data-act');
      pc.style.visibility = 'hidden'; el.classList.add('out');
      await flyCard(node, r, tgt); landPulse(tgt); if (sound) Sfx.place();
    } else {
      el.classList.add('out');
      await wait(reduceMotion() ? 0 : 240);
    }
    el.remove();
    popDone(o);
    if (!popQ.length) document.body.classList.remove('staging');
    nextPop();
  }
  const popsDone = async () => { for (let k = 0; k < 80 && (popBusy || popQ.length); k++) await wait(100); };

  // ---------- схватка на столе: осада, обстрел, шпион — без окон ----------
  // пока идёт сцена, стол показывает «как было»: у прежнего хозяина владение ещё лежит, у нового — ещё не появилось
  const tileHolds = [];
  const tableZone = (pi) => { const b = app.querySelector(':scope > .board'); return !b ? null : pi === viewIdx() ? b.querySelector(':scope > .tiles.own') : pi === oppFocus ? b.querySelector(':scope > .tiles.foe') : null; };
  function grabTile(pi, id) {
    const z = tableZone(pi), el = z && (z.querySelector(`.tile[data-id="${id}"]:not(.ruin)`) || z.querySelector(`.tile[data-id="${id}"]`)), r = el && el.getBoundingClientRect();
    if (!r || !r.width) return null;
    const node = el.cloneNode(true); node.removeAttribute('data-act'); node.removeAttribute('data-coins'); node.classList.remove('fire', 'take', 'give', 'arr', 'go', 'hold');
    return { node, rect: r };
  }
  // u: { t, A, D, la, ld, icon, res, win, move: { from, to, id } | null, gone: { pi, id } | null }
  function duel(a, u) {
    if (!flyOn() || !S.players[u.t]) return false;
    const src = u.move && u.move.from != null ? grabTile(u.move.from, u.move.id) : u.gone ? grabTile(u.gone.pi, u.gone.id) : null;
    const hold = u.move ? { from: src ? u.move.from : null, to: u.move.to, id: u.move.id, t: performance.now() } : u.gone && src ? { from: u.gone.pi, to: null, id: u.gone.id, t: performance.now() } : null;
    if (hold) tileHolds.push(hold);
    cardPop({ p: a, duel: u, done: () => {
      const i = tileHolds.indexOf(hold); if (i >= 0) tileHolds.splice(i, 1);
      schedule();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (u.move) {
          const z = tableZone(u.move.to), to = z && (z.querySelector(`.tile.ruin[data-id="${u.move.id}"]`) || z.querySelector(`.tile[data-id="${u.move.id}"]`));
          if (to && src) { to.style.visibility = 'hidden'; flyCard(src.node, src.rect, to).then(() => { if (to.isConnected) { to.style.visibility = ''; landPulse(to); } if (sound) Sfx.place(); }); }
          else if (to) { landPulse(to); if (sound) Sfx.place(); }
        } else if (u.gone && src) {
          // разрушено: плитка трескается и исчезает на прежнем месте
          const l = flyLayer(); if (!l) return;
          const lr = l.getBoundingClientRect(), w = document.createElement('div'); w.className = 'flyc';
          w.style.cssText = `left:${src.rect.left - lr.left}px;top:${src.rect.top - lr.top}px;width:${src.rect.width}px;height:${src.rect.height}px`;
          w.appendChild(src.node); l.appendChild(w);
          const an = w.animate([{ transform: 'none', opacity: 1, filter: 'none' }, { transform: 'translateX(-4px) rotate(-3deg)', opacity: 1, offset: 0.2 }, { transform: 'translateX(4px) rotate(3deg)', opacity: 1, offset: 0.4 }, { transform: 'translateY(10px) scale(.86) rotate(-6deg)', opacity: 0, filter: 'grayscale(1) brightness(.6)' }], { duration: 620, easing: 'ease-in', fill: 'forwards' });
          an.onfinish = () => w.remove(); setTimeout(() => w.remove(), 1000);
        }
      }));
    } });
    return true;
  }

  // ---------- купленная карта летит на своё место ----------
  // владение — на стол покупателя, знамя — к его флажкам, карта двора — в руку или в сброс («Двор»)
  const flyOn = () => !reduceMotion() && speed !== 'turbo';
  let flySrc = null; // моя покупка: копия карты из ряда рынка и её место на экране в момент нажатия
  let flyFrom = null; // покупка из листа карты: лететь с места крупной карты, а не из ряда
  function flyArm(btn) {
    flySrc = null;
    if (!flyOn()) return;
    const slot = btn.closest('.mslot'), c = slot && slot.querySelector('.mcard'), r = c && (flyFrom || c.getBoundingClientRect());
    if (!r || !r.width) return;
    const node = c.cloneNode(true); node.removeAttribute('data-act'); node.classList.remove('deal', 'mine', 'dim');
    flySrc = { node, rect: r, t: performance.now(), id: String(c.dataset.id || c.dataset.key || '') };
  }
  function flyLayer() {
    const b = app.querySelector('.board'); if (!b) return null;
    let l = b.querySelector(':scope > .flyl');
    if (!l) { l = document.createElement('div'); l.className = 'flyl'; l.setAttribute('aria-hidden', 'true'); b.appendChild(l); }
    return l;
  }
  // node — копия карты, from — её место на экране, to — элемент, куда она ляжет
  function flyCard(node, from, to) {
    return new Promise((done) => {
      const l = flyLayer();
      if (!l || !to || !to.isConnected || !flyOn()) return done(false);
      const b = to.getBoundingClientRect(), lr = l.getBoundingClientRect();
      if (!b.width || !from.width) return done(false);
      const w = document.createElement('div'); w.className = 'flyc';
      w.style.cssText = `left:${from.left - lr.left}px;top:${from.top - lr.top}px;width:${from.width}px;height:${from.height}px;--mw:${from.width}px`;
      w.appendChild(node); l.appendChild(w);
      const sc = clampN(Math.min(b.width / from.width, b.height / from.height), 0.14, 1.6);
      const dx = b.left + b.width / 2 - (from.left + from.width / 2), dy = b.top + b.height / 2 - (from.top + from.height / 2);
      const dur = clampN(300 + Math.hypot(dx, dy) * 0.5, 400, 680) * (speed === 'fast' ? 0.7 : 1);
      let an;
      try {
        an = w.animate([
          { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
          { transform: `translate(${dx * 0.42}px,${dy * 0.42 - 30}px) scale(${1 + (sc - 1) * 0.3 + 0.08}) rotate(${dx > 0 ? 4 : -4}deg)`, opacity: 1, offset: 0.42 },
          { transform: `translate(${dx}px,${dy}px) scale(${sc}) rotate(0deg)`, opacity: sc < 0.5 ? 0.55 : 1 },
        ], { duration: dur, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' });
      } catch (err) { w.remove(); return done(false); }
      const end = (ok) => { w.remove(); done(ok); };
      an.onfinish = () => end(true); an.oncancel = () => end(false);
    });
  }
  const landPulse = (el) => { if (el && el.isConnected && el.animate && !reduceMotion()) el.animate([{ transform: 'scale(1.16)', filter: 'brightness(1.25)' }, { transform: 'scale(1)', filter: 'brightness(1)' }], { duration: 320, easing: 'cubic-bezier(.2,.9,.3,1.2)' }); };
  // куда на этом экране ложится карта игрока pi
  function flyTarget(pi, kind, id) {
    const b = app.querySelector('.board'); if (!b || !S) return null;
    const mine = pi === viewIdx(), foc = pi === oppFocus;
    const chip = mine ? null : b.querySelector(`.pbar.foe .ochip[data-i="${pi}"]`) || b.querySelector(`.pbar.foe [data-gold="${pi}"]`);
    if (kind === 'estate') { const z = mine ? b.querySelector(':scope > .tiles.own') : foc ? b.querySelector(':scope > .tiles.foe') : null; return (z && (z.querySelector(`.tile[data-id="${id}"]:not(.ruin)`) || z.querySelector(`.tile[data-id="${id}"]`))) || chip; }
    if (kind === 'ban') return (mine ? b.querySelector('.pbar.own .pips') : foc ? b.querySelector('.pbar.foe .pips') : null) || chip;
    if (kind === 'hand') return [...b.querySelectorAll(`.handz .hcard[data-id="${id}"]`)].pop() || b.querySelector('.pbar.own .myb');
    if (kind === 'faith') return (mine ? b.querySelector('.pbar.own .crestb') : foc ? b.querySelector('.pbar.foe .crest') : null) || chip;
    if (kind === 'sin') return (mine ? b.querySelector('.pbar.own .myb') : null) || chip; // грехи лежат на странице «Двор»
    return (mine ? b.querySelector('.handz .pile.disc') || b.querySelector('.pbar.own .myb') : foc ? b.querySelector('.pbar.foe .ofan') : null) || chip;
  }
  // моя покупка: карта летит из ряда рынка; цель появляется после перерисовки стола
  function flyMine(kind, id) {
    const src = flySrc; flySrc = null;
    if (!src || performance.now() - src.t > 8000 || src.id !== String(id) || !flyOn()) return false;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const to = flyTarget(ME, kind, id); if (!to) return;
      const hide = kind === 'estate' || kind === 'hand';
      if (hide && (to.classList.contains('tile') || to.classList.contains('hcard'))) to.style.visibility = 'hidden';
      flyCard(src.node, src.rect, to).then(() => { if (to.isConnected) { to.style.visibility = ''; landPulse(to); } if (sound) Sfx.place(); });
    }));
    return true;
  }
  function regText(def) { return def ? esc(def.text || '') : ''; }

  // ---------- вопросы человеку ----------
  function askHuman(p, q) {
    switch (q.type) {
      case 'adjust': return throwDone().then(() => new Promise(res => { adjustReq = { q, res }; adjMin = false; schedule(); }));
      case 'target': return askTarget(p, q);
      case 'capture': return askCapture(p, q);
      case 'bribe': return askBribe(p, q);
      case 'trash': return askTrash(p, q);
      case 'seatReplace': return askSeatReplace(p, q);
      case 'seatDrop': return askSeatDrop(p, q);
      case 'unseat': return askUnseat(p, q);
      case 'plotNums': return askPlotNums(p, q);
      case 'upkeep': return askUpkeep(p, q);
      case 'advantage': return askAdvantage(p, q);
      case 'predict': return askPredict(p, q);
      case 'peek': return throwDone().then(() => askPeek(p, q));
      case 'dream': return askDream(p, q);
      case 'grab': return askPickCard(p, q, '🗝 Перехват: какую карту забрать?', 'Карта из сброса соперника уйдёт в ваш сброс.');
      case 'snatch': return askPickCard(p, q, '🌑 Перехват: какую карту взять?', 'Карта из сброса соперника — вам в руку, её можно сыграть уже в этот ход.');
      case 'fetchOne': return askPickCard(p, q, '⛪ Святые мощи: что вернуть в руку?', 'Карта из вашего сброса — в руку. Сыгранные в этот ход не берутся.');
      case 'buyoff': return askBuyoff(p, q);
      case 'burn': return askBurn(p, q);
      case 'poach': return askPickBan(p, q, '🗝 Вербовка: кого переманить?', (id) => (R.poachHalf ? `заплатите в банк ${Math.ceil(D.BAN[id].cost / 2)}🪙` : `заплатите ${esc(H(S.players[q.from]).dat)} ${D.BAN[id].cost}🪙`));
      case 'distract': return askPickBan(p, q, '🗝 Куртизанка: кого отвлечь?', () => 'не действует до конца их следующего хода');
      case 'raze': return askRaze(p, q);
      case 'sinHire': return askPickBan(p, q, '😈 Гордыня: кого нанять?', () => 'бесплатно и без траты действия');
      case 'summon': return choiceSheet(`😈 Призыв семи грехов: осталось ${D.banners(q.left)}`, '<p class="note">Знамя из ряда — бесплатно и без действия, ряд пополняется после каждого. Выполните цель — победа в конце круга.</p>',
        [...q.options.map(id => ({ icon: D.SYM[D.BAN[id].dir], value: id, right: D.BAN[id].tier === 'v' ? 'вассал' : D.BAN[id].tier === 'l' ? 'лорд' : 'великий', html: banLine(id) })), { icon: '✋', value: null, html: '<b>Хватит</b>' }]);
      case 'sinBanner': return choiceSheet('😈 Зависть: какое знамя забрать?', '<p class="note">Знамя лидера переходит к вам бесплатно — вассал, лорд или даже великий лорд.</p>',
        q.options.map((o, k) => ({ icon: H(S.players[o.i]).sigil, value: k, right: D.BAN[o.id].tier === 'v' ? 'вассал' : D.BAN[o.id].tier === 'l' ? 'лорд' : 'великий', html: `${banLine(o.id)}<br><span class="muted">сейчас у ${esc(E.shortG(S.players[o.i]))}</span>` })));
      case 'lustTake': return askLustTake(p, q);
      case 'lustFrom': return choiceSheet(`😈 Похоть: итог ${q.total} — откуда ${esc(H(S.players[q.to]).short)} возьмут карту?`, `<p class="note">Соперник вслепую берёт одну вашу карту — она уходит в его сброс. Откуда — решаете вы.</p>`,
        [{ icon: '✋', value: 'hand', right: '', html: `<b>Из руки</b><br><span class="muted">в руке ${D.cards(q.hand)} — какая уйдёт, решит случай</span>` }, { icon: '🂠', value: 'discard', right: '', html: `<b>Из сброса</b><br><span class="muted">в сбросе ${D.cards(q.discard)}, с сыгранными в этот ход</span>` }]);
      case 'penanceEstate': return choiceSheet('🕯 Покаяние, шаг 4: какое владение уходит из игры?', '<p class="note">Владение уходит из игры навсегда. Потом вы снимете один грех.</p>',
        q.options.map(uid => { const e = p.estates.find(x => x.uid === uid); const d = D.ESTATES[e.id]; return { icon: D.ETYPE[d.t].mark, value: uid, right: `${d.cost}🪙`, html: `<b>${esc(d.name)}</b><br><span class="muted">${esc(D.estateText(d))}</span>` }; }));
      case 'penanceSin': return choiceSheet('🕯 Покаяние окончено: какой грех снять?', '<p class="note">Грех уходит в колоду двора, его штраф больше не действует.</p>',
        q.options.map(id => ({ icon: '😈', value: id, right: '', html: `<b>${esc(D.COURT[id].name)}</b><br><span class="muted">штраф: ${esc(D.COURT[id].pen)}</span>` })));
      case 'ritualEstate': return choiceSheet(q.give ? `✨ ${esc(q.label)}: какое владение отдать?` : `✨ ${esc(q.label)}: какое владение уходит из игры?`, `<p class="note">${q.give ? 'Владение уйдёт самому бедному сопернику и будет приносить доход ему.' : 'Владение уходит из игры навсегда.'}</p>`,
        q.options.map(uid => { const e = p.estates.find(x => x.uid === uid); const d = D.ESTATES[e.id]; return { icon: D.ETYPE[d.t].mark, value: uid, right: `${d.cost}🪙`, html: `<b>${esc(d.name)}</b>${e.ruined ? ' · в руинах' : ''}<br><span class="muted">${esc(D.estateText ? D.estateText(d) : '')}</span>` }; }));
      case 'ritualCard': return choiceSheet(q.give ? `✨ ${esc(q.label)}: какую карту отдать?` : `✨ ${esc(q.label)}: какую карту убрать из игры?`, `<p class="note">${q.give ? 'Карта уйдёт в сброс самому бедному сопернику.' : `Карта двора ценой от ${q.min}🪙 уходит из игры навсегда.`}</p>`,
        q.options.map(k => { const c = D.COURT[p.hand[k]]; return { icon: '🂠', value: k, right: `${c.cost}🪙`, html: `<b>${esc(c.name)}</b><br><span class="muted">${D.fxText(c.fx)}</span>` }; }));
      case 'ritualVassal': return choiceSheet(`✨ ${esc(q.label)}: кого из вассалов отпустить?`, '<p class="note">Вассал уходит под низ колоды вассалов — его можно будет нанять снова.</p>',
        q.options.map(id => ({ icon: D.SYM[D.BAN[id].dir], value: id, right: '', html: banLine(id) })));
      case 'borrow': return choiceSheet('🌑 Чужими руками: какую карту взять на ход?', '<p class="note">Карта из сброса соперника — вам в руку до конца хода. Сыграть можно, убрать из игры, в отставку, ко двору и замыслом — нельзя. В конце хода она вернётся в его сброс.</p>',
        [...q.options.map((o, k) => { const c = D.COURT[o.id]; return { icon: H(S.players[o.i]).sigil, value: k, right: '', html: `<b>${esc(c.name)}</b><br><span class="muted">${D.fxText(c.fx)}</span>` }; }), { icon: '✕', value: null, right: '', html: '<b>Не брать</b>' }]);
      case 'dictate': return choiceSheet('🌑 Нашёптанная судьба', '<p class="note">Решите, сколько кубиков бросит соперник в свой следующий ход. Один кубик — его владения на 7–12 молчат; два — молчат владения на 1.</p>',
        [...q.options.flatMap(i => [1, 2].map(n => ({ icon: H(S.players[i]).sigil, value: { i, n }, right: n === 2 ? '🎲🎲' : '🎲', html: `<b>${esc(H(S.players[i]).short)}</b> бросают ${n === 2 ? 'два кубика' : 'один кубик'}` }))), { icon: '✕', value: null, right: '', html: '<b>Не решать</b> — бросят, как захотят' }]);
      case 'faithKeep': return choiceSheet('🕯 Какую веру оставить?', '<p class="note">Архиепископ Григорий ушёл — две веры сразу больше нельзя. От второй вы отрекаетесь без платы, её карты возвращаются к вере.</p>', q.options.map(f => ({ icon: D.FAITHS[f].icon, value: f, right: '', html: `<b>${esc(D.FAITHS[f].name)}</b><br><span class="muted">${esc(D.FAITHS[f].text)}</span>` })));
    }
    return Promise.resolve(null);
  }
  const banLine = (id) => { const b = D.BAN[id]; return `<b>${esc(D.regName(b))}</b><br><span class="muted">${esc(b.text)}</span>`; };
  // содержание великих лордов: золота не хватает — кого оставить (остальные уйдут под низ колоды)
  function askUpkeep(p, q) {
    const uc = (id) => (q.costs && q.costs[id] != null ? q.costs[id] : D.BAN[id].upkeep); // чудо «Верность до гроба»: по 1🪙
    return new Promise(res => {
      let keep = [];
      const cost = () => keep.reduce((s, id) => s + uc(id), 0) + (keep.length ? (q.extra || 0) : 0);
      const list = () => q.options.map(id => `<button class="opt" data-id="${id}"><span class="big">${keep.includes(id) ? '☑️' : '⬜'}</span><span>${banLine(id)}</span><span class="r">${uc(id)}🪙</span></button>`).join('');
      const body = `<p class="note">Содержание великих лордов платится первым делом. У вас ${q.gold}🪙 — на всех не хватает${q.extra ? ` (ещё ${q.extra}🪙 — смута)` : ''}. Отметьте, кого оставить; остальные уйдут под низ колоды великих лордов.</p><div class="optlist">${list()}</div><div class="acts"><button class="btn primary wide" data-ok>Оставить · ${cost()}🪙</button></div>`;
      const sh = openSheet({ title: '🧭 Содержание великих лордов', body, dismiss: false });
      sh.el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-id]');
        if (b) { const id = b.dataset.id; if (keep.includes(id)) keep = keep.filter(x => x !== id); else if (cost() + uc(id) + (keep.length ? 0 : q.extra || 0) <= q.gold) keep.push(id); sh.el.querySelector('.optlist').innerHTML = list(); sh.el.querySelector('[data-ok]').textContent = `Оставить · ${cost()}🪙`; return; }
        if (e.target.closest('[data-ok]')) { sh.close(); res(keep); }
      });
    });
  }
  // Альберих: два броска — выбрать один
  function askAdvantage(p, q) {
    const val = (vs) => { const r = vs.reduce((a, b) => a + b, 0); return { r, g: Math.round(E.Bot.rollValue(S, p, r)) }; };
    const a = val(q.a), b = val(q.b);
    const fmt = (g) => (g > 0 ? `+${g}🪙` : g < 0 ? `−${-g}🪙` : '0🪙');
    return choiceSheet('🎲 Бросок с преимуществом', '<p class="note">Альберих Чародей: вы бросили дважды — выберите, какой бросок оставить. Справа — что он примерно принесёт вам.</p>', [
      { icon: '🎲', value: 0, html: `<b>${q.a.join(' + ')}${q.n > 1 ? ` = ${a.r}` : ''}</b>`, right: fmt(a.g) },
      { icon: '🎲', value: 1, html: `<b>${q.b.join(' + ')}${q.n > 1 ? ` = ${b.r}` : ''}</b>`, right: fmt(b.g) },
    ]);
  }
  // Слепой Тобиас — добросок: на первом кубике выпало v; бросать ли второй
  function askPeek(p, q) {
    const fmt = (g) => (g > 0 ? `+${g}🪙` : g < 0 ? `−${-g}🪙` : '0🪙');
    const stop = Math.round(E.Bot.rollScore(S, p, [q.v], 1));
    let more = 0; for (let d = 1; d <= 6; d++) more += E.Bot.rollScore(S, p, [q.v, d], 2) / 6;
    const best = more > stop + 0.2;
    return choiceSheet('🎲 Добросок', `<p class="note">Слепой Тобиас: на первом кубике выпало <b>${q.v}</b>. Оставить так или бросить второй — сумма будет от ${q.v + 1} до ${q.v + 6}. Справа — что это принесёт вам.</p>`, [
      { icon: '🎲', value: false, html: `<b>Оставить ${q.v}</b>${best ? '' : '<span class="good">выгоднее</span>'}`, right: fmt(stop) },
      { icon: '🎲🎲', value: true, html: `<b>Бросить второй кубик</b>${best ? '<span class="good">выгоднее</span>' : ''}`, right: `≈ ${fmt(Math.round(more * 10) / 10).replace('.', ',')}` },
    ]);
  }
  // Толкователь снов — вещий сон: 2 верхние карты колоды, каждую сверху или под низ
  function askDream(p, q) {
    return new Promise(res => {
      const down = new Set();
      const list = () => q.cards.map((id, i) => { const c = D.COURT[id]; return `<button class="opt" data-k="${i}"><span class="big">${down.has(i) ? '⬇️' : '⬆️'}</span><span><b>${esc(c.name)}</b><br><span class="muted">${esc(c.bad ? c.badText : D.fxText(c.fx))}</span></span><span class="r">${down.has(i) ? 'под низ' : 'сверху'}</span></button>`; }).join('');
      const sh = openSheet({ title: '🌙 Вещий сон', body: `<p class="note">Толкователь снов: это ${q.cards.length > 1 ? `${q.cards.length} верхние карты` : 'верхняя карта'} вашей колоды — первая сверху. Нажмите на карту, чтобы положить её под низ колоды; остальные останутся сверху в том же порядке.</p><div class="optlist">${list()}</div><button class="btn primary" data-ok="1">Готово</button>`, dismiss: false });
      sh.el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-k]');
        if (b) { const k = +b.dataset.k; if (down.has(k)) down.delete(k); else down.add(k); sh.el.querySelector('.optlist').innerHTML = list(); return; }
        if (e.target.closest('[data-ok]')) { sh.close(); res([...down]); }
      });
    });
  }
  // предсказание до броска (Око Провидца)
  function askPredict(p, q) {
    return new Promise(res => {
      const lo = q.n === 2 ? 2 : 1, hi = q.n === 2 ? 12 : 6;
      const grid = Array.from({ length: hi - lo + 1 }, (_, k) => lo + k).map(n => `<button data-n="${n}"><b>${n}</b><small>${Math.round(E.pRoll(q.n, n) * 100)}%</small></button>`).join('');
      const sh = openSheet({ title: '🔮 Предсказание', body: `<p class="note">Предсказание: назовите число до броска. Выпадет — +${E.mods(S, p).predict}🪙. Под числом — шанс на ${q.n === 2 ? 'двух кубиках' : 'одном кубике'}.</p><div class="numgrid">${grid}</div>`, dismiss: false });
      sh.el.addEventListener('click', (e) => { const b = e.target.closest('[data-n]'); if (b) { sh.close(); res(+b.dataset.n); } });
    });
  }
  function askPickCard(p, q, title, note) {
    const opts = q.options.map(id => { const c = D.COURT[id]; return { icon: '🂠', value: id, right: c.start || c.sig ? '' : `${c.cost}🪙`, html: `<b>${esc(c.name)}</b><br><span class="muted">${esc(c.bad ? c.badText : D.fxText(c.fx))}</span>` }; });
    return choiceSheet(title, `<p class="note">${note}</p>`, opts);
  }
  function askBurn(p, q) {
    return new Promise(res => {
      let sel = [];
      const list = () => q.options.map(id => { const c = D.COURT[id]; return `<button class="opt" data-id="${id}"><span class="big">${sel.includes(id) ? '🔥' : '⬜'}</span><span><b>${esc(c.name)}</b><br><span class="muted">${esc(c.bad ? c.badText : D.fxText(c.fx))}</span></span></button>`; }).join('');
      const sh = openSheet({ title: `🗝 Поджог архива: до ${q.max} ${D.plural(q.max, 'карты', 'карт', 'карт')}`, body: `<p class="note">Выбранные карты из сброса ${esc(E.shortG(S.players[q.from]))} уйдут из игры навсегда.</p><div class="optlist">${list()}</div><div class="acts"><button class="btn primary wide" data-ok>Сжечь</button></div>`, dismiss: false });
      sh.el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-id]');
        if (b) { const id = b.dataset.id; if (sel.includes(id)) sel = sel.filter(x => x !== id); else if (sel.length < q.max) sel.push(id); sh.el.querySelector('.optlist').innerHTML = list(); return; }
        if (e.target.closest('[data-ok]')) { sh.close(); res(sel); }
      });
    });
  }
  function askPickBan(p, q, title, sub) {
    const opts = q.options.map(id => ({ icon: D.SYM[D.BAN[id].dir], value: id, right: '', html: `${banLine(id)}<br><span class="muted">${sub(id)}</span>` }));
    return choiceSheet(title, '', opts);
  }
  function askRaze(p, q) {
    const t = S.players[q.from];
    const opts = q.options.map(uid => { const e = t.estates.find(x => x.uid === uid); const d = D.ESTATES[e.id]; return { icon: D.ETYPE[d.t].mark, value: uid, right: `${d.cost}🪙`, html: `<b>${esc(d.name)}</b><br><span class="muted">${esc(D.estateText(d))}</span>` }; });
    return choiceSheet(`💥 Что разрушить у ${esc(E.shortG(t))}?`, '<p class="note">Владение уходит из игры навсегда.</p>', opts);
  }
  // места при дворе заняты: кого отправить в сброс (из сброса он со временем снова придёт в руку)
  function askSeatReplace(p, q) {
    const c = D.COURT[q.card];
    const opts = q.options.map((id, k) => ({ icon: '🪑', value: k, right: '', html: `<b>${esc(D.COURT[id].name)}</b><br><span class="muted">сейчас даёт: ${esc(D.COURT[id].stext)} Уйдёт в ваш сброс.</span>` }));
    opts.push({ icon: '✋', value: null, html: '<b>Отмена</b><br><span class="muted">карта останется в руке</span>' });
    return choiceSheet(`🪑 «${esc(c.name)}» ко двору: кого заменить?`, `<p class="note">Мест при дворе — ${E.seatMax(S, p)}, все заняты. «${esc(c.name)}» будет давать: ${esc(c.stext)} Один из нынешних придворных уйдёт в ваш сброс, а оттуда со временем снова придёт в руку.</p>`, opts);
  }
  // мест при дворе стало меньше (ушёл Камергер): кто уходит в сброс; отказаться нельзя
  function askSeatDrop(p, q) {
    const opts = q.options.map((id, k) => ({ icon: '🪑', value: k, right: '', html: `<b>${esc(D.COURT[id].name)}</b><br><span class="muted">сейчас даёт: ${esc(D.COURT[id].stext)}</span>` }));
    return choiceSheet('🪑 Мест при дворе стало меньше', `<p class="note">Теперь мест — ${q.max}. Выберите, кто уйдёт в ваш сброс: оттуда он со временем снова придёт в руку.</p>`, opts);
  }
  // опала: чьего придворного прогнать
  function askUnseat(p, q) {
    const opts = q.options.map((o, k) => { const t = S.players[o.i]; return { icon: H(t).sigil, value: k, right: '', html: `<b>${esc(D.COURT[o.id].name)}</b> · ${esc(H(t).short)}<br><span class="muted">сейчас даёт им: ${esc(D.COURT[o.id].stext)}</span>` }; });
    return choiceSheet('🪑 Опала: кого прогнать от двора?', '<p class="note">Придворный соперника уходит в его сброс. Позже он снова придёт к нему в руку, и его можно будет посадить снова.</p>', opts);
  }
  function choiceSheet(title, body, options, footer = '') {
    return new Promise(res => {
      const html = `${body}<div class="optlist">${options.map((o, k) => `<button class="opt ${o.bad ? 'bad' : ''}" data-v="${k}"><span class="big">${o.icon || ''}</span><span>${o.html}</span><span class="r">${o.right || ''}</span></button>`).join('')}</div>${footer}`;
      const sh = openSheet({ title, body: html, dismiss: false });
      sh.el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-v]');
        if (!b) return;
        sh.close(); res(options[+b.dataset.v].value);
      });
    });
  }
  // список владений коротко: «Лавка 2🪙, Лагерь наёмников 2🪙 и ещё 2»
  function listEst(ds) {
    const xs = ds.slice().sort((x, y) => y.cost - x.cost);
    const head = xs.slice(0, 3).map(d => `${esc(d.name)} ${d.cost}🪙`).join(', ');
    return xs.length > 3 ? `${head} и ещё ${xs.length - 3}` : head;
  }
  // одно правило на осаду и шпионаж; n — число на карте, если известно
  const ATTACK_RULE = (k, n) => (k === 'war'
    ? `Нападение: ваши ⚔️ и +${n != null ? n : 'число с карты'} против ⚔️ и 🧱 соперника, каждый ещё бросает по кубику. У кого больше — тот победил, поровну — он отбился.`
    : `Шпионаж: ваши 🔗 и +${n != null ? n : 'число с карты'} против 🔗 и 🧱 соперника, каждый ещё бросает по кубику. Больше — успех, поровну — провал.`);
  function askTarget(p, q) {
    if (q.kind === 'lust') return choiceSheet('😈 Похоть: из чьего сброса взять карты?', '<p class="note">До трёх карт из его сброса — вам в руку, сколько захотите. Козни не берутся.</p>', q.options.map(o => { const t = S.players[o.i]; return { icon: H(t).sigil, value: o.i, right: '', html: `<b>${esc(H(t).short)}</b><br><span class="muted">в сбросе ${D.cards(o.n)}</span>` }; }));
    if (q.kind === 'wrath') return choiceSheet('😈 Гнев: у кого забрать владение?', '<p class="note">Владение до 6🪙 — без нападения, оно придёт к вам в руинах.</p>', q.options.map(o => { const t = S.players[o.i]; return { icon: H(t).sigil, value: o.i, right: '', html: `<b>${esc(H(t).short)}</b><br><span class="muted">можно забрать: ${o.loot}</span>` }; }));
    if (q.kind === 'penancePoor' || q.kind === 'ritualPoor') return choiceSheet(q.kind === 'ritualPoor' ? '✨ Милостыня: кому отдать?' : '🕯 Покаяние, шаг 1: кому отдать 5🪙?', '<p class="note">Самых бедных несколько — выберите любого.</p>', q.options.map(o => { const t = S.players[o.i]; return { icon: H(t).sigil, value: o.i, right: `${o.gold}🪙`, html: `<b>${esc(H(t).short)}</b>` }; }));
    if (q.kind === 'plantEstate') {
      const bad = D.ESTATES[q.estate];
      const opts = q.options.map(o => { const t = S.players[o.i]; return { icon: H(t).sigil, value: o.i, right: '', html: `<b>${esc(H(t).short)}</b><br><span class="muted">шпион ${o.A} + 🎲 против стражи ${o.G} + 🎲 · шанс ${pct(o.p)}</span>` }; });
      return choiceSheet(`⬛ Кому подбросить «${esc(bad.name)}»?`, `<p class="note">${ATTACK_RULE('int')} Удача — проклятие ложится к нему на стол: ${esc(bad.badText.replace(/^(.)/, (x) => x.toLowerCase()).replace(/\.$/, ''))}. Провал — оно замешивается в колоду владений.</p>`, opts);
    }
    if (q.kind === 'raze') {
      const wg = E.mods(S, p).siegeWinGold || 0;
      const opts = q.options.map(o => { const t = S.players[o.i], im = q.kind === 'raze' ? immuneTxt(t, 'разрушить') : ''; return { icon: H(t).sigil, value: o.i, right: '', bad: q.kind === 'raze' && !o.loot, html: `<b>${esc(H(t).short)}</b><br><span class="muted">атака ${o.A} + 🎲 против обороны ${o.D} + 🎲 · шанс ${pct(o.p)}${q.kind === 'raze' ? `<br>${o.loot ? `можно разрушить: ${o.loot} ${D.plural(o.loot, 'владение', 'владения', 'владений')}` : `${im || 'разрушать нечего'} — победа ${wg ? `даст только +${wg}🪙` : 'ничего не даст'}`}` : ''}</span>` }; });
      const allIm = q.kind === 'raze' && q.options.every(o => !o.loot);
      if (q.kind === 'raze') opts.push({ icon: '✋', value: null, html: `<b>Не нападать</b>${allIm ? '<span class="good">лучше так</span>' : ''}`, right: '' });
      return choiceSheet(q.kind === 'raze' ? '💥 Разрушение: по кому бьём?' : `⬛ Кому подбросить «${esc(D.ESTATES[q.estate].name)}»?`, `${allIm ? `<p class="note warn">Разрушить сейчас нечего ни у кого${q.options.some(o => immuneOf(S.players[o.i]).length) ? ': владения защищены' : ''} — нападение пройдёт впустую.</p>` : ''}<p class="note">${ATTACK_RULE('war')}${q.kind === 'raze' ? ' Разрушенное владение уходит из игры навсегда.' : ' Провал — беда замешивается обратно в колоду владений.'}</p>`, opts);
    }
    if (q.kind === 'siege') {
      const opts = q.options.map(o => {
        const t = S.players[o.i];
        const loot = (o.lootIds || []).map(id => D.ESTATES[id]);
        const g = o.gold != null ? o.gold : t.gold;
        const im = immuneTxt(t, 'захватить');
        const win = loot.length ? `победа — одно владение на выбор: ${listEst(loot)}` : im ? `${im} — победа ничего не даст` : 'забрать нечего — победа ничего не даст';
        return { icon: H(t).sigil, value: o.i, right: '', bad: !loot.length,
          html: `<b>${esc(H(t).short)}</b><br><span class="muted">атака ${o.A} + 🎲 против обороны ${o.D} + 🎲 · шанс ${pct(o.p)}<br>${win}</span>` };
      });
      const allIm = q.options.every(o => !(o.lootIds || []).length);
      opts.push({ icon: '✋', value: null, html: `<b>Не осаждать</b>${allIm ? '<span class="good">лучше так</span>' : ''}`, right: '' });
      return choiceSheet('⚔️ Осада: на кого нападаем?', `${allIm ? `<p class="note warn">Захватить сейчас нечего ни у кого${q.options.some(o => immuneOf(S.players[o.i]).length) ? ': владения защищены' : ''} — нападение пройдёт впустую.</p>` : ''}<p class="note">${ATTACK_RULE('war')} Победив, забираете владение ценой до ${R.siegeLoot}🪙.</p>`, opts);
    }
    const mb = E.mods(S, p).stealBonus || 0;
    const steal = (n, g) => `украдёте ${Math.min(n + mb, g)}🪙${g < n + mb ? ` (у них всего ${g}🪙)` : ''}`;
    const EFF = { grab: 'перехватить карту из сброса', burn: `сжечь ${D.cards(q.param)} из сброса`, poach: 'переманить вассала', distract: 'отвлечь лорда', riot: `смута: содержание +${q.param}🪙`, lock: 'лишить найма на ход', tax: `смута: ${q.param}🪙 за каждое знамя`, arson: `поджог: −${q.param}🪙`, denounce: `донос: ${D.cards(q.param)} из руки — в сброс`, slander: 'клевета: ход без покупки карт двора', feast: `отравленный пир: карта из руки и −${q.param}🪙` };
    const eff = q.effect === 'steal' ? `украсть ${q.param + mb}🪙` : q.effect === 'sabotage' ? (modOn('seats') ? 'сорвать замысел или устроить опалу' : 'сорвать замысел') : EFF[q.effect] || `забрать владение до ${q.param}🪙`;
    const opts = q.options.map(o => {
      const t = S.players[o.i];
      const g = o.gold != null ? o.gold : t.gold;
      let gain;
      if (q.effect === 'steal') gain = steal(q.param, g);
      else if (q.effect === 'sabotage') { const sOk = modOn('seats') && !E.mods(S, t).seatGuard && (t.seats || []).length; gain = o.plotsOk ? `сорвёте один из замыслов (у них ${o.plots})` : `${o.plots ? 'замыслы защищены' : 'замыслов нет'} — ${sOk ? `опала: прогоните одного из их придворных (${t.seats.length})` : 'взять нечего'}`; }
      else if (q.effect === 'grab') gain = t.discard.length ? `карта из их сброса (там ${t.discard.length})` : 'сброс пуст — взять нечего';
      else if (q.effect === 'burn') gain = t.discard.length ? `сгорят ${Math.min(q.param, t.discard.length)} из их сброса` : 'сброс пуст — жечь нечего';
      else if (q.effect === 'poach') { const pr = (id) => (R.poachHalf ? Math.ceil(D.BAN[id].cost / 2) : D.BAN[id].cost); const ok = p.vassals.length < R.needV && t.vassals.some(id => pr(id) <= p.gold); gain = ok ? `вассал на выбор (у них ${t.vassals.length}), вы платите ${R.poachHalf ? 'в банк половину цены' : 'им его цену'}` : 'переманить некого'; }
      else if (q.effect === 'distract') gain = t.lords.length ? `один их лорд не действует их ход` : 'лордов нет — отвлекать некого';
      else if (q.effect === 'riot') gain = t.greats.length ? `содержание их великих +${q.param}🪙 в их ход` : 'великих лордов нет — смута ничего не даст';
      else if (q.effect === 'lock') gain = 'в свой следующий ход они не нанимают знамён';
      else if (q.effect === 'arson') gain = g ? `они теряют ${Math.min(q.param, g)}🪙` : 'у них нет золота — терять нечего';
      else if (q.effect === 'denounce') gain = t.hand.length ? `${D.cards(Math.min(q.param, t.hand.length))} из их руки — в сброс, наугад` : 'рука пуста — сбрасывать нечего';
      else if (q.effect === 'slander') gain = 'в свой следующий ход они не купят карты двора';
      else if (q.effect === 'feast') gain = [t.hand.length ? 'карта из их руки — в сброс, наугад' : '', g ? `−${Math.min(q.param, g)}🪙` : ''].filter(Boolean).join(' и ') || 'ни карт, ни золота — взять нечего';
      else if (q.effect === 'tax') { const v = Math.min(g, E.regCount(t) * q.param); gain = v ? `они отдают в банк ${v}🪙 (${q.param}🪙 × ${E.regCount(t)} знамён)` : 'у них нет знамён или золота'; }
      else { const loot = (o.lootIds || []).map(id => D.ESTATES[id]); const im = immuneTxt(t, 'отнять'); gain = loot.length ? `одно владение на выбор: ${listEst(loot)}` : im ? `ничего: ${im}` : 'забрать нечего'; }
      return { icon: H(t).sigil, value: o.i, right: '',
        html: `<b>${esc(H(t).short)}</b><br><span class="muted">шпион ${o.A} + 🎲 против стражи ${o.G} + 🎲 · шанс ${pct(o.p)}<br>успех — ${gain}</span>` };
    });
    opts.push({ icon: '✋', value: null, html: '<b>Отказаться</b>' });
    const note = `${ATTACK_RULE('int')}${R.spyBuyoff ? ` До броска соперник может откупиться: ${R.spyBuyoff}🪙 за каждую 🔗 разницы сил, не меньше ${R.spyBuyoff}🪙 — золото ваше, шпионаж отменён.` : ''}`;
    return choiceSheet(`🗝 Шпионаж: ${eff}`, `<p class="note">${note}</p>`, opts);
  }
  // что захваченное владение будет давать вам
  function forMe(d, p) {
    const m = E.mods(S, p), n = D.numText(d.n);
    let t;
    if (d.t === 'wall') t = `🧱 +${d.walls} к обороне от осад`;
    else if (d.t === 'land') t = `на ${n} — +${E.estateIncome(S, p, d, m)}🪙 вам в ход любого игрока`;
    else if (d.t === 'craft') t = `на ${n} — +${E.estateIncome(S, p, d, m)}🪙 на вашем броске`;
    else if (d.t === 'raid') t = `на ${n} — забирать ${d.inc + (m.redBonus || 0)}🪙 у того, чей ход`;
    else t = `на ${n} вашего броска — ${d.inc}🪙 у самого богатого соперника`;
    const x = [];
    if (d.sym) x.push(`${D.SYM[d.sym]} +1`);
    if (d.walls && d.t !== 'wall' && modOn('sieges')) x.push(`🧱 +${d.walls}`);
    if (d.p && modOn('unions')) { const u = E.unionsOf(p), k = u.counts[d.p] + 1, nd = E.unionNeed(p, d.p); x.push(`${D.PROV[d.p].icon} ${D.PROV[d.p].name}: станет ${k}${nd === 1 ? ' — союз!' : ''}`); }
    const own = p.estates.filter(e => e.id === d.id).length;
    if (own) x.push(`у вас уже ${own}`);
    return t + (x.length ? ` · ${x.join(' · ')}` : '');
  }
  function askCapture(p, q) {
    const t = S.players[q.from];
    const opts = q.options.map(uid => {
      const e = t.estates.find(x => x.uid === uid); const d = D.ESTATES[e.id];
      return { icon: D.ETYPE[d.t].mark, value: uid, right: `${d.cost}🪙`, html: `<b>${esc(d.name)}</b><br><span class="muted">${forMe(d, p)}</span>` };
    });
    if (q.wrath) return choiceSheet(`😈 Гнев: что забираем у ${esc(E.shortG(t))}?`, '<p class="note">Без нападения — отбить нельзя. Владение придёт к вам в руинах и отстроится на первом срабатывании.</p>', opts);
    return choiceSheet(q.blackmail ? `Вымогательство: что требуем у ${esc(H(t).gen)}?` : `Что забираем у ${esc(E.shortG(t))}?`, `<p class="note">${q.blackmail ? 'Соперник отдаст это владение — или заплатит вам его цену и оставит себе. ' : 'Владение перейдёт к вам в руинах: доход оно начнёт приносить, когда первый раз сработает и отстроится. '}Под названием — что оно будет приносить именно вам, с вашими бонусами.</p>`, opts);
  }
  // откуп от шпионажа: до броска заплатить шпиону 3🪙 за каждую 🔗 разницы — шпионаж отменён
  function askBuyoff(p, q) {
    const a = S.players[q.from];
    const who = esc(H(a).short);
    const WHAT = { estate: (n) => `заберут ваше владение до ${n}🪙`, steal: (n) => `украдут ${n}🪙`, poach: () => 'переманят вашего вассала (заплатив его цену)', distract: () => 'один ваш лорд не будет действовать ваш ход', riot: (n) => `в ваш ход содержание великих лордов на ${n}🪙 дороже`, sabotage: () => 'сорвут замысел или прогонят придворного', grab: () => 'заберут карту из вашего сброса', burn: (n) => `сожгут ${D.cards(n)} из вашего сброса`, arson: (n) => `вы потеряете ${n}🪙`, denounce: (n) => `вы сбросите ${D.cards(n)} из руки`, slander: () => 'в свой ход вы не купите карты двора', feast: (n) => `вы сбросите карту из руки и потеряете ${n}🪙` };
    const what = q.plantEstate ? `подбросят вам проклятие «${esc(D.ESTATES[q.plantEstate].name)}»` : (WHAT[q.effect] || (() => 'шпионаж против вас'))(q.param);
    const body = `<p class="note">${who} шпионят против вас: если удастся — ${what}. Шпион ${q.A} + 🎲 против вашей стражи ${q.G} + 🎲 (🔗 + 🧱).</p>
      <p class="note">До броска можно откупиться: ${R.spyBuyoff}🪙 за каждую 🔗 разницы сил, не меньше ${R.spyBuyoff}🪙. У вас ${p.gold}🪙.</p>`;
    return choiceSheet(`${H(a).sigil} ${who} подослали шпиона`, body, [
      { icon: '🪙', value: true, html: `<b>Откупиться за ${q.cost}🪙</b><br><span class="muted">золото — ${esc(H(a).dat)}, шпионаж отменён; у вас останется ${p.gold - q.cost}🪙</span>`, right: `−${q.cost}🪙` },
      { icon: '🎲', value: false, html: '<b>Пусть бросают кубики</b><br><span class="muted">стража против шпиона</span>', right: '' },
    ]);
  }
  function askBribe(p, q) {
    const a = S.players[q.from];
    const who = esc(H(a).short), d = D.ESTATES[q.estate];
    const body = `<p class="note">Вымогательство удалось. ${who} требуют ваше владение «${esc(d.name)}» — или его цену золотом.</p>
      <div class="ex-pc">${pcard('estate', q.estate, { big: true })}</div>
      <dl class="kv bribe"><dt>Отдать</dt><dd>«${esc(d.name)}» перейдёт к ${esc(H(a).dat)}.</dd><dt>Откупиться</dt><dd>Вы платите ${esc(H(a).dat)} цену владения — <b>${q.cost}🪙</b> — и оставляете его себе.</dd><dt>У вас</dt><dd>${p.gold}🪙</dd></dl>`;
    return choiceSheet(`${H(a).sigil} ${who} вымогают у вас владение`, body, [
      { icon: '🪙', value: true, html: `<b>Откупиться за ${q.cost}🪙</b><br><span class="muted">владение остаётся у вас; у вас останется ${p.gold - q.cost}🪙</span>`, right: `−${q.cost}🪙` },
      { icon: '✋', value: false, html: `<b>Отдать «${esc(d.name)}»</b><br><span class="muted">золото остаётся у вас</span>`, right: '' },
    ]);
  }
  function plotChances(n) {
    let s = 0;
    for (const q of S.players) s += E.Bot.pNum(S, q, n);
    return Math.min(0.99, s);
  }
  function askPlotNums(p, q) {
    const count = q.count || 1;
    return new Promise(res => {
      let sel = [];
      const grid = () => Array.from({ length: 12 }, (_, k) => k + 1).filter(n => !(q.exclude || []).includes(n)).map(n => `<button data-n="${n}" class="${sel.includes(n) ? 'on' : ''}"><b>${n}</b><small>${Math.round(plotChances(n) * 100)}% за круг</small></button>`).join('');
      const body = `<p class="note">Замысел сработает, когда в любой ход (ваш или чужой) выпадет это число. Процент — примерный шанс за один круг с учётом того, кто сколько кубиков бросает.</p><div class="numgrid">${grid()}</div><div class="acts"><button class="btn primary wide" data-ok disabled>Выбрать ${count === 2 ? '2 числа' : 'число'}</button></div>`;
      const sh = openSheet({ title: `🎲 Замысел «${esc(D.COURT[q.card || q.id].name)}»${q.exclude ? ` · уже ${q.exclude.join(', ')}` : ''}`, body, dismiss: false });
      const upd = () => { sh.el.querySelector('.numgrid').innerHTML = grid(); const ok = sh.el.querySelector('[data-ok]'); ok.disabled = sel.length !== count; };
      sh.el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-n]');
        if (b) { const n = +b.dataset.n; if (sel.includes(n)) sel = sel.filter(x => x !== n); else { sel.push(n); if (sel.length > count) sel.shift(); } upd(); return; }
        if (e.target.closest('[data-ok]') && sel.length === count) { sh.close(); res(sel.slice()); }
      });
    });
  }
  // Похоть: из сброса соперника — до q.max карт себе в руку, сколько захотите (v10.19: можно и ни одной)
  function askLustTake(p, q) {
    return new Promise(res => {
      let sel = [];
      const t = S.players[q.from], src = q.options;
      const list = () => src.map((id, i) => { const c = D.COURT[id]; return `<button class="opt" data-i="${i}"><span class="big">${sel.includes(i) ? '☑️' : '⬜'}</span><span><b>${esc(c.name)}</b><br><span class="muted">${esc(roleName(c))} · ${c.cost}🪙</span></span><span class="r"></span></button>`; }).join('');
      const okTxt = () => (sel.length ? `Забрать ${D.cards(sel.length)}` : 'Ничего не брать');
      const sh = openSheet({ title: `😈 Похоть: что забрать у ${esc(E.shortG(t))}? (до ${q.max})`, body: `<p class="note">До ${q.max} ${D.plural(q.max, 'карты', 'карт', 'карт')} из сброса соперника — вам в руку, теперь они ваши. Сколько взять — решаете вы, можно и ни одной. Козни не берутся.</p><div class="optlist">${list()}</div><button class="btn primary" data-ok>${okTxt()}</button>`, dismiss: false });
      sh.el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-i]');
        if (b) { const i = +b.dataset.i; if (sel.includes(i)) sel = sel.filter(x => x !== i); else if (sel.length < q.max) sel.push(i); sh.el.querySelector('.optlist').innerHTML = list(); sh.el.querySelector('[data-ok]').textContent = okTxt(); return; }
        if (e.target.closest('[data-ok]')) { sh.close(); res(sel); }
      });
    });
  }
  function askTrash(p, q) {
    return new Promise(res => {
      let sel = [];
      const src = q.cards || p.hand, lock = q.lock || []; // q.cards — жертва ритуала из сброса; lock — одолженная карта, её не убрать
      const cards = [...p.deck, ...p.discard, ...p.hand, ...p.inPlay];
      const all = cards.length, taxAll = cards.filter(id => id === 'tax').length;
      const sum = () => {
        const n = sel.length, tx = sel.filter(i => src[i] === 'tax').length;
        return `Сейчас в колоде ${all} ${D.plural(all, 'карта', 'карты', 'карт')}, из них «Подать» — ${taxAll}.${n ? ` Станет ${all - n}, «Подать» — ${taxAll - tx}.` : ''}`;
      };
      const list = () => src.map((id, i) => { const c = D.COURT[id]; return `<button class="opt" data-i="${i}" ${lock.includes(i) ? 'disabled' : ''}><span class="big">${lock.includes(i) ? '🌑' : sel.includes(i) ? '☑️' : '⬜'}</span><span><b>${esc(c.name)}</b>${lock.includes(i) ? ' · чужая, на этот ход' : ''}<br><span class="muted">${D.fxText(c.fx)}</span></span><span class="r">${c.start || c.sig ? '' : c.cost + '🪙'}</span></button>`; }).join('');
      const warn = () => { const xs = sel.filter(i => src[i] !== 'tax').map(i => `«${esc(D.COURT[src[i]].name)}»`); return xs.length ? `Внимание: ${xs.join(' и ')} — не «Подать», ${xs.length > 1 ? 'исчезнут' : 'исчезнет'} навсегда.` : ''; };
      const short = () => Math.max(0, (q.need || 0) - sel.length); // покаяние: обязательно ровно q.need карт
      const okTxt = () => (short() ? `Выберите ещё ${D.cards(short())}` : sel.length ? `Убрать ${D.cards(sel.length)}` : 'Ничего не убирать');
      const body = `<p class="note">Убранные карты исчезают из вашей колоды навсегда. Обычно убирают «Подать»: колода становится меньше, и сильные карты приходят чаще.</p><p class="trash-sum">${sum()}</p><p class="trash-warn" hidden></p><div class="optlist">${list()}</div><div class="acts"><button class="btn primary wide" data-ok${short() ? ' disabled' : ''}>${okTxt()}</button></div>`;
      const sh = openSheet({ title: `${q.label || (q.each ? 'Покаяние' : 'Очищение')}: уберите ${q.need >= q.max ? `${q.max} ${D.plural(q.max, 'карту', 'карты', 'карт')}` : `до ${q.max} ${D.plural(q.max, 'карты', 'карт', 'карт')}`}${q.each ? ` (+${q.each}🪙 за каждую)` : ''}`, body, dismiss: false });
      sh.el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-i]');
        if (b) {
          const i = +b.dataset.i;
          if (lock.includes(i)) return;
          if (sel.includes(i)) sel = sel.filter(x => x !== i); else if (sel.length < q.max) sel.push(i);
          sh.el.querySelector('.optlist').innerHTML = list();
          sh.el.querySelector('.trash-sum').textContent = sum();
          const wn = sh.el.querySelector('.trash-warn'); wn.textContent = warn(); wn.hidden = !warn();
          { const ok = sh.el.querySelector('[data-ok]'); ok.textContent = okTxt(); ok.disabled = short() > 0; }
          return;
        }
        if (e.target.closest('[data-ok]') && !short()) { sh.close(); res(sel); }
      });
    });
  }

  // ---------- листы и тосты ----------
  function openSheet({ title, body, dismiss = true }) {
    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div><h2>${title}</h2><div class="sbody">${body}</div>${dismiss ? '<div class="acts"><button class="btn wide" data-close>Закрыть</button></div>' : ''}</div>`;
    sheetRoot.appendChild(scrim);
    const close = () => {
      if (scrim.classList.contains('out')) return;
      scrim.classList.add('out');
      if (reduceMotion()) scrim.remove(); else setTimeout(() => scrim.remove(), 200);
    };
    if (dismiss) {
      scrim.addEventListener('click', (e) => { if (e.target === scrim || e.target.closest('[data-close]')) close(); });
    }
    scrim.dismissible = dismiss;
    scrim.close = close;
    return { el: scrim, close };
  }
  // полноэкранная страница поверх игры: правила, памятка, карты, журнал, настройки, итоги
  function openPage({ title, body, cls = '', back = 'Назад' }) {
    const el = document.createElement('section');
    el.className = `page ${cls}`;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', String(title).replace(/<[^>]+>/g, ''));
    el.innerHTML = `<header class="nav"><button class="nav-back" data-close>‹ ${back}</button><h1>${title}</h1><span class="nav-r"></span></header><div class="page-body">${body}</div>`;
    pageRoot.appendChild(el);
    document.body.classList.add('paged');
    const close = () => {
      if (el.classList.contains('out')) return;
      el.classList.add('out');
      const done = () => { el.remove(); if (!pageRoot.querySelector('.page:not(.out)')) document.body.classList.remove('paged'); };
      if (reduceMotion()) done(); else setTimeout(done, 240);
    };
    el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
    el.close = close;
    return { el, body: el.querySelector('.page-body'), close };
  }
  function closeAllPages() { pageRoot.innerHTML = ''; document.body.classList.remove('paged'); }
  function closeAllSheets() { sheetRoot.innerHTML = ''; }
  document.addEventListener('toggle', (e) => { if (e.target.matches && e.target.matches('details.mods')) modsOpen = e.target.open; }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const top = [...sheetRoot.children].filter(x => !x.classList.contains('out')).pop();
      if (top && top.navGo) { e.preventDefault(); top.navGo(e.key === 'ArrowRight' ? 1 : -1); }
      return;
    }
    if (e.key !== 'Escape') return;
    const sh = [...sheetRoot.children].filter(x => !x.classList.contains('out')).pop();
    if (sh) { if (sh.dismissible) sh.close(); return; }
    const pg = [...pageRoot.children].filter(x => !x.classList.contains('out')).pop();
    if (pg) { pg.close(); return; }
    // за столом Esc снимает выбор карты и закрывает «Рынок» / «Знамёна»
    if (document.body.dataset.view === 'game' && S) { const b = app.querySelector('.abar [data-act="desel"]') || app.querySelector('.drawer[aria-hidden="false"] [data-act="drawer-close"]'); if (b) b.click(); }
  });
  // ---------- клавиатура за столом (MacBook): Enter / пробел — главная кнопка, 1 и 2 — кубики, ← → — карты руки, ↑ — сыграть ----------
  const hoverOk = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  const kbd = (k) => (hoverOk ? `<kbd class="kbd" aria-hidden="true">${k}</kbd>` : '');
  document.addEventListener('keydown', (e) => {
    if (document.body.dataset.view !== 'game' || !S || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const t = e.target, k = e.key;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    const vis = (el) => !!el && !el.disabled && el.offsetParent !== null;
    const press = (el) => { if (!vis(el)) return false; e.preventDefault(); if (document.activeElement && document.activeElement !== document.body && document.activeElement.blur) document.activeElement.blur(); el.classList.add('kb'); setTimeout(() => el.classList.remove('kb'), 170); el.click(); return true; };
    // кнопку, выбранную клавишей Tab, Enter и пробел нажимают как обычно
    const tabbed = t && t.matches && t.matches('button:focus-visible, a:focus-visible, [role="button"]:focus-visible, [tabindex]:focus-visible');
    const sh = [...sheetRoot.children].filter(x => !x.classList.contains('out')).pop(), pg = [...pageRoot.children].filter(x => !x.classList.contains('out')).pop();
    if (sh || pg) {
      // в открытом листе Enter жмёт его единственную главную кнопку
      if (k === 'Enter' && sh && !tabbed) { const bs = [...sh.querySelectorAll('button.primary')].filter(vis); if (bs.length === 1) press(bs[0]); }
      return;
    }
    if (k === 'Enter' || k === ' ') {
      if (tabbed) return;
      const c = [...coachEl.querySelectorAll('button.primary')].filter(vis)[0];
      if (c) { press(c); return; }
      const bs = [...app.querySelectorAll('.abar .pa .primary')].filter(vis);
      if (bs.length === 1) press(bs[0]); else e.preventDefault();
      return;
    }
    if (k === '1' || k === '2') { press(app.querySelector(`.abar [data-act="roll"][data-n="${k}"]`)); return; }
    if (k === 'ArrowLeft' || k === 'ArrowRight') {
      const cs = [...app.querySelectorAll('.handz .hcard[data-act="sel"]')]; if (!cs.length || !isMyTurn() || WATCH) return;
      const cur = cs.findIndex(c => c.classList.contains('sel')), nx = cur < 0 ? (k === 'ArrowRight' ? 0 : cs.length - 1) : clampN(cur + (k === 'ArrowRight' ? 1 : -1), 0, cs.length - 1);
      if (nx !== cur) press(cs[nx]); else e.preventDefault();
      return;
    }
    if (k === 'ArrowUp') { press(app.querySelector('.abar [data-act="play"]')); return; }
    if (k === 'ArrowDown') { press(app.querySelector('.abar [data-act="desel"]')); return; }
  });
  // ---------- наведение мышью: карта крупно рядом с курсором (только там, где есть мышь) ----------
  const hovEl = mk('div', 'hovcard', 'hovcard'); hovEl.hidden = true; hovEl.setAttribute('aria-hidden', 'true');
  let hovFor = null, hovTm = 0;
  const HOV = '.board .tile[data-id], .board .mcard[data-act], .board .hcard[data-id], .scrim .pcw[data-act]:not(.big), .scrim .mcard[data-act]';
  function hovSpec(el) {
    const d = el.dataset, cl = el.classList;
    if (cl.contains('tile')) return ['estate', d.id];
    if (cl.contains('hcard')) return ['court', d.id];
    if (cl.contains('mcard')) { const m = /\bk-(estate|court|ban|faith|house)\b/.exec(el.className); return m ? [m[1], d.id || d.key] : null; }
    const a = d.act;
    return a === 'info-estate' ? ['estate', d.id] : a === 'info-court' ? ['court', d.id] : a === 'info-ban' ? ['ban', d.key] : a === 'zoom' ? [d.kind, d.id] : null;
  }
  function hovHide() { clearTimeout(hovTm); hovFor = null; if (!hovEl.hidden) { hovEl.hidden = true; hovEl.innerHTML = ''; } }
  function hovShow(el) {
    const sp = hovSpec(el); if (!sp || !sp[1]) return;
    let h = ''; try { h = pcard(sp[0], sp[1], { big: true }); } catch (err) { h = ''; }
    if (!h) return;
    hovEl.innerHTML = h; hovEl.hidden = false;
    const r = el.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight, w = hovEl.offsetWidth, hh = hovEl.offsetHeight;
    // сбоку от карты, где есть место; иначе — над ней или под ней
    let x = r.right + 14, y = r.top + r.height / 2 - hh / 2;
    if (x + w > W - 8) x = r.left - 14 - w;
    // карта руки — над ней: кнопки хода и соседние карты остаются на виду
    if (x < 8 || (el.classList.contains('hcard') && r.top - 14 - hh >= 8)) { x = r.left + r.width / 2 - w / 2; y = r.top - 14 - hh; if (y < 8) y = r.bottom + 14; }
    hovEl.style.left = Math.round(clampN(x, 8, Math.max(8, W - w - 8))) + 'px'; hovEl.style.top = Math.round(clampN(y, 8, Math.max(8, H - hh - 8))) + 'px';
  }
  if (hoverOk) {
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest && e.target.closest(HOV);
      if (el === hovFor) return;
      hovHide(); if (!el || dragC) return;
      hovFor = el; hovTm = setTimeout(() => { if (hovFor === el && el.isConnected && !dragC) hovShow(el); }, 420);
    });
    document.addEventListener('mousedown', hovHide, true);
    document.addEventListener('keydown', hovHide, true);
    document.addEventListener('wheel', hovHide, { passive: true, capture: true });
    document.addEventListener('mouseleave', hovHide);
    window.addEventListener('blur', hovHide);
  }
  function toast(text, ms = 2600) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = text;
    const prev = toastRoot.lastElementChild;
    if (prev && prev.vdText === text) prev.remove(); // то же сообщение ещё на экране — не повторяем
    el.vdText = text;
    toastRoot.appendChild(el);
    while (toastRoot.children.length > (S ? 2 : 3)) toastRoot.firstChild.remove(); // на столе — не больше двух: середину не закрываем
    setTimeout(() => el.remove(), ms);
  }

  // ---------- компоненты ----------
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function die(v, cls = '') {
    if (!v) return `<div class="die blank ${cls}" aria-hidden="true"></div>`;
    return `<div class="die ${cls}" role="img" aria-label="${v}">${Array.from({ length: 9 }, (_, k) => `<i class="${PIPS[v].includes(k) ? 'on' : ''}"></i>`).join('')}</div>`;
  }
  // карта нападения: только эти карты начинают осаду или шпионаж
  // защита соперника от захвата и разрушения (Лорд-протектор Эдуард и др.): кто даёт — для подсказок
  const immuneOf = (t) => (E.mods(S, t).captureImmune ? E.modSources(S, t, 'captureImmune') : []);
  const immuneTxt = (t, what = 'захватить, отнять и разрушить') => { const im = immuneOf(t); return im.length ? `🛡 «${im.map(esc).join('», «')}»: владения ${esc(E.shortG(t))} нельзя ${what}` : ''; };
  // нападение карты впустую? — у всех соперников нечего взять; причина — защита или нет подходящих владений
  function attackWaste(p, id) {
    const c = D.COURT[id]; if (!c || !S) return null;
    const op = (c.fx || []).find(o => o[0] === 'siege' || o[0] === 'raze' || (o[0] === 'spy' && o[2] === 'estate'));
    if (!op) return null;
    if (op[0] !== 'spy' && !modOn('sieges')) return null;
    const ts = E.targetsOf(S, p);
    if (!ts.length) return null;
    const m = E.mods(S, p);
    const loot = (t) => op[0] === 'siege' ? E.capturable(S, t, p, R.siegeLoot + (m.lootPlus || 0)).length : op[0] === 'raze' ? E.destroyable(S, t, op[2] >= 99 ? 99 : op[2], op[3]).length : E.capturable(S, t, p, op[3]).length;
    if (ts.some(t => loot(t) > 0)) return null;
    const why = ts.map(t => immuneTxt(t, op[0] === 'raze' ? 'разрушить' : op[0] === 'siege' ? 'захватить' : 'отнять')).filter(Boolean);
    return why.length ? `${why.join('; ')} — нападение ничего не даст.` : `Сейчас ${op[0] === 'raze' ? 'разрушать' : 'забирать'} нечего — нападение ничего не даст.`;
  }
  const attackOf = (id) => { const fx = (D.COURT[id] && D.COURT[id].fx) || []; const has = (k) => fx.some(op => op[0] === k); return has('siege') ? 'siege' : has('raze') ? 'raze' : has('spy') ? 'spy' : null; };
  // ---------- печатные карты (как в PDF для печати): та же разметка, масштаб — по ширине ячейки ----------
  PCards.setup({ src: (k) => IMG(`icons/i_${k}.svg`), art: (k, id) => IMG(k === 'e' || k === 'c' || k === 'f' ? ((typeof ART !== 'undefined' && ART[id]) || `art/${id}.svg`) : `art/${k}_${id}.svg`) });
  if (!document.getElementById('pcards-css')) { const st = document.createElement('style'); st.id = 'pcards-css'; st.textContent = PCards.CSS; document.head.appendChild(st); }
  const pcCache = new Map();
  function pcHtml(kind, id, allyOn, seatOn, full) {
    const key = `${kind}|${id}|${allyOn ? 1 : 0}|${seatOn ? 1 : 0}|${full ? '*' : MODK.filter(modOn).join()}`;
    let h = pcCache.get(key);
    if (!h) { h = PCards.card(kind, id, { mod: full ? () => true : modOn, allyOn, seatOn }); pcCache.set(key, h); }
    return h;
  }
  const pcName = (kind, id) => kind === 'ritual' ? D.RITUALS[id].name : kind === 'estate' ? D.ESTATES[id].name : kind === 'court' ? D.COURT[id].name : kind === 'module' ? (D.MODULES[id] ? D.MODULES[id].name : 'Наборы правил') : kind === 'house' ? D.HOUSES[id].name
    : kind === 'ban' ? D.BAN[id].name : kind === 'faith' ? D.FAITHS[id].name : kind === 'rule' ? ({ envy: 'Зависть', support: 'Народная поддержка', alms: 'Подаяния', lore: 'Знания', trade: 'Торг' })[id] || '' : D.PROV[id].name;
  const BAN_BACK = { v: 'vassals', l: 'lords', g: 'foreign' };
  // карта на столе: o.cls — состояние (hit / built / dim / stack), o.badge — плашка поверх, o.o — чей стол, o.st — состояние знамени,
  // o.big — крупная карта в листе подробностей (без нажатия)
  function pcard(kind, id, o = {}) {
    if (o.mark && o.mark.act) o = Object.assign({}, o, { act: o.mark.act });
    if (o.coins && o.coins.length) o = Object.assign({}, o, { act: 'coin-card' }); // монеты на карте: нажатие забирает их
    let attrs;
    if (o.big) attrs = `role="img" aria-label="${esc(pcName(kind, id))}"`;
    else {
      const act = o.act || (kind === 'estate' ? 'info-estate' : kind === 'court' ? 'info-court' : kind === 'ban' ? 'info-ban' : 'zoom');
      attrs = `tabindex="0" role="button" aria-label="${esc(pcName(kind, id))}" data-act="${act}"`;
      if (act === 'info-ban') attrs += ` data-key="${id}"${o.st ? ` data-st="${o.st}"` : ''}`;
      else attrs += ` data-id="${id}"${act === 'zoom' ? ` data-kind="${kind}"` : ''}`;
      if (o.o != null) attrs += ` data-o="${o.o}"`;
      if (o.coins && o.coins.length) attrs += ` data-coins="${o.coins.map(c => c.k).join(',')}"`;
    }
    const mk = o.mark || null; // ↻ метка обновления ряда
    const html = PCards.wrap(kind, pcHtml(kind, id, o.allyOn, o.seatOn, o.full) + (o.badge || '') + (mk ? mk.badge : ''), attrs, `web${o.big ? ' big' : ''}${o.cls ? ' ' + o.cls : ''}${mk ? ' ' + mk.cls : ''}`);
    return o.flip ? flipWrap(o.flip, kind === 'ban' ? BAN_BACK[D.BAN[id].tier] : kind, html) : html;
  }
  // ---------- переворот: новая карта на рынке и карта, пришедшая в руку, открываются с рубашки ----------
  const FLIP_MS = 640, FLIP_STEP = 120;
  const flips = new Map(); // место карты → когда начать переворот
  let seenTable = null;    // что лежало на столе при прошлой перерисовке
  const freshHand = new Set(); // чья рука взята заново в конце хода
  let dealHold = 0;            // на сколько придержать раздачу (пока тасуется колода или идёт раздача в начале партии)
  const BACK_OF = { estate: 'estates', court: 'court', vassals: 'vassals', lords: 'lords', foreign: 'foreign', rule: 'balance' };
  // ключ места: где лежит + карта + какая по счёту из одинаковых (сдвиг ряда после покупки ключ не меняет)
  const placeKeys = (where, ids) => { const n = {}; return ids.map(id => { n[id] = (n[id] || 0) + 1; return `${where}|${id}#${n[id]}`; }); };
  function noteNew(where, before, after, t0) {
    const was = new Set(placeKeys(where, before));
    let k = 0;
    placeKeys(where, after).forEach(key => { if (!was.has(key)) flips.set(key, t0 + FLIP_STEP * k++); });
  }
  // новые карты ряда рынка: сколько ушло из колоды — столько последних карт ряда (добор кладёт в конец)
  function noteRow(where, before, after, deck0, deck1, t0) {
    const n = Math.max(0, deck0 - deck1);
    if (!n) return noteNew(where, before, after, t0);
    placeKeys(where, after).slice(-n).forEach((key, k) => flips.set(key, t0 + FLIP_STEP * k));
  }
  function trackFlips() {
    if (!S || reduceMotion()) { seenTable = null; flips.clear(); freshHand.clear(); return; }
    const now = performance.now();
    if (!S.gid) S.gid = 'g' + Math.random().toString(36).slice(2, 10); // партия из старого сохранения
    const gid = `${S.gid}|${S.players.length}`; // не S.seed: это состояние генератора — менялось на каждом броске, и рука «переворачивалась»
    const len = (a) => (a ? a.length : 0);
    const snap = () => ({ gid, est: S.estateRow.slice(), court: S.courtRow.slice(), v: (S.vRow || []).slice(), l: (S.lRow || []).slice(), g: (S.gRow || []).slice(), hand: S.players.map(q => q.hand.slice()),
      dE: len(S.estateDeck), dC: len(S.courtDeck), dv: len(S.vDeck), dl: len(S.lDeck), dg: len(S.gDeck) });
    if (!seenTable || seenTable.gid !== gid) {
      // новая или загруженная партия: стол уже разложен, а свою руку игрок «берёт» — карты открываются по одной
      flips.clear(); seenTable = snap();
      if (ME !== null && S.players[ME]) noteNew(`hand${ME}`, [], S.players[ME].hand, now + 250 + dealHold);
      freshHand.clear(); dealHold = 0;
      return;
    }
    noteRow('est', seenTable.est, S.estateRow, seenTable.dE, len(S.estateDeck), now);
    noteRow('court', seenTable.court, S.courtRow, seenTable.dC, len(S.courtDeck), now);
    for (const t of ['v', 'l', 'g']) noteRow('ban' + t, seenTable[t] || [], S[t + 'Row'] || [], seenTable['d' + t] || 0, len(S[t + 'Deck']), now);
    S.players.forEach((q, i) => {
      if (freshHand.has(i)) { const hold = i === viewIdx() ? dealHold : 0; placeKeys(`hand${i}`, q.hand).forEach((key, k) => flips.set(key, now + hold + FLIP_STEP * k)); }
      else noteNew(`hand${i}`, seenTable.hand[i] || [], q.hand, now);
    });
    freshHand.clear(); dealHold = 0;
    seenTable = snap();
    for (const [key, t] of flips) if (now - t > FLIP_MS + 50) flips.delete(key);
  }
  // для ряда карт: { key } переворота каждой карты или null
  const flipsFor = (where, ids) => placeKeys(where, ids).map(key => (flips.has(key) ? { key } : null));
  function flipWrap(f, kind, html) {
    const t = flips.get(f.key);
    if (t == null) return html;
    const el = performance.now() - t;
    if (el > FLIP_MS) return html;
    // при перерисовке анимация продолжается с того же места (отрицательная задержка)
    return `<div class="pflip" data-k="flip:${f.key}:${Math.round(t)}" style="--fd:${Math.round(-el)}ms"><div class="pf-in"><div class="pf-face">${html}</div><div class="pf-back"><img src="${backSrc(BACK_OF[kind] || 'court')}" alt=""></div></div></div>`;
  }
  const pslot = (card, below = '') => `<div class="pslot">${card}${below}</div>`;
  // рубашка колоды с числом карт. Рубашка — картинкой: страница легче, а надпись в таком размере всё равно не читается
  const backUrl = {};
  const backSrc = (k) => backUrl[k] || (backUrl[k] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(PCards.back(k, { web: true })));
  const deckHtml = (k, n, what) => `<span class="pdeck${n ? '' : ' empty'}" role="img" aria-label="${esc(what)}: ${n}">${n ? `<img src="${backSrc(k)}" alt="">` : ''}<b>${n}</b></span>`;
  const deckHead = (title, k, n, what, sub = '') => `<div class="sec-h dk"><h3>${title}</h3>${sub ? `<span>${sub}</span>` : ''}${deckHtml(k, n, what)}</div>`;
  // цена знамени для игрока: «13 − 2📜 + 1 надбавка = 12🪙»
  function banPriceHtml(p, id) {
    const b = D.BAN[id], c = E.banCost(S, p, id);
    const parts = [`${c.base}`];
    if (c.disc) parts.push(`− ${c.disc}${D.SYM[b.dir]}`);
    if (c.cheap) parts.push(`− ${c.cheap}`);
    if (c.tax) parts.push(`+ ${c.tax} надб.`);
    return { c, txt: parts.length > 1 ? `${parts.join(' ')} = ${c.total}🪙` : `${c.total}🪙` };
  }
  function banSlot(p, id, state, owner, flip, mark) {
    const b = D.BAN[id];
    const built = state === 'built', taken = state === 'taken';
    const my = p && S && ME !== null && p.i === ME && isMyTurn();
    let below = '';
    if (!built && !taken && p) {
      const pc = banPriceHtml(p, id), c = pc.c;
      const block = E.hireBlock(S, p, id);
      const why = block ? (/больше не нужно/.test(block) ? 'уже хватает' : /вера/i.test(block) ? 'запрет веры' : block) : !p.turn.rolled ? 'после броска' : E.buysLeft(S, p) <= 0 && !(p.turn.catchupHire > 0 && (!R.catchupTier || b.tier === R.catchupTier)) ? 'действий нет' : p.gold < c.total ? `нужно ${c.total}🪙` : '';
      below = `<div class="pmeta"><span>${pc.txt}</span>${b.upkeep ? `<span class="muted">содержание ${b.upkeep}🪙 в ход</span>` : ''}</div>${my ? `<button class="btn small ${why ? '' : 'primary'}" data-act="hire" data-id="${id}" ${why || busy || adjustReq ? 'disabled' : ''}>${why ? esc(why) : `Нанять${E.buysLeft(S, p) <= 0 && p.turn.catchupHire > 0 && (!R.catchupTier || b.tier === R.catchupTier) ? ' 🫱' : ''} · ${c.total}🪙`}</button>` : ''}`;
    }
    const o = owner != null ? owner : p ? p.i : null;
    const dist = built && p && p.distracted && p.distracted.id === id;
    const badge = dist ? '<span class="pcb tag">отвлечён</span>' : built ? '<span class="pcb own">🚩 с вами</span>' : taken ? '<span class="pcb tag">у другого</span>' : '';
    return pslot(pcard('ban', id, { o, st: built ? 'built' : taken ? 'taken' : '', cls: built ? 'built' : '', badge, flip, mark }), below);
  }
  // свойства, которым нужен выключенный модуль, на карте бледные — поясняем почему
  const offNote = (m) => { const sp = CardFX.splitMods(m, modOn); return sp.offK.length ? `<p class="note">Бледные свойства не действуют: ${sp.offK.length > 1 ? 'модули' : 'модуль'} ${modList(sp.offK)} в этой партии ${sp.offK.length > 1 ? 'выключены' : 'выключен'}.</p>` : ''; };
  // одинаковые владения — стопкой «×2»; сработавшие на последнем броске — с суммой
  function estStacks(list, hit) {
    const m = new Map();
    // руины — отдельной стопкой: они ещё не приносят дохода
    for (const e of list) { const key = e.id + (e.ruined ? '#r' : ''); const g = m.get(key) || { id: e.id, n: 0, v: null, ruined: !!e.ruined, bad: !!D.ESTATES[e.id].bad, uids: [] }; g.n++; g.uids.push(e.uid); const v = hit[e.uid]; if (v != null) g.v = (g.v || 0) + v; m.set(key, g); }
    return [...m.values()].sort((a, b) => (D.ESTATES[a.id].n[0] || 99) - (D.ESTATES[b.id].n[0] || 99) || D.ESTATES[a.id].cost - D.ESTATES[b.id].cost);
  }
  const stackCard = (g, o) => pcard('estate', g.id, { o, cls: [g.n > 1 ? 'stack' : '', g.ruined ? 'ruined' : '', g.v != null ? (g.v > 0 ? 'hit' : 'hit0') : ''].filter(Boolean).join(' '),
    badge: (g.n > 1 ? `<span class="pcb n">×${g.n}</span>` : '') + (g.ruined ? '<span class="pcb tag">🏚 руины</span>' : '') + (g.bad ? '<span class="pcb tag">⬛ проклятие</span>' : '') + (g.v != null ? `<span class="pcb ${g.v > 0 ? 'gain' : 'zero'}">${g.v > 0 ? '+' + g.v : '0'}🪙</span>` : '') });
  const tutOn = () => !!(S && S.tut && !S.tut.off && ME !== null);
  function tutQueue(id, data) {
    if (!tutOn()) return;
    if (S.tut.seen.includes(id) || S.tut.q.some(x => x.id === id)) return;
    S.tut.q.push({ id, data: data || null });
  }
  // средний доход с вашего броска (без сезонов): что принесут свои владения минус чужие Набеги
  function evRoll(p, n) {
    const m = E.mods(S, p);
    let ev = 0;
    for (let r = 1; r <= 12; r++) {
      const pr = E.pRoll(n, r);
      if (!pr) continue;
      let g = 0;
      for (const e of p.estates) {
        const d = D.ESTATES[e.id];
        if (!d.n.includes(r)) continue;
        if (d.t === 'land' || d.t === 'craft') g += E.estateIncome(S, p, d, m);
        else if (d.t === 'hold') g += Math.min(d.cap || 99, d.inc + (m.holdBonus || 0)); // у самого богатого соперника
        else if (d.t === 'raid' && m.redOwn) g += d.inc + (m.redBonus || 0);
      }
      for (const o of S.players) if (o !== p) for (const e of o.estates) { const d = D.ESTATES[e.id]; if (d.t === 'raid' && !e.ruined && d.n.includes(r)) g -= Math.max(0, d.inc + (E.mods(S, o).redBonus || 0) - (m.raidShield || 0)); }
      ev += pr * g;
    }
    return ev;
  }
  const f1 = (x) => (Math.round(x * 10) / 10).toString().replace('.', ',');
  // ---------- обучение: короткие шаги с подсветкой нужного места (v10.3) ----------
  // первый ход ведётся по шагам: подсказка в одну-две строки, стол приглушён, нужное место подсвечено
  const EVENT_HINTS = {
    'hold-hit': (p, d) => ({ title: 'Соперник забрал золото', text: `${esc(d.src)}: −${d.amt}🪙. 🟪 Твердыня срабатывает на броске хозяина и берёт у самого богатого. Лишнее золото лучше тратить.` }),
    'siege-me': () => ({ title: 'На вас напали', text: `Его ⚔️ + число карты + кубик против ваших ⚔️ + 🧱 + кубика. Поровну — вы отбились. Захваченное владение уходит к нему в руинах.` }),
    'spy-me': () => ({ title: 'К вам подослали шпиона', text: `Его 🔗 + число карты + кубик против ваших 🔗 + 🧱 + кубика. До броска можно откупиться: ${R.spyBuyoff}🪙 за каждую 🔗 разницы.` }),
    envy: () => ({ title: 'Зависть', text: 'Вы единственный лидер по знамёнам: в начале хода платите 1🪙 за каждое знамя отрыва.' }),
    catchup: () => ({ title: 'Догоняющий наём', text: `У лидера уже ${E.cuFrom(S)}+ знамён, у вас меньше: в этот ход можно нанять ещё одного вассала сверх действия.` }),
    support: () => ({ title: 'Народная поддержка', text: `Вы отстаёте на ${R.supportGap}+ знамени: в начале хода получаете +${R.supportGold}🪙.` }),
    finish: (p, d) => ({ title: d.p === ME ? `У вас ${D.banners(E.goal(S))}!` : `У ${esc(H(S.players[d.p]).short)} ${D.banners(E.goal(S))}`, text: 'Круг доигрывается до конца. Цель выполнили несколько игроков — побеждает тот, у кого больше золота.' }),
  };
  const TUT_STEPS = 7;
  const ONCE = [
    ['welcome', (p, my) => my && S.tut.turns === 1 && !p.turn.rolled && !p.inPlay.length && { n: 1, title: 'Цель игры', text: `Вы — ${esc(H(p).name)}. Первым соберите ${goalLine()}. Знамёна — флажки на вашей планке.`, btn: 'Дальше', focus: 'pips', dim: true }],
    ['dice2', (p, my) => my && !p.turn.rolled && S.tut.turns === 2 && { title: '1 или 2 кубика', text: `Один кубик — числа 1–6, два — 2–12. Сейчас в среднем: один ≈ ${f1(evRoll(p, 1))}🪙, два ≈ ${f1(evRoll(p, 2))}🪙.`, focus: 'roll', dim: true }],
    ['banner1', (p) => E.regCount(p) >= 1 && { title: 'Первое знамя!', text: 'Знамя дало значок направления. Значки удешевляют следующие знамёна того же направления.', focus: 'pips', dim: true }],
    ['plot', (p) => p.plots.length > 0 && { title: 'Замысел отложен', text: `⏳ сработает в начале вашего следующего хода, 🎲 — когда выпадет его число. Держать можно ${E.plotSlots(S, p)}.` }],
    ['attack', (p, my) => my && p.hand.some(id => D.COURT[id].fx.some(op => ['siege', 'raze', 'spy', 'plant'].includes(op[0]))) && { title: 'Карта нападения', text: `${ATTACK_RULE('war')} Перед выбором цели игра покажет шанс успеха.`, focus: 'hand' }],
    ['retire', (p, my) => my && R.retire !== false && S.tut.turns === 2 && !p.turn.retired && p.hand.includes('tax') && { title: 'Отставка', text: 'Раз в ход можно убрать карту из игры и взять новую: нажмите на карту → «Отставка». Обычно убирают «Подать».', focus: 'hand' }],
    ['lords', (p) => modOn('lords') && p.vassals.length >= 3 && !p.lords.length && { title: 'Не забудьте лордов', text: `Для победы нужно ${R.needL} лорда. Они дороже вассалов, но меняют правила лично для вас. Ряд лордов — в «Знамёнах».`, focus: 'tab-regalia' }],
    ['faith', (p, my) => my && modOn('faith') && !p.faiths.length && (S.faithRow || []).some(f => !E.canAdopt(S, p, f)) && { title: 'Можно принять веру', text: 'Значков хватает: ряд «Вера» — в «Знамёнах». Вера бесплатна: даёт благо и запрет.', focus: 'tab-regalia' }],
    ['done', (p, my) => my && S.tut.turns >= 3 && !p.turn.rolled && { title: 'Основы вы знаете', text: `Дальше подсказки — только при новых событиях. Выключить их можно в меню ☰.${MODK.some(k => !modOn(k)) ? ' Освоитесь — попробуйте партию с модулями.' : ''}` }],
  ];
  function stepHint(p, my) {
    const T = S.tut, dim = T.turns <= 1;
    if (!my) { const o = S.players[S.cur]; return S.cur !== ME && T.turns <= 2 && !T.seen.includes('opp') ? { id: 'opp', once: true, n: 7, title: 'Ход соперника', text: `Ходят ${esc(H(o).short)}. Их бросок запускает и ваши 🟦 Земли. Что сыграно и что выпало — видно посреди стола.`, focus: 'opp', dim: true } : null; }
    if (!p.turn.rolled && p.hand.length && !p.inPlay.length) return { id: 'play', n: 2, title: 'Сыграйте карту', text: `Нажмите на карту, потом — «Сыграть». «Подать» даёт +1🪙.${modOn('plots') && p.hand.some(id => D.COURT[id].plot) ? ' Карту с ⏳ или 🎲 можно отложить замыслом.' : ''}`, focus: 'hand', dim };
    if (!p.turn.rolled) return { id: 'roll', n: 3, title: 'Бросьте кубик', text: 'Один кубик — числа 1–6, два — 2–12. Выпавшее число запускает владения с этим числом.', focus: 'roll', dim };
    if (myCoins().length) {
      const cs = myCoins(), gin = cs.filter(c => c.by === c.to).reduce((a, c) => a + c.amt, 0), gout = cs.filter(c => c.by !== c.to).reduce((a, c) => a + c.amt, 0), r = S.lastRoll ? `Выпало ${S.lastRoll.total}. ` : '';
      return { id: 'coins', n: 4, title: gin ? 'Заберите доход' : 'Набег соперника', text: gin ? `${r}Светящиеся владения принесли вам ${gin}🪙${gout ? `, а Набег соперника забирает ${gout}🪙` : ''}: нажмите на них или на кнопку внизу.` : `${r}🟥 Набег соперника срабатывает на вашем броске и забирает ${gout}🪙: нажмите на его плитку или на кнопку внизу.`, focus: 'coins', dim };
    }
    const left = E.buysLeft(S, p);
    if (left > 0) {
      const li = T.lastInc;
      let inc = '';
      if (li) { const g = li.gain.reduce((a, x) => a + x[0], 0), l = li.loss.reduce((a, x) => a + x[0], 0); inc = `Выпало ${li.r}: ${g ? `+${g}🪙` : ''}${g && l ? ', ' : ''}${l ? `соперник забрал ${l}🪙` : ''}${g || l ? '.' : 'ничего не сработало.'} `; }
      const cheap = (S.vRow || []).map(id => ({ id, c: E.banCost(S, p, id).total })).sort((a, b) => a.c - b.c)[0];
      let tip, focus;
      if (cheap && p.gold >= cheap.c) { tip = `Хватает на вассала «${esc(D.regName(D.BAN[cheap.id]))}» за ${cheap.c}🪙 — ${whereShop('Знамёна')}.`; focus = drawer === 'regalia' ? 'hire' : 'tab-regalia'; }
      else {
        const opts = [...S.estateRow.map(id => D.ESTATES[id]), D.ESTATES.field, D.ESTATES.bakery].filter(d => p.gold >= E.marketPrice(S, p, d.cost));
        if (opts.length) { tip = `Купите владение: оно приносит золото на своих числах. Это ${whereShop('Рынок')}.`; focus = drawer === 'market' ? '' : 'tab-market'; }
        else { tip = 'Золота пока мало — можно просто завершить ход.'; focus = 'end'; }
      }
      return { id: 'act', n: 5, title: 'Одно действие', text: `${inc}Купить карту на рынке <i>или</i> нанять знамя. ${tip}`, focus, dim };
    }
    return { id: 'end', n: 6, title: 'Завершите ход', text: `Сыгранные карты и остаток руки уйдут в сброс, из колоды придут ${E.handSize(S, p)} новые.`, focus: 'end', dim };
  }
  const gen = (q) => H(q).gen; // «Змеи» → «Змей»
  const oppOf = (p) => S.players.find(q => q !== p);
  function coachHint(p) {
    if (!tutOn() || S.winner !== null || WATCH || introT) return null;
    const T = S.tut, my = isMyTurn();
    while (T.q.length) {
      const x = T.q[0];
      const h = EVENT_HINTS[x.id] && EVENT_HINTS[x.id](p, x.data || {});
      if (h) return Object.assign({ id: x.id, once: true }, h);
      T.q.shift();
    }
    for (const [id, fn] of ONCE) { if (T.seen.includes(id)) continue; const h = fn(p, my); if (h) return Object.assign({ id, once: true }, h); }
    if (T.turns <= 2) return stepHint(p, my); // первый ход — с подсветкой, второй — те же шаги без затемнения
    return null;
  }
  function coachHtml(h) {
    if (!h) return '';
    const dots = h.n ? `<span class="ch-d" role="img" aria-label="шаг ${h.n} из ${TUT_STEPS}">${Array.from({ length: TUT_STEPS }, (_, k) => `<i class="${k + 1 === h.n ? 'on' : k + 1 < h.n ? 'was' : ''}"></i>`).join('')}</span>` : '';
    return `<div class="coach" role="status"><div class="ch-h"><b>${h.title}</b>${dots}</div><p>${h.text}</p>
      <div class="ch-a">${h.once ? `<button class="btn small primary" data-act="tut-ok" data-id="${h.id}">${h.btn || 'Понятно'}</button>` : `<button class="btn small primary" data-act="coach-min" data-id="${h.id}">Понятно</button>`}<button class="link" data-act="tut-off">Без подсказок</button></div></div>`;
  }
  // подсветка обучения: стол приглушён, вокруг нужного места — «окно» с золотой каймой
  const SPOT = {
    pips: () => '.pbar.own .pipsb', hand: () => '.handz .hcard', roll: () => '.abar .tdie-w', coins: () => '.tiles .tile.take, .tiles .tile.give, .pbar .barcoin',
    'tab-regalia': () => (L.big ? '.shopcol > .shop.rg' : '.abar .sq[data-d="regalia"]'), 'tab-market': () => (L.big ? '.shopcol > .shop.mk' : '.abar .sq[data-d="market"]'),
    hire: () => '.buyb.ok[data-act="hire"]', end: () => '.abar .primary[data-act="end"]', opp: () => ':scope > .center',
  };
  function placeSpot(b, hint) {
    let sp = b.querySelector(':scope > .spot');
    const sel = hint && hint.dim && hint.focus && coachMin !== hint.id && SPOT[hint.focus] ? SPOT[hint.focus]() : '';
    const els = sel ? [...b.querySelectorAll(sel)].filter(e => e.offsetParent !== null && e.getBoundingClientRect().width > 0) : [];
    if (!els.length) { if (sp) sp.hidden = true; coachEl.classList.remove('low'); return; }
    if (!sp) { sp = document.createElement('div'); sp.className = 'spot'; sp.setAttribute('aria-hidden', 'true'); b.appendChild(sp); }
    const br = b.getBoundingClientRect(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const e of els) { const r = e.getBoundingClientRect(); x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); }
    const pad = 7, st = `left:${Math.round(x0 - br.left - pad)}px;top:${Math.round(y0 - br.top - pad)}px;width:${Math.round(x1 - x0 + 2 * pad)}px;height:${Math.round(y1 - y0 + 2 * pad)}px`;
    if (sp.dataset.st !== st) { if (sp.hidden) sp.style.transition = 'none'; sp.dataset.st = st; sp.style.cssText = st + (sp.hidden ? ';transition:none' : ''); if (sp.hidden) { void sp.offsetWidth; sp.style.transition = ''; } }
    sp.hidden = false;
    // подсказка лежит сверху; если подсвечено только то, что под ней (плитка соперника), она опускается на середину стола
    const cz = b.querySelector(':scope > .center').getBoundingClientRect();
    coachEl.classList.toggle('low', y1 <= cz.top + 4 && y0 > b.querySelector(':scope > .pbar.foe').getBoundingClientRect().bottom - 4);
  }

  // ---------- рендер ----------
  function schedule() { if (rq) return; rq = true; requestAnimationFrame(() => { rq = false; render(); }); }
  function isMyTurn() { return !!S && ME !== null && S.cur === ME && S.winner === null && !coverReq && (guest() ? !!NETG.w && NETG.w.turn === ME : !!endTurnResolve); }
  function viewIdx() { return ME !== null ? ME : S.cur; }

  const ORD = { home: 0, setup: 1, join: 1, lobby: 2, game: 3 };
  let lastAppHtml = null, lastBarHtml = null;
  // экраны с полями ввода и выпадающими списками перерисовываем, только если что-то изменилось
  function setApp(html) { if (html !== lastAppHtml) { app.innerHTML = html; lastAppHtml = html; } }
  function setBar(html) { if (html !== lastBarHtml) { barEl.innerHTML = html; lastBarHtml = html; } }
  // ---------- бережная перерисовка (v8.1) ----------
  // Экран партии не пересоздаётся целиком: живые узлы правятся по новой разметке (morph). Картинки не мигают,
  // анимации не начинаются заново, лента карт не сбрасывает прокрутку, нажатие не теряется.
  const morphTpl = document.createElement('template');
  const keyOf = (n) => { const d = n.dataset; if (!d) return ''; return d.k || `${d.act || ''}|${d.id || d.key || d.uid || d.i || d.tab || d.kind || d.n || d.s || ''}`; };
  const sameNode = (a, b) => a.nodeType === b.nodeType && (a.nodeType !== 1 || (a.tagName === b.tagName && keyOf(a) === keyOf(b)));
  function morphAttrs(a, b) {
    const keepStyle = a.hasAttribute('data-k') && a.hasAttribute('style'); // идущая анимация: её задержку не трогаем
    for (let i = a.attributes.length - 1; i >= 0; i--) { const n = a.attributes[i].name; if (!b.hasAttribute(n) && !(keepStyle && n === 'style')) a.removeAttribute(n); }
    for (let i = 0; i < b.attributes.length; i++) { const { name, value } = b.attributes[i]; if (keepStyle && name === 'style') continue; if (a.getAttribute(name) !== value) a.setAttribute(name, value); }
    if ((a.tagName === 'BUTTON' || a.tagName === 'INPUT') && a.disabled !== b.hasAttribute('disabled')) a.disabled = b.hasAttribute('disabled');
  }
  function morphNode(a, b) {
    if (a.nodeType !== 1) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
    morphAttrs(a, b);
    morphKids(a, b);
  }
  function morphKids(a, b) {
    let ac = a.firstChild, bc = b.firstChild;
    while (bc) {
      const bn = bc.nextSibling;
      if (!ac) { a.appendChild(bc); bc = bn; continue; }
      if (sameNode(ac, bc)) { morphNode(ac, bc); ac = ac.nextSibling; bc = bn; continue; }
      // карта перевернулась до конца: снять обёртку переворота, саму карту оставить
      if (ac.nodeType === 1 && ac.classList.contains('pflip') && bc.nodeType === 1) {
        const face = ac.querySelector(':scope > .pf-in > .pf-face > *');
        if (face && sameNode(face, bc)) { a.replaceChild(face, ac); morphNode(face, bc); ac = face.nextSibling; bc = bn; continue; }
      }
      // узел с ключом мог сдвинуться (карту сыграли из начала руки) — ищем его чуть дальше
      if (bc.nodeType === 1 && keyOf(bc) !== '|') {
        let m = ac.nextSibling, found = null;
        for (let k = 0; m && k < 12; k++, m = m.nextSibling) if (sameNode(m, bc)) { found = m; break; }
        if (found) { a.insertBefore(found, ac); morphNode(found, bc); bc = bn; continue; }
      }
      // перед живым узлом вставили новый (строка в итоге броска, карта в начале ряда) — вставить, живой не трогать
      if (ac.nodeType === 1 && keyOf(ac) !== '|') {
        let m = bn, ahead = false;
        for (let k = 0; m && k < 12; k++, m = m.nextSibling) if (sameNode(ac, m)) { ahead = true; break; }
        if (ahead) { a.insertBefore(bc, ac); bc = bn; continue; }
      }
      const next = ac.nextSibling;
      a.replaceChild(bc, ac);
      ac = next; bc = bn;
    }
    while (ac) { const n = ac.nextSibling; a.removeChild(ac); ac = n; }
  }
  function morphInto(el, html) { morphTpl.innerHTML = html; morphKids(el, morphTpl.content); }
  const ANC = { picks: 0, fixes: 0, none: 0 }; // привязка прокрутки не нужна: экран партии не прокручивается
  function render() {
    if (updNew) updTick();
    const v = S ? 'game' : view;
    if (v !== lastView) {
      app.classList.remove('enter-fwd', 'enter-back');
      if (lastView !== null && !reduceMotion()) { void app.offsetWidth; app.classList.add(ORD[v] >= ORD[lastView] ? 'enter-fwd' : 'enter-back'); }
      lastView = v;
      window.scrollTo(0, 0);
    }
    document.body.dataset.view = v;
    if (v !== 'join' && v !== 'lobby') { lastAppHtml = null; lastBarHtml = null; }
    renderCover();
    if (!S) { tabEl.hidden = true; coachEl.hidden = true; document.body.classList.remove('coaching'); hovHide(); popRoot.innerHTML = ''; document.body.classList.remove('staging'); if (view === 'setup') renderSetup(); else if (view === 'join') renderJoin(); else if (view === 'lobby' && NETG) renderLobby(); else renderHome(); return; }
    app.classList.remove('start-mode');
    trackFlips();
    const p = S.players[viewIdx()];
    // всплывающие изменения золота у всех игроков; близкие по времени складываются
    const now = performance.now();
    for (const q of S.players) {
      const sg = shownGold(q);
      if (goldSeen[q.i] != null && goldSeen[q.i] !== sg) {
        const dd = sg - goldSeen[q.i], pp = pops[q.i];
        pops[q.i] = pp && now - pp.t < 1400 ? { d: pp.d + dd, t: now } : { d: dd, t: now };
      }
      goldSeen[q.i] = sg;
    }
    const hint = coachHint(p);
    if (hint && coachMin && coachMin !== hint.id) coachMin = null; // новый шаг обучения — подсказка раскрывается снова
    barEl.hidden = true; tabEl.hidden = true;
    document.body.classList.toggle('coins-on', myCoins().length > 0);
    renderBoard(p, hint);
  }
  // ---------- одно устройство на несколько человек: экран «передайте устройство» ----------
  function renderCover() {
    const c = S && coverReq;
    document.body.classList.toggle('covered', !!c);
    if (!c) { if (!coverEl.hidden) { coverEl.hidden = true; coverEl.innerHTML = ''; coverEl.dataset.k = ''; } return; }
    const q = S.players[c.p], h = H(q);
    let kicker = 'Передайте устройство', title = `Ход: ${h.name}`, sub, btn = 'Я здесь — открыть карты';
    if (c.why === 'turn') sub = `Остальные, не подглядывайте: сейчас откроются карты ${esc(h.gen)}.`;
    else if (c.why === 'ask') {
      title = `Решение: ${h.name}`; btn = 'Я здесь — показать';
      sub = c.q && c.q.type === 'bribe' && S.players[c.q.from] ? `${esc(H(S.players[c.q.from]).short)} вымогают у вас владение. Решите, откупаться ли.` : c.q && c.q.type === 'buyoff' && S.players[c.q.from] ? `${esc(H(S.players[c.q.from]).short)} подослали к вам шпиона. Решите, откупаться ли.` : 'Нужно ваше решение.';
    } else { kicker = 'Верните устройство'; sub = `Ход ${esc(h.gen)} продолжается.`; btn = 'Продолжить ход'; }
    const k = `${c.p}|${c.why}`;
    if (coverEl.dataset.k !== k) {
      coverEl.innerHTML = `<div class="cv-in" role="dialog" aria-modal="true" aria-label="${esc(title)}"><img class="cv-cr" src="${IMG(`icons/h_${q.house}.svg`)}" alt=""><span class="kicker">${kicker}</span><h2>${esc(title)}</h2><p>${sub}</p><button class="btn primary big" data-act="cover-ok"><span>${btn}</span></button></div>`;
      coverEl.dataset.k = k;
    }
    coverEl.hidden = false;
  }
  // ---------- общий стол: правила «Зависть» и «Народная поддержка» ----------
  // «Зависть» и «Народная поддержка» — правило на виду, с тем, кого оно касается прямо сейчас
  function balanceCards() {
    const cnt = S.players.map(E.regCount), max = Math.max(...cnt), lead = cnt.filter(c => c === max).length === 1 && max > 0 ? cnt.indexOf(max) : -1;
    const second = lead >= 0 ? Math.max(...cnt.filter((c, i) => i !== lead)) : 0;
    const tax = lead >= 0 ? max - second : 0;
    const sup = S.players.filter(q => max - cnt[q.i] >= R.supportGap);
    const nmS = (q) => (q.i === ME && !WATCH ? 'вы' : esc(H(q).short));
    return [
      pslot(pcard('rule', 'envy'), `<span class="pmeta rc-n">${lead >= 0 && tax > 0 ? `сейчас: ${nmS(S.players[lead])} — ${tax}🪙` : 'сейчас никто не платит'}</span>`),
      pslot(pcard('rule', 'support'), `<span class="pmeta rc-n">${sup.length ? `сейчас: ${sup.map(nmS).join(', ')}` : 'сейчас никто'}</span>`),
    ];
  }
  // все карты двора игрока: колода, сброс, рука, сыгранные и замыслы — где какая лежит, не показываем
  function courtOf(q) {
    const all = [...q.deck, ...q.discard, ...q.hand, ...q.inPlay, ...q.plots.map(pl => pl.id)];
    const n = {}; for (const id of all) n[id] = (n[id] || 0) + 1;
    return Object.entries(n).sort((a, b) => (D.COURT[a[0]].cost - D.COURT[b[0]].cost) || a[0].localeCompare(b[0]));
  }
  const estGuard = (q) => q.estates.reduce((a, e) => a + ((D.ESTATES[e.id] || {}).guard || 0), 0);
  // ---------- итог броска: кто что получил ----------
  const NOFIRE = { craft: 'Ремесло платит только в свой ход', raid: 'Набег не срабатывает в свой ход', hold: 'Твердыня платит только в свой ход', bad: 'проклятие действует всегда, от кубика не зависит' };
  function rollParts(rv, q) {
    const gain = rv.ev.filter(x => x.to === q.i && x.amt > 0);
    const loss = rv.ev.filter(x => x.from === q.i && x.amt > 0);
    const zero = rv.ev.filter(x => x.to === q.i && x.zero && x.t !== 'bad');
    const badz = rv.ev.filter(x => x.from === q.i && x.t === 'bad' && x.zero);
    const plots = rv.plots.filter(x => x.p === q.i && x.gold > 0);
    const chips = [];
    // одинаковые срабатывания (два Постоялого двора одного соперника) — одной плашкой «×2»
    const grp = (list, key) => { const m = new Map(); for (const x of list) { const k = key(x); const g = m.get(k); if (g) { g.amt += x.amt; g.n++; } else m.set(k, { ...x, n: 1 }); } return [...m.values()]; };
    const xn = (x) => (x.n > 1 ? ` ×${x.n}` : '');
    const tap = (x, owner) => (x.id && D.ESTATES[x.id] ? ` data-act="info-estate" data-id="${x.id}" data-o="${owner}" role="button" tabindex="0"` : '');
    for (const x of grp(gain, x => `${x.src}|${x.from}`)) chips.push(`<span class="c g"${tap(x, x.to)}>+${x.amt} ${esc(x.src)}${xn(x)}${x.from != null ? ` <i>у ${esc(x.from === ME ? 'вас' : E.shortG(S.players[x.from]))}</i>` : ''}</span>`);
    for (const x of plots) chips.push(`<span class="c g">+${x.gold} замысел «${esc(D.COURT[x.id].name)}»</span>`);
    for (const x of grp(loss, x => `${x.src}|${x.to}`)) chips.push(`<span class="c l"${tap(x, x.t === 'bad' ? x.from : x.to != null ? x.to : x.from)}>−${x.amt} ${esc(x.src)}${xn(x)} <i>${x.to == null ? 'в банк' : esc(x.to === ME ? '→ вам' : E.shortG(S.players[x.to]))}</i></span>`);
    for (const x of zero) chips.push(x.blight ? `<span class="c z">${esc(x.src)}: Неурожай — без дохода</span>` : x.bandit ? `<span class="c z">${esc(x.src)}: Разбойничий стан — не срабатывает</span>` : `<span class="c z">${esc(x.src)}: у ${esc(x.from === ME ? 'вас' : E.shortG(S.players[x.from]))} нет золота</span>`);
    for (const x of badz) chips.push(`<span class="c l">⬛ ${esc(x.src)}${x.block === 'hire' ? ': в этот ход без найма' : x.blight ? ': Земли и Ремёсла молчат' : ': золота нет'}</span>`);
    const net = gain.reduce((a, x) => a + x.amt, 0) + plots.reduce((a, x) => a + x.gold, 0) - loss.reduce((a, x) => a + x.amt, 0);
    return { chips, net, any: chips.length > 0 };
  }
  function missedOf(rv, q) {
    // ваши владения с этим числом, которые промолчали, — и почему
    const fired = new Set(rv.ev.map(x => x.uid));
    const own = rv.a === q.i, m = E.mods(S, q);
    return q.estates.filter(e => { const d = D.ESTATES[e.id]; return d.n.includes(rv.r) && !fired.has(e.uid) && ((d.t === 'craft' && !own && !m.craftAny) || (d.t === 'raid' && own && !m.redOwn) || (d.t === 'hold' && !own)); })
      .map(e => { const d = D.ESTATES[e.id]; return `${esc(d.name)} — ${NOFIRE[d.t].toLowerCase()}`; });
  }
  function rollHtml(rv, stale, plain) {
    if (!rv || !S.players[rv.a]) return '';
    const N = S.players.length;
    let order = Array.from({ length: N }, (_, k) => S.players[(rv.a + k) % N]);
    if (ME !== null) order = order.filter(q => q.i === ME).concat(order.filter(q => q.i !== ME));
    const rows = [];
    for (const q of order) {
      const r = rollParts(rv, q);
      if (!r.any && q.i !== ME) continue;
      const cls = r.net > 0 ? 'pos' : r.net < 0 ? 'neg' : '';
      rows.push(`<div class="rr ${q.i === ME ? 'me' : ''}"><span class="rp">${pname(q)}</span><span class="rnet ${cls}">${r.net > 0 ? '+' : r.net < 0 ? '−' : '±'}${Math.abs(r.net)}🪙</span><span class="rd">${r.chips.join('')}</span></div>`);
    }
    const miss = ME !== null ? missedOf(rv, S.players[ME]) : [];
    const head = `<div class="rh2">Итог броска ${rv.r}</div>`;
    const any = order.some(q => rollParts(rv, q).any);
    const body = any ? rows.join('') : `<div class="rr none">Ни одно владение не принесло золота</div>`;
    return `<div class="rollsum${stale ? ' stale' : ''}">${head}${body}${miss.length ? `<div class="rmiss">Промолчали ваши: ${miss.join('; ')}</div>` : ''}</div>`;
  }
  function effBits(x) {
    const b = [];
    if (x.gold > 0) b.push(`+${x.gold}🪙`);
    for (const k in x.temp || {}) b.push(`+${x.temp[k]}${D.SYM[k]} на ход`);
    if (x.cards > 0) b.push(`+${x.cards} ${D.plural(x.cards, 'карта', 'карты', 'карт')}`);
    return b.join(', ');
  }
  function recHtml(force) {
    if (!lastRec || !S.players[lastRec.p] || ME === null || WATCH || lastRec.p === ME) return '';
    if (!force && !nextReq && S.cur !== lastRec.p && S.players[S.cur] && !S.players[S.cur].isBot && isMyTurn() && S.players[S.cur].turn.rolled) return '';
    const rec = lastRec, q = S.players[rec.p];
    const items = [];
    if (rec.dawn) {
      const d = rec.dawn, b = [];
      if (d.gain) b.push(`+${d.gain}🪙 (${esc(d.src.join(', '))})`);
      if (d.support) b.push(`+${d.support}🪙 Народная поддержка`);
      if (d.envy) b.push(`−${d.envy}🪙 Зависть`);
      if (d.tribute && d.tribute.length) b.push(`дань: +${d.tribute.length}🪙${d.tribute.includes(ME) ? ', в том числе <b class="me">1🪙 от вас</b>' : ''}`);
      if (b.length) items.push(['Начало хода', b.join(' · ')]);
    }
    for (const x of rec.plots) items.push(['Замысел', `«${esc(D.COURT[x.id].name)}» сработал${x.gold > 0 ? `: +${x.gold}🪙` : ''}`]);
    if (rec.plays.length) {
      // одинаковые розыгрыши подряд — одной строкой: «Подать» ×3 +3🪙
      const g = [];
      for (const x of rec.plays) {
        const e = effBits(x), last = g[g.length - 1];
        if (last && last.id === x.id && last.ally === !!x.ally && last.e1 === e) { last.n++; continue; }
        g.push({ id: x.id, ally: !!x.ally, e1: e, n: 1, x });
      }
      items.push(['Сыграли', g.map(y => { const e = y.n > 1 ? effBits({ gold: (y.x.gold || 0) * y.n, cards: (y.x.cards || 0) * y.n, temp: Object.fromEntries(Object.entries(y.x.temp || {}).map(([k, v]) => [k, v * y.n])) }) : y.e1; return `«${esc(D.COURT[y.id].name)}»${y.n > 1 ? ` ×${y.n}` : ''}${y.ally ? ' со свитой' : ''}${e ? ` <span class="ef">${e}</span>` : ''}`; }).join('<br>')]);
    }
    if (rec.plotsSet) items.push(['Замыслы', `отложили ${D.cards(rec.plotsSet)} рубашкой вверх`]);
    if (rec.roll) {
      const parts = [];
      const N = S.players.length;
      for (let k = 0; k < N; k++) {
        const pl = S.players[(rec.roll.a + k) % N];
        const r = rollParts(rec.roll, pl);
        if (!r.any) continue;
        const who = pl.i === ME ? '<b class="me">вы</b>' : esc(H(pl).short);
        parts.push(`${who} ${r.net > 0 ? '+' : r.net < 0 ? '−' : '±'}${Math.abs(r.net)}🪙`);
      }
      items.push([`Бросок ${rec.roll.r}`, parts.length ? parts.join(', ') : 'ни одно владение не сработало']);
    }
    for (const x of rec.buys) items.push(['Купили', `${x.estate ? 'владение' : 'карту двора'} «${esc((x.estate ? D.ESTATES : D.COURT)[x.id].name)}» за ${x.price}🪙`]);
    for (const x of rec.regs) { const def = D.BAN[x.id]; items.push(['Знамя', `${TIER_NAME[def.tier]} «${esc(D.regName(def))}» за ${x.cost}🪙`]); }
    if (rec.notes.length) items.push(['События', rec.notes.map(t => esc(t).replace(/(\S+ \S+ \(вы\)|\S+ \(вы\)|\(вы\))/g, '<b class="me">$1</b>')).join('<br>')]);
    if (!rec.plays.length && !rec.buys.length && !rec.regs.length && !rec.roll) items.push(['', 'Ничего не сделали']);
    const dg = q.gold - rec.gold0;
    return `<div class="tsum${nextReq ? ' wait' : ''}"><div class="ts-h"><img class="sgi" src="${IMG(`icons/h_${q.house}.svg`)}" alt=""><b>Ход ${esc(E.shortG(q))}</b><span class="ts-g">🪙 ${rec.gold0} → ${q.gold}${dg ? ` <i class="${dg > 0 ? 'pos' : 'neg'}">${dg > 0 ? '+' : '−'}${Math.abs(dg)}</i>` : ''}</span></div>
      <dl class="ts-l">${items.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div>`;
  }
  function popHtml(i, cls = 'gpop') {
    const pp = pops[i];
    if (!pp || !pp.d) return '';
    const el = performance.now() - pp.t;
    if (el > 2600) return '';
    return `<span class="${cls} ${pp.d < 0 ? 'neg' : ''}" data-k="pop:${i}:${Math.round(pp.t)}:${pp.d}" style="animation-delay:-${Math.round(el)}ms">${pp.d > 0 ? '+' : '−'}${Math.abs(pp.d)}</span>`;
  }
  // места при дворе (модуль «Придворные»): кто сидит и что даёт; пустое место — подсказка
  // ритуалы (v10.16): текущий — с отметками и кнопками жертвы и милостыни; доступные — «Начать»; готовые чудеса
  function ritualHtml(p, mine, my) {
    const ids = E.ritualsOf(S, p), cur = p.ritual, miracles = p.miracles || [];
    if (!ids.length && !miracles.length) return '';
    const on = E.miraclesOn(p);
    let h = `<div class="sec-h"><h3>✨ Ритуалы</h3><span>5 условий → чудо</span></div>`;
    if (cur) {
      const pr = E.ritualProgress(S, p) || [], W = D.RITUALS[cur.id], n = cur.marks.filter(Boolean).length;
      const row = (x) => {
        let st;
        if (x.done) st = '<span class="rst ok">✓</span>';
        else if (x.act) st = mine ? `<button class="btn small ${x.why || !my ? '' : 'primary'}" data-act="ritact" data-i="${x.i}" ${!my || x.why || busy || adjustReq ? 'disabled' : ''}>${!my ? 'в свой ход' : x.why ? esc(x.why) : x.k === 'trash' ? 'Принести' : 'Подать'}</button>` : '<span class="rst">ещё нет</span>';
        else if (x.k === 'abst') st = `<span class="rst${x.viol ? ' bad' : ''}">${x.cur} из ${x.need}${x.viol ? ' · сейчас нарушено' : ''}</span>`;
        else if (x.cur != null) st = `<span class="rst">${x.cur} из ${x.need}</span>`;
        else st = '<span class="rst">ещё нет</span>';
        return `<li class="${x.done ? 'done' : ''}"><span class="rk">${esc(x.name)}</span><span class="rt">${esc(x.t)}</span>${st}</li>`;
      };
      h += `<div class="ritw">${pcard('ritual', cur.id)}<div class="ritp"><p class="rh"><b>${esc(W.name)}</b> · отметок ${n} из ${W.steps.length}</p><ol class="ritl">${pr.map(row).join('')}</ol>`
        + `${E.cursed(p, 'relic') ? '<p class="note">⬛ Проклятая реликвия: ритуал стоит — отметки не ставятся.</p>' : '<p class="muted rnote">Возьмёте грех — отметки сгорят.</p>'}</div></div>`;
    }
    if (mine) {
      const free = ids.filter(id => !miracles.includes(id) && (!cur || cur.id !== id));
      if (free.length) h += `<div class="pgrid mini">${free.map(id => { const why = my ? E.ritualBlock(S, p, id) : 'Начать — в свой ход'; return pslot(pcard('ritual', id), `<button class="btn small ${why ? '' : 'primary'}" data-act="ritstart" data-id="${id}" ${why || busy || adjustReq ? 'disabled' : ''}>${why ? esc(why) : cur ? 'Начать вместо текущего' : '✨ Начать ритуал'}</button>`); }).join('')}</div>${cur ? '<p class="note">Начнёте другой ритуал — отметки текущего сгорят.</p>' : ''}`;
    }
    if (miracles.length) {
      const quiet = (p.sins || []).length ? 'молчат, пока на вас грех' : E.cursed(p, 'relic') ? 'молчат: Проклятая реликвия' : 'действуют до конца игры';
      h += `<div class="sec-h"><h3>🌟 Чудеса</h3><span>${quiet}</span></div><div class="pgrid mini">${miracles.map(id => pcard('ritual', id, { cls: on.includes(id) ? 'built' : 'dim', badge: `<span class="pcb tag">${on.includes(id) ? '🌟 чудо' : 'молчит'}</span>` })).join('')}</div>`;
    }
    return h;
  }
  function seatsHtml(p, mine) {
    if (!modOn('seats')) return '';
    const mx = E.seatMax(S, p), list = p.seats || [];
    const head = `<div class="sec-h"><h3>🪑 При дворе</h3><span>${list.length}/${mx} · действуют постоянно</span></div>`;
    const cards = list.map(id => pslot(pcard('court', id, { seatOn: true }), `<span class="pmeta">${esc(D.COURT[id].stext)}</span>`));
    for (let k = list.length; k < mx; k++) cards.push(pslot(`<div class="seat-empty"><b>Свободное место</b><span>${mine ? 'Карту с блоком «При дворе» можно не сыграть, а посадить сюда кнопкой «🪑 Ко двору».' : 'пусто'}</span></div>`));
    return head + `<div class="pgrid mini">${cards.join('')}</div>`;
  }
  // что осталось несделанным — подсказка на кнопке «Точно завершить?»
  // есть ли на что потратить действие: что-то на рынке или знамя по карману
  function canAfford(p) {
    try {
      const est = (id) => E.canOwnEstate(p, id) && E.marketPrice(S, p, D.ESTATES[id].cost, false) <= p.gold;
      if (S.estateRow.some(est) || (S.holdRow || []).some(est)) return true;
      if (S.courtRow.some(id => E.marketPrice(S, p, D.COURT[id].cost, true) <= p.gold)) return true;
      for (const tr of ['v', 'l', 'g']) {
        if (!needT(tr) || tierList(p, tr).length >= needT(tr)) continue;
        const ids = (S[tr + 'Row'] || []).concat(tr === 'l' && p.heir ? [p.heir] : []);
        if (ids.some(id => !E.hireBlock(S, p, id) && E.banCost(S, p, id).total <= p.gold)) return true;
      }
    } catch (e) { return true; }
    return false;
  }
  // v10.17: что ещё можно сделать в этот ход — для подсветки, строки «Ещё можно» и вопроса при «Завершить ход».
  // hard — о чём переспросить при завершении хода; мягкие (принять веру, начать ритуал) — только подсветка и строка
  function extrasOf(p) {
    if (!S || !p || !p.turn || WATCH || !isMyTurn() || S.players[S.cur] !== p) return [];
    const out = [], R0 = p.ritual;
    if (modOn('faith')) {
      const many = (p.faiths || []).length > 1; // s — короткая подпись для строки хода (лёжа)
      for (const f of p.faiths || []) if (!E.riteBlock(S, p, f)) out.push({ k: 'rite', f, t: many ? `обряд «${D.FAITHS[f].rite.name}»` : 'обряд', s: many ? `обряд ${D.FAITHS[f].icon}` : 'обряд', hard: true });
      if (R0 && (E.ritualProgress(S, p) || []).some(x => x.act && !x.done && !x.why)) out.push({ k: 'ritual', t: 'жертва/милостыня', s: 'ритуал', hard: true });
      if (!R0 && E.ritualsOf(S, p).some(id => !E.ritualBlock(S, p, id))) out.push({ k: 'ritstart', t: 'начать ритуал', s: 'ритуал' });
      if (!(p.faiths || []).length || (E.faithMax && (p.faiths || []).length < E.faithMax(S, p))) if ((S.faithRow || []).some(f => !(p.faiths || []).includes(f) && !E.canAdopt(S, p, f))) out.push({ k: 'adopt', t: 'принять веру', s: 'вера' });
    }
    if (E.fetchLeft(S, p) > 0 && E.discardOf(p).length) out.push({ k: 'fetch', t: 'взять из сброса', s: 'из сброса', hard: true });
    if (p.turn.rolled && E.buysLeft(S, p) <= 0 && freeBuyOk(p)) out.push({ k: 'fair', t: 'покупка без действия', s: 'покупка', hard: true });
    return out;
  }
  // есть ли покупка без действия («Ярмарка»), которая по карману прямо сейчас
  function freeBuyOk(p) {
    const rows = [['estate', S.estateRow], ['court', S.courtRow], ['hold', S.holdRow || []]];
    for (const [src, row] of rows) for (const id of row) {
      const isE = src !== 'court', def = isE ? D.ESTATES[id] : D.COURT[id];
      if (!def || (isE && !E.canOwnEstate(p, id)) || (!isE && def.sin)) continue;
      if (E.fairOf(S, p, src, id) && E.marketPrice(S, p, def.cost, !isE) <= p.gold) return true;
    }
    return false;
  }
  function endLeft(p) {
    const bits = [];
    const cards = p.hand.filter(id => !D.COURT[id].bad).length;
    if (cards) bits.push(`в руке ${cards} ${D.plural(cards, 'карта', 'карты', 'карт')}`);
    if (E.buysLeft(S, p) > 0 && canAfford(p)) bits.push('действие не потрачено');
    const ex = extrasOf(p).filter(x => x.hard);
    if (ex.length) bits.push(`ещё можно: ${ex.map(x => x.t).join(', ')}`);
    return bits.join(' · ');
  }
  // расшифровка дохода: «2 + 2 за пару + 1 Хаген = 5» (первое число — сама карта, дальше — кто добавил)
  // доход начала хода: «за провинции +3» → «+3 за провинции», «постоянный доход +6» → «+6 каждый ход»
  const whyTxt = (w) => String(w || '').split(', ').map(t => { const m = /^(.*?)\s*\+(\d+)$/.exec(t); return m ? `+${m[2]} ${m[1] === 'постоянный доход' ? 'каждый ход' : m[1]}` : t; }).join(', ');
  // n — сколько одинаковых карт в стопке сработало так же: «(1 + 1 Медведи) × 2 = 4»
  const fmtParts = (parts, n = 1) => {
    const xs = parts || []; if (!xs.length) return '';
    const NB = '\u00a0', tot = xs.reduce((a, x) => a + x.v, 0);
    const lab = (l) => (l === 'пара' ? 'за пару' : l || '');
    const body = xs.map((x, i) => (i === 0 ? (x.l ? `${x.v} (${lab(x.l)})` : `${x.v}`) : `${x.v >= 0 ? '+' : '−'}${NB}${Math.abs(x.v)}${x.l ? NB + lab(x.l) : ''}`)).join(' ');
    if (n > 1) return `(${body})${NB}×${NB}${n} =${NB}${tot * n}`;
    return xs.length > 1 ? `${body} =${NB}${tot}` : body;
  };
  function incCaption(uids) {
    const rv = rvShown();
    if (!rv || !rv.ev) return '';
    const xs = rv.ev.filter(x => x.amt > 0 && uids.includes(x.uid) && x.parts && (x.parts.length > 1 || x.parts[0].l));
    const cnt = new Map(); for (const x of xs) { const k = JSON.stringify(x.parts); cnt.set(k, (cnt.get(k) || 0) + 1); }
    return [...cnt.entries()].map(([k, n]) => esc(fmtParts(JSON.parse(k), n))).join('<br>');
  }
  // правила значков: Подаяния 🕯, Знания 📜, Торг ⚖️ — что дают сейчас и сколько до следующего шага
  function ruleTiles(p) {
    const pr = E.prod(S, p), out = [];
    const tile = (key, ico, name, n, step, now, unit, nextTxt, coins) => {
      const k = Math.floor(n / step), left = step - (n % step);
      const on = k > 0, pend = coins && coins.length;
      const sum = pend ? coins.reduce((a, c) => a + c.amt, 0) : 0;
      return `<div class="rtile${on ? ' on' : ''}${pend ? ' coin-take' : ''}"${pend ? ` role="button" tabindex="0" aria-label="${name}: забрать ${sum}" data-act="coin-card" data-coins="${coins.map(c => c.k).join(',')}"` : ''}>
        ${pend ? `<span class="pcb coin">+${sum}🪙</span>` : ''}<span class="rt-h">${ico} <b>${name}</b></span>
        <span class="rt-v">${on ? now(k) : 'пока ничего'}</span>
        <span class="rt-n">у вас ${ico}${n}, каждые ${ico}${step} — ${unit}</span>
        <span class="rt-n">ещё ${ico}${left} — будет ${nextTxt(k + 1)}</span></div>`;
    };
    const cards = (k) => `${k} ${D.plural(k, 'карта', 'карты', 'карт')}`;
    if (R.faithStep) out.push(tile('faith', '🕯', 'Подаяния', pr.faith, R.faithStep, (k) => `+${k}🪙 в начале хода`, '+1🪙', (k) => `+${k}🪙`, cardCoins(c => c.ck === 'rule:faith')));
    if (R.sciStep) out.push(tile('sci', '📜', 'Знания', pr.sci, R.sciStep, (k) => `+${cards(k)} в руку (добираете ${E.handSize(S, p)})`, '+1 карта', (k) => `+${cards(k)}`));
    if (R.tradeStep) out.push(tile('trade', '⚖️', 'Торг', pr.trade, R.tradeStep, (k) => `рынок на ${k}🪙 дешевле`, 'рынок −1🪙', (k) => `−${k}🪙`));
    return out.join('');
  }
  // сколько принесло каждое владение (по uid) на последнем броске
  function hitsOf(rv) {
    const h = {};
    if (!rv) return h;
    for (const x of rv.ev) if (x.amt > 0) h[x.uid] = (h[x.uid] || 0) + x.amt; else if (x.zero && h[x.uid] == null) h[x.uid] = 0;
    return h;
  }
  // ===================== v10: экран партии — один неподвижный стол =====================
  // Соперник сверху, я снизу, посередине — кубики и итог броска. Страница не прокручивается: зоны лежат сеткой,
  // их размеры считает layoutBoard() и они не зависят от содержимого. Рынок и знамёна — листом поверх стола.
  let selCard = null;   // выбранная карта руки: { i, id }
  let drawer = null;    // лист поверх стола: 'market' | 'regalia'
  let oppFocus = null;  // чей стол показан сверху (когда соперников несколько)
  let hintOn = true;    // строка-подсказка «что делать сейчас» (настройки)
  let coachMin = null;  // подсказка обучения свёрнута (id шага)
  let L = { key: '', cw: 86, ch: 118, hw: 369, land: false };
  let zoneHtml = {};
  const seenUid = new Map(); // «игрок:владение» → когда впервые увидели на столе: новая плитка «приезжает»
  let seenInit = false;
  let shownUids = new Set(); // владения, чьи плитки сейчас на экране (монета лежит на плитке или на планке игрока)
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
  const artOf = (id) => IMG((typeof ART !== 'undefined' && ART[id]) || `art/${id}.svg`);
  const crestOf = (q) => IMG(`icons/h_${q.house}.svg`);
  const sdie = (v, cls = '') => (!v ? `<span class="sdie blank ${cls}" aria-hidden="true"></span>` : `<span class="sdie ${cls}" role="img" aria-label="${v}">${pipsHtml(v)}</span>`);
  // эффект карты значками: «+2 [золото]», «+1 [карта]»; эффект, который значками не передать, — «✦» (читать на крупной карте)
  function miniChips(list, max = 3, cls = '') {
    const out = [];
    let txt = false;
    for (const x of list || []) {
      const icons = (Array.isArray(x.i) ? x.i : x.i ? [x.i] : []).slice(0, 2).map(gico).join('');
      const v = x.v ? String(x.v).replace(/🪙/g, '') : '';
      const m = `${x.pre ? gico(x.pre) : ''}${v ? `<b>${esc(v)}</b>` : ''}${icons}${x.x ? `<i>×</i>${gico(x.x)}` : ''}`;
      if (m) out.push(`<span${cls ? ` class="${cls}"` : ''}>${m}</span>`);
      else if (!txt) { txt = true; out.push(`<span class="tx${cls ? ' ' + cls : ''}">✦</span>`); }
    }
    return out.slice(0, max).join('');
  }
  const roleCls = (c) => (c.sin ? 'r-sin' : c.scheme ? 'r-bad' : c.role ? 'r-' + c.role : ''); // козни — тёмные, как проклятия; грех — тёмно-красный
  const roleName = (c) => (c.sin ? 'Грех' : c.scheme ? 'Козни' : c.role ? D.ROLES[c.role].name : c.start ? 'Стартовая' : 'Без роли');

  // ---------- размеры зон ----------
  // Раскладки: port — телефон стоя; land — телефон боком (столы слева, рука справа);
  // tabp — планшет стоя (слева стол, справа рынок над знамёнами); wide — планшет лёжа и ноутбук (слева рынок и знамёна, справа стол).
  function layoutBoard(b) {
    const W0 = app.clientWidth, H0 = app.clientHeight;
    if (!W0 || !H0) return;
    const key = `${W0}x${H0}`;
    if (key === L.key) return;
    const mode = W0 > H0 * 1.25 && H0 < 560 ? 'land' : W0 >= 1000 && H0 >= 600 && W0 > H0 ? 'wide' : W0 >= 700 && H0 >= 820 ? 'tabp' : 'port';
    for (const m of ['land', 'wide', 'tabp']) b.classList.toggle(m, mode === m);
    const big = mode === 'wide' || mode === 'tabp', land = mode === 'land';
    const q = (s) => b.querySelector(':scope > ' + s);
    const ob = q('.pbar.foe'), mb = q('.pbar.own'), ab = q('.abar'), hz = q('.handz'), ot = q('.tiles.foe'), sc = q('.shopcol');
    const set = (k, v) => b.style.setProperty(k, (Math.round(v * 10) / 10) + 'px');
    const W = b.clientWidth;
    let tw, th, otw, oth, ch, rowsMine = 2, rowsOpp = 1, panelW = 0, panelH = 0;
    if (!land) {
      let tableW = W;
      if (mode === 'wide') { tableW = clampN(W * 0.37, 420, 580); panelW = (W - tableW) / 2; }
      else if (mode === 'tabp') { tableW = clampN(W * 0.54, 400, 520); panelW = W - tableW; }
      if (big) set('--shop-w', W - tableW);
      const H = H0 - ob.offsetHeight - mb.offsetHeight - ab.offsetHeight;
      tw = (tableW - 24 - 4 * 6) / 5; otw = (tableW - 24 - 5 * 5) / 6;
      // сколько рядов плиток: на планшете стоя — три своих и два соперника, если середине стола хватает места
      const fit = (ro, rm) => { const tt = Math.min(tw * 1.24, H * (rm > 2 ? 0.115 : 0.156)), oo = Math.min(otw * 1.24, H * (ro > 1 ? 0.09 : 0.13)), cc = Math.min(clampN(H * (mode === 'tabp' ? 0.165 : 0.2), 104, mode === 'tabp' ? 156 : 176), Math.max(104, (tableW - 48) / 3.7 / 0.725)) /* три карты и две стопки по краям помещаются в ряд */; return { tt, oo, cc, center: H - (rm * tt + (rm - 1) * 6 + 18) - (ro * oo + (ro - 1) * 5 + 18) - (cc + 24) }; };
      let f = fit(1, 2);
      if (mode === 'tabp') for (const [ro, rm] of [[2, 3], [1, 3]]) { const g = fit(ro, rm); if (g.center >= 170) { f = g; rowsOpp = ro; rowsMine = rm; break; } }
      th = f.tt; oth = f.oo; ch = f.cc;
      const MINC = 126;
      if (f.center < MINC) {
        let need = MINC - f.center;
        const d1 = Math.min(need, ch - 104); ch -= d1; need -= d1;
        if (need > 0) { const tot = 2 * th + oth, k = Math.max(0.58, (tot - need) / tot); th *= k; oth *= k; }
      }
      set('--h-ot', rowsOpp * oth + (rowsOpp - 1) * 5 + 18); set('--h-mt', rowsMine * th + (rowsMine - 1) * 6 + 18); set('--h-hand', ch + 24);
      if (big) { const cs = getComputedStyle(sc); panelH = sc.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0); }
    } else {
      const cs = getComputedStyle(ot), colW = ot.clientWidth - (parseFloat(cs.paddingLeft) || 12) - 12;
      const H = H0 - ob.offsetHeight, sb = parseFloat(getComputedStyle(q('.tiles.own')).paddingBottom) || 0;
      tw = (colW - 4 * 6) / 5; otw = (colW - 5 * 5) / 6;
      const room = H - 100 - (6 + 14 + sb) - 12; // середине стола — не меньше 100
      const a = clampN(room / (2 * tw + otw), 0.62, 1.24);
      th = tw * a; oth = otw * a;
      const mt = 2 * th + 6 + 14 + sb;
      set('--h-ot', oth + 12); set('--h-mt1', Math.max(0, mt - ab.offsetHeight)); set('--h-mt', mt);
      const hh = H0 - mb.offsetHeight - ab.offsetHeight, hw0 = hz.clientWidth;
      ch = clampN(Math.min(hh - 34, (hw0 - 24 - 62) / 2.7 / 0.725), 90, 210); // слева от руки — колода и сброс столбиком
    }
    const cw = ch * 0.725;
    // колода и сброс лежат по краям руки (на телефоне лёжа — столбиком слева)
    const pw = land ? 50 : clampN(cw * 0.5, 40, 60);
    set('--pw', pw);
    const mw = Math.min(132, ((big ? panelW : Math.min(W, land ? hz.clientWidth : W)) - 24 - 3 * 8) / 4);
    set('--tw', tw); set('--th', th); set('--otw', otw); set('--oth', oth); set('--cw', cw); set('--ch', ch); set('--mw', mw);
    b.style.setProperty('--lift', Math.round(ch * 0.2) + 'px');
    L = { key, cw, ch, hw: hz.clientWidth || W, land, mode, big, rowsMine, rowsOpp, panelW, panelH, mw, tw, th, otw, oth, pw, pstack: land };
    zoneHtml = {};
    setTimeout(layoutWatch, 1200); // если что-то не поместилось — запись в журнал для отчёта «Проверка устройства»
  }
  window.addEventListener('resize', () => { L.key = ''; if (S) schedule(); });
  window.addEventListener('orientationchange', () => { L.key = ''; if (S) setTimeout(schedule, 120); });

  function boardEl() {
    let b = app.querySelector(':scope > .board');
    if (!b) {
      app.innerHTML = '<div class="board"><header class="pbar foe"></header><div class="tiles foe"></div><section class="center"></section><div class="tiles own"></div><div class="pbar own"></div><div class="handz"></div><aside class="shopcol" aria-label="Рынок и знамёна"><section class="shop mk"></section><section class="shop rg"></section></aside><div class="drawer" aria-hidden="true"></div><footer class="abar"></footer></div>';
      b = app.firstElementChild; L.key = ''; zoneHtml = {};
      // стол не прокручивается никогда: если браузер всё же сдвинул его (фокус с клавиатуры, старый Safari) — вернуть на место
      b.addEventListener('scroll', () => { if (b.scrollTop || b.scrollLeft) { b.scrollTop = 0; b.scrollLeft = 0; } });
    }
    return b;
  }
  // где на этом экране рынок и знамёна: на телефоне — кнопки нижней планки, на большом экране — колонки рядом со столом
  const shopSide = () => (L.mode === 'wide' ? 'слева от стола' : 'справа от стола');
  const whereShop = (name) => (L.big ? `колонка «${name}» ${shopSide()}` : `кнопка «${name}» внизу слева`);
  function setZone(b, sel, key, html, cls) {
    const el = b.querySelector(':scope > ' + sel);
    if (cls != null && el.className !== cls) el.className = cls;
    if (zoneHtml[key] !== html) { morphInto(el, html); zoneHtml[key] = html; }
    return el;
  }
  // сцена посреди стола и подсказка обучения лежат поверх стола — им нужны координаты зон
  const coachEl = document.getElementById('coachw') || mk('div', 'coachw', 'coachw');
  let coachHtmlNow = '';
  function placeOverlays(b) {
    const c = b.querySelector(':scope > .center'), o = b.querySelector(':scope > .tiles.foe');
    if (!c || !o) return;
    const cr = c.getBoundingClientRect();
    const st = document.documentElement.style, px = (v) => Math.round(v) + 'px';
    const land = b.classList.contains('land');
    // подсказка обучения ложится поверх планки и плиток соперника: кубики и свой стол остаются на виду
    const ob = b.querySelector(':scope > .pbar.foe'), mt = b.querySelector(':scope > .tiles.own');
    const oTop = ob.getBoundingClientRect().top + Math.max(0, (parseFloat(getComputedStyle(ob).paddingTop) || 6) - 6) + 2;
    const vals = { '--c-top': px(cr.top), '--c-h': px(cr.height), '--c-left': px(cr.left), '--c-w': px(cr.width), '--o-top': px(oTop), '--o-h': px(mt.getBoundingClientRect().bottom - oTop - 12), '--sw': px(clampN(cr.height * 0.44, 56, 92) * (land ? 0.9 : 1)) };
    for (const k in vals) if (st.getPropertyValue(k) !== vals[k]) st.setProperty(k, vals[k]);
    placeToken(b);
  }
  // жетон хода лежит у герба того, кто ходит, и переезжает через стол, когда ход переходит
  function placeToken(b) {
    let tk = b.querySelector(':scope > .ttoken');
    if (!S || S.winner !== null) { if (tk) tk.hidden = true; return; }
    if (!tk) { tk = document.createElement('span'); tk.className = 'ttoken'; tk.hidden = true; tk.setAttribute('aria-hidden', 'true'); tk.innerHTML = `<img src="${IMG('icons/i_crown.svg')}" alt="">`; b.appendChild(tk); }
    const cur = S.cur, at = cur === viewIdx() ? b.querySelector('.pbar.own .crestb') : b.querySelector(`.pbar.foe .ochip[data-i="${cur}"] .cr`) || (cur === oppFocus ? b.querySelector('.pbar.foe .crest') : null);
    const r = at && at.getBoundingClientRect();
    if (!r || !r.width) { tk.hidden = true; return; }
    const br = b.getBoundingClientRect(), key = `${Math.round(r.left - br.left - 7)}px, ${Math.round(r.bottom - br.top - 14)}px`;
    if (tk.dataset.at !== key || tk.hidden) {
      const jump = tk.hidden || !tk.dataset.at || reduceMotion();
      tk.dataset.at = key; tk.style.transition = jump ? 'none' : ''; tk.style.transform = `translate(${key})`;
      if (jump) void tk.offsetWidth; else if (sound && S.round + S.cur > 1) Sfx.tick();
      tk.hidden = false;
    }
  }
  function renderBoard(p, hint) {
    const b = boardEl();
    layoutBoard(b);
    const my = isMyTurn() && !WATCH;
    if (selCard && (!my || p.hand[selCard.i] !== selCard.id || adjustReq)) selCard = null;
    if (S.winner !== null) drawer = null;
    const N = S.players.length;
    const others = Array.from({ length: N - 1 }, (_, k) => S.players[(p.i + 1 + k) % N]);
    let opp = others.find(q => q.i === oppFocus) || others[0] || null;
    if (opp && oppFocus !== opp.i) oppFocus = opp.i;
    // новые владения на столе «приезжают»
    const now = performance.now();
    for (const q of S.players) for (const e of q.estates) { const k = q.i + ':' + e.uid; if (!seenUid.has(k)) seenUid.set(k, seenInit ? now : 0); }
    seenInit = true;
    shownUids = new Set([...p.estates, ...(opp ? opp.estates : [])].map(e => e.uid));
    const live = S.winner === null;
    setZone(b, '.pbar.foe', 'obar', oppBarHtml(p, others, opp), `pbar foe${others.length > 1 ? ' multi' : ''}${opp && live && S.cur === opp.i && others.length === 1 ? ' active' : ''}`);
    const zo = zoneHtml.otiles, zm = zoneHtml.mtiles;
    setZone(b, '.tiles.foe', 'otiles', opp ? tilesHtml(opp, false) : '');
    const ci = centerHtml(p, hint);
    setZone(b, '.center', 'center', ci.html, `center${ci.cls}`);
    setZone(b, '.tiles.own', 'mtiles', tilesHtml(p, true));
    // сработавшее владение за краем ряда — показать
    if (zo !== zoneHtml.otiles && / (fire|arr)[ "]/.test(zoneHtml.otiles)) setTimeout(() => revealTile('.tiles.foe .tile.fire, .tiles.foe .tile.arr'), 90);
    if (zm !== zoneHtml.mtiles && / (fire|arr)[ "]/.test(zoneHtml.mtiles)) setTimeout(() => revealTile('.tiles.own .tile.fire, .tiles.own .tile.arr'), 90);
    setZone(b, '.pbar.own', 'mbar', myBarHtml(p), `pbar own${live && S.cur === p.i ? ' active' : ''}`);
    setZone(b, '.handz', 'hand', handHtml(p), `handz${my ? '' : ' idle'}`);
    setZone(b, '.abar', 'abar', abarHtml(p));
    if (L.big) {
      const plan = shopPlan(p);
      const mk = marketDrawer(p, plan.mk), rg = regaliaDrawer(p, plan.rg);
      if (zoneHtml.smk !== mk) { morphInto(b.querySelector(':scope > .shopcol > .shop.mk'), mk); zoneHtml.smk = mk; }
      if (zoneHtml.srg !== rg) { morphInto(b.querySelector(':scope > .shopcol > .shop.rg'), rg); zoneHtml.srg = rg; }
      drawer = null;
    }
    const dEl = b.querySelector(':scope > .drawer');
    if (drawer) { const h = drawer === 'market' ? marketDrawer(p) : regaliaDrawer(p); if (zoneHtml.drawer !== h) { morphInto(dEl, h); zoneHtml.drawer = h; } dEl.dataset.d = drawer; dEl.setAttribute('aria-hidden', 'false'); }
    else if (dEl.getAttribute('aria-hidden') !== 'true') dEl.setAttribute('aria-hidden', 'true');
    b.classList.toggle('d-open', !!drawer);
    b.dataset.focus = hint && hint.focus ? hint.focus : '';
    placeOverlays(b);
    // подсказка обучения и сводка хода соперника — поверх верхней части стола
    const ch = hint && coachMin !== hint.id ? coachHtml(hint) : nextReq && lastRec ? recHtml() : '';
    if (ch !== coachHtmlNow) { morphInto(coachEl, ch); coachHtmlNow = ch; }
    coachEl.hidden = !ch;
    document.body.classList.toggle('coaching', !!ch);
    placeSpot(b, hint);
    if (hovFor && !hovFor.isConnected) hovHide();
  }

  // ---------- планки игроков ----------
  const pipsOf = (q) => {
    const groups = ['v', 'l', 'g'].map(t => { const need = needT(t); if (!need) return ''; const ids = tierList(q, t); return Array.from({ length: need }, (_, j) => `<i class="${t}${ids[j] && D.BAN[ids[j]] ? ` on d-${D.BAN[ids[j]].dir}` : ''}"></i>`).join(''); }).filter(Boolean);
    return `<span class="pips" role="img" aria-label="Знамёна: ${E.regCount(q)} из ${E.goal(S)}">${groups.join('<u></u>')}</span>`;
  };
  // монета лежит на плитке, которая сейчас на экране?
  const coinTile = (c) => (c.kind === 'roll' ? c.uid != null && shownUids.has(c.uid) : c.kind === 'dawn' && /^est:/.test(c.ck || '') && shownUids.has(+c.ck.slice(4)));
  // монеты не на плитках: доход начала хода от Дома, знамён, веры и придворных, замыслы — одной монетой на планке игрока
  function barCoins(i) {
    const cs = coinQ.filter(c => !c.done && !c.held && !c.auto && c.by === i && !coinTile(c));
    if (!cs.length) return '';
    const one = (list, give) => { if (!list.length) return ''; const sum = list.reduce((a, c) => a + c.amt, 0); return `<button class="barcoin${give ? ' give' : ''}" data-act="coin-card" data-k="bc${i}${give ? 'g' : 't'}" data-coins="${list.map(c => c.k).join(',')}" aria-label="${give ? 'Отдать' : 'Забрать'} ${sum}">${list.every(c => c.kind === 'dawn') ? gico('dawn') : ''}${give ? '−' : '+'}${sum}</button>`; };
    return one(cs.filter(c => c.to === i), false) + one(cs.filter(c => c.to !== i), true);
  }
  // рука соперника — веер рубашек: видно, сколько у него карт
  const ofan = (n) => `<span class="ofan" role="img" aria-label="Карт в руке: ${n}">${Array.from({ length: Math.min(n, 5) }, (_, k) => `<i style="--k:${k - (Math.min(n, 5) - 1) / 2}"></i>`).join('')}<b>${n}</b></span>`;
  function oppBarHtml(p, others, opp) {
    const menu = '<button class="round" data-act="menu" aria-label="Меню"><i></i><i></i><i></i></button>';
    const ns = netState();
    const net = NETG ? `<button class="netb ${ns}" data-act="net-info" aria-label="Связь: ${ns === 'on' ? 'всё в порядке' : ns === 'warn' ? (guest() ? 'хозяин не отвечает' : 'игрок не отвечает') : 'нет связи с серверами'}"><i></i></button>` : '';
    if (!opp) return `<span class="sp"></span>${net}${menu}`;
    if (others.length > 1) {
      return `<div class="ochips">${others.map(q => `<button class="ochip${q.i === opp.i ? ' on' : ''}${S.cur === q.i && S.winner === null ? ' active' : ''}${S.first === q.i ? ' first' : ''}" data-act="opp-focus" data-i="${q.i}" aria-label="${esc(H(q).name)}"><img class="cr" src="${crestOf(q)}" alt=""><span class="og" data-gold="${q.i}"><span>${gico('gold')}${shownGold(q)}${popHtml(q.i)}</span><small>${gico('banner')}${E.regCount(q)} ${gico('card')}${q.hand.length}</small></span></button>`).join('')}</div>${barCoins(opp.i)}${net}${menu}`;
    }
    const q = opp;
    const tags = [q.away ? 'бот' : '', peerOff(q) ? 'нет связи' : ''].filter(Boolean).join(' · ');
    return `<button class="pmain${S.first === q.i ? ' first' : ''}" data-act="opp" data-i="${q.i}" aria-label="${esc(H(q).name)}: подробно${S.first === q.i ? ', первый игрок круга' : ''}"><img class="crest" src="${crestOf(q)}" alt=""><span class="who"><b>${esc(H(q).short)}${tags ? `<small>${tags}</small>` : ''}</b>${pipsOf(q)}</span></button>${barCoins(q.i)}<span class="gold" data-gold="${q.i}">${gico('gold')}<b>${shownGold(q)}</b>${popHtml(q.i)}</span>${ofan(q.hand.length)}${net}${menu}`;
  }
  function myBarHtml(p) {
    const n = E.regCount(p), g = E.goal(S);
    const extra = [modOn('seats') && (p.seats || []).length ? `${gico('seat')}${p.seats.length}` : '', modOn('plots') && p.plots.length ? `${gico('plot')}${p.plots.length}` : '', (p.sins || []).length ? `😈${p.sins.length}` : '', p.penance ? `🕯${p.penance.step}/4` : '', p.ritual ? `✨${p.ritual.marks.filter(Boolean).length}/5` : '', (p.miracles || []).length ? `🌟${p.miracles.length}` : ''].filter(Boolean).join(' '); // грехи, покаяние, ритуал и чудеса — на кнопке «Двор»
    return `<button class="crestb${S.first === p.i ? ' first' : ''}" data-act="my" aria-label="${esc(H(p).name)}: мой двор${S.first === p.i ? ', первый игрок круга' : ''}"><img class="crest" src="${crestOf(p)}" alt=""></button><button class="goldbig" data-act="res" data-s="gold" data-i="${p.i}" data-gold="${p.i}" aria-label="Золото: ${shownGold(p)}">${gico('gold')}<b>${shownGold(p)}</b>${popHtml(p.i, 'gold-pop')}</button>${barCoins(p.i)}<button class="pipsb" data-act="drawer" data-d="regalia" aria-label="Знамёна: ${n} из ${g}">${pipsOf(p)}<small>знамёна · ${n} из ${g}</small></button><span class="sp"></span><button class="myb${extrasOf(p).some(x => x.k === 'ritual' || x.k === 'ritstart') ? ' glow' : ''}" data-act="my">${extra ? `<i>${extra}</i>` : ''}${WATCH || hotseat() ? esc(H(p).short) : 'Двор'}</button>`;
  }

  // ---------- плитки владений ----------
  // сколько принесло каждое владение на последнем броске — со знаком для его хозяина (проклятие «Мытарь» у вас — минус)
  function hitMap(rv, q) {
    const h = {};
    if (!rv) return h;
    for (const x of rv.ev) {
      if (x.uid == null) continue;
      if (x.amt > 0) h[x.uid] = (h[x.uid] || 0) + (x.to === q.i ? x.amt : x.from === q.i ? -x.amt : x.amt);
      else if (x.zero && h[x.uid] == null) h[x.uid] = 0;
    }
    return h;
  }
  // что плитка приносит своему хозяину сейчас — со всеми надбавками
  function tileInc(q, d, m) {
    if (d.t === 'wall') return `<b>+${d.walls}</b>${gico('wall')}`;
    if (d.bad) return ({ tax: `<b>✕</b>${gico('craft')}`, blight: `<b>✕</b>${gico('land')}`, quarantine: '<b>✕</b>🏠', bandits: `<b>✕</b>${gico('raid')}${gico('hold')}`, walls: `<b>−${Math.abs(d.walls || 0)}</b>${gico('wall')}`, evileye: `<b>1</b>${gico('dice')}`, relic: `<b>✕</b>${gico('faith')}`, schemer: `<b>✕</b>${gico('banner')}` })[d.bad] || '<b>!</b>'; // проклятие: что отнимает
    const v = d.t === 'raid' ? d.inc + (m.redBonus || 0) : d.t === 'hold' ? Math.min(d.cap || 99, d.inc + (m.holdBonus || 0)) : E.estateIncome(S, q, d, m);
    return `<b>+${v}</b>${gico('gold')}`;
  }
  function faithTile(q, f, mine) {
    const F = D.FAITHS[f], my = mine && !WATCH && isMyTurn() && S.players[S.cur] === q;
    const can = my && !E.riteBlock(S, q, f), done = !!(q.turn && q.turn.rites && q.turn.rites[f]) && S.players[S.cur] === q;
    const lab = mine ? (done ? 'обряд ✓' : 'обряд') : 'вера';
    return `<button class="tile t-faith${can ? ' glow' : ''}${done ? ' done' : ''}" data-act="faith-tile" data-id="${f}" data-o="${q.i}" aria-label="Вера «${esc(F.name)}»${can ? ': обряд доступен' : ''}"><span class="artw"><img src="${IMG(`art/r_${f}.svg`)}" alt="" draggable="false"></span><span class="num fi">${F.icon}</span><span class="inc">${lab}</span></button>`;
  }
  function tilesHtml(q, mine) {
    const rv = rvShown(), fresh = !!rv && rv.tk === turnKey();
    const hit = fresh ? hitMap(rv, q) : {};
    const m = E.mods(S, q);
    const pend = coinQ.filter(c => !c.done && !c.held);
    const now = performance.now();
    const gs = estStacks(q.estates, hit);
    if (tileHolds.length) {
      for (const h of tileHolds) {
        if (now - h.t > 9000) continue;
        if (h.to === q.i) { const g = gs.filter(x => x.id === h.id).pop(); if (g) { if (g.n > 1) g.n--; else g.hold = true; } }
        else if (h.from === q.i) { const ex = gs.find(x => x.id === h.id && !x.ruined); if (ex) ex.n++; else gs.push({ id: h.id, n: 1, v: null, ruined: false, bad: !!D.ESTATES[h.id].bad, uids: [] }); }
      }
      gs.sort((a, b) => (D.ESTATES[a.id].n[0] || 99) - (D.ESTATES[b.id].n[0] || 99) || D.ESTATES[a.id].cost - D.ESTATES[b.id].cost);
    }
    // v10.17: карта веры лежит плиткой рядом с владениями: светится, когда обряд доступен; нажали — обряд
    const ft = modOn('faith') ? (q.faiths || []).map(f => faithTile(q, f, mine)) : [];
    if (!gs.length && !ft.length) return `<span class="none">${mine ? 'Владений пока нет — купите на рынке' : 'Владений пока нет'}</span>`;
    const tiles = gs.map(g => {
      const d = D.ESTATES[g.id];
      const cs = pend.filter(c => (c.kind === 'roll' && c.uid != null && g.uids.includes(c.uid)) || (c.kind === 'dawn' && c.ck && g.uids.some(u => c.ck === 'est:' + u)));
      const man = cs.filter(c => !c.auto);
      const take = man.filter(c => c.by === c.to).reduce((a, c) => a + c.amt, 0), give = man.filter(c => c.by !== c.to).reduce((a, c) => a + c.amt, 0);
      const arr = g.uids.some(u => now - (seenUid.get(q.i + ':' + u) || 0) < 900);
      const cls = ['tile', 't-' + (d.bad ? 'bad' : d.t), take ? 'take' : give ? 'give' : g.v ? 'fire' : '', g.ruined ? 'ruin' : '', arr ? 'arr' : '', g.hold ? 'hold' : ''].filter(Boolean).join(' ');
      const bubble = take ? `<span class="coin">+${take}</span>` : give ? `<span class="coin give">−${give}</span>` : g.v ? `<span class="coin got${g.v < 0 ? ' neg' : ''}">${g.v > 0 ? '+' : '−'}${Math.abs(g.v)}</span>` : '';
      const what = take ? `, забрать ${take}` : give ? `, отдать ${give}` : '';
      return `<button class="${cls}" data-act="${man.length ? 'coin-card' : 'info-estate'}" data-id="${g.id}" data-o="${q.i}" data-k="t${q.i}:${g.id}${g.ruined ? '#r' : ''}"${cs.length ? ` data-coins="${cs.map(c => c.k).join(',')}"` : ''} aria-label="${esc(d.name)}${g.n > 1 ? ` ×${g.n}` : ''}${what}"><span class="artw"><img src="${artOf(g.id)}" alt="" draggable="false"></span>${d.n.length ? `<span class="num">${CardFX.numText(d.n)}</span>` : ''}${g.n > 1 ? `<span class="stk">×${g.n}</span>` : ''}${d.p ? `<span class="prov">${gico('prov' + d.p)}</span>` : ''}<span class="inc">${g.ruined ? 'руины' : tileInc(q, d, m) + (d.sym ? `<img class="ic sy" src="${IMG(`icons/i_${d.sym}.svg`)}" alt="">` : '')}</span>${bubble}</button>`;
    });
    const f = tileFit(gs.length + ft.length, mine), v = mine ? '' : 'o';
    return `<div class="trow${f.more ? ' more' : ''}" style="--cols:${f.cols}${f.s < 1 ? `;--${v}tw:${f.w}px;--${v}th:${f.h}px` : ''}">${ft.concat(tiles).join('')}</div>`;
  }
  // сколько плиток в ряду и какого они размера: все владения видны без прокрутки, пока плитка не мельче 44 px;
  // ряды ровные (6 плиток — это 3 + 3, а не 5 + 1), неполный ряд стоит по центру
  function tileFit(n, mine) {
    const w = mine ? L.tw : L.otw, h = mine ? L.th : L.oth, per = mine ? 5 : 6, rows = mine ? (L.rowsMine || 2) : (L.rowsOpp || 1), g = mine ? 6 : 5;
    if (!w || n <= per * rows) return { cols: Math.ceil(n / Math.max(1, Math.ceil(n / per))), s: 1 };
    const Wz = per * w + (per - 1) * g, Hz = rows * h + (rows - 1) * g;
    let best = { s: 0, cols: n };
    for (let r = 1; r <= rows + 1; r++) { const c = Math.ceil(n / r), s = Math.min(1, (Wz - (c - 1) * g) / (c * w), (Hz - (r - 1) * g) / (r * h)); if (s > best.s + 0.001) best = { s, cols: c }; }
    if (best.s * w >= 44) return { cols: best.cols, s: best.s, w: Math.floor(best.s * w * 10) / 10, h: Math.floor(best.s * h * 10) / 10 };
    return { cols: Math.ceil(n / rows), s: 1, more: true };
  }
  // сработавшая плитка могла оказаться за краем ряда — подвинуть ряд (страница при этом не двигается)
  function revealTile(sel) {
    const el = app.querySelector(sel), z = el && el.closest('.tiles'); if (!z || z.scrollWidth <= z.clientWidth + 2) return;
    const r = el.getBoundingClientRect(), zr = z.getBoundingClientRect();
    if (r.left < zr.left + 6 || r.right > zr.right - 6) z.scrollBy({ left: r.left - zr.left - (zr.width - r.width) / 2, behavior: reduceMotion() ? 'auto' : 'smooth' });
  }

  // ---------- середина стола ----------
  // чей ход и что делать сейчас
  function turnInfo(p) {
    const cur = S.players[S.cur], my = isMyTurn() && !WATCH, mine = cur.i === p.i && !WATCH;
    if (S.winner !== null) return { whose: 'Партия окончена', me: false, text: '' };
    const whose = mine && !hotseat() ? 'Ваш ход' : `Ход ${esc(E.shortG(cur))}`;
    let t = '', warn = false;
    if (diceBusy()) t = 'кубики в воздухе…';
    else if (myCoins().length) t = 'нажмите на светящиеся плитки — или на кнопку внизу';
    else if (stepReq) t = stepReq.d.kind === 'draw' ? 'конец хода: возьмите новые карты' : 'новый круг: ряд рынка обновляется';
    else if (nextReq) t = 'ход окончен — нажмите «Дальше»';
    else if (adjustReq) t = 'бросок можно изменить';
    else if (my) {
      if (selCard) { const w = attackOf(selCard.id) ? attackWaste(p, selCard.id) : null; if (w) { t = w; warn = true; } else t = 'ещё раз по карте — крупно · смахните вверх — сыграть'; }
      else if (!p.turn.rolled) {
        const od = E.faithBan(S, p, 'oneDie');
        t = E.cursed(p, 'evileye') ? 'Сглаз: пока он у вас — только один кубик' : E.sinned(p, 'sloth') ? 'Лень: до конца игры — только один кубик' : od ? `обет «${esc(D.FAITHS[od].name)}»: только один кубик` : (E.mods(S, p).peek || 0) > 0 ? 'добросок: увидите первый кубик — решите, бросать ли второй' : p.hand.length ? 'сыграйте карты, потом бросьте кубики' : 'бросьте кубики: один или два';
        if (E.sinned(p, 'lust')) t = E.cursed(p, 'evileye') || E.sinned(p, 'sloth') || od ? 'один кубик — 😈 Похоть: итог 1–2 отдаст карту сопернику' : '😈 Похоть: итог 1–2 — карта уйдёт сопернику'; // важнее общей подсказки: с одним кубиком — каждый третий бросок, с двумя — только 1+1
      } else {
        const left = E.buysLeft(S, p), cu = cuOn(p);
        const fair = (S.courtRow.length && E.fairOf(S, p, 'court', S.courtRow[0])) || (S.estateRow.length && E.fairOf(S, p, 'estate', S.estateRow[0]));
        t = left > 0 && !canAfford(p) && !cu ? 'купить пока не на что — завершайте ход' : left > 0 ? `${left > 1 ? `действий: ${left}` : 'одно действие'} — рынок или знамя${cu ? ' · ещё вассал — догоняющий наём' : ''}` : cu ? 'догоняющий наём: можно нанять ещё вассала' : fair ? 'Ярмарка: ещё одна покупка без действия' : 'действий нет — завершайте ход';
      }
    } else if (mine) t = 'ход начинается…';
    else t = guest() || (hostNet() && seatOf(cur) === 'remote' && !cur.isBot) ? (cur.nick ? esc(cur.nick) : 'игрок по сети') : !cur.turn || !cur.turn.rolled ? 'играют карты и бросают кубики' : 'выбирают, что купить';
    return { whose, me: mine, text: t, warn };
  }
  function centerHtml(p, hint) {
    const ti = turnInfo(p);
    const coach = hint && coachMin === hint.id ? `<button class="coachchip" data-act="coach-max">${gico('magister')}${hint.step ? `шаг ${hint.step}` : 'подсказка'}</button>` : '';
    const exr = exInRow() && !ti.warn ? exChips(p, true) : ''; // v10.17: лёжа «Ещё можно» — в строке хода вместо подсказки
    const row = `<div class="turnrow"><button class="rnd" data-act="log" aria-label="Круг ${S.round}: журнал партии">Круг ${S.round}</button><b class="whose${ti.me ? ' mine' : ''}">${ti.whose}</b>${coach}${exr ? `<span class="exr"><span class="exlab">ещё:</span>${exr}</span>` : ti.text && (hintOn || ti.warn) ? `<span class="hint${ti.warn ? ' warn' : ''}">${ti.text}</span>` : ''}</div>`;
    // ↻ обновление ряда: уходящая карта лежит посреди стола
    if (stepReq && stepReq.d.kind === 'refresh') {
      const d = stepReq.d, isBan = ['v', 'l', 'g'].includes(d.row);
      const card = mcard(isBan ? 'ban' : d.row === 'court' ? 'court' : 'estate', d.id, { act: 'refresh-tap', cls: 'rf-out' });
      return { cls: '', html: `${row}<div class="cmid rf"><div class="rfw">${card}</div></div><div class="cfoot"><div class="why">ряд ${RF_NAME[d.row] || ''}: за круг ничего не взяли — <b>«${esc(pcName(isBan ? 'ban' : d.row === 'court' ? 'court' : 'estate', d.id))}»</b> уходит под колоду</div></div>` };
    }
    const dv = diceView, air = !!stg && !stg.leaving, landing = !!stg && !!stg.leaving;
    const fresh = !!dv && dv.tk === turnKey();
    let well;
    if (!dv) well = `<span class="wdice">${sdie(0)}${sdie(0)}</span><span class="rnum"><span>кубики ещё<br>не бросали</span></span>`;
    else {
      const raw = dv.vals.reduce((a, c) => a + c, 0), tot = clampN(raw + (dv.adj || 0), 1, 12);
      const who = dv.p === p.i && !WATCH && !hotseat() ? 'ваш бросок' : S.players[dv.p] ? `бросок ${esc(E.shortG(S.players[dv.p]))}` : 'бросок';
      const how = dv.vals.length > 1 || dv.adj ? `${dv.vals.join(' + ')}${dv.adj ? ` ${dv.adj > 0 ? '+' : '−'} ${Math.abs(dv.adj)}` : ''}` : '';
      well = `<span class="wdice">${dv.vals.map(v => sdie(v)).join('')}</span><span class="rnum"><b>${tot}</b><span><em>${who}</em>${how ? `<br>${how}` : ''}</span></span>`;
    }
    // итог броска: кому сколько; ниже — из чего сложился ваш доход или кто промолчал
    const rv = rvShown();
    let feed = '', why = '';
    if (rv && rv.tk === turnKey() && S.players[rv.a]) {
      const order = [p, ...S.players.filter(q => q.i !== p.i)];
      const bits = [];
      for (const q of order) {
        const r = rollParts(rv, q);
        if (!r.any && q.i !== p.i) continue;
        const you = q.i === p.i && !WATCH && !hotseat();
        bits.push(`<span class="${q.i === p.i ? 'mine' : ''}${r.net < 0 ? ' neg' : ''}"><em>${you ? 'Вам' : esc(H(q).dat)}</em><b>${r.net > 0 ? '+' : r.net < 0 ? '−' : ''}${Math.abs(r.net)}</b>${gico('gold')}</span>`);
      }
      const any = order.some(q => rollParts(rv, q).any);
      feed = any ? bits.join('<span class="sep"></span>') : '<span class="log">Ни одно владение не сработало</span>';
      const caps = [];
      for (const g of estStacks(p.estates, hitMap(rv, p))) { if (!g.v) continue; const c = incCaption(g.uids); if (c) caps.push(`${esc(D.ESTATES[g.id].name)}: <b>${c.replace(/<br>/g, '; ')}</b>`); }
      if (caps.length) why = caps.slice(0, 2).join(' · ');
    } else {
      const dn = turnRec && turnRec.p === S.cur && turnRec.dawn ? turnRec.dawn : null;
      const dg = dn ? (dn.gain || 0) + (dn.support || 0) - (dn.envy || 0) : 0;
      if (dn && dg && !(turnRec.roll)) {
        const you = dn.p === p.i && !WATCH && !hotseat();
        feed = `<span class="${dn.p === p.i ? 'mine' : ''}${dg < 0 ? ' neg' : ''}">${gico('dawn')}<em>Начало хода: ${you ? 'вам' : esc(H(S.players[dn.p]).dat)}</em><b>${dg > 0 ? '+' : '−'}${Math.abs(dg)}</b>${gico('gold')}</span>`;
        const src = [...(dn.src || []).map(esc), dn.support ? `Народная поддержка +${dn.support}` : '', dn.envy ? `Зависть −${dn.envy}` : ''].filter(Boolean);
        if (src.length) why = src.join(' · ');
      } else {
        const lg = stg && stg.busy && stg.logLen != null ? S.log.slice(0, stg.logLen) : S.log;
        const l = lg[lg.length - 1];
        if (l) feed = `<span class="log">${esc(l.t.trim())}</span>`;
      }
    }
    return { cls: `${fresh ? '' : ' stale'}${air ? ' air' : landing ? ' landing' : ''}`, html: `${row}<div class="cmid"><button class="well" data-act="rollsum" aria-label="Итог броска: подробно">${well}</button></div><div class="cfoot">${feed ? `<div class="cfeed" data-act="log">${feed}</div>` : ''}${why ? `<div class="why">${why}</div>` : ''}${exLine(p)}</div>` };
  }

  // v10.17: «Ещё можно: обряд · из сброса…» — кнопки ведут прямо к делу
  const EX_ICON = { rite: '🕯', ritual: '✨', ritstart: '✨', adopt: '🕯', fetch: '🂠', fair: '🏷' };
  const exInRow = () => L.mode === 'land' || L.mode === 'wide'; // лёжа центр низкий: кнопки — в строке хода, внизу места не держим
  function exChips(p, short) {
    if (!S || WATCH || !isMyTurn() || S.players[S.cur] !== p) return '';
    return extrasOf(p).map(x => `<button class="exb${x.hard ? '' : ' soft'}" data-act="ex" data-k="${x.k}"${x.f ? ` data-f="${x.f}"` : ''} aria-label="Ещё можно: ${esc(x.t)}">${EX_ICON[x.k] || ''} ${esc(short ? x.s || x.t : x.t)}</button>`).join('');
  }
  function exLine(p) {
    if (exInRow()) return '';
    const ch = exChips(p); // место под строку есть всегда — стол не прыгает
    return `<div class="exline${ch ? '' : ' empty'}" aria-hidden="${ch ? 'false' : 'true'}">${ch ? `<span>Ещё можно:</span>${ch}` : '<span>&nbsp;</span>'}</div>`;
  }

  // ---------- средняя карта: рука, рынок, знамёна ----------
  function mcard(kind, id, o = {}) {
    let cls = `mcard k-${kind}`, art, idx = '', tr = [], nm, ft = '', act, attrs, tr2 = '';
    if (kind === 'estate') {
      const d = D.ESTATES[id], f = CardFX.estate(d);
      cls += ` t-${d.bad ? 'bad' : d.t}`; art = artOf(id); nm = d.name; act = 'info-estate'; attrs = `data-id="${id}"`;
      idx = d.n.length ? `<span class="num">${CardFX.numText(d.n)}</span>` : '';
      if (d.p) tr.push(gico('prov' + d.p)); if (d.sym) tr.push(gico(d.sym));
      ft = `<span class="ft fxm">${miniChips(f.main, 2)}</span>`;
    } else if (kind === 'court') {
      const c = D.COURT[id], f = CardFX.court(c);
      cls += ' ' + roleCls(c); art = artOf(id); nm = c.name; act = 'info-court'; attrs = `data-id="${id}"`;
      const ch = miniChips(f.play, 3); idx = ch ? `<span class="idx">${ch}</span>` : '';
      if (c.plot && modOn('plots')) tr.push(gico(c.plot === 'dice' ? 'dice' : 'plot')); if (c.seat && modOn('seats')) tr.push(gico('seat'));
      ft = `<span class="ft">${roleName(c)}</span>`;
    } else if (kind === 'ban') {
      const bn = D.BAN[id];
      cls += ` d-t-${bn.dir}`; art = IMG(`art/b_${id}.svg`); nm = bn.name; act = 'info-ban'; attrs = `data-key="${id}"${o.st ? ` data-st="${o.st}"` : ''}`;
      idx = `<span class="idx"><span>${gico(bn.dir)}</span></span>`;
      const ch = miniChips(CardFX.mods(bn.mods, bn.prod), 2);
      ft = ch ? `<span class="ft fxm">${ch}</span>` : `<span class="ft">${bn.heir ? 'Наследник' : D.TIERS[bn.tier].name}</span>`;
    } else if (kind === 'faith') {
      const F = D.FAITHS[id];
      cls += ` d-t-${F.dir}`; art = IMG(`art/r_${id}.svg`); nm = F.name; act = 'zoom'; attrs = `data-kind="faith" data-id="${id}"`;
      idx = `<span class="idx"><span>${gico('faith')}</span></span>`; ft = '<span class="ft">Вера</span>';
      const fc = faithCardsAt(id);
      if (fc.length) tr2 = `<span class="fcm" aria-hidden="true">${fc.map(x => `<img class="${x.at === 'pool' ? '' : 'off'}" src="${artOf(x.id)}" alt="" draggable="false">`).join('')}</span>`;
    } else {
      const h = D.HOUSES[id];
      art = IMG(`art/h_${id}.svg`); nm = h.name; act = 'zoom'; attrs = `data-kind="house" data-id="${id}"`; ft = `<span class="ft">${esc(h.path)}</span>`;
    }
    return `<button class="${cls}${o.cls ? ' ' + o.cls : ''}" data-act="${o.act || act}" ${attrs}${o.o != null ? ` data-o="${o.o}"` : ''}${o.fd != null ? ` style="--fd:${o.fd}ms"` : ''} aria-label="${esc(nm)}${kind === 'faith' && D.FAITHS[id].cards ? `. Карты веры: ${D.FAITHS[id].cards.filter(x => D.COURT[x]).map(x => D.COURT[x].name).join(', ')}` : ''}"><img class="art" src="${art}" alt="" draggable="false">${idx}${tr.length ? `<span class="tr">${tr.map(x => `<span>${x}</span>`).join('')}</span>` : ''}${tr2}<span class="nm">${esc(nm)}</span>${ft}${o.badge || ''}</button>`;
  }
  // новая карта ряда «открывается»: класс deal и задержка, пока идёт переворот
  // задержка считается один раз: если поменять её у идущей анимации, карта «прыгнет» в конец без полёта
  const fdShown = new Map();
  function dealOf(f) {
    if (!f) return null;
    const t = flips.get(f.key);
    if (t == null) { fdShown.delete(f.key); return null; }
    const now = performance.now();
    if (now - t >= FLIP_MS) { fdShown.delete(f.key); return null; }
    let v = fdShown.get(f.key);
    if (!v || v.t !== t) { v = { t, fd: Math.max(0, Math.round(t - now)) }; fdShown.set(f.key, v); }
    return v.fd;
  }
  let dealTimer = 0;
  const dealSoon = () => { clearTimeout(dealTimer); dealTimer = setTimeout(schedule, FLIP_MS + FLIP_STEP * 6 + 80); };

  // ---------- рука: веер ----------
  // v10.17: итог броска для всех — кто сколько получит, сколько вы отдадите чужим Набегам (замыслы не в счёте)
  function pvLine(p, r, short) {
    const pv = E.rollPreview(S, p, r), me = pv[p.i], bits = [];
    const sgn = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0');
    if (short === 'others') { if (me.loss) bits.push(`вы платите ${me.loss}`); }
    else if (!short) bits.push(`вам ${sgn(me.gain - me.loss)}${me.loss ? ` (вы платите ${me.loss})` : ''}`);
    else if (me.loss) bits.push(`вы −${me.loss}`);
    for (const x of pv) { if (x.i === p.i) continue; const n = x.gain - x.loss; if (!n) continue; const q = S.players[x.i]; bits.push(short === true ? `${H(q).sigil}${sgn(n)}` : `${esc(H(q).dat)} ${sgn(n)}`); }
    return bits.join(short === true ? ' ' : ' · ');
  }
  // «Перст судьбы»: все повороты одного кубика с итогом броска и доходом, лучшие — сверху
  function setChoices(p, q) {
    const out = [];
    q.vals.forEach((v, k) => { if (k > 0 && v === q.vals[0]) return; /* одинаковые кубики — варианты один раз */ for (let d = 1; d <= 6; d++) { if (d === v) continue; const vs2 = q.vals.slice(); vs2[k] = d; const t = vs2.reduce((a, b) => a + b, 0); const x = E.rollPreview(S, p, t)[p.i]; out.push({ k, v: d, from: v, t, g: x.gain - x.loss }); } });
    return out.sort((a, b) => b.g - a.g || a.t - b.t);
  }
  function adjustPanel(p) {
    const q = adjustReq.q, vs = q.vals.join(' + ');
    const plotsOn = (r) => p.plots.filter(pl => pl.kind === 'dice' && pl.nums && pl.nums.includes(r)).length;
    const gold = (r) => { const x = E.rollPreview(S, p, r)[p.i]; return x.gain - x.loss; }; // точно: доход минус чужие Набеги (замыслы — отдельно)
    const fmt = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0') + gico('gold');
    const ev = E.Bot.rollEV(S, p, q.n);
    const better = ev > gold(q.total) + 4 * plotsOn(q.total) + 0.5;
    const f1x = (v) => fmt(Math.round(v * 10) / 10).replace('.', ',');
    const oneEv = (k) => { let t = 0; for (let d = 1; d <= 6; d++) { const vs2 = q.vals.slice(); vs2[k] = d; t += E.Bot.rollScore(S, p, vs2, q.n) / 6; } return t; };
    const ones = q.ones > 0 ? q.vals.map((v, k) => `<button class="adjb" data-act="adj-one" data-k="${k}"><b>${q.n > 1 ? `Перебросить ${v}` : 'Перебросить'}</b><small>в среднем ${f1x(oneEv(k))}</small></button>`).join('') : '';
    const shC = q.shiftCost || 0, shOpts = q.shifts > 0 && p.gold >= shC ? [-1, 1].filter(d => q.total + d >= 1 && q.total + d <= 12) : [];
    const worth = (r, c) => gold(r) + 4 * plotsOn(r) - c;
    const shBest = shOpts.reduce((bb, d) => (worth(q.total + d, shC) > (bb == null ? worth(q.total, 0) : worth(q.total + bb, shC)) ? d : bb), null);
    const shifts = shOpts.map(d => { const v = gold(q.total + d) - shC, o = pvLine(p, q.total + d, true); return `<button class="adjb${d === shBest && !better ? ' best' : ''}" data-act="adj-shift" data-d="${d}"><b>Сдвиг на ${q.total + d}</b><small class="${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}">${fmt(v)}${plotsOn(q.total + d) ? ' + замысел' : ''}${shC ? ' с платой' : ''}${o ? ` · ${o}` : ''}</small></button>`; }).join(''); // v10.19: замысел на этом числе — видно сразу
    const rr = q.rerolls > 0 ? `<button class="adjb${better ? ' best' : ''}" data-act="adj-reroll"><b>Переброс${q.rerolls > 1 ? ' ×' + q.rerolls : ''}</b><small>в среднем ${f1x(ev)}</small></button>` : '';
    // чудо «Перст судьбы»: повернуть один кубик на любую грань — варианты в отдельном листе
    const setB = q.sets > 0 ? (() => { const best = setChoices(p, q)[0]; return `<button class="adjb${best && best.g > gold(q.total) && !better ? ' best' : ''}" data-act="adj-setsheet"><b>Перст судьбы</b><small>${best ? `лучше: ${best.t} · ${fmt(best.g)}` : 'любая грань'}</small></button>`; })() : '';
    const others = pvLine(p, q.total, 'others');
    return `<div class="adjp"><button class="adjmin" data-act="adj-min" aria-label="Свернуть окно броска">Свернуть ▾</button><div class="adj-h">Выпало <b>${vs}${q.n > 1 ? ` = ${q.total}` : ''}</b> — вам <b>${fmt(gold(q.total))}</b>${plotsOn(q.total) ? ' и замысел' : ''}. Оставить или изменить?${others ? `<span class="adj-o">${others}</span>` : ''}${E.sinned(p, 'lust') && q.total <= 2 ? '<span class="adj-o">😈 Похоть: итог 1–2 — карта уйдёт сопернику</span>' : ''}${shOpts.length ? ` ${esc(E.modSources(S, p, 'shift').join(', ') || 'Гадатель')}: сдвиг на 1 за ${shC}${gico('gold')}.` : ''}</div><div class="adj">${rr}${ones}${shifts}${setB}</div></div>`;
  }
  function handHtml(p) {
    const my = isMyTurn() && !WATCH;
    if (adjustReq && my && !adjMin) return adjustPanel(p); // свёрнуто (adjMin) — видна рука, вернуть окно — кнопкой «Изменить» внизу
    // одно устройство на несколько человек: в чужой ход карты лежат рубашкой
    const hidden = hotseat() && (S.cur !== ME || coverReq) && S.winner === null;
    const n = p.hand.length;
    const piles = pilesHtml(p, my);
    if (!n) return `${piles}<span class="hnote">${my ? 'В руке нет карт' : hidden ? `У ${esc(E.shortG(p))} нет карт в руке` : 'В руке нет карт'}</span>`;
    const cw = L.cw, zw = L.hw || 369;
    // веер лежит между стопками: колода слева, сброс справа (лёжа на телефоне обе стопки слева)
    const pw = L.pw || 0, side = pw && !L.pstack ? pw + 15 : 0, lead = pw && L.pstack ? pw + 16 : 0, avail = zw - 24 - 2 * side - lead;
    const step = n > 1 ? Math.min(cw + 8, (avail - cw) / (n - 1)) : 0;
    const x0 = 12 + lead + side + (avail - (cw + step * (n - 1))) / 2;
    const deckX = 12 + pw / 2 - cw / 2; // откуда «приезжают» взятые карты
    const a = pw ? Math.min(2.2, 8 / n) : Math.min(3.2, 13 / n), slots = E.plotSlots(S, p); // рядом со стопками веер раскрыт меньше
    const fh = flipsFor(`hand${p.i}`, p.hand);
    let dealing = false;
    const cards = p.hand.map((id, i) => {
      const off = i - (n - 1) / 2;
      const st = `left:${(x0 + i * step).toFixed(1)}px;--r:${(off * a).toFixed(2)}deg;--y:${(off * off * 1.3).toFixed(1)}px;z-index:${i + 1}${pw ? `;--dx:${(deckX - (x0 + i * step)).toFixed(0)}px` : ''}`;
      if (hidden) return `<span class="hcard back" style="${st}"><img src="${backSrc('court')}" alt=""></span>`;
      const c = D.COURT[id], f = CardFX.court(c);
      const nRole = c.role ? (p.turn.roles[c.role] || 0) : 0;
      const allyOn = !!(c.role && (nRole >= 1 || (c.role === 'scholar' && E.mods(S, p).allyScholar)) && c.ally);
      const bigOn = !!(c.role && nRole >= 2 && c.ally);
      const fd = dealOf(fh[i]); if (fd != null) dealing = true;
      const idx = miniChips(f.play, 3) + ((allyOn || bigOn) && f.ally ? miniChips(f.ally, 1, 'al') : '');
      const tags = [c.plot && modOn('plots') ? gico(c.plot === 'dice' ? 'dice' : 'plot') : '', E.canSeat(S, id) ? gico('seat') : ''].filter(Boolean).map(x => `<span>${x}</span>`).join('');
      return `<button class="hcard ${roleCls(c)}${selCard && selCard.i === i ? ' sel' : ''}${fd != null ? ' deal' : ''}" data-act="sel" data-i="${i}" data-id="${id}" style="${st}${fd != null ? `;--fd:${fd}ms` : ''}" aria-label="${esc(c.name)}${selCard && selCard.i === i ? ' — выбрана' : ''}"><img class="art" src="${artOf(id)}" alt="" draggable="false">${idx ? `<span class="idx">${idx}</span>` : ''}${tags ? `<span class="tags">${tags}</span>` : ''}<span class="nm">${esc(c.name)}</span><span class="role">${roleName(c)}</span>${bigOn ? '<span class="ally">✓✓ свита</span>' : allyOn ? '<span class="ally">✓ свита</span>' : ''}</button>`;
    });
    if (dealing) dealSoon();
    return piles + cards.join('') + (hidden ? `<span class="hnote">Карты ${esc(H(p).gen)} скрыты до их хода</span>` : '');
  }
  // ---------- колода и сброс на столе ----------
  // колода — рубашкой, со счётчиком; сброс — лицом верхней карты. В конце хода колоду можно нажать, чтобы взять карты
  const pileSeen = { p: -1, deck: 0, disc: 0, gid: '' };
  function pilesHtml(p, my) {
    if (!L.pw) return '';
    const inPlay = p.inPlay || [], dn = p.deck.length, dc = p.discard.length + inPlay.length;
    const top = inPlay.length ? inPlay[inPlay.length - 1] : p.discard[p.discard.length - 1];
    const tc = top && D.COURT[top];
    const draw = my && !!stepReq && stepReq.d.kind === 'draw' && stepReq.d.p === p.i;
    pileSeen.p = p.i; pileSeen.deck = dn; pileSeen.disc = dc; pileSeen.gid = S.gid || '';
    const thick = (k) => (k > 9 ? ' t3' : k > 3 ? ' t2' : k > 0 ? ' t1' : ' empty');
    return `<button class="pile deck${thick(dn)}${draw ? ' go' : ''}" data-act="${draw ? 'step-ok' : 'pile'}" data-w="deck" aria-label="Колода: ${dn} ${D.plural(dn, 'карта', 'карты', 'карт')}${draw ? ' — нажмите, чтобы взять карты' : ''}"><span class="pk">${dn ? `<img src="${backSrc('court')}" alt="" draggable="false">` : ''}</span><b>${dn}</b><small>${draw ? 'взять' : 'колода'}</small></button>`
      + `<button class="pile disc${thick(dc)}${tc ? ' ' + roleCls(tc) : ''}${my && extrasOf(p).some(x => x.k === 'fetch') ? ' glow' : ''}" data-act="pile" data-w="discard" aria-label="Сброс: ${dc} ${D.plural(dc, 'карта', 'карты', 'карт')}"><span class="pk">${tc ? `<img src="${artOf(top)}" alt="" draggable="false">` : ''}</span><b>${dc}</b><small>сброс</small></button>`;
  }
  // колода перемешивается: карты сброса перелетают в колоду, колода «тасуется»
  function pileShuffle() {
    const b = app.querySelector(':scope > .board'); if (!b || !flyOn()) return;
    const dk = b.querySelector('.handz .pile.deck'), ds = b.querySelector('.handz .pile.disc'); if (!dk || !ds) return;
    const a = ds.getBoundingClientRect(), t = dk.getBoundingClientRect(); if (!a.width || !t.width) return;
    for (let k = 0; k < 4; k++) {
      const g = document.createElement('span'); g.className = 'pflip';
      g.style.cssText = `left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px`;
      b.appendChild(g);
      const an = g.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${(t.left - a.left) * 0.5}px, ${(t.top - a.top) * 0.5 - 22 - k * 3}px) rotate(${k % 2 ? 8 : -8}deg)`, opacity: 1, offset: 0.5 }, { transform: `translate(${t.left - a.left}px, ${t.top - a.top}px)`, opacity: 0.9 }], { duration: 300, delay: k * 60, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'both' });
      an.onfinish = () => g.remove(); setTimeout(() => g.remove(), 900);
    }
    const pk = dk.querySelector('.pk');
    if (pk && pk.animate) pk.animate([{ transform: 'none' }, { transform: 'translateX(-4px) rotate(-5deg)' }, { transform: 'translateX(4px) rotate(5deg)' }, { transform: 'translateX(-3px) rotate(-3deg)' }, { transform: 'none' }], { duration: 420, delay: 240, easing: 'ease-in-out' });
    if (sound) Sfx.shuffle();
  }
  // в конце хода несыгранные карты руки уходят в сброс
  function flyHandRest() {
    const b = app.querySelector(':scope > .board'); if (!b || !flyOn()) return;
    const ds = b.querySelector('.handz .pile.disc'); if (!ds) return;
    const t = ds.getBoundingClientRect();
    [...b.querySelectorAll('.handz .hcard[data-id]')].forEach((el, k) => {
      const r = el.getBoundingClientRect(); if (!r.width) return;
      const g = el.cloneNode(true); g.classList.remove('sel', 'drag', 'deal'); g.removeAttribute('data-act');
      g.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;bottom:auto;margin:0;z-index:${59 - k};pointer-events:none;transform:none;transform-origin:50% 50%;transition:none;animation:none`;
      b.appendChild(g);
      const an = g.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${t.left + t.width / 2 - (r.left + r.width / 2)}px, ${t.top + t.height / 2 - (r.top + r.height / 2)}px) scale(${t.width / r.width})`, opacity: 0.9 }], { duration: 300, delay: k * 45, easing: 'cubic-bezier(.4,.1,.3,1)', fill: 'both' });
      an.onfinish = () => g.remove(); setTimeout(() => g.remove(), 900);
    });
  }
  // карта улетает из руки: на стол и оттуда в сброс (сыграна), ко двору (замысел, придворный) или прочь (отставка)
  let flown = null; // какую карту уже отправили в полёт нажатием — чтобы событие «сыграна» не запускало его второй раз
  function flyHand(i, where) { flyHandEl(app.querySelector(`.handz .hcard[data-i="${i}"]`), where); }
  function flyHandEl(el, where) {
    const b = app.querySelector(':scope > .board');
    if (!el || !b || !el.animate || reduceMotion()) return;
    const r = el.getBoundingClientRect(); if (!r.width) return;
    const g = el.cloneNode(true);
    g.classList.remove('sel', 'drag', 'deal'); g.removeAttribute('data-act');
    g.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;bottom:auto;margin:0;z-index:60;pointer-events:none;transform:none;transform-origin:50% 50%;transition:none;animation:none`;
    b.appendChild(g);
    const mid = (x) => ({ x: x.left + x.width / 2 - (r.left + r.width / 2), y: x.top + x.height / 2 - (r.top + r.height / 2) });
    const disc = where === 'table' ? b.querySelector('.handz .pile.disc') : null, cz = b.querySelector(':scope > .center');
    let a;
    if (disc && cz && speed !== 'turbo') {
      // на середину стола, короткая пауза — и в сброс
      const cr = cz.getBoundingClientRect(), c = mid({ left: cr.left + (Math.random() - 0.5) * 36, width: cr.width, top: cr.top + cr.height * 0.12, height: cr.height }), t = mid(disc.getBoundingClientRect()), ts = disc.getBoundingClientRect().width / r.width;
      const tilt = (Math.random() - 0.5) * 8;
      a = g.animate([
        { transform: 'none', opacity: 1, easing: 'cubic-bezier(.2,.8,.3,1)' },
        { transform: `translate(${c.x}px, ${c.y}px) scale(.76) rotate(${tilt}deg)`, opacity: 1, offset: 0.36, easing: 'linear' },
        { transform: `translate(${c.x}px, ${c.y}px) scale(.72) rotate(${tilt}deg)`, opacity: 1, offset: 0.6, easing: 'cubic-bezier(.5,0,.3,1)' },
        { transform: `translate(${t.x}px, ${t.y}px) scale(${ts}) rotate(0deg)`, opacity: 1 },
      ], { duration: speed === 'fast' ? 660 : 880, easing: 'linear', fill: 'forwards' });
      a.onfinish = () => { g.remove(); landPulse(disc.querySelector('.pk')); };
      setTimeout(() => g.remove(), 1300);
      return;
    }
    const tg = where === 'court' ? b.querySelector('.pbar.own .myb') : where === 'out' ? null : cz;
    let dx = 0, dy = -r.height * 1.4, sc = 0.7, rot = 0;
    if (tg) { const t = tg.getBoundingClientRect(); dx = t.left + t.width / 2 - (r.left + r.width / 2); dy = t.top + t.height / 2 - (r.top + r.height / 2); sc = where === 'court' ? 0.2 : 0.62; }
    else { dx = r.width * 1.5; rot = 24; }
    a = g.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx * 0.6}px, ${dy * 0.75}px) scale(${(1 + sc) / 2}) rotate(${rot / 2}deg)`, opacity: 1, offset: 0.6 }, { transform: `translate(${dx}px, ${dy}px) scale(${sc}) rotate(${rot}deg)`, opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' });
    a.onfinish = () => g.remove(); setTimeout(() => g.remove(), 700);
  }
  // смахнуть карту вверх — сыграть сразу
  let dragC = null, swallow = 0;
  function playCard(i) {
    const p = S.players[ME];
    if (!isMyTurn() || WATCH || busy || !p || p.hand[i] == null) return;
    const oath = E.oathPlay(S, p, p.hand[i]);
    if (oath) { toast(esc(oath)); return; }
    flown = { id: p.hand[i], t: performance.now() };
    flyHand(i, 'table'); selCard = null;
    if (guest()) netDo('play', { i }); else guarded(async () => { await E.play(S, p, i); });
  }
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest && e.target.closest('.handz .hcard[data-act="sel"]');
    if (!el || !S || !isMyTurn() || WATCH || busy || adjustReq) return;
    dragC = { el, pid: e.pointerId, x: e.clientX, y: e.clientY, on: false, i: +el.dataset.i };
  }, { passive: true });
  document.addEventListener('pointermove', (e) => {
    if (!dragC || e.pointerId !== dragC.pid) return;
    const dx = e.clientX - dragC.x, dy = e.clientY - dragC.y;
    if (!dragC.on) {
      if (dy < -10 && Math.abs(dy) > Math.abs(dx)) { dragC.on = true; dragC.el.classList.add('drag'); }
      else if (Math.abs(dx) > 16 || dy > 16) { dragC = null; return; }
      else return;
    }
    dragC.el.style.transform = `translate(${dx * 0.5}px, ${Math.min(0, dy)}px) scale(1.08)`;
  }, { passive: true });
  const dragEnd = (e) => {
    if (!dragC || e.pointerId !== dragC.pid) return;
    const d = dragC; dragC = null;
    if (!d.on) return;
    swallow = performance.now();
    d.el.classList.remove('drag'); d.el.style.transform = '';
    if (e.type === 'pointerup' && e.clientY - d.y < -Math.max(56, L.ch * 0.45) && d.el.isConnected) playCard(+d.el.dataset.i);
  };
  document.addEventListener('pointerup', dragEnd, { passive: true });
  document.addEventListener('pointercancel', dragEnd, { passive: true });

  // ---------- нижняя планка: рынок, знамёна и одна главная кнопка ----------
  function abarHtml(p) {
    const my = isMyTurn() && !WATCH;
    const cu = my && cuOn(p);
    const exk = new Set(extrasOf(p).map(x => x.k)); // v10.17: подсветка — тут есть что сделать
    let left = `<button class="sq${drawer === 'market' ? ' on' : ''}${exk.has('fair') ? ' glow' : ''}" data-act="drawer" data-d="market" aria-pressed="${drawer === 'market'}">${gico('tag')}<span>Рынок</span></button><button class="sq${drawer === 'regalia' ? ' on' : ''}${exk.has('adopt') ? ' glow' : ''}" data-act="drawer" data-d="regalia" aria-pressed="${drawer === 'regalia'}">${gico('banner')}<span>Знамёна</span>${cu ? '<b class="bdg">+1</b>' : ''}</button>`;
    const status = (t, s) => `<div class="status"><b>${t}</b>${s ? `<span>${s}</span>` : ''}</div>`;
    let pa;
    const cs = S.winner === null ? myCoins() : [];
    if (S.winner !== null) pa = `<button class="second" data-act="results">Итоги</button>${S.tut ? '<button class="primary" data-act="new"><span>Новая партия</span></button>' : `<button class="primary" data-act="again"><span>${WATCH ? 'Ещё партия ботов' : 'Сыграть ещё'}</span><small>${againSub()}</small></button>`}`;
    else if (cs.length) {
      const inc = cs.filter(c => c.by === c.to).reduce((a, c) => a + c.amt, 0), out = cs.filter(c => c.by !== c.to).reduce((a, c) => a + c.amt, 0);
      const dawn = cs.every(c => c.kind === 'dawn');
      pa = `<button class="primary${inc ? '' : ' warn'}" data-act="coin-all"><span>${inc && out ? `Забрать +${inc} · отдать −${out}` : inc ? `Забрать +${inc}` : `Отдать −${out}`}${gico('gold')}</span><small>${dawn ? 'доход начала хода' : 'или нажмите на плитки'}</small></button>`;
    } else if (stepReq) {
      const d = stepReq.d;
      if (d.kind === 'draw') { const q = S.players[d.p]; pa = `<button class="primary" data-act="step-ok"><span>${d.shuffle ? 'Перемешать и взять' : 'Взять'} ${d.n} ${D.plural(d.n, 'карту', 'карты', 'карт')}</span><small>${d.shuffle ? 'колода кончилась — сброс станет колодой' : `в колоде ${q.deck.length}`}</small></button>`; }
      else pa = `${d.rows.length > 1 ? `<button class="second" data-act="refresh-all">Все<small>ещё ${d.rows.length - 1}</small></button>` : ''}<button class="primary" data-act="step-ok"><span>Под колоду</span><small>или нажмите на карту</small></button>`;
    } else if (guest() && hostLost()) pa = status('Нет связи с хозяином', NETG.hostGone === 'pause' ? 'он вышел в меню — подождём' : 'переподключаемся…');
    else if (hostNet() && NETG.asks.size && !adjustReq) {
      const a = [...NETG.asks.values()][0], q = S.players[a.pi], off = peerOff(q);
      pa = status(`Ждём решения: ${esc(H(q).short)}`, off ? 'нет связи с игроком' : 'игрок по сети думает') + (off ? `<button class="second" data-act="net-bot" data-i="${q.i}">Решить<small>ботом</small></button>` : '');
    } else if (nextReq && lastRec) pa = '<button class="primary" data-act="next"><span>Дальше</span></button>';
    else if (adjustReq) {
      const q = adjustReq.q;
      pa = `${adjMin ? '<button class="second" data-act="adj-max" aria-label="Вернуть окно броска">Изменить<small>бросок ▴</small></button>' : ''}<button class="primary" data-act="adj-ok"><span>Оставить ${q.total}</span></button>`; // окно свёрнуто — вернуть его кнопкой рядом
    } else if (my) {
      if (selCard) {
        const i = selCard.i, id = selCard.id, c = D.COURT[id], f = CardFX.court(c);
        const atk = attackOf(id), oath = E.oathPlay(S, p, id), dis = busy;
        const canPlot = c.plot && p.plots.length < E.plotSlots(S, p);
        const playTxt = atk === 'siege' ? 'Захват' : atk === 'raze' ? 'Обстрел' : atk === 'plant' ? 'Подсунуть' : atk === 'spy' ? 'Шпион' : 'Сыграть';
        const rk = 'retire:' + id + ':' + i;
        left = (c.plot && modOn('plots') ? `<button class="sq" data-act="plot" data-i="${i}" ${dis || !canPlot ? 'disabled' : ''}>${gico(c.plot === 'dice' ? 'dice' : 'plot')}<span>Замысел</span></button>` : '')
          + (E.canSeat(S, id) ? `<button class="sq" data-act="court-seat" data-i="${i}" ${dis ? 'disabled' : ''}>${gico('seat')}<span>Ко двору</span></button>` : '')
          + (R.retire !== false && !p.turn.retired ? (armedOn(rk) ? `<button class="sq warn" data-act="retire" data-i="${i}" ${dis ? 'disabled' : ''}>${gico('trash')}<span>Точно?</span></button>` : `<button class="sq" data-act="retire" data-i="${i}" ${dis || E.faithBan(S, p, 'no_retire') ? 'disabled' : ''}>${gico('trash')}<span>Отставка</span></button>`) : '')
          + `<button class="sq" data-act="desel" aria-label="Отмена">${'<span class="em">✕</span>'}<span>Отмена</span></button>`;
        const eff = miniChips(f.play, 3);
        pa = `<button class="primary${atk ? ' atk' : ''}" data-act="play" data-i="${i}" ${dis || oath ? 'disabled' : ''}><span>${oath ? 'Обет: нельзя' : playTxt}</span>${oath ? '' : `<small class="pfx">${eff}</small>`}</button>`;
      } else if (!p.turn.rolled) {
        const all = p.hand.length > 1 ? `<button class="second all" data-act="play-all" ${busy ? 'disabled' : ''}>Сыграть<small>все карты</small></button>` : '';
        const tray = (n) => `<button class="tdie-w${all ? ' cmp' : ''}" data-act="roll" data-n="${n}" ${busy ? 'disabled' : ''} aria-label="Бросить ${n === 2 ? 'два кубика' : 'кубик'}">${kbd(n)}<span class="dd">${Array.from({ length: n }, (_, k) => `<span class="tdie">${pipsHtml(k ? 3 : 5)}</span>`).join('')}</span><small>${n === 2 ? '2 кубика' : '1 кубик'}</small></button>`;
        const one = E.cursed(p, 'evileye') || E.sinned(p, 'sloth') || E.faithBan(S, p, 'oneDie') || (E.mods(S, p).peek || 0) > 0;
        const fd = p.forceDice ? (p.forceDice.n === 2 && !(E.cursed(p, 'evileye') || E.sinned(p, 'sloth') || E.faithBan(S, p, 'oneDie')) ? 2 : 1) : 0; // чудо соперника «Нашёптанная судьба»
        pa = all + (fd ? tray(fd) : one ? tray(1) : tray(1) + tray(2));
      } else {
        const lf = E.buysLeft(S, p);
        const xa = lf <= 0 && E.extraOn(S, p) && !p.turn.extraBought ? `<button class="second" data-act="xaction" ${busy || !E.canBuyAction(S, p) ? 'disabled' : ''}>+1 действие<small>${E.extraCost(S, p)}${gico('gold')}</small></button>` : '';
        const el = endLeft(p);
        const all = p.hand.filter(id => !D.COURT[id].bad).length > 1 && !xa ? `<button class="second all" data-act="play-all" ${busy ? 'disabled' : ''}>Сыграть<small>все карты</small></button>` : '';
        pa = xa + all + (armedOn('end') ? `<button class="primary warn" data-act="end" ${busy ? 'disabled' : ''} aria-label="Точно завершить ход? Не сделано: ${esc(el)}"><span>Завершить?</span>${el ? `<em class="armnote">Не сделано: ${esc(el)}</em>` : ''}</button>` : `<button class="primary" data-act="end" ${busy ? 'disabled' : ''}><span>Завершить ход</span>${lf > 0 && canAfford(p) ? '<small>действие осталось</small>' : (() => { const ex = extrasOf(p).filter(x => x.hard); return ex.length ? `<small>ещё можно: ${ex.map(x => x.t).join(', ')}</small>` : ''; })()}</button>`);
      }
    } else {
      const cur = S.players[S.cur];
      const sp = { slow: 'медленно', normal: 'обычно', fast: 'быстро' }[speed];
      if (guest()) pa = status(NETG.pending ? 'Отправляем ход…' : cur.i === ME ? 'Ваш ход начинается…' : `Ходят ${esc(H(cur).short)}`, cur.i !== ME && !cur.isBot ? (cur.nick ? esc(cur.nick) : 'живой игрок') : esc(netStatusLine()));
      else if (hostNet() && seatOf(cur) === 'remote' && !cur.isBot) { const off = peerOff(cur); pa = status(`Ходят ${esc(H(cur).short)}${cur.nick ? ` · ${esc(cur.nick)}` : ''}`, off ? 'нет связи с игроком' : 'игрок по сети') + (off ? `<button class="second" data-act="net-bot" data-i="${cur.i}">Ход<small>ботом</small></button>` : ''); }
      else pa = status(WATCH ? esc(H(cur).short) : cur.i === ME ? 'Ваш ход начинается…' : `Ходят ${esc(H(cur).short)}`, hotseat() && !cur.isBot ? 'игрок за этим устройством' : WATCH ? `ходят ${sp}` : `боты ходят ${sp}`) + (WATCH ? `<button class="second" data-act="pause"><span class="em">${paused ? '▸' : 'Ⅱ'}</span><small>${paused ? 'дальше' : 'пауза'}</small></button>` : '') + (cur.isBot ? '<button class="second" data-act="speed" aria-label="Скорость ботов"><span class="em">»</span><small>скорость</small></button>' : '');
    }
    // на устройстве с клавиатурой главная кнопка подписана клавишей
    if (hoverOk && pa.split('class="primary').length === 2) pa = pa.replace(/(<button class="primary[^>]*>)/, '$1' + kbd('↵'));
    return `${left}<div class="pa">${pa}</div>`;
  }

  // какие числа кубика у игрока уже приносят доход — и владениями какого типа (точки цвета типа)
  function numsStrip(p) {
    const cells = [];
    for (let r = 1; r <= 12; r++) {
      const ds = p.estates.filter(e => !e.ruined && D.ESTATES[e.id].n.includes(r)).map(e => D.ESTATES[e.id]);
      cells.push(`<span class="nc${ds.length ? '' : ' no'}"><b>${r}</b><span>${ds.slice(0, 4).map(d => `<i class="t-${d.bad ? 'bad' : d.t}"></i>`).join('')}</span></span>`);
    }
    const free = cells.filter(c => / no"/.test(c)).length;
    return `<div class="drow"><div class="dlab"><b>Ваши числа</b><span>${free ? 'точки — ваши владения на этом числе' : 'все числа закрыты'}</span></div><div class="nstrip" role="img" aria-label="Числа кубика, на которых срабатывают ваши владения">${cells.join('')}</div></div>`;
  }
  // ---------- лист «Рынок» ----------
  const drawerHead = (title, p, sub, panel) => `<div class="dh"><b>${title}</b><span class="dsub">${sub}</span>${WATCH ? '' : `<span class="dgold" role="img" aria-label="У вас золота: ${shownGold(p)}"><small>у вас</small>${gico('gold')}<b>${shownGold(p)}</b></span>`}${panel ? '' : '<button class="dx" data-act="drawer-close" aria-label="Закрыть">✕</button>'}</div>`;
  // большой экран: рынок и знамёна открыты всегда — подбираем плотность рядов под высоту панели
  function shopPlan(p) {
    const mr = 2 + ((S.holdRow || []).length ? 1 : 0) + (Object.keys(D.ESTATES).some(id => D.ESTATES[id].basic && cardOk('estate', id)) ? 1 : 0);
    const rr = ['v', 'l', 'g'].filter(t => needT(t)).length + (modOn('faith') ? 1 : 0);
    const mw = L.mw || 86;
    const need = (rows, k) => rows * (mw * [118 / 86, 104 / 86, 92 / 86][k] + [32, 28, 26][k] + [38, 32, 27][k]);
    const pick = (rows, avail, extra) => { for (let k = 0; k < 3; k++) for (const ex of [true, false]) if (need(rows, k) + (ex ? extra : 0) <= avail) return { cls: ['', 'dense', 'tight'][k], extra: ex }; return { cls: 'tight', extra: false }; };
    const cu = isMyTurn() && cuOn(p) ? 64 : 0;
    if (L.mode === 'wide') return { mk: pick(mr, L.panelH - 62, 66), rg: pick(rr, L.panelH - 62 - cu, 62) };
    const both = pick(mr + rr, L.panelH - 124 - cu, 128);
    return { mk: both, rg: both };
  }
  // short: 1 — короче, 2 — совсем коротко: рядом с «у вас N» в шапке мало места (телефон, узкая колонка планшета)
  function turnSub(p, short) {
    const my = isMyTurn() && !WATCH;
    if (!my) return short ? 'не ваш ход' : 'не ваш ход — можно посмотреть';
    if (!p.turn.rolled) return short ? 'после броска' : 'покупки — после броска';
    const left = E.buysLeft(S, p);
    return left > 0 ? `действий: <b>${left}</b>` : cuOn(p) ? (short > 1 ? '<b>ещё вассал</b>' : short ? 'наём: <b>ещё вассал</b>' : 'догоняющий наём: <b>ещё вассал</b>') : 'действий нет';
  }
  // шапка колонки на большом экране: самая полная подсказка, что помещается в одну строку (ширины замерены для 12,5px Inter и «у вас 888»)
  const panelSub = (p, pre) => { const w = L.panelW || 999; return pre ? `${pre}${w >= 489 ? ` · ${turnSub(p)}` : w >= 394 ? ` · ${turnSub(p, 1)}` : w >= 366 ? ` · ${turnSub(p, 2)}` : ''}` : turnSub(p, w < 412 ? 1 : 0); };
  function marketDrawer(p, panel) {
    const my = isMyTurn() && !WATCH, left = E.buysLeft(S, p);
    const btn = (src, key, id, isEstate) => {
      const def = isEstate ? D.ESTATES[id] : D.COURT[id];
      const price = E.marketPrice(S, p, def.cost, !isEstate);
      const pr = `${price !== def.cost ? `<s>${def.cost}</s>` : ''}<b>${price}</b>${gico('gold')}`;
      if (WATCH) return `<span class="buyb">${pr}</span>`;
      const freeOk = !!E.fairOf(S, p, src === 'est' || src === 'estateTop' ? 'estate' : src === 'courtTop' ? 'court' : src, id);
      let why = '';
      if (!my) why = ' '; else if (!p.turn.rolled) why = 'после броска'; else if (left <= 0 && !freeOk) why = 'действий нет';
      else if (isEstate && !E.canOwnEstate(p, id)) why = D.ESTATES[id].t === 'hold' ? 'уже есть твердыня' : 'уже есть'; else if (src === 'basic' && E.basicLeft(S, id) <= 0) why = 'кончились'; else if (p.gold < price) why = `не хватает ${price - p.gold}`;
      return `<button class="buyb${why ? '' : ' ok'}" data-act="buy" data-src="${src}" data-key="${key}" ${why || busy || adjustReq ? 'disabled' : ''} aria-label="${why.trim() ? esc(why) : `Купить за ${price}`}"><span>${freeOk && !why ? 'Ярмарка · ' : ''}${pr}</span>${why.trim() ? `<span>${esc(why)}</span>` : ''}</button>`;
    };
    const mark = (k, idx) => { const m = rfMark(k, idx); return m ? { cls: m.cls, badge: `<span class="tag rf">${m.act ? '↻ под колоду' : '↻ уйдёт'}</span>`, act: m.act } : {}; };
    const fe = flipsFor('est', S.estateRow), fc = flipsFor('court', S.courtRow);
    let dealing = false;
    const slot = (kind, id, o, below) => { const fd = dealOf(o.flip); if (fd != null) dealing = true; return `<div class="mslot">${mcard(kind, id, { cls: [o.cls || '', fd != null ? 'deal' : ''].join(' ').trim(), badge: o.badge, act: o.act, fd })}${below}</div>`; };
    const row = (title, sub, deck, cards) => `<div class="drow"><div class="dlab"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}${deck != null ? `<span class="dk">в колоде ${deck}</span>` : ''}</div><div class="dcards">${cards}</div></div>`;
    const rfS = (k) => (rfNow(k) ? '↻ обновляется' : rfSoon(k) ? '↻ не возьмёте — крайняя уйдёт' : '');
    let out = '';
    // чудо «Ясновидение»: верхняя карта колоды — ещё одна карта ряда (видит только её хозяин)
    const seer = !WATCH && !!E.mods(S, p).deckTop, topOf = (d) => E.deckTopOf(d), eye = { cls: 'seer', badge: '<span class="tag eye">👁 верх колоды</span>' };
    out += row('Владения', rfS('estate'), S.estateDeck.length, S.estateRow.map((id, k) => slot('estate', id, Object.assign({ flip: fe[k] }, mark('estate', k)), btn('estate', k, id, true))).join('') + (seer && topOf(S.estateDeck) ? slot('estate', topOf(S.estateDeck), eye, btn('estateTop', 0, topOf(S.estateDeck), true)) : ''));
    const holds = S.holdRow || [];
    if (holds.length) out += row('Твердыни', 'у вас каждая — по одной', null, holds.map((id, k) => slot('estate', id, {}, btn('hold', k, id, true))).join(''));
    out += row('Двор', rfS('court') || 'купленная карта — в ваш сброс', S.courtDeck.length, S.courtRow.map((id, k) => slot('court', id, Object.assign({ flip: fc[k] }, mark('court', k)), btn('court', k, id, false))).join('') + (seer && topOf(S.courtDeck) ? slot('court', topOf(S.courtDeck), eye, btn('courtTop', 0, topOf(S.courtDeck), false)) : ''));
    const basics = Object.keys(D.ESTATES).filter(id => D.ESTATES[id].basic && cardOk('estate', id));
    if (basics.length) out += row('Всегда в продаже', 'пока есть в запасе', null, basics.map(id => slot('estate', id, { cls: E.basicLeft(S, id) <= 0 ? 'dim' : '' }, btn('basic', id, id, true))).join(''));
    if (dealing) dealSoon();
    const xa = my && p.turn.rolled && left <= 0 && E.extraOn(S, p) && !p.turn.extraBought ? `<p class="dnote">Действия кончились. Можно купить <b>ещё одно</b> за ${E.extraCost(S, p)}${gico('gold')} — кнопка внизу.</p>` : '';
    if (panel) return drawerHead('Рынок', p, panelSub(p), true) + `<div class="dbody ${panel.cls}">${xa}${out}${WATCH || !panel.extra ? '' : numsStrip(p)}</div>`;
    const dense = holds.length > 0 || basics.length > 0;
    return drawerHead('Рынок', p, turnSub(p, window.innerWidth < 390 ? 1 : 0)) + `<div class="dbody${dense ? ' dense' : ''}">${xa}${out}${WATCH ? '' : numsStrip(p)}${dense ? '' : '<p class="dnote">Нажмите на карту — она откроется крупно: с пояснением и кнопкой покупки. Владение ложится на стол, карта двора — в сброс.</p>'}</div>`;
  }
  // ---------- лист «Знамёна» (и вера) ----------
  function regaliaDrawer(p, panel) {
    const my = isMyTurn() && !WATCH && p.i === ME;
    const hire = (id) => {
      const bn = D.BAN[id], pc = banPriceHtml(p, id), c = pc.c;
      const pr = `${c.total !== c.base ? `<s>${c.base}</s>` : ''}<b>${c.total}</b>${gico('gold')}`;
      const up = '';
      if (!my) return `<span class="buyb"><span>${pr}</span></span>`;
      const block = E.hireBlock(S, p, id);
      const cuHire = p.turn.catchupHire > 0 && (!R.catchupTier || bn.tier === R.catchupTier);
      const why = block ? (/больше не нужно/.test(block) ? 'уже хватает' : /вера/i.test(block) ? 'запрет веры' : block) : !p.turn.rolled ? 'после броска' : E.buysLeft(S, p) <= 0 && !cuHire ? 'действий нет' : p.gold < c.total ? `не хватает ${c.total - p.gold}` : '';
      return `<button class="buyb${why ? '' : ' ok'}" data-act="hire" data-id="${id}" ${why || busy || adjustReq ? 'disabled' : ''} aria-label="${why ? esc(why) : `Нанять за ${c.total}`}"><span>${pr}</span>${why ? `<span>${esc(why)}</span>` : ''}</button>${up}`;
    };
    let dealing = false;
    const block = (t, title, row, deck) => {
      const need = needT(t); if (!need) return '';
      const have = tierList(p, t).length, ids = (row || []).slice();
      const fg = flipsFor('ban' + t, ids);
      const done = have >= need;
      const cards = ids.map((id, k) => { const m = rfMark(t, k) || {}; const fd = dealOf(fg[k]); if (fd != null) dealing = true; return `<div class="mslot">${mcard('ban', id, { o: p.i, cls: [m.cls || '', done ? 'dim' : '', fd != null ? 'deal' : ''].join(' ').trim(), badge: m.badge ? `<span class="tag rf">${m.act ? '↻ под колоду' : '↻ уйдёт'}</span>` : '', act: m.act, fd })}${done ? '' : hire(id)}</div>`; }).join('')
        + (t === 'l' && p.heir && !done ? `<div class="mslot">${mcard('ban', p.heir, { o: p.i, cls: 'mine' })}${hire(p.heir)}</div>` : '')
        + (!WATCH && !done && E.mods(S, p).deckTop && E.deckTopOf(deck) ? `<div class="mslot">${mcard('ban', E.deckTopOf(deck), { o: p.i, cls: 'seer', badge: '<span class="tag eye">👁 верх колоды</span>' })}${hire(E.deckTopOf(deck))}</div>` : ''); // чудо «Ясновидение»
      const ups = [...new Set(ids.concat(t === 'l' && p.heir ? [p.heir] : []).map(id => D.BAN[id].upkeep || 0))].filter(Boolean);
      const sub = done ? `у вас уже ${have} из ${need}` : `у вас ${have} из ${need}${ups.length ? ` · содержание ${ups.join('–')}${gico('gold')} в ход` : ''}${rfNow(t) ? ' · ↻ обновляется' : rfSoon(t) ? ' · ↻ крайняя уйдёт' : ''}`;
      return `<div class="drow"><div class="dlab"><b>${title}</b><span>${sub}</span><span class="dk">в колоде ${(deck || []).length}</span></div><div class="dcards">${cards || '<span class="mmeta">ряд пуст</span>'}</div></div>`;
    };
    let out = '';
    if (my && cuOn(p)) out += `<div class="cubox2"><b>Догоняющий наём:</b> ${cuWhy(p, true)} — в этот ход можно нанять ещё одного вассала без действия. <button class="link" data-act="cu-why">Почему?</button></div>`;
    if (!panel || panel.extra) { const pr = E.prod(S, p); out += `<div class="symline"><em>Ваши значки — скидка на знамёна того же направления:</em>${SYMS5.map(s => `<button class="sy1${pr[s] ? '' : ' no'}" data-act="res" data-s="${s}" data-i="${p.i}" aria-label="${esc(D.SYM_NAME[s])}: ${pr[s]}">${gico(s)}<b>${pr[s]}</b></button>`).join('')}</div>`; }
    out += block('v', 'Вассалы', S.vRow, S.vDeck) + block('l', 'Лорды', S.lRow, S.lDeck) + block('g', 'Великие лорды', S.gRow, S.gDeck);
    if (modOn('faith')) out += faithRow(p, my);
    if (dealing) dealSoon();
    if (panel) return drawerHead('Знамёна', p, panelSub(p, `${E.regCount(p)} из ${E.goal(S)}`), true) + `<div class="dbody ${panel.cls}">${out}</div>`;
    return drawerHead('Знамёна', p, `${window.innerWidth < 360 ? '' : `${E.regCount(p)} из ${E.goal(S)} · `}${turnSub(p, 1)}`) + `<div class="dbody">${out}<p class="dnote">Нужно ${goalTxt()}. Каждый ваш значок направления знамени даёт скидку 1${gico('gold')}. Наём тратит действие.${needT('l') && p.heir ? ' Карта в золотой рамке — ваш Наследник: он есть только у вас и считается лордом.' : ''}</p></div>`;
  }
  function faithRow(p, my) {
    const mx = E.faithMax(S, p), st = E.faithStage(S, p), cn = E.faithCandles(S, p);
    const cards = (S.faithRow || []).map(f => {
      const F = D.FAITHS[f], mine = p.faiths.includes(f);
      const r = E.faithReq(S, p, f), why = E.canAdopt(S, p, f);
      let below;
      if (mine) {
        const rw = my ? E.riteBlock(S, p, f) : ' ';
        below = (my ? `<button class="buyb${rw ? '' : ' ok'}" data-act="rite" data-id="${f}" ${rw || busy ? 'disabled' : ''}><span>Обряд</span>${rw && rw.trim() ? `<span>${esc(rw)}</span>` : ''}</button>` : '') + `<span class="mmeta">ступень ${['I', 'II', 'III'][st - 1] || 'I'} · ${gico('faith')}${cn}</span>` + (my && !(F.oath === 'no_renounce' && !E.oathFree(p)) ? `<button class="link small" data-act="renounce" data-id="${f}" ${busy ? 'disabled' : ''}>Отречься</button>` : '');
      } else {
        const need = `${r.need.faith ? `${gico('faith')}${r.need.faith}` : ''}${r.dir && r.need.dir ? ` ${gico(r.dir)}${r.need.dir}` : ''}` || 'ничего';
        below = (my ? `<button class="buyb${why ? '' : ' ok'}" data-act="adopt" data-id="${f}" ${why || busy ? 'disabled' : ''} aria-label="${why ? 'Не хватает значков' : 'Принять веру'}"><span>${why ? need : 'Принять'}</span></button>` : `<span class="buyb"><span>${need}</span></span>`)
          + (why && my && !/знач|🕯|нужн/i.test(why) ? `<span class="mmeta">${esc(why)}</span>` : '');
      }
      const who = S.players.filter(q => q !== p && (q.faiths || []).includes(f)).map(q => esc(H(q).short));
      return `<div class="mslot">${mcard('faith', f, { cls: mine ? 'mine' : '' })}${below}${who.length ? `<span class="mmeta">${who.join(', ')}</span>` : ''}</div>`;
    }).join('');
    return `<div class="drow"><div class="dlab"><b>Вера</b><span>${p.faiths.length ? p.faiths.map(f => esc(D.FAITHS[f].name)).join(' и ') : 'принять — бесплатно, когда хватает значков'}${mx > 1 ? ` · можно ${mx}` : ''}</span></div><div class="dcards">${cards}</div></div>`;
  }

  // ---------- лист «Мой двор»: всё, что работает постоянно, и колода ----------
  function showMy() {
    if (!S) return;
    const p = S.players[viewIdx()], pr = E.prod(S, p), mine = p.i === ME && !WATCH, my = mine && isMyTurn();
    const tmp = (s) => (p.temp[s] ? `<sup>+${p.temp[s]}</sup>` : '');
    const dp = E.dawnParts(S, p) || [];
    const dwhy = (k) => { const x = dp.find(y => y.k === k); return x && x.why ? `<div class="incx">🌅 ${esc(whyTxt(x.why))}</div>` : ''; };
    const base = E.dawnGold(S, p, {}).g;
    const dawnOf = (mods) => (mods ? Math.max(0, E.dawnGold(S, p, mods).g - base) : 0);
    const dawnB = (v) => (v > 0 ? `<span class="pcb dawn">🌅 +${v}🪙</span>` : '');
    const wrap = (card, w) => (w ? pslot(card, w) : card);
    const dg = E.dawnGold(S, p, E.mods(S, p)), up = E.upkeepOf(p), bans = E.allBans(p), dist = p.distracted && p.distracted.id;
    let h = `<div class="res">${SYMS5.map(s => `<button class="rsb" data-act="res" data-s="${s}" data-i="${p.i}" aria-label="${esc(D.SYM_NAME[s])}: откуда">${D.SYM[s]} ${pr[s]}${tmp(s)}</button>`).join('')}${modOn('sieges') ? `<button class="rsb" data-act="res" data-s="walls" data-i="${p.i}" aria-label="Стены: откуда">🧱 ${E.walls(S, p)}</button>` : ''}</div>`;
    if (dg.g || up) h += `<p class="note">🌅 В начале вашего хода: ${dg.g ? `+${dg.g}🪙 (${esc(dg.src.join(', '))})` : 'дохода нет'}${up ? `; содержание −${up}🪙` : ''}.</p>`;
    h += `<div class="sec-h"><h3>Дом и знамёна</h3><span>${E.regCount(p)}/${E.goal(S)} · действуют всегда</span></div><div class="pgrid mini">${wrap(pcard('house', p.house, { badge: dawnB(dawnOf(D.HOUSES[p.house].mods)) }), dwhy('house:' + p.house))}${bans.map(id => (dist === id ? pcard('ban', id, { o: p.i, st: 'built', cls: 'built', badge: '<span class="pcb tag">отвлечён</span>' }) : wrap(pcard('ban', id, { o: p.i, st: 'built', cls: 'built', badge: dawnB(dawnOf(D.BAN[id].mods)) }), dwhy('ban:' + id)))).join('')}</div>`;
    if (!bans.length) h += `<p class="muted" style="margin:0;font-size:13px">Знамён пока нет — нанять можно ${L.big ? `в колонке «Знамёна» ${shopSide()}` : 'кнопкой «Знамёна» внизу стола'}.</p>`;
    if (modOn('faith') && (p.faiths || []).length) { const st = E.faithStage(S, p); h += `<div class="sec-h"><h3>Вера</h3><span>ступень ${['I', 'II', 'III'][st - 1]} · 🕯${E.faithCandles(S, p)}</span></div><div class="pgrid mini">${p.faiths.map(f => wrap(pcard('faith', f, { cls: 'built', badge: `<span class="pcb own">🕯 ${['I', 'II', 'III'][st - 1]}</span>` }), dwhy('faith:' + f))).join('')}</div>`; }
    if (modOn('faith') && (p.faiths || []).length) h += ritualHtml(p, mine, my);
    h += seatsHtml(p, mine);
    if (modOn('plots')) {
      h += `<div class="sec-h"><h3>Замыслы</h3><span>${p.plots.length}/${E.plotSlots(S, p)}</span></div>`;
      h += p.plots.length ? (mine ? `<div class="pgrid mini">${p.plots.map(pl => pcard('court', pl.id, { badge: `<span class="pcb tag">${pl.kind === 'dice' ? `🎲 ${pl.nums.join(', ')}` : '⏳ след. ход'}</span>` })).join('')}</div>` : `<p class="muted" style="margin:0">${D.cards(p.plots.length)} рубашкой вверх.</p>`) : '<p class="muted" style="margin:0">Нет замыслов. Карту с ⏳ или 🎲 можно не сыграть, а отложить: эффект будет сильнее, но позже.</p>';
    }
    if (mine) {
      if (p.inPlay.length) h += `<div class="sec-h"><h3>Сыграно в этот ход</h3><span>уже в сбросе</span></div><div class="pgrid mini">${p.inPlay.map(id => pcard('court', id)).join('')}</div>`;
      const tr = (p.trashed || []).length, dn = p.discard.length + p.inPlay.length;
      { const fl = my ? E.fetchLeft(S, p) : 0; if (fl > 0 && dn) h += `<p class="note">${fl > 1 ? `Из сброса можно взять в руку ещё ${D.cards(fl)}` : 'Из сброса можно взять в руку карту'} — откройте сброс и выберите.</p>`; }
      h += `<div class="sec-h"><h3>Колода двора</h3><span>всего карт ${p.deck.length + p.discard.length + p.hand.length + p.inPlay.length + p.plots.length}</span></div><div class="piles"><button class="pile-b" data-act="pile" data-w="deck">${deckHtml('court', p.deck.length, 'Колода')}<span class="pl"><b>Колода</b> ${p.deck.length}</span></button><button class="pile-b" data-act="pile" data-w="discard">${deckHtml('court', dn, 'Сброс')}<span class="pl"><b>Сброс</b> ${dn}</span></button>${tr ? `<button class="pile-b" data-act="pile" data-w="trashed">${deckHtml('court', tr, 'Убраны')}<span class="pl"><b>Убраны</b> ${tr}</span></button>` : ''}</div>`;
    }
    const bads = p.estates.filter(e => D.ESTATES[e.id].bad);
    if (bads.length) h += `<div class="sec-h"><h3>⬛ Проклятия</h3><span>снять — действие и ${R.purgeCost || 2}🪙</span></div><div class="pgrid mini">${bads.map(e => { const why = my ? E.purgeBlock(S, p, e) : null; return pslot(pcard('estate', e.id, { o: p.i }), my ? `<button class="btn small ${why ? '' : 'primary'}" data-act="purge" data-uid="${e.uid}" ${why || busy || adjustReq ? 'disabled' : ''}>${why ? esc(why) : `Снять · ${R.purgeCost || 2}🪙`}</button>` : ''); }).join('')}</div>`;
    // грехи (v10.15): лежат перед игроком; покаяние начинают отсюда
    if (modOn('faith') && ((p.sins || []).length || p.penance)) {
      const why = my ? E.penanceBlock(S, p) : null;
      const pen = p.penance ? `<p class="note">🕯 Покаяние идёт: сделан шаг ${p.penance.step} из 4. Следующий — в начале вашего хода, до броска.</p>` : '';
      const btn = my && !p.penance ? `<p class="note"><button class="btn small ${why ? '' : 'primary'}" data-act="penance" ${why || busy || adjustReq ? 'disabled' : ''}>${why ? esc(why) : '🕯 Начать покаяние'}</button></p>` : '';
      h += `<div class="sec-h"><h3>😈 Грехи</h3><span>снять — только покаянием</span></div>${pen}<div class="pgrid mini">${(p.sins || []).map(id => pcard('court', id, { o: p.i })).join('')}${pcard('court', 'penance')}</div>${btn}`;
    }
    if (modOn('unions')) {
      const u = E.unionsOf(p);
      h += `<div class="sec-h"><h3>Союзы провинций</h3><span>${u.fast ? `первые ${u.fast} — из 2 владений, дальше — из ${u.late}` : `каждые ${u.size} владения провинции`}</span></div><div class="unions">${['N', 'S', 'E', 'W'].map(k => { const pv = D.PROV[k], c = u.counts[k], left = E.unionNeed(p, k); return `<div class="union ${u[k] ? 'done' : ''}"><b>${pv.icon} ${pv.name}: ${u[k] ? `союз${u[k] > 1 ? ` ×${u[k]}` : ''}` : `${c}/${c + left}`}</b><br><span class="muted">ещё ${left} ${D.plural(left, 'владение', 'владения', 'владений')} до ${u[k] ? 'следующего' : 'союза'}</span></div>`; }).join('')}</div>`;
    }
    h += `<div class="sec-h"><h3>Значки</h3><span>правила, которые работают сами</span></div><div class="rtiles">${ruleTiles(p)}</div>`;
    if (modOn('balance')) h += `<div class="sec-h"><h3>Общий стол</h3><span>Зависть и поддержка</span></div><div class="pgrid mini">${balanceCards().join('')}</div>`;
    const m = E.mods(S, p), sg = modOn('sieges'), sp = modOn('spy');
    if (sg || sp) h += `<div class="sec-h"><h3>Оборона</h3><span>${sg && sp ? 'против нападений и шпионов' : sg ? 'против нападений' : 'против шпионов'}</span></div><dl class="kv">${sg ? `<dt>Против захвата и разрушения</dt><dd>⚔️ ${pr.war} + 🧱 ${E.walls(S, p)}${(m.defense || 0) + (m.shield || 0) ? ` + ${(m.defense || 0) + (m.shield || 0)} (свойства)` : ''} + кубик${m.captureImmune ? '. Ваши владения нельзя захватить и разрушить' : ''}</dd>` : ''}${sp ? `<dt>Против шпиона</dt><dd>🔗 ${pr.int} + 🧱 ${E.spyWalls(S, p)}${E.spyWalls(S, p) < E.walls(S, p) ? ' (замок — вполовину)' : ''}${(m.guard || 0) + (m.shield || 0) ? ` + ${(m.guard || 0) + (m.shield || 0)} (свойства)` : ''} + кубик</dd>` : ''}</dl>`;
    openSheet({ title: `${H(p).sigil} ${esc(H(p).name)}`, body: `<div class="oppbody">${h}</div>` });
  }
  // итог броска подробно: кто что получил и почему
  function showRoll() {
    const rv = rvShown();
    if (!S || !rv || !S.players[rv.a]) { if (S) showLog(); return; }
    openSheet({ title: `Бросок ${rv.r}: ${rv.a === ME && !WATCH ? 'ваш' : esc(H(S.players[rv.a]).gen)}`, body: `<div class="oppbody">${rollHtml(rv, false, true)}</div>` });
  }

  // ---------- главное меню ----------
  function savedInfo() {
    if (!savedGame) return null;
    try { const x = JSON.parse(savedGame.S); const me = savedGame.ME != null ? x.players[savedGame.ME] : null; return { round: x.round, house: me ? me.house : null, watch: !!savedGame.WATCH, tut: !!x.tut, net: x.net ? x.net.code : null, hot: x.players.filter(q => !q.isBot && (q.seat || 'local') === 'local').length > 1 }; } catch (e) { return null; }
  }
  // гость: в какой комнате играл — чтобы вернуться после перезагрузки страницы
  function netSaved() { if (!NETOK) return null; try { const x = JSON.parse(localStorage.getItem(NET_KEY) || 'null'); return x && x.code && x.cid ? x : null; } catch (e) { return null; } }
  function forgetNetSession() { try { localStorage.removeItem(NET_KEY); } catch (e) { /* ignore */ } }
  // ---------- запомненная пара: два устройства снова садятся за один стол одной кнопкой, без кода ----------
  // хозяин открывает ту же комнату, гость стучится в неё; счёт партий ведёт каждое устройство само
  const PAIR_KEY = 'pretendenty-pair-v1';
  function pairGet() { if (!NETOK) return null; try { const x = JSON.parse(localStorage.getItem(PAIR_KEY) || 'null'); return x && x.code && (x.role === 'host' || x.role === 'guest') ? x : null; } catch (e) { return null; } }
  function pairPut(x) { try { localStorage.setItem(PAIR_KEY, JSON.stringify(x)); } catch (e) { /* ignore */ } }
  function pairSet(x) { const old = pairGet(), same = old && old.code === x.code && old.role === x.role; pairPut(Object.assign({ w: same ? old.w | 0 : 0, l: same ? old.l | 0 : 0, last: same ? old.last || '' : '' }, x, { at: Date.now() })); }
  function pairForget() { try { localStorage.removeItem(PAIR_KEY); } catch (e) { /* ignore */ } }
  function pairScore() {
    const x = pairGet();
    if (!x || !S || S.winner === null || !S.net || S.net.code !== x.code || S.players.length !== 2 || ME === null || (S.gid && x.last === S.gid)) return;
    if (S.winner === ME) x.w = (x.w | 0) + 1; else x.l = (x.l | 0) + 1;
    x.last = S.gid || ''; pairPut(x);
  }
  // стол на троих-четверых запоминается так же: хозяин открывает прежнюю комнату, гости входят без кода
  const TABLE_KEY = 'pretendenty-table-v1';
  function tableGet() { if (!NETOK) return null; try { const x = JSON.parse(localStorage.getItem(TABLE_KEY) || 'null'); return x && x.code && x.n > 2 && (x.role === 'host' || x.role === 'guest') ? x : null; } catch (e) { return null; } }
  function tableSet(x) { try { localStorage.setItem(TABLE_KEY, JSON.stringify(Object.assign({ at: Date.now() }, x))); } catch (e) { /* ignore */ } }
  const pairLine = (x) => ((x.w | 0) + (x.l | 0) ? `счёт ${x.w | 0} : ${x.l | 0}` : '');
  function duoGo(pr) {
    closeAllSheets(); closeAllPages();
    if (pr.role === 'guest') { guestJoin(pr.code, pr.name || '', pr.cid); if (NETG) NETG.pair = true; return; }
    setup.seats = [Object.assign({ house: 'random' }, setup.seats[0] || {}, { type: 'remote' })];
    fixSetup(); savePrefs(); hostCreate();
  }
  function showDuo() {
    const pr = pairGet();
    const sh = openSheet({ title: 'Играть вдвоём', body: `<div class="optlist">
      <button class="opt" data-f="host" ${NETOK ? '' : 'disabled'}><span class="big">🌐</span><span><b>Создать комнату</b><br><span class="muted">${NETOK ? 'это устройство ведёт партию, второй игрок входит по коду' : 'по сети — только в отдельной версии игры (файл index.html)'}</span></span><span class="r">›</span></button>
      <button class="opt" data-f="join" ${NETOK ? '' : 'disabled'}><span class="big">🔑</span><span><b>Войти по коду</b><br><span class="muted">комнату создал второй игрок</span></span><span class="r">›</span></button>
      <button class="opt" data-f="hot"><span class="big">📱</span><span><b>На одном устройстве</b><br><span class="muted">ходите по очереди; карты каждого скрыты от другого</span></span><span class="r">›</span></button></div>
      ${NETOK ? `<p class="muted" style="font-size:13px;margin:8px 0 0">После первой партии по сети устройства запомнят друг друга: дальше — одна кнопка «Играть вдвоём», без кода.</p>` : ''}
      ${pr ? `<p style="margin:12px 0 0"><button class="link" data-f="forget">Забыть пару (комната ${esc(pr.code)})</button></p>` : ''}` });
    sh.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-f]'); if (!b || b.disabled) return;
      sh.close();
      const f = b.dataset.f, one = (type) => [Object.assign({ house: 'random' }, setup.seats[0] || {}, { type })];
      if (f === 'forget') { pairForget(); toast('Пара забыта: в следующий раз — снова по коду'); schedule(); return; }
      if (f === 'hot') { setup.seats = one('local'); view = 'setup'; }
      else if (f === 'host') { setup.seats = one('remote'); view = 'setup'; }
      else view = 'join';
      fixSetup(); savePrefs(); schedule();
    });
  }
  function renderHome() {
    app.classList.add('start-mode');
    barEl.hidden = true;
    const si = savedInfo();
    const ns = netSaved();
    const hs = Object.keys(D.HOUSES);
    const pr = pairGet();
    const duoSub = pr ? [pr.role === 'host' ? (pr.peer ? `с игроком ${esc(pr.peer)}` : 'ваша комната') : 'без кода', `комната ${esc(pr.code)}`, pairLine(pr)].filter(Boolean).join(' · ') : NETOK ? 'два устройства — один стол' : 'на одном устройстве, по очереди';
    app.innerHTML = `<section class="home">
      <div class="home-hero">
        <div class="emblem" aria-hidden="true"><img src="${IMG('icons/i_crown.svg')}" alt=""></div>
        <span class="kicker">Карточная игра</span>
        <h1>Претенденты</h1>
        <div class="orn" aria-hidden="true"><i></i><b>◆</b><i></i></div>
        <p>Король умер без наследника.<br>${({6:'Шесть',7:'Семь',8:'Восемь',9:'Девять',10:'Десять'}[hs.length] || hs.length)} Домов спорят за трон.</p>
        <div class="crests">${hs.map(h => `<img src="${IMG(`icons/h_${h}.svg`)}" alt="${esc(D.HOUSES[h].name)}" title="${esc(D.HOUSES[h].name)}">`).join('')}</div>
      </div>
      <div class="home-acts">
        ${ns ? `<button class="btn primary big" data-act="net-rejoin"><span>Вернуться в партию по сети</span><small>комната ${esc(ns.code)}</small></button>` : ''}
        ${si ? `<button class="btn ${ns ? '' : 'primary '}big" data-act="continue"><span>Продолжить партию</span><small>${si.tut ? 'обучение' : si.watch ? 'партия ботов' : si.net ? `по сети, комната ${esc(si.net)}` : si.hot ? 'на одном устройстве' : si.house ? esc(D.HOUSES[si.house].short) : 'партия'} · круг ${si.round}</small></button>` : ''}
        <button class="btn ${si || ns ? '' : 'primary '}big duo" data-act="duo"><span>Играть вдвоём</span><small>${duoSub}</small></button>
        ${pr ? '<button class="link duo-other" data-act="duo-other">другая пара · по коду · на одном устройстве</button>' : ''}
        <button class="btn big" data-act="setup"><span>Новая партия</span><small>против ботов · Дом, соперники и правила</small></button>
        <button class="btn big" data-act="tutorial"><span>🎓 Обучение</span><small>базовые правила с подсказками</small></button>
      </div>
      <nav class="htiles" aria-label="Справка и настройки">
        <button class="ht" data-act="friends"><span class="hti" aria-hidden="true">👥</span><span>Друзья</span></button>
        <button class="ht" data-act="rules"><span class="hti">${gico('econ')}</span><span>Правила</span></button>
        <button class="ht" data-act="aid"><span class="hti">${gico('plot')}</span><span>Памятка</span></button>
        <button class="ht" data-act="catalog"><span class="hti">${gico('card')}</span><span>Все карты</span></button>
        <button class="ht" data-act="settings"><span class="hti" aria-hidden="true">⚙︎</span><span>Настройки</span></button>
      </nav>
      ${LINKS.tutorial || LINKS.catalog ? `<nav class="list" aria-label="Ссылки">${LINKS.tutorial ? `<a class="li" href="${LINKS.tutorial}" target="_blank" rel="noopener">${gico('dawn')}<span>Учебник</span><i aria-hidden="true">↗</i></a>` : ''}${LINKS.catalog ? `<a class="li" href="${LINKS.catalog}" target="_blank" rel="noopener">${gico('banner')}<span>Каталог карт</span><i aria-hidden="true">↗</i></a>` : ''}</nav>` : ''}
      <p class="foot">версия ${VERSION}</p>
    </section>`;
  }

  // ---------- новая партия ----------
  function renderSetup() {
    app.classList.add('start-mode');
    fixSetup();
    const hs = Object.keys(D.HOUSES);
    const av = availHouses();
    const pk = presetOf(setup.mods);
    const nOn = MODK.filter(setupOn).length;
    app.innerHTML = `<header class="nav"><button class="nav-back" data-act="home">‹ Меню</button><h1>Новая партия</h1><span class="nav-r"></span></header>
      <div class="startbox">
        <h2 class="lbl">Длина партии</h2>
        <div class="seg presets">${Object.entries(D.LENGTHS).map(([k, x]) => `<button class="${lengthOf(setup.mods) === k ? 'on' : ''}" data-act="length" data-k="${k}">${x.name}</button>`).join('')}</div>
        <p class="pdesc">${D.LENGTHS[lengthOf(setup.mods)].desc} ${av.length} ${D.plural(av.length, 'Дом', 'Дома', 'Домов')}, до ${Math.min(av.length, R.maxPlayers)} игроков.</p>
        <details class="mods"${modsOpen || !pk ? ' open' : ''}><summary>Модули · включено ${nOn} из ${MODK.length}</summary>
          <div class="modlist">${MODK.map(k => { const x = D.MODULES[k]; return `<button class="mod ${setupOn(k) ? 'on' : ''}" data-act="mod" data-k="${k}" role="switch" aria-checked="${setupOn(k)}"><span class="sw" aria-hidden="true"></span><span class="mi">${x.icon}</span><span><b>${x.name}</b><span class="muted">${x.desc}</span></span></button>`; }).join('')}</div>
        </details>
        <h2 class="lbl">Ваш Дом</h2>
        <div class="houses">${hs.map(h => { const x = D.HOUSES[h]; const ok = av.includes(h); const need = needOf('house', h); return `<button class="house ${setup.house === h ? 'on' : ''} ${ok ? '' : 'off'}" data-act="pick" data-h="${h}" ${ok ? '' : 'disabled'}><img class="sgi" src="${IMG(`icons/h_${h}.svg`)}" alt=""><b>${x.name}</b><span class="pth">${x.path}</span>${ok ? `<span class="ab muted">${x.about}</span><span class="ab">${x.ability}</span><span class="ab st">Старт: ${R.startGold + (x.gold || 0)}🪙 · ${x.estates.map(id => D.ESTATES[id].name).join(', ')}</span>` : `<span class="ab need">Нужен модуль «${modName(need)}»</span>`}</button>`; }).join('')}</div>
        <div class="sec-h"><h2 class="lbl">Соперники · ${setup.seats.length}</h2><span class="seat-n"><button class="btn small" data-act="seat-del" aria-label="Убрать игрока" ${setup.seats.length > 1 ? '' : 'disabled'}>−</button><button class="btn small" data-act="seat-add" aria-label="Добавить игрока" ${setup.seats.length < Math.min(av.length - 1, R.maxPlayers - 1) ? '' : 'disabled'}>+</button></span></div>
        <div class="seats">${setup.seats.map((s, k) => seatEditor(s, k, av)).join('')}</div>
        <p class="muted seatnote"><b>Человек</b> играет на этом же устройстве: передаёте его по очереди, карты каждого скрыты от остальных. <b>По сети</b> — со своего телефона по коду комнаты${NETOK ? '' : ' (только в отдельной версии игры — файл index.html)'}.</p>
        ${setup.seats.some(x => x.type === 'bot') ? `<h2 class="lbl">Сила ботов</h2><div class="seg wide skill" role="radiogroup" aria-label="Сила ботов">${Object.entries(E.SKILL_NAMES).map(([k, n]) => `<button role="radio" aria-checked="${setup.skill === k}" class="${setup.skill === k ? 'on' : ''}" data-act="skill" data-k="${k}">${n}</button>`).join('')}</div><p class="pdesc">${SKILL_DESC[setup.skill]}</p>` : ''}
        <p class="goalnote">Цель — первым собрать ${goalLine()}.</p>
        <button class="link" data-act="watch">Смотреть партию ботов</button>
      </div>`;
    barEl.hidden = false;
    barEl.dataset.focus = '';
    barEl.innerHTML = `<div class="in"><button class="btn primary" data-act="start">${hasRemote() ? 'Создать комнату' : `Начать партию · ${esc(D.HOUSES[setup.house].name)}`}</button></div>`;
  }
  const SKILL_DESC = { novice: 'Часто ошибается: покупает наугад и не спешит со знамёнами. Для первых партий.', normal: 'Играет по простым правилам — каждый ход выбирает самое выгодное сейчас.', strong: 'Перед каждым действием просчитывает несколько кругов вперёд.', expert: 'Просчитывает дальше и больше вариантов; думает до полутора секунд за ход.' };
  // одно место за столом: кто играет и каким Домом
  function seatEditor(s, k, av) {
    const taken = new Set([setup.house, ...setup.seats.filter((x, j) => j !== k && x.house !== 'random').map(x => x.house)]);
    const types = [['bot', 'Бот'], ['local', 'Человек'], ['remote', 'По сети']];
    const crest = s.house !== 'random' ? `<img class="sgi" src="${IMG(`icons/h_${s.house}.svg`)}" alt="">` : '<span class="sgi rnd" aria-hidden="true">?</span>';
    return `<div class="seat">${crest}<div class="seat-b"><div class="seg wide" role="radiogroup" aria-label="Игрок ${k + 2}">${types.map(([v, l]) => `<button role="radio" aria-checked="${s.type === v}" class="${s.type === v ? 'on' : ''}" data-act="seat-type" data-k="${k}" data-v="${v}" ${v === 'remote' && !NETOK ? 'disabled' : ''}>${l}</button>`).join('')}</div>
      <select class="hsel" data-ch="seat-house" data-k="${k}" aria-label="Дом игрока ${k + 2}"><option value="random"${s.house === 'random' ? ' selected' : ''}>Случайный Дом</option>${av.map(h => `<option value="${h}"${s.house === h ? ' selected' : ''}${taken.has(h) ? ' disabled' : ''}>${esc(D.HOUSES[h].name)}</option>`).join('')}</select></div></div>`;
  }

  // ---------- игра: запуск ----------
  // ---------- раздача в начале партии: владения выкладываются, колода тасуется, карты приходят в руку ----------
  let introT = 0, introTm = 0, introRes = null;
  const INTRO_MS = 2500;
  function introStart() {
    introEnd();
    if (!flyOn()) return Promise.resolve();
    introT = performance.now() + INTRO_MS; dealHold = 1500;
    document.body.classList.add('dealing');
    if (sound) { [150, 390, 630].forEach(t => setTimeout(() => { if (introT) Sfx.place(); }, t)); setTimeout(() => { if (introT) Sfx.shuffle(); }, 1000); }
    return new Promise(res => { introRes = res; introTm = setTimeout(introEnd, INTRO_MS); });
  }
  function introEnd() {
    clearTimeout(introTm);
    if (introT) { introT = 0; document.body.classList.remove('dealing'); }
    if (introRes) { const r = introRes; introRes = null; r(); }
  }
  function resetTable() {
    introEnd(); tileHolds.length = 0;
    endTurnResolve = null; adjustReq = null; busy = false; diceView = null; paused = false; coverReq = null;
    rollView = null; rollPrev = null; turnRec = null; lastRec = null; nextReq = null;
    coinQ = []; coinWaiters.splice(0); throwKey = null; selCard = null; drawer = null; oppFocus = null; coachMin = null; seenUid.clear(); seenInit = false; zoneHtml = {}; popQ.splice(0); stgKill(); oppMoments = []; throwP = null; chipRoll = null; if (stepReq) { const r = stepReq; stepReq = null; r.res(); }
    for (const k in goldSeen) delete goldSeen[k];
    for (const k in pops) delete pops[k];
  }
  // имена в журнале: «(вы)» — только когда человек за столом один
  function fixNames() {
    const humans = S.players.filter(q => !q.isBot || q.away).length;
    for (const q of S.players) q.name = H(q).short + (humans === 1 && !q.isBot ? ' (вы)' : '');
  }
  // места за столом → игроки движка; порядок мест — порядок хода (кто первый — решает жребий)
  function playersOf(seats) {
    return seats.map(s => ({ house: s.house, isBot: s.type === 'bot', persona: s.type === 'bot' ? ((E.NATURAL && E.NATURAL[s.house]) || 'base') : 'base', skill: s.type === 'bot' ? setup.skill : 'normal', name: D.HOUSES[s.house].short }));
  }
  function startGame(watch, opts = {}) {
    runId++;
    closeAllSheets(); closeAllPages();
    resetTable();
    fixSetup();
    const houses = availHouses();
    const bot = (h) => ({ type: 'bot', house: h });
    let seats;
    if (opts.tut) seats = [{ type: 'local', house: 'deer' }, bot('serpent')];
    else if (watch) seats = shuffleArr(houses).slice(0, setup.seats.length + 1).map(bot);
    else if (opts.seats) seats = opts.seats;
    else {
      const taken = new Set([setup.house, ...setup.seats.map(s => s.house).filter(h => h !== 'random')]);
      const free = shuffleArr(houses.filter(h => !taken.has(h)));
      seats = [{ type: 'local', house: setup.house }, ...setup.seats.map(s => ({ type: s.type === 'remote' ? 'bot' : s.type, house: s.house === 'random' ? free.pop() : s.house }))];
    }
    WATCH = watch;
    ME = watch ? null : Math.max(0, seats.findIndex(s => s.type === 'local'));
    const players = playersOf(seats);
    S = E.newGame(opts.tut ? { players, seed: TUT_SEED, first: 0, modules: D.PRESETS.basic.modules } : { players, modules: setup.mods });
    S.players.forEach((p, i) => { p.seat = seats[i].type; if (seats[i].cid) p.cid = seats[i].cid; if (seats[i].nick) p.nick = seats[i].nick; });
    fixNames();
    if (opts.net && NETG) S.net = { code: NETG.code };
    S.gid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6); // номер партии: по нему гость отличает новую партию в той же комнате
    if (opts.tut) S.tut = { turns: 0, seen: [], q: [], off: false, lastInc: null };
    if (!opts.tut) savePrefs();
    window.scrollTo(0, 0);
    // раздача: игра начнётся, когда карты лягут (или по касанию); гостям стол уходит сразу — у них своя раздача
    const my = runId, deal = introStart();
    schedule();
    if (opts.net) netFlush(true);
    deal.then(() => { if (my === runId && S) { gameLoop(); if (opts.net) netFlush(true); } });
  }
  function resumeGame(saved) {
    runId++;
    closeAllSheets();
    resetTable();
    S = JSON.parse(saved.S); ME = saved.ME; WATCH = !!saved.WATCH;
    if (S.mod && !('seats' in S.mod)) S.mod.seats = false; // партия начата до модуля «Придворные»
    for (const q of S.players) if (!q.seats) q.seats = [];
    // игрок по сети, за которого играл бот, снова сам по себе — вернётся, когда подключится
    for (const q of S.players) if (q.away) { q.isBot = false; q.away = false; }
    if (S.net) { if (NETOK) hostReopen(); else for (const q of S.players) if (seatOf(q) === 'remote') { q.isBot = true; q.seat = 'bot'; } }
    fixNames();
    diceView = S.lastRoll ? { ...S.lastRoll, final: true } : null;
    schedule();
    gameLoop();
    if (hostNet()) netFlush(true);
  }
  async function gameLoop() {
    const my = runId;
    try {
      while (S && S.winner === null) {
        if (my !== runId) return;
        saveSafe();
        const cur = S.players[S.cur];
        await E.runTurn(S);
        if (my !== runId) return;
        // после хода бота — сводка и пауза до «Дальше» (в партии по сети не ждём: остановили бы всех)
        if (cur.isBot && ME !== null && !WATCH && !NETG && S.winner === null && turnRec && turnRec.p === cur.i) {
          lastRec = turnRec;
          if (pauseBots) {
            await new Promise(res => { nextReq = { res }; schedule(); });
            if (my !== runId) return;
          }
        }
      }
    } catch (e) {
      if (e instanceof Stale) return;
      console.error(e);
      toast('Ошибка: ' + esc(e.message), 6000);
      return;
    }
    if (my !== runId) return;
    clearSave();
    pairScore();
    schedule();
    if (music) { Music.stop(); Music.victory(); }
    const g = runId;
    setTimeout(() => { if (g === runId) showVictory().then(() => { if (g === runId) showResults(); }); }, 500);
  }
  // ---------- момент победы: герб победителя, знамёна, золотое конфетти — потом итоги ----------
  function showVictory() {
    if (!S || S.winner === null || !flyOn() || document.querySelector('.victory')) return Promise.resolve();
    return new Promise((res) => {
      const w = S.players[S.winner], me = hotseat() || WATCH ? null : ME, won = me !== null && S.winner === me, n = E.regCount(w);
      const el = document.createElement('div'); el.className = 'victory' + (won ? ' won' : '');
      el.setAttribute('role', 'status');
      const cols = ['#f6d581', '#f5ecd6', '#d9a53c', '#cf5a4e', '#4f84cc', '#3f9c93'];
      const conf = Array.from({ length: 42 }, (_, k) => `<i class="cf" style="--x:${(Math.random() * 100).toFixed(1)}%;--d:${(Math.random() * 0.9).toFixed(2)}s;--t:${(1.9 + Math.random() * 1.4).toFixed(2)}s;--r:${Math.round(Math.random() * 360)}deg;--c:${cols[k % cols.length]};--w:${6 + (k % 4) * 2}px"></i>`).join('');
      el.innerHTML = `<div class="vic-rays" aria-hidden="true"></div><div class="vic-conf" aria-hidden="true">${won || me === null ? conf : ''}</div>
        <div class="vic-in"><img class="vic-crest" src="${IMG(`icons/h_${w.house}.svg`)}" alt=""><h2>${won ? 'Победа!' : me === null ? `Победа: ${esc(H(w).name)}` : `Победил ${esc(H(w).name)}`}</h2>
        <p>${won ? 'Вы собрали' : 'Под знамёнами'} ${D.banners(n)}${S.timeout ? ' — время вышло' : ''}</p>
        <div class="vic-flags" aria-hidden="true">${Array.from({ length: Math.min(12, n) }, (_, k) => `<i style="--k:${k}"></i>`).join('')}</div><small>коснитесь, чтобы продолжить</small></div>`;
      document.body.appendChild(el);
      let over = false;
      const end = () => { if (over) return; over = true; el.classList.add('out'); setTimeout(() => { el.remove(); res(); }, 280); };
      el.addEventListener('click', end);
      setTimeout(end, won ? 3600 : 2600);
    });
  }
  function showResults() {
    if (!S || S.winner === null) return;
    if (pageRoot.querySelector('.page.results:not(.out)')) return;
    const w = S.players[S.winner];
    const cap = modOn('sieges') || modOn('spy');
    const me = hotseat() ? null : ME; // на одном устройстве «вы» — это все, кто за ним сидел
    const won = me !== null && S.winner === me;
    const list = [...S.players].sort((a, b) => (b.i === S.winner) - (a.i === S.winner) || E.regCount(b) - E.regCount(a) || b.gold - a.gold);
    const who = (q) => (q.i === me ? `Вы · ${H(q).short}` : H(q).short) + (q.nick ? ` · ${q.nick}` : q.isBot && S.players.some(x => !x.isBot) && hotseat() ? ' · бот' : '');
    const rows = list.map((q, k) => `<li class="${q.i === S.winner ? 'win' : ''} ${q.i === me ? 'me' : ''}"><span class="rk">${k + 1}</span><img src="${IMG(`icons/h_${q.house}.svg`)}" alt=""><span class="nm"><b>${esc(who(q))}</b><small>владений ${q.estates.length} · ${q.gold}🪙${cap ? ` · захватов ${q.stats.captured}, разрушено ${q.stats.destroyed || 0}` : ''}${modOn('faith') && (q.faiths || []).length ? ` · ${q.faiths.map(f => D.FAITHS[f].icon).join('')}` : ''}</small></span><span class="st"><b>🚩 ${E.regCount(q)}/${E.goal(S)}</b></span></li>`).join('');
    const title = me !== null ? (won ? 'Победа!' : 'Партия окончена') : hotseat() ? `Победа: ${esc(H(w).name)}` : 'Партия окончена';
    const len = `${S.round} ${D.plural(S.round, 'круг', 'круга', 'кругов')}`;
    const sub = won ? `Вы собрали ${D.banners(E.regCount(w))} за ${len}.` : me === null && hotseat() ? `${S.timeout ? 'По числу знамён: время вышло. ' : ''}Партия длилась ${len}.` : `Победил ${esc(H(w).name)}${S.timeout ? ' — по числу знамён, время вышло' : ''}. Партия длилась ${len}.`;
    openPage({ title: 'Итоги', back: 'К столу', cls: 'results', body: `<div class="res-hero ${won ? 'won' : ''}"><div class="res-crest"><img src="${IMG(`icons/h_${w.house}.svg`)}" alt=""></div><h2>${title}</h2><p>${sub}</p></div>
      <ol class="podium">${rows}</ol>
      ${pairRes()}
      <div class="res-acts">${S.tut ? '<button class="btn primary big" data-act="new"><span>Новая партия</span></button>' : `<button class="btn primary big" data-act="again"><span>${WATCH ? 'Ещё партия ботов' : 'Сыграть ещё'}</span><small>${againSub()}</small></button>${guest() ? '' : '<button class="btn big" data-act="new"><span>Новая партия</span><small>другие Дома, соперники, правила</small></button>'}`}<button class="btn big" data-act="home"><span>Главное меню</span></button></div>
      ${statsHtml(list, me)}` });
    againUi();
  }
  // счёт серии для запомненной пары
  function pairRes() {
    const x = pairGet();
    if (!x || !S.net || S.net.code !== x.code || S.players.length !== 2 || ME === null || !((x.w | 0) + (x.l | 0))) return '';
    return `<p class="res-score">Счёт серии: <b>вы ${x.w | 0} : ${x.l | 0} ${esc(H(S.players[1 - ME]).short)}</b></p>`;
  }

  // ---------- инфо-листы ----------
  // ---------- подробно по нажатию: простыми словами, с примером и с числами игрока ----------
  const pct = (x) => (x > 0 && x < 0.01 ? '<1' : String(Math.round(x * 100))) + '%';
  function chanceTxt(nums) {
    const p1 = nums.reduce((t, r) => t + E.pRoll(1, r), 0), p2 = nums.reduce((t, r) => t + E.pRoll(2, r), 0);
    return `1 кубик — ${p1 ? pct(p1) : 'никогда'}, 2 кубика — ${p2 ? pct(p2) : 'никогда'}`;
  }
  // чьи числа показывать: владелец (из листа соперника), иначе вы, в наблюдении — кто ходит
  // где сейчас карты веры f: у веры (достанутся первому принявшему), у игрока или убраны из игры
  function faithCardsAt(f) {
    const ids = (D.FAITHS[f].cards || []).filter(id => D.COURT[id]);
    return ids.map(id => {
      if (!S || !(S.faithRow || []).includes(f) || !S.faithPool) return { id, at: 'pool' };
      if ((S.faithPool[f] || []).includes(id)) return { id, at: 'pool' };
      for (const q of S.players) {
        if (['deck', 'hand', 'discard', 'inPlay', 'seats'].some(k => (q[k] || []).includes(id)) || (q.plots || []).some(x => x.id === id)) return { id, at: 'player', q };
      }
      return { id, at: 'gone' };
    });
  }
  // лист веры: её 2 карты картинками — нажатие открывает карту крупно; ниже — кому достанутся и что при отречении
  function faithCardsHtml(f) {
    const at = faithCardsAt(f); if (!at.length) return '';
    const inGame = !!S && (S.faithRow || []).includes(f) && modOn('faith');
    const tag = (x) => !inGame ? '' : x.at === 'pool' ? '<span>у веры</span>' : x.at === 'player' ? `<span class="${x.q.i === ME ? 'own' : ''}">${x.q.i === ME ? 'у вас' : `у ${esc(E.shortG(x.q))}`}</span>` : '<span class="miss">убрана из игры</span>';
    const moved = inGame && at.some(x => x.at !== 'pool'); // подписи под картами — только когда кто-то их уже забрал
    const cards = at.map(x => pslot(pcard('court', x.id), moved ? `<span class="pmeta">${tag(x)}</span>` : '')).join('');
    let who;
    if (!inGame || at.every(x => x.at === 'pool')) who = `Первому, кто примет веру: ${at.length > 1 ? 'обе карты' : 'карта'} сразу в его сброс, дальше — в его колоду.`;
    else if (at.every(x => x.at === 'player' && x.q === at[0].q)) who = `Уже ${at[0].q.i === ME ? 'у вас' : `у ${esc(E.shortG(at[0].q))}`}: ${at[0].q.i === ME ? 'вы приняли' : 'они приняли'} веру первыми.`;
    else who = at.map(x => `«${esc(D.COURT[x.id].name)}» — ${x.at === 'pool' ? 'у веры' : x.at === 'player' ? (x.q.i === ME ? 'у вас' : `у ${esc(E.shortG(x.q))}`) : 'убрана из игры'}`).join('; ') + '.';
    return `<div class="fcards"><div class="fch"><b>Карты веры</b><span>замешаются в колоду принявшего</span></div><div class="pgrid">${cards}</div></div>`
      + exHtml([['Кому', who], ['Отречение', 'Кто отрёкся — эти карты уходят из его колоды обратно к вере. Их получит следующий, кто её примет.']]);
  }
  // лист веры (v10.16): два её ритуала; лист ритуала — как проходят условия
  function faithRitualsHtml(f) {
    const ids = Object.keys(D.RITUALS || {}).filter(id => D.RITUALS[id].faith === f);
    if (!ids.length) return '';
    return `<div class="fcards"><div class="fch"><b>Ритуалы</b><span>два на выбор, чудо — с каждого</span></div><div class="pgrid">${ids.map(id => pslot(pcard('ritual', id), ritBtn(id, true))).join('')}</div></div>`;
  }
  // v10.17 (ответ владельца 2.3): карта веры на столе открывает лист веры, обряд — этой кнопкой, без подтверждения
  function riteBtn(f) {
    if (!S || WATCH || !modOn('faith')) return '';
    const p = S.players[ME], F = D.FAITHS[f];
    if (!p || !F || !(p.faiths || []).includes(f)) return '';
    const why = isMyTurn() && S.players[S.cur] === p ? E.riteBlock(S, p, f) : 'Обряд — в свой ход';
    return `<p class="note rite-go"><button class="btn small ${why ? '' : 'primary'}" data-act="rite-go" data-id="${f}" ${why || busy || adjustReq ? 'disabled' : ''}>${why ? esc(why) : `🕯 Провести обряд «${esc(F.rite.name)}»`}</button></p>`;
  }
  // v10.17: начать ритуал прямо с его карты — на листе ритуала и на листе веры (просьба владельца: не только через «Двор»)
  // compact — кнопка под картой в сетке; иначе — строка под крупной картой
  function ritBtn(id, compact) {
    if (!S || WATCH || !modOn('faith')) return '';
    const p = S.players[ME], W = D.RITUALS[id];
    if (!p || !W || !(p.faiths || []).includes(W.faith) || !E.ritualOn(S, id)) return '';
    const n = p.ritual && p.ritual.id === id ? p.ritual.marks.filter(Boolean).length : 0;
    if ((p.miracles || []).includes(id)) return compact ? '<span class="pmeta"><span class="own">🌟 чудо ваше</span></span>' : '<p class="note">🌟 Ритуал пройден — чудо ваше.</p>';
    if (p.ritual && p.ritual.id === id) return compact ? `<span class="pmeta"><span class="own">✨ идёт · ${n} из ${W.steps.length}</span></span>` : `<p class="note">✨ Ритуал идёт: отметок ${n} из ${W.steps.length}. Жертва и милостыня — на странице «Двор».</p>`;
    const why = isMyTurn() ? E.ritualBlock(S, p, id) : 'Начать — в свой ход';
    const b = `<button class="btn small ${why ? '' : 'primary'}" data-act="ritstart" data-id="${id}" ${why || busy || adjustReq ? 'disabled' : ''}>${why ? esc(why) : p.ritual ? 'Начать вместо текущего' : '✨ Начать ритуал'}</button>`;
    return compact ? b : `<p class="note">${b}${p.ritual && !why ? ' Отметки текущего ритуала сгорят.' : ''}</p>`;
  }
  function ritualRows(id) {
    const W = D.RITUALS[id];
    return exHtml([['Начать', `в свой ход, без действия: вы приняли «${esc(D.FAITHS[W.faith].name)}», на вас нет грехов и Проклятой реликвии`],
      ['Условия', 'в любом порядке. Жертва и милостыня — кнопкой на странице «Двор»; сбор — как только это у вас есть (руины не в счёт); подвиг — после начала ритуала; воздержание — ходы подряд'],
      ['Грех', 'сжигает отметки ритуала, а готовое чудо молчит, пока грех лежит. Отреклись от веры — чудеса этой веры уходят', 'hl']]);
  }
  const exHtml = (rows) => !rows.filter(Boolean).length ? '' : `<div class="ex">${rows.filter(Boolean).map(([k, v, cls]) => `<div class="ex-r${cls ? ' ' + cls : ''}"><div class="ex-k">${k}</div><div class="ex-v">${v}</div></div>`).join('')}</div>`;

  // v10.10 (как у карт двора в 10.9): в листе владения — только то, чего нет на карте.
  // Земли, Ремёсла, Набеги, Твердыни и Каменная стена — без строк: доход, пара, значок, стены, цена напечатаны на карте.
  // Проклятия (v10.14) — две короткие строки: как их подбрасывают и как снять.
  function estateRows(id) {
    const d = D.ESTATES[id];
    if (!d || d.t !== 'bad') return [];
    return [
      ['Что это', `Купленное проклятие к вам не идёт — его сразу подбрасывают сопернику шпионажем (+${R.plantSpy || 3}🔗). Удача — оно лежит у него и действует всегда, провал — обратно в колоду владений.`],
      ['Как снять', `В свой ход после броска: действие и ${R.purgeCost || 2}🪙 — проклятие уходит в колоду владений.`],
    ];
  }

  // v10.9 (разбор листов с владельцем): в листе карты двора — только то, чего нет на самой карте.
  // Эффект, свита, замысел, «При дворе» и роль напечатаны на карте; общие правила (атака, свита, двор, замыслы, беды) — в «Правилах».
  // Остаются: у карт нападения — как начать атаку; у козней — что карта уходит в колоду двора.
  function courtRows(id) {
    const c = D.COURT[id], atk = attackOf(id);
    if (c && c.scheme) return [['Нападение', 'Козни: сыграйте в свой ход — игра спросит, против кого. Удача или провал — карта уходит в колоду двора.', 'hl']];
    if (atk === 'spy') return [['Нападение', 'Подсылает шпиона: сыграйте в свой ход — игра спросит, к кому.', 'hl']];
    if (atk) return [['Нападение', 'Начинает осаду: сыграйте в свой ход — игра спросит, кого осаждать.', 'hl']];
    return [];
  }
  // лист подробностей карты: d — данные карты на столе (act, id / key, kind, o — чей стол, st — состояние знамени)
  function infoParts(d) {
    if (d.act === 'info-estate') { const x = D.ESTATES[d.id]; if (!x) return null; const T = D.ETYPE[x.t]; return { title: `${T.mark} ${esc(x.name)}`, body: `<div class="ex-pc">${pcard('estate', d.id, { big: true })}</div>${exHtml(estateRows(d.id))}` }; }
    if (d.act === 'info-court') { const c = D.COURT[d.id]; if (!c) return null; return { title: esc(c.name), body: `<div class="ex-pc">${pcard('court', d.id, { big: true })}</div>${exHtml(courtRows(d.id))}` }; }
    // v10.10: у знамени всё напечатано на карте (значок, свойство, «При найме», содержание); причину «нанять нельзя» показывает планка покупки
    if (d.act === 'info-ban') { const b = D.BAN[d.key]; if (!b) return null; return { title: esc(b.name), body: `<div class="ex-pc">${pcard('ban', d.key, { big: true })}</div>${offNote(b.mods)}` }; }
    if (d.act === 'zoom') { const m = d.kind === 'house' ? D.HOUSES[d.id].mods : d.kind === 'faith' ? D.FAITHS[d.id].mods : null; return { title: esc(pcName(d.kind, d.id)), body: `<div class="ex-pc">${pcard(d.kind, d.id, { big: true })}</div>${d.kind === 'faith' && D.FAITHS[d.id] ? riteBtn(d.id) : ''}${m ? offNote(m) : ''}${d.kind === 'faith' && D.FAITHS[d.id] ? faithCardsHtml(d.id) + faithRitualsHtml(d.id) : ''}${d.kind === 'ritual' ? ritBtn(d.id) + ritualRows(d.id) : ''}` }; }
    return null;
  }
  // ---------- листать открытую карту влево-вправо: соседние карты того же экрана, в том порядке, как они лежат; по кругу ----------
  const NAV_ACTS = ['info-estate', 'info-court', 'info-ban', 'zoom'];
  const cardData = (el) => ({ act: el.dataset.act, id: el.dataset.id, key: el.dataset.key, kind: el.dataset.kind, o: el.dataset.o, st: el.dataset.st, shop: !!(el.closest('.mslot') && el.closest('.board')) });
  // живая кнопка «купить / нанять / принять» для карты, открытой из ряда рынка или знамён
  function shopBtnFor(d) {
    if (!d || !d.shop || !S) return null;
    const want = d.act === 'info-ban' ? d.key : d.id;
    for (const sl of app.querySelectorAll('.board .mslot')) {
      const c = sl.querySelector('.mcard'), cd = c && c.dataset;
      if (!cd || cd.act !== d.act || (cd.id || cd.key) !== want || (d.kind || '') !== (cd.kind || '')) continue;
      const bb = sl.querySelector('.buyb[data-act]') || sl.querySelector('.buyb');
      if (bb) return bb;
    }
    return null;
  }
  // планка покупки в листе карты: «Купить за 5» или серая с причиной; рядом — сколько золота у игрока
  function buyBarHtml(d) {
    if (!S || WATCH || ME === null || !S.players[ME] || S.winner !== null) return '';
    if (d && d.hand) {
      // выбранная карта руки: та же кнопка, что на нижней планке («Сыграть», «Захват» …)
      const pb = isMyTurn() ? app.querySelector('.abar [data-act="play"]') : null; if (!pb) return '';
      const t = (pb.querySelector('span') || pb).textContent.trim(), fx = pb.querySelector('.pfx');
      return `<button class="btn primary big buyp${pb.disabled ? ' off' : ''}" data-buyproxy ${pb.disabled ? 'disabled' : ''}><span>${esc(t)}</span><small>${pb.disabled ? '' : fx && fx.innerHTML.trim() ? fx.innerHTML : 'карта уйдёт в сброс'}</small></button>`;
    }
    const bb = shopBtnFor(d); if (!bb) return '';
    const act = bb.dataset.act || '', sp = [...bb.children].filter(x => x.tagName === 'SPAN');
    const price = act === 'adopt' || act === 'rite' ? '' : (sp[0] ? sp[0].innerHTML : bb.innerHTML);
    const live = bb.tagName === 'BUTTON' && !bb.disabled;
    const why = live ? '' : bb.tagName !== 'BUTTON' || !isMyTurn() ? 'не ваш ход' : ((sp[1] && sp[1].textContent.trim()) || (act === 'adopt' ? 'не хватает значков' : busy ? 'подождите…' : 'сейчас нельзя'));
    const verb = act === 'hire' ? 'Нанять' : act === 'adopt' ? 'Принять веру' : act === 'rite' ? 'Провести обряд' : 'Купить';
    const mine = `у вас ${gico('gold')}<b>${shownGold(S.players[ME])}</b>`;
    // для чтения вслух: зачёркнутая старая цена и новая не должны слиться в одно число
    const pn = price && sp[0] ? sp[0].querySelector('b') : null, po = price && sp[0] ? sp[0].querySelector('s') : null;
    const say = pn ? `${live ? `${verb} за ${pn.textContent.trim()}` : `${why.charAt(0).toUpperCase()}${why.slice(1)}. Цена ${pn.textContent.trim()}`}${po ? `, было ${po.textContent.trim()}` : ''}. У вас золота: ${shownGold(S.players[ME])}` : '';
    return `<button class="btn primary big buyp${live ? '' : ' off'}" data-buyproxy ${say ? `aria-label="${esc(say)}" ` : ''}${live ? '' : 'disabled'}><span>${live ? `${verb}${price ? ` за ${price}` : ''}` : `${why.charAt(0).toUpperCase()}${why.slice(1)}`}</span><small>${act === 'adopt' || act === 'rite' ? (live && act === 'adopt' ? 'бесплатно — значков хватает' : '') : live || !price ? mine : `цена ${price} · ${mine}`}</small></button>`;
  }
  const navKey = (d) => [d.act, d.id || '', d.key || '', d.kind || '', d.o || '', d.st || ''].join('|');
  function navFrom(el) {
    const CARD = '.pcw[data-act], .mcard[data-act], .tile[data-act]';
    if (!el.matches(CARD)) return null; // открыли не с карты (значок веры, плашка) — листать нечего
    const scope = el.closest('.fcards') || el.closest('.catbody') || el.closest('.oppbody') || el.closest('.drawer') || el.closest('.shop') || el.closest('.tiles') || (el.closest('.scrim, .page') ? null : app);
    if (!scope) return null;
    const seen = new Set(), list = [];
    for (const x of scope.querySelectorAll(CARD)) {
      if (!NAV_ACTS.includes(x.dataset.act) || !x.offsetParent) continue;
      const d = cardData(x), k = navKey(d);
      if (!seen.has(k)) { seen.add(k); list.push(d); }
    }
    const i = list.findIndex(d => navKey(d) === navKey(cardData(el)));
    return list.length > 1 && i >= 0 ? { list, i } : null;
  }
  // крупная карта для соседей в ленте листания — та же, что в листе подробностей
  const bigCard = (d) => d.act === 'info-ban' ? pcard('ban', d.key, { big: true }) : d.act === 'zoom' ? pcard(d.kind, d.id, { big: true }) : pcard(d.act === 'info-estate' ? 'estate' : 'court', d.id, { big: true });
  function showInfo(d, nav) {
    const parts = infoParts(d);
    if (!parts) return;
    const sh = openSheet(parts);
    // карта из ряда рынка или знамён: внизу листа — планка «Купить», она не уезжает при прокрутке
    let cur = d;
    const bar = document.createElement('div'); bar.className = 'buybar';
    sh.el.querySelector('.sheet').appendChild(bar);
    const drawBuy = () => { const h = buyBarHtml(cur); if (bar.dataset.h !== h) { bar.dataset.h = h; bar.innerHTML = h; bar.hidden = !h; } };
    drawBuy();
    const buyTm = setInterval(() => { if (!sh.el.isConnected || sh.el.classList.contains('out')) { clearInterval(buyTm); return; } drawBuy(); }, 400);
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-buyproxy]'); if (!b || b.disabled) return;
      const want = cur, big = sh.el.querySelector('.sbody .ex-pc .pcw'), r = big ? big.getBoundingClientRect() : null;
      sh.close();
      // лист закрывается — и карта летит с того места, где её рассматривали
      setTimeout(() => {
        const lv = want.hand ? app.querySelector('.abar [data-act="play"]') : shopBtnFor(want);
        if (!lv || lv.tagName !== 'BUTTON' || lv.disabled) return;
        flyFrom = !want.hand && r && r.width ? r : null; lv.click(); flyFrom = null;
      }, reduceMotion() ? 0 : 170);
    });
    if (!nav) return;
    const sheet = sh.el.querySelector('.sheet'), n = nav.list.length;
    const at = (k) => nav.list[((nav.i + k) % n + n) % n];
    const decorate = (dir) => CardNav.decorate(sheet.querySelector('.sbody .ex-pc'), { i: nav.i, n, dir, peek: (k) => bigCard(at(k)) });
    const step = (k) => {
      nav.i = ((nav.i + k) % n + n) % n;
      const p2 = infoParts(nav.list[nav.i]); if (!p2) return;
      sheet.querySelector('h2').innerHTML = p2.title;
      sheet.querySelector('.sbody').innerHTML = p2.body;
      cur = nav.list[nav.i]; drawBuy();
      decorate(k); sheet.scrollTop = 0;
    };
    CardNav.bind(sheet, { active: () => !sh.el.classList.contains('out') && sh.el.isConnected, step });
    decorate(0);
    sh.el.navGo = (k) => CardNav.go(sheet, k);
  }
  function infoEstate(id, o) { showInfo({ act: 'info-estate', id, o }); }
  function infoCourt(id, o) { showInfo({ act: 'info-court', id, o }); }
  function infoBan(key, o, st) { showInfo({ act: 'info-ban', key, o, st }); }
  // Дом, сезон, титул, провинция: просто крупно — прочитать мелкий текст
  function showPile(p, w) {
    // v10.18: и у соперника. Его колода — вместе с рукой («deckhand»): какие карты в руке, не видно; порядок колоды скрыт
    const own = p.i === viewIdx(), whose = own ? '' : ` ${esc(H(p).gen)}`;
    const list = w === 'deck' ? p.deck : w === 'deckhand' ? [...p.deck, ...p.hand] : w === 'discard' ? p.discard : (p.trashed || []);
    const n = {}; for (const id of list) n[id] = (n[id] || 0) + 1;
    const ids = Object.keys(n).sort((a, b) => D.COURT[a].cost - D.COURT[b].cost || a.localeCompare(b));
    // сыгранные в этот ход лежат в сбросе сверху — показываем отдельно
    const pl = w === 'discard' ? (p.inPlay || []) : [], pn = {}; for (const id of pl) pn[id] = (pn[id] || 0) + 1;
    const pids = Object.keys(pn);
    const title = (w === 'deck' ? 'Колода двора' : w === 'deckhand' ? 'Колода и рука' : w === 'discard' ? 'Сброс двора' : 'Убраны из игры') + whose;
    const note = w === 'deckhand' ? `Всё, что не в сбросе: колода и рука вместе — какие карты сейчас в руке (${D.cards(p.hand.length)}), не видно. Порядок колоды скрыт.` : w === 'deck' ? 'Что лежит в колоде. Порядок скрыт, как за настоящим столом: колода перемешана.' : w === 'discard' ? 'Сыгранные и купленные карты. Сыгранная карта уходит сюда сразу. Когда колода кончится, сброс перемешается и станет новой колодой — кроме карт, сыгранных в этот ход.' : 'Карты, убранные отставкой, Канцлером, Покаянием или сожжённые шпионом: они ушли в коробку навсегда — ни в колоду, ни на рынок не вернутся.';
    // Архиепископ Григорий, Сорель Аш: раз в ход можно посадить ко двору карту из своего сброса
    const canDS = w === 'discard' && !WATCH && p === S.players[ME] && isMyTurn() && modOn('seats') && (E.mods(S, p).seatFromDiscard || 0) > 0 && !p.turn.discardSeated;
    // Святой Аврелий: раз в ход взять карту из сброса в руку
    const canF = w === 'discard' && !WATCH && p === S.players[ME] && isMyTurn() && E.fetchLeft(S, p) > 0;
    const dsBtn = (id) => (canDS && E.canSeat(S, id) ? `<button class="btn small" data-act="discard-seat" data-id="${id}">🪑 Ко двору</button>` : '') + (canF ? `<button class="btn small" data-act="fetch" data-id="${id}">✋ В руку</button>` : '');
    const dsNote = (canDS ? '<p class="note">Раз в ход одну карту с блоком «При дворе» можно посадить ко двору прямо из сброса.</p>' : '') + (canF ? `<p class="note">${E.fetchLeft(S, p) > 1 ? `Ещё ${D.cards(E.fetchLeft(S, p))} из сброса можно взять в руку` : 'Одну карту из сброса можно взять в руку'} — даже сыгранную в этот ход.</p>` : '');
    const playedHtml = pids.length ? `<div class="sec-h"><h3>Сыграно в этот ход</h3><span>сверху сброса</span></div><div class="pgrid">${pids.map(id => pslot(pcard('court', id, { badge: '<span class="pcb tag">сыграна</span>' }), `<span class="pmeta">×${pn[id]}</span>${dsBtn(id)}`)).join('')}</div>${ids.length ? '<div class="sec-h"><h3>Раньше</h3><span>прошлые ходы</span></div>' : ''}` : '';
    openSheet({ title, body: `<p class="muted">${note}</p>${dsNote}${playedHtml}${ids.length ? `<div class="pgrid">${ids.map(id => pslot(pcard('court', id), `<span class="pmeta">×${n[id]}</span>${dsBtn(id)}`)).join('')}</div>` : pids.length ? '' : '<p class="muted">Пусто.</p>'}` });
  }
  function infoZoom(kind, id) { showInfo({ act: 'zoom', kind, id }); }
  // ---------- откуда ресурс: значки, стены, золото ----------
  const SYM_RULE = {
    trade: () => `Торг: каждые ${R.tradeStep}⚖️ — всё на рынке вам на 1🪙 дешевле. И скидка при найме знамён Торговли.`,
    sci: () => `Знания: каждые ${R.sciStep}📜 — +1 карта в руку. И скидка при найме знамён Науки.`,
    war: () => 'Сила ваших нападений и обороны. И скидка при найме знамён Войны.',
    int: () => 'Сила ваших шпионов и защита от чужих. И скидка при найме знамён Интриг.',
    faith: () => `Подаяния: каждые ${R.faithStep}🕯 — +1🪙 в начале хода. Нужны для веры. И скидка при найме знамён Веры.`,
  };
  function resSourcesHtml(q, s) {
    const rows = [];
    if (s === 'walls') {
      rows.push([`Родовой замок`, R.baseWalls || 0]);
      const g = new Map(); for (const e of q.estates) { if (e.ruined) continue; const w = D.ESTATES[e.id].walls || 0; if (w) { const k = D.ESTATES[e.id].name; const x = g.get(k) || { n: 0, v: 0 }; x.n++; x.v += w; g.set(k, x); } }
      for (const [k, x] of g) rows.push([x.n > 1 ? `${k} ×${x.n}` : k, x.v]);
      const mw = E.mods(S, q).walls || 0; if (mw) rows.push(['свойства знамён и придворных', mw]);
    } else if (s === 'gold') {
      const m = E.mods(S, q), dg = E.dawnGold(S, q, m), up = E.upkeepOf(q);
      for (const x of dg.src) { const mm = /^(.*) \+(\d+)$/.exec(x); rows.push(mm ? [`в начале хода: ${mm[1]}`, +mm[2]] : [x, 0]); }
      if (up) rows.push(['содержание лордов в начале хода', -up]);
      const e1 = E.Bot.rollEV(S, q, 1), e2 = E.Bot.rollEV(S, q, 2);
      const f = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v * 10) / 10).toString().replace('.', ',')}🪙`;
      return `<dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}🪙</dd>`).join('') || '<dt>В начале хода</dt><dd>ничего</dd>'}</dl><p class="note">Свой бросок в среднем приносит: 1 кубик — ${f(e1)}, 2 кубика — ${f(e2)} (владения минус чужие Набеги и беды).</p>`;
    } else {
      const src = E.prodSources(S, q).filter(x => x.s === s);
      const name = (x) => x.k === 'house' ? `${H(q).name} — родное направление` : x.k === 'estate' ? D.ESTATES[x.id].name : x.k === 'ban' ? D.BAN[x.id].name : x.k === 'seat' ? `${D.COURT[x.id].name} при дворе` : x.k === 'raidSym' ? `${D.BAN[x.id].name}: за ваши Набеги` : x.k === 'union' ? `союз: ${D.PROV[x.id].name}` : x.k === 'faith' ? `${D.FAITHS[x.id].name}, ступень ${x.st === 3 ? 'III' : 'II'}` : x.k;
      const g = new Map(); for (const x of src) { const k = name(x); const y = g.get(k) || { n: 0, v: 0 }; y.n++; y.v += x.n; g.set(k, y); }
      for (const [k, y] of g) rows.push([y.n > 1 && !/знам|Дом/.test(k) ? `${k} ×${y.n}` : k, y.v]);
      if (q.temp[s]) rows.push(['до конца хода (карты, обряды)', q.temp[s]]);
    }
    const tot = rows.reduce((a, [, v]) => a + v, 0);
    return `<dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v < 0 ? '−' : '+'}${Math.abs(v)}</dd>`).join('') || '<dt>Пока нет</dt><dd>0</dd>'}<dt><b>Всего</b></dt><dd><b>${tot}</b></dd></dl>${s !== 'walls' && SYM_RULE[s] ? `<p class="note">${SYM_RULE[s]()}</p>` : s === 'walls' ? `<p class="note">Стены защищают и от нападений, и от шпионов. Но от шпиона замок защищает вполовину: 🧱${Math.floor(R.baseWalls * (R.spyCastle == null ? 1 : R.spyCastle))} вместо 🧱${R.baseWalls}${tot - R.baseWalls + Math.floor(R.baseWalls * (R.spyCastle == null ? 1 : R.spyCastle)) >= 0 ? ` — против шпиона у вас 🧱${tot - R.baseWalls + Math.floor(R.baseWalls * (R.spyCastle == null ? 1 : R.spyCastle))}` : ''}.</p>` : ''}`;
  }
  function showRes(q, s) {
    const title = s === 'gold' ? `🪙 Золото: ${shownGold(q)}` : s === 'walls' ? `🧱 Стены: ${E.walls(S, q)}` : `${D.SYM[s]} ${D.SYM_NAME[s]}: ${E.sym(S, q, s)}`;
    openSheet({ title: `${title}${q.i !== ME ? ` · ${esc(H(q).short)}` : ''}`, body: resSourcesHtml(q, s) });
  }
  // v10.18: колода и сброс двора соперника — те же стопки, что на своём «Дворе»; его рука прячется в «Колода и рука»
  function pilesOf(q) {
    const dn = q.discard.length + (q.inPlay || []).length, tr = (q.trashed || []).length, dh = q.deck.length + q.hand.length;
    return `<div class="sec-h"><h3>Колода и сброс</h3><span>сброс открыт, рука — нет</span></div><div class="piles"><button class="pile-b" data-act="pile" data-w="discard" data-i="${q.i}">${deckHtml('court', dn, 'Сброс')}<span class="pl"><b>Сброс</b> ${dn}</span></button><button class="pile-b" data-act="pile" data-w="deckhand" data-i="${q.i}">${deckHtml('court', dh, 'Колода и рука')}<span class="pl"><b>Колода и рука</b> ${dh}</span></button>${tr ? `<button class="pile-b" data-act="pile" data-w="trashed" data-i="${q.i}">${deckHtml('court', tr, 'Убраны')}<span class="pl"><b>Убраны</b> ${tr}</span></button>` : ''}</div>`;
  }
  function infoOpp(i) {
    const q = S.players[i];
    const pr = E.prod(S, q);
    const hit = hitsOf(rvShown());
    const u = E.unionsOf(q);
    // защита: против чего нападать на них бесполезно или труднее — и какая карта это даёт
    const qm = E.mods(S, q), prot = [];
    if ((modOn('sieges') || modOn('spy')) && qm.captureImmune) prot.push(`владения нельзя захватить, отнять и разрушить — «${E.modSources(S, q, 'captureImmune').map(esc).join('», «')}»`);
    if ((modOn('sieges') || modOn('spy')) && qm.shield) prot.push(`нападения и шпионы против них слабее на ${qm.shield} — «${E.modSources(S, q, 'shield').map(esc).join('», «')}»`);
    if (qm.raidShield) prot.push(`ваши Набеги и Твердыни берут у них на ${qm.raidShield}🪙 меньше — «${E.modSources(S, q, 'raidShield').map(esc).join('», «')}»`);
    if (modOn('seats') && qm.seatGuard) prot.push(`их придворных нельзя прогнать — «${E.modSources(S, q, 'seatGuard').map(esc).join('», «')}»`);
    if (modOn('plots') && qm.plotProtect) prot.push(`их замыслы нельзя сорвать — «${E.modSources(S, q, 'plotProtect').map(esc).join('», «')}»`);
    const body = `${lastRec && lastRec.p === i && i !== ME ? recHtml(true) : ''}<p class="muted" style="margin:0">${H(q).about}</p><p class="note">${H(q).ability}</p>${prot.length && q.i !== ME ? `<p class="note warn">🛡 Защита: ${prot.join('; ')}.</p>` : ''}
      <dl class="kv"><dt>Золото</dt><dd>${shownGold(q)}🪙${E.upkeepOf(q) ? ` · содержание ${E.upkeepOf(q)}🪙 в ход` : ''}</dd><dt>Значки</dt><dd>${SYMS5.map(s => `<button class="rsb" data-act="res" data-s="${s}" data-i="${q.i}">${D.SYM[s]} ${pr[s]}</button>`).join(' ')}${modOn('sieges') ? ` <button class="rsb" data-act="res" data-s="walls" data-i="${q.i}">🧱 ${E.walls(S, q)}</button>` : ''}</dd>${modOn('faith') ? `<dt>Вера</dt><dd>${(q.faiths || []).map(f => `${D.FAITHS[f].icon} ${esc(D.FAITHS[f].name)}`).join(', ') || 'нет'}</dd>` : ''}<dt>Карты</dt><dd>в руке ${q.hand.length}, всего ${q.deck.length + q.discard.length + q.hand.length + q.inPlay.length}</dd>${modOn('plots') ? `<dt>Замыслы</dt><dd>${q.plots.length ? (q.i === ME && !WATCH ? q.plots.map(pl => pl.kind === 'dice' ? `🎲 на ${pl.nums.join(', ')}` : '⏳').join(', ') : `${q.plots.length} рубашкой вверх — какие, не видно`) : 'нет'}</dd>` : ''}${modOn('unions') ? `<dt>Союзы</dt><dd>${['N', 'S', 'E', 'W'].filter(k => u[k]).map(k => `${D.PROV[k].icon} ${D.PROV[k].name}${u[k] > 1 ? ' ×' + u[k] : ''}`).join(', ') || 'нет'}</dd>` : ''}</dl>
      <div class="sec-h"><h3>Знамёна ${E.regCount(q)}/${E.goal(S)}</h3><span>вассалов ${q.vassals.length}${needL() ? `, лордов ${q.lords.length}` : ''}${needF() ? `, великих ${q.greats.length}` : ''}</span></div><div class="pgrid mini">${E.allBans(q).map(id => pcard('ban', id, { o: q.i, st: 'built', cls: 'built', badge: q.distracted && q.distracted.id === id ? '<span class="pcb tag">отвлечён</span>' : '<span class="pcb own">🚩</span>' })).join('')}${q.heir ? pcard('ban', q.heir, { o: q.i, cls: 'dim', badge: '<span class="pcb tag">Наследник ждёт</span>' }) : ''}</div>
      <div class="sec-h"><h3>Владения</h3><span>${q.estates.length}</span></div><div class="pgrid mini">${estStacks(q.estates, hit).map(g => stackCard(g, q.i)).join('')}</div>
      ${seatsHtml(q, false)}
      ${pilesOf(q)}<div class="sec-h"><h3>Карты двора</h3><span>все ${courtOf(q).reduce((a, x) => a + x[1], 0)}: в колоде, сбросе и руке</span></div><div class="pgrid mini">${courtOf(q).map(([id, n]) => pcard('court', id, { badge: n > 1 ? `<span class="pcb own">×${n}</span>` : '' })).join('')}</div>
      <p class="muted" style="font-size:13px;margin:6px 0 0">Покупки видят все, поэтому состав колоды открыт. Какие карты сейчас в руке и какие отложены замыслом — не видно.</p>${rollView ? `<p class="muted" style="font-size:13px;margin:6px 0 0">Подсвечено сработавшее на последнем броске (${rollView.r}).</p>` : ''}`;
    openSheet({ title: `${H(q).sigil} ${esc(H(q).name)}`, body: `<div class="oppbody">${body}</div>` });
  }
  function showLog() {
    let html = '<ul class="logl">', r = null;
    for (let k = S.log.length - 1; k >= 0; k--) {
      const l = S.log[k];
      if (l.r !== r) { r = l.r; html += `<li class="rd">Круг ${r}</li>`; }
      html += `<li>${esc(l.t)}</li>`;
    }
    openPage({ title: 'Журнал партии', body: html + '</ul>' });
  }
  function showAid() { openPage({ title: 'Памятка', body: `<div class="aidwrap">${Aid.front(R, gico, modOn)}${Aid.back(R, gico, modOn)}${Aid.icons(R, gico, modOn)}${Aid.terms(R, gico, modOn)}</div>${MODK.some(k => !modOn(k)) ? '<p class="muted" style="font-size:13px;margin:8px 0 0">Показаны правила включённых модулей. Печатная памятка — для полной игры.</p>' : ''}` }); }
  function showMenu() {
    const sh = openSheet({ title: 'Меню', body: `<div class="optlist">
      <button class="opt" data-m="aid"><span class="big">${gico('plot')}</span><span><b>Памятка</b><br><span class="muted">ход, доход по броску, значки, словарь</span></span><span class="r">›</span></button>
      <button class="opt" data-m="rules"><span class="big">${gico('econ')}</span><span><b>Правила</b></span><span class="r">›</span></button>
      <button class="opt" data-m="catalog"><span class="big">${gico('card')}</span><span><b>Все карты</b><br><span class="muted">весь набор: владения, двор, Дома, знамёна, веры и стол</span></span><span class="r">›</span></button>
      <button class="opt" data-m="log"><span class="big">🗒</span><span><b>Журнал партии</b></span><span class="r">›</span></button>
      <button class="opt" data-m="settings"><span class="big gear">⚙︎</span><span><b>Настройки</b><br><span class="muted">подсказки, звук, скорость ботов</span></span><span class="r">›</span></button>
      ${LINKS.tutorial ? `<a class="opt" href="${LINKS.tutorial}" target="_blank" rel="noopener"><span class="big">${gico('dawn')}</span><span><b>Учебник</b><br><span class="muted">правила по шагам, живые примеры</span></span><span class="r">↗</span></a>` : ''}
      <button class="opt" data-m="quit"><span class="big">🚪</span><span><b>Выйти в главное меню</b><br><span class="muted">${!S || S.winner !== null ? 'партия окончена' : guest() ? 'вернуться в партию можно с главного экрана' : hostNet() ? 'партия сохранится у вас; гости подождут' : 'партия сохранится'}</span></span><span class="r">›</span></button></div>` });
    sh.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      const m = b.dataset.m; sh.close();
      if (m === 'rules') showRules(); else if (m === 'catalog') showCatalog(); else if (m === 'log') showLog(); else if (m === 'aid') showAid();
      else if (m === 'settings') showSettings();
      else if (m === 'quit') goHome('home', true);
    });
  }
  // выйти из партии на экран меню или новой партии; незаконченная партия сохраняется
  function goHome(to, keep) {
    if (guest()) { if (!keep || (S && S.winner !== null)) forgetNetSession(); netClose('pause'); }
    else {
      if (keep && S && S.winner === null && lastSafe) savedGame = { S: lastSafe, ME, WATCH };
      else if (!keep) clearSave();
      if (NETG) netClose(keep && S && S.winner === null ? 'pause' : 'end');
    }
    Music.stop();
    stgKill(); popQ.splice(0); selCard = null; drawer = null;
    runId++; S = null; endTurnResolve = null; adjustReq = null; nextReq = null; busy = false; coverReq = null;
    view = to;
    closeAllSheets(); closeAllPages();
    schedule();
  }
  // ---------- настройки ----------
  function settingsHtml() {
    const seg = (key, cur, opts) => `<div class="seg wide" role="radiogroup">${opts.map(([v, l]) => `<button role="radio" aria-checked="${cur === v}" class="${cur === v ? 'on' : ''}" data-set="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
    const vol = (key, v, label) => `<label class="volrow"><span>${label}</span><input type="range" min="0" max="100" step="5" value="${v}" data-vol="${key}" aria-label="${label}"><b>${v}</b></label>`;
    const sw = (key, on, title, sub) => `<button class="mod set ${on ? 'on' : ''}" data-set="${key}" role="switch" aria-checked="${on}"><span class="sw" aria-hidden="true"></span><span><b>${title}</b><span class="muted">${sub}</span></span></button>`;
    return `<div class="settings">
      <h2 class="lbl">Стол</h2>
      <div class="group">${sw('coins', manualCoins, 'Монеты и карты — своей рукой', manualCoins ? 'доход забираете касанием по плиткам, карты в конце хода берёте сами' : 'монеты и карты приходят сами')}
      ${sw('rowtap', rowTap, 'Обновление рынка — касанием', rowTap ? 'в начале круга уходящая карта ряда ложится посреди стола — уберите её сами' : 'ряды обновляются сами — об этом скажет подсказка')}
      ${sw('hint', hintOn, 'Подсказка «что делать сейчас»', hintOn ? 'строка над кубиками: чей ход и какой сейчас шаг' : 'над кубиками — только чей ход')}
      ${sw('sound', sound, 'Звуки стола', 'кубики, монеты, карты, кнопки')}
      ${sound ? vol('sound', sfxVol, 'Громкость звуков') : ''}
      ${sw('music', music, 'Музыка', 'тема Дома в его ход, мотивы знамён и событий')}
      ${music ? vol('music', musVol, 'Громкость музыки') : ''}
      ${sw('shake', shakeRoll, 'Бросать встряхиванием', 'потрясите телефон или планшет, чтобы бросить кубик')}</div>
      ${hoverOk ? `<h2 class="lbl">Клавиатура и мышь</h2><div class="group"><p class="keys"><kbd>Enter</kbd> или <kbd>пробел</kbd> — главная кнопка · <kbd>1</kbd> <kbd>2</kbd> — бросить один или два кубика · <kbd>←</kbd> <kbd>→</kbd> — выбрать карту руки · <kbd>↑</kbd> — сыграть её · <kbd>Esc</kbd> — отмена. Наведите мышь на любую карту — она покажется крупно.</p></div>` : ''}
      <h2 class="lbl">Соперники-боты</h2>
      <div class="set-row"><span>Скорость ходов</span>${seg('speed', speed, [['slow', 'Медленно'], ['normal', 'Обычно'], ['fast', 'Быстро']])}</div>
      <div class="group">${sw('pause', pauseBots, 'Пауза после хода соперника', pauseBots ? 'сводка его хода и кнопка «Дальше»' : 'ход соперника виден на столе, игра идёт без остановки')}</div>
      ${S && S.tut ? `<h2 class="lbl">Обучение</h2><div class="group">${sw('tut', !S.tut.off, 'Подсказки', 'объяснения на каждом шаге')}</div>` : ''}
      ${NETOK ? `<h2 class="lbl">Игра по сети</h2>
      <div class="group netset"><p class="muted">Связь идёт через бесплатные публичные серверы MQTT: каждое сообщение уходит сразу на все серверы списка, поэтому партия не прервётся, если один из них недоступен. Можно вписать свои адреса — по одному в строке. Список должен совпадать у всех игроков.</p>
        <textarea id="brokers" rows="3" spellcheck="false" autocapitalize="off" autocorrect="off" aria-label="Серверы">${esc(Net.brokers().join('\n'))}</textarea>
        <div class="acts2"><button class="btn small" data-set="brokers-save">Сохранить</button><button class="btn small ghost" data-set="brokers-reset">Как было</button></div></div>` : ''}
      <h2 class="lbl">Если что-то не так</h2>
      <nav class="list"><button class="li" data-set="check"><span class="gear" aria-hidden="true">🩺</span><span>Проверка устройства</span><i aria-hidden="true">›</i></button></nav>
      <h2 class="lbl">Об игре</h2>
      <div class="about"><img src="${IMG('icons/i_crown.svg')}" alt=""><span><b>Претенденты</b><span class="muted">Карточная игра · версия ${VERSION}. Партия и настройки хранятся в этом браузере.</span></span></div>
      <p class="muted credit">Рисунки на картах собраны из значков <a href="https://game-icons.net" target="_blank" rel="noopener">game-icons.net</a> (авторы — Lorc, Delapouite и другие), лицензия <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">CC BY 3.0</a>. Цвета, фон и компоновка изменены.</p>
    </div>`;
  }
  // ---------- проверка устройства: отчёт одним текстом, который можно скопировать и прислать ----------
  function safeInsets() {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
    document.body.appendChild(d);
    const cs = getComputedStyle(d), r = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(x => Math.round(parseFloat(x) || 0));
    d.remove(); return r;
  }
  // что на столе вышло за экран или обрезалось
  function boardFacts() {
    const b = app.querySelector('.board'); if (!S || !b || !L.mode) return null;
    const W = window.innerWidth, H = window.innerHeight;
    const r = (el) => { const x = el.getBoundingClientRect(); return `${Math.round(x.width)}×${Math.round(x.height)} @${Math.round(x.left)},${Math.round(x.top)}`; };
    const zones = [['планка соперника', '.pbar.foe'], ['плитки соперника', '.tiles.foe'], ['середина', '.center'], ['мои плитки', '.tiles.own'], ['моя планка', '.pbar.own'], ['рука', '.handz'], ['кнопки', '.abar'], ['рынок и знамёна', '.shopcol']]
      .map(([n, sel]) => { const el = b.querySelector(':scope > ' + sel); return el && el.offsetParent !== null ? `${n} ${r(el)}` : null; }).filter(Boolean);
    const out = [];
    const br = b.getBoundingClientRect();
    if (br.left < -1 || br.top < -1 || br.right > W + 1 || br.bottom > H + 1) out.push(`стол ${r(b)} не помещается в окно ${W}×${H}`);
    for (const el of b.querySelectorAll('.pbar > *, .abar button, .abar .status, .turnrow > *, .handz .hcard, .handz .pile, .tiles .tile, .well')) {
      if (el.offsetParent === null) continue;
      const x = el.getBoundingClientRect(); if (!x.width) continue;
      const z = el.closest('.tiles'); if (z && z.scrollWidth > z.clientWidth + 2) continue; // ряд листается — его края не в счёт
      const tol = el.classList.contains('hcard') ? 4 : 1.5;
      if (x.left < -tol || x.top < -tol || x.right > W + tol || x.bottom > H + tol) out.push(`${String(el.className).split(' ').slice(0, 2).join('.')} ${r(el)}`);
    }
    for (const el of b.querySelectorAll('.abar .primary > span, .abar .second, .abar .sq > span, .goldbig b')) if (el.offsetParent !== null && el.scrollWidth > el.clientWidth + 2) out.push(`обрезан текст «${(el.textContent || '').trim().slice(0, 24)}»`);
    return { mode: L.mode, zones, out: out.slice(0, 10), sizes: `плитка ${Math.round(L.tw)}×${Math.round(L.th)}, плитка соперника ${Math.round(L.otw)}×${Math.round(L.oth)}, карта руки ${Math.round(L.cw)}×${Math.round(L.ch)}, карта рынка ${Math.round(L.mw)}` };
  }
  // если стол не помещается — запись в журнал сама, без участия игрока (один раз на размер окна)
  let layoutSeen = '';
  function layoutWatch() {
    const bf = boardFacts(); if (!bf || !bf.out.length) return;
    const key = `${window.innerWidth}x${window.innerHeight}:${bf.out[0]}`; if (key === layoutSeen) return;
    layoutSeen = key; logErr('layout', `окно ${window.innerWidth}×${window.innerHeight}, «${bf.mode}»: ${bf.out.slice(0, 4).join('; ')}`, '');
  }
  function checkReport(extra) {
    const W = window.innerWidth, H = window.innerHeight, vv = window.visualViewport, si = safeInsets();
    const mm = (q) => !!(window.matchMedia && window.matchMedia(q).matches);
    const sup = (p, v) => { try { return v === undefined ? CSS.supports(p) : CSS.supports(p, v); } catch (e) { return false; } };
    const yn = (v) => (v ? 'да' : 'нет');
    const feats = [['overflow:clip', sup('overflow', 'clip')], [':has', sup('selector(:has(*))')], ['aspect-ratio', sup('aspect-ratio', '1')], ['dvh', sup('height', '100dvh')], ['container', sup('container-type', 'inline-size')],
      ['mask', sup('mask-image', 'linear-gradient(#000,#000)') || sup('-webkit-mask-image', 'linear-gradient(#000,#000)')], ['animate()', typeof Element.prototype.animate === 'function'], ['gzip', typeof CompressionStream === 'function'],
      ['wakeLock', !!navigator.wakeLock], ['clipboard', !!(navigator.clipboard && navigator.clipboard.writeText)], ['audio', !!(window.AudioContext || window.webkitAudioContext)], ['vibrate', !!navigator.vibrate]];
    let fonts = 'не узнать'; try { fonts = ['Lora', 'Inter'].map(f => `${f} ${document.fonts.check(`600 16px ${f}`) ? '✓' : '✗'}`).join(', '); } catch (e) { /* ignore */ }
    let store = 'НЕ работает'; try { localStorage.setItem('pretendenty-probe', '1'); localStorage.removeItem('pretendenty-probe'); store = 'работает'; } catch (e) { /* ignore */ }
    const bf = boardFacts(), o = [];
    o.push(`Претенденты ${VERSION} · проверка устройства`);
    o.push(`Сборка: ${BUILD || 'без метки'} · обновления: ${UPD_ON ? `проверяются${updLast ? `, ${updLast}` : ''}` : 'не проверяются (не с сайта)'}`);
    o.push(`Время: ${new Date().toLocaleString('ru-RU')}`);
    o.push(`Браузер: ${navigator.userAgent}`);
    o.push(`Запуск: ${navigator.standalone === true || mm('(display-mode: standalone)') ? 'с экрана «Домой»' : 'в браузере'}${NETOK ? '' : ' · версия без сети'}`);
    o.push(`Экран: окно ${W}×${H}, документ ${document.documentElement.clientWidth}×${document.documentElement.clientHeight}${vv ? `, видимая часть ${Math.round(vv.width)}×${Math.round(vv.height)}, масштаб ${Math.round(vv.scale * 100) / 100}` : ''}, устройство ${screen.width}×${screen.height}, плотность ${window.devicePixelRatio || 1}, ${W > H ? 'лёжа' : 'стоя'}`);
    o.push(`Вырезы: сверху ${si[0]}, справа ${si[1]}, снизу ${si[2]}, слева ${si[3]}`);
    o.push(`Ввод: касание ${yn(mm('(pointer: coarse)'))}, мышь ${yn(hoverOk)}, меньше движения ${yn(reduceMotion())}`);
    o.push(`Шрифты: ${fonts} · хранилище ${store}`);
    o.push(`Умеет: ${feats.map(([n, v]) => `${n} ${v ? '✓' : '✗'}`).join(' · ')}`);
    o.push(`Настройки: скорость ${speed}, звук ${yn(sound)} ${sfxVol}, музыка ${yn(music)} ${musVol}, монеты рукой ${yn(manualCoins)}, подсказка ${yn(hintOn)}, пауза ${yn(pauseBots)}`);
    if (extra.fps != null) o.push(`Плавность: ${extra.fps} кадров в секунду, самый долгий кадр ${extra.slow} мс`);
    o.push('');
    if (bf) {
      o.push(`Стол: раскладка «${bf.mode}», ${bf.sizes}`);
      o.push(`Партия: круг ${S.round}, игроков ${S.players.length}, цель ${E.goal(S)} знамён, модули: ${MODK.filter(modOn).join(', ') || 'нет'}${hotseat() ? ', одно устройство' : ''}${S.tut ? ', обучение' : ''}${WATCH ? ', наблюдение' : ''}`);
      o.push('Зоны: ' + bf.zones.join('; '));
      o.push(bf.out.length ? 'ЗА КРАЕМ: ' + bf.out.join('; ') : 'За края экрана ничего не выходит');
    } else o.push('Стол: партия не идёт. Чтобы в отчёт попали размеры стола, откройте проверку во время партии: меню ☰ → Настройки.');
    o.push('');
    if (NETG) o.push(`Сеть в партии: ${NETG.role === 'host' ? 'хозяин' : 'гость'}, комната ${NETG.code}, серверов на связи ${NETG.room ? NETG.room.online : 0} из ${NETG.room ? NETG.room.total : 0}${guest() ? `, хозяин ${hostLost() ? 'НЕ отвечает' : 'на связи'}${NETG.rtt != null ? `, отклик ${NETG.rtt} мс` : ''}` : ''}`);
    if (extra.net) for (const x of extra.net) o.push(`Сервер ${x.url.replace(/^wss?:\/\//, '')}: ${x.ok ? `ответил за ${x.ms} мс` : `НЕТ ОТВЕТА (${x.why}, ${x.ms} мс)`}`);
    else if (NETOK) o.push('Серверы связи: проверяются…');
    o.push('');
    o.push(errLog.length ? `Журнал (${errLog.length}):` : 'Ошибок не записано');
    for (const e of errLog.slice(-12)) o.push(`  ${e.t} [${e.v}] ${e.k}${e.n > 1 ? ` ×${e.n}` : ''}: ${e.m}${e.s ? ` (${e.s})` : ''} — ${e.w}`);
    return o.join('\n');
  }
  function showCheck() {
    if (pageRoot.querySelector('.page.check:not(.out)')) return;
    const extra = {};
    const chip = (ok, text, wait) => `<span class="chk ${wait ? 'wait' : ok ? 'ok' : 'bad'}">${wait ? '…' : ok ? '✓' : '⚠︎'} ${text}</span>`;
    const body = () => {
      const t = checkReport(extra), bad = t.includes('ЗА КРАЕМ'), netBad = !!extra.net && !extra.net.some(x => x.ok), errs = errLog.filter(e => e.k !== 'layout').length;
      return `<p class="note">Откройте эту страницу на каждом устройстве — лучше прямо во время партии (меню ☰ → Настройки): тогда в отчёт попадут размеры стола. Нажмите «Скопировать отчёт» и пришлите текст тому, кто делает игру.</p>
      <div class="chk-sum">${S ? chip(!bad, bad ? 'Что-то выходит за край' : 'Стол помещается') : chip(true, 'Стол: партия не идёт', true)}${NETOK ? chip(!netBad, !extra.net ? 'Связь проверяется' : netBad ? 'Серверы не отвечают' : `Серверы: ${extra.net.filter(x => x.ok).length} из ${extra.net.length}`, !extra.net) : ''}${chip(!errs, errs ? `Ошибок: ${errs}` : 'Ошибок нет')}</div>
      <button class="btn primary big" data-chk="copy"><span>Скопировать отчёт</span><small id="chk-st">тот же текст — ниже</small></button>
      <textarea id="chk-txt" class="chk-txt" readonly rows="16" aria-label="Отчёт">${esc(t)}</textarea>
      <div class="acts2"><button class="btn small" data-chk="again">Проверить заново</button>${errLog.length ? '<button class="btn small" data-chk="clear">Очистить журнал</button>' : ''}</div>`;
    };
    const pg = openPage({ title: 'Проверка устройства', cls: 'check', body: body() });
    const redraw = () => { if (pg.el.isConnected && !pg.el.classList.contains('out')) pg.body.innerHTML = body(); };
    const measure = () => {
      delete extra.net; delete extra.fps;
      // плавность: сколько кадров браузер успевает за секунду
      let n = 0, t0 = performance.now(), last = t0, slow = 0;
      const tick = (t) => { n++; slow = Math.max(slow, t - last); last = t; if (t - t0 < 1000) requestAnimationFrame(tick); else { extra.fps = Math.round(n * 1000 / (t - t0)); extra.slow = Math.round(slow); redraw(); } };
      requestAnimationFrame(tick);
      if (NETOK) Promise.all(Net.brokers().map(u => Net.probe(u))).then(r => { extra.net = r; redraw(); });
    };
    measure();
    pg.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-chk]'); if (!b) return;
      const k = b.dataset.chk, ta = pg.el.querySelector('#chk-txt'), st = pg.el.querySelector('#chk-st');
      if (k === 'again') { redraw(); measure(); }
      else if (k === 'clear') { errLog = []; try { localStorage.removeItem(ERR_KEY); } catch (err) { /* ignore */ } redraw(); }
      else if (k === 'copy' && ta) {
        const text = ta.value, ok = () => { if (st) st.textContent = '✓ скопировано — вставьте в сообщение'; b.classList.add('ok'); };
        const manual = () => { ta.focus(); ta.select(); try { ta.setSelectionRange(0, text.length); } catch (err) { /* ignore */ } let done = false; try { done = document.execCommand('copy'); } catch (err) { done = false; } if (done) ok(); else if (st) st.textContent = 'текст выделен — нажмите «Скопировать» в меню'; };
        try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, manual); else manual(); } catch (err) { manual(); }
      }
    });
  }
  function showSettings() {
    if (pageRoot.querySelector('.page.settings:not(.out)')) return;
    const pg = openPage({ title: 'Настройки', cls: 'settings', body: settingsHtml() });
    pg.el.addEventListener('input', (e) => {
      const r = e.target.closest && e.target.closest('[data-vol]'); if (!r) return;
      const v = clampN(+r.value || 0, 0, 100), lab = r.parentNode.querySelector('b'); if (lab) lab.textContent = v;
      if (r.dataset.vol === 'sound') { sfxVol = v; Sfx.vol(v / 100); } else { musVol = v; Music.vol(v / 100); }
    });
    pg.el.addEventListener('change', (e) => {
      const r = e.target.closest && e.target.closest('[data-vol]'); if (!r) return;
      if (r.dataset.vol === 'sound') { Sfx.unlock(); Sfx.coin(); } else if (music && !(S && S.winner === null)) { Music.unlock(); Music.jingle(true, 'vassal', 'vol', setup.house); }
      savePrefs();
    });
    pg.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-set]'); if (!b) return;
      const k = b.dataset.set, v = b.dataset.v;
      if (k === 'check') { showCheck(); return; }
      if (k === 'hint') hintOn = !hintOn;
      else if (k === 'coins') { manualCoins = !manualCoins; if (!manualCoins) for (const c of myCoins()) takeCoin(c.k, true); }
      else if (k === 'rowtap') rowTap = !rowTap;
      else if (k === 'music') { music = !music; Music.set(music); if (music && S && S.winner === null) { Music.unlock(); Music.house(S.players[S.cur].house); } }
      else if (k === 'sound') { sound = !sound; Sfx.set(sound); if (sound) { Sfx.unlock(); Sfx.coin(); } }
      else if (k === 'shake') {
        if (shakeRoll) shakeRoll = false;
        else if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
          DeviceMotionEvent.requestPermission().then(r => { shakeRoll = r === 'granted'; if (!shakeRoll) toast('Без разрешения на датчики движения бросать встряхиванием нельзя'); savePrefs(); pg.body.innerHTML = settingsHtml(); schedule(); }).catch(() => toast('Устройство не дало доступ к датчикам движения'));
        } else if (typeof DeviceMotionEvent !== 'undefined') shakeRoll = true;
        else toast('На этом устройстве нет датчиков движения');
      }
      else if (k === 'speed') speed = v;
      else if (k === 'pause') { pauseBots = !pauseBots; if (!pauseBots && nextReq) { const r = nextReq; nextReq = null; r.res(); } }
      else if (k === 'tut' && S && S.tut) { S.tut.off = !S.tut.off; saveSafe(); }
      else if (k === 'brokers-save' || k === 'brokers-reset') {
        const ta = pg.el.querySelector('#brokers');
        const list = k === 'brokers-reset' ? [] : (ta ? ta.value : '').split(/[\s,]+/).map(x => x.trim()).filter(x => /^wss?:\/\/[^\s]+$/i.test(x));
        if (k === 'brokers-save' && !list.length) { toast('Нужен хотя бы один адрес вида wss://…'); return; }
        Net.setBrokers(list);
        toast(k === 'brokers-reset' ? 'Серверы — как было' : `Сохранено: ${list.length} ${D.plural(list.length, 'сервер', 'сервера', 'серверов')}. Действует с новой комнаты.`, 3000);
      }
      savePrefs(); schedule();
      pg.body.innerHTML = settingsHtml();
    });
  }
  function cycleSpeed() { speed = speed === 'normal' ? 'fast' : speed === 'fast' ? 'slow' : 'normal'; savePrefs(); toast(`Скорость ботов: ${{ slow: 'медленно', normal: 'обычно', fast: 'быстро' }[speed]}`, 1400); schedule(); }

  // ---------- правила: базовая игра + страница на каждый модуль (modrules.js) ----------
  function showRules() {
    const on = modOn;
    const cur = MODK.filter(on);
    const where = S ? 'В этой партии' : 'В выбранном наборе';
    const golds = Object.values(D.HOUSES).map(x => R.startGold + (x.gold || 0));
    let b = `<div class="rules">`;
    b += `<p class="note">Сначала — основа игры. Модули добавляют по одной механике, у каждого своя страница с примерами. ${where} ${cur.length ? `включены: ${modList(cur)}` : 'модули выключены'}.</p>`;
    b += `<h3>Цель</h3><p>Первым собрать ${goalLine()}. Когда кто-то выполнил цель, круг доигрывается до конца — у всех поровну ходов. Побеждает тот, у кого цель выполнена в конце круга; если таких несколько — у кого больше золота.</p>`;
    b += `<h3>Подготовка</h3><ul>
      <li>За престол борются 2–${R.maxPlayers} Дома. У каждого — три стартовых владения своего Дома; стартовое золото (${Math.min(...golds)}–${Math.max(...golds)}🪙, указано на карте Дома${R.seatGold ? `; кто ходит не первым — ещё +${R.seatGold}🪙` : ''}); колода — ${R.startTax}× Подать и 3 карты Дома, в руке ${R.hand}.${on('lords') ? ' Наследник Дома лежит рядом с картой Дома.' : ''}</li>
      <li>Рынок: открыты ${R.estateRow} владения и ${R.courtRow} карты двора. Знамёна: ряд из ${R.vRow} вассалов${on('lords') ? `, ${R.lRow} лордов` : ''}${on('great') ? `, ${R.gRow} великих лордов` : ''} — каждый из своей колоды.</li></ul>`;
    b += `<h3>Ход</h3><ol>
      ${on('great') ? '<li><b>Содержание:</b> первым делом заплатите за великих лордов. Не хватает — лишние уходят под низ своей колоды.</li>' : ''}
      <li><b>Доход начала хода</b> от свойств знамён и Дома и 🕯 Подаяния.</li>
      <li><b>Карты двора</b> из руки можно играть до броска и после, сколько угодно. Сыгранная карта сразу уходит в ваш сброс. <b>Отставка:</b> раз в ход уберите из игры одну карту руки и возьмите новую из колоды.</li>
      <li><b>Бросок:</b> 1 или 2 кубика — на выбор, с начала партии. Бросок обязателен.</li>
      <li><b>Доход по кубику:</b> сначала 🟥 Набеги соперников, потом 🟦 Земли у всех и 🟩 Ремёсла у вас, потом ваши 🟪 Твердыни.</li>
      <li><b>Действие:</b> одно за ход — купить карту на рынке или нанять знамя. Некоторые карты и лорды дают ещё действие.${on('great') ? ` В длинной партии (с великими лордами) раз в ход можно купить <b>второе действие</b> за ${R.extraAction}🪙.` : ''} <b>Ярмарка</b> — покупка на рынке, которая действие не тратит: её дают Дом Оленя, Наследники и некоторые лорды.</li>
      <li><b>Конец:</b> остаток руки — в сброс, берёте ${R.hand} новые карты. Колода кончилась — перемешайте сброс; посреди хода карты, сыгранные в этот ход, в замес не идут.</li></ol>`;
    b += `<h3>Владения</h3><ul>
      <li>🟦 <b>Земля</b> — доход в ход любого игрока.</li><li>🟩 <b>Ремесло</b> — доход в ваш ход.</li>
      <li>🟥 <b>Набег</b> — в ход другого игрока забирает золото у того, чей ход.</li>${on('sieges') || on('spy') ? '<li>🟪 <b>Твердыня</b> — в ваш ход забирает золото у самого богатого соперника. У игрока каждая твердыня — по одной.</li>' : ''}
      <li><b>Провинции.</b> У каждого владения — провинция: 🏔 Север, 🌾 Юг, 🔮 Восток, 🌲 Запад. <b>Пара</b>: если у вас есть ещё одно владение той же провинции, владение с «парой» приносит больше. Некоторые карты платят за каждое ваше владение провинции.</li>
      <li><b>Копии.</b> Владения — по 3 в колоде${on('sieges') ? ' (Каменная стена — тоже)' : ''}${on('sieges') || on('spy') ? `; твердыни — отдельным рядом из ${R.holdRow}, копий каждой — по числу игроков` : ''}. Сколько копий — написано внизу каждой карты.</li></ul>`;
    b += `<h3>Пять направлений</h3><p>⚖️ Торговля, 📜 Наука, ⚔️ Война, 🔗 Интриги, 🕯 Вера. Значки дают владения, знамёна (каждое — 1 значок своего направления) и Дом (1 родной). Значки не тратятся. У каждого значка своё правило:</p><ul>
      <li>⚖️ <b>Торг:</b> каждые ${R.tradeStep}⚖️ — всё на рынке вам на 1🪙 дешевле (но не дешевле 1🪙).</li>
      <li>📜 <b>Знания:</b> каждые ${R.sciStep}📜 — +1 карта в руку.</li>
      <li>🕯 <b>Подаяния:</b> каждые ${R.faithStep}🕯 — +1🪙 в начале хода.${on('faith') ? ' Ещё 🕯 нужны, чтобы принять веру и поднять её ступень.' : ''}</li>
      ${on('sieges') || on('spy') ? '<li>⚔️ — сила нападения, 🔗 — сила шпионажа и стража.</li>' : ''}</ul>`;
    b += `<h3>Знамёна</h3><ul>
      <li><b>Цена — только золото.</b> Каждый ваш значок направления карты — скидка 1🪙: у вассала не больше ${R.discCap.v}, у лорда ${R.discCap.l}, у великого лорда ${R.discCap.g}.</li>
      <li><b>Вассалы</b> помогают зарабатывать. ${on('lords') ? '<b>Лорды</b> дороже и меняют правила лично для вас; каждый даёт ещё место при дворе. Наследник Дома — ваш личный лорд.' : ''}${on('great') ? ' <b>Великие лорды</b> — власть над столом и награда при найме, но содержание каждый ход.' : ''}</li>
      <li>Любой ряд (рынка и знамён), из которого за круг ничего не взяли, в начале нового круга обновляется: крайняя карта уходит под низ колоды.</li>${R.catchupGap ? `
      <li><b>Догоняющий наём.</b> Если в начале круга у лидера ${E.cuFrom(S)}+ знамён, каждый, у кого знамён меньше, в этом круге может нанять ещё одного вассала — сверх действия.${on('balance') ? ' В этой партии вместо него — Зависть и Поддержка (модуль «Баланс»).' : ''}</li>` : ''}</ul>`;
    b += `<h3>Карты двора и свита</h3><p>Роли: ⚖️ Купец, 📜 Учёный, ⚔️ Рыцарь, 🔗 Шпион, 🕯 Жрец. <b>Свита</b>: вторая карта той же роли за ход — срабатывает её «Свита». Третья и дальше — «Свита» срабатывает дважды. У карты без блока «Свита» бонуса нет. У Сборщика податей свиту запускает «Подать»: сыграйте до него хоть одну; бонус — за каждую «Подать». Если до него сыграны ещё и два других Купца — дважды, как у всех.</p>`;
    { const H0 = D.HOUSES.deer, dg = R.startGold + (H0.gold || 0), C0 = D.COURT.collector, pp = (C0.ally.find(o => o[0] === 'perPlayed') || [0, 0, 0])[2], cb = (C0.fx.find(o => o[0] === 'gold') || [0, 0])[1];
      const fid = H0.estates.find(id => D.ESTATES[id].n.includes(4) && D.ESTATES[id].inc) || H0.estates[0], fs = D.ESTATES[fid], a = dg + 2 + cb + 2 * pp, c = a + (fs.inc || 0);
      b += `<h3>Пример первого хода</h3><div class="mr-ex"><b>Дом Оленя</b><p>На старте ${dg}🪙. В руке две «Подати» и Сборщик податей. Играете обе «Подати» (+2🪙), потом Сборщика: +${cb}🪙 и свита — +${pp}🪙 за каждую «Подать»: итого ${a}🪙. Бросаете 1 кубик, выпало ${fs.n.includes(4) ? 4 : fs.n[0]} — ваша ${fs.name}: +${fs.inc}🪙 (${c}). Действие: покупаете владение — Оленям рынок на ${H0.mods.marketDiscount || 0}🪙 дешевле — или копите на первого вассала: родной ⚖️ Оленей даёт скидку на вассалов Торговли.</p></div>`; }
    b += `<h3>Модули</h3><div class="optlist"><button class="opt" data-mr="__ov"><span class="big">🧩</span><span><b>Как собрать набор</b><br><span class="muted">Готовые наборы, с чего начать, что от чего зависит</span></span><span class="r">›</span></button>${ModRules.ORDER.map(k => `<button class="opt" data-mr="${k}"><span class="big">${D.MODULES[k].icon}</span><span><b>${D.MODULES[k].name}</b><br><span class="muted">${D.MODULES[k].desc}</span></span><span class="r">${on(k) ? '<small>вкл.</small>' : ''}›</span></button>`).join('')}</div>`;
    // сверху — «Как ходить» на один экран; ниже те же разделы, каждый раскрывается по нажатию
    const hold = on('sieges') || on('spy');
    const quick = `<section class="howto" aria-label="Как ходить"><h2>Как ходить</h2>
      <p class="hgoal">${gico('banner')} Цель — первым собрать ${goalLine()}.</p>
      <ol class="hsteps">
        <li><span class="hn">1</span><div><b>Сыграйте карты из руки</b><span>Каждая даёт эффект сразу и уходит в сброс.</span></div></li>
        <li><span class="hn">2</span><div><b>Бросьте 1 или 2 кубика</b><span>Число запускает владения с этим числом — у всех игроков.</span></div></li>
        <li><span class="hn">3</span><div><b>Заберите доход</b><span>🟦 Земли — в любой ход · 🟩 Ремёсла — в свой · 🟥 Набеги — в чужой, берут у ходящего${hold ? ' · 🟪 Твердыни — в свой, берут у самого богатого' : ''}.</span></div></li>
        <li><span class="hn">4</span><div><b>Одно действие</b><span>Купить карту на рынке или нанять знамя.</span></div></li>
        <li><span class="hn">5</span><div><b>Завершите ход</b><span>Рука — в сброс, из колоды — ${R.hand} новые карты.</span></div></li>
      </ol>
      <p class="hend">Кто-то собрал знамёна — круг доигрывается. Цель выполнили несколько игроков — побеждает тот, у кого больше золота.</p></section>`;
    const secs = b.split('<h3>'), head = secs.shift().replace('<div class="rules">', '');
    b = `<div class="rules">${quick}<h3 class="rsec-t">Подробности</h3>${head}${secs.map(x => { const i = x.indexOf('</h3>'), t = x.slice(0, i); return `<details class="rsec"${t === 'Модули' ? ' open' : ''}><summary>${t}</summary><div class="rsec-b">${x.slice(i + 5)}</div></details>`; }).join('')}</div>`;
    const pg = openPage({ title: 'Правила', body: b });
    pg.el.addEventListener('click', (e) => { const x = e.target.closest('[data-mr]'); if (x) showModRules(x.dataset.mr); });
  }
  function showModRules(k) {
    if (k === '__ov') { openPage({ title: '🧩 Как собрать набор', body: `<div class="rules">${ModRules.overview(D)}</div>` }); return; }
    const pg = ModRules.page(D, k, modOn);
    const st = modOn(k) ? `Модуль включён ${S ? 'в этой партии' : 'в выбранном наборе'}.` : `Модуль выключен ${S ? 'в этой партии' : 'в выбранном наборе'} — эти правила сейчас не действуют.`;
    openPage({ title: `${pg.icon} ${pg.name}`, body: `<div class="rules"><p class="note">${st}</p>${pg.html}</div>` });
  }
  // «Все карты»: весь набор, как в печати. Фильтр — по наборам: основа, модули и великие лорды включаются по отдельности (v10.13).
  // catSel: null — весь набор (карты выключенных в партии модулей помечены), Set наборов ('base', модули, 'great') — только они.
  // Карта видна, если все её наборы отмечены: карта Вражды — при «Вражде», карта «Вражда + Вера» — когда отмечены обе.
  let catSel = null;
  // «Вражда» в фильтре — двумя кнопками: осады и шпионаж (в настройках партии она включается целиком)
  const CAT_SETS = () => [['base', '🏰', 'Основа'], ...MODK.flatMap(k => (D.MODULES[k].group && k === 'conflict' ? D.MODULES[k].group.map(m => [m, D.MODULES[m].ownIcon || D.MODULES[m].icon, D.MODULES[m].name]) : [[k, D.MODULES[k].icon, D.MODULES[k].short || D.MODULES[k].name]])), ['great', D.MODULES.great.icon, 'Великие']];
  const gameSets = () => new Set(['base', ...CAT_SETS().map(([k]) => k).filter(k => k !== 'base' && k !== 'great' && modOn(k)), ...(modOn('great') ? ['great'] : [])]);
  // фильтры внутри вкладок: тип владения, роль карты двора, уровень знамени и направление (значок)
  const catSub = { estates: 'all', court: 'all', bans: 'all' };
  let catDir = 'all';
  const estKind = (id) => { const t = D.ESTATES[id].t; return ['land', 'craft', 'raid', 'hold'].includes(t) ? t : 'other'; };
  const SUBS = {
    estates: [['all', 'Все'], ['land', '🟦 Земли'], ['craft', '🟩 Ремёсла'], ['raid', '🟥 Набеги'], ['hold', '🟪 Твердыни'], ['other', 'Стены и проклятия']],
    court: [['all', 'Все'], ['merchant', '⚖️ Купцы'], ['scholar', '📜 Учёные'], ['knight', '⚔️ Рыцари'], ['spy', '🔗 Шпионы'], ['priest', '🕯 Жрецы'], ['scheme', '☠ Козни'], ['sin', '😈 Грехи']],
    bans: [['all', 'Все'], ['v', 'Вассалы'], ['l', 'Лорды'], ['g', 'Великие лорды']],
  };
  const DIRS5 = [['all', 'Любое'], ['trade', '⚖️'], ['sci', '📜'], ['war', '⚔️'], ['int', '🔗'], ['faith', '🕯']];
  const subRow = (w) => {
    if (!SUBS[w]) return '';
    const c = (attr, label, on) => `<button class="chip${on ? ' on' : ''}" ${attr}>${label}</button>`;
    const row1 = `<div class="chips catsub">${SUBS[w].map(([k, l]) => c(`data-sub="${k}"`, l, catSub[w] === k)).join('')}</div>`;
    const row2 = w === 'court' ? '' : `<div class="chips catsub"><span class="muted" style="font-size:13px;align-self:center">Значок:</span>${DIRS5.map(([k, l]) => c(`data-dir="${k}"`, l, catDir === k)).join('')}</div>`;
    return row1 + row2;
  };
  const subOk = (kind, id) => {
    if (kind === 'estate') { const d = D.ESTATES[id]; return (catSub.estates === 'all' || estKind(id) === catSub.estates) && (catDir === 'all' || d.sym === catDir); }
    if (kind === 'court') { const c = D.COURT[id], f = catSub.court; return f === 'all' || (f === 'scheme' ? !!c.scheme : f === 'sin' ? !!(c.sin || c.rule) : !c.scheme && !c.sin && !c.rule && !c.start && c.role === f); }
    if (kind === 'ban') { const b = D.BAN[id]; return (catSub.bans === 'all' || b.tier === catSub.bans) && (catDir === 'all' || b.dir === catDir); }
    return true;
  };
  function showCatalog(which = 'estates') {
    const segs = [['estates', 'Владения'], ['court', 'Двор'], ['houses', 'Дома'], ['bans', 'Знамёна'], ['table', 'Стол']];
    const where = S ? 'в этой партии' : 'в выбранном наборе';
    const courtiers = new Set(Object.values(D.HOUSES).flatMap(h => [h.courtier, h.courtier2]).filter(Boolean));
    // что нужно карте: список условий в записи NEEDS ('a|b' — любой, 'a&b' — оба); пустой — карта есть в любой партии
    const reqs = (kind, id) => {
      const r = [];
      const k = kind === 'faith' ? 'faith' : kind === 'ritual' ? ((D.NEEDS.ritual || {})[id] || 'faith') : kind === 'prov' ? 'unions' : kind === 'rule' ? 'balance' : kind === 'module' ? (id === 'sets' ? '' : id) : needOf(kind, id);
      if (k) r.push(k);
      if (kind === 'ban') { const b = D.BAN[id]; if (b.heir || b.tier === 'l') r.push('lords'); if (b.tier === 'g') r.push('great'); }
      if (kind === 'court' && courtiers.has(id)) r.push('seats');
      return r;
    };
    const metIn = (k, has) => k.split('|').some(x => x.split('&').every(has));
    const okIn = (kind, id, has) => reqs(kind, id).every(k => metIn(k, has));
    // набор карты: лорды — в основе; части «Вражды» и «Двора» — по общему модулю
    const setOf = (m) => (m === 'lords' ? 'base' : m === 'sieges' || m === 'spy' ? m : (D.MODULES[m] && D.MODULES[m].member) || m);
    const inSel = (m) => catSel.has(setOf(m));
    const show = (kind, id) => { if (!catSel) return true; const r = reqs(kind, id); return r.length ? r.every(k => metIn(k, inSel)) : catSel.has('base'); };
    const offOf = (kind, id) => [...new Set(reqs(kind, id).filter(k => !metIn(k, modOn)).flatMap(k => k.split('|')[0].split('&').filter(x => !modOn(x))))];
    const offTxt = (ks) => `${ks.length > 1 ? 'модули' : 'модуль'} ${modList(ks)} ${ks.length > 1 ? 'выключены' : 'выключен'} ${where}`;
    const off = (kind, id) => { if (catSel) return ''; const ks = offOf(kind, id); return ks.length ? `<span class="miss">${offTxt(ks)}</span>` : ''; };
    const slot = (kind, id, ...meta) => { const m = [...meta, off(kind, id)].filter(Boolean); return pslot(pcard(kind, id, { full: true }), m.length ? `<span class="pmeta">${m.join('')}</span>` : ''); };
    const grid = (xs) => `<div class="pgrid">${xs.join('')}</div>`;
    const sec = (title, sub) => `<div class="sec-h"><h3>${title}</h3><span>${sub}</span></div>`;
    const cnt = (n) => `${n} ${D.plural(n, 'карта', 'карты', 'карт')}`;
    const empty = '<p class="muted">В этом наборе таких карт нет.</p>';
    const famOf = (x) => [x.deck[x.deck.length - 1], x.courtier, x.courtier2].filter(Boolean);
    const L = {
      estates: () => Object.keys(D.ESTATES).filter(id => !D.ESTATES[id].house && show('estate', id) && subOk('estate', id)).sort((a, b) => (D.ESTATES[a].n[0] || 99) - (D.ESTATES[b].n[0] || 99)),
      court: () => {
        const order = { null: 0, merchant: 1, scholar: 2, knight: 3, spy: 4, priest: 5 };
        const ids = Object.keys(D.COURT).filter(id => !D.COURT[id].sig && !D.COURT[id].start && show('court', id) && subOk('court', id));
        ids.sort((a, b) => (D.COURT[a].bad ? 9 : order[D.COURT[a].role]) - (D.COURT[b].bad ? 9 : order[D.COURT[b].role]) || D.COURT[a].cost - D.COURT[b].cost);
        return [...Object.keys(D.COURT).filter(id => D.COURT[id].start && catSub.court === 'all' && show('court', id)), ...ids];
      },
      houses: () => Object.keys(D.HOUSES).filter(h => show('house', h)),
      houseCards: (h) => { const x = D.HOUSES[h]; return [['house', h], ...x.estates.filter(id => D.ESTATES[id].house).map(id => ['estate', id]), ...famOf(x).map(id => ['court', id]), ['ban', x.heir]].filter(([k, id]) => show(k, id)); },
      bans: (t) => Object.keys(D.BAN).filter(id => D.BAN[id].tier === t && !D.BAN[id].heir && show('ban', id) && subOk('ban', id)).sort((a, b) => SYMS5.indexOf(D.BAN[a].dir) - SYMS5.indexOf(D.BAN[b].dir) || D.BAN[a].cost - D.BAN[b].cost),
      table: () => [...Object.keys(D.FAITHS).map(f => ['faith', f]), ...Object.keys(D.PROV).map(k => ['prov', k]), ...((D.MODULES.balance || {}).hidden ? [] : ['envy', 'support']).map(r => ['rule', r]), ...PCards.MOD_CARDS.map(m => ['module', m])].filter(([k, id]) => show(k, id)),
    };
    const count = () => L.estates().length + L.court().length + ['v', 'l', 'g'].reduce((a, t) => a + L.bans(t).length, 0) + L.houses().reduce((a, h) => a + L.houseCards(h).length, 0) + L.table().length + Object.keys(D.RITUALS || {}).filter(id => show('ritual', id) && show('faith', D.RITUALS[id].faith)).length + 1;
    const TOTAL = (() => { const s = catSel; catSel = null; const n = count(); catSel = s; return n; })();
    const isGame = (s) => { if (!s) return false; const g = gameSets(); return s.size === g.size && [...g].every(k => s.has(k)); };
    const head = () => {
      const chip = (attr, label, on) => `<button class="chip${on ? ' on' : ''}" ${attr}>${label}</button>`;
      const presets = chip('data-cf="all"', 'Весь набор', !catSel) + chip('data-cf="game"', S ? 'Эта партия' : 'Выбранный набор', isGame(catSel));
      const mods = CAT_SETS().map(([k, ic, nm]) => chip(`data-cm="${k}"`, `${ic} ${nm}`, catSel && catSel.has(k))).join('');
      const offMods = MODK.filter(k => !modOn(k));
      const picked = CAT_SETS().filter(([k]) => catSel && catSel.has(k)).map(([, , nm]) => nm);
      const note = !catSel ? `Все ${TOTAL} разных карт игры — как в печатном наборе.${offMods.length ? ` Карты модулей, выключенных ${where}, помечены красным.` : ''} Нажмите на набор, чтобы смотреть только его карты.`
        : picked.length ? `Показаны: ${picked.join(' + ')} — ${count()} из ${TOTAL} карт. Нажимайте на наборы, чтобы добавить или убрать их карты.` : 'Ничего не отмечено — выберите хотя бы один набор.';
      return `<div class="modf"><div class="chips">${presets}</div><div class="chips">${mods}</div></div><p class="note">${note}</p>`;
    };
    const content = (w) => subRow(w) + contentInner(w);
    const contentInner = (w) => {
      if (w === 'estates') {
        const ids = L.estates();
        return `<p class="note">Владения — по 3 копии в колоде (плохие — по 2), в ряду рынка ${R.estateRow}. Твердыни — отдельным рядом из ${R.holdRow}; копий каждой — по числу игроков. Стартовые владения Домов — во вкладке «Дома».</p>${sec('Владения', cnt(ids.length))}${ids.length ? grid(ids.map(id => slot('estate', id))) : empty}`;
      }
      if (w === 'court') {
        const ids = L.court();
        return `<p class="note">Карты двора — по 2 копии в колоде (некоторые — по 1), в ряду рынка ${R.courtRow}. «Подать» — только в стартовых колодах. Карты вер на рынок не идут: их берёт тот, кто первым принял веру. Фамильные карты Домов — во вкладке «Дома».</p>${sec('Двор', cnt(ids.length))}${grid(ids.map(id => D.COURT[id].start ? slot('court', id, `<span>стартовая: ${R.startTax} у каждого</span>`) : slot('court', id, (D.COURT[id].copies || 2) === 1 ? '<span>1 копия</span>' : '')))}`;
      }
      if (w === 'houses') {
        const hs = L.houses();
        return hs.length ? hs.map(h => {
          const x = D.HOUSES[h], hk = catSel ? [] : offOf('house', h);
          return `${sec(`${x.sigil} ${x.name}`, `${D.SYM[x.dir]} ${D.DIRS[x.dir].name}`)}${hk.length ? `<p class="pmeta" style="text-align:left"><span class="miss">${offTxt(hk)}</span></p>` : ''}<p class="muted" style="margin:0">${x.about}</p><p class="note">${x.ability}</p>
          <p style="margin:0;font-size:14px"><b>Старт:</b> ${R.startGold + (x.gold || 0)}🪙; ${x.estates.map(id => D.ESTATES[id].name).join(', ')}; колода — ${R.startTax}× Подать, ${Object.entries(x.deck.reduce((m, id) => (m[id] = (m[id] || 0) + 1, m), {})).map(([id, n]) => (n > 1 ? n + '× ' : '') + D.COURT[id].name).join(', ')}.${!catSel || catSel.has('faith') ? ` <b>Вера:</b> ${x.dir === 'faith' ? 'любая' : `любая ${D.SYM[x.dir]}`} — на 1🕯 проще.` : ''}</p>
          ${grid(L.houseCards(h).map(([k, id]) => k === 'ban' ? slot(k, id, '<span>Наследник</span>') : slot(k, id)))}`;
        }).join('') : empty;
      }
      if (w === 'bans') {
        const blk = (t, title, row) => { const ids = L.bans(t); return ids.length ? `${sec(title, `${cnt(ids.length)}, в ряду ${row}`)}${grid(ids.map(id => slot('ban', id)))}` : ''; };
        const body = `${blk('v', 'Вассалы', R.vRow)}${blk('l', 'Лорды', R.lRow)}${blk('g', 'Великие лорды', R.gRow)}`;
        return `<p class="note">Каждое знамя — в одном экземпляре: кто первым нанял, у того и остаётся; на его место выходит следующее из колоды. Скидка — за значки направления карты. Наследники — во вкладке «Дома».</p>${body || empty}`;
      }
      const T = L.table(), part = (kind) => T.filter(x => x[0] === kind).map(x => x[1]);
      const blk = (kind, title, sub) => { const ids = part(kind); return ids.length ? `${sec(title, sub(ids.length))}${grid(ids.map(id => slot(kind, id)))}` : ''; };
      return `<p class="note">Карты общего стола в колоды не замешиваются.</p>`
        + (() => { const ids = part('faith'); if (!ids.length) return '';
          // каждая вера — со своими двумя картами: их кладёт в сброс первый, кто её примет
          return `${sec('Веры', `${cnt(ids.length)}, в партии — ${R.faithInGame || 4}: по одной каждого направления`)}<p class="note">Рядом с каждой верой — её карты веры. На рынок они не идут: первый, кто примет веру, кладёт их в свой сброс. Отрёкся — карты возвращаются к вере.</p>`
            + ids.map(f => { const F = D.FAITHS[f]; return `<div class="fgroup"><h4 class="fgh">${esc(F.name)}<span>${D.SYM[F.dir] || ''} ${esc((D.DIRS[F.dir] || {}).name || '')}</span></h4>${grid([slot('faith', f), ...(F.cards || []).filter(id => D.COURT[id]).map(id => slot('court', id, '<span>карта веры</span>')), ...Object.keys(D.RITUALS || {}).filter(id => D.RITUALS[id].faith === f && show('ritual', id)).map(id => slot('ritual', id, '<span>ритуал</span>'))])}</div>`; }).join(''); })()
        + ((D.MODULES.unions || {}).hidden ? '' : blk('prov', 'Провинции', () => 'союз — каждые 3 владения'))
        + blk('rule', 'Зависть и поддержка', cnt)
        + blk('module', 'Карты модулей', cnt)
        + `${sec('Памятка игрока', '2 карты на игрока')}<button class="btn" data-act="aid" style="width:100%">Открыть памятку</button>`;
    };
    if (!segs.some(x => x[0] === which)) which = 'estates';
    const pg = openPage({ title: 'Все карты', cls: 'catalog', body: `<div class="cathead">${head()}</div><div class="seg catseg">${segs.map(([k, l]) => `<button data-seg="${k}" class="${k === which ? 'on' : ''}">${l}</button>`).join('')}</div><div class="catbody">${content(which)}</div>` });
    const redraw = () => { pg.el.querySelector('.cathead').innerHTML = head(); pg.el.querySelector('.catbody').innerHTML = content(which); };
    pg.el.addEventListener('click', (e) => {
      const f = e.target.closest('[data-cf]'), m = e.target.closest('[data-cm]'), b = e.target.closest('[data-seg]');
      const sb = e.target.closest('[data-sub]'), dr = e.target.closest('[data-dir]');
      if (sb) { catSub[which] = sb.dataset.sub; redraw(); return; }
      if (dr) { catDir = dr.dataset.dir; redraw(); return; }
      if (f) { catSel = f.dataset.cf === 'all' ? null : gameSets(); redraw(); return; }
      // из «Весь набор» первое нажатие на набор показывает только его; дальше — добавить или убрать
      if (m) { const k = m.dataset.cm; catSel = catSel ? new Set(catSel) : new Set(); if (catSel.has(k)) catSel.delete(k); else catSel.add(k); redraw(); return; }
      if (!b) return;
      which = b.dataset.seg;
      pg.el.querySelectorAll('[data-seg]').forEach(x => x.classList.toggle('on', x === b));
      pg.el.querySelector('.catbody').innerHTML = content(which);
      pg.body.scrollTop = 0;
    });
  }

  // ===================== С ДРУЗЬЯМИ: одно устройство или сеть =====================
  function showFriends() {
    const tb = tableGet();
    const sh = openSheet({ title: 'Игра с друзьями', body: `<div class="optlist">
      ${tb ? `<button class="opt on" data-f="table"><span class="big">🔁</span><span><b>Тот же стол</b><br><span class="muted">комната ${esc(tb.code)} · ${tb.n} ${D.plural(tb.n, 'игрок', 'игрока', 'игроков')} — ${tb.role === 'host' ? 'вы открываете комнату, остальные входят без кода' : 'вход без кода, комнату открывает хозяин'}</span></span><span class="r">›</span></button>` : ''}
      <button class="opt" data-f="hot"><span class="big">📱</span><span><b>На одном устройстве</b><br><span class="muted">передаёте телефон по очереди; карты каждого скрыты от остальных</span></span><span class="r">›</span></button>
      <button class="opt" data-f="host" ${NETOK ? '' : 'disabled'}><span class="big">🌐</span><span><b>Создать комнату</b><br><span class="muted">${NETOK ? 'друзья подключатся со своих телефонов по коду' : 'по сети — только в отдельной версии игры (файл index.html)'}</span></span><span class="r">›</span></button>
      <button class="opt" data-f="join" ${NETOK ? '' : 'disabled'}><span class="big">🔑</span><span><b>Войти по коду</b><br><span class="muted">комнату создал друг</span></span><span class="r">›</span></button></div>
      <p class="muted" style="font-size:13px;margin:8px 0 0">Ботов можно добавить в любую партию: на экране новой партии у каждого соперника выбирается «Бот», «Человек» или «По сети».</p>` });
    sh.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-f]'); if (!b || b.disabled) return;
      sh.close();
      const f = b.dataset.f;
      if (f === 'table') {
        const t = tableGet(); if (!t) return;
        if (t.role === 'guest') { guestJoin(t.code, t.name || '', t.cid); if (NETG) NETG.pair = true; return; }
        setup.seats = (t.seats || []).map(x => ({ type: x.type, house: 'random' })); fixSetup(); savePrefs(); hostCreate(); return;
      }
      if (f === 'hot') { setup.seats.forEach(s => { if (s.type === 'remote') s.type = 'local'; }); if (!setup.seats.some(s => s.type === 'local')) setup.seats[0].type = 'local'; view = 'setup'; }
      else if (f === 'host') { if (!hasRemote()) setup.seats[0].type = 'remote'; view = 'setup'; }
      else view = 'join';
      fixSetup(); savePrefs(); schedule();
    });
  }
  function renderJoin() {
    app.classList.add('start-mode');
    setApp(`<header class="nav"><button class="nav-back" data-act="home">‹ Меню</button><h1>Войти по коду</h1><span class="nav-r"></span></header>
      <div class="startbox join">
        <p class="note">Комнату создаёт второй игрок: «Играть вдвоём» → «Создать комнату». Код — у него на экране.</p>
        <label class="fld"><span class="lbl">Код комнаты</span><input id="jcode" class="code-in" value="${esc(joinDraft.code)}" maxlength="5" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false" placeholder="•••••"></label>
        <label class="fld"><span class="lbl">Ваше имя</span><input id="jname" value="${esc(joinDraft.name)}" maxlength="20" autocomplete="nickname" placeholder="необязательно"></label>
      </div>`);
    barEl.hidden = false; barEl.dataset.focus = '';
    setBar(`<div class="in"><button class="btn primary" data-act="join-go">Войти в комнату</button></div>`);
  }
  // ---------- комната перед партией ----------
  function renderLobby() {
    app.classList.add('start-mode');
    const host = NETG.role === 'host';
    const seats = host ? NETG.seats : (NETG.seats || []);
    const on = NETG.room ? NETG.room.online : 0;
    const conn = `<span class="dot${on ? ' on' : ''}" aria-hidden="true"></span>${on ? netStatusLine() : 'подключаемся к серверам…'}`;
    let body;
    if (!host && !NETG.joined) body = NETG.status ? `<p class="note bad">${esc(NETG.status)}</p>` : `<p class="note">${NETG.pair ? `Ждём хозяина комнаты ${esc(NETG.code)}: он нажимает «Играть вдвоём» у себя. Как только откроет — вы войдёте сами.` : `Ищем комнату ${esc(NETG.code)}… Если долго не находится, проверьте код и что у хозяина открыт экран комнаты.`}</p>`;
    else body = `<h2 class="lbl">Игроки</h2><div class="lseats">${seats.map(s => lobbySeat(s, host)).join('')}</div>`;
    const mods = host ? setup.mods : (NETG.mods || []);
    const pk = presetOf(mods);
    const rules = (host || NETG.joined) ? `<p class="goalnote">Партия: ${D.LENGTHS[lengthOf(mods)].name.toLowerCase()}${MODK.filter(k => D.modMembers(k).every(x => mods.includes(x))).length ? ` — ${MODK.filter(k => D.modMembers(k).every(x => mods.includes(x))).map(k => D.MODULES[k].name).join(', ')}` : ', без модулей'}.</p>` : '';
    setApp(`<header class="nav"><button class="nav-back" data-act="lobby-leave">‹ ${host ? 'Назад' : 'Выйти'}</button><h1>${host ? 'Комната' : 'Партия по сети'}</h1><span class="nav-r"></span></header>
      <div class="startbox lobby">
        <div class="codebox"><span class="lbl">Код комнаты</span><b class="code">${esc(NETG.code)}</b>${host ? `<span class="muted">${NETG.pair ? 'Второй игрок нажимает «Играть вдвоём» у себя — комната та же, код не нужен.' : NETG.duo ? 'Второй игрок у себя: «Играть вдвоём» → «Войти по коду». В следующий раз код не понадобится.' : 'Друг открывает «Претендентов» у себя → «Друзья» → «Войти по коду» и вводит этот код.'}</span>` : ''}</div>
        <p class="netst">${conn}</p>
        ${body}${verNote(host)}${rules}
      </div>`);
    barEl.hidden = false; barEl.dataset.focus = '';
    if (host) {
      const wait = NETG.seats.filter(s => s.type === 'remote' && !s.cid).length;
      setBar(`<div class="in"><button class="btn primary" data-act="lobby-start" ${wait ? 'disabled' : ''}>${wait ? `Ждём игроков по сети: ${wait}` : 'Начать партию'}</button></div>`);
    } else setBar(`<div class="in"><div class="status"><b>${NETG.joined ? 'Вы в комнате' : NETG.status ? 'Не получилось войти' : NETG.pair ? 'Ждём хозяина…' : 'Подключение…'}</b><span class="muted">${NETG.joined ? 'партию начнёт хозяин' : NETG.status ? 'проверьте код' : NETG.pair ? 'экран можно не закрывать' : 'ждём ответа хозяина'}</span></div></div>`);
  }
  // разные версии на устройствах: карты и правила могут считаться по-разному — просим обновиться обоих
  const vName = (v) => (v ? `версия ${esc(v)}` : 'старая версия (до 10.7)');
  function verWarn(other) {
    if (!NETG) return;
    const k = String(other || '?'); NETG.verWarned = NETG.verWarned || {};
    if (NETG.verWarned[k]) return; NETG.verWarned[k] = 1;
    toast(`⚠️ У второго устройства ${vName(other)}, у вас ${esc(VERSION)} — обновитесь оба`, 5200);
  }
  function verNote(host) {
    if (!NETG) return '';
    const other = host ? NETG.seats.filter(s => s.cid && (s.gv || '') !== VERSION).map(s => s.gv || '') : NETG.joined && NETG.hostGv !== VERSION ? [NETG.hostGv] : [];
    if (!other.length) return '';
    return `<p class="note bad verdiff">Версии разные: у вас ${esc(VERSION)}, у второго устройства ${vName(other[0])}. Обновите игру на обоих устройствах — иначе карты могут считаться по-разному.</p>`;
  }
  function lobbySeat(s, host) {
    const mine = !host && s.cid === NETG.cid;
    const hs = s.house && s.house !== 'random' ? D.HOUSES[s.house] : null;
    const crest = hs ? `<img class="sgi" src="${IMG(`icons/h_${s.house}.svg`)}" alt="">` : '<span class="sgi rnd" aria-hidden="true">?</span>';
    const online = s.type === 'remote' && s.cid ? (host ? !peerOffCid(s.cid) : s.on !== false) : null;
    const who = s.type === 'host' ? (host ? 'Вы — хозяин' : `Хозяин партии`) : s.type === 'bot' ? 'Бот' : s.type === 'local' ? 'Человек у хозяина' : s.cid ? (mine ? 'Вы' : esc(s.name || 'Игрок по сети')) : 'Свободное место';
    const st = s.type === 'remote' ? (s.cid ? (online ? '<span class="lst ok">на связи</span>' : '<span class="lst off">нет связи</span>') : '<span class="lst wait">ждём…</span>') : '';
    let house = `<span class="muted">${hs ? esc(hs.name) : 'Случайный Дом'}</span>`;
    if (mine) {
      const taken = new Set((NETG.seats || []).filter(x => x !== s && x.house !== 'random').map(x => x.house));
      house = `<select class="hsel" data-ch="pick" aria-label="Ваш Дом"><option value="random"${s.house === 'random' ? ' selected' : ''}>Случайный Дом</option>${(NETG.houses || []).map(h => `<option value="${h}"${s.house === h ? ' selected' : ''}${taken.has(h) ? ' disabled' : ''}>${esc(D.HOUSES[h].name)}</option>`).join('')}</select>`;
    }
    return `<div class="lseat${mine ? ' me' : ''}">${crest}<span class="ls-t"><b>${who}</b>${house}</span>${st}</div>`;
  }

  // ===================== ИГРА ПО СЕТИ =====================
  // Партию ведёт устройство хозяина: только там работает движок. Хозяин рассылает стол целиком (сжатый снимок
  // + события для анимаций и сводок), гости присылают действия («сыграть», «купить», «бросить») и ответы на вопросы.
  // Снимок самодостаточен: пропало сообщение — следующий снимок всё исправит; гость отстал — просит свежий.
  const tnow = () => Date.now();
  const SESSION = typeof Net !== 'undefined' ? Net.rid(4) : 'x'; // номер этого открытия страницы
  function netStatusLine() {
    if (!NETG || !NETG.room) return '';
    const on = NETG.room.online, tot = NETG.room.total;
    return on ? `связь через ${on} из ${tot} ${D.plural(tot, 'сервера', 'серверов', 'серверов')}` : 'нет связи с серверами — переподключаемся…';
  }
  function peerOffCid(cid) { const pr = NETG && NETG.peers && NETG.peers.get(cid); return !pr || !pr.seen || tnow() - Math.max(pr.seen, NETG.wokeAt ? NETG.wokeAt - 5000 : 0) > 12000; }
  const sinceSeen = (cid) => { const pr = NETG && NETG.peers && NETG.peers.get(cid); return pr && pr.seen ? Math.round((tnow() - pr.seen) / 1000) : null; };
  const peerOff = (q) => (hostNet() && q.cid ? peerOffCid(q.cid) : false);
  const hostLost = () => guest() && NETG.joined && (NETG.hostGone || tnow() - Math.max(NETG.lastHost, NETG.wokeAt ? NETG.wokeAt - 9000 : 0) > 15000);
  // состояние связи для значка на планке: on — всё хорошо, warn — кто-то не отвечает, off — нет серверов
  const netState = () => (!NETG || !NETG.room ? '' : !NETG.room.online ? 'off' : (guest() ? hostLost() : !!S && S.players.some(q => q.cid && !q.away && peerOff(q))) ? 'warn' : 'on');
  // экран не гаснет, пока идёт партия по сети: на телефоне хозяина погасший экран остановил бы игру для всех
  let wakeLock = null;
  async function keepAwake(on) {
    try {
      if (on && !wakeLock && navigator.wakeLock && document.visibilityState === 'visible') { const w = await navigator.wakeLock.request('screen'); wakeLock = w; w.addEventListener('release', () => { if (wakeLock === w) wakeLock = null; }); }
      else if (!on && wakeLock) { const w = wakeLock; wakeLock = null; await w.release(); }
    } catch (e) { wakeLock = null; }
  }
  document.addEventListener('visibilitychange', () => { if (NETG && document.visibilityState === 'visible') keepAwake(true); });
  function netClose(reason) {
    if (!NETG) return;
    keepAwake(false);
    const r = NETG.room;
    clearInterval(NETG.timer); clearTimeout(NETG.ft);
    NETG = null;
    if (r) { r.send('bye', { reason: reason || 'pause' }); setTimeout(() => r.close(), 400); }
  }
  function netKey() { // что видно на экране из состояния связи — перерисовываем, только когда это меняется
    if (!NETG) return '';
    const off = S ? S.players.filter(q => q.cid).map(q => (hostNet() ? peerOff(q) : '')).join() : NETG.seats ? NETG.seats.map(s => (s.cid ? peerOffCid(s.cid) : '')).join() : '';
    return [NETG.room ? NETG.room.online : 0, off, hostLost()].join('|');
  }
  function netTouch() { const k = netKey(); if (k !== NETG.vk) { NETG.vk = k; schedule(); } }
  // ---------- возврат в приложение и восстановление связи: сразу сверить стол, не дожидаясь очередного «я здесь» ----------
  function netResync() {
    if (!NETG || !NETG.room) return;
    if (guest()) { if (S) NETG.room.send('need'); else if (!NETG.status) guestHello(); NETG.hbAt = 0; }
    else if (NETG.started) { if (S) netFlush(true); } else if (NETG.seats) lobbySend();
  }
  function netStatus(on) {
    if (!NETG) return;
    if (on && NETG.wasOn === false) { netResync(); if (S && S.winner === null) toast('📡 Связь вернулась', 1800); }
    else if (!on && NETG.wasOn === true && S && S.winner === null) toast('📡 Связь пропала — переподключаемся…', 2600);
    NETG.wasOn = on > 0; netTouch();
  }
  function netWake() {
    if (!NETG || document.visibilityState !== 'visible') return;
    NETG.wokeAt = tnow(); keepAwake(true); netResync();
    // сокет после блокировки экрана мог оказаться «мёртвым»: когда его заменят, сверимся ещё раз
    clearTimeout(NETG.wt); const g = NETG; NETG.wt = setTimeout(() => { if (NETG === g) { netResync(); netTouch(); } }, 3400);
    netTouch();
  }
  document.addEventListener('visibilitychange', netWake);
  window.addEventListener('pageshow', netWake);
  window.addEventListener('online', netWake);
  // лист «Связь»: кто на связи, через сколько серверов, отклик; кнопка «Переподключиться»
  function netRows() {
    const r = NETG.room, on = r ? r.online : 0, tot = r ? r.total : 0, rows = [];
    rows.push(['Комната', `${esc(NETG.code)} · ${NETG.role === 'host' ? 'партию ведёт это устройство' : 'вы гость'}`]);
    rows.push(['Серверы', on ? `на связи ${on} из ${tot}` : 'нет связи — переподключаемся…', on ? '' : 'bad']);
    if (guest()) {
      const lost = hostLost();
      rows.push(['Хозяин', lost ? (NETG.hostGone === 'pause' ? 'вышел в меню — подождём' : NETG.hostGone ? 'закрыл комнату' : `не отвечает ${Math.max(0, Math.round((tnow() - NETG.lastHost) / 1000))} с`) : NETG.joined ? `на связи${NETG.rtt != null ? ` · отклик ${NETG.rtt} мс` : ''}` : 'ищем комнату…', lost ? 'bad' : '']);
    } else if (S) {
      for (const q of S.players.filter(x => x.cid)) { const off = peerOff(q), ss = sinceSeen(q.cid); rows.push([`${esc(H(q).short)}${q.nick ? ` · ${esc(q.nick)}` : ''}`, q.away ? 'за него ходит бот' : off ? `нет связи${ss != null ? ` ${ss} с` : ''}` : 'на связи', off && !q.away ? 'bad' : '']); }
    } else if (NETG.seats) {
      for (const x of NETG.seats.filter(y => y.type === 'remote')) rows.push([esc(x.name || 'Игрок по сети'), x.cid ? (peerOffCid(x.cid) ? 'нет связи' : 'на связи') : 'ещё не вошёл', x.cid && peerOffCid(x.cid) ? 'bad' : '']);
    }
    return rows.map(([k, v, c]) => `<div class="ex-r${c ? ' ' + c : ''}"><div class="ex-k">${k}</div><div class="ex-v">${v}</div></div>`).join('');
  }
  function showNet() {
    if (!NETG || sheetRoot.querySelector('.netsheet')) return;
    const sh = openSheet({ title: '📡 Связь', body: `<div class="ex netrows">${netRows()}</div>
      <p class="muted" style="font-size:13.5px;margin:10px 0 0">Партию ведёт устройство хозяина. Если связь пропала, стол не теряется: игра продолжится, как только оба устройства снова в сети. Экран у хозяина лучше не блокировать.</p>
      <div class="acts2" style="margin-top:12px"><button class="btn" data-nf="re">Переподключиться</button></div>` });
    sh.el.classList.add('netsheet');
    const tm = setInterval(() => { const box = sh.el.querySelector('.netrows'); if (!NETG || !sh.el.isConnected || !box) { clearInterval(tm); return; } const h = netRows(); if (box.innerHTML !== h) box.innerHTML = h; }, 1000);
    sh.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-nf]'); if (!b) return;
      if (NETG && NETG.room) { NETG.room.recheck(true); const g = NETG; setTimeout(() => { if (NETG === g) { netResync(); netTouch(); } }, 1600); toast('Переподключаемся…', 1600); }
    });
  }

  // ---------- хозяин ----------
  function hostState(code, started) {
    return { role: 'host', code, hs: Net.rid(8), started, seats: null, peers: new Map(), n: 0, evq: [], lastKey: '', asks: new Map(), aidN: 0, done: new Map(), doing: new Set(), q: Promise.resolve(), turn: null, ft: null, tick: 0 };
  }
  function hostOpen() {
    NETG.room = Net.room(NETG.code, 'host', 'host', onHostMsg, netStatus);
    NETG.timer = setInterval(hostTick, 2000);
    keepAwake(true);
  }
  function hostCreate() {
    fixSetup(); netClose();
    // стол на двоих: устройство-хозяин пары открывает ту же комнату — второй игрок входит без кода
    const pr = pairGet(), duo = setup.seats.length === 1 && setup.seats[0].type === 'remote';
    const tb = tableGet(), sameTable = !duo && tb && tb.role === 'host' && tb.n === setup.seats.length + 1 && tb.remote === setup.seats.filter(x => x.type === 'remote').length;
    NETG = hostState(duo && pr && pr.role === 'host' ? pr.code : sameTable ? tb.code : Net.newCode(), false);
    NETG.duo = duo; NETG.pair = !!(duo && pr && pr.role === 'host');
    NETG.seats = [{ type: 'host', house: setup.house }, ...setup.seats.map(s => ({ type: s.type, house: s.house, cid: null, name: '' }))];
    hostOpen();
    view = 'lobby'; schedule();
  }
  function hostReopen() { // продолжение сохранённой партии по сети: та же комната, гости вернутся сами
    netClose();
    NETG = hostState(S.net.code, true);
    hostOpen();
  }
  function lobbyMsg() {
    return { code: NETG.code, gv: VERSION, seats: NETG.seats.map(s => ({ type: s.type, house: s.house, cid: s.cid || null, name: s.name || '', gv: s.gv || '', on: s.cid ? !peerOffCid(s.cid) : null })), mods: setup.mods, houses: availHouses() };
  }
  const lobbySend = () => NETG.room.send('lobby', lobbyMsg());
  function hostTick() {
    if (!NETG || NETG.role !== 'host') return;
    NETG.tick++;
    if (!NETG.started) lobbySend();
    else {
      if (NETG.tick % 2 === 0) NETG.room.send('hb', { hs: NETG.hs, n: NETG.n });
      for (const [aid, a] of NETG.asks) if (tnow() - a.sent > 4000) sendAsk(aid); // вдруг вопрос потерялся
    }
    netTouch();
  }
  function onHostMsg(m) {
    if (!NETG || NETG.role !== 'host' || !m.from || m.from === 'host') return;
    const pr = NETG.peers.get(m.from) || { seen: 0 };
    pr.seen = m.t === 'bye' ? 0 : tnow();
    if (m.name != null) pr.name = String(m.name).slice(0, 24);
    if (m.gz != null) pr.gz = !!m.gz;
    NETG.peers.set(m.from, pr);
    // игрок, за которого ходил бот, снова на связи — дальше играет сам
    if (NETG.started && S && m.t !== 'bye') {
      const p = S.players.find(q => q.cid === m.from);
      if (p && p.away) { p.away = false; p.isBot = false; fixNames(); toast(`📡 ${pname(p)} снова на связи и играют сами`, 3000); netFlush(true); schedule(); }
    }
    switch (m.t) {
      case 'hello': hostHello(m); break;
      case 'pick': hostPick(m); break;
      case 'bye': if (!NETG.started) { const s = NETG.seats.find(x => x.cid === m.from); if (s) { s.cid = null; s.name = ''; lobbySend(); schedule(); } } break;
      case 'need': if (NETG.started) netFlush(true); break;
      case 'hb': if (m.ts) NETG.room.send('hbk', { to: m.from, ts: m.ts }); break;
      case 'again':
        if (S && S.winner !== null) {
          NETG.again = NETG.again || new Set();
          if (!NETG.again.has(m.from)) { NETG.again.add(m.from); const q = S.players.find(x => x.cid === m.from); toast(`🔁 ${q ? pname(q) : 'Соперник'}${q && q.nick ? ` (${esc(q.nick)})` : ''}: «Сыграем ещё?»`, 5000); againUi(); schedule(); }
        }
        break;
      case 'do': if (NETG.started) hostDo(m); break;
      case 'ans': if (NETG.started) hostAns(m); break;
    }
    netTouch();
  }
  const NET_VER = 2; // версия правил: у хозяина и гостей должна совпадать
  function hostHello(m) {
    if ((m.ver || 1) !== NET_VER) { NETG.room.send('full', { to: m.from, why: 'У вас старая версия игры — обновите страницу и зайдите снова.' }); return; }
    if (NETG.started) {
      const p = S && S.players.find(q => q.cid === m.from);
      if (!p) { NETG.room.send('full', { to: m.from, why: 'В этой комнате уже идёт партия без вас.' }); return; }
      netFlush(true);
      for (const [aid, a] of NETG.asks) if (a.pi === p.i) sendAsk(aid);
      return;
    }
    const s = NETG.seats.find(x => x.cid === m.from) || NETG.seats.find(x => x.type === 'remote' && !x.cid);
    if (!s) { NETG.room.send('full', { to: m.from, why: 'Все места в комнате уже заняты.' }); return; }
    if (!s.cid) toast(`📡 Подключился ${m.name ? esc(String(m.name).slice(0, 24)) : 'игрок по сети'}`, 2400);
    s.cid = m.from; s.name = String(m.name || '').slice(0, 24); s.gv = String(m.gv || '').slice(0, 12);
    if (s.gv !== VERSION) verWarn(s.gv);
    lobbySend(); schedule();
  }
  function hostPick(m) {
    if (NETG.started) return;
    const s = NETG.seats.find(x => x.cid === m.from); if (!s) return;
    const h = m.house;
    const ok = h === 'random' || (availHouses().includes(h) && !NETG.seats.some(x => x !== s && x.house === h));
    if (ok) s.house = h;
    lobbySend(); schedule();
  }
  function hostStart() {
    if (!NETG || NETG.started) return;
    if (NETG.seats.some(s => s.type === 'remote' && !s.cid)) { toast('Ждём, пока подключатся все игроки по сети'); return; }
    const av = availHouses();
    const taken = new Set(NETG.seats.map(s => s.house).filter(h => h !== 'random'));
    const free = shuffleArr(av.filter(h => !taken.has(h)));
    const seats = NETG.seats.map(s => ({ type: s.type === 'host' ? 'local' : s.type, house: s.house === 'random' ? free.pop() : s.house, cid: s.cid || undefined, nick: s.name || undefined }));
    NETG.started = true;
    if (seats.length === 2 && seats.some(x => x.type === 'remote')) pairSet({ role: 'host', code: NETG.code, peer: (seats.find(x => x.type === 'remote') || {}).nick || '' });
    else if (seats.length > 2 && seats.some(x => x.type === 'remote')) tableSet({ role: 'host', code: NETG.code, n: seats.length, remote: seats.filter(x => x.type === 'remote').length, seats: seats.slice(1).map(x => ({ type: x.type, house: 'random' })), names: seats.filter(x => x.type === 'remote').map(x => x.nick || '').filter(Boolean) });
    startGame(false, { seats, net: true });
  }
  // ---------- «Сыграть ещё»: новая партия тем же составом, по сети — в той же комнате ----------
  const againSub = () => (guest() ? (NETG.hostGone && NETG.hostGone !== 'pause' ? 'хозяин вышел из комнаты' : NETG.askedAgain ? 'ждём хозяина комнаты…' : 'предложить хозяину комнаты') : NETG && NETG.again && NETG.again.size ? 'соперник уже ждёт' : WATCH ? 'новые Дома' : 'те же Дома и правила');
  function againUi() {
    for (const b of document.querySelectorAll('[data-act="again"]')) { const sm = b.querySelector('small'); if (sm) sm.textContent = againSub(); b.classList.toggle('wait', guest() && !!NETG.askedAgain); b.classList.toggle('pulse', !guest() && !!(NETG && NETG.again && NETG.again.size)); }
  }
  function rematch() {
    if (!S || S.winner === null) return;
    if (guest()) {
      if (NETG.hostGone && NETG.hostGone !== 'pause') { toast('Хозяин вышел из комнаты — начните заново с главного экрана'); return; }
      if (!NETG.askedAgain) { NETG.askedAgain = true; NETG.room.send('again', {}); toast('Предложение отправлено: партию начнёт хозяин комнаты', 2600); }
      againUi(); return;
    }
    if (S.tut) { goHome('setup', false); return; }
    if (WATCH) { startGame(true); return; }
    const seats = S.players.map(q => ({ type: seatOf(q) === 'remote' ? 'remote' : q.seat || (q.isBot ? 'bot' : 'local'), house: q.house, cid: q.cid || undefined, nick: q.nick || undefined }));
    if (NETG && NETG.role === 'host') {
      clearTimeout(NETG.ft);
      Object.assign(NETG, { hs: Net.rid(8), n: 0, evq: [], lastKey: '', asks: new Map(), aidN: 0, done: new Map(), doing: new Set(), q: Promise.resolve(), turn: null, ft: null, again: new Set(), started: true });
      startGame(false, { seats, net: true });
    } else startGame(false, { seats });
  }
  // события движка → гостям (пачками, раз в ~0,1 с); к событию — чей ход шёл и золото на начало хода
  function netEvent(type, data) {
    if (type !== 'change') {
      const d = data ? JSON.parse(JSON.stringify(data)) : {};
      if (type === 'turn' && S.players[d.p]) d.gold0 = S.players[d.p].gold;
      NETG.evq.push([type, d, S.cur]);
    }
    if (!NETG.ft) NETG.ft = setTimeout(() => netFlush(false), 110);
  }
  function snapS() { const s = Object.assign({}, S); s.log = S.log.slice(-80); return s; }
  const netW = () => ({ turn: NETG.turn ? NETG.turn.pi : null, asks: [...NETG.asks.keys()] });
  function gzAll() { const ps = S.players.filter(q => q.cid).map(q => NETG.peers.get(q.cid)); return ps.length > 0 && ps.every(pr => pr && pr.gz); }
  function netFlush(force) {
    if (!hostNet() || !S) return;
    clearTimeout(NETG.ft); NETG.ft = null;
    const s = snapS(), w = netW();
    const key = JSON.stringify([s, w]);
    const ev = NETG.evq; NETG.evq = [];
    const changed = key !== NETG.lastKey || ev.length > 0;
    if (!changed && !force) return;
    if (changed) { NETG.n++; NETG.lastKey = key; }
    NETG.room.send('up', { hs: NETG.hs, n: NETG.n, s, w, ev }, gzAll());
  }
  function hostTurn(p) {
    if (!hostNet()) return E.Bot.takeTurn(S, p);
    return new Promise(res => { NETG.turn = { pi: p.i, res }; netFlush(true); schedule(); });
  }
  function hostAsk(p, q) {
    if (!hostNet()) return E.Bot.decide(S, p, q);
    return new Promise(res => {
      const aid = `${NETG.hs}.${++NETG.aidN}`;
      NETG.asks.set(aid, { pi: p.i, q: JSON.parse(JSON.stringify(q)), res, sent: 0 });
      netFlush(true); sendAsk(aid); schedule();
    });
  }
  function sendAsk(aid) {
    const a = NETG.asks.get(aid); if (!a) return;
    a.sent = tnow();
    NETG.room.send('ask', { aid, pi: a.pi, q: a.q, hs: NETG.hs, n: NETG.n, s: snapS(), w: netW() }, gzAll());
  }
  function hostAns(m) {
    const a = NETG.asks.get(m.aid);
    NETG.room.send('ack', { to: m.from, aid: m.aid });
    if (!a || !S.players[a.pi] || S.players[a.pi].cid !== m.from) return;
    NETG.asks.delete(m.aid);
    a.res(m.v === undefined ? null : m.v);
    schedule();
  }
  function hostDo(m) {
    const pi = S ? S.players.findIndex(q => q.cid === m.from) : -1;
    if (pi < 0 || !m.iid) return;
    const prev = NETG.done.get(m.iid);
    if (prev) { NETG.room.send('ack', Object.assign({ to: m.from, iid: m.iid, n: NETG.n }, prev)); return; }
    if (NETG.doing.has(m.iid)) return;
    NETG.doing.add(m.iid);
    const g = NETG;
    g.q = g.q.then(() => runIntent(pi, m)).catch(e => ({ ok: false, why: e instanceof Stale ? '' : String(e && e.message || e) })).then(r => {
      if (NETG !== g) return;
      g.doing.delete(m.iid); g.done.set(m.iid, r);
      if (g.done.size > 300) g.done.delete(g.done.keys().next().value);
      netFlush(false); // сначала стол, потом ответ
      g.room.send('ack', Object.assign({ to: m.from, iid: m.iid, n: g.n }, r));
    });
  }
  async function runIntent(pi, m) {
    const p = S.players[pi];
    if (S.winner !== null) return { ok: false, why: 'Партия окончена' };
    if (!NETG.turn || NETG.turn.pi !== pi || S.cur !== pi) return { ok: false, why: 'Сейчас не ваш ход' };
    switch (m.a) {
      case 'roll': await E.roll(S, p, m.n === 2 ? 2 : 1); return { ok: !!p.turn.rolled };
      case 'play': return { ok: !!(await E.play(S, p, m.i | 0, { plot: !!m.plot, seat: !!m.seat })) };
      case 'buy': return Object.assign({}, await E.buy(S, p, m.src, m.src === 'basic' ? String(m.key) : m.key | 0));
      case 'discardSeat': return { ok: !!(await E.seatFromDiscard(S, p, String(m.id))) };
      case 'hire': case 'build': {
        const id = String(m.id);
        const r = Object.assign({}, await E.hire(S, p, id));
        if (r.ok) r.note = `🚩 «${D.regName(D.BAN[id])}» теперь с вами — знамён ${E.regCount(p)} из ${E.goal(S)}`;
        return r;
      }
      case 'xaction': return Object.assign({}, E.buyAction(S, p));
      case 'retire': return { ok: !!(await E.retire(S, p, m.i | 0)) };
      case 'fetch': return { ok: !!(await E.fetchCard(S, p, String(m.id))) };
      case 'purge': return Object.assign({}, await E.purgeBad(S, p, m.uid | 0));
      case 'penance': return Object.assign({}, await E.startPenance(S, p));
      case 'ritstart': return Object.assign({}, await E.startRitual(S, p, String(m.id)));
      case 'ritact': return Object.assign({}, await E.ritualAct(S, p, m.i | 0));
      case 'adopt': return Object.assign({}, await E.adoptFaith(S, p, String(m.id)));
      case 'renounce': return Object.assign({}, await E.renounceFaith(S, p, String(m.id)));
      case 'rite': return Object.assign({}, await E.rite(S, p, String(m.id)));
      case 'playall': await playAll(p, () => !!NETG && !!NETG.turn && NETG.turn.pi === pi); return { ok: true };
      case 'end': {
        if (!p.turn.rolled) return { ok: false, why: 'Сначала бросьте кубики' };
        const t = NETG.turn; NETG.turn = null; t.res(); return { ok: true };
      }
    }
    return { ok: false, why: 'Неизвестное действие' };
  }
  // игрок по сети пропал: за него доигрывает бот, пока не вернётся
  function netBot(i) {
    const p = S && S.players[i];
    if (!p || !hostNet() || seatOf(p) !== 'remote') return;
    p.isBot = true; p.away = true;
    for (const [aid, a] of [...NETG.asks]) if (a.pi === i) { NETG.asks.delete(aid); a.res(E.Bot.decide(S, p, a.q)); }
    if (NETG.turn && NETG.turn.pi === i) {
      const t = NETG.turn, g = NETG;
      g.q = g.q.then(() => E.Bot.takeTurn(S, p)).catch(() => {}).then(() => { if (NETG === g && g.turn === t) { g.turn = null; t.res(); } });
    }
    fixNames();
    toast(`🤖 Пока ${pname(p)} не на связи, за них ходит бот`, 3200);
    netFlush(true); schedule();
  }

  // ---------- гость ----------
  function guestJoin(code, name, cid) {
    netClose();
    NETG = { role: 'guest', code, cid: cid || Net.rid(10), name: name || '', hs: null, n: -1, w: {}, seats: null, mods: null, houses: null, joined: false, started: false, status: '', lastHost: 0, hostGone: null, pending: null, k: 0, answers: new Map(), asksOpen: new Map(), done: new Set(), helloAt: 0, hbAt: 0, ended: false };
    NETG.room = Net.room(code, 'guest', NETG.cid, onGuestMsg, netStatus);
    try { localStorage.setItem(NET_KEY, JSON.stringify({ code, cid: NETG.cid, name: NETG.name })); } catch (e) { /* ignore */ }
    NETG.timer = setInterval(guestTick, 1000);
    keepAwake(true);
    guestHello();
    S = null; view = 'lobby'; schedule();
  }
  function guestHello() { NETG.room.send('hello', { name: NETG.name, gz: Net.canGzip(), ver: NET_VER, gv: VERSION }); NETG.helloAt = tnow(); }
  function guestTick() {
    if (!guest()) return;
    const t = tnow();
    if (!NETG.status && !NETG.joined && t - NETG.helloAt > 2000) guestHello(); // стучимся, пока хозяин не ответит
    if (NETG.joined && t - NETG.hbAt > 5000) { NETG.room.send('hb', { ts: t }); NETG.hbAt = t; }
    if (NETG.pending && !NETG.pending.ack && t - NETG.pending.at > 2500) { NETG.room.send('do', NETG.pending.msg); NETG.pending.at = t; }
    if (NETG.pending && NETG.pending.ack && t - NETG.pending.ackAt > 1500) guestFinish();
    for (const [aid, a] of NETG.answers) if (t - a.at > 2500) { NETG.room.send('ans', { aid, v: a.v }); a.at = t; }
    netTouch();
  }
  function onGuestMsg(m) {
    if (!guest() || m.from !== 'host' || (m.to && m.to !== NETG.cid)) return;
    NETG.lastHost = tnow();
    switch (m.t) {
      case 'lobby':
        if (S) break;
        NETG.seats = m.seats || []; NETG.mods = m.mods || []; NETG.houses = m.houses || [];
        NETG.joined = NETG.seats.some(s => s.cid === NETG.cid); NETG.status = ''; NETG.hostGone = null;
        NETG.hostGv = String(m.gv || ''); if (NETG.joined && NETG.hostGv !== VERSION) verWarn(NETG.hostGv);
        schedule(); break;
      case 'full': if (!S) { NETG.status = m.why || 'Мест нет'; schedule(); } break;
      case 'up': guestUp(m); break;
      case 'ask': guestAsk(m); break;
      case 'ack': guestAck(m); break;
      case 'hb': NETG.hostGone = null; if (S && (m.hs !== NETG.hs || m.n > NETG.n)) NETG.room.send('need'); break;
      case 'hbk': if (m.ts) NETG.rtt = Math.max(0, tnow() - m.ts); break;
      case 'bye': NETG.hostGone = m.reason || 'pause'; againUi(); schedule(); break;
    }
  }
  function guestUp(m) {
    if (!m.s || !Array.isArray(m.s.players)) return;
    if (m.hs !== NETG.hs) {
      // хозяин перезапустил партию (перезагрузил страницу): ход начался заново — старые вопросы и действия не в счёт
      const had = NETG.hs !== null;
      NETG.hs = m.hs; NETG.n = -1;
      if (had) {
        for (const a of NETG.asksOpen.values()) { for (const el of a.els) { if (el.close) el.close(); else el.remove(); } if (a.adj) adjustReq = null; }
        NETG.asksOpen.clear(); NETG.done.clear(); NETG.answers.clear();
        if (NETG.pending) { NETG.pending = null; busy = false; }
      }
    }
    if (m.n <= NETG.n) return;
    const me = m.s.players.findIndex(q => q.cid === NETG.cid);
    if (me < 0) return;
    NETG.n = m.n; NETG.joined = true; NETG.hostGone = null;
    // новая партия в той же комнате («Сыграть ещё») приходит как обычный стол, но с другим номером партии
    const again = !!S && !!m.s.gid && !!S.gid && m.s.gid !== S.gid;
    const first = !S || again;
    if (first) {
      runId++; closeAllSheets(); closeAllPages(); resetTable(); NETG.started = true; NETG.ended = false; NETG.askedAgain = false;
      try { localStorage.setItem(NET_KEY, JSON.stringify({ code: NETG.code, cid: NETG.cid, name: NETG.name })); } catch (e) { /* ignore */ }
      if (m.s.players.length === 2) pairSet({ role: 'guest', code: NETG.code, cid: NETG.cid, name: NETG.name });
      else if (m.s.players.length > 2) tableSet({ role: 'guest', code: NETG.code, cid: NETG.cid, name: NETG.name, n: m.s.players.length });
      if (again) toast('🔁 Новая партия за тем же столом', 2600);
      if (m.s.round === 1 && m.s.cur === m.s.first && !m.s.players[m.s.cur].turn.rolled && !(m.ev || []).length) introStart();
    }
    S = m.s; ME = me; WATCH = false;
    NETG.w = m.w || {};
    if (first) { diceView = S.lastRoll ? { ...S.lastRoll, final: true } : null; window.scrollTo(0, 0); }
    for (const e of m.ev || []) { evCur = e[2]; try { onEvent(e[0], e[1] || {}); } catch (x) { console.error(x); } finally { evCur = null; } }
    guestDropAsks();
    if (NETG.pending && NETG.pending.ack && NETG.n >= (NETG.pending.ack.n || 0)) guestFinish();
    if (S.winner !== null && !NETG.ended) { NETG.ended = true; forgetNetSession(); pairScore(); const g = runId; setTimeout(() => { if (g === runId) showVictory().then(() => { if (g === runId) showResults(); }); }, 600); }
    schedule();
  }
  // хозяин снял вопрос (ответил бот, ход ушёл) — закрыть лист с вопросом
  function guestDropAsks() {
    const live = new Set((NETG.w && NETG.w.asks) || []);
    for (const [aid, a] of [...NETG.asksOpen]) if (!live.has(aid)) {
      for (const el of a.els) { if (el.close) el.close(); else el.remove(); }
      if (a.adj) adjustReq = null;
      NETG.asksOpen.delete(aid); NETG.done.add(aid);
    }
  }
  function guestAsk(m) {
    if (NETG.asksOpen.has(m.aid) || NETG.done.has(m.aid)) return;
    if (m.s) guestUp({ hs: m.hs, n: m.n, s: m.s, w: m.w, ev: [] });
    if (!S || m.pi !== ME) return;
    const before = new Set(sheetRoot.children);
    const pr = askHuman(S.players[ME], m.q);
    NETG.asksOpen.set(m.aid, { els: [...sheetRoot.children].filter(el => !before.has(el)), adj: m.q.type === 'adjust' });
    const g = NETG;
    pr.then(v => {
      if (NETG !== g || g.done.has(m.aid)) return;
      g.asksOpen.delete(m.aid); g.done.add(m.aid);
      const val = v === undefined ? null : v;
      g.answers.set(m.aid, { v: val, at: tnow() });
      g.room.send('ans', { aid: m.aid, v: val });
      schedule();
    });
    if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) { /* ignore */ }
    schedule();
  }
  function guestAck(m) {
    if (m.aid != null) { NETG.answers.delete(m.aid); return; }
    const p = NETG.pending;
    if (!p || p.iid !== m.iid || p.ack) return;
    p.ack = m; p.ackAt = tnow();
    if (NETG.n >= (m.n || 0)) guestFinish();
  }
  function guestFinish() {
    const p = NETG.pending; if (!p) return;
    NETG.pending = null; busy = false;
    const a = p.ack;
    if (a && !a.ok && a.why) toast(esc(a.why));
    else if (a && a.ok && a.note) toast(esc(a.note), 3200);
    schedule();
  }
  // действие гостя → хозяину; пока нет ответа, кнопки заблокированы (повтор — сам, если сообщение потерялось)
  function netDo(a, args) {
    if (!guest() || NETG.pending) return;
    const iid = `${NETG.cid}.${SESSION}.${++NETG.k}`;
    NETG.pending = { iid, msg: Object.assign({ iid, a }, args || {}), at: tnow(), ack: null, ackAt: 0 };
    busy = true; schedule();
    NETG.room.send('do', NETG.pending.msg);
  }

  // ---------- действия ----------
  // «Сыграть все»: сначала карты «возьмите карты», потом остальные, кроме нападений и очищения колоды
  async function playAll(p, still) {
    for (let g = 0; g < 20 && p.hand.length && still(); g++) {
      const i = p.hand.findIndex(id => D.COURT[id].fx.some(op => op[0] === 'draw'));
      const j = i >= 0 ? i : p.hand.findIndex(id => !D.COURT[id].fx.some(op => ['siege', 'spy', 'forage', 'board', 'trash'].includes(op[0])));
      await E.play(S, p, j >= 0 ? j : 0);
      await wait(120);
    }
  }
  async function guarded(fn) {
    if (busy) return;
    busy = true; schedule();
    try { await fn(); } catch (e) { if (!(e instanceof Stale)) { console.error(e); toast('Ошибка: ' + esc(e.message), 5000); } }
    finally { busy = false; schedule(); }
  }
  // подробности открываются на столе, в каталоге и в листе соперника (поверх него)
  const infoOk = (el) => !el.closest('.scrim') || !!el.closest('.catbody') || !!el.closest('.oppbody') || !!el.closest('.fcards');
  document.addEventListener('click', (e) => {
    if (!sound || !e.target.closest) return;
    const b = e.target.closest('.btn, .ht, .opt, .li, .seg button, .nav-back, .mod, .abar .second, .abar .sq, .abar .primary, .drawer [data-act="drawer-close"]');
    if (!b || b.disabled) return;
    const a = b.dataset.act;
    if (a === 'drawer' || a === 'drawer-close') Sfx.slide();
    else if (!['roll', 'coin-all', 'play', 'play-all', 'buy', 'hire', 'adopt', 'retire'].includes(a)) Sfx.tap();
  }, true);
  document.addEventListener('pointerdown', () => { if (introT) introEnd(); }, { passive: true, capture: true });
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    // нажатие мимо кнопок на столе снимает выбор с карты руки
    if (!el) { if (selCard && e.target.closest('.board') && !e.target.closest('.handz .hcard')) { selCard = null; schedule(); } return; }
    if (el.disabled) return;
    if (el.closest('.scrim') && !['new', 'info-estate', 'info-court', 'info-ban', 'zoom', 'fetch', 'discard-seat', 'res', 'pile', 'purge', 'penance', 'ritstart', 'ritact', 'rite-go'].includes(el.dataset.act)) return;
    const a = el.dataset.act;
    const p = S ? S.players[ME !== null ? ME : S.cur] : null;
    switch (a) {
      case 'pick': if (houseOk(el.dataset.h)) { setup.house = el.dataset.h; fixSetup(); savePrefs(); schedule(); } break;
      case 'skill': setup.skill = el.dataset.k; savePrefs(); schedule(); break;
      case 'preset': setup.mods = D.PRESETS[el.dataset.k].modules.slice(); fixSetup(); savePrefs(); schedule(); break;
      case 'length': setup.mods = [...D.LENGTHS[el.dataset.k].mods, ...MODK.filter(setupOn).flatMap(x => D.modMembers(x))]; fixSetup(); savePrefs(); schedule(); break;
      case 'mod': { const k = el.dataset.k; setup.mods = [...D.LENGTHS[lengthOf(setup.mods)].mods, ...(setupOn(k) ? MODK.filter(x => x !== k && setupOn(x)) : MODK.filter(x => x === k || setupOn(x))).flatMap(x => D.modMembers(x))]; fixSetup(); savePrefs(); schedule(); break; }
      case 'seat-type': { const k = +el.dataset.k; if (setup.seats[k]) { setup.seats[k].type = el.dataset.v; fixSetup(); savePrefs(); schedule(); } break; }
      case 'seat-add': { const max = Math.min(availHouses().length - 1, R.maxPlayers - 1); if (setup.seats.length < max) { setup.seats.push({ type: 'bot', house: 'random' }); fixSetup(); savePrefs(); schedule(); } break; }
      case 'seat-del': if (setup.seats.length > 1) { setup.seats.pop(); fixSetup(); savePrefs(); schedule(); } break;
      case 'start': if (hasRemote()) hostCreate(); else startGame(false); break;
      case 'watch': startGame(true); break;
      case 'tutorial': startGame(false, { tut: true }); break;
      case 'friends': showFriends(); break;
      case 'duo': { const pr = pairGet(); if (pr) duoGo(pr); else showDuo(); break; }
      case 'duo-other': showDuo(); break;
      case 'again': rematch(); break;
      case 'join-go': {
        const code = Net.normCode(joinDraft.code);
        if (code.length !== 5) { toast('Код комнаты — 5 знаков'); break; }
        guestJoin(code, joinDraft.name.trim());
        break;
      }
      case 'net-rejoin': { const x = netSaved(); if (x) { closeAllPages(); guestJoin(x.code, x.name || '', x.cid); } break; }
      case 'lobby-start': hostStart(); break;
      case 'lobby-leave': {
        const wasHost = NETG && NETG.role === 'host';
        if (!wasHost) forgetNetSession();
        netClose(wasHost ? 'close' : 'leave');
        view = wasHost ? 'setup' : 'home'; schedule(); break;
      }
      case 'net-bot': netBot(+el.dataset.i); break;
      case 'net-info': showNet(); break;
      case 'cover-ok': if (coverReq) { const c = coverReq; coverReq = null; ME = c.p; selCard = null; drawer = null; oppFocus = null; closeAllSheets(); closeAllPages(); toastRoot.innerHTML = ''; c.res(); schedule(); } break;
      case 'tut-ok': if (S && S.tut) { const id = el.dataset.id; if (!S.tut.seen.includes(id)) S.tut.seen.push(id); S.tut.q = S.tut.q.filter(x => x.id !== id); saveSafe(); schedule(); } break;
      case 'tut-off': if (S && S.tut) { S.tut.off = true; saveSafe(); toast('Подсказки выключены. Включить снова можно в меню ☰.', 3600); schedule(); } break;
      case 'continue': if (savedGame) { closeAllPages(); resumeGame(savedGame); } break;
      case 'rules': showRules(); break;
      case 'aid': showAid(); break;
      case 'catalog': showCatalog(); break;
      case 'menu': showMenu(); break;
      case 'log': if (S) showLog(); break;
      // v10: выбор карты руки, листы «Рынок» и «Знамёна», «Мой двор»
      case 'sel': {
        if (performance.now() - swallow < 400) break;
        const i = +el.dataset.i, id = el.dataset.id;
        if (!isMyTurn() || WATCH || busy) { showInfo({ act: 'info-court', id, o: p ? String(p.i) : undefined }); break; }
        if (selCard && selCard.i === i) { showInfo({ act: 'info-court', id, o: String(p.i), hand: true }); break; } // второе нажатие — карта крупно, с кнопкой «Сыграть»
        selCard = { i, id }; drawer = null; if (sound) Sfx.lift(); schedule(); break;
      }
      case 'desel': selCard = null; schedule(); break;
      case 'drawer': { if (L.big) break; const d = el.dataset.d === 'regalia' ? 'regalia' : 'market'; drawer = drawer === d ? null : d; selCard = null; if (drawer && tutOn()) { const h = coachHint(p); if (h && !h.once) coachMin = h.id; } schedule(); break; }
      case 'drawer-close': drawer = null; schedule(); break;
      case 'my': showMy(); break;
      case 'opp-focus': { const i = +el.dataset.i; if (oppFocus === i) infoOpp(i); else { oppFocus = i; schedule(); } break; }
      case 'coach-min': coachMin = el.dataset.id; schedule(); break;
      case 'coach-max': coachMin = null; schedule(); break;
      case 'opp': infoOpp(+el.dataset.i); break;
      case 'info-estate': if (infoOk(el)) showInfo(cardData(el), navFrom(el)); break;
      case 'info-court': if (infoOk(el)) { const bt = e.target.closest('button'); if (bt && bt !== el) break; showInfo(cardData(el), navFrom(el)); } break;
      case 'info-ban': if (infoOk(el)) { const bt = e.target.closest('button'); if (bt && bt !== el) break; showInfo(cardData(el), navFrom(el)); } break;
      case 'zoom': if (infoOk(el)) showInfo(cardData(el), navFrom(el)); break;
      case 'speed': cycleSpeed(); break;
      case 'pause': paused = !paused; schedule(); break;
      case 'results': showResults(); break;
      case 'new': goHome('setup', false); break;
      case 'home': if (S) goHome('home', S.winner === null); else { view = 'home'; schedule(); } break;
      case 'setup': view = 'setup'; schedule(); break;
      case 'settings': showSettings(); break;
      case 'next': if (nextReq) { const r = nextReq; nextReq = null; r.res(); schedule(); } break;
      case 'roll': if (isMyTurn() && !busy && !(guest() && NETG.pending)) { const n = +el.dataset.n; lastN = n; drawer = null; selCard = null; throwKey = `${S.round}:${S.cur}`; startThrow(n, el, flick && flick.el === el ? flick : null); if (guest()) netDo('roll', { n }); else guarded(() => E.roll(S, p, n)); } break;
      case 'coin': takeCoin(+el.dataset.k); break;
      case 'coin-card': e.stopPropagation(); for (const k of String(el.dataset.coins || '').split(',').filter(Boolean)) takeCoin(+k); break;
      case 'coin-all': for (const c of myCoins()) takeCoin(c.k); break;
      case 'pile': if (S) showPile(S.players[el.dataset.i != null ? +el.dataset.i : viewIdx()], el.dataset.w); break; // data-i — стопки соперника (v10.18)
      case 'adj-reroll': if (adjustReq) { const r = adjustReq; adjustReq = null; r.res({ a: 'reroll' }); schedule(); } break;
      case 'adj-one': if (adjustReq) { const r = adjustReq; adjustReq = null; r.res({ a: 'one', k: +el.dataset.k }); schedule(); } break;
      case 'adj-shift': if (adjustReq) { const r = adjustReq; adjustReq = null; r.res({ a: 'shift', d: +el.dataset.d }); schedule(); } break;
      case 'adj-ok': if (adjustReq) { const r = adjustReq; adjustReq = null; r.res({ a: 'accept' }); schedule(); } break;
      case 'adj-min': if (adjustReq) { e.stopPropagation(); adjMin = true; schedule(); } break;
      case 'adj-max': if (adjustReq) { e.stopPropagation(); adjMin = false; schedule(); } break;
      case 'adj-setsheet': if (adjustReq) {
        e.stopPropagation();
        const q = adjustReq.q, fmtG = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0') + '🪙';
        choiceSheet('🌟 Перст судьбы: какой кубик повернуть?', `<p class="note">Один кубик — на любую грань, раз в ход.${q.n > 1 ? ' Дубль от поворота не считается.' : ''} Справа — ваш доход по броску.</p>`,
          [...setChoices(S.players[ME], q).map(c => { const pl = S.players[ME].plots.filter(x => x.kind === 'dice' && x.nums && x.nums.includes(c.t)).length; const o = pvLine(S.players[ME], c.t, false) + (pl ? ` · + ${pl > 1 ? `${pl} замысла` : 'замысел'}` : '') + (c.t <= 2 && E.sinned(S.players[ME], 'lust') ? ' · 😈 карта сопернику' : ''); return { icon: '🎲', value: c, right: fmtG(c.g), html: `${q.n > 1 ? `<b>${c.from} → ${c.v}</b> · сумма ${c.t}` : `<b>${c.from} → ${c.v}</b>`}${o ? `<br><span class="muted">${o}</span>` : ''}` }; }), { icon: '▾', value: null, right: '', html: '<b>Свернуть — посмотреть стол</b><br><span class="muted">вернуться — кнопка «Перст судьбы»</span>' }])
          .then(c => { if (c && adjustReq) { const r = adjustReq; adjustReq = null; r.res({ a: 'set', k: c.k, v: c.v }); schedule(); } });
      } break;
      case 'play': if (isMyTurn()) { e.stopPropagation(); playCard(+el.dataset.i); } break;
      case 'plot': if (isMyTurn()) { e.stopPropagation(); const i = +el.dataset.i; flyHand(i, 'court'); selCard = null; if (guest()) netDo('play', { i, plot: true }); else guarded(async () => { await E.play(S, p, i, { plot: true }); }); } break;
      case 'discard-seat': if (isMyTurn()) { e.stopPropagation(); const id = el.dataset.id; { const sc = el.closest('.scrim'); if (sc && sc.close) sc.close(); } if (guest()) netDo('discardSeat', { id }); else guarded(async () => { await E.seatFromDiscard(S, p, id); }); } break;
      case 'court-seat': if (isMyTurn()) { e.stopPropagation(); const i = +el.dataset.i; flyHand(i, 'court'); selCard = null; if (guest()) netDo('play', { i, seat: true }); else guarded(async () => { await E.play(S, p, i, { seat: true }); }); } break;
      case 'buy': if (isMyTurn()) { e.stopPropagation(); flyArm(el); const src = el.dataset.src; const key = src === 'basic' ? el.dataset.key : +el.dataset.key; if (guest()) netDo('buy', { src, key }); else guarded(async () => { const r = await E.buy(S, p, src, key); if (!r.ok) { flySrc = null; toast(esc(r.why || 'Нельзя')); if (sound) Sfx.deny(); } }); } break;
      case 'hire': if (isMyTurn()) { flyArm(el); const id = el.dataset.id; if (guest()) netDo('hire', { id }); else guarded(async () => { const r = await E.hire(S, p, id); if (!r.ok) { flySrc = null; toast(esc(r.why || 'Нельзя')); if (sound) Sfx.deny(); } else toast(`🚩 «${esc(D.regName(D.BAN[id]))}» теперь с вами — знамён ${E.regCount(p)} из ${E.goal(S)}`, 3200); }); } break;
      case 'step-ok': if (stepReq) { e.stopPropagation(); stepDone(); } break;
      case 'cu-why': if (S) { e.stopPropagation(); const q = S.players[ME]; openSheet({ title: '🫱 Догоняющий наём', body: `<p>${cuWhy(q)}</p><p class="muted">Нанять — ${whereShop('Знамёна')}, ряд вассалов: цена на карте остаётся золотой, даже если действия кончились.</p>` }); } break;
      case 'refresh-tap': if (stepReq && stepReq.d.kind === 'refresh') { e.stopPropagation(); stepDone(); } break;
      case 'refresh-all': if (stepReq && stepReq.d.kind === 'refresh') { e.stopPropagation(); rfAll = S.round; stepDone(); } break;
      case 'xaction': if (isMyTurn()) { e.stopPropagation(); if (guest()) netDo('xaction', {}); else { const X = E.extraCost(S, p), r = E.buyAction(S, p); if (!r.ok) toast(esc(r.why || 'Нельзя')); else { if (sound) Sfx.coin && Sfx.coin(); toast(`Второе действие: −${X}🪙`); } schedule(); } } break;
      case 'retire': if (isMyTurn()) { e.stopPropagation(); const i = +el.dataset.i; if (!armedOn('retire:' + p.hand[i] + ':' + i)) { arm('retire:' + p.hand[i] + ':' + i); break; } armed = null; flyHand(i, 'out'); selCard = null; if (guest()) netDo('retire', { i }); else guarded(async () => { await E.retire(S, p, i); }); } break;
      case 'rollsum': showRoll(); break;
      case 'penance': if (isMyTurn()) { e.stopPropagation(); closeAllSheets(); if (guest()) netDo('penance', {}); else guarded(async () => { const r = await E.startPenance(S, p); if (!r.ok) toast(esc(r.why || 'Нельзя')); }); } break;
      case 'faith-tile': e.stopPropagation(); infoZoom('faith', el.dataset.id); break; // лист веры; обряд — кнопкой в нём (ответ владельца 2.3)
      case 'rite-go': if (isMyTurn()) { e.stopPropagation(); const id = el.dataset.id; closeAllSheets(); if (guest()) netDo('rite', { id }); else guarded(async () => { const r = await E.rite(S, p, id); if (!r.ok) toast(esc(r.why || 'Нельзя')); }); } break;
      case 'ex': if (isMyTurn()) {
        e.stopPropagation(); const k = el.dataset.k;
        if (k === 'rite') { const f = el.dataset.f; if (guest()) netDo('rite', { id: f }); else guarded(async () => { const r = await E.rite(S, p, f); if (!r.ok) toast(esc(r.why || 'Нельзя')); }); }
        else if (k === 'ritual' || k === 'ritstart') { showMy(); setTimeout(() => { const h = [...document.querySelectorAll('.scrim:not(.out) .sec-h h3')].find(x => /Ритуал/.test(x.innerText)); if (h) h.closest('.sec-h').scrollIntoView({ block: 'start' }); }, 60); }
        else if (k === 'fetch') { const b = document.querySelector('.handz .pile.disc'); if (b) b.click(); }
        else if (k === 'adopt' || k === 'fair') { if (!L.big) { drawer = k === 'adopt' ? 'regalia' : 'market'; selCard = null; schedule(); } else { const c = document.querySelector(k === 'adopt' ? '.shopcol > .shop.rg' : '.shopcol > .shop.mk'); if (c) c.scrollIntoView({ block: 'nearest' }); } }
      } break;
      case 'ritstart': if (isMyTurn()) { e.stopPropagation(); const id = el.dataset.id; closeAllSheets(); if (guest()) netDo('ritstart', { id }); else guarded(async () => { const r = await E.startRitual(S, p, id); if (!r.ok) toast(esc(r.why || 'Нельзя')); }); } break;
      case 'ritact': if (isMyTurn()) { e.stopPropagation(); const i = +el.dataset.i; closeAllSheets(); if (guest()) netDo('ritact', { i }); else guarded(async () => { const r = await E.ritualAct(S, p, i); if (!r.ok) toast(esc(r.why || 'Нельзя')); }); } break;
      case 'purge': if (isMyTurn()) { e.stopPropagation(); const uid = +el.dataset.uid; closeAllSheets(); if (guest()) netDo('purge', { uid }); else guarded(async () => { const r = await E.purgeBad(S, p, uid); if (!r.ok) toast(esc(r.why || 'Нельзя')); }); } break;
      case 'res': { e.stopPropagation(); const q = S.players[+el.dataset.i]; if (q) showRes(q, el.dataset.s); } break;
      case 'fetch': if (isMyTurn()) { e.stopPropagation(); const id = el.dataset.id; { const sc = el.closest('.scrim'); if (sc && sc.close) sc.close(); } if (guest()) netDo('fetch', { id }); else guarded(async () => { await E.fetchCard(S, p, id); }); } break;
      case 'adopt': if (isMyTurn()) { flyArm(el); const id = el.dataset.id; if (guest()) netDo('adopt', { id }); else guarded(async () => { const r = await E.adoptFaith(S, p, id); if (!r.ok) toast(esc(r.why || 'Нельзя')); }); } break;
      case 'renounce': if (isMyTurn()) { const id = el.dataset.id; if (guest()) netDo('renounce', { id }); else guarded(async () => { const r = await E.renounceFaith(S, p, id); if (!r.ok) toast(esc(r.why || 'Нельзя')); }); } break;
      case 'rite': if (isMyTurn()) { const id = el.dataset.id; if (guest()) netDo('rite', { id }); else guarded(async () => { const r = await E.rite(S, p, id); if (!r.ok) toast(esc(r.why || 'Нельзя')); }); } break;
      case 'play-all': if (isMyTurn()) { if (guest()) netDo('playall'); else guarded(() => playAll(p, isMyTurn)); } break;
      case 'end': if (isMyTurn() && p.turn.rolled && !busy) { if (!armedOn('end') && endLeft(p)) { arm('end'); break; } armed = null; drawer = null; selCard = null; if (guest()) netDo('end'); else { const res = endTurnResolve; endTurnResolve = null; res(); schedule(); } } break;
    }
  });

  // выпадающие списки (Дом соперника, Дом гостя в комнате) и поля ввода (код комнаты, имя)
  document.addEventListener('change', (e) => {
    const el = e.target && e.target.closest && e.target.closest('[data-ch]'); if (!el) return;
    if (el.dataset.ch === 'seat-house') { const k = +el.dataset.k; if (setup.seats[k]) { setup.seats[k].house = el.value; fixSetup(); savePrefs(); schedule(); } }
    else if (el.dataset.ch === 'pick' && guest() && !S) NETG.room.send('pick', { house: el.value });
  });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'jcode') { const v = Net.normCode(el.value); if (v !== el.value) el.value = v; joinDraft.code = v; }
    else if (el.id === 'jname') joinDraft.name = el.value.slice(0, 20);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.target.id === 'jcode' || e.target.id === 'jname')) { const b = document.querySelector('[data-act="join-go"]'); if (b) b.click(); } });

  // ---------- запуск ----------
  function splash() {
    if (document.getElementById('splash')) return;
    const el = document.createElement('div');
    el.id = 'splash';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<div class="sp-in"><img src="${IMG('icons/i_crown.svg')}" alt=""><b>Претенденты</b><span>карточная игра</span></div>`;
    document.body.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), reduceMotion() ? 0 : 420); }, reduceMotion() ? 250 : 1000);
  }
  // сохранённая партия из прошлой версии может ссылаться на убранные Дома и карты — такую не открываем
  // сохранение подходит, только если все его карты есть в этой версии игры — во всех стопках, а не только у игроков
  // (v10.11: шесть бед двора убраны; беда на рынке или в колоде двора раньше проходила проверку и могла сломать партию)
  function saveFits(x) {
    try {
      // v10.14: карту проверяем и по виду — беды двора «Сглаз», «Проклятая реликвия» и «Заговор» стали проклятиями-владениями,
      // и такая карта в руке или колоде двора из прошлой версии сломала бы партию
      const of = (src) => (v) => { const id = v && typeof v === 'object' ? v.id : v; return !!src[id]; };
      const C = of(D.COURT), Es = of(D.ESTATES), B = of(D.BAN);
      const all = (a, ok) => a == null || (Array.isArray(a) && a.every(ok));
      const rows = { courtDeck: C, courtRow: C, estateDeck: Es, estateRow: Es, holdDeck: Es, holdRow: Es, vDeck: B, vRow: B, lDeck: B, lRow: B, gDeck: B, gRow: B, destroyed: Es };
      const own = { hand: C, deck: C, discard: C, inPlay: C, plots: C, seats: C, trashed: C, sins: C, vassals: B, lords: B, greats: B, estates: Es };
      return Object.keys(rows).every(k => all(x[k], rows[k])) && Object.values(x.faithPool || {}).every(a => all(a, C))
        && (x.players || []).every(p => D.HOUSES[p.house] && Object.keys(own).every(k => all(p[k], own[k])));
    } catch (e) { return false; }
  }
  // если игра не смогла открыться — не оставлять пустой зелёный экран: показать ошибку и дать сбросить сохранения
  function bootError(e) {
    try { console.error(e); } catch (x) { /* консоли нет */ }
    const msg = String((e && (e.message || e)) || 'неизвестная ошибка').replace(/[<>&]/g, '');
    const box = app || document.body;
    box.innerHTML = `<div style="max-width:420px;margin:60px auto;padding:20px;border-radius:14px;background:#f3ead6;color:#241d14;font:15px/1.45 system-ui"><b style="font-size:18px">Не удалось открыть игру</b><p>Скорее всего, мешают настройки или сохранённая партия из прошлой версии.</p><p style="font-size:12px;color:#6c5a3a">${msg}</p><button id="boot-reset" style="padding:10px 14px;border-radius:10px;border:0;background:#c99227;color:#fff;font-weight:700">Сбросить сохранения и открыть заново</button></div>`;
    const b = document.getElementById('boot-reset');
    if (b) b.onclick = () => { try { for (const k of [SAVE_KEY, PREF_KEY, NET_KEY]) localStorage.removeItem(k); } catch (x) { /* нет доступа */ } location.reload(); };
  }
  window.addEventListener('error', (ev) => { if (app && !app.children.length) bootError(ev.error || ev.message); });
  // ---------- v10.7: игра сама обновляется с GitHub Pages ----------
  // В начале index.html лежит метка сборки (<meta name="pretendenty-build">). При запуске, при возврате в игру и раз в 10 минут
  // игра скачивает начало свежего index.html (несколько КБ) и сравнивает метки. Нашлась новая сборка — обновляемся,
  // но только вне партии: на главном экране сразу, на итогах и в сетевой комнате — кнопкой. Партия сохраняется сама.
  const BUILD = (() => { const m = document.querySelector('meta[name="pretendenty-build"]'); return m ? m.content : ''; })();
  const UPD_ON = !!BUILD && /^https?:$/.test(location.protocol);
  const UPD_KEY = 'pretendenty-upd-v1';
  let updNew = null, updAt = 0, updBusy = false, updGoing = false, updLast = '';
  const updVer = (b) => String(b || '').split('·')[0];
  const updGet = () => { try { return JSON.parse(sessionStorage.getItem(UPD_KEY) || 'null'); } catch (e) { return null; } };
  const updPut = (v) => { try { if (v) sessionStorage.setItem(UPD_KEY, JSON.stringify(v)); else sessionStorage.removeItem(UPD_KEY); } catch (e) { /* нет хранилища */ } };
  async function updCheck(force) {
    if (!UPD_ON || updBusy || updGoing || (!force && Date.now() - updAt < 60000) || navigator.onLine === false) return;
    updBusy = true; updAt = Date.now();
    const ctl = typeof AbortController === 'function' ? new AbortController() : null, tm = setTimeout(() => ctl && ctl.abort(), 9000);
    try {
      const r = await fetch(`${location.pathname}?upd=${Date.now()}`, { cache: 'no-store', headers: { Range: 'bytes=0-4095' }, signal: ctl ? ctl.signal : undefined });
      let txt = '';
      if (r.body && r.body.getReader && typeof TextDecoder === 'function') {
        const rd = r.body.getReader(), dec = new TextDecoder();
        while (txt.length < 16384) { const x = await rd.read(); if (x.done) break; txt += dec.decode(x.value, { stream: true }); if (/name="pretendenty-build" content="[^"]*"/.test(txt)) break; }
        try { rd.cancel(); } catch (e) { /* уже закрыт */ }
      } else txt = (await r.text()).slice(0, 16384);
      const m = (r.ok || r.status === 206) && txt.match(/name="pretendenty-build" content="([^"]+)"/);
      updLast = `${new Date().toLocaleTimeString('ru-RU')}: ${m ? (m[1] === BUILD ? 'новее нет' : `на сайте ${m[1]}`) : `метки нет (${r.status})`}`;
      if (m && m[1] !== BUILD) { updNew = m[1]; updTick(); }
    } catch (e) { updLast = `${new Date().toLocaleTimeString('ru-RU')}: не вышло (${e && e.name === 'AbortError' ? 'долго нет ответа' : 'нет связи'})`; }
    clearTimeout(tm); updBusy = false;
  }
  // что делать с найденной сборкой: в партии и в сетевой игре — молчим; на итогах и в комнате — кнопка; на главном экране — обновляемся
  function updTick() {
    if (!updNew || updGoing) return;
    const inGame = !!S && S.winner === null, netGame = !!NETG && !!NETG.started && !!S && S.winner === null;
    if (inGame || netGame) { updBar(false); return; }
    const tried = updGet(), looping = tried && tried.to === updNew && tried.n >= 2 && Date.now() - tried.at < 600000;
    if (S || NETG || looping) { updBar(true); return; }
    updGo();
  }
  function updGo() {
    if (!updNew || updGoing) return;
    updGoing = true;
    const tried = updGet(); updPut({ to: updNew, at: Date.now(), n: tried && tried.to === updNew ? (tried.n || 0) + 1 : 1 });
    toast(`Обновляю игру до версии ${esc(updVer(updNew))}…`, 2200);
    setTimeout(() => location.replace(`${location.pathname}?v=${encodeURIComponent(updNew)}`), reduceMotion() ? 200 : 1100);
  }
  function updBar(on) {
    let el = document.getElementById('updbar');
    if (!on) { if (el) el.remove(); return; }
    const both = !!NETG;
    const html = `<span><b>Вышла версия ${esc(updVer(updNew))}</b>${both ? '<small>обновитесь оба — на каждом устройстве</small>' : '<small>займёт пару секунд</small>'}</span><button class="btn primary" data-upd="go">Обновить</button><button class="ux" data-upd="x" aria-label="Позже">✕</button>`;
    if (!el) { el = document.createElement('div'); el.id = 'updbar'; el.setAttribute('role', 'status'); document.body.appendChild(el); el.addEventListener('click', (e) => { const b = e.target.closest('[data-upd]'); if (!b) return; if (b.dataset.upd === 'go') updGo(); else { el.remove(); updNew = null; } }); }
    if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; }
  }
  if (UPD_ON) {
    const was = updGet();
    if (was && was.to === BUILD) { updPut(null); setTimeout(() => toast(`Игра обновлена до версии ${esc(VERSION)}`, 2600), 900); }
    // адрес после обновления (…?v=сборка) убираем, чтобы не мешал
    if (/[?&]v=/.test(location.search) && history.replaceState) { try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* не страшно */ } }
    setTimeout(() => updCheck(true), 2500);
    setInterval(() => { if (document.visibilityState === 'visible') updCheck(); }, 600000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') updCheck(); });
    window.addEventListener('pageshow', (e) => { if (e.persisted) updCheck(true); });
    window.addEventListener('online', () => updCheck(true));
  }
  function boot(data) {
    try { bootInner(data); } catch (e) { bootError(e); }
  }
  function bootInner(data) {
    loadPrefs();
    Sfx.set(sound); Music.set(music); Sfx.vol(sfxVol / 100); Music.vol(musVol / 100);
    applyTheme();
    splash();
    if (data && data.save) { let fits = false; try { fits = saveFits(JSON.parse(data.save)); } catch (e) { /* испорчено */ } if (fits) { savedGame = { S: data.save, ME: data.ME, WATCH: data.WATCH }; resumeGame(savedGame); return; } saveGone = true; }
    render();
    if (saveGone) setTimeout(() => toast('Незаконченная партия была из прошлой версии игры — начните новую', 4200), 1200);
  }
  try { window.claude && window.claude.hot && window.claude.hot.snapshot && window.claude.hot.snapshot(() => ({ save: S && S.winner === null ? lastSafe : null, ME, WATCH })); } catch (e) { /* нет хука */ }
  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(boot); else boot((hot && hot.data) || {});
  window.__VD = { upd: { get build() { return BUILD; }, get on() { return UPD_ON; }, get found() { return updNew; }, get last() { return updLast; }, check: () => updCheck(true) }, anc: ANC, info: (d) => showInfo(d), infoParts: (d) => infoParts(d), get flips() { return [...flips.entries()].map(([k, t]) => k + '@' + Math.round(performance.now() - t)); }, get fresh() { return [...freshHand]; }, get S() { return S; }, get ME() { return ME; }, startGame, isMyTurn, ev: (t, d) => onEvent(t, d), redraw: () => schedule(), netSync: () => { if (hostNet()) netFlush(true); }, /* netSync — для тестов сети: отправить гостю стол после правки */ netRoom: () => (NETG ? NETG.room : null), get errs() { return errLog; }, get adjust() { return adjustReq; }, get waitNext() { return !!nextReq; }, get view() { return S ? 'game' : view; }, get sel() { return selCard; }, get drawer() { return drawer; }, get layout() { return L; }, get coins() { return myCoins().length; }, get step() { return stepReq ? stepReq.d.kind : null; }, ask: (q) => askHuman(S.players[ME], q),
    get cover() { return coverReq ? { p: coverReq.p, why: coverReq.why } : null; }, get busy() { return busy; },
    get net() { return NETG ? { rtt: NETG.rtt != null ? NETG.rtt : null, role: NETG.role, code: NETG.code, started: !!NETG.started, n: NETG.n, joined: !!NETG.joined, online: NETG.room ? NETG.room.online : 0, pending: !!NETG.pending, turn: NETG.role === 'host' ? (NETG.turn ? NETG.turn.pi : null) : (NETG.w ? NETG.w.turn : null), asks: NETG.role === 'host' ? NETG.asks.size : NETG.asksOpen.size, status: NETG.status || '' } : null; } };
})();
