/**
 * The recording format. A recording is everything x64dbg would show during one run of a program:
 * the code it can display, the symbols it knows, the starting memory, and the machine state before
 * every instruction that ran. It is plain JSON on purpose, so real x64dbg captures can replace the
 * generated ones without touching the player.
 */

/** Uppercase hex without 0x, padded to 16 digits for addresses. */
export type Hex = string;

export interface CodeRow {
  address: Hex;
  bytes: string;
  mnemonic: string;
  operands: string;
  comment?: string;
}

export interface CodeModule {
  name: string;
  base: Hex;
  size: number;
  rows: CodeRow[];
}

export interface SymbolInfo {
  name: string;
  address: Hex;
  module: string;
  kind: "function" | "data" | "export";
}

export interface MemoryRegion {
  base: Hex;
  size: number;
  /** Initial bytes from base. Anything past them in the region starts as zero. */
  bytes?: string;
  /** Section name shown in the memory map, such as ".rdata". */
  section?: string;
}

export interface MemWrite {
  address: Hex;
  bytes: string;
}

export interface TraceState {
  rip: Hex;
  regs: Record<string, Hex>;
  rflags: Hex;
  /** Memory written by the instruction that ran just before this state. */
  writes?: MemWrite[];
  /** Console output printed by that instruction. */
  out?: string;
  /** Call depth. A call adds one, a ret removes one. */
  depth: number;
  /** Why x64dbg stops here on its own, such as "System breakpoint reached!". */
  event?: string;
  /** Info box lines for the instruction at RIP. */
  info?: string[];
  dialog?: { title: string; text: string };
  terminated?: { code: number };
}

export interface StringRef {
  /** Address of the instruction that references the string. */
  address: Hex;
  text: string;
}

export interface Recording {
  id: string;
  /** Short description such as "vault.exe, input hello". */
  label: string;
  process: { name: string; pid: string; tid: string };
  modules: CodeModule[];
  symbols: SymbolInfo[];
  memory: MemoryRegion[];
  states: TraceState[];
  strings: StringRef[];
  /** Log tab lines from process start to the first stop: loaded DLLs, the system breakpoint. */
  log?: string[];
  /** Memory Map tab rows. */
  memoryMap?: MapRow[];
  /** Call stack frames below the entry point (Windows code that called it), oldest last. */
  baseFrames?: { slot: Hex; to: Hex; from: Hex }[];
}

export interface MapRow {
  address: Hex;
  size: Hex;
  info: string;
  content: string;
  type: "IMG" | "PRV" | "MAP";
  protection: string;
}
