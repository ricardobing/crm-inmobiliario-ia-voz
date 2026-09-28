import "server-only";
import { evaluatePolicy } from "@/domain/compliance";
import { buildMergePreview, findDuplicates } from "@/domain/duplicates";
import { suggestNextActions } from "@/domain/next-action/engine";
import { normalizeContact, toContactSummary } from "@/domain/normalize-contact";
import type { ContactCore, ContactDetail, DomainContext } from "@/domain/types";
import type { ContactDetailResponse, ContactListResponse } from "@/lib/api/contracts";
import { loadCatalog } from "./catalog-repository";
import { config } from "./config";
import { JsonContactRepository, type ContactRepository } from "./contacts-repository";

/**
 * Compone el caso de uso: lee, normaliza y aplica las reglas de negocio.
 * Los route handlers solo traducen esto a HTTP.
 */
export class ContactService {
  constructor(
    private readonly repository: ContactRepository,
    private readonly dataDir: string,
    private readonly domain: DomainContext,
  ) {}

  async list(): Promise<ContactListResponse> {
    const { organization, contacts, unreadableCount } = await this.loadNormalized();
    // D02: los contactos de prueba no se listan (sí se pueden abrir por URL).
    const visible = contacts.filter((c) => !c.isTest);
    return {
      organization,
      contacts: visible.map((c) => {
        const detail = enrich(c, contacts);
        return toContactSummary(c, {
          handoff: c.handoff !== null,
          doNotCall: detail.policy.doNotCall,
          possibleDuplicate: detail.duplicates.length > 0,
        });
      }),
      hiddenTestCount: contacts.length - visible.length,
      unreadableCount,
    };
  }

  async get(id: string): Promise<ContactDetailResponse | null> {
    const { organization, contacts } = await this.loadNormalized();
    const contact = contacts.find((c) => c.id === id);
    return contact ? { organization, contact: enrich(contact, contacts) } : null;
  }

  private async loadNormalized() {
    const [snapshot, catalog] = await Promise.all([this.repository.snapshot(), loadCatalog(this.dataDir)]);
    return {
      organization: snapshot.organization,
      unreadableCount: snapshot.unreadableCount,
      contacts: snapshot.contacts.map((raw) => normalizeContact(raw, this.domain, catalog)),
    };
  }
}

/** Reglas de negocio sobre el contacto normalizado: cumplimiento (#10), duplicados (#2) y siguiente acción (#4). */
function enrich(contact: ContactCore, organizationContacts: readonly ContactCore[]): ContactDetail {
  const policy = evaluatePolicy(contact);
  const duplicates = findDuplicates(contact, organizationContacts);
  const firstDuplicate = duplicates[0] ? organizationContacts.find((c) => c.id === duplicates[0]?.id) : undefined;
  return {
    ...contact,
    policy,
    duplicates,
    mergePreview: firstDuplicate ? buildMergePreview(contact, firstDuplicate) : null,
    nextActions: suggestNextActions({ contact, policy, duplicates }),
  };
}

export const contactService = new ContactService(
  new JsonContactRepository(config.dataDir, config.organizationIdOverride),
  config.dataDir,
  config.domain,
);
