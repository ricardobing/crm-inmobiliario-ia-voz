import { FlaskConical, Headset } from "lucide-react";
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
