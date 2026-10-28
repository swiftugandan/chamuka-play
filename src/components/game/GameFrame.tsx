"use client";
import { useEffect, useState } from "react";
import { bundleGame, usesLibraries } from "@/lib/games/bundle";
import { Mascot } from "@/components/play/Mascot";

/**
 * Where a game runs: a locked-down sandboxed frame (scripts only — no access to
 * this page, its storage, forms or pop-ups). Games that use catalog libraries
 * get them inlined first (bundleGame), so they also play offline; plain games
 * run as they are, straight away.
 */
export function GameFrame({
  title,
  code,
  className,
}: {
  title: string;
  code: string;
  className?: string;
}) {
  const runnable = useRunnableGame(code);
  if (runnable === null) {
    // The first time a library game opens, its engine is still arriving.
    return (
      <div
        className={`grid place-items-center ${className ?? ""}`}
        aria-busy="true"
        aria-label={`Loading ${title}`}
      >
        <Mascot size={72} className="anim-float" />
      </div>
    );
  }
  return <iframe title={title} sandbox="allow-scripts" srcDoc={runnable} className={className} />;
}

/**
 * The code to put in the frame. While a new version is being bundled the
 * previous one stays on screen (no flash); null only before the first is ready.
 */
export function useRunnableGame(code: string): string | null {
  const needsBundle = usesLibraries(code);
  const [bundled, setBundled] = useState<{ source: string; html: string } | null>(null);

  useEffect(() => {
    if (!needsBundle) return;
    let cancelled = false;
    void bundleGame(code).then((html) => {
      if (!cancelled) setBundled({ source: code, html });
    });
    return () => {
      cancelled = true;
    };
  }, [code, needsBundle]);

  if (!needsBundle) return code;
  return bundled?.html ?? null;
}
