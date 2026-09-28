import { emailMatchKey } from "./email";
import { nameTokens } from "./names";
import { PRECEDENCE_RULE_LABEL, resolveFact } from "./qualification/precedence";
import type { ContactCore, DuplicateCandidate, Fact, MergeField, MergePreview } from "./types";

// #2 · D22: posibles duplicados dentro de la misma organización.
// Hace falta el mismo teléfono (E.164) o el mismo email: el nombre solo aporta confianza y explicación.

type NameRelation = "compatible" | "different" | "unknown";

export function findDuplicates(contact: ContactCore, others: readonly ContactCore[]): DuplicateCandidate[] {
  if (contact.isTest) return [];
  return others
    .filter((o) => o.id !== contact.id && !o.isTest && o.organizationId === contact.organizationId)
    .map((other) => compare(contact, other))
    .filter((c): c is DuplicateCandidate => c !== null)
    .sort((a, b) => (a.confidence === b.confidence ? a.id.localeCompare(b.id) : a.confidence === "high" ? -1 : 1));
}

function compare(a: ContactCore, b: ContactCore): DuplicateCandidate | null {
  const reasons: string[] = [];
  const samePhone = a.phone?.e164 && a.phone.e164 === b.phone?.e164;
  if (samePhone) reasons.push(`Mismo teléfono (${a.phone?.display})`);
  const emailKey = emailMatchKey(a.email);
  if (emailKey && emailKey === emailMatchKey(b.email)) reasons.push(`Mismo email (${emailKey})`);
  if (!reasons.length) return null;

  const relation = nameRelation(a, b);
  if (relation === "compatible") reasons.push(`Nombre compatible: «${shorterName(a, b)}» y «${longerName(a, b)}»`);
  if (relation === "different") reasons.push("Nombres distintos: puede ser un teléfono o email compartido");

  return {
    id: b.id,
    displayName: b.name.text,
    confidence: relation === "different" ? "medium" : "high",
    reasons,
  };
}

function nameRelation(a: ContactCore, b: ContactCore): NameRelation {
  if (a.name.basis !== "name" || b.name.basis !== "name") return "unknown";
  const ta = nameTokens(a.name.text);
  const tb = nameTokens(b.name.text);
  const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (!shorter.length) return "unknown";
  return shorter.every((t) => longer.includes(t)) ? "compatible" : "different";
}

const shorterName = (a: ContactCore, b: ContactCore) => (a.name.text.length <= b.name.text.length ? a : b).name.text;
const longerName = (a: ContactCore, b: ContactCore) => (a.name.text.length > b.name.text.length ? a : b).name.text;

/** Propuesta de fusión campo a campo, con la regla aplicada. Nunca se ejecuta sola (D22). */
export function buildMergePreview(a: ContactCore, b: ContactCore): MergePreview {
  const [survivor, merged] = pickSurvivor(a, b);
  const fields: MergeField[] = [];

  const named = [survivor, merged].filter((c) => c.name.basis === "name");
  const nameSource = named.sort((x, y) => nameTokens(y.name.text).length - nameTokens(x.name.text).length)[0] ?? survivor;
  fields.push({ field: "Nombre", value: nameSource.name.text, fromId: nameSource.id, rule: "El nombre más completo" });

  const phoneSource = survivor.phone ? survivor : merged.phone ? merged : null;
  fields.push({
    field: "Teléfono",
    value: phoneSource?.phone?.display ?? "Sin teléfono",
    fromId: phoneSource?.id ?? null,
    rule:
      survivor.phone?.e164 && survivor.phone.e164 === merged.phone?.e164
        ? "Mismo número en los dos (comparado en formato internacional)"
        : "El del contacto principal; el otro se conserva como secundario",
  });

  const emailSource = [survivor, merged].find((c) => c.email?.valid) ?? [survivor, merged].find((c) => c.email) ?? null;
  fields.push({
    field: "Email",
    value: emailSource?.email?.raw ?? "Sin email",
    fromId: emailSource?.id ?? null,
    rule: emailSource ? "El primer email válido" : "Ninguno de los dos tiene email",
  });

  const sameSource = survivor.source.kind === merged.source.kind;
  fields.push({
    field: "Origen",
    value: sameSource ? survivor.source.label : `${survivor.source.label} (+ ${merged.source.label})`,
    fromId: survivor.id,
    rule: sameSource ? "Mismo origen" : "Se conserva el primer origen; el otro queda como canal adicional",
  });

  const createdSource = [survivor, merged]
    .filter((c) => c.createdAt.iso)
    .sort((x, y) => (x.createdAt.iso ?? "").localeCompare(y.createdAt.iso ?? ""))[0];
  fields.push({
    field: "Alta",
    value: createdSource?.createdAt.display ?? survivor.createdAt.display,
    fromId: createdSource?.id ?? survivor.id,
    rule: "La fecha de alta más antigua",
  });

  const facts = mergeFacts(survivor, merged);
  fields.push({
    field: "Cualificación",
    value: `${facts.total} datos (${facts.bySource[survivor.id] ?? 0} de ${survivor.id}, ${facts.bySource[merged.id] ?? 0} de ${merged.id})`,
    fromId: null,
    rule: PRECEDENCE_RULE_LABEL,
  });

  fields.push({
    field: "Actividad",
    value: `${survivor.timeline.length + merged.timeline.length} interacciones`,
    fromId: null,
    rule: "Se unen las de ambos, en orden cronológico",
  });

  const tags = [...new Set([...survivor.tags, ...merged.tags])];
  if (tags.length) fields.push({ field: "Etiquetas", value: tags.join(", "), fromId: null, rule: "Unión de ambas" });
  if (survivor.notes.length || merged.notes.length) {
    fields.push({ field: "Notas", value: `${survivor.notes.length + merged.notes.length} notas`, fromId: null, rule: "Se conservan todas" });
  }

  return { survivorId: survivor.id, mergedId: merged.id, fields };
}

/** Sobrevive el contacto con más información; a igualdad, el más antiguo. */
function pickSurvivor(a: ContactCore, b: ContactCore): [ContactCore, ContactCore] {
  const weight = (c: ContactCore) => factCount(c) + c.timeline.length;
  if (weight(a) !== weight(b)) return weight(a) > weight(b) ? [a, b] : [b, a];
  const ai = a.createdAt.iso ?? "￿";
  const bi = b.createdAt.iso ?? "￿";
  return ai <= bi ? [a, b] : [b, a];
}

function factCount(c: ContactCore): number {
  return c.qualification.status === "ok" ? c.qualification.groups.reduce((n, g) => n + g.facts.length, 0) : 0;
}

function mergeFacts(a: ContactCore, b: ContactCore): { total: number; bySource: Record<string, number> } {
  const candidates = new Map<string, (Fact & { ownerId: string })[]>();
  for (const contact of [a, b]) {
    if (contact.qualification.status !== "ok") continue;
    for (const group of contact.qualification.groups) {
      for (const fact of group.facts) {
        const key = `${group.id}.${fact.key}`;
        candidates.set(key, [...(candidates.get(key) ?? []), { ...fact, ownerId: contact.id }]);
      }
    }
  }
  const bySource: Record<string, number> = {};
  for (const list of candidates.values()) {
    const winner = resolveFact(list)?.winner;
    if (winner) bySource[winner.ownerId] = (bySource[winner.ownerId] ?? 0) + 1;
  }
  return { total: candidates.size, bySource };
}
