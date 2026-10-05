import { getRecording } from "@pire/content";
import { vault } from "@pire/content/src/specimens/vault";
import { describe, expect, it } from "vitest";
import { moduleOf } from "../../engine/debugger";
import { ripLine, tokenize } from "./SourceView";

const rowsOf = (id: string, address: string) => moduleOf(getRecording(id), address)!.rows;

describe("ripLine", () => {
  it("finds the C line and its instructions from the line table", () => {
    expect(ripLine(rowsOf("vault.wrong", vault["main.banner"]), vault["main.puts"])).toEqual({
      line: 18,
      first: vault["main.banner"],
      last: vault["main.puts"],
      count: 2,
    });
    expect(ripLine(rowsOf("vault.wrong", vault.main), vault.main)?.line).toBe(15);
    expect(ripLine(rowsOf("vault.wrong", vault["check_code.ret"]), vault["check_code.ret"])?.line).toBe(12);
  });

  it("has no line outside the program's own code", () => {
    expect(ripLine(rowsOf("vault.wrong", vault.printf), vault.printf)).toBeNull();
  });
});

describe("tokenize", () => {
  it("splits keywords, strings, and preprocessor lines", () => {
    expect(tokenize('    puts("== PIRE VAULT ==");')).toEqual([
      { text: "    puts(", kind: "plain" },
      { text: '"== PIRE VAULT =="', kind: "string" },
      { text: ");", kind: "plain" },
    ]);
    expect(tokenize("int x = sizeof buffer;").filter((t) => t.kind === "keyword").map((t) => t.text)).toEqual(["int", "sizeof"]);
    expect(tokenize("#include <stdio.h>")).toEqual([{ text: "#include <stdio.h>", kind: "comment" }]);
  });
});
