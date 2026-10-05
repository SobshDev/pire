import { expect, test } from "@playwright/test";
import { answer, byte, choose, expectComplete, guide, order, proceed, selectBytes, shot, startLesson } from "./helpers";

test("lesson 2.1: walking vault.exe from MZ to the section table", async ({ page }) => {
  await startLesson(page, "m2.l1");
  await expect(page.getByTestId("window-title")).toContainText("pire hex viewer - vault.exe");
  await shot(page, "21-01-hex");
  await guide(page).getByRole("button", { name: /Start reading/ }).click();

  await byte(page, 0).click();
  await expect(page.getByRole("complementary", { name: "Guide" })).toContainText("DOS header");
  await shot(page, "21-02-mz");
  await proceed(page);

  await answer(page, "F8000000");
  await expect(guide(page)).toContainText("Flip");
  await answer(page, "F8");
  await proceed(page);

  await page.keyboard.press("Control+g");
  await page.getByRole("textbox", { name: "Expression" }).fill("F8");
  await page.keyboard.press("Enter");
  await shot(page, "21-03-jump");
  await byte(page, 0xf8).click();
  await proceed(page);

  await selectBytes(page, 0xfc, 2);
  await expect(page.getByTestId("le-value")).toContainText("0x8664");
  await shot(page, "21-04-machine");
  await proceed(page);
  await choose(page, /x64/);
  await proceed(page);
  await answer(page, "4");
  await proceed(page);
  await selectBytes(page, 0x110, 2);
  await proceed(page);
  await selectBytes(page, 0x120, 4);
  await expect(page.getByTestId("le-value")).toContainText("0x1200");
  await proceed(page);
  await choose(page, /offset from where/);
  await proceed(page);

  for (const off of [0x200, 0x228, 0x250, 0x278]) await byte(page, off + 1).click();
  await shot(page, "21-05-sections");
  await proceed(page);
  await proceed(page);

  await order(page, ["DOS header", "DOS stub", "PE signature", "File header", "Optional header", "Section table", "Section data"]);
  const card = page.getByTestId("fill-card");
  await card.getByLabel("Machine").selectOption("x64");
  await card.getByLabel("Magic").selectOption("PE32+");
  await card.getByLabel("Sections").fill("4");
  await card.getByLabel("Entry point (RVA)").fill("1200");
  await card.getByLabel("ImageBase").fill("140000000");
  await shot(page, "21-06-passport");
  await card.getByRole("button", { name: "Check" }).click();
  await choose(page, /32-bit x86/);
  await proceed(page);
  await choose(page, ".text");
  await choose(page, ".rdata");
  await choose(page, ".data");
  await expectComplete(page);
  await shot(page, "21-07-done");
});
