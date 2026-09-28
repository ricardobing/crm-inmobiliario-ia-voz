import { isPlainObject } from "../text";
import type { FactValue } from "../types";
import { valueKeyLabel } from "./labels";

// D12: el valor se pinta según su tipo real, no según la clave. El texto se muestra tal cual:
// "1.100 €" no se reinterpreta (parseFloat("1.100") daría 1.1).

export type ValueFormat = {
  locale: string;
  currency: string;
  /** Pista de formato de la clave (presupuesto, ingresos…). */
  money: boolean;
  /** true en alquiler: los importes son mensuales. */
  monthly: boolean;
};

const MAX_DEPTH = 2;
const EMPTY_LABEL = "Sin dato";

export function toFactValue(raw: unknown, format: ValueFormat, depth = 0): FactValue {
  if (raw === null || raw === undefined) return empty();

  if (typeof raw === "string") {
    const value = raw.trim();
    return value ? { type: "text", value, display: value } : empty();
  }

  if (typeof raw === "number") {
    return Number.isFinite(raw) ? { type: "number", value: raw, display: formatNumber(raw, format) } : empty();
  }

  if (typeof raw === "boolean") {
    return { type: "boolean", value: raw, display: raw ? "Sí" : "No" };
  }

  if (Array.isArray(raw)) {
    const items = raw.map((item) => primitiveToText(item, format)).filter((item): item is string => item !== null);
    return items.length ? { type: "list", items, display: items.join(", ") } : empty();
  }

  if (isPlainObject(raw)) {
    const range = asRange(raw);
    if (range) return { type: "range", ...range, display: formatRange(range, format) };

    if (depth >= MAX_DEPTH) return { type: "text", value: JSON.stringify(raw), display: JSON.stringify(raw) };
    const entries = Object.entries(raw).map(([key, value]) => ({
      key,
      label: valueKeyLabel(key),
      value: toFactValue(value, format, depth + 1),
    }));
    if (!entries.length) return empty();
    return { type: "object", entries, display: entries.map((e) => `${e.label}: ${e.value.display}`).join(" · ") };
  }

  return { type: "text", value: String(raw), display: String(raw) };
}

function empty(): FactValue {
  return { type: "empty", display: EMPTY_LABEL };
}

function asRange(obj: Record<string, unknown>): { min?: number; max?: number } | null {
  const keys = Object.keys(obj);
  if (!keys.length || !keys.every((k) => k === "min" || k === "max")) return null;
  const min = obj.min;
  const max = obj.max;
  const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  if ((min !== undefined && !isNum(min)) || (max !== undefined && !isNum(max))) return null;
  return { ...(isNum(min) ? { min } : {}), ...(isNum(max) ? { max } : {}) };
}

function formatNumber(value: number, format: ValueFormat): string {
  // useGrouping "always": en es-ES, Intl no agrupa los números de 4 cifras ("1400 €"), pero el sector escribe
  // "1.400 €" (así vienen los resúmenes de las llamadas).
  if (!format.money) return new Intl.NumberFormat(format.locale, { useGrouping: "always" }).format(value);
  const amount = new Intl.NumberFormat(format.locale, {
    style: "currency",
    currency: format.currency,
    maximumFractionDigits: 0,
    useGrouping: "always",
  }).format(value);
  return format.monthly ? `${amount}/mes` : amount;
}

function formatRange(range: { min?: number; max?: number }, format: ValueFormat): string {
  const { min, max } = range;
  if (min !== undefined && max !== undefined) return `${formatNumber(min, format)} – ${formatNumber(max, format)}`;
  if (max !== undefined) return `Hasta ${formatNumber(max, format)}`;
  if (min !== undefined) return `Desde ${formatNumber(min, format)}`;
  return EMPTY_LABEL;
}

function primitiveToText(value: unknown, format: ValueFormat): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return Number.isFinite(value) ? formatNumber(value, format) : null;
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return JSON.stringify(value);
}
