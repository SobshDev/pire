import { FLAG_ORDER, flagsFromRflags, type Lesson, type Recording } from "@pire/content";
import { big, describe, moduleOf, pad, readByte, readQword, readString, resolve, symbolize, type Session } from "../engine/debugger";
import type { LessonState } from "../engine/lesson";

/**
 * The AI tutor's tools. They all run here, on the recording the learner is looking at, and they
 * only read or point: nothing a tool does changes the debugger or the lesson.
 */

export interface TutorContext {
  lesson: Lesson;
  state: LessonState;
  rec: Recording;
  session: Session;
  /** Misses on the current step. */
  misses: number;
  /** Light up a target. Returns false when it isn't on screen. */
  point(target: string): boolean;
  showSource(): void;
}

export type ToolResult = { output: string } | { error: string };

const REGS = ["RAX", "RBX", "RCX", "RDX", "RBP", "RSP", "RSI", "RDI", "R8", "R9", "R10", "R11", "R12", "R13", "R14", "R15"];
const MAX_SNAPSHOT = 6000;

const str = (v: unknown) => (typeof v === "string" ? v : "");
const int = (v: unknown, def: number, min: number, max: number) => {
  const n = typeof v === "number" ? Math.floor(v) : Number.parseInt(str(v), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

export function runTool(name: string, input: unknown, ctx: TutorContext): ToolResult {
  const args = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  switch (name) {
    case "point_at":
      return pointAt(str(args.target).trim(), ctx);
    case "show_source":
      if (ctx.lesson.challenge) return { error: "The source is locked until the challenge is finished." };
      ctx.showSource();
      return { output: "ok" };
    case "read_memory":
      return readMemory(str(args.address), int(args.length, 64, 1, 256), ctx);
    case "disassemble":
      return disassemble(str(args.address) || "RIP", int(args.count, 10, 1, 20), ctx);
    case "describe_value":
      return describeValue(str(args.expression), ctx);
    default:
      return { error: "Unknown tool " + name + "." };
  }
}

/** Whether a target id names something that exists at this point of the trace. */
export function validTarget(target: string, ctx: Pick<TutorContext, "rec" | "session">): boolean {
  const [kind, ...rest] = target.split(":");
  const value = rest.join(":");
  const st = ctx.rec.states[ctx.session.index]!;
  switch (kind) {
    case "reg":
      return value === "RIP" || value in st.regs;
    case "flag":
      return (FLAG_ORDER as readonly string[]).includes(value);
    case "disasm":
      return /^[0-9A-F]{16}$/.test(value) && !!moduleOf(ctx.rec, value)?.rows.some((r) => r.address === value);
    case "stack":
      return /^[0-9A-F]{16}$/.test(value) && readQword(ctx.rec, ctx.session.index, big(value)) !== null;
    case "dump":
      return /^byte:[0-9A-F]{16}$/.test(value) && readByte(ctx.rec, ctx.session.index, big(value.slice(5))) !== null;
    default:
      return false;
  }
}

function pointAt(target: string, ctx: TutorContext): ToolResult {
  if (!validTarget(target, ctx)) return { error: "No such target: " + target + ". Use ids like reg:RCX, flag:ZF or disasm:<16 hex digits>." };
  return ctx.point(target)
    ? { output: "ok" }
    : { output: "Highlighted, but it is scrolled out of view right now. Tell the learner where to look." };
}

function readMemory(expr: string, length: number, ctx: TutorContext): ToolResult {
  const at = resolve(ctx.rec, ctx.session, expr);
  if (!at) return { error: "Can't resolve " + JSON.stringify(expr) + ". Use a hex address, a register or a symbol." };
  const base = big(at);
  const lines: string[] = [];
  for (let off = 0; off < length; off += 16) {
    const bytes: string[] = [];
    let ascii = "";
    for (let i = off; i < Math.min(off + 16, length); i++) {
      const b = readByte(ctx.rec, ctx.session.index, base + BigInt(i));
      bytes.push(b === null ? "??" : b.toString(16).toUpperCase().padStart(2, "0"));
      ascii += b !== null && b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".";
    }
    lines.push(pad(base + BigInt(off)) + "  " + bytes.join(" ") + "  " + ascii);
  }
  if (lines.every((l) => l.includes("?? ?? ??"))) return { error: "Nothing is mapped at " + at + "." };
  const text = readString(ctx.rec, ctx.session.index, base, 128);
  return { output: lines.join("\n") + (text ? '\nstring: "' + text + '"' : "") };
}

function disassemble(expr: string, count: number, ctx: TutorContext): ToolResult {
  const at = resolve(ctx.rec, ctx.session, expr);
  if (!at) return { error: "Can't resolve " + JSON.stringify(expr) + "." };
  const rows = moduleOf(ctx.rec, at)?.rows ?? [];
  const start = rows.findIndex((r) => big(r.address) >= big(at));
  if (start < 0) return { error: "No code at " + at + "." };
  const rip = ctx.rec.states[ctx.session.index]!.rip;
  return { output: rows.slice(start, start + count).map((r) => codeLine(r, rip, ctx.rec)).join("\n") };
}

function codeLine(r: { address: string; mnemonic: string; operands: string; comment?: string }, rip: string, rec: Recording) {
  const sym = symbolize(rec, r.address, true);
  const label = sym ? "<" + sym + ">\n" : "";
  return label + (r.address === rip ? "RIP> " : "     ") + r.address + "  " + (r.mnemonic + " " + r.operands).trim() + (r.comment ? "    ; " + r.comment : "");
}

function describeValue(expr: string, ctx: TutorContext): ToolResult {
  const value = resolve(ctx.rec, ctx.session, expr);
  if (!value) return { error: "Can't resolve " + JSON.stringify(expr) + "." };
  const what = describe(ctx.rec, ctx.session.index, value) || "nothing x64dbg would name";
  return { output: expr.trim() + " = " + value + ": " + what };
}

/** The <debugger_state> text sent with each question: where the lesson is and what the screen shows. */
export function snapshot(ctx: Omit<TutorContext, "point" | "showSource">): string {
  const { lesson, state: ls, rec, session } = ctx;
  const step = lesson.steps[ls.stepIndex];
  const st = rec.states[session.index]!;
  const prev = rec.states[session.prev] ?? st;
  const out: string[] = [];
  out.push("lesson " + lesson.id + " (" + lesson.number + " " + lesson.title + ")");
  if (ls.done) out.push("lesson finished");
  else if (step) out.push("step " + (ls.stepIndex + 1) + " of " + lesson.steps.length + ': "' + step.title + '" (' + step.kind + "), phase: " + ls.phase);
  if (ctx.misses) out.push("misses on this step: " + ctx.misses);
  if (ls.feedback) out.push("feedback shown: " + ls.feedback.text);
  if (ls.hintsShown) out.push("hints shown on this step: " + ls.hintsShown);

  const tool = session.tool ?? "x64dbg";
  if (tool !== "x64dbg") {
    out.push("tool on screen: " + tool + (session.file ? ", file " + session.file : ""));
    if (session.hexSel) out.push("hex selection: offset " + session.hexSel[0].toString(16).toUpperCase() + ", " + session.hexSel[1] + " bytes");
    if (session.peNode) out.push("PE viewer node: " + session.peNode + (session.peField ? ", field " + session.peField : ""));
    return clip(out.join("\n"));
  }

  out.push("tab: " + session.tab + (session.message ? ", status: " + session.message : ""));
  if (st.terminated) out.push("process exited with code " + st.terminated.code);
  out.push("");
  const changed = (a?: string, b?: string) => (a !== b ? " (changed)" : "");
  out.push("RIP " + st.rip + " <" + (symbolize(rec, st.rip) ?? "?") + ">" + changed(st.rip, prev.rip));
  for (const r of REGS) {
    const v = st.regs[r];
    if (v === undefined) continue;
    const d = describe(rec, session.index, v);
    out.push(r.padEnd(4) + v + (d ? "  " + d : "") + changed(v, prev.regs[r]));
  }
  const flags = flagsFromRflags(st.rflags);
  out.push("RFLAGS " + st.rflags + "  " + FLAG_ORDER.map((f) => f + "=" + flags[f]).join(" "));

  const rows = moduleOf(rec, st.rip)?.rows ?? [];
  const i = rows.findIndex((r) => r.address === st.rip);
  if (i >= 0) {
    out.push("", "disassembly:");
    const bps = new Set(session.breakpoints.filter((b) => b.kind === "software" && b.enabled).map((b) => b.address));
    for (const r of rows.slice(Math.max(0, i - 4), i + 11)) {
      out.push((bps.has(r.address) ? "BP " : "   ") + codeLine(r, st.rip, rec).replace(/\n/g, "\n   "));
    }
  }

  const rsp = big(st.regs.RSP ?? "0");
  out.push("", "stack:");
  for (let k = 0; k < 8; k++) {
    const q = readQword(rec, session.index, rsp + BigInt(k * 8));
    if (q === null) break;
    const d = describe(rec, session.index, pad(q), true);
    out.push(pad(rsp + BigInt(k * 8)) + "  " + pad(q) + (d ? "  " + d : ""));
  }

  if (session.breakpoints.length) {
    out.push("", "breakpoints: " + session.breakpoints.map((b) => b.kind + " " + (symbolize(rec, b.address) ?? b.address) + (b.enabled ? "" : " (disabled)")).join(", "));
  }
  out.push("dump shows " + session.dump + (session.view ? ", disassembly scrolled to " + session.view : ""));
  if (ls.keys.length) out.push("keys used: " + ls.keys.join(" "));
  const log = session.log.slice(-6);
  if (log.length) out.push("log: " + log.join(" | "));
  return clip(out.join("\n"));
}

const clip = (s: string) => (s.length > MAX_SNAPSHOT ? s.slice(0, MAX_SNAPSHOT) + "\n…" : s);
