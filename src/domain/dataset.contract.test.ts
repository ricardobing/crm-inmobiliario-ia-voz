import { describe, expect, it } from "vitest";
import { loadDataset, loadNormalizedContacts, plain } from "./test-support";
import type { ContactCore } from "./types";

// Contrato con el dataset real: la tabla "Normalización" de docs/decisiones.md §5.
const contacts = loadNormalizedContacts();
const get = (id: string): ContactCore => {
  const contact = contacts.get(id);
  if (!contact) throw new Error(`falta ${id}`);
  return contact;
};

describe("dataset real: se lee entero", () => {
  it("los 16 contactos se leen sin descartar ninguno", () => {
    const dataset = loadDataset();
    expect(dataset.contacts).toHaveLength(16);
    expect(dataset.invalidContacts).toBe(0);
    expect(dataset.organization).toEqual({ id: "ORG-0031", name: "Miralvento Gestión Inmobiliaria" });
  });

  it("ningún texto visible contiene restos de datos rotos", () => {
    const serialized = JSON.stringify([...contacts.values()]);
    for (const bad of ["Invalid Date", "NaN", "[object Object]", "undefined"]) {
      expect(serialized).not.toContain(bad);
    }
  });
});

describe("normalización (docs/decisiones.md §5)", () => {
  it.each([
    ["c-001", "Carmen Ruiz Delgado", "+34 655 12 34 56", "Llamada", "08/07/2026 · 12:28"],
    ["c-002", "José Luis Martín Cabrera", "+34 612 88 90 34", "Llamada", "09/07/2026 · 19:12"],
    ["c-003", "Antonio Vidal", "+34 699 11 22 33", "Llamada", "10/07/2026 · 11:40"],
    ["c-004", "+34 688 45 67 89", "+34 688 45 67 89", "WhatsApp", "11/07/2026 · 22:15"],
    ["c-005", "Lucía Fernández", null, "Formulario web", "11/07/2026"],
    ["c-006", "David P.", "+34 677 00 11 22", "Meta Ads", "12/07/2026 · 15:05"],
    ["c-007", "Marta Iglesias Peña", "+34 622 90 11 30", "Llamada", "12/07/2026 · 18:30"],
    ["c-008", "Roberto Sanz Oliva", "+34 633 44 55 66", "Llamada", "05/07/2026 · 13:20"],
    ["c-009", "Carmen Ruiz", "+34 655 12 34 56", "WhatsApp", "13/07/2026 · 10:50"],
    ["c-012", "+34 611 22 33 44", "+34 611 22 33 44", "Origen desconocido", "24/06/2026 · 02:00"],
    ["c-013", "Sofía Marín Costas", "+34 644 78 12 90", "Importación · Witei", "06/07/2026 · 11:00"],
    ["c-014", "Prueba Prueba", "+34 600 00 00 00", "Alta manual", "02/06/2026 · 17:00"],
    ["c-015", "María Dolores Gutiérrez Santos", "+34 644 55 66 77", "Importación · Witei", "05/07/2026"],
    ["c-016", "Álvaro Quintana Ros", "+34 688 11 22 33", "WhatsApp", "02/07/2026 · 12:00"],
  ])("%s → %s · %s · %s · %s", (id, name, phone, source, createdAt) => {
    const contact = get(id);
    expect(contact.name.text).toBe(name);
    expect(contact.phone?.display ?? null).toBe(phone);
    expect(contact.source.label).toBe(source);
    expect(contact.createdAt.display).toBe(createdAt);
  });

  it("c-003: la cualificación venía como string JSON y se lee (3 hechos en Alquiler)", () => {
    const q = get("c-003").qualification;
    expect(q.status).toBe("ok");
    if (q.status !== "ok") return;
    expect(q.sourceFormat).toBe("json_string");
    expect(q.groups.map((g) => [g.label, g.facts.length])).toEqual([["Alquiler", 3]]);
  });

  it("c-007: las 7 claves de compra se pintan, incluida la desconocida", () => {
    const q = get("c-007").qualification;
    if (q.status !== "ok") throw new Error("sin cualificación");
    const labels = q.groups[0]?.facts.map((f) => f.label);
    expect(labels).toHaveLength(7);
    expect(labels).toContain("Accesibilidad movilidad reducida");
  });

  it("c-008: presupuesto humano de 350.000 € e ingresos declarados sin verificar", () => {
    const q = get("c-008").qualification;
    if (q.status !== "ok") throw new Error("sin cualificación");
    const facts = q.groups.flatMap((g) => g.facts);
    const budget = facts.find((f) => f.key === "budget");
    expect(budget?.provenance.kind).toBe("human");
    expect(plain(budget?.value.display ?? "")).toBe("Hasta 350.000 €");
    const income = facts.find((f) => f.key === "net_income");
    expect(income).toMatchObject({ verified: false, provenance: { kind: "declared" } });
  });

  it("c-013 y c-015: hechos importados de Witei, no 'dichos en conversación'", () => {
    for (const id of ["c-013", "c-015"]) {
      const q = get(id).qualification;
      if (q.status !== "ok") throw new Error("sin cualificación");
      const kinds = new Set(q.groups.flatMap((g) => g.facts.map((f) => f.provenance.kind)));
      expect([...kinds]).toEqual(["import"]);
    }
  });

  it("c-001: _meta no aparece como grupo", () => {
    const q = get("c-001").qualification;
    if (q.status !== "ok") throw new Error("sin cualificación");
    expect(q.groups.map((g) => g.id)).toEqual(["sale", "shared"]);
  });

  it("contactos sin cualificación → vacío (c-004, c-005, c-006, c-009, c-012, c-014)", () => {
    for (const id of ["c-004", "c-005", "c-006", "c-009", "c-012", "c-014"]) {
      expect(get(id).qualification.status).toBe("empty");
    }
  });

  it("c-015: email inválido detectado; c-005: sin teléfono", () => {
    expect(get("c-015").email).toEqual({ raw: "mdolores@@gmail.com", valid: false });
    expect(get("c-005").phone).toBeNull();
  });

  it("c-016: handoff con motivo y hora; el resto sin handoff", () => {
    expect(get("c-016").handoff?.reason).toContain("hablar con un humano");
    expect(get("c-016").handoff?.requestedAt.display).toBe("13/07/2026 · 21:22");
    expect([...contacts.values()].filter((c) => c.handoff).map((c) => c.id)).toEqual(["c-016"]);
  });

  it("c-006: notas de Meta partidas en líneas legibles", () => {
    expect(get("c-006").notes).toEqual([
      "Meta Lead Ads — Campaña: Obra nueva Pozuelo — Julio 2026",
      "Respuestas del formulario: presupuesto: 300.000-400.000",
      "cuándo piensa comprar: 3-6 meses",
      "vivienda actual: de alquiler",
    ]);
  });
});

