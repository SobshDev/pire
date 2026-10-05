import { describe, expect, it } from "vitest";
import { getLesson, getRecording } from "@pire/content";
import { calls } from "@pire/content/src/specimens/calls";
import { stateOf } from "./debugger";
import { initialState, reduce, type PlayerEvent, type PlayerState } from "./lesson";

const lesson = getLesson("m3.l2")!;
const rec = getRecording("calls");
const go = { type: "continue" } as const;
const run = (s: PlayerState, ...events: PlayerEvent[]) => events.reduce((acc, e) => reduce(lesson, acc, e), s);
const click = (target: string) => ({ type: "click", target }) as const;
const SLOTS = ["Shadow space for add", "doubled", "Padding", "Return address to main", "x, in scale's home slot"];

describe("lesson 3.2", () => {
  it("tells the truth about the frames", () => {
    const at = (l: string) => rec.states.find((x) => x.rip === calls[l])!;
    expect(at("main.add").regs.RSP!.endsWith("0")).toBe(true);
    expect(at("add").regs.RSP!.endsWith("8")).toBe(true);
    expect(at("scale").regs.RSP!.endsWith("8")).toBe(true);
    expect(at("scale.call").regs.RSP!.endsWith("0")).toBe(true);
  });

  it("plays through", () => {
    let s = initialState(lesson);
    s = run(s, go, click("stack:000000000014FE90"));
    expect(s.lesson.feedback?.tone).toBe("wrong");
    for (const a of ["70", "78", "80", "88"]) s = run(s, click("stack:000000000014FE" + a));
    s = run(s, go);
    expect(stateOf(rec, s.session).rip).toBe(calls.add);
    s = run(s, { type: "choose", id: "ret" }, go);
    s = run(s, { type: "fill", values: { a: "Aligned", b: "Not aligned", c: "Aligned", d: "Not aligned" } }, go);
    s = run(s, { type: "predict", value: "20" });
    expect(s.lesson.feedback?.text).toMatch(/Add 8 more/);
    s = run(s, { type: "predict", value: "28" }, go, { type: "choose", id: "yes" }, go);
    expect(stateOf(rec, s.session).rip).toBe(calls["scale.call"]);
    s = run(s, { type: "fill", values: { shadow: SLOTS[0]!, local: SLOTS[1]!, pad: SLOTS[2]!, ret: SLOTS[3]!, home: SLOTS[4]! } }, go);
    s = run(s, { type: "choose", id: "moved" }, go, { type: "predict", value: "28" }, { type: "predict", value: "28" });
    expect(s.lesson.feedback?.text).toMatch(/push already/);
    s = run(s, { type: "predict", value: "20" }, { type: "choose", id: "28" }, { type: "choose", id: "no" }, go);
    expect(s.lesson.done).toBe(true);
  });
});

