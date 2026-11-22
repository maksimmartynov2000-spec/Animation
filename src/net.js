// ===================== СЕТЬ: партия на нескольких устройствах =====================
// Связь — через бесплатные публичные MQTT-брокеры (MQTT 3.1.1 поверх WebSocket).
// Каждое сообщение уходит сразу на все брокеры из списка: не работает один — работают другие; копии отсеиваются по номеру.
// Брокер только пересылает сообщения и ничего не хранит. Партию ведёт устройство хозяина, остальные получают от него стол.
const Net = (() => {
  const DEFAULT = ['wss://broker.emqx.io:8084/mqtt', 'wss://test.mosquitto.org:8081/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
  const KEY = 'velikie-doma-net-brokers';
  const BASE = 'pretendenty-7c41';           // приставка тем: чтобы не пересекаться с чужими на общих брокерах
  const CODE_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // без I, L, O, 0, 1 — их легко спутать
  const enc = new TextEncoder(), dec = new TextDecoder();
  const u8 = (a) => Uint8Array.from(a);
  function cat(parts) { let n = 0; for (const p of parts) n += p.length; const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; }
  function mstr(s) { const b = enc.encode(s); return cat([u8([b.length >> 8, b.length & 255]), b]); }
  function varint(n) { const out = []; do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; out.push(d); } while (n > 0); return out; }
  const pkt = (first, body) => cat([u8([first, ...varint(body.length)]), body]);
  function rid(n, abc = 'abcdefghijklmnopqrstuvwxyz0123456789') { const r = crypto.getRandomValues(new Uint8Array(n)); let s = ''; for (const x of r) s += abc[x % abc.length]; return s; }
  const newCode = () => rid(5, CODE_ABC);
  const normCode = (s) => String(s || '').toUpperCase().split('').filter(c => CODE_ABC.includes(c)).join('').slice(0, 5);

  function brokers() {
    try { const x = JSON.parse(localStorage.getItem(KEY) || 'null'); if (Array.isArray(x) && x.length) return x; } catch (e) { /* нет настройки */ }
    const cfg = typeof window !== 'undefined' && window.PRETENDENTY_NET;
    return (cfg && Array.isArray(cfg.brokers) && cfg.brokers.length) ? cfg.brokers : DEFAULT;
  }
  function setBrokers(list) {
    try { if (list && list.length) localStorage.setItem(KEY, JSON.stringify(list)); else localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }
  const available = () => typeof WebSocket === 'function' && typeof window !== 'undefined' && !!window.PRETENDENTY_NET;

  // ---------- упаковка: JSON, большие сообщения — gzip (если браузер умеет) ----------
  const canGzip = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
  async function encode(obj, gz) {
    const raw = enc.encode(JSON.stringify(obj));
    if (gz && canGzip() && raw.length > 700) {
      const s = new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'));
      return cat([u8([1]), new Uint8Array(await new Response(s).arrayBuffer())]);
    }
    return cat([u8([0]), raw]);
  }
  async function decode(b) {
    if (!b || !b.length) return null;
    if (b[0] === 0) return JSON.parse(dec.decode(b.subarray(1)));
    if (b[0] === 1 && canGzip()) { const s = new Blob([b.subarray(1)]).stream().pipeThrough(new DecompressionStream('gzip')); return JSON.parse(await new Response(s).text()); }
    return null;
  }

  // ---------- одно соединение с брокером ----------
  class Conn {
    constructor(url, hub) { this.url = url; this.hub = hub; this.ws = null; this.up = false; this.buf = new Uint8Array(0); this.pid = 0; this.tries = 0; this.closed = false; this.lastIn = 0; this.open(); }
    open() {
      if (this.closed || this.ws) return;
      let ws;
      try { ws = new WebSocket(this.url, ['mqtt']); } catch (e) { this.retry(); return; }
      this.ws = ws; this.buf = new Uint8Array(0); this.t0 = Date.now();
      ws.binaryType = 'arraybuffer';
      ws.onopen = () => { this.lastIn = Date.now(); this.raw(pkt(0x10, cat([mstr('MQTT'), u8([4, 0x02, 0, 30]), mstr(this.hub.mqttId)]))); };
      ws.onmessage = (e) => { if (typeof e.data !== 'string') this.feed(new Uint8Array(e.data)); };
      ws.onclose = () => { if (this.ws !== ws) return; const was = this.up; this.up = false; this.ws = null; clearInterval(this.pt); if (was) this.hub.changed(); this.retry(); };
      ws.onerror = () => { /* дальше придёт onclose */ };
    }
    retry() {
      if (this.closed) return;
      const d = Math.min(30000, 1000 * 2 ** Math.min(this.tries++, 5)) * (0.7 + Math.random() * 0.6);
      clearTimeout(this.rt); this.rt = setTimeout(() => this.open(), d);
    }
    now() { clearTimeout(this.rt); this.tries = 0; if (!this.ws) this.open(); }
    // бросить сокет, не дожидаясь, пока браузер закроет его сам, и открыть новый
    drop() {
      const ws = this.ws, was = this.up;
      this.ws = null; this.up = false; clearInterval(this.pt); clearTimeout(this.ct);
      if (ws) { try { ws.close(); } catch (e) { /* ignore */ } }
      if (was) this.hub.changed();
      this.tries = 0; clearTimeout(this.rt); this.open();
    }
    // после блокировки экрана сокет часто «мёртв», хотя числится открытым: спрашиваем сервер и, если он молчит, открываем заново
    check(force) {
      if (this.closed) return;
      if (force) { this.drop(); return; }
      if (!this.ws) { this.now(); return; }
      if (!this.up) { if (Date.now() - (this.t0 || 0) > 8000) this.drop(); return; }
      const t = Date.now(); this.raw(u8([0xC0, 0]));
      clearTimeout(this.ct); this.ct = setTimeout(() => { if (!this.closed && this.up && this.lastIn < t) this.drop(); }, 2500);
    }
    raw(b) { try { if (this.ws && this.ws.readyState === 1) this.ws.send(b); } catch (e) { /* ignore */ } }
    feed(chunk) {
      this.lastIn = Date.now();
      this.buf = this.buf.length ? cat([this.buf, chunk]) : chunk;
      for (;;) {
        if (this.buf.length < 2) return;
        let len = 0, mul = 1, i = 1, b;
        do { if (i >= this.buf.length) return; b = this.buf[i++]; len += (b & 127) * mul; mul *= 128; } while ((b & 128) && i < 5);
        if (this.buf.length < i + len) return;
        const first = this.buf[0], body = this.buf.slice(i, i + len);
        this.buf = this.buf.slice(i + len);
        this.handle(first, body);
      }
    }
    handle(first, body) {
      const type = first >> 4;
      if (type === 2) { // CONNACK
        if (body[1] !== 0) { try { this.ws.close(); } catch (e) { /* ignore */ } return; }
        this.up = true; this.tries = 0;
        for (const t of this.hub.topics) this.sub(t);
        clearInterval(this.pt);
        this.pt = setInterval(() => {
          if (!this.ws) return;
          if (Date.now() - this.lastIn > 30000) { this.drop(); return; } // связь «повисла»
          this.raw(u8([0xC0, 0]));
        }, 12000);
        this.hub.changed();
      } else if (type === 3) { // PUBLISH
        const qos = (first >> 1) & 3, tl = (body[0] << 8) | body[1];
        const topic = dec.decode(body.subarray(2, 2 + tl));
        let o = 2 + tl;
        if (qos > 0) { const id = (body[o] << 8) | body[o + 1]; o += 2; if (qos === 1) this.raw(u8([0x40, 2, id >> 8, id & 255])); }
        this.hub.incoming(topic, body.slice(o));
      }
      // SUBACK и PINGRESP ответа не требуют
    }
    sub(topic) { this.pid = (this.pid % 65535) + 1; this.raw(pkt(0x82, cat([u8([this.pid >> 8, this.pid & 255]), mstr(topic), u8([0])]))); }
    pub(topic, payload) { if (this.up) this.raw(pkt(0x30, cat([mstr(topic), payload]))); }
    close() {
      this.closed = true; clearTimeout(this.rt); clearInterval(this.pt); clearTimeout(this.ct);
      const ws = this.ws; this.ws = null; this.up = false;
      if (ws) { try { if (ws.readyState === 1) ws.send(u8([0xE0, 0])); ws.close(); } catch (e) { /* ignore */ } }
    }
  }

  // ---------- все брокеры вместе ----------
  class Hub {
    constructor(onMsg, urls) {
      this.mqttId = 'prt' + rid(14);
      this.topics = new Set(); this.onMsg = onMsg; this.onStatus = null; this.pend = [];
      this.seen = new Set(); this.seenQ = [];
      this.rq = Promise.resolve(); this.wq = Promise.resolve();
      this.conns = (urls || brokers()).map(u => new Conn(u, this));
      this.wake = () => { if (typeof document === 'undefined' || document.visibilityState === 'visible') for (const c of this.conns) c.check(); };
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.wake);
      if (typeof window !== 'undefined') { window.addEventListener('online', this.wake); window.addEventListener('pageshow', this.wake); window.addEventListener('focus', this.wake); }
    }
    get online() { return this.conns.filter(c => c.up).length; }
    get lastIn() { return Math.max(0, ...this.conns.map(c => c.lastIn || 0)); }
    recheck(force) { for (const c of this.conns) c.check(force); }
    changed() {
      // связь появилась — отправить то, что накопилось, пока её не было
      if (this.online && this.pend.length) { const q = this.pend; this.pend = []; for (const [t, b] of q) for (const c of this.conns) c.pub(t, b); }
      if (this.onStatus) try { this.onStatus(this.online, this.conns.length); } catch (e) { /* ignore */ }
    }
    sub(topic) { this.topics.add(topic); for (const c of this.conns) if (c.up) c.sub(topic); }
    pub(topic, obj, gz) {
      this.wq = this.wq.then(() => encode(obj, gz)).then(b => {
        if (!this.online) { this.pend.push([topic, b]); if (this.pend.length > 40) this.pend.shift(); return; }
        for (const c of this.conns) c.pub(topic, b);
      }).catch(() => { /* ignore */ });
      return this.wq;
    }
    incoming(topic, bytes) {
      this.rq = this.rq.then(() => decode(bytes)).then(m => {
        if (!m || typeof m !== 'object' || !m.mid || this.seen.has(m.mid)) return;
        this.seen.add(m.mid); this.seenQ.push(m.mid);
        if (this.seenQ.length > 1500) this.seen.delete(this.seenQ.shift());
        this.onMsg(topic, m);
      }).catch(() => { /* битое сообщение — пропускаем */ });
    }
    close() {
      for (const c of this.conns) c.close();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.wake);
      if (typeof window !== 'undefined') { window.removeEventListener('online', this.wake); window.removeEventListener('pageshow', this.wake); window.removeEventListener('focus', this.wake); }
    }
  }

  // ---------- комната: хозяин слушает …/h, гости — …/g ----------
  // me — кто отправляет (номер устройства); каждое сообщение получает свой номер mid
  function room(code, role, me, onMsg, onStatus, urls) {
    const base = `${BASE}/${code}`;
    const inT = role === 'host' ? `${base}/h` : `${base}/g`;
    const outT = role === 'host' ? `${base}/g` : `${base}/h`;
    const hub = new Hub((t, m) => { if (t === inT) onMsg(m); }, urls);
    hub.onStatus = onStatus || null;
    hub.sub(inT);
    const tag = rid(6);
    let k = 0;
    return {
      code, hub,
      send(t, data, gz) { return hub.pub(outT, Object.assign({}, data || {}, { t, from: me, mid: `${tag}.${++k}` }), gz); },
      close() { hub.close(); },
      get online() { return hub.online; },
      get total() { return hub.conns.length; },
      recheck(force) { hub.recheck(force); },
    };
  }

  // ---------- проверка одного сервера: соединиться и дождаться ответа (для экрана «Проверка устройства») ----------
  function probe(url, ms = 6000) {
    return new Promise((res) => {
      const t0 = Date.now(); let ws = null, done = false;
      const end = (ok, why) => { if (done) return; done = true; clearTimeout(tm); try { if (ws) { ws.onclose = null; ws.onerror = null; ws.close(); } } catch (e) { /* ignore */ } res({ url, ok, ms: Date.now() - t0, why: why || '' }); };
      const tm = setTimeout(() => end(false, 'нет ответа'), ms);
      try { ws = new WebSocket(url, ['mqtt']); } catch (e) { end(false, 'не открылось'); return; }
      ws.binaryType = 'arraybuffer';
      ws.onopen = () => { try { ws.send(pkt(0x10, cat([mstr('MQTT'), u8([4, 0x02, 0, 30]), mstr('prt' + rid(14))]))); } catch (e) { end(false, 'не отправилось'); } };
      ws.onmessage = (e) => { const b = typeof e.data === 'string' ? [] : new Uint8Array(e.data); const ok = (b[0] >> 4) === 2 && b[3] === 0; end(ok, ok ? '' : 'сервер отказал'); };
      ws.onerror = () => end(false, 'ошибка соединения');
      ws.onclose = () => end(false, 'закрыто');
    });
  }

  return { DEFAULT, available, brokers, setBrokers, newCode, normCode, rid, room, encode, decode, canGzip, Hub, probe };
})();
if (typeof module !== 'undefined') module.exports = Net;
