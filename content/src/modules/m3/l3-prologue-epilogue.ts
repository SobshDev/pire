import type { LessonInput } from "../../schema";
import { calls, callsRecordings, callsSource, type CallsLabel } from "../../specimens/calls";

const pad = (n: bigint) => n.toString(16).toUpperCase().padStart(16, "0");
const short = (h: string) => h.replace(/^0+/, "");
const rec = callsRecordings().named;
const stateAt = (label: CallsLabel) => rec.states.find((s) => s.rip === calls[label])!;
const rsp = (label: CallsLabel) => BigInt("0x" + stateAt(label).regs.RSP);
const d = (label: CallsLabel) => "disasm:" + calls[label];
const callRsp = rsp("main.scale");
// add's ret when scale called it: scale's RSP at the call, minus the pushed return address.
const retRsp = rsp("scale.call") - 8n;
const back = calls["main.r3"];
const PARTS = ["Prologue", "Body", "Epilogue"];

/** Lesson 3.3, designed in docs/lessons/03-functions-and-the-x64-calling-convention/03-prologue-epilogue-call-and-ret.md. */
export const prologueEpilogue: LessonInput = {
  id: "m3.l3",
  module: 3,
  number: "3.3",
  title: "Prologue, epilogue, call and ret",
  mission: "Follow `RSP` through a full round trip: main calls scale, scale calls add, and everyone gets back home. Then use what you learned to spot where functions begin and end.",
  minutes: 10,
  recording: "calls",
  start: { at: calls["main.scale"] },
  source: callsSource,
  locks: {},
  console: true,
  steps: [
    {
      section: "beat",
      kind: "Predict",
      title: "call, slowly",
      say:
        "You're paused on call calls.scale in main, and RSP is " + short(pad(callRsp)) + ". call does two things: it pushes the address of the next instruction, then jumps to the target. What will RSP be after F7?",
      setup: { banner: "Paused on main's call to scale" },
      source: "call.scale",
      pulse: ["reg:RSP"],
      gate: {
        type: "predict",
        format: "hex",
        answer: short(pad(callRsp - 8n)),
        placeholder: "RSP in hex",
        wrong: [{ match: short(pad(callRsp + 8n)), feedback: "Pushing moves `RSP` down, toward smaller addresses." }],
        fallback: "call pushes 8 bytes, so `RSP` goes down by 8.",
      },
      success: "Let's check. Press `F7`.",
    },
    {
      section: "beat",
      kind: "Key",
      title: "Step in",
      say: "Press `F7` to step into scale.",
      gate: { type: "key", key: "F7", wrong: [{ key: "F8", feedback: "`F8` would run all of scale. Use `F7` to step into it." }] },
      success:
        "RSP dropped by 8 to " + short(pad(callRsp - 8n)) + ". The new top of the stack holds " + short(back) + ", the line after call calls.scale in main, and RIP is scale's first line.",
      successHighlights: ["reg:RSP", "stack:" + pad(callRsp - 8n)],
    },
    {
      section: "beat",
      kind: "Menu",
      title: "The return address",
      say: "x64dbg labels the top stack row \"return to calls.main+...\". That's where scale will go back to. Right-click it and choose Follow in Disassembler to check.",
      spotlight: "stack",
      pulse: ["stack:" + pad(callRsp - 8n)],
      gate: {
        type: "menu",
        target: "stack:" + pad(callRsp - 8n),
        item: "follow-disasm",
        wrong: [{ item: "follow-dump", feedback: "It's a code address. Follow it in the disassembler." }],
        fallback: "Right-click the top row of the stack pane, then Follow in Disassembler.",
      },
      success: "The line right after call calls.scale, where r3 gets stored. Press `*` to bring the disassembler back to `RIP`.",
    },
    {
      section: "beat",
      kind: "Key",
      title: "Back to RIP",
      say: "Press `*` to go back to `RIP`.",
      gate: { type: "key", key: "*" },
    },
    {
      section: "beat",
      kind: "Click",
      title: "The prologue",
      say:
        "The lines at the top that set up the function's stack frame are called the prologue. In MSVC x64 code it's usually: save some registers, then `sub rsp`. Click both of scale's prologue lines.",
      source: "scale",
      spotlight: "disassembly",
      gate: {
        type: "click",
        all: true,
        accept: [d("scale"), d("scale.sub")],
        wrong: [{ match: d("scale.body"), feedback: "That line uses the frame. The prologue is the setup before it." }],
        fallback: "The two lines from scale's start through `sub rsp,38`.",
      },
      success: "From here until the epilogue, `RSP` doesn't move. That's an x64 Windows rule, and it's why the code can use `RSP`-based offsets for everything.",
    },
    {
      section: "beat",
      kind: "Key",
      title: "A call inside a call",
      say: "Now scale's own call to add. Press `F7` to step into add. There will be two return addresses on the stack: one back to scale, and below it, one back to main.",
      setup: { at: calls["scale.call"], banner: "Paused on scale's call to add" },
      gate: { type: "key", key: "F7" },
      frame: {
        caption: "The stack after F7",
        rows: [
          { at: "rsp", label: "return address into scale", kind: "ret" },
          { at: "rsp+8", label: "add's shadow space (4 rows)", kind: "shadow" },
          { at: "...", label: "scale's local and padding", kind: "local" },
          { at: "rsp+40", label: "return address into main", kind: "ret" },
        ],
      },
      success: "Open the Call Stack tab if you like: add on top, then scale, then main.",
    },
    {
      section: "beat",
      kind: "Key",
      title: "Run to ret",
      say: "You don't need to step through add line by line. Press `Ctrl+F9`, Execute till return: x64dbg runs until the current function is about to return.",
      action: "Press `Ctrl+F9`",
      gate: { type: "key", key: "Ctrl+F9" },
      success: "Stopped on add's `ret`. `EAX` already holds the result, 6.",
      successHighlights: ["reg:RAX"],
    },
    {
      section: "beat",
      kind: "Fill",
      title: "ret, slowly",
      say:
        "ret pops the top of the stack into RIP. RSP is " + short(pad(retRsp)) + " and the top of the stack holds " + short(calls["scale.after"]) + ". Predict RIP and RSP after F7.",
      spotlight: "stack",
      gate: {
        type: "fill",
        fields: [
          { id: "rip", label: "`RIP`", format: "hex", answer: short(calls["scale.after"]), accept: [calls["scale.after"]], placeholder: "hex" },
          { id: "rsp", label: "`RSP`", format: "hex", answer: short(pad(retRsp + 8n)), placeholder: "hex" },
        ],
      },
      hints: ["`ret` jumps to the address at [`RSP`], then moves `RSP` up by 8."],
      success:
        "`ret` trusts whatever is at [`RSP`]. If a bug overwrites that value, `ret` jumps somewhere else. That's what stack buffer overflows exploit.",
    },
    {
      section: "beat",
      kind: "Key",
      title: "Check it",
      say: "Press `F7`.",
      gate: { type: "key", key: "F7" },
      success: "Back in scale, on the line after the call, with `RSP` 8 higher.",
      successHighlights: ["reg:RIP", "reg:RSP"],
    },
    {
      section: "beat",
      kind: "Key",
      title: "The epilogue",
      say:
        "The epilogue undoes the prologue in reverse: add back what was subtracted, restore any saved registers, then `ret`. You're on scale's `add rsp,38`. Press `F8` to run it.",
      setup: { at: calls["scale.epilogue"], banner: "On scale's epilogue" },
      pulse: [d("scale.epilogue")],
      gate: { type: "key", key: "F8" },
    },
    {
      section: "beat",
      kind: "Click",
      title: "Before ret",
      say: "Before `ret`, `RSP` must point at the return address again. Click the stack row at `RSP`.",
      spotlight: "stack",
      gate: { type: "click", accept: ["stack:" + pad(callRsp - 8n)], wrong: [{ match: "stack:*", feedback: "`RSP`'s row is the highlighted top row." }], fallback: "Click the top row of the stack pane." },
      success: "\"return to calls.main+...\": exactly the value call pushed. Press `F7` to take it.",
    },
    {
      section: "beat",
      kind: "Key",
      title: "Home",
      say: "Press `F7`.",
      gate: { type: "key", key: "F7" },
      success: "Back in main on the line after call calls.scale, and RSP is " + short(pad(callRsp)) + " again, exactly what it was before the call. Round trip complete.",
      successHighlights: ["reg:RSP"],
    },
    {
      section: "beat",
      kind: "Look",
      title: "Where's RBP?",
      say:
        "If you've read older 32-bit code, you might expect `push ebp` / `mov ebp,esp` at the top of every function. MSVC x64 code rarely does this. `RSP` stays still for the whole body, so it can be the frame reference. Windows finds the frames using the unwind tables in .pdata, the section you met in Lesson 2.1. You'll still see `RBP` frames in functions whose stack size changes at run time, such as ones that use alloca.",
      gate: { type: "continue" },
    },
    {
      section: "beat",
      kind: "Click",
      title: "Spot the boundaries",
      say:
        "Here's calls.exe without its PDB, so no names. Find where functions start and end: `int3` padding sits between functions, `sub rsp` is near the top, `add rsp` and `ret` at the bottom. Click the `ret` of the function above `RIP`, then the first line and the `ret` of the function `RIP` is in.",
      setup: { recording: "calls-stripped", at: calls.scale, banner: "calls.exe without its PDB" },
      spotlight: "disassembly",
      gate: {
        type: "click",
        all: true,
        accept: [d("sum6.ret"), d("scale"), d("scale.ret")],
        wrong: [{ match: "disasm:*", feedback: "Look for a `ret` followed by `int3` padding, or a line right after padding." }],
        fallback: "The `ret` just above `RIP`'s line, `RIP`'s own line, and the `ret` before the next int3s.",
      },
      success: "Three boundaries, no names needed. You'll do this on every stripped binary.",
    },
    {
      section: "checkpoint",
      kind: "Fill",
      title: "What call does",
      say: "`RSP` = `14FE60`. call some_function runs. What's `RSP` now, and what's at [`RSP`]?",
      gate: {
        type: "fill",
        fields: [
          { id: "rsp", label: "`RSP`", format: "hex", answer: "14FE58", placeholder: "hex" },
          {
            id: "top",
            label: "[`RSP`]",
            format: "choice",
            answer: "The address after the call",
            options: ["The address of some_function", "The address after the call", "The first argument"],
          },
        ],
      },
    },
    {
      section: "checkpoint",
      kind: "Predict",
      title: "What ret does",
      say: "On a `ret`, [`RSP`] = `140001234`. Where does execution continue?",
      gate: { type: "predict", format: "hex", answer: "140001234", placeholder: "address", fallback: "`ret` jumps to whatever is at [`RSP`]." },
    },
    {
      section: "checkpoint",
      kind: "Fill",
      title: "Prologue, body, or epilogue?",
      say: "Sort each line of this function.",
      gate: {
        type: "fill",
        fields: [
          { id: "a", label: "`mov qword ptr ss:[rsp+8],rbx`", format: "choice", answer: "Prologue", options: PARTS },
          { id: "b", label: "`sub rsp,20`", format: "choice", answer: "Prologue", options: PARTS },
          { id: "c", label: "call puts", format: "choice", answer: "Body", options: PARTS },
          { id: "d", label: "`add rsp,20`", format: "choice", answer: "Epilogue", options: PARTS },
          { id: "e", label: "`mov rbx,qword ptr ss:[rsp+8]`", format: "choice", answer: "Epilogue", options: PARTS },
          { id: "f", label: "`ret`", format: "choice", answer: "Epilogue", options: PARTS },
        ],
      },
      hints: ["Prologues prepare, epilogues undo.", "`mov rbx`,... near the end restores a register saved at the start."],
    },
    {
      section: "checkpoint",
      kind: "Choose",
      title: "Matching the prologue",
      say: "A function has `sub rsp,28` at the top. Which instruction must appear before its `ret`?",
      gate: {
        type: "choose",
        correct: "add",
        options: [
          { id: "add", label: "`add rsp,28`" },
          { id: "sub", label: "`sub rsp,28`", feedback: "That would move `RSP` further away from the return address." },
          { id: "pop", label: "`pop rsp`", feedback: "The epilogue undoes the sub with the matching add." },
        ],
      },
    },
  ],
  tryIt: [
    "bp calls.scale and press F9. Note RSP and [RSP].",
    "Press F7 through to add's ret, watching the Call Stack tab grow and shrink.",
    "Open any small program without symbols, scroll .text, and find three function boundaries using int3 padding and sub rsp.",
  ],
};
