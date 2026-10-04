import type { Lesson, Step } from "@pire/content";

/**
 * The lesson engine: a pure reducer that turns learner input into lesson state.
 * The UI renders state and dispatches events. Nothing here touches the DOM.
 */

export type FeedbackTone = "wrong" | "info" | "hint";

export interface Feedback {
  tone: FeedbackTone;
  text: string;
}

export interface LessonState {
  stepIndex: number;
  /** "asking" waits for the gate. "success" shows the success message until the learner continues. */
  phase: "asking" | "success";
  feedback: Feedback | null;
  mistakes: number;
  hintsShown: number;
  /** Match checkpoint: label to pane, for labels placed correctly. */
  placed: Record<string, string>;
  /** Choose gate: the option the learner picked last. */
  chosen: string | null;
  keys: string[];
  done: boolean;
}

export type LessonEvent =
  | { type: "continue" }
  | { type: "click"; target: string }
  | { type: "key"; key: string; ripOffscreen: boolean }
  | { type: "predict"; value: string }
  | { type: "choose"; id: string }
  | { type: "drop"; label: string; pane: string }
  | { type: "hint" };

export interface Resume {
  stepIndex: number;
  keys?: string[];
  mistakes?: number;
}

export function initialState(lesson: Lesson, resume?: Resume): LessonState {
  const stepIndex = Math.min(Math.max(resume?.stepIndex ?? 0, 0), lesson.steps.length);
  return {
    stepIndex,
    phase: "asking",
    feedback: null,
    mistakes: resume?.mistakes ?? 0,
    hintsShown: 0,
    placed: {},
    chosen: null,
    keys: resume?.keys ?? [],
    done: stepIndex >= lesson.steps.length,
  };
}

export function currentStep(lesson: Lesson, state: LessonState): Step | undefined {
  return lesson.steps[state.stepIndex];
}

/** A pattern matches a target exactly, or by prefix when it ends in "*". */
export function matchesTarget(pattern: string, target: string): boolean {
  if (pattern.endsWith("*")) return target.startsWith(pattern.slice(0, -1));
  return pattern === target;
}

/** Normalizes an answer so "0x0000000140001070" and "140001070" compare equal. */
export function normalizeAnswer(format: "hex" | "int" | "text", value: string): string {
  const v = value.trim();
  if (format === "text") return v.toLowerCase().replace(/\s+/g, " ");
  if (format === "int") {
    const n = Number.parseInt(v.replace(/[_,\s]/g, ""), 10);
    return Number.isNaN(n) ? "invalid:" + v : String(n);
  }
  const h = v.replace(/^0x/i, "").replace(/[\s_]/g, "").replace(/h$/i, "").toUpperCase();
  if (!/^[0-9A-F]+$/.test(h)) return "invalid:" + v;
  return h.replace(/^0+(?=.)/, "");
}

function advance(lesson: Lesson, state: LessonState): LessonState {
  const stepIndex = state.stepIndex + 1;
  return {
    ...state,
    stepIndex,
    phase: "asking",
    feedback: null,
    hintsShown: 0,
    placed: {},
    chosen: null,
    done: stepIndex >= lesson.steps.length,
  };
}

function pass(lesson: Lesson, state: LessonState, step: Step): LessonState {
  const keys = step.unlockKey && !state.keys.includes(step.unlockKey) ? [...state.keys, step.unlockKey] : state.keys;
  const next: LessonState = { ...state, keys, feedback: null };
  return step.success ? { ...next, phase: "success" } : advance(lesson, next);
}

function miss(state: LessonState, text: string): LessonState {
  return { ...state, mistakes: state.mistakes + 1, feedback: { tone: "wrong", text } };
}

export function reduce(lesson: Lesson, state: LessonState, event: LessonEvent): LessonState {
  const step = currentStep(lesson, state);
  if (!step || state.done) return state;

  if (event.type === "continue") {
    if (state.phase === "success") return advance(lesson, state);
    return step.gate.type === "continue" ? pass(lesson, state, step) : state;
  }
  if (state.phase === "success") return state;

  if (event.type === "hint") {
    if (state.hintsShown >= step.hints.length) return state;
    const hintsShown = state.hintsShown + 1;
    return { ...state, hintsShown, feedback: { tone: "hint", text: step.hints[hintsShown - 1] ?? "" } };
  }

  const gate = step.gate;
  switch (gate.type) {
    case "click": {
      if (event.type !== "click") return state;
      if (gate.accept.some((p) => matchesTarget(p, event.target))) return pass(lesson, state, step);
      const wrong = gate.wrong.find((w) => matchesTarget(w.match, event.target));
      return miss(state, wrong?.feedback ?? gate.fallback);
    }
    case "key": {
      if (event.type !== "key" || event.key !== gate.key) return state;
      if (gate.requires === "ripOffscreen" && !event.ripOffscreen) {
        return { ...state, feedback: { tone: "info", text: gate.notReady ?? "Not yet." } };
      }
      return pass(lesson, state, step);
    }
    case "predict": {
      if (event.type !== "predict") return state;
      const got = normalizeAnswer(gate.format, event.value);
      if (got === normalizeAnswer(gate.format, gate.answer)) return pass(lesson, state, step);
      const wrong = gate.wrong.find((w) => normalizeAnswer(gate.format, w.match) === got);
      return miss(state, wrong?.feedback ?? gate.fallback);
    }
    case "choose": {
      if (event.type !== "choose") return state;
      const option = gate.options.find((o) => o.id === event.id);
      if (!option) return state;
      if (option.id === gate.correct) return pass(lesson, { ...state, chosen: option.id }, step);
      return { ...miss(state, option.feedback ?? "Not quite. Try another answer."), chosen: option.id };
    }
    case "match": {
      if (event.type !== "drop") return state;
      const item = gate.items.find((i) => i.label === event.label);
      if (!item || state.placed[item.label]) return state;
      if (item.pane !== event.pane) return miss(state, gate.fallback);
      const placed = { ...state.placed, [item.label]: item.pane };
      const next: LessonState = { ...state, placed, feedback: null };
      return gate.items.every((i) => placed[i.label]) ? pass(lesson, next, step) : next;
    }
    case "continue":
      return state;
  }
}
