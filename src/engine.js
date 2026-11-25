// ===================== ДВИЖОК «ПРЕТЕНДЕНТЫ» (v2) =====================
const Engine = (() => {
  const D = (typeof DATA !== 'undefined') ? DATA : require('./data.js');
  const R = D.RULES;
  const SYMS = D.SYMS;

  let HOOKS = {};
  function setHooks(h) { HOOKS = h || {}; }
  const CAP = (x) => (R.courtCapOff ? Infinity : x); // «макс.» на разовых картах двора
  // S.sim — партия-«прикидка» сильного бота: без событий, журнала и пауз
  function emit(S, type, data) { if (HOOKS.event && !S.sim) HOOKS.event(S, type, data); }
  function log(S, text, pi = null, kind = '') {
    if (S.sim) return;
    S.log.push({ r: S.round, t: text, p: pi, k: kind });
    if (S.log.length > 500) S.log.shift();
    emit(S, 'log', { text, pi, kind });
  }
  async function pause(S, what) { if (HOOKS.delay && !S.sim) await HOOKS.delay(S, what); }

  // ---------- случайность (воспроизводимая) ----------
  function rnd(S) {
    S.seed = (S.seed + 0x6D2B79F5) | 0;
    let t = S.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function shuffle(S, a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(S) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const d6 = (S) => 1 + Math.floor(rnd(S) * 6);
  const rollVals = (S, n) => n === 2 ? [d6(S), d6(S)] : [d6(S)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sum = (a) => a.reduce((s, x) => s + x, 0);

  // ---------- справочные функции ----------
  const ES = (e) => D.ESTATES[typeof e === 'string' ? e : e.id];
  const BD = (id) => D.BAN[id];
  const allBans = (p) => p.vassals.concat(p.lords, p.greats);
  const regCount = (p) => p.vassals.length + p.lords.length + p.greats.length;
  const TIERS = ['v', 'l', 'g'];
  const tierList = (p, t) => (t === 'v' ? p.vassals : t === 'l' ? p.lords : p.greats);
  const opps = (S, p) => S.players.filter(q => q !== p);
  // v2: эффекты «у соперника» не растут с числом игроков. Набег срабатывает в ход любого другого игрока (RULES.raidNeighbor — старый вариант: только того, кто ходит перед вами);
  // «взять у соперника» — у самого богатого из подходящих (при равенстве — ближайшего по ходу)
  const prevOf = (S, p) => S.players[(p.i - 1 + S.players.length) % S.players.length];
  function richest(S, p, pred) {
    let best = null; const N = S.players.length;
    for (let k = 1; k < N; k++) { const o = S.players[(p.i + k) % N]; if (pred && !pred(o)) continue; if (!best || o.gold > best.gold) best = o; }
    return best;
  }
  const rivals = (S, p, pred) => R.oneRival === false ? opps(S, p).filter(o => !pred || pred(o)) : [richest(S, p, pred)].filter(Boolean);
  const nm = (p) => `${D.HOUSES[p.house].sigil} ${p.name}`;
  // падежи названий Домов — из данных: «Змеи» → «Змей», «Олени (вы)» → «Оленей (вы)», «Змеям»
  const youOf = (p) => (/ \(вы\)$/.test(p.name) ? ' (вы)' : '');
  const nmG = (p) => `${D.HOUSES[p.house].sigil} ${D.HOUSES[p.house].gen}${youOf(p)}`;
  const nmD = (p) => `${D.HOUSES[p.house].sigil} ${D.HOUSES[p.house].dat}${youOf(p)}`;
  const short = (p) => D.HOUSES[p.house].short;
  const shortG = (p) => D.HOUSES[p.house].gen;
  // дописать итог к строке журнала, если после неё ничего не добавилось; иначе — отдельной строкой
  function logAppend(S, entry, tail, pi, kind) {
    if (S.sim || !entry) return;
    const last = S.log[S.log.length - 1];
    if (last === entry) { entry.t += tail; emit(S, 'log', { text: entry.t, pi, kind, edit: true }); }
    else log(S, `   итог: ${tail.replace(/^[:,]\s*/, '')}`, pi, kind);
  }

  // ---------- модули (части правил, которые можно выключить) ----------
  // S.mod нет (старые сохранения) — значит включено всё
  const on = (S, k) => !S.mod || S.mod[k] !== false;
  // сколько знамён яруса нужно для победы: вассалы — всегда, лорды и великие — если включён их модуль
  const needOf = (S, t) => (t === 'v' ? R.needV : t === 'l' ? (on(S, 'lords') ? R.needL : 0) : (on(S, 'great') ? R.needG : 0));
  const goal = (S) => needOf(S, 'v') + needOf(S, 'l') + needOf(S, 'g');
  // сколько знамён не хватает до цели; чудо «Небесный стяг» (ритуал «Святое знамя») закрывает одно — того уровня, которого нет
  const goalShort = (S, p) => TIERS.reduce((s, t) => s + Math.max(0, needOf(S, t) - tierList(p, t).length), 0);
  const meetsGoal = (S, p) => goalShort(S, p) <= (miracleOn(p, 'goalMinus') ? 1 : 0);
  const rowOf = (S, t) => (t === 'v' ? S.vRow : t === 'l' ? S.lRow : S.gRow);
  const deckOf = (S, t) => (t === 'v' ? S.vDeck : t === 'l' ? S.lDeck : S.gDeck);
  // карта нужна модулю: needs 'a|b' — достаточно любого из них; знамёна лордов и великих — только со своим модулем
  const cardOn = (S, kind, id) => {
    const k = D.NEEDS && D.NEEDS[kind] && D.NEEDS[kind][id];
    if (k && !k.split('|').some(x => x.split('&').every(y => on(S, y)))) return false;
    if (kind === 'ban') { const t = D.BAN[id] && D.BAN[id].tier; if (t === 'l' && !on(S, 'lords')) return false; if (t === 'g' && !on(S, 'great')) return false; }
    return true;
  };
  const houseOn = (S, h) => cardOn(S, 'house', h);
  // вера действует, если включён модуль и на столе нет проклятия «Проклятая реликвия»
  const faithsOf = (S, p) => (on(S, 'faith') ? (p.faiths || []) : []);
  // запрет на один ход (Куртизанка, Клевета): p.turn.curse — ключ → 1, снимается в конце хода
  const isCursed = (p, id) => !!(p.turn && p.turn.curse && p.turn.curse[id]);
  // проклятие (v10.14): лежит у игрока на столе и действует всегда, пока он его не снимет; key — поле bad у карты
  const cursed = (p, key) => !!(p && p.estates && p.estates.some(e => ES(e).bad === key));
  // грех (v10.15): лежит перед игроком (p.sins) и действует, пока его не снимет покаяние; key — поле sin у карты
  const sinned = (p, key) => !!(p && p.sins && p.sins.some(id => D.COURT[id] && D.COURT[id].sin === key));
  const sinCount = (p) => new Set((p.sins || []).map(id => D.COURT[id] && D.COURT[id].sin).filter(Boolean)).size;
  const wrathOn = (t) => (sinned(t, 'wrath') ? (R.wrathBonus || 3) : 0); // Гнев: нападения и шпионаж против грешника сильнее
  // ритуалы (v10.16): чудо действует, пока вы в его вере, на вас нет грехов и нет Проклятой реликвии
  const RIT = D.RITUALS || {};
  const miraclesOf = (p) => ((p && p.miracles) || []).filter(id => RIT[id] && (p.faiths || []).includes(RIT[id].faith));
  const miraclesOn = (p) => (!p || (p.sins || []).length || cursed(p, 'relic') ? [] : miraclesOf(p));
  const miracleOn = (p, key) => miraclesOn(p).some(id => (RIT[id].miracle.mods || {})[key]);
  const miracleName = (key) => { for (const id in RIT) if ((RIT[id].miracle.mods || {})[key]) return `чудо «${RIT[id].miracle.name}»`; return 'чудо'; };
  // сыгранные в этот ход карты — по порядку розыгрыша (карта уже лежит в сбросе, но для свиты и «за каждую сыгранную» считается здесь)
  const playedOf = (p) => (p.turn && p.turn.played) || p.inPlay || [];
  const faithActive = (S, p) => !cursed(p, 'relic');
  // ступень веры: I — всегда, II — при 🕯3, III — при 🕯5 (на столе и на ход)
  const faithCandles = (S, p) => prod(S, p).faith + ((p.temp && p.temp.faith) || 0);
  const faithStage = (S, p) => { const c = faithCandles(S, p); const up = allBans(p).reduce((t, id) => t + ((D.BAN[id].mods || {}).stageUp || 0), 0); return Math.min(3, 1 + (c >= (R.faithStage2 || 3) ? 1 : 0) + (c >= (R.faithStage3 || 5) ? 1 : 0) + up); };

  function mods(S, p) {
    const m = {};
    const add = (o) => { if (!o) return; for (const k in o) m[k] = (m[k] || 0) + o[k]; };
    add(D.HOUSES[p.house].mods);
    // отвлечённый лорд (Куртизанка) до конца своего хода не действует
    const off = p.distracted && p.distracted.id;
    for (const id of allBans(p)) if (id !== off) add(D.BAN[id].mods);
    for (const e of p.estates) if (!e.ruined) add(D.ESTATES[e.id].mods);
    if (faithsOf(S, p).length && faithActive(S, p)) { const st = faithStage(S, p); for (const f of p.faiths) { const F = D.FAITHS[f]; add(F.mods); if (st >= 2) add(F.mods2); if (st >= 3) add(F.mods3); } }
    for (const id of miraclesOn(p)) add(RIT[id].miracle.mods); // чудеса ритуалов
    // модуль «Придворные»: свойства карт, которые сидят при дворе
    if (on(S, 'seats')) for (const id of p.seats || []) add((D.COURT[id].seat || {}).mods);
    return m;
  }
  // откуда у игрока свойство (Лорд-протектор Эдуард → captureImmune): для подсказок «почему нападать бесполезно»
  function modSources(S, p, key) {
    const out = [];
    const add = (o, name) => { if (o && o[key]) out.push(name); };
    add(D.HOUSES[p.house].mods, D.HOUSES[p.house].name);
    const off = p.distracted && p.distracted.id;
    for (const id of allBans(p)) if (id !== off) add(D.BAN[id].mods, D.BAN[id].name);
    for (const e of p.estates) if (!e.ruined) add(D.ESTATES[e.id].mods, D.ESTATES[e.id].name);
    if (faithsOf(S, p).length && faithActive(S, p)) { const st = faithStage(S, p); for (const f of p.faiths) { const F = D.FAITHS[f]; add(F.mods, F.name); if (st >= 2) add(F.mods2, F.name); if (st >= 3) add(F.mods3, F.name); } }
    for (const id of miraclesOn(p)) add(RIT[id].miracle.mods, `Чудо «${RIT[id].miracle.name}»`);
    if (on(S, 'seats')) for (const id of p.seats || []) add((D.COURT[id].seat || {}).mods, D.COURT[id].name);
    return [...new Set(out)];
  }
  // сколько свойства даёт каждый источник: [{ name, v }] — для расшифровки дохода «2 · пара +2 · Хаген +1»
  function modParts(S, p, key) {
    const out = [];
    const add = (o, name, k) => { if (o && o[key]) out.push({ name, v: o[key], k }); };
    add(D.HOUSES[p.house].mods, D.HOUSES[p.house].short, 'house:' + p.house);
    const off = p.distracted && p.distracted.id;
    for (const id of allBans(p)) if (id !== off) add(D.BAN[id].mods, D.BAN[id].name, 'ban:' + id);
    for (const e of p.estates) if (!e.ruined) add(D.ESTATES[e.id].mods, D.ESTATES[e.id].name, 'est:' + e.uid);
    if (faithsOf(S, p).length && faithActive(S, p)) { const st = faithStage(S, p); for (const f of p.faiths) { const F = D.FAITHS[f], o = {}; for (const x of [F.mods, st >= 2 ? F.mods2 : null, st >= 3 ? F.mods3 : null]) for (const k in x || {}) o[k] = (o[k] || 0) + x[k]; add(o, F.name, 'faith:' + f); } }
    for (const id of miraclesOn(p)) add(RIT[id].miracle.mods, `Чудо «${RIT[id].miracle.name}»`, 'miracle:' + id);
    if (on(S, 'seats')) for (const id of p.seats || []) add((D.COURT[id].seat || {}).mods, D.COURT[id].name, 'seat:' + id);
    return out;
  }
  // союз провинции: каждые 3 владения одной провинции (любые, можно одинаковые; руины не в счёт) — один союз; бонусы копятся
  // u.S — сколько союзов Юга (0, 1, 2…), u.counts.S — сколько владений Юга
  function unionsOf(p, extra) {
    const c = { N: 0, S: 0, E: 0, W: 0 };
    for (const e of p.estates) { if (e.ruined) continue; const d = ES(e); if (d.p) c[d.p]++; }
    if (extra) c[extra]++;
    const hm = D.HOUSES[p.house].mods || {};
    const k = hm.unionSize || 3;
    if (hm.unionFast) {
      // Орлы: первые N союзов (всего, в любых провинциях) — из 2 владений, остальные — из unionLate (по умолчанию 3)
      const late = hm.unionLate || 3, P = ['N', 'S', 'E', 'W'];
      const g = (x, j) => j + Math.floor((x - 2 * j) / late);
      let best = null;
      const go = (i, left, acc) => {
        if (i === P.length) { const t = P.reduce((a, q) => a + acc[q], 0); const used = P.reduce((a, q) => a + acc['j' + q], 0); if (!best || t > best.t || (t === best.t && used < best.used)) best = { t, used, ...acc }; return; }
        const q = P[i];
        for (let j = 0; j <= left && 2 * j <= c[q]; j++) go(i + 1, left - j, { ...acc, [q]: g(c[q], j), ['j' + q]: j });
      };
      go(0, hm.unionFast, {});
      return { N: best.N, S: best.S, E: best.E, W: best.W, counts: c, size: 2, late, fast: hm.unionFast, fastLeft: hm.unionFast - best.used };
    }
    const f = (x) => Math.floor(x / k);
    return { N: f(c.N), S: f(c.S), E: f(c.E), W: f(c.W), counts: c, size: k };
  }
  const PROV_EST = {}; for (const id in D.ESTATES) { const pv = D.ESTATES[id].p; if (pv && !PROV_EST[pv] && !D.ESTATES[id].house) PROV_EST[pv] = id; }
  // сколько ещё владений провинции q нужно до следующего союза (Infinity — больше союзов в ней не будет)
  function unionNeed(p, q) {
    const base = unionsOf(p); const tot = (u) => u.N + u.S + u.E + u.W; const t0 = tot(base);
    const fake = { house: p.house, estates: p.estates.slice() };
    for (let d = 1; d <= 6; d++) { fake.estates.push({ id: PROV_EST[q] }); if (tot(unionsOf(fake)) > t0) return d; }
    return Infinity;
  }
  const unionCount = (p) => { const u = unionsOf(p); return u.N + u.S + u.E + u.W; };
  // новый союз: сразу +3🪙 (и способности), а первый союз этой провинции за столом — ещё +2🪙.
  // Награда один раз за союз: потерянный и собранный снова не считается
  function unionBounty(S, p) {
    if (!on(S, 'unions')) return;
    const u = unionsOf(p), m = mods(S, p);
    p.useen = p.useen || {};
    let g = 0; const firsts = [];
    for (const q of ['N', 'S', 'E', 'W']) {
      const seen = p.useen[q] || 0;
      if (u[q] <= seen) continue;
      g += (u[q] - seen) * ((R.unionGold || 0) + (m.unionBounty || 0));
      p.useen[q] = u[q];
      S.unionFirst = S.unionFirst || {};
      if (!S.unionFirst[q]) { S.unionFirst[q] = p.i + 1; g += R.unionFirst || 0; firsts.push(D.PROV[q].name); }
    }
    if (g) { p.gold += g; log(S, `${nm(p)}: новый союз провинций — +${g}🪙${firsts.length ? ` (первый союз ${firsts.join(', ')} за столом)` : ''}`, p.i, 'gold'); emit(S, 'union', { p: p.i, gold: g }); }
  }
  const emptySyms = () => ({ trade: 0, sci: 0, war: 0, int: 0, faith: 0 });
  // значки игрока; src — если передан, туда пишется, откуда каждый значок (для подсказки «откуда ресурс»)
  function prodCalc(S, p, src) {
    const r = emptySyms();
    const add = (s, n, what) => { if (!n) return; r[s] += n; if (src) src.push(Object.assign({ s, n }, what)); };
    const hd = D.HOUSES[p.house].dir; if (hd) add(hd, 1, { k: 'house', id: p.house });          // родное направление Дома
    for (const e of p.estates) { if (e.ruined) continue; const d = ES(e); if (d.sym) add(d.sym, 1, { k: 'estate', id: e.id }); }
    for (const id of allBans(p)) { const b = D.BAN[id]; add(b.dir, 1, { k: 'ban', id }); for (const k in b.prod) add(k, b.prod[k], { k: 'ban', id }); }
    if (on(S, 'seats')) for (const id of p.seats || []) { const pr = (D.COURT[id].seat || {}).prod; for (const k in pr || {}) add(k, pr[k], { k: 'seat', id }); }
    // Бьорн Секира: каждый ваш Набег даёт ⚔️ (свойства знамён читаем прямо — mods() сам зависит от prod через ступень веры)
    for (const id of allBans(p)) { const rs = (D.BAN[id].mods || {}).raidSym || 0; if (rs) add('war', rs * p.estates.filter(e => !e.ruined && ES(e).t === 'raid').length, { k: 'raidSym', id }); }
    // союз даёт 2 значка своей провинции: Север ⚔️, Юг ⚖️, Восток 📜, Запад 🔗
    if (on(S, 'unions')) { const u = unionsOf(p); for (const q of ['N', 'S', 'E', 'W']) add(D.PROV[q].sym, u[q] * (R.unionSyms || 1), { k: 'union', id: q }); }
    // чудо «Святая земля» (ритуал «Великая жатва»): каждая ваша Земля — ещё и 🕯
    if (on(S, 'faith') && miracleOn(p, 'landFaith')) add('faith', p.estates.filter(e => !e.ruined && ES(e).t === 'land').length, { k: 'miracle', id: 'grain_a' });
    // ступени веры дают и значки (Пламя Предков II: +2⚔️); ступень считаем по свечам без этих значков
    if (on(S, 'faith') && (p.faiths || []).length && faithActive(S, p)) {
      const c = r.faith + ((p.temp && p.temp.faith) || 0);
      const up = allBans(p).reduce((t, id) => t + ((D.BAN[id].mods || {}).stageUp || 0), 0);
      const st = Math.min(3, 1 + (c >= (R.faithStage2 || 3) ? 1 : 0) + (c >= (R.faithStage3 || 5) ? 1 : 0) + up);
      for (const f of p.faiths) { const F = D.FAITHS[f]; if (!F) continue; for (const [k, pr] of [[2, F.prod2], [3, F.prod3]]) if (st >= k && pr) for (const x in pr) add(x, pr[x], { k: 'faith', id: f, st: k }); }
    }
    return r;
  }
  const prod = (S, p) => prodCalc(S, p, null);
  const prodSources = (S, p) => { const src = []; prodCalc(S, p, src); return src; };
  const sym = (S, p, s) => prod(S, p)[s] + (p.temp[s] || 0);
  function walls(S, p) {
    let w = R.baseWalls || 0;
    for (const e of p.estates) if (!e.ruined) w += ES(e).walls || 0;
    w += mods(S, p).walls || 0;
    return w;
  }
  const handSize = (S, p) => R.hand + (mods(S, p).hand || 0) + (R.sciStep ? Math.floor(prod(S, p).sci / R.sciStep) : 0) - (sinned(p, 'gluttony') ? 1 : 0); // 📜 Знания; грех Чревоугодие — на 1 меньше
  const plotSlots = (S, p) => (on(S, 'plots') ? R.plotSlots + (mods(S, p).plotSlots || 0) : 0);
  // мест при дворе: 2 + 1 за каждого лорда + свойства (Изольда, Леонора, Камергер)
  const seatMax = (S, p) => (on(S, 'seats') ? (R.courtSeats || 2) + (p ? p.lords.length + (mods(S, p).seatSlots || 0) : 0) : 0);
  // предел «Ярмарки» Оленей: напечатанная цена карты двора, которую можно купить без траты действия (Сенешаль поднимает предел)
  const fairLimit = (S, p) => { const m = mods(S, p); return m.freeCheap ? m.freeCheap + (m.fairPlus || 0) : 0; };
  const canSeat = (S, id) => !!(on(S, 'seats') && D.COURT[id] && D.COURT[id].seat);

  function freshTurn() {
    return { rolled: false, played: [], roles: {}, buysUsed: 0, buys: 0, discount: 0, regDiscount: 0, fairCourt: 0, built: false, rerolls: 0, extraTurn: false, retired: false, fetched: false, curse: {} };
  }

  // ---------- создание партии ----------
  function newGame(opts) {
    const S = {
      v: 2, seed: opts.seed != null ? opts.seed : (Math.random() * 2 ** 31) | 0, gid: Math.random().toString(36).slice(2, 10), uid: 1, round: 1, cur: 0, first: 0,
      log: [], winner: null, lastRoll: null, players: [], turnNo: 0, extraTaken: false, unionFirst: {}, destroyed: [],
    };
    // opts.modules: массив включённых модулей или объект {модуль: true/false}; нет — включено всё
    const om = opts.modules;
    S.mod = Object.fromEntries(D.MODULE_KEYS.map(k => [k, !om ? true : Array.isArray(om) ? om.includes(k) : om[k] !== false]));
    opts.players.forEach((po, i) => {
      const H = D.HOUSES[po.house];
      const p = {
        i, house: po.house, name: po.name || H.short, isBot: !!po.isBot, persona: po.persona || 'base', skill: po.skill || 'normal', gold: R.startGold + (H.gold || 0),
        estates: [], vassals: [], lords: [], greats: [], heir: null, faiths: [], deck: [], hand: [], discard: [], inPlay: [], plots: [], seats: [], trashed: [], sins: [], ritual: null, miracles: [],
        temp: emptySyms(), turn: freshTurn(), useen: {},
        stats: { stolen: 0, sieges: 0, captured: 0, lost: 0, rollInc: 0, raidInc: 0, cardGold: 0, startInc: 0, siegeWins: 0, upkeep: 0, released: 0, retired: 0, destroyed: 0 },
      };
      H.estates.forEach(id => p.estates.push({ uid: S.uid++, id }));
      { const u = unionsOf(p); p.useen = { N: u.N, S: u.S, E: u.E, W: u.W }; } // союз, собранный уже на старте, награды не даёт
      if (H.heir && cardOn(S, 'ban', H.heir)) p.heir = H.heir;
      // модуль «Придворные»: второй фамильный придворный Дома лежит в стартовой колоде
      const fam2 = on(S, 'seats') && H.courtier2 && cardOn(S, 'court', H.courtier2) ? [H.courtier2] : [];
      p.deck = shuffle(S, [...Array(R.startTax).fill('tax'), ...H.deck, ...fam2]);
      if (on(S, 'seats') && H.courtier && cardOn(S, 'court', H.courtier)) p.seats.push(H.courtier);
      S.players.push(p);
    });
    S.estateDeck = [];
    for (const id in D.ESTATES) { const d = D.ESTATES[id]; if (!d.basic && !d.house && d.t !== 'hold' && cardOn(S, 'estate', id)) for (let k = 0; k < (d.copies || 3); k++) S.estateDeck.push(id); }
    shuffle(S, S.estateDeck);
    // веры партии: по одной случайной каждого направления (⚖️ 📜 ⚔️ 🔗) — всего 4
    S.faithRow = [];
    if (on(S, 'faith')) {
      const groups = {};
      for (const f in D.FAITHS) if (cardOn(S, 'faith', f)) (groups[D.FAITHS[f].dir || 'faith'] = groups[D.FAITHS[f].dir || 'faith'] || []).push(f);
      const gs = shuffle(S, Object.keys(groups)).slice(0, R.faithInGame || 4);
      for (const g of gs) S.faithRow.push(shuffle(S, groups[g].slice())[0]);
    }
    S.courtDeck = [];
    S.faithPool = {}; for (const f of S.faithRow) S.faithPool[f] = (D.FAITHS[f].cards || []).filter(id => D.COURT[id]);
    for (const id in D.COURT) { const c = D.COURT[id]; if (c.faith) continue; /* карты вер — у веры, не на рынке */ if (!c.start && !c.sig && !c.rule && cardOn(S, 'court', id)) for (let k = 0; k < (c.copies || 2); k++) S.courtDeck.push(id); }
    shuffle(S, S.courtDeck);
    // твердыни: копий каждой — по числу игроков; колода твердынь и открытый ряд из R.holdRow (купили — открывается следующая)
    S.holdDeck = shuffle(S, Object.keys(D.ESTATES).filter(id => D.ESTATES[id].t === 'hold' && cardOn(S, 'estate', id)).flatMap(id => Array(Math.min(D.ESTATES[id].copies || 1, S.players.length)).fill(id)));
    S.holdRow = [];
    S.estateRow = []; S.courtRow = [];
    // знамёна: общая колода вассалов (ряд 4), колоды лордов и великих лордов (ряды по 3); Наследники — у планшетов
    const bans = (t) => shuffle(S, Object.keys(D.BAN).filter(id => D.BAN[id].tier === t && !D.BAN[id].heir && cardOn(S, 'ban', id)));
    S.vDeck = bans('v'); S.lDeck = on(S, 'lords') ? bans('l') : []; S.gDeck = on(S, 'great') ? bans('g') : [];
    S.vRow = []; S.lRow = []; S.gRow = [];
    refill(S);
    S.players.forEach(p => drawCards(S, p, handSize(S, p)));
    S.first = opts.first != null ? opts.first : Math.floor(rnd(S) * S.players.length);
    S.cur = S.first;
    S.players.forEach(p => { if (p.i !== S.first) p.gold += (R.seatGold || 0); });
    log(S, `Партия началась. Цель — ${goalText(S)}.`, null, 'info');
    log(S, `Первый ход: ${nm(S.players[S.cur])}`, null, 'info');
    return S;
  }
  const goalText = (S) => {
    const parts = [`${needOf(S, 'v')} вассалов`];
    if (needOf(S, 'l')) parts.push(`${needOf(S, 'l')} лорда`);
    if (needOf(S, 'g')) parts.push(`${needOf(S, 'g')} великих лорда`);
    return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' и ' + parts[parts.length - 1] : parts[0];
  };
  function refill(S) {
    while (S.estateRow.length < R.estateRow && S.estateDeck.length) S.estateRow.push(S.estateDeck.pop());
    while (S.courtRow.length < R.courtRow && S.courtDeck.length) S.courtRow.push(S.courtDeck.pop());
    if (S.holdRow && S.holdDeck) while (S.holdRow.length < (R.holdRow || 3) && S.holdDeck.length) S.holdRow.push(S.holdDeck.pop());
    for (const [row, deck, n] of [[S.vRow, S.vDeck, R.vRow], [S.lRow, S.lDeck, R.lRow], [S.gRow, S.gDeck, R.gRow]]) while (row && deck && row.length < n && deck.length) row.push(deck.pop());
  }
  // беды из игры не уходят: замешать обратно в колоду рынка (владений или двора)
  function backToDeck(S, kind, id) {
    const deck = kind === 'estate' ? S.estateDeck : S.courtDeck;
    if (!deck) return;
    deck.push(id); shuffle(S, deck);
  }
  // сброс целиком: прошлые ходы + сыгранные в этот ход (они лежат сверху)
  const discardOf = (p) => [...p.discard, ...(p.inPlay || [])];
  function takeFromDiscard(p, id) {
    const k = (p.inPlay || []).lastIndexOf(id);
    if (k >= 0) { p.inPlay.splice(k, 1); return true; }
    const j = p.discard.indexOf(id);
    if (j >= 0) { p.discard.splice(j, 1); return true; }
    return false;
  }
  function drawCards(S, p, n) {
    let drawn = 0;
    for (let i = 0; i < n; i++) {
      if (!p.deck.length) {
        if (!p.discard.length) break;
        p.deck = shuffle(S, p.discard); p.discard = [];
      }
      p.hand.push(p.deck.pop()); drawn++;
    }
    return drawn;
  }

  // ---------- общение с игроком / ботом ----------
  async function ask(S, p, q) {
    if (p.isBot || !HOOKS.ask) return Bot.decide(S, p, q);
    return await HOOKS.ask(S, p, q);
  }

  // ---------- содержание великих лордов: первым делом в начале хода ----------
  // не хватает золота — игрок выбирает, кого оставить; остальные уходят под низ колоды великих лордов
  // содержание: лорды и великие лорды — в начале хода
  const upkeepList = (p) => [...p.lords, ...p.greats].filter(id => (D.BAN[id].upkeep || 0) > 0);
  // чудо «Верность до гроба» (ритуал «Посвящение»): содержание каждого лорда и великого лорда — 1🪙
  const upkeepCost = (p, id) => ((D.BAN[id].upkeep || 0) > 0 && miracleOn(p, 'upkeepOne') ? 1 : (D.BAN[id].upkeep || 0));
  const upkeepOf = (p) => upkeepList(p).reduce((s, id) => s + upkeepCost(p, id), 0);
  async function payUpkeep(S, p) {
    const extra = p.upkeepExtra || 0; p.upkeepExtra = 0;
    const list = upkeepList(p);
    if (!list.length) return;
    const need = upkeepOf(p) + extra;
    if (need <= 0) return;
    if (p.gold >= need) {
      p.gold -= need; p.stats.upkeep += need;
      log(S, `${nm(p)} платят содержание знамён: −${need}🪙${extra ? ` (из них ${extra}🪙 — смута)` : ''}`, p.i, 'upkeep');
      emit(S, 'upkeep', { p: p.i, paid: need, released: [] });
      return;
    }
    let keep = await ask(S, p, { type: 'upkeep', options: list.slice(), gold: p.gold, extra, costs: Object.fromEntries(list.map(id => [id, upkeepCost(p, id)])) });
    if (!Array.isArray(keep)) keep = [];
    keep = keep.filter(id => list.includes(id));
    // оставить можно только тех, на кого хватает золота
    while (keep.length && keep.reduce((s, id) => s + upkeepCost(p, id), 0) + extra > p.gold) keep.pop();
    const pay = keep.length ? keep.reduce((s, id) => s + upkeepCost(p, id), 0) + extra : 0;
    const gone = list.filter(id => !keep.includes(id));
    p.greats = p.greats.filter(id => !gone.includes(id)); p.lords = p.lords.filter(id => !gone.includes(id));
    for (const id of gone) { if (!D.BAN[id].heir) (D.BAN[id].tier === 'g' ? S.gDeck : S.lDeck).unshift(id); p.stats.released++; log(S, `${nm(p)}: не хватило золота на содержание — «${D.regName(D.BAN[id])}» уходит под низ колоды великих лордов`, p.i, 'upkeep'); }
    p.gold -= pay; p.stats.upkeep += pay;
    if (pay) log(S, `${nm(p)} платят содержание: −${pay}🪙`, p.i, 'upkeep');
    refill(S);
    emit(S, 'upkeep', { p: p.i, paid: pay, released: gone });
    await trimFaiths(S, p);
    await trimSeats(S, p); // ушёл лорд — мест при дворе меньше
  }

  // ---------- начало хода ----------
  // доход в начале хода (без дани и Зависти): сколько и откуда — для хода и для подсказки в интерфейсе
  function dawnGold(S, p, m) {
    let g = 0; const src = [];
    const est = (t) => p.estates.filter(e => !e.ruined && ES(e).t === t).length;
    if (m.startGold) { g += m.startGold; src.push(`постоянный доход +${m.startGold}`); }
    { const v = R.faithStep ? Math.floor(prod(S, p).faith / R.faithStep) : 0; if (v) { g += v; src.push(`подаяния за 🕯 +${v}`); } } // 🕯 Подаяния
    if (m.interest) { const v = Math.min(m.interest, Math.floor(p.gold / (R.interestStep || 10))); if (v) { g += v; src.push(`проценты +${v}`); } }
    if (m.savings) { const v = m.savings * Math.floor(p.gold / (R.savingsStep || 10)); if (v) { g += v; src.push(`сбережения +${v}`); } }
    const pr = prod(S, p);
    for (const s of SYMS) if (m['symIncome_' + s]) { const v = m['symIncome_' + s] * Math.min(R.symIncomeMax || 4, Math.floor(pr[s] / 2)); if (v) { g += v; src.push(`за ${D.SYM[s]} +${v}`); } }
    if (m.landIncome) { const v = Math.floor(est('land') / 2) * m.landIncome; if (v) { g += v; src.push(`за Земли +${v}`); } }
    if (m.plotIncome && p.plots.length) { const v = p.plots.length * m.plotIncome; g += v; src.push(`за замыслы +${v}`); }
    if (m.craftIncome) { const v = Math.floor(est('craft') / 2) * m.craftIncome; if (v) { g += v; src.push(`за Ремёсла +${v}`); } }
    if (m.redIncome) { const v = m.redIncome * Math.min(R.redIncomeMax || 4, est('raid')); if (v) { g += v; src.push(`за набеги +${v}`); } }
    if (m.seatIncome && on(S, 'seats') && (p.seats || []).length > 1) { const v = (p.seats.length - 1) * m.seatIncome; g += v; src.push(`за придворных +${v}`); } // Церемониймейстер: за каждого другого придворного
    if (m.banIncome) { const v = Math.floor(regCount(p) / 2) * m.banIncome; if (v) { g += v; src.push(`за знамёна +${v}`); } } // Братство Клинка III
    if (m.lordIncome && (p.lords.length + p.greats.length)) { const v = (p.lords.length + p.greats.length) * m.lordIncome; g += v; src.push(`за лордов +${v}`); }
    if (m.provIncome) { const v = new Set(p.estates.filter(e => !e.ruined).map(e => ES(e).p).filter(Boolean)).size * m.provIncome; if (v) { g += v; src.push(`за провинции +${v}`); } } // Отец Бенедикт: за каждую провинцию
    if (m.candleGold) { const v = prod(S, p).faith * m.candleGold; if (v) { g += v; src.push(`за 🕯 +${v}`); } } // Мать Ирмина
    if (m.estateGold) { const v = Math.floor(p.estates.filter(e => !e.ruined && !ES(e).bad).length / 2) * m.estateGold; if (v) { g += v; src.push(`казначейство +${v}`); } } // Дож Лоренцо
    if (m.faithGold && faithsOf(S, p).length) { g += m.faithGold; src.push(`вера +${m.faithGold}`); }
    const uc = unionCount(p);
    if (m.unionGold && uc && on(S, 'unions')) { g += m.unionGold * uc; src.push(`за союзы +${m.unionGold * uc}`); }
    // «Плата»: +N🪙 из банка за каждого соперника, у кого значков этого вида меньше
    for (const s of SYMS) if (m['symFee_' + s]) { const v = R.oneRival === false ? m['symFee_' + s] * opps(S, p).filter(o => prod(S, o)[s] < pr[s]).length : (opps(S, p).every(o => prod(S, o)[s] < pr[s]) ? m['symFee_' + s] : 0); if (v) { g += v; src.push(`${D.SYM[s]} больше, чем у соперников, +${v}`); } }
    return { g, src };
  }
  // доход начала хода по источникам: [{ k: 'house:lion' | 'ban:id' | 'seat:id' | 'faith:id' | 'est:uid' | 'rule:faith', name, v, why }]
  // сумма частей = dawnGold(S, p, mods).g; если свойства как-то сцепились и сумма не сошлась — null (тогда по строкам src)
  function dawnParts(S, p) {
    const total = dawnGold(S, p, mods(S, p)).g;
    if (!total) return [];
    const base = dawnGold(S, p, {});
    const out = [];
    if (base.g) out.push({ k: 'rule:faith', name: 'Подаяния', v: base.g, why: `🕯${prod(S, p).faith}: каждые ${R.faithStep}🕯 — +1🪙` });
    const cards = [];
    cards.push(['house:' + p.house, D.HOUSES[p.house].short, D.HOUSES[p.house].mods]);
    const off = p.distracted && p.distracted.id;
    for (const id of allBans(p)) if (id !== off) cards.push(['ban:' + id, D.BAN[id].name, D.BAN[id].mods]);
    for (const e of p.estates) if (!e.ruined && ES(e).mods) cards.push(['est:' + e.uid, ES(e).name, ES(e).mods]);
    if (faithsOf(S, p).length && faithActive(S, p)) { const st = faithStage(S, p); for (const f of p.faiths) { const F = D.FAITHS[f], o = {}; for (const x of [F.mods, st >= 2 ? F.mods2 : null, st >= 3 ? F.mods3 : null]) for (const k in x || {}) o[k] = (o[k] || 0) + x[k]; cards.push(['faith:' + f, F.name, o]); } }
    if (on(S, 'seats')) for (const id of p.seats || []) cards.push(['seat:' + id, D.COURT[id].name, (D.COURT[id].seat || {}).mods]);
    for (const [k, name, m] of cards) {
      if (!m) continue;
      const r = dawnGold(S, p, m), v = r.g - base.g;
      if (v > 0) out.push({ k, name, v, why: r.src.filter(x => !base.src.includes(x)).join(', ') });
    }
    return out.reduce((a, x) => a + x.v, 0) === total ? out : null;
  }
  async function startOfTurn(S, p) {
    p.turn = freshTurn();
    if (p.lockNext) { p.turn.curse.lock = 1; p.lockNext = false; log(S, `${nm(p)}: Куртизанка — в этот ход нанимать знамёна нельзя`, p.i, 'envy'); }
    await payUpkeep(S, p);
    // обет «Десятина» (Собор Единого): 1🪙 — в банк
    { const tf = faithBan(S, p, 'tithe'); if (tf) { const v = Math.min(1, p.gold); if (v) { p.gold -= v; log(S, `${nm(p)}: десятина «${D.FAITHS[tf].name}» — −${v}🪙`, p.i, 'faith'); } } }
    // обет «Щедрость» (Праздник Урожая): 1🪙 самому бедному сопернику
    { const gf = faithBan(S, p, 'gift'); if (gf && p.gold > 0) { let poor = null; for (const o of opps(S, p)) if (!poor || o.gold < poor.gold) poor = o; const v = Math.min(p.gold, D.FAITHS[gf].oathN || 1); if (poor && v) { p.gold -= v; poor.gold += v; log(S, `${nm(p)}: щедрость «${D.FAITHS[gf].name}» — ${v}🪙 ${nmD(poor)}`, p.i, 'faith'); } } }
    // грехи (v10.15): платежи — по золоту до дохода начала хода; не хватает — сколько есть
    if (sinned(p, 'pride')) { const v = Math.min(regCount(p), p.gold); if (v) { p.gold -= v; log(S, `${nm(p)}: Гордыня — −${v}🪙 за знамёна`, p.i, 'sin'); } }
    if (sinned(p, 'greed')) { const v = Math.floor(p.gold / 5); if (v) { p.gold -= v; log(S, `${nm(p)}: Алчность — −${v}🪙 в банк`, p.i, 'sin'); } }
    if (sinned(p, 'lust') && on(S, 'seats') && (p.seats || []).length) {
      const r = d6(S);
      if (r <= 2) {
        let k = await ask(S, p, { type: 'seatDrop', options: p.seats.slice(), max: p.seats.length - 1, lust: true });
        if (k == null || k < 0 || k >= p.seats.length) k = 0;
        const [out] = p.seats.splice(k, 1); p.discard.push(out);
        log(S, `${nm(p)}: Похоть — на кубике ${r}, «${D.COURT[out].name}» уходит в сброс`, p.i, 'sin');
        emit(S, 'unseat', { a: null, t: p.i, id: out, lust: true });
      } else log(S, `${nm(p)}: Похоть — на кубике ${r}, придворные остаются`, p.i, 'quiet');
    }
    // Клевета: в этот ход карты двора покупать нельзя
    if (p.slanderNext) { p.turn.curse.slander = 1; p.slanderNext = false; log(S, `${nm(p)}: Клевета — в этот ход карты двора покупать нельзя`, p.i, 'envy'); }
    if (Object.keys(p.turn.curse).length) emit(S, 'curse', { p: p.i, ids: Object.keys(p.turn.curse) });
    const m = mods(S, p);
    const counts = S.players.map(regCount);
    const max = Math.max(...counts);
    const leaders = counts.filter(c => c === max).length;
    const bal = on(S, 'balance');
    let envyPaid = 0, supportGot = 0;
    const tribute = [];
    if (bal && max > 0 && counts[p.i] === max && leaders === 1 && !m.envyImmune) {
      const second = Math.max(...counts.filter((c, i) => i !== p.i));
      const tax = max - second; // по 1🪙 за каждое знамя отрыва от второго
      const paid = Math.min(tax, p.gold);
      if (paid > 0) { p.gold -= paid; envyPaid = paid; log(S, `${nm(p)} заплатили Зависть: −${paid}🪙 (единственный лидер по знамёнам)`, p.i, 'envy'); }
    }
    if ((bal || R.supportBase) && max - counts[p.i] >= R.supportGap) {
      const sv = R.supportPer ? R.supportGold * (max - counts[p.i]) : R.supportGold;
      p.gold += sv; supportGot = sv;
      log(S, `${nm(p)} получили Народную поддержку: +${sv}🪙 (отстают от лидера на ${D.banners(max - counts[p.i])})`, p.i, 'support');
    }
    // догоняющий наём: если в начале круга у лидера R.catchupFrom+ знамён, кто отстаёт от него (на R.catchupGap и больше), в этом круге может нанять ещё одного вассала (R.catchupTier)
    const cuT = R.catchupTier || 'v'; // некого нанимать (ряд пуст) или свои вассалы уже набраны — догоняющего найма нет
    if (S.catchup && S.catchup[p.i] && !sinned(p, 'envy') && !(R.catchupOnce && p.catchupSpent >= R.catchupOnce) && tierList(p, cuT).length < needOf(S, cuT) && rowOf(S, cuT).length) {
      if (R.catchupHireOnly) p.turn.catchupHire = 1; else p.turn.buys += 1;
      p.turn.catchup = true;
      { const ci = S.catchupInfo;
        log(S, `🫱 Догоняющий наём: у ${ci ? `${ci.lead.map(i => nmG(S.players[i])).join(' и ')} ${D.banners(ci.mx)}` : 'лидера больше знамён'}, у ${nmG(p)} ${D.banners(regCount(p))} — в этот ход ${nm(p)} могут нанять ещё одного вассала без траты действия`, p.i, 'catchup'); }
    }
    const { g, src } = dawnGold(S, p, m);
    const dparts = g > 0 ? dawnParts(S, p) : []; // до зачисления: проценты и сбережения считаются от золота на руках
    const pr = prod(S, p);
    if (g > 0) { p.gold += g; p.stats.startInc += g; log(S, `${nm(p)} получили в начале хода +${g}🪙 (${src.join(', ')})`, p.i, 'gold'); }
    const take = (o, v, why) => { v = Math.min(v, o.gold); if (v <= 0) return; o.gold -= v; p.gold += v; tribute.push({ i: o.i, v, why: why.split(' ')[0] }); log(S, `${why}: ${nm(o)} отдали ${v}🪙 ${nmD(p)}`, p.i, 'steal'); };
    if (m.tithe) for (const o of rivals(S, p, o => o.gold > 0)) take(o, m.tithe, 'Десятина');
    if (m.tribute) for (const o of rivals(S, p, o => o.gold > 0 && prod(S, o).war < pr.war)) take(o, m.tribute, 'Дань — у них ⚔️ меньше');
    if (on(S, 'faith')) {
      const mine = faithsOf(S, p);
      const same = (o) => mine.some(f => faithsOf(S, o).includes(f));
      if (m.infidelTithe) for (const o of rivals(S, p, o => o.gold > 0 && !same(o))) take(o, m.infidelTithe, 'Обет');
      if (m.faithTithe) { for (const o of rivals(S, p, o => o.gold > 0 && !same(o))) take(o, m.faithTithe, 'Святыни'); } if (m.faithTithe) for (const o of opps(S, p)) { if (!same(o)) continue; else if (mine.length) { o.gold += m.faithTithe; log(S, `Святыни: ${nm(o)} получили +${m.faithTithe}🪙 — единоверцы ${nmG(p)}`, o.i, 'gold'); } }
    }
    emit(S, 'dawn', { p: p.i, gain: g, src, parts: dparts, envy: envyPaid, support: supportGot, tribute });
    if (HOOKS.collect && !S.sim && (g > 0 || envyPaid || supportGot || tribute.length)) await HOOKS.collect(S, { kind: 'dawn', p: p.i, gain: g, src });
    if (m.warCry) p.temp.war += m.warCry;
    // Канцлер Мирон: бесплатный шпионаж в начале хода
    if (m.freeSpy && on(S, 'spy')) { log(S, `${nm(p)}: тайная канцелярия выходит на дело`, p.i, 'info'); await doSpy(S, p, 1, 'steal', 2, {}); if (S.winner !== null) return; }
    const timed = p.plots.filter(x => x.kind === 'timed');
    for (const pl of timed) {
      p.plots.splice(p.plots.indexOf(pl), 1);
      await resolvePlot(S, p, pl, null);
      if (S.winner !== null) return;
    }
    await dreamPeek(S, p, m);
    // чудеса начала хода: Земли приносят доход; карта из сброса соперника на ход; кубики соперника на его следующий ход
    if (m.landDawn && S.winner === null) landDawn(S, p, m);
    if (m.borrow && S.winner === null) await borrowCard(S, p);
    if (m.dictateDice && S.winner === null) await dictateDice(S, p);
    // покаяние: очередной шаг — последним в начале хода, когда доход уже получен
    if (p.penance && S.winner === null) await penanceStep(S, p);
    ritualTick(S, p);
    emit(S, 'change');
  }
  // Толкователь снов при дворе — вещий сон: посмотреть верхние карты своей колоды, каждую оставить сверху или положить под низ
  async function dreamPeek(S, p, m) {
    const k = Math.min(m.dreamPeek || 0, p.deck.length);
    if (k <= 0) return;
    const top = p.deck.slice(-k).reverse(); // [0] — самая верхняя
    const ch = await ask(S, p, { type: 'dream', cards: top.slice() });
    const down = new Set(Array.isArray(ch) ? ch.filter(i => i >= 0 && i < k) : []);
    p.deck.splice(p.deck.length - k, k);
    const keep = top.filter((_, i) => !down.has(i)), bottom = top.filter((_, i) => down.has(i));
    for (let i = keep.length - 1; i >= 0; i--) p.deck.push(keep[i]);
    p.deck.unshift(...bottom);
    log(S, `${nm(p)}: вещий сон — ${bottom.length ? `${D.cards(bottom.length)} под низ колоды` : k > 1 ? 'обе карты остаются сверху' : 'карта остаётся сверху'}${keep.length && bottom.length ? `, ${D.cards(keep.length)} сверху` : ''}`, p.i, 'info');
  }

  async function resolvePlot(S, p, pl, active) {
    const c = D.COURT[pl.id];
    const m = mods(S, p);
    const g0 = p.gold;
    log(S, `${pl.kind === 'dice' ? '🎲' : '⏳'} ${nm(p)}: сработал замысел «${c.name}»`, p.i, 'plot');
    const entry = S.log[S.log.length - 1];
    await applyFx(S, p, c.pfx, { active, plot: true });
    const bonus = (m.plotGold || 0) + (pl.kind === 'timed' ? (m.timedPlotBonus || 0) : 0);
    if (bonus) p.gold += bonus;
    const dg = p.gold - g0;
    if (dg > 0) logAppend(S, entry, `: +${dg}🪙`, p.i, 'plot');
    p.discard.push(pl.id);
    emit(S, 'plot', { p: p.i, id: pl.id, kind: pl.kind, gold: dg, active: active ? active.i : null });
  }

  // ---------- эффекты карт ----------
  async function applyFx(S, p, fx, ctx = {}) {
    for (const op of fx || []) {
      const [k, a, b, c] = op;
      const est = (t) => p.estates.filter(e => !e.ruined && ES(e).t === t).length;
      switch (k) {
        case 'gold': p.gold += a; break;
        case 'goldIfFaith': if (faithsOf(S, p).length) p.gold += a; break;
        case 'draw': drawCards(S, p, a); break;
        case 'temp': p.temp[a] += b; break;
        case 'goldPerCraft': p.gold += Math.min(CAP(b), est('craft') * a); break;
        case 'goldPerRaid': p.gold += Math.min(CAP(b), est('raid') * a); break;
        case 'goldPerSym': { const n = sym(S, p, a); p.gold += Math.min(CAP(c), n * b); break; }
        case 'goldPerLand': p.gold += Math.min(CAP(b), est('land') * a); break;
        case 'goldPerProv': { const n = new Set(p.estates.filter(e => !e.ruined).map(e => ES(e).p).filter(Boolean)).size; p.gold += Math.min(CAP(b), n * a); break; }
        case 'buys': p.turn.buys += a; break;
        case 'discount': p.turn.discount += a; break;
        case 'stageGold': { const st = faithsOf(S, p).length && faithActive(S, p) ? faithStage(S, p) : 0; if (st) { p.gold += a * st; log(S, `   +${a * st}🪙 за ступени веры (${st})`, p.i, 'gold'); } else log(S, `   Веры нет — ступеней нет`, p.i, 'quiet'); break; }
        case 'perPlayed': { const n = playedOf(p).filter(id => id === a).length; if (n) { p.gold += n * b; log(S, `   +${n * b}🪙 за сыгранные «${D.COURT[a].name}»`, p.i, 'gold'); } break; } // Сборщик податей
        case 'fairCourt': p.turn.fairCourt = (p.turn.fairCourt || 0) + a; break; // «Ярмарка» на этот ход: карта двора без траты действия
        case 'regDiscount': p.turn.regDiscount += a; break;
        case 'reroll': if (!p.turn.rolled) p.turn.rerolls += a; break;
        case 'forage': {
          const mine = sym(S, p, a);
          for (const o of rivals(S, p, o => sym(S, o, a) < mine && o.gold > 0)) {
            {
              const amt = Math.min(b, o.gold); o.gold -= amt; p.gold += amt;
              log(S, `   ${nm(p)} забрали ${amt}🪙 у ${nmG(o)} — у ${shortG(o)} ${D.SYM[a]} меньше`, p.i, 'steal');
            }
          }
          break;
        }
        case 'siege': await doSiege(S, p, a, ctx); break;
        case 'raze': await doRaze(S, p, a, b, c); break;
        case 'spy': await doSpy(S, p, a, b, c, ctx); break;
        case 'trash': await doTrash(S, p, a); break;
        case 'trashGold': await doTrash(S, p, a, b); break;
        case 'board': {
          const os = opps(S, p).filter(o => o.gold > 0);
          if (!os.length) break;
          const o = os.reduce((x, y) => (y.gold > x.gold ? y : x));
          const amt = Math.min(sym(S, p, 'war') >= prod(S, o).war ? a : 1, o.gold);
          o.gold -= amt; p.gold += amt;
          log(S, `   Абордаж: ${nm(p)} забрали ${amt}🪙 у ${nmG(o)} (у них больше всего золота)`, p.i, 'steal');
          break;
        }
        case 'levy': {
          for (const o of rivals(S, p, o => o.gold > 0)) {
            const amt = Math.min(a, o.gold); if (!amt) continue;
            o.gold -= amt; p.gold += amt;
            log(S, `   ${nm(p)} забрали ${amt}🪙 у ${nmG(o)}`, p.i, 'steal');
          }
          break;
        }
        case 'unseat': if (on(S, 'seats')) await doUnseat(S, p); break;
        // Страда / Крестный ход: ваши Ремёсла или Земли приносят доход прямо сейчас (руины — отстраиваются)
        case 'fire': {
          const m = mods(S, p); let g = 0; const ev = [];
          for (const e of p.estates) {
            const d = ES(e); if (d.t !== a) continue;
            if (e.ruined) { repair(S, p, e, ev); continue; }
            g += estateIncome(S, p, d, m);
          }
          if (g) { p.gold += g; log(S, `   ${a === 'craft' ? 'Ремёсла' : 'Земли'} принесли +${g}🪙`, p.i, 'gold'); }
          break;
        }
        // Двойная игра: ещё раз эффект предыдущей сыгранной в этот ход карты двора
        case 'echo': {
          const prev = playedOf(p).slice(0, -1).reverse().find(id => { const x = D.COURT[id]; return x && !x.bad && !(x.fx || []).some(op => op[0] === 'echo'); });
          if (!prev) { log(S, `   Повторять нечего: до неё в этот ход карт двора не было`, p.i, 'quiet'); break; }
          log(S, `   Двойная игра: ещё раз «${D.COURT[prev].name}»`, p.i, 'play');
          await applyFx(S, p, D.COURT[prev].fx, { card: prev, echo: true });
          break;
        }
        // Перехват: карта из сброса соперника — вам в руку
        case 'snatch': {
          const os = opps(S, p).filter(o => o.discard.some(id => !D.COURT[id].bad));
          if (!os.length) { log(S, `   В сбросах соперников брать нечего`, p.i, 'quiet'); break; }
          const opts = []; for (const o of os) for (const id of new Set(o.discard)) if (!D.COURT[id].bad) opts.push(id);
          const ch = await ask(S, p, { type: 'snatch', from: os[0].i, options: [...new Set(opts)] });
          const id = opts.includes(ch) ? ch : opts[0];
          const o = os.find(x => x.discard.includes(id));
          o.discard.splice(o.discard.indexOf(id), 1); p.hand.push(id);
          log(S, `   Перехват: ${nm(p)} забрали себе в руку «${D.COURT[id].name}» из сброса ${nmG(o)}`, p.i, 'steal');
          emit(S, 'spy', { a: p.i, t: o.i, ok: true, grab: id });
          break;
        }
        // Святые мощи: карта из своего сброса — в руку
        case 'fetchOne': {
          const opts = [...new Set(discardOf(p))];
          if (!opts.length) { log(S, `   Сброс пуст`, p.i, 'quiet'); break; }
          const ch = await ask(S, p, { type: 'fetchOne', options: opts });
          const id = opts.includes(ch) ? ch : opts[0];
          takeFromDiscard(p, id); p.hand.push(id);
          log(S, `   ${nm(p)} вернули в руку «${D.COURT[id].name}»`, p.i, 'draw');
          break;
        }
        case 'goldPerBanner': { const v = a * regCount(p); if (v) p.gold += v; break; }
        case 'shield': p.shield = 2; log(S, `   ${nm(p)}: до конца их следующего хода чужие Набеги и Твердыни у них ничего не забирают`, p.i, 'info'); break;
        case 'ambush': {
          const act = ctx.active;
          if (act && act !== p) {
            const amt = Math.min(a, act.gold); act.gold -= amt; p.gold += amt;
            if (amt) log(S, `   Засада: ${nm(p)} забрали ${amt}🪙 у ${nmG(act)} — они выбросили это число`, p.i, 'steal');
          } else { p.gold += a; }
          break;
        }
      }
      if (S.winner !== null) return;
    }
  }

  // ---------- нападение: осада и шпионаж — по одному правилу ----------
  // сила = значок нападающего (⚔️ в осаде, 🔗 у шпиона; вместе с «до конца хода») + число на карте + способности + кубик;
  // защита = тот же значок защитника + стены (осада) или стража (шпион) + кубик; замок у каждого даёт +2. Больше — успех.
  // ab / db — нападающий / защитник бросает два кубика и берёт лучший (чудо «Неугасимое пламя»)
  const DIE1 = [0, 1, 1, 1, 1, 1, 1].map(x => x / 6), DIE2 = [0, 1, 3, 5, 7, 9, 11].map(x => x / 36);
  const attackOdds = (A, Dv, ab = false, db = false) => { const pa = ab ? DIE2 : DIE1, pd = db ? DIE2 : DIE1; let w = 0; for (let x = 1; x <= 6; x++) for (let y = 1; y <= 6; y++) if (A + x > Dv + y) w += pa[x] * pd[y]; return w; };
  const fightDie = (S, p) => (mods(S, p).fightBest ? Math.max(d6(S), d6(S)) : d6(S));
  // кого можно атаковать: единоверцев нельзя (модуль «Вера»)
  const sameFaith = (S, a, t) => faithsOf(S, a).some(f => faithsOf(S, t).includes(f));
  // перемирие: общая вера, которая запрещает единоверцам нападать (у Пламени, Клинка, Тени и Круга перемирия нет)
  const truce = (S, a, t) => faithsOf(S, a).some(f => D.FAITHS[f].truce !== false && faithsOf(S, t).includes(f));
  const targetsOf = (S, a) => opps(S, a).filter(o => !truce(S, a, o) || sinned(o, 'wrath')); // грех Гнев: перемирие на него не действует
  function siegeOdds(S, a, t, bonus) {
    const A = sym(S, a, 'war') + bonus + (mods(S, a).siege || 0) + wrathOn(t);
    const Dv = sym(S, t, 'war') + walls(S, t) + (mods(S, t).defense || 0) + (mods(S, t).shield || 0);
    return { A, D: Dv, p: attackOdds(A, Dv, !!mods(S, a).fightBest, !!mods(S, t).fightBest) };
  }
  function capturable(S, t, a, maxCost = 99) {
    if (mods(S, t).captureImmune) return [];
    return t.estates.filter(e => {
      const d = ES(e);
      if (d.fixed || e.ruined || d.bad) return false;
      if (d.cost > maxCost) return false;
      if (d.t === 'hold' && !canOwnEstate(a, e.id)) return false;
      return true;
    });
  }
  function moveEstate(S, from, to, uid) {
    const k = from.estates.findIndex(e => e.uid === uid);
    if (k < 0) return null;
    const [e] = from.estates.splice(k, 1);
    to.estates.push(e);
    unionBounty(S, to);
    return e;
  }
  async function doSiege(S, a, bonus, ctx) {
    const fb = faithBan(S, a, 'attack');
    if (fb) { log(S, `   ${nm(a)}: вера «${D.FAITHS[fb].name}» запрещает нападать на владения`, a.i, 'info'); return; }
    const os = targetsOf(S, a);
    if (!os.length) { if (opps(S, a).length) log(S, `   Нападать не на кого: соперники — единоверцы`, a.i, 'info'); return; }
    const options = os.map(o => { const el = capturable(S, o, a, R.siegeLoot + (mods(S, a).lootPlus || 0)); return { i: o.i, ...siegeOdds(S, a, o, bonus), loot: el.length, lootIds: el.map(e => e.id), gold: o.gold }; });
    const ti = await ask(S, a, { type: 'target', kind: 'siege', bonus, options });
    const t = S.players[ti];
    if (!t || t === a) return;
    const o = siegeOdds(S, a, t, bonus);
    (a.turn.did = a.turn.did || {}).attack = true;
    const ar = fightDie(S, a), dr = fightDie(S, t);
    const A = o.A + ar, Dv = o.D + dr;
    a.stats.sieges++;
    log(S, `⚔️ Осада: ${nm(a)} нападают на ${nmG(t)} — атака ${o.A}+${ar}🎲 = ${A}, оборона ${o.D}+${dr}🎲 = ${Dv}`, a.i, 'siege');
    const win = A > Dv;
    if (win) { a.stats.siegeWins++; ritualEvent(S, a, 'siegeWin'); }
    let got = null, gold = 0, ransom = null;
    if (win) {
      const el = capturable(S, t, a, R.siegeLoot + (mods(S, a).lootPlus || 0));
      if (el.length) {
        const uid = await ask(S, a, { type: 'capture', from: t.i, options: el.map(e => e.uid), ransom: !!R.siegeRansom });
        const e0 = el.find(x => x.uid === uid) || el[0];
        const price = ES(e0).cost;
        // откуп: жертва может оставить владение себе, заплатив нападающему его цену
        if (R.siegeRansom && t.gold >= price && await ask(S, t, { type: 'bribe', cost: price, from: a.i, estate: e0.id, uid: e0.uid, siege: true })) {
          t.gold -= price; a.gold += price; gold = price; ransom = e0.id;
          log(S, `   ${nm(a)} победили; ${nm(t)} откупились — ${price}🪙 за «${ES(e0).name}»`, a.i, 'bribe');
        } else {
          const e = moveEstate(S, t, a, e0.uid);
          // захваченное владение приходит в руинах: отстроится, когда первый раз сработает по правилу цвета
          if (e) { e.ruined = true; got = e.id; a.stats.captured++; t.stats.lost++; log(S, `   ${nm(a)} победили и забрали владение «${ES(e).name}» — оно в руинах`, a.i, 'win'); }
        }
      } else { const im = mods(S, t).captureImmune ? modSources(S, t, 'captureImmune') : []; log(S, `   ${nm(a)} победили, но забрать нечего${im.length ? ` — владения ${nmG(t)} защищает «${im.join('», «')}»` : ''}`, a.i, 'win'); }
      const m = mods(S, a);
      if (m.siegeWinGold) { a.gold += m.siegeWinGold; log(S, `   ${nm(a)}: +${m.siegeWinGold}🪙 за победу`, a.i, 'gold'); }
    } else {
      log(S, `   ${nm(t)} отбились`, t.i, 'fail');
    }
    emit(S, 'siege', { a: a.i, t: t.i, A, D: Dv, ar, dr, win, got, gold, ransom });
    await pause(S, 'siege');
  }

  // ---------- разрушение: осадные орудия; владение уходит из игры навсегда ----------
  function destroyable(S, t, maxCost = 99, flag = null) {
    if (mods(S, t).captureImmune) return [];
    return t.estates.filter(e => { const d = ES(e); if (d.bad) return false; if (d.fixed && flag !== 'wall') return false; return d.cost <= maxCost; });
  }
  function razeOdds(S, a, t, bonus, flag) {
    const A = sym(S, a, 'war') + bonus + (mods(S, a).siege || 0) + wrathOn(t);
    const Dv = sym(S, t, 'war') + (flag === 'nowalls' ? 0 : walls(S, t)) + (mods(S, t).defense || 0) + (mods(S, t).shield || 0);
    return { A, D: Dv, p: attackOdds(A, Dv, !!mods(S, a).fightBest, !!mods(S, t).fightBest) };
  }
  async function doRaze(S, a, bonus, maxCost, flag) {
    const fb = faithBan(S, a, 'attack');
    if (fb) { log(S, `   ${nm(a)}: вера «${D.FAITHS[fb].name}» запрещает нападать на владения`, a.i, 'info'); return; }
    const os = targetsOf(S, a);
    if (!os.length) { if (opps(S, a).length) log(S, `   Нападать не на кого: соперники — единоверцы`, a.i, 'info'); return; }
    const options = os.map(o => ({ i: o.i, ...razeOdds(S, a, o, bonus, flag), loot: destroyable(S, o, maxCost, flag).length, gold: o.gold }));
    const ti = await ask(S, a, { type: 'target', kind: 'raze', bonus, maxCost, flag, options });
    const t = S.players[ti];
    if (!t || t === a) return;
    const o = razeOdds(S, a, t, bonus, flag);
    (a.turn.did = a.turn.did || {}).attack = true;
    const ar = fightDie(S, a), dr = fightDie(S, t), A = o.A + ar, Dv = o.D + dr;
    a.stats.sieges++;
    log(S, `💥 Разрушение: ${nm(a)} обстреливают ${nmG(t)} — атака ${o.A}+${ar}🎲 = ${A}, оборона ${o.D}+${dr}🎲 = ${Dv}`, a.i, 'siege');
    const win = A > Dv;
    let gone = null, gold = 0;
    if (win) {
      a.stats.siegeWins++; ritualEvent(S, a, 'siegeWin');
      const el = destroyable(S, t, maxCost, flag);
      if (el.length) {
        const uid = await ask(S, a, { type: 'raze', from: t.i, options: el.map(e => e.uid) });
        const e0 = el.find(x => x.uid === uid) || el[0];
        t.estates.splice(t.estates.indexOf(e0), 1); S.destroyed.push(e0.id); gone = e0.id; t.stats.lost++; a.stats.destroyed++;
        log(S, `   «${ES(e0).name}» ${nmG(t)} разрушено и уходит из игры`, a.i, 'win');
        // Таран: заодно рушит одну Каменную стену соперника
        if (flag === 'wall') { const w = t.estates.find(e => e.id === 'wall' && !e.ruined); if (w) { t.estates.splice(t.estates.indexOf(w), 1); S.destroyed.push('wall'); t.stats.lost++; a.stats.destroyed++; log(S, `   Таран заодно ломает Каменную стену ${nmG(t)}`, a.i, 'win'); } }
      } else { const im = mods(S, t).captureImmune ? modSources(S, t, 'captureImmune') : []; log(S, `   Разрушать нечего${im.length ? ` — владения ${nmG(t)} защищает «${im.join('», «')}»` : ''}`, a.i, 'win'); }
      const m = mods(S, a);
      if (m.siegeWinGold) { a.gold += m.siegeWinGold; log(S, `   ${nm(a)}: +${m.siegeWinGold}🪙 за победу`, a.i, 'gold'); }
    } else log(S, `   ${nm(t)} отбились`, t.i, 'fail');
    emit(S, 'siege', { a: a.i, t: t.i, A, D: Dv, ar, dr, win, raze: true, gone, gold });
    await pause(S, 'siege');
  }
  // подбросить проклятие (v10.14): шпионаж (+3🔗) против 🔗 и стражи соперника; удача — проклятие у него на столе,
  // провал или откуп — проклятие замешивается обратно в колоду владений
  async function doPlantEstate(S, a, id, bonus = R.plantSpy || 3) {
    const fb = faithBan(S, a, 'spy');
    const os = targetsOf(S, a);
    if (fb || !os.length) { backToDeck(S, 'estate', id); log(S, `   Подбросить некому${fb ? ` — вера «${D.FAITHS[fb].name}» запрещает шпионить` : ''}: «${ES(id).name}» замешано обратно в колоду владений`, a.i, 'info'); return; }
    const options = os.map(o => ({ i: o.i, ...spyInfo(S, a, o, bonus), gold: o.gold }));
    const ti = await ask(S, a, { type: 'target', kind: 'plantEstate', bonus, estate: id, options });
    const t = S.players[ti] && S.players[ti] !== a ? S.players[ti] : os[0];
    const info = spyInfo(S, a, t, bonus);
    (a.turn.did = a.turn.did || {}).attack = true;
    if (await buyoff(S, a, t, info, { plantEstate: id })) { backToDeck(S, 'estate', id); return; }
    const ar = fightDie(S, a), gr = fightDie(S, t), At = info.A + ar, Gt = info.G + gr;
    const ok = At > Gt;
    a.stats.spies = (a.stats.spies || 0) + 1;
    log(S, `⬛ Подбросить: ${nm(a)} → ${nmG(t)} «${ES(id).name}», шпион ${info.A}+${ar}🎲 = ${At}, стража ${info.G}+${gr}🎲 = ${Gt}: ${ok ? 'удача — проклятие у них' : 'провал, проклятие замешано обратно в колоду владений'}`, a.i, ok ? 'steal' : 'fail');
    if (ok) { t.estates.push({ uid: S.uid++, id, by: a.i }); ritualEvent(S, a, 'spyWin'); } else backToDeck(S, 'estate', id);
    emit(S, 'spy', { a: a.i, t: t.i, ok, plantEstate: id, ar, gr, A: At, G: Gt });
  }

  // ---------- шпионаж ----------
  // одна защита на всё: от шпионов, как и от нападений, — 🧱 Стены (своя 🛡 Стража убрана)
  // от шпиона замок защищает не целиком: R.spyCastle — доля родовых 🧱 (1 — все, 0.5 — половина, 0 — замок не мешает шпиону)
  const spyWalls = (S, t) => walls(S, t) - Math.ceil((R.baseWalls || 0) * (1 - (R.spyCastle == null ? 1 : R.spyCastle))); // 🧱 против шпиона: замок — вполовину
  const guardOf = (S, t) => spyWalls(S, t) + (mods(S, t).guard || 0) + (mods(S, t).shield || 0);
  function spyInfo(S, a, t, bonus) {
    const A = sym(S, a, 'int') + bonus + (mods(S, a).spy || 0) + wrathOn(t);
    const G = sym(S, t, 'int') + guardOf(S, t);
    const p = attackOdds(A, G, !!mods(S, a).fightBest, !!mods(S, t).fightBest);
    return { A, G, p, ok: p >= 0.5 };
  }
  // откуп: до броска жертва может заплатить шпиону 3🪙 за каждую 🔗 разницы сил (не меньше 3🪙) — шпионаж отменён
  const buyoffCost = (info) => (R.spyBuyoff || 0) * Math.max(1, info.A - info.G);
  async function buyoff(S, a, t, info, extra) {
    if (!R.spyBuyoff) return false;
    const cost = buyoffCost(info);
    if (t.gold < cost) return false;
    const yes = await ask(S, t, Object.assign({ type: 'buyoff', cost, from: a.i, A: info.A, G: info.G, odds: info.p }, extra || {}));
    if (!yes) return false;
    t.gold -= cost; a.gold += cost;
    log(S, `   ${nm(t)} откупились от шпионажа — ${cost}🪙 ${nmD(a)}`, t.i, 'bribe');
    emit(S, 'spy', { a: a.i, t: t.i, ok: false, buyoff: cost });
    return true;
  }
  async function doSpy(S, a, bonus, effect, param, ctx) {
    const fb = faithBan(S, a, 'spy');
    if (fb) { log(S, `   ${nm(a)}: вера «${D.FAITHS[fb].name}» запрещает шпионить`, a.i, 'info'); return; }
    const os = targetsOf(S, a);
    if (!os.length) { if (opps(S, a).length) log(S, `   Шпионить не за кем: соперники — единоверцы`, a.i, 'info'); return; }
    const options = os.map(o => ({ i: o.i, ...spyInfo(S, a, o, bonus), gold: o.gold, plots: o.plots.length, plotsOk: !!(o.plots.length && !mods(S, o).plotProtect), lootIds: effect === 'estate' ? capturable(S, o, a, param).map(e => e.id) : [] }));
    const ti = await ask(S, a, { type: 'target', kind: 'spy', bonus, effect, param, options });
    const t = S.players[ti];
    if (!t || t === a) return;
    const info = spyInfo(S, a, t, bonus);
    (a.turn.did = a.turn.did || {}).attack = true;
    if (await buyoff(S, a, t, info, { effect, param })) return;
    const ar = fightDie(S, a), gr = fightDie(S, t);
    const At = info.A + ar, Gt = info.G + gr;
    a.stats.spies = (a.stats.spies || 0) + 1;
    if (At <= Gt) {
      log(S, `🗝 Шпионаж: ${nm(a)} против ${nmG(t)} — шпион ${info.A}+${ar}🎲 = ${At}, стража ${info.G}+${gr}🎲 = ${Gt}: провал`, a.i, 'fail');
      emit(S, 'spy', { a: a.i, t: t.i, ok: false, ar, gr, A: At, G: Gt });
      return;
    }
    log(S, `🗝 Шпионаж: ${nm(a)} против ${nmG(t)} — шпион ${info.A}+${ar}🎲 = ${At}, стража ${info.G}+${gr}🎲 = ${Gt}: удача`, a.i, 'siege');
    ritualEvent(S, a, 'spyWin');
    const ma = mods(S, a), mt = mods(S, t);
    const nothing = () => { log(S, `   Удача, но взять нечего`, a.i, 'quiet'); emit(S, 'spy', { a: a.i, t: t.i, ok: true, none: true, ar, gr, A: At, G: Gt }); };
    if (ma.spyWinGold) { a.gold += ma.spyWinGold; log(S, `   ${nm(a)}: +${ma.spyWinGold}🪙 за удачный шпионаж`, a.i, 'gold'); }
    if (effect === 'sabotage') {
      if (t.plots.length && !mt.plotProtect) {
        const k = Math.floor(rnd(S) * t.plots.length);
        const [pl] = t.plots.splice(k, 1);
        t.discard.push(pl.id);
        log(S, `   ${nm(a)} сорвали замысел ${nmG(t)}: «${D.COURT[pl.id].name}» ушёл в сброс`, a.i, 'steal');
        emit(S, 'spy', { a: a.i, t: t.i, ok: true, ar, gr, A: At, G: Gt });
        return;
      }
      if (on(S, 'seats') && !mt.seatGuard && (t.seats || []).length) {
        const opts = t.seats.map((id, k) => ({ i: t.i, k, id }));
        const ch = await ask(S, a, { type: 'unseat', options: opts });
        const o = (ch != null && opts[ch]) || opts[0];
        if (t.seats[o.k] === o.id) {
          t.seats.splice(o.k, 1); t.discard.push(o.id);
          log(S, `   ${nm(a)} устроили опалу: «${D.COURT[o.id].name}» ${nmG(t)} уходит в их сброс`, a.i, 'steal');
          emit(S, 'unseat', { a: a.i, t: t.i, id: o.id });
          await trimSeats(S, t);
        }
        emit(S, 'spy', { a: a.i, t: t.i, ok: true, ar, gr, A: At, G: Gt, unseat: o.id });
        return;
      }
      return nothing();
    }
    if (effect === 'estate') {
      const el = capturable(S, t, a, param);
      if (el.length) {
        const uid = await ask(S, a, { type: 'capture', from: t.i, options: el.map(e => e.uid), blackmail: true });
        const e0 = el.find(e => e.uid === uid) || el[0];
        const e = moveEstate(S, t, a, e0.uid);
        if (e) { a.stats.captured++; t.stats.lost++; log(S, `   Вымогательство: владение «${ES(e).name}» переходит от ${nmG(t)} к ${nm(a)}`, a.i, 'steal'); }
        updateTitles(S);
        emit(S, 'spy', { a: a.i, t: t.i, ok: true, estate: e ? e.id : null, ar, gr, A: At, G: Gt });
        return;
      }
      if (mods(S, t).captureImmune) log(S, `   Владения ${nmG(t)} защищает «${modSources(S, t, 'captureImmune').join('», «')}» — отнять нельзя`, a.i, 'quiet');
      return nothing();
    }
    const done = (x) => emit(S, 'spy', Object.assign({ a: a.i, t: t.i, ok: true, ar, gr, A: At, G: Gt }, x));
    if (effect === 'grab') {
      // перехват: карта из сброса соперника — в ваш сброс
      if (t.discard.length) {
        const ch = await ask(S, a, { type: 'grab', from: t.i, options: [...new Set(t.discard)] });
        const id = t.discard.includes(ch) ? ch : t.discard[0];
        t.discard.splice(t.discard.indexOf(id), 1); a.discard.push(id);
        log(S, `   Перехват: ${nm(a)} забрали из сброса ${nmG(t)} «${D.COURT[id].name}»`, a.i, 'steal');
        done({ grab: id }); return;
      }
      return nothing();
    }
    if (effect === 'burn') {
      if (t.discard.length) {
        const ch = await ask(S, a, { type: 'burn', from: t.i, max: param, options: [...new Set(t.discard)] });
        const list = (Array.isArray(ch) ? ch : [ch]).filter(Boolean).slice(0, param);
        const burnt = [];
        for (const id of list) { const k = t.discard.indexOf(id); if (k >= 0) { t.discard.splice(k, 1); t.trashed.push(id); burnt.push(D.COURT[id].name); } }
        while (burnt.length < param && t.discard.length) { const id = t.discard.pop(); t.trashed.push(id); burnt.push(D.COURT[id].name); }
        log(S, `   Поджог архива: у ${nmG(t)} сгорели ${burnt.map(x => `«${x}»`).join(', ')}`, a.i, 'steal');
        done({ burn: burnt.length }); return;
      }
      return nothing();
    }
    if (effect === 'poach') {
      // вербовка: вассал соперника переходит к вам, вы платите ему напечатанную цену
      const can = a.vassals.length < needOf(S, 'v');
      const half = !!R.poachHalf, priceOf = (id) => (half ? Math.ceil(D.BAN[id].cost / 2) : D.BAN[id].cost); // poachHalf: половина цены — в банк
      const opts = can ? t.vassals.filter(id => priceOf(id) <= a.gold && !faithBan(S, a, 'hire_' + D.BAN[id].dir)) : [];
      if (opts.length) {
        const ch = await ask(S, a, { type: 'poach', from: t.i, options: opts });
        const id = opts.includes(ch) ? ch : opts[0];
        const price = priceOf(id);
        a.gold -= price; if (!half) t.gold += price;
        t.vassals.splice(t.vassals.indexOf(id), 1); a.vassals.push(id);
        log(S, `   Вербовка: ${nm(a)} переманили у ${nmG(t)} вассала «${D.regName(D.BAN[id])}», заплатив ${half ? `в банк ${price}🪙` : `им ${price}🪙`}`, a.i, 'steal');
        checkGoal(S, a);
        done({ poach: id }); return;
      }
      return nothing();
    }
    if (effect === 'distract') {
      if (t.lords.length) {
        const ch = await ask(S, a, { type: 'distract', from: t.i, options: t.lords.slice() });
        const id = t.lords.includes(ch) ? ch : t.lords[0];
        t.distracted = { id, left: 0 };
        log(S, `   Куртизанка: «${D.regName(D.BAN[id])}» ${nmG(t)} не действует до конца их следующего хода`, a.i, 'steal');
        done({ distract: id }); return;
      }
      return nothing();
    }
    if (effect === 'lock') { // Куртизанка: в свой следующий ход соперник не нанимает знамён
      t.lockNext = true;
      log(S, `   Куртизанка: в свой следующий ход ${nm(t)} не смогут нанимать знамёна`, a.i, 'steal');
      done({ lock: true }); return;
    }
    if (effect === 'tax') { // Смутьян: соперник отдаёт в банк по param🪙 за каждое своё знамя
      const amt = Math.min(t.gold, regCount(t) * param);
      if (amt > 0) { t.gold -= amt; log(S, `   Смута: ${nm(t)} отдают в банк ${amt}🪙 (${param}🪙 за каждое знамя)`, a.i, 'steal'); done({ tax: amt }); return; }
      return nothing();
    }
    if (effect === 'riot') {
      if (upkeepList(t).length) {
        t.upkeepExtra = (t.upkeepExtra || 0) + param;
        log(S, `   Смута: в следующий ход ${nm(t)} заплатят за содержание на ${param}🪙 больше`, a.i, 'steal');
        done({ riot: param }); return;
      }
      return nothing();
    }
    if (effect === 'arson') { // Поджог: соперник теряет param🪙 — в банк
      const amt = Math.min(param, t.gold);
      if (amt > 0) { t.gold -= amt; log(S, `   Поджог: ${nm(t)} теряют ${amt}🪙`, a.i, 'steal'); done({ arson: amt }); return; }
      return nothing();
    }
    if (effect === 'denounce' || effect === 'feast') { // Донос: param случайных карт из руки — в сброс; Отравленный пир: одна карта и param🪙 в банк
      const gone = [];
      for (let k = 0; k < (effect === 'feast' ? 1 : param) && t.hand.length; k++) { const [id] = t.hand.splice(Math.floor(rnd(S) * t.hand.length), 1); t.discard.push(id); gone.push(id); }
      const amt = effect === 'feast' ? Math.min(param, t.gold) : 0;
      t.gold -= amt;
      if (!gone.length && !amt) return nothing();
      const what = [gone.length ? `сбрасывают ${gone.map(x => `«${D.COURT[x].name}»`).join(', ')}` : '', amt ? `теряют ${amt}🪙` : ''].filter(Boolean).join(' и ');
      log(S, `   ${effect === 'feast' ? 'Отравленный пир' : 'Донос'}: ${nm(t)} ${what}`, a.i, 'steal');
      done({ toss: gone, lose: amt }); return;
    }
    if (effect === 'slander') { // Клевета: в свой следующий ход он не покупает карты двора
      t.slanderNext = true;
      log(S, `   Клевета: в свой следующий ход ${nm(t)} не смогут покупать карты двора`, a.i, 'steal');
      done({ slander: true }); return;
    }
    const amt = Math.min(param + (ma.stealBonus || 0), t.gold);
    t.gold -= amt; a.gold += amt; a.stats.stolen += amt;
    log(S, `   Кража: ${nm(a)} забрали ${amt}🪙 у ${nmG(t)}`, a.i, 'steal');
    emit(S, 'spy', { a: a.i, t: t.i, ok: true, amt, ar, gr, A: At, G: Gt });
  }

  async function doTrash(S, p, n, each = 0, need = 0) {
    if (!handFree(p).length) return 0;
    const bi = borrowIdx(p);
    const idxs = await ask(S, p, { type: 'trash', max: n, each, need, label: (p.turn && p.turn.trashLabel) || '', lock: bi >= 0 ? [bi] : [] });
    if (!Array.isArray(idxs) || !idxs.length) return 0;
    const sorted = [...new Set(idxs)].filter(i => i >= 0 && i < p.hand.length && i !== bi).sort((x, y) => y - x).slice(0, n);
    const names = [];
    for (const i of sorted) { const [id] = p.hand.splice(i, 1); names.push(D.COURT[id].name); (p.trashed = p.trashed || []).push(id); }
    if (names.length) log(S, `   ${nm(p)} убрали из колоды навсегда: ${names.join(', ')}${each ? ` (+${each * names.length}🪙)` : ''}`, p.i, 'trash');
    if (each) p.gold += each * names.length;
    return names.length;
  }

  // ---------- вера ----------
  // условие: 🕯🕯 + 2 значка направления веры; вера Дома и способности (Солнце, Тит, Ирмина) снижают нужные 🕯
  // вера своего направления (у Домов 🕯 — любая) принимается на 1🕯 проще
  const houseFaithEase = (p, f) => { const hd = D.HOUSES[p.house].dir, fd = D.FAITHS[f].dir; return hd === 'faith' || hd === fd ? 1 : 0; };
  function faithReq(S, p, f) {
    const F = D.FAITHS[f]; const m = mods(S, p);
    const ease = houseFaithEase(p, f) + (m.faithEase || 0);
    const need = F.dir ? { faith: Math.max(0, (R.faithNeed || 2) - ease), dir: R.faithDir || 2 } : { faith: Math.max(0, (R.faithPure || 3) - ease), dir: 0 };
    const have = { faith: sym(S, p, 'faith'), dir: F.dir ? sym(S, p, F.dir) : 0 };
    return { need, have, ok: have.faith >= need.faith && have.dir >= need.dir, dir: F.dir };
  }
  // две веры — пока у вас Архиепископ Григорий (даже отвлечённый Куртизанкой: веры за ход не меняются)
  const faithMax = (S, p) => (mods(S, p).twoFaiths || allBans(p).some(id => (D.BAN[id].mods || {}).twoFaiths) ? 2 : 1);
  function canAdopt(S, p, f) {
    if (!on(S, 'faith') || !D.FAITHS[f]) return 'Модуль «Вера» выключен';
    if (S.faithRow && !S.faithRow.includes(f)) return 'Этой веры нет в партии';
    if (p.faiths.includes(f)) return 'Вы уже исповедуете эту веру';
    if (p.faiths.length >= faithMax(S, p)) return p.faiths.length ? 'Сначала отрекитесь от своей веры' : 'Нельзя';
    if (p.turn.renounced) return 'Новую веру можно принять со следующего хода';
    const r = faithReq(S, p, f);
    if (!r.ok) return `Нужно ${D.SYM.faith.repeat(r.need.faith)}${r.dir ? D.SYM[r.dir].repeat(r.need.dir) : ''}`;
    return null;
  }
  async function adoptFaith(S, p, f) {
    if (S.winner !== null || S.players[S.cur] !== p) return { ok: false, why: 'Сейчас не ваш ход' };
    const why = canAdopt(S, p, f);
    if (why) return { ok: false, why };
    p.faiths.push(f);
    const F = D.FAITHS[f], g = mods(S, p).faithAdoptGold || 0;
    if (g) p.gold += g;
    log(S, `${F.icon} ${nm(p)} приняли веру «${F.name}»: ${F.text.replace(/\.$/, '')}. Обет: ${F.oathText.replace(/\.$/, '').replace(/^./, (x) => x.toLowerCase())}${g ? `. +${g}🪙` : ''}`, p.i, 'faith');
    // карты веры: их получает тот, кто принял веру первым (пока они у веры)
    const got = S.faithPool && S.faithPool[f] ? S.faithPool[f].splice(0) : [];
    if (got.length) { p.discard.push(...got); log(S, `   Карты веры — в сброс ${nmG(p)}: ${got.map(id => `«${D.COURT[id].name}»`).join(', ')}`, p.i, 'faith'); }
    emit(S, 'faith', { p: p.i, id: f, adopt: true });
    emit(S, 'change');
    return { ok: true };
  }
  async function renounceFaith(S, p, f) {
    if (S.winner !== null || S.players[S.cur] !== p) return { ok: false, why: 'Сейчас не ваш ход' };
    if (!p.faiths.includes(f)) return { ok: false, why: 'Вы не исповедуете эту веру' };
    if (D.FAITHS[f].oath === 'no_renounce' && !oathFree(p)) return { ok: false, why: `Обет «${D.FAITHS[f].name}»: отречься нельзя` };
    const cost = mods(S, p).freeRenounce ? 0 : (R.renounceCost || 3);
    if (p.gold < cost) return { ok: false, why: `Нужно ${cost}🪙` };
    p.gold -= cost; p.turn.renounced = true;
    dropFaith(S, p, f, `${nm(p)} отреклись от веры «${D.FAITHS[f].name}»${cost ? ` (−${cost}🪙)` : ''}`);
    emit(S, 'change');
    return { ok: true };
  }
  // уйти из веры: карты этой веры уходят из колоды, руки, сброса, замыслов — обратно к вере
  function dropFaith(S, p, f, why) {
    p.faiths = p.faiths.filter(x => x !== f);
    log(S, why, p.i, 'faith');
    // ритуал этой веры сгорает, её чудеса уходят вместе с верой
    if (p.ritual && RIT[p.ritual.id] && RIT[p.ritual.id].faith === f) burnRitual(S, p, 'отречение от веры');
    { const gone = (p.miracles || []).filter(id => RIT[id] && RIT[id].faith === f); if (gone.length) { p.miracles = p.miracles.filter(id => !gone.includes(id)); log(S, `   Чудеса уходят вместе с верой: ${gone.map(id => `«${RIT[id].miracle.name}»`).join(', ')}`, p.i, 'faith'); } }
    // карты этой веры уходят из колоды, руки, сброса, замыслов — обратно к вере
    { const mine = new Set(D.FAITHS[f].cards || []), back = [];
      for (const k of ['deck', 'hand', 'discard', 'inPlay', 'seats']) { const pile = p[k] || []; for (let x = pile.length - 1; x >= 0; x--) if (mine.has(pile[x])) back.push(...pile.splice(x, 1)); }
      for (let x = p.plots.length - 1; x >= 0; x--) if (mine.has(p.plots[x].id)) back.push(p.plots.splice(x, 1)[0].id);
      if (back.length) { (S.faithPool = S.faithPool || {})[f] = (S.faithPool[f] || []).concat(back); log(S, `   Карты веры возвращаются к вере: ${back.map(id => `«${D.COURT[id].name}»`).join(', ')}`, p.i, 'faith'); } }
    emit(S, 'faith', { p: p.i, id: f, adopt: false });
  }
  // ушёл Архиепископ Григорий — двух вер больше нельзя: одну оставьте, от другой отрекаетесь бесплатно
  async function trimFaiths(S, p) {
    for (let g = 0; g < 3 && (p.faiths || []).length > faithMax(S, p); g++) {
      let keep = await ask(S, p, { type: 'faithKeep', options: p.faiths.slice() });
      if (!p.faiths.includes(keep)) keep = p.faiths[0];
      const drop = p.faiths.find(f => f !== keep);
      dropFaith(S, p, drop, `${nm(p)}: без Архиепископа Григория две веры нельзя — остаётся «${D.FAITHS[keep].name}», от «${D.FAITHS[drop].name}» отреклись без платы`);
    }
  }

  // ---------- обряд веры: раз в ход на каждую вашу веру ----------
  function riteBlock(S, p, f) {
    if (!on(S, 'faith')) return 'Модуль «Вера» выключен';
    if (S.winner !== null || S.players[S.cur] !== p) return 'Сейчас не ваш ход';
    if (!p.faiths.includes(f)) return 'Это не ваша вера';
    if (!faithActive(S, p)) return 'Проклятая реликвия: вера не действует';
    if (p.turn && (p.turn.riteN || 0) >= 1 + (mods(S, p).riteTwice || 0)) return (mods(S, p).riteTwice ? 'Обряды на этот ход закончились' : 'Обряд уже был в этот ход');
    const F = D.FAITHS[f], c = F.rite.cost || {};
    if (c.gold && p.gold < c.gold) return `Нужно ${c.gold}🪙`;
    if (c.give && p.gold < c.give) return `Нужно ${c.give}🪙`;
    if ((c.trash || F.rite.fx.some(op => op[0] === 'trashGold')) && !p.hand.length) return 'Нет карт в руке';
    if (F.rite.fx.some(op => op[0] === 'spy') && (faithBan(S, p, 'spy') || !targetsOf(S, p).length)) return 'Шпионить не у кого';
    return null;
  }
  async function rite(S, p, f) {
    const why = riteBlock(S, p, f);
    if (why) return { ok: false, why };
    const F = D.FAITHS[f], c = F.rite.cost || {};
    (p.turn.rites = p.turn.rites || {})[f] = true; p.turn.riteN = (p.turn.riteN || 0) + 1;
    p.turn.trashLabel = `Обряд «${F.rite.name}»`;
    try {
    if (c.trash) {
      const n = await doTrash(S, p, c.trash, 0, c.trash);
      if (n < c.trash) { p.turn.rites[f] = false; p.turn.riteN--; return { ok: false, why: 'Нужно убрать карту из руки' }; }
    }
    (p.turn.did = p.turn.did || {}).rite = true;
    if (c.gold) p.gold -= c.gold;
    if (c.give) {
      const N = S.players.length; let poor = null;
      for (let k = 1; k < N; k++) { const o = S.players[(p.i + k) % N]; if (!poor || o.gold < poor.gold) poor = o; }
      p.gold -= c.give; if (poor) poor.gold += c.give;
      if (poor) log(S, `   ${nm(p)} отдали ${c.give}🪙 ${nmD(poor)}`, p.i, 'gold');
    }
    log(S, `${F.icon} ${nm(p)}: обряд «${F.rite.name}» (${F.name})`, p.i, 'faith');
    const g0 = p.gold;
    await applyFx(S, p, F.rite.fx, {});
    emit(S, 'rite', { p: p.i, id: f, gold: p.gold - g0 });
    ritualEvent(S, p, 'rite', f);
    ritualTick(S, p);
    } finally { p.turn.trashLabel = ''; }
    emit(S, 'change');
    return { ok: true };
  }

  // ---------- модуль «Придворные»: места при дворе ----------
  // посадить карту из руки (вместо розыгрыша); мест нет — один из придворных уходит в ваш сброс
  async function seat(S, p, idx, from = 'hand') {
    const pile = from === 'discard' ? p.discard : p.hand;
    const id = pile[idx];
    if (!id || !canSeat(S, id) || (from !== 'discard' && idx === borrowIdx(p))) return false;
    if (from === 'discard' && (!(mods(S, p).seatFromDiscard > 0) || p.turn.discardSeated)) return false;
    let out = null;
    const extra = ((D.COURT[id].seat || {}).mods || {}).seatSlots || 0; // Камергер сам добавляет места — садится без замены
    if (p.seats.length >= seatMax(S, p) + extra) {
      const k = await ask(S, p, { type: 'seatReplace', card: id, options: p.seats.slice() });
      if (k == null || k < 0 || k >= p.seats.length || pile[idx] !== id) return false;
      [out] = p.seats.splice(k, 1);
      p.discard.push(out);
    }
    pile.splice(idx, 1);
    if (from === 'discard') p.turn.discardSeated = true;
    p.seats.push(id);
    const c = D.COURT[id];
    log(S, `🪑 ${nm(p)} посадили ко двору${from === 'discard' ? ' из сброса' : ''} «${c.name}»: ${c.stext.replace(/\.$/, '')}${out ? `. «${D.COURT[out].name}» уходит в сброс` : ''}`, p.i, 'seat');
    { const sg = mods(S, p).seatGold || 0; if (sg) { p.gold += sg; log(S, `   ${nm(p)}: +${sg}🪙 за посадку ко двору`, p.i, 'gold'); } }
    emit(S, 'seat', { p: p.i, id, out, discard: from === 'discard' });
    await trimSeats(S, p);
    updateTitles(S);
    emit(S, 'change');
    return true;
  }
  // посадить карту из своего сброса (Архиепископ Григорий, Сорель Аш): раз в ход, в свой ход
  async function seatFromDiscard(S, p, id) {
    if (S.winner !== null || S.players[S.cur] !== p) return false;
    if (p.discard.indexOf(id) < 0 && (p.inPlay || []).includes(id)) { takeFromDiscard(p, id); p.discard.push(id); } // сыгранная в этот ход — тоже в сбросе
    const idx = p.discard.indexOf(id);
    if (idx < 0) return false;
    const ok = await seat(S, p, idx, 'discard');
    return ok;
  }
  // мест стало меньше (ушёл Камергер): лишние придворные по выбору владельца уходят в его сброс
  async function trimSeats(S, p) {
    for (let g = 0; g < 6 && p.seats.length > seatMax(S, p); g++) {
      let k = await ask(S, p, { type: 'seatDrop', options: p.seats.slice(), max: seatMax(S, p) });
      if (k == null || k < 0 || k >= p.seats.length) k = 0;
      const [out] = p.seats.splice(k, 1);
      p.discard.push(out);
      log(S, `🪑 ${nm(p)}: мест при дворе теперь ${seatMax(S, p)} — «${D.COURT[out].name}» уходит в сброс`, p.i, 'seat');
      emit(S, 'unseat', { a: null, t: p.i, id: out });
    }
  }
  // опала: один придворный соперника уходит в сброс владельца (кроме тех, кого защищает Заговорщик)
  function unseatOptions(S, p) {
    const out = [];
    for (const o of opps(S, p)) { if (mods(S, o).seatGuard) continue; (o.seats || []).forEach((id, k) => out.push({ i: o.i, k, id })); }
    return out;
  }
  async function doUnseat(S, p) {
    const opts = unseatOptions(S, p);
    if (!opts.length) { log(S, `   Опала: прогнать некого${opps(S, p).some(o => (o.seats || []).length) ? ' — придворные соперника под защитой' : ''}`, p.i, 'info'); return; }
    const ch = await ask(S, p, { type: 'unseat', options: opts });
    const o = ch != null && opts[ch];
    if (!o) return;
    const t = S.players[o.i];
    if (t.seats[o.k] !== o.id) return;
    t.seats.splice(o.k, 1); t.discard.push(o.id);
    log(S, `   Опала: «${D.COURT[o.id].name}» ${nmG(t)} уходит в их сброс`, p.i, 'steal');
    emit(S, 'unseat', { a: p.i, t: t.i, id: o.id });
    await trimSeats(S, t);
    updateTitles(S);
  }

  // ---------- Отставка: раз в ход убрать из игры карту из руки и взять одну из своей колоды ----------
  async function retire(S, p, idx) {
    if (R.retire === false) return false; // Отставки в правилах больше нет
    if (S.winner !== null || S.players[S.cur] !== p || p.turn.retired) return false;
    if (faithBan(S, p, 'no_retire')) return false;
    const id = p.hand[idx];
    if (!id || idx === borrowIdx(p)) return false; // одолженную карту в отставку не отправить
    p.hand.splice(idx, 1);
    (p.turn.did = p.turn.did || {}).retire = true;
    const curse = !!D.COURT[id].bad; // беда из игры не уходит — замешивается обратно в колоду двора
    if (curse) backToDeck(S, 'court', id); else p.trashed.push(id);
    p.turn.retired = true; p.stats.retired++;
    const m = mods(S, p);
    const got = drawCards(S, p, 1 + (m.retireDraw || 0));
    if (m.retireGold) p.gold += m.retireGold;
    log(S, `${nm(p)}: отставка — «${D.COURT[id].name}» ${curse ? 'замешана в колоду двора' : 'уходит из игры'}${got ? `, взяли ${D.cards(got)}` : ''}${m.retireGold ? `, +${m.retireGold}🪙` : ''}`, p.i, 'trash');
    emit(S, 'retire', { p: p.i, id, drew: got });
    emit(S, 'change');
    return true;
  }
  // Святой Аврелий, Летописец при дворе, Звёздный Свет III: каждый — раз в ход карта из сброса в руку. Одинаковые свойства складываются
  const fetchLeft = (S, p) => Math.max(0, (mods(S, p).fetch || 0) - ((p.turn && p.turn.fetchN) || 0));
  async function fetchCard(S, p, id) {
    if (S.winner !== null || S.players[S.cur] !== p || fetchLeft(S, p) <= 0) return false;
    if (!discardOf(p).includes(id)) return false;
    takeFromDiscard(p, id); p.hand.push(id); p.turn.fetchN = (p.turn.fetchN || 0) + 1; p.turn.fetched = fetchLeft(S, p) <= 0;
    log(S, `${nm(p)} вернули в руку из сброса «${D.COURT[id].name}»`, p.i, 'draw');
    emit(S, 'change');
    return true;
  }

  // снять проклятие: в свой ход, после броска, действие + 2🪙 — проклятие замешивается в колоду владений
  function purgeBlock(S, p, e) {
    if (S.winner !== null || S.players[S.cur] !== p) return 'Сейчас не ваш ход';
    if (!e || !ES(e).bad) return 'Это не проклятие';
    if (!p.turn.rolled) return 'Сначала бросьте кубики';
    if (buysLeft(S, p) <= 0) return 'Действия на этот ход закончились';
    const cost = R.purgeCost || 2;
    if (p.gold < cost) return `Нужно ${cost}🪙`;
    return null;
  }
  async function purgeBad(S, p, uid) {
    const e = p.estates.find(x => x.uid === uid);
    const why = purgeBlock(S, p, e);
    if (why) return { ok: false, why };
    const cost = R.purgeCost || 2;
    p.gold -= cost; p.turn.buysUsed++;
    p.estates.splice(p.estates.indexOf(e), 1);
    backToDeck(S, 'estate', e.id);
    log(S, `${nm(p)} сняли проклятие «${ES(e).name}» (−${cost}🪙, действие) — оно замешано в колоду владений`, p.i, 'buy');
    emit(S, 'purge', { p: p.i, id: e.id });
    emit(S, 'change');
    return { ok: true };
  }

  // ---------- розыгрыш карты ----------
  // Свита: 2-я карта той же роли за ход — срабатывает её «Свита»; 3-я и дальше — «Свита» дважды. У карты без блока «Свита» бонуса нет
  async function play(S, p, idx, opt = {}) {
    if (S.winner !== null || S.players[S.cur] !== p) return false;
    const id = p.hand[idx];
    if (!id) return false;
    const c = D.COURT[id];
    if (opt.seat) return seat(S, p, idx);
    if (oathPlay(S, p, id)) return false;
    const m = mods(S, p);
    if (opt.plot) {
      if (!c.plot || p.plots.length >= plotSlots(S, p) || idx === borrowIdx(p)) return false;
      p.hand.splice(idx, 1);
      let nums = null;
      if (c.plot === 'dice') {
        // два числа напечатаны на карте; Кассия — ещё и соседние; Дом Луны называет третье
        const base = Array.isArray(c.pn) ? c.pn : [c.pn];
        const set = new Set(base);
        if (m.plotSpread) for (const n of base) for (let k = n - m.plotSpread; k <= n + m.plotSpread; k++) if (k >= 1 && k <= 12) set.add(k);
        if (m.plotThird) {
          const ch = await ask(S, p, { type: 'plotNums', count: 1, exclude: [...set], id });
          const x = Array.isArray(ch) ? ch[0] : ch;
          if (x >= 1 && x <= 12) set.add(x);
        }
        nums = [...set].sort((x, y) => x - y);
      }
      p.plots.push({ id, kind: c.plot, nums, uid: S.uid++ });
      log(S, `${nm(p)} отложили карту замыслом ${c.plot === 'dice' ? `🎲 (сработает на ${nums.join(', ')})` : '⏳ (сработает в начале их следующего хода)'}`, p.i, 'plotset');
      emit(S, 'play', { p: p.i, id, plot: true, kind: c.plot });
      emit(S, 'change');
      return true;
    }
    if (p.borrow && !p.borrow.played && idx === borrowIdx(p)) p.borrow.played = true; // сыграна одолженная карта — вернётся владельцу в конце хода
    p.hand.splice(idx, 1);
    p.inPlay.push(id); // сыгранная карта — сразу в сброс (лежит сверху, в замес посреди хода не идёт)
    if (p.turn.played) p.turn.played.push(id);
    const before = c.role ? (p.turn.roles[c.role] || 0) : 0;
    // свита: в этот ход уже сыграна карта той же роли; у Сборщика податей свиту запускает сыгранная до него «Подать» (allyBy)
    // «большая» свита (дважды) — у всех одинаково: до карты сыграны две другие карты её роли (у Сборщика — два других Купца)
    const by = c.allyBy ? playedOf(p).slice(0, -1).includes(c.allyBy) : null;
    const allyB = !!m.allyBig && !!(c.role || c.allyBy); // чудо «Созвездие»: двойная свита у всех ваших карт двора
    const ally = allyB || (by != null ? (by || !!m.allyAll) : !!(c.role && (before >= 1 || (c.role === 'scholar' && m.allyScholar) || m.allyAll)));
    const big = (allyB && !!c.ally) || (ally && !!(c.role && c.ally && before >= 2) && (by == null || R.allyByDouble !== false));
    if (c.role) p.turn.roles[c.role] = before + 1;
    const g0 = p.gold, h0 = p.hand.length, t0 = { ...p.temp };
    log(S, `${nm(p)} сыграли «${c.name}»${big ? ' с большой свитой' : ally && c.ally ? ' со свитой' : ''}`, p.i, 'play');
    const entry = S.log[S.log.length - 1];
    await applyFx(S, p, c.fx, { card: id });
    if (ally && c.ally && S.winner === null) await applyFx(S, p, c.ally, { card: id });
    if (big && S.winner === null) await applyFx(S, p, c.ally, { card: id });
    // жрец веры: последователю — ещё и строка «Вере»
    if (c.faith && c.ffx && S.winner === null && faithsOf(S, p).includes(c.faith) && faithActive(S, p)) { await applyFx(S, p, c.ffx, { card: id }); }
    // козни: сыграли — карта уходит в колоду двора, удача или провал
    if (c.scheme) { const k = p.inPlay.lastIndexOf(id); if (k >= 0) { p.inPlay.splice(k, 1); backToDeck(S, 'court', id); log(S, `   «${c.name}» уходит в колоду двора`, p.i, 'quiet'); } }
    const dg = p.gold - g0, dh = p.hand.length - h0;
    const temp = {}; for (const k of SYMS) if ((p.temp[k] || 0) > (t0[k] || 0)) temp[k] = p.temp[k] - (t0[k] || 0);
    const bits = [];
    if (dg > 0) { bits.push(`+${dg}🪙`); p.stats.cardGold += dg; }
    for (const k in temp) bits.push(`+${temp[k]}${D.SYM[k]} до конца хода`);
    if (dh > 0) bits.push(`взяли ${D.cards(dh)}`);
    if (bits.length) logAppend(S, entry, `: ${bits.join(', ')}`, p.i, 'play');
    emit(S, 'play', { p: p.i, id, ally: !!(ally && c.ally), big, gold: dg, cards: dh, temp });
    ritualEvent(S, p, 'play', (p.turn.played || []).length);
    ritualTick(S, p);
    emit(S, 'change');
    return true;
  }

  // ---------- бросок: 1 или 2 кубика, у всех с начала партии ----------
  async function roll(S, p, n) {
    if (p.turn.rolled || S.winner !== null || S.players[S.cur] !== p) return false;
    const m = mods(S, p);
    const oneOnly = cursed(p, 'evileye') || sinned(p, 'sloth') || faithBan(S, p, 'oneDie'); // проклятие «Сглаз», грех Лень или обет «Собора Единого»: только один кубик
    if (n !== 2 || oneOnly) n = 1;
    // чудо «Нашёптанная судьба»: сколько кубиков бросать, решил соперник (запреты на второй кубик сильнее)
    let forced = false;
    if (p.forceDice) { const fd = p.forceDice; p.forceDice = null; forced = true; n = fd.n === 2 && !oneOnly ? 2 : 1; log(S, `${nm(p)}: ${miracleName('dictateDice')} ${nmG(S.players[fd.by])} — бросают ${n === 2 ? 'два кубика' : 'один кубик'}`, p.i, 'dice'); }
    // предсказание до броска (старые карты)
    let guess = null;
    if (m.predict) { const g = await ask(S, p, { type: 'predict', n }); if (g >= 1 && g <= 12) guess = g; }
    let vals;
    if (m.peek && !oneOnly && !forced) {
      // Слепой Тобиас, добросок: первый кубик — и, увидев его, решить, бросать ли второй
      const v1 = rollVals(S, 1);
      emit(S, 'dice', { p: p.i, vals: v1, n: 1, peek: true });
      const more = await ask(S, p, { type: 'peek', v: v1[0] });
      if (more) { vals = [v1[0], rollVals(S, 1)[0]]; n = 2; } else { vals = v1; n = 1; }
      log(S, `${nm(p)}: добросок — ${n === 2 ? `к ${v1[0]} бросили второй кубик` : `остановились на одном кубике`}`, p.i, 'dice');
      emit(S, 'dice', { p: p.i, vals, n });
    } else {
      vals = rollVals(S, n);
      emit(S, 'dice', { p: p.i, vals, n });
    }
    // Альберих: бросок с преимуществом — второй бросок, выбрать любой
    if (m.advantage) {
      const v2 = rollVals(S, n);
      const ch = await ask(S, p, { type: 'advantage', a: vals.slice(), b: v2.slice(), n });
      log(S, `${nm(p)}: бросок с преимуществом — ${sum(vals)} или ${sum(v2)}`, p.i, 'dice');
      if (ch === 1) vals = v2;
      emit(S, 'dice', { p: p.i, vals, n });
    }
    let rerolls = (m.reroll || 0) + p.turn.rerolls;
    let ones = m.rerollOne || 0; // Око Провидца I: раз в ход перебросить один из кубиков
    const shCost = R.shiftCost || 0;
    let shifts = m.shift && p.gold >= shCost ? 1 : 0, delta = 0; // Гадатель: раз в ход за 2🪙 сдвинуть сумму на 1 (сдвиг — последнее решение по броску)
    let sets = m.setDie && !p.turn.setUsed ? 1 : 0, turned = -1; // чудо «Перст судьбы»: раз в ход повернуть кубик на любую грань; такой дубль не считается
    for (let guard = 0; guard < 20 && (rerolls > 0 || ones > 0 || shifts > 0 || sets > 0); guard++) {
      const total = sum(vals);
      const ch = await ask(S, p, { type: 'adjust', vals: vals.slice(), n, total, rerolls, ones, shifts, shiftCost: shCost, sets });
      if (ch && ch.a === 'set' && sets > 0 && ch.v >= 1 && ch.v <= 6) {
        const k = n === 2 && ch.k === 1 ? 1 : 0;
        sets--; p.turn.setUsed = true; turned = k; vals = vals.slice(); const was = vals[k]; vals[k] = ch.v;
        log(S, `${nm(p)}: ${miracleName('setDie')} — ${n === 2 ? (k ? 'второй кубик' : 'первый кубик') : 'кубик'} ${was} → ${ch.v}`, p.i, 'dice');
        emit(S, 'dice', { p: p.i, vals, n, re: k });
        continue;
      }
      if (ch && ch.a === 'reroll' && rerolls > 0) {
        rerolls--; vals = rollVals(S, n); turned = -1;
        log(S, `${nm(p)} перебросили кубики`, p.i, 'dice');
        emit(S, 'dice', { p: p.i, vals, n, re: 'all' }); // re — переброс: интерфейс снова подбрасывает кубики, даже если выпало то же
        continue;
      }
      if (ch && ch.a === 'one' && ones > 0) {
        const k = n === 2 && ch.k === 1 ? 1 : 0;
        ones--; vals = vals.slice(); const was = vals[k]; vals[k] = rollVals(S, 1)[0]; if (k === turned) turned = -1;
        log(S, `${nm(p)} перебросили ${n === 2 ? (k ? 'второй кубик' : 'первый кубик') : 'кубик'}: ${was} → ${vals[k]}`, p.i, 'dice');
        emit(S, 'dice', { p: p.i, vals, n, re: k });
        continue;
      }
      if (ch && ch.a === 'shift' && shifts > 0 && p.gold >= shCost && (ch.d === 1 || ch.d === -1) && total + ch.d >= 1 && total + ch.d <= 12) { shifts--; delta = ch.d; p.gold -= shCost; break; }
      break;
    }
    const total = sum(vals) + delta;
    p.turn.rolled = true;
    S.lastRoll = { p: p.i, vals, n, total, adj: delta };
    const dbl = n === 2 && vals[0] === vals[1] && turned < 0; // дубль от «Перста судьбы» не считается
    (p.turn.did = p.turn.did || {}).twoDice = n === 2;
    if (dbl) ritualEvent(S, p, 'double');
    if (m.extraTurn && dbl && !S.extraTaken) p.turn.extraTurn = true;
    if (m.doubleGold && dbl) { p.gold += m.doubleGold; log(S, `${nm(p)}: дубль — +${m.doubleGold}🪙`, p.i, 'gold'); }
    const lowRoll = m.lowRollGold && vals.includes(1) ? m.lowRollGold : 0;
    const vs = (n === 2 ? `${vals[0]}+${vals[1]} = ${sum(vals)}` : `${vals[0]}`) + (delta ? ` → ${total} (сдвиг ${delta > 0 ? '+1' : '−1'} за ${shCost}🪙: ${modSources(S, p, 'shift').join(', ') || 'Гадатель'})` : '');
    log(S, `🎲 ${nm(p)} выбросили ${vs}`, p.i, 'roll');
    emit(S, 'dice', { p: p.i, vals, n, total, adj: delta, final: true });
    if (lowRoll) { p.gold += lowRoll; log(S, `${nm(p)}: на кубике выпала 1 — +${lowRoll}🪙`, p.i, 'gold'); }
    if (m.doubleDraw && dbl) { const got = drawCards(S, p, m.doubleDraw); if (got) log(S, `${nm(p)}: дубль — взяли ${D.cards(got)}`, p.i, 'draw'); } // Око Провидца II
    if (guess != null) {
      if (guess === total) { p.gold += m.predict; log(S, `${nm(p)}: предсказание сбылось (${guess}) — +${m.predict}🪙`, p.i, 'gold'); }
      else log(S, `${nm(p)}: предсказали ${guess} — не сбылось`, p.i, 'quiet');
    }
    await resolveRoll(S, p, total);
    emit(S, 'change');
    return true;
  }

  // надбавка знамён к владениям провинции: «Ваши владения Севера приносят +1🪙»
  const provB = (m, d) => (d.p ? (m['provBonus_' + d.p] || 0) : 0);
  // пара: у вас есть ещё одно (не разрушенное) владение той же провинции
  const pairOn = (q, d) => !!(d.pair && d.p && q.estates.filter(e => !e.ruined && ES(e).p === d.p).length >= 2);
  function estateIncome(S, q, d, m) {
    const est = (f) => q.estates.filter(e => !e.ruined && f(ES(e))).length;
    let v;
    if (d.perProv) v = d.perN * est(x => x.p === d.perProv);
    else if (d.per === 'land') v = d.perN * est(x => x.t === 'land');
    else if (d.per === 'raid') v = d.perN * est(x => x.t === 'raid');
    else if (d.per === 'provS') v = d.perN * est(x => x.p === 'S');
    else if (d.per === 'prov') v = d.perN * new Set(q.estates.filter(e => !e.ruined).map(e => ES(e).p).filter(Boolean)).size;
    else if (d.per) v = d.perN * prod(S, q)[d.per];
    else v = d.inc;
    if (pairOn(q, d)) v += d.pair;
    v += provB(m, d);
    if (d.t === 'land') v += (m.blueBonus || 0);
    if (d.t === 'craft') v += (m.greenBonus || 0);
    return Math.max(0, v);
  }

  const SYMW = { trade: '⚖️', sci: '📜', war: '⚔️', int: '🔗', faith: '🕯' };
  function incomeParts(S, q, d, m, roller) {
    const est = (f) => q.estates.filter(e => !e.ruined && f(ES(e))).length;
    const parts = [];
    let base, lab = '';
    if (d.perProv) { const n = est(x => x.p === d.perProv); base = d.perN * n; lab = `${d.perN}×${n} ${D.PROV[d.perProv].gen}`; }
    else if (d.per === 'land') { const n = est(x => x.t === 'land'); base = d.perN * n; lab = `${d.perN}×${n} 🟦`; }
    else if (d.per === 'raid') { const n = est(x => x.t === 'raid'); base = d.perN * n; lab = `${d.perN}×${n} 🟥`; }
    else if (d.per === 'provS') { const n = est(x => x.p === 'S'); base = d.perN * n; lab = `${d.perN}×${n} Юга`; }
    else if (d.per === 'prov') { const n = new Set(q.estates.filter(e => !e.ruined).map(e => ES(e).p).filter(Boolean)).size; base = d.perN * n; lab = `${d.perN}×${n} провинций`; }
    else if (d.per) { const n = prod(S, q)[d.per]; base = d.perN * n; lab = `${d.perN}×${n}${SYMW[d.per] || ''}`; }
    else base = d.inc;
    parts.push({ v: base, l: lab });
    if (pairOn(q, d)) parts.push({ v: d.pair, l: 'пара' });
    const src = (key) => { for (const x of modParts(S, q, key)) parts.push({ v: x.v, l: x.name }); };
    if (d.p) src('provBonus_' + d.p);
    if (d.t === 'land') src('blueBonus');
    if (d.t === 'craft') src('greenBonus');
    if (d.t === 'land' && roller && q !== roller && m.landOthers) src('landOthers');
    if (d.t === 'land' && roller && q === roller && m.landOwn) src('landOwn');
    const tot = parts.reduce((a, x) => a + x.v, 0);
    if (tot < 0) parts.push({ v: -tot, l: 'не меньше 0' });
    return parts;
  }
  // Набег / Твердыня: из чего сложилось, сколько взяли (bonusKey — redBonus / holdBonus; shieldOf — у кого берут)
  function raidParts(S, o, d, bonusKey, victim, amt) {
    const parts = [{ v: d.inc, l: '' }];
    for (const x of modParts(S, o, bonusKey)) parts.push({ v: x.v, l: x.name });
    if (d.p) for (const x of modParts(S, o, 'provBonus_' + d.p)) parts.push({ v: x.v, l: x.name });
    if (victim) for (const x of modParts(S, victim, 'raidShield')) parts.push({ v: -x.v, l: x.name });
    const tot = parts.reduce((a, x) => a + x.v, 0);
    if (amt != null && amt < tot) parts.push({ v: amt - tot, l: amt === 0 ? 'брать нечего' : 'больше у них нет' });
    return parts;
  }
  // руины (захваченное владение): когда оно срабатывает по правилу своего цвета, оно отстраивается — вместо дохода
  function repair(S, q, e, ev) {
    e.ruined = false;
    ev.push({ to: q.i, amt: 0, src: ES(e).name, id: e.id, uid: e.uid, t: ES(e).t, repair: true });
    log(S, `   ${nm(q)} отстроили «${ES(e).name}»`, q.i, 'repair');
    unionBounty(S, q);
  }
  async function resolveRoll(S, a, r) {
    const N = S.players.length;
    const ev = [];
    for (let k = 1; k < N; k++) {
      const o = S.players[(a.i - k + N) % N];
      if (R.raidNeighbor && prevOf(S, o) !== a) continue; // набег — в ход любого другого игрока (старый вариант: только того, кто ходит перед владельцем)
      const m = mods(S, o), bandit = cursed(o, 'bandits'); // Разбойничий стан: Набеги и Твердыни не срабатывают
      for (const e of o.estates) {
        const d = ES(e);
        if (d.t !== 'raid' || !d.n.includes(r)) continue;
        if (bandit) { ev.push({ to: o.i, from: a.i, amt: 0, src: d.name, id: e.id, uid: e.uid, t: 'raid', zero: true, bandit: true }); continue; } // не срабатывает: ни дохода, ни отстройки
        for (let x = 0; x < (m.raidDouble ? 2 : 1); x++) { // чудо «Двойная добыча»: Набег срабатывает ещё раз
          const src = x ? `${d.name} · ещё раз` : d.name;
          if (e.ruined) { repair(S, o, e, ev); continue; }
          const amt = a.shield > 0 ? 0 : Math.min(Math.max(0, d.inc + (m.redBonus || 0) + provB(m, d) - (mods(S, a).raidShield || 0)), a.gold);
          if (amt > 0) { const parts = raidParts(S, o, d, 'redBonus', a, amt); a.gold -= amt; o.gold += amt; o.stats.raidInc += amt; ev.push({ to: o.i, from: a.i, amt, src, id: e.id, uid: e.uid, t: 'raid', parts }); }
          else ev.push({ to: o.i, from: a.i, amt: 0, src, id: e.id, uid: e.uid, t: 'raid', zero: true });
        }
      }
    }
    for (const q of S.players) {
      const m = mods(S, q);
      // проклятия: Неурожай — Земли молчат; Самозваный мытарь — доход Ремёсел уходит тому, кто подбросил
      const blight = cursed(q, 'blight'), taxE = q.estates.find(e => ES(e).bad === 'tax');
      const taxTo = taxE && taxE.by != null && S.players[taxE.by] && taxE.by !== q.i ? S.players[taxE.by] : null;
      for (const e of q.estates) {
        const d = ES(e);
        if (!d.n.includes(r)) continue;
        // Земля: в ход любого игрока (старый вариант: в свой ход и в ход того, кто ходит перед вами)
        if ((d.t === 'land' && (q === a || R.landNeighbor === false || prevOf(S, q) === a)) || (d.t === 'craft' && (q === a || m.craftAny))) { // Праздник Урожая II: Ремёсла и в чужой ход
          const times = (d.t === 'land' && m.landDouble) || (d.t === 'craft' && m.craftDouble) ? 2 : 1; // чудеса «Щедрая нива» и «Рог изобилия»: срабатывает ещё раз
          for (let x = 0; x < times; x++) {
            const src = x ? `${d.name} · ещё раз` : d.name;
            if (e.ruined) { repair(S, q, e, ev); continue; } // в руинах: первое срабатывание — ремонт, второе — уже доход
            if (blight && d.t === 'land') { ev.push({ to: q.i, amt: 0, src: d.name, id: e.id, uid: e.uid, t: d.t, zero: true, blight: true }); break; }
            let v = estateIncome(S, q, d, m);
            if (d.t === 'land' && q !== a && m.landOthers) v += m.landOthers; // на чужих бросках
            if (d.t === 'land' && q === a && m.landOwn) v += m.landOwn;       // на своём броске (Медовар)
            if (v > 0) {
              q.gold += v; q.stats.rollInc += v; ev.push({ to: q.i, amt: v, src, id: e.id, uid: e.uid, t: d.t, parts: incomeParts(S, q, d, m, a) });
              if (taxTo && d.t === 'craft') { q.gold -= v; q.stats.rollInc -= v; taxTo.gold += v; taxTo.stats.stolen += v; ev.push({ to: taxTo.i, from: q.i, amt: v, src: ES(taxE).name, id: taxE.id, uid: taxE.uid, t: 'bad' }); }
            }
          }
        }
      }
    }
    {
      const m = mods(S, a), bandit = cursed(a, 'bandits');
      if (m.redOwn) for (const e of a.estates) {
        const d = ES(e);
        if (d.t !== 'raid' || !d.n.includes(r)) continue;
        if (bandit) { ev.push({ to: a.i, amt: 0, src: d.name, id: e.id, uid: e.uid, t: 'raid', own: true, zero: true, bandit: true }); continue; }
        for (let x = 0; x < (m.raidDouble ? 2 : 1); x++) { // «Двойная добыча»: ещё раз
          if (e.ruined) { repair(S, a, e, ev); continue; }
          const v = d.inc + (m.redBonus || 0) + provB(m, d);
          a.gold += v; a.stats.raidInc += v; ev.push({ to: a.i, amt: v, src: x ? `${d.name} · ещё раз` : d.name, id: e.id, uid: e.uid, t: 'raid', own: true, parts: raidParts(S, a, d, 'redBonus', null, v) });
        }
      }
      for (const e of a.estates) {
        const d = ES(e);
        if (d.t !== 'hold' || !d.n.includes(r)) continue;
        if (bandit) { ev.push({ to: a.i, amt: 0, src: d.name, id: e.id, uid: e.uid, t: 'hold', zero: true, bandit: true }); continue; }
        if (e.ruined) { repair(S, a, e, ev); continue; }
        let left = d.cap || Infinity; // потолок за одно срабатывание (если задан)
        for (const o of rivals(S, a, o => o.gold > 0)) {
          const amt = o.shield > 0 ? 0 : Math.min(Math.max(0, d.inc + (m.holdBonus || 0) + provB(m, d) - (mods(S, o).raidShield || 0)), o.gold, left);
          if (amt > 0) { const parts = raidParts(S, a, d, 'holdBonus', o, amt); o.gold -= amt; a.gold += amt; a.stats.raidInc += amt; left -= amt; ev.push({ to: a.i, from: o.i, amt, src: d.name, id: e.id, uid: e.uid, t: 'hold', parts }); }
          else ev.push({ to: a.i, from: o.i, amt: 0, src: d.name, id: e.id, uid: e.uid, t: 'hold', zero: true });
        }
      }
    }
    // сводка в журнал: по строке на игрока — что получил и что отдал
    const paid = ev.filter(x => x.amt > 0);
    const fixed = ev.filter(x => x.repair);
    if (!paid.length) log(S, `   Ни одно владение не принесло золота`, null, 'quiet');
    for (let k = 0; k < N; k++) {
      const q = S.players[(a.i + k) % N];
      const gain = paid.filter(x => x.to === q.i), loss = paid.filter(x => x.from === q.i);
      if (!gain.length && !loss.length) continue;
      const parts = gain.map(x => `+${x.amt}🪙 ${x.src}${x.from != null ? ` (у ${shortG(S.players[x.from])})` : ''}`)
        .concat(loss.map(x => `−${x.amt}🪙 ${x.src}${x.to != null ? ' ' + shortG(S.players[x.to]) : ''}`));
      const net = sum(gain.map(x => x.amt)) - sum(loss.map(x => x.amt));
      log(S, `   ${nm(q)}: ${parts.join(', ')}${parts.length > 1 ? ` → итого ${net > 0 ? '+' : net < 0 ? '−' : ''}${Math.abs(net)}🪙` : ''}`, q.i, 'income');
    }
    emit(S, 'income', { r, ev: paid.concat(ev.filter(x => x.zero), fixed), a: a.i });
    ritualEvent(S, a, 'rollGold', paid.filter(x => x.to === a.i).reduce((t, x) => t + x.amt, 0));
    for (const q of S.players) {
      const rd = mods(S, q).raidDraw || 0;
      if (!rd) continue;
      const hits = paid.filter(x => x.to === q.i && x.t === 'raid').length;
      if (hits) { const got = drawCards(S, q, rd * hits); if (got) log(S, `   ${nm(q)}: сработал Набег — взяли ${D.cards(got)}`, q.i, 'draw'); }
    }
    // ручной сбор монет: интерфейс ждёт, пока игроки за этим устройством заберут золото со своих карт
    if (HOOKS.collect && !S.sim && paid.length) await HOOKS.collect(S, { kind: 'roll', r, ev: paid, a: a.i });
    for (let k = 0; k < N; k++) {
      const q = S.players[(a.i + k) % N];
      const trig = q.plots.filter(pl => pl.kind === 'dice' && pl.nums && pl.nums.includes(r));
      for (const pl of trig) {
        q.plots.splice(q.plots.indexOf(pl), 1);
        await resolvePlot(S, q, pl, a);
      }
    }
  }


  // предпросмотр броска (v10.17): кто сколько получит и отдаст, если у игрока a выпадет r — партия не меняется.
  // Повторяет resolveRoll: Набеги соперников, Земли и Ремёсла всех, свои Набеги (Змеи) и Твердыни; руины — ремонт вместо дохода.
  // Замыслы на числе и золото за союз после ремонта руин (модуль «Союзы») не считаются. Возвращает [{ i, gain, loss }] по игрокам
  function rollPreview(S, a, r) {
    const N = S.players.length, gold = S.players.map(q => q.gold), out = S.players.map(q => ({ i: q.i, gain: 0, loss: 0 }));
    const move = (from, to, v) => { if (!(v > 0)) return; if (from != null) { gold[from] -= v; out[from].loss += v; } gold[to] += v; out[to].gain += v; };
    const ruined = new Set(); for (const q of S.players) for (const e of q.estates) if (e.ruined) ruined.add(e.uid);
    const fix = (e) => { if (!ruined.has(e.uid)) return false; ruined.delete(e.uid); return true; }; // руины: это срабатывание уходит на ремонт
    for (let k = 1; k < N; k++) {
      const o = S.players[(a.i - k + N) % N];
      if (R.raidNeighbor && prevOf(S, o) !== a) continue;
      const m = mods(S, o);
      if (cursed(o, 'bandits')) continue;
      for (const e of o.estates) {
        const d = ES(e);
        if (d.t !== 'raid' || !d.n.includes(r)) continue;
        for (let x = 0; x < (m.raidDouble ? 2 : 1); x++) {
          if (fix(e)) continue;
          move(a.i, o.i, a.shield > 0 ? 0 : Math.min(Math.max(0, d.inc + (m.redBonus || 0) + provB(m, d) - (mods(S, a).raidShield || 0)), gold[a.i]));
        }
      }
    }
    for (const q of S.players) {
      const m = mods(S, q), blight = cursed(q, 'blight'), taxE = q.estates.find(e => ES(e).bad === 'tax');
      const taxTo = taxE && taxE.by != null && S.players[taxE.by] && taxE.by !== q.i ? S.players[taxE.by] : null;
      for (const e of q.estates) {
        const d = ES(e);
        if (!d.n.includes(r)) continue;
        if (!((d.t === 'land' && (q === a || R.landNeighbor === false || prevOf(S, q) === a)) || (d.t === 'craft' && (q === a || m.craftAny)))) continue;
        const times = (d.t === 'land' && m.landDouble) || (d.t === 'craft' && m.craftDouble) ? 2 : 1;
        for (let x = 0; x < times; x++) {
          if (fix(e)) continue;
          if (blight && d.t === 'land') break;
          let v = estateIncome(S, q, d, m);
          if (d.t === 'land' && q !== a && m.landOthers) v += m.landOthers;
          if (d.t === 'land' && q === a && m.landOwn) v += m.landOwn;
          if (v > 0) move(null, taxTo && d.t === 'craft' ? taxTo.i : q.i, v); // Самозваный мытарь: доход Ремёсел — подбросившему
        }
      }
    }
    const m = mods(S, a), bandit = cursed(a, 'bandits');
    if (!bandit) for (const e of a.estates) {
      const d = ES(e);
      if (!d.n.includes(r)) continue;
      if (d.t === 'raid' && m.redOwn) for (let x = 0; x < (m.raidDouble ? 2 : 1); x++) { if (fix(e)) continue; move(null, a.i, d.inc + (m.redBonus || 0) + provB(m, d)); }
      if (d.t === 'hold') {
        if (fix(e)) continue;
        let left = d.cap || Infinity;
        const pool = R.oneRival === false ? opps(S, a).filter(o => gold[o.i] > 0) : (() => { let best = null; for (let k = 1; k < N; k++) { const o = S.players[(a.i + k) % N]; if (gold[o.i] > 0 && (!best || gold[o.i] > gold[best.i])) best = o; } return best ? [best] : []; })();
        for (const o of pool) { const amt = o.shield > 0 ? 0 : Math.min(Math.max(0, d.inc + (m.holdBonus || 0) + provB(m, d) - (mods(S, o).raidShield || 0)), gold[o.i], left); move(o.i, a.i, amt); left -= Math.max(0, amt); }
      }
    }
    return out;
  }

  // ---------- рынок ----------
  function marketPrice(S, p, base, court = false) {
    const m = mods(S, p);
    // общее правило: скидки складываются, но цена на рынке не бывает ниже 1🪙
    const torg = R.tradeStep ? Math.floor(sym(S, p, 'trade') / R.tradeStep) : 0; // ⚖️ Торг
    if (base <= 0) return 0; // грех (v10.15) стоит 0🪙 — только действие
    return Math.max(1, base - (m.marketDiscount || 0) - torg - (court ? (m.courtCheap || 0) : 0) - p.turn.discount);
  }
  const buysLeft = (S, p) => 1 + p.turn.buys + (mods(S, p).buys || 0) - p.turn.buysUsed;
  // второе действие: раз в ход можно заплатить R.extraAction🪙 в банк и сделать ещё одно действие
  // R.extraBehind: второе действие — только тому, у кого знамён меньше, чем у лидера
  const behindLeader = (S, p) => regCount(p) < Math.max(...S.players.map(regCount));
  // чудо «Благодать» (ритуал «Освящение собора»): второе действие за 3🪙 — в любой партии
  const extraOn = (S, p) => (!!R.extraAction && (!R.extraActionNeeds || on(S, R.extraActionNeeds))) || !!(p && mods(S, p).cheapAction);
  const extraCost = (S, p) => (p && mods(S, p).cheapAction ? (R.miracleAction || 3) : R.extraAction);
  const canBuyAction = (S, p) => extraOn(S, p) && S.players[S.cur] === p && p.turn.rolled && !p.turn.extraBought && p.gold >= extraCost(S, p) && S.winner === null && (!R.extraBehind || behindLeader(S, p));
  function buyAction(S, p) {
    if (!extraOn(S, p)) return { ok: false, why: 'В этой партии второго действия нет' };
    const X = extraCost(S, p);
    if (S.players[S.cur] !== p) return { ok: false, why: 'Сейчас не ваш ход' };
    if (!p.turn.rolled) return { ok: false, why: 'Сначала бросьте кубики' };
    if (p.turn.extraBought) return { ok: false, why: 'Второе действие за ход — только одно' };
    if (R.extraBehind && !behindLeader(S, p)) return { ok: false, why: 'Второе действие — только у того, кто отстаёт по знамёнам' };
    if (p.gold < X) return { ok: false, why: `Нужно ${X}🪙` };
    p.gold -= X; p.turn.extraBought = true;
    if (R.extraMarketOnly) p.turn.extraBuy = (p.turn.extraBuy || 0) + 1; else p.turn.buys++;
    log(S, `${nm(p)} заплатили ${X}🪙 за ${R.extraMarketOnly ? 'ещё одну покупку' : 'второе действие'}${X !== R.extraAction ? ` — ${miracleName('cheapAction')}` : ''}`, p.i, 'buy');
    emit(S, 'change');
    return { ok: true };
  }
  // обет веры запрещает покупку: Набеги, Земли, Твердыни
  function oathBuy(S, p, src, id) {
    if (src === 'court') return null;
    const d = D.ESTATES[id]; if (!d) return null;
    const f = faithBan(S, p, 'no_' + d.t);
    return f ? `Обет «${D.FAITHS[f].name}»: ${D.FAITHS[f].oathText.replace(/\.$/, '').replace(/^./, (x) => x.toLowerCase())}` : null;
  }
  // обет запрещает разыграть карту (Братство Клинка — карты Шпионов)
  function oathPlay(S, p, id) {
    const c = D.COURT[id];
    if (c && c.faith && !faithActive(S, p)) return 'Проклятая реликвия: пока она у вас, карты веры не действуют';
    if (c && c.role === 'spy') { const f = faithBan(S, p, 'no_role_spy'); if (f) return `Обет «${D.FAITHS[f].name}»: карты Шпионов играть нельзя`; }
    return null;
  }
  // «Ярмарка» — покупка на рынке без траты действия (свойства лордов и карт). Возвращает вид или null
  // какую «Ярмарку» владения потратит эта покупка: сначала узкую (Земля, Набег), потом общую — так они складываются
  function estFairSlot(S, p, def) {
    const m = mods(S, p), t = p.turn || {};
    if (def.t === 'land' && (m.freeLandBuy || 0) > 0 && !t.freeLandUsed) return 'freeLandUsed';
    if (def.t === 'raid' && (m.freeRaidBuy || 0) > 0 && !t.freeRaidUsed) return 'freeRaidUsed';
    if ((m.freeEstateBuy || 0) > 0 && !t.freeEstUsed) return 'freeEstUsed';
    return null;
  }
  function fairOf(S, p, src, id) {
    const isEstate = src !== 'court';
    const def = isEstate ? D.ESTATES[id] : D.COURT[id];
    if (!def || !p.turn) return null;
    const m = mods(S, p), fm = fairLimit(S, p);
    if (src === 'court' && ((p.turn.courtBought || 0) < (R.freeCourt || 0) || (R.courtPair && p.turn.courtPaid && !p.turn.courtBought))) return 'pair';
    if (fm > 0 && !p.turn.cheapUsed && def.cost <= fm && (src === 'court' || !m.fairCourt)) return 'cheap';
    if (src === 'basic' && !def.fixed && (m.freeBasic || 0) > 0 && !p.turn.basicUsed) return 'basic';
    if (src === 'court' && (p.turn.fairCourt || 0) > 0) return 'turn';
    if (src === 'court' && (m.freeCourtBuy || 0) > 0 && !p.turn.freeCourtUsed) return 'court';
    if (isEstate && estFairSlot(S, p, def)) return 'estate';
    if ((m.fairAny || 0) > 0 && !p.turn.fairAnyUsed && !def.sin) return 'any'; // чудо «Вечная ярмарка»
    return null;
  }
  // твердыни: у игрока каждый вид — один (сколько всего — не ограничено)
  const holdsOf = (p) => p.estates.filter(e => D.ESTATES[e.id].t === 'hold');
  const canOwnEstate = (p, id) => !(D.ESTATES[id].t === 'hold' && p.estates.some(e => e.id === id));
  // запас базовых владений «всегда в продаже» (R.basicStock); сейчас таких нет — все владения в колоде рынка
  const BASIC_IDS = Object.keys(D.ESTATES).filter(id => D.ESTATES[id].basic);
  const basicLeft = (S, id) => {
    const st = R.basicStock && R.basicStock[id];
    if (st == null) return Infinity;
    let n = 0; for (const q of S.players) for (const e of q.estates) if (e.id === id) n++;
    return Math.max(0, st - n);
  };

  async function buy(S, p, src, key) {
    if (S.winner !== null || S.players[S.cur] !== p) return { ok: false, why: 'Сейчас не ваш ход' };
    if (!p.turn.rolled) return { ok: false, why: 'Сначала бросьте кубики' };
    // чудо «Ясновидение»: верхняя карта колоды владений или двора — как ещё одна карта ряда
    const top = src === 'estateTop' || src === 'courtTop';
    if (top) { if (!mods(S, p).deckTop) return { ok: false, why: 'Верхнюю карту колоды покупает только тот, у кого «Ясновидение»' }; src = src === 'estateTop' ? 'estate' : 'court'; }
    let id = null;
    if (top) id = deckTopOf(src === 'estate' ? S.estateDeck : S.courtDeck);
    else if (src === 'basic') id = D.ESTATES[key] && D.ESTATES[key].basic && cardOn(S, 'estate', key) ? key : null;
    else if (src === 'estate') id = S.estateRow[key];
    else if (src === 'court') id = S.courtRow[key];
    else if (src === 'hold') id = (S.holdRow || [])[key];
    if (!id) return { ok: false, why: 'Карты нет' };
    if (src === 'basic' && basicLeft(S, id) <= 0) return { ok: false, why: 'Эти владения кончились' };
    if (src !== 'court' && cursed(p, 'quarantine')) return { ok: false, why: 'Чумная слобода: пока она у вас, владения покупать нельзя' };
    if (src === 'court' && isCursed(p, 'slander')) return { ok: false, why: 'Клевета: в этот ход карты двора покупать нельзя' };
    const isEstate = src !== 'court';
    const def = isEstate ? D.ESTATES[id] : D.COURT[id];
    if (isEstate && !canOwnEstate(p, id)) return { ok: false, why: 'Такая Твердыня у вас уже есть' };
    { const ob = oathBuy(S, p, src, id); if (ob) return { ok: false, why: ob }; }
    const price = marketPrice(S, p, def.cost, !isEstate);
    const fm = fairLimit(S, p);
    const sinBuy = !isEstate && !!def.sin; // грех — только действием: без Ярмарки и бесплатных покупок
    const freeC = !sinBuy && src === 'court' && ((p.turn.courtBought || 0) < (R.freeCourt || 0) || (R.courtPair && p.turn.courtPaid && !p.turn.courtBought));
    const freeX = !sinBuy && !freeC && fm > 0 && !p.turn.cheapUsed && def.cost <= fm && (src === 'court' || !mods(S, p).fairCourt); // «Ярмарка» Оленей — по напечатанной цене
    const freeB = !freeC && !freeX && src === 'basic' && !def.fixed && (mods(S, p).freeBasic || 0) > 0 && !p.turn.basicUsed;
    // «Ярмарка» с карты двора (Оруженосец, Шептун, Послушник): на этот ход, тратится первой
    const freeT = !sinBuy && !freeC && !freeX && !freeB && src === 'court' && (p.turn.fairCourt || 0) > 0;
    // лорды: Мартин Скупой — карта двора без действия, Леопольд Миротворец — владение без действия (раз в ход)
    const freeL = !sinBuy && !freeC && !freeX && !freeB && !freeT && src === 'court' && (mods(S, p).freeCourtBuy || 0) > 0 && !p.turn.freeCourtUsed;
    const estSlot = isEstate ? estFairSlot(S, p, def) : null;
    const freeE = !freeC && !freeX && !freeB && isEstate && !!estSlot; // Элинор — любое владение, Колос II — Земля, Робер — Набег
    const freeA = !sinBuy && !freeC && !freeX && !freeB && !freeT && !freeL && !freeE && (mods(S, p).fairAny || 0) > 0 && !p.turn.fairAnyUsed; // чудо «Вечная ярмарка»
    const freeP = !freeC && !freeX && !freeB && !freeT && !freeL && !freeE && !freeA && buysLeft(S, p) <= 0 && (p.turn.extraBuy || 0) > 0; // оплаченная «ещё покупка»
    if (!freeC && !freeX && !freeB && !freeT && !freeL && !freeE && !freeA && !freeP && buysLeft(S, p) <= 0) return { ok: false, why: 'Действия на этот ход закончились' };
    if (p.gold < price) return { ok: false, why: `Нужно ${price}🪙` };
    p.gold -= price; p.turn.discount = 0;
    if (freeC) p.turn.courtBought = (p.turn.courtBought || 0) + 1;
    else if (freeX) p.turn.cheapUsed = true;
    else if (freeB) p.turn.basicUsed = true;
    else if (freeT) p.turn.fairCourt--;
    else if (freeP) p.turn.extraBuy--;
    // бесплатную покупку лорда тратим, только когда действия кончились — так игрок не теряет её зря
    else if (freeL && buysLeft(S, p) <= 0) p.turn.freeCourtUsed = true;
    else if (freeE && buysLeft(S, p) <= 0) p.turn[estSlot] = true;
    else if (freeL && !p.turn.freeCourtUsed) p.turn.freeCourtUsed = true;
    else if (freeE && !p.turn[estSlot]) p.turn[estSlot] = true;
    else if (freeA) p.turn.fairAnyUsed = true;
    else { p.turn.buysUsed++; if (src === 'court') p.turn.courtPaid = true; p.turn.lastFair = false; }
    if (freeC || freeX || freeB || freeT || freeL || freeE || freeA) p.turn.lastFair = true;
    if (def.bad || def.sin) { /* проклятие — сразу подбрасывают сопернику; грех — ложится перед покупателем (takeSin ниже) */ }
    else if (isEstate) { p.estates.push({ uid: S.uid++, id }); unionBounty(S, p); const lb = def.t === 'land' ? Math.min(mods(S, p).landBuyGold || 0, Math.max(0, price - 1)) : 0; /* как скидка: Земля не дешевле 1🪙 */ if (lb) { p.gold += lb; log(S, `   ${nm(p)}: Лесничий возвращает ${lb}🪙 за новую Землю`, p.i, 'gold'); } } else if (freeT) p.discard.push(id); /* «Ярмарка» с карты двора: купленное — в сброс */ else if (mods(S, p).courtToHand) p.hand.push(id); else if (R.courtToTop) p.deck.push(id); else p.discard.push(id);
    if (top) (src === 'estate' ? S.estateDeck : S.courtDeck).pop();
    else {
      if (src === 'estate') S.estateRow.splice(key, 1);
      if (src === 'court') S.courtRow.splice(key, 1);
      if (src === 'hold') S.holdRow.splice(key, 1);
      if (src === 'estate' || src === 'court' || src === 'hold') (S.rowHired = S.rowHired || {})[src] = true;
    }
    // «Пошлина»: соперник с этим свойством получает из банка за каждую вашу покупку на рынке
    for (const o of opps(S, p)) { const t = mods(S, o).buyToll; if (t) { o.gold += t; log(S, `${modSources(S, o, 'buyToll').join(', ') || 'Пошлина'}: ${nm(o)} получили ${t}🪙 из банка за покупку ${nmG(p)}`, o.i, 'gold'); } }
    S.lastBought = id;
    refill(S);
    log(S, `${nm(p)} купили ${isEstate ? (def.bad ? 'проклятие' : 'владение') : def.sin ? 'грех' : 'карту двора'} «${def.name}» за ${price}🪙${top ? ' — верхнюю карту колоды, Ясновидение' : ''}${p.turn.lastFair ? ' — Ярмарка, действие не тратится' : ''}`, p.i, 'buy');
    { const did = p.turn.did = p.turn.did || {}; did.market = true; if (isEstate) did.buyEstate = true; }
    ritualEvent(S, p, 'buy'); if (isEstate && def.t === 'land') ritualEvent(S, p, 'buyLand'); if (!isEstate) ritualEvent(S, p, 'buyCourt');
    emit(S, 'buy', { p: p.i, id, estate: isEstate, price, top });
    if (isEstate && def.bad) await doPlantEstate(S, p, id);
    else if (def.sin) await takeSin(S, p, id);
    ritualTick(S, p);
    emit(S, 'change');
    return { ok: true };
  }

  // ---------- знамёна: вассалы, лорды, великие лорды ----------
  // цена = напечатанная − скидка за значки направления (не больше R.discCap) + надбавки ваших знамён − способности; не меньше 1🪙
  function banCost(S, p, id) {
    const b = D.BAN[id];
    if (!b) return { total: Infinity, ok: false };
    const m = mods(S, p);
    const disc = Math.min(R.discCap[b.tier] || 0, Math.max(0, sym(S, p, b.dir)));
    let tax = 0;
    for (const x of allBans(p)) { const t = D.BAN[x].tax; if (t && t[b.tier]) tax += t[b.tier]; }
    const cheap = (m.regCheap || 0) + (b.tier === 'v' ? (m.vasCheap || 0) : b.tier === 'l' ? (m.lordCheap || 0) : (m.greatCheap || 0)) + (p.turn ? p.turn.regDiscount : 0);
    const base = R.costScale ? Math.round(b.cost * (R.costScale[b.tier] || 1)) : b.cost; // costScale — только для подбора цен в лаборатории
    const total = Math.max(1, base - disc + tax - cheap);
    return { total, base, disc, tax, cheap, ok: true };
  }
  // можно ли нанять (без учёта золота): модуль, ряд или Наследник, свободное место в цели, запреты веры
  function hireBlock(S, p, id) {
    const b = D.BAN[id];
    if (!b || !cardOn(S, 'ban', id)) return 'Это знамя в этой партии выключено';
    if (cursed(p, 'schemer')) return 'Заговор: пока он у вас, нанимать знамёна нельзя';
    if (isCursed(p, 'lock')) return 'Куртизанка: в этот ход нанимать знамёна нельзя';
    const inRow = b.heir ? p.heir === id : rowOf(S, b.tier).includes(id) || (!!mods(S, p).deckTop && deckTopOf(deckOf(S, b.tier)) === id); // «Ясновидение»: и верх колоды
    if (!inRow) return b.heir ? 'Наследник уже на службе' : 'Этого знамени нет в ряду';
    if (tierList(p, b.tier).length >= needOf(S, b.tier)) return `У вас уже ${needOf(S, b.tier)} — больше не нужно`;
    const fb = faithBan(S, p, 'hire_' + b.dir);
    if (fb && b.tier !== 'g') return `Вера «${D.FAITHS[fb].name}» запрещает нанимать знамёна направления «${D.DIRS[b.dir].name}»`;
    return null;
  }
  // запрет веры: возвращает id веры, которая запрещает действие, или null
  const oathFree = (p) => allBans(p).some(id => (D.BAN[id].mods || {}).oathFree); // Блюститель Обетов: обеты на вас не действуют
  function faithBan(S, p, what) {
    if (oathFree(p)) return null;
    for (const f of faithsOf(S, p)) { const bn = D.FAITHS[f].oath; if (bn === what || (bn === 'peace' && (what === 'attack' || what === 'spy'))) return f; }
    return null;
  }
  const hireFree = (S, p) => !!R.splitActions && !p.turn.hireUsed; // свой найм за ход, отдельно от покупки
  async function hire(S, p, id) {
    if (S.winner !== null || S.players[S.cur] !== p) return { ok: false, why: 'Сейчас не ваш ход' };
    if (!p.turn.rolled) return { ok: false, why: 'Сначала бросьте кубики' };
    // догоняющий наём отстающему тратится первым: обычное действие остаётся на покупку или другое знамя
    const catchupH = !hireFree(S, p) && (p.turn.catchupHire || 0) > 0 && !!D.BAN[id] && (!R.catchupTier || D.BAN[id].tier === R.catchupTier);
    if (!hireFree(S, p) && !catchupH && buysLeft(S, p) <= 0) return { ok: false, why: R.splitActions ? 'Знамя в этот ход уже нанято' : 'Действия на этот ход закончились' };
    const why = hireBlock(S, p, id);
    if (why) return { ok: false, why };
    const b = D.BAN[id], c = banCost(S, p, id);
    if (p.gold < c.total) return { ok: false, why: `Нужно ${c.total}🪙` };
    p.gold -= c.total; p.turn.built = true; if (hireFree(S, p)) p.turn.hireUsed = true; else if (catchupH) { p.turn.catchupHire--; p.catchupSpent = (p.catchupSpent || 0) + 1; } else p.turn.buysUsed++; p.turn.regDiscount = 0;
    tierList(p, b.tier).push(id);
    let fromTop = false;
    if (b.heir) p.heir = null;
    else if (rowOf(S, b.tier).includes(id)) { const row = rowOf(S, b.tier); row.splice(row.indexOf(id), 1); (S.rowHired = S.rowHired || {})[b.tier] = true; refill(S); }
    else { const dk = deckOf(S, b.tier); if (deckTopOf(dk) === id) { dk.pop(); fromTop = true; } }
    const what = b.tier === 'v' ? 'вассала' : b.tier === 'l' ? (b.heir ? 'Наследника' : 'лорда') : 'великого лорда';
    log(S, `🚩 ${nm(p)} наняли ${what} «${D.regName(b)}» за ${c.total}🪙${fromTop ? ' — верхнюю карту колоды, Ясновидение' : ''}${catchupH ? ' (догоняющий наём, без действия)' : ''}. Знамён: ${regCount(p)} из ${goal(S)}`, p.i, 'regalia');
    (p.turn.did = p.turn.did || {}).hire = true;
    ritualEvent(S, p, 'hire'); if (b.tier !== 'v') ritualEvent(S, p, 'hireLord');
    if (b.take) { await applyFx(S, p, b.take, {}); log(S, `${nm(p)}: награда «${b.name}» при найме`, p.i, 'gold'); }
    { const rg = mods(S, p).regGold || 0; if (rg) { p.gold += rg; log(S, `   ${nm(p)}: ${modSources(S, p, 'regGold').join(', ') || 'новое знамя'} — +${rg}🪙 за новое знамя`, p.i, 'gold'); } }
    for (const o of opps(S, p)) { const v = mods(S, o).oppRegGold || 0; if (v) { o.gold += v; log(S, `   ${nm(o)}: ${modSources(S, o, 'oppRegGold').join(', ') || 'соперник нанял знамя'} — +${v}🪙 за знамя ${nmG(p)}`, o.i, 'gold'); } }
    envyHire(S, p);
    ritualTick(S, p);
    checkGoal(S, p);
    emit(S, 'change');
    emit(S, 'regalia', { p: p.i, id, tier: b.tier, cost: c.total });
    return { ok: true };
  }
  // грех Зависть: соперник нанял знамя — завистник отдаёт 1🪙 в банк
  function envyHire(S, p) {
    for (const o of opps(S, p)) if (sinned(o, 'envy') && o.gold > 0) { o.gold -= 1; log(S, `   ${nm(o)}: Зависть — −1🪙, ${nm(p)} наняли знамя`, o.i, 'sin'); }
  }
  // найм без цены и без действия (Гордыня, призыв семи грехов): из ряда, как обычный найм — с наградой знамени и свойствами «за новое знамя»
  async function freeHire(S, p, id, why) {
    const b = D.BAN[id];
    tierList(p, b.tier).push(id);
    { const row = rowOf(S, b.tier); const k = row.indexOf(id); if (k >= 0) row.splice(k, 1); (S.rowHired = S.rowHired || {})[b.tier] = true; refill(S); }
    const what = b.tier === 'v' ? 'вассала' : b.tier === 'l' ? 'лорда' : 'великого лорда';
    log(S, `🚩 ${nm(p)}: ${why} — ${what} «${D.regName(b)}» бесплатно и без действия. Знамён: ${regCount(p)} из ${goal(S)}`, p.i, 'regalia');
    if (p.turn) (p.turn.did = p.turn.did || {}).hire = true;
    ritualEvent(S, p, 'hire'); if (b.tier !== 'v') ritualEvent(S, p, 'hireLord');
    if (b.take) { await applyFx(S, p, b.take, {}); log(S, `${nm(p)}: награда «${b.name}» при найме`, p.i, 'gold'); }
    { const rg = mods(S, p).regGold || 0; if (rg) { p.gold += rg; log(S, `   ${nm(p)}: ${modSources(S, p, 'regGold').join(', ') || 'новое знамя'} — +${rg}🪙 за новое знамя`, p.i, 'gold'); } }
    for (const o of opps(S, p)) { const v = mods(S, o).oppRegGold || 0; if (v) { o.gold += v; log(S, `   ${nm(o)}: ${modSources(S, o, 'oppRegGold').join(', ') || 'соперник нанял знамя'} — +${v}🪙 за знамя ${nmG(p)}`, o.i, 'gold'); } }
    envyHire(S, p);
    checkGoal(S, p);
    emit(S, 'regalia', { p: p.i, id, tier: b.tier, cost: 0 });
    emit(S, 'change');
  }

  // ---------- грехи и покаяние (v10.15, модуль «Вера») ----------
  // купили грех — он ложится перед игроком, «Сейчас» срабатывает тут же; новый грех срывает покаяние; все семь — призыв
  async function takeSin(S, p, id) {
    const c = D.COURT[id];
    (p.sins = p.sins || []).push(id);
    log(S, `😈 ${nm(p)} взяли грех «${c.name}»: ${c.pen}`, p.i, 'sin');
    if (p.ritual) burnRitual(S, p, 'новый грех');
    emit(S, 'sin', { p: p.i, id });
    if (p.penance) { p.penance = null; p.penanceFail = S.turnNo; log(S, `🕯 Покаяние ${nmG(p)} сорвано: новый грех`, p.i, 'fail'); emit(S, 'penance', { p: p.i, fail: true }); }
    await sinNow(S, p, c.sin);
    if (S.winner === null && sinCount(p) >= 7 && !p.summoned) await summon(S, p);
    emit(S, 'change');
  }
  async function sinNow(S, p, key) {
    if (key === 'pride') { // Гордыня: любой вассал или лорд из ряда — бесплатно и без действия
      const opts = [...(rowOf(S, 'v') || []), ...(rowOf(S, 'l') || [])].filter(id => !hireBlock(S, p, id));
      if (!opts.length) { log(S, `   Гордыня: нанять некого`, p.i, 'quiet'); return; }
      const ch = await ask(S, p, { type: 'sinHire', options: opts });
      await freeHire(S, p, opts.includes(ch) ? ch : opts[0], 'Гордыня');
    } else if (key === 'greed') { // Алчность: удвоить золото
      const g = p.gold; p.gold += g;
      log(S, `   Алчность: золото удвоено — +${g}🪙`, p.i, 'gold');
    } else if (key === 'wrath') { // Гнев: владение соперника до 6🪙 — без нападения, отбить нельзя, оно в руинах
      const max = R.wrathLoot || 6, os = opps(S, p).filter(o => capturable(S, o, p, max).length);
      if (!os.length) { log(S, `   Гнев: забрать нечего`, p.i, 'quiet'); return; }
      let t = os[0];
      if (os.length > 1) { const ti = await ask(S, p, { type: 'target', kind: 'wrath', options: os.map(o => ({ i: o.i, loot: capturable(S, o, p, max).length })) }); t = os.find(o => o.i === ti) || os[0]; }
      const el = capturable(S, t, p, max);
      const uid = await ask(S, p, { type: 'capture', from: t.i, options: el.map(e => e.uid), wrath: true });
      const e0 = el.find(e => e.uid === uid) || el[0];
      const e = moveEstate(S, t, p, e0.uid);
      if (e) { e.ruined = true; p.stats.captured++; t.stats.lost++; log(S, `   Гнев: «${ES(e).name}» ${nmG(t)} — теперь у ${nmG(p)}, в руинах`, p.i, 'steal'); emit(S, 'capture', { a: p.i, t: t.i, id: e.id, wrath: true }); }
    } else if (key === 'envy') { // Зависть: любое знамя лидера — ваше, даже великий лорд (из тех рядов, где вам ещё нужно)
      const top = Math.max(...opps(S, p).map(regCount));
      const opts = []; for (const o of opps(S, p)) if (regCount(o) === top) for (const t of TIERS) if (tierList(p, t).length < needOf(S, t)) for (const id of tierList(o, t)) opts.push({ i: o.i, id });
      if (!opts.length) { log(S, `   Зависть: забрать нечего — у лидера нет знамён, которые вам нужны`, p.i, 'quiet'); return; }
      const ch = await ask(S, p, { type: 'sinBanner', options: opts });
      const o = (ch != null && opts[ch]) || opts[0], t = S.players[o.i], b = D.BAN[o.id];
      const from = tierList(t, b.tier); from.splice(from.indexOf(o.id), 1); tierList(p, b.tier).push(o.id);
      if (t.distracted && t.distracted.id === o.id) t.distracted = null;
      log(S, `   Зависть: ${b.tier === 'v' ? 'вассал' : b.tier === 'l' ? 'лорд' : 'великий лорд'} «${D.regName(b)}» ушёл от ${nmG(t)} к ${nmD(p)}`, p.i, 'steal');
      emit(S, 'poach', { a: p.i, t: t.i, id: o.id, envy: true });
      checkGoal(S, p);
    } else if (key === 'gluttony') { // Чревоугодие: 5 карт
      const got = drawCards(S, p, 5);
      log(S, `   Чревоугодие: взяли ${D.cards(got)}`, p.i, 'draw');
    } else if (key === 'sloth') { // Лень: после этого хода (и хода за дубль, если он будет) — ещё один полный ход
      p.slothNext = (p.slothNext || 0) + 1;
      log(S, `   Лень: после этого хода — ещё один`, p.i, 'extra');
    } else if (key === 'lust') { // Похоть: придворный соперника — к вашему двору
      const opts = on(S, 'seats') ? unseatOptions(S, p) : [];
      if (!opts.length) { log(S, `   Похоть: переманить некого`, p.i, 'quiet'); return; }
      const ch = await ask(S, p, { type: 'sinCourtier', options: opts });
      const o = (ch != null && opts[ch]) || opts[0], t = S.players[o.i];
      if (t.seats[o.k] !== o.id) return;
      t.seats.splice(o.k, 1); p.seats.push(o.id);
      log(S, `   Похоть: придворный «${D.COURT[o.id].name}» ушёл от ${nmG(t)} к двору ${nmG(p)}`, p.i, 'steal');
      emit(S, 'unseat', { a: p.i, t: t.i, id: o.id, lust: true });
      await trimSeats(S, t); await trimSeats(S, p);
    }
  }
  // все семь грехов (один раз за партию): до 7 знамён из рядов — бесплатно и без действия; цель выполнена — победа в конце круга, как обычно
  async function summon(S, p) {
    p.summoned = true;
    const n = R.sinSummon || 7;
    log(S, `😈 ${nm(p)} собрали все семь грехов — призыв: до ${D.banners(n)} бесплатно и без действия`, p.i, 'sin');
    emit(S, 'summon', { p: p.i });
    for (let k = 0; k < n && S.winner === null; k++) {
      const opts = [];
      for (const t of TIERS) for (const id of rowOf(S, t) || []) { const why = hireBlock(S, p, id); if (!why || /^(Заговор|Куртизанка)/.test(why)) opts.push(id); } // призыв — не наём: запреты на наём его не держат
      if (!opts.length) { log(S, `   Призыв: больше нанять некого`, p.i, 'quiet'); break; }
      const ch = await ask(S, p, { type: 'summon', options: opts, left: n - k });
      if (ch == null) break;
      await freeHire(S, p, opts.includes(ch) ? ch : opts[0], 'призыв семи грехов');
    }
  }
  // покаяние: начать — в свой ход до броска (шаг 1 — сразу); шаги 2–4 — в начале трёх следующих своих ходов; сорвалось — заново со следующего хода
  function penanceBlock(S, p) {
    if (S.winner !== null || S.players[S.cur] !== p) return 'Сейчас не ваш ход';
    if (!on(S, 'faith') || !faithsOf(S, p).length) return 'Каяться может только тот, кто принял веру';
    if (!faithActive(S, p)) return 'Проклятая реликвия: пока она у вас, каяться нельзя';
    if (!(p.sins || []).length) return 'Грехов нет — каяться не в чем';
    if (p.penance) return `Покаяние уже идёт: сделан шаг ${p.penance.step} из 4`;
    if (p.turn.rolled) return 'Начать покаяние можно только до броска';
    if (p.penanceFail === S.turnNo) return 'Покаяние сорвалось в этот ход — начать заново можно со следующего';
    return null;
  }
  async function startPenance(S, p) {
    const why = penanceBlock(S, p);
    if (why) return { ok: false, why };
    p.penance = { step: 0 };
    log(S, `🕯 ${nm(p)} начали покаяние: 4 хода подряд, по шагу`, p.i, 'faith');
    await penanceStep(S, p);
    emit(S, 'change');
    return { ok: true };
  }
  async function penanceStep(S, p) {
    const k = p.penance.step + 1;
    const fail = (why) => { p.penance = null; p.penanceFail = S.turnNo; log(S, `🕯 Покаяние ${nmG(p)} сорвано на шаге ${k}: ${why}. Начать заново можно со следующего хода`, p.i, 'fail'); emit(S, 'penance', { p: p.i, fail: true, step: k }); };
    if (k === 1) { // 5🪙 самому бедному сопернику
      const need = R.penanceGold || 5;
      if (p.gold < need) return fail(`нет ${need}🪙`);
      const min = Math.min(...opps(S, p).map(o => o.gold)), poor = opps(S, p).filter(o => o.gold === min);
      let t = poor[0];
      if (poor.length > 1) { const ti = await ask(S, p, { type: 'target', kind: 'penancePoor', options: poor.map(o => ({ i: o.i, gold: o.gold })) }); t = poor.find(o => o.i === ti) || poor[0]; }
      p.gold -= need; t.gold += need;
      log(S, `🕯 Покаяние, шаг 1 из 4: ${nm(p)} отдали ${need}🪙 ${nmD(t)} — самому бедному`, p.i, 'faith');
    } else if (k === 2) { // 2 карты из руки — из игры
      const need = R.penanceTrash || 2;
      if (p.hand.length < need) return fail(`в руке меньше ${D.cards(need)}`);
      let idx = await ask(S, p, { type: 'trash', max: need, need, each: 0, label: 'Покаяние, шаг 2' });
      idx = [...new Set((Array.isArray(idx) ? idx : []).filter(i => i >= 0 && i < p.hand.length))].slice(0, need);
      for (let i = 0; idx.length < need && i < p.hand.length; i++) if (!idx.includes(i)) idx.push(i);
      const gone = idx.sort((a, b) => b - a).map(i => p.hand.splice(i, 1)[0]);
      p.trashed.push(...gone);
      log(S, `🕯 Покаяние, шаг 2 из 4: ${nm(p)} убрали из игры ${gone.map(x => `«${D.COURT[x].name}»`).join(', ')}`, p.i, 'faith');
    } else if (k === 3) { // в этот ход на одно действие меньше
      p.turn.buys -= 1;
      log(S, `🕯 Покаяние, шаг 3 из 4: в этот ход у ${nmG(p)} на одно действие меньше`, p.i, 'faith');
    } else { // своё владение — из игры; потом снять грех
      const el = p.estates.filter(e => !ES(e).bad);
      if (!el.length) return fail('нет своего владения');
      const uid = await ask(S, p, { type: 'penanceEstate', options: el.map(e => e.uid) });
      const e = el.find(x => x.uid === uid) || el[0];
      p.estates.splice(p.estates.indexOf(e), 1); S.destroyed.push(e.id); p.stats.lost++;
      log(S, `🕯 Покаяние, шаг 4 из 4: «${ES(e).name}» ${nmG(p)} уходит из игры`, p.i, 'faith');
      const sins = (p.sins || []).slice();
      const ch = await ask(S, p, { type: 'penanceSin', options: sins });
      const id = sins.includes(ch) ? ch : sins[0];
      p.sins.splice(p.sins.indexOf(id), 1); backToDeck(S, 'court', id);
      p.penance = null;
      log(S, `🕯 Покаяние окончено: грех «${D.COURT[id].name}» снят и замешан в колоду двора`, p.i, 'faith');
      emit(S, 'penance', { p: p.i, done: true, id });
      return;
    }
    p.penance.step = k;
    emit(S, 'penance', { p: p.i, step: k });
  }

  // ---------- ритуалы (v10.16, модуль «Вера») ----------
  // у каждой веры по 2 ритуала (D.RITUALS); у игрока — текущий p.ritual { id, marks[5], cnt{}, abst } и готовые чудеса p.miracles
  // начать — в свой ход, без действия, в вере, без грехов и реликвии; грех сжигает отметки; все 5 отметок — чудо до конца игры
  const ritualOn = (S, id) => !!RIT[id] && on(S, 'faith') && cardOn(S, 'ritual', id);
  const ritualsFor = (S, f) => Object.keys(RIT).filter(id => RIT[id].faith === f && ritualOn(S, id));
  const ritualsOf = (S, p) => faithsOf(S, p).flatMap(f => ritualsFor(S, f));
  const deckTopOf = (d) => (d && d.length ? d[d.length - 1] : null);
  // одолженная карта («Чужими руками») лежит в руке, но она чужая: убрать из игры, в отставку, посадить, отложить — нельзя
  const borrowIdx = (p) => (p && p.borrow && !p.borrow.played ? p.hand.indexOf(p.borrow.id) : -1);
  const handFree = (p) => p.hand.map((_, k) => k).filter(k => k !== borrowIdx(p));
  // самый бедный соперник; при равенстве — на выбор игрока, как в покаянии
  async function pickPoor(S, p) {
    const min = Math.min(...opps(S, p).map(o => o.gold)), poor = opps(S, p).filter(o => o.gold === min);
    if (poor.length < 2) return poor[0];
    const ti = await ask(S, p, { type: 'target', kind: 'ritualPoor', options: poor.map(o => ({ i: o.i, gold: o.gold })) });
    return poor.find(o => o.i === ti) || poor[0];
  }
  function ritualBlock(S, p, id) {
    if (!on(S, 'faith')) return 'Модуль «Вера» выключен';
    if (S.winner !== null || S.players[S.cur] !== p) return 'Сейчас не ваш ход';
    const W = RIT[id];
    if (!W || !ritualOn(S, id)) return 'Этого ритуала нет в партии';
    if (!faithsOf(S, p).includes(W.faith)) return `Нужна вера «${D.FAITHS[W.faith].name}»`;
    if ((p.miracles || []).includes(id)) return 'Ритуал пройден — чудо уже ваше';
    if (p.ritual && p.ritual.id === id) return 'Этот ритуал уже идёт';
    if ((p.sins || []).length) return 'На вас грех — сначала покаяние';
    if (cursed(p, 'relic')) return 'Проклятая реликвия: вера не действует';
    return null;
  }
  async function startRitual(S, p, id) {
    const why = ritualBlock(S, p, id);
    if (why) return { ok: false, why };
    if (p.ritual) burnRitual(S, p, `начат ритуал «${RIT[id].name}»`);
    const W = RIT[id];
    p.ritual = { id, marks: W.steps.map(() => false), cnt: {}, abst: 0, t0: S.turnNo };
    log(S, `✨ ${nm(p)} начали ритуал «${W.name}» (${D.FAITHS[W.faith].name}): 5 условий в любом порядке, награда — чудо «${W.miracle.name}»`, p.i, 'faith');
    emit(S, 'ritual', { p: p.i, id, start: true });
    ritualTick(S, p);
    emit(S, 'change');
    return { ok: true };
  }
  function burnRitual(S, p, why) {
    if (!p.ritual) return;
    const W = RIT[p.ritual.id], n = p.ritual.marks.filter(Boolean).length;
    log(S, `✨ Ритуал «${W.name}» ${nmG(p)} прерван: ${why}${n ? ` — ${n} ${D.plural(n, 'отметка сгорела', 'отметки сгорели', 'отметок сгорели')}` : ''}`, p.i, 'fail');
    emit(S, 'ritual', { p: p.i, id: p.ritual.id, burn: true });
    p.ritual = null;
  }
  const STEP_DONE = { trash: 'жертва принесена', have: 'сбор готов', deed: 'подвиг совершён', abst: 'воздержание выдержано', alms: 'милостыня подана' };
  function markStep(S, p, i) {
    const R0 = p.ritual;
    if (!R0 || R0.marks[i]) return;
    R0.marks[i] = true;
    const W = RIT[R0.id], n = R0.marks.filter(Boolean).length;
    log(S, `✨ ${nm(p)}: ритуал «${W.name}» — ${STEP_DONE[W.steps[i].k]}${n < W.steps.length ? `, отметок ${n} из ${W.steps.length}` : ''}`, p.i, 'faith');
    emit(S, 'ritual', { p: p.i, id: R0.id, step: i, n });
    if (n >= W.steps.length) completeRitual(S, p);
  }
  function completeRitual(S, p) {
    const id = p.ritual.id, W = RIT[id];
    (p.miracles = p.miracles || []).push(id); p.ritual = null;
    log(S, `🌟 ${nm(p)}: ритуал «${W.name}» завершён — чудо «${W.miracle.name}»: ${W.miracle.text.replace(/\.$/, '').replace(/^./, x => x.toLowerCase())}`, p.i, 'faith');
    emit(S, 'miracle', { p: p.i, id });
    checkGoal(S, p); // «Небесный стяг» сразу приближает победу
  }
  // сбор: что у игрока есть сейчас (владения в руинах не считаются — пока не отстроены; значки — со знамён, владений и «до конца хода»)
  function haveNow(S, p, st) {
    const est = (t) => p.estates.filter(e => ES(e).t === t && !e.ruined).length;
    switch (st.what) {
      case 'land': case 'craft': case 'raid': return est(st.what);
      case 'gold': return p.gold;
      case 'faith': case 'sci': case 'war': case 'int': case 'trade': return sym(S, p, st.what);
      case 'banDir': return allBans(p).filter(id => D.BAN[id].dir === st.dir).length;
      case 'banners': return regCount(p);
      case 'hand': return p.hand.length;
    }
    return 0;
  }
  // отметки «сбора» — в свой ход, как только условие выполнено; Проклятая реликвия ставит ритуал на паузу
  function ritualTick(S, p) {
    const R0 = p && p.ritual;
    if (!R0 || S.players[S.cur] !== p || cursed(p, 'relic')) return;
    RIT[R0.id].steps.forEach((st, i) => { if (p.ritual === R0 && !R0.marks[i] && st.k === 'have' && haveNow(S, p, st) >= st.n) markStep(S, p, i); });
  }
  // подвиги: события после начала ритуала (купил, нанял, обряд, победа, удачный шпионаж, дубль, доход за бросок, сыграно за ход)
  function ritualEvent(S, p, kind, v) {
    const R0 = p && p.ritual;
    if (!R0 || cursed(p, 'relic')) return;
    const W = RIT[R0.id];
    W.steps.forEach((st, i) => {
      if (p.ritual !== R0 || R0.marks[i] || st.k !== 'deed') return;
      if (st.what === 'rollGold') { if (kind === 'rollGold' && v >= st.n) markStep(S, p, i); return; }
      if (st.what === 'playTurn') { if (kind === 'play' && v >= st.n) markStep(S, p, i); return; }
      if (st.what !== kind || (kind === 'rite' && v !== W.faith)) return;
      R0.cnt[i] = (R0.cnt[i] || 0) + 1;
      if (R0.cnt[i] >= (st.n || 1)) markStep(S, p, i);
    });
  }
  // воздержание: ход засчитывается, если за весь ход вы этого не сделали; сделали — счёт с нуля
  function ritualEndTurn(S, p) {
    const R0 = p.ritual;
    if (!R0 || cursed(p, 'relic')) return;
    ritualTick(S, p);
    if (p.ritual !== R0) return;
    const did = (p.turn && p.turn.did) || {};
    RIT[R0.id].steps.forEach((st, i) => {
      if (p.ritual !== R0 || R0.marks[i] || st.k !== 'abst') return;
      if (did[st.what]) { if (R0.abst) log(S, `✨ ${nm(p)}: воздержание нарушено — счёт ходов с нуля`, p.i, 'quiet'); R0.abst = 0; return; }
      R0.abst = (R0.abst || 0) + 1;
      if (R0.abst >= st.n) markStep(S, p, i); else log(S, `✨ ${nm(p)}: воздержание — ${R0.abst} из ${st.n}`, p.i, 'quiet');
    });
  }
  const NO_OWN = { land: 'Нет своей 🟦 Земли', craft: 'Нет своего 🟩 Ремесла', raid: 'Нет своего 🟥 Набега' };
  // жертва и милостыня — игрок делает сам, кнопкой на карте ритуала: можно ли сейчас и почему нет
  function ritualActBlock(S, p, i) {
    if (S.winner !== null || S.players[S.cur] !== p) return 'Сейчас не ваш ход';
    const R0 = p.ritual;
    if (!R0) return 'Ритуал не начат';
    const st = RIT[R0.id].steps[i];
    if (!st || (st.k !== 'trash' && st.k !== 'alms')) return 'Это условие отмечается само';
    if (R0.marks[i]) return 'Уже выполнено';
    if (cursed(p, 'relic')) return 'Проклятая реликвия: ритуал стоит';
    const own = (f) => p.estates.filter(e => !ES(e).bad && f(ES(e)));
    if (st.k === 'trash') switch (st.what) {
      case 'hand': return handFree(p).length < st.n ? `В руке меньше ${D.cards(st.n)}` : null;
      case 'estate': return own(d => (!st.only || d.t === st.only) && (!st.not || d.t !== st.not)).length ? null : (st.only ? NO_OWN[st.only] : 'Нет подходящего владения');
      case 'court': return handFree(p).some(k => (D.COURT[p.hand[k]].cost || 0) >= st.min) ? null : `В руке нет карты двора ценой от ${st.min}🪙`;
      case 'discard': return discardOf(p).length < st.n ? `В сбросе меньше ${D.cards(st.n)}` : null;
      case 'vassal': return p.vassals.length ? null : 'Нет вассала';
    }
    switch (st.what) {
      case 'poor': return p.gold < st.n ? `Нужно ${st.n}🪙` : null;
      case 'each': { const v = st.n * opps(S, p).length; return p.gold < v ? `Нужно ${v}🪙` : null; }
      case 'land': case 'craft': return own(d => d.t === st.what).length ? null : NO_OWN[st.what];
      case 'card': return handFree(p).length ? null : 'В руке нет карт';
    }
    return null;
  }
  async function ritualAct(S, p, i) {
    const why = ritualActBlock(S, p, i);
    if (why) return { ok: false, why };
    const R0 = p.ritual, W = RIT[R0.id], st = W.steps[i], lab = `Ритуал «${W.name}»`;
    const own = (f) => p.estates.filter(e => !ES(e).bad && f(ES(e)));
    if (st.k === 'trash' && st.what === 'hand') {
      const free = handFree(p), bi = borrowIdx(p);
      let idx = await ask(S, p, { type: 'trash', max: st.n, need: st.n, each: 0, label: `${lab}: жертва`, lock: bi >= 0 ? [bi] : [] });
      idx = [...new Set((Array.isArray(idx) ? idx : []).filter(k => free.includes(k)))].slice(0, st.n);
      for (const k of free) { if (idx.length >= st.n) break; if (!idx.includes(k)) idx.push(k); }
      const gone = idx.sort((a, b) => b - a).map(k => p.hand.splice(k, 1)[0]);
      p.trashed.push(...gone);
      log(S, `✨ Жертва: ${nm(p)} убрали из игры ${gone.map(x => `«${D.COURT[x].name}»`).join(', ')}`, p.i, 'faith');
    } else if (st.k === 'trash' && st.what === 'estate') {
      const el = own(d => (!st.only || d.t === st.only) && (!st.not || d.t !== st.not));
      const uid = await ask(S, p, { type: 'ritualEstate', give: false, options: el.map(e => e.uid), label: lab });
      const e = el.find(x => x.uid === uid) || el[0];
      p.estates.splice(p.estates.indexOf(e), 1); S.destroyed.push(e.id); p.stats.lost++;
      log(S, `✨ Жертва: «${ES(e).name}» ${nmG(p)} уходит из игры`, p.i, 'faith');
    } else if (st.k === 'trash' && st.what === 'court') {
      const opts = handFree(p).filter(k => (D.COURT[p.hand[k]].cost || 0) >= st.min);
      let k = await ask(S, p, { type: 'ritualCard', give: false, options: opts, min: st.min, label: lab });
      if (!opts.includes(k)) k = opts[0];
      const [id] = p.hand.splice(k, 1); p.trashed.push(id);
      log(S, `✨ Жертва: ${nm(p)} убрали из игры «${D.COURT[id].name}»`, p.i, 'faith');
    } else if (st.k === 'trash' && st.what === 'discard') {
      const pile = discardOf(p);
      let idx = await ask(S, p, { type: 'trash', cards: pile, max: st.n, need: st.n, each: 0, label: `${lab}: жертва из сброса` });
      idx = [...new Set((Array.isArray(idx) ? idx : []).filter(k => k >= 0 && k < pile.length))].slice(0, st.n);
      for (let k = 0; idx.length < st.n && k < pile.length; k++) if (!idx.includes(k)) idx.push(k);
      const gone = idx.map(k => pile[k]);
      for (const id of gone) takeFromDiscard(p, id);
      p.trashed.push(...gone);
      log(S, `✨ Жертва: ${nm(p)} убрали из игры карты из сброса: ${gone.map(x => `«${D.COURT[x].name}»`).join(', ')}`, p.i, 'faith');
    } else if (st.k === 'trash' && st.what === 'vassal') {
      let id = await ask(S, p, { type: 'ritualVassal', options: p.vassals.slice(), label: lab });
      if (!p.vassals.includes(id)) id = p.vassals[0];
      p.vassals.splice(p.vassals.indexOf(id), 1); S.vDeck.unshift(id); p.stats.released++;
      log(S, `✨ Жертва: ${nm(p)} отпустили вассала «${D.regName(D.BAN[id])}» — под низ колоды вассалов`, p.i, 'faith');
    } else if (st.what === 'poor') {
      const t = await pickPoor(S, p);
      p.gold -= st.n; t.gold += st.n;
      log(S, `✨ Милостыня: ${nm(p)} отдали ${st.n}🪙 ${nmD(t)} — самому бедному`, p.i, 'faith');
    } else if (st.what === 'each') {
      for (const o of opps(S, p)) { p.gold -= st.n; o.gold += st.n; }
      log(S, `✨ Милостыня: ${nm(p)} отдали каждому сопернику по ${st.n}🪙`, p.i, 'faith');
    } else if (st.what === 'land' || st.what === 'craft') {
      const el = own(d => d.t === st.what);
      const uid = await ask(S, p, { type: 'ritualEstate', give: true, options: el.map(e => e.uid), label: lab });
      const e0 = el.find(x => x.uid === uid) || el[0];
      const t = await pickPoor(S, p);
      moveEstate(S, p, t, e0.uid);
      log(S, `✨ Милостыня: ${nm(p)} отдали «${ES(e0).name}» ${nmD(t)} — самому бедному`, p.i, 'faith');
    } else if (st.what === 'card') {
      const opts = handFree(p);
      let k = await ask(S, p, { type: 'ritualCard', give: true, options: opts, label: lab });
      if (!opts.includes(k)) k = opts[0];
      const t = await pickPoor(S, p);
      const [id] = p.hand.splice(k, 1); t.discard.push(id);
      log(S, `✨ Милостыня: ${nm(p)} отдали «${D.COURT[id].name}» ${nmD(t)} — в сброс самому бедному`, p.i, 'faith');
    }
    emit(S, 'ritual', { p: p.i, id: R0.id, act: i });
    markStep(S, p, i);
    ritualTick(S, p);
    emit(S, 'change');
    return { ok: true };
  }
  // для экрана: по каждому условию — сделано ли, сколько из скольких, можно ли нажать
  function ritualProgress(S, p) {
    const R0 = p && p.ritual;
    if (!R0) return null;
    return RIT[R0.id].steps.map((st, i) => {
      const done = !!R0.marks[i], need = st.n || 1;
      let cur = null;
      if (!done && st.k === 'have') cur = Math.min(haveNow(S, p, st), need);
      if (!done && st.k === 'deed' && st.what !== 'rollGold' && st.what !== 'playTurn') cur = R0.cnt[i] || 0;
      if (!done && st.k === 'abst') cur = R0.abst || 0;
      const act = st.k === 'trash' || st.k === 'alms';
      const viol = st.k === 'abst' && !done && !!((p.turn && p.turn.did) || {})[st.what];
      return { i, k: st.k, name: D.STEP_NAME[st.k], t: st.t, done, cur, need, act, viol, why: act && !done ? ritualActBlock(S, p, i) : null };
    });
  }
  // чудо «Благовест» (ритуал «Великий пост»): в начале хода ваши Земли приносят доход, как будто выпало их число
  function landDawn(S, p, m) {
    if (cursed(p, 'blight')) { log(S, `${nm(p)}: ${miracleName('landDawn')} — Неурожай, Земли молчат`, p.i, 'quiet'); return; }
    let g = 0;
    for (const e of p.estates) {
      const d = ES(e);
      if (d.t !== 'land') continue;
      for (let x = 0; x < (m.landDouble ? 2 : 1); x++) { // «Щедрая нива»: Земля срабатывает ещё раз
        if (e.ruined) { repair(S, p, e, []); continue; }
        const v = estateIncome(S, p, d, m);
        if (v > 0) g += v;
      }
    }
    if (g) { p.gold += g; p.stats.rollInc += g; log(S, `🔔 ${nm(p)}: ${miracleName('landDawn')} — Земли принесли +${g}🪙`, p.i, 'gold'); }
  }
  // чудо «Чужими руками» (ритуал «Ночной совет»): карта из сброса соперника — в руку на этот ход
  async function borrowCard(S, p) {
    const options = [];
    for (const o of opps(S, p)) for (const id of new Set(o.discard)) { const c = D.COURT[id]; if (c && !c.scheme && !c.sin && !c.rule) options.push({ i: o.i, id }); }
    if (!options.length) return;
    const k = await ask(S, p, { type: 'borrow', options });
    const pick = Number.isInteger(k) ? options[k] : null;
    if (!pick) return;
    const o = S.players[pick.i], j = o.discard.indexOf(pick.id);
    if (j < 0) return;
    o.discard.splice(j, 1); p.hand.push(pick.id); p.borrow = { id: pick.id, from: o.i, played: false };
    log(S, `🌑 ${nm(p)}: ${miracleName('borrow')} — «${D.COURT[pick.id].name}» из сброса ${nmG(o)}, до конца хода`, p.i, 'faith');
    emit(S, 'ritual', { p: p.i, borrow: pick.id, from: o.i });
  }
  function returnBorrowed(S, p) {
    const b = p.borrow; p.borrow = null;
    if (!b || !S.players[b.from]) return;
    const o = S.players[b.from];
    for (const pile of [p.inPlay, p.hand, p.discard, p.deck]) {
      const k = pile.lastIndexOf(b.id);
      if (k >= 0) { pile.splice(k, 1); o.discard.push(b.id); log(S, `   «${D.COURT[b.id].name}» вернулась в сброс ${nmG(o)}`, o.i, 'quiet'); return; }
    }
  }
  // чудо «Нашёптанная судьба» (ритуал «Обет молчания»): решить за соперника, сколько кубиков он бросит в свой следующий ход
  async function dictateDice(S, p) {
    const os = opps(S, p);
    if (!os.length) return;
    const ch = await ask(S, p, { type: 'dictate', options: os.map(o => o.i) });
    if (!ch || !(ch.n === 1 || ch.n === 2)) return;
    const t = S.players[ch.i];
    if (!t || t === p) return;
    t.forceDice = { n: ch.n, by: p.i };
    log(S, `🌑 ${nm(p)}: ${miracleName('dictateDice')} — ${nm(t)} в свой следующий ход бросают ${ch.n === 2 ? 'два кубика' : 'один кубик'}`, p.i, 'faith');
    emit(S, 'ritual', { p: p.i, dictate: t.i, n: ch.n });
  }

  function checkGoal(S, p) {
    if (!meetsGoal(S, p)) return;
    if (R.finishRound) {
      if (!S.finishers) S.finishers = [];
      if (!S.finishers.includes(p.i)) {
        S.finishers.push(p.i);
        log(S, `🏁 У ${nmG(p)} ${D.banners(goal(S))} — цель выполнена! Круг доигрывается до конца`, p.i, 'victory');
      }
    } else {
      S.winner = p.i;
      log(S, `🏆 Победа: ${nm(p)}, ${D.banners(goal(S))}`, p.i, 'victory');
    }
  }
  // титулов в v2 нет: оставлено пустым, чтобы старые вызовы ничего не ломали
  function updateTitles() {}

  // ---------- ход целиком ----------
  function endTurn(S, p) {
    ritualEndTurn(S, p); // ритуал: сбор и воздержание — по итогам хода
    if (p.borrow) returnBorrowed(S, p);
    checkGoal(S, p); // цель могла сложиться и без найма: чудо «Небесный стяг» проснулось после покаяния
    if (p.shield > 0) p.shield--; // Щит ордена: до конца следующего хода
    if (p.distracted && --p.distracted.left < 0) p.distracted = null;
    p.turn.curse = {}; // запреты на один ход (Куртизанка, Клевета) кончаются вместе с ходом
    // R.taxOnce: сыгранная Подать уходит из игры — колода чистится сама, без Отставки
    const once = (id) => R.taxOnce && D.COURT[id] && D.COURT[id].start;
    const keep = !!mods(S, p).keepHand; // чудо «Звёздная память»: несыгранные карты остаются в руке, новых — сколько обычно
    p.discard.push(...(keep ? [] : p.hand), ...p.inPlay.filter(id => !once(id)));
    for (const id of p.inPlay) if (once(id)) p.trashed.push(id);
    if (!keep) p.hand = [];
    p.inPlay = [];
    p.temp = emptySyms();
    drawCards(S, p, handSize(S, p));
    const extra = p.turn.extraTurn && !S.extraTaken;
    if (extra) {
      S.extraTaken = true;
      log(S, `${nm(p)} выбросили дубль — ещё один ход`, p.i, 'extra');
    } else if ((p.slothNext || 0) > 0) { // грех Лень: полный ход сразу; дубль в нём снова даёт ещё ход
      p.slothNext--; S.extraTaken = false;
      log(S, `${nm(p)}: Лень — ещё один ход`, p.i, 'extra');
    } else {
      S.extraTaken = false;
      S.cur = (S.cur + 1) % S.players.length;
      if (S.cur === S.first) {
        S.round++;
        // обновление рынка в начале круга: самая старая карта ряда уходит под низ колоды, открывается новая
        for (const [flow, row, deck, what] of [[R.courtFlow, S.courtRow, S.courtDeck, 'court'], [R.estateFlow, S.estateRow, S.estateDeck, 'estate']]) {
          for (let k = 0; k < (flow || 0) && row.length && deck.length; k++) {
            const id = row.shift(); deck.unshift(id);
            log(S, `Рынок обновился: «${(what === 'court' ? D.COURT[id] : D.ESTATES[id]).name}» ${what === 'court' ? 'ушла' : 'ушло'} под низ колоды`, null, 'market');
          }
        }
        // ряды, из которых за круг ничего не взяли, обновит первый игрок в начале своего хода (refreshRows)
        S.refreshDue = staleRows(S);
        S.rowHired = {};
        S.catchup = null;
        if (R.catchupGap && !(R.catchupOff && on(S, R.catchupOff))) { // с модулем «Баланс» вместо этого — Зависть и Поддержка
          const cs = S.players.map(regCount), mx = Math.max(...cs);
          if (mx >= cuFrom(S)) {
            S.catchup = Object.fromEntries(S.players.filter(q => mx - cs[q.i] >= R.catchupGap).map(q => [q.i, mx - cs[q.i]]));
            S.catchupInfo = { round: S.round, mx, cs, lead: S.players.filter(q => cs[q.i] === mx).map(q => q.i) }; // для объяснения: у кого сколько знамён
          }
        }
      }
    }
    S.turnNo++;
    emit(S, 'endturn', { p: p.i });
    emit(S, 'change');
  }

  // с какого числа знамён у лидера включается догоняющий наём: число или 'half' — половина цели (в «Знакомстве» — с 3)
  const cuFrom = (S) => (R.catchupFrom === 'half' ? Math.ceil(goal(S) / 2) : (R.catchupFrom || 0));
  // ---------- новый круг: обновление рядов ----------
  // ряд, из которого за круг ничего не взяли (ни купили, ни наняли), сдвигается: крайняя карта — под низ своей колоды
  const ROWS = () => [['estate', 'владений'], ['court', 'двора'], ['hold', 'твердынь'], ['v', 'вассалов'], ['l', 'лордов'], ['g', 'великих лордов']];
  const rowPair = (S, k) => (k === 'estate' ? [S.estateRow, S.estateDeck] : k === 'court' ? [S.courtRow, S.courtDeck] : k === 'hold' ? [S.holdRow, S.holdDeck] : [rowOf(S, k), deckOf(S, k)]);
  function staleRows(S) {
    return ROWS().map(([k]) => k).filter(k => {
      if ((S.rowHired || {})[k]) return false;
      if (!R.rowRefresh && !['v', 'l', 'g'].includes(k)) return false;
      const [row, deck] = rowPair(S, k);
      return !!(row && row.length && deck && deck.length);
    });
  }
  // по одному ряду: игрок за столом видит, какая карта уходит, и может сам «смахнуть» её (HOOKS.collect kind 'refresh')
  async function refreshRows(S) {
    const rows = S.refreshDue || [];
    S.refreshDue = null;
    if (!rows.length) return;
    S.refreshing = rows.slice();
    for (let j = 0; j < rows.length; j++) {
      const k = rows[j];
      const [row, deck] = rowPair(S, k);
      if (!row || !row.length || !deck || !deck.length) { S.refreshing.shift(); continue; }
      if (HOOKS.collect && !S.sim) await HOOKS.collect(S, { kind: 'refresh', p: S.cur, rows: rows.slice(j), row: k, id: row[0] });
      if (row[0] == null) { S.refreshing.shift(); continue; }
      const id = row.shift(); deck.unshift(id);
      const name = ['v', 'l', 'g'].includes(k) ? D.BAN[id].name : k === 'court' ? D.COURT[id].name : D.ESTATES[id].name;
      refill(S);
      const nw = row[row.length - 1];
      const nwName = nw == null ? null : ['v', 'l', 'g'].includes(k) ? D.BAN[nw].name : k === 'court' ? D.COURT[nw].name : D.ESTATES[nw].name;
      log(S, `↻ Новый круг: из ряда ${ROWS().find(x => x[0] === k)[1]} за круг ничего не взяли — «${name}» уходит под низ колоды${nwName ? `, открылась «${nwName}»` : ''}`, null, 'market');
      S.refreshing.shift();
      emit(S, 'refresh', { rows: [k], row: k, out: id, in: nw });
      emit(S, 'change');
    }
    S.refreshing = null;
  }

  async function runTurn(S) {
    if (S.winner !== null) return;
    if (S.refreshDue) await refreshRows(S);
    const p = S.players[S.cur];
    emit(S, 'turn', { p: p.i });
    await startOfTurn(S, p);
    if (S.winner !== null) return;
    if (p.isBot || !HOOKS.humanTurn) await Bot.takeTurn(S, p);
    else await HOOKS.humanTurn(S, p);
    if (S.winner !== null) return;
    return afterTurn(S, p);
  }
  async function afterTurn(S, p) {
    if (!p.turn.rolled) await roll(S, p, 1); // ход без броска невозможен
    if (S.winner !== null) return;
    if (HOOKS.collect && !S.sim) { const n = handSize(S, p); await HOOKS.collect(S, { kind: 'draw', p: p.i, n, shuffle: p.deck.length < n && (p.discard.length + p.hand.length + p.inPlay.length) > 0 }); }
    endTurn(S, p);
    // конец круга: побеждает тот, у кого цель всё ещё выполнена (вассала могли переманить); равенство — больше золота
    if (R.finishRound && S.finishers && S.finishers.length && S.cur === S.first && !S.extraTaken) {
      const ok = S.players.filter(q => meetsGoal(S, q));
      if (ok.length) {
        const best = ok.sort((x, y) => y.gold - x.gold || y.estates.length - x.estates.length)[0];
        S.winner = best.i;
        log(S, `🏆 Победа: ${nm(best)}, ${D.banners(goal(S))}${ok.length > 1 ? ' (при равенстве — больше золота)' : ''}`, best.i, 'victory');
        emit(S, 'change');
        return;
      }
      S.finishers = [];
      log(S, `К концу круга цель ни у кого не выполнена — партия продолжается`, null, 'info');
    }
    if (S.round > R.maxRounds && S.winner === null) {
      const best = [...S.players].sort((x, y) => regCount(y) - regCount(x) || y.gold - x.gold)[0];
      S.winner = best.i; S.timeout = true;
      log(S, `Время вышло. Победа по числу знамён: ${nm(best)}`, best.i, 'victory');
      emit(S, 'change');
    }
  }

  // ---------- вероятности ----------
  // во сколько бот оценивает лишний значок: ≈1🪙 скидки на каждое будущее знамя его направления
  const symWorth = () => 1;
  const TWO = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1];
  function pRoll(n, r) { if (n === 1) return r >= 1 && r <= 6 ? 1 / 6 : 0; return r >= 2 && r <= 12 ? TWO[r] / 36 : 0; }

  // ===================== БОТ =====================
  // «Характеры» ботов: веса типов владений, значков, ролей двора и темп набора знамён
  const PERSONAS = {
    base: { name: 'Обычный' },
    econ: { name: 'Экономист', type: { land: 1.3, craft: 1.3, raid: 0.7, hold: 0.8, wall: 0.6 }, role: { merchant: 1.7, knight: 0.5, spy: 0.5 } },
    war: { name: 'Воин', sym: { war: 3 }, type: { raid: 1.3, hold: 1.2, wall: 1.2 }, role: { knight: 1.8, merchant: 0.8, scholar: 0.6, spy: 0.6 }, aggro: 1.5 },
    spy: { name: 'Заговорщик', sym: { int: 3 }, type: { raid: 1.2, hold: 1.3 }, role: { spy: 1.8, merchant: 0.8, scholar: 0.7, knight: 0.6 }, aggro: 1.3 },
    sci: { name: 'Учёный', sym: { sci: 3 }, role: { scholar: 1.8, merchant: 0.9, knight: 0.6, spy: 0.7 }, plots: 1.6 },
    rush: { name: 'Охотник за знамёнами', recruit: 'fast' },
    deck: { name: 'Колодостроитель', role: { merchant: 2, scholar: 2, knight: 2, spy: 2 } },
  };
  // родной «характер» бота для каждого Дома
  const NATURAL = { deer: 'econ', owl: 'sci', wolf: 'war', rose: 'spy', serpent: 'war', moon: 'sci', bear: 'econ', lion: 'deck', eagle: 'econ', sun: 'econ' };
  // уровни силы: k — сколько прикидок на вариант, d — на сколько кругов вперёд, top — сколько вариантов каждого вида
  const SCORE_W = { reg: 20, gold: 0.3, inc: 4 };
  const SKILL = { novice: null, normal: null, strong: { k: 3, d: 4, top: 3, ms: 500 }, expert: { k: 8, d: 6, top: 5, ms: 1500 } };
  const SKILL_NAMES = { novice: 'Новичок', normal: 'Обычный', strong: 'Сильный', expert: 'Эксперт' };
  const Bot = {
    PERSONAS,
    P(p) { return PERSONAS[p.persona] || PERSONAS.base; },
    // сколько кубиков игрок обычно бросает: что выгоднее по ожидаемому доходу (запоминаем на ход)
    mode(S, q) {
      const c = q._mode;
      if (c && c.t === S.turnNo) return c.m;
      const m = this.rollEV(S, q, 2) > this.rollEV(S, q, 1) + 0.05 ? 2 : 1;
      q._mode = { t: S.turnNo, m };
      return m;
    },
    pNum(S, q, r) { return this.mode(S, q) === 2 ? 0.85 * pRoll(2, r) + 0.15 * pRoll(1, r) : 0.85 * pRoll(1, r) + 0.15 * pRoll(2, r); },
    // что стоит потерять найм на ход (проклятие «Заговор»): много, если знамя по карману
    hireStake(S, p) {
      const c = p._stake;
      if (c && c.t === S.turnNo) return c.v;
      let mn = Infinity;
      for (const t of TIERS) { if (tierList(p, t).length >= needOf(S, t)) continue; for (const id of rowOf(S, t) || []) mn = Math.min(mn, banCost(S, p, id).total); }
      const v = mn <= p.gold + 3 ? 4 : 1;
      p._stake = { t: S.turnNo, v };
      return v;
    },
    rollValue(S, p, r) {
      let v = 0; const m = mods(S, p);
      // проклятия у нас: Неурожай — Земли молчат, Мытарь — доход Ремёсел уходит подбросившему, Разбойничий стан — Набеги и Твердыни не срабатывают
      const blight = cursed(p, 'blight'), taxed = cursed(p, 'tax'), bandit = cursed(p, 'bandits');
      for (const e of p.estates) {
        const d = ES(e);
        if (d.bad || !d.n.includes(r)) continue;
        if (bandit && (d.t === 'raid' || d.t === 'hold')) continue; // Разбойничий стан: не срабатывают
        if (e.ruined) { if (d.t !== 'raid' || m.redOwn) v += 0.5; continue; }
        if (d.t === 'land' && !blight) v += (estateIncome(S, p, d, m) + (m.landOwn || 0)) * (m.landDouble ? 2 : 1);
        if (d.t === 'craft' && !taxed) v += estateIncome(S, p, d, m) * (m.craftDouble ? 2 : 1);
        if (d.t === 'hold' && !bandit) { let h = 0; for (const o of rivals(S, p, o => o.gold > 0)) h += Math.min(d.inc + (m.holdBonus || 0), o.gold); v += Math.min(h, d.cap || Infinity); }
        if (d.t === 'raid' && m.redOwn && !bandit) v += (d.inc + (m.redBonus || 0)) * (m.raidDouble ? 2 : 1);
      }
      let g = p.gold;
      for (const o of opps(S, p)) {
        if (R.raidNeighbor && prevOf(S, o) !== p) continue;
        if (cursed(o, 'bandits')) continue; // его Набеги молчат
        const mo = mods(S, o);
        for (const e of o.estates) { const d = ES(e); if (d.t === 'raid' && !e.ruined && d.n.includes(r)) { const x = Math.min(d.inc + (mo.redBonus || 0), g); v -= x; g -= x; } }
      }
      for (const pl of p.plots) if (pl.kind === 'dice' && pl.nums && pl.nums.includes(r)) v += 4;
      return v;
    },
    // вред от проклятия key у игрока o за один круг (в золоте); у Мытаря это и доход того, кто подбросил
    curseRound(S, o, key) {
      const m = mods(S, o), inc = (x) => estateIncome(S, o, ES(x), m);
      const own = (x) => ES(x).n.reduce((t, r) => t + this.pNum(S, o, r), 0);
      const any = (x) => S.players.reduce((u, q) => u + ES(x).n.reduce((t, r) => t + this.pNum(S, q, r), 0), 0);
      const live = (t) => o.estates.filter(x => !x.ruined && ES(x).t === t);
      switch (key) {
        case 'blight': return live('land').reduce((a, x) => a + inc(x) * any(x), 0);
        case 'tax': return live('craft').reduce((a, x) => a + inc(x) * (m.craftAny ? any(x) : own(x)), 0);
        case 'bandits': {
          const rich = rivals(S, o, q => q.gold > 0).length;
          return live('raid').reduce((a, x) => a + ES(x).inc * (any(x) - own(x)), 0) + live('hold').reduce((a, x) => a + ES(x).inc * own(x) * Math.max(1, rich), 0);
        }
        case 'walls': return on(S, 'sieges') ? 0.6 : 0;
        case 'quarantine': return 0.7; // покупка владений закрыта: Земли, Ремёсла, Твердыни и проклятия в ответ
        case 'evileye': return Math.max(0, this.rollEV(S, o, 2) - this.rollEV(S, o, 1)) + 0.2;
        case 'relic': return faithsOf(S, o).length ? 1 + 0.5 * faithStage(S, o) : 0;
        case 'schemer': return this.hireStake(S, o);
      }
      return 0;
    },
    // грех (v10.15): штраф «До конца игры» за один круг, в золоте
    sinPen(S, p, key) {
      switch (key) {
        case 'pride': return regCount(p) + 0.6;
        case 'greed': return Math.max(1, Math.floor(p.gold / 5));
        case 'wrath': return on(S, 'sieges') || on(S, 'spy') ? 1.2 : 0.3;
        case 'envy': return 0.6 * opps(S, p).length + (S.catchup && S.catchup[p.i] ? 2 : 0.3);
        case 'gluttony': return this.avgPower(S, p) * 0.8;
        case 'sloth': return Math.max(0, this.rollEV(S, p, 2) - this.rollEV(S, p, 1)) + 0.2;
        case 'lust': return on(S, 'seats') && (p.seats || []).length ? Math.max(...p.seats.map(id => this.seatWorth(S, p, id))) / 6 : 0.2;
      }
      return 0;
    },
    // ценность греха: «Сейчас» минус штраф за остаток партии (с верой — не дороже покаяния); чем ближе к семи, тем ближе призыв
    sinValue(S, p, id) {
      const key = D.COURT[id].sin, T = this.horizon(S);
      let now = 0;
      if (key === 'pride') { const opts = [...(rowOf(S, 'v') || []), ...(rowOf(S, 'l') || [])].filter(x => !hireBlock(S, p, x)); now = opts.length ? Math.max(...opts.map(x => banCost(S, p, x).total + this.banWorth(S, p, x))) + 3 : 0; }
      else if (key === 'greed') now = p.gold;
      else if (key === 'wrath') { for (const o of opps(S, p)) now = Math.max(now, this.lootSwing(S, p, o, R.wrathLoot || 6, false).v); }
      else if (key === 'envy') { const top = Math.max(...opps(S, p).map(regCount)); for (const o of opps(S, p)) if (regCount(o) === top) for (const t of TIERS) if (tierList(p, t).length < needOf(S, t)) for (const v of tierList(o, t)) now = Math.max(now, D.BAN[v].cost * (1 + this.zs(S) / 2) + this.banWorth(S, p, v)); }
      else if (key === 'gluttony') now = Math.min(5, p.deck.length + p.discard.length) * this.avgPower(S, p) * 0.8;
      else if (key === 'sloth') now = this.incomeEst(S, p) + 8;
      else if (key === 'lust') { if (on(S, 'seats')) for (const o of unseatOptions(S, p)) now = Math.max(now, this.seatWorth(S, p, o.id) * (1 + this.zs(S) / 2)); }
      let pen = this.sinPen(S, p, key) * T;
      if (on(S, 'faith') && faithsOf(S, p).length) pen = Math.min(pen, 16); // с верой штраф снимается покаянием
      if (p.ritual) pen += 3 * p.ritual.marks.filter(Boolean).length + 2; // грех сожжёт отметки ритуала
      pen += 6 * miraclesOn(p).length; // и заглушит чудеса, пока не покаешься
      const have = sinCount(p); if (!p.summoned && have >= 4) now += (have - 3) * 8; // ближе к семи грехам — ближе призыв
      return now - pen - 3; // запас: парные партии — без запаса грешный бот выигрывал 46 из 100, с запасом 3 — 49 из 100
    },
    // вред от проклятия у нас за остаток партии — стоит ли тратить действие и 2🪙, чтобы его снять
    badHarm(S, p, e) { return this.curseRound(S, p, ES(e).bad) * this.horizon(S); },
    purgePick(S, p) {
      let best = null, bv = 5.5;
      for (const e of p.estates) { if (!ES(e).bad || purgeBlock(S, p, e)) continue; const v = this.badHarm(S, p, e); if (v > bv) { bv = v; best = e; } }
      return best;
    },
    // ценность выпавших кубиков: доход с числа + дубль (ещё ход, карты, золото)
    rollScore(S, p, vals, n, d = 0) {
      let v = this.rollValue(S, p, sum(vals) + d);
      if (n === 2 && vals.length === 2 && vals[0] === vals[1]) { const m = mods(S, p); v += (m.extraTurn && !S.extraTaken ? 6 : 0) + (m.doubleDraw || 0) * 1.2 + (m.doubleGold || 0); }
      return v;
    },
    // Гадатель (сдвиг ±1): после броска берут лучшее из трёх соседних сумм
    rollEV(S, p, n) {
      const sh = (mods(S, p).shift || 0) > 0 && p.gold >= (R.shiftCost || 0), c = R.shiftCost || 0, val = [];
      for (let r = 1; r <= 12; r++) val[r] = this.rollValue(S, p, r);
      let ev = 0;
      for (let r = 1; r <= 12; r++) { const pr = pRoll(n, r); if (!pr) continue; ev += pr * (sh ? Math.max(val[r], r > 1 ? val[r - 1] - c : -1e9, r < 12 ? val[r + 1] - c : -1e9) : val[r]); }
      return ev;
    },
    // лучший сдвиг для выпавших кубиков: [очки, сдвиг]
    bestShift(S, p, vals, n, shifts) {
      let b = this.rollScore(S, p, vals, n), d0 = 0;
      if (shifts > 0) for (const d of [-1, 1]) { const t = sum(vals) + d; if (t < 1 || t > 12) continue; const v = this.rollScore(S, p, vals, n, d) - (R.shiftCost || 0); if (v > b + 0.01) { b = v; d0 = d; } }
      return [b, d0];
    },
    diceCount(S, p) {
      if (cursed(p, 'evileye') || sinned(p, 'sloth') || faithBan(S, p, 'oneDie')) return 1;
      if (this.ritualAvoid(S, p, 'twoDice')) return 1; // ритуал: воздержание — один кубик
      if (this.ritualNeeds(S, p).double) return 2;      // ритуал: нужен дубль
      if (p.skill === 'novice' && rnd(S) < 0.35) return rnd(S) < 0.5 ? 1 : 2;
      return this.rollEV(S, p, 1) > this.rollEV(S, p, 2) + 0.05 ? 1 : 2;
    },
    // сколько ещё ходов продлится партия: лидер берёт знамя примерно раз в 2 круга
    // отнятое у соперника: вам плюс, ему минус; чем меньше игроков, тем это ценнее (в дуэли — вдвое)
    zs(S) { return 1 + 1 / Math.max(1, S.players.length - 1); },
    horizon(S) { const mx = Math.max(...S.players.map(regCount)); return clamp(1.8 * (goal(S) - mx) - 0.5, 2, 16); },

    // знамёна, которые можно нанять сейчас (без учёта золота)
    banOptions(S, p) {
      const out = [];
      if (this.ritualAvoid(S, p, 'hire')) return out; // ритуал: воздержание от найма
      for (const t of TIERS) {
        if (tierList(p, t).length >= needOf(S, t)) continue;
        const ids = (rowOf(S, t) || []).slice();
        if (t === 'l' && p.heir) ids.push(p.heir);
        if (mods(S, p).deckTop) { const tp = deckTopOf(deckOf(S, t)); if (tp && !ids.includes(tp)) ids.push(tp); } // «Ясновидение»
        for (const id of ids) if (!hireBlock(S, p, id)) out.push({ id, tier: t, def: D.BAN[id], cost: banCost(S, p, id) });
      }
      return out;
    },
    regOptions(S, p) { return this.banOptions(S, p); },
    // ценность знамени сверх продвижения к цели: свойства до конца партии, награда, минус содержание и надбавки
    banWorth(S, p, id) {
      const b = D.BAN[id], T = this.horizon(S);
      const pr = Object.assign({}, b.prod); pr[b.dir] = (pr[b.dir] || 0) + 1;
      let v = this.modValue(S, p, b.mods || {}, pr);
      if (b.take) for (const [k, a] of b.take) v += k === 'gold' ? a : k === 'draw' ? a * 1.2 : k === 'unseat' ? 2.5 : 1;
      if (b.upkeep) v -= b.upkeep * T * 0.95;
      if (b.tax) for (const t of TIERS) if (b.tax[t]) { const left = needOf(S, t) - tierList(p, t).length - (t === b.tier ? 1 : 0); if (left > 0) v -= b.tax[t] * left; }
      if (b.tier === 'l' && on(S, 'seats')) v += T * 0.35; // лорд — ещё одно место при дворе
      return v;
    },
    banScore(S, p, o) { return this.banWorth(S, p, o.id) - o.cost.total; },
    target(S, p) {
      const os = this.banOptions(S, p);
      if (!os.length) return null;
      return this.pickBuild(S, p, os);
    },
    pickBuild(S, p, aff) {
      if (p.skill === 'novice') return aff[Math.floor(rnd(S) * aff.length)];
      let best = null, bv = -Infinity;
      for (const o of aff) { const v = this.banScore(S, p, o); if (v > bv) { bv = v; best = o; } }
      return best;
    },
    incomeEst(S, p) {
      const n = this.mode(S, p);
      let ev = this.rollEV(S, p, n);
      // доход на чужих бросках
      for (const o of opps(S, p)) for (let r = 1; r <= 12; r++) {
        const pr = this.pNum(S, o, r); if (!pr) continue;
        for (const e of p.estates) { if (e.ruined) continue; const d = ES(e); if (d.t === 'land' && d.n.includes(r) && (R.landNeighbor === false || o === prevOf(S, p))) ev += pr * (estateIncome(S, p, d, mods(S, p)) + (mods(S, p).landOthers || 0)); if (d.t === 'raid' && d.n.includes(r) && (!R.raidNeighbor || o === prevOf(S, p))) ev += pr * Math.min(d.inc, 2); }
      }
      return ev + 2.5 - upkeepOf(p);
    },
    allCards(p) { return [...p.deck, ...p.discard, ...p.hand, ...p.inPlay]; },
    power(S, p, id, avg) {
      const c = D.COURT[id];
      const val = (fx) => {
        let v = 0;
        for (const [k, a, b, cc] of fx || []) {
          switch (k) {
            case 'gold': v += a; break;
            case 'draw': v += a * avg; break;
            case 'temp': v += b * (0.6 + 0.8 * Math.min(2, this.symNeed(S, p, a))); break;
            case 'goldPerCraft': v += Math.min(CAP(b), a * p.estates.filter(e => !e.ruined && ES(e).t === 'craft').length); break;
            case 'goldPerRaid': v += Math.min(CAP(b), a * (p.estates.filter(e => ES(e).t === 'raid').length + 0.3)); break;
            case 'goldPerSym': v += Math.min(CAP(cc), b * (prod(S, p)[a] + 0.5)); break;
            case 'goldPerLand': v += Math.min(CAP(b), a * (p.estates.filter(e => ES(e).t === 'land').length + 0.5)); break;
            case 'goldPerProv': v += Math.min(CAP(b), a * new Set(p.estates.map(e => ES(e).p).filter(Boolean)).size + 0.3); break;
            case 'goldIfFaith': v += faithsOf(S, p).length ? a : on(S, 'faith') ? a * 0.4 : 0; break;
            case 'buys': v += 1; break;
            case 'discount': v += a * 0.6; break;
            case 'fairCourt': v += a * 1.4; break;
            case 'stageGold': v += faithsOf(S, p).length ? a * faithStage(S, p) : 0; break;
            case 'perPlayed': v += b * Math.max(0.6, Math.min(3, p.hand.concat(p.deck).filter(id => id === a).length / Math.max(1, p.hand.length + p.deck.length) * 3)); break;
            case 'regDiscount': v += a * 0.7; break;
            case 'reroll': v += 0.8; break;
            case 'forage': v += b * Math.min(R.oneRival === false ? 9 : 1, opps(S, p).filter(o => prod(S, o)[a] < prod(S, p)[a] + 1).length) * 0.8; break;
            case 'siege': {
              let best = 0;
              for (const o of opps(S, p)) { const od = attackOdds(prod(S, p).war + a + (mods(S, p).siege || 0) + (mods(S, p).warCry || 0), prod(S, o).war + walls(S, o) + (mods(S, o).defense || 0)); best = Math.max(best, od * (this.lootSwing(S, p, o, R.siegeLoot, R.siegeRansom).v + (mods(S, p).siegeWinGold || 0))); }
              v += 0.3 + best; break;
            }
            case 'raze': {
              let best = 0;
              if (faithBan(S, p, 'attack')) { v += 0; break; }
              for (const o of targetsOf(S, p)) { const od = razeOdds(S, p, o, a, cc).p; best = Math.max(best, od * (this.razeSwing(S, p, o, b, cc) + (mods(S, p).siegeWinGold || 0))); }
              v += 0.2 + best; break;
            }
            case 'spy': {
              let best = 0;
              if (faithBan(S, p, 'spy')) break;
              for (const o of targetsOf(S, p)) {
                const od = attackOdds(prod(S, p).int + a + (mods(S, p).spy || 0), prod(S, o).int + guardOf(S, o));
                const steal = (n) => Math.min(n + (mods(S, p).stealBonus || 0), Math.max(2, o.gold)) * this.zs(S);
                let loot;
                if (b === 'steal') loot = steal(cc);
                else if (b === 'sabotage') loot = Math.max(o.plots.length ? 3 * this.zs(S) : 0, on(S, 'seats') && !mods(S, o).seatGuard && (o.seats || []).length ? 0.45 * Math.max(...o.seats.map(x => this.seatWorth(S, o, x))) : 0);
                else if (b === 'estate') loot = this.lootSwing(S, p, o, cc, false).v;
                else loot = this.spyLoot(S, p, o, b, cc);
                best = Math.max(best, od * loot);
              }
              v += 0.3 + best; break;
            }
            case 'trash': v += 1.2; break;
            case 'trashGold': v += 1.2 + a * b * 0.7; break;
            case 'fire': { const m = mods(S, p); v += p.estates.filter(e => !e.ruined && ES(e).t === a).reduce((t, e) => t + estateIncome(S, p, ES(e), m), 0); break; }
            case 'echo': v += avg * 0.9; break;
            case 'snatch': v += opps(S, p).some(o => o.discard.length) ? avg * 1.3 + 1.2 : 0.3; break;
            case 'fetchOne': v += p.discard.length ? avg * 1.2 : 0.3; break;
            case 'goldPerBanner': v += a * regCount(p) + 0.3; break;
            case 'shield': { let x = 0; for (const o of opps(S, p)) for (const e of o.estates) { const d = ES(e); if (d.t === 'raid' && !e.ruined) x += d.n.reduce((t, r) => t + this.pNum(S, p, r), 0) * d.inc; if (d.t === 'hold' && !e.ruined) x += d.n.reduce((t, r) => t + this.pNum(S, o, r), 0) * d.inc; } v += x * 1.5 + 0.3; break; }
            case 'board': v += 2; break;
            // поборы: вам с каждого соперника, им минус — в дуэли размах вдвое
            case 'levy': v += a * (R.oneRival === false ? S.players.length : 2) * 0.9; break;
            // опала: соперник теряет придворного (он вернётся к нему через колоду — поэтому меньше половины ценности)
            case 'unseat': { let best = 0; for (const o of unseatOptions(S, p)) best = Math.max(best, this.seatWorth(S, S.players[o.i], o.id) * this.leaderBias(S, p, S.players[o.i])); v += 0.4 * best; break; }
          }
        }
        return v;
      };
      return val(c.fx) + (c.ally && ((c.role === 'scholar' && mods(S, p).allyScholar) || mods(S, p).allyAll) ? 1 : c.allyBy ? 0.75 : 0.4) * val(c.ally);
    },
    avgPower(S, p) {
      const all = this.allCards(p);
      if (!all.length) return 1;
      let s = 0; for (const id of all) s += this.power(S, p, id, 1.2);
      return s / all.length;
    },
    // ценность n лишних значков s по их правилу до конца партии: ⚖️ — скидка на рынке, 📜 — карта в руку, 🕯 — золото в начале хода
    symRule(S, p, s, n = 1) {
      const step = s === 'trade' ? R.tradeStep : s === 'sci' ? R.sciStep : s === 'faith' ? R.faithStep : 0;
      if (!step) return 0;
      const T = this.horizon(S), have = prod(S, p)[s];
      const done = Math.floor((have + n) / step) - Math.floor(have / step);
      const part = done || (((have % step) + n) / step) * 0.45; // незаконченный шаг — часть цены
      const per = s === 'trade' ? 0.65 : s === 'sci' ? Math.max(0.9, this._swIn ? 1.2 : (this._swIn = true, (() => { try { return this.avgPower(S, p); } finally { this._swIn = false; } })())) : 1;
      return part * T * per;
    },
    // сколько стоит лишний значок направления s: скидка на знамёна этого направления, которые ещё понадобятся
    // (в рядах и Наследник), пока скидка не упёрлась в предел; плюс шаг к условию веры
    symNeed(S, p, s) {
      const have = sym(S, p, s); let need = 0;
      for (const t of TIERS) {
        const left = needOf(S, t) - tierList(p, t).length; if (left <= 0 || have >= R.discCap[t]) continue;
        const ids = (rowOf(S, t) || []).concat(t === 'l' && p.heir ? [p.heir] : []);
        const k = ids.filter(id => D.BAN[id].dir === s).length;
        need += Math.min(left, k) * 0.55 + (left > k ? 0.15 * (left - k) : 0);
      }
      if (on(S, 'faith')) need += this.faithSymNeed(S, p, s);
      return Math.min(3, need);
    },
    // вера для бота: ценность блага минус цена запрета (до конца партии)
    faithValue(S, p, f) {
      const F = D.FAITHS[f], T = this.horizon(S);
      let v = this.modValue(S, p, F.mods, {});
      { const c = prod(S, p).faith + 1; const p2 = c >= (R.faithStage2 || 3) ? 0.9 : c >= 2 ? 0.55 : 0.3, p3 = c >= (R.faithStage3 || 5) ? 0.85 : c >= 3 ? 0.35 : 0.12;
        if (F.mods2) v += p2 * this.modValue(S, p, F.mods2, {}); if (F.mods3) v += p3 * this.modValue(S, p, F.mods3, {}); }
      v += Math.max(0, this.riteValueEst(S, p, f)) * T * 0.5;
      const all = this.allCards(p).concat(p.plots.map(pl => pl.id));
      const has = (k) => all.filter(id => D.COURT[id].fx.some(op => op[0] === k) || (D.COURT[id].pfx || []).some(op => op[0] === k)).length;
      const ob = F.oath;
      if ((ob === 'spy' || ob === 'peace') && on(S, 'spy')) v -= has('spy') * 3 + ((mods(S, p).spy || 0) > 0 ? 6 : 0) + 1;
      if ((ob === 'attack' || ob === 'peace') && on(S, 'sieges')) v -= has('siege') * 3 + ((mods(S, p).siege || 0) + (mods(S, p).warCry || 0) > 0 ? 8 : 0) + 1;
      if (ob === 'no_role_spy') v -= all.filter(id => D.COURT[id].role === 'spy').length * 2.5;
      if (ob === 'no_retire') v -= 0.15 * T;
      if (ob === 'tithe') v -= T;
      if (ob === 'gift') v -= T * 1.2; // отдаём сопернику: в дуэли вдвойне
      if (ob === 'oneDie') v -= p.estates.filter(e => ES(e).n.some(r => r > 6)).length * T * 0.12 + 1;
      if (ob === 'no_craft') v -= 1.5 + p.estates.filter(e => ES(e).t === 'craft').length * 0.5;
      if (ob === 'no_renounce') v -= 1;
      // карты веры достаются первому принявшему
      { const pool = (S.faithPool && S.faithPool[f]) || []; if (pool.length) { const avg = this.avgPower(S, p), n = this.allCards(p).length; v += pool.reduce((t, id) => t + Math.max(0, this.power(S, p, id, avg) - avg * 0.6), 0) * T * handSize(S, p) / (n + pool.length) * 0.9; } }
      if (ob === 'no_raid' || ob === 'no_land' || ob === 'no_hold') v -= 1.5 + p.estates.filter(e => ES(e).t === ob.slice(3)).length * 0.5;
      if (ob && ob.startsWith('hire_')) {
        const dir = ob.slice(5);
        const left = needOf(S, 'v') - p.vassals.length + needOf(S, 'l') - p.lords.length;
        const k = S.vRow.concat(S.lRow, p.heir ? [p.heir] : []).filter(id => D.BAN[id].dir === dir).length;
        v -= Math.min(left, 3) * 0.8 + k * 1.2 + (D.HOUSES[p.house].dir === dir || (p.heir && D.BAN[p.heir].dir === dir) ? 6 : 0);
      }
      // единоверцы не нападают друг на друга: в мирной вере с агрессором — плюс, агрессору — минус
      const sameWith = D.FAITHS[f].truce === false ? 0 : opps(S, p).filter(o => faithsOf(S, o).includes(f)).length;
      if (sameWith) v += ((on(S, 'sieges') || on(S, 'spy')) ? 1.5 : 0) * sameWith - ((mods(S, p).spy || 0) + (mods(S, p).warCry || 0) > 0 ? 4 : 0);
      return v;
    },
    // грубая ценность обряда для оценки веры заранее (до принятия)
    riteValueEst(S, p, f) {
      const F = D.FAITHS[f], c = F.rite.cost || {};
      let v = 0;
      for (const op of F.rite.fx) { const [k, a, b] = op; v += k === 'gold' ? a : k === 'draw' ? a * 1.6 : k === 'temp' ? b * 0.6 : k === 'goldPerLand' ? a * p.estates.filter(e => ES(e).t === 'land').length : k === 'goldPerCraft' ? a * p.estates.filter(e => ES(e).t === 'craft').length : k === 'spy' ? 2 : k === 'trashGold' ? 1.6 : 0; }
      return v - (c.gold || 0) - (c.give || 0) * 1.3 - (c.trash ? 0.6 : 0);
    },
    bestFaith(S, p, onlyReady) {
      if (!on(S, 'faith') || p.faiths.length >= faithMax(S, p)) return null;
      let best = null, bv = 0.8;
      for (const f of (S.faithRow || Object.keys(D.FAITHS))) { if (p.faiths.includes(f)) continue; if (onlyReady && canAdopt(S, p, f)) continue; const v = this.faithValue(S, p, f); if (v > bv) { bv = v; best = f; } }
      return best ? { f: best, v: bv } : null;
    },
    faithSymNeed(S, p, s) {
      if (this._fs || !on(S, 'faith') || p.faiths.length >= faithMax(S, p)) return 0;
      this._fs = true;
      try {
        const b = this.bestFaith(S, p, false); if (!b) return 0;
        const r = faithReq(S, p, b.f);
        const mf = Math.max(0, r.need.faith - r.have.faith), md = Math.max(0, r.need.dir - r.have.dir);
        if (!(mf + md)) return 0;
        if ((s === 'faith' && mf) || (r.dir && s === r.dir && md)) return clamp(b.v / (mf + md + 1) / 2, 0, 1.5);
        return 0;
      } finally { this._fs = false; }
    },
    estateValue(S, p, id) {
      const d = D.ESTATES[id]; const m = mods(S, p);
      const pOwnN = (nums) => nums.reduce((s, r) => s + 0.55 * this.pNum(S, p, r) + 0.45 * (0.5 * pRoll(1, r) + 0.5 * pRoll(2, r)), 0);
      const pOthN = (nums) => opps(S, p).reduce((s, o) => s + nums.reduce((t, r) => t + this.pNum(S, o, r), 0), 0);
      const pPrevN = (nums) => !R.raidNeighbor ? pOthN(nums) : nums.reduce((t, r) => t + this.pNum(S, prevOf(S, p), r), 0);
      const pr = prod(S, p);
      let amt;
      if (d.bad) return -(d.inc || 1) * this.horizon(S) * 0.3;
      if (d.perProv) amt = d.perN * (p.estates.filter(e => ES(e).p === d.perProv).length + 1);
      else if (d.per === 'land') amt = d.perN * p.estates.filter(e => ES(e).t === 'land').length;
      else if (d.per === 'raid') amt = d.perN * p.estates.filter(e => ES(e).t === 'raid').length;
      else if (d.per === 'provS') amt = d.perN * (p.estates.filter(e => ES(e).p === 'S').length + 1);
      else if (d.per === 'prov') amt = d.perN * (new Set(p.estates.map(e => ES(e).p).filter(Boolean)).size + 1);
      else if (d.per) amt = d.perN * (pr[d.per] + 1);
      else amt = d.inc;
      if (d.pair && d.p && p.estates.some(e => !e.ruined && ES(e).p === d.p)) amt += d.pair;
      if (d.p) amt += (m['provBonus_' + d.p] || 0);
      if (d.t === 'land') amt += (m.blueBonus || 0);
      if (d.t === 'craft') amt += (m.greenBonus || 0);
      let ev = 0;
      const own = pOwnN(d.n), oth = R.landNeighbor === false ? pOthN(d.n) : d.n.reduce((t, r) => t + this.pNum(S, prevOf(S, p), r), 0);
      if (d.t === 'land') ev = (amt + (m.landOwn || 0)) * own + (amt + (m.landOthers || 0)) * oth;
      else if (d.t === 'craft') ev = amt * own;
      else if (d.t === 'raid') ev = Math.min(amt + (m.redBonus || 0), 4) * pPrevN(d.n) * 0.85 + (m.redOwn ? (amt + (m.redBonus || 0)) * own : 0);
      // золото, отнятое у соперников, ценно вдвойне: вам +, им −
      else if (d.t === 'hold') ev = own * Math.min(d.cap || Infinity, rivals(S, p).reduce((s, o) => s + Math.min(amt, Math.max(1, o.gold)), 0)) * 1.5;
      // синергия с уже имеющимися «за каждое»
      let syn = 0;
      for (const e of p.estates) {
        const x = ES(e);
        if (x.per === 'land' && d.t === 'land') syn += x.perN * pOwnN(x.n);
        if (x.per === 'raid' && d.t === 'raid') syn += x.perN * pOwnN(x.n);
        if (x.per === 'provS' && d.p === 'S') syn += x.perN * pOwnN(x.n);
        if (x.perProv && x.perProv === d.p) syn += x.perN * pOwnN(x.n);
        // первая пара: владение этой провинции, у которого ещё нет пары, начнёт приносить больше
        if (x.pair && x.p === d.p && d.p && p.estates.filter(f => !f.ruined && ES(f).p === d.p).length === 1) syn += x.pair * (x.t === 'land' ? pOwnN(x.n) + (R.landNeighbor === false ? pOthN(x.n) : 0) : pOwnN(x.n));
        if (x.per && x.per === d.sym) syn += x.perN * pOwnN(x.n);
      }
      const T = this.horizon(S);
      let val = (ev + syn) * T;
      if (d.t === 'land' && m.landIncome) val += T * m.landIncome * (p.estates.filter(e => ES(e).t === 'land').length % 2 ? 0.9 : 0.35);
      if (d.t === 'craft' && m.craftIncome) val += T * m.craftIncome * (p.estates.filter(e => ES(e).t === 'craft').length % 2 ? 0.9 : 0.35);
      if (d.t === 'raid' && m.redIncome) val += T * m.redIncome * 0.9;
      if (d.t === 'land' && m.landBuyGold) val += m.landBuyGold;
      if (d.p && m.provIncome) { const ps = new Set(p.estates.map(e => ES(e).p).filter(Boolean)); if (!ps.has(d.p) && ps.size % 2 === 1) val += T * m.provIncome * 0.9; }
      if (d.sym) val += 1.2 + this.symNeed(S, p, d.sym) * 0.9 * symWorth(S, p) + this.symRule(S, p, d.sym, 1);
      if (d.p && on(S, 'unions')) {
        // шаг к следующему союзу этой провинции: 2 значка провинции, золото сразу, первому за столом — ещё
        const need = unionNeed(p, d.p);
        const us = D.PROV[d.p].sym;
        const base = (R.unionSyms || 1) * (1.2 + this.symNeed(S, p, us) * 0.9 * symWorth(S, p)) + (R.unionGold || 0) + (!(S.unionFirst || {})[d.p] ? (R.unionFirst || 0) * 0.7 : 0);
        const uv = base + (m.unionGold ? T * m.unionGold * 0.9 : 0) + (m.unionBounty || 0);
        val += need === 1 ? uv : need === 2 ? uv * 0.3 : uv * 0.1;
      }
      if (d.walls && on(S, 'sieges')) {
        // угроза осады: насколько соперники сильнее нашей обороны
        const myDef = prod(S, p).war + walls(S, p) + (m.defense || 0);
        // стены: сколько захватов они предотвратят до конца партии. Осадную карту соперник играет раз в «колода / рука» ходов
        const T2 = this.horizon(S);
        let saved = 0;
        for (const o of opps(S, p)) {
          const cards = this.allCards(o).concat(o.plots.map(pl => pl.id));
          const sc = cards.filter(id => D.COURT[id].fx.some(op => op[0] === 'siege')).length;
          const bonus = sc ? Math.max(...cards.map(id => { const op = D.COURT[id].fx.find(x => x[0] === 'siege'); return op ? op[1] : 0; })) : 2;
          const A = prod(S, o).war + bonus + (mods(S, o).siege || 0) + (mods(S, o).warCry || 0);
          const cut = attackOdds(A, myDef) - attackOdds(A, myDef + d.walls);
          const plays = sc ? sc * T2 * handSize(S, o) / Math.max(6, cards.length) : 0.15 * T2 / 3; // без осадных карт — небольшой запас на будущее
          if (cut > 0) saved += cut * plays * (this.lootSwing(S, o, p, R.siegeLoot, R.siegeRansom).v + (mods(S, o).siegeWinGold || 0));
        }
        val += saved * 0.85;
        val += d.walls * 0.2;
      }
      // постоянное свойство твердыни — та же оценка, что у свойств знамён и придворных (до конца партии)
      if (d.mods) val += this.modValue(S, p, d.mods, {}) * 0.9 + (d.mods.holdBonus ? d.mods.holdBonus * this.horizon(S) * pOwnN(d.n) : 0);
      if (d.guard && on(S, 'spy')) val += d.guard * (0.4 + 0.5 * opps(S, p).filter(o => (mods(S, o).spy || 0) > 0 || o.plots.length).length);
      const P = this.P(p);
      if (P.type && P.type[d.t] != null) val *= P.type[d.t];
      if (d.sym && P.sym && P.sym[d.sym]) val += P.sym[d.sym];
      return val;
    },
    courtValue(S, p, id) {
      const avg = this.avgPower(S, p);
      const c = D.COURT[id], P = this.P(p);
      const pw = this.power(S, p, id, avg) * ((P.role && c.role && P.role[c.role]) || 1);
      const n = this.allCards(p).length;
      const T = this.horizon(S);
      // козни разыгрываются один раз и уходят в колоду двора: ценность — один розыгрыш, если карта успеет прийти в руку
      if (c.scheme) return clamp(T * handSize(S, p) / (n + 1), 0, 1) * (pw - avg * 0.3) + this.PRANK.scheme;
      const asCard = T * handSize(S, p) * (pw - avg) / (n + 1);
      if (!canSeat(S, id)) return asCard;
      // можно посадить ко двору: ценность места с поправкой на то, когда карта придёт в руку
      const delay = mods(S, p).courtToHand ? 0 : (p.deck.length + n / 2) / handSize(S, p);
      const gain = this.seatGain(S, p, id, true) * clamp((T - delay) / T, 0, 1);
      return Math.max(asCard, 0.8 * gain - avg);
    },
    // сколько принесёт карта, сидящая при дворе, до конца партии (в золоте)
    seatWorth(S, p, id) {
      const c = D.COURT[id]; if (!c || !c.seat) return 0;
      // ценность руки считается через силу карт, а сила опалы — через ценность придворных: без защиты это бесконечная рекурсия
      if (this._sw) return this._seatWorth(S, p, id);
      this._sw = true;
      try { return this._seatWorth(S, p, id); } finally { this._sw = false; }
    },
    _seatWorth(S, p, id) { const c = D.COURT[id]; return this.modValue(S, p, c.seat.mods || {}, c.seat.prod || {}); },
    // ценность постоянных свойств (придворный, знамя, вера) до конца партии — в золоте
    modValue(S, p, m, pr) {
      const T = this.horizon(S), pm = mods(S, p);
      const pOwn = (nums) => nums.reduce((t, r) => t + this.pNum(S, p, r), 0);
      const pOth = (nums) => opps(S, p).reduce((t, o) => t + nums.reduce((u, r) => u + this.pNum(S, o, r), 0), 0);
      const pPrevOnly = (nums) => nums.reduce((u, r) => u + this.pNum(S, prevOf(S, p), r), 0);
      const pPrev = (nums) => !R.raidNeighbor ? pOth(nums) : pPrevOnly(nums);
      const nRiv = R.oneRival === false ? opps(S, p).length : 1;
      const est = (t) => p.estates.filter(e => !e.ruined && ES(e).t === t);
      const leftOf = (t) => Math.max(0, needOf(S, t) - tierList(p, t).length);
      let v = 0;
      for (const k in m) {
        const n = m[k];
        switch (k) {
          case 'startGold': v += n * T; break;
          case 'marketDiscount': v += n * T * 0.6; break;
          case 'courtCheap': v += n * T * 0.3; break;
          case 'greenBonus': v += n * T * (est('craft').reduce((t, e) => t + pOwn(ES(e).n), 0) + 0.1); break;
          case 'plotIncome': v += on(S, 'plots') ? n * T * Math.max(1, p.plots.length) : 0; break;
          case 'craftIncome': v += n * T * (Math.floor(est('craft').length / 2) + 0.3); break;
          case 'blueBonus': v += n * T * (est('land').reduce((t, e) => t + pOwn(ES(e).n) + (R.landNeighbor === false ? pOth(ES(e).n) : pPrevOnly(ES(e).n)), 0) + 0.1); break;
          case 'redBonus': v += n * T * (est('raid').reduce((t, e) => t + 0.85 * pPrev(ES(e).n) + (pm.redOwn ? pOwn(ES(e).n) : 0), 0) + 0.1); break;
          case 'hand': v += n * T * Math.max(0.8, this._sw && this._swIn ? 1.2 : (this._swIn = true, (() => { try { return this.avgPower(S, p); } finally { this._swIn = false; } })())); break;
          case 'regCheap': v += n * Math.max(0, goal(S) - regCount(p)); break;
          case 'plotGold': v += on(S, 'plots') ? n * T * Math.min(0.9, 0.18 * plotSlots(S, p) + 0.1) : 0; break;
          case 'unionGold': v += on(S, 'unions') ? n * T * (unionCount(p) + 0.4) : 0; break;
          case 'unionBounty': v += on(S, 'unions') ? n * Math.max(1, T / 4) : 0; break;
          case 'seatGuard': { let threat = 0; for (const o of opps(S, p)) threat += this.allCards(o).filter(x => (D.COURT[x].fx || []).some(op => op[0] === 'unseat')).length; v += 1 + 2.5 * threat; break; }
          // отнятое у соперника: вам плюс, ему минус — в дуэли ценнее
          case 'tithe': v += n * T * (R.oneRival === false ? opps(S, p).reduce((t, o) => t + (o.gold > 0 ? 0.95 : 0.6), 0) : 0.97) * (0.5 + this.zs(S) / 2); break;
          case 'interest': v += Math.min(n, (p.gold + 3) / (R.interestStep || 5)) * T * 0.7; break;
          case 'allyScholar': {
            const all = this.allCards(p), sc = all.filter(x => D.COURT[x].role === 'scholar' && D.COURT[x].ally);
            const av = (fx) => (fx || []).reduce((t, [k, a]) => t + (k === 'gold' ? a : k === 'draw' ? 1.2 * a : 1), 0);
            v += n * T * handSize(S, p) / Math.max(6, all.length) * sc.reduce((t, x) => t + av(D.COURT[x].ally), 0) * 0.65 + 0.5; break;
          }
          case 'lowRollGold': v += n * T * (this.mode(S, p) === 2 ? 11 / 36 : 1 / 6); break;
          case 'raidShield': { let x = 0; for (const o of opps(S, p)) for (const e of o.estates) { const d = ES(e); if (d.t === 'raid') x += pOwn(d.n); if (d.t === 'hold') x += d.n.reduce((u, r) => u + this.pNum(S, o, r), 0); } v += n * T * (x + 0.12); break; }
          case 'holdBonus': v += n * T * (est('hold').reduce((t, e) => t + pOwn(ES(e).n), 0) * nRiv + 0.1); break;
          case 'regGold': v += n * Math.max(0, goal(S) - regCount(p)) * 0.9; break;
          case 'oppRegGold': v += n * opps(S, p).reduce((t, o) => t + Math.max(0, goal(S) - regCount(o)), 0) * 0.7; break;
          case 'fairPlus': v += pm.freeCheap ? n * T * 0.25 : 0; break;
          case 'buyToll': v += n * T * 0.75 * opps(S, p).length; break;
          case 'siege': {
            if (!on(S, 'sieges')) break;
            const all = this.allCards(p), sc = all.filter(x => D.COURT[x].fx.some(op => op[0] === 'siege') || (D.COURT[x].pfx || []).some(op => op[0] === 'siege')).length;
            v += n * (T * sc * handSize(S, p) / Math.max(6, all.length) * 0.12 * 8 + 0.5); break;
          }
          case 'symFee_trade': case 'symFee_sci': case 'symFee_war': case 'symFee_int': case 'symFee_faith': {
            const sy = k.slice(7), mine = prod(S, p)[sy];
            if (R.oneRival === false) v += n * T * opps(S, p).reduce((t, o) => t + (prod(S, o)[sy] < mine ? 0.9 : prod(S, o)[sy] === mine ? 0.45 : 0.15), 0);
            else v += n * T * opps(S, p).reduce((t, o) => t * (prod(S, o)[sy] < mine ? 0.9 : prod(S, o)[sy] === mine ? 0.45 : 0.15), 1);
            break;
          }
          case 'redIncome': v += n * T * (est('raid').length + 0.3); break;
          case 'landOthers': v += n * T * (est('land').reduce((t, e) => t + (R.landNeighbor === false ? pOth(ES(e).n) : pPrevOnly(ES(e).n)), 0) + 0.1); break;
          case 'landBuyGold': v += n * Math.max(0.6, T * 0.28); break;
          case 'lordIncome': v += n * T * (p.lords.length + p.greats.length + (leftOf('l') + leftOf('g')) * 0.35); break;
          case 'warCry': v += n * (1 + this.symNeed(S, p, 'war') * 0.8 * symWorth(S, p)) + (on(S, 'sieges') ? n * T * 0.1 : 0); break;
          case 'reroll': v += n * T * 0.45; break;
          case 'raidDraw': v += n * T * (est('raid').reduce((t, e) => t + 0.85 * pPrev(ES(e).n) + (pm.redOwn ? pOwn(ES(e).n) : 0), 0) + 0.08) * 1.2; break;
          case 'landOwn': v += n * T * (est('land').reduce((t, e) => t + pOwn(ES(e).n), 0) + 0.1); break;
          case 'plotSlots': v += on(S, 'plots') ? n * T * 0.35 : 0; break;
          case 'freeBasic': v += n * T * 0.35; break;
          case 'seatSlots': v += on(S, 'seats') ? n * T * 0.5 : 0; break;
          case 'seatIncome': v += on(S, 'seats') ? n * T * Math.max(1, (p.seats || []).length + 0.4) : 0; break; // за каждого другого придворного
          case 'shift': { // Гадатель: насколько лучше брать лучшую из трёх соседних сумм — по нынешним владениям
            if (pm.shift) { v += n * T * 0.15; break; } // второй сдвиг не нужен: сдвиг раз в ход
            const val = []; for (let r = 1; r <= 12; r++) val[r] = this.rollValue(S, p, r);
            const c = R.shiftCost || 0; let g = 0, b0 = -1e9, b1 = -1e9;
            for (const nd of [1, 2]) { let e0 = 0, e1 = 0; for (let r = 1; r <= 12; r++) { const pr = pRoll(nd, r); if (!pr) continue; e0 += pr * val[r]; e1 += pr * Math.max(val[r], r > 1 ? val[r - 1] - c : -1e9, r < 12 ? val[r + 1] - c : -1e9); } b0 = Math.max(b0, e0); b1 = Math.max(b1, e1); } g = b1 - b0;
            v += n * T * Math.max(0.6, g + 0.2); break; // +0.2 — владений станет больше
          }
          case 'provIncome': { const np = new Set(p.estates.map(e => ES(e).p).filter(Boolean)).size; v += n * T * (np + 0.3); break; }
          case 'symIncome_trade': case 'symIncome_sci': case 'symIncome_war': case 'symIncome_int': case 'symIncome_faith': { const sy = k.slice(10); v += n * T * (Math.floor((prod(S, p)[sy] + (pr[sy] || 0)) / 2) + 0.35); break; }
          case 'savings': v += n * Math.min(6, (p.gold + 3) / (R.savingsStep || 10)) * T * 0.7; break;
          case 'vasCheap': v += n * leftOf('v'); break;
          case 'lordCheap': v += n * leftOf('l'); break;
          case 'greatCheap': v += n * leftOf('g'); break;
          case 'buys': v += n * T * 1.8; break;
          case 'extraTurn': v += n * T * 0.55; break;
          case 'advantage': v += n * T * 1.1; break;
          case 'predict': v += n * T * (this.mode(S, p) === 2 ? 0.16 : 0.15); break;
          case 'freeCourtBuy': v += n * T * 0.9; break;
          case 'freeEstateBuy': v += n * T * 1.0; break;
          case 'freeLandBuy': v += n * T * 0.6; break;
          case 'freeRaidBuy': v += n * T * 0.5; break;
          case 'doubleGold': v += n * T * (this.mode(S, p) === 2 ? 1 / 6 : 0.05); break;
          case 'allyAll': { const all = this.allCards(p), al = all.filter(x => D.COURT[x].role && D.COURT[x].ally); const av = (fx) => (fx || []).reduce((t, [k, a]) => t + (k === 'gold' ? a : k === 'draw' ? 1.2 * a : 1), 0); v += n * T * handSize(S, p) / Math.max(6, all.length) * al.reduce((t, x) => t + av(D.COURT[x].ally), 0) * 0.5 + 0.5; break; }
          case 'lootPlus': v += on(S, 'sieges') ? Math.min(n, 5) * T * 0.15 : 0; break;
          case 'redOwn': v += n * T * (est('raid').reduce((t, e) => t + pOwn(ES(e).n) * (ES(e).inc + (pm.redBonus || 0)), 0) + 0.25); break;
          case 'provBonus_N': case 'provBonus_S': case 'provBonus_E': case 'provBonus_W': {
            const pv = k.slice(10);
            const xs = p.estates.filter(e => !e.ruined && ES(e).p === pv);
            const hit = xs.reduce((t, e) => { const d = ES(e); return t + (d.t === 'land' ? pOwn(d.n) + (R.landNeighbor === false ? pOth(d.n) : 0) : d.t === 'raid' ? 0.85 * pPrev(d.n) + (pm.redOwn ? pOwn(d.n) : 0) : pOwn(d.n) * (d.t === 'hold' ? nRiv : 1)); }, 0);
            v += n * T * (hit + 0.12); break;
          }
          case 'oathFree': v += on(S, 'faith') ? (faithsOf(S, p).length ? 4 : 1.5) : 0; break;
          case 'stageUp': v += on(S, 'faith') ? (faithsOf(S, p).length ? n * T * 0.8 : 1.5) : 0; break;
          case 'craftAny': v += n * T * (est('craft').reduce((t, e) => t + pOth(ES(e).n) * estateIncome(S, p, ES(e), pm), 0) + 0.2); break;
          case 'banIncome': v += n * T * (Math.floor(regCount(p) / 2) + 0.6); break;
          case 'landIncome': v += n * T * (Math.floor(est('land').length / 2) + 0.3); break;
          case 'fetch': v += n * T * 0.7; break;
          case 'retireDraw': v += n * T * 0.6; break;
          case 'retireGold': v += n * T * 0.85; break;
          case 'faithGold': v += on(S, 'faith') ? n * T * (faithsOf(S, p).length ? 1 : 0.55) : 0; break;
          case 'faithEase': case 'faithAdoptGold': case 'freeRenounce': v += on(S, 'faith') && !faithsOf(S, p).length ? n * 0.9 : 0; break;
          case 'infidelTithe': case 'faithTithe': v += on(S, 'faith') ? n * T * Math.min(nRiv, opps(S, p).length) * 0.6 : 0; break;
          case 'shield': v += (on(S, 'sieges') || on(S, 'spy')) ? n * 1.2 : 0; break;
          case 'spyWinGold': v += on(S, 'spy') ? n * T * 0.2 : 0; break;
          case 'freeSpy': v += on(S, 'spy') ? n * T * 1.3 : 0; break;
          case 'spy': v += on(S, 'spy') ? n * 1.2 : 0; break;
          case 'guard': v += on(S, 'spy') ? n * 0.5 : 0; break;
          case 'stealBonus': v += on(S, 'spy') ? n * T * 0.15 : 0; break;
          case 'walls': v += on(S, 'sieges') ? n * 0.6 : 0; break;
          case 'captureImmune': v += on(S, 'sieges') ? 4 : 0; break;
          case 'siegeWinGold': v += on(S, 'sieges') ? n * T * 0.1 : 0; break;
          case 'tribute': { const xs = opps(S, p).map(o => (prod(S, o).war < prod(S, p).war + (pr.war || 0) ? 0.85 : 0.25)); v += n * T * (R.oneRival === false ? xs.reduce((a, b) => a + b, 0) : 1 - xs.reduce((a, x) => a * (1 - x), 1)); break; }
          case 'timedPlotBonus': v += on(S, 'plots') ? n * T * 0.15 : 0; break;
          case 'plotSpread': case 'plotThird': v += on(S, 'plots') ? n * T * 0.25 : 0; break;
          case 'seatGold': v += on(S, 'seats') ? n * T * 0.12 : 0; break;
          case 'seatFromDiscard': v += on(S, 'seats') ? T * 0.4 : 0; break;
          case 'twoFaiths': v += on(S, 'faith') ? (faithsOf(S, p).length ? T * 0.6 : 2) : 0; break;
          case 'rerollOne': v += n * T * 0.35; break;
          case 'doubleDraw': v += n * T * (this.mode(S, p) === 2 ? 1 / 6 : 0.03) * 1.2; break;
          case 'peek': v += T * 0.5; break;
          case 'raidSym': v += n * (est('raid').length + 0.5) * (1.2 + this.symNeed(S, p, 'war') * 0.9 * symWorth(S, p)); break;
          case 'riteTwice': v += on(S, 'faith') ? (faithsOf(S, p).length ? T * 0.8 : 0.6) : 0; break;
          case 'candleGold': v += n * T * (prod(S, p).faith + 0.3); break;
          case 'estateGold': v += n * T * (Math.floor(p.estates.filter(e => !e.ruined && !ES(e).bad).length / 2) + 0.3); break;
          case 'dreamPeek': v += T * 0.3; break;
          default: v += 1;
        }
      }
      for (const s of SYMS) if (pr[s]) { v += pr[s] * (1.2 + this.symNeed(S, p, s) * 0.9 * symWorth(S, p)) + this.symRule(S, p, s, pr[s]); if (pm['symIncome_' + s]) v += pr[s] * T * 0.5; }
      return v;
    },
    // выгода посадить карту: ценность места минус худший нынешний придворный (если мест нет); now — ещё и минус розыгрыш сейчас
    seatGain(S, p, id, later) {
      const max = seatMax(S, p) + ((((D.COURT[id] && D.COURT[id].seat) || {}).mods || {}).seatSlots || 0); // скобки: без них у всех, кроме Камергера, выходило 0 мест
      if (!seatMax(S, p) || !canSeat(S, id)) return -Infinity;
      const lose = (p.seats || []).length >= max ? Math.min(...p.seats.map(x => this.seatWorth(S, p, x))) : 0;
      return this.seatWorth(S, p, id) - lose - (later ? 0 : this.power(S, p, id, this.avgPower(S, p)));
    },
    // посадить ко двору выгодные карты из руки (до розыгрыша)
    async seatPhase(S, p) {
      if (!seatMax(S, p)) return;
      for (let g = 0; g < 3; g++) {
        let bi = -1, bv = 0.5;
        p.hand.forEach((id, i) => { if (!canSeat(S, id)) return; const v = this.seatGain(S, p, id) + (p.skill === 'novice' ? rnd(S) * 4 - 2 : 0); if (v > bv) { bv = v; bi = i; } });
        if (bi < 0) break;
        if (!await seat(S, p, bi)) break;
        await pause(S, 'play');
      }
      if ((mods(S, p).seatFromDiscard || 0) > 0 && !p.turn.discardSeated && S.players[S.cur] === p) {
        let bid = null, bv = 0.8;
        for (const id of new Set(p.discard)) { if (!canSeat(S, id)) continue; const v = this.seatGain(S, p, id, true); if (v > bv) { bv = v; bid = id; } }
        if (bid) { await seatFromDiscard(S, p, bid); await pause(S, 'play'); }
      }
    },
    bestPurchase(S, p, maxPrice = Infinity, only = null) {
      const opts = [];
      for (const id of BASIC_IDS) if (cardOn(S, 'estate', id) && basicLeft(S, id) > 0) opts.push({ src: 'basic', key: id, id, estate: true });
      S.estateRow.forEach((id, k) => opts.push({ src: 'estate', key: k, id, estate: true }));
      (S.holdRow || []).forEach((id, k) => opts.push({ src: 'hold', key: k, id, estate: true }));
      S.courtRow.forEach((id, k) => opts.push({ src: 'court', key: k, id, estate: false }));
      if (mods(S, p).deckTop) { const te = deckTopOf(S.estateDeck), tc = deckTopOf(S.courtDeck); if (te) opts.push({ src: 'estateTop', key: -1, id: te, estate: true }); if (tc) opts.push({ src: 'courtTop', key: -1, id: tc, estate: false }); } // «Ясновидение»
      for (let k = opts.length - 1; k >= 0; k--) if (oathBuy(S, p, opts[k].src === 'courtTop' ? 'court' : opts[k].src, opts[k].id) || (opts[k].estate ? cursed(p, 'quarantine') : isCursed(p, 'slander'))) opts.splice(k, 1);
      // ритуал: воздержание от покупок; что нужно для сбора и подвигов
      if (this.ritualAvoid(S, p, 'market')) return null;
      const noEst = this.ritualAvoid(S, p, 'buyEstate'), noAtk = this.ritualAvoid(S, p, 'attack'), need = this.ritualNeeds(S, p);
      let best = null, bs = 0.4;
      for (const o of opts) {
        if (only === 'estate' && !o.estate) continue;
        if ((only === 'land' || only === 'raid') && !(o.estate && D.ESTATES[o.id].t === only)) continue;
        if (only === 'court' && o.estate) continue;
        const def = o.estate ? D.ESTATES[o.id] : D.COURT[o.id];
        if (o.estate && !canOwnEstate(p, o.id)) continue;
        if ((noEst && o.estate) || (noAtk && def.bad)) continue;
        if (!o.estate && def.sin && p.ritual) continue; // грех сожжёт ритуал — не сейчас
        const price = marketPrice(S, p, def.cost, !o.estate);
        if (price > p.gold || def.cost > maxPrice) continue;
        if (maxPrice < Infinity && o.estate && mods(S, p).fairCourt) continue;
        if (!o.estate && def.sin && p.penance) continue; // новый грех сорвёт покаяние
        let v = o.estate ? (def.bad ? this.plantEstateValue(S, p, o.id) : this.estateValue(S, p, o.id)) : def.sin ? this.sinValue(S, p, o.id) : this.courtValue(S, p, o.id);
        if (o.estate && !def.bad && need[def.t]) v += 3; else if (!o.estate && !def.sin && need.court) v += 2; else if (!def.bad && !def.sin && need.buy) v += 1.5; // ритуал
        if (!o.estate && ((need.siege && def.fx.some(op => op[0] === 'siege' || op[0] === 'raze')) || (need.spy && def.fx.some(op => op[0] === 'spy')))) v += 3; // ритуалу нужна победа в нападении или удачный шпионаж
        if (!o.estate && R.courtPair && !p.turn.courtPaid) {
          let b2 = 0;
          S.courtRow.forEach((id2, k2) => { if (k2 === o.key) return; const p2 = marketPrice(S, p, D.COURT[id2].cost, true); if (p2 + price > p.gold) return; b2 = Math.max(b2, this.courtValue(S, p, id2) - p2); });
          v += b2;
        }
        // богатому боту цена почти не важна: золото без дела не приносит знамён
        const pw = p.gold >= 30 ? 0.25 : p.gold >= 18 ? 0.6 : 1;
        const sc = v - price * pw + rnd(S) * (p.skill === 'novice' ? 5 : 0.6);
        if (sc > bs) { bs = sc; best = { ...o, price, score: sc }; }
      }
      return best;
    },
    okToSpend(S, p, price) {
      const t = this.target(S, p);
      if (!t) return true;
      const need = t.cost.total;
      const inc = this.incomeEst(S, p);
      if (p.gold + inc >= need && p.gold - price + inc < need) return false;
      if (this.P(p).save === 2 && p.gold + 2 * inc >= need && p.gold - price + 2 * inc < need) return false;
      return true;
    },
    handGold(S, p) {
      let g = 0;
      for (const id of p.hand) {
        for (const [k, a, b, c] of D.COURT[id].fx) {
          if (k === 'gold') g += a;
          if (k === 'goldPerCraft') g += Math.min(CAP(b), a * p.estates.filter(e => ES(e).t === 'craft').length);
          if (k === 'goldPerRaid') g += Math.min(CAP(b), a * p.estates.filter(e => ES(e).t === 'raid').length);
          if (k === 'goldPerSym') g += Math.min(CAP(c), b * sym(S, p, a));
        }
      }
      return g;
    },
    wantPlot(S, p, id) {
      const c = D.COURT[id];
      if (!c.plot) return false;
      const t = this.target(S, p);
      if (c.fx.some(op => op[0] === 'raze')) {
        const op = c.fx.find(x => x[0] === 'raze');
        const best = Math.max(0, ...targetsOf(S, p).map(o => razeOdds(S, p, o, op[1], op[3]).p));
        if (best < 0.45 / (this.P(p).aggro || 1)) return true;
      }
      if (c.fx.some(op => op[0] === 'siege')) {
        const best = Math.max(...opps(S, p).map(o => siegeOdds(S, p, o, c.fx.find(op => op[0] === 'siege')[1]).p));
        if (best < 0.45 / (this.P(p).aggro || 1)) return true;
      }
      if (c.fx.some(op => op[0] === 'spy')) {
        const ok = opps(S, p).some(o => spyInfo(S, p, o, c.fx.find(op => op[0] === 'spy')[1]).ok);
        if (!ok) return true;
      }
      const pg = mods(S, p).plotGold || 0;
      if (!t) return rnd(S) < (0.4 + 0.2 * pg) * (this.P(p).plots || 1);
      const afford = p.gold + this.handGold(S, p) >= t.cost.total;
      if (afford && pg < 2) return false;
      return rnd(S) < (0.6 + 0.15 * pg) * (this.P(p).plots || 1);
    },
    orderIndex(S, p) {
      const pri = (id) => {
        const fx = D.COURT[id].fx;
        if (fx.some(op => op[0] === 'draw')) return 0;
        if (fx.some(op => op[0] === 'temp')) return 1;
        if (fx.some(op => ['siege', 'raze', 'spy', 'plant', 'forage', 'board'].includes(op[0]))) return 4;
        if (fx.some(op => op[0] === 'trash')) return 3;
        return 2;
      };
      // ставим вперёд карту роли, которая уже сыграна (свита)
      let bi = -1, bv = Infinity;
      const noAtk = this.ritualAvoid(S, p, 'attack');
      p.hand.forEach((id, i) => {
        const c = D.COURT[id];
        if (oathPlay(S, p, id)) return;
        if (noAtk && c.fx.some(op => op[0] === 'siege' || op[0] === 'raze' || op[0] === 'spy')) return; // ритуал: воздержание — не нападать
        let v = pri(id);
        if (c.role && p.turn.roles[c.role] && c.ally) v -= 0.5;
        if (c.allyBy && R.botAllyByLast !== false) v += 0.9; // Сборщик — после Податей и других Купцов: так его свита сработает, а может и дважды
        if (v < bv) { bv = v; bi = i; }
      });
      return bi;
    },
    // обряд: ценность эффекта минус цена
    riteValue(S, p, f) {
      const F = D.FAITHS[f], c = F.rite.cost || {}, avg = this.avgPower(S, p);
      const est = (t) => p.estates.filter(e => !e.ruined && ES(e).t === t).length;
      let v = 0;
      for (const op of F.rite.fx) {
        const [k, a, b, cc] = op;
        if (k === 'gold') v += a;
        else if (k === 'draw') v += a * Math.max(1, avg) * 0.8;
        else if (k === 'temp') v += b * (this.symNeed(S, p, a) > 0 ? 1 : 0.25) + (a === 'war' && p.hand.some(id => D.COURT[id].fx.some(x => x[0] === 'siege' || x[0] === 'raze')) ? 1.5 * b : 0) + (a === 'faith' ? 1.2 * b : 0);
        else if (k === 'goldPerLand') v += a * est('land');
        else if (k === 'goldPerCraft') v += a * est('craft');
        else if (k === 'spy') v += 2.2 + (cc || 0) * 0.3;
        else if (k === 'trashGold') v += Math.min(a, p.hand.filter(id => id === 'tax' || D.COURT[id].bad || this.power(S, p, id, avg) < avg * 0.7).length) * (b + 0.8);
      }
      if (c.gold) v -= c.gold * (p.gold - c.gold < 3 ? 1.4 : 1);
      if (c.give) v -= c.give * 1.3;
      if (c.trash) { const worst = Math.min(...p.hand.map(id => (D.COURT[id].bad ? -3 : id === 'tax' ? 0.3 : this.power(S, p, id, avg)))); v -= Math.max(0, worst) * 0.7; }
      return v;
    },
    // ---------- ритуалы (v10.16) ----------
    // воздержание идёт и ещё не выдержано — не делать этого (кроме найма, когда до победы одно знамя)
    ritualAvoid(S, p, what) {
      const R0 = p.ritual;
      if (!R0 || cursed(p, 'relic')) return false;
      const i = RIT[R0.id].steps.findIndex(st => st.k === 'abst' && st.what === what);
      if (i < 0 || R0.marks[i]) return false;
      if (what === 'hire' && goalShort(S, p) <= 1 + (miracleOn(p, 'goalMinus') ? 1 : 0)) return false;
      return true;
    },
    // что нужно ритуалу: виды владений (сбор, жертва, милостыня), покупки двора, обряд, дубль
    ritualNeeds(S, p) {
      const R0 = p.ritual, out = {};
      if (!R0) return out;
      RIT[R0.id].steps.forEach((st, i) => {
        if (R0.marks[i]) return;
        if (st.k === 'have' && (st.what === 'land' || st.what === 'craft' || st.what === 'raid') && haveNow(S, p, st) < st.n) out[st.what] = true;
        if (st.k === 'deed') { if (st.what === 'buyLand') out.land = true; if (st.what === 'buyCourt') out.court = true; if (st.what === 'buy') out.buy = true; if (st.what === 'rite') out.rite = true; if (st.what === 'double') out.double = true; if (st.what === 'siegeWin') out.siege = true; if (st.what === 'spyWin') out.spy = true; }
        if ((st.k === 'alms' || st.k === 'trash') && (st.what === 'land' || st.what === 'craft' || st.only)) { const t = st.only || st.what; if (!p.estates.some(e => ES(e).t === t)) out[t] = true; }
      });
      return out;
    },
    // какой ритуал начать: насколько он уже близок и чего стоит (жертвы, милостыня, подвиги)
    ritualScore(S, p, id) {
      const W = RIT[id];
      const own = (f) => p.estates.filter(e => !ES(e).bad && f(ES(e))).length;
      const DEED = { siegeWin: on(S, 'sieges') ? -1 : -9, spyWin: on(S, 'spy') ? -1 : -9, hireLord: on(S, 'lords') ? 0 : -9, double: -0.5, rollGold: -0.5, playTurn: handSize(S, p) >= 4 ? 0.5 : -1, hire: 0.5, buy: 0.5, buyCourt: 0.3, buyLand: 0, rite: 0 };
      const ABST = { attack: 0.5, retire: 0.5, rite: 0.5, twoDice: 0, hire: -0.5, buyEstate: -0.3, market: -0.8 };
      let v = 0;
      for (const st of W.steps) {
        if (st.k === 'have') v += 3 * Math.min(1, haveNow(S, p, st) / st.n) - 1.5;
        else if (st.k === 'trash') v += st.what === 'estate' ? (own(d => (!st.only || d.t === st.only) && (!st.not || d.t !== st.not)) ? 0 : -2) : st.what === 'vassal' ? -1 : 0.5;
        else if (st.k === 'alms') v += st.what === 'land' || st.what === 'craft' ? (own(d => d.t === st.what) ? -0.5 : -2) : st.what === 'card' ? 0.5 : -st.n * (st.what === 'each' ? opps(S, p).length : 1) / 6;
        else if (st.k === 'deed') v += DEED[st.what] || 0;
        else if (st.k === 'abst') v += ABST[st.what] || 0;
      }
      return v + rnd(S) * 0.5;
    },
    // жертва и милостыня: дешёвое — сразу, дорогое — когда ритуал почти готов
    wantAct(S, p, i, when) {
      const R0 = p.ritual, st = RIT[R0.id].steps[i], marks = R0.marks.filter(Boolean).length;
      if (st.k === 'trash') {
        if (st.what === 'hand') return when === 'pre' && (handFree(p).filter(k => p.hand[k] === 'tax' || D.COURT[p.hand[k]].bad).length >= st.n || marks >= 3);
        if (st.what === 'discard') return true;
        if (st.what === 'court') return when === 'pre' && marks >= 2;
        return marks >= 3; // владение, вассал
      }
      if (st.what === 'poor' || st.what === 'each') { const v = st.n * (st.what === 'each' ? opps(S, p).length : 1); return p.gold - v >= 8 || (marks >= 3 && when === 'post'); }
      if (st.what === 'card') return when === 'pre';
      return marks >= 3; // подарить владение
    },
    async ritualPhase(S, p, when) {
      if (!on(S, 'faith') || !faithsOf(S, p).length) return;
      if (!p.ritual) {
        let best = null, bv = -4;
        for (const id of ritualsOf(S, p)) { if (ritualBlock(S, p, id)) continue; const v = this.ritualScore(S, p, id); if (v > bv) { bv = v; best = id; } }
        if (best) { await startRitual(S, p, best); await pause(S, 'play'); if (S.winner !== null) return; }
      }
      for (let i = 0; i < 5 && p.ritual; i++) {
        if (ritualActBlock(S, p, i) || !this.wantAct(S, p, i, when)) continue;
        const r = await ritualAct(S, p, i);
        if (r.ok) await pause(S, 'play');
        if (S.winner !== null) return;
      }
    },
    async ritePhase(S, p) {
      // Тит: обряд можно провести дважды за ход — тогда второй круг
      for (let round = 0; round < 2; round++) for (const f of (p.faiths || []).slice()) {
        if (riteBlock(S, p, f) || this.ritualAvoid(S, p, 'rite')) continue;
        if (this.riteValue(S, p, f) <= (this.ritualNeeds(S, p).rite && p.ritual && RIT[p.ritual.id].faith === f ? -3 : 0.4)) continue; // ритуалу нужен обряд — проводим и себе в убыток
        const r = await rite(S, p, f);
        if (r.ok) await pause(S, 'play');
        if (S.winner !== null) return;
      }
    },
    async faithPhase(S, p) {
      for (let g = 0; g < 2; g++) {
        const b = this.bestFaith(S, p, true);
        if (!b || (p.skill === 'novice' && rnd(S) < 0.3)) return;
        const r = await adoptFaith(S, p, b.f);
        if (!r.ok) return;
        await pause(S, 'play');
      }
    },
    // Отставка: убрать худшую карту руки (плохую карту, Подать, слабую), если колода от этого не станет слишком тонкой
    pickRetire(S, p) {
      if (R.retire === false || p.turn.retired || !p.hand.length || faithBan(S, p, 'no_retire') || this.ritualAvoid(S, p, 'retire')) return -1;
      const all = this.allCards(p).length;
      const avg = this.avgPower(S, p);
      let bi = -1, bv = Infinity;
      p.hand.forEach((id, i) => { const c = D.COURT[id]; const v = c.bad ? -10 : this.power(S, p, id, avg) + (c.sig ? 3 : 0); if (v < bv) { bv = v; bi = i; } });
      if (bi < 0) return -1;
      const c = D.COURT[p.hand[bi]];
      if (c.bad) { const ch = Math.max(0, ...targetsOf(S, p).map(o => spyInfo(S, p, o, 1).p)); return faithBan(S, p, 'spy') || ch < 0.4 ? bi : -1; }
      if (all <= 7) return -1;
      return bv < avg * 0.8 ? bi : -1;
    },
    async fetchPhase(S, p) {
      if (fetchLeft(S, p) <= 0 || S.players[S.cur] !== p) return false;
      const pool = [...new Set(discardOf(p))];
      if (!pool.length) return false;
      const avg = this.avgPower(S, p); let bid = null, bv = -Infinity;
      for (const id of pool) { const v = this.power(S, p, id, avg) - (D.COURT[id].bad ? 20 : 0) - (oathPlay(S, p, id) ? 20 : 0); if (v > bv) { bv = v; bid = id; } }
      if (!bid || bv <= 0) return false;
      return await fetchCard(S, p, bid);
    },
    async takeTurn(S, p) {
      await pause(S, 'start');
      // покаяние: штраф самого тяжёлого греха за остаток партии больше цены покаяния (5🪙, 2 карты, действие, владение)
      if (!penanceBlock(S, p) && p.gold >= (R.penanceGold || 5) + 2 && p.hand.length >= 2 && p.estates.some(e => !ES(e).bad)) {
        const T = this.horizon(S), worst = Math.max(...p.sins.map(id => this.sinPen(S, p, D.COURT[id].sin))) * T;
        const est = Math.min(...p.estates.filter(e => !ES(e).bad).map(e => this.estateValue(S, p, e.id)));
        if (T >= 5 && worst > ((R.penanceGold || 5) + 2 * this.avgPower(S, p) + 3 + est) * 1.15) { await startPenance(S, p); await pause(S, 'play'); if (S.winner !== null) return; }
      }
      { const k = this.pickRetire(S, p); if (k >= 0) { await retire(S, p, k); await pause(S, 'play'); } }
      await this.faithPhase(S, p);
      await this.ritualPhase(S, p, 'pre');
      if (S.winner !== null) return;
      await this.seatPhase(S, p);
      let guard = 0;
      while (guard++ < 20) {
        const idx = p.hand.findIndex(id => !D.COURT[id].bad && !oathPlay(S, p, id) && D.COURT[id].fx.some(op => op[0] === 'draw' || op[0] === 'reroll'));
        if (idx < 0) break;
        const id = p.hand[idx];
        if (D.COURT[id].plot === 'timed' && p.plots.length < plotSlots(S, p) && rnd(S) < 0.25) await play(S, p, idx, { plot: true });
        else await play(S, p, idx);
        await pause(S, 'play');
        if (S.winner !== null) return;
      }
      await roll(S, p, this.diceCount(S, p));
      await pause(S, 'roll');
      if (S.winner !== null) return;
      await this.seatPhase(S, p);
      await this.ritePhase(S, p);
      let plotted = 0; guard = 0;
      while (guard++ < 30) {
        let idx = p.hand.length ? this.orderIndex(S, p) : -1;
        // рука сыграна — Святой Аврелий и др.: вернуть лучшую карту из сброса (можно сыгранную в этот ход) и сыграть ещё раз
        if (idx < 0) { if (!(await this.fetchPhase(S, p))) break; idx = this.orderIndex(S, p); if (idx < 0) break; }
        const id = p.hand[idx]; const c = D.COURT[id];
        if (c.plot && plotted < 1 + ((mods(S, p).plotGold || 0) >= 2 ? 1 : 0) + ((this.P(p).plots || 1) > 1 ? 1 : 0) && p.plots.length < plotSlots(S, p) && this.wantPlot(S, p, id)) {
          await play(S, p, idx, { plot: true }); plotted++;
        } else await play(S, p, idx);
        await pause(S, 'play');
        if (S.winner !== null) return;
      }
      await this.faithPhase(S, p); // свечи «до конца хода» с карт двора могли открыть веру
      await this.ritePhase(S, p);
      await this.ritualPhase(S, p, 'post');
      if (S.winner !== null) return;
      // одно действие за ход (или больше с бонусами): знамя ИЛИ покупка
      guard = 0;
      if (SKILL[p.skill] && SKILL[p.skill].k && !S.sim) {
        while (buysLeft(S, p) > 0 && guard++ < 4) {
          const ch = await this.lookahead(S, p, SKILL[p.skill]);
          if (!ch || ch.type === 'pass') break;
          const r = ch.type === 'build' ? await hire(S, p, ch.id) : await buy(S, p, ch.src, ch.key);
          await pause(S, ch.type === 'build' ? 'build' : 'buy');
          if (S.winner !== null) return;
          if (!r.ok) break;
          if (ch.type === 'buy' && ch.src === 'court' && mods(S, p).courtToHand) {
            const bid = S.lastBought || null; const idx = bid ? p.hand.lastIndexOf(bid) : -1;
            if (idx >= 0 && canSeat(S, bid) && this.seatGain(S, p, bid) > 1) await seat(S, p, idx); else if (idx >= 0 && !D.COURT[bid].fx.some(op => op[0] === 'reroll')) { await play(S, p, idx); if (S.winner !== null) return; }
          }
        }
        guard = 99;
      }
      if (R.splitActions && hireFree(S, p) && S.winner === null) {
        const aff = this.regOptions(S, p).filter(o => o.cost.total <= p.gold);
        if (aff.length && this.wantRecruit(S, p, aff)) { const pick = this.pickBuild(S, p, aff); const r = await hire(S, p, pick.id); await pause(S, 'build'); if (S.winner !== null) return; }
      }
      while (buysLeft(S, p) > 0 && guard++ < 4) {
        const aff = this.regOptions(S, p).filter(o => o.cost.total <= p.gold);
        if (aff.length && this.wantRecruit(S, p, aff)) {
          const pick = this.pickBuild(S, p, aff);
          const r = await hire(S, p, pick.id);
          await pause(S, 'build');
          if (S.winner !== null) return;
          if (r.ok) continue;
        }
        { const pe = this.purgePick(S, p); if (pe && p.gold >= (R.purgeCost || 2) + 2) { const r = await purgeBad(S, p, pe.uid); await pause(S, 'buy'); if (S.winner !== null) return; if (r.ok) continue; } }
        const best = this.bestPurchase(S, p);
        if (!best) break;
        if (!this.okToSpend(S, p, best.price)) break;
        const r = await buy(S, p, best.src, best.key);
        if (!r.ok) break;
        await pause(S, 'buy');
        // Дом Льва: купленная карта двора сразу в руке — сыграть её в этот же ход
        if (best.src === 'court' && mods(S, p).courtToHand) {
          const bid = S.lastBought || null;
          const idx = bid ? p.hand.lastIndexOf(bid) : -1;
          if (idx >= 0 && canSeat(S, bid) && this.seatGain(S, p, bid) > 1) await seat(S, p, idx); else if (idx >= 0 && !D.COURT[bid].fx.some(op => op[0] === 'reroll')) { await play(S, p, idx); if (S.winner !== null) return; }
        }
      }
      if ((p.turn.catchupHire || 0) > 0 && buysLeft(S, p) <= 0 && S.winner === null) {
        const aff = this.regOptions(S, p).filter(o => o.cost.total <= p.gold && (!R.catchupTier || D.BAN[o.id].tier === R.catchupTier));
        if (aff.length) { const pick = this.pickBuild(S, p, aff); const r = await hire(S, p, pick.id); await pause(S, 'build'); if (S.winner !== null) return; }
      }
      if (extraOn(S, p) && S.winner === null && buysLeft(S, p) <= 0 && canBuyAction(S, p) && p.skill !== 'novice') {
        const X = extraCost(S, p);
        const aff = R.extraMarketOnly ? [] : this.regOptions(S, p).filter(o => o.cost.total + X <= p.gold);
        let did = false;
        if (aff.length) {
          const pick = this.pickBuild(S, p, aff);
          if (pick && (p.gold - X - pick.cost.total >= 0) && (regCount(p) >= 2 || p.gold - X - pick.cost.total >= 4)) {
            const r0 = buyAction(S, p);
            if (r0.ok) { const r = await hire(S, p, pick.id); await pause(S, 'build'); did = r.ok; if (S.winner !== null) return; }
          }
        }
        if (!did && !p.turn.extraBought && p.gold >= X + (R.extraMarketOnly ? 6 : 14)) {
          const best = this.bestPurchase(S, p, p.gold - X);
          if (best && best.score > X + 2 && this.okToSpend(S, p, best.price + X)) { const r0 = buyAction(S, p); if (r0.ok) { const r = await buy(S, p, best.src, best.key); if (r.ok) await pause(S, 'buy'); } }
        }
      }
      if ((mods(S, p).freeBasic || 0) && !p.turn.basicUsed) {
        let bid = null, bsc = -0.5;
        for (const id of BASIC_IDS) { if (basicLeft(S, id) <= 0) continue; const pr = marketPrice(S, p, D.ESTATES[id].cost); if (pr > p.gold || !this.okToSpend(S, p, pr)) continue; const sc = this.estateValue(S, p, id) - pr; if (sc > bsc) { bsc = sc; bid = id; } }
        if (bid) { const r = await buy(S, p, 'basic', bid); if (r.ok) await pause(S, 'buy'); }
      }
      const fm = fairLimit(S, p);
      if (fm && !p.turn.cheapUsed) {
        const cb = this.bestPurchase(S, p, fm);
        if (cb && this.okToSpend(S, p, cb.price)) { const r = await buy(S, p, cb.src, cb.key); if (r.ok) await pause(S, 'buy'); }
      }
      // «Ярмарка» с карт двора: купить карту двора, не тратя действие (пока есть такие покупки в этот ход)
      for (let g3 = 0; g3 < 4 && (p.turn.fairCourt || 0) > 0 && S.winner === null; g3++) {
        const cb = this.bestPurchase(S, p, Infinity, 'court');
        if (!cb || !this.okToSpend(S, p, cb.price)) break;
        const r = await buy(S, p, cb.src, cb.key); if (!r.ok) break; await pause(S, 'buy');
      }
      // лорды: бесплатная покупка карты двора (Мартин) и владения (Леопольд)
      for (const [flag, used, isEst] of [['freeCourtBuy', 'freeCourtUsed', false], ['freeLandBuy', 'freeLandUsed', 'land'], ['freeRaidBuy', 'freeRaidUsed', 'raid'], ['freeEstateBuy', 'freeEstUsed', true]]) {
        if (!(mods(S, p)[flag] > 0) || p.turn[used] || S.winner !== null) continue;
        const cb = this.bestPurchase(S, p, Infinity, typeof isEst === 'string' ? isEst : isEst ? 'estate' : 'court');
        if (cb && this.okToSpend(S, p, cb.price)) { const r = await buy(S, p, cb.src, cb.key); if (r.ok) await pause(S, 'buy'); }
      }
      if (R.freeCourt || (R.courtPair && p.turn.courtPaid)) {
        let g2 = 0;
        while ((p.turn.courtBought || 0) < (R.freeCourt || 1) && g2++ < 3) {
          let bk = null, bs = 0;
          S.courtRow.forEach((id, k) => {
            const price = marketPrice(S, p, D.COURT[id].cost, true);
            if (D.COURT[id].sin || price > p.gold || !this.okToSpend(S, p, price)) return; // грех бесплатной покупкой не взять
            const sc = this.courtValue(S, p, id) - price + 1.5;
            if (sc > bs) { bs = sc; bk = k; }
          });
          if (bk === null) break;
          const r = await buy(S, p, 'court', bk);
          if (!r.ok) break;
          await pause(S, 'buy');
        }
      }
    },
    // варианты действия: знамёна по силам, покупки на рынке (лучшие по оценке) и «ничего»
    candidates(S, p, top) {
      const out = [{ type: 'pass' }];
      for (const o of this.banOptions(S, p)) if (o.cost.total <= p.gold) out.push({ type: 'build', id: o.id, h: 100 + this.banScore(S, p, o) });
      const opts = [];
      for (const id of BASIC_IDS) if (cardOn(S, 'estate', id) && basicLeft(S, id) > 0) opts.push({ src: 'basic', key: id, id, estate: true });
      S.estateRow.forEach((id, k) => opts.push({ src: 'estate', key: k, id, estate: true }));
      (S.holdRow || []).forEach((id, k) => opts.push({ src: 'hold', key: k, id, estate: true }));
      S.courtRow.forEach((id, k) => opts.push({ src: 'court', key: k, id, estate: false }));
      for (let k = opts.length - 1; k >= 0; k--) if (oathBuy(S, p, opts[k].src, opts[k].id) || (opts[k].estate ? cursed(p, 'quarantine') : isCursed(p, 'slander'))) opts.splice(k, 1);
      const buys = [];
      for (const o of opts) {
        const def = o.estate ? D.ESTATES[o.id] : D.COURT[o.id];
        if (o.estate && !canOwnEstate(p, o.id)) continue;
        const price = marketPrice(S, p, def.cost, !o.estate);
        if (price > p.gold) continue;
        if (!o.estate && def.sin && p.penance) continue;
        const v = o.estate ? (def.bad ? this.plantEstateValue(S, p, o.id) : this.estateValue(S, p, o.id)) : def.sin ? this.sinValue(S, p, o.id) : this.courtValue(S, p, o.id);
        buys.push({ type: 'buy', src: o.src, key: o.key, id: o.id, h: v - price });
      }
      buys.sort((a, b) => b.h - a.h);
      const builds = out.filter(x => x.type === 'build').sort((a, b) => b.h - a.h).slice(0, top);
      return [out[0], ...builds, ...buys.slice(0, top)];
    },
    // оценка позиции для игрока i: знамёна, золото и будущий доход — против лучшего соперника
    score(S, i) {
      const W = SCORE_W; const val = (q) => (S.winner === q.i ? 1000 : 0) + regCount(q) * W.reg + q.gold * W.gold + this.incomeEst(S, q) * W.inc;
      const me = val(S.players[i]);
      return me - Math.max(...S.players.filter(q => q.i !== i).map(val));
    },
    async lookahead(S, p, cfg) {
      const cands = this.candidates(S, p, cfg.top);
      if (cands.length <= 1) return cands[0] || null;
      const strip = JSON.stringify(Object.assign({}, S, { log: [] }));
      const sum = cands.map(() => 0), cnt = cands.map(() => 0);
      const t0 = Date.now();
      // прикидки идут по кругу по всем вариантам; если время на ход вышло — останавливаемся (но не раньше двух кругов)
      for (let k = 0; k < cfg.k; k++) {
        for (let ci = 0; ci < cands.length; ci++) {
          const c = cands[ci];
          const C = JSON.parse(strip); C.sim = true;
          C.seed = (S.seed ^ (0x9E3779B1 * (k + 1))) | 0;
          for (const q of C.players) { q.isBot = true; q.skill = 'normal'; }
          const q = C.players[p.i];
          if (c.type === 'build') await hire(C, q, c.id);
          else if (c.type === 'buy') await buy(C, q, c.src, c.key);
          // остаток хода закрываем, дальше несколько кругов играют обычные боты
          q.turn.buysUsed = 99;
          await afterTurn(C, q);
          const stop = C.round + cfg.d;
          let g = 0;
          while (C.winner === null && C.round < stop && g++ < 60) await runTurn(C);
          sum[ci] += this.score(C, p.i); cnt[ci]++;
        }
        // в браузере даём странице перерисоваться между кругами прикидок
        if (typeof window !== 'undefined') await new Promise(r => setTimeout(r, 0));
        if (k >= 1 && cfg.ms && Date.now() - t0 > cfg.ms) break;
      }
      let best = null, bv = -Infinity;
      cands.forEach((c, ci) => { const v = sum[ci] / cnt[ci] + (c.type === 'pass' ? -0.5 : 0); if (v > bv) { bv = v; best = c; } });
      return best;
    },
    wantRecruit(S, p, aff) {
      if (p.skill === 'novice' && rnd(S) < 0.3) return false;
      // знамя почти всегда лучше; рано и при слабом доходе иногда выгоднее вложиться в доход
      const pick = this.pickBuild(S, p, aff);
      const P = this.P(p);
      if (P.recruit === 'eager') return true;
      // золота с запасом: узкое место — действия, а не деньги; копить дальше бессмысленно
      if (p.gold - pick.cost.total >= 6 + 2 * regCount(p)) return true;
      const best = this.bestPurchase(S, p);
      if (!best) return true;
      const inc = this.incomeEst(S, p);
      if (P.recruit === 'fast') return !(best.score > 9 + regCount(p) && inc < 3 + regCount(p));
      if (P.recruit === 'patient') return !(best.score > 3 + regCount(p) && inc < 8 + 1.2 * regCount(p));
      return !(best.score > 6 + regCount(p) && inc < 5 + regCount(p));
    },
    plotNums(S, p, count, exclude) {
      const w = [];
      for (let k = 1; k <= 12; k++) { if (exclude && exclude.includes(k)) continue; let s = 0; for (const q of S.players) s += this.pNum(S, q, k); w.push({ k, s: s + rnd(S) * 0.01 }); }
      w.sort((x, y) => y.s - x.s);
      return w.slice(0, count).map(x => x.k);
    },
    // кого бить: того, кто ближе к победе (знамёна + запас золота); за столом из 3–4 — особенно лидера
    leaderBias(S, p, o) {
      const sc = (q) => regCount(q) + q.gold / 12;
      let b = 1 + 0.25 * (sc(o) - sc(p));
      if (S.players.length > 2 && R.leaderFocus !== false) { const top = Math.max(...opps(S, p).map(sc)); if (sc(o) >= top) b += (R.leaderFocusW != null ? R.leaderFocusW : 0.35); }
      return clamp(b, 0.6, 2.2);
    },
    estateWorth(S, p, e) { const d = ES(e); return d.cost * 1.3 + (d.sym ? 2 : 0); },
    plantEstateValue(S, p, id) {
      const d = ES(id), T = this.horizon(S), k = 1 / Math.max(1, S.players.length - 1);
      if (faithBan(S, p, 'spy')) return -5;
      let best = 0;
      for (const o of targetsOf(S, p)) {
        const h = this.curseRound(S, o, d.bad);
        if (h <= 0) continue;
        const purged = h * T > 5.5; // снимет, как только сможет: вред — пара кругов и его 2🪙 с действием
        const dmg = (purged ? h * Math.min(T, 2.5) + 3.5 : h * T) * (d.bad === 'tax' ? 1 + k : k); // Мытарь: его доход Ремёсел — нам
        best = Math.max(best, spyInfo(S, p, o, R.plantSpy || 3).p * dmg * this.leaderBias(S, p, o));
      }
      return best * this.PRANK.curse;
    },
    // v10.14, решение владельца: боты охотнее на пакости — проклятия ценят в 2,5 раза выше, козням +3 к оценке.
    // Парные партии (те же Дома и кубики): «охотный» бот выиграл 48 из 100 у прежнего — сила та же; проклятий в партии ~в 2,5 раза больше, сыгранных козней ~в 3
    PRANK: { curse: 2.5, scheme: 3 },
    // разрушение: соперник теряет владение (нам — только его потеря; в дуэли это весь выигрыш)
    razeSwing(S, a, t, maxCost, flag) {
      const el = destroyable(S, t, maxCost, flag);
      const k = 1 / Math.max(1, S.players.length - 1);
      if (!el.length) return 0;
      if (this._ls) return Math.max(...el.map(e => ES(e).cost)) * 1.2 * k;
      this._ls = true;
      try { return Math.max(...el.map(e => this.estateValue(S, t, e.id))) * k * this.leaderBias(S, a, t); } finally { this._ls = false; }
    },
    // ценность новых шпионских действий для нападающего (в золоте, с учётом вреда сопернику)
    spyLoot(S, a, t, kind, n) {
      const k = 1 / Math.max(1, S.players.length - 1), steal = (x) => Math.min(x + (mods(S, a).stealBonus || 0), Math.max(2, t.gold)) * this.zs(S);
      const avgA = 1.2, avgT = 1.2;
      switch (kind) {
        case 'grab': return t.discard.length ? 1.5 + 1.2 * k : 0;
        case 'burn': return t.discard.length ? Math.min(n, t.discard.length) * 1.1 * k : 0;
        case 'poach': { const pr = (id) => (R.poachHalf ? Math.ceil(D.BAN[id].cost / 2) : D.BAN[id].cost); const ok = a.vassals.length < needOf(S, 'v') && t.vassals.some(id => pr(id) <= a.gold); return ok ? (R.poachHalf ? 10 * k + 6 : 8 * k + 4) : 0; }
        case 'lock': { const cheap = Math.min(...[...rowOf(S, 'v'), ...rowOf(S, 'l')].map(id => banCost(S, t, id).total), 99); return t.gold + 4 >= cheap ? 5 * k + 1 : 1.5 * k; }
        case 'tax': return Math.min(t.gold, regCount(t) * n) * k * 1.1;
        case 'distract': return t.lords.length ? 4 * k : 0;
        case 'riot': return upkeepList(t).length ? n * k * 1.4 : 0;
        case 'sabotage': return t.plots.length ? 3 * this.zs(S) : on(S, 'seats') && (t.seats || []).length ? 1.5 : 0;
        case 'arson': return Math.min(n, Math.max(1, t.gold)) * k * 1.1;
        case 'denounce': return Math.min(n, t.hand.length) * 1.4 * k;
        case 'slander': return 2 * k + 0.5;
        case 'feast': return (Math.min(1, t.hand.length) * 1.4 + Math.min(n, t.gold)) * k;
      }
      return steal(n || 2);
    },
    // захват владения: нападающий получает его ценность, жертва теряет свою (в дуэли это весь выигрыш соперника).
    // Если жертва может откупиться (R.ransom), размах ограничен ценой владения: плюс вам, минус ей.
    lootSwing(S, a, t, maxCost, ransom) {
      const el = capturable(S, t, a, maxCost);
      const k = 1 / Math.max(1, S.players.length - 1);
      if (!el.length) return { v: 0, uid: null }; // брать нечего — ничего
      if (this._ls) return { v: Math.max(...el.map(e => ES(e).cost)) * 1.3 * (1 + k), uid: el[0].uid };
      this._ls = true;
      let best = el[0].uid, bv = -1; const seen = {};
      try {
        for (const e of el) {
          let v = seen[e.id];
          if (v == null) {
            v = this.estateValue(S, a, e.id) * 0.8 + this.estateValue(S, t, e.id) * k;
            if (ransom) { const c = ES(e).cost; if (t.gold >= c) v = Math.min(v, c * (1 + k) + 0.5); }
            seen[e.id] = v;
          }
          if (v > bv) { bv = v; best = e.uid; }
        }
      } finally { this._ls = false; }
      return { v: bv, uid: best };
    },
    decide(S, p, q) {
      switch (q.type) {
        case 'target': {
          let best = null, bv = -Infinity;
          for (const o of q.options) {
            const t = S.players[o.i];
            let v;
            if (q.kind === 'siege') {
              v = o.p * this.lootSwing(S, p, t, R.siegeLoot, R.siegeRansom).v;
            } else if (q.kind === 'raze') {
              v = o.p * this.razeSwing(S, p, t, q.maxCost, q.flag);
            } else if (q.kind === 'plantEstate') {
              v = o.p * (0.5 + this.curseRound(S, t, ES(q.estate).bad));
            } else if (q.kind === 'wrath') {
              v = this.lootSwing(S, p, t, R.wrathLoot || 6, false).v;
            } else if (q.kind === 'penancePoor' || q.kind === 'ritualPoor') {
              v = -t.gold;
            } else {
              const pk = o.p != null ? o.p : (o.ok ? 1 : 0);
              if (pk < 0.12) { v = -10 + rnd(S); }
              else {
                if (q.effect === 'steal') v = Math.min(q.param, t.gold);
                else if (q.effect === 'sabotage') v = t.plots.length ? 4 : (t.seats || []).length ? 1.5 : 0;
                else if (q.effect === 'estate') v = this.lootSwing(S, p, t, q.param, false).v;
                else v = this.spyLoot(S, p, t, q.effect, q.param);
                v *= pk;
              }
            }
            v *= this.leaderBias(S, p, t);
            if (v > bv) { bv = v; best = o.i; }
          }
          return best;
        }
        case 'grab': case 'snatch': case 'fetchOne': { const avg = this.avgPower(S, p); let b = q.options[0], bv = -Infinity; for (const id of q.options) { const v = D.COURT[id].bad ? -9 : this.power(S, p, id, avg); if (v > bv) { bv = v; b = id; } } return b; }
        case 'buyoff': {
          // откупиться, если ожидаемый ущерб (шанс удачи × что потеряем) больше цены откупа
          if (p.gold < q.cost) return false;
          const a = S.players[q.from];
          let loss;
          if (q.plantEstate) loss = 3.5 + 1.5 * this.curseRound(S, p, ES(q.plantEstate).bad); // снимать: действие и 2🪙, а пока лежит — вред
          else if (q.effect === 'estate') loss = this.lootSwing(S, a, p, q.param, false).v;
          else if (q.effect === 'steal') loss = Math.min(q.param || 2, p.gold);
          else loss = this.spyLoot(S, a, p, q.effect, q.param);
          return (q.odds || 0) * loss > q.cost * 1.05 && p.gold - q.cost >= 2;
        }
        case 'burn': { const t = S.players[q.from], avg = this.avgPower(S, t); return q.options.filter(id => !D.COURT[id].bad).sort((x, y) => this.power(S, t, y, avg) - this.power(S, t, x, avg)).slice(0, q.max); }
        case 'poach': { let b = q.options[0], bv = -Infinity; for (const id of q.options) { const v = this.banWorth(S, p, id) - D.BAN[id].cost * 0.5; if (v > bv) { bv = v; b = id; } } return b; }
        case 'distract': { const t = S.players[q.from]; let b = q.options[0], bv = -Infinity; for (const id of q.options) { const v = this.modValue(S, t, D.BAN[id].mods || {}, {}); if (v > bv) { bv = v; b = id; } } return b; }
        case 'raze': { const t = S.players[q.from]; let b = q.options[0], bv = -Infinity; for (const uid of q.options) { const e = t.estates.find(x => x.uid === uid); if (!e) continue; const v = this.estateValue(S, t, e.id); if (v > bv) { bv = v; b = uid; } } return b; }
        case 'sinHire': case 'summon': { let b = q.options[0], bv = -Infinity; for (const id of q.options) { const v = banCost(S, p, id).total + this.banWorth(S, p, id); if (v > bv) { bv = v; b = id; } } return b; }
        case 'sinBanner': { let bk = 0, bv = -Infinity; q.options.forEach((o, k) => { const v = D.BAN[o.id].cost + this.banWorth(S, p, o.id); if (v > bv) { bv = v; bk = k; } }); return bk; }
        case 'sinCourtier': { let bk = 0, bv = -Infinity; q.options.forEach((o, k) => { const v = this.seatWorth(S, p, o.id) * this.leaderBias(S, p, S.players[o.i]); if (v > bv) { bv = v; bk = k; } }); return bk; }
        case 'penanceEstate': { let b = q.options[0], bv = Infinity; for (const uid of q.options) { const e = p.estates.find(x => x.uid === uid); if (!e) continue; const v = this.estateValue(S, p, e.id); if (v < bv) { bv = v; b = uid; } } return b; }
        case 'penanceSin': { let b = q.options[0], bv = -Infinity; for (const id of q.options) { const v = this.sinPen(S, p, D.COURT[id].sin); if (v > bv) { bv = v; b = id; } } return b; }
        case 'capture': {
          const t = S.players[q.from];
          let best = q.options[0], bv = -1;
          const ls = this.lootSwing(S, p, t, 99, q.blackmail || q.ransom);
          if (ls.uid != null && q.options.includes(ls.uid)) return ls.uid;
          for (const uid of q.options) { const e = t.estates.find(x => x.uid === uid); if (!e) continue; const v = this.estateWorth(S, p, e); if (v > bv) { bv = v; best = uid; } }
          return best;
        }
        case 'bribe': {
          if (p.gold < q.cost) return false;
          const d = D.ESTATES[q.estate]; if (!d) return false;
          // владение стоит оставить, если до конца партии оно принесёт больше своей цены (или держит союз, значок, стены)
          const keep = this.estateValue(S, p, q.estate) + (d.sym ? 2 : 0);
          return keep > q.cost * 1.1;
        }
        case 'adjust': {
          const sh = q.shifts || 0;
          const [cur, cd] = this.bestShift(S, p, q.vals, q.n, sh);
          let best = cd ? { a: 'shift', d: cd } : { a: 'accept' }, bv = cur + 0.5;
          if (q.rerolls > 0) { const ev = this.rollEV(S, p, q.n); if (ev > bv) { bv = ev; best = { a: 'reroll' }; } }
          if (q.ones > 0) for (let k = 0; k < q.vals.length; k++) {
            let ev = 0; for (let d = 1; d <= 6; d++) { const vs = q.vals.slice(); vs[k] = d; ev += this.bestShift(S, p, vs, q.n, sh)[0] / 6; }
            if (ev > bv) { bv = ev; best = { a: 'one', k }; }
          }
          // чудо «Перст судьбы»: повернуть кубик на лучшую грань
          if (q.sets > 0) for (let k = 0; k < q.vals.length; k++) for (let d = 1; d <= 6; d++) {
            if (d === q.vals[k]) continue;
            const vs = q.vals.slice(); vs[k] = d; const ev = this.bestShift(S, p, vs, q.n, sh)[0];
            if (ev > bv + 0.5) { bv = ev; best = { a: 'set', k, v: d }; }
          }
          return best;
        }
        case 'faithKeep': {
          const st = faithStage(S, p);
          const w = (f) => { const F = D.FAITHS[f]; let v = Object.keys(F.mods || {}).length; if (st >= 2) v += Object.keys(F.mods2 || {}).length + Object.keys(F.prod2 || {}).length; if (st >= 3) v += Object.keys(F.mods3 || {}).length; return v + (F.oath === 'no_renounce' ? 0.5 : 0); };
          return q.options.slice().sort((x, y) => w(y) - w(x))[0];
        }
        case 'peek': {
          const stop = this.rollScore(S, p, [q.v], 1);
          let more = 0; for (let d = 1; d <= 6; d++) more += this.rollScore(S, p, [q.v, d], 2) / 6;
          return more > stop + 0.2;
        }
        case 'dream': {
          const avg = this.avgPower(S, p), out = [];
          q.cards.forEach((id, i) => { const c = D.COURT[id]; const v = c.bad ? -9 : id === 'tax' ? 0 : this.power(S, p, id, avg); if (v < avg * 0.85) out.push(i); });
          return out;
        }
        case 'advantage': return this.rollValue(S, p, sum(q.a)) >= this.rollValue(S, p, sum(q.b)) ? 0 : 1;
        case 'predict': {
          // самое вероятное число при этом числе кубиков; при равных — где у вас доход
          let best = 7, bv = -1;
          for (let r = 1; r <= 12; r++) { const pr = pRoll(q.n, r); if (!pr) continue; const v = pr + 0.001 * this.rollValue(S, p, r); if (v > bv) { bv = v; best = r; } }
          return best;
        }
        case 'upkeep': {
          // оставить самых ценных, на кого хватает золота
          const ord = q.options.slice().sort((x, y) => this.banWorth(S, p, y) - this.banWorth(S, p, x));
          const keep = []; let left = q.gold - (q.extra || 0);
          for (const id of ord) { const u = D.BAN[id].upkeep || 0; if (u <= left) { keep.push(id); left -= u; } }
          return keep;
        }
        case 'plotNums': return this.plotNums(S, p, q.count || 1, q.exclude);
        case 'seatDrop':
        case 'seatReplace': {
          let bk = 0, bv = Infinity;
          q.options.forEach((id, k) => { const v = this.seatWorth(S, p, id); if (v < bv) { bv = v; bk = k; } });
          return bk;
        }
        case 'unseat': {
          let bk = null, bv = -Infinity;
          q.options.forEach((o, k) => { const t = S.players[o.i]; const v = this.seatWorth(S, t, o.id) * this.leaderBias(S, p, t); if (v > bv) { bv = v; bk = k; } });
          return bk;
        }
        case 'trash': {
          const avg = this.avgPower(S, p), lock = q.lock || [];
          const worth = (id) => (D.COURT[id].bad ? -9 : id === 'tax' ? 0 : this.power(S, p, id, avg));
          // жертва ритуала из сброса: самые слабые карты
          if (q.cards) return q.cards.map((id, i) => [i, worth(id)]).sort((a, b) => a[1] - b[1]).slice(0, q.need || q.max).map(x => x[0]);
          const total = this.allCards(p).length;
          const out = [];
          // обязательное число карт (покаяние, обряд, жертва ритуала) — добираем самыми слабыми, даже если колода маленькая
          const fill = () => { if (q.need && out.length < q.need) p.hand.map((id, i) => [i, worth(id)]).filter(([i]) => !out.includes(i) && !lock.includes(i)).sort((a, b) => a[1] - b[1]).slice(0, q.need - out.length).forEach(([i]) => out.push(i)); };
          p.hand.forEach((id, i) => { if (!lock.includes(i) && D.COURT[id].bad && out.length < q.max) out.push(i); });
          if (total - out.length <= 8 && !q.each) { fill(); return out; }
          p.hand.forEach((id, i) => { if (!lock.includes(i) && id === 'tax' && out.length < q.max && (total - out.length > 7 || q.each >= 2)) out.push(i); });
          fill();
          return out;
        }
        case 'ritualEstate': { let best = null, bv = Infinity; for (const uid of q.options) { const e = p.estates.find(x => x.uid === uid); if (!e) continue; const v = this.estateValue(S, p, e.id) + (e.ruined ? -1 : 0); if (v < bv) { bv = v; best = uid; } } return best; }
        case 'ritualCard': { const avg = this.avgPower(S, p); let best = null, bv = Infinity; for (const k of q.options) { const v = this.power(S, p, p.hand[k], avg); if (v < bv) { bv = v; best = k; } } return best; }
        case 'ritualVassal': { let best = null, bv = Infinity; for (const id of q.options) { const v = this.banWorth(S, p, id) + D.BAN[id].cost * 0.2; if (v < bv) { bv = v; best = id; } } return best; }
        case 'borrow': { const avg = this.avgPower(S, p); let best = null, bv = 0.5; q.options.forEach((o, k) => { const v = this.power(S, p, o.id, avg); if (v > bv) { bv = v; best = k; } }); return best; }
        case 'dictate': {
          // кубики соперника: столько, сколько ему хуже (его доход по броску)
          let best = null, bv = 0.25;
          for (const i of q.options) { const o = S.players[i]; const e1 = this.rollEV(S, o, 1), e2 = this.rollEV(S, o, 2); if (Math.abs(e1 - e2) > bv) { bv = Math.abs(e1 - e2); best = { i, n: e1 < e2 ? 1 : 2 }; } }
          return best;
        }
      }
      return null;
    },
  };

  const build = (S, p, kind, id) => hire(S, p, id == null ? kind : id); // старое имя
  return {
    D, R, on, needOf, goal, goalText, meetsGoal, cardOn, houseOn, setHooks, newGame, runTurn, startOfTurn, play, roll, buy, hire, build, retire, fetchCard, endTurn, adoptFaith, renounceFaith, canAdopt, faithReq, faithMax,
    SKILL, SKILL_NAMES, SCORE_W, mods, prod, sym, walls, unionsOf, unionNeed, unionCount, regCount, banCost, hireBlock, faithBan, faithsOf, tierList, rowOf, allBans, upkeepOf, marketPrice, buysLeft, basicLeft,
    _t: { applyFx: (...a) => applyFx(...a), resolveRoll: (...a) => resolveRoll(...a), payUpkeep: (...a) => payUpkeep(...a), doSpy: (...a) => doSpy(...a), refreshRows, startOfTurn: (...a) => startOfTurn(...a), ritualEndTurn: (...a) => ritualEndTurn(...a), ritualTick: (...a) => ritualTick(...a), returnBorrowed: (...a) => returnBorrowed(...a), borrowCard: (...a) => borrowCard(...a) }, // для тестов
    cuFrom, modParts, incomeParts, dawnParts, guardOf, spyWalls, oathFree, discardOf, playedOf, takeFromDiscard, backToDeck, purgeBad, purgeBlock, prodSources, dawnGold, modSources, fetchLeft,
    nmG, shortG, canOwnEstate, plotSlots, seatMax, fairLimit, fairOf, isCursed, cursed, sinned, sinCount, takeSin, startPenance, penanceBlock,
    rollPreview, RIT, ritualOn, ritualsFor, ritualsOf, ritualBlock, startRitual, ritualAct, ritualActBlock, ritualProgress, haveNow, miraclesOf, miraclesOn, miracleOn, deckTopOf, borrowIdx, handFree, upkeepCost, extraCost, goalShort, attackOdds, rite, riteBlock, faithStage, faithCandles, oathBuy, oathPlay, canSeat, seatFromDiscard, unseatOptions, handSize, siegeOdds, razeOdds, spyInfo, capturable, destroyable, targetsOf, sameFaith, truce, buyAction, canBuyAction, extraOn, behindLeader, hireFree, pRoll, estateIncome, nm, ES, Bot, rnd, PERSONAS, NATURAL,
  };
})();
if (typeof module !== 'undefined') module.exports = Engine;
