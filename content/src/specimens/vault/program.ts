import { rel32 } from "../../machine/machine";
import { q, recordSpecimen, str, type AppSpec, type SpecimenRecordings } from "../msvc";

/*
 * vault.exe: check_code at 140001000, main at 140001070, strings at 140003200. The C source is in
 * source.ts and the lesson docs in docs/lessons/01-debugger-basics.
 */

const D = { SECRET: 0x140005000n, g_attempts: 0x140005040n };

const S = {
  banner: 0x140003200n,
  prompt: 0x140003214n,
  newline: 0x140003224n,
  title: 0x140003228n,
  opened: 0x140003230n,
  denied: 0x140003240n,
  secret: 0x140003250n,
};

export const vaultSpec: AppSpec = {
  exe: "vault",
  strings: [
    [S.banner, "== PIRE VAULT =="],
    [S.prompt, "Enter code: "],
    [S.newline, "\n"],
    [S.title, "PIRE"],
    [S.opened, "Vault opened!"],
    [S.denied, "Access denied."],
    [S.secret, "opensesame"],
  ],
  data: D,
  dataInit: [[D.SECRET, S.secret]],
  functions: ["check_code", "main"],
  globals: ["SECRET", "g_attempts"],
  rows: ({ dat, callImp, call, strLea, dataInfo, jcc, jmp }) => [
    { org: 0x140001000n },
    // int check_code(const char *input)
    { line: 9 },
    { label: "check_code", b: "48:894C24 08", m: "mov", o: "qword ptr ss:[rsp+8],rcx", run: (m) => m.st(m.sp(8), 8, "rcx") },
    { b: "48:83EC 28", m: "sub", o: "rsp,28", run: (m) => m.sub("rsp", 0x28) },
    { line: 10 },
    {
      label: "check_code.load", b: [6, (c) => "8B05 " + rel32(c.next, D.g_attempts)], m: "mov", o: "eax,dword ptr ds:[" + dat("g_attempts") + "]",
      run: (m) => m.set("eax", m.ld(D.g_attempts, 4)), info: dataInfo(4, "g_attempts", "eax"),
    },
    { b: "FFC0", m: "inc", o: "eax", run: (m) => m.inc("eax") },
    {
      label: "check_code.store", b: [6, (c) => "8905 " + rel32(c.next, D.g_attempts)], m: "mov", o: "dword ptr ds:[" + dat("g_attempts") + "],eax",
      run: (m) => m.st(D.g_attempts, 4, "eax"), info: dataInfo(4, "g_attempts", "eax"),
    },
    { line: 11 },
    {
      label: "check_code.secret", b: [7, (c) => "48:8B15 " + rel32(c.next, D.SECRET)], m: "mov", o: "rdx,qword ptr ds:[" + dat("SECRET") + "]",
      run: (m) => m.set("rdx", m.ld(D.SECRET, 8)), info: dataInfo(8, "SECRET", "rdx"),
    },
    {
      b: "48:8B4C24 30", m: "mov", o: "rcx,qword ptr ss:[rsp+30]", run: (m) => m.set("rcx", m.ld(m.sp(0x30), 8)),
      info: (m) => { const v = m.ld(m.sp(0x30), 8); return ["qword ptr [rsp+30]=" + q(v) + " " + str(m, v), "rcx=" + q(m.get("rcx"))]; },
    },
    { label: "check_code.strcmp", ...callImp("strcmp") },
    { b: "85C0", m: "test", o: "eax,eax", run: (m) => m.test("eax", "eax", 32) },
    { b: "0F94C0", m: "sete", o: "al", run: (m) => m.set("al", m.cond("e") ? 1 : 0) },
    { b: "0FB6C0", m: "movzx", o: "eax,al", run: (m) => m.set("eax", m.get("al")) },
    { line: 12 },
    { b: "48:83C4 28", m: "add", o: "rsp,28", run: (m) => m.add("rsp", 0x28) },
    { label: "check_code.ret", b: "C3", m: "ret", run: (m) => m.ret() },

    { org: 0x140001070n, fill: true },
    // int main(void)
    { line: 15 },
    { label: "main", b: "48:83EC 58", m: "sub", o: "rsp,58", run: (m) => m.sub("rsp", 0x58) },
    { line: 18 },
    { label: "main.banner", ...strLea("rcx", "48:8D0D", S.banner, "== PIRE VAULT ==") },
    { label: "main.puts", ...callImp("puts") },
    { line: 19 },
    { label: "main.prompt", ...strLea("rcx", "48:8D0D", S.prompt, "Enter code: ") },
    { label: "main.printf", ...call("printf") },
    { line: 20 },
    { b: "33C9", m: "xor", o: "ecx,ecx", run: (m) => m.xor("ecx", "ecx") },
    callImp("__acrt_iob_func"),
    { b: "4C:8BC0", m: "mov", o: "r8,rax", run: (m) => m.set("r8", m.get("rax")) },
    { b: "BA 20000000", m: "mov", o: "edx,20", c: "20:' '", run: (m) => m.set("edx", 0x20) },
    { b: "48:8D4C24 20", m: "lea", o: "rcx,qword ptr ss:[rsp+20]", run: (m) => m.set("rcx", m.sp(0x20)) },
    { label: "main.fgets", ...callImp("fgets") },
    { b: "48:85C0", m: "test", o: "rax,rax", run: (m) => m.test("rax", "rax") },
    jcc("jne", "75", "ne", "main.trim"),
    { line: 21 },
    { b: "B8 01000000", m: "mov", o: "eax,1", run: (m) => m.set("eax", 1) },
    jmp("main.end"),
    { line: 22 },
    { label: "main.trim", ...strLea("rdx", "48:8D15", S.newline, "\\n") },
    { b: "48:8D4C24 20", m: "lea", o: "rcx,qword ptr ss:[rsp+20]", run: (m) => m.set("rcx", m.sp(0x20)) },
    callImp("strcspn"),
    { b: "C64404 20 00", m: "mov", o: "byte ptr ss:[rsp+rax+20],0", run: (m) => m.st(m.sp(0x20) + m.get("rax"), 1, 0) },
    { line: 24 },
    { b: "48:8D4C24 20", m: "lea", o: "rcx,qword ptr ss:[rsp+20]", run: (m) => m.set("rcx", m.sp(0x20)), info: (m) => ["rcx=" + q(m.sp(0x20)) + " " + str(m, m.sp(0x20))] },
    { label: "main.check", ...call("check_code") },
    { label: "main.test", b: "85C0", m: "test", o: "eax,eax", run: (m) => m.test("eax", "eax", 32) },
    jcc("je", "74", "e", "main.denied"),
    { line: 25 },
    { b: "45:33C9", m: "xor", o: "r9d,r9d", run: (m) => m.xor("r9d", "r9d") },
    strLea("r8", "4C:8D05", S.title, "PIRE"),
    strLea("rdx", "48:8D15", S.opened, "Vault opened!"),
    { b: "33C9", m: "xor", o: "ecx,ecx", run: (m) => m.xor("ecx", "ecx") },
    { label: "main.messagebox", ...callImp("MessageBoxA") },
    { line: 26 },
    { b: "33C0", m: "xor", o: "eax,eax", run: (m) => m.xor("eax", "eax") },
    jmp("main.end"),
    { line: 29 },
    { label: "main.denied", ...strLea("rcx", "48:8D0D", S.denied, "Access denied.") },
    callImp("puts"),
    { line: 30 },
    { b: "B8 01000000", m: "mov", o: "eax,1", run: (m) => m.set("eax", 1) },
    { line: 31 },
    { label: "main.end", b: "48:83C4 58", m: "add", o: "rsp,58", run: (m) => m.add("rsp", 0x58) },
    { label: "main.ret", b: "C3", m: "ret", run: (m) => m.ret() },

  ],
};

export type VaultRecordings = SpecimenRecordings;

let cache: VaultRecordings | undefined;

export function vaultRecordings(): VaultRecordings {
  cache ??= recordSpecimen(vaultSpec, { wrong: "hello", right: "opensesame" });
  return cache;
}
