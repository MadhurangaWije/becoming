// Generates PNG app icons with no dependencies: a four-quarter ring on white.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
// quarters clockwise from top: food, workout, learning, finance
const QUARTERS = ['#22C55E', '#2563EB', '#0EA5E9', '#0A0A0A'].map(hex);

function icon(size, scale) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const c = size / 2, outer = size * 0.36 * scale, inner = size * 0.24 * scale, gap = 0.08;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let px = [255, 255, 255];
      let alpha = 0; // anti-alias via 4x supersampling
      let col = null;
      for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
        const dx = x + (sx + 0.5) / 2 - c, dy = y + (sy + 0.5) / 2 - c;
        const r = Math.hypot(dx, dy);
        if (r <= outer && r >= inner) {
          let a = Math.atan2(dx, -dy); if (a < 0) a += Math.PI * 2;
          const q = Math.floor(a / (Math.PI / 2));
          const within = a - q * (Math.PI / 2);
          if (within > gap && within < Math.PI / 2 - gap) { alpha += 0.25; col = QUARTERS[q]; }
        }
      }
      if (col) px = px.map((v, i) => Math.round(v * (1 - alpha) + col[i] * alpha));
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = px[0]; raw[o + 1] = px[1]; raw[o + 2] = px[2]; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync('public/icon-192.png', icon(192, 1.15));
writeFileSync('public/icon-512.png', icon(512, 1.15));
writeFileSync('public/icon-maskable-192.png', icon(192, 0.9));
writeFileSync('public/icon-maskable-512.png', icon(512, 0.9));
writeFileSync('public/apple-touch-icon.png', icon(180, 1.0));
writeFileSync('public/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g fill="none" stroke-width="5">
<path d="M16 4a12 12 0 0 1 12 12" stroke="#22C55E"/><path d="M28 16a12 12 0 0 1-12 12" stroke="#2563EB"/>
<path d="M16 28A12 12 0 0 1 4 16" stroke="#0EA5E9"/><path d="M4 16A12 12 0 0 1 16 4" stroke="#0A0A0A"/></g></svg>`);
console.log('icons written');
