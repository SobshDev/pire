import { assemble, big, bitsF64, bytesOf, hex, record, rel32, type AsmContext, type AsmRow, type Machine, type Program, type ProgramModule } from "../machine/machine";
import type { MemoryRegion, Recording, SymbolInfo } from "../machine/types";
import { buildPe, type PeFile } from "../pe/build";

/*
 * A small MSVC x64 console program (the debug-fixed profile): the program's own functions from a spec,
 * plus the C runtime startup, ucrtbase, user32 and ntdll stand-ins every specimen shares. Every
 * instruction that runs carries its semantics, and record() turns the listing into a recording.
 * The layout is fixed: app code from 140001000, printf at 140001110, strings from 140003200, globals
 * from 140005000.
 */

/**
 * Every DLL the program imports and the functions it takes from each, in IAT order. This is what a
 * real /MD build of a small console program imports. Only some of these run in the recordings.
 */
export const IMPORTS: { dll: string; funcs: string[] }[] = [
  {
    dll: "KERNEL32.dll",
    funcs: [
      "RtlCaptureContext", "RtlLookupFunctionEntry", "RtlVirtualUnwind", "UnhandledExceptionFilter",
      "SetUnhandledExceptionFilter", "GetCurrentProcess", "TerminateProcess", "IsProcessorFeaturePresent",
      "QueryPerformanceCounter", "GetCurrentProcessId", "GetCurrentThreadId", "GetSystemTimeAsFileTime",
      "InitializeSListHead", "IsDebuggerPresent", "GetModuleHandleW",
    ],
  },
  { dll: "USER32.dll", funcs: ["MessageBoxA"] },
  { dll: "VCRUNTIME140.dll", funcs: ["__current_exception", "__current_exception_context", "memset", "__C_specific_handler"] },
  { dll: "api-ms-win-crt-stdio-l1-1-0.dll", funcs: ["__acrt_iob_func", "puts", "fgets", "__stdio_common_vfprintf", "_set_fmode", "__p__commode"] },
  { dll: "api-ms-win-crt-string-l1-1-0.dll", funcs: ["strcspn", "strcmp"] },
  {
    dll: "api-ms-win-crt-runtime-l1-1-0.dll",
    funcs: [
      "_initterm", "_initterm_e", "_get_initial_narrow_environment", "__p___argv", "__p___argc", "exit", "_exit",
      "_cexit", "_c_exit", "_register_thread_local_exe_atexit_callback", "_configure_narrow_argv",
      "_initialize_narrow_environment", "_seh_filter_exe", "_set_app_type", "_crt_atexit",
      "_register_onexit_function", "_initialize_onexit_table", "terminate",
    ],
  },
  { dll: "api-ms-win-crt-math-l1-1-0.dll", funcs: ["__setusermatherr"] },
  { dll: "api-ms-win-crt-locale-l1-1-0.dll", funcs: ["_configthreadlocale"] },
  { dll: "api-ms-win-crt-heap-l1-1-0.dll", funcs: ["_set_new_mode"] },
];

/** The IAT starts .rdata. Each DLL's slots end with a zero slot. */
export const IAT_BASE = 0x140002000n;
const IAT_ALL: Record<string, bigint> = (() => {
  const out: Record<string, bigint> = {};
  let at = IAT_BASE;
  for (const { funcs } of IMPORTS) {
    for (const f of funcs) {
      out[f] = at;
      at += 8n;
    }
    at += 8n;
  }
  return out;
})();

const USED = ["MessageBoxA", "__acrt_iob_func", "puts", "fgets", "strcspn", "__stdio_common_vfprintf", "_initterm", "_get_initial_narrow_environment", "strcmp", "__p___argv", "__p___argc", "exit"] as const;
export type Import = (typeof USED)[number];
const IAT = Object.fromEntries(USED.map((n) => [n, IAT_ALL[n]!])) as Record<Import, bigint>;

/** Globals the C runtime itself owns. */
const CRT_DATA = {
  __security_cookie: 0x140005010n,
  __xc_a: 0x140002220n,
  __xc_z: 0x140002230n,
};

/** Where every specimen's strings start in .rdata. */
export const STRINGS_BASE = 0x140003200n;
/** Where every specimen's globals start in .data. */
export const DATA_BASE = 0x140005000n;

const FILE_TABLE = 0x7ffe1a3a6f30n;
const ARGC = 0x7ffe1a3a9c40n;
const ARGV = 0x7ffe1a3a9c48n;
const ARGV_ARRAY = 0x2a3f80n;
const ENV = 0x2a41f0n;
const RET_THREAD_INIT = 0x7ffe1c9a7344n;
const RET_USER_THREAD = 0x7ffe1e7c26b1n;
const ENTRY_RSP = 0x14ff08n;

export const q = (n: bigint) => hex(n, 0);
export const str = (m: Machine, a: bigint) => '"' + m.cstr(a).replace(/\n/g, "\\n") + '"';

export interface Build {
  /** With a PDB, x64dbg shows names like main. Without one, only addresses. */
  symbols: boolean;
}

