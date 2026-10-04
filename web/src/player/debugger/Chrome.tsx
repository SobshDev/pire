import { useState } from "react";
import { moduleOf, TABS, type Tab } from "../../engine/debugger";
import { cx } from "../../ui/bits";
import { useTarget, useView } from "../view";
import { Locked, Pane } from "./Pane";

const MENU = ["File", "View", "Debug", "Tracing", "Plugins", "Favourites", "Options", "Help"];
const ALL_TABS = [
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

/** Title strip, menu bar, toolbar, and window tabs. CPU, Log, Breakpoints, and References switch views. */
export function WindowChrome({ onTab }: { onTab(tab: Tab): void }) {
  const view = useView();
  const { rec, state, session } = view;
  const module = moduleOf(rec, state.rip)?.name ?? "?";
  const title = state.terminated
    ? rec.process.name + " - x64dbg"
    : rec.process.name + " - PID: " + rec.process.pid + " - Module: " + module + " - Thread: Main Thread " + rec.process.tid + " - x64dbg";
  return (
    <div className="flex shrink-0 flex-col bg-panel select-none">
      <div className="flex h-6.5 items-center justify-center border-b border-line text-xs text-muted" data-testid="window-title">
        {title}
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
      <div className="flex h-6.5 items-end gap-px overflow-hidden border-b border-line px-1" role="tablist">
        {ALL_TABS.map((t) => {
          const live = (TABS as string[]).includes(t);
          const active = session.tab === t;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={!live}
              onClick={() => live && onTab(t as Tab)}
              className={cx(
                "rounded-t-sm px-2.5 py-1 text-[11px]/3.5 whitespace-nowrap",
                active ? "bg-raised text-fg" : live ? "text-muted hover:text-fg" : "text-faint",
              )}
            >
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CommandBar({ lock, onCommand }: { lock?: string; onCommand(text: string): void }) {
  const [text, setText] = useState("");
  const view = useView();
  return (
    <Pane id="command" label="Command" className="h-7 shrink-0 flex-row items-center gap-2 border-t border-line px-2">
      <span className="text-xs text-muted">Command:</span>
      {lock ? (
        <Locked label="Command bar" lesson={lock} className="h-5 grow rounded-sm" />
      ) : (
        <form
          className={cx("flex grow", view.pulse.has("command") && "pulse-target rounded-sm")}
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            onCommand(text);
            setText("");
          }}
        >
          <input
            aria-label="Command"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            className="h-5 grow rounded-sm border border-line bg-ink px-2 font-mono text-xs text-fg outline-none focus:border-amber-dim"
          />
        </form>
      )}
      <span className="rounded-sm border border-line px-2 text-[11px]/4 text-faint">Default</span>
    </Pane>
  );
}

export function StatusBar() {
  const view = useView();
  const done = !!view.state.terminated;
  const { props } = useTarget(
    "status:paused",
    "status",
    cx("rounded-xs px-2 text-[11px]/4.5 font-semibold", done ? "bg-bad text-white" : "bg-paused text-paused-fg"),
  );
  return (
    <Pane id="status" label="Status bar" className="h-6.5 shrink-0 flex-row items-center gap-3 border-t border-line px-2">
      <span {...props}>{done ? "Terminated" : "Paused"}</span>
      <span className="min-w-0 truncate text-[11px] text-muted" data-testid="status-message">
        {view.session.message}
      </span>
      <span className="grow" />
      <span className="shrink-0 font-mono text-[11px] text-faint">Time Wasted Debugging: 0:00:06:31</span>
    </Pane>
  );
}
