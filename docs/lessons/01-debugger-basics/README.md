# Module 1: Debugger Basics (x64dbg)

**Goal:** the learner can open a program in x64dbg, find their way around the CPU view, control execution, stop where they want, and read the values that matter.

By the end of this module the learner should feel at home in x64dbg. They will not understand every instruction yet, and that is fine. The point is that the tool stops being scary.

## Lessons

| # | Lesson | Time | Core skill |
|---|--------|------|------------|
| 1 | [Tour of the interface](01-tour-of-the-interface.md) | 10 min | Name each pane and what it is for |
| 2 | [Controlling execution](02-controlling-execution.md) | 12 min | Step into, step over, run to cursor, and escape a function |
| 3 | [Breakpoints](03-breakpoints.md) | 12 min | Stop on an address, an API, or a write to memory |
| 4 | [Following values](04-following-values.md) | 12 min | Turn a register or pointer into the data it points at |
| 5 | [Getting to main](05-getting-to-main.md) | 12 min | Find main in a program without symbols |
| ★ | [Module challenge: The Vault](06-challenge-the-vault.md) | 15 min | Use all five skills without guidance |

## The specimen: vault.exe

Every lesson in this module uses the same small console program. It asks for a code and either opens the "vault" (a message box) or prints "Access denied."

~~~c
// vault.c
#include <stdio.h>
#include <string.h>
#include <windows.h>

static const char *SECRET = "opensesame";
int g_attempts = 0;

int check_code(const char *input)
{
    g_attempts++;
    return strcmp(input, SECRET) == 0;
}

int main(void)
{
    char buffer[32];

    puts("== PIRE VAULT ==");
    printf("Enter code: ");
    if (!fgets(buffer, sizeof buffer, stdin))
        return 1;
    buffer[strcspn(buffer, "\n")] = 0;

    if (check_code(buffer)) {
        MessageBoxA(NULL, "Vault opened!", "PIRE", MB_OK);
        return 0;
    }

    puts("Access denied.");
    return 1;
}
~~~

The program is small on purpose, but it has everything Module 1 needs:

- a library call to step over (puts) and one to fall into by accident;
- a user function to step into (check_code);
- a Windows API to break on (MessageBoxA);
- a global variable that changes (g_attempts);
- a pointer to a pointer to a string (SECRET) for following values;
- two outcomes, so the same program gives a "wrong code" run and a "right code" run.

## Builds and recordings

| Build | Profile | Used in |
|-------|---------|---------|
| vault.exe + vault.pdb | debug-fixed | Lessons 1 to 4 |
| vault.exe without PDB | debug-fixed-stripped | Lesson 5 and the challenge |

| Recording | Input | Notes |
|-----------|-------|-------|
| run-wrong | hello | Ends with "Access denied." |
| run-right | opensesame | Ends with the "Vault opened!" message box |

Each lesson lists which segments of these runs it needs.

## Keys taught in this module

| Key | Action | Lesson |
|-----|--------|--------|
| F7 | Step into | 2 |
| F8 | Step over | 2 |
| F9 | Run | 2 |
| F4 | Run to selection | 2 |
| Ctrl+F9 | Execute till return | 2 |
| F2 | Toggle breakpoint | 3 |
| Ctrl+G | Go to expression | 4 |
| * (asterisk) | Go back to RIP | 1 |
| Ctrl+F2 | Restart | 5 |

The interface shows this table as a cheat sheet that fills in as the learner earns each key.
