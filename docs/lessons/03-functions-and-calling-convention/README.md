# Module 3: Functions and the x64 Calling Convention

**Goal:** the learner can look at any call site or function in a Windows x64 binary and say what the arguments are, where the return value goes, how the stack is laid out, and which register values survive the call.

This is the module that makes assembly readable. Once the learner knows the rules every function follows, most of a function's first and last lines stop being noise, and every call site becomes a readable line of C.

## Lessons

| # | Lesson | Time | Core skill |
|---|--------|------|------------|
| 1 | [Arguments and return values](01-arguments-and-return-values.md) | 12 min | Read arguments from RCX, RDX, R8, R9 and the stack; find the return value in RAX |
| 2 | [Shadow space and stack alignment](02-shadow-space-and-stack-alignment.md) | 12 min | Explain sub rsp, 28h and draw the stack at a call |
| 3 | [Prologue, epilogue, call and ret](03-prologue-epilogue-call-and-ret.md) | 10 min | Find function boundaries and track RSP through call and ret |
| 4 | [Volatile and nonvolatile registers](04-volatile-and-nonvolatile-registers.md) | 12 min | Tell which values survive a call, and skip register saves while reading |
| 5 | [Floating-point arguments](05-floating-point-arguments.md) | 10 min | Read mixed int and float arguments by position |
| ★ | [Module challenge: Call site detective](06-challenge-call-site-detective.md) | 15 min | Write C prototypes from call sites alone |

## The specimen: calls.exe

Each function exists to show one rule. noinline keeps every call visible, and n comes from argc so the compiler can't work out the answers at compile time.

~~~c
// calls.c
#include <stdio.h>

__declspec(noinline) int add(int a, int b)
{
    return a + b;
}

__declspec(noinline) long long sum6(int a, int b, int c, int d, int e, int f)
{
    return (long long)a + b + c + d + e + f;
}

__declspec(noinline) int scale(int x)
{
    int doubled = add(x, x);
    return doubled * 3;
}

__declspec(noinline) double mix(int a, double b, int c, float d)
{
    return a * b + c * d;
}

__declspec(noinline) int shout(int times)
{
    int i;
    for (i = 0; i < times; i++)
        puts("PIRE!");
    return i;
}

int main(int argc, char **argv)
{
    int n = argc + 2;
    (void)argv;

    int r1 = add(n, 5);
    long long r2 = sum6(1, 2, 3, 4, n, 6);
    int r3 = scale(n);
    double r4 = mix(n, 1.5, 2, 0.5f);
    int r5 = shout(n);

    printf("%d %lld %d %f %d\n", r1, r2, r3, r4, r5);
    return 0;
}
~~~

The recording runs calls.exe with no arguments, so argc is 1 and n is 3. The expected results are r1 = 8, r2 = 19, r3 = 18, r4 = 5.5, r5 = 3, and the program prints PIRE! three times.

| Function | Shows | Lesson |
|----------|-------|--------|
| add | Two int arguments, int return, a leaf function | 1, 3 |
| sum6 | Fifth and sixth arguments on the stack | 1, 2 |
| scale | A non-leaf function: shadow space, alignment, a call inside a call | 2, 3 |
| shout | A loop counter that must survive calls to puts | 4 |
| mix | Mixed int and floating-point arguments | 5 |

## Builds and recordings

| Build | Profile | Used in |
|-------|---------|---------|
| calls.exe + PDB | debug-fixed | Lessons 1, 2, 3, 5 |
| calls-release.exe + PDB | release-fixed | Lesson 4 |

The PDB stays on in this module so the learner can see function names and focus on the convention. The challenge removes it.

## The rules this module teaches

The interface shows this card in a side drawer. Each row unlocks when the lesson that teaches it is finished.

| Rule | Lesson |
|------|--------|
| Arguments 1 to 4 go in RCX, RDX, R8, R9 (or ECX, EDX, R8D, R9D for 32-bit values) | 1 |
| Arguments 5 and up go on the stack, starting at [rsp+20h] at the call | 1 |
| Integer and pointer results come back in RAX (EAX for 32-bit) | 1 |
| The caller reserves 32 bytes of shadow space above the return address | 2 |
| RSP is a multiple of 16 right before a call | 2 |
| call pushes the return address; ret pops it | 3 |
| RAX, RCX, RDX, R8 to R11 may be destroyed by any call | 4 |
| RBX, RBP, RDI, RSI, R12 to R15 must be restored before returning | 4 |
| Floating-point arguments use XMM0 to XMM3 by position; the result comes back in XMM0 | 5 |
