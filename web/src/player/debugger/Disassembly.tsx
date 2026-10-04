import type { Instruction, Snapshot } from "@pire/content";
import { useCallback, useImperativeHandle, useLayoutEffect, useRef, type Ref } from "react";
import { cx } from "../../ui/bits";
import { useView } from "../view";
import { Pane } from "./Pane";

const ROW = 22;

export interface DisassemblyHandle {
  goToRip(): void;
  ripOffscreen(): boolean;
}

const FLOW = new Set(["call", "jmp", "ret"]);
const isFlow = (m: string) => FLOW.has(m) || (m.startsWith("j") && m.length <= 4);

export function Disassembly({ snapshot, ref }: { snapshot: Snapshot; ref: Ref<DisassemblyHandle> }) {
  const scroller = useRef<HTMLDivElement>(null);
  const ripIndex = snapshot.disassembly.findIndex((r) => r.address === snapshot.rip);
  const ripTop = Math.max(0, ripIndex - snapshot.disassemblyTopOffset) * ROW;

  const goToRip = useCallback(() => {
    scroller.current?.scrollTo({ top: ripTop });
  }, [ripTop]);

  useLayoutEffect(goToRip, [goToRip]);

  useImperativeHandle(ref, () => ({
    goToRip,
    ripOffscreen() {
      const el = scroller.current;
      if (!el) return false;
      const top = ripIndex * ROW;
      return top + ROW <= el.scrollTop || top >= el.scrollTop + el.clientHeight;
    },
  }));

  return (
    <Pane id="disassembly" label="Disassembly" className="grow">
      <div ref={scroller} className="pane-scroll min-h-0 grow overflow-y-auto font-mono text-xs" data-testid="disasm-scroll">
        {snapshot.disassembly.map((row) => (
          <Row key={row.address} row={row} isRip={row.address === snapshot.rip} />
        ))}
      </div>
    </Pane>
  );
}

function Row({ row, isRip }: { row: Instruction; isRip: boolean }) {
  const view = useView();
  const id = "disasm:" + row.address;
  const lit = view.highlights.has(id);
  return (
    <div
      role="button"
      tabIndex={-1}
      data-target={id}
      onClick={() => view.target(id, "disassembly")}
      className={cx(
        "flex h-5.5 cursor-default items-center whitespace-nowrap",
        isRip && "bg-rip shadow-[inset_0_0_0_1px_var(--color-amber-dim)]",
        !isRip && view.selected === id && "bg-raised",
        !isRip && "hover:bg-[#1A1815]",
        lit && "relative z-10 shadow-[inset_0_0_0_1.5px_var(--color-amber)]",
      )}
    >
      <span className="w-9.5 shrink-0 pl-1.5 text-[10px] font-semibold text-amber">{isRip ? "RIP" : ""}</span>
      <span className={cx("w-33 shrink-0 px-1", isRip ? "bg-fg text-ink" : "text-muted")}>{row.address}</span>
      <span className="w-32 shrink-0 truncate px-2 text-faint">{row.bytes}</span>
      <span className="w-62 shrink-0 truncate">
        <span className={cx(isFlow(row.mnemonic) ? "text-amber" : row.mnemonic === "int3" ? "text-faint" : "text-mnemonic")}>
          {row.mnemonic}
        </span>
        {row.operands && <span className="text-fg">{" " + row.operands}</span>}
      </span>
      <span className="min-w-0 truncate pr-2 text-comment" title={row.comment}>
        {row.comment ?? ""}
      </span>
    </div>
  );
}
