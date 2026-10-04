import { rel32 } from "../../machine/machine";
import { q, recordSpecimen, str, type AppSpec, type SpecimenRecordings } from "../msvc";

/*
 * vault2.exe, the Module 1 challenge: verify at 140001000, main at 140001050. Same idea as vault.exe
 * with a new secret, a try counter, and different addresses so Module 1 can't be replayed from memory.
 */

const D = { SECRET: 0x140005000n, g_tries: 0x140005030n };

const S = {
  prompt: 0x140003200n,
  newline: 0x140003218n,
  title: 0x140003220n,
  opened: 0x140003228n,
  denied: 0x140003238n,
  secret: 0x140003240n,
};

export const vault2Spec: AppSpec = {
  exe: "vault2",
  strings: [
    [S.prompt, "Vault v2 - code: "],
    [S.newline, "\n"],
    [S.title, "PIRE"],
    [S.opened, "You're in."],
    [S.denied, "Nope."],
    [S.secret, "pirate42"],
  ],
  data: D,
  dataInit: [[D.SECRET, S.secret]],
  functions: ["verify", "main"],
  globals: ["SECRET", "g_tries"],
  rows: ({ dat, callImp, call, strLea, dataInfo, jcc, jmp }) => [
    { org: 0x140001000n },
    // static int verify(const char *input)
    { label: "verify", b: "48:894C24 08", m: "mov", o: "qword ptr ss:[rsp+8],rcx", run: (m) => m.st(m.sp(8), 8, "rcx") },
    { b: "48:83EC 28", m: "sub", o: "rsp,28", run: (m) => m.sub("rsp", 0x28) },
    {
      label: "verify.load", b: [6, (c) => "8B05 " + rel32(c.next, D.g_tries)], m: "mov", o: "eax,dword ptr ds:[" + dat("g_tries") + "]",
      run: (m) => m.set("eax", m.ld(D.g_tries, 4)), info: dataInfo(4, "g_tries", "eax"),
    },
    { b: "FFC0", m: "inc", o: "eax", run: (m) => m.inc("eax") },
    {
      label: "verify.store", b: [6, (c) => "8905 " + rel32(c.next, D.g_tries)], m: "mov", o: "dword ptr ds:[" + dat("g_tries") + "],eax",
      run: (m) => m.st(D.g_tries, 4, "eax"), info: dataInfo(4, "g_tries", "eax"),
    },
    {
      label: "verify.limit", b: [7, (c) => "833D " + rel32(c.next, D.g_tries) + " 03"], m: "cmp", o: "dword ptr ds:[" + dat("g_tries") + "],3",
      run: (m) => m.cmp(m.ld(D.g_tries, 4), 3n, 32), info: dataInfo(4, "g_tries", "eax"),
    },
    jcc("jle", "7E", "le", "verify.compare"),
    { b: "33C0", m: "xor", o: "eax,eax", run: (m) => m.xor("eax", "eax") },
    jmp("verify.end"),
    {
      label: "verify.compare", b: [7, (c) => "48:8B15 " + rel32(c.next, D.SECRET)], m: "mov", o: "rdx,qword ptr ds:[" + dat("SECRET") + "]",
      run: (m) => m.set("rdx", m.ld(D.SECRET, 8)), info: dataInfo(8, "SECRET", "rdx"),
    },
    {
      b: "48:8B4C24 30", m: "mov", o: "rcx,qword ptr ss:[rsp+30]", run: (m) => m.set("rcx", m.ld(m.sp(0x30), 8)),
      info: (m) => { const v = m.ld(m.sp(0x30), 8); return ["qword ptr [rsp+30]=" + q(v) + " " + str(m, v), "rcx=" + q(m.get("rcx"))]; },
    },
    { label: "verify.strcmp", ...callImp("strcmp") },
    { b: "85C0", m: "test", o: "eax,eax", run: (m) => m.test("eax", "eax", 32) },
    { b: "0F94C0", m: "sete", o: "al", run: (m) => m.set("al", m.cond("e") ? 1 : 0) },
    { b: "0FB6C0", m: "movzx", o: "eax,al", run: (m) => m.set("eax", m.get("al")) },
    { label: "verify.end", b: "48:83C4 28", m: "add", o: "rsp,28", run: (m) => m.add("rsp", 0x28) },
    { label: "verify.ret", b: "C3", m: "ret", run: (m) => m.ret() },

    { org: 0x140001050n, fill: true },
    // int main(void)
    { label: "main", b: "48:83EC 58", m: "sub", o: "rsp,58", run: (m) => m.sub("rsp", 0x58) },
    { label: "main.prompt", ...strLea("rcx", "48:8D0D", S.prompt, "Vault v2 - code: ") },
    { label: "main.printf", ...call("printf") },
    { b: "33C9", m: "xor", o: "ecx,ecx", run: (m) => m.xor("ecx", "ecx") },
    callImp("__acrt_iob_func"),
    { b: "4C:8BC0", m: "mov", o: "r8,rax", run: (m) => m.set("r8", m.get("rax")) },
    { b: "BA 20000000", m: "mov", o: "edx,20", c: "20:' '", run: (m) => m.set("edx", 0x20) },
    { b: "48:8D4C24 20", m: "lea", o: "rcx,qword ptr ss:[rsp+20]", run: (m) => m.set("rcx", m.sp(0x20)) },
    { label: "main.fgets", ...callImp("fgets") },
    { b: "48:85C0", m: "test", o: "rax,rax", run: (m) => m.test("rax", "rax") },
    jcc("jne", "75", "ne", "main.trim"),
    { b: "B8 01000000", m: "mov", o: "eax,1", run: (m) => m.set("eax", 1) },
    jmp("main.end"),
    { label: "main.trim", ...strLea("rdx", "48:8D15", S.newline, "\\n") },
    { b: "48:8D4C24 20", m: "lea", o: "rcx,qword ptr ss:[rsp+20]", run: (m) => m.set("rcx", m.sp(0x20)) },
    callImp("strcspn"),
    { b: "C64404 20 00", m: "mov", o: "byte ptr ss:[rsp+rax+20],0", run: (m) => m.st(m.sp(0x20) + m.get("rax"), 1, 0) },
    { b: "48:8D4C24 20", m: "lea", o: "rcx,qword ptr ss:[rsp+20]", run: (m) => m.set("rcx", m.sp(0x20)), info: (m) => ["rcx=" + q(m.sp(0x20)) + " " + str(m, m.sp(0x20))] },
    { label: "main.check", ...call("verify") },
    { label: "main.test", b: "85C0", m: "test", o: "eax,eax", run: (m) => m.test("eax", "eax", 32) },
    jcc("je", "74", "e", "main.denied"),
    { b: "45:33C9", m: "xor", o: "r9d,r9d", run: (m) => m.xor("r9d", "r9d") },
    strLea("r8", "4C:8D05", S.title, "PIRE"),
    strLea("rdx", "48:8D15", S.opened, "You're in."),
    { b: "33C9", m: "xor", o: "ecx,ecx", run: (m) => m.xor("ecx", "ecx") },
    { label: "main.messagebox", ...callImp("MessageBoxA") },
    { b: "33C0", m: "xor", o: "eax,eax", run: (m) => m.xor("eax", "eax") },
    jmp("main.end"),
    { label: "main.denied", ...strLea("rcx", "48:8D0D", S.denied, "Nope.") },
    callImp("puts"),
    { b: "B8 01000000", m: "mov", o: "eax,1", run: (m) => m.set("eax", 1) },
    { label: "main.end", b: "48:83C4 58", m: "add", o: "rsp,58", run: (m) => m.add("rsp", 0x58) },
    { label: "main.ret", b: "C3", m: "ret", run: (m) => m.ret() },

  ],
};

export type Vault2Recordings = SpecimenRecordings;

let cache: Vault2Recordings | undefined;

export function vault2Recordings(): Vault2Recordings {
  cache ??= recordSpecimen(vault2Spec, { wrong: "letmein", right: "pirate42" });
  return cache;
}

