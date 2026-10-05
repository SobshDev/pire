import type { LessonInput } from "../../schema";
import { calls, callsRecordings, callsSource, type CallsLabel } from "../../specimens/calls";

const hx = (n: bigint) => n.toString(16).toUpperCase().padStart(16, "0");
const rec = callsRecordings().named;
const rspAt = (label: CallsLabel) => BigInt("0x" + rec.states.find((s) => s.rip === calls[label])!.regs.RSP);
const atAdd = rspAt("main.add");
const stack = (base: bigint, off: number) => "stack:" + hx(base + BigInt(off));
const d = (label: CallsLabel) => "disasm:" + calls[label];
const SLOTS = ["Shadow space for add", "doubled", "Padding", "Return address to main", "x, in scale's home slot"];

/** Lesson 3.2, designed in docs/lessons/03-functions-and-the-x64-calling-convention/02-shadow-space-and-stack-alignment.md. */
export const shadowSpaceAndAlignment: LessonInput = {
  id: "m3.l2",
  module: 3,
  number: "3.2",
  title: "Shadow space and stack alignment",
  mission: "Almost every function starts with `sub rsp`, something. Work out where that number comes from, and you'll never have to wonder about it again.",
  minutes: 12,
  recording: "calls",
  start: { at: calls["main.add"] },
  source: callsSource,
  locks: {},
  console: true,
  steps: [
    {
      section: "beat",
      kind: "Look",
      title: "The question",
      say:
        "You'll see lines like these at the top of functions everywhere: `sub rsp,28`, `sub rsp,38`, `sub rsp,48`. They're always 8 more than a multiple of 16 (hex 10). That isn't a coincidence. By the end of this lesson you'll be able to predict them.",
      setup: { banner: "calls.exe, paused on main's call to add" },
      gate: { type: "continue" },
    },
    {
      section: "beat",
      kind: "Click",
      title: "The shadow space",
      say:
        "Before every call, the caller must reserve 32 bytes (20 hex) right above where the return address will go. It's called shadow space, or home space. The called function may use it for anything, usually to save its four argument registers. You're paused on call calls.add. Click the four stack rows from `RSP` down that make up add's shadow space.",
      spotlight: "stack",
      frame: {
        caption: "main's stack at the call",
        rows: [
          { at: "rsp", label: "home for RCX", kind: "shadow" },
          { at: "rsp+8", label: "home for RDX", kind: "shadow" },
          { at: "rsp+10", label: "home for R8", kind: "shadow" },
          { at: "rsp+18", label: "home for R9", kind: "shadow" },
          { at: "rsp+20", label: "argument 5 (when there is one)", kind: "arg" },
        ],
      },
      gate: {
        type: "click",
        all: true,
        accept: [0, 8, 0x10, 0x18].map((o) => stack(atAdd, o)),
        wrong: [{ match: "stack:*", feedback: "Start at `RSP`, the highlighted top row, and take the next four rows: `RSP`, +8, +10, +18." }],
        fallback: "Click the top row (`RSP`) and the three rows under it.",
      },
      success: "That's why argument 5 sits at `[rsp+20]` at the call: the first 20 hex bytes above `RSP` belong to the shadow space.",
    },
    {
      section: "beat",
      kind: "Choose",
      title: "Watch add use it",
      say:
        "Now inside add. Its first two lines save b and a into the shadow space main reserved: `mov dword ptr ss:[rsp+10],edx` and `mov dword ptr ss:[rsp+8],ecx`. Why `[rsp+8]` and not `[rsp]`?",
      setup: { at: calls.add, banner: "Inside add" },
      source: "add",
      pulse: [d("add")],
      gate: {
        type: "choose",
        correct: "ret",
        options: [
          { id: "ret", label: "`[rsp]` holds the return address." },
          { id: "rax", label: "`[rsp]` is reserved for `RAX`.", feedback: "`RAX` doesn't get a slot. Look at the top row of the stack pane: what's there?" },
          { id: "random", label: "It's random.", feedback: "Nothing about the stack layout is random. Look at the top row of the stack pane." },
        ],
      },
      frame: {
        caption: "add's view of the stack",
        rows: [
          { at: "rsp", label: "return address into main", kind: "ret" },
          { at: "rsp+8", label: "a (home for RCX)", kind: "shadow" },
          { at: "rsp+10", label: "b (home for RDX)", kind: "shadow" },
          { at: "rsp+18", label: "unused (home for R8)", kind: "shadow" },
          { at: "rsp+20", label: "unused (home for R9)", kind: "shadow" },
        ],
      },
      success:
        "call pushed the return address, so the shadow space starts at `[rsp+8]` from inside add. Debug builds save the arguments there so the debugger can always show them. Release builds usually don't bother.",
    },
    {
      section: "beat",
      kind: "Fill",
      title: "The alignment rule",
      say:
        "Second rule: right before any call instruction, `RSP` must be a multiple of 16. In hex, it ends in 0. Some instructions that move 16 bytes at once crash on misaligned addresses, so everyone agrees on this. Which of these `RSP` values are ready for a call?",
      gate: {
        type: "fill",
        fields: [
          { id: "a", label: "`14FE40`", format: "choice", answer: "Aligned", options: ["Aligned", "Not aligned"] },
          { id: "b", label: "`14FE48`", format: "choice", answer: "Not aligned", options: ["Aligned", "Not aligned"] },
          { id: "c", label: "`14FE30`", format: "choice", answer: "Aligned", options: ["Aligned", "Not aligned"] },
          { id: "d", label: "`14FE38`", format: "choice", answer: "Not aligned", options: ["Aligned", "Not aligned"] },
        ],
      },
      hints: ["A multiple of 16 ends in 0 in hex."],
      success: "Ending in 0 means aligned. Ending in 8 means 8 off.",
    },
    {
      section: "beat",
      kind: "Predict",
      title: "Where the 8 comes from",
      say:
        "The caller's `RSP` was aligned at its call. The call pushed an 8-byte return address, so at the first line of every function, `RSP` ends in 8. What must a function subtract to reserve 20 hex of shadow space for its own calls and be aligned again?",
      frame: {
        caption: "Inside a function that calls something",
        rows: [
          { at: "rsp", label: "shadow space for the next call (20 hex)", kind: "shadow" },
          { at: "rsp+20", label: "? (8 bytes)", kind: "pad" },
          { at: "rsp+28", label: "return address (pushed by call)", kind: "ret" },
        ],
      },
      gate: {
        type: "predict",
        format: "hex",
        answer: "28",
        placeholder: "hex",
        wrong: [
          { match: "20", feedback: "That reserves the shadow space, but `RSP` would still end in 8. Add 8 more." },
          { match: "30", feedback: "Too much: `RSP` would end in 8 again. Try 8 less." },
        ],
        fallback: "20 for the shadow space, plus 8 to fix the alignment.",
      },
      success: "28: 20 for shadow space plus 8 to fix the alignment. `sub rsp,28` is the most common line in Windows x64 code.",
    },
    {
      section: "beat",
      kind: "Choose",
      title: "scale's 38",
      say:
        "Here's scale. It needs shadow space for its call to add, plus room for its local doubled, so it uses `sub rsp,38`. Check the arithmetic: is 38 + 8 a multiple of 16 (hex 10)?",
      setup: { at: calls.scale, banner: "At scale's first line" },
      source: "scale",
      pulse: [d("scale.sub")],
      gate: {
        type: "choose",
        correct: "yes",
        options: [
          { id: "yes", label: "Yes: 38 + 8 = 40." },
          { id: "no", label: "No.", feedback: "Add in hex: 38 + 8 = 40, and 40 ends in 0." },
        ],
      },
      success:
        "Rule of thumb: with no pushes in the prologue, the sub is always 8 more than a multiple of 10 hex. If the function pushes one register first, the sub becomes a multiple of 10 instead, because the push already moved `RSP` by 8.",
    },
    {
      section: "beat",
      kind: "Fill",
      title: "Draw it",
      say:
        "Run forward to scale's call to add. Fill in what each part of scale's stack holds right now. The stack pane is next to you: `[rsp+40]` holds 3, the x scale saved on its first line.",
      setup: { at: calls["scale.call"], banner: "Paused on scale's call to add" },
      spotlight: "stack",
      gate: {
        type: "fill",
        fields: [
          { id: "shadow", label: "rsp to rsp+18", format: "choice", answer: SLOTS[0]!, options: SLOTS },
          { id: "local", label: "rsp+20", format: "choice", answer: SLOTS[1]!, options: SLOTS },
          { id: "pad", label: "rsp+28 and rsp+30", format: "choice", answer: SLOTS[2]!, options: SLOTS },
          { id: "ret", label: "rsp+38", format: "choice", answer: SLOTS[3]!, options: SLOTS },
          { id: "home", label: "rsp+40", format: "choice", answer: SLOTS[4]!, options: SLOTS },
        ],
      },
      hints: [
        "The 38 hex bytes scale reserved are everything below the return address.",
        "doubled is stored at `[rsp+20]` right after the call returns. The return address is the 8 bytes just above what scale reserved.",
      ],
      success: "That's the whole frame. scale reserved 38: 20 of shadow space, 4 for doubled, and padding to keep the alignment.",
      successHighlights: [stack(rspAt("scale.call"), 0x38), stack(rspAt("scale.call"), 0x40)],
    },
    {
      section: "beat",
      kind: "Choose",
      title: "Reading the offsets",
      say: "scale saved x with `mov dword ptr ss:[rsp+8],ecx` on its first line. Now it reads it back with `mov ecx,dword ptr ss:[rsp+40]`. Same variable, different offset. Why?",
      pulse: [d("scale"), d("scale.x")],
      gate: {
        type: "choose",
        correct: "moved",
        options: [
          { id: "moved", label: "`RSP` moved down by 38 in between." },
          { id: "copy", label: "x was copied somewhere else.", feedback: "Nothing copied it. Look at the line between the two." },
          { id: "other", label: "It's a different variable.", feedback: "The source has only one x. What changed between the two lines?" },
        ],
      },
      success: "8 + 38 = 40. When `RSP` moves, every `RSP`-based offset changes. You'll do this arithmetic a lot.",
    },
    {
      section: "checkpoint",
      kind: "Predict",
      title: "Predict a prologue",
      say: "A function makes calls, needs no locals, and pushes nothing. What's its `sub rsp`?",
      gate: { type: "predict", format: "hex", answer: "28", placeholder: "hex", fallback: "Shadow space plus the alignment fix." },
    },
    {
      section: "checkpoint",
      kind: "Predict",
      title: "With a push",
      say: "A function starts with `push rbx`, makes calls, and has no locals. What's its `sub rsp`?",
      gate: {
        type: "predict",
        format: "hex",
        answer: "20",
        placeholder: "hex",
        wrong: [{ match: "28", feedback: "The push already moved `RSP` by 8, so it's aligned again." }],
        fallback: "At entry `RSP` ends in 8. After one push it ends in 0.",
      },
      hints: ["At entry `RSP` is 8 off. What does a push do to `RSP`?", "push moves `RSP` by 8, so after one push it's aligned."],
    },
    {
      section: "checkpoint",
      kind: "Choose",
      title: "Argument 5, inside",
      say: "At the call instruction, argument 5 is at `[rsp+20]`. Where is it on the first line of the called function?",
      gate: {
        type: "choose",
        correct: "28",
        options: [
          { id: "20", label: "`[rsp+20]`", feedback: "Something was pushed between the call site and the first line." },
          { id: "28", label: "`[rsp+28]`" },
          { id: "18", label: "`[rsp+18]`", feedback: "`RSP` went down, so offsets to the same slot go up." },
        ],
      },
    },
    {
      section: "checkpoint",
      kind: "Choose",
      title: "Leaf functions",
      say: "add makes no calls. Does it need a `sub rsp`?",
      gate: {
        type: "choose",
        correct: "no",
        options: [
          { id: "no", label: "No. It calls nothing, so it needs no shadow space or alignment of its own." },
          { id: "yes", label: "Yes, every function does.", feedback: "Look at add in the disassembly: there's no `sub rsp` at all." },
        ],
      },
      success: "add is a leaf function: it uses the caller's shadow space and never moves `RSP`.",
    },
  ],
  tryIt: [
    "bp calls.scale and run. When it stops, check that RSP ends in 8.",
    "Step over sub rsp,38 and check that RSP now ends in 0.",
    "Step to call calls.add and look at the 4 rows from RSP in the stack pane: that's the shadow space add will receive.",
  ],
};

