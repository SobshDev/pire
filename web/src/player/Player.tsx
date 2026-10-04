import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { catalog, type Lesson, type PaneId } from "@pire/content";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useSaveProgress } from "../api/queries";
import { initialState, reduce, type LessonEvent, type Resume } from "../engine/lesson";
import { Keycap, Logo } from "../ui/bits";
import { Completion } from "./Completion";
import { CommandBar, StatusBar, WindowChrome } from "./debugger/Chrome";
import { Disassembly, type DisassemblyHandle } from "./debugger/Disassembly";
import { Dump } from "./debugger/Dump";
import { Locked, Pane } from "./debugger/Pane";
import { Registers } from "./debugger/Registers";
import { Stack } from "./debugger/Stack";
import { ChipBody, Guide } from "./Guide";
import { parseSpotlight, ViewContext, type View } from "./view";

type Action = LessonEvent | { type: "reset" };

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

export function Player({ lesson, resume }: { lesson: Lesson; resume?: Resume }) {
  const [state, dispatch] = useReducer(
    (s: ReturnType<typeof initialState>, a: Action) => (a.type === "reset" ? initialState(lesson) : reduce(lesson, s, a)),
    resume,
    (r) => initialState(lesson, r),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const disasm = useRef<DisassemblyHandle>(null);
  const step = lesson.steps[state.stepIndex];

  // Save after every step change. The first render is the state we just loaded.
  const save = useSaveProgress(lesson.id);
  const loaded = useRef(true);
  useEffect(() => {
    if (loaded.current) {
      loaded.current = false;
      return;
    }
    save.mutate({
      beat_index: state.stepIndex,
      completed: state.done,
      state: { mistakes: state.mistakes, keys: state.keys },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.stepIndex, state.done]);

  // Debugger keys go to the lesson, never to the browser.
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^F([1-9]|1[0-2])$/.test(e.key) || e.key === "*") {
        e.preventDefault();
        const ripOffscreen = disasm.current?.ripOffscreen() ?? false;
        dispatch({ type: "key", key: e.key, ripOffscreen });
        if (e.key === "*") disasm.current?.goToRip();
        return;
      }
      if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        dispatch({ type: "continue" });
      } else if (e.key === "s" || e.key === "S") {
        setSourceOpen((o) => !o);
      } else if (e.key === "?") {
        setHelpOpen((o) => !o);
      } else if (e.key === "Escape") {
        setHelpOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const spot = parseSpotlight(step?.spotlight);
  const matching = step?.gate.type === "match" && state.phase === "asking";

  const view = useMemo<View>(
    () => ({
      ...spot,
      highlights: new Set(state.phase === "success" ? (step?.successHighlights ?? []) : []),
      selected,
      matching,
      placed: state.placed,
      target(id: string, pane: PaneId) {
        setSelected(id);
        // Clicks in dimmed panes are not answers.
        if (spot.spotPane === "none" || (spot.spotPane && spot.spotPane !== pane)) return;
        dispatch({ type: "click", target: id });
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spot.spotPane, spot.spotPart, state.phase, state.placed, step, selected, matching],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const moduleTitle = (catalog.find((m) => m.number === lesson.module)?.title ?? "").replace(/\s*\(.*\)$/, "");
  const snapshot = lesson.snapshot;

  return (
    <>
      <div className="flex h-full items-center justify-center p-8 text-center min-[1100px]:hidden">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-fg">Lessons need a bigger screen.</p>
          <p className="mt-2 text-sm text-muted">
            The debugger layout needs at least 1100 pixels of width. Open this page on a laptop or desktop.
          </p>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={(e) => setDragging(String(e.active.id))}
        onDragCancel={() => setDragging(null)}
        onDragEnd={(e) => {
          setDragging(null);
          if (e.over) dispatch({ type: "drop", label: String(e.active.id), pane: String(e.over.id) });
        }}
      >
        <ViewContext value={view}>
          <div className="relative hidden h-full flex-col overflow-hidden min-[1100px]:flex">
            <header className="flex h-12 shrink-0 items-center gap-4 border-b border-amber-line bg-guide pr-4 pl-5">
              <Link to="/" aria-label="Back to the course">
                <Logo />
              </Link>
              <span className="text-[13px] text-muted">{"Module " + lesson.module + " · " + moduleTitle}</span>
              <span className="text-[13px] text-faint">/</span>
              <span className="font-mono text-xs text-amber">{lesson.number}</span>
              <span className="text-sm font-medium text-fg">{lesson.title}</span>
              <span className="grow" />
              <button
                type="button"
                onClick={() => setSourceOpen((o) => !o)}
                aria-pressed={sourceOpen}
                className="flex h-7 items-center gap-1.5 rounded-md border border-amber-line px-2.5 text-xs text-fg hover:border-amber-dim aria-pressed:border-amber-dim"
              >
                Source <Keycap small>S</Keycap>
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setHelpOpen((o) => !o)}
                  className="flex h-7 items-center gap-1.5 rounded-md border border-amber-line px-2.5 text-xs text-fg hover:border-amber-dim"
                >
                  <span className="font-mono text-amber">?</span> Help
                </button>
                {helpOpen && (
                  <div className="absolute top-9 right-0 z-50 w-72 rounded-lg border border-amber-line bg-guide p-4 text-[13px]/5 text-muted shadow-2xl">
                    <p className="text-fg">How lessons work</p>
                    <p className="mt-1.5">
                      The guide on the right tells you what to look at. Click, type, or press keys in the debugger to
                      answer. Wrong answers just get a nudge.
                    </p>
                    <ul className="mt-3 flex flex-col gap-1.5">
                      <li className="flex items-center gap-2"><Keycap small>↵</Keycap> continue</li>
                      <li className="flex items-center gap-2"><Keycap small>S</Keycap> show the C source</li>
                      <li className="flex items-center gap-2"><Keycap small>?</Keycap> this help</li>
                    </ul>
                  </div>
                )}
              </div>
            </header>

            <div className="flex min-h-0 grow">
              <div className="flex min-w-0 grow flex-col overflow-hidden">
                <WindowChrome snapshot={snapshot} />
                <div className="flex min-h-0 grow-[1.9] basis-0 border-b border-line">
                  <div className="flex min-w-0 grow flex-col">
                    <Disassembly snapshot={snapshot} ref={disasm} />
                    {lesson.locks.infobox && (
                      <Pane id="infobox" label="Info box" className="h-16 shrink-0 border-t border-line p-2">
                        <Locked label="Info box" lesson={lesson.locks.infobox} className="h-full rounded-sm" />
                      </Pane>
                    )}
                  </div>
                  <Registers snapshot={snapshot} callArgsLock={lesson.locks.callArgs} />
                </div>
                <div className="flex min-h-0 grow basis-0">
                  <Dump snapshot={snapshot} />
                  <Stack snapshot={snapshot} />
                </div>
                <CommandBar lock={lesson.locks.command} />
                <StatusBar snapshot={snapshot} />
              </div>
              <Guide lesson={lesson} state={state} dispatch={dispatch} sourceOpen={sourceOpen} />
            </div>

            {state.done && <Completion lesson={lesson} state={state} onReplay={() => dispatch({ type: "reset" })} />}
          </div>
        </ViewContext>
        <DragOverlay dropAnimation={null}>{dragging && <ChipBody label={dragging} state="overlay" />}</DragOverlay>
      </DndContext>
    </>
  );
}
