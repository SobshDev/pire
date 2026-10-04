# Lesson 3.3: Prologue, epilogue, call and ret

| | |
|---|---|
| Module | 3, Functions and the x64 Calling Convention |
| Time | 10 minutes |
| Specimen | calls.exe (debug-fixed, with PDB) |
| Unlocks | Rules card row 6 |

## Mission

> Follow RSP through a full round trip: main calls scale, scale calls add, and everyone gets back home. Then use what you learned to spot where functions begin and end.

## You will be able to

- Say exactly what call and ret do to RSP, RIP, and the stack.
- Name the parts of a prologue and an epilogue in MSVC x64 code.
- Find where a function starts and ends in a listing without symbols.
- Explain why x64 Windows code rarely uses RBP as a frame pointer.

## Specimen

calls.exe, recording from main's call scale, through scale's call add, add's ret, scale's epilogue and ret, back to main.

## Beats

### Beat 1: call, slowly

- **Show:** paused on call calls.scale in main. Registers RIP and RSP, and the stack pane, are spotlighted. A small "before" card records RIP, RSP, and [RSP].
- **Say:** "call does two things: it pushes the address of the next instruction, then jumps to the target. Predict RSP after F7."
- **Do:** predict. Answer: RSP - 8.
- **Then:** F7 runs. RSP drops by 8, the new top of stack holds the address of the line after call scale in main, and RIP is scale's first line. Rules card row 6.

### Beat 2: The return address

- **Show:** the stack pane's top row: "return to calls.main+xx".
- **Say:** "That's the address scale will return to. Follow it in the disassembler to check."
- **Do:** right-click > Follow in Disassembler, then * to come back.

### Beat 3: The prologue

- **Show:** scale's first lines, bracketed: mov [rsp+8], ecx and sub rsp, 38h.
- **Say:** "The lines at the top that set up the function's stack frame are called the prologue. In MSVC x64 code it's usually: save some registers, then sub rsp. Click every prologue line."
- **Do:** click targets.
- **Then:** "From here until the epilogue, RSP doesn't move. That's an x64 Windows rule, and it's why the code can use RSP-based offsets for everything."

### Beat 4: Nested call

- **Show:** scale's call add. A mini stack diagram on the side shows two return addresses stacking up.
- **Say:** "F7 into add. Now there are two return addresses on the stack: one back to scale, and below it one back to main."
- **Do:** key gate F7.
- **Then:** the Call Stack tab shows add, scale, main.

### Beat 5: ret, slowly

- **Show:** add's ret. [RSP] holds the return address into scale.
- **Say:** "ret pops the top of the stack into RIP. Predict RIP and RSP after F7."
- **Do:** predict both. RIP = the line after call add in scale; RSP = RSP + 8.
- **Then:** "ret trusts whatever is at [RSP]. If a bug overwrites that value, ret jumps somewhere else. That's what stack buffer overflows exploit."

### Beat 6: The epilogue

- **Show:** scale's end: add rsp, 38h, ret.
- **Say:** "The epilogue undoes the prologue in reverse: add back what was subtracted, restore any saved registers, ret. Before ret, RSP must point at the return address again."
- **Do:** F8 to the ret, then check: click the stack row at RSP. It shows "return to calls.main+xx".
- **Then:** F7: back in main, on the line after call scale. "Round trip complete. RSP is exactly what it was before the call."

### Beat 7: Where's RBP?

- **Show:** a small comparison: 32-bit-style code with push ebp; mov ebp, esp and x64 MSVC code with only sub rsp.
- **Say:** "If you've read older x86 code, you might expect push rbp; mov rbp, rsp at the top of every function. MSVC x64 code rarely does this. Since RSP stays still for the whole function body, it can be the frame reference. Windows finds the frames using the unwind tables in .pdata (Lesson 2.1)."
- **Do:** Continue.
- Note for the guide: "You'll still see RBP frames in functions that use alloca or other dynamic stack sizes."

### Beat 8: Spot the boundaries

- **Show:** a stripped listing of about 40 lines with three functions, separated by int3 padding. No names.
- **Say:** "Find where each function starts and ends. Use what you know: int3 padding between functions, sub rsp near the top, add rsp and ret at the bottom."
- **Do:** click the first line and the ret of each function.

## Checkpoints

1. **Predict.** "RSP = 0x14FE60. call some_function runs. What is RSP, and what is at [RSP]?" Answer: 0x14FE58, the address of the instruction after the call.
2. **Predict.** "On ret, [RSP] = 0x140001234. Where does execution continue?" Answer: 0x140001234.
3. **Match.** Drag each line to prologue, body, or epilogue: mov [rsp+8], rbx; sub rsp, 20h; call puts; add rsp, 20h; mov rbx, [rsp+30h]; ret.
4. **Choose.** "A function has sub rsp, 28h at the top. Which instruction must appear before its ret?" Answer: add rsp, 28h.

## Hints

Checkpoint 3:

1. Nudge: "Prologues prepare, epilogues undo."
2. Pointer: "mov rbx, [rsp+30h] near the end restores a register saved at the start."
3. Answer shown.

## Watch out

- **Thinking ret returns to the caller's function start.** It returns to the line after the call.
- **Thinking call pushes arguments.** On x64 Windows the first four go in registers and the rest are written with mov before the call. call itself pushes only the return address.
- **Tail calls.** Some functions end in jmp instead of call followed by ret. Module 9 covers this. If a learner finds one in free play, show a one-line note.

## Try it in real x64dbg

1. bp calls.scale, F9. Note RSP and [RSP].
2. F7 through to add's ret, watching the Call Stack tab grow and shrink.
3. Open any small program without symbols, scroll the .text section, and find three function boundaries using int3 padding and sub rsp.

## Author notes

- The return address offsets (main+xx) come from the recording.
- Beat 8's listing can be cut from the stripped Module 1 vault.exe (check_code, main, and part of the CRT startup) so it's real compiler output.
