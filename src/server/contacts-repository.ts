import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseExport } from "@/domain/dataset";
import type { RawContact } from "@/domain/raw-schema";

export type Organization = { id: string; name: string | null };

export type ContactSnapshot = {
  organization: Organization;
  /** Contactos de la organización activa, incluidos los de prueba (el servicio decide qué se muestra). */
  contacts: RawContact[];
  /** Contactos que no se pudieron leer y se omitieron. */
  unreadableCount: number;
};

/**
 * Fuente de contactos. Hoy es un JSON en disco; mañana, Postgres: basta con otra implementación de esta interfaz.
 * El aislamiento por organización vive aquí, lo más cerca posible del dato (D01).
 */
export interface ContactRepository {
  snapshot(): Promise<ContactSnapshot>;
}

export class JsonContactRepository implements ContactRepository {
  constructor(
    private readonly dataDir: string,
    private readonly organizationIdOverride: string | null,
  ) {}

  async snapshot(): Promise<ContactSnapshot> {
    // Se lee en cada petición: el fichero es pequeño y así un cambio en el JSON se ve sin reiniciar.
    const text = await readFile(path.join(this.dataDir, "contactos.json"), "utf8");
    const parsed = parseExport(JSON.parse(text) as unknown);

    const organizationId = this.organizationIdOverride ?? parsed.organization?.id;
    if (!organizationId) {
      throw new Error("No hay organización activa: el export no trae organization.id y KONTAKTU_ORG_ID no está definido");
    }
    const organization: Organization = {
      id: organizationId,
      name: parsed.organization?.id === organizationId ? parsed.organization.name : null,
    };

    // D01: solo la organización activa. Un contacto sin organization_id tampoco se sirve: no se puede probar que es suyo.
    return {
      organization,
      contacts: parsed.contacts.filter((c) => c.organization_id === organizationId),
      unreadableCount: parsed.invalidContacts,
    };
  }
}
