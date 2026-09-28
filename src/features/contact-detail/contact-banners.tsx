import { CopyCheck, FlaskConical, Headset, PhoneOff } from "lucide-react";
import Link from "next/link";
import type { ContactDetail } from "@/domain/types";
import { StatusBanner } from "@/features/shared/status-banner";

/** Avisos que un agente tiene que ver antes que nada. Solo aparecen si aplican. */
export function ContactBanners({ contact }: { contact: ContactDetail }) {
  const banners = [];

  // D21
  if (contact.handoff) {
    banners.push(
      <StatusBanner key="handoff" tone="danger" icon={Headset} title="Pidió hablar con una persona">
        {contact.handoff.reason ? <p>«{contact.handoff.reason}»</p> : null}
        <p className="mt-1">
          {contact.handoff.requestedAt.iso ? `Desde el ${contact.handoff.requestedAt.display}. ` : ""}
          La IA ya no debe responder: atiéndelo tú.
        </p>
      </StatusBanner>,
    );
  }

  // #10 · D20
  if (contact.policy.doNotCall) {
    banners.push(
      <StatusBanner key="dnc" tone="danger" icon={PhoneOff} title="No llamar ni escribir por WhatsApp">
        <p>{contact.policy.call.reasons.find((r) => r.includes("etiqueta")) ?? "Pidió que no se le llame."}</p>
        {contact.notes.length ? <p className="mt-1">Nota: «{contact.notes.join(" · ")}»</p> : null}
      </StatusBanner>,
    );
  }

  // #2 · D22
  const [duplicate] = contact.duplicates;
  if (duplicate) {
    banners.push(
      <StatusBanner key="duplicate" tone="warning" icon={CopyCheck} title={`Posible duplicado de ${duplicate.displayName}`}>
        <p>
          {duplicate.reasons[0]}. Revisa la propuesta de fusión antes de contactar para no trabajarlo dos veces.{" "}
          <Link href={`/contactos/${duplicate.id}`} className="font-medium underline underline-offset-2">
            Abrir {duplicate.id}
          </Link>
        </p>
      </StatusBanner>,
    );
  }

  // D02
  if (contact.isTest) {
    banners.push(
      <StatusBanner key="test" tone="neutral" icon={FlaskConical} title="Contacto de prueba">
        No aparece en el listado ni en la detección de duplicados, y no admite acciones.
      </StatusBanner>,
    );
  }

  if (!banners.length) return null;
  return <div className="flex flex-col gap-3">{banners}</div>;
}
