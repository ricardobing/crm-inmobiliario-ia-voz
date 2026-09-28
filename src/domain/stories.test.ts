import { describe, expect, it } from "vitest";
import { DEFAULT_COMPLIANCE, evaluatePolicy } from "./compliance";
import { buildMergePreview, findDuplicates } from "./duplicates";
import { suggestNextActions } from "./next-action/engine";
import type { NextActionRule } from "./next-action/rules";
import { loadNormalizedContacts } from "./test-support";
import type { ContactCore } from "./types";

const contacts = loadNormalizedContacts();
const all = [...contacts.values()];
const org = all.filter((c) => c.organizationId === "ORG-0031");
const get = (id: string): ContactCore => {
  const c = contacts.get(id);
  if (!c) throw new Error(`falta ${id}`);
  return c;
};
const insightsOf = (id: string) => {
  const contact = get(id);
  const policy = evaluatePolicy(contact);
  const duplicates = findDuplicates(contact, org);
  return { contact, policy, duplicates, actions: suggestNextActions({ contact, policy, duplicates }) };
};

describe("#10 Cumplimiento: evaluatePolicy (D20, D21)", () => {
  it("c-013 (no-llamar): sin llamada ni WhatsApp, con email y el motivo", () => {
    const policy = evaluatePolicy(get("c-013"));
    expect(policy.doNotCall).toBe(true);
    expect(policy.call.allowed).toBe(false);
    expect(policy.whatsapp.allowed).toBe(false);
    expect(policy.email.allowed).toBe(true);
    expect(policy.call.reasons[0]).toContain("no-llamar");
    expect(policy.aiAutomation.allowed).toBe(false);
  });

  it("c-015: email con formato no válido bloquea solo el email", () => {
    const policy = evaluatePolicy(get("c-015"));
    expect(policy.email).toEqual({ allowed: false, reasons: ["Email con formato no válido"] });
    expect(policy.call.allowed).toBe(true);
  });

  it("c-005: sin teléfono no hay llamada ni WhatsApp", () => {
    const policy = evaluatePolicy(get("c-005"));
    expect(policy.call.reasons).toEqual(["Sin teléfono válido"]);
    expect(policy.whatsapp.allowed).toBe(false);
    expect(policy.email.allowed).toBe(true);
  });

  it("c-016 (handoff): la IA no responde; una persona sí puede llamar", () => {
    const policy = evaluatePolicy(get("c-016"));
    expect(policy.aiAutomation.allowed).toBe(false);
    expect(policy.call.allowed).toBe(true);
  });

  it("c-014 (prueba): todo bloqueado", () => {
    const policy = evaluatePolicy(get("c-014"));
    expect([policy.call, policy.whatsapp, policy.email].every((p) => !p.allowed)).toBe(true);
  });

  it("el consentimiento se informa como no registrado y no bloquea (c-001)", () => {
    const policy = evaluatePolicy(get("c-001"));
    expect(policy.consent).toBe("not_recorded");
    expect(policy.call.allowed).toBe(true);
  });

  it("las etiquetas de no-llamar son configurables y se comparan sin mayúsculas ni separadores", () => {
    const contact = { ...get("c-001"), tags: ["Baja Comercial"] };
    expect(evaluatePolicy(contact).doNotCall).toBe(false);
    expect(evaluatePolicy(contact, { ...DEFAULT_COMPLIANCE, doNotCallTags: ["baja-comercial"] }).doNotCall).toBe(true);
    expect(evaluatePolicy({ ...get("c-001"), tags: ["NO LLAMAR"] }).doNotCall).toBe(true);
  });
});

describe("#2 Duplicados: findDuplicates (D22)", () => {
  it("c-001 y c-009 se señalan mutuamente con confianza alta y motivos", () => {
    const a = findDuplicates(get("c-001"), org);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ id: "c-009", confidence: "high" });
    expect(a[0]?.reasons[0]).toBe("Mismo teléfono (+34 655 12 34 56)");
    expect(a[0]?.reasons[1]).toContain("Nombre compatible");
    expect(findDuplicates(get("c-009"), org).map((d) => d.id)).toEqual(["c-001"]);
  });

  it("ningún otro contacto de la organización tiene duplicados", () => {
    const withDuplicates = org.filter((c) => findDuplicates(c, org).length > 0).map((c) => c.id);
    expect(withDuplicates.sort()).toEqual(["c-001", "c-009"]);
  });

  it("nunca cruza organizaciones", () => {
    const clone = { ...get("c-001"), id: "x-1", organizationId: "ORG-0047" };
    expect(findDuplicates(clone, [...all, clone]).map((d) => d.id)).toEqual([]);
  });

  it("el nombre solo no basta: dos «Carmen Ruiz» con teléfonos distintos no son duplicado", () => {
    const other = { ...get("c-009"), id: "x-2", phone: { raw: "600111222", e164: "+34600111222", display: "+34 600 11 12 22", valid: true } };
    expect(findDuplicates(get("c-001"), [get("c-001"), other])).toEqual([]);
  });

  it("mismo teléfono con nombres distintos → confianza media", () => {
    const other = { ...get("c-009"), id: "x-3", name: { ...get("c-009").name, text: "Pedro Gómez" } };
    expect(findDuplicates(get("c-001"), [other])[0]).toMatchObject({ confidence: "medium" });
  });

  it("los contactos de prueba no participan", () => {
    expect(findDuplicates(get("c-014"), org)).toEqual([]);
  });
});

