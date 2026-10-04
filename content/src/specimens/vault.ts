import type { z } from "zod";
import type { Instruction, Snapshot, SourceFile } from "../schema";

type InstructionInput = z.input<typeof Instruction>;

/** One int3 padding row per byte, like x64dbg shows them. */
function int3(from: number, to: number): InstructionInput[] {
  const rows: InstructionInput[] = [];
  for (let a = from; a <= to; a++) {
    rows.push({ address: a.toString(16).toUpperCase().padStart(16, "0"), bytes: "CC", mnemonic: "int3" });
  }
  return rows;
}

const i = (address: string, bytes: string, mnemonic: string, operands = "", comment?: string): InstructionInput => ({
  address: address.padStart(16, "0"),
  bytes,
  mnemonic,
  operands,
  ...(comment ? { comment } : {}),
});

/*
 * Hand-written stand-in for the recording of vault.exe (debug-fixed build), laid out to match
 * the Paper designs. Import table slots used below:
 *   MessageBoxA 140002000, __acrt_iob_func 1400021C8, puts 1400021D0, fgets 1400021D8,
 *   strcspn 1400021E0, __stdio_common_vfprintf 1400021E8, strcmp 140002200.
 * Replace with the real recording once the binary is built (see docs/lessons/README.md).
 */
