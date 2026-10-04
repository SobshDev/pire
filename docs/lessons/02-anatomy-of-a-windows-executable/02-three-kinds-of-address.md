# Lesson 2.2: Three kinds of address

| | |
|---|---|
| Module | 2, Anatomy of a Windows Executable |
| Time | 12 minutes |
| Specimen | vault.exe (debug-fixed-stripped), vault-aslr.exe (debug-aslr) |
| Unlocks | The address converter tool |

## Mission

> You know where the secret string is in memory. Now find the same string in the file on disk, then explain why its memory address changes every time ASLR is on.

## You will be able to

- Explain the difference between a virtual address (VA), a relative virtual address (RVA), and a file offset.
- Convert between all three using ImageBase and the section table.
- Explain ASLR and why the RVA is the address worth writing down.
- Explain what relocations fix, using SECRET as the example.

## Specimen

vault.exe (fixed base 0x140000000) and vault-aslr.exe (same code, ASLR on).

The beats use these **example** section values. Replace them with the real build's numbers and recompute every answer.

| Section | VirtualAddress | SizeOfRawData | PointerToRawData |
|---------|----------------|---------------|------------------|
| .text | 0x1000 | 0x1200 | 0x400 |
| .rdata | 0x3000 | 0x1000 | 0x1600 |
| .data | 0x4000 | 0x200 | 0x2600 |

Example addresses: main at VA 0x140001070; "opensesame" at VA 0x140003320; SECRET (the pointer) at VA 0x140004000.

## Beats

### Beat 1: Three names for one place

- **Show:** a diagram with three rulers side by side: the file on disk (offsets from 0), the loaded image (RVAs from 0), and the process's whole memory (VAs). The string "opensesame" sits on all three, joined by lines.
- **Say:** "The same byte has three addresses. Its file offset is where it is in the .exe on disk. Its RVA is where it is relative to the start of the loaded image. Its VA is the full address in memory that x64dbg shows."
- **Do:** click each ruler as it's named.

### Beat 2: VA and RVA

- **Show:** x64dbg view of main at 0x140001070. ImageBase card: 0x140000000.
- **Say:** "VA = ImageBase + RVA. main's VA is 0x140001070 and ImageBase is 0x140000000. What is main's RVA?"
- **Do:** predict. Answer 0x1070.
- **Then:** "And in Lesson 2.1 you read the entry point as an RVA. Now you can turn it into the address x64dbg showed."

### Beat 3: Why disk and memory differ

- **Show:** an animation. On disk, sections are packed tight (aligned to 0x200 bytes, FileAlignment). In memory, each section starts on a 0x1000 boundary (SectionAlignment, one page) and gets its own permissions.
- **Say:** "On disk, sections are packed close together to save space. In memory, Windows lays each one out on its own page boundary so it can mark code as executable and data as writable. So the gaps are different, and offsets don't match RVAs."
- **Do:** Continue.

### Beat 4: RVA to file offset

- **Show:** the section table, the string's RVA 0x3320.
- **Say:** "To find the string on disk: first, which section contains RVA 0x3320?"
- **Do:** choose a row. Answer: .rdata (0x3000 up to 0x4000).
- **Then:** "Now: offset = RVA - section VirtualAddress + section PointerToRawData."
- **Do:** predict. 0x3320 - 0x3000 + 0x1600 = 0x1920.
- **Then:** the hex viewer jumps to 0x1920 and shows opensesame. "Same bytes, found on disk."

### Beat 5: Practice

- **Show:** two cards.
- **Say:** "Your turn twice."
- **Do:** predict:
  - main, VA 0x140001070, to file offset. Answer: 0x470.
  - File offset 0x2600 to VA. Answer: 0x140004000 (start of .data, which holds SECRET).
- **Then:** unlock the address converter tool. "You've earned the shortcut. The converter does this for you from now on, but you know what it's doing."

### Beat 6: ASLR

- **Show:** vault-aslr.exe in x64dbg, run 1. main at something like 0x7FF6A1C41070. Then run 2 after a reboot: 0x7FF7B3E21070.
- **Say:** "This build has ASLR on. Windows picks a random ImageBase so attackers can't guess where code is. Compare the two addresses of main. What stayed the same?"
- **Do:** choose. "The last four hex digits" (correct), "the first four", "nothing".
- **Then:** "Windows only moves images in steps of 0x10000, so the low bits never change. More important: the RVA, 0x1070, is identical in both runs. That's why reverse engineers write down RVAs, not VAs."

### Beat 7: How to tell if ASLR is on

- **Show:** the hex viewer at DllCharacteristics for both files. The DYNAMIC_BASE bit (0x40) is set only in vault-aslr.exe.
- **Say:** "The DllCharacteristics field in the optional header has a flag called DYNAMIC_BASE (0x40). If it's set, Windows randomizes the image."
- **Do:** choose which file has ASLR on, from the two values.
- **Then:** "Module 1 used ASLR off on purpose, so the addresses in the lessons match yours."

### Beat 8: Relocations, using SECRET

- **Show:** the hex viewer at .data in vault-aslr.exe on disk: the 8 bytes of SECRET: 20 33 00 40 01 00 00 00.
- **Say:** "SECRET is a pointer stored in .data. On disk it holds 0x140003320, an address that assumes the preferred ImageBase. What happens if Windows loads the image somewhere else?"
- **Do:** choose. "The pointer would be wrong, so Windows must fix it" (correct), "Windows ignores it", "The program crashes".
- **Then:** show the in-memory value from run 1: 0x7FF6A1C43320. "The .reloc section lists every spot like this. The loader adds the difference to each one. Most x64 code doesn't need this because it uses RIP-relative addressing, which is why .reloc is small."

## Checkpoints

1. **Convert.** Three quick conversions using the example table: VA to RVA, RVA to offset, offset to VA.
2. **Choose.** "You found an interesting function at 0x7FF6A1C41530 and want to tell a colleague where it is. What do you write?" Answer: RVA 0x1530 (or "vault.exe+0x1530"). Feedback for the VA: "Their ASLR base will be different."
3. **Choose.** "Which needs a relocation: a mov rdx, qword ptr [rip+0x2F35] instruction, or an 8-byte pointer to a string stored in .data?" Answer: the pointer in .data.

## Hints

Checkpoint 1:

1. Nudge: "Which section is the address in? Start there."
2. Pointer: "offset = RVA - VirtualAddress + PointerToRawData."
3. Answer shown with the arithmetic.

## Watch out

- **Assuming offset = RVA.** It's true for the headers and false for almost everything else. Beat 3 explains why.
- **Forgetting which section.** Each section has its own VirtualAddress and PointerToRawData. Using .text's numbers on a .rdata address gives a wrong answer that looks plausible.
- **Thinking ASLR changes RVAs.** It moves the whole image. Everything inside keeps its RVA.

## Try it in real x64dbg

1. Load vault-aslr.exe and note main's address. Restart Windows (or load on another machine) and compare.
2. In x64dbg, right-click an instruction and use Copy > RVA. Compare it with what you computed.
3. Use Ctrl+G with a module-relative expression, for example vault-aslr.exe+1070, to jump to an RVA.

## Author notes

- Every number in the beats is an example. When the build exists, fill in the real section table and the real addresses of main, the string, and SECRET, and redo every predict answer.
- Windows chooses an EXE's random base once per boot in most cases, so two runs in one session may show the same base. Record the second run after a reboot, or on a second machine, and say "after a reboot" in Beat 6.
- 64-bit ASLR builds typically load at high addresses such as 0x7FF6xxxxxxxx because of high-entropy ASLR. Use the recorded values.
