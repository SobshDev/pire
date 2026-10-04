import type { Snapshot } from "@pire/content";
import { cx } from "../../ui/bits";
import { useView } from "../view";
import { Locked, Pane } from "./Pane";

const MENU = ["File", "View", "Debug", "Tracing", "Plugins", "Favourites", "Options", "Help"];
const TABS = [
  "CPU", "Log", "Notes", "Breakpoints", "Memory Map", "Call Stack", "SEH", "Script",
  "Symbols", "Source", "References", "Threads", "Handles",
];
const ICONS = [
  "M2 4h4l1.5 1.5H14V13H2z",
  "M12.5 8A4.5 4.5 0 1 1 11 4.6M11.5 2v3h-3",
  "M4 4l8 8M12 4l-8 8",
  "|",
  "M5 3l8 5-8 5z",
  "M5 3v10M11 3v10",
  "|",
  "M8 2v8M5 7l3 3 3-3",
  "M3 9a5 5 0 0 1 10 0M13 9l-2-1.5M13 9l1.5-2",
  "M8 14V6M5 9l3-3 3 3",
  "|",
  "M4 3v10M8 3v6M12 3v8",
  "M3 8h10M8 3v10",
];

/** Title strip, menu bar, toolbar, and window tabs. Decorative in Module 1. */
export function WindowChrome({ snapshot }: { snapshot: Snapshot }) {
  return (
    <div className="flex shrink-0 flex-col bg-panel select-none">
      <div className="flex h-6.5 items-center justify-center border-b border-line text-xs text-muted">
        {snapshot.windowTitle}
      </div>
      <div className="flex h-6 items-center border-b border-line px-1.5 text-xs">
        {MENU.map((m) => (
          <span key={m} className={cx("px-1.75 py-0.5", m === "Debug" ? "text-fg" : "text-faint")}>
            {m}
          </span>
        ))}
      </div>
      <div className="flex h-8 items-center gap-px border-b border-line px-1.5">
        {ICONS.map((d, i) =>
          d === "|" ? (
            <span key={i} className="mx-1 h-4 w-px bg-line" />
          ) : (
            <span key={i} className="flex h-6.5 w-6.5 items-center justify-center">
              <svg width="15" height="15" viewBox="0 0 16 16" className="opacity-55" aria-hidden>
                <path d={d} fill="none" stroke="#4F493F" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
            </span>
          ),
        )}
      </div>
      <div className="flex h-6.5 items-end gap-px overflow-hidden border-b border-line px-1">
        {TABS.map((t, i) => (
          <span
            key={t}
            className={cx(
              "rounded-t-sm px-2.5 py-1 text-[11px]/3.5 whitespace-nowrap",
              i === 0 ? "bg-raised text-fg" : "text-faint",
            )}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CommandBar({ lock }: { lock?: string }) {
  return (
    <Pane id="command" label="Command" className="h-7 shrink-0 flex-row items-center gap-2 border-t border-line px-2">
      <span className="text-xs text-muted">Command:</span>
      {lock ? (
        <Locked label="Command bar" lesson={lock} className="h-5 grow rounded-sm" />
      ) : (
        <input className="h-5 grow rounded-sm border border-line bg-ink px-2 font-mono text-xs text-fg" />
      )}
      <span className="rounded-sm border border-line px-2 text-[11px]/4 text-faint">Default</span>
    </Pane>
  );
}

export function StatusBar({ snapshot }: { snapshot: Snapshot }) {
  const view = useView();
  const id = "status:paused";
  return (
    <Pane id="status" label="Status bar" className="h-6.5 shrink-0 flex-row items-center gap-3 border-t border-line px-2">
      <span
        role="button"
        tabIndex={-1}
        data-target={id}
        onClick={() => view.target(id, "status")}
        className={cx(
          "cursor-default rounded-xs bg-paused px-2 text-[11px]/4.5 font-semibold text-paused-fg",
          view.highlights.has(id) && "shadow-[0_0_0_1.5px_var(--color-amber)]",
        )}
      >
        {snapshot.status.state}
      </span>
      <span className="truncate text-[11px] text-muted">{snapshot.status.message}</span>
      <span className="grow" />
      <span className="font-mono text-[11px] text-faint">Time Wasted Debugging: 0:00:06:31</span>
    </Pane>
  );
}
