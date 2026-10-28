"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getVersions } from "@/lib/storage/repository";
import type { SharedGame } from "@/lib/share/gameFile";
import { decodeGameSnapshot, gameIdFromPath, snapshotFromHash } from "@/lib/share/gameLink";
import { Mascot } from "@/components/play/Mascot";
import { PlayerBar } from "./PlayerBar";
import { useGameAppIdentity } from "./useGameAppIdentity";

type Loaded =
  | { state: "loading" }
  | { state: "missing" }
  | { state: "ready"; gameId: string; game: SharedGame; source: "device" | "link" };

/**
 * One game, on its own: what a game installed as an app opens to. Plays the
 * newest version saved on this device (so the app keeps up with the child's
 * changes), else the copy carried in the link (iOS, where installed apps can't
 * see the browser's storage). The game runs in the same locked-down frame as
 * in the studio, and this page's strict CSP (next.config.ts) applies to it too.
 */
export function GamePlayer() {
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const gameId = gameIdFromPath(location.pathname);
      const result = gameId ? await findGame(gameId) : null;
      if (cancelled) return;
      setLoaded(gameId && result ? { state: "ready", gameId, ...result } : { state: "missing" });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ready = loaded.state === "ready" ? loaded : null;
  useGameAppIdentity(ready?.gameId ?? "", ready?.game ?? null, ready?.source ?? "device");

  if (loaded.state === "loading") {
    return (
      <main className="grid h-dvh place-items-center" aria-busy="true">
        <title>Chamuka Play</title>
        <Mascot size={88} className="anim-float" />
      </main>
    );
  }
  if (loaded.state === "missing") return <GameMissing />;

  return (
    <main className="flex h-dvh flex-col pt-[env(safe-area-inset-top)]">
      {/* React hoists this into <head>, so Next's metadata can't reset it. */}
      <title>{loaded.game.title}</title>
      <PlayerBar title={loaded.game.title} />
      <iframe
        title={loaded.game.title}
        sandbox="allow-scripts"
        srcDoc={loaded.game.code}
        className="min-h-0 w-full flex-1 border-0 bg-black"
      />
    </main>
  );
}

async function findGame(
  gameId: string,
): Promise<{ game: SharedGame; source: "device" | "link" } | null> {
  const newest = (await getVersions(gameId).catch(() => []))[0];
  if (newest) {
    return {
      source: "device",
      game: {
        title: newest.title,
        code: newest.code,
        starterId: newest.starterId,
        prompt: newest.prompt,
      },
    };
  }
  const data = snapshotFromHash(location.hash);
  if (!data) return null;
  const parsed = await decodeGameSnapshot(data);
  return parsed.ok ? { source: "link", game: parsed.game } : null;
}

function GameMissing() {
  return (
    <main className="grid h-dvh place-items-center p-6">
      <title>Chamuka Play</title>
      <div className="card-toy rounded-toy-xl w-full max-w-sm border-[3px] border-white bg-white p-7 text-center">
        <Mascot size={84} className="mx-auto" />
        <h1 className="font-display mt-2 text-2xl font-bold text-ink">This game isn&apos;t here</h1>
        <p className="mt-1.5 font-bold text-ink-soft">
          It may have been deleted, or it was made on another device.
        </p>
        <Link
          href="/"
          className="btn-toy font-display mt-5 inline-flex w-full items-center justify-center rounded-full p-3.5 text-[17px] font-bold"
          style={
            {
              background: "linear-gradient(180deg,#37d9f0,var(--color-mint))",
              color: "#04413a",
              "--toy-depth": "var(--color-mint-dark)",
            } as React.CSSProperties
          }
        >
          Open Chamuka Play
        </Link>
      </div>
    </main>
  );
}
