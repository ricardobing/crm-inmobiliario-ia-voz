import { Mail, MessageCircle, Phone, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toWhatsAppNumber } from "@/domain/phones";
import type { ContactDetail, Permission } from "@/domain/types";

type Action = {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string | null;
  permission: Permission;
  missingReason: string;
  primary?: boolean;
};

/** Acciones de contacto. Solo se habilitan si hay dato válido y la política lo permite (#10). */
export function ContactActions({ contact }: { contact: ContactDetail }) {
  const { phone, email, policy } = contact;
  const whatsapp = phone ? toWhatsAppNumber(phone) : null;
  const actions: Action[] = [
    {
      key: "call",
      label: "Llamar",
      icon: Phone,
      href: phone?.e164 ? `tel:${phone.e164}` : null,
      permission: policy.call,
      missingReason: "Sin teléfono válido",
      primary: true,
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      icon: MessageCircle,
      href: whatsapp ? `https://wa.me/${whatsapp}` : null,
      permission: policy.whatsapp,
      missingReason: "Sin teléfono válido",
    },
    {
      key: "email",
      label: "Email",
      icon: Mail,
      href: email?.valid ? `mailto:${email.raw}` : null,
      permission: policy.email,
      missingReason: email ? "Email con formato no válido" : "Sin email",
    },
  ];

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Contactar">
      {actions.map((action) => (
        <ActionButton key={action.key} action={action} />
      ))}
    </div>
  );
}

function ActionButton({ action }: { action: Action }) {
  const Icon = action.icon;
  const enabled = action.href !== null && action.permission.allowed;
  const variant = action.primary ? "default" : "outline";

  if (enabled && action.href) {
    return (
      <Button asChild variant={variant} size="lg" className="rounded-full px-4">
        <a
          href={action.href}
          data-action={action.key}
          {...(action.href.startsWith("https://") ? { target: "_blank", rel: "noreferrer" } : {})}
        >
          <Icon aria-hidden="true" />
          {action.label}
        </a>
      </Button>
    );
  }

  const reasons = action.permission.allowed ? [action.missingReason] : action.permission.reasons;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* El span recibe el foco: un botón deshabilitado no dispara eventos y el motivo no se vería. */}
        <span tabIndex={0} className="rounded-full" data-action={action.key} data-blocked="true">
          <Button variant={variant} size="lg" className="pointer-events-none rounded-full px-4" disabled aria-disabled="true">
            <Icon aria-hidden="true" />
            {action.label}
            <span className="sr-only">. No disponible: {reasons.join(". ")}</span>
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{reasons.join(" · ")}</TooltipContent>
    </Tooltip>
  );
}