/** Tools for writing a specimen's own rows, bound to its module name and symbols. */
export interface Helpers {
  exe: string;
  symbols: boolean;
  fn(name: string): (c: AsmContext) => string;
  dat(name: string): string;
  callImp(name: Import): AsmRow;
  call(label: string): AsmRow;
  leaStr(reg: "rcx" | "rdx" | "r8", prefix: string, a: bigint): AsmRow;
  strLea(reg: "rcx" | "rdx" | "r8", prefix: string, a: bigint, text: string): AsmRow;
  dataInfo(size: 4 | 8, name: string, reg: string): (m: Machine) => string[];
  /** A short jump to a label, such as jcc("jne", "75", "ne", "main.trim"). */
  jcc(mnemonic: string, opcode: string, cond: string, label: string): AsmRow;
  jmp(label: string): AsmRow;
}

export interface AppSpec {
  /** Module name without .exe, such as "vault". */
  exe: string;
  /** Strings in .rdata, by address. They must start at STRINGS_BASE and fit in 0x80 bytes. */
  strings: [bigint, string][];
  /** The program's globals in .data, by name. */
  data: Record<string, bigint>;
  /** Initial qword values in .data, such as a pointer to the secret string. */
  dataInit: [bigint, bigint][];
  /** Function and global names the PDB provides. */
  functions: string[];
  globals: string[];
  /** The program's own code, from 140001000 up to printf at 140001110. Must define "main". */
  rows(h: Helpers): AsmRow[];
  /** More code after the C runtime startup, from 140001230 on, for programs that don't fit below printf. */
  tail?(h: Helpers): AsmRow[];
  /** Constants in .rdata after the strings, such as MSVC's __real@3ff8000000000000 for 1.5. */
  consts?: { at: bigint; bytes: number[]; name: string }[];
  /** Functions that call nothing and touch no stack, so they get no .pdata entry. */
  leaves?: string[];
  /** Record XMM registers. */
  xmm?: boolean;
}

