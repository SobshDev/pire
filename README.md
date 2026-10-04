# pire

An easy, guided way to learn reverse engineering on x64 Windows. Each lesson puts you in a recreated
debugger (x64dbg for Module 1), paused on a real program, and a guide checks every click, answer, and key press.

Lesson designs live in [docs/lessons](docs/lessons). Lesson 1.1 is playable.

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

End-to-end tests play lesson 1.1 in Chromium against a running server:

    bun run build
    (cd api && STATIC_DIR=../web/dist cargo run)
    bun run --cwd web e2e                        # set PIRE_URL to test another host

## Deploy on Dokploy

The Dockerfile builds one image that serves the API at /api and the frontend everywhere else.

1. Create a Postgres service in the Dokploy project and copy its internal connection URL.
2. Create an Application from this repository with the Dockerfile build type and port 8080.
3. Set the environment:
   - DATABASE_URL: the Postgres internal URL
   - COOKIE_SECURE: true (the default in the image; set false only for plain-HTTP testing)
4. Add your domain with HTTPS. Health checks hit /api/health.

Migrations run when the app starts, so a deploy is just a rebuild.

## Adding a lesson

1. Write or update the design doc in docs/lessons.
2. Add the snapshot to content/src/specimens and the lesson to content/src/modules, then register it in
   content/src/index.ts. The catalog marks it playable automatically.
3. Add a playthrough to web/e2e.
