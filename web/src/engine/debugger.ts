import type { CodeRow, Recording, ToolId, TraceState } from "@pire/content";

/**
 * The debugger session: what x64dbg would be doing right now on top of a recording. Every function
 * here is pure. Execution keys move through the recorded trace; breakpoints decide where they stop.
 */

export type Hex = string;
export type Tab = "CPU" | "Breakpoints" | "References" | "Log" | "Memory Map" | "Call Stack";
export const TABS: Tab[] = ["CPU", "Breakpoints", "References", "Log", "Memory Map", "Call Stack"];

export interface Breakpoint {
  address: Hex;
  kind: "software" | "hardware";
  enabled: boolean;
  /** Hardware breakpoints watch this many bytes for writes. */
  size?: 1 | 2 | 4 | 8;
}

export interface Session {
  recording: string;
  index: number;
  /** The state before the last execution key, used to paint changed values red. */
  prev: number;
  breakpoints: Breakpoint[];
  /** First address shown in the dump. */
  dump: Hex;
  /** Address the disassembly is showing, or null to follow RIP. */
  view: Hex | null;
  tab: Tab;
  log: string[];
  /** Status bar text after the last stop. */
  message: string;
  /** Whether a string reference search has filled the References tab. */
  references: boolean;
  /** Open "Enter expression to follow" dialog, if any. */
  goto: "dump" | "disassembly" | "hex" | null;
  /** The tool on screen. Missing means x64dbg (sessions saved before Module 2). */
  tool?: ToolId;
  /** File open in the hex viewer and PE viewer. */
  file?: string | null;
  /** Hex viewer selection as [offset, length]. */
  hexSel?: [number, number] | null;
  /** Offset the hex viewer last jumped to, and a counter so jumping to the same offset scrolls again. */
  hexTop?: number;
  hexJump?: number;
  helper?: boolean;
  converter?: boolean;
  peNode?: string;
  peNodes?: string[] | null;
  /** PE viewer: the selected field, import DLL ("imp:USER32.dll"), or section cell. */
  peField?: string | null;
}

export const pad = (v: bigint) => v.toString(16).toUpperCase().padStart(16, "0");
export const big = (h: Hex) => BigInt("0x" + h);
export const short = (h: Hex) => h.replace(/^0+(?=.)/, "");

export function newSession(rec: Recording, at = 0): Session {
  const index = Math.min(Math.max(at, 0), rec.states.length - 1);
  return {
    recording: rec.id,
    index,
    prev: index,
    breakpoints: [],
    dump: rec.memory.find((r) => r.section === ".rdata" && r.bytes?.includes("3D"))?.base ?? rec.memory[0]?.base ?? pad(0n),
    view: null,
    tab: "CPU",
    log: [],
    message: rec.states[index]?.event ?? "",
    references: false,
    goto: null,
  };
}

export function stateOf(rec: Recording, s: Session): TraceState {
  return rec.states[s.index]!;
}

/* ------------------------------------------------------------------ */
/* Code and symbols                                                    */
/* ------------------------------------------------------------------ */

interface CodeIndex {
  rows: Map<string, { row: CodeRow; module: string; next: string }>;
  returnSites: Set<string>;
}
const codeCache = new WeakMap<Recording, CodeIndex>();

function codeIndex(rec: Recording): CodeIndex {
  let idx = codeCache.get(rec);
  if (idx) return idx;
  idx = { rows: new Map(), returnSites: new Set() };
  for (const mod of rec.modules) {
    mod.rows.forEach((row, i) => {
      const nextRow = mod.rows[i + 1];
      const next = nextRow?.address ?? row.address;
      idx!.rows.set(row.address, { row, module: mod.name, next });
      if (row.mnemonic === "call" && nextRow) idx!.returnSites.add(nextRow.address);
    });
  }
  codeCache.set(rec, idx);
  return idx;
}

export function rowAt(rec: Recording, address: Hex) {
  return codeIndex(rec).rows.get(address);
}

export function moduleOf(rec: Recording, address: Hex) {
  const a = big(address);
  return rec.modules.find((m) => a >= big(m.base) && a < big(m.base) + BigInt(m.size));
}

const moduleShort = (name: string) => name.replace(/\.(exe|dll)$/i, "");

/** "vault.main", "vault.main+1C", "kernel32.BaseThreadInitThunk+14", or "vault.0000000140001234". */
export function symbolize(rec: Recording, address: Hex, exactOnly = false): string | null {
  const mod = moduleOf(rec, address);
  if (!mod) return null;
  const a = big(address);
  let best: { name: string; at: bigint } | null = null;
  for (const s of rec.symbols) {
    if (s.module !== mod.name) continue;
    const at = big(s.address);
    if (at === a) return moduleShort(mod.name) + "." + s.name;
    if (s.kind === "data" || exactOnly) continue;
    if (at < a && a - at < 0x400n && (!best || at > best.at)) best = { name: s.name, at };
  }
  if (best) return moduleShort(mod.name) + "." + best.name + "+" + (a - best.at).toString(16).toUpperCase();
  return exactOnly ? null : moduleShort(mod.name) + "." + address;
}

