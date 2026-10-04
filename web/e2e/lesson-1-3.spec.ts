import { expect, test } from "@playwright/test";
import { choose, expectComplete, guide, proceed, shot, startLesson, target } from "./helpers";

const TEST_ROW = "disasm:00000001400010D5";
const G_ATTEMPTS = "0000000140005040";

test("lesson 1.3: line, API, and hardware breakpoints", async ({ page }) => {
  await startLesson(page, "m1.l3");
  await proceed(page);

  await target(page, TEST_ROW).click();
  await page.keyboard.press("F2");
  await expect(guide(page)).toContainText("A red address");
  await proceed(page);
  await page.keyboard.press("F9");
  await expect(page.getByTestId("status-message")).toContainText("INT3 breakpoint");
  await shot(page, "13-01-f2-hit");
  await proceed(page);

  await guide(page).getByLabel("Your answer").fill("0");
  await guide(page).getByRole("button", { name: "Check" }).click();
  await proceed(page);
  await expect(page.getByTestId("figure")).toContainText("With F2 setCCC0");
  await proceed(page);

  // A new run: type the API breakpoint, then F9 straight from the command bar.
  await expect(page.getByTestId("banner")).toContainText("opensesame");
  const cmd = page.getByRole("textbox", { name: "Command" });
  await cmd.fill("bp MessageBoxA");
  await cmd.press("Enter");
  await expect(guide(page)).toContainText("looked up MessageBoxA");
  await proceed(page);
  await page.keyboard.press("F9");
  await expect(page.getByTestId("status-message")).toContainText("INT3 breakpoint");
  await page.keyboard.press("F9");
  await expect(page.locator("[data-pane='registers']")).toContainText("Vault opened!");
  await shot(page, "13-02-messagebox");
  await proceed(page);
  await choose(page, /first instruction/);
  await proceed(page);

  // Ctrl+G in the dump, then a hardware breakpoint from the context menu.
  await target(page, "dump:byte:0000000140003200").click();
  await page.keyboard.press("Control+g");
  const goto = page.getByRole("dialog", { name: "Enter expression" });
  await goto.getByLabel("Expression").fill("g_attempts");
  await goto.getByLabel("Expression").press("Enter");
  await expect(target(page, "dump:byte:" + G_ATTEMPTS)).toBeVisible();
  await proceed(page);

  await target(page, "dump:byte:" + G_ATTEMPTS).click({ button: "right" });
  await page.getByRole("menuitem", { name: /^Breakpoint/ }).hover();
  await page.getByRole("menuitem", { name: /^Hardware, Write/ }).hover();
  await shot(page, "13-03-menu");
  await page.getByRole("menuitem", { name: "Dword" }).click();
  await proceed(page);

  await page.keyboard.press("F9");
  await expect(page.getByTestId("status-message")).toContainText("Hardware breakpoint");
  await shot(page, "13-04-hw-hit");
  await proceed(page);

  await target(page, "bp:software:00000001400010D5").click();
  await page.keyboard.press("Space");
  await shot(page, "13-05-bp-tab");
  await proceed(page);
  await target(page, "bp:hardware:" + G_ATTEMPTS).click();
  await page.keyboard.press("Delete");
  await expect(target(page, "bp:hardware:" + G_ATTEMPTS)).toHaveCount(0);
  await proceed(page);

  for (const answer of [/^B bp with/, /^C Hardware/, /^A F2/]) await choose(page, answer);
  await proceed(page);
  await choose(page, "On the line after the mov.");
  await proceed(page);
  await choose(page, "The breakpoint never fires.");
  await proceed(page);
  await expectComplete(page);
});
