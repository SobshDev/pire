# Module 2: Anatomy of a Windows Executable

**Goal:** the learner can open any 64-bit Windows .exe, find its headers, sections, entry point, and imports, convert between the three kinds of address, and explain what Windows does between a double-click and main.

Module 1 watched vault.exe run. Module 2 opens the same vault.exe as a file and answers questions Module 1 left hanging: why main lived at 0x1400010xx, why the secret was in ".rdata", why calls to puts looked like call qword ptr [...], and what all that ntdll code before the entry point was doing.

## Lessons

| # | Lesson | Time | Core skill |
|---|--------|------|------------|
| 1 | [PE layout](01-pe-layout.md) | 12 min | Walk from MZ to the section table by hand |
| 2 | [Three kinds of address](02-three-kinds-of-address.md) | 12 min | Convert between VA, RVA, and file offset; explain ASLR |
| 3 | [Imports and exports](03-imports-and-exports.md) | 12 min | Read the import table and explain why DLL calls go through a memory slot |
| 4 | [From double-click to main](04-from-double-click-to-main.md) | 10 min | Put the loading steps in order and see them in x64dbg |
| 5 | [Using a PE viewer](05-using-a-pe-viewer.md) | 10 min | Answer the same questions in PE-bear in seconds |
| ★ | [Module challenge: Passport control](06-challenge-passport-control.md) | 15 min | Triage three unknown executables from their headers |

## The specimens

| File | Profile | Used in |
|------|---------|---------|
| vault.exe (no PDB) | debug-fixed-stripped | Lessons 1 to 5 |
| vault-aslr.exe | debug-aslr | Lesson 2 |
| user32.dll export view | from a real Windows 11 system | Lesson 3 |
| Three challenge files | see the challenge | Challenge |

The source is vault.c from Module 1, unchanged.

## The hex viewer

Lessons 1 to 3 use a pire hex viewer, not x64dbg. It works like HxD: offsets on the left, 16 bytes per row, ASCII on the right. It adds three teaching features:

- **Structure overlay:** colored brackets over bytes that belong to a known field, revealed as the learner finds each one.
- **Jump to offset:** Ctrl+G, same key as in x64dbg on purpose.
- **Little-endian helper:** select 2, 4, or 8 bytes and a tooltip shows the value. The helper is locked in Lesson 1 beats 3 and 4, so the learner does the flip once by hand first.

## Recordings needed

- The raw bytes of every specimen file.
- For Lesson 2: vault-aslr.exe loaded twice with different image bases (the memory map, and the address of main in each).
- For Lesson 3: the IAT bytes of vault.exe on disk and in memory after loading.
- For Lesson 4: x64dbg's log from process start to the entry breakpoint, and the Memory Map tab at the entry breakpoint.

## Field reference used in this module

Offsets are from the start of each structure. Only the fields the lessons use are listed.

| Structure | Field | Offset | Size | vault.exe value |
|-----------|-------|--------|------|-----------------|
| DOS header | e_magic | 0x00 | 2 | "MZ" |
| DOS header | e_lfanew | 0x3C | 4 | from build |
| NT headers | Signature | 0x00 | 4 | "PE\0\0" |
| File header | Machine | 0x04 | 2 | 0x8664 (x64) |
| File header | NumberOfSections | 0x06 | 2 | from build |
| File header | SizeOfOptionalHeader | 0x14 | 2 | 0xF0 |
| Optional header | Magic | 0x18 | 2 | 0x20B (PE32+) |
| Optional header | AddressOfEntryPoint | 0x28 | 4 | from build |
| Optional header | ImageBase | 0x30 | 8 | 0x140000000 |
| Optional header | SectionAlignment | 0x38 | 4 | 0x1000 |
| Optional header | FileAlignment | 0x3C | 4 | 0x200 |
| Optional header | Subsystem | 0x5C | 2 | 3 (console) |
| Optional header | DllCharacteristics | 0x5E | 2 | from build |
| Optional header | DataDirectory[16] | 0x88 | 16 x 8 | |
| Section header | Name, VirtualSize, VirtualAddress, SizeOfRawData, PointerToRawData | 0x00, 0x08, 0x0C, 0x10, 0x14 | 8, 4, 4, 4, 4 | from build |

NT header offsets above are counted from the "PE" signature. Each section header is 40 (0x28) bytes. Data directory index 0 is exports, 1 is imports, 5 is base relocations, and 12 is the IAT.
