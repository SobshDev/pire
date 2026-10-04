# Lesson 1.4: Following values

| | |
|---|---|
| Module | 1, Debugger Basics |
| Time | 12 minutes |
| Specimen | vault.exe (debug-fixed, with PDB) |
| Unlocks | Follow in Dump, Follow in Disassembler, the info box, Ctrl+G |

## Mission

> The vault compares your code against a secret. Follow the pointers until you are looking at the secret itself.

## You will be able to

- Send a register's value to the dump and read the data it points at.
- Read a little-endian number from the dump.
- Follow a pointer that points at another pointer.
- Use the info box to see what an instruction's memory operand holds.
- Follow an address from the stack into the disassembly.

## Specimen

vault.exe, recording run-wrong (input hello). Starts paused at the first instruction of check_code, reached with a breakpoint (the guide says "we set a breakpoint on check_code for you").

Recording segments needed: check_code from entry to the call to strcmp, with full memory for the buffer on main's stack, the SECRET pointer in .data, the string in .rdata, and g_attempts.

## Beats

### Beat 1: What's in RCX?

- **Show:** paused at check_code's first line. Source drawer: check_code(const char *input).
- **Say:** "check_code receives one argument, input. In x64 Windows the first argument arrives in RCX. RCX holds a number. Is it the text the user typed?"
- **Do:** choose. "RCX is the text" or "RCX is the address of the text."
- **Then:** "It's an address, because input is a pointer. Let's go and look at what it points to."

### Beat 2: Follow in Dump

- **Show:** registers pane, RCX pulsing.
- **Say:** "Right-click RCX and choose Follow in Dump."
- **Do:** guided right-click menu on RCX > Follow in Dump.
- **Then:** the dump jumps to the buffer. The ASCII column reads hello followed by a 00 byte. "There's what you typed: h-e-l-l-o, then a zero byte that ends the C string. The newline is gone because main replaced it with 0."

### Beat 3: Where does it live?

- **Show:** the dump address next to the stack pane's RSP.
- **Say:** "Compare this address with RSP. Is the buffer close to the stack or far from it?"
- **Do:** choose. "Close to RSP" or "Far away."
- **Then:** "Close. buffer is a local array in main, and locals live on the stack. You're looking at main's stack frame from inside check_code."

### Beat 4: Stepping to the secret

- **Show:** a few lines down, the instruction that loads SECRET into RDX before the strcmp call (mov rdx, qword ptr ds:[SECRET]). The info box below the disassembly is visible for the first time.
- **Say:** "Press F4 on the highlighted line. Then look at the info box under the disassembly."
- **Do:** click target and key gate F4.
- **Then:** the info box shows the memory operand and its value: an 8-byte number that looks like an address. "The info box tells you what's in memory before the instruction runs. This line will copy those 8 bytes into RDX."

### Beat 5: Pointer to a pointer

- **Show:** the info box.
- **Say:** "SECRET is a const char *, which is itself stored in memory. So this is a two-step trip: SECRET's storage holds an address, and that address points at the text. Step once with F8, then follow RDX in the dump."
- **Do:** key gate F8; right-click RDX > Follow in Dump.
- **Then:** the dump shows opensesame. "Found it. The secret was sitting in plain text in the program's read-only data. You just followed a pointer to a pointer."

### Beat 6: Reading a number in little-endian

- **Show:** Dump pane. The guide types g_attempts into Ctrl+G for them, animating the steps.
- **Say:** "The dump shows 01 00 00 00. g_attempts is a 4-byte int. What number is that?"
- **Do:** predict a number.
- **Then:** "1. x86 stores the lowest byte first, so you read the bytes right to left: 00 00 00 01. This is little-endian, and you'll do it all the time."
- Wrong answer 16777216: "That's what you get reading left to right. Flip the byte order."

### Beat 7: Practice the flip

- **Show:** a mini dump with E8 03 00 00.
- **Say:** "One more. What int is this?"
- **Do:** predict.
- **Then:** "0x000003E8 = 1000."

### Beat 8: Follow in Disassembler

- **Show:** the stack pane, the "return to vault.main+..." row pulsing.
- **Say:** "Values that point at code go to the disassembly instead of the dump. Right-click this return address and choose Follow in Disassembler."
- **Do:** guided right-click > Follow in Disassembler.
- **Then:** the disassembly shows main, landing on the line right after call check_code. "That's exactly where check_code will return to. Press * to come back to RIP."
- **Do:** key gate *.

## Checkpoints

1. **Choose the follow.** For each value, pick dump or disassembler:
   - RCX holding the address of a string. Dump.
   - A stack row commented "return to vault.main+..." Disassembler.
   - RIP. Disassembler.
2. **Little-endian.** "The dump shows 2A 00 00 00. Which int is it?" Answer: 42. "The dump shows 00 01 00 00?" Answer: 256.
3. **Pointer chain.** Fill card: "SECRET's own address is in ______ (.data/.rdata/stack). The text it points at is in ______." Answers: .data, .rdata. (The card shows the dump addresses and the section column from the memory view to make this answerable. Module 2 explains sections.)

## Hints

Checkpoint 2:

1. Nudge: "Read the bytes from right to left."
2. Pointer: "00 00 00 2A in hex."
3. Answer shown.

## Watch out

- **Reading little-endian left to right.** Beat 6 sets up this mistake and corrects it right away.
- **Following a string pointer in the disassembler.** You get garbage instructions. If a learner does this in free play, show: "These look like nonsense instructions because this is text, not code. Try the dump."
- **Forgetting that registers hold numbers.** A register is never "a string". It can hold the address of one.

## Try it in real x64dbg

1. Run vault.exe to check_code (use bp check_code, which works because the PDB is there).
2. Follow RCX in the dump and find your input.
3. Find the secret using the info box and the dump. Write it down, then use it to open the vault.

## Author notes

- At /Od, MSVC may first spill RCX to the shadow space ([rsp+8]) and load it back later. The beats only use RCX at entry, so this doesn't matter, but don't step the learner past the spill without comment.
- Beat 4 depends on the compiler loading SECRET with a RIP-relative mov into RDX right before the strcmp call. If the recording uses another register first and then moves it, keep the same story with the recorded registers.
- Checkpoint 3 needs the memory map's section names visible. Show a one-line tooltip from the Memory Map tab.
