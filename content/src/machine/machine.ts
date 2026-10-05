import type { CodeModule, CodeRow, Hex, MemoryRegion, MemWrite, Recording, StringRef, SymbolInfo, TraceState } from "./types";

/**
 * A tiny machine used only to author recordings. Each instruction in a program listing carries a
 * few lines of TypeScript that say what it does; running them once produces the recorded trace.
 * Learners never run this: the player only reads the finished recording.
 */

const REGS = ["RAX", "RBX", "RCX", "RDX", "RBP", "RSP", "RSI", "RDI", "R8", "R9", "R10", "R11", "R12", "R13", "R14", "R15"] as const;
const LEGACY = ["AX", "BX", "CX", "DX", "BP", "SP", "SI", "DI"];
const MASK = { 8: 0xffn, 16: 0xffffn, 32: 0xffffffffn, 64: 0xffffffffffffffffn } as const;
type Size = keyof typeof MASK;

function alias(name: string): [string, Size] {
  const n = name.toUpperCase();
  if ((REGS as readonly string[]).includes(n)) return [n, 64];
  const legacy = LEGACY.find((l) => n === "E" + l);
  if (legacy) return ["R" + legacy, 32];
  const low = { AL: "RAX", BL: "RBX", CL: "RCX", DL: "RDX" }[n];
  if (low) return [low, 8];
  const m = /^R(\d+)([DWB])$/.exec(n);
  if (m) return ["R" + m[1], m[2] === "D" ? 32 : m[2] === "W" ? 16 : 8];
  throw new Error("unknown register " + name);
}

export const hex = (v: bigint | number, width = 16) => BigInt(v).toString(16).toUpperCase().padStart(width, "0");
export const big = (h: Hex | bigint | number) => (typeof h === "string" ? BigInt("0x" + h) : BigInt(h));

const FLAG_BITS = { CF: 0, PF: 2, AF: 4, ZF: 6, SF: 7, TF: 8, IF: 9, DF: 10, OF: 11 } as const;
export type FlagName = keyof typeof FLAG_BITS;
export const FLAG_ORDER: FlagName[] = ["ZF", "PF", "AF", "OF", "SF", "DF", "CF", "TF", "IF"];

export function flagsFromRflags(rflags: Hex): Record<FlagName, 0 | 1> {
  const v = big(rflags);
  return Object.fromEntries(
    Object.entries(FLAG_BITS).map(([k, bit]) => [k, Number((v >> BigInt(bit)) & 1n) as 0 | 1]),
  ) as Record<FlagName, 0 | 1>;
}

type Operand = string | bigint | number;

const F64 = new DataView(new ArrayBuffer(8));
export const f64Bits = (x: number) => (F64.setFloat64(0, x, true), F64.getBigUint64(0, true));
export const bitsF64 = (b: bigint) => (F64.setBigUint64(0, BigInt.asUintN(64, b), true), F64.getFloat64(0, true));
export const f32Bits = (x: number) => (F64.setFloat32(0, x, true), BigInt(F64.getUint32(0, true)));
export const bitsF32 = (b: bigint) => (F64.setUint32(0, Number(BigInt.asUintN(32, b)), true), F64.getFloat32(0, true));
const LOW64 = 0xffffffffffffffffn;
const LOW32 = 0xffffffffn;
/** How many XMM registers a recording shows when its program uses floating point. */
export const XMM_SHOWN = 6;

export class Machine {
  regs: Record<string, bigint> = {};
  /** 128-bit XMM registers. Only recorded when xmmOn is set. */
  xmm: bigint[] = Array.from({ length: 16 }, () => 0n);
  xmmOn = false;
  flags: Record<FlagName, 0 | 1> = { CF: 0, PF: 0, AF: 0, ZF: 0, SF: 0, TF: 0, IF: 1, DF: 0, OF: 0 };
  mem = new Map<bigint, number>();
  rip = 0n;
  depth = 0;
  stdin = "";
  // Per-instruction scratch, collected into the next trace state.
  next = 0n;
  jumped: bigint | null = null;
  writes: MemWrite[] = [];
  out = "";
  dialog: { title: string; text: string } | undefined;
  terminated: { code: number } | undefined;
  /** Set by an instruction to make x64dbg stop on the state after it, like the entry breakpoint. */
  event: string | undefined;

