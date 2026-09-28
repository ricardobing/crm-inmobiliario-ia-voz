import { expect, openContact, test } from "./fixtures";

test.describe("Estados (R5)", () => {
  test("cargando: se ve el esqueleto mientras responde la API", async ({ page }) => {
    await page.route("**/api/contacts/c-001", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.continue();
    });
    await page.goto("/contactos/c-001");
    await expect(page.getByLabel("Cargando ficha")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Carmen Ruiz Delgado" })).toBeVisible({ timeout: 15_000 });
  });

  test("error: mensaje claro y reintento", async ({ page }) => {
    await page.goto("/contactos/c-001?simular=error");
    await expect(page.getByText("No se pudo cargar la ficha")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
    await page.getByRole("link", { name: "Ver la ficha sin error" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Carmen Ruiz Delgado" })).toBeVisible({ timeout: 15_000 });
  });

  test("error de red en el listado: reintento que funciona", async ({ page }) => {
    // React Query reintenta una vez los 5xx: hacen falta dos fallos seguidos para ver el error.
    let failures = 2;
    await page.route("**/api/contacts", async (route) => {
      if (failures-- > 0) await route.fulfill({ status: 503, json: { error: { code: "internal", message: "Servicio no disponible" } } });
      else await route.continue();
    });
    await page.goto("/contactos");
    await expect(page.getByText("No se pudieron cargar los contactos")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.locator("ul > li > a[href^='/contactos/']")).toHaveCount(13, { timeout: 15_000 });
  });

  for (const id of ["c-010", "c-999"]) {
    test(`no encontrado: ${id} (otra organización o inexistente, misma respuesta)`, async ({ page }) => {
      await page.goto(`/contactos/${id}`);
      await expect(page.getByRole("heading", { name: "No encontramos este contacto" })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Isabel Torres Milán")).toHaveCount(0);
      await page.getByRole("link", { name: "Volver a contactos" }).click();
      await expect(page).toHaveURL(/\/contactos$/);
    });
  }

  test("ficha casi vacía (c-012): digna y explicada", async ({ page }) => {
    await openContact(page, "c-012");
    await expect(page.getByText("Sin nombre registrado · identificado por su teléfono")).toBeVisible();
    await expect(page.getByText("Origen desconocido", { exact: true })).toBeVisible();
    await expect(page.getByText("Sin cualificación todavía")).toBeVisible();
    await expect(page.getByText("Sin actividad registrada")).toBeVisible();
    await expect(page.getByText("Sin email", { exact: true })).toBeVisible();
    await expect(page.getByText("24/06/2026 · 02:00")).toBeVisible();
  });
});
