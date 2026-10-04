# Lesson 3.4: Volatile and nonvolatile registers

| | |
|---|---|
| Module | 3, Functions and the x64 Calling Convention |
| Time | 12 minutes |
| Specimen | calls-release.exe (release-fixed, with PDB) |
| Unlocks | Rules card rows 7 and 8 |

## Mission

> shout calls puts in a loop. puts can trash half the registers, yet shout's counter survives every call. Find out where it hides and how shout keeps its promise to its caller.

## You will be able to

- List which registers a call may destroy (volatile) and which it must preserve (nonvolatile).
- Predict which register a compiler will use for a value that must survive a call.
- Recognize register saves and restores, and skip them while reading.

## Specimen

calls-release.exe: same source, built /O2. This is the learner's first optimized code. The guide says so and says Module 9 is about optimized code in depth; this lesson only looks at shout.

Expected shape of shout at /O2:

~~~asm
mov  qword ptr [rsp+8], rbx      ; save rbx in the shadow space
push rdi                         ; save rdi on the stack
sub  rsp, 20h
mov  edi, ecx                    ; times
xor  ebx, ebx                    ; i = 0
test ecx, ecx
jle  done
loop:
lea  rcx, [string "PIRE!"]
call qword ptr [<&puts>]
inc  ebx                         ; i++
cmp  ebx, edi
jl   loop
done:
mov  eax, ebx                    ; return i
mov  rbx, qword ptr [rsp+30h]    ; restore rbx
add  rsp, 20h
pop  rdi                         ; restore rdi
ret
~~~

Recording: main's call shout through shout's ret, three loop iterations, including register values before and after each call to puts.

## Beats

### Beat 1: The problem

- **Show:** the source of shout. A cartoon puts with a "registers I'm allowed to wreck" sign.
- **Say:** "shout keeps i and times in registers. Then it calls puts, which uses registers for its own work. How does i survive?"
- **Do:** Continue.

### Beat 2: Two kinds of register

- **Show:** two boxes. "Volatile (may be destroyed by a call): RAX, RCX, RDX, R8, R9, R10, R11." "Nonvolatile (must be preserved by the callee): RBX, RBP, RDI, RSI, R12, R13, R14, R15." RSP is in a box of its own: "always restored".
- **Say:** "Any function you call may destroy the volatile registers. But if it uses a nonvolatile one, it must put the old value back before returning. So a value that needs to survive a call goes in a nonvolatile register."
- **Do:** sort 8 registers into the two boxes. Rules card rows 7 and 8.

### Beat 3: Predict the hiding place

- **Show:** shout's loop, with the inc and cmp lines blurred.
- **Say:** "i has to survive every call to puts. Which kind of register will the compiler pick for it?"
- **Do:** choose volatile or nonvolatile. Answer: nonvolatile.
- **Then:** unblur: inc ebx; cmp ebx, edi. "EBX is i, EDI is times. Both nonvolatile."

### Beat 4: Watch it survive

- **Show:** paused on call puts in the loop, first iteration. Registers spotlighted.
- **Say:** "Note RBX, RDI, RCX, and RDX. Press F8 to step over puts. Which ones changed?"
- **Do:** key gate F8, then click every register that turned red.
- **Then:** RAX, RCX, RDX, and R8 to R11 may be red (from the recording); RBX and RDI are unchanged. "puts used the volatile ones freely. RBX and RDI came back exactly as they were."

### Beat 5: The cost: saving and restoring

- **Show:** shout's prologue: mov [rsp+8], rbx and push rdi.
- **Say:** "But shout's caller might be using RBX and RDI too. shout promised to preserve them. So before using them, shout saves the caller's values."
- **Do:** click the two save lines.
- **Then:** "One goes into the shadow space, the other is pushed. MSVC does both; you'll see either."

### Beat 6: And restoring

- **Show:** shout's epilogue.
- **Say:** "Find the two lines that put them back."
- **Do:** click mov rbx, [rsp+30h] and pop rdi.
- **Then:** "Saved at the start, restored at the end. When you read a function, you can mentally delete these lines. They're bookkeeping, not logic."

### Beat 7: The reader's shortcut

- **Show:** shout with the save and restore lines faded out, leaving the logic: edi = times; ebx = 0; loop calling puts; return ebx.
- **Say:** "Here's shout with the bookkeeping faded. This is the part to read. And notice: a value kept in RBX, RSI, RDI, or R12 to R15 across calls is usually a loop counter, a pointer being walked, or a saved argument."
- **Do:** Fill card: "EDI holds ______, EBX holds ______." Answers: times, i.

### Beat 8: The trap

- **Show:** a buggy hand-written example: mov ecx, 5; call puts; then uses ecx as if it were still 5.
- **Say:** "A last check: what's wrong here?"
- **Do:** choose. "ECX is volatile; puts may have changed it" (correct), "Nothing", "puts needs RDX".
- **Then:** "When you read code, never assume a volatile register keeps its value across a call. That's the most common mistake in reading assembly."

## Checkpoints

1. **Sort.** Drag into volatile or nonvolatile: RAX, RBX, RCX, RSI, R9, R12, R11, RDI.
2. **Choose.** "A loop calls strlen on each element. The pointer to the current element must survive the call. Which register is the compiler likely to use?" Options: RCX, RSI, RAX. Answer: RSI.
3. **Spot the bookkeeping.** In a new function, click the lines that save and restore nonvolatile registers.
4. **Predict.** "Right after call foo, which registers still hold the same values as before the call?" Answer: RBX, RBP, RDI, RSI, R12 to R15 (and RSP).

## Hints

Checkpoint 1:

1. Nudge: "The argument registers are all volatile."
2. Pointer: "Volatile: RAX, RCX, RDX, R8 to R11. Everything else general-purpose is nonvolatile."
3. Answer shown.

## Watch out

- **Thinking "volatile" means it changes constantly.** It means a call may change it. Between calls it behaves like any other register.
- **Reading saves as logic.** Beats 6 and 7 teach learners to ignore them.
- **XMM registers.** XMM6 to XMM15 are also nonvolatile. Mention this in the rules card for completeness; Lesson 3.5 deals with floating point.

## Try it in real x64dbg

1. Load calls-release.exe, bp calls.shout, F9.
2. Step over each call to puts and note which registers turn red each time.
3. Find the save and restore of RBX and RDI.

## Author notes

- /O2 code for shout can differ: MSVC may pick different nonvolatile registers, rotate the loop, or count down. Replace the listing with the recorded one and update Beats 3, 4, and 7.
- In release builds main may compute n differently, but shout is noinline, so it will exist as a separate function.
- Beat 4 depends on which volatile registers puts actually changes in the recording. List only those as red.
