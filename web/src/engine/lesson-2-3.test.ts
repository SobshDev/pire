import { describe, expect, it } from "vitest";
import { getFile, getLesson, getRecording, readLE, rvaToOffset } from "@pire/content";
import { vault } from "@pire/content/src/specimens/vault";
import { readQword, rowAt, symbolize } from "./debugger";
import { initialState, reduce, type PlayerEvent, type PlayerState } from "./lesson";

const lesson = getLesson("m2.l3")!;
const pe = getFile("vault");
const rec = getRecording("vault-stripped.wrong");
const go = { type: "continue" } as const;
const run = (s: PlayerState, ...events: PlayerEvent[]) => events.reduce((acc, e) => reduce(lesson, acc, e), s);
const puts = pe.imports.flatMap((i) => i.funcs).find((f) => f.name === "puts")!;
const hex16 = (v: bigint) => v.toString(16).toUpperCase().padStart(16, "0");

describe("lesson 2.3", () => {
  it("tells the truth about the IAT", () => {
    expect(rowAt(rec, vault["main.puts"])!.row.operands).toBe("qword ptr ds:[<&puts>]");
    // The call's rel32 lands on puts's IAT slot.
    const bytes = rowAt(rec, vault["main.puts"])!.row.bytes.replace(/[: ]/g, "");
    const le = bytes.slice(4).match(/../g)!.reverse().join("");
    const rel = BigInt.asIntN(32, BigInt("0x" + le));
    expect(BigInt("0x" + vault["main.puts"]) + 6n + rel).toBe(pe.imageBase + BigInt(puts.slot));
    // On disk: the slot holds the RVA of a hint/name record ending in "puts".
    const slotOff = rvaToOffset(pe, puts.slot)!;
    expect(Number(readLE(pe, slotOff, 8))).toBe(puts.hintName);
    const nameOff = rvaToOffset(pe, puts.hintName)!;
    expect(String.fromCharCode(...pe.bytes.slice(nameOff + 2, nameOff + 6))).toBe("puts");
    // In memory at the entry breakpoint: ucrtbase's puts.
    const entry = rec.states.findIndex((s) => s.rip === vault.mainCRTStartup);
    const loaded = readQword(rec, entry, pe.imageBase + BigInt(puts.slot))!;
    expect(symbolize(rec, hex16(loaded))).toBe("ucrtbase.puts");
    // user32's export RVA plus its base is where MessageBoxA really is.
    const mb = getFile("user32").exports.find((e) => e.name === "MessageBoxA")!;
    expect(symbolize(rec, hex16(0x7ffe1c3b0000n + BigInt(mb.rva)))).toBe("user32.MessageBoxA");
    expect(pe.dataDirs[0]!.rva).toBe(0);
    expect(pe.imports.flatMap((i) => i.funcs.map((f) => f.name))).not.toContain("printf");
  });

  it("plays through", () => {
    let s = initialState(lesson);
    expect(s.session.tool).toBe("x64dbg");
    s = run(s, { type: "choose", id: "read" }, go);
    expect(s.session.tool).toBe("pe");
    s = run(s, { type: "click", target: "pe:imp:USER32.dll" });
    expect(s.session.peField).toBe("imp:USER32.dll");
    s = run(s, { type: "click", target: "pe:imp:api-ms-win-crt-stdio-l1-1-0.dll" }, go);
    s = run(s, { type: "choose", id: "inline" }, go);
    expect(s.session.tool).toBe("hex");
    const slotOff = rvaToOffset(pe, puts.slot)!;
    s = run(s, { type: "select", start: slotOff, length: 8 }, go);
    s = run(s, { type: "key", key: "Ctrl+G", ripOffscreen: false, selected: null });
    s = run(s, { type: "command", surface: "goto", text: rvaToOffset(pe, puts.hintName)!.toString(16) }, go);
    expect(s.session.tool).toBe("x64dbg");
    s = run(s, { type: "choose", id: "loaded" }, go, { type: "choose", id: "loader" }, go);
    expect(s.session.file).toBe("user32");
    s = run(s, { type: "click", target: "pe:exp:MessageBoxW" });
    expect(s.lesson.feedback?.tone).toBe("wrong");
    s = run(s, { type: "click", target: "pe:exp:MessageBoxA" }, go);
    s = run(s, { type: "click", target: "pe:node:opt" }, { type: "click", target: "pe:field:dd.Export.VirtualAddress" }, go);
    s = run(s, { type: "fill", values: { msgbox: "USER32.dll", puts: "api-ms-win-crt-stdio-l1-1-0.dll", lives: "ucrtbase.dll" } });
    for (const item of (lesson.steps[s.lesson.stepIndex]!.gate as { items: string[] }).items) s = run(s, { type: "order", label: item });
    s = run(s, { type: "choose", id: "temp" }, go);
    expect(s.lesson.done).toBe(true);
  });
});

