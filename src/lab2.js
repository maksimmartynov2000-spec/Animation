// Лаборатория баланса v2: node lab2.js preset=full n=2000 sizes=2 [patch=file.json] [out=file.json] [salt=0] [skill=normal]
// Выводит: доли побед Домов, первый ход, длину партии, золото в конце, простои, содержание, союзы, нападения.
const DATA = require('./data.js'); global.DATA = DATA;
const fs = require('fs');
const ARGS = Object.fromEntries(process.argv.slice(2).map(a => a.split('=')));
const deep = (dst, src) => { for (const k in src) { if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === 'object') deep(dst[k], src[k]); else if (src[k] === null) delete dst[k]; else dst[k] = src[k]; } };
if (ARGS.patch) { const pt = JSON.parse(fs.readFileSync(ARGS.patch, 'utf8')); for (const sec of ['RULES', 'ESTATES', 'COURT', 'BAN', 'HOUSES', 'FAITHS', 'NEEDS']) if (pt[sec]) deep(DATA[sec], pt[sec]); }
const E = require('./engine.js');
const preset = ARGS.preset || 'full';
const MODS = ARGS.mods != null ? ARGS.mods.split(',').filter(Boolean) : DATA.PRESETS[preset].modules; // mods=lords,faith — свой набор модулей
const modObj = { mod: Object.fromEntries(DATA.MODULE_KEYS.map(k => [k, MODS.includes(k)])) };
const HOUSES = Object.keys(DATA.HOUSES).filter(h => E.cardOn(modObj, 'house', h));
const N = +(ARGS.n || 1000), SIZES = (ARGS.sizes || '2').split(',').map(Number), SALT = +(ARGS.salt || 0);
const skill = ARGS.skill || 'normal';

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

let T = null;
E.setHooks({ event: (S, type, d) => {
  if (!T) return;
  if (type === 'turn') { T.turns++; T.cur = { p: d.p, act: 0 }; }
  if ((type === 'buy' || type === 'regalia') && T.cur) T.cur.act++;
  if (type === 'endturn' && T.cur) { if (!T.cur.act) T.idle++; }
  if (type === 'regalia') { const t = d.tier; T.hire[t] = (T.hire[t] || 0) + 1; T.hireRound[t] = (T.hireRound[t] || 0) + S.round; T.hirePrice[t] = (T.hirePrice[t] || 0) + d.cost; T.picked[d.id] = (T.picked[d.id] || 0) + 1; }
  if (type === 'upkeep') { T.upkeep += d.paid; T.released += d.released.length; }
  if (type === 'siege') { T.sieges++; if (d.win) T.siegeWins++; }
  if (type === 'spy') { T.spies++; if (d.ok) T.spyWins++; }
  if (type === 'union') T.unions++;
  if (type === 'retire') T.retire++;
  if (type === 'log' && !d.edit) T.kinds[d.kind] = (T.kinds[d.kind] || 0) + 1;
  if (type === 'faith' && d.adopt) T.faith[S.players[d.p].house + ':' + d.id] = (T.faith[S.players[d.p].house + ':' + d.id] || 0) + 1;
  if (type === 'spy' && d.plant) T.plants++;
  if (type === 'siege' && d.raze) T.razes++;
} });