describe("timeline (R4, D17)", () => {
  it("c-008: dos llamadas, la más reciente primero", () => {
    expect(get("c-008").timeline.map((i) => i.id)).toEqual(["i-1071", "i-1070"]);
  });

  it("c-001: la transcripción se parte en turnos por hablante", () => {
    const call = get("c-001").timeline.find((i) => i.id === "i-1001")?.call;
    expect(call?.durationSec).toBe(412);
    expect(call?.transcript?.[0]).toEqual({ speaker: "Agente", text: "¿Y en qué zona le gustaría buscar?" });
    expect(call?.transcript?.[1]?.speaker).toBe("Carmen");
  });

  it("c-005: el formulario resuelve la referencia contra el catálogo y la fecha DD/MM", () => {
    const form = get("c-005").timeline[0];
    expect(form?.channel.label).toBe("Formulario web");
    expect(form?.propertyRef).toEqual({ ref: "MIR-2041", title: "Piso con terraza en Majadahonda" });
    expect(form?.extra).toEqual([{ label: "Formulario", value: "ficha-propiedad" }]);
    expect(form?.at.display).toBe("11/07/2026 · 18:42");
  });

  it("c-013: el canal EMAIL (no mencionado en R4) se pinta", () => {
    expect(get("c-013").timeline[0]?.channel).toEqual({ kind: "email", label: "Email", raw: "EMAIL" });
  });

  it("c-009: canal en minúsculas normalizado", () => {
    expect(get("c-009").timeline[0]?.channel.label).toBe("WhatsApp");
  });

  it("c-012 y c-014: sin interacciones, sin errores", () => {
    expect(get("c-012").timeline).toEqual([]);
    expect(get("c-012").skippedInteractions).toBe(0);
  });
});
