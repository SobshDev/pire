import { callsRecordings } from "./program";

export { callsSource } from "./source";
export { callsRecordings };

/** Code addresses in calls.exe, by label, such as calls.main or calls["main.sum6"]. */
export const calls: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_, label: string) {
    const a = callsRecordings().at[label];
    if (!a) throw new Error("calls has no label " + label);
    return a;
  },
});

