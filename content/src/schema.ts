import { z } from "zod";

/**
 * Ids of the x64dbg panes a lesson can spotlight, dim, or use as drop targets.
 * A spotlight can also name a part of a pane, such as "registers.flags".
 */
export const paneIds = [
  "disassembly", "infobox", "registers", "dump", "stack", "command", "status", "console", "tabview",
  "hex", "inspector", "petree", "pedetail", "pehex",
] as const;
export const PaneId = z.enum(paneIds);
export type PaneId = z.infer<typeof PaneId>;

/** The tool on screen: the x64dbg recreation, the hex viewer, or the PE viewer. */
export const ToolId = z.enum(["x64dbg", "hex", "pe"]);
export type ToolId = z.infer<typeof ToolId>;

export const tabIds = ["CPU", "Log", "Breakpoints", "Memory Map", "Call Stack", "References"] as const;

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

const hex = z.string().regex(/^[0-9A-F]+$/, "uppercase hex without 0x");

export const Breakpoint = z.object({
  address: hex,
  kind: z.enum(["software", "hardware"]),
  enabled: z.boolean().default(true),
  size: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8)]).optional(),
});

/** Puts the debugger in a known place when a step starts, such as "a new run, paused at main". */
export const Setup = z.object({
  recording: z.string().optional(),
  /** Address to be paused at: the first time the trace reaches it. "start" is the first recorded stop. */
  at: z.union([hex, z.literal("start")]).optional(),
  breakpoints: z.array(Breakpoint).optional(),
  dump: hex.optional(),
  /** Address the disassembly shows. Omit to follow RIP. */
  view: hex.optional(),
  tab: z.enum(tabIds).optional(),
  /** Text shown in the guide while the scene changes, such as "New run: this time the code is opensesame". */
  banner: z.string().optional(),
  /** Switches tools, such as from the hex viewer to x64dbg. */
  tool: ToolId.optional(),
  /** The file the hex viewer and PE viewer show, by id. */
  file: z.string().optional(),
  /** File offset the hex viewer scrolls to and selects. */
  hexAt: hex.optional(),
  /** Bytes the hex viewer selects, as [offset, length]. */
  hexSelect: z.tuple([hex, z.number().int().positive()]).optional(),
  /** The little-endian helper: select bytes and it shows their value. */
  helper: z.boolean().optional(),
  /** The address converter: VA, RVA, and file offset for the current file. */
  converter: z.boolean().optional(),
  /** PE viewer: the node shown, and the nodes listed in the tree (omit for all). */
  peNode: z.string().optional(),
  peNodes: z.array(z.string()).optional(),
});
export type Setup = z.infer<typeof Setup>;

/** What the learner must make true in the debugger during a free step. */
export const Check = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("pausedAt"),
    address: hex,
    /** Other addresses that also count, such as the call site of the function asked for. */
    or: z.array(hex).default([]),
    /** Only counts when an enabled software breakpoint is set on the address. */
    withBreakpoint: z.boolean().default(false),
    recording: z.string().optional(),
  }),
  z.object({ kind: z.literal("dumpShows"), text: z.string() }),
  z.object({ kind: z.literal("hwHit"), address: hex }),
  z.object({ kind: z.literal("breakpointAt"), address: hex }),
]);
export type Check = z.infer<typeof Check>;

const WrongAnswer = z.object({ match: z.string(), feedback: z.string() });

