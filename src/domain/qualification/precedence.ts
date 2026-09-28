import type { Fact, Provenance } from "../types";

// D14: ante dos valores para el mismo hecho, manda lo editado por una persona; después, lo dicho en conversación;
// después, lo importado o declarado. A igualdad, el más reciente. Una fecha desconocida pierde.

const RANK: Record<Provenance["kind"], number> = {
  human: 4,
  conversation: 3,
  declared: 2,
  import: 2,
  legacy_preferences: 1,
  unknown: 0,
};

export const PRECEDENCE_RULE_LABEL = "Persona > conversación > importación; si empatan, el más reciente";

export function compareFactPrecedence(a: Fact, b: Fact): number {
  const byRank = RANK[b.provenance.kind] - RANK[a.provenance.kind];
  if (byRank !== 0) return byRank;
  const aIso = a.updatedAt.iso;
  const bIso = b.updatedAt.iso;
  if (aIso === bIso) return 0;
  if (aIso === null) return 1;
  if (bIso === null) return -1;
  return bIso.localeCompare(aIso);
}

/** Devuelve el valor que manda y los que quedan sustituidos. */
export function resolveFact<T extends Fact>(candidates: readonly T[]): { winner: T; overridden: T[] } | null {
  if (!candidates.length) return null;
  const [winner, ...overridden] = [...candidates].sort(compareFactPrecedence) as [T, ...T[]];
  return { winner, overridden };
}
