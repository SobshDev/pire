# Module 3 challenge: Call site detective

| | |
|---|---|
| Module | 3, Functions and the x64 Calling Convention |
| Time | 15 minutes |
| Specimen | calls2.exe (debug-fixed-stripped, no PDB) |
| Unlocks | Module 4, and the "Detective" badge |

## Mission

> Six functions with no names and no source. For each one, read the call site and the code around it, and write its C prototype.

## How it plays

The learner gets a **prototype builder** for each function: a return type picker, and one picker per argument. The choices are: void, 8-bit integer, 32-bit integer, 64-bit integer, pointer, float, double. The learner also chooses how many arguments there are.

The rules card from the module is available. There's no guide, and three hint tokens cover the whole challenge.

Medals are awarded the same way as in Module 1.

## Specimen

~~~c
// calls2.c
#include <stdio.h>
#include <string.h>

__declspec(noinline) int clamp(int v, int lo, int hi)
{
    return v < lo ? lo : v > hi ? hi : v;
}

__declspec(noinline) void fill(char *buf, char c, size_t n)
{
    memset(buf, c, n);
}

__declspec(noinline) double avg3(double a, double b, double c)
{
    return (a + b + c) / 3.0;
}

__declspec(noinline) long long pick(int a, long long b, int c, int d, int e, long long f)
{
    return a > 0 ? b : f + c + d + e;
}

__declspec(noinline) float lerp(float a, float b, float t)
{
    return a + (b - a) * t;
}

__declspec(noinline) int count_long(const char **words, int n)
{
    int count = 0;
    for (int i = 0; i < n; i++)
        if (strlen(words[i]) > 4)
            count++;
    return count;
}

int main(int argc, char **argv)
{
    char buf[16];
    const char *words[] = { "pire", "reverse", "engineering", "asm" };
    int n = argc + 9;

    int    a = clamp(n, 0, 5);
    fill(buf, 'A', sizeof buf - 1);
    buf[15] = 0;
    double b = avg3(n, 2.0, 4.0);
    long long c = pick(n, -100, 1, 2, 3, 400);
    float  d = lerp(0.0f, 10.0f, 0.25f);
    int    e = count_long(words, 4);

    printf("%d %s %f %lld %f %d\n", a, buf, b, c, d, e);
    return 0;
}
~~~

## Goals

1. **clamp:** (32-bit, 32-bit, 32-bit) returns 32-bit. Evidence: ECX, EDX, R8D set; EAX stored after.
2. **fill:** (pointer, 8-bit, 32- or 64-bit) returns void. Evidence: lea rcx to a stack buffer; DL set from a byte constant; R8D set to 0Fh; nothing reads RAX after the call. Both 32-bit and 64-bit are accepted for the third argument, because the call site can't tell them apart (see the debrief).
3. **avg3:** (double, double, double) returns double. Evidence: XMM0, XMM1, XMM2 loaded with movsd (the first after a cvtsi2sd); XMM0 stored with movsd after.
4. **pick:** (32-bit, 64-bit, 32-bit, 32-bit, 32-bit, 64-bit) returns 64-bit. Evidence: two stack arguments at [rsp+20h] (dword) and [rsp+28h] (qword); RDX set to the full 64-bit value FFFFFFFFFFFFFF9C (-100); RAX stored as a qword after.
5. **lerp:** (float, float, float) returns float. Evidence: movss into XMM0, XMM1, XMM2; movss from XMM0 after.
6. **count_long:** (pointer, 32-bit) returns 32-bit, plus a bonus question: "Inside count_long, where is the loop index i kept, and why doesn't strlen destroy it?" Answer: in a slot in count_long's own stack frame; strlen only uses volatile registers, its own frame, and the shadow space below count_long's locals.

Grading accepts sensible equivalents. For example, "64-bit integer" or "pointer" are both accepted for size_t-like arguments when the evidence can't tell them apart, and the debrief explains the difference.

## Hints (three tiers per goal)

| Goal | Nudge | Pointer | Answer |
|------|-------|---------|--------|
| 1 | "Which registers are written right before the call?" | "ECX, EDX, R8D are 32-bit halves." | Shown with evidence lines. |
| 2 | "Does anything use RAX after the call?" | "lea gives an address; DL is 8 bits." | Shown. |
| 3 | "Which instruction loads each XMM register?" | "movsd means double." | Shown. |
| 4 | "Count the stack slots above the shadow space." | "Compare the size of the stores at [rsp+20h] and [rsp+28h]." | Shown. |
| 5 | "ss or sd?" | "movss means float." | Shown. |
| 6 | "strlen may destroy volatile registers." | "Look for a register saved in the prologue." | Shown. |

## Debrief screen

Show calls2.c next to each prototype the learner built, and three notes:

- "fill's second argument was a char, but you only saw DL. Narrow types travel in the low part of the full register."
- "fill's third argument is a size_t (64 bits), but the call site wrote R8D. Writing a 32-bit register zeroes the top half, so for small constants compilers use the shorter 32-bit form. The register width at a call site is a lower bound on the type. pick's -100 needed all 64 bits, so there the compiler had to write RDX."
- "In debug builds, locals like count_long's i live on the stack. In Lesson 3.4's release build, the same kind of value lived in a nonvolatile register. Both survive calls."
- "Your prototypes are what you'd type into Ghidra to make its decompiler output readable. That's Module 4."

## Author notes

- Build as debug-fixed-stripped so no names help, but keep /Od so the call sites are clear.
- avg3(n, 2.0, 4.0) converts n with cvtsi2sd at the call site; that's intentional evidence that argument 1 is a double.
- At /Od, MSVC may call memset inside fill or inline it. Either is fine; the challenge only looks at the call site.
- At /Od, MSVC keeps i in count_long's stack frame. Confirm in the recording and give its [rsp+xx] offset in the bonus answer.
- Confirm that fill's call site uses mov r8d, 0Fh and pick's uses a 64-bit write to RDX. If not, update goals 2 and 4 and the debrief to match.
## As built

The playable version (content/src/modules/m3/challenge-call-site-detective.ts, specimen content/src/specimens/calls2) differs from the draft above in three places, all to keep the recording self-contained:

- count_long(words, n) became count_except(words, n, skip), which calls strcmp instead of strlen. strcmp is already in every specimen's import table; adding strlen would have shifted the IAT of every earlier specimen. Goal 6 is now (pointer, 32-bit, pointer) returns 32-bit, and the loop index lives at [rsp+24].
- fill writes its bytes with a plain loop, so no memset is needed.
- lerp is called with 1.0f instead of 0.0f, so all three arguments are loaded with movss (MSVC would zero XMM0 with xorps for 0.0f). The program prints "5 AAAAAAAAAAAAAAA 5.333333 -100 3.250000 3".
- The learner starts paused at main, and each goal names the function's address.