export const Gate = z.discriminatedUnion("type", [
  z.object({ type: z.literal("continue"), label: z.string().default("Continue") }),
  z.object({
    type: z.literal("click"),
    accept: z.array(TargetPattern).min(1),
    wrong: z.array(z.object({ match: TargetPattern, feedback: z.string() })).default([]),
    fallback: z.string(),
    /** Needs a double-click, like opening a row in the References tab. */
    double: z.boolean().default(false),
  }),
  z.object({
    type: z.literal("key"),
    /** Key name as the player reports it: "F8", "Ctrl+F9", "*", "Space", "Delete", "Ctrl+G". */
    key: z.string(),
    /** A condition the learner must meet before the key counts. */
    requires: z.enum(["ripOffscreen", "selection"]).optional(),
    /** For requires "selection": the selected target must match this pattern. */
    target: TargetPattern.optional(),
    notReady: z.string().optional(),
    wrong: z.array(z.object({ key: z.string(), feedback: z.string() })).default([]),
  }),
  z.object({
    type: z.literal("command"),
    /** The command bar, or the Ctrl+G "follow expression" dialog. */
    surface: z.enum(["command", "goto"]),
    /** Accepted inputs, compared without case and with spaces collapsed. */
    accept: z.array(z.string()).min(1),
    wrong: z.array(WrongAnswer).default([]),
    fallback: z.string(),
  }),
  z.object({
    type: z.literal("menu"),
    /** The right-clicked target. */
    target: TargetPattern,
    /** Menu item id, such as "follow-dump" or "hw-write-4". */
    item: z.string(),
    wrong: z.array(z.object({ item: z.string(), feedback: z.string() })).default([]),
    fallback: z.string(),
  }),
  z.object({
    type: z.literal("order"),
    /** Labels in the right order. The player shuffles them. */
    items: z.array(z.string()).min(2),
    fallback: z.string(),
  }),
  z.object({
    type: z.literal("quiz"),
    questions: z
      .array(
        z.object({
          prompt: z.string(),
          options: z.array(z.object({ id: z.string(), label: z.string() })).min(2),
          correct: z.string(),
          feedback: z.string().optional(),
        }),
      )
      .min(1),
  }),
  z.object({
    type: z.literal("goal"),
    check: Check,
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
  z.object({
    type: z.literal("select"),
    /** File offset and length of the bytes to select in the hex viewer. */
    start: hex,
    length: z.number().int().positive(),
    fallback: z.string(),
  }),
  z.object({
    type: z.literal("fill"),
    /** A card of answers, all checked at once, such as a file's passport. */
    fields: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          format: z.enum(["hex", "int", "text", "choice"]),
          answer: z.string(),
          /** Other answers that count, such as "vault.exe+1530" for "1530". */
          accept: z.array(z.string()).default([]),
          options: z.array(z.string()).default([]),
          placeholder: z.string().default(""),
        }),
      )
      .min(1),
    fallback: z.string().default("Some answers don't match yet. They're marked in red."),
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
  /** Applied when the step starts. */
  setup: Setup.optional(),
  /** Targets that pulse while the step waits for an answer. */
  pulse: z.array(z.string()).default([]),
  /** Every debugger key works, like the real tool. Goal steps are always free. */
  free: z.boolean().default(false),
  /** A small figure in the guide, such as bytes before and after a breakpoint. */
  figure: z
    .object({
      caption: z.string().optional(),
      rows: z.array(z.object({ label: z.string(), bytes: z.string(), highlight: z.array(z.number().int()).default([]) })),
    })
    .optional(),
  /** A drawn explanation in the guide, such as "rulers" (file offset, RVA, VA side by side). */
  diagram: z.enum(["rulers", "alignment", "mapping", "timeline"]).optional(),
  /** Hex viewer overlay entries (structure or field ids) shown once this step is answered, and after. */
  reveal: z.array(z.string()).default([]),
});
export type Step = z.infer<typeof Step>;

export const Lesson = z.object({
  id: z.string().regex(/^[a-z0-9.-]+$/),
  module: z.number().int().positive(),
  number: z.string(),
  title: z.string(),
  mission: z.string(),
  minutes: z.number().int().positive(),
  /** The recording the lesson starts in. */
  recording: z.string(),
  /** Where the debugger is when the lesson starts. */
  start: Setup.default({}),
  source: SourceFile,
  /** Features drawn as locked placeholders, with the lesson that unlocks them. */
  locks: z.object({
    infobox: z.string().optional(),
    callArgs: z.string().optional(),
    command: z.string().optional(),
    helper: z.string().optional(),
  }),
  /** Tools and files the learner can switch between with tabs. Omit for a single tool. */
  workbench: z.object({ tools: z.array(ToolId).default([]), files: z.array(z.string()).default([]) }).optional(),
  /** Show the program's console window. */
  console: z.boolean().default(false),
  /** Challenge lessons: no guided text, a goal list, a shared pool of hint tokens, and a medal. */
  challenge: z.boolean().default(false),
  /** Hint tokens for the whole challenge. Each one reveals the next hint for the current goal. */
  hintTokens: z.number().int().nonnegative().default(3),
  /** Notes on the completion screen of a challenge, shown with the source. */
  debrief: z.array(z.string()).default([]),
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
