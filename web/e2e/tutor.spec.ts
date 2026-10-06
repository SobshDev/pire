import { expect, test } from "@playwright/test";
import { guide, startLesson, target } from "./helpers";

test("a guest is asked to sign in before using the tutor", async ({ page, request }) => {
  const status = (await (await request.get("/api/tutor/status")).json()) as { enabled: boolean };
  test.skip(!status.enabled, "The tutor is off on this server.");
  await page.goto("/learn/m1.l2");
  await expect(guide(page)).toBeVisible();
  await page.getByRole("tab", { name: "Ask" }).click();
  const prompt = page.getByTestId("tutor-signed-out");
  await expect(prompt).toContainText("Sign in to ask the tutor");
  await prompt.getByRole("link", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/register\?redirect=%2Flearn%2Fm1\.l2/);
});

/**
 * The AI tutor. Against an API started with TUTOR_BASE_URL at e2e/tutor-stub.ts it asks a question,
 * sees RCX lit up and the answer, and reloads to find the chat again. Without a tutor it checks the
 * offline state.
 */
test("the Ask tab answers, points at the debugger, and keeps the chat", async ({ page, request }) => {
  const status = (await (await request.get("/api/tutor/status")).json()) as { enabled: boolean };
  await startLesson(page, "m1.l2");
  const rail = page.getByRole("tab", { name: "Ask" });
  await expect(page.getByRole("button", { name: /Help/ })).toHaveCount(0);

  if (!status.enabled) {
    await page.keyboard.press("?");
    await expect(rail).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("tutor-offline")).toContainText("isn't set up");
    await page.getByRole("button", { name: "Back to the guide →" }).click();
    await expect(page.getByRole("complementary", { name: "Guide" })).toBeVisible();
    return;
  }

  await rail.click();
  await page.getByRole("button", { name: "What changed?" }).click();
  const answer = page.getByTestId("tutor-answer").last();
  await expect(answer).toContainText("Pointed at RCX");
  await expect(answer).toContainText("put the banner's address there");
  await expect(target(page, "reg:RCX")).toHaveClass(/tutor-point/);
  await expect(page.getByRole("button", { name: "Just tell me" })).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: "Ask" }).click();
  await expect(page.getByText("What changed?")).toBeVisible();
  await expect(page.getByTestId("tutor-answer").last()).toContainText("put the banner's address there");

  // Esc from the composer goes back to the guide.
  await page.getByLabel("Ask the tutor").press("Escape");
  await expect(page.getByRole("tab", { name: "Guide" })).toHaveAttribute("aria-selected", "true");
});

/** The chat can move to its own window for a second screen and still drive the debugger in the lesson tab. */
test("the chat pops out into its own window and comes back", async ({ page, request }) => {
  const status = (await (await request.get("/api/tutor/status")).json()) as { enabled: boolean };
  await startLesson(page, "m1.l2");
  const [chat] = await Promise.all([page.waitForEvent("popup"), page.getByRole("button", { name: "Open the chat in its own window" }).click()]);
  await expect(chat).toHaveTitle(/^Ask · /);
  await expect(page.getByRole("tab", { name: "Guide" })).toHaveAttribute("aria-selected", "true");

  if (status.enabled) {
    await chat.getByRole("button", { name: "What changed?" }).click();
    await expect(chat.getByTestId("tutor-answer").last()).toContainText("put the banner's address there");
    // The tutor in the window points at the debugger in the lesson tab.
    await expect(target(page, "reg:RCX")).toHaveClass(/tutor-point/);
    // Typing in the chat stays in the chat: S doesn't open the source.
    await chat.getByLabel("Ask the tutor").pressSequentially("Si");
    await expect(page.locator("header").getByRole("button", { name: /^Source/ })).toHaveAttribute("aria-pressed", "false");
  } else {
    await expect(chat.getByTestId("tutor-offline")).toBeVisible();
  }

  await chat.getByRole("button", { name: "Back to the lesson" }).click();
  await expect(page.getByRole("tab", { name: "Ask" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId(status.enabled ? "tutor" : "tutor-offline")).toBeVisible();
  if (status.enabled) await expect(page.getByTestId("tutor-answer").last()).toContainText("put the banner's address there");
});
