import { vaultRecordings } from "./program";

export { vaultSource } from "./source";
export { vaultRecordings };

const LABELS = ["check_code","check_code.store","check_code.secret","check_code.strcmp","check_code.ret","main","main.banner","main.puts","main.prompt","main.printf","main.fgets","main.trim","main.check","main.test","main.messagebox","main.denied","main.end","main.ret","printf","printf.vfprintf","printf.ret","__security_init_cookie","cookie.ret","__scrt_common_main_seh","scrt.argc","scrt.callmain","scrt.aftermain","scrt.exit","mainCRTStartup","entry.jmp"] as const;
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
