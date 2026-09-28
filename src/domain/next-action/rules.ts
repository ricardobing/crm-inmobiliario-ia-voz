import type { ActionChannel, ChannelKind, ContactCore, ContactPolicy, DuplicateCandidate, Fact } from "../types";

// #4 · D23: reglas deterministas y explicables. Añadir una regla = añadir un objeto a RULES (y su caso de test).

export type NextActionContext = {
  contact: ContactCore;
  policy: ContactPolicy;
  duplicates: DuplicateCandidate[];
};

export type RuleOutcome = {
  title: string;
  reason: string;
  /** Canales en orden de preferencia; el motor elige el primero que la política permita. [] = no requiere contactar. */
  channels: Exclude<ActionChannel, "none">[];
};

export type NextActionRule = {
  id: string;
  priority: number;
  /** Si aplica, solo se muestra esta regla (p. ej., contacto de prueba). */
  exclusive?: boolean;
  /** Reglas que dejan de tener sentido si esta aplica. */
  supersedes?: string[];
  applies: (ctx: NextActionContext) => boolean;
  build: (ctx: NextActionContext) => RuleOutcome;
};

/** Qué datos hacen falta para considerar a alguien cualificado y poder proponerle inmuebles. */
export const QUALIFIED_WHEN_PRESENT = ["zones", "budget"] as const;
const QUALIFIED_LABELS: Record<(typeof QUALIFIED_WHEN_PRESENT)[number], string> = { zones: "zona", budget: "presupuesto" };

const PHONE_FIRST: RuleOutcome["channels"] = ["call", "whatsapp", "email"];

/**
 * Canales asíncronos: un mensaje entrante sin respuesta posterior está pendiente.
 * Una llamada entrante no: es una conversación que ya se atendió.
 */
const REPLY_CHANNEL: Partial<Record<ChannelKind, { channels: RuleOutcome["channels"]; phrase: string }>> = {
  whatsapp: { channels: ["whatsapp", "call", "email"], phrase: "Escribió por WhatsApp" },
  email: { channels: ["email", "call", "whatsapp"], phrase: "Escribió por email" },
  web_form: { channels: ["email", "call", "whatsapp"], phrase: "Envió el formulario web" },
};

export const RULES: NextActionRule[] = [
  {
    id: "test-contact",
    priority: 1000,
    exclusive: true,
    applies: ({ contact }) => contact.isTest,
    build: () => ({ title: "Sin acción: es un contacto de prueba", reason: "No se trabaja ni cuenta en las métricas.", channels: [] }),
  },
  {
    id: "handoff",
    priority: 100,
    supersedes: ["unanswered-inbound"],
    applies: ({ contact }) => contact.handoff !== null,
    build: ({ contact }) => ({
      title: "Llamar ya: pidió hablar con una persona",
      reason: contact.handoff?.reason
        ? `Motivo: «${contact.handoff.reason}». La IA ya no debe responder.`
        : "La IA derivó la conversación a una persona.",
      channels: PHONE_FIRST,
    }),
  },
  {
    id: "possible-duplicate",
    priority: 90,
    applies: ({ duplicates }) => duplicates.length > 0,
    build: ({ duplicates }) => {
      const [first] = duplicates;
      return {
        title: "Revisar el posible duplicado antes de contactar",
        reason: first ? `Coincide con ${first.displayName} (${first.id}): ${first.reasons[0]?.toLowerCase()}.` : "",
        channels: [],
      };
    },
  },
  {
    id: "do-not-call",
    priority: 85,
    applies: ({ policy }) => policy.doNotCall,
    build: () => ({
      title: "Contactar solo por email",
      reason: "Pidió que no se le llame: llamar y escribir por WhatsApp están bloqueados.",
      channels: ["email"],
    }),
  },
  {
    id: "no-reachable-channel",
    priority: 80,
    applies: ({ contact, policy }) =>
      !contact.isTest && !policy.call.allowed && !policy.whatsapp.allowed && !policy.email.allowed,
    build: () => ({
      title: "Conseguir un dato de contacto válido",
      reason: "No hay ningún canal utilizable con los datos actuales.",
      channels: [],
    }),
  },
  {
    id: "unanswered-inbound",
    priority: 70,
    applies: ({ contact }) => {
      const last = contact.timeline[0];
      return last?.direction === "inbound" && REPLY_CHANNEL[last.channel.kind] !== undefined;
    },
    build: ({ contact }) => {
      const last = contact.timeline[0];
      const reply = last ? REPLY_CHANNEL[last.channel.kind] : undefined;
      return {
        title: "Responder a su último mensaje",
        reason: last && reply ? `${reply.phrase} el ${last.at.display} y no tiene respuesta.` : "",
        channels: reply?.channels ?? PHONE_FIRST,
      };
    },
  },
  {
    id: "qualify",
    priority: 50,
    applies: ({ contact }) => contact.qualification.status !== "ok",
    build: ({ contact }) => ({
      title: "Llamar para cualificar",
      reason: contact.timeline.length
        ? "Aún no sabemos qué busca: operación, zona y presupuesto."
        : "Todavía no se ha hablado con este contacto.",
      channels: PHONE_FIRST,
    }),
  },
  {
    id: "complete-qualification",
    priority: 45,
    applies: (ctx) => ctx.contact.qualification.status === "ok" && missingQualification(ctx).length > 0,
    build: (ctx) => ({
      title: "Completar la cualificación",
      reason: `Falta: ${missingQualification(ctx).join(" y ")}.`,
      channels: PHONE_FIRST,
    }),
  },
  {
    id: "propose-properties",
    priority: 40,
    applies: (ctx) => ctx.contact.qualification.status === "ok" && missingQualification(ctx).length === 0,
    build: ({ contact }) => {
      const zones = findFact(contact, "zones")?.value.display;
      const budget = findFact(contact, "budget")?.value.display;
      return {
        title: "Proponer inmuebles y agendar visita",
        reason: `Ya sabemos qué busca: ${[zones, budget].filter(Boolean).join(" · ")}.`,
        channels: PHONE_FIRST,
      };
    },
  },
  {
    id: "fix-email",
    priority: 30,
    applies: ({ contact }) => contact.email !== null && !contact.email.valid,
    build: ({ contact }) => ({
      title: "Corregir el email",
      reason: `«${contact.email?.raw}» no tiene un formato válido.`,
      channels: [],
    }),
  },
];

function findFact(contact: ContactCore, key: string): Fact | undefined {
  if (contact.qualification.status !== "ok") return undefined;
  for (const group of contact.qualification.groups) {
    const fact = group.facts.find((f) => f.key === key && f.value.type !== "empty");
    if (fact) return fact;
  }
  return undefined;
}

function missingQualification({ contact }: NextActionContext): string[] {
  return QUALIFIED_WHEN_PRESENT.filter((key) => !findFact(contact, key)).map((key) => QUALIFIED_LABELS[key]);
}
