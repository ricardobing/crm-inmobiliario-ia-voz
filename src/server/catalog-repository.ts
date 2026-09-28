import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { CatalogProperty } from "@/domain/types";

// Catálogo de inmuebles (el mismo fichero que usa el agente de voz). Solo se lee lo que la ficha necesita.
const catalogSchema = z.looseObject({
  properties: z.array(z.looseObject({ ref: z.string().min(1), titulo: z.string().min(1) })),
});

export async function loadCatalog(dataDir: string): Promise<ReadonlyMap<string, CatalogProperty>> {
  try {
    const text = await readFile(path.join(dataDir, "kb-propiedades-voz.json"), "utf8");
    const { properties } = catalogSchema.parse(JSON.parse(text) as unknown);
    return new Map(properties.map((p) => [p.ref, { ref: p.ref, title: p.titulo }]));
  } catch (error) {
    // Sin catálogo la ficha sigue funcionando: la referencia del inmueble se muestra sin título.
    console.warn("[catalog] no se pudo leer el catálogo de inmuebles", error);
    return new Map();
  }
}
