// Памятка игрока: две карты, четыре стороны. Один текст для печатных карт 63×88 и для листа «Памятка» в игре.
//   Карта 1: Aid.front — «Ход» (шаги и доход по броску), Aid.back — «Рынок и знамёна».
//   Карта 2: Aid.icons — «Значки» (все значки с названием и назначением), Aid.terms — «Словарь» (термины с карт).
// ico(key) возвращает <img> значка, эмодзи в тексте заменяет SymIcons.
// on(k) — включён ли модуль k (lords, great, faith, plots, seats, balance, unions, sieges, spy); без on — полная игра.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Aid = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const ALL = (k) => k !== 'balance' && k !== 'unions'; // печатная памятка — для всех модулей («Баланс» и «Союзы» убраны)
  const head = (n, title) => `<div class="ah"><span>Памятка ${n}</span><b>${title}</b></div>`;

  // ---------- карта 1, лицо: ход ----------
  function front(R, ico, on = ALL) {
    const dawn = [`свойства ${ico('dawn')} (держите их отдельным рядом)`];
    if (on('lords')) dawn.push(on('great') ? 'содержание лордов и великих' : 'содержание лордов');
    if (on('plots')) dawn.push('⏳-замыслы');
    if (on('balance')) dawn.push('Зависть и Поддержка');
    const bad = on('sieges') ? `<tr><td><span class="bsq"></span>Беда</td><td>вредит<small>как на карте</small></td><td>вредит<small>как на карте</small></td></tr>` : '';
    const holds = on('sieges') || on('spy');
    return `<div class="aid front">
      ${head(1, 'Ход')}
      <ol class="steps">
        <li><span><b>Начало:</b> ${dawn.join(', ')}</span></li>
        ${R.retire === false ? '' : '<li><span><b>Отставка</b> — если хотите, раз в ход</span></li>'}
        <li><span><b>Карты из руки</b> — до и после броска; сыгранная — сразу в сброс</span></li>
        <li><span><b>Бросок:</b> 1 или 2🎲 на выбор</span></li>
        <li><span><b>Доход</b> — у всех, по таблице</span></li>
        <li><span><b>Одно действие:</b> купить карту <i>или</i> нанять знамя${on('great') ? `; второе — за ${R.extraAction}🪙` : ''}</span></li>
        <li><span><b>Конец:</b> рука — в сброс, возьмите ${R.hand}</span></li>
      </ol>
      <table class="who">
        <thead><tr><th></th><th>в ваш<br>ход</th><th>в ход<br>другого</th></tr></thead>
        <tbody>
          <tr><td>🟦 Земля</td><td>+🪙</td><td>+🪙</td></tr>
          <tr><td>🟩 Ремесло</td><td>+🪙</td><td class="no">—</td></tr>
          <tr><td>🟥 Набег</td><td class="no">—</td><td>+🪙<small>у того, чей ход</small></td></tr>
          ${holds ? '<tr><td>🟪 Твердыня</td><td>+🪙<small>у самого богатого</small></td><td class="no">—</td></tr>' : ''}
          ${bad}
        </tbody>
      </table>
    </div>`;
  }

  // ---------- карта 1, оборот: рынок, знамёна, цель, бой ----------
  function back(R, ico, on = ALL) {
    const goal = [`${R.needV} вассалов`];
    if (on('lords')) goal.push(`${R.needL} лорда`);
    if (on('great')) goal.push(`${R.needG} великих`);
    const caps = [R.discCap.v, on('lords') ? R.discCap.l : null, on('great') ? R.discCap.g : null].filter(x => x != null).map(x => `−${x}`).join(' · ');
    const rules = [
      [ico('tag'), `<b>Рынок:</b> ${R.estateRow} владения, ${R.courtRow} карты двора${on('sieges') || on('spy') ? `, ${R.holdRow} 🟪 Твердыни` : ''}. Купили — откройте следующую; карта двора — в ваш сброс.`],
      [ico('reroll'), `<b>Новый круг:</b> из ряда (рынка или знамён), где за круг ничего не взяли, крайнюю карту — под низ колоды.${R.catchupGap ? ` Если у лидера ${R.catchupFrom}+ знамён, отстающие в этом круге могут нанять ещё по вассалу.` : ''}`],
      on('sieges') || on('spy') ? [ico('hold'), `<b>Твердыни</b> (с модулями нападений): каждая — по одной у игрока; копий — по числу игроков.`] : null,
      [ico('banner'), `<b>Знамя:</b> цена − 1🪙 за каждый ваш значок его направления (до ${caps}).${on('lords') ? ` <b>Содержание</b> в начале хода: лорд ${R.lordUpkeep}🪙, великий — как на карте; нечем — знамя под низ колоды.` : ''}`],
      [ico('crown'), `<b>Цель:</b> ${goal.join(' + ')}. Собрали — доиграйте круг.`],
      [ico('war'), `<b>Значки</b> не тратятся: каждый — скидка на знамёна своего направления. ⚖️ <b>Торг:</b> каждые ${R.tradeStep}⚖️ — рынок −1🪙. 📜 <b>Знания:</b> каждые ${R.sciStep}📜 — +1 карта в руку. 🕯 <b>Подаяния:</b> каждые ${R.faithStep}🕯 — +1🪙 в начале хода.`],
    ];

    if (on('sieges') || on('spy')) rules.push([ico(on('sieges') ? 'siege' : 'spy'), `<b>${on('sieges') && on('spy') ? 'Нападение и шпионаж' : on('sieges') ? 'Нападение' : 'Шпионаж'}:</b> число на карте прибавьте к своим ${on('sieges') && on('spy') ? '⚔️ (у шпиона — к 🔗)' : on('sieges') ? '⚔️' : '🔗'} — только в этом нападении. Каждый ещё бросает 🎲: у кого больше — победил, поровну — устоял защитник.`]);
    return `<div class="aid back">
      ${head(1, 'Рынок и знамёна')}
      ${rules.filter(Boolean).map(([i, t]) => `<div class="rule">${i}<span>${t}</span></div>`).join('\n      ')}
    </div>`;
  }

  // ---------- карта 2, лицо: значки ----------
  function icons(R, ico, on = ALL) {
    const it = (k, name, what) => `<div class="ii">${ico(k)}<span><b>${name}</b>${what ? ` — ${what}` : ''}</span></div>`;
    const S = [
      ['Значки', [
        it('gold', 'Золото', ''),
        it('trade', 'Весы', 'Торговля'),
        it('sci', 'Свитки', 'Наука'),
        it('war', 'Мечи', on('sieges') ? 'Война, нападение' : 'Война'),
        it('int', 'Связи', on('spy') ? 'Интриги, шпионаж' : 'Интриги'),
        it('faith', 'Свечи', 'Вера'),
        on('sieges') || on('spy') ? it('wall', 'Стены', 'защита') : '',
      ]],
      ['Владения', [
        it('land', 'Земля', 'в любой ход'), it('craft', 'Ремесло', 'в свой ход'), it('raid', 'Набег', 'в чужой ход'), on('sieges') || on('spy') ? it('hold', 'Твердыня', 'в свой ход') : '',
        `<div class="ii wide">${ico('provN')}${ico('provS')}${ico('provE')}${ico('provW')}<span><b>Провинции:</b> Север, Юг, Восток, Запад</span></div>`,
      ]],
      ['На картах', [
        it('dice', 'Бросок', ''),
        it('dawn', 'В начале хода', ''),
        it('card', 'Карта', 'взять в руку'),
        it('action', 'Действие', ''),
        it('tag', 'Скидка', ''),
        it('reroll', 'Переброс', ''),
        on('seats') ? it('shift', 'Сдвиг броска', 'Гадатель') : '',
        it('trash', 'Из игры', 'навсегда'),
        on('sieges') ? it('siege', 'Захват', '') : '',
        on('sieges') ? it('raze', 'Разрушение', '') : '',
        on('spy') ? it('spy', 'Шпионаж', '') : '',
        on('plots') ? it('plot', 'Замысел', '') : '',
        on('seats') ? it('seat', 'Место при дворе', '') : '',
        it('banner', 'Вассал', 'знамя'),
        on('lords') ? it('crown', 'Лорд', '') : '',
        on('great') ? it('foreign', 'Великий лорд', '') : '',
      ]],
    ];
    return `<div class="aid icons">
      ${head(2, 'Значки')}
      ${S.map(([t, xs]) => `<div class="sub">${t}</div><div class="igrid">${xs.filter(Boolean).join('')}</div>`).join('\n      ')}
    </div>`;
  }

  // ---------- карта 2, оборот: словарь ----------
  function terms(R, ico, on = ALL) {
    const T = [
      R.retire === false ? null : ['Отставка', 'раз в ход карту из руки — из игры, взамен возьмите новую.'],
      ['Свита', 'бонус, если в этот ход уже сыграна карта той же роли (у Сборщика — «Подать»); после двух — дважды.'],
      ['Ярмарка', 'покупка без траты действия.'],
      ['Пара', 'есть ещё владение той же провинции — «пара» приносит больше.'],
      on('plots') ? ['Засада', 'замысел на чужом броске забирает золото у того, чей ход; на вашем — из банка.'] : null,
      on('plots') ? ['Замысел', `отложите карту вместо розыгрыша (мест ${R.plotSlots}): ⏳ — в начале вашего хода, 🎲 — когда в любой ход выпадет её число.`] : null,
      on('seats') ? ['При дворе', `вместо розыгрыша карту можно посадить: пока сидит, свойство действует. Мест ${R.courtSeats} + 1 за лорда; нет места — замените. <b>Опала</b> — придворного в сброс.`] : null,
      on('sieges') ? ['Руины', 'захваченное владение: без значков; первое срабатывание — ремонт вместо дохода.'] : null,
      on('sieges') || on('spy') ? ['Оборона', `🧱 Стены — от нападений и шпионов: замок даёт 🧱${R.baseWalls}, против шпиона — 🧱${Math.floor(R.baseWalls * (R.spyCastle == null ? 1 : R.spyCastle))}.`] : null,
      on('spy') ? ['Проклятие', `купили — сразу подбросьте сопернику шпионажем (+${R.plantSpy || 3}🔗); провал — обратно в колоду владений. Лежит и действует всегда; снять — действие + ${R.purgeCost || 2}🪙.`] : null,
      on('spy') ? ['Козни', 'разовая пакость: сыграли — шпионаж; удача или провал — карта уходит в колоду двора.'] : null,
      on('spy') ? ['Откуп', `до броска жертва платит шпиону ${R.spyBuyoff}🪙 × разница 🔗 (не меньше ${R.spyBuyoff}🪙) — шпионаж отменён.`] : null,
      on('faith') ? ['Вера', `первый принявший берёт 2 карты веры; ступени II и III — при 🕯${R.faithStage2} и 🕯${R.faithStage3}; обряд — раз в ход.`] : null,
      on('unions') ? ['Союз', `каждые 3 ваших владения одной провинции: +2 её значка и сразу +${R.unionGold}🪙.`] : null,
      on('balance') ? ['Зависть', 'лидер по знамёнам платит за отрыв; отстающий получает <b>Поддержку</b>.'] : null,
    ].filter(Boolean);
    return `<div class="aid terms">
      ${head(2, 'Словарь')}
      <dl>${T.map(([k, v]) => `<div><dt>${k}</dt> <dd>— ${v}</dd></div>`).join('')}</dl>
    </div>`;
  }
  return { front, back, icons, terms };
});
