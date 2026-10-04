# Lesson 3.2: Shadow space and stack alignment

| | |
|---|---|
| Module | 3, Functions and the x64 Calling Convention |
| Time | 12 minutes |
| Specimen | calls.exe (debug-fixed, with PDB) |
| Unlocks | Rules card rows 4 and 5, the stack diagram tool |

## Mission

> Almost every function starts with sub rsp, something. Work out where that number comes from, and you'll never have to wonder about it again.

## You will be able to

- Explain shadow space: who reserves it, how big it is, and who may use it.
- Explain why fifth arguments start at [rsp+20h].
- Check that RSP is 16-byte aligned at a call, and explain the extra 8 in sub rsp, 28h.
- Draw the stack at the moment of a call.

## Specimen

calls.exe, recording of scale from its first instruction through its call to add, and of add's first instructions (where /Od copies ECX and EDX into the shadow space).

Expected shape of scale at /Od:

~~~asm
mov  dword ptr [rsp+8], ecx      ; save x into the shadow space
sub  rsp, 38h
mov  edx, dword ptr [rsp+40h]    ; x (now 38h further away)
mov  ecx, dword ptr [rsp+40h]    ; x
call calls.add
mov  dword ptr [rsp+20h], eax    ; doubled
imul eax, dword ptr [rsp+20h], 3
add  rsp, 38h
ret
~~~

## Beats

### Beat 1: The question

- **Show:** three function starts side by side from Windows binaries: sub rsp, 28h; sub rsp, 38h; sub rsp, 48h.
- **Say:** "You'll see these numbers everywhere. They're always 8 more than a multiple of 16. That isn't a coincidence. By the end of this lesson you'll be able to predict them."
- **Do:** Continue.

### Beat 2: The shadow space

- **Show:** the stack diagram tool. A call is about to happen. Above the return address, four empty 8-byte boxes labelled "home for RCX", "home for RDX", "home for R8", "home for R9".
- **Say:** "Before every call, the caller must reserve 32 bytes (20h) just above where the return address will go. It's called shadow space or home space. The called function may use it for anything, usually to save its argument registers."
- **Do:** click each of the four boxes.
- **Then:** rules card row 4. "That's why argument 5 sits at [rsp+20h] at the call: the first 20h bytes above RSP belong to the shadow space."

### Beat 3: Watch add use it

- **Show:** F7 into add. Its first lines: mov dword ptr [rsp+10h], edx; mov dword ptr [rsp+8], ecx.
- **Say:** "add's first two lines save b and a into the shadow space the caller reserved. Why [rsp+8] and not [rsp]?"
- **Do:** choose. "[rsp] holds the return address" (correct), "[rsp] is reserved for RAX", "It's random".
- **Then:** the diagram: [rsp] return address, [rsp+8] a, [rsp+10h] b, [rsp+18h] and [rsp+20h] unused. "Debug builds do this so the debugger can always show argument values. Release builds usually don't bother."

### Beat 4: The alignment rule

- **Show:** a ruler with RSP values in hex, every 16-byte boundary marked.
- **Say:** "Second rule: right before any call instruction, RSP must be a multiple of 16 (it must end in 0 in hex). Some instructions that move 16 bytes at once crash on misaligned addresses, so everyone agrees on this."
- **Do:** choose which of four RSP values are aligned: 0x14FE40 (yes), 0x14FE48 (no), 0x14FE30 (yes), 0x14FE38 (no).
- **Then:** rules card row 5.

### Beat 5: Where the 8 comes from

- **Show:** the stack diagram. Before call: RSP = ...40 (aligned). call pushes 8 bytes. At the callee's first line: RSP = ...38.
- **Say:** "The caller's RSP was aligned. The call instruction pushed an 8-byte return address. So at the start of every function, RSP is 8 off. What must the function subtract to be aligned again before its own calls, while also reserving 20h of shadow space?"
- **Do:** predict. Answer: 28h.
- **Then:** "20h for shadow space plus 8 to fix the alignment: sub rsp, 28h. That's the most common line in Windows x64 code."

### Beat 6: scale's 38h

- **Show:** scale's prologue: sub rsp, 38h. Source: one local, doubled.
- **Say:** "scale needs shadow space for its call to add, plus room for its local doubled. MSVC rounds up. Check the arithmetic: is 38h + 8 a multiple of 16?"
- **Do:** choose yes or no. Yes: 38h + 8 = 40h.
- **Then:** "Rule of thumb: with no pushes in the prologue, the sub is always 8 more than a multiple of 16. If the function pushes one register first, the sub becomes a multiple of 16 instead, because the push already fixed the 8."

### Beat 7: Draw it

- **Show:** paused on scale's call add. Empty stack diagram with 9 rows from RSP upward.
- **Say:** "Fill in scale's stack right now, from RSP upward."
- **Do:** fill card: drag labels into rows: shadow space for add (4 rows, [rsp] to [rsp+18h]), doubled (at [rsp+20h], not set yet), padding, padding, return address to main (at [rsp+38h]), x saved in scale's home slot (at [rsp+40h]).
- **Then:** the real stack pane slides in beside the diagram. Matching rows glow.

### Beat 8: Reading the offsets

- **Show:** the line mov ecx, dword ptr [rsp+40h] in scale.
- **Say:** "scale saved x at [rsp+8] on its first line. Now it reads it from [rsp+40h]. Same variable, different offset. Why?"
- **Do:** choose. "RSP moved down by 38h in between" (correct), "x was copied", "It's a different variable".
- **Then:** "8 + 38h = 40h. When RSP moves, every RSP-based offset changes. You'll do this arithmetic a lot; the stack diagram tool can do it for you from now on."

## Checkpoints

1. **Predict the prologue.** "A function makes calls and needs no locals and pushes nothing. What's its sub rsp?" Answer: 28h.
2. **Predict the prologue.** "A function pushes rbx and makes calls, with no locals." Answer: sub rsp, 20h. Feedback for 28h: "The push already moved RSP by 8, so it's aligned again."
3. **Choose.** "At the call instruction, where is argument 5?" Answer: [rsp+20h]. "And on the first line of the called function?" Answer: [rsp+28h].
4. **Choose.** "add makes no calls. Does it need sub rsp?" Answer: no, it's a leaf function. It can use the caller's shadow space and doesn't call anything that needs alignment.

## Hints

Checkpoint 2:

1. Nudge: "At entry RSP is 8 off. What does a push do to RSP?"
2. Pointer: "push moves RSP by 8, so after one push it's aligned."
3. Answer shown with the diagram.

## Watch out

- **Thinking shadow space belongs to the caller.** The caller reserves it, but the callee owns it during the call and can overwrite it.
- **Forgetting the return address.** All the alignment arithmetic hinges on that 8-byte push.
- **Expecting every function to have sub rsp.** Leaf functions often have none.

## Try it in real x64dbg

1. bp calls.scale. When it stops, check that RSP ends in 8.
2. Step over sub rsp, 38h and check that RSP now ends in 0.
3. Step to call add and look at the 4 rows above RSP in the stack pane: that's the shadow space add will receive.

## Author notes

- The exact sub amount for scale depends on MSVC's frame layout. 38h is typical for one local plus a call; use the recorded value and update Beats 6 to 8 and the diagram.
- The movaps alignment reason in Beat 4 is simplified on purpose. Don't go further in this lesson.
