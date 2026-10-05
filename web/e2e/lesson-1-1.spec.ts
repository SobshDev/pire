import { expect, test, type Page } from "@playwright/test";

const shots = process.env.PIRE_SHOTS;
const shot = async (page: Page, name: string) => {
  if (!shots) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: shots + "/" + name + ".png" });
};

const target = (page: Page, id: string) => page.locator("[data-target='" + id + "']");
const guide = (page: Page) => page.getByRole("complementary", { name: "Guide" });
const proceed = (page: Page) => guide(page).getByRole("button", { name: /Continue/ }).click();

async function drag(page: Page, label: string, pane: string) {
  const chip = page.locator("[data-chip='" + label + "']");
  const to = page.locator("[data-pane='" + pane + "']");
  const a = (await chip.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 3, { steps: 10 });
  await page.mouse.up();
}

test("a new learner signs up and finishes lesson 1.1", async ({ page }) => {
  await page.goto("/learn/m1.l1");
  await expect(page).toHaveURL(/\/register/);

  const email = "e2e-" + Date.now() + "@pire.test";
  await page.getByLabel("Display name").fill("Ada");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("correct horse battery");
  await page.getByLabel("Confirm password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/learn\/m1\.l1/);
  await expect(guide(page)).toContainText("Everything at once");
  await shot(page, "01-overview");
  await guide(page).getByRole("button", { name: "Show me" }).click();

  // Beat 2: click the RIP line.
  await target(page, "disasm:0000000140001070").click();
  await shot(page, "02-rip");
  await proceed(page);

  // Beat 3: a near miss gets specific feedback, then the right answer.
  await target(page, "disasm:0000000140001074").click();
  await expect(guide(page)).toContainText("loads the banner");
  await expect(page.getByTestId("source-card")).toBeVisible();
  await shot(page, "03-near-miss");
  await target(page, "disasm:000000014000107B").click();
  await proceed(page);

  // Beat 4: type RIP.
  await guide(page).getByLabel("Your answer").fill("0000000140001070");
  await guide(page).getByRole("button", { name: "Check" }).click();
  await shot(page, "04-predict");
  await proceed(page);

  await target(page, "flag:ZF").click();
  await proceed(page);

  await guide(page).getByRole("button", { name: /This is the address of main/ }).click();
  await expect(guide(page)).toContainText("Not quite");
  await guide(page).getByRole("button", { name: /returns to this address/ }).click();
  await proceed(page);

  await target(page, "dump:ascii:0000000140003200").click();
  await proceed(page);

  await target(page, "status:paused").click();
  await proceed(page);

  // Beat 9: * does nothing useful until RIP is scrolled away.
  await page.keyboard.press("*");
  await expect(guide(page)).toContainText("Scroll the disassembly first");
  // Like a learner: a stray key gets an explanation, then scroll with the wheel and press Shift+8.
  await page.keyboard.press("x");
  await expect(guide(page)).toContainText("This step needs *");
  await page.getByTestId("disasm-scroll").hover();
  await page.mouse.wheel(0, 2000);
  await expect(target(page, "disasm:0000000140001070")).not.toBeInViewport();
  await page.keyboard.press("Shift+8");
  await expect(guide(page)).toContainText("first key");
  await expect(target(page, "disasm:0000000140001070")).toBeInViewport();
  await proceed(page);

  // Checkpoint 1: drag labels onto panes.
  await expect(page.getByTestId("guide-kicker")).toContainText("Checkpoint 1");
  await drag(page, "next instruction", "disassembly");
  await drag(page, "register values", "registers");
  await shot(page, "05-match");
  await drag(page, "memory as hex and text", "dump");
  await drag(page, "return addresses and locals", "stack");
  await expect(guide(page)).toContainText("All four in the right place");
  await proceed(page);

  await guide(page).getByRole("button", { name: "The line at RIP." }).click();
  await proceed(page);
  await guide(page).getByRole("button", { name: /only make sense while the program is paused/ }).click();
  await proceed(page);

  const done = page.getByRole("dialog", { name: "Lesson complete" });
  await expect(done).toBeVisible();
  await expect(done).toContainText("Try it on your own machine");
  await shot(page, "06-complete");

  // Progress was saved: the catalog shows the lesson as completed.
  await done.getByRole("link", { name: "Back to the course" }).click();
  await expect(page.getByRole("link", { name: /Tour of the interface/ })).toContainText("Completed");
});

test("progress resumes after a reload", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Display name").fill("Grace");
  await page.getByLabel("Email").fill("e2e-resume-" + Date.now() + "@pire.test");
  await page.getByLabel("Password", { exact: true }).fill("correct horse battery");
  await page.getByLabel("Confirm password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/");

  await page.getByRole("link", { name: /Tour of the interface/ }).click();
  await guide(page).getByRole("button", { name: "Show me" }).click();
  await target(page, "disasm:0000000140001070").click();
  const saved = page.waitForResponse((r) => r.url().includes("/api/progress/") && r.request().method() === "PUT");
  await proceed(page);
  await saved;

  await page.reload();
  await expect(guide(page)).toContainText("Spot the C");
});