const disassembly: InstructionInput[] = [
  // check_code
  i("140001000", "48:894C24 08", "mov", "qword ptr ss:[rsp+8],rcx"),
  i("140001005", "48:83EC 28", "sub", "rsp,28"),
  i("140001009", "8B05 31400000", "mov", "eax,dword ptr ds:[<g_attempts>]"),
  i("14000100F", "FFC0", "inc", "eax"),
  i("140001011", "8905 29400000", "mov", "dword ptr ds:[<g_attempts>],eax"),
  i("140001017", "48:8B15 E23F0000", "mov", "rdx,qword ptr ds:[<SECRET>]"),
  i("14000101E", "48:8B4C24 30", "mov", "rcx,qword ptr ss:[rsp+30]"),
  i("140001023", "FF15 D7110000", "call", "qword ptr ds:[<&strcmp>]"),
  i("140001029", "85C0", "test", "eax,eax"),
  i("14000102B", "0F94C0", "sete", "al"),
  i("14000102E", "0FB6C0", "movzx", "eax,al"),
  i("140001031", "48:83C4 28", "add", "rsp,28"),
  i("140001035", "C3", "ret"),
  ...int3(0x140001036, 0x14000106f),
  // main
  i("140001070", "48:83EC 58", "sub", "rsp,58"),
  i("140001074", "48:8D0D 85210000", "lea", "rcx,qword ptr ds:[140003200]", '140003200:"== PIRE VAULT =="'),
  i("14000107B", "FF15 4F110000", "call", "qword ptr ds:[<&puts>]"),
  i("140001081", "48:8D0D 8C210000", "lea", "rcx,qword ptr ds:[140003214]", '140003214:"Enter code: "'),
  i("140001088", "E8 83000000", "call", "<vault.printf>"),
  i("14000108D", "33C9", "xor", "ecx,ecx"),
  i("14000108F", "FF15 33110000", "call", "qword ptr ds:[<&__acrt_iob_func>]"),
  i("140001095", "4C:8BC0", "mov", "r8,rax"),
  i("140001098", "BA 20000000", "mov", "edx,20", "20:' '"),
  i("14000109D", "48:8D4C24 20", "lea", "rcx,qword ptr ss:[rsp+20]"),
  i("1400010A2", "FF15 30110000", "call", "qword ptr ds:[<&fgets>]"),
  i("1400010A8", "48:85C0", "test", "rax,rax"),
  i("1400010AB", "75 07", "jne", "vault.1400010B4"),
  i("1400010AD", "B8 01000000", "mov", "eax,1"),
  i("1400010B2", "EB 54", "jmp", "vault.140001108"),
  i("1400010B4", "48:8D15 69210000", "lea", "rdx,qword ptr ds:[140003224]", '140003224:"\\n"'),
  i("1400010BB", "48:8D4C24 20", "lea", "rcx,qword ptr ss:[rsp+20]"),
  i("1400010C0", "FF15 1A110000", "call", "qword ptr ds:[<&strcspn>]"),
  i("1400010C6", "C64404 20 00", "mov", "byte ptr ss:[rsp+rax+20],0"),
  i("1400010CB", "48:8D4C24 20", "lea", "rcx,qword ptr ss:[rsp+20]"),
  i("1400010D0", "E8 2BFFFFFF", "call", "<vault.check_code>"),
  i("1400010D5", "85C0", "test", "eax,eax"),
  i("1400010D7", "74 1D", "je", "vault.1400010F6"),
  i("1400010D9", "45:33C9", "xor", "r9d,r9d"),
  i("1400010DC", "4C:8D05 45210000", "lea", "r8,qword ptr ds:[140003228]", '140003228:"PIRE"'),
  i("1400010E3", "48:8D15 46210000", "lea", "rdx,qword ptr ds:[140003230]", '140003230:"Vault opened!"'),
  i("1400010EA", "33C9", "xor", "ecx,ecx"),
  i("1400010EC", "FF15 0E0F0000", "call", "qword ptr ds:[<&MessageBoxA>]"),
  i("1400010F2", "33C0", "xor", "eax,eax"),
  i("1400010F4", "EB 12", "jmp", "vault.140001108"),
  i("1400010F6", "48:8D0D 43210000", "lea", "rcx,qword ptr ds:[140003240]", '140003240:"Access denied."'),
  i("1400010FD", "FF15 CD100000", "call", "qword ptr ds:[<&puts>]"),
  i("140001103", "B8 01000000", "mov", "eax,1"),
  i("140001108", "48:83C4 58", "add", "rsp,58"),
  i("14000110C", "C3", "ret"),
  ...int3(0x14000110d, 0x14000110f),
  // printf (an inline UCRT wrapper compiled into the program)
  i("140001110", "48:894C24 08", "mov", "qword ptr ss:[rsp+8],rcx"),
  i("140001115", "48:895424 10", "mov", "qword ptr ss:[rsp+10],rdx"),
  i("14000111A", "4C:894424 18", "mov", "qword ptr ss:[rsp+18],r8"),
  i("14000111F", "4C:894C24 20", "mov", "qword ptr ss:[rsp+20],r9"),
  i("140001124", "48:83EC 38", "sub", "rsp,38"),
  i("140001128", "48:8D4424 48", "lea", "rax,qword ptr ss:[rsp+48]"),
  i("14000112D", "48:894424 28", "mov", "qword ptr ss:[rsp+28],rax"),
  i("140001132", "B9 01000000", "mov", "ecx,1"),
  i("140001137", "FF15 8B100000", "call", "qword ptr ds:[<&__acrt_iob_func>]"),
  i("14000113D", "48:8B4C24 28", "mov", "rcx,qword ptr ss:[rsp+28]"),
  i("140001142", "48:894C24 20", "mov", "qword ptr ss:[rsp+20],rcx"),
  i("140001147", "45:33C9", "xor", "r9d,r9d"),
  i("14000114A", "4C:8B4424 40", "mov", "r8,qword ptr ss:[rsp+40]"),
  i("14000114F", "48:8BD0", "mov", "rdx,rax"),
  i("140001152", "33C9", "xor", "ecx,ecx"),
  i("140001154", "FF15 8E100000", "call", "qword ptr ds:[<&__stdio_common_vfprintf>]"),
  i("14000115A", "48:83C4 38", "add", "rsp,38"),
  i("14000115E", "C3", "ret"),
  ...int3(0x14000115f, 0x14000116f),
];

