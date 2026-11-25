// Распаковка рисунков: base64 → сырой DEFLATE (RFC 1951) → текст UTF-8. Синхронно, без библиотек; канонический Хаффман, как в zlib/puff.
function INFLATE(b64) {
  const bin = atob(b64), src = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) src[i] = bin.charCodeAt(i);
  let pos = 0, bb = 0, bc = 0, out = new Uint8Array(src.length * 4), ol = 0;
  const bits = (n) => { while (bc < n) { bb |= src[pos++] << bc; bc += 8; } const v = bb & ((1 << n) - 1); bb >>>= n; bc -= n; return v; };
  const room = (n) => { if (ol + n > out.length) { const o = new Uint8Array(Math.max(out.length * 2, ol + n)); o.set(out.subarray(0, ol)); out = o; } };
  const table = (len, n) => { const cnt = new Uint16Array(16), off = new Uint16Array(16), sym = new Uint16Array(n); for (let i = 0; i < n; i++) cnt[len[i]]++; cnt[0] = 0; for (let i = 1; i < 16; i++) off[i] = off[i - 1] + cnt[i - 1]; for (let i = 0; i < n; i++) if (len[i]) sym[off[len[i]]++] = i; return { cnt, sym }; };
  const decode = (t) => { let code = 0, first = 0, idx = 0; for (let l = 1; l < 16; l++) { code |= bits(1); const c = t.cnt[l]; if (code - first < c) return t.sym[idx + code - first]; idx += c; first = (first + c) << 1; code <<= 1; } throw new Error('inflate: bad code'); };
  const LB = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258], LE = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DB = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577], DE = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const ORD = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  let fixed = null;
  for (let last = 0; !last;) {
    last = bits(1); const type = bits(2);
    if (type === 0) { // без сжатия
      bb = 0; bc = 0; const n = src[pos] | (src[pos + 1] << 8); pos += 4; room(n); out.set(src.subarray(pos, pos + n), ol); ol += n; pos += n; continue;
    }
    let lt, dt;
    if (type === 1) {
      if (!fixed) { const l = new Uint8Array(288); l.fill(8, 0, 144); l.fill(9, 144, 256); l.fill(7, 256, 280); l.fill(8, 280, 288); fixed = [table(l, 288), table(new Uint8Array(30).fill(5), 30)]; }
      [lt, dt] = fixed;
    } else if (type === 2) {
      const hl = bits(5) + 257, hd = bits(5) + 1, hc = bits(4) + 4, cl = new Uint8Array(19);
      for (let i = 0; i < hc; i++) cl[ORD[i]] = bits(3);
      const ct = table(cl, 19), ls = new Uint8Array(hl + hd);
      for (let i = 0; i < hl + hd;) {
        const s = decode(ct);
        if (s < 16) ls[i++] = s;
        else { let r, v = 0; if (s === 16) { v = ls[i - 1]; r = 3 + bits(2); } else if (s === 17) r = 3 + bits(3); else r = 11 + bits(7); while (r--) ls[i++] = v; }
      }
      lt = table(ls.subarray(0, hl), hl); dt = table(ls.subarray(hl), hd);
    } else throw new Error('inflate: bad block');
    for (;;) {
      const s = decode(lt);
      if (s < 256) { room(1); out[ol++] = s; continue; }
      if (s === 256) break;
      const k = s - 257, len = LB[k] + bits(LE[k]), d = decode(dt), dist = DB[d] + bits(DE[d]);
      room(len); for (let i = 0; i < len; i++, ol++) out[ol] = out[ol - dist];
    }
  }
  return new TextDecoder('utf-8').decode(out.subarray(0, ol));
}
if (typeof module === 'object') module.exports = INFLATE;
