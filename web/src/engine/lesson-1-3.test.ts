import { describe, expect, it } from "vitest";
import { getLesson, getRecording } from "@pire/content";
import { sym, vault } from "@pire/content/src/specimens/vault";
import { big, consoleText, pad, readByte, readString, rowAt, stateOf } from "./debugger";
import { initialState, reduce, type PlayerEvent, type PlayerState } from "./lesson";

const lesson = getLesson("m1.l3")!;
const go = { type: "continue" } as const;
const key = (k: string, selected: string | null = null): PlayerEvent => ({ type: "key", key: k, ripOffscreen: false, selected });
const step = (s: PlayerState, ...events: PlayerEvent[]) => events.reduce((acc, e) => reduce(lesson, acc, e), s);
const rec = (s: PlayerState) => getRecording(s.session.recording);
const st = (s: PlayerState) => stateOf(rec(s), s.session);

describe("lesson 1.3", () => {
  it("plays through with what the text promises", () => {
    let s = step(initialState(lesson), go, key("F2", "disasm:" + vault["main.test"]));
    expect(s.session.breakpoints).toHaveLength(1);

    s = step(s, go, key("F9"));
    expect(st(s).rip).toBe(vault["main.test"]);
    expect(s.session.message).toMatch(/^INT3 breakpoint/);
    expect(consoleText(rec(s), s.session.index)).toContain("Enter code: hello");
    expect(big(st(s).regs.RAX!) & 0xffffffffn).toBe(0n);

    s = step(s, go, { type: "predict", value: "0" }, go, go);
    expect(s.session.recording).toBe("vault.right");
    expect(st(s).rip).toBe(vault.main);

    s = step(s, { type: "command", surface: "command", text: "bp messageboxa" });
    expect(s.session.breakpoints.map((b) => b.address)).toContain(sym.MessageBoxA);
    expect(s.session.log.at(-1)).toMatch(/MessageBoxA/);

    // First F9 stops at the old breakpoint, the second reaches MessageBoxA.
    s = step(s, go, key("F9"));
    expect(st(s).rip).toBe(vault["main.test"]);
    expect(s.lesson.phase).toBe("asking");
    s = step(s, key("F9"));
    expect(st(s).rip).toBe(sym.MessageBoxA);
    expect(s.lesson.phase).toBe("success");
    expect(readString(rec(s), s.session.index, big(st(s).regs.RDX!))).toBe("Vault opened!");
    expect(readString(rec(s), s.session.index, big(st(s).regs.R8!))).toBe("PIRE");

    s = step(s, go, { type: "choose", id: "first" }, go);
    expect(s.session.recording).toBe("vault.wrong");
    // Ctrl+G with a disassembly line selected follows in the disassembler, which doesn't finish the step.
    s = step(s, key("Ctrl+G", "disasm:" + vault.main));
    expect(s.session.goto).toBe("disassembly");
    s = step(s, { type: "command", surface: "goto", text: "g_attempts" });
    expect(s.lesson.phase).toBe("asking");
    expect(s.session.goto).toBeNull();
    expect(s.session.dump).toBe("0000000140003200");
    expect(s.lesson.feedback?.text).toMatch(/Click a byte in the dump/);
    s = step(s, key("Ctrl+G", "dump:byte:0000000140003200"));
    expect(s.session.goto).toBe("dump");
    s = step(s, { type: "command", surface: "goto", text: "g_attempts" });
    expect(s.session.dump).toBe(sym.g_attempts);

    // Ctrl+G keeps working after the step, so a wrong jump can be fixed.
    s = step(s, key("Ctrl+G", "dump:byte:" + sym.g_attempts));
    s = step(s, { type: "command", surface: "goto", text: "0000000140003200" });
    expect(s.session.dump).toBe("0000000140003200");
    s = step(s, key("Ctrl+G", "dump:byte:0000000140003200"));
    s = step(s, { type: "command", surface: "goto", text: "g_attempts" });
    expect(s.session.dump).toBe(sym.g_attempts);

    s = step(s, go, { type: "menu", target: "dump:byte:" + sym.g_attempts, item: "hw-write-4" });
    expect(s.session.breakpoints.find((b) => b.kind === "hardware")?.size).toBe(4);

    s = step(s, go, key("F9"));
    expect(s.session.message).toMatch(/^Hardware breakpoint \(dword, write\)/);
    expect(readByte(rec(s), s.session.index, big(sym.g_attempts))).toBe(1);
    expect(rowAt(rec(s), vault["check_code.store"])?.row.mnemonic).toBe("mov");
    expect(st(s).rip).toBe(pad(big(vault["check_code.store"]) + 6n));

    s = step(s, go);
    expect(s.session.tab).toBe("Breakpoints");
    s = step(s, key("Space", "bp:software:" + vault["main.test"]), go, key("Delete", "bp:hardware:" + sym.g_attempts), go);
    expect(s.session.breakpoints.map((b) => [b.address, b.enabled])).toEqual([
      [vault["main.test"], false],
      [sym.MessageBoxA, true],
    ]);

    s = step(s, ...["api", "hw", "f2"].map((id) => ({ type: "choose", id }) as const), go);
    s = step(s, { type: "choose", id: "after" }, go, { type: "choose", id: "never" }, go);
    expect(s.lesson.done).toBe(true);
    expect(s.lesson.mistakes).toBe(0);
    expect(s.lesson.keys).toEqual(["F2", "Ctrl+G", "Space", "Delete"]);
  });

  it("explains a wrong hardware size", () => {
    const s = step(initialState(lesson, { stepIndex: 9 }), { type: "menu", target: "dump:byte:" + sym.g_attempts, item: "hw-write-1" });
    expect(s.lesson.feedback?.text).toMatch(/Dword/);
  });
});
