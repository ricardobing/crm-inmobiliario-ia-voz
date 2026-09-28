/**
 * Revisión a ojo: crudo → normalizado, contacto por contacto.
 * Uso: pnpm inspect:data
 */
import { loadCatalog, loadDataset, TEST_CONTEXT } from "../src/domain/test-support";
import { normalizeContact } from "../src/domain/normalize-contact";

const dataset = loadDataset();
const catalog = loadCatalog();

console.log(`Organización del export: ${dataset.organization?.id} · ${dataset.organization?.name}`);
console.log(`Contactos: ${dataset.contacts.length} · ilegibles: ${dataset.invalidContacts}\n`);

for (const raw of dataset.contacts) {
  const c = normalizeContact(raw, TEST_CONTEXT, catalog);
  const q = c.qualification;
  const qualification =
    q.status === "ok"
      ? q.groups.map((g) => `${g.label}(${g.facts.length})`).join(" ") + (q.sourceFormat !== "object" ? ` [${q.sourceFormat}]` : "")
      : q.status;
  const flags = [
    c.organizationId !== dataset.organization?.id && `OTRA ORG ${c.organizationId}`,
    c.isTest && "PRUEBA",
    c.handoff && "HANDOFF",
    c.email && !c.email.valid && "EMAIL INVÁLIDO",
    c.tags.length > 0 && `tags:${c.tags.join(",")}`,
  ].filter(Boolean);

  console.log(`${c.id}  ${c.name.text}  (nombre por ${c.name.basis}; crudo: ${JSON.stringify(raw.full_name)})`);
  console.log(`       tel: ${JSON.stringify(raw.phone)} → ${c.phone?.display ?? "—"}   email: ${c.email?.raw ?? "—"}`);
  console.log(`       origen: ${JSON.stringify(raw.lead_source)} → ${c.source.label}   alta: ${JSON.stringify(raw.created_at)} → ${c.createdAt.display}`);
  console.log(`       cualificación: ${qualification}`);
  console.log(`       timeline: ${c.timeline.map((i) => `${i.channel.label}@${i.at.display}`).join(" | ") || "—"}`);
  if (flags.length) console.log(`       ⚑ ${flags.join(" · ")}`);
  console.log();
}
