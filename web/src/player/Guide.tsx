import { useDraggable } from "@dnd-kit/core";
import type { Lesson, Step } from "@pire/content";
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import type { LessonState, PlayerEvent } from "../engine/lesson";
import { cx, Keycap } from "../ui/bits";
import { plain, Rich } from "../ui/Rich";
import { Diagram } from "./Diagrams";

interface GuideProps {
  lesson: Lesson;
  state: LessonState;
  dispatch(event: PlayerEvent): void;
  /** Wrong answers on the current step. */
  misses: number;
  /** Open the Ask tab to talk the step through with the tutor. */
  onTalk(): void;
}

export function Guide({ lesson, state, dispatch, misses, onTalk }: GuideProps) {
  if (lesson.challenge) return <ChallengeGuide lesson={lesson} state={state} dispatch={dispatch} misses={misses} onTalk={onTalk} />;
  const step = lesson.steps[state.stepIndex];
  if (!step) return <aside className="min-h-0 grow bg-guide" />;

  const sameSection = lesson.steps.filter((s) => s.section === step.section);
  const position = lesson.steps.slice(0, state.stepIndex + 1).filter((s) => s.section === step.section).length;
  const kicker = (step.section === "beat" ? "Beat " : "Checkpoint ") + position + " · " + step.kind;
  const sourceRegion = step.source;

  return (
    <aside className="flex min-h-0 grow flex-col bg-guide" aria-label="Guide">
      <div className="shrink-0 px-5 pt-4">
        <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.12em] uppercase">
          <span className="text-amber" data-testid="guide-kicker">{kicker}</span>
          <span className="text-muted">{position + " / " + sameSection.length}</span>
        </div>
        <div className="mt-2.5 flex gap-0.75">
          {lesson.steps.map((s, i) => (
            <span
              key={i}
              className={cx(
                "h-1 grow rounded-full transition-colors duration-300",
                i < state.stepIndex || (i === state.stepIndex && state.phase === "success")
                  ? "bg-amber-fill"
                  : i === state.stepIndex
                    ? "bg-amber-dim"
                    : "bg-line",
                s.section === "checkpoint" && lesson.steps[i - 1]?.section === "beat" && "ml-2",
              )}
            />
          ))}
        </div>
      </div>

      <div className="pane-scroll min-h-0 grow overflow-y-auto px-5 pt-5 pb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={state.stepIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-4"
          >
            {state.banner && (
              <p className="self-start rounded-full border border-amber-dim bg-amber-bg px-3 py-1 font-mono text-[11px] text-amber" data-testid="banner">
                <Rich text={state.banner} />
              </p>
            )}
            <h2 className="text-lg/6 font-semibold text-fg">{step.title}</h2>
            <p className="text-[15px]/6.5 whitespace-pre-line text-fg">
              <Rich text={step.say} />
            </p>
            {step.action && state.phase === "asking" && (
              <ActionRow>
                <span>
                  <Rich text={step.action} />
                </span>
              </ActionRow>
            )}
            {(step.free || step.gate.type === "goal") && state.phase === "asking" && (
              <p className="self-start rounded-sm bg-raised px-2 py-1 font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
                Free play · every key works
              </p>
            )}
            {step.figure && <Figure figure={step.figure} />}
            {step.diagram && <Diagram id={step.diagram} />}
            {step.frame && <Frame frame={step.frame} />}
            <GateUI step={step} state={state} dispatch={dispatch} />
            <FeedbackBox state={state} step={step} dispatch={dispatch} />
            <TalkCard key={state.stepIndex} show={misses >= 3 && state.phase === "asking"} onTalk={onTalk} />
            {step.hints.length > 0 && state.phase === "asking" && state.hintsShown < step.hints.length && (
              <button
                type="button"
                onClick={() => dispatch({ type: "hint" })}
                className="self-start text-xs text-muted underline decoration-faint underline-offset-4 hover:text-amber"
              >
                {"Need a hint? (" + (step.hints.length - state.hintsShown) + " left)"}
              </button>
            )}
            {sourceRegion !== undefined && <SourceCard lesson={lesson} region={sourceRegion} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-amber-line px-5 py-3">
        <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">Keys</span>
        {state.keys.length === 0 ? (
          <span className="text-xs text-faint">none yet</span>
        ) : (
          state.keys.map((k) => <Keycap key={k}>{k}</Keycap>)
        )}
      </div>
    </aside>
  );
}

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 1009, 7);

