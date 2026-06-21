"use client";
import { Lightbulb } from "lucide-react";

/**
 * Tappable "what to try next" chips shown above the change box. Each chip models
 * a good prompt; tapping one drops its text into the input so the child can read,
 * tweak, and send it — keeping prompting the skill being practised.
 */
export function RefineSuggestions({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick: (suggestion: string) => void;
}) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="pt-1">
      <p className="font-display mb-2 flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-[0.1em] text-ink-soft">
        <Lightbulb size={14} className="text-sun-dark" />
        Try asking Mishi…
      </p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-full border-2 border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-grape hover:text-grape"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
