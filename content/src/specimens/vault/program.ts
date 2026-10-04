import { assemble, big, bytesOf, hex, record, rel32, type AsmContext, type AsmRow, type Machine, type Program, type ProgramModule } from "../../machine/machine";
import type { MemoryRegion, Recording, SymbolInfo } from "../../machine/types";

/*
 * vault.exe, as MSVC builds it (x64, /O1-ish, the debug-fixed profile). Every instruction that runs
 * carries its semantics, and record() turns the listing into a recording. Addresses match the
 * lesson docs: check_code at 140001000, main at 140001070, strings at 140003200.
 */

const IAT = {
  MessageBoxA: 0x140002000n,
  __acrt_iob_func: 0x1400021c8n,
  puts: 0x1400021d0n,
  fgets: 0x1400021d8n,
  strcspn: 0x1400021e0n,
  __stdio_common_vfprintf: 0x1400021e8n,
  _initterm: 0x1400021f0n,
  _get_initial_narrow_environment: 0x1400021f8n,
  strcmp: 0x140002200n,
  __p___argv: 0x140002208n,
  __p___argc: 0x140002210n,
  exit: 0x140002218n,
} as const;
type Import = keyof typeof IAT;

const DATA = {
  SECRET: 0x140005000n,
  __security_cookie: 0x140005010n,
  g_attempts: 0x140005040n,
  __xc_a: 0x140002220n,
  __xc_z: 0x140002230n,
};

const STR = {
  banner: 0x140003200n,
  prompt: 0x140003214n,
  newline: 0x140003224n,
  title: 0x140003228n,
  opened: 0x140003230n,
  denied: 0x140003240n,
  secret: 0x140003250n,
};

const FILE_TABLE = 0x7ffe1a3a6f30n;
const ARGC = 0x7ffe1a3a9c40n;
const ARGV = 0x7ffe1a3a9c48n;
const ARGV_ARRAY = 0x2a3f80n;
const ENV = 0x2a41f0n;
const RET_THREAD_INIT = 0x7ffe1c9a7344n;
const RET_USER_THREAD = 0x7ffe1e7c26b1n;
const ENTRY_RSP = 0x14ff08n;

const q = (n: bigint) => hex(n, 0);
const str = (m: Machine, a: bigint) => '"' + m.cstr(a).replace(/\n/g, "\\n") + '"';

export interface VaultBuild {
  /** With a PDB, x64dbg shows names like main. Without one, only addresses. */
  symbols: boolean;
}

