import { describe, expect, it } from "vitest";
import { getFile, getLesson } from "@pire/content";
import { initialState, reduce, type PlayerEvent, type PlayerState } from "./lesson";

const go = { type: "continue" } as const;
const click = (target: string) => ({ type: "click", target }) as const;

describe("lesson 2.5", () => {
  const lesson = getLesson("m2.l5")!;
  const run = (s: PlayerState, ...events: PlayerEvent[]) => events.reduce((acc, e) => reduce(lesson, acc, e), s);
  it("plays through", () => {
    let s = initialState(lesson);
    expect(s.session.tool).toBe("pe");
    s = run(s, go, click("pe:field:dos.e_lfanew"), go);
    s = run(s, click("pe:node:file"), click("pe:field:file.Machine"), click("pe:field:file.NumberOfSections"));
    s = run(s, click("pe:node:opt"), click("pe:field:opt.Magic"), click("pe:field:opt.AddressOfEntryPoint"));
    expect(s.lesson.phase).toBe("asking");
    s = run(s, click("pe:field:opt.ImageBase"), go);
    expect(s.session.peNode).toBe("opt");
    s = run(s, { type: "choose", id: "3" });
    expect(s.lesson.feedback?.tone).toBe("wrong");
    s = run(s, { type: "choose", id: "2" }, go);
    expect(s.session.peNode).toBe("sections");
    s = run(s, click("pe:sec:.text:Characteristics"), go);
    s = run(s, click("pe:imp:USER32.dll"), click("pe:imp:USER32.dll:MessageBoxA"), go, go);
    s = run(s, { type: "choose", id: "sections" }, go);
    s = run(s, { type: "fill", values: { arch: "64-bit", subsystem: "Console", aslr: "Yes", sections: "4", dll: "USER32.dll", entry: "0x1200" } });
    expect(s.lesson.unfilled).toEqual(["aslr"]);
    s = run(s, { type: "fill", values: { arch: "64-bit", subsystem: "Console", aslr: "No", sections: "4", dll: "USER32.dll", entry: "0x1200" } });
    expect(s.lesson.done).toBe(true);
  });
});

describe("module 2 challenge", () => {
  const lesson = getLesson("m2.challenge")!;
  const run = (s: PlayerState, ...events: PlayerEvent[]) => events.reduce((acc, e) => reduce(lesson, acc, e), s);
  it("has the travelers the design asks for", () => {
    const c = getFile("traveler-c");
    const pire = c.sections.find((x) => x.name === ".pire")!;
    expect(String.fromCharCode(...c.bytes.slice(pire.rawPtr, pire.rawPtr + 23))).toBe("pire-flag: border-agent");
    expect(getFile("traveler-b").imageBase + BigInt(getFile("traveler-b").entry)).toBe(0x4014d0n);
  });
  it("plays through with the file tabs", () => {
    let s = initialState(lesson);
    expect(s.session.file).toBe("traveler-a");
    s = run(s, { type: "fill", values: { arch: "64-bit", subsystem: "GUI", aslr: "Yes", entry: "1490", sections: "5" } }, go);
    s = run(s, click("file:traveler-b"));
    expect(s.session.file).toBe("traveler-b");
    s = run(s, { type: "fill", values: { arch: "32-bit", subsystem: "Console", aslr: "No", entry: "14D0", sections: "3" } }, go);
    s = run(s, { type: "fill", values: { arch: "64-bit", subsystem: "Console", aslr: "Yes", entry: "1360", sections: "6" } }, go);
    s = run(s, { type: "predict", value: "1400014D0" });
    expect(s.lesson.feedback?.text).toMatch(/64-bit ImageBase/);
    s = run(s, { type: "predict", value: "4014D0" }, go, { type: "choose", id: "files" }, go);
    s = run(s, click("tool:hex"));
    expect(s.session.tool).toBe("hex");
    s = run(s, { type: "fill", values: { offset: "1600", flag: "pire-flag: border-agent" } }, go, { type: "choose", id: "a" }, go);
    expect(s.lesson.done).toBe(true);
  });
});

