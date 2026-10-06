import type { CodeRow, SourceFile } from "@pire/content";
import { useLayoutEffect, useMemo, useRef } from "react";
import { moduleOf, symbolize } from "../../engine/debugger";
import { cx } from "../../ui/bits";
import { useView } from "../view";

const KEYWORDS = new Set([
  "int", "char", "void", "long", "short", "double", "float", "unsigned", "signed", "static", "const", "extern",
  "return", "if", "else", "for", "while", "do", "break", "continue", "switch", "case", "default", "sizeof",
  "struct", "typedef", "enum", "union", "goto", "__declspec",
]);

type Token = { text: string; kind: "plain" | "keyword" | "string" | "comment" };

/** Just enough C highlighting for the course's specimens: keywords, strings, comments, preprocessor lines. */
export function tokenize(line: string): Token[] {
  if (/^\s*#/.test(line)) return [{ text: line, kind: "comment" }];
  const out: Token[] = [];
  const push = (text: string, kind: Token["kind"]) => {
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += text;
    else out.push({ text, kind });
  };
  const re = /("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|\/\/.*$|\/\*.*?(?:\*\/|$)|[A-Za-z_]\w*|[^"'A-Za-z_/]+|\/)/g;
  for (const [text] of line.matchAll(re)) {
    if (text.startsWith('"') || text.startsWith("'")) push(text, "string");
    else if (text.startsWith("//") || text.startsWith("/*")) push(text, "comment");
    else push(text, KEYWORDS.has(text) ? "keyword" : "plain");
  }
  return out;
}

const TOKEN_CLASS: Record<Token["kind"], string> = {
  plain: "text-syn-plain",
  keyword: "text-syn-keyword",
  string: "text-syn-string",
  comment: "text-muted",
};

/** Where RIP is in the source: its line and the run of instructions compiled from it. */
export function ripLine(rows: CodeRow[], rip: string): { line: number; first: string; last: string; count: number } | null {
  const i = rows.findIndex((r) => r.address === rip);
  const line = rows[i]?.line;
  if (!line) return null;
  let a = i;
  let b = i;
  while (a > 0 && rows[a - 1]!.line === line) a--;
  while (b < rows.length - 1 && rows[b + 1]!.line === line) b++;
  return { line, first: rows[a]!.address, last: rows[b]!.address, count: b - a + 1 };
}

/** 0000000140001074 as the design prints it in a narrow column: 140001074. */
const short = (address: string) => address.replace(/^0+(?=.{9})/, "");

/**
 * x64dbg's Source tab: the whole C file, with the line RIP is executing lit. The learner opens it on
 * purpose, so a beat's spotlight never dims it.
 */
export function SourceView({ source, live }: { source: SourceFile; live: boolean }) {
  const view = useView();
  const scroller = useRef<HTMLDivElement>(null);
  const rip = view.state.rip;
  const exited = live && !!view.state.terminated;
  const lines = useMemo(() => source.code.split("\n").map(tokenize), [source.code]);
  const at = useMemo(() => {
    if (!live || exited) return null;
    const mod = moduleOf(view.rec, rip);
    return mod ? ripLine(mod.rows, rip) : null;
  }, [live, exited, view.rec, rip]);
  const fn = (symbolize(view.rec, rip) ?? rip).replace(/^[^.]+\./, "").replace(/\+[0-9A-F]+$/, "");

  // Keep the RIP line on screen as execution moves through the file.
  useLayoutEffect(() => {
    scroller.current?.querySelector<HTMLElement>("[data-rip]")?.scrollIntoView({ block: "nearest" });
  }, [at?.line]);

  return (
    <section aria-label="Source" className="flex min-h-0 min-w-0 grow flex-col bg-panel p-0.75">
      <div className="flex min-h-0 grow flex-col overflow-hidden rounded-[3px] border border-line bg-panel" data-testid="source-view">
        <div className="flex h-7.5 shrink-0 items-center gap-2.5 border-b border-line px-3.5 text-xs/4">
          <span className="font-mono text-fg">{source.name}</span>
          <span className="font-mono text-faint">{"C:\\pire\\src\\" + source.name}</span>
          <span className="grow" />
          {exited ? (
            <span className="text-muted">The process has exited</span>
          ) : at ? (
            <>
              <span className="text-muted">RIP is in</span>
              <span className="font-mono text-amber" data-testid="source-rip">{fn + " · line " + at.line}</span>
            </>
          ) : live ? (
            <>
              <span className="text-muted">{"No line in " + source.name + " for RIP, in"}</span>
              <span className="font-mono text-amber" data-testid="source-rip">{fn}</span>
            </>
          ) : null}
        </div>
        <div ref={scroller} className="pane-scroll min-h-0 grow overflow-auto py-2">
          {lines.map((tokens, i) => {
            const n = i + 1;
            const hot = at?.line === n;
            return (
              <div
                key={n}
                data-rip={hot || undefined}
                className={cx("flex h-5 w-max min-w-full items-center", hot && "bg-rip shadow-[inset_2px_0_0_var(--color-amber)]")}
              >
                <span className="flex h-5 w-11 shrink-0 items-center justify-end pr-1.5">
                  {hot && <span className="rounded-xs bg-amber-fill px-0.75 font-mono text-[9px]/3 font-semibold text-on-amber">RIP</span>}
                </span>
                <span className={cx("w-8.5 shrink-0 pr-3.5 text-right font-mono text-xs/5", hot ? "text-amber" : "text-faint")}>{n}</span>
                <span className="grow pr-6 font-mono text-[13px]/5 whitespace-pre">
                  {tokens.length === 0
                    ? " "
                    : tokens.map((t, j) => (
                        <span key={j} className={TOKEN_CLASS[t.kind]}>
                          {t.text}
                        </span>
                      ))}
                </span>
                {hot && at && (
                  <span className="sticky right-0 shrink-0 bg-rip pr-3.5 pl-3 font-mono text-[11px]/5 text-muted" data-testid="source-range">
                    {short(at.first) + " · " + short(at.last) + " " + at.count + (at.count === 1 ? " instruction" : " instructions")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