function vaultModule({ symbols }: VaultBuild): { module: ProgramModule; labels: Record<string, bigint> } {
  const fn = (name: string) => (c: AsmContext) => (symbols ? "<vault." + name + ">" : "vault." + hex(c.L(name)));
  const dat = (name: keyof typeof DATA) => (symbols ? "<" + name + ">" : q(DATA[name]));
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
  const dataInfo = (size: 4 | 8, name: keyof typeof DATA, reg: string) => (m: Machine) => {
    const v = m.ld(DATA[name], size);
    const shown = (size === 4 ? "dword" : "qword") + " ptr [" + (symbols ? "<vault." + name + "> " : "") + hex(DATA[name]) + "]=" + q(v);
    const target = size === 8 ? " " + str(m, v) : "";
    return [shown + target, reg + "=" + q(m.get(reg))];
  };
  const labelsRef: { current: Record<string, bigint> } = { current: {} };

  const rows: AsmRow[] = [
    { org: 0x140001000n },
    // int check_code(const char *input)
    { label: "check_code", b: "48:894C24 08", m: "mov", o: "qword ptr ss:[rsp+8],rcx", run: (m) => m.st(m.sp(8), 8, "rcx") },
    { b: "48:83EC 28", m: "sub", o: "rsp,28", run: (m) => m.sub("rsp", 0x28) },
    {
      b: [6, (c) => "8B05 " + rel32(c.next, DATA.g_attempts)], m: "mov", o: "eax,dword ptr ds:[" + dat("g_attempts") + "]",
      run: (m) => m.set("eax", m.ld(DATA.g_attempts, 4)), info: dataInfo(4, "g_attempts", "eax"),
    },
    { b: "FFC0", m: "inc", o: "eax", run: (m) => m.inc("eax") },
    {
      label: "check_code.store", b: [6, (c) => "8905 " + rel32(c.next, DATA.g_attempts)], m: "mov", o: "dword ptr ds:[" + dat("g_attempts") + "],eax",
      run: (m) => m.st(DATA.g_attempts, 4, "eax"), info: dataInfo(4, "g_attempts", "eax"),
    },
    {
      label: "check_code.secret", b: [7, (c) => "48:8B15 " + rel32(c.next, DATA.SECRET)], m: "mov", o: "rdx,qword ptr ds:[" + dat("SECRET") + "]",
      run: (m) => m.set("rdx", m.ld(DATA.SECRET, 8)), info: dataInfo(8, "SECRET", "rdx"),
    },
    {
      b: "48:8B4C24 30", m: "mov", o: "rcx,qword ptr ss:[rsp+30]", run: (m) => m.set("rcx", m.ld(m.sp(0x30), 8)),
      info: (m) => { const v = m.ld(m.sp(0x30), 8); return ["qword ptr [rsp+30]=" + q(v) + " " + str(m, v), "rcx=" + q(m.get("rcx"))]; },
    },
    { label: "check_code.strcmp", ...callImp("strcmp") },
    { b: "85C0", m: "test", o: "eax,eax", run: (m) => m.test("eax", "eax", 32) },
    { b: "0F94C0", m: "sete", o: "al", run: (m) => m.set("al", m.cond("e") ? 1 : 0) },
    { b: "0FB6C0", m: "movzx", o: "eax,al", run: (m) => m.set("eax", m.get("al")) },
    { b: "48:83C4 28", m: "add", o: "rsp,28", run: (m) => m.add("rsp", 0x28) },
    { label: "check_code.ret", b: "C3", m: "ret", run: (m) => m.ret() },

    { org: 0x140001070n, fill: true },
    // int main(void)
    { label: "main", b: "48:83EC 58", m: "sub", o: "rsp,58", run: (m) => m.sub("rsp", 0x58) },
    { label: "main.banner", ...strLea("rcx", "48:8D0D", STR.banner, "== PIRE VAULT ==") },
    { label: "main.puts", ...callImp("puts") },
    { label: "main.prompt", ...strLea("rcx", "48:8D0D", STR.prompt, "Enter code: ") },
    { label: "main.printf", ...call("printf") },
    { b: "33C9", m: "xor", o: "ecx,ecx", run: (m) => m.xor("ecx", "ecx") },
    callImp("__acrt_iob_func"),
    { b: "4C:8BC0", m: "mov", o: "r8,rax", run: (m) => m.set("r8", m.get("rax")) },
    { b: "BA 20000000", m: "mov", o: "edx,20", c: "20:' '", run: (m) => m.set("edx", 0x20) },
    { b: "48:8D4C24 20", m: "lea", o: "rcx,qword ptr ss:[rsp+20]", run: (m) => m.set("rcx", m.sp(0x20)) },
    { label: "main.fgets", ...callImp("fgets") },
    { b: "48:85C0", m: "test", o: "rax,rax", run: (m) => m.test("rax", "rax") },
    { b: [2, (c) => "75 " + hex(c.L("main.trim") - c.next, 2)], m: "jne", o: (c) => "vault." + q(c.L("main.trim")), run: (m) => m.jcc("ne", hex(labelsRef.current["main.trim"]!)) },
    { b: "B8 01000000", m: "mov", o: "eax,1", run: (m) => m.set("eax", 1) },
    { b: [2, (c) => "EB " + hex(c.L("main.end") - c.next, 2)], m: "jmp", o: (c) => "vault." + q(c.L("main.end")), run: (m) => m.jmp(labelsRef.current["main.end"]!) },
    { label: "main.trim", ...strLea("rdx", "48:8D15", STR.newline, "\\n") },
    { b: "48:8D4C24 20", m: "lea", o: "rcx,qword ptr ss:[rsp+20]", run: (m) => m.set("rcx", m.sp(0x20)) },
    callImp("strcspn"),
    { b: "C64404 20 00", m: "mov", o: "byte ptr ss:[rsp+rax+20],0", run: (m) => m.st(m.sp(0x20) + m.get("rax"), 1, 0) },
    { b: "48:8D4C24 20", m: "lea", o: "rcx,qword ptr ss:[rsp+20]", run: (m) => m.set("rcx", m.sp(0x20)), info: (m) => ["rcx=" + q(m.sp(0x20)) + " " + str(m, m.sp(0x20))] },
    { label: "main.check", ...call("check_code") },
    { label: "main.test", b: "85C0", m: "test", o: "eax,eax", run: (m) => m.test("eax", "eax", 32) },
    { b: [2, (c) => "74 " + hex(c.L("main.denied") - c.next, 2)], m: "je", o: (c) => "vault." + q(c.L("main.denied")), run: (m) => m.jcc("e", hex(labelsRef.current["main.denied"]!)) },
    { b: "45:33C9", m: "xor", o: "r9d,r9d", run: (m) => m.xor("r9d", "r9d") },
    strLea("r8", "4C:8D05", STR.title, "PIRE"),
    strLea("rdx", "48:8D15", STR.opened, "Vault opened!"),
    { b: "33C9", m: "xor", o: "ecx,ecx", run: (m) => m.xor("ecx", "ecx") },
    { label: "main.messagebox", ...callImp("MessageBoxA") },
    { b: "33C0", m: "xor", o: "eax,eax", run: (m) => m.xor("eax", "eax") },
    { b: [2, (c) => "EB " + hex(c.L("main.end") - c.next, 2)], m: "jmp", o: (c) => "vault." + q(c.L("main.end")), run: (m) => m.jmp(labelsRef.current["main.end"]!) },
    { label: "main.denied", ...strLea("rcx", "48:8D0D", STR.denied, "Access denied.") },
    callImp("puts"),
    { b: "B8 01000000", m: "mov", o: "eax,1", run: (m) => m.set("eax", 1) },
    { label: "main.end", b: "48:83C4 58", m: "add", o: "rsp,58", run: (m) => m.add("rsp", 0x58) },
    { label: "main.ret", b: "C3", m: "ret", run: (m) => m.ret() },

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
      label: "__security_init_cookie", b: [7, (c) => "48:8B05 " + rel32(c.next, DATA.__security_cookie)], m: "mov",
      o: "rax,qword ptr ds:[" + dat("__security_cookie") + "]", run: (m) => m.set("rax", m.ld(DATA.__security_cookie, 8)),
    },
    { b: "48:B9 32A2DF2D992B0000", m: "mov", o: "rcx,2B992DDFA232", run: (m) => m.set("rcx", 0x2b992ddfa232n) },
    { b: "48:3BC1", m: "cmp", o: "rax,rcx", run: (m) => m.cmp("rax", "rcx") },
    { b: [2, (c) => "75 " + hex(c.L("cookie.ret") - c.next, 2)], m: "jne", o: (c) => "vault." + q(c.L("cookie.ret")), run: (m) => m.jcc("ne", hex(labelsRef.current["cookie.ret"]!)) },
    { b: "0F31", m: "rdtsc" },
    { b: "48:C1E2 20", m: "shl", o: "rdx,20" },
    { b: "48:0BC2", m: "or", o: "rax,rdx" },
    { b: [7, (c) => "48:8905 " + rel32(c.next, DATA.__security_cookie)], m: "mov", o: "qword ptr ds:[" + dat("__security_cookie") + "],rax" },
    { label: "cookie.ret", b: "C3", m: "ret", run: (m) => m.ret() },

    { org: 0x1400011a0n, fill: true },
    // __scrt_common_main_seh, shortened to the parts Lesson 1.5 uses
    { label: "__scrt_common_main_seh", b: "48:895C24 08", m: "mov", o: "qword ptr ss:[rsp+8],rbx", run: (m) => m.st(m.sp(8), 8, "rbx") },
    { b: "57", m: "push", o: "rdi", run: (m) => m.push("rdi") },
    { b: "48:83EC 30", m: "sub", o: "rsp,30", run: (m) => m.sub("rsp", 0x30) },
    { b: [7, (c) => "48:8D15 " + rel32(c.next, DATA.__xc_z)], m: "lea", o: "rdx,qword ptr ds:[" + dat("__xc_z") + "]", run: (m) => m.set("rdx", DATA.__xc_z) },
    { b: [7, (c) => "48:8D0D " + rel32(c.next, DATA.__xc_a)], m: "lea", o: "rcx,qword ptr ds:[" + dat("__xc_a") + "]", run: (m) => m.set("rcx", DATA.__xc_a) },
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
  ];

  const { rows: out, labels } = assemble(rows);
  labelsRef.current = labels;
  return { module: { name: "vault.exe", base: 0x140000000n, size: 0x7000, rows: out }, labels };
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
      { b: "48:8BF9", m: "mov", o: "rdi,rcx", run: (m) => { m.print(m.cstr(m.get("rcx")) + "\n"); m.clobber(1); } },
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
          const s = m.cstr(m.get("r8"));
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

