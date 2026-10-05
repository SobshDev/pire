import { describe, expect, it } from "vitest";
import { getLesson, getRecording } from "@pire/content";
import { calls2Recordings } from "@pire/content/src/specimens/calls2";
import { stateOf } from "./debugger";
import { initialState, reduce, type PlayerEvent, type PlayerState } from "./lesson";

const lesson = getLesson("m3.challenge")!;
const rec = getRecording("calls2-stripped");
const at = calls2Recordings().at;
const run = (s: PlayerState, ...events: PlayerEvent[]) => events.reduce((acc, e) => reduce(lesson, acc, e), s);
const go = { type: "continue" } as const;
const N = "(none)";
const proto = (ret: string, ...args: string[]) =>
  ({ type: "fill", values: { ret, ...Object.fromEntries([0, 1, 2, 3, 4, 5].map((i) => ["a" + (i + 1), args[i] ?? N])) } }) as const;
const I32 = "32-bit integer";
const I64 = "64-bit integer";

describe("module 3 challenge", () => {
  it("prints what calls2.c prints", () => {
    expect(rec.states.flatMap((s) => (s.out ? [s.out] : [])).join("")).toBe("5 AAAAAAAAAAAAAAA 5.333333 -100 3.250000 3\n");
  });

  it("calls strcmp once per word", () => {
    const calls = rec.states.filter((s) => s.rip === at["count.strcmp"]);
    expect(calls).toHaveLength(4);
  });

  it("accepts the prototypes and rejects a wrong one", () => {
    let s = initialState(lesson);
    expect(stateOf(rec, s.session).rip).toBe(at.main);
    s = run(s, proto(I32, I32, I32));
    expect(s.lesson.feedback?.tone).toBe("wrong");
    s = run(s, proto(I32, I32, I32, I32), go);
    s = run(s, proto("void", "pointer", "8-bit integer", I64), go);
    s = run(s, proto("double", "double", "double", "double"), go);
    s = run(s, proto(I64, I32, I64, I32, I32, I32, I64), go);
    s = run(s, proto("float", "float", "float", "float"), go);
    s = run(s, proto(I32, "pointer", I32, "pointer"), go);
    s = run(s, { type: "choose", id: "stack" }, go);
    expect(s.lesson.done).toBe(true);
  });
});
