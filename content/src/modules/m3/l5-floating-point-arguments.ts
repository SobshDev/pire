import type { LessonInput } from "../../schema";
import { calls, callsSource, type CallsLabel } from "../../specimens/calls";

const d = (label: CallsLabel) => "disasm:" + calls[label];
const REGS = ["ECX", "EDX", "R8D", "R9D", "XMM0", "XMM1", "XMM2", "XMM3"];
const ARGS = ["a", "b", "c", "d"];
const TYPES = ["float", "double"];
const slot = (id: string, label: string, answer: string) => ({ id, label, format: "choice" as const, answer, options: REGS });
const num = (id: string, label: string, answer: string, accept: string[] = []) => ({ id, label, format: "text" as const, answer, accept, placeholder: "number" });

/** Lesson 3.5, designed in docs/lessons/03-functions-and-calling-convention/05-floating-point-arguments.md. */
export const floatingPointArguments: LessonInput = {
  id: "m3.l5",
  module: 3,
  number: "3.5",
  title: "Floating-point arguments",
  mission: "mix takes an int, a double, an int, and a float. Four arguments, four slots, but two different register families. Work out which value lands where.",
  minutes: 10,
  recording: "calls",
  start: { at: calls["main.mix.d"] },
  source: callsSource,
  locks: {},
  console: true,
  steps: [
    {
      section: "beat",
      kind: "Click",
      title: "A new family",
      say:
        "Floating-point values don't use RCX and friends. They travel in the XMM registers, which are 128 bits wide. A double uses the low 64 bits; a float uses the low 32.\n\nScroll the registers pane down below the flags and click XMM0.",
      setup: { banner: "Paused at main's call site for mix" },
      spotlight: "registers",
      gate: { type: "click", accept: ["reg:XMM0"], wrong: [{ match: "reg:*", feedback: "Keep scrolling: the XMM registers are below RFLAGS." }], fallback: "XMM0 is at the bottom of the registers pane." },
      success:
        "Each XMM row shows the raw 128 bits, and under it the low lane read as a number: float when only the low 32 bits are in use, double otherwise. Real x64dbg shows hex by default; you can change the format by right-clicking the registers pane.",
    },
    {
      section: "beat",
      kind: "Choose",
      title: "Guess the rule",
      say:
        "mix(int a, double b, int c, float d). Argument 1 is an int, so it goes in ECX. Argument 2 is a double. Here's the question that trips everyone up: does it go in XMM0 (the first float register) or XMM1?",
      source: "mix",
      gate: {
        type: "choose",
        correct: "xmm1",
        options: [
          { id: "xmm0", label: "XMM0", feedback: "That's the Linux rule, where floats fill XMM0, XMM1, ... in order. Windows works by position." },
          { id: "xmm1", label: "XMM1" },
        ],
      },
      success:
        "Windows assigns slots by position. Argument 2 always uses slot 2: RDX if it's an integer, XMM1 if it's floating point. The other register in that slot goes unused.",
    },
    {
      section: "beat",
      kind: "Fill",
      title: "Fill the slots",
      say: "Slot 1 is RCX or XMM0, slot 2 is RDX or XMM1, slot 3 is R8 or XMM2, slot 4 is R9 or XMM3. Place each of mix's arguments.",
      source: "mix",
      gate: { type: "fill", fields: [slot("a", "a (int)", "ECX"), slot("b", "b (double)", "XMM1"), slot("c", "c (int)", "R8D"), slot("d", "d (float)", "XMM3")] },
      hints: ["Number the arguments 1 to 4 first.", "c is argument 3, so it uses slot 3: R8D, even though it's only the second int."],
    },
    {
      section: "beat",
      kind: "Fill",
      title: "Check against the code",
      say:
        "Now match each line of the call site to the argument it sets up.\n\nNotice the names x64dbg shows for the constants: __real@3ff8000000000000 is the double 1.5 written in hex, and __real@3f000000 is the float 0.5. The compiler names constants after their bit pattern.",
      source: "call.mix",
      spotlight: "disassembly",
      pulse: [d("main.mix.d"), d("main.mix.c"), d("main.mix.b"), d("main.mix.a")],
      gate: {
        type: "fill",
        fields: [
          { id: "l1", label: "movss xmm3,...", format: "choice", answer: "d", options: ARGS },
          { id: "l2", label: "mov r8d,2", format: "choice", answer: "c", options: ARGS },
          { id: "l3", label: "movsd xmm1,...", format: "choice", answer: "b", options: ARGS },
          { id: "l4", label: "mov ecx,...", format: "choice", answer: "a", options: ARGS },
        ],
      },
      hints: ["The register each line writes tells you the slot, and the slot tells you the argument."],
      success: "As usual for MSVC, the arguments are set up from last to first.",
    },
    {
      section: "beat",
      kind: "Fill",
      title: "movss vs movsd",
      say: "movss moves a scalar single (a 4-byte float). movsd moves a scalar double (8 bytes). The last letter tells you the type.",
      gate: {
        type: "fill",
        fields: [
          { id: "ss", label: "movss xmm3,dword ptr ds:[...]", format: "choice", answer: "float", options: TYPES },
          { id: "sd", label: "movsd xmm1,qword ptr ds:[...]", format: "choice", answer: "double", options: TYPES },
        ],
      },
      success: "The operand size agrees: dword for the float, qword for the double.",
    },
    {
      section: "beat",
      kind: "Fill",
      title: "Read the values",
      say: "You're paused on call calls.mix. Read b and d from the registers.",
      setup: { at: calls["main.mix"], banner: "Paused on main's call to mix" },
      spotlight: "registers",
      pulse: ["reg:XMM1", "reg:XMM3"],
      gate: { type: "fill", fields: [num("b", "b (XMM1)", "1.5", ["1.50"]), num("d", "d (XMM3)", "0.5", [".5", "0.50"])] },
      hints: ["Look at the line under XMM1 and XMM3: it shows the low lane as a number."],
    },
    {
      section: "beat",
      kind: "Key",
      title: "Over the call",
      say: "Press F8 to run mix.",
      gate: { type: "key", key: "F8", wrong: [{ key: "F7", feedback: "You'll look inside later. Use F8 for now." }] },
    },
    {
      section: "beat",
      kind: "Fill",
      title: "The return value",
      say: "Floating-point results come back in XMM0, which just turned red. Work it out from the source first: a * b + c * d, with a = 3, b = 1.5, c = 2 and d = 0.5. What did mix return?",
      spotlight: "registers",
      pulse: ["reg:XMM0"],
      gate: { type: "fill", fields: [num("r", "XMM0", "5.5", ["5.50", "5.500000"])] },
      hints: ["3 × 1.5 = 4.5, and 2 × 0.5 = 1."],
      success: "XMM0 = 5.5. The next line stores it with movsd, because r4 is a double.",
      successHighlights: [d("main.r4")],
    },
    {
      section: "beat",
      kind: "Click",
      title: "A peek inside",
      say:
        "Here's a replay of mix itself. Inside, it converts between types. You don't need these yet. Just remember that cvt means convert, and the letters say from what to what: si is a signed integer, ss is a float, sd is a double.\n\nClick the line that converts a to a double.",
      setup: { at: calls.mix, banner: "Replay: inside mix" },
      source: "mix",
      spotlight: "disassembly",
      gate: {
        type: "click",
        accept: [d("mix.a")],
        wrong: [{ match: "disasm:*", feedback: "Look for cvtsi2sd: signed integer to double." }],
        fallback: "cvtsi2sd xmm0,dword ptr ss:[rsp+8]",
      },
      success: "cvtsi2ss turns c into a float, and cvtss2sd widens c * d to a double before the final addsd.",
    },
    {
      section: "checkpoint",
      kind: "Fill",
      title: "Fill the slots",
      say: "f(double x, int y, double z, char *p). Where does each argument go?",
      gate: {
        type: "fill",
        fields: [
          { id: "x", label: "x", format: "choice", answer: "XMM0", options: ["RCX", "XMM0"] },
          { id: "y", label: "y", format: "choice", answer: "EDX", options: ["ECX", "EDX", "XMM1"] },
          { id: "z", label: "z", format: "choice", answer: "XMM2", options: ["XMM1", "XMM2", "R8"] },
          { id: "p", label: "p", format: "choice", answer: "R9", options: ["RDX", "R9", "XMM3"] },
        ],
      },
      hints: ["Number the arguments 1 to 4 first.", "Slot 2 is RDX or XMM1, depending on the type."],
    },
    {
      section: "checkpoint",
      kind: "Choose",
      title: "Returning a float",
      say: "A function returns float. Where's the result?",
      gate: {
        type: "choose",
        correct: "xmm0",
        options: [
          { id: "rax", label: "EAX", feedback: "Integers and pointers come back in RAX. Floating point comes back in XMM0." },
          { id: "xmm0", label: "XMM0, low 32 bits" },
          { id: "xmm1", label: "XMM1", feedback: "Every floating-point result uses XMM0." },
        ],
      },
    },
    {
      section: "checkpoint",
      kind: "Choose",
      title: "Type from instruction",
      say: "movsd xmm2,qword ptr [...] right before a call. What type is argument 3?",
      gate: {
        type: "choose",
        correct: "double",
        options: [
          { id: "float", label: "float", feedback: "sd means scalar double, and qword is 8 bytes." },
          { id: "double", label: "double" },
          { id: "int", label: "int", feedback: "XMM2 carries floating point." },
        ],
      },
    },
    {
      section: "checkpoint",
      kind: "Fill",
      title: "Read a call site",
      say: "movss xmm0,dword ptr [...]\nmov edx,7\nmovss xmm2,dword ptr [...]\ncall g\n\nWrite g's parameter types.",
      gate: {
        type: "fill",
        fields: [
          { id: "p1", label: "Parameter 1", format: "choice", answer: "float", options: ["int", "float", "double"] },
          { id: "p2", label: "Parameter 2", format: "choice", answer: "int", options: ["int", "float", "double"] },
          { id: "p3", label: "Parameter 3", format: "choice", answer: "float", options: ["int", "float", "double"] },
        ],
      },
    },
  ],
  tryIt: [
    "bp calls.mix and press F9. Read XMM1 and XMM3, switching the XMM display format in the registers pane to see them as numbers.",
    "Press Ctrl+F9, then F8, and read XMM0.",
    "One exception to remember: for printf and other variadic functions, a double in the first four arguments is passed in both the XMM register and the matching integer register.",
  ],
};
