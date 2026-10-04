import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { getLesson } from "@pire/content";
import { progressQuery } from "../api/queries";
import type { Session } from "../engine/debugger";
import { Player } from "../player/Player";

export function LearnPage() {
  const { lessonId } = useParams({ from: "/learn/$lessonId" });
  const lesson = getLesson(lessonId)!;
  const { data: progress } = useSuspenseQuery(progressQuery);
  const saved = progress.find((p) => p.lesson_id === lesson.id);
  const state = (saved?.state ?? {}) as { mistakes?: unknown; keys?: unknown; hintsUsed?: unknown; session?: unknown };
  const resume = saved
    ? {
        stepIndex: saved.beat_index,
        mistakes: typeof state.mistakes === "number" ? state.mistakes : 0,
        hintsUsed: typeof state.hintsUsed === "number" ? state.hintsUsed : 0,
        keys: Array.isArray(state.keys) ? state.keys.filter((k): k is string => typeof k === "string") : [],
        // initialState checks the saved session against the recording and falls back if it doesn't fit.
        session: state.session && typeof state.session === "object" ? (state.session as Session) : undefined,
      }
    : undefined;
  return <Player key={lesson.id} lesson={lesson} resume={resume} />;
}
