# Lesson 2.5: Using a PE viewer

| | |
|---|---|
| Module | 2, Anatomy of a Windows Executable |
| Time | 10 minutes |
| Specimen | vault.exe (debug-fixed-stripped) in a PE-bear style viewer |
| Unlocks | The PE viewer for the rest of the course |

## Mission

> You've done it all by hand. Now do it in seconds with the tool professionals use, and check that the tool agrees with you.

## You will be able to

- Find the headers, sections, imports, and entry point in a PE viewer.
- Check a viewer's answers against what you worked out by hand.
- Use a viewer for a 30-second first look at any executable.

## Specimen

vault.exe in a pire viewer modeled on PE-bear: a tree of headers on the left, a details table on the right, and a hex view at the bottom that highlights the bytes of whatever field is selected.

## Beats

### Beat 1: Your notes vs. the tool

- **Show:** the learner's vault.exe passport from Lesson 2.1 pinned to the side of the screen.
- **Say:** "Every number in your passport, you found by reading bytes. A PE viewer reads the same bytes for you. Let's check your work."
- **Do:** Continue.

### Beat 2: DOS header

- **Show:** the tree on the left. DOS Hdr pulsing.
- **Say:** "Click DOS Hdr. Find e_lfanew. Does it match your Lesson 2.1 answer?"
- **Do:** click target, then click e_lfanew's row.
- **Then:** the hex view highlights the 4 bytes at 0x3C. The passport field gets a green tick.

### Beat 3: File header and optional header

- **Show:** File Hdr and Optional Hdr in the tree.
- **Say:** "Check Machine, NumberOfSections, Magic, AddressOfEntryPoint, and ImageBase."
- **Do:** click each field. Each one ticks a passport field and highlights its bytes.
- **Then:** "The tool shows 'Entry point' as an RVA too. You knew that."

### Beat 4: Subsystem

- **Show:** the Subsystem field: Windows Console (3).
- **Say:** "Here's a field you haven't seen. Subsystem says whether Windows should give the program a console window. 3 means console, 2 means a GUI program."
- **Do:** choose. "Should a GUI app like Notepad say 2 or 3?" Answer: 2.

### Beat 5: Section headers

- **Show:** Section Hdrs: a table with Name, Raw Addr., Raw Size, Virtual Addr., Virtual Size, Characteristics.
- **Say:** "This table is everything you need for Lesson 2.2's conversions. Look at Characteristics for .text."
- **Do:** click target .text's Characteristics.
- **Then:** decoded flags: code, execute, read. "These flags are where the Memory Map's protections came from."

### Beat 6: Imports

- **Show:** Imports tab.
- **Say:** "Find MessageBoxA. Check the 'Thunk' or IAT column against the slot you looked at in Lesson 2.3."
- **Do:** click target USER32.dll, then MessageBoxA.

### Beat 7: The 30-second look

- **Show:** a checklist card.
- **Say:** "From now on, every time you meet a new executable, do this first. It takes 30 seconds."
- **Do:** tick each item while finding it in the viewer:
  - 32-bit or 64-bit (Machine)
  - console or GUI (Subsystem)
  - ASLR or not (DllCharacteristics)
  - sections, and anything odd about their names or sizes
  - imported DLLs and the most telling functions
  - entry point RVA
- **Then:** "You'll use this checklist in the module challenge."

## Checkpoints

1. **Spot the mismatch.** The passport has one deliberately wrong value planted (for example the wrong NumberOfSections). "One of these doesn't match the file. Which?" The learner finds it in the viewer.
2. **Fill card.** The 30-second look for vault.exe.

## Watch out

- **Trusting the viewer blindly.** Viewers can be fooled by malformed files. That's why this lesson comes after reading by hand.
- **Getting lost in every field.** The optional header has dozens of fields. The checklist names the ones that matter for now.

## Try it yourself

1. Download PE-bear (or CFF Explorer).
2. Open vault.exe and redo the 30-second look.
3. Open C:\Windows\System32\notepad.exe and do the same. Note the GUI subsystem and the much longer import list.

## Author notes

- PE-bear's tab names include DOS Hdr, File Hdr, Optional Hdr, Section Hdrs, and Imports. Match these names so the transfer is direct.
- Checkpoint 1's planted error should be one the learner computed in Lesson 2.1.
