import { peFileFor } from "../msvc";
import { vaultSpec } from "./program";

/** vault.exe as a file on disk (fixed base), and the ASLR build Lesson 2.2 compares it with. */
export const vaultPe = peFileFor(vaultSpec, { aslr: false });
export const vaultAslrPe = peFileFor(vaultSpec, { aslr: true });

