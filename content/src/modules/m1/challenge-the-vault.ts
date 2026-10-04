import type { LessonInput } from "../../schema";
import { vault2, vault2Source } from "../../specimens/vault2";

const WRONG = "vault2-stripped.wrong";
const RIGHT = "vault2-stripped.right";

/** The Module 1 challenge, designed in docs/lessons/01-debugger-basics/06-challenge-the-vault.md. */
export const theVault: LessonInput = {
  id: "m1.challenge",
  module: 1,
  number: "★",
  title: "Challenge: The Vault",
  mission: "A new vault, a new secret, and no guide. Find main, find the check, and read the secret out of memory.",
  minutes: 15,
  recording: WRONG,
  start: { at: "start", dump: "0000000140005000" },
  source: vault2Source,
  locks: { callArgs: "3.1" },
  console: true,
  challenge: true,
  hintTokens: 3,
  steps: [
    {
      section: "beat",
      kind: "Goal",
      title: "Find main",
      say: "vault2.exe has no PDB. Put a breakpoint on main's first instruction and stop there. Either route from Lesson 1.5 works.",
      gate: { type: "goal", check: { kind: "pausedAt", address: vault2.main, withBreakpoint: true, recording: WRONG } },
      hints: [
        "No PDB. Which two routes did Lesson 1.5 teach?",
        "The program prints Vault v2 - code: . Search for string references.",
        "Right-click the disassembly, Search for, Current Module, String references. Double-click the prompt, find the first line after the int3 padding above it, press F2, then F9.",
      ],
      success: "Found main. Note the address: it isn't where vault.exe kept it.",
    },
    {
      section: "beat",
      kind: "Goal",
      title: "Find the check",
      say: "Stop on the first instruction of the function that decides whether the code is right.",
      gate: { type: "goal", check: { kind: "pausedAt", address: vault2.verify, or: [vault2.callVerify], recording: WRONG } },
      hints: [
        "main calls a few functions. Which one isn't a DLL import?",
        "Look for the call whose result is tested right after it.",
        "It's the unnamed call just before test eax,eax. Click it, press F4, then F7.",
      ],
      success: "That's the check. Step into it if you stopped on the call: the next goals happen inside.",
    },
    {
      section: "beat",
      kind: "Goal",
      title: "Read the input",
      say: "Show the code you typed, letmein, in the dump.",
      gate: { type: "goal", check: { kind: "dumpShows", text: "letmein" } },
      hints: ["Where does the first argument arrive?", "Right-click RCX at the function's first line.", "Right-click RCX, then Follow in Dump."],
      success: "There's your input, on main's stack.",
    },
    {
      section: "beat",
      kind: "Goal",
      title: "Find the secret",
      say: "Show the secret string in the dump.",
      gate: { type: "goal", check: { kind: "dumpShows", text: "pirate42" } },
      hints: [
        "The secret is passed to strcmp.",
        "Look at RDX just before the call to strcmp.",
        "Step to the call to strcmp, then right-click RDX and choose Follow in Dump.",
      ],
      success: "Found it in plain text.",
    },
    {
      section: "beat",
      kind: "Answer",
      title: "Name the secret",
      say: "Type the secret.",
      free: true,
      gate: { type: "predict", format: "text", answer: "pirate42", placeholder: "the secret", fallback: "Copy it from the dump's ASCII column, up to the first dot." },
      success: "pirate42.",
    },
    {
      section: "beat",
      kind: "Goal",
      title: "Catch the counter",
      say: "The check counts your tries in a global. Use a hardware write breakpoint to stop when it changes.",
      gate: { type: "goal", check: { kind: "hwHit", address: vault2.g_tries } },
      hints: [
        "Find a global that changes when you guess. Ctrl+F2 restarts if you've already passed it.",
        "Look in the check function for an instruction that writes to a fixed address, not the stack.",
        "Ctrl+G in the dump with the address from mov dword ptr ds:[...],eax, then right-click its first byte: Breakpoint, Hardware, Write, Dword. Restart with Ctrl+F2 and press F9 until it fires.",
      ],
      success: "Caught the write. The instruction above RIP is the one that changed it.",
    },
    {
      section: "beat",
      kind: "Answer",
      title: "Name the counter",
      say: "Type the counter's address.",
      free: true,
      gate: {
        type: "predict",
        format: "hex",
        answer: vault2.g_tries,
        placeholder: "address in hex",
        fallback: "It's the address inside the brackets of the instruction that wrote it, and the address your breakpoint watches.",
      },
      success: "That's g_tries.",
    },
    {
      section: "beat",
      kind: "Goal",
      title: "Open the vault",
      say: "This run types pirate42. Run it until it's about to show the message box, stopping on MessageBoxA first.",
      setup: { recording: RIGHT, at: "start", banner: "New run: this time the code is pirate42" },
      gate: { type: "goal", check: { kind: "pausedAt", address: vault2.MessageBoxA, recording: RIGHT } },
      hints: ["Which API shows a message box?", "Use the command bar.", "Type bp MessageBoxA in the command bar, then press F9 until you stop inside it."],
      success: "RDX holds You're in. The vault is open.",
    },
  ],
  debrief: [
    "The secret was stored in plain text. Real programs often hide it better, and later modules show how.",
    "verify gives up after 3 tries. Did you spot cmp dword ptr ds:[...],3 in the assembly? Module 5 teaches you to read that kind of comparison.",
    "verify is static, so in a release build the compiler might have inlined it into main. Module 9 is about that.",
  ],
  tryIt: [
    "Build vault2.c with cl /Od /Zi, delete the .pdb, and load vault2.exe in x64dbg.",
    "Reach every goal again without the course, then try the wrong code four times in one run to watch the try limit.",
  ],
};
