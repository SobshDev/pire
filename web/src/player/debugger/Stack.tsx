import type { Snapshot } from "@pire/content";
import { cx } from "../../ui/bits";
import { useView } from "../view";
import { Pane } from "./Pane";

export function Stack({ snapshot }: { snapshot: Snapshot }) {
  const view = useView();
  return (
    <Pane id="stack" label="Stack" className="w-82.5 shrink-0 border-l border-line">
      <div className="flex h-6 shrink-0 items-center border-b border-line px-2 text-[11px] text-faint">
        Default (x64 fastcall)
      </div>
      <div className="pane-scroll min-h-0 grow overflow-y-auto font-mono text-xs/5">
        {snapshot.stack.map((row) => {
          const id = "stack:" + row.address;
          const top = row.address === snapshot.rsp;
          return (
            <div
              key={row.address}
              role="button"
              tabIndex={-1}
              data-target={id}
              onClick={() => view.target(id, "stack")}
              className={cx(
                "flex cursor-default items-center whitespace-nowrap",
                top ? "bg-rip" : view.selected === id ? "bg-raised" : "hover:bg-[#1A1815]",
                view.highlights.has(id) && "shadow-[inset_0_0_0_1.5px_var(--color-amber)]",
              )}
            >
              <span className={cx("w-32 shrink-0 px-1.5", top ? "text-amber" : "text-muted")}>{row.address}</span>
              <span className="w-31 shrink-0 text-fg">{row.value}</span>
              <span className="min-w-0 truncate pr-1.5 text-comment" title={row.comment}>
                {row.comment ?? ""}
              </span>
            </div>
          );
        })}
      </div>
    </Pane>
  );
}
