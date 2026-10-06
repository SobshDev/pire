import type { ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * macOS keeps Ctrl+F1 to Ctrl+F8 for itself (Ctrl+F2 focuses the menu bar), so the page never sees them.
 * On a Mac, Cmd stands in for Ctrl, and key names in lesson text say so.
 */
export const IS_MAC =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || navigator.userAgent);

export const keyLabel = (text: string) => (IS_MAC ? text.replace(/\bCtrl\+(?=\S)/g, "Cmd+") : text);

/** Where the project lives. Contribute links in the app point here. */
export const REPO_URL = "https://github.com/SobshDev/pire";

/** A prefilled lesson feedback issue (see .github/ISSUE_TEMPLATE/lesson-feedback.yml). */
export function lessonFeedbackUrl(lessonId: string, step?: string): string {
  const q = new URLSearchParams({ template: "lesson-feedback.yml", lesson: lessonId });
  if (step) q.set("step", step);
  return REPO_URL + "/issues/new?" + q.toString();
}

export function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-baseline gap-px select-none" aria-label="pire">
      <span className="text-[21px]/5.5 text-amber">π</span>
      <span className="text-base/5.5 font-bold text-fg">RE</span>
    </span>
  );
}

export function Keycap({ children, small }: { children: ReactNode; small?: boolean }) {
  return (
    <kbd
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-sm border border-b-2 border-faint bg-raised font-mono font-medium text-fg",
        small ? "min-w-5 px-1 py-px text-[11px]/3.5" : "min-w-7 px-1.5 py-0.5 text-[13px]/4",
      )}
    >
      {typeof children === "string" ? keyLabel(children) : children}
    </kbd>
  );
}

export function GearIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
