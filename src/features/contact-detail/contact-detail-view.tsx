"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ContactDetail } from "@/domain/types";
import { useContactDetail } from "@/features/contacts/queries";
import { ApiError } from "@/lib/api/client";
import { ContactBanners } from "./contact-banners";
import { DetailSkeleton, ErrorState, NotFoundState } from "./detail-states";
import { IdentityHeader } from "./identity-header";
import { QualificationSection } from "./qualification-section";
import { NotesCard, RecordCard } from "./side-cards";
import { CompliancePanel, DuplicatesPanel, NextActionCard } from "./story-panels";
import { TimelineSection } from "./timeline-section";

export function ContactDetailView({ id, simulateError }: { id: string; simulateError: boolean }) {
  const { data, isPending, isError, error, refetch, isFetching } = useContactDetail(id, simulateError);

  if (isPending) return <DetailSkeleton />;
  if (isError) {
    if (error instanceof ApiError && error.status === 404) return <NotFoundState />;
    return (
      <ErrorState
        message={error.message}
        onRetry={() => refetch()}
        retrying={isFetching}
        simulated={simulateError}
        cleanHref={`/contactos/${encodeURIComponent(id)}`}
      />
    );
  }
  return <ContactDetailLayout contact={data.contact} />;
}

function ContactDetailLayout({ contact }: { contact: ContactDetail }) {
  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/contactos"
        className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Contactos
      </Link>
      <IdentityHeader contact={contact} />
      <ContactBanners contact={contact} />
      {/* Escritorio: dos columnas. Móvil: una sola, con la siguiente acción primero (order + display: contents). */}
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5 max-lg:contents">
          <div className="min-w-0 max-lg:order-3">
            <QualificationSection qualification={contact.qualification} />
          </div>
          <div className="min-w-0 max-lg:order-4">
            <TimelineSection items={contact.timeline} skipped={contact.skippedInteractions} />
          </div>
        </div>
        <aside aria-label="Resumen y acciones" className="flex flex-col gap-5 max-lg:contents">
          <div className="max-lg:order-1">
            <NextActionCard contact={contact} />
          </div>
          <div className="max-lg:order-5 empty:hidden">
            <DuplicatesPanel contact={contact} />
          </div>
          <div className="max-lg:order-6">
            <CompliancePanel contact={contact} />
          </div>
          <div className="max-lg:order-2 empty:hidden">
            <NotesCard notes={contact.notes} />
          </div>
          <div className="max-lg:order-7">
            <RecordCard contact={contact} />
          </div>
        </aside>
      </div>
    </div>
  );
}
