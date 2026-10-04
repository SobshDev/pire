import { describe, expect, it } from "vitest";
import { getLesson, getRecording } from "@pire/content";
import { vault } from "@pire/content/src/specimens/vault";
import { consoleText, pad, readQword, readString, stateOf, symbolize, big } from "./debugger";
import { initialState, reduce, type PlayerEvent, type PlayerState } from "./lesson";

const lesson = getLesson("m1.l2")!;
const rec = getRecording("vault.wrong");
const go = { type: "continue" } as const;
const key = (k: string, selected: string | null = null): PlayerEvent => ({ type: "key", key: k, ripOffscreen: false, selected });
const step = (s: PlayerState, ...events: PlayerEvent[]) => events.reduce((acc, e) => reduce(lesson, acc, e), s);
const rip = (s: PlayerState) => stateOf(rec, s.session).rip;
const reg = (s: PlayerState, r: string) => stateOf(rec, s.session).regs[r]!;
const out = (s: PlayerState) => consoleText(rec, s.session.index);

describe("lesson 1.2", () => {
  it("plays through with what the text promises", () => {
    let s = initialState(lesson);
    expect(rip(s)).toBe(vault.main);

    s = step(s, { type: "choose", id: "no" }, go);
    const rsp0 = big(reg(s, "RSP"));
    s = step(s, key("F8"));
    expect(rsp0 - big(reg(s, "RSP"))).toBe(0x58n);
    s = step(s, go, { type: "click", target: "reg:RCX" }, go, key("F8"));
    expect(reg(s, "RCX")).toBe("0000000140003200");
    expect(readString(rec, s.session.index, 0x140003200n)).toBe("== PIRE VAULT ==");
    expect(rip(s)).toBe(vault["main.puts"]);
    expect(out(s)).toBe("");

    s = step(s, go, key("F8"));
    expect(out(s)).toContain("== PIRE VAULT ==");
    s = step(s, go, key("F8"));
    expect(readString(rec, s.session.index, big(reg(s, "RCX")))).toBe("Enter code: ");
    expect(rip(s)).toBe(vault["main.printf"]);

    s = step(s, go, key("F7"));
    expect(rip(s)).toBe(vault.printf);
    s = step(s, go, key("Ctrl+F9"));
    expect(rip(s)).toBe(vault["printf.ret"]);
    s = step(s, go, key("F8"));
    expect(symbolize(rec, rip(s))).toMatch(/^vault\.main\+/);
    expect(out(s)).toContain("Enter code: ");

    s = step(s, go, key("F4", "disasm:" + vault["main.check"]));
    expect(rip(s)).toBe(vault["main.check"]);
    expect(out(s)).toContain("Enter code: hello");

    s = step(s, go, key("F7"));
    expect(rip(s)).toBe(vault.check_code);
    const ret = readStack(s);
    expect(symbolize(rec, ret)).toBe("vault.main+65");

    s = step(s, go, key("F9"));
    expect(out(s)).toContain("Access denied.");
    expect(stateOf(rec, s.session).terminated).toBeTruthy();

    s = step(s, go, ...["F7", "F8", "out", "F4"].map((id) => ({ type: "choose", id }) as const), go);
    expect(rip(s)).toBe(vault["check_code.load"]);
    s = step(s, { type: "click", target: "reg:RAX" }, go, { type: "choose", id: "inside" }, go);

    expect(s.lesson.done).toBe(true);
    expect(s.lesson.mistakes).toBe(0);
    expect(s.lesson.keys).toEqual(["F8", "F7", "Ctrl+F9", "F4", "F9"]);
  });

  it("nudges F8 toward F7 on the printf call", () => {
    const s = initialState(lesson, { stepIndex: 6 });
    const after = step(s, key("F8"));
    expect(after.lesson.feedback?.text).toMatch(/F7/);
    expect(after.session.index).toBe(s.session.index);
  });

  it("asks for a selection before F4", () => {
    const s = step(initialState(lesson, { stepIndex: 9 }), key("F4"));
    expect(s.lesson.feedback?.tone).toBe("info");
  });
});

function readStack(s: PlayerState): string {
  return pad(readQword(rec, s.session.index, big(reg(s, "RSP")))!);
}
