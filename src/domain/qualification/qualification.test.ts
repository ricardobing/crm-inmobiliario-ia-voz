import { describe, expect, it } from "vitest";
import type { DomainContext, Fact, QualificationView } from "../types";
import { operationsOf, parseQualification } from "./parse";
import { resolveFact } from "./precedence";

const ctx: DomainContext = { timeZone: "Europe/Madrid", locale: "es-ES", currency: "EUR", phoneRegion: "ES" };
// Intl separa el importe y el "€" con un espacio duro (U+00A0).
const plain = (s: string) => s.replace(/ /g, " ");

function ok(view: QualificationView) {
  if (view.status !== "ok") throw new Error(`se esperaba status ok y llegó ${view.status}`);
  return view;
}
function fact(view: QualificationView, groupId: string, key: string): Fact {
  const found = ok(view).groups.find((g) => g.id === groupId)?.facts.find((f) => f.key === key);
  if (!found) throw new Error(`no existe ${groupId}.${key}`);
  return found;
}

const c001 = {
  qualification: {
    sale: {
      zones: { value: ["Majadahonda"], source: "explicit", confidence: "high", updatedAt: "2026-07-08T10:32:00Z", sourceRef: "conv-8812" },
      budget: { value: { max: 480000 }, source: "explicit", confidence: "high", updatedAt: "2026-07-08T10:33:10Z", sourceRef: "conv-8812" },
      terrace: { value: true, source: "explicit", confidence: "medium", updatedAt: "2026-07-08T10:35:20Z", sourceRef: "conv-8812" },
    },
    shared: {
      has_pets: { value: true, source: "explicit", confidence: "high", updatedAt: "2026-07-08T10:34:30Z", sourceRef: "conv-8812" },
    },
    _meta: { lastSyncedAt: "2026-07-08T10:36:00Z", lastSource: "voice" },
  },
};

