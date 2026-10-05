import { rel32, type AsmRow, type Machine } from "../../machine/machine";
import type { SourceFile } from "../../schema";
import { q, recordProgram, type AppSpec, type Helpers, type ProgramRecordings } from "../msvc";

/*
 * calls2.exe, the Module 3 challenge specimen, built /Od and shipped without its PDB. Six small
 * functions with different prototypes, each called once from main. It runs with no arguments, so n is
 * 10, and it prints "5 AAAAAAAAAAAAAAA 5.333333 -100 3.250000 3".
 */

const S = { pire: 0x140003200n, reverse: 0x140003208n, engineering: 0x140003210n, asm: 0x140003220n, fmt: 0x140003228n };
const C = { two: 0x140003240n, four: 0x140003248n, three: 0x140003250n, one: 0x140003258n, ten: 0x14000325cn, quarter: 0x140003260n };
const FMT = "%d %s %f %lld %f %d\\n";

const LOW64 = 0xffffffffffffffffn;
const LOW32 = 0xffffffffn;
const i32 = (v: bigint) => Number(BigInt.asIntN(32, v));
const stX = (m: Machine, a: bigint, i: number, size: 4 | 8) => m.st(a, size, m.xmm[i]! & (size === 8 ? LOW64 : LOW32));
const off = (n: number) => "[rsp" + (n ? "+" + q(BigInt(n)) : "") + "]";

const ld32 = (reg: string, b: string, o: number): AsmRow => ({ b, m: "mov", o: reg + ",dword ptr ss:" + off(o), run: (m) => m.set(reg, m.ld(m.sp(o), 4)) });
const st32 = (reg: string, b: string, o: number): AsmRow => ({ b, m: "mov", o: "dword ptr ss:" + off(o) + "," + reg, run: (m) => m.st(m.sp(o), 4, reg) });
const ld64 = (reg: string, b: string, o: number): AsmRow => ({ b, m: "mov", o: reg + ",qword ptr ss:" + off(o), run: (m) => m.set(reg, m.ld(m.sp(o), 8)) });
const st64 = (reg: string, b: string, o: number): AsmRow => ({ b, m: "mov", o: "qword ptr ss:" + off(o) + "," + reg, run: (m) => m.st(m.sp(o), 8, reg) });
const imm32 = (reg: string, b: string, v: number): AsmRow => ({ b, m: "mov", o: reg + "," + q(BigInt(v)), run: (m) => m.set(reg, v) });
const movsxd = (reg: string, b: string, o: number): AsmRow => ({ b, m: "movsxd", o: reg + ",dword ptr ss:" + off(o), run: (m) => m.set(reg, BigInt.asIntN(32, m.ld(m.sp(o), 4))) });
const sub = (n: number, b: string): AsmRow => ({ b, m: "sub", o: "rsp," + q(BigInt(n)), run: (m) => m.sub("rsp", n) });
const add = (n: number, b: string): AsmRow => ({ b, m: "add", o: "rsp," + q(BigInt(n)), run: (m) => m.add("rsp", n) });
const ret: AsmRow = { b: "C3", m: "ret", run: (m) => m.ret() };
const incEax: AsmRow = { b: "FFC0", m: "inc", o: "eax", run: (m) => m.inc("eax") };
const xStore = (m_: "movss" | "movsd", b: string, o: number, i: number): AsmRow => ({
  b, m: m_, o: (m_ === "movss" ? "dword" : "qword") + " ptr ss:" + off(o) + ",xmm" + i, run: (m) => stX(m, m.sp(o), i, m_ === "movss" ? 4 : 8),
});
const xLoad = (m_: "movss" | "movsd", b: string, i: number, o: number): AsmRow => ({
  b, m: m_, o: "xmm" + i + "," + (m_ === "movss" ? "dword" : "qword") + " ptr ss:" + off(o),
  run: (m) => (m_ === "movss" ? m.setSs(i, m.ldF32(m.sp(o)), true) : m.setSd(i, m.ldF64(m.sp(o)), true)),
});
/** A floating-point constant load from .rdata, named after its bit pattern the way MSVC names them. */
function xConst(h: Helpers, m_: "movss" | "movsd" | "divsd", prefix: string, i: number, at: bigint, name: string): AsmRow {
  const size = m_ === "movss" ? "dword" : "qword";
  return {
    b: [8, (c) => prefix + " " + rel32(c.next, at)], m: m_, o: "xmm" + i + "," + size + " ptr ds:[" + (h.symbols ? "<" + name + ">" : q(at)) + "]",
    run: (m) => {
      if (m_ === "movss") m.setSs(i, m.ldF32(at), true);
      else if (m_ === "movsd") m.setSd(i, m.ldF64(at), true);
      else m.setSd(i, m.sd(i) / m.ldF64(at));
    },
  };
}
const leaRax = (at: bigint, text: string): AsmRow => ({
  b: [7, (c) => "48:8D05 " + rel32(c.next, at)], m: "lea", o: "rax,qword ptr ds:[" + q(at) + "]", c: q(at) + ':"' + text + '"', run: (m) => m.set("rax", at),
});

