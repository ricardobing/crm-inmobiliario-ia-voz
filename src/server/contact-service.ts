import "server-only";
import { normalizeContact, toContactSummary } from "@/domain/normalize-contact";
import type { ContactCore, ContactDetail, ContactPolicy } from "@/domain/types";
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
  ) {}

  async list(): Promise<ContactListResponse> {
    const { organization, contacts, unreadableCount } = await this.loadNormalized();
    // D02: los contactos de prueba no se listan (sí se pueden abrir por URL).
    const visible = contacts.filter((c) => !c.isTest);
    return {
      organization,
      contacts: visible.map((c) => {
        const detail = this.enrich(c);
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
    return contact ? { organization, contact: this.enrich(contact) } : null;
  }

  private async loadNormalized() {
    const [snapshot, catalog] = await Promise.all([this.repository.snapshot(), loadCatalog(this.dataDir)]);
    return {
      organization: snapshot.organization,
      unreadableCount: snapshot.unreadableCount,
      contacts: snapshot.contacts.map((raw) => normalizeContact(raw, config.domain, catalog)),
    };
  }

  private enrich(contact: ContactCore): ContactDetail {
    return { ...contact, policy: OPEN_POLICY, duplicates: [], mergePreview: null, nextActions: [] };
  }
}

const allowed = { allowed: true, reasons: [] };
const OPEN_POLICY: ContactPolicy = {
  call: allowed,
  whatsapp: allowed,
  email: allowed,
  aiAutomation: allowed,
  consent: "not_recorded",
  doNotCall: false,
};

export const contactService = new ContactService(
  new JsonContactRepository(config.dataDir, config.organizationIdOverride),
  config.dataDir,
);
