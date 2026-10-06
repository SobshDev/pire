import { Link, useSearch } from "@tanstack/react-router";
import { setThemeMode, useThemeMode, type ThemeMode } from "../theme";
import { cx } from "../ui/bits";
import { SiteHeader } from "../ui/SiteHeader";

export function SettingsPage() {
  const { back } = useSearch({ from: "/settings" });
  const mode = useThemeMode();
  return (
    <div className="min-h-full">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link to={back ?? "/"} className="flex w-fit items-center gap-1.5 text-[13px] text-muted hover:text-fg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {back ? "Back to the lesson" : "Back to lessons"}
        </Link>
        <h1 className="mt-7 text-[34px]/10 font-semibold tracking-tight text-fg">Appearance</h1>

        <section className="mt-11" aria-labelledby="interface">
          <h2 id="interface" className="text-[15px] font-medium text-fg">
            Interface
          </h2>
          <div className="mt-3.5 flex items-center justify-between rounded-2xl border border-line bg-panel py-5 pr-5 pl-7">
            <p id="mode" className="text-[15px] font-medium text-fg">
              Mode
            </p>
            <div role="radiogroup" aria-labelledby="mode" className="flex gap-3.5">
              {MODES.map((m) => (
                <ModeOption key={m.id} {...m} selected={mode === m.id} onSelect={() => setThemeMode(m.id)} />
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

const MODES: { id: ThemeMode; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

function ModeOption({ id, label, selected, onSelect }: { id: ThemeMode; label: string; selected: boolean; onSelect(): void }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onSelect} className="group flex flex-col items-center gap-2.5">
      <span
        className={cx(
          "rounded-xl border-2 p-0.75 transition-colors",
          selected ? "border-amber-fill" : "border-transparent group-hover:border-line",
        )}
      >
        <span className="relative block h-25 w-39 overflow-hidden rounded-lg border border-line">
          {id === "light" ? (
            <Thumb palette={LIGHT} />
          ) : id === "dark" ? (
            <Thumb palette={DARK} />
          ) : (
            <>
              <Thumb palette={DARK} />
              <span className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
                <Thumb palette={LIGHT} />
              </span>
            </>
          )}
        </span>
      </span>
      <span className={cx("text-[13px]", selected ? "font-semibold text-fg" : "text-muted")}>{label}</span>
    </button>
  );
}

/** Fixed colors: each thumbnail shows its own theme whatever the current one is. */
type Palette = { bg: string; bar: string; line: string; text: string; hi: string };
const LIGHT: Palette = { bg: "#FFFFFF", bar: "#F7F6F3", line: "#E6E3DC", text: "#C9C4BA", hi: "#FFE2A6" };
const DARK: Palette = { bg: "#121110", bar: "#16120B", line: "#2A2620", text: "#4F493F", hi: "#3A2C10" };
const AMBER = "#FFB224";

/** A tiny debugger: title bar, disassembly with the RIP row lit, registers. */
function Thumb({ palette: p }: { palette: Palette }) {
  const bar = (w: number, c = p.text) => <span className="block h-0.75 rounded-full" style={{ width: w, backgroundColor: c }} />;
  return (
    <span className="absolute inset-y-0 left-0 flex w-39 flex-col" style={{ backgroundColor: p.bg }} aria-hidden>
      <span className="flex h-3.5 shrink-0 items-center gap-1 border-b px-1.75" style={{ backgroundColor: p.bar, borderColor: p.line }}>
        {bar(10, AMBER)}
        {bar(40)}
      </span>
      <span className="flex grow">
        <span className="flex w-26 flex-col gap-1.25 border-r px-1.75 py-2" style={{ borderColor: p.line }}>
          {bar(70)}
          {bar(56)}
          <span className="flex h-2.25 items-center rounded-xs px-0.75" style={{ backgroundColor: p.hi }}>
            {bar(60, AMBER)}
          </span>
          {bar(76)}
          {bar(48)}
          {bar(64)}
        </span>
        <span className="flex flex-col gap-1.25 px-1.5 py-2">
          {bar(30)}
          {bar(24, AMBER)}
          {bar(30)}
          {bar(20)}
        </span>
      </span>
    </span>
  );
}
