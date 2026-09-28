import { normalizeChannel, UNKNOWN_CHANNEL_LABEL } from "./channels";
import { compareDateViewsDesc, parseDate } from "./dates";
import { prettifyName } from "./names";
import { rawInteractionSchema } from "./raw-schema";
import { asNonEmptyString, humanize, toLookupKey } from "./text";
import type { CatalogProperty, DomainContext, TimelineItem, TranscriptTurn } from "./types";

// D17: todos los canales (también EMAIL y los que vengan), más reciente primero, fechas desconocidas al final.

/** Metadata con tratamiento propio; el resto se muestra como pares etiqueta/valor. */
const HANDLED_METADATA = new Set(["duration_sec", "audio_url", "transcript_excerpt", "property_ref"]);
const METADATA_LABELS: Record<string, string> = { form: "Formulario" };

const DIRECTIONS: Record<string, TimelineItem["direction"]> = { inbound: "inbound", outbound: "outbound" };

export function buildTimeline(
  interactions: readonly unknown[] | null | undefined,
  ctx: DomainContext,
  catalog: ReadonlyMap<string, CatalogProperty>,
): { items: TimelineItem[]; skipped: number } {
  let skipped = 0;
  const items: { item: TimelineItem; index: number }[] = [];

  (interactions ?? []).forEach((raw, index) => {
    const parsed = rawInteractionSchema.safeParse(raw);
    if (!parsed.success) {
      skipped += 1;
      return;
    }
    const interaction = parsed.data;
    const metadata = interaction.metadata ?? {};
    const channel = normalizeChannel(interaction.channel, UNKNOWN_CHANNEL_LABEL);

    items.push({
      index,
      item: {
        id: interaction.id,
        channel,
        direction: DIRECTIONS[toLookupKey(interaction.direction ?? "")] ?? "unknown",
        at: parseDate(interaction.created_at, ctx.timeZone, ctx.locale),
        content: asNonEmptyString(interaction.content),
        call: channel.kind === "voice" || hasCallMetadata(metadata) ? toCall(metadata) : null,
        propertyRef: toPropertyRef(metadata.property_ref, catalog),
        extra: toExtra(metadata),
      },
    });
  });

  // Orden estable: a igualdad de fecha (o si ambas son desconocidas) se respeta el orden original.
  items.sort((a, b) => compareDateViewsDesc(a.item.at, b.item.at) || a.index - b.index);
  return { items: items.map(({ item }) => item), skipped };
}

function hasCallMetadata(metadata: Record<string, unknown>): boolean {
  return metadata.duration_sec !== undefined || metadata.transcript_excerpt !== undefined;
}

function toCall(metadata: Record<string, unknown>): TimelineItem["call"] {
  const duration = metadata.duration_sec;
  const transcript = asNonEmptyString(metadata.transcript_excerpt);
  return {
    durationSec: typeof duration === "number" && Number.isFinite(duration) && duration >= 0 ? duration : null,
    audioUrl: asNonEmptyString(metadata.audio_url),
    transcript: transcript ? parseTranscript(transcript) : null,
  };
}

const SPEAKER_LINE = /^([\p{L}][\p{L} .'-]{0,29}):\s*(.*)$/u;

/** "AGENTE: ¿…?\nCARMEN: Pues…" → turnos con hablante; las líneas sin formato se conservan sin hablante. */
export function parseTranscript(text: string): TranscriptTurn[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = SPEAKER_LINE.exec(line);
      return match?.[1] && match[2] !== undefined
        ? { speaker: prettifyName(match[1].trim()), text: match[2] }
        : { speaker: null, text: line };
    });
}

function toPropertyRef(raw: unknown, catalog: ReadonlyMap<string, CatalogProperty>): TimelineItem["propertyRef"] {
  const ref = asNonEmptyString(raw);
  if (!ref) return null;
  return { ref, title: catalog.get(ref)?.title ?? null };
}

function toExtra(metadata: Record<string, unknown>): TimelineItem["extra"] {
  return Object.entries(metadata)
    .filter(([key, value]) => !HANDLED_METADATA.has(key) && value !== null && value !== undefined && value !== "")
    .map(([key, value]) => ({
      label: METADATA_LABELS[key] ?? humanize(key),
      value: typeof value === "string" ? value : JSON.stringify(value),
    }));
}
