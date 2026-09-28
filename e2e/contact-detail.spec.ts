import { expect, expectNoBrokenText, expectNoHorizontalScroll, openContact, test } from "./fixtures";

// Todas las fichas de ORG-0031 (docs/decisiones.md §5): nombre, teléfono y origen esperados.
const CONTACTS = [
  { id: "c-001", name: "Carmen Ruiz Delgado", phone: "+34 655 12 34 56", source: "Llamada" },
  { id: "c-002", name: "José Luis Martín Cabrera", phone: "+34 612 88 90 34", source: "Llamada" },
  { id: "c-003", name: "Antonio Vidal", phone: "+34 699 11 22 33", source: "Llamada" },
  { id: "c-004", name: "+34 688 45 67 89", phone: "+34 688 45 67 89", source: "WhatsApp" },
  { id: "c-005", name: "Lucía Fernández", phone: null, source: "Formulario web" },
  { id: "c-006", name: "David P.", phone: "+34 677 00 11 22", source: "Meta Ads" },
  { id: "c-007", name: "Marta Iglesias Peña", phone: "+34 622 90 11 30", source: "Llamada" },
  { id: "c-008", name: "Roberto Sanz Oliva", phone: "+34 633 44 55 66", source: "Llamada" },
  { id: "c-009", name: "Carmen Ruiz", phone: "+34 655 12 34 56", source: "WhatsApp" },
  { id: "c-012", name: "+34 611 22 33 44", phone: "+34 611 22 33 44", source: "Origen desconocido" },
  { id: "c-013", name: "Sofía Marín Costas", phone: "+34 644 78 12 90", source: "Importación · Witei" },
  { id: "c-014", name: "Prueba Prueba", phone: "+34 600 00 00 00", source: "Alta manual" },
  { id: "c-015", name: "María Dolores Gutiérrez Santos", phone: "+34 644 55 66 77", source: "Importación · Witei" },
  { id: "c-016", name: "Álvaro Quintana Ros", phone: "+34 688 11 22 33", source: "WhatsApp" },
];

test.describe("Todas las fichas se ven dignas", () => {
  for (const c of CONTACTS) {
    test(`${c.id} · ${c.name}`, async ({ page }) => {
      await openContact(page, c.id);
      const header = page.locator("section[aria-labelledby='contact-name']");
      await expect(page.getByRole("heading", { level: 1, name: c.name })).toBeVisible();
      await expect(header.locator("[data-source-kind]")).toHaveText(c.source);
      if (c.phone) await expect(header.getByText(c.phone).first()).toBeVisible();
      else await expect(header.getByText("Sin teléfono", { exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Cualificación" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Actividad" })).toBeVisible();
      await expectNoBrokenText(page);
      await expectNoHorizontalScroll(page);
    });
  }
});

test.describe("Cualificación dinámica (R3)", () => {
  test("c-001: grupos por operación, sin _meta, con procedencia y confianza", async ({ page }) => {
    await openContact(page, "c-001");
    const q = page.locator("[aria-labelledby='qualification-title']");
    await expect(q.getByRole("heading", { name: /Compra/ })).toBeVisible();
    await expect(q.getByRole("heading", { name: /Comunes/ })).toBeVisible();
    await expect(q.getByText("_meta")).toHaveCount(0);
    await expect(q.getByText("Hasta 480.000 €")).toBeVisible();
    await expect(q.getByText("Dicho por el cliente").first()).toBeVisible();
    await expect(q.getByText("Confianza media").first()).toBeVisible();
    await expect(q.getByText(/sincronizado el 08\/07\/2026 · 12:36/)).toBeVisible();
  });

  test("c-002: el texto «1.100 €» se muestra tal cual", async ({ page }) => {
    await openContact(page, "c-002");
    await expect(page.getByText("1.100 €", { exact: true })).toBeVisible();
    await expect(page.getByText("Las Rozas o Majadahonda", { exact: true })).toBeVisible();
  });

  test("c-003: la cualificación en string JSON se interpreta", async ({ page }) => {
    await openContact(page, "c-003");
    await expect(page.getByText(/recibido como texto JSON e interpretado/)).toBeVisible();
    await expect(page.getByText("1.400 €/mes")).toBeVisible();
  });

  test("c-007: claves desconocidas con etiqueta legible y la clave original a mano", async ({ page }) => {
    await openContact(page, "c-007");
    await expect(page.getByText("Accesibilidad movilidad reducida")).toBeVisible();
    await expect(page.getByRole("button", { name: "Clave original: accesibilidad_movilidad_reducida" })).toBeVisible();
    await expect(page.getByText("imprescindible", { exact: true })).toBeVisible();
  });

  test("c-008: lo editado por una persona manda; ingresos sin verificar", async ({ page }) => {
    await openContact(page, "c-008");
    const budgetRow = page.locator("li[data-provenance='human']");
    await expect(budgetRow).toHaveCount(1);
    await expect(budgetRow.getByText("Hasta 350.000 €")).toBeVisible();
    await expect(budgetRow.getByText("Editado por una persona")).toBeVisible();
    await expect(page.getByText("Ingresos netos mensuales")).toBeVisible();
    await expect(page.getByText("Sin verificar")).toBeVisible();
    await expect(page.getByText("Declarado en llamada")).toBeVisible();
  });

  test("c-013: datos importados de Witei, no «dichos por el cliente»", async ({ page }) => {
    await openContact(page, "c-013");
    await expect(page.getByText("Importado de Witei")).toBeVisible();
    await expect(page.getByText("Dicho por el cliente")).toHaveCount(0);
  });
});

