import { rel32, type AsmRow, type Machine } from "../../machine/machine";
import { q, recordProgram, type AppSpec, type Helpers, type ProgramRecordings } from "../msvc";

/*
 * calls-release.exe: the same calls.c built /O2, for Lesson 3.4. Arguments stay in registers, add is a
 * single lea, and shout keeps i in EBX and times in EDI across its calls to puts, saving both first.
 */

const S = { pire: 0x140003200n, fmt: 0x140003208n };
const C = { half: 0x140003220n, oneHalf: 0x140003228n };
const LOW64 = 0xffffffffffffffffn;
const i32 = (v: bigint) => Number(BigInt.asIntN(32, v));
const stX = (m: Machine, a: bigint, i: number) => m.st(a, 8, m.xmm[i]! & LOW64);
const mov = (dst: string, src: string, b: string): AsmRow => ({ b, m: "mov", o: dst + "," + src, run: (m) => m.set(dst, m.get(src)) });
const imm = (reg: string, b: string, v: number): AsmRow => ({ b, m: "mov", o: reg + "," + q(BigInt(v)), run: (m) => m.set(reg, v) });
const sxd = (dst: string, src: string, b: string): AsmRow => ({ b, m: "movsxd", o: dst + "," + src, run: (m) => m.set(dst, BigInt.asIntN(32, m.get(src))) });
const sxdMem = (off: number): AsmRow => ({
  b: "48:634C24 " + q(BigInt(off)), m: "movsxd", o: "rcx,dword ptr ss:[rsp+" + q(BigInt(off)) + "]", run: (m) => m.set("rcx", BigInt.asIntN(32, m.ld(m.sp(off), 4))),
});
const addRaxRcx: AsmRow = { b: "48:03C1", m: "add", o: "rax,rcx", run: (m) => m.add("rax", "rcx") };
const constRef = (h: Helpers, name: string, at: bigint) => (h.symbols ? "<" + name + ">" : q(at));

