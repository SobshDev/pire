import { SECTION_FLAGS, type PeField, type PeFile } from "@pire/content";
import { useState } from "react";
import { cx } from "../../ui/bits";
import { Pane } from "../debugger/Pane";
import { hexOff } from "../hex/HexView";
import { useTarget, useView } from "../view";

/** PE-bear's tabs, by node id. */
export const PE_NODES: [string, string][] = [
  ["dos", "DOS Hdr"],
  ["rich", "Rich Hdr"],
  ["file", "File Hdr"],
  ["opt", "Optional Hdr"],
  ["sections", "Section Hdrs"],
  ["imports", "Imports"],
  ["exports", "Exports"],
];

export function nodesFor(file: PeFile, only: string[] | null | undefined): [string, string][] {
  return PE_NODES.filter(([id]) => {
    if (only && !only.includes(id)) return false;
    if (id === "imports") return file.imports.length > 0;
    if (id === "exports") return file.exports.length > 0;
    return true;
  });
}

const h = (n: number) => n.toString(16).toUpperCase();

export function PeView() {
  const view = useView();
  const file = view.file!;
  const nodes = nodesFor(file, view.session.peNodes);
  const node = view.session.peNode ?? "dos";
  return (
    <div className="flex min-h-0 grow">
      <Pane id="petree" label="Structure tree" className="w-56 shrink-0 border-r border-line">
        <div className="pane-scroll min-h-0 grow overflow-y-auto py-2 text-xs/6">
          <p className="flex items-center gap-1.5 px-3 text-fg">
            <span className="text-faint">▾</span>
            {file.name}
          </p>
          {nodes.map(([id, label]) => (
            <TreeNode key={id} id={id} label={label} active={node === id} />
          ))}
        </div>
      </Pane>
      <div className="flex min-w-0 grow flex-col">
        <div className="flex h-7 shrink-0 items-end gap-px border-b border-line bg-panel px-1" role="tablist">
          {nodes.map(([id, label]) => (
            <TabButton key={id} id={id} label={label} active={node === id} />
          ))}
        </div>
        <Pane id="pedetail" label="Details" className="min-h-0 grow-[2] basis-0">
          <div className="pane-scroll min-h-0 grow overflow-auto">
            {node === "sections" ? <Sections /> : node === "imports" ? <Imports /> : node === "exports" ? <Exports /> : <Fields node={node} />}
          </div>
        </Pane>
        <PeHex node={node} />
      </div>
    </div>
  );
}

function TreeNode({ id, label, active }: { id: string; label: string; active: boolean }) {
  const { props } = useTarget("pe:node:" + id, "petree", "flex w-full items-center gap-1.5 py-0 pr-3 pl-7 text-left");
  return (
    <div {...props} className={cx(props.className, active ? "bg-raised text-amber" : "text-muted hover:text-fg")}>
      {label}
    </div>
  );
}

function TabButton({ id, label, active }: { id: string; label: string; active: boolean }) {
  const { props } = useTarget("pe:node:" + id, "petree", "rounded-t-sm px-3 py-1 text-[11px]/4 whitespace-nowrap");
  return (
    <span {...props} role="tab" aria-selected={active} className={cx(props.className, active ? "bg-raised text-fg" : "text-muted hover:text-fg")}>
      {label}
    </span>
  );
}

const th = "sticky top-0 z-10 bg-panel px-3 py-1 text-left font-normal text-faint";

function Fields({ node }: { node: string }) {
  const view = useView();
  const file = view.file!;
  const groups = node === "opt" ? ["opt", "dd"] : node === "dos" ? ["dos"] : node === "file" ? ["nt", "file"] : [node];
  const fields = file.fields.filter((f) => groups.includes(f.group));
  if (node === "rich") {
    return <p className="p-4 text-xs text-muted">The Rich header records which Microsoft tools built the file. Only the linker reads it; Windows ignores it.</p>;
  }
  return (
    <table className="w-full font-mono text-xs/5">
      <thead>
        <tr>
          <th className={th}>Offset</th>
          <th className={th}>Name</th>
          <th className={th}>Value</th>
          <th className={cx(th, "w-full")}>Meaning</th>
        </tr>
      </thead>
      <tbody>
        {fields.map((f) => (
          <FieldRow key={f.id} f={f} />
        ))}
      </tbody>
    </table>
  );
}

function FieldRow({ f }: { f: PeField }) {
  const view = useView();
  const { props } = useTarget("pe:field:" + f.id, "pedetail", "hover:bg-[#1A1815]");
  const active = view.session.peField === f.id;
  return (
    <tr {...props} className={cx(props.className, active && "bg-raised")}>
      <td className="px-3 text-muted">{h(f.offset)}</td>
      <td className={cx("px-3 whitespace-nowrap", active ? "text-amber" : "text-fg")}>{f.name}</td>
      <td className="px-3 whitespace-nowrap text-fg">{f.value}</td>
      <td className="px-3 font-sans whitespace-nowrap text-comment">{f.meaning ?? ""}</td>
    </tr>
  );
}

