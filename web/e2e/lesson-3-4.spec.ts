import { expect, test, type Page } from "@playwright/test";
import { choose, expectComplete, guide, proceed, shot, startLesson, target } from "./helpers";

async function fill(page: Page, values: Record<string, string>) {
  const card = page.getByTestId("fill-card");
  for (const [label, value] of Object.entries(values)) await card.getByLabel(label, { exact: true }).selectOption(value);
  await card.getByRole("button", { name: "Check" }).click();
}
const V = "Volatile";
const N = "Nonvolatile";

test("lesson 3.4: volatile and nonvolatile registers", async ({ page }) => {
  await startLesson(page, "m3.l4");
  await expect(page.getByTestId("window-title")).toContainText("calls-release.exe");
  await shot(page, "34-01-shout");
  await proceed(page);
  await fill(page, { RAX: V, RBX: N, RCX: V, RDI: N, R8: V, RSI: N, R11: V, R12: N });
  await proceed(page);
  await choose(page, /^B A nonvolatile one$/);
  await proceed(page);
  await expect(guide(page).getByRole("heading", { name: "Watch it survive" })).toBeVisible();
  await page.keyboard.press("F8");
  await expect(guide(page).getByRole("heading", { name: "Which ones changed?" })).toBeVisible();
  await shot(page, "34-02-changed");
  await target(page, "reg:RBX").click();
  await expect(guide(page)).toContainText("still holds i");
  for (const r of ["RAX", "RCX", "RDX", "R8", "R9", "R10", "R11"]) await target(page, "reg:" + r).click();
  await proceed(page);
  await target(page, "disasm:0000000140001060").click();
  await target(page, "disasm:0000000140001065").click();
  await proceed(page);
  await target(page, "disasm:0000000140001087").click();
  await target(page, "disasm:0000000140001090").click();
  await proceed(page);
  await shot(page, "34-03-shortcut");
  await fill(page, { "EDI holds": "times", "EBX holds": "i" });
  await choose(page, /^A ECX is volatile/);
  await proceed(page);
  await fill(page, { RAX: V, RBX: N, RCX: V, RSI: N, R9: V, R12: N, R11: V, RDI: N });
  await choose(page, /^B RSI$/);
  await expect(guide(page).getByRole("heading", { name: "Spot the bookkeeping" })).toBeVisible();
  await shot(page, "34-04-main");
  for (const a of ["1230", "1235", "123A", "12C9", "12CE", "12D9"]) await target(page, "disasm:000000014000" + a).click();
  await choose(page, /^B RBX, RBP/);
  await expectComplete(page);
});
