import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { getLesson } from "@pire/content";
import { progressQuery } from "../api/queries";
import { Player } from "../player/Player";

export function LearnPage() {
  const { lessonId } = useParams({ from: "/learn/$lessonId" });
  const lesson = getLesson(lessonId)!;
  const { data: progress } = useSuspenseQuery(progressQuery);
  const saved = progress.find((p) => p.lesson_id === lesson.id);
  const state = (saved?.state ?? {}) as { mistakes?: unknown; keys?: unknown };
  const resume = saved
    ? {
        stepIndex: saved.beat_index,
        mistakes: typeof state.mistakes === "number" ? state.mistakes : 0,
        keys: Array.isArray(state.keys) ? state.keys.filter((k): k is string => typeof k === "string") : [],
      }
    : undefined;
  return <Player key={lesson.id} lesson={lesson} resume={resume} />;
}
