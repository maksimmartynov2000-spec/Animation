// Схематичные лица карт: что даёт карта — значками с короткой подписью.
// Один модуль для печатных карт (Node) и браузерной игры, чтобы схемы везде были одинаковые и совпадали с движком.
//   CardFX.estate(d)      — владение: когда срабатывает, что даёт, что постоянно
//   CardFX.court(c)       — карта двора: сыграть / свита / замысел
//   CardFX.mods(m, prod)  — постоянные свойства вассалов, лордов, Домов, сезонов, титулов
//   CardFX.chips(list, ico) / CardFX.trig(t, ico) — HTML; ico(key) возвращает <img> значка
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CardFX = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SYM = { trade: '⚖️', sci: '📜', war: '⚔️', int: '🔗', faith: '🕯' };
  const SYMS = ['trade', 'sci', 'war', 'int', 'faith'];
  const PGEN = { N: 'Севера', S: 'Юга', E: 'Востока', W: 'Запада' };
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };
  const numText = (n) => !n || !n.length ? '' : n.length === 1 ? String(n[0]) : n.every((v, i) => !i || v === n[i - 1] + 1) ? `${n[0]}–${n[n.length - 1]}` : n.join(', ');

  // ---------- владения ----------
  const WHO = { land: ['any', 'в ход любого игрока'], craft: ['own', 'в свой ход'], raid: ['other', 'в ход другого игрока'], hold: ['own', 'в свой ход'], bad: ['other', 'в ход другого игрока'] };
  // v10.14: проклятия — что делают, пока лежат у того, кому их подбросили (крупно на карте)
  const CURSE = {
    tax: () => ({ v: '0', i: 'gold', c: 'доход его 🟩 Ремёсел получает тот, кто подбросил', big: true }),
    blight: () => ({ v: '0', i: 'gold', c: 'его 🟦 Земли не приносят дохода', big: true }),
    quarantine: () => ({ c: 'он не покупает владения', big: true }),
    bandits: () => ({ v: '✕', i: 'raid', c: 'его 🟥 Набеги и 🟪 Твердыни не срабатывают', big: true }),
    walls: (d) => ({ v: `−${Math.abs(d.walls || 0)}`, i: 'wall', c: 'его 🧱 Стены слабее', big: true }),
    evileye: () => ({ v: '1', i: 'dice', c: 'он бросает только один кубик', big: true }),
    relic: () => ({ v: '✕', i: 'faith', c: 'его вера не действует: ни ступени, ни обряд, ни карты веры', big: true }),
    schemer: () => ({ v: '✕', i: 'banner', c: 'он не нанимает знамёна', big: true }),
  };
  function estate(d) {
    const trig = d.t === 'wall' || d.bad ? { who: 'none', label: d.t === 'wall' ? 'от кубика не срабатывает' : 'действует всегда', nums: [] } : { who: WHO[d.t][0], label: WHO[d.t][1], nums: d.n };
    let main;
    if (d.t === 'wall') main = [{ v: `+${d.walls}`, i: 'wall', big: true }];
    else if (d.t === 'raid') main = [{ v: `+${d.inc}`, i: 'gold', c: 'заберите у того, чей ход', big: true }];
    else if (d.t === 'hold') main = [{ v: `+${d.inc}`, i: 'gold', c: 'заберите у самого богатого соперника', big: true }];
    else if (d.bad) main = [CURSE[d.bad] ? CURSE[d.bad](d) : { c: d.badText, big: true }];
    else if (d.perProv) main = [{ v: `+${d.perN}`, i: 'gold', x: 'prov' + d.perProv, c: `за каждое ваше владение ${PGEN[d.perProv]}`, big: true }];
    else if (d.per) {
      const x = d.per === 'land' ? 'land' : d.per === 'raid' ? 'raid' : d.per === 'provS' ? 'provS' : d.per === 'prov' ? null : d.per;
      const c = d.per === 'land' ? 'за каждую вашу Землю' : d.per === 'raid' ? 'за каждый ваш Набег' : d.per === 'provS' ? 'за каждое ваше владение Юга' : d.per === 'prov' ? 'за каждую провинцию, где у вас есть владение' : 'за каждый ваш значок';
      main = [Object.assign({ v: `+${d.perN}`, i: 'gold', c, big: true }, x ? { x } : {})];
    } else main = [{ v: `+${d.inc}`, i: 'gold', big: true }];
    // пара: ещё одно ваше владение этой же провинции — владение приносит больше
    if (d.pair && d.p) main.push({ pre: 'prov' + d.p, v: `+${d.pair}`, i: 'gold', c: `пара — у вас есть ещё владение ${PGEN[d.p]}` });
    const perm = [];
    if (d.sym) perm.push({ v: '+1', i: d.sym });
    if (d.walls && d.t !== 'wall' && !d.bad) perm.push({ v: `+${d.walls}`, i: 'wall' });
    if (d.guard) perm.push({ v: `+${d.guard}`, i: 'guard' });
    if (d.mods) perm.push(...mods(d.mods));
    if (d.fixed) perm.push({ c: 'захватить нельзя; разрушить — только Тараном' });
    if (d.bad) perm.push({ v: '+3', i: 'int', c: 'купили — сразу подбросьте сопернику, шпионаж: удача — проклятие у него, провал — замешайте в колоду владений', buy: true });
    return { trig, main, perm, note: '' };
  }

  // ---------- эффекты карт двора ----------
  // нападения пишем словами, без формулы броска: сила (+N), что будет при удаче и что — если взять нечего (как в движке)
  // нападения — коротко: что при победе; «нападение: захват / шпионаж» уже написано строкой выше, «брать нечего» — нечего так нечего
  function spyCap(eff, p) {
    if (eff === 'steal') return `украдите ${p}🪙`;
    if (eff === 'sabotage') return 'его замысел или придворный — в сброс';
    if (eff === 'estate') return `его владение на ваш выбор до ${p}🪙 — ваше`;
    if (eff === 'grab') return 'карта из его сброса — в ваш сброс';
    if (eff === 'burn') return `${p} ${plural(p, 'карта', 'карты', 'карт')} из его сброса — из игры`;
    if (eff === 'poach') return (typeof DATA !== 'undefined' ? DATA : require('./data.js')).RULES.poachHalf ? 'его вассал на ваш выбор — ваш; половину цены с карты — в банк' : 'его вассал на ваш выбор — ваш; заплатите ему цену с карты';
    if (eff === 'lock') return 'в свой следующий ход он не нанимает знамён';
    if (eff === 'tax') return `он отдаёт в банк ${p}🪙 за каждое своё знамя`;
    if (eff === 'distract') return 'его лорд на ваш выбор не действует до конца его следующего хода';
    if (eff === 'riot') return `в его следующий ход содержание его великих лордов на ${p}🪙 дороже`;
    if (eff === 'arson') return `соперник теряет ${p}🪙`;
    if (eff === 'denounce') return `соперник сбрасывает ${p} ${plural(p, 'случайную карту', 'случайные карты', 'случайных карт')} из руки`;
    if (eff === 'slander') return 'в свой следующий ход он не покупает карты двора';
    if (eff === 'feast') return `он сбрасывает случайную карту из руки и теряет ${p}🪙`;
    return '';
  }
  function fx(list) {
    return (list || []).map(([k, a, b, c]) => {
      switch (k) {
        case 'gold': return { v: `+${a}`, i: 'gold' };
        case 'draw': return { v: `+${a}`, i: 'card', c: plural(a, 'карта', 'карты', 'карт') };
        case 'temp': return { v: `+${b}`, i: a, c: 'до конца хода' };
        case 'goldPerCraft': return { v: `+${a}`, i: 'gold', x: 'craft', c: 'за каждое ваше Ремесло' };
        case 'goldPerRaid': return { v: `+${a}`, i: 'gold', x: 'raid', c: 'за каждый ваш Набег' };
        case 'goldPerSym': return { v: `+${b}`, i: 'gold', x: a, c: 'за каждый ваш значок' };
        case 'goldPerLand': return { v: `+${a}`, i: 'gold', x: 'land', c: 'за каждую вашу Землю' };
        case 'goldPerProv': return { v: `+${a}`, i: 'gold', c: 'за каждую провинцию, где у вас есть владение' };
        case 'goldIfFaith': return { v: `+${a}`, i: 'gold', c: 'ещё, если у вас есть вера' };
        case 'buys': return { v: `+${a}`, i: 'action', c: `${plural(a, 'действие', 'действия', 'действий')} в этот ход` };
        case 'discount': return { v: `−${a}🪙`, i: 'tag', c: 'следующая ваша покупка на рынке в этот ход' };
        case 'regDiscount': return { v: `−${a}🪙`, i: 'banner', c: 'следующее знамя в этот ход' };
        case 'fairCourt': return { i: 'action', c: 'Ярмарка: карта двора без действия' };
        case 'reroll': return { i: 'reroll', c: 'сыграйте до броска: в этот ход можно перебросить кубики' };
        case 'forage': return { v: `+${b}`, i: 'gold', c: `заберите у самого богатого, у кого ${SYM[a]} меньше, чем у вас` };
        case 'siege': return { pre: 'siege', v: `+${a}`, i: 'war', c: 'победа — возьмите любое его владение до 4🪙 (оно в руинах)' };
        case 'stageGold': return { v: `+${a}`, i: 'gold', c: 'за каждую ступень вашей веры (I–III)' };
        case 'perPlayed': return { v: `+${b}`, i: 'gold', c: `за каждую сыгранную в этот ход «Подать»` };
        case 'raze': return { pre: 'raze', v: `+${a}`, i: 'war', c: `победа — его владение на ваш выбор${b >= 99 ? '' : ` до ${b}🪙`} ${c === 'wall' ? 'и одна стена разрушаются' : 'разрушается'}${c === 'nowalls' ? '; его стены не в счёт' : ''}` };
        case 'plant': return { pre: 'spy', v: `+${a}`, i: 'int', c: 'купили или сыграли — подсуньте сопернику: удача — беда в его сбросе, провал — замешайте в колоду двора' };
        case 'trashGold': return { v: `до ${a}`, i: 'trash', c: `${plural(a, 'карты', 'карт', 'карт')} из руки уберите из игры, +${b}🪙 за каждую` };
        case 'spy': return { pre: 'spy', v: `+${a}`, i: 'int', c: `удача — ${spyCap(b, c)}` };
        case 'trash': return { v: `до ${a}`, i: 'trash', c: `${plural(a, 'карты', 'карт', 'карт')} из руки уберите из игры навсегда` };
        case 'board': return { v: `+${a}`, i: 'gold', c: 'заберите у самого богатого соперника, если ваших ⚔️ не меньше, чем у него; иначе — 1🪙' };
        case 'ambush': return { v: `+${a}`, i: 'gold', c: 'засада' };
        case 'fire': return { i: a, c: a === 'craft' ? 'ваши Ремёсла приносят доход прямо сейчас' : 'ваши Земли приносят доход прямо сейчас' };
        case 'echo': return { i: 'card', c: 'ещё раз эффект предыдущей карты двора, сыгранной вами в этот ход' };
        case 'snatch': return { v: '+1', i: 'card', c: 'из сброса соперника — вам в руку' };
        case 'fetchOne': return { v: '+1', i: 'card', c: 'из своего сброса — в руку, кроме сыгранных в этот ход' };
        case 'goldPerBanner': return { v: `+${a}`, i: 'gold', x: 'banner', c: 'за каждое ваше знамя' };
        case 'shield': return { i: 'raid', c: 'до конца вашего следующего хода чужие Набеги и Твердыни у вас ничего не забирают' };
        case 'levy': return { v: `+${a}`, i: 'gold', c: 'заберите у самого богатого соперника' };
        case 'unseat': return { i: 'seat', c: 'опала: придворный соперника — в его сброс' };
        default: return { c: k };
      }
    });
  }
  // замысел с тем же нападением, что и розыгрыш, — коротко: «то же, но +5»
  const ATTACKS = ['siege', 'raze', 'spy'];
  function court(c) {
    let plot = c.plot ? fx(c.pfx) : null;
    if (plot && c.pfx.length === 1 && c.fx.length === 1 && ATTACKS.includes(c.pfx[0][0]) && c.pfx[0][0] === c.fx[0][0]) {
      const [k, a, b, cc] = c.pfx[0], [, a0, b0, c0] = c.fx[0];
      const same = k === 'spy' ? b === b0 : true;
      if (same) {
        const what = k === 'siege' ? 'захват' : k === 'raze' ? 'разрушение' : 'шпионаж';
        const extra = k === 'spy' && cc !== c0 ? ` (ценой до ${cc}🪙)` : k === 'raze' && b !== b0 ? ` (ценой до ${b}🪙)` : '';
        plot = [{ pre: k, v: `+${a}`, i: k === 'spy' ? 'int' : 'war', c: `${what}, как выше${extra}` }];
      }
    }
    const ally = !c.ally ? null : JSON.stringify(c.ally) === JSON.stringify(c.fx) && c.fx.length === 1 && c.fx[0][0] === 'forage' ? [{ c: 'ещё раз то же' }] : fx(c.ally);
    return { play: fx(c.fx), ally, plot: c.plot ? { kind: c.plot, n: c.pn || null, chips: plot } : null,
      seat: c.seat ? mods(c.seat.mods, c.seat.prod).map(x => (x.c === 'постоянно' ? Object.assign({}, x, { c: 'значок, пока сидит' }) : x)) : null };
  }

  // ---------- постоянные свойства: вассалы, лорды, Дома, сезоны, титулы ----------
  const STEP = (k) => ((typeof DATA !== 'undefined' ? DATA : require('./data.js')).RULES[k]) || 10;
  const MOD = {
    dice2: () => ({ i: ['dice', 'dice'], c: 'можно бросать 2 кубика' }),
    savings: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: `в начале хода — за каждые ${STEP('savingsStep')}🪙 у вас` }),
    vasCheap: (n) => ({ pre: 'banner', v: `−${n}`, i: 'gold', c: 'каждый вассал вам дешевле' }),
    lordCheap: (n) => ({ pre: 'crown', v: `−${n}`, i: 'gold', c: 'каждый лорд вам дешевле' }),
    advantage: () => ({ i: ['dice', 'dice'], c: 'каждый бросок: бросайте дважды и выбирайте результат' }),
    predict: (n) => ({ pre: 'dice', v: `+${n}`, i: 'gold', c: 'перед броском назовите сумму кубиков; угадали — получите' }),
    freeCourtBuy: () => ({ i: 'action', c: 'Ярмарка: раз в ход карта двора без действия' }),
    freeEstateBuy: () => ({ i: 'action', c: 'Ярмарка: раз в ход владение без действия' }),
    freeLandBuy: () => ({ i: 'action', c: 'Ярмарка: раз в ход 🟦 Землю без действия' }),
    freeRaidBuy: () => ({ i: 'action', c: 'Ярмарка: раз в ход 🟥 Набег без действия' }),
    doubleGold: (n) => ({ v: `+${n}`, i: 'gold', c: 'выпал дубль на двух кубиках' }),
    allyAll: () => ({ i: 'card', c: 'свита срабатывает у всех ваших карт двора — даже у первой за ход' }),
    lootPlus: (n) => (n >= 50 ? { pre: 'siege', i: 'gold', c: 'захватом можно взять владение любой цены' } : { pre: 'siege', v: `${4 + n}`, i: 'gold', c: 'захватом можно взять владение до этой цены' }),
    provBonus_N: (n) => ({ pre: 'provN', v: `+${n}`, i: 'gold', c: 'каждое ваше владение Севера приносит больше' }),
    provBonus_S: (n) => ({ pre: 'provS', v: `+${n}`, i: 'gold', c: 'каждое ваше владение Юга приносит больше' }),
    provBonus_E: (n) => ({ pre: 'provE', v: `+${n}`, i: 'gold', c: 'каждое ваше владение Востока приносит больше' }),
    provBonus_W: (n) => ({ pre: 'provW', v: `+${n}`, i: 'gold', c: 'каждое ваше владение Запада приносит больше' }),
    oathFree: () => ({ i: 'faith', c: 'обет вашей веры на вас не действует' }),
    stageUp: (n) => ({ v: `+${n}`, i: 'faith', c: 'ступень вашей веры выше (не выше III)' }),
    craftAny: () => ({ i: 'craft', c: '🟩 Ремёсла приносят доход и в чужой ход' }),
    banIncome: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода — за каждые 2 ваших знамени' }),
    fetch: () => ({ i: 'card', c: 'раз в ход возьмите карту из своего сброса в руку — даже сыгранную в этот ход' }),
    retireDraw: (n) => ({ pre: 'trash', v: `+${n}`, i: 'card', c: 'ещё при Отставке' }),
    retireGold: (n) => ({ pre: 'trash', v: `+${n}`, i: 'gold', c: 'при Отставке' }),
    faithGold: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода, если у вас есть вера' }),
    faithEase: (n) => ({ v: `−${n}`, i: 'faith', c: 'для любой веры нужно меньше' }),
    faithAdoptGold: (n) => ({ v: `+${n}`, i: 'gold', c: 'когда принимаете веру' }),
    freeRenounce: () => ({ i: 'faith', c: 'отречение от веры — бесплатно' }),
    infidelTithe: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода — у самого богатого соперника не вашей веры (или без веры)' }),
    faithTithe: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода — у самого богатого соперника не вашей веры; каждому единоверцу +1🪙 из банка' }),
    shield: (n) => ({ v: `−${n}`, i: 'siege', c: 'нападения и шпионы против вас слабее' }),
    spyWinGold: (n) => ({ pre: 'spy', v: `+${n}`, i: 'gold', c: 'за каждый удачный шпионаж' }),
    freeSpy: () => ({ dawn: 1, pre: 'spy', v: '+1', i: 'int', c: 'в начале хода — шпионаж без карты: удача — украдите 2🪙' }),
    plotThird: () => ({ i: 'dice', c: '🎲-замысел: назовите ещё одно число' }),
    twoFaiths: () => ({ i: ['faith', 'faith'], c: 'две веры сразу: ступени и обеты обеих; обряд — один в ход' }),
    symIncome_trade: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода — за каждые 2 ваших ⚖️' }),
    symIncome_faith: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода — за каждые 2 ваших 🕯' }),
    symFee_trade: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода, если у вас ⚖️ больше всех' }),
    symFee_faith: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода, если у вас 🕯 больше всех' }),
    greenBonus: (n) => ({ pre: 'craft', v: `+${n}`, i: 'gold', c: 'каждое ваше Ремесло приносит больше' }),
    blueBonus: (n) => ({ pre: 'land', v: `+${n}`, i: 'gold', c: 'каждая ваша Земля приносит больше' }),
    winter: () => ({ pre: 'land', v: '−1', i: 'gold', c: 'с каждой Земли, кроме Севера' }),
    interest: (n) => ({ dawn: 1, v: '+1', i: 'gold', c: n >= 50 ? `в начале хода — за каждые ${STEP('interestStep')}🪙 у вас` : `в начале хода — за каждые ${STEP('interestStep')}🪙 у вас, до +${n}` }),
    symBuy: (n) => ({ v: `${n}`, i: 'gold', c: 'за значок: можно докупать недостающие' }),
    tradeCheap: (n) => { const t = (typeof DATA !== 'undefined' ? DATA : require('./data.js')).RULES.trade; return { v: String(Math.max(1, t - (n || 1))), i: 'gold', c: `докупка значка вместо ${t}🪙` }; },
    buys: (n) => ({ v: `+${n}`, i: 'action', c: 'действие каждый ваш ход' }),
    startGold: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода' }),
    regCheap: (n) => ({ pre: 'banner', v: `−${n}`, i: 'gold', c: 'каждое знамя вам дешевле' }),
    reroll: (n) => ({ v: n > 1 ? `×${n}` : '', i: 'reroll', c: n > 1 ? `${n} раза за ход можно перебросить кубики` : 'раз в ход можно перебросить кубики' }),
    shift: (n) => ({ v: `±${n}`, i: 'shift', c: `раз в ход после броска за ${(typeof DATA !== 'undefined' ? DATA : require('./data.js')).RULES.shiftCost || 2}🪙: сумма на 1 больше или меньше` }),
    hand: (n) => ({ v: `+${n}`, i: 'card', c: 'в руке: добираете на карту больше' }),
    symIncome_sci: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода — за каждые 2 ваших 📜' }),
    symIncome_war: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода — за каждые 2 ваших ⚔️' }),
    symIncome_int: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода — за каждые 2 ваших 🔗' }),
    landIncome: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода — за каждые 2 ваши Земли' }),
    craftIncome: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода — за каждые 2 ваших Ремесла' }),
    plotIncome: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода — за каждый ваш замысел' }),
    seatGuard: () => ({ i: 'seat', c: 'ваших придворных нельзя прогнать' }),
    redIncome: () => ({ dawn: 1, v: '+1', i: 'gold', x: 'raid', c: 'в начале хода — за каждый ваш Набег' }),
    unionGold: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода — за каждый ваш союз' }),
    tithe: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода — заберите у самого богатого соперника' }),
    buyToll: (n) => ({ v: `+${n}`, i: 'gold', c: 'из банка, когда соперник что-то покупает на рынке' }),
    tribute: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода — заберите у самого богатого соперника, у кого ⚔️ меньше, чем у вас' }),
    symFee_sci: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода, если у вас 📜 больше всех' }),
    symFee_int: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода, если у вас 🔗 больше всех' }),
    symFee_war: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода, если у вас ⚔️ больше всех' }),
    warCry: (n) => ({ dawn: 1, v: `+${n}`, i: 'war', c: 'в начале хода — до конца хода' }),
    plotSlots: (n) => ({ v: `+${n}`, i: 'plot', c: 'место для замысла' }),
    plotGold: (n) => ({ v: `+${n}`, i: 'gold', c: 'за каждый ваш сработавший замысел' }),
    timedPlotBonus: (n) => ({ v: `+${n}`, i: 'gold', c: 'ещё за каждый ваш сработавший ⏳-замысел' }),
    plotProtect: () => ({ i: 'plot', c: 'ваши замыслы нельзя сорвать' }),
    plotSpread: (n) => ({ v: `±${n}`, i: 'dice', c: 'ваши 🎲-замыслы срабатывают и на соседних числах' }),
    siege: (n) => ({ pre: 'siege', v: `+${n}`, i: 'war', c: 'к каждому вашему нападению' }),
    defense: (n) => ({ v: `+${n}`, i: 'wall', c: 'к обороне' }),
    walls: (n) => ({ v: `+${n}`, i: 'wall' }),
    siegeWinGold: (n) => ({ v: `+${n}`, i: 'gold', c: 'за каждую вашу победу в захвате или разрушении' }),
    redBonus: (n) => ({ pre: 'raid', v: `+${n}`, i: 'gold', c: 'каждый ваш Набег забирает больше' }),
    raidShield: (n) => ({ pre: 'raid', v: `−${n}`, i: 'gold', c: 'чужие Набеги и Твердыни берут у вас меньше' }),
    holdBonus: (n) => ({ pre: 'hold', v: `+${n}`, i: 'gold', c: 'каждая ваша Твердыня забирает больше' }),
    landBuyGold: (n) => ({ pre: 'land', v: `+${n}`, i: 'gold', c: 'вернуть, когда покупаете Землю (но Земля — не дешевле 1🪙)' }),
    lordIncome: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода — за каждого вашего лорда и великого лорда' }),
    raidDraw: (n) => ({ pre: 'raid', v: `+${n}`, i: 'card', c: `${n === 1 ? 'карта' : 'карты'}, когда срабатывает ваш Набег` }),
    redOwn: () => ({ i: 'raid', c: 'ваши Набеги срабатывают и в ваш ход — тогда золото из банка' }),
    spy: (n) => ({ pre: 'spy', v: `+${n}`, i: 'int', c: 'к каждому вашему шпионажу' }),
    guard: (n) => ({ v: `+${n}`, i: 'guard' }),
    stealBonus: (n) => ({ v: `+${n}`, i: 'gold', c: 'к каждой вашей краже' }),
    harbor: () => ({ v: '+2', i: 'dice', c: 'к броску 2 кубиков, если выпало 10+' }),
    extraTurn: () => ({ i: ['dice', 'dice'], c: 'дубль на 2 кубиках — ещё один ход (но не два подряд)' }),
    captureImmune: () => ({ i: 'siege', c: 'ваши владения нельзя захватить, отнять вымогательством и разрушить' }),
    envyImmune: () => ({ c: 'Зависть на вас не действует' }),
    marketDiscount: (n) => ({ v: `−${n}`, i: 'tag', c: 'всё на рынке вам дешевле (но не дешевле 1🪙)' }),
    landOthers: (n) => ({ pre: 'land', v: `+${n}`, i: 'gold', c: 'с каждой Земли в чужой ход' }),
    landOwn: (n) => ({ pre: 'land', v: `+${n}`, i: 'gold', c: 'с каждой вашей Земли в ваш ход' }),
    courtCheap: (n) => ({ v: `−${n}`, i: 'tag', c: 'карты двора на рынке вам дешевле' }),
    courtToHand: () => ({ i: 'card', c: 'купленная карта двора идёт сразу в руку' }),
    unionSize: (n) => ({ c: `союз — из ${n} владений провинции` }),
    unionNoSym: () => null,
    unionFast: (n, m) => ({ c: `ваши первые ${n} союза — из 2 владений провинции, дальше — из ${(m && m.unionLate) || 3}` }),
    unionLate: null,
    ownCheap: (n) => ({ v: `−${n}`, i: 'gold', c: 'каждый вассал вам дешевле' }),
    greatCheap: (n) => ({ pre: 'foreign', v: `−${n}`, i: 'gold', c: 'каждый великий лорд вам дешевле' }),
    unionBounty: (n) => ({ v: `+${n}`, i: 'gold', c: 'ещё сразу за каждый ваш новый союз' }),
    seasonBonus: (n) => ({ v: `+${n}`, i: 'gold', c: 'в начале каждого нового сезона' }),
    freeCheap: (n) => ({ i: 'action', c: `Ярмарка: раз в ход карта двора до ${n}🪙 без действия` }),
    // модуль «Придворные»
    fairPlus: (n) => { const b = (((typeof DATA !== 'undefined' ? DATA : require('./data.js')).HOUSES.deer || {}).mods || {}).freeCheap || 0; return { i: 'action', c: `Ярмарка: карта двора до ${b + n}🪙` }; },
    freeBasic: () => ({ i: 'action', c: 'Ярмарка: раз в ход Пашня или Пекарня без действия' }),
    allyScholar: () => ({ i: 'card', c: 'свита ваших карт Учёных 📜 срабатывает всегда, даже у первой за ход' }),
    lowRollGold: (n) => ({ pre: 'dice', v: `+${n}`, i: 'gold', c: 'в ваш ход хоть на одном кубике выпала 1' }),
    regGold: (n) => ({ pre: 'banner', v: `+${n}`, i: 'gold', c: 'за каждое знамя, которое вы нанимаете' }),
    oppRegGold: (n) => ({ v: `+${n}`, i: 'gold', c: 'из банка, когда соперник нанимает знамя' }),
    seatSlots: (n) => ({ v: `+${n}`, i: 'seat', c: n === 1 ? 'ещё место при дворе' : 'ещё места при дворе' }),
    seatIncome: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода — за каждого другого вашего придворного' }),
    seatGold: (n) => ({ pre: 'seat', v: `+${n}`, i: 'gold', c: 'каждый раз, когда сажаете карту ко двору' }),
    seatFromDiscard: () => ({ i: 'seat', c: 'раз в ход посадите ко двору карту из своего сброса' }),
    provIncome: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода — за каждую провинцию, где у вас есть владения' }),
    // v8
    peek: () => ({ i: 'dice', c: 'добросок: бросьте один кубик и, увидев его, решите, бросать ли второй' }),
    rerollOne: () => ({ i: 'reroll', c: 'раз в ход перебросьте один из кубиков' }),
    doubleDraw: (n) => ({ v: `+${n}`, i: 'card', c: 'выпал дубль на двух кубиках' }),
    raidSym: (n) => ({ pre: 'raid', v: `+${n}`, i: 'war', c: 'за каждый ваш Набег' }),
    riteTwice: () => ({ i: 'faith', c: 'обряд вашей веры — дважды за ход' }),
    candleGold: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', x: 'faith', c: 'в начале хода — за каждую вашу свечу' }),
    estateGold: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода — за каждые 2 ваших владения' }),
    dreamPeek: (n) => ({ dawn: 1, i: 'card', c: `вещий сон: посмотрите ${n} верхние карты колоды — каждую оставьте сверху или под низ` }),
    warmGold: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'весной и летом' }),
    // v10.21 — новые знамёна
    riteGold: (n) => ({ pre: 'faith', v: `+${n}`, i: 'gold', c: 'за каждый обряд вашей веры' }),
    riteExtra: () => ({ i: 'faith', c: 'обряд вашей веры — ещё раз за ход (с Титом — три раза)' }),
    peekTop: () => ({ dawn: 1, i: 'card', c: 'посмотрите верхнюю карту своей колоды двора — оставьте её сверху или положите под низ' }),
    darkGuard: (n) => ({ v: `−${n}`, i: 'int', c: 'проклятиям и козням против вас' }),
    darkSpy: (n) => ({ v: `+${n}`, i: 'int', c: 'вашим проклятиям и козням' }),
    darkWinGold: (n) => ({ v: `+${n}`, i: 'gold', c: 'проклятие легло или козни удались' }),
    loan: () => ({ v: '+3', i: 'gold', c: 'раз в ход — в долг; в начале следующего хода, до содержания, отдайте 4🪙 — сколько есть' }),
    defendGold: (n) => ({ v: `+${n}`, i: 'gold', c: 'отбили нападение или шпионаж' }),
    sinFee: (n) => ({ v: `+${n}`, i: 'gold', c: 'соперник взял грех — возьмите у него' }),
    markGold: (n) => ({ v: `+${n}`, i: 'gold', c: 'за каждую отметку вашего ритуала' }),
    schemeKeep: () => ({ i: 'card', c: 'ваши козни после розыгрыша — в ваш сброс, а не в колоду двора' }),
    cycle: () => ({ i: 'card', c: 'раз в ход: сбросьте карту из руки и возьмите новую' }),
    freePurge: () => ({ i: 'action', c: 'раз в ход снимите с себя проклятие — без действия и без золота' }),
    siegeLossFee: (n) => ({ v: `−${n}`, i: 'gold', c: 'проиграли нападение — отдайте тому, на кого нападали' }),
    sinGold: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода — за каждый ваш грех' }),
    twoRituals: () => ({ i: ['faith', 'faith'], c: 'можно вести два ритуала своей веры сразу' }),
    cleanCapture: () => ({ i: 'siege', c: 'захваченное вами владение приходит без руин' }),
    freeSin: () => ({ i: 'action', c: 'грех можно взять, не тратя действие' }),
    curseSure: () => ({ i: 'int', c: 'ваши проклятия ложатся без броска, откупиться нельзя' }),
    curseIncome: (n) => ({ dawn: 1, v: `+${n}`, i: 'gold', c: 'в начале хода — за каждое ваше проклятие у соперников' }),
    marketSwap: () => ({ i: 'card', c: 'раз в ход: карту двора из руки — в ряд рынка, взамен любую карту этого ряда — в руку' }),
    freeSiege: (n) => ({ dawn: 1, pre: 'siege', v: `+${n}`, i: 'war', c: 'в начале хода — бесплатное нападение на любого соперника; проиграли — отдайте ему 3🪙' }),
    sinTax: (n) => ({ v: `+${n}`, i: 'gold', c: 'соперник с грехом в начале своего хода платит вам' }),
    sinSafe: () => ({ i: 'faith', c: 'грехи не мешают вашим ритуалам: начинать можно, отметки не сгорают, чудеса не молчат' }),
    fairCourt: () => null,
    seasonDouble: () => ({ i: 'spring', c: 'хорошее от сезона ×2, плохое — нет' }),
  };
  const ORDER = ['provBonus_N', 'provBonus_S', 'provBonus_E', 'provBonus_W', 'dice2', 'buys', 'advantage', 'peek', 'rerollOne', 'doubleDraw', 'extraTurn', 'raidSym', 'riteTwice', 'candleGold', 'estateGold', 'dreamPeek', 'freeCourtBuy', 'freeEstateBuy', 'freeLandBuy', 'freeRaidBuy', 'craftAny', 'banIncome', 'allyAll', 'doubleGold', 'stageUp', 'oathFree', 'lootPlus', 'fetch', 'hand', 'reroll', 'predict', 'shift', 'vasCheap', 'lordCheap', 'savings', 'retireDraw', 'retireGold', 'faithGold', 'faithEase', 'faithAdoptGold', 'freeRenounce', 'twoFaiths', 'infidelTithe', 'faithTithe', 'shield', 'spyWinGold', 'freeSpy', 'plotThird', 'symIncome_trade', 'symIncome_faith', 'symFee_trade', 'symFee_faith', 'regCheap', 'symBuy', 'tradeCheap', 'blueBonus', 'greenBonus', 'winter', 'redBonus', 'raidShield', 'redOwn', 'siege', 'defense', 'walls', 'spy', 'guard', 'stealBonus',
    'warCry', 'startGold', 'tithe', 'buyToll', 'interest', 'symIncome_sci', 'symIncome_war', 'symIncome_int', 'landIncome', 'craftIncome', 'plotIncome', 'redIncome', 'unionGold', 'tribute', 'symFee_sci', 'symFee_int', 'symFee_war', 'siegeWinGold',
    'fairPlus', 'freeBasic', 'allyScholar', 'lowRollGold', 'regGold', 'oppRegGold', 'seatSlots', 'seatIncome', 'seatGold', 'seatFromDiscard', 'seatGuard', 'provIncome', 'warmGold', 'holdBonus', 'raidDraw', 'lordIncome', 'landBuyGold',
    'plotSlots', 'plotSpread', 'plotGold', 'timedPlotBonus', 'plotProtect', 'harbor', 'extraTurn', 'captureImmune', 'envyImmune', 'marketDiscount', 'landOthers', 'landOwn', 'courtCheap', 'ownCheap', 'greatCheap', 'courtToHand', 'unionSize', 'unionFast', 'unionNoSym', 'unionBounty', 'seasonDouble', 'seasonBonus', 'freeCheap', 'seatGuard'];
  // какой модуль нужен способности, чтобы она работала (остальные работают всегда)
  const MOD_NEEDS = { lootPlus: 'sieges', oathFree: 'faith', stageUp: 'faith', riteTwice: 'faith', dreamPeek: 'seats', siege: 'sieges', defense: 'sieges', walls: 'sieges', siegeWinGold: 'sieges', captureImmune: 'sieges', spyWinGold: 'spy', freeSpy: 'spy',
    faithGold: 'faith', faithEase: 'faith', faithAdoptGold: 'faith', freeRenounce: 'faith', infidelTithe: 'faith', faithTithe: 'faith', twoFaiths: 'faith', plotThird: 'plots', lordCheap: 'lords',
    spy: 'spy', guard: 'spy', stealBonus: 'spy', plotSlots: 'plots', plotGold: 'plots', plotIncome: 'plots', timedPlotBonus: 'plots', plotProtect: 'plots', plotSpread: 'plots',
    unionGold: 'unions', envyImmune: 'balance', unionSize: 'unions', unionFast: 'unions', greatCheap: 'great', unionNoSym: 'unions', unionBounty: 'unions', seatSlots: 'seats', lordIncome: 'lords', seatGuard: 'seats', seatIncome: 'seats', seatGold: 'seats', seatFromDiscard: 'seats',
    riteGold: 'faith', riteExtra: 'faith', darkGuard: 'spy', darkSpy: 'spy', darkWinGold: 'spy', defendGold: 'sieges|spy', sinFee: 'faith', markGold: 'faith', schemeKeep: 'spy', freePurge: 'spy',
    siegeLossFee: 'sieges', sinGold: 'faith', twoRituals: 'faith', cleanCapture: 'sieges', freeSin: 'faith', curseSure: 'spy', curseIncome: 'spy', freeSiege: 'sieges', sinTax: 'faith', sinSafe: 'faith' };
  // разделить способности на действующие и выключенные модулями: on(k) — включён ли модуль k
  function splitMods(m, on) {
    const act = {}, off = {}, offK = [];
    for (const k in m || {}) { const need = MOD_NEEDS[k]; if (need && on && !need.split('|').some(x => on(x))) { off[k] = m[k]; const n0 = need.split('|')[0]; if (!offK.includes(n0)) offK.push(n0); } else act[k] = m[k]; } // «sieges|spy» — хватит любого из модулей
    return { act, off, offK };
  }
  function mods(m, prod) {
    const out = [];
    const ps = SYMS.filter(s => prod && prod[s]);
    if (ps.length === 1) out.push({ v: `+${prod[ps[0]]}`, i: ps[0], c: 'постоянно' });
    else if (ps.length > 1) out.push({ v: '+', i: ps.flatMap(s => Array(prod[s]).fill(s)), c: 'постоянно' });
    const keys = Object.keys(m || {}).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    for (const k of keys) { if (!m[k]) continue; const x = MOD[k] ? MOD[k](m[k], m) : k in MOD ? null : { c: k }; if (x) out.push(x); }
    return out;
  }
  // титулы и союзы провинций — те же числа, что в движке (Engine.mods / prod / walls / startOfTurn)
  const TITLE_MODS = { treasurer: { startGold: 1 }, magister: { shift: 1 }, marshal: { redBonus: 1 }, whisperer: { hand: 1 }, landlord: { blueBonus: 1 }, unifier: { regCheap: 1 }, courtier: { courtCheap: 1 }, seigneur: { reroll: 1 } };
  const TITLE_WHAT = { treasurer: ['Ремёсел', null], magister: ['', 'sci'], marshal: ['', 'war'], whisperer: ['', 'int'], landlord: ['Земель', null], unifier: ['союзов', null], courtier: ['придворных', null], seigneur: ['владений', null] };
  const UNION = { N: [{ v: '+2', i: 'war' }], S: [{ v: '+2', i: 'trade' }], E: [{ v: '+2', i: 'sci' }], W: [{ v: '+2', i: 'int' }] };
  // свойство титула — из данных игры; TITLE_MODS — запас на случай, если в данных его нет
  const title = () => [];
  const union = (p) => { const R = (typeof DATA !== 'undefined' ? DATA : require('./data.js')).RULES; return UNION[p].map(x => Object.assign({}, x)).concat([{ v: `+${R.unionGold}`, i: 'gold', c: `сразу за каждый союз; первому за столом ещё +${R.unionFirst}🪙` }]); };

  // ---------- HTML ----------
  const esc = (s) => String(s == null ? '' : s).replace(/&(?!#?\w+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // p — приставка к классам (печатные карты: 'pc-'), чтобы стили карт не пересекались со стилями интерфейса
  function chip(x, ico, p = '') {
    const icons = (Array.isArray(x.i) ? x.i : x.i ? [x.i] : []).map(k => ico(k)).join('');
    const m = `${x.dawn ? `<span class="${p}fx-dawn">${ico('dawn')}</span>` : ''}${x.pre ? ico(x.pre) : ''}${x.v ? `<b>${esc(x.v)}</b>` : ''}${icons}${x.x ? `<i>×</i>${ico(x.x)}` : ''}`;
    return `<span class="${p}fx${x.big ? ` ${p}big` : ''}${m ? '' : ` ${p}txt`}">${m ? `<span class="${p}fx-m">${m}</span>` : ''}${x.c ? `<span class="${p}fx-c">${esc(x.c)}</span>` : ''}</span>`;
  }
  const chips = (list, ico, p = '') => `<span class="${p}fxs">${(list || []).map(x => chip(x, ico, p)).join('')}</span>`;
  function trig(t, ico, opts = {}) {
    const p = opts.p || '';
    if (t.who === 'none') return `<span class="${p}trig ${p}none">${esc(t.label)}</span>`;
    return `<span class="${p}trig ${p}${t.who}">${ico('dice')}${opts.nums ? `<b>${numText(t.nums)}</b>` : ''}<span>${esc(t.label)}</span></span>`;
  }
  return { estate, court, fx, mods, splitMods, MOD_NEEDS, title, union, chips, chip, trig, numText, TITLE_MODS, TITLE_WHAT };
});
