import type { LessonInput } from "../../schema";
import { callsSource } from "../../specimens/calls";
import { callsReleaseRecordings } from "../../specimens/calls/release";

const at = callsReleaseRecordings().at;
const a = (label: string) => {
  const v = at[label];
  if (!v) throw new Error("calls-release has no label " + label);
  return v;
};
const d = (label: string) => "disasm:" + a(label);
const KINDS = ["Volatile", "Nonvolatile"];
const sort = (regs: [string, string][]) => regs.map(([reg, kind]) => ({ id: reg.toLowerCase(), label: reg, format: "choice" as const, answer: kind, options: KINDS }));
/** What puts changed in the recording: every volatile general register, and nothing else. */
const CLOBBERED = ["RAX", "RCX", "RDX", "R8", "R9", "R10", "R11"];

/** Lesson 3.4, designed in docs/lessons/03-functions-and-calling-convention/04-volatile-and-nonvolatile-registers.md. */
export const volatileNonvolatile: LessonInput = {
  id: "m3.l4",
  module: 3,
  number: "3.4",
  title: "Volatile and nonvolatile registers",
  mission:
    "shout calls puts in a loop. puts can trash half the registers, yet shout's counter survives every call. Find out where it hides and how shout keeps its promise to its caller.",
  minutes: 12,
  recording: "calls-release",
  start: { at: a("shout") },
  source: callsSource,
  locks: {},
  console: true,
  steps: [
    {
      section: "beat",
      kind: "Look",
      title: "The problem",
      say:
        "This is calls.exe again, built in Release (/O2) this time. It's your first optimized code; Module 9 covers optimized code in depth, so for now look only at shout.\n\nshout keeps i and times in registers. Then it calls puts, which uses registers for its own work. How does i survive?",
      setup: { banner: "calls-release.exe, paused on shout's first line" },
      source: "shout",
      spotlight: "disassembly",
      gate: { type: "continue" },
    },
    {
      section: "beat",
      kind: "Sort",
      title: "Two kinds of register",
      say:
        "Any function you call may destroy the volatile registers: RAX, RCX, RDX, R8, R9, R10 and R11. The nonvolatile ones (RBX, RBP, RDI, RSI and R12 to R15) it may use too, but it must put the old value back before returning. RSP is always restored. So a value that needs to survive a call goes in a nonvolatile register.\n\nSort these.",
      gate: {
        type: "fill",
        fields: sort([["RAX", "Volatile"], ["RBX", "Nonvolatile"], ["RCX", "Volatile"], ["RDI", "Nonvolatile"], ["R8", "Volatile"], ["RSI", "Nonvolatile"], ["R11", "Volatile"], ["R12", "Nonvolatile"]]),
      },
      hints: ["The four argument registers (RCX, RDX, R8, R9) and the return register RAX are all volatile.", "Volatile: RAX, RCX, RDX, R8 to R11. Every other general register is nonvolatile."],
      success: "That's the whole rule. XMM6 to XMM15 are nonvolatile too; floating point is Lesson 3.5.",
    },
    {
      section: "beat",
      kind: "Choose",
      title: "Predict the hiding place",
      say: "i has to survive every call to puts. Which kind of register will the compiler pick for it?",
      gate: {
        type: "choose",
        correct: "non",
        options: [
          { id: "vol", label: "A volatile one", feedback: "puts is allowed to destroy those. i would be gone after the first call." },
          { id: "non", label: "A nonvolatile one" },
        ],
      },
      success: "Look at inc ebx and cmp ebx,edi in the loop. EBX is i and EDI is times. Both are nonvolatile.",
      successHighlights: [d("shout.inc"), d("shout.cmp")],
    },
    {
      section: "beat",
      kind: "Key",
      title: "Watch it survive",
      say: "You're paused on call puts, first time round the loop. Note RBX, RDI, RCX and RDX. Press F8 to step over puts.",
      setup: { at: a("shout.puts"), banner: "Paused on shout's call to puts" },
      spotlight: "registers",
      pulse: ["reg:RBX", "reg:RDI"],
      gate: { type: "key", key: "F8", wrong: [{ key: "F7", feedback: "F7 would step into puts. Use F8 to run over it." }] },
    },
    {
      section: "beat",
      kind: "Click",
      title: "Which ones changed?",
      say: "Changed registers turn red. Click every one that puts changed.",
      spotlight: "registers",
      gate: {
        type: "click",
        all: true,
        accept: CLOBBERED.map((r) => "reg:" + r),
        wrong: [
          { match: "reg:RBX", feedback: "RBX is the same as before: it still holds i." },
          { match: "reg:RDI", feedback: "RDI is the same as before: it still holds times." },
          { match: "reg:RIP", feedback: "RIP always moves. Look for the other red registers." },
          { match: "reg:*", feedback: "That one didn't change. Look for the red ones." },
        ],
        fallback: "RAX, RCX, RDX, and R8 to R11 are red.",
      },
      success: "puts used the volatile registers freely. RBX and RDI came back exactly as they were.",
    },
    {
      section: "beat",
      kind: "Click",
      title: "The cost: saving",
      say:
        "But shout's caller might be using RBX and RDI too, and shout promised to preserve them. So before using them, shout saves the caller's values. Click the two lines at the top of shout that save them.",
      spotlight: "disassembly",
      gate: {
        type: "click",
        all: true,
        accept: [d("shout"), d("shout.push")],
        wrong: [{ match: d("shout.times"), feedback: "That line uses EDI. The save comes before it." }],
        fallback: "mov qword ptr ss:[rsp+8],rbx and push rdi, shout's first two lines.",
      },
      success: "One goes into the shadow space, the other is pushed. MSVC does both; you'll see either.",
    },
    {
      section: "beat",
      kind: "Click",
      title: "And restoring",
      say: "Find the two lines near the end of shout that put them back.",
      spotlight: "disassembly",
      gate: {
        type: "click",
        all: true,
        accept: [d("shout.restore"), d("shout.pop")],
        wrong: [{ match: d("shout.done"), feedback: "That sets the return value. Look just below it." }],
        fallback: "mov rbx,qword ptr ss:[rsp+30] and pop rdi, just before ret.",
      },
      success:
        "Saved at the start, restored at the end. When you read a function, you can mentally delete these lines. They're bookkeeping, not logic.",
    },
    {
      section: "beat",
      kind: "Fill",
      title: "The reader's shortcut",
      say:
        "Here's shout with the bookkeeping removed:\n\nmov edi,ecx\nxor ebx,ebx\nloop: call puts(\"PIRE!\")\ninc ebx\ncmp ebx,edi / jl loop\nmov eax,ebx\n\nA value kept in RBX, RSI, RDI or R12 to R15 across calls is usually a loop counter, a pointer being walked, or a saved argument.",
      source: "shout",
      gate: {
        type: "fill",
        fields: [
          { id: "edi", label: "EDI holds", format: "choice", answer: "times", options: ["i", "times", "the string"] },
          { id: "ebx", label: "EBX holds", format: "choice", answer: "i", options: ["i", "times", "the string"] },
        ],
      },
    },
    {
      section: "beat",
      kind: "Choose",
      title: "The trap",
      say: "Someone wrote this by hand:\n\nmov ecx,5\ncall puts\nadd eax,ecx   ; uses ecx as if it were still 5\n\nWhat's wrong?",
      gate: {
        type: "choose",
        correct: "ecx",
        options: [
          { id: "ecx", label: "ECX is volatile; puts may have changed it" },
          { id: "none", label: "Nothing", feedback: "Look at which register the code expects to survive the call." },
          { id: "rdx", label: "puts needs RDX", feedback: "puts takes one argument, in RCX. The problem is what happens to ECX afterwards." },
        ],
      },
      success: "Never assume a volatile register keeps its value across a call. It's the most common mistake in reading assembly.",
    },
    {
      section: "checkpoint",
      kind: "Sort",
      title: "Volatile or nonvolatile?",
      say: "Sort each register.",
      gate: {
        type: "fill",
        fields: sort([["RAX", "Volatile"], ["RBX", "Nonvolatile"], ["RCX", "Volatile"], ["RSI", "Nonvolatile"], ["R9", "Volatile"], ["R12", "Nonvolatile"], ["R11", "Volatile"], ["RDI", "Nonvolatile"]]),
      },
      hints: ["The argument registers are all volatile.", "Volatile: RAX, RCX, RDX, R8 to R11. Everything else general-purpose is nonvolatile."],
    },
    {
      section: "checkpoint",
      kind: "Choose",
      title: "Where does the pointer live?",
      say: "A loop calls strlen on each element. The pointer to the current element must survive the call. Which register is the compiler likely to use?",
      gate: {
        type: "choose",
        correct: "rsi",
        options: [
          { id: "rcx", label: "RCX", feedback: "RCX is strlen's argument, and volatile. The pointer needs to survive." },
          { id: "rsi", label: "RSI" },
          { id: "rax", label: "RAX", feedback: "RAX gets strlen's return value." },
        ],
      },
    },
    {
      section: "checkpoint",
      kind: "Click",
      title: "Spot the bookkeeping",
      say: "This is calls-release's main. Click every line that saves or restores a nonvolatile register: three at the top, three at the bottom.",
      setup: { at: a("main"), banner: "calls-release.exe, main" },
      spotlight: "disassembly",
      gate: {
        type: "click",
        all: true,
        accept: [d("main"), d("main.saveRsi"), d("main.push"), d("main.restoreRbx"), d("main.restoreRsi"), d("main.pop")],
        wrong: [{ match: d("main.zero"), feedback: "xor eax,eax sets main's return value to 0. That's logic." }],
        fallback: "Saves of RBX, RSI and RDI at the top, and the matching restores just before ret.",
      },
      hints: ["Look for RBX, RSI and RDI being stored or pushed at the start.", "At the end, look for loads into RBX and RSI and a pop rdi."],
    },
    {
      section: "checkpoint",
      kind: "Choose",
      title: "What survives a call?",
      say: "Right after call foo, which registers are guaranteed to hold the same values as before the call?",
      gate: {
        type: "choose",
        correct: "non",
        options: [
          { id: "args", label: "RCX, RDX, R8, R9", feedback: "Those are argument registers, and volatile." },
          { id: "non", label: "RBX, RBP, RDI, RSI, R12 to R15, and RSP" },
          { id: "all", label: "All of them", feedback: "foo may destroy RAX, RCX, RDX and R8 to R11." },
        ],
      },
    },
  ],
  tryIt: [
    "Load calls-release.exe, bp calls.shout and press F9.",
    "Step over each call to puts and note which registers turn red each time.",
    "Find where shout saves and restores RBX and RDI.",
  ],
};
