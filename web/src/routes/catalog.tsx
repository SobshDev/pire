import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { catalog, getLesson, type CatalogLesson } from "@pire/content";
import { meQuery, progressQuery, useLogout } from "../api/queries";
import type { LessonProgress } from "../api/client";
import { cx, Logo } from "../ui/bits";

export function CatalogPage() {
  const { data: me } = useQuery(meQuery);
  const { data: progress = [] } = useQuery({ ...progressQuery, enabled: !!me });
  const logout = useLogout();
  const navigate = useNavigate();
  const byLesson = new Map(progress.map((p) => [p.lesson_id, p]));

  return (
    <div className="min-h-full">
      <header className="flex h-12 items-center gap-4 border-b border-amber-line bg-guide pr-4 pl-5">
        <Logo />
        <span className="text-[13px] text-muted">Learn reverse engineering on x64 Windows</span>
        <div className="grow" />
        {me ? (
          <>
            <span className="text-[13px] text-muted">{me.display_name}</span>
            <button
              type="button"
              onClick={() => logout.mutate(undefined, { onSuccess: () => navigate({ to: "/" }) })}
              className="h-7 rounded-md border border-amber-line px-2.5 text-xs text-fg hover:border-amber-dim"
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="text-xs text-fg hover:text-amber">
              Sign in
            </Link>
            <Link to="/register" className="h-7 rounded-md bg-amber px-2.5 text-xs/7 font-medium text-ink">
              Create account
            </Link>
          </>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-6 py-14">
        <p className="font-mono text-[11px] tracking-[0.12em] text-amber uppercase">Start here</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-fg">Learn the tools by using them.</h1>
        <p className="mt-3 max-w-xl text-[15px]/6 text-muted">
          Each lesson puts you in a real debugger layout, paused on a real program. You click, type, and press keys,
          and the guide checks every step. Ten minutes a lesson, no setup.
        </p>

        <div className="mt-12 flex flex-col gap-10">
          {catalog.map((mod) => (
            <section key={mod.number}>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-xs text-amber">{"Module " + mod.number}</span>
                <h2 className="text-lg font-medium text-fg">{mod.title}</h2>
              </div>
              <p className="mt-1 text-[13px]/5 text-muted">{mod.goal}</p>
              <ol className="mt-4 overflow-hidden rounded-lg border border-line">
                {mod.lessons.map((lesson) => (
                  <LessonRow key={lesson.id} lesson={lesson} progress={byLesson.get(lesson.id)} />
                ))}
              </ol>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

function LessonRow({ lesson, progress }: { lesson: CatalogLesson; progress?: LessonProgress }) {
  const playable = lesson.status === "playable";
  const total = getLesson(lesson.id)?.steps.length ?? 0;
  const done = !!progress?.completed_at;
  const started = !done && !!progress && progress.beat_index > 0;
  const label = done ? "Completed" : started ? "Resume · " + progress.beat_index + "/" + total : "Start";

  const body = (
    <>
      <span className="w-8 shrink-0 font-mono text-xs text-amber">{lesson.number}</span>
      <span className={cx("grow text-sm", playable ? "text-fg" : "text-faint")}>{lesson.title}</span>
      <span className="font-mono text-[11px] text-faint">{lesson.minutes + " min"}</span>
      <span
        className={cx(
          "w-28 text-right text-xs",
          !playable && "text-faint",
          playable && done && "text-ok",
          playable && !done && "text-amber",
        )}
      >
        {playable ? (done ? "✓ " : "") + label : "Coming soon"}
      </span>
    </>
  );

  const row = "flex items-center gap-4 border-b border-line bg-panel px-4 py-3 last:border-b-0";
  return (
    <li>
      {playable ? (
        <Link to="/learn/$lessonId" params={{ lessonId: lesson.id }} className={cx(row, "hover:bg-raised")}>
          {body}
        </Link>
      ) : (
        <div className={row}>{body}</div>
      )}
    </li>
  );
}
