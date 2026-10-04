# Lesson 2.4: From double-click to main

| | |
|---|---|
| Module | 2, Anatomy of a Windows Executable |
| Time | 10 minutes |
| Specimen | vault.exe (debug-fixed-stripped) in x64dbg |
| Unlocks | The Memory Map tab, the Log tab |

## Mission

> In Lesson 1.5 x64dbg stopped twice before your code ran. Now find out everything that happened in between, and see the file you dissected laid out in memory.

## You will be able to

- Put the main steps of process startup in order.
- Read x64dbg's log to see DLLs being loaded.
- Find vault.exe's sections in the Memory Map and explain their permissions.
- Name the chain of calls that leads from Windows to main.

## Specimen

vault.exe in x64dbg. Recording: process creation to the entry breakpoint, the Log tab contents, the Memory Map at the entry breakpoint, and the call stack at main.

## Beats

### Beat 1: The story so far

- **Show:** a timeline strip with two pins: "System breakpoint (ntdll)" and "Entry breakpoint (vault.exe)", and a third: "main".
- **Say:** "You've seen three stops. Let's fill in what Windows does around them."
- **Do:** Continue.

### Beat 2: The kernel maps the file

- **Show:** animation: vault.exe's sections from the file slide into a block of memory at 0x140000000, spreading out to page boundaries. ntdll.dll appears beside it.
- **Say:** "When you start a program, the Windows kernel creates a new process and maps the .exe into memory using the section table you read in Lesson 2.1. It also maps ntdll.dll into every process. Then it starts the first thread inside ntdll."
- **Do:** Continue.

### Beat 3: The loader at work (Log tab)

- **Show:** x64dbg's Log tab with lines like "Process started", "DLL Loaded: ... kernel32.dll", "DLL Loaded: ... user32.dll", "DLL Loaded: ... ucrtbase.dll", "System breakpoint reached!".
- **Say:** "Code in ntdll called the loader now runs. It reads the import table, loads each DLL the program needs (and the DLLs those need), and fills in the IAT. The log shows each DLL as it arrives."
- **Do:** click target the user32.dll line.
- **Then:** "USER32.dll was in vault.exe's import list in Lesson 2.3. Here it is being loaded."

### Beat 4: Where the system breakpoint fits

- **Show:** the "System breakpoint reached!" log line.
- **Say:** "Partway through, the loader checks whether a debugger is attached and, if so, triggers a breakpoint. That's x64dbg's first stop. It's a courtesy from Windows, not something in your program."
- **Do:** choose. "Was any of vault.exe's own code run before the system breakpoint?" Answer: no.

### Beat 5: Memory Map

- **Show:** the Memory Map tab, scrolled to vault.exe's rows: the header page, .text, .rdata, .data, .pdata, .reloc, each with an address, size, and protection.
- **Say:** "Here's the file you dissected, now in memory. Each section has its own protection. Match them up."
- **Do:** drag protections to sections: ER (execute, read) to .text; R to .rdata; RW to .data.
- **Then:** "Code can run but not be written. Read-only data can't be changed: try writing to the 'opensesame' string and the program crashes. Globals like g_attempts live in a writable section."

### Beat 6: The handover

- **Show:** the timeline with the remaining steps blank.
- **Say:** "After the loader finishes, it runs TLS callbacks if the program has any, then the thread starts in ntdll's RtlUserThreadStart, which calls kernel32's BaseThreadInitThunk, which calls vault.exe's entry point."
- **Do:** click each name as it appears on the timeline.

### Beat 7: The call stack proves it

- **Show:** paused at main (breakpoint from Lesson 1.5). The Call Stack tab.
- **Say:** "Open the Call Stack tab at main. Read it from bottom to top."
- **Do:** click target the Call Stack tab.
- **Then:** rows like ntdll.RtlUserThreadStart, kernel32.BaseThreadInitThunk, vault (startup routine), vault (main). "That's the whole chain, from Windows down to main, written in the stack as return addresses."

### Beat 8: And after main

- **Show:** timeline end.
- **Say:** "When main returns, the startup routine passes its return value to exit. The CRT cleans up and the process ends. That's why main's return value becomes the program's exit code."
- **Do:** Continue.

## Checkpoints

1. **Order.** Drag into order: kernel creates the process and maps vault.exe and ntdll; the loader loads DLLs and fills the IAT; TLS callbacks run; RtlUserThreadStart and BaseThreadInitThunk; entry point (startup routine); main; exit.
2. **Choose.** "A program crashes at startup before x64dbg reaches the entry breakpoint, with an error about a missing DLL. Which step failed?" Answer: the loader loading DLLs.
3. **Choose.** "Which section would let you change g_attempts while the program runs?" Answer: .data (RW).

## Hints

Checkpoint 1:

1. Nudge: "Nothing can be imported before the process exists."
2. Pointer: "The entry point is vault.exe's first code; main comes after the startup routine."
3. Answer shown.

## Watch out

- **Thinking the entry point is the first code that runs in the process.** ntdll, the loader, and every DLL's initialization run first. This matters later, because TLS callbacks and DLL code can do work before the entry point.
- **Mixing up the system breakpoint with a crash.** It's an intentional stop for debuggers.

## Try it in real x64dbg

1. Load vault.exe and read the Log tab up to the system breakpoint.
2. Open the Memory Map and find vault.exe's sections. Check their protections.
3. Break at main and read the Call Stack tab.
4. In Options > Preferences > Events, look at the options for system breakpoint, TLS callbacks, and entry breakpoint. Leave them on.

## Author notes

- The exact moment of the system breakpoint relative to DLL loading and DLL initialization varies between Windows versions. Keep the claims as written ("partway through") and check that the recorded log shows imported DLLs loaded before the system breakpoint. If it doesn't, adjust Beat 3's text.
- Protection strings in x64dbg's Memory Map look like ER--- and -RW--. Show them as they appear, with a tooltip for each letter.
- vault.exe has no TLS callbacks. Beat 6 mentions them as a step that exists, not one the learner will see.
