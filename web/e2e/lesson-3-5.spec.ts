import { expect, test, type Page } from "@playwright/test";
import { choose, expectComplete, guide, proceed, shot, startLesson, target } from "./helpers";

async function fill(page: Page, values: Record<string, string>) {
  const card = page.getByTestId("fill-card");
  for (const [label, value] of Object.entries(values)) {
    const field = card.getByLabel(label, { exact: true });
    if ((await field.evaluate((el) => el.tagName)) === "SELECT") await field.selectOption(value);
    else await field.fill(value);
  }
  await card.getByRole("button", { name: "Check" }).click();
}
const heading = (page: Page, name: string) => expect(guide(page).getByRole("heading", { name })).toBeVisible();

test("lesson 3.5: floating-point arguments", async ({ page }) => {
  await startLesson(page, "m3.l5");
  await target(page, "reg:XMM0").click();
  await shot(page, "35-01-xmm");
  await proceed(page);
  await choose(page, /^B XMM1$/);
  await proceed(page);
  await fill(page, { "a (int)": "ECX", "b (double)": "XMM1", "c (int)": "R8D", "d (float)": "XMM3" });
  await heading(page, "Check against the code");
  await fill(page, { "movss xmm3,...": "d", "mov r8d,2": "c", "movsd xmm1,...": "b", "mov ecx,...": "a" });
  await proceed(page);
  await fill(page, { "movss xmm3,dword ptr ds:[...]": "float", "movsd xmm1,qword ptr ds:[...]": "double" });
  await proceed(page);
  await heading(page, "Read the values");
  await expect(page.getByTestId("xmm")).toContainText("double 1.5");
  await shot(page, "35-02-values");
  await fill(page, { "b (XMM1)": "1.5", "d (XMM3)": "0.5" });
  await heading(page, "Over the call");
  await page.keyboard.press("F8");
  await heading(page, "The return value");
  await expect(target(page, "reg:XMM0")).toContainText("double 5.5");
  await fill(page, { XMM0: "5.5" });
  await proceed(page);
  await heading(page, "A peek inside");
  await target(page, "disasm:00000001400010E5").click();
  await proceed(page);
  await fill(page, { x: "XMM0", y: "EDX", z: "XMM2", p: "R9" });
  await choose(page, /^B XMM0, low 32 bits$/);
  await heading(page, "Type from instruction");
  await choose(page, /^B double$/);
  await fill(page, { "Parameter 1": "float", "Parameter 2": "int", "Parameter 3": "float" });
  await expectComplete(page);
});
