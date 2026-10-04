import { useDroppable } from "@dnd-kit/core";
import type { PaneId } from "@pire/content";
import type { ReactNode } from "react";
import { cx } from "../../ui/bits";
import { useView } from "../view";

/** One x64dbg pane. Handles spotlight dimming, the amber ring, and match drops. */
export function Pane({ id, label, className, children }: { id: PaneId; label: string; className?: string; children: ReactNode }) {
  const view = useView();
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !view.matching });
  const dim = view.spotPane !== null && view.spotPane !== id;
  const spot = view.spotPane === id && !view.spotPart;
  const chips = Object.entries(view.placed)
    .filter(([, pane]) => pane === id)
    .map(([chip]) => chip);

  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      data-pane={id}
      className={cx(
        "relative flex min-h-0 min-w-0 flex-col bg-panel transition-[opacity,box-shadow] duration-300",
        dim && "opacity-28",
        spot && "z-10 shadow-[0_0_0_1.5px_var(--color-amber)]",
        isOver && "z-10 bg-[#FFB2240F] outline-1 outline-amber outline-dashed",
        className,
      )}
    >
      {children}
      {chips.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex flex-wrap justify-center gap-2 px-3">
          {chips.map((chip) => (
            <span
              key={chip}
              className="flex h-8 items-center gap-2 rounded-[18px] border border-ok bg-ok-bg px-3.5 text-[13px] text-fg shadow-lg"
            >
              <span className="text-ok">✓</span>
              {chip}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

export function PaneTabs({ tabs, active = 0, right }: { tabs: string[]; active?: number; right?: ReactNode }) {
  return (
    <div className="flex h-6 shrink-0 items-end gap-px border-b border-line px-1">
      {tabs.map((tab, i) => (
        <span
          key={tab}
          className={cx(
            "rounded-t-sm px-2 py-0.5 text-[11px]/4",
            i === active ? "bg-raised text-fg" : "text-faint",
          )}
        >
          {tab}
        </span>
      ))}
      <span className="grow" />
      {right}
    </div>
  );
}

export function Locked({ label, lesson, className }: { label: string; lesson: string; className?: string }) {
  return (
    <div
      className={cx(
        "flex items-center justify-center gap-2 border border-dashed border-line text-[11px] text-faint select-none",
        className,
      )}
    >
      <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden>
        <rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      {label + " · unlocks in " + lesson}
    </div>
  );
}
