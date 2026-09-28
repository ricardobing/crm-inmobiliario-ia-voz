import { cn } from "cn";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const TONES = {
  danger: "border-danger-line bg-danger-soft text-danger",
  warning: "border-warning-line bg-warning-soft text-warning",
  info: "border-info-line bg-info-soft text-info",
  neutral: "border-border bg-muted text-foreground",
} as const;

export type BannerTone = keyof typeof TONES;

/** Aviso prioritario de la ficha. El tono nunca va solo: siempre lleva icono y texto. */
export function StatusBanner({
  tone,
  icon: Icon,
  title,
  children,
  action,
}: {
  tone: BannerTone;
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-start", TONES[tone])}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {children ? <div className="mt-0.5 text-sm text-foreground/80">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
