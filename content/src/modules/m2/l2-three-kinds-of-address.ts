import { rvaToOffset, where } from "../../pe/build";
import type { LessonInput } from "../../schema";
import { vault, vaultSource } from "../../specimens/vault";
import { vaultAslrPe, vaultPe as pe } from "../../specimens/vault/file";
import { vaultSpec } from "../../specimens/vault/program";

const hx = (n: number | bigint) => n.toString(16).toUpperCase();
const base = pe.imageBase;
const rvaOf = (va: string | bigint) => Number(BigInt(typeof va === "string" ? "0x" + va : va) - base);
const sec = (name: string) => pe.sections.find((s) => s.name === name)!;
const text = sec(".text");
const rdata = sec(".rdata");
const data = sec(".data");

const mainRva = rvaOf(vault.main);
const mainOff = rvaToOffset(pe, mainRva)!;
const secretText = vaultSpec.strings.find(([, s]) => s === "opensesame")![0];
const strRva = rvaOf(secretText);
const strOff = rvaToOffset(pe, strRva)!;
const secretPtr = vaultSpec.dataInit[0]![0];
const ptrOff = rvaToOffset(pe, rvaOf(secretPtr))!;
const printfRva = rvaOf(vault.printf);
const dllChars = where(pe, "opt.DllCharacteristics");
// Recorded on a machine with ASLR on: the image base of two runs, the second after a reboot.
const RUN1 = 0x7ff6a1c40000n;
const RUN2 = 0x7ff7b3e20000n;

const table = {
  caption: "vault.exe's section table (from Lesson 2.1)",
  rows: [text, rdata, data].map((s) => ({
    label: s.name,
    bytes: "VA=" + hx(s.va) + " Raw=" + hx(s.rawPtr) + " Size=" + hx(s.rawSize),
    highlight: [],
  })),
};

