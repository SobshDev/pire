import { expect, test } from "@playwright/test";
import { choose, expectComplete, guide, proceed, shot, startLesson, target } from "./helpers";

const MAIN = "disasm:0000000140001070";
const CALL_MAIN = "disasm:00000001400011DE";

test("lesson 1.5: finding main two ways without symbols", async ({ page }) => {
  await startLesson(page, "m1.l5");
  await expect(page.getByTestId("status-message")).toContainText("System breakpoint");
  await shot(page, "15-01-system-bp");
  await page.keyboard.press("F9");
  await expect(page.getByTestId("status-message")).toContainText("entry breakpoint");
  await proceed(page);
  await choose(page, /no symbols/);
  await proceed(page);

  await target(page, "disasm:0000000140001200").click({ button: "right" });
  await page.getByRole("menuitem", { name: /^Search for/ }).hover();
  await page.getByRole("menuitem", { name: /^Current Module/ }).hover();
  await page.getByRole("menuitem", { name: "String references" }).last().click();
  await expect(page.locator("[data-pane='tabview']")).toContainText("Enter code:");
  await shot(page, "15-02-references");
  await proceed(page);

  await target(page, "ref:0000000140001081").dblclick();
  await proceed(page);
  await target(page, MAIN).click();
  await proceed(page);
  await page.keyboard.press("F2");
  await page.keyboard.press("F9");
  await expect(page.getByTestId("status-message")).toContainText("INT3 breakpoint");
  await proceed(page);
  await page.keyboard.press("Control+F2");
  await proceed(page);

  await expect(page.getByTestId("banner")).toContainText("skipped the system breakpoint");
  for (let i = 0; i < 3; i++) await page.keyboard.press("F8");
  await page.keyboard.press("F7");
  await expect(guide(page)).toContainText("__scrt_common_main_seh");
  await proceed(page);

  await target(page, CALL_MAIN).scrollIntoViewIfNeeded();
  await shot(page, "15-03-startup");
  await target(page, CALL_MAIN).click();
  await proceed(page);
  await page.keyboard.press("F4");
  await page.keyboard.press("F7");
  await expect(page.locator("[data-target='reg:RIP']")).toContainText("140001070");
  await proceed(page);
  await proceed(page);

  for (const label of ["System breakpoint (ntdll.dll)", "Entry point (vault.exe)", "Startup routine", "main"]) {
    await guide(page).getByRole("button", { name: label, exact: true }).click();
  }
  await proceed(page);
  await choose(page, /^B Route B/);
  await proceed(page);
  await choose(page, /app\.140001350/);
  await proceed(page);
  await expectComplete(page);
});
