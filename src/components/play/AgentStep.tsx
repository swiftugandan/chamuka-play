"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { GameUIMessagePart } from "@/lib/agent/protocol";

type ToolPart = Extract<GameUIMessagePart, { type: `tool-${string}` }>;

/** Whether a message part is one of Mishi's tool steps. */
export function isToolPart(part: GameUIMessagePart): part is ToolPart {
  return part.type.startsWith("tool-");
}

type Tone = "working" | "done" | "oops";

/**
 * One of Mishi's steps (plan, build, change, read, test), told in a child's
 * words. This is the agent loop made visible: a child watches Mishi build,
 * test, find a bug and fix it — the same loop they're learning to drive.
 */
export function AgentStep({ part }: { part: ToolPart }) {
  const running = part.state === "input-streaming" || part.state === "input-available";
  const failed = part.state === "output-error";

  switch (part.type) {
    case "tool-makePlan": {
      const plan = part.input;
      if (!plan?.pitch) return <StepRow tone="working" icon="📝" label="Making a plan…" />;
      return (
        <div className="rounded-2xl border-2 border-dashed border-lilac/60 bg-white/80 px-3.5 py-2.5">
          <p className="font-display text-xs font-bold uppercase tracking-[0.1em] text-grape">
            📝 Mishi&apos;s plan
          </p>
          <p className="mt-1 text-[15px] font-bold text-ink">{plan.pitch}</p>
          {plan.steps && plan.steps.length > 0 && (
            <ol className="mt-1.5 flex flex-col gap-1">
              {plan.steps.map((step, i) => (
                <li key={i} className="flex gap-2 text-[13px] font-semibold text-ink-soft">
                  <span
                    aria-hidden="true"
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cloud text-[11px] font-extrabold text-grape"
                  >
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          )}
        </div>
      );
    }

    case "tool-writeGame": {
      if (running) {
        const lines = part.input?.html ? part.input.html.split("\n").length : 0;
        return (
          <StepRow
            tone="working"
            icon="🔨"
            label="Building your game…"
            detail={lines > 1 ? `${lines} lines of code so far` : undefined}
          />
        );
      }
      if (failed || (part.state === "output-available" && !part.output.ok)) {
        return <StepRow tone="oops" icon="🔨" label="That build didn't fit — trying again" />;
      }
      return (
        <StepRow
          tone="done"
          icon="🔨"
          label="Built it!"
          detail={part.output ? `${part.output.lines} lines of code` : undefined}
        />
      );
    }

    case "tool-editGame": {
      if (running) return <StepRow tone="working" icon="🪄" label="Changing the code…" />;
      const applied = part.state === "output-available" ? part.output.applied : 0;
      if (failed || applied === 0) {
        return <StepRow tone="oops" icon="🪄" label="Couldn't find the right spot — looking again" />;
      }
      return (
        <StepRow
          tone="done"
          icon="🪄"
          label={applied === 1 ? "Changed 1 spot in the code" : `Changed ${applied} spots in the code`}
        />
      );
    }

    case "tool-readGame":
      return (
        <StepRow
          tone={running ? "working" : "done"}
          icon="👀"
          label={running ? "Reading the code…" : "Read the code"}
        />
      );

    case "tool-playtest": {
      const checking = part.input?.checking;
      if (running) {
        return (
          <StepRow tone="working" icon="🧪" label="Testing your game…" detail={checking} />
        );
      }
      if (failed) return <StepRow tone="oops" icon="🧪" label="The test machine hiccuped" />;
      const out = part.output;
      if (!out || out.skipped) return null;
      if (out.ok) {
        return (
          <StepRow
            tone="done"
            icon="✅"
            label={out.engine === "browser" ? "Played it — it works!" : "Checked the code — looks right!"}
            detail={checking}
          />
        );
      }
      const problems = [...out.errors, ...out.warnings];
      return (
        <BugRow
          label={
            out.errors.length > 0
              ? out.errors.length === 1
                ? "Found a bug — fixing it!"
                : `Found ${out.errors.length} bugs — fixing them!`
              : "Spotted something to fix up!"
          }
          problems={problems}
        />
      );
    }

    default:
      // finish (and anything new) has no step row: its result speaks for itself.
      return null;
  }
}

function StepRow({
  tone,
  icon,
  label,
  detail,
}: {
  tone: Tone;
  icon: string;
  label: string;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-2.5 px-1 py-0.5">
      <span
        aria-hidden="true"
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm ${
          tone === "oops" ? "bg-[#fff1d6]" : tone === "done" ? "bg-mint/15" : "bg-white"
        } ${tone === "working" ? "anim-hop" : ""}`}
        style={tone === "working" ? { animationDuration: "1.6s" } : undefined}
      >
        {icon}
      </span>
      <div className="min-w-0 pt-0.5">
        <p
          className={`text-[14px] font-bold ${
            tone === "oops" ? "text-[#a35f00]" : tone === "done" ? "text-ink" : "text-ink-soft"
          }`}
        >
          {label}
          {tone === "working" && <span className="sr-only"> (in progress)</span>}
        </p>
        {detail && <p className="text-[12px] font-semibold text-ink-soft">{detail}</p>}
      </div>
    </div>
  );
}

/** A found bug: friendly headline, with the real error one tap away — seeing a
 *  genuine bug report (and Mishi fixing it) is part of learning to read code. */
function BugRow({ label, problems }: { label: string; problems: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-1 py-0.5">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#fff1d6] text-sm"
        >
          🐛
        </span>
        <div className="min-w-0 pt-0.5">
          <p className="text-[14px] font-bold text-[#a35f00]">{label}</p>
          {problems.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              className="-ml-1.5 mt-0.5 inline-flex min-h-[32px] items-center gap-1 rounded-full px-1.5 text-[12px] font-bold text-ink-soft hover:bg-cloud hover:text-grape"
            >
              {open ? "Hide what went wrong" : "See what went wrong"}
              <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      </div>
      {open && (
        <ul className="ml-9 mt-1 flex flex-col gap-1 rounded-xl bg-[#1d1340] p-2.5 font-mono text-[11.5px] leading-relaxed text-[#ffcf8a]">
          {problems.map((p) => (
            <li key={p} className="break-words">
              {p}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
