import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Estado vacío que explica qué pasará, no solo "no hay nada". */
export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-input bg-muted/50 px-6 py-8 text-center">
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <p className="font-medium">{title}</p>
      {children ? <div className="max-w-sm text-sm text-muted-foreground">{children}</div> : null}
    </div>
  );
}
