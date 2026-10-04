import { Link } from "@tanstack/react-router";
import type { Lesson } from "@pire/content";
import { motion } from "motion/react";
import type { LessonState } from "../engine/lesson";
import { Keycap } from "../ui/bits";

export function Completion({ lesson, state, onReplay }: { lesson: Lesson; state: LessonState; onReplay(): void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-ink/80 backdrop-blur-sm">
      <motion.div
        role="dialog"
        aria-label="Lesson complete"
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg rounded-xl border border-amber-line bg-guide p-8 shadow-2xl"
      >
        <p className="font-mono text-[11px] tracking-[0.12em] text-ok uppercase">Lesson complete</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-fg">{lesson.number + " " + lesson.title}</h2>
        <div className="mt-5 flex gap-8 text-sm">
          <div>
            <p className="text-muted">Mistakes</p>
            <p className="mt-0.5 font-mono text-lg text-fg">{state.mistakes}</p>
          </div>
          <div>
            <p className="text-muted">Keys earned</p>
            <p className="mt-1 flex gap-1.5">
              {state.keys.length ? state.keys.map((k) => <Keycap key={k}>{k}</Keycap>) : <span className="text-faint">none</span>}
            </p>
          </div>
        </div>

        <h3 className="mt-7 text-sm font-medium text-fg">Try it on your own machine</h3>
        <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-sm/5.5 text-muted marker:text-amber">
          {lesson.tryIt.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>

        <div className="mt-8 flex gap-3">
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
        </div>
      </motion.div>
    </div>
  );
}
