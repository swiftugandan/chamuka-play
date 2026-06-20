import { Mascot } from "./Mascot";

/** Full-screen "making" overlay shown while the model works. */
export function Building({ label = "Building your game…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="scene-bg fixed inset-0 z-50 flex flex-col items-center justify-center px-7 text-center"
    >
      <Mascot size={110} className="anim-float" />
      <p className="font-display mt-5 text-2xl font-bold text-ink">{label}</p>
      <p className="mt-1.5 font-semibold text-ink-soft">
        Mishi is putting the pieces together
      </p>
      <div className="mt-6 h-4 w-72 max-w-[80vw] overflow-hidden rounded-full bg-white shadow-inner">
        <div
          className="anim-load h-full w-2/5 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, var(--color-grape), var(--color-bubble))",
          }}
        />
      </div>
      <div className="mt-4 flex gap-2.5 text-2xl" aria-hidden="true">
        <span className="anim-spin">⚙️</span>
        <span>🧩</span>
        <span className="anim-spin">⚙️</span>
      </div>
    </div>
  );
}
