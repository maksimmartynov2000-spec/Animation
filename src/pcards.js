// Печатные карты «Претендентов»: одна разметка и одни стили для печати и для браузерной игры.
// Все размеры — в единицах --u (1 мм карты). Печать: --u = 1mm. Игра: обёртка .pcw.web — контейнер,
// --u = её ширина / 63.5, так что карта целиком масштабируется под ячейку сетки.
//   PCards.setup({ src: k => url значка, art: (kind, id) => url рисунка })   — в браузере обязательно
//   PCards.estate(id, o) · court(id, o) · house(h, o) · vassal(id, o) · lord(id, o) · season(id, o) · title(id, o) · prov(id, o)
//     o.bleed — печать с вылетами; o.start — стартовая копия Дома (герб внизу); o.mod(k) — включён ли модуль (игра);
//     o.allyOn — свита сработает (подсветка блока); o.seatOn — карта сидит при дворе (подсветка блока «При дворе»)
//   PCards.wrap(kind, html, attrs) — обёртка с нужной областью стилей; PCards.back(kind, o) — рубашка (SVG)
//   PCards.CSS — стили (в --u); PCards.BACKS — виды рубашек
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./data.js'), require('./cardfx.js'), require('./symicons.js'));
  else root.PCards = factory(typeof DATA !== 'undefined' ? DATA : root.DATA, root.CardFX, root.SymIcons);
})(typeof self !== 'undefined' ? self : this, function (D, FX, SYM) {
  const CFG = { src: null, art: () => '' };
  const setup = (o) => Object.assign(CFG, o);
  const io = (x) => Object.assign(CFG.src ? { src: CFG.src } : {}, x || {});
  const ico = (k, x) => SYM.img(k, io(x));
  const coin = (s = 1) => ico('gold', { em: s });
  const iconize = (h) => SYM.iconizeHTML(h, io());
  const u = (n) => `calc(var(--u) * ${n})`;
  const P = 'pc-';
  const chips = (list) => FX.chips(list, ico, P);
  const on = (o, k) => !o || !o.mod || o.mod(k);

  // ---------- цвета ----------
  const TYPE = {
    land: { c: '#2b5ca3', dark: '#1d3f72', label: 'Земля' },
    craft: { c: '#2a7547', dark: '#1c5131', label: 'Ремесло' },
    raid: { c: '#ab3434', dark: '#7a2222', label: 'Набег' },
    hold: { c: '#683c88', dark: '#48295f', label: 'Твердыня' },
    wall: { c: '#5d6470', dark: '#3e434c', label: 'Укрепление' },
    bad: { c: '#3b3436', dark: '#221d1e', label: 'Проклятие' },
  };
  const ROLE = {
    merchant: { c: '#a8781c', dark: '#6e4d0c', label: 'Купец', icon: '⚖️' },
    scholar: { c: '#2b5ca3', dark: '#1d3f72', label: 'Учёный', icon: '📜' },
    knight: { c: '#ab3434', dark: '#7a2222', label: 'Рыцарь', icon: '⚔️' },
    spy: { c: '#683c88', dark: '#48295f', label: 'Шпион', icon: '🔗' },
    priest: { c: '#1f7a74', dark: '#134f4b', label: 'Жрец', icon: '🕯' },
    none: { c: '#7a5e40', dark: '#523e29', label: 'Без роли', icon: 'none' },
  };
  const ROLE_ICO = { merchant: 'trade', scholar: 'sci', knight: 'war', spy: 'int', priest: 'faith' };
  // направления знамён: цвет полосы; ярусы: металл рамки
  const DIRC = { trade: ['#a8781c', '#6e4d0c'], sci: ['#2b5ca3', '#1d3f72'], war: ['#ab3434', '#7a2222'], int: ['#683c88', '#48295f'], faith: ['#1f7a74', '#134f4b'] };
  const TIERM = { v: { name: 'Вассал', metal: '#b07a43', icon: '🚩' }, l: { name: 'Лорд', metal: '#c8ccd4', icon: '👑' }, g: { name: 'Великий лорд', metal: '#e8c45a', icon: '🧭' } };
  const FAITHC = { grain: ['#b8902a', '#6e5414'], star: ['#3e5fa8', '#22346b'], flame: ['#b5462a', '#6e2412'], shade: ['#4a3f63', '#271f38'],
    bounty: ['#c49a3a', '#7a5a14'], seer: ['#4f7cc0', '#284780'], blade: ['#c0603e', '#7a3018'], circle: ['#6d5a8f', '#3a2c55'],
    cathedral: ['#2f8c84', '#165550'], ash: ['#5f6a72', '#30383e'], harvest: ['#5f9a5a', '#2f5a2c'], mercy: ['#6aa6a0', '#2f5f5a'] };
  const HOUSE = { deer: ['#4f6b3a', '#2f4422'], owl: ['#b8862a', '#6e4d0c'], wolf: ['#7d2a2a', '#4a1515'], rose: ['#6a3d63', '#3d1f3a'], serpent: ['#2f7f7a', '#17504c'], moon: ['#33406e', '#1f2747'], bear: ['#7a5230', '#4b2e16'], lion: ['#b06a1c', '#6e3c0c'], eagle: ['#56606e', '#343b46'], sun: ['#2f78a6', '#1a4c6e'] };
  const GREAT = ['#b8902a', '#6e5414'], FOREIGN = ['#2f8a80', '#16504a'];
  const RULEC = { envy: ['#8f3a33', '#5a1d19'], support: ['#3f7a4e', '#234a2e'], alms: ['#1f7a74', '#134f4b'], lore: ['#2b5ca3', '#1d3f72'], trade: ['#a8781c', '#6e4d0c'] };
  const PROVC = { N: ['#5e7690', '#3e5266'], S: ['#c99a2a', '#8a6218'], E: ['#5f4f99', '#3b2f66'], W: ['#4f6b3a', '#2f4422'] };
  // карта модуля — того же цвета, что карты, которые она добавляет
  const MODC = { lords: GREAT, great: FOREIGN, faith: ['#1f7a74', '#134f4b'], plots: ['#4f5fa8', '#2a3166'], balance: ['#6e5a8a', '#3f3152'], unions: PROVC.N,
    sieges: ['#ab3434', '#7a2222'], spy: ['#683c88', '#48295f'], seats: ['#8a2f55', '#5a1a37'], sets: ['#7a5e40', '#523e29'],
    conflict: ['#ab3434', '#7a2222'], court: ['#8a2f55', '#5a1a37'] };
  const MOD_CARDS = ['sets', ...(D.MODULE_PICK || D.MODULE_KEYS)]; // лорды — в основе, «Баланс» убран
  const PROV = { N: 'Север', S: 'Юг', E: 'Восток', W: 'Запад' };
  // плотные карты: мелкий текст эффектов ужат, чтобы влезло с запасом 3% (считает cards/fit.js)
  const FIT = {"e:shrine":0.86,"e:citadel":10.99,"e:harvesttemple":0.86,"e:granary":0.89,"e:runestone":0.86,"e:chancery":11,"e:port":0.86,"e:thieves":0.89,"e:embassy":0.89,"e:falsetax":10.82,"e:blight":10.82,"e:plaguehouse":10.95,"e:banditpost":10.82,"e:ashes":10.82,"c:sappers":0.88,"c:siegeband":11,"c:blackmailer":10.97,"c:ram":0.88,"c:recruiter":11,"c:dreamer":0.91,"c:astrologer":0.99,"c:chronicler":10.9,"c:augur":0.99,"c:huntsman":0.97,"c:cupbearer":0.93,"c:bearhoard":0.98,"h:deer":11,"h:owl":11,"h:wolf":0.91,"h:serpent":10.85,"h:bear":11,"h:lion":11,"b:martin":11,"b:anselm":0.91,"b:alberich":11,"b:albin":0.9,"b:theodor":11,"b:gottfried":10.85,"b:bertrand":0.9,"b:robert":0.9,"b:hagen":11,"b:maurice":0.9,"b:isolde":11,"b:guillaume":0.9,"b:rowena":11,"b:irmina":0.9,"b:bruno":11,"b:warden":0.9,"b:gregory":11,"b:sebastian":11,"b:heir_deer":0.9,"b:heir_owl":0.91,"b:heir_wolf":11,"b:heir_serpent":0.9,"b:heir_bear":11,"b:heir_lion":11,"b:aldo":10.99,"b:edward":10.93,"b:otto":10.99,"b:oberon":0.95,"f:grain":10.84,"f:harvest":10.84,"f:seer":10.8,"f:star":10.8,"f:flame":10.96,"f:blade":10.8,"f:shade":10.84,"f:cathedral":10.87,"p:N":10.94,"p:S":10.86,"p:E":10.94,"p:W":10.9,"m:sets":0.89,"m:faith":0.85,"m:conflict":10.88,"m:court":0.84,"e:evileye":10.82,"e:cursedrelic":10.82,"e:schemer":10.82};
  // FIT[key]: k — ужать текст эффектов; k + 10 — плотная карта: рисунок ниже, текст ужат на k
  const fitK = (key) => { const v = FIT[key]; return v ? (v >= 10 ? +(v - 10).toFixed(2) : v) : 0; };
  const fit = (key) => (fitK(key) ? ` style="--k:${fitK(key)}"` : '');
  const dz = (key) => (FIT[key] >= 10 ? ' pc-dense' : '');

  const mtagOf = (need) => { if (!need) return ''; const ks = [...new Set(String(need).split(/[|&]/).filter(k => D.MODULES[k]).map(k => D.MODULES[k].member || k))]; if (!ks.length) return ''; return `<span class="pc-mtag">${ks.map(k => `${D.MODULES[k].icon} ${D.MODULES[k].short}`).join(String(need).includes('&') ? ' + ' : ' / ')}</span>`; };
  // v10.13: у карт основы — такая же плашка, как у модулей: «🏰 Основа» (раньше — «×2 в колоде», «вассал», «дом»)
  const BASE_TAG = '<span class="pc-mtag pc-base">🏰 Основа</span>';
  // плашка внизу: герб Дома + «Старт · Олени» — копия из набора Дома, не из колоды рынка
  const startTag = (h, word = 'Старт') => `<span class="pc-stag" style="--hc:${HOUSE[h][1]}">${D.HOUSES[h].sigil} ${word ? `${word} · ` : ''}${D.HOUSES[h].short}</span>`;
  const houseOfSig = (id) => Object.keys(D.HOUSES).find(h => D.HOUSES[h].deck.includes(id) || D.HOUSES[h].courtier === id || D.HOUSES[h].courtier2 === id);
  const root = (cls, c, dark, o, inner) => `<div class="pcard ${cls}${o && o.bleed ? ' pc-bleed' : ''}" style="--c:${c};--cd:${dark}"><div class="pc-panel">${inner}</div></div>`;

  // ---------- владение: тип · когда срабатывает → что даёт → что постоянно ----------
  function estate(id, o = {}) {
    const d = D.ESTATES[id];
    const T = TYPE[d.t];
    const f = FX.estate(d);
    if (!on(o, 'sieges')) f.perm = f.perm.filter(x => x.i !== 'wall'); // без осад стены ничего не дают
    const num = d.n.length ? D.numText(d.n) : '';
    const fsz = num.length <= 3 ? 5.2 : num.length === 4 ? 4.6 : 4.0; // «11–12» должно влезть в щит
    const shield = num ? `<div class="pc-shield${num.length >= 4 ? ' pc-wide' : ''}"><span style="font-size:${u(fsz)}">${num}</span></div>` : `<div class="pc-shield"><span class="pc-sic">${ico(d.t === 'bad' ? 'none' : 'wall')}</span></div>`;
    const prov = d.p ? `<span class="pc-pv">·</span>${ico('prov' + d.p)}${PROV[d.p]}` : ''; // провинция: для «пар» и карт «за каждое владение провинции»
    const onBuy = f.perm.filter(x => x.buy), keep = f.perm.filter(x => !x.buy);
    const perm = (keep.length ? `<div class="pc-perm"><span class="pc-lbl">Постоянно</span>${chips(keep)}</div>` : '') + (onBuy.length ? `<div class="pc-perm"><span class="pc-lbl">При покупке</span>${chips(onBuy)}</div>` : '')
      + (d.t === 'bad' ? `<div class="pc-perm"><span class="pc-lbl">Снять</span>${chips([{ v: `${D.RULES.purgeCost || 2}`, i: 'gold', c: 'и действие в свой ход — карта уходит в колоду владений' }])}</div>` : ''); // как снять проклятие
    const need = D.NEEDS.estate[id];
    const copies = d.basic ? `всего ×${(D.RULES.basicStock || {})[id] || '∞'}` : d.t === 'hold' ? `×${d.copies || 4} · по 1 на игрока` : `×${d.copies || 3}`;
    const left = o.start ? startTag(o.start) : d.house ? startTag(d.house) : `<span class="pc-fl">${need ? mtagOf(need) : BASE_TAG}<span class="pc-basic">${copies}</span></span>`;
    return iconize(root('pc-est' + dz('e:' + id), T.c, T.dark, o, `
      <div class="pc-art"><img src="${CFG.art('e', id)}" alt="">${shield}</div>
      <div class="pc-name">${d.name}</div>
      <div class="pc-type">${d.t === 'bad' ? '' : ico(d.t === 'wall' ? 'wall' : d.t)}${T.label}${prov}</div>
      <div class="pc-eff"${fit('e:' + id)}>${FX.trig(f.trig, ico, { p: P })}${chips(f.main)}${f.note ? `<div class="pc-stn">${f.note}</div>` : ''}${perm}</div>
      <div class="pc-foot">${left}<span class="pc-cost">${d.cost}${coin(1)}</span></div>`));
  }

  // ---------- карта двора: что даёт сразу → свита → замысел ----------
  function court(id, o = {}) {
    const c = D.COURT[id];
    const R = c.scheme ? { c: TYPE.bad.c, dark: TYPE.bad.dark, label: 'Козни', icon: 'none' } : ROLE[c.role || 'none']; // козни — тёмная рамка, как у проклятий
    const f = FX.court(c);
    if (!on(o, 'plots')) f.plot = null; // без замыслов карту можно только сыграть
    const icon = R.icon === 'coin' ? coin(1.05) : R.icon === 'none' ? ico('none', { em: 1.05 }) : `<span class="pc-emo">${R.icon}</span>`;
    const pnT = Array.isArray(c.pn) ? c.pn.join('·') : c.pn;
    const tag = c.plot && f.plot ? `<div class="pc-corner">${c.plot === 'dice' ? `${ico('dice')}${pnT}` : `${ico('plot')}замысел`}</div>` : '';
    const has = (k) => (c.fx || []).some(op => op[0] === k);
    const atk = has('siege') ? 'захват' : has('raze') ? 'разрушение' : has('spy') ? 'шпионаж' : null;
    const type = (c.scheme ? 'Козни' : c.start ? 'Стартовая · без роли' : c.sig ? `Фамильная · ${R.label}` : c.faith ? `${R.label} · ${D.FAITHS[c.faith].name}` : R.label) + (atk ? `<span class="pc-atk">Нападение: ${atk}</span>` : '');
    const play = f.play.length === 1 && f.play[0].i === 'gold' ? [Object.assign({}, f.play[0], { big: true })] : f.play;
    const blocks = [];
    // блок: метка слева, справа — условие словами (мелко) и что даёт
    const bx = (cond, body) => `<span class="pc-bx">${cond ? `<span class="pc-cond">${cond}</span>` : ''}${body}</span>`;
    if (f.ally) blocks.push(`<div class="pc-blk${o.allyOn ? ' pc-on' : ''}"><span class="pc-lbl">Свита<br>${c.allyBy ? `«${D.COURT[c.allyBy].name}»` : ico(ROLE_ICO[c.role])}</span>${bx('', chips(f.ally))}</div>`);
    if (f.seat && on(o, 'seats')) blocks.push(`<div class="pc-blk pc-seat${o.seatOn ? ' pc-on' : ''}"><span class="pc-lbl">При дворе<br>${ico('seat')}</span>${bx('', chips(f.seat))}</div>`);
    if (f.plot) blocks.push(`<div class="pc-blk"><span class="pc-lbl">${f.plot.kind === 'dice' ? `Замысел<br>${ico('dice')} <b>${pnT}</b>` : `Замысел<br>${ico('plot')}`}</span>${bx('', chips(f.plot.chips))}</div>`);
    if (c.faith && c.ffx && on(o, 'faith')) blocks.push(`<div class="pc-blk pc-faith${o.faithOn ? ' pc-on' : ''}"><span class="pc-lbl">Ваша вера —<br>${D.FAITHS[c.faith].name}</span>${bx('', chips(FX.fx(c.ffx)))}</div>`);
    const sigH = c.sig && houseOfSig(id);
    const spyRole = c.role === 'spy' && D.RULES.spyBuyoff && on(o, 'spy') && (c.fx || []).some(op => op[0] === 'spy');
    const mtag = mtagOf(D.NEEDS.court[id] || (sigH && D.NEEDS.house[sigH]));
    // низ: сколько копий — на каждой карте; у карт модулей рядом значок модуля; у карт веры — одинаковая подпись
    const left = c.faith ? `<span class="pc-basic">карта веры · ×${c.copies || 1}</span>` : o.start ? startTag(o.start) : sigH ? startTag(sigH, '') : c.start ? `<span class="pc-basic">×${D.RULES.startTax} у каждого</span>` : `<span class="pc-fl">${mtag || BASE_TAG}<span class="pc-basic">×${c.copies || 2}</span></span>`;
    const right = c.faith ? mtag || '<span></span>' : sigH && mtag ? mtag : c.start || c.sig ? '<span></span>' : `<span class="pc-cost">${c.cost}${coin(1)}</span>`;
    return iconize(root('pc-crt' + dz('c:' + id), R.c, R.dark, o, `
      <div class="pc-art"><img src="${CFG.art(c.sig ? 'f' : 'c', id)}" alt=""><div class="pc-shield"><span>${icon}</span></div>${tag}</div>
      <div class="pc-name">${c.name}</div>
      <div class="pc-type">${type}</div>
      <div class="pc-eff"${fit('c:' + id)}>${chips(play) + (c.scheme ? '<div class="pc-stn">сыграли — карта уходит в колоду двора</div>' : '') + (spyRole ? `<div class="pc-stn">откуп: ${D.RULES.spyBuyoff}🪙 × разница 🔗</div>` : '') + blocks.join('')}</div>
      <div class="pc-foot">${left}${right}</div>`));
  }

  // ---------- Дома, вассалы, лорды, сезоны, титулы, провинции — общий шаблон ----------
  const reqHtml = (req) => {
    if (req && req.unions) return `<span class="pc-req"><span class="pc-k">Нужно</span>${req.unions} союза провинций</span>`;
    const icons = ['sci', 'war', 'int'].flatMap(s => Array((req && req[s]) || 0).fill(s)).map(k => ico(k)).join('');
    return `<span class="pc-req"><span class="pc-k">Нужно</span>${icons || 'без условий'}</span>`;
  };
  // сверху — только условие «союзы»; значки показываются внизу рядом с ценой
  const topReq = (req) => (req && req.unions ? reqHtml(req) : '');
  const reqIcons = (req) => ['sci', 'war', 'int'].flatMap(s => Array((req && req[s]) || 0).fill(s)).map(k => ico(k)).join('');
  // два модуля: значки обоих, подпись — только второго (первый ясен из типа карты)
  const mtag = (...ks) => { ks = [...new Set(ks.filter(Boolean).map(k => (D.MODULES[k] && D.MODULES[k].member) || k))]; return ks.length ? `<span class="pc-mtag">${ks.map(k => D.MODULES[k].icon).join('')} ${D.MODULES[ks[ks.length - 1]].short}</span>` : null; };
  const est = (id) => D.ESTATES[id];
  // свойства, которым нужен выключенный модуль, в игре видны бледно
  function modChips(m, prod, o) {
    if (!o || !o.mod) return chips(FX.mods(m, prod));
    const sp = FX.splitMods(m, o.mod);
    return chips(FX.mods(sp.act, prod)) + (sp.offK.length ? `<div class="pc-offs">${chips(FX.mods(sp.off))}</div>` : '');
  }
  const startDeck = (H) => {
    const n = {}; for (const id of H.deck) n[id] = (n[id] || 0) + 1;
    return Object.keys(n).map(id => D.COURT[id].sig ? `«${D.COURT[id].name}»` : `${D.COURT[id].name}${n[id] > 1 ? ` ×${n[id]}` : ''}`).join(', ');
  };
  function spec(kind, id, o) {
    if (kind === 'house') {
      const H = D.HOUSES[id];
      const extra = [on(o, 'faith') ? `<b>Вера:</b> ${H.dir === 'faith' ? 'любая' : D.SYM[H.dir]} — на 1🕯 проще` : ''].filter(Boolean).join(' · ');
      return { key: `h_${id}`, c: HOUSE[id], icon: H.sigil, name: H.name, type: `Дом · ${H.path}`, fx: (o && o.mod) ? chips([{ v: '+1', i: H.dir, c: 'родной значок' }]) + modChips(H.mods, null, o) : chips([{ v: '+1', i: H.dir, c: 'родной значок' }, ...FX.mods(H.mods, null)]),
        post: `${extra}<br><b>Старт:</b> ${D.RULES.startGold + (H.gold || 0)}🪙; ${H.estates.map(e => `${D.ETYPE[est(e).t].mark} ${est(e).name}`).join(', ')}.<br><b>Колода:</b> Подать ×${D.RULES.startTax}, ${startDeck(H)}`, left: mtag(D.NEEDS.house[id]) || BASE_TAG };
    }
    if (kind === 'ban') {
      const b = D.BAN[id], T = TIERM[b.tier];
      const pr = Object.assign({}, b.prod); pr[b.dir] = (pr[b.dir] || 0) + 1;
      // условия найма — одной строкой: награда, содержание, надбавка (пояснения — в памятке и правилах)
      // условия найма — строками: скидка за значки, награда, содержание, надбавка
      const TW = { v: 'вассалы', l: 'лорды', g: 'великие лорды' };
      const line = (k, t) => `<div class="pc-tline"><b>${k}</b> ${t}</div>`;
      const takeTxt = b.take ? b.take.map(op => op[0] === 'gold' ? `+${op[1]}🪙` : op[0] === 'draw' ? `возьмите ${D.cards(op[1])}` : op[0] === 'unseat' ? 'опала — прогоните одного придворного соперника в его сброс' : D.fxLine(op)).join(', ') : '';
      const terms = [
        b.take ? line('При найме', takeTxt) : '',
        b.upkeep ? line('Содержание', `в начале вашего хода −${b.upkeep}🪙`) : '',
        ...(b.tax ? ['v', 'l', 'g'].filter(t => b.tax[t]).map(t => line('Надбавка', `пока он у вас, ваши следующие ${TW[t]} дороже на ${b.tax[t]}🪙`)) : []),
      ].filter(Boolean);
      const take = terms.length ? `<div class="pc-terms2">${terms.join('')}</div>` : '', upk = '', tax = '';
      const seat = b.tier === 'l' && on(o, 'seats') ? chips([{ v: '+1', i: 'seat', c: 'место при дворе' }]) : '';
      const need = D.NEEDS.ban[id];
      const left = b.heir ? startTag(b.heir, 'Наследник') : mtag(b.tier === 'l' ? 'lords' : b.tier === 'g' ? 'great' : null, need && !need.includes('|') && !need.includes('&') ? need : null) || BASE_TAG;
      return { key: `b_${id}`, c: DIRC[b.dir], icon: D.SYM[b.dir], tier: b.tier, tag: T.icon, name: b.name, type: `${T.name} · ${b.title}`.length > 30 ? b.title : `${T.name} · ${b.title}`, fx: modChips(b.mods, pr, o) + seat + take + upk + tax, left, cost: b.cost };
    }
    if (kind === 'faith') {
      const F = D.FAITHS[id], R = D.RULES;
      const cost = F.dir ? `${D.SYM.faith.repeat(R.faithNeed)}${D.SYM[F.dir].repeat(R.faithDir)}` : D.SYM.faith.repeat(R.faithPure);
      const req = `<div class="pc-fr"><b>Принять:</b> ${cost}</div>`;
      const st = (n, t) => t ? `<div class="pc-stage"><span class="pc-lbl">${n}</span><span class="pc-st-t">${t}</span></div>` : '';
      const rc = D.riteCostText(F.rite.cost);
      const riteB = `<div class="pc-take pc-rite"><span class="pc-lbl">Обряд<br>раз в ход</span><span class="pc-fxs"><span class="pc-fx pc-txt"><span class="pc-fx-c"><b>${F.rite.name}.</b> ${rc ? rc + ' → ' : ''}${D.fxText(F.rite.fx).replace(/^./, (x) => (rc ? x.toLowerCase() : x))}</span></span></span></div>`;
      const oath = `<div class="pc-take pc-ban"><span class="pc-lbl">Обет<br>пока в вере</span><span class="pc-fxs"><span class="pc-fx pc-txt"><span class="pc-fx-c">${F.oathText}</span></span></span></div>`;
      return { key: `r_${id}`, c: FAITHC[id], icon: F.icon, name: F.name, type: `Вера · ${F.dir ? D.DIRS[F.dir].name : 'чистая'}`, pre: req,
        fx: `<div class="pc-stages">${st('I', F.text)}${st(`II 🕯${R.faithStage2}`, F.text2)}${st(`III 🕯${R.faithStage3}`, F.text3)}<div class="pc-stn">Первому принявшему — 2 карты веры в сброс. ${F.truce === false ? 'Единоверцы могут нападать друг на друга.' : 'Единоверцы друг на друга не нападают.'}</div></div>` + riteB + oath, left: mtag('faith') };
    }
    if (kind === 'rule') {
      const R = D.RULES;
      // карты значков — по три у каждого игрока: что даёт значок и лесенка «сколько значков — сколько пользы»
      const lad = (cells) => `<div class="pc-lad">${cells.map(([a, b]) => `<span><i>${a}</i><em>${b}</em></span>`).join('')}</div>`;
      const steps = (st, n = 4) => Array.from({ length: n }, (_, k) => st * (k + 1));
      if (id === 'alms') return { key: `r_${id}`, c: RULEC.alms, icon: '🕯', name: 'Подаяния', type: 'Значок · у каждого игрока',
        fx: chips([{ dawn: 1, v: '+1', i: 'gold', big: 1, c: `в начале хода за каждые ${R.faithStep}🕯` }]) + lad(steps(R.faithStep).map(n => [`🕯${n}`, `+${n / R.faithStep}🪙`])),
        post: 'Считайте 🕯 на всех своих картах. Значки не тратятся.', left: '' };
      if (id === 'lore') return { key: `r_${id}`, c: RULEC.lore, icon: '📜', name: 'Знания', type: 'Значок · у каждого игрока',
        fx: chips([{ v: '+1', i: 'card', big: 1, c: `карта в руку за каждые ${R.sciStep}📜` }]) + lad([[`📜0`, `${R.hand} ${D.plural(R.hand, 'карта', 'карты', 'карт')}`], ...steps(R.sciStep, 3).map(n => { const k = R.hand + n / R.sciStep; return [`📜${n}`, `${k} ${D.plural(k, 'карта', 'карты', 'карт')}`]; })]),
        post: 'Столько карт добираете в руку в конце хода. Значки не тратятся.', left: '' };
      if (id === 'trade') return { key: `r_${id}`, c: RULEC.trade, icon: '⚖️', name: 'Торг', type: 'Значок · у каждого игрока',
        fx: chips([{ v: '−1', i: 'gold', big: 1, c: `всё на рынке — за каждые ${R.tradeStep}⚖️` }]) + lad(steps(R.tradeStep).map(n => [`⚖️${n}`, `−${n / R.tradeStep}🪙`])),
        post: 'Владения, твердыни, двор — не дешевле 1🪙. Значки не тратятся.', left: '' };
      if (id === 'envy') return { key: `r_${id}`, c: RULEC.envy, icon: '🫱', name: 'Зависть', type: 'Общий стол', fx: chips([{ dawn: 1, v: '−1', i: 'gold', c: 'за каждое знамя отрыва — платит единственный лидер' }]), post: 'В начале своего хода единственный лидер по знамёнам платит в банк 1🪙 за каждое знамя отрыва от второго игрока. Двое лидеров — не платит никто.', left: mtag('balance') };
      return { key: `r_${id}`, c: RULEC.support, icon: '🫱', name: 'Народная поддержка', type: 'Общий стол', fx: chips([{ dawn: 1, v: `+${R.supportGold}`, i: 'gold', c: `отстаёте от лидера на ${R.supportGap}🚩 и больше` }]), post: `В начале своего хода тот, кто отстаёт от лидера по знамёнам на ${R.supportGap} и больше, берёт из банка ${R.supportGold}🪙.`, left: mtag('balance') };
    }
    if (kind === 'module') {
      const R = D.RULES, q = (s) => `«${s}»`, N = D.NEEDS;
      const row = (k, t) => `<p><span class="pc-mk">${k}</span>${t}</p>`;
      if (id === 'sets') {
        const P = D.PRESETS, goal = (ks) => R.needV + (ks.includes('lords') ? R.needL : 0) + (ks.includes('great') ? R.needG : 0);
        return { key: 'm_sets', c: MODC.sets, icon: '🎲', name: 'Длина партии', type: 'Как собрать партию', fx: `<div class="pc-mod">
          ${row('Короткая', `Только вассалы. Цель — ${R.needV} вассалов.`)}
          ${row('Средняя', `+ лорды (содержание ${R.lordUpkeep}🪙). Цель — ${R.needV} вассалов и ${R.needL} лорда.`)}
          ${row('Длинная', `+ великие лорды. Цель — ещё ${R.needG} великих лорда.`)}
          <p>Модули «Вера», «Вражда», «Двор» — с любой длиной: добавьте карты с их меткой.</p></div>`, left: 'памятка' };
      }
      const M = D.MODULES[id];
      const mem = D.modMembers ? D.modMembers(id) : [id];
      const ids = (g) => Object.keys(N[g] || {}).filter(x => String(N[g][x]).split(/[|&]/).some(y => mem.includes(y)));
      const hs = ids('house').map(h => D.HOUSES[h].name), ct = ids('court').filter(x => !D.COURT[x].sig).map(x => q(D.COURT[x].name)), hl = ids('estate').filter(x => D.ESTATES[x].t === 'hold'), es = ids('estate').filter(x => D.ESTATES[x].t !== 'hold').map(x => q(D.ESTATES[x].name)).concat(hl.length ? [`ряд 🟪 Твердынь (${hl.length} видов${id === 'sieges' || id === 'spy' ? ', общие для «Осад» и «Шпионажа»' : ''})`] : []);
      const nT = (t) => Object.keys(D.BAN).filter(b => D.BAN[b].tier === t && !D.BAN[b].heir).length;
      const OWN = { lords: `колоду лордов (${nT('l')}), в ряду открыто ${R.lRow}; Наследников Домов`, great: `колоду великих лордов (${nT('g')}), в ряду открыто ${R.gRow}`, faith: `${Object.keys(D.FAITHS).length} карт вер, в партии ${R.faithInGame} — по одной каждого направления; по 3 карты каждой веры (лежат у веры)`,
        balance: 'карты «Зависть» и «Народная поддержка»', unions: `${Object.keys(D.PROV).length} карты провинций`,
        seats: `${ids('court').filter(x => !D.COURT[x].sig).length} видов карт двора с меткой ${M.icon}, по 2 фамильных придворных на Дом`,
        court: `${ids('court').filter(x => !D.COURT[x].sig && !D.COURT[x].fam).length} видов карт двора с меткой ${M.icon}, по фамильному придворному на Дом` };
      const tagged = ids('ban').length ? `знамёна с меткой ${M.icon}` : '';
      const ctl = id === 'seats' || id === 'court' ? [] : id === 'faith' ? ids('court').filter(x => !D.COURT[x].faith).map(x => `«${D.COURT[x].name}»`) : ct.length > 6 ? [`${ct.length} карт двора с меткой ${M.icon}`] : ct;
      const add = [OWN[id], ...hs, ...ctl, ...es, tagged].filter(Boolean);
      const RULE = {
        conflict: `Нападение — по ⚔️, шпионаж — по 🔗: ваш значок + число на карте + 🎲 против того же значка соперника + его 🧱 Стен + 🎲. Больше — удача, поровну — он устоял. От замка у каждого 🧱${R.baseWalls}, от шпиона — 🧱${Math.floor(R.baseWalls * (R.spyCastle == null ? 1 : R.spyCastle))}. Проклятия подбрасывают шпионажем. 🟪 Твердыни — отдельным рядом из ${R.holdRow}.`,
        court: `Карту двора можно не сыграть, а отложить <b>замыслом</b> (мест ${R.plotSlots}): ⏳ сработает в начале вашего хода, 🎲 — когда выпадет её число. Или <b>посадить ко двору</b> (мест ${R.courtSeats} + 1 за лорда): пока сидит — свойство действует. Фамильный придворный сидит с начала.`,
        lords: `Для победы нужно ещё ${R.needL} лорда. Нанимают их действием, как вассалов; скидка за значки — до ${R.discCap.l}🪙. Каждый лорд даёт ещё место при дворе.`,
        great: `Для победы нужно ещё ${R.needG} великих лорда. Каждый сразу даёт награду, но в начале каждого вашего хода — содержание; нечем платить — уходит под низ колоды. <b>Второе действие:</b> раз в ход можно заплатить ${R.extraAction}🪙 и сделать ещё одно действие.`,
        faith: `Хватает значков с карты веры — примите её в свой ход, бесплатно; вера у вас одна. Принявший первым кладёт в сброс 3 её карты. Ступени II и III — при 🕯${R.faithStage2} и 🕯${R.faithStage3}; обряд — раз в ход; обет — пока вы в вере. Отречься — ${R.renounceCost}🪙.`,
        plots: `Карту с ⏳ или 🎲 можно не сыграть, а положить замыслом. ⏳ сработает в начале вашего следующего хода, 🎲 — когда в любой ход выпадет одно из двух её чисел; потом карта — в сброс. Мест для замыслов — ${R.plotSlots}.`,
        balance: `Единственный лидер по знамёнам в начале своего хода платит 1🪙 за каждое знамя отрыва. Кто отстаёт на ${R.supportGap} знамени и больше, берёт ${R.supportGold}🪙.`,
        unions: `Каждые 3 владения одной провинции — союз: 2 значка провинции и сразу +${R.unionGold}🪙; первому союзу этой провинции за столом — ещё +${R.unionFirst}🪙. Союзы копятся.`,
        sieges: `Число на карте нападения прибавьте к своим ⚔️; у соперника — его ⚔️ и 🧱. Каждый бросает 🎲: больше — победа, поровну — он отбился. Захват — владение до ${R.siegeLoot}🪙 ваше, в руинах; разрушение — из игры. От замка у каждого ${R.baseWalls}🧱.`,
        spy: `Число на карте шпиона прибавьте к своим 🔗; у соперника — его 🔗 и 🧱. Каждый бросает 🎲: больше — удача. Так же подбрасывают проклятия и строят козни.`,
        seats: `Мест при дворе: ${R.courtSeats} + 1 за каждого лорда. Первый фамильный придворный сидит с начала, второй в колоде. Карту с блоком «При дворе» можно посадить вместо розыгрыша. Мест нет — сбросьте одного.`,
      };
      const none = id === 'plots' || id === 'court' ? ' Замыслы уже напечатаны на картах двора.' : '';
      return { key: `m_${id}`, c: MODC[id] || MODC.sets, icon: M.icon, name: M.name, type: 'Модуль', fx: `<div class="pc-mod">
        ${row('Добавьте', `${add.join(', ')}.${none}`)}
        ${row('Правило', RULE[id])}</div>`, left: mtagOf(id) };
    }
    const x = D.PROV[id];
    const ests = Object.entries(D.ESTATES).filter(([, d]) => d.p === id).map(([, d]) => `${D.ETYPE[d.t].mark} ${d.name}`).join(', ');
    return { key: `p_${id}`, c: PROVC[id], icon: x.icon, name: x.name, type: 'Провинция', pre: '<span class="pc-req"><span class="pc-k">Союз</span>каждые 3 ваших владения провинции (одинаковые тоже, руины — нет)</span>',
      fx: chips(FX.union(id)), post: ests, left: mtag('unions') };
  }
  function misc(kind, id, o = {}) {
    const sp = spec(kind, id, o);
    const [c, dark] = sp.c;
    const ri = sp.req ? reqIcons(sp.req) : '';
    const right = sp.cost != null ? `<span class="pc-cost">${sp.cost}${coin(1)}${ri ? `<span class="pc-dot">·</span><span class="pc-rq">${ri}</span>` : ''}${sp.disc ? `<span class="pc-dot">·</span><span class="pc-rq">−${ico(sp.disc)}</span>` : ''}</span>` : '<span></span>';
    return iconize(root(`pc-misc${sp.tier ? ` pc-t${sp.tier}` : ''}${dz(kind[0] + ':' + id)}`, c, dark, o, `
      <div class="pc-art"><img src="${CFG.art(sp.key.slice(0, 1), id)}" alt=""><div class="pc-shield"><span class="pc-emo">${sp.icon}</span></div>${sp.tag ? `<div class="pc-corner">${sp.tag}</div>` : ''}</div>
      <div class="pc-name">${sp.name}</div>
      <div class="pc-type">${sp.type}</div>
      <div class="pc-eff"${fit(kind[0] + ':' + id)}>${sp.pre || ''}${sp.fx}${sp.post ? `<div class="pc-post">${sp.post}</div>` : ''}</div>
      <div class="pc-foot">${sp.left && sp.left.startsWith('<') ? sp.left : `<span class="pc-basic">${sp.left || ''}</span>`}${right}</div>`));
  }
  const KINDS = { estate, court, house: (id, o) => misc('house', id, o), ban: (id, o) => misc('ban', id, o), faith: (id, o) => misc('faith', id, o),
    rule: (id, o) => misc('rule', id, o), prov: (id, o) => misc('prov', id, o), module: (id, o) => misc('module', id, o) };
  const SCOPE = (kind) => (kind === 'estate' ? 'pc-e' : 'pc-c');
  // обёртка: область стилей (владение / остальные) + атрибуты; web — масштаб под ширину ячейки
  const wrap = (kind, html, attrs = '', cls = '') => `<div class="pcw ${SCOPE(kind)}${cls ? ' ' + cls : ''}"${attrs ? ' ' + attrs : ''}>${html}</div>`;

  // ---------- стили (исходник в мм; ниже переводится в --u) ----------
  const FXCSS = `
.pc-fxs { display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-start; gap: 1.1mm 2.4mm; max-width: 100%; }
.pc-fx { display: inline-grid; justify-items: center; gap: 0.35mm; max-width: 54mm; }
.pc-fx-m { display: inline-flex; align-items: center; gap: 0.35mm; font-weight: 700; font-size: 4.1mm; line-height: 1; white-space: nowrap; }
.pc-fx-m img.ic { width: 4.8mm; height: 4.8mm; vertical-align: middle; margin: 0; }
.pc-fx-m i { font-style: normal; font-size: 0.8em; color: #6c6455; margin: 0 0.2mm; }
.pc-fx.pc-big .pc-fx-m { font-size: 6.9mm; gap: 0.8mm; }
.pc-fx.pc-big .pc-fx-m img.ic { width: 7.1mm; height: 7.1mm; }
.pc-fx.pc-big .pc-fx-m i { font-size: 0.6em; }
.pc-fx-c { font-size: 2.55mm; line-height: 1.15; text-align: center; color: #3d3428; font-weight: 400; }
/* переносы: короткие подписи — ровными строками, абзацы — без висячих слов */
.pc-fx-c, .pc-cond, .pc-stn, .pc-name, .pc-type, .pc-trig span, .pc-fr, .pc-req { text-wrap: balance; }
.pc-st-t, .pc-tline, .pc-post, .pc-mod p { text-wrap: pretty; }
.pc-fx.pc-big .pc-fx-c { font-size: 2.95mm; max-width: 50mm; }
.pc-fx.pc-txt .pc-fx-c { font-weight: 600; font-size: 2.6mm; }
.pc-fx-c img.ic { width: 1.2em; height: 1.2em; vertical-align: -0.24em; }
.pc-fx-dawn { display: inline-flex; margin-right: 0.3mm; }
.pc-fx-dawn img.ic { width: 3.9mm !important; height: 3.9mm !important; }
.pc-trig { display: inline-flex; align-items: center; gap: 0.9mm; font-size: 2.6mm; font-weight: 600; color: var(--cd); white-space: nowrap; max-width: 100%; line-height: 1.15;
  background: color-mix(in srgb, var(--c) 13%, #fffdf6); border: 0.25mm solid color-mix(in srgb, var(--c) 50%, #fffdf6); border-radius: 3mm; padding: 0.45mm 2mm 0.45mm 0.9mm; }
.pc-trig img.ic { width: 3.9mm; height: 3.9mm; margin: 0; }
.pc-trig b { font-size: 3.1mm; }
.pc-trig span { white-space: normal; }
.pc-trig.pc-none { padding: 0.6mm 2mm; }
.pc-perm { display: flex; align-items: center; justify-content: center; gap: 1.8mm; background: #e9dcbc; border-radius: 1.2mm; padding: 0.7mm 1.6mm; margin: 0.5mm 0 1mm; }
.pc-perm .pc-lbl { font-size: 2.05mm; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #6c5a3a; }
.pc-perm .pc-fxs { gap: 0.4mm 1.8mm; justify-content: flex-start; }
.pc-perm .pc-fx { grid-auto-flow: column; align-items: center; gap: 0.8mm; }
.pc-perm .pc-fx-m { font-size: 3.7mm; }
.pc-perm .pc-fx-m img.ic { width: 4.5mm; height: 4.5mm; }
.pc-perm .pc-fx-c { font-size: 2.4mm; }
.pc-blk { width: 100%; display: grid; grid-template-columns: 15.5mm minmax(0, 1fr); align-items: center; gap: 1.2mm; border-top: 0.25mm dotted #b9a67c; padding-top: 0.8mm; }
.pc-blk .pc-lbl { display: block; font-size: 2mm; line-height: 1.25; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--cd); text-align: left; }
.pc-blk .pc-lbl img.ic { vertical-align: -0.9mm; width: 3.3mm; height: 3.3mm; }
.pc-blk .pc-fxs { justify-content: center; }
.pc-blk .pc-lbl b { font-size: 2.8mm; letter-spacing: 0; }
.pc-blk .pc-fx-m { font-size: 3.6mm; }
.pc-blk .pc-fx-m img.ic { width: 4.3mm; height: 4.3mm; }
.pc-blk .pc-fx-c { font-size: 2.35mm; }
.pc-bx { display: grid; gap: 0.5mm; justify-items: center; min-width: 0; }
.pc-cond { font-size: 1.95mm; line-height: 1.15; color: #6c5a3a; text-align: center; font-style: italic; }
.pc-cond img.ic { width: 1.15em; height: 1.15em; vertical-align: -0.22em; }
.pc-blk.pc-on { background: #e2efd6; border-radius: 1.2mm; box-shadow: 0 0 0 0.45mm #4f8a3a; border-top-color: transparent; }
.pc-req { display: inline-flex; align-items: center; gap: 0.8mm; font-size: 2.5mm; font-weight: 600; color: #5d5140; }
.pc-req .pc-k { font-size: 2.05mm; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--cd); }
.pc-req img.ic { width: 4mm; height: 4mm; }
.pc-offs { opacity: .38; filter: grayscale(1); }
.pc-stag { display: inline-flex; align-items: center; gap: 0.7mm; font-size: 2.2mm; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #fff;
  background: var(--hc); border-radius: 2.4mm; padding: 0.3mm 1.6mm 0.3mm 0.3mm; white-space: nowrap; line-height: 1; }
.pc-stag img.ic { width: 3.4mm !important; height: 3.4mm !important; vertical-align: middle; }
.pcard { position: relative; width: 63.5mm; height: 88.9mm; border-radius: 3.2mm; background: var(--c); padding: 2.4mm; color: #241d14;
  box-shadow: inset 0 0 0 0.35mm var(--cd); font: 400 4.233mm/normal 'Lora', Georgia, serif; letter-spacing: normal; text-transform: none; text-align: left; }
.pcard.pc-bleed { width: 69.5mm; height: 94.9mm; border-radius: 0; padding: 5.4mm; box-shadow: none; }
.pc-panel { position: relative; height: 100%; border-radius: 1.6mm; background: #f3ead6; padding: 1.6mm 1.6mm 1.8mm;
  display: grid; box-shadow: 0 0 0 0.45mm #e7c66b, 0 0 0 0.8mm var(--cd); }
.pc-art { position: relative; width: 100%; aspect-ratio: 55 / 34; min-height: 34.3mm; border-radius: 0.8mm; overflow: hidden; outline: 0.35mm solid #2a241c; }
.pc-art img { width: 100%; height: 100%; object-fit: cover; display: block; max-width: none; }
.pc-dense .pc-art { aspect-ratio: auto; min-height: 0; height: 25mm; }
.pc-shield { position: absolute; left: 1.6mm; top: 0; width: 11.5mm; height: 13.5mm; background: var(--c);
  clip-path: polygon(0 0, 100% 0, 100% 62%, 50% 100%, 0 62%); display: grid; place-items: start center;
  filter: drop-shadow(0 0.3mm 0.4mm rgba(0,0,0,.45)); }
.pc-shield::before { content: ""; position: absolute; inset: 0; clip-path: polygon(0 0, 100% 0, 100% 62%, 50% 100%, 0 62%);
  background: linear-gradient(#ffffff40, transparent 55%); }
.pc-corner { position: absolute; right: 1.4mm; top: 1.4mm; background: rgba(36,29,20,.82); color: #f3ead6; font-weight: 600;
  text-transform: uppercase; padding: 0.5mm 1.6mm 0.5mm 0.8mm; border-radius: 1mm; display: flex; align-items: center; gap: 0.7mm; }
.pc-name { text-align: center; font-weight: 700; line-height: 1.05; }
.pc-type { font-size: 2.4mm; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: var(--cd); }
.pc-eff { display: grid; align-content: center; justify-items: center; --u: calc(var(--u0) * var(--k, 1)); }
.pc-foot { display: flex; justify-content: space-between; align-items: center; border-top: 0.3mm solid #cdbd98; padding-top: 1mm; font-size: 3.6mm; font-weight: 700; }
.pc-stages { display: grid; gap: 0.5mm; width: 100%; }
.pc-stage { display: grid; grid-template-columns: 8.5mm 1fr; align-items: baseline; gap: 1mm; text-align: left; }
.pc-stage .pc-lbl { font-size: 1.95mm; font-weight: 700; letter-spacing: .04em; color: var(--cd); white-space: nowrap; text-align: right; }
.pc-st-t { font-size: 2.45mm; line-height: 1.2; color: #3d3428; }
.pc-take.pc-rite .pc-lbl { color: #1f6a62; }
.pc-blk.pc-faith .pc-lbl { color: #1f6a62; }
.pc-terms { display: flex; justify-content: center; align-items: flex-start; gap: 2.4mm; margin-top: 0.8mm; padding-top: 0.7mm; border-top: 0.25mm dashed #cdbd98; }
.pc-terms2 { display: grid; gap: 0.35mm; width: 100%; margin-top: 0.8mm; padding-top: 0.7mm; border-top: 0.25mm dashed #cdbd98; }
.pc-tline { font-size: 2.15mm; line-height: 1.18; color: #3d3428; text-align: left; }
.pc-tline b { font-size: 1.85mm; letter-spacing: .06em; text-transform: uppercase; color: var(--cd); margin-right: 0.6mm; }
.pc-fr { font-size: 2.3mm; line-height: 1.2; color: #3d3428; text-align: center; margin-bottom: 0.6mm; }
.pc-fr b { font-size: 2.05mm; letter-spacing: .1em; text-transform: uppercase; color: var(--cd); margin-right: 0.6mm; }
.pc-fr img.ic { width: 3.6mm; height: 3.6mm; vertical-align: -0.9mm; }
.pc-stn { font-size: 1.95mm; line-height: 1.15; color: #6c5a3a; font-style: italic; text-align: center; margin-top: 0.3mm; }
.pc-term { display: flex; flex-direction: column; align-items: center; gap: 0.1mm; }
.pc-term .pc-lbl { font-size: 1.75mm; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--cd); white-space: nowrap; }
.pc-take { display: flex; align-items: center; justify-content: center; gap: 1.2mm; margin-top: 1mm; padding-top: 0.8mm; border-top: 0.25mm dashed #cdbd98; }
.pc-take .pc-lbl { font-size: 2.05mm; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--cd); }
.pc-cost { display: inline-flex; align-items: center; gap: 0.7mm; white-space: nowrap; }
.pc-cost .pc-dot { color: #9a8a6a; margin: 0 0.3mm; }
.pc-cost .pc-rq { display: inline-flex; gap: 0.2mm; }
.pc-cost .pc-rq img.ic { width: 3.9mm; height: 3.9mm; }
.pc-basic { font-size: 2.2mm; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: #8a7a5c; }
.pc-mtag { display: inline-flex; align-items: center; gap: 0.6mm; font-size: 2.2mm; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #fff; background: #5d5140; border-radius: 1mm; padding: 0.35mm 1.2mm; white-space: nowrap; }
.pc-mtag img.ic { width: 2.9mm; height: 2.9mm; }
.pc-fl { display: inline-flex; align-items: center; gap: 1.2mm; min-width: 0; }
`;
  // значки: .ic и img.ic — в одной области стилей, чтобы, как в печати, img.ic перекрывал .ic
  const ICCSS = `
img.ic { width: 1.15em; height: 1.15em; vertical-align: -0.2em; margin: 0; }
.icw { white-space: nowrap; }
`;
  // владения
  const ECSS = `
.pc-panel { grid-template-rows: auto auto auto 1fr auto; }
.pc-shield { padding-top: 1.9mm; }
.pc-shield span { position: relative; color: #fff; font-weight: 700; font-size: 5.2mm; line-height: 1; letter-spacing: -0.02em; text-shadow: 0 0.25mm 0 rgba(0,0,0,.35); }
.pc-shield .pc-sic img.ic { width: 6mm; height: 6mm; }
.pc-shield.pc-wide { width: 13.5mm; left: 1.2mm; }
.pc-name { margin-top: 2mm; font-size: 4.6mm; }
.pc-type { display: flex; align-items: center; justify-content: center; gap: 0.8mm; margin-top: 0.6mm; }
.pc-type img.ic { width: 3.4mm; height: 3.4mm; vertical-align: middle; }
.pc-type .pc-pv { margin: 0 0.4mm; opacity: .6; }
.pc-eff { gap: 1.4mm; padding: 1mm 0.6mm 0.4mm; }
.ic { display: inline-block; vertical-align: middle; }
` + ICCSS;
  // карты двора и остальные
  const CCSS = `
.pc-panel { grid-template-rows: auto auto auto 1fr auto; }
.pc-shield { padding-top: 1.7mm; }
.pc-shield span { position: relative; font-size: 5mm; line-height: 1; }
.pc-shield .pc-emo { font-size: 4.6mm; }
.pc-corner { font-size: 2.6mm; letter-spacing: .06em; }
.pc-corner img.ic { width: 3.6mm; height: 3.6mm; vertical-align: middle; }
.pc-name { margin-top: 1.8mm; font-size: 4.4mm; }
.pc-type { text-align: center; margin-top: 0.7mm; }
.pc-type .pc-atk { display: block; width: fit-content; margin: 0.6mm auto 0; padding: 0.2mm 1.6mm; border-radius: 2mm; background: var(--cd); color: #fff; font-size: 2.2mm; letter-spacing: .1em; }
.pc-eff { gap: 1.2mm; padding: 0.8mm 0.4mm 0.6mm; }
.pc-foot { min-height: 5mm; }
.ic { display: inline-block; vertical-align: -0.12em; }
.pc-misc .pc-foot .pc-mtag { max-width: 30mm; overflow: hidden; text-overflow: ellipsis; }
.pc-misc .pc-post { font-size: 2.45mm; text-align: center; color: #5d5140; line-height: 1.22; border-top: 0.25mm dotted #b9a67c; padding-top: 0.7mm; width: 100%; }
.pc-misc .pc-post b { color: var(--cd); }
/* лесенка на картах значков: 🕯2 → +1🪙, 🕯4 → +2🪙… */
.pc-misc .pc-lad { width: 100%; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.8mm; }
.pc-misc .pc-lad > span { display: flex; flex-direction: column; align-items: center; gap: 0.2mm; padding: 0.6mm 0.2mm; border-radius: 1.2mm; background: rgba(120, 95, 50, .1); }
.pc-misc .pc-lad i, .pc-misc .pc-lad em { display: block; font-style: normal; white-space: nowrap; line-height: 1.1; }
.pc-misc .pc-lad i { font-size: 2.5mm; color: #6c6455; }
.pc-misc .pc-lad em { font-size: 2.8mm; font-weight: 700; color: #3d3428; }
.pc-misc .pc-lad img.ic { width: 3mm; height: 3mm; vertical-align: -0.5mm; }
.pc-misc .pc-mod { width: 100%; display: grid; gap: 1.1mm; font-size: 2.65mm; line-height: 1.24; color: #3d3428; text-align: left; padding: 0 0.6mm; }
.pc-misc .pc-mod p { margin: 0; }
/* ярусы знамён: металл рамки — бронза (вассал), серебро (лорд), золото (великий лорд); цвет — направление */
.pcard.pc-tv { box-shadow: inset 0 0 0 1.1mm #b07a43, inset 0 0 0 1.4mm rgba(0,0,0,.25); }
.pcard.pc-tl { box-shadow: inset 0 0 0 1.1mm #d9dde4, inset 0 0 0 1.4mm rgba(0,0,0,.25), inset 0 0 0 1.9mm #9aa1ad; }
.pcard.pc-tg { box-shadow: inset 0 0 0 1.2mm #f1cf6b, inset 0 0 0 1.5mm rgba(0,0,0,.3), inset 0 0 0 2.1mm #c9952c; }
.pcard.pc-tv .pc-corner { background: #8a5a2e; }
.pcard.pc-tl .pc-corner { background: #6b717d; }
.pcard.pc-tg .pc-corner { background: #a77b18; }
.pc-take.pc-ban .pc-lbl { color: #8f2a2a; }
.pc-blk.pc-bad { border-color: #8f2a2a; }
.pc-misc .pc-mod .pc-mk { display: inline-block; margin-right: 1.1mm; font-size: 2mm; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--cd); }
` + ICCSS;
  const toU = (css) => css.replace(/(-?\d*\.?\d+)mm\b/g, (m, n) => u(n));
  const scope = (css, s) => css.replace(/([^{}]+)\{([^{}]*)\}/g, (m, sel, body) => sel.split(',').map(x => `${s} ${x.trim()}`).join(', ') + ` {${body}}`);
  const CSS = `
.pcw { --u0: 1mm; --u: var(--u0); position: relative; }
.pcw * { box-sizing: border-box; margin: 0; }
.pcw.web { container-type: inline-size; --u0: calc(100cqw / 63.5); }
` + toU(scope(FXCSS + ECSS, '.pcw.pc-e') + scope(FXCSS + CCSS, '.pcw.pc-c'));

  // ---------- рубашки ----------
  const BW = 69.5, BH = 94.9, CX = BW / 2, CY = BH / 2;
  const BACKS = {
    estates: { label: 'ВЛАДЕНИЯ', c: ['#3f8c55', '#1f5531', '#0b2615'], emblem: 'castle', what: 'все владения' },
    court: { label: 'ДВОР', c: ['#9a2a31', '#611419', '#33080c'], emblem: 'fleur', what: 'Подать, карты двора, фамильные карты' },
    lords: { label: 'ЛОРДЫ', c: ['#7a4ea3', '#43255f', '#1d0c2f'], emblem: 'crown', what: 'лорды' },
    foreign: { label: 'ВЕЛИКИЕ ЛОРДЫ', c: ['#2f7f86', '#17474d', '#082226'], emblem: 'imperial', what: 'великие лорды' },
    houses: { label: 'ДОМА', c: ['#3a62a0', '#1c375f', '#0a172f'], emblem: 'banner', what: 'карты Домов и Наследники' },
    vassals: { label: 'ВАССАЛЫ', c: ['#8a5a2e', '#55341a', '#26160a'], emblem: 'shield', what: 'вассалы' },
    seasons: { label: 'СЕЗОНЫ', c: ['#b8642e', '#74391a', '#33170a'], emblem: 'hourglass', what: 'сезоны' },
    titles: { label: 'ТИТУЛЫ', c: ['#a2762e', '#664716', '#2c1d07'], emblem: 'laurels', what: 'титулы' },
    provinces: { label: 'ПРОВИНЦИИ', c: ['#6b6f76', '#3f4248', '#1a1c1f'], emblem: 'compass', what: 'провинции' },
    balance: { label: 'ОБЩИЙ СТОЛ', c: ['#6e5a8a', '#3f3152', '#1b1424'], emblem: 'scales', what: 'провинции, веры, Зависть и поддержка, карты модулей' },
  };
  // эмблемы (game-icons.net, CC BY 3.0) и замеры надписей (Lora 700, 3.15 мм) — см. cards/backs.js measure()
  const EMB = {
    scales: "M254.47 53.094s-4.808 37.12-49.5 49.5c-44.695 12.38-129.282 0-129.282 0L61.343 115.78l8.187 9.157-1.093 2.876-51.843 137.312L16 266.72v1.717c0 18.897 8.253 34.243 20.344 44 12.09 9.758 27.563 14.31 42.937 14.313 15.376.003 30.878-4.556 42.97-14.313 12.092-9.756 20.344-25.094 20.344-44v-1.843l-.688-1.688L86.97 130.28c23.946-3.003 80.866-8.54 115.5 1.532 23.064 6.71 36.151 20.345 43.436 31.97L210.78 354.468l21.407 30.31c-17.75 7.75-32.593 24.84-37.562 51.345-56.076 6.195-95.47 20.74-95.47 37.688h311.876c0-16.947-39.392-31.493-95.467-37.688-4.91-26.6-19.57-44.112-37.188-51.906l21-29.75L264 162.28c7.457-11.275 20.388-24.045 42.47-30.468 34.955-10.167 92.615-4.42 116.155-1.437l-50.875 134.75-.625 1.594v1.717c0 18.897 8.253 34.243 20.344 44 12.09 9.758 27.593 14.31 42.967 14.313 15.375.003 30.877-4.556 42.97-14.313 12.09-9.756 20.343-25.094 20.343-44v-1.843l-.688-1.688L441 127.562l-.938-2.28 8.782-8.438-15.594-14.25s-84.556 12.38-129.25 0-49.53-49.5-49.53-49.5zM77.53 156.656l44.22 108.375H36.594L77.53 156.657zm355.158 0l44.218 108.375H391.72l40.967-108.374z",
    imperial: "M256 38.55c-30.5 0-55 24.52-55 55 0 30.45 24.5 54.95 55 54.95s55-24.5 55-54.95c0-30.48-24.5-55-55-55zM191.3 164.4c-5.7 0-11.1.4-16 1.4-19.9 4-34.1 15.6-43.1 35.4-9.4 20.6-12.1 50.6-5.8 88l6 5.9c13.8 13.8 36.1 21.4 58.6 21.4 21.1 0 42.1-6.7 56-19V179.2c-21-9.8-39.8-14.5-55.7-14.8zm129.4 0c-15.9.3-34.7 5-55.7 14.8v118.3c13.9 12.3 34.9 19 56 19 22.5 0 44.8-7.6 58.6-21.4l6-5.9c6.3-37.4 3.6-67.4-5.8-88-9-19.8-23.2-31.4-43.1-35.4-4.9-1-10.3-1.4-16-1.4zm-209.1 14.4h-.2c-30 .7-55.2 12.1-70.2 32.1-13.3 17.8-19.5 42.9-13.6 76 .9 5.1 2.1 10.5 3.7 16 24.5 18.5 54.3 18.6 78.9.3-9.2-44.8-6.9-81.9 5.6-109.4 2.4-5.3 5.2-10.2 8.4-14.7-2.9-.2-5.8-.3-8.6-.3H111.7c-.1 0-.1-.1-.1 0zm288.8 0c0-.1 0 0-.1 0H396.4c-2.8 0-5.7.1-8.6.3 3.2 4.5 6 9.4 8.4 14.7 12.5 27.5 14.8 64.6 5.6 109.4 24.5 18.3 54.4 18.2 78.9-.3 1.5-5.5 2.8-10.9 3.7-16 5.9-33.1-.3-58.2-13.6-76-15-20-40.2-31.4-70.2-32.1h-.2zM132.8 318.4c6.9 26.1 17.7 54.9 32.9 86.1h58.6l22.7-56.7v-28c-16.4 10-36.3 14.7-56 14.7-20.7 0-41.5-5.2-58.2-16.1zm246.4 0c-16.7 10.9-37.5 16.1-58.2 16.1-19.7 0-39.6-4.7-56-14.7v28l22.7 56.7h58.6c15.2-31.2 26-60 32.9-86.1zm-264.6 3.4c-23 13.9-50.1 16.1-74.5 6.4 9.6 23 24.1 48.5 44.5 76.3h61c-14-29.6-24.2-57.2-31-82.7zm282.8 0c-6.8 25.5-17 53.1-31 82.7h61c20.4-27.8 34.9-53.3 44.5-76.3-24.3 9.7-51.5 7.5-74.5-6.4zM256 373.7l-22.1 55.4 22.1 44.3 22.1-44.3zM91.53 422.5l11.47 46h35.3l-23-23 23-23zm90.27 0l16.6 16.6 6.3 6.4-23 23h51.7l-19.3-38.6 3-7.4zm113.1 0l1.5 3.7 1.5 3.7-19.3 38.6h51.7l-23-23 23-23zm78.9 0l16.6 16.6 6.3 6.4-23 23H409l11.5-46zM160 426.2l-19.3 19.3 19.3 19.3 19.3-19.3zm192 0l-19.3 19.3 19.3 19.3 19.3-19.3z",
    shield: "M256 16c25 24 100 72 150 72v96c0 96-75 240-150 312-75-72-150-216-150-312V88c50 0 125-48 150-72z",
    hourglass: "M92.656 19.188v41.5h331.72v-41.5H92.655zM119.5 79.374V433.53h22.28V79.376H119.5zm46.594 0c3.212 43.324 13.312 82.022 27.78 110.906 17.685 35.304 40.845 54.75 64.064 54.75 23.218 0 46.346-19.446 64.03-54.75 14.47-28.883 24.57-67.58 27.782-110.905H166.094zm209.156 0V433.53h22.28V79.376h-22.28zm-117.313 185.22c-23.218 0-46.378 19.415-64.062 54.717-14.835 29.614-25.098 69.562-28.03 114.22H350c-2.933-44.658-13.197-84.606-28.03-114.22-17.686-35.302-40.814-54.718-64.033-54.718zM92.657 452.218v41.467h331.718V452.22H92.655z",
    laurels: "M234.7 18.05c-21 .2-38.8 2.5-62 10.2-4.1 2-8.2 4.1-12.2 6.2.8 5.26 3.2 10.77 5.5 14.7-4.9 4.2-9.6 8.4-14.1 12.8-3.7-5.5-6.6-11.4-8.3-17.4-14.2 9.2-27.7 19.6-40.1 31.4 1.9 9.5 9.2 18.21 15.2 24.15-3.7 5.2-7.2 10.4-10.5 15.7-8.22-7.2-15.12-15.5-19.32-24.65C74.97 108.1 61.92 126 53.08 142.3c5.29 13 19.01 22.7 29.8 28.4-2 6.1-3.7 12.2-5.1 18.4-13.5-6.4-26.3-15.7-34.5-26.6-8.7 20.1-14.7 40.7-18.2 61.4 9.63 15.5 30.57 22.9 46 25.9.1 6.4.4 12.8.9 19.2-17.79-2.7-37.26-9.6-49.9-20.4-1.6 22.3-.5 44.5 3.4 66.2 15.25 13.7 41.14 15.3 58.6 13.7 2 6.1 4.1 12.2 6.5 18.1-18.61 4.5-43.29 1.1-59.3-6.2 6.6 23.7 16.4 46.4 29.2 67.4 19.33 8.6 44.52 3.6 61.72-2.5 3.7 5.3 7.6 10.5 11.6 15.5-17.8 9.5-39.9 11.5-57.52 10.1 12.3 16.3 26.62 31.2 42.72 44.4 4.9 1.1 10.5 1.1 16.7.3 11.7-1.7 25.2-7 37.9-14.7 16.7 13.5 34.9 24.7 54.1 33.1l7.5-17.2c-16-6.9-31.3-16.2-45.6-27.3 13.3-10.9 24.3-24 30.2-36.5 4.7-9.7 6.3-18.4 4.5-26.3-10.7-5.7-20.6-12.5-29.5-20.3-7.8 20.8-26.4 36.1-43.5 46-4-4.9-7.9-9.9-11.6-15 16.8-9.8 39.9-27.5 39.1-47.1-8.9-10.3-16.6-21.8-22.9-34.1-12 14-30.7 22.5-46.5 26.7-2.4-5.8-4.6-11.6-6.6-17.6 16.8-5.2 37.9-13 44.1-29.7-4.3-11.5-7.5-23.6-9.7-36-13.8 8.4-32 11.1-46.32 10.9-.6-6.2-1-12.4-1.2-18.7 15.52-.6 33.92-2.5 44.92-14.3-.8-12.6-.5-25.5.9-38.5-13.4 2.8-29 .3-40.42-3.2 1.3-6 2.9-12.1 4.8-18.1 12.82 3.2 27.12 6.7 38.82.8 2.7-13.6 6.7-27.3 12-40.8-9.9-1.8-20.2-6.3-27.7-10.7 3.3-5.3 6.8-10.5 10.5-15.7 8.1 4.2 16.3 8.8 25.2 8.4 5.7-11.6 12.3-22.65 19.5-32.75-5.1-2.7-10-6.4-14.4-10.6 4.4-4.3 9.1-8.5 13.9-12.7 3.8 3.54 8 6.18 12.3 8.2 15.9-18.6 35.9-36.23 49-53.8zm38.4 0c15.4 20.75 33.8 35.63 48.9 53.7 4.6-1.76 9.1-5.23 12.3-8.1 4.9 4.2 9.5 8.4 13.9 12.7-4.4 4.2-9.2 7.9-14.4 10.6 7.3 10.1 13.9 21.05 19.6 32.65 9-.1 18.4-4.4 25.2-8.4 3.7 5.2 7.2 10.4 10.4 15.7-8.8 5.9-18.2 9.6-27.6 10.7 5.3 13.5 9.3 27.2 12 40.8 12.3 5.4 27.3 2.7 38.7-.8 1.9 6 3.5 12.1 4.9 18.1-14.2 3.4-27.3 6.2-40.4 3.3 1.4 12.9 1.6 25.8.8 38.5 11.4 12.3 30.2 14.4 44.9 14.2-.2 6.3-.5 12.5-1.2 18.7-17.1-.5-32.8-2.5-46.3-10.9-2.1 12.4-5.3 24.5-9.6 36.1 8.2 17.4 27.8 25.3 44.1 29.6-2 6-4.2 11.8-6.6 17.6-18.5-5.6-34.9-13-46.6-26.7-6.3 12.4-13.9 23.8-22.9 34.1 1.5 22.4 22.4 37.8 39.2 47.1-3.7 5.1-7.6 10.1-11.6 15-19-11.8-36.6-25.8-43.5-46-9 7.8-18.8 14.6-29.6 20.3-1.8 7.9-.1 16.6 4.5 26.3 6 12.5 17 25.6 30.3 36.5-14.3 11.1-29.6 20.4-45.6 27.3l7.4 17.2c19.3-8.4 37.4-19.6 54.1-33.2 12.7 7.8 26.2 13.1 38 14.8 6.2.8 11.8.8 16.7-.3 16.1-13.2 30.4-28.1 42.7-44.4-18 1.7-37.9-2.3-56.5-9.7-.3-.1-.7-.3-1.1-.4 4.1-5 7.9-10.2 11.7-15.5 18.2 7.8 43.7 11.7 61.6 2.5 12.8-21 22.6-43.7 29.2-67.4-.4.2-.8.4-1.2.5-20.5 6.4-40.1 7.6-58.1 5.7 2.4-5.9 4.5-12 6.5-18 19.1 1.7 45.2.1 58.6-13.8 3.9-21.7 5.1-43.9 3.4-66.2-14.4 10.7-34.9 17.9-49.9 20.4.5-6.4.9-12.8 1-19.2 16.8-4.8 37.9-10 45.9-25.9-3.5-20.7-9.5-41.3-18.2-61.4-9.4 11.6-23.1 21-34.4 26.5-1.5-6.1-3.2-12.2-5.2-18.3 12-7.4 25.1-15.3 29.9-28.4-10.1-18.7-22.2-35.8-35.9-51.05-4.2 9.05-11.1 17.45-19.2 24.65-3.3-5.3-6.8-10.5-10.6-15.7 6.2-7.17 14.2-14.71 15.2-24.15-12.4-11.8-25.8-22.2-40-31.4-1.8 6-4.7 11.9-8.3 17.4-4.5-4.4-9.2-8.6-14.1-12.8 2.7-4.82 4.7-9.62 5.4-14.7-4-2.1-8.1-4.2-12.2-6.2-24.7-8.2-43.3-10.3-66.2-10.2z",
    compass: "M203.97 23l-18.032 4.844 11.656 43.468c-25.837 8.076-50.32 21.653-71.594 40.75L94.53 80.594l-13.218 13.22 31.376 31.374c-19.467 21.125-33.414 45.53-41.813 71.343l-42.313-11.343-4.843 18.063 42.25 11.313c-6.057 27.3-6.157 55.656-.345 83L23.72 308.78l4.843 18.064 41.812-11.22c6.693 21.225 17.114 41.525 31.25 59.876l-29.97 52.688-16.81 29.593 29.56-16.842 52.657-29.97c18.41 14.216 38.784 24.69 60.094 31.407l-11.22 41.844 18.033 4.81 11.218-41.905c27.345 5.808 55.698 5.686 83-.375l11.312 42.28 18.063-4.81-11.344-42.376c25.812-8.4 50.217-22.315 71.342-41.78l31.375 31.373 13.22-13.218-31.47-31.47c19.09-21.266 32.643-45.738 40.72-71.563l43.53 11.657 4.813-18.063-43.625-11.686c5.68-27.044 5.576-55.06-.344-82.063l43.97-11.78-4.813-18.063L440.908 197c-6.73-20.866-17.08-40.79-31.032-58.844l29.97-52.656 16.842-29.563-29.593 16.844-52.656 29.97c-17.998-13.875-37.874-24.198-58.657-30.906l11.783-44L309.5 23l-11.78 43.97c-27-5.925-55.02-6.05-82.064-.376L203.97 23zm201.56 85L297.25 298.313l-.75.437-40.844-40.875-148.72 148.72-2.186 1.25 109.125-191.75 41.78 41.78L405.532 108zm-149.686 10.594c21.858 0 43.717 5.166 63.594 15.47l-116.625 66.342-2.22 1.28-1.28 2.22-66.25 116.406c-26.942-52.04-18.616-117.603 25.03-161.25 26.99-26.988 62.38-40.468 97.75-40.468zm122.72 74.594c26.994 52.054 18.67 117.672-25.002 161.343-43.66 43.662-109.263 52.005-161.312 25.033l116.438-66.282 2.25-1.25 1.25-2.25 66.375-116.592z",
    castle: "M255.95 27.11L180.6 107.61l150.7 1.16-75.35-81.67h-.003zM25 109.89v68.01l19.41 25.99h71.06l19.52-26v-68h-14v15.99h-18v-15.99H89v15.99H71v-15.99H57v15.99H39v-15.99H25zm352 0v68l19.52 26h71.06L487 177.90v-68.01h-14v15.99h-18v-15.99h-14v15.99h-18v-15.99h-14v15.99h-18v-15.99h-14zm-176 15.87V260.89h110V126.63l-110-.857zm55 20.11c8 0 16 4 16 12v32h-32v-32c0-8 8-12 16-12zM41 221.89V484.89h78V221.89H41zm352 0V484.89h78V221.89h-78zM56 241.89c4 0 8 4 8 12v32H48v-32c0-8 4-12 8-12zm400 0c4 0 8 4 8 12v32h-16v-32c0-8 4-12 8-12zm-303 37v23h-16v183h87v-55c0-24 16-36 32-36s32 12 32 36v55h87v-183h-16v-23h-14v23h-18v-23h-14v23h-18v-23h-14v23h-18v-23h-14v23h-18v-23h-14v23h-18v-23h-14v23h-18v-23h-14zm-49 43c4 0 8 4 8 12v32H96v-32c0-8 4-12 8-12zm72 0c8 0 16 4 16 12v32h-32v-32c0-8 8-12 16-12zm80 0c8 0 16 4 16 12v32h-32v-32c0-8 8-12 16-12zm80 0c8 0 16 4 16 12v32h-32v-32c0-8 8-12 16-12zm72 0c4 0 8 4 8 12v32h-16v-32c0-8 4-12 8-12zm-352 64c4 0 8 4 8 12v32H48v-32c0-8 4-12 8-12zm400 0c4 0 8 4 8 12v32h-16v-32c0-8 4-12 8-12z",
    fleur: "M256 24c-31.46 48-62.93 96-62.93 160 0 56.79 37.14 113.56 45.51 148h34.83c8.37-34.43 45.51-91.20 45.51-148 0-64-31.46-112-62.93-160zM98.63 206c-47.2 0-78.66 32-78.66 80 0 32 22.11 63.52 62.93 64-15.73-16 .002-64 31.46-64 31.89 0 56.58 21.91 69.25 46h33.82c-13.74-47.52-49.10-126-118.81-126zm314.72 0c-69.70 0-105.07 78.48-118.81 126h33.82c12.67-24.08 37.36-46 69.25-46 31.46 0 47.2 48 31.46 64 40.81-.474 62.93-32 62.93-64 0-48-31.46-80-78.66-80zM153.07 350c-38.70 0-54.44 16-54.44 48 0 16 15.73 48 47.2 48 35.4 0 61.94-27 73.01-54h-35.68c-4.65 3.57-11.5 6-21.59 6-15.73 0-31.46-32-8.49-48zm37.69 0c.017.06.03.12.048.19-13.29 2.16-12.69 23.34 1.79 23.79v.02H319.39l-.003-.02c14.48-.447 15.08-21.63 1.79-23.79.01-.063.03-.126.04-.19H190.77zm168.15 0c22.97 16 7.24 48-8.49 48-10.09 0-16.94-2.43-21.59-6h-35.68c11.06 27 37.61 54 73.01 54 31.46 0 47.2-32 47.2-48 0-32-15.73-48-54.44-48zm-118.65 42c-15.73 16-15.73 48-31.46 64l31.46-16c0 16 0 32 15.73 48 15.73-16 15.73-32 15.73-48l31.46 16c-15.73-16-15.73-48-31.46-64h-31.46z",
    banner: "M256 23.57l-16.1 48.86h32.2zM73 90.43v15.97h366V90.43zm48 33.97V479l135-105 135 105V124.4zm87 37h96l-32 80 80-32v96l-80-32 32 80h-96l32-80-80 32v-96l80 32zm48 235.4l-23 17.9v73.7h46v-73.7z",
  };
  const BM = {"label":{"estates":23.436,"court":10.976,"lords":15.081,"foreign":37.542,"houses":12.084,"vassals":20.348,"seasons":17.714,"titles":17.838,"provinces":27.554,"balance":29.526},"emb":{"scales":[16,53.094,481.749,420.717],"imperial":[25.364,38.55,461.272,434.85],"shield":[106,16,300,480],"hourglass":[92.655,19.188,331.721,474.497],"laurels":[21.371,18.047,469.281,475.953],"compass":[23.719,23,466.03,466.03],"castle":[25,27.1,462,457.79],"fleur":[19.97,24,472.03,464],"banner":[73,23.57,366,464.83],"crown":[10.3,8.8,43.4,44.2]}};
  const BFONT = 'font-family: Lora, Georgia, serif; font-weight: 700; font-size: 3.15px; letter-spacing: 0.72px;';
  const CROWN = (p) => `<g stroke="#2a1306" stroke-linejoin="round" stroke-linecap="round">
    <path d="M11.5 45 L13.5 20 L24 31.5 L32 13.5 L40 31.5 L50.5 20 L52.5 45 Z" fill="url(#${p}au)" stroke-width="2.4"/>
    <rect x="11.5" y="44" width="41" height="9" rx="2" fill="url(#${p}band)" stroke-width="2.2"/>
    <circle cx="32" cy="48.5" r="2.8" fill="url(#${p}ruby)" stroke-width="1.2"/>
    <circle cx="21.5" cy="48.5" r="2.1" fill="url(#${p}sapph)" stroke-width="1"/>
    <circle cx="42.5" cy="48.5" r="2.1" fill="url(#${p}sapph)" stroke-width="1"/>
    <circle cx="13.5" cy="18.5" r="3.2" fill="url(#${p}au)" stroke-width="1.7"/>
    <circle cx="32" cy="12" r="3.2" fill="url(#${p}au)" stroke-width="1.7"/>
    <circle cx="50.5" cy="18.5" r="3.2" fill="url(#${p}au)" stroke-width="1.7"/>
    <path d="M17 40 L18.5 27" fill="none" stroke="#fff8dc" stroke-width="1.8" stroke-opacity=".75"/>
    <path d="M30.4 22.5 L32 18.8" fill="none" stroke="#fff8dc" stroke-width="1.4" stroke-opacity=".6"/>
  </g>`;
  const CROWN_SHADOW = `<path d="M11.5 45 L13.5 20 L24 31.5 L32 13.5 L40 31.5 L50.5 20 L52.5 45 Z" fill="#000" stroke="#000" stroke-width="2.4" stroke-linejoin="round"/><rect x="11.5" y="44" width="41" height="9" rx="2" fill="#000" stroke="#000" stroke-width="2.2"/>
  <circle cx="13.5" cy="18.5" r="4" fill="#000"/><circle cx="32" cy="12" r="4" fill="#000"/><circle cx="50.5" cy="18.5" r="4" fill="#000"/>`;
  const f3 = (n) => +n.toFixed(3);
  const star = (x, y, r) => `M${f3(x)} ${f3(y - r)} l${f3(r * .24)} ${f3(r * .76)} ${f3(r * .76)} ${f3(r * .24)} ${f3(-r * .76)} ${f3(r * .24)} ${f3(-r * .24)} ${f3(r * .76)} ${f3(-r * .24)} ${f3(-r * .76)} ${f3(-r * .76)} ${f3(-r * .24)} ${f3(r * .76)} ${f3(-r * .24)}z`;
  const diamond = (x, y, r) => `M${f3(x)} ${f3(y - r)}L${f3(x + r * .62)} ${f3(y)}L${f3(x)} ${f3(y + r)}L${f3(x - r * .62)} ${f3(y)}z`;
  // ромбическая сетка: центр карты — узел сетки, поэтому узор симметричен и сдвиг сторон при печати на нём не виден
  let LAT = null;
  function lattice() {
    if (LAT) return LAT;
    const s = 4.6, d = s * Math.SQRT2, a = CX - CY, b = CX + CY;
    let lines = '', dots = '';
    for (let i = -30; i <= 30; i++) { const ka = a + i * d; if (ka > BW + 5 || ka < -BH - 5) continue; lines += `M${f3(-5 + ka)} -5L${f3(BH + 5 + ka)} ${f3(BH + 5)}`; }
    for (let j = -30; j <= 30; j++) { const kb = b + j * d; if (kb < -5 || kb > BW + BH + 5) continue; lines += `M${f3(kb + 5)} -5L${f3(kb - BH - 5)} ${f3(BH + 5)}`; }
    for (let i = -30; i <= 30; i++) for (let j = -30; j <= 30; j++) {
      const x = (a + b) / 2 + (i + j + 1) * d / 2, y = (b - a) / 2 + (j - i) * d / 2;
      if (x < -1 || x > BW + 1 || y < -1 || y > BH + 1) continue;
      dots += `M${f3(x - 0.3)} ${f3(y)}a.3 .3 0 1 0 .6 0a.3 .3 0 1 0 -.6 0z`;
    }
    return (LAT = { lines, dots });
  }
  function label(p, text, tw, y) {
    const fx0 = 12.2, fx1 = BW - 12.2, gap = 2.4, l = CX - tw / 2 - gap, r = CX + tw / 2 + gap;
    const whisk = l - fx0 > 3.5
      ? `<path d="M${f3(fx0 + 1.6)} ${f3(y - 1.05)}H${f3(l)}M${f3(r)} ${f3(y - 1.05)}H${f3(fx1 - 1.6)}" stroke="#e7bf5c" stroke-opacity=".85" stroke-width=".3" fill="none"/>
       <path d="${diamond(fx0 + 0.8, y - 1.05, 1.05)}${diamond(fx1 - 0.8, y - 1.05, 1.05)}" fill="#f3d27a"/>`
      : `<path d="${diamond(l - 0.6, y - 1.05, 0.9)}${diamond(r + 0.6, y - 1.05, 0.9)}" fill="#f3d27a"/>`;
    // сплошная заливка: текст с градиентом часть просмотрщиков PDF рисует плашкой
    return `${whisk}<text x="${f3(CX)}" y="${f3(y)}" text-anchor="middle" style="${BFONT}" fill="#2a1306" fill-opacity=".55" transform="translate(0 .28)">${text}</text>
    <text x="${f3(CX)}" y="${f3(y)}" text-anchor="middle" style="${BFONT}" fill="#f2cb64">${text}</text>`;
  }
  // новая рубашка: def — { label, c: [светлый, средний, тёмный], what }, path — эмблема (512×512), box — её рамка, lw — ширина надписи в мм
  function addBack(key, def, path, box, lw) { BACKS[key] = Object.assign({ emblem: key }, def); EMB[key] = path; BM.emb[key] = box; BM.label[key] = lw; }
  // o.web — без вылетов (обрезной формат), по размеру контейнера
  function back(key, o = {}) {
    const b = BACKS[key], p = 'bk' + key + '-';
    const [c0, c1, c2] = b.c;
    const tw = BM.label[key];
    const [ex, ey, ew, eh] = BM.emb[b.emblem];
    const box = b.emblem === 'crown' ? 19 : 18.5, k = box / Math.max(ew, eh);
    const ox = CX - (ex + ew / 2) * k, oy = CY - (ey + eh / 2) * k + (b.emblem === 'crown' ? 0.4 : 0);
    const path = EMB[b.emblem];
    const emb = b.emblem === 'crown'
      ? `<g transform="translate(${f3(ox)} ${f3(oy + 0.75)}) scale(${f3(k)})" opacity=".42">${CROWN_SHADOW}</g><g transform="translate(${f3(ox)} ${f3(oy)}) scale(${f3(k)})">${CROWN(p)}</g>`
      : `<g transform="translate(${f3(ox)} ${f3(oy + 0.75)}) scale(${f3(k)})"><path d="${path}" fill="#000" fill-opacity=".42" stroke="#000" stroke-opacity=".42" stroke-width="${f3(1.3 / k)}" stroke-linejoin="round"/></g>
       <g transform="translate(${f3(ox)} ${f3(oy)}) scale(${f3(k)})"><path d="${path}" fill="url(#${p}au)" stroke="#2a1306" stroke-width="${f3(1.25 / k)}" stroke-linejoin="round" paint-order="stroke"/></g>`;
    const R = 15.4, ly = 19.2, L = lattice();
    const size = o.web ? `viewBox="3 3 63.5 88.9" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"` : `viewBox="0 0 ${BW} ${BH}" width="${BW}mm" height="${BH}mm"`;
    return `<svg xmlns="http://www.w3.org/2000/svg" class="bk" ${size} aria-hidden="true">
  <defs>
    <radialGradient id="${p}bg" cx="50%" cy="50%" r="68%"><stop offset="0" stop-color="${c0}"/><stop offset=".55" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>
    <radialGradient id="${p}gl" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd877" stop-opacity=".34"/><stop offset=".6" stop-color="#ffd877" stop-opacity=".09"/><stop offset="1" stop-color="#ffd877" stop-opacity="0"/></radialGradient>
    <linearGradient id="${p}fr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6d77e"/><stop offset=".5" stop-color="#c9952c"/><stop offset="1" stop-color="#f1cc6b"/></linearGradient>
    <linearGradient id="${p}au" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe08d"/><stop offset=".55" stop-color="#ebb847"/><stop offset="1" stop-color="#c68b22"/></linearGradient>
    <linearGradient id="${p}band" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2a83a"/><stop offset="1" stop-color="#9b6610"/></linearGradient>
    <radialGradient id="${p}ruby" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#ff8f84"/><stop offset=".5" stop-color="#c8392f"/><stop offset="1" stop-color="#7d1710"/></radialGradient>
    <radialGradient id="${p}sapph" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#9cc3ff"/><stop offset=".5" stop-color="#2f62b0"/><stop offset="1" stop-color="#16346b"/></radialGradient>
    <radialGradient id="${p}med" cx="50%" cy="42%" r="60%"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>
  </defs>
  <rect width="${BW}" height="${BH}" fill="url(#${p}bg)"/>
  <path d="${L.lines}" stroke="#000" stroke-opacity=".2" stroke-width=".3" fill="none"/>
  <path d="${L.dots}" fill="#f0c766" fill-opacity=".2"/>
  <circle cx="${f3(CX)}" cy="${f3(CY)}" r="31" fill="url(#${p}gl)"/>
  <rect x="7.4" y="7.4" width="${f3(BW - 14.8)}" height="${f3(BH - 14.8)}" rx="3.6" fill="none" stroke="url(#${p}fr)" stroke-width=".8"/>
  <rect x="9" y="9" width="${f3(BW - 18)}" height="${f3(BH - 18)}" rx="2.3" fill="none" stroke="#f3d27a" stroke-opacity=".38" stroke-width=".27"/>
  <path d="${star(11.9, 11.9, 1.5)}${star(BW - 11.9, 11.9, 1.5)}${star(11.9, BH - 11.9, 1.5)}${star(BW - 11.9, BH - 11.9, 1.5)}" fill="#f6d77e" fill-opacity=".6"/>
  <path d="${star(CX, CY - R - 4.6, 2.1)}${star(CX, CY + R + 4.6, 2.1)}" fill="#f6d77e" fill-opacity=".9"/>
  <circle cx="${f3(CX)}" cy="${f3(CY)}" r="${R}" fill="url(#${p}med)" fill-opacity=".8" stroke="url(#${p}fr)" stroke-width=".8"/>
  <circle cx="${f3(CX)}" cy="${f3(CY)}" r="${R - 1.5}" fill="none" stroke="#f3d27a" stroke-opacity=".38" stroke-width=".27"/>
  ${emb}
  ${label(p, b.label, tw, ly)}
  <g transform="rotate(180 ${f3(CX)} ${f3(CY)})">${label(p, b.label, tw, ly)}</g>
</svg>`;
  }

  // ---------- печатный набор: сколько каких карт в коробке (на партию до maxPlayers игроков) ----------
  // ключи — как у рисунков: e_ владения, c_ двор, f_ фамильные, h_ Дома, v_ вассалы, g_ лорды, s_ сезоны, t_ титулы, p_ провинции
  //   { n — всего; deck — в колоде рынка; start — стартовые копии по Домам; stock — общий запас; each — у каждого игрока }
  function kit() {
    const R = D.RULES, P = R.maxPlayers || 4, out = {};
    for (const id in D.ESTATES) {
      const d = D.ESTATES[id];
      if (d.basic) { out['e_' + id] = { n: (R.basicStock && R.basicStock[id]) || 0, stock: true }; continue; }
      const start = {};
      for (const h in D.HOUSES) for (const x of D.HOUSES[h].estates) if (x === id) start[h] = (start[h] || 0) + 1;
      const deck = d.house ? 0 : (d.copies || 3);
      out['e_' + id] = { n: deck + Object.values(start).reduce((a, b) => a + b, 0), deck, start };
    }
    for (const id in D.COURT) {
      const c = D.COURT[id];
      if (c.start) { out['c_' + id] = { n: R.startTax * P, each: R.startTax }; continue; }
      if (c.sig) { out['f_' + id] = { n: 1, house: houseOfSig(id) }; continue; }
      const start = {};
      for (const h in D.HOUSES) for (const x of D.HOUSES[h].deck) if (x === id) start[h] = (start[h] || 0) + 1;
      const deck = c.copies || 2;
      out['c_' + id] = { n: deck + Object.values(start).reduce((a, b) => a + b, 0), deck, start };
    }
    for (const h in D.HOUSES) out['h_' + h] = { n: 1 };
    for (const b in D.BAN) out['b_' + b] = { n: 1, tier: D.BAN[b].tier, heir: D.BAN[b].heir || null };
    for (const f in D.FAITHS) out['r_' + f] = { n: 1 };
    if (!(D.MODULES.unions || {}).hidden) for (const pv in D.PROV) out['p_' + pv] = { n: 1 };
    if (!(D.MODULES.balance || {}).hidden) { out.r_envy = { n: 1 }; out.r_support = { n: 1 }; }
    for (const r of ['alms', 'lore', 'trade']) out['r_' + r] = { n: P }; // карты значков — по одной каждого вида на игрока
    for (const m of MOD_CARDS) out['m_' + m] = { n: 1 };
    out.aid = { n: 2 * P }; // две памятки на игрока: «Ход / Рынок и знамёна» и «Значки / Словарь»
    return out;
  }

  return { setup, kit, estate, court, house: KINDS.house, ban: KINDS.ban, faith: KINDS.faith, prov: KINDS.prov,
    card: (kind, id, o) => KINDS[kind](id, o), wrap, scope: SCOPE, startTag, CSS, toU, BACKS, back, addBack, FIT, BM, EMB, BW, BH, HOUSE, MOD_CARDS };
});
