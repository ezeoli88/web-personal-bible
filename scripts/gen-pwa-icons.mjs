import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BLUE = [26, 115, 232];
const WHITE = [255, 255, 255];

// Favicon geometry in a 32px grid: open page, rounded top-right, curled bottom-left.
const BOOK = [
  [9, 7],
  [19, 7],
  [21, 7.54],
  [22.46, 9],
  [23, 11],
  [23, 25],
  [13, 25],
  [11.97, 25.14],
  [11, 25.54],
  [10.17, 26.17],
  [9.54, 27],
  [9.14, 27.96],
  [9, 29],
];

const LINES = [
  [11, 12, 19, 12],
  [11, 16, 19, 16],
  [11, 20, 16, 20],
];

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([length, name, data, crc]);
}

function encodePng(width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const start = y * (width * 3 + 1);
    raw[start] = 0;
    rgb.copy(raw, start + 1, y * width * 3, (y + 1) * width * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const crosses = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function sample(u, v) {
  if (u < 0 || v < 0 || u > 32 || v > 32 || !pointInPoly(u, v, BOOK)) return BLUE;
  for (const [x1, y1, x2, y2] of LINES) {
    if (distanceToSegment(u, v, x1, y1, x2, y2) <= 0.72) return BLUE;
  }
  return WHITE;
}

function render(size, scale) {
  const samples = size >= 512 ? 2 : 4;
  const rgb = Buffer.alloc(size * size * 3);
  const draw = size * scale;
  const offset = (size - draw) / 2;
  const sampleCount = samples * samples;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + (sx + 0.5) / samples;
          const py = y + (sy + 0.5) / samples;
          const u = ((px - offset) / draw) * 32;
          const v = ((py - offset) / draw) * 32;
          const [cr, cg, cb] = sample(u, v);
          r += cr;
          g += cg;
          b += cb;
        }
      }
      const index = (y * size + x) * 3;
      rgb[index] = Math.round(r / sampleCount);
      rgb[index + 1] = Math.round(g / sampleCount);
      rgb[index + 2] = Math.round(b / sampleCount);
    }
  }
  return encodePng(size, size, rgb);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "public", "icons");
mkdirSync(iconsDir, { recursive: true });

const files = [
  ["public/icons/icon-192.png", 192, 1],
  ["public/icons/icon-512.png", 512, 1],
  // Maskable icons keep the book inside the center circle (about 80% of the canvas).
  ["public/icons/icon-maskable-192.png", 192, 0.7],
  ["public/icons/icon-maskable-512.png", 512, 0.7],
  ["public/apple-touch-icon.png", 180, 0.86],
];

for (const [relative, size, scale] of files) {
  const path = join(root, relative);
  writeFileSync(path, render(size, scale));
  process.stdout.write(`wrote ${relative}\n`);
}
