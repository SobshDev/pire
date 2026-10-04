# Lesson 1.1: Tour of the interface

| | |
|---|---|
| Module | 1, Debugger Basics |
| Time | 10 minutes |
| Specimen | vault.exe (debug-fixed, with PDB) |
| Unlocks | The * key, and the pane names used for the rest of the course |

## Mission

> x64dbg has stopped at the first line of main. Find out where you are, what the CPU holds, and what is on the stack, without running a single instruction.

## You will be able to

- Name the four main panes of the CPU view and say what each one shows.
- Read the current instruction pointer (RIP) and find the matching line in the disassembly.
- Tell from the status bar whether the program is paused or running.
- Jump back to the current instruction after scrolling away.

## Specimen

vault.exe from the module README. The lesson starts already paused on the first instruction of main. Lesson 1.5 shows how to get there yourself; for now the guide says "we brought you here."

Recording needed: a single frozen state from run-wrong, paused at the first instruction of main, plus the CPU tab layout. No instructions execute in this lesson.

## Beats

### Beat 1: Everything at once

- **Show:** the full CPU tab, nothing dimmed, for two seconds. Then everything dims.
- **Say:** "This is what x64dbg looks like when it stops a program. It looks busy, but there are only four areas that matter. Let's meet them one at a time."
- **Do:** click Continue.
- **Then:** move on to the disassembly.

### Beat 2: The disassembly pane (top left)

- **Show:** spotlight on the disassembly pane. The current line is highlighted, and RIP is drawn in the address column.
- **Say:** "This is the code, one instruction per line. The highlighted line, marked RIP, is the next instruction the CPU will run. It has not run yet."
- **Do:** click target, the highlighted line.
- **Then:** label the four columns as the learner hovers them: address, raw bytes, instruction, comments. Show a short tooltip: "The comment column is where x64dbg writes helpful notes, such as the text a string pointer points at."

### Beat 3: Spot the C

- **Show:** the disassembly pane plus a collapsible "Source" drawer with vault.c, main highlighted.
- **Say:** "main starts by calling puts with the banner text. Find the call to puts in the disassembly."
- **Do:** click target, the line call puts (x64dbg shows it as something like call qword ptr ds:[<&puts>]).
- **Then:** "Right. Look at the comment column on the line above it: x64dbg already shows the banner string, == PIRE VAULT ==. You read your first assembly with help from the tool."
- Wrong click: "That line is part of main's setup. Look a few lines further down for the word call."

### Beat 4: The registers pane (top right)

- **Show:** spotlight on the registers pane. RIP is pulsing.
- **Say:** "These are the CPU's registers right now. RIP holds the address of the next instruction."
- **Do:** predict. "What address does RIP hold?" The learner types it or clicks the RIP value. Accept the value with or without leading zeros.
- **Then:** draw a line from the RIP value to the highlighted disassembly line. "Same address. RIP and the highlighted line always agree."

### Beat 5: RFLAGS and red values

- **Show:** spotlight on RFLAGS and the flag list below it (ZF, CF, SF, OF, and so on).
- **Say:** "Flags live here, one bit each. When a value changes after a step, x64dbg paints it red. Nothing is red yet because nothing has run."
- **Do:** Click target, ZF.
- **Then:** "ZF is the zero flag. You will watch it flip in Module 5. For now, just remember where it lives."

### Beat 6: The stack pane (bottom right)

- **Show:** spotlight on the stack pane. The top row is highlighted and labelled RSP.
- **Say:** "This is the stack, 8 bytes per row. The highlighted row is where RSP points. x64dbg explains rows it understands in the comment column."
- **Do:** choose. "The highlighted row's comment says 'return to ...'. What does that mean?" Options:
  - A. "When main finishes, it returns to this address." (correct)
  - B. "This is the address of main."
  - C. "This is a breakpoint."
- **Then:** "Exactly. Someone called main, and the call left this return address on the stack. Module 3 covers this properly."
- Feedback for B: "Close, but main's address is in RIP. The stack holds where to go back to afterwards."
- Feedback for C: "Breakpoints don't live on the stack. Lesson 1.3 covers them."

### Beat 7: The dump pane (bottom left)

- **Show:** spotlight on the dump pane, showing hex bytes on the left and ASCII on the right.
- **Say:** "The dump shows raw memory: an address, 16 bytes in hex, and the same bytes as text. You will use it to look at strings, buffers, and globals."
- **Do:** click target, any readable text in the ASCII column. (The recording pre-scrolls Dump 1 to the .rdata string area so readable text is visible.)
- **Then:** "Those are the program's strings, sitting in memory exactly as the C compiler wrote them."

### Beat 8: The status bar and the command bar

- **Show:** spotlight on the bottom strip: the Command box and the status bar reading Paused in yellow.
- **Say:** "Paused means the program is frozen and you are in control. While it runs, this says Running. The box next to it takes commands; you'll use it in Lesson 1.3."
- **Do:** click target, the Paused label.
- **Then:** advance.

### Beat 9: Getting lost on purpose

- **Show:** the disassembly pane. The guide asks the learner to scroll far down.
- **Say:** "Scroll down until the highlighted line is off screen. Everyone gets lost in the disassembly. Here is how you get back."
- **Do:** scroll until RIP is off screen, then key gate * (the asterisk key, which x64dbg calls "Origin").
- **Then:** the view jumps back to RIP. "The * key takes you back to RIP from anywhere. You just earned your first key." Add * to the cheat sheet.

## Checkpoints

1. **Match the pane.** Drag each label to its pane: "next instruction", "register values", "memory as hex and text", "return addresses and locals".
   - Answer: disassembly, registers, dump, stack.
2. **Predict.** "If you scroll the disassembly away and press *, which line is highlighted?" Answer: the line at RIP. Wrong answers: "the first line of the program" gets "* goes to where the CPU is, not where the program starts."
3. **Choose.** "The status bar says Running. Can you read the registers right now?"
   - Answer: no; the values only make sense while the program is paused.

## Hints

Checkpoint 1:

1. Nudge: "Think about which pane changed color when you clicked RIP."
2. Pointer: "Code is top left, registers top right."
3. Answer: shown with the panes outlined.

## Watch out

- **"The highlighted line already ran."** It has not. RIP points at the next instruction. Beat 2 says this, and Lesson 1.2 opens by testing it again.
- **Mixing up the stack pane and the dump pane.** Both show memory. The stack pane always follows RSP and shows 8-byte rows; the dump shows whatever address you send it to.

## Try it in real x64dbg

1. Install x64dbg and open x64dbg.exe (the 64-bit one). Load vault.exe with File > Open.
2. x64dbg stops before your code runs. Press F9 until the title bar mentions vault.exe and RIP is inside it. (Lesson 1.5 explains these stops.)
3. Point at each of the four panes and say out loud what it shows.
4. Scroll away and press * to come back.

## Author notes

- The layout must match x64dbg's default CPU tab: disassembly top left, registers top right, dump bottom left, stack bottom right, with the info box between disassembly and dump. Hide the info box in this lesson; Lesson 1.4 introduces it.
- Beat 3 depends on how the build shows the puts call. With the dynamic CRT it is an indirect call through the import table. Use the recorded text.
- Beat 4 answer comes from the recording (with debug-fixed, main sits in the 0x140001xxx range).
