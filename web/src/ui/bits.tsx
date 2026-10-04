import type { ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
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
      {children}
    </kbd>
  );
}
