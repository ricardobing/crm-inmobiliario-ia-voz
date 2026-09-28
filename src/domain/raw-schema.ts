import { z } from "zod";

// Lectura tolerante: un campo con un tipo inesperado se trata como ausente (`.catch(null)`) en vez de tumbar el
// contacto entero. Solo el `id` es obligatorio. Las claves no previstas se conservan (`looseObject`).

const optionalText = z.string().nullish().catch(null);
const dateLike = z.union([z.string(), z.number()]).nullish().catch(null);
const optionalBoolean = z.boolean().nullish().catch(null);

export const rawInteractionSchema = z.looseObject({
  id: z.string().min(1),
  channel: optionalText,
  direction: optionalText,
  created_at: dateLike,
  content: optionalText,
  metadata: z.record(z.string(), z.unknown()).nullish().catch(null),
});

export const rawContactSchema = z.looseObject({
  id: z.string().min(1),
  organization_id: optionalText,
  full_name: optionalText,
  phone: z.union([z.string(), z.number()]).nullish().catch(null),
  email: optionalText,
  lead_source: optionalText,
  contact_type: optionalText,
  created_at: dateLike,
  ai_handoff: optionalBoolean,
  handoff_reason: optionalText,
  handoff_requested_at: dateLike,
  is_test: optionalBoolean,
  assigned_agent_id: optionalText,
  matching_enabled: optionalBoolean,
  tags: z.array(z.unknown()).nullish().catch(null),
  notes: optionalText,
  // zod 4: `z.unknown()` a secas hace la clave obligatoria; aquí puede faltar.
  qualification_data: z.unknown().optional(),
  interest_preferences: z.unknown().optional(),
  interactions: z.array(z.unknown()).nullish().catch(null),
});

export const rawExportSchema = z.looseObject({
  organization: z.looseObject({ id: z.string(), name: z.string().nullish() }).nullish().catch(null),
  exported_at: dateLike,
  contacts: z.array(z.unknown()),
});

export type RawContact = z.infer<typeof rawContactSchema>;
export type RawExport = z.infer<typeof rawExportSchema>;
