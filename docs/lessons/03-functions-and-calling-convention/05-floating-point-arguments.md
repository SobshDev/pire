# Lesson 3.5: Floating-point arguments

| | |
|---|---|
| Module | 3, Functions and the x64 Calling Convention |
| Time | 10 minutes |
| Specimen | calls.exe (debug-fixed, with PDB) |
| Unlocks | Rules card row 9, the XMM view in the registers pane |

## Mission

> mix takes an int, a double, an int, and a float. Four arguments, four slots, but two different register families. Work out which value lands where.

## You will be able to

- Name the registers for floating-point arguments and the return value.
- Apply the "by position" rule to mixed int and float argument lists.
- Recognize movss and movsd and tell float from double.
- Read a float or double value from an XMM register.

## Specimen

calls.exe, recording from main's mix call site through mix's ret.

Expected call site (shape only):

~~~asm
movss xmm3, dword ptr [__real@3f000000]          ; d = 0.5f
mov   r8d, 2                                     ; c = 2
movsd xmm1, qword ptr [__real@3ff8000000000000]  ; b = 1.5
mov   ecx, dword ptr [rsp+n]                     ; a = n
call  calls.mix
movsd qword ptr [rsp+r4], xmm0                   ; r4 = result
~~~

## Beats

### Beat 1: A new family

- **Show:** the registers pane scrolled down to XMM0 to XMM15.
- **Say:** "Floating-point values don't use RCX and friends. They travel in the XMM registers, which are 128 bits wide. A double uses the low 64 bits; a float uses the low 32."
- **Do:** click target XMM0.
- **Then:** the guide switches the XMM display to show floats and doubles instead of raw hex.

### Beat 2: Guess the rule

- **Show:** the source: mix(int a, double b, int c, float d). Four slots labelled 1 to 4, each with two lanes: an integer lane (RCX, RDX, R8, R9) and a float lane (XMM0, XMM1, XMM2, XMM3).
- **Say:** "Argument 1 is an int. Argument 2 is a double. Here's the question that trips everyone up: does the double go in XMM0 (the first float register) or XMM1?"
- **Do:** choose XMM0 or XMM1.
- **Then:** reveal XMM1. "Windows assigns slots by position. Argument 2 always uses slot 2: RDX if it's an integer, XMM1 if it's floating point. The other register in that slot goes unused."

### Beat 3: Fill the slots

- **Show:** the four slots.
- **Say:** "Place each of mix's arguments in the right register."
- **Do:** drag a to ECX, b to XMM1, c to R8D, d to XMM3.
- **Then:** rules card row 9.
- Feedback for c into RDX: "c is argument 3, so it uses slot 3: R8."

### Beat 4: Check against the code

- **Show:** the call site.
- **Say:** "Now match each line of the call site to an argument."
- **Do:** click each of the four lines and label it a, b, c, or d.
- **Then:** "Notice the names x64dbg shows for the constants: __real@3ff8000000000000 is the double 1.5 written in hex, and __real@3f000000 is the float 0.5. The compiler names constants after their bit pattern."

### Beat 5: movss vs movsd

- **Show:** the two load lines side by side.
- **Say:** "movss moves a single (a 4-byte float). movsd moves a double (8 bytes). The last letter tells you the type."
- **Do:** choose for each: float or double.

### Beat 6: Read the values

- **Show:** paused on call mix. XMM1 and XMM3 spotlighted.
- **Say:** "Read b and d from the registers."
- **Do:** predict both. Answers: 1.5 and 0.5.

### Beat 7: The return value

- **Show:** F8 over the call. XMM0 turns red.
- **Say:** "Floating-point results come back in XMM0. What did mix return? Work it out from the source first: 3 times 1.5, plus 2 times 0.5."
- **Do:** predict. Answer: 5.5.
- **Then:** "XMM0 = 5.5. Then main stores it with movsd, because r4 is a double."

### Beat 8: A peek inside

- **Show:** F7 into mix (a replay). Highlight the conversion instructions: cvtsi2sd (int to double), cvtsi2ss (int to float), cvtss2sd (float to double).
- **Say:** "Inside, mix converts between types. You don't need these yet. Just remember that cvt means convert, and the letters say from what to what: si is a signed integer, ss is a float, sd is a double."
- **Do:** click target the line that converts a to a double.

## Checkpoints

1. **Fill the slots.** f(double x, int y, double z, char *p): x XMM0, y EDX, z XMM2, p R9.
2. **Choose.** "A function returns float. Where's the result?" Answer: XMM0 (low 32 bits).
3. **Type from instruction.** "movsd xmm2, qword ptr [...] right before a call. What type is argument 3?" Answer: double.
4. **Read a call site.** A new snippet with movss xmm0, ...; mov edx, ...; movss xmm2, .... "Write the parameter types." Answer: (float, int, float).

## Hints

Checkpoint 1:

1. Nudge: "Number the arguments 1 to 4 first."
2. Pointer: "Slot 2 is RDX or XMM1, depending on the type."
3. Answer shown.

## Watch out

- **Packing floats into XMM0, XMM1, ... in order.** That's the Linux (System V) rule. On Windows, position decides. Beat 2 targets this directly.
- **Variadic functions like printf.** For printf and other variadic functions, a double argument in the first four slots is passed in both the XMM register and the matching integer register. Show this as a one-line note only.
- **Arguments 5 and up.** Floating-point arguments beyond the fourth also go on the stack, in the same slots as integers.

## Try it in real x64dbg

1. bp calls.mix. Read XMM1 and XMM3 (change the XMM display format in the registers pane to see them as numbers).
2. Ctrl+F9, F8, and read XMM0.

## Author notes

- In C, c * d is int times float, which is float; a * b is double; their sum is double. The /Od code should therefore contain cvtsi2sd, cvtsi2ss, mulss, cvtss2sd, mulsd, and addsd in some order. Use the recording and keep Beat 8 vague about order.
- Check the menu wording for switching XMM display format in the current x64dbg version and use it in the transfer task.
