import { describe, expect, it } from "vitest";
import { getLesson, getRecording } from "@pire/content";
import { callsReleaseRecordings } from "@pire/content/src/specimens/calls/release";
import { stateOf } from "./debugger";
import { initialState, reduce, type PlayerEvent, type PlayerState } from "./lesson";

const lesson = getLesson("m3.l4")!;
const rec = getRecording("calls-release");
const at = callsReleaseRecordings().at;
const go = { type: "continue" } as const;
const run = (s: PlayerState, ...events: PlayerEvent[]) => events.reduce((acc, e) => reduce(lesson, acc, e), s);
const click = (target: string) => ({ type: "click", target }) as const;
const d = (label: string) => click("disasm:" + at[label]);
const key = (k: string) => ({ type: "key", key: k, ripOffscreen: false, selected: null }) as const;
const SORT = { rax: "Volatile", rbx: "Nonvolatile", rcx: "Volatile", rdi: "Nonvolatile", r8: "Volatile", rsi: "Nonvolatile", r11: "Volatile", r12: "Nonvolatile" };
const SORT2 = { rax: "Volatile", rbx: "Nonvolatile", rcx: "Volatile", rsi: "Nonvolatile", r9: "Volatile", r12: "Nonvolatile", r11: "Volatile", rdi: "Nonvolatile" };

describe("lesson 3.4", () => {
  it("plays through", () => {
    let s = initialState(lesson);
    expect(stateOf(rec, s.session).rip).toBe(at.shout);
    s = run(s, go, { type: "fill", values: SORT }, go);
    s = run(s, { type: "choose", id: "vol" });
    expect(s.lesson.feedback?.text).toMatch(/destroy/);
    s = run(s, { type: "choose", id: "non" }, go);
    expect(stateOf(rec, s.session).rip).toBe(at["shout.puts"]);
    const before = stateOf(rec, s.session).regs;
    s = run(s, key("F8"));
    const after = stateOf(rec, s.session).regs;
    expect(after.RBX).toBe(before.RBX);
    expect(after.RDI).toBe(before.RDI);
    s = run(s, click("reg:RBX"));
    expect(s.lesson.feedback?.text).toMatch(/still holds i/);
    for (const r of ["RAX", "RCX", "RDX", "R8", "R9", "R10", "R11"]) s = run(s, click("reg:" + r));
    s = run(s, go, d("shout"), d("shout.push"), go, d("shout.restore"), d("shout.pop"), go);
    s = run(s, { type: "fill", values: { edi: "times", ebx: "i" } }, { type: "choose", id: "ecx" }, go);
    s = run(s, { type: "fill", values: SORT2 }, { type: "choose", id: "rsi" });
    expect(stateOf(rec, s.session).rip).toBe(at.main);
    for (const l of ["main", "main.saveRsi", "main.push", "main.restoreRbx", "main.restoreRsi", "main.pop"]) s = run(s, d(l));
    s = run(s, { type: "choose", id: "non" });
    expect(s.lesson.done).toBe(true);
  });
});
