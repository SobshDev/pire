import { big, describe, pad, readQword } from "../../engine/debugger";
import { cx } from "../../ui/bits";
import { useTarget, useView } from "../view";
import { Pane } from "./Pane";

export function Stack() {
  const view = useView();
  const { rec, session, state } = view;
  const rsp = big(state.regs.RSP ?? "0");
  const rows = Array.from({ length: 18 }, (_, i) => {
    const address = pad(rsp + BigInt(i * 8));
    const now = readQword(rec, session.index, rsp + BigInt(i * 8));
    const was = readQword(rec, session.prev, rsp + BigInt(i * 8));
    const value = now === null ? "????????????????" : pad(now);
    return { address, value, changed: now !== was, comment: now === null ? "" : describe(rec, session.index, value, true) };
  });

  return (
    <Pane id="stack" label="Stack" className="w-110 shrink-0 border-l border-line">
      <div className="flex h-6 shrink-0 items-center border-b border-line px-2 text-[11px] text-faint">Stack</div>
      <div className="pane-scroll min-h-0 grow overflow-y-auto font-mono text-xs/5">
        {rows.map((row, i) => (
          <Row key={row.address} {...row} top={i === 0} />
        ))}
      </div>
    </Pane>
  );
}

function Row(row: { address: string; value: string; changed: boolean; comment: string; top: boolean }) {
  const { props, selected } = useTarget("stack:" + row.address, "stack", "flex items-center whitespace-nowrap");
  return (
    <div {...props} className={cx(props.className, row.top ? "bg-rip" : selected ? "bg-raised" : "hover:bg-hover")}>
      <span className={cx("w-32 shrink-0 px-1.5", row.top ? "text-amber" : "text-muted")}>{row.address}</span>
      <span className={cx("w-31 shrink-0", row.changed ? "text-bad" : "text-fg")}>{row.value}</span>
      <span className="min-w-0 truncate pr-1.5 text-comment" title={row.comment}>
        {row.comment}
      </span>
    </div>
  );
}
