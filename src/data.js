// ===================== ДАННЫЕ ИГРЫ «ПРЕТЕНДЕНТЫ» (v2) =====================
const DATA = (() => {
  // пять направлений = пять значков = пять ролей карт двора
  const SYMS = ['trade', 'sci', 'war', 'int', 'faith'];
  const SYM = { trade: '⚖️', sci: '📜', war: '⚔️', int: '🔗', faith: '🕯', gold: '🪙' };
  const SYM_NAME = { trade: 'Весы', sci: 'Свитки', war: 'Мечи', int: 'Связи', faith: 'Свечи', gold: 'Золото' };
  const DIRS = {
    trade: { name: 'Торговля', role: 'merchant', c: '#a8781c' },
    sci: { name: 'Наука', role: 'scholar', c: '#2b5ca3' },
    war: { name: 'Война', role: 'knight', c: '#ab3434' },
    int: { name: 'Интриги', role: 'spy', c: '#683c88' },
    faith: { name: 'Вера', role: 'priest', c: '#1f7a74' },
  };
  const TIERS = { v: { name: 'Вассал', many: 'вассалов' }, l: { name: 'Лорд', many: 'лордов' }, g: { name: 'Великий лорд', many: 'великих лордов' } };

  const RULES = {
    startGold: 3,
    maxPlayers: 4,        // за престол борются 2–4 Дома
    courtCapOff: true,    // разовые карты двора «за каждое …» — без предела
    symIncomeMax: 99,     // «+1🪙 за каждые 2 значка» — без предела
    redIncomeMax: 99,     // «+1🪙 за каждый Набег» — без предела
    startTax: 6,          // карт «Подать» в стартовой колоде
    hand: 3,              // карт в руке
    plotSlots: 2,         // замыслов одновременно
    estateRow: 4,
    courtRow: 4,
    vRow: 4, lRow: 3, gRow: 3,          // открытые ряды вассалов, лордов, великих лордов
    needV: 6, needL: 4, needG: 2,       // цель: 6 вассалов + 4 лорда + 2 великих лорда (без модуля его часть выпадает)
    discCap: { v: 4, l: 6, g: 8 },      // скидка за значки направления: не больше
    supportGap: 2,
    supportGold: 1,
    maxRounds: 70,
    rowRefresh: true,     // ряд (владения, двор, твердыни, знамёна), из которого за круг ничего не взяли, обновляется: крайняя карта — под низ колоды
    extraAction: 10, extraActionNeeds: 'great', // с «Великими лордами»: раз в ход второе действие за 10🪙
    holdRow: 3,           // твердыни: открытый ряд из 3; купили — открывается следующая из колоды твердынь (копий каждой — по числу игроков); у игрока каждый вид — один
    landNeighbor: false,  // 🟦 Земли — в ход любого игрока
    raidNeighbor: false,  // 🟥 Набеги — в ход любого другого игрока
    courtSeats: 2,        // модуль «Придворные»: 2 места + 1 за каждого лорда
    poachHalf: true,      // Вербовщик: переманенный вассал стоит половину напечатанной цены, золото — в банк
    spyCastle: 0.5,       // от шпиона замок защищает вполовину: в счёт идут 🧱4 из родовых 🧱8 (купленные стены — целиком)
    baseWalls: 8, baseGuard: 0,         // родовой замок: защита от осад и от шпионов (v7: 6 — стены больше не продаются всегда, они в колоде владений)
    interestStep: 10,     // проценты (Монетный двор, Ключник): +1🪙 за каждые 10🪙 в казне
    savingsStep: 5,       // сбережения (Заимодавец Якоб): +1🪙 за каждые 5🪙, без потолка
    siegeLoot: 4,         // захватом можно взять владение ценой до 4🪙
    seatGold: 0,          // добавка тем, кто ходит не первым (в короткой партии давала второму слишком много)
    lordUpkeep: 2, greatUpkeepPlus: 2, // содержание: лорд 2🪙 в начале хода, великий — напечатанное + 2🪙
    catchupGap: 1, catchupHireOnly: true, catchupFrom: 6, catchupTier: 'v', catchupOff: 'balance', // догоняющий наём: если в начале круга у лидера 6+ знамён, кто отстаёт — в этом круге может нанять ещё одного вассала; с «Балансом» вместо него Зависть и Поддержка
    unionGold: 3, unionFirst: 2, unionSyms: 2,  // союз: +3🪙 сразу, первый в провинции за столом ещё +2🪙; 2 значка провинции
    faithNeed: 2, faithDir: 2, faithPure: 3, faithInGame: 4, faithStage2: 3, faithStage3: 5, renounceCost: 3, // вера: 🕯🕯 + 2 значка своего направления («чистая» — 🕯🕯🕯); в партии 4 веры; отречение −3🪙
    basicStock: {},       // отдельного запаса «всегда в продаже» больше нет: Пашня, Пекарня и Каменная стена — обычные карты колоды владений
    // значки: у каждого своё правило (⚔️ — нападение, 🔗 — шпионаж и стража)
    tradeStep: 2,         // ⚖️ Торг: каждые 2⚖️ — всё на рынке вам на 1🪙 дешевле
    sciStep: 4,           // 📜 Знания: каждые 4📜 — +1 карта в руку
    faithStep: 2,         // 🕯 Подаяния: каждые 2🕯 — +1🪙 в начале хода
    shiftCost: 2,         // Гадатель при дворе: сдвиг суммы броска на 1 стоит 2🪙
    purgeCost: 2,         // снять проклятие: действие + 2🪙, проклятие замешивается в колоду владений
    plantSpy: 3,          // подбросить проклятие: шпионаж +3🔗 (удача — у соперника, провал — в колоду владений)
    penanceGold: 5, penanceTrash: 2, // покаяние: шаг 1 — 5🪙 самому бедному сопернику, шаг 2 — 2 карты из руки из игры
    wrathBonus: 3, wrathLoot: 6, sinSummon: 7, // Гнев: нападения на грешника +3, сразу — владение до 6🪙; все 7 грехов — призыв до 7 знамён
    spyBuyoff: 3,         // откуп от шпионажа до броска: 3🪙 за каждую 🔗 разницы сил (не меньше 3🪙)
    finishRound: true,    // кто-то собрал цель — круг доигрывается; побеждает тот, у кого цель выполнена в конце круга
  };

  const PROV = {
    N: { name: 'Север', gen: 'Севера', icon: '🏔', union: '⚔️⚔️', sym: 'war' },
    S: { name: 'Юг', gen: 'Юга', icon: '🌾', union: '⚖️⚖️', sym: 'trade' },
    E: { name: 'Восток', gen: 'Востока', icon: '🔮', union: '📜📜', sym: 'sci' },
    W: { name: 'Запад', gen: 'Запада', icon: '🌲', union: '🔗🔗', sym: 'int' },
  };

  const ETYPE = {
    land: { name: 'Земля', mark: '🟦', desc: 'Приносит доход в ход любого игрока' },
    craft: { name: 'Ремесло', mark: '🟩', desc: 'Приносит доход в ваш ход' },
    raid: { name: 'Набег', mark: '🟥', desc: 'Срабатывает в ход другого игрока: забирает золото у того, чей ход' },
    hold: { name: 'Твердыня', mark: '🟪', desc: 'Срабатывает в ваш ход: забирает золото у самого богатого соперника' },
    wall: { name: 'Укрепление', mark: '🧱', desc: 'Не срабатывает от кубика; защищает от нападений, захватить нельзя' },
    bad: { name: 'Проклятие', mark: '⬛', desc: 'Подброшено соперником: вредит, пока лежит. Снять — действие и 2🪙, проклятие уходит в колоду владений' },
  };

  // n — числа кубика, t — тип, inc — доход, per — доход «за каждое…», cost — цена, p — провинция, sym — значок
  const ESTATES = {
    // p — провинция (значок на карте); pair — пара: +N🪙, если у вас есть ещё владение этой же провинции;
    // perProv — «+N🪙 за каждое ваше владение» этой провинции
    field: { name: 'Пашня', n: [1], t: 'land', inc: 1, cost: 1, p: 'S', copies: 3 },
    bakery: { name: 'Пекарня', n: [2, 3, 4], t: 'craft', inc: 1, cost: 1, p: 'S', copies: 3 },
    wall: { name: 'Каменная стена', n: [], t: 'wall', inc: 0, cost: 2, walls: 3, fixed: true, copies: 3 }, // v7: обычная карта колоды владений (модуль «Вражда»)

    // Север 🏔
    pasture: { name: 'Пастбище', n: [2], t: 'land', inc: 1, cost: 1, p: 'N', copies: 3, pair: 1 },
    barracks: { name: 'Лагерь наёмников', n: [4], t: 'raid', inc: 2, cost: 2, p: 'N', sym: 'war', copies: 3 },
    smithy: { name: 'Кузница', n: [8], t: 'craft', per: 'war', perN: 1, cost: 4, p: 'N', sym: 'war', copies: 3 },
    mine: { name: 'Рудник', n: [9], t: 'land', inc: 5, cost: 5, p: 'N', copies: 3 },
    shrine: { name: 'Капище предков', n: [6], t: 'land', inc: 1, cost: 3, p: 'N', sym: 'faith', copies: 3, pair: 2 },
    citadel: { name: 'Цитадель', n: [4], t: 'hold', inc: 2, cost: 6, p: 'N', copies: 4, mods: { raidShield: 1 }, ptext: '🟥 Набеги и 🟪 Твердыни соперников забирают у вас на 1🪙 меньше' },

    // Юг 🌾
    shop: { name: 'Лавка', n: [4], t: 'craft', perProv: 'S', perN: 1, cost: 2, p: 'S', sym: 'trade', copies: 3 },
    harvesttemple: { name: 'Храм урожая', n: [6], t: 'craft', inc: 2, cost: 4, p: 'S', sym: 'faith', copies: 3, pair: 2 },
    outpost: { name: 'Застава', n: [9, 10], t: 'raid', inc: 3, cost: 3, p: 'S', sym: 'war', copies: 3 },
    granary: { name: 'Королевская житница', n: [6], t: 'hold', inc: 2, cost: 6, p: 'S', copies: 4, mods: { blueBonus: 1 }, ptext: 'каждая ваша 🟦 Земля приносит на 1🪙 больше' },

    // Восток 🔮
    runestone: { name: 'Рунный камень', n: [5], t: 'land', inc: 1, cost: 3, p: 'E', sym: 'sci', copies: 3, pair: 1 },
    caravan: { name: 'Постоялый двор', n: [3], t: 'raid', inc: 2, cost: 2, p: 'E', sym: 'int', copies: 3 },
    library: { name: 'Библиотека', n: [3], t: 'craft', per: 'sci', perN: 1, cost: 2, p: 'E', sym: 'sci', copies: 3 },
    chancery: { name: 'Королевская канцелярия', n: [3], t: 'hold', inc: 1, cost: 8, p: 'E', copies: 4, mods: { regCheap: 1 }, ptext: 'каждое знамя вам на 1🪙 дешевле' },

    // Запад 🌲
    orchard: { name: 'Яблоневый сад', n: [10], t: 'land', inc: 3, cost: 3, p: 'W', copies: 3, pair: 2 },
    den: { name: 'Притон', n: [10], t: 'raid', inc: 3, cost: 3, p: 'W', sym: 'int', copies: 3 },
    port: { name: 'Пристань контрабандистов', n: [11, 12], t: 'raid', inc: 3, cost: 4, p: 'W', sym: 'trade', copies: 3 },
    thieves: { name: 'Гильдия воров', n: [5], t: 'hold', inc: 2, cost: 7, p: 'W', copies: 4, mods: { redBonus: 1 }, ptext: 'ваши 🟥 Набеги забирают на 1🪙 больше' },
    embassy: { name: 'Посольство', n: [1, 2], t: 'hold', inc: 1, cost: 6, p: 'W', copies: 4, mods: { courtCheap: 1 }, ptext: 'карты двора вам на 1🪙 дешевле' },

    // проклятия (v10.14): беды-владения действуют всегда, пока лежат у того, кому их подбросили (кубик не нужен).
    // Купили на рынке владений — сразу подбросьте сопернику: шпионаж +3🔗. Удача — проклятие у него на столе, провал — замешайте в колоду владений.
    // Снять — в свой ход после броска: действие и 2🪙, проклятие уходит в колоду владений. Сколько проклятий на игроке — не ограничено.
    // bad — ключ эффекта в движке, badText — что делает (для журнала и подсказок)
    falsetax: { name: 'Самозваный мытарь', n: [], t: 'bad', bad: 'tax', inc: 0, cost: 2, copies: 1, badText: 'Доход его 🟩 Ремёсел получает тот, кто подбросил.' },
    blight: { name: 'Неурожай', n: [], t: 'bad', bad: 'blight', inc: 0, cost: 2, copies: 1, badText: 'Его 🟦 Земли не приносят дохода.' },
    plaguehouse: { name: 'Чумная слобода', n: [], t: 'bad', bad: 'quarantine', inc: 0, cost: 2, copies: 1, badText: 'Он не покупает владения.' },
    banditpost: { name: 'Разбойничий стан', n: [], t: 'bad', bad: 'bandits', inc: 0, cost: 2, copies: 1, badText: 'Его 🟥 Набеги и 🟪 Твердыни не срабатывают.' },
    ashes: { name: 'Пепелище', n: [], t: 'bad', bad: 'walls', walls: -2, inc: 0, cost: 2, copies: 1, badText: 'Его 🧱 Стены слабее на 2.' },
    evileye: { name: 'Сглаз', n: [], t: 'bad', bad: 'evileye', inc: 0, cost: 2, copies: 1, badText: 'Он бросает только один кубик.' },
    cursedrelic: { name: 'Проклятая реликвия', n: [], t: 'bad', bad: 'relic', inc: 0, cost: 2, copies: 1, badText: 'Его вера не действует: ни ступени, ни обряд, ни карты веры.' },
    schemer: { name: 'Заговор', n: [], t: 'bad', bad: 'schemer', inc: 0, cost: 2, copies: 1, badText: 'Он не нанимает знамёна.' },

    // стартовые владения Домов: по три у каждого (вместо Пашни и Пекарни), в колоду рынка не входят
    vineyard: { name: 'Виноградник', n: [1], t: 'land', inc: 1, cost: 1, p: 'S', house: 'deer' },
    exchange: { name: 'Меняльная контора', n: [2, 3], t: 'craft', per: 'trade', perN: 1, cost: 2, p: 'S', house: 'deer' },
    fairsquare: { name: 'Ярмарочная площадь', n: [4, 5], t: 'craft', inc: 2, cost: 3, p: 'S', sym: 'trade', walls: 2, house: 'deer' },
    herbgarden: { name: 'Аптекарский огород', n: [1], t: 'land', inc: 1, cost: 1, p: 'E', house: 'owl' },
    scriptorium: { name: 'Скрипторий', n: [2, 3], t: 'craft', per: 'sci', perN: 1, cost: 2, p: 'E', house: 'owl' },
    observatory: { name: 'Звездочётная башня', n: [3, 4], t: 'craft', inc: 2, cost: 3, p: 'E', sym: 'sci', walls: 2, house: 'owl' },
    huntground: { name: 'Охотничьи угодья', n: [1], t: 'land', inc: 1, cost: 1, p: 'N', house: 'wolf' },
    armory: { name: 'Оружейная', n: [2, 3], t: 'craft', per: 'war', perN: 1, cost: 2, p: 'N', house: 'wolf' },
    wolfden: { name: 'Волчье логово', n: [4], t: 'raid', inc: 2, cost: 3, p: 'N', sym: 'war', house: 'wolf' },
    fishvillage: { name: 'Рыбацкая деревня', n: [1], t: 'land', inc: 1, cost: 1, p: 'W', house: 'serpent' },
    privateer: { name: 'Верфь', n: [2, 3], t: 'craft', per: 'raid', perN: 1, cost: 2, p: 'W', house: 'serpent' },
    piratecove: { name: 'Пиратская бухта', n: [5, 6], t: 'raid', inc: 1, cost: 3, p: 'S', sym: 'war', house: 'serpent' },
    apiary: { name: 'Пасека', n: [1], t: 'land', inc: 1, cost: 1, p: 'W', house: 'bear' },
    meadery: { name: 'Ягодная поляна', n: [2, 3], t: 'land', inc: 1, cost: 2, p: 'W', house: 'bear' },
    sacredgrove: { name: 'Священная роща', n: [6], t: 'land', inc: 1, cost: 3, p: 'W', house: 'bear' },
    royalgarden: { name: 'Королевский сад', n: [1], t: 'land', inc: 1, cost: 1, p: 'S', house: 'lion' },
    palacekitchen: { name: 'Дворцовая кухня', n: [2, 3], t: 'craft', inc: 1, cost: 2, p: 'S', pair: 1, house: 'lion' },
    throneroom: { name: 'Тронный зал', n: [5, 6], t: 'craft', inc: 2, cost: 3, p: 'S', sym: 'trade', walls: 2, house: 'lion' },
  };

  const ROLES = {
    merchant: { name: 'Купец', icon: '🪙' },
    scholar: { name: 'Учёный', icon: '📜' },
    knight: { name: 'Рыцарь', icon: '⚔️' },
    spy: { name: 'Шпион', icon: '🔗' },
    priest: { name: 'Жрец', icon: '🕯' },
  };

  // fx — обычный эффект, ally — «Свита» (если в этот ход уже сыграна карта той же роли),
  // plot — тип замысла ('timed' ⏳ / 'dice' 🎲), pfx — усиленный эффект замысла
  const COURT = {
    tax: { name: 'Подать', role: null, cost: 0, start: true, fx: [['gold', 1]] },
    herald: { name: 'Вестник', role: null, cost: 1, fx: [['draw', 2], ['gold', 1]], plot: 'dice', pn: [2, 12], pfx: [['draw', 3]] },

    // свита Сборщика — Подати: сыграли до него хоть одну «Подать» — +2🪙 за каждую
    collector: { name: 'Сборщик податей', role: 'merchant', cost: 2, fx: [['gold', 1]], ally: [['perPlayed', 'tax', 1]], allyBy: 'tax', plot: 'timed', pfx: [['gold', 5]] },
    spicer: { name: 'Торговец пряностями', role: 'merchant', cost: 2, fx: [['gold', 2], ['draw', 1]], ally: [['gold', 2]], plot: 'dice', pn: [4, 7], pfx: [['gold', 6]] },
    guildmaster: { name: 'Старшина гильдии', role: 'merchant', cost: 7, fx: [['buys', 1], ['discount', 2]], ally: [['gold', 2]] },

    scribe: { name: 'Писарь', role: 'scholar', cost: 1, fx: [['draw', 1], ['gold', 1]], ally: [['draw', 1]], plot: 'timed', pfx: [['draw', 3]] },
    archivist: { name: 'Хранитель свитков', role: 'scholar', cost: 3, fx: [['draw', 1], ['gold', 2]], ally: [['draw', 1]], plot: 'timed', pfx: [['draw', 3]] },
    inventor: { name: 'Зодчий', role: 'scholar', cost: 4, fx: [['regDiscount', 4]], ally: [['gold', 2]], plot: 'timed', pfx: [['regDiscount', 6]] },

    sappers: { name: 'Подкопщики', role: 'knight', cost: 2, fx: [['siege', 2]], plot: 'dice', pn: [3, 10], pfx: [['ambush', 4]], ally: [['gold', 2]] },
    siegeband: { name: 'Осадный отряд', role: 'knight', cost: 4, fx: [['siege', 3]], plot: 'timed', pfx: [['siege', 5]], ally: [['draw', 1]] },

    blackmailer: { name: 'Вымогатель', role: 'spy', cost: 5, fx: [['spy', 3, 'estate', 4]], plot: 'timed', pfx: [['spy', 5, 'estate', 6]], ally: [['gold', 2]] },

    // ---------- Осадные орудия: Разрушение — владение соперника уходит из игры навсегда ----------
    ram: { name: 'Таран', role: 'knight', cost: 3, fx: [['raze', 2, 3, 'wall']], ally: [['gold', 2]], plot: 'dice', pn: [4, 10], pfx: [['raze', 3, 3]] },
    trebuchet: { name: 'Требушет', role: 'knight', cost: 6, fx: [['raze', 4, 99]], plot: 'timed', pfx: [['raze', 6, 99]], copies: 1 },

    // ---------- новые шпионы ----------
    recruiter: { name: 'Вербовщик', role: 'spy', cost: 5, fx: [['spy', 5, 'poach', 1]], copies: 2, ally: [['draw', 1]], plot: 'timed', pfx: [['spy', 5, 'steal', 4]] },
    courtesan: { name: 'Куртизанка', role: 'spy', cost: 3, fx: [['spy', 4, 'lock', 1]], ally: [['gold', 2]], copies: 2 },
    agitator: { name: 'Смутьян', role: 'spy', cost: 3, fx: [['spy', 4, 'tax', 1]], ally: [['draw', 1]], copies: 2 },

    // ---------- козни (v10.14): разовая пакость сопернику. Сыграли — шпионаж +3🔗: удача — вред сразу.
    // Удача или провал — карта уходит в колоду двора (scheme). Модуль «Шпионаж»
    arson: { name: 'Поджог', role: null, cost: 1, scheme: true, fx: [['spy', 3, 'arson', 4]] },
    denounce: { name: 'Донос', role: null, cost: 2, scheme: true, fx: [['spy', 3, 'denounce', 2]] },
    slander: { name: 'Клевета', role: null, cost: 1, scheme: true, fx: [['spy', 3, 'slander', 1]] },
    poisonfeast: { name: 'Отравленный пир', role: null, cost: 2, scheme: true, fx: [['spy', 3, 'feast', 2]] },

    // ---------- грехи (v10.15, модуль «Вера»): 7 карт двора, по одной. На рынке 0🪙, купить — только действием.
    // Купили — грех ложится перед игроком (p.sins): «Сейчас» (now) срабатывает тут же, «До конца игры» (pen) действует, пока грех лежит.
    // Снять — только покаянием. Все семь у одного игрока — призыв: до 7 знамён из рядов бесплатно и без действия, один раз за партию
    sin_pride: { name: 'Гордыня', role: null, cost: 0, sin: 'pride', copies: 1, fx: [], now: 'наймите любого вассала или лорда из ряда — бесплатно и без траты действия', pen: 'в начале хода платите 1🪙 за каждое своё знамя' },
    sin_greed: { name: 'Алчность', role: null, cost: 0, sin: 'greed', copies: 1, fx: [], now: 'удвойте своё золото', pen: 'в начале хода отдавайте в банк 1🪙 за каждые 5🪙 в казне' },
    sin_wrath: { name: 'Гнев', role: null, cost: 0, sin: 'wrath', copies: 1, fx: [], now: 'заберите владение соперника до 6🪙 — без нападения, отбить нельзя; оно в руинах', pen: 'нападения и шпионаж против вас +3; перемирие на вас не действует' },
    sin_envy: { name: 'Зависть', role: null, cost: 0, sin: 'envy', copies: 1, fx: [], now: 'заберите у лидера одно знамя — любое, даже великого лорда — оно ваше', pen: 'соперник нанял знамя — вы отдаёте 1🪙 в банк; догоняющего найма у вас нет' },
    sin_gluttony: { name: 'Чревоугодие', role: null, cost: 0, sin: 'gluttony', copies: 1, fx: [], now: 'возьмите 5 карт', pen: 'в руке на 1 карту меньше' },
    sin_sloth: { name: 'Лень', role: null, cost: 0, sin: 'sloth', copies: 1, fx: [], now: 'после этого хода сделайте ещё один — полный: начало хода, карты, бросок, действия. Дубль в нём даёт ещё ход', pen: 'бросайте только один кубик' },
    sin_lust: { name: 'Похоть', role: null, cost: 0, sin: 'lust', copies: 1, fx: [], now: 'переманите придворного соперника к своему двору', pen: 'в начале хода бросьте кубик: на 1–2 ваш придворный на выбор уходит в сброс' },
    // Покаяние — карта правил веры (rule: на рынок не идёт). Начать — в свой ход до броска; 4 хода подряд, по шагу
    penance: { name: 'Покаяние', role: null, cost: 0, rule: true, fx: [], steps: ['Отдайте 5🪙 самому бедному сопернику.', 'Уберите из игры 2 карты из руки.', 'В этот ход у вас на одно действие меньше.', 'Уберите из игры одно своё владение.'], result: 'Один ваш грех на выбор снят — он уходит в колоду двора.' },

    // ---------- Жрецы (направление «Вера»): Реликварий на рынке; карты вер — ниже ----------
    reliquary: { name: 'Реликварий', role: 'priest', cost: 4, fx: [['goldPerSym', 'faith', 1, 99]], plot: 'timed', pfx: [['goldPerSym', 'faith', 2, 99]] },
    // ---------- карты вер: по 2 у каждой веры, на рынок не идут — их кладёт себе в сброс тот, кто первым принял веру ----------
    reaper: { name: 'Жница', role: 'priest', cost: 0, faith: 'grain', copies: 1, fx: [['goldPerLand', 1]] },
    miller: { name: 'Мельник', role: 'priest', cost: 0, faith: 'grain', copies: 1, fx: [['gold', 1], ['draw', 1]] },
    breadgiver: { name: 'Хлебодар', role: 'priest', cost: 0, faith: 'harvest', copies: 1, fx: [['goldPerCraft', 1]] },
    fortune: { name: 'Гадалка', role: 'priest', cost: 0, faith: 'seer', copies: 1, fx: [['draw', 2]] },
    dream: { name: 'Вещий сон', role: 'priest', cost: 0, faith: 'seer', copies: 1, fx: [['reroll', 1], ['gold', 2]] },
    strada: { name: 'Страда', role: 'priest', cost: 0, faith: 'harvest', copies: 1, fx: [['fire', 'craft']] },
    copyist: { name: 'Переписчик', role: 'priest', cost: 0, faith: 'star', copies: 1, fx: [['draw', 1], ['gold', 2]], ally: [['draw', 1]] },
    magister: { name: 'Магистр', role: 'priest', cost: 0, faith: 'star', copies: 1, fx: [['regDiscount', 4], ['draw', 1]] },
    wake: { name: 'Огненная тризна', role: 'priest', cost: 0, faith: 'flame', copies: 1, fx: [['goldPerRaid', 1]], ally: [['gold', 2]] },
    forge: { name: 'Горн предков', role: 'priest', cost: 0, faith: 'flame', copies: 1, fx: [['goldPerSym', 'war', 1, 99]] },
    orderbanner: { name: 'Знамя ордена', role: 'priest', cost: 0, faith: 'blade', copies: 1, fx: [['goldPerBanner', 1]] },
    ordershield: { name: 'Щит ордена', role: 'priest', cost: 0, faith: 'blade', copies: 1, fx: [['shield'], ['draw', 1]] },
    doublegame: { name: 'Двойная игра', role: 'priest', cost: 0, faith: 'shade', copies: 1, fx: [['echo']] },
    intercept: { name: 'Перехват', role: 'priest', cost: 0, faith: 'shade', copies: 1, fx: [['snatch']] },
    relics: { name: 'Святые мощи', role: 'priest', cost: 0, faith: 'cathedral', copies: 1, fx: [['fetchOne'], ['gold', 1]] },
    procession: { name: 'Крестный ход', role: 'priest', cost: 0, faith: 'cathedral', copies: 1, fx: [['fire', 'land']] },

    // ---------- модуль «Придворные»: карту с блоком «При дворе» можно не сыграть, а посадить на место при дворе ----------
    // seat — постоянное свойство, пока карта сидит при дворе: { mods, prod }; stext — то же словами
    fairwarden: { name: 'Ярмарочный староста', role: 'merchant', cost: 3, fx: [['gold', 2], ['draw', 1]], seat: { mods: { marketDiscount: 1 } }, stext: 'Рынок вам на 1🪙 дешевле.' },
    dreamer: { name: 'Толкователь снов', role: 'scholar', cost: 4, fx: [['reroll', 1], ['gold', 2]], seat: { mods: { dreamPeek: 2 } }, stext: 'Вещий сон: в начале хода посмотрите 2 верхние карты своей колоды — каждую оставьте сверху или положите под низ.' },
    astrologer: { name: 'Звездочёт', role: 'scholar', cost: 5, fx: [['reroll', 1], ['gold', 2]], seat: { mods: { extraTurn: 1 } }, stext: 'Выпал дубль на двух кубиках — сделайте ещё один ход.' },
    chronicler: { name: 'Летописец', role: 'scholar', cost: 4, fx: [['draw', 1], ['regDiscount', 2]], ally: [['draw', 1]], plot: 'timed', pfx: [['draw', 3]], seat: { mods: { fetch: 1 } }, stext: 'Раз в ход возьмите карту из своего сброса в руку — даже сыгранную в этот ход.' },

    // v9: ещё 8 придворных (по одной копии) — у каждого своё постоянное свойство
    chamberlain: { name: 'Камергер', role: 'merchant', cost: 4, fx: [['gold', 2], ['draw', 1]], copies: 1, seat: { mods: { seatSlots: 1 } }, stext: 'Ещё одно место при дворе: Камергер садится, никого не сгоняя.' },
    revels: { name: 'Церемониймейстер', role: 'merchant', cost: 5, fx: [['gold', 1], ['draw', 1]], copies: 1, seat: { mods: { seatIncome: 1 } }, stext: 'В начале хода +1🪙 за каждого другого вашего придворного.' },
    augur: { name: 'Гадатель', role: 'scholar', cost: 5, fx: [['reroll', 1], ['gold', 1]], copies: 1, seat: { mods: { shift: 1 } }, stext: 'Раз в ход после броска: заплатите 2🪙 — и выпавшая сумма станет на 1 больше или меньше.' },
    gatekeeper: { name: 'Привратник', role: 'knight', cost: 4, fx: [['gold', 2]], ally: [['gold', 1]], copies: 1, seat: { mods: { buyToll: 1 } }, stext: 'Соперник что-то купил на рынке — вам +1🪙 из банка.' },
    huntsman: { name: 'Ловчий', role: 'knight', cost: 4, fx: [['goldPerRaid', 1], ['gold', 1]], ally: [['draw', 1]], copies: 1, seat: { mods: { redBonus: 1 } }, stext: 'Каждый ваш 🟥 Набег забирает на 1🪙 больше.' },
    cupbearer: { name: 'Кравчий', role: 'merchant', cost: 4, fx: [['goldPerLand', 1]], ally: [['gold', 2]], copies: 1, seat: { mods: { blueBonus: 1 } }, stext: 'Каждая ваша 🟦 Земля приносит на 1🪙 больше.' },
    confessor: { name: 'Духовник', role: 'priest', cost: 4, fx: [['goldPerSym', 'faith', 1, 99], ['gold', 1]], copies: 1, seat: { prod: { faith: 1 } }, stext: 'Даёт значок 🕯, пока сидит при дворе.' },
    gossip: { name: 'Сплетница', role: 'spy', cost: 4, fx: [['gold', 1], ['draw', 1]], copies: 1, seat: { mods: { oppRegGold: 1 } }, stext: 'Соперник нанял знамя — вам +1🪙 из банка.' },

    // Фамильные придворные (модуль «Придворные»): по два у каждого Дома. Первый (HOUSES.courtier) в начале партии сидит при дворе,
    // второй (HOUSES.courtier2) лежит в стартовой колоде — его можно сыграть или посадить
    seneschal: { name: 'Сенешаль', role: 'merchant', cost: 0, sig: true, fam: 'deer', fx: [['gold', 2]], seat: { mods: { startGold: 1 } }, stext: '+1🪙 в начале хода.' },
    bookman: { name: 'Книжник', role: 'scholar', cost: 0, sig: true, fam: 'owl', fx: [['draw', 1], ['gold', 1]], seat: { mods: { startGold: 6 } }, stext: '+6🪙 в начале хода.' },
    armsmaster: { name: 'Оружничий', role: 'knight', cost: 0, sig: true, fam: 'wolf', fx: [['gold', 1]], seat: { mods: { walls: 2 } }, stext: '🧱 Стены +2.' },
    boatswain: { name: 'Кормчий', role: 'knight', cost: 0, sig: true, fam: 'serpent', fx: [['gold', 2]], seat: { mods: { startGold: 1 } }, stext: '+1🪙 в начале хода.' },
    forester: { name: 'Лесничий', role: 'knight', cost: 0, sig: true, fam: 'bear', fx: [['gold', 1], ['draw', 1]], seat: { mods: { startGold: 1 } }, stext: '+1🪙 в начале хода.' },
    steward: { name: 'Гофмейстер', role: 'merchant', cost: 0, sig: true, fam: 'lion', fx: [['draw', 1], ['gold', 1]], seat: { mods: { courtCheap: 1, startGold: 6 } }, stext: 'Карты двора на рынке вам на 1🪙 дешевле. +6🪙 в начале хода.' },

    // Фамильные карты Домов (только в стартовой колоде)
    goldhorn: { name: 'Золотой рог', role: 'merchant', cost: 0, sig: true, fx: [['buys', 1]] },
    owlsight: { name: 'Совиный взгляд', role: 'scholar', cost: 0, sig: true, fx: [['draw', 2]], plot: 'dice', pn: [3, 11], pfx: [['gold', 5]] },
    wolfpack: { name: 'Волчья стая', role: 'knight', cost: 0, sig: true, fx: [['siege', 2]], plot: 'timed', pfx: [['siege', 4]] },
    boarding: { name: 'Абордаж', role: 'knight', cost: 0, sig: true, fx: [['goldPerRaid', 1], ['gold', 1]], plot: 'timed', pfx: [['gold', 4]] },
    bearhoard: { name: 'Медвежий запас', role: 'merchant', cost: 0, sig: true, fx: [['goldPerLand', 1], ['gold', 1]], ally: [['gold', 2]], plot: 'timed', pfx: [['goldPerLand', 1], ['gold', 2]] },
    lionroar: { name: 'Львиный рык', role: 'merchant', cost: 0, sig: true, fx: [['draw', 1]], ally: [['gold', 2]] },
  };

  // ---------- Дома ----------
  // dir — родное направление (планшет даёт 1 его значок); faith — вера Дома (её можно принять, имея на 1🕯 меньше);
  // estates — три стартовых владения Дома (Пашни и Пекарни на старте больше нет); heir — Наследник Дома (личный лорд); gold — добавка к стартовому золоту
  const HOUSES = {
    deer: {
      name: 'Дом Оленя', short: 'Олени', gen: 'Оленей', dat: 'Оленям', sigil: '🦌', path: 'Торговля', dir: 'trade',
      about: 'Купцы и землевладельцы Юга. Герб — золотой олень.',
      ability: 'Купцы: всё на рынке вам на 1🪙 дешевле.',
      mods: { marketDiscount: 1 }, gold: 3,
      deck: ['collector', 'scribe', 'goldhorn'], estates: ['vineyard', 'exchange', 'fairsquare'], heir: 'heir_deer', courtier: 'seneschal',
    },
    owl: {
      name: 'Дом Совы', short: 'Совы', gen: 'Сов', dat: 'Совам', sigil: '🦉', path: 'Наука', dir: 'sci',
      about: 'Учёные Востока: архивы, звездочёты, расчёт. Герб — сова.',
      ability: 'Раз в ход можно перебросить кубики.',
      mods: { reroll: 1 }, gold: 1,
      deck: ['collector', 'scribe', 'owlsight'], estates: ['herbgarden', 'scriptorium', 'observatory'], heir: 'heir_owl', courtier: 'bookman',
    },
    wolf: {
      name: 'Дом Волка', short: 'Волки', gen: 'Волков', dat: 'Волкам', sigil: '🐺', path: 'Война', dir: 'war',
      about: 'Северные лорды, живут войной. Герб — волк.',
      ability: 'Каждое ваше нападение +2⚔️.',
      mods: { siege: 2 }, gold: 0,
      deck: ['collector', 'collector', 'wolfpack'], estates: ['huntground', 'armory', 'wolfden'], heir: 'heir_wolf', courtier: 'armsmaster',
    },
    serpent: {
      name: 'Дом Змея', short: 'Змеи', gen: 'Змей', dat: 'Змеям', sigil: '🐍', path: 'Война и море', dir: 'war',
      about: 'Мореходы побережья: торгуют, а при случае грабят. Герб — морской змей.',
      ability: '🟥 Набеги забирают +1🪙 и срабатывают и в ваш ход (золото из банка).',
      mods: { redBonus: 1, redOwn: 1 }, gold: 7,
      deck: ['collector', 'collector', 'boarding'], estates: ['fishvillage', 'privateer', 'piratecove'], heir: 'heir_serpent', courtier: 'boatswain',
    },
    bear: {
      name: 'Дом Медведя', short: 'Медведи', gen: 'Медведей', dat: 'Медведям', sigil: '🐻', path: 'Земли и старые боги', dir: 'faith',
      about: 'Лесные бароны Севера: пашни, пасеки, священные рощи. Герб — бурый медведь.',
      ability: '🟦 Земли приносят вам +1🪙.',
      mods: { blueBonus: 1 }, gold: 2,
      deck: ['collector', 'collector', 'bearhoard'], estates: ['apiary', 'meadery', 'sacredgrove'], heir: 'heir_bear', courtier: 'forester',
    },
    lion: {
      name: 'Дом Льва', short: 'Львы', gen: 'Львов', dat: 'Львам', sigil: '🦁', path: 'Двор', dir: 'trade',
      about: 'Столичная знать: приёмы, посольства, большой двор. Герб — золотой лев.',
      ability: 'Купленная карта двора сразу идёт в руку — её можно сыграть в тот же ход.',
      mods: { courtToHand: 1 }, gold: 5,
      deck: ['collector', 'scribe', 'lionroar'], estates: ['royalgarden', 'palacekitchen', 'throneroom'], heir: 'heir_lion', courtier: 'steward',
    },
  };

  // ---------- Знамёна: вассалы (v), лорды (l), великие лорды (g) ----------
  // dir — направление: знамя даёт 1 его значок; значки направления дают скидку при найме (до TIERS[tier].cap).
  // prod — значки сверх этого; mods — свойства; tax — надбавка: пока знамя у вас, ваши следующие знамёна дороже ({v, l, g});
  // upkeep — содержание великого лорда (в начале хода); take — разово при найме; heir — Наследник этого Дома; needs — нужен модуль
  const BAN = {};
  const ban = (tier, dir, id, name, title, cost, mods, text, o = {}) => {
    BAN[id] = { id, tier, dir, name, title, cost, mods: mods || {}, text, prod: o.prod || {}, tax: null, upkeep: tier === 'l' ? RULES.lordUpkeep : tier === 'g' ? Math.max(4, (o.upkeep || 0) + RULES.greatUpkeepPlus) : (o.upkeep || 0), take: o.take || null, heir: o.heir || null, needs: o.needs || null };
  };
  // вассалы — помогают зарабатывать на владениях и картах двора: по 5 на направление без модулей (25 ≥ 6 × 4 игрока — хватает всем)
  // ⚖️ Торговля — доход с владений и рынка (Олени, Львы)
  ban('v', 'trade', 'fuller', 'Агнесса Фуллер', 'староста ремесленников', 10, { greenBonus: 1 }, '🟩 Ремёсла приносят +1🪙.');
  ban('v', 'trade', 'grain', 'Сэр Освальд Грейн', 'землевладелец', 12, { blueBonus: 1 }, '🟦 Земли приносят +1🪙.');
  ban('v', 'trade', 'baltazar', 'Бальтазар Монетный', 'королевский поставщик', 15, { marketDiscount: 1 }, 'Всё на рынке вам на 1🪙 дешевле.');
  ban('v', 'trade', 'cornelia', 'Корнелия Пышная', 'хранительница казны', 18, { startGold: 2 }, '+2🪙 в начале хода.');
  ban('v', 'trade', 'frida', 'Фрида Шёлковая', 'торговка тканями', 14, { craftIncome: 1 }, 'В начале хода +1🪙 за каждые 2 ваших 🟩 Ремесла.');
  // 📜 Наука — карты и кубики (Совы)
  ban('v', 'sci', 'ida', 'Сестра Ида', 'библиотекарь', 10, { provBonus_E: 1 }, 'Ваши владения Востока приносят +1🪙.');
  ban('v', 'sci', 'magnus', 'Магнус Стерн', 'астроном', 15, { reroll: 1 }, 'Раз в ход можно перебросить кубики.');
  ban('v', 'sci', 'tobias', 'Слепой Тобиас', 'провидец', 15, { peek: 1 }, 'Добросок: бросьте один кубик и, увидев его, решите, бросать ли второй.');
  ban('v', 'sci', 'ilanna', 'Иланна', 'хранительница архива', 20, { hand: 1 }, '+1 карта в руку.');
  ban('v', 'sci', 'orvin', 'Орвин', 'знаток жребия', 13, { lowRollGold: 3 }, 'Выпала 1 на кубике — +3🪙.');
  // ⚔️ Война — набеги, дань и нападения (Волки, Змеи)
  ban('v', 'war', 'gunnar', 'Гуннар Хольт', 'оружейник', 10, { provBonus_N: 1 }, 'Ваши владения Севера приносят +1🪙.');
  ban('v', 'war', 'brand', 'Бранд Каменный', 'кастелян', 10, { walls: 3 }, '🧱 Стены +3.', { needs: 'sieges' });
  ban('v', 'war', 'eirik', 'Эйрик Быстрый', 'предводитель конницы', 12, { redBonus: 1 }, '🟥 Набеги забирают +1🪙.');
  ban('v', 'war', 'halvdan', 'Бьорн Секира', 'вожак набегов', 14, { raidSym: 1 }, 'Каждый ваш 🟥 Набег даёт +1⚔️.');
  ban('v', 'war', 'olaf', 'Олаф Щитоносец', 'начальник стражи', 12, { raidShield: 2 }, 'Чужие 🟥 Набеги и 🟪 Твердыни забирают у вас на 2🪙 меньше.');
  ban('v', 'war', 'vigo', 'Вигго Следопыт', 'вожак разъездов', 13, { raidDraw: 1 }, 'Сработал ваш 🟥 Набег — возьмите карту.');
  // 🔗 Интриги — золото из чужих рук
  ban('v', 'int', 'sabina', 'Госпожа Сабина', 'хозяйка соглядатаев', 10, { provBonus_W: 1 }, 'Ваши владения Запада приносят +1🪙.');
  ban('v', 'int', 'belladonna', 'Леди Белладонна', 'отравительница', 13, { buyToll: 1 }, 'Соперник купил что-то на рынке — вам +1🪙.');
  ban('v', 'int', 'quentin', 'Квентин', 'мастер тайных дел', 15, { spy: 2 }, 'Каждый ваш шпионаж +2🔗.', { needs: 'spy' });
  ban('v', 'int', 'isabeau', 'Мадам Изабо', 'хозяйка пиров', 19, { tithe: 1 }, 'Десятина: в начале хода возьмите 1🪙 у самого богатого соперника.');
  ban('v', 'int', 'rosalinda', 'Розалинда', 'тайная посланница', 14, { oppRegGold: 1 }, 'Соперник нанял знамя — вам +1🪙.');
  ban('v', 'int', 'ferran', 'Ферран Златоуст', 'придворный ходатай', 12, { courtCheap: 2 }, 'Карты двора на рынке вам на 2🪙 дешевле.');
  // 🕯 Вера — свечи, Отставка и вера (Медведи)
  ban('v', 'faith', 'emmerich', 'Брат Эммерих', 'паломник', 10, { provBonus_S: 1 }, 'Ваши владения Юга приносят +1🪙.');
  ban('v', 'faith', 'agatha', 'Мать Агата', 'настоятельница', 12, { retireGold: 2 }, 'Отставка приносит +2🪙.');
  ban('v', 'faith', 'tit', 'Тит', 'странствующий проповедник', 13, { riteTwice: 1 }, 'Обряд вашей веры можно провести дважды за ход.', { needs: 'faith' });
  ban('v', 'faith', 'hilda', 'Сестра Хильда', 'лекарка', 14, { retireDraw: 1 }, 'Отставка: возьмите 2 карты вместо 1.');
  ban('v', 'faith', 'mirra', 'Сестра Мирра', 'хозяйка богадельни', 14, { landOthers: 2 }, '🟦 Земли в чужой ход приносят +2🪙.');
  ban('v', 'faith', 'benedikt', 'Отец Бенедикт', 'хранитель дорог', 16, { provIncome: 1 }, 'В начале хода +1🪙 за каждую провинцию, где у вас есть владения.');

  // лорды — меняют правила лично для вас; каждый даёт +1 место при дворе. По 3 на направление без модулей
  // (15 = 4 × 3 соперника + 3: даже если соперники наняли по 4 лорда из ряда, вам хватит трёх к Наследнику)
  ban('l', 'trade', 'martin', 'Мартин Скупой', 'ключник короля', 23, { freeCourtBuy: 1 }, 'Ярмарка: раз в ход карту двора можно купить, не тратя действие.');
  ban('l', 'trade', 'leopold', 'Леопольд Миротворец', 'королевский посол', 22, { regCheap: 2 }, 'Каждое знамя вам на 2🪙 дешевле.');
  ban('l', 'trade', 'hugo', 'Гуго Неутомимый', 'мастер гильдий', 30, { buys: 1 }, '+1 действие каждый ход.');

  ban('l', 'sci', 'anselm', 'Ансельм Мудрый', 'королевский летописец', 27, { hand: 1 }, '+1 карта в руку.');
  ban('l', 'sci', 'alberich', 'Альберих Чародей', 'придворный маг', 26, { advantage: 1 }, 'Бросайте кубики дважды и оставляйте лучший бросок.');
  ban('l', 'sci', 'albin', 'Альбин Провидец', 'королевский астролог', 23, { plotSlots: 1, plotGold: 2 }, '+1 место для замысла. Сработавший замысел даёт ещё +2🪙.', { needs: 'plots' });
  ban('l', 'sci', 'theodor', 'Теодор Учёный', 'наместник Востока', 24, { provBonus_E: 2 }, 'Ваши владения Востока приносят +2🪙.');

  ban('l', 'war', 'gottfried', 'Готфрид Грозный', 'лорд-командующий', 25, { siege: 2, lootPlus: 2 }, 'Каждое ваше нападение +2⚔️, и захватом можно взять владение до 6🪙.', { needs: 'sieges' });
  ban('l', 'war', 'bertrand', 'Бертран Рыжий', 'капитан наёмников', 23, { redBonus: 2 }, '🟥 Набеги забирают +2🪙.');
  ban('l', 'war', 'robert', 'Робер Лесной', 'хранитель лесов', 22, { freeRaidBuy: 1 }, 'Ярмарка: раз в ход 🟥 Набег можно купить, не тратя действие.');
  ban('l', 'war', 'hagen', 'Хаген Железнобокий', 'наместник Севера', 24, { provBonus_N: 2 }, 'Ваши владения Севера приносят +2🪙.');

  ban('l', 'int', 'maurice', 'Морис Тихий', 'глава тайной стражи', 25, { spy: 2, spyWinGold: 2 }, 'Каждый ваш шпионаж +2🔗. Удачный шпионаж — ещё +2🪙.', { needs: 'spy' });
  ban('l', 'int', 'isolde', 'Изольда Властная', 'вдовствующая королева', 24, { buyToll: 2 }, 'Соперник купил что-то на рынке — вам +2🪙.');
  ban('l', 'int', 'guillaume', 'Гильом Двуличный', 'королевский дознаватель', 24, { oppRegGold: 3 }, 'Соперник нанял знамя — вам +3🪙.');
  ban('l', 'int', 'rowena', 'Леди Ровена', 'наместница Запада', 24, { provBonus_W: 2 }, 'Ваши владения Запада приносят +2🪙.');

  ban('l', 'faith', 'irmina', 'Мать Ирмина', 'настоятельница аббатства', 23, { candleGold: 1 }, 'В начале хода +1🪙 за каждую вашу 🕯.');
  ban('l', 'faith', 'bruno', 'Бруно', 'хранитель реликвий', 23, { lordIncome: 1 }, 'В начале хода +1🪙 за каждого вашего лорда и великого лорда.');
  ban('l', 'faith', 'warden', 'Блюститель Обетов', 'страж веры', 22, { oathFree: 1 }, 'Обет вашей веры на вас не действует.', { needs: 'faith' });
  ban('l', 'faith', 'gregory', 'Архиепископ Григорий', 'первосвященник', 24, { twoFaiths: 1 }, 'Можно исповедовать две веры сразу: блага и обеты обеих, обряд — один в ход.', { needs: 'faith' });
  ban('l', 'faith', 'sebastian', 'Аббат Себастьян', 'настоятель Юга', 24, { provBonus_S: 2 }, 'Ваши владения Юга приносят +2🪙.');

  // Наследники Домов — личные лорды: лежат у планшета с начала партии и усиливают стратегию Дома
  ban('l', 'trade', 'heir_deer', 'Леди Элинор', 'наследница Дома Оленя', 31, { freeEstateBuy: 1 }, 'Ярмарка: раз в ход владение можно купить, не тратя действие.', { heir: 'deer' });
  ban('l', 'sci', 'heir_owl', 'Аделард', 'наследник Дома Совы', 25, { hand: 1 }, '+1 карта в руку.', { heir: 'owl' });
  ban('l', 'war', 'heir_wolf', 'Сэр Ульрик', 'наследник Дома Волка', 25, { lootPlus: 99 }, 'Захватом можно взять владение любой цены.', { heir: 'wolf' });
  ban('l', 'war', 'heir_serpent', 'Дуглас', 'наследник Дома Змея', 25, { redIncome: 2 }, 'В начале хода +2🪙 за каждый ваш 🟥 Набег.', { heir: 'serpent' });
  ban('l', 'faith', 'heir_bear', 'Уна', 'наследница Дома Медведя', 25, { landIncome: 1 }, 'В начале хода +1🪙 за каждые 2 ваши 🟦 Земли.', { heir: 'bear' });
  ban('l', 'trade', 'heir_lion', 'Леонора', 'наследница Дома Льва', 25, { allyAll: 1 }, 'Свита срабатывает у всех ваших карт двора — даже у первой за ход.', { heir: 'lion' });

  // великие лорды — власть над столом; содержание в начале хода, иначе уходят под низ своей колоды
  ban('g', 'trade', 'jacob', 'Заимодавец Якоб', 'королевский банкир', 34, { savings: 1 }, 'В начале хода +1🪙 за каждые 5🪙 в казне.', { upkeep: 1, take: [['gold', 6]] });
  ban('g', 'trade', 'doge', 'Дож Лоренцо', 'правитель вольного города', 36, { estateGold: 1 }, 'Казначейство: в начале хода +1🪙 за каждые 2 ваших владения.', { upkeep: 2, take: [['gold', 3]] });
  ban('g', 'sci', 'matilda', 'Регентша Матильда', 'наставница короля', 34, { hand: 2 }, '+2 карты в руку.', { upkeep: 2, take: [['draw', 2]] });
  ban('g', 'sci', 'aldo', 'Магистр Альдо', 'ректор университета', 36, { hand: 1, extraTurn: 1 }, '+1 карта в руку. Выпал дубль на двух кубиках — сделайте ещё один ход.', { upkeep: 2, take: [['draw', 2]] });
  ban('g', 'war', 'luca', 'Кондотьер Лука', 'вождь вольных отрядов', 37, { siege: 3, siegeWinGold: 3 }, 'Каждое ваше нападение +3⚔️. Победа в нападении +3🪙.', { upkeep: 3, take: [['gold', 3]], needs: 'sieges' });
  ban('g', 'war', 'conrad', 'Коннетабль Конрад', 'предводитель войска', 34, { shield: 3 }, 'Нападения и шпионы против вас слабее на 3.', { upkeep: 2, take: [['gold', 3]] });
  ban('g', 'war', 'edward', 'Лорд-протектор Эдуард', 'хранитель границ', 34, { captureImmune: 1, raidShield: 2 }, 'Чужие 🟥 Набеги и 🟪 Твердыни забирают у вас на 2🪙 меньше. Ваши владения нельзя захватить и разрушить.', { upkeep: 1, take: [['gold', 3]] });
  ban('g', 'int', 'otto', 'Маркграф Оттон', 'повелитель пограничья', 37, { buyToll: 1, oppRegGold: 3 }, 'Соперник купил что-то на рынке — вам +1🪙; нанял знамя — +3🪙.', { upkeep: 2, take: [['gold', 3]] });
  ban('g', 'int', 'wilhelm', 'Соглядатай Вильгельм', 'глава шпионов', 34, { spy: 3, spyWinGold: 3 }, 'Каждый ваш шпионаж +3🔗. Удачный шпионаж — ещё +3🪙.', { upkeep: 2, take: [['gold', 3]], needs: 'spy' });
  ban('g', 'faith', 'oberon', 'Хранитель мощей Оберон', 'страж реликвий', 34, { blueBonus: 1 }, '🟦 Земли приносят +1🪙.', { upkeep: 1, take: [['gold', 3]] });
  ban('g', 'faith', 'aurelius', 'Святой Аврелий', 'целитель', 34, { fetch: 1 }, 'Раз в ход возьмите карту из своего сброса в руку — даже сыгранную в этот ход.', { upkeep: 1, take: [['draw', 2]] });

  // ---------- Веры ----------
  // 8 вер, по две на направление ⚖️ 📜 ⚔️ 🔗. В партии — 4: по одной случайной каждого направления.
  // Принять: 🕯🕯 + 2 значка направления веры (Дому этого направления и Медведям — на 1🕯 меньше).
  // Благо I действует сразу; ступени II и III — когда у вас 🕯3 и 🕯5 на столе. Обряд — раз в ход. Обет — ограничение, пока вы в вере.
  // cards — 2 карты веры: принявший веру первым кладёт их себе в сброс; отрёкся — карты возвращаются к вере.
  // rite.cost: gold — заплатить в банк, trash — убрать карты из руки из игры
  // oath: no_raid / no_craft — нельзя покупать такие владения; gift — oathN🪙 самому бедному в начале хода; oneDie — только один кубик;
  //       no_retire — без Отставки; attack — без захвата и разрушения; no_renounce — отречься нельзя; hire_war — без знамён Войны
  // prod2 / prod3 — значки, которые даёт ступень II / III (Пламя Предков II: +2⚔️)
  const FAITHS = {
    grain: { name: 'Златой Колос', icon: '🌾', dir: 'trade',
      mods: { blueBonus: 1 }, mods2: { blueBonus: 1 }, mods3: { freeLandBuy: 1 },
      text: '🟦 Земли приносят +1🪙.', text2: '🟦 Земли приносят ещё +1🪙.', text3: 'Раз в ход 🟦 Землю можно купить, не тратя действие.',
      rite: { name: 'Первый сноп', cost: { trash: 1 }, fx: [['goldPerLand', 1]] }, oath: 'no_raid', oathText: 'Нельзя покупать 🟥 Набеги.',
      cards: ['reaper', 'miller'] },
    harvest: { name: 'Праздник Урожая', icon: '🌻', dir: 'trade',
      mods: { greenBonus: 1 }, mods2: { craftIncome: 1 }, mods3: { craftAny: 1 },
      text: '🟩 Ремёсла приносят +1🪙.', text2: 'В начале хода +1🪙 за каждые 2 ваших 🟩 Ремесла.', text3: '🟩 Ремёсла приносят доход и в чужой ход.',
      rite: { name: 'Пир', cost: { trash: 1 }, fx: [['goldPerCraft', 1]] }, oath: 'gift', oathN: 2, oathText: 'Щедрость: в начале хода отдайте 2🪙 самому бедному сопернику.',
      cards: ['breadgiver', 'strada'] },
    seer: { name: 'Око Провидца', icon: '👁', dir: 'sci',
      mods: { rerollOne: 1 }, mods2: { doubleDraw: 2 }, mods3: { extraTurn: 1 },
      text: 'Раз в ход можно перебросить один из кубиков.', text2: 'Выпал дубль на двух кубиках — возьмите 2 карты.', text3: 'Выпал дубль на двух кубиках — сделайте ещё один ход.',
      rite: { name: 'Видение', cost: { gold: 1 }, fx: [['reroll', 1], ['draw', 1]] }, oath: 'no_retire', oathText: 'Нельзя делать Отставку.',
      cards: ['fortune', 'dream'] },
    star: { name: 'Звёздный Свет', icon: '✨', dir: 'sci',
      mods: { allyScholar: 1 }, mods2: { hand: 1 }, mods3: { fetch: 1 },
      text: 'Ваши карты Учёных всегда играются со свитой.', text2: '+1 карта в руку.', text3: 'Раз в ход возьмите карту из своего сброса в руку — даже сыгранную в этот ход.',
      rite: { name: 'Диспут', cost: { trash: 1 }, fx: [['draw', 2]] }, oath: 'attack', oathText: 'Нельзя нападать: захват и разрушение.',
      cards: ['copyist', 'magister'] },
    flame: { name: 'Пламя Предков', icon: '🔥', dir: 'war', truce: false,
      mods: { redBonus: 1 }, mods2: {}, prod2: { war: 2 }, mods3: { redBonus: 1 },
      text: '🟥 Набеги забирают +1🪙.', text2: '+2⚔️ — пока вы в этой вере.', text3: '🟥 Набеги забирают ещё +1🪙.',
      rite: { name: 'Боевой клич', cost: { gold: 2 }, fx: [['temp', 'war', 3]] }, oath: 'no_craft', oathText: 'Нельзя покупать 🟩 Ремёсла.',
      cards: ['wake', 'forge'] },
    blade: { name: 'Братство Клинка', icon: '🗡', dir: 'war',
      mods: { vasCheap: 2 }, mods2: { raidShield: 1 }, mods3: { banIncome: 1 },
      text: 'Вассалы вам на 2🪙 дешевле.', text2: 'Чужие 🟥 Набеги и 🟪 Твердыни забирают у вас на 1🪙 меньше.', text3: 'В начале хода +1🪙 за каждые 2 ваших знамени.',
      rite: { name: 'Клятва верности', cost: {}, fx: [['regDiscount', 3]] }, oath: 'no_renounce', oathText: 'Отречься от этой веры нельзя.',
      cards: ['orderbanner', 'ordershield'] },
    shade: { name: 'Тихая Тень', icon: '🌑', dir: 'int',
      mods: { buyToll: 1 }, mods2: { oppRegGold: 2 }, mods3: { tithe: 1 },
      text: 'Соперник купил что-то на рынке — вам +1🪙.', text2: 'Соперник нанял знамя — вам +2🪙.', text3: 'В начале хода возьмите 1🪙 у самого богатого соперника.',
      rite: { name: 'Шёпот', cost: {}, fx: [['levy', 1]] }, oath: 'hire_war', oathText: 'Нельзя нанимать вассалов и лордов Войны ⚔️.',
      cards: ['doublegame', 'intercept'] },
    cathedral: { name: 'Собор Единого', icon: '⛪', dir: 'int',
      mods: { startGold: 2 }, mods2: { courtCheap: 1 }, mods3: { infidelTithe: 1 },
      text: '+2🪙 в начале хода.', text2: 'Карты двора на рынке вам на 1🪙 дешевле.', text3: 'В начале хода самый богатый соперник другой веры или без веры платит вам 1🪙.',
      rite: { name: 'Месса', cost: {}, fx: [['stageGold', 1]] }, oath: 'oneDie', oathText: 'Бросайте только один кубик.',
      cards: ['relics', 'procession'] },
  };
  // ---------- ритуалы (v10.16): по 2 у каждой веры; 5 условий в любом порядке → постоянное чудо ----------
  // k — вид условия: trash — жертва, have — сбор, deed — подвиг, abst — воздержание, alms — милостыня; t — текст на карте
  // жертва и милостыня — действие игрока на карте ритуала; сбор — «у вас есть» в ваш ход; подвиг — после начала ритуала;
  // воздержание — ваши ходы подряд без этого. needs — модули, без которых ритуала нет в партии. miracle.mods — свойства чуда
  const RITUALS = {
    grain_a: { faith: 'grain', name: 'Великая жатва', steps: [
      { k: 'trash', what: 'hand', n: 2, t: 'Уберите из игры 2 карты из руки.' },
      { k: 'have', what: 'land', n: 3, t: 'У вас 3 🟦 Земли.' },
      { k: 'deed', what: 'rite', n: 3, t: 'Проведите обряд «Первый сноп» 3 раза.' },
      { k: 'abst', what: 'attack', n: 3, t: '3 своих хода подряд не нападайте и не шпионьте.' },
      { k: 'alms', what: 'poor', n: 5, t: 'Отдайте 5🪙 самому бедному сопернику.' }],
      miracle: { name: 'Святая земля', text: 'Каждая ваша 🟦 Земля даёт ещё 🕯.', mods: { landFaith: 1 } } },
    grain_b: { faith: 'grain', name: 'Хлебный дар', steps: [
      { k: 'trash', what: 'estate', not: 'land', t: 'Уберите из игры одно своё владение — любое, кроме 🟦 Земли.' },
      { k: 'have', what: 'gold', n: 15, t: 'В казне 15🪙.' },
      { k: 'deed', what: 'buyLand', n: 2, t: 'Купите 2 🟦 Земли.' },
      { k: 'abst', what: 'hire', n: 3, t: '3 своих хода подряд не нанимайте знамён.' },
      { k: 'alms', what: 'land', t: 'Отдайте самому бедному сопернику одну свою 🟦 Землю.' }],
      miracle: { name: 'Щедрая нива', text: 'Сработала ваша 🟦 Земля — она срабатывает ещё раз.', mods: { landDouble: 1 } } },
    harvest_a: { faith: 'harvest', name: 'Осенняя ярмарка', steps: [
      { k: 'trash', what: 'estate', only: 'land', t: 'Уберите из игры одну свою 🟦 Землю.' },
      { k: 'have', what: 'craft', n: 3, t: 'У вас 3 🟩 Ремесла.' },
      { k: 'deed', what: 'buy', n: 4, t: 'Купите на рынке 4 карты — владения или двора.' },
      { k: 'abst', what: 'hire', n: 3, t: '3 своих хода подряд не нанимайте знамён.' },
      { k: 'alms', what: 'craft', t: 'Отдайте самому бедному сопернику одно своё 🟩 Ремесло.' }],
      miracle: { name: 'Вечная ярмарка', text: 'Раз в ход покупка на рынке не тратит действие.', mods: { fairAny: 1 } } },
    harvest_b: { faith: 'harvest', name: 'Пир на весь мир', steps: [
      { k: 'trash', what: 'court', min: 3, t: 'Уберите из игры карту двора ценой от 3🪙 из руки.' },
      { k: 'have', what: 'craft', n: 3, t: 'У вас 3 🟩 Ремесла.' },
      { k: 'deed', what: 'rite', n: 2, t: 'Проведите обряд «Пир» 2 раза.' },
      { k: 'abst', what: 'attack', n: 3, t: '3 своих хода подряд не нападайте и не шпионьте.' },
      { k: 'alms', what: 'each', n: 3, t: 'Отдайте каждому сопернику по 3🪙.' }],
      miracle: { name: 'Рог изобилия', text: 'Сработало ваше 🟩 Ремесло — оно срабатывает ещё раз.', mods: { craftDouble: 1 } } },
    seer_a: { faith: 'seer', name: 'Бдение', steps: [
      { k: 'trash', what: 'estate', t: 'Уберите из игры одно своё владение.' },
      { k: 'have', what: 'faith', n: 4, t: 'У вас 🕯4.' },
      { k: 'deed', what: 'double', n: 1, t: 'Выбросьте дубль на двух кубиках.' },
      { k: 'abst', what: 'twoDice', n: 3, t: '3 своих хода подряд бросайте один кубик.' },
      { k: 'alms', what: 'poor', n: 5, t: 'Отдайте 5🪙 самому бедному сопернику.' }],
      miracle: { name: 'Перст судьбы', text: 'Раз в ход после броска поверните один кубик на любую грань. Дубль от поворота не считается.', mods: { setDie: 1 } } },
    seer_b: { faith: 'seer', name: 'Вещие сны', steps: [
      { k: 'trash', what: 'discard', n: 3, t: 'Уберите из игры 3 карты из своего сброса.' },
      { k: 'have', what: 'banDir', dir: 'sci', n: 3, t: 'У вас 3 знамени 📜.' },
      { k: 'deed', what: 'rollGold', n: 6, t: 'Получите 6🪙 дохода за один свой бросок.' },
      { k: 'abst', what: 'buyEstate', n: 3, t: '3 своих хода подряд не покупайте владений.' },
      { k: 'alms', what: 'poor', n: 4, t: 'Отдайте 4🪙 самому бедному сопернику.' }],
      miracle: { name: 'Ясновидение', text: 'Верхние карты колод владений, двора и знамён открыты для вас: их можно купить или нанять, как карты из ряда.', mods: { deckTop: 1 } } },
    star_a: { faith: 'star', name: 'Великий диспут', steps: [
      { k: 'trash', what: 'hand', n: 2, t: 'Уберите из игры 2 карты из руки.' },
      { k: 'have', what: 'hand', n: 6, t: 'У вас в руке 6 карт.' },
      { k: 'deed', what: 'playTurn', n: 5, t: 'Сыграйте за один ход 5 карт.' },
      { k: 'abst', what: 'hire', n: 3, t: '3 своих хода подряд не нанимайте знамён.' },
      { k: 'alms', what: 'card', t: 'Отдайте самому бедному сопернику карту из руки — ему в сброс.' }],
      miracle: { name: 'Созвездие', text: 'Все ваши карты двора играются с двойной свитой.', mods: { allyBig: 1 } } },
    star_b: { faith: 'star', name: 'Звёздная ночь', steps: [
      { k: 'trash', what: 'court', min: 3, t: 'Уберите из игры карту двора ценой от 3🪙 из руки.' },
      { k: 'have', what: 'sci', n: 5, t: 'У вас 📜5.' },
      { k: 'deed', what: 'rite', n: 2, t: 'Проведите обряд «Диспут» 2 раза.' },
      { k: 'abst', what: 'retire', n: 3, t: '3 своих хода подряд не делайте Отставку.' },
      { k: 'alms', what: 'each', n: 2, t: 'Отдайте каждому сопернику по 2🪙.' }],
      miracle: { name: 'Звёздная память', text: 'Несыгранные карты остаются в руке, а в конце хода вы берёте столько новых, сколько обычно.', mods: { keepHand: 1 } } },
    flame_a: { faith: 'flame', name: 'Испытание огнём', needs: 'sieges', steps: [
      { k: 'trash', what: 'estate', only: 'craft', t: 'Уберите из игры одно своё 🟩 Ремесло.' },
      { k: 'have', what: 'war', n: 6, t: 'У вас ⚔️6.' },
      { k: 'deed', what: 'siegeWin', n: 1, t: 'Выиграйте нападение.' },
      { k: 'abst', what: 'rite', n: 2, t: '2 своих хода подряд не проводите обряд.' },
      { k: 'alms', what: 'poor', n: 4, t: 'Отдайте 4🪙 самому бедному сопернику.' }],
      miracle: { name: 'Неугасимое пламя', text: 'Когда вы нападаете, шпионите или защищаетесь, бросайте два кубика и берите лучший.', mods: { fightBest: 1 } } },
    flame_b: { faith: 'flame', name: 'Великий набег', steps: [
      { k: 'trash', what: 'vassal', t: 'Отпустите одного своего вассала — под низ колоды вассалов.' },
      { k: 'have', what: 'raid', n: 3, t: 'У вас 3 🟥 Набега.' },
      { k: 'deed', what: 'rite', n: 3, t: 'Проведите обряд «Боевой клич» 3 раза.' },
      { k: 'abst', what: 'buyEstate', n: 3, t: '3 своих хода подряд не покупайте владений.' },
      { k: 'alms', what: 'each', n: 2, t: 'Отдайте каждому сопернику по 2🪙.' }],
      miracle: { name: 'Двойная добыча', text: 'Сработал ваш 🟥 Набег — он срабатывает ещё раз.', mods: { raidDouble: 1 } } },
    blade_a: { faith: 'blade', name: 'Посвящение', needs: 'lords', steps: [
      { k: 'trash', what: 'estate', t: 'Уберите из игры одно своё владение.' },
      { k: 'have', what: 'war', n: 5, t: 'У вас ⚔️5.' },
      { k: 'deed', what: 'hireLord', n: 1, t: 'Наймите лорда.' },
      { k: 'abst', what: 'attack', n: 3, t: '3 своих хода подряд не нападайте и не шпионьте.' },
      { k: 'alms', what: 'poor', n: 5, t: 'Отдайте 5🪙 самому бедному сопернику.' }],
      miracle: { name: 'Верность до гроба', text: 'Содержание каждого вашего лорда и великого лорда — 1🪙.', mods: { upkeepOne: 1 } } },
    blade_b: { faith: 'blade', name: 'Святое знамя', steps: [
      { k: 'trash', what: 'vassal', t: 'Отпустите одного своего вассала — под низ колоды вассалов.' },
      { k: 'have', what: 'banners', n: 7, t: 'У вас 7 знамён.' },
      { k: 'deed', what: 'hire', n: 3, t: 'Наймите 3 знамени.' },
      { k: 'abst', what: 'retire', n: 3, t: '3 своих хода подряд не делайте Отставку.' },
      { k: 'alms', what: 'poor', n: 10, t: 'Отдайте 10🪙 самому бедному сопернику.' }],
      miracle: { name: 'Небесный стяг', text: 'Для победы вам нужно на одно знамя меньше — того уровня, которого не хватает.', mods: { goalMinus: 1 } } },
    shade_a: { faith: 'shade', name: 'Ночной совет', needs: 'spy', steps: [
      { k: 'trash', what: 'hand', n: 2, t: 'Уберите из игры 2 карты из руки.' },
      { k: 'have', what: 'int', n: 3, t: 'У вас 🔗3.' },
      { k: 'deed', what: 'spyWin', n: 1, t: 'Удачно пошпионьте.' },
      { k: 'abst', what: 'hire', n: 3, t: '3 своих хода подряд не нанимайте знамён.' },
      { k: 'alms', what: 'each', n: 2, t: 'Отдайте каждому сопернику по 2🪙.' }],
      miracle: { name: 'Чужими руками', text: 'В начале хода возьмите в руку любую карту из сброса любого соперника. В конце хода она вернётся в его сброс.', mods: { borrow: 1 } } },
    shade_b: { faith: 'shade', name: 'Обет молчания', steps: [
      { k: 'trash', what: 'estate', t: 'Уберите из игры одно своё владение.' },
      { k: 'have', what: 'banDir', dir: 'int', n: 3, t: 'У вас 3 знамени 🔗.' },
      { k: 'deed', what: 'rite', n: 4, t: 'Проведите обряд «Шёпот» 4 раза.' },
      { k: 'abst', what: 'attack', n: 3, t: '3 своих хода подряд не нападайте и не шпионьте.' },
      { k: 'alms', what: 'poor', n: 6, t: 'Отдайте 6🪙 самому бедному сопернику.' }],
      miracle: { name: 'Нашёптанная судьба', text: 'Раз в ход решите за одного соперника, сколько кубиков он бросит в свой следующий ход: один или два.', mods: { dictateDice: 1 } } },
    cathedral_a: { faith: 'cathedral', name: 'Освящение собора', steps: [
      { k: 'trash', what: 'court', min: 3, t: 'Уберите из игры карту двора ценой от 3🪙 из руки.' },
      { k: 'have', what: 'gold', n: 20, t: 'В казне 20🪙.' },
      { k: 'deed', what: 'buyCourt', n: 1, t: 'Купите карту двора.' },
      { k: 'abst', what: 'attack', n: 3, t: '3 своих хода подряд не нападайте и не шпионьте.' },
      { k: 'alms', what: 'each', n: 3, t: 'Отдайте каждому сопернику по 3🪙.' }],
      miracle: { name: 'Благодать', text: 'Раз в ход — второе действие за 3🪙.', mods: { cheapAction: 1 } } },
    cathedral_b: { faith: 'cathedral', name: 'Великий пост', steps: [
      { k: 'trash', what: 'hand', n: 2, t: 'Уберите из игры 2 карты из руки.' },
      { k: 'have', what: 'faith', n: 5, t: 'У вас 🕯5.' },
      { k: 'deed', what: 'rite', n: 3, t: 'Проведите обряд «Месса» 3 раза.' },
      { k: 'abst', what: 'market', n: 3, t: '3 своих хода подряд ничего не покупайте на рынке.' },
      { k: 'alms', what: 'poor', n: 5, t: 'Отдайте 5🪙 самому бедному сопернику.' }],
      miracle: { name: 'Благовест', text: 'В начале хода ваши 🟦 Земли приносят доход.', mods: { landDawn: 1 } } },
  };
  const STEP_NAME = { trash: 'Жертва', have: 'Сбор', deed: 'Подвиг', abst: 'Воздержание', alms: 'Милостыня' };
  // обряд — текстом: «Уберите карту из руки из игры → +1🪙 за каждую вашу Землю»
  function riteCostText(c) {
    if (!c) return '';
    if (c.gold) return `Заплатите ${c.gold}🪙`;
    if (c.trash) return `Уберите ${c.trash === 1 ? 'карту' : c.trash + ' карты'} из руки из игры`;
    if (c.give) return `Отдайте ${c.give}🪙 самому бедному сопернику`;
    return 'Бесплатно';
  }


  // ---------- Тексты эффектов ----------
  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }
  const cards = (n) => `${n} ${plural(n, 'карту', 'карты', 'карт')}`;
  const banners = (n) => `${n} ${plural(n, 'знамя', 'знамени', 'знамён')}`;

  function fxLine(op) {
    const [k, a, b, c] = op;
    switch (k) {
      case 'gold': return `+${a}🪙`;
      case 'draw': return `возьмите ${cards(a)}`;
      case 'temp': return `+${b}${SYM[a]} до конца хода`;
      case 'stageGold': return `+${a}🪙 за каждую ступень вашей веры (I–III)`;
      case 'perPlayed': return `+${b}🪙 за каждую «${(COURT[a] || {}).name || a}», сыгранную в этот ход`;
      case 'goldPerCraft': return `+${a}🪙 за каждое ваше 🟩 Ремесло`;
      case 'goldPerRaid': return `+${a}🪙 за каждый ваш 🟥 Набег`;
      case 'goldPerSym': return `+${b}🪙 за каждый ваш значок ${SYM[a]}`;
      case 'goldPerLand': return `+${a}🪙 за каждую вашу 🟦 Землю`;
      case 'goldPerProv': return `+${a}🪙 за каждую провинцию, где у вас есть владение`;
      case 'goldIfFaith': return `ещё +${a}🪙, если у вас есть вера`;
      case 'buys': return `+${a} действие в этот ход`;
      case 'discount': return `следующая покупка на рынке в этот ход дешевле на ${a}🪙`;
      case 'fairCourt': return `Ярмарка: в этот ход купите карту двора, не тратя действие (купленная — в сброс)`;
      case 'regDiscount': return `следующее знамя в этот ход дешевле на ${a}🪙`;
      case 'reroll': return `до броска: в этот ход можно перебросить кубики`;
      case 'forage': return `возьмите ${b}🪙 у самого богатого из соперников, у кого ${SYM[a]} меньше, чем у вас`;
      case 'siege': return `Захват (+${a}⚔️): победа — возьмите любое его владение до ${RULES.siegeLoot}🪙 (оно в руинах)`;
      case 'raze': return `Разрушение (+${a}⚔️): победа — его владение на ваш выбор${b >= 99 ? '' : ` до ${b}🪙`} ${c === 'wall' ? 'и одна стена разрушаются' : 'разрушается'}${c === 'nowalls' ? '; стены цели не в счёт' : ''}`;
      case 'spy':
        if (b === 'steal') return `Шпионаж (+${a}🔗): удача — украдите ${c}🪙`;
        if (b === 'sabotage') return `Шпионаж (+${a}🔗): удача — сорвите его замысел или прогоните придворного`;
        if (b === 'estate') return `Шпионаж (+${a}🔗): удача — его владение на ваш выбор до ${c}🪙 — ваше`;
        if (b === 'grab') return `Шпионаж (+${a}🔗): удача — заберите карту из его сброса себе в сброс`;
        if (b === 'burn') return `Шпионаж (+${a}🔗): удача — сожгите ${c} ${plural(c, 'карту', 'карты', 'карт')} из его сброса`;
        if (b === 'poach') return `Шпионаж (+${a}🔗): удача — его вассал на ваш выбор — ваш; ${RULES.poachHalf ? 'половину цены с карты — в банк' : 'заплатите ему цену с карты'}`;
        if (b === 'lock') return `Шпионаж (+${a}🔗): удача — в свой следующий ход он не нанимает знамён`;
        if (b === 'tax') return `Шпионаж (+${a}🔗): удача — он отдаёт в банк ${c}🪙 за каждое своё знамя`;
        if (b === 'distract') return `Шпионаж (+${a}🔗): удача — его лорд на ваш выбор не действует до конца его следующего хода`;
        if (b === 'riot') return `Шпионаж (+${a}🔗): удача — в его следующий ход содержание его великих лордов на ${c}🪙 дороже`;
        if (b === 'arson') return `Шпионаж (+${a}🔗): удача — соперник теряет ${c}🪙`;
        if (b === 'denounce') return `Шпионаж (+${a}🔗): удача — соперник сбрасывает ${c} ${plural(c, 'случайную карту', 'случайные карты', 'случайных карт')} из руки`;
        if (b === 'slander') return `Шпионаж (+${a}🔗): удача — в свой следующий ход он не покупает карты двора`;
        if (b === 'feast') return `Шпионаж (+${a}🔗): удача — он сбрасывает случайную карту из руки и теряет ${c}🪙`;
        return 'Шпионаж';
      case 'trash': return `уберите из игры до ${a} ${plural(a, 'карты', 'карт', 'карт')} из руки`;
      case 'trashGold': return `уберите из игры до ${a} ${plural(a, 'карты', 'карт', 'карт')} из руки, +${b}🪙 за каждую`;
      case 'board': return `возьмите ${a}🪙 у самого богатого соперника, если ваша ⚔️ не меньше его (иначе 1🪙)`;
      case 'ambush': return `засада: +${a}🪙`;
      case 'fire': return `ваши ${a === 'craft' ? '🟩 Ремёсла' : a === 'land' ? '🟦 Земли' : a} приносят доход прямо сейчас`;
      case 'echo': return 'повторите эффект последней карты двора, сыгранной вами в этот ход';
      case 'snatch': return 'возьмите карту из сброса соперника себе в руку';
      case 'goldPerBanner': return `+${a}🪙 за каждое ваше знамя`;
      case 'shield': return 'до вашего следующего хода чужие 🟥 Набеги и 🟪 Твердыни у вас ничего не забирают';
      case 'fetchOne': return 'возьмите карту из своего сброса в руку — не сыгранную в этот ход';
      case 'levy': return `возьмите ${a}🪙 у самого богатого соперника`;
      case 'unseat': return 'опала: отправьте одного придворного соперника в его сброс';
      default: return k;
    }
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  function fxText(fx) { return fx.map((op, i) => i === 0 ? cap(fxLine(op)) : fxLine(op)).join('; '); }

  function estateText(d) {
    let s;
    if (d.t === 'wall') return `🧱 Стены +${d.walls}. Захватить нельзя`;
    if (d.t === 'raid') s = `Заберите ${d.inc}🪙 у того, чей ход`;
    else if (d.t === 'hold') s = `Заберите ${d.inc}🪙 у самого богатого соперника`;
    else if (d.per === 'land') s = `+${d.perN}🪙 за каждую вашу 🟦 Землю`;
    else if (d.per === 'raid') s = `+${d.perN}🪙 за каждый ваш 🟥 Набег`;
    else if (d.perProv) s = `+${d.perN}🪙 за каждое ваше владение ${PROV[d.perProv].gen}`;
    else if (d.per === 'provS') s = `+${d.perN}🪙 за каждое ваше владение Юга`;
    else if (d.per === 'prov') s = `+${d.perN}🪙 за каждую провинцию, где у вас есть владение`;
    else if (d.per) s = `+${d.perN}🪙 за каждый ваш значок ${SYM[d.per]}`;
    else s = `+${d.inc}🪙`;
    if (d.pair) s += `; пара ${PROV[d.p].gen} — ещё +${d.pair}🪙`;
    if (d.walls) s += `; 🧱 стены +${d.walls}`;
    if (d.ptext) s += `. Постоянно: ${d.ptext}`;
    return s;
  }
  const numText = (n) => !n.length ? '—' : n.length > 1 ? `${n[0]}–${n[n.length - 1]}` : `${n[0]}`;

  function reqText(req) {
    const parts = [];
    for (const s of SYMS) if (req && req[s]) parts.push(SYM[s].repeat(req[s]));
    if (req && req.unions) parts.push(`${req.unions} союза`);
    return parts.join(' ');
  }

  // ---------- модули: части правил, которые можно выключить ----------
  const MODULES = {
    lords: { hidden: true, name: 'Лорды', short: 'Лорды', icon: '👑', desc: 'Ряд из 3 лордов и Наследник Дома: сильные свойства, +1 место при дворе. Для победы — ещё 4 лорда.' },
    great: { hidden: true, name: 'Великие лорды', short: 'Великие', icon: '🧭', desc: 'Ряд из 3 великих лордов: власть над столом, но содержание каждый ход. Для победы — ещё 2.' },
    faith: { name: 'Вера', short: 'Вера', icon: '🕯', desc: '8 вер, в партии — 4: по одной каждого направления. Принимают бесплатно, когда хватает значков. У каждой — три ступени блага, обряд, обет и две карты веры для того, кто примет её первым.' },
    plots: { member: 'court', hidden: true, name: 'Замыслы', short: 'Двор', icon: '🪑', ownIcon: '⏳', desc: 'Карты с ⏳ и 🎲 можно отложить ради усиленного эффекта; у 🎲 — два числа.' },
    seats: { member: 'court', hidden: true, name: 'Придворные', short: 'Двор', icon: '🪑', ownIcon: '🪑', desc: 'Карту можно не сыграть, а посадить ко двору ради постоянного свойства. Мест: 2 + 1 за каждого лорда.' },
    unions: { hidden: true, name: 'Союзы провинций', short: 'Союзы', icon: '🏔', desc: 'Каждые 3 владения провинции — союз: 2 значка и золото сразу.' },
    balance: { hidden: true, name: 'Зависть и поддержка', short: 'Баланс', icon: '🫱', desc: 'Лидер по знамёнам платит, отстающие получают золото.' },
    sieges: { member: 'conflict', hidden: true, name: 'Осады', short: 'Вражда', icon: '⚔️', ownIcon: '⚔️', desc: 'Захват и разрушение владений. Стены.' },
    spy: { member: 'conflict', hidden: true, name: 'Шпионаж', short: 'Вражда', icon: '⚔️', ownIcon: '🗝', desc: 'Кража, срыв замыслов, вымогательство, опала. Стража.' },
    // объединённые модули: включаются целиком, внутри — правила двух прежних
    conflict: { group: ['sieges', 'spy'], name: 'Вражда', short: 'Вражда', icon: '⚔️', desc: 'Нападения и шпионы: захват и разрушение владений, кража, вымогательство. Одна защита — 🧱 Стены. Ряд 🟪 Твердынь.' },
    court: { group: ['plots', 'seats'], name: 'Двор', short: 'Двор', icon: '🪑', desc: 'Карту двора можно не сыграть: отложить замыслом (⏳ и 🎲) ради сильного эффекта или посадить ко двору ради постоянного свойства.' },
  };
  const MODULE_KEYS = Object.keys(MODULES).filter(k => !MODULES[k].group); // внутренние ключи правил
  // модули на выбор: лорды теперь в основе, «Баланс» убран (его заменил догоняющий наём)
  const MODULE_PICK = ['faith', 'conflict', 'court']; // модули на выбор (Союзы убраны; великие лорды — это длина партии)
  // длина партии: короткая — только вассалы, средняя — + лорды, длинная — + великие лорды
  const LENGTHS = {
    short: { name: 'Короткая', mods: [], desc: 'Только вассалы. Цель — 6 вассалов, около 9 кругов.' },
    medium: { name: 'Средняя', mods: ['lords'], desc: 'Вассалы и лорды. Цель — 6 вассалов и 4 лорда. Лорд стоит 2🪙 содержания в ход.' },
    long: { name: 'Длинная', mods: ['lords', 'great'], desc: 'Ещё и великие лорды: цель — 6 вассалов, 4 лорда и 2 великих. Великие дороги в содержании.' },
  };
  const modMembers = (k) => (MODULES[k] && MODULES[k].group) || [k];
  const PRESETS = {
    intro: { name: 'Знакомство', desc: 'Первая партия: владения, карты двора и вассалы, цель — 6 вассалов. Вдвоём берите Оленей и Львов — это равная пара.', modules: [] },
    basic: { name: 'Базовая', desc: 'Владения, карты двора, вассалы и лорды. Цель — 6 вассалов и 4 лорда.', modules: ['lords'] },
    full: { name: 'Полная', desc: 'Все правила. Цель — 6 вассалов, 4 лорда и 2 великих лорда.', modules: MODULE_KEYS.filter(k => k !== 'balance' && k !== 'unions') },
  };
  // что без модуля теряет смысл: такие Дома недоступны, такие карты убираются из колод
  const NEEDS = {
    house: { wolf: 'sieges', rose: 'spy', moon: 'plots', eagle: 'unions', sun: 'faith' },
    court: { siegeband: 'sieges', wolfpack: 'sieges', sappers: 'sieges', pickpocket: 'spy', saboteur: 'spy', blackmailer: 'spy', briber: 'spy',
      ballista: 'sieges', ram: 'sieges', catapult: 'sieges', siegetower: 'sieges', trebuchet: 'sieges', interceptor: 'spy', torchman: 'spy', courtesan: 'spy', agitator: 'spy', recruiter: 'spy',
      pr_grain: 'faith', pr_bounty: 'faith', pr_star: 'faith', pr_seer: 'faith', pr_flame: 'faith', pr_blade: 'faith', pr_shade: 'faith', pr_circle: 'faith', pr_cathedral: 'faith', pr_ash: 'faith', pr_harvest: 'faith', pr_mercy: 'faith',
      keeper: 'seats', fairwarden: 'seats', taxfarmer: 'seats', tutor: 'seats', physician: 'seats', dreamer: 'seats', captain: 'seats', huntsman: 'seats', bannerman: 'seats', favorite: 'seats', gossip: 'seats',
      seneschal: 'seats', tollman: 'seats', bookman: 'seats', clockmaker: 'seats', armsmaster: 'seats', centurion: 'seats', ladyinwaiting: 'seats', confidante: 'seats', boatswain: 'seats', fence: 'seats', seeress: 'seats', sorceress: 'seats', meadmaker: 'seats', forester: 'seats', steward: 'seats', chamberlain: 'seats', envoyfam: 'seats', inspector: 'seats', harvestpriestess: 'seats', bellringer: 'seats' },
    ban: {},
    // 🟪 Твердыни — не в основе, а с модулями нападений
    estate: { wall: 'sieges', cliffkeep: 'sieges', secretoffice: 'spy', plaguehouse: 'spy', banditpost: 'spy', falsetax: 'spy', blight: 'spy', ashes: 'spy&sieges', evileye: 'spy', cursedrelic: 'spy&faith', schemer: 'spy', mint: 'sieges|spy', citadel: 'sieges|spy', customs: 'sieges|spy', granary: 'sieges|spy', merchants: 'sieges|spy', fortress: 'sieges|spy', chancery: 'sieges|spy', thieves: 'sieges|spy', robberkeep: 'sieges|spy', embassy: 'sieges|spy' },
  };
  for (const id in BAN) if (BAN[id].needs) NEEDS.ban[id] = BAN[id].needs;
  NEEDS.ritual = {}; for (const id in RITUALS) if (RITUALS[id].needs) NEEDS.ritual[id] = 'faith&' + RITUALS[id].needs; // ритуал без своего модуля в партию не выходит
  for (const id in COURT) if (COURT[id].faith) NEEDS.court[id] = 'faith';
  Object.assign(NEEDS.court, { sin_pride: 'faith', sin_greed: 'faith', sin_wrath: 'faith&sieges', sin_envy: 'faith', sin_gluttony: 'faith', sin_sloth: 'faith', sin_lust: 'faith&seats', penance: 'faith', arson: 'spy', denounce: 'spy', slander: 'spy', poisonfeast: 'spy', courtesan: 'spy', agitator: 'spy', torchman: 'spy', trebuchet: 'sieges', dreamer: 'seats', astrologer: 'seats', chronicler: 'seats',
    chamberlain: 'seats', revels: 'seats', augur: 'seats', gatekeeper: 'seats', huntsman: 'seats', cupbearer: 'seats', confessor: 'seats', gossip: 'seats' });
  // убранные карты — убрать и из списка зависимостей
  { const SRC = { court: COURT, estate: ESTATES, ban: BAN, house: HOUSES }; for (const k in SRC) for (const id in NEEDS[k] || {}) if (!SRC[k][id]) delete NEEDS[k][id]; }
  // имя знамени для журнала и подсказок: «Томас Хейл, смотритель дорог»
  const regName = (def) => (def.title ? `${def.name}, ${def.title}` : def.name);
  const tierOf = (id) => (BAN[id] ? BAN[id].tier : null);
  const heirOf = (h) => HOUSES[h] && HOUSES[h].heir;

  return { MODULES, MODULE_KEYS, MODULE_PICK, LENGTHS, modMembers, PRESETS, NEEDS, regName, tierOf, heirOf, SYMS, SYM, SYM_NAME, DIRS, TIERS, RULES, PROV, ETYPE, ESTATES, ROLES, COURT, HOUSES, BAN, FAITHS, RITUALS, STEP_NAME, riteCostText, fxText, fxLine, estateText, numText, reqText, plural, cards, banners };
})();
if (typeof module !== 'undefined') module.exports = DATA;
