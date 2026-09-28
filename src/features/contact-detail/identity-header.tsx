import { AlertTriangle, CalendarPlus, Info, Mail, Phone, UserRound, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ContactDetail } from "@/domain/types";
import { ContactAvatar } from "@/features/shared/contact-avatar";
import { SourceBadge } from "@/features/shared/source-badge";
import { ContactActions } from "./contact-actions";

/** R2: cabecera de identidad robusta, digna también sin nombre, sin teléfono o sin origen. */
export function IdentityHeader({ contact }: { contact: ContactDetail }) {
  const { name, phone, email, createdAt } = contact;
  const nameChanged = name.basis === "name" && name.raw !== null && name.raw.trim() !== name.text;

  return (
    <section aria-labelledby="contact-name" className="flex flex-col gap-5 rounded-xl bg-card p-5 ring-1 ring-border lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 gap-4">
        <ContactAvatar name={name} size="lg" />
        <div className="min-w-0">
          <div className="flex items-start gap-1.5">
            <h1 id="contact-name" className="font-heading text-[1.75rem] leading-tight font-semibold tracking-tight break-words">
              {name.text}
            </h1>
            {nameChanged ? (
              <HintIcon label="Nombre original">
                Llegó como «{name.raw}». Se muestra con mayúsculas normalizadas; el dato no se modifica.
              </HintIcon>
            ) : null}
          </div>
          {name.basis !== "name" ? (
            <p className="text-sm text-muted-foreground">
              Sin nombre registrado · identificado por {name.basis === "phone" ? "su teléfono" : name.basis === "email" ? "su email" : "su ficha"}
            </p>
          ) : null}

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <SourceBadge source={contact.source} />
            {contact.operations.map((op) => (
              <span key={op.kind} className="inline-flex h-6 items-center rounded-full border border-border bg-card px-2.5 text-xs font-medium">
                {op.label}
              </span>
            ))}
            <span className="inline-flex h-6 items-center rounded-full border border-border bg-muted px-2.5 text-xs text-muted-foreground">
              {contact.contactType?.label ?? "Sin clasificar"}
            </span>
            {contact.tags.map((tag) => (
              <span key={tag} className="inline-flex h-6 items-center rounded-full border border-border px-2.5 font-mono text-xs text-muted-foreground">
                #{tag}
              </span>
            ))}
          </div>

          <dl className="mt-3.5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <MetaItem icon={Phone} label="Teléfono">
              {phone ? (
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  {phone.display}
                  {!phone.valid ? <Warning>Número no válido</Warning> : null}
                  {phone.valid && phone.raw !== phone.display ? <HintIcon label="Teléfono original">Llegó como «{phone.raw}»</HintIcon> : null}
                </span>
              ) : (
                <span className="text-muted-foreground">Sin teléfono</span>
              )}
            </MetaItem>
            <MetaItem icon={Mail} label="Email">
              {email ? (
                <span className="inline-flex items-center gap-1.5 break-all">
                  {email.raw}
                  {!email.valid ? <Warning>Formato no válido</Warning> : null}
                </span>
              ) : (
                <span className="text-muted-foreground">Sin email</span>
              )}
            </MetaItem>
            <MetaItem icon={CalendarPlus} label="Alta">
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                {createdAt.display}
                {createdAt.raw !== null && createdAt.precision !== "unknown" && typeof createdAt.raw !== "string" ? (
                  <HintIcon label="Fecha original">Llegó como marca de tiempo «{createdAt.raw}»</HintIcon>
                ) : null}
                {createdAt.assumedTimezone ? (
                  <HintIcon label="Fecha original">
                    Llegó como «{String(createdAt.raw)}», sin zona horaria: se interpreta como día/mes en hora de la organización.
                  </HintIcon>
                ) : null}
              </span>
            </MetaItem>
            <MetaItem icon={UserRound} label="Asignado a">
              {contact.assignedAgentId ? (
                <span className="font-mono text-xs">{contact.assignedAgentId}</span>
              ) : (
                <span className="text-muted-foreground">Sin asignar</span>
              )}
            </MetaItem>
          </dl>
        </div>
      </div>
      <ContactActions contact={contact} />
    </section>
  );
}

function MetaItem({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Icon aria-hidden="true" className="size-4" />
        <span className="sr-only sm:not-sr-only">{label}</span>
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-5 items-center gap-1 rounded-full border border-warning-line bg-warning-soft px-2 text-2xs font-semibold text-warning">
      <AlertTriangle aria-hidden="true" className="size-3" />
      {children}
    </span>
  );
}

/** Explicación de una normalización (R6 en la propia UI): el dato crudo nunca se esconde del todo. */
function HintIcon({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={label} className="rounded-sm text-muted-foreground hover:text-foreground">
          <Info aria-hidden="true" className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
}
