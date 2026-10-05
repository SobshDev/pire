import type { LessonInput, SourceFile } from "../../schema";
import { travelerA, travelerB, travelerC } from "../../specimens/files";

const hx = (n: number | bigint) => n.toString(16).toUpperCase();
const A = travelerA();
const B = travelerB();
const C = travelerC();
const pire = C.sections.find((s) => s.name === ".pire")!;
const FLAG = "pire-flag: border-agent";

const travelerCSource: SourceFile = {
  name: "traveler-c.c",
  code: [
    "#include <windows.h>",
    "#include <stdio.h>",
    "",
    "#pragma section(\".pire\", read)",
    "__declspec(allocate(\".pire\")) const char flag[] = \"" + FLAG + "\";",
    "",
    "int main(void) {",
    "    wchar_t path[MAX_PATH];",
    "    GetTempPathW(MAX_PATH, path);",
    "    lstrcatW(path, L\"pire.txt\");",
    "    HANDLE f = CreateFileW(path, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, 0, NULL);",
    "    DWORD written;",
    "    WriteFile(f, \"hello\", 5, &written, NULL);",
    "    CloseHandle(f);",
    "",
    "    HKEY key;",
    "    RegCreateKeyExW(HKEY_CURRENT_USER, L\"Software\\\\pire\", 0, NULL, 0, KEY_WRITE, NULL, &key, NULL);",
    "    RegSetValueExW(key, L\"visited\", 0, REG_SZ, (const BYTE *)L\"yes\", 8);",
    "    RegCloseKey(key);",
    "",
    "    puts(\"traveler-c was here\");",
    "    return 0;",
    "}",
  ].join("\n"),
  regions: { flag: [4, 5], main: [7, 23] },
};

const passport = (entry: string, sections: number, arch: string, subsystem: string, aslr: string) => ({
  type: "fill" as const,
  fields: [
    { id: "arch", label: "Architecture", format: "choice" as const, answer: arch, options: ["32-bit", "64-bit"] },
    { id: "subsystem", label: "Subsystem", format: "choice" as const, answer: subsystem, options: ["Console", "GUI"] },
    { id: "aslr", label: "ASLR", format: "choice" as const, answer: aslr, options: ["Yes", "No"] },
    { id: "entry", label: "Entry point RVA", format: "hex" as const, answer: entry, placeholder: "hex" },
    { id: "sections", label: "Number of sections", format: "int" as const, answer: String(sections) },
  ],
});
const passportHints = (file: string, answer: string) => [
  "Use the 30-second look from Lesson 2.5. Open " + file + " with the file tabs at the top.",
  "Machine in File Hdr; Subsystem, AddressOfEntryPoint, and DllCharacteristics (look for DYNAMIC_BASE) in Optional Hdr; count the rows in Section Hdrs.",
  answer,
];

