<div align="center">

<img src="docs/assets/banner.svg" alt="pire: learn reverse engineering on x64 Windows" width="100%" />

<h3>Learn reverse engineering on x64 Windows by doing it, one guided step at a time.</h3>

<p>
  <a href="LICENSE"><img alt="Code license: MIT" src="https://img.shields.io/badge/code-MIT-ffb224?style=flat-square&labelColor=16120b" /></a>
  <a href="docs/lessons/LICENSE"><img alt="Lesson license: CC BY-SA 4.0" src="https://img.shields.io/badge/lessons-CC%20BY--SA%204.0-ffb224?style=flat-square&labelColor=16120b" /></a>
  <a href="docs/lessons/README.md"><img alt="Modules: 3 of 10 playable" src="https://img.shields.io/badge/modules-3%20of%2010%20playable-ffb224?style=flat-square&labelColor=16120b" /></a>
  <a href="CONTRIBUTING.md"><img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-ffb224?style=flat-square&labelColor=16120b" /></a>
</p>

<p>
  <img alt="Rust" src="https://img.shields.io/badge/Rust-16120b?style=flat-square&logo=rust&logoColor=ffb224" />
  <img alt="React" src="https://img.shields.io/badge/React-16120b?style=flat-square&logo=react&logoColor=ffb224" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-16120b?style=flat-square&logo=typescript&logoColor=ffb224" />
  <img alt="Bun" src="https://img.shields.io/badge/Bun-16120b?style=flat-square&logo=bun&logoColor=ffb224" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16120b?style=flat-square&logo=postgresql&logoColor=ffb224" />
  <img alt="Docker" src="https://img.shields.io/badge/Docker-16120b?style=flat-square&logo=docker&logoColor=ffb224" />
</p>

<p>
  <a href="#the-course"><b>The course</b></a> ·
  <a href="#run-it-locally"><b>Run it locally</b></a> ·
  <a href="docs/lessons"><b>Lesson designs</b></a> ·
  <a href="CONTRIBUTING.md"><b>Contribute</b></a>
</p>

<br />

<img src="docs/assets/screenshots/debugger.png" alt="Lesson 1.3: paused inside MessageBoxA in the recreated x64dbg, with the guide explaining what RDX and R8 hold" width="100%" />

<sub>Lesson 1.3, Breakpoints: the learner ran into <code>MessageBoxA</code>, and the guide points out that the message text is already in <code>RDX</code> and <code>R8</code>.</sub>

</div>

<br />

Reverse engineering is usually learned by staring at a debugger until it starts making sense. pire
shortens that. Every lesson drops you into a faithful recreation of the real tool, paused on a real
program, and a guide asks you to *do* something: press F8, click the register that changed, find the
bytes that say `MZ`. It checks every click, answer, and key press, and when you get it wrong it tells you
exactly why.

Ten minutes a lesson, nothing to install, and no account needed. When you finish, each lesson ends with
a short task to repeat on your own machine with the real tool.

## What's inside

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/assets/screenshots/hex-viewer.png" alt="Hex viewer with the section table highlighted" />
      <p><b>A hex viewer that teaches the PE format.</b> Walk <code>vault.exe</code> from <code>MZ</code> to the section table, byte by byte, with every structure you find labeled as you go.</p>
    </td>
    <td width="50%" valign="top">
      <img src="docs/assets/screenshots/pe-viewer.png" alt="PE viewer showing section headers and decoded characteristics" />
      <p><b>A PE viewer in the style of PE-bear.</b> Header tables, sections, and imports, linked back to the raw bytes they came from.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/assets/screenshots/calling-convention.png" alt="Finding stack arguments 5 and 6 before a call" />
      <p><b>The x64 calling convention, read from a live stack.</b> Find arguments in registers and on the stack, shadow space included, at the moment of the call.</p>
    </td>
    <td width="50%" valign="top">
      <img src="docs/assets/screenshots/tutor.png" alt="The AI tutor answering a question and highlighting RCX" />
      <p><b>An optional AI tutor that can see your screen.</b> Ask about the current step. It reads the debugger state, points at registers and lines, and gives hints before answers.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/assets/screenshots/challenge.png" alt="Challenge debrief with a medal and the C source" />
      <p><b>Challenges with medals.</b> Each module ends with a goal list, no source, and three hint tokens. Finish with fewer hints for gold, then read the C you were reversing.</p>
    </td>
    <td width="50%" valign="top">
      <img src="docs/assets/screenshots/catalog.png" alt="The course catalog" />
      <p><b>Play as a guest, keep it with an account.</b> Progress saves after every step, in your browser or your account, and moves over when you sign up.</p>
    </td>
  </tr>
</table>

## The course

The learner writes C comfortably and knows what registers and the stack are, but has never driven a
debugger at the instruction level. Each module reuses one small program, so attention goes to the new
idea and stays off new code.

