import { humanize, toLookupKey } from "./text";
import type { ChannelKind, ChannelView } from "./types";

// D07: catálogo de alias como datos. Un valor nuevo no rompe: se muestra humanizado con kind "other".
// Añadir un origen = añadir una entrada (o un alias) aquí.
type ChannelDefinition = { kind: ChannelKind; label: string; aliases: string[] };

const CHANNEL_CATALOG: ChannelDefinition[] = [
  // "Llamada" y no "Llamada IA": hay llamadas salientes hechas por personas (c-008, i-1071).
  { kind: "voice", label: "Llamada", aliases: ["voice_call", "voice", "voz", "llamada"] },
  { kind: "whatsapp", label: "WhatsApp", aliases: ["whatsapp"] },
  { kind: "web_form", label: "Formulario web", aliases: ["website", "web_form"] },
  { kind: "meta_ads", label: "Meta Ads", aliases: ["meta_lead_ads"] },
  { kind: "email", label: "Email", aliases: ["email"] },
  { kind: "import", label: "Importación · Witei", aliases: ["witei"] },
  // Asunción documentada en D07: "CRM" = alta manual desde el propio CRM.
  { kind: "manual", label: "Alta manual", aliases: ["crm"] },
];

const BY_ALIAS = new Map(CHANNEL_CATALOG.flatMap((def) => def.aliases.map((alias) => [alias, def] as const)));

export function normalizeChannel(raw: unknown, unknownLabel: string): ChannelView {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return { kind: "unknown", label: unknownLabel, raw: null };

  const def = BY_ALIAS.get(toLookupKey(value));
  if (def) return { kind: def.kind, label: def.label, raw: value };
  return { kind: "other", label: humanize(value), raw: value };
}

export const UNKNOWN_SOURCE_LABEL = "Origen desconocido";
export const UNKNOWN_CHANNEL_LABEL = "Canal desconocido";
