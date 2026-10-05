import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { catalog, getFile, getRecording, type Lesson, type PaneId } from "@pire/content";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useSaveProgress } from "../api/queries";
import { bestMedal, DEBUG_KEYS, initialState, medal, reduce, revealed, toolOf, type Medal, type PlayerEvent, type PlayerState, type Resume } from "../engine/lesson";
import { cx, Keycap, Logo } from "../ui/bits";
import { Completion } from "./Completion";
import { CommandBar, StatusBar, WindowChrome } from "./debugger/Chrome";
import { Disassembly, type DisassemblyHandle } from "./debugger/Disassembly";
import { Dump } from "./debugger/Dump";
import { ConsoleWindow, ContextMenu, GotoDialog, menuFor, MessageBox } from "./debugger/Overlays";
import { Locked, Pane } from "./debugger/Pane";
import { Registers } from "./debugger/Registers";
import { SourceView } from "./debugger/SourceView";
import { Stack } from "./debugger/Stack";
import { TabView } from "./debugger/TabView";
import { ChipBody, Guide } from "./Guide";
import { HexView, Inspector } from "./hex/HexView";
import { PeView } from "./pe/PeView";
import { ToolChrome } from "./ToolChrome";
import { Tutor } from "./Tutor";
import type { TutorContext } from "./tutorTools";
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

