/** Utilidades de texto compartidas por el dominio. */

export function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/** Clave comparable: sin tildes, en minúsculas, con separadores unificados ("Meta Lead-Ads" → "meta_lead_ads"). */
export function toLookupKey(value: string): string {
  return stripAccents(value.trim().toLowerCase()).replace(/[\s\-.]+/g, "_");
}

/** "accesibilidad_movilidad_reducida" → "Accesibilidad movilidad reducida"; "META_LEAD_ADS" → "Meta lead ads". */
export function humanize(value: string): string {
  const spaced = value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es");
  if (!spaced) return value;
  return spaced.charAt(0).toLocaleUpperCase("es") + spaced.slice(1);
}

export function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
