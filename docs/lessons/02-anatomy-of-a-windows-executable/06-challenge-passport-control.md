# Module 2 challenge: Passport control

| | |
|---|---|
| Module | 2, Anatomy of a Windows Executable |
| Time | 15 minutes |
| Specimens | Three unknown files: traveler-a, traveler-b, traveler-c |
| Unlocks | Module 3, and the "Border Agent" badge |

## Mission

> Three executables arrive without labels. Check their passports and decide what each one is, what it does, and whether anything about it is suspicious.

## How it plays

The learner has the hex viewer, the PE viewer, and the address converter. There's no guide. Each traveler has a passport card to fill in, and three hint tokens cover the whole challenge.

Medals are awarded the same way as in Module 1.

## Specimens

All three are small programs built for pire. None of them is run.

| File | What it really is | What the learner should find |
|------|-------------------|------------------------------|
| traveler-a | A 64-bit GUI program, ASLR on | Machine 0x8664; Subsystem 2; DYNAMIC_BASE set; imports from USER32 (CreateWindowExW, MessageBoxW) and GDI32 |
| traveler-b | A 32-bit console program | Machine 0x014C; Magic 0x10B; Subsystem 3; ImageBase 0x400000 |
| traveler-c | A 64-bit console program that writes a file and a registry value | Imports CreateFileW, WriteFile, RegCreateKeyExW, RegSetValueExW; one section with an unusual name (.pire) |

## Goals

1. For each traveler, fill in the passport: architecture, console or GUI, ASLR, entry point RVA, number of sections.
2. traveler-b: convert its entry point RVA to a VA using its own ImageBase.
3. traveler-c: from the imports alone, write one sentence on what it probably does.
4. traveler-c: find the unusual section, report its file offset, and find the string stored at its start using the hex viewer.
5. Pick the one that would show a window when run.

## Hints (three tiers per goal)

| Goal | Nudge | Pointer | Answer |
|------|-------|---------|--------|
| 1 | "Use the 30-second checklist from Lesson 2.5." | "Machine, Subsystem, DllCharacteristics." | Fields highlighted in the viewer. |
| 2 | "VA = ImageBase + RVA." | "This one's ImageBase is not 0x140000000." | Worked arithmetic. |
| 3 | "Which two kinds of thing do those imports touch?" | "Files and the registry." | Sample sentence. |
| 4 | "Look at the section names." | "PointerToRawData gives the file offset." | Jump to the offset. |
| 5 | "Which one isn't a console program?" | "Subsystem 2." | traveler-a. |

## Debrief screen

- "traveler-b was 32-bit. This course covers 64-bit, but you'll meet 32-bit files in the wild. The headers work the same way with a few smaller fields."
- "traveler-c's .pire section held a plain-text string. Real malware hides strings in odd sections too. Section names and sizes are worth a glance on every new file."
- "You never ran any of these files. Everything came from reading headers. This is called static triage, and Module 4 builds on it."

## Author notes

- traveler-c writes to a harmless location (a file in %TEMP% and a key under HKCU\Software\pire). It's never run in the lesson, but keep it harmless anyway.
- The string at the start of .pire should be something like "pire-flag: border-agent".
- Create the .pire section with #pragma section and __declspec(allocate) in MSVC.
