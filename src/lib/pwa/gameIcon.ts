/**
 * Draws a game's home-screen icon in the browser: the game kind's emoji on its
 * colours. Returns a PNG data URL, so the icon needs no server either.
 */
export interface IconStyle {
  emoji: string;
  /** Top of the background gradient (a light tint). */
  from: string;
  /** Bottom of the background gradient (the kind's colour). */
  to: string;
}

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

/**
 * - "any": a rounded tile with transparent corners (desktop, Android legacy).
 * - "maskable": full-bleed, emoji inside the safe zone (Android adaptive icons).
 * - "apple": full-bleed (iOS rounds the corners itself).
 */
export function drawGameIcon(style: IconStyle, size: number, shape: "any" | "maskable" | "apple"): string {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  if (!g) return "";

  const gradient = g.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, style.from);
  gradient.addColorStop(1, style.to);
  g.fillStyle = gradient;
  if (shape === "any") {
    roundedRect(g, 0, 0, size, size, size * 0.22);
    g.fill();
  } else {
    g.fillRect(0, 0, size, size);
  }

  // A soft glow behind the emoji so it reads on any colour.
  const glow = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.42);
  glow.addColorStop(0, "rgba(255,255,255,0.75)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, size, size);

  const scale = shape === "maskable" ? 0.42 : 0.56; // maskable keeps to the safe zone
  g.font = `${Math.round(size * scale)}px ${EMOJI_FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(style.emoji, size / 2, size * 0.54);

  return canvas.toDataURL("image/png");
}

function roundedRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
