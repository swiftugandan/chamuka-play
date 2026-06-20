/**
 * UI theming for game starters (emoji + colour), kept in the UI layer so the
 * domain registry in `lib/games` stays presentation-free. Keyed by starter id.
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
  drawing: {
    emoji: "🎨",
    color: "var(--color-lilac)",
    colorDark: "var(--color-lilac-dark)",
    tint: "#ece2ff",
  },
};

const FALLBACK: StarterTheme = THEMES.clicker;

export function starterTheme(id: string): StarterTheme {
  return THEMES[id] ?? FALLBACK;
}
