import { describe, expect, it } from "vitest";
import { normalizeChannel, UNKNOWN_SOURCE_LABEL } from "./channels";
import { emailMatchKey, normalizeEmail } from "./email";
import { buildDisplayName, prettifyName, UNIDENTIFIED_CONTACT_LABEL } from "./names";
import { normalizePhone, toWhatsAppNumber } from "./phones";

describe("normalizePhone (D04)", () => {
  it.each([
    ["+34 655 12 34 56", "+34655123456", "+34 655 12 34 56"],
    ["0034612889034", "+34612889034", "+34 612 88 90 34"],
    ["699112233", "+34699112233", "+34 699 11 22 33"],
    ["+34688456789", "+34688456789", "+34 688 45 67 89"],
    ["+34-644-556-677", "+34644556677", "+34 644 55 66 77"],
    ["+34 633 445 566", "+34633445566", "+34 633 44 55 66"],
  ])("%s → %s", (raw, e164, display) => {
    expect(normalizePhone(raw, "ES")).toEqual({ raw, e164, display, valid: true });
  });

  it("el mismo número en dos formatos da el mismo E.164 (c-001 / c-009)", () => {
    expect(normalizePhone("+34 655 12 34 56", "ES")?.e164).toBe(normalizePhone("655123456", "ES")?.e164);
  });

  it("vacío o null → sin teléfono", () => {
    expect(normalizePhone(null, "ES")).toBeNull();
    expect(normalizePhone("  ", "ES")).toBeNull();
  });

  it("un número que no se puede validar se conserva tal cual y sin E.164", () => {
    expect(normalizePhone("12", "ES")).toEqual({ raw: "12", e164: null, display: "12", valid: false });
  });

  it("número de WhatsApp sin '+'", () => {
    const phone = normalizePhone("0034612889034", "ES");
    expect(phone && toWhatsAppNumber(phone)).toBe("34612889034");
  });
});

describe("normalizeEmail (D05)", () => {
  it("detecta el email inválido de c-015 y no lo corrige", () => {
    expect(normalizeEmail("mdolores@@gmail.com")).toEqual({ raw: "mdolores@@gmail.com", valid: false });
  });
  it("email válido", () => {
    expect(normalizeEmail(" lucia.fdz@gmail.com ")).toEqual({ raw: "lucia.fdz@gmail.com", valid: true });
  });
  it("clave de comparación solo para emails válidos", () => {
    expect(emailMatchKey(normalizeEmail("Test@Test.com"))).toBe("test@test.com");
    expect(emailMatchKey(normalizeEmail("mdolores@@gmail.com"))).toBeNull();
  });
});

describe("prettifyName / buildDisplayName (D03)", () => {
  it.each([
    ["JOSÉ LUIS MARTÍN CABRERA", "José Luis Martín Cabrera"],
    ["carmen ruiz", "Carmen Ruiz"],
    ["MARÍA DOLORES GUTIÉRREZ SANTOS", "María Dolores Gutiérrez Santos"],
    ["MARÍA DE LA O GARCÍA-LÓPEZ", "María de la O García-López"],
    ["David P.", "David P."],
    ["Álvaro Quintana Ros", "Álvaro Quintana Ros"],
  ])("%s → %s", (raw, expected) => {
    expect(prettifyName(raw)).toBe(expected);
  });

  it("iniciales de las dos primeras palabras, sin partículas", () => {
    const name = buildDisplayName({ fullName: "Carmen Ruiz Delgado", phone: null, email: null });
    expect(name).toMatchObject({ text: "Carmen Ruiz Delgado", basis: "name", initials: "CR" });
    expect(buildDisplayName({ fullName: "Álvaro Quintana", phone: null, email: null }).initials).toBe("ÁQ");
  });

  it("sin nombre → teléfono → email → texto digno", () => {
    const phone = normalizePhone("+34688456789", "ES");
    const email = normalizeEmail("a@b.com");
    expect(buildDisplayName({ fullName: null, phone, email })).toMatchObject({ text: "+34 688 45 67 89", basis: "phone", initials: null });
    expect(buildDisplayName({ fullName: "  ", phone: null, email })).toMatchObject({ text: "a@b.com", basis: "email" });
    expect(buildDisplayName({ fullName: null, phone: null, email: null })).toMatchObject({ text: UNIDENTIFIED_CONTACT_LABEL, basis: "none" });
  });
});

describe("normalizeChannel (D07)", () => {
  it.each([
    ["VOICE_CALL", "voice", "Llamada"],
    ["llamada", "voice", "Llamada"],
    ["VOZ", "voice", "Llamada"],
    ["whatsapp", "whatsapp", "WhatsApp"],
    ["WEBSITE", "web_form", "Formulario web"],
    ["WEB_FORM", "web_form", "Formulario web"],
    ["META_LEAD_ADS", "meta_ads", "Meta Ads"],
    ["WITEI", "import", "Importación · Witei"],
    ["CRM", "manual", "Alta manual"],
    ["EMAIL", "email", "Email"],
  ])("%s → %s", (raw, kind, label) => {
    expect(normalizeChannel(raw, UNKNOWN_SOURCE_LABEL)).toEqual({ kind, label, raw });
  });

  it("null → desconocido con la etiqueta pedida", () => {
    expect(normalizeChannel(null, UNKNOWN_SOURCE_LABEL)).toEqual({ kind: "unknown", label: UNKNOWN_SOURCE_LABEL, raw: null });
  });

  it("un valor que no conocíamos se muestra humanizado, sin romper", () => {
    expect(normalizeChannel("IDEALISTA", UNKNOWN_SOURCE_LABEL)).toEqual({ kind: "other", label: "Idealista", raw: "IDEALISTA" });
  });
});

describe("rawContactSchema (lectura tolerante)", () => {
  it("un contacto con solo id se lee: el resto de campos puede faltar", async () => {
    const { rawContactSchema } = await import("./raw-schema");
    expect(rawContactSchema.safeParse({ id: "a" }).success).toBe(true);
  });
  it("un campo con tipo inesperado se trata como ausente, sin tumbar el contacto", async () => {
    const { rawContactSchema } = await import("./raw-schema");
    const parsed = rawContactSchema.parse({ id: "a", full_name: 42, is_test: "sí", tags: "no-llamar" });
    expect(parsed).toMatchObject({ id: "a", full_name: null, is_test: null, tags: null });
  });
  it("sin id no se puede leer", async () => {
    const { rawContactSchema } = await import("./raw-schema");
    expect(rawContactSchema.safeParse({ full_name: "x" }).success).toBe(false);
  });
});