export const calls2Spec: AppSpec = {
  exe: "calls2",
  strings: [
    [S.pire, "pire"],
    [S.reverse, "reverse"],
    [S.engineering, "engineering"],
    [S.asm, "asm"],
    [S.fmt, "%d %s %f %lld %f %d\n"],
  ],
  consts: [
    { at: C.two, bytes: [0, 0, 0, 0, 0, 0, 0x00, 0x40], name: "__real@4000000000000000" },
    { at: C.four, bytes: [0, 0, 0, 0, 0, 0, 0x10, 0x40], name: "__real@4010000000000000" },
    { at: C.three, bytes: [0, 0, 0, 0, 0, 0, 0x08, 0x40], name: "__real@4008000000000000" },
    { at: C.one, bytes: [0, 0, 0x80, 0x3f], name: "__real@3f800000" },
    { at: C.ten, bytes: [0, 0, 0x20, 0x41], name: "__real@41200000" },
    { at: C.quarter, bytes: [0, 0, 0x80, 0x3e], name: "__real@3e800000" },
  ],
  data: {},
  dataInit: [],
  functions: ["clamp", "fill", "avg3", "pick", "lerp", "count_except", "main"],
  leaves: ["avg3", "lerp"],
  globals: [],
  xmm: true,
  rows: (h) => [
    { org: 0x140001000n },
    // int clamp(int v, int lo, int hi)
    { label: "clamp", ...st32("r8d", "44:894424 18", 0x18) },
    st32("edx", "895424 10", 0x10),
    st32("ecx", "894C24 08", 8),
    sub(0x18, "48:83EC 18"),
    ld32("eax", "8B4424 28", 0x28),
    { b: "394424 20", m: "cmp", o: "dword ptr ss:[rsp+20],eax", run: (m) => m.cmp(m.ld(m.sp(0x20), 4), "eax", 32) },
    h.jcc("jge", "7D", "ge", "clamp.hi"),
    ld32("eax", "8B4424 28", 0x28),
    st32("eax", "894424 04", 4),
    h.jmp("clamp.out"),
    { label: "clamp.hi", ...ld32("eax", "8B4424 30", 0x30) },
    { b: "394424 20", m: "cmp", o: "dword ptr ss:[rsp+20],eax", run: (m) => m.cmp(m.ld(m.sp(0x20), 4), "eax", 32) },
    h.jcc("jle", "7E", "le", "clamp.v"),
    ld32("eax", "8B4424 30", 0x30),
    st32("eax", "890424", 0),
    h.jmp("clamp.mid"),
    { label: "clamp.v", ...ld32("eax", "8B4424 20", 0x20) },
    st32("eax", "890424", 0),
    { label: "clamp.mid", ...ld32("eax", "8B0424", 0) },
    st32("eax", "894424 04", 4),
    { label: "clamp.out", ...ld32("eax", "8B4424 04", 4) },
    add(0x18, "48:83C4 18"),
    { label: "clamp.ret", ...ret },

    { align: 16 },
    // void fill(char *buf, char c, size_t n)
    { label: "fill", ...st64("r8", "4C:894424 18", 0x18) },
    { b: "885424 10", m: "mov", o: "byte ptr ss:[rsp+10],dl", run: (m) => m.st(m.sp(0x10), 1, "dl") },
    st64("rcx", "48:894C24 08", 8),
    sub(0x18, "48:83EC 18"),
    { b: "48:C70424 00000000", m: "mov", o: "qword ptr ss:[rsp],0", run: (m) => m.st(m.sp(), 8, 0) },
    h.jmp("fill.check"),
    { label: "fill.inc", ...ld64("rax", "48:8B0424", 0) },
    { b: "48:FFC0", m: "inc", o: "rax", run: (m) => m.inc("rax") },
    st64("rax", "48:890424", 0),
    { label: "fill.check", ...ld64("rax", "48:8B4424 30", 0x30) },
    { b: "48:390424", m: "cmp", o: "qword ptr ss:[rsp],rax", run: (m) => m.cmp(m.ld(m.sp(), 8), "rax") },
    h.jcc("jae", "73", "ae", "fill.done"),
    ld64("rax", "48:8B0424", 0),
    ld64("rcx", "48:8B4C24 20", 0x20),
    { b: "0FB65424 28", m: "movzx", o: "edx,byte ptr ss:[rsp+28]", run: (m) => m.set("edx", m.ld(m.sp(0x28), 1)) },
    { b: "881401", m: "mov", o: "byte ptr ds:[rcx+rax],dl", run: (m) => m.st(m.get("rcx") + m.get("rax"), 1, "dl") },
    h.jmp("fill.inc"),
    { label: "fill.done", ...add(0x18, "48:83C4 18") },
    { label: "fill.ret", ...ret },

    { align: 16 },
    // double avg3(double a, double b, double c)
    { label: "avg3", ...xStore("movsd", "F2:0F115424 18", 0x18, 2) },
    xStore("movsd", "F2:0F114C24 10", 0x10, 1),
    xStore("movsd", "F2:0F114424 08", 8, 0),
    xLoad("movsd", "F2:0F104424 08", 0, 8),
    { b: "F2:0F584424 10", m: "addsd", o: "xmm0,qword ptr ss:[rsp+10]", run: (m) => m.setSd(0, m.sd(0) + m.ldF64(m.sp(0x10))) },
    { b: "F2:0F584424 18", m: "addsd", o: "xmm0,qword ptr ss:[rsp+18]", run: (m) => m.setSd(0, m.sd(0) + m.ldF64(m.sp(0x18))) },
    xConst(h, "divsd", "F2:0F5E05", 0, C.three, "__real@4008000000000000"),
    { label: "avg3.ret", ...ret },
    { label: "rows.end", b: "CC", m: "int3" },
  ],
  tail: (h) => [
    // int main(int argc, char **argv)
    { label: "main", ...st64("rdx", "48:895424 10", 0x10) },
    st32("ecx", "894C24 08", 8),
    { label: "main.sub", ...sub(0x98, "48:81EC 98000000") },
    { label: "main.words", ...leaRax(S.pire, "pire") },
    st64("rax", "48:894424 60", 0x60),
    leaRax(S.reverse, "reverse"),
    st64("rax", "48:894424 68", 0x68),
    leaRax(S.engineering, "engineering"),
    st64("rax", "48:894424 70", 0x70),
    leaRax(S.asm, "asm"),
    st64("rax", "48:894424 78", 0x78),
    ld32("eax", "8B8424 A0000000", 0xa0),
    { b: "83C0 09", m: "add", o: "eax,9", run: (m) => m.add("eax", 9) },
    { label: "main.n", ...st32("eax", "894424 40", 0x40) },
    // a = clamp(n, 0, 5)
    { label: "main.clamp.hi", ...imm32("r8d", "41:B8 05000000", 5) },
    { b: "33D2", m: "xor", o: "edx,edx", run: (m) => m.xor("edx", "edx") },
    ld32("ecx", "8B4C24 40", 0x40),
    { label: "main.clamp", ...h.call("clamp") },
    { label: "main.a", ...st32("eax", "894424 44", 0x44) },
    // fill(buf, 'A', sizeof buf - 1)
    { label: "main.fill.n", ...imm32("r8d", "41:B8 0F000000", 15) },
    { b: "B2 41", m: "mov", o: "dl,41", c: "'A'", run: (m) => m.set("dl", 0x41) },
    { b: "48:8D8C24 80000000", m: "lea", o: "rcx,qword ptr ss:[rsp+80]", run: (m) => m.set("rcx", m.sp(0x80)) },
    { label: "main.fill", ...h.call("fill") },
    { label: "main.buf15", b: "C68424 8F000000 00", m: "mov", o: "byte ptr ss:[rsp+8F],0", run: (m) => m.st(m.sp(0x8f), 1, 0) },
    // b = avg3(n, 2.0, 4.0)
    { label: "main.avg3.c", ...xConst(h, "movsd", "F2:0F1015", 2, C.four, "__real@4010000000000000") },
    xConst(h, "movsd", "F2:0F100D", 1, C.two, "__real@4000000000000000"),
    { b: "F2:0F2A4424 40", m: "cvtsi2sd", o: "xmm0,dword ptr ss:[rsp+40]", run: (m) => m.setSd(0, i32(m.ld(m.sp(0x40), 4))) },
    { label: "main.avg3", ...h.call("avg3") },
    { label: "main.b", ...xStore("movsd", "F2:0F114424 48", 0x48, 0) },
    // c = pick(n, -100, 1, 2, 3, 400)
    { label: "main.pick.f", b: "48:C74424 28 90010000", m: "mov", o: "qword ptr ss:[rsp+28],190", run: (m) => m.st(m.sp(0x28), 8, 400) },
    { b: "C74424 20 03000000", m: "mov", o: "dword ptr ss:[rsp+20],3", run: (m) => m.st(m.sp(0x20), 4, 3) },
    imm32("r9d", "41:B9 02000000", 2),
    imm32("r8d", "41:B8 01000000", 1),
    { label: "main.pick.b", b: "48:C7C2 9CFFFFFF", m: "mov", o: "rdx,FFFFFFFFFFFFFF9C", run: (m) => m.set("rdx", -100) },
    ld32("ecx", "8B4C24 40", 0x40),
    { label: "main.pick", ...h.call("pick") },
    { label: "main.c", ...st64("rax", "48:894424 50", 0x50) },
    // d = lerp(1.0f, 10.0f, 0.25f)
    { label: "main.lerp.t", ...xConst(h, "movss", "F3:0F1015", 2, C.quarter, "__real@3e800000") },
    xConst(h, "movss", "F3:0F100D", 1, C.ten, "__real@41200000"),
    xConst(h, "movss", "F3:0F1005", 0, C.one, "__real@3f800000"),
    { label: "main.lerp", ...h.call("lerp") },
    { label: "main.d", ...xStore("movss", "F3:0F114424 58", 0x58, 0) },
    // e = count_except(words, 4, "asm")
    { label: "main.count.skip", ...h.strLea("r8", "4C:8D05", S.asm, "asm") },
    imm32("edx", "BA 04000000", 4),
    { b: "48:8D4C24 60", m: "lea", o: "rcx,qword ptr ss:[rsp+60]", run: (m) => m.set("rcx", m.sp(0x60)) },
    { label: "main.count", ...h.call("count_except") },
    { label: "main.e", ...st32("eax", "894424 5C", 0x5c) },
    // printf("%d %s %f %lld %f %d\n", a, buf, b, c, d, e)
    ld32("eax", "8B4424 5C", 0x5c),
    st32("eax", "894424 30", 0x30),
    { b: "F3:0F5A4424 58", m: "cvtss2sd", o: "xmm0,dword ptr ss:[rsp+58]", run: (m) => m.setSd(0, m.ldF32(m.sp(0x58))) },
    xStore("movsd", "F2:0F114424 28", 0x28, 0),
    ld64("rax", "48:8B4424 50", 0x50),
    st64("rax", "48:894424 20", 0x20),
    xLoad("movsd", "F2:0F105C24 48", 3, 0x48),
    { b: "66:49:0F7ED9", m: "movq", o: "r9,xmm3", run: (m) => m.set("r9", m.xmm[3]! & LOW64) },
    { b: "4C:8D8424 80000000", m: "lea", o: "r8,qword ptr ss:[rsp+80]", run: (m) => m.set("r8", m.sp(0x80)) },
    ld32("edx", "8B5424 44", 0x44),
    h.strLea("rcx", "48:8D0D", S.fmt, FMT),
    { label: "main.printf", ...h.call("printf") },
    { b: "33C0", m: "xor", o: "eax,eax", run: (m) => m.xor("eax", "eax") },
    add(0x98, "48:81C4 98000000"),
    { label: "main.ret", ...ret },

    { align: 16 },
    // long long pick(int a, long long b, int c, int d, int e, long long f)
    { label: "pick", ...st32("r9d", "44:894C24 20", 0x20) },
    st32("r8d", "44:894424 18", 0x18),
    st64("rdx", "48:895424 10", 0x10),
    st32("ecx", "894C24 08", 8),
    sub(0x18, "48:83EC 18"),
    { b: "837C24 20 00", m: "cmp", o: "dword ptr ss:[rsp+20],0", run: (m) => m.cmp(m.ld(m.sp(0x20), 4), 0, 32) },
    h.jcc("jle", "7E", "le", "pick.else"),
    ld64("rax", "48:8B4424 28", 0x28),
    st64("rax", "48:890424", 0),
    h.jmp("pick.out"),
    { label: "pick.else", ...movsxd("rax", "48:634424 30", 0x30) },
    ld64("rcx", "48:8B4C24 48", 0x48),
    { b: "48:03C8", m: "add", o: "rcx,rax", run: (m) => m.add("rcx", "rax") },
    movsxd("rax", "48:634424 38", 0x38),
    { b: "48:03C8", m: "add", o: "rcx,rax", run: (m) => m.add("rcx", "rax") },
    movsxd("rax", "48:634424 40", 0x40),
    { b: "48:03C8", m: "add", o: "rcx,rax", run: (m) => m.add("rcx", "rax") },
    { b: "48:8BC1", m: "mov", o: "rax,rcx", run: (m) => m.set("rax", m.get("rcx")) },
    st64("rax", "48:890424", 0),
    { label: "pick.out", ...ld64("rax", "48:8B0424", 0) },
    add(0x18, "48:83C4 18"),
    { label: "pick.ret", ...ret },

    { align: 16 },
    // float lerp(float a, float b, float t)
    { label: "lerp", ...xStore("movss", "F3:0F115424 18", 0x18, 2) },
    xStore("movss", "F3:0F114C24 10", 0x10, 1),
    xStore("movss", "F3:0F114424 08", 8, 0),
    xLoad("movss", "F3:0F104424 10", 0, 0x10),
    { b: "F3:0F5C4424 08", m: "subss", o: "xmm0,dword ptr ss:[rsp+8]", run: (m) => m.setSs(0, Math.fround(m.ss(0) - m.ldF32(m.sp(8)))) },
    { b: "F3:0F594424 18", m: "mulss", o: "xmm0,dword ptr ss:[rsp+18]", run: (m) => m.setSs(0, Math.fround(m.ss(0) * m.ldF32(m.sp(0x18)))) },
    { b: "F3:0F584424 08", m: "addss", o: "xmm0,dword ptr ss:[rsp+8]", run: (m) => m.setSs(0, Math.fround(m.ss(0) + m.ldF32(m.sp(8)))) },
    { label: "lerp.ret", ...ret },

    { align: 16 },
    // int count_except(const char **words, int n, const char *skip)
    { label: "count_except", ...st64("r8", "4C:894424 18", 0x18) },
    st32("edx", "895424 10", 0x10),
    st64("rcx", "48:894C24 08", 8),
    sub(0x38, "48:83EC 38"),
    { label: "count.zero", b: "C74424 20 00000000", m: "mov", o: "dword ptr ss:[rsp+20],0", run: (m) => m.st(m.sp(0x20), 4, 0) },
    { label: "count.i", b: "C74424 24 00000000", m: "mov", o: "dword ptr ss:[rsp+24],0", run: (m) => m.st(m.sp(0x24), 4, 0) },
    h.jmp("count.check"),
    { label: "count.inc", ...ld32("eax", "8B4424 24", 0x24) },
    incEax,
    st32("eax", "894424 24", 0x24),
    { label: "count.check", ...ld32("eax", "8B4424 48", 0x48) },
    { b: "394424 24", m: "cmp", o: "dword ptr ss:[rsp+24],eax", run: (m) => m.cmp(m.ld(m.sp(0x24), 4), "eax", 32) },
    h.jcc("jge", "7D", "ge", "count.done"),
    movsxd("rax", "48:634424 24", 0x24),
    ld64("rdx", "48:8B5424 50", 0x50),
    ld64("rcx", "48:8B4C24 40", 0x40),
    { b: "48:8B0CC1", m: "mov", o: "rcx,qword ptr ds:[rcx+rax*8]", run: (m) => m.set("rcx", m.ld(m.get("rcx") + m.get("rax") * 8n, 8)) },
    { label: "count.strcmp", ...h.callImp("strcmp") },
    { b: "85C0", m: "test", o: "eax,eax", run: (m) => m.test("eax", "eax", 32) },
    h.jcc("je", "74", "e", "count.inc"),
    ld32("eax", "8B4424 20", 0x20),
    incEax,
    st32("eax", "894424 20", 0x20),
    h.jmp("count.inc"),
    { label: "count.done", ...ld32("eax", "8B4424 20", 0x20) },
    add(0x38, "48:83C4 38"),
    { label: "count.ret", ...ret },
  ],
};

