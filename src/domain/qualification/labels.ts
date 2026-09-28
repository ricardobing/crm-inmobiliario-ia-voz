import { humanize } from "../text";
import type { OperationKind } from "../types";

// D10–D11: diccionarios que MEJORAN la presentación. Si una clave o grupo no está aquí, se pinta igual con una
// etiqueta generada a partir de la clave: nunca se descarta un dato.

type GroupDefinition = { label: string; order: number; operation?: OperationKind };

const GROUPS: Record<string, GroupDefinition> = {
  sale: { label: "Compra", order: 10, operation: "sale" },
  rental: { label: "Alquiler", order: 20, operation: "rental" },
  shared: { label: "Comunes", order: 80 },
};

export const OTHER_GROUP_ID = "other";
const OTHER_GROUP: GroupDefinition = { label: "Otros datos", order: 90 };
const UNKNOWN_GROUP_ORDER = 50;

export function groupDefinition(groupId: string): GroupDefinition {
  if (groupId === OTHER_GROUP_ID) return OTHER_GROUP;
  return GROUPS[groupId] ?? { label: humanize(groupId), order: UNKNOWN_GROUP_ORDER };
}

export type FactFormatHint = "money";

type FactDefinition = { label: string; format?: FactFormatHint };

const FACTS: Record<string, FactDefinition> = {
  zones: { label: "Zonas" },
  budget: { label: "Presupuesto", format: "money" },
  bedrooms: { label: "Habitaciones" },
  financing: { label: "Financiación" },
  terrace: { label: "Terraza" },
  has_pets: { label: "Mascotas" },
  urgency: { label: "Urgencia" },
  floor_pref: { label: "Planta" },
  elevator: { label: "Ascensor" },
  orientation: { label: "Orientación" },
  garage: { label: "Garaje" },
  net_income: { label: "Ingresos netos mensuales", format: "money" },
  // Claves de `interest_preferences` (formato anterior, D16).
  budget_max: { label: "Presupuesto máximo", format: "money" },
  bedrooms_min: { label: "Habitaciones mínimas" },
};

export function factDefinition(key: string): { label: string; labelIsFallback: boolean; format?: FactFormatHint } {
  const known = FACTS[key];
  if (known) return { ...known, labelIsFallback: false };
  return { label: humanize(key), labelIsFallback: true };
}

/** Etiquetas de subclaves de valores objeto ({ min, max } fuera de rango, u otros). */
const VALUE_KEYS: Record<string, string> = { min: "Mínimo", max: "Máximo" };

export function valueKeyLabel(key: string): string {
  return VALUE_KEYS[key] ?? humanize(key);
}
