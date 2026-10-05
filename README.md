# pire

An easy, guided way to learn reverse engineering on x64 Windows. Each lesson puts you in a recreated
debugger (x64dbg for Module 1), paused on a real program, and a guide checks every click, answer, and key press.

Lesson designs live in [docs/lessons](docs/lessons). Modules 1 to 3 are playable, challenges included.

## Layout

| Path | What it is |
| --- | --- |
| api/ | Rust API (axum, sqlx, Postgres). Accounts, sessions, and lesson progress. Also serves the built frontend. |
| web/ | React SPA (Vite, TanStack Router and Query, Tailwind, dnd-kit, motion). The lesson player lives in web/src/player. |
| content/ | Lessons as typed data, validated with zod. Debugger snapshots are hardcoded per lesson. |
| docs/lessons/ | The lesson design docs the content is written from. |

## Develop

You need Bun, Rust, and Docker.

    bun install
    docker compose up -d db                      # Postgres on localhost:5433
    cp api/.env.example api/.env
    (cd api && cargo run)                        # API on :8080, runs migrations on start
    bun run dev                                  # Vite on :5173, proxies /api to :8080

Open http://localhost:5173.

When you change an API type, regenerate the client types:

    bun run --cwd web gen:api

## Test

    bun run test                                 # lesson engine unit tests (vitest)
    bun run typecheck
    (cd api && DATABASE_URL=postgres://pire:pire@localhost:5433/pire cargo test)

End-to-end tests play every lesson in Chromium against a running server:

    bun run build
    (cd api && STATIC_DIR=../web/dist cargo run)
    bun run --cwd web e2e                        # set PIRE_URL to test another host

## Deploy on Dokploy

The Dockerfile builds one image that serves the API at /api and the frontend everywhere else.
compose.prod.yaml runs that image next to its own Postgres.

1. Create a Docker Compose service from this repository, branch main, compose path ./compose.prod.yaml.
2. Set the environment:
   - POSTGRES_PASSWORD: a URL-safe password (letters and digits), used by both containers
   - TUTOR_BASE_URL, TUTOR_API_KEY, TUTOR_MODEL, TUTOR_MAX_TOKENS: optional, for the AI tutor
3. In Domains, add your domain for service app, port 8080, with HTTPS. Health checks hit /api/health.

Migrations run when the app starts, so a deploy is just a rebuild.

## Adding a lesson

1. Write or update the design doc in docs/lessons.
2. Add the snapshot to content/src/specimens and the lesson to content/src/modules, then register it in
   content/src/index.ts. The catalog marks it playable automatically.
3. Add a playthrough to web/e2e.
