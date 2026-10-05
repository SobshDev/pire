import { expect, test } from "@playwright/test";
import { answer, choose, expectComplete, proceed, shot, startLesson, target } from "./helpers";

async function fill(page: import("@playwright/test").Page, values: Record<string, string>) {
  const card = page.getByTestId("fill-card");
  for (const [label, value] of Object.entries(values)) await card.getByLabel(label).fill(value);
  await card.getByRole("button", { name: "Check" }).click();
}

test("lesson 2.2: file offsets, RVAs, VAs, and ASLR", async ({ page }) => {
  await startLesson(page, "m2.l2");
  await expect(page.getByTestId("diagram-rulers")).toBeVisible();
  await shot(page, "22-01-rulers");
  await proceed(page);

  await expect(page.getByTestId("window-title")).toContainText("x64dbg");
  await answer(page, "1070");
  await proceed(page);
  await answer(page, "140001200");
  await proceed(page);
  await expect(page.getByTestId("diagram-alignment")).toBeVisible();
  await shot(page, "22-02-alignment");
  await proceed(page);

  await choose(page, ".rdata");
  await proceed(page);
  await answer(page, "1A50");
  await proceed(page);
  await expect(page.getByTestId("selection")).toContainText("Offset 0x1A50");
  await shot(page, "22-03-opensesame");
  await proceed(page);

  await fill(page, { "main, VA 0x140001070, file offset": "470", "File offset 0x3000, VA": "140005000" });
  await proceed(page);
  await expect(page.getByTestId("converter")).toBeVisible();
  await choose(page, "The last four hex digits");
  await shot(page, "22-04-aslr");
  await proceed(page);

  await target(page, "file:vault").click();
  await expect(page.getByTestId("window-title")).toContainText("vault.exe");
  await choose(page, /vault-aslr.exe, DllCharacteristics/);
  await proceed(page);
  await expect(page.getByTestId("selection")).toContainText("8 bytes");
  await shot(page, "22-05-secret");
  await choose(page, /Windows must fix it/);
  await proceed(page);

  const conv = page.getByTestId("converter");
  await conv.getByLabel("VA", { exact: true }).fill("140001110");
  await expect(conv.getByLabel("File offset")).toHaveValue("510");
  await fill(page, { "VA 0x140001110 to RVA": "1110", "RVA 0x3200 to file offset": "1A00", "File offset 0x420 to VA": "140001020" });
  await choose(page, /RVA 0x1530/);
  await choose(page, /8-byte pointer/);
  await proceed(page);
  await expectComplete(page);
});
