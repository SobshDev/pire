import { lessons } from "./index";
import type { Lesson } from "./schema";

/**
 * What the AI tutor knows about each lesson: the text the learner reads, every gate with its answer,
 * and the hints. The API embeds this as JSON (api/tutor/lessons.json), so regenerate it with
 * `bun run export:tutor` after editing lessons. A web test fails when the file is out of date.
 */
export function tutorLesson(lesson: Lesson) {
  return {
    id: lesson.id,
    number: lesson.number,
    title: lesson.title,
    module: lesson.module,
    challenge: lesson.challenge,
    mission: lesson.mission,
    source: { name: lesson.source.name, code: lesson.source.code },
    steps: lesson.steps.map((s, i) => ({
      step: i + 1,
      section: s.section,
      kind: s.kind,
      title: s.title,
      say: s.say,
      ...(s.action ? { action: s.action } : {}),
      gate: s.gate,
      ...(s.success ? { success: s.success } : {}),
      ...(s.hints.length ? { hints: s.hints } : {}),
      ...(s.source ? { sourceLines: lesson.source.regions[s.source] } : {}),
    })),
    ...(lesson.debrief.length ? { debrief: lesson.debrief } : {}),
  };
}

/** Every lesson, by id, formatted the way api/tutor/lessons.json stores it. */
export function tutorLessonsJson(): string {
  const all = Object.fromEntries(Object.values(lessons).map((l) => [l.id, tutorLesson(l)]));
  return JSON.stringify(all, null, 1) + "\n";
}