describe("parseQualification (R3)", () => {
  it("agrupa por operación, en orden compra/alquiler → comunes, y _meta no es un grupo (D09, D10)", () => {
    const view = ok(parseQualification(c001, null, ctx));
    expect(view.groups.map((g) => g.label)).toEqual(["Compra", "Comunes"]);
    expect(view.lastSyncedAt?.display).toBe("08/07/2026 · 12:36");
    expect(view.lastSource).toBe("voice");
    expect(operationsOf(view)).toEqual([{ kind: "sale", label: "Compra" }]);
  });

  it("pinta cada valor según su tipo (D12)", () => {
    const view = parseQualification(c001, null, ctx);
    expect(fact(view, "sale", "zones").value).toMatchObject({ type: "list", items: ["Majadahonda"] });
    expect(plain(fact(view, "sale", "budget").value.display)).toBe("Hasta 480.000 €");
    expect(fact(view, "sale", "terrace").value).toMatchObject({ type: "boolean", display: "Sí" });
    expect(fact(view, "sale", "terrace").confidence).toBe("medium");
  });

  it("procedencia: conversación con referencia (D13)", () => {
    expect(fact(parseQualification(c001, null, ctx), "sale", "zones").provenance).toEqual({
      kind: "conversation",
      label: "Dicho por el cliente",
      ref: "conv-8812",
    });
  });

  it("texto con números se muestra tal cual y sin confianza inventada (c-002)", () => {
    const view = parseQualification(
      { qualification: { rental: { budget: { value: "1.100 €", source: "explicit", updatedAt: "2026-07-09T17:15:00Z", sourceRef: "conv-8845" } } } },
      null,
      ctx,
    );
    const budget = fact(view, "rental", "budget");
    expect(budget.value).toEqual({ type: "text", value: "1.100 €", display: "1.100 €" });
    expect(budget.confidence).toBeNull();
  });

  it("presupuesto numérico en alquiler es mensual y agrupa miles (c-003)", () => {
    const raw = JSON.stringify({ qualification: { rental: { budget: { value: 1400, source: "explicit" } } } });
    const view = ok(parseQualification(raw, null, ctx));
    expect(view.sourceFormat).toBe("json_string");
    expect(plain(fact(view, "rental", "budget").value.display)).toBe("1.400 €/mes");
  });

  it("string JSON inválido → ilegible, con el crudo (D08)", () => {
    expect(parseQualification('{"qualification": {', null, ctx)).toEqual({ status: "unreadable", raw: '{"qualification": {' });
  });

  it("claves desconocidas se pintan con etiqueta generada (c-007, D11)", () => {
    const view = parseQualification(
      { qualification: { sale: { accesibilidad_movilidad_reducida: { value: true, source: "explicit" }, elevator: { value: "imprescindible", source: "explicit" } } } },
      null,
      ctx,
    );
    expect(fact(view, "sale", "accesibilidad_movilidad_reducida")).toMatchObject({ label: "Accesibilidad movilidad reducida", labelIsFallback: true });
    expect(fact(view, "sale", "elevator")).toMatchObject({ label: "Ascensor", labelIsFallback: false });
  });

  it("un grupo que no conocíamos también se pinta", () => {
    const view = ok(parseQualification({ qualification: { investment: { yield: { value: 0.05, source: "explicit" } } } }, null, ctx));
    expect(view.groups[0]).toMatchObject({ id: "investment", label: "Investment" });
  });

  it("lo editado a mano es 'humano' (c-008, D13)", () => {
    const view = parseQualification(
      { qualification: { sale: { budget: { value: { max: 350000 }, source: "manual", updatedAt: "2026-07-10T09:15:00Z", sourceRef: "manual" } } } },
      null,
      ctx,
    );
    expect(fact(view, "sale", "budget").provenance.kind).toBe("human");
  });

  it("explicit + import-witei es importado, no conversación (c-013, D13)", () => {
    const view = parseQualification(
      { qualification: { sale: { zones: { value: ["Boadilla del Monte"], source: "explicit", updatedAt: "2026-05-20T10:00:00Z", sourceRef: "import-witei" } } } },
      null,
      ctx,
    );
    expect(fact(view, "sale", "zones").provenance).toEqual({ kind: "import", label: "Importado de Witei", system: "Witei" });
  });

  it("campos planos antiguos se convierten en hechos (c-008, D15)", () => {
    const view = parseQualification(
      { net_income: 3200, income_verified: false, income_source: "declarado en llamada", income_updated_at: "2026-07-05T11:26:00Z", qualification: {} },
      null,
      ctx,
    );
    const income = fact(view, "shared", "net_income");
    expect(plain(income.value.display)).toBe("3.200 €");
    expect(income.verified).toBe(false);
    expect(income.provenance).toMatchObject({ kind: "declared", label: "Declarado en llamada" });
    expect(income.updatedAt.display).toBe("05/07/2026 · 13:26");
    expect(ok(view).groups.some((g) => g.id === "other")).toBe(false);
  });

  it("un campo plano desconocido no se pierde: va a 'Otros datos'", () => {
    const view = parseQualification({ scoring: 72, qualification: {} }, null, ctx);
    expect(fact(view, "other", "scoring").value.display).toBe("72");
  });

  it("null → vacío; sin cualificación se usa interest_preferences como respaldo (D16)", () => {
    expect(parseQualification(null, null, ctx)).toEqual({ status: "empty" });
    const view = ok(parseQualification(null, { operation: "SALE", zones: ["Majadahonda"], budget_max: 480000 }, ctx));
    expect(view.sourceFormat).toBe("legacy_preferences");
    expect(fact(view, "sale", "budget_max").provenance.kind).toBe("legacy_preferences");
  });

  it("si hay cualificación, interest_preferences se ignora (D16)", () => {
    const view = ok(parseQualification(c001, { operation: "SALE", budget_max: 1 }, ctx));
    expect(view.sourceFormat).toBe("object");
    expect(view.groups.flatMap((g) => g.facts).some((f) => f.key === "budget_max")).toBe(false);
  });

  it("valores raros no rompen: null, objetos anidados, arrays vacíos", () => {
    const view = parseQualification(
      { qualification: { shared: { a: { value: null }, b: { value: { nested: { deep: { deeper: 1 } } } }, c: { value: [] }, d: "suelto" } } },
      null,
      ctx,
    );
    expect(fact(view, "shared", "a").value.type).toBe("empty");
    expect(fact(view, "shared", "b").value.type).toBe("object");
    expect(fact(view, "shared", "c").value.type).toBe("empty");
    expect(fact(view, "shared", "d")).toMatchObject({ value: { type: "text", value: "suelto" }, provenance: { kind: "unknown" } });
  });
});

describe("resolveFact (D14)", () => {
  const base = parseQualification(
    {
      qualification: {
        sale: {
          conv: { value: 300000, source: "explicit", updatedAt: "2026-07-05T11:25:00Z", sourceRef: "conv-8740" },
          human: { value: 350000, source: "manual", updatedAt: "2026-07-10T09:15:00Z", sourceRef: "manual" },
          newerConv: { value: 320000, source: "explicit", updatedAt: "2026-07-12T09:00:00Z", sourceRef: "conv-9000" },
          imported: { value: 1, source: "explicit", updatedAt: "2026-07-20T09:00:00Z", sourceRef: "import-witei" },
        },
      },
    },
    null,
    ctx,
  );
  const [conv, human, newerConv, imported] = ["conv", "human", "newerConv", "imported"].map((k) => fact(base, "sale", k)) as [Fact, Fact, Fact, Fact];

  it("lo humano manda aunque sea más antiguo", () => {
    expect(resolveFact([conv, newerConv, human, imported])?.winner).toBe(human);
  });
  it("entre conversaciones, la más reciente", () => {
    expect(resolveFact([conv, newerConv])?.winner).toBe(newerConv);
  });
  it("la conversación gana a la importación aunque esta sea más reciente", () => {
    expect(resolveFact([imported, conv])?.winner).toBe(conv);
  });
  it("sin candidatos → null", () => {
    expect(resolveFact([])).toBeNull();
  });
});
