import { expect, test, type Page } from "@playwright/test";
import { expectComplete, guide, proceed, shot, startLesson, target } from "./helpers";

const MAIN = "0000000140001050";
const CALL_VERIFY = "00000001400010A3";
const STRCMP_CALL = "0000000140001030";
const G_TRIES = "0000000140005030";

async function menu(page: Page, id: string, ...items: string[]) {
  await target(page, id).click({ button: "right" });
  for (const item of items.slice(0, -1)) await page.getByRole("menuitem", { name: new RegExp("^" + item) }).hover();
  await page.getByRole("menuitem", { name: items.at(-1)! }).last().click();
}
async function command(page: Page, text: string) {
  const box = page.getByRole("textbox", { name: "Command" });
  await box.fill(text);
  await box.press("Enter");
}
async function answer(page: Page, value: string) {
  await guide(page).getByLabel("Your answer").fill(value);
  await guide(page).getByRole("button", { name: "Check" }).click();
}

test("module 1 challenge: the vault, with one hint", async ({ page }) => {
  await startLesson(page, "m1.challenge");
  await expect(page.getByText("Source unlocks when you finish")).toBeVisible();
  await expect(page.getByTestId("goal-1")).toContainText("Find main");

  // Goal 1, with one hint token spent.
  await guide(page).getByRole("button", { name: "Spend one" }).click();
  await expect(guide(page)).toContainText("Which two routes");
  await expect(page.getByLabel("2 hint tokens left")).toBeVisible();
  await shot(page, "c1-01-start");
  await page.keyboard.press("F9");
  await menu(page, "disasm:0000000140001200", "Search for", "Current Module", "String references");
  await target(page, "ref:0000000140001054").dblclick();
  await target(page, "disasm:" + MAIN).click();
  await page.keyboard.press("F2");
  await page.keyboard.press("F9");
  await expect(guide(page)).toContainText("Found main");
  await proceed(page);

  // Goal 2 to 5: into verify, follow RCX, then RDX at the strcmp call.
  await target(page, "disasm:" + CALL_VERIFY).click();
  await page.keyboard.press("F4");
  await page.keyboard.press("F7");
  await proceed(page);
  await menu(page, "reg:RCX", "Follow in Dump");
  await proceed(page);
  await target(page, "disasm:" + STRCMP_CALL).click();
  await page.keyboard.press("F4");
  await menu(page, "reg:RDX", "Follow in Dump");
  await shot(page, "c1-02-secret");
  await proceed(page);
  await answer(page, "pirate42");
  await proceed(page);

  // Goal 6 and 7: hardware breakpoint on the counter, restart, run into it.
  await page.keyboard.press("Control+F2");
  await command(page, "bph " + G_TRIES + ",w,4");
  for (let i = 0; i < 3; i++) await page.keyboard.press("F9");
  await expect(page.getByTestId("status-message")).toContainText("Hardware breakpoint");
  await proceed(page);
  await answer(page, "140005030");
  await proceed(page);

  // Goal 8: the right run.
  await expect(page.getByTestId("banner")).toContainText("pirate42");
  await command(page, "bp MessageBoxA");
  for (let i = 0; i < 5; i++) {
    if (await guide(page).getByText("The vault is open").isVisible()) break;
    await page.keyboard.press("F9");
  }
  await expect(guide(page)).toContainText("The vault is open");
  await shot(page, "c1-03-open");
  await proceed(page);

  const done = await expectComplete(page);
  await expect(done.getByTestId("medal")).toContainText("Silver");
  await expect(done.getByTestId("source-card")).toContainText("g_tries > 3");
  await shot(page, "c1-04-complete");
});
