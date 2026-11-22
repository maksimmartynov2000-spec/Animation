// Лаборатория баланса «Претендентов»: массовые прогоны ботов-«характеров» и метрики интересности.
// node lab.js exp=natural n=3000 sizes=2,3,4,5,6 out=lab/natural.json [patch=patch.json]
const DATA = require('./data.js'); global.DATA = DATA;
const fs = require('fs');
const path = require('path');

const ARGS = Object.fromEntries(process.argv.slice(2).map(a => a.split('=')));
// патч правил/карт для A/B-проверок: { RULES:{...}, ESTATES:{id:{...}}, COURT:{...}, GREAT:{...}, HOUSES:{h:{mods:{...}}}, PERSONAS:{...} }
if (ARGS.patch) applyPatch(JSON.parse(fs.readFileSync(ARGS.patch, 'utf8')));
const E = require('./engine.js');
if (ARGS.patch) { const pt = JSON.parse(fs.readFileSync(ARGS.patch, 'utf8')); if (pt.PERSONAS) for (const k in pt.PERSONAS) E.PERSONAS[k] = { ...(E.PERSONAS[k] || {}), ...pt.PERSONAS[k] }; }

function applyPatch(pt) {
  const deep = (dst, src) => { for (const k in src) { if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === 'object') deep(dst[k], src[k]); else dst[k] = src[k]; } };
  for (const sec of ['RULES', 'ESTATES', 'COURT', 'GREAT', 'SEASONS', 'TITLES']) if (pt[sec]) deep(DATA[sec], pt[sec]);
  if (pt.HOUSES) for (const h in pt.HOUSES) {
    const src = pt.HOUSES[h];
    if (src.mods) Object.assign(DATA.HOUSES[h].mods, src.mods);
    for (const k of ['gold', 'deck', 'estates']) if (src[k] !== undefined) DATA.HOUSES[h][k] = src[k];
    if (src.regalia) for (const rid in src.regalia) { const r = DATA.HOUSES[h].regalia.find(x => x.id === rid); deep(r, src.regalia[rid]); }
  }
  if (pt.DELETE_ESTATE_MODS) for (const [h, k] of pt.DELETE_ESTATE_MODS) delete DATA.HOUSES[h].mods[k];
  // NEEDS: { title: { marshal: null } } — карта больше не требует модуля
  if (pt.NEEDS) for (const sec in pt.NEEDS) Object.assign(DATA.NEEDS[sec], pt.NEEDS[sec]);
}

