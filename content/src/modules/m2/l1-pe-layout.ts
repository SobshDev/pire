import { where } from "../../pe/build";
import type { LessonInput } from "../../schema";
import { vaultSource } from "../../specimens/vault";
import { vaultPe as pe } from "../../specimens/vault/file";

const at = (id: string) => where(pe, id);
const hx = (n: number | bigint) => n.toString(16).toUpperCase();
const lfanew = at("dos.e_lfanew");
const sig = at("nt.Signature");
const machine = at("file.Machine");
const nsec = at("file.NumberOfSections");
const magic = at("opt.Magic");
const entry = at("opt.AddressOfEntryPoint");
const names = pe.sections.map((s) => at("sec" + s.name + ".Name"));
const n = pe.sections.length;

/** Lesson 2.1, designed in docs/lessons/02-anatomy-of-a-windows-executable/01-pe-layout.md. */
export const peLayout: LessonInput = {
  id: "m2.l1",
  module: 2,
  number: "2.1",
  title: "PE layout",
  mission:
    "vault.exe is just bytes on disk. Starting from byte zero, follow the signposts to find what kind of program it is, where its code starts, and how it is split into sections.",
  minutes: 12,
  recording: "vault-stripped.wrong",
  start: { tool: "hex", file: "vault", helper: false },
  source: vaultSource,
  locks: { helper: "beat 6" },
  steps: [
    {
      section: "beat",
      kind: "Look",
      title: "Just bytes",
      say:
        "This is the same vault.exe you debugged in Module 1, as it sits on disk: " +
        pe.bytes.length.toLocaleString("en-US") +
        " bytes. Windows reads these bytes to build the running program. Your job is to read them the way Windows does. Offsets run down the left, 16 bytes per row, and the same bytes as text on the right.",
      spotlight: "hex",
      gate: { type: "continue", label: "Start reading" },
    },
    {
      section: "beat",
      kind: "Click",
      title: "MZ",
      say: "Every Windows executable starts with the two letters MZ. Find them and click them.",
      action: "Click the M or the Z",
      gate: {
        type: "click",
        accept: ["hex:0-1"],
        fallback: "Look at the very first row, offset `00000000`. The text column on the right starts with MZ. Click one of those two bytes, 4D or 5A.",
      },
      hints: ["The answer is on the first row.", "4D is the letter M and 5A is the letter Z."],
      success:
        "MZ marks the old DOS header, 64 bytes kept for backwards compatibility. Almost everything in it is ignored today, except one field. (MZ stands for Mark Zbikowski, one of the engineers who designed the format.)",
      reveal: ["dos", "dos.e_magic"],
      successHighlights: ["hex:0-1"],
    },
    {
      section: "beat",
      kind: "Predict",
      title: "The signpost at 0x3C",
      say:
        "At offset `0x3C` the DOS header holds e_lfanew: the file offset of the real header. It's a 4-byte little-endian number, just like g_attempts in Lesson 1.4. Read the 4 pulsing bytes. What offset do they point to?",
      pulse: [lfanew.range],
      gate: {
        type: "predict",
        format: "hex",
        answer: hx(pe.lfanew),
        placeholder: "hex, like 1A0",
        wrong: [
          { match: hx(pe.lfanew) + "000000", feedback: "That's the bytes read left to right. Little-endian means the first byte is the lowest. Flip them." },
          { match: "3C", feedback: "`0x3C` is where the field is. Read the 4 bytes stored there." },
        ],
        fallback: "Read the 4 bytes at `0x3C` from right to left: the last byte is the highest. Leading zeros don't matter.",
      },
      hints: ["The bytes are " + Array.from(pe.bytes.slice(0x3c, 0x40), (b) => hx(b).padStart(2, "0")).join(" ") + ".", "Right to left that's 000000" + hx(pe.lfanew) + "."],
      success: "0x" + hx(pe.lfanew) + ". The real header starts " + pe.lfanew + " bytes into the file. Everything between here and there is filler from the DOS days, now marked in grey.",
      reveal: ["dos.e_lfanew", "stub", "rich"],
      successHighlights: [lfanew.range],
    },
    {
      section: "beat",
      kind: "Key",
      title: "Jump there",
      say:
        'Between the DOS header and the real header is a tiny DOS program that prints "This program cannot be run in DOS mode." (you can read it in the text column), and a block the Microsoft linker adds called the Rich header. Neither matters for us. Jump to the real header: press `Ctrl+G` and type the offset.',
      action: "Ctrl+G, then type " + hx(pe.lfanew),
      gate: {
        type: "command",
        surface: "goto",
        accept: [hx(pe.lfanew), "0x" + hx(pe.lfanew), "0" + hx(pe.lfanew), hx(pe.lfanew) + "h"],
        wrong: [{ match: "3C", feedback: "0x3C is the signpost. Jump to where it points: 0x" + hx(pe.lfanew) + "." }],
        fallback: "Type the offset e_lfanew holds: " + hx(pe.lfanew) + ".",
      },
      unlockKey: "Ctrl+G",
    },
    {
      section: "beat",
      kind: "Click",
      title: "PE",
      say: 'The cursor is on offset 0x' + hx(pe.lfanew) + '. The text column shows PE followed by two zero bytes. This signature starts the NT headers, the part Windows actually uses. Click it.',
      pulse: [sig.range],
      gate: {
        type: "click",
        accept: [sig.range],
        fallback: "Click one of the 4 bytes 50 45 00 00 at offset 0x" + hx(pe.lfanew) + ".",
      },
      success: "You've flipped bytes by hand once. From now on, select bytes and the little-endian helper on the right does it for you.",
      reveal: ["nt"],
      successHighlights: [sig.range],
    },
    {
      section: "beat",
      kind: "Select",
      title: "What machine?",
      say: "Right after the signature comes the 20-byte file header. Its first 2 bytes say which CPU this file is for. Drag across those 2 bytes to select them.",
      action: "Drag across the 2 bytes after PE\\0\\0",
      setup: { helper: true },
      pulse: [machine.range],
      gate: { type: "select", start: machine.at, length: 2, fallback: "Select the 2 bytes right after 50 45 00 00." },
      success: "The helper reads them as `0x8664`. Look at it on the right.",
      reveal: ["file", "file.Machine"],
    },
    {
      section: "beat",
      kind: "Choose",
      title: "0x8664 means...",
      say: "Machine is `0x8664`. Which CPU is that?",
      gate: {
        type: "choose",
        correct: "x64",
        options: [
          { id: "x64", label: "x64 (64-bit Intel and AMD)" },
          { id: "x86", label: "32-bit x86", feedback: "A 32-bit program would say `0x014C` here." },
          { id: "arm", label: "ARM64", feedback: "ARM64 is `0xAA64`." },
        ],
      },
      success: "x64. A 32-bit program would say `0x014C`. Checking this field is the first thing you do with a new file.",
    },
    {
      section: "beat",
      kind: "Predict",
      title: "Number of sections",
      say: "The next 2 bytes are NumberOfSections. How many sections does vault.exe have?",
      pulse: [nsec.range],
      gate: {
        type: "predict",
        format: "int",
        answer: String(n),
        placeholder: "a number",
        fallback: "Select the 2 pulsing bytes and read the helper's value.",
      },
      success: "Keep that number, " + n + ". You'll count them in a moment.",
      reveal: ["file.NumberOfSections"],
    },
    {
      section: "beat",
      kind: "Select",
      title: "The optional header (not optional)",
      say:
        "After the 20-byte file header comes the 'optional' header. It isn't optional for executables. Its first field, Magic, is `0x20B` for 64-bit files (PE32+) and `0x10B` for 32-bit ones. Select Magic.",
      pulse: [magic.range],
      gate: { type: "select", start: magic.at, length: 2, fallback: "Magic is the 2 bytes right after the file header, at offset 0x" + magic.at + "." },
      success: "`0x20B`: PE32+, a 64-bit file, matching the machine type.",
      reveal: ["opt", "opt.Magic"],
    },
    {
      section: "beat",
      kind: "Select",
      title: "The entry point",
      say:
        "AddressOfEntryPoint is where Windows starts running the program. It's 4 bytes, `0x10` bytes into the optional header. In Lesson 1.5, x64dbg stopped there with 'entry breakpoint'. Select it.",
      pulse: [entry.range],
      gate: { type: "select", start: entry.at, length: 4, fallback: "Select the 4 pulsing bytes at offset 0x" + entry.at + "." },
      success: "0x" + hx(pe.entry) + ".",
      reveal: ["opt.AddressOfEntryPoint"],
    },
    {
      section: "beat",
      kind: "Choose",
      title: "Why so small?",
      say: "The entry breakpoint in Module 1 was at 0x" + hx(pe.imageBase + BigInt(pe.entry)) + ", but this field says 0x" + hx(pe.entry) + ". Why?",
      gate: {
        type: "choose",
        correct: "relative",
        options: [
          { id: "relative", label: "The field is an offset from where the program is loaded." },
          { id: "wrong", label: "x64dbg was wrong.", feedback: "x64dbg showed where the code really was in memory. The file stores something else." },
          { id: "packed", label: "The file is compressed.", feedback: "Nothing is compressed here. Compare the two numbers: what's the difference between them?" },
        ],
      },
      success:
        "Right. Add ImageBase, which is 0x" + hx(pe.imageBase) + " for vault.exe, and you get the address you saw: 0x" + hx(pe.imageBase + BigInt(pe.entry)) + ". Lesson 2.2 is all about this.",
    },
    {
      section: "beat",
      kind: "Click",
      title: "The section table",
      say:
        "Right after the optional header is the section table: one 40-byte entry per section, each starting with an 8-byte name. We jumped there. Click each name in the text column.",
      setup: { hexAt: hx(names[0]!.offset) },
      action: "Click every section name",
      gate: {
        type: "click",
        all: true,
        accept: names.map((x) => x.range),
        fallback: "Click the section names in the text column.",
      },
      hints: ["The names start with a dot: .text, then the next one 40 bytes later."],
      success:
        "All " + n + ", matching NumberOfSections. .text is the code: main and check_code live here. .rdata is read-only data: the 'opensesame' string and the import table live here. .data is read-write data: g_attempts and the SECRET pointer. .pdata holds tables Windows uses to unwind the stack for exceptions on x64. There's no .reloc here because this build always loads at its preferred address; Lesson 2.2 shows one that doesn't. Section names are only labels for humans, and packers often rename them, so don't trust names alone.",
      reveal: pe.sections.map((s) => "sec" + s.name),
    },
    {
      section: "beat",
      kind: "Recap",
      title: "Connect it back",
      say:
        "In Lesson 1.4 you found SECRET in .data and the text it points to in .rdata. Now you know what those names are: two of the sections you just clicked. The section table says where each one sits in the file and where it goes in memory.",
      gate: { type: "continue" },
    },
    {
      section: "checkpoint",
      kind: "Order",
      title: "Put the file in order",
      say: "Put the parts of a PE file in the order they appear, from offset 0.",
      gate: {
        type: "order",
        items: ["DOS header", "DOS stub", "PE signature", "File header", "Optional header", "Section table", "Section data"],
        fallback: "Start at offset 0 with MZ, then follow the signpost.",
      },
    },
    {
      section: "checkpoint",
      kind: "Fill",
      title: "vault.exe's passport",
      say: "Fill in vault.exe's passport. Every answer is a field you read in this lesson; the bytes are still on the left.",
      gate: {
        type: "fill",
        fields: [
          { id: "machine", label: "Machine", format: "choice", answer: "x64", options: ["x64", "32-bit x86", "ARM64"] },
          { id: "magic", label: "Magic", format: "choice", answer: "PE32+", options: ["PE32", "PE32+"] },
          { id: "sections", label: "Sections", format: "int", answer: String(n) },
          { id: "entry", label: "Entry point (RVA)", format: "hex", answer: hx(pe.entry), placeholder: "hex" },
          { id: "base", label: "ImageBase", format: "hex", answer: hx(pe.imageBase), placeholder: "hex" },
        ],
      },
      hints: [
        "Every answer is a field you selected in this lesson.",
        "The entry point is `0x10` bytes into the optional header. ImageBase is 8 bytes at `0x18` into it.",
        "x64, PE32+, " + n + ", " + hx(pe.entry) + ", " + hx(pe.imageBase) + ".",
      ],
    },
    {
      section: "checkpoint",
      kind: "Choose",
      title: "A different file",
      say: "Another file's Machine field reads 4C 01. What is it?",
      gate: {
        type: "choose",
        correct: "x86",
        options: [
          { id: "x64", label: "A 64-bit x64 program", feedback: "Flip it: `0x014C`, which is 32-bit." },
          { id: "x86", label: "A 32-bit x86 program" },
          { id: "arm", label: "An ARM64 program", feedback: "ARM64 is `0xAA64`. Flip these bytes first." },
        ],
      },
      success: "`0x014C`, a 32-bit program. You'll meet one in the module challenge.",
    },
    {
      section: "checkpoint",
      kind: "Quiz",
      title: "Where does it live?",
      say: "Which section holds each of these?",
      gate: {
        type: "quiz",
        questions: [
          {
            prompt: "main's code",
            options: [{ id: "text", label: ".text" }, { id: "rdata", label: ".rdata" }, { id: "data", label: ".data" }],
            correct: "text",
            feedback: "Code lives in the executable section.",
          },
          {
            prompt: 'The string "Access denied."',
            options: [{ id: "text", label: ".text" }, { id: "rdata", label: ".rdata" }, { id: "data", label: ".data" }],
            correct: "rdata",
            feedback: "String literals never change, so they go in read-only data.",
          },
          {
            prompt: "g_attempts, the counter that goes up",
            options: [{ id: "text", label: ".text" }, { id: "rdata", label: ".rdata" }, { id: "data", label: ".data" }],
            correct: "data",
            feedback: "It changes while the program runs, so it needs a writable section.",
          },
        ],
      },
    },
  ],
  tryIt: [
    "Open vault.exe (or any .exe you built) in a hex editor such as HxD.",
    "Find MZ, read e_lfanew at 0x3C, jump to PE, and read the machine type.",
    "Find the section names after the optional header.",
  ],
};
