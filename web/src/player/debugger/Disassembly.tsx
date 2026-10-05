import type { CodeRow } from "@pire/content";
import { useImperativeHandle, useLayoutEffect, useMemo, useRef, type Ref } from "react";
import { moduleOf } from "../../engine/debugger";
import { cx } from "../../ui/bits";
import { useTarget, useView } from "../view";
import { Pane } from "./Pane";

const ROW = 22;
const TOP_OFFSET = 4;

export interface DisassemblyHandle {
  goToRip(): void;
  ripOffscreen(): boolean;
}

const FLOW = new Set(["call", "jmp", "ret"]);
const isFlow = (m: string) => FLOW.has(m) || (m.startsWith("j") && m.length <= 4);

export function Disassembly({ ref }: { ref: Ref<DisassemblyHandle> }) {
  const view = useView();
  const scroller = useRef<HTMLDivElement>(null);
  const rip = view.state.rip;
  const focus = view.session.view ?? rip;
  const module = moduleOf(view.rec, focus);
  const rows = useMemo(() => module?.rows ?? [], [module]);
  const indexOf = (address: string) => rows.findIndex((r) => r.address === address);

  const isVisible = (i: number) => {
    const el = scroller.current;
    if (!el) return false;
    const top = i * ROW;
    return top >= el.scrollTop && top + ROW <= el.scrollTop + el.clientHeight;
  };
  const scrollTo = (i: number) => scroller.current?.scrollTo({ top: Math.max(0, i - TOP_OFFSET) * ROW });

  // Keep the focused line on screen, the way x64dbg follows RIP after every step.
  useLayoutEffect(() => {
    const i = indexOf(focus);
    if (i >= 0 && !isVisible(i)) scrollTo(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, view.session.index, rows]);

  useImperativeHandle(ref, () => ({
    goToRip() {
      const i = indexOf(rip);
      if (i >= 0) scrollTo(i);
    },
    ripOffscreen() {
      const i = indexOf(rip);
      return i < 0 || !isVisible(i);
    },
  }));

  const bps = new Map(view.session.breakpoints.filter((b) => b.kind === "software").map((b) => [b.address, b]));

  // Size the bytes and instruction columns to their longest entry so nothing is cut off
  // and the comment column still lines up across rows (the font is monospace).
  const cols = useMemo(() => {
    let bytes = 0;
    let instr = 0;
    for (const r of rows) {
      bytes = Math.max(bytes, r.bytes.length);
      instr = Math.max(instr, r.mnemonic.length + (r.operands ? r.operands.length + 1 : 0));
    }
    return { bytes: `calc(${bytes}ch + 1rem)`, instr: `calc(${instr}ch + 1rem)` };
  }, [rows]);

  return (
    <Pane id="disassembly" label="Disassembly" className="grow">
      <div ref={scroller} className="pane-scroll min-h-0 grow overflow-y-auto font-mono text-xs" data-testid="disasm-scroll">
        {rows.length === 0 && <p className="p-3 text-faint">No code to show at this address.</p>}
        {rows.map((row) => (
          <Row key={row.address} row={row} isRip={row.address === rip} bp={bps.get(row.address)?.enabled} cols={cols} />
        ))}
      </div>
    </Pane>
  );
}

function Row({
  row,
  isRip,
  bp,
  cols,
}: {
  row: CodeRow;
  isRip: boolean;
  bp: boolean | undefined;
  cols: { bytes: string; instr: string };
}) {
  const id = "disasm:" + row.address;
  const { props, selected } = useTarget(
    id,
    "disassembly",
    cx(
      "flex h-5.5 items-center whitespace-nowrap",
      isRip && "bg-rip shadow-[inset_0_0_0_1px_var(--color-amber-dim)]",
      !isRip && "hover:bg-[#1A1815]",
    ),
  );
  return (
    <div {...props} className={cx(props.className, !isRip && selected && "bg-raised")}>
      <span className="w-9.5 shrink-0 pl-1.5 text-[10px] font-semibold text-amber">{isRip ? "RIP" : ""}</span>
      <span
        className={cx(
          "w-33 shrink-0 px-1",
          bp === true && "bg-bad text-white",
          bp === false && "text-bad",
          bp === undefined && (isRip ? "bg-fg text-ink" : "text-muted"),
        )}
        data-bp={bp === undefined ? undefined : bp ? "on" : "off"}
      >
        {row.address}
      </span>
      <span className="min-w-32 shrink-0 px-2 text-faint" style={{ width: cols.bytes }}>
        {row.bytes}
      </span>
      <span className="min-w-62 shrink-0 pr-4" style={{ width: cols.instr }}>
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
