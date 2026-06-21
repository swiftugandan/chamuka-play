"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { pickHero } from "@/lib/diff/heroSnippet";
import { useFirstTime } from "@/lib/onboarding/useFirstTime";
import type { AppliedEdit } from "@/lib/ai/schema";

// Show the full snippet when both sides are short enough to keep context
// ("speed = 5" → "speed = 9"); otherwise fall back to just the changed span.
const HERO_FULL_CAP = 40;

export function ChangeBubble({
  prompt,
  instruction,
  summary,
  edits,
  isFirst,
  isNewest,
}: {
  prompt?: string;
  instruction?: string;
  summary?: string;
  edits?: AppliedEdit[];
  isFirst?: boolean;
  isNewest?: boolean;
}) {
  const [showCode, setShowCode] = useState(false);
  // The very first time a child ever opens the real code, frame what they're
  // looking at. `intro` holds it open for this reveal; the flag retires it forever.
  const [firstCodeReveal, markCodeSeen] = useFirstTime("code-reveal");
  const [intro, setIntro] = useState(false);

  function toggleCode() {
    // Side effects (and the shared store's notify) must run in the handler, not in
    // the setState updater, which React executes during render.
    const opening = !showCode;
    if (opening && firstCodeReveal) {
      setIntro(true);
      markCodeSeen();
    } else if (!opening) {
      setIntro(false);
    }
    setShowCode(opening);
  }

  const youSaid = instruction ?? prompt ?? "";
  const mishiSaid = summary || (isFirst ? "Here's your game! 🎮" : "All done! ✨");
  const hero = edits && edits.length > 0 ? pickHero(edits) : null;

  const heroPair =
    hero &&
    (hero.find.length <= HERO_FULL_CAP && hero.replace.length <= HERO_FULL_CAP
      ? { before: hero.find, after: hero.replace }
      : { before: hero.before || "(nothing)", after: hero.after || "(nothing)" });

  return (
    <div className="flex flex-col gap-2">
      {/* What the child asked for */}
      {youSaid && (
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-md bg-grape px-3.5 py-2 text-[15px] font-bold text-white shadow-[0_3px_0_var(--color-grape-dark)]">
            <span className="mr-1.5" aria-hidden="true">
              🧒
            </span>
            {youSaid}
          </div>
        </div>
      )}

      {/* What Mishi did */}
      <div className="flex justify-start">
        <div
          className={`max-w-[92%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 shadow-[0_3px_0_#ece3f7] ${
            isNewest ? "anim-float" : ""
          }`}
        >
          <p className="text-[15px] font-bold text-ink">
            <span className="mr-1.5 text-grape" aria-hidden="true">
              ✦
            </span>
            {mishiSaid}
          </p>

          {hero && heroPair && (
            <div className="mt-2 rounded-xl bg-cloud px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[13px] font-semibold">
                <code className="rounded-md bg-[#ffe3ec] px-1.5 py-0.5 text-[#c0264f] line-through decoration-2">
                  {heroPair.before}
                </code>
                <span aria-hidden="true" className="text-ink-soft">
                  →
                </span>
                <code className="rounded-md bg-[#d8f8ec] px-1.5 py-0.5 text-[#0a7d5e]">
                  {heroPair.after}
                </code>
                <span aria-hidden="true">✨</span>
              </div>
              {hero.because && (
                <p className="mt-1.5 text-[13px] font-semibold text-ink-soft">
                  {hero.because}
                </p>
              )}
            </div>
          )}

          {edits && edits.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={toggleCode}
                aria-expanded={showCode}
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-bold text-grape hover:bg-cloud"
              >
                <Search size={14} />
                {showCode ? "Hide the code" : "See all the code that changed"}
              </button>

              {showCode && intro && (
                <div className="mt-2 rounded-xl bg-[#fff4d6] px-3 py-2 text-[13px] font-semibold text-[#8a6a00]">
                  👀 This is the real code that runs your game! You don&apos;t
                  have to read it — but every change you make lives in here.
                </div>
              )}

              {showCode && (
                <div
                  role="region"
                  aria-label="all the code that changed"
                  className="mt-2 overflow-x-auto rounded-xl bg-[#1d1340] p-2.5 font-mono text-[12px] leading-relaxed"
                >
                  <p className="mb-2 font-sans text-[11px] font-semibold text-[#a99ad0]">
                    <span className="text-[#ff9bbd]">Pink</span> lines are the
                    old way · <span className="text-[#7df0c4]">green</span> lines
                    are the new way
                  </p>
                  {edits.map((e, i) => (
                    <div key={i} className="mb-1.5 last:mb-0">
                      <div className="flex gap-2 rounded bg-[#3a1530] px-2 py-0.5 text-[#ff9bbd]">
                        <span aria-hidden="true" className="select-none opacity-70">
                          −
                        </span>
                        <code className="whitespace-pre-wrap break-all">
                          {e.find}
                        </code>
                      </div>
                      <div className="flex gap-2 rounded bg-[#0f3a2c] px-2 py-0.5 text-[#7df0c4]">
                        <span aria-hidden="true" className="select-none opacity-70">
                          +
                        </span>
                        <code className="whitespace-pre-wrap break-all">
                          {e.replace}
                        </code>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
