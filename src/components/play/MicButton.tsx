"use client";
import { Mic } from "lucide-react";
import { useRef } from "react";
import { useSpeechInput } from "@/lib/voice/useSpeechInput";

/**
 * "Talk to type" mic for a text field — the loop's core skill is describing a game
 * in words, and the learner this is built for would rather speak than hunt-and-peck.
 *
 * Self-contained: it owns the speech session and merges what's spoken onto whatever
 * is already in the field (typed text or a tapped example chip), so talking adds to
 * an idea rather than wiping it. Renders nothing where speech isn't supported.
 */
export function MicButton({
  value,
  onChange,
  disabled = false,
  className = "",
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  // The field text captured when the child started talking; spoken words append to it.
  const baseRef = useRef("");
  const { supported, listening, toggle } = useSpeechInput(
    (transcript, isFinal) => {
      const base = baseRef.current;
      const merged = base ? `${base} ${transcript}` : transcript;
      onChange(merged);
      // Lock the utterance in so a follow-up sentence appends after it.
      if (isFinal) baseRef.current = merged;
    },
  );

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={() => {
        if (!listening) baseRef.current = value.trim();
        toggle();
      }}
      disabled={disabled}
      aria-label={listening ? "Stop talking" : "Talk to type"}
      aria-pressed={listening}
      title={listening ? "Listening… tap to stop" : "Tap and talk"}
      className={`btn-toy inline-flex shrink-0 items-center justify-center rounded-full p-3 ${
        listening ? "animate-pulse text-white" : "text-grape"
      } ${className}`}
      style={
        listening
          ? ({
              background:
                "linear-gradient(180deg,var(--color-coral),var(--color-coral-dark))",
              "--toy-depth": "var(--color-coral-dark)",
            } as React.CSSProperties)
          : ({
              background: "#fff",
              "--toy-depth": "#eadbfb",
            } as React.CSSProperties)
      }
    >
      <Mic size={20} />
    </button>
  );
}
