import { describe, expect, it } from "vitest";
import { getLesson, getRecording } from "@pire/content";
import { vault2 } from "@pire/content/src/specimens/vault2";
import { stateOf } from "./debugger";
import { initialState, medal, reduce, type PlayerEvent, type PlayerState } from "./lesson";

const lesson = getLesson("m1.challenge")!;
const go = { type: "continue" } as const;
const key = (k: string, selected: string | null = null): PlayerEvent => ({ type: "key", key: k, ripOffscreen: false, selected });
const step = (s: PlayerState, ...events: PlayerEvent[]) => events.reduce((acc, e) => reduce(lesson, acc, e), s);
const rip = (s: PlayerState) => stateOf(getRecording(s.session.recording), s.session).rip;
const prompt = () => getRecording("vault2-stripped.wrong").strings.find((x) => x.text.startsWith("Vault v2"))!.address;

describe("module 1 challenge", () => {
  it("can be finished with the Module 1 tools and no hints", () => {
    let s = initialState(lesson);
    s = step(s, key("F9"));
    s = step(s, { type: "menu", target: "disasm:" + rip(s), item: "search-strings" }, { type: "dblclick", target: "ref:" + prompt() });
    s = step(s, key("F2", "disasm:" + vault2.main), key("F9"));
    expect(rip(s)).toBe(vault2.main);
    expect(s.lesson.phase).toBe("success");

    s = step(s, go, key("F4", "disasm:" + vault2.callVerify), key("F7"));
    expect(rip(s)).toBe(vault2.verify);
    s = step(s, go, { type: "menu", target: "reg:RCX", item: "follow-dump" }, go);

    s = step(s, key("F4", "disasm:" + vault2.strcmpCall), { type: "menu", target: "reg:RDX", item: "follow-dump" }, go);
    s = step(s, { type: "predict", value: "pirate42" }, go);

    s = step(s, { type: "command", surface: "command", text: "bph " + vault2.g_tries + ",w,4" });
    // Restart stops at the system breakpoint, then the entry breakpoint, then main, then the write.
    s = step(s, key("Ctrl+F2"), key("F9"), key("F9"), key("F9"));
    expect(s.session.message).toMatch(/^Hardware breakpoint/);
    expect(rip(s)).not.toBe(vault2.store);
    s = step(s, go, { type: "predict", value: "0x140005030" }, go);

    expect(s.session.recording).toBe("vault2-stripped.right");
    s = step(s, { type: "command", surface: "command", text: "bp MessageBoxA" });
    for (let i = 0; i < 6 && s.lesson.phase === "asking"; i++) s = step(s, key("F9"));
    expect(rip(s)).toBe(vault2.MessageBoxA);
    s = step(s, go);
    expect(s.lesson.done).toBe(true);
    expect(medal(s.lesson.hintsUsed)).toBe("gold");
  });

  it("accepts stopping on the call site for the check", () => {
    let s = initialState(lesson, { stepIndex: 1 });
    s = step(s, key("F9"), key("F4", "disasm:" + vault2.callVerify));
    expect(s.lesson.phase).toBe("success");
  });

  it("shares three hint tokens across the whole challenge", () => {
    let s = initialState(lesson);
    s = step(s, { type: "hint" }, { type: "hint" }, { type: "hint" }, { type: "hint" });
    expect(s.lesson.hintsUsed).toBe(3);
    s = initialState(lesson, { stepIndex: 1, hintsUsed: 3 });
    s = step(s, { type: "hint" });
    expect(s.lesson.hintsShown).toBe(0);
    expect(medal(3)).toBe("bronze");
    expect(medal(1)).toBe("silver");
  });
});
