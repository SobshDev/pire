import { expect, test, type Page } from "@playwright/test";
import { choose, expectComplete, guide, proceed, shot, startLesson, target } from "./helpers";

async function fill(page: Page, values: Record<string, string>) {
  const card = page.getByTestId("fill-card");
  for (const [label, value] of Object.entries(values)) {
    const field = card.getByLabel(label, { exact: true });
    if ((await field.evaluate((el) => el.tagName)) === "SELECT") await field.selectOption(value);
    else await field.fill(value);
  }
  await card.getByRole("button", { name: "Check" }).click();
}

test("lesson 2.5: using a PE viewer", async ({ page }) => {
  await startLesson(page, "m2.l5");
  await expect(page.getByTestId("window-title")).toContainText("PE viewer - vault.exe");
  await proceed(page);
  await target(page, "pe:field:dos.e_lfanew").click();
  await shot(page, "25-01-dos");
  await proceed(page);

  await target(page, "pe:node:file").first().click();
  await target(page, "pe:field:file.Machine").click();
  await target(page, "pe:field:file.NumberOfSections").click();
  await target(page, "pe:node:opt").first().click();
  await target(page, "pe:field:opt.Magic").click();
  await target(page, "pe:field:opt.AddressOfEntryPoint").click();
  await target(page, "pe:field:opt.ImageBase").click();
  await proceed(page);

  await expect(target(page, "pe:field:opt.Subsystem")).toContainText("Windows console");
  await choose(page, /2, Windows GUI/);
  await proceed(page);
  await target(page, "pe:sec:.text:Characteristics").click();
  await expect(page.getByTestId("section-flags")).toContainText("execute");
  await shot(page, "25-02-sections");
  await proceed(page);
  await target(page, "pe:imp:USER32.dll").click();
  await target(page, "pe:imp:USER32.dll:MessageBoxA").click();
  await proceed(page);
  await expect(guide(page)).toContainText("ASLR or not?");
  await shot(page, "25-03-checklist");
  await proceed(page);

  await choose(page, /NumberOfSections 5/);
  await proceed(page);
  await fill(page, { Architecture: "64-bit", Subsystem: "Console", ASLR: "No", "Number of sections": "4", "DLL that shows the message box": "USER32.dll", "Entry point RVA": "1200" });
  await expectComplete(page);
});

test("module 2 challenge: passport control", async ({ page }) => {
  await startLesson(page, "m2.challenge");
  await expect(page.getByTestId("window-title")).toContainText("PE viewer - traveler-a.exe");
  await shot(page, "2c-01-start");
  await fill(page, { Architecture: "64-bit", Subsystem: "GUI", ASLR: "Yes", "Entry point RVA": "1490", "Number of sections": "5" });
  await proceed(page);

  await target(page, "file:traveler-b").click();
  await expect(page.getByTestId("window-title")).toContainText("traveler-b.exe");
  await fill(page, { Architecture: "32-bit", Subsystem: "Console", ASLR: "No", "Entry point RVA": "14D0", "Number of sections": "3" });
  await proceed(page);
  await target(page, "file:traveler-c").click();
  await target(page, "pe:node:sections").first().click();
  await expect(page.locator("[data-pane='pedetail']")).toContainText(".pire");
  await shot(page, "2c-02-traveler-c");
  await fill(page, { Architecture: "64-bit", Subsystem: "Console", ASLR: "Yes", "Entry point RVA": "1360", "Number of sections": "6" });
  await proceed(page);

  await guide(page).getByLabel("Your answer").fill("4014D0");
  await guide(page).getByRole("button", { name: "Check" }).click();
  await proceed(page);
  await choose(page, /temp folder/);
  await proceed(page);

  await target(page, "tool:hex").click();
  await page.keyboard.press("Control+g");
  await page.getByRole("textbox", { name: "Expression" }).fill("1600");
  await page.keyboard.press("Enter");
  await shot(page, "2c-03-flag");
  await fill(page, { "File offset of the section": "1600", "String at its start": "pire-flag: border-agent" });
  await proceed(page);
  await choose(page, /^A traveler-a$/);
  await proceed(page);
  await expectComplete(page);
  await shot(page, "2c-04-debrief");
});
