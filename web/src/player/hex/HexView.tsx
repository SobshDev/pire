import type { PeField, PeFile, PeGroup } from "@pire/content";
import { rvaToOffset, offsetToRva } from "@pire/content";
import { useEffect, useMemo, useRef, useState } from "react";
import { matchesTarget } from "../../engine/lesson";
import { cx } from "../../ui/bits";
import { Locked, Pane } from "../debugger/Pane";
import { useView } from "../view";

const ROW = 20;
const h2 = (n: number) => n.toString(16).toUpperCase().padStart(2, "0");
export const hexOff = (n: number) => n.toString(16).toUpperCase();

/** Overlay colors by structure, so the DOS header always looks like the DOS header. */
export function groupColor(id: string): string {
  if (id === "dos") return "#FFB224";
  if (id === "stub" || id === "rich") return "#948D81";
  if (id === "nt") return "#7DD181";
  if (id === "file") return "#5EB0EF";
  if (id === "opt") return "#B58CF0";
  if (id === "dd") return "#4CC3B5";
  if (id.startsWith("sec.")) return "#E58A4E";
  if (id.startsWith("iat.")) return "#F06BA8";
  if (id === "names") return "#E5C84D";
  return "#6C8AA9";
}

/** Revealed overlay entries resolved against the file: the structures, and the fields inside them. */
export function useOverlay(file: PeFile, revealed: ReadonlySet<string>) {
  return useMemo(() => {
    const groups = file.groups.filter((g) => revealed.has(g.id));
    const fields = file.fields.filter((f) => revealed.has(f.id));
    const groupAt = new Int16Array(file.bytes.length).fill(-1);
    const fieldAt = new Int16Array(file.bytes.length).fill(-1);
    groups.forEach((g, i) => groupAt.fill(i, g.offset, g.offset + g.size));
    fields.forEach((f, i) => fieldAt.fill(i, f.offset, f.offset + f.size));
    return { groups, fields, groupAt, fieldAt };
  }, [file, revealed]);
}

const alpha = (color: string, a: number) => color + Math.round(a * 255).toString(16).padStart(2, "0");

