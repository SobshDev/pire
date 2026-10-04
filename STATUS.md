# Status

Last updated: 2026-10-04

## Done

- Lesson designs for modules 1 to 3 in docs/lessons (Show, Say, Do, Then beats).
- api/: Rust API with accounts (argon2, cookie sessions, CSRF header), lesson progress, OpenAPI spec, migrations on start. Integration tests against Postgres.
- content/: typed lesson schema (zod), and specimens built from annotated listings. specimens/msvc.ts builds any small MSVC console program (app code plus the C runtime startup, ucrtbase, user32 and ntdll stand-ins) and records four runs: with and without a PDB, wrong and right input.
- Specimens: vault.exe (lessons 1.1 to 1.5) and vault2.exe (the Module 1 challenge).
- Module 1 is playable end to end: lessons 1.1 to 1.5 and the challenge.
- web/: React SPA with catalog, sign in and sign up, and the lesson player (x64dbg recreation with disassembly, registers, dump, stack, info box, console, command bar, Ctrl+G, context menus, Breakpoints and References tabs, guide panel, spotlight, progress saving and resume).
- Challenge mode: goal list, three hint tokens shared across the challenge, gold/silver/bronze medal, source hidden until the end, debrief with the C source.
- Tests: engine unit tests for every Module 1 lesson (vitest, checks each claim in the text against the recording) and a Playwright playthrough per lesson.
- Dockerfile for Dokploy (one container, API plus static frontend), verified end to end locally.

## In progress

- Module 2: a PE viewer pane (headers, sections, imports) and its specimen data.

## Next

- Module 2: lessons 2.1 to 2.5 plus challenge.
- Module 3: lessons 3.1 to 3.5 plus challenge, with calling-convention specimens.
- Show challenge medals in the catalog.

## Known limits

- Recordings come from hand-written listings with semantics, not from a real x64dbg run. They match MSVC's output for these programs closely, but they are not byte-exact builds.
- Lessons need a screen at least 1100 px wide.