test.describe("Timeline (R4)", () => {
  test("c-001: transcripción plegable por turnos", async ({ page }) => {
    await openContact(page, "c-001");
    const toggle = page.getByRole("button", { name: "Ver transcripción" });
    await expect(page.getByText("¿Y en qué zona le gustaría buscar?")).toHaveCount(0);
    await toggle.click();
    await expect(page.getByText("¿Y en qué zona le gustaría buscar?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ocultar transcripción" })).toBeVisible();
    await expect(page.getByText("6 min 52 s")).toBeVisible();
  });

  test("c-008: orden cronológico real, la más reciente primero", async ({ page }) => {
    await openContact(page, "c-008");
    const times = await page.locator("[aria-labelledby='timeline-title'] time").allInnerTexts();
    expect(times).toEqual(["10/07/2026 · 11:05", "05/07/2026 · 13:20"]);
  });

  test("c-005: formulario con referencia de inmueble y fecha DD/MM", async ({ page }) => {
    await openContact(page, "c-005");
    await expect(page.getByText("Piso con terraza en Majadahonda")).toBeVisible();
    await expect(page.getByText("MIR-2041")).toBeVisible();
    await expect(page.locator("time").first()).toHaveText("11/07/2026 · 18:42");
  });

  test("las horas se muestran en hora de Madrid aunque el navegador esté en otra zona", async ({ page }) => {
    await openContact(page, "c-001");
    await expect(page.getByText("08/07/2026 · 12:28").first()).toBeVisible();
  });
});

test.describe("Cabecera (R2)", () => {
  test("c-015: email inválido señalado y acción de email bloqueada", async ({ page }) => {
    await openContact(page, "c-015");
    await expect(page.getByText("Formato no válido", { exact: true })).toBeVisible();
    await expect(page.locator("[data-action='email'][data-blocked='true']")).toBeVisible();
    await expect(page.locator("a[data-action='call']")).toHaveAttribute("href", "tel:+34644556677");
  });

  test("c-002: WhatsApp con el número normalizado", async ({ page }) => {
    await openContact(page, "c-002");
    await expect(page.locator("a[data-action='whatsapp']")).toHaveAttribute("href", "https://wa.me/34612889034");
  });

  test("c-005: sin teléfono, llamar y WhatsApp bloqueados; email disponible", async ({ page }) => {
    await openContact(page, "c-005");
    await expect(page.locator("[data-action='call'][data-blocked='true']")).toBeVisible();
    await expect(page.locator("[data-action='whatsapp'][data-blocked='true']")).toBeVisible();
    await expect(page.locator("a[data-action='email']")).toHaveAttribute("href", "mailto:lucia.fdz@gmail.com");
  });

  test("c-016: aviso de que pidió hablar con una persona", async ({ page }) => {
    await openContact(page, "c-016");
    await expect(page.getByRole("alert").filter({ hasText: "Pidió hablar con una persona" })).toBeVisible();
  });

  test("c-014: contacto de prueba señalado", async ({ page }) => {
    await openContact(page, "c-014");
    await expect(page.getByText("Contacto de prueba", { exact: true })).toBeVisible();
  });
});
