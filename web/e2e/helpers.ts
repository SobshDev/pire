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

const hx = (n: number) => n.toString(16).toUpperCase();
/** A byte in the hex viewer's hex column. */
export const byte = (page: Page, off: number) => target(page, "hex:" + hx(off)).first();

/** Drags across bytes in the hex viewer, like a learner selecting a field. */
export async function selectBytes(page: Page, from: number, length: number) {
  const a = await byte(page, from).boundingBox();
  const b = await byte(page, from + length - 1).boundingBox();
  if (!a || !b) throw new Error("bytes not on screen");
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 });
  await page.mouse.up();
}

export async function answer(page: Page, value: string) {
  await guide(page).getByLabel("Your answer").fill(value);
  await guide(page).getByRole("button", { name: "Check" }).click();
}

export async function order(page: Page, items: string[]) {
  for (const item of items) await guide(page).getByRole("button", { name: item, exact: true }).click();
}
