import { describe, expect, it } from "vitest";
import { getLesson, getRecording } from "@pire/content";
import { calls } from "@pire/content/src/specimens/calls";
import { stateOf } from "./debugger";
import { initialState, reduce, type PlayerEvent, type PlayerState } from "./lesson";

const lesson = getLesson("m3.l3")!;
const rec = getRecording("calls");
const go = { type: "continue" } as const;
const run = (s: PlayerState, ...events: PlayerEvent[]) => events.reduce((acc, e) => reduce(lesson, acc, e), s);
const click = (target: string) => ({ type: "click", target }) as const;
const key = (k: string) => ({ type: "key", key: k, ripOffscreen: false, selected: null }) as const;
const short = (h: string) => h.replace(/^0+/, "");

describe("lesson 3.3", () => {
  it("plays through the round trip", () => {
    let s = initialState(lesson);
    s = run(s, { type: "predict", value: "14FE78" });
    expect(s.lesson.feedback?.text).toMatch(/down/);
    s = run(s, { type: "predict", value: "14FE68" }, go, key("F7"));
    expect(stateOf(rec, s.session).rip).toBe(calls.scale);
    expect(stateOf(rec, s.session).regs.RSP).toBe("000000000014FE68");
    s = run(s, go, { type: "menu", target: "stack:000000000014FE68", item: "follow-disasm" }, go, key("*"));
    s = run(s, click("disasm:" + calls.scale), click("disasm:" + calls["scale.sub"]), go);
    expect(stateOf(rec, s.session).rip).toBe(calls["scale.call"]);
    s = run(s, key("F7"));
    expect(stateOf(rec, s.session).rip).toBe(calls.add);
    s = run(s, go);
    s = run(s, key("Ctrl+F9"));
    expect(stateOf(rec, s.session).rip).toBe(calls["add.ret"]);
    expect(stateOf(rec, s.session).regs.RSP).toBe("000000000014FE28");
    s = run(s, go);
    s = run(s, { type: "fill", values: { rip: short(calls["scale.after"]), rsp: "14FE30" } }, go, key("F7"));
    expect(stateOf(rec, s.session).rip).toBe(calls["scale.after"]);
    expect(stateOf(rec, s.session).regs.RSP).toBe("000000000014FE30");
    s = run(s, go);
    expect(stateOf(rec, s.session).rip).toBe(calls["scale.epilogue"]);
    s = run(s, key("F8"), click("stack:000000000014FE68"), go, key("F7"));
    expect(stateOf(rec, s.session).rip).toBe(calls["main.r3"]);
    expect(stateOf(rec, s.session).regs.RSP).toBe("000000000014FE70");
    s = run(s, go, go);
    expect(s.session.recording).toBe("calls-stripped");
    s = run(s, click("disasm:" + calls["sum6.ret"]), click("disasm:" + calls.scale), click("disasm:" + calls["scale.ret"]), go);
    s = run(s, { type: "fill", values: { rsp: "14FE58", top: "The address after the call" } }, { type: "predict", value: "140001234" });
    s = run(s, { type: "fill", values: { a: "Prologue", b: "Prologue", c: "Body", d: "Epilogue", e: "Epilogue", f: "Epilogue" } }, { type: "choose", id: "add" });
    expect(s.lesson.done).toBe(true);
  });
});
