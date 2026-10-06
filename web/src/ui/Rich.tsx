import { Fragment } from "react";
import { cx, keyLabel } from "./bits";

/**
 * Lesson text with Markdown-style code spans. Wrap a token in backticks and it renders as a chip
 * colored by what it is: `F8` becomes a keycap, `RCX` a register, `140003200` an address, and
 * `lea rcx,[rsp+20]` an instruction with its mnemonic colored like the disassembly.
 */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/`([^`]+)`/);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2) return <Code key={i} code={part} />;
        // A block sits on its own line, so the text around it drops the line breaks and the punctuation
        // that would otherwise start the next line.
        let around = part;
        if (i > 0 && isBlock(parts[i - 1]!)) around = around.replace(/^[.,;:]?\s*/, "");
        if (i < parts.length - 1 && isBlock(parts[i + 1]!)) around = around.trimEnd();
        return <Fragment key={i}>{keyLabel(around)}</Fragment>;
      })}
    </>
  );
}

/** The text without its backticks, for aria labels and other plain-text uses. */
export const plain = (text: string) => text.replace(/`([^`]+)`/g, "$1");

const KEY = /^(?:(?:Ctrl|Cmd|Shift|Alt)\+\S+|F(?:1[0-2]|[1-9])|\*)$/;
const REGISTER =
  /^(?:R[ABCD]X|R[SD]I|R[SB]P|RIP|E[ABCD]X|E[SD]I|E[SB]P|R(?:[89]|1[0-5])[DWB]?|XMM(?:[0-9]|1[0-5])|RFLAGS|[ZCSOPAD]F|TF|IF|[ABCD][XLH])$/;
const NUMBER = /^(?:0x[0-9A-Fa-f]+|[0-9A-F]{4,16})$/;
const MNEMONIC = /^(?:mov\w*|lea|call|ret|push|pop|sub|add|xor|and|or|not|neg|test|cmp|j[a-z]{1,3}|inc|dec|imul|mul|idiv|div|int3|nop|leave|cvt\w+|\w+s[sd]|xorps|pxor|shl|shr|sar|set\w+|cmov\w+)$/;
const FLOW = /^(?:call|ret|j[a-z]{1,3})$/;

const chip = "rounded-[4px] border px-1 py-px font-mono text-[0.87em] [box-decoration-break:clone] [overflow-wrap:anywhere]";

const isInstruction = (code: string) => MNEMONIC.test(code.split(" ")[0] ?? "");
/** An instruction with operands gets its own line, like a fenced code block, so it never breaks mid-chip. */
const isBlock = (code: string) => isInstruction(code) && code.includes(" ");

export function Code({ code }: { code: string }) {
  // Inline, unlike the toolbar Keycap, so the key reads as part of the sentence (and of accessible names).
  if (KEY.test(code)) {
    return <kbd className="rounded-sm border border-b-2 border-faint bg-raised px-1 py-px font-mono text-[0.8em] font-medium text-fg">{keyLabel(code)}</kbd>;
  }
  if (REGISTER.test(code)) return <code className={cx(chip, "border-blue/35 bg-blue/10 text-blue-text")}>{code}</code>;
  if (NUMBER.test(code)) return <code className={cx(chip, "border-violet/35 bg-violet/10 text-violet-text")}>{code}</code>;
  const [mnemonic, ...rest] = code.split(" ");
  if (mnemonic && isInstruction(code)) {
    return (
      <code className={cx(chip, "border-line bg-raised", isBlock(code) && "my-1.5 block w-fit max-w-full px-2 py-1")}>
        <span className={FLOW.test(mnemonic) ? "text-amber" : mnemonic === "int3" ? "text-muted" : "text-mnemonic"}>{mnemonic}</span>
        {rest.length > 0 && " "}
        {rest.length > 0 && <Operands text={rest.join(" ")} />}
      </code>
    );
  }
  return <code className={cx(chip, "border-line bg-raised text-mnemonic")}>{code}</code>;
}

const OPERAND_TOKEN = /(<[^>]*>|\b(?:byte|word|dword|qword|xmmword) ptr\b|\b[cdefgs]s:|0x[0-9A-Fa-f]+|[A-Za-z_][\w.]*|[0-9A-Fa-f]+|\.\.\.|\s+|.)/g;
const SIZE_OR_SEGMENT = /^(?:(?:byte|word|dword|qword|xmmword) ptr|[cdefgs]s:)$/;
const HEX = /^(?:0x[0-9A-Fa-f]+|[0-9A-F]+|\d[0-9A-Fa-f]*)$/;

/** Operands colored like the chips: registers blue, numbers violet, size and segment muted, punctuation dim. */
function Operands({ text }: { text: string }) {
  return (
    <>
      {(text.match(OPERAND_TOKEN) ?? []).map((t, i) => {
        const cls = REGISTER.test(t.toUpperCase()) && /^[a-z0-9]+$/i.test(t)
          ? "text-blue-text"
          : HEX.test(t)
            ? "text-violet-text"
            : SIZE_OR_SEGMENT.test(t) || t === "..."
              ? "text-muted"
              : t.startsWith("<")
                ? "text-mnemonic"
                : /^[\w.]/.test(t)
                  ? "text-fg"
                  : "text-comment";
        return (
          <span key={i} className={cls}>
            {t}
          </span>
        );
      })}
    </>
  );
}

/** A fenced code block: one instruction per line, colored like the disassembly. */
export function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="pane-scroll overflow-x-auto rounded-md border border-line bg-ink px-3 py-2 font-mono text-[12.5px]/5">
      {code.split("\n").map((line, i) => {
        const [mnemonic, ...rest] = line.trim().split(" ");
        if (!mnemonic || !isInstruction(line.trim())) return <div key={i} className="text-fg">{line || " "}</div>;
        return (
          <div key={i}>
            <span className={FLOW.test(mnemonic) ? "text-amber" : mnemonic === "int3" ? "text-muted" : "text-mnemonic"}>{mnemonic}</span>
            {rest.length > 0 && " "}
            {rest.length > 0 && <Operands text={rest.join(" ")} />}
          </div>
        );
      })}
    </pre>
  );
}