  constructor() {
    for (const r of REGS) this.regs[r] = 0n;
  }

  /* registers */
  get(name: string): bigint {
    const [full, size] = alias(name);
    return this.regs[full]! & MASK[size];
  }
  set(name: string, value: bigint | number): void {
    const [full, size] = alias(name);
    const v = BigInt.asUintN(64, BigInt(value)) & MASK[size];
    if (size === 64 || size === 32) this.regs[full] = v;
    else this.regs[full] = (this.regs[full]! & ~MASK[size]) | v;
  }
  val(x: Operand): bigint {
    return typeof x === "string" ? this.get(x) : BigInt(x);
  }

  /* floating point: scalar double (sd) and single (ss) lanes of XMM registers */
  sd(i: number): number {
    return bitsF64(this.xmm[i]! & LOW64);
  }
  ss(i: number): number {
    return bitsF32(this.xmm[i]! & LOW32);
  }
  /** Writes the low double. fromMemory zeroes the rest, like movsd xmm, m64. */
  setSd(i: number, x: number, fromMemory = false) {
    this.xmm[i] = (fromMemory ? 0n : this.xmm[i]! & ~LOW64) | f64Bits(x);
  }
  setSs(i: number, x: number, fromMemory = false) {
    this.xmm[i] = (fromMemory ? 0n : this.xmm[i]! & ~LOW32) | f32Bits(x);
  }
  ldF64(address: bigint): number {
    return bitsF64(this.ld(address, 8));
  }
  ldF32(address: bigint): number {
    return bitsF32(this.ld(address, 4));
  }

  /* memory */
  ld(address: bigint | number, size: 1 | 2 | 4 | 8): bigint {
    let v = 0n;
    for (let i = size - 1; i >= 0; i--) v = (v << 8n) | BigInt(this.mem.get(BigInt(address) + BigInt(i)) ?? 0);
    return v;
  }
  st(address: bigint | number, size: 1 | 2 | 4 | 8, value: Operand): void {
    let v = BigInt.asUintN(size * 8, this.val(value));
    const bytes: string[] = [];
    for (let i = 0; i < size; i++) {
      const b = Number(v & 0xffn);
      this.mem.set(BigInt(address) + BigInt(i), b);
      bytes.push(hex(b, 2));
      v >>= 8n;
    }
    this.writes.push({ address: hex(BigInt(address)), bytes: bytes.join(" ") });
  }
  stBytes(address: bigint, data: number[]): void {
    data.forEach((b, i) => this.mem.set(address + BigInt(i), b));
    this.writes.push({ address: hex(address), bytes: data.map((b) => hex(b, 2)).join(" ") });
  }
  cstr(address: bigint): string {
    let s = "";
    for (let a = address; ; a++) {
      const b = this.mem.get(a) ?? 0;
      if (b === 0) return s;
      s += String.fromCharCode(b);
    }
  }
  /** rsp + offset, the usual way locals and spills are addressed. */
  sp(offset = 0): bigint {
    return this.get("rsp") + BigInt(offset);
  }

