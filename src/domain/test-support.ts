// Solo para tests: carga el dataset real con el mismo camino que usa el servidor.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseExport } from "./dataset";
import { normalizeContact } from "./normalize-contact";
import type { CatalogProperty, ContactCore, DomainContext } from "./types";

export const TEST_CONTEXT: DomainContext = { timeZone: "Europe/Madrid", locale: "es-ES", currency: "EUR", phoneRegion: "ES" };

const readJson = (file: string): unknown => JSON.parse(readFileSync(join(process.cwd(), "data", file), "utf8"));

export function loadCatalog(): Map<string, CatalogProperty> {
  const kb = readJson("kb-propiedades-voz.json") as { properties: { ref: string; titulo: string }[] };
  return new Map(kb.properties.map((p) => [p.ref, { ref: p.ref, title: p.titulo }]));
}

export function loadDataset() {
  return parseExport(readJson("contactos.json"));
}

export function loadNormalizedContacts(): Map<string, ContactCore> {
  const catalog = loadCatalog();
  return new Map(loadDataset().contacts.map((raw) => [raw.id, normalizeContact(raw, TEST_CONTEXT, catalog)]));
}

/** Intl separa importe y "€" con un espacio duro (U+00A0). */
export const plain = (s: string) => s.replace(/ /g, " ");