function ntdllModule(entry: () => bigint): ProgramModule {
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
        m.event = "INT3 breakpoint \"entry breakpoint\" at <vault.EntryPoint> (" + hex(entry()) + ")!";
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

function stringsRegion(): string {
  const bytes = new Array<number>(0x80).fill(0);
  const put = (a: bigint, s: string) => [...s].forEach((ch, i) => (bytes[Number(a - STR.banner) + i] = ch.charCodeAt(0)));
  put(STR.banner, "== PIRE VAULT ==");
  put(STR.prompt, "Enter code: ");
  put(STR.newline, "\n");
  put(STR.title, "PIRE");
  put(STR.opened, "Vault opened!");
  put(STR.denied, "Access denied.");
  put(STR.secret, "opensesame");
  return bytes.map((b) => hex(b, 2)).join(" ");
}

const memory: MemoryRegion[] = [
  { base: hex(0x140002000n), size: 0x240, section: ".rdata", bytes: qwords(0x140002000n, 0x240, Object.entries(IAT).map(([n, a]) => [a, LIB[n as Import]])) },
  { base: hex(STR.banner), size: 0x100, section: ".rdata", bytes: stringsRegion() },
  {
    base: hex(DATA.SECRET), size: 0x200, section: ".data",
    bytes: qwords(DATA.SECRET, 0x48, [[DATA.SECRET, STR.secret], [DATA.__security_cookie, 0x2b992ddfa233n], [DATA.g_attempts, 0n]]),
  },
  { base: hex(0x14d000n), size: 0x3000, section: "stack" },
  { base: hex(ARGV_ARRAY), size: 0x300, section: "heap", bytes: qwords(ARGV_ARRAY, 0x20, [[ARGV_ARRAY, 0x2a3fa0n]]) + " " + bytesOf("C:\\pire\\vault.exe") },
  { base: hex(ARGC), size: 0x10, section: ".data", bytes: qwords(ARGC, 0x10, [[ARGC, 1n], [ARGV, ARGV_ARRAY]]) },
  { base: hex(FILE_TABLE), size: 0x108, section: ".data" },
];

function symbolTable(labels: Record<string, bigint>, build: VaultBuild): SymbolInfo[] {
  const own: SymbolInfo[] = build.symbols
    ? [
        ...["check_code", "main", "printf", "__security_init_cookie", "__scrt_common_main_seh", "mainCRTStartup"].map(
          (name): SymbolInfo => ({ name, address: hex(labels[name]!), module: "vault.exe", kind: "function" }),
        ),
        ...(["SECRET", "g_attempts", "__security_cookie"] as const).map(
          (name): SymbolInfo => ({ name, address: hex(DATA[name]), module: "vault.exe", kind: "data" }),
        ),
      ]
    : [];
  const entry: SymbolInfo = { name: "EntryPoint", address: hex(labels.mainCRTStartup!), module: "vault.exe", kind: "function" };
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

export function vaultProgram(build: VaultBuild): Program & { labels: Record<string, bigint> } {
  const { module: vault, labels } = vaultModule(build);
  return {
    labels,
    modules: [
      vault,
      ucrtModule(),
      user32Module(),
      { name: "kernel32.dll", base: 0x7ffe1c990000n, size: 0xc0000, rows: [] },
      ntdllModule(() => labels.mainCRTStartup!),
    ],
    symbols: symbolTable(labels, build),
    memory,
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

const PROCESS = { name: "vault.exe", pid: "2F18", tid: "1C4C" };

export interface VaultRecordings {
  wrong: Recording;
  right: Recording;
  strippedWrong: Recording;
  strippedRight: Recording;
  /** Code addresses lessons point at, such as "main" or "main.check". */
  at: Record<string, string>;
}

let cache: VaultRecordings | undefined;

export function vaultRecordings(): VaultRecordings {
  if (cache) return cache;
  const named = vaultProgram({ symbols: true });
  const stripped = vaultProgram({ symbols: false });
  cache = {
    wrong: record(named, { id: "vault.wrong", label: "vault.exe, input hello", stdin: "hello", process: PROCESS }),
    right: record(named, { id: "vault.right", label: "vault.exe, input opensesame", stdin: "opensesame", process: PROCESS }),
    strippedWrong: record(stripped, { id: "vault-stripped.wrong", label: "vault.exe without PDB, input hello", stdin: "hello", process: PROCESS }),
    strippedRight: record(stripped, { id: "vault-stripped.right", label: "vault.exe without PDB, input opensesame", stdin: "opensesame", process: PROCESS }),
    at: Object.fromEntries(Object.entries(named.labels).map(([k, v]) => [k, hex(v)])),
  };
  return cache;
}
