# Lesson 1.3: Breakpoints

| | |
|---|---|
| Module | 1, Debugger Basics |
| Time | 12 minutes |
| Specimen | vault.exe (debug-fixed, with PDB) |
| Unlocks | F2, the command bar, the Breakpoints tab |

## Mission

> Set three traps: one on a line of code, one on the "Vault opened!" message box, and one that fires the moment g_attempts changes.

## You will be able to

- Toggle a breakpoint on a line with F2 and run to it with F9.
- Break on a Windows API by name with the bp command.
- Set a hardware breakpoint that fires when memory is written.
- Find, disable, and delete breakpoints in the Breakpoints tab.

## Specimen

vault.exe, both recordings:

- run-wrong (input hello): used for the line breakpoint and the hardware breakpoint.
- run-right (input opensesame): used for the MessageBoxA breakpoint.

Recording segments needed: main start to the test after check_code; check_code's increment of g_attempts; the first instruction of user32!MessageBoxA with its register state.

## Beats

### Beat 1: Why breakpoints

- **Show:** main, paused at its first line. A counter in the corner reads "Steps: 0".
- **Say:** "Last lesson you stepped and used F4. That works when the target is on screen. A breakpoint is a stop sign you can place anywhere, even in code you haven't found yet."
- **Do:** Continue.

### Beat 2: A breakpoint on a line (F2)

- **Show:** main. The line test eax, eax right after call check_code is pulsing.
- **Say:** "This line runs right after check_code returns its answer. Click it and press F2."
- **Do:** click target, then key gate F2.
- **Then:** the address cell turns red. "A red address means a breakpoint is set there."

### Beat 3: Run into it (F9)

- **Show:** same view.
- **Say:** "Now press F9. The program will run until it hits your stop sign."
- **Do:** key gate F9.
- **Then:** the console shows "Enter code: hello". The status bar reads "Paused" with "INT3 breakpoint at ...". RIP is on test eax, eax. "check_code just returned. Its answer is in EAX. What is it?"
- **Predict:** the learner types the value of EAX. Answer: 0 (wrong code). "0 means false. The vault stays shut."

### Beat 4: How it works (short reveal)

- **Show:** a small side card with the instruction bytes; the first byte is swapped for CC in an animation.
- **Say:** "A normal breakpoint secretly replaces the first byte of the instruction with CC, the INT3 instruction. When the CPU hits it, the debugger takes over and puts the real byte back for you. x64dbg hides the swap, so you'll never see CC in its views."
- **Do:** Continue.

### Beat 5: Break on an API (bp MessageBoxA)

- **Show:** restart into run-right (the interface says "New run: this time the code is opensesame"). Paused at main. The command bar is pulsing.
- **Say:** "You don't know where the 'Vault opened!' box is shown, but you know its name: MessageBoxA. Type bp MessageBoxA in the command bar and press Enter."
- **Do:** command gate. Accept bp MessageBoxA and bp user32.MessageBoxA, ignoring case.
- **Then:** the log shows the breakpoint was set. "x64dbg looked up MessageBoxA in user32.dll and put a breakpoint on its first instruction."

### Beat 6: Catch the message box

- **Show:** same.
- **Say:** "Press F9."
- **Do:** key gate F9.
- **Then:** paused inside user32.dll on MessageBoxA's first line. The registers pane shows RDX and R8 with comments "Vault opened!" and "PIRE". "You stopped right before the box appeared. Look at RDX and R8: the message text and the title are already there. Module 3 explains why those registers."
- **Choose:** "The box hasn't appeared yet. Why not?" Answer: "We stopped on MessageBoxA's first instruction, before it did anything."

### Beat 7: Watch a variable (hardware breakpoint on write)

