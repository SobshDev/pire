import { expect, test } from "@playwright/test";
import { startLesson, target } from "./helpers";

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
