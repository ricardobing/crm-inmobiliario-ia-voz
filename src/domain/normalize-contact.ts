import { normalizeChannel, UNKNOWN_SOURCE_LABEL } from "./channels";
import { parseDate } from "./dates";
import { normalizeEmail } from "./email";
import { buildDisplayName } from "./names";
import { normalizePhone } from "./phones";
import { operationsOf, parseQualification } from "./qualification/parse";
import type { RawContact } from "./raw-schema";
import { asNonEmptyString, humanize, toLookupKey } from "./text";
import { buildTimeline } from "./timeline";
import type { CatalogProperty, ContactCore, ContactSummary, ContactTypeView, DomainContext } from "./types";

const CONTACT_TYPES: Record<string, string> = { interested: "Interesado" };
const NOTE_SEPARATOR = " · ";
const PREVIEW_MAX_LENGTH = 140;

/** Crudo → vista normalizada. No aplica reglas de negocio (eso es compliance / duplicates / next-action). */
export function normalizeContact(
  raw: RawContact,
  ctx: DomainContext,
  catalog: ReadonlyMap<string, CatalogProperty>,
): ContactCore {
  const phone = normalizePhone(raw.phone, ctx.phoneRegion);
  const email = normalizeEmail(raw.email);
  const qualification = parseQualification(raw.qualification_data, raw.interest_preferences, ctx);
  const timeline = buildTimeline(raw.interactions, ctx, catalog);

  return {
    id: raw.id,
    organizationId: raw.organization_id ?? null,
    name: buildDisplayName({ fullName: raw.full_name, phone, email }),
    phone,
    email,
    source: normalizeChannel(raw.lead_source, UNKNOWN_SOURCE_LABEL),
    contactType: toContactType(raw.contact_type),
    createdAt: parseDate(raw.created_at, ctx.timeZone, ctx.locale),
    isTest: raw.is_test === true,
    assignedAgentId: asNonEmptyString(raw.assigned_agent_id),
    matchingEnabled: raw.matching_enabled ?? null,
    tags: (raw.tags ?? []).map(asNonEmptyString).filter((t): t is string => t !== null),
    // D18: las notas se muestran tal cual, partidas para leerlas mejor; no se convierten en hechos.
    notes: (asNonEmptyString(raw.notes) ?? "")
      .split(NOTE_SEPARATOR)
      .map((n) => n.trim())
      .filter(Boolean),
    // D21
    handoff:
      raw.ai_handoff === true
        ? {
            reason: asNonEmptyString(raw.handoff_reason),
            requestedAt: parseDate(raw.handoff_requested_at, ctx.timeZone, ctx.locale),
          }
        : null,
    qualification,
    operations: operationsOf(qualification),
    timeline: timeline.items,
    skippedInteractions: timeline.skipped,
  };
}

function toContactType(raw: string | null | undefined): ContactTypeView {
  const value = asNonEmptyString(raw);
  if (!value) return null;
  return { raw: value, label: CONTACT_TYPES[toLookupKey(value)] ?? humanize(value) };
}

export function toContactSummary(contact: ContactCore, flags: ContactSummary["flags"]): ContactSummary {
  const last = contact.timeline[0] ?? null;
  return {
    id: contact.id,
    name: contact.name,
    phone: contact.phone,
    source: contact.source,
    createdAt: contact.createdAt,
    lastInteraction: last
      ? { at: last.at, channel: last.channel, direction: last.direction, preview: truncate(last.content) }
      : null,
    flags,
  };
}

function truncate(text: string | null): string | null {
  if (!text) return null;
  return text.length > PREVIEW_MAX_LENGTH ? `${text.slice(0, PREVIEW_MAX_LENGTH - 1).trimEnd()}…` : text;
}
