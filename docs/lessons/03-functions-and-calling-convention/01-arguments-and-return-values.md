# Lesson 3.1: Arguments and return values

| | |
|---|---|
| Module | 3, Functions and the x64 Calling Convention |
| Time | 12 minutes |
| Specimen | calls.exe (debug-fixed, with PDB) |
| Unlocks | Rules card rows 1 to 3 |

## Mission

> Every call in a Windows x64 program hands over its arguments the same way. Learn the rule, then use it to read add and sum6 straight from the call sites.

## You will be able to

- Name the four registers that carry the first four integer or pointer arguments, in order.
- Find arguments 5 and up on the stack at the call site.
- Find the return value in RAX or EAX after a call.
- Explain why the code uses ECX for an int argument and what that does to the upper half of RCX.

## Specimen

calls.exe, recording from main's first instruction to the line after call sum6, including the inside of add.

Expected call site for add (shape only):

~~~asm
mov  edx, 5
mov  ecx, dword ptr [rsp+n]      ; n
call calls.add
mov  dword ptr [rsp+r1], eax     ; r1 = result
~~~

Expected call site for sum6 (shape only):

~~~asm
mov  dword ptr [rsp+28h], 6      ; f, sixth argument
mov  eax, dword ptr [rsp+n]
mov  dword ptr [rsp+20h], eax    ; e = n, fifth argument
mov  r9d, 4                      ; d
mov  r8d, 3                      ; c
mov  edx, 2                      ; b
mov  ecx, 1                      ; a
call calls.sum6
mov  qword ptr [rsp+r2], rax     ; r2 = 64-bit result
~~~

## Beats

### Beat 1: Remember MessageBoxA?

- **Show:** a flashback card from Lesson 1.3: MessageBoxA's breakpoint, with RDX = "Vault opened!" and R8 = "PIRE".
- **Say:** "In Lesson 1.3, the message text was in RDX and the title in R8. MessageBoxA(hWnd, text, caption, type): text is argument 2 and caption is argument 3. Can you guess where argument 1 was?"
- **Do:** click a register: RCX.
- **Then:** "RCX. hWnd was NULL, so RCX was 0. And argument 4, the type, was in R9."

### Beat 2: The rule

- **Show:** four labelled slots: 1 RCX, 2 RDX, 3 R8, 4 R9. Rules card row 1 lights up.
- **Say:** "First four arguments: RCX, RDX, R8, R9, in that order. Every function in every 64-bit Windows program follows this rule, including yours, the C runtime's, and Windows' own."
- **Do:** Order: drag the four registers into argument order.

### Beat 3: Read add's call site

- **Show:** main, paused on call calls.add. Two lines above it set EDX and ECX. Source drawer: add(n, 5).
- **Say:** "Without stepping: what will add receive as a and b?"
- **Do:** predict a and b. The learner reads ECX (3) and EDX (5) from the registers pane or the code.
- **Then:** "a = 3 from ECX, b = 5 from EDX. Note the order in the code: the compiler set EDX first. The order of the mov instructions doesn't matter; the register does."

### Beat 4: ECX vs RCX

- **Show:** the mov ecx line and the RCX register, upper half highlighted.
- **Say:** "a is an int, which is 32 bits, so the code writes ECX, the low half of RCX. Writing a 32-bit register on x64 also sets the upper 32 bits of the full register to zero."
- **Do:** predict. "RCX was 0x000000AB12345678 and then mov ecx, 3 runs. What's in RCX?" Answer: 0x0000000000000003.
- **Then:** "Zero-extended. This only happens for 32-bit writes. Writing 8- or 16-bit parts (CL, CX) leaves the rest alone."

### Beat 5: The return value

- **Show:** same spot.
- **Say:** "Step over the call with F8. Results come back in RAX, or EAX for an int."
- **Do:** key gate F8, then predict the value of EAX before looking. Answer: 8.
- **Then:** EAX in red, 8. The next line stores EAX into r1. "Rules card row 3: results come back in RAX."

### Beat 6: Inside add

- **Show:** restart to call add and F7 into it. add's body at /Od: it copies ECX and EDX to the stack, loads them back, adds, and leaves the result in EAX.
- **Say:** "Here's add from the inside. Debug builds first save the argument registers to the stack (you'll see why in Lesson 3.2). Then a + b ends up in EAX right before ret."
- **Do:** click target the instruction that puts the final value in EAX.

### Beat 7: More than four

- **Show:** call site for sum6. Source: sum6(1, 2, 3, 4, n, 6).
- **Say:** "sum6 has six arguments, but there are only four argument registers. Find where a, b, c, and d go."
- **Do:** click target the four lines that set ECX, EDX, R8D, R9D.
- **Then:** "Now the other two. Arguments 5 and 6 are written to the stack."
- **Do:** click target the two stores to [rsp+20h] and [rsp+28h].
- **Then:** rules card row 2. "Argument 5 goes at [rsp+20h], argument 6 at [rsp+28h], and so on in steps of 8. Why 20h and not 0? That's Lesson 3.2."

### Beat 8: Check with the stack

- **Show:** paused on call sum6. Stack pane.
- **Say:** "Find arguments 5 and 6 in the stack pane. Count down from RSP in rows of 8 bytes."
- **Do:** click target the row at RSP+20 (value 3) and RSP+28 (value 6).
- **Then:** F8, RAX = 19 (0x13). "The result is 64-bit (long long), so the code reads all of RAX this time."

## Checkpoints

1. **Read a call site.** Show a fresh snippet (not from calls.exe):
   ~~~asm
   mov  r8d, 10h
   lea  rdx, [rsp+40h]
   mov  rcx, rbx
   call some_function
   ~~~
   "Fill in some_function(____, ____, ____)." Answer: (rbx's value, pointer to a stack buffer, 16). Feedback if the learner orders by line: "The order of lines doesn't matter. RCX is always first."
2. **Choose.** "Where is argument 5 at the moment of the call?" Answer: [rsp+20h].
3. **Predict.** "RDX is 0xFFFFFFFFFFFFFFFF. mov edx, 2 runs. What is RDX?" Answer: 2.
4. **Choose.** "A function returns a pointer. Where do you look right after the call?" Answer: RAX.

## Hints

Checkpoint 1:

1. Nudge: "Sort the lines by register, not by position."
2. Pointer: "RCX, RDX, R8."
3. Answer shown.

## Watch out

- **Reading argument order from instruction order.** Compilers set argument registers in any order. Beat 3 and Checkpoint 1 target this.
- **Thinking R8D means "a different register".** R8D is the low 32 bits of R8, just like ECX is the low 32 bits of RCX.
- **Using Linux rules.** If the learner has seen x64 Linux (RDI, RSI, RDX, RCX, R8, R9), show a one-time note: "That's the System V convention. Windows uses a different one."
- **Large structs.** Structs bigger than 8 bytes are passed as a pointer, and returning one uses a hidden pointer in RCX. Not covered here; mention it only if a learner asks.

## Try it in real x64dbg

1. Load calls.exe, bp calls.add, F9. Read a and b from the registers.
2. Restart, bp calls.sum6. When it stops, the return address is at [rsp]. Find e and f at [rsp+28h] and [rsp+30h] (one row further than at the call site, because call pushed the return address).
3. Ctrl+F9 out of sum6 and read RAX.

## Author notes

- Offsets for n, r1, and r2 in main's frame come from the build. The argument slots [rsp+20h] and [rsp+28h] are fixed by the convention.
- The "Try it" task 2 is a deliberate step ahead: inside the callee the stack arguments are 8 bytes further away. Lesson 3.3 explains this; here it is a hands-on preview.
