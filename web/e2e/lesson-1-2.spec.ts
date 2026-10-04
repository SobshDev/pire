import { expect, test } from "@playwright/test";
import { choose, expectComplete, guide, proceed, shot, startLesson, target } from "./helpers";

const MAIN_CHECK = "disasm:00000001400010D0";

test("lesson 1.2: stepping, escaping printf, and running to the end", async ({ page }) => {
  await startLesson(page, "m1.l2");
  await choose(page, "No, it runs when I step.");
  await proceed(page);

  await page.keyboard.press("F8");
  await expect(guide(page)).toContainText("RSP dropped by 0x58");
  await shot(page, "12-01-f8");
  await proceed(page);

  await target(page, "reg:RCX").click();
  await proceed(page);
  await page.keyboard.press("F8");
  await expect(page.locator("[data-pane='registers']")).toContainText("PIRE VAULT");
  await proceed(page);

  await page.keyboard.press("F8");
  await expect(page.getByTestId("console")).toContainText("== PIRE VAULT ==");
  await shot(page, "12-02-puts");
  await proceed(page);
  await page.keyboard.press("F8");
  await proceed(page);

  // F8 here is a near miss: the guide asks for F7.
  await page.keyboard.press("F8");
  await expect(guide(page)).toContainText("press F7");
  await page.keyboard.press("F7");
  await shot(page, "12-03-printf");
  await proceed(page);
  await page.keyboard.press("Control+F9");
  await proceed(page);
  await page.keyboard.press("F8");
  await expect(page.getByTestId("console")).toContainText("Enter code:");
  await proceed(page);

  await target(page, MAIN_CHECK).click();
  await page.keyboard.press("F4");
  await expect(page.getByTestId("console")).toContainText("Enter code: hello");
  await proceed(page);
  await page.keyboard.press("F7");
  await expect(page.locator("[data-pane='stack']")).toContainText("vault.main+65");
  await shot(page, "12-04-check-code");
  await proceed(page);
  await page.keyboard.press("F9");
  await expect(page.getByTestId("console")).toContainText("Access denied.");
  await proceed(page);

  for (const answer of [/^A F7$/, /^B F8$/, /^D Ctrl\+F9, then F8$/, /^C F4/]) await choose(page, answer);
  await proceed(page);
  await target(page, "reg:RAX").click();
  await proceed(page);
  await choose(page, "At the breakpoint inside the function.");
  await proceed(page);

  await expectComplete(page);
  await shot(page, "12-05-complete");
});
