import { expect, test, type Page } from "@playwright/test";
import { choose, expectComplete, guide, proceed, shot, startLesson, target } from "./helpers";

const answer = async (page: Page, value: string) => {
  await guide(page).getByLabel("Your answer").fill(value);
  await guide(page).getByRole("button", { name: "Check" }).click();
};
async function fill(page: Page, values: Record<string, string>) {
  const card = page.getByTestId("fill-card");
  for (const [label, value] of Object.entries(values)) await card.getByLabel(label, { exact: true }).selectOption(value);
  await card.getByRole("button", { name: "Check" }).click();
}

test("lesson 3.2: shadow space and stack alignment", async ({ page }) => {
  await startLesson(page, "m3.l2");
  await proceed(page);
  for (const a of ["70", "78", "80", "88"]) await target(page, "stack:000000000014FE" + a).click();
  await shot(page, "32-01-shadow");
  await proceed(page);
  await expect(page.getByTestId("frame")).toContainText("return address into main");
  await choose(page, /holds the return address/);
  await proceed(page);
  await fill(page, { "14FE40": "Aligned", "14FE48": "Not aligned", "14FE30": "Aligned", "14FE38": "Not aligned" });
  await proceed(page);
  await answer(page, "28");
  await proceed(page);
  await choose(page, /38 \+ 8 = 40/);
  await proceed(page);
  await fill(page, {
    "rsp to rsp+18": "Shadow space for add",
    "rsp+20": "doubled",
    "rsp+28 and rsp+30": "Padding",
    "rsp+38": "Return address to main",
    "rsp+40": "x, in scale's home slot",
  });
  await shot(page, "32-02-draw");
  await proceed(page);
  await choose(page, /RSP moved down/);
  await proceed(page);
  await answer(page, "28");
  await expect(guide(page).getByRole("heading", { name: "With a push" })).toBeVisible();
  await answer(page, "20");
  await choose(page, /^B \[rsp\+28\]$/);
  await choose(page, /It calls nothing/);
  await proceed(page);
  await expectComplete(page);
});