function appModule(spec: AppSpec, { symbols }: Build): { module: ProgramModule; labels: Record<string, bigint> } {
  const exe = spec.exe;
  const DATA: Record<string, bigint> = { ...spec.data, ...CRT_DATA };
  const fn = (name: string) => (c: AsmContext) => (symbols ? "<" + exe + "." + name + ">" : exe + "." + hex(c.L(name)));
  const dat = (name: string) => (symbols ? "<" + name + ">" : q(DATA[name]!));
  const imp = (name: Import) => "qword ptr ds:[<&" + name + ">]";
  const callImp = (name: Import): AsmRow => ({
    b: [6, (c) => "FF15 " + rel32(c.next, IAT[name])],
    m: "call",
    o: imp(name),
    run: (m) => m.callPtr(hex(IAT[name])),
  });
  const call = (label: string): AsmRow => ({
    b: [5, (c) => "E8 " + rel32(c.next, c.L(label))],
    m: "call",
    o: fn(label),
    run: (m) => m.call(labelsRef.current[label]!),
  });
  const leaStr = (reg: "rcx" | "rdx" | "r8", prefix: string, a: bigint): AsmRow => ({
    b: [7, (c) => prefix + " " + rel32(c.next, a)],
    m: "lea",
    o: reg + ",qword ptr ds:[" + q(a) + "]",
    run: (m) => m.set(reg, a),
    info: (m) => [q(a) + " " + str(m, a)],
  });
  const strLea = (reg: "rcx" | "rdx" | "r8", prefix: string, a: bigint, text: string): AsmRow => ({
    ...leaStr(reg, prefix, a),
    c: q(a) + ':"' + text + '"',
  });
  const dataInfo = (size: 4 | 8, name: string, reg: string) => (m: Machine) => {
    const v = m.ld(DATA[name]!, size);
    const shown = (size === 4 ? "dword" : "qword") + " ptr [" + (symbols ? "<" + exe + "." + name + "> " : "") + hex(DATA[name]!) + "]=" + q(v);
    const target = size === 8 ? " " + str(m, v) : "";
    return [shown + target, reg + "=" + q(m.get(reg))];
  };
  const labelsRef: { current: Record<string, bigint> } = { current: {} };

  const jcc = (mnemonic: string, opcode: string, cond: string, label: string): AsmRow => ({
    b: [2, (c) => opcode + " " + hex(c.L(label) - c.next, 2)],
    m: mnemonic,
    o: (c) => exe + "." + q(c.L(label)),
    run: (m) => m.jcc(cond as Parameters<Machine["cond"]>[0], hex(labelsRef.current[label]!)),
  });
  const jmp = (label: string): AsmRow => ({
    b: [2, (c) => "EB " + hex(c.L(label) - c.next, 2)],
    m: "jmp",
    o: (c) => exe + "." + q(c.L(label)),
    run: (m) => m.jmp(labelsRef.current[label]!),
  });
  const h: Helpers = { exe, symbols, fn, dat, callImp, call, leaStr, strLea, dataInfo, jcc, jmp };

  const rows: AsmRow[] = [
    ...spec.rows(h),

    { org: 0x140001110n, fill: true },
    // printf: an inline UCRT wrapper the compiler copied into the program
    { label: "printf", b: "48:894C24 08", m: "mov", o: "qword ptr ss:[rsp+8],rcx", run: (m) => m.st(m.sp(8), 8, "rcx") },
    { b: "48:895424 10", m: "mov", o: "qword ptr ss:[rsp+10],rdx", run: (m) => m.st(m.sp(0x10), 8, "rdx") },
    { b: "4C:894424 18", m: "mov", o: "qword ptr ss:[rsp+18],r8", run: (m) => m.st(m.sp(0x18), 8, "r8") },
    { b: "4C:894C24 20", m: "mov", o: "qword ptr ss:[rsp+20],r9", run: (m) => m.st(m.sp(0x20), 8, "r9") },
    { b: "48:83EC 38", m: "sub", o: "rsp,38", run: (m) => m.sub("rsp", 0x38) },
    { b: "48:8D4424 48", m: "lea", o: "rax,qword ptr ss:[rsp+48]", run: (m) => m.set("rax", m.sp(0x48)) },
    { b: "48:894424 28", m: "mov", o: "qword ptr ss:[rsp+28],rax", run: (m) => m.st(m.sp(0x28), 8, "rax") },
    { b: "B9 01000000", m: "mov", o: "ecx,1", run: (m) => m.set("ecx", 1) },
    callImp("__acrt_iob_func"),
    { b: "48:8B4C24 28", m: "mov", o: "rcx,qword ptr ss:[rsp+28]", run: (m) => m.set("rcx", m.ld(m.sp(0x28), 8)) },
    { b: "48:894C24 20", m: "mov", o: "qword ptr ss:[rsp+20],rcx", run: (m) => m.st(m.sp(0x20), 8, "rcx") },
    { b: "45:33C9", m: "xor", o: "r9d,r9d", run: (m) => m.xor("r9d", "r9d") },
    { b: "4C:8B4424 40", m: "mov", o: "r8,qword ptr ss:[rsp+40]", run: (m) => m.set("r8", m.ld(m.sp(0x40), 8)) },
    { b: "48:8BD0", m: "mov", o: "rdx,rax", run: (m) => m.set("rdx", m.get("rax")) },
    { b: "33C9", m: "xor", o: "ecx,ecx", run: (m) => m.xor("ecx", "ecx") },
    { label: "printf.vfprintf", ...callImp("__stdio_common_vfprintf") },
    { b: "48:83C4 38", m: "add", o: "rsp,38", run: (m) => m.add("rsp", 0x38) },
    { label: "printf.ret", b: "C3", m: "ret", run: (m) => m.ret() },

    { org: 0x140001170n, fill: true },
    // __security_init_cookie (the cookie is already random, so it returns early)
    {
      label: "__security_init_cookie", b: [7, (c) => "48:8B05 " + rel32(c.next, CRT_DATA.__security_cookie)], m: "mov",
      o: "rax,qword ptr ds:[" + dat("__security_cookie") + "]", run: (m) => m.set("rax", m.ld(CRT_DATA.__security_cookie, 8)),
    },
    { b: "48:B9 32A2DF2D992B0000", m: "mov", o: "rcx,2B992DDFA232", run: (m) => m.set("rcx", 0x2b992ddfa232n) },
    { b: "48:3BC1", m: "cmp", o: "rax,rcx", run: (m) => m.cmp("rax", "rcx") },
    jcc("jne", "75", "ne", "cookie.ret"),
    { b: "0F31", m: "rdtsc" },
    { b: "48:C1E2 20", m: "shl", o: "rdx,20" },
    { b: "48:0BC2", m: "or", o: "rax,rdx" },
    { b: [7, (c) => "48:8905 " + rel32(c.next, CRT_DATA.__security_cookie)], m: "mov", o: "qword ptr ds:[" + dat("__security_cookie") + "],rax" },
    { label: "cookie.ret", b: "C3", m: "ret", run: (m) => m.ret() },

    { org: 0x1400011a0n, fill: true },
    // __scrt_common_main_seh, shortened to the parts Lesson 1.5 uses
    { label: "__scrt_common_main_seh", b: "48:895C24 08", m: "mov", o: "qword ptr ss:[rsp+8],rbx", run: (m) => m.st(m.sp(8), 8, "rbx") },
    { b: "57", m: "push", o: "rdi", run: (m) => m.push("rdi") },
    { b: "48:83EC 30", m: "sub", o: "rsp,30", run: (m) => m.sub("rsp", 0x30) },
    { b: [7, (c) => "48:8D15 " + rel32(c.next, CRT_DATA.__xc_z)], m: "lea", o: "rdx,qword ptr ds:[" + dat("__xc_z") + "]", run: (m) => m.set("rdx", CRT_DATA.__xc_z) },
    { b: [7, (c) => "48:8D0D " + rel32(c.next, CRT_DATA.__xc_a)], m: "lea", o: "rcx,qword ptr ds:[" + dat("__xc_a") + "]", run: (m) => m.set("rcx", CRT_DATA.__xc_a) },
    callImp("_initterm"),
    callImp("_get_initial_narrow_environment"),
    { b: "48:8BF8", m: "mov", o: "rdi,rax", run: (m) => m.set("rdi", m.get("rax")) },
    callImp("__p___argv"),
    { b: "48:8B18", m: "mov", o: "rbx,qword ptr ds:[rax]", run: (m) => m.set("rbx", m.ld(m.get("rax"), 8)) },
    { label: "scrt.argc", ...callImp("__p___argc") },
    { b: "4C:8BC7", m: "mov", o: "r8,rdi", run: (m) => m.set("r8", m.get("rdi")) },
    { b: "48:8BD3", m: "mov", o: "rdx,rbx", run: (m) => m.set("rdx", m.get("rbx")) },
    { b: "8B08", m: "mov", o: "ecx,dword ptr ds:[rax]", run: (m) => m.set("ecx", m.ld(m.get("rax"), 4)) },
    { label: "scrt.callmain", ...call("main") },
    { label: "scrt.aftermain", b: "8BD8", m: "mov", o: "ebx,eax", run: (m) => m.set("ebx", m.get("eax")) },
    { b: "8BCB", m: "mov", o: "ecx,ebx", run: (m) => m.set("ecx", m.get("ebx")) },
    { label: "scrt.exit", ...callImp("exit") },

    { org: 0x140001200n, fill: true },
    // mainCRTStartup, the entry point
    { label: "mainCRTStartup", b: "48:83EC 28", m: "sub", o: "rsp,28", run: (m) => m.sub("rsp", 0x28) },
    call("__security_init_cookie"),
    { b: "48:83C4 28", m: "add", o: "rsp,28", run: (m) => m.add("rsp", 0x28) },
    {
      label: "entry.jmp", b: [5, (c) => "E9 " + rel32(c.next, c.L("__scrt_common_main_seh"))], m: "jmp", o: fn("__scrt_common_main_seh"),
      run: (m) => m.jmp(labelsRef.current.__scrt_common_main_seh!),
    },
    { org: 0x14000121fn, fill: true },
    { b: "CC", m: "int3" },
    ...(spec.tail ? [{ org: 0x140001230n, fill: true } as AsmRow, ...spec.tail(h)] : []),
  ];

  const { rows: out, labels } = assemble(rows);
  labelsRef.current = labels;
  return { module: { name: exe + ".exe", base: 0x140000000n, size: 0x7000, rows: out }, labels };
}

