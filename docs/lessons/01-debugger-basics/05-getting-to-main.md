# Lesson 1.5: Getting to main

| | |
|---|---|
| Module | 1, Debugger Basics |
| Time | 12 minutes |
| Specimen | vault.exe (debug-fixed-stripped, no PDB) |
| Unlocks | Ctrl+F2, string references search, the Symbols-free view |

## Mission

> This time there are no names. x64dbg stops before your code, and main is somewhere in thousands of instructions. Find it two different ways.

## You will be able to

- Explain why x64dbg stops twice before reaching your code.
- Find main from a string the program prints.
- Find main by walking the MSVC startup code using imported function names as landmarks.
- Restart the program with Ctrl+F2.

## Specimen

vault.exe built with debug-fixed-stripped: same code, no PDB. Addresses show as vault.0000000140001234 instead of vault.main.

Recording needed: run-wrong from process start, including the system breakpoint in ntdll, the entry breakpoint, the startup code through the call to main, and the string references search result list.

## Beats

### Beat 1: The first stop

- **Show:** a freshly loaded vault.exe. The status bar says "System breakpoint reached". The address column shows ntdll.dll.
- **Say:** "Before your program runs a single line, Windows has to set it up. x64dbg pauses at the first chance it gets, inside ntdll.dll. That is not your code."
- **Do:** key gate F9.
- **Then:** the next stop: "Entry breakpoint reached". The address column shows vault.exe. "This is the program's entry point. It's in vault.exe, but it still isn't main."

### Beat 2: Where are the names?

- **Show:** the entry point listing: sub rsp, 28; call vault.0000000140001xxx; add rsp, 28; jmp vault.0000000140001yyy.
- **Say:** "Last time, x64dbg showed names like main and check_code. Those came from a PDB file the compiler writes. Real targets almost never come with one, so from now on you'll often see only addresses."
- **Do:** choose. "Why does this listing show vault.0000000140001xxx instead of a name?" Answer: "No symbols (PDB) for this build."

### Beat 3: Route A, start from a string

- **Show:** the disassembly, with a context menu hint.
- **Say:** "Here's the quick route. You know the program prints 'Enter code:'. Code that prints it must mention it. Right-click the disassembly, choose Search for, Current Module, String references."
- **Do:** guided menu: Search for > Current Module > String references.
- **Then:** the References tab lists strings, including "== PIRE VAULT ==", "Enter code: ", "Vault opened!", "Access denied.", "opensesame".

### Beat 4: Jump to the code

- **Show:** the References list, "Enter code: " row pulsing.
- **Say:** "Double-click 'Enter code: '. You'll land on the instruction that uses it."
- **Do:** double-click target.
- **Then:** the CPU tab shows the lea that loads the string. "This line is inside main. Scroll up a little to find where the function starts."

### Beat 5: Find the top of the function

- **Show:** the lines above, with the function's first instruction (sub rsp, ...) pulsing, and the int3 padding above it.
- **Say:** "Functions in MSVC builds are usually separated by runs of int3 (CC) padding. The first real instruction after the padding is the start of the function. Click it."
- **Do:** click target.
- **Then:** "This is main. Press F2 to put a breakpoint here, then F9."
- **Do:** F2, F9. Paused at main. "Route A done. Restart with Ctrl+F2 to try the other route."
- **Do:** key gate Ctrl+F2.

### Beat 6: Route B, the startup code

- **Show:** paused at the entry point again (after the system breakpoint, which the guide skips automatically).
- **Say:** "Route A needs a useful string. Sometimes there isn't one. Route B always works for MSVC programs: follow the startup code. The entry point calls a setup function, then jumps to the real startup routine. Step to the jmp and press F7 on it."
- **Do:** F8 until the jmp (or F4), then F7.
- **Then:** a long function appears. "This is the C runtime's startup routine (its real name is __scrt_common_main_seh). It's long, but you only need one call in it."

### Beat 7: Use imports as landmarks

- **Show:** the routine, with the comment column showing named calls such as _initterm, _get_initial_narrow_environment, __p___argv, __p___argc.
- **Say:** "Even without a PDB, calls into DLLs keep their names, because the program has to import them by name. main needs argc, argv, and the environment. Look for the calls that fetch them: the call right after them is main."
- **Do:** click target, the call right after __p___argc (the call to vault.0000000140001xxx).
- **Then:** "That's main. MSVC grabs the environment, argv, and argc, puts them in R8, RDX, and ECX, and calls main(argc, argv, envp)."
- Wrong click on a named import: "That one has a name, so it's a DLL function. main is ours, so it shows only as an address."

### Beat 8: Confirm

- **Show:** same.
- **Say:** "Press F4 to run to that call, then F7 to step in."
- **Do:** F4, F7.
- **Then:** RIP is at the same address you found with Route A. "Both routes lead to the same place. Write the address down; you'll see it again in Module 2."

### Beat 9: One more landmark

- **Show:** the line after call main: mov ebx, eax (or similar) followed later by a call to exit.
- **Say:** "Here's how to double-check you have the right call: right after main returns, the startup code saves EAX (main's return value) and eventually passes it to exit."
- **Do:** Continue.

## Checkpoints

1. **Order.** Drag into the order x64dbg stops or passes through them: system breakpoint (ntdll), entry point (vault.exe), startup routine, main.
2. **Choose the route.** "The program prints nothing and has no interesting strings. Which route?" Answer: Route B, walk the startup code.
3. **Spot main.** Show a short startup listing with three named import calls and one unnamed call. "Which is main?" Answer: the unnamed call right after __p___argc.

## Hints

Checkpoint 3:

1. Nudge: "main is your code, so it has no import name."
2. Pointer: "main needs argc. Look right after the call that fetches it."
3. Answer shown.

## Watch out

- **Thinking the entry point is main.** Beat 1 and Checkpoint 1 tackle this head on.
- **Expecting x64dbg's "Run to user code" (Alt+F9) to find main.** It returns to the program's own code from a DLL, which usually lands in the startup routine, not main. Mention it in a tooltip if the learner presses Alt+F9.
- **Copying the exact registers.** The startup code differs a little between Visual Studio versions. Teach the landmark (argc, argv, env fetched, then a call), not the exact instructions.

## Try it in real x64dbg

1. Load the stripped vault.exe. Note both automatic stops.
2. Find main with string references, set a breakpoint, and confirm.
3. Restart and find main through the startup code. Check the two addresses match.
4. Bonus: open any small console program you compiled yourself in Release mode without its PDB and find its main the same way.

## Author notes

- By default x64dbg pauses at the system breakpoint and at the entry breakpoint (Options > Preferences > Events). Assume the defaults.
- The MSVC x64 entry point (mainCRTStartup) is normally: sub rsp, 28h; call __security_init_cookie; add rsp, 28h; jmp __scrt_common_main_seh. Confirm against the recording.
- In __scrt_common_main_seh the call to main follows _get_initial_narrow_environment, __p___argv, and __p___argc. In the stripped build these keep their names because they are imports from the UCRT. Verify the comment column shows them in the recording.
- Beat 5 relies on int3 padding between functions, which MSVC normally emits. If the recording shows otherwise, change the advice to "the first instruction after the previous function's ret".
