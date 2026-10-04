import { vault2Recordings } from "./program";

export { vault2Source } from "./source";
export { vault2Recordings };

/** Code and data addresses in vault2.exe, for lesson checks. */
export const vault2 = (() => {
  const v = vault2Recordings();
  const sym = (name: string) => {
    const s = v.wrong.symbols.find((x) => x.name === name);
    if (!s) throw new Error("vault2 has no symbol " + name);
    return s.address;
  };
  const at = (label: string) => {
    const a = v.at[label];
    if (!a) throw new Error("vault2 has no label " + label);
    return a;
  };
  return {
    main: at("main"),
    verify: at("verify"),
    callVerify: at("main.check"),
    strcmpCall: at("verify.strcmp"),
    store: at("verify.store"),
    g_tries: sym("g_tries"),
    SECRET: sym("SECRET"),
    MessageBoxA: sym("MessageBoxA"),
  } as const;
})();

