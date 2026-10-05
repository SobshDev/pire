import { describe, expect, it } from "vitest";
import { getLesson, getRecording } from "@pire/content";
import { calls } from "@pire/content/src/specimens/calls";
import { stateOf } from "./debugger";
import { initialState, reduce, type PlayerEvent, type PlayerState } from "./lesson";
import { xmmLane } from "../player/debugger/Registers";

const lesson = getLesson("m3.l5")!;
const rec = getRecording("calls");
const go = { type: "continue" } as const;
const run = (s: PlayerState, ...events: PlayerEvent[]) => events.reduce((acc, e) => reduce(lesson, acc, e), s);
const click = (target: string) => ({ type: "click", target }) as const;
const key = (k: string) => ({ type: "key", key: k, ripOffscreen: false, selected: null }) as const;
const fill = (values: Record<string, string>) => ({ type: "fill", values }) as const;

describe("lesson 3.5", () => {
  it("plays through", () => {
    let s = initialState(lesson);
    s = run(s, click("reg:XMM0"), go, { type: "choose", id: "xmm0" });
    expect(s.lesson.feedback?.text).toMatch(/Linux/);
    s = run(s, { type: "choose", id: "xmm1" }, go);
    s = run(s, fill({ a: "ECX", b: "XMM1", c: "R8D", d: "XMM3" }));
    s = run(s, fill({ l1: "d", l2: "c", l3: "b", l4: "a" }), go, fill({ ss: "float", sd: "double" }), go);
    const at = stateOf(rec, s.session);
    expect(at.rip).toBe(calls["main.mix"]);
    expect(xmmLane(at.regs.XMM1!)).toBe("double 1.5");
    expect(xmmLane(at.regs.XMM3!)).toBe("float 0.5");
    s = run(s, fill({ b: "1.5", d: ".5" }), key("F8"));
    expect(stateOf(rec, s.session).rip).toBe(calls["main.r4"]);
    expect(xmmLane(stateOf(rec, s.session).regs.XMM0!)).toBe("double 5.5");
    s = run(s, fill({ r: "5.5" }), go);
    expect(stateOf(rec, s.session).rip).toBe(calls.mix);
    s = run(s, click("disasm:" + calls["mix.a"]), go);
    s = run(s, fill({ x: "XMM0", y: "EDX", z: "XMM2", p: "R9" }), { type: "choose", id: "xmm0" }, { type: "choose", id: "double" });
    s = run(s, fill({ p1: "float", p2: "int", p3: "float" }));
    expect(s.lesson.done).toBe(true);
  });
});
