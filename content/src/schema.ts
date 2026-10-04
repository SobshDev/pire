import { z } from "zod";

/**
 * Ids of the x64dbg panes a lesson can spotlight, dim, or use as drop targets.
 * A spotlight can also name a part of a pane, such as "registers.flags".
 */
export const paneIds = ["disassembly", "infobox", "registers", "dump", "stack", "command", "status"] as const;
export const PaneId = z.enum(paneIds);
export type PaneId = z.infer<typeof PaneId>;

/* ------------------------------------------------------------------ */
/* Debugger snapshot: everything the x64dbg view shows at one moment.  */
/* ------------------------------------------------------------------ */

const hex = z.string().regex(/^[0-9A-F]+$/, "uppercase hex without 0x");

export const Instruction = z.object({
  address: hex,
  bytes: z.string(),
  mnemonic: z.string(),
  operands: z.string().default(""),
  comment: z.string().optional(),
});
export type Instruction = z.infer<typeof Instruction>;

export const Snapshot = z.object({
  windowTitle: z.string(),
  rip: hex,
  registers: z.array(z.object({ name: z.string(), value: hex })),
  rflags: hex,
  flags: z.array(z.object({ name: z.string(), value: z.union([z.literal(0), z.literal(1)]) })),
  disassembly: z.array(Instruction),
  /** Index of the first visible row when the view opens or after pressing "*". */
  disassemblyTopOffset: z.number().int().nonnegative().default(4),
  dump: z.object({ base: hex, bytes: z.string().regex(/^([0-9A-F]{2} ?)+$/) }),
  stack: z.array(z.object({ address: hex, value: hex, comment: z.string().optional() })),
  rsp: hex,
  status: z.object({ state: z.enum(["Paused", "Running", "Terminated"]), message: z.string().default("") }),
});
export type Snapshot = z.infer<typeof Snapshot>;

export const SourceFile = z.object({
  name: z.string(),
  code: z.string(),
  /** Named line ranges (1-based, inclusive) a beat can highlight, such as a function. */
  regions: z.record(z.string(), z.tuple([z.number().int().positive(), z.number().int().positive()])),
});
export type SourceFile = z.infer<typeof SourceFile>;

/* ------------------------------------------------------------------ */
/* Lessons                                                             */
/* ------------------------------------------------------------------ */

/** A click target id, or a prefix ending in "*". Examples: "reg:RIP", "disasm:*". */
const TargetPattern = z.string().min(1);

const WrongAnswer = z.object({ match: z.string(), feedback: z.string() });

export const Gate = z.discriminatedUnion("type", [
  z.object({ type: z.literal("continue"), label: z.string().default("Continue") }),
  z.object({
    type: z.literal("click"),
    accept: z.array(TargetPattern).min(1),
    wrong: z.array(z.object({ match: TargetPattern, feedback: z.string() })).default([]),
    fallback: z.string(),
  }),
  z.object({
    type: z.literal("key"),
    key: z.string(),
    /** A condition the learner must meet before the key counts. */
    requires: z.enum(["ripOffscreen"]).optional(),
    notReady: z.string().optional(),
  }),
  z.object({
    type: z.literal("predict"),
    format: z.enum(["hex", "int", "text"]),
    answer: z.string(),
    placeholder: z.string().default(""),
    wrong: z.array(WrongAnswer).default([]),
    fallback: z.string(),
  }),
  z.object({
    type: z.literal("choose"),
    options: z
      .array(z.object({ id: z.string(), label: z.string(), feedback: z.string().optional() }))
      .min(2),
    correct: z.string(),
  }),
  z.object({
    type: z.literal("match"),
    items: z.array(z.object({ label: z.string(), pane: PaneId })).min(2),
    fallback: z.string(),
  }),
]);
export type Gate = z.infer<typeof Gate>;

export const Step = z.object({
  section: z.enum(["beat", "checkpoint"]),
  /** Short label shown after the step number, such as "Spotlight" or "Choose". */
  kind: z.string(),
  title: z.string(),
  say: z.string(),
  /** The one-line instruction next to the cursor icon. */
  action: z.string().optional(),
  /** Pane (or "pane.part") to spotlight. "none" dims everything; omit to dim nothing. */
  spotlight: z.string().optional(),
  gate: Gate,
  /** Shown after the gate passes. Omit to move straight on. */
  success: z.string().optional(),
  /** Targets to ring while the success message shows. */
  successHighlights: z.array(z.string()).default([]),
  /** Opens the source card with this region highlighted. */
  source: z.string().optional(),
  /** Key added to the learner's tray when this step is passed. */
  unlockKey: z.string().optional(),
  hints: z.array(z.string()).default([]),
});
export type Step = z.infer<typeof Step>;

export const Lesson = z.object({
  id: z.string().regex(/^[a-z0-9.-]+$/),
  module: z.number().int().positive(),
  number: z.string(),
  title: z.string(),
  mission: z.string(),
  minutes: z.number().int().positive(),
  snapshot: Snapshot,
  source: SourceFile,
  /** Features drawn as locked placeholders, with the lesson that unlocks them. */
  locks: z.object({
    infobox: z.string().optional(),
    callArgs: z.string().optional(),
    command: z.string().optional(),
  }),
  steps: z.array(Step).min(1),
  tryIt: z.array(z.string()),
});
export type Lesson = z.infer<typeof Lesson>;
export type LessonInput = z.input<typeof Lesson>;

export type LessonStatus = "playable" | "designed";

export interface CatalogLesson {
  id: string;
  number: string;
  title: string;
  minutes: number;
  status: LessonStatus;
}

export interface CatalogModule {
  number: number;
  title: string;
  goal: string;
  lessons: CatalogLesson[];
}
