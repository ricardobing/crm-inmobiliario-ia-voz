import type { EmailView } from "./types";

// D05: validación de formato, sin intentar corregir ("mdolores@@gmail.com" no se adivina).
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: unknown): EmailView | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  return { raw: value, valid: EMAIL_FORMAT.test(value) };
}

/** Forma comparable para detectar duplicados. */
export function emailMatchKey(email: EmailView | null): string | null {
  return email?.valid ? email.raw.toLowerCase() : null;
}
