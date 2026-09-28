import { parseDate } from "../dates";
import { isPlainObject } from "../text";
import type { DateView, DomainContext, Fact, FactGroup, OperationKind, Provenance, QualificationView } from "../types";
import { factDefinition, groupDefinition, OTHER_GROUP_ID } from "./labels";
import { asConfidence, declaredProvenance, LEGACY_PREFERENCES_PROVENANCE, provenanceOf } from "./provenance";
import { toFactValue } from "./values";

/**
 * R3: convierte `qualification_data` (objeto, string JSON o null) en grupos de hechos.
 * Cualquier clave, conocida o no, acaba pintada; nada se descarta en silencio.
 */
export function parseQualification(
  qualificationData: unknown,
  interestPreferences: unknown,
  ctx: DomainContext,
): QualificationView {
  let data = qualificationData;
  let sourceFormat: "object" | "json_string" = "object";

  // D08: c-003 trae la cualificación doblemente codificada.
  if (typeof data === "string") {
    const text = data.trim();
    if (!text) {
      data = null;
    } else {
      try {
        data = JSON.parse(text) as unknown;
        sourceFormat = "json_string";
      } catch {
        return { status: "unreadable", raw: text };
      }
    }
  }

  if (data === null || data === undefined) {
    return fromLegacyPreferences(interestPreferences, ctx) ?? { status: "empty" };
  }
  if (!isPlainObject(data)) return { status: "unreadable", raw: JSON.stringify(data) };

  const builder = new FactGroupsBuilder(ctx);
  let lastSyncedAt: DateView | null = null;
  let lastSource: string | null = null;

  const { qualification, ...rootFields } = data;

  if (isPlainObject(qualification)) {
    for (const [groupId, groupValue] of Object.entries(qualification)) {
      // D09: las claves con "_" son metadatos, no hechos.
      if (groupId.startsWith("_")) {
        if (groupId === "_meta" && isPlainObject(groupValue)) {
          lastSyncedAt = groupValue.lastSyncedAt === undefined ? null : parseDate(groupValue.lastSyncedAt, ctx.timeZone, ctx.locale);
          lastSource = typeof groupValue.lastSource === "string" ? groupValue.lastSource : null;
        }
        continue;
      }
      // Un hecho suelto, sin grupo, se pinta en "Otros datos".
      if (!isPlainObject(groupValue) || isFactEnvelope(groupValue)) {
        builder.add(OTHER_GROUP_ID, groupId, groupValue);
        continue;
      }
      for (const [key, envelope] of Object.entries(groupValue)) {
        if (!key.startsWith("_")) builder.add(groupId, key, envelope);
      }
    }
  } else if (qualification !== undefined && qualification !== null) {
    builder.add(OTHER_GROUP_ID, "qualification", qualification);
  }

  // D15: campos planos de un formato anterior (c-008: net_income, income_*).
  const remaining = applyLegacyAdapters(rootFields, builder);
  for (const [key, value] of Object.entries(remaining)) builder.add(OTHER_GROUP_ID, key, value);

  const groups = builder.build();
  if (!groups.length) return fromLegacyPreferences(interestPreferences, ctx) ?? { status: "empty" };
  return { status: "ok", groups, sourceFormat, lastSyncedAt, lastSource };
}

/** Operaciones (compra / alquiler) presentes en la cualificación, para la cabecera. */
export function operationsOf(view: QualificationView): { kind: OperationKind; label: string }[] {
  if (view.status !== "ok") return [];
  return view.groups.flatMap((group) => {
    const { operation, label } = groupDefinition(group.id);
    return operation ? [{ kind: operation, label }] : [];
  });
}

function isFactEnvelope(value: unknown): value is Record<string, unknown> {
  return isPlainObject(value) && "value" in value;
}

class FactGroupsBuilder {
  private readonly groups = new Map<string, Fact[]>();

  constructor(private readonly ctx: DomainContext) {}

