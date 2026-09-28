"use client";

import { Ban, Check, ChevronDown, CopyCheck, GitMerge, Lightbulb, Mail, MessageCircle, Phone, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ActionChannel, ContactDetail, Permission } from "@/domain/types";
import { CHANNEL_ACTION_LABEL, contactHref, isExternal } from "./contact-links";

const CHANNEL_ICON: Record<Exclude<ActionChannel, "none">, LucideIcon> = { call: Phone, whatsapp: MessageCircle, email: Mail };

/** #4 · Siguiente mejor acción: una principal y hasta dos secundarias, cada una con su porqué. */
export function NextActionCard({ contact }: { contact: ContactDetail }) {
  const [primary, ...rest] = contact.nextActions;
  if (!primary) return null;
  const href = contactHref(contact, primary.channel);
  const Icon = primary.channel !== "none" ? CHANNEL_ICON[primary.channel] : null;

  return (
    <Card size="sm" aria-labelledby="next-action-title" className="ring-brand-line">
      <CardHeader>
        <h2 id="next-action-title" className="flex items-center gap-2 text-sm font-semibold">
          <Lightbulb aria-hidden="true" className="size-4 text-brand" />
          Siguiente mejor acción
        </h2>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div data-rule={primary.ruleId}>
          <p className="font-heading text-base leading-snug font-semibold">{primary.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{primary.reason}</p>
          {href && Icon && primary.channel !== "none" ? (
            <Button asChild size="lg" className="mt-3 rounded-full px-4">
              <a href={href} data-next-action={primary.channel} {...(isExternal(href) ? { target: "_blank", rel: "noreferrer" } : {})}>
                <Icon aria-hidden="true" />
                {CHANNEL_ACTION_LABEL[primary.channel]}
              </a>
            </Button>
          ) : null}
        </div>
        {rest.length ? (
          <div className="border-t border-border pt-3">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Después</p>
            <ol className="flex flex-col gap-2">
              {rest.map((action) => (
                <li key={action.ruleId} data-rule={action.ruleId} className="text-sm">
                  <p className="font-medium">{action.title}</p>
                  <p className="text-muted-foreground">{action.reason}</p>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        <p className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          <Sparkles aria-hidden="true" className="size-3" />
          Sugerencia por reglas: la decisión es tuya.
        </p>
      </CardContent>
    </Card>
  );
}

/** #2 · Posibles duplicados con la propuesta de fusión campo a campo. La fusión nunca se ejecuta sola. */
export function DuplicatesPanel({ contact }: { contact: ContactDetail }) {
  const [open, setOpen] = useState(false);
  if (!contact.duplicates.length) return null;
  const preview = contact.mergePreview;

  return (
    <Card size="sm" aria-labelledby="duplicates-title" className="ring-warning-line">
      <CardHeader>
        <h2 id="duplicates-title" className="flex items-center gap-2 text-sm font-semibold">
          <CopyCheck aria-hidden="true" className="size-4 text-warning" />
          Posible duplicado
        </h2>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-col gap-3">
          {contact.duplicates.map((dup) => (
            <li key={dup.id} className="text-sm">
              <Link href={`/contactos/${dup.id}`} className="font-medium underline underline-offset-2 hover:text-brand-ink">
                {dup.displayName}
              </Link>{" "}
              <span className="font-mono text-xs text-muted-foreground">{dup.id}</span>
              <span className="ml-1.5 text-xs text-muted-foreground">· confianza {dup.confidence === "high" ? "alta" : "media"}</span>
              <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                {dup.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        {preview ? (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-brand-ink hover:underline">
              <ChevronDown aria-hidden="true" className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
              {open ? "Ocultar propuesta de fusión" : "Ver propuesta de fusión"}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <p className="mt-2 text-xs text-muted-foreground">
                Se conserva <span className="font-mono">{preview.survivorId}</span> y se incorpora{" "}
                <span className="font-mono">{preview.mergedId}</span>.
              </p>
              <dl className="mt-2 flex flex-col divide-y divide-border border-y border-border text-sm">
                {preview.fields.map((field) => (
                  <div key={field.field} className="py-2">
                    <dt className="text-xs text-muted-foreground">{field.field}</dt>
                    <dd className="font-medium">
                      {field.value}
                      {field.fromId ? <span className="ml-1.5 font-mono text-2xs font-normal text-muted-foreground">{field.fromId}</span> : null}
                    </dd>
                    <dd className="text-xs text-muted-foreground">{field.rule}</dd>
                  </div>
                ))}
              </dl>
              <Button variant="outline" size="sm" className="mt-3 rounded-full" disabled>
                <GitMerge aria-hidden="true" />
                Fusionar
              </Button>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Requiere la confirmación de una persona. En esta versión solo se propone.
              </p>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** #10 · Estado de cada canal con su motivo. */
export function CompliancePanel({ contact }: { contact: ContactDetail }) {
  const { policy } = contact;
  const rows: { label: string; permission: Permission }[] = [
    { label: "Llamar", permission: policy.call },
    { label: "WhatsApp", permission: policy.whatsapp },
    { label: "Email", permission: policy.email },
    { label: "Atención automática de la IA", permission: policy.aiAutomation },
  ];
  return (
    <Card size="sm" aria-labelledby="compliance-title">
      <CardHeader>
        <h2 id="compliance-title" className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck aria-hidden="true" className="size-4 text-muted-foreground" />
          Cumplimiento
        </h2>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2 text-sm">
          {rows.map(({ label, permission }) => (
            <li key={label} data-permission={permission.allowed ? "allowed" : "blocked"} className="flex gap-2">
              {permission.allowed ? (
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
              ) : (
                <Ban aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger" />
              )}
              <div>
                <p>
                  {label}
                  <span className="sr-only">: {permission.allowed ? "permitido" : "bloqueado"}</span>
                </p>
                {!permission.allowed ? <p className="text-xs text-muted-foreground">{permission.reasons.join(" · ")}</p> : null}
              </div>
            </li>
          ))}
          <li className="flex gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
            Consentimiento: {policy.consent === "registered" ? "registrado" : "no registrado en el origen de datos"}
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
