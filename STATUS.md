# Status

Last updated: 2026-10-04

## Done

- Lesson designs for modules 1 to 3 in docs/lessons (Show, Say, Do, Then beats).
- api/: Rust API with accounts (argon2, cookie sessions, CSRF header), lesson progress, OpenAPI spec, migrations on start. Integration tests against Postgres.
- content/: typed lesson schema (zod), the vault.exe snapshot, lesson 1.1.
- web/: React SPA with catalog, sign in and sign up, and the lesson player (x64dbg recreation, guide panel, spotlight, drag-and-drop checkpoint, progress saving and resume).
- Lesson engine unit tests (vitest) and Playwright playthrough of lesson 1.1.
- Dockerfile for Dokploy (one container, API plus static frontend), verified end to end locally.

## In progress

- Timeline support in the engine (frames per step, registers changed by a step drawn red, console output) for lessons that run code.

## Next

- Module 1: lessons 1.2 to 1.5 and the Vault challenge.
- Module 2: PE viewer interface and lessons 2.1 to 2.5 plus challenge.
- Module 3: lessons 3.1 to 3.5 plus challenge.
- Replace hand-written snapshots with real x64dbg recordings of the specimens.

## Known limits

- Snapshots are hand-written to match the designs, not captured from a real run.
- Lessons need a screen at least 1100 px wide.
