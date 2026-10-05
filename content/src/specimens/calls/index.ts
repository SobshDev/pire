import { callsRecordings } from "./program";

export { callsSource } from "./source";
export { callsRecordings };

const LABELS = [
  "add",
  "add.load",
  "add.add",
  "add.ret",
  "sum6",
  "sum6.e",
  "sum6.f",
  "sum6.ret",
  "scale",
  "scale.sub",
  "scale.body",
  "scale.x",
  "scale.call",
  "scale.after",
  "scale.epilogue",
  "scale.ret",
  "shout",
  "shout.inc",
  "shout.check",
  "shout.lea",
  "shout.puts",
  "shout.done",
  "shout.ret",
  "mix",
  "mix.a",
  "mix.sum",
  "mix.ret",
  "main",
  "main.sub",
  "main.n",
  "main.add.edx",
  "main.add.ecx",
  "main.add",
  "main.r1",
  "main.sum6.f",
  "main.sum6.e",
  "main.sum6.d",
  "main.sum6.c",
  "main.sum6.b",
  "main.sum6.a",
  "main.sum6",
  "main.r2",
  "main.scale.ecx",
  "main.scale",
  "main.r3",
  "main.mix.d",
  "main.mix.c",
  "main.mix.b",
  "main.mix.a",
  "main.mix",
  "main.r4",
  "main.shout",
  "main.r5",
  "main.printf.args",
  "main.printf",
  "main.epilogue",
  "main.ret",
  "printf",
  "mainCRTStartup",
  "scrt.callmain",
] as const;
export type CallsLabel = (typeof LABELS)[number];

/** Code addresses in calls.exe, by label, such as calls.main or calls["main.sum6"]. */
export const calls = (() => {
  const at = callsRecordings().at;
  return Object.fromEntries(
    LABELS.map((l) => {
      const a = at[l];
      if (!a) throw new Error("calls has no label " + l);
      return [l, a];
    }),
  ) as Record<CallsLabel, string>;
})();

