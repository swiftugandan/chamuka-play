/** Full-width footer used on the home/make screen. */
export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-white/60 py-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-1 px-4 text-center text-ink-soft sm:px-6">
        <p className="font-display text-sm font-semibold">
          Made with 💜 for little makers
        </p>
        <p className="text-xs font-bold">
          Open source · local-first · no sign-up ·{" "}
          <a
            href="https://github.com/swiftugandan/chamuka-play"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-grape/40 underline-offset-2 hover:text-grape"
          >
            GitHub
          </a>
        </p>
      </div>
    </footer>
  );
}
