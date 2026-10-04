# Module 1 challenge: The Vault

| | |
|---|---|
| Module | 1, Debugger Basics |
| Time | 15 minutes |
| Specimen | vault2.exe (debug-fixed-stripped, no PDB) |
| Unlocks | Module 2, and the "Vault Cracker" badge |

## Mission

> A new vault, a new secret, and no guide. Find main, find the check, and read the secret out of memory.

## How it plays

The guide is off. The learner has the full set of Module 1 keys and menus, a goal list, and three hint tokens for the whole challenge. Each hint token reveals the next tier of a hint for the current goal. Finishing without hints earns a gold badge; one or two hints earn silver; three earn bronze.

The learner can't see vault2.c until they finish.

## Specimen

vault2.exe is the same idea as vault.exe with three changes, so the learner can't just replay Module 1 from memory:

~~~c
// vault2.c
#include <stdio.h>
#include <string.h>
#include <windows.h>

static const char *SECRET = "pirate42";
int g_tries = 0;

static int verify(const char *input)
{
    g_tries++;
    if (g_tries > 3)
        return 0;
    return strcmp(input, SECRET) == 0;
}

int main(void)
{
    char buffer[32];

    printf("Vault v2 - code: ");
    if (!fgets(buffer, sizeof buffer, stdin))
        return 1;
    buffer[strcspn(buffer, "\n")] = 0;

    if (verify(buffer)) {
        MessageBoxA(NULL, "You're in.", "PIRE", MB_OK);
        return 0;
    }
    puts("Nope.");
    return 1;
}
~~~

Recordings: run-wrong (input letmein) and run-right (input pirate42). The recordings must support any of the routes and breakpoints taught in Module 1.

## Goals

1. **Find main.** Put a breakpoint on main's first instruction and stop there. Either route from Lesson 1.5 counts.
2. **Find the check.** Stop on the first instruction of the function that decides whether the code is right.
3. **Read the input.** In that function, show the learner's input in the dump.
4. **Read the secret.** Show the secret string in the dump, and type it into the answer box.
5. **Catch the counter.** Use a hardware write breakpoint to stop when the try counter changes, and type the counter's address.
6. **Open the vault.** Run the run-right recording to the message box, stopping on MessageBoxA first.

## Hints (three tiers per goal)

| Goal | Nudge | Pointer | Answer |
|------|-------|---------|--------|
| 1 | "No PDB. Which two routes did Lesson 1.5 teach?" | "The program prints 'Vault v2 - code: '." | Search string references, double-click, scroll up to the function start. |
| 2 | "main calls a few functions. Which one isn't a DLL import?" | "Look for the call whose result is tested right after." | The unnamed call before test eax, eax. |
| 3 | "Where does the first argument arrive?" | "Right-click RCX at the function's first line." | Follow RCX in Dump. |
| 4 | "The secret is passed to strcmp." | "Look at RDX just before the call to strcmp." | Follow RDX in Dump at the strcmp call. |
| 5 | "Find a global that changes when you guess." | "Look for an instruction in the check function that writes to a fixed address, not the stack." | Right-click the global in the dump > Breakpoint > Hardware, Write > Dword. |
| 6 | "Which API shows a message box?" | "Use the command bar." | bp MessageBoxA, then F9. |

## Debrief screen

After the last goal, show vault2.c with each goal linked to the line it touched, and three short notes:

- "The secret was stored in plain text. Real programs often hide it better, and later modules show how."
- "verify gives up after 3 tries. Did you notice g_tries > 3 in the assembly? Module 5 teaches you to read that kind of comparison."
- "verify is static, so even with a PDB it might have been inlined in a release build. Module 9 is about that."

## Author notes

- Goal 5's answer is the address of g_tries from the stripped build's recording.
- Accept goal 2 at either the call site or the first instruction of verify; the goal text asks for the first instruction, but the checker should be forgiving and nudge.
- static verify could be inlined at higher optimization levels. At /Od it isn't; keep debug-fixed-stripped.
