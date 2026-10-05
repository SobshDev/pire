import { expect, test, type Page } from "@playwright/test";
import { choose, expectComplete, guide, proceed, shot, startLesson, target } from "./helpers";

const N = "(none)";
const I32 = "32-bit integer";
const I64 = "64-bit integer";

/** Fills the prototype builder: a return type and up to six arguments. Fields already marked right stay locked. */
async function prototype(page: Page, ret: string, ...args: string[]) {
  const card = page.getByTestId("fill-card");
  const values: [string, string][] = [["Returns", ret], ...[0, 1, 2, 3, 4, 5].map((i): [string, string] => ["Argument " + (i + 1), args[i] ?? N])];
  for (const [label, value] of values) {
    const field = card.getByLabel(label, { exact: true });
    if (await field.isEnabled()) await field.selectOption(value);
  }
  await card.getByRole("button", { name: "Check" }).click();
}
/** Continues to the next goal and waits for its fresh prototype builder. */
const next = async (page: Page) => {
  await proceed(page);
  await expect(page.getByTestId("fill-card").getByLabel("Returns", { exact: true })).toBeEnabled();
};

test("module 3 challenge: call site detective", async ({ page }) => {
  await startLesson(page, "m3.challenge");
  await expect(page.getByTestId("window-title")).toContainText("calls2.exe");
  await expect(target(page, "disasm:000000014000128A")).toContainText("call calls2.0000000140001000");
  await shot(page, "3c-01-start");
  await prototype(page, I32, I32, I32);
  await expect(guide(page)).toContainText("doesn't match");
  await prototype(page, I32, I32, I32, I32);
  await next(page);
  await prototype(page, "void", "pointer", "8-bit integer", I32);
  await next(page);
  await prototype(page, "double", "double", "double", "double");
  await next(page);
  await target(page, "disasm:00000001400012F9").click();
  await page.keyboard.press("F4");
  await shot(page, "3c-02-pick");
  await prototype(page, I64, I32, I64, I32, I32, I32, I64);
  await next(page);
  await prototype(page, "float", "float", "float", "float");
  await next(page);
  await prototype(page, I32, "pointer", I32, "pointer");
  await proceed(page);
  await choose(page, /^B At \[rsp\+24\]/);
  await proceed(page);
  await expectComplete(page);
  await shot(page, "3c-03-debrief");
});
