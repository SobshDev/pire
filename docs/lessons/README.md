# pire lessons

This folder holds the design material for every pire lesson. Each lesson is written so that a developer can build it as a guided, replayed experience and a reviewer can check that it teaches one thing well.

## Who the learner is

The learner writes C and C++ comfortably. They know what registers, flags, and the stack are, and they can read simple assembly slowly. They cannot write assembly yet, have never driven a debugger at the instruction level, and have never looked inside a PE file.

## Course map (basics)

| # | Module | Specimen | Status |
|---|--------|----------|--------|
| 1 | [Debugger Basics (x64dbg)](01-debugger-basics/README.md) | vault.exe | Designed |
| 2 | [Anatomy of a Windows Executable](02-anatomy-of-a-windows-executable/README.md) | vault.exe (as a file) | Designed |
| 3 | [Functions and the x64 Calling Convention](03-functions-and-calling-convention/README.md) | calls.exe | Designed |
| 4 | Static Analysis Tools (Ghidra) | | Planned |
| 5 | Control Flow Patterns | | Planned |
| 6 | Data Patterns | | Planned |
| 7 | Talking to Windows | | Planned |
| 8 | C++ in Assembly | | Planned |
| 9 | Reading Optimized Code | | Planned |
| 10 | Putting It Together: First Crackmes | | Planned |

## Design rules

These rules apply to every lesson. When a lesson breaks one, it should say why in its author notes.

1. **One new idea per beat.** A beat is one screen state plus one learner action. If a beat needs two explanations, split it.
2. **Do before read.** The learner presses the key, clicks the register, or answers the question before the text explains what happened. Explanations confirm what the learner just saw.
3. **Predict, then reveal.** Whenever the next instruction changes something visible, ask the learner to guess first. A wrong guess is the most useful moment in the lesson, so its feedback must be specific.
4. **Same program, many angles.** Each module reuses one small program so the learner's attention goes to the new idea instead of new code. Module 2 reopens the Module 1 program as a file on disk.
5. **Short lessons.** Aim for 8 to 12 minutes and 6 to 10 beats. The learner should finish a lesson in one sitting.
6. **Always show the source.** In Modules 1 to 3 the C source is one click away. Hiding source starts in later modules, once the learner has the patterns.
7. **Leave with a real-tool task.** Every lesson ends with a short "Try it in real x64dbg" (or PE-bear) task, so the skill transfers to the learner's own machine.

## How lessons run

pire does not emulate Windows. Every lesson replays a **recording** made once on a real Windows x64 machine: the disassembly, every register value, the stack, and any memory the lesson shows. The web interface imitates x64dbg closely enough that the keys and panes match the real tool.

Because the learner cannot leave the recording, every lesson lists its **recorded runs** (for example, one run with a wrong password and one with the right one). The interface only accepts actions the lesson has a recording for. When the learner tries something else, show a friendly message that explains what would happen in the real tool, then put them back on the path.

## Lesson file format

Every lesson file uses these sections, in this order:

| Section | Purpose |
|---------|---------|
| Header table | Module, lesson number, time estimate, specimen, what it unlocks |
| Mission | One sentence the learner sees on the lesson card |
| You will be able to | Two to four concrete skills, checked by the checkpoints |
| Specimen | Source, build profile, and recorded runs needed |
| Beats | The guided walkthrough, one numbered beat at a time |
| Checkpoints | Graded questions, with the answer and the feedback for common wrong answers |
| Hints | Three tiers per checkpoint that needs them: nudge, pointer, answer |
| Watch out | Misconceptions this lesson must head off |
| Try it in real x64dbg | The transfer task for the learner's own machine |
| Author notes | Anything the builder of the lesson needs to know |

### Beat format

Each beat has four parts:

- **Show**: what is on screen and what is highlighted.
- **Say**: the short text the guide displays. Keep it to three sentences or fewer.
- **Do**: the single action that advances the lesson (the gate).
- **Then**: the feedback after the action, including what changed on screen.

### Interaction vocabulary

Use these names so the interface can build each one once.

| Interaction | What the learner does |
|-------------|-----------------------|
| Spotlight | Nothing; the interface dims everything except one area |
| Click target | Clicks a specific pane, row, register, or byte |
| Key gate | Presses a specific key (F7, F8, F2, and so on) |
| Command gate | Types a command into the x64dbg command bar |
| Predict | Types or picks a value before the next step runs |
| Choose | Picks one answer from two to four options |
| Order | Drags items into the correct sequence |
| Fill card | Fills in a small form (a "fact card") from what they found |
| Free explore | Pokes around a limited recording with a goal list to tick off |

## Build profiles

All lesson binaries are compiled with MSVC (Visual Studio 2022, x64). Early lessons need addresses that never change so the recordings match what the learner sees locally, which is why ASLR is off until Module 2 teaches it.

| Profile | Compiler flags | Linker flags | Used for |
|---------|----------------|--------------|----------|
| debug-fixed | /Od /Zi /GS- /JMC- /RTC- | /DEBUG /DYNAMICBASE:NO /INCREMENTAL:NO | Module 1 lessons 1 to 4, Module 3 lessons 1 to 3 and 5 |
| debug-fixed-stripped | /Od /GS- /JMC- /RTC- | /DYNAMICBASE:NO /INCREMENTAL:NO, no PDB shipped | Module 1 lesson 5, Module 2 |
| debug-aslr | /Od /GS- /JMC- /RTC- | /DYNAMICBASE /INCREMENTAL:NO | Module 2 lesson 2 |
| release-fixed | /O2 /Zi /GS- | /DEBUG /DYNAMICBASE:NO /INCREMENTAL:NO | Module 3 lesson 4 |

Notes on the flags:

- /JMC- and /RTC- remove Just My Code and runtime check calls, which otherwise clutter every debug function with calls a beginner cannot explain yet.
- /GS- removes stack cookies from lesson functions. The CRT still calls __security_init_cookie at startup, and Module 1 lesson 5 uses that as a landmark.
- /INCREMENTAL:NO removes the jump thunks that incremental linking puts in front of every function.
- All programs use the dynamic CRT (/MD) so the import table is short and readable in Module 2.

## About the assembly in these files

The listings in the lessons show the **expected shape** of MSVC output for these flags. Exact addresses, stack offsets, and occasionally the choice of register come from the real build. When a lesson is built, replace each listing with the recorded one and recheck every checkpoint answer that depends on an address or offset. Each lesson's author notes flag the answers that need this check.
