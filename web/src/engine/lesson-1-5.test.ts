import { describe, expect, it } from "vitest";
import { getLesson, getRecording } from "@pire/content";
import { vault } from "@pire/content/src/specimens/vault";
import { stateOf, symbolize } from "./debugger";
import { initialState, reduce, type PlayerEvent, type PlayerState } from "./lesson";

const lesson = getLesson("m1.l5")!;
const rec = getRecording("vault-stripped.wrong");
const go = { type: "continue" } as const;
const key = (k: string, selected: string | null = null): PlayerEvent => ({ type: "key", key: k, ripOffscreen: false, selected });
const step = (s: PlayerState, ...events: PlayerEvent[]) => events.reduce((acc, e) => reduce(lesson, acc, e), s);
const st = (s: PlayerState) => stateOf(rec, s.session);

describe("lesson 1.5", () => {
  it("plays through with what the text promises", () => {
    let s = initialState(lesson);
    expect(s.session.message).toMatch(/System breakpoint/);
    s = step(s, key("F9"));
    expect(s.session.message).toMatch(/entry breakpoint/);
    expect(st(s).rip).toBe(vault.mainCRTStartup);
    expect(symbolize(rec, vault.main)).not.toMatch(/main/);

    s = step(s, go, { type: "choose", id: "pdb" }, go, { type: "menu", target: "disasm:" + st(s).rip, item: "search-strings" });
    expect(s.session.tab).toBe("References");
    expect(rec.strings.map((x) => x.address)).toContain(vault["main.prompt"]);

    s = step(s, go, { type: "dblclick", target: "ref:" + vault["main.prompt"] });
    expect(s.session.view).toBe(vault["main.prompt"]);
    expect(s.session.tab).toBe("CPU");

    s = step(s, go, { type: "click", target: "disasm:" + vault.main }, go, key("F2", "disasm:" + vault.main), key("F9"));
    expect(st(s).rip).toBe(vault.main);
    s = step(s, go, key("Ctrl+F2"));
    expect(s.session.index).toBe(0);

    s = step(s, go);
    expect(st(s).rip).toBe(vault.mainCRTStartup);
    s = step(s, key("F8"), key("F8"), key("F8"));
    expect(st(s).rip).toBe(vault["entry.jmp"]);
    expect(s.lesson.phase).toBe("asking");
    s = step(s, key("F7"));
    expect(s.lesson.phase).toBe("success");

    s = step(s, go, { type: "click", target: "disasm:" + vault["scrt.argc"] });
    expect(s.lesson.feedback?.text).toMatch(/__p___argc/);
    s = step(s, { type: "click", target: "disasm:" + vault["scrt.callmain"] }, go, key("F4", "disasm:" + vault["scrt.callmain"]), key("F7"));
    expect(st(s).rip).toBe(vault.main);

    s = step(s, go, go);
    for (const label of ["System breakpoint (ntdll.dll)", "Entry point (vault.exe)", "Startup routine", "main"]) s = step(s, { type: "order", label });
    s = step(s, go, { type: "choose", id: "b" }, go, { type: "choose", id: "main" }, go);
    expect(s.lesson.done).toBe(true);
    expect(s.lesson.mistakes).toBe(1);
    expect(s.lesson.keys).toEqual(["Ctrl+F2"]);
  });
});
