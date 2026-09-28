import { cn } from "cn";
import { CircleHelp, DatabaseZap, History, MessageSquareText, Mic, PencilLine, type LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Provenance } from "@/domain/types";

const STYLES: Record<Provenance["kind"], { icon: LucideIcon; className: string; hint: string }> = {
  human: {
    icon: PencilLine,
    className: "border-foreground/20 bg-foreground text-background",
    hint: "Lo corrigió una persona del equipo: manda sobre lo que dijo el cliente en la conversación.",
  },
  conversation: {
    icon: MessageSquareText,
    className: "border-brand-line bg-brand-soft text-brand-ink",
    hint: "La IA lo extrajo de lo que dijo el cliente en una conversación.",
  },
  import: {
    icon: DatabaseZap,
    className: "border-border bg-muted text-muted-foreground",
    hint: "Llegó en una importación de otro CRM: no hay conversación que lo respalde.",
  },
  declared: {
    icon: Mic,
    className: "border-border bg-muted text-muted-foreground",
    hint: "Declarado por el cliente, sin comprobar con documentación.",
  },
  legacy_preferences: {
    icon: History,
    className: "border-border bg-muted text-muted-foreground",
    hint: "Viene de las preferencias guardadas por el sistema anterior.",
  },
  unknown: {
    icon: CircleHelp,
    className: "border-border bg-muted text-muted-foreground",
    hint: "El dato no indica de dónde salió.",
  },
};

/** R3 / D13: procedencia visible de cada hecho, con icono, texto y explicación. */
export function ProvenanceChip({ provenance }: { provenance: Provenance }) {
  const style = STYLES[provenance.kind];
  const Icon = style.icon;
  const reference = provenance.kind === "conversation" && provenance.ref ? provenance.ref : null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn("inline-flex h-5 items-center gap-1 rounded-full border px-2 text-2xs font-semibold whitespace-nowrap", style.className)}
        >
          <Icon aria-hidden="true" className="size-3" />
          {provenance.label}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {style.hint}
        {reference ? <span className="font-mono"> ({reference})</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}
