# Lesson 2.1: PE layout

| | |
|---|---|
| Module | 2, Anatomy of a Windows Executable |
| Time | 12 minutes |
| Specimen | vault.exe (debug-fixed-stripped) in the pire hex viewer |
| Unlocks | The structure overlay, the little-endian helper |

## Mission

> vault.exe is just bytes on disk. Starting from byte zero, follow the signposts to find what kind of program it is, where its code starts, and how it is split into sections.

## You will be able to

- Recognize MZ and PE signatures and explain what each one starts.
- Follow e_lfanew from the DOS header to the PE header.
- Read the machine type and tell 64-bit from 32-bit files.
- Find the entry point and the section table, and name the usual sections.

## Specimen

vault.exe from Module 1 (stripped build), shown in the hex viewer. The overlay starts empty and fills in as the learner finds each structure.

## Beats

### Beat 1: Just bytes

- **Show:** the hex viewer at offset 0. A file icon labelled vault.exe sits next to it, with "size: N bytes".
- **Say:** "This is the same vault.exe you debugged in Module 1, as it sits on disk. Windows reads these bytes to build the running program. Your job is to read them the way Windows does."
- **Do:** Continue.

### Beat 2: MZ

- **Show:** first row. The ASCII column starts with MZ.
- **Say:** "Every Windows executable starts with the two letters MZ. Click them."
- **Do:** click target bytes 4D 5A.
- **Then:** overlay bracket "DOS header (64 bytes)" appears over offsets 0x00 to 0x3F. "MZ marks the old DOS header, kept for backwards compatibility. Almost everything in it is ignored today, except one field."
- Side note card: "MZ stands for Mark Zbikowski, one of the engineers who designed the format."

### Beat 3: The signpost at 0x3C

- **Show:** offset 0x3C pulsing (4 bytes). Little-endian helper locked.
- **Say:** "At offset 0x3C the DOS header holds e_lfanew: the offset of the real header. It's a 4-byte little-endian number, like g_attempts in Lesson 1.4. What offset does it point to?"
- **Do:** predict a hex value.
- **Then:** overlay labels the 4 bytes e_lfanew. "Correct. Now jump there with Ctrl+G."
- Wrong answer read left to right: "Remember to flip the bytes."

### Beat 4: The stuff in between

- **Show:** the region between 0x40 and e_lfanew, with "This program cannot be run in DOS mode." visible in the ASCII column.
- **Say:** "Between the DOS header and the real header is a tiny DOS program that prints this message if you run the file on DOS, plus a block Microsoft's linker adds called the Rich header. Neither matters for us yet."
- **Do:** key gate Ctrl+G, type the e_lfanew value.

### Beat 5: PE

- **Show:** the viewer at e_lfanew. The bytes 50 45 00 00 ("PE\0\0") pulsing.
- **Say:** "PE, followed by two zero bytes. This is the start of the NT headers, the part Windows actually uses."
- **Do:** click target.
- **Then:** little-endian helper unlocks. "You've flipped bytes by hand twice. From now on, select bytes and the helper does it."

### Beat 6: What machine?

- **Show:** the 2 bytes after the signature (64 86) pulsing.
- **Say:** "The next 2 bytes say which CPU this file is for. Select them."
- **Do:** select the bytes; the helper shows 0x8664.
- **Choose:** "0x8664 means..." Options: x64, 32-bit x86, ARM64. Answer: x64. "A 32-bit program would say 0x014C here. Checking this field is the first thing you do with a new file."

### Beat 7: Number of sections

- **Show:** the next 2 bytes.
- **Say:** "Next is NumberOfSections. How many sections does vault.exe have?"
- **Do:** predict.
- **Then:** "Keep that number. You'll count them in a moment."

### Beat 8: The optional header (not optional)

- **Show:** overlay bracket over the File header (20 bytes) and the start of the optional header. Magic (0B 02) pulsing.
- **Say:** "After the 20-byte file header comes the 'optional' header. It isn't optional for executables. Its first field, Magic, is 0x20B for 64-bit files (PE32+) and 0x10B for 32-bit ones."
- **Do:** select Magic; confirm 0x20B.

