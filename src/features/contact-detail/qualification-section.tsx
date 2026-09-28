import { AlertTriangle, ClipboardList, Info, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Confidence, Fact, QualificationView } from "@/domain/types";
import { EmptyState } from "@/features/shared/empty-state";
import { StatusBanner } from "@/features/shared/status-banner";
import { pluralize } from "@/lib/format";
import { FactValueView } from "./fact-value";
import { ProvenanceChip } from "./provenance-chip";

/** R3: la cualificación se pinta a partir de las claves que vengan, agrupada por operación. */
export function QualificationSection({ qualification }: { qualification: QualificationView }) {
  return (
    <Card aria-labelledby="qualification-title">
      <CardHeader>
        <h2 id="qualification-title" className="font-heading text-lg leading-snug font-semibold">
          Cualificación
        </h2>
        <CardDescription>{describe(qualification)}</CardDescription>
      </CardHeader>
      <CardContent>
        {qualification.status === "empty" ? (
          <EmptyState icon={ClipboardList} title="Sin cualificación todavía">
            Se completará cuando la IA hable con este contacto o cuando alguien del equipo la rellene. Mientras tanto,
            revisa la actividad y las notas.
          </EmptyState>
        ) : qualification.status === "unreadable" ? (
          <StatusBanner tone="warning" icon={AlertTriangle} title="La cualificación no se pudo interpretar">
            <p>Se muestra tal como llegó para que no se pierda.</p>
            <details className="mt-2">
              <summary className="cursor-pointer font-medium">Ver dato original</summary>
              <pre className="mt-2 max-h-60 overflow-auto rounded-md bg-card p-3 font-mono text-xs whitespace-pre-wrap">
                {qualification.raw}
              </pre>
            </details>
          </StatusBanner>
        ) : (
          <div className="flex flex-col gap-6">
            {qualification.groups.map((group) => (
              <section key={group.id} aria-labelledby={`group-${group.id}`}>
                <h3 id={`group-${group.id}`} className="mb-2 flex items-baseline gap-2 text-sm font-semibold">
                  {group.label}
                  <span className="text-xs font-normal text-muted-foreground">{pluralize(group.facts.length, "dato", "datos")}</span>
                </h3>
                <ul className="divide-y divide-border border-y border-border">
                  {group.facts.map((fact) => (
                    <FactRow key={fact.key} fact={fact} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function describe(q: QualificationView): string {
  if (q.status !== "ok") return "Lo que sabemos de lo que busca";
  const count = q.groups.reduce((n, g) => n + g.facts.length, 0);
  const parts = [pluralize(count, "dato", "datos")];
  if (q.lastSyncedAt) parts.push(`sincronizado el ${q.lastSyncedAt.display}`);
  if (q.sourceFormat === "json_string") parts.push("recibido como texto JSON e interpretado");
  if (q.sourceFormat === "legacy_preferences") parts.push("de las preferencias del sistema anterior");
  return parts.join(" · ");
}

function FactRow({ fact }: { fact: Fact }) {
  return (
    <li
      data-provenance={fact.provenance.kind}
      className="grid gap-x-4 gap-y-1.5 py-3 sm:grid-cols-[minmax(8rem,11rem)_1fr]"
    >
      <div className="flex items-start gap-1 text-sm text-muted-foreground">
        <span>{fact.label}</span>
        {fact.labelIsFallback ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label={`Clave original: ${fact.key}`} className="mt-0.5 rounded-sm text-muted-foreground/80 hover:text-foreground">
                <Info aria-hidden="true" className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              Clave nueva, sin etiqueta en el diccionario: <span className="font-mono">{fact.key}</span>
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <FactValueView value={fact.value} />
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
          <ProvenanceChip provenance={fact.provenance} />
          {fact.verified === false ? (
            <span className="inline-flex h-5 items-center gap-1 rounded-full border border-warning-line bg-warning-soft px-2 text-2xs font-semibold text-warning">
              <ShieldAlert aria-hidden="true" className="size-3" />
              Sin verificar
            </span>
          ) : null}
          {fact.confidence ? <ConfidenceLabel confidence={fact.confidence} /> : null}
          {fact.updatedAt.iso ? <span className="tabular-nums">{fact.updatedAt.display}</span> : null}
        </div>
      </div>
    </li>
  );
}

const CONFIDENCE: Record<Confidence, { label: string; dot: string }> = {
  high: { label: "Confianza alta", dot: "bg-success" },
  medium: { label: "Confianza media", dot: "bg-warning" },
  low: { label: "Confianza baja", dot: "bg-danger" },
};

function ConfidenceLabel({ confidence }: { confidence: Confidence }) {
  const { label, dot } = CONFIDENCE[confidence];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={`size-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
