import sharp from "sharp";
import path from "node:path";
import { mkdir } from "node:fs/promises";

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

await mkdir(outDir, { recursive: true });
const base = iconSVG(0.64);
const maskable = iconSVG(0.52);
await render(base, 192, "icon-192.png");
await render(base, 512, "icon-512.png");
await render(base, 180, "apple-icon-180.png");
await render(maskable, 512, "icon-maskable-512.png");
