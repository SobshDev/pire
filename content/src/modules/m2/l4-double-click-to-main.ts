import type { LessonInput } from "../../schema";
import { vault, vaultRecordings, vaultSource } from "../../specimens/vault";

const rec = vaultRecordings().strippedWrong;
const log = rec.log ?? [];
const user32Line = log.findIndex((l) => l.endsWith("user32.dll"));
const sysLine = log.findIndex((l) => l.startsWith("System breakpoint"));
const PROT = ["ER---", "-R---", "-RW--", "ERW--"];

/** Lesson 2.4, designed in docs/lessons/02-anatomy-of-a-windows-executable/04-from-double-click-to-main.md. */
export const doubleClickToMain: LessonInput = {
  id: "m2.l4",
  module: 2,
  number: "2.4",
  title: "From double-click to main",
  mission: "Windows does a lot of work before main runs. Put the loading steps in order, and find the evidence for each one in x64dbg.",
  minutes: 10,
  recording: "vault-stripped.wrong",
  start: { tool: "x64dbg", at: "start" },
  source: vaultSource,
  locks: {},
  steps: [
    {
      section: "beat",
      kind: "Look",
      title: "The story so far",
      say:
        "In Module 1 you saw three stops: the system breakpoint in ntdll, the entry breakpoint in vault.exe, and main. This is the whole story around them. You'll find evidence for each part in x64dbg.",
      setup: { banner: "x64dbg, at the system breakpoint" },
      diagram: "timeline",
      gate: { type: "continue" },
    },
    {
      section: "beat",
      kind: "Look",
      title: "The kernel maps the file",
      say:
        "When you start a program, the Windows kernel creates a new process and maps the .exe into memory using the section table you read in Lesson 2.1: each section goes to ImageBase plus its RVA. It also maps ntdll.dll into every process. Then it starts the first thread inside ntdll.",
      diagram: "mapping",
      gate: { type: "continue" },
    },
    {
      section: "beat",
      kind: "Click",
      title: "The loader at work",
      say:
        "Code in ntdll called the loader now runs. It reads the import table, loads each DLL the program needs (and the DLLs those need), and fills in the IAT. x64dbg's Log tab shows each DLL as it arrives. Find user32.dll and click its line.",
      setup: { tab: "Log" },
      spotlight: "tabview",
      gate: {
        type: "click",
        accept: ["log:" + user32Line],
        wrong: [{ match: "log:*", feedback: "Look for the line that ends in user32.dll." }],
        fallback: "Click the DLL Loaded line that ends in user32.dll.",
      },
      success:
        "USER32.dll was in vault.exe's import list in Lesson 2.3. Here it's being loaded, along with KernelBase, win32u, and gdi32: DLLs user32 itself needs. Nobody listed those in vault.exe; the loader followed each DLL's own imports.",
    },
    {
      section: "beat",
      kind: "Choose",
      title: "Where the system breakpoint fits",
      say:
        "Near the end of the log: \"" + log[sysLine] + "\" Partway through loading, ntdll checks whether a debugger is attached and, if so, triggers a breakpoint. That's x64dbg's first stop, a courtesy from Windows. Was any of vault.exe's own code run before it?",
      pulse: ["log:" + sysLine],
      gate: {
        type: "choose",
        correct: "no",
        options: [
          { id: "no", label: "No. RIP is still in ntdll, and the entry point hasn't run." },
          { id: "yes", label: "Yes, the start of main.", feedback: "Look at the status bar and the title: the module is ntdll.dll. vault.exe's entry point is still ahead." },
        ],
      },
      success: "None of it. Everything so far was Windows. That's why Lesson 1.5 pressed F9 once to reach the entry point.",
    },
    {
      section: "beat",
      kind: "Fill",
      title: "Memory Map",
      say:
        "The Memory Map tab lists every block of memory in the process. vault.exe's rows are in amber: the header page, then each section, with its protection. Read the protections and fill them in.",
      setup: { tab: "Memory Map" },
      spotlight: "tabview",
      gate: {
        type: "fill",
        fields: [
          { id: "text", label: ".text", format: "choice", answer: "ER---", options: PROT },
          { id: "rdata", label: ".rdata", format: "choice", answer: "-R---", options: PROT },
          { id: "data", label: ".data", format: "choice", answer: "-RW--", options: PROT },
        ],
      },
      hints: ["E is execute, R is read, W is write.", "Only one section can run, and only one can be written."],
      success:
        "Code can run but not be written. Read-only data can't be changed: a program that writes to the \"opensesame\" string crashes. Globals like g_attempts live in .data, the one writable section. These protections come from each section's Characteristics, which you'll read in Lesson 2.5.",
    },
    {
      section: "beat",
      kind: "Order",
      title: "The handover",
      say:
        "After the loader finishes, a few hands pass control along before vault.exe's code runs. Put them in order, starting right after the loader.",
      setup: { tab: "CPU" },
      diagram: "timeline",
      gate: {
        type: "order",
        items: ["TLS callbacks, if any", "ntdll's RtlUserThreadStart", "kernel32's BaseThreadInitThunk", "vault.exe's entry point"],
        fallback: "The timeline above has the answer. The thread starts in ntdll, and kernel32 makes the call into the program.",
      },
    },
    {
      section: "beat",
      kind: "Click",
      title: "The call stack proves it",
      say:
        "We set a breakpoint on main (the function at 0x" + vault.main.replace(/^0+/, "") + ") and ran to it. Open the Call Stack tab. It reads like a stack of plates: the newest call on top.",
      setup: { at: vault.main, breakpoints: [{ address: vault.main, kind: "software" }], banner: "Paused at main" },
      action: "Click the Call Stack tab",
      gate: { type: "click", accept: ["tab:Call Stack"], fallback: "Click Call Stack in the row of tabs above the panes." },
      success:
        "Read it from the bottom up: ntdll's RtlUserThreadStart called kernel32's BaseThreadInitThunk, which called vault.exe's entry point, which (after a jump into the C runtime's startup code) called main. The whole chain from Windows to main, written in the stack as return addresses.",
    },
    {
      section: "beat",
      kind: "Look",
      title: "And after main",
      say:
        "When main returns, the startup routine passes its return value to exit. The C runtime cleans up and the process ends. That's why main's return value becomes the process's exit code: the number a script reads as %ERRORLEVEL%, and the one x64dbg prints in its Log when the process exits.",
      setup: { tab: "CPU" },
      gate: { type: "continue" },
    },
    {
      section: "checkpoint",
      kind: "Order",
      title: "The whole story",
      say: "Put the whole startup in order.",
      gate: {
        type: "order",
        items: [
          "The kernel creates the process and maps vault.exe and ntdll",
          "The loader loads DLLs and fills the IAT",
          "TLS callbacks run",
          "RtlUserThreadStart and BaseThreadInitThunk",
          "The entry point (startup routine)",
          "main",
          "exit",
        ],
        fallback: "Nothing runs before the process exists, and nothing can call a DLL before the IAT is filled.",
      },
      hints: ["Nothing runs before the process exists.", "DLLs come before any of the program's code."],
    },
    {
      section: "checkpoint",
      kind: "Choose",
      title: "A missing DLL",
      say: "A program crashes at startup, before x64dbg reaches the entry breakpoint, with an error about a missing DLL. Which step failed?",
      gate: {
        type: "choose",
        correct: "loader",
        options: [
          { id: "kernel", label: "The kernel mapping the .exe", feedback: "The .exe was mapped fine; it's one of its imports that's missing." },
          { id: "loader", label: "The loader loading DLLs" },
          { id: "main", label: "main", feedback: "main never ran: the crash came before the entry breakpoint." },
        ],
      },
    },
    {
      section: "checkpoint",
      kind: "Choose",
      title: "Changing g_attempts",
      say: "Which section would let you change g_attempts while the program runs?",
      gate: {
        type: "choose",
        correct: "data",
        options: [
          { id: "text", label: ".text (ER)", feedback: "Code can run but not be written." },
          { id: "rdata", label: ".rdata (R)", feedback: "Read-only means read-only." },
          { id: "data", label: ".data (RW)" },
        ],
      },
    },
  ],
  tryIt: [
    "In x64dbg, open Options > Preferences > Events and tick DLL Load. Restart vault.exe and watch x64dbg stop as each DLL arrives.",
    "Open the Memory Map tab and double-click vault.exe's .text row to see its bytes in the dump.",
    "Pause anywhere in main and open the Call Stack tab. Double-click a row to see the code that made the call.",
  ],
};