/** vault.exe paused on the first instruction of main (run-wrong recording). */
export const vaultAtMain: z.input<typeof Snapshot> = {
  windowTitle: "vault.exe - PID: 2F18 - Module: vault.exe - Thread: Main Thread 1C4C - x64dbg",
  rip: "0000000140001070",
  registers: [
    { name: "RAX", value: "0000000000000001" },
    { name: "RBX", value: "0000000000000000" },
    { name: "RCX", value: "0000000000000001" },
    { name: "RDX", value: "00000000002A3F80" },
    { name: "RBP", value: "0000000000000000" },
    { name: "RSP", value: "000000000014FEC8" },
    { name: "RSI", value: "0000000000000000" },
    { name: "RDI", value: "0000000000000000" },
    { name: "R8", value: "00000000002A41F0" },
    { name: "R9", value: "0000000000000000" },
    { name: "R10", value: "0000000000000000" },
    { name: "R11", value: "0000000000000246" },
    { name: "R12", value: "0000000000000000" },
    { name: "R13", value: "0000000000000000" },
    { name: "R14", value: "0000000000000000" },
    { name: "R15", value: "0000000000000000" },
  ],
  rflags: "0000000000000246",
  flags: [
    { name: "ZF", value: 1 },
    { name: "PF", value: 1 },
    { name: "AF", value: 0 },
    { name: "OF", value: 0 },
    { name: "SF", value: 0 },
    { name: "DF", value: 0 },
    { name: "CF", value: 0 },
    { name: "TF", value: 0 },
    { name: "IF", value: 1 },
  ],
  disassembly,
  disassemblyTopOffset: 4,
  dump: {
    base: "0000000140003200",
    bytes: [
      "3D 3D 20 50 49 52 45 20 56 41 55 4C 54 20 3D 3D",
      "00 00 00 00 45 6E 74 65 72 20 63 6F 64 65 3A 20",
      "00 00 00 00 0A 00 00 00 50 49 52 45 00 00 00 00",
      "56 61 75 6C 74 20 6F 70 65 6E 65 64 21 00 00 00",
      "41 63 63 65 73 73 20 64 65 6E 69 65 64 2E 00 00",
      "00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00",
      "00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00",
      "00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00",
    ].join(" "),
  },
  rsp: "000000000014FEC8",
  stack: [
    { address: "000000000014FEC8", value: "00000001400013AC", comment: "return to vault.__scrt_common_main_seh+10C" },
    { address: "000000000014FED0", value: "0000000000000000" },
    { address: "000000000014FED8", value: "0000000000000000" },
    { address: "000000000014FEE0", value: "0000000000000000" },
    { address: "000000000014FEE8", value: "00000001400014DE", comment: "return to vault.mainCRTStartup+E" },
    { address: "000000000014FEF0", value: "0000000000000000" },
    { address: "000000000014FEF8", value: "00007FFE1C9A7344", comment: "return to kernel32.BaseThreadInitThunk+14" },
    { address: "000000000014FF00", value: "0000000000000000" },
    { address: "000000000014FF08", value: "0000000000000000" },
    { address: "000000000014FF10", value: "0000000000000000" },
    { address: "000000000014FF18", value: "0000000000000000" },
    { address: "000000000014FF20", value: "0000000000000000" },
    { address: "000000000014FF28", value: "00007FFE1E7C26B1", comment: "return to ntdll.RtlUserThreadStart+21" },
    { address: "000000000014FF30", value: "0000000000000000" },
  ],
  status: { state: "Paused", message: "" },
};

export const vaultSource: SourceFile = {
  name: "vault.c",
  code: [
    "#include <stdio.h>",
    "#include <string.h>",
    "#include <windows.h>",
    "",
    'static const char *SECRET = "opensesame";',
    "int g_attempts = 0;",
    "",
    "int check_code(const char *input)",
    "{",
    "    g_attempts++;",
    "    return strcmp(input, SECRET) == 0;",
    "}",
    "",
    "int main(void)",
    "{",
    "    char buffer[32];",
    "",
    '    puts("== PIRE VAULT ==");',
    '    printf("Enter code: ");',
    "    if (!fgets(buffer, sizeof buffer, stdin))",
    "        return 1;",
    '    buffer[strcspn(buffer, "\\n")] = 0;',
    "",
    "    if (check_code(buffer)) {",
    '        MessageBoxA(NULL, "Vault opened!", "PIRE", MB_OK);',
    "        return 0;",
    "    }",
    "",
    '    puts("Access denied.");',
    "    return 1;",
    "}",
  ].join("\n"),
  regions: {
    check_code: [8, 12],
    main: [14, 31],
    "main.puts": [18, 18],
  },
};