// preset=basic|mid|full — набор модулей; Дома, которым нужен выключенный модуль, не участвуют
// mods=lords,plots — свой список модулей; off=sieges,spy — всё, кроме перечисленных
const MODS = ARGS.preset ? DATA.PRESETS[ARGS.preset].modules : ARGS.mods != null ? ARGS.mods.split(',').filter(Boolean) : ARGS.off ? DATA.MODULE_KEYS.filter(k => !ARGS.off.split(',').includes(k)) : null;
const HOUSES = Object.keys(DATA.HOUSES).filter(h => !MODS || !DATA.NEEDS.house[h] || MODS.includes(DATA.NEEDS.house[h]));
const NATURAL = { deer: 'econ', owl: 'sci', wolf: 'war', rose: 'spy', serpent: 'war', moon: 'sci', bear: 'econ', lion: 'deck', eagle: 'econ', sun: 'econ' };
const PERS = ['base', 'econ', 'war', 'spy', 'sci'];
const NAME2ID = {};
for (const id in DATA.ESTATES) NAME2ID[DATA.ESTATES[id].name] = id;
for (const id in DATA.COURT) NAME2ID[DATA.COURT[id].name] = id;

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- сбор событий ----------
let T = null;
E.setHooks({ event: (S, type, d) => { if (T) onEvent(S, type, d); } });
function onEvent(S, type, d) {
  switch (type) {
    case 'turn': T.cur = { p: d.p, play: 0, tax: 0, plot: 0, buy: 0, reg: 0, siege: 0, spy: 0, got: 0, r: S.round }; T.turns.push(T.cur); break;
    case 'log': {
      const c = T.cur; if (!c || d.edit) break;
      const k = d.kind;
      if (k === 'play' && d.pi === c.p) { if (d.text.includes('«Подать»')) c.tax++; else c.play++; }
      else if (k === 'plotset') { c.plot++; T.plotsSet[d.pi] = (T.plotsSet[d.pi] || 0) + 1; }
      else if (k === 'buy') {
        c.buy++;
        const m = d.text.match(/за (\d+)🪙/); if (m) T.spent += +m[1];
        const nm = d.text.match(/«(.+)»/); if (nm && NAME2ID[nm[1]]) T.bought.push([d.pi, NAME2ID[nm[1]], S.round]);
      } else if (k === 'regalia') { c.reg++; const m = d.text.match(/за (\d+)🪙/); if (m) T.spent += +m[1]; }
      else if (k === 'steal') { const m = d.text.match(/(\d+)🪙/); if (m) T.inter.steal += +m[1]; }
      else if (k === 'envy') { const m = d.text.match(/−(\d+)🪙/); if (m) T.envy += +m[1]; }
      else if (k === 'support') T.support += DATA.RULES.supportGold;
      else if (k === 'bribe') { const m = d.text.match(/откуп\D*(\d+)🪙/); if (m) T.bribes += +m[1]; }
      break;
    }
    case 'regalia': T.regEv.push([d.p, d.id, d.kind, S.round]); break;
    case 'siege': if (T.cur) T.cur.siege++; T.sieges++; if (d.win) T.siegeWins++; if (d.got) T.captures++; T.inter.siegeGold += d.gold || 0; T.siegeBy[d.a] = (T.siegeBy[d.a] || 0) + 1; break;
    case 'spy': if (T.cur) T.cur.spy++; T.spies++; if (d.ok) T.spyOk++; if (d.bribed) T.spyBribed++; T.spyBy[d.a] = (T.spyBy[d.a] || 0) + 1; break;
    case 'income': {
      const got = new Set();
      for (const x of d.ev) { got.add(x.to); if (x.from != null) T.inter.raid += x.amt; }
      for (const q of S.players) if (q.i !== d.a) { T.others++; if (got.has(q.i)) T.othersHit++; }
      if (got.has(d.a) && T.cur) T.cur.got = 1;
      T.rolls++;
      break;
    }
    case 'plot': T.plotsDone++; break;
    case 'seat': T.seated[d.p] = (T.seated[d.p] || 0) + 1; T.seatIds.push(d.id); break;
    case 'unseat': T.unseats++; break;
  }
}

// модель времени хода (секунды): база (подготовка, бросок, доходы) + карты (Подать — быстро) + действия + конфликты
const SEC = { base: 20, tax: 2, card: 6, act: 10, fight: 12 };
const turnSec = (t) => SEC.base + SEC.tax * t.tax + SEC.card * (t.play + t.plot) + SEC.act * (t.buy + t.reg) + SEC.fight * (t.siege + t.spy);

async function playGame(seed, players) {
  T = { turns: [], cur: null, spent: 0, bought: [], regEv: [], inter: { raid: 0, steal: 0, siegeGold: 0 }, envy: 0, support: 0, bribes: 0,
    sieges: 0, siegeWins: 0, captures: 0, spies: 0, spyOk: 0, spyBribed: 0, others: 0, othersHit: 0, rolls: 0, plotsDone: 0, plotsSet: {}, siegeBy: {}, spyBy: {}, seated: {}, seatIds: [], unseats: 0 };
  const S = E.newGame({ seed, modules: MODS || undefined, players: players.map(x => ({ house: x.house, persona: x.persona, skill: x.skill, isBot: true })) });
  const np = S.players.length;
  const start = S.players.map(p => p.gold);
  const snaps = [S.players.map(E.regCount)], snapsE = [S.players.map(p => p.estates.length)];
  let guard = 0;
  while (S.winner === null && guard++ < 4000) {
    const r0 = S.round;
    await E.runTurn(S);
    if (S.round !== r0 || S.winner !== null) { snaps.push(S.players.map(E.regCount)); snapsE.push(S.players.map(p => p.estates.length)); }
  }
  const turns = T.turns;
  const secs = turns.map(turnSec);
  const rec = {
    np, seed, rounds: S.round, turnNo: S.turnNo, winner: S.winner, first: S.first, timeout: !!S.timeout, stuck: S.winner === null,
    minutes: secs.reduce((a, b) => a + b, 0) / 60,
    turnSecAvg: secs.reduce((a, b) => a + b, 0) / Math.max(1, secs.length),
    turns: turns.length, empty: turns.filter(t => t.buy + t.reg === 0).length, gotOwn: turns.filter(t => t.got).length,
    plays: turns.reduce((a, t) => a + t.play + t.tax + t.plot, 0), acts: turns.reduce((a, t) => a + t.buy + t.reg, 0),
    others: T.others, othersHit: T.othersHit,
    sieges: T.sieges, siegeWins: T.siegeWins, captures: T.captures, spies: T.spies, spyOk: T.spyOk, spyBribed: T.spyBribed,
    inter: T.inter, envy: T.envy, support: T.support, bribes: T.bribes, spent: T.spent, plotsDone: T.plotsDone, unseats: T.unseats, seatIds: T.seatIds,
    snaps, snapsE,
    P: S.players.map(p => {
      const myTurns = turns.filter(t => t.p === p.i);
      const firstReg = T.regEv.find(x => x[0] === p.i);
      return {
        house: p.house, persona: p.persona, skill: p.skill, seat: (p.i - S.first + np) % np, reg: E.regCount(p), own: p.regalia.length,
        great: [...p.great], regalia: [...p.regalia], gold: p.gold, start: start[p.i],
        estates: p.estates.map(e => e.id), bought: T.bought.filter(b => b[0] === p.i).map(b => b[1]),
        regEv: T.regEv.filter(x => x[0] === p.i).map(x => [x[1], x[3]]),
        firstReg: firstReg ? firstReg[3] : null,
        stats: { ...p.stats }, prod: E.prod(S, p),
        turns: myTurns.length, empty: myTurns.filter(t => t.buy + t.reg === 0).length,
        plotsSet: T.plotsSet[p.i] || 0, siegesBy: T.siegeBy[p.i] || 0, spiesBy: T.spyBy[p.i] || 0, seated: T.seated[p.i] || 0, seatsEnd: [...(p.seats || [])],
      };
    }),
  };
  T = null;
  return rec;
}

