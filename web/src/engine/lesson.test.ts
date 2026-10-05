import { describe, expect, it } from "vitest";
import { getLesson } from "@pire/content";
import { vault } from "@pire/content/src/specimens/vault";
import { initialState, matchesTarget, normalizeAnswer, reduce, type PlayerEvent, type PlayerState } from "./lesson";

const lesson = getLesson("m1.l1")!;
const run = (events: PlayerEvent[], from: PlayerState = initialState(lesson)) => events.reduce((s, e) => reduce(lesson, s, e), from);
const go = { type: "continue" } as const;
const key = (k: string, extra: Partial<Extract<PlayerEvent, { type: "key" }>> = {}): PlayerEvent => ({
  type: "key",
  key: k,
  ripOffscreen: false,
  selected: null,
  ...extra,
});
const at = (stepIndex: number) => initialState(lesson, { stepIndex });

const perfectRun: PlayerEvent[] = [
  go,
  { type: "click", target: "disasm:" + vault.main }, go,
  { type: "click", target: "disasm:" + vault["main.puts"] }, go,
  { type: "predict", value: "0000000140001070" }, go,
  { type: "click", target: "flag:ZF" }, go,
  { type: "choose", id: "a" }, go,
  { type: "click", target: "dump:ascii:0000000140003200" }, go,
  { type: "click", target: "status:paused" }, go,
  key("*", { ripOffscreen: true }), go,
  { type: "drop", label: "next instruction", pane: "disassembly" },
  { type: "drop", label: "register values", pane: "registers" },
  { type: "drop", label: "memory as hex and text", pane: "dump" },
  { type: "drop", label: "return addresses and locals", pane: "stack" }, go,
  { type: "choose", id: "rip" }, go,
  { type: "choose", id: "no" }, go,
];

describe("lesson engine", () => {
  it("starts lesson 1.1 paused at main", () => {
    const s = initialState(lesson);
    expect(s.session.recording).toBe("vault.wrong");
    expect(s.session.dump).toBe("0000000140003200");
  });

  it("finishes lesson 1.1 with no mistakes on a perfect run", () => {
    const s = run(perfectRun);
    expect(s.lesson.done).toBe(true);
    expect(s.lesson.mistakes).toBe(0);
    expect(s.lesson.keys).toEqual(["*"]);
  });

  it("gives specific feedback for near misses", () => {
    const s = run([go, { type: "click", target: "disasm:" + vault.main }, go, { type: "click", target: "disasm:" + vault["main.banner"] }]);
    expect(s.lesson.stepIndex).toBe(2);
    expect(s.lesson.feedback?.text).toMatch(/loads the banner/);
    expect(s.lesson.mistakes).toBe(1);
  });

  it("matches wildcard patterns for the dump", () => {
    expect(run([{ type: "click", target: "dump:byte:0000000140003200" }], at(6)).lesson.feedback?.text).toMatch(/hex column/);
    expect(run([{ type: "click", target: "dump:ascii:0000000140003290" }], at(6)).lesson.feedback?.text).toMatch(/zero bytes/);
  });

  it("explains instead of penalizing when * is pressed with RIP on screen", () => {
    const s = run([key("*")], at(8));
    expect(s.lesson.feedback?.tone).toBe("info");
    expect(s.lesson.mistakes).toBe(0);
  });

  it("says which key a key step wants when another key is pressed", () => {
    const s = run([{ type: "strayKey", key: "8" }], at(8));
    expect(s.lesson.feedback?.text).toBe("That was 8. This step needs *.");
    expect(s.lesson.mistakes).toBe(0);
  });

  it("does not run the program from a step that asks for something else", () => {
    const start = at(1);
    const s = run([key("F8")], start);
    expect(s.session.index).toBe(start.session.index);
    expect(s.lesson.feedback?.tone).toBe("info");
    expect(s.lesson.mistakes).toBe(0);
  });

  it("lets the learner retry a choice", () => {
    const s = run([{ type: "choose", id: "b" }, { type: "choose", id: "a" }], at(5));
    expect(s.lesson.phase).toBe("success");
    expect(s.lesson.mistakes).toBe(1);
  });

  it("keeps placed labels after a wrong drop", () => {
    const s = run(
      [
        { type: "drop", label: "next instruction", pane: "disassembly" },
        { type: "drop", label: "register values", pane: "stack" },
      ],
      at(9),
    );
    expect(s.lesson.placed).toEqual({ "next instruction": "disassembly" });
  });

  it("caps hints at the number written", () => {
    expect(run([{ type: "hint" }, { type: "hint" }, { type: "hint" }], at(9)).lesson.hintsShown).toBe(2);
  });

  it("resumes with a saved session", () => {
    const saved = run([go], initialState(lesson)).session;
    const s = initialState(lesson, { stepIndex: 1, session: { ...saved, dump: "0000000140003210" } });
    expect(s.session.dump).toBe("0000000140003210");
  });
});

describe("helpers", () => {
  it("normalizes answers", () => {
    expect(normalizeAnswer("hex", "0x0000000140001070")).toBe("140001070");
    expect(normalizeAnswer("hex", "zz")).toMatch(/^invalid/);
    expect(normalizeAnswer("int", "1,000")).toBe("1000");
  });

  it("matches targets", () => {
    expect(matchesTarget("dump:byte:*", "dump:byte:00")).toBe(true);
    expect(matchesTarget("reg:RIP", "reg:RIPX")).toBe(false);
  });
});
