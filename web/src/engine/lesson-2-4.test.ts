import { describe, expect, it } from "vitest";
import { getLesson, getRecording } from "@pire/content";
import { vault } from "@pire/content/src/specimens/vault";
import { callStack } from "./debugger";
import { initialState, reduce, type PlayerEvent, type PlayerState } from "./lesson";

const lesson = getLesson("m2.l4")!;
const rec = getRecording("vault-stripped.wrong");
const go = { type: "continue" } as const;
const run = (s: PlayerState, ...events: PlayerEvent[]) => events.reduce((acc, e) => reduce(lesson, acc, e), s);
const items = (s: PlayerState) => (lesson.steps[s.lesson.stepIndex]!.gate as { items: string[] }).items;

describe("lesson 2.4", () => {
  it("has a log, a memory map, and a call stack to read", () => {
    const log = rec.log!;
    expect(log.findIndex((l) => l.endsWith("user32.dll"))).toBeGreaterThan(0);
    expect(log.at(-1)).toBe("System breakpoint reached!");
    const prot = (info: string) => rec.memoryMap!.find((r) => r.info === info && r.address.startsWith("00000001400"))!.protection;
    expect([prot('".text"'), prot('".rdata"'), prot('".data"')]).toEqual(["ER---", "-R---", "-RW--"]);
  });

  it("plays through, and the call stack at main reaches back to ntdll", () => {
    let s = initialState(lesson);
    s = run(s, go, go);
    expect(s.session.tab).toBe("Log");
    s = run(s, { type: "click", target: "log:0" });
    expect(s.lesson.feedback?.tone).toBe("wrong");
    const u = rec.log!.findIndex((l) => l.endsWith("user32.dll"));
    s = run(s, { type: "click", target: "log:" + u }, go);
    s = run(s, { type: "choose", id: "no" }, go);
    expect(s.session.tab).toBe("Memory Map");
    s = run(s, { type: "fill", values: { text: "ER---", rdata: "-R---", data: "-RW--" } }, go);
    for (const item of items(s)) s = run(s, { type: "order", label: item });
    s = run(s, go);
    expect(s.session.tab).toBe("CPU");
    const frames = callStack(rec, s.session);
    expect(frames[0]!.to).toBe(vault.main);
    const comments = frames.map((f) => f.comment).join("\n");
    expect(comments).toMatch(/BaseThreadInitThunk/);
    expect(comments).toMatch(/RtlUserThreadStart/);
    expect(frames.length).toBeGreaterThanOrEqual(4);
    s = run(s, { type: "tab", tab: "Call Stack" }, go, go);
    for (const item of items(s)) s = run(s, { type: "order", label: item });
    s = run(s, { type: "choose", id: "loader" }, { type: "choose", id: "data" });
    expect(s.lesson.done).toBe(true);
  });
});

