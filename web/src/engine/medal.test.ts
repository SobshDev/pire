import { describe, expect, it } from "vitest";
import { bestMedal, savedMedal } from "./lesson";

describe("challenge medals", () => {
  it("keeps the best medal across replays", () => {
    expect(bestMedal("gold", "bronze")).toBe("gold");
    expect(bestMedal("silver", "gold")).toBe("gold");
    expect(bestMedal(undefined, "bronze")).toBe("bronze");
  });

  it("reads saved medals, and falls back to hintsUsed only for completed saves", () => {
    expect(savedMedal({ medal: "silver", hintsUsed: 0 }, false)).toBe("silver");
    expect(savedMedal({ hintsUsed: 3 }, true)).toBe("bronze");
    expect(savedMedal({ hintsUsed: 0 }, false)).toBeUndefined();
  });
});
