import { rel32, type AsmRow, type Machine } from "../../machine/machine";
import { q, recordProgram, type AppSpec, type Helpers, type ProgramRecordings } from "../msvc";

/*
 * calls.exe, the Module 3 specimen, as MSVC /Od builds it. add, sum6, scale, shout and mix sit below
 * printf; main is long, so it lives after the C runtime startup at 140001230. It runs with no
 * arguments: argc is 1, so n is 3 and the program prints PIRE! three times, then "8 19 18 5.500000 3".
 */

const S = { pire: 0x140003200n, fmt: 0x140003208n };
const C = { half: 0x140003220n, oneHalf: 0x140003228n };

const LOW64 = 0xffffffffffffffffn;
const LOW32 = 0xffffffffn;
/** Stores the low 64 or 32 bits of an XMM register. */
const stX = (m: Machine, a: bigint, i: number, size: 4 | 8) => m.st(a, size, m.xmm[i]! & (size === 8 ? LOW64 : LOW32));
const i32 = (v: bigint) => Number(BigInt.asIntN(32, v));

/** mov reg, dword ptr ss:[rsp+off] and friends, with x64dbg's text. */
const ld32 = (reg: string, b: string, off: number): AsmRow => ({ b, m: "mov", o: reg + ",dword ptr ss:[rsp+" + q(BigInt(off)) + "]", run: (m) => m.set(reg, m.ld(m.sp(off), 4)) });
const st32 = (reg: string, b: string, off: number): AsmRow => ({ b, m: "mov", o: "dword ptr ss:[rsp+" + q(BigInt(off)) + "]," + reg, run: (m) => m.st(m.sp(off), 4, reg) });
const imm32 = (reg: string, b: string, v: number): AsmRow => ({ b, m: "mov", o: reg + "," + q(BigInt(v)), run: (m) => m.set(reg, v) });
const movsxd = (reg: string, b: string, off: number): AsmRow => ({
  b, m: "movsxd", o: reg + ",dword ptr ss:[rsp+" + q(BigInt(off)) + "]", run: (m) => m.set(reg, BigInt.asIntN(32, m.ld(m.sp(off), 4))),
});
const addRaxRcx: AsmRow = { b: "48:03C1", m: "add", o: "rax,rcx", run: (m) => m.add("rax", "rcx") };

function constRef(h: Helpers, name: string, at: bigint) {
  return h.symbols ? "<" + name + ">" : q(at);
}

