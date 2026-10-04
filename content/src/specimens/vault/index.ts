import { vaultRecordings } from "./program";

export { vaultSource } from "./source";
export { vaultRecordings };

const LABELS = ["check_code","check_code.load","check_code.store","check_code.secret","check_code.strcmp","check_code.ret","main","main.banner","main.puts","main.prompt","main.printf","main.fgets","main.trim","main.check","main.test","main.messagebox","main.denied","main.end","main.ret","printf","printf.vfprintf","printf.ret","__security_init_cookie","cookie.ret","__scrt_common_main_seh","scrt.argc","scrt.callmain","scrt.aftermain","scrt.exit","mainCRTStartup","entry.jmp"] as const;
export type VaultLabel = (typeof LABELS)[number];

/** Code addresses lessons point at, such as vault.main or vault["main.check"]. */
export const vault: Readonly<Record<VaultLabel, string>> = (() => {
  const at = vaultRecordings().at;
  return Object.fromEntries(
    LABELS.map((name) => {
      const address = at[name];
      if (!address) throw new Error("vault has no label " + name);
      return [name, address];
    }),
  ) as Record<VaultLabel, string>;
})();

/** RSP the first time the run reaches a label, for pointing at stack slots such as a return address. */
export function rspAt(label: VaultLabel, run: "wrong" | "right" = "wrong"): string {
  const rec = vaultRecordings()[run];
  const state = rec.states.find((s) => s.rip === vault[label]);
  if (!state) throw new Error("the " + run + " run never reaches " + label);
  return state.regs.RSP!;
}

/** Addresses of rows in the vault listing whose operands contain some text, such as "<&__p___argc>". */
export function rowsMentioning(text: string): string[] {
  return vaultRecordings()
    .wrong.modules[0]!.rows.filter((r) => r.operands.includes(text))
    .map((r) => r.address);
}
