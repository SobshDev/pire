import type { Snapshot } from "@pire/content";
import { cx } from "../../ui/bits";
import { useView } from "../view";
import { Locked, Pane } from "./Pane";

const GROUP_BREAKS = new Set(["R8", "RIP"]);

export function Registers({ snapshot, callArgsLock }: { snapshot: Snapshot; callArgsLock?: string }) {
  const view = useView();
  const rows = [...snapshot.registers, { name: "RIP", value: snapshot.rip }];
  const flagsSpot = view.spotPane === "registers" && view.spotPart === "flags";

  const cell = (id: string, children: React.ReactNode, className: string) => (
    <div
      role="button"
      tabIndex={-1}
      data-target={id}
      onClick={() => view.target(id, "registers")}
      className={cx(
        "cursor-default",
        view.selected === id && "bg-raised",
        view.highlights.has(id) && "shadow-[inset_0_0_0_1.5px_var(--color-amber)]",
        className,
      )}
    >
      {children}
    </div>
  );

  return (
    <Pane id="registers" label="Registers" className="w-82.5 shrink-0 border-l border-line">
      <div className="flex h-6 shrink-0 items-center border-b border-line px-2 text-[11px] text-faint">Hide FPU</div>
      <div className="pane-scroll min-h-0 grow overflow-y-auto px-2 py-1.5 font-mono text-xs">
        {rows.map((r) => (
          <div key={r.name} className={cx(GROUP_BREAKS.has(r.name) && "mt-2.5")}>
            {cell(
              "reg:" + r.name,
              <>
                <span className="w-10 shrink-0 text-muted">{r.name}</span>
                <span className="text-fg">{r.value}</span>
                {r.name === "RIP" && <span className="ml-3 truncate text-comment">{"<vault.main>"}</span>}
              </>,
              "flex h-4.25 items-center px-1",
            )}
          </div>
        ))}

        <div className="mt-2.5 flex h-4.25 items-center px-1">
          <span className="w-16 text-muted">RFLAGS</span>
          <span className="text-fg">{snapshot.rflags}</span>
        </div>
        <div
          className={cx(
            "relative mt-1 flex flex-wrap rounded-sm p-1 transition-shadow duration-300",
            flagsSpot && "z-10 shadow-[0_0_0_1.5px_var(--color-amber)]",
          )}
        >
          {snapshot.flags.map((f) =>
            cell(
              "flag:" + f.name,
              <>
                <span className="text-muted">{f.name}</span>
                <span className="text-fg">{f.value}</span>
              </>,
              "flex h-4.25 w-14.5 items-center gap-1.5 px-1",
            ),
          )}
        </div>
        {callArgsLock && <Locked label="Call arguments" lesson={callArgsLock} className="mt-4 h-20 rounded-sm" />}
      </div>
    </Pane>
  );
}
