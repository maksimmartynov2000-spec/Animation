// Листание открытой карты влево-вправо — общий модуль браузерной игры и каталога карт.
// Лента из пяти мест: по две соседние карты с каждой стороны, текущая в центре; ближние соседи видны по краям.
// Карта едет за пальцем (мышью — если тянуть саму карту); отпустили дальше трети карты или резким движением —
// лента докручивается к соседней, иначе возвращается на место. Стрелки ‹ ›, счётчик «N из M», по кругу.
// Подсказка-жест при первом открытии: лента качнётся и всплывёт «листайте» — пока человек ни разу не перелистнул
// (не чаще раза за загрузку и не больше трёх раз всего).
//   CardNav.bind(sheet, { active() → bool, step(k) })      — один раз на лист (элемент с прокруткой): step(k) меняет
//                                                             номер и перерисовывает лист, затем страница снова зовёт decorate
//   CardNav.decorate(host, { i, n, dir, peek(k) → html })  — после каждой отрисовки; host — контейнер с крупной картой .pcw,
//                                                             peek(k) — разметка соседа: k = −2, −1, 1, 2
//   CardNav.go(sheet, k)                                     — перелистнуть с анимацией (клавиши ← →)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CardNav = factory();
})(this, function () {
  'use strict';
  const GAP = 14, SCALE = 0.92, DIM = 0.5;
  const PAD_L = 'max(16px, env(safe-area-inset-left, 0px))', PAD_R = 'max(16px, env(safe-area-inset-right, 0px))';
  const CSS = `
.cn-sheet { touch-action: pan-y; touch-action: pan-y pinch-zoom; }
.cn-host.navable { grid-template-columns: minmax(0, 1fr); }
.cn-stage { position: relative; overflow: hidden; margin: -8px calc(-1 * ${PAD_R}) -14px calc(-1 * ${PAD_L}); padding: 8px 0 14px; -webkit-user-select: none; user-select: none; }
.cn-stage img { -webkit-user-drag: none; }
.cn-track { position: relative; width: min(320px, calc(100% - 84px)); margin: 0 auto; }
.cn-cur { position: relative; z-index: 1; }
.cn-peek { position: absolute; top: 0; width: 100%; opacity: ${DIM}; transform: scale(${SCALE}); cursor: pointer; -webkit-tap-highlight-color: transparent; }
.cn-peek.p1 { right: calc(100% + ${GAP}px); transform-origin: 100% 50%; }
.cn-peek.p2 { right: calc(200% + ${2 * GAP}px); transform-origin: 100% 50%; }
.cn-peek.n1 { left: calc(100% + ${GAP}px); transform-origin: 0 50%; }
.cn-peek.n2 { left: calc(200% + ${2 * GAP}px); transform-origin: 0 50%; }
.cn-peek .pcw { pointer-events: none; }
.cn-stage > .cnav { position: absolute; top: 50%; z-index: 3; width: 42px; height: 42px; margin-top: -21px; border-radius: 50%; border: 1px solid rgba(255, 255, 255, .3); background: rgba(24, 20, 16, .74); color: #fff; font: 600 28px/1 system-ui, sans-serif; display: grid; place-items: center; padding: 0 0 3px; cursor: pointer; box-shadow: 0 2px 8px rgba(0, 0, 0, .3); -webkit-tap-highlight-color: transparent; }
.cn-stage > .cnav.prev { left: max(6px, env(safe-area-inset-left, 0px)); }
.cn-stage > .cnav.next { right: max(6px, env(safe-area-inset-right, 0px)); }
.cn-stage > .cnav:active { transform: scale(.93); }
.cn-stage > .cnav:focus-visible { outline: 3px solid #e9b949; outline-offset: 2px; }
.cnav-n { text-align: center; color: var(--muted, #8a8172); font-size: 13px; margin: 0; font-variant-numeric: tabular-nums; }
.cn-hint { position: absolute; left: 50%; top: 50%; z-index: 4; transform: translate(-50%, -50%); padding: 9px 16px; border-radius: 999px; background: rgba(24, 20, 16, .86); color: #fff; font: 600 15px/1.2 system-ui, sans-serif; white-space: nowrap; pointer-events: none; opacity: 0; box-shadow: 0 4px 14px rgba(0, 0, 0, .3); }
`;
  let cssOn = false;
  function injectCSS() {
    if (cssOn || typeof document === 'undefined') return;
    cssOn = true;
    const s = document.createElement('style');
    s.id = 'cardnav-css';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  const reduce = () => !!(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // память устройства: научился ли человек листать. Не обязательна: без неё подсказка просто покажется ещё раз
  const KEY = 'pretendenty.cardnav';
  let mem = {};
  try { mem = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { mem = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* хранилище недоступно */ } };
  const learned = () => !!mem.learned;
  function markLearned() { if (!mem.learned) { mem.learned = 1; save(); } }
  let hinted = false; // за эту загрузку подсказку уже показали

  // после перетаскивания мышью браузер может прислать «клик» — его глотаем, чтобы не сработала стрелка или фон листа
  let quietUntil = 0;
  if (typeof document !== 'undefined') {
    document.addEventListener('click', (e) => { if (now() < quietUntil) { e.stopPropagation(); e.preventDefault(); } }, true);
  }

  function decorate(host, o) {
    injectCSS();
    const card = host && host.querySelector('.pcw');
    if (!card || !(o.n > 1)) return;
    host.classList.add('cn-host', 'navable');
    const stage = document.createElement('div');
    stage.className = 'cn-stage';
    const track = document.createElement('div');
    track.className = 'cn-track';
    card.replaceWith(stage);
    const cur = document.createElement('div');
    cur.className = 'cn-cur';
    cur.appendChild(card);
    const slot = (k, cls) => {
      const s = document.createElement('div');
      s.className = 'cn-peek ' + cls;
      s.setAttribute('aria-hidden', 'true');
      if (Math.abs(k) === 1) s.dataset.cnGo = String(k);
      s.innerHTML = o.peek(k) || '';
      return s;
    };
    track.append(slot(-2, 'p2'), slot(-1, 'p1'), cur, slot(1, 'n1'), slot(2, 'n2'));
    stage.appendChild(track);
    stage.insertAdjacentHTML('beforeend', '<button type="button" class="cnav prev" data-cn-go="-1" aria-label="Предыдущая карта">‹</button><button type="button" class="cnav next" data-cn-go="1" aria-label="Следующая карта">›</button>');
    host.insertAdjacentHTML('afterend', `<p class="cnav-n">${o.i + 1} из ${o.n}${learned() ? '' : ' · листайте влево-вправо'}</p>`);
    if (!o.dir && !learned() && !hinted && (mem.hints || 0) < 3) {
      hinted = true;
      mem.hints = (mem.hints || 0) + 1;
      save();
      hint(stage, track);
    }
  }

  // подсказка: всплывает «листайте», лента качается влево и вправо, показывая соседей
  function hint(stage, track) {
    const pill = document.createElement('div');
    pill.className = 'cn-hint';
    pill.textContent = '← листайте →';
    stage.appendChild(pill);
    if (typeof pill.animate !== 'function') { setTimeout(() => pill.remove(), 2600); return; }
    const a = [pill.animate([{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 2400, delay: 450, fill: 'both' })];
    if (!reduce()) a.push(track.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-46px)', offset: 0.3 }, { transform: 'translateX(0)', offset: 0.55 }, { transform: 'translateX(22px)', offset: 0.75 }, { transform: 'translateX(0)' }], { duration: 1500, delay: 650, easing: 'ease-in-out' }));
    a[0].onfinish = () => { pill.remove(); stage._stopHint = null; };
    stage._stopHint = () => { stage._stopHint = null; for (const x of a) x.cancel(); pill.remove(); };
  }
  function stopHint(sheet) { const s = sheet.querySelector('.cn-stage'); if (s && s._stopHint) s._stopHint(); }

  function grab(sheet) {
    const track = sheet.querySelector('.cn-track');
    if (!track) return null;
    return { track, w: track.offsetWidth + GAP, cur: track.querySelector('.cn-cur'), p1: track.querySelector('.p1'), n1: track.querySelector('.n1') };
  }
  // положение ленты: p — доля пути до соседней карты (−1 — следующая в центре, 1 — предыдущая)
  function setPos(d, p) {
    p = Math.max(-1, Math.min(1, p));
    const a = Math.abs(p);
    d.track.style.transform = `translateX(${(p * d.w).toFixed(1)}px)`;
    d.cur.style.transformOrigin = p < 0 ? '100% 50%' : '0 50%';
    d.cur.style.transform = `scale(${(1 - (1 - SCALE) * a).toFixed(4)})`;
    d.cur.style.opacity = (1 - (1 - DIM) * a).toFixed(3);
    const inc = p < 0 ? d.n1 : d.p1, oth = p < 0 ? d.p1 : d.n1;
    inc.style.transform = `scale(${(SCALE + (1 - SCALE) * a).toFixed(4)})`;
    inc.style.opacity = (DIM + (1 - DIM) * a).toFixed(3);
    oth.style.transform = oth.style.opacity = '';
  }
  function clear(d) { for (const el of [d.track, d.cur, d.p1, d.n1]) el.style.transform = el.style.opacity = el.style.transformOrigin = ''; }
  function tween(st, d, from, to, done) {
    if (st.busy) st.busy.finish();
    let raf = 0, over = false;
    const end = () => { if (over) return; over = true; if (raf) cancelAnimationFrame(raf); st.busy = null; setPos(d, to); done(); };
    const ms = reduce() ? 0 : Math.round(Math.max(110, 260 * Math.abs(to - from)));
    if (!ms) { end(); return; }
    const t0 = now(), ease = (t) => 1 - Math.pow(1 - t, 3);
    const tick = () => {
      const t = Math.min(1, (now() - t0) / ms);
      setPos(d, from + (to - from) * ease(t));
      if (t < 1) raf = requestAnimationFrame(tick); else end();
    };
    st.busy = { finish: end };
    raf = requestAnimationFrame(tick);
  }

  function go(sheet, k, from) {
    const st = sheet && sheet._cn;
    if (!st || !st.ctl.active()) return;
    if (st.busy) st.busy.finish();
    stopHint(sheet);
    markLearned();
    const d = grab(sheet);
    if (!d || reduce()) { st.ctl.step(k); return; }
    tween(st, d, from || 0, k > 0 ? -1 : 1, () => st.ctl.step(k));
  }

  function bind(sheet, ctl) {
    injectCSS();
    if (sheet._cn) { sheet._cn.ctl = ctl; return; }
    const st = sheet._cn = { ctl, busy: null, drag: null };
    sheet.classList.add('cn-sheet');
    sheet.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('[data-cn-go]');
      if (!b || !sheet.contains(b)) return;
      e.preventDefault();
      e.stopPropagation();
      go(sheet, +b.dataset.cnGo);
    });
    sheet.addEventListener('dragstart', (e) => { if (e.target.closest && e.target.closest('.cn-stage')) e.preventDefault(); });
    sheet.addEventListener('pointerdown', (e) => {
      if (st.drag || e.isPrimary === false || !st.ctl.active()) return;
      // мышью тянут саму карту; пальцем — где угодно на листе
      if (e.pointerType === 'mouse' && (e.button !== 0 || !e.target.closest('.cn-stage') || e.target.closest('button'))) return;
      if (!sheet.querySelector('.cn-track')) return;
      if (st.busy) st.busy.finish();
      stopHint(sheet);
      const d = grab(sheet);
      if (!d) return;
      st.drag = Object.assign(d, { id: e.pointerId, x0: e.clientX, y0: e.clientY, axis: null, dx: 0, lx: e.clientX, lt: e.timeStamp, vx: 0 });
    });
    sheet.addEventListener('pointermove', (e) => {
      const d = st.drag;
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
      if (!d.axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dx) <= Math.abs(dy) * 1.15) { st.drag = null; return; } // вертикально — это прокрутка листа
        d.axis = 'x';
        try { sheet.setPointerCapture(e.pointerId); } catch (err) { /* без захвата тоже работает */ }
      }
      const dt = e.timeStamp - d.lt;
      if (dt > 0) { d.vx = 0.6 * ((e.clientX - d.lx) / dt) + 0.4 * d.vx; d.lx = e.clientX; d.lt = e.timeStamp; }
      d.dx = dx;
      setPos(d, dx / d.w);
    });
    const end = (e) => {
      const d = st.drag;
      if (!d || e.pointerId !== d.id) return;
      st.drag = null;
      if (!d.axis) return;
      quietUntil = now() + 350;
      const p = Math.max(-1, Math.min(1, d.dx / d.w));
      const fling = Math.abs(d.vx) > 0.45 && Math.sign(d.vx) === Math.sign(d.dx) && Math.abs(d.dx) > 24;
      if (e.type === 'pointerup' && (Math.abs(p) > 0.3 || fling)) go(sheet, d.dx < 0 ? 1 : -1, p);
      else tween(st, d, p, 0, () => clear(d));
    };
    sheet.addEventListener('pointerup', end);
    sheet.addEventListener('pointercancel', end);
  }

  return { bind, decorate, go, learned, markLearned, CSS };
});
