import { rawContactSchema, rawExportSchema, type RawContact } from "./raw-schema";

export type ParsedExport = {
  organization: { id: string; name: string | null } | null;
  contacts: RawContact[];
  /** Contactos que no se pudieron leer (sin id, por ejemplo). Se omiten y se cuentan; no tumban el resto. */
  invalidContacts: number;
};

export function parseExport(json: unknown): ParsedExport {
  const parsed = rawExportSchema.parse(json);
  const contacts: RawContact[] = [];
  let invalidContacts = 0;
  for (const raw of parsed.contacts) {
    const result = rawContactSchema.safeParse(raw);
    if (result.success) contacts.push(result.data);
    else invalidContacts += 1;
  }
  return {
    organization: parsed.organization ? { id: parsed.organization.id, name: parsed.organization.name ?? null } : null,
    contacts,
    invalidContacts,
  };
}
