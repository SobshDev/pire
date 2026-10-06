import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { meQuery, useLogout } from "../api/queries";
import { cx, GearIcon, GitHubMark, Logo, REPO_URL } from "./bits";

/** The top bar of the course pages: logo, contribute link, and the account menu. */
export function SiteHeader() {
  const { data: me } = useQuery(meQuery);
  return (
    <header className="flex h-12 items-center gap-4 border-b border-amber-line bg-guide pr-4 pl-5">
      <Link to="/" aria-label="pire home">
        <Logo />
      </Link>
      <span className="text-[13px] text-muted">Learn reverse engineering on x64 Windows</span>
      <div className="grow" />
      <a
        href={REPO_URL + "/blob/main/CONTRIBUTING.md"}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1.5 text-xs text-fg hover:text-amber"
      >
        <GitHubMark className="size-3.5" />
        Contribute
      </a>
      {!me && (
        <Link to="/register" className="h-7 rounded-md bg-amber-fill px-2.5 text-xs/7 font-medium text-on-amber">
          Create account
        </Link>
      )}
      <AccountMenu name={me?.display_name} />
    </header>
  );
}

/** Your name (or Guest) opens Settings and Sign out (or Sign in). */
function AccountMenu({ name }: { name?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const logout = useLogout();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const item = "flex h-8.5 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] text-fg hover:bg-raised";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          "flex h-7.5 items-center gap-2 rounded-full border pr-2 pl-1 text-[13px] text-fg",
          open ? "border-amber-dim bg-amber-bg" : "border-amber-line hover:border-amber-dim",
        )}
      >
        <span
          className={cx(
            "flex size-5.5 items-center justify-center rounded-full text-[11px] font-semibold",
            name ? "bg-amber-fill text-on-amber" : "bg-raised text-muted",
          )}
          aria-hidden
        >
          {name ? name.trim().charAt(0).toUpperCase() : <PersonIcon />}
        </span>
        {name ?? "Guest"}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d={open ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute top-9 right-0 z-50 flex w-52 flex-col rounded-xl border border-line bg-panel p-1.5 shadow-xl">
          <Link to="/settings" role="menuitem" className={item} onClick={() => setOpen(false)}>
            <GearIcon className="size-3.75 text-muted" />
            Settings
          </Link>
          {name ? (
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => logout.mutate(undefined, { onSuccess: () => navigate({ to: "/" }) })}
            >
              <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              Sign out
            </button>
          ) : (
            <Link to="/login" role="menuitem" className={item} onClick={() => setOpen(false)}>
              <Icon d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
              Sign in
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.75 text-muted" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="size-3" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