// ---------- составы столов ----------
function tables(exp, np, n, rng) {
  const out = [];
  const pickHouses = () => [...HOUSES].map(h => [h, rng()]).sort((a, b) => a[1] - b[1]).slice(0, np).map(x => x[0]);
  for (let g = 0; g < n; g++) {
    const hs = pickHouses();
    let ps;
    if (exp === 'base') ps = hs.map(h => ({ house: h, persona: 'base' }));
    else if (exp === 'natural') ps = hs.map(h => ({ house: h, persona: NATURAL[h] }));
    else if (exp === 'mix') ps = hs.map(h => ({ house: h, persona: PERS[Math.floor(rng() * PERS.length)] }));
    else if (exp === 'mixb') ps = hs.map(h => ({ house: h, persona: ['base', ...PERS][Math.floor(rng() * 6)] }));
    else if (exp.startsWith('vs:')) { // vs:<persona> — один такой против остальных «обычных»
      const who = exp.slice(3); const k = g % np;
      ps = hs.map((h, i) => ({ house: h, persona: i === k ? who : 'base' }));
    } else if (exp.startsWith('skill:')) { // skill:<уровень> — один бот этого уровня против «обычных», родные характеры
      const lv = exp.slice(6); const k = g % np;
      ps = hs.map((h, i) => ({ house: h, persona: NATURAL[h], skill: i === k ? lv : 'normal', mark: i === k }));
    } else if (exp.startsWith('focus:')) { // focus:<Дом> — этот Дом в каждой партии, остальные случайные; у всех родные характеры
      const hh = exp.slice(6);
      const others = HOUSES.filter(h => h !== hh).map(h => [h, rng()]).sort((x, y) => x[1] - y[1]).slice(0, np - 1).map(x => x[0]);
      const k = g % np; const list = [...others]; list.splice(k, 0, hh);
      ps = list.map(h => ({ house: h, persona: NATURAL[h] }));
    } else if (exp.startsWith('duel:')) { // duel:<Дом>:<Дом>[:характер:характер] — одна и та же пара, первый ход по очереди
      const [, a, b, pa, pb] = exp.split(':');
      ps = (g % 2 ? [b, a] : [a, b]).map(h => ({ house: h, persona: (h === a ? pa : pb) || NATURAL[h] }));
    } else if (exp.startsWith('house:')) { // house:<id>:<persona> — этот Дом с этим характером против «обычных»
      const [, hh, pp] = exp.split(':');
      const others = HOUSES.filter(h => h !== hh).map(h => [h, rng()]).sort((a, b) => a[1] - b[1]).slice(0, np - 1).map(x => x[0]);
      const k = g % np; const list = [...others]; list.splice(k, 0, hh);
      ps = list.map(h => ({ house: h, persona: h === hh ? pp : 'base' }));
    } else throw new Error('exp?');
    out.push(ps);
  }
  return out;
}

