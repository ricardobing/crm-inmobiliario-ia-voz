import { toWhatsAppNumber } from "@/domain/phones";
import type { ActionChannel, ContactDetail } from "@/domain/types";

/** Enlace para contactar por un canal, o null si falta el dato o la política lo bloquea (#10). */
export function contactHref(contact: ContactDetail, channel: ActionChannel): string | null {
  const { phone, email, policy } = contact;
  switch (channel) {
    case "call":
      return policy.call.allowed && phone?.e164 ? `tel:${phone.e164}` : null;
    case "whatsapp": {
      const number = phone ? toWhatsAppNumber(phone) : null;
      return policy.whatsapp.allowed && number ? `https://wa.me/${number}` : null;
    }
    case "email":
      return policy.email.allowed && email?.valid ? `mailto:${email.raw}` : null;
    default:
      return null;
  }
}

export const CHANNEL_ACTION_LABEL: Record<Exclude<ActionChannel, "none">, string> = {
  call: "Llamar",
  whatsapp: "WhatsApp",
  email: "Email",
};

export const isExternal = (href: string) => href.startsWith("https://");
