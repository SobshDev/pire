import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { catalog, getRecording, type Lesson, type PaneId } from "@pire/content";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useSaveProgress } from "../api/queries";
import { DEBUG_KEYS, initialState, reduce, type PlayerEvent, type PlayerState, type Resume } from "../engine/lesson";
import { Keycap, Logo } from "../ui/bits";
import { Completion } from "./Completion";
import { CommandBar, StatusBar, WindowChrome } from "./debugger/Chrome";
import { Disassembly, type DisassemblyHandle } from "./debugger/Disassembly";
import { Dump } from "./debugger/Dump";
import { ConsoleWindow, ContextMenu, GotoDialog, menuFor, MessageBox } from "./debugger/Overlays";
import { Locked, Pane } from "./debugger/Pane";
import { Registers } from "./debugger/Registers";
import { Stack } from "./debugger/Stack";
import { TabView } from "./debugger/TabView";
import { ChipBody, Guide } from "./Guide";
import { parseSpotlight, useView as useContextView, ViewContext, type View } from "./view";

type Action = PlayerEvent | { type: "reset" };

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

/** "F9", "Ctrl+F9", "Ctrl+G", "*", "Space", "Delete", as lesson gates name them. */
export function keyName(e: KeyboardEvent): string | null {
  let k = e.key;
  if (k === " ") k = "Space";
  else if (k === "Backspace" || k === "Del") k = "Delete";
  else if (k.length === 1 && k !== "*") k = k.toUpperCase();
  if (e.ctrlKey && k !== "Control") return "Ctrl+" + k;
  return k;
}

