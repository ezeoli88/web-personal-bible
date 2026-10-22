import { deflateSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const BLUE = [0x1a, 0x73, 0xe8];
const BLUE_CSS = "#1a73e8";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, "public", "icons", "icon.svg");
const OPENING = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">';
const PLATE = '<rect id="plate" width="32" height="32" fill="#1a73e8"/>';
const FAVICON_PLATE = '<rect id="plate" width="32" height="32" rx="6" fill="#1a73e8"/>';

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

function rgbaToRgb(size, pixels) {
  if (pixels.length !== size * size * 4) {
    throw new Error(`expected ${size * size * 4} RGBA bytes, got ${pixels.length}`);
  }
  const rgb = Buffer.alloc(size * size * 3);
  for (let i = 0, j = 0; i < pixels.length; i += 4, j += 3) {
    const alpha = pixels[i + 3] / 255;
    rgb[j] = Math.round(pixels[i] * alpha + BLUE[0] * (1 - alpha));
    rgb[j + 1] = Math.round(pixels[i + 1] * alpha + BLUE[1] * (1 - alpha));
    rgb[j + 2] = Math.round(pixels[i + 2] * alpha + BLUE[2] * (1 - alpha));
  }
  return rgb;
}

function render(svg, size, scale) {
  const inner = Math.round(size * scale);
  const offset = Math.floor((size - inner) / 2);
  if (!svg.includes(OPENING)) throw new Error("public/icons/icon.svg must keep its opening tag");
  const nested = svg.replace(
    OPENING,
    `<svg xmlns="http://www.w3.org/2000/svg" x="${offset}" y="${offset}" width="${inner}" height="${inner}" viewBox="0 0 32 32">`,
  );
  const wrapped = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BLUE_CSS}"/>
  ${nested}
</svg>`;
  const image = new Resvg(wrapped, {
    fitTo: { mode: "width", value: size },
    background: BLUE_CSS,
    shapeRendering: 2,
    font: { loadSystemFonts: false },
  }).render();
  if (image.width !== size || image.height !== size) {
    throw new Error(`rendered ${image.width}x${image.height}, expected ${size}x${size}`);
  }
  return encodePng(size, size, rgbaToRgb(size, image.pixels));
}

const source = readFileSync(sourcePath, "utf8");
if (!source.includes(PLATE)) throw new Error("public/icons/icon.svg is missing the full-bleed plate");
if (!source.includes('id="open-bible"')) throw new Error("public/icons/icon.svg is missing the open-bible mark");

const iconsDir = join(root, "public", "icons");
mkdirSync(iconsDir, { recursive: true });

writeFileSync(join(root, "public", "favicon.svg"), source.replace(PLATE, FAVICON_PLATE));
process.stdout.write("wrote public/favicon.svg\n");

const files = [
  ["public/icons/icon-192.png", 192, 1],
  ["public/icons/icon-512.png", 512, 1],
  // Maskable icons keep the book inside the center 80% safe circle.
  ["public/icons/icon-maskable-192.png", 192, 0.7],
  ["public/icons/icon-maskable-512.png", 512, 0.7],
  ["public/apple-touch-icon.png", 180, 0.86],
];

for (const [relative, size, scale] of files) {
  writeFileSync(join(root, relative), render(source, size, scale));
  process.stdout.write(`wrote ${relative}\n`);
}