// ---------- агрегирование ----------
const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100;
function uniqueLeader(arr) { const mx = Math.max(...arr); if (mx <= 0) return null; const idx = []; arr.forEach((v, i) => { if (v === mx) idx.push(i); }); return idx.length === 1 ? idx[0] : null; }
function wr(w, n) { const p = n ? w / n : 0; return { n, w, p: r2(100 * p), ci: r1(196 * Math.sqrt(p * (1 - p) / Math.max(1, n))) }; }

function aggregate(recs) {
  const np = recs[0].np;
  const ok = recs.filter(r => !r.stuck);
  const A = { np, games: recs.length, stuck: recs.length - ok.length };
  A.rounds = { avg: r1(avg(ok.map(r => r.rounds))), p10: pct(ok.map(r => r.rounds), 0.1), med: pct(ok.map(r => r.rounds), 0.5), p90: pct(ok.map(r => r.rounds), 0.9) };
  A.turnsPP = r1(avg(ok.map(r => r.turns / np)));
  A.minutes = { avg: r1(avg(ok.map(r => r.minutes))), p10: r1(pct(ok.map(r => r.minutes), 0.1)), p90: r1(pct(ok.map(r => r.minutes), 0.9)) };
  A.turnSec = r1(avg(ok.map(r => r.turnSecAvg)));
  A.waitMin = r2(A.turnSec * (np - 1) / 60);
  A.timeouts = ok.filter(r => r.timeout).length;
  // места за столом
  const seat = Array.from({ length: np }, () => ({ n: 0, w: 0 }));
  for (const r of ok) for (const p of r.P) { seat[p.seat].n++; if (r.P.indexOf(p) === r.winner) seat[p.seat].w++; }
  A.seat = seat.map(s => wr(s.w, s.n).p);
  // интрига
  let lc = 0, lc2 = 0, midN = 0, midW = 0, q3N = 0, q3W = 0, behind = 0, last = 0, ru = [], close = 0, dec = [], ecoN = 0, ecoW = 0, comboN = 0, comboW = 0;
  for (const r of ok) {
    const s = r.snaps; let prev = null, ch = 0;
    if (r.snapsE) {
      const mi = Math.floor((s.length - 1) / 2);
      const el = uniqueLeader(r.snapsE[mi]); if (el !== null) { ecoN++; if (el === r.winner) ecoW++; }
      const cl = uniqueLeader(s[mi].map((v, i) => 2 * v + r.snapsE[mi][i])); if (cl !== null) { comboN++; if (cl === r.winner) comboW++; }
    }
    for (const x of s) { const l = uniqueLeader(x); if (l !== null) { if (prev !== null && l !== prev) ch++; prev = l; } }
    lc += ch; if (ch >= 2) lc2++;
    const mid = s[Math.floor((s.length - 1) / 2)], q3 = s[Math.floor(3 * (s.length - 1) / 4)];
    const ml = uniqueLeader(mid); if (ml !== null) { midN++; if (ml === r.winner) midW++; }
    const ql = uniqueLeader(q3); if (ql !== null) { q3N++; if (ql === r.winner) q3W++; }
    const mx = Math.max(...mid), mn = Math.min(...mid);
    if (mid[r.winner] < mx) behind++;
    if (mid[r.winner] === mn && mn < mx) last++;
    const fin = s[s.length - 1];
    const runner = Math.max(...fin.filter((v, i) => i !== r.winner)); ru.push(runner); if (runner >= 7) close++;
    let lockIdx = -1; s.forEach((x, i) => { if (uniqueLeader(x) !== r.winner) lockIdx = i; });
    dec.push((s.length - 1 - lockIdx) / s.length);
  }
  const G = ok.length;
  A.intrigue = { leadChanges: r2(lc / G), twoPlusChanges: r1(100 * lc2 / G), midLeaderWins: r1(100 * midW / Math.max(1, midN)), q3LeaderWins: r1(100 * q3W / Math.max(1, q3N)),
    ecoLeaderWins: r1(100 * ecoW / Math.max(1, ecoN)), comboLeaderWins: r1(100 * comboW / Math.max(1, comboN)), winnerBehindAtMid: r1(100 * behind / G), winnerLastAtMid: r1(100 * last / G), runnerUpBanners: r2(avg(ru)), closeFinish: r1(100 * close / G), decidedShare: r1(100 * avg(dec)), fair: r1(100 / np) };
  // темп и простои
  A.tempo = { emptyTurns: r1(100 * avg(ok.map(r => r.empty / r.turns))), playsPerTurn: r2(avg(ok.map(r => r.plays / r.turns))), actsPerTurn: r2(avg(ok.map(r => r.acts / r.turns))),
    ownRollPays: r1(100 * avg(ok.map(r => r.gotOwn / r.turns))), othersRollPays: r1(100 * avg(ok.map(r => r.othersHit / Math.max(1, r.others)))) };
  // взаимодействие
  const gross = ok.map(r => { const created = r.spent + r.P.reduce((a, p) => a + p.gold - p.start, 0) + r.envy + r.bribes; const inter = r.inter.raid + r.inter.steal + r.inter.siegeGold; return { created, inter }; });
  A.interaction = { sieges: r2(avg(ok.map(r => r.sieges))), siegeWin: r1(100 * ok.reduce((a, r) => a + r.siegeWins, 0) / Math.max(1, ok.reduce((a, r) => a + r.sieges, 0))), captures: r2(avg(ok.map(r => r.captures))),
    spies: r2(avg(ok.map(r => r.spies))), spyOk: r1(100 * ok.reduce((a, r) => a + r.spyOk, 0) / Math.max(1, ok.reduce((a, r) => a + r.spies, 0))), spyBribed: r1(100 * ok.reduce((a, r) => a + r.spyBribed, 0) / Math.max(1, ok.reduce((a, r) => a + r.spies, 0))),
    raidGold: r1(avg(ok.map(r => r.inter.raid))), stealGold: r1(avg(ok.map(r => r.inter.steal))), siegeGold: r1(avg(ok.map(r => r.inter.siegeGold))),
    interShare: r1(100 * avg(gross.map(g => g.inter / Math.max(1, g.created + g.inter)))), envy: r1(avg(ok.map(r => r.envy))), support: r1(avg(ok.map(r => r.support))), bribes: r1(avg(ok.map(r => r.bribes))), plotsDone: r1(avg(ok.map(r => r.plotsDone))) };
  // победы: Дома, характеры, Дом×характер
  const by = (keyf) => { const m = {}; for (const r of ok) r.P.forEach((p, i) => { const k = keyf(p); if (!m[k]) m[k] = { n: 0, w: 0 }; m[k].n++; if (i === r.winner) m[k].w++; }); const o = {}; for (const k in m) o[k] = wr(m[k].w, m[k].n); return o; };
  A.house = by(p => p.house);
  // покупки на игрока за партию: карты двора и владения
  { let c = 0, e = 0, n = 0; for (const r of ok) for (const p of r.P) { n++; for (const id of p.bought) { if (DATA.COURT[id]) c++; else e++; } } A.shop = { courtPP: r2(c / Math.max(1, n)), estatePP: r2(e / Math.max(1, n)) }; }
  // модуль «Придворные»: сколько раз за партию сажают ко двору, сколько опал, кто чаще сидит
  { let n = 0, st = 0, sb = 0; const ids = {}; for (const r of ok) { st += r.unseats || 0; for (const id of r.seatIds || []) ids[id] = (ids[id] || 0) + 1; for (const p of r.P) { n++; sb += p.seated || 0; } }
    A.seats = { seatedPP: r2(sb / Math.max(1, n)), unseatsPG: r2(st / Math.max(1, ok.length)), ids }; }
  // дуэли (2 игрока): пара Домов → сколько раз победил первый по алфавиту; Дом × место за столом
  if (np === 2) {
    const pairs = {};
    for (const r of ok) { const [x, y] = r.P; const k = [x.house, y.house].sort().join('|'); if (!pairs[k]) pairs[k] = { n: 0, w: 0 }; pairs[k].n++; if (r.P[r.winner].house === k.split('|')[0]) pairs[k].w++; }
    A.pairs = pairs;
  }
  A.houseSeat = by(p => p.house + ':' + p.seat);
  A.persona = by(p => p.persona);
  A.housePersona = by(p => p.house + ':' + p.persona);
  // профиль характеров
  const prof = {};
  for (const r of ok) r.P.forEach((p, i) => {
    const k = p.persona; if (!prof[k]) prof[k] = { n: 0, est: 0, land: 0, craft: 0, raid: 0, hold: 0, wall: 0, sci: 0, war: 0, int: 0, court: 0, merchant: 0, scholar: 0, knight: 0, spy: 0, sieges: 0, spies: 0, plots: 0, firstReg: [], gold: 0, empty: 0, turns: 0, stolen: 0, raidInc: 0 };
    const a = prof[k]; a.n++;
    a.est += p.estates.length; for (const id of p.estates) a[DATA.ESTATES[id].t]++;
    for (const s of ['sci', 'war', 'int']) a[s] += p.prod[s];
    for (const id of p.bought) if (DATA.COURT[id]) { a.court++; const role = DATA.COURT[id].role; if (role) a[role]++; }
    a.sieges += p.siegesBy; a.spies += p.spiesBy; a.plots += p.plotsSet; if (p.firstReg) a.firstReg.push(p.firstReg);
    a.gold += p.gold; a.empty += p.empty; a.turns += p.turns; a.stolen += p.stats.stolen; a.raidInc += p.stats.raidInc;
  });
  A.profile = {};
  for (const k in prof) { const a = prof[k]; const o = {}; for (const f in a) if (f !== 'n' && f !== 'firstReg' && f !== 'empty' && f !== 'turns') o[f] = r2(a[f] / a.n); o.firstReg = r1(avg(a.firstReg)); o.emptyTurns = r1(100 * a.empty / Math.max(1, a.turns)); A.profile[k] = o; }
  // карты: владения (у кого есть к концу), двор (купленные), великие лорды
  const cardStat = (getter) => { const m = {}; for (const r of ok) r.P.forEach((p, i) => { const ids = new Set(getter(p)); for (const id of ids) { if (!m[id]) m[id] = { n: 0, w: 0, cnt: 0 }; m[id].n++; if (i === r.winner) m[id].w++; } for (const id of getter(p)) { if (!m[id]) m[id] = { n: 0, w: 0, cnt: 0 }; m[id].cnt++; } }); const o = {}; for (const id in m) o[id] = { own: r1(100 * m[id].n / (G * np)), win: r1(100 * m[id].w / m[id].n), perGame: r2(m[id].cnt / G) }; return o; };
  A.estates = cardStat(p => p.estates.filter(id => !DATA.ESTATES[id].basic || true));
  A.boughtEstates = cardStat(p => p.bought.filter(id => DATA.ESTATES[id]));
  A.court = cardStat(p => p.bought.filter(id => DATA.COURT[id]));
  A.great = cardStat(p => p.great);
  // личные знамёна: средний раунд постройки и порядок
  const regs = {};
  for (const r of ok) for (const p of r.P) p.regEv.forEach(([id], k) => { if (!regs[id]) regs[id] = { n: 0, ord: 0, rnd: 0 }; regs[id].n++; regs[id].ord += k + 1; });
  for (const r of ok) for (const p of r.P) for (const [id, rd] of p.regEv) regs[id].rnd += rd;
  A.regalia = {}; for (const id in regs) A.regalia[id] = { per: r2(regs[id].n / G), order: r1(regs[id].ord / regs[id].n), round: r1(regs[id].rnd / regs[id].n) };
  return A;
}

