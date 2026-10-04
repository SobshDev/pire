import { getRecording, type Check, type Lesson, type Recording, type Setup, type Step } from "@pire/content";
import * as D from "./debugger";
import type { Session, Tab } from "./debugger";

/**
 * The lesson engine: a pure reducer over the lesson (which step, mistakes, feedback) and the
 * debugger session (where the recording is paused, breakpoints, views). The UI renders the state
 * and dispatches events; nothing here touches the DOM.
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
  /** Order gate: labels picked so far. */
  ordered: string[];
  /** Quiz gate: questions answered correctly so far. */
  answered: number;
  keys: string[];
  /** Scene change text from the current step's setup. */
  banner: string | null;
  done: boolean;
}

export interface PlayerState {
  lesson: LessonState;
  session: Session;
}

export type PlayerEvent =
  | { type: "continue" }
  | { type: "hint" }
  | { type: "click"; target: string }
  | { type: "dblclick"; target: string }
  | { type: "key"; key: string; ripOffscreen: boolean; selected: string | null }
  | { type: "predict"; value: string }
  | { type: "choose"; id: string }
  | { type: "drop"; label: string; pane: string }
  | { type: "order"; label: string }
  | { type: "command"; surface: "command" | "goto"; text: string }
  | { type: "menu"; target: string; item: string }
  | { type: "tab"; tab: Tab }
  | { type: "closeGoto" };

/** Keys that drive the debugger. Anything else is ignored. */
export const DEBUG_KEYS = new Set(["F2", "F4", "F7", "F8", "F9", "Ctrl+F9", "Ctrl+F2", "Ctrl+G", "*", "Space", "Delete"]);

export interface Resume {
  stepIndex: number;
  keys?: string[];
  mistakes?: number;
  session?: Session;
}

/* ------------------------------------------------------------------ */
/* Setup                                                               */
/* ------------------------------------------------------------------ */

export function indexOfAddress(rec: Recording, at: Setup["at"]): number {
  if (!at || at === "start") return 0;
  const i = rec.states.findIndex((s) => s.rip === at);
  if (i < 0) throw new Error(rec.id + " never reaches " + at);
  return i;
}

export function applySetup(session: Session | null, setup: Setup | undefined, fallbackRecording: string): Session {
  const recId = setup?.recording ?? session?.recording ?? fallbackRecording;
  const rec = getRecording(recId);
  let s: Session =
    !session || setup?.recording || setup?.at !== undefined
      ? { ...D.newSession(rec, indexOfAddress(rec, setup?.at)), breakpoints: session?.breakpoints ?? [], log: session?.log ?? [] }
      : session;
  if (setup?.breakpoints) s = { ...s, breakpoints: setup.breakpoints.map((b) => ({ ...b })) };
  if (setup?.dump) s = { ...s, dump: setup.dump };
  if (setup?.view) s = { ...s, view: setup.view };
  if (setup?.tab) s = { ...s, tab: setup.tab };
  return s;
}

function sessionAt(lesson: Lesson, stepIndex: number): Session {
  let s = applySetup(null, lesson.start, lesson.recording);
  for (let i = 0; i <= Math.min(stepIndex, lesson.steps.length - 1); i++) {
    const setup = lesson.steps[i]?.setup;
    if (setup) s = applySetup(s, setup, lesson.recording);
  }
  return s;
}

function validSession(s: Session | undefined): s is Session {
  if (!s || typeof s !== "object" || typeof s.recording !== "string") return false;
  try {
    const rec = getRecording(s.recording);
    return Number.isInteger(s.index) && s.index >= 0 && s.index < rec.states.length && Array.isArray(s.breakpoints);
  } catch {
    return false;
  }
}

export function initialState(lesson: Lesson, resume?: Resume): PlayerState {
  const stepIndex = Math.min(Math.max(resume?.stepIndex ?? 0, 0), lesson.steps.length);
  const session = validSession(resume?.session) ? { ...resume.session, goto: null } : sessionAt(lesson, stepIndex);
  return {
    lesson: {
      stepIndex,
      phase: "asking",
      feedback: null,
      mistakes: resume?.mistakes ?? 0,
      hintsShown: 0,
      placed: {},
      chosen: null,
      ordered: [],
      answered: 0,
      keys: resume?.keys ?? [],
      banner: lesson.steps[stepIndex]?.setup?.banner ?? null,
      done: stepIndex >= lesson.steps.length,
    },
    session,
  };
}

