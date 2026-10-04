import { expect, type Page } from "@playwright/test";

const shots = process.env.PIRE_SHOTS;
export const shot = async (page: Page, name: string) => {
  if (!shots) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: shots + "/" + name + ".png" });
};

export const target = (page: Page, id: string) => page.locator("[data-target='" + id + "']");
export const guide = (page: Page) => page.getByRole("complementary", { name: "Guide" });
export const proceed = (page: Page) => guide(page).getByRole("button", { name: /Continue/ }).click();
export const choose = (page: Page, label: string | RegExp) => guide(page).getByRole("button", { name: label }).click();

/** Creates a fresh account and opens a lesson. */
export async function startLesson(page: Page, id: string) {
  await page.goto("/register");
  await page.getByLabel("Display name").fill("Tester");
  await page.getByLabel("Email").fill("e2e-" + id + "-" + Date.now() + "@pire.test");
  await page.getByLabel("Password", { exact: true }).fill("correct horse battery");
  await page.getByLabel("Confirm password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/learn/" + id);
  await expect(guide(page)).toBeVisible();
}

export async function expectComplete(page: Page) {
  const done = page.getByRole("dialog", { name: "Lesson complete" });
  await expect(done).toBeVisible();
  return done;
}
