import { describe, expect, it } from "vitest";
import { getFile, getLesson, getRecording, readLE, rvaToOffset, where } from "@pire/content";
import { vault } from "@pire/content/src/specimens/vault";
import { rowAt } from "./debugger";
import { initialState, reduce, type PlayerEvent, type PlayerState } from "./lesson";

const lesson = getLesson("m2.l2")!;
const pe = getFile("vault");
const aslr = getFile("vault-aslr");
const go = { type: "continue" } as const;
const run = (s: PlayerState, ...events: PlayerEvent[]) => events.reduce((acc, e) => reduce(lesson, acc, e), s);
const text = (off: number, len: number) => String.fromCharCode(...pe.bytes.slice(off, off + len));

describe("lesson 2.2", () => {
  it("converts addresses to the right bytes", () => {
    // "opensesame" at RVA 0x3250 is at file offset 0x1A50.
    expect(rvaToOffset(pe, 0x3250)).toBe(0x1a50);
    expect(text(0x1a50, 10)).toBe("opensesame");
    // main at RVA 0x1070 is at file offset 0x470, and the bytes match x64dbg's first instruction.
    expect(rvaToOffset(pe, 0x1070)).toBe(0x470);
    const first = rowAt(getRecording("vault-stripped.wrong"), vault.main)!.row.bytes.replace(/[: ]/g, "");
    expect(Array.from(pe.bytes.slice(0x470, 0x470 + first.length / 2), (b) => b.toString(16).toUpperCase().padStart(2, "0")).join("")).toBe(first);
    // File offset 0x3000 starts .data, which holds SECRET: a pointer to the string's preferred VA.
    expect(readLE(pe, 0x3000, 8)).toBe(0x140003250n);
    expect(pe.dllChars & 0x40).toBe(0);
    expect(aslr.dllChars & 0x40).toBe(0x40);
    expect(pe.sections.some((s) => s.name === ".reloc")).toBe(false);
    // vault-aslr's .reloc has one DIR64 entry, for SECRET at RVA 0x5000.
    const reloc = aslr.sections.find((s) => s.name === ".reloc")!;
    expect(Number(readLE(aslr, reloc.rawPtr, 4))).toBe(0x5000);
    expect(Number(readLE(aslr, reloc.rawPtr + 8, 2))).toBe(0xa000);
    expect(where(pe, "opt.DllCharacteristics").offset - where(pe, "opt.Magic").offset).toBe(0x46);
  });

  it("plays through", () => {
    let s = initialState(lesson);
    s = run(s, go);
    expect(s.session.tool).toBe("x64dbg");
    s = run(s, { type: "predict", value: "140001070" });
    expect(s.lesson.feedback?.text).toMatch(/VA/);
    s = run(s, { type: "predict", value: "1070" }, go, { type: "predict", value: "0x140001200" }, go);
    expect(s.session.tool).toBe("hex");
    s = run(s, go, { type: "choose", id: "rdata" }, go, { type: "predict", value: "1A50" }, go);
    expect(s.session.hexSel).toEqual([0x1a50, 10]);
    s = run(s, go, { type: "fill", values: { main: "470", data: "140005000" } }, go);
    expect(s.session.converter).toBe(true);
    expect(s.session.file).toBe("vault-aslr");
    s = run(s, { type: "choose", id: "low" }, go, { type: "click", target: "file:vault" });
    expect(s.session.file).toBe("vault");
    s = run(s, { type: "choose", id: "aslr" }, go);
    expect(s.session.file).toBe("vault-aslr");
    expect(s.session.hexSel).toEqual([0x3000, 8]);
    s = run(s, { type: "choose", id: "fix" }, go);
    s = run(s, { type: "fill", values: { va: "1110", rva: "1A00", off: "140001020" } });
    s = run(s, { type: "choose", id: "rva" }, { type: "choose", id: "ptr" }, go);
    expect(s.lesson.done).toBe(true);
  });
});

