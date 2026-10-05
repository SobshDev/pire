import { expect, test, type Page } from "@playwright/test";
import { choose, expectComplete, guide, proceed, shot, startLesson, target } from "./helpers";

const answer = async (page: Page, value: string) => {
  await guide(page).getByLabel("Your answer").fill(value);
  await guide(page).getByRole("button", { name: "Check" }).click();
};
async function fill(page: Page, values: Record<string, string>) {
  const card = page.getByTestId("fill-card");
  for (const [label, value] of Object.entries(values)) {
    const field = card.getByLabel(label, { exact: true });
    if ((await field.evaluate((el) => el.tagName)) === "SELECT") await field.selectOption(value);
    else await field.fill(value);
  }
  await card.getByRole("button", { name: "Check" }).click();
}

test("lesson 3.3: prologue, epilogue, call and ret", async ({ page }) => {
  await startLesson(page, "m3.l3");
  await answer(page, "14FE68");
  await proceed(page);
  await page.keyboard.press("F7");
  await expect(target(page, "stack:000000000014FE68")).toContainText("return to calls.main");
  await shot(page, "33-01-call");
  await proceed(page);
  await target(page, "stack:000000000014FE68").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Follow in Disassembler" }).click();
  await proceed(page);
  await page.keyboard.press("*");
  await target(page, "disasm:0000000140001060").click();
  await target(page, "disasm:0000000140001064").click();
  await proceed(page);
  await page.keyboard.press("F7");
  await proceed(page);
  await page.keyboard.press("Control+F9");
  await expect(target(page, "reg:RIP")).toContainText("0000000140001010");
  await proceed(page);
  await fill(page, { RIP: "140001075", RSP: "14FE30" });
  await proceed(page);
  await page.keyboard.press("F7");
  await proceed(page);
  await page.keyboard.press("F8");
  await target(page, "stack:000000000014FE68").click();
  await proceed(page);
  await page.keyboard.press("F7");
  await expect(target(page, "reg:RSP")).toContainText("000000000014FE70");
  await proceed(page);
  await proceed(page);

  await expect(page.getByTestId("window-title")).toContainText("calls.exe");
  await shot(page, "33-02-stripped");
  for (const a of ["000000014000105F", "0000000140001060", "0000000140001082"]) await target(page, "disasm:" + a).click();
  await proceed(page);
  await fill(page, { RSP: "14FE58", "[RSP]": "The address after the call" });
  await answer(page, "140001234");
  await fill(page, {
    "mov qword ptr ss:[rsp+8],rbx": "Prologue",
    "sub rsp,20": "Prologue",
    "call puts": "Body",
    "add rsp,20": "Epilogue",
    "mov rbx,qword ptr ss:[rsp+8]": "Epilogue",
    ret: "Epilogue",
  });
  await choose(page, /^A add rsp,28$/);
  await expectComplete(page);
});