const agg = {};
(async () => {
  for (const size of SIZES) {
    const A = agg[size] = { games: 0, rounds: [], wins: {}, plays: {}, firstWins: 0, endGold: 0, loserBan: 0, turns: 0, idle: 0, upkeep: 0, released: 0, sieges: 0, siegeWins: 0, spies: 0, spyWins: 0, unions: 0, retire: 0, hire: {}, hireRound: {}, hirePrice: {}, picked: {}, timeouts: 0, pair: {}, kinds: {}, faith: {}, plants: 0, razes: 0 };
    const rng = mulberry(1000 + size * 77 + SALT * 7919);
    for (let g = 0; g < N; g++) {
      const pool = HOUSES.slice(); const hs = [];
      for (let k = 0; k < size; k++) hs.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
      const S = E.newGame({ seed: (rng() * 2 ** 31) | 0, modules: MODS, players: hs.map(h => ({ house: h, isBot: true, skill, persona: ARGS.persona === 'base' ? 'base' : (E.NATURAL[h] || 'base') })) });
      T = { kinds: {}, faith: {}, plants: 0, razes: 0, turns: 0, idle: 0, upkeep: 0, released: 0, sieges: 0, siegeWins: 0, spies: 0, spyWins: 0, unions: 0, retire: 0, hire: {}, hireRound: {}, hirePrice: {}, picked: {} };
      let guard = 0; const snap = {};
      while (S.winner === null && guard++ < 1200) { await E.runTurn(S); for (const r of [8, 11]) if (S.round >= r && !(r in snap)) { const c = S.players.map(E.regCount), mx = Math.max(...c); snap[r] = c.filter(x => x === mx).length === 1 ? c.indexOf(mx) : -1; } }
      if (S.winner === null) continue;
      for (const r of [8, 11]) if (snap[r] >= 0 && snap[r] != null) { A['lead' + r] = (A['lead' + r] || 0) + 1; if (snap[r] === S.winner) A['leadWin' + r] = (A['leadWin' + r] || 0) + 1; }
      A.games++; A.rounds.push(S.round);
      if (S.timeout) A.timeouts++;
      const w = S.players[S.winner];
      for (const p of S.players) A.plays[p.house] = (A.plays[p.house] || 0) + 1;
      A.wins[w.house] = (A.wins[w.house] || 0) + 1;
      if (S.winner === S.first) A.firstWins++;
      A.endGold += S.players.reduce((s, p) => s + p.gold, 0) / size;
      A.loserBan += S.players.filter(p => p !== w).reduce((s, p) => s + E.regCount(p), 0) / (size - 1);
      if (size === 2) { const [a, b] = hs.slice().sort(); const k = a + '>' + b; const e = A.pair[k] = A.pair[k] || [0, 0]; e[0]++; if (w.house === a) e[1]++; }
      for (const k of ['turns', 'idle', 'upkeep', 'released', 'sieges', 'siegeWins', 'spies', 'spyWins', 'unions', 'retire', 'plants', 'razes']) A[k] += T[k];
      for (const k of ['hire', 'hireRound', 'hirePrice', 'picked', 'kinds', 'faith']) for (const x in T[k]) A[k][x] = (A[k][x] || 0) + T[k][x];
    }
  }
  const out = {};
  for (const size of SIZES) {
    const A = agg[size], n = A.games || 1;
    const rs = A.rounds.slice().sort((a, b) => a - b);
    const wr = {}; for (const h of HOUSES) if (A.plays[h]) wr[h] = +(100 * A.wins[h] / A.plays[h] * size / 2).toFixed(1); // вдвоём — доля побед; больше игроков — к «честной» доле (×N/2)
    const res = {
      size, games: A.games, rounds: +(rs.reduce((a, b) => a + b, 0) / n).toFixed(1), r10: rs[Math.floor(n * 0.1)], r90: rs[Math.floor(n * 0.9)], timeouts: A.timeouts,
      first: +(100 * A.firstWins / n).toFixed(1), wr, lead8: A.lead8 ? +(100 * (A.leadWin8 || 0) / A.lead8).toFixed(0) : null, lead11: A.lead11 ? +(100 * (A.leadWin11 || 0) / A.lead11).toFixed(0) : null, endGold: +(A.endGold / n).toFixed(1), loserBan: +(A.loserBan / n).toFixed(2),
      idle: +(100 * A.idle / A.turns).toFixed(1), upkeep: +(A.upkeep / n).toFixed(1), released: +(A.released / n).toFixed(2),
      unions: +(A.unions / n).toFixed(2), retire: +(A.retire / n).toFixed(1), sieges: +(A.sieges / n).toFixed(2), siegeWin: A.sieges ? +(100 * A.siegeWins / A.sieges).toFixed(0) : 0, spies: +(A.spies / n).toFixed(2), spyWin: A.spies ? +(100 * A.spyWins / A.spies).toFixed(0) : 0,
      hireRound: Object.fromEntries(Object.keys(A.hire).map(t => [t, +(A.hireRound[t] / A.hire[t]).toFixed(1)])),
      hirePrice: Object.fromEntries(Object.keys(A.hire).map(t => [t, +(A.hirePrice[t] / A.hire[t]).toFixed(1)])),
      wins: A.wins, plays: A.plays, firstWins: A.firstWins, roundsSum: A.rounds.reduce((a, b) => a + b, 0), picked: A.picked, pair: A.pair, faith: A.faith, kinds: Object.fromEntries(Object.entries(A.kinds).map(([k, v]) => [k, +(v / n).toFixed(2)])), plants: +(A.plants / n).toFixed(2), razes: +(A.razes / n).toFixed(2),
    };
    out[size] = res;
    if (!ARGS.quiet) {
      const wrs = Object.entries(wr).sort((a, b) => b[1] - a[1]).map(([h, v]) => `${h} ${v}`).join(' ');
      console.log(`${preset} ${size}p n=${res.games} круги ${res.rounds} (${res.r10}–${res.r90}) первый ${res.first}% | ${wrs}`);
      console.log(`   золото в конце ${res.endGold}, у проигравших знамён ${res.loserBan}, простои ${res.idle}%, содержание ${res.upkeep}🪙/партия, ушло великих ${res.released}, союзов ${res.unions}, отставок ${res.retire}, осад ${res.sieges} (${res.siegeWin}%), шпионов ${res.spies} (${res.spyWin}%)`);
      const fa = Object.values(A.faith).reduce((a, b) => a + b, 0) / n;
      console.log(`   вера: принятий ${fa.toFixed(2)} за партию; разрушений ${res.razes}, подсунуто ${res.plants}, отстроено ${res.kinds.repair || 0}, вербовок ${res.kinds.steal ? '' : ''}`);
      console.log(`   наём: круг ${JSON.stringify(res.hireRound)} цена ${JSON.stringify(res.hirePrice)}${res.timeouts ? ' ТАЙМАУТЫ ' + res.timeouts : ''}`);
    }
  }
  if (ARGS.out) fs.writeFileSync(ARGS.out, JSON.stringify(out));
})().catch(e => { console.error(e); process.exit(1); });