/* ------------------------------------------------------------------ */
/* Library stand-ins                                                   */
/* ------------------------------------------------------------------ */

const LIB = {
  puts: 0x7ffe1a2f4a10n,
  fgets: 0x7ffe1a2f3c80n,
  strcspn: 0x7ffe1a30b120n,
  __stdio_common_vfprintf: 0x7ffe1a2f1d50n,
  __acrt_iob_func: 0x7ffe1a2c8e30n,
  strcmp: 0x7ffe1a30af40n,
  _initterm: 0x7ffe1a2d1b70n,
  _get_initial_narrow_environment: 0x7ffe1a2d2a10n,
  __p___argc: 0x7ffe1a2d2a80n,
  __p___argv: 0x7ffe1a2d2a90n,
  exit: 0x7ffe1a2d5f60n,
  MessageBoxA: 0x7ffe1c3d8f10n,
} as const satisfies Record<Import, bigint>;

/** printf's formatting, for %d, %lld, %s, and %f. Each argument takes one 8-byte va_list slot. */
function format(m: Machine, fmt: string, va: bigint): string {
  let at = va;
  const next = () => {
    const v = m.ld(at, 8);
    at += 8n;
    return v;
  };
  return fmt.replace(/%(lld|d|s|f)/g, (_, k: string) => {
    const v = next();
    if (k === "d") return String(BigInt.asIntN(32, v));
    if (k === "lld") return String(BigInt.asIntN(64, v));
    if (k === "s") return m.cstr(v);
    return bitsF64(v).toFixed(6);
  });
}

/** A short function body: reserve stack, do the work, restore, return. */
function body(name: Import, work: AsmRow[], frame = 0x28): AsmRow[] {
  const f = hex(frame, 2);
  return [
    { org: LIB[name] },
    { label: name, b: "48:83EC " + f, m: "sub", o: "rsp," + q(BigInt(frame)), run: (m) => m.sub("rsp", frame) },
    ...work,
    { b: "48:83C4 " + f, m: "add", o: "rsp," + q(BigInt(frame)), run: (m) => m.add("rsp", frame) },
    { label: name + ".ret", b: "C3", m: "ret", run: (m) => m.ret() },
  ];
}

function ucrtModule(): ProgramModule {
  const { rows } = assemble([
    ...body("puts", [
      { b: "48:8BC1", m: "mov", o: "rax,rcx", run: (m) => { m.print(m.cstr(m.get("rcx")) + "\n"); m.clobber(1); } },
      { b: "33C0", m: "xor", o: "eax,eax", run: (m) => m.xor("eax", "eax") },
    ]),
    ...body("fgets", [
      {
        b: "48:8BD9", m: "mov", o: "rbx,rcx",
        run: (m) => {
          const buf = m.get("rcx");
          const line = m.stdin;
          m.stBytes(buf, [...line].map((c) => c.charCodeAt(0)).concat([0x0a, 0]));
          m.print(line + "\n");
          m.clobber(2);
          m.set("rax", buf);
        },
      },
    ]),
    ...body("strcspn", [
      {
        b: "48:8BC1", m: "mov", o: "rax,rcx",
        run: (m) => {
          const s = m.cstr(m.get("rcx"));
          const reject = m.cstr(m.get("rdx"));
          const i = [...s].findIndex((c) => reject.includes(c));
          m.clobber(3);
          m.set("rax", i < 0 ? s.length : i);
        },
      },
    ]),
    ...body("__stdio_common_vfprintf", [
      {
        b: "49:8BC0", m: "mov", o: "rax,r8",
        run: (m) => {
          // The va_list is the fifth argument: past the return address and this body's 48h frame.
          const s = format(m, m.cstr(m.get("r8")), m.ld(m.sp(0x48 + 8 + 0x20), 8));
          m.print(s);
          m.clobber(4);
          m.set("eax", s.length);
        },
      },
    ], 0x48),
    ...body("__acrt_iob_func", [
      { b: "48:6BC1 58", m: "imul", o: "rax,rcx,58", run: (m) => m.set("rax", FILE_TABLE + m.get("ecx") * 0x58n) },
    ]),
    ...body("strcmp", [
      {
        b: "48:2BD1", m: "sub", o: "rdx,rcx",
        run: (m) => {
          const a = m.cstr(m.get("rcx"));
          const b = m.cstr(m.get("rdx"));
          m.clobber(5);
          m.set("eax", a === b ? 0 : a < b ? -1 : 1);
        },
      },
    ]),
    ...body("_initterm", [{ b: "48:3BCA", m: "cmp", o: "rcx,rdx", run: (m) => m.cmp("rcx", "rdx") }]),
    ...body("_get_initial_narrow_environment", [{ b: [7, () => "48:8B05 18E21100"], m: "mov", o: "rax,qword ptr ds:[7FFE1A3AFC40]", run: (m) => m.set("rax", ENV) }]),
    ...body("__p___argc", [{ b: [7, () => "48:8D05 B9711000"], m: "lea", o: "rax,qword ptr ds:[" + q(ARGC) + "]", run: (m) => m.set("rax", ARGC) }]),
    ...body("__p___argv", [{ b: [7, () => "48:8D05 B1711000"], m: "lea", o: "rax,qword ptr ds:[" + q(ARGV) + "]", run: (m) => m.set("rax", ARGV) }]),
    { org: LIB.exit },
    { label: "exit", b: "48:83EC 28", m: "sub", o: "rsp,28", run: (m) => m.sub("rsp", 0x28) },
    { b: "8BD9", m: "mov", o: "ebx,ecx", run: (m) => m.exit(Number(m.get("ecx"))) },
    { b: "CC", m: "int3" },
  ]);
  return { name: "ucrtbase.dll", base: 0x7ffe1a2a0000n, size: 0x110000, rows };
}

