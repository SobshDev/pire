import type { Snapshot } from "@pire/content";
import { cx } from "../../ui/bits";
import { addHex, useView } from "../view";
import { Pane, PaneTabs } from "./Pane";

const printable = (b: number) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".");

export function Dump({ snapshot }: { snapshot: Snapshot }) {
  const view = useView();
  const bytes = snapshot.dump.bytes.split(" ").filter(Boolean);
  const rows = Array.from({ length: Math.ceil(bytes.length / 16) }, (_, i) => ({
    address: addHex(snapshot.dump.base, i * 16),
    bytes: bytes.slice(i * 16, i * 16 + 16),
  }));

  const target = (id: string, className: string, text: string) => (
    <span
      role="button"
      tabIndex={-1}
      data-target={id}
      onClick={() => view.target(id, "dump")}
      className={cx(
        "cursor-default px-1 hover:bg-[#1A1815]",
        view.selected === id && "bg-raised",
        view.highlights.has(id) && "shadow-[inset_0_0_0_1.5px_var(--color-amber)]",
        className,
      )}
    >
      {text}
    </span>
  );

  return (
    <Pane id="dump" label="Dump" className="grow">
      <PaneTabs tabs={["Dump 1", "Dump 2", "Dump 3", "Dump 4", "Dump 5", "Watch 1", "Locals", "Struct"]} />
      <div className="flex h-5 shrink-0 items-center border-b border-line font-mono text-[11px] text-faint">
        <span className="w-35 px-2">Address</span>
        <span className="w-104 px-1">Hex</span>
        <span className="px-1">ASCII</span>
      </div>
      <div className="pane-scroll min-h-0 grow overflow-y-auto font-mono text-xs/5 whitespace-pre">
        {rows.map((row) => (
          <div key={row.address} className="flex">
            <span className="w-35 shrink-0 px-2 text-muted">{row.address}</span>
            {target("dump:hex:" + row.address, "w-104 shrink-0 text-fg", row.bytes.join(" "))}
            {target(
              "dump:ascii:" + row.address,
              "text-mnemonic",
              row.bytes.map((b) => printable(Number.parseInt(b, 16))).join(""),
            )}
          </div>
        ))}
      </div>
    </Pane>
  );
}
