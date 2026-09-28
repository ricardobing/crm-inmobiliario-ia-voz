"use client";

import { AlertTriangle, CopyCheck, EyeOff, PhoneOff, RotateCw, UserRound } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ContactSummary } from "@/domain/types";
import { useContactList } from "@/features/contacts/queries";
import { ChannelIcon } from "@/features/shared/channel-icon";
import { ContactAvatar } from "@/features/shared/contact-avatar";
import { EmptyState } from "@/features/shared/empty-state";
import { SourceBadge } from "@/features/shared/source-badge";
import { StatusBanner } from "@/features/shared/status-banner";

/** R1: listado mínimo, solo como puerta de entrada a la ficha. Sin búsqueda, filtros ni paginación. */
export function ContactListView() {
  const { data, isPending, isError, error, refetch, isFetching } = useContactList();

  return (
    <section aria-labelledby="contacts-title" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 id="contacts-title" className="font-heading text-[1.75rem] leading-tight font-semibold tracking-tight">
            Contactos
          </h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.organization.name ?? data.organization.id} · ${data.contacts.length} contactos` : " "}
          </p>
        </div>
        {data && data.hiddenTestCount > 0 ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <EyeOff aria-hidden="true" className="size-3.5" />
            {data.hiddenTestCount === 1 ? "1 contacto de prueba oculto" : `${data.hiddenTestCount} contactos de prueba ocultos`}
          </p>
        ) : null}
      </div>

      {isPending ? (
        <ListSkeleton />
      ) : isError ? (
        <StatusBanner
          tone="danger"
          icon={AlertTriangle}
          title="No se pudieron cargar los contactos"
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RotateCw aria-hidden="true" className={isFetching ? "animate-spin" : undefined} />
              Reintentar
            </Button>
          }
        >
          {error.message}
        </StatusBanner>
      ) : data.contacts.length === 0 ? (
        <EmptyState icon={UserRound} title="Todavía no hay contactos">
          Aparecerán aquí en cuanto entren por llamada, WhatsApp, formularios o importaciones.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border">
          {data.contacts.map((contact) => (
            <ContactRow key={contact.id} contact={contact} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ContactRow({ contact }: { contact: ContactSummary }) {
  const last = contact.lastInteraction;
  const showPhone = contact.phone && contact.name.basis !== "phone";
  return (
    <li>
      <Link
        href={`/contactos/${contact.id}`}
        className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-2 px-4 py-3.5 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-offset-[-2px] md:grid-cols-[auto_minmax(0,1.1fr)_auto_minmax(0,1.4fr)] md:items-center md:gap-x-5"
      >
        <ContactAvatar name={contact.name} />
        <div className="min-w-0">
          <p className="truncate font-medium">{contact.name.text}</p>
          <p className="truncate text-sm text-muted-foreground tabular-nums">
            {showPhone ? contact.phone?.display : contact.name.basis === "phone" ? "Sin nombre" : "Sin teléfono"}
          </p>
          <Flags flags={contact.flags} />
        </div>
        <div className="col-start-2 md:col-start-auto">
          <SourceBadge source={contact.source} />
        </div>
        <div className="col-start-2 min-w-0 text-sm md:col-start-auto">
          {last ? (
            <>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                <ChannelIcon kind={last.channel.kind} className="size-3.5" />
                {last.channel.label} · {last.at.display}
              </p>
              {last.preview ? <p className="mt-0.5 line-clamp-1 text-foreground/80">{last.preview}</p> : null}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Sin interacciones</p>
          )}
        </div>
      </Link>
    </li>
  );
}

function Flags({ flags }: { flags: ContactSummary["flags"] }) {
  if (!flags.handoff && !flags.doNotCall && !flags.possibleDuplicate) return null;
  return (
    <p className="mt-1.5 flex flex-wrap gap-1.5">
      {flags.handoff ? (
        <FlagChip className="border-danger-line bg-danger-soft text-danger" icon={<AlertTriangle className="size-3" />}>
          Pide una persona
        </FlagChip>
      ) : null}
      {flags.doNotCall ? (
        <FlagChip className="border-danger-line bg-danger-soft text-danger" icon={<PhoneOff className="size-3" />}>
          No llamar
        </FlagChip>
      ) : null}
      {flags.possibleDuplicate ? (
        <FlagChip className="border-warning-line bg-warning-soft text-warning" icon={<CopyCheck className="size-3" />}>
          Posible duplicado
        </FlagChip>
      ) : null}
    </p>
  );
}

function FlagChip({ className, icon, children }: { className: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className={`inline-flex h-5 items-center gap-1 rounded-full border px-2 text-2xs font-semibold ${className}`}>
      <span aria-hidden="true">{icon}</span>
      {children}
    </span>
  );
}

function ListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando contactos" className="divide-y divide-border rounded-xl bg-card ring-1 ring-border">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="hidden h-6 w-24 rounded-full md:block" />
          <Skeleton className="hidden h-4 w-64 md:block" />
        </div>
      ))}
    </div>
  );
}
