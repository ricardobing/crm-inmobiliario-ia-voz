import { asNonEmptyString, humanize } from "../text";
import type { Confidence, Provenance } from "../types";

// D13: la procedencia se deduce de source + sourceRef. Un dato "explicit" que viene de una importación
// (sourceRef "import-witei") no lo dijo el cliente en una conversación: se muestra como importado.

const IMPORT_REF = /^import[-_](.+)$/i;

export const HUMAN_EDIT_LABEL = "Editado por una persona";

export function provenanceOf(source: unknown, sourceRef: unknown): Provenance {
  const src = asNonEmptyString(source)?.toLowerCase() ?? null;
  const ref = asNonEmptyString(sourceRef);

  if (src === "manual") return { kind: "human", label: HUMAN_EDIT_LABEL };

  const importMatch = ref ? IMPORT_REF.exec(ref) : null;
  if (importMatch?.[1]) {
    const system = humanize(importMatch[1]);
    return { kind: "import", label: `Importado de ${system}`, system };
  }

  if (src === "explicit") return { kind: "conversation", label: "Dicho por el cliente", ref };

  return { kind: "unknown", label: src ? `Procedencia: ${src}` : "Procedencia desconocida", raw: src };
}

export function declaredProvenance(detail: unknown): Provenance {
  const text = asNonEmptyString(detail);
  return { kind: "declared", label: text ? humanize(text) : "Declarado", detail: text };
}

export const LEGACY_PREFERENCES_PROVENANCE: Provenance = {
  kind: "legacy_preferences",
  label: "Preferencias del sistema anterior",
};

export function asConfidence(value: unknown): Confidence | null {
  return value === "high" || value === "medium" || value === "low" ? value : null;
}
