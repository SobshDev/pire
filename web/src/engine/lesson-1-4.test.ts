import { describe, expect, it } from "vitest";
import { getLesson, getRecording } from "@pire/content";
import { rspAt, sym, vault } from "@pire/content/src/specimens/vault";
import { big, readByte, readString, stateOf } from "./debugger";
import { initialState, reduce, type PlayerEvent, type PlayerState } from "./lesson";

const lesson = getLesson("m1.l4")!;
const rec = getRecording("vault.wrong");
const go = { type: "continue" } as const;
const key = (k: string, selected: string | null = null): PlayerEvent => ({ type: "key", key: k, ripOffscreen: false, selected });
const step = (s: PlayerState, ...events: PlayerEvent[]) => events.reduce((acc, e) => reduce(lesson, acc, e), s);
const st = (s: PlayerState) => stateOf(rec, s.session);
const predict = (value: string) => ({ type: "predict", value }) as const;
const choose = (id: string) => ({ type: "choose", id }) as const;

describe("lesson 1.4", () => {
  it("plays through with what the text promises", () => {
    let s = initialState(lesson);
    expect(st(s).rip).toBe(vault.check_code);

    s = step(s, choose("address"), go, { type: "menu", target: "reg:RCX", item: "follow-dump" });
    expect(readString(rec, s.session.index, big(s.session.dump))).toBe("hello");
    expect(big(s.session.dump) - big(st(s).regs.RSP!)).toBeLessThan(0x100n);

    s = step(s, go, choose("close"), go, key("F4", "disasm:" + vault["check_code.secret"]));
    expect(st(s).rip).toBe(vault["check_code.secret"]);
    expect(st(s).info?.[0]).toContain("140003250");

    s = step(s, go, key("F8"));
    expect(st(s).regs.RDX).toBe("0000000140003250");
    s = step(s, go, { type: "menu", target: "reg:RDX", item: "follow-dump" });
    expect(readString(rec, s.session.index, big(s.session.dump))).toBe("opensesame");

    s = step(s, go);
    expect(s.session.dump).toBe(sym.g_attempts);
    expect(readByte(rec, s.session.index, big(sym.g_attempts))).toBe(1);
    s = step(s, predict("1"), go, predict("1000"), go);

    const ret = "stack:" + rspAt("check_code");
    s = step(s, { type: "menu", target: ret, item: "follow-disasm" });
    expect(s.session.view).toBe(vault["main.test"]);
    s = step(s, go, key("*"));
    expect(s.session.view).toBeNull();

    s = step(s, go, choose("dump"), choose("disasm"), choose("disasm"), go);
    s = step(s, predict("42"), go, predict("256"), go, choose("data"), choose("rdata"), go);
    expect(s.lesson.done).toBe(true);
    expect(s.lesson.mistakes).toBe(0);
  });

  it("catches left-to-right reading", () => {
    const s = step(initialState(lesson, { stepIndex: 6 }), predict("16777216"));
    expect(s.lesson.feedback?.text).toMatch(/left to right/);
  });
});
