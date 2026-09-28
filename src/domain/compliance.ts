import { toLookupKey } from "./text";
import type { ContactCore, ContactPolicy, Permission } from "./types";

// #10 · D20, D21, D02, D05: qué canales se pueden usar con este contacto y por qué no.
// Solo bloquean señales estructuradas (etiquetas, flags); el texto libre de las notas no se interpreta aquí.

export type ComplianceConfig = {
  /** Etiquetas que significan "no llamar" (se comparan sin mayúsculas, tildes ni separadores). */
  doNotCallTags: string[];
};

export const DEFAULT_COMPLIANCE: ComplianceConfig = {
  doNotCallTags: ["no-llamar", "do-not-call"],
};

export function evaluatePolicy(contact: ContactCore, config: ComplianceConfig = DEFAULT_COMPLIANCE): ContactPolicy {
  const dncKeys = new Set(config.doNotCallTags.map(toLookupKey));
  const dncTag = contact.tags.find((tag) => dncKeys.has(toLookupKey(tag))) ?? null;
  const doNotCall = dncTag !== null;
  const testReason = contact.isTest ? ["Contacto de prueba"] : [];

  const phoneReasons = contact.phone?.valid ? [] : ["Sin teléfono válido"];
  // D20: "no llamar" bloquea también WhatsApp: pidió que no se le contacte por teléfono (criterio conservador).
  const dncReason = dncTag ? [`Pidió que no se le contacte por teléfono (etiqueta «${dncTag}»)`] : [];
  const emailReasons = !contact.email ? ["Sin email"] : contact.email.valid ? [] : ["Email con formato no válido"];
  const handoffReason = contact.handoff ? ["Pidió hablar con una persona: la IA no debe responder"] : [];

  return {
    call: permission([...testReason, ...phoneReasons, ...dncReason]),
    whatsapp: permission([...testReason, ...phoneReasons, ...dncReason]),
    email: permission([...testReason, ...emailReasons]),
    aiAutomation: permission([...testReason, ...handoffReason, ...dncReason]),
    // El export no trae un campo de consentimiento: se informa, no se bloquea (bloquearía a todos).
    consent: "not_recorded",
    doNotCall,
  };
}

function permission(reasons: string[]): Permission {
  return { allowed: reasons.length === 0, reasons };
}
