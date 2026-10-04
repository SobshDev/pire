import { expect, test, type Page } from "@playwright/test";
import { choose, expectComplete, guide, proceed, shot, startLesson, target } from "./helpers";

async function menu(page: Page, id: string, item: string) {
  await target(page, id).click({ button: "right" });
  await page.getByRole("menuitem", { name: item }).click();
}
async function answer(page: Page, value: string) {
  await guide(page).getByLabel("Your answer").fill(value);
  await guide(page).getByRole("button", { name: "Check" }).click();
}

test("lesson 1.4: following pointers to the secret", async ({ page }) => {
  await startLesson(page, "m1.l4");
  await choose(page, /address of the text/);
  await proceed(page);

  await menu(page, "reg:RCX", "Follow in Dump");
  await expect(page.locator("[data-pane='dump']")).toContainText("hello");
  await shot(page, "14-01-rcx");
  await proceed(page);
  await choose(page, "Close to RSP.");
  await proceed(page);

  await target(page, "disasm:0000000140001017").click();
  await page.keyboard.press("F4");
  await expect(page.getByTestId("infobox")).toContainText("140003250");
  await shot(page, "14-02-infobox");
  await proceed(page);
  await page.keyboard.press("F8");
  await proceed(page);
  await menu(page, "reg:RDX", "Follow in Dump");
  await expect(page.locator("[data-pane='dump']")).toContainText("opensesame");
  await proceed(page);

  await answer(page, "16777216");
  await expect(guide(page)).toContainText("left to right");
  await answer(page, "1");
  await proceed(page);
  await answer(page, "1000");
  await proceed(page);

  await menu(page, "stack:" + "000000000014FE68", "Follow in Disassembler");
  await shot(page, "14-03-follow-disasm");
  await proceed(page);
  await page.keyboard.press("*");
  await proceed(page);

  for (const a of [/^A Follow in Dump$/, /^B Follow in Disassembler$/, /^B Follow in Disassembler$/]) await choose(page, a);
  await proceed(page);
  await answer(page, "42");
  await proceed(page);
  await answer(page, "256");
  await proceed(page);
  await choose(page, /^A \.data$/);
  await choose(page, /^B \.rdata$/);
  await proceed(page);
  await expectComplete(page);
});
