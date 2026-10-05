import { createContext, useContext, type MouseEvent } from "react";
import type { Lesson, PaneId, PeFile, Recording, TraceState } from "@pire/content";
import type { Session } from "../engine/debugger";
import { cx } from "../ui/bits";

/** What every pane needs to know to draw itself for the current step. */
export interface View {
  rec: Recording;
  session: Session;
  state: TraceState;
  /** The state before the last execution key. Values that differ are drawn red. */
  prev: TraceState;
  /** Pane in the spotlight. "none" dims every pane, null dims nothing. */
  spotPane: PaneId | "none" | null;
  /** Part of the spotlit pane to ring, such as "flags". */
  spotPart: string | null;
  /** Targets ringed to confirm an answer. */
  highlights: ReadonlySet<string>;
  /** Targets pulsing to show where to act. */
  pulse: ReadonlySet<string>;
  /** The target the learner clicked last, drawn as selected. */
  selected: string | null;
  /** True while a match checkpoint accepts drops. */
  matching: boolean;
  placed: Readonly<Record<string, string>>;
  target(id: string, pane: PaneId): void;
  dblclick(id: string, pane: PaneId): void;
  menu(id: string, pane: PaneId, x: number, y: number): void;
  /** Hex viewer: the file on screen, overlay entries found so far, and selecting bytes. */
  file: PeFile | null;
  revealed: ReadonlySet<string>;
  select(start: number, length: number, pane: PaneId): void;
  locks: Lesson["locks"];
}

export const ViewContext = createContext<View | null>(null);

export function useView(): View {
  const view = useContext(ViewContext);
  if (!view) throw new Error("useView outside ViewContext");
  return view;
}

/** Props and classes that make an element a clickable, right-clickable lesson target. */
export function useTarget(id: string, pane: PaneId, base?: string) {
  const view = useView();
  const selected = view.selected === id;
  return {
    selected,
    props: {
      role: "button",
      tabIndex: -1,
      "data-target": id,
      onClick: () => view.target(id, pane),
      onDoubleClick: () => view.dblclick(id, pane),
      onContextMenu: (e: MouseEvent) => {
        e.preventDefault();
        view.target(id, pane);
        view.menu(id, pane, e.clientX, e.clientY);
      },
      className: cx(
        "cursor-default",
        base,
        view.highlights.has(id) && "relative z-10 shadow-[inset_0_0_0_1.5px_var(--color-amber)]",
        view.pulse.has(id) && "pulse-target",
      ),
    },
  };
}

export function parseSpotlight(spotlight: string | undefined): Pick<View, "spotPane" | "spotPart"> {
  if (!spotlight) return { spotPane: null, spotPart: null };
  if (spotlight === "none") return { spotPane: "none", spotPart: null };
  const [pane, part] = spotlight.split(".");
  return { spotPane: pane as PaneId, spotPart: part ?? null };
}

/** "0000000140003200" + offset, formatted the way x64dbg prints addresses. */
export function addHex(base: string, offset: number): string {
  return (BigInt("0x" + base) + BigInt(offset)).toString(16).toUpperCase().padStart(16, "0");
}
