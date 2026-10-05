import { describe, expect, it } from "vitest";
import { getFile, getLesson, readLE, where } from "@pire/content";
import { vault } from "@pire/content/src/specimens/vault";
import { initialState, reduce, type PlayerEvent, type PlayerState } from "./lesson";

const lesson = getLesson("m2.l1")!;
const pe = getFile("vault");
const go = { type: "continue" } as const;
const run = (s: PlayerState, ...events: PlayerEvent[]) => events.reduce((acc, e) => reduce(lesson, acc, e), s);
const click = (off: number): PlayerEvent => ({ type: "click", target: "hex:" + off.toString(16).toUpperCase() });
const select = (id: string): PlayerEvent => ({ type: "select", start: where(pe, id).offset, length: where(pe, id).size });
const text = (off: number, len: number) => String.fromCharCode(...pe.bytes.slice(off, off + len));

describe("lesson 2.1", () => {
  it("reads true facts from vault.exe's bytes", () => {
    expect(text(0, 2)).toBe("MZ");
    expect(Number(readLE(pe, 0x3c, 4))).toBe(pe.lfanew);
    expect(text(pe.lfanew, 4)).toBe("PE\0\0");
    expect(readLE(pe, where(pe, "file.Machine").offset, 2)).toBe(0x8664n);
    expect(Number(readLE(pe, where(pe, "file.NumberOfSections").offset, 2))).toBe(pe.sections.length);
    expect(readLE(pe, where(pe, "opt.Magic").offset, 2)).toBe(0x20bn);
    expect(where(pe, "opt.AddressOfEntryPoint").offset - where(pe, "opt.Magic").offset).toBe(0x10);
    // The entry point in the file is the entry breakpoint Module 1 stopped at.
    expect((pe.imageBase + readLE(pe, where(pe, "opt.AddressOfEntryPoint").offset, 4)).toString(16).toUpperCase().padStart(16, "0")).toBe(vault.mainCRTStartup);
    expect(text(0x40, 0x60)).toContain("This program cannot be run in DOS mode.");
    expect(pe.sections.map((s) => s.name)).toEqual([".text", ".rdata", ".data", ".pdata"]);
  });

  it("plays through", () => {
    let s = initialState(lesson);
    expect(s.session.tool).toBe("hex");
    s = run(s, go, click(0x40));
    expect(s.lesson.feedback?.tone).toBe("wrong");
    s = run(s, click(1), go);
    s = run(s, { type: "predict", value: "F8000000" });
    expect(s.lesson.feedback?.text).toMatch(/Flip/);
    s = run(s, { type: "predict", value: "0xF8" }, go);
    s = run(s, { type: "key", key: "Ctrl+G", ripOffscreen: false, selected: null });
    expect(s.session.goto).toBe("hex");
    s = run(s, { type: "command", surface: "goto", text: "f8" });
    expect(s.session.hexSel).toEqual([0xf8, 1]);
    expect(s.lesson.keys).toContain("Ctrl+G");
    s = run(s, click(0xf9), go);
    expect(s.session.helper).toBe(true);
    // A one-byte click is just looking; a wrong 2-byte selection is a miss.
    s = run(s, { type: "select", start: 0xfc, length: 1 });
    expect(s.lesson.feedback).toBeNull();
    s = run(s, { type: "select", start: 0xfd, length: 2 });
    expect(s.lesson.feedback?.tone).toBe("wrong");
    s = run(s, select("file.Machine"), go, { type: "choose", id: "x64" }, go);
    s = run(s, { type: "predict", value: String(pe.sections.length) }, go);
    s = run(s, select("opt.Magic"), go, select("opt.AddressOfEntryPoint"), go, { type: "choose", id: "relative" }, go);
    expect(s.session.hexTop).toBe(where(pe, "sec.text.Name").offset);
    for (const sec of pe.sections) s = run(s, click(where(pe, "sec" + sec.name + ".Name").offset + 2));
    expect(s.lesson.phase).toBe("success");
    s = run(s, go, go);
    for (const item of ["DOS header", "DOS stub", "PE signature", "File header", "Optional header", "Section table", "Section data"]) s = run(s, { type: "order", label: item });
    s = run(s, { type: "fill", values: { machine: "x64", magic: "PE32+", sections: "4", entry: "1200", base: "0x140000000" } });
    expect(lesson.steps[s.lesson.stepIndex]?.title).toBe("A different file");
    s = run(s, { type: "choose", id: "x86" }, go, { type: "choose", id: "text" }, { type: "choose", id: "rdata" }, { type: "choose", id: "data" });
    expect(s.lesson.done).toBe(true);
  });

  it("marks wrong passport fields and keeps the right ones", () => {
    let s = initialState(lesson, { stepIndex: lesson.steps.findIndex((x) => x.gate.type === "fill") });
    s = run(s, { type: "fill", values: { machine: "x64", magic: "PE32", sections: "4", entry: "140001200", base: "140000000" } });
    expect(s.lesson.unfilled.sort()).toEqual(["entry", "magic"]);
    expect(Object.keys(s.lesson.filled).sort()).toEqual(["base", "machine", "sections"]);
  });
});
