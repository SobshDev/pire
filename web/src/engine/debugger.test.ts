import { describe, expect, it } from "vitest";
import { getRecording } from "@pire/content";
import { vault } from "@pire/content/src/specimens/vault";
import * as D from "./debugger";
import { indexOfAddress } from "./lesson";

const wrong = getRecording("vault.wrong");
const right = getRecording("vault.right");
const atMain = () => D.newSession(wrong, indexOfAddress(wrong, vault.main));
const rip = (s: D.Session, rec = wrong) => D.stateOf(rec, s).rip;
const steps = (s: D.Session, n: number, f: (r: typeof wrong, s: D.Session) => D.Session) => {
  for (let i = 0; i < n; i++) s = f(wrong, s);
  return s;
};

describe("debugger session over the vault recording", () => {
  it("starts at the system breakpoint and runs to the entry point", () => {
    const s = D.newSession(wrong);
    expect(s.message).toBe("System breakpoint reached!");
    const entry = D.run(wrong, s);
    expect(rip(entry)).toBe(vault.mainCRTStartup);
    expect(entry.message).toMatch(/entry breakpoint/);
  });

  it("steps over puts and prints the banner", () => {
    let s = steps(atMain(), 2, D.stepOver);
    expect(rip(s)).toBe(vault["main.puts"]);
    s = D.stepOver(wrong, s);
    expect(rip(s)).toBe(vault["main.prompt"]);
    expect(D.consoleText(wrong, s.index)).toBe("== PIRE VAULT ==\n");
  });

  it("falls into printf with F7 and climbs out with Ctrl+F9 then F8", () => {
    let s = steps(atMain(), 4, D.stepOver);
    expect(rip(s)).toBe(vault["main.printf"]);
    s = D.stepInto(wrong, s);
    expect(rip(s)).toBe(vault.printf);
    s = D.runToReturn(wrong, s);
    expect(rip(s)).toBe(vault["printf.ret"]);
    s = D.stepOver(wrong, s);
    expect(D.rowAt(wrong, rip(s))?.row.mnemonic).toBe("xor");
    expect(D.consoleText(wrong, s.index)).toContain("Enter code: ");
  });

  it("runs to the cursor through fgets", () => {
    const s = D.runToCursor(wrong, atMain(), vault["main.check"]);
    expect(rip(s)).toBe(vault["main.check"]);
    expect(D.consoleText(wrong, s.index)).toBe("== PIRE VAULT ==\nEnter code: hello\n");
  });

  it("stops on a software breakpoint and shows check_code's answer", () => {
    let s = D.toggleBreakpoint(wrong, atMain(), vault["main.test"]);
    s = D.run(wrong, s);
    expect(rip(s)).toBe(vault["main.test"]);
    expect(s.message).toBe("INT3 breakpoint at vault.main+65 (" + vault["main.test"] + ")!");
    expect(D.stateOf(wrong, s).regs.RAX!.endsWith("00000000")).toBe(true);
  });

  it("fires a hardware write breakpoint one line after the write", () => {
    let s = D.command(wrong, atMain(), "bph g_attempts, w, 4").session;
    s = D.run(wrong, s);
    expect(rip(s)).toBe(vault["check_code.secret"]);
    expect(s.message).toMatch(/^Hardware breakpoint \(dword, write\) at vault.g_attempts/);
    expect(D.readByte(wrong, s.index, 0x140005040n)).toBe(1);
    expect(D.readByte(wrong, s.prev, 0x140005040n)).toBe(0);
  });

  it("breaks on MessageBoxA by name with the arguments ready", () => {
    let s = D.newSession(right, indexOfAddress(right, vault.main));
    const r = D.command(right, s, "bp MessageBoxA");
    expect(r.ok).toBe(true);
    s = D.run(right, r.session);
    const st = D.stateOf(right, s);
    expect(D.moduleOf(right, st.rip)?.name).toBe("user32.dll");
    expect(D.describe(right, s.index, st.regs.RDX!)).toBe('"Vault opened!"');
    expect(D.describe(right, s.index, st.regs.R8!)).toBe('"PIRE"');
    expect(st.dialog).toBeUndefined();
  });

  it("runs to the end when nothing is in the way", () => {
    const s = D.run(wrong, atMain());
    expect(D.stateOf(wrong, s).terminated).toEqual({ code: 1 });
    expect(D.run(wrong, s)).toMatchObject({ index: s.index });
  });

  it("labels return addresses on the stack", () => {
    const s = atMain();
    const top = D.readQword(wrong, s.index, D.big(D.stateOf(wrong, s).regs.RSP!))!;
    expect(D.describe(wrong, s.index, D.pad(top), true)).toMatch(/^return to vault.__scrt_common_main_seh\+/);
  });

  it("resolves names, registers, and hex", () => {
    const s = atMain();
    expect(D.resolve(wrong, s, "user32.MessageBoxA")).toBe(D.resolve(wrong, s, "messageboxa"));
    expect(D.resolve(wrong, s, "rip")).toBe(vault.main);
    expect(D.resolve(wrong, s, "0x140003200")).toBe("0000000140003200");
    expect(D.resolve(wrong, s, "nope")).toBeNull();
  });

  it("hides vault names in the stripped build", () => {
    const stripped = getRecording("vault-stripped.wrong");
    expect(D.symbolize(stripped, vault.main)).toBe("vault." + vault.main);
    expect(D.symbolize(wrong, vault.main)).toBe("vault.main");
  });
});
