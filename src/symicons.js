// Рисованные значки вместо эмодзи: ресурсы, бой и случай, типы владений, провинции, гербы Домов.
// Браузер: SymIcons.observe(document.body, key => `icons/i_${key}.svg`) — заменяет эмодзи в текстовых узлах, в том числе в новых.
// Node:    require('./symicons.js').iconizeHTML(html) — то же для строки HTML (картинки — data URI).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SymIcons = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const MAP = {
    '🪙': 'gold', '⚔️': 'war', '⚔': 'war', '📜': 'sci', '🔗': 'int',
    '🧱': 'wall', '🎲': 'dice', '🗝️': 'spy', '🗝': 'spy', '⏳': 'plot', '🚩': 'banner',
    '🟦': 'land', '🟩': 'craft', '🟥': 'raid', '🟪': 'hold',
    '🏔️': 'provN', '🏔': 'provN', '🌾': 'provS', '🔮': 'provE', '🌲': 'provW',
    '🐻': 'bear', '🦁': 'lion', '🦅': 'eagle', '🌞': 'sun',
    '🦌': 'deer', '🦉': 'owl', '🐺': 'wolf', '🥀': 'rose', '🌹': 'rose', '🐍': 'serpent', '🌙': 'moon', '⚖️': 'trade', '⚖': 'trade',
    '👑': 'crown', '🧭': 'foreign', '🌸': 'spring', '☀️': 'summer', '☀': 'summer', '🍂': 'autumn', '❄️': 'winter', '❄': 'winter',
    '💰': 'treasurer', '🎓': 'magister', '🎖️': 'marshal', '🎖': 'marshal', '🕯️': 'faith', '🕯': 'faith', '💥': 'raze',
    '🌳': 'landlord', '🤝': 'unifier', '🃏': 'courtier', '🏰': 'seigneur', '🪑': 'seat', '🛡️': 'guard', '🛡': 'guard', '🌅': 'dawn',
  };
  const NAME = { trade: 'весы', faith: 'свечи', raze: 'разрушение', gold: 'золото', war: 'мечи', sci: 'свитки', int: 'связи', wall: 'стены', dice: 'кубик', spy: 'шпионаж', plot: 'замысел', banner: 'знамя',
    land: 'Земля', craft: 'Ремесло', raid: 'Набег', hold: 'Твердыня', provN: 'Север', provS: 'Юг', provE: 'Восток', provW: 'Запад', none: 'без роли',
    deer: 'Олени', owl: 'Совы', wolf: 'Волки', rose: 'Розы', serpent: 'Змеи', moon: 'Лунные', bear: 'Медведи', lion: 'Львы', eagle: 'Орлы', sun: 'Солнечные', econ: 'экономика',
    seat: 'место при дворе', guard: 'стража', card: 'карта', action: 'действие', siege: 'осада', trash: 'убрать из игры', reroll: 'переброс', shift: 'сдвиг броска', tag: 'скидка', dawn: 'в начале хода',
    crown: 'лорд', foreign: 'великий лорд', spring: 'Весна', summer: 'Лето', autumn: 'Осень', winter: 'Зима', treasurer: 'Казначей', magister: 'Магистр', marshal: 'Маршал', whisperer: 'Тайный советник', landlord: 'Землевладелец', unifier: 'Объединитель', courtier: 'Первый при дворе', seigneur: 'Сеньор' };
  const src = Object.keys(MAP).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const RE = new RegExp(src, 'gu'), HAS = new RegExp(src, 'u');
  // слово вместе со значком («+2🪙», «⏳-замыслы») не разрывается переносом строки
  const WORD = new RegExp(`[^\\s<>]*(?:${src})[^\\s<>]*`, 'gu');
  // значок не отрывается и от следующего слова: «🟩 Ремесло», «🎲 7» — пробел становится неразрывным
  const GLUE = new RegExp(`(${src}) `, 'gu');
  const glue = (t) => t.replace(GLUE, '$1\u00a0');
  // типографика: предлоги, союзы и числа не остаются в конце строки, тире не начинает строку
  const SHORT = /(^|[\s(«„"\u00a0])((?:[А-ЯЁа-яёA-Za-z]{1,2}|для|при|без|под|над|про|или|раз|как|его|её|их|чей|всё|ещё)|[+−-]?\d+(?:[.,]\d+)?) (?=[^\s—–])/g;
  const typo = (t) => t.replace(SHORT, '$1$2\u00a0').replace(SHORT, '$1$2\u00a0').replace(/ ([—–]) /g, '\u00a0$1 ');
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- строка HTML (Node, печать карт) ----------
  let nodeSrc = null;
  function dataURI(key) {
    if (!nodeSrc) {
      const fs = require('fs'), path = require('path'), cache = {};
      const dir = path.join(__dirname, 'dist', 'icons');
      nodeSrc = (k) => cache[k] || (cache[k] = 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(dir, `i_${k}.svg`)).toString('base64'));
    }
    return nodeSrc(key);
  }
  function img(key, opts = {}) {
    const s = (opts.src || dataURI)(key);
    const st = opts.em ? ` style="width:${opts.em}em;height:${opts.em}em"` : '';
    return `<img class="ic ic-${key}${opts.cls ? ' ' + opts.cls : ''}" src="${s}" alt="${esc(opts.alt || NAME[key] || key)}" draggable="false"${st}>`;
  }
  function iconizeHTML(html, opts = {}) {
    let out = '', skip = false;
    for (const part of String(html).split(/(<[^>]*>)/)) {
      if (part[0] === '<') {
        const m = /^<(\/?)\s*(script|style|textarea|option|title)\b/i.exec(part);
        if (m) skip = !m[1];
        out += part;
      } else out += skip ? part : glue(typo(part)).replace(WORD, (w) => `<span class="icw">${w.replace(RE, (e) => img(MAP[e], Object.assign({ alt: e }, opts)))}</span>`);
    }
    return out;
  }

  // ---------- DOM (браузер) ----------
  const SKIP = /^(SCRIPT|STYLE|TEXTAREA|OPTION|SELECT|TITLE)$/;
  const XHTML = 'http://www.w3.org/1999/xhtml';
  function makeImg(key, e, srcFn) {
    const im = document.createElement('img');
    im.className = `ic ic-${key}`; im.src = srcFn(key); im.alt = e; im.draggable = false;
    return im;
  }
  function fixText(n, srcFn) {
    const s = n.nodeValue, p = n.parentNode;
    if (!s || !p || !HAS.test(s) || p.namespaceURI !== XHTML || SKIP.test(p.nodeName) || p.isContentEditable) return;
    const s2 = glue(typo(s));
    const frag = document.createDocumentFragment();
    let last = 0, w;
    WORD.lastIndex = 0;
    while ((w = WORD.exec(s2))) {
      if (w.index > last) frag.appendChild(document.createTextNode(s2.slice(last, w.index)));
      const span = document.createElement('span');
      span.className = 'icw';
      const t = w[0];
      let l2 = 0, m;
      RE.lastIndex = 0;
      while ((m = RE.exec(t))) {
        if (m.index > l2) span.appendChild(document.createTextNode(t.slice(l2, m.index)));
        span.appendChild(makeImg(MAP[m[0]], m[0], srcFn));
        l2 = m.index + m[0].length;
      }
      if (l2 < t.length) span.appendChild(document.createTextNode(t.slice(l2)));
      frag.appendChild(span);
      last = w.index + t.length;
    }
    if (last < s2.length) frag.appendChild(document.createTextNode(s2.slice(last)));
    p.replaceChild(frag, n);
  }
  function iconizeDOM(root, srcFn) {
    if (!root) return;
    if (root.nodeType === 3) return fixText(root, srcFn);
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1 && (SKIP.test(root.nodeName) || root.namespaceURI !== XHTML)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (HAS.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    const list = [];
    while (w.nextNode()) list.push(w.currentNode);
    list.forEach(n => fixText(n, srcFn));
  }
  function observe(root, srcFn) {
    iconizeDOM(root, srcFn);
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData') fixText(m.target, srcFn);
        else m.addedNodes.forEach(n => iconizeDOM(n, srcFn));
      }
    });
    mo.observe(root, { childList: true, subtree: true, characterData: true });
    return mo;
  }

  return { MAP, NAME, img, iconizeHTML, iconizeDOM, observe, dataURI, typo };
});
