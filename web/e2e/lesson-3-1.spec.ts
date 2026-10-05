import { expect, test } from "@playwright/test";
import { choose, expectComplete, guide, order, proceed, shot, startLesson, target } from "./helpers";

const answer = async (page: import("@playwright/test").Page, value: string) => {
  await guide(page).getByLabel("Your answer").fill(value);
  await guide(page).getByRole("button", { name: "Check" }).click();
};

test("lesson 3.1: arguments and return values", async ({ page }) => {
  await startLesson(page, "m3.l1");
  await expect(page.getByTestId("window-title")).toContainText("calls.exe");
  await shot(page, "31-01-start");
  await choose(page, /^B RCX$/);
  await proceed(page);
  await order(page, ["RCX", "RDX", "R8", "R9"]);
  await proceed(page);

  const card = page.getByTestId("fill-card");
  await card.getByLabel("a", { exact: true }).fill("3");
  await card.getByLabel("b", { exact: true }).fill("5");
  await card.getByRole("button", { name: "Check" }).click();
  await proceed(page);
  await answer(page, "3");
  await proceed(page);
  await answer(page, "8");
  await proceed(page);
  await page.keyboard.press("F8");
  await expect(target(page, "reg:RAX")).toContainText("0000000000000008");
  await shot(page, "31-02-return");
  await proceed(page);

  await target(page, "disasm:0000000140001008").click();
  await target(page, "disasm:000000014000100C").click();
  await proceed(page);
  for (const a of ["000000014000127B", "0000000140001276", "0000000140001270", "000000014000126A"]) await target(page, "disasm:" + a).click();
  await proceed(page);
  await target(page, "disasm:000000014000125A").click();
  await target(page, "disasm:0000000140001266").click();
  await proceed(page);
  await target(page, "stack:000000000014FE90").click();
  await target(page, "stack:000000000014FE98").click();
  await shot(page, "31-03-stack");
  await proceed(page);
  await page.keyboard.press("F8");
  await expect(target(page, "reg:RAX")).toContainText("0000000000000013");
  await proceed(page);

  await choose(page, /\(rbx, a stack buffer, 16\)/);
  await choose(page, /\[rsp\+20\]/);
  await answer(page, "2");
  await choose(page, /^B RAX$/);
  await expectComplete(page);
});