export const callsReleaseSpec: AppSpec = {
  exe: "calls-release",
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
    // add: one instruction
    { label: "add", b: "8D0411", m: "lea", o: "eax,dword ptr ds:[rcx+rdx]", run: (m) => m.set("eax", m.get("rcx") + m.get("rdx")) },
    { b: "C3", m: "ret", run: (m) => m.ret() },

    { org: 0x140001010n, fill: true },
    { label: "sum6", ...sxd("rax", "ecx", "48:63C1") },
    sxd("rcx", "edx", "48:63CA"),
    addRaxRcx,
    sxd("rcx", "r8d", "49:63C8"),
    addRaxRcx,
    sxd("rcx", "r9d", "49:63C9"),
    addRaxRcx,
    sxdMem(0x28),
    addRaxRcx,
    sxdMem(0x30),
    addRaxRcx,
    { b: "C3", m: "ret", run: (m) => m.ret() },

    { org: 0x140001040n, fill: true },
    { label: "scale", b: "48:83EC 28", m: "sub", o: "rsp,28", run: (m) => m.sub("rsp", 0x28) },
    mov("edx", "ecx", "8BD1"),
    h.call("add"),
    { b: "8D0440", m: "lea", o: "eax,dword ptr ds:[rax+rax*2]", run: (m) => m.set("eax", BigInt(i32(m.get("eax")) * 3)) },
    { b: "48:83C4 28", m: "add", o: "rsp,28", run: (m) => m.add("rsp", 0x28) },
    { b: "C3", m: "ret", run: (m) => m.ret() },

    { org: 0x140001060n, fill: true },
    // shout: i in EBX, times in EDI, both nonvolatile, so both are saved first
    { label: "shout", b: "48:895C24 08", m: "mov", o: "qword ptr ss:[rsp+8],rbx", run: (m) => m.st(m.sp(8), 8, "rbx") },
    { label: "shout.push", b: "57", m: "push", o: "rdi", run: (m) => m.push("rdi") },
    { b: "48:83EC 20", m: "sub", o: "rsp,20", run: (m) => m.sub("rsp", 0x20) },
    { label: "shout.times", ...mov("edi", "ecx", "8BF9") },
    { label: "shout.i", b: "33DB", m: "xor", o: "ebx,ebx", run: (m) => m.xor("ebx", "ebx") },
    { b: "85C9", m: "test", o: "ecx,ecx", run: (m) => m.test("ecx", "ecx", 32) },
    h.jcc("jle", "7E", "le", "shout.done"),
    { label: "shout.loop", ...h.strLea("rcx", "48:8D0D", S.pire, "PIRE!") },
    { label: "shout.puts", ...h.callImp("puts") },
    { label: "shout.inc", b: "FFC3", m: "inc", o: "ebx", run: (m) => m.inc("ebx") },
    { label: "shout.cmp", b: "3BDF", m: "cmp", o: "ebx,edi", run: (m) => m.cmp("ebx", "edi", 32) },
    h.jcc("jl", "7C", "l", "shout.loop"),
    { label: "shout.done", ...mov("eax", "ebx", "8BC3") },
    { label: "shout.restore", b: "48:8B5C24 30", m: "mov", o: "rbx,qword ptr ss:[rsp+30]", run: (m) => m.set("rbx", m.ld(m.sp(0x30), 8)) },
    { b: "48:83C4 20", m: "add", o: "rsp,20", run: (m) => m.add("rsp", 0x20) },
    { label: "shout.pop", b: "5F", m: "pop", o: "rdi", run: (m) => m.pop("rdi") },
    { label: "shout.ret", b: "C3", m: "ret", run: (m) => m.ret() },

    { org: 0x1400010a0n, fill: true },
    { label: "mix", b: "0F57C0", m: "xorps", o: "xmm0,xmm0", run: (m) => (m.xmm[0] = 0n) },
    { b: "F2:0F2AC1", m: "cvtsi2sd", o: "xmm0,ecx", run: (m) => m.setSd(0, i32(m.get("ecx"))) },
    { b: "F2:0F59C1", m: "mulsd", o: "xmm0,xmm1", run: (m) => m.setSd(0, m.sd(0) * m.sd(1)) },
    { b: "0F57C9", m: "xorps", o: "xmm1,xmm1", run: (m) => (m.xmm[1] = 0n) },
    { b: "F3:41:0F2AC8", m: "cvtsi2ss", o: "xmm1,r8d", run: (m) => m.setSs(1, Math.fround(i32(m.get("r8d")))) },
    { b: "F3:0F59CB", m: "mulss", o: "xmm1,xmm3", run: (m) => m.setSs(1, Math.fround(m.ss(1) * m.ss(3))) },
    { b: "F3:0F5AC9", m: "cvtss2sd", o: "xmm1,xmm1", run: (m) => m.setSd(1, m.ss(1)) },
    { b: "F2:0F58C1", m: "addsd", o: "xmm0,xmm1", run: (m) => m.setSd(0, m.sd(0) + m.sd(1)) },
    { b: "C3", m: "ret", run: (m) => m.ret() },
  ],
  tail: (h) => [
    { label: "main", b: "48:895C24 08", m: "mov", o: "qword ptr ss:[rsp+8],rbx", run: (m) => m.st(m.sp(8), 8, "rbx") },
    { label: "main.saveRsi", b: "48:897424 10", m: "mov", o: "qword ptr ss:[rsp+10],rsi", run: (m) => m.st(m.sp(0x10), 8, "rsi") },
    { label: "main.push", b: "57", m: "push", o: "rdi", run: (m) => m.push("rdi") },
    { b: "48:83EC 40", m: "sub", o: "rsp,40", run: (m) => m.sub("rsp", 0x40) },
    { b: "8D79 02", m: "lea", o: "edi,qword ptr ds:[rcx+2]", run: (m) => m.set("edi", m.get("ecx") + 2n) },
    imm("edx", "BA 05000000", 5),
    mov("ecx", "edi", "8BCF"),
    h.call("add"),
    mov("ebx", "eax", "8BD8"),
    { b: "C74424 28 06000000", m: "mov", o: "dword ptr ss:[rsp+28],6", run: (m) => m.st(m.sp(0x28), 4, 6) },
    imm("r9d", "41:B9 04000000", 4),
    { b: "897C24 20", m: "mov", o: "dword ptr ss:[rsp+20],edi", run: (m) => m.st(m.sp(0x20), 4, "edi") },
    imm("r8d", "41:B8 03000000", 3),
    imm("edx", "BA 02000000", 2),
    imm("ecx", "B9 01000000", 1),
    h.call("sum6"),
    mov("ecx", "edi", "8BCF"),
    mov("rsi", "rax", "48:8BF0"),
    h.call("scale"),
    { b: "894424 38", m: "mov", o: "dword ptr ss:[rsp+38],eax", run: (m) => m.st(m.sp(0x38), 4, "eax") },
    {
      b: [8, (c) => "F3:0F101D " + rel32(c.next, C.half)], m: "movss", o: "xmm3,dword ptr ds:[" + constRef(h, "__real@3f000000", C.half) + "]",
      run: (m) => m.setSs(3, m.ldF32(C.half), true),
    },
    {
      b: [8, (c) => "F2:0F100D " + rel32(c.next, C.oneHalf)], m: "movsd", o: "xmm1,qword ptr ds:[" + constRef(h, "__real@3ff8000000000000", C.oneHalf) + "]",
      run: (m) => m.setSd(1, m.ldF64(C.oneHalf), true),
    },
    imm("r8d", "41:B8 02000000", 2),
    mov("ecx", "edi", "8BCF"),
    h.call("mix"),
    { b: "F2:0F114424 20", m: "movsd", o: "qword ptr ss:[rsp+20],xmm0", run: (m) => stX(m, m.sp(0x20), 0) },
    mov("ecx", "edi", "8BCF"),
    { label: "main.shout", ...h.call("shout") },
    { b: "44:8B4C24 38", m: "mov", o: "r9d,dword ptr ss:[rsp+38]", run: (m) => m.set("r9d", m.ld(m.sp(0x38), 4)) },
    mov("r8", "rsi", "4C:8BC6"),
    mov("edx", "ebx", "8BD3"),
    h.strLea("rcx", "48:8D0D", S.fmt, "%d %lld %d %f %d\\n"),
    { b: "894424 28", m: "mov", o: "dword ptr ss:[rsp+28],eax", run: (m) => m.st(m.sp(0x28), 4, "eax") },
    h.call("printf"),
    { label: "main.restoreRbx", b: "48:8B5C24 50", m: "mov", o: "rbx,qword ptr ss:[rsp+50]", run: (m) => m.set("rbx", m.ld(m.sp(0x50), 8)) },
    { label: "main.restoreRsi", b: "48:8B7424 58", m: "mov", o: "rsi,qword ptr ss:[rsp+58]", run: (m) => m.set("rsi", m.ld(m.sp(0x58), 8)) },
    { label: "main.zero", b: "33C0", m: "xor", o: "eax,eax", run: (m) => m.xor("eax", "eax") },
    { b: "48:83C4 40", m: "add", o: "rsp,40", run: (m) => m.add("rsp", 0x40) },
    { label: "main.pop", b: "5F", m: "pop", o: "rdi", run: (m) => m.pop("rdi") },
    { b: "C3", m: "ret", run: (m) => m.ret() },
  ],
};

let cache: ProgramRecordings | undefined;

export function callsReleaseRecordings(): ProgramRecordings {
  cache ??= recordProgram(callsReleaseSpec);
  return cache;
}
