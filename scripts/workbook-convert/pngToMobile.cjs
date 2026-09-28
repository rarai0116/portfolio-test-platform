'use strict';
/*
 * PNG をモバイル向けへ落とす: 8bit グレースケール化 + 縦横 1/2。
 *
 * 依存は node:zlib のみ。画像ライブラリを足さないのは、このツールが公開リポジトリへ
 * 運ばれる成果物であり、読む人が追える範囲に収めたいため。対象が
 * bitDepth=8 / colorType=2(RGB) or 6(RGBA) / 非インターレース に限られるので、
 * PNG の必要な部分だけを自前で扱えば足りる。
 *
 * 実測（1448x1086 中心の線画 44 枚）: 39.6MB -> 4.4MB（11.1%）。
 * 元画像はいずれも彩度ゼロ（RGB 各チャンネル差が最大 16 未満）で、モノクロの線画を
 * RGB として保存したものだった。グレースケール化は冗長な 2 チャンネルを捨てるだけで、
 * 知覚的な劣化は無い。
 *
 * 使い方:
 *   const { toMobilePng } = require('./pngToMobile.cjs');
 *   const { buffer, from, to } = toMobilePng(fs.readFileSync('in.png'));
 */

const zlib = require('node:zlib');
const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readChunks(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('PNG 署名が違う');
  const out = []; let o = 8;
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('ascii', o + 4, o + 8);
    out.push({ type, data: buf.subarray(o + 8, o + 8 + len) });
    o += 12 + len;
  }
  return out;
}
function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
}
function unfilter(raw, width, height, bpp) {
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let pos = 0;
  for (let y = 0; y < height; y += 1) {
    const ft = raw[pos]; pos += 1;
    const line = raw.subarray(pos, pos + stride); pos += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x += 1) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = (prev && x >= bpp) ? prev[x - bpp] : 0;
      let v = line[x];
      if (ft === 1) v += a; else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) v += paeth(a, b, c);
      else if (ft !== 0) throw new Error(`未知のフィルタ ${ft}`);
      cur[x] = v & 0xff;
    }
  }
  return out;
}
// 2x2 平均で 1/2 に縮小しつつ輝度へ落とす（線画の可読性を保つため単純間引きにしない）
function halveToGray(pixels, width, height, bpp) {
  const w2 = Math.max(1, width >> 1), h2 = Math.max(1, height >> 1);
  const out = Buffer.alloc(w2 * h2);
  const stride = width * bpp;
  for (let y = 0; y < h2; y += 1) {
    for (let x = 0; x < w2; x += 1) {
      let sum = 0, n = 0;
      for (let dy = 0; dy < 2; dy += 1) {
        const sy = y * 2 + dy; if (sy >= height) continue;
        for (let dx = 0; dx < 2; dx += 1) {
          const sx = x * 2 + dx; if (sx >= width) continue;
          const i = sy * stride + sx * bpp;
          sum += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
          n += 1;
        }
      }
      out[y * w2 + x] = Math.round(sum / n) & 0xff;
    }
  }
  return { gray: out, width: w2, height: h2 };
}
// 走査線ごとに 5 種のフィルタを試し、絶対値和が最小のものを選ぶ（標準的な heuristic）
function filterGray(gray, width, height) {
  const out = Buffer.alloc(height * (width + 1));
  for (let y = 0; y < height; y += 1) {
    const cur = gray.subarray(y * width, (y + 1) * width);
    const prev = y > 0 ? gray.subarray((y - 1) * width, y * width) : null;
    let best = null;
    for (let ft = 0; ft < 5; ft += 1) {
      const line = Buffer.alloc(width); let score = 0;
      for (let x = 0; x < width; x += 1) {
        const a = x >= 1 ? cur[x - 1] : 0;
        const b = prev ? prev[x] : 0;
        const c = (prev && x >= 1) ? prev[x - 1] : 0;
        let v;
        if (ft === 0) v = cur[x];
        else if (ft === 1) v = cur[x] - a;
        else if (ft === 2) v = cur[x] - b;
        else if (ft === 3) v = cur[x] - ((a + b) >> 1);
        else v = cur[x] - paeth(a, b, c);
        v &= 0xff; line[x] = v; score += v < 128 ? v : 256 - v;
      }
      if (best === null || score < best.score) best = { ft, line, score };
    }
    out[y * (width + 1)] = best.ft;
    best.line.copy(out, y * (width + 1) + 1);
  }
  return out;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}
let TABLE = null;
function crc32(buf) {
  if (!TABLE) {
    TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}
function toMobilePng(input) {
  const chunks = readChunks(input);
  const ihdr = chunks.find((c) => c.type === 'IHDR').data;
  const width = ihdr.readUInt32BE(0), height = ihdr.readUInt32BE(4);
  const depth = ihdr[8], ctype = ihdr[9], interlace = ihdr[12];
  if (depth !== 8 || interlace !== 0 || (ctype !== 2 && ctype !== 6)) {
    throw new Error(`未対応の PNG: depth=${depth} colorType=${ctype} interlace=${interlace}`);
  }
  const bpp = ctype === 2 ? 3 : 4;
  const raw = zlib.inflateSync(Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data)));
  const pixels = unfilter(raw, width, height, bpp);
  const { gray, width: w2, height: h2 } = halveToGray(pixels, width, height, bpp);
  const idat = zlib.deflateSync(filterGray(gray, w2, h2), { level: 9 });
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w2, 0); head.writeUInt32BE(h2, 4);
  head[8] = 8; head[9] = 0; head[10] = 0; head[11] = 0; head[12] = 0; // colorType 0 = グレースケール
  return {
    buffer: Buffer.concat([SIG, chunk('IHDR', head), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]),
    from: { width, height }, to: { width: w2, height: h2 },
  };
}
module.exports = { toMobilePng };
