import { test as base, expect, type Page } from "@playwright/test";

/** Cada test falla si la página escribe errores en consola (hidratación, excepciones, 500 inesperados…). */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const text = msg.text();
        // Los 404/500 provocados a propósito por el test aparecen como error de recurso: se filtran.
        if (/Failed to load resource/.test(text)) return;
        errors.push(text);
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await use(errors);
      expect(errors, "errores en la consola del navegador").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Texto que nunca debe verse: restos de datos mal interpretados. */
export async function expectNoBrokenText(page: Page) {
  const body = await page.locator("body").innerText();
  for (const bad of ["undefined", "NaN", "Invalid Date", "[object Object]", "null"]) {
    expect(body, `la página muestra «${bad}»`).not.toContain(bad);
  }
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "scroll horizontal").toBeLessThanOrEqual(0);
}

export async function openContact(page: Page, id: string) {
  await page.goto(`/contactos/${id}`);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 });
}