let cache: ProgramRecordings | undefined;

export function calls2Recordings(): ProgramRecordings {
  cache ??= recordProgram(calls2Spec);
  const end = BigInt("0x" + cache.at["rows.end"]!);
  if (end >= 0x140001110n) throw new Error("calls2 functions overlap printf");
  return cache;
}

export const calls2Source: SourceFile = {
  name: "calls2.c",
  code: [
    "#include <stdio.h>",
    "#include <string.h>",
    "",
    "__declspec(noinline) int clamp(int v, int lo, int hi)",
    "{",
    "    return v < lo ? lo : v > hi ? hi : v;",
    "}",
    "",
    "__declspec(noinline) void fill(char *buf, char c, size_t n)",
    "{",
    "    for (size_t i = 0; i < n; i++)",
    "        buf[i] = c;",
    "}",
    "",
    "__declspec(noinline) double avg3(double a, double b, double c)",
    "{",
    "    return (a + b + c) / 3.0;",
    "}",
    "",
    "__declspec(noinline) long long pick(int a, long long b, int c, int d, int e, long long f)",
    "{",
    "    return a > 0 ? b : f + c + d + e;",
    "}",
    "",
    "__declspec(noinline) float lerp(float a, float b, float t)",
    "{",
    "    return a + (b - a) * t;",
    "}",
    "",
    "__declspec(noinline) int count_except(const char **words, int n, const char *skip)",
    "{",
    "    int count = 0;",
    "    for (int i = 0; i < n; i++)",
    "        if (strcmp(words[i], skip) != 0)",
    "            count++;",
    "    return count;",
    "}",
    "",
    "int main(int argc, char **argv)",
    "{",
    "    char buf[16];",
    "    const char *words[] = { \"pire\", \"reverse\", \"engineering\", \"asm\" };",
    "    int n = argc + 9;",
    "",
    "    int       a = clamp(n, 0, 5);",
    "    fill(buf, 'A', sizeof buf - 1);",
    "    buf[15] = 0;",
    "    double    b = avg3(n, 2.0, 4.0);",
    "    long long c = pick(n, -100, 1, 2, 3, 400);",
    "    float     d = lerp(1.0f, 10.0f, 0.25f);",
    "    int       e = count_except(words, 4, \"asm\");",
    "",
    "    printf(\"%d %s %f %lld %f %d\\n\", a, buf, b, c, d, e);",
    "    return 0;",
    "}",
  ].join("\n"),
  regions: { clamp: [4, 7], fill: [9, 13], avg3: [15, 18], pick: [20, 23], lerp: [25, 28], count_except: [30, 37], main: [39, 55] },
};
