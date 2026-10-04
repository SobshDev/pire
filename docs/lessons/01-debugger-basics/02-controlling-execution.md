# Lesson 1.2: Controlling execution

| | |
|---|---|
| Module | 1, Debugger Basics |
| Time | 12 minutes |
| Specimen | vault.exe (debug-fixed, with PDB) |
| Unlocks | F7, F8, F9, F4, Ctrl+F9 |

## Mission

> Walk through main one instruction at a time. Step over the boring calls, step into the interesting one, and escape when you fall down a hole.

## You will be able to

- Run exactly one instruction and see what changed.
- Choose between step into (F7) and step over (F8) at a call.
- Get out of a function you didn't mean to enter (Ctrl+F9, then F8).
- Skip ahead to a chosen line (F4).

## Specimen

vault.exe, recording run-wrong (input: hello). The lesson starts paused at the first instruction of main, like Lesson 1.1.

Recording segments needed:

- main from its first instruction through the call to check_code;
- the inside of puts as reached by F7, for the "rabbit hole" beat, then the Ctrl+F9 exit;
- check_code from entry to ret;
- the console output after each library call.

## Beats

### Beat 1: Warm-up question

- **Show:** paused at main, RIP highlighted.
- **Say:** "Quick check from last lesson: has the highlighted instruction run yet?"
- **Do:** choose yes or no.
- **Then:** "No. It runs when you step. Let's step."

### Beat 2: One instruction (F8)

- **Show:** the first instruction of main, which reserves stack space (sub rsp, ...).
- **Say:** "Press F8 to run one instruction. Watch the registers."
- **Do:** key gate F8.
- **Then:** RIP moves down one line, and RSP and RIP turn red. "Two registers changed. RIP always changes; it moved to the next line. RSP changed because this instruction made room on the stack. Red means 'changed by the last step'."

### Beat 3: Predict before stepping

- **Show:** RIP on the instruction that loads the banner string into RCX (lea rcx, ...).
- **Say:** "Before you press F8: which register will turn red, besides RIP?"
- **Do:** predict, click a register.
- **Then:** step runs, RCX turns red. The comment column shows the banner string. "This puts the banner's address in RCX, ready to hand to puts. Module 3 explains why RCX."
- Wrong prediction: "The instruction's first operand is where the result goes. Read it again: lea rcx, ..."

### Beat 4: Step over a call (F8)

- **Show:** RIP on call puts. A small console window is visible and empty.
- **Say:** "This line calls puts. F8 runs the whole call and stops on the line after it. Try it."
- **Do:** key gate F8.
- **Then:** the console prints == PIRE VAULT ==. RIP is on the next line. "puts ran completely. You didn't see its code, and you didn't need to. Step over library calls you trust."

### Beat 5: The rabbit hole (F7 into a library)

- **Show:** RIP on the call to printf's internals (the line that prints "Enter code: "). The guide deliberately suggests F7.
- **Say:** "F7 steps into calls instead of over them. Press F7 here and see what happens."
- **Do:** key gate F7.
- **Then:** the disassembly jumps into a DLL. The title bar and the address column show a module like ucrtbase.dll. "You're now inside the C runtime: thousands of lines nobody wrote for this lesson. This happens to everyone."

### Beat 6: Climbing out (Ctrl+F9, then F8)

- **Show:** inside the library function.
- **Say:** "Ctrl+F9 runs until this function is about to return. Then one F8 takes you back to the caller."
- **Do:** key gate Ctrl+F9, then key gate F8.
- **Then:** RIP is back in main, on the line after the call. "Escaped. Remember the pair: Ctrl+F9 to the ret, F8 to come home."

### Beat 7: Run to cursor (F4)

- **Show:** main, with the call check_code line pulsing. Between RIP and that line are the fgets call and the strcspn code.
- **Say:** "Stepping one line at a time gets slow. Click the call check_code line and press F4 to run until that line."
- **Do:** click target the line, then key gate F4.
- **Then:** the console shows "Enter code: hello" (the recording types the input). RIP is on call check_code. "Everything in between ran, including waiting for your input."

### Beat 8: Step into your own function (F7)

- **Show:** RIP on call check_code. Source drawer shows check_code.
- **Say:** "This one is ours, and it decides whether the vault opens. Step into it."
- **Do:** key gate F7.
- **Then:** the disassembly shows check_code's first line. The stack pane top now holds a new "return to vault.main+..." row. "You're inside check_code. Look at the stack: the call left a return address so check_code knows where to go back."

### Beat 9: Run (F9)

- **Show:** inside check_code.
- **Say:** "F9 lets the program run freely. Since there are no breakpoints, it will run to the end."
- **Do:** key gate F9.
- **Then:** the console prints "Access denied." and the status bar shows the process has exited. "F9 is 'go'. In the next lesson you'll put breakpoints in its way."

## Checkpoints

1. **Choose the key.** Show four situations; the learner picks F7, F8, F4, or Ctrl+F9 for each.
   - "RIP is on call check_code and you want to see inside it." F7.
   - "RIP is on call puts and you only care about what happens next in main." F8.
   - "You're deep inside ucrtbase.dll by accident." Ctrl+F9, then F8.
   - "You want to skip to a line 20 instructions down." F4 (after clicking the line).
2. **Predict.** RIP is on an instruction in check_code that loads a register, for example mov eax, dword ptr [g_attempts] (use the real instruction from the recording). "Which register turns red after F8, besides RIP?" Answer: the destination register, the first operand.
3. **Choose.** "You pressed F8 on a call, but there was a breakpoint inside the called function. Where do you stop?"
   - Answer: at the breakpoint inside the function. Feedback: "Step over still stops at breakpoints. This catches people out in Lesson 1.3."

## Hints

Checkpoint 1:

1. Nudge: "Into = see inside. Over = skip the inside."
2. Pointer: "Ctrl+F9 is the 'get me out' key."
3. Answer shown.

## Watch out

- **F7 everywhere.** Beginners step into every call and drown in library code. Beat 5 makes this happen on purpose so it becomes a story, not a panic.
- **Thinking F8 skips code.** Step over still runs the call; it just doesn't stop inside it. Beat 4 shows the output to prove it ran.
- **Ctrl+F9 alone.** It stops on the ret, still inside the function. One more F8 is needed to get back.

## Try it in real x64dbg

1. Load vault.exe, get to main (press F9 until you reach it, or use Ctrl+G and type main, then F4 on its first line).
2. Step over the puts call and watch the console window.
3. F7 into the printf call, then escape with Ctrl+F9, F8.
4. Click call check_code, press F4, type a code in the console, then F7 into check_code.

## Author notes

- In the UCRT, printf is an inline function in the headers that calls __stdio_common_vfprintf. Beat 5 should use whatever call the recording shows; the module it lands in may be ucrtbase.dll. Say "the C runtime" in the text so it doesn't matter which.
- In the real tool, F4 at a line that is never reached runs to the end. The lesson only allows F4 on the target line.
- Beat 9: F9 runs the recording to exit. The real x64dbg shows a "Process stopped" status; mirror that.
