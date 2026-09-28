import { Mail, MessageCircle, Phone, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ActionChannel, ContactDetail } from "@/domain/types";
import { CHANNEL_ACTION_LABEL, contactHref, isExternal } from "./contact-links";

const ACTIONS: { channel: Exclude<ActionChannel, "none">; icon: LucideIcon; primary?: boolean }[] = [
  { channel: "call", icon: Phone, primary: true },
  { channel: "whatsapp", icon: MessageCircle },
  { channel: "email", icon: Mail },
];

/** Acciones de contacto. Solo se habilitan si hay dato válido y la política de cumplimiento lo permite (#10). */
export function ContactActions({ contact }: { contact: ContactDetail }) {
  return (
    <div className="flex flex-wrap gap-2 lg:max-w-72 lg:justify-end" role="group" aria-label="Contactar">
      {ACTIONS.map(({ channel, icon: Icon, primary }) => {
        const href = contactHref(contact, channel);
        const label = CHANNEL_ACTION_LABEL[channel];
        const variant = primary ? "default" : "outline";

        if (href) {
          return (
            <Button key={channel} asChild variant={variant} size="lg" className="rounded-full px-4">
              <a href={href} data-action={channel} {...(isExternal(href) ? { target: "_blank", rel: "noreferrer" } : {})}>
                <Icon aria-hidden="true" />
                {label}
              </a>
            </Button>
          );
        }

        const reasons = contact.policy[channel].reasons;
        return (
          <Tooltip key={channel}>
            <TooltipTrigger asChild>
              {/* El span recibe el foco: un botón deshabilitado no dispara eventos y el motivo no se vería. */}
              <span tabIndex={0} className="rounded-full" data-action={channel} data-blocked="true">
                <Button variant={variant} size="lg" className="pointer-events-none rounded-full px-4" disabled>
                  <Icon aria-hidden="true" />
                  {label}
                  <span className="sr-only">. No disponible: {reasons.join(". ")}</span>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{reasons.join(" · ") || "No disponible"}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
