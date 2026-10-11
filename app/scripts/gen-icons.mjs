// SPDX-License-Identifier: GPL-3.0-or-later
// Placeholder PWA icons: a dark square with a light ring and dot (same geometry as public/icons/icon.svg),
// rasterised by a tiny distance test, written as plain PNG. Run once: node scripts/gen-icons.mjs
// The real artwork is the project owner's to design; replace the files in public/icons/ then.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const out = join(dirname(fileURLToPath(import.meta.url)), "../public/icons");
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (b) => {
  let c = 0xffffffff;
  for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const t = Buffer.concat([Buffer.from(type), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(t));
  return Buffer.concat([len, t, sum]);
};

/** scale: share of the canvas used by the artwork (maskable icons keep it inside the 80 % safe zone). */
function png(size, scale) {
  const bg = [0x1f, 0x2a, 0x44];
  const fg = [0xe8, 0xec, 0xf5];
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(size * stride);
  const ss = 3; // supersampling per axis, for smooth edges
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hit = 0;
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const u = ((x + (sx + 0.5) / ss) / size - 0.5) / scale;
          const v = ((y + (sy + 0.5) / ss) / size - 0.5) / scale;
          const d = Math.hypot(u, v) * 512;
          if ((d >= 148 && d <= 188) || d <= 48) hit++;
        }
      const a = hit / (ss * ss);
      for (let c = 0; c < 3; c++) raw[y * stride + 1 + x * 3 + c] = Math.round(bg[c] * (1 - a) + fg[c] * a);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

writeFileSync(join(out, "icon-192.png"), png(192, 1));
writeFileSync(join(out, "icon-512.png"), png(512, 1));
writeFileSync(join(out, "icon-maskable-512.png"), png(512, 0.8));
console.log("icons written to", out);
