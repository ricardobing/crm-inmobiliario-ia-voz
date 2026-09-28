import { cn } from "cn";
import type { ChannelView } from "@/domain/types";
import { ChannelIcon } from "./channel-icon";

/** R2: badge del canal de origen normalizado. Un valor desconocido se ve neutro, nunca como error. */
export function SourceBadge({ source, className }: { source: ChannelView; className?: string }) {
  const known = source.kind !== "other" && source.kind !== "unknown";
  return (
    <span
      data-source-kind={source.kind}
      title={source.raw && source.raw !== source.label ? `Valor original: ${source.raw}` : undefined}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap",
        known ? "border-brand-line bg-brand-soft text-brand-ink" : "border-border bg-muted text-muted-foreground",
        className,
      )}
    >
      <ChannelIcon kind={source.kind} className="size-3.5" />
      {source.label}
    </span>
  );
}
