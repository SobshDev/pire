import { describe, expect, it } from "vitest";
import { getLesson, getRecording } from "@pire/content";
import { calls } from "@pire/content/src/specimens/calls";
import { stateOf } from "./debugger";
import { initialState, reduce, type PlayerEvent, type PlayerState } from "./lesson";

const lesson = getLesson("m3.l1")!;
const rec = getRecording("calls");
const go = { type: "continue" } as const;
const run = (s: PlayerState, ...events: PlayerEvent[]) => events.reduce((acc, e) => reduce(lesson, acc, e), s);
const click = (target: string) => ({ type: "click", target }) as const;
const key = (k: string) => ({ type: "key", key: k, ripOffscreen: false, selected: null }) as const;

describe("lesson 3.1", () => {
  it("runs calls.exe to the expected output", () => {
    const out = rec.states.map((s) => s.out ?? "").join("");
    expect(out).toBe("PIRE!\nPIRE!\nPIRE!\n8 19 18 5.500000 3\n");
  });

  it("plays through", () => {
    let s = initialState(lesson);
    expect(stateOf(rec, s.session).rip).toBe(calls["main.add"]);
    s = run(s, { type: "choose", id: "rcx" }, go);
    for (const r of ["RCX", "RDX", "R8", "R9"]) s = run(s, { type: "order", label: r });
    s = run(s, go, { type: "fill", values: { a: "3", b: "5" } }, go);
    s = run(s, { type: "predict", value: "AB00000003" });
    expect(s.lesson.feedback?.text).toMatch(/upper half/);
    s = run(s, { type: "predict", value: "3" }, go, { type: "predict", value: "8" }, go);
    s = run(s, key("F8"));
    expect(stateOf(rec, s.session).regs.RAX).toBe("0000000000000008");
    s = run(s, go);
    expect(stateOf(rec, s.session).rip).toBe(calls.add);
    s = run(s, click("disasm:" + calls["add.load"]));
    expect(s.lesson.feedback?.tone).toBe("wrong");
    s = run(s, click("disasm:" + calls["add.add"]), go);
    for (const l of ["a", "b", "c", "d"]) s = run(s, click("disasm:" + calls[("main.sum6." + l) as "main.sum6.a"]));
    s = run(s, go, click("disasm:" + calls["main.sum6.e"]), click("disasm:" + calls["main.sum6.f"]), go);
    s = run(s, click("stack:000000000014FE90"), click("stack:000000000014FE98"), go, key("F8"));
    expect(stateOf(rec, s.session).regs.RAX).toBe("0000000000000013");
    s = run(s, go, { type: "choose", id: "right" }, { type: "choose", id: "20" }, { type: "predict", value: "2" }, { type: "choose", id: "rax" });
    expect(s.lesson.done).toBe(true);
  });
});

