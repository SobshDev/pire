import type { LessonInput } from "../../schema";
import { vaultSource } from "../../specimens/vault";
import { vaultPe as pe } from "../../specimens/vault/file";

const hx = (n: number | bigint) => n.toString(16).toUpperCase();
const msgbox = pe.imports.flatMap((i) => i.funcs).find((f) => f.name === "MessageBoxA")!;
const text = pe.sections.find((s) => s.name === ".text")!;

/** Lesson 2.5, designed in docs/lessons/02-anatomy-of-a-windows-executable/05-using-a-pe-viewer.md. */
export const usingAPeViewer: LessonInput = {
  id: "m2.l5",
  module: 2,
  number: "2.5",
  title: "Using a PE viewer",
  mission: "You've done it all by hand. Now do it in seconds with the kind of tool professionals use, and check that the tool agrees with you.",
  minutes: 10,
  recording: "vault-stripped.wrong",
  start: { tool: "pe", file: "vault", peNode: "dos" },
  source: vaultSource,
  locks: {},
  steps: [
    {
      section: "beat",
      kind: "Look",
      title: "Your notes vs. the tool",
      say:
        "This viewer is modeled on PE-bear: a tree of headers on the left, a table of fields on the right, and the raw bytes underneath. Every number in your vault.exe passport from Lesson 2.1, you found by reading bytes. The viewer reads the same bytes for you. Let's check your work.",
      setup: { banner: "PE viewer, vault.exe" },
      gate: { type: "continue" },
    },
    {
      section: "beat",
      kind: "Click",
      title: "DOS header",
      say: "You're on DOS Hdr. Find e_lfanew and click its row. Does it match the 0xF8 you read by hand?",
      spotlight: "pedetail",
      pulse: ["pe:field:dos.e_lfanew"],
      gate: { type: "click", accept: ["pe:field:dos.e_lfanew"], fallback: "It's the last row of the DOS header." },
      success: "0xF8, at offset 0x3C. The hex pane underneath highlights the same 4 bytes you flipped in Lesson 2.1.",
    },
    {
      section: "beat",
      kind: "Click",
      title: "File header and optional header",
      say:
        "Now the five fields from your passport. Click Machine and NumberOfSections in File Hdr, then Magic, AddressOfEntryPoint, and ImageBase in Optional Hdr.",
      action: "Click all five fields",
      gate: {
        type: "click",
        all: true,
        accept: ["pe:field:file.Machine", "pe:field:file.NumberOfSections", "pe:field:opt.Magic", "pe:field:opt.AddressOfEntryPoint", "pe:field:opt.ImageBase"],
        fallback: "Switch between File Hdr and Optional Hdr with the tabs, and click each field's row.",
      },
      hints: ["The tabs above the table switch between headers.", "Machine and NumberOfSections are in File Hdr; the other three are near the top of Optional Hdr."],
      success:
        "0x8664 (x64), 4 sections, 0x20B (64-bit), entry point 0x1200, ImageBase 0x140000000. The viewer shows the entry point as an RVA, just as you worked out in Lesson 2.2.",
    },
    {
      section: "beat",
      kind: "Choose",
      title: "Subsystem",
      say:
        "Here's a field you haven't used yet. Subsystem, further down Optional Hdr, tells Windows whether the program needs a console window: 3 means console, 2 means a GUI program. vault.exe says 3. Should a GUI program like Notepad say 2 or 3?",
      setup: { peNode: "opt" },
      pulse: ["pe:field:opt.Subsystem"],
      gate: {
        type: "choose",
        correct: "2",
        options: [
          { id: "2", label: "2, Windows GUI" },
          { id: "3", label: "3, Windows console", feedback: "Notepad opens a window and no console. Which number is the GUI one?" },
        ],
      },
      success: "2. When you double-click a console program, Windows opens a console for it. A GUI program gets none, and shows its own windows instead.",
    },
    {
      section: "beat",
      kind: "Click",
      title: "Section headers",
      say:
        "Section Hdrs is the table you used for every conversion in Lesson 2.2: raw address, raw size, virtual address, virtual size. The last column is Characteristics. Click the Characteristics of .text.",
      setup: { peNode: "sections" },
      spotlight: "pedetail",
      pulse: ["pe:sec:.text:Characteristics"],
      gate: { type: "click", accept: ["pe:sec:.text:Characteristics"], fallback: "Click " + hx(text.chars) + " in the .text row." },
      success:
        "0x" + hx(text.chars) + " decodes to code, execute, and read. These flags are where the Memory Map's ER--- for .text came from in Lesson 2.4.",
    },
    {
      section: "beat",
      kind: "Click",
      title: "Imports",
      say:
        "Open Imports. Click USER32.dll, then MessageBoxA. Check its IAT slot against the one you followed in Lesson 2.3.",
      setup: { peNode: "imports" },
      spotlight: "pedetail",
      gate: { type: "click", all: true, accept: ["pe:imp:USER32.dll", "pe:imp:USER32.dll:MessageBoxA"], fallback: "Click USER32.dll, then the MessageBoxA row that appears below." },
      success:
        "Slot at RVA 0x" + hx(msgbox.slot) + ", VA 0x" + hx(pe.imageBase + BigInt(msgbox.slot)) + ": the address inside call qword ptr ds:[<&MessageBoxA>]. On disk it holds 0x" + hx(msgbox.hintName) + ", the RVA of the name record. Same story as puts.",
    },
    {
      section: "beat",
      kind: "Look",
      title: "The 30-second look",
      say:
        "From now on, every time you meet a new executable, do this first. It takes 30 seconds:\n1. 32-bit or 64-bit? (Machine)\n2. Console or GUI? (Subsystem)\n3. ASLR or not? (DYNAMIC_BASE in DllCharacteristics)\n4. Sections: anything odd about the names or sizes?\n5. Imported DLLs, and the most telling functions\n6. Entry point RVA\nYou'll use this checklist in the module challenge.",
      gate: { type: "continue" },
    },
    {
      section: "checkpoint",
      kind: "Choose",
      title: "Spot the mismatch",
      say:
        "Someone else filled in this passport for vault.exe: Machine 0x8664, NumberOfSections 5, Magic 0x20B, AddressOfEntryPoint 0x1200, ImageBase 0x140000000. One value doesn't match the file. Which?",
      gate: {
        type: "choose",
        correct: "sections",
        options: [
          { id: "machine", label: "Machine 0x8664", feedback: "Click Machine in File Hdr: 0x8664, x64. That one's right." },
          { id: "sections", label: "NumberOfSections 5" },
          { id: "entry", label: "AddressOfEntryPoint 0x1200", feedback: "Check Optional Hdr: 0x1200 is right." },
          { id: "base", label: "ImageBase 0x140000000", feedback: "That's the usual 64-bit ImageBase, and vault.exe's." },
        ],
      },
      hints: ["Count the rows in Section Hdrs."],
      success: "vault.exe has 4 sections: .text, .rdata, .data, .pdata. A viewer settles questions like this in a second.",
    },
    {
      section: "checkpoint",
      kind: "Fill",
      title: "The 30-second look: vault.exe",
      say: "Do the 30-second look for vault.exe. Use the viewer.",
      gate: {
        type: "fill",
        fields: [
          { id: "arch", label: "Architecture", format: "choice", answer: "64-bit", options: ["32-bit", "64-bit"] },
          { id: "subsystem", label: "Subsystem", format: "choice", answer: "Console", options: ["Console", "GUI"] },
          { id: "aslr", label: "ASLR", format: "choice", answer: "No", options: ["Yes", "No"] },
          { id: "sections", label: "Number of sections", format: "int", answer: "4", placeholder: "4" },
          { id: "dll", label: "DLL that shows the message box", format: "choice", answer: "USER32.dll", options: pe.imports.map((i) => i.dll) },
          { id: "entry", label: "Entry point RVA", format: "hex", answer: hx(pe.entry), placeholder: "hex" },
        ],
      },
      hints: ["DllCharacteristics lists DYNAMIC_BASE when ASLR is on.", "vault.exe's DllCharacteristics is 0x8120: no DYNAMIC_BASE."],
    },
  ],
  tryIt: [
    "Download PE-bear (or CFF Explorer) and open vault.exe. Redo the 30-second look.",
    "Open C:\\Windows\\System32\\notepad.exe the same way. Note the GUI subsystem and the much longer import list.",
  ],
};