function user32Module(): ProgramModule {
  const { rows } = assemble([
    { org: LIB.MessageBoxA },
    { label: "MessageBoxA", b: "48:83EC 38", m: "sub", o: "rsp,38", run: (m) => m.sub("rsp", 0x38) },
    { b: "45:33DB", m: "xor", o: "r11d,r11d", run: (m) => m.xor("r11d", "r11d") },
    {
      b: "44:395C24 28", m: "cmp", o: "dword ptr ss:[rsp+28],r11d",
      run: (m) => {
        m.dialog = { title: m.cstr(m.get("r8")), text: m.cstr(m.get("rdx")) };
        m.cmp(m.ld(m.sp(0x28), 4), 0n, 32);
      },
    },
    {
      b: "B8 01000000", m: "mov", o: "eax,1",
      run: (m) => {
        m.dialog = undefined;
        m.clobber(6);
        m.set("eax", 1);
      },
    },
    { b: "48:83C4 38", m: "add", o: "rsp,38", run: (m) => m.add("rsp", 0x38) },
    { b: "C3", m: "ret", run: (m) => m.ret() },
  ]);
  return { name: "user32.dll", base: 0x7ffe1c3b0000n, size: 0xa0000, rows };
}

function ntdllModule(exe: string, entry: () => bigint): ProgramModule {
  const { rows } = assemble([
    { org: 0x7ffe1e8a0b47n },
    { label: "LdrpDoDebuggerBreak", b: "48:83EC 38", m: "sub", o: "rsp,38" },
    { b: "65:48:8B0425 30000000", m: "mov", o: "rax,qword ptr gs:[30]" },
    { b: "CC", m: "int3" },
    { label: "system.after", b: "EB 00", m: "jmp", o: "ntdll.7FFE1E8A0B57", run: (m) => m.jmp(0x7ffe1e8a0b57n) },
    { b: "48:83C4 38", m: "add", o: "rsp,38", run: (m) => m.add("rsp", 0x38) },
    {
      b: "C3", m: "ret",
      // Returning here hands control back to the Windows loader, which runs until the entry point.
      run: (m) => {
        m.set("rsp", ENTRY_RSP);
        m.st(ENTRY_RSP, 8, RET_THREAD_INIT);
        m.set("rax", 0x7ffe1c9a7330n);
        m.set("rbx", 0);
        m.set("rcx", 0x2d7000n);
        m.set("rdx", entry());
        m.set("rsi", 0);
        m.set("rdi", 0);
        m.set("r8", 0x2d7000n);
        m.set("r9", entry());
        m.set("r10", 0);
        m.set("r11", 0);
        m.cmp(0, 0);
        m.jmp(entry());
        m.depth = 0;
        m.event = "INT3 breakpoint \"entry breakpoint\" at <" + exe + ".EntryPoint> (" + hex(entry()) + ")!";
      },
    },
  ]);
  return { name: "ntdll.dll", base: 0x7ffe1e790000n, size: 0x200000, rows };
}

/* ------------------------------------------------------------------ */
/* Memory and symbols                                                  */
/* ------------------------------------------------------------------ */

function qwords(base: bigint, size: number, values: [bigint, bigint][]): string {
  const bytes = new Array<number>(size).fill(0);
  for (const [addr, v] of values) {
    for (let i = 0; i < 8; i++) bytes[Number(addr - base) + i] = Number((v >> BigInt(i * 8)) & 0xffn);
  }
  return bytes.map((b) => hex(b, 2)).join(" ");
}

