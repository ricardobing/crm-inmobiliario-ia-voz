import { expect, expectNoBrokenText, expectNoHorizontalScroll, test } from "./fixtures";

test.describe("Listado de contactos (R1)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/contactos");
    await expect(page.getByRole("heading", { name: "Contactos" })).toBeVisible();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 });
  });

  test("muestra los 13 contactos de la organización y oculta el de prueba", async ({ page }) => {
    const rows = page.locator("ul > li > a[href^='/contactos/']");
    await expect(rows).toHaveCount(13);
    await expect(page.getByText("1 contacto de prueba oculto")).toBeVisible();
    await expect(page.getByText("Miralvento Gestión Inmobiliaria · 13 contactos")).toBeVisible();
  });

  test("nunca muestra contactos de otra organización ni el de prueba (D01, D02)", async ({ page }) => {
    for (const hidden of ["Isabel Torres Milán", "Pablo Herrero Gil", "Prueba Prueba"]) {
      await expect(page.getByText(hidden)).toHaveCount(0);
    }
  });

  test("nombres normalizados y fallbacks dignos", async ({ page }) => {
    await expect(page.getByText("José Luis Martín Cabrera")).toBeVisible();
    await expect(page.getByText("María Dolores Gutiérrez Santos")).toBeVisible();
    await expect(page.getByRole("link", { name: /\+34 688 45 67 89/ })).toBeVisible();
    await expectNoBrokenText(page);
  });

  test("abre la ficha al pulsar un contacto", async ({ page }) => {
    await page.getByRole("link", { name: /Carmen Ruiz Delgado/ }).click();
    await expect(page).toHaveURL(/\/contactos\/c-001$/);
    await expect(page.getByRole("heading", { level: 1, name: "Carmen Ruiz Delgado" })).toBeVisible();
  });

  test("sin scroll horizontal", async ({ page }) => {
    await expectNoHorizontalScroll(page);
  });
});
