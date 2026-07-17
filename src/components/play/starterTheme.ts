/**
 * UI theming for game starters (emoji + colour), kept in the UI layer so the
 * domain registry in `lib/games` stays presentation-free. Keyed by starter id.
 *
 * This map outlives the registry: `GAME_STARTERS` is the kinds you can make
 * *now*, while this is how any starter id — past or present — renders, because
 * saved games in IndexedDB keep the id they were made with.
 */
export interface StarterTheme {
  emoji: string;
  /** CSS colour for borders/icons (a theme token reference). */
  color: string;
  /** Darker shade used for the tactile bottom edge. */
  colorDark: string;
  /** Soft tint for icon backgrounds and selected state. */
  tint: string;
}

const THEMES: Record<string, StarterTheme> = {
  clicker: {
    emoji: "👆",
    color: "var(--color-sun)",
    colorDark: "var(--color-sun-dark)",
    tint: "#fff2d2",
  },
  catch: {
    emoji: "🪣",
    color: "var(--color-sky)",
    colorDark: "var(--color-sky-dark)",
    tint: "#dcf0ff",
  },
  maze: {
    emoji: "🧩",
    color: "var(--color-mint)",
    colorDark: "var(--color-mint-dark)",
    tint: "#d2f7ee",
  },
  quiz: {
    emoji: "❓",
    color: "var(--color-coral)",
    colorDark: "var(--color-coral-dark)",
    tint: "#ffe2db",
  },
  anything: {
    emoji: "✨",
    color: "var(--color-grape)",
    colorDark: "var(--color-grape-dark)",
    tint: "#e7dbff",
  },
  // Retired from GAME_STARTERS, but kept here: this map renders any starter id
  // ever saved, and games made with it still live in the child's IndexedDB.
  drawing: {
    emoji: "🎨",
    color: "var(--color-lilac)",
    colorDark: "var(--color-lilac-dark)",
    tint: "#ece2ff",
  },
  memory: {
    emoji: "🧠",
    color: "var(--color-bubble)",
    colorDark: "var(--color-bubble-dark)",
    tint: "#ffe0ef",
  },
  math: {
    emoji: "🔢",
    color: "var(--color-indigo)",
    colorDark: "var(--color-indigo-dark)",
    tint: "#e6e9ff",
  },
  spelling: {
    emoji: "🔤",
    color: "var(--color-rose)",
    colorDark: "var(--color-rose-dark)",
    tint: "#ffe4ec",
  },
  typing: {
    emoji: "⌨️",
    color: "var(--color-teal)",
    colorDark: "var(--color-teal-dark)",
    tint: "#d5f5f3",
  },
};

const FALLBACK: StarterTheme = THEMES.clicker;

export function starterTheme(id: string): StarterTheme {
  return THEMES[id] ?? FALLBACK;
}
