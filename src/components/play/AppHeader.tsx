import { Mascot } from "./Mascot";

/** Full-width app header used on the home/make screen. */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/60 bg-white/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-2.5 px-4 py-2.5 sm:px-6">
        <Mascot size={36} className="shrink-0" />
        <span className="font-display text-xl font-bold sm:text-2xl">
          Chamuka <span className="text-grape">Play</span>
        </span>
        <span className="ml-auto hidden rounded-full bg-grape/10 px-3.5 py-1.5 font-display text-sm font-semibold text-grape sm:inline">
          Make · Play · Tweak
        </span>
      </div>
    </header>
  );
}
