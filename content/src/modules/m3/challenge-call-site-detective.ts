import type { LessonInput } from "../../schema";
import { calls2Recordings, calls2Source } from "../../specimens/calls2";

const at = calls2Recordings().at;
const short = (label: string) => at[label]!;
const NONE = "(none)";
const TYPES = ["8-bit integer", "32-bit integer", "64-bit integer", "pointer", "float", "double"];
const RETURNS = ["void", ...TYPES];
const ARGS = [NONE, ...TYPES];

/** The prototype builder: a return type and six argument slots, with extra accepted answers where the evidence can't decide. */
function prototype(returns: string, args: string[], accept: Record<number, string[]> = {}) {
  return {
    type: "fill" as const,
    fields: [
      { id: "ret", label: "Returns", format: "choice" as const, answer: returns, options: RETURNS },
      ...[0, 1, 2, 3, 4, 5].map((i) => ({
        id: "a" + (i + 1),
        label: "Argument " + (i + 1),
        format: "choice" as const,
        answer: args[i] ?? NONE,
        accept: accept[i] ?? [],
        options: ARGS,
      })),
    ],
    fallback: "Some of the prototype doesn't match the evidence yet. The red fields are wrong.",
  };
}

/** The Module 3 challenge, designed in docs/lessons/03-functions-and-calling-convention/06-challenge-call-site-detective.md. */
export const callSiteDetective: LessonInput = {
  id: "m3.challenge",
  module: 3,
  number: "★",
  title: "Challenge: Call site detective",
  mission: "Six functions with no names and no source. For each one, read the call site and the code around it, and write its C prototype.",
  minutes: 15,
  recording: "calls2-stripped",
  start: { at: at.main!, banner: "calls2.exe without its PDB, paused at main" },
  source: calls2Source,
  locks: {},
  console: true,
  challenge: true,
  hintTokens: 3,
  steps: [
    {
      section: "beat",
      kind: "Goal",
      title: "Function 1",
      say: "main's first call goes to calls2." + short("clamp") + ". Build its prototype: how many arguments, what type each one is, and what it returns. Leave unused slots at (none).",
      free: true,
      gate: prototype("32-bit integer", ["32-bit integer", "32-bit integer", "32-bit integer"]),
      hints: [
        "Which registers are written right before the call, and what does main do with RAX after it?",
        "ECX, EDX and R8D are 32-bit halves. xor edx,edx sets EDX to 0. Right after the call, EAX is stored as a dword.",
        "Three 32-bit integers in, a 32-bit integer out: int f(int, int, int).",
      ],
      success: "int f(int, int, int). xor edx,edx is just the cheapest way to pass 0.",
    },
    {
      section: "beat",
      kind: "Goal",
      title: "Function 2",
      say: "The second call goes to calls2." + short("fill") + ".",
      free: true,
      gate: prototype("void", ["pointer", "8-bit integer", "32-bit integer"], { 2: ["64-bit integer"] }),
      hints: [
        "Does anything use RAX after the call?",
        "lea computes an address, so RCX is a pointer. DL is 8 bits. Nothing reads EAX afterwards.",
        "void f(char *, char, n) where n is a 32-bit or 64-bit integer: lea rcx, mov dl,41, mov r8d,F.",
      ],
      success: "void f(char *, char, size). 41 is 'A', and the pointer is a buffer on main's stack.",
    },
    {
      section: "beat",
      kind: "Goal",
      title: "Function 3",
      say: "The third call goes to calls2." + short("avg3") + ".",
      free: true,
      gate: prototype("double", ["double", "double", "double"]),
      hints: [
        "Which instruction loads each XMM register before the call?",
        "movsd means double. cvtsi2sd converts an int into a double, so XMM0 is a double too.",
        "double f(double, double, double): XMM0, XMM1 and XMM2 in, XMM0 stored with movsd after.",
      ],
      success: "double f(double, double, double). main passed an int, but cvtsi2sd shows the function wanted a double.",
    },
    {
      section: "beat",
      kind: "Goal",
      title: "Function 4",
      say: "The fourth call goes to calls2." + short("pick") + ". This one has more than four arguments.",
      free: true,
      gate: prototype("64-bit integer", ["32-bit integer", "64-bit integer", "32-bit integer", "32-bit integer", "32-bit integer", "64-bit integer"]),
      hints: [
        "Count the stack slots above the shadow space.",
        "Compare the size of the stores at [rsp+20] (dword) and [rsp+28] (qword). RDX gets all 64 bits.",
        "long long f(int, long long, int, int, int, long long). After the call, all of RAX is stored.",
      ],
      success: "long long f(int, long long, int, int, int, long long). Arguments 5 and 6 sat at [rsp+20] and [rsp+28].",
    },
    {
      section: "beat",
      kind: "Goal",
      title: "Function 5",
      say: "The fifth call goes to calls2." + short("lerp") + ".",
      free: true,
      gate: prototype("float", ["float", "float", "float"]),
      hints: ["ss or sd?", "movss means float, both before the call and when main stores XMM0 after it.", "float f(float, float, float)."],
      success: "float f(float, float, float).",
    },
    {
      section: "beat",
      kind: "Goal",
      title: "Function 6",
      say: "The last call before printf goes to calls2." + short("count_except") + ".",
      free: true,
      gate: prototype("32-bit integer", ["pointer", "32-bit integer", "pointer"]),
      hints: [
        "Two of the arguments are addresses. Where do they point?",
        "lea rcx,[rsp+60] points at main's stack, where it stored four string pointers. R8 points at the string \"asm\". EDX is 4.",
        "int f(char **, int, char *).",
      ],
      success: "int f(const char **, int, const char *): an array of four strings, its length, and a string to compare against.",
    },
    {
      section: "beat",
      kind: "Choose",
      title: "Bonus: the survivor",
      say: "Inside calls2." + short("count_except") + ", a loop calls strcmp on each word. Where does it keep the loop index, and why doesn't strcmp destroy it?",
      free: true,
      gate: {
        type: "choose",
        correct: "stack",
        options: [
          { id: "rbx", label: "In RBX, because it's nonvolatile", feedback: "That's what Lesson 3.4's release build did. Look at this debug build: what does it compare against EAX each time round?" },
          { id: "stack", label: "At [rsp+24] in its own stack frame, which strcmp doesn't touch" },
          { id: "rcx", label: "In RCX, because it's the first argument", feedback: "RCX is volatile, and here it carries the word to strcmp." },
        ],
      },
      hints: ["strcmp may destroy volatile registers.", "Look for the dword the loop increments and compares.", "[rsp+24]: set to 0, incremented, and compared with n. It's in the function's own frame, above strcmp's shadow space."],
      success: "[rsp+24]. strcmp only uses volatile registers, its own frame, and the shadow space below count_except's locals.",
    },
  ],
  debrief: [
    "The second function's middle argument was a char, but you only saw DL. Narrow types travel in the low part of the full register.",
    "Its third argument is a size_t (64 bits), but the call site wrote R8D. Writing a 32-bit register zeroes the top half, so for small constants compilers use the shorter 32-bit form. The register width at a call site is a lower bound on the type. The -100 passed to the fourth function needed all 64 bits, so there the compiler had to write RDX.",
    "In debug builds, locals like count_except's i live on the stack. In Lesson 3.4's release build, the same kind of value lived in a nonvolatile register. Both survive calls.",
    "Your prototypes are what you'd type into Ghidra to make its decompiler output readable. That's Module 4.",
  ],
  tryIt: [
    "Compile calls2.c with cl /Od (no /Zi, so no PDB) and open it in x64dbg. Find each call in main and check your prototypes against the source.",
    "Pick any small function in a program you didn't write, read one call site, and guess its prototype before stepping in.",
  ],
};