/** The address an expression names: hex, a register, or a symbol such as MessageBoxA or user32.MessageBoxA. */
export function resolve(rec: Recording, s: Session, expr: string): Hex | null {
  const e = expr.trim().replace(/^0x/i, "");
  if (!e) return null;
  const state = stateOf(rec, s);
  const reg = Object.keys(state.regs).find((r) => r.toLowerCase() === e.toLowerCase());
  if (reg) return state.regs[reg]!;
  if (e.toLowerCase() === "rip") return state.rip;
  const [modPart, namePart] = e.includes(".") ? e.split(".", 2) : [null, e];
  const lower = (namePart ?? "").toLowerCase();
  const sym = rec.symbols.find(
    (sy) => sy.name.toLowerCase() === lower && (!modPart || moduleShort(sy.module).toLowerCase() === modPart.toLowerCase()),
  );
  if (sym) return sym.address;
  if (/^[0-9a-f]{1,16}$/i.test(e)) return pad(BigInt("0x" + e));
  return null;
}

/* ------------------------------------------------------------------ */
/* Memory                                                              */
/* ------------------------------------------------------------------ */

interface MemIndex {
  initial: Map<bigint, number>;
  ranges: [bigint, bigint][];
  writes: Map<bigint, [number, number][]>;
  console: string[];
}
const memCache = new WeakMap<Recording, MemIndex>();

function memIndex(rec: Recording): MemIndex {
  let idx = memCache.get(rec);
  if (idx) return idx;
  const initial = new Map<bigint, number>();
  const ranges: [bigint, bigint][] = [];
  for (const r of rec.memory) {
    const base = big(r.base);
    ranges.push([base, base + BigInt(r.size)]);
    (r.bytes ?? "").split(" ").filter(Boolean).forEach((b, i) => initial.set(base + BigInt(i), Number.parseInt(b, 16)));
  }
  const writes = new Map<bigint, [number, number][]>();
  const console: string[] = [];
  let text = "";
  rec.states.forEach((st, i) => {
    for (const w of st.writes ?? []) {
      const base = big(w.address);
      w.bytes.split(" ").forEach((b, k) => {
        const a = base + BigInt(k);
        const list = writes.get(a) ?? [];
        list.push([i, Number.parseInt(b, 16)]);
        writes.set(a, list);
      });
    }
    text += st.out ?? "";
    console.push(text);
  });
  idx = { initial, ranges, writes, console };
  memCache.set(rec, idx);
  return idx;
}

/** The byte at an address at a point in the trace, or null if nothing is mapped there. */
export function readByte(rec: Recording, index: number, address: bigint): number | null {
  const idx = memIndex(rec);
  const list = idx.writes.get(address);
  if (list) {
    for (let k = list.length - 1; k >= 0; k--) if (list[k]![0] <= index) return list[k]![1];
  }
  if (idx.initial.has(address)) return idx.initial.get(address)!;
  return idx.ranges.some(([a, b]) => address >= a && address < b) ? 0 : null;
}

export function readQword(rec: Recording, index: number, address: bigint): bigint | null {
  let v = 0n;
  for (let i = 7; i >= 0; i--) {
    const b = readByte(rec, index, address + BigInt(i));
    if (b === null) return null;
    v = (v << 8n) | BigInt(b);
  }
  return v;
}

export function readString(rec: Recording, index: number, address: bigint, max = 64): string | null {
  let s = "";
  for (let i = 0; i < max; i++) {
    const b = readByte(rec, index, address + BigInt(i));
    if (b === null) return null;
    if (b === 0) break;
    if (b !== 0x0a && (b < 0x20 || b >= 0x7f)) return null;
    s += b === 0x0a ? "\\n" : String.fromCharCode(b);
  }
  return s.length >= 1 ? s : null;
}

export function consoleText(rec: Recording, index: number): string {
  return memIndex(rec).console[index] ?? "";
}

/** What x64dbg writes next to a value: a string it points at, a return address, or a symbol. */
export function describe(rec: Recording, index: number, value: Hex, onStack = false): string {
  const v = big(value);
  if (v === 0n) return "";
  const code = codeIndex(rec);
  const mod = moduleOf(rec, value);
  if (onStack && mod && (code.returnSites.has(value) || mod.rows.length === 0)) {
    return "return to " + (symbolize(rec, value) ?? value);
  }
  const text = readString(rec, index, v);
  if (text && text.length >= 2) return '"' + text + '"';
  const sym = symbolize(rec, value, true);
  if (sym) return "<" + sym + ">";
  return "";
}

