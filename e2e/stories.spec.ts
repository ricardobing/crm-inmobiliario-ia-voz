import { expect, openContact, test } from "./fixtures";

test.describe("#10 Cumplimiento", () => {
  test("c-013 (no-llamar): aviso, llamada y WhatsApp bloqueados con motivo, email disponible", async ({ page }) => {
    await openContact(page, "c-013");
    await expect(page.getByRole("alert").filter({ hasText: "No llamar ni escribir por WhatsApp" })).toBeVisible();
    await expect(page.locator("[data-action='call'][data-blocked='true']")).toBeVisible();
    await expect(page.locator("[data-action='whatsapp'][data-blocked='true']")).toBeVisible();
    await expect(page.locator("a[data-action='email']")).toHaveAttribute("href", "mailto:sofiamarin.c@gmail.com");

    const compliance = page.locator("[aria-labelledby='compliance-title']");
    await expect(compliance.locator("[data-permission='blocked']")).toHaveCount(3);
    await expect(compliance.getByText(/no-llamar/).first()).toBeVisible();
    await expect(compliance.getByText("Consentimiento: no registrado en el origen de datos")).toBeVisible();
  });

  test("el motivo del bloqueo se ve al pasar el ratón o con el teclado", async ({ page, isMobile }) => {
    test.skip(isMobile, "tooltip de escritorio");
    await openContact(page, "c-013");
    await page.locator("[data-action='call'][data-blocked='true']").focus();
    await expect(page.getByRole("tooltip")).toContainText("no-llamar");
  });

  test("c-001: sin restricciones, todo permitido salvo el email que no tiene", async ({ page }) => {
    await openContact(page, "c-001");
    const compliance = page.locator("[aria-labelledby='compliance-title']");
    await expect(compliance.locator("[data-permission='blocked']")).toHaveCount(1);
    await expect(compliance.getByText("Sin email")).toBeVisible();
  });
});

test.describe("#2 Duplicados", () => {
  test("c-001 ↔ c-009: aviso, motivos y propuesta de fusión que no se ejecuta sola", async ({ page }) => {
    await openContact(page, "c-001");
    await expect(page.getByRole("status").filter({ hasText: "Posible duplicado de Carmen Ruiz" })).toBeVisible();

    const panel = page.locator("[aria-labelledby='duplicates-title']");
    await expect(panel.getByText("Mismo teléfono (+34 655 12 34 56)")).toBeVisible();
    await panel.getByRole("button", { name: "Ver propuesta de fusión" }).click();
    const proposal = panel.locator("dl");
    await expect(proposal.locator("dd", { hasText: "Carmen Ruiz Delgado" })).toBeVisible();
    await expect(proposal.getByText("Llamada (+ WhatsApp)")).toBeVisible();
    await expect(panel.getByText("7 datos (7 de c-001, 0 de c-009)")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Fusionar" })).toBeDisabled();

    await panel.getByRole("link", { name: "Carmen Ruiz", exact: true }).click();
    await expect(page).toHaveURL(/\/contactos\/c-009$/);
    await expect(page.locator("[aria-labelledby='duplicates-title']").getByRole("link", { name: "Carmen Ruiz Delgado" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("un contacto sin duplicados no muestra el panel (c-002)", async ({ page }) => {
    await openContact(page, "c-002");
    await expect(page.locator("[aria-labelledby='duplicates-title']")).toHaveCount(0);
  });
});

test.describe("#4 Siguiente mejor acción", () => {
  const cases = [
    { id: "c-016", title: "Llamar ya: pidió hablar con una persona", href: "tel:+34688112233" },
    { id: "c-013", title: "Contactar solo por email", href: "mailto:sofiamarin.c@gmail.com" },
    { id: "c-005", title: "Responder a su último mensaje", href: "mailto:lucia.fdz@gmail.com" },
    { id: "c-004", title: "Responder a su último mensaje", href: "https://wa.me/34688456789" },
    { id: "c-012", title: "Llamar para cualificar", href: "tel:+34611223344" },
    { id: "c-008", title: "Proponer inmuebles y agendar visita", href: "tel:+34633445566" },
    { id: "c-001", title: "Revisar el posible duplicado antes de contactar", href: null },
  ];
  for (const c of cases) {
    test(`${c.id}: ${c.title}`, async ({ page }) => {
      await openContact(page, c.id);
      const card = page.locator("[aria-labelledby='next-action-title']");
      await expect(card.getByText(c.title, { exact: true }).first()).toBeVisible();
      const button = card.locator("a[data-next-action]");
      if (c.href) await expect(button).toHaveAttribute("href", c.href);
      else await expect(button).toHaveCount(0);
    });
  }

  test("en móvil, la siguiente acción aparece antes que la cualificación", async ({ page, isMobile }) => {
    test.skip(!isMobile, "solo móvil");
    await openContact(page, "c-008");
    const action = await page.locator("[aria-labelledby='next-action-title']").boundingBox();
    const qualification = await page.locator("[aria-labelledby='qualification-title']").boundingBox();
    expect(action && qualification && action.y < qualification.y).toBe(true);
  });
});

test.describe("Listado: señales de las stories", () => {
  test("no llamar, pide una persona y posibles duplicados", async ({ page }) => {
    await page.goto("/contactos");
    await expect(page.locator("ul > li > a").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: /Sofía Marín Costas/ }).getByText("No llamar")).toBeVisible();
    await expect(page.getByRole("link", { name: /Álvaro Quintana Ros/ }).getByText("Pide una persona")).toBeVisible();
    await expect(page.getByText("Posible duplicado")).toHaveCount(2);
  });
});