### Beat 9: The entry point

- **Show:** AddressOfEntryPoint pulsing (optional header + 0x10).
- **Say:** "This field is where Windows starts running the program. In Lesson 1.5 x64dbg stopped at 'Entry breakpoint'. Read the value."
- **Do:** select bytes; the helper shows a small number like 0x1xxx.
- **Choose:** "The entry breakpoint in Module 1 was at 0x14000xxxx, but this says 0x1xxx. Why?" Options:
  - A. "The field is an offset from where the program is loaded." (correct)
  - B. "x64dbg was wrong."
  - C. "The file is compressed."
- **Then:** "Right. Add ImageBase, which is 0x140000000 for vault.exe, and you get the address you saw. Lesson 2.2 is all about this."

### Beat 10: The section table

- **Show:** the viewer scrolled to after the optional header. Section names in the ASCII column: .text, .rdata, .data, .pdata, .reloc (whatever the build has).
- **Say:** "Right after the optional header is the section table, one 40-byte entry per section. Each one starts with an 8-byte name. Click each name."
- **Do:** click target each name; the count must match the number from Beat 7.
- **Then:** a card for each section:
  - **.text**: the code. main and check_code live here.
  - **.rdata**: read-only data. The "opensesame" string and the import table live here.
  - **.data**: read-write data. g_attempts and the SECRET pointer live here.
  - **.pdata**: tables Windows uses to unwind the stack for exceptions on x64.
  - **.reloc**: fix-ups used if the file isn't loaded at its preferred address (Lesson 2.2).

### Beat 11: Connect it back

- **Show:** a split view: the Lesson 1.4 checkpoint card about SECRET (".data" and ".rdata").
- **Say:** "In Lesson 1.4 you found SECRET in .data and the text in .rdata. Now you know what those names are: two of the sections you just clicked."
- **Do:** Continue.

## Checkpoints

1. **Order.** Drag into file order: DOS header, DOS stub, PE signature, file header, optional header, section table, section data.
2. **Fill card.** vault.exe passport: Machine (x64), Magic (PE32+), Number of sections, Entry point (RVA), ImageBase.
3. **Choose.** "A file's Machine field reads 4C 01. What is it?" Answer: a 32-bit x86 program. Feedback for x64: "Flip it: 0x014C, which is 32-bit."
4. **Where does it live?** Drag items to sections: main's code (.text), the string "Access denied." (.rdata), g_attempts (.data).

## Hints

Checkpoint 2:

1. Nudge: "Every answer is a field you selected in this lesson."
2. Pointer: "The entry point is 0x10 bytes into the optional header."
3. Answer shown.

## Watch out

- **Expecting PE right after MZ.** The DOS stub and Rich header sit between them, and their size varies. Always follow e_lfanew.
- **Treating the entry point as an address.** It's relative. Beat 9 sets this up and Lesson 2.2 resolves it.
- **Thinking section names matter to Windows.** They're labels for humans. Windows uses each section's addresses and flags. Mention this in the .text card: "Packers often rename sections. Don't trust names alone."

## Try it yourself

1. Open vault.exe (or any .exe you built) in a hex editor such as HxD.
2. Find MZ, read e_lfanew at 0x3C, jump to PE, and read the machine type.
3. Find the section names.

## Author notes

- e_lfanew, NumberOfSections, AddressOfEntryPoint, and the section list come from the build. Update Beat 3, Beat 7, Beat 9, and Checkpoint 2 when the binary is built.
- MSVC x64 builds normally include .text, .rdata, .data, .pdata, and .reloc. A /DYNAMICBASE:NO build may still keep .reloc; show whatever is there and adjust the .reloc card's wording if missing.
- If the build has extra sections (for example _RDATA), add a card that says "The linker adds this for internal data; you can ignore it."
