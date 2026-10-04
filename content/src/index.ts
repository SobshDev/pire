import { type CatalogModule, Lesson } from "./schema";
import { tourOfTheInterface } from "./modules/m1/l1-tour-of-the-interface";

export * from "./schema";

/** Every playable lesson, validated when the module loads so bad content fails fast. */
export const lessons: Record<string, Lesson> = Object.fromEntries(
  [tourOfTheInterface].map((input) => {
    const lesson = Lesson.parse(input);
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
