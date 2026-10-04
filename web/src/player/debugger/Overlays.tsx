import { useEffect, useRef, useState } from "react";
import { consoleText } from "../../engine/debugger";
import { cx } from "../../ui/bits";
import { useView } from "../view";
import { Pane } from "./Pane";

export interface MenuItem {
  id?: string;
  label: string;
  hint?: string;
  children?: MenuItem[];
}

/** The right-click menus x64dbg shows, cut down to what the course uses. */
export function menuFor(target: string): MenuItem[] {
  if (target.startsWith("disasm:")) {
    return [
      { label: "Breakpoint", children: [{ id: "bp-toggle", label: "Toggle", hint: "F2" }] },
      { label: "Follow in Dump", children: [{ label: "Constant", hint: "" }] },
      {
        label: "Search for",
        children: [
          { label: "Current Region", children: [{ label: "String references" }] },
          { label: "Current Module", children: [{ id: "search-strings", label: "String references" }] },
          { label: "All Modules", children: [{ label: "String references" }] },
        ],
      },
      { label: "Copy", hint: "Ctrl+C" },
    ];
  }
  if (target.startsWith("reg:")) {
    return [
      { id: "follow-dump", label: "Follow in Dump" },
      { id: "follow-disasm", label: "Follow in Disassembler" },
      { label: "Copy value", hint: "Ctrl+C" },
      { label: "Modify value", hint: "Enter" },
    ];
  }
  if (target.startsWith("stack:")) {
    return [
      { id: "follow-dump", label: "Follow in Dump" },
      { id: "follow-disasm", label: "Follow in Disassembler" },
      { label: "Copy", hint: "Ctrl+C" },
    ];
  }
  if (target.startsWith("dump:byte:")) {
    const sizes: MenuItem[] = [
      { id: "hw-write-1", label: "Byte" },
      { id: "hw-write-2", label: "Word" },
      { id: "hw-write-4", label: "Dword" },
      { id: "hw-write-8", label: "Qword" },
    ];
    return [
      {
        label: "Breakpoint",
        children: [
          { label: "Hardware, Access", children: sizes.map((s) => ({ label: s.label })) },
          { label: "Hardware, Write", children: sizes },
          { label: "Memory, Access" },
        ],
      },
      { label: "Follow in Disassembler" },
      { label: "Copy", hint: "Ctrl+C" },
    ];
  }
  return [];
}

export function ContextMenu({ x, y, items, onPick, onClose }: { x: number; y: number; items: MenuItem[]; onPick(id: string): void; onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);
  return (
    <div ref={ref} className="fixed z-[60]" style={{ left: x, top: y }}>
      <MenuList items={items} onPick={onPick} />
    </div>
  );
}

function MenuList({ items, onPick }: { items: MenuItem[]; onPick(id: string): void }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div role="menu" className="min-w-48 rounded-sm border border-line bg-[#1A1815] py-1 font-sans text-xs shadow-2xl">
      {items.map((item, i) => (
        <div key={item.label} className="relative" onMouseEnter={() => setOpen(i)}>
          <button
            type="button"
            role="menuitem"
            disabled={!item.id && !item.children}
            onClick={() => (item.id ? onPick(item.id) : setOpen(i))}
            className={cx(
              "flex w-full items-center justify-between gap-6 px-3 py-1 text-left",
              item.id || item.children ? "text-fg hover:bg-amber-dim/50" : "text-faint",
              open === i && item.children && "bg-amber-dim/50",
            )}
          >
            <span>{item.label}</span>
            <span className="text-faint">{item.children ? "›" : (item.hint ?? "")}</span>
          </button>
          {open === i && item.children && (
            <div className="absolute top-0 left-full -mt-1">
              <MenuList items={item.children} onPick={onPick} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function GotoDialog({ pane, onSubmit, onClose }: { pane: "dump" | "disassembly"; onSubmit(text: string): void; onClose(): void }) {
  const [text, setText] = useState("");
  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center bg-ink/40 pt-40" onMouseDown={onClose}>
      <form
        role="dialog"
        aria-label="Enter expression"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onSubmit(text);
        }}
        className="w-96 rounded-sm border border-line bg-panel shadow-2xl"
      >
        <div className="border-b border-line px-3 py-1.5 text-xs text-muted">
          {"Enter expression to follow in " + (pane === "dump" ? "Dump" : "Disassembler") + "..."}
        </div>
        <div className="flex gap-2 p-3">
          <input
            autoFocus
            aria-label="Expression"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
            spellCheck={false}
            className="h-7 grow rounded-sm border border-line bg-ink px-2 font-mono text-xs text-fg outline-none focus:border-amber-dim"
          />
          <button type="submit" className="h-7 rounded-sm border border-line px-3 text-xs text-fg hover:border-amber-dim">
            OK
          </button>
        </div>
      </form>
    </div>
  );
}

/** The program's own console window, docked under the dump. */
export function ConsoleWindow() {
  const view = useView();
  const text = consoleText(view.rec, view.session.index);
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [text]);
  return (
    <Pane id="console" label="Program console" className="h-24 shrink-0 border-t border-line bg-black">
      <div className="flex h-5 shrink-0 items-center gap-2 border-b border-line px-2 text-[11px] text-faint">
        <span className="h-2 w-2 rounded-full bg-faint" />
        {"C:\\pire\\" + view.rec.process.name}
      </div>
      <pre ref={ref} className="pane-scroll min-h-0 grow overflow-y-auto px-2 py-1 font-mono text-xs/4.5 text-[#D7D2C8]" data-testid="console">
        {text}
        {!view.state.terminated && <span className="animate-pulse text-faint">_</span>}
      </pre>
    </Pane>
  );
}

/** The Windows message box the program is showing, if it is showing one. */
export function MessageBox() {
  const view = useView();
  const dialog = view.state.dialog;
  if (!dialog) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      <div className="w-72 rounded-sm border border-[#3A3A3A] bg-[#F0F0F0] text-[#1A1A1A] shadow-2xl" role="alertdialog" aria-label={dialog.title}>
        <div className="flex h-7 items-center justify-between bg-white px-2 text-xs">
          <span>{dialog.title}</span>
          <span>✕</span>
        </div>
        <p className="px-5 py-5 text-sm">{dialog.text}</p>
        <div className="flex justify-end bg-[#E5E5E5] px-3 py-2">
          <span className="rounded-xs border border-[#0067C0] bg-white px-5 py-0.5 text-xs">OK</span>
        </div>
      </div>
    </div>
  );
}