const SECTION_COLS: [string, string][] = [
  ["PointerToRawData", "Raw Addr."],
  ["SizeOfRawData", "Raw size"],
  ["VirtualAddress", "Virtual Addr."],
  ["VirtualSize", "Virtual Size"],
  ["Characteristics", "Characteristics"],
];

function Sections() {
  const view = useView();
  const file = view.file!;
  const picked = view.session.peField?.startsWith("sec:") ? view.session.peField.slice(4) : null;
  const [secName, col] = picked ? picked.split(":") : [null, null];
  const sec = file.sections.find((s) => s.name === secName);
  return (
    <div className="flex flex-col">
      <table className="w-full font-mono text-xs/6">
        <thead>
          <tr>
            <th className={th}>Name</th>
            {SECTION_COLS.map(([, label]) => (
              <th key={label} className={th}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {file.sections.map((s) => (
            <tr key={s.name}>
              <SecCell id={s.name + ":Name"} text={s.name} />
              <SecCell id={s.name + ":PointerToRawData"} text={h(s.rawPtr)} />
              <SecCell id={s.name + ":SizeOfRawData"} text={h(s.rawSize)} />
              <SecCell id={s.name + ":VirtualAddress"} text={h(s.va)} />
              <SecCell id={s.name + ":VirtualSize"} text={h(s.vsize)} />
              <SecCell id={s.name + ":Characteristics"} text={h(s.chars)} />
            </tr>
          ))}
        </tbody>
      </table>
      {sec && col === "Characteristics" && (
        <div className="m-3 rounded-sm border border-line bg-ink p-3 text-xs" data-testid="section-flags">
          <p className="text-muted">{sec.name + " characteristics 0x" + h(sec.chars)}</p>
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {SECTION_FLAGS.filter(([bit]) => (sec.chars & bit) !== 0).map(([bit, name]) => (
              <li key={bit} className="flex gap-3 font-mono">
                <span className="w-24 text-comment">{"0x" + h(bit).padStart(8, "0")}</span>
                <span className="text-fg">{name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SecCell({ id, text }: { id: string; text: string }) {
  const view = useView();
  const { props } = useTarget("pe:sec:" + id, "pedetail", "px-3 hover:bg-[#1A1815]");
  const active = view.session.peField === "sec:" + id;
  return (
    <td {...props} className={cx(props.className, active ? "bg-raised text-amber" : "text-fg")}>
      {text}
    </td>
  );
}

function Imports() {
  const view = useView();
  const file = view.file!;
  const dll = view.session.peField?.startsWith("imp:") ? view.session.peField.slice(4) : null;
  const imp = file.imports.find((i) => i.dll === dll);
  return (
    <div className="flex flex-col">
      <table className="w-full font-mono text-xs/6">
        <thead>
          <tr>
            <th className={th}>Name</th>
            <th className={th}>Functions</th>
            <th className={th}>OriginalFirstThunk</th>
            <th className={cx(th, "w-full")}>FirstThunk (IAT)</th>
          </tr>
        </thead>
        <tbody>
          {file.imports.map((i) => (
            <DllRow key={i.dll} dll={i.dll} count={i.funcs.length} ilt={i.ilt} iat={i.iat} active={i.dll === dll} />
          ))}
        </tbody>
      </table>
      {imp && (
        <table className="mt-2 w-full border-t border-line font-mono text-xs/6" data-testid="import-funcs">
          <thead>
            <tr>
              <th className={th}>Call via (IAT slot)</th>
              <th className={th}>Name</th>
              <th className={th}>Hint</th>
              <th className={cx(th, "w-full")}>Thunk on disk</th>
            </tr>
          </thead>
          <tbody>
            {imp.funcs.map((f) => (
              <FuncRow key={f.name} dll={imp.dll} name={f.name} slot={f.slot} hint={f.hint} thunk={f.hintName} />
            ))}
          </tbody>
        </table>
      )}
      {!imp && <p className="p-3 text-xs text-faint">Click a DLL to list the functions taken from it.</p>}
    </div>
  );
}

function DllRow({ dll, count, ilt, iat, active }: { dll: string; count: number; ilt: number; iat: number; active: boolean }) {
  const { props } = useTarget("pe:imp:" + dll, "pedetail", "hover:bg-[#1A1815]");
  return (
    <tr {...props} className={cx(props.className, active && "bg-raised")}>
      <td className={cx("px-3 whitespace-nowrap", active ? "text-amber" : "text-fg")}>{dll}</td>
      <td className="px-3 text-muted">{count}</td>
      <td className="px-3 text-muted">{h(ilt)}</td>
      <td className="px-3 text-muted">{h(iat)}</td>
    </tr>
  );
}

function FuncRow({ dll, name, slot, hint, thunk }: { dll: string; name: string; slot: number; hint: number; thunk: number }) {
  const { props, selected } = useTarget("pe:imp:" + dll + ":" + name, "pedetail", "hover:bg-[#1A1815]");
  return (
    <tr {...props} className={cx(props.className, selected && "bg-raised")}>
      <td className="px-3 text-muted">{h(slot)}</td>
      <td className={cx("px-3", selected ? "text-amber" : "text-fg")}>{name}</td>
      <td className="px-3 text-muted">{h(hint)}</td>
      <td className="px-3 text-muted">{h(thunk)}</td>
    </tr>
  );
}

function Exports() {
  const view = useView();
  const file = view.file!;
  const [q, setQ] = useState("");
  const list = file.exports.filter((e) => e.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 border-b border-line p-2">
        <input
          aria-label="Search exports"
          placeholder="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          spellCheck={false}
          className={cx("h-6 w-64 rounded-sm border border-line bg-ink px-2 font-mono text-xs text-fg outline-none focus:border-amber-dim", view.pulse.has("pe:search") && "pulse-target")}
        />
        <span className="text-[11px] text-faint">{list.length + " of " + file.exports.length + " exports"}</span>
      </div>
      <table className="w-full font-mono text-xs/6">
        <thead>
          <tr>
            <th className={th}>Ordinal</th>
            <th className={th}>Function RVA</th>
            <th className={cx(th, "w-full")}>Name</th>
          </tr>
        </thead>
        <tbody>
          {list.map((e) => (
            <ExportRow key={e.name} name={e.name} ordinal={e.ordinal} rva={e.rva} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExportRow({ name, ordinal, rva }: { name: string; ordinal: number; rva: number }) {
  const { props, selected } = useTarget("pe:exp:" + name, "pedetail", "hover:bg-[#1A1815]");
  return (
    <tr {...props} className={cx(props.className, selected && "bg-raised")}>
      <td className="px-3 text-muted">{ordinal}</td>
      <td className="px-3 text-muted">{h(rva)}</td>
      <td className={cx("px-3", selected ? "text-amber" : "text-fg")}>{name}</td>
    </tr>
  );
}

/** The bytes behind the open tab, with the selected field highlighted. */
function PeHex({ node }: { node: string }) {
  const view = useView();
  const file = view.file!;
  const field = file.fields.find((f) => f.id === view.session.peField);
  const group =
    node === "sections"
      ? file.groups.filter((g) => g.id.startsWith("sec.")).reduce((a, g) => ({ offset: Math.min(a.offset, g.offset), size: g.offset + g.size - Math.min(a.offset, g.offset) }), { offset: 1e9, size: 0 })
      : node === "imports"
        ? (() => {
            const d = file.dataDirs[1]!;
            const s = file.sections.find((x) => d.rva >= x.va && d.rva < x.va + x.vsize);
            return s ? { offset: d.rva - s.va + s.rawPtr, size: d.size } : { offset: 0, size: 0 };
          })()
        : node === "exports"
          ? (() => {
              const d = file.dataDirs[0]!;
              const s = file.sections.find((x) => d.rva >= x.va && d.rva < x.va + x.vsize);
              return s ? { offset: d.rva - s.va + s.rawPtr, size: 0x60 } : { offset: 0, size: 0 };
            })()
          : (() => {
              const ids = node === "opt" ? ["opt", "dd"] : node === "file" ? ["nt", "file"] : [node];
              const gs = file.groups.filter((g) => ids.includes(g.id));
              if (!gs.length) return { offset: 0, size: 0 };
              const start = Math.min(...gs.map((g) => g.offset));
              return { offset: start, size: Math.max(...gs.map((g) => g.offset + g.size)) - start };
            })();
  const start = group.offset & ~0xf;
  const end = Math.min(file.bytes.length, start + Math.min(Math.max(group.size + (group.offset - start), 16), 0x180));
  const rows = [];
  for (let r = start; r < end; r += 16) rows.push(r);
  const hot = (o: number) => !!field && o >= field.offset && o < field.offset + field.size;
  return (
    <Pane id="pehex" label="Hex" className="min-h-0 grow basis-0 border-t border-line">
      <div className="pane-scroll min-h-0 grow overflow-y-auto py-1 font-mono text-xs/5" data-testid="pe-hex">
        {rows.map((r) => (
          <div key={r} className="flex">
            <span className="w-24 px-2 text-muted">{r.toString(16).toUpperCase().padStart(8, "0")}</span>
            {Array.from({ length: 16 }, (_, i) => {
              const o = r + i;
              const b = file.bytes[o] ?? 0;
              return (
                <span key={i} className={cx("w-6.5 text-center", i === 8 && "ml-2", hot(o) ? "bg-amber-dim text-fg" : b ? "text-fg" : "text-faint")}>
                  {b.toString(16).toUpperCase().padStart(2, "0")}
                </span>
              );
            })}
            <span className="ml-5 flex">
              {Array.from({ length: 16 }, (_, i) => {
                const b = file.bytes[r + i] ?? 0;
                return (
                  <span key={i} className={cx("w-2.25 text-center", hot(r + i) ? "bg-amber-dim text-fg" : "text-comment")}>
                    {b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : "."}
                  </span>
                );
              })}
            </span>
          </div>
        ))}
      </div>
    </Pane>
  );
}

export { hexOff };