export const callsSpec: AppSpec = {
  exe: "calls",
  strings: [
    [S.pire, "PIRE!"],
    [S.fmt, "%d %lld %d %f %d\n"],
  ],
  consts: [
    { at: C.half, bytes: [0x00, 0x00, 0x00, 0x3f], name: "__real@3f000000" },
    { at: C.oneHalf, bytes: [0, 0, 0, 0, 0, 0, 0xf8, 0x3f], name: "__real@3ff8000000000000" },
  ],
  data: {},
  dataInit: [],
  functions: ["add", "sum6", "scale", "shout", "mix", "main"],
  leaves: ["add", "sum6", "mix"],
  globals: [],
  xmm: true,
  rows: (h) => [
    { org: 0x140001000n },
    // int add(int a, int b)
    { label: "add", ...st32("edx", "895424 10", 0x10) },
    st32("ecx", "894C24 08", 8),
    { label: "add.load", ...ld32("eax", "8B4424 08", 8) },
    { label: "add.add", b: "034424 10", m: "add", o: "eax,dword ptr ss:[rsp+10]", run: (m) => m.add("eax", m.ld(m.sp(0x10), 4)) },
    { label: "add.ret", b: "C3", m: "ret", run: (m) => m.ret() },

    { org: 0x140001020n, fill: true },
    // long long sum6(int a, int b, int c, int d, int e, int f)
    { label: "sum6", ...st32("r9d", "44:894C24 20", 0x20) },
    st32("r8d", "44:894424 18", 0x18),
    st32("edx", "895424 10", 0x10),
    st32("ecx", "894C24 08", 8),
    movsxd("rax", "48:634424 08", 8),
    movsxd("rcx", "48:634C24 10", 0x10),
    addRaxRcx,
    movsxd("rcx", "48:634C24 18", 0x18),
    addRaxRcx,
    movsxd("rcx", "48:634C24 20", 0x20),
    addRaxRcx,
    { label: "sum6.e", ...movsxd("rcx", "48:634C24 28", 0x28) },
    addRaxRcx,
    { label: "sum6.f", ...movsxd("rcx", "48:634C24 30", 0x30) },
    addRaxRcx,
    { label: "sum6.ret", b: "C3", m: "ret", run: (m) => m.ret() },

    { org: 0x140001060n, fill: true },
    // int scale(int x)
    { label: "scale", ...st32("ecx", "894C24 08", 8) },
    { label: "scale.sub", b: "48:83EC 38", m: "sub", o: "rsp,38", run: (m) => m.sub("rsp", 0x38) },
    { label: "scale.body", ...ld32("edx", "8B5424 40", 0x40) },
    { label: "scale.x", ...ld32("ecx", "8B4C24 40", 0x40) },
    { label: "scale.call", ...h.call("add") },
    { label: "scale.after", ...st32("eax", "894424 20", 0x20) },
    { b: "6B4424 20 03", m: "imul", o: "eax,dword ptr ss:[rsp+20],3", run: (m) => m.set("eax", BigInt(i32(m.ld(m.sp(0x20), 4)) * 3)) },
    { label: "scale.epilogue", b: "48:83C4 38", m: "add", o: "rsp,38", run: (m) => m.add("rsp", 0x38) },
    { label: "scale.ret", b: "C3", m: "ret", run: (m) => m.ret() },

    { org: 0x140001090n, fill: true },
    // int shout(int times)
    { label: "shout", ...st32("ecx", "894C24 08", 8) },
    { b: "48:83EC 38", m: "sub", o: "rsp,38", run: (m) => m.sub("rsp", 0x38) },
    { b: "C74424 20 00000000", m: "mov", o: "dword ptr ss:[rsp+20],0", run: (m) => m.st(m.sp(0x20), 4, 0) },
    h.jmp("shout.check"),
    { label: "shout.inc", ...ld32("eax", "8B4424 20", 0x20) },
    { b: "FFC0", m: "inc", o: "eax", run: (m) => m.inc("eax") },
    st32("eax", "894424 20", 0x20),
    { label: "shout.check", ...ld32("eax", "8B4424 40", 0x40) },
    { b: "394424 20", m: "cmp", o: "dword ptr ss:[rsp+20],eax", run: (m) => m.cmp(m.ld(m.sp(0x20), 4), "eax", 32) },
    h.jcc("jge", "7D", "ge", "shout.done"),
    { label: "shout.lea", ...h.strLea("rcx", "48:8D0D", S.pire, "PIRE!") },
    { label: "shout.puts", ...h.callImp("puts") },
    h.jmp("shout.inc"),
    { label: "shout.done", ...ld32("eax", "8B4424 20", 0x20) },
    { b: "48:83C4 38", m: "add", o: "rsp,38", run: (m) => m.add("rsp", 0x38) },
    { label: "shout.ret", b: "C3", m: "ret", run: (m) => m.ret() },

    { org: 0x1400010d0n, fill: true },
    // double mix(int a, double b, int c, float d)
    { label: "mix", b: "F3:0F115C24 20", m: "movss", o: "dword ptr ss:[rsp+20],xmm3", run: (m) => stX(m, m.sp(0x20), 3, 4) },
    st32("r8d", "44:894424 18", 0x18),
    { b: "F2:0F114C24 10", m: "movsd", o: "qword ptr ss:[rsp+10],xmm1", run: (m) => stX(m, m.sp(0x10), 1, 8) },
    st32("ecx", "894C24 08", 8),
    { label: "mix.a", b: "F2:0F2A4424 08", m: "cvtsi2sd", o: "xmm0,dword ptr ss:[rsp+8]", run: (m) => m.setSd(0, i32(m.ld(m.sp(8), 4))) },
    { b: "F2:0F594424 10", m: "mulsd", o: "xmm0,qword ptr ss:[rsp+10]", run: (m) => m.setSd(0, m.sd(0) * m.ldF64(m.sp(0x10))) },
    { b: "F3:0F2A4C24 18", m: "cvtsi2ss", o: "xmm1,dword ptr ss:[rsp+18]", run: (m) => m.setSs(1, Math.fround(i32(m.ld(m.sp(0x18), 4)))) },
    { b: "F3:0F594C24 20", m: "mulss", o: "xmm1,dword ptr ss:[rsp+20]", run: (m) => m.setSs(1, Math.fround(m.ss(1) * m.ldF32(m.sp(0x20)))) },
    { b: "F3:0F5AC9", m: "cvtss2sd", o: "xmm1,xmm1", run: (m) => m.setSd(1, m.ss(1)) },
    { label: "mix.sum", b: "F2:0F58C1", m: "addsd", o: "xmm0,xmm1", run: (m) => m.setSd(0, m.sd(0) + m.sd(1)) },
    { label: "mix.ret", b: "C3", m: "ret", run: (m) => m.ret() },
  ],
  tail: (h) => [
    // int main(int argc, char **argv)
    { label: "main", b: "48:895424 10", m: "mov", o: "qword ptr ss:[rsp+10],rdx", run: (m) => m.st(m.sp(0x10), 8, "rdx") },
    st32("ecx", "894C24 08", 8),
    { label: "main.sub", b: "48:83EC 58", m: "sub", o: "rsp,58", run: (m) => m.sub("rsp", 0x58) },
    ld32("eax", "8B4424 60", 0x60),
    { b: "83C0 02", m: "add", o: "eax,2", run: (m) => m.add("eax", 2) },
    { label: "main.n", ...st32("eax", "894424 40", 0x40) },
    // r1 = add(n, 5)
    { label: "main.add.edx", ...imm32("edx", "BA 05000000", 5) },
    { label: "main.add.ecx", ...ld32("ecx", "8B4C24 40", 0x40) },
    { label: "main.add", ...h.call("add") },
    { label: "main.r1", ...st32("eax", "894424 44", 0x44) },
    // r2 = sum6(1, 2, 3, 4, n, 6)
    { label: "main.sum6.f", b: "C74424 28 06000000", m: "mov", o: "dword ptr ss:[rsp+28],6", run: (m) => m.st(m.sp(0x28), 4, 6) },
    ld32("eax", "8B4424 40", 0x40),
    { label: "main.sum6.e", ...st32("eax", "894424 20", 0x20) },
    { label: "main.sum6.d", ...imm32("r9d", "41:B9 04000000", 4) },
    { label: "main.sum6.c", ...imm32("r8d", "41:B8 03000000", 3) },
    { label: "main.sum6.b", ...imm32("edx", "BA 02000000", 2) },
    { label: "main.sum6.a", ...imm32("ecx", "B9 01000000", 1) },
    { label: "main.sum6", ...h.call("sum6") },
    { label: "main.r2", b: "48:894424 38", m: "mov", o: "qword ptr ss:[rsp+38],rax", run: (m) => m.st(m.sp(0x38), 8, "rax") },
    // r3 = scale(n)
    { label: "main.scale.ecx", ...ld32("ecx", "8B4C24 40", 0x40) },
    { label: "main.scale", ...h.call("scale") },
    { label: "main.r3", ...st32("eax", "894424 48", 0x48) },
    // r4 = mix(n, 1.5, 2, 0.5f)
    {
      label: "main.mix.d", b: [8, (c) => "F3:0F101D " + rel32(c.next, C.half)], m: "movss", o: "xmm3,dword ptr ds:[" + constRef(h, "__real@3f000000", C.half) + "]",
      run: (m) => m.setSs(3, m.ldF32(C.half), true),
    },
    { label: "main.mix.c", ...imm32("r8d", "41:B8 02000000", 2) },
    {
      label: "main.mix.b", b: [8, (c) => "F2:0F100D " + rel32(c.next, C.oneHalf)], m: "movsd", o: "xmm1,qword ptr ds:[" + constRef(h, "__real@3ff8000000000000", C.oneHalf) + "]",
      run: (m) => m.setSd(1, m.ldF64(C.oneHalf), true),
    },
    { label: "main.mix.a", ...ld32("ecx", "8B4C24 40", 0x40) },
    { label: "main.mix", ...h.call("mix") },
    { label: "main.r4", b: "F2:0F114424 30", m: "movsd", o: "qword ptr ss:[rsp+30],xmm0", run: (m) => stX(m, m.sp(0x30), 0, 8) },
    // r5 = shout(n)
    ld32("ecx", "8B4C24 40", 0x40),
    { label: "main.shout", ...h.call("shout") },
    { label: "main.r5", ...st32("eax", "894424 4C", 0x4c) },
    // printf("%d %lld %d %f %d\n", r1, r2, r3, r4, r5)
    { label: "main.printf.args", ...ld32("eax", "8B4424 4C", 0x4c) },
    st32("eax", "894424 28", 0x28),
    { b: "F2:0F104424 30", m: "movsd", o: "xmm0,qword ptr ss:[rsp+30]", run: (m) => m.setSd(0, m.ldF64(m.sp(0x30)), true) },
    { b: "F2:0F114424 20", m: "movsd", o: "qword ptr ss:[rsp+20],xmm0", run: (m) => stX(m, m.sp(0x20), 0, 8) },
    ld32("r9d", "44:8B4C24 48", 0x48),
    { b: "4C:8B4424 38", m: "mov", o: "r8,qword ptr ss:[rsp+38]", run: (m) => m.set("r8", m.ld(m.sp(0x38), 8)) },
    ld32("edx", "8B5424 44", 0x44),
    h.strLea("rcx", "48:8D0D", S.fmt, "%d %lld %d %f %d\\n"),
    { label: "main.printf", ...h.call("printf") },
    { b: "33C0", m: "xor", o: "eax,eax", run: (m) => m.xor("eax", "eax") },
    { label: "main.epilogue", b: "48:83C4 58", m: "add", o: "rsp,58", run: (m) => m.add("rsp", 0x58) },
    { label: "main.ret", b: "C3", m: "ret", run: (m) => m.ret() },
  ],
};

let cache: ProgramRecordings | undefined;

export function callsRecordings(): ProgramRecordings {
  cache ??= recordProgram(callsSpec);
  return cache;
}