/** Lesson 2.2, designed in docs/lessons/02-anatomy-of-a-windows-executable/02-three-kinds-of-address.md. */
export const threeKindsOfAddress: LessonInput = {
  id: "m2.l2",
  module: 2,
  number: "2.2",
  title: "Three kinds of address",
  mission:
    "You know where the secret string is in memory. Now find the same string in the file on disk, then explain why its memory address changes every time ASLR is on.",
  minutes: 12,
  recording: "vault-stripped.wrong",
  start: { tool: "hex", file: "vault", helper: true },
  source: vaultSource,
  locks: {},
  workbench: { tools: [], files: ["vault", "vault-aslr"] },
  steps: [
    {
      section: "beat",
      kind: "Look",
      title: "Three names for one place",
      say:
        "The same byte has three addresses. Its file offset is where it sits in the .exe on disk. Its RVA (relative virtual address) is where it sits relative to the start of the loaded image. Its VA (virtual address) is the full address in memory that x64dbg shows.",
      diagram: "rulers",
      gate: { type: "continue" },
    },
    {
      section: "beat",
      kind: "Predict",
      title: "VA and RVA",
      say:
        "Here's x64dbg paused at main in vault.exe, at VA 0x" + hx(BigInt("0x" + vault.main)) + ". ImageBase is 0x" + hx(base) + ", and VA = ImageBase + RVA. What is main's RVA?",
      setup: { tool: "x64dbg", at: vault.main, banner: "x64dbg, paused at main" },
      spotlight: "disassembly",
      gate: {
        type: "predict",
        format: "hex",
        answer: hx(mainRva),
        placeholder: "hex",
        wrong: [{ match: hx(BigInt("0x" + vault.main)), feedback: "That's the VA. Subtract ImageBase, 0x" + hx(base) + "." }],
        fallback: "RVA = VA - ImageBase = 0x" + hx(BigInt("0x" + vault.main)) + " - 0x" + hx(base) + ".",
      },
      success: "0x" + hx(mainRva) + ". The RVA is just the distance from the start of the image.",
    },
    {
      section: "beat",
      kind: "Predict",
      title: "Back to the entry point",
      say: "In Lesson 2.1 you read AddressOfEntryPoint as RVA 0x" + hx(pe.entry) + ". What VA did x64dbg show for the entry breakpoint?",
      gate: {
        type: "predict",
        format: "hex",
        answer: hx(base + BigInt(pe.entry)),
        placeholder: "hex",
        fallback: "VA = ImageBase + RVA = 0x" + hx(base) + " + 0x" + hx(pe.entry) + ".",
      },
      success: "0x" + hx(base + BigInt(pe.entry)) + ", the entry breakpoint from Lesson 1.5.",
    },
    {
      section: "beat",
      kind: "Look",
      title: "Why disk and memory differ",
      say:
        "On disk, sections are packed close together, each aligned to 0x200 bytes (FileAlignment). In memory, Windows starts each section on its own 0x1000-byte page (SectionAlignment) so it can mark code as executable and data as writable. The gaps are different, so file offsets don't match RVAs.",
      setup: { tool: "hex", banner: "Back in the hex viewer" },
      diagram: "alignment",
      gate: { type: "continue" },
    },
    {
      section: "beat",
      kind: "Choose",
      title: "Which section?",
      say: 'The string "opensesame" is at RVA 0x' + hx(strRva) + ". To find it on disk, first find the section it's in. Which section contains RVA 0x" + hx(strRva) + "?",
      figure: table,
      gate: {
        type: "choose",
        correct: "rdata",
        options: [
          { id: "text", label: ".text", feedback: ".text starts at 0x" + hx(text.va) + " and .rdata starts at 0x" + hx(rdata.va) + ". Which one is the string after?" },
          { id: "rdata", label: ".rdata" },
          { id: "data", label: ".data", feedback: ".data starts at 0x" + hx(data.va) + ", after the string." },
        ],
      },
      success: ".rdata covers RVAs 0x" + hx(rdata.va) + " up to 0x" + hx(data.va) + ". Now: offset = RVA - section VirtualAddress + section PointerToRawData.",
    },
    {
      section: "beat",
      kind: "Predict",
      title: "RVA to file offset",
      say: "offset = RVA - VirtualAddress + PointerToRawData. Using .rdata's numbers, where is RVA 0x" + hx(strRva) + " in the file?",
      figure: table,
      gate: {
        type: "predict",
        format: "hex",
        answer: hx(strOff),
        placeholder: "hex",
        wrong: [
          { match: hx(strRva), feedback: "That's the RVA. On disk the section starts somewhere else: use PointerToRawData." },
          { match: hx(strRva - text.va + text.rawPtr), feedback: "That used .text's numbers. The string is in .rdata." },
        ],
        fallback: "0x" + hx(strRva) + " - 0x" + hx(rdata.va) + " + 0x" + hx(rdata.rawPtr) + ".",
      },
      hints: ["The string is 0x" + hx(strRva - rdata.va) + " bytes into .rdata.", "On disk .rdata starts at 0x" + hx(rdata.rawPtr) + "."],
      success: "0x" + hx(strOff) + ". Let's look.",
    },
    {
      section: "beat",
      kind: "Look",
      title: "Same bytes, found on disk",
      say: 'The hex viewer jumped to 0x' + hx(strOff) + '. There\'s "opensesame", the secret you followed in Lesson 1.4, sitting in the file.',
      setup: { hexSelect: [hx(strOff), 10] },
      spotlight: "hex",
      gate: { type: "continue" },
    },
    {
      section: "beat",
      kind: "Fill",
      title: "Your turn, twice",
      say: "Convert these two, using the section table.",
      figure: table,
      gate: {
        type: "fill",
        fields: [
          { id: "main", label: "main, VA 0x" + hx(BigInt("0x" + vault.main)) + ", file offset", format: "hex", answer: hx(mainOff), placeholder: "hex" },
          { id: "data", label: "File offset 0x" + hx(data.rawPtr) + ", VA", format: "hex", answer: hx(base + BigInt(data.va)), placeholder: "hex" },
        ],
      },
      hints: [
        "VA to RVA first, then find the section.",
        "main is in .text: 0x" + hx(mainRva) + " - 0x" + hx(text.va) + " + 0x" + hx(text.rawPtr) + ". Offset 0x" + hx(data.rawPtr) + " is where .data starts on disk.",
        hx(mainOff) + " and " + hx(base + BigInt(data.va)) + ".",
      ],
      success:
        "0x" + hx(mainOff) + " and 0x" + hx(base + BigInt(data.va)) + ", the start of .data, where SECRET lives. You've earned the shortcut: the address converter on the right does this for you from now on, and you know what it's doing.",
    },
    {
      section: "beat",
      kind: "Choose",
      title: "ASLR",
      say:
        "vault-aslr.exe is the same program built with ASLR on. Windows picks a random ImageBase so attackers can't guess where code is. Here's main in two runs, the second after a reboot. What stayed the same?",
      setup: { converter: true, file: "vault-aslr" },
      figure: {
        caption: "main in vault-aslr.exe",
        rows: [
          { label: "Run 1", bytes: hx(RUN1 + BigInt(mainRva)).padStart(16, "0").slice(0, 12) + " " + hx(mainRva).padStart(4, "0"), highlight: [1] },
          { label: "After reboot", bytes: hx(RUN2 + BigInt(mainRva)).padStart(16, "0").slice(0, 12) + " " + hx(mainRva).padStart(4, "0"), highlight: [1] },
        ],
      },
      gate: {
        type: "choose",
        correct: "low",
        options: [
          { id: "low", label: "The last four hex digits" },
          { id: "high", label: "The first four hex digits", feedback: "Both start with 00007FF, but the next digits differ. Look at the end." },
          { id: "none", label: "Nothing", feedback: "Look at the end of each address." },
        ],
      },
      success:
        "Windows moves images in steps of 0x10000, so the low four digits never change. More important: the RVA, 0x" + hx(mainRva) + ", is the same in both runs. That's why reverse engineers write down RVAs, not VAs.",
    },
    {
      section: "beat",
      kind: "Choose",
      title: "How to tell if ASLR is on",
      say:
        "The DllCharacteristics field in the optional header has a flag called DYNAMIC_BASE, 0x40. If it's set, Windows randomizes the image. The field is selected in vault-aslr.exe; switch files with the tabs to compare. Which file has ASLR on?",
      setup: { hexSelect: [dllChars.at, 2] },
      reveal: ["opt.DllCharacteristics"],
      gate: {
        type: "choose",
        correct: "aslr",
        options: [
          { id: "fixed", label: "vault.exe, DllCharacteristics 0x" + hx(pe.dllChars), feedback: "0x" + hx(pe.dllChars) + " in binary doesn't have the 0x40 bit. Compare the second hex digit from the right." },
          { id: "aslr", label: "vault-aslr.exe, DllCharacteristics 0x" + hx(vaultAslrPe.dllChars) },
        ],
      },
      success: "0x" + hx(vaultAslrPe.dllChars) + " has 0x40 set; 0x" + hx(pe.dllChars) + " doesn't. Module 1 used the build with ASLR off on purpose, so the addresses in the lessons match yours.",
    },
    {
      section: "beat",
      kind: "Choose",
      title: "Relocations, using SECRET",
      say:
        "SECRET is a pointer stored in .data. In vault-aslr.exe on disk it holds 0x" + hx(secretText) + ", an address that assumes the preferred ImageBase. The 8 bytes are selected. What happens when Windows loads the image somewhere else?",
      setup: { file: "vault-aslr", hexSelect: [hx(ptrOff), 8] },
      gate: {
        type: "choose",
        correct: "fix",
        options: [
          { id: "fix", label: "The pointer would be wrong, so Windows must fix it." },
          { id: "ignore", label: "Windows ignores it.", feedback: "Then SECRET would point into nothing, and strcmp would crash." },
          { id: "crash", label: "The program crashes.", feedback: "It would, unless something fixes the pointer first. What could?" },
        ],
      },
      success:
        "In run 1 the loaded value was 0x" + hx(RUN1 + BigInt(strRva)) + ". The .reloc section lists every spot like this, and the loader adds the difference to each one. vault-aslr.exe has one entry, for SECRET. Most x64 code doesn't need relocations because it uses RIP-relative addressing, which is why .reloc is small. vault.exe has no .reloc at all, so it can only load at 0x" + hx(base) + ".",
      reveal: ["sec.reloc"],
    },
    {
      section: "checkpoint",
      kind: "Fill",
      title: "Convert",
      say: "Three quick conversions in vault.exe. The converter is right there, but try them by hand first.",
      figure: table,
      setup: { file: "vault" },
      gate: {
        type: "fill",
        fields: [
          { id: "va", label: "VA 0x" + hx(base + BigInt(printfRva)) + " to RVA", format: "hex", answer: hx(printfRva), placeholder: "hex" },
          { id: "rva", label: "RVA 0x" + hx(rdata.va + 0x1200) + " to file offset", format: "hex", answer: hx(rdata.rawPtr + 0x1200), placeholder: "hex" },
          { id: "off", label: "File offset 0x" + hx(text.rawPtr + 0x20) + " to VA", format: "hex", answer: hx(base + BigInt(text.va + 0x20)), placeholder: "hex" },
        ],
      },
      hints: [
        "Which section is the address in? Start there.",
        "offset = RVA - VirtualAddress + PointerToRawData, and VA = ImageBase + RVA.",
        hx(printfRva) + ", " + hx(rdata.rawPtr + 0x1200) + ", and " + hx(base + BigInt(text.va + 0x20)) + ".",
      ],
    },
    {
      section: "checkpoint",
      kind: "Choose",
      title: "Telling a colleague",
      say: "You found an interesting function at 0x7FF6A1C41530 in vault-aslr.exe and want to tell a colleague where it is. What do you write?",
      gate: {
        type: "choose",
        correct: "rva",
        options: [
          { id: "va", label: "0x7FF6A1C41530", feedback: "Their ASLR base will be different, so this VA means nothing on their machine." },
          { id: "rva", label: "RVA 0x1530, or vault-aslr.exe+1530" },
          { id: "off", label: "File offset 0x7FF6A1C41530", feedback: "That's a VA, and much bigger than the file." },
        ],
      },
    },
    {
      section: "checkpoint",
      kind: "Choose",
      title: "What needs a relocation?",
      say: "Which of these needs a relocation entry when the image moves?",
      gate: {
        type: "choose",
        correct: "ptr",
        options: [
          { id: "rip", label: "mov rdx, qword ptr [rip+2F35]", feedback: "RIP-relative addressing is a distance from the instruction. Move both and the distance stays the same." },
          { id: "ptr", label: "An 8-byte pointer to a string, stored in .data" },
        ],
      },
      success: "The pointer holds a full address, so it changes when the image moves. The RIP-relative instruction only holds a distance.",
    },
  ],
  tryIt: [
    "Load vault-aslr.exe in x64dbg and note main's address. Reboot (or use another machine) and compare.",
    "In x64dbg, right-click an instruction and use Copy > RVA. Compare it with what you computed.",
    "Use Ctrl+G with a module-relative expression, such as vault-aslr.exe+" + hx(mainRva) + ", to jump to an RVA.",
  ],
};
