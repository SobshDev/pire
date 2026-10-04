import type { LessonInput } from "../../schema";
import { vaultAtMain, vaultSource } from "../../specimens/vault";

const RIP_ROW = "disasm:0000000140001070";

/** Lesson 1.1, designed in docs/lessons/01-debugger-basics/01-tour-of-the-interface.md. */
export const tourOfTheInterface: LessonInput = {
  id: "m1.l1",
  module: 1,
  number: "1.1",
  title: "Tour of the interface",
  mission:
    "x64dbg has stopped at the first line of main. Find out where you are, what the CPU holds, and what is on the stack, without running a single instruction.",
  minutes: 10,
  snapshot: vaultAtMain,
  source: vaultSource,
  locks: { infobox: "1.4", callArgs: "3.1", command: "1.3" },
  steps: [
    {
      section: "beat",
      kind: "Overview",
      title: "Everything at once",
      say: "This is what x64dbg looks like when it stops a program. It looks busy, but only four areas matter. Let's meet them one at a time.",
      spotlight: "none",
      gate: { type: "continue", label: "Show me" },
    },
    {
      section: "beat",
      kind: "Spotlight",
      title: "The disassembly pane",
      say: "This is the code, one instruction per line. The highlighted line, marked RIP, is the next instruction the CPU will run. It has not run yet.",
      action: "Click the RIP line",
      spotlight: "disassembly",
      gate: {
        type: "click",
        accept: [RIP_ROW],
        fallback: "Not that one. Look for the row marked RIP on the left.",
      },
      success:
        "That's the next instruction. Each row has four columns: the address, the raw bytes, the instruction, and a comment where x64dbg writes helpful notes, such as the text a string pointer points at.",
    },
    {
      section: "beat",
      kind: "Spotlight",
      title: "Spot the C",
      say: "main starts by calling puts to print the banner. Find the call to puts in the disassembly.",
      action: "Click the call to puts",
      spotlight: "disassembly",
      source: "main.puts",
      gate: {
        type: "click",
        accept: ["disasm:000000014000107B"],
        wrong: [
          {
            match: "disasm:0000000140001074",
            feedback: "Close. This line loads the banner's address into RCX, ready for the call. The call itself is on the next line.",
          },
          { match: RIP_ROW, feedback: "That line is part of main's setup. Look a few lines further down for the word call." },
          {
            match: "disasm:0000000140001088",
            feedback: "That's a call, but to printf. You want the one that mentions puts.",
          },
        ],
        fallback: "Look for a line whose instruction is call and whose operand mentions puts.",
      },
      success:
        "Right. Look at the comment on the line above it: x64dbg already shows the banner text, == PIRE VAULT ==. You just read your first assembly with help from the tool.",
    },
    {
      section: "beat",
      kind: "Predict",
      title: "The registers pane",
      say: "These are the CPU's registers right now. RIP holds the address of the next instruction. What address does RIP hold?",
      action: "Type the value of RIP",
      spotlight: "registers",
      gate: {
        type: "predict",
        format: "hex",
        answer: "140001070",
        placeholder: "0000000140001070",
        fallback: "Not quite. RIP sits below R15 in the registers pane. Copy its value.",
      },
      success: "Same address as the highlighted line. RIP and the highlighted line always agree.",
      successHighlights: ["reg:RIP", RIP_ROW],
    },
    {
      section: "beat",
      kind: "Spotlight",
      title: "RFLAGS",
      say: "Flags live here, one bit each. When a step changes a value, x64dbg paints it red. Nothing is red yet because nothing has run.",
      action: "Click ZF",
      spotlight: "registers.flags",
      gate: {
        type: "click",
        accept: ["flag:ZF"],
        fallback: "ZF is in the first row of flags, under RFLAGS.",
      },
      success: "ZF is the zero flag. You'll watch it flip in Module 5. For now, just remember where it lives.",
    },
    {
      section: "beat",
      kind: "Choose",
      title: "The stack pane",
      say: "This is the stack, 8 bytes per row. The highlighted row is where RSP points. Its comment says “return to …”. What does that mean?",
      spotlight: "stack",
      gate: {
        type: "choose",
        correct: "a",
        options: [
          { id: "a", label: "When main finishes, it returns to this address." },
          {
            id: "b",
            label: "This is the address of main.",
            feedback: "Close, but main's address is in RIP. The stack holds where to go back to afterwards.",
          },
          { id: "c", label: "This is a breakpoint.", feedback: "Breakpoints don't live on the stack. Lesson 1.3 covers them." },
        ],
      },
      success: "Someone called main, and the call left this return address on the stack. Module 3 covers this properly.",
    },
    {
      section: "beat",
      kind: "Spotlight",
      title: "The dump pane",
      say: "The dump shows raw memory: an address, 16 bytes in hex, and the same bytes as text. You'll use it to look at strings, buffers, and globals.",
      action: "Click some readable text in the dump",
      spotlight: "dump",
      gate: {
        type: "click",
        accept: [
          "dump:ascii:0000000140003200",
          "dump:ascii:0000000140003210",
          "dump:ascii:0000000140003220",
          "dump:ascii:0000000140003230",
          "dump:ascii:0000000140003240",
        ],
        wrong: [
          { match: "dump:hex:*", feedback: "That's the hex column. The same bytes as text are on the right." },
          { match: "dump:ascii:*", feedback: "Those are zero bytes, shown as dots. Pick a row with words in it." },
        ],
        fallback: "Click the text column on the right side of the dump.",
      },
      success: "Those are the program's strings, sitting in memory exactly as the compiler wrote them.",
    },
    {
      section: "beat",
      kind: "Spotlight",
      title: "The status bar",
      say: "Paused means the program is frozen and you are in control. While it runs, this says Running. The command box above it unlocks in Lesson 1.3.",
      action: "Click Paused",
      spotlight: "status",
      gate: { type: "click", accept: ["status:paused"], fallback: "The yellow Paused label is at the bottom left." },
      success: "Whenever it says Paused, every value on screen is current.",
    },
    {
      section: "beat",
      kind: "Key",
      title: "Getting lost on purpose",
      say: "Everyone gets lost in the disassembly. Scroll the disassembly until the RIP line is off screen, then press * to jump back.",
      action: "Scroll away, then press *",
      spotlight: "disassembly",
      gate: {
        type: "key",
        key: "*",
        requires: "ripOffscreen",
        notReady: "Scroll the disassembly first, so the RIP line is out of view.",
      },
      success: "The * key takes you back to RIP from anywhere. You just earned your first key.",
      successHighlights: [RIP_ROW],
      unlockKey: "*",
    },
    {
      section: "checkpoint",
      kind: "Match",
      title: "Match the pane",
      say: "Drag each label onto the pane it describes.",
      gate: {
        type: "match",
        items: [
          { label: "next instruction", pane: "disassembly" },
          { label: "register values", pane: "registers" },
          { label: "memory as hex and text", pane: "dump" },
          { label: "return addresses and locals", pane: "stack" },
        ],
        fallback: "Not that pane. Think back to which pane you clicked for each idea.",
      },
      hints: ["Think about which pane changed color when you clicked RIP.", "Code is top left, registers top right."],
      success: "All four in the right place.",
    },
    {
      section: "checkpoint",
      kind: "Predict",
      title: "Back to RIP",
      say: "If you scroll the disassembly away and press *, which line is highlighted?",
      gate: {
        type: "choose",
        correct: "rip",
        options: [
          { id: "rip", label: "The line at RIP." },
          { id: "first", label: "The first line of the program.", feedback: "* goes to where the CPU is, not where the program starts." },
          { id: "clicked", label: "The line I clicked last.", feedback: "* ignores your selection. It always goes back to RIP." },
        ],
      },
      success: "* always brings you back to the next instruction.",
    },
    {
      section: "checkpoint",
      kind: "Choose",
      title: "Running",
      say: "The status bar says Running. Can you trust the register values on screen right now?",
      gate: {
        type: "choose",
        correct: "no",
        options: [
          {
            id: "yes",
            label: "Yes, they update live.",
            feedback: "The CPU changes registers millions of times a second. x64dbg only shows real values while paused.",
          },
          { id: "no", label: "No. The values only make sense while the program is paused." },
        ],
      },
      success: "Pause first, then read.",
    },
  ],
  tryIt: [
    "Install x64dbg and open x64dbg.exe (the 64-bit one). Load vault.exe with File > Open.",
    "x64dbg stops before your code runs. Press F9 until the title bar mentions vault.exe and RIP is inside it. Lesson 1.5 explains these stops.",
    "Point at each of the four panes and say out loud what it shows.",
    "Scroll away and press * to come back.",
  ],
};