  /* flags */
  private logic(r: bigint, size: Size) {
    this.flags.CF = 0;
    this.flags.OF = 0;
    this.zsp(r, size);
  }
  private zsp(r: bigint, size: Size) {
    this.flags.ZF = r === 0n ? 1 : 0;
    this.flags.SF = Number((r >> BigInt(size - 1)) & 1n) as 0 | 1;
    let low = Number(r & 0xffn);
    let ones = 0;
    while (low) {
      ones += low & 1;
      low >>= 1;
    }
    this.flags.PF = ones % 2 === 0 ? 1 : 0;
  }
  private arith(a: bigint, b: bigint, size: Size, subtract: boolean): bigint {
    const r = (subtract ? a - b : a + b) & MASK[size];
    const sign = 1n << BigInt(size - 1);
    this.flags.CF = subtract ? (b > a ? 1 : 0) : a + b > MASK[size] ? 1 : 0;
    const sa = a & sign, sb = b & sign, sr = r & sign;
    this.flags.OF = subtract ? (sa !== sb && sr !== sa ? 1 : 0) : sa === sb && sr !== sa ? 1 : 0;
    this.flags.AF = ((a ^ b ^ r) & 0x10n) !== 0n ? 1 : 0;
    this.zsp(r, size);
    return r;
  }
  sub(dst: string, src: Operand) {
    this.set(dst, this.arith(this.get(dst), this.val(src), alias(dst)[1], true));
  }
  add(dst: string, src: Operand) {
    this.set(dst, this.arith(this.get(dst), this.val(src), alias(dst)[1], false));
  }
  cmp(a: Operand, b: Operand, size: Size = 64) {
    this.arith(this.val(a) & MASK[size], this.val(b) & MASK[size], size, true);
  }
  inc(dst: string) {
    const cf = this.flags.CF;
    this.add(dst, 1);
    this.flags.CF = cf;
  }
  test(a: Operand, b: Operand, size: Size = 64) {
    this.logic(this.val(a) & this.val(b) & MASK[size], size);
  }
  xor(dst: string, src: Operand) {
    const r = this.get(dst) ^ this.val(src);
    this.set(dst, r);
    this.logic(r & MASK[alias(dst)[1]], alias(dst)[1]);
  }
  cond(cc: "e" | "ne" | "z" | "nz" | "g" | "le" | "l" | "ge" | "a" | "b" | "ae"): boolean {
    const f = this.flags;
    switch (cc) {
      case "e": case "z": return f.ZF === 1;
      case "ne": case "nz": return f.ZF === 0;
      case "g": return f.ZF === 0 && f.SF === f.OF;
      case "le": return f.ZF === 1 || f.SF !== f.OF;
      case "l": return f.SF !== f.OF;
      case "ge": return f.SF === f.OF;
      case "a": return f.CF === 0 && f.ZF === 0;
      case "b": return f.CF === 1;
      case "ae": return f.CF === 0;
    }
  }

  /* control flow */
  push(v: Operand) {
    this.set("rsp", this.get("rsp") - 8n);
    this.st(this.get("rsp"), 8, this.val(v));
  }
  pop(dst: string) {
    this.set(dst, this.ld(this.get("rsp"), 8));
    this.set("rsp", this.get("rsp") + 8n);
  }
  jmp(target: Hex | bigint) {
    this.jumped = big(target);
  }
  jcc(cc: Parameters<Machine["cond"]>[0], target: Hex) {
    if (this.cond(cc)) this.jmp(target);
  }
  call(target: Hex | bigint) {
    this.push(this.next);
    this.jmp(target);
    this.depth++;
  }
  /** call qword ptr ds:[iat], the way MSVC calls imported functions. */
  callPtr(iat: Hex) {
    this.call(this.ld(big(iat), 8));
  }
  ret() {
    const to = this.ld(this.get("rsp"), 8);
    this.set("rsp", this.get("rsp") + 8n);
    this.jmp(to);
    this.depth--;
  }
  print(text: string) {
    this.out += text;
  }
  exit(code: number) {
    this.terminated = { code };
  }
  /** Overwrite volatile registers the way a library call leaves them. */
  clobber(seed: number) {
    const junk = (n: number) => BigInt(0x7ffe1a2c0000 + ((seed * 0x1f3 + n * 0x58) & 0xffff));
    this.set("rcx", junk(1));
    this.set("rdx", 0);
    this.set("r8", junk(3));
    this.set("r9", 0);
    this.set("r10", junk(5));
    this.set("r11", 0x246);
  }