/** Where the loader points each IAT slot. Functions the recordings never run get plausible addresses in their DLL. */
const DLL_BASE: Record<string, bigint> = {
  "KERNEL32.dll": 0x7ffe1c9a1000n,
  "USER32.dll": 0x7ffe1c3b1000n,
  "VCRUNTIME140.dll": 0x7ffe0f2c1000n,
};
export function loadedAddress(name: string): bigint {
  if (name in LIB) return LIB[name as Import];
  const dll = IMPORTS.find((d) => d.funcs.includes(name))!;
  const i = dll.funcs.indexOf(name);
  return (DLL_BASE[dll.dll] ?? 0x7ffe1a2b0000n) + BigInt(i) * 0x1a40n + BigInt((name.length * 0x37) & 0x3f0);
}


function stringsRegion(spec: AppSpec): string {
  const bytes = new Array<number>(0x80).fill(0);
  for (const [a, s] of spec.strings) [...s].forEach((ch, i) => (bytes[Number(a - STRINGS_BASE) + i] = ch.charCodeAt(0)));
  for (const c of spec.consts ?? []) c.bytes.forEach((b, i) => (bytes[Number(c.at - STRINGS_BASE) + i] = b));
  return bytes.map((b) => hex(b, 2)).join(" ");
}

function memoryFor(spec: AppSpec): MemoryRegion[] {
  return [
    { base: hex(IAT_BASE), size: 0x240, section: ".rdata", bytes: qwords(IAT_BASE, 0x240, Object.entries(IAT_ALL).map(([n, a]) => [a, loadedAddress(n)])) },
    { base: hex(STRINGS_BASE), size: 0x100, section: ".rdata", bytes: stringsRegion(spec) },
    {
      base: hex(DATA_BASE), size: 0x200, section: ".data",
      bytes: qwords(DATA_BASE, 0x48, [...spec.dataInit, [CRT_DATA.__security_cookie, 0x2b992ddfa233n]]),
    },
    { base: hex(0x14d000n), size: 0x3000, section: "stack" },
    { base: hex(ARGV_ARRAY), size: 0x300, section: "heap", bytes: qwords(ARGV_ARRAY, 0x20, [[ARGV_ARRAY, 0x2a3fa0n]]) + " " + bytesOf("C:\\pire\\" + spec.exe + ".exe") },
    { base: hex(ARGC), size: 0x10, section: ".data", bytes: qwords(ARGC, 0x10, [[ARGC, 1n], [ARGV, ARGV_ARRAY]]) },
    { base: hex(FILE_TABLE), size: 0x108, section: ".data" },
  ];
}

const CRT_FUNCTIONS = ["printf", "__security_init_cookie", "__scrt_common_main_seh", "mainCRTStartup"];

function symbolTable(spec: AppSpec, labels: Record<string, bigint>, build: Build): SymbolInfo[] {
  const module = spec.exe + ".exe";
  const own: SymbolInfo[] = build.symbols
    ? [
        ...[...spec.functions, ...CRT_FUNCTIONS].map((name): SymbolInfo => ({ name, address: hex(labels[name]!), module, kind: "function" })),
        ...spec.globals.map((name): SymbolInfo => ({ name, address: hex(spec.data[name]!), module, kind: "data" })),
        ...(spec.consts ?? []).map((c): SymbolInfo => ({ name: c.name, address: hex(c.at), module, kind: "data" })),
        { name: "__security_cookie", address: hex(CRT_DATA.__security_cookie), module, kind: "data" },
      ]
    : [];
  const entry: SymbolInfo = { name: "EntryPoint", address: hex(labels.mainCRTStartup!), module, kind: "function" };
  const exports: SymbolInfo[] = Object.entries(LIB).map(([name, a]) => ({
    name,
    address: hex(a),
    module: name === "MessageBoxA" ? "user32.dll" : "ucrtbase.dll",
    kind: "export",
  }));
  return [
    ...own,
    entry,
    ...exports,
    { name: "MessageBoxW", address: hex(0x7ffe1c3d9b20n), module: "user32.dll", kind: "export" },
    { name: "BaseThreadInitThunk", address: hex(0x7ffe1c9a7330n), module: "kernel32.dll", kind: "export" },
    { name: "RtlUserThreadStart", address: hex(0x7ffe1e7c2690n), module: "ntdll.dll", kind: "export" },
    { name: "LdrpDoDebuggerBreak", address: hex(0x7ffe1e8a0b47n), module: "ntdll.dll", kind: "export" },
  ];
}

/* ------------------------------------------------------------------ */
/* Recordings                                                          */
/* ------------------------------------------------------------------ */

export function buildProgram(spec: AppSpec, build: Build): Program & { labels: Record<string, bigint> } {
  const { module: app, labels } = appModule(spec, build);
  return {
    labels,
    ...(spec.xmm ? { xmm: true } : {}),
    modules: [
      app,
      ucrtModule(),
      user32Module(),
      { name: "kernel32.dll", base: 0x7ffe1c990000n, size: 0xc0000, rows: [] },
      ntdllModule(spec.exe, () => labels.mainCRTStartup!),
    ],
    symbols: symbolTable(spec, labels, build),
    memory: memoryFor(spec),
    start(m) {
      m.set("rsp", 0x14f6a0n);
      m.st(0x14ff38n, 8, RET_USER_THREAD);
      m.writes = [];
      m.set("rax", 0);
      m.set("rcx", 0x7ffe1e7f2a1an);
      m.set("rdx", 0);
      m.set("rbx", 0x2d7000n);
      m.set("r8", 0x14f698n);
      m.set("r9", 0);
      m.set("r11", 0x246);
      m.rip = big("7FFE1E8A0B55");
      m.depth = 0;
      return { event: "System breakpoint reached!" };
    },
  };
}

