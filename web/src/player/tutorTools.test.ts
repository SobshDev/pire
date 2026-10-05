import { readFileSync } from "node:fs";
import { getLesson, getRecording } from "@pire/content";
import { tutorLessonsJson } from "@pire/content/src/tutor";
import { describe, expect, it } from "vitest";
import { initialState, reduce, type PlayerEvent, type PlayerState } from "../engine/lesson";
import { runTool, snapshot, type TutorContext } from "./tutorTools";

const lesson = getLesson("m1.l2")!;
const rec = getRecording("vault.wrong");
const go = { type: "continue" } as const;
const key = (k: string): PlayerEvent => ({ type: "key", key: k, ripOffscreen: false, selected: null });
const step = (s: PlayerState, ...events: PlayerEvent[]) => events.reduce((acc, e) => reduce(lesson, acc, e), s);

function context(s: PlayerState, pointed: string[] = []): TutorContext {
  return { lesson, state: s.lesson, rec, session: s.session, misses: 0, point: (t) => (pointed.push(t), true), showSource() {} };
}

// After lea rcx,[140003200]: RCX points at the banner string.
const afterLea = step(initialState(lesson), { type: "choose", id: "no" }, go, key("F8"), go, { type: "click", target: "reg:RCX" }, go, key("F8"));

describe("tutor tools", () => {
  it("read_memory follows a register to the bytes it points at", () => {
    const r = runTool("read_memory", { address: "RCX", length: 32 }, context(afterLea));
    expect("output" in r && r.output).toContain('string: "== PIRE VAULT =="');
    expect("output" in r && r.output.split("\n")[0]).toMatch(/^0000000140003200  3D 3D 20/);
  });

  it("disassemble starts at RIP and marks it", () => {
    const r = runTool("disassemble", { count: 3 }, context(afterLea));
    expect("output" in r && r.output).toMatch(/^(<[^>]+>\n)?RIP> /);
  });

  it("bad expressions and unknown targets come back as errors", () => {
    expect(runTool("read_memory", { address: "not a thing" }, context(afterLea))).toHaveProperty("error");
    expect(runTool("point_at", { target: "reg:RZZ" }, context(afterLea))).toHaveProperty("error");
    expect(runTool("point_at", { target: "disasm:0000000000000001" }, context(afterLea))).toHaveProperty("error");
    expect(runTool("nope", {}, context(afterLea))).toHaveProperty("error");
  });

  it("point_at lights up real targets", () => {
    const pointed: string[] = [];
    const rip = rec.states[afterLea.session.index]!.rip;
    expect(runTool("point_at", { target: "reg:RCX" }, context(afterLea, pointed))).toEqual({ output: "ok" });
    expect(runTool("point_at", { target: "flag:ZF" }, context(afterLea, pointed))).toEqual({ output: "ok" });
    expect(runTool("point_at", { target: "disasm:" + rip }, context(afterLea, pointed))).toEqual({ output: "ok" });
    expect(pointed).toEqual(["reg:RCX", "flag:ZF", "disasm:" + rip]);
  });

  it("describe_value names what a value points at", () => {
    const r = runTool("describe_value", { expression: "RCX" }, context(afterLea));
    expect("output" in r && r.output).toContain("== PIRE VAULT ==");
  });

  it("the snapshot shows the step, registers and code, and stays small", () => {
    const text = snapshot(context(afterLea));
    expect(text).toContain("lesson m1.l2");
    expect(text).toMatch(/RCX 0000000140003200  "== PIRE VAULT ==" \(changed\)/);
    expect(text).toContain("RIP> ");
    expect(text.length).toBeLessThanOrEqual(6002);
  });
});

describe("tutor lesson export", () => {
  it("api/tutor/lessons.json is up to date (run bun run export:tutor)", () => {
    const file = readFileSync(new URL("../../../api/tutor/lessons.json", import.meta.url), "utf8");
    expect(file === tutorLessonsJson()).toBe(true);
  });
});