  rflags(): bigint {
    let v = 2n;
    for (const [k, bit] of Object.entries(FLAG_BITS)) if (this.flags[k as FlagName]) v |= 1n << BigInt(bit);
    return v;
  }
  snapshotRegs(): Record<string, Hex> {
    const regs: Record<string, Hex> = Object.fromEntries(REGS.map((r) => [r, hex(this.regs[r]!)]));
    if (this.xmmOn) for (let i = 0; i < XMM_SHOWN; i++) regs["XMM" + i] = hex(this.xmm[i]!, 32);
    return regs;
  }
}

/* ------------------------------------------------------------------ */
/* Program listings                                                    */
/* ------------------------------------------------------------------ */

export interface ProgramRow extends CodeRow {
  run?: (m: Machine) => void;
  info?: (m: Machine) => string[];
}

export interface ProgramModule {
  name: string;
  base: bigint;
  size: number;
  rows: ProgramRow[];
}

export interface Program {
  modules: ProgramModule[];
  symbols: SymbolInfo[];
  memory: MemoryRegion[];
  /** Record XMM registers, for programs that use floating point. */
  xmm?: boolean;
  /** Puts the machine in its state at the first recorded stop. */
  start(m: Machine): { event: string };
}

const byteLength = (bytes: string) => bytes.replace(/[:\s]/g, "").length / 2;

export interface AsmContext {
  at: bigint;
  next: bigint;
  /** Address of a label anywhere in the same assemble() call. */
  L(name: string): bigint;
}

type Text = string | ((c: AsmContext) => string);

export type AsmRow =
  | { org: bigint; fill?: boolean }
  | { align: number }
  | {
      label?: string;
      /** Instruction bytes, or [length, bytes from context] when they encode an address. */
      b: string | [number, (c: AsmContext) => string];
      m: string;
      o?: Text;
      c?: Text;
      run?: (m: Machine) => void;
      info?: (m: Machine) => string[];
    };

/**
 * A two-pass assembler for listings: rows are laid out back to back, labels resolve in the second
 * pass, so calls and jumps can encode real displacements. { org } moves to a new address and, with
 * fill, pads the gap with int3 the way MSVC aligns functions. { align } pads with int3 up to the next
 * multiple, for code laid out back to back.
 */
export function assemble(rows: AsmRow[]): { rows: ProgramRow[]; labels: Record<string, bigint> } {
  const labels: Record<string, bigint> = {};
  const placed: { at: bigint; next: bigint; row: Exclude<AsmRow, { org: bigint } | { align: number }> | null }[] = [];
  let at = 0n;
  for (const row of rows) {
    if ("align" in row) {
      const n = BigInt(row.align);
      for (; at % n !== 0n; at++) placed.push({ at, next: at + 1n, row: null });
      continue;
    }
    if ("org" in row) {
      if (row.fill) for (let a = at; a < row.org; a++) placed.push({ at: a, next: a + 1n, row: null });
      at = row.org;
      continue;
    }
    const size = typeof row.b === "string" ? byteLength(row.b) : row.b[0];
    if (row.label) labels[row.label] = at;
    placed.push({ at, next: at + BigInt(size), row });
    at += BigInt(size);
  }
  const L = (name: string) => {
    const v = labels[name];
    if (v === undefined) throw new Error("unknown label " + name);
    return v;
  };
  const out = placed.map(({ at, next, row }): ProgramRow => {
    if (!row) return { address: hex(at), bytes: "CC", mnemonic: "int3", operands: "" };
    const c: AsmContext = { at, next, L };
    const text = (t: Text | undefined) => (typeof t === "function" ? t(c) : (t ?? ""));
    const comment = text(row.c);
    return {
      address: hex(at),
      bytes: typeof row.b === "string" ? row.b : row.b[1](c),
      mnemonic: row.m,
      operands: text(row.o),
      ...(comment ? { comment } : {}),
      ...(row.run ? { run: row.run } : {}),
      ...(row.info ? { info: row.info } : {}),
    };
  });
  return { rows: out, labels };
}

