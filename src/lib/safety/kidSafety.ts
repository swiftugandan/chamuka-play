const BLOCKED_WORDS = [
  "gore",
  "blood",
  "kill",
  "murder",
  "gun",
  "weapon",
  "sex",
  "sexy",
  "nude",
  "naked",
  "porn",
  "drug",
  "drugs",
  "alcohol",
  "suicide",
  "gambling",
];

export function isPromptSafeForKids(prompt: string): {
  safe: boolean;
  reason?: string;
} {
  const text = (prompt || "").toLowerCase();
  if (!text.trim()) return { safe: true };
  for (const word of BLOCKED_WORDS) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) {
      return {
        safe: false,
        reason:
          "Let's keep our games friendly and fun! Try a different idea — like an adventure, a puzzle, or a silly animal game.",
      };
    }
  }
  return { safe: true };
}