  /** Añade un hecho a partir de su "sobre" ({ value, source, … }) o de un valor suelto. */
  add(groupId: string, key: string, envelopeOrValue: unknown): void {
    if (isFactEnvelope(envelopeOrValue)) {
      const e = envelopeOrValue;
      this.push(groupId, key, e.value, {
        provenance: provenanceOf(e.source, e.sourceRef),
        confidence: asConfidence(e.confidence),
        verified: typeof e.verified === "boolean" ? e.verified : null,
        updatedAt: e.updatedAt,
      });
      return;
    }
    this.push(groupId, key, envelopeOrValue, {
      provenance: provenanceOf(undefined, undefined),
      confidence: null,
      verified: null,
      updatedAt: undefined,
    });
  }

  push(
    groupId: string,
    key: string,
    rawValue: unknown,
    meta: { provenance: Provenance; confidence: Fact["confidence"]; verified: boolean | null; updatedAt: unknown },
  ): void {
    const definition = factDefinition(key);
    const value = toFactValue(rawValue, {
      locale: this.ctx.locale,
      currency: this.ctx.currency,
      money: definition.format === "money",
      monthly: groupDefinition(groupId).operation === "rental",
    });
    const fact: Fact = {
      key,
      label: definition.label,
      labelIsFallback: definition.labelIsFallback,
      value,
      provenance: meta.provenance,
      confidence: meta.confidence,
      verified: meta.verified,
      updatedAt: parseDate(meta.updatedAt, this.ctx.timeZone, this.ctx.locale),
    };
    const facts = this.groups.get(groupId) ?? [];
    facts.push(fact);
    this.groups.set(groupId, facts);
  }

  build(): FactGroup[] {
    return [...this.groups.entries()]
      .map(([id, facts], index) => ({ id, facts, index, def: groupDefinition(id) }))
      .sort((a, b) => a.def.order - b.def.order || a.index - b.index)
      .map(({ id, facts, def }) => ({ id, label: def.label, facts }));
  }
}

// D15: adaptadores explícitos para formatos antiguos conocidos. Añadir otro = añadir un objeto.
type LegacyAdapter = {
  consumes: string[];
  applies: (fields: Record<string, unknown>) => boolean;
  apply: (fields: Record<string, unknown>, builder: FactGroupsBuilder) => void;
};

const LEGACY_ADAPTERS: LegacyAdapter[] = [
  {
    consumes: ["net_income", "income_verified", "income_source", "income_updated_at"],
    applies: (fields) => fields.net_income !== undefined,
    apply: (fields, builder) =>
      builder.push("shared", "net_income", fields.net_income, {
        provenance: declaredProvenance(fields.income_source),
        confidence: null,
        verified: typeof fields.income_verified === "boolean" ? fields.income_verified : null,
        updatedAt: fields.income_updated_at,
      }),
  },
];

function applyLegacyAdapters(fields: Record<string, unknown>, builder: FactGroupsBuilder): Record<string, unknown> {
  const remaining = { ...fields };
  for (const adapter of LEGACY_ADAPTERS) {
    if (!adapter.applies(remaining)) continue;
    adapter.apply(remaining, builder);
    for (const key of adapter.consumes) delete remaining[key];
  }
  return remaining;
}

// D16: `interest_preferences` solo se usa si no hay cualificación.
const LEGACY_OPERATIONS: Record<string, string> = { sale: "sale", rent: "rental", rental: "rental" };

function fromLegacyPreferences(prefs: unknown, ctx: DomainContext): QualificationView | null {
  if (!isPlainObject(prefs)) return null;
  const { operation, ...rest } = prefs;
  const groupId = (typeof operation === "string" && LEGACY_OPERATIONS[operation.toLowerCase()]) || OTHER_GROUP_ID;

  const builder = new FactGroupsBuilder(ctx);
  for (const [key, value] of Object.entries(rest)) {
    builder.push(groupId, key, value, {
      provenance: LEGACY_PREFERENCES_PROVENANCE,
      confidence: null,
      verified: null,
      updatedAt: undefined,
    });
  }
  const groups = builder.build();
  if (!groups.length) return null;
  return { status: "ok", groups, sourceFormat: "legacy_preferences", lastSyncedAt: null, lastSource: null };
}