/** The Module 2 challenge, designed in docs/lessons/02-anatomy-of-a-windows-executable/06-challenge-passport-control.md. */
export const passportControl: LessonInput = {
  id: "m2.challenge",
  module: 2,
  number: "★",
  title: "Challenge: Passport control",
  mission:
    "Three executables arrive without labels. Check their passports and decide what each one is, what it does, and whether anything about it looks suspicious. None of them will be run.",
  minutes: 15,
  recording: "vault-stripped.wrong",
  start: { tool: "pe", file: "traveler-a", peNode: "file", helper: true, converter: true },
  workbench: { tools: ["pe", "hex"], files: ["traveler-a", "traveler-b", "traveler-c"] },
  source: travelerCSource,
  locks: {},
  challenge: true,
  hintTokens: 3,
  steps: [
    {
      section: "beat",
      kind: "Goal",
      title: "Passport: traveler-a",
      say: "Fill in traveler-a's passport.",
      free: true,
      gate: passport(hx(A.entry), A.sections.length, "64-bit", "GUI", "Yes"),
      hints: passportHints("traveler-a", "64-bit (0x8664), GUI (Subsystem 2), ASLR yes (DYNAMIC_BASE), entry point 0x" + hx(A.entry) + ", " + A.sections.length + " sections."),
      success: "traveler-a checked.",
    },
    {
      section: "beat",
      kind: "Goal",
      title: "Passport: traveler-b",
      say: "Fill in traveler-b's passport.",
      free: true,
      gate: passport(hx(B.entry), B.sections.length, "32-bit", "Console", "No"),
      hints: passportHints("traveler-b", "32-bit (Machine 0x14C, Magic 0x10B), console (Subsystem 3), ASLR no (no DYNAMIC_BASE), entry point 0x" + hx(B.entry) + ", " + B.sections.length + " sections."),
      success: "traveler-b checked. Its Magic is 0x10B: a PE32 file, with a smaller optional header than the 64-bit ones.",
    },
    {
      section: "beat",
      kind: "Goal",
      title: "Passport: traveler-c",
      say: "Fill in traveler-c's passport.",
      free: true,
      gate: passport(hx(C.entry), C.sections.length, "64-bit", "Console", "Yes"),
      hints: passportHints("traveler-c", "64-bit (0x8664), console (Subsystem 3), ASLR yes (DYNAMIC_BASE), entry point 0x" + hx(C.entry) + ", " + C.sections.length + " sections."),
      success: "traveler-c checked. Did any of its section names look odd?",
    },
    {
      section: "beat",
      kind: "Answer",
      title: "traveler-b's entry point",
      say: "Where in memory would traveler-b's entry point be, if it loads at its preferred ImageBase? Give the VA.",
      free: true,
      gate: {
        type: "predict",
        format: "hex",
        answer: hx(B.imageBase + BigInt(B.entry)),
        placeholder: "VA in hex",
        wrong: [{ match: hx(0x140000000n + BigInt(B.entry)), feedback: "That uses the 64-bit ImageBase. Check traveler-b's own ImageBase." }],
        fallback: "VA = ImageBase + RVA, using traveler-b's ImageBase.",
      },
      hints: ["VA = ImageBase + RVA.", "This one's ImageBase is not 0x140000000. Look in its Optional Hdr.", "0x" + hx(B.imageBase) + " + 0x" + hx(B.entry) + " = 0x" + hx(B.imageBase + BigInt(B.entry)) + "."],
      success: "0x" + hx(B.imageBase + BigInt(B.entry)) + ". 0x400000 is the classic ImageBase for 32-bit programs.",
    },
    {
      section: "beat",
      kind: "Choose",
      title: "What does traveler-c do?",
      say: "From traveler-c's imports alone, what does it probably do?",
      free: true,
      gate: {
        type: "choose",
        correct: "files",
        options: [
          { id: "window", label: "Shows a window and draws text in it", feedback: "That would need USER32 and GDI32. Look at which DLLs traveler-c imports." },
          { id: "files", label: "Writes a file in the temp folder and a value in the registry" },
          { id: "network", label: "Downloads something from the internet", feedback: "There are no networking imports (WinHTTP, WinINet, or ws2_32). Look again." },
        ],
      },
      hints: [
        "Which two kinds of thing do those imports touch?",
        "CreateFileW and WriteFile are files; RegCreateKeyExW and RegSetValueExW are the registry.",
        "GetTempPathW, CreateFileW, WriteFile: a file in the temp folder. RegCreateKeyExW, RegSetValueExW: a registry value.",
      ],
      success: "Files and the registry, and you didn't run a thing. Imports are the fastest clue to what a program does.",
    },
    {
      section: "beat",
      kind: "Goal",
      title: "The odd section",
      say: "traveler-c has a section no compiler makes by default. Give its file offset, then open the hex viewer, go there, and read the string stored at its start.",
      free: true,
      gate: {
        type: "fill",
        fields: [
          { id: "offset", label: "File offset of the section", format: "hex", answer: hx(pire.rawPtr), placeholder: "hex" },
          { id: "flag", label: "String at its start", format: "text", answer: FLAG, placeholder: "text" },
        ],
      },
      hints: [
        "Look at the section names.",
        ".pire. Its Raw Addr. (PointerToRawData) is the file offset.",
        "0x" + hx(pire.rawPtr) + ". Switch to the hex viewer, press Ctrl+G, type " + hx(pire.rawPtr) + ", and read the ASCII column.",
      ],
      success: '"' + FLAG + '". Hidden in plain sight, in a section of its own.',
    },
    {
      section: "beat",
      kind: "Choose",
      title: "Which one shows a window?",
      say: "Only one of the three would open a window when run. Which?",
      free: true,
      gate: {
        type: "choose",
        correct: "a",
        options: [
          { id: "a", label: "traveler-a" },
          { id: "b", label: "traveler-b", feedback: "traveler-b is a console program: Subsystem 3." },
          { id: "c", label: "traveler-c", feedback: "traveler-c is a console program with no USER32 imports." },
        ],
      },
      hints: ["Which one isn't a console program?", "Subsystem 2.", "traveler-a: Subsystem 2 (GUI), and it imports CreateWindowExW."],
      success: "traveler-a: GUI subsystem, and CreateWindowExW, ShowWindow, and a message loop in its imports.",
    },
  ],
  debrief: [
    "traveler-b was 32-bit. This course covers 64-bit, but you'll meet 32-bit files in the wild. The headers work the same way, with a few smaller fields.",
    "traveler-c's .pire section held a plain-text string. Real malware hides strings in odd sections too, so section names and sizes are worth a glance on every new file.",
    "You never ran any of these files. Everything came from reading headers. This is called static triage, and Module 4 builds on it.",
  ],
  tryIt: [
    "Build traveler-c.c (shown above) with cl, open it in PE-bear, and find .pire in Section Hdrs.",
    "Pick three programs from C:\\Windows\\System32 and do the 30-second look on each. Which ones are GUI programs?",
  ],
};