export function Player({ lesson, resume, earned }: { lesson: Lesson; resume?: Resume; earned?: Medal }) {
  const [state, dispatch] = useReducer(
    (s: PlayerState, a: Action) => (a.type === "reset" ? initialState(lesson) : reduce(lesson, s, a)),
    resume,
    (r) => initialState(lesson, r),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [rail, setRail] = useState<"guide" | "ask">("guide");
  const [askOpened, setAskOpened] = useState(false);
  const [tutorPoints, setTutorPoints] = useState<ReadonlySet<string>>(new Set());
  const [prefill, setPrefill] = useState<{ text: string; n: number } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ target: string; x: number; y: number } | null>(null);
  const disasm = useRef<DisassemblyHandle>(null);
  const { lesson: ls, session } = state;
  const step = lesson.steps[ls.stepIndex];
  const rec = getRecording(session.recording);
  const tool = toolOf(session);
  const fileId = session.file ?? lesson.start.file ?? null;
  const file = fileId ? getFile(fileId) : null;
  const found = useMemo(() => revealed(lesson, ls), [lesson, ls]);

  // Misses on the current step: the lesson counts mistakes across the whole lesson.
  const stepStart = useRef({ step: ls.stepIndex, mistakes: ls.mistakes });
  if (stepStart.current.step !== ls.stepIndex) stepStart.current = { step: ls.stepIndex, mistakes: ls.mistakes };
  const misses = ls.mistakes - stepStart.current.mistakes;

  useEffect(() => {
    if (rail === "ask") setAskOpened(true);
  }, [rail]);
  // What the tutor pointed at belongs to the step it was asked about.
  useEffect(() => setTutorPoints(new Set()), [ls.stepIndex]);

  // Save after every step change. The first render is the state we just loaded.
  const save = useSaveProgress(lesson.id);
  const loaded = useRef(true);
  const latest = useRef(state);
  latest.current = state;
  const missesRef = useRef(misses);
  missesRef.current = misses;
  const tutorContext = useCallback(
    (): TutorContext => ({
      lesson,
      state: latest.current.lesson,
      rec: getRecording(latest.current.session.recording),
      session: latest.current.session,
      misses: missesRef.current,
      point(target) {
        setTutorPoints((s) => new Set(s).add(target));
        const el = document.querySelector("[data-target='" + CSS.escape(target) + "']");
        requestAnimationFrame(() => el?.scrollIntoView({ block: "nearest" }));
        return !!el;
      },
      showSource: () => setSourceOpen(true),
    }),
    [lesson],
  );
  // The best medal so far, kept across replays in this visit too.
  const best = useRef(earned);
  useEffect(() => {
    if (loaded.current) {
      loaded.current = false;
      return;
    }
    const s = latest.current;
    if (lesson.challenge && s.lesson.done) best.current = bestMedal(best.current, medal(s.lesson.hintsUsed));
    save.mutate({
      beat_index: s.lesson.stepIndex,
      completed: s.lesson.done,
      // hintsUsed decides a challenge's medal, so it has to survive a reload.
      state: {
        mistakes: s.lesson.mistakes,
        keys: s.lesson.keys,
        hintsUsed: s.lesson.hintsUsed,
        ...(best.current ? { medal: best.current } : {}),
        session: { ...s.session, log: s.session.log.slice(-50) },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ls.stepIndex, ls.done]);

  // Following an address selects its line, like x64dbg does.
  useEffect(() => {
    if (session.view) setSelected("disasm:" + session.view);
  }, [session.view]);

  // Going somewhere in the debugger (following an address, opening another tab) leaves the Source tab.
  useEffect(() => {
    if (session.view) setSourceOpen(false);
  }, [session.view]);
  useEffect(() => {
    if (session.tab !== "CPU") setSourceOpen(false);
  }, [session.tab]);

  // Debugger keys go to the lesson, never to the browser.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.altKey) return;
      // Function keys and Ctrl+G work from anywhere, like the real tools' global shortcuts; other keys belong to the text box.
      const fKey = /^F([1-9]|1[0-2])$/.test(e.key) || (e.ctrlKey && e.key.toLowerCase() === "g");
      if (isTyping(e.target) && !fKey) return;
      const key = keyName(e);
      if (!key) return;
      if (fKey || DEBUG_KEYS.has(key)) {
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
      } else if (key === "S" && !lesson.challenge) {
        setSourceOpen((o) => !o);
      } else if (key === "?") {
        setRail("ask");
      } else if (key === "Escape") {
        setRail("guide");
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
      tutor: tutorPoints,
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
      file,
      revealed: found,
      select(start, length, pane) {
        if (!blocked(pane)) dispatch({ type: "select", start, length });
      },
      locks: lesson.locks,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rec, session, spot.spotPane, spot.spotPart, ls.phase, ls.placed, step, selected, matching, blocked, file, found, tutorPoints],
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
              {lesson.challenge ? (
                <span className="text-xs text-faint">Source unlocks when you finish</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setSourceOpen((o) => !o)}
                  aria-pressed={sourceOpen}
                  className="flex h-7 items-center gap-1.5 rounded-md border border-amber-line px-2.5 text-xs text-fg hover:border-amber-dim aria-pressed:border-amber aria-pressed:bg-rip"
                >
                  Source <Keycap small>S</Keycap>
                </button>
              )}
            </header>

            <div className="flex min-h-0 grow">
              <div className="relative flex min-w-0 grow flex-col overflow-hidden">
                {tool === "x64dbg" ? (
                  <WindowChrome
                    onTab={(tab) => {
                      setSourceOpen(false);
                      dispatch({ type: "tab", tab });
                    }}
                    source={lesson.challenge ? undefined : { open: sourceOpen, toggle: () => setSourceOpen((o) => !o) }}
                  />
                ) : (
                  <ToolChrome lesson={lesson} />
                )}
                {sourceOpen && !lesson.challenge ? (
                  <SourceView source={lesson.source} live={tool === "x64dbg"} />
                ) : tool === "hex" && file ? (
                  <div className="flex min-h-0 grow">
                    <HexView />
                    <Inspector />
                  </div>
                ) : tool === "pe" && file ? (
                  <PeView />
                ) : session.tab === "CPU" ? (
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
                {tool === "x64dbg" && (
                  <>
                    <CommandBar lock={lesson.locks.command} onCommand={(text) => dispatch({ type: "command", surface: "command", text })} />
                    <StatusBar />
                  </>
                )}
                <MessageBox />
                {session.goto && (
                  <GotoDialog
                    pane={session.goto}
                    onClose={() => dispatch({ type: "closeGoto" })}
                    onSubmit={(text) => dispatch({ type: "command", surface: "goto", text })}
                  />
                )}
              </div>
              <div className="flex w-85 shrink-0 flex-col border-l border-amber-line bg-guide">
                <div role="tablist" aria-label="Guide or tutor" className="flex h-10 shrink-0 border-b border-amber-line">
                  <RailTab active={rail === "guide"} onClick={() => setRail("guide")} align="left">
                    Guide
                  </RailTab>
                  <RailTab active={rail === "ask"} onClick={() => setRail("ask")} align="right">
                    Ask
                  </RailTab>
                </div>
                <div className={cx("flex min-h-0 grow flex-col", rail !== "guide" && "hidden")}>
                  <Guide
                    lesson={lesson}
                    state={ls}
                    dispatch={dispatch}
                    misses={misses}
                    onTalk={() => {
                      setRail("ask");
                      setPrefill({ text: "I've missed this three times. Can you talk me through it?", n: Date.now() });
                    }}
                  />
                </div>
                {askOpened && (
                  <div className={cx("flex min-h-0 grow flex-col", rail !== "ask" && "hidden")}>
                    <Tutor
                      lesson={lesson}
                      context={tutorContext}
                      prefill={prefill}
                      active={rail === "ask"}
                      onAsk={() => setTutorPoints(new Set())}
                      onGuide={() => setRail("guide")}
                    />
                  </div>
                )}
              </div>
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


/** Guide | Ask: the two halves of the rail's tab bar, each label hugging its outer edge. */
function RailTab({ active, onClick, align, children }: { active: boolean; onClick(): void; align: "left" | "right"; children: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cx(
        "-mb-px flex flex-1 items-center border-b-2 px-5 text-[13px] font-medium transition-colors",
        align === "left" ? "justify-start" : "justify-end",
        active ? "border-amber bg-[#1E180E] text-fg" : "border-transparent text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
