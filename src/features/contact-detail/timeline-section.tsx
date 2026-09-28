"use client";

import { ChevronDown, Clock, MessagesSquare, Building2 } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { TimelineItem } from "@/domain/types";
import { ChannelIcon } from "@/features/shared/channel-icon";
import { EmptyState } from "@/features/shared/empty-state";
import { formatDuration, pluralize } from "@/lib/format";

const DIRECTION_LABEL: Record<TimelineItem["direction"], string | null> = {
  inbound: "Entrante",
  outbound: "Saliente",
  unknown: null,
};

/** R4: llamadas, mensajes y formularios en orden cronológico real, del más reciente al más antiguo (D17). */
export function TimelineSection({ items, skipped }: { items: TimelineItem[]; skipped: number }) {
  return (
    <Card aria-labelledby="timeline-title">
      <CardHeader>
        <h2 id="timeline-title" className="font-heading text-lg leading-snug font-semibold">
          Actividad
        </h2>
        <CardDescription>
          {items.length ? `${pluralize(items.length, "interacción", "interacciones")} · más reciente primero` : "Llamadas, mensajes y formularios"}
          {skipped > 0 ? ` · ${pluralize(skipped, "interacción no se pudo leer", "interacciones no se pudieron leer")}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState icon={MessagesSquare} title="Sin actividad registrada">
            Cuando haya llamadas, mensajes de WhatsApp o formularios, aparecerán aquí del más reciente al más antiguo.
          </EmptyState>
        ) : (
          <ol className="relative flex flex-col gap-5 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-border">
            {items.map((item) => (
              <TimelineEntry key={item.id} item={item} />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function TimelineEntry({ item }: { item: TimelineItem }) {
  const direction = DIRECTION_LABEL[item.direction];
  const isMessage = item.channel.kind === "whatsapp" || item.channel.kind === "email";
  return (
    <li className="relative grid grid-cols-[32px_1fr] gap-3" data-channel={item.channel.kind}>
      <span className="relative z-10 inline-flex size-8 items-center justify-center rounded-full bg-card text-foreground ring-1 ring-border">
        <ChannelIcon kind={item.channel.kind} className="size-4" />
      </span>
      <article className="min-w-0 pt-1">
        <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
          <span className="font-semibold">{item.channel.label}</span>
          {direction ? <span className="text-muted-foreground">{direction}</span> : null}
          <time
            dateTime={item.at.iso ?? undefined}
            title={item.at.assumedTimezone ? "Llegó sin zona horaria: se interpreta en la hora de la organización" : undefined}
            className="ml-auto text-xs text-muted-foreground tabular-nums"
          >
            {item.at.display}
          </time>
        </header>

        {item.content ? (
          isMessage ? (
            <p
              className={`mt-1.5 max-w-prose rounded-lg px-3 py-2 text-sm ${
                item.direction === "outbound" ? "bg-muted" : "bg-card ring-1 ring-border"
              }`}
            >
              {item.content}
            </p>
          ) : (
            <p className="mt-1.5 max-w-prose text-sm">{item.content}</p>
          )
        ) : (
          <p className="mt-1.5 text-sm text-muted-foreground italic">Sin contenido</p>
        )}

        {item.call ? <CallDetails call={item.call} /> : null}

        {item.propertyRef ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs">
            <Building2 aria-hidden="true" className="size-3.5 text-muted-foreground" />
            <span className="font-mono">{item.propertyRef.ref}</span>
            {item.propertyRef.title ? <span>· {item.propertyRef.title}</span> : null}
          </p>
        ) : null}

        {item.extra.length ? (
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {item.extra.map((entry) => (
              <div key={entry.label} className="flex gap-1">
                <dt>{entry.label}:</dt>
                <dd className="text-foreground">{entry.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </article>
    </li>
  );
}

function CallDetails({ call }: { call: NonNullable<TimelineItem["call"]> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {call.durationSec !== null ? (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock aria-hidden="true" className="size-3.5" />
            {formatDuration(call.durationSec)}
          </span>
        ) : null}
        {call.audioUrl ? (
          <audio controls preload="none" src={call.audioUrl} className="h-8">
            <a href={call.audioUrl}>Descargar audio</a>
          </audio>
        ) : null}
      </div>
      {call.transcript?.length ? (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-brand-ink hover:underline">
            <ChevronDown aria-hidden="true" className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            {open ? "Ocultar transcripción" : "Ver transcripción"}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 max-h-80 overflow-y-auto rounded-lg bg-muted px-3.5 py-3">
              <dl className="flex flex-col gap-2 text-sm">
                {call.transcript.map((turn, i) => (
                  <div key={i} className="grid gap-x-3 sm:grid-cols-[6rem_1fr]">
                    <dt className="font-semibold">{turn.speaker ?? "—"}</dt>
                    <dd className="max-w-prose">{turn.text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}