/** rel32 displacement bytes, little-endian, as x64dbg prints them. */
export function rel32(from: bigint, to: bigint): string {
  const d = BigInt.asUintN(32, to - from);
  return [0, 1, 2, 3].map((i) => hex((d >> BigInt(i * 8)) & 0xffn, 2)).join("");
}


/* ------------------------------------------------------------------ */
/* Recording                                                           */
/* ------------------------------------------------------------------ */

const STRING_COMMENT = /^([0-9A-F]+):"(.*)"$/;

export function record(program: Program, opts: { id: string; label: string; stdin: string; process: Recording["process"]; maxSteps?: number }): Recording {
  const m = new Machine();
  for (const region of program.memory) {
    (region.bytes ?? "").split(" ").filter(Boolean).forEach((b, i) => m.mem.set(big(region.base) + BigInt(i), Number.parseInt(b, 16)));
  }
  m.stdin = opts.stdin;
  m.xmmOn = program.xmm ?? false;
  const { event: firstEvent } = program.start(m);

  const rows = new Map<bigint, { row: ProgramRow; next: bigint }>();
  for (const mod of program.modules) {
    mod.rows.forEach((row, i) => {
      const address = big(row.address);
      const following = mod.rows[i + 1];
      rows.set(address, { row, next: following ? big(following.address) : address + BigInt(byteLength(row.bytes)) });
    });
  }

  const states: TraceState[] = [];
  const capture = (event?: string) => {
    const at = rows.get(m.rip);
    const s: TraceState = { rip: hex(m.rip), regs: m.snapshotRegs(), rflags: hex(m.rflags()), depth: m.depth };
    if (m.writes.length) s.writes = m.writes;
    if (m.out) s.out = m.out;
    if (event) s.event = event;
    if (m.dialog) s.dialog = m.dialog;
    if (m.terminated) s.terminated = m.terminated;
    const info = at?.row.info?.(m);
    if (info?.length) s.info = info;
    states.push(s);
  };
  capture(firstEvent);

  const max = opts.maxSteps ?? 5000;
  while (!m.terminated) {
    if (states.length > max) throw new Error(opts.id + ": no exit after " + max + " steps");
    const at = rows.get(m.rip);
    if (!at) throw new Error(opts.id + ": no instruction at " + hex(m.rip));
    if (!at.row.run) throw new Error(opts.id + ": " + hex(m.rip) + " " + at.row.mnemonic + " ran but has no semantics");
    m.next = at.next;
    m.jumped = null;
    m.writes = [];
    m.out = "";
    at.row.run(m);
    m.rip = m.jumped ?? m.next;
    const event = m.event;
    m.event = undefined;
    const ended = m.terminated as { code: number } | undefined;
    capture(event ?? (ended ? "Process stopped with exit code 0x" + ended.code.toString(16).toUpperCase() : undefined));
  }

  const strings: StringRef[] = [];
  for (const mod of program.modules) {
    for (const row of mod.rows) {
      const s = row.comment ? STRING_COMMENT.exec(row.comment) : null;
      if (s) strings.push({ address: row.address, text: s[2]! });
    }
  }

  const modules: CodeModule[] = program.modules.map((mod) => ({
    name: mod.name,
    base: hex(mod.base),
    size: mod.size,
    rows: mod.rows.map(({ address, bytes, mnemonic, operands, comment }) => ({
      address,
      bytes,
      mnemonic,
      operands,
      ...(comment ? { comment } : {}),
    })),
  }));

  return { id: opts.id, label: opts.label, process: opts.process, modules, symbols: program.symbols, memory: program.memory, states, strings };
}


export function bytesOf(text: string, terminator = true): string {
  const codes = [...text].map((c) => hex(c.charCodeAt(0), 2));
  if (terminator) codes.push("00");
  return codes.join(" ");
}
