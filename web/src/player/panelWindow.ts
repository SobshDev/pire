import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A separate browser window for one panel of the player, so it can sit on a second screen. The window
 * stays empty and same-site: the player renders into it with a portal, so the panel keeps its live
 * state. This copies the app's styles and theme across and keeps them in step.
 */
export function usePanelWindow(name: string, title: string, bodyClass: string) {
  const [win, setWin] = useState<Window | null>(null);

  /** Opens the window, or focuses it. False when the browser blocked it. */
  const open = useCallback((): boolean => {
    if (win && !win.closed) {
      win.focus();
      return true;
    }
    // Must run inside the click that asked for it, or the browser blocks the window.
    const w = window.open("", name, "popup,width=480,height=820");
    if (!w) return false;
    const doc = w.document;
    // The same name can hand back a window left over from before; start it over.
    doc.head.replaceChildren();
    doc.body.replaceChildren();
    const base = doc.createElement("base");
    base.href = document.baseURI;
    doc.head.append(base);
    doc.body.className = bodyClass;
    Object.assign(doc.body.style, { margin: "0", height: "100vh", display: "flex", flexDirection: "column" });
    setWin(w);
    return true;
  }, [win, name, bodyClass]);

  const close = useCallback(() => {
    setWin(null);
    win?.close();
  }, [win]);

  useEffect(() => {
    if (!win) return;
    const stop = mirror(win);
    // Closing a popup doesn't reliably fire an event the opener can see.
    const timer = setInterval(() => win.closed && setWin(null), 300);
    const leave = () => win.close();
    window.addEventListener("pagehide", leave);
    return () => {
      stop();
      clearInterval(timer);
      window.removeEventListener("pagehide", leave);
    };
  }, [win]);

  useEffect(() => {
    if (win) win.document.title = title;
  }, [win, title]);

  // Leaving the lesson takes its window with it.
  const latest = useRef(win);
  latest.current = win;
  useEffect(() => () => latest.current?.close(), []);

  return { win, open, close };
}

/** Copies the styles and the theme into the window now and whenever they change (theme switch, dev reloads). */
function mirror(win: Window): () => void {
  const doc = win.document;
  const styles = () => {
    doc.head.querySelectorAll("[data-mirrored]").forEach((n) => n.remove());
    for (const n of document.head.querySelectorAll("style, link[rel='stylesheet'], meta[name='color-scheme']")) {
      const copy = n.cloneNode(true) as HTMLElement;
      copy.dataset.mirrored = "";
      doc.head.append(copy);
    }
  };
  const theme = () => {
    const t = document.documentElement.dataset.theme;
    if (t) doc.documentElement.dataset.theme = t;
  };
  styles();
  theme();
  const head = new MutationObserver(styles);
  head.observe(document.head, { childList: true, subtree: true, characterData: true });
  const root = new MutationObserver(theme);
  root.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => {
    head.disconnect();
    root.disconnect();
  };
}