export function Player({ lesson, resume }: { lesson: Lesson; resume?: Resume }) {
  const [state, dispatch] = useReducer(
    (s: PlayerState, a: Action) => (a.type === "reset" ? initialState(lesson) : reduce(lesson, s, a)),
    resume,
    (r) => initialState(lesson, r),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ target: string; x: number; y: number } | null>(null);
  const disasm = useRef<DisassemblyHandle>(null);
  const { lesson: ls, session } = state;
  const step = lesson.steps[ls.stepIndex];
  const rec = getRecording(session.recording);

  // Save after every step change. The first render is the state we just loaded.
  const save = useSaveProgress(lesson.id);
  const loaded = useRef(true);
  const latest = useRef(state);
  latest.current = state;
  useEffect(() => {
    if (loaded.current) {
      loaded.current = false;
      return;
    }
    const s = latest.current;
    save.mutate({
      beat_index: s.lesson.stepIndex,
      completed: s.lesson.done,
      state: { mistakes: s.lesson.mistakes, keys: s.lesson.keys, session: { ...s.session, log: s.session.log.slice(-50) } },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ls.stepIndex, ls.done]);

  // Following an address selects its line, like x64dbg does.
  useEffect(() => {
    if (session.view) setSelected("disasm:" + session.view);
  }, [session.view]);

  // Debugger keys go to the lesson, never to the browser.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.altKey) return;
      const key = keyName(e);
      if (!key) return;
      if (/^F([1-9]|1[0-2])$/.test(e.key) || DEBUG_KEYS.has(key)) {
        e.preventDefault();
        const ripOffscreen = disasm.current?.ripOffscreen() ?? false;
        dispatch({ type: "key", key, ripOffscreen, selected: selectedRef.current });
        if (key === "*") requestAnimationFrame(() => disasm.current?.goToRip());
        return;
      }
      if (e.ctrlKey) return;
      if (key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        dispatch({ type: "continue" });
      } else if (key === "S") {
        setSourceOpen((o) => !o);
      } else if (key === "?") {
        setHelpOpen((o) => !o);
      } else if (key === "Escape") {
        setHelpOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const spot = parseSpotlight(step?.spotlight);
  const matching = step?.gate.type === "match" && ls.phase === "asking";
  const blocked = useCallback(
    (pane: PaneId) => spot.spotPane === "none" || (spot.spotPane !== null && spot.spotPane !== pane),
    [spot.spotPane],
  );

  const view = useMemo<View>(
    () => ({
      rec,
      session,
      state: rec.states[session.index]!,
      prev: rec.states[session.prev] ?? rec.states[session.index]!,
      ...spot,
      highlights: new Set(ls.phase === "success" ? (step?.successHighlights ?? []) : []),
      pulse: new Set(ls.phase === "asking" ? (step?.pulse ?? []) : []),
      selected,
      matching,
      placed: ls.placed,
      target(id, pane) {
        setSelected(id);
        // Clicks in dimmed panes are not answers.
        if (!blocked(pane)) dispatch({ type: "click", target: id });
      },
      dblclick(id, pane) {
        if (!blocked(pane)) dispatch({ type: "dblclick", target: id });
      },
      menu(id, pane, x, y) {
        if (!blocked(pane) && menuFor(id).length) setMenu({ target: id, x, y });
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rec, session, spot.spotPane, spot.spotPart, ls.phase, ls.placed, step, selected, matching, blocked],
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));
  const moduleTitle = (catalog.find((m) => m.number === lesson.module)?.title ?? "").replace(/\s*\(.*\)$/, "");

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
                {helpOpen && <Help />}
              </div>
            </header>

            <div className="flex min-h-0 grow">
              <div className="relative flex min-w-0 grow flex-col overflow-hidden">
                <WindowChrome onTab={(tab) => dispatch({ type: "tab", tab })} />
                {session.tab === "CPU" ? (
                  <>
                    <div className="flex min-h-0 grow-[1.9] basis-0 border-b border-line">
                      <div className="flex min-w-0 grow flex-col">
                        <Disassembly ref={disasm} />
                        <InfoBox lock={lesson.locks.infobox} />
                      </div>
                      <Registers callArgsLock={lesson.locks.callArgs} />
                    </div>
                    <div className="flex min-h-0 grow basis-0">
                      <Dump />
                      <Stack />
                    </div>
                  </>
                ) : (
                  <TabView />
                )}
                {lesson.console && <ConsoleWindow />}
                <CommandBar lock={lesson.locks.command} onCommand={(text) => dispatch({ type: "command", surface: "command", text })} />
                <StatusBar />
                <MessageBox />
                {session.goto && (
                  <GotoDialog
                    pane={session.goto}
                    onClose={() => dispatch({ type: "closeGoto" })}
                    onSubmit={(text) => dispatch({ type: "command", surface: "goto", text })}
                  />
                )}
              </div>
              <Guide lesson={lesson} state={ls} dispatch={dispatch} sourceOpen={sourceOpen} />
            </div>

            {menu && (
              <ContextMenu
                x={menu.x}
                y={menu.y}
                items={menuFor(menu.target)}
                onClose={() => setMenu(null)}
                onPick={(item) => {
                  setMenu(null);
                  dispatch({ type: "menu", target: menu.target, item });
                }}
              />
            )}
            {ls.done && <Completion lesson={lesson} state={ls} onReplay={() => dispatch({ type: "reset" })} />}
          </div>
        </ViewContext>
        <DragOverlay dropAnimation={null}>{dragging && <ChipBody label={dragging} state="overlay" />}</DragOverlay>
      </DndContext>
    </>
  );
}

function InfoBox({ lock }: { lock?: string }) {
  return (
    <Pane id="infobox" label="Info box" className="h-16 shrink-0 border-t border-line p-2">
      {lock ? <Locked label="Info box" lesson={lock} className="h-full rounded-sm" /> : <InfoLines />}
    </Pane>
  );
}

function InfoLines() {
  const view = useContextView();
  const lines = view.state.info ?? [];
  return (
    <div className="font-mono text-xs/5 text-fg" data-testid="infobox">
      {lines.length ? lines.map((l) => <p key={l} className="truncate">{l}</p>) : <p className="text-faint">{view.state.rip}</p>}
    </div>
  );
}


function Help() {
  return (
    <div className="absolute top-9 right-0 z-50 w-80 rounded-lg border border-amber-line bg-guide p-4 text-[13px]/5 text-muted shadow-2xl">
      <p className="text-fg">How lessons work</p>
      <p className="mt-1.5">
        The guide on the right tells you what to look at. Click, right-click, type, or press keys in the debugger to
        answer. Wrong answers just get a nudge.
      </p>
      <ul className="mt-3 flex flex-col gap-1.5">
        <li className="flex items-center gap-2"><Keycap small>↵</Keycap> continue</li>
        <li className="flex items-center gap-2"><Keycap small>S</Keycap> show the C source</li>
        <li className="flex items-center gap-2"><Keycap small>?</Keycap> this help</li>
      </ul>
      <p className="mt-3 text-xs text-faint">Debugger keys work like x64dbg once a lesson has taught them.</p>
    </div>
  );
}