export function HexView() {
  const view = useView();
  const file = view.file!;
  const s = view.session;
  const overlay = useOverlay(file, view.revealed);
  const scroller = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  const [height, setHeight] = useState(600);
  const [drag, setDrag] = useState<{ anchor: number; cur: number } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const rows = Math.ceil(file.bytes.length / 16);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Jumps (Ctrl+G, a lesson moving the view) scroll the offset into the top third.
  useEffect(() => {
    const el = scroller.current;
    if (!el || s.hexTop === undefined) return;
    el.scrollTop = Math.max(0, Math.floor(s.hexTop / 16) * ROW - el.clientHeight / 3);
    setTop(el.scrollTop);
  }, [s.hexJump, s.file]);

  useEffect(() => {
    const up = () => {
      const d = dragRef.current;
      if (!d) return;
      setDrag(null);
      const start = Math.min(d.anchor, d.cur);
      const length = Math.abs(d.cur - d.anchor) + 1;
      if (length === 1) view.target("hex:" + hexOff(start), "hex");
      view.select(start, length, "hex");
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [view]);

  const sel: [number, number] | null = drag
    ? [Math.min(drag.anchor, drag.cur), Math.abs(drag.cur - drag.anchor) + 1]
    : (s.hexSel ?? null);
  const inSel = (o: number) => !!sel && o >= sel[0] && o < sel[0] + sel[1];
  const pulse = [...view.pulse].filter((p) => p.startsWith("hex:"));
  const rings = [...view.highlights].filter((p) => p.startsWith("hex:"));

  const first = Math.max(0, Math.floor(top / ROW) - 8);
  const last = Math.min(rows, Math.ceil((top + height) / ROW) + 8);

  const byteProps = (o: number) => {
    const fi = overlay.fieldAt[o]!;
    const gi = overlay.groupAt[o]!;
    const f = fi >= 0 ? overlay.fields[fi] : undefined;
    const g = gi >= 0 ? overlay.groups[gi] : undefined;
    const color = f ? groupColor(f.group) : g ? groupColor(g.id) : null;
    const id = "hex:" + hexOff(o);
    return {
      "data-target": id,
      title: f ? f.name + " = " + f.value : g ? g.label : undefined,
      onMouseDown: (e: React.MouseEvent) => {
        e.preventDefault();
        if (e.shiftKey && s.hexSel) setDrag({ anchor: s.hexSel[0], cur: o });
        else setDrag({ anchor: o, cur: o });
      },
      onMouseEnter: () => dragRef.current && setDrag({ ...dragRef.current, cur: o }),
      style: inSel(o) ? { backgroundColor: "#8A6516" } : color ? { backgroundColor: alpha(color, f ? 0.32 : 0.14) } : undefined,
      className: cx(
        "cursor-default",
        pulse.some((p) => matchesTarget(p, id)) && "pulse-target",
        rings.some((p) => matchesTarget(p, id)) && "relative z-10 shadow-[inset_0_0_0_1.5px_var(--color-amber)]",
      ),
    };
  };

  const labelsAt = (row: number) => {
    const from = row * 16;
    const out: { text: string; color: string }[] = [];
    for (const g of overlay.groups) if (g.offset >= from && g.offset < from + 16) out.push({ text: g.label, color: groupColor(g.id) });
    for (const f of overlay.fields) if (f.offset >= from && f.offset < from + 16) out.push({ text: f.name, color: groupColor(f.group) });
    return out;
  };

  return (
    <Pane id="hex" label="Hex viewer" className="min-w-0 grow">
      <div className="flex h-6 shrink-0 items-center border-b border-line font-mono text-[11px] text-faint select-none">
        <span className="w-24 px-2">Offset(h)</span>
        <span className="flex">
          {Array.from({ length: 16 }, (_, i) => (
            <span key={i} className={cx("w-6.5 text-center", i === 8 && "ml-2")}>
              {h2(i)}
            </span>
          ))}
        </span>
        <span className="ml-5 w-36">Decoded text</span>
        <span className="px-2">Structure</span>
      </div>
      <div
        ref={scroller}
        className="pane-scroll min-h-0 grow overflow-y-auto font-mono text-xs select-none"
        onScroll={(e) => setTop(e.currentTarget.scrollTop)}
        data-testid="hex-rows"
      >
        <div style={{ height: rows * ROW, position: "relative" }}>
          {Array.from({ length: last - first }, (_, k) => {
            const row = first + k;
            const base = row * 16;
            const labels = labelsAt(row);
            return (
              <div key={row} className="absolute inset-x-0 flex items-center" style={{ top: row * ROW, height: ROW }}>
                <span className={cx("w-24 px-2", sel && base <= sel[0] && sel[0] < base + 16 ? "text-amber" : "text-muted")}>
                  {base.toString(16).toUpperCase().padStart(8, "0")}
                </span>
                <span className="flex">
                  {Array.from({ length: 16 }, (_, i) => {
                    const o = base + i;
                    if (o >= file.bytes.length) return <span key={i} className={cx("w-6.5", i === 8 && "ml-2")} />;
                    const b = file.bytes[o]!;
                    const p = byteProps(o);
                    return (
                      <span key={i} {...p} className={cx(p.className, "w-6.5 text-center leading-5", i === 8 && "ml-2", b === 0 ? "text-faint" : "text-fg")}>
                        {h2(b)}
                      </span>
                    );
                  })}
                </span>
                <span className="ml-5 flex w-36">
                  {Array.from({ length: 16 }, (_, i) => {
                    const o = base + i;
                    if (o >= file.bytes.length) return null;
                    const b = file.bytes[o]!;
                    const p = byteProps(o);
                    const printable = b >= 0x20 && b < 0x7f;
                    return (
                      <span key={i} {...p} className={cx(p.className, "w-2.25 text-center leading-5", printable ? "text-comment" : "text-faint")}>
                        {printable ? String.fromCharCode(b) : "."}
                      </span>
                    );
                  })}
                </span>
                <span className="flex min-w-0 gap-2 truncate px-2 font-sans text-[11px]">
                  {labels.map((l) => (
                    <span key={l.text} style={{ color: l.color }}>
                      {l.text}
                    </span>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Pane>
  );
}

/** Reads a little-endian number from the selection. */
function valueOf(file: PeFile, start: number, length: number): bigint {
  let v = 0n;
  for (let i = length - 1; i >= 0; i--) v = (v << 8n) | BigInt(file.bytes[start + i] ?? 0);
  return v;
}

export function Inspector() {
  const view = useView();
  const file = view.file!;
  const s = view.session;
  const sel = s.hexSel ?? null;
  const overlay = useOverlay(file, view.revealed);
  const bytes = sel ? Array.from(file.bytes.slice(sel[0], sel[0] + Math.min(sel[1], 16))).map(h2) : [];
  const numeric = sel && [1, 2, 4, 8].includes(sel[1]);

  return (
    <Pane id="inspector" label="Inspector" className="w-80 shrink-0 border-l border-line">
      <div className="pane-scroll flex min-h-0 grow flex-col gap-4 overflow-y-auto p-3 text-xs">
        <section>
          <p className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">File</p>
          <p className="mt-1 text-fg">{file.name}</p>
          <p className="text-muted">{file.bytes.length.toLocaleString("en-US") + " bytes (0x" + hexOff(file.bytes.length) + ")"}</p>
        </section>

        <section data-testid="selection">
          <p className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">Selection</p>
          {sel ? (
            <>
              <p className="mt-1 text-fg">{"Offset 0x" + hexOff(sel[0]) + " · " + sel[1] + (sel[1] === 1 ? " byte" : " bytes")}</p>
              <p className="mt-0.5 font-mono text-comment">{bytes.join(" ") + (sel[1] > 16 ? " ..." : "")}</p>
            </>
          ) : (
            <p className="mt-1 text-faint">Click a byte, or drag across bytes to select them.</p>
          )}
        </section>

        <section>
          <p className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">Little-endian value</p>
          {!s.helper ? (
            <Locked label="Little-endian helper" lesson={view.locks.helper ?? "a later lesson"} className="mt-1.5 h-9 rounded-sm" />
          ) : numeric && sel ? (
            <div className="mt-1.5 rounded-sm border border-line bg-ink px-2.5 py-2" data-testid="le-value">
              <p className="font-mono text-sm text-amber">{"0x" + valueOf(file, sel[0], sel[1]).toString(16).toUpperCase()}</p>
              <p className="mt-0.5 text-muted">
                {valueOf(file, sel[0], sel[1]).toString(10) + " · bytes read right to left: " + [...bytes].reverse().join(" ")}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-faint">Select 2, 4, or 8 bytes to read them as one number.</p>
          )}
        </section>

        {s.converter && <Converter file={file} />}

        <section>
          <p className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">Structures found</p>
          {overlay.groups.length + overlay.fields.length === 0 ? (
            <p className="mt-1 text-faint">None yet. They appear here as you find them.</p>
          ) : (
            <div className="mt-1.5 flex flex-col">
              {overlay.groups.map((g) => (
                <StructRow key={g.id} item={g} />
              ))}
              {overlay.fields.map((f) => (
                <StructRow key={f.id} item={f} />
              ))}
            </div>
          )}
        </section>
      </div>
    </Pane>
  );
}

function StructRow({ item }: { item: PeGroup | PeField }) {
  const view = useView();
  const isField = "group" in item;
  const color = groupColor(isField ? item.group : item.id);
  return (
    <button
      type="button"
      onClick={() => view.select(item.offset, item.size, "inspector")}
      className="flex items-center gap-2 rounded-xs px-1 py-0.5 text-left hover:bg-raised"
    >
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="min-w-0 grow truncate text-fg">{isField ? item.name : item.label}</span>
      <span className="font-mono text-[11px] text-muted">{isField ? item.value : "0x" + hexOff(item.offset)}</span>
    </button>
  );
}

/** VA, RVA, and file offset for the open file. Type in any box. */
export function Converter({ file }: { file: PeFile }) {
  const [rva, setRva] = useState<number | null>(null);
  const [edit, setEdit] = useState<{ kind: string; text: string } | null>(null);
  const parse = (t: string) => {
    const v = t.trim().replace(/^0x/i, "");
    return /^[0-9a-f]+$/i.test(v) ? BigInt("0x" + v) : null;
  };
  const set = (kind: string, text: string) => {
    setEdit({ kind, text });
    const v = parse(text);
    if (v === null) return setRva(null);
    if (kind === "va") setRva(v >= file.imageBase ? Number(v - file.imageBase) : null);
    else if (kind === "rva") setRva(Number(v));
    else setRva(offsetToRva(file, Number(v)));
  };
  const shown = (kind: string, value: string) => (edit?.kind === kind ? edit.text : value);
  const off = rva === null ? null : rvaToOffset(file, rva);
  const fields: [string, string, string][] = [
    ["va", "VA", rva === null ? "" : (file.imageBase + BigInt(rva)).toString(16).toUpperCase()],
    ["rva", "RVA", rva === null ? "" : hexOff(rva)],
    ["off", "File offset", off === null ? "" : hexOff(off)],
  ];
  return (
    <section data-testid="converter">
      <p className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">Address converter</p>
      <div className="mt-1.5 flex flex-col gap-1.5">
        {fields.map(([kind, label, value]) => (
          <label key={kind} className="flex items-center gap-2">
            <span className="w-20 text-muted">{label}</span>
            <input
              aria-label={label}
              value={shown(kind, value)}
              onChange={(e) => set(kind, e.target.value)}
              onBlur={() => setEdit(null)}
              spellCheck={false}
              className="h-6 min-w-0 grow rounded-sm border border-line bg-ink px-2 font-mono text-[11px] text-fg outline-none focus:border-amber-dim"
            />
          </label>
        ))}
      </div>
    </section>
  );
}

