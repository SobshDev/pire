import { createContext, useContext } from "react";
import type { PaneId } from "@pire/content";

/** What every pane needs to know to draw itself for the current step. */
export interface View {
  /** Pane in the spotlight. "none" dims every pane, null dims nothing. */
  spotPane: PaneId | "none" | null;
  /** Part of the spotlit pane to ring, such as "flags". */
  spotPart: string | null;
  /** Targets ringed to confirm an answer. */
  highlights: ReadonlySet<string>;
  /** The target the learner clicked last, drawn as selected. */
  selected: string | null;
  /** True while a match checkpoint accepts drops. */
  matching: boolean;
  /** Match checkpoint labels already placed, keyed by label. */
  placed: Readonly<Record<string, string>>;
  target(id: string, pane: PaneId): void;
}

export const ViewContext = createContext<View | null>(null);

export function useView(): View {
  const view = useContext(ViewContext);
  if (!view) throw new Error("useView outside ViewContext");
  return view;
}

export function parseSpotlight(spotlight: string | undefined): Pick<View, "spotPane" | "spotPart"> {
  if (!spotlight) return { spotPane: null, spotPart: null };
  if (spotlight === "none") return { spotPane: "none", spotPart: null };
  const [pane, part] = spotlight.split(".");
  return { spotPane: pane as PaneId, spotPart: part ?? null };
}

/** "0000000140003200" + 16 * n, formatted the way x64dbg prints addresses. */
export function addHex(base: string, offset: number): string {
  return (BigInt("0x" + base) + BigInt(offset)).toString(16).toUpperCase().padStart(16, "0");
}
