import { rvaToOffset } from "../../pe/build";
import type { LessonInput } from "../../schema";
import { loadedAddress } from "../../specimens/msvc";
import { vault, vaultSource } from "../../specimens/vault";
import { vaultPe as pe } from "../../specimens/vault/file";
import { user32 } from "../../specimens/files";

const hx = (n: number | bigint) => n.toString(16).toUpperCase();
const pad = (n: bigint) => hx(n).padStart(16, "0");
const STDIO = "api-ms-win-crt-stdio-l1-1-0.dll";
const puts = pe.imports.flatMap((i) => i.funcs).find((f) => f.name === "puts")!;
const slotOff = rvaToOffset(pe, puts.slot)!;
const nameOff = rvaToOffset(pe, puts.hintName)!;
const slotVa = pe.imageBase + BigInt(puts.slot);
const putsLoaded = loadedAddress("puts");
const u32 = user32();
const msgbox = u32.exports.find((e) => e.name === "MessageBoxA")!;
const USER32_BASE = 0x7ffe1c3b0000n;
const dlls = pe.imports.map((i) => i.dll);
const where = ["USER32.dll", "KERNEL32.dll", STDIO, "ucrtbase.dll"];

/** Lesson 2.3, designed in docs/lessons/02-anatomy-of-a-windows-executable/03-imports-and-exports.md. */
export const importsAndExports: LessonInput = {
  id: "m2.l3",
  module: 2,
  number: "2.3",
  title: "Imports and exports",
  mission:
    "vault.exe calls puts and MessageBoxA, but their code isn't in vault.exe. Find out how the program reaches them, and why their names survived when main's didn't.",
  minutes: 12,
  recording: "vault-stripped.wrong",
  start: { tool: "x64dbg", at: vault["main.puts"], helper: true, converter: true, file: "vault" },
  source: vaultSource,
  locks: {},
  steps: [
    {
      section: "beat",
      kind: "Choose",
      title: "The puzzle",
      say:
        "Back in x64dbg, paused in main. Calls to your own functions looked like call vault.`0000000140001000`. Calls to puts look different: `call qword ptr ds:[<&puts>]`, with brackets. What do the brackets mean?",
      setup: { banner: "x64dbg, paused on main's call to puts" },
      spotlight: "disassembly",
      pulse: ["disasm:" + vault["main.puts"]],
      gate: {
        type: "choose",
        correct: "read",
        options: [
          { id: "read", label: "Call the address stored at that memory location." },
          { id: "direct", label: "Call that address directly.", feedback: "Without brackets it would. Brackets in x64 assembly always mean 'the memory at'." },
          { id: "comment", label: "It's a comment.", feedback: "Comments go in the comment column. This is part of the instruction." },
        ],
      },
      success:
        "Brackets mean 'read memory'. The CPU reads an 8-byte address from that slot and calls whatever it finds. The slot is part of the Import Address Table, the IAT. Let's find it in the file.",
    },
    {
      section: "beat",
      kind: "Click",
      title: "Which DLLs?",
      say:
        "This is the Imports view, built from the import table that data directory 1 points to. It lists every DLL vault.exe needs, " +
        dlls.length +
        " of them. Click USER32.dll, then the api-ms-win-crt-stdio DLL, to see what the program takes from each.",
      setup: { tool: "pe", peNode: "imports", peNodes: ["imports"], banner: "The Imports view" },
      action: "Click USER32.dll and " + STDIO,
      gate: { type: "click", all: true, accept: ["pe:imp:USER32.dll", "pe:imp:" + STDIO], fallback: "Click the DLL rows." },
      success:
        "USER32.dll gives MessageBoxA. The stdio one gives puts, fgets, and __stdio_common_vfprintf. Names starting with api-ms-win-crt are 'API sets': Windows redirects them to ucrtbase.dll, which is why you landed in ucrtbase in Lesson 1.2.",
    },
    {
      section: "beat",
      kind: "Choose",
      title: "Where's printf?",
      say: "vault.c calls printf, but printf isn't in any import list. Why not?",
      gate: {
        type: "choose",
        correct: "inline",
        options: [
          { id: "inline", label: "printf is defined in a header and calls __stdio_common_vfprintf." },
          { id: "gone", label: "printf was optimized away.", feedback: "The prompt still prints, so something does the work. Look at the stdio imports again." },
          { id: "k32", label: "printf is in KERNEL32.", feedback: "KERNEL32 doesn't print formatted text. Look at the stdio list." },
        ],
      },
      success:
        "Modern MSVC's printf is a small inline wrapper copied into the program: the one at 0x" + hx(BigInt("0x" + vault.printf)) + " you stepped into in Lesson 1.2. The real work is in __stdio_common_vfprintf. When you hunt for printf in a binary, look for that name.",
    },
    {
      section: "beat",
      kind: "Select",
      title: "The IAT slot on disk",
      say:
        "puts's IAT slot is at RVA 0x" + hx(puts.slot) + ", file offset 0x" + hx(slotOff) + ". The hex viewer is there. Select the slot's 8 bytes. Is that an address you could call?",
      setup: { tool: "hex", hexAt: hx(slotOff), banner: "vault.exe on disk" },
      pulse: ["hex:" + hx(slotOff) + "-" + hx(slotOff + 7)],
      gate: { type: "select", start: hx(slotOff), length: 8, fallback: "Select the 8 bytes starting at the pulsing offset 0x" + hx(slotOff) + "." },
      success: "0x" + hx(puts.hintName) + ". That's far too small to be code in a DLL. It's an RVA inside vault.exe's own .rdata.",
      reveal: ["iat." + STDIO, "iat.puts"],
    },
    {
      section: "beat",
      kind: "Key",
      title: "Follow the RVA",
      say:
        "Follow it. Turn RVA 0x" + hx(puts.hintName) + " into a file offset with the converter on the right, then jump there with Ctrl+G.",
      action: "Converter, then `Ctrl+G`",
      gate: {
        type: "command",
        surface: "goto",
        accept: [hx(nameOff), "0x" + hx(nameOff)],
        wrong: [{ match: hx(puts.hintName), feedback: "That's the RVA. Put it in the converter's RVA box and use the file offset." }],
        fallback: "Type the RVA into the converter's RVA box; the file offset appears below it.",
      },
      hints: ["The converter is under the little-endian value.", "The file offset is 0x" + hx(nameOff) + "."],
      success:
        'Two bytes of "hint" (a guess at where the name sits in the DLL\'s export list), then the text puts. On disk, the slot just points to the function\'s name. It\'s a note that says "please fill in puts here".',
      reveal: ["name.puts"],
      successHighlights: ["hex:" + hx(nameOff) + "-" + hx(nameOff + 6)],
    },
    {
      section: "beat",
      kind: "Choose",
      title: "The IAT slot in memory",
      say:
        "Now the same slot in x64dbg, after Windows loaded the program and before any of its code ran. The dump shows the slot at 0x" + hx(slotVa) + ". What kind of value is in it now?",
      setup: { tool: "x64dbg", at: vault.mainCRTStartup, dump: pad(slotVa), banner: "x64dbg, at the entry breakpoint" },
      spotlight: "dump",
      gate: {
        type: "choose",
        correct: "loaded",
        options: [
          { id: "loaded", label: "The address of puts inside ucrtbase.dll" },
          { id: "same", label: "The same small number", feedback: "Read the first 8 bytes of the dump, right to left. Is that 0x" + hx(puts.hintName) + "?" },
          { id: "zero", label: "Zero", feedback: "Read the first 8 bytes of the dump. They aren't zero." },
        ],
      },
      success:
        "0x" + hx(putsLoaded) + ", inside ucrtbase.dll. The loader looked up puts, wrote its real address into the slot, and every call to puts reads it from there.",
    },
    {
      section: "beat",
      kind: "Choose",
      title: "Why the names survived",
      say: "In Lesson 1.5, without the PDB, main lost its name but every import kept its name. Why?",
      gate: {
        type: "choose",
        correct: "loader",
        options: [
          { id: "loader", label: "The loader needs import names to find the functions, so they must stay in the file." },
          { id: "guess", label: "x64dbg guessed them.", feedback: "No guessing: you just read the name puts in the file yourself." },
          { id: "strip", label: "Stripping only removes main.", feedback: "It removes every name the program doesn't need to run. Which names does it need?" },
        ],
      },
      success:
        "Imports are your best landmarks in a stripped binary. A program that imports CreateFileW and WriteFile writes files; one that imports MessageBoxA shows boxes. You'll use this constantly.",
    },
    {
      section: "beat",
      kind: "Click",
      title: "Exports",
      say: "The other side of an import is an export. user32.dll publishes a list of the functions it offers: " + u32.exports.length + " of them here. Search for MessageBoxA and click it.",
      setup: { tool: "pe", file: "user32", peNode: "exports", peNodes: ["exports"], banner: "user32.dll's exports" },
      pulse: ["pe:search"],
      gate: {
        type: "click",
        accept: ["pe:exp:MessageBoxA"],
        wrong: [{ match: "pe:exp:MessageBoxW", feedback: "Close: that's the wide-character version. vault.exe imports the A (ANSI) one." }],
        fallback: "Type MessageBoxA in the search box and click its row.",
      },
      success:
        "RVA 0x" + hx(msgbox.rva) + ". The loader matched vault.exe's \"please fill in MessageBoxA\" with this entry, added user32's base (0x" + hx(USER32_BASE) + ") to the RVA, and wrote 0x" + hx(USER32_BASE + BigInt(msgbox.rva)) + " into vault.exe's IAT. That's where your bp MessageBoxA stopped in Lesson 1.3.",
    },
    {
      section: "beat",
      kind: "Look",
      title: "Does vault.exe export anything?",
      say:
        "Executables usually export nothing; DLLs exist to export. vault.exe's export directory, data directory 0, has address 0 and size 0. Click Optional Hdr and look at the Export rows near the bottom to confirm.",
      setup: { file: "vault", peNode: "imports", peNodes: ["opt", "imports"] },
      gate: { type: "click", accept: ["pe:field:dd.Export.VirtualAddress", "pe:field:dd.Export.Size"], fallback: "Open Optional Hdr and click the Export.VirtualAddress row." },
      success: "Zero: nothing exported. Lesson 2.5 opens this viewer fully.",
    },
    {
      section: "checkpoint",
      kind: "Fill",
      title: "Who provides what",
      say: "Fill in where each function comes from.",
      gate: {
        type: "fill",
        fields: [
          { id: "msgbox", label: "MessageBoxA is imported from", format: "choice", answer: "USER32.dll", options: where },
          { id: "puts", label: "puts is imported from", format: "choice", answer: STDIO, options: where },
          { id: "lives", label: "puts really lives in", format: "choice", answer: "ucrtbase.dll", options: where },
        ],
      },
      hints: ["The import table names the DLL; API sets redirect.", "api-ms-win-crt-* names are redirected to ucrtbase.dll.", "USER32.dll, " + STDIO + ", ucrtbase.dll."],
    },
    {
      section: "checkpoint",
      kind: "Order",
      title: "A call to MessageBoxA",
      say: "Put the steps of a call to MessageBoxA in order.",
      gate: {
        type: "order",
        items: [
          "The loader reads the import name",
          "The loader finds MessageBoxA in user32's exports",
          "The loader writes the address into the IAT slot",
          "main runs call qword ptr [slot]",
          "The CPU jumps into user32",
        ],
        fallback: "Nothing can be called until its address is known, and loading happens before main runs.",
      },
      hints: ["Nothing can be called until its address is known.", "Loading happens before main runs."],
    },
    {
      section: "checkpoint",
      kind: "Choose",
      title: "Guess the behavior",
      say: "A mystery program imports CreateFileW, WriteFile, CloseHandle, and GetTempPathW. What does it probably do?",
      gate: {
        type: "choose",
        correct: "temp",
        options: [
          { id: "temp", label: "Writes a file in the temp folder" },
          { id: "net", label: "Downloads something from the internet", feedback: "Nothing here talks to the network. Look at the names: File, Write, TempPath." },
          { id: "gui", label: "Shows a window", feedback: "Windows come from USER32. These are all KERNEL32 file functions." },
        ],
      },
      success: "Probably. Imports show what a program can call, not what it does, and code can also find functions at runtime with GetProcAddress (Module 7). But they're a strong first guess.",
    },
  ],
  tryIt: [
    "Load vault.exe in x64dbg, open the Symbols tab, click vault.exe and look at its imports. Click user32.dll and search its exports for MessageBoxA.",
    "In main, select call qword ptr ds:[<&puts>], right-click the operand and follow the memory operand in the dump. Check the 8 bytes match ucrtbase's puts.",
  ],
};
