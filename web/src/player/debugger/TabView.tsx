import { moduleOf, rowAt, symbolize, type Breakpoint } from "../../engine/debugger";
import { cx } from "../../ui/bits";
import { useTarget, useView } from "../view";
import { Pane } from "./Pane";

/** Breakpoints, References, and Log: the tabs the course uses besides CPU. */
export function TabView() {
  const view = useView();
  const tab = view.session.tab;
  return (
    <Pane id="tabview" label={tab} className="min-h-0 grow">
      {tab === "Breakpoints" && <Breakpoints />}
      {tab === "References" && <References />}
      {tab === "Log" && <Log />}
    </Pane>
  );
}

function Header({ cols }: { cols: [string, string][] }) {
  return (
    <div className="flex h-6 shrink-0 items-center border-b border-line font-mono text-[11px] text-faint">
      {cols.map(([label, w]) => (
        <span key={label} className={cx("px-2", w)}>
          {label}
        </span>
      ))}
    </div>
  );
}

function Breakpoints() {
  const view = useView();
  const bps = view.session.breakpoints;
  return (
    <div className="flex min-h-0 grow flex-col">
      <Header cols={[["Type", "w-28"], ["Address", "w-40"], ["Module/Label", "w-72"], ["State", "w-24"], ["Info", "grow"]]} />
      <div className="pane-scroll min-h-0 grow overflow-y-auto font-mono text-xs/6">
        {bps.length === 0 && <p className="p-3 font-sans text-faint">No breakpoints yet.</p>}
        {bps.map((bp) => (
          <BpRow key={bp.kind + bp.address} bp={bp} />
        ))}
      </div>
      <p className="shrink-0 border-t border-line px-3 py-1.5 text-[11px] text-faint">
        Space toggles the selected breakpoint. Delete removes it. Double-click shows its code.
      </p>
    </div>
  );
}

function BpRow({ bp }: { bp: Breakpoint }) {
  const view = useView();
  const { props, selected } = useTarget("bp:" + bp.kind + ":" + bp.address, "tabview", "flex items-center hover:bg-[#1A1815]");
  const sizes = { 1: "byte", 2: "word", 4: "dword", 8: "qword" } as const;
  return (
    <div {...props} className={cx(props.className, selected && "bg-raised", !bp.enabled && "text-faint")}>
      <span className="w-28 px-2 text-muted">{bp.kind === "software" ? "Software" : "Hardware"}</span>
      <span className="w-40 px-2">{bp.address}</span>
      <span className="w-72 truncate px-2 text-comment">{symbolize(view.rec, bp.address) ?? ""}</span>
      <span className={cx("w-24 px-2", bp.enabled ? "text-ok" : "text-faint")}>{bp.enabled ? "Enabled" : "Disabled"}</span>
      <span className="grow px-2 text-faint">{bp.kind === "hardware" ? "write, " + sizes[bp.size ?? 1] : ""}</span>
    </div>
  );
}

function References() {
  const view = useView();
  if (!view.session.references) {
    return (
      <p className="p-4 text-sm text-faint">
        Nothing here yet. Right-click the disassembly and choose Search for, Current Module, String references.
      </p>
    );
  }
  const module = moduleOf(view.rec, view.state.rip)?.name === "vault.exe" ? "vault.exe" : "vault.exe";
  const strings = view.rec.strings.filter((s) => moduleOf(view.rec, s.address)?.name === module);
  return (
    <div className="flex min-h-0 grow flex-col">
      <Header cols={[["Address", "w-40"], ["Disassembly", "w-96"], ["String", "grow"]]} />
      <div className="pane-scroll min-h-0 grow overflow-y-auto font-mono text-xs/6">
        {strings.map((s) => (
          <RefRow key={s.address} address={s.address} text={s.text} />
        ))}
      </div>
      <p className="shrink-0 border-t border-line px-3 py-1.5 text-[11px] text-faint">{strings.length + " strings found. Double-click one to see the code."}</p>
    </div>
  );
}

function RefRow({ address, text }: { address: string; text: string }) {
  const view = useView();
  const row = rowAt(view.rec, address)?.row;
  const { props, selected } = useTarget("ref:" + address, "tabview", "flex items-center hover:bg-[#1A1815]");
  return (
    <div {...props} className={cx(props.className, selected && "bg-raised")}>
      <span className="w-40 px-2 text-muted">{address}</span>
      <span className="w-96 truncate px-2">
        <span className="text-mnemonic">{row?.mnemonic}</span> <span className="text-fg">{row?.operands}</span>
      </span>
      <span className="grow truncate px-2 text-comment">{'"' + text + '"'}</span>
    </div>
  );
}

function Log() {
  const view = useView();
  return (
    <div className="pane-scroll min-h-0 grow overflow-y-auto p-2 font-mono text-xs/5 text-muted">
      {view.session.log.length === 0 && <p className="font-sans text-faint">The log is empty.</p>}
      {view.session.log.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </div>
  );
}
