import { describe, expect, it } from "vitest";
import { getLesson } from "@pire/content";
import { vault } from "@pire/content/src/specimens/vault";
import { initialState, reduce, type PlayerEvent, type PlayerState, type Resume } from "./lesson";

const lesson = getLesson("m1.l3")!;
const go = { type: "continue" } as const;
const back = { type: "back" } as const;
const key = (k: string, selected: string | null = null): PlayerEvent => ({ type: "key", key: k, ripOffscreen: false, selected });
const step = (s: PlayerState, ...events: PlayerEvent[]) => events.reduce((acc, e) => reduce(lesson, acc, e), s);

/** What the player saves, as learn.tsx hands it back after a reload. */
function saved(s: PlayerState): Resume {
  const l = s.lesson;
  return {
    stepIndex: l.stepIndex,
    mistakes: l.mistakes,
    hintsUsed: l.hintsUsed,
    keys: l.keys,
    session: s.session,
    history: JSON.parse(JSON.stringify(s.history)),
    step: JSON.parse(JSON.stringify({ stepIndex: l.stepIndex, phase: l.phase, placed: l.placed, chosen: l.chosen, ordered: l.ordered, answered: l.answered, filled: l.filled, unfilled: l.unfilled, banner: l.banner })),
  };
}

describe("back", () => {
  // Breakpoint set, then F9 runs to it: the debugger moved during the step.
  const ran = step(initialState(lesson), go, key("F2", "disasm:" + vault["main.test"]), go, key("F9"));
  const next = step(ran, go);

  it("returns to the last step as it was finished, keeping mistakes, hints and keys", () => {
    expect(ran.lesson.phase).toBe("success");
    const wrong = step(next, { type: "predict", value: "5" }, { type: "hint" });
    expect(wrong.lesson.mistakes).toBeGreaterThan(next.lesson.mistakes);

    const s = step(wrong, back);
    expect(s.lesson.stepIndex).toBe(ran.lesson.stepIndex);
    expect(s.lesson.phase).toBe("success");
    expect(s.lesson.feedback).toBeNull();
    expect(s.session.index).toBe(ran.session.index);
    expect(s.session.breakpoints).toEqual(ran.session.breakpoints);
    expect(s.lesson.mistakes).toBe(wrong.lesson.mistakes);
    expect(s.lesson.hintsUsed).toBe(wrong.lesson.hintsUsed);
    expect(s.lesson.keys).toEqual(wrong.lesson.keys);
    expect(s.history).toHaveLength(next.history.length - 1);
  });

  it("goes forward again into the same next step", () => {
    const s = step(next, back, go);
    expect(s.lesson.stepIndex).toBe(next.lesson.stepIndex);
    expect(s.lesson.phase).toBe("asking");
    expect(s.session.index).toBe(next.session.index);
    expect(s.history).toEqual(next.history);
  });

  it("brings back the step's answers", () => {
    let s = step(next, { type: "predict", value: "0" }, go, go, { type: "command", surface: "command", text: "bp messageboxa" }, go, key("F9"), key("F9"));
    s = step(s, go, { type: "choose", id: "first" });
    const chose = s.lesson.phase === "success" ? s : step(s, go);
    expect(chose.lesson.chosen).toBe("first");
    const after = step(chose, go);
    expect(after.lesson.stepIndex).toBe(chose.lesson.stepIndex + 1);
    expect(step(after, back).lesson.chosen).toBe("first");
  });

  it("does nothing with no history or in a challenge", () => {
    const start = initialState(lesson);
    expect(reduce(lesson, start, back)).toBe(start);
    const challenge = getLesson("m1.challenge")!;
    const c = initialState(challenge);
    const moved = { ...c, history: next.history };
    expect(reduce(challenge, moved, back)).toBe(moved);
  });

  it("survives a reload after going back", () => {
    const s = step(next, back);
    const r = initialState(lesson, saved(s));
    expect(r.lesson.stepIndex).toBe(s.lesson.stepIndex);
    expect(r.lesson.phase).toBe("success");
    expect(r.session.index).toBe(s.session.index);
    expect(r.history).toEqual(s.history);
    expect(step(r, go).session.index).toBe(next.session.index);
  });

  it("drops saved history that doesn't fit", () => {
    const good = saved(next);
    const entries = good.history as { lesson: { stepIndex: number }; session: { recording: string } }[];
    expect(initialState(lesson, good).history).toHaveLength(entries.length);

    const badRecording = structuredClone(entries);
    badRecording[0]!.session.recording = "nope";
    expect(initialState(lesson, { ...good, history: badRecording }).history).toEqual([]);

    expect(initialState(lesson, { ...good, history: [...entries].reverse() }).history).toEqual([]);
    expect(initialState(lesson, { ...good, history: "junk" }).history).toEqual([]);
  });
});

