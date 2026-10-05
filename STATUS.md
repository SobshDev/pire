# Status

Last updated: 2026-10-04

## Done

- Lesson designs for modules 1 to 3 in docs/lessons (Show, Say, Do, Then beats).
- api/: Rust API with accounts (argon2, cookie sessions, CSRF header), lesson progress, OpenAPI spec, migrations on start. Integration tests against Postgres.
- content/: typed lesson schema (zod), and specimens built from annotated listings. specimens/msvc.ts builds any small MSVC console program (app code plus the C runtime startup, ucrtbase, user32 and ntdll stand-ins) and records its run with and without a PDB. The same spec also produces the PE file on disk (headers, sections, imports, .pdata, optional ASLR relocations), so the hex and PE viewers show the bytes the debugger runs.
- The machine models general registers, flags, memory, and XMM0 to XMM5 (float and double lanes).
- Specimens:
  - vault.exe (lessons 1.1 to 1.5, Module 2) and vault2.exe (the Module 1 challenge)
  - traveler-a/b/c and user32 (the Module 2 PE files)
  - calls.exe, /Od, and calls-release.exe, /O2 (lessons 3.1 to 3.5)
  - calls2.exe (the Module 3 challenge)
- Modules 1, 2 and 3 are playable end to end: every lesson and all three challenges.
- web/: React SPA with catalog, sign in and sign up, and three tools.
  - x64dbg recreation: disassembly, registers with an XMM view, dump, stack, info box, console, command bar, Ctrl+G, context menus, Breakpoints, References and Call Stack tabs.
  - Hex viewer and PE viewer (PE-bear style tree, header tables, sections, imports).
  - Guide panel: spotlight, pulses, fill cards, stack frame figures, and progress saving and resume.
- Challenge mode: goal list, three hint tokens shared across the challenge, gold/silver/bronze medal, source hidden until the end, debrief with the C source. The catalog shows the best medal earned.
- Tests: engine unit tests for every lesson (vitest, checks each claim in the text against the recording) and a Playwright playthrough per lesson and challenge.
- Dockerfile for Dokploy (one container, API plus static frontend), verified end to end locally.

## Next

- Design Module 4 (static analysis with Ghidra) and the tool recreation it needs.
- A "rules card" that collects the calling-convention rules from Module 3 lessons, as the designs describe.

## Known limits

- Recordings come from hand-written listings with semantics, not from a real x64dbg run. They match MSVC's output for these programs closely, but they are not byte-exact builds.
- Recordings are linear: setup jumps to the first visit of an address, and later visits are reached with keys such as Ctrl+F9.
- Lessons need a screen at least 1100 px wide.
