import { describe, expect, it } from "vitest";
import { getLesson } from "@pire/content";
import { initialState, matchesTarget, normalizeAnswer, reduce, type LessonEvent, type LessonState } from "./lesson";

const lesson = getLesson("m1.l1")!;
const run = (events: LessonEvent[], from: LessonState = initialState(lesson)) =>
  events.reduce((s, e) => reduce(lesson, s, e), from);
const go = { type: "continue" } as const;

export const perfectRun: LessonEvent[] = [
  go,
  { type: "click", target: "disasm:0000000140001070" }, go,
  { type: "click", target: "disasm:000000014000107B" }, go,
  { type: "predict", value: "0000000140001070" }, go,
  { type: "click", target: "flag:ZF" }, go,
  { type: "choose", id: "a" }, go,
  { type: "click", target: "dump:ascii:0000000140003200" }, go,
  { type: "click", target: "status:paused" }, go,
  { type: "key", key: "*", ripOffscreen: true }, go,
  { type: "drop", label: "next instruction", pane: "disassembly" },
  { type: "drop", label: "register values", pane: "registers" },
  { type: "drop", label: "memory as hex and text", pane: "dump" },
  { type: "drop", label: "return addresses and locals", pane: "stack" }, go,
  { type: "choose", id: "rip" }, go,
  { type: "choose", id: "no" }, go,
];

describe("lesson engine", () => {
  it("finishes lesson 1.1 with no mistakes on a perfect run", () => {
    const s = run(perfectRun);
    expect(s.done).toBe(true);
    expect(s.mistakes).toBe(0);
    expect(s.keys).toEqual(["*"]);
  });

  it("gives specific feedback for near misses", () => {
    const s = run([go, { type: "click", target: "disasm:0000000140001070" }, go, { type: "click", target: "disasm:0000000140001074" }]);
    expect(s.stepIndex).toBe(2);
    expect(s.feedback?.tone).toBe("wrong");
    expect(s.feedback?.text).toMatch(/loads the banner/);
    expect(s.mistakes).toBe(1);
  });

  it("matches wildcard patterns for the dump", () => {
    const at6 = initialState(lesson, { stepIndex: 6 });
    expect(run([{ type: "click", target: "dump:hex:0000000140003200" }], at6).feedback?.text).toMatch(/hex column/);
    expect(run([{ type: "click", target: "dump:ascii:0000000140003290" }], at6).feedback?.text).toMatch(/zero bytes/);
  });

  it("explains instead of penalizing when * is pressed with RIP on screen", () => {
    const s = run([{ type: "key", key: "*", ripOffscreen: false }], initialState(lesson, { stepIndex: 8 }));
    expect(s.feedback?.tone).toBe("info");
    expect(s.mistakes).toBe(0);
    expect(s.stepIndex).toBe(8);
  });

  it("lets the learner retry a choice", () => {
    const s = run([{ type: "choose", id: "b" }, { type: "choose", id: "a" }], initialState(lesson, { stepIndex: 5 }));
    expect(s.phase).toBe("success");
    expect(s.mistakes).toBe(1);
  });

  it("keeps placed labels after a wrong drop", () => {
    const s = run(
      [
        { type: "drop", label: "next instruction", pane: "disassembly" },
        { type: "drop", label: "register values", pane: "stack" },
      ],
      initialState(lesson, { stepIndex: 9 }),
    );
    expect(s.placed).toEqual({ "next instruction": "disassembly" });
    expect(s.mistakes).toBe(1);
  });

  it("caps hints at the number written", () => {
    const s = run([{ type: "hint" }, { type: "hint" }, { type: "hint" }], initialState(lesson, { stepIndex: 9 }));
    expect(s.hintsShown).toBe(2);
  });

  it("ignores input that does not belong to the current gate", () => {
    const start = initialState(lesson, { stepIndex: 1 });
    expect(run([{ type: "choose", id: "a" }, { type: "key", key: "F7", ripOffscreen: false }], start)).toEqual(start);
  });
});

describe("helpers", () => {
  it("normalizes answers", () => {
    expect(normalizeAnswer("hex", "0x0000000140001070")).toBe("140001070");
    expect(normalizeAnswer("hex", " 140001070 ")).toBe("140001070");
    expect(normalizeAnswer("hex", "zz")).toMatch(/^invalid/);
    expect(normalizeAnswer("int", "1,000")).toBe("1000");
  });

  it("matches targets", () => {
    expect(matchesTarget("dump:hex:*", "dump:hex:00")).toBe(true);
    expect(matchesTarget("reg:RIP", "reg:RIPX")).toBe(false);
  });
});