describe("#2 Propuesta de fusión (D14, D22)", () => {
  const preview = buildMergePreview(get("c-009"), get("c-001"));
  const field = (name: string) => preview.fields.find((f) => f.field === name);

  it("sobrevive c-001 (más información), aunque se pida desde c-009", () => {
    expect(preview).toMatchObject({ survivorId: "c-001", mergedId: "c-009" });
  });
  it("campo a campo, con la regla aplicada", () => {
    expect(field("Nombre")).toMatchObject({ value: "Carmen Ruiz Delgado", fromId: "c-001" });
    expect(field("Teléfono")?.rule).toContain("Mismo número");
    expect(field("Origen")?.value).toBe("Llamada (+ WhatsApp)");
    expect(field("Alta")).toMatchObject({ value: "08/07/2026 · 12:28", fromId: "c-001" });
    expect(field("Cualificación")?.value).toBe("7 datos (7 de c-001, 0 de c-009)");
    expect(field("Actividad")?.value).toBe("3 interacciones");
  });
  it("en la cualificación manda lo editado por una persona (D14)", () => {
    const human = get("c-008");
    const conversation = { ...get("c-001"), id: "x-4" };
    const merged = buildMergePreview(conversation, human);
    expect(merged.fields.find((f) => f.field === "Cualificación")?.rule).toContain("Persona > conversación");
  });
});

describe("#4 Siguiente mejor acción: tabla de docs/decisiones.md §5 (D23)", () => {
  it.each([
    ["c-001", ["possible-duplicate", "propose-properties"], ["none", "call"]],
    ["c-002", ["propose-properties"], ["call"]],
    ["c-003", ["propose-properties"], ["call"]],
    ["c-004", ["unanswered-inbound", "qualify"], ["whatsapp", "call"]],
    ["c-005", ["unanswered-inbound", "qualify"], ["email", "email"]],
    ["c-006", ["qualify"], ["call"]],
    ["c-007", ["propose-properties"], ["call"]],
    ["c-008", ["propose-properties"], ["call"]],
    ["c-009", ["possible-duplicate", "unanswered-inbound", "qualify"], ["none", "whatsapp", "call"]],
    ["c-012", ["qualify"], ["call"]],
    ["c-013", ["do-not-call", "unanswered-inbound", "complete-qualification"], ["email", "email", "email"]],
    ["c-014", ["test-contact"], ["none"]],
    ["c-015", ["propose-properties", "fix-email"], ["call", "none"]],
    ["c-016", ["handoff", "propose-properties"], ["call", "call"]],
  ])("%s → %j", (id, ruleIds, channels) => {
    const { actions } = insightsOf(id);
    expect(actions.map((a) => a.ruleId)).toEqual(ruleIds);
    expect(actions.map((a) => a.channel)).toEqual(channels);
  });

  it("cada sugerencia explica por qué", () => {
    for (const c of org) {
      for (const action of insightsOf(c.id).actions) expect(action.reason.length).toBeGreaterThan(10);
    }
  });

  it("nunca sugiere un canal bloqueado por cumplimiento (c-013 no-llamar)", () => {
    const { actions, policy } = insightsOf("c-013");
    expect(policy.call.allowed).toBe(false);
    expect(actions.some((a) => a.channel === "call" || a.channel === "whatsapp")).toBe(false);
  });

  it("si ningún canal está permitido, lo dice en vez de sugerir uno bloqueado", () => {
    const contact = { ...get("c-012"), tags: ["no-llamar"] };
    const policy = evaluatePolicy(contact);
    const actions = suggestNextActions({ contact, policy, duplicates: [] });
    expect(actions[0]?.ruleId).toBe("do-not-call");
    expect(actions[0]?.channel).toBe("none");
    expect(actions[0]?.reason).toContain("No hay ningún canal permitido");
  });

  it("máximo 3 sugerencias, y las reglas son extensibles", () => {
    const extra: NextActionRule = {
      id: "custom",
      priority: 999,
      applies: () => true,
      build: () => ({ title: "Regla nueva", reason: "Añadida sin tocar el motor.", channels: ["email"] }),
    };
    const { contact, policy, duplicates } = insightsOf("c-008");
    const actions = suggestNextActions({ contact, policy, duplicates }, [extra]);
    expect(actions).toEqual([{ ruleId: "custom", priority: 999, title: "Regla nueva", reason: "Añadida sin tocar el motor.", channel: "email" }]);
  });

  it("una llamada entrante no cuenta como mensaje sin responder (c-002)", () => {
    expect(insightsOf("c-002").actions.map((a) => a.ruleId)).not.toContain("unanswered-inbound");
  });
});
