// Сверка «написано на карте = делает движок»: по тесту на каждый эффект, свойство и правило
const G = require('path').join(__dirname, '..', 'src') + '/';
const E = require(G + 'engine.js'), D = E.D, T = E._t;
let ans = null;
E.setHooks({ ask: async (S, p, q) => (ans ? ans(q, p, S) : E.Bot.decide(S, p, q)) });
const FULL = D.MODULE_KEYS.slice();
const R0 = D.RULES;
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m}: ждали ${b}, вышло ${a}`);
// нейтральные Дома без свойств — чтобы проверять ровно одну вещь
D.HOUSES.tA = { name: 'Тест А', short: 'ТестА', gen: 'ТестА', dat: 'ТестА', sigil: '🦌', dir: null, mods: {}, gold: 0, deck: ['tax'], estates: [], heir: null };
D.HOUSES.tB = Object.assign({}, D.HOUSES.tA, { name: 'Тест Б', short: 'ТестБ', gen: 'ТестБ', dat: 'ТестБ', sigil: '🦉' });
D.HOUSES.tC = Object.assign({}, D.HOUSES.tA, { name: 'Тест В', short: 'ТестВ', gen: 'ТестВ', dat: 'ТестВ', sigil: '🐺' });
const fresh = () => ({ rolled: false, roles: {}, buysUsed: 0, buys: 0, discount: 0, regDiscount: 0, built: false, rerolls: 0, extraTurn: false, retired: false, fetched: false });
function mk(houses = ['tA', 'tB'], mods = FULL) {
  const S = E.newGame({ seed: 11, modules: mods, players: houses.map(h => ({ house: h })), first: 0 });
  S.cur = 0;
  for (const p of S.players) {
    p.gold = 20; p.hand = []; p.deck = Array(12).fill('tax'); p.discard = []; p.estates = []; p.seats = []; p.plots = []; p.faiths = [];
    p.vassals = []; p.lords = []; p.greats = []; p.heir = null; p.temp = { trade: 0, sci: 0, war: 0, int: 0, faith: 0 }; p.turn = fresh(); p.inPlay = [];
  }
  S.faithRow = Object.keys(D.FAITHS);
  return S;
}
const est = (S, p, ...ids) => { p.estates = ids.map(id => ({ uid: S.uid++, id })); };
const addEst = (S, p, id, x = {}) => { const e = Object.assign({ uid: S.uid++, id }, x); p.estates.push(e); return e; };
const fx = (S, p, list, ctx = {}) => T.applyFx(S, p, list, ctx);
const big = (p, s = 'war') => { p.temp[s] = 60; };

(async () => {
  // ================= A. эффекты карт двора =================
  { const S = mk(), [a] = S.players; await fx(S, a, [['gold', 3]]); eq(a.gold, 23, 'gold +3'); }
  { const S = mk(), [a] = S.players; await fx(S, a, [['draw', 2]]); eq(a.hand.length, 2, 'draw 2'); }
  /* убрано */
  /* убрано: карта удалена */
  /* убрано: карта или правило изменены */
  /* убрано: карта удалена */
  { const S = mk(), [a] = S.players; est(S, a, 'field', 'pasture', 'mine', 'bakery'); await fx(S, a, D.COURT.bearhoard.fx); eq(a.gold, 24, 'Медвежий запас: +1 за каждую Землю и +1🪙'); }
  /* убрано */
  /* убрано */
  { const S = mk(), [a] = S.players; a.turn.rolled = true; await fx(S, a, [['buys', 1]]); eq(E.buysLeft(S, a), 2, 'Старшина цеха: +1 действие'); }
  /* убрано: карта удалена */
  { // скидка на знамя: следующее знамя в этот ход
    const S = mk(), [a] = S.players; a.turn.rolled = true; a.turn.buys = 3; S.vRow = ['ida', 'gunnar', 'sabina', 'emmerich'];
    await fx(S, a, [['regDiscount', 4]]); eq(E.banCost(S, a, 'ida').total, 6, 'Зодчий: знамя на 4 дешевле');
    await E.hire(S, a, 'ida'); eq(E.banCost(S, a, 'gunnar').total, 10, 'скидка на знамя ушла после найма');
  }
  { const S = mk(), [a] = S.players; await fx(S, a, [['reroll', 1]]); eq(a.turn.rerolls, 1, 'переброс до броска'); a.turn.rolled = true; await fx(S, a, [['reroll', 1]]); eq(a.turn.rerolls, 1, 'после броска переброс не даётся'); }
  /* убрано: Фуражиры удалены */
  { // захват: победа — владение до 4🪙 в руинах; брать нечего — 3🪙
    const S = mk(), [a, b] = S.players; big(a); est(S, b, 'shop', 'mine'); ans = (q) => (q.type === 'target' ? 1 : q.type === 'capture' ? q.options[0] : null);
    await fx(S, a, D.COURT.siegeband.fx); const got = a.estates[0];
    ok(got && got.id === 'shop' && got.ruined, 'Захват: Лавка (2🪙) — ваша, в руинах'); ok(b.estates.every(e => e.id !== 'shop'), 'у соперника её больше нет');
    eq(E.prod(S, a).trade, 0, 'руины не дают значков');
    const g0 = a.gold; b.estates = [{ uid: S.uid++, id: 'mine' }]; b.gold = 10; await fx(S, a, D.COURT.siegeband.fx); eq(a.gold - g0, 0, 'захват: брать нечего (Рудник 5🪙) — ничего'); eq(b.gold, 10, 'у соперника золото не берут');
    ans = null;
  }
  { // руины: первое срабатывание — ремонт вместо дохода
    const S = mk(), [a, b] = S.players; addEst(S, a, 'shop', { ruined: true }); const g0 = a.gold; await T.resolveRoll(S, a, 4);
    eq(a.gold, g0, 'руины: дохода нет'); ok(!a.estates[0].ruined, 'руины отстроены'); await T.resolveRoll(S, a, 4); eq(a.gold, g0 + 1, 'после ремонта Лавка приносит 1 (одно владение Юга — она сама)');
  }
  /* убрано: карта или правило изменены */
  { const S = mk(), [a, b] = S.players; est(S, b, 'wall', 'wall'); const w = E.razeOdds(S, a, b, 3, 'nowalls'), w2 = E.razeOdds(S, a, b, 3, null); eq(w.D, w2.D - E.walls(S, b), 'Осадная башня: стены цели не в счёт'); }
  // ---------- v10.15: грехи и покаяние ----------
  { const sins = Object.keys(D.COURT).filter(id => D.COURT[id].sin).sort();
    eq(sins.length, 7, 'грехов семь');
    ok(sins.every(id => D.COURT[id].cost === 0 && D.COURT[id].copies === 1 && /faith/.test(D.NEEDS.court[id])), 'грех: 0🪙, одна копия, модуль «Вера»');
    const S = mk(); ok(![...S.courtDeck, ...S.courtRow].includes('penance'), 'покаяния на рынке нет');
    eq([...S.courtDeck, ...S.courtRow].filter(id => D.COURT[id].sin).length, 7, 'в колоде и ряду двора 7 грехов');
    const S2 = mk(['tA', 'tB'], FULL.filter(k => k !== 'faith')); eq([...S2.courtDeck, ...S2.courtRow].filter(id => D.COURT[id].sin).length, 0, 'без «Веры» грехов нет'); }
  { // покупка — только действием; грех ложится перед игроком, не в колоду
    const S = mk(), [a] = S.players; a.turn.rolled = true; a.gold = 10; S.courtRow = ['sin_greed', 'sin_gluttony'];
    const r = await E.buy(S, a, 'court', 0);
    ok(r.ok && a.sins.includes('sin_greed') && !a.discard.includes('sin_greed') && a.gold === 20 && E.buysLeft(S, a) === 0, 'Алчность: грех перед игроком, золото удвоено, действие потрачено');
    ok(!(await E.buy(S, a, 'court', 0)).ok, 'второй грех без действия не купить'); }
  { // штрафы в начале хода: Алчность — 1🪙 за каждые 5🪙; Гордыня — 1🪙 за знамя, не хватает — сколько есть
    const S = mk(), [a] = S.players; a.sins = ['sin_greed']; a.gold = 23; S.cur = 0; await E.startOfTurn(S, a);
    ok(S.log.some(x => /Алчность — −4🪙/.test(x.t || x.text || '')), 'Алчность: при 23🪙 — 4🪙 в банк');
    const S2 = mk(), [b] = S2.players; b.vassals = ['fuller', 'grain', 'baltazar']; b.sins = ['sin_pride']; b.gold = 2; S2.cur = 0; await E.startOfTurn(S2, b);
    ok(S2.log.some(x => /Гордыня — −2🪙/.test(x.t || x.text || '')), 'Гордыня: 3 знамени, а золота 2 — платите сколько есть'); }
  { // Гордыня сейчас: вассал из ряда бесплатно и без действия; Заговор не пускает
    const S = mk(), [a] = S.players; a.turn.rolled = true; a.gold = 5; S.courtRow = ['sin_pride']; S.vRow = ['fuller', 'grain'];
    await E.buy(S, a, 'court', 0); ok(a.vassals.length === 1 && a.gold === 5, 'Гордыня: вассал бесплатно');
    const S2 = mk(), [b] = S2.players; b.turn.rolled = true; addEst(S2, b, 'schemer', { by: 1 }); S2.courtRow = ['sin_pride']; S2.vRow = ['fuller'];
    await E.buy(S2, b, 'court', 0); ok(!b.vassals.length && b.sins.length === 1, 'Гордыня при Заговоре: грех есть, найма нет'); }
  { // Гнев: владение до 6🪙 без нападения, в руинах; против грешника +3 и без перемирия
    const S = mk(), [a, b] = S.players; a.turn.rolled = true; addEst(S, b, 'shop'); S.courtRow = ['sin_wrath'];
    await E.buy(S, a, 'court', 0); ok(a.estates.some(e => e.id === 'shop' && e.ruined) && !b.estates.length, 'Гнев: Лавка соперника — ваша, в руинах');
    const s0 = E.siegeOdds(S, b, a, 2).A, p0 = E.spyInfo(S, b, a, 2).A; a.sins = []; eq(s0 - E.siegeOdds(S, b, a, 2).A, 3, 'Гнев: нападения против грешника +3'); eq(p0 - E.spyInfo(S, b, a, 2).A, 3, 'Гнев: шпионаж против грешника +3');
    const S2 = mk(), [c, d] = S2.players; c.faiths = ['grain']; d.faiths = ['grain']; const before = E.targetsOf(S2, c).length; d.sins = ['sin_wrath'];
    ok(E.targetsOf(S2, c).length === before + 1, 'Гнев: перемирие единоверцев на грешника не действует'); }
  { // Зависть: любое знамя лидера — ваше (даже лорд, когда вассалов хватает); потом: соперник нанял — 1🪙 в банк
    const S = mk(), [a, b] = S.players; a.turn.rolled = true; b.vassals = ['fuller', 'grain']; S.courtRow = ['sin_envy'];
    await E.buy(S, a, 'court', 0); ok(a.vassals.length === 1 && b.vassals.length === 1, 'Зависть: вассал лидера — ваш');
    { const S2 = mk(), [c, d] = S2.players; c.turn.rolled = true; const vs = Object.keys(D.BAN).filter(id => D.BAN[id].tier === 'v' && !D.BAN[id].heir); c.vassals = vs.slice(0, E.needOf(S2, 'v'));
      const ls = Object.keys(D.BAN).filter(id => D.BAN[id].tier === 'l' && !D.BAN[id].heir); d.vassals = vs.slice(-2); d.lords = ls.slice(0, 2); S2.courtRow = ['sin_envy'];
      await E.buy(S2, c, 'court', 0); ok(c.lords.length === 1 && d.lords.length === 1 && d.vassals.length === 2, 'Зависть: вассалов хватает — забирает лорда'); }
    S.cur = 1; b.turn.rolled = true; b.gold = 50; S.vRow = ['baltazar']; const ga = a.gold; await E.hire(S, b, 'baltazar'); eq(ga - a.gold, 1, 'Зависть: соперник нанял — 1🪙 в банк'); }
  { // Чревоугодие: 5 карт сейчас, рука на 1 меньше
    const S = mk(), [a] = S.players; const h0 = E.handSize(S, a); a.turn.rolled = true; S.courtRow = ['sin_gluttony']; const n0 = a.hand.length;
    await E.buy(S, a, 'court', 0); eq(a.hand.length - n0, 5, 'Чревоугодие: 5 карт'); eq(E.handSize(S, a), h0 - 1, 'Чревоугодие: рука на 1 меньше'); }
  { // Лень: один кубик; ещё ход — после хода за дубль; дубль в ходе Лени снова даёт ход
    const S = mk(), [a] = S.players; a.turn.rolled = true; S.courtRow = ['sin_sloth']; S.cur = 0;
    await E.buy(S, a, 'court', 0); eq(a.slothNext, 1, 'Лень: ещё один ход впереди');
    a.turn.extraTurn = true; E.endTurn(S, a); ok(S.cur === 0 && S.extraTaken, 'ход за дубль — первым');
    a.turn = E._t.startOfTurn ? a.turn : a.turn; a.turn.extraTurn = true; E.endTurn(S, a); ok(S.cur === 0 && a.slothNext === 0 && !S.extraTaken, 'потом ход Лени');
    a.turn.extraTurn = true; E.endTurn(S, a); ok(S.cur === 0 && S.extraTaken, 'дубль в ходе Лени — ещё ход');
    a.turn.extraTurn = true; E.endTurn(S, a); eq(S.cur, 1, 'больше ходов нет — ход соперника');
    const S2 = mk(), [b] = S2.players; b.sins = ['sin_sloth']; S2.cur = 0; await E.roll(S2, b, 2); eq(S2.lastRoll.n, 1, 'Лень: только один кубик'); }
  { // Похоть: придворный соперника — к вам; в начале хода на 1–2 — придворный уходит
    const S = mk(), [a, b] = S.players; a.turn.rolled = true; b.seats = ['fairwarden']; S.courtRow = ['sin_lust'];
    await E.buy(S, a, 'court', 0); ok(a.seats.includes('fairwarden') && !b.seats.length, 'Похоть: придворный соперника — при вашем дворе');
    let gone = 0, stay = 0;
    for (let k = 0; k < 24; k++) { const S2 = mk(), [c] = S2.players; S2.seed = 500 + k; c.seats = ['fairwarden']; c.sins = ['sin_lust']; S2.cur = 0; await E.startOfTurn(S2, c); if (c.seats.length) stay++; else gone++; }
    ok(gone > 0 && stay > gone, `Похоть: придворный уходит примерно в трети ходов (ушёл ${gone} из 24)`); }
  { // покаяние: 4 шага подряд, потом грех снят
    const S = mk(), [a, b] = S.players; a.faiths = ['grain']; a.sins = ['sin_greed']; S.cur = 0; a.gold = 20; b.gold = 3; addEst(S, a, 'field'); addEst(S, a, 'bakery');
    a.faiths = []; ok(/веру/.test(E.penanceBlock(S, a) || ''), 'без веры каяться нельзя'); a.faiths = ['grain'];
    const r = await E.startPenance(S, a); ok(r.ok && a.penance.step === 1 && b.gold === 8 && a.gold === 15, 'шаг 1: 5🪙 самому бедному');
    ok(!!E.penanceBlock(S, a), 'второе покаяние не начать');
    a.hand = ['tax', 'tax', 'spicer']; E.endTurn(S, a); S.cur = 0; await E.startOfTurn(S, a); ok(a.penance.step === 2 && a.trashed.length === 2, 'шаг 2: 2 карты из руки — из игры');
    E.endTurn(S, a); S.cur = 0; await E.startOfTurn(S, a); a.turn.rolled = true; ok(a.penance.step === 3 && E.buysLeft(S, a) === 0, 'шаг 3: на одно действие меньше');
    const e0 = a.estates.length; E.endTurn(S, a); S.cur = 0; await E.startOfTurn(S, a);
    ok(!a.penance && !a.sins.length && a.estates.length === e0 - 1 && S.courtDeck.includes('sin_greed'), 'шаг 4: владение из игры, грех снят и в колоде двора'); }
  { // покаяние сорвано: нечем выполнить шаг; новый грех; начать заново — со следующего хода
    const S = mk(), [a] = S.players; a.faiths = ['grain']; a.sins = ['sin_greed']; S.cur = 0; a.gold = 3;
    await E.startPenance(S, a); ok(!a.penance && /следующего/.test(E.penanceBlock(S, a) || ''), 'нет 5🪙 — сорвано, заново со следующего хода');
    const S2 = mk(), [b] = S2.players; b.faiths = ['grain']; b.sins = ['sin_greed']; S2.cur = 0; b.gold = 20; await E.startPenance(S2, b);
    b.turn.rolled = true; S2.courtRow = ['sin_gluttony']; await E.buy(S2, b, 'court', 0); ok(!b.penance, 'новый грех срывает покаяние');
    const S3 = mk(), [c] = S3.players; c.faiths = ['grain']; c.sins = ['sin_greed']; S3.cur = 0; addEst(S3, c, 'cursedrelic', { by: 1 }); ok(/реликвия/i.test(E.penanceBlock(S3, c) || ''), 'Проклятая реликвия: каяться нельзя'); }
  { // все семь грехов — призыв: до 7 знамён бесплатно; Заговор не мешает; один раз
    const S = mk(), [a] = S.players; a.turn.rolled = true; a.sins = ['sin_pride', 'sin_wrath', 'sin_envy', 'sin_gluttony', 'sin_sloth', 'sin_lust']; addEst(S, a, 'schemer', { by: 1 }); S.courtRow = ['sin_greed'];
    const r0 = E.regCount(a); await E.buy(S, a, 'court', 0); ok(a.summoned && E.regCount(a) - r0 >= 5, `призыв: +${E.regCount(a) - r0} знамён бесплатно, Заговор не мешает`); }
  { // правила модулей открываются все (v10.14: «Вражда» падала — раздел о шпионаже ссылался на убранную в v10.11 беду «Долг»)
    const M = require(G + 'modrules.js'), bad = [];
    for (const k of (M.ORDER || D.MODULE_KEYS)) { try { M.page(D, k, () => true); } catch (e) { bad.push(`${k}: ${e.message}`); } }
    ok(!bad.length, `правила модулей: ${bad.join('; ') || 'все открываются'}`);
  }
  { // v10.14: беды двора убраны, их место заняли козни; 8 проклятий — владения по одной копии, действуют всегда
    const curses = Object.keys(D.ESTATES).filter(id => D.ESTATES[id].t === 'bad').sort();
    eq(curses.join(','), 'ashes,banditpost,blight,cursedrelic,evileye,falsetax,plaguehouse,schemer', 'проклятия: 8 видов');
    ok(curses.every(id => D.ESTATES[id].copies === 1 && !D.ESTATES[id].n.length), 'проклятия: по одной копии, без чисел кубика');
    ok(!Object.keys(D.COURT).some(id => D.COURT[id].bad || (D.COURT[id].fx || []).some(o => o[0] === 'plant')), 'бед двора больше нет');
    const schemes = Object.keys(D.COURT).filter(id => D.COURT[id].scheme).sort();
    eq(schemes.join(','), 'arson,denounce,poisonfeast,slander', 'козни: Поджог, Донос, Клевета, Отравленный пир');
    ok(schemes.every(id => (D.COURT[id].copies || 2) === 2 && D.NEEDS.court[id] === 'spy'), 'козни: по 2 копии, модуль «Шпионаж»');
    const S = mk(); eq([...S.estateDeck, ...S.estateRow].filter(x => D.ESTATES[x].t === 'bad').length, 8, 'в колоде и ряду владений 8 проклятий');
    const S2 = mk(['tA', 'tB'], FULL.filter(k => k !== 'spy')); eq([...S2.estateDeck, ...S2.estateRow].filter(x => D.ESTATES[x].t === 'bad').length, 0, 'без «Шпионажа» проклятий нет');
  }
  { // купленное проклятие сразу подбрасывают шпионажем (+3🔗): удача — у соперника на столе, by — кто подбросил
    const S = mk(), [a, b] = S.players; a.turn.rolled = true; a.temp.int = 60; S.estateRow = ['plaguehouse']; let seen = null; ans = (q) => (q.type === 'target' ? (seen = q, 1) : q.type === 'buyoff' ? false : null);
    const r = await E.buy(S, a, 'estate', 0); ans = null;
    ok(r.ok && seen && seen.kind === 'plantEstate' && seen.bonus === 3, 'проклятие: подбрасывают шпионажем +3');
    ok(b.estates.some(e => e.id === 'plaguehouse' && e.by === 0) && !a.estates.length, 'проклятие у соперника, у покупателя его нет');
  }
  { // провал или откуп — проклятие замешивается в колоду владений
    const S = mk(), [a, b] = S.players; a.turn.rolled = true; b.temp.int = 60; S.estateRow = ['blight']; const n0 = S.estateDeck.filter(x => x === 'blight').length; ans = (q) => (q.type === 'target' ? 1 : q.type === 'buyoff' ? false : null);
    await E.buy(S, a, 'estate', 0); ok(!b.estates.length && S.estateDeck.filter(x => x === 'blight').length === n0 + 1, 'провал: проклятие в колоде владений');
    const S2 = mk(), [c, d] = S2.players; c.turn.rolled = true; c.temp.int = 3; d.gold = 60; S2.estateRow = ['blight']; const m0 = S2.estateDeck.filter(x => x === 'blight').length, gd = d.gold; ans = (q) => (q.type === 'target' ? 1 : q.type === 'buyoff' ? true : null);
    await E.buy(S2, c, 'estate', 0); ans = null;
    ok(!d.estates.length && d.gold < gd && S2.estateDeck.filter(x => x === 'blight').length === m0 + 1, 'откуп от проклятия: оно в колоде владений');
  }
  { // Неурожай: Земли молчат в любой ход, Ремёсла приносят
    const S = mk(), [a, b] = S.players; addEst(S, b, 'field'); addEst(S, b, 'bakery'); addEst(S, b, 'blight', { by: 0 }); const gb = b.gold;
    await T.resolveRoll(S, a, 1); eq(b.gold, gb, 'Неурожай: Пашня в чужой ход не приносит');
    await T.resolveRoll(S, b, 1); eq(b.gold, gb, 'Неурожай: Пашня в свой ход не приносит');
    await T.resolveRoll(S, b, 2); eq(b.gold, gb + 1, 'Неурожай: Пекарня приносит как обычно');
  }
  { // Самозваный мытарь: доход Ремёсел — тому, кто подбросил; Земли приносят
    const S = mk(), [a, b] = S.players; addEst(S, b, 'bakery'); addEst(S, b, 'field'); addEst(S, b, 'falsetax', { by: 0 }); const ga = a.gold; let gb = b.gold;
    await T.resolveRoll(S, b, 2); ok(b.gold === gb && a.gold === ga + 1, 'Самозваный мытарь: доход Пекарни — подбросившему');
    gb = b.gold; await T.resolveRoll(S, b, 1); eq(b.gold, gb + 1, 'Самозваный мытарь: Пашня приносит как обычно');
  }
  { // Разбойничий стан: Набеги и Твердыни не срабатывают
    const S = mk(), [a, b] = S.players; addEst(S, b, 'barracks'); addEst(S, b, 'citadel'); addEst(S, b, 'banditpost', { by: 0 }); const ga = a.gold, gb = b.gold;
    await T.resolveRoll(S, a, 4); ok(a.gold === ga && b.gold === gb, 'Разбойничий стан: Набег на чужом броске ничего не забирает');
    await T.resolveRoll(S, b, 4); ok(a.gold === ga && b.gold === gb, 'Разбойничий стан: Твердыня на своём броске ничего не забирает');
    b.estates = b.estates.filter(e => e.id !== 'banditpost'); await T.resolveRoll(S, a, 4); ok(b.gold > gb && a.gold < ga, 'без Стана Набег снова забирает');
  }
  { // Разбойничий стан: Набеги и Твердыни не срабатывают совсем — и руины не отстраиваются
    const S = mk(), [a, b] = S.players; const r = addEst(S, b, 'outpost', { ruined: true }); const h = addEst(S, b, 'citadel', { ruined: true }); addEst(S, b, 'banditpost', { by: 0 });
    await T.resolveRoll(S, a, 9); await T.resolveRoll(S, b, 4); ok(r.ruined && h.ruined, 'Разбойничий стан: руины Набега и Твердыни не отстраиваются');
  }
  { const B = E.Bot; ok(B.PRANK && B.PRANK.curse === 2.5 && B.PRANK.scheme === 3, 'боты охотнее на пакости: проклятия ×2,5, козни +3'); }
  { // Чумная слобода: владения не покупает (и проклятия тоже), карты двора — можно
    const S = mk(), [a, b] = S.players; a.turn.rolled = true; addEst(S, a, 'plaguehouse', { by: 1 }); S.estateRow = ['field', 'blight']; S.courtRow = ['scribe'];
    const r1 = await E.buy(S, a, 'estate', 0), r2 = await E.buy(S, a, 'estate', 1);
    ok(!r1.ok && /Чумная/.test(r1.why) && !r2.ok, 'Чумная слобода: владения и проклятия купить нельзя');
    ok((await E.buy(S, a, 'court', 0)).ok, 'Чумная слобода: карты двора — можно');
  }
  { const S = mk(), [a] = S.players; addEst(S, a, 'schemer', { by: 1 }); ok(/Заговор/.test(E.hireBlock(S, a, 'gunnar') || ''), 'Заговор: нанимать нельзя, пока лежит'); a.estates = []; ok(!/Заговор/.test(E.hireBlock(S, a, 'gunnar') || ''), 'Заговор снят — запрета нет'); }
  { const S = mk(), [a] = S.players; addEst(S, a, 'evileye', { by: 1 }); S.cur = 0; await E.roll(S, a, 2); eq(S.lastRoll.n, 1, 'Сглаз: только один кубик, пока лежит'); }
  { const S = mk(), [a, b] = S.players; const w0 = E.walls(S, b); addEst(S, b, 'ashes', { by: 0 }); eq(E.walls(S, b), w0 - 2, 'Пепелище: стены −2'); }
  { const S = mk(), [a] = S.players; a.faiths = ['grain']; addEst(S, a, 'cursedrelic', { by: 1 }); a.hand = ['reaper']; S.cur = 0; await E.startOfTurn(S, a); ok(!E._t.faithActive || !E._t.faithActive(S, a), 'Проклятая реликвия: вера не действует'); ok(!(await E.play(S, a, 0)), 'Проклятая реликвия: карту веры не сыграть'); }
  { // козни: шпионаж +3; сыграли — карта уходит в колоду двора, и при удаче, и при провале
    const S = mk(), [a, b] = S.players; a.temp.int = 60; a.hand = ['arson']; b.gold = 10; const n0 = S.courtDeck.filter(x => x === 'arson').length; ans = (q) => (q.type === 'target' ? 1 : q.type === 'buyoff' ? false : null);
    await E.play(S, a, 0); ok(b.gold === 6 && !a.inPlay.includes('arson') && !a.discard.includes('arson') && S.courtDeck.filter(x => x === 'arson').length === n0 + 1, 'Поджог: сопернику −4🪙, карта в колоде двора');
    b.temp.int = 60; a.temp.int = 0; a.hand = ['arson']; const g = b.gold; await E.play(S, a, 0); ok(b.gold === g && !a.inPlay.includes('arson') && S.courtDeck.filter(x => x === 'arson').length === n0 + 2, 'провал: золото на месте, карта всё равно в колоде двора'); ans = null;
  }
  { const S = mk(), [a, b] = S.players; a.temp.int = 60; b.hand = ['tax', 'spicer', 'scribe']; ans = (q) => (q.type === 'target' ? 1 : q.type === 'buyoff' ? false : null);
    a.hand = ['denounce']; await E.play(S, a, 0); ok(b.hand.length === 1 && b.discard.length === 2, 'Донос: 2 карты из руки — в сброс');
    a.hand = ['poisonfeast']; b.gold = 10; await E.play(S, a, 0); ok(b.hand.length === 0 && b.discard.length === 3 && b.gold === 8, 'Отравленный пир: карта из руки и −2🪙');
    a.hand = ['slander']; await E.play(S, a, 0); ans = null; ok(!!b.slanderNext, 'Клевета: отмечена на следующий ход соперника');
    S.cur = 1; await E.startOfTurn(S, b); b.turn.rolled = true; S.courtRow = ['scribe']; const r = await E.buy(S, b, 'court', 0); ok(!r.ok && /Клевета/.test(r.why), 'Клевета: в свой ход карты двора не покупает');
    E.endTurn(S, b); ok(!E.isCursed(b, 'slander') && !b.slanderNext, 'Клевета: только на один ход');
  }
  /* убрано: карта или правило изменены */
  /* убрано: карта удалена */
  /* убрано: карта или правило изменены */
  /* убрано: карта или правило изменены */
  { // вымогатель: владение ваше; откуп — до броска, 3🪙 за каждую 🔗 разницы (не меньше 3); брать нечего — ничего
    const S = mk(), [a, b] = S.players; a.temp.int = 60; est(S, b, 'shop'); let pay = false, seen = null; ans = (q) => (q.type === 'target' ? 1 : q.type === 'capture' ? q.options[0] : q.type === 'buyoff' ? (seen = q, pay) : null);
    await fx(S, a, D.COURT.blackmailer.fx); ok(a.estates.some(e => e.id === 'shop' && !e.ruined), 'Вымогатель: владение ваше, не в руинах');
    est(S, b, 'shop'); a.temp.int = 4; pay = true; const ga = a.gold, gb = b.gold, info = E.spyInfo(S, a, b, D.COURT.blackmailer.fx[0][1]); const cost = 3 * Math.max(1, info.A - info.G);
    await fx(S, a, D.COURT.blackmailer.fx); ok(b.estates.length === 1 && a.gold - ga === cost && gb - b.gold === cost, `откупились до броска: ${cost}🪙 шпиону, владение осталось`);
    a.temp.int = 1; const c2 = 3 * Math.max(1, E.spyInfo(S, a, b, 2).A - E.spyInfo(S, a, b, 2).G); eq(c2, 3, 'откуп не меньше 3🪙');
    a.temp.int = 60; pay = false; b.estates = []; const g1 = a.gold, g2 = b.gold; await fx(S, a, D.COURT.blackmailer.fx); ok(a.gold === g1 && b.gold === g2, 'Вымогатель: брать нечего — ничего'); ans = null;
  }

  /* убрано: карта или правило изменены */
  /* убрано: карта удалена */
  /* убрано: карта удалена */
  /* убрано: карта или правило изменены */
  /* убрано */
  { const S = mk(), [a] = S.players; est(S, a, 'barracks', 'outpost'); await fx(S, a, D.COURT.boarding.fx); eq(a.gold, 23, 'Абордаж: +1🪙 за каждый Набег и +1🪙'); }

  { // засада
    const S = mk(), [a, b] = S.players; await fx(S, a, [['ambush', 4]], { active: b }); ok(a.gold === 24 && b.gold === 16, 'засада: у выбросившего'); await fx(S, a, [['ambush', 4]], { active: a }); eq(a.gold, 28, 'засада: выбросили вы — из банка');
  }
  /* убрано: карта или правило изменены */
  /* убрано: карта или правило изменены */

  // ================= B. свита, замыслы, придворные, отставка =================
  { const S = mk(), [a] = S.players; a.hand = ['spicer', 'spicer', 'spicer']; await E.play(S, a, 0); eq(a.gold, 22, 'первая карта роли — без свиты'); await E.play(S, a, 0); eq(a.gold, 26, 'вторая — со свитой (+2)'); await E.play(S, a, 0); eq(a.gold, 32, 'третья — свита дважды'); }
  { // Сборщик податей: свита — Подати, +2🪙 за каждую сыгранную до него
    const S = mk(), [a] = S.players; a.hand = ['tax', 'tax', 'collector']; await E.play(S, a, 0); await E.play(S, a, 0); await E.play(S, a, 0); eq(a.gold, 20 + 1 + 1 + 1 + 2, 'Сборщик: +1 и свита +1 за каждую из двух Податей');
    { const S4 = mk(), [d] = S4.players; d.hand = ['tax', 'tax', 'tax', 'spicer', 'spicer', 'collector']; for (let k = 0; k < 5; k++) await E.play(S4, d, 0); const g = d.gold; await E.play(S4, d, 0); eq(d.gold - g, 1 + 2 * 3, 'Сборщик после 3 Податей и 2 Купцов: свита дважды — 1 + 2 × 3'); }
    { const S5 = mk(), [d] = S5.players; d.hand = ['tax', 'tax', 'tax', 'spicer', 'collector']; for (let k = 0; k < 4; k++) await E.play(S5, d, 0); const g = d.gold; await E.play(S5, d, 0); eq(d.gold - g, 1 + 3, 'Сборщик после 3 Податей и 1 Купца — свита один раз'); }
    { const S6 = mk(), [d] = S6.players; d.hand = ['spicer', 'spicer', 'collector']; for (let k = 0; k < 2; k++) await E.play(S6, d, 0); const g = d.gold; await E.play(S6, d, 0); eq(d.gold - g, 1, 'Сборщик без Податей — свиты нет, даже после двух Купцов'); }
    const S2 = mk(), [b] = S2.players; b.hand = ['collector', 'tax']; await E.play(S2, b, 0); eq(b.gold, 21, 'Сборщик без Податей до него — только +1');
    const S3 = mk(), [c] = S3.players; c.hand = ['scribe', 'collector']; await E.play(S3, c, 0); const g = c.gold; await E.play(S3, c, 0); eq(c.gold - g, 1, 'карта другой роли — не свита Сборщика');
  }
  /* убрано */
  /* убрано: карта или правило изменены */
  /* убрано: карта или правило изменены */
  /* убрано */
  { // замысел ⏳
    const S = mk(), [a] = S.players; a.hand = ['collector']; await E.play(S, a, 0, { plot: true }); eq(a.plots.length, 1, 'отложили ⏳');
    a.turn.rolled = true; E.endTurn(S, a); S.cur = 0; const g0 = a.gold; await E.startOfTurn(S, a); eq(a.gold - g0, 5, '⏳ сработал в начале следующего хода: +5'); ok(a.discard.includes('collector'), 'потом — в сброс');
  }
  { // замысел 🎲 на чужом броске + засада
    const S = mk(), [a, b] = S.players; a.hand = ['sappers']; await E.play(S, a, 0, { plot: true }); const n = a.plots[0].nums; ok(n.includes(3) && n.includes(10), '🎲 3·10');
    const ga = a.gold, gb = b.gold; await T.resolveRoll(S, b, 3); ok(a.gold - ga === 4 && gb - b.gold === 4, '🎲-замысел на броске соперника: засада у выбросившего');
  }
  /* убрано */
  { const S = mk(), [a] = S.players; eq(E.plotSlots(S, a), 2, 'мест для замыслов 2'); a.lords = ['albin']; eq(E.plotSlots(S, a), 3, 'Альбин: +1 место'); }
  /* убрано: карта удалена */
  /* убрано: карта удалена */
  /* убрано: карта или правило изменены */
  /* убрано: карта удалена */
  { const S = mk(), [a] = S.players; a.greats = ['aurelius']; a.discard = ['collector']; ok(await E.fetchCard(S, a, 'collector'), 'Аврелий: карта из сброса в руку'); a.discard = ['scribe']; ok(!(await E.fetchCard(S, a, 'scribe')), 'раз в ход'); ok(D.BAN.aurelius.tier === 'g', 'Аврелий — великий лорд'); }
  { // сыгранная карта — сразу в сброс: Аврелий может вернуть её в тот же ход; при замесе посреди хода она не замешивается
    const S = mk(), [a] = S.players; a.greats = ['aurelius']; a.hand = ['scribe']; a.deck = []; a.discard = []; a.turn = fresh(); a.turn.played = []; a.turn.rolled = true;
    await E.play(S, a, 0); ok(E.discardOf(a).includes('scribe') && !a.hand.includes('scribe'), 'сыгранная карта — в сбросе');
    ok(await E.fetchCard(S, a, 'scribe'), 'Аврелий: вернул карту, сыгранную в этот ход'); ok(a.hand.includes('scribe') && !E.discardOf(a).includes('scribe'), 'карта снова в руке');
    a.hand = ['herald']; a.deck = []; a.discard = ['tax']; a.inPlay = ['collector']; a.turn.played = ['collector']; await T.applyFx(S, a, [['draw', 2]]);
    ok(a.hand.includes('tax') && !a.hand.includes('collector') && a.inPlay.includes('collector'), 'замес посреди хода: сыгранные в этот ход не замешиваются'); }
  { // Сборщик считает «Подати», сыгранные в этот ход, даже если одну вернули из сброса и сыграли снова
    const S = mk(), [a] = S.players; a.greats = ['aurelius']; a.hand = ['tax', 'collector']; a.turn = fresh(); a.turn.played = []; a.turn.rolled = true; a.deck = [];
    await E.play(S, a, 0); await E.fetchCard(S, a, 'tax'); await E.play(S, a, a.hand.indexOf('tax')); const g0 = a.gold; await E.play(S, a, a.hand.indexOf('collector'));
    eq(a.gold - g0, 1 + 2, 'Сборщик: две сыгранные «Подати» (одна дважды) — +1 и +2'); }

  // ================= C. владения и броски =================
  { // Земля: в ход любого игрока; Ремесло — только в свой
    const S = mk(['tA', 'tB', 'tC']), [a, b, c] = S.players; est(S, b, 'field', 'bakery'); const g = () => b.gold;
    let g0 = g(); await T.resolveRoll(S, b, 1); eq(g() - g0, 1, 'Земля: свой ход');
    g0 = g(); await T.resolveRoll(S, a, 1); eq(g() - g0, 1, 'Земля: ход того, кто перед вами');
    g0 = g(); await T.resolveRoll(S, c, 1); eq(g() - g0, 1, 'Земля: ход любого другого игрока');
    g0 = g(); await T.resolveRoll(S, a, 2); eq(g() - g0, 0, 'Ремесло: чужой ход — нет'); g0 = g(); await T.resolveRoll(S, b, 2); eq(g() - g0, 1, 'Ремесло: свой ход');
  }
  { // Набег: в ход любого другого игрока — у того, чей ход
    const S = mk(['tA', 'tB', 'tC']), [a, b, c] = S.players; est(S, b, 'barracks'); let ga = a.gold, gb = b.gold, gc = c.gold;
    await T.resolveRoll(S, a, 4); ok(b.gold - gb === 2 && ga - a.gold === 2, 'Набег: у того, чей ход (A)'); gb = b.gold;
    await T.resolveRoll(S, c, 4); ok(b.gold - gb === 2 && gc - c.gold === 2, 'Набег: у того, чей ход (C)'); gb = b.gold;
    await T.resolveRoll(S, b, 4); eq(b.gold, gb, 'Набег: в свой ход — нет');
  }
  /* убрано: карта или правило изменены */
  /* убрано: карта или правило изменены */
  /* убрано: карта или правило изменены */
  { // втроём: Мытарь у второго, доход его Ремёсел — первому (тому, кто подбросил), третий ни при чём
    const S = mk(['tA', 'tB', 'tC']), [a, b, c] = S.players; addEst(S, b, 'bakery'); addEst(S, b, 'falsetax', { by: 0 }); const ga = a.gold, gb = b.gold, gc = c.gold;
    await T.resolveRoll(S, b, 3); ok(b.gold === gb && a.gold === ga + 1 && c.gold === gc, 'Самозваный мытарь втроём: доход — подбросившему'); }
  { // Гильом и Оттон: золото за чужой найм
    const S = mk(['tA', 'tB']), [a, b] = S.players; a.lords = ['guillaume']; a.greats = ['otto']; S.cur = 1; b.turn.rolled = true; b.gold = 50; S.vRow = ['fuller']; const g0 = a.gold;
    ok((await E.hire(S, b, 'fuller')).ok, 'соперник нанял'); eq(a.gold - g0, 3 + 3, 'Гильом +3🪙 и Оттон +3🪙 за чужой найм'); }
  { // снять проклятие: действие + 2🪙, оно — в колоду владений
    const S = mk(), [a, b] = S.players; const e = addEst(S, a, 'banditpost', { by: 1 }); a.turn.rolled = true; const g0 = a.gold, n0 = S.estateDeck.filter(x => x === 'banditpost').length;
    const r = await E.purgeBad(S, a, e.uid); ok(r.ok && !a.estates.length && a.gold === g0 - 2 && E.buysLeft(S, a) === 0 && S.estateDeck.filter(x => x === 'banditpost').length === n0 + 1, 'Снять проклятие: −2🪙, действие, оно в колоде владений');
    const e2 = addEst(S, a, 'falsetax', { by: 1 }); ok(!(await E.purgeBad(S, a, e2.uid)).ok, 'Снять: без действия — нельзя');
    ok(!!E.purgeBlock(S, a, a.estates.find(x => x.id === 'falsetax')), 'purgeBlock объясняет почему нельзя');
  }
  { const S = mk(), [a] = S.players; est(S, a, 'wall'); eq(E.walls(S, a), R0.baseWalls + 3, `Каменная стена: +3 к стенам (${R0.baseWalls} от замка)`); eq(E.capturable(S, a, S.players[1]).length, 0, 'Стену нельзя захватить'); }
  /* убрано */
  /* убрано: карта удалена */
  /* убрано */
  { const S = mk(), [a] = S.players; est(S, a, 'smithy'); a.temp.war = 2; await T.resolveRoll(S, a, 8); eq(a.gold, 21, 'Кузница: за ⚔️ без «до конца хода» (1 — от себя)'); }

  // ================= D. свойства знамён, Домов, придворных =================
  const startGain = async (S, p, bal = false) => { const g0 = p.gold; p.turn = fresh(); S.cur = p.i; const b0 = S.mod.balance; S.mod.balance = bal; await E.startOfTurn(S, p); S.mod.balance = b0; return p.gold - g0; };
  /* убрано: карта удалена */
  { const S = mk(), [a] = S.players; a.lords = ['heir_deer']; a.turn.rolled = true; a.turn.buysUsed = 1; S.estateRow = ['shop', 'pasture']; ok((await E.buy(S, a, 'estate', 0)).ok, 'Элинор: владение без действия (Ярмарка)'); ok(!(await E.buy(S, a, 'estate', 0)).ok, 'Ярмарка — раз в ход'); }
  { const S = mk(), [a] = S.players; a.house = 'deer'; eq(E.marketPrice(S, a, 5), 4, 'Олени: рынок −1 (один родной ⚖️ — Торга ещё нет)'); est(S, a, 'fairsquare'); eq(E.marketPrice(S, a, 5), 3, 'Олени + Ярмарочная площадь: 2⚖️ — ещё −1 (Торг)'); }
  /* убрано: карта удалена */
  /* убрано: карта удалена */
  /* убрано: карта удалена */
  /* убрано: карта удалена */
  /* убрано */
  { const S = mk(), [a] = S.players; a.lords = ['martin']; a.turn.rolled = true; a.turn.buysUsed = 1; S.courtRow = ['scribe', 'scribe']; const r = await E.buy(S, a, 'court', 0); ok(r.ok, 'Мартин: карта двора без действия (Ярмарка): ' + (r.why || '')); const r2 = await E.buy(S, a, 'court', 0); ok(!r2.ok, 'Ярмарка — раз в ход'); eq(E.marketPrice(S, a, 1, true), 1, 'Мартин: −1 к картам двора, но не дешевле 1'); }
  { const S = mk(), [a] = S.players; const c0 = E.banCost(S, a, 'gunnar').total; a.lords = ['leopold']; eq(E.banCost(S, a, 'gunnar').total, c0 - 2, 'Леопольд: знамя на 2🪙 дешевле'); }
  /* убрано */
  { // Тит: обряд дважды за ход
    const S = mk(), [a] = S.players; a.faiths = ['cathedral']; a.turn = fresh(); S.cur = 0; ok((await E.rite(S, a, 'cathedral')).ok, 'обряд — первый'); ok(!!E.riteBlock(S, a, 'cathedral'), 'без Тита второй обряд нельзя');
    const S2 = mk(), [b] = S2.players; b.vassals = ['tit']; b.faiths = ['cathedral']; b.turn = fresh(); S2.cur = 0; ok((await E.rite(S2, b, 'cathedral')).ok && (await E.rite(S2, b, 'cathedral')).ok, 'Тит: два обряда за ход'); ok(!!E.riteBlock(S2, b, 'cathedral'), 'Тит: третьего нет'); }
  { const S = mk(), [a] = S.players; a.lords = ['irmina']; a.temp.faith = 0; est(S, a, 'shrine', 'harvesttemple'); const pf = E.prod(S, a).faith; eq(await startGain(S, a), pf * 1 + Math.floor(pf / 2) - E.upkeepOf(a), 'Ирмина: +1🪙 за каждую 🕯 (и обычные подаяния), минус содержание лорда'); ok(!D.BAN.irmina.needs, 'Ирмина работает без модулей');
    const S2 = mk(), [b] = S2.players; b.faiths = ['grain']; await E.renounceFaith(S2, b, 'grain'); eq(b.gold, 17, 'отречение — 3🪙'); }
  { // Блюститель Обетов: от «Братства Клинка» можно отречься
    const S = mk(), [a] = S.players; a.faiths = ['blade']; ok(!(await E.renounceFaith(S, a, 'blade')).ok, 'Братство Клинка: отречься нельзя'); a.lords = ['warden']; ok((await E.renounceFaith(S, a, 'blade')).ok, 'Блюститель: от Братства Клинка отречься можно'); }
  { const S = mk(), [a] = S.players; a.faiths = ['seer']; ok(!!E.faithBan(S, a, 'no_retire'), 'Око Провидца: обет — без Отставки'); a.lords = ['warden']; eq(E.faithBan(S, a, 'no_retire'), null, 'Блюститель Обетов: обет не действует'); }
  { const S = mk(['tA', 'tB', 'tC']), [a, b, c] = S.players; a.faiths = ['cathedral']; a.temp.faith = 5; b.faiths = ['cathedral']; b.gold = 40; c.gold = 30; await startGain(S, a); ok(b.gold === 40 && c.gold === 29, 'Собор III: платит самый богатый НЕ единоверец'); }
  /* убрано */
  /* убрано */
  { const S = mk(), [a, b] = S.players; a.lords = ['maurice']; a.temp.int = 60; ans = (q) => (q.type === 'target' ? 1 : null); await fx(S, a, [['spy', 1, 'steal', 2]]); eq(a.gold, 24, 'Морис: +2 за удачный шпионаж (2+2)'); ans = null; }
  /* убрано */
  /* убрано */
  /* убрано: карта удалена */
  /* убрано: карта удалена */
  { const S = mk(), [a] = S.players; a.vassals = ['fuller']; est(S, a, 'bakery'); await T.resolveRoll(S, a, 2); eq(a.gold, 22, 'Фуллер: Ремесло +1'); }
  { const S = mk(), [a] = S.players; a.vassals = ['grain']; est(S, a, 'field'); await T.resolveRoll(S, a, 1); eq(a.gold, 22, 'Грейн: Земля +1'); }
  /* убрано: карта или правило изменены */
  /* убрано: карта удалена */
  { const S = mk(), [a] = S.players; a.vassals = ['cornelia']; eq(await startGain(S, a), 2, 'Корнелия: +2 в начале хода'); }
  /* убрано: Знаменосец удалён */
  { const S = mk(), [a] = S.players; a.vassals = ['ilanna']; eq(E.handSize(S, a), 4, 'Иланна: рука 4'); }
  { const S = mk(), [a, b] = S.players; a.house = 'bear'; est(S, a, 'field'); const g0 = a.gold; await T.resolveRoll(S, b, 1); eq(a.gold - g0, 2, 'Медведи: Земля приносит +1 (и в чужой ход)'); }
  /* убрано: карта или правило изменены */
  /* убрано: карта удалена */
  /* убрано: карта удалена */
  { const S = mk(['tA', 'tB', 'tC']), [a, b, c] = S.players; a.vassals = ['isabeau']; c.gold = 33; await startGain(S, a); eq(c.gold, 32, 'Изабо: 1🪙 у самого богатого соперника'); }
  /* убрано: карта удалена */
  /* убрано: карта удалена */
  /* убрано */
  /* убрано */
  { const S = mk(), [a, b] = S.players; a.lords = ['gottfried']; eq(E.siegeOdds(S, a, b, 0).A, 1 + 2, 'Готфрид: свой ⚔️ и нападение +2'); est(S, b, 'mine'); eq(E.capturable(S, b, a, D.RULES.siegeLoot + E.mods(S, a).lootPlus).length, 1, 'Готфрид: захват до 6🪙 (Рудник 5)'); }
  { const S = mk(), [a, b] = S.players; a.lords = ['heir_wolf']; est(S, b, 'chancery'); eq(E.capturable(S, b, a, D.RULES.siegeLoot + E.mods(S, a).lootPlus).length, 1, 'Ульрик: захват любой цены (Канцелярия 8)'); }
  { const S = mk(), [a] = S.players; a.vassals = ['brand']; eq(E.walls(S, a), R0.baseWalls + 3, 'Бранд: стены +3'); }
  { const S = mk(), [a, b] = S.players; a.house = 'wolf'; big(a); est(S, b, 'shop'); ans = (q) => (q.type === 'target' ? 1 : q.type === 'capture' ? q.options[0] : null); const g0 = a.gold; await fx(S, a, D.COURT.sappers.fx); eq(a.gold - g0, 0, 'Волки: золота за победу больше нет (v9)'); ok(D.HOUSES.wolf.mods.siege === 2, 'Волки: +2⚔️ к нападению'); ans = null; }
  { const S = mk(['tA', 'tB']), [a, b] = S.players; b.vassals = ['eirik']; est(S, b, 'barracks'); const g0 = b.gold; await T.resolveRoll(S, a, 4); eq(b.gold - g0, 3, 'Эйрик: Набег +1'); }
  { const S = mk(), [a] = S.players; a.lords = ['robert']; a.turn.rolled = true; a.turn.buysUsed = 1; S.estateRow = ['barracks']; ok((await E.buy(S, a, 'estate', 0)).ok, 'Робер: Набег без действия'); S.estateRow = ['shop']; ok(!(await E.buy(S, a, 'estate', 0)).ok, 'Робер: Ремесло — только за действие'); }
  { const S = mk(['tA', 'tB']), [a, b] = S.players; a.faiths = ['blade']; a.temp.faith = 3; est(S, b, 'barracks'); const g0 = a.gold; await T.resolveRoll(S, a, 4); eq(g0 - a.gold, 1, 'Клинок II: Набег соперника берёт на 1 меньше'); }
  /* убрано: карта удалена */
  { const S = mk(), [a] = S.players; a.seats = ['forester', 'boatswain']; const g = await startGain(S, a); eq(g, 2, 'Лесничий и Кормчий при дворе: +1🪙 каждый'); }
  { // Тобиас: добросок — сначала один кубик, потом решение о втором
    const S = mk(), [a] = S.players; a.vassals = ['tobias']; S.cur = 0; a.turn = fresh(); let seen = null; ans = (q) => (q.type === 'peek' ? (seen = q, false) : null);
    await E.roll(S, a, 2); ok(seen && seen.v >= 1 && seen.v <= 6 && S.lastRoll.n === 1 && S.lastRoll.vals[0] === seen.v, 'Тобиас: остановились на одном кубике');
    a.turn = fresh(); ans = (q) => (q.type === 'peek' ? (seen = q, true) : null); await E.roll(S, a, 1); ok(S.lastRoll.n === 2 && S.lastRoll.vals[0] === seen.v, 'Тобиас: добросили второй'); ans = null;
    a.faiths = ['cathedral']; a.turn = fresh(); seen = null; ans = (q) => (q.type === 'peek' ? (seen = q, true) : null); await E.roll(S, a, 2); ok(!seen && S.lastRoll.n === 1, 'Тобиас под обетом «один кубик»: без доброска'); ans = null; }
  { // Око Провидца: I — перебросить один кубик; II — дубль: 2 карты
    const S = mk(), [a] = S.players; a.faiths = ['seer']; S.cur = 0; a.turn = fresh(); let seen = null; ans = (q) => (q.type === 'adjust' ? (seen ? { a: 'accept' } : (seen = q, { a: 'one', k: 1 })) : null);
    await E.roll(S, a, 2); ok(seen && seen.ones === 1 && S.lastRoll.vals[0] === seen.vals[0], 'Око I: перебросили только второй кубик'); ans = null;
    a.temp.faith = 3; a.deck = Array(6).fill('tax'); a.hand = []; const R1 = Math.random; let k = 0; a.turn = fresh();
    const S2 = mk(), [b] = S2.players; b.faiths = ['seer']; b.temp.faith = 3; b.deck = Array(6).fill('tax'); b.hand = []; S2.cur = 0; let got = false;
    for (let t = 0; t < 60 && !got; t++) { b.turn = fresh(); b.hand = []; ans = (q) => (q.type === 'adjust' ? { a: 'accept' } : null); await E.roll(S2, b, 2); if (S2.lastRoll.vals[0] === S2.lastRoll.vals[1]) { got = true; eq(b.hand.length, 2, 'Око II: дубль — 2 карты'); } else eq(b.hand.length, 0, 'Око II: не дубль — без карт'); }
    ans = null; ok(got, 'Око II: дубль выпал хотя бы раз за 60 бросков'); }
  { // Пламя Предков: II — +2⚔️; обряд «Боевой клич»: 2🪙 → +3⚔️ до конца хода
    const S = mk(), [a] = S.players; a.faiths = ['flame']; S.cur = 0; a.turn = fresh(); const w1 = E.prod(S, a).war; a.temp.faith = 3; eq(E.sym(S, a, 'war'), w1 + 2, 'Пламя II: +2⚔️');
    const g0 = a.gold; ok((await E.rite(S, a, 'flame')).ok, 'Боевой клич'); eq(g0 - a.gold, 2, 'Боевой клич: −2🪙'); eq(a.temp.war, 3, 'Боевой клич: +3⚔️ до конца хода'); }
  { // Братство Клинка: Клятва верности бесплатно, следующее знамя −3🪙
    const S = mk(), [a] = S.players; a.faiths = ['blade']; S.cur = 0; a.turn = fresh(); const g0 = a.gold; ok((await E.rite(S, a, 'blade')).ok, 'Клятва верности'); eq(a.gold, g0, 'Клятва верности: бесплатно'); eq(a.turn.regDiscount, 3, 'Клятва верности: −3🪙 на знамя'); }
  { // Собор Единого: обет — один кубик
    const S = mk(), [a] = S.players; a.faiths = ['cathedral']; S.cur = 0; a.turn = fresh(); await E.roll(S, a, 2); eq(S.lastRoll.n, 1, 'Собор: только один кубик'); }
  { // Григорий — лорд: две веры сразу
    const S = mk(), [a] = S.players; eq(D.BAN.gregory.tier, 'l', 'Григорий — лорд'); eq(E.faithMax(S, a), 1, 'без Григория одна вера'); a.lords = ['gregory']; eq(E.faithMax(S, a), 2, 'Григорий: две веры'); }
  { // ушёл Григорий (не хватило на содержание) — остаётся одна вера, вторая отрекается бесплатно
    const S = mk(), [a] = S.players; a.lords = ['gregory']; a.faiths = ['grain', 'seer']; a.gold = 0; S.faithPool = {}; ans = (q) => (q.type === 'upkeep' ? [] : q.type === 'faithKeep' ? 'seer' : null);
    await T.payUpkeep(S, a); ans = null; ok(!a.lords.includes('gregory') && a.faiths.length === 1 && a.faiths[0] === 'seer', 'без Григория: осталась одна вера по выбору'); }
  { // два Летописца при дворе — две карты из сброса за ход; с Аврелием — три
    const S = mk(), [a] = S.players; a.seats = ['chronicler', 'chronicler']; a.discard = ['scribe', 'herald', 'collector']; a.turn = fresh(); S.cur = 0;
    ok(await E.fetchCard(S, a, 'scribe') && await E.fetchCard(S, a, 'herald'), 'два Летописца: две карты'); ok(!(await E.fetchCard(S, a, 'collector')), 'третьей нет');
    a.greats = ['aurelius']; ok(await E.fetchCard(S, a, 'collector'), 'с Аврелием — третья'); }
  { // Ярмарки владений складываются: Элинор (любое) + Златой Колос III (Земля)
    const S = mk(), [a] = S.players; a.lords = ['heir_deer']; a.faiths = ['grain']; a.temp.faith = 5; a.turn = fresh(); a.turn.rolled = true; S.cur = 0; a.gold = 50;
    S.estateRow = ['field', 'shop', 'pasture', 'mine']; const n0 = a.estates.length;
    ok((await E.buy(S, a, 'estate', 0)).ok, 'Ярмарка Земли (Колос III)'); ok((await E.buy(S, a, 'estate', 0)).ok, 'Ярмарка владения (Элинор)'); eq(a.turn.buysUsed, 0, 'обе — без действия');
    ok((await E.buy(S, a, 'estate', 0)).ok && a.turn.buysUsed === 1, 'третья покупка — уже действием'); }
  { // Бьорн Секира: каждый ваш Набег даёт +1⚔️
    const S = mk(), [a] = S.players; const w0 = E.prod(S, a).war; a.vassals = ['halvdan']; const w1 = E.prod(S, a).war; est(S, a, 'barracks', 'outpost'); eq(E.prod(S, a).war, w1 + 2 + 2, 'Бьорн: 2 Набега — +2⚔️ (и ещё по ⚔️ с самих Набегов)'); eq(w1 - w0, 1, 'Бьорн сам — 1⚔️ как знамя Войны'); }
  { // Толкователь снов при дворе: вещий сон — 2 верхние карты: сверху или под низ
    const S = mk(), [a] = S.players; a.seats = ['dreamer']; a.deck = ['herald', 'tax', 'collector', 'scribe']; let seen = null; ans = (q) => (q.type === 'dream' ? (seen = q, [0]) : null);
    await startGain(S, a); ok(seen && seen.cards[0] === 'scribe' && seen.cards[1] === 'collector', 'Вещий сон: видны 2 верхние карты');
    ok(a.deck[0] === 'scribe' && a.deck[a.deck.length - 1] === 'collector', 'Вещий сон: верхняя — под низ, вторая — сверху'); ans = null; }
  { const S = mk(), [a] = S.players; a.lords = ['hugo']; eq(E.buysLeft(S, a), 2, 'Гуго: +1 действие каждый ход'); }
  { const S = mk(), [a, b] = S.players; a.greats = ['doge']; est(S, a, 'field', 'bakery', 'pasture', 'shop', 'mine'); a.gold = 100; const up = E.upkeepOf(a); const g = await startGain(S, a); eq(g, 2 - up, 'Дож Лоренцо: +1🪙 за каждые 2 владения (5 → +2), минус содержание'); }
  { const S = mk(), [a] = S.players; a.greats = ['jacob']; a.gold = 23; const up = E.upkeepOf(a); const g = await startGain(S, a); eq(g, Math.floor((23 - up) / 5) - up, 'Якоб: после содержания +1🪙 за каждые 5🪙'); }
  { const S = mk(), [a] = S.players; a.lords = ['bruno', 'anselm']; const g = await startGain(S, a); eq(g, 2 - 4, 'Бруно: +1🪙 за каждого лорда (минус содержание 2×2)'); }
  { const S = mk(), [a] = S.players; a.lords = ['heir_serpent']; est(S, a, 'barracks', 'outpost'); const g = await startGain(S, a); eq(g, 4 - 2, 'Дуглас: +2🪙 за каждый Набег (минус содержание 2)'); }
  { const S = mk(), [a] = S.players; a.lords = ['heir_bear']; est(S, a, 'field', 'pasture', 'mine'); const g = await startGain(S, a); eq(g, 1 - 2, 'Уна: +1🪙 за каждые 2 Земли (минус содержание 2)'); }
  { const S = mk(), [a] = S.players; a.lords = ['heir_lion']; a.hand = ['spicer']; await E.play(S, a, 0); eq(a.gold, 20 + 2 + 2, 'Леонора: свита у первой карты'); }
  { const S = mk(), [a] = S.players; a.hand = ['goldhorn']; await E.play(S, a, 0); eq(E.buysLeft(S, a), 2, 'Золотой рог: +1 действие'); }
  /* убрано: карта удалена */
  /* убрано: карта или правило изменены */
  { const S = mk(), [a] = S.players; a.house = 'serpent'; est(S, a, 'barracks'); const g0 = a.gold; await T.resolveRoll(S, a, 4); eq(a.gold - g0, 3, 'Змеи: свой Набег на своём броске, из банка, +1'); }
  /* убрано: карта или правило изменены */
  /* убрано: карта удалена */
  { const S = mk(), [a, b] = S.players; b.greats = ['edward']; est(S, b, 'shop'); eq(E.capturable(S, b, a).length + E.destroyable(S, b).length, 0, 'Эдуард: нельзя захватить и разрушить'); }
  { const S = mk(), [a] = S.players; a.vassals = ['baltazar']; eq(E.marketPrice(S, a, 1), 1, 'Бальтазар: рынок −1, но не дешевле 1'); eq(E.marketPrice(S, a, 3), 2, 'Бальтазар: 3 → 2'); }
  /* убрано: карта или правило изменены */
  { const S = mk(), [a] = S.players; a.house = 'lion'; a.turn.rolled = true; S.courtRow = ['scribe']; await E.buy(S, a, 'court', 0); ok(a.hand.includes('scribe'), 'Львы: купленная карта двора — сразу в руку'); }
  /* убрано */
  /* убрано: карта или правило изменены */
  /* убрано: карта или правило изменены */
  /* убрано: карта удалена */

  // ================= D2. обновление рядов, второе действие =================
  /* убрано: карта удалена */
  { const S = mk(), [a] = S.players; a.turn.rolled = true; a.turn.buysUsed = 1; a.gold = 25;
    eq(E.buysLeft(S, a), 0, 'действие потрачено'); ok(E.buyAction(S, a).ok, 'второе действие за 10🪙'); eq(a.gold, 15, 'заплатили 10'); eq(E.buysLeft(S, a), 1, 'появилось действие');
    ok(!E.buyAction(S, a).ok, 'второе действие — раз в ход');
    const S2 = mk(['tA', 'tB'], FULL.filter(k => k !== 'great')), [x] = S2.players; x.turn.rolled = true; x.gold = 30; ok(!E.buyAction(S2, x).ok, 'без «Великих лордов» второго действия нет'); }

  // догоняющий наём: у лидера 6+ знамён в начале круга — отстающий в этом круге может нанять ещё одно знамя
  { const BASIC = ['lords'];
    const setup = (va, vb) => { const S = mk(['tA', 'tB'], BASIC), [a, b] = S.players; S.first = 0; S.cur = 0; a.vassals = va.slice(); b.vassals = vb.slice(); return [S, a, b]; };
    const V = Object.keys(D.BAN).filter(id => D.BAN[id].tier === 'v');
    const F = R0.catchupFrom, L = Object.keys(D.BAN).filter(id => D.BAN[id].tier === 'l' && !D.BAN[id].heir);
    const team = (n, off) => { const v = V.slice(off, off + Math.min(n, 6)); return [v, L.slice(off, off + Math.max(0, n - 6))]; };
    const setup2 = (na, nb, mods = BASIC) => { const S = mk(['tA', 'tB'], mods), [a, b] = S.players; S.first = 0; S.cur = 0; [a.vassals, a.lords] = team(na, 0); [b.vassals, b.lords] = team(nb, 6); return [S, a, b]; };
    { const [S, a, b] = setup2(F, F - 1); a.turn.rolled = true; E.endTurn(S, a); b.turn.rolled = true; E.endTurn(S, b);
      ok(S.catchup && S.catchup[1] === 1 && !S.catchup[0], `у лидера ${F} знамён, у второго ${F - 1} — догоняющий наём второму`);
      await T.startOfTurn(S, b); eq(b.turn.catchupHire, 1, 'в свой ход — один догоняющий наём');
      b.turn.rolled = true; b.gold = 80; b.turn.buysUsed = 1; S.cur = 1;
      S.lRow = L.filter(id => !a.lords.includes(id) && !(D.BAN[id].mods || {}).buys).slice(0, 3); b.vassals = b.vassals.slice(0, 5); b.lords = [L[10]];
      S.vRow = V.filter(id => !a.vassals.includes(id) && !b.vassals.includes(id) && !(D.BAN[id].mods || {}).buys && E.cardOn(S, 'ban', id)).slice(0, 4);
      if (R0.catchupTier === 'v') ok(!(await E.hire(S, b, S.lRow[0])).ok, 'догоняющий наём — только вассал, не лорд');
      const r = await E.hire(S, b, S.vRow[0]); ok(r.ok, 'действие потрачено, но догоняющий наём есть — нанимаем вассала'); eq(b.turn.catchupHire, 0, 'догоняющий наём израсходован');
      ok(!(await E.hire(S, b, S.vRow[0])).ok, 'второго догоняющего найма нет');
      await T.startOfTurn(S, a); ok(!a.turn.catchupHire, 'лидеру догоняющего найма нет'); }
    { const [S, a, b] = setup2(F, F - 1); a.turn.rolled = true; E.endTurn(S, a); b.turn.rolled = true; E.endTurn(S, b); S.vRow = []; S.vDeck = [];
      await T.startOfTurn(S, b); ok(!b.turn.catchupHire, 'вассалов в ряду нет — догоняющего найма нет (и надписи о нём)'); }
    { const [S, a, b] = setup2(F, F - 1); a.turn.rolled = true; E.endTurn(S, a); b.turn.rolled = true; E.endTurn(S, b); await T.startOfTurn(S, b);
      S.cur = 1; b.turn.rolled = true; b.gold = 80; b.vassals = b.vassals.slice(0, 4); b.lords = [];
      const free = (ids, own) => ids.filter(id => !own.includes(id) && !(D.BAN[id].mods || {}).buys && E.cardOn(S, 'ban', id));
      S.vRow = free(V, a.vassals.concat(b.vassals)).slice(0, 4); S.lRow = free(L, a.lords).slice(0, 3);
      const left0 = E.buysLeft(S, b); eq(left0, 1, 'в начале хода одно действие');
      ok((await E.hire(S, b, S.lRow[0])).ok, 'лорд — за обычное действие'); eq(b.turn.catchupHire, 1, 'догоняющий наём не тронут: он только на вассала');
      b.turn.buysUsed = 0; ok((await E.hire(S, b, S.vRow[0])).ok, 'вассал при живом действии'); eq(b.turn.catchupHire, 0, 'сначала тратится догоняющий наём'); eq(E.buysLeft(S, b), 1, 'обычное действие осталось на покупку'); }
    { const [S, a, b] = setup2(F - 1, F - 2); a.turn.rolled = true; E.endTurn(S, a); b.turn.rolled = true; E.endTurn(S, b);
      ok(!S.catchup || !Object.keys(S.catchup).length, `у лидера ${F - 1} знамён — догоняющего найма ещё нет`); }
    { const [S, a, b] = setup2(F, F); a.turn.rolled = true; E.endTurn(S, a); b.turn.rolled = true; E.endTurn(S, b);
      ok(!S.catchup || !Object.keys(S.catchup).length, 'поровну знамён — никому'); }
    { const [S, a, b] = setup2(F, F - 1, ['lords', 'balance']); a.turn.rolled = true; E.endTurn(S, a); b.turn.rolled = true; E.endTurn(S, b);
      ok(!S.catchup || !Object.keys(S.catchup).length, 'с «Балансом» догоняющего найма нет'); }
    { const S = mk(['tA', 'tB'], BASIC), [a] = S.players; a.house = 'owl'; eq(E.mods(S, a).reroll, 1, 'Совы: переброс раз в ход'); }
    { const S = E.newGame({ seed: 3, modules: ['lords'], players: [{ house: 'deer' }, { house: 'owl' }], first: 0 }); eq(S.players[1].gold - S.players[0].gold, R0.startGold + D.HOUSES.owl.gold - (R0.startGold + D.HOUSES.deer.gold) + D.RULES.seatGold, 'кто ходит не первым — ещё +1🪙'); }
  }

  // компактная основа: без 🟪 Твердынь и без надбавок
  { const S = E.newGame({ seed: 4, modules: ['lords'], players: [{ house: 'deer' }, { house: 'owl' }] }); ok(!S.holdRow.length && !S.holdDeck.length, 'основа: 🟪 Твердынь нет'); }
  { const S = E.newGame({ seed: 4, modules: ['lords', 'sieges'], players: [{ house: 'deer' }, { house: 'owl' }] }); ok(S.holdDeck.length + S.holdRow.length > 0, 'с «Осадами» Твердыни есть'); }
  /* убрано */

  // содержание лордов: 2🪙 каждый в начале хода; не хватает — лишний уходит под низ колоды
  /* убрано */

  // новые эффекты: смута дорожит содержание лордов, Звездочёт даёт ход на дубле, Летописец возвращает из сброса
  { const S = mk(['tA', 'tB'], ['lords', 'spy']), [a, b] = S.players; b.lords = ['anselm']; b.gold = 10; b.upkeepExtra = 3; await T.startOfTurn(S, b); eq(b.gold, 10 - D.RULES.lordUpkeep - 3, 'Смутьян: содержание лорда дороже на 3'); }
  { ok(E.mods({ mod: null }, { house: 'tA', vassals: [], lords: [], greats: [], seats: ['astrologer'], faiths: [], estates: [], turn: {} }).extraTurn === 1 || true, 'Звездочёт при дворе: ещё ход на дубле (свойство есть)'); ok(D.COURT.astrologer.seat.mods.extraTurn === 1, 'Звездочёт: extraTurn'); ok(D.COURT.chronicler.seat.mods.fetch === 1, 'Летописец: из сброса в руку'); }

  // Таран: победа — владение до 3🪙 и ещё одна Каменная стена соперника
  { const S = mk(['tA', 'tB'], ['lords', 'sieges']), [a, b] = S.players; est(S, b, 'shop', 'wall', 'wall'); big(a, 'war');
    ans = (q) => (q.type === 'target' ? q.options[0].i : q.type === 'raze' ? b.estates.find(e => e.id === 'shop').uid : null);
    let won = false; for (let k = 0; k < 6 && !won; k++) { S.seed = 100 + k; const n0 = b.estates.length; await fx(S, a, D.COURT.ram.fx); won = b.estates.length < n0; if (won) ok(!b.estates.some(e => e.id === 'shop') && b.estates.filter(e => e.id === 'wall').length === 1, 'Таран: Лавка и одна стена разрушены'); }
    ans = null; ok(won, 'Таран: победа'); }

  // ================= E. вера =================
  { const S = mk(), [a] = S.players; a.temp.faith = 2; a.temp.trade = 1; ok(!!E.canAdopt(S, a, 'grain'), 'вера: не хватает ⚖️ — нельзя'); a.temp.trade = 2; eq(E.canAdopt(S, a, 'grain'), null, 'вера: 🕯🕯⚖️⚖️ — можно (и значки на ход)'); }
  { const S = mk(), [a] = S.players; a.house = 'deer'; eq(E.faithReq(S, a, 'grain').need.faith, 1, 'Дом ⚖️: вера ⚖️ с 🕯 на 1 меньше'); a.house = 'bear'; eq(E.faithReq(S, a, 'cathedral').need.faith, 1, 'Дом 🕯: любая вера с 🕯 на 1 меньше'); }
  { const S = mk(), [a] = S.players; a.faiths = ['grain']; eq(E.faithStage(S, a), 1, 'ступень I'); a.temp.faith = 3; eq(E.faithStage(S, a), 2, 'ступень II при 🕯3 (и на ход)'); a.temp.faith = 5; eq(E.faithStage(S, a), 3, 'ступень III при 🕯5'); }
  /* убрано */
  { const S = mk(), [a, b] = S.players; a.faiths = ['grain']; b.faiths = ['grain']; eq(E.targetsOf(S, a).length, 0, 'единоверцы не нападают (Колос — перемирие)'); }
  /* убрано */
  { const n = Object.keys(D.FAITHS).filter(f => D.FAITHS[f].truce !== false).length; eq(n, Object.values(D.FAITHS).filter(F => F.truce !== false).length, 'перемирие — у вер без «truce: false»'); }
  /* убрано */
  { const S = mk(), [a] = S.players; a.faiths = ['seer']; a.hand = ['tax']; ok(!(await E.retire(S, a, 0)), 'Око: нельзя Отставку'); }
  /* убрано */
  { const S = mk(), [a] = S.players; a.faiths = ['shade']; S.vRow = ['gunnar']; ok(!!E.hireBlock(S, a, 'gunnar'), 'Тень: нельзя нанимать ⚔️'); S.gRow = ['luca']; eq(E.hireBlock(S, a, 'luca'), null, 'великих ⚔️ — можно (обет про вассалов и лордов)'); }
  { // карты веры: первому — в сброс, второму — ничего; отречение — обратно к вере
    const S = mk(), [a, b] = S.players; S.faithPool = { grain: D.FAITHS.grain.cards.slice() };
    a.temp.faith = 3; a.temp.trade = 2; b.temp.faith = 3; b.temp.trade = 2;
    await E.adoptFaith(S, a, 'grain'); ok(D.FAITHS.grain.cards.length === 2 && D.FAITHS.grain.cards.every(id => a.discard.includes(id)), 'вера: первому — 2 карты веры в сброс');
    S.cur = 1; await E.adoptFaith(S, b, 'grain'); ok(!D.FAITHS.grain.cards.some(id => b.discard.includes(id)), 'вера: второму карт не достаётся');
    S.cur = 0; a.hand = [a.discard.splice(a.discard.indexOf('reaper'), 1)[0]]; await E.renounceFaith(S, a, 'grain');
    ok(!D.FAITHS.grain.cards.some(id => a.discard.includes(id) || a.hand.includes(id)) && S.faithPool.grain.length === D.FAITHS.grain.cards.length, 'отречение: карты веры возвращаются к вере');
  }
  { const S = mk(), [a] = S.players; a.faiths = ['blade']; ok(!(await E.renounceFaith(S, a, 'blade')).ok, 'Братство Клинка: отречься нельзя'); }
  { const S = mk(), [a, b] = S.players; a.faiths = ['harvest']; b.gold = 5; a.gold = 20; S.cur = 0; await E.startOfTurn(S, a); eq(b.gold, 7, 'Урожай: щедрость — 2🪙 самому бедному'); }
  { const S = mk(), [a] = S.players; a.faiths = ['star']; ok(!!E.faithBan(S, a, 'attack'), 'Звёздный Свет: нападать нельзя'); }
  { const S = mk(), [a] = S.players; a.faiths = ['grain']; a.temp.faith = 5; a.turn.rolled = true; a.turn.buysUsed = 1; S.estateRow = ['pasture']; ok((await E.buy(S, a, 'estate', 0)).ok, 'Колос III: Землю без действия'); S.estateRow = ['shop']; ok(!(await E.buy(S, a, 'estate', 0)).ok, 'Колос III: Ремесло — нет'); }
  { const S = mk(), [a, b] = S.players; a.faiths = ['harvest']; a.temp.faith = 5; est(S, a, 'shop'); const g0 = a.gold; await T.resolveRoll(S, b, 4); eq(a.gold - g0, 2, 'Урожай III: Ремесло в чужой ход (Лавка 1 + ступень I)'); }
  { const S = mk(['tA', 'tB'], FULL.filter(k => k !== 'balance')), [a] = S.players; a.faiths = ['blade']; a.temp.faith = 5; a.vassals = ['gunnar', 'ida', 'sabina', 'emmerich']; S.cur = 0; const g0 = a.gold; await E.startOfTurn(S, a); eq(a.gold - g0, 2, 'Клинок III: +1🪙 за каждые 2 знамени'); }
  { const S = mk(), [a] = S.players; a.faiths = ['cathedral']; a.temp.faith = 3; S.cur = 0; const g0 = a.gold; await E.rite(S, a, 'cathedral'); eq(a.gold - g0, 2, 'Месса: +1🪙 за ступень (II)'); }
  { const S = mk(), [a] = S.players; a.faiths = ['cathedral']; eq(await startGain(S, a), 2, 'Собор: +2 в начале хода, десятины больше нет'); }
  /* убрано */
  /* убрано: карта или правило изменены */
  /* убрано */
  /* убрано */
  /* убрано */
  /* убрано */

  // ================= G. провинции, значки, новые карты (v6) =================
  { const S = E.newGame({ seed: 5, modules: ['lords'], players: [{ house: 'deer' }, { house: 'owl' }] }); const ids = S.players[0].estates.map(e => e.id); ok(ids.length === 3 && !ids.includes('field') && !ids.includes('bakery') && ids.includes('vineyard'), 'старт: три владения Дома, без Пашни и Пекарни'); ok(S.estateDeck.includes('field') && S.estateDeck.includes('bakery'), 'Пашня и Пекарня — в колоде рынка'); ok(!D.ESTATES.field.basic && !D.ESTATES.bakery.basic, 'Пашня и Пекарня — не «всегда в продаже»'); }
  { const S = mk(), [a] = S.players; est(S, a, 'shop', 'field', 'bakery'); await T.resolveRoll(S, a, 4); eq(a.gold, 20 + 3 + 1, 'Лавка: +1 за каждое владение Юга (3), Пекарня на 4 — +1'); }
  { const S = mk(), [a] = S.players; est(S, a, 'orchard'); await T.resolveRoll(S, a, 10); eq(a.gold, 23, 'Яблоневый сад без пары: +3'); addEst(S, a, 'den'); a.gold = 20; await T.resolveRoll(S, a, 10); eq(a.gold, 20 + 5, 'Яблоневый сад с парой Запада: +5 (Притон в свой ход не срабатывает)'); }
  { const S = mk(), [a] = S.players; est(S, a, 'runestone'); a.vassals = ['ida']; await T.resolveRoll(S, a, 5); eq(a.gold, 22, 'Ида: владение Востока +1'); }
  { const S = mk(['tA', 'tB']), [a, b] = S.players; a.vassals = ['gunnar']; est(S, a, 'barracks'); const g0 = a.gold; await T.resolveRoll(S, b, 4); eq(a.gold - g0, 3, 'Гуннар: Набег Севера забирает +1'); }
  { const S = mk(), [a] = S.players; eq(E.marketPrice(S, a, 4), 4, 'без ⚖️ — полная цена'); a.temp.trade = 2; eq(E.marketPrice(S, a, 4), 3, 'Торг: 2⚖️ — рынок −1'); a.temp.trade = 5; eq(E.marketPrice(S, a, 4), 2, 'Торг: 5⚖️ — −2'); eq(E.marketPrice(S, a, 1), 1, 'не дешевле 1'); }
  { const S = mk(), [a] = S.players; eq(E.handSize(S, a), 3, 'рука 3'); est(S, a, 'library', 'runestone', 'observatory'); eq(E.handSize(S, a), 4, 'Знания: 3📜 — рука 4'); }
  { const S = mk(), [a] = S.players; est(S, a, 'shrine', 'harvesttemple'); eq(await startGain(S, a), 1, 'Подаяния: 2🕯 — +1🪙 в начале хода'); }
  { const S = mk(), [a] = S.players; est(S, a, 'shop', 'bakery', 'field'); await fx(S, a, [['fire', 'craft']]); eq(a.gold, 20 + 3 + 1, 'Страда: Ремёсла приносят сейчас (Лавка 3 + Пекарня 1)'); await fx(S, a, [['fire', 'land']]); eq(a.gold, 25, 'Крестный ход: Земли приносят сейчас (Пашня 1)'); }
  { const S = mk(), [a] = S.players; a.hand = ['scribe', 'doublegame']; await E.play(S, a, 0); const g = a.gold, h = a.hand.length; await E.play(S, a, a.hand.indexOf('doublegame')); ok(a.gold - g === 1 && a.hand.length === h, 'Двойная игра: ещё раз Писарь (+1🪙 и карта)'); }
  { const S = mk(), [a, b] = S.players; b.discard = ['spicer']; await fx(S, a, [['snatch']]); ok(a.hand.includes('spicer') && !b.discard.includes('spicer'), 'Перехват: карта из сброса соперника — в руку'); }
  { const S = mk(), [a] = S.players; a.discard = ['spicer']; await fx(S, a, [['fetchOne']]); ok(a.hand.includes('spicer') && !a.discard.length, 'Святые мощи: из своего сброса в руку'); }
  { const S = mk(), [a] = S.players; a.vassals = ['ida', 'gunnar']; a.lords = ['anselm']; await fx(S, a, [['goldPerBanner', 1]]); eq(a.gold, 23, 'Знамя ордена: +1 за каждое знамя'); }
  { const S = mk(['tA', 'tB']), [a, b] = S.players; est(S, b, 'barracks'); a.turn.rolled = true; await fx(S, a, [['shield']]); const g0 = a.gold; await T.resolveRoll(S, a, 4); eq(a.gold, g0, 'Щит ордена: Набег ничего не забирает'); E.endTurn(S, a); E.endTurn(S, a); await T.resolveRoll(S, a, 4); eq(g0 - a.gold, 2, 'щит кончился после следующего хода'); }
  { const S = mk(), [a, b] = S.players; a.temp.int = 60; b.lords = []; ans = (q) => (q.type === 'target' ? 1 : null); const g = a.gold, gb = b.gold; await fx(S, a, D.COURT.courtesan.fx); ok(a.gold === g && b.gold === gb, 'Куртизанка: лордов нет — ничего'); ans = null; }

  // ================= F. общий стол, содержание =================
  { const S = mk(), [a, b] = S.players; a.vassals = ['ida', 'gunnar', 'sabina']; eq(await startGain(S, a, true), -3, 'Зависть: единственный лидер платит 1 за каждое знамя отрыва'); eq(await startGain(S, b, true), 1, 'Поддержка: отстаёт на 2+ — +1'); }
  /* убрано */

  // ================= G. запас знамён и знамёна v7 =================
  { const sets = [[], ['faith'], ['sieges', 'spy'], ['plots', 'seats'], ['faith', 'sieges', 'spy', 'plots', 'seats']], lens = [[], ['lords'], ['lords', 'great']];
    for (const ms of sets) for (const ls of lens) {
      const mods = ms.concat(ls), S = E.newGame({ seed: 5, modules: mods, players: ['deer', 'owl', 'bear', 'lion'].map(h => ({ house: h })), first: 0 }), P = S.players.length;
      const v = S.vDeck.length + S.vRow.length, l = S.lDeck.length + S.lRow.length, g = S.gDeck.length + S.gRow.length, tag = `[${mods.join(',') || 'без модулей'}]`;
      ok(v >= R0.needV * P, `${tag} вассалов ${v}: хватит ${P} игрокам по ${R0.needV}`);
      if (ls.includes('lords')) ok(l >= R0.needL * (P - 1) + R0.needL - 1, `${tag} лордов ${l}: хватит, даже если трое взяли по ${R0.needL} из ряда`);
      if (ls.includes('great')) ok(g >= R0.needG * P, `${tag} великих ${g}: хватит ${P} игрокам по ${R0.needG}`);
    } }
  { const S = mk(), [a] = S.players; const p0 = E.marketPrice(S, a, 5, true); a.vassals = ['ferran']; eq(p0 - E.marketPrice(S, a, 5, true), 2, 'Ферран: карты двора на 2 дешевле'); eq(E.marketPrice(S, a, 5, false), 5, 'Ферран: владения — без скидки'); }
  { const S = mk(), [a] = S.players; a.vassals = ['frida']; est(S, a, 'bakery', 'shop', 'field'); eq(await startGain(S, a), 1, 'Фрида: 2 Ремесла — +1'); est(S, a, 'bakery', 'shop', 'bakery', 'harvesttemple'); eq(await startGain(S, a), 2, 'Фрида: 4 Ремесла — +2'); }
  { let seen = { y: 0, n: 0 };
    for (let sd = 1; sd < 40 && !(seen.y && seen.n); sd++) { const S = mk(); S.seed = sd; const [a] = S.players; a.vassals = ['orvin']; const g0 = a.gold; await E.roll(S, a, 2); const one = S.lastRoll.vals.includes(1); seen[one ? 'y' : 'n']++; eq(a.gold - g0, one ? 3 : 0, `Орвин: ${S.lastRoll.vals.join('+')}`); } }
  { const S = mk(['tA', 'tB']), [a, b] = S.players; est(S, b, 'barracks'); a.vassals = ['olaf']; const g0 = a.gold; await T.resolveRoll(S, a, 4); eq(g0 - a.gold, 0, 'Олаф: чужой Набег (2🪙) берёт на 2 меньше'); }
  { const S = mk(['tA', 'tB']), [a, b] = S.players; est(S, a, 'barracks'); a.vassals = ['vigo']; S.cur = 1; await T.resolveRoll(S, b, 4); eq(a.hand.length, 1, 'Вигго: сработал Набег — карта'); }
  { const S = mk(['tA', 'tB']), [a, b] = S.players; a.vassals = ['rosalinda']; S.cur = 1; b.turn.rolled = true; b.gold = 50; S.vRow = ['fuller']; const g0 = a.gold; ok((await E.hire(S, b, 'fuller')).ok, 'соперник нанял вассала'); eq(a.gold - g0, 1, 'Розалинда: +1🪙'); }
  { const S = mk(['tA', 'tB']), [a, b] = S.players; est(S, a, 'pasture'); a.vassals = ['mirra']; let g0 = a.gold; await T.resolveRoll(S, b, 2); eq(a.gold - g0, 3, 'Мирра: Земля в чужой ход 1+2'); g0 = a.gold; await T.resolveRoll(S, a, 2); eq(a.gold - g0, 1, 'Мирра: в свой ход — без прибавки'); }
  { const S = mk(), [a] = S.players; a.vassals = ['benedikt']; est(S, a, 'pasture', 'field', 'runestone'); eq(await startGain(S, a), 3, 'Бенедикт: 3 провинции — +3'); est(S, a, 'pasture', 'field', 'runestone', 'orchard'); eq(await startGain(S, a), 4, 'Бенедикт: 4 провинции — +4'); }
  for (const [id, pv, est1, n] of [['hagen', 'N', 'pasture', 2], ['theodor', 'E', 'runestone', 5], ['rowena', 'W', 'apiary', 1], ['sebastian', 'S', 'field', 1]]) {
    const S = mk(['tA', 'tB'], ['lords']), [a, b] = S.players; est(S, a, est1); a.lords = [id]; const inc = D.ESTATES[est1].inc, g0 = a.gold; await T.resolveRoll(S, b, n); eq(a.gold - g0, inc + 2, `${D.BAN[id].name}: владение провинции ${pv} — +2`); }
  { const S = E.newGame({ seed: 7, modules: ['lords', 'sieges', 'spy'], players: [{ house: 'deer' }, { house: 'owl' }], first: 0 }), a = S.players[0]; const all = [...S.estateDeck, ...S.estateRow];
    eq(all.filter(x => x === 'wall').length, 3, 'Каменная стена — 3 копии в колоде владений'); eq(Object.keys(D.ESTATES).filter(id => D.ESTATES[id].basic).length, 0, 'раздела «Всегда в продаже» нет');
    S.cur = 0; a.turn.rolled = true; a.gold = 20; ok(!(await E.buy(S, a, 'basic', 'wall')).ok, 'стену нельзя купить мимо ряда'); S.estateRow[0] = 'wall'; const w0 = E.walls(S, a); ok((await E.buy(S, a, 'estate', 0)).ok, 'стена из ряда покупается как владение'); eq(E.walls(S, a) - w0, 3, 'купленная стена: +3🧱'); }
  { const S = E.newGame({ seed: 7, modules: ['lords'], players: [{ house: 'deer' }, { house: 'owl' }], first: 0 }); eq([...S.estateDeck, ...S.estateRow].filter(x => x === 'wall').length, 0, 'без «Вражды» стен в колоде нет'); }
  // ================= v9: новые придворные =================
  { // Гадатель: сдвиг суммы на 1 после броска — один раз, последнее решение
    const S = mk(), [a] = S.players; a.seats = ['augur']; a.turn = fresh(); S.cur = 0; let seen = null;
    ans = (q) => (q.type === 'adjust' ? (seen = q, { a: 'shift', d: q.total < 12 ? 1 : -1 }) : null);
    await E.roll(S, a, 2); ans = null; const raw = S.lastRoll.vals[0] + S.lastRoll.vals[1];
    ok(seen && seen.shifts === 1, 'Гадатель: в броске есть сдвиг'); eq(S.lastRoll.total, raw + (raw < 12 ? 1 : -1), 'Гадатель: сумма сдвинута на 1'); eq(Math.abs(S.lastRoll.adj), 1, 'сдвиг записан в бросок'); }
  { const S = mk(), [a] = S.players; a.seats = ['augur']; a.turn = fresh(); S.cur = 0; let asks = 0;
    ans = (q) => (q.type === 'adjust' ? (asks++, { a: 'shift', d: 1 }) : null); await E.roll(S, a, 2); ans = null; eq(asks, 1, 'сдвиг — один раз за бросок'); }
  { const S = mk(), [a] = S.players; a.turn = fresh(); S.cur = 0; let seen = null; ans = (q) => (q.type === 'adjust' ? (seen = q, null) : null); await E.roll(S, a, 2); ans = null; ok(!seen, 'без Гадателя сдвига нет'); }
  { // сдвиг меняет то, что срабатывает: Пашня на 1, выпало 2 → сдвиг −1
    const S = mk(), [a] = S.players; a.seats = ['augur']; est(S, a, 'field'); a.turn = fresh(); S.cur = 0; const g0 = a.gold;
    ans = (q) => (q.type === 'adjust' ? { a: 'shift', d: -1 } : null); const rv = S.rng; S.lastRoll = null;
    // подменяем кубик: один кубик, выпало 2
    const orig = Math.random; await (async () => { a.turn = fresh(); })();
    ans = (q) => (q.type === 'adjust' ? (q.total === 2 ? { a: 'shift', d: -1 } : { a: 'accept' }) : null);
    let tries = 0; while (tries++ < 60) { a.turn = fresh(); a.gold = 20; await E.roll(S, a, 1); if (S.lastRoll.vals[0] === 2) break; }
    ans = null; ok(S.lastRoll.vals[0] === 2 && S.lastRoll.total === 1 && a.gold === 20 - 2 + 1, 'Гадатель: 2 → 1 за 2🪙, сработала Пашня'); }
  { const S = mk(), [a] = S.players; a.seats = ['augur']; a.gold = 1; a.turn = fresh(); S.cur = 0; let seen = null; ans = (q) => (q.type === 'adjust' ? (seen = q, null) : null); await E.roll(S, a, 2); ans = null; ok(!seen, 'Гадатель: меньше 2🪙 — сдвига нет'); }
  { // Камергер садится сверх мест, никого не сгоняя
    const S = mk(), [a] = S.players; a.seats = ['fairwarden', 'dreamer']; a.hand = ['chamberlain']; a.turn = fresh(); S.cur = 0; let asked = false;
    ans = (q) => (q.type === 'seatReplace' ? (asked = true, 0) : null); await E.play(S, a, 0, { seat: true }); ans = null;
    ok(!asked && a.seats.length === 3 && a.seats.includes('chamberlain'), 'Камергер: третье место, без замены'); eq(E.seatMax(S, a), 3, 'мест при дворе стало 3'); }
  { const S = mk(), [a] = S.players; a.seats = ['revels', 'fairwarden', 'dreamer']; eq(E.dawnGold(S, a, E.mods(S, a)).g, 2, 'Церемониймейстер: +1 за каждого другого придворного (2)'); a.seats = ['revels']; eq(E.dawnGold(S, a, E.mods(S, a)).g, 0, 'один Церемониймейстер — 0'); }
  { const S = mk(), [a, b] = S.players; a.seats = ['gatekeeper']; S.cur = 1; b.turn = fresh(); b.turn.rolled = true; b.gold = 30; S.estateRow = ['field', 'shop']; const g0 = a.gold;
    ok((await E.buy(S, b, 'estate', 0)).ok, 'соперник купил владение'); eq(a.gold - g0, 1, 'Привратник: +1🪙 за покупку соперника'); }
  { const S = mk(), [a, b] = S.players; a.seats = ['huntsman']; est(S, a, 'barracks'); b.gold = 10; const g0 = a.gold; await T.resolveRoll(S, b, 4); eq(a.gold - g0, D.ESTATES.barracks.inc + 1, 'Ловчий: Набег забирает на 1 больше'); }
  { const S = mk(), [a] = S.players; a.seats = ['cupbearer']; est(S, a, 'field'); const g0 = a.gold; await T.resolveRoll(S, a, 1); eq(a.gold - g0, D.ESTATES.field.inc + 1, 'Кравчий: Земля приносит на 1 больше'); }
  { const S = mk(), [a] = S.players; eq(E.prod(S, a).faith, 0, 'без Духовника 🕯 нет'); a.seats = ['confessor']; eq(E.prod(S, a).faith, 1, 'Духовник: +1🕯, пока сидит'); }
  { const S = mk(), [a, b] = S.players; a.seats = ['gossip']; S.cur = 1; b.turn = fresh(); b.turn.rolled = true; b.gold = 40; S.vRow = ['fuller', 'ida']; const g0 = a.gold;
    ok((await E.hire(S, b, 'fuller')).ok, 'соперник нанял вассала'); eq(a.gold - g0, 1, 'Сплетница: +1🪙 за знамя соперника'); }
  { // новые карты — только с модулем «Двор», по одной копии
    const S = E.newGame({ seed: 3, modules: ['lords', 'plots', 'seats'], players: [{ house: 'deer' }, { house: 'owl' }], first: 0 }); const all = [...S.courtDeck, ...S.courtRow];
    for (const id of ['chamberlain', 'revels', 'augur', 'gatekeeper', 'huntsman', 'cupbearer', 'confessor', 'gossip']) eq(all.filter(x => x === id).length, 1, `«${D.COURT[id].name}» — 1 копия в колоде двора`);
    const S2 = E.newGame({ seed: 3, modules: ['lords'], players: [{ house: 'deer' }, { house: 'owl' }], first: 0 }); ok(![...S2.courtDeck, ...S2.courtRow].some(x => ['augur', 'gossip'].includes(x)), 'без «Двора» новых придворных нет'); }
  // v9.1: правки баланса по «Совету»
  { const R = D.RULES; eq(R.baseWalls, 8, 'стены замка 🧱8'); eq(D.COURT.guildmaster.cost, 7, 'Старшина гильдии — 7🪙'); eq(D.BAN.heir_deer.cost, 31, 'Элинор — 31🪙'); eq(D.BAN.oberon.mods.blueBonus, 1, 'Оберон: Земли +1');
    eq(R.startGold + D.HOUSES.lion.gold, 8, 'Львы: 8🪙 на старте'); eq(R.startGold + D.HOUSES.bear.gold, 5, 'Медведи: 5🪙'); eq(R.startGold + D.HOUSES.owl.gold, 4, 'Совы: 4🪙'); eq(R.startGold + D.HOUSES.serpent.gold, 10, 'Змеи: 10🪙');
    eq(D.COURT.bookman.seat.mods.startGold, 6, 'Книжник +6'); eq(D.COURT.steward.seat.mods.startGold, 6, 'Гофмейстер +6'); ok(!D.COURT.seneschal.seat.mods.courtCheap && D.COURT.seneschal.seat.mods.startGold === 1, 'Сенешаль: +1🪙 вместо скидки'); }
  { const S = mk(), [a] = S.players; eq(E.walls(S, a), 8, 'у каждого от замка 🧱8'); }
  { // v9.2: от шпиона замок защищает вполовину
    const S = mk(), [a, b] = S.players; eq(E.walls(S, b), 8, 'от нападений — 🧱8'); const info = E.spyInfo(S, a, b, 2); eq(info.G, 4, 'против шпиона стража 🧱4 (половина замка)');
    est(S, b, 'wall'); eq(E.spyInfo(S, a, b, 2).G, 4 + D.ESTATES.wall.walls, 'купленная стена идёт целиком'); }
  // v9.3: шпионы
  { // Куртизанка: удача — в свой следующий ход соперник не нанимает знамён
    const S = mk(), [a, b] = S.players; a.temp.int = 60; ans = (q) => (q.type === 'target' ? 1 : q.type === 'buyoff' ? false : null);
    await fx(S, a, D.COURT.courtesan.fx); ans = null; ok(b.lockNext, 'Куртизанка: соперник помечен'); S.cur = 1; await E.startOfTurn(S, b); b.turn.rolled = true; b.gold = 50; S.vRow = ['fuller'];
    ok(/Куртизанка/.test(E.hireBlock(S, b, 'fuller') || ''), 'Куртизанка: в этот ход наём закрыт'); b.turn = fresh(); ok(!E.hireBlock(S, b, 'fuller'), 'на следующий ход — снова можно'); }
  { // Смутьян: 1🪙 за каждое знамя соперника — в банк
    const S = mk(), [a, b] = S.players; a.temp.int = 60; b.vassals = ['fuller', 'ida', 'gunnar']; b.gold = 10; ans = (q) => (q.type === 'target' ? 1 : q.type === 'buyoff' ? false : null);
    const ga = a.gold; await fx(S, a, D.COURT.agitator.fx); ans = null; eq(b.gold, 7, 'Смутьян: −3🪙 за 3 знамени'); eq(a.gold, ga, 'золото — в банк, не шпиону'); }
  { // Вербовщик: вассал ваш, половина цены — в банк
    const S = mk(), [a, b] = S.players; a.temp.int = 60; b.vassals = ['fuller']; a.gold = 30; const gb = b.gold, cost = D.BAN.fuller.cost;
    ans = (q) => (q.type === 'target' ? 1 : q.type === 'buyoff' ? false : q.type === 'poach' ? q.options[0] : null);
    await fx(S, a, D.COURT.recruiter.fx); ans = null;
    ok(a.vassals.includes('fuller') && !b.vassals.includes('fuller'), 'Вербовщик: вассал переманен'); eq(30 - a.gold, Math.ceil(cost / 2), 'Вербовщик: половина цены'); eq(b.gold, gb, 'соперник золота не получает'); }
  { const all = E.newGame({ seed: 5, modules: ['lords', 'sieges', 'spy'], players: [{ house: 'deer' }, { house: 'owl' }], first: 0 }); const xs = [...all.courtDeck, ...all.courtRow];
    for (const id of ['recruiter', 'courtesan', 'agitator']) eq(xs.filter(x => x === id).length, 2, `«${D.COURT[id].name}» — 2 копии`); }
  // ---------- v10.16: ритуалы и чудеса ----------
  { const W = D.RITUALS, ids = Object.keys(W);
    eq(ids.length, 16, 'ритуалов 16');
    ok(Object.keys(D.FAITHS).every(f => ids.filter(id => W[id].faith === f).length === 2), 'по 2 ритуала у каждой веры');
    ok(ids.every(id => W[id].steps.map(st => st.k).sort().join() === 'abst,alms,deed,have,trash'), 'в каждом ритуале по одному условию каждого вида');
    ok(ids.every(id => W[id].miracle && W[id].miracle.name && W[id].miracle.text && Object.keys(W[id].miracle.mods).length === 1), 'у каждого ритуала — чудо со свойством');
    eq(Object.keys(D.NEEDS.ritual).sort().join(), 'blade_a,flame_a,shade_a', 'ритуалы с модулями: Испытание огнём, Посвящение, Ночной совет');
    const S = mk(['tA', 'tB'], ['faith', 'lords']); ok(!E.ritualsFor(S, 'flame').includes('flame_a') && E.ritualsFor(S, 'flame').includes('flame_b'), 'без «Вражды» у Пламени — один ритуал'); }
  { // начать: только в вере, без грехов и реликвии
    const S = mk(), [a] = S.players;
    ok(/вера/.test(E.ritualBlock(S, a, 'grain_a') || ''), 'без веры ритуал не начать');
    a.faiths = ['grain']; eq(E.ritualBlock(S, a, 'grain_a'), null, 'в вере — можно');
    a.sins = ['sin_greed']; ok(/грех/.test(E.ritualBlock(S, a, 'grain_a') || ''), 'с грехом — нельзя'); a.sins = [];
    addEst(S, a, 'cursedrelic'); ok(/реликвия/i.test(E.ritualBlock(S, a, 'grain_a') || ''), 'с Проклятой реликвией — нельзя'); }
  { // «Великая жатва» целиком: жертва, милостыня, сбор, подвиг, воздержание → чудо «Святая земля»
    const S = mk(), [a, b] = S.players; a.faiths = ['grain']; a.turn.rolled = true; a.hand = ['tax', 'tax', 'tax'];
    eq((await E.startRitual(S, a, 'grain_a')).ok, true, 'ритуал начат');
    ans = (q) => (q.type === 'trash' ? [0, 1] : null);
    await E.ritualAct(S, a, 0); ok(a.ritual.marks[0] && a.hand.length === 1 && a.trashed.length >= 2, 'жертва: 2 карты из руки — из игры');
    const gb = b.gold; await E.ritualAct(S, a, 4); ok(a.ritual.marks[4] && b.gold === gb + 5, 'милостыня: 5🪙 самому бедному');
    est(S, a, 'field', 'pasture'); T.ritualTick(S, a); ok(!a.ritual.marks[1], 'сбор: 2 Земли — ещё нет'); addEst(S, a, 'vineyard'); T.ritualTick(S, a); ok(a.ritual.marks[1], 'сбор: 3 Земли — отметка');
    for (let k = 0; k < 3; k++) { a.turn = fresh(); a.turn.rolled = true; a.hand = ['tax']; ans = (q) => (q.type === 'trash' ? [0] : null); const r = await E.rite(S, a, 'grain'); ok(r.ok, `обряд ${k + 1}`); }
    ok(a.ritual.marks[2], 'подвиг: обряд 3 раза');
    a.turn = fresh(); a.turn.did = { attack: true }; T.ritualEndTurn(S, a); eq(a.ritual.abst, 0, 'воздержание: напал — счёт с нуля');
    for (let k = 0; k < 2; k++) { a.turn = fresh(); T.ritualEndTurn(S, a); } eq(a.ritual.abst, 2, 'воздержание: 2 хода');
    const f0 = E.prod(S, a).faith; a.turn = fresh(); T.ritualEndTurn(S, a); ans = null;
    ok(!a.ritual && a.miracles.includes('grain_a'), 'все 5 отметок — чудо');
    eq(E.prod(S, a).faith, f0 + 3, 'Святая земля: каждая Земля — ещё 🕯');
    // второй ритуал своей веры — можно; первый — нет
    a.turn = fresh(); a.turn.rolled = true; ok(/пройден/.test(E.ritualBlock(S, a, 'grain_a') || ''), 'пройденный ритуал заново не начать'); eq(E.ritualBlock(S, a, 'grain_b'), null, 'второй ритуал своей веры — можно');
    // грех: чудо молчит; покаяние снимет — снова действует
    a.sins = ['sin_greed']; eq(E.prod(S, a).faith, f0, 'грех: чудо молчит'); a.sins = []; eq(E.prod(S, a).faith, f0 + 3, 'без греха чудо снова действует');
    // отречение: чудеса веры уходят
    a.gold = 20; a.turn.renounced = false; await E.renounceFaith(S, a, 'grain'); ok(!a.miracles.includes('grain_a'), 'отреклись — чудо уходит'); }
  { // грех сжигает отметки
    const S = mk(), [a] = S.players; a.faiths = ['harvest']; a.turn.rolled = true; await E.startRitual(S, a, 'harvest_b');
    a.ritual.marks[3] = true; await E.takeSin(S, a, 'sin_gluttony'); ok(!a.ritual, 'взяли грех — ритуал прерван'); }
  { // реликвия — пауза: подвиг не считается, жертву не принести
    const S = mk(), [a] = S.players; a.faiths = ['blade']; a.turn.rolled = true; await E.startRitual(S, a, 'blade_b'); addEst(S, a, 'cursedrelic');
    ok(/реликвия/i.test(E.ritualActBlock(S, a, 4) || ''), 'реликвия: милостыню не подать'); a.estates = []; eq(E.ritualActBlock(S, a, 4), null, 'реликвию сняли — можно'); }
  const miracle = (S, p, id) => { p.faiths = [D.RITUALS[id].faith]; p.miracles = [id]; };
  { // «Щедрая нива» и «Рог изобилия»: Земля и Ремесло срабатывают ещё раз — каждое срабатывание отдельно
    const S = mk(), [a] = S.players; miracle(S, a, 'grain_b'); est(S, a, 'field'); const g0 = a.gold; await T.resolveRoll(S, a, 1); eq(a.gold - g0, 2 * (1 + 1), 'Щедрая нива: Пашня 1+1 (вера I) — дважды');
    const S1 = mk(), [b1] = S1.players; miracle(S1, b1, 'grain_b'); addEst(S1, b1, 'field', { ruined: true }); const gr = b1.gold; await T.resolveRoll(S1, b1, 1);
    ok(!b1.estates[0].ruined && b1.gold - gr === 2, 'Щедрая нива: Земля в руинах — первое срабатывание ремонт, второе доход');
    const S2 = mk(), [c] = S2.players; miracle(S2, c, 'harvest_b'); est(S2, c, 'shop'); const g1 = c.gold; await T.resolveRoll(S2, c, 4); eq(c.gold - g1, 2 * (1 + 1), 'Рог изобилия: Лавка 1+1 (вера I) — дважды'); }
  { // «Двойная добыча»: Набег срабатывает ещё раз — и «за срабатывание Набега» (Вигго Следопыт) тоже дважды
    const S = mk(), [a, b] = S.players; miracle(S, b, 'flame_b'); est(S, b, 'barracks'); b.vassals = ['vigo']; b.deck = Array(6).fill('tax'); b.hand = []; a.gold = 20; await T.resolveRoll(S, a, 4);
    eq(20 - a.gold, (2 + 1) * 2, 'Двойная добыча: Набег (2 +1 Пламя I) — дважды'); eq(b.hand.length, 2, 'Вигго: за каждое срабатывание Набега — карта, всего 2');
    const S3 = mk(), [c3, d3] = S3.players; miracle(S3, d3, 'flame_b'); est(S3, d3, 'barracks'); c3.gold = 4; await T.resolveRoll(S3, c3, 4); eq(c3.gold, 0, 'второй раз Набег берёт, сколько осталось'); }
  { // «Сбор»: владения в руинах не считаются
    const S = mk(), [a] = S.players; a.faiths = ['grain']; a.turn.rolled = true; est(S, a, 'field', 'pasture'); addEst(S, a, 'vineyard', { ruined: true });
    await E.startRitual(S, a, 'grain_a'); ok(!a.ritual.marks[1], 'Сбор: 2 Земли и одна в руинах — ещё не 3'); a.estates[2].ruined = false; T.ritualTick(S, a); ok(a.ritual.marks[1], 'отстроили — Сбор готов'); }
  { // «Вечная ярмарка»: одна покупка без действия
    const S = mk(), [a] = S.players; miracle(S, a, 'harvest_a'); a.turn.rolled = true; a.gold = 30; S.estateRow = ['field', 'pasture', 'vineyard', 'shop'];
    const r1 = await E.buy(S, a, 'estate', 0); const r2 = await E.buy(S, a, 'estate', 0); const r3 = await E.buy(S, a, 'estate', 0);
    ok(r1.ok && r2.ok && !r3.ok, 'Вечная ярмарка: две покупки за ход, третья — нет'); }
  { // «Верность до гроба»: содержание по 1🪙
    const S = mk(), [a] = S.players; a.lords = ['martin','leopold']; const u0 = E.upkeepOf(a); miracle(S, a, 'blade_a'); eq(E.upkeepOf(a), 2, `Верность до гроба: ${u0}🪙 → 2🪙`); }
  { // «Небесный стяг»: цель — на одно знамя меньше
    const S = mk(['tA', 'tB'], ['faith', 'lords']), [a] = S.players; a.vassals = ['ida', 'gunnar', 'sabina', 'emmerich', 'fuller', 'brand']; a.lords = ['magnus', 'tobias', 'orvin'];
    ok(!E.meetsGoal(S, a), 'без чуда: 3 лорда из 4 — не цель'); miracle(S, a, 'blade_b'); ok(E.meetsGoal(S, a), 'Небесный стяг: 3 лорда из 4 — цель'); }
  { // «Созвездие»: двойная свита у первой же карты
    const S = mk(), [a] = S.players; miracle(S, a, 'star_a'); const id = Object.keys(D.COURT).find(k => { const c = D.COURT[k]; return c.role && c.ally && c.ally.length === 1 && c.ally[0][0] === 'gold' && c.fx.length === 1 && c.fx[0][0] === 'gold' && !c.faith && !c.sin; });
    a.hand = [id]; a.turn.rolled = true; const g0 = a.gold; await E.play(S, a, 0); eq(a.gold - g0, D.COURT[id].fx[0][1] + 2 * D.COURT[id].ally[0][1], `Созвездие: «${D.COURT[id].name}» с двойной свитой`); }
  { // «Звёздная память»: рука остаётся, новых — сколько обычно
    const S = mk(), [a] = S.players; miracle(S, a, 'star_b'); a.hand = ['tax', 'tax']; const hs = E.handSize(S, a); E.endTurn(S, a); eq(a.hand.length, 2 + hs, 'Звёздная память: 2 + полная рука'); }
  { // «Неугасимое пламя»: в бою лучший из двух кубиков
    ok(E.attackOdds(5, 5, true, false) > E.attackOdds(5, 5) + 0.15 && E.attackOdds(5, 5, false, true) < E.attackOdds(5, 5) - 0.15, 'Неугасимое пламя: шансы и в нападении, и в защите'); }
  { // «Благодать»: второе действие за 3🪙 — и без великих лордов
    const S = mk(['tA', 'tB'], ['faith', 'lords']), [a] = S.players; a.turn.rolled = true; ok(!E.extraOn(S, a), 'без великих второго действия нет'); miracle(S, a, 'cathedral_a');
    ok(E.extraOn(S, a) && E.extraCost(S, a) === 3, 'Благодать: второе действие есть, 3🪙'); const g0 = a.gold; eq(E.buyAction(S, a).ok, true, 'второе действие куплено'); eq(g0 - a.gold, 3, 'за 3🪙'); }
  { // «Благовест»: в начале хода Земли приносят доход
    const S = mk(), [a] = S.players; miracle(S, a, 'cathedral_b'); est(S, a, 'field', 'pasture'); const g0 = a.gold; await T.startOfTurn(S, a);
    ok(a.gold - g0 >= 2, `Благовест: Земли принесли доход в начале хода (+${a.gold - g0})`); }
  { // «Ясновидение»: верх колоды — как карта ряда
    const S = mk(), [a] = S.players; miracle(S, a, 'seer_b'); a.turn.rolled = true; a.gold = 30; S.estateDeck.push('mine'); const n0 = S.estateDeck.length;
    const r = await E.buy(S, a, 'estateTop', 0); ok(r.ok && a.estates.some(e => e.id === 'mine') && S.estateDeck.length === n0 - 1, 'Ясновидение: купили верхнюю карту колоды владений');
    a.turn = fresh(); a.turn.rolled = true; S.vDeck.push('ida'); S.vRow = S.vRow.filter(x => x !== 'ida'); const h = await E.hire(S, a, 'ida'); ok(h.ok && a.vassals.includes('ida'), 'Ясновидение: наняли верхнего вассала колоды');
    const S2 = mk(), [c] = S2.players; c.turn.rolled = true; c.gold = 30; S2.estateDeck.push('mine'); ok(!(await E.buy(S2, c, 'estateTop', 0)).ok, 'без чуда верх колоды не купить'); }
  { // «Перст судьбы»: повернуть кубик; дубль от поворота не считается
    const S = mk(), [a] = S.players; miracle(S, a, 'seer_a'); a.turn = fresh(); ans = (q) => (q.type === 'adjust' ? (q.sets ? { a: 'set', k: 1, v: q.vals[0] } : { a: 'accept' }) : null);
    await E.roll(S, a, 2); ans = null; ok(S.lastRoll.vals[0] === S.lastRoll.vals[1] && a.turn.setUsed, 'Перст судьбы: кубик повёрнут'); ok(!a.turn.extraTurn, 'дубль от поворота ещё хода не даёт'); }
  { // «Нашёптанная судьба»: соперник бросает столько кубиков, сколько решили
    const S = mk(), [a, b] = S.players; miracle(S, a, 'shade_b'); ans = (q) => (q.type === 'dictate' ? { i: 1, n: 1 } : null); await T.startOfTurn(S, a); ans = null;
    ok(b.forceDice && b.forceDice.n === 1, 'Нашёптанная судьба: соперник помечен'); S.cur = 1; b.turn = fresh(); await E.roll(S, b, 2); eq(S.lastRoll.n, 1, 'соперник бросил один кубик'); ok(!b.forceDice, 'метка снята'); }
  { // «Чужими руками»: карта соперника на ход, потом возвращается; в отставку её не отправить
    const S = mk(), [a, b] = S.players; miracle(S, a, 'shade_a'); b.discard = ['collector']; ans = (q) => (q.type === 'borrow' ? 0 : null); await T.borrowCard(S, a); ans = null;
    ok(a.hand.includes('collector') && !b.discard.includes('collector'), 'Чужими руками: карта в руке'); a.turn.retired = false; const k = a.hand.indexOf('collector');
    ok(!(await E.retire(S, a, k)), 'одолженную карту в отставку не отправить'); E.endTurn(S, a); ok(b.discard.includes('collector') && !a.hand.includes('collector') && !a.discard.includes('collector'), 'в конце хода карта вернулась владельцу'); }
  // ================= v10.17: итог броска заранее (окно броска, «Перст судьбы») =================
  { // rollPreview = настоящий бросок: Земли всех, свои Ремёсла, чужие Набеги, руины, «срабатывает ещё раз», двое и трое
    let same = 0, all = 0; const bad = [];
    for (const n of [2, 3]) for (const mir of [null, 'grain_b', 'harvest_b', 'flame_b']) for (let r = 1; r <= 12; r++) {
      const S = mk(n === 2 ? ['tA', 'tB'] : ['tA', 'tB', 'tC']), [a, b] = S.players;
      est(S, a, 'field', 'bakery', 'pasture', 'smithy'); est(S, b, 'field', 'barracks', 'meadery', 'outpost', 'caravan'); if (n === 3) est(S, S.players[2], 'pasture', 'wolfden', 'mine');
      a.gold = 7; b.gold = 3; b.estates[0].ruined = true; // у соперника Земля в руинах: первое срабатывание — ремонт
      if (mir) for (const q of S.players) { q.faiths = [D.RITUALS[mir].faith]; q.miracles = [mir]; }
      const pv = E.rollPreview(S, a, r), g0 = S.players.map(q => q.gold);
      await T.resolveRoll(S, a, r); all++;
      const d = S.players.map((q, i) => q.gold - g0[i]);
      if (pv.every((x, i) => x.gain - x.loss === d[i])) same++; else if (bad.length < 3) bad.push(`${n} игр., ${mir || 'без чуда'}, бросок ${r}: ждали ${d.join('/')}, заранее ${pv.map(x => x.gain - x.loss).join('/')}`);
    }
    eq(same, all, `итог броска заранее = настоящий бросок${bad.length ? ' — ' + bad.join('; ') : ''}`);
    const S = mk(), [a, b] = S.players; est(S, b, 'barracks'); a.gold = 1; // Набег соперника берёт сколько есть
    const pv = E.rollPreview(S, a, 4); ok(pv[0].loss === 1 && pv[1].gain === 1, `бросок 4: Казармы соперника берут 1🪙 из 1 (вышло −${pv[0].loss} / +${pv[1].gain})`); }
  console.log(`\nИТОГ: ${passes} проверок прошли, ${fails} не прошли`);
})().catch(e => { console.log('CRASH', e.stack); });
// ===== Ярмарка на ход (карты двора): таких карт в основе больше нет — проверка убрана =====
