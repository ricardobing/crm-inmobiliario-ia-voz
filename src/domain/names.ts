import type { DisplayName, EmailView, PhoneView } from "./types";

// D03: nombre con fallbacks y capitalización solo cuando el dato viene todo en mayúsculas o todo en minúsculas.

export const UNIDENTIFIED_CONTACT_LABEL = "Contacto sin identificar";

const LOWERCASE_PARTICLES = new Set(["de", "del", "la", "las", "los", "y", "e", "da", "do", "dos", "das", "van", "von"]);

export function buildDisplayName(input: {
  fullName: unknown;
  phone: PhoneView | null;
  email: EmailView | null;
}): DisplayName {
  const raw = typeof input.fullName === "string" ? input.fullName : null;
  const cleaned = raw?.replace(/\s+/g, " ").trim();

  if (cleaned) {
    const text = prettifyName(cleaned);
    return { text, basis: "name", raw, initials: initialsOf(text) };
  }
  if (input.phone) {
    return { text: input.phone.display, basis: "phone", raw, initials: null };
  }
  if (input.email) {
    return { text: input.email.raw, basis: "email", raw, initials: null };
  }
  return { text: UNIDENTIFIED_CONTACT_LABEL, basis: "none", raw, initials: null };
}

/** "JOSÉ LUIS MARTÍN" → "José Luis Martín"; "carmen ruiz" → "Carmen Ruiz"; "David P." se respeta. */
export function prettifyName(name: string): string {
  const hasLetters = /\p{L}/u.test(name);
  const isAllUpper = name === name.toLocaleUpperCase("es");
  const isAllLower = name === name.toLocaleLowerCase("es");
  if (!hasLetters || (!isAllUpper && !isAllLower)) return name;

  return name
    .toLocaleLowerCase("es")
    .split(" ")
    .map((word, index) => (index > 0 && LOWERCASE_PARTICLES.has(word) ? word : capitalizeCompound(word)))
    .join(" ");
}

function capitalizeCompound(word: string): string {
  // Respeta compuestos: "garcía-lópez" → "García-López", "o'neill" → "O'Neill".
  return word.replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toLocaleUpperCase("es"));
}

function initialsOf(name: string): string | null {
  const words = name
    .split(" ")
    .filter((w) => !LOWERCASE_PARTICLES.has(w.toLocaleLowerCase("es")))
    .map((w) => w.match(/\p{L}/u)?.[0])
    .filter((c): c is string => Boolean(c));
  if (words.length === 0) return null;
  return words
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase("es");
}

/** Forma comparable de un nombre (sin tildes ni mayúsculas), en tokens. */
export function nameTokens(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter((t) => t.length > 1 && !LOWERCASE_PARTICLES.has(t));
}