export function currentStep(lesson: Lesson, state: PlayerState): Step | undefined {
  return lesson.steps[state.lesson.stepIndex];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

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

export const normalizeCommand = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");

/** The value a right-clicked target holds: a register's value, a stack slot's value, or an address. */
export function targetValue(rec: Recording, s: Session, target: string): string | null {
  const st = D.stateOf(rec, s);
  const [kind, a, b] = target.split(":");
  if (kind === "reg" && a) return a === "RIP" ? st.rip : (st.regs[a] ?? null);
  if (kind === "stack" && a) {
    const v = D.readQword(rec, s.index, D.big(a));
    return v === null ? null : D.pad(v);
  }
  if (kind === "dump" && a === "byte" && b) return b;
  if (kind === "disasm" && a) return a;
  if (kind === "bp" && b) return b;
  return null;
}

function addressOf(target: string | null, kind: string): string | null {
  if (!target) return null;
  const parts = target.split(":");
  if (parts[0] !== kind) return null;
  return parts[parts.length - 1] ?? null;
}

/** Runs one debugger key. Returns null when the key can't do anything right now. */
export function performKey(rec: Recording, s: Session, key: string, selected: string | null): Session | null {
  switch (key) {
    case "F7":
      return D.stepInto(rec, s);
    case "F8":
      return D.stepOver(rec, s);
    case "F9":
      return D.run(rec, s);
    case "Ctrl+F9":
      return D.runToReturn(rec, s);
    case "Ctrl+F2":
      return D.restart(rec, s);
    case "F4": {
      const at = addressOf(selected, "disasm");
      return at ? D.runToCursor(rec, s, at) : null;
    }
    case "F2": {
      const at = addressOf(selected, "disasm");
      return at ? D.toggleBreakpoint(rec, s, at) : null;
    }
    case "Space":
    case "Delete": {
      if (!selected?.startsWith("bp:")) return null;
      const [, kind, at] = selected.split(":") as [string, "software" | "hardware", string];
      const bp = s.breakpoints.find((b) => b.address === at && b.kind === kind);
      if (!bp) return null;
      return key === "Space" ? D.setBreakpointEnabled(s, at, kind, !bp.enabled) : D.deleteBreakpoint(s, at, kind);
    }
    case "Ctrl+G":
      return { ...s, goto: selected?.startsWith("dump:") ? "dump" : "disassembly" };
    case "*":
      return { ...s, view: null, tab: "CPU" };
    default:
      return null;
  }
}

export function performMenu(rec: Recording, s: Session, target: string, item: string): Session | null {
  const value = targetValue(rec, s, target);
  switch (item) {
    case "follow-dump":
      return value ? D.followInDump(s, value) : null;
    case "follow-disasm":
      return value ? D.followInDisassembler(s, value) : null;
    case "bp-toggle":
      return value && target.startsWith("disasm:") ? D.toggleBreakpoint(rec, s, value) : null;
    case "search-strings":
      return D.searchStrings(s);
    default: {
      const hw = /^hw-write-(1|2|4|8)$/.exec(item);
      if (hw && value) return D.addBreakpoint(rec, s, { address: value, kind: "hardware", enabled: true, size: Number(hw[1]) as 1 | 2 | 4 | 8 });
      return null;
    }
  }
}

export function checkGoal(rec: Recording, s: Session, check: Check): boolean {
  const st = D.stateOf(rec, s);
  switch (check.kind) {
    case "pausedAt":
      return !st.terminated && st.rip === check.address && (!check.recording || s.recording === check.recording);
    case "breakpointAt":
      return s.breakpoints.some((b) => b.enabled && b.kind === "software" && b.address === check.address);
    case "hwHit":
      return s.message.startsWith("Hardware breakpoint") && s.message.includes(check.address);
    case "dumpShows": {
      let text = "";
      for (let i = 0; i < 128; i++) {
        const b = D.readByte(rec, s.index, D.big(s.dump) + BigInt(i));
        text += b !== null && b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".";
      }
      return text.includes(check.text);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

function advance(lesson: Lesson, state: PlayerState): PlayerState {
  const stepIndex = state.lesson.stepIndex + 1;
  const next = lesson.steps[stepIndex];
  return {
    session: next?.setup ? applySetup(state.session, next.setup, lesson.recording) : state.session,
    lesson: {
      ...state.lesson,
      stepIndex,
      phase: "asking",
      feedback: null,
      hintsShown: 0,
      placed: {},
      chosen: null,
      ordered: [],
      answered: 0,
      banner: next?.setup?.banner ?? null,
      done: stepIndex >= lesson.steps.length,
    },
  };
}

function pass(lesson: Lesson, state: PlayerState, step: Step): PlayerState {
  const l = state.lesson;
  const keys = step.unlockKey && !l.keys.includes(step.unlockKey) ? [...l.keys, step.unlockKey] : l.keys;
  const next: PlayerState = { ...state, lesson: { ...l, keys, feedback: null } };
  return step.success ? { ...next, lesson: { ...next.lesson, phase: "success" } } : advance(lesson, next);
}

const withLesson = (state: PlayerState, patch: Partial<LessonState>): PlayerState => ({ ...state, lesson: { ...state.lesson, ...patch } });
const miss = (state: PlayerState, text: string): PlayerState =>
  withLesson(state, { mistakes: state.lesson.mistakes + 1, feedback: { tone: "wrong", text } });
const info = (state: PlayerState, text: string): PlayerState => withLesson(state, { feedback: { tone: "info", text } });

/** In free steps the debugger behaves normally and goal steps pass as soon as their check holds. */
function afterFree(lesson: Lesson, state: PlayerState, step: Step): PlayerState {
  if (step.gate.type !== "goal") return state;
  return checkGoal(getRecording(state.session.recording), state.session, step.gate.check) ? pass(lesson, state, step) : state;
}

export function reduce(lesson: Lesson, state: PlayerState, event: PlayerEvent): PlayerState {
  const step = currentStep(lesson, state);
  const l = state.lesson;
  const rec = getRecording(state.session.recording);

  // Views the learner can change at any time.
  if (event.type === "tab") return { ...state, session: { ...state.session, tab: event.tab } };
  if (event.type === "closeGoto") return { ...state, session: { ...state.session, goto: null } };
  if (!step || l.done) return state;

  if (event.type === "continue") {
    if (l.phase === "success") return advance(lesson, state);
    return step.gate.type === "continue" ? pass(lesson, state, step) : state;
  }

  const free = step.free || step.gate.type === "goal";
  if (l.phase === "success" && !free) {
    // Looking around is fine after answering; only "*" and tab changes do anything.
    if (event.type === "key" && event.key === "*") return { ...state, session: { ...state.session, view: null, tab: "CPU" } };
    return state;
  }

  if (event.type === "hint") {
    if (l.hintsShown >= step.hints.length) return state;
    const hintsShown = l.hintsShown + 1;
    return withLesson(state, { hintsShown, feedback: { tone: "hint", text: step.hints[hintsShown - 1] ?? "" } });
  }

  // Double-clicking a reference or breakpoint row jumps to its code, like in x64dbg.
  let current = state;
  if (event.type === "dblclick") {
    const at = addressOf(event.target, event.target.startsWith("ref:") ? "ref" : "bp");
    if (at && (event.target.startsWith("ref:") || event.target.startsWith("bp:"))) {
      current = { ...state, session: D.followInDisassembler(state.session, at) };
    }
  }

  const gate = step.gate;

  if (free) {
    let session = current.session;
    if (event.type === "key" && DEBUG_KEYS.has(event.key)) {
      const next = performKey(rec, session, event.key, event.selected);
      if (!next) return info(current, keyNeeds(event.key));
      session = next;
    } else if (event.type === "command") {
      const r = event.surface === "goto" ? D.gotoExpression(rec, session, session.goto ?? "dump", event.text) : D.command(rec, session, event.text);
      if (!r.ok) return info({ ...current, session: r.session }, "x64dbg didn't understand that expression.");
      session = r.session;
    } else if (event.type === "menu") {
      session = performMenu(rec, session, event.target, event.item) ?? session;
    }
    const moved = { ...current, session };
    if (gate.type === "goal") return afterFree(lesson, withLesson(moved, { feedback: null }), step);
    current = moved;
  }

  switch (gate.type) {
    case "click": {
      if (event.type !== (gate.double ? "dblclick" : "click")) return guided(current, event, free);
      if (gate.accept.some((p) => matchesTarget(p, event.target))) return pass(lesson, current, step);
      const wrong = gate.wrong.find((w) => matchesTarget(w.match, event.target));
      return miss(current, wrong?.feedback ?? gate.fallback);
    }
    case "key": {
      if (event.type !== "key" || !DEBUG_KEYS.has(event.key)) return current;
      if (event.key !== gate.key) {
        if (event.key === "*") return { ...current, session: { ...current.session, view: null, tab: "CPU" } };
        if (free) return current;
        const wrong = gate.wrong.find((w) => w.key === event.key);
        return miss(current, wrong?.feedback ?? "This step needs " + gate.key + ", not " + event.key + ".");
      }
      if (gate.requires === "ripOffscreen" && !event.ripOffscreen) return info(current, gate.notReady ?? "Not yet.");
      if (gate.requires === "selection" && !(event.selected && (!gate.target || matchesTarget(gate.target, event.selected)))) {
        return info(current, gate.notReady ?? "Click the line first.");
      }
      if (free) return pass(lesson, current, step);
      const session = performKey(rec, current.session, event.key, event.selected);
      if (!session) return info(current, keyNeeds(event.key));
      return pass(lesson, { ...current, session }, step);
    }
    case "command": {
      // A step that wants a Ctrl+G expression has to let Ctrl+G open the dialog first.
      if (event.type === "key" && event.key === "Ctrl+G" && gate.surface === "goto" && !free) {
        return { ...current, session: performKey(rec, current.session, event.key, event.selected) ?? current.session };
      }
      if (event.type !== "command" || event.surface !== gate.surface) return current;
      const said = normalizeCommand(event.text);
      if (gate.accept.some((a) => normalizeCommand(a) === said)) {
        if (free) return pass(lesson, current, step);
        const r =
          gate.surface === "goto"
            ? D.gotoExpression(rec, current.session, current.session.goto ?? "dump", event.text)
            : D.command(rec, current.session, event.text);
        return pass(lesson, { ...current, session: r.session }, step);
      }
      const wrong = gate.wrong.find((w) => normalizeCommand(w.match) === said);
      return miss(current, wrong?.feedback ?? gate.fallback);
    }
    case "menu": {
      if (event.type !== "menu") return current;
      if (matchesTarget(gate.target, event.target) && event.item === gate.item) {
        if (free) return pass(lesson, current, step);
        const session = performMenu(rec, current.session, event.target, event.item) ?? current.session;
        return pass(lesson, { ...current, session }, step);
      }
      const wrong = gate.wrong.find((w) => w.item === event.item);
      return miss(current, wrong?.feedback ?? gate.fallback);
    }
    case "predict": {
      if (event.type !== "predict") return guided(current, event, free);
      const got = normalizeAnswer(gate.format, event.value);
      if (got === normalizeAnswer(gate.format, gate.answer)) return pass(lesson, current, step);
      const wrong = gate.wrong.find((w) => normalizeAnswer(gate.format, w.match) === got);
      return miss(current, wrong?.feedback ?? gate.fallback);
    }
    case "choose": {
      if (event.type !== "choose") return guided(current, event, free);
      const option = gate.options.find((o) => o.id === event.id);
      if (!option) return current;
      if (option.id === gate.correct) return pass(lesson, withLesson(current, { chosen: option.id }), step);
      return withLesson(miss(current, option.feedback ?? "Not quite. Try another answer."), { chosen: option.id });
    }
    case "quiz": {
      if (event.type !== "choose") return guided(current, event, free);
      const q = gate.questions[l.answered];
      if (!q) return current;
      if (event.id !== q.correct) return withLesson(miss(current, q.feedback ?? "Not that one. Try again."), { chosen: event.id });
      const answered = l.answered + 1;
      const next = withLesson(current, { answered, chosen: null, feedback: null });
      return answered >= gate.questions.length ? pass(lesson, next, step) : next;
    }
    case "order": {
      if (event.type !== "order") return guided(current, event, free);
      if (l.ordered.includes(event.label)) return current;
      const expected = gate.items[l.ordered.length];
      if (event.label !== expected) return withLesson(miss(current, gate.fallback), { ordered: [] });
      const ordered = [...l.ordered, event.label];
      const next = withLesson(current, { ordered, feedback: null });
      return ordered.length === gate.items.length ? pass(lesson, next, step) : next;
    }
    case "match": {
      if (event.type !== "drop") return guided(current, event, free);
      const item = gate.items.find((i) => i.label === event.label);
      if (!item || l.placed[item.label]) return current;
      if (item.pane !== event.pane) return miss(current, gate.fallback);
      const placed = { ...l.placed, [item.label]: item.pane };
      const next = withLesson(current, { placed, feedback: null });
      return gate.items.every((i) => placed[i.label]) ? pass(lesson, next, step) : next;
    }
    case "continue":
    case "goal":
      return guided(current, event, free);
  }
}

/** Debugger keys during a step that asks for something else get a nudge instead of running. */
function guided(state: PlayerState, event: PlayerEvent, free: boolean): PlayerState {
  if (free || event.type !== "key" || !DEBUG_KEYS.has(event.key)) return state;
  if (event.key === "*") return { ...state, session: { ...state.session, view: null, tab: "CPU" } };
  return info(state, "Not yet. Follow the guide on the right first.");
}

function keyNeeds(key: string): string {
  if (key === "F4") return "Click a line in the disassembly first, then press F4 to run to it.";
  if (key === "F2") return "Click a line in the disassembly first, then press F2.";
  if (key === "Space" || key === "Delete") return "Click a breakpoint in the list first.";
  return "Nothing to do here: the program has finished.";
}
