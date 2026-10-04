# Lesson 2.3: Imports and exports

| | |
|---|---|
| Module | 2, Anatomy of a Windows Executable |
| Time | 12 minutes |
| Specimen | vault.exe (debug-fixed-stripped), user32.dll export view |
| Unlocks | The Imports view |

## Mission

> vault.exe calls puts and MessageBoxA, but their code isn't in vault.exe. Find out how the program reaches them, and why their names survived when main's didn't.

## You will be able to

- Read an import table: which DLLs, which functions.
- Explain the Import Address Table (IAT) and what the loader writes into it.
- Explain why calls to DLL functions look like call qword ptr [...].
- Find a function in a DLL's export table.

## Specimen

vault.exe on disk and in memory, plus the export table of user32.dll from a Windows 11 machine.

Recording needed: the IAT slot for puts on disk (in the hex viewer) and in memory at the entry breakpoint (in x64dbg's dump).

## Beats

### Beat 1: The puzzle

- **Show:** a Module 1 flashback. x64dbg shows call qword ptr ds:[<&puts>] in main.
- **Say:** "In Module 1, calls to your functions looked like call vault.0000000140001xxx. Calls to puts looked different: call qword ptr ds:[...], with brackets. What do the brackets mean?"
- **Do:** choose. "Call the address stored at that memory location" (correct), "Call that address directly", "It's a comment".
- **Then:** "Right: brackets mean 'read memory'. The CPU reads an 8-byte address from that slot and calls it. That slot is in the IAT."

### Beat 2: Which DLLs?

- **Show:** the Imports view (a pire table built from the import directory): one row per DLL.
- **Say:** "Data directory 1 points to the import table. It lists every DLL the program needs. Read the list."
- **Do:** click target each DLL row: KERNEL32.dll, USER32.dll, VCRUNTIME140.dll, and several api-ms-win-crt-*.dll entries.
- **Then:** for USER32.dll show MessageBoxA. For the api-ms-win-crt-stdio entry show puts, fgets, and __stdio_common_vfprintf. "api-ms-win-crt-*.dll names are 'API sets'. Windows redirects them to ucrtbase.dll. That's why you landed in ucrtbase in Lesson 1.2."

### Beat 3: Where's printf?

- **Show:** the stdio import list.
- **Say:** "The source calls printf, but printf isn't in the list. Why not?"
- **Do:** choose. "printf is defined in a header and calls __stdio_common_vfprintf" (correct), "printf was optimized away", "printf is in KERNEL32".
- **Then:** "Modern MSVC's printf is a small inline wrapper. The real work is in __stdio_common_vfprintf. When you hunt for printf in a binary, look for that name."

### Beat 4: The IAT slot on disk

- **Show:** the hex viewer at the IAT slot for puts. 8 bytes holding a small number.
- **Say:** "This is puts's IAT slot in the file. Select the 8 bytes. Is that an address you could call?"
- **Do:** select; the helper shows a value like 0x3A5C.
- **Then:** the viewer follows that RVA to a short record: 2 bytes (the hint) and then the text puts. "On disk, the slot just points to the function's name. It's a note that says 'please fill in puts here'."

### Beat 5: The IAT slot in memory

- **Show:** x64dbg dump at the same slot, at the entry breakpoint.
- **Say:** "Now the same slot after Windows loaded the program. Predict: what kind of value is in it now?"
- **Do:** choose. "The address of puts inside ucrtbase.dll" (correct), "The same small number", "Zero".
- **Then:** the dump shows a 0x7FF... address with comment ucrtbase.puts. "The loader looked up puts in ucrtbase.dll and wrote its real address into the slot. Every call to puts reads this slot."

### Beat 6: Why the names survived

- **Show:** Lesson 1.5's startup code with named imports and the unnamed call to main.
- **Say:** "In Lesson 1.5, imports kept their names but main didn't. Why?"
- **Do:** choose. "The loader needs import names to find the functions, so they must stay in the file" (correct), "x64dbg guessed them", "Stripping only removes main".
- **Then:** "Imports are your best landmarks in a stripped binary. A program that imports CreateFileW and WriteFile writes files; one that imports MessageBoxA shows boxes. You'll use this constantly."

### Beat 7: Exports

- **Show:** user32.dll's export view: a long alphabetical list of names with RVAs and ordinals. Search box focused.
- **Say:** "The other side of an import is an export. user32.dll publishes a list of functions it offers. Find MessageBoxA."
- **Do:** type in search, click target MessageBoxA.
- **Then:** "The loader matched vault.exe's 'please fill in MessageBoxA' with this entry, added user32's base address to the RVA, and wrote the result into vault.exe's IAT."

### Beat 8: Does vault.exe export anything?

- **Show:** vault.exe's data directory 0 (exports): size 0.
- **Say:** "Executables usually export nothing; DLLs exist to export. vault.exe's export directory is empty."
- **Do:** Continue.

## Checkpoints

1. **Fill card.** "vault.exe imports MessageBoxA from ______ and puts from ______ (which really lives in ______)." Answers: USER32.dll, an api-ms-win-crt-stdio DLL, ucrtbase.dll.
2. **Order.** Drag the steps for a call to MessageBoxA: the loader reads the import name; the loader finds MessageBoxA in user32's exports; the loader writes the address into the IAT slot; main runs call qword ptr [slot]; the CPU jumps into user32.
3. **Guess the behavior.** Show a mystery import list: CreateFileW, WriteFile, CloseHandle, GetTempPathW. "What does this program probably do?" Answer: writes a file in the temp folder.

## Hints

Checkpoint 2:

1. Nudge: "Nothing can be called until its address is known."
2. Pointer: "Loading happens before main runs."
3. Answer shown.

## Watch out

- **Thinking DLL code is copied into the .exe.** It isn't. The .exe holds only names and empty slots.
- **Reading the on-disk IAT and expecting addresses.** On disk, the slots usually hold name references. The real addresses only exist in memory.
- **Taking imports as proof.** Imports show what a program can call, not what it does. Programs can also find functions at runtime with GetProcAddress (Module 7).

## Try it in real x64dbg

1. Load vault.exe and open the Symbols tab. Click vault.exe and look at its imports. Click user32.dll and search its exports for MessageBoxA.
2. In main, select call qword ptr ds:[<&puts>], right-click the operand and follow the memory operand in the dump. Check the 8 bytes match ucrtbase's puts.

## Author notes

- The exact list of api-ms-win-crt-* DLLs depends on the CRT functions used. Take it from the build.
- MSVC normally places the IAT at the start of .rdata. Take the slot's RVA from the import directory of the real build.
- The hint value in the IMAGE_IMPORT_BY_NAME record is not explained. If a learner clicks it, show: "A hint the loader uses to search the export list faster."
