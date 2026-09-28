import { openContact, test } from "./fixtures";

// Capturas de verificación visual (docs/capturas/<proyecto>/). Se regeneran en cada ejecución.
const IDS = ["c-001", "c-003", "c-007", "c-008", "c-009", "c-012", "c-013", "c-015", "c-016"];

test.describe("Capturas", () => {
  test("listado", async ({ page }, info) => {
    await page.goto("/contactos");
    await page.locator("ul > li > a").first().waitFor({ timeout: 15_000 });
    await page.screenshot({ path: `docs/capturas/${info.project.name}/listado.png`, fullPage: true });
  });

  for (const id of IDS) {
    test(`ficha ${id}`, async ({ page }, info) => {
      await openContact(page, id);
      const toggle = page.getByRole("button", { name: "Ver transcripción" });
      if (await toggle.count()) await toggle.first().click();
      // Con la página desplazada, la cabecera fija saldría en medio de la captura completa.
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `docs/capturas/${info.project.name}/${id}.png`, fullPage: true });
    });
  }
});
