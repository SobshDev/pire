import { big, readByte } from "../../engine/debugger";
import { cx } from "../../ui/bits";
import { addHex, useTarget, useView } from "../view";
import { Pane, PaneTabs } from "./Pane";

const ROWS = 16;
const hex2 = (b: number) => b.toString(16).toUpperCase().padStart(2, "0");
const printable = (b: number | null) => (b === null ? "?" : b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".");

export function Dump() {
  const view = useView();
  const { rec, session } = view;
  const rows = Array.from({ length: ROWS }, (_, r) => {
    const address = addHex(session.dump, r * 16);
    const bytes = Array.from({ length: 16 }, (_, i) => {
      const a = big(session.dump) + BigInt(r * 16 + i);
      const now = readByte(rec, session.index, a);
      const was = readByte(rec, session.prev, a);
      return { address: addHex(session.dump, r * 16 + i), now, changed: now !== was };
    });
    return { address, bytes };
  });

  return (
    <Pane id="dump" label="Dump" className="grow">
      <PaneTabs tabs={["Dump 1", "Dump 2", "Dump 3", "Dump 4", "Dump 5", "Watch 1", "Locals", "Struct"]} />
      <div className="flex h-5 shrink-0 items-center border-b border-line font-mono text-[11px] text-faint">
        <span className="w-35 px-2">Address</span>
        <span className="w-[24.5rem] px-1">Hex</span>
        <span className="px-1">ASCII</span>
      </div>
      <div className="pane-scroll min-h-0 grow overflow-y-auto font-mono text-xs/5 whitespace-pre">
        {rows.map((row) => (
          <div key={row.address} className="flex">
            <span className="w-35 shrink-0 px-2 text-muted">{row.address}</span>
            <span className="flex w-[24.5rem] shrink-0 px-1">
              {row.bytes.map((b) => (
                <Byte key={b.address} address={b.address} value={b.now} changed={b.changed} />
              ))}
            </span>
            <Ascii address={row.address} text={row.bytes.map((b) => printable(b.now)).join("")} />
          </div>
        ))}
      </div>
    </Pane>
  );
}

function Byte({ address, value, changed }: { address: string; value: number | null; changed: boolean }) {
  const { props, selected } = useTarget("dump:byte:" + address, "dump", "w-6 text-center hover:bg-hover");
  return (
    <span {...props} className={cx(props.className, selected && "bg-raised", changed ? "text-bad" : value === null ? "text-faint" : "text-fg")}>
      {value === null ? "??" : hex2(value)}
    </span>
  );
}

function Ascii({ address, text }: { address: string; text: string }) {
  const { props, selected } = useTarget("dump:ascii:" + address, "dump", "px-1 text-mnemonic hover:bg-hover");
  return (
    <span {...props} className={cx(props.className, selected && "bg-raised")}>
      {text}
    </span>
  );
}