export interface SpecimenRecordings {
  wrong: Recording;
  right: Recording;
  strippedWrong: Recording;
  strippedRight: Recording;
  /** Code addresses lessons point at, such as "main" or "main.check". */
  at: Record<string, string>;
}

/** Records the four runs every specimen offers: with and without a PDB, with the wrong and the right input. */
export function recordSpecimen(spec: AppSpec, input: { wrong: string; right: string }): SpecimenRecordings {
  const named = buildProgram(spec, { symbols: true });
  const stripped = buildProgram(spec, { symbols: false });
  const exe = spec.exe + ".exe";
  const process = { name: exe, pid: "2F18", tid: "1C4C" };
  const extras = loaderView(spec, named.labels.mainCRTStartup!);
  const run = (program: Program, id: string, label: string, stdin: string): Recording => ({
    ...record(program, { id, label: label + ", input " + stdin, stdin, process }),
    ...extras,
  });
  return {
    wrong: run(named, spec.exe + ".wrong", exe, input.wrong),
    right: run(named, spec.exe + ".right", exe, input.right),
    strippedWrong: run(stripped, spec.exe + "-stripped.wrong", exe + " without PDB", input.wrong),
    strippedRight: run(stripped, spec.exe + "-stripped.right", exe + " without PDB", input.right),
    at: Object.fromEntries(Object.entries(named.labels).map(([k, v]) => [k, hex(v)])),
  };
}

export interface ProgramRecordings {
  named: Recording;
  stripped: Recording;
  at: Record<string, string>;
}

/** Records a program that reads no input: one run with the PDB and one without. */
export function recordProgram(spec: AppSpec): ProgramRecordings {
  const named = buildProgram(spec, { symbols: true });
  const stripped = buildProgram(spec, { symbols: false });
  const exe = spec.exe + ".exe";
  const process = { name: exe, pid: "3A44", tid: "2B10" };
  const extras = loaderView(spec, named.labels.mainCRTStartup!);
  return {
    named: { ...record(named, { id: spec.exe, label: exe, stdin: "", process }), ...extras },
    stripped: { ...record(stripped, { id: spec.exe + "-stripped", label: exe + " without PDB", stdin: "", process }), ...extras },
    at: Object.fromEntries(Object.entries(named.labels).map(([k, v]) => [k, hex(v)])),
  };
}

/* ------------------------------------------------------------------ */
/* The file on disk                                                    */
/* ------------------------------------------------------------------ */

const IMAGE_BASE = 0x140000000n;
const DEFAULT_COOKIE = 0x2b992ddfa232n;
const UNWIND_AT = 0x3300;

/**
 * The specimen as a PE file: the same code bytes the recordings show, the IAT and import tables, the
 * strings, the initial globals, and exception tables. The ASLR build sets DYNAMIC_BASE and adds .reloc
 * entries for the pointers stored in .data.
 */
const peCache = new Map<string, PeFile>();
export function peFileFor(spec: AppSpec, opts: { aslr: boolean }): PeFile {
  const key = spec.exe + (opts.aslr ? "-aslr" : "");
  const hit = peCache.get(key);
  if (hit) return hit;
  const pe = buildPeFile(spec, opts);
  peCache.set(key, pe);
  return pe;
}

function buildPeFile(spec: AppSpec, opts: { aslr: boolean }): PeFile {
  const program = buildProgram(spec, { symbols: false });
  const app = program.modules[0]!;
  const rva = (a: bigint) => Number(a - IMAGE_BASE);
  const parse = (b: string) => b.replace(/[: ]/g, "").match(/../g)!.map((x) => Number.parseInt(x, 16));

  const text: number[] = [];
  for (const row of app.rows) {
    const off = rva(big(row.address)) - 0x1000;
    parse(row.bytes).forEach((b, i) => (text[off + i] = b));
  }
  for (let i = 0; i < text.length; i++) text[i] ??= 0xcc;

  const rdata: number[] = new Array(0x1400).fill(0);
  for (const [a, s] of spec.strings) [...s].forEach((ch, i) => (rdata[rva(a) - 0x2000 + i] = ch.charCodeAt(0)));
  for (const c of spec.consts ?? []) c.bytes.forEach((b, i) => (rdata[rva(c.at) - 0x2000 + i] = b));

  // One RUNTIME_FUNCTION per non-leaf function, each pointing at a small UNWIND_INFO in .rdata.
  const starts = [...spec.functions, "printf", "__scrt_common_main_seh", "mainCRTStartup"]
    .filter((n) => !spec.leaves?.includes(n))
    .map((n) => program.labels[n]!)
    .sort((a, b) => (a < b ? -1 : 1));
  const pdata: number[] = [];
  const le = (out: number[], off: number, v: number) => [0, 1, 2, 3].forEach((i) => (out[off + i] = (v >>> (8 * i)) & 0xff));
  starts.forEach((start, i) => {
    const next = starts[i + 1] ?? 0x140002000n;
    const end = app.rows.find((r) => big(r.address) > start && (big(r.address) >= next || r.mnemonic === "int3"))?.address;
    const unwind = UNWIND_AT + i * 8;
    [0x01, 0x04, 0x01, 0x00, 0x04, 0x42, 0x00, 0x00].forEach((b, k) => (rdata[unwind - 0x2000 + k] = b));
    le(pdata, i * 12, rva(start));
    le(pdata, i * 12 + 4, rva(end ? big(end) : next));
    le(pdata, i * 12 + 8, unwind);
  });

  const data: number[] = new Array(0x48).fill(0);
  const qw = (a: bigint, v: bigint) => {
    for (let i = 0; i < 8; i++) data[rva(a) - 0x5000 + i] = Number((v >> BigInt(i * 8)) & 0xffn);
  };
  for (const [a, v] of spec.dataInit) qw(a, v);
  qw(CRT_DATA.__security_cookie, DEFAULT_COOKIE);

  const name = spec.exe + (opts.aslr ? "-aslr" : "") + ".exe";
  return buildPe({
    id: spec.exe + (opts.aslr ? "-aslr" : ""),
    name,
    bits: 64,
    imageBase: IMAGE_BASE,
    entry: rva(program.labels.mainCRTStartup!),
    subsystem: 3,
    dllChars: opts.aslr ? 0x8160 : 0x8120,
    timestamp: 0x66f1a2b3,
    sections: [
      { name: ".text", va: 0x1000, bytes: text, chars: 0x60000020 },
      { name: ".rdata", va: 0x2000, bytes: rdata, chars: 0x40000040 },
      { name: ".data", va: 0x5000, bytes: data, vsize: 0x640, chars: 0xc0000040 },
      { name: ".pdata", va: 0x6000, bytes: pdata, chars: 0x40000040 },
    ],
    imports: IMPORTS,
    importAt: { iat: rva(IAT_BASE), dir: 0x4000 },
    ...(opts.aslr ? { relocs: spec.dataInit.map(([a]) => rva(a)) } : {}),
  });
}