/* ------------------------------------------------------------------ */
/* Execution                                                           */
/* ------------------------------------------------------------------ */

function hwHit(st: TraceState, bp: Breakpoint): boolean {
  const lo = big(bp.address);
  const hi = lo + BigInt(bp.size ?? 1);
  return (st.writes ?? []).some((w) => {
    const a = big(w.address);
    const b = a + BigInt(w.bytes.split(" ").length);
    return a < hi && lo < b;
  });
}

/** Moves forward until want() says stop, or a breakpoint, an automatic stop, or the end gets in the way. */
function runUntil(rec: Recording, s: Session, want: (st: TraceState, j: number) => boolean, label: string): Session {
  const from = stateOf(rec, s);
  if (from.terminated) return { ...s, message: "The process has already exited." };
  for (let j = s.index + 1; j < rec.states.length; j++) {
    const st = rec.states[j]!;
    let message: string | null = null;
    const sw = s.breakpoints.find((b) => b.enabled && b.kind === "software" && b.address === st.rip);
    const hw = s.breakpoints.find((b) => b.enabled && b.kind === "hardware" && hwHit(st, b));
    if (st.terminated) message = st.event ?? "Process stopped.";
    else if (hw) message = "Hardware breakpoint (" + sizeName(hw.size) + ", write) at " + where(rec, hw.address) + "!";
    else if (sw) message = "INT3 breakpoint at " + where(rec, sw.address) + "!";
    else if (st.event) message = st.event;
    else if (want(st, j)) message = label;
    if (message !== null) return { ...s, index: j, prev: s.index, view: null, tab: "CPU", message, goto: null };
  }
  return s;
}

const sizeName = (size?: number) => ({ 1: "byte", 2: "word", 4: "dword", 8: "qword" })[size ?? 1] ?? "byte";
export const where = (rec: Recording, address: Hex) => {
  const sym = symbolize(rec, address);
  return sym && !sym.endsWith(address) ? sym + " (" + address + ")" : address;
};

export function stepInto(rec: Recording, s: Session): Session {
  return runUntil(rec, s, () => true, "");
}

export function stepOver(rec: Recording, s: Session): Session {
  const from = stateOf(rec, s);
  const row = rowAt(rec, from.rip)?.row;
  if (row?.mnemonic !== "call") return stepInto(rec, s);
  return runUntil(rec, s, (st) => st.depth <= from.depth, "");
}

export function run(rec: Recording, s: Session): Session {
  return runUntil(rec, s, () => false, "");
}

export function runToCursor(rec: Recording, s: Session, address: Hex): Session {
  return runUntil(rec, s, (st) => st.rip === address, "");
}

/** Ctrl+F9: run until the current function is about to return. */
export function runToReturn(rec: Recording, s: Session): Session {
  const depth = stateOf(rec, s).depth;
  return runUntil(rec, s, (st) => st.depth === depth && rowAt(rec, st.rip)?.row.mnemonic === "ret", "");
}

/** Ctrl+F2: start the program again. Breakpoints are kept, like in x64dbg. */
export function restart(rec: Recording, s: Session): Session {
  const fresh = newSession(rec);
  return { ...fresh, breakpoints: s.breakpoints, dump: s.dump, log: [...s.log, "Restarted " + rec.process.name] };
}

/* ------------------------------------------------------------------ */
/* Breakpoints and commands                                            */
/* ------------------------------------------------------------------ */

export function toggleBreakpoint(rec: Recording, s: Session, address: Hex): Session {
  const existing = s.breakpoints.find((b) => b.kind === "software" && b.address === address);
  if (existing) {
    return { ...s, breakpoints: s.breakpoints.filter((b) => b !== existing), log: [...s.log, "Breakpoint at " + where(rec, address) + " deleted!"] };
  }
  return addBreakpoint(rec, s, { address, kind: "software", enabled: true });
}

export function addBreakpoint(rec: Recording, s: Session, bp: Breakpoint): Session {
  const others = s.breakpoints.filter((b) => !(b.address === bp.address && b.kind === bp.kind));
  const what = bp.kind === "hardware" ? "Hardware breakpoint (" + sizeName(bp.size) + ", write)" : "Breakpoint";
  return { ...s, breakpoints: [...others, bp], log: [...s.log, what + " at " + where(rec, bp.address) + " set!"] };
}

export function setBreakpointEnabled(s: Session, address: Hex, kind: Breakpoint["kind"], enabled: boolean): Session {
  return { ...s, breakpoints: s.breakpoints.map((b) => (b.address === address && b.kind === kind ? { ...b, enabled } : b)) };
}

export function deleteBreakpoint(s: Session, address: Hex, kind: Breakpoint["kind"]): Session {
  return { ...s, breakpoints: s.breakpoints.filter((b) => !(b.address === address && b.kind === kind)) };
}

