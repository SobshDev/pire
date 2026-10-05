import type { LessonInput } from "../../schema";
import { calls, callsRecordings, callsSource, type CallsLabel } from "../../specimens/calls";

const hx = (n: bigint) => n.toString(16).toUpperCase().padStart(16, "0");
const rec = callsRecordings().named;
const rspAt = (label: CallsLabel) => BigInt("0x" + rec.states.find((s) => s.rip === calls[label])!.regs.RSP);
const sum6Rsp = rspAt("main.sum6");
const d = (label: CallsLabel) => "disasm:" + calls[label];

/** Lesson 3.1, designed in docs/lessons/03-functions-and-the-x64-calling-convention/01-arguments-and-return-values.md. */
export const argumentsAndReturnValues: LessonInput = {
  id: "m3.l1",
  module: 3,
  number: "3.1",
  title: "Arguments and return values",
  mission: "Every call in a Windows x64 program hands over its arguments the same way. Learn the rule, then use it to read add and sum6 straight from their call sites.",
  minutes: 12,
  recording: "calls",
  start: { at: calls["main.add"] },
  source: callsSource,
  locks: {},
  console: true,
  steps: [
    {
      section: "beat",
      kind: "Choose",
      title: "Remember MessageBoxA?",
      say:
        "In Lesson 1.3 you stopped on MessageBoxA. The message text, \"Vault opened!\", was in `RDX`, and the title, \"PIRE\", was in `R8`. MessageBoxA(hWnd, text, caption, type): text is argument 2 and caption is argument 3. Where was argument 1?",
      setup: { banner: "calls.exe, with its PDB" },
      gate: {
        type: "choose",
        correct: "rcx",
        options: [
          { id: "rax", label: "`RAX`", feedback: "`RAX` is for what comes back, not what goes in. Think of the register that comes just before `RDX`." },
          { id: "rcx", label: "`RCX`" },
          { id: "rbx", label: "`RBX`", feedback: "Close in the alphabet, but the convention skips `RBX`. Try again." },
        ],
      },
      success: "`RCX`. hWnd was NULL, so `RCX` was 0. And argument 4, the type, was in `R9`.",
    },
    {
      section: "beat",
      kind: "Order",
      title: "The rule",
      say:
        "First four arguments: `RCX`, `RDX`, `R8`, `R9`, in that order. Every function in every 64-bit Windows program follows this rule: yours, the C runtime's, and Windows' own. Put the registers in argument order.",
      gate: { type: "order", items: ["RCX", "RDX", "R8", "R9"], fallback: "C, D, then the numbered ones: `RCX`, `RDX`, `R8`, `R9`." },
      success: "That's the whole rule for the first four. x64dbg agrees: the Default (x64 fastcall) box under the registers now lists them as 1: rcx, 2: rdx, 3: r8, 4: r9.",
      successHighlights: ["reg:RCX", "reg:RDX", "reg:R8", "reg:R9"],
    },
    {
      section: "beat",
      kind: "Fill",
      title: "Read add's call site",
      say:
        "You're in main, paused on call calls.add: the line r1 = add(n, 5). Without stepping, what will add receive as a and b? Read the two lines above the call, or the registers.",
      source: "call.add",
      spotlight: "disassembly",
      pulse: [d("main.add.edx"), d("main.add.ecx")],
      gate: {
        type: "fill",
        fields: [
          { id: "a", label: "a", format: "int", answer: "3", placeholder: "number" },
          { id: "b", label: "b", format: "int", answer: "5", placeholder: "number" },
        ],
        fallback: "a is argument 1, so it's in `ECX`. b is argument 2, in `EDX`.",
      },
      hints: ["a is argument 1. Which register carries argument 1?", "`ECX` holds n, which is 3. `EDX` holds 5."],
      success:
        "a = 3 from `ECX`, b = 5 from `EDX`. Notice the order in the code: the compiler set `EDX` first. The order of the `mov` lines doesn't matter; the register does.",
    },
    {
      section: "beat",
      kind: "Predict",
      title: "ECX vs RCX",
      say:
        "a is an int, 32 bits, so the code writes `ECX`, the low half of `RCX`. On x64, writing a 32-bit register also clears the upper 32 bits of the full register. Say `RCX` was `0x000000AB12345678`, and then `mov ecx,3` runs. What's in `RCX`?",
      pulse: ["reg:RCX"],
      gate: {
        type: "predict",
        format: "hex",
        answer: "3",
        placeholder: "RCX in hex",
        wrong: [
          { match: "AB00000003", feedback: "That keeps the upper half. A 32-bit write clears it." },
          { match: "AB12345603", feedback: "That's what writing `CL` (8 bits) would do. `ECX` is 32 bits, and it clears the upper half too." },
        ],
        fallback: "The low 32 bits become 3, and the upper 32 bits become 0.",
      },
      success: "`0x0000000000000003`. Zero-extended. This only happens for 32-bit writes: writing the 8- or 16-bit parts (`CL`, `CX`) leaves the rest alone.",
    },
    {
      section: "beat",
      kind: "Predict",
      title: "The return value",
      say: "Results come back in `RAX`, or `EAX` for an int. Before you step over the call: what will `EAX` be?",
      gate: { type: "predict", format: "int", answer: "8", placeholder: "decimal", fallback: "add returns a + b." },
      success: "Let's check.",
    },
    {
      section: "beat",
      kind: "Key",
      title: "Step over",
      say: "Press `F8` to step over the call.",
      action: "Press `F8`",
      gate: { type: "key", key: "F8", wrong: [{ key: "F7", feedback: "`F7` would step into add. We'll go in later; for now, `F8`." }] },
      success: "`RAX` is 8, in red because it changed. The next line stores `EAX` into r1. Integer and pointer results always come back in `RAX`.",
      successHighlights: ["reg:RAX", d("main.r1")],
    },
    {
      section: "beat",
      kind: "Click",
      title: "Inside add",
      say:
        "Here's add from the inside. The debug build first saves the argument registers to the stack (you'll see why in Lesson 3.2), then loads a into `EAX` and adds b to it. Click the instruction that leaves the final result in `EAX`.",
      setup: { at: calls.add, banner: "Inside add" },
      source: "add",
      spotlight: "disassembly",
      gate: {
        type: "click",
        accept: [d("add.add")],
        wrong: [
          { match: d("add.load"), feedback: "That loads a into `EAX`. One more instruction changes it." },
          { match: d("add.ret"), feedback: "`ret` only returns; `EAX` is already set by then." },
        ],
        fallback: "It's the `add eax`,... line, just before `ret`.",
      },
      success: "`add eax,dword ptr ss:[rsp+10]` adds b to a, in `EAX`. `ret` leaves it there for the caller.",
    },
    {
      section: "beat",
      kind: "Click",
      title: "More than four",
      say:
        "Now main's call to sum6(1, 2, 3, 4, n, 6). Six arguments, but only four argument registers. Click the four lines that set a, b, c, and d.",
      setup: { at: calls["main.sum6"], banner: "Paused on call calls.sum6" },
      source: "call.sum6",
      spotlight: "disassembly",
      gate: {
        type: "click",
        all: true,
        accept: [d("main.sum6.a"), d("main.sum6.b"), d("main.sum6.c"), d("main.sum6.d")],
        fallback: "Look for the lines that write `ECX`, `EDX`, `R8D`, and `R9D`.",
      },
      hints: ["`R8D` is the low 32 bits of `R8`, the same way `ECX` is the low 32 bits of `RCX`."],
      success: "`ECX` = 1, `EDX` = 2, `R8D` = 3, `R9D` = 4. `R8D` isn't a different register: it's the low half of `R8`.",
    },
    {
      section: "beat",
      kind: "Click",
      title: "Five and six",
      say: "Arguments 5 and 6 are written to the stack instead. Click the two lines that store e and f.",
      spotlight: "disassembly",
      gate: {
        type: "click",
        all: true,
        accept: [d("main.sum6.e"), d("main.sum6.f")],
        fallback: "Look for the two `mov dword ptr ss:[rsp+...]` lines just above the register moves.",
      },
      success:
        "Argument 5 goes at `[rsp+20]`, argument 6 at `[rsp+28]`, and so on in steps of 8. Why 20 and not 0? That's Lesson 3.2.",
    },
    {
      section: "beat",
      kind: "Click",
      title: "Check with the stack",
      say: "Find arguments 5 and 6 in the stack pane. `RSP` is the top row; count down in rows of 8 bytes to RSP+20 and RSP+28.",
      spotlight: "stack",
      gate: {
        type: "click",
        all: true,
        accept: ["stack:" + hx(sum6Rsp + 0x20n), "stack:" + hx(sum6Rsp + 0x28n)],
        fallback: "RSP is " + hx(sum6Rsp) + ". The rows you want are " + hx(sum6Rsp + 0x20n) + " and " + hx(sum6Rsp + 0x28n) + ".",
      },
      success: "3 and 6: e = n = 3, f = 6. Press `F8` to step over the call.",
    },
    {
      section: "beat",
      kind: "Key",
      title: "A 64-bit result",
      say: "Press `F8`.",
      gate: { type: "key", key: "F8" },
      success: "`RAX` = 13 hex, 19. sum6 returns a long long, 64 bits, so the next line stores all of `RAX`, not just `EAX`.",
      successHighlights: ["reg:RAX", d("main.r2")],
    },
    {
      section: "checkpoint",
      kind: "Choose",
      title: "Read a call site",
      say: "A new call site, from some other program:\n`mov r8d,10`\n`lea rdx,qword ptr ss:[rsp+40]`\n`mov rcx,rbx`\ncall some_function\nWhat's the call?",
      gate: {
        type: "choose",
        correct: "right",
        options: [
          { id: "lines", label: "some_function(16, a stack buffer, rbx)", feedback: "That's line order. The order of lines doesn't matter: `RCX` is always first." },
          { id: "right", label: "some_function(rbx, a stack buffer, 16)" },
          { id: "two", label: "some_function(rbx, 16)", feedback: "Three registers are set, so there are three arguments." },
        ],
      },
      hints: ["Sort the lines by register, not by position.", "`RCX`, `RDX`, `R8`."],
    },
    {
      section: "checkpoint",
      kind: "Choose",
      title: "Argument 5",
      say: "At the moment of the call, where is argument 5?",
      gate: {
        type: "choose",
        correct: "20",
        options: [
          { id: "r10", label: "`R10`", feedback: "Only four arguments get registers." },
          { id: "0", label: "`[rsp]`", feedback: "The first 20 hex bytes above `RSP` are reserved. Argument 5 comes after them." },
          { id: "20", label: "`[rsp+20]`" },
        ],
      },
    },
    {
      section: "checkpoint",
      kind: "Predict",
      title: "Zero-extension",
      say: "`RDX` is `0xFFFFFFFFFFFFFFFF`. `mov edx,2` runs. What is `RDX`?",
      gate: {
        type: "predict",
        format: "hex",
        answer: "2",
        placeholder: "RDX in hex",
        wrong: [{ match: "FFFFFFFF00000002", feedback: "A 32-bit write clears the upper half." }],
        fallback: "Writing `EDX` clears the upper 32 bits of `RDX`.",
      },
    },
    {
      section: "checkpoint",
      kind: "Choose",
      title: "A returned pointer",
      say: "A function returns a pointer. Where do you look right after the call?",
      gate: {
        type: "choose",
        correct: "rax",
        options: [
          { id: "rcx", label: "`RCX`", feedback: "`RCX` carried argument 1 in. Results come out somewhere else." },
          { id: "rax", label: "`RAX`" },
          { id: "stack", label: "`[rsp]`", feedback: "Pointers fit in a register, so they come back in one." },
        ],
      },
    },
  ],
  tryIt: [
    "Load calls.exe in x64dbg, type bp calls.add, and press F9. Read a and b from the registers.",
    "Restart and bp calls.sum6. When it stops, the return address is at `[rsp]`. Find e and f at `[rsp+28]` and `[rsp+30]`: one row further than at the call site, because call pushed the return address.",
    "Press Ctrl+F9 to run to sum6's ret, then F8, and read RAX.",
  ],
};

