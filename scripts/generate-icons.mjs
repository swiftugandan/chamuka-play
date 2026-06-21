import sharp from "sharp";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

// Mishi (happy mood) — same paths/colors as src/components/play/Mascot.tsx.
const MISHI = `
  <defs>
    <linearGradient id="mishi" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#a06bff"/>
      <stop offset="1" stop-color="#7a3cf0"/>
    </linearGradient>
  </defs>
  <path d="M24 96 q-14 6 -16 22" stroke="#5b23c2" stroke-width="11" stroke-linecap="round" fill="none"/>
  <path d="M126 96 q14 6 16 22" stroke="#5b23c2" stroke-width="11" stroke-linecap="round" fill="none"/>
  <path d="M75 30 C40 30 26 56 26 86 C26 118 48 138 75 138 C102 138 124 118 124 86 C124 56 110 30 75 30Z" fill="url(#mishi)"/>
  <ellipse cx="56" cy="74" rx="14" ry="16" fill="#fff"/>
  <ellipse cx="94" cy="74" rx="14" ry="16" fill="#fff"/>
  <circle cx="58" cy="77" r="6.5" fill="#2b1454"/>
  <circle cx="92" cy="77" r="6.5" fill="#2b1454"/>
  <circle cx="55" cy="74" r="2.2" fill="#fff"/>
  <circle cx="89" cy="74" r="2.2" fill="#fff"/>
  <circle cx="44" cy="98" r="7" fill="#ff7fb8" opacity="0.7"/>
  <circle cx="106" cy="98" r="7" fill="#ff7fb8" opacity="0.7"/>
  <path d="M59 93 Q75 109 91 93" fill="none" stroke="#3a1c6e" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
`;

// `scale` = fraction of the 512 canvas the mascot occupies. Maskable uses a
// smaller scale so the mascot stays inside the mask safe zone.
function iconSVG(scale) {
  const canvas = 512;
  const inner = Math.round(canvas * scale);
  const pad = Math.round((canvas - inner) / 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas}" height="${canvas}" viewBox="0 0 ${canvas} ${canvas}">
  <rect width="${canvas}" height="${canvas}" fill="#fbf3ff"/>
  <svg x="${pad}" y="${pad}" width="${inner}" height="${inner}" viewBox="0 0 150 150">${MISHI}</svg>
</svg>`;
}

const outDir = path.join(process.cwd(), "public");

async function render(svg, size, name) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(path.join(outDir, name));
  console.log("wrote", name);
}

// Pack one or more square PNGs into a single .ico container (sharp can't write
// ICO, so we assemble the format by hand: a 6-byte header, one 16-byte
// directory entry per image, then the PNG blobs back to back).
async function makeIco(svg, sizes) {
  const pngs = await Promise.all(
    sizes.map((s) =>
      sharp(Buffer.from(svg)).resize(s, s).png().toBuffer(),
    ),
  );
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(sizes.length, 4); // image count
  let offset = 6 + 16 * sizes.length;
  const entries = sizes.map((s, i) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(s >= 256 ? 0 : s, 0); // width (0 means 256)
    e.writeUInt8(s >= 256 ? 0 : s, 1); // height
    e.writeUInt8(0, 2); // palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(pngs[i].length, 8); // image size
    e.writeUInt32LE(offset, 12); // image offset
    offset += pngs[i].length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...pngs]);
}

await mkdir(outDir, { recursive: true });
const base = iconSVG(0.64);
const maskable = iconSVG(0.52);
await render(base, 192, "icon-192.png");
await render(base, 512, "icon-512.png");
await render(base, 180, "apple-icon-180.png");
await render(maskable, 512, "icon-maskable-512.png");

// Browser tab favicon: a branded multi-resolution .ico in the app root, which
// Next auto-serves and links from app/favicon.ico.
const appDir = path.join(process.cwd(), "src", "app");
await writeFile(path.join(appDir, "favicon.ico"), await makeIco(base, [16, 32, 48]));
console.log("wrote favicon.ico");
