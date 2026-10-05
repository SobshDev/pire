import { expect, test } from "@playwright/test";
import { choose, expectComplete, guide, order, proceed, selectBytes, shot, startLesson, target } from "./helpers";

test("lesson 2.3: imports, the IAT, and exports", async ({ page }) => {
  await startLesson(page, "m2.l3");
  await choose(page, /stored at that memory location/);
  await proceed(page);

  await expect(page.getByTestId("window-title")).toContainText("PE viewer - vault.exe");
  await target(page, "pe:imp:USER32.dll").click();
  await expect(page.getByTestId("import-funcs")).toContainText("MessageBoxA");
  await target(page, "pe:imp:api-ms-win-crt-stdio-l1-1-0.dll").click();
  await expect(page.getByTestId("import-funcs")).toContainText("__stdio_common_vfprintf");
  await shot(page, "23-01-imports");
  await proceed(page);
  await choose(page, /defined in a header/);
  await proceed(page);

  await selectBytes(page, 0x8c0, 8);
  await expect(page.getByTestId("le-value")).toContainText("0x446C");
  await proceed(page);
  await page.getByTestId("converter").getByLabel("RVA", { exact: true }).fill("446C");
  await expect(page.getByTestId("converter").getByLabel("File offset")).toHaveValue("2C6C");
  await page.keyboard.press("Control+g");
  await page.getByRole("textbox", { name: "Expression" }).fill("2C6C");
  await page.keyboard.press("Enter");
  await shot(page, "23-02-hintname");
  await proceed(page);

  await expect(page.locator("[data-pane='dump']")).toContainText("104A2F1AFE7F");
  await shot(page, "23-03-iat-memory");
  await choose(page, /inside ucrtbase/);
  await proceed(page);
  await choose(page, /loader needs import names/);
  await proceed(page);

  await page.getByLabel("Search exports").fill("MessageBox");
  await target(page, "pe:exp:MessageBoxA").click();
  await shot(page, "23-04-exports");
  await proceed(page);
  await target(page, "pe:node:opt").first().click();
  await target(page, "pe:field:dd.Export.VirtualAddress").click();
  await proceed(page);

  const card = page.getByTestId("fill-card");
  await card.getByLabel("MessageBoxA is imported from").selectOption("USER32.dll");
  await card.getByLabel("puts is imported from").selectOption("api-ms-win-crt-stdio-l1-1-0.dll");
  await card.getByLabel("puts really lives in").selectOption("ucrtbase.dll");
  await card.getByRole("button", { name: "Check" }).click();
  await order(page, [
    "The loader reads the import name",
    "The loader finds MessageBoxA in user32's exports",
    "The loader writes the address into the IAT slot",
    "main runs call qword ptr [slot]",
    "The CPU jumps into user32",
  ]);
  await choose(page, /temp folder/);
  await expect(guide(page)).toContainText("GetProcAddress");
  await proceed(page);
  await expectComplete(page);
});

