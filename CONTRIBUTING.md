# Contributing to pire

Thanks for helping. pire teaches reverse engineering by putting learners in a recreated debugger, so
contributions come in two kinds and both matter: code (the player, the tools, the API) and lessons
(the design docs and the lesson content built from them).

If you're new, look for issues labeled **good first issue**. If you want to build something bigger,
open an issue first so we can agree on the approach before you spend time on it.

## Ways to help

- **Report a problem.** A bug, a confusing step, or a wrong claim in a lesson. Use the issue forms on
  GitHub, or the "Suggest a fix" link at the end of any lesson, which fills in the lesson for you.
- **Improve a lesson.** Fix wording, tighten feedback for wrong answers, or correct a technical detail.
  Lessons are written for a learner who knows C but has never used a debugger, so plain language wins.
- **Design a new lesson or module.** Modules 4 to 10 are planned in
  [docs/lessons/README.md](docs/lessons/README.md). Start with a design doc and open a pull request
  with just the doc; content and code can follow once the design is agreed.
- **Work on the code.** The player, the tool recreations, accessibility, performance, and the API.

## Set up

You need Bun, Rust, and Docker.

    bun install
    docker compose -f docker-compose.dev.yml up -d   # dev Postgres on localhost:5433
    cp api/.env.example api/.env
    (cd api && cargo run)                        # API on :8080, runs migrations on start
    bun run dev                                  # Vite on :5173, proxies /api to :8080

Open http://localhost:5173. The AI tutor is optional; leave `TUTOR_API_KEY` empty to turn it off.

## Before you open a pull request

Run the checks that cover what you touched:

    bun run typecheck
    bun run test                                 # lesson engine unit tests
    (cd api && cargo fmt --check && cargo clippy && DATABASE_URL=postgres://pire:pire@localhost:5433/pire cargo test)

If you changed a lesson or the player, run its end-to-end playthrough:

    bun run build
    (cd api && STATIC_DIR=../web/dist cargo run)
    bun run --cwd web e2e e2e/lesson-1-1.spec.ts

If you changed an API type, regenerate the client types with `bun run --cwd web gen:api` and commit
the result.

## Adding or changing a lesson

1. Write or update the design doc in [docs/lessons](docs/lessons). Follow the design rules in
   [docs/lessons/README.md](docs/lessons/README.md): one new idea per beat, do before read, predict
   then reveal, and specific feedback for wrong answers.
2. Add the specimen to `content/src/specimens` and the lesson to `content/src/modules`, then register
   it in `content/src/index.ts`.
3. Add engine unit tests that check each claim in the lesson text against the recording, and a
   Playwright playthrough in `web/e2e`.

Every value a lesson shows (addresses, register values, bytes) has to come from its recording. If a
claim in the text can't be checked by a test, say so in the pull request.

## Pull requests

- Keep each pull request to one change. A lesson fix and a refactor are two pull requests.
- Title it as a Conventional Commit, the way the history does: `fix(player): …`, `feat(content): …`,
  `docs(lessons): …`. Types are feat, fix, refactor, docs, test, chore, build, ci.
- Explain what changed for the learner, and include a screenshot for visible changes.
- A maintainer reviews every pull request. Expect questions; they're about the lesson, not about you.

## Style

- TypeScript and React follow the existing code: small components, no new dependencies without a reason
  in the pull request.
- Rust is formatted with `cargo fmt` and kept clippy clean.
- Text in the interface and lessons is short, direct, and free of jargon the learner hasn't met yet.

## Licensing of contributions

By contributing, you agree that your contributions are licensed under the same terms as the part of
the project they go into:

- Code (everything outside `docs/lessons`) is under the [MIT License](LICENSE).
- Lesson design docs in `docs/lessons` are under
  [Creative Commons Attribution-ShareAlike 4.0](docs/lessons/LICENSE).

Only contribute work you have the right to share. Don't copy text, images, or binaries from books,
courses, or other tools unless their license allows it, and say where they came from.

## Conduct

Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).
