import { expect, test } from "@playwright/test";
import { choose, expectComplete, guide, order, proceed, shot, startLesson, target } from "./helpers";

test("lesson 2.4: from double-click to main", async ({ page }) => {
  await startLesson(page, "m2.l4");
  await expect(page.getByTestId("window-title")).toContainText("x64dbg");
  await shot(page, "24-01-timeline");
  await proceed(page);
  await proceed(page);

  await target(page, "log:0").click();
  await expect(guide(page)).toContainText("ends in user32.dll");
  await page.locator("[data-target^='log:']", { hasText: /user32\.dll$/ }).click();
  await shot(page, "24-02-log");
  await proceed(page);
  await choose(page, /RIP is still in ntdll/);
  await proceed(page);

  await expect(target(page, "mem:0000000140001000")).toContainText("ER---");
  await shot(page, "24-03-memmap");
  const card = page.getByTestId("fill-card");
  await card.getByLabel(".text").selectOption("ER---");
  await card.getByLabel(".rdata").selectOption("-R---");
  await card.getByLabel(".data").selectOption("-RW--");
  await card.getByRole("button", { name: "Check" }).click();
  await proceed(page);

  await order(page, ["TLS callbacks, if any", "ntdll's RtlUserThreadStart", "kernel32's BaseThreadInitThunk", "vault.exe's entry point"]);

  await page.getByRole("tab", { name: "Call Stack" }).click();
  const stack = page.getByTestId("call-stack");
  await expect(stack).toContainText("BaseThreadInitThunk");
  await expect(stack).toContainText("RtlUserThreadStart");
  await shot(page, "24-04-callstack");
  await proceed(page);
  await proceed(page);

  await order(page, [
    "The kernel creates the process and maps vault.exe and ntdll",
    "The loader loads DLLs and fills the IAT",
    "TLS callbacks run",
    "RtlUserThreadStart and BaseThreadInitThunk",
    "The entry point (startup routine)",
    "main",
    "exit",
  ]);
  await choose(page, /loader loading DLLs/);
  await choose(page, /\.data \(RW\)/);
  await expectComplete(page);
});