- **Show:** back to run-wrong, paused at main. Dump pane is pulsing.
- **Say:** "g_attempts is a global. Let's stop the moment anything writes to it. First, show it in the dump: press Ctrl+G in the dump and type g_attempts."
- **Do:** click target dump, key gate Ctrl+G, command gate g_attempts (also accept vault.g_attempts).
- **Then:** the dump shows 00 00 00 00 at the top. "Four zero bytes: that's g_attempts, an int set to 0."

### Beat 8: Set it

- **Show:** the first byte of g_attempts in the dump, pulsing.
- **Say:** "Right-click the first byte, choose Breakpoint, then Hardware, Write, Dword."
- **Do:** a guided right-click menu: Breakpoint > Hardware, Write > Dword.
- **Then:** "A hardware breakpoint uses one of the CPU's 4 debug registers. It doesn't change any code; the CPU itself watches the address."

### Beat 9: Fire it

- **Show:** same.
- **Say:** "Press F9 and type a code when asked."
- **Do:** key gate F9.
- **Then:** paused inside check_code. RIP is on the line after the write (for example after mov dword ptr [g_attempts], eax). The dump shows 01 00 00 00 in red. "It fired. Notice RIP is one line past the write: hardware write breakpoints stop after the instruction that wrote. The value went from 0 to 1, which is g_attempts++."

### Beat 10: The Breakpoints tab

- **Show:** the Breakpoints tab, listing the F2 breakpoint, MessageBoxA, and the hardware breakpoint.
- **Say:** "Every breakpoint you set lives here. Disable the F2 one with the space bar, and delete the hardware one with Delete."
- **Do:** click target the row, key gate Space; click target the hardware row, key gate Delete.
- **Then:** "Disabled breakpoints stay in the list but don't stop the program. Deleted ones are gone. Tidy breakpoint lists save you a lot of confusion later."

## Checkpoints

1. **Choose the breakpoint.** For each goal, pick software (F2), API (bp name), or hardware write:
   - "Stop when the program shows any message box." bp MessageBoxA.
   - "Find out which code changes a global counter." Hardware write.
   - "Stop every time this specific line runs." F2.
2. **Predict.** "A hardware write breakpoint fires on mov dword ptr [g_attempts], eax. Which line is RIP on?" Answer: the line after the mov.
3. **Choose.** "You set bp MessageBoxA, but the program calls MessageBoxW instead. What happens?"
   - Answer: the breakpoint never fires. Feedback: "A and W are different functions. Module 7 explains them. For now, when an API breakpoint doesn't fire, try the other letter."

## Hints

Checkpoint 1:

1. Nudge: "Ask yourself: do I know the line, the function name, or only the data?"
2. Pointer: "Only the data? That's a job for the CPU watching memory."
3. Answer shown.

## Watch out

- **Software breakpoints are invisible in memory views** in x64dbg, but they are real CC bytes. This matters later when programs checksum their own code. Mention it once in Beat 4 and move on.
- **Only four hardware breakpoints.** The CPU has four debug address registers (DR0 to DR3). Say this in Beat 8 so learners aren't surprised when the fifth one fails.
- **Hardware write breakpoints stop after the write.** Beginners look for the write at RIP and don't find it. Beat 9 calls this out directly.

## Try it in real x64dbg

1. Load vault.exe and type bp MessageBoxA in the command bar. Press F9 until the console asks for a code, then type opensesame.
2. When it stops, look at RDX in the registers pane. Then press Ctrl+F9 and F8 to return to main, and F9 to see the box.
3. Restart (Ctrl+F2), set a hardware write breakpoint on g_attempts, and run. Find the instruction just above RIP that did the write.

## Author notes

- The exact form of the g_attempts++ code at /Od is usually a load, an add or inc, and a store. Beat 9 must point at the recorded store and show RIP one instruction later.
- Beat 6: the first line of MessageBoxA in user32 changes between Windows versions. Use whatever the recording shows and don't comment on the instruction itself.
- The Breakpoints tab in the real tool also lists the system breakpoint options under other types. Show only the three the learner created.
