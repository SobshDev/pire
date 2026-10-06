import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { catalog, getLesson, type CatalogLesson } from "@pire/content";
import { meQuery, progressQuery } from "../api/queries";
import type { LessonProgress } from "../api/client";
import { savedMedal, type Medal } from "../engine/lesson";
import { cx, GitHubMark, REPO_URL } from "../ui/bits";
import { SiteHeader } from "../ui/SiteHeader";

const MEDAL_STYLE: Record<Medal, string> = {
  gold: "bg-amber-fill text-on-amber",
  silver: "bg-[#C9C4BA] text-on-amber",
  bronze: "bg-[#B07A4A] text-on-amber",
};

export function CatalogPage() {
  const { data: me } = useQuery(meQuery);
  const { data: progress = [] } = useQuery(progressQuery);
  const byLesson = new Map(progress.map((p) => [p.lesson_id, p]));

  return (
    <div className="min-h-full">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-6 py-14">
        <p className="font-mono text-[11px] tracking-[0.12em] text-amber uppercase">Start here</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-fg">Learn the tools by using them.</h1>
        <p className="mt-3 max-w-xl text-[15px]/6 text-muted">
          Each lesson puts you in a real debugger layout, paused on a real program. You click, type, and press keys,
          and the guide checks every step. Ten minutes a lesson, no setup.
        </p>
        {!me && (
          <p className="mt-3 max-w-xl text-[13px]/5 text-faint">
            No account needed. Your progress is saved in this browser, and{" "}
            <Link to="/register" className="text-amber hover:underline">
              creating an account
            </Link>{" "}
            keeps it on any device.
          </p>
        )}

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

        <footer className="mt-16 rounded-lg border border-amber-line bg-guide px-6 py-5">
          <h2 className="text-sm font-medium text-fg">pire is open source</h2>
          <p className="mt-1.5 text-[13px]/5 text-muted">
            Lessons and tools are built in the open. Fix a typo, sharpen a hint, design the next module, or
            improve the debugger. Beginners welcome.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
            <a
              href={REPO_URL + "/blob/main/CONTRIBUTING.md"}
              target="_blank"
              rel="noreferrer"
              className="flex h-7 items-center gap-1.5 rounded-md bg-amber-fill px-2.5 font-medium text-on-amber"
            >
              <GitHubMark className="size-3.5" />
              How to contribute
            </a>
            <a href={REPO_URL + "/issues"} target="_blank" rel="noreferrer" className="text-fg hover:text-amber">
              Open issues
            </a>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-fg hover:text-amber">
              Source on GitHub
            </a>
            <span className="text-faint">Code MIT · Lessons CC BY-SA 4.0</span>
          </div>
        </footer>
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
  const earned = playable && progress && getLesson(lesson.id)?.challenge ? savedMedal(progress.state, done) : undefined;

  const body = (
    <>
      <span className="w-8 shrink-0 font-mono text-xs text-amber">{lesson.number}</span>
      <span className={cx("grow text-sm", playable ? "text-fg" : "text-faint")}>{lesson.title}</span>
      {earned && (
        <span data-testid={"medal-" + lesson.id} className={cx("rounded-full px-2 py-px text-[11px] font-semibold capitalize", MEDAL_STYLE[earned])}>
          {earned}
        </span>
      )}
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
