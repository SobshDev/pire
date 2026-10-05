import { type CatalogModule, Lesson } from "./schema";
import type { Recording } from "./machine/types";
import { tourOfTheInterface } from "./modules/m1/l1-tour-of-the-interface";
import { controllingExecution } from "./modules/m1/l2-controlling-execution";
import { breakpoints } from "./modules/m1/l3-breakpoints";
import { followingValues } from "./modules/m1/l4-following-values";
import { gettingToMain } from "./modules/m1/l5-getting-to-main";
import { theVault } from "./modules/m1/challenge-the-vault";
import { peLayout } from "./modules/m2/l1-pe-layout";
import { threeKindsOfAddress } from "./modules/m2/l2-three-kinds-of-address";
import { importsAndExports } from "./modules/m2/l3-imports-and-exports";
import { doubleClickToMain } from "./modules/m2/l4-double-click-to-main";
import { usingAPeViewer } from "./modules/m2/l5-using-a-pe-viewer";
import { passportControl } from "./modules/m2/challenge-passport-control";
import { argumentsAndReturnValues } from "./modules/m3/l1-arguments-and-return-values";
import { shadowSpaceAndAlignment } from "./modules/m3/l2-shadow-space-and-alignment";
import { prologueEpilogue } from "./modules/m3/l3-prologue-epilogue";
import { volatileNonvolatile } from "./modules/m3/l4-volatile-nonvolatile";
import { floatingPointArguments } from "./modules/m3/l5-floating-point-arguments";
import { vaultRecordings } from "./specimens/vault";
import { vault2Recordings } from "./specimens/vault2";
import { callsRecordings } from "./specimens/calls";
import { callsReleaseRecordings } from "./specimens/calls/release";
import { peFileFor } from "./specimens/msvc";
import { vaultSpec } from "./specimens/vault/program";
import { travelerA, travelerB, travelerC, user32 } from "./specimens/files";
import type { PeFile } from "./pe/build";

export * from "./schema";
export type * from "./machine/types";
export { FLAG_ORDER, flagsFromRflags, type FlagName } from "./machine/machine";
export * from "./pe/build";

/** Every recording lessons can use, by id. */
export const recordings: Record<string, Recording> = Object.fromEntries(
  (() => {
    const calls = callsRecordings();
    const release = callsReleaseRecordings();
    return [
      ...[vaultRecordings(), vault2Recordings()].flatMap((v) => [v.wrong, v.right, v.strippedWrong, v.strippedRight]),
      calls.named,
      calls.stripped,
      release.named,
      release.stripped,
    ].map((r) => [r.id, r]);
  })(),
);

export function getRecording(id: string): Recording {
  const rec = recordings[id];
  if (!rec) throw new Error("unknown recording " + id);
  return rec;
}

/** Every file the hex viewer and PE viewer can open, by id. */
export const files: Record<string, PeFile> = Object.fromEntries(
  [peFileFor(vaultSpec, { aslr: false }), peFileFor(vaultSpec, { aslr: true }), travelerA(), travelerB(), travelerC(), user32()].map((f) => [f.id, f]),
);

export function getFile(id: string): PeFile {
  const f = files[id];
  if (!f) throw new Error("unknown file " + id);
  return f;
}

/** Every playable lesson, validated when the module loads so bad content fails fast. */
export const lessons: Record<string, Lesson> = Object.fromEntries(
  [
    tourOfTheInterface, controllingExecution, breakpoints, followingValues, gettingToMain, theVault,
    peLayout, threeKindsOfAddress, importsAndExports, doubleClickToMain, usingAPeViewer, passportControl,
    argumentsAndReturnValues, shadowSpaceAndAlignment, prologueEpilogue, volatileNonvolatile, floatingPointArguments,
  ].map((input) => {
    const lesson = Lesson.parse(input);
    const used = [lesson.recording, ...lesson.steps.flatMap((s) => (s.setup?.recording ? [s.setup.recording] : []))];
    for (const id of used) if (!recordings[id]) throw new Error(lesson.id + " uses unknown recording " + id);
    const usedFiles = [lesson.start.file, ...lesson.steps.map((s) => s.setup?.file), ...(lesson.workbench?.files ?? [])];
    for (const id of usedFiles) if (id && !files[id]) throw new Error(lesson.id + " uses unknown file " + id);
    for (const step of lesson.steps) {
      if (step.source && !lesson.source.regions[step.source]) throw new Error(lesson.id + " uses unknown source region " + step.source);
    }
    return [lesson.id, lesson];
  }),
);

export function getLesson(id: string): Lesson | undefined {
  return lessons[id];
}

const designed = (id: string, number: string, title: string, minutes: number) =>
  ({ id, number, title, minutes, status: lessons[id] ? "playable" : "designed" }) as const;

/** The course outline. Lessons that only exist as design docs show as coming soon. */
export const catalog: CatalogModule[] = [
  {
    number: 1,
    title: "Debugger Basics (x64dbg)",
    goal: "Open a program in x64dbg, find your way around, control execution, and read the values that matter.",
    lessons: [
      designed("m1.l1", "1.1", "Tour of the interface", 10),
      designed("m1.l2", "1.2", "Controlling execution", 12),
      designed("m1.l3", "1.3", "Breakpoints", 12),
      designed("m1.l4", "1.4", "Following values", 12),
      designed("m1.l5", "1.5", "Getting to main", 12),
      designed("m1.challenge", "★", "Challenge: The Vault", 15),
    ],
  },
  {
    number: 2,
    title: "Anatomy of a Windows Executable",
    goal: "Read a PE file's headers, sections, and imports, and follow Windows from double-click to main.",
    lessons: [
      designed("m2.l1", "2.1", "PE layout", 12),
      designed("m2.l2", "2.2", "Three kinds of address", 12),
      designed("m2.l3", "2.3", "Imports and exports", 12),
      designed("m2.l4", "2.4", "From double-click to main", 10),
      designed("m2.l5", "2.5", "Using a PE viewer", 10),
      designed("m2.challenge", "★", "Challenge: Passport control", 15),
    ],
  },
  {
    number: 3,
    title: "Functions and the x64 Calling Convention",
    goal: "Read any call site: arguments, return values, stack layout, and which registers survive.",
    lessons: [
      designed("m3.l1", "3.1", "Arguments and return values", 12),
      designed("m3.l2", "3.2", "Shadow space and stack alignment", 12),
      designed("m3.l3", "3.3", "Prologue, epilogue, call and ret", 10),
      designed("m3.l4", "3.4", "Volatile and nonvolatile registers", 12),
      designed("m3.l5", "3.5", "Floating-point arguments", 10),
      designed("m3.challenge", "★", "Challenge: Call site detective", 15),
    ],
  },
];

/** Keys a lesson teaches, in the order its steps unlock them. */
export function keysTaughtBy(lesson: Lesson): string[] {
  return lesson.steps.flatMap((s) => (s.unlockKey ? [s.unlockKey] : []));
}