| | Module | You'll be able to | Tool | Status |
| :-: | --- | --- | --- | --- |
| 1 | [Debugger Basics](docs/lessons/01-debugger-basics/README.md) | Open a program, control execution, set breakpoints, and read the values that matter. | x64dbg | ✅ 5 lessons + challenge |
| 2 | [Anatomy of a Windows Executable](docs/lessons/02-anatomy-of-a-windows-executable/README.md) | Read a PE file's headers, sections, and imports, and follow Windows from double-click to `main`. | Hex and PE viewer | ✅ 5 lessons + challenge |
| 3 | [Functions and the x64 Calling Convention](docs/lessons/03-functions-and-calling-convention/README.md) | Read any call site: arguments, return values, stack layout, and which registers survive. | x64dbg | ✅ 5 lessons + challenge |
| 4 | Static Analysis Tools | Find your way around a binary without running it. | Ghidra | 🛠️ Next up |
| 5 | Control Flow Patterns | Recognize `if`, loops, and `switch` in assembly. | | 📝 Planned |
| 6 | Data Patterns | Spot arrays, structs, and strings in memory. | | 📝 Planned |
| 7 | Talking to Windows | Follow a program's calls into the Windows API. | | 📝 Planned |
| 8 | C++ in Assembly | Read classes, vtables, and `this`. | | 📝 Planned |
| 9 | Reading Optimized Code | Read through inlining and `/O2` tricks. | | 📝 Planned |
| 10 | Putting It Together | Solve your first crackmes. | | 📝 Planned |

Want to write one of the planned modules? Start with [the lesson design rules](docs/lessons/README.md#design-rules)
and open an issue with the **Lesson or module idea** form.

## How it works

pire doesn't emulate Windows. Each lesson replays a **recording** of a program: its disassembly, every
register value, the stack, and the memory the lesson shows. The recordings come from annotated listings
that match what MSVC produces for these programs, and the same description also builds the PE file on
disk. That's why the hex viewer, the PE viewer, and the debugger all agree, byte for byte.

Lessons are typed data. Each one is a list of beats (*show, say, do, then*) with gates that check what
the learner did against the recording. Every claim a lesson makes is checked by a unit test, and every
lesson has a Playwright playthrough.

```mermaid
flowchart LR
  subgraph content["content/ (TypeScript)"]
    L["Lessons<br/>typed beats and gates"]
    S["Specimens<br/>listings → recordings + PE files"]
  end
  subgraph web["web/ (React)"]
    P["Lesson player<br/>x64dbg · hex · PE viewer"]
    E["Engine<br/>replays the recording, checks each step"]
  end
  subgraph api["api/ (Rust, axum)"]
    A["Accounts and progress"]
    T["AI tutor relay"]
  end
  content --> web
  P <--> E
  web -- "/api" --> api
  A --> DB[(PostgreSQL)]
  T -. optional .-> M["Messages API"]
```

| Path | What lives there |
| --- | --- |
| [`content/`](content) | Lessons as typed data (validated with zod), and the specimens that produce recordings and PE files. |
| [`web/`](web) | The React app: catalog, lesson player, tool recreations, and the lesson engine. Vite, TanStack Router and Query, Tailwind, dnd-kit, motion. |
| [`api/`](api) | The Rust API: accounts (argon2, cookie sessions), lesson progress, the tutor relay, and OpenAPI. Serves the built frontend in production. |
| [`docs/lessons/`](docs/lessons) | The design doc for every lesson. Content is written from these. |

## Run it locally

You need [Bun](https://bun.sh), [Rust](https://rustup.rs), and Docker.

```sh
bun install
docker compose up -d db          # Postgres on localhost:5433
cp api/.env.example api/.env
(cd api && cargo run)            # API on :8080, runs migrations on start
bun run dev                      # Vite on :5173, proxies /api to :8080
```

Open http://localhost:5173. The AI tutor is off unless you set `TUTOR_API_KEY` in `api/.env`.

When you change an API type, regenerate the client types with `bun run --cwd web gen:api`.

### Tests

```sh
bun run typecheck
bun run test                     # lesson engine unit tests (vitest)
(cd api && DATABASE_URL=postgres://pire:pire@localhost:5433/pire cargo test)
```

End-to-end tests play every lesson in Chromium against a running server:

```sh
bun run build
(cd api && STATIC_DIR=../web/dist cargo run)
bun run --cwd web e2e            # set PIRE_URL to test another host
```

<details>
<summary><b>Deploy with Docker Compose (Dokploy)</b></summary>

<br />

The Dockerfile builds one image that serves the API at `/api` and the frontend everywhere else, and
`docker-compose.yml` runs it next to its own Postgres.

1. Create a Docker Compose service from this repository, branch `main`, compose path `./docker-compose.yml`.
2. Set the environment:
   - `POSTGRES_PASSWORD`: a URL-safe password (letters and digits), used by both containers.
   - `TUTOR_BASE_URL`, `TUTOR_API_KEY`, `TUTOR_MODEL`, `TUTOR_MAX_TOKENS`: optional, for the AI tutor.
3. Add your domain for service `app` on port 8080, with HTTPS. Health checks hit `/api/health`.

Migrations run when the app starts, so a deploy is just a rebuild.

</details>

## Contributing

pire is built in the open, and contributions of every size help: fixing a typo in a lesson, sharpening
the feedback for a wrong answer, improving the debugger, or designing a whole module. You can also click
**Suggest a fix for this lesson** at the end of any lesson to open an issue with the lesson already
filled in.

Read [CONTRIBUTING.md](CONTRIBUTING.md) to get set up. Everyone taking part follows the
[Code of Conduct](CODE_OF_CONDUCT.md), and security issues go through [SECURITY.md](SECURITY.md).

## License

The code is under the [MIT License](LICENSE). The lesson design docs in `docs/lessons` are under
[Creative Commons Attribution-ShareAlike 4.0](docs/lessons/LICENSE).

<sub>x64dbg, PE-bear, Ghidra, Windows, and MSVC are the property of their owners. pire recreates parts of
their interfaces for teaching and isn't affiliated with or endorsed by them.</sub>
