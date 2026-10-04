import { FLAG_ORDER, flagsFromRflags } from "@pire/content";
import type { ReactNode } from "react";
import { describe, symbolize } from "../../engine/debugger";
import { cx } from "../../ui/bits";
import { useTarget, useView } from "../view";
import { Locked, Pane } from "./Pane";

const ORDER = ["RAX", "RBX", "RCX", "RDX", "RBP", "RSP", "RSI", "RDI", "R8", "R9", "R10", "R11", "R12", "R13", "R14", "R15"];
const GROUP_BREAKS = new Set(["R8", "RIP"]);

export function Registers({ callArgsLock }: { callArgsLock?: string }) {
  const view = useView();
  const { state, prev } = view;
  const rows = [...ORDER.map((name) => ({ name, value: state.regs[name] ?? "", was: prev.regs[name] })), { name: "RIP", value: state.rip, was: prev.rip }];
  const flags = flagsFromRflags(state.rflags);
  const prevFlags = flagsFromRflags(prev.rflags);
  const flagsSpot = view.spotPane === "registers" && view.spotPart === "flags";

  return (
    <Pane id="registers" label="Registers" className="w-82.5 shrink-0 border-l border-line">
      <div className="flex h-6 shrink-0 items-center border-b border-line px-2 text-[11px] text-faint">Hide FPU</div>
      <div className="pane-scroll min-h-0 grow overflow-y-auto px-2 py-1.5 font-mono text-xs">
        {rows.map((r) => {
          const comment = r.name === "RIP" ? (symbolize(view.rec, r.value) ? "<" + symbolize(view.rec, r.value) + ">" : "") : describe(view.rec, view.session.index, r.value);
          return (
            <div key={r.name} className={cx(GROUP_BREAKS.has(r.name) && "mt-2.5")}>
              <Cell id={"reg:" + r.name} className="flex h-4.25 items-center px-1">
                <span className="w-10 shrink-0 text-muted">{r.name}</span>
                <span className={r.was !== undefined && r.was !== r.value ? "text-bad" : "text-fg"} data-changed={r.was !== r.value || undefined}>
                  {r.value}
                </span>
                {comment && <span className="ml-3 min-w-0 truncate text-comment" title={comment}>{comment}</span>}
              </Cell>
            </div>
          );
        })}

        <div className="mt-2.5 flex h-4.25 items-center px-1">
          <span className="w-16 text-muted">RFLAGS</span>
          <span className={prev.rflags !== state.rflags ? "text-bad" : "text-fg"}>{state.rflags}</span>
        </div>
        <div
          className={cx(
            "relative mt-1 flex flex-wrap rounded-sm p-1 transition-shadow duration-300",
            flagsSpot && "z-10 shadow-[0_0_0_1.5px_var(--color-amber)]",
          )}
        >
          {FLAG_ORDER.map((f) => (
            <Cell key={f} id={"flag:" + f} className="flex h-4.25 w-14.5 items-center gap-1.5 px-1">
              <span className="text-muted">{f}</span>
              <span className={flags[f] !== prevFlags[f] ? "text-bad" : "text-fg"}>{flags[f]}</span>
            </Cell>
          ))}
        </div>
        {callArgsLock ? (
          <Locked label="Call arguments" lesson={callArgsLock} className="mt-4 h-20 rounded-sm" />
        ) : (
          <CallArgs />
        )}
      </div>
    </Pane>
  );
}

function Cell({ id, className, children }: { id: string; className: string; children: ReactNode }) {
  const { props, selected } = useTarget(id, "registers", className);
  return (
    <div {...props} className={cx(props.className, selected && "bg-raised")}>
      {children}
    </div>
  );
}

/** x64dbg's "Default (x64 fastcall)" box: the first four arguments of the call about to run. */
function CallArgs() {
  const view = useView();
  const regs = ["RCX", "RDX", "R8", "R9"];
  return (
    <div className="mt-4 border-t border-line pt-2">
      <p className="mb-1 px-1 text-[11px] text-faint">Default (x64 fastcall)</p>
      {regs.map((r, i) => {
        const v = view.state.regs[r] ?? "";
        const d = describe(view.rec, view.session.index, v);
        return (
          <div key={r} className="flex h-4.25 items-center px-1">
            <span className="w-6 text-muted">{i + 1 + ":"}</span>
            <span className="w-10 text-muted">{r.toLowerCase()}</span>
            <span className="text-fg">{v}</span>
            {d && <span className="ml-2 min-w-0 truncate text-comment">{d}</span>}
          </div>
        );
      })}
    </div>
  );
}