(async () => {
  const exp = ARGS.exp || 'natural';
  const n = +(ARGS.n || 1000);
  const sizes = (ARGS.sizes || '2,3,4,5,6').split(',').map(Number);
  const out = { exp, n, patch: ARGS.patch || null, at: new Date().toISOString(), bySize: {} };
  const t0 = Date.now();
  for (const np of sizes) {
    const rng = mulberry(12345 + np * 1000 + (ARGS.salt ? +ARGS.salt : 0));
    const tabs = tables(exp, np, n, rng);
    const recs = [];
    for (let g = 0; g < tabs.length; g++) recs.push(await playGame(77777 + g * 13 + np * 100003 + (ARGS.salt ? +ARGS.salt * 7 : 0), tabs[g]));
    out.bySize[np] = aggregate(recs);
    if (ARGS.keep) out.bySize[np].recs = recs;
    process.stderr.write(`${exp} ${np}p: ${n} партий, ${((Date.now() - t0) / 1000).toFixed(0)} c\n`);
    if (ARGS.out) { fs.mkdirSync(path.dirname(ARGS.out), { recursive: true }); fs.writeFileSync(ARGS.out, JSON.stringify(out)); } // сохраняем после каждого размера
  }
  if (!ARGS.quiet) console.log(JSON.stringify(Object.fromEntries(Object.entries(out.bySize).map(([k, v]) => [k, { rounds: v.rounds, minutes: v.minutes, house: Object.fromEntries(Object.entries(v.house).map(([h, x]) => [h, x.p])), persona: Object.fromEntries(Object.entries(v.persona).map(([h, x]) => [h, x.p])) }]))));
})();
