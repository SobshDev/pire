import { Link } from "@tanstack/react-router";
import type { Lesson } from "@pire/content";
import { motion } from "motion/react";
import { medal, type LessonState } from "../engine/lesson";
import { cx, Keycap, lessonFeedbackUrl } from "../ui/bits";
import { SourceCard } from "./Guide";

const MEDALS = {
  gold: { label: "Gold", note: "No hints used.", className: "border-amber bg-amber text-ink" },
  silver: { label: "Silver", note: "One or two hints.", className: "border-[#C9C4BA] bg-[#C9C4BA] text-ink" },
  bronze: { label: "Bronze", note: "Three hints.", className: "border-[#B07A4A] bg-[#B07A4A] text-ink" },
} as const;

export function Completion({ lesson, state, onReplay }: { lesson: Lesson; state: LessonState; onReplay(): void }) {
  const award = lesson.challenge ? MEDALS[medal(state.hintsUsed)] : null;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/80 py-8 backdrop-blur-sm">
      <motion.div
        role="dialog"
        aria-label="Lesson complete"
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={cx("m-auto w-full rounded-xl border border-amber-line bg-guide p-8 shadow-2xl", lesson.challenge ? "max-w-2xl" : "max-w-lg")}
      >
        <p className="font-mono text-[11px] tracking-[0.12em] text-ok uppercase">{lesson.challenge ? "Challenge complete" : "Lesson complete"}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-fg">{lesson.number + " " + lesson.title}</h2>
        <div className="mt-5 flex gap-8 text-sm">
          {award && (
            <div data-testid="medal">
              <p className="text-muted">Medal</p>
              <p className="mt-1 flex items-center gap-2">
                <span className={cx("rounded-full border px-2.5 py-0.5 text-xs font-semibold", award.className)}>{award.label}</span>
                <span className="text-xs text-muted">{award.note}</span>
              </p>
            </div>
          )}
          <div>
            <p className="text-muted">Mistakes</p>
            <p className="mt-0.5 font-mono text-lg text-fg">{state.mistakes}</p>
          </div>
          {!lesson.challenge && (
            <div>
              <p className="text-muted">Keys earned</p>
              <p className="mt-1 flex gap-1.5">
                {state.keys.length ? state.keys.map((k) => <Keycap key={k}>{k}</Keycap>) : <span className="text-faint">none</span>}
              </p>
            </div>
          )}
        </div>

        {lesson.challenge && (
          <>
            <h3 className="mt-7 text-sm font-medium text-fg">What you just did</h3>
            <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm/5.5 text-muted marker:text-amber">
              {lesson.debrief.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <div className="mt-4">
              <SourceCard lesson={lesson} region="" />
            </div>
          </>
        )}

        <h3 className="mt-7 text-sm font-medium text-fg">Try it on your own machine</h3>
        <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-sm/5.5 text-muted marker:text-amber">
          {lesson.tryIt.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>

        <div className="mt-8 flex items-center gap-3">
          <Link to="/" className="flex h-9 items-center rounded-md bg-amber px-4 text-sm font-medium text-ink">
            Back to the course
          </Link>
          <button
            type="button"
            onClick={onReplay}
            className="h-9 rounded-md border border-amber-line px-4 text-sm text-fg hover:border-amber-dim"
          >
            Replay lesson
          </button>
          <a
            href={lessonFeedbackUrl(lesson.id)}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-[13px] text-muted hover:text-amber"
          >
            Suggest a fix for this lesson ↗
          </a>
        </div>
      </motion.div>
    </div>
  );
}
