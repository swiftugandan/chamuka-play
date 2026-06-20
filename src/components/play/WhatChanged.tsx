"use client";
import { Mascot } from "./Mascot";
import { summarizeChange } from "@/lib/diff/summarizeChange";

const CONFETTI_COLORS = ["#ffc233", "#ff4fa3", "#45b6fe", "#25d0a8", "#a77bff"];

// Deterministic scattered layout — stable across renders, pure, and free of any
// hydration mismatch (no Math.random in render).
const CONFETTI = Array.from({ length: 24 }, (_, i) => ({
  left: (i * 37) % 100,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  delay: ((i % 8) * 0.3).toFixed(2),
  rot: (i * 53) % 360,
}));

export function WhatChanged({
  oldCode,
  newCode,
  onClose,
}: {
  oldCode: string;
  newCode: string;
  onClose: () => void;
}) {
  const { summary } = summarizeChange(oldCode, newCode);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(38,20,72,0.55)] p-6 backdrop-blur-sm">
      <div className="rounded-toy-xl relative w-full max-w-[360px] overflow-hidden bg-white p-7 pt-8 text-center shadow-[0_24px_60px_rgba(38,20,72,0.4)]">
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            className="anim-fall absolute -top-3 h-3.5 w-2 rounded-sm"
            style={{
              left: `${c.left}%`,
              background: c.color,
              animationDelay: `${c.delay}s`,
              transform: `rotate(${c.rot}deg)`,
            }}
            aria-hidden="true"
          />
        ))}
        <div className="relative z-10">
          <Mascot size={96} mood="cheer" className="mx-auto" />
          <h2 className="font-display mt-3 text-2xl font-bold">Ta-da! 🎉</h2>
          <p className="mb-5 mt-1.5 font-bold text-ink-soft">{summary}</p>
          <button
            onClick={onClose}
            className="btn-toy font-display w-full rounded-full p-3.5 text-[17px] font-bold"
            style={
              {
                background: "linear-gradient(180deg,#37d9f0,var(--color-mint))",
                color: "#04413a",
                "--toy-depth": "var(--color-mint-dark)",
              } as React.CSSProperties
            }
          >
            Keep playing!
          </button>
        </div>
      </div>
    </div>
  );
}