/** Challenges: the goal list, the current goal's answer box, and a shared pool of hint tokens. */
function ChallengeGuide({ lesson, state, dispatch, misses, onTalk }: GuideProps) {
  const step = lesson.steps[state.stepIndex];
  const tokensLeft = lesson.hintTokens - state.hintsUsed;
  const revealed = step ? step.hints.slice(0, state.hintsShown) : [];
  return (
    <aside className="flex min-h-0 grow flex-col bg-guide" aria-label="Guide">
      <div className="shrink-0 px-5 pt-4">
        <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.12em] uppercase">
          <span className="text-amber" data-testid="guide-kicker">Challenge · no guide</span>
          <span className="text-muted">{Math.min(state.stepIndex + 1, lesson.steps.length) + " / " + lesson.steps.length}</span>
        </div>
        <p className="mt-3 text-sm/6 text-muted">
          <Rich text={lesson.mission} />
        </p>
      </div>

      <div className="pane-scroll min-h-0 grow overflow-y-auto px-5 pt-4 pb-6">
        {state.banner && (
          <p className="mb-3 inline-block rounded-full border border-amber-dim bg-amber-bg px-3 py-1 font-mono text-[11px] text-amber" data-testid="banner">
            <Rich text={state.banner} />
          </p>
        )}
        <ol className="flex flex-col gap-1.5" aria-label="Goals">
          {lesson.steps.map((s, i) => {
            const done = i < state.stepIndex || (i === state.stepIndex && state.phase === "success");
            const current = i === state.stepIndex;
            return (
              <li
                key={i}
                data-testid={"goal-" + (i + 1)}
                className={cx(
                  "rounded-md border px-3 py-2.5",
                  current ? "border-amber-dim bg-amber-bg" : "border-transparent",
                  !current && !done && "opacity-45",
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cx(
                      "flex size-4.5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px]",
                      done ? "border-ok bg-ok text-panel" : current ? "border-amber text-amber" : "border-line text-faint",
                    )}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <span className={cx("text-sm", done ? "text-muted" : "text-fg")}>{s.title}</span>
                </div>
                {current && (
                  <div className="mt-2.5 flex flex-col gap-3 pl-7">
                    <p className="text-[14px]/6 whitespace-pre-line text-fg">
                      <Rich text={s.say} />
                    </p>
                    <GateUI step={s} state={state} dispatch={dispatch} />
                    {/* Hints show in the list below, so the feedback box only carries answers and nudges. */}
                    {(state.phase === "success" || state.feedback?.tone !== "hint") && <FeedbackBox state={state} step={s} dispatch={dispatch} />}
                    <TalkCard key={state.stepIndex} show={misses >= 3 && state.phase === "asking"} onTalk={onTalk} />
                    {revealed.map((h, n) => (
                      <Box key={h} tone="hint" title={["Nudge", "Pointer", "Answer"][n] ?? "Hint"}>
                        <Rich text={h} />
                      </Box>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="flex shrink-0 items-center gap-3 border-t border-amber-line px-5 py-3">
        <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">Hint tokens</span>
        <span className="flex gap-1" aria-label={tokensLeft + " hint tokens left"}>
          {Array.from({ length: lesson.hintTokens }, (_, i) => (
            <span key={i} className={cx("size-2.5 rounded-full", i < tokensLeft ? "bg-amber-fill" : "bg-line")} />
          ))}
        </span>
        <span className="grow" />
        {step && state.phase === "asking" && tokensLeft > 0 && state.hintsShown < step.hints.length && (
          <button type="button" onClick={() => dispatch({ type: "hint" })} className="text-xs text-muted underline decoration-faint underline-offset-4 hover:text-amber">
            Spend one
          </button>
        )}
      </div>
    </aside>
  );
}

function Figure({ figure }: { figure: NonNullable<Step["figure"]> }) {
  return (
    <div className="rounded-md border border-line bg-ink p-3 font-mono text-xs" data-testid="figure">
      {figure.caption && <p className="mb-2 font-sans text-[11px] text-muted">{figure.caption}</p>}
      {figure.rows.map((row) => (
        <div key={row.label} className="flex items-center gap-3 py-0.5">
          <span className="w-20 shrink-0 font-sans text-[11px] text-muted">{row.label}</span>
          <span className="flex flex-wrap gap-x-1.5">
            {row.bytes.split(" ").map((b, i) => (
              <span key={i} className={row.highlight.includes(i) ? "rounded-xs bg-amber-fill px-0.5 text-on-amber" : "px-0.5 text-fg"}>
                {b}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

function ActionRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-amber-line bg-amber-bg px-3 py-2.5 text-sm text-amber">
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden className="shrink-0">
        <path d="M3 2l10 6-4.5 1.2L6.5 14z" fill="currentColor" />
      </svg>
      {children}
    </div>
  );
}

function GateUI({ step, state, dispatch }: { step: Step; state: LessonState; dispatch(e: PlayerEvent): void }) {
  const gate = step.gate;
  const answered = state.phase === "success";
  switch (gate.type) {
    case "continue":
      return (
        <button type="button" onClick={() => dispatch({ type: "continue" })} className={primary}>
          {gate.label}
          <Keycap small>↵</Keycap>
        </button>
      );
    case "choose":
      return (
        <div className="flex flex-col gap-2">
          {gate.options.map((o, i) => {
            const picked = state.chosen === o.id;
            const right = picked && answered;
            const wrong = picked && !answered && state.feedback?.tone === "wrong";
            return (
              <button
                key={o.id}
                type="button"
                disabled={answered}
                onClick={() => dispatch({ type: "choose", id: o.id })}
                className={cx(
                  "flex items-start gap-3 rounded-md border px-3 py-2.5 text-left text-sm/5 text-fg transition-colors",
                  right ? "border-ok bg-ok-bg" : wrong ? "border-bad bg-bad-bg" : "border-line bg-ink hover:border-amber-dim",
                  answered && !picked && "opacity-50",
                )}
              >
                <span className={cx("font-mono text-xs/5", right ? "text-ok" : "text-amber")}>{String.fromCharCode(65 + i)}</span>
                <span>
                  <Rich text={o.label} />
                </span>
              </button>
            );
          })}
        </div>
      );
    case "predict":
      return answered ? null : <PredictInput key={state.stepIndex} placeholder={gate.placeholder} dispatch={dispatch} />;
    case "quiz": {
      const q = gate.questions[state.answered];
      return (
        <div className="flex flex-col gap-3">
          {gate.questions.slice(0, state.answered).map((done) => (
            <p key={done.prompt} className="flex gap-2 text-[13px]/5 text-muted">
              <span className="text-ok">✓</span>
              <span>
                <Rich text={done.prompt + " "} />
                <span className="text-fg">
                  <Rich text={done.options.find((o) => o.id === done.correct)?.label ?? ""} />
                </span>
              </span>
            </p>
          ))}
          {q && !answered && (
            <>
              <p className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
                {"Question " + (state.answered + 1) + " of " + gate.questions.length}
              </p>
              <p className="text-sm/6 text-fg" data-testid="quiz-prompt">
                <Rich text={q.prompt} />
              </p>
              <div className="flex flex-col gap-2">
                {q.options.map((o, i) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => dispatch({ type: "choose", id: o.id })}
                    className={cx(
                      "flex items-start gap-3 rounded-md border px-3 py-2 text-left text-sm/5 text-fg transition-colors",
                      state.chosen === o.id && state.feedback?.tone === "wrong" ? "border-bad bg-bad-bg" : "border-line bg-ink hover:border-amber-dim",
                    )}
                  >
                    <span className="font-mono text-xs/5 text-amber">{String.fromCharCode(65 + i)}</span>
                    <span>
                      <Rich text={o.label} />
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      );
    }
    case "order": {
      const shuffled = [...gate.items].sort((a, b) => hash(a) - hash(b));
      return (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted">Click them in order, first to last.</p>
          {shuffled.map((label) => {
            const n = state.ordered.indexOf(label);
            const picked = n >= 0 || answered;
            return (
              <button
                key={label}
                type="button"
                disabled={picked}
                onClick={() => dispatch({ type: "order", label })}
                className={cx(
                  "flex h-9 items-center gap-3 rounded-[18px] border px-4 text-left text-[13px]",
                  picked ? "border-ok bg-ok-bg text-fg" : "border-amber-dim bg-amber-bg text-fg hover:border-amber",
                )}
              >
                <span className="w-4 font-mono text-[11px] text-ok">{picked ? String((n >= 0 ? n : gate.items.indexOf(label)) + 1) : ""}</span>
                {label}
              </button>
            );
          })}
        </div>
      );
    }
    case "match":
      return (
        <div className="flex flex-col gap-2">
          {gate.items.map((item) => (
            <Chip key={item.label} label={item.label} placed={!!state.placed[item.label]} />
          ))}
        </div>
      );
    case "fill":
      return <FillCard key={state.stepIndex} gate={gate} state={state} dispatch={dispatch} />;
    case "click":
      return gate.all ? (
        <p className="text-xs text-muted" data-testid="found-count">
          {"Found " + (answered ? gate.accept.length : state.ordered.length) + " of " + gate.accept.length}
        </p>
      ) : null;
    default:
      return null;
  }
}

/** A card of answers checked together. Correct answers lock in green; wrong ones turn red. */
function FillCard({ gate, state, dispatch }: { gate: Extract<Step["gate"], { type: "fill" }>; state: LessonState; dispatch(e: PlayerEvent): void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const answered = state.phase === "success";
  return (
    <form
      className="flex flex-col gap-2 rounded-md border border-line bg-ink p-3"
      data-testid="fill-card"
      onSubmit={(e) => {
        e.preventDefault();
        dispatch({ type: "fill", values: { ...values, ...state.filled } });
      }}
    >
      {gate.fields.map((f) => {
        const done = answered || f.id in state.filled;
        const bad = state.unfilled.includes(f.id);
        const value = done ? (state.filled[f.id] ?? values[f.id] ?? f.answer) : (values[f.id] ?? "");
        const cls = cx(
          "h-8 min-w-0 grow rounded-sm border bg-panel px-2 font-mono text-[12px] text-fg outline-none focus:border-amber-dim disabled:opacity-90",
          done ? "border-ok" : bad ? "border-bad" : "border-line",
        );
        return (
          <label key={f.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
            <span className="min-w-28 flex-1 text-muted">
              <Rich text={f.label} />
            </span>
            <span className="flex min-w-36 flex-[2] items-center gap-2">
            {f.format === "choice" ? (
              <select aria-label={plain(f.label)} disabled={done} value={value} onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))} className={cls}>
                <option value="">Choose</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                aria-label={plain(f.label)}
                disabled={done}
                value={value}
                placeholder={f.placeholder}
                onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                spellCheck={false}
                autoComplete="off"
                className={cls}
              />
            )}
              <span className={cx("w-3 shrink-0 text-xs", done ? "text-ok" : "text-bad")}>{done ? "✓" : bad ? "✕" : ""}</span>
            </span>
          </label>
        );
      })}
      {!answered && (
        <button type="submit" className={cx(primary, "mt-1")}>
          Check
        </button>
      )}
    </form>
  );
}

const primary =
  "flex h-9 items-center justify-center gap-2 self-start rounded-md bg-amber-fill px-4 text-sm font-medium text-on-amber hover:brightness-110";

function PredictInput({ placeholder, dispatch }: { placeholder: string; dispatch(e: PlayerEvent): void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) dispatch({ type: "predict", value });
      }}
    >
      <input
        autoFocus
        aria-label="Your answer"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className="h-9 min-w-0 grow rounded-md border border-line bg-ink px-3 font-mono text-[13px] text-fg outline-none placeholder:text-faint focus:border-amber-dim"
      />
      <button type="submit" className={primary}>
        Check
      </button>
    </form>
  );
}

export function ChipBody({ label, state }: { label: string; state: "idle" | "dragging" | "placed" | "overlay" }) {
  return (
    <div
      className={cx(
        "flex h-9 items-center justify-between gap-3 rounded-[18px] border px-4 text-[13px]",
        state === "placed" && "border-ok bg-ok-bg text-fg",
        state === "idle" && "cursor-grab border-amber-dim bg-amber-bg text-fg hover:border-amber",
        state === "dragging" && "border-dashed border-line text-faint",
        state === "overlay" && "cursor-grabbing border-amber bg-amber-bg text-fg shadow-2xl",
      )}
    >
      <span>{label}</span>
      <span className={cx("font-mono text-[9px] tracking-[0.12em]", state === "placed" ? "text-ok" : "text-muted")}>
        {state === "placed" ? "✓ PLACED" : state === "dragging" ? "DRAGGING" : "DRAG"}
      </span>
    </div>
  );
}

function Chip({ label, placed }: { label: string; placed: boolean }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: label, disabled: placed });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} data-chip={label} className="touch-none">
      <ChipBody label={label} state={placed ? "placed" : isDragging ? "dragging" : "idle"} />
    </div>
  );
}

function FeedbackBox({ state, step, dispatch }: { state: LessonState; step: Step; dispatch(e: PlayerEvent): void }) {
  if (state.phase === "success") {
    return (
      <Box tone="ok" title="Correct">
        <span>
          <Rich text={step.success ?? ""} />
        </span>
        <button type="button" onClick={() => dispatch({ type: "continue" })} className={cx(primary, "mt-3")}>
          Continue
          <Keycap small>↵</Keycap>
        </button>
      </Box>
    );
  }
  if (!state.feedback) return null;
  const { tone, text } = state.feedback;
  return (
    <Box key={text} tone={tone} title={tone === "wrong" ? "Not quite" : tone === "hint" ? "Hint" : "Heads up"}>
      <span>
        <Rich text={text} />
      </span>
    </Box>
  );
}

function Box({ tone, title, children }: { tone: "ok" | "wrong" | "hint" | "info"; title: string; children: ReactNode }) {
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, x: tone === "wrong" ? -4 : 0 }}
      animate={{ opacity: 1, x: 0 }}
      className={cx(
        "relative overflow-hidden rounded-md py-3 pr-3.5 pl-4.5 text-sm/5.5 text-fg",
        tone === "ok" && "bg-ok-bg",
        tone === "wrong" && "bg-bad-bg",
        (tone === "hint" || tone === "info") && "bg-amber-bg",
      )}
    >
      <span
        className={cx(
          "absolute inset-y-0 left-0 w-0.75",
          tone === "ok" ? "bg-ok" : tone === "wrong" ? "bg-bad" : "bg-amber-fill",
        )}
      />
      <p className={cx("mb-1 text-[13px] font-semibold", tone === "ok" ? "text-ok" : tone === "wrong" ? "text-bad" : "text-amber")}>
        {title}
      </p>
      <div className="flex flex-col">{children}</div>
    </motion.div>
  );
}

export function SourceCard({ lesson, region }: { lesson: Lesson; region: string }) {
  const lines = lesson.source.code.split("\n");
  const range = lesson.source.regions[region];
  const [from, to] = range ?? [1, lines.length];
  const start = range ? Math.max(1, from - 3) : 1;
  const end = range ? Math.min(lines.length, to + 3) : lines.length;
  return (
    <div className="overflow-hidden rounded-md border border-line bg-ink" data-testid="source-card">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <span className="font-mono text-[11px] text-muted">{lesson.source.name}</span>
        <span className="text-[10px] text-faint">the C you're looking at</span>
      </div>
      <pre className="pane-scroll max-h-72 overflow-auto py-1.5 font-mono text-[11.5px]/4.75">
        {lines.slice(start - 1, end).map((line, i) => {
          const n = start + i;
          const hot = !!range && n >= from && n <= to;
          return (
            <div key={n} className={cx("flex pr-3", hot && "bg-rip")}>
              <span className={cx("w-8 shrink-0 pr-2 text-right", hot ? "text-amber" : "text-faint")}>{n}</span>
              <span className={hot ? "text-fg" : "text-muted"}>{line || " "}</span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}

const FRAME_KIND: Record<string, string> = {
  shadow: "border-blue/50 bg-blue/10 text-blue-text",
  ret: "border-amber-dim bg-amber-bg text-amber",
  local: "border-ok/50 bg-ok/10 text-green-text",
  arg: "border-violet/50 bg-violet/10 text-violet-text",
  saved: "border-orange/50 bg-orange/10 text-orange-text",
  pad: "border-line bg-panel text-faint",
  empty: "border-line border-dashed text-faint",
};

/** A stack frame, lowest address on top, like the stack pane. */
function Frame({ frame }: { frame: NonNullable<Step["frame"]> }) {
  return (
    <div className="rounded-md border border-line bg-ink p-3 text-xs" data-testid="frame">
      {frame.caption && <p className="mb-2 text-[11px] text-muted">{frame.caption}</p>}
      <div className="flex flex-col gap-0.5">
        {frame.rows.map((row) => (
          <div key={row.at} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-right font-mono text-[11px] text-muted">{row.at}</span>
            <span className={cx("grow rounded-xs border px-2 py-0.5 text-[12px]/4.5", FRAME_KIND[row.kind])}>{row.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-faint">Lowest address on top, like x64dbg's stack pane.</p>
    </div>
  );
}

/** After three misses on a step, offer to talk it through with the tutor. */
function TalkCard({ show, onTalk }: { show: boolean; onTalk(): void }) {
  const [dismissed, setDismissed] = useState(false);
  if (!show || dismissed) return null;
  return (
    <Box tone="info" title="Three misses. Want to talk it through?">
      <div className="mt-2 flex items-center gap-4">
        <button type="button" onClick={onTalk} className={primary}>
          Talk it through
        </button>
        <button type="button" onClick={() => setDismissed(true)} className="text-[13px] text-muted hover:text-fg">
          Try again
        </button>
      </div>
    </Box>
  );
}