export interface CommandResult {
  session: Session;
  ok: boolean;
}

/** The x64dbg command bar, for the commands the course teaches. */
export function command(rec: Recording, s: Session, input: string): CommandResult {
  const text = input.trim();
  const [verb = "", ...rest] = text.split(/\s+/);
  const args = rest.join(" ").split(",").map((a) => a.trim()).filter(Boolean);
  const fail = (msg: string): CommandResult => ({ session: { ...s, log: [...s.log, msg] }, ok: false });
  const target = args[0] ? resolve(rec, s, args[0]) : null;
  switch (verb.toLowerCase()) {
    case "bp":
    case "bpx":
      if (!target) return fail("Invalid expression: \"" + (args[0] ?? "") + "\"");
      return { session: addBreakpoint(rec, s, { address: target, kind: "software", enabled: true }), ok: true };
    case "bph":
    case "bphws": {
      if (!target) return fail("Invalid expression: \"" + (args[0] ?? "") + "\"");
      const size = Number(args[2] ?? 1);
      if (![1, 2, 4, 8].includes(size)) return fail("Invalid size");
      return { session: addBreakpoint(rec, s, { address: target, kind: "hardware", enabled: true, size: size as 1 | 2 | 4 | 8 }), ok: true };
    }
    case "bc":
    case "bpc":
      if (!target) return fail("Invalid expression: \"" + (args[0] ?? "") + "\"");
      return { session: { ...deleteBreakpoint(s, target, "software"), log: [...s.log, "Breakpoint deleted!"] }, ok: true };
    case "bpd":
    case "bpe":
      if (!target) return fail("Invalid expression: \"" + (args[0] ?? "") + "\"");
      return { session: setBreakpointEnabled(s, target, "software", verb.toLowerCase() === "bpe"), ok: true };
    case "dump":
      if (!target) return fail("Invalid expression: \"" + (args[0] ?? "") + "\"");
      return { session: { ...s, dump: alignDump(target) }, ok: true };
    case "disasm":
    case "d":
      if (!target) return fail("Invalid expression: \"" + (args[0] ?? "") + "\"");
      return { session: { ...s, view: target, tab: "CPU" }, ok: true };
    default:
      return fail("Unknown command \"" + verb + "\"");
  }
}

/** Ctrl+G: follow an expression in the dump or the disassembly. */
export function gotoExpression(rec: Recording, s: Session, pane: "dump" | "disassembly", expr: string): CommandResult {
  const target = resolve(rec, s, expr);
  if (!target) return { session: s, ok: false };
  const next = pane === "dump" ? { ...s, dump: target } : { ...s, view: target, tab: "CPU" as Tab };
  return { session: { ...next, goto: null }, ok: true };
}

const alignDump = (address: Hex) => address;

export function followInDump(s: Session, address: Hex): Session {
  return { ...s, dump: address };
}

export function followInDisassembler(s: Session, address: Hex): Session {
  return { ...s, view: address, tab: "CPU" };
}

export function searchStrings(s: Session): Session {
  return { ...s, references: true, tab: "References" };
}

/* ------------------------------------------------------------------ */
/* Call stack                                                          */
/* ------------------------------------------------------------------ */

export interface Frame {
  /** Stack address of the return address, or RSP for the current frame. */
  slot: Hex;
  /** Return address, or RIP for the current frame. */
  to: Hex;
  /** Start of the function the frame returns from. */
  from: Hex | null;
  comment: string;
}

/** The Call Stack tab: the current frame, every call still open in the trace, then the Windows frames below the entry point. */
export function callStack(rec: Recording, s: Session): Frame[] {
  const open: { slot: Hex; to: Hex; callee: Hex }[] = [];
  let started = false;
  for (let i = 0; i < s.index; i++) {
    const a = rec.states[i]!;
    const b = rec.states[i + 1]!;
    if (b.event?.includes("entry breakpoint")) {
      open.length = 0;
      started = true;
      continue;
    }
    if (b.depth > a.depth) open.push({ slot: b.regs.RSP!, to: rowAt(rec, a.rip)?.next ?? a.rip, callee: b.rip });
    else if (b.depth < a.depth) open.pop();
  }
  const st = stateOf(rec, s);
  const name = (a: Hex) => symbolize(rec, a) ?? a;
  const frames: Frame[] = [{ slot: st.regs.RSP!, to: st.rip, from: null, comment: name(st.rip) }];
  for (const f of [...open].reverse()) frames.push({ slot: f.slot, to: f.to, from: f.callee, comment: "return to " + name(f.to) + " from " + name(f.callee) });
  if (started) {
    for (const f of rec.baseFrames ?? []) frames.push({ slot: f.slot, to: f.to, from: f.from, comment: "return to " + name(f.to) + " from " + name(f.from) });
  }
  return frames;
}