/** What x64dbg shows about loading: the Log tab up to the system breakpoint, the Memory Map, and the frames below the entry point. */
function loaderView(spec: AppSpec, entry: bigint): Pick<Recording, "log" | "memoryMap" | "baseFrames"> {
  const exe = spec.exe + ".exe";
  const dlls: [bigint, string][] = [
    [0x7ffe1e790000n, "ntdll.dll"],
    [0x7ffe1c990000n, "kernel32.dll"],
    [0x7ffe1b6d0000n, "KernelBase.dll"],
    [0x7ffe1c3b0000n, "user32.dll"],
    [0x7ffe1bb40000n, "win32u.dll"],
    [0x7ffe1c8e0000n, "gdi32.dll"],
    [0x7ffe1b9f0000n, "gdi32full.dll"],
    [0x7ffe1ba80000n, "msvcp_win.dll"],
    [0x7ffe1a2a0000n, "ucrtbase.dll"],
    [0x7ffe0f2c0000n, "vcruntime140.dll"],
  ];
  const log = [
    "Process Started: " + hex(0x140000000n) + " C:\\pire\\" + exe,
    '  "C:\\pire\\' + exe + '"',
    "  argv[0]: C:\\pire\\" + exe,
    "Breakpoint at " + hex(entry) + " (entry breakpoint) set!",
    ...dlls.map(([base, name]) => "DLL Loaded: " + hex(base) + " C:\\Windows\\System32\\" + name),
    "Thread 1C4C created, Entry: ntdll.RtlUserThreadStart",
    "System breakpoint reached!",
  ];
  const row = (address: bigint, size: number, info: string, content: string, type: "IMG" | "PRV" | "MAP", protection: string) => ({
    address: hex(address), size: hex(BigInt(size)), info, content, type, protection,
  });
  const memoryMap = [
    row(0x14d000n, 0x3000, "Thread 1C4C Stack", "", "PRV", "-RW-G"),
    row(0x2a0000n, 0x10000, "Heap (ID 0)", "", "PRV", "-RW--"),
    row(0x2d7000n, 0x1000, "PEB", "", "PRV", "-RW--"),
    row(0x140000000n, 0x1000, exe, "", "IMG", "-R---"),
    row(0x140001000n, 0x1000, "\".text\"", "Executable code", "IMG", "ER---"),
    row(0x140002000n, 0x3000, "\".rdata\"", "Read-only initialized data", "IMG", "-R---"),
    row(0x140005000n, 0x1000, "\".data\"", "Initialized data", "IMG", "-RW--"),
    row(0x140006000n, 0x1000, "\".pdata\"", "Exception information", "IMG", "-R---"),
    ...dlls.slice(0).sort((a, b) => (a[0] < b[0] ? -1 : 1)).flatMap(([base, name]) => [
      row(base, 0x1000, name, "", "IMG" as const, "-R---"),
      row(base + 0x1000n, 0x7f000, "\".text\"", "Executable code", "IMG" as const, "ER---"),
      row(base + 0x80000n, 0x20000, "\".rdata\"", "Read-only initialized data", "IMG" as const, "-R---"),
    ]),
    row(0x7ffe1a3a0000n, 0x10000, "ucrtbase.dll \".data\"", "Initialized data", "IMG", "-RW--"),
    row(0x7ffe0000n, 0x1000, "KUSER_SHARED_DATA", "", "PRV", "-R---"),
  ].sort((a, b) => (BigInt("0x" + a.address) < BigInt("0x" + b.address) ? -1 : 1));
  return {
    log,
    memoryMap,
    baseFrames: [
      { slot: hex(ENTRY_RSP), to: hex(RET_THREAD_INIT), from: hex(entry) },
      { slot: hex(0x14ff38n), to: hex(RET_USER_THREAD), from: hex(0x7ffe1c9a7330n) },
    ],
  };
}
